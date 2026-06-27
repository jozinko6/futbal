/**
 * Main simulation — fixed timestep, deterministic, no DOM.
 *
 * step(state, input, dt) advances the match by one fixed timestep.
 * Pure w.r.t. external state. Uses seeded RNG only.
 */
import {
  FIXED_DT, FIELD_CX, FIELD_CY, FIELD_X, FIELD_RIGHT, FIELD_TOP, FIELD_BOTTOM,
  GOAL_TOP, GOAL_BOTTOM, CROSSBAR_Z, BALL_RADIUS, CONTROL_RADIUS, TACKLE_RADIUS,
  POSSESSION_SHIELD, GK_HOLD_MAX, DEFAULT_HALF_LENGTH, GOAL_CELEBRATION, KICKOFF_DELAY,
  PASS_SPEED, DRIVEN_PASS_SPEED, LOB_SPEED, LOB_Z, SHOT_MIN_SPEED, SHOT_MAX_SPEED,
  SHOOT_CHARGE_TIME, DIFFICULTY, FORMAT_PLAYERS,
  type Difficulty, type MatchFormat,
} from '../core/tuning';
import type {
  MatchState, InputFrame, PlayerState, Team, BallMode, SimulationEvent,
  MatchPhase, PlayerActionType, AftertouchState,
} from '../core/types';
import { createRng, hashSeed, rngFloat } from '../core/rng';
import { buildPlayers, resetToFormation } from './formation';
import { setBallOwner, releaseBall, assertBallState } from './ownership';
import { kickBall, integrateBall } from './ball';
import { applyMovement, integratePlayer, resolvePlayerCollision, dribbleBall } from './player';
import { startAction, stepAction } from './actions';
import { AFTERTOUCH_WINDOWS } from '../core/tuning';
import { dist, angleTo } from '../core/math';

export interface CreateMatchOptions {
  difficulty?: Difficulty;
  halfLength?: number;
  format?: MatchFormat;
  seed?: number | string;
}

export function createMatchState(opts: CreateMatchOptions = {}): MatchState {
  const format = opts.format ?? '5v5';
  const playerCount = FORMAT_PLAYERS[format];
  const difficulty = opts.difficulty ?? 'normal';
  const halfLength = opts.halfLength ?? DEFAULT_HALF_LENGTH;
  const seed = typeof opts.seed === 'number' ? opts.seed : hashSeed(opts.seed ?? `reborn-${Date.now()}`);

  const players = buildPlayers(format);
  const controlledId = playerCount - 1; // FWD of team 0

  const state: MatchState = {
    tick: 0,
    seed,
    rngState: createRng(seed),
    phase: 'KICKOFF',
    clock: { timeMs: 0, half: 1, halfLength },
    score: [0, 0],
    ball: {
      mode: 'RESTART',
      ownerId: null,
      previousOwnerId: null,
      lastTouchPlayerId: null,
      lastTouchTeamId: null,
      x: FIELD_CX, y: FIELD_CY, z: 0,
      prevX: FIELD_CX, prevY: FIELD_CY, prevZ: 0,
      vx: 0, vy: 0, vz: 0, spin: 0,
      ownerSinceTick: 0, releasedAtTick: 0,
      aftertouch: null,
    },
    players,
    teams: [
      { assignment: {}, phase: 'ORGANIZED_DEFENSE', pressingPlayerId: null, coverPlayerId: null },
      { assignment: {}, phase: 'ORGANIZED_DEFENSE', pressingPlayerId: null, coverPlayerId: null },
    ],
    restart: { team: 0 as Team, type: 'kickoff', setupUntilTick: Math.round(KICKOFF_DELAY / FIXED_DT), ballLive: false },
    events: [],
    format,
    difficulty,
    controlledPlayerId: controlledId,
    lastSwitchTick: 0,
    manualLockUntilTick: 0,
    banner: 'VÝKOP',
    bannerTimer: KICKOFF_DELAY,
    debug: false,
  };

  resetToFormation(state);
  setupKickoff(state, 0 as Team);
  return state;
}

function setupKickoff(state: MatchState, team: Team): void {
  state.phase = 'KICKOFF';
  state.banner = 'VÝKOP';
  state.bannerTimer = KICKOFF_DELAY;
  resetToFormation(state);
  state.ball.x = FIELD_CX;
  state.ball.y = FIELD_CY;
  state.ball.vx = 0; state.ball.vy = 0; state.ball.vz = 0; state.ball.z = 0;
  setBallOwner(state, null, 'RESTART');
  state.restart = { team, type: 'kickoff', setupUntilTick: state.tick + Math.round(KICKOFF_DELAY / FIXED_DT), ballLive: false };
}

