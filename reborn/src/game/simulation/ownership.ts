/**
 * Ball ownership — single source of truth.
 * ball.ownerId is the ONLY authoritative field.
 * No player.hasBall field exists.
 */
import type { BallMode, MatchState, Team } from '../core/types';

export function playerHasBall(state: MatchState, playerId: number): boolean {
  return state.ball.ownerId === playerId;
}

export function setBallOwner(state: MatchState, playerId: number | null, mode: BallMode): void {
  const ball = state.ball;
  if (playerId == null) {
    if (ball.ownerId != null) ball.previousOwnerId = ball.ownerId;
    ball.ownerId = null;
    ball.mode = mode;
  } else {
    if (ball.ownerId !== playerId) {
      ball.previousOwnerId = ball.ownerId;
      ball.ownerId = playerId;
      ball.ownerSinceTick = state.tick;
      ball.lastTouchPlayerId = playerId;
      ball.lastTouchTeamId = playerId < state.players.length / 2 ? 0 as Team : 1 as Team;
    }
    ball.mode = mode;
  }
}

export function releaseBall(state: MatchState, mode: BallMode): void {
  setBallOwner(state, null, mode);
  state.ball.releasedAtTick = state.tick;
}

export function assertBallState(state: MatchState): string | null {
  const ball = state.ball;
  if ((ball.mode === 'CONTROLLED' || ball.mode === 'GOALKEEPER_HELD') && ball.ownerId == null) {
    return `INVARIANT: mode=${ball.mode} but ownerId=null at tick=${state.tick}`;
  }
  if ((ball.mode === 'FREE' || ball.mode === 'PASS' || ball.mode === 'SHOT' || ball.mode === 'AERIAL') && ball.ownerId != null) {
    return `INVARIANT: mode=${ball.mode} but ownerId=${ball.ownerId} at tick=${state.tick}`;
  }
  return null;
}
