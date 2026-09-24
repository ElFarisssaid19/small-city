import { CONFIG } from '../sim/config';
import { inBounds, toIndex } from '../sim/grid';
import type { SimState } from '../sim/types';

export type Facing = 'north' | 'east' | 'south' | 'west';

const SIDES: readonly Facing[] = ['north', 'east', 'south', 'west'];

/**
 * Stable 32-bit hash of tile coordinates. Purely visual: the same tile always
 * gets the same answer across reloads, and the simulation's RNG is never used.
 */
export function coordHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(salt, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Which of `count` variants a tile shows. */
export function pickVariant(x: number, y: number, salt: number, count: number): number {
  return count > 0 ? coordHash(x, y, salt) % count : 0;
}

/**
 * The side of a tile that looks at its nearest road (Manhattan distance, up to
 * the road-access radius), or null if there is none. Ties, such as a road
 * diagonally away, are broken by the tile hash.
 */
export function roadFacing(state: Readonly<SimState>, x: number, y: number): Facing | null {
  for (let d = 1; d <= CONFIG.zones.roadAccessRadius; d++) {
    const candidates: Facing[] = [];
    for (let dx = -d; dx <= d; dx++) {
      const rest = d - Math.abs(dx);
      for (const dy of rest === 0 ? [0] : [-rest, rest]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(state, nx, ny) || state.tiles[toIndex(state, nx, ny)].kind !== 'road')
          continue;
        if (Math.abs(dx) >= Math.abs(dy)) candidates.push(dx > 0 ? 'east' : 'west');
        if (Math.abs(dy) >= Math.abs(dx)) candidates.push(dy > 0 ? 'south' : 'north');
      }
    }
    if (candidates.length > 0) return candidates[coordHash(x, y, 7) % candidates.length];
  }
  return null;
}

/** Where a building's front points: at the nearest road, otherwise a stable random side. */
export function buildingFacing(state: Readonly<SimState>, x: number, y: number): Facing {
  return roadFacing(state, x, y) ?? SIDES[coordHash(x, y, 11) % SIDES.length];
}

/**
 * Rotation about +y that turns a model authored facing +z (south, the glTF
 * front) to face `facing`.
 */
export function facingYaw(facing: Facing): number {
  switch (facing) {
    case 'south':
      return 0;
    case 'east':
      return Math.PI / 2;
    case 'north':
      return Math.PI;
    case 'west':
      return -Math.PI / 2;
  }
}
