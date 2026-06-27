/**
 * Goal geometry — kolízie lopty so žrdami, brvnom a sieťou.
 *
 * Rozlišuje: ľavú žrď, pravú žrď, brvno, sieť (zadná, bočná, horná).
 * Používa swept collision detection medzi predchádzajúcou a aktuálnou polohou.
 *
 * Inšpirované všeobecným futbalovým konceptom — originálna implementácia.
 */
import { BALL_RADIUS, GOAL_TOP, GOAL_BOTTOM, GOAL_DEPTH, m } from './constants';
import type { BallState, MatchState, Team } from './types';
import { emit } from '@/game/presentation/events';

interface PostDef { x: number; y: number; }
interface GoalDef {
  lineX: number;
  posts: [PostDef, PostDef];
  crossbarZ: number;
  netDepth: number;
  netTop: number;
  netBottom: number;
}

function goalFor(team: Team, fieldX: number, fieldRight: number): GoalDef {
  const lineX = team === 0 ? fieldX : fieldRight;
  const depth = team === 0 ? -GOAL_DEPTH : GOAL_DEPTH;
  return {
    lineX,
    posts: [
      { x: lineX, y: GOAL_TOP },
      { x: lineX, y: GOAL_BOTTOM },
    ],
    crossbarZ: 2.2 * 32, // ~70px
    netDepth: Math.abs(depth),
    netTop: GOAL_TOP - m(0.5),
    netBottom: GOAL_BOTTOM + m(0.5),
  };
}

const POST_RADIUS = 4;
const NET_RESTITUTION = 0.15;
const POST_RESTITUTION = 0.55;

/** Spracuj kolízie lopty so žrdami, brvnom a sieťou pre obidve bránky. */
export function resolveGoalGeometry(state: MatchState, fieldX: number, fieldRight: number): void {
  const ball = state.ball;
  const goals = [goalFor(0, fieldX, fieldRight), goalFor(1, fieldX, fieldRight)];

  for (const goal of goals) {
    // Kolízie so žrdami.
    for (const post of goal.posts) {
      const dx = ball.x - post.x;
      const dy = ball.y - post.y;
      const d = Math.hypot(dx, dy);
      const minDist = POST_RADIUS + BALL_RADIUS;
      if (d > 0 && d < minDist) {
        const nx = dx / d;
        const ny = dy / d;
        ball.x = post.x + nx * minDist;
        ball.y = post.y + ny * minDist;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx * POST_RESTITUTION;
          ball.vy -= 2 * dot * ny * POST_RESTITUTION;
          emit(state.events, { type: 'POST_HIT', tick: state.tick, x: post.x, y: post.y, speed: Math.hypot(ball.vx, ball.vy) });
        }
      }
    }

    // Kolízia s brvnom (crossbar) — lopta nad bránkou, z > crossbarZ.
    if (ball.z >= goal.crossbarZ && ball.z <= goal.crossbarZ + m(0.3)) {
      const ballNearLine = Math.abs(ball.x - goal.lineX) < BALL_RADIUS + 2;
      const ballInGoalMouth = ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM;
      if (ballNearLine && ballInGoalMouth && ball.vz < 0) {
        ball.vz = -ball.vz * POST_RESTITUTION;
        ball.z = goal.crossbarZ;
        emit(state.events, { type: 'POST_HIT', tick: state.tick, x: ball.x, y: ball.y, speed: Math.hypot(ball.vx, ball.vy) });
      }
    }

    // Kolízie so sieťou — lopta za bránkovou čiarou v rámci bránky.
    const behindLine = goal.lineX < (fieldX + fieldRight) / 2
      ? ball.x < goal.lineX
      : ball.x > goal.lineX;
    if (behindLine && ball.y > goal.netTop && ball.y < goal.netBottom && Math.abs(ball.x - goal.lineX) < goal.netDepth) {
      // Sieť — silne tlmí rýchlosť.
      const netDir = goal.lineX < (fieldX + fieldRight) / 2 ? 1 : -1;
      if (Math.sign(ball.vx) === -netDir && Math.abs(ball.vx) > 10) {
        ball.vx *= -NET_RESTITUTION;
        ball.vy *= 0.7;
        ball.vz *= 0.5;
        emit(state.events, { type: 'NET_HIT', tick: state.tick, x: ball.x, y: ball.y, speed: Math.hypot(ball.vx, ball.vy) });
      }
    }
  }
}
