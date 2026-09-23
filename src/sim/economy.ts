import { CONFIG } from './config';
import type { Command } from './commands';
import type { MonthlyBudget, SimState } from './types';

const { costs, upkeep, income, taxRate } = CONFIG.economy;

/** What a command costs when it changes `count` tiles. */
export function commandCost(command: Command, count: number): number {
  switch (command.type) {
    case 'placeRoad':
      return costs.road * count;
    case 'placePowerLine':
      return costs.powerLine * count;
    case 'placeZone':
      return costs[command.zone] * count;
    case 'placePowerPlant':
      return count > 0 ? costs.powerPlant : 0;
    case 'bulldoze':
      return costs.bulldoze * count;
    case 'setTaxRate':
      return 0;
  }
}

export function clampTaxRate(rate: number): number {
  return Math.min(Math.max(Math.round(rate), taxRate.min), taxRate.max);
}

/** Monthly running costs of roads, power lines (including crossings) and plants. */
export function monthlyUpkeep(state: Readonly<SimState>): number {
  let total = 0;
  state.tiles.forEach((tile, i) => {
    if (tile.kind === 'road') total += upkeep.road;
    if (tile.hasLine) total += upkeep.powerLine;
    if (tile.kind === 'powerPlant' && tile.anchor === i) total += upkeep.powerPlant;
  });
  return total;
}

/** Monthly taxes: the tax rate's share of residents' and workers' income. */
export function monthlyTaxes(state: Readonly<SimState>): number {
  let base = 0;
  for (const tile of state.tiles) {
    if (tile.kind !== 'zone') continue;
    if (tile.zone === 'residential') base += tile.residents * income.residential;
    else if (tile.zone === 'commercial') base += tile.workers * income.commercial;
    else if (tile.zone === 'industrial') base += tile.workers * income.industrial;
  }
  return Math.round((base * state.taxRate) / 100);
}

/** Collects taxes and pays upkeep for the month that just ended. */
export function settleMonth(state: SimState): MonthlyBudget {
  const budget = { taxes: monthlyTaxes(state), upkeep: monthlyUpkeep(state) };
  state.funds += budget.taxes - budget.upkeep;
  state.lastBudget = budget;
  return budget;
}
