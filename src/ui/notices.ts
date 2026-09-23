import type { EventBus } from '../core/events';
import type { GameEvents, NoticeTone } from '../game/events';
import { el } from './dom';

const VISIBLE_MS = 3500;
const MAX_NOTICES = 4;

/** Stack of short-lived messages; repeating a visible message only extends it. */
export function createNotices(bus: EventBus<GameEvents>): HTMLElement {
  const stack = el('div', 'notices');
  stack.setAttribute('role', 'status');
  stack.setAttribute('aria-live', 'polite');
  const timers = new Map<string, { node: HTMLElement; timer: number }>();

  const show = (message: string, tone: NoticeTone) => {
    const existing = timers.get(message);
    if (existing) window.clearTimeout(existing.timer);
    const node = existing?.node ?? el('div', `notice notice-${tone}`, message);
    if (!existing) stack.append(node);
    const timer = window.setTimeout(() => {
      node.remove();
      timers.delete(message);
    }, VISIBLE_MS);
    timers.set(message, { node, timer });
    while (stack.children.length > MAX_NOTICES) {
      const oldest = stack.firstElementChild as HTMLElement;
      timers.delete(oldest.textContent);
      oldest.remove();
    }
  };

  bus.on('notice', ({ message, tone }) => show(message, tone));
  bus.on('command:rejected', ({ reason }) => show(reason, 'error'));
  return stack;
}
