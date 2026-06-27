/**
 * Futsal player physics, possession, dribbling, passing, shooting, defense.
 * All movement uses SI metres-per-second (converted to px/s via mps()).
 * Positions are stored in pixels (renderer-friendly); velocities in px/s.
 */
import {
  MOVEMENT, BALL, DEFENSE, PASSING, SHOOTING, METER_PX, m, mps,
  DIFFICULTY_PARAMS, STAMINA,
  FIELD_CX, FIELD_CY, CONTROL_RADIUS, TACKLE_RADIUS,
} from './constants';
import type {
  AiAction, BallState, FirstTouchResult, InputFrame, MatchState, PassType, PlayerAction, PlayerEntity, ShotType, Team,
} from './types';
import { angleTo, approachAngle, dist, len } from './math';
import { kickBall } from './ball';
import { rngFloat } from './rng';
import { startAction } from './actionSystem';
import { resetContactTrack } from './fouls';
import { setBallOwner, releaseBall, syncHasBall } from './ownership';

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
  // ARCADE stamina: sprint is NEVER blocked, just slightly slower when fatigued.
  const fatigued = p.stamina < STAMINA.fatigueThreshold;
  const fatigueMul = fatigued ? STAMINA.fatigueSpeedMul : 1;

  // --- Response curve: analog magnitude determines speed tier ---
  // < 0.20 = deadzone (no movement)
  // < 0.45 = walk
  // < 0.78 = jog
  // >= 0.78 = run
  // sprint button + full magnitude = sprint
  let targetSpeed = 0;
  if (mag >= 0.20) {
    const movingBackward = isBackward(p, moveX, moveY);
    let baseSpeed: number;
    if (sprint && mag >= 0.78) {
      // Full sprint.
      baseSpeed = hasBall ? MOVEMENT.sprintWithBallSpeed : MOVEMENT.sprintSpeed;
    } else if (mag >= 0.78) {
      baseSpeed = hasBall ? MOVEMENT.runWithBallSpeed : MOVEMENT.runSpeed;
    } else if (mag >= 0.45) {
      baseSpeed = MOVEMENT.jogSpeed;
    } else {
      baseSpeed = MOVEMENT.walkSpeed;
    }
    // Backward is always slower.
    if (movingBackward) baseSpeed = Math.min(baseSpeed, MOVEMENT.backwardSpeed);
    targetSpeed = mps(baseSpeed) * fatigueMul;
  }

  // Action locomotion: slow down during windup/contact/recovery.
  let locomotionMul = 1;
  if (p.currentAction) {
    switch (p.currentAction.phase) {
      case 'windup': locomotionMul = 0.55; break;
      case 'contact': locomotionMul = 0.05; break;
      case 'recovery': locomotionMul = 0.45; break;
    }
  }

  if (mag >= 0.20) {
    const nx = moveX / mag;
    const ny = moveY / mag;
    const desiredVx = nx * targetSpeed * locomotionMul;
    const desiredVy = ny * targetSpeed * locomotionMul;
    const isSprinting = sprint && mag >= 0.78;
    let accelRate = (isSprinting ? MOVEMENT.sprintAcceleration : MOVEMENT.acceleration) * METER_PX;
    if (fatigued) accelRate *= STAMINA.fatigueAccelMul;
    p.vx = approach(p.vx, desiredVx, accelRate * dt);
    p.vy = approach(p.vy, desiredVy, accelRate * dt);

    // Movement direction tracks input instantly.
    p.moveDir = Math.atan2(ny, nx);

    // Body facing turns at a rate depending on ball/sprint.
    const desiredFacing = p.moveDir;
    let turnRate: number = hasBall ? MOVEMENT.turnRateWithBall : MOVEMENT.turnRate;
    if (isSprinting) turnRate = MOVEMENT.turnRateSprint;
    p.facing = approachAngle(p.facing, desiredFacing, turnRate * dt);

    p.state = isSprinting ? 'sprint' : 'run';
  } else {
    decel(p, dt);
    p.state = 'idle';
  }
  p._sprintThisTick = sprint && mag >= 0.78;
  p._movingThisTick = mag >= 0.20;
  p._hasBallThisTick = hasBall;
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

