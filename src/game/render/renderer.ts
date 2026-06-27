/**
 * Canvas renderer for Kačanovská FIFA.
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
import { createFieldTexture, WORLD_H, WORLD_W } from './field';
import {
  ANIMATIONS,
  FRAME_H,
  FRAME_W,
  angleToDirection,
  createPlayerSheet,
  stateToAnim,
  type SpriteSheet,
} from './spriteSheet';

export interface RenderAssets {
  field: HTMLCanvasElement;
  sheets: [SpriteSheet, SpriteSheet]; // [home, away]
}

/** Build all render assets once (browser-only). */
export function createRenderAssets(): RenderAssets {
  return {
    field: createFieldTexture(),
    sheets: [createPlayerSheet(0), createPlayerSheet(1)],
  };
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

  // --- Ball shadow (player shadows are baked into the sprite sheet) ---
  const ball = state.ball;
  drawShadow(ctx, ball.x - origin.x, ball.y - origin.y, 7 - ball.z * 0.01, 0.22);

  // --- Players (Y-sorted: lower y drawn first, so players further down the
  // pitch appear in front. The active player is NOT forced on top — the
  // indicator is drawn separately so it never occludes a correctly-sorted
  // player.) ---
  const order = [...state.players].sort((a, b) => a.y - b.y);
  for (const p of order) {
    drawPlayer(ctx, p.x - origin.x, p.y - origin.y, p, activeIds.has(p.id), state, assets);
  }
  // Active-player indicators drawn on top of everyone (ring + chevron only,
  // not the sprite itself).
  for (const p of order) {
    if (activeIds.has(p.id)) {
      drawActiveIndicator(ctx, p.x - origin.x, p.y - origin.y, p, state);
    }
  }

  // --- Ball ---
  drawBall(ctx, ball.x - origin.x, ball.y - origin.y - ball.z, ball.spin, state);

  // --- HUD ---
  drawHUD(ctx, state);

  // --- Banner ---
  if (state.banner && state.bannerTimer > 0) {
    drawBanner(ctx, state.banner);
  }

  // --- Debug overlay ---
  if (state.debug) {
    renderDebug(ctx, state, origin);
  }
}

/** Debug overlay: AI targets, formation, pass lanes, marking, utilities,
 *  collision circles, velocity, ball state, team phase. */
export function renderDebug(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  origin: { x: number; y: number },
): void {
  ctx.save();
  ctx.lineWidth = 1;
  // AI target positions (small crosses).
  ctx.strokeStyle = '#ffd23f';
  for (const p of state.players) {
    const tx = Math.round(p.aiTarget.x - origin.x);
    const ty = Math.round(p.aiTarget.y - origin.y);
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty); ctx.lineTo(tx + 3, ty);
    ctx.moveTo(tx, ty - 3); ctx.lineTo(tx, ty + 3);
    ctx.stroke();
  }
  // Dynamic formation positions (dots) + marking assignments (lines).
  for (const p of state.players) {
    const px = Math.round(p.x - origin.x);
    const py = Math.round(p.y - origin.y);
    // Collision circle.
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.stroke();
    // Velocity vector.
    ctx.strokeStyle = '#7bd389';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + p.vx * 0.1, py + p.vy * 0.1); ctx.stroke();
    // Marking line.
    if (p.markingTarget != null) {
      const m = state.players[p.markingTarget];
      if (m) {
        ctx.strokeStyle = 'rgba(255,80,80,0.5)';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(Math.round(m.x - origin.x), Math.round(m.y - origin.y)); ctx.stroke();
      }
    }
    // Utility score (top action) above player.
    const topAction = Object.entries(p.utilityScores).sort((a, b) => b[1] - a[1])[0];
    if (topAction) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${topAction[0].slice(0, 4)}:${topAction[1].toFixed(2)}`, px, py - 16);
    }
  }
  // Pass lanes from ball owner.
  const owner = state.ball.ownerId != null ? state.players[state.ball.ownerId] : null;
  if (owner) {
    ctx.strokeStyle = 'rgba(100,200,255,0.5)';
    for (const m of state.players) {
      if (m.team !== owner.team || m.id === owner.id || m.role === 'goalkeeper') continue;
      ctx.beginPath();
      ctx.moveTo(Math.round(owner.x - origin.x), Math.round(owner.y - origin.y));
      ctx.lineTo(Math.round(m.x - origin.x), Math.round(m.y - origin.y));
      ctx.stroke();
    }
  }
  // Ball state + team phases (text).
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`BALL: ${state.ball.ballState}`, 4, VIEW_H - 18);
  ctx.fillText(`T0: ${state.teamPhase[0]}`, 4, VIEW_H - 8);
  ctx.textAlign = 'right';
  ctx.fillText(`T1: ${state.teamPhase[1]}`, VIEW_W - 4, VIEW_H - 8);
  ctx.restore();
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

/** Active-player indicator (ring + chevron) drawn on top of all sprites. */
function drawActiveIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: PlayerEntity,
  state: MatchState,
): void {
  const colors = p.team === 0 ? TEAM_COLORS.home : TEAM_COLORS.away;
  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y + 8), 12, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Chevron above.
  ctx.fillStyle = colors.trim;
  const cx = Math.round(x);
  const cy = Math.round(y - 20 - Math.sin(p.animTime * 6) * 1.5);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 4, cy - 5);
  ctx.lineTo(cx + 4, cy - 5);
  ctx.closePath();
  ctx.fill();
  void state;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: PlayerEntity,
  isActive: boolean,
  state: MatchState,
  assets: RenderAssets,
): void {
  const colors = p.team === 0 ? TEAM_COLORS.home : TEAM_COLORS.away;
  const moving = Math.hypot(p.vx, p.vy) > 8;

  // --- Sprite-sheet blit (32×40, foot pivot at bottom-centre) ---
  const sheet = assets.sheets[p.team];
  const anim = stateToAnim(p.state, p.role, moving);
  const animRow = ANIMATIONS.indexOf(anim);
  const dir = angleToDirection(p.facing);
  const speed = moving ? (p.state === 'sprint' ? 14 : 10) : 3;
  const frame = Math.floor(p.animTime * speed) % sheet.frames;
  const sx = dir * FRAME_W;
  const sy = (animRow * sheet.frames + frame) * FRAME_H;
  // Centre the 32×40 frame on the player position with the foot pivot at the
  // player's (x, y). Foot pivot is at (16, 39) within the frame.
  const dx = Math.round(x - FRAME_W / 2);
  const dy = Math.round(y - FRAME_H + 1);
  ctx.drawImage(sheet.canvas, sx, sy, FRAME_W, FRAME_H, dx, dy, FRAME_W, FRAME_H);

  // State-specific overlay (stun stars / celebrate sparkles).
  if (p.state === 'stunned') {
    drawStars(ctx, Math.round(x), Math.round(y - 22));
  }

  // Charge bar for an active player building a shot.
  if (isActive && p.hasBall) {
    const ctrl = state.controllers.find((c) => c.activeId === p.id);
    if (ctrl && ctrl.chargeTime > 0) {
      const bx = Math.round(x);
      const by = Math.round(y);
      const w = 16;
      const ratio = Math.min(1, ctrl.chargeTime / SHOOT_CHARGE_TIME);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - w / 2, by - 26, w, 3);
      ctx.fillStyle = ratio > 0.66 ? '#ff5a3c' : ratio > 0.33 ? '#ffd23f' : '#7bd389';
      ctx.fillRect(bx - w / 2, by - 26, Math.round(w * ratio), 3);
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
