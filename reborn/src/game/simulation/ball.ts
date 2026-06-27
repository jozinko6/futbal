/**
 * Ball physics — pure functions on BallState.
 * Semi-implicit Euler integration for fixed timestep.
 */
import { BALL_MAX_SPEED, BALL_FRICTION, BALL_AIR_DRAG, GRAVITY, BOUNCE_RESTITUTION, BALL_REST_THRESHOLD } from '../core/tuning';
import type { BallState, AftertouchState } from '../core/types';
import { AFTERTOUCH_MAX_LATERAL, AFTERTOUCH_MAX_VERTICAL } from '../core/tuning';

export function integrateBall(ball: BallState, dt: number, aftertouch: AftertouchState | null, tick: number): void {
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.prevZ = ball.z;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= GRAVITY * dt;
    ball.z += ball.vz * dt;
    const drag = Math.pow(1 - BALL_AIR_DRAG, dt);
    ball.vx *= drag;
    ball.vy *= drag;

    if (ball.z <= 0) {
      ball.z = 0;
      if (ball.vz < -BALL_REST_THRESHOLD) {
        ball.vz = -ball.vz * BOUNCE_RESTITUTION;
      } else {
        ball.vz = 0;
      }
    }
  } else {
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 0) {
      const decel = BALL_FRICTION * dt;
      const ns = Math.max(0, sp - decel);
      ball.vx *= ns / sp;
      ball.vy *= ns / sp;
    }
  }

  // Aftertouch
  if (aftertouch && aftertouch.expiresTick > tick) {
    const remaining = (aftertouch.expiresTick - tick) / Math.max(1, aftertouch.expiresTick - aftertouch.startedTick);
    const influence = aftertouch.influence * remaining;

    const ballSp = Math.hypot(ball.vx, ball.vy);
    if (ballSp > 1) {
      const perpX = -ball.vy / ballSp;
      const perpY = ball.vx / ballSp;
      const lateral = aftertouch.lateralInput * AFTERTOUCH_MAX_LATERAL * influence;
      ball.vx += perpX * lateral * dt;
      ball.vy += perpY * lateral * dt;
    }

    if (ball.z > 0 || ball.vz > 0) {
      const vertical = aftertouch.verticalInput * AFTERTOUCH_MAX_VERTICAL * influence;
      ball.vz += vertical * dt;
    }

    ball.spin += aftertouch.lateralInput * influence * 0.15;
  }

  // Cap speed
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > BALL_MAX_SPEED) {
    ball.vx *= BALL_MAX_SPEED / sp;
    ball.vy *= BALL_MAX_SPEED / sp;
  }

  ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.05;
}

export function kickBall(ball: BallState, dirX: number, dirY: number, power: number, vz = 0): void {
  const n = Math.hypot(dirX, dirY) || 1;
  ball.vx = (dirX / n) * power;
  ball.vy = (dirY / n) * power;
  ball.vz = vz;
  ball.spin += power * 0.01;
  // Cap
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > BALL_MAX_SPEED) {
    ball.vx *= BALL_MAX_SPEED / sp;
    ball.vy *= BALL_MAX_SPEED / sp;
  }
}
