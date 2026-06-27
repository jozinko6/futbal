/**
 * Kačanovská FIFA — constants surface.
 *
 * Field GEOMETRY is defined here in PIXELS (used by renderer/camera/field.ts).
 * Movement/ball/AI/tactics tunables are re-exported from `./tacticsConfig`
 * (SI units: m/s, m, seconds). New simulation code imports from tacticsConfig
 * directly and converts with `mps()` / `m()` at the point of use.
 */
import {
  METER_PX, mps, m,
  MOVEMENT, BALL, DEFENSE, PASSING, SHOOTING, AI_INTERVALS,
  DIFFICULTY_PARAMS, TEAM_COLORS, FIELD_COLORS, FORMATION_121_HOME, TEAM_TACTICS, STAMINA,
  FIXED_DT as TC_FIXED_DT, MAX_FRAME_ACCUM as TC_MAX_FRAME_ACCUM,
  DEFAULT_HALF_LENGTH as TC_DEFAULT_HALF_LENGTH,
  HALF_LENGTH_OPTIONS as TC_HALF_LENGTH_OPTIONS,
  GOAL_CELEBRATION_TIME, KICKOFF_DELAY, RESTART_SETUP_TIME,
  POSSESSION_SHIELD, GK_HOLD_MAX, PLAYERS_PER_TEAM,
  PENALTY_SHOOTOUT_KICKS, PENALTY_SPOT_X_M,
  SNAPSHOT_RATE, INPUT_RATE, INTERP_DELAY, MAX_INPUT_BUFFER, DISCONNECT_GRACE,
  type Difficulty, type FutsalRole, type TeamPhase, type BallStateName, type MatchFormat,
  FORMAT_PLAYER_COUNT,
} from './tacticsConfig';

// Re-export tactical config
export { METER_PX, mps, m, MOVEMENT, BALL, DEFENSE, PASSING, SHOOTING, AI_INTERVALS, TEAM_TACTICS, STAMINA };
export { DIFFICULTY_PARAMS, TEAM_COLORS, FIELD_COLORS, FORMATION_121_HOME };
export { GOAL_CELEBRATION_TIME, KICKOFF_DELAY, RESTART_SETUP_TIME, POSSESSION_SHIELD, GK_HOLD_MAX, PLAYERS_PER_TEAM };
export { PENALTY_SHOOTOUT_KICKS, SNAPSHOT_RATE, INPUT_RATE, INTERP_DELAY, MAX_INPUT_BUFFER, DISCONNECT_GRACE };
export type { Difficulty, FutsalRole, TeamPhase, BallStateName, MatchFormat };
export { FORMAT_PLAYER_COUNT };

// --- Pixel geometry (1 m = 32 px; field ~35 × 19 m) -----------------------
export const VIEW_W = 640;
export const VIEW_H = 360;
export const FIELD_X = 56;
export const FIELD_Y = 44;
export const FIELD_W = 1120; // 35 m
export const FIELD_H = 608; // 19 m
export const FIELD_TOP = FIELD_Y;
export const FIELD_BOTTOM = FIELD_Y + FIELD_H;
export const FIELD_RIGHT = FIELD_X + FIELD_W;
export const FIELD_CX = FIELD_X + FIELD_W / 2;
export const FIELD_CY = FIELD_Y + FIELD_H / 2;

export const GOAL_H = 3 * METER_PX; // 96 px (futsal)
export const GOAL_TOP = FIELD_CY - GOAL_H / 2;
export const GOAL_BOTTOM = FIELD_CY + GOAL_H / 2;
export const GOAL_DEPTH = METER_PX;
export const CROSSBAR_Z = 2.2 * METER_PX;
export const PENALTY_BOX_W = 6 * METER_PX;
export const PENALTY_BOX_H = 10 * METER_PX;
export const GOAL_AREA_W = 3 * METER_PX;
export const GOAL_AREA_H = 6 * METER_PX;
export const CENTER_CIRCLE_R = 3 * METER_PX;
export const PENALTY_SPOT_X = PENALTY_SPOT_X_M * METER_PX;

// --- Time / match (re-exported under legacy names) -----------------------
export const FIXED_DT = TC_FIXED_DT;
export const MAX_FRAME_ACCUM = TC_MAX_FRAME_ACCUM;
export const DEFAULT_HALF_LENGTH = TC_DEFAULT_HALF_LENGTH;
export const HALF_LENGTH_OPTIONS = TC_HALF_LENGTH_OPTIONS;
export const SHOOT_CHARGE_TIME = BALL.shootChargeTime;

// --- Player (pixel conversions) -------------------------------------------
export const PLAYER_RADIUS = m(MOVEMENT.radius);
export const CONTROL_RADIUS = m(DEFENSE.controlRadius);
export const TACKLE_RADIUS = m(DEFENSE.tackleRadius);

// --- Ball (pixel conversions) ---------------------------------------------
export const BALL_RADIUS = m(BALL.radius);
export const BALL_MAX_SPEED = mps(BALL.maxSpeed);
export const BALL_FRICTION = mps(BALL.friction);
export const BALL_AIR_DRAG = BALL.airDrag;
export const GRAVITY = mps(BALL.gravity);
export const BOUNCE_RESTITUTION = BALL.bounceRestitution;
export const BALL_REST_THRESHOLD = mps(BALL.restThreshold);
export const BALL_PASS_SPEED = mps(BALL.passSpeed.short);
export const BALL_HIGH_PASS_SPEED = mps(BALL.passSpeed.lob);
export const BALL_HIGH_PASS_Z = mps(BALL.lobZ);
export const BALL_SHOOT_MIN = mps(BALL.shootMin);
export const BALL_SHOOT_MAX = mps(BALL.shootMax);
export const DRIBBLE_NUDGE = mps(2);

// --- Offside: DISABLED in futsal ------------------------------------------
export const OFFSIDE_ENABLED = false;
export const OFFSIDE_TOLERANCE = 0;
export const OFFSIDE_BANNER = 'OFSAJD';

// --- Legacy role alias (renderer spriteSheet uses 'GK' historically) -----
export const GK_ROLE = 'goalkeeper' as const;
