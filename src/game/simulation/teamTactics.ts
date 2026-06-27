/**
 * TeamTacticalController — decides each team's phase and sets dynamic
 * formation positions, pressing, cover assignments.
 */
import {
  FIELD_CX, FIELD_CY, FIELD_RIGHT, FIELD_X, m,
  TEAM_TACTICS, DIFFICULTY_PARAMS,
  type TeamPhase, type FutsalRole,
} from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { formationSlot, indexInTeam } from './formation';
import { dist } from './math';

function attackingGoalX(team: Team): number { return team === 0 ? FIELD_RIGHT : FIELD_X; }
function ownGoalX(team: Team): number { return team === 0 ? FIELD_X : FIELD_RIGHT; }

/** Decide the team's tactical phase from ball position and possession. */
export function decideTeamPhase(state: MatchState, team: Team): TeamPhase {
  const ball = state.ball;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  const weHaveBall = owner != null && owner.team === team;
  const ballX = ball.x;
  const dirSign = team === 0 ? 1 : -1;
  const ballAttackingX = team === 0 ? ballX : FIELD_RIGHT - (ballX - FIELD_X);
  const inFinalThird = ballAttackingX > m(TEAM_TACTICS.finalThirdX);

  if (!weHaveBall) {
    // Defending.
    if (owner == null) {
      // Loose ball — transition to press if close to our goal, else recover.
      const distOwnGoal = Math.abs(ballX - ownGoalX(team));
      if (distOwnGoal < m(12)) return 'HIGH_PRESS';
      return 'DEFENSIVE_TRANSITION';
    }
    const oppDist = Math.abs(ballX - ownGoalX(team));
    const press = DIFFICULTY_PARAMS[state.difficulty].aggression;
    if (oppDist < m(TEAM_TACTICS.pressLineDepth) && press > TEAM_TACTICS.pressThreshold) return 'HIGH_PRESS';
    return 'ORGANIZED_DEFENSE';
  } else {
    // Attacking.
    if (inFinalThird) return 'FINAL_THIRD';
    if (ballAttackingX < m(12)) return 'BUILD_UP';
    return 'ATTACK';
  }
}

/** Update dynamic formation positions + assignments for a team. */
export function updateTeamTactics(state: MatchState, team: Team): void {
  const phase = decideTeamPhase(state, team);
  state.teamPhase[team] = phase;
  const ball = state.ball;
  const dirSign = team === 0 ? 1 : -1;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  const weHaveBall = owner != null && owner.team === team;

  for (const p of state.players) {
    if (p.team !== team) continue;
    const slot = formationSlot(team, indexInTeam(p.id));
    let tx = slot.x;
    let ty = slot.y;
    // Shift toward ball y.
    const ballYShift = (ball.y - FIELD_CY) * 0.3;
    ty = slot.y + ballYShift;

    if (weHaveBall) {
      // Attack: stretch width, advance non-fixo/GK.
      const width = m(TEAM_TACTICS.attackWidth / 2);
      if (p.role === 'pivot') tx = ball.x + m(3) * dirSign;
      else if (p.role === 'leftAla') { tx = ball.x + m(2) * dirSign; ty = FIELD_CY - width; }
      else if (p.role === 'rightAla') { tx = ball.x + m(2) * dirSign; ty = FIELD_CY + width; }
      else if (p.role === 'fixo') tx = ownGoalX(team) + m(6) * dirSign; // stay back (cover)
      // goalkeeper stays home.
    } else {
      // Defend: compress width, hold depth.
      const width = m(TEAM_TACTICS.defenseWidth / 2);
      if (p.role === 'pivot') tx = FIELD_CX + m(3) * dirSign; // counter-threat
      else if (p.role === 'leftAla') { tx = slot.x - m(2) * dirSign; ty = FIELD_CY - width; }
      else if (p.role === 'rightAla') { tx = slot.x - m(2) * dirSign; ty = FIELD_CY + width; }
      else if (p.role === 'fixo') tx = ownGoalX(team) + m(4) * dirSign;
      // Shift x toward ball.
      tx += (ball.x - FIELD_CX) * 0.1;
    }
    p.dynamicFormationPosition = { x: tx, y: ty };
    // Marking: nearest opponent for alas/fixo when defending.
    if (!weHaveBall && p.role !== 'goalkeeper') {
      p.markingTarget = nearestOpponentId(state, team, p.x, p.y);
    } else {
      p.markingTarget = null;
    }
  }

  // Assign ball-chaser + cover when we don't have the ball.
  if (!weHaveBall) {
    const chaser = nearestPlayerToBall(state, team);
    if (chaser) chaser.aiAction = 'PRESS';
    // Second closest covers the passing lane toward the ball.
    const second = secondNearestPlayerToBall(state, team, chaser?.id ?? -1);
    if (second) second.aiAction = 'COVER';
  }
}

function nearestOpponentId(state: MatchState, team: Team, x: number, y: number): number | null {
  let best: number | null = null;
  let bd = Infinity;
  for (const o of state.players) {
    if (o.team === team) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) { bd = d; best = o.id; }
  }
  return best;
}

function nearestPlayerToBall(state: MatchState, team: Team): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.role === 'goalkeeper') continue;
    const d = dist(p.x, p.y, state.ball.x, state.ball.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function secondNearestPlayerToBall(state: MatchState, team: Team, excludeId: number): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.role === 'goalkeeper' || p.id === excludeId) continue;
    const d = dist(p.x, p.y, state.ball.x, state.ball.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export { attackingGoalX };
