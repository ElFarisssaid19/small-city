import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { isZoneTool } from '../game/tools';
import { PALETTE } from '../render/palette';
import { el } from './dom';

function swatch(hex: number, label: string): HTMLElement {
  const item = el('span', 'legend-item');
  const chip = el('span', 'legend-swatch');
  chip.style.background = `#${hex.toString(16).padStart(6, '0')}`;
  item.append(chip, el('span', '', label));
  return item;
}

/** Explains the placement guide's colours while a zone tool is selected. */
export function createPlacementLegend(bus: EventBus<GameEvents>): HTMLElement {
  const legend = el('div', 'panel placement-legend');
  legend.hidden = true;
  const { overlay } = PALETTE;
  legend.append(
    el('span', 'legend-title', 'Where zones grow'),
    swatch(overlay.road, 'Road within 3'),
    swatch(overlay.power, 'Power'),
    swatch(overlay.both, 'Both'),
  );
  bus.on('tool:changed', (tool) => {
    legend.hidden = !isZoneTool(tool);
  });
  return legend;
}
