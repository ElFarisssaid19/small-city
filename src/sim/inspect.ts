import { CONFIG } from './config';
import { inBounds, toIndex } from './grid';
import { jobCapacity, workforceOf } from './jobs';
import { roadPiece } from './roads';
import type { RoadShape } from './roads';
import type { Point, SimState, Tile } from './types';

/** Everything the info panel shows about one tile. */
export interface TileInfo extends Point {
  tile: Readonly<Tile>;
  roadShape: RoadShape | null;
  /** Jobs offered (commercial / industrial). */
  jobs: number;
  /** Residents looking for work (residential). */
  workforce: number;
  /** Power units supplied (power plants). */
  plantCapacity: number;
}

export function inspectTile(state: Readonly<SimState>, p: Point): TileInfo | null {
  if (!inBounds(state, p.x, p.y)) return null;
  const tile = state.tiles[toIndex(state, p.x, p.y)];
  return {
    x: p.x,
    y: p.y,
    tile,
    roadShape: tile.kind === 'road' ? roadPiece(state, p.x, p.y).shape : null,
    jobs: jobCapacity(tile),
    workforce: workforceOf(tile),
    plantCapacity: tile.kind === 'powerPlant' ? CONFIG.power.plantCapacity : 0,
  };
}
