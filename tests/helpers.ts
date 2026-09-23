import { expect } from 'vitest';
import type { Command } from '../src/sim/commands';
import { toIndex } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createState } from '../src/sim/state';
import type { SimState, Tile } from '../src/sim/types';

/** A small map keeps tests fast and easy to picture. */
export function newSim(options: { seed?: number; size?: number; funds?: number } = {}): Simulation {
  const size = options.size ?? 16;
  const state = createState({ seed: options.seed ?? 1, width: size, height: size });
  if (options.funds !== undefined) state.funds = options.funds;
  return new Simulation(state);
}

/** Executes a command and fails the test if it is refused. */
export function run(sim: Simulation, command: Command): void {
  const result = sim.execute(command);
  expect(result.reason).toBeNull();
  expect(result.ok).toBe(true);
}

export function tileAt(state: SimState, x: number, y: number): Tile {
  return state.tiles[toIndex(state, x, y)];
}

export function days(sim: Simulation, count: number): void {
  for (let i = 0; i < count; i++) sim.tick();
}

export const at = (x: number, y: number) => ({ x, y });
