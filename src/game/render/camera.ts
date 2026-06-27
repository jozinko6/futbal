/**
 * Camera: follows the action (ball + active player), clamped to the world
 * bounds so we never show beyond the pitch surround.
 */
import {
  FIELD_H,
  FIELD_W,
  FIELD_X,
  FIELD_Y,
  VIEW_H,
  VIEW_W,
  getActivePlayerId,
  type MatchState,
} from '@/game/simulation';
import { clamp, lerp } from '@/game/simulation';

export interface Camera {
  x: number;
  y: number;
}

export function createCamera(): Camera {
  return { x: FIELD_X + FIELD_W / 2, y: FIELD_Y + FIELD_H / 2 };
}

const WORLD_LEFT = FIELD_X - 16;
const WORLD_RIGHT = FIELD_X + FIELD_W + 16;
const WORLD_TOP = FIELD_Y - 12;
const WORLD_BOTTOM = FIELD_Y + FIELD_H + 12;

export function updateCamera(cam: Camera, state: MatchState, dt: number): void {
  const ball = state.ball;
  const active = state.players[getActivePlayerId(state)] ?? ball;
  // Weighted focus: mostly the ball, with the active player influencing framing.
  const tx = ball.x * 0.62 + active.x * 0.38;
  const ty = ball.y * 0.62 + active.y * 0.38;

  const minX = WORLD_LEFT + VIEW_W / 2;
  const maxX = WORLD_RIGHT - VIEW_W / 2;
  const minY = WORLD_TOP + VIEW_H / 2;
  const maxY = WORLD_BOTTOM - VIEW_H / 2;

  const targetX = clamp(tx, minX, maxX);
  const targetY = clamp(ty, minY, maxY);

  // Smooth follow.
  const k = 1 - Math.pow(0.0015, dt);
  cam.x = lerp(cam.x, targetX, k);
  cam.y = lerp(cam.y, targetY, k);
}

/** World-to-screen offset (top-left of the viewport in world coords). */
export function cameraOrigin(cam: Camera): { x: number; y: number } {
  return { x: Math.round(cam.x - VIEW_W / 2), y: Math.round(cam.y - VIEW_H / 2) };
}
