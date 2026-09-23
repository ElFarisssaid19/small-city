import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { at, newSim, run, tileAt } from './helpers';

describe('road access', () => {
  const radius = CONFIG.zones.roadAccessRadius;

  it('reaches zones within the radius and no further', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 0), to: at(15, 0) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(4, 1), to: at(4, 8) });
    const s = sim.state;

    for (let y = 1; y <= radius; y++) expect(tileAt(s, 4, y).roadAccess).toBe(true);
    expect(tileAt(s, 4, radius + 1).roadAccess).toBe(false);
    expect(tileAt(s, 4, 8).roadAccess).toBe(false);
  });

  it('measures Manhattan distance, so diagonals count both steps', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(8, 8), to: at(8, 8) });
    run(sim, { type: 'placeZone', zone: 'commercial', from: at(10, 9), to: at(10, 9) }); // 3 away
    run(sim, { type: 'placeZone', zone: 'commercial', from: at(10, 10), to: at(10, 10) }); // 4 away
    expect(tileAt(sim.state, 10, 9).roadAccess).toBe(true);
    expect(tileAt(sim.state, 10, 10).roadAccess).toBe(false);
  });

  it('is lost when the road is bulldozed', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(2, 2), to: at(6, 2) });
    run(sim, { type: 'placeZone', zone: 'industrial', from: at(4, 3), to: at(4, 3) });
    expect(tileAt(sim.state, 4, 3).roadAccess).toBe(true);

    run(sim, { type: 'bulldoze', from: at(2, 2), to: at(6, 2) });
    expect(tileAt(sim.state, 4, 3).roadAccess).toBe(false);
  });
});
