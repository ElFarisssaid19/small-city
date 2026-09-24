export interface Point {
  x: number;
  y: number;
}

export type ZoneType = 'residential' | 'commercial' | 'industrial';

export const ZONE_TYPES: readonly ZoneType[] = ['residential', 'commercial', 'industrial'];

export type TileKind = 'empty' | 'road' | 'powerLine' | 'powerPlant' | 'zone' | 'service';

export type ServiceType = 'police' | 'fire' | 'school' | 'park';

export const SERVICE_TYPES: readonly ServiceType[] = ['police', 'fire', 'school', 'park'];

/** Which services reach a tile. */
export type Coverage = Record<ServiceType, boolean>;

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
  /** Service buildings: which service. */
  service: ServiceType | null;
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
  /** Power plant and service tiles: index of the building's anchor (top-left) tile; -1 otherwise. */
  anchor: number;
  /** Days a burning building has left before it is lost; 0 when not on fire. */
  fire: number;
  /** Derived each update: receives electricity. */
  powered: boolean;
  /** Derived each update: a road is within reach. */
  roadAccess: boolean;
  /** Derived each update: services whose radius reaches this tile. */
  coverage: Coverage;
  /** 0–100, recomputed monthly and after every command. */
  pollution: number;
  /** 0–100, recomputed monthly and after every command. */
  crime: number;
  /** 0–100, recomputed monthly and after every command. */
  landValue: number;
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
  /** Mean land value of zone tiles. */
  averageLandValue: number;
  /** Mean crime at homes and shops. */
  averageCrime: number;
  /** Mean pollution at homes. */
  averagePollution: number;
}

export type ExpenseKind = 'roads' | 'power' | ServiceType;

export const EXPENSE_KINDS: readonly ExpenseKind[] = [
  'roads',
  'power',
  'police',
  'fire',
  'school',
  'park',
];

/** Money collected and spent in a month, with where it came from and went. */
export interface MonthlyBudget {
  taxes: number;
  upkeep: number;
  /** Taxes by zone type. */
  income: Record<ZoneType, number>;
  /** Upkeep by kind: roads, power (plants and lines) and each service. */
  expenses: Record<ExpenseKind, number>;
}

export interface SimState {
  width: number;
  height: number;
  seed: number;
  /** Seeded RNG state; see rng.ts. */
  rng: number;
  /** Days elapsed since the city was founded. */
  day: number;
  /** Cash on hand; may go negative through upkeep, but nothing can be built then. */
  funds: number;
  /** Tax rate in percent. */
  taxRate: number;
  /** Whether random fires can break out. */
  disasters: boolean;
  /** Result of the most recent month end. */
  lastBudget: MonthlyBudget;
  tiles: Tile[];
  /**
   * Whether pollution, crime and land value have been computed for this map.
   * They are saved, so a loaded game continues exactly where it left off.
   */
  environmentReady: boolean;
  demand: Demand;
  stats: CityStats;
  /** Bumped whenever anything visible changes, so views can cache work. */
  revision: number;
}
