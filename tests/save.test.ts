import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { SaveError, deserialize, serialize } from '../src/sim/save';
import { Simulation } from '../src/sim/simulation';
import type { SimState } from '../src/sim/types';
import { at, days, newSim, run } from './helpers';

/** A small but lively city: roads, zones, a plant, a crossing, and time passed. */
function grownCity(): Simulation {
  const sim = newSim({ seed: 11 });
  run(sim, { type: 'placeRoad', from: at(0, 5), to: at(15, 5) });
  run(sim, { type: 'placeZone', zone: 'residential', from: at(0, 3), to: at(7, 4) });
  run(sim, { type: 'placeZone', zone: 'commercial', from: at(8, 3), to: at(11, 4) });
  run(sim, { type: 'placeZone', zone: 'industrial', from: at(0, 6), to: at(9, 7) });
  run(sim, { type: 'placePowerPlant', at: at(12, 3) });
  run(sim, { type: 'placePowerLine', from: at(10, 5), to: at(10, 6) });
  run(sim, { type: 'setTaxRate', rate: 11 });
  days(sim, 75);
  return sim;
}

/** State without the view-cache counter, which is not part of the game. */
function comparable(state: SimState): Omit<SimState, 'revision'> {
  const { revision, ...rest } = state;
  return rest;
}

function mutate(
  json: string,
  change: (file: { version: number; state: Record<string, unknown> }) => void,
) {
  const file = JSON.parse(json) as { version: number; state: Record<string, unknown> };
  change(file);
  return JSON.stringify(file);
}

describe('save and load', () => {
  it('round-trips the whole simulation state', () => {
    const sim = grownCity();
    expect(sim.state.stats.population).toBeGreaterThan(0);
    const loaded = new Simulation(deserialize(serialize(sim.state)));
    expect(comparable(loaded.state)).toEqual(comparable(sim.state));
  });

  it('continues exactly as the original would, thanks to the saved RNG state', () => {
    const original = grownCity();
    const copy = new Simulation(deserialize(serialize(original.state)));
    days(original, 120);
    days(copy, 120);
    expect(comparable(copy.state)).toEqual(comparable(original.state));
  });

  it('tags saves with the current format version', () => {
    const file = JSON.parse(serialize(newSim().state)) as { version: number };
    expect(file.version).toBe(CONFIG.save.version);
  });

  it('rejects data that is not a save', () => {
    expect(() => deserialize('not json')).toThrow(SaveError);
    expect(() => deserialize('{}')).toThrow(/no version/);
    expect(() => deserialize('{"version":1}')).toThrow(/no city/);
  });

  it('rejects saves from a newer version', () => {
    const json = mutate(serialize(newSim().state), (file) => {
      file.version = CONFIG.save.version + 1;
    });
    expect(() => deserialize(json)).toThrow(/newer version/);
  });

  it('rejects inconsistent maps and unknown tile types', () => {
    const json = serialize(grownCity().state);
    const shortMap = mutate(json, (file) => {
      (file.state.tiles as unknown[]).pop();
    });
    expect(() => deserialize(shortMap)).toThrow(/does not match its size/);

    const badKind = mutate(json, (file) => {
      (file.state.tiles as { kind: string }[])[0].kind = 'castle';
    });
    expect(() => deserialize(badKind)).toThrow(/"kind" is not recognised/);

    const badPlant = mutate(json, (file) => {
      const tiles = file.state.tiles as { kind: string; anchor: number }[];
      const plant = tiles.find((t) => t.kind === 'powerPlant');
      if (plant) plant.anchor = 0;
    });
    expect(() => deserialize(badPlant)).toThrow(/broken power plant/);

    const badFunds = mutate(json, (file) => {
      file.state.funds = 'lots';
    });
    expect(() => deserialize(badFunds)).toThrow(/"funds" is not a number/);
  });
});

/** Turns a current save back into the version 1 format: no v2 fields at all. */
function asVersion1(json: string): string {
  const file = JSON.parse(json) as { version: number; state: Record<string, unknown> };
  const { disasters: _d, environmentReady: _e, ...state } = file.state;
  const tiles = (state.tiles as Record<string, unknown>[]).map((tile) => {
    const {
      service: _s,
      fire: _f,
      pollution: _p,
      crime: _c,
      landValue: _l,
      coverage: _v,
      ...rest
    } = tile;
    return rest;
  });
  const { taxes, upkeep } = state.lastBudget as { taxes: number; upkeep: number };
  return JSON.stringify({ version: 1, state: { ...state, tiles, lastBudget: { taxes, upkeep } } });
}

describe('save migration', () => {
  it('upgrades version 1 saves with defaults instead of rejecting them', () => {
    const v1 = asVersion1(serialize(grownCity().state));
    expect(JSON.parse(v1)).not.toHaveProperty('state.disasters');

    const state = deserialize(v1);
    expect(state.disasters).toBe(true);
    expect(state.environmentReady).toBe(false);
    expect(state.lastBudget.income).toEqual({ residential: 0, commercial: 0, industrial: 0 });
    expect(state.tiles.every((t) => t.service === null && t.fire === 0 && t.landValue === 0)).toBe(
      true,
    );

    // The environment is computed as soon as the game wraps the migrated state.
    const sim = new Simulation(state);
    expect(sim.state.environmentReady).toBe(true);
    expect(sim.state.tiles.some((t) => t.pollution > 0)).toBe(true);
    expect(sim.state.tiles.every((t) => t.landValue > 0 || t.pollution > 0 || t.crime > 0)).toBe(
      true,
    );
    days(sim, 40);
  });

  it('writes the current version and requires every v2 field', () => {
    const json = serialize(grownCity().state);
    expect((JSON.parse(json) as { version: number }).version).toBe(2);
    const missing = mutate(json, (file) => {
      delete (file.state.tiles as Record<string, unknown>[])[0].landValue;
    });
    expect(() => deserialize(missing)).toThrow(/"landValue" is not a number/);
    const noSetting = mutate(json, (file) => {
      delete file.state.disasters;
    });
    expect(() => deserialize(noSetting)).toThrow(/"disasters"/);
  });

  it('round-trips services, fires and settings and continues exactly', () => {
    const sim = grownCity();
    run(sim, { type: 'placeService', service: 'park', at: at(14, 12) });
    run(sim, { type: 'placeService', service: 'police', at: at(13, 6) });
    run(sim, { type: 'setDisasters', enabled: false });
    const burning = sim.state.tiles.find((t) => t.stage === 'developed');
    if (burning) burning.fire = 2;

    const copy = new Simulation(deserialize(serialize(sim.state)));
    expect(comparable(copy.state)).toEqual(comparable(sim.state));
    days(sim, 60);
    days(copy, 60);
    expect(comparable(copy.state)).toEqual(comparable(sim.state));
  });
});
