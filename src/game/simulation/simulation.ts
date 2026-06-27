/**
 * Kačanovská FIFA — deterministic simulation entry point.
 *
 * `step(state, input, dt)` advances the match by one fixed timestep. It is
 * pure with respect to external state (no DOM/Canvas) and uses a seeded RNG,
 * so the same (state, input, dt) sequence reproduces identically on the
 * client and on an authoritative server.
 *
 * The match supports one or more `HumanController` slots. Solo vs AI uses a
 * single controller (team 0 by default); local 2-player adds a second
 * controller for the away team. Every player not owned by a controller is
 * driven by the AI state machine.
 */
import {
  DEFAULT_HALF_LENGTH,
  DIFFICULTY_PARAMS,
  FIELD_CX,
  FIELD_CY,
  FIXED_DT,
  GK_HOLD_MAX,
  GOAL_BOTTOM,
  GOAL_TOP,
  HALF_LENGTH_OPTIONS,
  PENALTY_SHOOTOUT_KICKS,
  PENALTY_SPOT_X,
  PLAYERS_PER_TEAM,
  PLAYER_RADIUS,
  SHOOT_CHARGE_TIME,
  type Difficulty,
} from './constants';
import type { HumanController, InputFrame, MatchState, PlayerEntity, Team } from './types';
import { hashSeed, rngCreate, rngFloat } from './rng';
import { buildPlayers, resetToFormation, teamOf } from './formation';
import { setupKickoff, setupRestart, awardGoal, awardFoul, awardOffside, checkFieldEvents, isReceiverOffside, resolveGoalPosts } from './rules';
import { applyMovement, dribble, integratePlayer, resolvePlayerCollision, resolvePossession, shoot, pass, startTackle, tryTackle } from './player';
import { integrateBall } from './ball';
import { aiAct } from './ai';
import { dist } from './math';

export interface CreateMatchOptions {
  difficulty?: Difficulty;
  halfLength?: number;
  /** Which team the (first) human controls. */
  humanTeam?: Team;
  /** Number of human controllers (1 = solo vs AI, 2 = local multiplayer). */
  humanPlayers?: 1 | 2;
  seed?: number | string;
  autoSwitch?: boolean;
}

function makeController(team: Team, activeId: number, autoSwitch: boolean): HumanController {
  return {
    team,
    activeId,
    chargeTime: 0,
    prevShootHeld: false,
    prevPass: false,
    prevHighPass: false,
    prevSwitch: false,
    autoSwitch,
  };
}

export function createMatchState(opts: CreateMatchOptions = {}): MatchState {
  const halfLength = opts.halfLength ?? DEFAULT_HALF_LENGTH;
  const difficulty = opts.difficulty ?? 'normal';
  const humanTeam: Team = opts.humanTeam ?? 0;
  const humanPlayers = opts.humanPlayers ?? 1;
  const autoSwitch = opts.autoSwitch ?? true;
  const seedNum =
    typeof opts.seed === 'number' ? opts.seed : hashSeed(opts.seed ?? `rfa-${Date.now()}`);

  const controllers: HumanController[] = [
    makeController(humanTeam, humanTeam === 0 ? 4 : 9, autoSwitch),
  ];
  if (humanPlayers === 2) {
    const otherTeam: Team = (1 - humanTeam) as Team;
    controllers.push(makeController(otherTeam, otherTeam === 0 ? 4 : 9, autoSwitch));
  }

  const state: MatchState = {
    timeMs: 0,
    half: 1,
    period: 'kickoff',
    score: [0, 0],
    ball: {
      x: FIELD_CX,
      y: FIELD_CY,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      ownerId: null,
      releaseCooldown: 0,
      possessionShield: 0,
      shieldTeam: null,
      gkHoldTime: 0,
      indirect: false,
    },
    players: buildPlayers(),
    controllers,
    restartTeam: 0,
    restartType: 'kickoff',
    restartTimer: 0,
    lastTouchTeam: null,
    nextRestartTeam: 0,
    nextRestartType: null,
    rngState: rngCreate(seedNum),
    difficulty,
    halfLength,
    tick: 0,
    lastGoalTeam: null,
    banner: 'VÝKOP',
    bannerTimer: 1.2,
    offsideCheck: null,
    offsides: [0, 0],
    shootout: null,
  };
  resetToFormation(state.players);
  setupKickoff(state, 0 as Team);
  return state;
}

