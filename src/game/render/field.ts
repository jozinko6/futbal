/**
 * Procedural pixel-art field texture. Pre-rendered once to an offscreen
 * canvas (browser-only — the renderer is NOT part of the deterministic
 * simulation) and blitted each frame as the camera moves.
 *
 * Visual style inspired by classic 16-bit top-down arcade football: a vibrant
 * mown-grass pitch with bold stripes, thick white markings, visible goals with
 * nets, and a lively stadium surround with tiered crowd rows and an original
 * banner (no third-party branding/assets).
 */
import {
  CENTER_CIRCLE_R,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_RIGHT,
  FIELD_BOTTOM,
  FIELD_TOP,
  FIELD_W,
  FIELD_X,
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

// Vibrant palette (all original — no copied assets).
const GRASS_LIGHT = '#3aa84a';
const GRASS_DARK = '#2f9240';
const GRASS_EDGE = '#46c25a';
const LINE_WHITE = '#f4fff0';
const STANDS_DARK = '#10243f';
const STANDS_MID = '#1a3458';
const TRACK = '#7a5a2a';
const TRACK_LINE = '#6a4a20';

/** Create the static pitch texture (call once, in the browser). */
export function createFieldTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // --- Stadium backdrop: tiered crowd stands fill the whole world ---
  drawStands(ctx, 0, 0, WORLD_W, WORLD_H, 'top');

  // --- Running track ring around the pitch (narrow, doesn't cover stands) ---
  const trackInset = 8;
  ctx.fillStyle = TRACK;
  // Top & bottom strips.
  ctx.fillRect(FIELD_X - trackInset, FIELD_TOP - trackInset, FIELD_W + trackInset * 2, trackInset);
  ctx.fillRect(FIELD_X - trackInset, FIELD_BOTTOM, FIELD_W + trackInset * 2, trackInset);
  // Left & right strips.
  ctx.fillRect(FIELD_X - trackInset, FIELD_TOP, trackInset, FIELD_H);
  ctx.fillRect(FIELD_RIGHT, FIELD_TOP, trackInset, FIELD_H);
  // Lane lines on the track.
  ctx.fillStyle = TRACK_LINE;
  for (let i = 1; i <= 2; i++) {
    ctx.fillRect(FIELD_X - trackInset, FIELD_TOP - trackInset + i * 2, FIELD_W + trackInset * 2, 1);
    ctx.fillRect(FIELD_X - trackInset, FIELD_BOTTOM + i * 2 - 1, FIELD_W + trackInset * 2, 1);
    ctx.fillRect(FIELD_X - trackInset + i * 2, FIELD_TOP, 1, FIELD_H);
    ctx.fillRect(FIELD_RIGHT + i * 2 - 1, FIELD_TOP, 1, FIELD_H);
  }

  // --- Grass with bold mowing stripes ---
  const stripeCount = 18;
  const stripeW = FIELD_W / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? GRASS_LIGHT : GRASS_DARK;
    ctx.fillRect(
      Math.round(FIELD_X + i * stripeW),
      FIELD_TOP,
      Math.ceil(stripeW) + 1,
      FIELD_H,
    );
  }
  // Sunlit edge highlight (top-left bias).
  ctx.fillStyle = GRASS_EDGE;
  ctx.fillRect(FIELD_X, FIELD_TOP, FIELD_W, 2);
  ctx.fillRect(FIELD_X, FIELD_TOP, 2, FIELD_H);

  // --- White markings (thick) ---
  ctx.strokeStyle = LINE_WHITE;
  ctx.fillStyle = LINE_WHITE;
  ctx.lineWidth = 3;
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

  // --- Stadium banner text (original — no third-party branding) ---
  drawBanner(ctx, FIELD_X, 0, FIELD_W, FIELD_TOP - 6);

  return c;
}

/**
 * Tiered crowd stands: dark blue back wall, then rows of colourful spectators
 * (red/yellow/green/blue dots) to evoke a packed, lively stadium.
 */
function drawStands(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  _side: 'top' | 'bottom' | 'left' | 'right',
) {
  if (w <= 0 || h <= 0) return;
  // Back wall (tiered steps).
  ctx.fillStyle = STANDS_MID;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = STANDS_DARK;
  ctx.fillRect(x, y, w, Math.max(2, Math.floor(h * 0.25)));

  // Crowd rows — colourful dots in horizontal bands.
  const rowColors = [
    '#d83a3a', // red
    '#e8c23a', // yellow
    '#3aa86b', // green
    '#3a7ad8', // blue
    '#d83a3a',
    '#e8c23a',
  ];
  const rowH = 5;
  const dotW = 3;
  const dotH = 3;
  let row = 0;
  for (let py = y + Math.max(2, Math.floor(h * 0.28)); py + dotH <= y + h - 1; py += rowH) {
    const col = rowColors[row % rowColors.length];
    const alt = rowColors[(row + 3) % rowColors.length];
    ctx.fillStyle = col;
    let i = 0;
    for (let px = x + 1; px + dotW <= x + w - 1; px += 4) {
      ctx.fillStyle = (i + row) % 2 === 0 ? col : alt;
      // Vary the y slightly per-dot for a "crowd shimmer".
      const jitter = ((px * 7 + py * 3 + row) % 3) - 1;
      ctx.fillRect(px, py + jitter, dotW, dotH);
      i++;
    }
    row++;
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
  // Net background (dark so the white mesh reads clearly).
  ctx.fillStyle = 'rgba(20,30,40,0.55)';
  ctx.fillRect(gx, GOAL_TOP, depth, GOAL_H);
  // Net mesh.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= depth; i += 4) {
    line(ctx, gx + i, GOAL_TOP, gx + i, GOAL_BOTTOM);
  }
  for (let j = GOAL_TOP; j <= GOAL_BOTTOM; j += 4) {
    line(ctx, gx, j, gx + depth, j);
  }
  // Posts (thick white) + crossbar shadow.
  ctx.fillStyle = LINE_WHITE;
  ctx.fillRect(lineX - 2, GOAL_TOP - 4, 5, 7);
  ctx.fillRect(lineX - 2, GOAL_BOTTOM - 3, 5, 7);
  ctx.fillRect(side === 'left' ? lineX - depth : lineX, GOAL_TOP - 3, depth, 3);
  ctx.fillRect(side === 'left' ? lineX - depth : lineX, GOAL_BOTTOM, depth, 3);
}

/**
 * Original banner text across the top stand — "KACANOVSKÁ FIFA" in chunky
 * pixel-style lettering. Replaces third-party branding (e.g. SEGA) with the
 * game's own name.
 */
function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Banner plate.
  ctx.fillStyle = '#0c1a2e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a3458';
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);

  // Text — chunky, centred, repeated across the banner width.
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = '★ KACANOVSKÁ FIFA ★';
  const textW = ctx.measureText(label).width;
  const step = textW + 40;
  const cy = y + h / 2;
  for (let cx = x + step / 2; cx < x + w; cx += step) {
    ctx.fillText(label, cx, cy);
  }
  // Faint highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y + 1, w, 1);
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
  ctx.fillStyle = LINE_WHITE;
  ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
}
function cornerArc(ctx: CanvasRenderingContext2D, x: number, y: number, start: number) {
  ctx.beginPath();
  ctx.arc(x, y, 12, start, start + Math.PI / 2);
  ctx.stroke();
}
