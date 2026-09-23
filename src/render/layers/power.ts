import { BoxGeometry, CylinderGeometry, Group, MeshLambertMaterial } from 'three';
import type { InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../sim/config';
import type { SimState } from '../../sim/types';
import { commitInstances, createInstanced, paint, transform } from '../instancing';
import { PALETTE } from '../palette';

const WIRE_HEIGHT = 0.86;

/** Poles and wires for power lines, and a boxy plant with chimneys for power plants. */
export class PowerLayer {
  readonly group = new Group();
  private readonly poles: InstancedMesh;
  private readonly wires: InstancedMesh;
  private readonly plants: InstancedMesh;
  private readonly chimneys: InstancedMesh;

  constructor(capacity: number) {
    const vertexColored = new MeshLambertMaterial({ vertexColors: true });

    const pole = mergeGeometries([
      paint(new BoxGeometry(0.07, 0.9, 0.07).translate(0, 0.45, 0), PALETTE.pole),
      paint(new BoxGeometry(0.16, 0.16, 0.16).translate(0, WIRE_HEIGHT, 0), PALETTE.pole),
    ]);
    this.poles = createInstanced(pole, vertexColored, capacity);
    this.poles.castShadow = true;

    // A wire spanning one tile along +x, from tile centre to tile centre.
    this.wires = createInstanced(
      new BoxGeometry(1, 0.025, 0.025),
      new MeshLambertMaterial({ color: PALETTE.wire }),
      capacity * 2,
    );

    const size = CONFIG.power.plantSize;
    this.plants = createInstanced(
      new BoxGeometry(size * 0.86, 0.95, size * 0.72).translate(0, 0.475, 0),
      new MeshLambertMaterial({ color: PALETTE.plant }),
      capacity,
    );
    this.chimneys = createInstanced(
      new CylinderGeometry(0.13, 0.17, 1.9, 10).translate(0, 0.95, 0),
      new MeshLambertMaterial({ color: PALETTE.chimney }),
      capacity * 2,
    );
    for (const mesh of [this.plants, this.chimneys]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    this.group.add(this.poles, this.wires, this.plants, this.chimneys);
  }

  update(state: Readonly<SimState>): void {
    const { width, height, tiles } = state;
    const half = CONFIG.power.plantSize / 2;
    let poles = 0;
    let wires = 0;
    let plants = 0;
    let chimneys = 0;

    tiles.forEach((tile, i) => {
      const x = i % width;
      const y = (i - x) / width;
      if (tile.hasLine) {
        // Crossings keep the road clear: the wire passes over without a pole.
        if (tile.kind === 'powerLine')
          this.poles.setMatrixAt(poles++, transform(x + 0.5, 0, y + 0.5));
        if (x + 1 < width && tiles[i + 1].hasLine) {
          this.wires.setMatrixAt(wires++, transform(x + 1, WIRE_HEIGHT, y + 0.5));
        }
        if (y + 1 < height && tiles[i + width].hasLine) {
          this.wires.setMatrixAt(wires++, transform(x + 0.5, WIRE_HEIGHT, y + 1, Math.PI / 2));
        }
      }
      if (tile.kind === 'powerPlant' && tile.anchor === i) {
        const cx = x + half;
        const cz = y + half;
        this.plants.setMatrixAt(plants++, transform(cx, 0, cz));
        this.chimneys.setMatrixAt(chimneys++, transform(cx - 0.45, 0.9, cz - half * 0.45));
        this.chimneys.setMatrixAt(chimneys++, transform(cx + 0.1, 0.9, cz - half * 0.45));
      }
    });

    commitInstances(this.poles, poles);
    commitInstances(this.wires, wires);
    commitInstances(this.plants, plants);
    commitInstances(this.chimneys, chimneys);
  }
}
