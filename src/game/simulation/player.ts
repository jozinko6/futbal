/**
 * Futsal player physics, possession, dribbling, passing, shooting, defense.
 * All movement uses SI metres-per-second (converted to px/s via mps()).
 * Positions are stored in pixels (renderer-friendly); velocities in px/s.
 */
import {
  MOVEMENT, BALL, DEFENSE, PASSING, SHOOTING, METER_PX, m, mps,
  DIFFICULTY_PARAMS,
  FIELD_CX, FIELD_CY, CONTROL_RADIUS, TACKLE_RADIUS,
} from './constants';
import type {
  AiAction, BallState, InputFrame, MatchState, PassType, PlayerEntity, ShotType, Team,
} from './types';
import { angleTo, approachAngle, dist, len } from './math';
import { kickBall } from './ball';
import { rngFloat } from './rng';

// --- Movement --------------------------------------------------------------

/** Apply a movement input to a player for one fixed step (meters-based). */
export function applyMovement(
  p: PlayerEntity,
  moveX: number,
  moveY: number,
  sprint: boolean,
  hasBall: boolean,
  dt: number,
): void {
  if (p.stunnedTime > 0 || (p.actionLock > 0 && p.state !== 'shoot')) {
    decel(p, dt);
    return;
  }
  if (p.state === 'tackle' || p.state === 'slide') return;

  const mag = len(moveX, moveY);
  // Determine target speed from SI config.
  let targetSpeed = 0;
  if (mag > 0.01) {
    const movingBackward = isBackward(p, moveX, moveY);
    if (hasBall) {
      targetSpeed = sprint ? mps(MOVEMENT.sprintWithBallSpeed) : mps(MOVEMENT.runWithBallSpeed);
    } else if (sprint) {
      targetSpeed = mps(MOVEMENT.sprintSpeed);
    } else if (movingBackward) {
      targetSpeed = mps(MOVEMENT.backwardSpeed);
    } else {
      targetSpeed = mps(MOVEMENT.runSpeed);
    }
  }

  if (mag > 0.01) {
    const nx = moveX / mag;
    const ny = moveY / mag;
    const desiredVx = nx * targetSpeed;
    const desiredVy = ny * targetSpeed;
    const accelRate = (sprint ? MOVEMENT.sprintAcceleration : MOVEMENT.acceleration) * METER_PX;
    p.vx = approach(p.vx, desiredVx, accelRate * dt);
    p.vy = approach(p.vy, desiredVy, accelRate * dt);

    // Movement direction tracks input instantly.
    p.moveDir = Math.atan2(ny, nx);

    // Body facing turns at a rate depending on ball/sprint.
    const desiredFacing = p.moveDir;
    let turnRate: number = hasBall ? MOVEMENT.turnRateWithBall : MOVEMENT.turnRate;
    if (sprint) turnRate = MOVEMENT.turnRateSprint;
    // Sharp turn at sprint → lose speed.
    const dAng = Math.abs(approachAngleDelta(p.facing, desiredFacing));
    if (sprint && dAng > MOVEMENT.sharpTurnThreshold) {
      p.vx *= MOVEMENT.sharpTurnPenalty;
      p.vy *= MOVEMENT.sharpTurnPenalty;
    }
    p.facing = approachAngle(p.facing, desiredFacing, turnRate * dt);

    p.state = sprint ? 'sprint' : 'run';
  } else {
    decel(p, dt);
    p.state = 'idle';
  }
}

function isBackward(p: PlayerEntity, mx: number, my: number): boolean {
  // Backward = movement opposite to facing.
  const dot = Math.cos(p.facing) * mx + Math.sin(p.facing) * my;
  return dot < -0.2;
}

