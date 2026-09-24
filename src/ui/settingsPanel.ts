import type { EventBus } from '../core/events';
import type { GameEvents } from '../game/events';
import { button, el } from './dom';

function toggle(label: string, hint: string, onClick: () => void): HTMLButtonElement {
  const btn = button('setting', '', onClick);
  btn.setAttribute('role', 'switch');
  btn.append(
    el('span', 'setting-text', label),
    el('span', 'setting-hint', hint),
    el('span', 'switch'),
  );
  return btn;
}

/**
 * Game settings: disasters (a simulation setting, changed by command) and low
 * quality graphics (a rendering setting, remembered on this device).
 */
export function createSettingsPanel(bus: EventBus<GameEvents>): HTMLElement {
  const panel = el('section', 'panel settings');
  panel.setAttribute('aria-label', 'Settings');
  panel.hidden = true;

  let disasters = true;
  let lowQuality = false;
  const disastersToggle = toggle('Disasters', 'Random fires outside fire station cover', () =>
    bus.emit('command', { type: 'setDisasters', enabled: !disasters }),
  );
  const qualityToggle = toggle('Low quality', 'No shadows, lower resolution: for weak phones', () =>
    bus.emit('settings:lowQuality', !lowQuality),
  );
  const close = button('info-close', '×', () => bus.emit('settings:toggle'), 'Close settings');
  panel.append(close, el('h2', 'info-title', 'Settings'), disastersToggle, qualityToggle);

  bus.on('settings:toggle', () => {
    panel.hidden = !panel.hidden;
  });
  bus.on('sim:updated', (state) => {
    disasters = state.disasters;
    disastersToggle.setAttribute('aria-checked', String(disasters));
  });
  bus.on('settings:lowQuality', (low) => {
    lowQuality = low;
    qualityToggle.setAttribute('aria-checked', String(low));
  });
  return panel;
}