export function setDifficulty(state: MatchState, d: Difficulty): void {
  state.difficulty = d;
}

// --- Penalty shootout -------------------------------------------------------

/** Begin a penalty shootout after a tied match. */
function startShootout(state: MatchState): void {
  state.period = 'penalties';
  state.shootout = {
    kicksTaken: [0, 0],
    kicksScored: [0, 0],
    nextKicker: 0 as Team,
    suddenDeath: false,
    kickerIndex: [0, 0],
  };
  state.banner = 'PENALTY ROZSTRELY';
  state.bannerTimer = 2.5;
  state.restartTimer = 2.5;
  // Reset players to their own halves so the pitch is clear for kicks.
  resetToFormation(state.players);
}

/**
 * Resolve one penalty kick deterministically (the AI taker shoots; the keeper
 * dives). Goal probability depends on difficulty. Advances the shootout until
 * a winner is decided, then sets period = 'fulltime'.
 */
function advanceShootout(state: MatchState): void {
  const sh = state.shootout;
  if (!sh) {
    state.period = 'fulltime';
    return;
  }
  const team = sh.nextKicker;
  const opp: Team = (1 - team) as Team;
  // Goal probability ~ 70-85% depending on difficulty.
  const p = state.difficulty === 'hard' ? 0.85 : state.difficulty === 'normal' ? 0.75 : 0.68;
  const [nextRng, roll] = rngFloat(state.rngState, 0, 1);
  state.rngState = nextRng;
  const scored = roll < p;
  if (scored) state.score[team]++;
  sh.kicksTaken[team]++;
  sh.kickerIndex[team] = (sh.kickerIndex[team] + 1) % 4; // rotate outfield takers

  // Decide winner.
  const [a, b] = state.score;
  const ka = sh.kicksTaken[0];
  const kb = sh.kicksTaken[1];
  const done = decideShootoutWinner(a, b, ka, kb, sh.suddenDeath);
  if (done) {
    state.period = 'fulltime';
    state.banner = 'KONIEC';
    state.bannerTimer = 999;
    state.shootout = null;
    return;
  }
  // Switch kicker. Enter sudden death after PENALTY_SHOOTOUT_KICKS each.
  sh.nextKicker = opp;
  if (ka >= PENALTY_SHOOTOUT_KICKS && kb >= PENALTY_SHOOTOUT_KICKS) {
    sh.suddenDeath = true;
  }
  state.banner = scored ? 'GÓL!' : 'MINUL!';
  state.bannerTimer = 1.4;
  state.restartTimer = 1.6;
}

/** True if the shootout has produced a winner under standard rules. */
function decideShootoutWinner(
  a: number,
  b: number,
  ka: number,
  kb: number,
  suddenDeath: boolean,
): boolean {
  if (!suddenDeath) {
    // Best-of-N: a team wins early if the other can't catch up.
    if (ka < PENALTY_SHOOTOUT_KICKS && a > b + (PENALTY_SHOOTOUT_KICKS - kb)) return true;
    if (kb < PENALTY_SHOOTOUT_KICKS && b > a + (PENALTY_SHOOTOUT_KICKS - ka)) return true;
    if (ka >= PENALTY_SHOOTOUT_KICKS && kb >= PENALTY_SHOOTOUT_KICKS) {
      // After N kicks each, go to sudden death if tied.
      return a !== b;
    }
    return false;
  }
  // Sudden death: both have taken equal kicks; one leads.
  if (ka === kb && a !== b) return true;
  return false;
}

