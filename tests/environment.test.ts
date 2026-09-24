import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { landValueOf, updateEnvironment } from '../src/sim/environment';
import { createState, noCoverage } from '../src/sim/state';
import type { SimState, Tile } from '../src/sim/types';

function world(size = 21): SimState {
  return createState({ seed: 1, width: size, height: size });
}

function place(state: SimState, x: number, y: number, patch: Partial<Tile>): Tile {
  const i = y * state.width + x;
  return Object.assign(state.tiles[i], { anchor: i, ...patch });
}

const at = (state: SimState, x: number, y: number) => state.tiles[y * state.width + x];

const factory = { kind: 'zone', zone: 'industrial', stage: 'developed', level: 3 } as const;

describe('pollution', () => {
  const { radius, industrial, powerPlant, parkCleanup } = CONFIG.environment.pollution;
  const emitted = industrial[3];

  it('fades linearly with Manhattan distance and stops past the radius', () => {
    const state = world();
    place(state, 10, 10, factory);
    updateEnvironment(state);
    expect(at(state, 10, 10).pollution).toBe(emitted);
    for (let d = 1; d <= radius; d++) {
      expect(at(state, 10 + d, 10).pollution).toBe(Math.round(emitted * (1 - d / (radius + 1))));
    }
    expect(at(state, 10 + radius + 1, 10).pollution).toBe(0);
    // Diagonal steps count twice: (2, 1) away is as polluted as 3 along an axis.
    expect(at(state, 12, 11).pollution).toBe(at(state, 13, 10).pollution);
  });

  it('adds up from many sources and tops out at 100', () => {
    const state = world();
    for (let y = 7; y <= 13; y++) for (let x = 7; x <= 13; x++) place(state, x, y, factory);
    updateEnvironment(state);
    expect(at(state, 10, 10).pollution).toBe(100);
  });

  it('comes from power plants and from industry only when developed', () => {
    const state = world();
    place(state, 3, 3, { kind: 'powerPlant' });
    place(state, 15, 15, { ...factory, stage: 'construction', level: 0 });
    updateEnvironment(state);
    expect(at(state, 3, 3).pollution).toBe(powerPlant);
    expect(at(state, 15, 15).pollution).toBe(0);
  });

  it('is soaked up around parks', () => {
    const plain = world();
    const green = world();
    for (const state of [plain, green]) place(state, 10, 10, factory);
    place(green, 12, 10, { kind: 'service', service: 'park' });
    updateEnvironment(plain);
    updateEnvironment(green);
    expect(at(green, 12, 10).pollution).toBe(
      Math.max(0, at(plain, 12, 10).pollution - parkCleanup),
    );
    expect(at(green, 11, 10).pollution).toBeLessThan(at(plain, 11, 10).pollution);
    expect(at(green, 0, 0).pollution).toBe(at(plain, 0, 0).pollution);
  });
});

describe('crime', () => {
  const homes = (state: SimState, level: number, residents: number) => {
    for (let y = 8; y <= 12; y++) {
      for (let x = 8; x <= 12; x++) {
        place(state, x, y, {
          kind: 'zone',
          zone: 'residential',
          stage: 'developed',
          level,
          residents,
        });
      }
    }
  };

  it('rises with the number of residents nearby', () => {
    const sparse = world();
    const dense = world();
    homes(sparse, 1, 6);
    homes(dense, 3, 36);
    updateEnvironment(sparse);
    updateEnvironment(dense);
    expect(at(sparse, 10, 10).crime).toBeGreaterThan(0);
    expect(at(dense, 10, 10).crime).toBeGreaterThan(at(sparse, 10, 10).crime);
    expect(at(dense, 0, 0).crime).toBe(0);
  });

  it('is cut where police cover', () => {
    const unpoliced = world();
    const policed = world();
    homes(unpoliced, 3, 36);
    homes(policed, 3, 36);
    for (const tile of policed.tiles) tile.coverage.police = true;
    updateEnvironment(unpoliced);
    updateEnvironment(policed);
    const raw = at(unpoliced, 10, 10).crime;
    expect(at(policed, 10, 10).crime).toBeCloseTo(
      raw * CONFIG.environment.crime.policeFactor,
      -0.5,
    );
    expect(at(policed, 10, 10).crime).toBeLessThan(raw);
  });

  it('ignores factory workers', () => {
    const state = world();
    place(state, 10, 10, { ...factory, workers: 26 });
    updateEnvironment(state);
    expect(at(state, 10, 10).crime).toBe(0);
  });
});

describe('land value', () => {
  const { base, bonus, pollutionWeight, crimeWeight } = CONFIG.environment.landValue;

  it('is a base plus a bonus per covering service minus pollution and crime', () => {
    expect(landValueOf(noCoverage(), 0, 0)).toBe(base);
    expect(landValueOf({ ...noCoverage(), police: true, park: true }, 0, 0)).toBe(
      Math.min(100, base + bonus.police + bonus.park),
    );
    expect(landValueOf(noCoverage(), 20, 10)).toBe(
      Math.round(base - 20 * pollutionWeight - 10 * crimeWeight),
    );
  });

  it('stays within 0–100', () => {
    const all = { police: true, fire: true, school: true, park: true };
    expect(landValueOf(all, 0, 0)).toBeLessThanOrEqual(100);
    expect(landValueOf(noCoverage(), 100, 100)).toBe(0);
  });

  it('is stored on every tile from its own coverage, pollution and crime', () => {
    const state = world();
    place(state, 10, 10, factory);
    at(state, 11, 10).coverage.school = true;
    updateEnvironment(state);
    for (const tile of state.tiles) {
      expect(tile.landValue).toBe(landValueOf(tile.coverage, tile.pollution, tile.crime));
    }
    expect(state.environmentReady).toBe(true);
  });
});
