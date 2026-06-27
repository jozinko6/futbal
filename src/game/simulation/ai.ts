/**
 * AI state machine for non-human players.
 *
 * Reads ONLY the current match state (never a future state) and re-evaluates
 * decisions on a reaction timer scaled by difficulty. All randomness flows
 * through the seeded RNG on MatchState so the simulation stays deterministic
 * (same inputs -> same outputs on client and server).
 */
import {
  DIFFICULTY_PARAMS,
  FIELD_BOTTOM,
  FIELD_CX,
  FIELD_CY,
  FIELD_RIGHT,
  FIELD_TOP,
  FIELD_X,
  GOAL_BOTTOM,
  GOAL_TOP,
} from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { dist, len } from './math';
import { applyMovement, gkDive, pass, shoot, startTackle, tryTackle } from './player';
import { formationSlot, indexInTeam } from './formation';
import { rngFloat } from './rng';

type DiffParams = typeof DIFFICULTY_PARAMS.normal;

/** Goal a team attacks. */
export function attackingGoalX(team: Team): number {
  return team === 0 ? FIELD_RIGHT : FIELD_X;
}
export function ownGoalX(team: Team): number {
  return team === 0 ? FIELD_X : FIELD_RIGHT;
}

/** Seeded random in [min,max). Advances state.rngState deterministically. */
function rnd(state: MatchState, min: number, max: number): number {
  const [next, v] = rngFloat(state.rngState, min, max);
  state.rngState = next;
  return v;
}

function nearestPlayer(
  state: MatchState,
  team: Team,
  x: number,
  y: number,
  excludeId?: number,
): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== team) continue;
    if (excludeId != null && p.id === excludeId) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function nearestOpponent(state: MatchState, team: Team, x: number, y: number): PlayerEntity | null {
  return nearestPlayer(state, (1 - team) as Team, x, y);
}

function distToNearestOpponent(state: MatchState, team: Team, x: number, y: number): number {
  const o = nearestOpponent(state, team, x, y);
  return o ? dist(o.x, o.y, x, y) : Infinity;
}

function pressured(state: MatchState, team: Team, x: number, y: number, range: number): boolean {
  return distToNearestOpponent(state, team, x, y) < range;
}

function clampX(x: number): number {
  return Math.max(FIELD_X + 12, Math.min(FIELD_RIGHT - 12, x));
}
function clampY(y: number): number {
  return Math.max(FIELD_TOP + 12, Math.min(FIELD_BOTTOM - 12, y));
}

/** Re-evaluate the AI action/target for a player. */
export function aiDecide(state: MatchState, p: PlayerEntity): void {
  const params = DIFFICULTY_PARAMS[state.difficulty];
  const ball = state.ball;
  const team = p.team;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;

  if (p.role === 'GK') {
    decideGK(state, p);
    return;
  }

  if (owner && owner.team === team) {
    if (owner.id === p.id) {
      decideWithBall(state, p, params);
    } else {
      decideSupport(state, p);
    }
    return;
  }

  const myDistToBall = dist(p.x, p.y, ball.x, ball.y);
  const closestMate = nearestPlayer(state, team, ball.x, ball.y);
  const closestMateIsMe = closestMate != null && closestMate.id === p.id;

  if (owner == null) {
    if (closestMateIsMe) {
      p.aiAction = 'receive';
      p.aiTarget = { x: ball.x, y: ball.y };
    } else {
      decideDefensiveShape(state, p, params);
    }
    return;
  }

  if (closestMateIsMe && myDistToBall < 230) {
    p.aiAction = 'press';
    p.aiTarget = { x: ball.x, y: ball.y };
  } else {
    decideDefensiveShape(state, p, params);
  }
}

function decideWithBall(state: MatchState, p: PlayerEntity, params: DiffParams): void {
  const goalX = attackingGoalX(p.team);
  const distToGoal = dist(p.x, p.y, goalX, FIELD_CY);
  const underPressure = pressured(state, p.team, p.x, p.y, 46);

  const inShootingRange = distToGoal < 230;
  const aligned = p.team === 0 ? p.x > FIELD_CX - 60 : p.x < FIELD_CX + 60;
  if (inShootingRange && aligned && rnd(state, 0, 1) < params.precision) {
    p.aiAction = 'shoot';
    return;
  }

  const passChance = underPressure ? params.passRisk + 0.4 : params.passRisk * 0.3;
  if (rnd(state, 0, 1) < passChance) {
    const mate = pickPassTarget(state, p);
    if (mate) {
      p.aiAction = 'pass';
      p.aiTarget = { x: mate.x, y: mate.y };
      return;
    }
  }

  p.aiAction = 'dribble';
  p.aiTarget = { x: goalX, y: FIELD_CY + rnd(state, -60, 60) };
}

function pickPassTarget(state: MatchState, p: PlayerEntity): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bestScore = -Infinity;
  for (const m of state.players) {
    if (m.team !== p.team || m.id === p.id || m.role === 'GK') continue;
    const ahead = p.team === 0 ? m.x - p.x : p.x - m.x;
    const oppDist = distToNearestOpponent(state, p.team, m.x, m.y);
    const score = ahead * 1.2 + oppDist * 1.5 - dist(p.x, p.y, m.x, m.y) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (
    best &&
    (p.team === 0 ? best.x < p.x - 40 : best.x > p.x + 40) &&
    distToNearestOpponent(state, p.team, p.x, p.y) > 60
  ) {
    return null;
  }
  return best;
}

