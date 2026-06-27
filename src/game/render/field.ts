/**
 * Procedural pixel-art field texture. Pre-rendered once to an offscreen
 * canvas (browser-only — the renderer is NOT part of the deterministic
 * simulation) and blitted each frame as the camera moves.
 */
import {
  CENTER_CIRCLE_R,
  FIELD_COLORS,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_RIGHT,
  FIELD_TOP,
  FIELD_W,
  FIELD_X,
  FIELD_Y,
  GOAL_AREA_H,
  GOAL_AREA_W,
  GOAL_BOTTOM,
  GOAL_DEPTH,
  GOAL_H,
  GOAL_TOP,
  PENALTY_BOX_H,
  PENALTY_BOX_W,
} from '@/game/simulation';

export const WORLD_W = 1232;
export const WORLD_H = 728;

/** Create the static pitch texture (call once, in the browser). */
export function createFieldTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // --- Surround (stands / border) ---
  ctx.fillStyle = '#0f3a22';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Crowd silhouettes (top & bottom strips).
  drawCrowd(ctx, 0, 0, WORLD_W, FIELD_TOP - 8);
  drawCrowd(ctx, 0, FIELD_TOP + FIELD_H + 8, WORLD_W, WORLD_H - (FIELD_TOP + FIELD_H + 8));

  // Track / border ring around the pitch.
  ctx.fillStyle = '#1c5e34';
  ctx.fillRect(8, 8, WORLD_W - 16, WORLD_H - 16);
  ctx.fillStyle = '#3a6b3f';
  ctx.fillRect(14, 14, WORLD_W - 28, WORLD_H - 28);

  // --- Grass with mowing stripes ---
  const stripeCount = 16;
  const stripeW = FIELD_W / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? FIELD_COLORS.grassA : FIELD_COLORS.grassB;
    ctx.fillRect(
      Math.round(FIELD_X + i * stripeW),
      FIELD_TOP,
      Math.ceil(stripeW) + 1,
      FIELD_H,
    );
  }

  // --- White lines ---
  ctx.strokeStyle = FIELD_COLORS.line;
  ctx.lineWidth = 2;
  ctx.lineCap = 'square';

  // Outer boundary.
  strokeRect(ctx, FIELD_X, FIELD_TOP, FIELD_W, FIELD_H);

  // Halfway line.
  line(ctx, FIELD_CX, FIELD_TOP, FIELD_CX, FIELD_TOP + FIELD_H);

  // Centre circle + spot.
  strokeCircle(ctx, FIELD_CX, FIELD_CY, CENTER_CIRCLE_R);
  fillSpot(ctx, FIELD_CX, FIELD_CY);

  // Penalty boxes & goal areas (both ends).
  drawBoxes(ctx, FIELD_X, 'left');
  drawBoxes(ctx, FIELD_RIGHT, 'right');

  // Corner arcs.
  cornerArc(ctx, FIELD_X, FIELD_TOP, 0);
  cornerArc(ctx, FIELD_RIGHT, FIELD_TOP, Math.PI / 2);
  cornerArc(ctx, FIELD_RIGHT, FIELD_TOP + FIELD_H, Math.PI);
  cornerArc(ctx, FIELD_X, FIELD_TOP + FIELD_H, -Math.PI / 2);

  // --- Goals (posts + net) ---
  drawGoal(ctx, FIELD_X, 'left');
  drawGoal(ctx, FIELD_RIGHT, 'right');

  return c;
}

function drawCrowd(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0a2a18';
  ctx.fillRect(x, y, w, h);
  const colors = ['#264b5a', '#5a3a2a', '#3a3a5a', '#5a4a2a', '#2a4a3a'];
  for (let py = y + 3; py < y + h - 2; py += 4) {
    for (let px = x + 2; px < x + w - 2; px += 4) {
      const seed = (px * 13 + py * 7) % 100;
      if (seed < 55) {
        ctx.fillStyle = colors[(px + py) % colors.length];
        ctx.fillRect(px, py, 3, 3);
      }
    }
  }
}

function drawBoxes(ctx: CanvasRenderingContext2D, lineX: number, side: 'left' | 'right') {
  const pbX = side === 'left' ? lineX : lineX - PENALTY_BOX_W;
  strokeRect(ctx, pbX, FIELD_CY - PENALTY_BOX_H / 2, PENALTY_BOX_W, PENALTY_BOX_H);
  const gaX = side === 'left' ? lineX : lineX - GOAL_AREA_W;
  strokeRect(ctx, gaX, FIELD_CY - GOAL_AREA_H / 2, GOAL_AREA_W, GOAL_AREA_H);
  // Penalty spot.
  const spotX = side === 'left' ? lineX + 64 : lineX - 64;
  fillSpot(ctx, spotX, FIELD_CY);
  // Penalty arc.
  ctx.beginPath();
  const start = side === 'left' ? -Math.PI / 2.6 : Math.PI - Math.PI / 2.6;
  const end = side === 'left' ? Math.PI / 2.6 : Math.PI + Math.PI / 2.6;
  ctx.arc(spotX, FIELD_CY, 48, start, end);
  ctx.stroke();
}

function drawGoal(ctx: CanvasRenderingContext2D, lineX: number, side: 'left' | 'right') {
  const depth = GOAL_DEPTH;
  const gx = side === 'left' ? lineX - depth : lineX;
  // Net background.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(gx, GOAL_TOP, depth, GOAL_H);
  // Net mesh.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= depth; i += 4) {
    line(ctx, gx + i, GOAL_TOP, gx + i, GOAL_BOTTOM);
  }
  for (let j = GOAL_TOP; j <= GOAL_BOTTOM; j += 4) {
    line(ctx, gx, j, gx + depth, j);
  }
  // Posts (thick white).
  ctx.fillStyle = FIELD_COLORS.line;
  ctx.fillRect(lineX - 2, GOAL_TOP - 3, 4, 6);
  ctx.fillRect(lineX - 2, GOAL_BOTTOM - 3, 4, 6);
  ctx.fillRect(side === 'left' ? lineX - depth : lineX, GOAL_TOP - 2, depth, 3);
  ctx.fillRect(side === 'left' ? lineX - depth : lineX, GOAL_BOTTOM, depth, 3);
}

function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}
function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
function fillSpot(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = FIELD_COLORS.line;
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
}
function cornerArc(ctx: CanvasRenderingContext2D, x: number, y: number, start: number) {
  ctx.beginPath();
  ctx.arc(x, y, 10, start, start + Math.PI / 2);
  ctx.stroke();
}