/** Jockey/contain: face the ball, maintain standoff, move slowly.
 *  ONLY sets desired velocity + facing — does NOT integrate position.
 *  integratePlayer() handles position once per tick. */
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
  // NOTE: position is integrated by integratePlayer(), NOT here.
}

export function integratePlayer(p: PlayerEntity, dt: number): void {
  // Stamina: drain on sprint/run, regen on jog/walk/idle.
  if (p._sprintThisTick) {
    const drain = p._hasBallThisTick ? STAMINA.sprintDrainWithBall : STAMINA.sprintDrain;
    p.stamina = Math.max(0, p.stamina - drain * dt);
  } else if (p._movingThisTick) {
    // Running drains a little; jogging (with ball, slow) regens.
    if (p._hasBallThisTick && Math.hypot(p.vx, p.vy) < mps(MOVEMENT.jogSpeed)) {
      p.stamina = Math.min(STAMINA.max, p.stamina + STAMINA.jogRegen * dt);
    } else {
      p.stamina = Math.max(0, p.stamina - STAMINA.runDrain * dt);
    }
  } else {
    p.stamina = Math.min(STAMINA.max, p.stamina + STAMINA.idleRegen * dt);
  }
  // Reset per-tick flags (set again next applyMovement call).
  p._sprintThisTick = false;
  p._movingThisTick = false;
  p._hasBallThisTick = false;
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

/** Re-evaluate which player holds the ball.
 *  CRITICAL: If ball.mode is CONTROLLED, the current owner KEEPS the ball.
 *  Possession is only assigned when the ball is FREE/PASS/SHOT/AERIAL. */
export function resolvePossession(state: MatchState): void {
  const ball = state.ball;
  if (ball.releaseCooldown > 0) return;

  // If already controlled, keep the current owner — do NOT reassign.
  if (ball.mode === 'CONTROLLED' || ball.mode === 'GK_HELD') {
    // If ownerId is null but mode is CONTROLLED, fix the invariant → treat as FREE.
    if (ball.ownerId == null) {
      setBallOwner(state, null, 'FREE');
      // Fall through to the FREE ball logic below.
    } else {
      // Verify the owner is still valid (not stunned).
      const owner = state.players[ball.ownerId];
      if (owner && owner.stunnedTime > 0) {
        releaseBall(state, 'FREE');
        ball.x = owner.x; ball.y = owner.y;
        ball.vx = owner.vx * 0.5; ball.vy = owner.vy * 0.5;
      }
      return;
    }
  }

  // Ball is FREE/PASS/SHOT/AERIAL — find the nearest eligible player.
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
    // First touch: decide controlled vs deflection.
    const result = computeFirstTouch(best, ball, state);
    best.firstTouchQuality = result.quality;
    if (result.controlled) {
      ball.vx = 0; ball.vy = 0; ball.vz = 0;
      ball.touchTimer = 0;
      ball.indirect = false;
      setBallOwner(state, best.id, best.role === 'goalkeeper' ? 'GK_HELD' : 'CONTROLLED');
      if (best.role === 'goalkeeper') ball.gkHoldTime = 0;
    } else {
      // Bad first touch: deflect into free space — ball stays FREE.
      kickBall(ball, result.deflectionVx, result.deflectionVy, Math.hypot(result.deflectionVx, result.deflectionVy), 0);
      releaseBall(state, 'FREE');
      best.stunnedTime = Math.max(best.stunnedTime, 0.15);
    }
  } else {
    // No one controls — ball is FREE.
    if (ball.mode !== 'FREE' && ball.mode !== 'AERIAL') {
      setBallOwner(state, null, ball.z > m(0.5) ? 'AERIAL' : 'FREE');
    }
  }
}

/** Compute the first-touch result for a player meeting an incoming ball.
 *  Quality depends on pass speed, ball height, arrival angle, body direction,
 *  movement, opponent pressure, pass type and stamina. A good touch directs
 *  the ball into the player's movement and slightly slows it; a bad touch
 *  deflects it 0.5–1.8 m into free space. */
