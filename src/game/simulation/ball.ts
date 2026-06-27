/**
 * Ball physics integration — pure functions operating on BallState.
 *
 * Handles: position integration, ground friction, air drag, gravity, ground
 * bounce. Field bounds, goal-post collisions and goal detection live in
 * rules.ts (they are match rules, not ball physics).
 */
import {
  BALL_AIR_DRAG,
  BALL_FRICTION,
  BALL_MAX_SPEED,
  BALL_REST_THRESHOLD,
  BOUNCE_RESTITUTION,
  GRAVITY,
} from './constants';
import type { BallState } from './types';
import { clamp } from './math';

export function integrateBall(ball: BallState, dt: number): void {
  // Horizontal motion
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.z > 0 || ball.vz > 0) {
    // Airborne — apply gravity to vertical, light drag to horizontal.
    ball.vz -= GRAVITY * dt;
    ball.z += ball.vz * dt;
    const drag = Math.pow(1 - BALL_AIR_DRAG, dt);
    ball.vx *= drag;
    ball.vy *= drag;

    if (ball.z <= 0) {
      ball.z = 0;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (ball.vz < -BALL_REST_THRESHOLD) {
        ball.vz = -ball.vz * BOUNCE_RESTITUTION;
        // Visual spin from bounce
        ball.spin += speed * 0.02;
      } else {
        // Settle on the ground.
        ball.vz = 0;
      }
    }
  } else {
    // On the ground — apply friction.
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const decel = BALL_FRICTION * dt;
      const ns = Math.max(0, speed - decel);
      const f = ns / speed;
      ball.vx *= f;
      ball.vy *= f;
    }
  }

  // Cap speed.
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > BALL_MAX_SPEED) {
    const f = BALL_MAX_SPEED / sp;
    ball.vx *= f;
    ball.vy *= f;
  }

  // Visual spin proportional to ground speed.
  ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.06;

  if (ball.releaseCooldown > 0) ball.releaseCooldown = Math.max(0, ball.releaseCooldown - dt);
  if (ball.possessionShield > 0) {
    ball.possessionShield = Math.max(0, ball.possessionShield - dt);
    if (ball.possessionShield === 0) ball.shieldTeam = null;
  }
}

/** True if the ball is low enough to be controllable / to score. */
export function isBallLow(ball: BallState, maxZ = 16): boolean {
  return ball.z <= maxZ;
}

export function ballSpeed(ball: BallState): number {
  return Math.hypot(ball.vx, ball.vy);
}

/** Apply an impulse (kick) to the ball. Optionally add vertical velocity. */
export function kickBall(
  ball: BallState,
  dirX: number,
  dirY: number,
  power: number,
  vz = 0,
): void {
  const n = Math.hypot(dirX, dirY) || 1;
  ball.vx = (dirX / n) * power;
  ball.vy = (dirY / n) * power;
  ball.vz = vz;
  ball.ownerId = null;
  ball.releaseCooldown = 0.18;
  ball.spin += power * 0.01;
  clampBallSpeed(ball);
}

export function clampBallSpeed(ball: BallState): void {
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > BALL_MAX_SPEED) {
    const f = BALL_MAX_SPEED / sp;
    ball.vx *= f;
    ball.vy *= f;
  }
}

export function _unusedClamp(v: number) {
  return clamp(v, 0, 1);
}
