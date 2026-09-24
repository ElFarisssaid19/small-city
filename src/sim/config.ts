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
    /**
     * How land value, pollution, crime and schools shape growth. Residential
     * appeal (a multiplier on growth and upgrade chances) is
     * clamp(appealBase + landValue / appealLandValue, appealMin, appealMax) × (1 − pollution / 100).
     */
    effects: {
      appealBase: 0.4,
      appealLandValue: 60,
      appealMin: 0.1,
      appealMax: 1.5,
      /** Homes above this level need school coverage. */
      schoolFreeMaxLevel: 2,
      /** Land value a commercial building needs for each level (index = level). */
      commercialLandValue: [0, 0, 35, 60],
      /** Industry's growth chances shrink by crime / industrialCrimeTolerance. */
      industrialCrimeTolerance: 120,
      /** Pollution (homes, shops) or crime (all zones) at or above which buildings decline. */
      distressPollution: 60,
      distressCrime: 55,
      /** Daily chance that a distressed level-1 building is abandoned. */
      distressAbandonChance: 0.02,
    },
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
    /** Tax rate (percent) that neither helps nor hurts demand. */
    neutralTaxRate: 9,
    /** Demand change per percentage point of tax above or below neutral. */
    taxSensitivity: 0.05,
  },

  /**
   * City services. `size` is the square footprint in tiles, `cost` the build
   * price, `upkeep` the monthly cost, `radius` the Manhattan reach of its
   * coverage, and `power` the units it draws. Parks need neither road nor power.
   */
  services: {
    police: { size: 1, cost: 500, upkeep: 60, radius: 8, power: 3 },
    fire: { size: 1, cost: 500, upkeep: 60, radius: 8, power: 3 },
    school: { size: 2, cost: 1500, upkeep: 120, radius: 10, power: 6 },
    park: { size: 1, cost: 150, upkeep: 10, radius: 4, power: 0 },
  },

  disasters: {
    /** Daily chance that a building outside fire coverage catches fire. */
    fireChance: 0.0002,
    /** Days a fire burns before the building is lost. */
    burnDays: 4,
  },

  environment: {
    pollution: {
      /** Manhattan distance pollution reaches; it fades linearly to zero just beyond it. */
      radius: 6,
      /** Emitted by an industrial building, indexed by level. */
      industrial: [0, 5, 8, 12],
      /** Emitted by each tile of a power plant. */
      powerPlant: 14,
      /** Removed at a park, fading to nothing just beyond the park's radius. */
      parkCleanup: 30,
    },
    crime: {
      /** Manhattan distance over which people nearby add to a tile's crime. */
      radius: 3,
      /** Crime per resident or shop worker nearby (weighted by distance), before policing. */
      perPerson: 0.13,
      /** Share of crime left where police cover. */
      policeFactor: 0.35,
    },
    landValue: {
      base: 40,
      /** Added for each service covering the tile. */
      bonus: { police: 10, fire: 10, school: 15, park: 20 },
      /** Land value lost per point of pollution and of crime. */
      pollutionWeight: 0.6,
      crimeWeight: 0.4,
    },
  },

  economy: {
    startingFunds: 20000,
    /** One-off build cost per tile, except power plants which cost this per plant. */
    costs: {
      road: 10,
      powerLine: 5,
      residential: 20,
      commercial: 20,
      industrial: 20,
      powerPlant: 3000,
      bulldoze: 5,
    },
    /** Monthly upkeep per tile, except power plants which cost this per plant. */
    upkeep: {
      road: 2,
      powerLine: 1,
      powerPlant: 150,
    },
    /** Tax rate in percent. */
    taxRate: {
      initial: 9,
      min: 0,
      max: 20,
    },
    /** Monthly taxable income per resident or worker; the city collects `taxRate` percent of it. */
    income: {
      residential: 10,
      commercial: 12,
      industrial: 10,
    },
  },

  save: {
    /** Bump when the save format changes and add a migration in save.ts. */
    version: 2,
    autosaveDays: 30,
  },
} as const;

export type Config = typeof CONFIG;
