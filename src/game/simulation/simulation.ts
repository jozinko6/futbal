/**
 * Kačanovská FIFA — futsal 5v5 deterministic simulation entry point.
 *
 * `step(state, input, dt)` / `stepMulti(state, inputs, dt)` advance the match
 * by one fixed timestep. Pure w.r.t. external state; seeded RNG only.
 */
import {
  DEFAULT_HALF_LENGTH, DIFFICULTY_PARAMS, FIXED_DT, HALF_LENGTH_OPTIONS,
  GK_HOLD_MAX, PENALTY_SHOOTOUT_KICKS, PENALTY_SPOT_X, PLAYERS_PER_TEAM,
  PLAYER_RADIUS, TACKLE_RADIUS, SHOOT_CHARGE_TIME, m,
  FIELD_CX, FIELD_CY, FIELD_RIGHT, FIELD_X,
  type Difficulty,
} from './constants';
import type { HumanController, InputFrame, MatchState, PlayerEntity, Team } from './types';
import { hashSeed, rngCreate, rngFloat } from './rng';
import { buildPlayers, resetToFormation, teamOf } from './formation';
import {
  setupKickoff, setupRestart, awardGoal, awardFoul, awardOffside,
  checkFieldEvents, isReceiverOffside, resolveGoalPosts,
} from './rules';
import {
  applyMovement, dribble, integratePlayer, resolvePlayerCollision, resolvePossession,
  shoot, pass, executePassKick, executeShotKick, startTackle, tryTackle, assistedPassTarget,
  shoulderChallenge, standingTackle, pokeTackle,
} from './player';
import { integrateBall } from './ball';
import { aiAct } from './ai';
import { updateTeamTactics } from './teamTactics';
import { updateGoalkeeper } from './goalkeeper';
import { stepAction } from './actionSystem';
import { evaluateTackleFoul, recordBallContact, resetContactTrack } from './fouls';
import { emit } from '@/game/presentation/events';
import { syncHasBall as syncHasBallState, setBallOwner } from './ownership';
import { dist } from './math';

export interface CreateMatchOptions {
  difficulty?: Difficulty;
  halfLength?: number;
  humanTeam?: Team;
  humanPlayers?: 0 | 1 | 2;
  seed?: number | string;
  autoSwitch?: boolean;
}

function makeController(team: Team, activeId: number, autoSwitch: boolean): HumanController {
  return { team, activeId, chargeTime: 0, prevShootHeld: false, prevPass: false, prevHighPass: false, prevSwitch: false, autoSwitch,
    lastSwitchTick: 0, autoSwitchBlockedUntil: 0, manualSwitchLockUntil: 0 };
}

export function createMatchState(opts: CreateMatchOptions = {}): MatchState {
  const halfLength = opts.halfLength ?? DEFAULT_HALF_LENGTH;
  const difficulty = opts.difficulty ?? 'normal';
  const humanTeam: Team = opts.humanTeam ?? 0;
  const humanPlayers = opts.humanPlayers ?? 1;
  const autoSwitch = opts.autoSwitch ?? true;
  const seedNum = typeof opts.seed === 'number' ? opts.seed : hashSeed(opts.seed ?? `kf-${Date.now()}`);
  const controllers: HumanController[] = [];
  if (humanPlayers >= 1) controllers.push(makeController(humanTeam, humanTeam === 0 ? 4 : 9, autoSwitch));
  if (humanPlayers === 2) {
    const other: Team = (1 - humanTeam) as Team;
    controllers.push(makeController(other, other === 0 ? 4 : 9, autoSwitch));
  }
  const state: MatchState = {
    timeMs: 0, half: 1, period: 'kickoff', score: [0, 0],
    ball: {
      x: FIELD_CX, y: FIELD_CY, z: 0, vx: 0, vy: 0, vz: 0, spin: 0,
      ownerId: null, previousOwnerId: null, lastTouchPlayerId: null, lastTouchTeam: null,
      controlStartedTick: 0, releaseTick: 0, mode: 'FREE',
      releaseCooldown: 0, possessionShield: 0, shieldTeam: null,
      gkHoldTime: 0, indirect: false, ballState: 'LOOSE', touchTimer: 0,
    },
    players: buildPlayers(), controllers,
    restartTeam: 0, restartType: 'kickoff', restartTimer: 0,
    lastTouchTeam: null, nextRestartTeam: 0, nextRestartType: null,
    rngState: rngCreate(seedNum), difficulty, halfLength, tick: 0,
    lastGoalTeam: null, banner: 'VÝKOP', bannerTimer: 1.2,
    offsideCheck: null, offsides: [0, 0], shootout: null,
    teamPhase: ['ORGANIZED_DEFENSE', 'ORGANIZED_DEFENSE'], debug: false,
    events: [],
  };
  resetToFormation(state.players);
  setupKickoff(state, 0 as Team);
  return state;
}

