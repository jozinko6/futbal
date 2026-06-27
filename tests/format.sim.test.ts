import { describe, it, expect } from 'vitest';
import {
  createMatchState,
  stepMulti,
  FIXED_DT,
  emptyInput,
  type MatchState,
} from '@/game/simulation';

/** Run a full AI vs AI match with given format. */
function runMatch(seed: number, format: '5v5' | '7v7' | '11v11', halfLength = 12): {
  state: MatchState; completed: boolean; passes: number; goals: number; ballStuck: boolean;
} {
  const s = createMatchState({ seed, halfLength, humanPlayers: 0, matchFormat: format });
  let prevOwner = s.ball.ownerId;
  let passes = 0;
  let lastBallMoveTick = 0;
  let prevBallX = s.ball.x;
  let prevBallY = s.ball.y;
  const empty: never[] = [];
  let ticks = 0;
  const maxTicks = Math.ceil((halfLength * 2 + 60) / FIXED_DT);
  for (let i = 0; i < maxTicks; i++) {
    stepMulti(s, empty, FIXED_DT);
    ticks++;
    if (s.ball.ownerId != null && s.ball.ownerId !== prevOwner) {
      const o = s.players[s.ball.ownerId];
      const p = prevOwner != null ? s.players[prevOwner] : null;
      if (p && o && p.team === o.team && p.id !== o.id) passes++;
      prevOwner = s.ball.ownerId;
    }
    if ((s.period as string) === 'play') {
      const moved = Math.hypot(s.ball.x - prevBallX, s.ball.y - prevBallY);
      if (moved > 1) { lastBallMoveTick = ticks; prevBallX = s.ball.x; prevBallY = s.ball.y; }
    } else {
      lastBallMoveTick = ticks; prevBallX = s.ball.x; prevBallY = s.ball.y;
    }
    if ((s.period as string) === 'fulltime') break;
  }
  const completed = (s.period as string) === 'fulltime';
  const ballStuck = ticks - lastBallMoveTick > 60 * 5;
  return { state: s, completed, passes, goals: s.score[0] + s.score[1], ballStuck };
}

describe('7v7 simulation', () => {
  it('runs 20 matches and checks invariants', { timeout: 30000 }, () => {
    let completed = 0, stuck = 0, totalPasses = 0, totalGoals = 0;
    for (let i = 0; i < 20; i++) {
      const r = runMatch(i + 1, '7v7');
      if (r.completed) completed++;
      if (r.ballStuck) stuck++;
      totalPasses += r.passes;
      totalGoals += r.goals;
    }
    expect(completed).toBeGreaterThanOrEqual(16);
    expect(stuck).toBeLessThanOrEqual(2);
    expect(totalPasses / 20).toBeGreaterThan(3);
    expect(totalGoals / 20).toBeLessThan(40);
  });

  it('deterministic: same seed = same result', () => {
    const a = runMatch(77, '7v7', 8);
    const b = runMatch(77, '7v7', 8);
    expect(a.state.score).toEqual(b.state.score);
    expect(a.state.tick).toBe(b.state.tick);
  });
});

describe('11v11 simulation', () => {
  it('runs 20 matches and checks invariants', { timeout: 30000 }, () => {
    let completed = 0, stuck = 0, totalPasses = 0, totalGoals = 0;
    for (let i = 0; i < 20; i++) {
      const r = runMatch(i + 1, '11v11');
      if (r.completed) completed++;
      if (r.ballStuck) stuck++;
      totalPasses += r.passes;
      totalGoals += r.goals;
    }
    expect(completed).toBeGreaterThanOrEqual(16);
    expect(stuck).toBeLessThanOrEqual(2);
    expect(totalPasses / 20).toBeGreaterThan(3);
    expect(totalGoals / 20).toBeLessThan(40);
  });

  it('deterministic: same seed = same result', () => {
    const a = runMatch(88, '11v11', 8);
    const b = runMatch(88, '11v11', 8);
    expect(a.state.score).toEqual(b.state.score);
    expect(a.state.tick).toBe(b.state.tick);
  });

  it('22 players on the pitch', () => {
    const s = createMatchState({ seed: 99, humanPlayers: 0, matchFormat: '11v11' });
    expect(s.players.length).toBe(22);
    const team0 = s.players.filter((p) => p.team === 0).length;
    const team1 = s.players.filter((p) => p.team === 1).length;
    expect(team0).toBe(11);
    expect(team1).toBe(11);
  });
});
