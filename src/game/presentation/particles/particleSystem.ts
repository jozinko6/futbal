/**
 * Pixel particle system with object pooling.
 *
 * Particles are purely visual — no physics collisions with ball/players,
 * no influence on MatchState. Uses a fixed-size pool to avoid GC pressure.
 */
import { PARTICLE_COLORS } from '../theme';

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; lifetime: number;
  size: number; alpha: number;
  rotation: number; color: string;
  gravity: number; drag: number;
  layer: 'ground' | 'air';
  active: boolean;
}

export type ParticleQuality = 'off' | 'low' | 'high';

const MAX_PARTICLES = 400;

export class ParticleSystem {
  private pool: Particle[] = [];
  private cursor = 0;
  quality: ParticleQuality = 'high';

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        age: 0, lifetime: 0, size: 1, alpha: 1, rotation: 0,
        color: '#fff', gravity: 0, drag: 0, layer: 'air', active: false,
      });
    }
  }

  private spawn(): Particle | null {
    // Find an inactive particle (round-robin).
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = (this.cursor + i) % MAX_PARTICLES;
      if (!this.pool[idx].active) {
        this.cursor = (idx + 1) % MAX_PARTICLES;
        return this.pool[idx];
      }
    }
    return null; // pool exhausted
  }

  emit(preset: ParticlePreset, x: number, y: number, z = 0): void {
    if (this.quality === 'off') return;
    const count = this.quality === 'low' ? Math.ceil(preset.count * 0.4) : preset.count;
    for (let i = 0; i < count; i++) {
      const p = this.spawn();
      if (!p) return;
      p.active = true;
      p.x = x; p.y = y; p.z = z;
      const ang = preset.angleFn();
      const spd = preset.speedFn();
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.vz = preset.vzFn();
      p.age = 0;
      p.lifetime = preset.lifetimeFn();
      p.size = preset.sizeFn();
      p.alpha = 1;
      p.rotation = 0;
      p.color = preset.colorFn();
      p.gravity = preset.gravity;
      p.drag = preset.drag;
      p.layer = preset.layer;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.lifetime) { p.active = false; continue; }
      p.vz -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
      const dragF = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragF; p.vy *= dragF;
      p.alpha = 1 - p.age / p.lifetime;
    }
  }

  render(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      const sx = Math.round(p.x - originX);
      const sy = Math.round(p.y - originY - p.z);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size));
      ctx.fillRect(sx - Math.floor(s / 2), sy - Math.floor(s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }
}

// --- Presets ---
export interface ParticlePreset {
  count: number;
  angleFn: () => number;
  speedFn: () => number;
  vzFn: () => number;
  lifetimeFn: () => number;
  sizeFn: () => number;
  colorFn: () => string;
  gravity: number;
  drag: number;
  layer: 'ground' | 'air';
}

function rnd(a: number, b: number): number { return a + Math.random() * (b - a); }

export const PRESETS: Record<string, ParticlePreset> = {
  GRASS_KICK: {
    count: 8,
    angleFn: () => rnd(0, Math.PI * 2),
    speedFn: () => rnd(20, 60),
    vzFn: () => rnd(10, 40),
    lifetimeFn: () => rnd(0.2, 0.4),
    sizeFn: () => Math.round(rnd(1, 3)),
    colorFn: () => PARTICLE_COLORS.grassDebris,
    gravity: 200, drag: 2, layer: 'ground',
  },
  SHOT_SPARK: {
    count: 6,
    angleFn: () => rnd(0, Math.PI * 2),
    speedFn: () => rnd(40, 120),
    vzFn: () => rnd(0, 20),
    lifetimeFn: () => rnd(0.1, 0.25),
    sizeFn: () => Math.round(rnd(1, 2)),
    colorFn: () => Math.random() < 0.5 ? PARTICLE_COLORS.sparkWhite : PARTICLE_COLORS.sparkYellow,
    gravity: 0, drag: 3, layer: 'air',
  },
  POST_SPARK: {
    count: 10,
    angleFn: () => rnd(0, Math.PI * 2),
    speedFn: () => rnd(60, 160),
    vzFn: () => rnd(20, 60),
    lifetimeFn: () => rnd(0.15, 0.35),
    sizeFn: () => Math.round(rnd(1, 3)),
    colorFn: () => {
      const r = Math.random();
      return r < 0.4 ? PARTICLE_COLORS.sparkWhite : r < 0.7 ? PARTICLE_COLORS.sparkYellow : PARTICLE_COLORS.sparkCyan;
    },
    gravity: 150, drag: 2, layer: 'air',
  },
  GOAL_BURST: {
    count: 24,
    angleFn: () => rnd(0, Math.PI * 2),
    speedFn: () => rnd(40, 200),
    vzFn: () => rnd(20, 100),
    lifetimeFn: () => rnd(0.3, 0.7),
    sizeFn: () => Math.round(rnd(2, 4)),
    colorFn: () => {
      const r = Math.random();
      return r < 0.3 ? PARTICLE_COLORS.sparkWhite : r < 0.6 ? PARTICLE_COLORS.sparkYellow : r < 0.8 ? PARTICLE_COLORS.goalBurstHome : PARTICLE_COLORS.goalBurstAway;
    },
    gravity: 100, drag: 1.5, layer: 'air',
  },
  GK_SAVE: {
    count: 8,
    angleFn: () => rnd(0, Math.PI * 2),
    speedFn: () => rnd(30, 80),
    vzFn: () => rnd(10, 40),
    lifetimeFn: () => rnd(0.2, 0.4),
    sizeFn: () => Math.round(rnd(1, 2)),
    colorFn: () => Math.random() < 0.5 ? PARTICLE_COLORS.sparkWhite : PARTICLE_COLORS.sparkCyan,
    gravity: 100, drag: 2, layer: 'air',
  },
  FOOTSTEP_DUST: {
    count: 3,
    angleFn: () => rnd(0, Math.PI * 2),
    speedFn: () => rnd(5, 20),
    vzFn: () => rnd(0, 10),
    lifetimeFn: () => rnd(0.15, 0.3),
    sizeFn: () => 1,
    colorFn: () => PARTICLE_COLORS.grassDebris,
    gravity: 0, drag: 3, layer: 'ground',
  },
};
