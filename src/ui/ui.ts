import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { createDebtWarning } from './debtWarning';
import { el } from './dom';
import { createInfoPanel } from './infoPanel';
import { Modal } from './modal';
import { createPreviewLabel } from './previewLabel';
import { createStatsBar } from './statsBar';
import { createToasts } from './toasts';
import { createToolbar } from './toolbar';

/** Builds the HTML overlay. Every widget talks to the rest of the game through the bus. */
export function createUI(root: HTMLElement, bus: EventBus<GameEvents>): void {
  const modal = new Modal();
  document.body.append(modal.element);

  // The top column stacks alerts under the stats bar so they never overlap it.
  const top = el('div', 'hud-top');
  top.append(createStatsBar(bus, modal), createDebtWarning(bus));
  root.append(
    top,
    createToasts(bus),
    createInfoPanel(bus),
    createToolbar(bus),
    createPreviewLabel(bus),
  );

  // Toasts sit just below the top column (stats bar and debt banner), whose height
  // changes as the bar wraps on small screens or the banner comes and goes.
  new ResizeObserver(() => {
    const bottom = Math.ceil(top.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--hud-top-bottom', `${bottom}px`);
  }).observe(top);
}
