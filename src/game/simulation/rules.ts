/**
 * Futsal match rules: out-of-bounds, goals, goal posts, restarts, periods.
 * Futsal has NO offside. Throw-ins are taken with the foot (futsal style).
 */
import {
  BALL_RADIUS, CROSSBAR_Z, FIELD_BOTTOM, FIELD_CX, FIELD_CY, FIELD_RIGHT,
  FIELD_TOP, FIELD_X, GOAL_BOTTOM, GOAL_CELEBRATION_TIME, GOAL_DEPTH, GOAL_H,
  GOAL_TOP, KICKOFF_DELAY, PENALTY_BOX_H, PENALTY_BOX_W, PENALTY_SPOT_X,
  POSSESSION_SHIELD, RESTART_SETUP_TIME, GK_HOLD_MAX, m,
} from './constants';
import type { MatchState, PlayerEntity, RestartType, Team } from './types';
import { resetToFormation } from './formation';

export type FieldEvent =
  | { type: 'goal'; team: Team }
  | { type: 'throwIn'; team: Team; x: number; y: number }
  | { type: 'corner'; team: Team; side: 'left' | 'right' }
  | { type: 'goalKick'; team: Team }
  | { type: 'none' };

const POST_R = 4;
const POSTS = [
  { x: FIELD_X, y: GOAL_TOP }, { x: FIELD_X, y: GOAL_BOTTOM },
  { x: FIELD_RIGHT, y: GOAL_TOP }, { x: FIELD_RIGHT, y: GOAL_BOTTOM },
];

export function resolveGoalPosts(state: MatchState): void {
  const ball = state.ball;
  for (const post of POSTS) {
    const dx = ball.x - post.x;
    const dy = ball.y - post.y;
    const d = Math.hypot(dx, dy);
    const min = POST_R + BALL_RADIUS;
    if (d > 0 && d < min) {
      const nx = dx / d, ny = dy / d;
      ball.x = post.x + nx * min;
      ball.y = post.y + ny * min;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) { ball.vx -= 2 * dot * nx * 0.6; ball.vy -= 2 * dot * ny * 0.6; }
    }
  }
}

export function checkFieldEvents(state: MatchState): FieldEvent {
  const ball = state.ball;
  const lastTeam = state.lastTouchTeam;
  // Ball must FULLY cross the line (use BALL_RADIUS).
  if (ball.y < FIELD_TOP - BALL_RADIUS) {
    const team: Team = lastTeam == null ? 0 : (1 - lastTeam) as Team;
    return { type: 'throwIn', team, x: ball.x, y: FIELD_TOP + 2 };
  }
  if (ball.y > FIELD_BOTTOM + BALL_RADIUS) {
    const team: Team = lastTeam == null ? 0 : (1 - lastTeam) as Team;
    return { type: 'throwIn', team, x: ball.x, y: FIELD_BOTTOM - 2 };
  }
  if (ball.x < FIELD_X - BALL_RADIUS) {
    if (ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM && ball.z < CROSSBAR_Z) {
      if (ball.indirect) return { type: 'goalKick', team: 0 };
      return { type: 'goal', team: 1 };
    }
    if (lastTeam === 1) return { type: 'goalKick', team: 0 };
    return { type: 'corner', team: 1, side: 'left' };
  }
  if (ball.x > FIELD_RIGHT + BALL_RADIUS) {
    if (ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM && ball.z < CROSSBAR_Z) {
      if (ball.indirect) return { type: 'goalKick', team: 1 };
      return { type: 'goal', team: 0 };
    }
    if (lastTeam === 0) return { type: 'goalKick', team: 1 };
    return { type: 'corner', team: 0, side: 'right' };
  }
  return { type: 'none' };
}

