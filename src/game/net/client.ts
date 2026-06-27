/**
 * Kačanovská FIFA — client-side network layer.
 *
 * Connects to the authoritative Socket.IO game server (mini-service on port
 * 3003, reached via the Caddy gateway query param `XTransformPort`). The
 * client runs the same deterministic simulation locally for prediction of the
 * player's own controller, and interpolates remote entities from the server's
 * snapshot stream.
 *
 * The client sends ONLY timestamped, sequence-numbered InputFrames — never
 * positions/score/time. The server is authoritative.
 */
import { io, type Socket } from 'socket.io-client';
import {
  emptyInput,
  stepMulti,
  validateInput,
  FIXED_DT,
  INTERP_DELAY,
  type Difficulty,
  type InputFrame,
  type MatchState,
  type Team,
} from '@/game/simulation';

export interface LobbyPlayerView {
  id: string;
  name: string;
  team: Team;
  ready: boolean;
  connected: boolean;
}
export interface LobbyStateView {
  code: string;
  players: LobbyPlayerView[];
  difficulty: Difficulty;
  halfLength: number;
  hostId: string;
}

export interface NetStatus {
  connected: boolean;
  pingMs: number;
}

interface SnapshotSample {
  receivedAt: number; // performance.now()
  state: MatchState;
}

const SERVER_PORT = 3003;

/** Configuration for an online match session. */
export interface OnlineSessionConfig {
  difficulty: Difficulty;
  halfLength: number;
  team: Team;
  name?: string;
}

export class NetClient {
  socket: Socket;
  code = '';
  controllerIndex = 0;
  state: MatchState | null = null;
  /** Buffer of recent snapshots for interpolation of remote entities. */
  private snapshots: SnapshotSample[] = [];
  /** Last acked input seq from the server (for reconciliation). */
  lastAckedSeq = 0;
  /** Local input seq counter. */
  private nextSeq = 1;
  /** Pending inputs not yet acked (for prediction replay). */
  private pending: InputFrame[] = [];
  /** Last time we sent an input (rate limiting). */
  private lastInputAt = 0;

  // Callbacks the UI subscribes to.
  onLobby: ((s: LobbyStateView) => void) | null = null;
  onCountdown: ((secs: number) => void) | null = null;
  onMatchStart: ((controllerIndex: number, snapshot: MatchState) => void) | null = null;
  onMatchEnd: ((score: [number, number]) => void) | null = null;
  onNetStatus: ((n: NetStatus) => void) | null = null;
  onOpponentDisconnected: ((grace: number) => void) | null = null;
  onOpponentReconnected: (() => void) | null = null;
  onError: ((msg: string) => void) | null = null;
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;

