/**
 * Kačanovská FIFA — futsal 5v5 tactical configuration.
 *
 * All gameplay-tunable values live here (no magic numbers scattered in code).
 * Field GEOMETRY (pixels) stays in constants.ts; this file defines MOVEMENT
 * (m/s), BALL, DEFENSE, PASSING, SHOOTING, AI, roles, phases, ball states.
 * Convert m/s → px/s with `mps()` (1 m = 32 px).
 */

/** 1 metre in world pixels. */
export const METER_PX = 32;
export const mps = (m: number) => m * METER_PX;
export const m = (v: number) => v * METER_PX;

// --- Field (metres, for formation logic) — pixel geometry lives in constants.ts
export const FIELD_METERS = { w: 35, h: 19 };

// --- Fixed timestep & match ------------------------------------------------
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_ACCUM = 0.25;
export const DEFAULT_HALF_LENGTH = 180; // 2 × 3 minutes
export const HALF_LENGTH_OPTIONS = [60, 120, 180, 240] as const;
export const GOAL_CELEBRATION_TIME = 2.4;
export const KICKOFF_DELAY = 1.0;
export const RESTART_SETUP_TIME = 1.0;
export const POSSESSION_SHIELD = 1.2;
export const GK_HOLD_MAX = 4;
export const PENALTY_SPOT_X_M = 6;
export const PENALTY_SHOOTOUT_KICKS = 5;

// --- Player movement (m/s, m/s²) ------------------------------------------
export const MOVEMENT = {
  walkSpeed: 2.0,
  jogSpeed: 3.5,
  runSpeed: 5.2,
  sprintSpeed: 6.8,
  runWithBallSpeed: 4.6,
  sprintWithBallSpeed: 5.8,
  backwardSpeed: 2.6,
  defensiveStrafeSpeed: 3.1,
  acceleration: 9,
  sprintAcceleration: 11,
  deceleration: 13,
  turnRate: 12,
  turnRateWithBall: 7,
  turnRateSprint: 5,
  sharpTurnPenalty: 0.55,
  sharpTurnThreshold: 1.2,
  radius: 0.45,
  separationStrength: 8,
  personalSpace: 1.4,
} as const;

// --- Stamina (0..100) — ARCADE: doesn't block sprint, just slightly slows ---
export const STAMINA = {
  max: 100,
  sprintDrain: 12,
  sprintDrainWithBall: 15,
  runDrain: 2,
  jogRegen: 15,
  walkRegen: 20,
  idleRegen: 25,
  /** Below this, max speed is slightly reduced (NOT blocked). */
  fatigueThreshold: 20,
  /** Speed multiplier when fully fatigued (0..1). */
  fatigueSpeedMul: 0.85,
  /** Accel multiplier when fatigued. */
  fatigueAccelMul: 0.85,
} as const;

// --- Ball (m/s) -----------------------------------------------------------
export const BALL = {
  radius: 0.11,
  maxSpeed: 28,
  friction: 9,
  airDrag: 0.18,
  gravity: 9.81,
  bounceRestitution: 0.5,
  restThreshold: 1.2,
  passSpeed: { short: 12, driven: 16, through: 14, lob: 11 },
  lobZ: 7,
  shootMin: 16,
  shootMax: 26,
  shootChargeTime: 0.7,
  dribbleTouchDistance: { min: 0.5, max: 2.2 },
  dribbleTouchInterval: 0.18,
  firstTouchGood: 0.6,
  firstTouchBad: 1.8,
} as const;

// --- Tackles & defense ----------------------------------------------------
export const DEFENSE = {
  controlRadius: 0.9,
  tackleRadius: 1.1,
  containDistance: 1.6,
  slideSpeed: 9,
  slideDuration: 0.4,
  slideCooldown: 1.0,
  slideRecover: 0.5,
  stunDuration: 0.7,
  pokeRadius: 1.0,
  pokeCooldown: 0.6,
} as const;

// --- Pass assistance & shooting accuracy ----------------------------------
export const PASSING = {
  maxAssistAngle: 0.35,
  assistAlignment: 0.4,
  throughBallLead: 0.6,
} as const;

export const SHOOTING = {
  windupTime: 0.12,
  contactTime: 0.06,
  recoveryTime: 0.28,
  baseError: 0.12,
  movingError: 0.18,
  pressureError: 0.22,
  distanceErrorPer10m: 0.05,
  chargeError: 0.1,
} as const;

// --- AI decision intervals (ms) -------------------------------------------
export const AI_INTERVALS = {
  easy: { min: 350, max: 500 },
  normal: { min: 220, max: 350 },
  hard: { min: 120, max: 220 },
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY_PARAMS: Record<
  Difficulty,
  { reactionMs: number; precision: number; aggression: number; passRisk: number; gkReactionMs: number }
> = {
  easy: { reactionMs: 420, precision: 0.55, aggression: 0.35, passRisk: 0.3, gkReactionMs: 380 },
  normal: { reactionMs: 280, precision: 0.78, aggression: 0.6, passRisk: 0.55, gkReactionMs: 240 },
  hard: { reactionMs: 170, precision: 0.93, aggression: 0.85, passRisk: 0.75, gkReactionMs: 150 },
};

// --- Futsal roles & formation (1-2-1) -------------------------------------
export type FutsalRole = 'goalkeeper' | 'fixo' | 'leftAla' | 'rightAla' | 'pivot';
export const PLAYERS_PER_TEAM = 5;
export const FORMATION_121_HOME: Array<{ role: FutsalRole; x: number; y: number }> = [
  { role: 'goalkeeper', x: 1.2, y: 9.5 },
  { role: 'fixo', x: 12, y: 9.5 },
  { role: 'leftAla', x: 20, y: 4 },
  { role: 'rightAla', x: 20, y: 15 },
  { role: 'pivot', x: 28, y: 9.5 },
];

// --- Team tactical phases --------------------------------------------------
export type TeamPhase =
  | 'BUILD_UP' | 'ATTACK' | 'FINAL_THIRD' | 'ATTACKING_TRANSITION'
  | 'DEFENSIVE_TRANSITION' | 'ORGANIZED_DEFENSE' | 'HIGH_PRESS'
  | 'SET_PIECE_ATTACK' | 'SET_PIECE_DEFENSE';
export const TEAM_TACTICS = {
  attackWidth: 18, defenseWidth: 12,
  defenseLineDepth: 12, pressLineDepth: 20,
  finalThirdX: 27, pressThreshold: 0.6,
} as const;

// --- Ball states -----------------------------------------------------------
export type BallStateName =
  | 'CONTROLLED' | 'LOOSE' | 'CONTESTED' | 'AIRBORNE'
  | 'GOALKEEPER_CONTROLLED' | 'OUT_OF_PLAY';

// --- Palette ---------------------------------------------------------------
export const TEAM_COLORS = {
  home: { jersey: '#e23b3b', shorts: '#1f2937', trim: '#ffffff', skin: '#f1c27d' },
  away: { jersey: '#2f7fd4', shorts: '#0b1f3a', trim: '#ffd23f', skin: '#f1c27d' },
} as const;
export const FIELD_COLORS = { grassA: '#3aa84a', grassB: '#2f9240', line: '#f4fff0', border: '#1c5e34' } as const;

// --- Networking ------------------------------------------------------------
export const SNAPSHOT_RATE = 20;
export const INPUT_RATE = 30;
export const INTERP_DELAY = 0.1;
export const MAX_INPUT_BUFFER = 64;
export const DISCONNECT_GRACE = 8;
