import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { CONFIG } from '../sim/config';
import { inspectTile } from '../sim/inspect';
import type { TileInfo } from '../sim/inspect';
import type { Point, SimState, Tile, ZoneType } from '../sim/types';
import { missingRequirement, zoneChecklist } from '../sim/zones';
import type { Requirement } from '../sim/zones';
import { formatNumber } from '../core/format';
import { button, el } from './dom';

const ZONE_NAMES = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

function titleOf(info: TileInfo): string {
  const { tile } = info;
  switch (tile.kind) {
    case 'empty':
      return 'Empty land';
    case 'road':
      return tile.hasLine ? 'Road with power line' : 'Road';
    case 'powerLine':
      return 'Power line';
    case 'powerPlant':
      return 'Power plant';
    case 'zone':
      return `${tile.zone ? ZONE_NAMES[tile.zone] : ''} zone`;
  }
}

function stageOf(tile: Readonly<Tile>): string {
  switch (tile.stage) {
    case 'empty':
      return 'Empty lot';
    case 'construction':
      return `Under construction, ${tile.progress} day${tile.progress === 1 ? '' : 's'} left`;
    case 'developed':
      return `Level ${tile.level} of ${CONFIG.zones.maxLevel}`;
    case 'abandoned':
      return 'Abandoned';
  }
}

/** What the player can do about the first missing requirement. */
function adviceFor(requirement: Requirement, zone: ZoneType): string {
  switch (requirement) {
    case 'road':
      return `Build a road within ${CONFIG.zones.roadAccessRadius} tiles of this lot.`;
    case 'power':
      return 'Zones pass power to their neighbours: connect this one to a powered zone, a power plant or a power line. If the city is short of power, build another plant.';
    case 'demand':
      return zone === 'residential'
        ? 'Nobody wants to move in yet: add shops or industry for jobs, or lower taxes.'
        : `No demand for ${ZONE_NAMES[zone].toLowerCase()} yet: grow the population with residential zones, or lower taxes.`;
  }
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function rowsOf(info: TileInfo, state: Readonly<SimState>): [string, string][] {
  const { tile } = info;
  const rows: [string, string][] = [];
  if (info.roadShape) rows.push(['Shape', info.roadShape.replace(/([A-Z])/g, ' $1').toLowerCase()]);

  if (tile.kind === 'powerPlant') {
    rows.push(['Capacity', `${formatNumber(info.plantCapacity)} units`]);
    rows.push([
      'City usage',
      `${formatNumber(state.stats.powerDemand)} / ${formatNumber(state.stats.powerSupply)}`,
    ]);
  }
  if (tile.kind === 'powerLine' || tile.hasLine) rows.push(['Live', yesNo(tile.powered)]);

  if (tile.kind === 'zone') {
    if (tile.zone === 'residential') {
      rows.push(['Residents', formatNumber(tile.residents)]);
      rows.push(['Employed', `${formatNumber(tile.employed)} / ${formatNumber(info.workforce)}`]);
    } else {
      rows.push(['Jobs filled', `${formatNumber(tile.workers)} / ${formatNumber(info.jobs)}`]);
    }
    if (tile.neglect > 0) {
      rows.push(['Neglected', `${tile.neglect} / ${CONFIG.zones.abandonDays} days`]);
    }
  }
  return rows;
}

/** Floating card describing the selected tile; refreshes every simulation update. */
export function createInfoPanel(bus: EventBus<GameEvents>): HTMLElement {
  const panel = el('aside', 'panel info');
  panel.hidden = true;
  const heading = el('h2', 'info-title');
  const where = el('div', 'info-where');
  const stage = el('div', 'info-stage');
  const checklist = el('ul', 'checklist');
  checklist.setAttribute('aria-label', 'Requirements to grow');
  const advice = el('p', 'info-advice');
  const list = el('dl', 'info-rows');
  const close = button('info-close', '×', () => bus.emit('tile:selected', null), 'Close');
  panel.append(close, heading, where, stage, checklist, advice, list);

  const renderZone = (tile: Readonly<Tile>, state: Readonly<SimState>) => {
    const checks = zoneChecklist(state, tile);
    const zone = tile.zone;
    stage.hidden = checklist.hidden = !checks || !zone;
    advice.hidden = true;
    if (!checks || !zone) return;

    stage.textContent = stageOf(tile);
    const demand = Math.round(state.demand[zone] * 100);
    const items: [string, boolean, string][] = [
      [`Road within ${CONFIG.zones.roadAccessRadius} tiles`, checks.road, ''],
      ['Power', checks.power, ''],
      ['Demand', checks.demand, `${demand > 0 ? '+' : ''}${demand}%`],
    ];
    checklist.replaceChildren(
      ...items.map(([label, met, extra]) => {
        const item = el('li', met ? 'met' : 'unmet');
        item.append(
          el('span', 'check-mark', met ? '✓' : '✗'),
          el('span', 'visually-hidden', met ? 'Met: ' : 'Missing: '),
          el('span', 'check-label', label),
        );
        if (extra) item.append(el('span', 'check-extra', extra));
        return item;
      }),
    );
    const missing = missingRequirement(state, tile);
    if (missing) {
      advice.textContent = adviceFor(missing, zone);
      advice.hidden = false;
    }
  };

  let selected: Point | null = null;
  let latest: Readonly<SimState> | null = null;

  const render = () => {
    const info = selected && latest ? inspectTile(latest, selected) : null;
    panel.hidden = info === null;
    if (!info || !latest) return;
    heading.textContent = titleOf(info);
    where.textContent = `Tile ${info.x}, ${info.y}`;
    renderZone(info.tile, latest);
    list.replaceChildren(
      ...rowsOf(info, latest).flatMap(([label, value]) => [
        el('dt', '', label),
        el('dd', '', value),
      ]),
    );
  };

  bus.on('tile:selected', (tile) => {
    selected = tile;
    render();
  });
  bus.on('sim:updated', (state) => {
    latest = state;
    if (selected) render();
  });
  return panel;
}
