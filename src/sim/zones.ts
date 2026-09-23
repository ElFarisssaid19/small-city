import { CONFIG } from './config';
import { chance } from './rng';
import type { SimState, Tile, ZoneType } from './types';

export interface ZoneReport {
  /** Lots that started construction today. */
  started: number;
  /** Buildings finished today. */
  completed: number;
  /** Buildings abandoned today. */
  abandoned: number;
}

/** Residents (residential) or jobs (commercial, industrial) of a building at `level`. */
export function capacityOf(zone: ZoneType, level: number): number {
  return CONFIG.zones.capacity[zone][level] ?? 0;
}

/** A zone can develop and stay occupied only with both power and road access. */
export function hasService(tile: Tile): boolean {
  return tile.powered && tile.roadAccess;
}

/** Advances every zone lot by one day: growth, construction, upgrades, decline and abandonment. */
export function updateZones(state: SimState): ZoneReport {
  const report: ZoneReport = { started: 0, completed: 0, abandoned: 0 };
  for (const tile of state.tiles) {
    if (tile.kind !== 'zone' || tile.zone === null) continue;
    stepZone(state, tile, state.demand[tile.zone], report);
    tile.residents =
      tile.zone === 'residential' && tile.stage === 'developed'
        ? capacityOf('residential', tile.level)
        : 0;
  }
  return report;
}

function stepZone(state: SimState, tile: Tile, demand: number, report: ZoneReport): void {
  const z = CONFIG.zones;

  if (!hasService(tile)) {
    if (tile.stage !== 'construction' && tile.stage !== 'developed') return;
    tile.neglect++;
    if (tile.neglect < z.abandonDays) return;
    if (tile.stage === 'developed') {
      tile.stage = 'abandoned';
      report.abandoned++;
    } else {
      // A stalled construction site is simply cancelled.
      tile.stage = 'empty';
      tile.progress = 0;
    }
    tile.neglect = 0;
    return;
  }

  tile.neglect = 0;
  switch (tile.stage) {
    case 'empty':
      if (demand > 0 && chance(state, z.growthChance * demand)) {
        tile.stage = 'construction';
        tile.progress = z.constructionDays;
        report.started++;
      }
      break;
    case 'construction':
      tile.progress--;
      if (tile.progress <= 0) {
        tile.stage = 'developed';
        tile.level = 1;
        tile.progress = 0;
        report.completed++;
      }
      break;
    case 'developed':
      if (
        tile.level < z.maxLevel &&
        demand >= z.upgradeMinDemand &&
        chance(state, z.upgradeChance * demand)
      ) {
        tile.level++;
      } else if (tile.level > 1 && demand <= z.declineDemand && chance(state, z.declineChance)) {
        tile.level--;
      }
      break;
    case 'abandoned':
      if (chance(state, z.recoverChance)) {
        tile.stage = 'empty';
        tile.level = 0;
      }
      break;
  }
}
