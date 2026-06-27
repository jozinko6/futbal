/**
 * Kačanovská FIFA — futsal 5v5 simulation types.
 * Pure data — no DOM/Canvas. Shared by client and authoritative server.
 */
import type { Difficulty, FutsalRole, BallStateName, TeamPhase } from './tacticsConfig';

export type Team = 0 | 1;

export type PlayerRole = FutsalRole; // alias for backward compat

export type PlayerStateName =
  | 'idle' | 'run' | 'sprint' | 'pass' | 'shoot' | 'tackle' | 'slide'
  | 'stunned' | 'celebrate' | 'goalkeeperDive' | 'goalkeeperCatch' | 'contain';

export interface Vec2 { x: number; y: number }

/** Actions a player with the ball may choose (utility-scored). */
export type WithBallAction =
  | 'DRIBBLE' | 'HOLD_BALL' | 'SHORT_PASS' | 'THROUGH_PASS' | 'BACK_PASS'
  | 'LOB_PASS' | 'SHOOT' | 'CLEAR_BALL';

/** Actions a player without the ball may choose (utility-scored). */
export type OffBallAction =
  | 'SUPPORT' | 'RUN_IN_BEHIND' | 'MOVE_WIDE' | 'MOVE_TO_BACK_POST'
  | 'DROP_DEEP' | 'COVER' | 'MARK' | 'PRESS' | 'INTERCEPT' | 'RETURN_TO_FORMATION';

export type AiAction = WithBallAction | OffBallAction | 'idle';

export type ShotType = 'normal' | 'placed' | 'power' | 'firstTime' | 'lob';
export type PassType = 'short' | 'driven' | 'through' | 'lob';

/**
 * Explicit player action with phased execution. The ball is kicked only at the
 * contact tick; the animation and kick sound are synchronised to that tick.
 * Before contact the action can be cancelled (e.g. by a tackle); during and
 * after contact the aim cannot change dramatically.
 */
export interface PlayerAction {
  type:
    | 'shortPass' | 'drivenPass' | 'throughPass' | 'lobPass'
    | 'placedShot' | 'powerShot' | 'lobShot' | 'firstTimeShot'
    | 'pokeTackle' | 'standingTackle' | 'slideTackle';
  phase: 'windup' | 'contact' | 'recovery';
  startedAtTick: number;
  contactAtTick: number;
  finishAtTick: number;
  aimX: number;
  aimY: number;
  power: number;
  /** Whether the ball has already been kicked/touched in this action. */
  contacted: boolean;
}

/** Result of attempting to control an incoming ball (first touch). */
export type FirstTouchResult =
  | { controlled: true; quality: number }
  | { controlled: false; quality: number; deflectionVx: number; deflectionVy: number };

export interface BallState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  spin: number;
  ownerId: number | null;
  releaseCooldown: number;
  possessionShield: number;
  shieldTeam: Team | null;
  gkHoldTime: number;
  indirect: boolean;
  /** Explicit ball phase. */
  ballState: BallStateName;
  /** Time until the dribbler must re-touch the ball (touch-based dribbling). */
  touchTimer: number;
}

export interface PlayerEntity {
  id: number;
  team: Team;
  role: FutsalRole;
  x: number; y: number;
  vx: number; vy: number;
  /** Body facing (radians). */
  facing: number;
  /** Movement direction (radians) — may differ from facing. */
  moveDir: number;
  /** Aiming direction (radians) — separate from body/move. */
  aimDir: number;
  maxSpeed: number;
  accel: number;
  state: PlayerStateName;
  slideCooldown: number;
  hasBall: boolean;
  stunnedTime: number;
  animTime: number;
  aiTimer: number;
  aiTarget: Vec2;
  aiAction: AiAction;
  diveDir: Vec2;
  diveTime: number;
  actionLock: number;
  // Futsal tactical fields
  baseFormationPosition: Vec2;
  dynamicFormationPosition: Vec2;
  supportTarget: Vec2 | null;
  markingTarget: number | null;
  personalSpaceRadius: number;
  tacticalRole: FutsalRole;
  firstTouchQuality: number;
  utilityScores: Record<string, number>;
  pokeCooldown: number;
  /** Windup/contact/recovery phase timer for shooting. */
  shootPhase: number;
  /** Currently executing phased action (pass/shot/tackle), or null. */
  currentAction: PlayerAction | null;
  /** Tick of the last ball contact (kick) — used to fire the kick sound. */
  lastContactTick: number;
  /** Stamina 0..100 (sprint drains, walk/jog regen). */
  stamina: number;
  /** Internal flags set by applyMovement, consumed by integratePlayer for stamina. */
  _sprintThisTick: boolean;
  _movingThisTick: boolean;
  _hasBallThisTick: boolean;
}

export type MatchPeriod =
  | 'kickoff' | 'play' | 'goal' | 'halftime' | 'fulltime'
  | 'pause' | 'extratime' | 'penalties';

export type RestartType =
  | 'kickoff' | 'goalKick' | 'corner' | 'throwIn' | 'freeKick' | 'penalty' | null;

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
  timeMs: number;
  half: 1 | 2;
  period: MatchPeriod;
  score: [number, number];
  ball: BallState;
  players: PlayerEntity[];
  controllers: HumanController[];
  restartTeam: Team;
  restartType: RestartType;
  restartTimer: number;
  lastTouchTeam: Team | null;
  nextRestartTeam: Team;
  nextRestartType: RestartType;
  rngState: number;
  difficulty: Difficulty;
  halfLength: number;
  tick: number;
  lastGoalTeam: Team | null;
  banner: string;
  bannerTimer: number;
  offsideCheck: unknown | null; // futsal: no offside; kept for API compat
  offsides: [number, number];
  shootout: {
    kicksTaken: [number, number];
    kicksScored: [number, number];
    nextKicker: Team;
    suddenDeath: boolean;
    kickerIndex: [number, number];
  } | null;
  // Futsal tactical state
  teamPhase: [TeamPhase, TeamPhase];
  debug: boolean;
}

export interface InputFrame {
  seq: number;
  moveX: number;
  moveY: number;
  sprint: boolean;
  pass: boolean;
  shootHeld: boolean;
  highPass: boolean;
  switchPlayer: boolean;
}

export type Snapshot = MatchState;

/** Delta snapshot — partial state for bandwidth-efficient net sync. */
export interface DeltaSnapshot {
  tick: number;
  ball: Partial<BallState>;
  players: Partial<PlayerEntity>[];
  score: [number, number];
  timeMs: number;
  period: MatchPeriod;
  activePlayerId: number;
}
