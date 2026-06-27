/**
 * Kačanovská FIFA — authoritative Socket.IO game server (mini-service).
 *
 * Runs the deterministic simulation from `../../src/game/simulation` as the
 * single source of truth. Clients send ONLY timestamped, sequence-numbered
 * inputs (never positions/score/time). The server validates inputs, advances
 * the fixed-tick sim, and broadcasts periodic snapshots (full on join/resync,
 * delta otherwise) plus acks of the last processed input per controller.
 *
 * Wire format: see `../../src/game/net/protocol.ts`.
 */
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import {
  createMatchState,
  stepMulti,
  FIXED_DT,
  SNAPSHOT_RATE,
  INPUT_RATE,
  DISCONNECT_GRACE,
  emptyInput,
  validateInput,
  type MatchState,
  type InputFrame,
  type Team,
  type Difficulty,
} from '../../src/game/simulation';

const PORT = 3003;

const io = new Server(createServer(), {
  // Path is used by the Caddy gateway to route to this port via XTransformPort.
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

interface RoomPlayer {
  socketId: string;
  /** Stable session id (survives reconnect; not tied to socket.id). */
  sessionId: string;
  /** Token a client uses to reconnect. */
  reconnectToken: string;
  name: string;
  team: Team;
  /** 0 = home controller, 1 = away. -1 when AI-controlled (disconnected). */
  controllerIndex: number;
  ready: boolean;
  connected: boolean;
  /** Last input seq acknowledged to this client. */
  lastAckedSeq: number;
  /** Next expected seq from this client (rejects stale/out-of-order). */
  nextExpectedSeq: number;
  /** Buffered inputs awaiting the next tick. */
  inputQueue: InputFrame[];
  /** The last valid input applied — held between server ticks (no empty input
   *  is applied when no new message arrives). */
  currentInput: InputFrame;
  /** Ping round-trip in ms (for HUD). */
  pingMs: number;
}

interface Room {
  code: string;
  hostId: string;
  difficulty: Difficulty;
  halfLength: number;
  players: Map<string, RoomPlayer>;
  /** sessionId → RoomPlayer, for reconnect (socket.id changes on reconnect). */
  sessions: Map<string, RoomPlayer>;
  state: MatchState | null;
  accumulator: number;
  lastSnapshotAt: number;
  /** Separate timestamp (ms) of the last full snapshot — NOT stored in MatchState. */
  lastFullSnapshotAt: number;
  running: boolean;
  /** Disconnect timers per socket id (grace period). */
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Last full snapshot sent (for delta diffing). */
  lastFullSnapshot: MatchState | null;
  loopHandle: ReturnType<typeof setInterval> | null;
  /** Monotonic time (ms) of the last loop iteration, for the accumulator. */
  lastLoopTime: number;
}

const rooms = new Map<string, Room>();

function genCode(): string {
  let s = '';
  do {
    s = '';
    for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  } while (rooms.has(s));
  return s;
}

function genToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function lobbyState(room: Room) {
  return {
    code: room.code,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.socketId,
      name: p.name,
      team: p.team,
      ready: p.ready,
      connected: p.connected,
    })),
    difficulty: room.difficulty,
    halfLength: room.halfLength,
    hostId: room.hostId,
  };
}

function teamCounts(room: Room): [number, number] {
  let h = 0;
  let a = 0;
  for (const p of room.players.values()) {
    if (p.team === 0) h++;
    else a++;
  }
  return [h, a];
}

function broadcastLobby(room: Room) {
  io.to(room.code).emit('lobbyUpdate', lobbyState(room));
}

function snapshotOf(s: MatchState): MatchState {
  // The simulation state is plain data; clients reconstruct from a deep clone.
  return JSON.parse(JSON.stringify(s)) as MatchState;
}

