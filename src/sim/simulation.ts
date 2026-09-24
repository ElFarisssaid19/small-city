import { updateRoadAccess } from './access';
import { executeCommand, planCommand } from './commands';
import type { Command, CommandResult, Plan } from './commands';
import { updateDemand } from './demand';
import { settleMonth } from './economy';
import { updateEnvironment } from './environment';
import { matchJobs } from './jobs';
import { updatePower } from './power';
import { updateCoverage } from './services';
import { createState } from './state';
import { isMonthStart } from './time';
import type { CityStats, MonthlyBudget, SimState } from './types';
import { updateZones } from './zones';
import type { ZoneReport } from './zones';

export interface TickReport extends ZoneReport {
  day: number;
  /** Set on the first day of a new month, when taxes and upkeep are settled. */
  budget: MonthlyBudget | null;
  /** True when pollution, crime and land value were recomputed this day. */
  environmentUpdated: boolean;
}

/**
 * Owns the simulation state and is the only thing that changes it:
 * through `execute` (player commands) and `tick` (one game day).
 */
export class Simulation {
  constructor(public readonly state: SimState) {
    this.refresh(false);
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
      // Map edits show their effect on pollution, crime and land value at once.
      this.refresh(true);
      this.state.revision++;
    }
    return result;
  }

  /** Advances the city by one day. */
  tick(): TickReport {
    const state = this.state;
    state.day++;
    const zones = updateZones(state);
    const monthStart = isMonthStart(state.day);
    this.refresh(monthStart);
    updateDemand(state);
    const budget = monthStart ? settleMonth(state) : null;
    state.revision++;
    return { ...zones, day: state.day, budget, environmentUpdated: monthStart };
  }

  /**
   * Recomputes what derives from the map every update (road access, power,
   * service coverage, jobs, totals) and, when asked or never done, pollution,
   * crime and land value.
   */
  private refresh(environment: boolean): void {
    const state = this.state;
    updateRoadAccess(state);
    const power = updatePower(state);
    updateCoverage(state);
    const jobs = matchJobs(state);
    if (environment || !state.environmentReady) updateEnvironment(state);
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
      ...environmentAverages(state),
    };
  }
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** City-wide land value, crime at homes and shops, and pollution at homes. */
function environmentAverages(
  state: Readonly<SimState>,
): Pick<CityStats, 'averageLandValue' | 'averageCrime' | 'averagePollution'> {
  const landValue: number[] = [];
  const crime: number[] = [];
  const pollution: number[] = [];
  for (const tile of state.tiles) {
    if (tile.kind !== 'zone') continue;
    landValue.push(tile.landValue);
    if (tile.stage !== 'developed' || tile.zone === 'industrial') continue;
    crime.push(tile.crime);
    if (tile.zone === 'residential') pollution.push(tile.pollution);
  }
  return {
    averageLandValue: Math.round(mean(landValue)),
    averageCrime: Math.round(mean(crime)),
    averagePollution: Math.round(mean(pollution)),
  };
}
