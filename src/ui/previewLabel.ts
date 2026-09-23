import type { EventBus } from '../core/events';
import type { GameEvents, PreviewInfo } from '../game/events';
import { TOOLS } from '../game/tools';
import type { ToolId } from '../game/tools';
import { formatMoney } from '../core/format';
import { el } from './dom';

const OFFSET_PX = 18;

/** Small label next to the pointer describing what the pending command would do. */
export function createPreviewLabel(bus: EventBus<GameEvents>): HTMLElement {
  const label = el('div', 'preview-label');
  label.hidden = true;
  let tool: ToolId = 'select';

  const show = (preview: PreviewInfo | null) => {
    if (!preview || tool === 'select') {
      label.hidden = true;
      return;
    }
    const { plan } = preview;
    const name = TOOLS.find((t) => t.id === tool)?.label ?? '';
    const summary = `${name} × ${plan.count} · ${formatMoney(plan.cost)}`;
    label.textContent = plan.valid ? summary : `${summary} — ${plan.reason ?? 'Not possible.'}`;
    label.classList.toggle('invalid', !plan.valid);
    label.hidden = false;
    // Keep the label on screen near the right and bottom edges.
    const x = Math.min(preview.clientX + OFFSET_PX, window.innerWidth - label.offsetWidth - 8);
    const y = Math.min(preview.clientY + OFFSET_PX, window.innerHeight - label.offsetHeight - 8);
    label.style.transform = `translate(${x}px, ${y}px)`;
  };

  bus.on('tool:changed', (next) => {
    tool = next;
  });
  bus.on('preview:changed', show);
  return label;
}
