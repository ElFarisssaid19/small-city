import type { EventBus } from '../core/events';
import { formatMoney } from '../core/format';
import type { GameEvents } from '../game/events';
import { budgetBreakdown } from '../sim/economy';
import { EXPENSE_KINDS, ZONE_TYPES } from '../sim/types';
import type { ExpenseKind, MonthlyBudget, SimState, ZoneType } from '../sim/types';
import { button, el } from './dom';

const INCOME_LABELS: Record<ZoneType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

const EXPENSE_LABELS: Record<ExpenseKind, string> = {
  roads: 'Roads',
  power: 'Power',
  police: 'Police',
  fire: 'Fire',
  school: 'Schools',
  park: 'Parks',
};

type Row = { label: string; now: number; last: number; kind?: 'total' | 'net' | 'heading' };

function rows(now: MonthlyBudget, last: MonthlyBudget): Row[] {
  return [
    { label: 'Income (taxes)', now: 0, last: 0, kind: 'heading' },
    ...ZONE_TYPES.map((z) => ({
      label: INCOME_LABELS[z],
      now: now.income[z],
      last: last.income[z],
    })),
    { label: 'Total income', now: now.taxes, last: last.taxes, kind: 'total' },
    { label: 'Expenses (upkeep)', now: 0, last: 0, kind: 'heading' },
    ...EXPENSE_KINDS.map((k) => ({
      label: EXPENSE_LABELS[k],
      now: -now.expenses[k],
      last: -last.expenses[k],
    })),
    { label: 'Total expenses', now: -now.upkeep, last: -last.upkeep, kind: 'total' },
    {
      label: 'Net',
      now: now.taxes - now.upkeep,
      last: last.taxes - last.upkeep,
      kind: 'net',
    },
  ];
}

/**
 * Money in and out: this month's projection at the city's current size and tax
 * rate, next to what was actually settled last month.
 */
export function createBudgetPanel(bus: EventBus<GameEvents>): HTMLElement {
  const panel = el('section', 'panel budget');
  panel.setAttribute('aria-label', 'Budget');
  panel.hidden = true;
  const close = button('info-close', '×', () => bus.emit('budget:toggle'), 'Close budget');
  const table = el('table', 'budget-table');
  const note = el('p', 'budget-note');
  panel.append(close, el('h2', 'info-title', 'Budget'), table, note);

  let latest: Readonly<SimState> | null = null;
  const render = () => {
    if (!latest || panel.hidden) return;
    const head = el('tr');
    head.append(el('th', '', ''), el('th', '', 'This month*'), el('th', '', 'Last month'));
    const body = rows(budgetBreakdown(latest), latest.lastBudget).map((row) => {
      const tr = el('tr', row.kind ?? '');
      if (row.kind === 'heading') {
        const cell = el('th', '', row.label);
        cell.colSpan = 3;
        tr.append(cell);
        return tr;
      }
      tr.append(
        el('td', '', row.label),
        el('td', '', formatMoney(row.now)),
        el('td', '', formatMoney(row.last)),
      );
      if (row.kind === 'net') tr.classList.toggle('negative', row.now < 0);
      return tr;
    });
    table.replaceChildren(head, ...body);
    note.textContent = `* Estimated at today's population and ${latest.taxRate}% tax. Settled on the 1st of each month.`;
  };

  bus.on('budget:toggle', () => {
    panel.hidden = !panel.hidden;
    render();
  });
  bus.on('sim:updated', (state) => {
    latest = state;
    render();
  });
  return panel;
}