function emit(state: MatchState, ev: SimulationEvent): void {
  state.events.push(ev);
}

function rnd(state: MatchState, min: number, max: number): number {
  const [next, v] = rngFloat(state.rngState, min, max);
  state.rngState = next;
  return v;
}

// --- Possession ---

function resolvePossession(state: MatchState): void {
  const ball = state.ball;
  if (ball.mode === 'CONTROLLED' || ball.mode === 'GOALKEEPER_HELD') {
    // Owner keeps ball unless stunned.
    if (ball.ownerId != null) {
      const owner = state.players[ball.ownerId];
      if (owner && owner.stunnedUntilTick > state.tick) {
        releaseBall(state, 'FREE');
        ball.x = owner.x; ball.y = owner.y;
        ball.vx = owner.vx * 0.5; ball.vy = owner.vy * 0.5;
      }
    } else {
      // Invariant fix: CONTROLLED but no owner → FREE.
      setBallOwner(state, null, 'FREE');
    }
    return;
  }

  // Ball is FREE/PASS/SHOT/AERIAL — find nearest eligible player.
  let best: PlayerState | null = null;
  let bestD = CONTROL_RADIUS;
  for (const p of state.players) {
    if (p.stunnedUntilTick > state.tick) continue;
    if (p.currentAction && p.currentAction.phase !== 'RECOVERY') continue;
    if (state.restart && !state.restart.ballLive) {
      // Only restart team can pick up during setup.
      if (p.team !== state.restart.team) continue;
    }
    const d = dist(p.x, p.y, ball.x, ball.y);
    const reach = p.role === 'GK' ? CONTROL_RADIUS + 8 : CONTROL_RADIUS;
    if (d <= reach && ball.z <= (p.role === 'GK' ? 36 : 18)) {
      if (d < bestD) { bestD = d; best = p; }
    }
  }

  if (best) {
    ball.vx = 0; ball.vy = 0; ball.vz = 0;
    setBallOwner(state, best.id, best.role === 'GK' ? 'GOALKEEPER_HELD' : 'CONTROLLED');
    // Cancel aftertouch when ball is controlled.
    ball.aftertouch = null;
    emit(state, { type: 'BALL_RECEIVED', tick: state.tick, playerId: best.id });
  }
}

// --- Field events ---

function checkFieldEvents(state: MatchState): void {
  const ball = state.ball;
  const lastTeam = ball.lastTouchTeamId;

  // Side lines — throw-in
  if (ball.y < FIELD_TOP - BALL_RADIUS) {
    const team: Team = lastTeam == null ? 0 : (1 - lastTeam) as Team;
    setupRestart(state, 'throwIn', team, ball.x, FIELD_TOP + 4);
    return;
  }
  if (ball.y > FIELD_BOTTOM + BALL_RADIUS) {
    const team: Team = lastTeam == null ? 0 : (1 - lastTeam) as Team;
    setupRestart(state, 'throwIn', team, ball.x, FIELD_BOTTOM - 4);
    return;
  }

  // Goal lines
  if (ball.x < FIELD_X - BALL_RADIUS) {
    if (ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM && ball.z < CROSSBAR_Z) {
      awardGoal(state, 1 as Team);
      return;
    }
    const team: Team = lastTeam === 1 ? 0 : 1 as Team;
    if (lastTeam === 1) { setupRestart(state, 'goalKick', 0 as Team, FIELD_X + 30, FIELD_CY); }
    else { setupRestart(state, 'corner', 1 as Team, FIELD_X + 4, ball.y < FIELD_CY ? FIELD_TOP + 4 : FIELD_BOTTOM - 4); }
    return;
  }
  if (ball.x > FIELD_RIGHT + BALL_RADIUS) {
    if (ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM && ball.z < CROSSBAR_Z) {
      awardGoal(state, 0 as Team);
      return;
    }
    if (lastTeam === 0) { setupRestart(state, 'goalKick', 1 as Team, FIELD_RIGHT - 30, FIELD_CY); }
    else { setupRestart(state, 'corner', 0 as Team, FIELD_RIGHT - 4, ball.y < FIELD_CY ? FIELD_TOP + 4 : FIELD_BOTTOM - 4); }
    return;
  }
}

