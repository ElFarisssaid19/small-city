import type { ZoneType } from '../sim/types';

/** Placeholder look of the city: colours and proportions only, no gameplay numbers. */
export const PALETTE = {
  sky: 0xa9cfe8,
  ground: 0x77a95a,
  grid: 0x1e3a14,
  gridOpacity: 0.16,
  asphalt: 0x44484f,
  roadMarking: 0xe9e3c9,
  pole: 0x7a5a3c,
  wire: 0x2a2a2a,
  plant: 0xa3abb5,
  chimney: 0x6b727b,
  lot: {
    residential: 0x9bd88c,
    commercial: 0x92bdf0,
    industrial: 0xf0d27a,
  } satisfies Record<ZoneType, number>,
  /** Building colour per zone, indexed by level − 1. */
  building: {
    residential: [0x5fb85a, 0x3f9d4a, 0x2c7d3b],
    commercial: [0x4f95e0, 0x3576c8, 0x2459a6],
    industrial: [0xe4b23c, 0xd0922a, 0xae7420],
  } satisfies Record<ZoneType, number[]>,
  construction: 0xd9893b,
  abandoned: 0x5e544c,
  ghostOk: 0x3ddc84,
  ghostBad: 0xff4d4d,
  hover: 0xffffff,
  selection: 0xffe066,
  unpowered: 0xffd21f,
} as const;

/** Building proportions per zone, indexed by level − 1. */
export const BUILDING = {
  height: {
    residential: [0.35, 0.8, 1.5],
    commercial: [0.45, 1.1, 2.1],
    industrial: [0.45, 0.75, 1.05],
  } satisfies Record<ZoneType, number[]>,
  footprint: {
    residential: [0.6, 0.72, 0.78],
    commercial: [0.7, 0.78, 0.82],
    industrial: [0.8, 0.86, 0.9],
  } satisfies Record<ZoneType, number[]>,
  constructionHeight: 0.18,
} as const;

export const ROAD = {
  width: 0.62,
  thickness: 0.02,
  markingWidth: 0.04,
} as const;
