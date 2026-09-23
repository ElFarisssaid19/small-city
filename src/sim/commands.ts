import { CONFIG } from './config';
import { clampTaxRate, commandCost } from './economy';
import { inBounds, linePoints, rectPoints, toIndex, toPoint } from './grid';
import { emptyTile } from './state';
import type { Point, SimState, Tile, ZoneType } from './types';

/** Everything the player can do to the map. The UI and input layers only ever send these. */
export type Command =
  | { type: 'placeRoad'; from: Point; to: Point }
  | { type: 'placePowerLine'; from: Point; to: Point }
  | { type: 'placeZone'; zone: ZoneType; from: Point; to: Point }
  | { type: 'placePowerPlant'; at: Point }
  | { type: 'bulldoze'; from: Point; to: Point }
  | { type: 'setTaxRate'; rate: number };

export interface PlanTile extends Point {
  /** False when something is in the way. */
  ok: boolean;
}

/** What a command would do, computed without changing anything; drives the ghost preview. */
export interface Plan {
  /** Tiles that would change (`ok`) or that block the command (`!ok`). */
  tiles: PlanTile[];
  /** Number of tiles that would change. */
  count: number;
  /** Money the command would spend. */
  cost: number;
  valid: boolean;
  /** Why the command cannot run, when it is not valid. */
  reason: string | null;
}

export interface CommandResult {
  ok: boolean;
  reason: string | null;
  plan: Plan;
}

type Verdict = 'build' | 'skip' | 'blocked';

function roadVerdict(tile: Tile): Verdict {
  if (tile.kind === 'road') return 'skip';
  // Building a road over a power line makes a crossing.
  return tile.kind === 'empty' || tile.kind === 'powerLine' ? 'build' : 'blocked';
}

function powerLineVerdict(tile: Tile): Verdict {
  if (tile.hasLine) return 'skip';
  return tile.kind === 'empty' || tile.kind === 'road' ? 'build' : 'blocked';
}

function zoneVerdict(tile: Tile, zone: ZoneType): Verdict {
  if (tile.kind === 'empty') return 'build';
  if (tile.kind !== 'zone') return 'blocked';
  if (tile.zone === zone) return 'skip';
  // Undeveloped lots can be rezoned; buildings must be bulldozed first.
  return tile.stage === 'empty' ? 'build' : 'blocked';
}

function makePlan(tiles: PlanTile[], reason: string | null): Plan {
  const count = tiles.filter((t) => t.ok).length;
  return { tiles, count, cost: 0, valid: reason === null, reason };
}

function tileAt(state: SimState, p: Point): Tile {
  return state.tiles[toIndex(state, p.x, p.y)];
}

/**
 * Roads and power lines are all-or-nothing: a line with a gap is useless.
 * Zones fill whatever tiles in the rectangle they can and skip the rest.
 */
function planPath(state: SimState, points: Point[], verdict: (tile: Tile) => Verdict): Plan {
  const tiles: PlanTile[] = [];
  let blocked = false;
  for (const p of points) {
    if (!inBounds(state, p.x, p.y)) continue;
    const v = verdict(tileAt(state, p));
    if (v === 'skip') continue;
    tiles.push({ ...p, ok: v === 'build' });
    blocked ||= v === 'blocked';
  }
  if (blocked) return makePlan(tiles, 'Something is in the way.');
  return makePlan(tiles, tiles.length === 0 ? 'Already built.' : null);
}

function planZone(state: SimState, zone: ZoneType, from: Point, to: Point): Plan {
  const tiles: PlanTile[] = [];
  for (const p of rectPoints(from, to)) {
    if (!inBounds(state, p.x, p.y)) continue;
    const v = zoneVerdict(tileAt(state, p), zone);
    if (v !== 'skip') tiles.push({ ...p, ok: v === 'build' });
  }
  const plan = makePlan(tiles, null);
  return plan.count > 0 ? plan : makePlan(tiles, 'Nothing to zone here.');
}

/** Top-left anchored footprint of a power plant. */
export function plantFootprint(at: Point): Point[] {
  const size = CONFIG.power.plantSize;
  return rectPoints(at, { x: at.x + size - 1, y: at.y + size - 1 });
}