function setupRestart(state: MatchState, type: string, team: Team, x: number, y: number): void {
  state.ball.x = x; state.ball.y = y;
  state.ball.vx = 0; state.ball.vy = 0; state.ball.vz = 0; state.ball.z = 0;
  setBallOwner(state, null, 'RESTART');
  state.restart = { team, type, setupUntilTick: state.tick + 60, ballLive: false };
  state.banner = type === 'corner' ? 'ROH' : type === 'goalKick' ? 'KOP OD BRÁNY' : type === 'throwIn' ? 'AUT' : 'KOP';
  state.bannerTimer = 1.0;
}

function awardGoal(state: MatchState, team: Team): void {
  state.score[team]++;
  state.phase = 'GOAL';
  state.banner = 'GÓL!';
  state.bannerTimer = GOAL_CELEBRATION;
  setBallOwner(state, null, 'OUT_OF_PLAY');
  emit(state, { type: 'GOAL_SCORED', tick: state.tick, team });
  emit(state, { type: 'NET_HIT', tick: state.tick, x: state.ball.x, y: state.ball.y });
}

// --- Goal posts ---

function resolveGoalPosts(state: MatchState): void {
  const ball = state.ball;
  const posts = [
    { x: FIELD_X, y: GOAL_TOP }, { x: FIELD_X, y: GOAL_BOTTOM },
    { x: FIELD_RIGHT, y: GOAL_TOP }, { x: FIELD_RIGHT, y: GOAL_BOTTOM },
  ];
  for (const post of posts) {
    const dx = ball.x - post.x;
    const dy = ball.y - post.y;
    const d = Math.hypot(dx, dy);
    const min = 4 + BALL_RADIUS;
    if (d > 0 && d < min) {
      const nx = dx / d, ny = dy / d;
      ball.x = post.x + nx * min;
      ball.y = post.y + ny * min;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx * 0.55;
        ball.vy -= 2 * dot * ny * 0.55;
        emit(state, { type: 'POST_HIT', tick: state.tick, x: post.x, y: post.y });
      }
    }
  }
}

// --- Human input application ---

function applyHumanInput(state: MatchState, input: InputFrame, dt: number): void {
  const p = state.players[state.controlledPlayerId];
  if (!p) return;
  const c = input.continuous;
  const e = input.edges;

  // Switch player
  if (e.switchPressed && state.tick > state.manualLockUntilTick) {
    switchToNext(state);
    state.lastSwitchTick = state.tick;
    state.manualLockUntilTick = state.tick + 48; // 0.8s
  }

  const cur = state.players[state.controlledPlayerId];
  const hasBall = state.ball.ownerId === cur.id;
  applyMovement(cur, c, hasBall, dt);

  // Action button
  if (e.actionPressed && hasBall && !cur.currentAction) {
    // Determine: pass or shoot based on context.
    const goalX = cur.team === 0 ? FIELD_RIGHT : FIELD_X;
    const distToGoal = Math.abs(cur.x - goalX);
    const facingGoal = cur.team === 0 ? Math.cos(cur.facing) > 0.3 : Math.cos(cur.facing) < -0.3;

    if (distToGoal < 250 && facingGoal) {
      // Shoot
      const charge = 0.5; // Quick shot
      const targetY = FIELD_CY + (c.aimY || (Math.sin(cur.facing) > 0 ? -20 : 20));
      startAction(cur, state, 'NORMAL_SHOT', goalX, targetY, SHOT_MIN_SPEED + charge * (SHOT_MAX_SPEED - SHOT_MIN_SPEED));
      emit(state, { type: 'ACTION_STARTED', tick: state.tick, playerId: cur.id, actionType: 'NORMAL_SHOT' });
    } else {
      // Pass
      const dirX = c.moveX || Math.cos(cur.facing);
      const dirY = c.moveY || Math.sin(cur.facing);
      const tgt = assistedPassTarget(state, cur, dirX, dirY);
      const isLob = c.modifierHeld;
      const type: PlayerActionType = isLob ? 'LOB_PASS' : 'SHORT_PASS';
      startAction(cur, state, type, tgt.x, tgt.y, isLob ? LOB_SPEED : PASS_SPEED);
      emit(state, { type: 'ACTION_STARTED', tick: state.tick, playerId: cur.id, actionType: type });
    }
  }

  // Action released — for charge shots (future)
  // Tackle button
  if (e.tacklePressed && !hasBall && !cur.currentAction) {
    const dirX = c.moveX || Math.cos(cur.facing);
    const dirY = c.moveY || Math.sin(cur.facing);
    startAction(cur, state, 'SLIDE_TACKLE', cur.x + dirX * 100, cur.y + dirY * 100, 0);
    cur.slideCooldown = 0.8;
    emit(state, { type: 'ACTION_STARTED', tick: state.tick, playerId: cur.id, actionType: 'SLIDE_TACKLE' });
  }
}

