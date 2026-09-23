import { describe, expect, it } from 'vitest';
import { chance, nextRandom, seedRng } from '../src/sim/rng';
import { Simulation } from '../src/sim/simulation';
import { at, days, run } from './helpers';

function playScript(seed: number): Simulation {
  const sim = Simulation.newGame(seed);
  run(sim, { type: 'placeRoad', from: at(2, 10), to: at(28, 10) });
  run(sim, { type: 'placeZone', zone: 'residential', from: at(2, 7), to: at(14, 9) });
  run(sim, { type: 'placeZone', zone: 'commercial', from: at(16, 7), to: at(24, 9) });
  run(sim, { type: 'placeZone', zone: 'industrial', from: at(2, 11), to: at(14, 13) });
  run(sim, { type: 'placePowerPlant', at: at(25, 7) });
  // Joins the zones on both sides of the road, crossing it at (15, 10).
  run(sim, { type: 'placePowerLine', from: at(15, 9), to: at(15, 11) });
  days(sim, 200);
  return sim;
}

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = { rng: seedRng(42) };
    const b = { rng: seedRng(42) };
    const seqA = Array.from({ length: 20 }, () => nextRandom(a));
    const seqB = Array.from({ length: 20 }, () => nextRandom(b));
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('produces different sequences for different seeds', () => {
    const a = { rng: seedRng(1) };
    const b = { rng: seedRng(2) };
    expect(nextRandom(a)).not.toBe(nextRandom(b));
  });

  it('is roughly uniform', () => {
    const holder = { rng: seedRng(9) };
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (chance(holder, 0.25)) hits++;
    expect(hits / 10000).toBeGreaterThan(0.23);
    expect(hits / 10000).toBeLessThan(0.27);
  });
});

describe('simulation determinism', () => {
  it('replays identically from the same seed and commands', () => {
    const a = playScript(123);
    const b = playScript(123);
    expect(b.state).toEqual(a.state);
    expect(a.state.stats.population).toBeGreaterThan(0);
  });

  it('diverges with a different seed', () => {
    expect(playScript(1).state.tiles).not.toEqual(playScript(2).state.tiles);
  });
});
