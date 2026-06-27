/**
 * Canvas renderer for Retro Football Arena.
 *
 * Browser-only (uses Canvas 2D). Draws the pre-rendered field texture, then
 * shadows, players, ball and HUD on top. Pixel-perfect: all coordinates are
 * floored and image smoothing is disabled.
 */
import {
  PLAYER_RADIUS,
  SHOOT_CHARGE_TIME,
  TEAM_COLORS,
  VIEW_H,
  VIEW_W,
  getActiveIds,
  type MatchState,
  type PlayerEntity,
} from '@/game/simulation';
import { cameraOrigin, type Camera } from './camera';
import { WORLD_H, WORLD_W } from './field';

export interface RenderAssets {
  field: HTMLCanvasElement;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  cam: Camera,
  assets: RenderAssets,
): void {
  ctx.imageSmoothingEnabled = false;
  const origin = cameraOrigin(cam);
  const activeIds = getActiveIds(state);

  // --- Field (blit the visible sub-rectangle of the pre-rendered texture) ---
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(
    assets.field,
    origin.x,
    origin.y,
    VIEW_W,
    VIEW_H,
    0,
    0,
    VIEW_W,
    VIEW_H,
  );

  // --- Shadows first (so players/ball sit on top) ---
  for (const p of state.players) {
    drawShadow(ctx, p.x - origin.x, p.y - origin.y, PLAYER_RADIUS * 1.7, 0.28);
  }
  const ball = state.ball;
  drawShadow(ctx, ball.x - origin.x, ball.y - origin.y, 7 - ball.z * 0.01, 0.22);

  // --- Players ---
  // Draw non-active first, active last so it sits on top.
  const order = [...state.players].sort((a, b) => {
    const aActive = activeIds.has(a.id) ? 1 : 0;
    const bActive = activeIds.has(b.id) ? 1 : 0;
    return aActive - bActive;
  });
  for (const p of order) {
    drawPlayer(ctx, p.x - origin.x, p.y - origin.y, p, activeIds.has(p.id), state);
  }

  // --- Ball ---
  drawBall(ctx, ball.x - origin.x, ball.y - origin.y - ball.z, ball.spin, state);

  // --- HUD ---
  drawHUD(ctx, state);

  // --- Banner ---
  if (state.banner && state.bannerTimer > 0) {
    drawBanner(ctx, state.banner);
  }
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y + r * 0.55), r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: PlayerEntity,
  isActive: boolean,
  state: MatchState,
): void {
  const colors = p.team === 0 ? TEAM_COLORS.home : TEAM_COLORS.away;
  const moving = Math.hypot(p.vx, p.vy) > 8;
  const phase = p.animTime * (moving ? 12 : 3);
  const bob = moving ? Math.sin(phase) * 1 : 0;
  const legSwing = moving ? Math.sin(phase) * 3 : 0;

  // Active-player ring on the ground.
  if (isActive) {
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y + 8), 12, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Chevron above.
    ctx.fillStyle = colors.trim;
    const cx = Math.round(x);
    const cy = Math.round(y - 16 - Math.sin(p.animTime * 6) * 1.5);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 4, cy - 5);
    ctx.lineTo(cx + 4, cy - 5);
    ctx.closePath();
    ctx.fill();
  }

  const bx = Math.round(x);
  const by = Math.round(y + bob);

  // Legs.
  ctx.fillStyle = '#20242b';
  ctx.fillRect(bx - 4, by + 2, 3, 5 + legSwing);
  ctx.fillRect(bx + 1, by + 2, 3, 5 - legSwing);

  // Shorts.
  ctx.fillStyle = colors.shorts;
  ctx.fillRect(bx - 5, by, 10, 4);

  // Jersey body.
  ctx.fillStyle = colors.jersey;
  roundRect(ctx, bx - 6, by - 6, 12, 8, 3);
  ctx.fill();
  // Trim stripe.
  ctx.fillStyle = colors.trim;
  ctx.fillRect(bx - 6, by - 1, 12, 1);

  // Arms (rotate slightly with run).
  ctx.fillStyle = colors.jersey;
  ctx.fillRect(bx - 8, by - 4, 2, 5);
  ctx.fillRect(bx + 6, by - 4, 2, 5);

  // Head.
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.arc(bx, by - 9, 4, 0, Math.PI * 2);
  ctx.fill();
  // Hair / cap hint.
  ctx.fillStyle = colors.shorts;
  ctx.fillRect(bx - 4, by - 12, 8, 2);

  // Direction nose (facing).
  const nx = Math.cos(p.facing);
  const ny = Math.sin(p.facing);
  ctx.fillStyle = colors.skin;
  ctx.fillRect(Math.round(bx + nx * 4 - 1), Math.round(by - 9 + ny * 4 - 1), 2, 2);

  // Goalkeeper accent: gloves tint.
  if (p.role === 'GK') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(bx - 9, by - 1, 2, 3);
    ctx.fillRect(bx + 7, by - 1, 2, 3);
  }

  // State-specific overlay.
  if (p.state === 'stunned') {
    drawStars(ctx, bx, by - 14);
  } else if (p.state === 'celebrate') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(bx - 1, by - 18, 2, 4);
    ctx.fillRect(bx - 3, by - 16, 6, 2);
  }

  // Charge bar for an active player building a shot.
  if (isActive && p.hasBall) {
    const ctrl = state.controllers.find((c) => c.activeId === p.id);
    if (ctrl && ctrl.chargeTime > 0) {
      const w = 16;
      const ratio = Math.min(1, ctrl.chargeTime / SHOOT_CHARGE_TIME);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - w / 2, by - 22, w, 3);
      ctx.fillStyle = ratio > 0.66 ? '#ff5a3c' : ratio > 0.33 ? '#ffd23f' : '#7bd389';
      ctx.fillRect(bx - w / 2, by - 22, Math.round(w * ratio), 3);
    }
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spin: number,
  _state: MatchState,
): void {
  const bx = Math.round(x);
  const by = Math.round(y);
  // White disc.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fill();
  // Outline.
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Spinning pentagon-ish mark.
  ctx.fillStyle = '#1a1a1a';
  const a = spin;
  ctx.beginPath();
  ctx.moveTo(bx + Math.cos(a) * 2, by + Math.sin(a) * 2);
  ctx.lineTo(bx + Math.cos(a + 2.5) * 2, by + Math.sin(a + 2.5) * 2);
  ctx.lineTo(bx + Math.cos(a + 4.2) * 2, by + Math.sin(a + 4.2) * 2);
  ctx.closePath();
  ctx.fill();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: MatchState): void {
  // Top scoreboard bar.
  ctx.fillStyle = 'rgba(10,20,14,0.72)';
  ctx.fillRect(0, 0, VIEW_W, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, 18, VIEW_W, 1);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Courier New", monospace';

  const homeName = 'ČERVENÍ';
  const awayName = 'MODRÍ';
  const scoreText = `${homeName}  ${state.score[0]} - ${state.score[1]}  ${awayName}`;
  ctx.fillStyle = TEAM_COLORS.home.jersey;
  ctx.fillText(homeName, VIEW_W / 2 - 36, 9);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${state.score[0]} - ${state.score[1]}`, VIEW_W / 2, 9);
  ctx.fillStyle = TEAM_COLORS.away.jersey;
  ctx.fillText(awayName, VIEW_W / 2 + 40, 9);

  // Clock (right).
  const remaining = Math.max(0, state.halfLength - state.timeMs);
  const mm = Math.floor(remaining / 60);
  const ss = Math.floor(remaining % 60);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#eafff0';
  ctx.fillText(`${mm}:${ss.toString().padStart(2, '0')}`, VIEW_W - 8, 9);
  // Half indicator (left).
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd6b0';
  ctx.fillText(`P${state.half}`, 8, 9);
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px "Courier New", monospace';
  const x = VIEW_W / 2;
  const y = VIEW_H / 2 - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(text, x, y);
}

function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#ffd23f';
  const t = performance.now() / 120;
  for (let i = 0; i < 3; i++) {
    const a = t + (i * Math.PI * 2) / 3;
    ctx.fillRect(Math.round(x + Math.cos(a) * 6 - 1), Math.round(y + Math.sin(a) * 3), 2, 2);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { WORLD_W, WORLD_H };
