export type Listener<T> = (payload: T) => void;

type AnyListener = (payload: never) => void;

/** Payload arguments for `emit`: none for `void` events, exactly one otherwise. */
type EmitArgs<T> = [T] extends [void] ? [] : [payload: T];

/**
 * A small typed publish/subscribe channel. Each layer gets the same bus instance
 * through its constructor, so no layer reaches for globals.
 */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<AnyListener>>();

  /** Subscribes to an event and returns a function that unsubscribes. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => this.off(type, listener);
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit<K extends keyof Events>(type: K, ...args: EmitArgs<Events[K]>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    const payload = args[0] as Events[K];
    // Copy so listeners may unsubscribe while being notified.
    for (const listener of [...set]) (listener as Listener<Events[K]>)(payload);
  }
}
