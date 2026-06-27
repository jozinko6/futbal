/**
 * Retro Football Arena — simulation type definitions.
 *
 * Pure data shapes — no DOM/Canvas/Phaser references. Shared by client and
 * authoritative server.
 */
import type { Difficulty } from './constants';

export type Team = 0 | 1; // 0 = home (attacks right), 1 = away (attacks left)
export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'FWD';
export type PlayerStateName =
  | 'idle'
  | 'run'
  | 'sprint'
  | 'pass'
  | 'shoot'
  | 'tackle'
  | 'stunned'
  | 'celebrate'
  | 'goalkeeperDive';

export interface Vec2 {
  x: number;
  y: number;
}

export interface BallState {
  x: number;
  y: number;
  /** Height above the pitch (0 = on the ground). */
  z: number;
  vx: number;
  vy: number;
  /** Vertical velocity (positive = up). */
  vz: number;
  /** Visual spin angle in radians. */
  spin: number;
  /** Owning player id, or null when loose. */
  ownerId: number | null;
  /** Cooldown before a passer can re-gain the ball (avoids instant re-grab). */
  releaseCooldown: number;
}

export interface PlayerEntity {
  id: number;
  team: Team;
  role: PlayerRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Facing direction in radians. */
  facing: number;
  maxSpeed: number;
  accel: number;
  state: PlayerStateName;
  /** Seconds remaining on slide cooldown. */
  slideCooldown: number;
  /** Whether this player currently holds the ball. */
  hasBall: boolean;
  /** Seconds remaining of stun. */
  stunnedTime: number;
  /** Timer for animation phase. */
  animTime: number;
  /** Time until AI re-evaluates its decision. */
  aiTimer: number;
  /** AI movement target. */
  aiTarget: Vec2;
  /** AI intended action this decision window. */
  aiAction: AiAction;
  /** GK dive direction + timer (0 = not diving). */
  diveDir: Vec2;
  diveTime: number;
  /** Brief timer locking state transitions (pass/shoot animation). */
  actionLock: number;
}

export type AiAction =
  | 'idle'
  | 'returnToFormation'
  | 'support'
  | 'runToSpace'
  | 'mark'
  | 'press'
  | 'receive'
  | 'shoot'
  | 'pass'
  | 'dribble'
  | 'gkPosition'
  | 'gkCharge'
  | 'gkDive';

export type MatchPeriod =
  | 'kickoff'
  | 'play'
  | 'goal'
  | 'halftime'
  | 'fulltime'
  | 'pause'
  | 'extratime'
  | 'penalties';

export type RestartType = 'kickoff' | 'goalKick' | 'corner' | 'throwIn' | null;

/**
 * A human-controlled slot. Solo play uses one controller (team 0); local 2P
 * uses two (one per team). Each controller tracks its own active player,
 * shot-charge and input edge state so the deterministic simulation can drive
 * any number of humans.
 */
export interface HumanController {
  team: Team;
  activeId: number;
  chargeTime: number;
  prevShootHeld: boolean;
  prevPass: boolean;
  prevHighPass: boolean;
  prevSwitch: boolean;
  autoSwitch: boolean;
}

export interface MatchState {
  /** Elapsed match time in seconds within the current half. */
  timeMs: number;
  /** Current half (1 or 2). */
  half: 1 | 2;
  period: MatchPeriod;
  score: [number, number];
  ball: BallState;
  players: PlayerEntity[];
  /** Human controller slots (1 for solo vs AI, 2 for local multiplayer). */
  controllers: HumanController[];
  /** Which team kicks off / restarts. */
  restartTeam: Team;
  restartType: RestartType;
  /** Countdown for restart/celebration sequencing. */
  restartTimer: number;
  /** Team that last touched the ball (for throw-in / corner attribution). */
  lastTouchTeam: Team | null;
  /** Team that should restart after the current stoppage. */
  nextRestartTeam: Team;
  nextRestartType: RestartType;
  /** Seeded RNG state for deterministic AI jitter. */
  rngState: number;
  /** Active difficulty. */
  difficulty: Difficulty;
  /** Half length in seconds. */
  halfLength: number;
  /** Monotonic tick counter (determinism / sequence tracking). */
  tick: number;
  /** Last goal-scoring team (for celebration direction). */
  lastGoalTeam: Team | null;
  /** Pending message for HUD (e.g. "GOAL!", "HALF TIME"). */
  banner: string;
  bannerTimer: number;
}

/** A single timestamped input frame from the human client. */
export interface InputFrame {
  /** Monotonic sequence number for reconciliation/reordering. */
  seq: number;
  /** Desired movement direction (-1..1 each axis). */
  moveX: number;
  moveY: number;
  sprint: boolean;
  /** Pass pressed this frame (edge). */
  pass: boolean;
  /** Shoot button held (charge while held, fire on release). */
  shootHeld: boolean;
  highPass: boolean;
  switchPlayer: boolean;
}

/** Snapshot of full match state — used for net sync & resync. */
export type Snapshot = MatchState;

/** Delta snapshot — only fields that changed (simplified: sent as partial). */
export interface DeltaSnapshot {
  tick: number;
  ball: Partial<BallState>;
  players: Partial<PlayerEntity>[];
  score: [number, number];
  timeMs: number;
  period: MatchPeriod;
  activePlayerId: number;
}
