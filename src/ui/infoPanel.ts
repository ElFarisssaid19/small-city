import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { CONFIG } from '../sim/config';
import { inspectTile } from '../sim/inspect';
import type { TileInfo } from '../sim/inspect';
import type { Point, SimState } from '../sim/types';
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
    const stage =
      tile.stage === 'empty'
        ? 'Empty lot'
        : tile.stage === 'construction'
          ? `Under construction (${tile.progress} d)`
          : tile.stage === 'abandoned'
            ? 'Abandoned'
            : `Level ${tile.level}`;
    rows.push(['Status', stage]);
    rows.push(['Power', yesNo(tile.powered)]);
    rows.push([
      'Road access',
      tile.roadAccess ? 'Yes' : `No (needs a road within ${CONFIG.zones.roadAccessRadius})`,
    ]);
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
  const list = el('dl', 'info-rows');
  const close = button('info-close', '×', () => bus.emit('tile:selected', null), 'Close');
  panel.append(close, heading, where, list);

  let selected: Point | null = null;
  let latest: Readonly<SimState> | null = null;

  const render = () => {
    const info = selected && latest ? inspectTile(latest, selected) : null;
    panel.hidden = info === null;
    if (!info || !latest) return;
    heading.textContent = titleOf(info);
    where.textContent = `Tile ${info.x}, ${info.y}`;
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
