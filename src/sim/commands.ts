import { buildingTiles, footprint } from './buildings';
import { CONFIG } from './config';
import { clampTaxRate, commandCost } from './economy';
import { inBounds, linePoints, rectPoints, toIndex, toPoint } from './grid';
import { emptyTile } from './state';
import type { Point, ServiceType, SimState, Tile, ZoneType } from './types';

/** Everything the player can do to the map. The UI and input layers only ever send these. */
export type Command =
  | { type: 'placeRoad'; from: Point; to: Point }
  | { type: 'placePowerLine'; from: Point; to: Point }
  | { type: 'placeZone'; zone: ZoneType; from: Point; to: Point }
  | { type: 'placePowerPlant'; at: Point }
  | { type: 'placeService'; service: ServiceType; at: Point }
  | { type: 'bulldoze'; from: Point; to: Point }
  | { type: 'setTaxRate'; rate: number }
  | { type: 'setDisasters'; enabled: boolean };

export interface PlanTile extends Point {
  /** False when something is in the way. */
  ok: boolean;
}

/** Why a command cannot run, for callers that react differently to each case. */
export type PlanProblem = 'blocked' | 'outOfBounds' | 'nothingToDo' | 'notEnoughMoney';

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
  problem: PlanProblem | null;
  /** The same, as a sentence for the player. */
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

function makePlan(tiles: PlanTile[], problem: PlanProblem | null = null, reason = ''): Plan {
  const count = tiles.filter((t) => t.ok).length;
  return { tiles, count, cost: 0, valid: problem === null, problem, reason: problem && reason };
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
  if (blocked) return makePlan(tiles, 'blocked', 'Something is in the way.');
  if (tiles.length === 0) return makePlan(tiles, 'nothingToDo', 'Already built.');
  return makePlan(tiles);
}

function planZone(state: SimState, zone: ZoneType, from: Point, to: Point): Plan {
  const tiles: PlanTile[] = [];
  for (const p of rectPoints(from, to)) {
    if (!inBounds(state, p.x, p.y)) continue;
    const v = zoneVerdict(tileAt(state, p), zone);
    if (v !== 'skip') tiles.push({ ...p, ok: v === 'build' });
  }
  const plan = makePlan(tiles);
  return plan.count > 0 ? plan : makePlan(tiles, 'nothingToDo', 'Nothing to zone here.');
}

/** A multi-tile building anchored at its top-left tile: every tile must be free land on the map. */
function planBuilding(state: SimState, at: Point, size: number): Plan {
  const tiles: PlanTile[] = [];
  let fits = true;
  let blocked = false;
  for (const p of footprint(at, size)) {
    if (!inBounds(state, p.x, p.y)) {
      fits = false;
      continue;
    }
    const ok = tileAt(state, p).kind === 'empty';
    tiles.push({ ...p, ok });
    blocked ||= !ok;
  }
  if (!fits) return makePlan(tiles, 'outOfBounds', 'Does not fit on the map.');
  if (blocked) return makePlan(tiles, 'blocked', 'Something is in the way.');
  return makePlan(tiles);
}

function planBulldoze(state: SimState, from: Point, to: Point): Plan {
  const indices = new Set<number>();
  for (const p of rectPoints(from, to)) {
    if (!inBounds(state, p.x, p.y)) continue;
    const i = toIndex(state, p.x, p.y);
    const tile = state.tiles[i];
    if (tile.kind === 'empty') continue;
    if (tile.kind === 'powerPlant' || tile.kind === 'service') {
      // Removing any part of a multi-tile building removes all of it.
      for (const j of buildingTiles(state, tile.anchor)) indices.add(j);
    } else {
      indices.add(i);
    }
  }
  const tiles = [...indices].sort((a, b) => a - b).map((i) => ({ ...toPoint(state, i), ok: true }));
  if (tiles.length === 0) return makePlan(tiles, 'nothingToDo', 'Nothing to bulldoze.');
  return makePlan(tiles);
}

/** Works out what a command would do and cost, without changing the state. */
export function planCommand(state: SimState, command: Command): Plan {
  const plan = planTiles(state, command);
  plan.cost = commandCost(command, plan.count);
  // Free commands (like changing taxes) stay possible while in debt.
  if (plan.valid && plan.cost > 0 && plan.cost > state.funds) {
    plan.valid = false;
    plan.problem = 'notEnoughMoney';
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
      return planBuilding(state, command.at, CONFIG.power.plantSize);
    case 'placeService':
      return planBuilding(state, command.at, CONFIG.services[command.service].size);
    case 'bulldoze':
      return planBulldoze(state, command.from, command.to);
    case 'setTaxRate':
    case 'setDisasters':
      return makePlan([]);
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
    case 'placeService':
      state.tiles[i] = {
        ...emptyTile(),
        kind: 'service',
        service: command.service,
        anchor: toIndex(state, command.at.x, command.at.y),
      };
      break;
    case 'bulldoze':
      state.tiles[i] = emptyTile();
      break;
    case 'setTaxRate':
    case 'setDisasters':
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
  if (command.type === 'setDisasters') {
    state.disasters = command.enabled;
    // Turning disasters off puts out fires that are already burning.
    if (!command.enabled) for (const tile of state.tiles) tile.fire = 0;
  }
  for (const t of plan.tiles) if (t.ok) applyToTile(state, command, t);
  state.funds -= plan.cost;
  return { ok: true, reason: null, plan };
}