function planPowerPlant(state: SimState, at: Point): Plan {
  const tiles: PlanTile[] = [];
  let fits = true;
  let blocked = false;
  for (const p of plantFootprint(at)) {
    if (!inBounds(state, p.x, p.y)) {
      fits = false;
      continue;
    }
    const ok = tileAt(state, p).kind === 'empty';
    tiles.push({ ...p, ok });
    blocked ||= !ok;
  }
  if (!fits) return makePlan(tiles, 'Does not fit on the map.');
  return makePlan(tiles, blocked ? 'Something is in the way.' : null);
}

function planBulldoze(state: SimState, from: Point, to: Point): Plan {
  const indices = new Set<number>();
  for (const p of rectPoints(from, to)) {
    if (!inBounds(state, p.x, p.y)) continue;
    const i = toIndex(state, p.x, p.y);
    const tile = state.tiles[i];
    if (tile.kind === 'empty') continue;
    if (tile.kind === 'powerPlant') {
      // Removing any part of a plant removes all of it.
      for (const q of plantFootprint(toPoint(state, tile.anchor))) {
        if (inBounds(state, q.x, q.y)) indices.add(toIndex(state, q.x, q.y));
      }
    } else {
      indices.add(i);
    }
  }
  const tiles = [...indices].sort((a, b) => a - b).map((i) => ({ ...toPoint(state, i), ok: true }));
  return makePlan(tiles, tiles.length === 0 ? 'Nothing to bulldoze.' : null);
}

/** Works out what a command would do and cost, without changing the state. */
export function planCommand(state: SimState, command: Command): Plan {
  const plan = planTiles(state, command);
  plan.cost = commandCost(command, plan.count);
  if (plan.valid && plan.cost > state.funds) {
    plan.valid = false;
    plan.reason = 'Not enough money.';
  }
  return plan;
}

function planTiles(state: SimState, command: Command): Plan {
  switch (command.type) {
    case 'placeRoad':
      return planPath(state, linePoints(command.from, command.to), roadVerdict);
    case 'placePowerLine':
      return planPath(state, linePoints(command.from, command.to), powerLineVerdict);
    case 'placeZone':
      return planZone(state, command.zone, command.from, command.to);
    case 'placePowerPlant':
      return planPowerPlant(state, command.at);
    case 'bulldoze':
      return planBulldoze(state, command.from, command.to);
    case 'setTaxRate':
      return makePlan([], null);
  }
}

function applyToTile(state: SimState, command: Command, p: Point): void {
  const i = toIndex(state, p.x, p.y);
  const tile = state.tiles[i];
  switch (command.type) {
    case 'placeRoad':
      state.tiles[i] = { ...emptyTile(), kind: 'road', hasLine: tile.hasLine };
      break;
    case 'placePowerLine':
      if (tile.kind === 'road') tile.hasLine = true;
      else state.tiles[i] = { ...emptyTile(), kind: 'powerLine', hasLine: true };
      break;
    case 'placeZone':
      state.tiles[i] = { ...emptyTile(), kind: 'zone', zone: command.zone };
      break;
    case 'placePowerPlant':
      state.tiles[i] = {
        ...emptyTile(),
        kind: 'powerPlant',
        anchor: toIndex(state, command.at.x, command.at.y),
      };
      break;
    case 'bulldoze':
      state.tiles[i] = emptyTile();
      break;
    case 'setTaxRate':
      break;
  }
}

/**
 * Applies a command and pays for it if its plan is valid and affordable.
 * Derived state (power, access…) is left to the caller.
 */
export function executeCommand(state: SimState, command: Command): CommandResult {
  const plan = planCommand(state, command);
  if (!plan.valid) return { ok: false, reason: plan.reason, plan };
  if (command.type === 'setTaxRate') state.taxRate = clampTaxRate(command.rate);
  for (const t of plan.tiles) if (t.ok) applyToTile(state, command, t);
  state.funds -= plan.cost;
  return { ok: true, reason: null, plan };
}
