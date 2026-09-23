import './style.css';
import { EventBus } from './core/events';
import type { GameEvents } from './game/events';
import { Game, restoreCity } from './game/game';
import { createLocalStore } from './game/storage';
import { KeyboardInput } from './input/keyboard';
import { PointerInput } from './input/pointer';
import { CityView } from './render/view';
import { createUI } from './ui/ui';

const container = document.querySelector<HTMLDivElement>('#app');
const hud = document.querySelector<HTMLDivElement>('#hud');
if (!container || !hud) throw new Error('Missing #app or #hud container');

const bus = new EventBus<GameEvents>();
const store = createLocalStore();
const { sim, restored } = restoreCity(store);
const view = new CityView(container, sim.state);
const game = new Game(bus, view, store, sim);

const pointer = new PointerInput(view, bus, (command) => game.preview(command));
new KeyboardInput(view, bus, () => pointer.cancelDrag());

bus.on('preview:changed', (preview) => view.setPlan(preview?.plan ?? null));
bus.on('tile:hovered', (tile) => view.setHover(tile));
bus.on('tile:selected', (tile) => view.setSelection(tile));

createUI(hud, bus);
bus.emit('tool:changed', 'select');
game.start();
bus.emit('notice', {
  message: restored
    ? `Welcome back! Continuing your ${restored.slot === 'auto' ? 'autosaved' : 'saved'} city.`
    : 'Welcome to Small City. Build a road, zone some land and add a power plant.',
  tone: 'info',
});
