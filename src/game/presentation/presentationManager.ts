/**
 * PresentationManager — the central coordinator for all visual effects.
 *
 * Consumes PresentationEvents from the simulation and dispatches them to:
 *   - ParticleSystem (spawn presets)
 *   - CameraShake (add trauma from profiles)
 *   - BallTrail (activate on power shots)
 *   - Sound (play the correct sound at the contact tick)
 *   - ReplayController (start replay on GOAL_SCORED)
 *
 * The PresentationManager is purely presentational — it never modifies
 * MatchState, never creates gameplay events, and never affects the
 * deterministic simulation result.
 */
import { ParticleSystem, PRESETS } from './particles/particleSystem';
import { CameraShake } from './cameraShake';
import { BallTrail } from './ballTrail';
import { ReplayController } from './replay/replayController';
import { drain, type PresentationEvent } from './events';
import { PARTICLE_COLORS } from './theme';
import type { MatchState } from '@/game/simulation';
import type { Sound } from '@/game/audio/Sound';

export class PresentationManager {
  particles: ParticleSystem;
  shake: CameraShake;
  trail: BallTrail;
  replay: ReplayController;
  private sound: Sound | null = null;
  private prevEventCount = 0;

  constructor() {
    this.particles = new ParticleSystem();
    this.shake = new CameraShake();
    this.trail = new BallTrail();
    this.replay = new ReplayController();
  }

  setSound(s: Sound): void { this.sound = s; }

  /** Consume presentation events from the sim state and trigger effects. */
  consumeEvents(state: MatchState): void {
    if (state.events.length === 0) return;
    const events = drain(state.events);
    for (const ev of events) {
      this.handleEvent(ev);
    }
  }

  private handleEvent(ev: PresentationEvent): void {
    switch (ev.type) {
      case 'BALL_KICKED':
        if (ev.power > 300) {
          this.shake.addProfile('POWER_SHOT');
          this.particles.emit(PRESETS.SHOT_SPARK, ev.x, ev.y);
          this.trail.setColor(PARTICLE_COLORS.sparkYellow);
        } else {
          this.shake.addProfile('LIGHT_KICK');
        }
        if (this.sound) {
          if (ev.kickType.includes('Shot') || ev.kickType.includes('shot')) {
            this.sound.kick(Math.min(1, ev.power / 600));
          } else {
            this.sound.pass();
          }
        }
        break;
      case 'POST_HIT':
        this.shake.addProfile('POST_HIT');
        this.particles.emit(PRESETS.POST_SPARK, ev.x, ev.y);
        if (this.sound) this.sound.post();
        break;
      case 'GOAL_SCORED':
        this.shake.addProfile('GOAL');
        this.particles.emit(PRESETS.GOAL_BURST, ev.x, ev.y);
        if (this.sound) this.sound.goal();
        // Start replay (if enabled — checked by caller).
        break;
      case 'NET_HIT':
        this.particles.emit(PRESETS.GOAL_BURST, ev.x, ev.y, 10);
        break;
      case 'SLIDE_STARTED':
        this.particles.emit(PRESETS.GRASS_KICK, ev.x, ev.y);
        break;
      case 'TACKLE_CONTACT':
        if (!ev.clean) {
          this.particles.emit(PRESETS.GRASS_KICK, ev.x, ev.y);
        }
        break;
      case 'GK_SAVE':
        this.shake.addProfile('HARD_SAVE');
        this.particles.emit(PRESETS.GK_SAVE, ev.x, ev.y);
        break;
      case 'WHISTLE':
        if (this.sound) this.sound.whistle();
        break;
      case 'MATCH_STARTED':
        if (this.sound) this.sound.whistle();
        break;
      case 'MATCH_ENDED':
        if (this.sound) this.sound.whistle();
        break;
    }
  }

  /** Update all effect systems. Call every render frame with real dt. */
  update(dt: number): void {
    this.particles.update(dt);
    this.shake.update(dt);
  }

  /** Render particles (ground layer first, then air). */
  renderParticles(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    this.particles.render(ctx, originX, originY);
  }

  /** Render ball trail. */
  renderTrail(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    this.trail.render(ctx, originX, originY);
  }

  /** Get current shake offset for the render origin. */
  get shakeOffset(): { x: number; y: number } { return this.shake.offset; }

  /** Record ball position for trail. */
  recordTrail(x: number, y: number, z: number, speed: number): void {
    this.trail.record(x, y, z, speed);
  }

  /** Record a replay frame from the current state. */
  recordReplayFrame(state: MatchState, camX: number, camY: number): void {
    this.replay.buffer.record({
      tick: state.tick,
      time: state.timeMs,
      ball: { x: state.ball.x, y: state.ball.y, z: state.ball.z, spin: state.ball.spin },
      players: state.players.map((p) => ({
        id: p.id, team: p.team, role: p.role,
        x: p.x, y: p.y, facing: p.facing,
        state: p.state, animTime: p.animTime,
      })),
      camera: { x: camX, y: camY },
      score: [...state.score] as [number, number],
    });
  }

  clear(): void {
    this.particles.clear();
    this.shake.reset();
    this.trail.clear();
    this.replay.buffer.clear();
  }
}
