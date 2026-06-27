import { describe, it, expect } from 'vitest';
import {
  createMatchState,
  step,
  fixedStep,
  validateInput,
  emptyInput,
  BALL_FRICTION,
  FIELD_CX,
  FIELD_CY,
  FIELD_BOTTOM,
  FIELD_RIGHT,
  FIELD_TOP,
  FIELD_X,
  FIXED_DT,
  GOAL_BOTTOM,
  GOAL_TOP,
  BALL_MAX_SPEED,
  GK_HOLD_MAX,
  kickBall,
  checkFieldEvents,
  pass,
  isReceiverOffside,
  awardOffside,
  setupFreeKick,
  setupPenalty,
  awardFoul,
  tryTackle,
  type InputFrame,
  type MatchState,
} from '@/game/simulation';

function press(input: Partial<InputFrame>): InputFrame {
  return validateInput({ ...emptyInput(0), ...input });
}

/** Drive the match for N seconds at fixed dt with a constant input. */
function runFor(state: MatchState, seconds: number, input: InputFrame): MatchState {
  const ticks = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < ticks; i++) step(state, input, FIXED_DT);
  return state;
}

describe('input validation', () => {
  it('clamps movement to [-1, 1] and zeroes NaN', () => {
    const i = validateInput({ moveX: 5, moveY: -3, sprint: true });
    expect(i.moveX).toBe(1);
    expect(i.moveY).toBe(-1);
    expect(i.sprint).toBe(true);
  });
  it('applies a deadzone to tiny drift', () => {
    const i = validateInput({ moveX: 0.04, moveY: 0.03 });
    expect(i.moveX).toBe(0);
    expect(i.moveY).toBe(0);
  });
  it('treats missing fields as falsy/zero', () => {
    const i = validateInput({});
    expect(i.pass).toBe(false);
    expect(i.shootHeld).toBe(false);
    expect(i.seq).toBe(0);
  });
});

describe('ball physics at fixed timestep', () => {
  it('moves the ball by v*dt over one step', () => {
    const s = createMatchState({ seed: 1 });
    s.ball.ownerId = null;
    s.ball.x = FIELD_CX;
    s.ball.y = FIELD_CY;
    s.ball.vx = 200;
    s.ball.vy = 0;
    s.ball.z = 0;
    step(s, emptyInput(0), FIXED_DT);
    expect(s.ball.x).toBeCloseTo(FIELD_CX + 200 * FIXED_DT, 4);
  });

  it('caps ball speed at BALL_MAX_SPEED', () => {
    const s = createMatchState({ seed: 2 });
    s.ball.ownerId = null;
    kickBall(s.ball, 1, 0, BALL_MAX_SPEED * 4);
    const sp = Math.hypot(s.ball.vx, s.ball.vy);
    expect(sp).toBeLessThanOrEqual(BALL_MAX_SPEED + 1e-6);
  });

  it('applies ground friction each step', () => {
    const s = createMatchState({ seed: 3 });
    s.ball.ownerId = null;
    s.ball.z = 0;
    s.ball.vx = 300;
    s.ball.vy = 0;
    step(s, emptyInput(0), FIXED_DT);
    const expected = 300 - BALL_FRICTION * FIXED_DT;
    expect(s.ball.vx).toBeCloseTo(expected, 3);
  });

  it('bounces on the ground losing energy', () => {
    const s = createMatchState({ seed: 4 });
    s.period = 'play';
    s.ball.ownerId = null;
    // Place the ball far from any player so resolvePossession can't grab it
    // before the bounce is observed.
    s.ball.x = FIELD_X + 20;
    s.ball.y = FIELD_TOP + 20;
    s.ball.z = 50;
    s.ball.vz = -200;
    s.ball.vx = 0;
    s.ball.vy = 0;
    for (const p of s.players) {
      p.x = FIELD_RIGHT - 20;
      p.y = FIELD_BOTTOM - 20;
    }
    // Step until it hits the ground.
    let hit = false;
    for (let i = 0; i < 120; i++) {
      step(s, emptyInput(0), FIXED_DT);
      if (s.ball.z === 0 && s.ball.vz > 0) {
        hit = true;
        break;
      }
    }
    expect(hit).toBe(true);
    expect(s.ball.vz).toBeGreaterThan(0);
    expect(s.ball.vz).toBeLessThan(200); // lost energy
  });
});

