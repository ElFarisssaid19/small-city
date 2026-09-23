import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { TOOLS } from '../game/tools';
import type { ToolId } from '../game/tools';
import { el } from './dom';
import { toolIcon } from './icons';

/** Bottom bar with one button per tool; mirrors the active tool from the bus. */
export function createToolbar(bus: EventBus<GameEvents>): HTMLElement {
  const bar = el('nav', 'panel toolbar');
  bar.setAttribute('aria-label', 'Tools');
  const buttons = new Map<ToolId, HTMLButtonElement>();

  for (const tool of TOOLS) {
    const btn = el('button', `tool tool-${tool.id}`);
    btn.type = 'button';
    btn.title = `${tool.label} (${tool.key})`;
    btn.innerHTML = toolIcon(tool.id);
    btn.append(el('span', 'tool-label', tool.label), el('kbd', 'tool-key', tool.key));
    btn.addEventListener('click', () => {
      bus.emit('tool:changed', tool.id);
      btn.blur();
    });
    buttons.set(tool.id, btn);
    bar.append(btn);
  }

  bus.on('tool:changed', (active) => {
    for (const [id, btn] of buttons) {
      btn.classList.toggle('active', id === active);
      btn.setAttribute('aria-pressed', String(id === active));
    }
  });
  return bar;
}