export function setDifficulty(state: MatchState, d: Difficulty): void { state.difficulty = d; }
export function toggleDebug(state: MatchState): void { state.debug = !state.debug; }

export function getActiveIds(state: MatchState): Set<number> {
  return new Set(state.controllers.map((c) => c.activeId));
}
export function getActivePlayerId(state: MatchState): number {
  return state.controllers[0]?.activeId ?? 0;
}
export function resetControllers(state: MatchState): void {
  for (const c of state.controllers) {
    c.chargeTime = 0; c.prevShootHeld = false; c.prevPass = false; c.prevHighPass = false; c.prevSwitch = false;
  }
}

// --- Weighted player switching --------------------------------------------

function switchToNext(state: MatchState, c: HumanController): void {
  const ids = state.players.filter((p) => p.team === c.team && p.role !== 'goalkeeper').map((p) => p.id);
  const idx = ids.indexOf(c.activeId);
  c.activeId = ids[(idx + 1) % ids.length] ?? c.activeId;
}

function switchToNearest(state: MatchState, c: HumanController): void {
  // Weighted: time-to-ball, distance, movement direction, defensive position,
  // distance to own goal, tactical role. NOT just nearest.
  const ball = state.ball;
  let best = c.activeId;
  let bestScore = -Infinity;
  for (const p of state.players) {
    if (p.team !== c.team || p.role === 'goalkeeper' || p.id === c.activeId) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    const timeToBall = d / Math.max(1, Math.hypot(p.vx, p.vy) + 1);
    const ownGoalX = p.team === 0 ? FIELD_X : FIELD_RIGHT;
    const distOwnGoal = Math.abs(p.x - ownGoalX);
    const roleBonus = p.role === 'fixo' ? -0.2 : p.role === 'pivot' ? 0.1 : 0;
    const score = -d * 1.0 - timeToBall * 20 - distOwnGoal * 0.1 + roleBonus * 50;
    if (score > bestScore) { bestScore = score; best = p.id; }
  }
  c.activeId = best;
}

// --- Human input ----------------------------------------------------------

function assistedPassTargetSafe(state: MatchState, passer: PlayerEntity, dirX: number, dirY: number) {
  return assistedPassTarget(state, passer, dirX, dirY);
}

