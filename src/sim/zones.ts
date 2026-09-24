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
export function hasService(tile: Readonly<Tile>): boolean {
  return tile.powered && tile.roadAccess;
}

/** Empty lots only start building while their zone type is in demand. */
export function inDemand(demand: number): boolean {
  return demand > 0;
}

export type Requirement = 'road' | 'power' | 'demand';

/** What a zone tile has of the things it needs to grow. */
export interface ZoneChecklist {
  /** A road within `roadAccessRadius` tiles. */
  road: boolean;
  power: boolean;
  /** Positive demand for this zone type. */
  demand: boolean;
}

export function zoneChecklist(
  state: Readonly<SimState>,
  tile: Readonly<Tile>,
): ZoneChecklist | null {
  if (tile.kind !== 'zone' || tile.zone === null) return null;
  return { road: tile.roadAccess, power: tile.powered, demand: inDemand(state.demand[tile.zone]) };
}

/**
 * The first thing holding a zone tile back, in the order the player should fix
 * them: road access, then power, then (for empty lots only) demand. Existing
 * buildings do not need demand to stay, so it is never reported for them.
 * Returns null when nothing is missing, or for tiles that are not zones.
 */
export function missingRequirement(
  state: Readonly<SimState>,
  tile: Readonly<Tile>,
): Requirement | null {
  const checklist = zoneChecklist(state, tile);
  if (!checklist) return null;
  if (!checklist.road) return 'road';
  if (!checklist.power) return 'power';
  if (tile.stage === 'empty' && !checklist.demand) return 'demand';
  return null;
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
      if (inDemand(demand) && chance(state, z.growthChance * demand)) {
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
