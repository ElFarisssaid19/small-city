import './style.css';
import { GameLoop } from './core/loop';
import { CityView } from './render/view';
import { CONFIG } from './sim/config';
import { Simulation } from './sim/simulation';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('Missing #app container');

const sim = Simulation.newGame(Date.now() >>> 0);
const view = new CityView(container, sim.state);

const loop = new GameLoop({
  msPerTick: CONFIG.time.msPerDay,
  maxTicksPerFrame: CONFIG.time.maxTicksPerFrame,
  maxFrameMs: CONFIG.time.maxFrameMs,
  tick: () => sim.tick(),
  render: (now) => view.render(now),
});
loop.start();
