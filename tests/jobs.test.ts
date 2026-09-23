import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { toIndex } from '../src/sim/grid';
import { jobCapacity, matchJobs, workforceOf } from '../src/sim/jobs';
import { createState } from '../src/sim/state';
import type { SimState, Tile, ZoneType } from '../src/sim/types';
import { capacityOf } from '../src/sim/zones';

function world(width = 40, height = 40): SimState {
  return createState({ seed: 1, width, height });
}

function building(state: SimState, x: number, y: number, zone: ZoneType, level: number): Tile {
  const tile = Object.assign(state.tiles[toIndex(state, x, y)], {
    kind: 'zone',
    zone,
    stage: 'developed',
    level,
  });
  if (zone === 'residential') tile.residents = capacityOf('residential', level);
  return tile;
}

describe('job matching', () => {
  const radius = CONFIG.jobs.commuteRadius;

  it('employs residents at workplaces within the commute radius', () => {
    const state = world();
    const home = building(state, 5, 5, 'residential', 1);
    const shop = building(state, 5 + radius, 5, 'commercial', 3);

    const report = matchJobs(state);
    const seekers = workforceOf(home);
    expect(seekers).toBe(
      Math.floor(capacityOf('residential', 1) * CONFIG.population.workforceRatio),
    );
    expect(home.employed).toBe(Math.min(seekers, jobCapacity(shop)));
    expect(shop.workers).toBe(home.employed);
    expect(report).toEqual({
      workforce: seekers,
      employed: home.employed,
      commercialJobs: capacityOf('commercial', 3),
      industrialJobs: 0,
    });
  });

  it('ignores workplaces beyond the commute radius', () => {
    const state = world();
    const home = building(state, 0, 0, 'residential', 3);
    const factory = building(state, radius, 1, 'industrial', 3); // radius + 1 away
    const report = matchJobs(state);
    expect(home.employed).toBe(0);
    expect(factory.workers).toBe(0);
    expect(report.employed).toBe(0);
    expect(report.industrialJobs).toBe(capacityOf('industrial', 3));
  });

  it('fills the nearest workplace first and never over-fills it', () => {
    const state = world();
    const home = building(state, 10, 10, 'residential', 3);
    const near = building(state, 11, 10, 'commercial', 1);
    const far = building(state, 16, 10, 'industrial', 3);

    matchJobs(state);
    const seekers = workforceOf(home);
    expect(near.workers).toBe(jobCapacity(near));
    expect(far.workers).toBe(seekers - jobCapacity(near));
    expect(home.employed).toBe(seekers);
  });

  it('shares scarce jobs between homes without exceeding capacity', () => {
    const state = world();
    const homes = [
      building(state, 3, 3, 'residential', 3),
      building(state, 7, 3, 'residential', 3),
    ];
    const shop = building(state, 5, 3, 'commercial', 1);
    const report = matchJobs(state);
    expect(shop.workers).toBe(jobCapacity(shop));
    expect(homes[0].employed + homes[1].employed).toBe(jobCapacity(shop));
    expect(report.employed).toBe(jobCapacity(shop));
    expect(report.workforce).toBe(workforceOf(homes[0]) + workforceOf(homes[1]));
  });

  it('only counts developed commercial and industrial buildings as workplaces', () => {
    const state = world();
    building(state, 1, 1, 'residential', 3);
    const site = building(state, 2, 1, 'commercial', 0);
    site.stage = 'construction';
    const ruin = building(state, 3, 1, 'industrial', 2);
    ruin.stage = 'abandoned';
    expect(jobCapacity(site)).toBe(0);
    expect(jobCapacity(ruin)).toBe(0);
    expect(matchJobs(state).employed).toBe(0);
  });

  it('gives identical results when run twice', () => {
    const state = world();
    for (let i = 0; i < 12; i++) {
      building(state, (i * 7) % 40, (i * 11) % 40, 'residential', 3);
    }
    for (let i = 0; i < 8; i++) {
      building(state, (i * 13 + 3) % 40, (i * 5 + 2) % 40, 'industrial', 2);
    }
    const first = matchJobs(state);
    const workers = state.tiles.map((t) => t.workers);
    expect(matchJobs(state)).toEqual(first);
    expect(state.tiles.map((t) => t.workers)).toEqual(workers);
  });
});
