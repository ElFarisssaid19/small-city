export type SaveSlot = 'manual' | 'auto';

export interface StoredSave {
  slot: SaveSlot;
  json: string;
  /** Real-world time of the save, in ms since the epoch. */
  savedAt: number;
}

/** Where saves live. The game only sees this interface, so tests can swap it out. */
export interface SaveStore {
  write(slot: SaveSlot, json: string): boolean;
  read(slot: SaveSlot): StoredSave | null;
}

const PREFIX = 'small-city:';

/** Saves in localStorage. Every access is guarded: storage can be full, blocked or missing. */
export function createLocalStore(storage: Storage | null = safeLocalStorage()): SaveStore {
  return {
    write(slot, json) {
      try {
        storage?.setItem(`${PREFIX}${slot}`, json);
        storage?.setItem(`${PREFIX}${slot}:time`, String(Date.now()));
        return storage !== null;
      } catch {
        return false;
      }
    },
    read(slot) {
      try {
        const json = storage?.getItem(`${PREFIX}${slot}`);
        if (!json) return null;
        const savedAt = Number(storage?.getItem(`${PREFIX}${slot}:time`)) || 0;
        return { slot, json, savedAt };
      } catch {
        return null;
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A remembered yes/no preference such as a dismissed hint; quietly false without storage. */
export function readFlag(name: string): boolean {
  try {
    return safeLocalStorage()?.getItem(`${PREFIX}flag:${name}`) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(name: string): void {
  try {
    safeLocalStorage()?.setItem(`${PREFIX}flag:${name}`, '1');
  } catch {
    // Storage is unavailable: the flag simply is not remembered.
  }
}