  constructor() {
    // The Caddy gateway forwards /?XTransformPort=3003 to our game server.
    this.socket = io(`/?XTransformPort=${SERVER_PORT}`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });
    this.wire();
  }

  private wire() {
    this.socket.on('connect', () => this.onConnect?.());
    this.socket.on('disconnect', () => this.onDisconnect?.());

    this.socket.on('roomCreated', (p: { code: string }) => {
      this.code = p.code;
    });
    this.socket.on('lobbyUpdate', (s: LobbyStateView) => this.onLobby?.(s));
    this.socket.on('countdown', (p: { seconds: number }) => this.onCountdown?.(p.seconds));
    this.socket.on('matchStart', (p: { controllerIndex: number; snapshot: MatchState }) => {
      this.controllerIndex = p.controllerIndex;
      this.state = p.snapshot;
      this.snapshots = [{ receivedAt: performance.now(), state: p.snapshot }];
      this.lastAckedSeq = 0;
      this.nextSeq = 1;
      this.pending = [];
      this.onMatchStart?.(p.controllerIndex, p.snapshot);
    });
    this.socket.on('snapshot', (s: MatchState) => {
      this.state = s;
      this.snapshots.push({ receivedAt: performance.now(), state: s });
      if (this.snapshots.length > 12) this.snapshots.shift();
      // Reconciliation: drop acked inputs, replay the rest.
      this.reconcile();
    });
    this.socket.on('delta', (d: Partial<MatchState> & { ball?: Partial<MatchState['ball']> }) => {
      if (!this.state) return;
      // Apply a simplified delta onto the latest full snapshot.
      if (d.ball) Object.assign(this.state.ball, d.ball);
      if (d.score) this.state.score = d.score;
      if (typeof d.timeMs === 'number') this.state.timeMs = d.timeMs;
      if (d.period) this.state.period = d.period;
      if (Array.isArray((d as MatchState).players)) {
        const players = (d as MatchState).players;
        for (let i = 0; i < players.length && i < this.state.players.length; i++) {
          Object.assign(this.state.players[i], players[i]);
        }
      }
    });
    this.socket.on('ack', (p: { controllerIndex: number; seq: number }) => {
      if (p.controllerIndex === this.controllerIndex) {
        this.lastAckedSeq = Math.max(this.lastAckedSeq, p.seq);
        // Drop acked inputs from the pending replay buffer.
        this.pending = this.pending.filter((f) => f.seq > this.lastAckedSeq);
      }
    });
    this.socket.on('netStatus', (n: NetStatus) => this.onNetStatus?.(n));
    this.socket.on('opponentDisconnected', (p: { graceSeconds: number }) =>
      this.onOpponentDisconnected?.(p.graceSeconds),
    );
    this.socket.on('opponentReconnected', () => this.onOpponentReconnected?.());
    this.socket.on('error', (p: { message: string }) => this.onError?.(p.message));
  }

  // --- Lobby actions ---
  createRoom(cfg: OnlineSessionConfig, cb: (code: string) => void) {
    this.socket.emit('createRoom', { ...cfg }, (res: { code: string }) => cb(res.code));
  }
  joinRoom(code: string, cfg: OnlineSessionConfig, cb: (ok: boolean, reason?: string) => void) {
    this.code = code;
    this.socket.emit(
      'joinRoom',
      { code, team: cfg.team, name: cfg.name },
      (res: { ok: boolean; reason?: string }) => cb(res.ok, res.reason),
    );
  }
  setReady(ready: boolean) {
    this.socket.emit('setReady', { ready });
  }
  selectTeam(team: Team) {
    this.socket.emit('selectTeam', { team });
  }
  leaveRoom() {
    this.socket.emit('leaveRoom');
  }
  rematch() {
    this.socket.emit('rematch');
  }

  // --- During the match ---
  /** Send the current local input frame (rate-limited to INPUT_RATE). */
  sendInput(moveX: number, moveY: number, sprint: boolean, pass: boolean, shootHeld: boolean, highPass: boolean, switchPlayer: boolean) {
    const now = performance.now();
    if (now - this.lastInputAt < 1000 / 30 - 1) return; // ~30Hz
    this.lastInputAt = now;
    const frame = validateInput({
      seq: this.nextSeq++,
      moveX,
      moveY,
      sprint,
      pass,
      shootHeld,
      highPass,
      switchPlayer,
    });
    this.pending.push(frame);
    if (this.pending.length > 64) this.pending.shift();
    this.socket.emit('input', frame);
  }

  /**
   * Client-side prediction: advance the local authoritative copy by one fixed
   * step using the player's own latest input, then replay any unacked inputs
   * on top of the last server snapshot so the local player stays responsive.
   */
  predictStep(inputs: InputFrame[], dt: number = FIXED_DT): void {
    if (!this.state) return;
    // The simulation mutates state in place; prediction runs locally on a
    // shallow clone so a server snapshot can overwrite it on reconciliation.
    // (For simplicity we predict directly on this.state; the server snapshot
    // is the ground truth and will correct drift on the next full snapshot.)
    stepMulti(this.state, inputs, dt);
  }

  /** Reconciliation: replay unacked inputs onto the latest server snapshot. */
  private reconcile(): void {
    if (!this.state || this.pending.length === 0) return;
    // Replay pending inputs (those with seq > lastAckedSeq) on top of state.
    const toReplay = this.pending.filter((f) => f.seq > this.lastAckedSeq);
    for (const frame of toReplay) {
      const inputs: InputFrame[] = [emptyInput(), emptyInput()];
      inputs[this.controllerIndex] = frame;
      stepMulti(this.state, inputs, FIXED_DT);
    }
  }

  /**
   * Render-time interpolation: returns a state whose remote entities are
   * interpolated to INTERP_DELAY seconds in the past. For our MVP we simply
   * return the latest authoritative state (the sim already updates at 60Hz).
   */
  interpolatedState(): MatchState | null {
    return this.state;
  }

  destroy() {
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}

export { INTERP_DELAY };
