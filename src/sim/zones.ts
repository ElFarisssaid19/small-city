import { buildingTiles } from './buildings';
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
  /** Tiles where a fire broke out today. */
  firesStarted: number[];
  /** Tiles whose building burned down today. */
  burnedDown: number[];
  /** Fires put out today by a fire station's coverage. */
  extinguished: number;
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
 * Service buildings (reported on their anchor tile) need road and power, parks
 * nothing. Returns null when nothing is missing, or for other tiles.
 */
export function missingRequirement(
  state: Readonly<SimState>,
  tile: Readonly<Tile>,
): Requirement | null {
  if (tile.kind === 'service') {
    if (tile.service === 'park' || state.tiles[tile.anchor] !== tile) return null;
    const footprint = buildingTiles(state, tile.anchor).map((i) => state.tiles[i]);
    if (!footprint.some((t) => t.roadAccess)) return 'road';
    return footprint.some((t) => t.powered) ? null : 'power';
  }
  const checklist = zoneChecklist(state, tile);
  if (!checklist) return null;
  if (!checklist.road) return 'road';
  if (!checklist.power) return 'power';
  if (tile.stage === 'empty' && !checklist.demand) return 'demand';
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Multiplier on a zone's growth and upgrade chances from its surroundings:
 * homes want high land value and clean air, industry shuns crime, shops only
 * follow demand (land value caps their level instead).
 */
export function appeal(tile: Readonly<Tile>): number {
  const e = CONFIG.zones.effects;
  switch (tile.zone) {
    case 'residential': {
      const base = clamp(
        e.appealBase + tile.landValue / e.appealLandValue,
        e.appealMin,
        e.appealMax,
      );
      return base * (1 - tile.pollution / 100);
    }
    case 'industrial':
      return Math.max(0, 1 - tile.crime / e.industrialCrimeTolerance);
    default:
      return 1;
  }
}

/** The highest level a zone tile can reach where it stands, and what would raise it. */
export interface LevelLimit {
  cap: number;
  /** What the next level needs: a school nearby, more land value, or nothing. */
  needs: 'school' | 'landValue' | null;
  /** For 'landValue': the land value the next level needs. */
  landValue: number;
}

/** Homes above level 2 need a school nearby; shops need enough land value for each level. */
export function levelLimit(tile: Readonly<Tile>): LevelLimit {
  const e = CONFIG.zones.effects;
  const max = CONFIG.zones.maxLevel;
  if (tile.zone === 'residential' && !tile.coverage.school) {
    return { cap: e.schoolFreeMaxLevel, needs: 'school', landValue: 0 };
  }
  if (tile.zone === 'commercial') {
    let cap = 1;
    while (cap < max && tile.landValue >= e.commercialLandValue[cap + 1]) cap++;
    if (cap === max) return { cap, needs: null, landValue: 0 };
    return { cap, needs: 'landValue', landValue: e.commercialLandValue[cap + 1] };
  }
  return { cap: max, needs: null, landValue: 0 };
}

/** Too much pollution (homes and shops only) or crime drives a building into decline. */
export function distressed(tile: Readonly<Tile>): boolean {
  const e = CONFIG.zones.effects;
  if (tile.crime >= e.distressCrime) return true;
  return tile.zone !== 'industrial' && tile.pollution >= e.distressPollution;
}

/**
 * Advances every zone lot by one day: fires, growth, construction, upgrades,
 * decline and abandonment. A burning building is evacuated and does not change
 * until the fire is out.
 */
export function updateZones(state: SimState): ZoneReport {
  const report: ZoneReport = {
    started: 0,
    completed: 0,
    abandoned: 0,
    firesStarted: [],
    burnedDown: [],
    extinguished: 0,
  };
  state.tiles.forEach((tile, i) => {
    if (tile.kind !== 'zone' || tile.zone === null) return;
    if (tile.fire > 0) burn(tile, i, report);
    else if (catchesFire(state, tile)) {
      tile.fire = CONFIG.disasters.burnDays;
      report.firesStarted.push(i);
    } else stepZone(state, tile, state.demand[tile.zone], report);
    tile.residents =
      tile.zone === 'residential' && tile.stage === 'developed' && tile.fire === 0
        ? capacityOf('residential', tile.level)
        : 0;
  });
  return report;
}

/** Buildings outside fire coverage can catch fire, but only while disasters are on. */
function catchesFire(state: SimState, tile: Tile): boolean {
  if (!state.disasters || tile.stage !== 'developed' || tile.coverage.fire) return false;
  return chance(state, CONFIG.disasters.fireChance);
}

/** A fire burns down for a few days, then the lot is empty, unless a fire station reaches it. */
function burn(tile: Tile, index: number, report: ZoneReport): void {
  if (tile.coverage.fire) {
    tile.fire = 0;
    report.extinguished++;
    return;
  }
  tile.fire--;
  if (tile.fire > 0) return;
  tile.stage = 'empty';
  tile.level = 0;
  tile.neglect = 0;
  report.burnedDown.push(index);
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
      if (inDemand(demand) && chance(state, z.growthChance * demand * appeal(tile))) {
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
    case 'developed': {
      const { cap } = levelLimit(tile);
      if (distressed(tile)) {
        // Pollution or crime: lose levels, then eventually move out.
        if (tile.level > 1) {
          if (chance(state, z.declineChance)) tile.level--;
        } else if (chance(state, z.effects.distressAbandonChance)) {
          tile.stage = 'abandoned';
          report.abandoned++;
        }
      } else if (tile.level > cap) {
        if (chance(state, z.declineChance)) tile.level--;
      } else if (
        tile.level < cap &&
        demand >= z.upgradeMinDemand &&
        chance(state, z.upgradeChance * demand * appeal(tile))
      ) {
        tile.level++;
      } else if (tile.level > 1 && demand <= z.declineDemand && chance(state, z.declineChance)) {
        tile.level--;
      }
      break;
    }
    case 'abandoned':
      if (chance(state, z.recoverChance)) {
        tile.stage = 'empty';
        tile.level = 0;
      }
      break;
  }
}
