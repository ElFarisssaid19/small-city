import type { EventBus } from '../core/events';
import { GameLoop } from '../core/loop';
import type { CityView } from '../render/view';
import { formatMoney } from '../core/format';
import type { Command, Plan } from '../sim/commands';
import { CONFIG } from '../sim/config';
import { SaveError, deserialize, serialize } from '../sim/save';
import { Simulation } from '../sim/simulation';
import type { SimState } from '../sim/types';
import type { GameEvents } from './events';
import type { SaveSlot, SaveStore, StoredSave } from './storage';

function newSeed(): number {
  return Date.now() >>> 0;
}

/**
 * The city to start with: the most recent save that still loads, or a new one.
 */
export function restoreCity(store: SaveStore): { sim: Simulation; restored: StoredSave | null } {
  const saves = [store.read('manual'), store.read('auto')]
    .filter((save): save is StoredSave => save !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
  for (const save of saves) {
    try {
      return { sim: new Simulation(deserialize(save.json)), restored: save };
    } catch {
      // Unreadable save: fall through to the next one or a fresh city.
    }
  }
  return { sim: Simulation.newGame(newSeed()), restored: null };
}

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
    private readonly store: SaveStore,
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
    bus.on('game:new', () => this.newGame());
    bus.on('game:save', () => this.save('manual'));
    bus.on('game:load', () => this.load('manual'));
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

  private notice(message: string, tone: 'info' | 'warn' | 'error' = 'info'): void {
    this.bus.emit('notice', { message, tone });
  }

  private save(slot: SaveSlot): void {
    const ok = this.store.write(slot, serialize(this.sim.state));
    if (slot === 'manual') {
      if (ok) this.notice('City saved.');
      else this.notice('Could not save: browser storage is unavailable or full.', 'error');
    }
  }

  private load(slot: SaveSlot): void {
    const stored = this.store.read(slot);
    if (!stored) {
      this.notice('There is no saved city yet.', 'warn');
      return;
    }
    try {
      this.replace(new Simulation(deserialize(stored.json)));
      this.notice('City loaded.');
    } catch (error) {
      const reason = error instanceof SaveError ? error.message : 'The save could not be read.';
      this.notice(reason, 'error');
    }
  }

  private newGame(): void {
    this.replace(Simulation.newGame(newSeed()));
    // Overwrite the autosave so a reload does not bring the old city back.
    this.save('auto');
    this.notice('A new city begins. Build roads, zones and a power plant.');
  }

  private replace(sim: Simulation): void {
    this.sim = sim;
    this.view.setState(sim.state);
    this.bus.emit('tile:selected', null);
    this.bus.emit('sim:updated', sim.state);
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
    if (report.budget) {
      const { taxes, upkeep } = report.budget;
      const net = taxes - upkeep;
      this.bus.emit('notice', {
        message: `Month end: taxes ${formatMoney(taxes)}, upkeep ${formatMoney(-upkeep)} (net ${formatMoney(net)}).`,
        tone: net >= 0 ? 'info' : 'warn',
      });
    }
    if (report.day % CONFIG.save.autosaveDays === 0) this.save('auto');
    this.bus.emit('sim:updated', this.sim.state);
  }
}
