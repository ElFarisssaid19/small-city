import { CONFIG } from './config';
import { emptyStats, emptyTile } from './state';
import { ZONE_TYPES } from './types';
import type { Demand, MonthlyBudget, SimState, Tile, TileKind, ZoneStage, ZoneType } from './types';

export class SaveError extends Error {
  override name = 'SaveError';
}

interface SaveFile {
  version: number;
  state: unknown;
}

/**
 * Upgrades a save's `state` from version N to N + 1, keyed by N.
 * Add an entry here whenever `CONFIG.save.version` is bumped.
 */
const MIGRATIONS: Record<number, (state: unknown) => unknown> = {};

const KINDS: readonly TileKind[] = ['empty', 'road', 'powerLine', 'powerPlant', 'zone'];
const STAGES: readonly ZoneStage[] = ['empty', 'construction', 'developed', 'abandoned'];
const MAX_MAP_SIZE = 256;

/** The whole simulation as JSON, tagged with the save format version. */
export function serialize(state: Readonly<SimState>): string {
  const file: SaveFile = { version: CONFIG.save.version, state };
  return JSON.stringify(file);
}

/** Parses, migrates and validates a save. Throws `SaveError` when it cannot be used. */
export function deserialize(json: string): SimState {
  let file: unknown;
  try {
    file = JSON.parse(json);
  } catch {
    throw new SaveError('The save is not valid JSON.');
  }
  if (!isRecord(file) || typeof file.version !== 'number' || !Number.isInteger(file.version)) {
    throw new SaveError('The save has no version.');
  }
  if (file.version > CONFIG.save.version) {
    throw new SaveError('The save comes from a newer version of Small City.');
  }
  let state = file.state;
  for (let version = file.version; version < CONFIG.save.version; version++) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new SaveError(`No migration from save version ${version}.`);
    state = migrate(state);
  }
  return readState(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SaveError(`The save's "${key}" is not a number.`);
  }
  return value;
}

function readInteger(
  source: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number {
  const value = readNumber(source, key);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new SaveError(`The save's "${key}" is out of range.`);
  }
  return value;
}

function readOneOf<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = source[key];
  if (!allowed.includes(value as T)) throw new SaveError(`The save's "${key}" is not recognised.`);
  return value as T;
}

function readTile(raw: unknown, count: number): Tile {
  if (!isRecord(raw)) throw new SaveError('The save contains a broken tile.');
  const tile = emptyTile();
  tile.kind = readOneOf(raw, 'kind', KINDS);
  tile.hasLine = raw.hasLine === true;
  tile.zone = raw.zone === null ? null : readOneOf<ZoneType>(raw, 'zone', ZONE_TYPES);
  tile.stage = readOneOf(raw, 'stage', STAGES);
  tile.level = readInteger(raw, 'level', 0, CONFIG.zones.maxLevel);
  tile.progress = readInteger(raw, 'progress', 0, Number.MAX_SAFE_INTEGER);
  tile.neglect = readInteger(raw, 'neglect', 0, Number.MAX_SAFE_INTEGER);
  tile.residents = readInteger(raw, 'residents', 0, Number.MAX_SAFE_INTEGER);
  tile.anchor = readInteger(raw, 'anchor', -1, count - 1);
  if (tile.kind === 'zone' && tile.zone === null) {
    throw new SaveError('A zone tile has no zone type.');
  }
  return tile;
}

function readState(raw: unknown): SimState {
  if (!isRecord(raw)) throw new SaveError('The save has no city in it.');
  const width = readInteger(raw, 'width', 1, MAX_MAP_SIZE);
  const height = readInteger(raw, 'height', 1, MAX_MAP_SIZE);
  if (!Array.isArray(raw.tiles) || raw.tiles.length !== width * height) {
    throw new SaveError("The save's map does not match its size.");
  }
  const tiles = raw.tiles.map((tile) => readTile(tile, width * height));
  for (const tile of tiles) {
    if (tile.kind !== 'powerPlant') continue;
    // Every plant tile must point at an anchor tile that points at itself.
    const anchor = tile.anchor >= 0 ? tiles[tile.anchor] : undefined;
    if (!anchor || anchor.kind !== 'powerPlant' || tiles[anchor.anchor] !== anchor) {
      throw new SaveError('The save contains a broken power plant.');
    }
  }

  const demandRaw = isRecord(raw.demand) ? raw.demand : {};
  const demand = Object.fromEntries(
    ZONE_TYPES.map((zone) => [zone, Math.min(Math.max(readNumber(demandRaw, zone), -1), 1)]),
  ) as Demand;
  const budgetRaw = isRecord(raw.lastBudget) ? raw.lastBudget : {};
  const lastBudget: MonthlyBudget = {
    taxes: readNumber(budgetRaw, 'taxes'),
    upkeep: readNumber(budgetRaw, 'upkeep'),
  };

  return {
    width,
    height,
    seed: readNumber(raw, 'seed'),
    rng: readInteger(raw, 'rng', 0, 0xffffffff),
    day: readInteger(raw, 'day', 0, Number.MAX_SAFE_INTEGER),
    funds: readNumber(raw, 'funds'),
    taxRate: readInteger(raw, 'taxRate', CONFIG.economy.taxRate.min, CONFIG.economy.taxRate.max),
    lastBudget,
    tiles,
    demand,
    // Derived values are recomputed by the Simulation when it wraps the state.
    stats: emptyStats(),
    revision: 0,
  };
}