/** Ids of all human-controlled players this tick. */
export function getActiveIds(state: MatchState): Set<number> {
  return new Set(state.controllers.map((c) => c.activeId));
}

/** Primary (first) human's active player id — convenience for HUD/camera. */
export function getActivePlayerId(state: MatchState): number {
  return state.controllers[0]?.activeId ?? 0;
}

/** Reset controller states after a goal / restart (keeps active ids). */
export function resetControllers(state: MatchState): void {
  for (const c of state.controllers) {
    c.chargeTime = 0;
    c.prevShootHeld = false;
    c.prevPass = false;
    c.prevHighPass = false;
    c.prevSwitch = false;
  }
}

function switchToNearest(state: MatchState, c: HumanController): void {
  const ball = state.ball;
  let best = c.activeId;
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== c.team || p.id === c.activeId || p.role === 'GK') continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    if (d < bd) {
      bd = d;
      best = p.id;
    }
  }
  c.activeId = best;
}

function switchToNext(state: MatchState, c: HumanController): void {
  const ids = state.players.filter((p) => p.team === c.team && p.role !== 'GK').map((p) => p.id);
  const idx = ids.indexOf(c.activeId);
  c.activeId = ids[(idx + 1) % ids.length] ?? c.activeId;
}

/** Pick the best teammate to pass to in the given facing direction. */
function assistedPassTarget(
  state: MatchState,
  passer: PlayerEntityLike,
  dirX: number,
  dirY: number,
): { x: number; y: number } {
  let best: { x: number; y: number; d: number } | null = null;
  const dirLen = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / dirLen;
  const uy = dirY / dirLen;
  for (const m of state.players) {
    if (m.team !== passer.team || m.id === passer.id || m.role === 'GK') continue;
    const dx = m.x - passer.x;
    const dy = m.y - passer.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const dot = (dx / d) * ux + (dy / d) * uy;
    if (dot < 0.35) continue;
    if (!best || dot > best.d) best = { x: m.x, y: m.y, d: dot };
  }
  if (best) return { x: best.x, y: best.y };
  return { x: passer.x + ux * 220, y: passer.y + uy * 220 };
}

interface PlayerEntityLike {
  id: number;
  team: Team;
  x: number;
  y: number;
  facing: number;
}

/** Apply one human's input frame to their active player for one step. */
function applyController(state: MatchState, c: HumanController, input: InputFrame, dt: number): void {
  const active = state.players[c.activeId];
  if (!active) return;

  // --- Player switching ---
  const switchPressed = input.switchPlayer && !c.prevSwitch;
  if (switchPressed) {
    switchToNext(state, c);
  } else if (autoSwitchShouldTrigger(state, c)) {
    switchToNearest(state, c);
  }
  c.prevSwitch = input.switchPlayer;

  const cur = state.players[c.activeId] ?? active;

  // --- Movement ---
  applyMovement(cur, input.moveX, input.moveY, input.sprint, dt);

  // --- Passing ---
  const passPressed = input.pass && !c.prevPass;
  c.prevPass = input.pass;
  const highPressed = input.highPass && !c.prevHighPass;
  c.prevHighPass = input.highPass;

  if (cur.hasBall && (passPressed || highPressed)) {
    const dirX = input.moveX || Math.cos(cur.facing);
    const dirY = input.moveY || Math.sin(cur.facing);
    const tgt = assistedPassTarget(state, cur, dirX, dirY);
    pass(cur, tgt.x, tgt.y, state, highPressed);
    c.chargeTime = 0;
  }

  // --- Shooting / tackling (K button = shootHeld) ---
  const shootReleased = c.prevShootHeld && !input.shootHeld;
  const shootPressed = !c.prevShootHeld && input.shootHeld;

  if (cur.hasBall) {
    if (input.shootHeld) {
      c.chargeTime = Math.min(SHOOT_CHARGE_TIME, c.chargeTime + dt);
    }
    if (shootReleased) {
      const charge = c.chargeTime / SHOOT_CHARGE_TIME;
      const goalX = cur.team === 0 ? 1e6 : -1e6;
      const targetY = FIELD_CY + input.moveY * 70;
      shoot(cur, goalX, targetY, charge, state);
      c.chargeTime = 0;
    }
  } else {
    if (shootPressed) {
      const dirX = input.moveX || Math.cos(cur.facing);
      const dirY = input.moveY || Math.sin(cur.facing);
      if (!startTackle(cur, dirX, dirY)) {
        tryTackle(cur, state);
      }
    }
    c.chargeTime = 0;
  }
  c.prevShootHeld = input.shootHeld;
}

