/**
 * Ball Reception — spracovanie prichádzajúcej lopty.
 *
 * Inšpirované princípom z YSoccer: hodnotí relatívnu rýchlosť, výšku,
 * uhol, tlak a skill. Originálna TypeScript implementácia.
 *
 * Výsledky:
 *   - CLEAN_CONTROL — spoľahlivé prevzatie
 *   - DIRECTED_TOUCH — mierne odskočenie do smeru pohybu
 *   - HEAVY_TOUCH — výrazné odskočenie
 *   - DEFLECTION — lopta odrazená do voľného priestoru
 *   - HEADER_AVAILABLE — vysoká lopta, možná hlavička
 *   - VOLLEY_AVAILABLE — lopta vo vzduchu, možný volej
 */
import { m, mps, BALL, MOVEMENT } from './constants';
import type { BallState, MatchState, PlayerEntity, Team } from './types';
import { dist, angleTo } from './math';

export type ReceptionResult =
  | { type: 'CLEAN_CONTROL'; quality: number }
  | { type: 'DIRECTED_TOUCH'; quality: number; velocity: { x: number; y: number } }
  | { type: 'HEAVY_TOUCH'; quality: number; velocity: { x: number; y: number } }
  | { type: 'DEFLECTION'; quality: number; velocity: { x: number; y: number } }
  | { type: 'HEADER_AVAILABLE'; quality: number }
  | { type: 'VOLLEY_AVAILABLE'; quality: number };

/** Vyhodnoť prijatie lopty hráčom. */
export function evaluateReception(
  state: MatchState,
  player: PlayerEntity,
  ball: BallState,
): ReceptionResult {
  const incomingSpeed = Math.hypot(ball.vx, ball.vy);
  const ballAng = angleTo(ball.x, ball.y, player.x, player.y);
  const facingDiff = Math.abs(angleDiff(player.facing, ballAng));

  // Tlak — najbližší súper.
  let oppDist = Infinity;
  for (const o of state.players) {
    if (o.team === player.team || o.stunnedTime > 0) continue;
    oppDist = Math.min(oppDist, dist(o.x, o.y, player.x, player.y));
  }
  const pressure = oppDist < m(1.5) ? 1 - oppDist / m(1.5) : 0;

  // Rýchlosť lopty.
  const speedFactor = Math.min(1, incomingSpeed / mps(BALL.passSpeed.driven));

  // Výška lopty.
  const heightFactor = Math.min(1, ball.z / m(1.5));

  // Úhol príchodu.
  const angleFactor = facingDiff / Math.PI;

  // Pohyb hráča proti lopte.
  const playerSpeed = Math.hypot(player.vx, player.vy);
  const movingAgainst = playerSpeed > mps(MOVEMENT.jogSpeed) && Math.abs(angleDiff(player.moveDir, ballAng + Math.PI)) < Math.PI / 2;
  const againstPenalty = movingAgainst ? 0.15 : 0;

  // Kvalita (0..1, 1 = perfektné).
  let q = 1
    - 0.25 * speedFactor
    - 0.15 * angleFactor
    - 0.25 * pressure
    - 0.20 * heightFactor
    - 0.10 * (1 - player.stamina / 100)
    - againstPenalty;
  q = Math.max(0.15, Math.min(1, q));

  // Vysoká lopta → header/volley.
  if (ball.z > m(1.5)) {
    return { type: 'HEADER_AVAILABLE', quality: q };
  }
  if (ball.z > m(0.5)) {
    return { type: 'VOLLEY_AVAILABLE', quality: q };
  }

  // Nízka lopta — rozhodni podľa kvality.
  if (q >= 0.55) {
    return { type: 'CLEAN_CONTROL', quality: q };
  }
  if (q >= 0.35) {
    // DIRECTED_TOUCH — mierne odskočenie v smere pohybu.
    const dir = playerSpeed > 1 ? Math.atan2(player.vy, player.vx) : player.facing;
    const power = mps(BALL.passSpeed.short) * (1 - q) * 0.5;
    return {
      type: 'DIRECTED_TOUCH',
      quality: q,
      velocity: { x: Math.cos(dir) * power, y: Math.sin(dir) * power },
    };
  }
  if (q >= 0.20) {
    // HEAVY_TOUCH — výrazné odskočenie.
    const away = angleTo(player.x, player.y, ball.x, ball.y);
    const power = mps(BALL.passSpeed.short) * (1 - q) * 0.8;
    return {
      type: 'HEAVY_TOUCH',
      quality: q,
      velocity: { x: Math.cos(away) * power, y: Math.sin(away) * power },
    };
  }
  // DEFLECTION — lopta odrazená do voľného priestoru.
  const opp = nearestOpponent(state, player.team, player.x, player.y);
  const deflAng = opp ? angleTo(player.x, player.y, opp.x, opp.y) + Math.PI : angleTo(player.x, player.y, ball.x, ball.y);
  const power = mps(BALL.passSpeed.short) * (1 - q);
  return {
    type: 'DEFLECTION',
    quality: q,
    velocity: { x: Math.cos(deflAng) * power, y: Math.sin(deflAng) * power },
  };
}

function nearestOpponent(state: MatchState, team: Team, x: number, y: number): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const o of state.players) {
    if (o.team === team) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
