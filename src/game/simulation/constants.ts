/**
 * Kačanovská FIFA — core simulation constants.
 *
 * Everything here is pure data (no DOM, no Canvas, no Phaser) so the same
 * module can run on the client (for prediction) and on an authoritative
 * Node.js server. All units are "world pixels" at the virtual internal
 * resolution of 640 x 360.
 */

/** Virtual internal render resolution. */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** Fixed simulation timestep in seconds (60 Hz). */
export const FIXED_DT = 1 / 60;

/** Maximum accumulated time processed per frame (avoids spiral of death). */
export const MAX_FRAME_ACCUM = 0.25;

// --- Field geometry (world coordinates) ---------------------------------

/** Top-left of the playable field area. */
export const FIELD_X = 56;
export const FIELD_Y = 44;
/** Playable field size (larger than the 640x360 viewport). */
export const FIELD_W = 1120;
export const FIELD_H = 640;

/** Top boundary of the playable field (alias of FIELD_Y). */
export const FIELD_TOP = FIELD_Y;
export const FIELD_RIGHT = FIELD_X + FIELD_W;
export const FIELD_BOTTOM = FIELD_Y + FIELD_H;
export const FIELD_CX = FIELD_X + FIELD_W / 2;
export const FIELD_CY = FIELD_Y + FIELD_H / 2;

/** Goal mouth height (distance between posts). */
export const GOAL_H = 148;
export const GOAL_TOP = FIELD_CY - GOAL_H / 2;
export const GOAL_BOTTOM = FIELD_CY + GOAL_H / 2;
/** Depth of the goal box behind the goal line. */
export const GOAL_DEPTH = 28;
/** Cross-bar height — ball must be below this to score. */
export const CROSSBAR_Z = 34;

/** Penalty box dimensions. */
export const PENALTY_BOX_W = 132;
export const PENALTY_BOX_H = 300;
/** Goal area (small box) dimensions. */
export const GOAL_AREA_W = 56;
export const GOAL_AREA_H = 176;

export const CENTER_CIRCLE_R = 84;

// --- Offside -----------------------------------------------------------

/** Master toggle for the offside rule. */
export const OFFSIDE_ENABLED = true;
/** A receiver is offside if, at the moment of the pass, they are in the
 *  opponent's half and nearer the goal line than the second-last defender
 *  by more than this tolerance (px). */
export const OFFSIDE_TOLERANCE = 6;
/** When an offside is detected, the restart is an indirect free kick for the
 *  defending team at the offside position. */
export const OFFSIDE_BANNER = 'OFSAJD';

// --- Players ------------------------------------------------------------

export const PLAYER_RADIUS = 9;
export const PLAYERS_PER_TEAM = 5;

export const PLAYER_MAX_SPEED = 96; // px/s walk/run
export const PLAYER_SPRINT_SPEED = 138;
export const PLAYER_ACCEL = 520;
export const PLAYER_DECEL = 760;
export const GK_MAX_SPEED = 78;

/** Range at which a player can control/dribble the ball. */
export const CONTROL_RADIUS = 18;
/** Range at which a tackle attempt can win the ball. */
export const TACKLE_RADIUS = 20;
/** Slide tackle dash speed. */
export const SLIDE_SPEED = 190;
export const SLIDE_DURATION = 0.32; // s
export const SLIDE_COOLDOWN = 0.9; // s
/** Stun duration after being dispossessed. */
export const STUN_DURATION = 0.7;
/** Recovery after a missed slide. */
export const SLIDE_RECOVER = 0.45;
/** Time after a restart (kickoff/throw-in/corner/free-kick) during which the
 *  restart team's possession is protected — opponents cannot tackle/steal. */
export const POSSESSION_SHIELD = 1.4;

// --- Ball ---------------------------------------------------------------

export const BALL_RADIUS = 5;
export const BALL_MAX_SPEED = 560;
export const BALL_FRICTION = 230; // ground decel px/s^2
export const BALL_AIR_DRAG = 0.12; // per second (applied to horizontal v while airborne)
export const GRAVITY = 980; // px/s^2 (downward on z)
export const BOUNCE_RESTITUTION = 0.46;
export const BALL_REST_THRESHOLD = 28; // below this speed, snaps to rest on bounce
export const BALL_PASS_SPEED = 300;
export const BALL_HIGH_PASS_SPEED = 250;
export const BALL_HIGH_PASS_Z = 130; // initial upward velocity for a lob
export const BALL_SHOOT_MIN = 340;
export const BALL_SHOOT_MAX = 520;
export const SHOOT_CHARGE_TIME = 0.7; // s to reach full power
export const DRIBBLE_NUDGE = 56; // forward nudge while dribbling

// --- Match ---------------------------------------------------------------

export const HALF_LENGTH_OPTIONS = [60, 120, 180, 240] as const;
export const DEFAULT_HALF_LENGTH = 120; // 2 minutes per half
export const GOAL_CELEBRATION_TIME = 2.4; // s
export const KICKOFF_DELAY = 1.2; // s before ball is live after kickoff
export const RESTART_SETUP_TIME = 1.4; // s for players to settle on restart

// --- Networking ---------------------------------------------------------

export const SNAPSHOT_RATE = 20; // snapshots per second the server sends
export const INPUT_RATE = 30; // inputs per second the client sends
export const INTERP_DELAY = 0.1; // s of interpolation buffer for remote ents
export const MAX_INPUT_BUFFER = 64;
export const DISCONNECT_GRACE = 8; // s a match is preserved after disconnect

// --- AI -----------------------------------------------------------------

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_PARAMS: Record<
  Difficulty,
  {
    reactionMs: number; // AI re-evaluation interval
    precision: number; // 0..1 aiming/decision accuracy
    aggression: number; // 0..1 tackling/pressing intensity
    passRisk: number; // 0..1 willingness to attempt risky passes
  }
> = {
  easy: { reactionMs: 520, precision: 0.55, aggression: 0.35, passRisk: 0.3 },
  normal: { reactionMs: 300, precision: 0.78, aggression: 0.6, passRisk: 0.55 },
  hard: { reactionMs: 160, precision: 0.93, aggression: 0.85, passRisk: 0.75 },
};

// --- Colors (palette shared with renderer) ------------------------------

export const TEAM_COLORS = {
  home: { jersey: '#e23b3b', shorts: '#1f2937', trim: '#ffffff', skin: '#f1c27d' },
  away: { jersey: '#2f7fd4', shorts: '#0b1f3a', trim: '#ffd23f', skin: '#f1c27d' },
} as const;

export const FIELD_COLORS = {
  grassA: '#2f8f4e',
  grassB: '#2a8145',
  line: '#eafff0',
  border: '#1c5e34',
} as const;
