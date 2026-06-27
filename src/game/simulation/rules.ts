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
  OFFSIDE_BANNER,
  OFFSIDE_ENABLED,
  OFFSIDE_TOLERANCE,
  PENALTY_BOX_H,
  PENALTY_BOX_W,
  PENALTY_SPOT_X,
  POSSESSION_SHIELD,
  RESTART_SETUP_TIME,
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
      // Indirect free kick cannot be scored directly — no goal, goal kick.
      if (ball.indirect) return { type: 'goalKick', team: 0 };
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
      if (ball.indirect) return { type: 'goalKick', team: 1 };
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
  ball.indirect = false;
  // Restart teams get a brief possession shield so opponents can't instantly
  // steal the ball before the restart team has touched it.
  if (type === 'kickoff' || type === 'throwIn' || type === 'corner' || type === 'freeKick' || type === 'goalKick' || type === 'penalty') {
    ball.possessionShield = POSSESSION_SHIELD;
    ball.shieldTeam = team;
  } else {
    ball.possessionShield = 0;
    ball.shieldTeam = null;
  }

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
    case 'freeKick': {
      // Ball placed at the offence spot; callers set ball.x/y before invoking.
      ball.x = Math.max(FIELD_X + 2, Math.min(FIELD_RIGHT - 2, ball.x));
      ball.y = Math.max(FIELD_TOP + 2, Math.min(FIELD_BOTTOM - 2, ball.y));
      break;
    }
    case 'penalty': {
      // Penalty kick from the penalty spot of the defending team's goal.
      const defendingGoalX = team === 0 ? FIELD_X : FIELD_RIGHT; // team scores in opp goal
      // `team` is the kicking team; they attack the opponent's goal.
      const oppGoalX = team === 0 ? FIELD_RIGHT : FIELD_X;
      void defendingGoalX;
      ball.x = team === 0 ? oppGoalX - PENALTY_SPOT_X : oppGoalX + PENALTY_SPOT_X;
      ball.y = FIELD_CY;
      // Longer shield so the taker can set up.
      ball.possessionShield = 1.2;
      break;
    }
    case null:
      break;
  }

  state.restartType = type;
  state.restartTeam = team;
  state.restartTimer = RESTART_SETUP_TIME;
}

/**
 * Award a free kick to `team` at (x, y). If `indirect` is true the ball must
 * touch another player before a goal can be scored (used for offside and
 * non-shooting fouls); direct free kicks can be scored.
 */
export function setupFreeKick(state: MatchState, team: Team, x: number, y: number, indirect: boolean): void {
  state.ball.x = x;
  state.ball.y = y;
  setupRestart(state, 'freeKick', team);
  state.ball.indirect = indirect;
  state.banner = indirect ? 'NEPRIAMY KOP' : 'VOĽNÝ KOP';
  state.bannerTimer = 1.2;
}

/** Award a penalty kick to `team` (they attack the opponent's goal). */
export function setupPenalty(state: MatchState, team: Team): void {
  setupRestart(state, 'penalty', team);
  state.banner = 'PENALTA';
  state.bannerTimer = 1.6;
}

/**
 * Award a foul committed by `foulingTeam` at (x, y). If the offence happened
 * inside the fouling team's own penalty area, a penalty kick is awarded to the
 * opposing team; otherwise a direct free kick is given (fouls from slides are
 * "tripping" — direct). Returns true if a penalty was awarded.
 */
export function awardFoul(state: MatchState, foulingTeam: Team, x: number, y: number): boolean {
  const attackingTeam: Team = (1 - foulingTeam) as Team;
  // Penalty if the foul is inside the fouling team's own penalty area.
  const inOwnBoxLeft = foulingTeam === 0 && x <= FIELD_X + PENALTY_BOX_W && Math.abs(y - FIELD_CY) <= PENALTY_BOX_H / 2;
  const inOwnBoxRight = foulingTeam === 1 && x >= FIELD_RIGHT - PENALTY_BOX_W && Math.abs(y - FIELD_CY) <= PENALTY_BOX_H / 2;
  if (inOwnBoxLeft || inOwnBoxRight) {
    setupPenalty(state, attackingTeam);
    return true;
  }
  // Direct free kick to the attacking team at the foul spot.
  setupFreeKick(state, attackingTeam, x, y, false);
  return false;
}

