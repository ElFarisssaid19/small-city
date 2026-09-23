import type { EventBus } from '../core/events';
import { GameLoop } from '../core/loop';
import type { CityView } from '../render/view';
import type { Command, Plan } from '../sim/commands';
import { CONFIG } from '../sim/config';
import type { Simulation } from '../sim/simulation';
import type { SimState } from '../sim/types';
import type { GameEvents } from './events';

/**
 * Glues the layers together: owns the simulation and the loop, turns bus
 * requests into simulation calls and reports the results back on the bus.
 */
export class Game {
  private readonly loop: GameLoop;
  private lastSpeed = 1;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly view: CityView,
    private sim: Simulation,
  ) {
    this.loop = new GameLoop({
      msPerTick: CONFIG.time.msPerDay,
      maxTicksPerFrame: CONFIG.time.maxTicksPerFrame,
      maxFrameMs: CONFIG.time.maxFrameMs,
      tick: () => this.tick(),
      render: (now) => this.view.render(now),
    });

    bus.on('command', (command) => this.execute(command));
    bus.on('speed:set', (speed) => this.setSpeed(speed));
    bus.on('speed:toggle', () => this.setSpeed(this.loop.speed === 0 ? this.lastSpeed : 0));
  }

  get state(): Readonly<SimState> {
    return this.sim.state;
  }

  /** Read-only query used by the input layer for ghost previews. */
  preview(command: Command): Plan {
    return this.sim.preview(command);
  }

  start(): void {
    this.bus.emit('speed:changed', this.loop.speed);
    this.bus.emit('sim:updated', this.sim.state);
    this.loop.start();
  }

  private setSpeed(speed: number): void {
    this.loop.speed = speed;
    if (speed > 0) this.lastSpeed = speed;
    this.bus.emit('speed:changed', speed);
  }

  private execute(command: Command): void {
    const result = this.sim.execute(command);
    if (result.ok) this.bus.emit('sim:updated', this.sim.state);
    else this.bus.emit('command:rejected', { reason: result.reason ?? 'Not possible.' });
  }

  private tick(): void {
    const report = this.sim.tick();
    if (report.abandoned > 0) {
      const what = report.abandoned === 1 ? 'A building was' : `${report.abandoned} buildings were`;
      this.bus.emit('notice', {
        message: `${what} abandoned: zones need power and a road within reach.`,
        tone: 'warn',
      });
    }
    this.bus.emit('sim:updated', this.sim.state);
  }
}
