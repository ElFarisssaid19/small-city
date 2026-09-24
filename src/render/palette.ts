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
  slab: 0x9a9d9f,
  abandoned: 0x5e544c,
  ghostOk: 0x3ddc84,
  ghostBad: 0xff4d4d,
  hover: 0xffffff,
  selection: 0xffe066,
  /** Rings of the floating "what is missing" icons. */
  requirement: {
    road: 0xff9f43,
    power: 0xffd21f,
    demand: 0x8fb3ff,
  },
  /** Service buildings: walls, a roof in the service's colour, and its badge. */
  services: {
    police: { wall: 0xdfe6ee, roof: 0x2f6fd6, badge: '#2f6fd6' },
    fire: { wall: 0xebe2d6, roof: 0xd6453a, badge: '#d6453a' },
    school: { wall: 0xf3e6c9, roof: 0xe8913a, badge: '#e8913a' },
    park: { wall: 0x6cbf57, roof: 0x3f9b4a, badge: '#3f9b4a' },
  },
  window: 0x3a4a5e,
  door: 0x4a4f57,
  playground: 0xc9b184,
  flame: [0xffd23f, 0xff8a1f, 0xff4d1a],
  smoke: 0x5d5d63,
  /** Placement guide shown while a zone tool is selected. */
  overlay: {
    road: 0x7fd6ff,
    power: 0xffd84d,
    both: 0x5dff8a,
  },
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
  /** Height of the scaffold that stands on a lot under construction. */
  scaffoldHeight: 0.42,
} as const;

export const ROAD = {
  width: 0.62,
  thickness: 0.02,
  markingWidth: 0.04,
} as const;
