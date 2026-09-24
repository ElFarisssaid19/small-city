import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/sim/config';
import { createState, noCoverage } from '../src/sim/state';
import type { SimState, Tile, ZoneType } from '../src/sim/types';
import { appeal, distressed, levelLimit, updateZones } from '../src/sim/zones';

const e = CONFIG.zones.effects;

/** A one-tile world whose only lot is serviced, in demand, and patched as needed. */
function lot(zone: ZoneType, patch: Partial<Tile>, demand = 1): { state: SimState; tile: Tile } {
  const state = createState({ seed: 11, width: 1, height: 1 });
  const tile = Object.assign(state.tiles[0], {
    kind: 'zone',
    zone,
    powered: true,
    roadAccess: true,
    landValue: 60,
    ...patch,
  });
  state.demand[zone] = demand;
  state.disasters = false; // fires have their own tests
  return { state, tile };
}

function days(state: SimState, count: number): void {
  for (let d = 0; d < count; d++) updateZones(state);
}

function tile(patch: Partial<Tile>): Tile {
  return { ...createState({ seed: 1, width: 1, height: 1 }).tiles[0], ...patch };
}

describe('appeal', () => {
  it('draws homes to high land value and away from pollution', () => {
    const cheap = appeal(tile({ zone: 'residential', landValue: 10 }));
    const pricey = appeal(tile({ zone: 'residential', landValue: 90 }));
    const smoggy = appeal(tile({ zone: 'residential', landValue: 90, pollution: 50 }));
    expect(pricey).toBeGreaterThan(cheap);
    expect(pricey).toBeLessThanOrEqual(e.appealMax);
    expect(smoggy).toBeCloseTo(pricey / 2);
  });

  it('lets industry ignore pollution but not crime', () => {
    expect(appeal(tile({ zone: 'industrial', pollution: 100 }))).toBe(1);
    expect(appeal(tile({ zone: 'industrial', crime: 60 }))).toBeCloseTo(
      1 - 60 / e.industrialCrimeTolerance,
    );
    expect(appeal(tile({ zone: 'commercial', pollution: 100, landValue: 0 }))).toBe(1);
  });

  it('makes empty lots in valuable areas start building sooner', () => {
    const started = (landValue: number) => {
      const state = createState({ seed: 5, width: 20, height: 15 });
      for (const t of state.tiles) {
        Object.assign(t, {
          kind: 'zone',
          zone: 'residential',
          powered: true,
          roadAccess: true,
          landValue,
        });
      }
      state.demand.residential = 1;
      days(state, 5);
      return state.tiles.filter((t) => t.stage !== 'empty').length;
    };
    expect(started(90)).toBeGreaterThan(started(0) * 1.5);
  });
});

describe('level caps', () => {
  it('keeps homes at level 2 without a school and lets them reach 3 with one', () => {
    expect(levelLimit(tile({ zone: 'residential' }))).toEqual({
      cap: e.schoolFreeMaxLevel,
      needs: 'school',
      landValue: 0,
    });
    const withoutSchool = lot('residential', { stage: 'developed', level: 2 });
    days(withoutSchool.state, 600);
    expect(withoutSchool.tile.level).toBe(2);

    const withSchool = lot('residential', {
      stage: 'developed',
      level: 2,
      coverage: { ...noCoverage(), school: true },
    });
    days(withSchool.state, 600);
    expect(withSchool.tile.level).toBe(3);
  });

  it('gates shop levels on land value', () => {
    const [, two, three] = e.commercialLandValue.slice(1);
    expect(levelLimit(tile({ zone: 'commercial', landValue: two - 1 }))).toMatchObject({
      cap: 1,
      needs: 'landValue',
      landValue: two,
    });
    expect(levelLimit(tile({ zone: 'commercial', landValue: two }))).toMatchObject({
      cap: 2,
      landValue: three,
    });
    expect(levelLimit(tile({ zone: 'commercial', landValue: three })).cap).toBe(3);
    expect(levelLimit(tile({ zone: 'industrial' })).cap).toBe(CONFIG.zones.maxLevel);
  });

  it('lets a building above its cap slip back down', () => {
    const { state, tile: shop } = lot('commercial', {
      stage: 'developed',
      level: 3,
      landValue: 10,
    });
    days(state, 600);
    expect(shop.level).toBe(1);
    expect(shop.stage).toBe('developed');
  });
});

describe('pollution and crime distress', () => {
  it('flags pollution for homes and shops but only crime for industry', () => {
    const polluted = { pollution: e.distressPollution };
    expect(distressed(tile({ zone: 'residential', ...polluted }))).toBe(true);
    expect(distressed(tile({ zone: 'commercial', ...polluted }))).toBe(true);
    expect(distressed(tile({ zone: 'industrial', ...polluted }))).toBe(false);
    expect(distressed(tile({ zone: 'industrial', crime: e.distressCrime }))).toBe(true);
    expect(distressed(tile({ zone: 'residential', pollution: e.distressPollution - 1 }))).toBe(
      false,
    );
  });

  it('makes polluted homes decline and eventually be abandoned', () => {
    const { state, tile: home } = lot('residential', {
      stage: 'developed',
      level: 3,
      pollution: 80,
      coverage: { ...noCoverage(), school: true },
    });
    let lowest = home.level;
    for (let d = 0; d < 2000 && home.stage === 'developed'; d++) {
      updateZones(state);
      lowest = Math.min(lowest, home.level);
    }
    expect(lowest).toBe(1);
    expect(home.stage).toBe('abandoned');
  });

  it('abandons crime-ridden industry but leaves smoky industry alone', () => {
    const smoky = lot('industrial', { stage: 'developed', level: 2, pollution: 100 }, 0);
    days(smoky.state, 500);
    expect(smoky.tile.stage).toBe('developed');
    expect(smoky.tile.level).toBe(2);

    // Stop at the first change: a serviced ruin is later cleared back to an empty lot.
    const crooked = lot('industrial', { stage: 'developed', level: 2, crime: 80 }, 0);
    for (let d = 0; d < 2000 && crooked.tile.stage === 'developed'; d++) {
      updateZones(crooked.state);
    }
    expect(crooked.tile.stage).toBe('abandoned');
  });
});
