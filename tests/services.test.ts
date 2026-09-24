import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { serviceActive } from '../src/sim/services';
import { missingRequirement } from '../src/sim/zones';
import { at, newSim, run, tileAt } from './helpers';

/** A road along y = 12 and a power plant at the west end, on a 24 × 24 map. */
function townWithPower() {
  const sim = newSim({ size: 24 });
  run(sim, { type: 'placeRoad', from: at(0, 12), to: at(23, 12) });
  run(sim, { type: 'placePowerPlant', at: at(0, 10) });
  return sim;
}

describe('service coverage', () => {
  it('covers every tile within the radius (Manhattan distance) and nothing beyond', () => {
    const sim = townWithPower();
    // Next to the plant (power) and the road (access).
    run(sim, { type: 'placeService', service: 'police', at: at(2, 11) });
    const r = CONFIG.services.police.radius;
    const s = sim.state;
    expect(serviceActive(s, 11 * 24 + 2)).toBe(true);
    expect(tileAt(s, 2 + r, 11).coverage.police).toBe(true);
    expect(tileAt(s, 2 + r + 1, 11).coverage.police).toBe(false);
    expect(tileAt(s, 6, 15).coverage.police).toBe(true); // 4 + 4 = 8 away
    expect(tileAt(s, 7, 15).coverage.police).toBe(false); // 9 away
    expect(tileAt(s, 6, 15).coverage.fire).toBe(false);
  });

  it('measures a 2×2 school from its nearest tile', () => {
    const sim = townWithPower();
    run(sim, { type: 'placeService', service: 'school', at: at(10, 9) }); // tiles 10–11 × 9–10
    run(sim, { type: 'placePowerPlant', at: at(12, 9) }); // powers it from the east
    const r = CONFIG.services.school.radius;
    expect(tileAt(sim.state, 10, 9).kind).toBe('service');
    expect(tileAt(sim.state, 11, 10).anchor).toBe(9 * 24 + 10);
    // Measured from the school's east edge (x = 11), straight through the plant.
    expect(tileAt(sim.state, 11 + r, 10).coverage.school).toBe(true);
    expect(tileAt(sim.state, 11 + r + 1, 10).coverage.school).toBe(false);
  });

  it('only works with road access and power, except parks', () => {
    const sim = townWithPower();
    run(sim, { type: 'placeService', service: 'fire', at: at(20, 2) }); // far from both
    const station = tileAt(sim.state, 20, 2);
    expect(serviceActive(sim.state, 2 * 24 + 20)).toBe(false);
    expect(missingRequirement(sim.state, station)).toBe('road');
    expect(tileAt(sim.state, 20, 3).coverage.fire).toBe(false);

    run(sim, { type: 'placeService', service: 'park', at: at(20, 20) });
    expect(missingRequirement(sim.state, tileAt(sim.state, 20, 20))).toBeNull();
    expect(tileAt(sim.state, 20, 20 - CONFIG.services.park.radius).coverage.park).toBe(true);
  });

  it('draws power and needs it to work', () => {
    const sim = newSim({ size: 24 });
    run(sim, { type: 'placeRoad', from: at(0, 12), to: at(23, 12) });
    run(sim, { type: 'placeService', service: 'police', at: at(5, 11) });
    expect(missingRequirement(sim.state, tileAt(sim.state, 5, 11))).toBe('power');
    expect(sim.state.stats.powerDemand).toBe(CONFIG.services.police.power);
  });

  it('loses coverage when bulldozed, including every tile of a school', () => {
    const sim = townWithPower();
    run(sim, { type: 'placeService', service: 'police', at: at(2, 11) });
    run(sim, { type: 'placeService', service: 'school', at: at(4, 10) });
    run(sim, { type: 'bulldoze', from: at(2, 11), to: at(2, 11) });
    run(sim, { type: 'bulldoze', from: at(5, 11), to: at(5, 11) });
    expect(tileAt(sim.state, 4, 10).kind).toBe('empty');
    expect(tileAt(sim.state, 5, 10).kind).toBe('empty');
    expect(sim.state.tiles.some((t) => t.coverage.police || t.coverage.school)).toBe(false);
  });

  it('refuses buildings that do not fit or overlap', () => {
    const sim = townWithPower();
    expect(sim.preview({ type: 'placeService', service: 'school', at: at(23, 0) }).problem).toBe(
      'outOfBounds',
    );
    expect(sim.preview({ type: 'placeService', service: 'police', at: at(3, 12) }).problem).toBe(
      'blocked',
    );
  });
});