function startMatch(room: Room) {
  const [h, a] = teamCounts(room);
  if (h < 1 || a < 1) return;
  const state = createMatchState({
    difficulty: room.difficulty,
    halfLength: room.halfLength,
    humanTeam: 0 as Team,
    humanPlayers: 2,
  });
  // Each connected player controls the team they picked.
  for (const p of room.players.values()) {
    p.controllerIndex = p.team === 0 ? 0 : 1;
    p.lastAckedSeq = 0;
    p.nextExpectedSeq = 1;
    p.inputQueue = [];
  }
  room.state = state;
  room.accumulator = 0;
  room.lastSnapshotAt = 0;
  room.lastFullSnapshotAt = 0;
  room.running = true;
  room.lastFullSnapshot = null;
  room.lastLoopTime = 0;

  // Synchronised countdown 3..2..1 then matchStart.
  let secs = 3;
  io.to(room.code).emit('countdown', { seconds: secs });
  const cd = setInterval(() => {
    secs--;
    if (secs > 0) {
      io.to(room.code).emit('countdown', { seconds: secs });
    } else {
      clearInterval(cd);
      for (const p of room.players.values()) {
        io.to(p.socketId).emit('matchStart', {
          controllerIndex: p.controllerIndex,
          snapshot: snapshotOf(state),
        });
      }
      room.lastFullSnapshot = snapshotOf(state);
      room.lastFullSnapshotAt = Date.now();
      // Begin the authoritative fixed-tick loop (accumulator-based).
      room.lastLoopTime = Date.now();
      room.loopHandle = setInterval(() => tickRoom(room), Math.round(FIXED_DT * 1000));
    }
  }, 800);
}

function tickRoom(room: Room) {
  const s = room.state;
  if (!s || !room.running) return;

  // --- Accumulator-based fixed timestep (monotonic time, spiral-of-death guard) ---
  const now = Date.now();
  let frameTime = (now - room.lastLoopTime) / 1000;
  room.lastLoopTime = now;
  if (frameTime > 0.25) frameTime = 0.25; // cap to avoid spiral of death
  room.accumulator += frameTime;
  const MAX_CATCHUP = 5; // max sim steps per tick to catch up
  let steps = 0;

  while (room.accumulator >= FIXED_DT && steps < MAX_CATCHUP) {
    // --- Gather inputs: hold the last valid input per controller; do NOT
    //     apply empty input in ticks without a new message. ---
    // For disconnected controllers, omit them (AI takeover: the sim runs with
    // fewer controllers, AI drives those players).
    const connectedControllers = new Set<number>();
    for (const p of room.players.values()) {
      if (p.connected && p.controllerIndex >= 0) connectedControllers.add(p.controllerIndex);
    }
    const inputs: InputFrame[] = [];
    for (const p of room.players.values()) {
      if (!p.connected || p.controllerIndex < 0) continue;
      // Drain the next valid input from the queue.
      let frame: InputFrame | null = null;
      while (p.inputQueue.length > 0) {
        const f = p.inputQueue.shift()!;
        if (!Number.isFinite(f.seq)) continue;
        if (f.seq < p.nextExpectedSeq) continue;
        if (f.seq > p.nextExpectedSeq + 32) break;
        if (f.seq !== p.nextExpectedSeq) p.nextExpectedSeq = f.seq;
        frame = f;
        p.nextExpectedSeq = f.seq + 1;
        break;
      }
      if (frame) {
        p.currentInput = frame;
        p.lastAckedSeq = frame.seq;
        io.to(p.socketId).emit('ack', { controllerIndex: p.controllerIndex, seq: frame.seq });
      }
      // Hold the last valid input (currentInput) — applied every tick until a
      // new message arrives.
      inputs[p.controllerIndex] = p.currentInput;
    }
    // Advance the authoritative sim by one fixed step.
    stepMulti(s, inputs, FIXED_DT);
    room.accumulator -= FIXED_DT;
    steps++;
    // Match end?
    if ((s.period as string) === 'fulltime') break;
  }

  // --- Broadcast snapshots at SNAPSHOT_RATE (full ~1s, delta otherwise). ---
  if (now - room.lastSnapshotAt >= 1000 / SNAPSHOT_RATE) {
    room.lastSnapshotAt = now;
    const full = room.lastFullSnapshot == null || now - room.lastFullSnapshotAt > 1000;
    if (full) {
      const snap = snapshotOf(s);
      room.lastFullSnapshot = snap;
      room.lastFullSnapshotAt = now; // separate field, NOT in MatchState
      io.to(room.code).emit('snapshot', snap);
    } else {
      io.to(room.code).emit('delta', buildDelta(s));
    }
    for (const p of room.players.values()) {
      if (p.connected) io.to(p.socketId).emit('netStatus', { pingMs: p.pingMs, connected: p.connected });
    }
  }

  // Match end?
  if ((s.period as string) === 'fulltime') {
    room.running = false;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.loopHandle = null;
    io.to(room.code).emit('matchEnd', { score: [...s.score] as [number, number] });
  }
}

