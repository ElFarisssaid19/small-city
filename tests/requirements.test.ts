import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { updatePower } from '../src/sim/power';
import { createState } from '../src/sim/state';
import type { SimState, Tile } from '../src/sim/types';
import { missingRequirement, zoneChecklist } from '../src/sim/zones';
import { at, newSim, run, tileAt } from './helpers';

/** A lone residential tile with the given service, stage and demand. */
function zone(patch: Partial<Tile>, demand = 0.5): { state: SimState; tile: Tile } {
  const state = createState({ seed: 1, width: 1, height: 1 });
  const tile = Object.assign(state.tiles[0], {
    kind: 'zone',
    zone: 'residential',
    roadAccess: true,
    powered: true,
    ...patch,
  });
  state.demand.residential = demand;
  return { state, tile };
}

describe('missing zone requirements', () => {
  it('reports nothing for tiles that are not zones', () => {
    const state = createState({ seed: 1, width: 1, height: 1 });
    expect(zoneChecklist(state, state.tiles[0])).toBeNull();
    expect(missingRequirement(state, state.tiles[0])).toBeNull();
  });

  it('reports nothing when an empty lot has road, power and demand', () => {
    const { state, tile } = zone({});
    expect(zoneChecklist(state, tile)).toEqual({ road: true, power: true, demand: true });
    expect(missingRequirement(state, tile)).toBeNull();
  });

  it('puts road access first, then power, then demand', () => {
    expect(missingRequirement(...pair(zone({ roadAccess: false, powered: false }, -1)))).toBe(
      'road',
    );
    expect(missingRequirement(...pair(zone({ powered: false }, -1)))).toBe('power');
    expect(missingRequirement(...pair(zone({}, -1)))).toBe('demand');
  });

  it('treats zero demand as no demand, matching the growth rule', () => {
    const { state, tile } = zone({}, 0);
    expect(zoneChecklist(state, tile)?.demand).toBe(false);
    expect(missingRequirement(state, tile)).toBe('demand');
  });

  it('never asks existing buildings for demand, only for road and power', () => {
    for (const stage of ['construction', 'developed', 'abandoned'] as const) {
      expect(missingRequirement(...pair(zone({ stage, level: 1 }, -1)))).toBeNull();
      expect(missingRequirement(...pair(zone({ stage, level: 1, powered: false }, -1)))).toBe(
        'power',
      );
      expect(missingRequirement(...pair(zone({ stage, level: 1, roadAccess: false })))).toBe(
        'road',
      );
    }
  });

  it('walks a real lot through each missing requirement as the city is built', () => {
    const sim = newSim();
    run(sim, { type: 'placeZone', zone: 'residential', from: at(5, 5), to: at(5, 5) });
    const lot = () => tileAt(sim.state, 5, 5);
    expect(missingRequirement(sim.state, lot())).toBe('road');

    run(sim, { type: 'placeRoad', from: at(0, 8), to: at(15, 8) }); // 3 tiles away
    expect(missingRequirement(sim.state, lot())).toBe('power');

    run(sim, { type: 'placePowerPlant', at: at(6, 4) }); // touches the lot
    sim.tick(); // demand starts at zero and rises on the first day
    expect(missingRequirement(sim.state, lot())).toBeNull();

    sim.state.demand.residential = -0.3;
    expect(missingRequirement(sim.state, lot())).toBe('demand');
  });

  it('reports no power for an empty lot on a network with no spare capacity', () => {
    // Plant, then a row of level-3 buildings that use all of it, then an empty lot.
    const state = createState({ seed: 1, width: 80, height: 2 });
    const size = CONFIG.power.plantSize;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        Object.assign(state.tiles[y * state.width + x], { kind: 'powerPlant', anchor: 0 });
      }
    }
    const buildings = CONFIG.power.plantCapacity / CONFIG.power.zoneConsumption[3];
    expect(Number.isInteger(buildings)).toBe(true);
    for (let x = size; x < size + buildings; x++) {
      Object.assign(state.tiles[x], {
        kind: 'zone',
        zone: 'commercial',
        stage: 'developed',
        level: 3,
      });
    }
    const lot = Object.assign(state.tiles[size + buildings], {
      kind: 'zone',
      zone: 'residential',
      roadAccess: true,
    });
    state.demand.residential = 1;

    updatePower(state);
    expect(state.tiles[size + buildings - 1].powered).toBe(true);
    expect(lot.powered).toBe(false);
    expect(missingRequirement(state, lot)).toBe('power');
  });
});

function pair({ state, tile }: { state: SimState; tile: Tile }): [SimState, Tile] {
  return [state, tile];
}
