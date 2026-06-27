import { describe, it, expect } from 'vitest';
import {
  createMatchState,
  step,
  FIXED_DT,
  emptyInput,
  m,
  FIELD_CX,
  FIELD_CY,
  FIELD_RIGHT,
  FIELD_X,
  pass,
  shoot,
  type InputFrame,
} from '@/game/simulation';
import { shouldAutoSwitch, findBestCandidate } from '@/game/simulation/playerSelection';

function press(input: Partial<InputFrame>): InputFrame {
  return { ...emptyInput(0), ...input };
}

describe('aftertouch', () => {
  it('starts aftertouch after a pass', () => {
    const s = createMatchState({ seed: 200, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX; p.y = FIELD_CY;
    p.facing = 0; p.stamina = 100;
    s.ball.ownerId = p.id; s.ball.mode = 'CONTROLLED';
    s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    pass(p, p.x + m(10), p.y, s, 'short');
    // Run until just after the contact tick (short pass windup ~5 ticks).
    for (let i = 0; i < 8; i++) step(s, emptyInput(0), FIXED_DT);
    // Aftertouch should be active right after the kick.
    expect(s.aftertouch).not.toBeNull();
    expect(s.aftertouch!.active).toBe(true);
    expect(s.aftertouch!.sourcePlayerId).toBe(p.id);
  });

  it('aftertouch expires after the time window', () => {
    const s = createMatchState({ seed: 201, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const p = s.players[3];
    p.x = FIELD_CX; p.y = FIELD_CY;
    p.facing = 0; p.stamina = 100;
    s.ball.ownerId = p.id; s.ball.mode = 'CONTROLLED';
    s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
    for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    pass(p, p.x + m(10), p.y, s, 'short');
    for (let i = 0; i < 30; i++) step(s, emptyInput(0), FIXED_DT);
    expect(s.aftertouch?.active).toBeFalsy();
  });

  it('zero input does not change trajectory', () => {
    const s1 = createMatchState({ seed: 202, halfLength: 60, humanPlayers: 0 });
    s1.period = 'play';
    const p1 = s1.players[3];
    p1.x = FIELD_CX; p1.y = FIELD_CY; p1.facing = 0; p1.stamina = 100;
    s1.ball.ownerId = p1.id; s1.ball.mode = 'CONTROLLED';
    s1.ball.x = p1.x; s1.ball.y = p1.y; s1.ball.z = 0;
    for (const o of s1.players) { if (o.id !== p1.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    pass(p1, p1.x + m(10), p1.y, s1, 'short');
    for (let i = 0; i < 20; i++) step(s1, emptyInput(0), FIXED_DT);
    const vyNoInput = s1.ball.vy;

    const s2 = createMatchState({ seed: 202, halfLength: 60, humanPlayers: 0 });
    s2.period = 'play';
    const p2 = s2.players[3];
    p2.x = FIELD_CX; p2.y = FIELD_CY; p2.facing = 0; p2.stamina = 100;
    s2.ball.ownerId = p2.id; s2.ball.mode = 'CONTROLLED';
    s2.ball.x = p2.x; s2.ball.y = p2.y; s2.ball.z = 0;
    for (const o of s2.players) { if (o.id !== p2.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
    pass(p2, p2.x + m(10), p2.y, s2, 'short');
    for (let i = 0; i < 20; i++) step(s2, press({ moveX: 0, moveY: 0 }), FIXED_DT);
    expect(Math.abs(s2.ball.vy - vyNoInput)).toBeLessThan(1);
  });

  it('deterministic: same seed + input = same trajectory', () => {
    const run = (moveX: number) => {
      const s = createMatchState({ seed: 203, halfLength: 60, humanPlayers: 1 });
      s.period = 'play';
      const p = s.players[s.controllers[0].activeId];
      p.x = FIELD_CX; p.y = FIELD_CY; p.facing = 0; p.stamina = 100;
      s.ball.ownerId = p.id; s.ball.mode = 'CONTROLLED';
      s.ball.x = p.x; s.ball.y = p.y; s.ball.z = 0;
      for (const o of s.players) { if (o.id !== p.id) { o.x = FIELD_X + 800; o.stunnedTime = 5; } }
      shoot(p, FIELD_RIGHT, FIELD_CY, 0.5, s, 'power');
      for (let i = 0; i < 30; i++) step(s, press({ moveX }), FIXED_DT);
      return { vx: s.ball.vx, vy: s.ball.vy, x: s.ball.x, y: s.ball.y };
    };
    const a = run(1);
    const b = run(1);
    expect(a.vx).toBe(b.vx);
    expect(a.vy).toBe(b.vy);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });
});

describe('player selection', () => {
  it('does not switch when current player has the ball', () => {
    const s = createMatchState({ seed: 210, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const p = s.players[3];
    s.ball.ownerId = p.id;
    s.ball.mode = 'CONTROLLED';
    p.hasBall = true; // sync manually since we're not stepping
    const result = shouldAutoSwitch(s, p.team, p.id);
    expect(result.switch).toBe(false);
  });

  it('does not select goalkeepers', () => {
    const s = createMatchState({ seed: 211, halfLength: 60, humanPlayers: 0 });
    s.period = 'play';
    const best = findBestCandidate(s, 0 as any, -1);
    if (best) {
      const selected = s.players[best.playerId];
      expect(selected.role).not.toBe('goalkeeper');
    }
  });
});
