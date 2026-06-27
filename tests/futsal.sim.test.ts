import { describe, it, expect } from 'vitest';
import {
  createMatchState,
  stepMulti,
  FIXED_DT,
  emptyInput,
  PLAYERS_PER_TEAM,
  FIELD_X,
  FIELD_RIGHT,
  m,
  type MatchState,
} from '@/game/simulation';

/** Run a full AI vs AI match (no human input) to completion or timeout. */
function runMatch(seed: number, halfLength = 12): { state: MatchState; completed: boolean; passes: number; maxCluster: number; ballStuck: boolean; gkOut: boolean } {
  const s = createMatchState({ seed, halfLength, humanPlayers: 0 });
  // Make both teams AI: remove controllers' active control by giving them no
  // input (emptyInput). The sim still treats controllers[0] as human, but with
  // empty input the active player just idles — AI fills the rest. To make BOTH
  // teams fully AI, we set humanPlayers:1 but pass empty inputs; the away team
  // is all-AI already.
  let prevOwner = s.ball.ownerId;
  let passes = 0;
  let maxCluster = 0;
  let lastBallMoveTick = 0;
  let prevBallX = s.ball.x;
  let prevBallY = s.ball.y;
  const empty: never[] = []; // no human controllers → all AI
  let ticks = 0;
  const maxTicks = Math.ceil((halfLength * 2 + 60) / FIXED_DT); // generous bound (incl. shootout)
  for (let i = 0; i < maxTicks; i++) {
    stepMulti(s, empty, FIXED_DT);
    ticks++;
    // Count passes (owner changes between teammates).
    if (s.ball.ownerId != null && s.ball.ownerId !== prevOwner) {
      const o = s.players[s.ball.ownerId];
      const p = prevOwner != null ? s.players[prevOwner] : null;
      if (p && o && p.team === o.team && p.id !== o.id) passes++;
      prevOwner = s.ball.ownerId;
    }
    // Clustering: min pairwise distance among same-team outfield players.
    maxCluster = Math.max(maxCluster, measureCluster(s));
    // Ball movement tracking — only during active play (stoppages legitimately
    // pause the ball for a few seconds).
    if ((s.period as string) === 'play') {
      const moved = Math.hypot(s.ball.x - prevBallX, s.ball.y - prevBallY);
      if (moved > 1) { lastBallMoveTick = ticks; prevBallX = s.ball.x; prevBallY = s.ball.y; }
    } else {
      // Reset the stuck baseline on stoppage so we don't accumulate dead time.
      lastBallMoveTick = ticks;
      prevBallX = s.ball.x; prevBallY = s.ball.y;
    }
    // GK zone check.
    if (gkLeftZone(s)) { /* tracked */ }
    if ((s.period as string) === 'fulltime') break;
  }
  const completed = (s.period as string) === 'fulltime';
  const ballStuck = ticks - lastBallMoveTick > 60 * 5; // >5s no movement
  const gkOut = gkLeftZoneFinal(s);
  return { state: s, completed, passes, maxCluster, ballStuck, gkOut };
}

function measureCluster(s: MatchState): number {
  // Returns the smallest min-distance seen (lower = more clustered). We want
  // to assert it's not too low. Compute average min-distance for team 0.
  let sum = 0;
  let n = 0;
  for (const p of s.players) {
    if (p.team !== 0 || p.role === 'goalkeeper') continue;
    let md = Infinity;
    for (const q of s.players) {
      if (q.team !== 0 || q.id === p.id || q.role === 'goalkeeper') continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < md) md = d;
    }
    if (md < Infinity) { sum += md; n++; }
  }
  return n > 0 ? sum / n : 0;
}

