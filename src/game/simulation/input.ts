/**
 * Input construction & validation. The client only ever sends these frames
 * (never positions/score/time) to the authoritative server.
 */
import type { InputFrame } from './types';

const EMPTY_INPUT: InputFrame = {
  seq: 0,
  moveX: 0,
  moveY: 0,
  sprint: false,
  pass: false,
  shootHeld: false,
  highPass: false,
  switchPlayer: false,
};

export function emptyInput(seq = 0): InputFrame {
  return { ...EMPTY_INPUT, seq };
}

/** Clamp & sanitize a raw input frame. Rejects NaN / out-of-range values. */
export function validateInput(raw: Partial<InputFrame>): InputFrame {
  const moveX = clampUnit(raw.moveX);
  const moveY = clampUnit(raw.moveY);
  // Deadzone: values below 0.20 are treated as zero (matches the response curve).
  const mx = Math.abs(moveX) < 0.20 ? 0 : moveX;
  const my = Math.abs(moveY) < 0.20 ? 0 : moveY;
  return {
    seq: Number.isFinite(raw.seq) ? (raw.seq as number) : 0,
    moveX: mx,
    moveY: my,
    sprint: !!raw.sprint,
    pass: !!raw.pass,
    shootHeld: !!raw.shootHeld,
    highPass: !!raw.highPass,
    switchPlayer: !!raw.switchPlayer,
  };
}

function clampUnit(v: unknown): number {
  const n = typeof v === 'number' ? v : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

/** Rate-limit helper: returns true if a new input may be sent at this time. */
export function shouldSendInput(now: number, lastSent: number, rateHz: number): boolean {
  return now - lastSent >= 1000 / rateHz;
}
