/**
 * VHS Instant Replay — records lightweight render snapshots and plays them
 * back after a goal with a VHS filter overlay.
 *
 * Uses a circular buffer of ~5 seconds. Each ReplayFrame contains only the
 * data needed for rendering (NOT full MatchState). The replay NEVER modifies
 * the match — it's purely presentational.
 *
 * Online: replay runs from the local snapshot buffer; the server keeps
 * ticking. After replay, the client snaps back to the latest authoritative
 * state.
 */
import type { Team } from '@/game/simulation';
import { REPLAY } from '../theme';

export interface ReplayFrame {
  tick: number;
  time: number;
  ball: { x: number; y: number; z: number; spin: number };
  players: Array<{
    id: number; team: Team; role: string;
    x: number; y: number; facing: number;
    state: string; animTime: number;
  }>;
  camera: { x: number; y: number };
  score: [number, number];
}

export class ReplayBuffer {
  private frames: ReplayFrame[] = [];
  private maxFrames = REPLAY.bufferFrames;

  record(frame: ReplayFrame): void {
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) this.frames.shift();
  }

  get last5Seconds(): ReplayFrame[] {
    return [...this.frames];
  }

  clear(): void { this.frames = []; }
  get length(): number { return this.frames.length; }
}

export class ReplayController {
  buffer: ReplayBuffer;
  active = false;
  private playhead = 0;
  private frames: ReplayFrame[] = [];
  private elapsed = 0;
  private speed = REPLAY.speed;
  private onComplete: (() => void) | null = null;

  constructor() { this.buffer = new ReplayBuffer(); }

  start(onComplete: () => void): void {
    this.frames = this.buffer.last5Seconds;
    if (this.frames.length < 10) { onComplete(); return; }
    this.active = true;
    this.playhead = 0;
    this.elapsed = 0;
    this.onComplete = onComplete;
  }

  /** Advance the replay by dt (real seconds). Returns the frame to render. */
  update(dt: number): ReplayFrame | null {
    if (!this.active) return null;
    this.elapsed += dt * this.speed;
    const idx = Math.floor(this.elapsed * 60); // 60fps frames
    if (idx >= this.frames.length) {
      this.active = false;
      if (this.onComplete) this.onComplete();
      this.onComplete = null;
      return null;
    }
    this.playhead = idx;
    return this.frames[idx];
  }

  skip(): void {
    if (!this.active) return;
    this.active = false;
    if (this.onComplete) this.onComplete();
    this.onComplete = null;
  }

  get progress(): number {
    if (!this.active || this.frames.length === 0) return 0;
    return this.playhead / this.frames.length;
  }
}
