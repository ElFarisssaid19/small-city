import type { Point, SimState } from './types';

/** Direction bits used by road and power-line masks, clockwise from north (−y). */
export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;

export const DIRECTIONS = [
  { bit: NORTH, dx: 0, dy: -1 },
  { bit: EAST, dx: 1, dy: 0 },
  { bit: SOUTH, dx: 0, dy: 1 },
  { bit: WEST, dx: -1, dy: 0 },
] as const;

type Size = Pick<SimState, 'width' | 'height'>;

export function inBounds(size: Size, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size.width && y < size.height;
}

export function toIndex(size: Size, x: number, y: number): number {
  return y * size.width + x;
}

export function toPoint(size: Size, index: number): Point {
  return { x: index % size.width, y: Math.floor(index / size.width) };
}

/** Calls `visit` with the index of each in-bounds orthogonal neighbour. */
export function forEachNeighbour(
  size: Size,
  index: number,
  visit: (neighbour: number) => void,
): void {
  const x = index % size.width;
  const y = (index - x) / size.width;
  if (y > 0) visit(index - size.width);
  if (x < size.width - 1) visit(index + 1);
  if (y < size.height - 1) visit(index + size.width);
  if (x > 0) visit(index - 1);
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Clamps a point into the map. */
export function clampPoint(size: Size, p: Point): Point {
  return {
    x: Math.min(Math.max(p.x, 0), size.width - 1),
    y: Math.min(Math.max(p.y, 0), size.height - 1),
  };
}

/** Every point in the rectangle spanned by two corners, row by row. */
export function rectPoints(a: Point, b: Point): Point[] {
  const points: Point[] = [];
  const [x0, x1] = a.x <= b.x ? [a.x, b.x] : [b.x, a.x];
  const [y0, y1] = a.y <= b.y ? [a.y, b.y] : [b.y, a.y];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) points.push({ x, y });
  return points;
}

/** Inclusive run of integers from `from` to `to`, in either direction. */
function span(from: number, to: number): number[] {
  const step = to >= from ? 1 : -1;
  const values: number[] = [];
  for (let v = from; v !== to + step; v += step) values.push(v);
  return values;
}

/**
 * An L-shaped path from `a` to `b`: along the longer axis first, then the other.
 * A drag along a single row or column gives a straight line.
 */
export function linePoints(a: Point, b: Point): Point[] {
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    return [
      ...span(a.x, b.x).map((x) => ({ x, y: a.y })),
      ...span(a.y, b.y)
        .slice(1)
        .map((y) => ({ x: b.x, y })),
    ];
  }
  return [
    ...span(a.y, b.y).map((y) => ({ x: a.x, y })),
    ...span(a.x, b.x)
      .slice(1)
      .map((x) => ({ x, y: b.y })),
  ];
}
