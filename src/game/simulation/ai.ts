/**
 * Utility-based individual AI with a state machine.
 *
 * Each tick (on the player's decision interval) every possible action is
 * scored 0..1; the highest wins. AI reads ONLY the current state (never
 * future inputs). Decisions re-evaluate on an interval jittered by the
 * seeded RNG (Easy/Normal/Hard ranges).
 */
import {
  FIELD_CX, FIELD_CY, FIELD_RIGHT, FIELD_X, m, mps,
  DIFFICULTY_PARAMS, AI_INTERVALS, MOVEMENT, FIXED_DT,
  type FutsalRole,
} from './constants';
import type { AiAction, MatchState, PlayerEntity, Team, WithBallAction, OffBallAction } from './types';
import { dist, len, angleTo } from './math';
import { rngFloat } from './rng';
import { applyMovement, containMovement, pass, shoot, startTackle, pokeTackle, tryTackle, standingTackle, shoulderChallenge } from './player';
import { attackingGoalX } from './teamTactics';
import { ownGoalX } from './goalkeeper';
import { formationSlot, indexInTeam } from './formation';

type DiffParams = typeof DIFFICULTY_PARAMS.normal;

function rnd(state: MatchState, min: number, max: number): number {
  const [next, v] = rngFloat(state.rngState, min, max);
  state.rngState = next;
  return v;
}

function clampX(x: number): number { return Math.max(FIELD_X + m(1), Math.min(FIELD_RIGHT - m(1), x)); }
function clampY(y: number, lo = FIELD_CY - m(9), hi = FIELD_CY + m(9)): number {
  return Math.max(lo, Math.min(hi, y));
}

