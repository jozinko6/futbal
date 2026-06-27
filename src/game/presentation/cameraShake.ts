/**
 * Camera shake — purely presentational. Uses a trauma accumulator that decays
 * over time. The shake offset is applied to the render origin only; sim
 * coordinates are never modified.
 */
import { SHAKE_PROFILES, type ShakeProfile } from './theme';

export class CameraShake {
  private trauma = 0;
  private maxAmplitude = 8;
  enabled: 'off' | 'low' | 'normal' = 'normal';

  /** Add trauma from a named profile. */
  addProfile(profileName: string): void {
    if (this.enabled === 'off') return;
    const p: ShakeProfile | undefined = SHAKE_PROFILES[profileName];
    if (!p) return;
    const mul = this.enabled === 'low' ? 0.4 : 1;
    this.trauma = Math.min(1, this.trauma + p.trauma * mul);
  }

  /** Add raw trauma (0..1). */
  addTrauma(t: number): void {
    if (this.enabled === 'off') return;
    const mul = this.enabled === 'low' ? 0.4 : 1;
    this.trauma = Math.min(1, this.trauma + t * mul);
  }

  update(dt: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
    }
  }

  /** Current shake offset (px). */
  get offset(): { x: number; y: number } {
    if (this.trauma <= 0) return { x: 0, y: 0 };
    const amp = this.trauma * this.trauma * this.maxAmplitude;
    return {
      x: (Math.random() - 0.5) * 2 * amp,
      y: (Math.random() - 0.5) * 2 * amp,
    };
  }

  get active(): boolean { return this.trauma > 0.01; }

  reset(): void { this.trauma = 0; }
}
