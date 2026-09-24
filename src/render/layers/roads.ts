import { BoxGeometry, Group, MeshLambertMaterial } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIRECTIONS } from '../../sim/grid';
import { ROAD_BASE_MASK, roadPiece } from '../../sim/roads';
import type { RoadShape } from '../../sim/roads';
import type { SimState } from '../../sim/types';
import { BatchSet, commitInstances, createInstanced, paint, transform } from '../instancing';
import { ROAD_MODELS } from '../models/catalog';
import type { ModelLibrary } from '../models/library';
import { PALETTE, ROAD } from '../palette';

const SHAPES = Object.keys(ROAD_BASE_MASK) as RoadShape[];

/** Asphalt square plus one arm and centre marking per connected side (north is −z). */
function buildPieceGeometry(mask: number): BufferGeometry {
  const { width: w, thickness: t, markingWidth: m } = ROAD;
  const arm = (1 - w) / 2;
  const parts: BufferGeometry[] = [
    paint(new BoxGeometry(w, t, w).translate(0, t / 2, 0), PALETTE.asphalt),
  ];
  for (const { bit, dx, dy } of DIRECTIONS) {
    if (!(mask & bit)) continue;
    const reach = w / 2 + arm / 2;
    const armGeometry = dx !== 0 ? new BoxGeometry(arm, t, w) : new BoxGeometry(w, t, arm);
    parts.push(paint(armGeometry.translate(dx * reach, t / 2, dy * reach), PALETTE.asphalt));
    const markGeometry =
      dx !== 0 ? new BoxGeometry(0.5, t + 0.006, m) : new BoxGeometry(m, t + 0.006, 0.5);
    parts.push(paint(markGeometry.translate(dx * 0.25, t / 2, dy * 0.25), PALETTE.roadMarking));
  }
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/**
 * Road tiles drawn with the roads kit: each auto-shape from the sim maps to a
 * kit piece, turned from its authored orientation to the sim's rotation. A shape
 * whose model failed to load falls back to a simple procedural piece.
 */
export class RoadLayer {
  readonly group = new Group();
  private readonly models: BatchSet;
  private readonly fallbacks = new Map<RoadShape, InstancedMesh>();

  constructor(
    capacity: number,
    private readonly library: ModelLibrary,
  ) {
    this.models = new BatchSet(this.group, { receiveShadow: true });
    const material = new MeshLambertMaterial({ vertexColors: true });
    for (const shape of SHAPES) {
      if (library.get(ROAD_MODELS[shape].model)) continue;
      const mesh = createInstanced(buildPieceGeometry(ROAD_BASE_MASK[shape]), material, capacity);
      mesh.receiveShadow = true;
      this.fallbacks.set(shape, mesh);
      this.group.add(mesh);
    }
  }

  update(state: Readonly<SimState>): void {
    const counts = new Map<RoadShape, number>(SHAPES.map((s) => [s, 0]));
    this.models.begin();
    state.tiles.forEach((tile, i) => {
      if (tile.kind !== 'road') return;
      const x = i % state.width;
      const y = (i - x) / state.width;
      const { shape, rotation } = roadPiece(state, x, y);
      const spec = ROAD_MODELS[shape];
      const model = this.library.get(spec.model);
      // Sim rotations are clockwise seen from above, which is a negative turn about +y.
      const turns = model ? rotation - spec.rotation : rotation;
      const matrix = transform(x + 0.5, 0, y + 0.5, (-turns * Math.PI) / 2);
      if (model) {
        model.parts.forEach((part, p) => {
          this.models.get(`${model.id}#${p}`, part.geometry, part.material).add(matrix);
        });
        return;
      }
      const n = counts.get(shape) ?? 0;
      this.fallbacks.get(shape)?.setMatrixAt(n, matrix);
      counts.set(shape, n + 1);
    });
    this.models.end();
    for (const [shape, mesh] of this.fallbacks) commitInstances(mesh, counts.get(shape) ?? 0);
  }
}
