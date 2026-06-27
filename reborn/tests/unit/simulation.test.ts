import { describe, it, expect } from 'vitest';
import { createMatchState, step } from '../../src/game/simulation/match';
import { createEmptyInput } from '../../src/game/core/types';
import { FIXED_DT, FIELD_CX, FIELD_CY } from '../../src/game/core/tuning';
import { assertBallState } from '../../src/game/simulation/ownership';

describe('simulation core', () => {
  it('creates a match state with correct initial values', () => {
    const s = createMatchState({ seed: 42, format: '5v5' });
    expect(s.tick).toBe(0);
    expect(s.score).toEqual([0, 0]);
    expect(s.phase).toBe('KICKOFF');
    expect(s.players.length).toBe(10); // 5v5 = 5 per team
    expect(s.ball.mode).toBe('RESTART');
    expect(s.ball.x).toBe(FIELD_CX);
    expect(s.ball.y).toBe(FIELD_CY);
  });

  it('advances tick on each step', () => {
    const s = createMatchState({ seed: 1, format: '3v3' });
    const input = createEmptyInput(0);
    step(s, input, FIXED_DT);
    expect(s.tick).toBe(1);
    step(s, input, FIXED_DT);
    expect(s.tick).toBe(2);
  });

  it('transitions from KICKOFF to PLAYING', () => {
    const s = createMatchState({ seed: 1, format: '3v3' });
    const input = createEmptyInput(0);
    // KICKOFF delay is ~60 ticks (1s)
    for (let i = 0; i < 65; i++) step(s, input, FIXED_DT);
    expect(s.phase).toBe('PLAYING');
  });
});

describe('ball ownership', () => {
  it('CONTROLLED always has ownerId', () => {
    const s = createMatchState({ seed: 2, format: '3v3' });
    const input = createEmptyInput(0);
    for (let i = 0; i < 600; i++) {
      step(s, input, FIXED_DT);
      if (s.ball.mode === 'CONTROLLED' || s.ball.mode === 'GOALKEEPER_HELD') {
        expect(s.ball.ownerId).not.toBeNull();
      }
    }
  });

  it('FREE never has ownerId', () => {
    const s = createMatchState({ seed: 3, format: '3v3' });
    const input = createEmptyInput(0);
    for (let i = 0; i < 600; i++) {
      step(s, input, FIXED_DT);
      if (s.ball.mode === 'FREE' || s.ball.mode === 'PASS' || s.ball.mode === 'SHOT') {
        expect(s.ball.ownerId).toBeNull();
      }
    }
  });

  it('no invariant violations over 600 ticks', () => {
    const s = createMatchState({ seed: 4, format: '3v3' });
    s.debug = true;
    const input = createEmptyInput(0);
    let violations = 0;
    for (let i = 0; i < 600; i++) {
      step(s, input, FIXED_DT);
      const err = assertBallState(s);
      if (err) violations++;
    }
    expect(violations).toBe(0);
  });
});

describe('determinism', () => {
  it('same seed + inputs = same state', () => {
    const a = createMatchState({ seed: 100, format: '5v5' });
    const b = createMatchState({ seed: 100, format: '5v5' });
    const input = createEmptyInput(0);
    for (let i = 0; i < 300; i++) {
      step(a, input, FIXED_DT);
      step(b, input, FIXED_DT);
    }
    expect(a.tick).toBe(b.tick);
    expect(a.score).toEqual(b.score);
    expect(a.ball.x).toBe(b.ball.x);
    expect(a.ball.y).toBe(b.ball.y);
    expect(a.ball.ownerId).toBe(b.ball.ownerId);
  });
});

describe('formats', () => {
  it('3v3 has 6 players', () => {
    const s = createMatchState({ seed: 1, format: '3v3' });
    expect(s.players.length).toBe(6);
  });

  it('5v5 has 10 players', () => {
    const s = createMatchState({ seed: 1, format: '5v5' });
    expect(s.players.length).toBe(10);
  });

  it('7v7 has 14 players', () => {
    const s = createMatchState({ seed: 1, format: '7v7' });
    expect(s.players.length).toBe(14);
  });

  it('11v11 has 22 players', () => {
    const s = createMatchState({ seed: 1, format: '11v11' });
    expect(s.players.length).toBe(22);
  });
});