function computeFirstTouch(p: PlayerEntity, ball: BallState, state: MatchState): FirstTouchResult {
  const incomingSpeed = len(ball.vx, ball.vy);
  const arrivalAng = angleTo(ball.x, ball.y, p.x, p.y);
  const ang = Math.abs(approachAngleDelta(p.facing, arrivalAng));
  let oppDist = Infinity;
  for (const o of state.players) {
    if (o.team === p.team || o.stunnedTime > 0) continue;
    oppDist = Math.min(oppDist, dist(o.x, o.y, p.x, p.y));
  }
  const pressure = oppDist < m(1.5) ? 1 - oppDist / m(1.5) : 0;
  const speedFactor = Math.min(1, incomingSpeed / mps(BALL.passSpeed.driven));
  const heightFactor = Math.min(1, ball.z / m(1.5));
  const movingAgainst = Math.abs(approachAngleDelta(p.moveDir, arrivalAng + Math.PI)) > Math.PI / 2 ? 0.15 : 0;
  const fatigue = 1 - p.stamina / 100;
  let q = 1
    - 0.25 * speedFactor
    - 0.15 * (ang / Math.PI)
    - 0.25 * pressure
    - 0.20 * heightFactor
    - 0.10 * fatigue
    - movingAgainst;
  q = Math.max(0.15, Math.min(1, q));
  p.firstTouchQuality = q;
  if (q >= 0.5) {
    return { controlled: true, quality: q };
  }
  // Bad touch: deflect into free space, 0.5–1.8 m worth of impulse.
  const away = angleTo(p.x, p.y, ball.x, ball.y);
  // Bias the deflection away from the nearest opponent.
  const opp = nearestOpponent(state, p.team, p.x, p.y);
  let deflAng = away;
  if (opp) {
    const oppAng = angleTo(p.x, p.y, opp.x, opp.y);
    // Deflect opposite to the opponent.
    deflAng = oppAng + Math.PI;
  }
  const dist01 = m(0.5) + (1 - q) * m(1.3); // 0.5..1.8 m worth
  const power = mps(BALL.passSpeed.short) * (0.4 + (1 - q) * 0.5);
  void dist01;
  return {
    controlled: false,
    quality: q,
    deflectionVx: Math.cos(deflAng) * power,
    deflectionVy: Math.sin(deflAng) * power,
  };
}

/**
 * ARCADE DRIBBLING — the ball stays reliably with the player.
 *
 * Uses a foot socket: the ball position is calculated from the player's
 * position + facing, with a forward/lateral offset that alternates feet
 * for visual flavour. The ball does NOT randomly disconnect during normal
 * play — it only becomes FREE on pass/shot/tackle/deflection.
 *
 * At sprint the ball is slightly further ahead (but still controlled).
 * Sharp turns may nudge the ball sideways visually, but ownership is kept.
 */
export function dribble(state: MatchState, dt: number): void {
  const ball = state.ball;
  if (ball.ownerId == null) return;
  if (ball.mode !== 'CONTROLLED') return;
  const owner = state.players[ball.ownerId];
  if (!owner || owner.stunnedTime > 0) return;

  const sp = len(owner.vx, owner.vy);
  const speedRatio = Math.min(1, sp / mps(MOVEMENT.sprintSpeed));

  // Foot socket: ball ahead of player by facing, offset alternates L/R.
  const aheadDist = m(0.3) + speedRatio * m(0.5); // 0.3..0.8 m
  const lateralBase = m(0.15);
  // Dribble phase from animTime — alternates feet every ~0.25s.
  const phase = Math.sin(owner.animTime * 8) > 0 ? 1 : -1;
  const lateral = lateralBase * phase * (sp > 1 ? 1 : 0);

  const cos = Math.cos(owner.facing);
  const sin = Math.sin(owner.facing);
  // Forward + lateral (perpendicular to facing).
  const targetX = owner.x + cos * aheadDist - sin * lateral;
  const targetY = owner.y + sin * aheadDist + cos * lateral;

  // Smoothly move the ball to the foot socket position (fast lerp = sticky).
  const k = Math.min(1, 20 * dt);
  ball.x += (targetX - ball.x) * k;
  ball.y += (targetY - ball.y) * k;
  ball.z = 0;
  ball.vx = owner.vx;
  ball.vy = owner.vy;
  ball.vz = 0;
  // Spin for visual effect.
  ball.spin += sp * dt * 0.08;
}

