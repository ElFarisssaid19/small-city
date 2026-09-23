import type { EventBus } from '../core/events';
import { formatMoney } from '../core/format';
import type { GameEvents } from '../game/events';
import { el } from './dom';

/** Persistent banner while the city is in debt, when nothing can be built. */
export function createDebtWarning(bus: EventBus<GameEvents>): HTMLElement {
  const banner = el('div', 'debt-warning');
  banner.setAttribute('role', 'alert');
  banner.hidden = true;
  bus.on('sim:updated', (state) => {
    banner.hidden = state.funds >= 0;
    if (state.funds < 0) {
      banner.textContent = `In debt (${formatMoney(state.funds)}): building is blocked until taxes bring funds back above zero.`;
    }
  });
  return banner;
}
