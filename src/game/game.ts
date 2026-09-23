import type { EventBus } from '../core/events';
import { formatMoney } from '../core/format';
import { GameLoop } from '../core/loop';
import type { CityView } from '../render/view';
import type { Command, Plan } from '../sim/commands';
import { CONFIG } from '../sim/config';
import { SaveError, deserialize, serialize } from '../sim/save';
import { Simulation } from '../sim/simulation';
import type { SimState } from '../sim/types';
import type { GameEvents, ToastKind } from './events';
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
  /** Whether the last update was short of power, so the warning fires once per shortage. */
  private powerShort = false;

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

  private toast(message: string, kind: ToastKind = 'info'): void {
    this.bus.emit('toast', { message, kind });
  }

  private save(slot: SaveSlot): void {
    const ok = this.store.write(slot, serialize(this.sim.state));
    if (slot === 'manual') {
      if (ok) this.toast('City saved.', 'success');
      else this.toast('Could not save: browser storage is unavailable or full.', 'error');
    }
  }

  private load(slot: SaveSlot): void {
    const stored = this.store.read(slot);
    if (!stored) {
      this.toast('There is no saved city yet.', 'warning');
      return;
    }
    try {
      this.replace(new Simulation(deserialize(stored.json)));
      this.toast('City loaded.', 'success');
    } catch (error) {
      const reason = error instanceof SaveError ? error.message : 'The save could not be read.';
      this.toast(reason, 'error');
    }
  }

  private newGame(): void {
    this.replace(Simulation.newGame(newSeed()));
    // Overwrite the autosave so a reload does not bring the old city back.
    this.save('auto');
    this.toast('A new city begins. Build roads, zones and a power plant.');
  }

  private replace(sim: Simulation): void {
    this.sim = sim;
    this.powerShort = false;
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
    if (!result.ok) {
      const { problem } = result.plan;
      this.bus.emit('command:rejected', { reason: result.reason ?? 'Not possible.', problem });
      return;
    }
    this.checkPower();
    this.bus.emit('sim:updated', this.sim.state);
  }

  /** Warns once when the city starts using more power than its plants supply. */
  private checkPower(): void {
    const { powerDemand, powerSupply } = this.sim.state.stats;
    const short = powerDemand > powerSupply;
    if (short && !this.powerShort) {
      this.toast(
        `Power shortage: ${powerDemand} units needed, ${powerSupply} supplied. Build another power plant.`,
        'warning',
      );
    }
    this.powerShort = short;
  }

  private tick(): void {
    const report = this.sim.tick();
    if (report.abandoned > 0) {
      const what = report.abandoned === 1 ? 'A building was' : `${report.abandoned} buildings were`;
      this.toast(`${what} abandoned: zones need power and a road within reach.`, 'warning');
    }
    // Only losing months are worth interrupting for; the funds tooltip shows every month.
    if (report.budget && report.budget.taxes < report.budget.upkeep) {
      const { taxes, upkeep } = report.budget;
      this.toast(
        `Losing money: taxes ${formatMoney(taxes)}, upkeep ${formatMoney(-upkeep)} last month.`,
        'warning',
      );
    }
    this.checkPower();
    if (report.day % CONFIG.save.autosaveDays === 0) this.save('auto');
    this.bus.emit('sim:updated', this.sim.state);
  }
}
