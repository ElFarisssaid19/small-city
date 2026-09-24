import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { CONFIG } from '../sim/config';
import { inspectTile } from '../sim/inspect';
import type { TileInfo } from '../sim/inspect';
import type { Point, SimState, Tile, ZoneType } from '../sim/types';
import { SERVICE_TYPES } from '../sim/types';
import { levelLimit, missingRequirement, zoneChecklist } from '../sim/zones';
import type { Requirement } from '../sim/zones';
import { formatNumber } from '../core/format';
import { button, el } from './dom';

const ZONE_NAMES = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

const SERVICE_NAMES = {
  police: 'Police station',
  fire: 'Fire station',
  school: 'School',
  park: 'Park',
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
    case 'service':
      return tile.service ? SERVICE_NAMES[tile.service] : 'Service';
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

  if (info.service && tile.service) {
    const missing = missingRequirement(state, state.tiles[tile.anchor]);
    rows.push([
      'Working',
      info.service.active ? 'Yes' : `No: needs ${missing === 'road' ? 'a road nearby' : 'power'}`,
    ]);
    rows.push(['Reach', `${info.service.radius} tiles`]);
    rows.push(['Upkeep', `$${CONFIG.services[tile.service].upkeep}/month`]);
  }

  if (tile.fire > 0) rows.push(['On fire', `${tile.fire} day${tile.fire === 1 ? '' : 's'} left`]);

  if (tile.kind === 'zone') {
    const limit = levelLimit(tile);
    if (limit.needs === 'school') rows.push(['Max level', `${limit.cap} (level 3 needs a school)`]);
    if (limit.needs === 'landValue') {
      rows.push(['Max level', `${limit.cap} (next needs land value ${limit.landValue})`]);
    }
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
  const area = el('dl', 'info-rows info-area');
  const close = button('info-close', '×', () => bus.emit('tile:selected', null), 'Close');
  panel.append(close, heading, where, stage, checklist, advice, list, area);

  /** Land value, pollution, crime as small meters, then which services reach the tile. */
  const renderArea = (tile: Readonly<Tile>) => {
    const meter = (label: string, value: number, tone: 'good' | 'bad') => {
      const dd = el('dd', 'meter-row');
      const bar = el('span', `meter meter-${tone}`);
      const fill = el('span', 'meter-fill');
      fill.style.width = `${value}%`;
      bar.append(fill);
      dd.append(bar, el('span', 'meter-value', String(value)));
      return [el('dt', '', label), dd];
    };
    const covered = SERVICE_TYPES.map(
      (s) => `${SERVICE_NAMES[s].split(' ')[0]} ${tile.coverage[s] ? '✓' : '✗'}`,
    );
    area.replaceChildren(
      ...meter('Land value', tile.landValue, 'good'),
      ...meter('Pollution', tile.pollution, 'bad'),
      ...meter('Crime', tile.crime, 'bad'),
      el('dt', '', 'Covered by'),
      el('dd', 'coverage-list', covered.join(' · ')),
    );
  };

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
    renderArea(info.tile);
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
