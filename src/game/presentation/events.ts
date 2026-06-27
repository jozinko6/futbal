/**
 * PresentationEvent — clean data events emitted by the simulation.
 *
 * The simulation produces these as pure data; the presentation layer
 * (particles, audio, shake, replay) consumes them. Events are:
 *   - deterministically created (seeded RNG only)
 *   - part of the sim tick output
 *   - consumed once by the presentation layer
 *   - serialisable (safe for offline + online)
 *   - never modify MatchState
 *
 * The renderer/presentation MUST NOT decide when the ball is kicked — the
 * simulation's contact tick is the single source of truth.
 */
import type { Team } from '@/game/simulation';

export type PresentationEvent =
  | { type: 'BALL_KICKED'; tick: number; x: number; y: number; power: number; kickType: string }
  | { type: 'POST_HIT'; tick: number; x: number; y: number; speed: number }
  | { type: 'GOAL_SCORED'; tick: number; team: Team; x: number; y: number; speed: number }
  | { type: 'NET_HIT'; tick: number; x: number; y: number; speed: number }
  | { type: 'SLIDE_STARTED'; tick: number; playerId: number; x: number; y: number }
  | { type: 'TACKLE_CONTACT'; tick: number; x: number; y: number; clean: boolean }
  | { type: 'GK_SAVE'; tick: number; playerId: number; x: number; y: number; saveType: string; speed: number }
  | { type: 'WHISTLE'; tick: number; reason: string }
  | { type: 'MATCH_STARTED'; tick: number }
  | { type: 'MATCH_ENDED'; tick: number };

/** A queue of events produced during one sim step. */
export type PresentationEventQueue = PresentationEvent[];

/** Create a fresh queue. */
export function createEventQueue(): PresentationEventQueue {
  return [];
}

/** Emit an event into the queue (deterministic — no Math.random). */
export function emit(queue: PresentationEventQueue, ev: PresentationEvent): void {
  queue.push(ev);
}

/** Drain the queue (returns all events and clears it). Called by the presentation layer. */
export function drain(queue: PresentationEventQueue): PresentationEvent[] {
  const out = queue.splice(0, queue.length);
  return out;
}
