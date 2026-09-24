import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { OVERLAYS } from '../render/overlays';
import { button, el } from './dom';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Small key for the active data overlay: a colour ramp with its ends named, or swatches. */
export function createOverlayLegend(bus: EventBus<GameEvents>): HTMLElement {
  const legend = el('div', 'panel overlay-legend');
  legend.hidden = true;

  bus.on('overlay:changed', (id) => {
    const overlay = OVERLAYS.find((o) => o.id === id);
    legend.hidden = !overlay;
    if (!overlay) return;
    const body: HTMLElement[] = [el('strong', 'legend-title', overlay.label)];
    if (overlay.legend.kind === 'ramp') {
      const { stops, low, high } = overlay.legend;
      const bar = el('span', 'legend-ramp');
      bar.style.background = `linear-gradient(90deg, ${stops
        .map((s) => `${hex(s.color)} ${s.at}%`)
        .join(', ')})`;
      body.push(el('span', 'legend-end', low), bar, el('span', 'legend-end', high));
    } else {
      for (const item of overlay.legend.items) {
        const entry = el('span', 'legend-item');
        const chip = el('span', 'legend-swatch');
        chip.style.background = hex(item.color);
        entry.append(chip, el('span', '', item.label));
        body.push(entry);
      }
    }
    body.push(button('legend-close', '×', () => bus.emit('overlay:changed', null), 'Hide overlay'));
    legend.replaceChildren(...body);
  });
  return legend;
}
