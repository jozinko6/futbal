/**
 * Kačanovská FIFA — online multiplayer protocol.
 *
 * Architecture: an authoritative Node.js + Socket.IO server runs the
 * deterministic simulation from `@/game/simulation`. Clients send ONLY
 * timestamped, sequence-numbered inputs (never positions/score/time). The
 * server validates inputs, rate-limits them, advances the fixed-tick sim,
 * and broadcasts periodic snapshots (full on join/resync, delta otherwise).
 *
 * The client runs the same simulation locally for prediction + reconciliation
 * and interpolates remote entities from a snapshot buffer.
 *
 * NOTE: this sandbox exposes only the Next.js app on port 3000, so the live
 * 1v1 server is not wired into the preview. The types below are the contract
 * a real `apps/server` would implement against `packages/simulation`.
 */
import type { DeltaSnapshot, Difficulty, InputFrame, MatchState, Snapshot, Team } from '@/game/simulation';

/** A 6-digit room code. */
export type RoomCode = string;

export type ClientToServerMessages = {
  /** Create a new room; the creator chooses their team + match options. */
  createRoom: (payload: {
    difficulty: Difficulty;
    halfLength: number;
    team: Team;
  }) => { code: RoomCode };
  /** Join an existing room by code. */
  joinRoom: (payload: { code: RoomCode; team: Team }) => { ok: boolean; reason?: string };
  /** Mark self as ready in the lobby. */
  setReady: (payload: { ready: boolean }) => void;
  /** Select/switch team in the lobby. */
  selectTeam: (payload: { team: Team }) => void;
  /** Leave the room. */
  leaveRoom: () => void;
  /**
   * Submit an input frame. Rate-limited to INPUT_RATE. The server validates
   * the sequence number and rejects out-of-order/duplicate frames.
   */
  input: (payload: InputFrame) => void;
  /** Request a rematch from the results screen. */
  rematch: () => void;
  /** Ping for latency display. */
  ping: (payload: { t: number }) => { t: number };
};

export type ServerToClientMessages = {
  /** Room created — you are the host. */
  roomCreated: (payload: { code: RoomCode }) => void;
  /** Lobby state changed (players, teams, ready). */
  lobbyUpdate: (payload: LobbyState) => void;
  /** Synchronised countdown before kickoff (3..2..1). */
  countdown: (payload: { seconds: number }) => void;
  /** Match started — initial full snapshot + your controller index. */
  matchStart: (payload: { controllerIndex: number; snapshot: Snapshot }) => void;
  /** Periodic full snapshot (join / resync). */
  snapshot: (payload: Snapshot) => void;
  /** Delta snapshot (most ticks). */
  delta: (payload: DeltaSnapshot) => void;
  /** Reconciliation: last processed input seq for your controller. */
  ack: (payload: { controllerIndex: number; seq: number }) => void;
  /** Match ended. */
  matchEnd: (payload: { score: [number, number] }) => void;
  /** Connection quality update for the HUD. */
  netStatus: (payload: { pingMs: number; connected: boolean }) => void;
  /** Opponent disconnected — AI takes over; match preserved for grace period. */
  opponentDisconnected: (payload: { graceSeconds: number }) => void;
  /** Opponent reconnected. */
  opponentReconnected: () => void;
  /** Error. */
  error: (payload: { message: string }) => void;
  /** Pong. */
  pong: (payload: { t: number }) => void;
};

export interface LobbyPlayer {
  id: string;
  name: string;
  team: Team;
  ready: boolean;
  connected: boolean;
}

export interface LobbyState {
  code: RoomCode;
  players: LobbyPlayer[];
  difficulty: Difficulty;
  halfLength: number;
  hostId: string;
}

/**
 * Server-side authoritative match wrapper. The server owns one of these per
 * room and ticks it at FIXED_DT. Clients never instantiate this for online
 * play — they only run the sim locally for prediction.
 */
export interface AuthoritativeMatch {
  state: MatchState;
  /** Per-controller input queues (sequence-ordered, deduped). */
  inputQueues: InputFrame[][];
  /** Last acked seq per controller. */
  lastAckedSeq: number[];
  /** Accumulator for the fixed-timestep loop. */
  accumulator: number;
  /** Snapshot ring buffer for delta computation. */
  snapshotHistory: Snapshot[];
}

/** Validate an inbound input frame (server-side). Returns false to drop. */
export function isValidClientInput(
  frame: InputFrame,
  expectedSeq: number,
): boolean {
  if (!Number.isFinite(frame.seq)) return false;
  // Reject stale / duplicate / out-of-order frames.
  if (frame.seq < expectedSeq) return false;
  if (frame.seq > expectedSeq + 32) return false; // too far ahead — desync
  if (!Number.isFinite(frame.moveX) || !Number.isFinite(frame.moveY)) return false;
  if (Math.abs(frame.moveX) > 1 || Math.abs(frame.moveY) > 1) return false;
  return true;
}

/** Compute a delta snapshot between two full snapshots (simplified). */
export function buildDelta(prev: Snapshot, cur: Snapshot): DeltaSnapshot {
  return {
    tick: cur.tick,
    ball: {
      x: cur.ball.x,
      y: cur.ball.y,
      z: cur.ball.z,
      vx: cur.ball.vx,
      vy: cur.ball.vy,
      ownerId: cur.ball.ownerId,
    },
    players: cur.players.map((p) => ({ x: p.x, y: p.y, state: p.state, hasBall: p.hasBall })),
    score: cur.score,
    timeMs: cur.timeMs,
    period: cur.period,
    activePlayerId: cur.controllers[0]?.activeId ?? 0,
  };
}
