import './style.css';
import { EventBus } from './core/events';
import type { GameEvents } from './game/events';
import { Game } from './game/game';
import { KeyboardInput } from './input/keyboard';
import { PointerInput } from './input/pointer';
import { CityView } from './render/view';
import { Simulation } from './sim/simulation';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('Missing #app container');

const bus = new EventBus<GameEvents>();
const sim = Simulation.newGame(Date.now() >>> 0);
const view = new CityView(container, sim.state);
const game = new Game(bus, view, sim);

const pointer = new PointerInput(view, bus, (command) => game.preview(command));
new KeyboardInput(view, bus, () => pointer.cancelDrag());

bus.on('preview:changed', (preview) => view.setPlan(preview?.plan ?? null));
bus.on('tile:hovered', (tile) => view.setHover(tile));
bus.on('tile:selected', (tile) => view.setSelection(tile));

game.start();
