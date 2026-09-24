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
  /** Last month's crime and polluted-home figures, to warn only while they grow. */
  private lastCrime = 0;
  private lastPollutedHomes = 0;

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
    this.lastCrime = 0;
    this.lastPollutedHomes = 0;
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

  private reportFires(started: readonly number[], burned: readonly number[]): void {
    const { width } = this.sim.state;
    if (started.length > 0) {
      const at = started[0];
      const where = `(${at % width}, ${Math.floor(at / width)})`;
      const what = started.length === 1 ? 'A building is' : `${started.length} buildings are`;
      this.toast(`Fire! ${what} burning near ${where}.`, 'warning');
    }
    if (burned.length > 0) {
      const what = burned.length === 1 ? 'A building' : `${burned.length} buildings`;
      this.toast(`${what} burned down. Fire stations put out fires within their reach.`, 'error');
    }
  }

  /** Monthly warnings when crime or pollution near homes crosses its threshold and keeps growing. */
  private checkEnvironment(): void {
    const { stats, tiles } = this.sim.state;
    const crime = stats.averageCrime;
    if (crime >= CONFIG.alerts.crime && crime > this.lastCrime) {
      this.toast(
        `Crime is rising (average ${crime}). Build police stations near busy areas.`,
        'warning',
      );
    }
    this.lastCrime = crime;

    const limit = CONFIG.zones.effects.distressPollution;
    const polluted = tiles.filter(
      (t) => t.zone === 'residential' && t.stage === 'developed' && t.pollution >= limit,
    ).length;
    if (polluted >= CONFIG.alerts.pollutedHomes && polluted > this.lastPollutedHomes) {
      this.toast(
        `Pollution is high around ${polluted} homes. Keep industry and power plants away from housing, or add parks.`,
        'warning',
      );
    }
    this.lastPollutedHomes = polluted;
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
    this.reportFires(report.firesStarted, report.burnedDown);
    if (report.environmentUpdated) this.checkEnvironment();
    if (report.day % CONFIG.save.autosaveDays === 0) this.save('auto');
    this.bus.emit('sim:updated', this.sim.state);
  }
}
