export interface GameLoopOptions {
  /** Real milliseconds per simulation tick at 1x speed. */
  msPerTick: number;
  /** Upper bound on ticks per frame so a slow frame cannot snowball. */
  maxTicksPerFrame: number;
  /** Longest frame delta taken into account (e.g. after the tab was hidden). */
  maxFrameMs: number;
  tick: () => void;
  render: (now: number) => void;
}

/**
 * Renders every animation frame and advances the simulation on a fixed step,
 * scaled by the current speed multiplier (0 = paused).
 */
export class GameLoop {
  private speedValue = 1;
  private accumulator = 0;
  private lastTime: number | null = null;
  private frameId: number | null = null;

  constructor(private readonly options: GameLoopOptions) {}

  get speed(): number {
    return this.speedValue;
  }

  set speed(value: number) {
    this.speedValue = Math.max(0, value);
  }

  start(): void {
    if (this.frameId !== null) return;
    this.lastTime = null;
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  /** Feeds `dtMs` real milliseconds into the fixed-step clock and returns the ticks run. */
  advance(dtMs: number): number {
    if (this.speedValue === 0) return 0;
    const { msPerTick, maxTicksPerFrame, maxFrameMs } = this.options;
    this.accumulator += Math.min(Math.max(dtMs, 0), maxFrameMs) * this.speedValue;
    let ticks = 0;
    while (this.accumulator >= msPerTick && ticks < maxTicksPerFrame) {
      this.options.tick();
      this.accumulator -= msPerTick;
      ticks++;
    }
    // Drop any backlog we could not catch up on instead of spiralling.
    if (ticks === maxTicksPerFrame) this.accumulator = Math.min(this.accumulator, msPerTick);
    return ticks;
  }

  private readonly frame = (now: number): void => {
    const dt = this.lastTime === null ? 0 : now - this.lastTime;
    this.lastTime = now;
    this.advance(dt);
    this.options.render(now);
    this.frameId = requestAnimationFrame(this.frame);
  };
}
