export interface Point {
  x: number;
  y: number;
}

export type ZoneType = 'residential' | 'commercial' | 'industrial';

export const ZONE_TYPES: readonly ZoneType[] = ['residential', 'commercial', 'industrial'];

export type TileKind = 'empty' | 'road' | 'powerLine' | 'powerPlant' | 'zone';

/** Life cycle of a zone lot: empty lot → under construction → developed (level 1..3) ↔ abandoned. */
export type ZoneStage = 'empty' | 'construction' | 'developed' | 'abandoned';

/**
 * One map cell. Plain data only, so the whole map serializes to JSON as-is.
 * Zone fields are meaningful only when `kind === 'zone'`.
 */
export interface Tile {
  kind: TileKind;
  /** Carries a power line: always true for power lines, true for roads with a line crossing them. */
  hasLine: boolean;
  zone: ZoneType | null;
  stage: ZoneStage;
  /** Building level, 0 for lots and construction sites, 1..maxLevel once developed. */
  level: number;
  /** Construction days remaining. */
  progress: number;
  /** Consecutive days without power or road access. */
  neglect: number;
  /** Residential: people living here. */
  residents: number;
  /** Residential: residents with a job. */
  employed: number;
  /** Commercial / industrial: filled jobs. */
  workers: number;
  /** Power plant tiles: index of the plant's anchor (top-left) tile; -1 otherwise. */
  anchor: number;
  /** Derived each update: receives electricity. */
  powered: boolean;
  /** Derived each update: a road is within reach. */
  roadAccess: boolean;
}

/** Growth pressure per zone type, each in [-1, 1]. */
export type Demand = Record<ZoneType, number>;

export interface CityStats {
  population: number;
  workforce: number;
  employed: number;
  /** All jobs offered, commercial plus industrial. */
  jobs: number;
  commercialJobs: number;
  industrialJobs: number;
  powerSupply: number;
  powerDemand: number;
  unpoweredZones: number;
}

export interface SimState {
  width: number;
  height: number;
  seed: number;
  /** Seeded RNG state; see rng.ts. */
  rng: number;
  /** Days elapsed since the city was founded. */
  day: number;
  tiles: Tile[];
  demand: Demand;
  stats: CityStats;
  /** Bumped whenever anything visible changes, so views can cache work. */
  revision: number;
}
