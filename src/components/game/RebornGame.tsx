'use client';

import { useEffect, useRef, useState } from 'react';

// Inline imports to avoid path resolution issues
import { createMatchState, step } from '../../../reborn/src/game/simulation/match';
import { createEmptyInput } from '../../../reborn/src/game/core/types';
import { FIXED_DT, MAX_FRAME_ACCUM, VIEW_W, VIEW_H, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, FIELD_CX, FIELD_CY, FIELD_RIGHT, FIELD_BOTTOM, FIELD_TOP, GOAL_TOP, GOAL_BOTTOM, GOAL_DEPTH, CENTER_CIRCLE_R, TEAM_COLORS, FIELD_COLORS, PLAYER_RADIUS, BALL_RADIUS } from '../../../reborn/src/game/core/tuning';
import type { MatchState, InputFrame, PlayerState } from '../../../reborn/src/game/core/types';

export function RebornGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchRef = useRef<MatchState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    try {
      matchRef.current = createMatchState({ seed: 42, format: '5v5', halfLength: 120 });
    } catch (e) {
      console.error('Failed to create match:', e);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === 'Escape') setPaused(p => !p);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const onBlur = () => keysRef.current.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const canvas = canvasRef.current;
    if (canvas) {
      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const cw = parent.clientWidth;
        const ch = parent.clientHeight;
        const scale = Math.max(1, Math.floor(Math.min(cw / VIEW_W, ch / VIEW_H)));
        canvas.style.width = `${VIEW_W * scale}px`;
        canvas.style.height = `${VIEW_H * scale}px`;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
    }

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const s = matchRef.current;
      if (!s) return;
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (dt > MAX_FRAME_ACCUM) dt = MAX_FRAME_ACCUM;

      if (!pausedRef.current) {
        accRef.current += dt;
        while (accRef.current >= FIXED_DT) {
          const input = buildInput(keysRef.current);
          step(s, input, FIXED_DT);
          accRef.current -= FIXED_DT;
          if ((s.phase as string) === 'FULLTIME') break;
        }
      }

      const ctx = canvasRef.current?.getContext('2d', { alpha: false });
      if (ctx) renderGame(ctx, s);

      // Update page state for HUD
      const remaining = Math.max(0, s.clock.halfLength - s.clock.timeMs);
      const mm = Math.floor(remaining / 60);
      const ss = Math.floor(remaining % 60);
      const scoreEl = document.getElementById('hud-score');
      if (scoreEl) scoreEl.textContent = `${s.score[0]} - ${s.score[1]}`;
      const timeEl = document.getElementById('hud-time');
      if (timeEl) timeEl.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
      const bannerEl = document.getElementById('hud-banner');
      if (bannerEl) bannerEl.textContent = s.banner || '';
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-950">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-4 font-mono text-sm">
        <span id="hud-score" className="text-white font-bold">0 - 0</span>
        <span id="hud-time" className="text-amber-300">2:00</span>
      </div>
      {banner && <div id="hud-banner" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 font-mono text-3xl font-black text-amber-300"></div>}
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="block"
        style={{ imageRendering: 'pixelated' }}
      />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <h2 className="font-mono text-3xl font-black text-amber-300">PAUZA</h2>
        </div>
      )}
      <footer className="mt-auto w-full border-t border-emerald-800/60 py-2 text-center font-mono text-[10px] text-emerald-400/60">
        FUTBAL REBORN · nová arkádová simulácia od nuly
      </footer>
    </div>
  );
}

function buildInput(keys: Set<string>): InputFrame {
  const input = createEmptyInput(0);
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  input.continuous.moveX = mx;
  input.continuous.moveY = my;
  input.continuous.sprintHeld = keys.has('l') || keys.has('shift');
  input.continuous.actionHeld = keys.has('j');
  input.continuous.modifierHeld = keys.has('i');
  if (keys.has('j')) { input.edges.actionPressed = true; keys.delete('j'); }
  if (keys.has('k')) { input.edges.tacklePressed = true; keys.delete('k'); }
  if (keys.has('q')) { input.edges.switchPressed = true; keys.delete('q'); }
  return input;
}

