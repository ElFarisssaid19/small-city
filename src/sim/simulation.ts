import { updateRoadAccess } from './access';
import { executeCommand, planCommand } from './commands';
import type { Command, CommandResult, Plan } from './commands';
import { updateDemand } from './demand';
import { settleMonth } from './economy';
import { matchJobs } from './jobs';
import { updatePower } from './power';
import { createState } from './state';
import { isMonthStart } from './time';
import type { MonthlyBudget, SimState } from './types';
import { updateZones } from './zones';
import type { ZoneReport } from './zones';

export interface TickReport extends ZoneReport {
  day: number;
  /** Set on the first day of a new month, when taxes and upkeep are settled. */
  budget: MonthlyBudget | null;
}

/**
 * Owns the simulation state and is the only thing that changes it:
 * through `execute` (player commands) and `tick` (one game day).
 */
export class Simulation {
  constructor(public readonly state: SimState) {
    this.refresh();
  }

  static newGame(seed: number): Simulation {
    return new Simulation(createState({ seed }));
  }

  /** What `command` would do, without doing it. */
  preview(command: Command): Plan {
    return planCommand(this.state, command);
  }

  execute(command: Command): CommandResult {
    const result = executeCommand(this.state, command);
    if (result.ok) {
      this.refresh();
      this.state.revision++;
    }
    return result;
  }

  /** Advances the city by one day. */
  tick(): TickReport {
    const state = this.state;
    state.day++;
    const zones = updateZones(state);
    this.refresh();
    updateDemand(state);
    const budget = isMonthStart(state.day) ? settleMonth(state) : null;
    state.revision++;
    return { ...zones, day: state.day, budget };
  }

  /** Recomputes everything derived from the map: road access, power, jobs and totals. */
  private refresh(): void {
    const state = this.state;
    updateRoadAccess(state);
    const power = updatePower(state);
    const jobs = matchJobs(state);
    let population = 0;
    for (const tile of state.tiles) population += tile.residents;
    state.stats = {
      population,
      workforce: jobs.workforce,
      employed: jobs.employed,
      jobs: jobs.commercialJobs + jobs.industrialJobs,
      commercialJobs: jobs.commercialJobs,
      industrialJobs: jobs.industrialJobs,
      powerSupply: power.supply,
      powerDemand: power.demand,
      unpoweredZones: power.unpoweredZones,
    };
  }
}
