/**
 * GoalkeeperController — positioning, reactions, dives, distribution.
 * GK does NOT react at shot-press instant; it has a reaction time.
 */
import {
  FIELD_CY, FIELD_X, FIELD_RIGHT, GOAL_TOP, GOAL_BOTTOM, m, mps,
  DIFFICULTY_PARAMS, DEFENSE, BALL,
} from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { dist, angleTo } from './math';
import { gkDive, pass } from './player';
import { rngFloat } from './rng';

export function ownGoalX(team: Team): number { return team === 0 ? FIELD_X : FIELD_RIGHT; }

/** Update a goalkeeper's positioning and actions. */
export function updateGoalkeeper(state: MatchState, gk: PlayerEntity, dt: number): void {
  if (gk.state === 'goalkeeperDive') return; // mid-dive, integratePlayer handles
  const ball = state.ball;
  const lineX = ownGoalX(gk.team) + (gk.team === 0 ? m(1.2) : -m(1.2));
  // Position: track ball y, clamped to goal mouth + small margin.
  const ty = Math.max(GOAL_TOP - m(0.5), Math.min(GOAL_BOTTOM + m(0.5), ball.y));
  // Move toward (lineX, ty) at jog speed.
  const dx = lineX - gk.x;
  const dy = ty - gk.y;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    const speed = mps(3.0);
    gk.vx = (dx / d) * speed;
    gk.vy = (dy / d) * speed;
  } else {
    gk.vx *= 0.5; gk.vy *= 0.5;
  }
  gk.facing = angleTo(gk.x, gk.y, ball.x, ball.y);
  gk.aiTarget = { x: lineX, y: ty };

  // React to a shot moving toward goal — with reaction delay.
  const movingTowardGoal =
    (gk.team === 0 && ball.vx < -mps(5)) || (gk.team === 1 && ball.vx > mps(5));
  const distToGoal = Math.abs(ball.x - ownGoalX(gk.team));
  if (movingTowardGoal && distToGoal < m(14) && ball.z < m(2)) {
    // Predict intercept y; dive if outside current reach.
    const reactMs = DIFFICULTY_PARAMS[state.difficulty].gkReactionMs;
    const t = Math.max(0.1, distToGoal / Math.max(mps(4), Math.abs(ball.vx)));
    // Only dive after the reaction window has elapsed (use ball.releaseCooldown as proxy? no).
    // Use a deterministic gate: dive when ball is close enough that reaction time is satisfied.
    if (t * 1000 < reactMs + 60 && t > 0.05) {
      const py = ball.y + ball.vy * t;
      if (Math.abs(py - gk.y) > m(1.0)) {
        gkDive(gk, gk.team === 0 ? 1 : -1, Math.sign(py - gk.y));
        return;
      }
    }
  }

  // Rush out for a loose ball very close to goal.
  if (ball.ownerId == null && dist(gk.x, gk.y, ball.x, ball.y) < m(4) && distToGoal < m(6)) {
    gk.aiAction = 'INTERCEPT';
    gk.aiTarget = { x: ball.x, y: ball.y };
    return;
  }

  // GK with ball: distribute after a brief moment (or when hold limit near).
  if (gk.hasBall) {
    if (ball.gkHoldTime > DIFFICULTY_PARAMS[state.difficulty].gkReactionMs / 1000 + 0.4) {
      // Distribute by hand to a teammate (short pass).
      const mate = pickDistributionTarget(state, gk);
      if (mate) {
        pass(gk, mate.x, mate.y, state, 'short');
      }
    }
  }
}

function pickDistributionTarget(state: MatchState, gk: PlayerEntity): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const m2 of state.players) {
    if (m2.team !== gk.team || m2.id === gk.id || m2.role === 'goalkeeper') continue;
    const d = dist(gk.x, gk.y, m2.x, m2.y);
    if (d > m(20)) continue;
    // Prefer a safe (unpressured) target.
    let oppClose = Infinity;
    for (const o of state.players) {
      if (o.team === gk.team) continue;
      oppClose = Math.min(oppClose, dist(o.x, o.y, m2.x, m2.y));
    }
    const score = d - oppClose * 0.5;
    if (score < bd) { bd = score; best = m2; }
  }
  return best;
}