// --- Tackles & defense -----------------------------------------------------

/** Shoulder challenge — push an adjacent opponent, may knock the ball loose.
 *  Quick action, low recovery. Used when running beside the ball carrier. */
export function shoulderChallenge(p: PlayerEntity, state: MatchState): boolean {
  if (p.stunnedTime > 0 || p.actionLock > 0) return false;
  const ball = state.ball;
  // Find nearest opponent within shoulder range.
  let target: PlayerEntity | null = null;
  let bd = m(1.2);
  for (const o of state.players) {
    if (o.team === p.team || o.stunnedTime > 0) continue;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < bd) { bd = d; target = o; }
  }
  if (!target) return false;
  // Push the opponent away.
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const pushForce = mps(3);
  target.vx += (dx / d) * pushForce;
  target.vy += (dy / d) * pushForce;
  // If the opponent had the ball, there's a chance to knock it loose.
  if (ball.ownerId === target.id && target.role !== 'goalkeeper') {
    // 40% chance to dispossess on shoulder challenge.
    const [nr, roll] = rngFloat(state.rngState, 0, 1);
    state.rngState = nr;
    if (roll < 0.4) {
      dispossess(target, state);
    }
  }
  p.state = 'tackle';
  p.actionLock = 0.15; // very short
  return true;
}

/** Standing tackle — quick, close-range ball steal. Low recovery. */
export function standingTackle(tackler: PlayerEntity, state: MatchState): boolean {
  if (tackler.stunnedTime > 0 || tackler.actionLock > 0) return false;
  const ball = state.ball;
  if (ball.possessionShield > 0 && ball.shieldTeam != null && ball.shieldTeam !== tackler.team) return false;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  if (owner && owner.team !== tackler.team && owner.role !== 'goalkeeper' &&
      dist(tackler.x, tackler.y, owner.x, owner.y) <= m(DEFENSE.tackleRadius)) {
    // 60% chance for standing tackle success.
    const [nr, roll] = rngFloat(state.rngState, 0, 1);
    state.rngState = nr;
    if (roll < 0.6) {
      dispossess(owner, state);
      tackler.state = 'tackle';
      tackler.actionLock = 0.2;
      return true;
    }
  }
  // Also try to poke a loose ball.
  if (ball.ownerId == null && dist(tackler.x, tackler.y, ball.x, ball.y) <= m(DEFENSE.pokeRadius)) {
    pokeTackle(tackler, state);
    return true;
  }
  tackler.state = 'tackle';
  tackler.actionLock = 0.2;
  return false;
}

