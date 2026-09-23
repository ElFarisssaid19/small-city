import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { linePoints, rectPoints } from '../src/sim/grid';
import { at, newSim, run, tileAt } from './helpers';

describe('placement helpers', () => {
  it('draws L-shaped lines along the longer axis first', () => {
    expect(linePoints(at(0, 0), at(3, 1))).toEqual([
      at(0, 0),
      at(1, 0),
      at(2, 0),
      at(3, 0),
      at(3, 1),
    ]);
    expect(linePoints(at(2, 3), at(1, 0))).toEqual([
      at(2, 3),
      at(2, 2),
      at(2, 1),
      at(2, 0),
      at(1, 0),
    ]);
    expect(linePoints(at(4, 4), at(4, 4))).toEqual([at(4, 4)]);
  });

  it('covers rectangles dragged in any direction', () => {
    expect(rectPoints(at(2, 2), at(1, 1))).toEqual([at(1, 1), at(2, 1), at(1, 2), at(2, 2)]);
  });
});

describe('command validation', () => {
  it('refuses roads through buildings but crosses power lines', () => {
    const sim = newSim();
    run(sim, { type: 'placeZone', zone: 'residential', from: at(3, 0), to: at(3, 0) });
    const blocked = sim.preview({ type: 'placeRoad', from: at(0, 0), to: at(6, 0) });
    expect(blocked.valid).toBe(false);
    expect(blocked.problem).toBe('blocked');
    expect(blocked.tiles.find((t) => t.x === 3)?.ok).toBe(false);

    run(sim, { type: 'placePowerLine', from: at(0, 2), to: at(6, 2) });
    run(sim, { type: 'placeRoad', from: at(2, 1), to: at(2, 3) });
    expect(tileAt(sim.state, 2, 2)).toMatchObject({ kind: 'road', hasLine: true });
  });

  it('zones only free land and undeveloped lots, skipping everything else', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 1), to: at(4, 1) });
    run(sim, { type: 'placeZone', zone: 'commercial', from: at(0, 0), to: at(4, 0) });
    // Rezoning an empty lot is allowed; the road row is skipped.
    const plan = sim.preview({
      type: 'placeZone',
      zone: 'industrial',
      from: at(0, 0),
      to: at(4, 2),
    });
    expect(plan.valid).toBe(true);
    expect(plan.problem).toBeNull();
    expect(plan.reason).toBeNull();
    expect(plan.count).toBe(10);
    expect(plan.tiles.filter((t) => !t.ok)).toHaveLength(5);

    // A developed building is not rezoned.
    Object.assign(tileAt(sim.state, 0, 0), { stage: 'developed', level: 1 });
    const again = sim.preview({
      type: 'placeZone',
      zone: 'industrial',
      from: at(0, 0),
      to: at(0, 0),
    });
    expect(again.valid).toBe(false);
  });

  it('needs the whole plant footprint free and on the map', () => {
    const sim = newSim({ size: 8 });
    const edge = 8 - CONFIG.power.plantSize + 1;
    const offMap = sim.preview({ type: 'placePowerPlant', at: at(edge, 0) });
    expect(offMap.problem).toBe('outOfBounds');
    expect(offMap.reason).toMatch(/fit/);
    run(sim, { type: 'placeRoad', from: at(1, 1), to: at(1, 1) });
    expect(sim.preview({ type: 'placePowerPlant', at: at(0, 0) }).valid).toBe(false);
    run(sim, { type: 'placePowerPlant', at: at(3, 3) });
    expect(tileAt(sim.state, 4, 4)).toMatchObject({ kind: 'powerPlant' });
  });

  it('bulldozes everything in a rectangle back to empty land', () => {
    const sim = newSim();
    run(sim, { type: 'placeRoad', from: at(0, 0), to: at(5, 0) });
    run(sim, { type: 'placeZone', zone: 'residential', from: at(0, 1), to: at(5, 2) });
    run(sim, { type: 'bulldoze', from: at(1, 0), to: at(3, 2) });
    for (let x = 1; x <= 3; x++) {
      for (let y = 0; y <= 2; y++) expect(tileAt(sim.state, x, y).kind).toBe('empty');
    }
    expect(tileAt(sim.state, 0, 0).kind).toBe('road');
    const nothing = sim.execute({ type: 'bulldoze', from: at(9, 9), to: at(10, 10) });
    expect(nothing.plan.problem).toBe('nothingToDo');
    expect(nothing.reason).toMatch(/Nothing/);
  });

  it('leaves the state untouched when previewing', () => {
    const sim = newSim();
    const before = JSON.stringify(sim.state);
    sim.preview({ type: 'placeRoad', from: at(0, 0), to: at(9, 9) });
    sim.preview({ type: 'placePowerPlant', at: at(4, 4) });
    expect(JSON.stringify(sim.state)).toBe(before);
  });
});
