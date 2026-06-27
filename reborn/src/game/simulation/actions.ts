/**
 * Action system — phased actions (WINDUP → CONTACT → RECOVERY).
 * Ball is kicked ONLY at the contact tick. Not when input is received.
 */
import type { MatchState, PlayerState, PlayerAction, PlayerActionType, ActionPhase } from '../core/types';
import { FIXED_DT } from '../core/tuning';

interface ActionTiming { windupTicks: number; contactTicks: number; recoveryTicks: number }

function timingFor(type: PlayerActionType): ActionTiming {
  switch (type) {
    case 'SHORT_PASS': return { windupTicks: 4, contactTicks: 2, recoveryTicks: 6 };
    case 'DRIVEN_PASS': return { windupTicks: 5, contactTicks: 2, recoveryTicks: 7 };
    case 'THROUGH_PASS': return { windupTicks: 5, contactTicks: 2, recoveryTicks: 7 };
    case 'LOB_PASS': return { windupTicks: 7, contactTicks: 3, recoveryTicks: 10 };
    case 'CROSS': return { windupTicks: 6, contactTicks: 3, recoveryTicks: 9 };
    case 'NORMAL_SHOT': return { windupTicks: 7, contactTicks: 3, recoveryTicks: 12 };
    case 'POWER_SHOT': return { windupTicks: 10, contactTicks: 3, recoveryTicks: 16 };
    case 'CHIP_SHOT': return { windupTicks: 6, contactTicks: 2, recoveryTicks: 10 };
    case 'VOLLEY': return { windupTicks: 2, contactTicks: 2, recoveryTicks: 8 };
    case 'HEADER': return { windupTicks: 3, contactTicks: 2, recoveryTicks: 8 };
    case 'STANDING_TACKLE': return { windupTicks: 3, contactTicks: 2, recoveryTicks: 6 };
    case 'POKE_TACKLE': return { windupTicks: 2, contactTicks: 1, recoveryTicks: 4 };
    case 'SLIDE_TACKLE': return { windupTicks: 5, contactTicks: 4, recoveryTicks: 18 };
    case 'SHOULDER_CHARGE': return { windupTicks: 2, contactTicks: 2, recoveryTicks: 4 };
    case 'BLOCK': return { windupTicks: 2, contactTicks: 2, recoveryTicks: 6 };
    case 'GK_CATCH': return { windupTicks: 3, contactTicks: 3, recoveryTicks: 8 };
    case 'GK_PARRY': return { windupTicks: 3, contactTicks: 2, recoveryTicks: 10 };
    case 'GK_DIVE': return { windupTicks: 4, contactTicks: 4, recoveryTicks: 15 };
    case 'SUPER_SHOT': return { windupTicks: 14, contactTicks: 4, recoveryTicks: 24 };
  }
}

export function startAction(
  p: PlayerState, state: MatchState, type: PlayerActionType,
  targetX: number, targetY: number, power: number, targetPlayerId: number | null = null,
): boolean {
  if (p.currentAction != null) return false;
  if (p.stunnedUntilTick > state.tick) return false;

  const t = timingFor(type);
  p.currentAction = {
    type,
    phase: 'WINDUP',
    startedTick: state.tick,
    contactTick: state.tick + t.windupTicks,
    recoveryUntilTick: state.tick + t.windupTicks + t.contactTicks + t.recoveryTicks,
    targetX, targetY, targetPlayerId, power,
  };
  return true;
}

export function cancelAction(p: PlayerState): void {
  if (p.currentAction && p.currentAction.phase === 'WINDUP') {
    p.currentAction = null;
  }
}

/** Returns the action that reached CONTACT this tick (apply kick now), or null. */
export function stepAction(p: PlayerState, state: MatchState): PlayerAction | null {
  const a = p.currentAction;
  if (!a) return null;

  // Phase transitions happen in integratePlayer, but contact detection here.
  if (a.phase === 'WINDUP' && state.tick >= a.contactTick) {
    a.phase = 'CONTACT';
    return a; // Contact tick — caller applies the kick.
  }
  return null;
}

export function isActionLocked(p: PlayerState): boolean {
  return p.currentAction != null && p.currentAction.phase !== 'WINDUP';
}

export function isWindup(p: PlayerState): boolean {
  return p.currentAction != null && p.currentAction.phase === 'WINDUP';
}
