import './style.css';
import { EventBus } from './core/events';
import type { GameEvents } from './game/events';
import { Game, restoreCity } from './game/game';
import { createLocalStore, readFlag, writeFlag } from './game/storage';
import { isZoneTool } from './game/tools';
import { KeyboardInput } from './input/keyboard';
import { PointerInput } from './input/pointer';
import { allModelIds } from './render/models/catalog';
import { loadModelLibrary } from './render/models/library';
import { CityView } from './render/view';
import { createLoadingScreen } from './ui/loading';
import { createUI } from './ui/ui';

const LOW_QUALITY_FLAG = 'low-quality';

const container = document.querySelector<HTMLDivElement>('#app');
const hud = document.querySelector<HTMLDivElement>('#hud');
if (!container || !hud) throw new Error('Missing #app or #hud container');

// Models load behind a progress bar before anything else starts.
const loading = createLoadingScreen();
document.body.append(loading.element);
const library = await loadModelLibrary(allModelIds(), (loaded, total) =>
  loading.progress(loaded, total),
);

const bus = new EventBus<GameEvents>();
const store = createLocalStore();
const { sim, restored } = restoreCity(store);
const lowQuality = readFlag(LOW_QUALITY_FLAG);
const view = new CityView(container, sim.state, library, { lowQuality });
const game = new Game(bus, view, store, sim);

const pointer = new PointerInput(view, bus, (command) => game.preview(command));
new KeyboardInput(view, bus, () => pointer.cancelDrag());

bus.on('preview:changed', (preview) => view.setPlan(preview?.plan ?? null));
bus.on('tile:hovered', (tile) => view.setHover(tile));
bus.on('tile:selected', (tile) => view.setSelection(tile));
bus.on('tool:changed', (tool) => view.setPlacementOverlay(isZoneTool(tool)));
bus.on('settings:lowQuality', (low) => {
  view.setLowQuality(low);
  writeFlag(LOW_QUALITY_FLAG, low);
});

createUI(hud, bus);
bus.emit('tool:changed', 'select');
bus.emit('settings:lowQuality', lowQuality);
game.start();
loading.finish();

if (library.failed.length > 0) {
  const count = library.failed.length;
  bus.emit('toast', {
    message: `${count} 3D model${count === 1 ? '' : 's'} failed to load; simple shapes are shown instead.`,
    kind: 'warning',
  });
}
if (restored) {
  const which = restored.slot === 'auto' ? 'autosaved' : 'saved';
  bus.emit('toast', { message: `Welcome back! Continuing your ${which} city.`, kind: 'info' });
}
