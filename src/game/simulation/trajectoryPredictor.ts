/**
 * Trajectory Predictor — predikuje budúcu trajektóriu lopty.
 *
 * Inšpirované konceptom z YSoccer: viacnásobná predikcia (curve left,
 * neutral, curve right). Originálna TypeScript implementácia.
 *
 * Používa sa pre:
 *   - výber hráča (auto-switch)
 *   - AI interception
 *   - brankára
 *   - pass assistance
 *   - debug overlay
 *
 * Nikdy nemení aktívny BallState — pracuje s dočasnou kópiou.
 */
import { FIXED_DT, mps, BALL, GRAVITY, BALL_FRICTION, BALL_AIR_DRAG } from './constants';
import type { BallState } from './types';

export interface PredictedBallPoint {
  tickOffset: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface BallTrajectorySet {
  curveLeft: PredictedBallPoint[];
  neutral: PredictedBallPoint[];
  curveRight: PredictedBallPoint[];
}

const PREDICT_SECONDS = 2.0;
const PREDICT_STEP = 2; // every 2 ticks (~30Hz)
const MAX_LATERAL_FORCE = 800;

/** Skopíruj loptu do dočasného stavu. */
function cloneBall(ball: BallState): BallState {
  return { ...ball };
}

/** Integrácia jedného kroku (zhodná s integrateBall, ale na kópii). */
function stepBall(b: BallState, dt: number, lateralForce: number): void {
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.z > 0 || b.vz > 0) {
    b.vz -= GRAVITY * dt;
    b.z += b.vz * dt;
    const drag = Math.pow(1 - BALL_AIR_DRAG, dt);
    b.vx *= drag;
    b.vy *= drag;
    if (b.z <= 0) {
      b.z = 0;
      const sp = Math.hypot(b.vx, b.vy);
      if (b.vz < -mps(BALL.restThreshold)) {
        b.vz = -b.vz * BALL.bounceRestitution;
        b.spin += sp * 0.02;
      } else {
        b.vz = 0;
      }
    }
  } else {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      const decel = BALL_FRICTION * dt;
      const ns = Math.max(0, sp - decel);
      b.vx *= ns / sp;
      b.vy *= ns / sp;
    }
  }

  // Aplikuj bočnú silu (aftertouch simulácia).
  if (lateralForce !== 0 && b.z >= 0) {
    const ballSp = Math.hypot(b.vx, b.vy);
    if (ballSp > 1) {
      const perpX = -b.vy / ballSp;
      const perpY = b.vx / ballSp;
      b.vx += perpX * lateralForce * dt;
      b.vy += perpY * lateralForce * dt;
    }
  }
}

/** Predikuj trajektóriu s danou bočnou silou. */
function predictTrajectory(ball: BallState, lateralForce: number): PredictedBallPoint[] {
  const points: PredictedBallPoint[] = [];
  const sim = cloneBall(ball);
  const totalTicks = Math.round(PREDICT_SECONDS / FIXED_DT);

  for (let t = 0; t <= totalTicks; t += PREDICT_STEP) {
    points.push({
      tickOffset: t,
      x: sim.x, y: sim.y, z: sim.z,
      vx: sim.vx, vy: sim.vy, vz: sim.vz,
    });
    for (let s = 0; s < PREDICT_STEP; s++) {
      stepBall(sim, FIXED_DT, lateralForce);
    }
  }
  return points;
}

/** Vypočítaj trajektóriu (neutral + curve left + curve right). */
export function predictTrajectorySet(ball: BallState): BallTrajectorySet {
  return {
    neutral: predictTrajectory(ball, 0),
    curveLeft: predictTrajectory(ball, -MAX_LATERAL_FORCE * 0.5),
    curveRight: predictTrajectory(ball, MAX_LATERAL_FORCE * 0.5),
  };
}

/** Nájdi bod na trajektórii v danom ticku. */
export function getPointAtTick(traj: PredictedBallPoint[], tickOffset: number): PredictedBallPoint | null {
  for (const p of traj) {
    if (p.tickOffset >= tickOffset) return p;
  }
  return traj[traj.length - 1] ?? null;
}

/** Nájdi bod dopadu (z = 0 po vzlete). */
export function findLandingPoint(traj: PredictedBallPoint[]): PredictedBallPoint | null {
  let wasAirborne = false;
  for (const p of traj) {
    if (p.z > 1) wasAirborne = true;
    if (wasAirborne && p.z <= 0) return p;
  }
  return null;
}

/** Nájdi najbližší bod trajektórie k pozícii (x, y). */
export function findClosestPoint(traj: PredictedBallPoint[], x: number, y: number): { point: PredictedBallPoint; distance: number; index: number } | null {
  let best: { point: PredictedBallPoint; distance: number; index: number } | null = null;
  for (let i = 0; i < traj.length; i++) {
    const p = traj[i];
    const d = Math.hypot(p.x - x, p.y - y);
    if (!best || d < best.distance) best = { point: p, distance: d, index: i };
  }
  return best;
}
