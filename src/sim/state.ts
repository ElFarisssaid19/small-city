import { CONFIG } from './config';
import { seedRng } from './rng';
import type { CityStats, Coverage, SimState, Tile } from './types';

export function noCoverage(): Coverage {
  return { police: false, fire: false, school: false, park: false };
}

export function emptyTile(): Tile {
  return {
    kind: 'empty',
    hasLine: false,
    zone: null,
    stage: 'empty',
    level: 0,
    progress: 0,
    neglect: 0,
    residents: 0,
    employed: 0,
    workers: 0,
    anchor: -1,
    powered: false,
    roadAccess: false,
    coverage: noCoverage(),
    pollution: 0,
    crime: 0,
    landValue: 0,
  };
}

export function emptyStats(): CityStats {
  return {
    population: 0,
    workforce: 0,
    employed: 0,
    jobs: 0,
    commercialJobs: 0,
    industrialJobs: 0,
    powerSupply: 0,
    powerDemand: 0,
    unpoweredZones: 0,
    averageLandValue: 0,
    averageCrime: 0,
    averagePollution: 0,
  };
}

export interface NewGameOptions {
  seed: number;
  width?: number;
  height?: number;
}

export function createState({
  seed,
  width = CONFIG.map.width,
  height = CONFIG.map.height,
}: NewGameOptions): SimState {
  return {
    width,
    height,
    seed,
    rng: seedRng(seed),
    day: 0,
    funds: CONFIG.economy.startingFunds,
    taxRate: CONFIG.economy.taxRate.initial,
    lastBudget: { taxes: 0, upkeep: 0 },
    tiles: Array.from({ length: width * height }, emptyTile),
    environmentReady: false,
    demand: { residential: 0, commercial: 0, industrial: 0 },
    stats: emptyStats(),
    revision: 0,
  };
}
