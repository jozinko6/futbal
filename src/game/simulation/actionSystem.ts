/**
 * Phased player action system.
 *
 * An action (pass/shot/tackle) has three phases:
 *   windup   → can be cancelled; aim can still adjust slightly
 *   contact  → the ball is kicked/touched at the contact tick; aim locked
 *   recovery → player locked, returns to normal play
 *
 * The ball is kicked/touched ONLY at the contact tick, not when the input is
 * received. The renderer/audio read `lastContactTick` to sync the kick sound
 * and the contact animation frame.
 */
import { SHOOTING, DEFENSE, BALL, m, mps } from './constants';
import type { MatchState, PlayerAction, PlayerEntity, ShotType, PassType } from './types';

/** Durations (seconds) per action type for windup / contact / recovery. */
interface PhaseTimings { windup: number; contact: number; recovery: number }

function timingsFor(type: PlayerAction['type']): PhaseTimings {
  switch (type) {
    case 'shortPass':     return { windup: 0.08, contact: 0.04, recovery: 0.10 };
    case 'drivenPass':    return { windup: 0.10, contact: 0.04, recovery: 0.12 };
    case 'throughPass':   return { windup: 0.09, contact: 0.04, recovery: 0.11 };
    case 'lobPass':       return { windup: 0.12, contact: 0.05, recovery: 0.16 };
    case 'placedShot':    return { windup: SHOOTING.windupTime, contact: SHOOTING.contactTime, recovery: SHOOTING.recoveryTime };
    case 'powerShot':     return { windup: SHOOTING.windupTime * 1.3, contact: SHOOTING.contactTime, recovery: SHOOTING.recoveryTime * 1.2 };
    case 'lobShot':       return { windup: SHOOTING.windupTime * 1.1, contact: SHOOTING.contactTime, recovery: SHOOTING.recoveryTime * 1.1 };
    case 'firstTimeShot': return { windup: 0.02, contact: SHOOTING.contactTime, recovery: SHOOTING.recoveryTime };
    case 'pokeTackle':    return { windup: 0.04, contact: 0.03, recovery: DEFENSE.pokeCooldown * 0.4 };
    case 'standingTackle':return { windup: 0.10, contact: 0.05, recovery: 0.20 };
    case 'slideTackle':   return { windup: 0.08, contact: 0.04, recovery: DEFENSE.slideRecover };
  }
}

/** Map a ShotType (legacy) to an action type. */
export function shotTypeToAction(t: ShotType): PlayerAction['type'] {
  switch (t) {
    case 'placed': return 'placedShot';
    case 'power': return 'powerShot';
    case 'lob': return 'lobShot';
    case 'firstTime': return 'firstTimeShot';
    default: return 'powerShot';
  }
}

/** Start a new phased action for a player. Returns false if the player is
 *  already locked / stunned / sliding and cannot start it. */
export function startAction(
  p: PlayerEntity, state: MatchState, type: PlayerAction['type'],
  aimX: number, aimY: number, power: number,
): boolean {
  if (p.stunnedTime > 0) return false;
  if (p.currentAction != null) {
    // Allow cancelling during windup only.
    if (p.currentAction.phase !== 'windup') return false;
  }
  if (p.state === 'tackle' || p.state === 'slide' || p.state === 'goalkeeperDive') return false;
  const t = timingsFor(type);
  const tick = state.tick;
  p.currentAction = {
    type,
    phase: 'windup',
    startedAtTick: tick,
    contactAtTick: tick + Math.max(1, Math.round(t.windup / (1 / 60))),
    finishAtTick: tick + Math.max(1, Math.round((t.windup + t.contact + t.recovery) / (1 / 60))),
    aimX, aimY, power,
    contacted: false,
  };
  p.actionLock = t.windup + t.contact + t.recovery;
  // State hint for the renderer (windup pose).
  if (type.endsWith('Shot')) p.state = 'shoot';
  else if (type.endsWith('Pass')) p.state = 'pass';
  else if (type === 'slideTackle') p.state = 'slide';
  else if (type === 'standingTackle' || type === 'pokeTackle') p.state = 'tackle';
  return true;
}

/** Cancel an in-progress action (e.g. dispossessed during windup). */
export function cancelAction(p: PlayerEntity): void {
  if (p.currentAction && p.currentAction.phase === 'windup') {
    p.currentAction = null;
    p.actionLock = 0;
    if (p.state === 'pass' || p.state === 'shoot' || p.state === 'tackle') p.state = 'idle';
  }
}

/**
 * Advance the active action by one tick. Returns the action that reached its
 * contact tick this step (so the caller can apply the kick/touch), or null.
 * Also returns the action if it finished (so the caller can clear it).
 */
export interface ActionStepResult {
  /** The action that reached contact this tick — apply the kick now. */
  contact: PlayerAction | null;
  /** The action finished its recovery this tick — clear it. */
  finished: boolean;
}

export function stepAction(p: PlayerEntity, state: MatchState): ActionStepResult {
  const a = p.currentAction;
  if (!a) return { contact: null, finished: false };
  let contact: PlayerAction | null = null;
  if (!a.contacted && state.tick >= a.contactAtTick) {
    a.contacted = true;
    a.phase = 'contact';
    p.lastContactTick = state.tick;
    contact = a;
  }
  // Transition contact → recovery one tick after contact.
  if (a.contacted && a.phase === 'contact' && state.tick > a.contactAtTick) {
    a.phase = 'recovery';
  }
  let finished = false;
  if (state.tick >= a.finishAtTick) {
    finished = true;
    p.currentAction = null;
    p.actionLock = 0;
    if (p.state === 'pass' || p.state === 'shoot' || p.state === 'tackle' || p.state === 'slide') {
      p.state = (p.vx || p.vy) ? 'run' : 'idle';
    }
  }
  return { contact, finished };
}

/** Whether the player is currently locked in an action's contact/recovery
 *  phase (cannot start a new action or move freely). */
export function isActionLocked(p: PlayerEntity): boolean {
  return p.currentAction != null && p.currentAction.phase !== 'windup';
}

/** Recommended kick power (m/s) for a pass type. */
export function passPower(type: PassType): number {
  return BALL.passSpeed[type] ?? BALL.passSpeed.short;
}
/** Recommended kick power (m/s) for a shot type at a given charge. */
export function shotPower(type: ShotType, charge: number): number {
  let p = BALL.shootMin + charge * (BALL.shootMax - BALL.shootMin);
  if (type === 'power') p *= 1.12;
  if (type === 'placed') p *= 0.9;
  return Math.min(BALL.shootMax, p);
}
