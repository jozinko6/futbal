/**
 * Camera: follows the ball + active player with a gentle look-ahead in the
 * direction of ball movement, clamped to the world bounds. Supports a screen
 * shake offset (applied by the renderer) for shots / posts / goals.
 */
import {
  FIELD_H, FIELD_W, FIELD_X, FIELD_Y, VIEW_H, VIEW_W, m,
  getActivePlayerId, type MatchState,
} from '@/game/simulation';
import { clamp, lerp } from '@/game/simulation';
import { WORLD_H, WORLD_W } from './field';

export interface Camera {
  x: number;
  y: number;
  /** Current shake offset (px). Decays over time. */
  shake: number;
}

export function createCamera(): Camera {
  return { x: FIELD_X + FIELD_W / 2, y: FIELD_Y + FIELD_H / 2, shake: 0 };
}

const WORLD_LEFT = 0;
const WORLD_RIGHT = WORLD_W;
const WORLD_TOP = 0;
const WORLD_BOTTOM = WORLD_H;

/** Trigger a screen shake of `magnitude` px (decays over ~0.4s). */
export function addShake(cam: Camera, magnitude: number): void {
  cam.shake = Math.min(8, Math.max(cam.shake, magnitude));
}

export function updateCamera(cam: Camera, state: MatchState, dt: number): void {
  const ball = state.ball;
  const active = state.players[getActivePlayerId(state)] ?? ball;
  // Look-ahead: bias the focus in the direction of ball movement (up to ~3 m).
  const ballSp = Math.hypot(ball.vx, ball.vy);
  const la = ballSp > 1 ? Math.min(m(3), ballSp * 0.12) : 0;
  const laX = ballSp > 1 ? (ball.vx / ballSp) * la : 0;
  const laY = ballSp > 1 ? (ball.vy / ballSp) * la : 0;
  // Weighted focus: ball + active + look-ahead.
  const tx = ball.x * 0.6 + active.x * 0.3 + (ball.x + laX) * 0.1;
  const ty = ball.y * 0.6 + active.y * 0.3 + (ball.y + laY) * 0.1;

  const minX = WORLD_LEFT + VIEW_W / 2;
  const maxX = WORLD_RIGHT - VIEW_W / 2;
  const minY = WORLD_TOP + VIEW_H / 2;
  const maxY = WORLD_BOTTOM - VIEW_H / 2;

  const targetX = clamp(tx, minX, maxX);
  const targetY = clamp(ty, minY, maxY);

  const k = 1 - Math.pow(0.0015, dt);
  cam.x = lerp(cam.x, targetX, k);
  cam.y = lerp(cam.y, targetY, k);
  // Decay shake.
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 20);
}

/** World-to-screen offset (top-left of the viewport in world coords), with
 *  the current shake offset applied. */
export function cameraOrigin(cam: Camera): { x: number; y: number } {
  const sx = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const sy = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  return { x: Math.round(cam.x - VIEW_W / 2 + sx), y: Math.round(cam.y - VIEW_H / 2 + sy) };
}