export function startTackle(p: PlayerEntity, dirX: number, dirY: number): boolean {
  if (p.slideCooldown > 0 || p.stunnedTime > 0 || p.actionLock > 0 || p.role === 'goalkeeper') return false;
  const n = len(dirX, dirY) || 1;
  p.diveDir = { x: dirX / n, y: dirY / n };
  p.diveTime = DEFENSE.slideDuration;
  p.state = 'slide';
  p.facing = Math.atan2(p.diveDir.y, p.diveDir.x);
  resetContactTrack(p);
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
    releaseBall(state, 'FREE');
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
  p.stunnedTime = DEFENSE.stunDuration;
  p.state = 'stunned';
  releaseBall(state, 'FREE');
  state.ball.releaseCooldown = 0.25;
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

/** Begin a phased pass action. The ball is kicked at the contact tick (see
 *  executeActionKick), not immediately. */
export function pass(
  passer: PlayerEntity,
  targetX: number,
  targetY: number,
  state: MatchState,
  type: PassType,
): void {
  const actionType: PlayerAction['type'] =
    type === 'lob' ? 'lobPass' : type === 'through' ? 'throughPass' : type === 'driven' ? 'drivenPass' : 'shortPass';
  const power = mps(BALL.passSpeed[type] ?? BALL.passSpeed.short);
  startAction(passer, state, actionType, targetX, targetY, power);
  passer.aimDir = angleTo(passer.x, passer.y, targetX, targetY);
  releaseBall(state, 'PASS');
}

/** Apply the kick of a pass action at the contact tick. */
export function executePassKick(passer: PlayerEntity, state: MatchState, a: PlayerAction): void {
  const type: PassType =
    a.type === 'lobPass' ? 'lob' : a.type === 'throughPass' ? 'through' : a.type === 'drivenPass' ? 'driven' : 'short';
  const dx = a.aimX - passer.x;
  const dy = a.aimY - passer.y;
  const vz = type === 'lob' ? mps(BALL.lobZ) : 0;
  kickBall(state.ball, dx, dy, a.power, vz);
}

// --- Shooting (windup / contact / recovery) -------------------------------

/** Begin a phased shot action. The ball is kicked at the contact tick (see
 *  executeShotKick), not immediately. Aim (targetX, targetY) is the real
 *  target on the goal line (NOT a 1e6 sentinel). */
export function shoot(
  shooter: PlayerEntity,
  targetX: number,
  targetY: number,
  charge: number,
  state: MatchState,
  shotType: ShotType = 'normal',
): void {
  const actionType: PlayerAction['type'] =
    shotType === 'placed' ? 'placedShot' :
    shotType === 'lob' ? 'lobShot' :
    shotType === 'firstTime' ? 'firstTimeShot' : 'powerShot';
  // Accuracy error is computed at kick time (executeShotKick), so the aim
  // stored here is the player's intended target.
  const power = Math.min(BALL.shootMax, BALL.shootMin + charge * (BALL.shootMax - BALL.shootMin));
  startAction(shooter, state, actionType, targetX, targetY, power);
  releaseBall(state, 'SHOT');
  shooter.aimDir = angleTo(shooter.x, shooter.y, targetX, targetY);
}

/** Apply the kick of a shot action at the contact tick. Accuracy degrades with
 *  movement / pressure / distance / charge. Deterministic error via seeded RNG. */
export function executeShotKick(shooter: PlayerEntity, state: MatchState, a: PlayerAction): void {
  const shotType: ShotType =
    a.type === 'placedShot' ? 'placed' :
    a.type === 'lobShot' ? 'lob' :
    a.type === 'firstTimeShot' ? 'firstTime' : 'power';
  const movingSpeed = len(shooter.vx, shooter.vy);
  const pressure = Math.max(0, 1 - nearestOpponentDist(state, shooter.team, shooter.x, shooter.y) / m(2));
  const distToGoal = Math.hypot(a.aimX - shooter.x, a.aimY - shooter.y);
  let err: number = SHOOTING.baseError;
  err += SHOOTING.movingError * Math.min(1, movingSpeed / mps(MOVEMENT.runSpeed));
  err += SHOOTING.pressureError * pressure;
  err += SHOOTING.distanceErrorPer10m * (distToGoal / m(10));
  // Charge error is non-linear: full charge is NOT automatically best.
  const chargeRatio = (a.power - BALL.shootMin) / (BALL.shootMax - BALL.shootMin);
  err += SHOOTING.chargeError * chargeRatio * 1.4;
  // Stamina (fatigue) worsens accuracy.
  err += (1 - shooter.stamina / 100) * 0.08;
  if (shotType === 'power') err *= 1.3;
  if (shotType === 'placed') err *= 0.6;
  if (shotType === 'firstTime') err *= 1.2;
  const precision = DIFFICULTY_PARAMS[state.difficulty].precision;
  err = Math.max(0, err * (1 - precision));

  const [nextRng, roll] = rngFloat(state.rngState, 0, 1);
  state.rngState = nextRng;
  const baseAng = angleTo(shooter.x, shooter.y, a.aimX, a.aimY);
  const finalAng = baseAng + (roll - 0.5) * err * 1.4;
  let vz = 0;
  if (shotType === 'lob') vz = mps(BALL.lobZ);
  else vz = mps(1) + chargeRatio * mps(1.2);
  kickBall(state.ball, Math.cos(finalAng), Math.sin(finalAng), a.power, vz);
  shooter.aimDir = finalAng;
}
