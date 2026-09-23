/** Anything that carries the 32-bit RNG state, typically the whole sim state. */
export interface RngHolder {
  rng: number;
}

/** Turns an arbitrary seed into a well-mixed initial RNG state. */
export function seedRng(seed: number): number {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Returns a float in [0, 1) and advances the state (mulberry32).
 * The state lives in plain data so it is saved and restored with the game.
 */
export function nextRandom(holder: RngHolder): number {
  holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** True with probability `p`. Always draws, so the sequence does not depend on `p`. */
export function chance(holder: RngHolder, p: number): boolean {
  return nextRandom(holder) < p;
}