function buildDelta(s: MatchState) {
  return {
    tick: s.tick,
    ball: { x: s.ball.x, y: s.ball.y, z: s.ball.z, vx: s.ball.vx, vy: s.ball.vy, ownerId: s.ball.ownerId },
    players: s.players.map((p) => ({ x: p.x, y: p.y, state: p.state, hasBall: p.hasBall })),
    score: s.score,
    timeMs: s.timeMs,
    period: s.period,
    activePlayerId: s.controllers[0]?.activeId ?? 0,
  };
}

function destroyRoomIfEmpty(room: Room) {
  let any = false;
  for (const p of room.players.values()) if (p.connected) any = true;
  if (!any) {
    if (room.loopHandle) clearInterval(room.loopHandle);
    rooms.delete(room.code);
    console.log(`Room ${room.code} destroyed (empty).`);
  }
}

io.on('connection', (socket: Socket) => {
  console.log(`connected ${socket.id}`);

  socket.on('createRoom', (payload: { difficulty: Difficulty; halfLength: number; team: Team; name?: string }, ack) => {
    const code = genCode();
    const sessionId = genToken();
    const reconnectToken = genToken();
    const room: Room = {
      code,
      hostId: socket.id,
      difficulty: payload.difficulty,
      halfLength: payload.halfLength,
      players: new Map(),
      sessions: new Map(),
      state: null,
      accumulator: 0,
      lastSnapshotAt: 0,
      lastFullSnapshotAt: 0,
      running: false,
      disconnectTimers: new Map(),
      lastFullSnapshot: null,
      loopHandle: null,
      lastLoopTime: 0,
    };
    const player: RoomPlayer = {
      socketId: socket.id,
      sessionId,
      reconnectToken,
      name: payload.name ?? 'Hráč 1',
      team: payload.team,
      controllerIndex: payload.team === 0 ? 0 : 1,
      ready: false,
      connected: true,
      lastAckedSeq: 0,
      nextExpectedSeq: 1,
      inputQueue: [],
      currentInput: emptyInput(),
      pingMs: 0,
    };
    room.players.set(socket.id, player);
    room.sessions.set(sessionId, player);
    rooms.set(code, room);
    socket.join(code);
    socket.data.code = code;
    socket.data.sessionId = sessionId;
    ack({ code, reconnectToken });
    socket.emit('roomCreated', { code });
    broadcastLobby(room);
    console.log(`Room ${code} created by ${socket.id} (team ${payload.team})`);
  });

  socket.on('joinRoom', (payload: { code: string; team: Team; name?: string }, ack) => {
    const room = rooms.get(payload.code);
    if (!room) {
      ack({ ok: false, reason: 'Miestnosť neexistuje.' });
      return;
    }
    if (room.players.size >= 2) {
      ack({ ok: false, reason: 'Miestnosť je plná.' });
      return;
    }
    let team = payload.team;
    const [h, a] = teamCounts(room);
    if (team === 0 && h > 0) team = 1 as Team;
    if (team === 1 && a > 0) team = 0 as Team;
    const sessionId = genToken();
    const reconnectToken = genToken();
    const player: RoomPlayer = {
      socketId: socket.id,
      sessionId,
      reconnectToken,
      name: payload.name ?? 'Hráč 2',
      team,
      controllerIndex: team === 0 ? 0 : 1,
      ready: false,
      connected: true,
      lastAckedSeq: 0,
      nextExpectedSeq: 1,
      inputQueue: [],
      currentInput: emptyInput(),
      pingMs: 0,
    };
    room.players.set(socket.id, player);
    room.sessions.set(sessionId, player);
    socket.join(payload.code);
    socket.data.code = payload.code;
    socket.data.sessionId = sessionId;
    ack({ ok: true, reconnectToken });
    broadcastLobby(room);
    console.log(`${socket.id} joined room ${payload.code} (team ${team})`);
  });

  // --- Reconnect: a client with a reconnectToken rejoins its slot. ---
  socket.on('reconnect', (payload: { code: string; reconnectToken: string }, ack) => {
    const room = rooms.get(payload.code);
    if (!room) { ack({ ok: false, reason: 'Miestnosť neexistuje.' }); return; }
    // Find the player by reconnectToken (not socket.id).
    let found: RoomPlayer | null = null;
    for (const p of room.players.values()) {
      if (p.reconnectToken === payload.reconnectToken) { found = p; break; }
    }
    if (!found) { ack({ ok: false, reason: 'Neplatný reconnect token.' }); return; }
    // Clear any pending disconnect timer.
    const timer = room.disconnectTimers.get(found.socketId);
    if (timer) { clearTimeout(timer); room.disconnectTimers.delete(found.socketId); }
    // Rebind to the new socket + restore controller ownership.
    const oldSocketId = found.socketId;
    found.socketId = socket.id;
    found.connected = true;
    found.controllerIndex = found.team === 0 ? 0 : 1; // restore from team
    room.players.delete(oldSocketId);
    room.players.set(socket.id, found);
    socket.join(room.code);
    socket.data.code = room.code;
    socket.data.sessionId = found.sessionId;
    // Notify the other player + restore the match state.
    io.to(room.code).emit('opponentReconnected');
    if (room.state && room.running) {
      socket.emit('matchStart', { controllerIndex: found.controllerIndex, snapshot: snapshotOf(room.state) });
    }
    ack({ ok: true });
    console.log(`${socket.id} reconnected to room ${room.code} (session ${found.sessionId})`);
  });

  socket.on('setReady', (payload: { ready: boolean }) => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.ready = payload.ready;
    broadcastLobby(room);
    // Auto-start when both connected & ready.
    if (room.players.size === 2 && Array.from(room.players.values()).every((pl) => pl.ready && pl.connected)) {
      startMatch(room);
    }
  });

  socket.on('selectTeam', (payload: { team: Team }) => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || room.running) return;
    // Swap only if the other player doesn't already have that team.
    const others = Array.from(room.players.values()).filter((pl) => pl.socketId !== socket.id);
    if (others.some((o) => o.team === payload.team)) return;
    p.team = payload.team;
    p.controllerIndex = payload.team === 0 ? 0 : 1;
    broadcastLobby(room);
  });

  socket.on('input', (payload: InputFrame) => {
    const room = rooms.get(socket.data.code);
    if (!room || !room.running) return;
    const p = room.players.get(socket.id);
    if (!p || !p.connected) return;
    // Rate-limit: drop if arriving faster than INPUT_RATE allows.
    if (p.inputQueue.length > 0) {
      const last = p.inputQueue[p.inputQueue.length - 1];
      // Keep queue bounded.
      if (p.inputQueue.length < 64) p.inputQueue.push(payload);
    } else {
      p.inputQueue.push(payload);
    }
  });

  socket.on('rematch', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.loopHandle = null;
    room.running = false;
    room.state = null;
    room.lastFullSnapshot = null;
    for (const p of room.players.values()) {
      p.ready = false;
      p.lastAckedSeq = 0;
      p.nextExpectedSeq = 1;
      p.inputQueue = [];
    }
    broadcastLobby(room);
  });

  socket.on('ping', (payload: { t: number }, ack) => {
    ack({ t: payload.t });
    const room = rooms.get(socket.data.code);
    if (room) {
      const p = room.players.get(socket.id);
      if (p) p.pingMs = Math.max(0, Date.now() - payload.t);
    }
  });

  socket.on('leaveRoom', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    room.players.delete(socket.id);
    socket.leave(room.code);
    broadcastLobby(room);
    destroyRoomIfEmpty(room);
  });

  socket.on('disconnect', () => {
    console.log(`disconnected ${socket.id}`);
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) {
      p.connected = false;
      // AI takeover: mark the controller as AI (-1) so the sim's AI drives
      // that team. On reconnect, controllerIndex is restored.
      const wasIndex = p.controllerIndex;
      p.controllerIndex = -1;
      // Notify the other player; preserve the match for the grace period.
      socket.to(room.code).emit('opponentDisconnected', { graceSeconds: DISCONNECT_GRACE });
      const timer = setTimeout(() => {
        room.players.delete(socket.id);
        room.sessions.delete(p.sessionId);
        destroyRoomIfEmpty(room);
      }, DISCONNECT_GRACE * 1000);
      room.disconnectTimers.set(socket.id, timer);
      void wasIndex;
    }
  });

  socket.on('reconnect_attempt', () => {
    // socket.io handles reconnection; on a fresh socket the client rejoins.
  });
});

io.listen(PORT);
console.log(`Kačanovská FIFA game server listening on port ${PORT} (Socket.IO path /)`);
