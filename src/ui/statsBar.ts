import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { CONFIG } from '../sim/config';
import { dateOf } from '../sim/time';
import { ZONE_TYPES } from '../sim/types';
import type { SimState, ZoneType } from '../sim/types';
import { formatMoney, formatNumber } from '../core/format';
import { button, el } from './dom';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SPEED_LABELS: Record<number, string> = { 0: '❚❚', 1: '1×', 2: '2×', 4: '4×' };

function stat(label: string): { root: HTMLElement; value: HTMLElement } {
  const root = el('div', 'stat');
  const value = el('span', 'stat-value', '–');
  root.append(el('span', 'stat-label', label), value);
  return { root, value };
}

/** RCI demand meter: one bar per zone, growing up for demand and down for surplus. */
function createDemandMeter(): { root: HTMLElement; update: (state: Readonly<SimState>) => void } {
  const root = el('div', 'demand');
  root.title = 'Demand for residential, commercial and industrial zones';
  const bars = new Map<ZoneType, HTMLElement>();
  for (const zone of ZONE_TYPES) {
    const column = el('div', `demand-col demand-${zone}`);
    const bar = el('div', 'demand-bar');
    column.append(bar, el('span', 'demand-letter', zone[0].toUpperCase()));
    bars.set(zone, bar);
    root.append(column);
  }
  return {
    root,
    update(state) {
      for (const [zone, bar] of bars) {
        const value = state.demand[zone];
        const size = Math.min(Math.abs(value), 1) * 50;
        bar.style.height = `${size}%`;
        bar.style.top = value >= 0 ? `${50 - size}%` : '50%';
        bar.classList.toggle('negative', value < 0);
      }
    },
  };
}

/** Top bar: title, date, city statistics, RCI demand and speed controls. */
export function createStatsBar(bus: EventBus<GameEvents>): HTMLElement {
  const bar = el('header', 'panel statsbar');

  const title = el('div', 'brand');
  const date = el('span', 'date', '');
  title.append(el('h1', 'title', 'Small City'), date);

  const funds = stat('Funds');
  const population = stat('Population');
  const jobs = stat('Jobs');
  const power = stat('Power');
  const stats = el('div', 'stats');
  stats.append(funds.root, population.root, jobs.root, power.root);

  // Tax rate: − value + ; sent to the simulation as a command like any other change.
  let taxRate: number = CONFIG.economy.taxRate.initial;
  const tax = el('div', 'tax');
  const taxValue = el('span', 'tax-value', '');
  const setTax = (rate: number) => bus.emit('command', { type: 'setTaxRate', rate });
  tax.append(
    el('span', 'stat-label', 'Tax'),
    button('tax-step', '−', () => setTax(taxRate - 1), 'Lower taxes'),
    taxValue,
    button('tax-step', '+', () => setTax(taxRate + 1), 'Raise taxes'),
  );

  const demand = createDemandMeter();

  const speeds = el('div', 'speeds');
  speeds.setAttribute('role', 'group');
  speeds.setAttribute('aria-label', 'Game speed');
  const speedButtons = new Map<number, HTMLButtonElement>();
  for (const speed of CONFIG.time.speeds) {
    const btn = button(
      'speed',
      SPEED_LABELS[speed] ?? `${speed}×`,
      () => bus.emit('speed:set', speed),
      speed === 0 ? 'Pause (Space)' : `Speed ${speed}×`,
    );
    speedButtons.set(speed, btn);
    speeds.append(btn);
  }

  bar.append(title, stats, tax, demand.root, speeds);

  bus.on('speed:changed', (active) => {
    for (const [speed, btn] of speedButtons) btn.classList.toggle('active', speed === active);
  });

  bus.on('sim:updated', (state) => {
    const d = dateOf(state.day);
    date.textContent = `Year ${d.year} · ${MONTHS[d.month - 1]} ${d.day}`;
    const s = state.stats;
    funds.value.textContent = formatMoney(state.funds);
    funds.root.classList.toggle('bad', state.funds < 0);
    const { taxes, upkeep } = state.lastBudget;
    funds.root.title = `Last month: taxes ${formatMoney(taxes)}, upkeep ${formatMoney(-upkeep)}`;
    taxRate = state.taxRate;
    taxValue.textContent = `${taxRate}%`;
    population.value.textContent = formatNumber(s.population);
    jobs.value.textContent = `${formatNumber(s.employed)} / ${formatNumber(s.jobs)}`;
    jobs.root.title = `${formatNumber(s.employed)} employed of ${formatNumber(s.workforce)} workers; ${formatNumber(s.jobs)} jobs`;
    power.value.textContent = `${formatNumber(s.powerDemand)} / ${formatNumber(s.powerSupply)}`;
    power.root.title = 'Power used / plant capacity';
    power.root.classList.toggle('warn', s.powerDemand > s.powerSupply);
    demand.update(state);
  });

  return bar;
}
