import { DIRECTIONS, inBounds, toIndex } from './grid';
import type { SimState } from './types';

export type RoadShape = 'isolated' | 'deadEnd' | 'straight' | 'corner' | 'tee' | 'cross';

/**
 * A road tile's shape plus how many quarter turns clockwise (seen from above)
 * it is rotated from the shape's base orientation:
 * deadEnd opens north, straight runs north–south, corner joins north+east,
 * tee joins north+east+south.
 */
export interface RoadPiece {
  shape: RoadShape;
  rotation: 0 | 1 | 2 | 3;
}

/** Connection mask of each shape in its base orientation (rotation 0). */
export const ROAD_BASE_MASK: Record<RoadShape, number> = {
  isolated: 0,
  deadEnd: 0b0001,
  straight: 0b0101,
  corner: 0b0011,
  tee: 0b0111,
  cross: 0b1111,
};

/** Rotates a N/E/S/W mask clockwise by `turns` quarter turns. */
export function rotateMask(mask: number, turns: number): number {
  let m = mask;
  for (let i = 0; i < turns % 4; i++) m = ((m << 1) | (m >> 3)) & 0b1111;
  return m;
}

function bitCount(mask: number): number {
  let count = 0;
  for (let m = mask; m; m >>= 1) count += m & 1;
  return count;
}

/** Bit mask (see grid.ts) of the orthogonal neighbours that are roads. */
export function roadMask(state: SimState, x: number, y: number): number {
  let mask = 0;
  for (const dir of DIRECTIONS) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (inBounds(state, nx, ny) && state.tiles[toIndex(state, nx, ny)].kind === 'road') {
      mask |= dir.bit;
    }
  }
  return mask;
}

export function shapeForMask(mask: number): RoadShape {
  switch (bitCount(mask)) {
    case 0:
      return 'isolated';
    case 1:
      return 'deadEnd';
    case 2:
      return mask === 0b0101 || mask === 0b1010 ? 'straight' : 'corner';
    case 3:
      return 'tee';
    default:
      return 'cross';
  }
}

export function pieceForMask(mask: number): RoadPiece {
  const shape = shapeForMask(mask);
  for (const rotation of [0, 1, 2, 3] as const) {
    if (rotateMask(ROAD_BASE_MASK[shape], rotation) === mask) return { shape, rotation };
  }
  return { shape, rotation: 0 };
}

/** The auto-connected piece for the road at (x, y), derived from its neighbours. */
export function roadPiece(state: SimState, x: number, y: number): RoadPiece {
  return pieceForMask(roadMask(state, x, y));
}
