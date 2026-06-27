/**
 * Futbal Reborn — Core type definitions.
 * Pure data. No DOM, no Canvas, no class instances.
 * Fully serializable for future online multiplayer.
 */
import type { Difficulty, MatchFormat, Team, PlayerRole } from './tuning';
export type { Team, PlayerRole };

export type BallMode =
  | 'CONTROLLED' | 'FREE' | 'PASS' | 'SHOT'
  | 'AERIAL' | 'GOALKEEPER_HELD' | 'RESTART' | 'OUT_OF_PLAY';

export type MovementMode = 'IDLE' | 'WALK' | 'RUN' | 'SPRINT' | 'BRAKE' | 'ACTION' | 'RECOVERY';

export type ActionPhase = 'WINDUP' | 'CONTACT' | 'RECOVERY';

export type PlayerActionType =
  | 'SHORT_PASS' | 'DRIVEN_PASS' | 'THROUGH_PASS' | 'LOB_PASS' | 'CROSS'
  | 'NORMAL_SHOT' | 'POWER_SHOT' | 'CHIP_SHOT' | 'VOLLEY' | 'HEADER'
  | 'STANDING_TACKLE' | 'POKE_TACKLE' | 'SLIDE_TACKLE' | 'SHOULDER_CHARGE' | 'BLOCK'
  | 'GK_CATCH' | 'GK_PARRY' | 'GK_DIVE' | 'SUPER_SHOT';

export type MatchPhase =
  | 'INTRO' | 'STARTING_POSITIONS' | 'KICKOFF' | 'PLAYING'
  | 'THROW_IN_SETUP' | 'THROW_IN' | 'CORNER_SETUP' | 'CORNER'
  | 'GOAL_KICK_SETUP' | 'GOAL_KICK' | 'FREE_KICK_SETUP' | 'FREE_KICK'
  | 'PENALTY_SETUP' | 'PENALTY' | 'GOAL' | 'HALFTIME'
  | 'EXTRA_TIME' | 'SHOOTOUT' | 'FULLTIME' | 'PAUSED' | 'REPLAY';

export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }

// --- Ball ---

export interface AftertouchState {
  sourcePlayerId: number;
  startedTick: number;
  expiresTick: number;
  lateralInput: number;
  verticalInput: number;
  influence: number;
}

export interface BallState {
  mode: BallMode;
  ownerId: number | null;
  previousOwnerId: number | null;
  lastTouchPlayerId: number | null;
  lastTouchTeamId: Team | null;

  x: number; y: number; z: number;
  prevX: number; prevY: number; prevZ: number;
  vx: number; vy: number; vz: number;
  spin: number;

  ownerSinceTick: number;
  releasedAtTick: number;
  aftertouch: AftertouchState | null;
}

// --- Player ---

export interface PlayerAction {
  type: PlayerActionType;
  phase: ActionPhase;
  startedTick: number;
  contactTick: number;
  recoveryUntilTick: number;
  targetX: number;
  targetY: number;
  targetPlayerId: number | null;
  power: number;
}

export interface PlayerState {
  id: number;
  team: Team;
  role: PlayerRole;
  isCaptain: boolean;

  x: number; y: number;
  prevX: number; prevY: number;
  vx: number; vy: number;
  facing: number;
  desiredDirX: number;
  desiredDirY: number;
  movementMode: MovementMode;

  currentAction: PlayerAction | null;
  slideCooldown: number;
  stunnedUntilTick: number;
  animTime: number;

  // AI
  aiTimer: number;
  aiTargetX: number;
  aiTargetY: number;
  teamAssignment: string;
  utilityScores: Record<string, number>;

  // Formation
  baseX: number;
  baseY: number;
  markingTargetId: number | null;

  // Internal flags
  _brakedThisTurn: boolean;
}

// --- Input ---

export interface ContinuousInput {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  sprintHeld: boolean;
  actionHeld: boolean;
  modifierHeld: boolean;
}

export interface InputEdges {
  actionPressed: boolean;
  actionReleased: boolean;
  tacklePressed: boolean;
  switchPressed: boolean;
  specialPressed: boolean;
  pausePressed: boolean;
}

export interface InputFrame {
  seq: number;
  continuous: ContinuousInput;
  edges: InputEdges;
}

// --- Team ---

export interface TeamRuntimeState {
  assignment: Record<number, string>; // playerId → assignment
  phase: string;
  pressingPlayerId: number | null;
  coverPlayerId: number | null;
}

// --- Match ---

export interface SimulationEvent {
  type: string;
  tick: number;
  [key: string]: unknown;
}

export interface MatchClock {
  timeMs: number;
  half: 1 | 2;
  halfLength: number;
}

export interface RestartState {
  team: Team;
  type: string;
  setupUntilTick: number;
  ballLive: boolean;
}

export interface MatchState {
  tick: number;
  seed: number;
  rngState: number;
  phase: MatchPhase;
  clock: MatchClock;
  score: [number, number];
  ball: BallState;
  players: PlayerState[];
  teams: [TeamRuntimeState, TeamRuntimeState];
  restart: RestartState | null;
  events: SimulationEvent[];
  format: MatchFormat;
  difficulty: Difficulty;
  controlledPlayerId: number;
  lastSwitchTick: number;
  manualLockUntilTick: number;
  banner: string;
  bannerTimer: number;
  debug: boolean;
}

// --- Helper ---

export function createEmptyInput(seq = 0): InputFrame {
  return {
    seq,
    continuous: { moveX: 0, moveY: 0, aimX: 0, aimY: 0, sprintHeld: false, actionHeld: false, modifierHeld: false },
    edges: { actionPressed: false, actionReleased: false, tacklePressed: false, switchPressed: false, specialPressed: false, pausePressed: false },
  };
}
