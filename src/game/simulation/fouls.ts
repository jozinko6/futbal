/**
 * Foul detection for slide/standing tackles.
 *
 * A foul occurs mainly when:
 *   - the tackler hits the opponent BEFORE the ball (ball not within reach), or
 *   - the tackle comes from behind (zozadu), or
 *   - the contact is dangerously forceful.
 *
 * A clean touch of the ball is NEVER a foul — even if the tackler then contacts
 * the opponent. We track the tick of first ball contact vs first player contact
 * on the sliding player to decide.
 */
import { m, TACKLE_RADIUS } from './constants';
import type { MatchState, PlayerEntity } from './types';
import { angleTo, dist } from './math';

/** Per-player transient contact tracking (stored on the entity via a map). */
interface ContactTrack {
  ballContactTick: number;   // first tick the slider touched the ball
  playerContactTick: number; // first tick the slider touched an opponent
  ballContacted: boolean;
  playerContacted: boolean;
}

const tracks = new WeakMap<PlayerEntity, ContactTrack>();

function track(p: PlayerEntity): ContactTrack {
  let t = tracks.get(p);
  if (!t) { t = { ballContactTick: -1, playerContactTick: -1, ballContacted: false, playerContacted: false }; tracks.set(p, t); }
  return t;
}

/** Reset a player's contact track when a tackle ends / starts. */
export function resetContactTrack(p: PlayerEntity): void {
  const t = track(p);
  t.ballContactTick = -1;
  t.playerContactTick = -1;
  t.ballContacted = false;
  t.playerContacted = false;
}

/** Record that a sliding/standing tackler touched the ball this tick. */
export function recordBallContact(p: PlayerEntity, tick: number): void {
  const t = track(p);
  if (!t.ballContacted) { t.ballContacted = true; t.ballContactTick = tick; }
}

/** Evaluate whether a contact between a tackler and an opponent is a foul.
 *  Returns the foul severity or null for a clean challenge. */
export function evaluateTackleFoul(
  state: MatchState,
  tackler: PlayerEntity,
  victim: PlayerEntity,
): { foul: boolean; fromBehind: boolean; ballFirst: boolean } {
  const t = track(tackler);
  const tick = state.tick;
  // Record player contact.
  if (!t.playerContacted) { t.playerContacted = true; t.playerContactTick = tick; }
  // Was the ball contacted first / at all?
  const ballFirst = t.ballContacted && (t.ballContactTick <= t.playerContactTick);
  // From behind: tackler approaches the victim from behind (victim facing
  // roughly toward the tackler's start, i.e. angle between victim facing and
  // direction TO tackler > 90°).
  const angToTackler = angleTo(victim.x, victim.y, tackler.x, tackler.y);
  const facingDiff = Math.abs(((angToTackler - victim.facing + Math.PI) % (Math.PI * 2)) - Math.PI);
  const fromBehind = facingDiff > Math.PI / 2;
  // Ball within reach of the tackler at contact? If not, it's a foul.
  const ballReachable = dist(tackler.x, tackler.y, state.ball.x, state.ball.y) <= TACKLE_RADIUS + m(0.2);
  // Foul conditions:
  //  - player hit before ball (ballFirst false and ball not reachable), OR
  //  - from behind (regardless of ball), OR
  //  - ball not reachable at all.
  let foul = false;
  if (fromBehind) foul = true;
  else if (!ballFirst && !ballReachable) foul = true;
  else if (!ballReachable && !t.ballContacted) foul = true;
  // Clean ball-first contact is NOT a foul.
  return { foul, fromBehind, ballFirst };
}
