/**
 * Player movement integration, possession, dribbling and tackling.
 * Pure functions operating on PlayerEntity / MatchState — no DOM.
 */
import {
  BALL_HIGH_PASS_SPEED,
  BALL_HIGH_PASS_Z,
  BALL_PASS_SPEED,
  BALL_SHOOT_MAX,
  BALL_SHOOT_MIN,
  CONTROL_RADIUS,
  DRIBBLE_NUDGE,
  PLAYER_ACCEL,
  PLAYER_DECEL,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  SLIDE_COOLDOWN,
  SLIDE_DURATION,
  SLIDE_RECOVER,
  SLIDE_SPEED,
  STUN_DURATION,
  TACKLE_RADIUS,
} from './constants';
import type { InputFrame, MatchState, PlayerEntity } from './types';
import { angleTo, approachAngle, clamp, dist, len } from './math';
import { kickBall } from './ball';

/** Apply a movement input to a player for one fixed step. */
export function applyMovement(
  p: PlayerEntity,
  moveX: number,
  moveY: number,
  sprint: boolean,
  dt: number,
): void {
  if (p.stunnedTime > 0 || p.actionLock > 0) {
    // Decelerate but allow no new input.
    decel(p, dt);
    return;
  }

  if (p.state === 'tackle') {
    // Locked into the slide dash.
    return;
  }

  const mag = len(moveX, moveY);
  const maxSpeed = sprint && p.role !== 'GK' ? PLAYER_SPRINT_SPEED : p.maxSpeed;

  if (mag > 0.01) {
    const nx = moveX / mag;
    const ny = moveY / mag;
    // Accelerate toward desired velocity.
    const desiredVx = nx * maxSpeed;
    const desiredVy = ny * maxSpeed;
    p.vx = approach(p.vx, desiredVx, PLAYER_ACCEL * dt);
    p.vy = approach(p.vy, desiredVy, PLAYER_ACCEL * dt);
    // Realistic turn rate: slower at low speed, sharper when moving.
    const turnRate = 6 + Math.min(6, (Math.hypot(p.vx, p.vy) / maxSpeed) * 6);
    p.facing = approachAngle(p.facing, Math.atan2(ny, nx), turnRate * dt);
    p.state = sprint && p.role !== 'GK' ? 'sprint' : 'run';
  } else {
    decel(p, dt);
    p.state = 'idle';
  }
}

