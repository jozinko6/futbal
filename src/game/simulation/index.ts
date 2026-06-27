/**
 * Deterministic futsal 5v5 simulation package.
 *
 * Pure TypeScript — no DOM, no Canvas, no Phaser. Usable on the client
 * (for prediction) and on an authoritative Node.js server.
 *
 * `constants.ts` re-exports the SI values from `tacticsConfig.ts` under the
 * legacy pixel-based names the renderer / tests already use. We export from
 * `constants` (which already re-exports MOVEMENT/BALL/DEFENSE/PASSING/
 * SHOOTING/AI_INTERVALS/METER_PX/mps/m + all field geometry + Difficulty),
 * then the rest of the modules. We do NOT `export * from './tacticsConfig'`
 * here to avoid duplicate-export conflicts with constants.ts.
 */
export * from './constants';
export * from './types';
export * from './rng';
export * from './math';
export * from './input';
export * from './ball';
export * from './formation';
export * from './player';
export * from './teamTactics';
export * from './goalkeeper';
export * from './rules';
export * from './ai';
export * from './simulation';
