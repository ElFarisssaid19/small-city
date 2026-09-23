/**
 * Every gameplay tuning number lives here. Visual-only constants (colours,
 * heights, camera limits) live next to the code that draws them in src/render.
 */
export const CONFIG = {
  map: {
    width: 32,
    height: 32,
  },

  time: {
    /** Real milliseconds per game day at 1x speed. */
    msPerDay: 1000,
    daysPerMonth: 30,
    monthsPerYear: 12,
    /** Selectable speed multipliers; 0 is paused. */
    speeds: [0, 1, 2, 4],
    maxTicksPerFrame: 8,
    maxFrameMs: 250,
  },

  power: {
    /** Power plants are square; this is their side length in tiles. */
    plantSize: 2,
    /** Power units one plant supplies. */
    plantCapacity: 300,
    /**
     * Power units a building draws, indexed by level (0 = construction site).
     * Empty lots and abandoned buildings draw nothing.
     */
    zoneConsumption: [1, 2, 3, 5],
  },

  zones: {
    /** A zone needs a road within this Manhattan distance to develop. */
    roadAccessRadius: 3,
    constructionDays: 3,
    maxLevel: 3,
    /** Daily chance at full demand that a serviced empty lot starts building. */
    growthChance: 0.15,
    /** Daily chance at full demand that a developed building gains a level. */
    upgradeChance: 0.04,
    /** Demand needed before buildings upgrade. */
    upgradeMinDemand: 0.1,
    /** Daily chance that a building loses a level while demand is below `declineDemand`. */
    declineChance: 0.03,
    declineDemand: -0.5,
    /** Days without power or road access before a building is abandoned. */
    abandonDays: 20,
    /** Daily chance that an abandoned building with service again is cleared to an empty lot. */
    recoverChance: 0.1,
    /** Residents (R) or jobs (C, I) per building, indexed by level. */
    capacity: {
      residential: [0, 6, 16, 36],
      commercial: [0, 3, 8, 18],
      industrial: [0, 5, 12, 26],
    },
  },

  population: {
    /** Share of residents who look for work. */
    workforceRatio: 0.6,
  },

  jobs: {
    /** Maximum Manhattan distance between a home and a workplace. */
    commuteRadius: 12,
    /** Cell size of the spatial index used to find nearby workplaces. */
    bucketSize: 8,
  },

  demand: {
    /** Baseline demand that lets an empty town get started, in residents or jobs. */
    baseResidential: 24,
    baseCommercial: 4,
    baseIndustrial: 8,
    /** Jobs the city wants per resident. Together they slightly exceed the workforce ratio. */
    commercialJobsPerResident: 0.25,
    industrialJobsPerResident: 0.42,
    /** Fraction of the gap between current and target demand closed each day. */
    smoothing: 0.2,
  },
} as const;

export type Config = typeof CONFIG;
