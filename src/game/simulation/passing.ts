/**
 * Pass lane safety — checks whether a pass from A to B would be intercepted.
 *
 * Uses point-to-segment distance to find the closest opponent to the pass
 * lane, then compares ball travel time vs opponent intercept time.
 */
import { m, mps, MOVEMENT } from './constants';
import type { MatchState, PlayerEntity } from './types';
import { dist } from './math';

/** Returns 0..1 where 0 = completely open, 1 = certainly intercepted. */
export function passLaneSafety(
  state: MatchState,
  fromX: number, fromY: number,
  toX: number, toY: number,
  ballSpeed: number,
  passingTeam: number,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const segLen = Math.hypot(dx, dy);
  if (segLen < 1) return 0;

  const ballTime = segLen / Math.max(1, ballSpeed);
  let maxDanger = 0;

  for (const opp of state.players) {
    if (opp.team === passingTeam) continue;
    // Point-to-segment distance.
    const t = Math.max(0, Math.min(1, ((opp.x - fromX) * dx + (opp.y - fromY) * dy) / (segLen * segLen)));
    const projX = fromX + t * dx;
    const projY = fromY + t * dy;
    const laneDist = dist(opp.x, opp.y, projX, projY);
    // Opponent reach: their radius + a buffer.
    const reach = m(1.0);
    if (laneDist > reach) continue;
    // How fast can the opponent reach the interception point?
    const oppDist = dist(opp.x, opp.y, projX, projY);
    const oppTime = oppDist / Math.max(1, mps(MOVEMENT.runSpeed));
    // If opponent can reach the lane before the ball, it's dangerous.
    if (oppTime < ballTime) {
      const danger = 1 - (oppTime / ballTime) * 0.5;
      maxDanger = Math.max(maxDanger, danger);
    } else {
      // Ball arrives first, but opponent is close — partial danger.
      const margin = (oppTime - ballTime) / ballTime;
      if (margin < 0.3) maxDanger = Math.max(maxDanger, 0.3 - margin);
    }
  }
  return maxDanger;
}

/** Pick the safest pass target from a list of candidates. */
export function pickSafestPassTarget(
  state: MatchState,
  passer: PlayerEntity,
  candidates: PlayerEntity[],
  ballSpeed: number,
): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bestScore = -Infinity;
  for (const m of candidates) {
    if (m.team !== passer.team || m.id === passer.id || m.role === 'goalkeeper') continue;
    const danger = passLaneSafety(state, passer.x, passer.y, m.x, m.y, ballSpeed, passer.team);
    // Lower danger = better. Also prefer forward passes.
    const forward = passer.team === 0 ? m.x - passer.x : passer.x - m.x;
    const score = (1 - danger) * 10 + forward * 0.002;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