function renderGame(ctx: CanvasRenderingContext2D, state: MatchState): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const camX = Math.max(VIEW_W / 2, Math.min(FIELD_RIGHT - VIEW_W / 2, state.ball.x));
  const camY = Math.max(VIEW_H / 2, Math.min(FIELD_BOTTOM - VIEW_H / 2, state.ball.y));
  const ox = Math.round(camX - VIEW_W / 2);
  const oy = Math.round(camY - VIEW_H / 2);

  // Grass stripes
  const stripes = 14;
  const sw = FIELD_W / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? FIELD_COLORS.grassA : FIELD_COLORS.grassB;
    ctx.fillRect(Math.round(FIELD_X + i * sw - ox), Math.round(FIELD_Y - oy), Math.ceil(sw) + 1, FIELD_H);
  }

  // Lines
  ctx.strokeStyle = FIELD_COLORS.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(FIELD_X - ox) + 0.5, Math.round(FIELD_Y - oy) + 0.5, FIELD_W, FIELD_H);
  ctx.beginPath();
  ctx.moveTo(Math.round(FIELD_CX - ox) + 0.5, Math.round(FIELD_Y - oy));
  ctx.lineTo(Math.round(FIELD_CX - ox) + 0.5, Math.round(FIELD_BOTTOM - oy));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(FIELD_CX - ox, FIELD_CY - oy, CENTER_CIRCLE_R, 0, Math.PI * 2);
  ctx.stroke();

  // Goals
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(Math.round(FIELD_X - GOAL_DEPTH - ox), Math.round(GOAL_TOP - oy), GOAL_DEPTH, GOAL_BOTTOM - GOAL_TOP);
  ctx.fillRect(Math.round(FIELD_RIGHT - ox), Math.round(GOAL_TOP - oy), GOAL_DEPTH, GOAL_BOTTOM - GOAL_TOP);
  ctx.fillStyle = FIELD_COLORS.line;
  ctx.fillRect(FIELD_X - 2 - ox, GOAL_TOP - 3 - oy, 4, 6);
  ctx.fillRect(FIELD_X - 2 - ox, GOAL_BOTTOM - 3 - oy, 4, 6);
  ctx.fillRect(FIELD_RIGHT - 2 - ox, GOAL_TOP - 3 - oy, 4, 6);
  ctx.fillRect(FIELD_RIGHT - 2 - ox, GOAL_BOTTOM - 3 - oy, 4, 6);

  // Shadows
  for (const p of state.players) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(Math.round(p.x - ox), Math.round(p.y - oy + 6), PLAYER_RADIUS * 1.5, PLAYER_RADIUS * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Players (Y-sorted)
  const sorted = [...state.players].sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    drawPlayer(ctx, p.x - ox, p.y - oy, p);
  }

  // Ball
  const ball = state.ball;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(Math.round(ball.x - ox), Math.round(ball.y - oy + 3), 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(Math.round(ball.x - ox), Math.round(ball.y - oy - ball.z), BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Active player indicator
  const active = state.players[state.controlledPlayerId];
  if (active) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(Math.round(active.x - ox), Math.round(active.y - oy + 6), 12, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HUD bar
  ctx.fillStyle = 'rgba(10,14,26,0.85)';
  ctx.fillRect(0, 0, VIEW_W, 18);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(0, 18, VIEW_W, 1);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.fillStyle = TEAM_COLORS.home.jersey;
  ctx.fillText('ČERVENÍ', VIEW_W / 2 - 36, 9);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(`${state.score[0]} - ${state.score[1]}`, VIEW_W / 2, 9);
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.fillStyle = TEAM_COLORS.away.jersey;
  ctx.fillText('MODRÍ', VIEW_W / 2 + 40, 9);
  const remaining = Math.max(0, state.clock.halfLength - state.clock.timeMs);
  ctx.textAlign = 'right';
  ctx.fillStyle = remaining < 30 ? '#ef4444' : '#fde047';
  ctx.fillText(`${Math.floor(remaining / 60)}:${Math.floor(remaining % 60).toString().padStart(2, '0')}`, VIEW_W - 8, 9);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`P${state.clock.half}`, 8, 9);

  // Banner
  if (state.banner && state.bannerTimer > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(state.banner, VIEW_W / 2 + 2, VIEW_H / 2 - 8);
    ctx.fillStyle = state.banner.includes('GÓL') ? '#ffd23f' : '#22d3ee';
    ctx.fillText(state.banner, VIEW_W / 2, VIEW_H / 2 - 10);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, p: PlayerState): void {
  const colors = p.team === 0 ? TEAM_COLORS.home : TEAM_COLORS.away;
  const bx = Math.round(x);
  const by = Math.round(y);
  const moving = Math.hypot(p.vx, p.vy) > 5;
  const phase = Math.sin(p.animTime * (moving ? 12 : 3));
  const bob = moving ? phase * 1 : 0;
  const legSwing = moving ? phase * 2 : 0;

  ctx.fillStyle = '#20242b';
  ctx.fillRect(bx - 3, by + 2, 3, 4 + legSwing);
  ctx.fillRect(bx + 1, by + 2, 3, 4 - legSwing);
  ctx.fillStyle = colors.shorts;
  ctx.fillRect(bx - 4, by, 8, 3);
  ctx.fillStyle = colors.jersey;
  ctx.fillRect(bx - 5, by - 5 + bob, 10, 6);
  ctx.fillStyle = colors.trim;
  ctx.fillRect(bx - 5, by - 1 + bob, 10, 1);
  ctx.fillStyle = colors.jersey;
  ctx.fillRect(bx - 7, by - 3 + bob, 2, 4);
  ctx.fillRect(bx + 5, by - 3 + bob, 2, 4);
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(bx, by - 8 + bob, 3, 0, Math.PI * 2);
  ctx.fill();
  if (p.isCaptain) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(bx + 4, by - 2 + bob, 3, 2);
  }
  const nx = Math.cos(p.facing);
  const ny = Math.sin(p.facing);
  ctx.fillStyle = '#d9a65e';
  ctx.fillRect(Math.round(bx + nx * 3 - 0.5), Math.round(by - 8 + bob + ny * 3 - 0.5), 2, 2);
  if (p.role === 'GK') {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(bx - 8, by - 1 + bob, 2, 2);
    ctx.fillRect(bx + 6, by - 1 + bob, 2, 2);
  }
}
