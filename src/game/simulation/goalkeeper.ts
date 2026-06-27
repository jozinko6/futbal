/**
 * GoalkeeperController — positioning, reactions, dives, distribution.
 *
 * The GK reacts to the ball's MOVEMENT (not to the shot button press) and
 * respects a reaction time. For hard shots it prefers to parry (punch) the
 * ball away rather than catch; after a parry the ball stays live (LOOSE).
 * Position is computed from ball position, goal centre, ball distance, shot
 * angle and attacker positions — not a single fixed line.
 */
import {
  FIELD_CY, FIELD_X, FIELD_RIGHT, GOAL_TOP, GOAL_BOTTOM, m, mps,
  DIFFICULTY_PARAMS, DEFENSE, BALL, CONTROL_RADIUS,
} from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { dist, angleTo } from './math';
import { gkDive, pass } from './player';
import { kickBall } from './ball';
import { rngFloat } from './rng';

export function ownGoalX(team: Team): number { return team === 0 ? FIELD_X : FIELD_RIGHT; }

/** Update a goalkeeper's positioning and actions. */
export function updateGoalkeeper(state: MatchState, gk: PlayerEntity, dt: number): void {
  if (gk.state === 'goalkeeperDive') return; // mid-dive, integratePlayer handles
  const ball = state.ball;
  const ownX = ownGoalX(gk.team);
  const dirSign = gk.team === 0 ? 1 : -1;

  // --- Position: arc between goal centre and ball, scaled by ball distance. ---
  // The GK stands on an arc that opens as the ball gets closer, narrowing the
  // angle. Far ball → stay on the line; close ball → come out a little.
  const ballDist = Math.abs(ball.x - ownX);
  const arcDepth = Math.min(m(2.5), ballDist * 0.15); // up to ~2.5 m off the line
  const lineX = ownX + dirSign * (m(0.8) + arcDepth);
  // Track ball y, clamped to goal mouth + margin.
  let ty = ball.y;
  // Close the angle: bias toward the goal centre when the ball is wide.
  const ballYOff = Math.abs(ball.y - FIELD_CY);
  if (ballYOff > m(3)) ty = FIELD_CY + (ball.y - FIELD_CY) * 0.6;
  ty = Math.max(GOAL_TOP - m(0.6), Math.min(GOAL_BOTTOM + m(0.6), ty));
  // Move toward (lineX, ty) at jog speed.
  const dx = lineX - gk.x;
  const dy = ty - gk.y;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    const speed = mps(3.2);
    gk.vx = (dx / d) * speed;
    gk.vy = (dy / d) * speed;
  } else {
    gk.vx *= 0.5; gk.vy *= 0.5;
  }
  gk.facing = angleTo(gk.x, gk.y, ball.x, ball.y);
  gk.aiTarget = { x: lineX, y: ty };

  // --- Shot reaction: predict the goal-line intercept, with reaction time. ---
  // React to ball MOVEMENT toward goal (not to a button press).
  const movingTowardGoal =
    (gk.team === 0 && ball.vx < -mps(4)) || (gk.team === 1 && ball.vx > mps(4));
  if (movingTowardGoal && ball.z < m(2.2)) {
    const distToLine = Math.abs(ball.x - ownX);
    const reactMs = DIFFICULTY_PARAMS[state.difficulty].gkReactionMs;
    // Time for the ball to reach the goal line.
    const tToLine = distToLine / Math.max(mps(3), Math.abs(ball.vx));
    // Only attempt a save once the ball is within reaction-time reach.
    if (tToLine * 1000 <= reactMs + 100 && tToLine > 0.04) {
      const py = ball.y + ball.vy * tToLine;
      const pz = ball.z + ball.vz * tToLine - 0.5 * mps(BALL.gravity) * tToLine * tToLine;
      const ballSpeed = Math.hypot(ball.vx, ball.vy);
      const hardShot = ballSpeed > mps(BALL.passSpeed.driven);
      // Decide: catch (dive) vs parry (punch).
      if (Math.abs(py - gk.y) > m(0.8) || pz > m(1.0)) {
        // Out of easy reach → dive.
        gkDive(gk, dirSign, Math.sign(py - gk.y) || 0);
        return;
      } else if (hardShot) {
        // Hard shot in reach → parry: punch the ball away (it stays live).
        const [nr, roll] = rngFloat(state.rngState, 0, 1);
        state.rngState = nr;
        const parryAng = angleTo(gk.x, gk.y, ownX + dirSign * m(8), FIELD_CY + (roll - 0.5) * m(6));
        kickBall(ball, Math.cos(parryAng), Math.sin(parryAng), mps(BALL.passSpeed.driven) * 0.8, mps(2));
        ball.ownerId = null;
        ball.releaseCooldown = 0.2;
        ball.ballState = 'LOOSE';
        gk.state = 'stunned'; gk.stunnedTime = 0.4; // brief recovery
        return;
      }
      // Easy shot in reach → catch (handled by resolvePossession next tick).
    }
  }

  // --- Rush out for a loose ball very close to goal. ---
  if (ball.ownerId == null && ball.ballState !== 'OUT_OF_PLAY' &&
      dist(gk.x, gk.y, ball.x, ball.y) < m(4) && ballDist < m(7)) {
    gk.aiAction = 'INTERCEPT';
    gk.aiTarget = { x: ball.x, y: ball.y };
    return;
  }

  // --- GK with ball: distribute after a brief moment (or when hold limit near). ---
  if (gk.hasBall) {
    if (ball.gkHoldTime > DIFFICULTY_PARAMS[state.difficulty].gkReactionMs / 1000 + 0.4) {
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

export { CONTROL_RADIUS };
