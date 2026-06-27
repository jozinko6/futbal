/** Deterministic RNG — mulberry32. No Math.random in simulation. */
export function createRng(seed: number): number {
  return seed >>> 0;
}

export function rngNext(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngFloat(state: number, min: number, max: number): [number, number] {
  const r = rngNext(state);
  const next = (state + 0x6d2b79f5) >>> 0;
  return [next, min + r * (max - min)];
}

export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
