import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { monthlyTaxes, monthlyUpkeep, settleMonth } from '../src/sim/economy';
import { createState } from '../src/sim/state';
import { at, days, newSim, run, tileAt } from './helpers';

const { costs, upkeep, income, startingFunds } = CONFIG.economy;

describe('build costs', () => {
  it('starts with the configured funds', () => {
    expect(newSim().state.funds).toBe(startingFunds);
    expect(newSim().state.taxRate).toBe(CONFIG.economy.taxRate.initial);
  });

  it('charges per tile for roads, lines and zones, and per plant for power plants', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 0), to: at(9, 0) });
    expect(sim.state.funds).toBe(startingFunds - 10 * costs.road);

    run(sim, { type: 'placePowerLine', from: at(0, 2), to: at(4, 2) });
    run(sim, { type: 'placeZone', zone: 'commercial', from: at(0, 4), to: at(2, 5) });
    run(sim, { type: 'placePowerPlant', at: at(10, 10) });
    expect(sim.state.funds).toBe(
      startingFunds -
        10 * costs.road -
        5 * costs.powerLine -
        6 * costs.commercial -
        costs.powerPlant,
    );
  });

  it('only charges for tiles that actually change', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 1), to: at(5, 1) });
    const before = sim.state.funds;
    // A 3×3 residential rectangle across the road: the 3 road tiles are skipped.
    const plan = sim.preview({
      type: 'placeZone',
      zone: 'residential',
      from: at(0, 0),
      to: at(2, 2),
    });
    expect(plan.count).toBe(6);
    expect(plan.cost).toBe(6 * costs.residential);
    run(sim, { type: 'placeZone', zone: 'residential', from: at(0, 0), to: at(2, 2) });
    expect(sim.state.funds).toBe(before - 6 * costs.residential);

    // Re-placing an existing road costs nothing and is reported as already built.
    const again = sim.execute({ type: 'placeRoad', from: at(0, 1), to: at(5, 1) });
    expect(again.ok).toBe(false);
    expect(sim.state.funds).toBe(before - 6 * costs.residential);
  });

  it('charges for bulldozing, including every tile of a plant', () => {
    const sim = newSim();
    run(sim, { type: 'placePowerPlant', at: at(4, 4) });
    const before = sim.state.funds;
    const size = CONFIG.power.plantSize;
    run(sim, { type: 'bulldoze', from: at(4, 4), to: at(4, 4) });
    expect(sim.state.funds).toBe(before - size * size * costs.bulldoze);
  });

  it('refuses anything the city cannot afford and leaves the map untouched', () => {
    const sim = newSim({ funds: costs.road * 3 });
    const result = sim.execute({ type: 'placeRoad', from: at(0, 0), to: at(3, 0) });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Not enough money.');
    expect(result.plan.cost).toBe(4 * costs.road);
    expect(sim.state.funds).toBe(costs.road * 3);
    expect(tileAt(sim.state, 0, 0).kind).toBe('empty');

    run(sim, { type: 'placeRoad', from: at(0, 0), to: at(2, 0) });
    expect(sim.state.funds).toBe(0);
  });

  it('blocks building while in debt', () => {
    const sim = newSim({ funds: -50 });
    const result = sim.execute({ type: 'placePowerLine', from: at(0, 0), to: at(0, 0) });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Not enough money.');
  });
});

describe('monthly budget', () => {
  it('computes upkeep for roads, power lines (crossings too) and plants', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 0), to: at(7, 0) });
    run(sim, { type: 'placePowerLine', from: at(3, 0), to: at(3, 4) }); // one tile crosses the road
    run(sim, { type: 'placePowerPlant', at: at(10, 10) });
    expect(monthlyUpkeep(sim.state)).toBe(
      8 * upkeep.road + 5 * upkeep.powerLine + upkeep.powerPlant,
    );
  });

  it('taxes residents and workers at the current rate', () => {
    const state = createState({ seed: 1, width: 3, height: 1 });
    Object.assign(state.tiles[0], { kind: 'zone', zone: 'residential', residents: 100 });
    Object.assign(state.tiles[1], { kind: 'zone', zone: 'commercial', workers: 20 });
    Object.assign(state.tiles[2], { kind: 'zone', zone: 'industrial', workers: 30 });
    state.taxRate = 10;
    const base = 100 * income.residential + 20 * income.commercial + 30 * income.industrial;
    expect(monthlyTaxes(state)).toBe(Math.round(base * 0.1));

    state.taxRate = 0;
    expect(monthlyTaxes(state)).toBe(0);
  });

  it('settles taxes minus upkeep into the funds and remembers the result', () => {
    const state = createState({ seed: 1, width: 2, height: 1 });
    Object.assign(state.tiles[0], { kind: 'zone', zone: 'residential', residents: 50 });
    Object.assign(state.tiles[1], { kind: 'road' });
    state.funds = 1000;
    const taxes = monthlyTaxes(state);
    const budget = settleMonth(state);
    expect(budget).toEqual({ taxes, upkeep: upkeep.road });
    expect(state.lastBudget).toEqual(budget);
    expect(state.funds).toBe(1000 + taxes - upkeep.road);
  });

  it('settles once at the start of each month and can drive funds below zero', () => {
    const sim = newSim({ funds: 100 });
    run(sim, { type: 'placeRoad', from: at(0, 0), to: at(9, 0) });
    expect(sim.state.funds).toBe(0);

    const month = CONFIG.time.daysPerMonth;
    days(sim, month - 1);
    expect(sim.state.funds).toBe(0);
    const report = sim.tick();
    expect(report.budget).toEqual({ taxes: 0, upkeep: 10 * upkeep.road });
    expect(sim.state.funds).toBe(-10 * upkeep.road);
    days(sim, month);
    expect(sim.state.funds).toBe(-20 * upkeep.road);
  });
});

describe('tax rate', () => {
  it('is set by command and clamped to the allowed range', () => {
    const sim = newSim();
    run(sim, { type: 'setTaxRate', rate: 12 });
    expect(sim.state.taxRate).toBe(12);
    run(sim, { type: 'setTaxRate', rate: 99 });
    expect(sim.state.taxRate).toBe(CONFIG.economy.taxRate.max);
    run(sim, { type: 'setTaxRate', rate: -5 });
    expect(sim.state.taxRate).toBe(CONFIG.economy.taxRate.min);
    expect(sim.state.funds).toBe(startingFunds);
  });

  it('can still be changed while in debt', () => {
    const sim = newSim({ funds: -1000 });
    run(sim, { type: 'setTaxRate', rate: 15 });
    expect(sim.state.taxRate).toBe(15);
  });
});