function decideSupport(state: MatchState, p: PlayerEntity): void {
  const ball = state.ball;
  const ahead = p.team === 0 ? 70 : -70;
  const roleOffset =
    p.role === 'FWD' ? ahead * 1.6 : p.role === 'MID' ? ahead : p.role === 'DEF' ? ahead * 0.4 : 0;
  const tx = ball.x + roleOffset;
  const ty = ball.y + (p.id % 2 === 0 ? -70 : 70);
  p.aiAction = 'support';
  p.aiTarget = { x: clampX(tx), y: clampY(ty) };
}

function decideDefensiveShape(state: MatchState, p: PlayerEntity, params: DiffParams): void {
  const ball = state.ball;
  const slot = formationSlot(p.team, indexInTeam(p.id));
  const compress = p.team === 0 ? -40 : 40;
  const tx = slot.x + compress + (ball.x - FIELD_CX) * 0.18;
  const ty = slot.y + (ball.y - FIELD_CY) * 0.4;
  p.aiAction =
    params.aggression > 0.5 && dist(p.x, p.y, ball.x, ball.y) < 160 ? 'press' : 'mark';
  p.aiTarget = { x: clampX(tx), y: clampY(ty) };
}

function decideGK(state: MatchState, p: PlayerEntity): void {
  const ball = state.ball;
  const lineX = ownGoalX(p.team) + (p.team === 0 ? 40 : -40);
  const ty = Math.max(FIELD_CY - 50, Math.min(FIELD_CY + 50, ball.y));
  p.aiAction = 'gkPosition';
  p.aiTarget = { x: lineX, y: ty };

  const goalLineX = ownGoalX(p.team);
  const movingTowardGoal =
    (p.team === 0 && ball.vx < -120) || (p.team === 1 && ball.vx > 120);
  const distToGoal = Math.abs(ball.x - goalLineX);
  if (movingTowardGoal && distToGoal < 180 && ball.z < 22) {
    const t = distToGoal / Math.max(40, Math.abs(ball.vx));
    const py = ball.y + ball.vy * t;
    if (Math.abs(py - p.y) > 26) {
      p.aiAction = 'gkDive';
      p.aiTarget = { x: goalLineX, y: Math.max(GOAL_TOP, Math.min(GOAL_BOTTOM, py)) };
    }
  }

  if (ball.ownerId == null && dist(p.x, p.y, ball.x, ball.y) < 80 && distToGoal < 70) {
    p.aiAction = 'gkCharge';
    p.aiTarget = { x: ball.x, y: ball.y };
  }
}

/** Execute the chosen AI action for one tick (movement + side effects). */
export function aiAct(state: MatchState, p: PlayerEntity, dt: number): void {
  const params = DIFFICULTY_PARAMS[state.difficulty];
  if (p.aiTimer > 0) p.aiTimer -= dt;

  if (p.aiTimer <= 0) {
    aiDecide(state, p);
    p.aiTimer = params.reactionMs / 1000;
  }

  if (p.state === 'tackle' || p.state === 'goalkeeperDive' || p.stunnedTime > 0 || p.actionLock > 0) {
    return;
  }

  const ball = state.ball;
  const action = p.aiAction;
  const tx = p.aiTarget.x;
  const ty = p.aiTarget.y;

  let mx = 0;
  let my = 0;
  let sprint = false;

  switch (action) {
    case 'shoot': {
      const goalX = attackingGoalX(p.team);
      const gy = FIELD_CY + rnd(state, -40, 40) * (1 - params.precision);
      if (p.hasBall) {
        shoot(p, goalX, gy, 0.6 + params.precision * 0.3, state);
      }
      break;
    }
    case 'pass': {
      if (p.hasBall) {
        const high = dist(p.x, p.y, tx, ty) > 280;
        pass(p, tx, ty, state, high);
      }
      break;
    }
    case 'dribble': {
      mx = tx - p.x;
      my = ty - p.y;
      break;
    }
    case 'receive':
    case 'support':
    case 'runToSpace':
    case 'gkCharge': {
      mx = tx - p.x;
      my = ty - p.y;
      sprint = action === 'receive' && dist(p.x, p.y, ball.x, ball.y) > 90;
      break;
    }
    case 'press': {
      mx = ball.x - p.x;
      my = ball.y - p.y;
      const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
      if (owner && owner.team !== p.team && dist(p.x, p.y, owner.x, owner.y) < 26) {
        if (p.slideCooldown <= 0 && rnd(state, 0, 1) < params.aggression * 0.04) {
          startTackle(p, mx, my);
        } else {
          tryTackle(p, state);
        }
      }
      sprint = dist(p.x, p.y, ball.x, ball.y) > 70;
      break;
    }
    case 'mark':
    case 'returnToFormation':
    case 'gkPosition': {
      mx = tx - p.x;
      my = ty - p.y;
      break;
    }
    case 'gkDive': {
      const dx = p.aiTarget.x - p.x;
      const dy = p.aiTarget.y - p.y;
      if (Math.abs(dy) > 20 && p.diveTime <= 0) {
        gkDive(p, Math.sign(dx) || (p.team === 0 ? 1 : -1), Math.sign(dy));
      }
      break;
    }
    case 'idle':
    default:
      break;
  }

  const m = len(mx, my);
  if (m > 0.01) {
    mx /= m;
    my /= m;
  }
  applyMovement(p, mx, my, sprint, dt);
}
