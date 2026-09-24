import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { createState } from '../src/sim/state';
import type { SimState } from '../src/sim/types';
import { updateZones } from '../src/sim/zones';
import { at, newSim, run, tileAt } from './helpers';

/** A block of developed, serviced buildings with no fire station, and no demand to grow. */
function block(seed: number, disasters = true): SimState {
  const state = createState({ seed, width: 20, height: 20 });
  for (const tile of state.tiles) {
    Object.assign(tile, {
      kind: 'zone',
      zone: 'residential',
      stage: 'developed',
      level: 1,
      powered: true,
      roadAccess: true,
    });
  }
  state.disasters = disasters;
  return state;
}

/** Where fires broke out, day by day, over `count` days. */
function fireLog(state: SimState, count: number): string[] {
  const log: string[] = [];
  for (let day = 0; day < count; day++) {
    for (const i of updateZones(state).firesStarted) log.push(`${day}:${i}`);
  }
  return log;
}

describe('fires', () => {
  it('break out now and then outside fire coverage, identically for the same seed', () => {
    const first = fireLog(block(3), 300);
    const again = fireLog(block(3), 300);
    expect(first.length).toBeGreaterThan(0);
    expect(again).toEqual(first);
    expect(fireLog(block(4), 300)).not.toEqual(first);
  });

  it('never start while disasters are off', () => {
    expect(fireLog(block(3, false), 2000)).toEqual([]);
  });

  it('never start inside fire coverage', () => {
    const state = block(3);
    for (const tile of state.tiles) tile.coverage.fire = true;
    expect(fireLog(state, 2000)).toEqual([]);
  });

  it(`burn for ${CONFIG.disasters.burnDays} days and leave an empty lot`, () => {
    const state = block(3, false);
    const tile = Object.assign(state.tiles[0], { fire: CONFIG.disasters.burnDays, level: 2 });
    for (let d = 1; d < CONFIG.disasters.burnDays; d++) {
      expect(updateZones(state).burnedDown).toEqual([]);
      expect(tile.stage).toBe('developed');
      expect(tile.residents).toBe(0); // evacuated while it burns
    }
    expect(updateZones(state).burnedDown).toEqual([0]);
    expect(tile).toMatchObject({ kind: 'zone', stage: 'empty', level: 0, fire: 0 });
  });

  it('are put out once a fire station covers the building', () => {
    const state = block(3, false);
    const tile = Object.assign(state.tiles[0], { fire: 2, level: 2 });
    tile.coverage.fire = true;
    expect(updateZones(state).extinguished).toBe(1);
    expect(tile).toMatchObject({ stage: 'developed', level: 2, fire: 0 });
  });

  it('are switched off (and put out) by the free setDisasters command', () => {
    const sim = newSim();
    run(sim, { type: 'placeZone', zone: 'industrial', from: at(2, 2), to: at(2, 2) });
    Object.assign(tileAt(sim.state, 2, 2), { stage: 'developed', level: 1, fire: 3 });
    const funds = sim.state.funds;
    run(sim, { type: 'setDisasters', enabled: false });
    expect(sim.state.disasters).toBe(false);
    expect(tileAt(sim.state, 2, 2).fire).toBe(0);
    expect(sim.state.funds).toBe(funds);
  });
});
