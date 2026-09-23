import { BoxGeometry, Group, MeshLambertMaterial } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIRECTIONS } from '../../sim/grid';
import { ROAD_BASE_MASK, roadPiece } from '../../sim/roads';
import type { RoadShape } from '../../sim/roads';
import type { SimState } from '../../sim/types';
import { commitInstances, createInstanced, paint, transform } from '../instancing';
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

/** One instanced mesh per road shape; each road tile picks its shape and rotation from the sim. */
export class RoadLayer {
  readonly group = new Group();
  private readonly meshes = new Map<RoadShape, InstancedMesh>();

  constructor(capacity: number) {
    const material = new MeshLambertMaterial({ vertexColors: true });
    for (const shape of SHAPES) {
      const mesh = createInstanced(buildPieceGeometry(ROAD_BASE_MASK[shape]), material, capacity);
      mesh.receiveShadow = true;
      this.meshes.set(shape, mesh);
      this.group.add(mesh);
    }
  }

  update(state: Readonly<SimState>): void {
    const counts = new Map<RoadShape, number>(SHAPES.map((s) => [s, 0]));
    state.tiles.forEach((tile, i) => {
      if (tile.kind !== 'road') return;
      const x = i % state.width;
      const y = (i - x) / state.width;
      const { shape, rotation } = roadPiece(state, x, y);
      const n = counts.get(shape) ?? 0;
      // Sim rotations are clockwise seen from above, which is a negative turn about +y.
      this.meshes
        .get(shape)
        ?.setMatrixAt(n, transform(x + 0.5, 0, y + 0.5, (-rotation * Math.PI) / 2));
      counts.set(shape, n + 1);
    });
    for (const [shape, mesh] of this.meshes) commitInstances(mesh, counts.get(shape) ?? 0);
  }
}
