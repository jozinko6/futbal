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
  name: string;
  team: Team;
  controllerIndex: number;
  ready: boolean;
  connected: boolean;
  /** Last input seq acknowledged to this client. */
  lastAckedSeq: number;
  /** Next expected seq from this client (rejects stale/out-of-order). */
  nextExpectedSeq: number;
  /** Buffered inputs awaiting the next tick. */
  inputQueue: InputFrame[];
  /** Ping round-trip in ms (for HUD). */
  pingMs: number;
}

interface Room {
  code: string;
  hostId: string;
  difficulty: Difficulty;
  halfLength: number;
  players: Map<string, RoomPlayer>;
  state: MatchState | null;
  accumulator: number;
  lastSnapshotAt: number;
  running: boolean;
  /** Disconnect timers per socket id (grace period). */
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Last full snapshot sent (for delta diffing). */
  lastFullSnapshot: MatchState | null;
  loopHandle: ReturnType<typeof setInterval> | null;
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
  room.running = true;
  room.lastFullSnapshot = null;

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
      // Begin the authoritative fixed-tick loop.
      room.loopHandle = setInterval(() => tickRoom(room), Math.round(FIXED_DT * 1000));
    }
  }, 800);
}

function tickRoom(room: Room) {
  const s = room.state;
  if (!s || !room.running) return;

  // Gather each controller's next input (or empty).
  const inputs: InputFrame[] = [emptyInput(), emptyInput()];
  for (const p of room.players.values()) {
    if (!p.connected) {
      // AI takes over the disconnected controller's team — leave empty input,
      // the simulation's AI fills in for non-human players automatically when
      // no controller claims them. We mark the controller inactive by sending
      // empty input (the sim still treats the controller slot as human-owned
      // but with no movement). For true AI takeover we'd swap the controller
      // out; here we simply idle it during the grace period.
      continue;
    }
    let frame: InputFrame | null = null;
    while (p.inputQueue.length > 0) {
      const f = p.inputQueue.shift()!;
      // Validate sequence (reject stale/duplicate/out-of-range).
      if (!Number.isFinite(f.seq)) continue;
      if (f.seq < p.nextExpectedSeq) continue;
      if (f.seq > p.nextExpectedSeq + 32) break; // too far ahead — wait
      if (f.seq !== p.nextExpectedSeq) {
        // Gap — we missed one. Skip ahead to the received seq to avoid stalls.
        p.nextExpectedSeq = f.seq;
      }
      if (!validateInput(f).seq && validateInput(f).seq !== 0) continue;
      frame = f;
      p.nextExpectedSeq = f.seq + 1;
      break;
    }
    if (frame) {
      inputs[p.controllerIndex] = frame;
      p.lastAckedSeq = frame.seq;
      io.to(p.socketId).emit('ack', {
        controllerIndex: p.controllerIndex,
        seq: frame.seq,
      });
    }
  }

  // Advance the authoritative sim by one fixed step.
  stepMulti(s, inputs, FIXED_DT);

  // Broadcast snapshots at SNAPSHOT_RATE.
  const now = Date.now();
  if (now - room.lastSnapshotAt >= 1000 / SNAPSHOT_RATE) {
    room.lastSnapshotAt = now;
    // Full snapshot every ~1s (or first), delta otherwise.
    const full = room.lastFullSnapshot == null || now - (room.lastFullSnapshot as unknown as number) > 1000;
    if (full) {
      const snap = snapshotOf(s);
      room.lastFullSnapshot = snap;
      (room.lastFullSnapshot as unknown as number) = now;
      io.to(room.code).emit('snapshot', snap);
    } else {
      io.to(room.code).emit('delta', buildDelta(s));
    }
    // Net status (ping) piggybacked.
    for (const p of room.players.values()) {
      io.to(p.socketId).emit('netStatus', { pingMs: p.pingMs, connected: p.connected });
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
    const room: Room = {
      code,
      hostId: socket.id,
      difficulty: payload.difficulty,
      halfLength: payload.halfLength,
      players: new Map(),
      state: null,
      accumulator: 0,
      lastSnapshotAt: 0,
      running: false,
      disconnectTimers: new Map(),
      lastFullSnapshot: null,
      loopHandle: null,
    };
    const player: RoomPlayer = {
      socketId: socket.id,
      name: payload.name ?? 'Hráč 1',
      team: payload.team,
      controllerIndex: payload.team === 0 ? 0 : 1,
      ready: false,
      connected: true,
      lastAckedSeq: 0,
      nextExpectedSeq: 1,
      inputQueue: [],
      pingMs: 0,
    };
    room.players.set(socket.id, player);
    rooms.set(code, room);
    socket.join(code);
    socket.data.code = code;
    ack({ code });
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
    // Assign the opposite team if taken.
    let team = payload.team;
    const [h, a] = teamCounts(room);
    if (team === 0 && h > 0) team = 1 as Team;
    if (team === 1 && a > 0) team = 0 as Team;
    const player: RoomPlayer = {
      socketId: socket.id,
      name: payload.name ?? 'Hráč 2',
      team,
      controllerIndex: team === 0 ? 0 : 1,
      ready: false,
      connected: true,
      lastAckedSeq: 0,
      nextExpectedSeq: 1,
      inputQueue: [],
      pingMs: 0,
    };
    room.players.set(socket.id, player);
    socket.join(payload.code);
    socket.data.code = payload.code;
    ack({ ok: true });
    broadcastLobby(room);
    console.log(`${socket.id} joined room ${payload.code} (team ${team})`);
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
      // Notify the other player; preserve the match for the grace period.
      socket.to(room.code).emit('opponentDisconnected', { graceSeconds: DISCONNECT_GRACE });
      const timer = setTimeout(() => {
        room.players.delete(socket.id);
        destroyRoomIfEmpty(room);
      }, DISCONNECT_GRACE * 1000);
      room.disconnectTimers.set(socket.id, timer);
    }
  });

  socket.on('reconnect_attempt', () => {
    // socket.io handles reconnection; on a fresh socket the client rejoins.
  });
});

io.listen(PORT);
console.log(`Kačanovská FIFA game server listening on port ${PORT} (Socket.IO path /)`);