function nearestOpponent(state: MatchState, team: Team, x: number, y: number): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const o of state.players) {
    if (o.team === team) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function distToNearestOpponent(state: MatchState, team: Team, x: number, y: number): number {
  const o = nearestOpponent(state, team, x, y);
  return o ? dist(o.x, o.y, x, y) : Infinity;
}

/** Re-evaluate the AI action for a player (utility-based). */
export function aiDecide(state: MatchState, p: PlayerEntity): void {
  const params = DIFFICULTY_PARAMS[state.difficulty];
  if (p.role === 'goalkeeper') {
    // GK controller handles positioning; here just idle the decision.
    p.aiAction = 'idle';
    return;
  }
  const ball = state.ball;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  const scores: Record<string, number> = {};

  if (owner && owner.team === p.team && owner.id === p.id) {
    // With ball — score with-ball actions.
    scoreWithBall(state, p, params, scores);
    const best = pickBest(scores);
    p.aiAction = best as AiAction;
    planWithBall(state, p, best as WithBallAction, params);
  } else {
    // Without ball.
    scoreOffBall(state, p, params, scores, owner, owner?.team === p.team);
    const best = pickBest(scores);
    p.aiAction = best as AiAction;
    planOffBall(state, p, best as OffBallAction, owner);
  }
  p.utilityScores = scores;
}

function pickBest(scores: Record<string, number>): string {
  let best = 'idle';
  let bs = -1;
  for (const k of Object.keys(scores)) {
    if (scores[k] > bs) { bs = scores[k]; best = k; }
  }
  return best;
}

// --- With-ball utility -----------------------------------------------------

function scoreWithBall(state: MatchState, p: PlayerEntity, params: DiffParams, out: Record<string, number>): void {
  const goalX = attackingGoalX(p.team);
  const ownX = ownGoalX(p.team);
  const dGoal = dist(p.x, p.y, goalX, FIELD_CY);
  const dOwnGoal = Math.abs(p.x - ownX); // distance to own goal line
  const pressure = 1 - Math.min(1, distToNearestOpponent(state, p.team, p.x, p.y) / m(2));
  const mateOpen = countOpenMates(state, p);
  out.DRIBBLE = 0.4 + (1 - pressure) * 0.3 - (dGoal < m(8) ? 0.2 : 0);
  out.HOLD_BALL = 0.2 + pressure * 0.4;
  out.SHORT_PASS = 0.3 + mateOpen * 0.25 + pressure * 0.2;
  out.THROUGH_PASS = mateOpen > 1 ? 0.45 + params.passRisk * 0.3 : 0.1;
  out.BACK_PASS = pressure * 0.4 + 0.1;
  out.LOB_PASS = pressure > 0.5 ? 0.3 + params.passRisk * 0.2 : 0.1;
  out.SHOOT = dGoal < m(10) ? 0.5 + (1 - dGoal / m(10)) * 0.4 - pressure * 0.2 : 0.05;
  // CLEAR_BALL: evaluated by distance to OWN goal and current danger — not the
  // opponent's goal. High pressure near own goal → clear it.
  out.CLEAR_BALL = pressure > 0.6 && dOwnGoal < m(8) ? 0.45 + pressure * 0.2 : 0.05;
  // Apply precision jitter.
  for (const k of Object.keys(out)) out[k] *= 0.85 + params.precision * 0.15;
}

function countOpenMates(state: MatchState, p: PlayerEntity): number {
  let n = 0;
  for (const m2 of state.players) {
    if (m2.team !== p.team || m2.id === p.id || m2.role === 'goalkeeper') continue;
    if (distToNearestOpponent(state, p.team, m2.x, m2.y) > m(2)) n++;
  }
  return n;
}

function planWithBall(state: MatchState, p: PlayerEntity, action: WithBallAction, params: DiffParams): void {
  const goalX = attackingGoalX(p.team);
  switch (action) {
    case 'SHOOT': {
      if (p.hasBall) shoot(p, goalX, FIELD_CY + rnd(state, -m(1.5), m(1.5)) * (1 - params.precision), Math.min(1, 0.6 + params.precision * 0.3), state, 'normal');
      break;
    }
    case 'SHORT_PASS':
    case 'THROUGH_PASS':
    case 'BACK_PASS':
    case 'LOB_PASS': {
      if (p.hasBall) {
        const mate = pickPassTarget(state, p, action);
        if (mate) pass(p, mate.x, mate.y, state, action === 'LOB_PASS' ? 'lob' : action === 'THROUGH_PASS' ? 'through' : 'short');
      }
      break;
    }
    case 'DRIBBLE': {
      p.aiTarget = { x: goalX, y: FIELD_CY + rnd(state, -m(3), m(3)) };
      break;
    }
    case 'HOLD_BALL': {
      p.aiTarget = { x: p.x, y: p.y };
      break;
    }
    case 'CLEAR_BALL': {
      if (p.hasBall) {
        const cx = p.team === 0 ? 1 : -1;
        pass(p, p.x + cx * m(15), FIELD_CY + rnd(state, -m(4), m(4)), state, 'driven');
      }
      break;
    }
  }
}

function pickPassTarget(state: MatchState, p: PlayerEntity, action: WithBallAction): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bs = -Infinity;
  for (const m2 of state.players) {
    if (m2.team !== p.team || m2.id === p.id || m2.role === 'goalkeeper') continue;
    const ahead = p.team === 0 ? m2.x - p.x : p.x - m2.x;
    if (action === 'BACK_PASS' && ahead > 0) continue;
    if ((action === 'SHORT_PASS' || action === 'THROUGH_PASS') && ahead < -m(3)) continue;
    const opp = distToNearestOpponent(state, p.team, m2.x, m2.y);
    const d = dist(p.x, p.y, m2.x, m2.y);
    let score = ahead * 0.002 + opp * 0.003 - d * 0.001;
    if (action === 'THROUGH_PASS') score += (m2.vx !== 0 || m2.vy !== 0 ? 0.2 : 0);
    if (score > bs) { bs = score; best = m2; }
  }
  return best;
}

// --- Off-ball utility ------------------------------------------------------