function decel(p: PlayerEntity, dt: number): void {
  const decelRate = MOVEMENT.deceleration * METER_PX;
  p.vx = approach(p.vx, 0, decelRate * dt);
  p.vy = approach(p.vy, 0, decelRate * dt);
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

function approachAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Jockey/contain: face the ball, maintain standoff, move slowly. */
export function containMovement(p: PlayerEntity, ballX: number, ballY: number, dt: number): void {
  if (p.stunnedTime > 0 || p.actionLock > 0) { decel(p, dt); return; }
  p.facing = approachAngle(p.facing, angleTo(p.x, p.y, ballX, ballY), MOVEMENT.turnRate * dt);
  p.aimDir = p.facing;
  const d = dist(p.x, p.y, ballX, ballY);
  const want = m(DEFENSE.containDistance);
  let mvx = 0, mvy = 0;
  if (d > want + 0.3) { mvx = (ballX - p.x) / d; mvy = (ballY - p.y) / d; }
  else if (d < want - 0.3) { mvx = -(ballX - p.x) / d; mvy = -(ballY - p.y) / d; }
  const speed = mps(MOVEMENT.defensiveStrafeSpeed);
  const accelRate = MOVEMENT.acceleration * METER_PX;
  p.vx = approach(p.vx, mvx * speed, accelRate * dt);
  p.vy = approach(p.vy, mvy * speed, accelRate * dt);
  p.moveDir = Math.atan2(mvy, mvx || 1);
  p.state = 'contain';
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

export function integratePlayer(p: PlayerEntity, dt: number): void {
  // Slide tackle dash.
  if ((p.state === 'tackle' || p.state === 'slide') && p.diveTime > 0) {
    p.vx = p.diveDir.x * mps(DEFENSE.slideSpeed);
    p.vy = p.diveDir.y * mps(DEFENSE.slideSpeed);
    p.diveTime -= dt;
    if (p.diveTime <= 0) {
      p.state = 'stunned';
      p.stunnedTime = DEFENSE.slideRecover;
      p.slideCooldown = DEFENSE.slideCooldown;
      decel(p, dt);
    }
  } else if (p.state === 'goalkeeperDive' && p.diveTime > 0) {
    p.vx = p.diveDir.x * mps(DEFENSE.slideSpeed) * 0.85;
    p.vy = p.diveDir.y * mps(DEFENSE.slideSpeed) * 0.85;
    p.diveTime -= dt;
    if (p.diveTime <= 0) { p.state = 'idle'; decel(p, dt); }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.stunnedTime > 0) {
    p.stunnedTime = Math.max(0, p.stunnedTime - dt);
    if (p.stunnedTime === 0 && p.state === 'stunned') p.state = 'idle';
  }
  if (p.actionLock > 0) {
    p.actionLock = Math.max(0, p.actionLock - dt);
    if (p.actionLock === 0 && (p.state === 'pass' || p.state === 'shoot')) {
      p.state = p.vx || p.vy ? 'run' : 'idle';
    }
  }
  if (p.slideCooldown > 0) p.slideCooldown = Math.max(0, p.slideCooldown - dt);
  if (p.pokeCooldown > 0) p.pokeCooldown = Math.max(0, p.pokeCooldown - dt);
  // Shoot phase progression (windup→contact→recovery).
  if (p.shootPhase > 0) {
    p.shootPhase = Math.max(0, p.shootPhase - dt);
  }
  p.animTime += dt;
}

// --- Soft separation collisions -------------------------------------------

/** Gentle separation: push apart within personal space, no elastic bounce. */
export function resolvePlayerCollision(a: PlayerEntity, b: PlayerEntity): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = len(dx, dy);
  const min = m(MOVEMENT.radius) * 2;
  if (d > 0 && d < min) {
    const overlap = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
    // Heavy contact at speed → brief slowdown (loss of balance), not a bounce.
    const relSpeed = len(a.vx - b.vx, a.vy - b.vy);
    if (relSpeed > mps(6)) {
      a.vx *= 0.7; a.vy *= 0.7;
      b.vx *= 0.7; b.vy *= 0.7;
    }
  }
}

// --- Possession & first touch ---------------------------------------------

/** Re-evaluate which player holds the ball (proximity + control radius). */
export function resolvePossession(state: MatchState): void {
  const ball = state.ball;
  if (ball.releaseCooldown > 0) return;
  let best: PlayerEntity | null = null;
  let bestD = CONTROL_RADIUS;
  for (const p of state.players) {
    if (p.stunnedTime > 0) continue;
    if (p.state === 'tackle' || p.state === 'slide' || p.state === 'goalkeeperDive') continue;
    if (ball.possessionShield > 0 && ball.shieldTeam != null && p.team !== ball.shieldTeam) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    const reach = p.role === 'goalkeeper' ? CONTROL_RADIUS + m(0.3) : CONTROL_RADIUS;
    if (d <= reach && ball.z <= (p.role === 'goalkeeper' ? m(1.5) : m(0.8))) {
      if (d < bestD) { bestD = d; best = p; }
    }
  }
  if (best) {
    if (ball.ownerId !== best.id) {
      // First touch: compute quality from incoming ball speed/angle/pressure.
      computeFirstTouch(best, ball, state);
      ball.ownerId = best.id;
      ball.vx = 0; ball.vy = 0; ball.vz = 0;
      ball.touchTimer = BALL.dribbleTouchInterval;
      if (best.role === 'goalkeeper') { ball.gkHoldTime = 0; ball.ballState = 'GOALKEEPER_CONTROLLED'; }
      else ball.ballState = 'CONTROLLED';
      ball.indirect = false;
    }
    for (const p of state.players) p.hasBall = p.id === best.id;
  } else {
    // Loose — possibly contested if two opponents very close.
    ball.ownerId = null;
    for (const p of state.players) p.hasBall = false;
    let opp = 0;
    for (const p of state.players) {
      if (dist(p.x, p.y, ball.x, ball.y) < CONTROL_RADIUS + m(0.5)) opp++;
    }
    ball.ballState = opp >= 2 ? 'CONTESTED' : 'LOOSE';
  }
}

/** First-touch quality (0..1). Bad touch → ball deflects into space. */
function computeFirstTouch(p: PlayerEntity, ball: BallState, state: MatchState): void {
  const incomingSpeed = len(ball.vx, ball.vy);
  const ang = Math.abs(approachAngleDelta(p.facing, angleTo(ball.x, ball.y, p.x, p.y)));
  // Pressure from nearest opponent.
  let oppDist = Infinity;
  for (const o of state.players) {
    if (o.team === p.team || o.stunnedTime > 0) continue;
    oppDist = Math.min(oppDist, dist(o.x, o.y, p.x, p.y));
  }
  const pressure = oppDist < m(1.5) ? 1 - oppDist / m(1.5) : 0;
  const speedFactor = Math.min(1, incomingSpeed / mps(BALL.passSpeed.driven));
  let q = 1 - 0.3 * speedFactor - 0.2 * (ang / Math.PI) - 0.3 * pressure - 0.2 * (ball.z / m(1.5));
  q = Math.max(0.2, Math.min(1, q));
  p.firstTouchQuality = q;
  // Bad touch → deflect ball away.
  if (q < 0.5) {
    const away = angleTo(p.x, p.y, ball.x, ball.y);
    const power = mps(BALL.passSpeed.short) * (1 - q);
    kickBall(ball, Math.cos(away), Math.sin(away), power, 0);
    p.hasBall = false;
    ball.ownerId = null;
    ball.releaseCooldown = 0.2;
    ball.ballState = 'LOOSE';
  }
}

/** Touch-based dribbling: re-touch the ball at intervals, ahead of the player. */
export function dribble(state: MatchState, dt: number): void {
  const ball = state.ball;
  if (ball.ownerId == null) return;
  const owner = state.players[ball.ownerId];
  if (!owner || owner.stunnedTime > 0) return;
  ball.touchTimer -= dt;
  const sp = len(owner.vx, owner.vy);
  if (ball.touchTimer <= 0 || sp > 1) {
    // Re-touch: place ball ahead by touch distance scaled by speed.
    const speedRatio = Math.min(1, sp / mps(MOVEMENT.sprintSpeed));
    const ahead = m(BALL.dribbleTouchDistance.min) + speedRatio * m(BALL.dribbleTouchDistance.max - BALL.dribbleTouchDistance.min);
    const tx = owner.x + Math.cos(owner.facing) * ahead;
    const ty = owner.y + Math.sin(owner.facing) * ahead;
    // Move ball toward the touch point (not glued).
    const k = Math.min(1, 16 * dt);
    ball.x += (tx - ball.x) * k;
    ball.y += (ty - ball.y) * k;
    ball.z = 0;
    ball.vx = owner.vx * 0.8;
    ball.vy = owner.vy * 0.8;
    ball.touchTimer = Math.max(0.06, BALL.dribbleTouchInterval * (1 - speedRatio * 0.5));
  } else {
    // Between touches, ball coasts with the player's velocity (independent).
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Keep it near the owner.
    const d = dist(ball.x, ball.y, owner.x, owner.y);
    if (d > m(2.5)) {
      // Ball got away — release.
      ball.ownerId = null;
      ball.releaseCooldown = 0.2;
      ball.ballState = 'LOOSE';
    }
  }
}

// --- Tackles & defense -----------------------------------------------------

export function startTackle(p: PlayerEntity, dirX: number, dirY: number): boolean {
  if (p.slideCooldown > 0 || p.stunnedTime > 0 || p.actionLock > 0 || p.role === 'goalkeeper') return false;
  const n = len(dirX, dirY) || 1;
  p.diveDir = { x: dirX / n, y: dirY / n };
  p.diveTime = DEFENSE.slideDuration;
  p.state = 'slide';
  p.facing = Math.atan2(p.diveDir.y, p.diveDir.x);
  return true;
}

export function pokeTackle(tackler: PlayerEntity, state: MatchState): boolean {
  if (tackler.pokeCooldown > 0 || tackler.stunnedTime > 0) return false;
  const ball = state.ball;
  if (ball.possessionShield > 0 && ball.shieldTeam != null && ball.shieldTeam !== tackler.team) return false;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  if (owner && owner.team !== tackler.team && owner.role !== 'goalkeeper' &&
      dist(tackler.x, tackler.y, owner.x, owner.y) <= m(DEFENSE.pokeRadius)) {
    // Poke: nudge the ball away from the owner.
    const dir = angleTo(owner.x, owner.y, tackler.x, tackler.y);
    kickBall(ball, Math.cos(dir), Math.sin(dir), mps(BALL.passSpeed.short), 0);
    owner.hasBall = false;
    tackler.pokeCooldown = DEFENSE.pokeCooldown;
    return true;
  }
  tackler.pokeCooldown = DEFENSE.pokeCooldown;
  return false;
}

export function tryTackle(tackler: PlayerEntity, state: MatchState): boolean {
  const ball = state.ball;
  if (ball.possessionShield > 0 && ball.shieldTeam != null && ball.shieldTeam !== tackler.team) return false;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  if (owner && owner.team !== tackler.team && owner.role !== 'goalkeeper' &&
      dist(tackler.x, tackler.y, owner.x, owner.y) <= TACKLE_RADIUS) {
    dispossess(owner, state);
    return true;
  }
  return false;
}

export function dispossess(p: PlayerEntity, state: MatchState): void {
  p.hasBall = false;
  p.stunnedTime = DEFENSE.stunDuration;
  p.state = 'stunned';
  state.ball.ownerId = null;
  state.ball.releaseCooldown = 0.25;
  state.ball.ballState = 'LOOSE';
}

export function gkDive(gk: PlayerEntity, dirX: number, dirY: number): void {
  const n = len(dirX, dirY) || 1;
  gk.diveDir = { x: dirX / n, y: dirY / n };
  gk.diveTime = 0.35;
  gk.state = 'goalkeeperDive';
  gk.facing = Math.atan2(gk.diveDir.y, gk.diveDir.x);
}

// --- Passing (limited assistance) -----------------------------------------

/** Pick the best teammate in the input cone (limited assistance). */
export function assistedPassTarget(
  state: MatchState,
  passer: PlayerEntity,
  dirX: number,
  dirY: number,
): { x: number; y: number; type: PassType } {
  const dirLen = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / dirLen;
  const uy = dirY / dirLen;
  let best: { x: number; y: number; d: number; m: PlayerEntity } | null = null;
  for (const m of state.players) {
    if (m.team !== passer.team || m.id === passer.id || m.role === 'goalkeeper') continue;
    const dx = m.x - passer.x;
    const dy = m.y - passer.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const dot = (dx / d) * ux + (dy / d) * uy;
    if (dot < PASSING.assistAlignment) continue;
    // Tactical value: prefer forward (toward attacking goal) and open space.
    const forward = passer.team === 0 ? dx : -dx;
    const oppDist = nearestOpponentDist(state, passer.team, m.x, m.y);
    const score = dot + forward * 0.0008 + oppDist * 0.001 - d * 0.0005;
    if (!best || score > best.d) best = { x: m.x, y: m.y, d: score, m };
  }
  if (best) {
    // LIMITED assistance: nudge the aim toward the teammate by at most maxAssistAngle.
    const targetAng = angleTo(passer.x, passer.y, best.x, best.y);
    const inputAng = Math.atan2(uy, ux);
    const diff = approachAngleDelta(inputAng, targetAng);
    const clamped = Math.max(-PASSING.maxAssistAngle, Math.min(PASSING.maxAssistAngle, diff));
    const finalAng = inputAng + clamped;
    // Through-ball: lead the runner.
    const isThrough = best.d > 0.7 && best.m.vx * Math.cos(targetAng) + best.m.vy * Math.sin(targetAng) > 0;
    const lead = isThrough ? PASSING.throughBallLead : 0;
    const tx = best.x + best.m.vx * lead;
    const ty = best.y + best.m.vy * lead;
    // Blend target with assisted direction.
    const distToTarget = Math.hypot(tx - passer.x, ty - passer.y);
    const fx = passer.x + Math.cos(finalAng) * distToTarget;
    const fy = passer.y + Math.sin(finalAng) * distToTarget;
    return { x: (fx + tx) / 2, y: (fy + ty) / 2, type: isThrough ? 'through' : 'short' };
  }
  return { x: passer.x + ux * m(8), y: passer.y + uy * m(8), type: 'short' };
}

function nearestOpponentDist(state: MatchState, team: Team, x: number, y: number): number {
  let bd = Infinity;
  for (const o of state.players) {
    if (o.team === team) continue;
    bd = Math.min(bd, dist(o.x, o.y, x, y));
  }
  return bd;
}

/** Execute a pass of the given type toward (targetX, targetY). */
export function pass(
  passer: PlayerEntity,
  targetX: number,
  targetY: number,
  state: MatchState,
  type: PassType,
): void {
  const dx = targetX - passer.x;
  const dy = targetY - passer.y;
  const power = mps(BALL.passSpeed[type] ?? BALL.passSpeed.short);
  const vz = type === 'lob' ? mps(BALL.lobZ) : 0;
  kickBall(state.ball, dx, dy, power, vz);
  passer.hasBall = false;
  passer.state = 'pass';
  passer.actionLock = 0.16;
  passer.aimDir = angleTo(passer.x, passer.y, targetX, targetY);
  // Futsal: no offside. (offsideCheck stays null.)
}

// --- Shooting (windup / contact / recovery) -------------------------------

/** Begin a shot. Power scales with charge; accuracy degrades with factors.
 *  Deterministic error via the seeded RNG on MatchState. */
export function shoot(
  shooter: PlayerEntity,
  targetX: number,
  targetY: number,
  charge: number,
  state: MatchState,
  shotType: ShotType = 'normal',
): void {
  const movingSpeed = len(shooter.vx, shooter.vy);
  const pressure = Math.max(0, 1 - nearestOpponentDist(state, shooter.team, shooter.x, shooter.y) / m(2));
  const distToGoal = Math.hypot(targetX - shooter.x, targetY - shooter.y);
  let err: number = SHOOTING.baseError;
  err += SHOOTING.movingError * Math.min(1, movingSpeed / mps(MOVEMENT.runSpeed));
  err += SHOOTING.pressureError * pressure;
  err += SHOOTING.distanceErrorPer10m * (distToGoal / m(10));
  err += SHOOTING.chargeError * charge;
  if (shotType === 'power') err *= 1.3;
  if (shotType === 'placed') err *= 0.6;
  if (shotType === 'firstTime') err *= 1.2;
  const precision = DIFFICULTY_PARAMS[state.difficulty].precision;
  err = Math.max(0, err * (1 - precision));

  let power = BALL.shootMin + charge * (BALL.shootMax - BALL.shootMin);
  if (shotType === 'power') power *= 1.12;
  if (shotType === 'placed') power *= 0.9;
  power = Math.min(BALL.shootMax, power);

  // Deterministic angular error from the seeded RNG.
  const [nextRng, roll] = rngFloat(state.rngState, 0, 1);
  state.rngState = nextRng;
  const baseAng = angleTo(shooter.x, shooter.y, targetX, targetY);
  const finalAng = baseAng + (roll - 0.5) * err * 1.4;
  let vz = 0;
  if (shotType === 'lob') vz = mps(BALL.lobZ);
  else vz = mps(1) + charge * mps(1.2);
  kickBall(state.ball, Math.cos(finalAng), Math.sin(finalAng), mps(power), vz);
  shooter.hasBall = false;
  shooter.state = 'shoot';
  shooter.actionLock = SHOOTING.recoveryTime;
  shooter.shootPhase = SHOOTING.windupTime + SHOOTING.contactTime + SHOOTING.recoveryTime;
  shooter.aimDir = finalAng;
}