function applyController(state: MatchState, c: HumanController, input: InputFrame, dt: number): void {
  const active = state.players[c.activeId];
  if (!active) return;
  const switchPressed = input.switchPlayer && !c.prevSwitch;
  if (switchPressed) {
    switchToNext(state, c);
    c.lastSwitchTick = state.tick;
    c.manualSwitchLockUntil = state.tick + 48; // 0.8s @ 60fps
    c.autoSwitchBlockedUntil = state.tick + 39; // 0.65s
  } else if (c.autoSwitch && state.tick > c.autoSwitchBlockedUntil && state.tick > c.manualSwitchLockUntil) {
    if (autoSwitchShouldTrigger(state, c)) {
      switchToNearest(state, c);
      c.lastSwitchTick = state.tick;
      c.autoSwitchBlockedUntil = state.tick + 39; // 0.65s cooldown
    }
  }
  c.prevSwitch = input.switchPlayer;

  const cur = state.players[c.activeId] ?? active;
  applyMovement(cur, input.moveX, input.moveY, input.sprint, cur.hasBall, dt);

  const passPressed = input.pass && !c.prevPass;
  c.prevPass = input.pass;
  const highPressed = input.highPass && !c.prevHighPass;
  c.prevHighPass = input.highPass;

  if (passPressed || highPressed) {
    if (cur.hasBall) {
      // Normal pass.
      const dirX = input.moveX || Math.cos(cur.facing);
      const dirY = input.moveY || Math.sin(cur.facing);
      const tgt = assistedPassTargetSafe(state, cur, dirX, dirY);
      pass(cur, tgt.x, tgt.y, state, highPressed ? 'lob' : tgt.type);
      c.chargeTime = 0;
    } else if (state.ball.mode === 'PASS' || state.ball.mode === 'SHOT' || state.ball.mode === 'FREE') {
      // ONE-TOUCH PASS: ball is incoming, player redirects it without first controlling.
      const ballDist = dist(cur.x, cur.y, state.ball.x, state.ball.y);
      const ballSp = Math.hypot(state.ball.vx, state.ball.vy);
      if (ballDist < m(2.5) && ballSp > 30) {
        const dirX = input.moveX || Math.cos(cur.facing);
        const dirY = input.moveY || Math.sin(cur.facing);
        const tgt = assistedPassTargetSafe(state, cur, dirX, dirY);
        // Short windup for one-touch — ball is kicked at contact tick.
        pass(cur, tgt.x, tgt.y, state, highPressed ? 'lob' : tgt.type);
        c.chargeTime = 0;
      }
    }
  }

  const shootReleased = c.prevShootHeld && !input.shootHeld;
  const shootPressed = !c.prevShootHeld && input.shootHeld;
  if (cur.hasBall) {
    if (input.shootHeld) c.chargeTime = Math.min(SHOOT_CHARGE_TIME, c.chargeTime + dt);
    if (shootReleased) {
      const charge = c.chargeTime / SHOOT_CHARGE_TIME;
      // Real goal-line target: aim at the attacking goal's line, with the
      // direction stick choosing the target Y on the goal mouth.
      const goalLineX = cur.team === 0 ? FIELD_RIGHT : FIELD_X;
      const goalTopY = FIELD_CY - m(1.5); // GOAL_H/2 in metres (~3m goal)
      const goalBotY = FIELD_CY + m(1.5);
      // Without aim input, use the player's facing to pick a side.
      let targetY: number;
      if (Math.abs(input.moveY) > 0.1) {
        targetY = FIELD_CY + input.moveY * m(1.4);
      } else {
        // Aim toward the far post (opposite to facing y) for variety.
        targetY = FIELD_CY + (Math.sin(cur.facing) > 0 ? -m(0.8) : m(0.8));
      }
      targetY = Math.max(goalTopY, Math.min(goalBotY, targetY));
      // Shot type: short press = placed, long press = power, highPass(hold) = lob.
      const shotType = highPressed ? 'lob' : charge < 0.4 ? 'placed' : 'power';
      shoot(cur, goalLineX, targetY, charge, state, shotType);
      c.chargeTime = 0;
    }
  } else {
    // --- DEFENSE (no ball) ---
    // A button (J/pass) = contextual: shoulder challenge, standing tackle, or poke.
    if (passPressed) {
      const ball = state.ball;
      const owner = ball.ownerId != null ? state.players[ball.ownerId] : null;
      if (owner && owner.team !== cur.team && dist(cur.x, cur.y, owner.x, owner.y) <= m(1.5)) {
        // Close to ball carrier → standing tackle.
        standingTackle(cur, state);
      } else if (ball.ownerId == null && dist(cur.x, cur.y, ball.x, ball.y) <= m(1.5)) {
        // Close to loose ball → poke tackle.
        pokeTackle(cur, state);
      } else {
        // Otherwise → shoulder challenge (push nearest opponent).
        shoulderChallenge(cur, state);
      }
    }
    // B button (K/shoot) = slide tackle.
    if (shootPressed) {
      const dirX = input.moveX || Math.cos(cur.facing);
      const dirY = input.moveY || Math.sin(cur.facing);
      startTackle(cur, dirX, dirY);
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
    if (p.team !== c.team || p.role === 'goalkeeper' || p.id === c.activeId) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    if (d < bd) bd = d;
  }
  const curD = dist(cur.x, cur.y, ball.x, ball.y);
  if (curD - bd > m(3)) switched = true;
  return switched;
}

// --- Match flow -----------------------------------------------------------

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
      // Restart time limit: if a restart (throw-in/corner/free-kick) has been
      // set up but not played for too long, force the ball live so play
      // cannot stall indefinitely.
      if (state.restartType != null && state.restartType !== 'kickoff') {
        state.restartTimer -= dt;
        if (state.restartTimer <= -5) {
          // Force live: clear shield so anyone can contest.
          state.ball.possessionShield = 0;
          state.ball.shieldTeam = null;
          state.restartType = null;
        }
      }
      if (state.half === 1 && state.timeMs >= state.halfLength) {
        state.period = 'halftime'; state.restartTimer = 3;
        state.banner = 'POLČAS'; state.bannerTimer = 3;
      } else if (state.half === 2 && state.timeMs >= state.halfLength) {
        if (state.score[0] === state.score[1]) startShootout(state);
        else { state.period = 'fulltime'; state.banner = 'KONIEC ZÁPASU'; state.bannerTimer = 999; }
      }
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
      if (state.restartTimer <= 0) { state.half = 2; state.timeMs = 0; setupKickoff(state, 1 as Team); }
      break;
    case 'penalties':
      state.restartTimer = Math.max(0, state.restartTimer - dt);
      if (state.restartTimer <= 0) advanceShootout(state);
      break;
    case 'fulltime':
    case 'pause':
    case 'extratime':
      break;
  }
}

