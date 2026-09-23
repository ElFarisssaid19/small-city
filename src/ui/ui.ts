import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { createInfoPanel } from './infoPanel';
import { createNotices } from './notices';
import { createPreviewLabel } from './previewLabel';
import { createStatsBar } from './statsBar';
import { createToolbar } from './toolbar';

/** Builds the HTML overlay. Every widget talks to the rest of the game through the bus. */
export function createUI(root: HTMLElement, bus: EventBus<GameEvents>): void {
  root.append(
    createStatsBar(bus),
    createNotices(bus),
    createInfoPanel(bus),
    createToolbar(bus),
    createPreviewLabel(bus),
  );
}
