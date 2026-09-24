import type { RoadShape } from '../../sim/roads';
import type { ZoneType } from '../../sim/types';

/**
 * Which Kenney City Kit model (CC0, kenney.nl) draws what. Ids are
 * `<kit>/<file>` and map to `public/models/<kit>/<file>.glb`.
 */

/** Building variants per zone, indexed by level − 1; bigger kit pieces at higher levels. */
export const BUILDING_MODELS: Record<ZoneType, readonly (readonly string[])[]> = {
  residential: [
    ['suburban/building-type-h', 'suburban/building-type-i', 'suburban/building-type-m'],
    ['suburban/building-type-c', 'suburban/building-type-e', 'suburban/building-type-o'],
    ['suburban/building-type-k', 'suburban/building-type-r', 'suburban/building-type-l'],
  ],
  commercial: [
    ['commercial/building-c', 'commercial/building-a', 'commercial/building-h'],
    ['commercial/building-f', 'commercial/building-g', 'commercial/building-l'],
    [
      'commercial/building-skyscraper-a',
      'commercial/building-skyscraper-c',
      'commercial/building-skyscraper-e',
    ],
  ],
  industrial: [
    ['industrial/building-h', 'industrial/building-i', 'industrial/building-k'],
    ['industrial/building-b', 'industrial/building-g', 'industrial/building-o'],
    ['industrial/building-n', 'industrial/building-e', 'industrial/building-f'],
  ],
};

/**
 * Road piece per auto-shape, with the sim rotation (quarter turns clockwise
 * from the shape's base orientation, see sim/roads.ts) the model has as authored.
 */
export const ROAD_MODELS: Record<RoadShape, { model: string; rotation: 0 | 1 | 2 | 3 }> = {
  isolated: { model: 'roads/road-square', rotation: 0 },
  deadEnd: { model: 'roads/road-end-round', rotation: 1 }, // open to the east
  straight: { model: 'roads/road-straight', rotation: 1 }, // runs east–west
  corner: { model: 'roads/road-bend', rotation: 2 }, // joins south and west
  tee: { model: 'roads/road-intersection', rotation: 1 }, // joins east, south and west
  cross: { model: 'roads/road-crossroad', rotation: 0 },
};

export const POLE_MODEL = 'roads/electricity-pole-single';

/** A 2×2 power plant assembled from kit parts: a hall and two cooling towers. */
export const PLANT_PARTS: readonly {
  model: string;
  /** Offset from the plant centre, in tiles. */
  x: number;
  z: number;
  /** Width the part is scaled to, in tiles. */
  width: number;
}[] = [
  { model: 'industrial/building-a', x: 0, z: 0.45, width: 1.8 },
  { model: 'industrial/chimney-large', x: -0.48, z: -0.5, width: 0.82 },
  { model: 'industrial/chimney-large', x: 0.48, z: -0.5, width: 0.82 },
];

/** Every model the game uses, loaded once before it starts. */
export function allModelIds(): string[] {
  const ids = new Set<string>([POLE_MODEL]);
  for (const levels of Object.values(BUILDING_MODELS)) {
    for (const level of levels) level.forEach((id) => ids.add(id));
  }
  for (const { model } of Object.values(ROAD_MODELS)) ids.add(model);
  for (const { model } of PLANT_PARTS) ids.add(model);
  return [...ids];
}