function processFieldEvents(state: MatchState): void {
  if (state.period !== 'play' && state.period !== 'kickoff') return;
  const ev = checkFieldEvents(state);
  if (ev.type === 'none') return;
  state.offsideCheck = null;
  if (ev.type === 'goal') { awardGoal(state, ev.team); return; }
  const team = ev.team;
  if (ev.type === 'throwIn') {
    setupRestart(state, 'throwIn', team);
    moveNearestToBall(state, team);
    state.banner = 'AUT'; state.bannerTimer = 0.9;
  } else if (ev.type === 'corner') {
    setupRestart(state, 'corner', team);
    moveNearestToBall(state, team);
    state.banner = 'ROH'; state.bannerTimer = 1.0;
  } else if (ev.type === 'goalKick') {
    setupRestart(state, 'goalKick', team);
    const gk = state.players.find((p) => p.team === team && p.role === 'goalkeeper');
    if (gk) { setBallOwner(state, gk.id, 'GK_HELD'); state.ball.x = gk.x; state.ball.y = gk.y; }
    state.banner = 'KOP OD BRÁNY'; state.bannerTimer = 1.0;
  }
}

function moveNearestToBall(state: MatchState, team: Team): void {
  let best: PlayerEntity | null = null;
  let bd = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.role === 'goalkeeper') continue;
    const d = dist(p.x, p.y, state.ball.x, state.ball.y);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) {
    const dx = best.x - state.ball.x, dy = best.y - state.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    best.x = state.ball.x + (dx / d) * m(0.7);
    best.y = state.ball.y + (dy / d) * m(0.7);
    best.vx = 0; best.vy = 0;
  }
}

function trackLastTouch(state: MatchState): void {
  const ball = state.ball;
  if (ball.ownerId != null) { state.lastTouchTeam = teamOf(ball.ownerId); return; }
  for (const p of state.players) {
    if (dist(p.x, p.y, ball.x, ball.y) < PLAYER_RADIUS + m(0.2)) { state.lastTouchTeam = p.team; break; }
  }
}

// --- Penalty shootout -----------------------------------------------------

function startShootout(state: MatchState): void {
  state.period = 'penalties';
  state.shootout = { kicksTaken: [0, 0], kicksScored: [0, 0], nextKicker: 0 as Team, suddenDeath: false, kickerIndex: [0, 0] };
  state.banner = 'PENALTY ROZSTRELY'; state.bannerTimer = 2.5; state.restartTimer = 2.5;
  resetToFormation(state.players);
}

