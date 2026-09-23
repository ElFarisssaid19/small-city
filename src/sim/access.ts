import { CONFIG } from './config';
import { forEachNeighbour } from './grid';
import type { SimState } from './types';

/**
 * Recomputes `roadAccess` for every tile: true when a road lies within
 * `roadAccessRadius` (Manhattan distance). One multi-source breadth-first
 * search from all roads, cut off at the radius, so the cost is O(tiles).
 */
export function updateRoadAccess(state: SimState): void {
  const { tiles } = state;
  const radius = CONFIG.zones.roadAccessRadius;
  const distance = new Int16Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  let head = 0;
  let tail = 0;

  tiles.forEach((tile, i) => {
    if (tile.kind === 'road') {
      distance[i] = 0;
      queue[tail++] = i;
    }
  });

  while (head < tail) {
    const i = queue[head++];
    if (distance[i] === radius) continue;
    forEachNeighbour(state, i, (j) => {
      if (distance[j] < 0) {
        distance[j] = distance[i] + 1;
        queue[tail++] = j;
      }
    });
  }

  tiles.forEach((tile, i) => {
    tile.roadAccess = distance[i] >= 0;
  });
}
