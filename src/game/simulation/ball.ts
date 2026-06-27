/**
 * Ball physics (SI metres → px/s). Integrates position, friction, air drag,
 * gravity, bounce. Field bounds / goal detection live in rules.ts.
 */
import { BALL, mps, m } from './constants';
import type { BallState } from './types';
import { clamp } from './math';

export function integrateBall(ball: BallState, dt: number): void {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= mps(BALL.gravity) * dt;
    ball.z += ball.vz * dt;
    const drag = Math.pow(1 - BALL.airDrag, dt);
    ball.vx *= drag;
    ball.vy *= drag;
    if (ball.z <= 0) {
      ball.z = 0;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (ball.vz < -mps(BALL.restThreshold)) {
        ball.vz = -ball.vz * BALL.bounceRestitution;
        ball.spin += speed * 0.02;
      } else {
        ball.vz = 0;
      }
      ball.ballState = 'LOOSE';
    } else {
      ball.ballState = 'AIRBORNE';
    }
  } else {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const decel = mps(BALL.friction) * dt;
      const ns = Math.max(0, speed - decel);
      const f = ns / speed;
      ball.vx *= f;
      ball.vy *= f;
    }
  }

  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > mps(BALL.maxSpeed)) {
    const f = mps(BALL.maxSpeed) / sp;
    ball.vx *= f;
    ball.vy *= f;
  }

  ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.06;

  if (ball.releaseCooldown > 0) ball.releaseCooldown = Math.max(0, ball.releaseCooldown - dt);
  if (ball.possessionShield > 0) {
    ball.possessionShield = Math.max(0, ball.possessionShield - dt);
    if (ball.possessionShield === 0) ball.shieldTeam = null;
  }
  if (ball.touchTimer > 0) ball.touchTimer = Math.max(0, ball.touchTimer - dt);
}

export function isBallLow(ball: BallState, maxZ = m(0.5)): boolean {
  return ball.z <= maxZ;
}

export function ballSpeed(ball: BallState): number {
  return Math.hypot(ball.vx, ball.vy);
}

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
  ball.mode = vz > 0 ? 'AERIAL' : 'FREE';
  ball.ballState = vz > 0 ? 'AIRBORNE' : 'LOOSE';
}

export function clampBallSpeed(ball: BallState): void {
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > mps(BALL.maxSpeed)) {
    const f = mps(BALL.maxSpeed) / sp;
    ball.vx *= f;
    ball.vy *= f;
  }
}

export function _unusedClamp(v: number) { return clamp(v, 0, 1); }
