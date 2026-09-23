import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { updatePower } from '../src/sim/power';
import { createState } from '../src/sim/state';
import type { SimState } from '../src/sim/types';
import { at, newSim, run, tileAt } from './helpers';

describe('power flow', () => {
  it('spreads through power lines and connected zones', () => {
    const sim = newSim();
    run(sim, { type: 'placePowerPlant', at: at(0, 0) });
    run(sim, { type: 'placePowerLine', from: at(2, 0), to: at(6, 0) });
    // A block of zones touching the end of the line, and a zone touching that block.
    run(sim, { type: 'placeZone', zone: 'residential', from: at(7, 0), to: at(9, 2) });
    run(sim, { type: 'placeZone', zone: 'commercial', from: at(9, 3), to: at(9, 3) });
    const s = sim.state;

    expect(tileAt(s, 4, 0).powered).toBe(true);
    expect(tileAt(s, 7, 0).powered).toBe(true);
    expect(tileAt(s, 8, 2).powered).toBe(true);
    expect(tileAt(s, 9, 3).powered).toBe(true);
    expect(s.stats.powerSupply).toBe(CONFIG.power.plantCapacity);
    expect(s.stats.unpoweredZones).toBe(0);
  });

  it('does not cross empty land or roads', () => {
    const sim = newSim();
    run(sim, { type: 'placePowerPlant', at: at(0, 0) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(2, 0), to: at(2, 0) });
    // One tile of empty land between the next zone and the first.
    run(sim, { type: 'placeZone', zone: 'residential', from: at(4, 0), to: at(4, 0) });
    // A road between the plant and another zone.
    run(sim, { type: 'placeRoad', from: at(0, 2), to: at(1, 2) });
    run(sim, { type: 'placeZone', zone: 'industrial', from: at(0, 3), to: at(1, 3) });
    const s = sim.state;

    expect(tileAt(s, 2, 0).powered).toBe(true);
    expect(tileAt(s, 4, 0).powered).toBe(false);
    expect(tileAt(s, 0, 2).powered).toBe(false);
    expect(tileAt(s, 0, 3).powered).toBe(false);
    expect(s.stats.unpoweredZones).toBe(3);
  });

  it('crosses a road where a power line is built over it', () => {
    const sim = newSim();
    run(sim, { type: 'placePowerPlant', at: at(0, 0) });
    run(sim, { type: 'placeRoad', from: at(0, 2), to: at(8, 2) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(0, 3), to: at(0, 3) });
    expect(tileAt(sim.state, 0, 3).powered).toBe(false);

    run(sim, { type: 'placePowerLine', from: at(0, 2), to: at(0, 2) });
    const crossing = tileAt(sim.state, 0, 2);
    expect(crossing.kind).toBe('road');
    expect(crossing.hasLine).toBe(true);
    expect(tileAt(sim.state, 0, 3).powered).toBe(true);
  });

  it('keeps separate networks separate and loses power when the plant is removed', () => {
    const sim = newSim();
    run(sim, { type: 'placePowerPlant', at: at(0, 0) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(2, 0), to: at(3, 0) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(10, 10), to: at(11, 10) });
    expect(tileAt(sim.state, 3, 0).powered).toBe(true);
    expect(tileAt(sim.state, 10, 10).powered).toBe(false);

    run(sim, { type: 'bulldoze', from: at(1, 1), to: at(1, 1) });
    expect(tileAt(sim.state, 0, 0).kind).toBe('empty');
    expect(tileAt(sim.state, 3, 0).powered).toBe(false);
    expect(sim.state.stats.powerSupply).toBe(0);
  });

  it('counts each multi-tile plant once and adds capacity per plant', () => {
    const sim = newSim();
    run(sim, { type: 'placePowerPlant', at: at(0, 0) });
    run(sim, { type: 'placePowerPlant', at: at(2, 0) });
    expect(sim.state.stats.powerSupply).toBe(2 * CONFIG.power.plantCapacity);
  });

  it('serves the nearest consumers first when demand exceeds capacity', () => {
    // A hand-built network: plant at the west end, then a row of level-3 buildings.
    const state: SimState = createState({ seed: 1, width: 80, height: 3 });
    const size = CONFIG.power.plantSize;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        Object.assign(state.tiles[y * state.width + x], { kind: 'powerPlant', anchor: 0 });
      }
    }
    const draw = CONFIG.power.zoneConsumption[3];
    const affordable = Math.floor(CONFIG.power.plantCapacity / draw);
    const buildings = affordable + 5;
    for (let x = size; x < size + buildings; x++) {
      Object.assign(state.tiles[x], {
        kind: 'zone',
        zone: 'commercial',
        stage: 'developed',
        level: 3,
      });
    }

    const report = updatePower(state);
    const powered = state.tiles.slice(size, size + buildings).map((t) => t.powered);
    expect(powered.slice(0, affordable).every(Boolean)).toBe(true);
    expect(powered.slice(affordable).some(Boolean)).toBe(false);
    expect(report.demand).toBe(buildings * draw);
    expect(report.unpoweredZones).toBe(buildings - affordable);
  });
});