export function setupRestart(state: MatchState, type: RestartType, team: Team): void {
  const ball = state.ball;
  ball.vx = 0; ball.vy = 0; ball.vz = 0;
  ball.ownerId = null; ball.releaseCooldown = 0.1; ball.z = 0;
  ball.indirect = false;
  ball.ballState = 'OUT_OF_PLAY';
  if (type != null) {
    ball.possessionShield = POSSESSION_SHIELD;
    ball.shieldTeam = team;
  } else {
    ball.possessionShield = 0;
    ball.shieldTeam = null;
  }
  switch (type) {
    case 'kickoff':
      ball.x = FIELD_CX; ball.y = FIELD_CY;
      resetToFormation(state.players);
      break;
    case 'goalKick': {
      ball.x = team === 0 ? FIELD_X + m(1.5) : FIELD_RIGHT - m(1.5);
      ball.y = FIELD_CY;
      break;
    }
    case 'corner': {
      ball.x = team === 0 ? FIELD_RIGHT - 4 : FIELD_X + 4;
      ball.y = ball.y < FIELD_CY ? FIELD_TOP + 4 : FIELD_BOTTOM - 4;
      break;
    }
    case 'throwIn':
    case 'freeKick':
      ball.x = Math.max(FIELD_X + 2, Math.min(FIELD_RIGHT - 2, ball.x));
      ball.y = Math.max(FIELD_TOP + 2, Math.min(FIELD_BOTTOM - 2, ball.y));
      break;
    case 'penalty': {
      const oppGoalX = team === 0 ? FIELD_RIGHT : FIELD_X;
      ball.x = team === 0 ? oppGoalX - PENALTY_SPOT_X : oppGoalX + PENALTY_SPOT_X;
      ball.y = FIELD_CY;
      ball.possessionShield = 1.2;
      break;
    }
    case null: break;
  }
  state.restartType = type;
  state.restartTeam = team;
  state.restartTimer = RESTART_SETUP_TIME;
}

export function setupFreeKick(state: MatchState, team: Team, x: number, y: number, indirect: boolean): void {
  state.ball.x = x; state.ball.y = y;
  setupRestart(state, 'freeKick', team);
  state.ball.indirect = indirect;
  state.banner = indirect ? 'NEPRIAMY KOP' : 'VOĽNÝ KOP';
  state.bannerTimer = 1.2;
}

export function setupPenalty(state: MatchState, team: Team): void {
  setupRestart(state, 'penalty', team);
  state.banner = 'PENALTA';
  state.bannerTimer = 1.6;
}

export function awardFoul(state: MatchState, foulingTeam: Team, x: number, y: number): boolean {
  const attacking: Team = (1 - foulingTeam) as Team;
  const inOwnBoxLeft = foulingTeam === 0 && x <= FIELD_X + PENALTY_BOX_W && Math.abs(y - FIELD_CY) <= PENALTY_BOX_H / 2;
  const inOwnBoxRight = foulingTeam === 1 && x >= FIELD_RIGHT - PENALTY_BOX_W && Math.abs(y - FIELD_CY) <= PENALTY_BOX_H / 2;
  if (inOwnBoxLeft || inOwnBoxRight) { setupPenalty(state, attacking); return true; }
  setupFreeKick(state, attacking, x, y, false);
  return false;
}

export function setupKickoff(state: MatchState, team: Team): void {
  state.period = 'kickoff';
  state.banner = 'VÝKOP';
  state.bannerTimer = KICKOFF_DELAY;
  state.offsideCheck = null;
  setupRestart(state, 'kickoff', team);
  const mid = state.players.find((p) => p.team === team && p.role === 'fixo');
  if (mid) {
    mid.x = FIELD_CX - (team === 0 ? m(0.5) : -m(0.5));
    mid.y = FIELD_CY;
    state.ball.ownerId = mid.id;
    state.ball.x = FIELD_CX; state.ball.y = FIELD_CY;
    state.ball.ballState = 'CONTROLLED';
    for (const p of state.players) p.hasBall = p.id === mid.id;
  }
  state.restartTimer = 0.6;
}

export function awardGoal(state: MatchState, team: Team): void {
  state.score[team]++;
  state.period = 'goal';
  state.lastGoalTeam = team;
  state.restartTimer = GOAL_CELEBRATION_TIME;
  state.banner = 'GÓL!';
  state.bannerTimer = GOAL_CELEBRATION_TIME;
  state.offsideCheck = null;
  state.ball.ballState = 'OUT_OF_PLAY';
  for (const p of state.players) if (p.team === team) p.state = 'celebrate';
}

// Futsal: offside disabled. Functions kept for API compat but no-op.
export function isReceiverOffside(_state: MatchState, _receiver: PlayerEntity): boolean {
  return false;
}
export function awardOffside(_state: MatchState, _x: number, _y: number): void {
  /* no offside in futsal */
}

export { GOAL_TOP, GOAL_BOTTOM, GOAL_H, GOAL_DEPTH, GK_HOLD_MAX };
