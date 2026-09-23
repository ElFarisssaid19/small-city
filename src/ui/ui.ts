import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { createDebtWarning } from './debtWarning';
import { el } from './dom';
import { createInfoPanel } from './infoPanel';
import { createNotices } from './notices';
import { createPreviewLabel } from './previewLabel';
import { createStatsBar } from './statsBar';
import { createToolbar } from './toolbar';

/** Builds the HTML overlay. Every widget talks to the rest of the game through the bus. */
export function createUI(root: HTMLElement, bus: EventBus<GameEvents>): void {
  // The top column stacks alerts under the stats bar so they never overlap it.
  const top = el('div', 'hud-top');
  top.append(createStatsBar(bus), createDebtWarning(bus), createNotices(bus));
  root.append(top, createInfoPanel(bus), createToolbar(bus), createPreviewLabel(bus));
}