function autoSwitchShouldTrigger(state: MatchState, c: HumanController): boolean {
  if (!c.autoSwitch) return false;
  const cur = state.players[c.activeId];
  if (!cur || cur.hasBall) return false;
  const ball = state.ball;
  let bd = dist(cur.x, cur.y, ball.x, ball.y);
  let switched = false;
  for (const p of state.players) {
    if (p.team !== c.team || p.role === 'GK' || p.id === c.activeId) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    if (d < bd) bd = d;
  }
  const curD = dist(cur.x, cur.y, ball.x, ball.y);
  if (curD - bd > 90) switched = true;
  return switched;
}

/** Advance match clock & handle period transitions. */
function advanceMatchFlow(state: MatchState, dt: number): void {
  if (state.bannerTimer > 0) {
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.bannerTimer === 0) state.banner = '';
  }

  switch (state.period) {
    case 'kickoff':
      state.restartTimer = Math.max(0, state.restartTimer - dt);
      if (state.restartTimer <= 0) state.period = 'play';
      break;
    case 'play':
      state.timeMs += dt;
      if (state.half === 1 && state.timeMs >= state.halfLength) {
        state.period = 'halftime';
        state.restartTimer = 3;
        state.banner = 'POLČAS';
        state.bannerTimer = 3;
      } else if (state.half === 2 && state.timeMs >= state.halfLength) {
        if (state.score[0] === state.score[1]) {
          // Tied at fulltime -> penalty shootout.
          startShootout(state);
        } else {
          state.period = 'fulltime';
          state.banner = 'KONIEC ZÁPASU';
          state.bannerTimer = 999;
        }
      }
      break;
    case 'penalties':
      // The shootout is advanced by the dedicated step below; here we just
      // tick the inter-kick timer.
      state.restartTimer = Math.max(0, state.restartTimer - dt);
      if (state.restartTimer <= 0) advanceShootout(state);
      break;
    case 'goal':
      state.restartTimer = Math.max(0, state.restartTimer - dt);
      if (state.restartTimer <= 0) {
        const conceding: Team = state.lastGoalTeam == null ? 1 : ((1 - state.lastGoalTeam) as Team);
        setupKickoff(state, conceding);
      }
      break;
    case 'halftime':
      state.restartTimer = Math.max(0, state.restartTimer - dt);
      if (state.restartTimer <= 0) {
        state.half = 2;
        state.timeMs = 0;
        setupKickoff(state, 1 as Team);
      }
      break;
    case 'fulltime':
    case 'pause':
    case 'extratime':
    case 'penalties':
      break;
  }
}

/** Process field events (goals / out) during active play. */
function processFieldEvents(state: MatchState): void {
  if (state.period !== 'play' && state.period !== 'kickoff') return;
  const ev = checkFieldEvents(state);
  if (ev.type === 'none') return;

  // Any stoppage invalidates a pending offside check.
  state.offsideCheck = null;

  if (ev.type === 'goal') {
    awardGoal(state, ev.team);
    return;
  }

  const team = ev.team;
  if (ev.type === 'throwIn') {
    setupRestart(state, 'throwIn', team);
    // Ball is left loose at the touchline; the restart team (shielded) must
    // come and play it — a real throw-in rather than an instant hand-off.
    moveNearestToBall(state, team);
  } else if (ev.type === 'corner') {
    setupRestart(state, 'corner', team);
    moveNearestToBall(state, team);
  } else if (ev.type === 'goalKick') {
    setupRestart(state, 'goalKick', team);
    const gk = state.players.find((p) => p.team === team && p.role === 'GK');
    if (gk) {
      state.ball.ownerId = gk.id;
      state.ball.x = gk.x;
      state.ball.y = gk.y;
    }
  }
  state.banner = ev.type === 'corner' ? 'ROH' : ev.type === 'goalKick' ? 'KOP OD BRÁNY' : 'AUT';
  state.bannerTimer = 1.0;
}

