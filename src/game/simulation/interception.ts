/**
 * Interception Estimator — odhaduje čas a bod prechytania lopty.
 *
 * Inšpirované konceptom z YSoccer: hodnotí nielen vzdialenosť, ale aj
 * smer, rýchlosť, otočenie, výšku lopty a rolu hráča.
 * Originálna TypeScript implementácia.
 *
 * Používa trajectory predictor pre presný odhad bodu prechytania.
 */
import { m, mps, MOVEMENT, TACKLE_RADIUS, CONTROL_RADIUS } from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { dist } from './math';
import { predictTrajectorySet, findClosestPoint, type PredictedBallPoint, type BallTrajectorySet } from './trajectoryPredictor';

export interface InterceptionEstimate {
  playerId: number;
  trajectory: 'LEFT' | 'NEUTRAL' | 'RIGHT';
  interceptTick: number | null;
  interceptPoint: { x: number; y: number; z: number } | null;
  arrivalMargin: number; // seconds early (positive) or late (negative)
  requiresSprint: boolean;
  action: 'CONTROL' | 'HEADER' | 'VOLLEY' | 'TACKLE' | 'KEEPER_SAVE' | null;
}

const REACTION_TIME = {
  easy: 0.40,
  normal: 0.25,
  hard: 0.15,
};

/** Vypočítaj odhad prechytania pre hráča. */
export function estimateInterception(
  state: MatchState,
  player: PlayerEntity,
  trajectories?: BallTrajectorySet,
): InterceptionEstimate {
  const ball = state.ball;
  const traj = trajectories ?? predictTrajectorySet(ball);
  const reaction = REACTION_TIME[state.difficulty] ?? 0.25;

  // Ak je lopta kontrolovaná, nie je čo prechytávať.
  if (ball.mode === 'CONTROLLED' || ball.mode === 'GK_HELD') {
    return {
      playerId: player.id, trajectory: 'NEUTRAL',
      interceptTick: null, interceptPoint: null,
      arrivalMargin: 0, requiresSprint: false, action: null,
    };
  }

  // Pre každú trajektóriu (left/neutral/right) nájdi najlepší bod prechytania.
  let best: InterceptionEstimate | null = null;
  let bestScore = -Infinity;

  for (const [trajName, trajPoints] of [
    ['LEFT', traj.curveLeft],
    ['NEUTRAL', traj.neutral],
    ['RIGHT', traj.curveRight],
  ] as const) {
    // Pre každý bod na trajektórií skontroluj, či hráč môže dosiahnuť.
    for (const point of trajPoints) {
      const tickOffset = point.tickOffset;
      const timeToReach = (tickOffset * (1 / 60)) + reaction; // s

      // Vzdialenosť hráča k bodu.
      const d = dist(player.x, player.y, point.x, point.y);

      // Efektívna rýchlosť hráča (zohľadňuje smer a otočenie).
      const ballAng = Math.atan2(point.y - player.y, point.x - player.x);
      const facingDiff = Math.abs(angleDiff(player.facing, ballAng));
      const turnPenalty = Math.min(0.5, facingDiff / Math.PI * 0.5);
      const effectiveSpeed = mps(MOVEMENT.runSpeed) * (1 - turnPenalty);
      const sprintSpeed = mps(MOVEMENT.sprintSpeed) * (1 - turnPenalty * 0.5);

      // Čas hráča k bodu.
      const playerTime = d / Math.max(1, effectiveSpeed);
      const playerTimeSprint = d / Math.max(1, sprintSpeed);

      // Dosah hráča.
      const reach = player.role === 'goalkeeper' ? CONTROL_RADIUS + m(0.3) : CONTROL_RADIUS;

      // Ak hráč môže dosiahnuť bod včas.
      const canReachNormal = playerTime <= timeToReach + 0.1;
      const canReachSprint = playerTimeSprint <= timeToReach + 0.1;

      if (!canReachNormal && !canReachSprint) continue;

      // Skóre: skorší = lepší.
      const margin = timeToReach - (canReachNormal ? playerTime : playerTimeSprint);
      const score = margin - (canReachSprint ? 0.2 : 0); // penalizácia za šprint

      if (score > bestScore) {
        bestScore = score;
        // Urči akciu podľa výšky lopty.
        let action: InterceptionEstimate['action'] = 'CONTROL';
        if (point.z > m(1.5)) action = 'HEADER';
        else if (point.z > m(0.5)) action = 'VOLLEY';
        else if (player.role === 'goalkeeper') action = 'KEEPER_SAVE';
        else if (d < TACKLE_RADIUS) action = 'TACKLE';

        best = {
          playerId: player.id,
          trajectory: trajName as 'LEFT' | 'NEUTRAL' | 'RIGHT',
          interceptTick: state.tick + tickOffset,
          interceptPoint: { x: point.x, y: point.y, z: point.z },
          arrivalMargin: margin,
          requiresSprint: canReachSprint && !canReachNormal,
          action,
        };
      }
    }
  }

  return best ?? {
    playerId: player.id, trajectory: 'NEUTRAL',
    interceptTick: null, interceptPoint: null,
    arrivalMargin: -1, requiresSprint: false, action: null,
  };
}

/** Nájdi najlepšieho hráča tímu na prechytanie lopty. */
export function findBestInterceptor(
  state: MatchState,
  team: Team,
  trajectories?: BallTrajectorySet,
): InterceptionEstimate | null {
  const traj = trajectories ?? predictTrajectorySet(state.ball);
  let best: InterceptionEstimate | null = null;
  let bestMargin = -Infinity;

  for (const p of state.players) {
    if (p.team !== team || p.stunnedTime > 0) continue;
    const est = estimateInterception(state, p, traj);
    if (est.interceptTick == null) continue;
    if (est.arrivalMargin > bestMargin) {
      bestMargin = est.arrivalMargin;
      best = est;
    }
  }
  return best;
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
