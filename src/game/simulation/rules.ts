/**
 * Match rules: out-of-bounds, goals, goal posts, restarts, periods.
 */
import {
  BALL_RADIUS,
  CROSSBAR_Z,
  FIELD_BOTTOM,
  FIELD_CX,
  FIELD_CY,
  FIELD_RIGHT,
  FIELD_TOP,
  FIELD_X,
  FIELD_Y,
  GOAL_BOTTOM,
  GOAL_CELEBRATION_TIME,
  GOAL_DEPTH,
  GOAL_H,
  GOAL_TOP,
  KICKOFF_DELAY,
  RESTART_SETUP_TIME,
} from './constants';
import type { MatchState, RestartType, Team } from './types';
import { resetToFormation } from './formation';

export type FieldEvent =
  | { type: 'goal'; team: Team }
  | { type: 'throwIn'; team: Team; x: number; y: number }
  | { type: 'corner'; team: Team; side: 'left' | 'right' }
  | { type: 'goalKick'; team: Team }
  | { type: 'none' };

const POST_R = 4;

/** Goal-post positions (the four uprights of both goals). */
const POSTS: Array<{ x: number; y: number }> = [
  { x: FIELD_X, y: GOAL_TOP },
  { x: FIELD_X, y: GOAL_BOTTOM },
  { x: FIELD_RIGHT, y: GOAL_TOP },
  { x: FIELD_RIGHT, y: GOAL_BOTTOM },
];

/** Resolve collisions against goal posts (bounces). Mutates ball. */
export function resolveGoalPosts(state: MatchState): void {
  const ball = state.ball;
  for (const post of POSTS) {
    const dx = ball.x - post.x;
    const dy = ball.y - post.y;
    const d = Math.hypot(dx, dy);
    const min = POST_R + BALL_RADIUS;
    if (d > 0 && d < min) {
      const nx = dx / d;
      const ny = dy / d;
      // Push out.
      ball.x = post.x + nx * min;
      ball.y = post.y + ny * min;
      // Reflect velocity.
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx * 0.6;
        ball.vy -= 2 * dot * ny * 0.6;
      }
    }
  }
}

/**
 * Check whether the ball has left the field and produce the appropriate
 * event. Does NOT mutate state beyond clamping the ball just inside the
 * boundary so detection is stable. The caller applies the restart.
 */
export function checkFieldEvents(state: MatchState): FieldEvent {
  const ball = state.ball;
  const lastTeam = state.lastTouchTeam;

  // --- Side lines (throw-in) ---
  if (ball.y < FIELD_TOP - BALL_RADIUS) {
    const team: Team = lastTeam == null ? 0 : (1 - lastTeam) as Team;
    return { type: 'throwIn', team, x: ball.x, y: FIELD_TOP + 2 };
  }
  if (ball.y > FIELD_BOTTOM + BALL_RADIUS) {
    const team: Team = lastTeam == null ? 0 : (1 - lastTeam) as Team;
    return { type: 'throwIn', team, x: ball.x, y: FIELD_BOTTOM - 2 };
  }

  // --- Goal lines ---
  // Left goal line (home's goal). Away scores here.
  if (ball.x < FIELD_X - BALL_RADIUS) {
    if (ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM && ball.z < CROSSBAR_Z) {
      return { type: 'goal', team: 1 };
    }
    // Not a goal -> corner or goal kick.
    // Left goal is defended by home (team 0). Attackers = away (team 1).
    if (lastTeam === 1) {
      // Attacking team put it out -> goal kick to defenders (home).
      return { type: 'goalKick', team: 0 };
    } else {
      // Defender put it out -> corner to attackers (away).
      return { type: 'corner', team: 1, side: 'left' };
    }
  }
  // Right goal line (away's goal). Home scores here.
  if (ball.x > FIELD_RIGHT + BALL_RADIUS) {
    if (ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM && ball.z < CROSSBAR_Z) {
      return { type: 'goal', team: 0 };
    }
    if (lastTeam === 0) {
      return { type: 'goalKick', team: 1 };
    } else {
      return { type: 'corner', team: 0, side: 'right' };
    }
  }

  return { type: 'none' };
}

/** Position the ball & possession for a restart. */
export function setupRestart(state: MatchState, type: RestartType, team: Team): void {
  const ball = state.ball;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.ownerId = null;
  ball.releaseCooldown = 0.1;
  ball.z = 0;

  switch (type) {
    case 'kickoff':
      ball.x = FIELD_CX;
      ball.y = FIELD_CY;
      resetToFormation(state.players);
      break;
    case 'goalKick': {
      const gx = team === 0 ? FIELD_X + 46 : FIELD_RIGHT - 46;
      ball.x = gx;
      ball.y = FIELD_CY;
      break;
    }
    case 'corner': {
      const cx = team === 0 ? FIELD_RIGHT - 4 : FIELD_X + 4;
      // Corner on the side the ball went out — approximate with the nearer end.
      const cy = state.ball.y < FIELD_CY ? FIELD_TOP + 4 : FIELD_BOTTOM - 4;
      ball.x = cx;
      ball.y = cy;
      break;
    }
    case 'throwIn': {
      // ball.x/y already set by the event; clamp into field.
      ball.x = Math.max(FIELD_X + 2, Math.min(FIELD_RIGHT - 2, ball.x));
      ball.y = Math.max(FIELD_TOP + 2, Math.min(FIELD_BOTTOM - 2, ball.y));
      break;
    }
    case null:
      break;
  }

  state.restartType = type;
  state.restartTeam = team;
  state.restartTimer = RESTART_SETUP_TIME;
}

/** Begin a kickoff for the given team. */
export function setupKickoff(state: MatchState, team: Team): void {
  state.period = 'kickoff';
  state.banner = 'VÝKOP';
  state.bannerTimer = KICKOFF_DELAY;
  setupRestart(state, 'kickoff', team);
}

/** Award a goal and enter the celebration period. */
export function awardGoal(state: MatchState, team: Team): void {
  state.score[team]++;
  state.period = 'goal';
  state.lastGoalTeam = team;
  state.restartTimer = GOAL_CELEBRATION_TIME;
  state.banner = 'GÓL!';
  state.bannerTimer = GOAL_CELEBRATION_TIME;
  // Mark scorers as celebrating briefly.
  for (const p of state.players) {
    if (p.team === team) p.state = 'celebrate';
  }
}

/** Advance the match period after halftime/fulltime conditions. */
export function advancePeriod(state: MatchState): void {
  if (state.period === 'halftime') {
    state.half = 2;
    state.timeMs = 0;
    // The team that did NOT kick off at the start kicks off the 2nd half.
    setupKickoff(state, 1 as Team);
    return;
  }
  if (state.period === 'fulltime') {
    // Stays fulltime — the UI layer shows results.
    return;
  }
}