/** Move the restart team's nearest outfield player toward the restart spot so
 *  they can play the ball quickly (throw-in / corner). The ball stays loose;
 *  the possession shield prevents opponents from stealing it first. */
function moveNearestToBall(state: MatchState, team: Team): void {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.role === 'GK') continue;
    const d = dist(p.x, p.y, state.ball.x, state.ball.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  if (best) {
    // Place the chosen player a couple of paces from the ball so they have to
    // step in to collect it (looks like a real restart setup).
    const dx = best.x - state.ball.x;
    const dy = best.y - state.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    best.x = state.ball.x + (dx / d) * 22;
    best.y = state.ball.y + (dy / d) * 22;
    best.vx = 0;
    best.vy = 0;
  }
}

function givePossessionAt(state: MatchState, team: Team, x: number, y: number): void {
  let best = state.players[0];
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== team) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  best.x = x;
  best.y = y;
  state.ball.ownerId = best.id;
  state.ball.x = x;
  state.ball.y = y;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.vz = 0;
  state.ball.z = 0;
}

function trackLastTouch(state: MatchState): void {
  const ball = state.ball;
  if (ball.ownerId != null) {
    state.lastTouchTeam = teamOf(ball.ownerId);
    return;
  }
  for (const p of state.players) {
    if (dist(p.x, p.y, ball.x, ball.y) < PLAYER_RADIUS + 6) {
      state.lastTouchTeam = p.team;
      break;
    }
  }
}

/**
 * Advance the simulation by one fixed timestep for a single human controller
 * (solo vs AI). Mutates `state` in place.
 */
export function step(state: MatchState, input: InputFrame, dt: number): MatchState {
  return stepMulti(state, [input], dt);
}

/**
 * Advance the simulation by one fixed timestep with N human inputs aligned to
 * `state.controllers` (index i -> controllers[i]). Missing/extra inputs are
 * treated as empty.
 */