function scoreOffBall(
  state: MatchState, p: PlayerEntity, params: DiffParams, out: Record<string, number>,
  owner: PlayerEntity | null, weHaveBall: boolean,
): void {
  const ball = state.ball;
  const myDistBall = dist(p.x, p.y, ball.x, ball.y);
  const closest = isClosestMateToBall(state, p);
  const phase = state.teamPhase[p.team];
  out.RETURN_TO_FORMATION = 0.2;
  out.SUPPORT = weHaveBall ? 0.5 + (p.role === 'pivot' ? 0.2 : 0) : 0.1;
  out.RUN_IN_BEHIND = weHaveBall && p.role === 'pivot' ? 0.55 : weHaveBall && (p.role === 'leftAla' || p.role === 'rightAla') ? 0.4 : 0.05;
  out.MOVE_WIDE = weHaveBall && (p.role === 'leftAla' || p.role === 'rightAla') ? 0.45 : 0.1;
  out.MOVE_TO_BACK_POST = weHaveBall && p.role === 'pivot' && phase === 'FINAL_THIRD' ? 0.4 : 0.1;
  out.DROP_DEEP = !weHaveBall && p.role === 'fixo' ? 0.4 : 0.1;
  out.COVER = !weHaveBall && p.role === 'fixo' ? 0.45 : 0.1;
  out.MARK = !weHaveBall && p.markingTarget != null ? 0.4 : 0.1;
  out.PRESS = !weHaveBall && closest && myDistBall < m(10) ? 0.5 + params.aggression * 0.3 : 0.05;
  out.INTERCEPT = !weHaveBall && ball.ballState === 'AIRBORNE' && myDistBall < m(6) ? 0.5 : 0.1;
  // Anti-clustering: penalize SUPPORT/MOVE_WIDE if a mate is already very close.
  if (clustered(state, p)) { out.SUPPORT *= 0.3; out.MOVE_WIDE *= 0.3; }
  for (const k of Object.keys(out)) out[k] *= 0.85 + params.precision * 0.15;
}

function isClosestMateToBall(state: MatchState, p: PlayerEntity): boolean {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const m2 of state.players) {
    if (m2.team !== p.team || m2.role === 'goalkeeper') continue;
    const d = dist(m2.x, m2.y, state.ball.x, state.ball.y);
    if (d < bd) { bd = d; best = m2; }
  }
  return best?.id === p.id;
}

function clustered(state: MatchState, p: PlayerEntity): boolean {
  for (const m2 of state.players) {
    if (m2.team !== p.team || m2.id === p.id) continue;
    if (dist(p.x, p.y, m2.x, m2.y) < m(1.5)) return true;
  }
  return false;
}

function planOffBall(state: MatchState, p: PlayerEntity, action: OffBallAction, owner: PlayerEntity | null): void {
  const ball = state.ball;
  const dirSign = p.team === 0 ? 1 : -1;
  const goalX = attackingGoalX(p.team);
  const slot = formationSlot(p.team, indexInTeam(p.id));
  switch (action) {
    case 'SUPPORT': {
      if (owner) {
        // Offer a lane ahead of the carrier, away from nearest opponent.
        const opp = nearestOpponent(state, p.team, p.x, p.y);
        const away = opp ? Math.sign(p.x - opp.x) || dirSign : dirSign;
        p.aiTarget = { x: clampX(owner.x + m(3) * dirSign + away * m(1)), y: clampY(owner.y + (p.role === 'leftAla' ? -m(3) : p.role === 'rightAla' ? m(3) : 0)) };
      } else p.aiTarget = p.dynamicFormationPosition;
      break;
    }
    case 'RUN_IN_BEHIND':
      p.aiTarget = { x: clampX(goalX - m(2)), y: clampY(ball.y) };
      break;
    case 'MOVE_WIDE':
      p.aiTarget = { x: clampX(ball.x + m(2) * dirSign), y: p.role === 'leftAla' ? clampY(FIELD_CY - m(7)) : clampY(FIELD_CY + m(7)) };
      break;
    case 'MOVE_TO_BACK_POST':
      p.aiTarget = { x: clampX(goalX - m(2)), y: clampY(ball.y + rnd(state, -m(2), m(2))) };
      break;
    case 'DROP_DEEP':
      p.aiTarget = { x: ownGoalX(p.team) + m(5) * dirSign, y: clampY(ball.y) };
      break;
    case 'COVER':
      p.aiTarget = { x: ownGoalX(p.team) + m(6) * dirSign, y: clampY(FIELD_CY + (ball.y - FIELD_CY) * 0.4) };
      break;
    case 'MARK':
      if (p.markingTarget != null) {
        const m2 = state.players[p.markingTarget];
        if (m2) {
          // Stand BETWEEN the opponent and own goal (not on top of the opponent).
          const gx = ownGoalX(p.team);
          const gy = FIELD_CY;
          const ang = angleTo(m2.x, m2.y, gx, gy);
          const offset = m(1.2); // 1.2 m toward own goal from the opponent
          p.aiTarget = { x: m2.x + Math.cos(ang) * offset, y: m2.y + Math.sin(ang) * offset };
        }
      }
      break;
    case 'PRESS':
      p.aiTarget = { x: ball.x, y: ball.y };
      break;
    case 'INTERCEPT': {
      // Predict the interception point: where the ball reaches the player's
      // reachable radius given the player's max speed and reaction time.
      const ballSp = Math.hypot(ball.vx, ball.vy);
      const playerSpeed = mps(MOVEMENT.runSpeed);
      const reaction = DIFFICULTY_PARAMS[state.difficulty].gkReactionMs / 1000;
      let pred = { x: ball.x, y: ball.y };
      if (ballSp > 1) {
        // Step the ball forward up to ~1.5s, find the first point the player
        // can reach in time (distance / playerSpeed + reaction).
        for (let t = reaction; t < 1.5; t += FIXED_DT) {
          const bx = ball.x + ball.vx * t;
          const by = ball.y + ball.vy * t;
          const d = dist(p.x, p.y, bx, by);
          if (d / playerSpeed <= t) { pred = { x: bx, y: by }; break; }
        }
      }
      p.aiTarget = pred;
      break;
    }
    case 'RETURN_TO_FORMATION':
    default:
      p.aiTarget = p.dynamicFormationPosition;
      break;
  }
}