function advanceShootout(state: MatchState): void {
  const sh = state.shootout;
  if (!sh) { state.period = 'fulltime'; return; }
  const team = sh.nextKicker;
  const opp: Team = (1 - team) as Team;
  const p = state.difficulty === 'hard' ? 0.85 : state.difficulty === 'normal' ? 0.75 : 0.68;
  const [next, roll] = rngFloat(state.rngState, 0, 1);
  state.rngState = next;
  const scored = roll < p;
  if (scored) state.score[team]++;
  sh.kicksTaken[team]++;
  sh.kickerIndex[team] = (sh.kickerIndex[team] + 1) % 4;
  const [a, b] = state.score;
  const ka = sh.kicksTaken[0], kb = sh.kicksTaken[1];
  if (decideShootoutWinner(a, b, ka, kb, sh.suddenDeath)) {
    state.period = 'fulltime'; state.banner = 'KONIEC'; state.bannerTimer = 999; state.shootout = null; return;
  }
  sh.nextKicker = opp;
  if (ka >= PENALTY_SHOOTOUT_KICKS && kb >= PENALTY_SHOOTOUT_KICKS) sh.suddenDeath = true;
  state.banner = scored ? 'GÓL!' : 'MINUL!'; state.bannerTimer = 1.4; state.restartTimer = 1.6;
}

function decideShootoutWinner(a: number, b: number, ka: number, kb: number, sd: boolean): boolean {
  if (!sd) {
    if (ka < PENALTY_SHOOTOUT_KICKS && a > b + (PENALTY_SHOOTOUT_KICKS - kb)) return true;
    if (kb < PENALTY_SHOOTOUT_KICKS && b > a + (PENALTY_SHOOTOUT_KICKS - ka)) return true;
    if (ka >= PENALTY_SHOOTOUT_KICKS && kb >= PENALTY_SHOOTOUT_KICKS) return a !== b;
    return false;
  }
  if (ka === kb && a !== b) return true;
  return false;
}

// --- Step -----------------------------------------------------------------

function emptyInput(): InputFrame {
  return { seq: 0, moveX: 0, moveY: 0, sprint: false, pass: false, shootHeld: false, highPass: false, switchPlayer: false };
}

export function step(state: MatchState, input: InputFrame, dt: number): MatchState {
  return stepMulti(state, [input], dt);
}