export function stepMulti(state: MatchState, inputs: InputFrame[], dt: number): MatchState {
  state.tick++;

  const gameplayActive = state.period === 'play' || state.period === 'kickoff';

  if (gameplayActive) {
    // 1. Apply each human controller's input.
    for (let i = 0; i < state.controllers.length; i++) {
      const input = inputs[i] ?? emptyInput();
      applyController(state, state.controllers[i], input, dt);
    }

    const activeIds = getActiveIds(state);

    // 2. AI for every player not currently human-controlled.
    for (const p of state.players) {
      if (activeIds.has(p.id)) continue;
      aiAct(state, p, dt);
    }

    // 3. Integrate players.
    for (const p of state.players) integratePlayer(p, dt);

    // 4. Player-player collisions (with foul detection for sliding tackles).
    for (let i = 0; i < state.players.length; i++) {
      for (let j = i + 1; j < state.players.length; j++) {
        const a = state.players[i];
        const b = state.players[j];
        resolvePlayerCollision(a, b);
        // A sliding tackler who collides with an opponent commits a foul
        // (tripping). Award a free kick / penalty to the opponent at the
        // contact point. Only one foul per tick.
        if (state.period === 'play' && a.team !== b.team) {
          if (a.state === 'tackle' && dist(a.x, a.y, b.x, b.y) < PLAYER_RADIUS * 2 + 2) {
            awardFoul(state, a.team, a.x, a.y);
            // End the slide and stun the tackler (booked-ish).
            a.state = 'stunned';
            a.stunnedTime = 0.8;
            a.diveTime = 0;
          } else if (b.state === 'tackle' && dist(a.x, a.y, b.x, b.y) < PLAYER_RADIUS * 2 + 2) {
            awardFoul(state, b.team, b.x, b.y);
            b.state = 'stunned';
            b.stunnedTime = 0.8;
            b.diveTime = 0;
          }
        }
      }
    }

    // 5. Ball.
    if (state.ball.ownerId != null) {
      dribble(state, dt);
    } else {
      integrateBall(state.ball, dt);
    }
    // Tick the possession shield every step regardless of ball ownership
    // (dribble() doesn't run integrateBall, so the shield would otherwise
    // never expire while the ball is held).
    if (state.ball.possessionShield > 0) {
      state.ball.possessionShield = Math.max(0, state.ball.possessionShield - dt);
      if (state.ball.possessionShield === 0) state.ball.shieldTeam = null;
    }

    // 5b. Goalkeeper hold timer — if the GK holds the ball too long, force a
    // release (turnover goal-kick to the opposing team).
    const owner5 = state.ball.ownerId != null ? state.players[state.ball.ownerId] : null;
    if (owner5 && owner5.role === 'GK') {
      state.ball.gkHoldTime += dt;
      if (state.ball.gkHoldTime >= GK_HOLD_MAX) {
        // Force a goal kick to the opposing team from the GK's position.
        const opp: Team = (1 - owner5.team) as Team;
        state.ball.x = owner5.x;
        state.ball.y = owner5.y;
        state.ball.gkHoldTime = 0;
        setupRestart(state, 'goalKick', opp);
        state.banner = 'KOP OD BRÁNY';
        state.bannerTimer = 1.2;
      }
    } else {
      state.ball.gkHoldTime = 0;
    }

    // 6. Possession, posts, last touch.
    const prevOwner = state.ball.ownerId;
    resolvePossession(state);
    resolveGoalPosts(state);
    trackLastTouch(state);

    // 6b. Offside — judged when a NEW teammate gains the ball from a pass.
    if (state.offsideCheck && state.ball.ownerId != null && state.ball.ownerId !== prevOwner) {
      const receiver = state.players[state.ball.ownerId];
      if (!receiver) {
        state.offsideCheck = null;
      } else if (receiver.team !== state.offsideCheck.passerTeam) {
        // Opponent won the ball — pass broken up, no offside possible.
        state.offsideCheck = null;
      } else if (receiver.id !== state.offsideCheck.passerId) {
        // Teammate received — judge offside against the pass snapshot.
        if (isReceiverOffside(state, receiver)) {
          awardOffside(state, receiver.x, receiver.y);
        } else {
          state.offsideCheck = null;
        }
      }
    }

    // 7. Field events / restarts / goals.
    processFieldEvents(state);
  } else {
    for (const p of state.players) {
      if (p.state === 'celebrate') p.animTime += dt;
    }
  }

  // 8. Match flow / period transitions.
  advanceMatchFlow(state, dt);

  return state;
}

function emptyInput(): InputFrame {
  return {
    seq: 0,
    moveX: 0,
    moveY: 0,
    sprint: false,
    pass: false,
    shootHeld: false,
    highPass: false,
    switchPlayer: false,
  };
}

/** Convenience: step at the canonical fixed dt. */
export function fixedStep(state: MatchState, input: InputFrame): MatchState {
  return step(state, input, FIXED_DT);
}

export function validHalfLengths(): readonly number[] {
  return HALF_LENGTH_OPTIONS;
}

export function difficultyParams(d: Difficulty) {
  return DIFFICULTY_PARAMS[d];
}

export { resetToFormation, setupKickoff, awardGoal };
export { dist };
export { GOAL_TOP, GOAL_BOTTOM, PLAYERS_PER_TEAM };