// --- Execute ---------------------------------------------------------------

export function aiAct(state: MatchState, p: PlayerEntity, dt: number): void {
  const params = DIFFICULTY_PARAMS[state.difficulty];
  const intv = AI_INTERVALS[state.difficulty];
  if (p.aiTimer > 0) p.aiTimer -= dt;
  if (p.aiTimer <= 0) {
    aiDecide(state, p);
    const [next, j] = rngFloat(state.rngState, intv.min, intv.max);
    state.rngState = next;
    p.aiTimer = j / 1000;
  }
  if (p.state === 'tackle' || p.state === 'slide' || p.state === 'goalkeeperDive' || p.stunnedTime > 0 || p.actionLock > 0) return;

  const action = p.aiAction;
  const ball = state.ball;
  let mx = 0, my = 0, sprint = false;

  switch (action) {
    case 'PRESS': {
      // Move to ball; use contextual defense when close.
      mx = ball.x - p.x; my = ball.y - p.y;
      const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
      if (owner && owner.team !== p.team && dist(p.x, p.y, owner.x, owner.y) < m(1.5)) {
        // Close to ball carrier — standing tackle or shoulder challenge.
        if (dist(p.x, p.y, owner.x, owner.y) < m(1.2)) {
          standingTackle(p, state);
        } else {
          shoulderChallenge(p, state);
        }
        // Slide tackle only on high aggression + right angle.
        if (p.slideCooldown <= 0 && rnd(state, 0, 1) < params.aggression * 0.03) {
          startTackle(p, mx, my);
        }
      } else if (ball.ownerId == null && dist(p.x, p.y, ball.x, ball.y) < m(1.5)) {
        // Loose ball — poke tackle.
        if (p.pokeCooldown <= 0) pokeTackle(p, state);
        else tryTackle(p, state);
      }
      sprint = dist(p.x, p.y, ball.x, ball.y) > m(3);
      break;
    }
    case 'INTERCEPT':
    case 'SUPPORT':
    case 'RUN_IN_BEHIND':
    case 'MOVE_WIDE':
    case 'MOVE_TO_BACK_POST':
    case 'DROP_DEEP':
    case 'COVER':
    case 'MARK':
    case 'RETURN_TO_FORMATION':
    case 'DRIBBLE':
    case 'HOLD_BALL': {
      mx = p.aiTarget.x - p.x; my = p.aiTarget.y - p.y;
      const a = action as string;
      sprint = a === 'RUN_IN_BEHIND' || a === 'INTERCEPT' || (a === 'PRESS' && dist(p.x, p.y, ball.x, ball.y) > m(3));
      break;
    }
    case 'idle':
    default:
      break;
  }

  const mag = len(mx, my);
  if (mag > 0.01) { mx /= mag; my /= mag; }
  applyMovement(p, mx, my, sprint, p.hasBall, dt);
}

export { angleTo };