function decel(p: PlayerEntity, dt: number): void {
  p.vx = approach(p.vx, 0, PLAYER_DECEL * dt);
  p.vy = approach(p.vy, 0, PLAYER_DECEL * dt);
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function integratePlayer(p: PlayerEntity, dt: number): void {
  // Slide tackle dash.
  if (p.state === 'tackle' && p.diveTime > 0) {
    p.vx = p.diveDir.x * SLIDE_SPEED;
    p.vy = p.diveDir.y * SLIDE_SPEED;
    p.diveTime -= dt;
    if (p.diveTime <= 0) {
      // End of slide -> brief recovery stun.
      p.state = 'stunned';
      p.stunnedTime = SLIDE_RECOVER;
      p.slideCooldown = SLIDE_COOLDOWN;
      decel(p, dt);
    }
  } else if (p.state === 'goalkeeperDive' && p.diveTime > 0) {
    p.vx = p.diveDir.x * SLIDE_SPEED * 0.85;
    p.vy = p.diveDir.y * SLIDE_SPEED * 0.85;
    p.diveTime -= dt;
    if (p.diveTime <= 0) {
      p.state = 'idle';
      decel(p, dt);
    }
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

  p.animTime += dt;
}

/** Start a slide tackle in the given direction (if off cooldown). */
export function startTackle(p: PlayerEntity, dirX: number, dirY: number): boolean {
  if (p.slideCooldown > 0 || p.stunnedTime > 0 || p.actionLock > 0 || p.role === 'GK') return false;
  const n = len(dirX, dirY) || 1;
  p.diveDir = { x: dirX / n, y: dirY / n };
  p.diveTime = SLIDE_DURATION;
  p.state = 'tackle';
  p.facing = Math.atan2(p.diveDir.y, p.diveDir.x);
  return true;
}

/** Attempt to win the ball from its current owner via a tackle. */
export function tryTackle(
  tackler: PlayerEntity,
  state: MatchState,
): boolean {
  const ball = state.ball;
  // Possession shield blocks opponents from stealing right after a restart.
  if (ball.possessionShield > 0 && ball.shieldTeam != null && ball.shieldTeam !== tackler.team) {
    return false;
  }
  // Tackle can dispossess a nearby owner, or simply steal a loose ball.
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  if (owner && owner.team !== tackler.team && dist(tackler.x, tackler.y, owner.x, owner.y) <= TACKLE_RADIUS) {
    // Goalkeepers in possession cannot be dispossessed by outfield players —
    // they must release the ball (throw / goal kick) themselves.
    if (owner.role === 'GK') return false;
    dispossess(owner, state);
    return true;
  }
  return false;
}

/** Remove the ball from a player and briefly stun them. */
export function dispossess(p: PlayerEntity, state: MatchState): void {
  p.hasBall = false;
  p.stunnedTime = STUN_DURATION;
  p.state = 'stunned';
  state.ball.ownerId = null;
  state.ball.releaseCooldown = 0.25;
}

/** Re-evaluate which player holds the ball (proximity + control radius). */
export function resolvePossession(state: MatchState): void {
  const ball = state.ball;
  if (ball.releaseCooldown > 0) return;
  let best: PlayerEntity | null = null;
  let bestD = CONTROL_RADIUS;
  for (const p of state.players) {
    if (p.stunnedTime > 0) continue;
    if (p.state === 'tackle' || p.state === 'goalkeeperDive') continue;
    // Possession shield: only the protected team may pick up a loose ball.
    if (ball.possessionShield > 0 && ball.shieldTeam != null && p.team !== ball.shieldTeam) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    // GKs can catch a low ball within a slightly larger catch radius.
    const reach = p.role === 'GK' ? CONTROL_RADIUS + 4 : CONTROL_RADIUS;
    if (d <= reach && ball.z <= (p.role === 'GK' ? 26 : 18)) {
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  if (best) {
    if (ball.ownerId !== best.id) {
      // Gain possession.
      ball.ownerId = best.id;
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = 0;
      // Reset the GK hold timer when a goalkeeper collects the ball.
      if (best.role === 'GK') ball.gkHoldTime = 0;
      // An indirect free kick is "played" once any player touches it.
      ball.indirect = false;
    }
    // Update hasBall flags.
    for (const p of state.players) p.hasBall = p.id === best.id;
  } else {
    ball.ownerId = null;
    for (const p of state.players) p.hasBall = false;
  }
}

/** Position the ball just ahead of its owner (dribble stick). */
export function dribble(state: MatchState, dt: number): void {
  const ball = state.ball;
  if (ball.ownerId == null) return;
  const owner = state.players[ball.ownerId];
  if (!owner || owner.stunnedTime > 0) return;
  const ahead = 14;
  const tx = owner.x + Math.cos(owner.facing) * ahead;
  const ty = owner.y + Math.sin(owner.facing) * ahead;
  // Softly move the ball to the dribble point.
  ball.x += (tx - ball.x) * Math.min(1, 14 * dt);
  ball.y += (ty - ball.y) * Math.min(1, 14 * dt);
  ball.z = 0;
  ball.vx = owner.vx;
  ball.vy = owner.vy;
  // A moving dribbler nudges the ball forward a touch.
  const sp = len(owner.vx, owner.vy);
  if (sp > 1) {
    ball.vx += Math.cos(owner.facing) * DRIBBLE_NUDGE * dt;
    ball.vy += Math.sin(owner.facing) * DRIBBLE_NUDGE * dt;
  }
}

/** Pass toward a teammate (or facing dir). highPass adds a lob arc. */
export function pass(
  passer: PlayerEntity,
  targetX: number,
  targetY: number,
  state: MatchState,
  highPass: boolean,
): void {
  const dx = targetX - passer.x;
  const dy = targetY - passer.y;
  const power = highPass ? BALL_HIGH_PASS_SPEED : BALL_PASS_SPEED;
  kickBall(state.ball, dx, dy, power, highPass ? BALL_HIGH_PASS_Z : 0);
  passer.hasBall = false;
  passer.state = 'pass';
  passer.actionLock = 0.18;
  passer.facing = angleTo(passer.x, passer.y, targetX, targetY);
  // Record the offside snapshot at the instant of the pass. A receiver is
  // judged against the positions captured here, not their later position.
  state.offsideCheck = {
    passerTeam: passer.team,
    passerId: passer.id,
    passerX: passer.x,
    positions: state.players.map((p) => ({ id: p.id, team: p.team, x: p.x, y: p.y })),
  };
}

/** Shoot toward a target with charged power [0..1]. */
export function shoot(
  shooter: PlayerEntity,
  targetX: number,
  targetY: number,
  charge: number,
  state: MatchState,
): void {
  const dx = targetX - shooter.x;
  const dy = targetY - shooter.y;
  const power = BALL_SHOOT_MIN + charge * (BALL_SHOOT_MAX - BALL_SHOOT_MIN);
  // Slight lift so low shots can still dip — keeps it readable.
  const vz = 30 + charge * 40;
  kickBall(state.ball, dx, dy, power, vz);
  shooter.hasBall = false;
  shooter.state = 'shoot';
  shooter.actionLock = 0.22;
  shooter.facing = angleTo(shooter.x, shooter.y, targetX, targetY);
}

/** Goalkeeper dive toward a point. */
export function gkDive(gk: PlayerEntity, dirX: number, dirY: number): void {
  const n = len(dirX, dirY) || 1;
  gk.diveDir = { x: dirX / n, y: dirY / n };
  gk.diveTime = 0.3;
  gk.state = 'goalkeeperDive';
  gk.facing = Math.atan2(gk.diveDir.y, gk.diveDir.x);
}

/** Simple circular collision resolution between two players. */
export function resolvePlayerCollision(a: PlayerEntity, b: PlayerEntity): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = len(dx, dy);
  const min = PLAYER_RADIUS * 2;
  if (d > 0 && d < min) {
    const overlap = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
  }
}

export { clamp };
export type { InputFrame };
