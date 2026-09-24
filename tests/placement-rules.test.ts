import { describe, expect, it } from 'vitest';
import {
  buildingFacing,
  coordHash,
  facingYaw,
  pickVariant,
  roadFacing,
} from '../src/render/placementRules';
import { at, newSim, run } from './helpers';

describe('render placement rules', () => {
  it('picks the same variant for the same tile every time, spread over all variants', () => {
    expect(pickVariant(5, 9, 21, 3)).toBe(pickVariant(5, 9, 21, 3));
    expect(coordHash(5, 9)).not.toBe(coordHash(9, 5));
    const seen = new Set<number>();
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) seen.add(pickVariant(x, y, 21, 3));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('turns a building toward an adjacent road on any side', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(2, 5), to: at(12, 5) });
    run(sim, { type: 'placeRoad', from: at(8, 6), to: at(8, 12) });
    expect(roadFacing(sim.state, 4, 4)).toBe('south');
    expect(roadFacing(sim.state, 4, 6)).toBe('north');
    expect(roadFacing(sim.state, 7, 10)).toBe('east');
    expect(roadFacing(sim.state, 9, 10)).toBe('west');
  });

  it('prefers the nearest road and ignores roads beyond the access radius', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 3), to: at(15, 3) });
    run(sim, { type: 'placeRoad', from: at(0, 6), to: at(15, 6) });
    expect(roadFacing(sim.state, 5, 5)).toBe('south'); // 1 away vs 2 away
    expect(roadFacing(sim.state, 5, 10)).toBeNull(); // 4 away
  });

  it('falls back to a stable side when no road is near', () => {
    const sim = newSim();
    expect(buildingFacing(sim.state, 3, 3)).toBe(buildingFacing(sim.state, 3, 3));
  });

  it('maps facings to quarter turns about the vertical axis', () => {
    expect(facingYaw('south')).toBe(0);
    expect(facingYaw('east')).toBeCloseTo(Math.PI / 2);
    expect(facingYaw('north')).toBeCloseTo(Math.PI);
    expect(facingYaw('west')).toBeCloseTo(-Math.PI / 2);
  });
});