/** Begin a kickoff for the given team. */
export function setupKickoff(state: MatchState, team: Team): void {
  state.period = 'kickoff';
  state.banner = 'VÝKOP';
  state.bannerTimer = KICKOFF_DELAY;
  state.offsideCheck = null;
  setupRestart(state, 'kickoff', team);
  // Hand the ball to the kicking team's midfielder so play starts immediately
  // (the AI / human can then pass or dribble). The possession shield protects
  // them from being instantly stripped.
  const mid = state.players.find((p) => p.team === team && p.role === 'MID');
  if (mid) {
    mid.x = FIELD_CX - (team === 0 ? 16 : -16);
    mid.y = FIELD_CY;
    state.ball.ownerId = mid.id;
    state.ball.x = FIELD_CX;
    state.ball.y = FIELD_CY;
    for (const p of state.players) p.hasBall = p.id === mid.id;
  }
  // Short kickoff pause so the banner is visible, then live play.
  state.restartTimer = 0.6;
}

/** Award a goal and enter the celebration period. */
export function awardGoal(state: MatchState, team: Team): void {
  state.score[team]++;
  state.period = 'goal';
  state.lastGoalTeam = team;
  state.restartTimer = GOAL_CELEBRATION_TIME;
  state.banner = 'GÓL!';
  state.bannerTimer = GOAL_CELEBRATION_TIME;
  state.offsideCheck = null;
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

// --- Offside ---------------------------------------------------------------

/**
 * Was `receiver` in an offside position at the instant of the pass recorded
 * in `state.offsideCheck`?
 *
 * Offside (simplified, no passive interference): the receiver is offside if,
 * at the moment of the pass, they were in the opponent's half AND nearer the
 * opponent's goal line than the second-last defender (excluding the GK) by
 * more than OFFSIDE_TOLERANCE. A receiver level with or behind the passer is
 * never offside.
 */
export function isReceiverOffside(state: MatchState, receiver: PlayerEntity): boolean {
  if (!OFFSIDE_ENABLED) return false;
  const check = state.offsideCheck;
  if (!check) return false;
  if (receiver.team !== check.passerTeam) return false;

  const pos = check.positions.find((p) => p.id === receiver.id);
  if (!pos) return false;

  // Receiver must be in the opponent's half.
  const inOppHalf =
    receiver.team === 0 ? pos.x > FIELD_CX : pos.x < FIELD_CX;
  if (!inOppHalf) return false;

  // Level with or behind the passer -> onside.
  const behindPasser =
    receiver.team === 0 ? pos.x <= check.passerX : pos.x >= check.passerX;
  if (behindPasser) return false;

  // Second-last defender of the opposing team (exclude the GK).
  const opp: Team = (1 - receiver.team) as Team;
  const defenderXs = check.positions
    .filter((p) => p.team === opp)
    .map((p) => p.x)
    .sort((a, b) => (receiver.team === 0 ? b - a : a - b)); // nearest goal first
  // The GK is usually the nearest; the second element is the second-last.
  const secondLast = defenderXs.length >= 2 ? defenderXs[1] : defenderXs[0];
  if (secondLast == null) return false;

  const nearer =
    receiver.team === 0
      ? pos.x > secondLast + OFFSIDE_TOLERANCE
      : pos.x < secondLast - OFFSIDE_TOLERANCE;
  return nearer;
}

/** Award an offside: indirect free kick to the defending team at the spot. */
export function awardOffside(state: MatchState, spotX: number, spotY: number): void {
  if (!state.offsideCheck) return;
  const defendingTeam: Team = (1 - state.offsideCheck.passerTeam) as Team;
  state.offsides[state.offsideCheck.passerTeam]++;
  state.offsideCheck = null;
  setupFreeKick(state, defendingTeam, spotX, spotY, true);
  state.banner = OFFSIDE_BANNER;
  state.bannerTimer = 1.4;
}
