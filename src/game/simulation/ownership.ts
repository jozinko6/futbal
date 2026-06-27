/**
 * Ball ownership — single source of truth.
 *
 * `ball.ownerId` is the ONLY authoritative field. `player.hasBall` is a
 * read-only synced mirror. All ownership changes go through these helpers.
 */
import type { BallMode, MatchState } from './types';
import { teamOf } from './formation';

/** Check if a player owns the ball. */
export function playerHasBall(state: MatchState, playerId: number): boolean {
  return state.ball.ownerId === playerId;
}

/** Sync player.hasBall from ball.ownerId. Called after any ownership change. */
export function syncHasBall(state: MatchState): void {
  for (const p of state.players) {
    p.hasBall = p.id === state.ball.ownerId;
  }
}

/** Set the ball owner and mode. Centralised — the ONLY place that writes ownerId. */
export function setBallOwner(state: MatchState, playerId: number | null, mode: BallMode): void {
  const ball = state.ball;
  if (playerId == null) {
    if (ball.ownerId != null) ball.previousOwnerId = ball.ownerId;
    ball.ownerId = null;
  } else {
    if (ball.ownerId !== playerId) {
      ball.previousOwnerId = ball.ownerId;
      ball.ownerId = playerId;
      ball.controlStartedTick = state.tick;
      ball.lastTouchPlayerId = playerId;
      ball.lastTouchTeam = teamOf(playerId);
    }
  }
  ball.mode = mode;
  // Sync legacy ballState field.
  switch (mode) {
    case 'CONTROLLED': ball.ballState = 'CONTROLLED'; break;
    case 'GK_HELD': ball.ballState = 'GOALKEEPER_CONTROLLED'; break;
    case 'FREE': ball.ballState = 'LOOSE'; break;
    case 'PASS': case 'SHOT': ball.ballState = 'LOOSE'; break;
    case 'AERIAL': ball.ballState = 'AIRBORNE'; break;
    case 'OUT_OF_PLAY': case 'RESTART': ball.ballState = 'OUT_OF_PLAY'; break;
  }
  syncHasBall(state);
}

/** Release the ball (pass/shot/tackle/deflection). */
export function releaseBall(state: MatchState, mode: BallMode): void {
  setBallOwner(state, null, mode);
  state.ball.releaseTick = state.tick;
  state.ball.releaseCooldown = 0.18;
}

/** Runtime invariant check (dev mode). Returns error string or null. */
export function checkBallInvariants(state: MatchState): string | null {
  const ball = state.ball;
  // CONTROLLED must have a valid owner.
  if (ball.mode === 'CONTROLLED' && ball.ownerId == null) {
    return `Invariant violated: mode=CONTROLLED but ownerId=null (tick ${state.tick})`;
  }
  // GK_HELD must have a goalkeeper owner.
  if (ball.mode === 'GK_HELD' && ball.ownerId != null) {
    const p = state.players[ball.ownerId];
    if (!p || p.role !== 'goalkeeper') {
      return `Invariant violated: mode=GK_HELD but owner is not GK (tick ${state.tick})`;
    }
  }
  // FREE/PASS/SHOT/AERIAL must not have an owner.
  if ((ball.mode === 'FREE' || ball.mode === 'PASS' || ball.mode === 'SHOT' || ball.mode === 'AERIAL') && ball.ownerId != null) {
    return `Invariant violated: mode=${ball.mode} but ownerId=${ball.ownerId} (tick ${state.tick})`;
  }
  return null;
}