describe('field boundaries & goals', () => {
  it('detects a goal when the ball crosses the goal line between posts', () => {
    const s = createMatchState({ seed: 10 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_X + 6;
    s.ball.y = FIELD_CY;
    s.ball.z = 0;
    s.ball.vx = -400; // heading into the home goal (away scores)
    s.ball.vy = 0;
    s.lastTouchTeam = 1;
    // Run until the ball is well past the line.
    runFor(s, 0.2, emptyInput(0));
    expect(s.score[1]).toBe(1);
    expect(s.period).toBe('goal');
  });

  it('does NOT score when the ball is above the crossbar', () => {
    const s = createMatchState({ seed: 11 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_X + 6;
    s.ball.y = FIELD_CY;
    s.ball.z = 60; // above crossbar
    s.ball.vz = 0;
    s.ball.vx = -400;
    s.ball.vy = 0;
    s.lastTouchTeam = 1;
    runFor(s, 0.2, emptyInput(0));
    expect(s.score[1]).toBe(0);
  });

  it('awards a goal kick when the attacker puts the ball out past the goal line', () => {
    const s = createMatchState({ seed: 12 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_X + 6;
    s.ball.y = GOAL_TOP - 30; // outside the posts, above
    s.ball.z = 0;
    s.ball.vx = -400;
    s.ball.vy = 0;
    s.lastTouchTeam = 1; // attacker (away) touched last -> goal kick to home
    runFor(s, 0.2, emptyInput(0));
    expect(s.score).toEqual([0, 0]);
    // Ball repositioned near the goal area for the goal kick.
    expect(s.ball.x).toBeGreaterThan(FIELD_X);
  });

  it('flags a throw-in for the opposite team when the ball crosses a side line', () => {
    const s = createMatchState({ seed: 13 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_CX;
    s.ball.y = 30; // above FIELD_TOP (44)
    s.ball.vx = 0;
    s.ball.vy = -10;
    s.lastTouchTeam = 0; // home touched last -> throw to away
    const ev = checkFieldEvents(s);
    expect(ev.type).toBe('throwIn');
    if (ev.type === 'throwIn') expect(ev.team).toBe(1);
  });

  it('flags a corner when a defender puts the ball out past their own goal line', () => {
    const s = createMatchState({ seed: 14 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_X - 10;
    s.ball.y = GOAL_TOP - 40; // outside the posts
    s.ball.z = 0;
    s.lastTouchTeam = 0; // home (defending left goal) put it out -> corner to away
    const ev = checkFieldEvents(s);
    expect(ev.type).toBe('corner');
    if (ev.type === 'corner') expect(ev.team).toBe(1);
  });
});

describe('match state transitions', () => {
  it('transitions from kickoff to play after the delay', () => {
    const s = createMatchState({ seed: 20, halfLength: 30 });
    expect(s.period).toBe('kickoff');
    runFor(s, 2, emptyInput(0));
    expect(s.period).toBe('play');
  });

  it('reaches halftime then fulltime', () => {
    const s = createMatchState({ seed: 21, halfLength: 30 });
    runFor(s, 2, emptyInput(0)); // kickoff -> play
    // Run wall-clock until the second half begins (goals pause the match clock
    // so allow generous wall time).
    let half2 = false;
    for (let i = 0; i < 6000 && !half2; i++) {
      step(s, emptyInput(0), FIXED_DT);
      if (s.half === 2) half2 = true;
    }
    expect(half2).toBe(true);
    // Run until fulltime.
    let full = false;
    for (let i = 0; i < 6000 && !full; i++) {
      step(s, emptyInput(0), FIXED_DT);
      if (s.period === 'fulltime') full = true;
    }
    expect(full).toBe(true);
  });
});

describe('reset after a goal', () => {
  it('returns to kickoff with the ball centred after a goal', () => {
    const s = createMatchState({ seed: 30 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_X + 4;
    s.ball.y = FIELD_CY;
    s.ball.z = 0;
    s.ball.vx = -600;
    s.lastTouchTeam = 1;
    runFor(s, 0.2, emptyInput(0));
    expect(s.period).toBe('goal');
    // Step tick-by-tick and capture the exact moment the kickoff is set up
    // (before any gameplay can move the ball away from centre).
    let centred = false;
    for (let i = 0; i < 600; i++) {
      const before = s.period as string;
      step(s, emptyInput(0), FIXED_DT);
      if (before === 'goal' && (s.period as string) === 'kickoff') {
        expect(s.ball.x).toBeCloseTo(FIELD_CX, 1);
        expect(s.ball.y).toBeCloseTo(FIELD_CY, 1);
        centred = true;
        break;
      }
    }
    expect(centred).toBe(true);
  });
});

describe('determinism', () => {
  it('produces identical state from identical inputs & seed', () => {
    const make = () => createMatchState({ seed: 99, halfLength: 60 });
    const a = make();
    const b = make();
    const inputs: InputFrame[] = [];
    for (let i = 0; i < 300; i++) {
      const inp = press({
        seq: i,
        moveX: Math.sin(i * 0.3),
        moveY: Math.cos(i * 0.2),
        sprint: i % 5 === 0,
        shootHeld: i % 7 < 3,
      });
      inputs.push(inp);
    }
    for (const inp of inputs) {
      step(a, inp, FIXED_DT);
      step(b, inp, FIXED_DT);
    }
    // Compare a representative slice of state.
    expect(a.tick).toBe(b.tick);
    expect(a.score).toEqual(b.score);
    expect(a.ball.x).toBe(b.ball.x);
    expect(a.ball.y).toBe(b.ball.y);
    expect(a.players.map((p) => [p.x, p.y])).toEqual(b.players.map((p) => [p.x, p.y]));
    expect(a.rngState).toBe(b.rngState);
  });

  it('fixedStep matches step with FIXED_DT', () => {
    const a = createMatchState({ seed: 7 });
    const b = createMatchState({ seed: 7 });
    const inp = press({ moveX: 1, sprint: true });
    for (let i = 0; i < 60; i++) {
      step(a, inp, FIXED_DT);
      fixedStep(b, inp);
    }
    expect(a.ball.x).toBe(b.ball.x);
    expect(a.tick).toBe(b.tick);
  });
});

describe('offside', () => {
  it('flags a receiver past the second-last defender as offside', () => {
    const s = createMatchState({ seed: 42 });
    s.period = 'play';
    // Passer near halfway with the ball.
    const passer = s.players[4]; // home FWD
    passer.x = FIELD_CX + 10;
    passer.y = FIELD_CY;
    passer.hasBall = true;
    s.ball.ownerId = passer.id;
    s.ball.x = passer.x;
    s.ball.y = passer.y;
    // Receiver deep in the away half.
    const receiver = s.players[3]; // home MID
    receiver.x = FIELD_RIGHT - 120;
    receiver.y = FIELD_CY;
    // Away non-GK defenders shallow; away GK deep (nearest goal).
    for (const p of s.players) {
      if (p.team === 1 && p.role !== 'GK') {
        p.x = FIELD_CX + 200;
        p.y = FIELD_CY + 180;
      }
    }
    // Passing records the offside snapshot.
    pass(passer, receiver.x, receiver.y, s, false);
    expect(s.offsideCheck).not.toBeNull();
    // Judge the receiver directly against the snapshot.
    expect(isReceiverOffside(s, receiver)).toBe(true);
    // Award -> indirect free kick to the away team at the receiver's spot.
    awardOffside(s, receiver.x, receiver.y);
    expect(s.offsides[0]).toBe(1);
    expect(s.banner).toBe('OFSAJD');
    expect(s.restartType).toBe('freeKick');
    expect(s.restartTeam).toBe(1);
    // The check is consumed after the award.
    expect(s.offsideCheck).toBeNull();
  });

  it('does NOT flag a receiver level with or behind the passer', () => {
    const s = createMatchState({ seed: 43 });
    s.period = 'play';
    const passer = s.players[4];
    passer.x = FIELD_CX + 10;
    passer.y = FIELD_CY;
    passer.hasBall = true;
    s.ball.ownerId = passer.id;
    const receiver = s.players[3];
    receiver.x = FIELD_CX + 5; // behind the passer
    receiver.y = FIELD_CY;
    for (const p of s.players) {
      if (p.team === 1 && p.role !== 'GK') {
        p.x = FIELD_CX + 300;
        p.y = FIELD_CY;
      }
    }
    pass(passer, receiver.x, receiver.y, s, false);
    expect(isReceiverOffside(s, receiver)).toBe(false);
  });

  it('does NOT flag a receiver in their own half', () => {
    const s = createMatchState({ seed: 44 });
    s.period = 'play';
    const passer = s.players[4];
    passer.x = FIELD_CX - 20; // passer in own half
    passer.y = FIELD_CY;
    passer.hasBall = true;
    s.ball.ownerId = passer.id;
    const receiver = s.players[3];
    receiver.x = FIELD_CX - 60; // receiver also in own half
    receiver.y = FIELD_CY;
    pass(passer, receiver.x, receiver.y, s, false);
    expect(isReceiverOffside(s, receiver)).toBe(false);
  });
});

describe('restarts with possession shield', () => {
  it('gives the restart team a shield on throw-in', () => {
    const s = createMatchState({ seed: 50 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.x = FIELD_CX;
    s.ball.y = 20; // well above FIELD_TOP (44)
    s.ball.vx = 0;
    s.ball.vy = 0;
    s.ball.z = 0;
    s.lastTouchTeam = 0; // home put it out -> throw to away
    // Move players away from the ball so AI doesn't interfere.
    for (const p of s.players) {
      p.x = FIELD_X + 20;
      p.y = FIELD_BOTTOM - 20;
    }
    step(s, emptyInput(0), FIXED_DT);
    // Throw-in awarded to away (team 1) with a shield protecting them.
    expect(s.restartType).toBe('throwIn');
    expect(s.restartTeam).toBe(1);
    expect(s.ball.possessionShield).toBeGreaterThan(0);
    expect(s.ball.shieldTeam).toBe(1);
  });

  it('gives the restart team a shield on corner', () => {
    const s = createMatchState({ seed: 51 });
    s.period = 'play';
    s.ball.ownerId = null;
    // Ball out past the left goal line (home's goal), y between posts but
    // ABOVE the goal mouth so it's a corner, not a goal.
    s.ball.x = FIELD_X - 30;
    s.ball.y = GOAL_TOP - 30;
    s.ball.z = 0;
    s.ball.vx = 0;
    s.ball.vy = 0;
    s.lastTouchTeam = 0; // home defender put it out -> corner to away
    for (const p of s.players) {
      p.x = FIELD_RIGHT - 20;
      p.y = FIELD_BOTTOM - 20;
    }
    step(s, emptyInput(0), FIXED_DT);
    expect(s.restartType).toBe('corner');
    expect(s.restartTeam).toBe(1);
    expect(s.ball.possessionShield).toBeGreaterThan(0);
    expect(s.ball.shieldTeam).toBe(1);
  });

  it('opponents cannot steal the ball while the shield is active', () => {
    const s = createMatchState({ seed: 52 });
    s.period = 'play';
    // Simulate a shielded throw-in for team 1.
    s.ball.ownerId = null;
    s.ball.x = FIELD_CX;
    s.ball.y = FIELD_TOP + 6;
    s.ball.possessionShield = 1.4;
    s.ball.shieldTeam = 1;
    s.ball.releaseCooldown = 0;
    // Place a home player right on the ball.
    const home = s.players[3];
    home.team = 0;
    home.x = s.ball.x;
    home.y = s.ball.y;
    home.stunnedTime = 0;
    // Place an away player nearby too.
    const away = s.players[8];
    away.team = 1;
    away.x = s.ball.x + 10;
    away.y = s.ball.y;
    away.stunnedTime = 0;
    step(s, emptyInput(0), FIXED_DT);
    // Shield blocks the home player; only away may gain possession.
    expect(s.ball.ownerId).not.toBe(home.id);
  });
});

describe('free kicks & penalties', () => {
  it('setupFreeKick places the ball and sets the indirect flag', () => {
    const s = createMatchState({ seed: 60 });
    s.period = 'play';
    setupFreeKick(s, 1 as Team, FIELD_CX + 50, FIELD_CY, true);
    expect(s.restartType).toBe('freeKick');
    expect(s.restartTeam).toBe(1);
    expect(s.ball.indirect).toBe(true);
    expect(s.ball.possessionShield).toBeGreaterThan(0);
    expect(s.ball.shieldTeam).toBe(1);
  });

  it('indirect free kick cannot score directly (goal kick instead)', () => {
    const s = createMatchState({ seed: 61 });
    s.period = 'play';
    s.ball.ownerId = null;
    s.ball.indirect = true;
    s.ball.x = FIELD_X + 6;
    s.ball.y = FIELD_CY;
    s.ball.z = 0;
    s.ball.vx = -400;
    s.ball.vy = 0;
    s.lastTouchTeam = 1;
    for (const p of s.players) {
      p.x = FIELD_RIGHT - 20;
      p.y = FIELD_BOTTOM - 20;
    }
    // Run until the ball crosses the goal line.
    runFor(s, 0.2, emptyInput(0));
    expect(s.score[1]).toBe(0);
    expect(s.restartType).toBe('goalKick');
    expect(s.ball.indirect).toBe(false);
  });

  it('setupPenalty places the ball on the penalty spot', () => {
    const s = createMatchState({ seed: 62 });
    s.period = 'play';
    setupPenalty(s, 0 as Team); // home attacks right
    expect(s.restartType).toBe('penalty');
    expect(s.restartTeam).toBe(0);
    // Home takes the penalty at the right penalty spot (near opp goal).
    expect(s.ball.x).toBeCloseTo(FIELD_RIGHT - 96, 0);
    expect(s.ball.y).toBeCloseTo(FIELD_CY, 0);
  });

  it('awardFoul gives a penalty for a foul inside the box', () => {
    const s = createMatchState({ seed: 63 });
    s.period = 'play';
    // Foul by home (team 0) inside their own box (left).
    const isPen = awardFoul(s, 0 as Team, FIELD_X + 40, FIELD_CY);
    expect(isPen).toBe(true);
    expect(s.restartType).toBe('penalty');
    expect(s.restartTeam).toBe(1); // away gets the penalty
  });

  it('awardFoul gives a direct free kick outside the box', () => {
    const s = createMatchState({ seed: 64 });
    s.period = 'play';
    const isPen = awardFoul(s, 0 as Team, FIELD_CX, FIELD_CY);
    expect(isPen).toBe(false);
    expect(s.restartType).toBe('freeKick');
    expect(s.restartTeam).toBe(1);
    expect(s.ball.indirect).toBe(false); // direct
  });
});

describe('goalkeeper possession', () => {
  it('outfield players cannot dispossess a goalkeeper', () => {
    const s = createMatchState({ seed: 65 });
    s.period = 'play';
    const gk = s.players.find((p) => p.role === 'GK' && p.team === 0)!;
    gk.x = FIELD_X + 60;
    gk.y = FIELD_CY;
    s.ball.ownerId = gk.id;
    s.ball.x = gk.x;
    s.ball.y = gk.y;
    s.ball.possessionShield = 0;
    s.ball.shieldTeam = null;
    s.ball.releaseCooldown = 0;
    const opp = s.players.find((p) => p.team === 1 && p.role !== 'GK')!;
    opp.x = gk.x + 4;
    opp.y = gk.y;
    // tryTackle should fail against a GK owner.
    const won = tryTackle(opp, s);
    expect(won).toBe(false);
    expect(s.ball.ownerId).toBe(gk.id);
  });

  it('goalkeeper is forced to release after GK_HOLD_MAX seconds', () => {
    const s = createMatchState({ seed: 66 });
    s.period = 'play';
    const gk = s.players.find((p) => p.role === 'GK' && p.team === 0)!;
    gk.x = FIELD_X + 60;
    gk.y = FIELD_CY;
    s.ball.ownerId = gk.id;
    s.ball.x = gk.x;
    s.ball.y = gk.y;
    s.ball.gkHoldTime = 0;
    s.ball.possessionShield = 0;
    s.ball.shieldTeam = null;
    // Run past the hold limit.
    runFor(s, GK_HOLD_MAX + 0.3, emptyInput(0));
    // Should have triggered a goal kick turnover to the away team.
    expect(s.restartType).toBe('goalKick');
    expect(s.restartTeam).toBe(1);
  });
});

describe('penalty shootout', () => {
  it('starts a shootout after a tied fulltime and produces a winner', () => {
    const s = createMatchState({ seed: 67, halfLength: 4 });
    s.period = 'play';
    s.half = 2;
    s.timeMs = 0;
    s.score = [1, 1];
    // Run until the half ends (4s) — tied -> shootout.
    let started = false;
    for (let i = 0; i < 2000; i++) {
      step(s, emptyInput(0), FIXED_DT);
      if (s.period === 'penalties') { started = true; break; }
    }
    expect(started).toBe(true);
    // Run the shootout to completion.
    let finished = false;
    for (let i = 0; i < 4000; i++) {
      step(s, emptyInput(0), FIXED_DT);
      if (s.period === 'fulltime') { finished = true; break; }
    }
    expect(finished).toBe(true);
    // A winner was decided (scores differ).
    expect(s.score[0]).not.toBe(s.score[1]);
  });
});
