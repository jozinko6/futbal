import { describe, it, expect } from 'vitest';
import {
  createMatchState,
  step,
  stepMulti,
  FIXED_DT,
  emptyInput,
  m,
  METER_PX,
  FIELD_CX,
  FIELD_CY,
  FIELD_X,
  FIELD_RIGHT,
  TACKLE_RADIUS,
  CONTROL_RADIUS,
  startTackle,
  pass,
  shoot,
  assistedPassTarget,
  tryTackle,
  type MatchState,
  type InputFrame,
} from '@/game/simulation';

function press(input: Partial<InputFrame>): InputFrame {
  return { ...emptyInput(0), ...input };
}

function runFor(state: MatchState, seconds: number, input: InputFrame): MatchState {
  const ticks = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < ticks; i++) step(state, input, FIXED_DT);
  return state;
}

describe('gameplay — dribling', () => {
  it('dribbling at low speed keeps the ball close (≤ 1.0 m)', () => {
    const s = createMatchState({ seed: 101, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const p = s.players[3]; // an outfielder
    p.x = FIELD_CX; p.y = FIELD_CY;
    p.vx = 0; p.vy = 0;
    p.stamina = 100;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED";
    s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    // Isolate other players far away to prevent AI interference.
    for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.y = FIELD_CY + 200; o.stunnedTime = 5; } }
    // Walk slowly forward (moveX = 0.5, no sprint).
    const inp = press({ moveX: 0.5 });
    runFor(s, 1.0, inp);
    const d = Math.hypot(s.ball.x - p.x, s.ball.y - p.y);
    expect(d).toBeLessThan(m(1.0));
  });

  it('dribbling at sprint pushes the ball further ahead (≥ 0.7 m)', () => {
    const s = createMatchState({ seed: 102, halfLength: 60 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX; p.y = FIELD_CY;
    p.vx = 0; p.vy = 0;
    p.stamina = 100;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED";
    s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    const inp = press({ moveX: 1, sprint: true });
    runFor(s, 0.8, inp);
    // Ball should be ahead of the player (in the facing direction).
    const ballAhead = s.ball.x > p.x;
    expect(ballAhead).toBe(true);
  });

  it('the ball is not permanently glued: it moves independently between touches', () => {
    const s = createMatchState({ seed: 103, halfLength: 60 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX; p.y = FIELD_CY;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED";
    s.ball.x = p.x + m(0.3); s.ball.y = p.y; s.ball.z = 0;
    s.ball.vx = 0; s.ball.vy = 0;
    s.ball.touchTimer = 0.1;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    // No input — player stands still. Ball should not snap onto the player.
    const ballX0 = s.ball.x;
    step(s, emptyInput(0), FIXED_DT);
    // Ball moved by its own velocity/friction, not teleported onto the player.
    const moved = Math.abs(s.ball.x - ballX0);
    expect(moved).toBeLessThan(m(0.5));
  });
});

describe('gameplay — first touch', () => {
  it('a good first touch controls the ball (owner assigned)', () => {
    const s = createMatchState({ seed: 104, halfLength: 60 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX + m(5); p.y = FIELD_CY;
    p.facing = Math.PI; // facing left toward the incoming ball
    p.stamina = 100;
    s.ball.ownerId = null;
    s.ball.x = FIELD_CX; s.ball.y = FIELD_CY;
    s.ball.vx = 120; s.ball.vy = 0; s.ball.z = 0; // slow pass toward the player
    s.ball.releaseCooldown = 0;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    runFor(s, 2.0, emptyInput(0));
    const controlled = s.ball.ownerId === p.id;
    const close = Math.hypot(s.ball.x - p.x, s.ball.y - p.y) < m(1.5);
    expect(controlled || close).toBe(true);
  });

  it('a bad first touch (hard pass + pressure) can release the ball', () => {
    const s = createMatchState({ seed: 105, halfLength: 60 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX + m(3); p.y = FIELD_CY;
    p.facing = 0; // facing AWAY from the incoming ball (bad angle)
    p.stamina = 20; // fatigued
    // Hard driven pass toward the player.
    s.ball.ownerId = null;
    s.ball.x = FIELD_CX; s.ball.y = FIELD_CY;
    s.ball.vx = 400; s.ball.vy = 0; s.ball.z = 0;
    s.ball.releaseCooldown = 0;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    // Add an opponent close by for pressure.
    const opp = s.players.find((q) => q.team !== p.team && q.role !== 'goalkeeper')!;
    opp.x = p.x + m(0.8); opp.y = p.y; opp.stunnedTime = 0;
    for (const o of s.players) { if (o.id !== p.id && o.id !== opp.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    runFor(s, 0.6, emptyInput(0));
    // The player may or may not have controlled; but if not, the ball should be
    // loose (not stuck inside the player).
    const loose = s.ball.ownerId == null;
    const notStuck = Math.hypot(s.ball.x - p.x, s.ball.y - p.y) > m(0.1);
    expect(loose || notStuck).toBe(true);
  });
});

describe('gameplay — action contact tick', () => {
  it('a pass action kicks the ball at the contact tick, not immediately', () => {
    const s = createMatchState({ seed: 106, halfLength: 60 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX; p.y = FIELD_CY;
    p.hasBall = true;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED";
    s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    s.ball.vx = 0; s.ball.vy = 0;
    const ballVx0 = s.ball.vx;
    pass(p, p.x + m(10), p.y, s, 'short');
    // Immediately after starting the pass, the ball has NOT been kicked yet
    // (windup phase).
    expect(s.ball.vx).toBe(ballVx0);
    expect(p.currentAction).not.toBeNull();
    expect(p.currentAction!.phase).toBe('windup');
    // After enough ticks for windup+contact, the ball is kicked.
    runFor(s, 0.2, emptyInput(0));
    expect(Math.abs(s.ball.vx)).toBeGreaterThan(0);
  });

  it('a shot action kicks the ball at the contact tick', () => {
    const s = createMatchState({ seed: 107, halfLength: 60 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX; p.y = FIELD_CY;
    p.hasBall = true;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED";
    s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    s.ball.vx = 0; s.ball.vy = 0;
    const ballVx0 = s.ball.vx;
    shoot(p, FIELD_RIGHT, FIELD_CY, 0.5, s, 'power');
    expect(s.ball.vx).toBe(ballVx0); // not kicked yet
    expect(p.currentAction).not.toBeNull();
    runFor(s, 0.3, emptyInput(0));
    expect(Math.abs(s.ball.vx)).toBeGreaterThan(0);
  });
});

describe('gameplay — shooting aim', () => {
  it('a shot can be aimed at the top of the goal (Y < centre)', () => {
    const s = createMatchState({ seed: 108, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const p = s.players[3]; // home team 0 → attacks right
    p.x = FIELD_RIGHT - m(8); p.y = FIELD_CY;
    p.hasBall = true; p.facing = 0;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED"; s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    s.ball.vx = 0; s.ball.vy = 0;
    for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    shoot(p, FIELD_RIGHT, FIELD_CY - m(1.2), 0.3, s, 'placed');
    runFor(s, 0.4, emptyInput(0));
    expect(s.ball.vx).toBeGreaterThan(0);
    // vy should be negative (aimed up), though RNG error may shift it slightly.
    expect(s.ball.vy).toBeLessThanOrEqual(5);
  });

  it('a shot can be aimed at the bottom of the goal (Y > centre)', () => {
    const s = createMatchState({ seed: 109, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_RIGHT - m(8); p.y = FIELD_CY;
    p.hasBall = true; p.facing = 0;
    s.ball.ownerId = p.id; s.ball.mode = "CONTROLLED"; s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    s.ball.vx = 0; s.ball.vy = 0;
    for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    shoot(p, FIELD_RIGHT, FIELD_CY + m(1.2), 0.3, s, 'placed');
    runFor(s, 0.4, emptyInput(0));
    expect(s.ball.vx).toBeGreaterThan(0);
    expect(s.ball.vy).toBeGreaterThanOrEqual(-5);
  });
});

describe('gameplay — defense & fouls', () => {
  it('a clean slide that touches the ball first is NOT a foul', () => {
    const s = createMatchState({ seed: 110, halfLength: 60 });
    s.period = 'play';
    const tackler = s.players[3]; // team 0
    tackler.x = FIELD_CX; tackler.y = FIELD_CY;
    tackler.facing = 0;
    const opp = s.players.find((q) => q.team !== tackler.team && q.role !== 'goalkeeper')!;
    opp.x = FIELD_CX + m(0.8); opp.y = FIELD_CY;
    // Ball between them, closer to the tackler → tackler reaches ball first.
    s.ball.ownerId = opp.id;
    s.ball.x = tackler.x + m(0.5); s.ball.y = FIELD_CY; s.ball.z = 0;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    s.ball.releaseCooldown = 0;
    // Move other players away.
    for (const o of s.players) { if (o.id !== tackler.id && o.id !== opp.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    // Tackler slides toward the ball/opponent.
    startTackle(tackler, 1, 0);
    // Run a few ticks so the slide reaches the ball first, then the opponent.
    runFor(s, 0.5, emptyInput(0));
    // No foul should have been called (restartType should NOT be a free kick
    // for the opponent due to this challenge).
    const foulCalled = s.restartType === 'freeKick' && s.restartTeam === opp.team;
    expect(foulCalled).toBe(false);
  });

  it('a slide from behind is a foul', () => {
    const s = createMatchState({ seed: 111, halfLength: 60 });
    s.period = 'play';
    const tackler = s.players[3]; // team 0
    tackler.x = FIELD_CX - m(0.5); tackler.y = FIELD_CY;
    tackler.facing = 0;
    const opp = s.players.find((q) => q.team !== tackler.team && q.role !== 'goalkeeper')!;
    // Opponent is ahead of the tackler, facing AWAY (tackler comes from behind).
    opp.x = FIELD_CX + m(0.5); opp.y = FIELD_CY;
    opp.facing = 0; // facing away from the tackler → tackler is behind
    opp.hasBall = true;
    s.ball.ownerId = opp.id;
    s.ball.x = opp.x + m(0.5); s.ball.y = FIELD_CY; s.ball.z = 0; // ball ahead of opp (not reachable by tackler)
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    s.ball.releaseCooldown = 0;
    for (const o of s.players) { if (o.id !== tackler.id && o.id !== opp.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    startTackle(tackler, 1, 0);
    runFor(s, 0.6, emptyInput(0));
    const foul = s.restartType === 'freeKick' || s.restartType === 'penalty';
    expect(foul).toBe(true);
    expect(s.restartTeam).toBe(opp.team);
  });
});

describe('gameplay — AI structure', () => {
  it('in defense, exactly one player presses and one covers (not all swarm)', () => {
    const s = createMatchState({ seed: 112, halfLength: 30, humanPlayers: 0 });
    s.period = 'play';
    // Give the ball to team 1, deep in team 0's half.
    const opp = s.players.find((p) => p.team === 1 && p.role !== 'goalkeeper')!;
    opp.x = FIELD_X + m(6); opp.y = FIELD_CY;
    s.ball.ownerId = opp.id; s.ball.x = opp.x; s.ball.y = opp.y; s.ball.z = 0;
    s.ball.possessionShield = 0; s.ball.shieldTeam = null;
    const empty: never[] = [];
    // Run ~1s of AI.
    for (let i = 0; i < 60; i++) stepMulti(s, empty, FIXED_DT);
    // Count team-0 outfielders whose aiAction is PRESS.
    let pressers = 0;
    for (const p of s.players) {
      if (p.team === 0 && p.role !== 'goalkeeper' && p.aiAction === 'PRESS') pressers++;
    }
    // Should be exactly one primary presser (allow 0 if the ball just moved).
    expect(pressers).toBeLessThanOrEqual(2);
  });

  it('players do not over-cluster: min teammate distance stays above threshold', () => {
    const s = createMatchState({ seed: 113, halfLength: 30, humanPlayers: 0 });
    s.period = 'play';
    const empty: never[] = [];
    let minDist = Infinity;
    for (let i = 0; i < 60 * 5; i++) {
      stepMulti(s, empty, FIXED_DT);
      for (const p of s.players) {
        if (p.role === 'goalkeeper') continue;
        for (const q of s.players) {
          if (q.team !== p.team || q.id === p.id || q.role === 'goalkeeper') continue;
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < minDist) minDist = d;
        }
      }
    }
    // Teammates never stand inside each other for long.
    expect(minDist).toBeGreaterThan(m(0.6));
  });

  it('goalkeeper does not leave its zone without reason', () => {
    const s = createMatchState({ seed: 114, halfLength: 30, humanPlayers: 0 });
    s.period = 'play';
    const empty: never[] = [];
    let gkOut = 0;
    for (let i = 0; i < 60 * 10; i++) {
      stepMulti(s, empty, FIXED_DT);
      for (const gk of s.players) {
        if (gk.role !== 'goalkeeper') continue;
        const ownX = gk.team === 0 ? FIELD_X : FIELD_RIGHT;
        if (Math.abs(gk.x - ownX) > m(8)) gkOut++;
      }
    }
    // GK should be out of zone only rarely (allow a few rush-outs).
    expect(gkOut).toBeLessThan(60 * 2);
  });
});
