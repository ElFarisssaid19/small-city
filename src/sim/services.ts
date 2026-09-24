import { buildingTiles } from './buildings';
import { CONFIG } from './config';
import { forEachNeighbour } from './grid';
import { SERVICE_TYPES } from './types';
import type { ServiceType, SimState } from './types';

/**
 * A service building works only with road access and power (on any of its
 * tiles); parks work anywhere.
 */
export function serviceActive(state: Readonly<SimState>, anchor: number): boolean {
  const service = state.tiles[anchor].service;
  if (service === null) return false;
  if (service === 'park') return true;
  const tiles = buildingTiles(state, anchor).map((i) => state.tiles[i]);
  return tiles.some((t) => t.roadAccess) && tiles.some((t) => t.powered);
}

/** Anchor indices of every working building of one service type. */
export function activeServices(state: Readonly<SimState>, service: ServiceType): number[] {
  const anchors: number[] = [];
  state.tiles.forEach((tile, i) => {
    if (tile.kind === 'service' && tile.service === service && tile.anchor === i) {
      if (serviceActive(state, i)) anchors.push(i);
    }
  });
  return anchors;
}

/**
 * Recomputes every tile's coverage: a tile is covered by a service when it is
 * within that service's radius (Manhattan distance) of a working building of it.
 * One breadth-first search per service type from all its buildings at once,
 * cut off at the radius, so the cost is O(tiles) per type.
 */
export function updateCoverage(state: SimState): void {
  const { tiles } = state;
  const distance = new Int16Array(tiles.length);
  const queue = new Int32Array(tiles.length);

  for (const service of SERVICE_TYPES) {
    const radius = CONFIG.services[service].radius;
    distance.fill(-1);
    let head = 0;
    let tail = 0;
    for (const anchor of activeServices(state, service)) {
      for (const i of buildingTiles(state, anchor)) {
        distance[i] = 0;
        queue[tail++] = i;
      }
    }
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
      tile.coverage[service] = distance[i] >= 0;
    });
  }
}
