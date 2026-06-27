/**
 * Player selection — vylepšený auto-switch algoritmus.
 *
 * Inšpirovaný pozorovaným správaním Sensible Soccer / YSoccer: auto-switch
 * vyberá najrelevantnejšieho hráča na základe viacerých faktorov, nielen
 * vzdialenosti. Originálna TypeScript implementácia (clean-room reference).
 *
 * Kandidát sa hodnotí podľa:
 *   - predikovaného času k lopte
 *   - smeru pohybu hráča voči lopte
 *   - vzdialenosti
 *   - role (GK sa neprepína)
 *   - polohy voči vlastnej bráne
 *   - očakávaného bodu dopadu (pri vysokej lopte)
 *   - tímového assignmentu
 *
 * Hysterézia: nový kandidát musí byť jasne lepší (threshold 0.18).
 */
import { m, mps, MOVEMENT, FIELD_X, FIELD_RIGHT, FIELD_CY } from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { dist } from './math';

/** Hysterézia threshold — nový kandidát musí byť o toľko lepší. */
export const SWITCH_THRESHOLD = 0.18;

/** Skóre kandidáta (nižšie = lepší). */
export interface CandidateScore {
  playerId: number;
  score: number;       // 0..1 (0 = najlepší)
  timeToBall: number;  // predikovaný čas (s)
  reasons: string[];
}

/** Vyhodnoť kandidáta pre auto-switch. */
export function scoreCandidate(
  state: MatchState,
  player: PlayerEntity,
  currentActiveId: number,
): CandidateScore | null {
  if (player.role === 'goalkeeper') return null;
  if (player.stunnedTime > 0) return null;

  const ball = state.ball;
  const reasons: string[] = [];

  // 1. Predikovaný bod dopadu pre vysokú loptu.
  let targetX = ball.x;
  let targetY = ball.y;
  if (ball.z > m(0.5) && ball.vz > 0) {
    // Predikuj kde lopta dopadne.
    const tToLand = ball.vz > 0 ? ball.vz / (9.81 * 32) : 0;
    targetX = ball.x + ball.vx * tToLand;
    targetY = ball.y + ball.vy * tToLand;
    reasons.push(`aerial predict (${tToLand.toFixed(2)}s)`);
  } else if (ball.vx !== 0 || ball.vy !== 0) {
    // Pre pohybujúcu sa loptu predikuj bod o 0.3s vpred.
    targetX = ball.x + ball.vx * 0.3;
    targetY = ball.y + ball.vy * 0.3;
    reasons.push('moving predict');
  }

  // 2. Vzdialenosť k predikovanému bodu.
  const d = dist(player.x, player.y, targetX, targetY);
  if (d > m(30)) return null; // príliš ďaleko

  // 3. Predikovaný čas k lopte.
  const playerSpeed = mps(MOVEMENT.runSpeed);
  const timeToBall = d / playerSpeed;

  // 4. Smer hráča voči lopte (je už na ceste?).
  const ballAng = Math.atan2(targetY - player.y, targetX - player.x);
  const facingDiff = Math.abs(angleDiff(player.facing, ballAng));
  const directionScore = facingDiff / Math.PI; // 0 = smeruje k lopte, 1 = opačne

  // 5. Poloha voči vlastnej bráne (preferuj hráčov medzi loptou a bránou).
  const ownGoalX = player.team === 0 ? FIELD_X : FIELD_RIGHT;
  const distOwnGoal = Math.abs(player.x - ownGoalX);
  const ballDistOwnGoal = Math.abs(ball.x - ownGoalX);
  const defensiveBonus = (ballDistOwnGoal < distOwnGoal) ? 0.1 : 0;

  // 6. Aktuálny hráč dostane bonus (hysterézia).
  const currentBonus = (player.id === currentActiveId) ? -SWITCH_THRESHOLD : 0;

  // Kombinované skóre (nižšie = lepší).
  const score = Math.max(0,
    timeToBall * 0.4 +
    directionScore * 0.2 +
    (d / m(30)) * 0.2 +
    defensiveBonus +
    currentBonus
  );

  return { playerId: player.id, score, timeToBall, reasons };
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Nájdi najlepšieho kandidáta na auto-switch. */
export function findBestCandidate(
  state: MatchState,
  team: Team,
  currentActiveId: number,
): CandidateScore | null {
  let best: CandidateScore | null = null;
  for (const p of state.players) {
    if (p.team !== team) continue;
    const candidate = scoreCandidate(state, p, currentActiveId);
    if (!candidate) continue;
    if (!best || candidate.score < best.score) best = candidate;
  }
  return best;
}

/** Rozhodni, či by sa mal auto-switch vykonať. */
export function shouldAutoSwitch(
  state: MatchState,
  team: Team,
  currentActiveId: number,
): { switch: boolean; newPlayerId: number; reason: string } {
  const current = state.players[currentActiveId];
  if (!current || current.hasBall) return { switch: false, newPlayerId: currentActiveId, reason: 'has ball' };

  const best = findBestCandidate(state, team, currentActiveId);
  if (!best) return { switch: false, newPlayerId: currentActiveId, reason: 'no candidate' };
  if (best.playerId === currentActiveId) return { switch: false, newPlayerId: currentActiveId, reason: 'already best' };

  // Hysterézia: nový kandidát musí byť jasne lepší.
  const currentScore = scoreCandidate(state, current, currentActiveId);
  if (currentScore && best.score >= currentScore.score - SWITCH_THRESHOLD) {
    return { switch: false, newPlayerId: currentActiveId, reason: 'hysteresis' };
  }

  return { switch: true, newPlayerId: best.playerId, reason: best.reasons.join('; ') };
}
