import { CONFIG } from './config';
import { SERVICE_TYPES } from './types';
import type { Coverage, SimState, Tile } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Adds `amount`, fading linearly with Manhattan distance, to every tile within
 * `radius` of (x, y): the full amount at the source, nothing just past the radius.
 * The work is bounded by the radius, never by the map size.
 */
export function spread(
  state: Pick<SimState, 'width' | 'height'>,
  field: Float32Array,
  x: number,
  y: number,
  amount: number,
  radius: number,
): void {
  const { width, height } = state;
  for (let dy = -radius; dy <= radius; dy++) {
    const ty = y + dy;
    if (ty < 0 || ty >= height) continue;
    const reach = radius - Math.abs(dy);
    for (let dx = -reach; dx <= reach; dx++) {
      const tx = x + dx;
      if (tx < 0 || tx >= width) continue;
      const distance = Math.abs(dx) + Math.abs(dy);
      field[ty * width + tx] += amount * (1 - distance / (radius + 1));
    }
  }
}

/** Pollution a tile gives off: industry by level, and every tile of a power plant. */
export function emission(tile: Readonly<Tile>): number {
  const { pollution } = CONFIG.environment;
  if (tile.kind === 'powerPlant') return pollution.powerPlant;
  if (tile.kind !== 'zone' || tile.zone !== 'industrial' || tile.stage !== 'developed') return 0;
  return pollution.industrial[tile.level] ?? 0;
}

/** People whose presence breeds crime: residents and shop workers. */
export function crowd(tile: Readonly<Tile>): number {
  if (tile.kind !== 'zone') return 0;
  if (tile.zone === 'residential') return tile.residents;
  return tile.zone === 'commercial' ? tile.workers : 0;
}

/** Land value 0–100: a base, plus each covering service, minus pollution and crime. */
export function landValueOf(coverage: Coverage, pollution: number, crime: number): number {
  const { base, bonus, pollutionWeight, crimeWeight } = CONFIG.environment.landValue;
  let value = base;
  for (const service of SERVICE_TYPES) if (coverage[service]) value += bonus[service];
  value -= pollution * pollutionWeight + crime * crimeWeight;
  return Math.round(clamp(value, 0, 100));
}

/**
 * Recomputes pollution, crime and land value for every tile. Each source only
 * touches the tiles within its radius, so the cost is O(tiles + sources × r²).
 * The simulation runs this once a month and after each command.
 */
export function updateEnvironment(state: SimState): void {
  const { tiles, width } = state;
  const { pollution: p, crime: c } = CONFIG.environment;
  const pollution = new Float32Array(tiles.length);
  const crowding = new Float32Array(tiles.length);

  tiles.forEach((tile, i) => {
    const x = i % width;
    const y = (i - x) / width;
    const emitted = emission(tile);
    if (emitted > 0) spread(state, pollution, x, y, emitted, p.radius);
    const people = crowd(tile);
    if (people > 0) spread(state, crowding, x, y, people, c.radius);
  });

  tiles.forEach((tile, i) => {
    tile.pollution = Math.round(clamp(pollution[i], 0, 100));
    const crime = clamp(crowding[i] * c.perPerson, 0, 100);
    tile.crime = Math.round(tile.coverage.police ? crime * c.policeFactor : crime);
    tile.landValue = landValueOf(tile.coverage, tile.pollution, tile.crime);
  });
  state.environmentReady = true;
}