export function stepMulti(state: MatchState, inputs: InputFrame[], dt: number): MatchState {
  state.tick++;
  // Ensure hasBall is always in sync with ball.ownerId at the start of each tick.
  syncHasBallState(state);
  const gameplayActive = state.period === 'play' || state.period === 'kickoff';
  if (gameplayActive) {
    // 1. Team tactics for both teams.
    updateTeamTactics(state, 0 as Team);
    updateTeamTactics(state, 1 as Team);
    // 2. Human inputs.
    for (let i = 0; i < state.controllers.length; i++) {
      applyController(state, state.controllers[i], inputs[i] ?? emptyInput(), dt);
    }
    const activeIds = getActiveIds(state);
    // 3. AI for non-human outfield players.
    for (const p of state.players) {
      if (activeIds.has(p.id)) continue;
      if (p.role === 'goalkeeper') continue;
      aiAct(state, p, dt);
    }
    // 4. Goalkeepers.
    for (const p of state.players) {
      if (p.role === 'goalkeeper') {
        updateGoalkeeper(state, p, dt);
        // GK movement already applied in updateGoalkeeper; still integrate position.
      }
    }
    // 5. Integrate players + advance phased actions (kick at contact tick).
    for (const p of state.players) {
      integratePlayer(p, dt);
      const ar = stepAction(p, state);
      if (ar.contact) {
        // Execute the kick at the contact tick.
        const a = ar.contact;
        if (a.type === 'shortPass' || a.type === 'drivenPass' || a.type === 'throughPass' || a.type === 'lobPass') {
          executePassKick(p, state, a);
          emit(state.events, { type: 'BALL_KICKED', tick: state.tick, x: p.x, y: p.y, power: a.power, kickType: a.type });
        } else if (a.type === 'placedShot' || a.type === 'powerShot' || a.type === 'lobShot' || a.type === 'firstTimeShot') {
          executeShotKick(p, state, a);
          emit(state.events, { type: 'BALL_KICKED', tick: state.tick, x: p.x, y: p.y, power: a.power, kickType: a.type });
        }
      }
    }
    // 6. Soft collisions + proper foul detection (not automatic on slide).
    // Track ball contact for sliding/standing tacklers first.
    for (const p of state.players) {
      if (p.state === 'tackle' || p.state === 'slide') {
        if (dist(p.x, p.y, state.ball.x, state.ball.y) <= TACKLE_RADIUS) {
          recordBallContact(p, state.tick);
        }
      }
    }
    for (let i = 0; i < state.players.length; i++) {
      for (let j = i + 1; j < state.players.length; j++) {
        const a = state.players[i], b = state.players[j];
        resolvePlayerCollision(a, b);
        if (state.period === 'play' && a.team !== b.team) {
          const contactDist = PLAYER_RADIUS * 2 + m(0.1);
          const inContact = dist(a.x, a.y, b.x, b.y) < contactDist;
          if (!inContact) continue;
          // A sliding/standing tackler contacting an opponent → evaluate foul.
          if (a.state === 'tackle' || a.state === 'slide') {
            const ev = evaluateTackleFoul(state, a, b);
            if (ev.foul) {
              awardFoul(state, a.team, a.x, a.y);
              a.state = 'stunned'; a.stunnedTime = 0.8; a.diveTime = 0;
              resetContactTrack(a);
            }
          } else if (b.state === 'tackle' || b.state === 'slide') {
            const ev = evaluateTackleFoul(state, b, a);
            if (ev.foul) {
              awardFoul(state, b.team, b.x, b.y);
              b.state = 'stunned'; b.stunnedTime = 0.8; b.diveTime = 0;
              resetContactTrack(b);
            }
          }
        }
      }
    }
    // 7. Ball.
    if (state.ball.ownerId != null) dribble(state, dt);
    else integrateBall(state.ball, dt);
    if (state.ball.possessionShield > 0) {
      state.ball.possessionShield = Math.max(0, state.ball.possessionShield - dt);
      if (state.ball.possessionShield === 0) state.ball.shieldTeam = null;
    }
    // GK hold timer.
    const owner7 = state.ball.ownerId != null ? state.players[state.ball.ownerId] : null;
    if (owner7 && owner7.role === 'goalkeeper') {
      state.ball.gkHoldTime += dt;
      if (state.ball.gkHoldTime >= GK_HOLD_MAX) {
        const opp: Team = (1 - owner7.team) as Team;
        state.ball.x = owner7.x; state.ball.y = owner7.y; state.ball.gkHoldTime = 0;
        setupRestart(state, 'goalKick', opp);
        state.banner = 'KOP OD BRÁNY'; state.bannerTimer = 1.2;
      }
    } else state.ball.gkHoldTime = 0;
    // 8. Possession / first touch / ball state.
    const prevOwner = state.ball.ownerId;
    resolvePossession(state);
    resolveGoalPosts(state);
    trackLastTouch(state);
    void prevOwner; // futsal: no offside check
    // 9. Field events.
    processFieldEvents(state);
  } else {
    for (const p of state.players) if (p.state === 'celebrate') p.animTime += dt;
  }
  // 10. Match flow.
  advanceMatchFlow(state, dt);
  return state;
}

export function fixedStep(state: MatchState, input: InputFrame): MatchState { return step(state, input, FIXED_DT); }
export function validHalfLengths(): readonly number[] { return HALF_LENGTH_OPTIONS; }
export function difficultyParams(d: Difficulty) { return DIFFICULTY_PARAMS[d]; }

export { resetToFormation, setupKickoff, awardGoal };
export { dist };
export { PENALTY_SPOT_X, PLAYERS_PER_TEAM };

// Re-export ownership helpers from ownership.ts for backward compat.
export { playerHasBall, syncHasBall, setBallOwner, releaseBall } from './ownership';
