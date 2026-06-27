/**
 * Futbal Reborn — Gameplay tuning constants.
 * All magic numbers live here. No hardcoded values scattered in code.
 * Values are in game units (1 unit = 1 pixel at 640×360 virtual resolution).
 */

export const SIMULATION_HZ = 60;
export const FIXED_DT = 1 / SIMULATION_HZ;
export const MAX_FRAME_ACCUM = 0.25;

export const VIEW_W = 640;
export const VIEW_H = 360;

// Field (arcade-proportioned, not realistic)
export const FIELD_X = 48;
export const FIELD_Y = 40;
export const FIELD_W = 944;
export const FIELD_H = 480;
export const FIELD_RIGHT = FIELD_X + FIELD_W;
export const FIELD_BOTTOM = FIELD_Y + FIELD_H;
export const FIELD_CX = FIELD_X + FIELD_W / 2;
export const FIELD_CY = FIELD_Y + FIELD_H / 2;

// Goals
export const GOAL_H = 96;
export const GOAL_TOP = FIELD_CY - GOAL_H / 2;
export const GOAL_BOTTOM = FIELD_CY + GOAL_H / 2;
export const GOAL_DEPTH = 24;
export const CROSSBAR_Z = 48;
export const CENTER_CIRCLE_R = 60;
export const PENALTY_BOX_W = 80;
export const PENALTY_BOX_H = 200;
export const GOAL_AREA_W = 36;
export const GOAL_AREA_H = 120;

// Player movement
export const PLAYER_RADIUS = 8;
export const WALK_SPEED = 64;
export const RUN_SPEED = 140;
export const SPRINT_SPEED = 190;
export const RUN_WITH_BALL_SPEED = 120;
export const SPRINT_WITH_BALL_SPEED = 160;
export const BACKWARD_SPEED = 70;
export const ACCEL = 800;
export const SPRINT_ACCEL = 1000;
export const DECEL = 1000;
export const TURN_RATE = 14;
export const TURN_RATE_WITH_BALL = 9;
export const TURN_RATE_SPRINT = 6;

// Ball
export const BALL_RADIUS = 4;
export const BALL_MAX_SPEED = 600;
export const BALL_FRICTION = 240;
export const BALL_AIR_DRAG = 0.15;
export const GRAVITY = 1200;
export const BOUNCE_RESTITUTION = 0.45;
export const BALL_REST_THRESHOLD = 30;
export const PASS_SPEED = 340;
export const DRIVEN_PASS_SPEED = 440;
export const LOB_SPEED = 280;
export const LOB_Z = 180;
export const SHOT_MIN_SPEED = 380;
export const SHOT_MAX_SPEED = 560;
export const SHOOT_CHARGE_TIME = 0.6;

// Control
export const CONTROL_RADIUS = 16;
export const TACKLE_RADIUS = 18;
export const SLIDE_SPEED = 220;
export const SLIDE_DURATION = 0.3;
export const SLIDE_COOLDOWN = 0.8;
export const STUN_DURATION = 0.6;

// Possession
export const POSSESSION_SHIELD = 1.0;
export const GK_HOLD_MAX = 4;

// AI
export const AI_INTERVAL = {
  easy: { min: 350, max: 500 },
  normal: { min: 220, max: 350 },
  hard: { min: 120, max: 220 },
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Team = 0 | 1;
export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export const DIFFICULTY = {
  easy: { reactionMs: 420, precision: 0.55, aggression: 0.35, passRisk: 0.3 },
  normal: { reactionMs: 280, precision: 0.78, aggression: 0.6, passRisk: 0.55 },
  hard: { reactionMs: 170, precision: 0.93, aggression: 0.85, passRisk: 0.75 },
} as const;

// Match
export const DEFAULT_HALF_LENGTH = 120; // 2 minutes
export const GOAL_CELEBRATION = 2.5;
export const KICKOFF_DELAY = 1.0;

// Input
export const DEADZONE = 0.18;
export const WALK_THRESHOLD = 0.45;
export const RUN_THRESHOLD = 0.80;

// Aftertouch
export const AFTERTOUCH_WINDOWS: Record<string, number> = {
  SHORT_PASS: 8,
  DRIVEN_PASS: 10,
  THROUGH_PASS: 10,
  LOB_PASS: 12,
  NORMAL_SHOT: 14,
  POWER_SHOT: 18,
  SUPER_SHOT: 22,
};
export const AFTERTOUCH_MAX_LATERAL = 600;
export const AFTERTOUCH_MAX_VERTICAL = 300;

// Team colors (original)
export const TEAM_COLORS = {
  home: { jersey: '#e23b3b', shorts: '#1f2937', trim: '#ffffff' },
  away: { jersey: '#2f7fd4', shorts: '#0b1f3a', trim: '#ffd23f' },
} as const;

export const FIELD_TOP = FIELD_Y;
export const FIELD_COLORS = {
  grassA: '#2f8f4e',
  grassB: '#2a8145',
  line: '#eafff0',
} as const;

// Formats
export type MatchFormat = '3v3' | '5v5' | '7v7' | '11v11';
export const FORMAT_PLAYERS: Record<MatchFormat, number> = {
  '3v3': 3, '5v5': 5, '7v7': 7, '11v11': 11,
};