function assistedPassTarget(state: MatchState, passer: PlayerState, dirX: number, dirY: number): { x: number; y: number } {
  let best: { x: number; y: number; score: number } | null = null;
  const ux = dirX / (Math.hypot(dirX, dirY) || 1);
  const uy = dirY / (Math.hypot(dirX, dirY) || 1);
  for (const m of state.players) {
    if (m.team !== passer.team || m.id === passer.id || m.role === 'GK') continue;
    const dx = m.x - passer.x;
    const dy = m.y - passer.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const dot = (dx / d) * ux + (dy / d) * uy;
    if (dot < 0.35) continue;
    const forward = passer.team === 0 ? dx : -dx;
    const score = dot + forward * 0.001;
    if (!best || score > best.score) best = { x: m.x, y: m.y, score };
  }
  if (best) return { x: best.x, y: best.y };
  return { x: passer.x + ux * 200, y: passer.y + uy * 200 };
}

function switchToNext(state: MatchState): void {
  const outfielders = state.players.filter((p) => p.team === 0 && p.role !== 'GK').map((p) => p.id);
  const idx = outfielders.indexOf(state.controlledPlayerId);
  state.controlledPlayerId = outfielders[(idx + 1) % outfielders.length] ?? state.controlledPlayerId;
}

// --- Match flow ---

function advanceMatchFlow(state: MatchState, dt: number): void {
  if (state.bannerTimer > 0) {
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.bannerTimer === 0) state.banner = '';
  }

  switch (state.phase) {
    case 'KICKOFF':
      if (state.tick >= (state.restart?.setupUntilTick ?? 0)) {
        state.phase = 'PLAYING';
        state.restart = null;
      }
      break;
    case 'PLAYING':
      state.clock.timeMs += dt;
      if (state.clock.half === 1 && state.clock.timeMs >= state.clock.halfLength) {
        state.phase = 'HALFTIME';
        state.banner = 'POLČAS';
        state.bannerTimer = 3;
      } else if (state.clock.half === 2 && state.clock.timeMs >= state.clock.halfLength) {
        state.phase = 'FULLTIME';
        state.banner = 'KONIEC';
        state.bannerTimer = 999;
      }
      break;
    case 'GOAL':
      if (state.bannerTimer <= 0) {
        const conceding: Team = state.score[0] > state.score[1] ? 1 as Team : 0 as Team;
        if (state.clock.half === 2 && state.clock.timeMs >= state.clock.halfLength) {
          state.phase = 'FULLTIME';
        } else {
          setupKickoff(state, conceding);
        }
      }
      break;
    case 'HALFTIME':
      if (state.bannerTimer <= 0) {
        state.clock.half = 2;
        state.clock.timeMs = 0;
        setupKickoff(state, 1 as Team);
      }
      break;
    case 'FULLTIME':
      break;
  }
}

// --- Step ---

export function step(state: MatchState, input: InputFrame, dt: number): MatchState {
  state.tick++;

  const gameplayActive = state.phase === 'PLAYING' || state.phase === 'KICKOFF';

  if (gameplayActive) {
    // 1. Human input
    applyHumanInput(state, input, dt);

    // 2. AI (stub — will be expanded)
    for (const p of state.players) {
      if (p.id === state.controlledPlayerId) continue;
      // Simple AI: chase ball or hold position
      simpleAI(state, p, dt);
    }

    // 3. Integrate players + step actions
    for (const p of state.players) {
      integratePlayer(p, dt, state.tick);
      const ar = stepAction(p, state);
      if (ar) {
        // Contact tick — apply kick/tackle
        executeContact(state, p, ar);
      }
    }

    // 4. Collisions
    for (let i = 0; i < state.players.length; i++) {
      for (let j = i + 1; j < state.players.length; j++) {
        resolvePlayerCollision(state.players[i], state.players[j]);
      }
    }

    // 5. Ball
    if (state.ball.ownerId != null) {
      dribbleBall(state, dt);
    } else {
      integrateBall(state.ball, dt, state.ball.aftertouch, state.tick);
    }

    // 6. Possession
    resolvePossession(state);

    // 7. Goal posts
    resolveGoalPosts(state);

    // 8. Track last touch
    if (state.ball.ownerId != null) {
      state.ball.lastTouchPlayerId = state.ball.ownerId;
      const p = state.players[state.ball.ownerId];
      state.ball.lastTouchTeamId = p ? p.team : null;
    }

    // 9. Field events
    checkFieldEvents(state);

    // 10. Assert invariants (dev mode)
    if (state.debug) {
      const err = assertBallState(state);
      if (err) console.error(err);
    }
  }

  // 11. Match flow
  advanceMatchFlow(state, dt);

  return state;
}

