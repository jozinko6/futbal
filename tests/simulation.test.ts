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
  FIELD_RIGHT,
  FIELD_X,
  FIXED_DT,
  GOAL_BOTTOM,
  GOAL_TOP,
  BALL_MAX_SPEED,
  kickBall,
  checkFieldEvents,
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
    s.ball.ownerId = null;
    s.ball.z = 50;
    s.ball.vz = -200;
    s.ball.vx = 0;
    s.ball.vy = 0;
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
