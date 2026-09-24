import { CONFIG } from './config';
import { inBounds, rectPoints, toIndex, toPoint } from './grid';
import type { Point, SimState, Tile } from './types';

/** Side length of the building on a tile: power plants and some services span several tiles. */
export function buildingSize(tile: Readonly<Tile>): number {
  if (tile.kind === 'powerPlant') return CONFIG.power.plantSize;
  if (tile.kind === 'service' && tile.service) return CONFIG.services[tile.service].size;
  return 1;
}

/** Top-left anchored square footprint of `size` tiles. */
export function footprint(at: Point, size: number): Point[] {
  return rectPoints(at, { x: at.x + size - 1, y: at.y + size - 1 });
}

/** Indices of every in-bounds tile of the multi-tile building anchored at `anchor`. */
export function buildingTiles(state: Readonly<SimState>, anchor: number): number[] {
  const size = buildingSize(state.tiles[anchor]);
  return footprint(toPoint(state, anchor), size)
    .filter((p) => inBounds(state, p.x, p.y))
    .map((p) => toIndex(state, p.x, p.y));
}