function executeContact(state: MatchState, p: PlayerState, action: { type: PlayerActionType; targetX: number; targetY: number; power: number }): void {
  const ball = state.ball;
  switch (action.type) {
    case 'SHORT_PASS':
    case 'DRIVEN_PASS':
    case 'THROUGH_PASS':
    case 'CROSS': {
      const dx = action.targetX - p.x;
      const dy = action.targetY - p.y;
      kickBall(ball, dx, dy, action.power, 0);
      releaseBall(state, 'PASS');
      ball.aftertouch = createAftertouch(state, p.id, action.type);
      emit(state, { type: 'BALL_KICKED', tick: state.tick, playerId: p.id, kickType: action.type, normalizedIntensity: action.power / 600 });
      break;
    }
    case 'LOB_PASS': {
      const dx = action.targetX - p.x;
      const dy = action.targetY - p.y;
      kickBall(ball, dx, dy, action.power, LOB_Z);
      releaseBall(state, 'AERIAL');
      ball.aftertouch = createAftertouch(state, p.id, 'LOB_PASS');
      emit(state, { type: 'BALL_KICKED', tick: state.tick, playerId: p.id, kickType: 'LOB_PASS', normalizedIntensity: action.power / 600 });
      break;
    }
    case 'NORMAL_SHOT':
    case 'POWER_SHOT':
    case 'CHIP_SHOT':
    case 'SUPER_SHOT': {
      const dx = action.targetX - p.x;
      const dy = action.targetY - p.y;
      const vz = action.type === 'CHIP_SHOT' ? LOB_Z : 30 + (action.power / SHOT_MAX_SPEED) * 40;
      kickBall(ball, dx, dy, action.power, vz);
      releaseBall(state, 'SHOT');
      ball.aftertouch = createAftertouch(state, p.id, action.type);
      emit(state, { type: 'BALL_KICKED', tick: state.tick, playerId: p.id, kickType: action.type, normalizedIntensity: action.power / 600 });
      break;
    }
    case 'SLIDE_TACKLE': {
      // Check for ball contact
      if (dist(p.x, p.y, ball.x, ball.y) <= TACKLE_RADIUS + BALL_RADIUS) {
        if (ball.ownerId != null && ball.ownerId !== p.id) {
          const owner = state.players[ball.ownerId];
          if (owner && owner.team !== p.team && owner.role !== 'GK') {
            releaseBall(state, 'FREE');
            owner.stunnedUntilTick = state.tick + 36;
            emit(state, { type: 'TACKLE_CONTACT', tick: state.tick, clean: true });
          }
        } else if (ball.ownerId == null) {
          // Poke loose ball
          const dir = angleTo(p.x, p.y, ball.x, ball.y);
          kickBall(ball, Math.cos(dir), Math.sin(dir), PASS_SPEED * 0.6, 0);
          emit(state, { type: 'TACKLE_CONTACT', tick: state.tick, clean: true });
        }
      }
      break;
    }
    case 'STANDING_TACKLE':
    case 'POKE_TACKLE':
    case 'SHOULDER_CHARGE': {
      if (dist(p.x, p.y, ball.x, ball.y) <= TACKLE_RADIUS) {
        if (ball.ownerId != null && ball.ownerId !== p.id) {
          const owner = state.players[ball.ownerId];
          if (owner && owner.team !== p.team && owner.role !== 'GK') {
            releaseBall(state, 'FREE');
            owner.stunnedUntilTick = state.tick + 24;
            emit(state, { type: 'TACKLE_CONTACT', tick: state.tick, clean: true });
          }
        }
      }
      break;
    }
  }
}

