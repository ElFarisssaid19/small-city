import { BoxGeometry, CylinderGeometry, Group, MeshLambertMaterial } from 'three';
import type { InstancedMesh, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../sim/config';
import type { SimState } from '../../sim/types';
import { BatchSet, commitInstances, createInstanced, paint, transform } from '../instancing';
import { PLANT_PARTS, POLE_MODEL } from '../models/catalog';
import type { LoadedModel, ModelLibrary } from '../models/library';
import { PALETTE } from '../palette';

/** The kit pole is sized for roadsides; power lines use it a little larger. */
const POLE_SCALE = 1.6;
/** Wire attachment on the kit pole's crossarm (height, and offset either side), in tiles. */
const KIT_WIRE = { height: 0.47 * POLE_SCALE, offset: 0.09 * POLE_SCALE };
/** The procedural fallback pole carries one wire on top. */
const FALLBACK_WIRE = { height: 0.86, offset: 0 };

interface PlantPart {
  model: LoadedModel;
  x: number;
  z: number;
  scale: number;
}

/**
 * Power lines as poles with wires between neighbouring line tiles, and 2×2 power
 * plants assembled from industrial kit parts. Missing models fall back to the
 * procedural pole and boxy plant.
 */
export class PowerLayer {
  readonly group = new Group();
  private readonly models: BatchSet;
  private readonly pole: LoadedModel | null;
  private readonly plantParts: PlantPart[] | null;
  private readonly fallbackPoles: InstancedMesh | null = null;
  private readonly fallbackPlants: { body: InstancedMesh; chimneys: InstancedMesh } | null = null;
  private readonly wires: InstancedMesh;

  constructor(capacity: number, library: ModelLibrary) {
    this.models = new BatchSet(this.group, { castShadow: true, receiveShadow: true });
    this.pole = library.get(POLE_MODEL) ?? null;

    const parts: PlantPart[] = [];
    for (const { model: id, x, z, width } of PLANT_PARTS) {
      const model = library.get(id);
      if (model) parts.push({ model, x, z, scale: width / Math.max(model.size.x, model.size.z) });
    }
    this.plantParts = parts.length === PLANT_PARTS.length ? parts : null;

    // Wires run between tile centres; the kit pole carries two, one per crossarm end.
    this.wires = createInstanced(
      new BoxGeometry(1, 0.02, 0.02),
      new MeshLambertMaterial({ color: PALETTE.wire }),
      capacity * 4,
    );
    this.group.add(this.wires);

    if (!this.pole) {
      const pole = mergeGeometries([
        paint(new BoxGeometry(0.07, 0.9, 0.07).translate(0, 0.45, 0), PALETTE.pole),
        paint(
          new BoxGeometry(0.16, 0.16, 0.16).translate(0, FALLBACK_WIRE.height, 0),
          PALETTE.pole,
        ),
      ]);
      this.fallbackPoles = createInstanced(
        pole,
        new MeshLambertMaterial({ vertexColors: true }),
        capacity,
      );
      this.fallbackPoles.castShadow = true;
      this.group.add(this.fallbackPoles);
    }
    if (!this.plantParts) {
      const size = CONFIG.power.plantSize;
      const body = createInstanced(
        new BoxGeometry(size * 0.86, 0.95, size * 0.72).translate(0, 0.475, 0),
        new MeshLambertMaterial({ color: PALETTE.plant }),
        capacity,
      );
      const chimneys = createInstanced(
        new CylinderGeometry(0.13, 0.17, 1.9, 10).translate(0, 0.95, 0),
        new MeshLambertMaterial({ color: PALETTE.chimney }),
        capacity * 2,
      );
      for (const mesh of [body, chimneys]) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
      this.fallbackPlants = { body, chimneys };
    }
  }

  update(state: Readonly<SimState>): void {
    const { width, height, tiles } = state;
    const half = CONFIG.power.plantSize / 2;
    const wire = this.pole ? KIT_WIRE : FALLBACK_WIRE;
    const offsets = wire.offset === 0 ? [0] : [-wire.offset, wire.offset];
    let poles = 0;
    let wires = 0;
    let plants = 0;
    let chimneys = 0;
    this.models.begin();

    const addWires = (x: number, z: number, alongX: boolean) => {
      for (const o of offsets) {
        const matrix = alongX
          ? transform(x, wire.height, z + o)
          : transform(x + o, wire.height, z, Math.PI / 2);
        this.wires.setMatrixAt(wires++, matrix);
      }
    };

    tiles.forEach((tile, i) => {
      const x = i % width;
      const y = (i - x) / width;
      if (tile.hasLine) {
        const east = x + 1 < width && tiles[i + 1].hasLine;
        const west = x > 0 && tiles[i - 1].hasLine;
        const south = y + 1 < height && tiles[i + width].hasLine;
        // Crossings keep the road clear: the wire passes over without a pole.
        if (tile.kind === 'powerLine') {
          if (this.pole) this.addPole(this.pole, x, y, !east && !west);
          else this.fallbackPoles?.setMatrixAt(poles++, transform(x + 0.5, 0, y + 0.5));
        }
        if (east) addWires(x + 1, y + 0.5, true);
        if (south) addWires(x + 0.5, y + 1, false);
      }

      if (tile.kind === 'powerPlant' && tile.anchor === i) {
        const cx = x + half;
        const cz = y + half;
        if (this.plantParts) {
          for (const { model, x: ox, z: oz, scale } of this.plantParts) {
            this.addModel(model, transform(cx + ox, 0, cz + oz, 0, scale, scale, scale));
          }
        } else if (this.fallbackPlants) {
          const { body, chimneys: stacks } = this.fallbackPlants;
          body.setMatrixAt(plants++, transform(cx, 0, cz));
          stacks.setMatrixAt(chimneys++, transform(cx - 0.45, 0.9, cz - half * 0.45));
          stacks.setMatrixAt(chimneys++, transform(cx + 0.1, 0.9, cz - half * 0.45));
        }
      }
    });

    this.models.end();
    commitInstances(this.wires, wires);
    if (this.fallbackPoles) commitInstances(this.fallbackPoles, poles);
    if (this.fallbackPlants) {
      commitInstances(this.fallbackPlants.body, plants);
      commitInstances(this.fallbackPlants.chimneys, chimneys);
    }
  }

  /** A kit pole whose crossarm lies across the line: along z for east–west runs, else along x. */
  private addPole(pole: LoadedModel, x: number, y: number, northSouth: boolean): void {
    const yaw = northSouth ? Math.PI / 2 : 0;
    this.addModel(pole, transform(x + 0.5, 0, y + 0.5, yaw, POLE_SCALE, POLE_SCALE, POLE_SCALE));
  }

  private addModel(model: LoadedModel, matrix: Matrix4): void {
    model.parts.forEach((part, p) => {
      this.models.get(`${model.id}#${p}`, part.geometry, part.material).add(matrix);
    });
  }
}
