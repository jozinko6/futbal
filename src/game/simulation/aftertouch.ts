/**
 * Aftertouch — arkádový systém na ovplyvnenie trajektórie lopty po kope.
 *
 * Inšpirované pozorovaným správaním Sensible Soccer / YSoccer: po kontakte
 * s loptou môže hráč krátko pomocou smerového vstupu meniť jej dráhu.
 * Je to originálna TypeScript implementácia — žiadny kód z YSoccer nebol
 * použitý (GPL v2 clean-room reference).
 *
 * Podporuje:
 *   - bočnú rotáciu (zakrivenie doľava/doprava)
 *   - vertikálnu rotáciu (mierny lob/pokles)
 *   - postupne slabnúci účinok
 *   - typ-špecifické okná (pass < shot < power shot < super shot)
 *   - deterministické (žiadny Math.random)
 */
import { FIXED_DT, mps } from './constants';
import type { BallState, MatchState } from './types';

export interface AftertouchState {
  active: boolean;
  sourcePlayerId: number | null;
  startedTick: number;
  expiresTick: number;
  lateralSpin: number;   // -1..1 (negatívne = doľava, pozitívne = doprava)
  verticalSpin: number;  // -1..1 (pozitívne = nahor, negatívne = nadol)
  strength: number;      // 0..1, maximálna sila aftertouch efektu
}

/** Dĺžka aftertouch okna v tickoch podľa typu kopu. */
function aftertouchWindowTicks(kickType: string): number {
  switch (kickType) {
    case 'SHORT_PASS':
    case 'DRIVEN_PASS': return Math.round(0.10 / FIXED_DT);  // ~80-140ms
    case 'THROUGH_PASS': return Math.round(0.14 / FIXED_DT);
    case 'LOB_PASS': return Math.round(0.16 / FIXED_DT);
    case 'NORMAL_SHOT': return Math.round(0.20 / FIXED_DT);  // ~160-240ms
    case 'POWER_SHOT': return Math.round(0.28 / FIXED_DT);   // ~220-320ms
    case 'SUPER_SHOT': return Math.round(0.34 / FIXED_DT);   // ~280-380ms
    case 'HYPER_SHOT': return Math.round(0.40 / FIXED_DT);
    default: return Math.round(0.12 / FIXED_DT);
  }
}

/** Sila aftertouch efektu podľa typu kopu. */
function aftertouchStrength(kickType: string): number {
  switch (kickType) {
    case 'SHORT_PASS':
    case 'DRIVEN_PASS': return 0.15;
    case 'THROUGH_PASS': return 0.20;
    case 'LOB_PASS': return 0.10;
    case 'NORMAL_SHOT': return 0.35;
    case 'POWER_SHOT': return 0.55;
    case 'SUPER_SHOT': return 0.80;
    case 'HYPER_SHOT': return 1.0;
    default: return 0.20;
  }
}

/** Max bočná sila (px/s²) aplikovaná na loptu. */
const MAX_LATERAL_FORCE = 800;
/** Max vertikálna sila (px/s²). */
const MAX_VERTICAL_FORCE = 400;

/** Začni aftertouch po kope. */
export function startAftertouch(
  state: MatchState,
  playerId: number,
  kickType: string,
): AftertouchState {
  const ticks = aftertouchWindowTicks(kickType);
  const strength = aftertouchStrength(kickType);
  return {
    active: true,
    sourcePlayerId: playerId,
    startedTick: state.tick,
    expiresTick: state.tick + ticks,
    lateralSpin: 0,
    verticalSpin: 0,
    strength,
  };
}

/** Aktualizuj aftertouch vstup z hráča (smerový vstup). */
export function updateAftertouchInput(
  at: AftertouchState,
  moveX: number,
  moveY: number,
  state: MatchState,
): void {
  if (!at.active || state.tick >= at.expiresTick) {
    at.active = false;
    return;
  }
  // Lateral = moveX (doľava/doprava).
  at.lateralSpin = Math.max(-1, Math.min(1, moveX));
  // Vertical = moveY (hore/dole). Negatívne Y = hore (lob), pozitívne = nadol.
  at.verticalSpin = Math.max(-1, Math.min(1, -moveY));
}

/** Aplikuj aftertouch na loptu každý tick. */
export function applyAftertouch(
  at: AftertouchState,
  ball: BallState,
  state: MatchState,
  dt: number,
): void {
  if (!at.active || state.tick >= at.expiresTick) {
    at.active = false;
    return;
  }
  // Vypočítaj zostávajúcu silu (lineárne slabne).
  const remaining = (at.expiresTick - state.tick) / (at.expiresTick - at.startedTick);
  const effectiveStrength = at.strength * remaining;

  // Bočná sila — kolmá na smer pohybu lopty.
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed > 1) {
    // Kolmý vektor k smeru lopty.
    const perpX = -ball.vy / ballSpeed;
    const perpY = ball.vx / ballSpeed;
    const lateralForce = at.lateralSpin * MAX_LATERAL_FORCE * effectiveStrength;
    ball.vx += perpX * lateralForce * dt;
    ball.vy += perpY * lateralForce * dt;
  }

  // Vertikálna sila — ovplyvňuje vz (len keď je lopta vo vzduchu).
  if (ball.z > 0 || ball.vz > 0) {
    const verticalForce = at.verticalSpin * MAX_VERTICAL_FORCE * effectiveStrength;
    ball.vz += verticalForce * dt;
  }

  // Spin pre vizuálny efekt.
  ball.spin += at.lateralSpin * effectiveStrength * 0.1;
}

/** Skontroluj, či je aftertouch stále aktívny. */
export function isAftertouchActive(at: AftertouchState | null, state: MatchState): boolean {
  if (!at || !at.active) return false;
  if (state.tick >= at.expiresTick) {
    at.active = false;
    return false;
  }
  return true;
}

/** Zruš aftertouch (napr. pri získañí kontroly iným hráčom). */
export function cancelAftertouch(at: AftertouchState | null): void {
  if (at) at.active = false;
}