function createAftertouch(state: MatchState, playerId: number, kickType: string): AftertouchState {
  const ticks = AFTERTOUCH_WINDOWS[kickType] ?? 8;
  const influence = kickType.includes('SHOT') ? 0.5 : kickType.includes('SUPER') ? 0.8 : 0.2;
  return {
    sourcePlayerId: playerId,
    startedTick: state.tick,
    expiresTick: state.tick + ticks,
    lateralInput: 0,
    verticalInput: 0,
    influence,
  };
}

// --- Simple AI (will be expanded) ---

function simpleAI(state: MatchState, p: PlayerState, dt: number): void {
  const ball = state.ball;
  const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
  const weHaveBall = owner != null && owner.team === p.team;

  if (p.role === 'GK') {
    // Goalkeeper: stay near own goal
    const ownGoalX = p.team === 0 ? FIELD_X + 20 : FIELD_RIGHT - 20;
    p.aiTargetX = ownGoalX;
    p.aiTargetY = Math.max(GOAL_TOP, Math.min(GOAL_BOTTOM, ball.y));
    moveToward(p, p.aiTargetX, p.aiTargetY, dt, false);
    return;
  }

  if (owner && owner.id === p.id) {
    // Has ball — dribble toward goal
    const goalX = p.team === 0 ? FIELD_RIGHT : FIELD_X;
    p.aiTargetX = goalX;
    p.aiTargetY = FIELD_CY + rnd(state, -30, 30);
    moveToward(p, p.aiTargetX, p.aiTargetY, dt, false);

    // Occasionally pass or shoot
    if (p.aiTimer <= 0) {
      const distToGoal = Math.abs(p.x - goalX);
      const params = DIFFICULTY[state.difficulty];
      if (distToGoal < 200 && rnd(state, 0, 1) < params.precision) {
        const targetY = FIELD_CY + rnd(state, -30, 30);
        startAction(p, state, 'NORMAL_SHOT', goalX, targetY, SHOT_MIN_SPEED + 0.5 * (SHOT_MAX_SPEED - SHOT_MIN_SPEED));
      } else if (rnd(state, 0, 1) < params.passRisk) {
        // Find teammate
        let mate: PlayerState | null = null;
        for (const m of state.players) {
          if (m.team === p.team && m.id !== p.id && m.role !== 'GK') { mate = m; break; }
        }
        if (mate) {
          startAction(p, state, 'SHORT_PASS', mate.x, mate.y, PASS_SPEED);
        }
      }
      p.aiTimer = DIFFICULTY[state.difficulty].reactionMs / 1000;
    }
    p.aiTimer -= dt;
    return;
  }

  if (owner && owner.team === p.team) {
    // Teammate has ball — support
    const ahead = p.team === 0 ? 60 : -60;
    p.aiTargetX = ball.x + ahead;
    p.aiTargetY = ball.y + (p.id % 2 === 0 ? -50 : 50);
    moveToward(p, p.aiTargetX, p.aiTargetY, dt, false);
    return;
  }

  // Defending or loose ball
  const myDist = dist(p.x, p.y, ball.x, ball.y);
  // Is anyone on my team closer?
  let closest = true;
  for (const m of state.players) {
    if (m.team !== p.team || m.id === p.id || m.role === 'GK') continue;
    if (dist(m.x, m.y, ball.x, ball.y) < myDist) { closest = false; break; }
  }

  if (closest && myDist < 200) {
    // Chase ball
    p.aiTargetX = ball.x;
    p.aiTargetY = ball.y;
    moveToward(p, p.aiTargetX, p.aiTargetY, dt, myDist > 100);
  } else {
    // Hold formation
    p.aiTargetX = p.baseX + (ball.x - FIELD_CX) * 0.2;
    p.aiTargetY = p.baseY + (ball.y - FIELD_CY) * 0.3;
    moveToward(p, p.aiTargetX, p.aiTargetY, dt, false);
  }
}

function moveToward(p: PlayerState, tx: number, ty: number, dt: number, sprint: boolean): void {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) {
    p.vx *= 0.8; p.vy *= 0.8;
    p.movementMode = 'IDLE';
    return;
  }
  const nx = dx / d;
  const ny = dy / d;
  const input = {
    moveX: nx, moveY: ny, aimX: 0, aimY: 0,
    sprintHeld: sprint, actionHeld: false, modifierHeld: false,
  };
  applyMovement(p, input, false, dt);
}
