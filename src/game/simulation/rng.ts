/**
 * Deterministic, seedable RNG (mulberry32). No Math.random anywhere in the
 * simulation — this is what makes the same inputs produce the same outputs
 * on client and server.
 */
export function rngCreate(seed: number): number {
  return seed >>> 0;
}

/** Advance the RNG and return a float in [0, 1). Mutates & returns new state. */
export function rngNext(state: number): number {
  // mulberry32
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return result;
}

/** Returns [nextState, value]. */
export function rngFloat(state: number, min: number, max: number): [number, number] {
  const r = rngNext(state);
  const next = (state + 0x6d2b79f5) >>> 0;
  return [next, min + r * (max - min)];
}

export function rngInt(state: number, min: number, maxExclusive: number): [number, number] {
  const r = rngNext(state);
  const next = (state + 0x6d2b79f5) >>> 0;
  return [next, min + Math.floor(r * (maxExclusive - min))];
}

/** Hash a string into a 32-bit seed (for room codes etc.). */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
