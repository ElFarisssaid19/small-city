import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { targetDemand, taxEffect, updateDemand } from '../src/sim/demand';
import { createState, emptyStats } from '../src/sim/state';
import type { CityStats } from '../src/sim/types';

function stats(patch: Partial<CityStats>): CityStats {
  return { ...emptyStats(), ...patch };
}

describe('RCI demand', () => {
  it('wants everything in an empty town', () => {
    expect(targetDemand(emptyStats())).toEqual({ residential: 1, commercial: 1, industrial: 1 });
  });

  it('wants residents when there are more jobs than workers, and not otherwise', () => {
    expect(targetDemand(stats({ workforce: 50, jobs: 200 })).residential).toBeGreaterThan(0.5);
    expect(targetDemand(stats({ workforce: 400, jobs: 100 })).residential).toBeLessThan(0);
  });

  it('wants businesses as the population grows and stops once jobs catch up', () => {
    const hungry = targetDemand(stats({ population: 1000 }));
    expect(hungry.commercial).toBeGreaterThan(0.9);
    expect(hungry.industrial).toBeGreaterThan(0.9);

    const d = CONFIG.demand;
    const saturated = targetDemand(
      stats({
        population: 1000,
        commercialJobs: 1000 * d.commercialJobsPerResident * 2,
        industrialJobs: 1000 * d.industrialJobsPerResident * 2,
      }),
    );
    expect(saturated.commercial).toBeLessThan(0);
    expect(saturated.industrial).toBeLessThan(0);
  });

  it('stays within [-1, 1]', () => {
    const extreme = targetDemand(
      stats({ workforce: 1e6, commercialJobs: 1e6, industrialJobs: 1e6 }),
    );
    for (const value of Object.values(extreme)) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is pushed down by high taxes and up by low taxes', () => {
    expect(taxEffect(CONFIG.demand.neutralTaxRate)).toBe(0);
    expect(taxEffect(20)).toBeLessThan(0);
    expect(taxEffect(0)).toBeGreaterThan(0);

    const low = createState({ seed: 1 });
    const high = createState({ seed: 1 });
    low.taxRate = 0;
    high.taxRate = 20;
    for (const state of [low, high]) {
      state.stats = stats({ population: 100, workforce: 60, jobs: 60 });
      for (let i = 0; i < 50; i++) updateDemand(state);
    }
    expect(low.demand.residential).toBeGreaterThan(high.demand.residential);
    expect(low.demand.commercial).toBeGreaterThan(high.demand.commercial);
  });

  it('moves smoothly toward its target', () => {
    const state = createState({ seed: 1 });
    updateDemand(state);
    expect(state.demand.residential).toBeCloseTo(CONFIG.demand.smoothing, 10);
  });
});
