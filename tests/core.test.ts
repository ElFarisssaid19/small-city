import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/events';
import { GameLoop } from '../src/core/loop';

describe('event bus', () => {
  interface Events {
    count: number;
    ping: void;
  }

  it('delivers typed payloads to subscribers until they unsubscribe', () => {
    const bus = new EventBus<Events>();
    const seen: number[] = [];
    const off = bus.on('count', (n) => seen.push(n));
    bus.emit('count', 1);
    bus.emit('count', 2);
    off();
    bus.emit('count', 3);
    expect(seen).toEqual([1, 2]);
  });

  it('supports events without a payload and listeners that unsubscribe themselves', () => {
    const bus = new EventBus<Events>();
    const later = vi.fn();
    const once = bus.on('ping', () => once());
    bus.on('ping', later);
    bus.emit('ping');
    bus.emit('ping');
    expect(later).toHaveBeenCalledTimes(2);
  });
});

describe('game loop', () => {
  function loop(tick = vi.fn()) {
    return {
      tick,
      loop: new GameLoop({
        msPerTick: 1000,
        maxTicksPerFrame: 8,
        maxFrameMs: 250,
        tick,
        render: () => {},
      }),
    };
  }

  it('ticks once per game day at 1x and faster at higher speeds', () => {
    const { loop: l, tick } = loop();
    for (let i = 0; i < 10; i++) l.advance(100);
    expect(tick).toHaveBeenCalledTimes(1);

    l.speed = 4;
    for (let i = 0; i < 10; i++) l.advance(100);
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it('does not tick while paused and resumes where it left off', () => {
    const { loop: l, tick } = loop();
    l.advance(200);
    l.speed = 0;
    for (let i = 0; i < 50; i++) l.advance(200);
    expect(tick).not.toHaveBeenCalled();
    l.speed = 1;
    for (let i = 0; i < 4; i++) l.advance(200);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('ignores huge frame gaps instead of fast-forwarding', () => {
    const { loop: l, tick } = loop();
    l.speed = 4;
    expect(l.advance(60_000)).toBe(1); // 250 ms at 4x = one day
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
