/**
 * Ball trail — pixel-art style trail of the ball's recent positions.
 *
 * Activated when the ball exceeds a speed threshold (power shots, fast
 * deflections). Uses 3-6 historical positions with decreasing alpha/size.
 * Purely visual — never modifies BallState.
 */
import { PARTICLE_COLORS } from './theme';

interface TrailPoint { x: number; y: number; z: number; age: number }

export class BallTrail {
  private history: TrailPoint[] = [];
  private maxPoints = 6;
  private speedThreshold: number; // px/s
  enabled = true;
  private color: string = PARTICLE_COLORS.sparkWhite;

  constructor(speedThreshold = 400) {
    this.speedThreshold = speedThreshold;
  }

  /** Record the ball's current position. Call every render frame. */
  record(x: number, y: number, z: number, speed: number): void {
    if (!this.enabled) return;
    if (speed < this.speedThreshold) {
      // Decay trail when ball slows.
      if (this.history.length > 0) this.history.shift();
      return;
    }
    this.history.push({ x, y, z, age: 0 });
    if (this.history.length > this.maxPoints) this.history.shift();
    // Age existing points.
    for (const p of this.history) p.age++;
  }

  /** Set the trail colour (e.g. cyan for power shots). */
  setColor(c: string): void { this.color = c; }

  render(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    if (!this.enabled || this.history.length < 2) return;
    for (let i = 0; i < this.history.length; i++) {
      const p = this.history[i];
      const t = i / this.history.length; // 0 = oldest, 1 = newest
      const alpha = t * 0.5;
      const size = Math.max(1, Math.round(2 + t * 3));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      const sx = Math.round(p.x - originX);
      const sy = Math.round(p.y - originY - p.z);
      ctx.fillRect(sx - Math.floor(size / 2), sy - Math.floor(size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void { this.history = []; }
}
