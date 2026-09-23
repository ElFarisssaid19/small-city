import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { createState } from '../src/sim/state';
import type { SimState, Tile, ZoneType } from '../src/sim/types';
import { capacityOf, updateZones } from '../src/sim/zones';
import { at, days, newSim, run, tileAt } from './helpers';

/** A one-tile world whose only lot has the given service and demand. */
function lot(zone: ZoneType, patch: Partial<Tile>, demand = 1): { state: SimState; tile: Tile } {
  const state = createState({ seed: 7, width: 1, height: 1 });
  const tile = Object.assign(state.tiles[0], {
    kind: 'zone',
    zone,
    powered: true,
    roadAccess: true,
    ...patch,
  });
  state.demand[zone] = demand;
  return { state, tile };
}

function stepUntil(state: SimState, done: () => boolean, limit = 1000): number {
  for (let day = 1; day <= limit; day++) {
    updateZones(state);
    if (done()) return day;
  }
  throw new Error('condition never reached');
}

describe('zone growth', () => {
  it('goes from empty lot through construction to level 1 when serviced and in demand', () => {
    const { state, tile } = lot('residential', {});
    stepUntil(state, () => tile.stage === 'construction');
    expect(tile.progress).toBe(CONFIG.zones.constructionDays);
    expect(tile.residents).toBe(0);

    for (let d = 1; d < CONFIG.zones.constructionDays; d++) updateZones(state);
    expect(tile.stage).toBe('construction');
    updateZones(state);
    expect(tile.stage).toBe('developed');
    expect(tile.level).toBe(1);
    expect(tile.residents).toBe(capacityOf('residential', 1));
  });

  it('upgrades to the top level under strong demand and not beyond', () => {
    const { state, tile } = lot('commercial', { stage: 'developed', level: 1 });
    stepUntil(state, () => tile.level === CONFIG.zones.maxLevel);
    for (let d = 0; d < 200; d++) updateZones(state);
    expect(tile.level).toBe(CONFIG.zones.maxLevel);
  });

  it('declines under strongly negative demand but keeps at least level 1', () => {
    const { state, tile } = lot('industrial', { stage: 'developed', level: 3 }, -1);
    stepUntil(state, () => tile.level === 1);
    for (let d = 0; d < 300; d++) updateZones(state);
    expect(tile.level).toBe(1);
    expect(tile.stage).toBe('developed');
  });

  it('does not start building without demand', () => {
    const { state, tile } = lot('residential', {}, -0.2);
    for (let d = 0; d < 300; d++) updateZones(state);
    expect(tile.stage).toBe('empty');
  });

  it('never develops without power or without road access', () => {
    for (const patch of [{ powered: false }, { roadAccess: false }]) {
      const { state, tile } = lot('residential', patch);
      for (let d = 0; d < 300; d++) updateZones(state);
      expect(tile.stage).toBe('empty');
      expect(tile.neglect).toBe(0);
    }
  });

  it('develops a real town once it has roads and power', () => {
    const sim = newSim({ seed: 3 });
    run(sim, { type: 'placeRoad', from: at(0, 5), to: at(15, 5) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(0, 3), to: at(5, 4) });
    run(sim, { type: 'placeZone', zone: 'industrial', from: at(8, 6), to: at(13, 7) });
    days(sim, 60);
    expect(sim.state.stats.population).toBe(0); // no power yet

    run(sim, { type: 'placePowerPlant', at: at(14, 6) });
    // The plant touches the industry; a line across the road links the homes.
    run(sim, { type: 'placePowerLine', from: at(6, 4), to: at(7, 6) });
    expect(tileAt(sim.state, 0, 3).powered).toBe(true);
    days(sim, 90);
    expect(sim.state.stats.population).toBeGreaterThan(0);
    expect(sim.state.stats.jobs).toBeGreaterThan(0);
  });
});

describe('abandonment', () => {
  const limit = CONFIG.zones.abandonDays;

  it(`abandons a building after ${limit} days without power`, () => {
    const { state, tile } = lot('residential', { stage: 'developed', level: 2, powered: false });
    for (let d = 1; d < limit; d++) updateZones(state);
    expect(tile.stage).toBe('developed');
    expect(tile.neglect).toBe(limit - 1);
    expect(tile.residents).toBe(capacityOf('residential', 2));

    const report = updateZones(state);
    expect(report.abandoned).toBe(1);
    expect(tile.stage).toBe('abandoned');
    expect(tile.residents).toBe(0);
  });

  it('abandons a building that loses its road', () => {
    const { state, tile } = lot('commercial', { stage: 'developed', level: 1, roadAccess: false });
    for (let d = 0; d < limit; d++) updateZones(state);
    expect(tile.stage).toBe('abandoned');
  });

  it('forgets neglect as soon as service returns', () => {
    const { state, tile } = lot('residential', { stage: 'developed', level: 1, powered: false });
    for (let d = 1; d < limit; d++) updateZones(state);
    tile.powered = true;
    updateZones(state);
    expect(tile.neglect).toBe(0);
    tile.powered = false;
    for (let d = 1; d < limit; d++) updateZones(state);
    expect(tile.stage).toBe('developed');
  });

  it('cancels a stalled construction site back to an empty lot', () => {
    const { state, tile } = lot('industrial', {
      stage: 'construction',
      progress: 2,
      powered: false,
    });
    for (let d = 0; d < limit; d++) updateZones(state);
    expect(tile.stage).toBe('empty');
    expect(tile.progress).toBe(0);
  });

  it('clears abandoned buildings once service returns so the lot can regrow', () => {
    const { state, tile } = lot('residential', { stage: 'abandoned', level: 2 });
    stepUntil(state, () => tile.stage !== 'abandoned');
    expect(tile.stage).toBe('empty');
    expect(tile.level).toBe(0);
  });

  it('abandons buildings in a running city when its only plant is bulldozed', () => {
    const sim = newSim({ seed: 5 });
    run(sim, { type: 'placeRoad', from: at(0, 5), to: at(15, 5) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(0, 3), to: at(7, 4) });
    run(sim, { type: 'placeZone', zone: 'commercial', from: at(8, 3), to: at(11, 4) });
    run(sim, { type: 'placePowerPlant', at: at(12, 3) });
    days(sim, 90);
    const developed = sim.state.tiles.filter((t) => t.stage === 'developed').length;
    expect(developed).toBeGreaterThan(0);

    run(sim, { type: 'bulldoze', from: at(12, 3), to: at(12, 3) });
    days(sim, limit);
    expect(sim.state.tiles.filter((t) => t.stage === 'developed')).toHaveLength(0);
    expect(sim.state.tiles.filter((t) => t.stage === 'abandoned').length).toBeGreaterThan(0);
    expect(sim.state.stats.population).toBe(0);
  });
});
