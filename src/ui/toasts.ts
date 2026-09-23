import type { EventBus } from '../core/events';
import type { GameEvents, Toast, ToastKind } from '../game/events';
import { el } from './dom';

const VISIBLE_MS = 3000;
const MAX_VISIBLE = 3;

const ICONS: Record<ToastKind, string> = {
  info: 'M12 8h.01M11 12h1v5h1',
  success: 'M7 12.5l3.2 3.2L17 9',
  warning: 'M12 8v5M12 16.5h.01',
  error: 'M9 9l6 6M15 9l-6 6',
};

const LABELS: Record<ToastKind, string> = {
  info: 'Info',
  success: 'Done',
  warning: 'Warning',
  error: 'Error',
};

interface ActiveToast {
  node: HTMLElement;
  count: HTMLElement;
  repeats: number;
  timer: number;
}

function icon(kind: ToastKind): string {
  const shape =
    kind === 'warning'
      ? '<path class="toast-shape" d="M12 3 22 20H2z"/>'
      : '<circle class="toast-shape" cx="12" cy="12" r="10"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${shape}<path d="${ICONS[kind]}"/></svg>`;
}

/**
 * Non-blocking messages stacked in the top-right corner. Each fades after a few
 * seconds (paused while hovered); at most three show at once, and repeating a
 * visible message bumps a counter instead of stacking duplicates.
 */
export function createToasts(bus: EventBus<GameEvents>): HTMLElement {
  const stack = el('section', 'toasts');
  stack.setAttribute('aria-label', 'Notifications');
  const active = new Map<string, ActiveToast>();

  const dismiss = (key: string) => {
    const toast = active.get(key);
    if (!toast) return;
    window.clearTimeout(toast.timer);
    active.delete(key);
    toast.node.classList.add('leaving');
    window.setTimeout(() => toast.node.remove(), 180);
  };

  const schedule = (key: string, toast: ActiveToast) => {
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => dismiss(key), VISIBLE_MS);
  };

  const show = ({ message, kind }: Toast) => {
    const key = `${kind}:${message}`;
    const existing = active.get(key);
    if (existing) {
      existing.repeats++;
      existing.count.textContent = `×${existing.repeats}`;
      existing.count.hidden = false;
      schedule(key, existing);
      return;
    }

    const node = el('div', `toast toast-${kind}`);
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    node.innerHTML = icon(kind);
    const text = el('p', 'toast-message', message);
    text.prepend(el('span', 'visually-hidden', `${LABELS[kind]}: `));
    const count = el('span', 'toast-count');
    count.hidden = true;
    const close = el('button', 'toast-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', () => dismiss(key));
    node.append(text, count, close);

    const toast: ActiveToast = { node, count, repeats: 1, timer: 0 };
    node.addEventListener('pointerenter', () => window.clearTimeout(toast.timer));
    node.addEventListener('pointerleave', () => schedule(key, toast));
    active.set(key, toast);
    stack.append(node);
    schedule(key, toast);

    // Drop the oldest once more than the maximum are showing.
    while (active.size > MAX_VISIBLE) dismiss(active.keys().next().value as string);
  };

  bus.on('toast', show);
  bus.on('command:rejected', ({ reason, problem }) =>
    show({ message: reason, kind: problem === 'notEnoughMoney' ? 'error' : 'warning' }),
  );
  return stack;
}
