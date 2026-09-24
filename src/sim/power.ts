import { CONFIG } from './config';
import { forEachNeighbour } from './grid';
import type { SimState, Tile } from './types';

export interface PowerReport {
  /** Total capacity of all plants. */
  supply: number;
  /** Total draw of all zone tiles, connected or not. */
  demand: number;
  /** Zone tiles left without electricity. */
  unpoweredZones: number;
}

/** Power lines, plants and zone buildings carry electricity; roads and empty land do not. */
export function conductsPower(tile: Tile): boolean {
  return tile.hasLine || tile.kind === 'powerPlant' || tile.kind === 'zone';
}

/** Power units a tile draws. */
export function consumption(tile: Tile): number {
  if (tile.kind !== 'zone' || tile.stage === 'empty' || tile.stage === 'abandoned') return 0;
  return CONFIG.power.zoneConsumption[tile.level];
}

/**
 * Recomputes `powered` for every tile. Each connected network of conductors
 * shares the capacity of the plants inside it; consumers are served in
 * breadth-first order from the plants until that capacity runs out.
 */
export function updatePower(state: SimState): PowerReport {
  const { tiles } = state;
  const n = tiles.length;
  const inNetwork = new Uint8Array(n);
  const served = new Uint8Array(n);
  const queue = new Int32Array(n);
  const report: PowerReport = { supply: 0, demand: 0, unpoweredZones: 0 };

  for (const tile of tiles) {
    tile.powered = false;
    report.demand += consumption(tile);
  }

  for (let start = 0; start < n; start++) {
    if (inNetwork[start] || !conductsPower(tiles[start])) continue;

    // 1. Flood-fill the network and collect its plants.
    const plantTiles: number[] = [];
    let capacity = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    inNetwork[start] = 1;
    while (head < tail) {
      const i = queue[head++];
      const tile = tiles[i];
      if (tile.kind === 'powerPlant') {
        plantTiles.push(i);
        if (tile.anchor === i) capacity += CONFIG.power.plantCapacity;
      }
      forEachNeighbour(state, i, (j) => {
        if (!inNetwork[j] && conductsPower(tiles[j])) {
          inNetwork[j] = 1;
          queue[tail++] = j;
        }
      });
    }
    if (capacity === 0) continue;
    report.supply += capacity;

    // 2. Serve the network outward from its plants.
    let remaining = capacity;
    head = 0;
    tail = 0;
    for (const i of plantTiles) {
      served[i] = 1;
      queue[tail++] = i;
    }
    while (head < tail) {
      const i = queue[head++];
      const tile = tiles[i];
      const draw = consumption(tile);
      // Empty lots draw nothing yet, but only count as powered while the network
      // could still run a construction site on them.
      const needed = draw === 0 && tile.kind === 'zone' ? CONFIG.power.zoneConsumption[0] : draw;
      if (needed <= remaining) {
        remaining -= draw;
        tile.powered = true;
      }
      forEachNeighbour(state, i, (j) => {
        if (!served[j] && conductsPower(tiles[j])) {
          served[j] = 1;
          queue[tail++] = j;
        }
      });
    }
  }

  for (const tile of tiles) {
    if (tile.kind === 'zone' && !tile.powered) report.unpoweredZones++;
  }
  return report;
}
