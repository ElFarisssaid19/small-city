import { CONFIG } from './config';
import { ZONE_TYPES } from './types';
import type { CityStats, Demand, SimState } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** How far `have` falls short of `want`, as a fraction of `want`, in [-1, 1]. */
function pressure(want: number, have: number): number {
  return clamp((want - have) / Math.max(want, 1), -1, 1);
}

/**
 * Where demand is heading given the current city:
 * residential grows while there are more jobs than workers,
 * commercial and industrial grow while the population wants more jobs of their kind.
 */
export function targetDemand(stats: CityStats): Demand {
  const d = CONFIG.demand;
  return {
    residential: pressure(stats.jobs + d.baseResidential, stats.workforce),
    commercial: pressure(
      stats.population * d.commercialJobsPerResident + d.baseCommercial,
      stats.commercialJobs,
    ),
    industrial: pressure(
      stats.population * d.industrialJobsPerResident + d.baseIndustrial,
      stats.industrialJobs,
    ),
  };
}

/** Taxes above the neutral rate push every zone's demand down, lower taxes pull it up. */
export function taxEffect(taxRate: number): number {
  return (CONFIG.demand.neutralTaxRate - taxRate) * CONFIG.demand.taxSensitivity;
}

/** Moves demand a step toward its target so it changes smoothly day to day. */
export function updateDemand(state: SimState): void {
  const target = targetDemand(state.stats);
  const tax = taxEffect(state.taxRate);
  for (const zone of ZONE_TYPES) {
    const goal = clamp(target[zone] + tax, -1, 1);
    state.demand[zone] += (goal - state.demand[zone]) * CONFIG.demand.smoothing;
  }
}