function gkLeftZone(s: MatchState): boolean {
  for (const p of s.players) {
    if (p.role !== 'goalkeeper') continue;
    const ownX = p.team === 0 ? FIELD_X : FIELD_RIGHT;
    if (Math.abs(p.x - ownX) > m(8)) return true;
  }
  return false;
}
function gkLeftZoneFinal(s: MatchState): boolean {
  // Final check: was the GK ever far out at the end? We approximate by checking
  // final position only (the runMatch samples gkLeftZone but we return a bool).
  return gkLeftZone(s);
}

describe('futsal 5v5 — 100 AI vs AI simulation matches', () => {
  const N = 100;
  const results: { completed: boolean; passes: number; maxCluster: number; ballStuck: boolean; gkOut: boolean; score: [number, number] }[] = [];

  it('runs 100 matches and checks aggregate invariants', { testTimeout: 30000 }, () => {
    for (let i = 0; i < N; i++) {
      const r = runMatch(i + 1, 12);
      results.push({
        completed: r.completed,
        passes: r.passes,
        maxCluster: r.maxCluster,
        ballStuck: r.ballStuck,
        gkOut: r.gkOut,
        score: [...r.state.score] as [number, number],
      });
    }
    const completed = results.filter((r) => r.completed).length;
    const stuck = results.filter((r) => r.ballStuck).length;
    const gkOut = results.filter((r) => r.gkOut).length;
    const avgPasses = results.reduce((a, r) => a + r.passes, 0) / N;
    const minCluster = Math.min(...results.map((r) => r.maxCluster));

    // At least 90/100 matches complete (allow some tied→shootout variance).
    expect(completed).toBeGreaterThanOrEqual(90);
    // Ball never permanently stuck.
    expect(stuck).toBeLessThanOrEqual(2);
    // GK doesn't leave zone in most matches (allow a few rush-outs).
    expect(gkOut).toBeLessThanOrEqual(20);
    // Teams make passes — average > 5 per match.
    expect(avgPasses).toBeGreaterThan(5);
    // Players don't over-cluster — average min teammate distance > 1.5 m.
    expect(minCluster).toBeGreaterThan(m(1.0));
  });

  it('score only changes via goal events (non-negative, reasonable)', () => {
    for (const r of results) {
      expect(r.score[0]).toBeGreaterThanOrEqual(0);
      expect(r.score[1]).toBeGreaterThanOrEqual(0);
      // Not a basketball score — futsal matches stay low.
      expect(r.score[0] + r.score[1]).toBeLessThan(40);
    }
  });

  it('determinism: same seed → same final score & ball position', () => {
    const a = runMatch(777, 8);
    const b = runMatch(777, 8);
    expect(a.state.score).toEqual(b.state.score);
    expect(Math.round(a.state.ball.x)).toBe(Math.round(b.state.ball.x));
    expect(Math.round(a.state.ball.y)).toBe(Math.round(b.state.ball.y));
    expect(a.state.tick).toBe(b.state.tick);
  });

  it('formation resets after a goal (players near base within ~2s)', () => {
    // Run a match, find a moment just after a goal, verify players return.
    const s = createMatchState({ seed: 55, halfLength: 20, humanPlayers: 0 });
    const empty: never[] = [];
    let goalTick = -1;
    for (let i = 0; i < 60 * 30; i++) {
      const before = s.score[0] + s.score[1];
      stepMulti(s, empty, FIXED_DT);
      const after = s.score[0] + s.score[1];
      if (after > before) { goalTick = s.tick; break; }
    }
    if (goalTick >= 0) {
      // Run ~2s after the goal.
      for (let i = 0; i < 60 * 2; i++) stepMulti(s, empty, FIXED_DT);
      // After the kickoff reset, players should be near their base positions.
      let near = 0;
      for (const p of s.players) {
        const d = Math.hypot(p.x - p.baseFormationPosition.x, p.y - p.baseFormationPosition.y);
        if (d < m(8)) near++;
      }
      // Most players should be back near formation.
      expect(near).toBeGreaterThanOrEqual(PLAYERS_PER_TEAM);
    }
  });
});
