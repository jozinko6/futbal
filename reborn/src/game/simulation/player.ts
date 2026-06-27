/**
 * Player movement — arcade-style. Fast, responsive, readable.
 * No sharpTurnPenalty multiplication every tick.
 */
import {
  WALK_SPEED, RUN_SPEED, SPRINT_SPEED, RUN_WITH_BALL_SPEED, SPRINT_WITH_BALL_SPEED,
  BACKWARD_SPEED, ACCEL, SPRINT_ACCEL, DECEL, TURN_RATE, TURN_RATE_WITH_BALL, TURN_RATE_SPRINT,
  DEADZONE, WALK_THRESHOLD, RUN_THRESHOLD, PLAYER_RADIUS,
} from '../core/tuning';
import type { ContinuousInput, PlayerState, MatchState } from '../core/types';
import { angleDiff, approach, approachAngle, len } from '../core/math';

export function applyMovement(p: PlayerState, input: ContinuousInput, hasBall: boolean, dt: number): void {
  // Don't move during contact/recovery phases of actions.
  if (p.currentAction) {
    if (p.currentAction.phase === 'CONTACT') return;
    if (p.currentAction.phase === 'RECOVERY' && p.stunnedUntilTick > 0) return;
  }

  const mag = len(input.moveX, input.moveY);

  if (mag < DEADZONE) {
    // Brake
    p.vx = approach(p.vx, 0, DECEL * dt);
    p.vy = approach(p.vy, 0, DECEL * dt);
    p.movementMode = 'BRAKE';
    return;
  }

  const nx = input.moveX / mag;
  const ny = input.moveY / mag;
  const isSprinting = input.sprintHeld && mag >= RUN_THRESHOLD;

  // Determine target speed based on analog magnitude.
  let targetSpeed: number;
  if (isSprinting) {
    targetSpeed = hasBall ? SPRINT_WITH_BALL_SPEED : SPRINT_SPEED;
  } else if (mag >= RUN_THRESHOLD) {
    targetSpeed = hasBall ? RUN_WITH_BALL_SPEED : RUN_SPEED;
  } else if (mag >= WALK_THRESHOLD) {
    targetSpeed = hasBall ? RUN_WITH_BALL_SPEED * 0.8 : RUN_SPEED * 0.8;
  } else {
    targetSpeed = WALK_SPEED;
  }

  // Backward penalty
  const dot = Math.cos(p.facing) * nx + Math.sin(p.facing) * ny;
  if (dot < -0.2) targetSpeed = Math.min(targetSpeed, BACKWARD_SPEED);

  // Locomotion multiplier during action windup
  if (p.currentAction && p.currentAction.phase === 'WINDUP') {
    targetSpeed *= 0.5;
  }

  const desiredVx = nx * targetSpeed;
  const desiredVy = ny * targetSpeed;
  const accelRate = (isSprinting ? SPRINT_ACCEL : ACCEL) * dt;
  p.vx = approach(p.vx, desiredVx, accelRate);
  p.vy = approach(p.vy, desiredVy, accelRate);

  // Facing — turn rate depends on ball/sprint
  const desiredFacing = Math.atan2(ny, nx);
  let turnRate = hasBall ? TURN_RATE_WITH_BALL : TURN_RATE;
  if (isSprinting) turnRate = TURN_RATE_SPRINT;
  p.facing = approachAngle(p.facing, desiredFacing, turnRate * dt);

  p.desiredDirX = nx;
  p.desiredDirY = ny;
  p.movementMode = isSprinting ? 'SPRINT' : mag >= RUN_THRESHOLD ? 'RUN' : 'WALK';

  // One-time brake impulse for >120° turns (not every tick)
  const turnAmount = Math.abs(angleDiff(p.facing, desiredFacing));
  if (turnAmount > 2.1 && !p._brakedThisTurn) {
    p.vx *= 0.6;
    p.vy *= 0.6;
    p._brakedThisTurn = true;
  } else if (turnAmount < 0.5) {
    p._brakedThisTurn = false;
  }
}

export function integratePlayer(p: PlayerState, dt: number, tick: number): void {
  p.prevX = p.x;
  p.prevY = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.slideCooldown > 0) p.slideCooldown = Math.max(0, p.slideCooldown - dt);
  if (p.stunnedUntilTick > 0 && tick >= p.stunnedUntilTick) {
    p.stunnedUntilTick = 0;
    p.movementMode = 'IDLE';
  }

  // Action phase progression
  if (p.currentAction) {
    if (p.currentAction.phase === 'WINDUP' && tick >= p.currentAction.contactTick) {
      p.currentAction.phase = 'CONTACT';
    } else if (p.currentAction.phase === 'CONTACT' && tick > p.currentAction.contactTick) {
      p.currentAction.phase = 'RECOVERY';
    } else if (p.currentAction.phase === 'RECOVERY' && tick >= p.currentAction.recoveryUntilTick) {
      p.currentAction = null;
      p.movementMode = 'IDLE';
    }
  }

  p.animTime += dt;
}

/** Dribble socket — ball stays with player. */
export function dribbleBall(state: MatchState, dt: number): void {
  const ball = state.ball;
  if (ball.ownerId == null || ball.mode !== 'CONTROLLED') return;
  const owner = state.players[ball.ownerId];
  if (!owner) return;

  const sp = len(owner.vx, owner.vy);
  const speedRatio = Math.min(1, sp / SPRINT_SPEED);

  const aheadDist = 10 + speedRatio * 14;
  const lateral = 5 * (Math.sin(owner.animTime * 10) > 0 ? 1 : -1) * (sp > 1 ? 1 : 0);

  const cos = Math.cos(owner.facing);
  const sin = Math.sin(owner.facing);
  const targetX = owner.x + cos * aheadDist - sin * lateral;
  const targetY = owner.y + sin * aheadDist + cos * lateral;

  const k = Math.min(1, 22 * dt);
  ball.x += (targetX - ball.x) * k;
  ball.y += (targetY - ball.y) * k;
  ball.z = 0;
  ball.vx = owner.vx;
  ball.vy = owner.vy;
  ball.vz = 0;
  ball.spin += sp * dt * 0.08;
}

/** Soft separation — players don't bounce like billiards. */
export function resolvePlayerCollision(a: PlayerState, b: PlayerState): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = len(dx, dy);
  const min = PLAYER_RADIUS * 2;
  if (d > 0 && d < min) {
    const overlap = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
  }
}

// Extend PlayerState with internal flag (kept in the same interface file to avoid circular deps)
// Actually we need to add _brakedThisTurn to PlayerState. Let's add it as a dynamic property.
