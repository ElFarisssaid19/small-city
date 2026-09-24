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
    case 'placeService':
      return count > 0 ? CONFIG.services[command.service].cost : 0;
    case 'bulldoze':
      return costs.bulldoze * count;
    case 'setTaxRate':
    case 'setDisasters':
      return 0;
  }
}

export function clampTaxRate(rate: number): number {
  return Math.min(Math.max(Math.round(rate), taxRate.min), taxRate.max);
}

/**
 * The month's money at the current state of the city: taxes by zone type
 * (the tax rate's share of residents' and workers' income) and upkeep for
 * roads, power (plants and lines, including crossings) and each service.
 */
export function budgetBreakdown(state: Readonly<SimState>): MonthlyBudget {
  const base = { residential: 0, commercial: 0, industrial: 0 };
  const expenses = { roads: 0, power: 0, police: 0, fire: 0, school: 0, park: 0 };
  state.tiles.forEach((tile, i) => {
    if (tile.kind === 'road') expenses.roads += upkeep.road;
    if (tile.hasLine) expenses.power += upkeep.powerLine;
    if (tile.kind === 'powerPlant' && tile.anchor === i) expenses.power += upkeep.powerPlant;
    if (tile.kind === 'service' && tile.service && tile.anchor === i) {
      expenses[tile.service] += CONFIG.services[tile.service].upkeep;
    }
    if (tile.kind !== 'zone' || tile.zone === null) return;
    const people = tile.zone === 'residential' ? tile.residents : tile.workers;
    base[tile.zone] += people * income[tile.zone];
  });
  const share = (amount: number) => Math.round((amount * state.taxRate) / 100);
  const taxesByZone = {
    residential: share(base.residential),
    commercial: share(base.commercial),
    industrial: share(base.industrial),
  };
  const sum = (values: Record<string, number>) =>
    Object.values(values).reduce((total, v) => total + v, 0);
  return {
    taxes: sum(taxesByZone),
    upkeep: sum(expenses),
    income: taxesByZone,
    expenses,
  };
}

/** Monthly running costs of roads, power and services. */
export function monthlyUpkeep(state: Readonly<SimState>): number {
  return budgetBreakdown(state).upkeep;
}

/** Monthly taxes from every zone type. */
export function monthlyTaxes(state: Readonly<SimState>): number {
  return budgetBreakdown(state).taxes;
}

/** Collects taxes and pays upkeep for the month that just ended. */
export function settleMonth(state: SimState): MonthlyBudget {
  const budget = budgetBreakdown(state);
  state.funds += budget.taxes - budget.upkeep;
  state.lastBudget = budget;
  return budget;
}
