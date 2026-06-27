/**
 * Modern Retro Football — central theme configuration.
 *
 * The single source of truth for all colours, intensities, and visual
 * profiles. No magic strings anywhere else in the codebase.
 *
 * All assets are original, procedurally generated, or CC0. No ripped assets,
 * protected logos, real club names, or copyrighted material is used.
 */

// --- Grass ---
export const GRASS = {
  grassDark: '#1a6b2e',
  grassMid: '#248a3a',
  grassLight: '#2fa048',
  grassHighlight: '#3bb855',
  lineWhite: '#eafff0',
  border: '#0d3a1d',
} as const;

// --- UI / HUD ---
export const UI = {
  backgroundDark: '#0a0e1a',
  panelDark: '#0f1a2e',
  panelLight: '#162a44',
  cyanAccent: '#22d3ee',
  yellowAccent: '#fde047',
  magentaAccent: '#e879f9',
  dangerRed: '#ef4444',
  successGreen: '#22c55e',
  whiteText: '#f8fafc',
  mutedText: '#94a3b8',
  pixelBorder: '#1e293b',
} as const;

// --- Teams (original — no real club colours/identities) ---
export const TEAMS = {
  home: { jersey: '#e23b3b', shorts: '#1f2937', trim: '#ffffff', skin: '#f1c27d', accent: '#fde047' },
  away: { jersey: '#2f7fd4', shorts: '#0b1f3a', trim: '#ffd23f', skin: '#f1c27d', accent: '#22d3ee' },
} as const;

// --- Particles ---
export const PARTICLE_COLORS = {
  sparkWhite: '#ffffff',
  sparkYellow: '#fde047',
  sparkCyan: '#22d3ee',
  grassDebris: '#2fa048',
  goalBurstHome: TEAMS.home.jersey,
  goalBurstAway: TEAMS.away.jersey,
} as const;

// --- Glow / Bloom ---
export const GLOW = {
  activeIndicator: 0.6,
  shotPower: 0.8,
  goalBurst: 1.0,
  hudKey: 0.4,
  menuItem: 0.5,
  lowTimeWarning: 0.7,
} as const;

// --- CRT ---
export const CRT = {
  subtle: { scanlineOpacity: 0.04, vignette: 0.15, noise: 0.02, flicker: 0.01 },
  strong: { scanlineOpacity: 0.08, vignette: 0.3, noise: 0.05, flicker: 0.02 },
} as const;

// --- Screen shake profiles ---
export interface ShakeProfile {
  amplitude: number;
  durationMs: number;
  trauma: number;
}
export const SHAKE_PROFILES: Record<string, ShakeProfile> = {
  LIGHT_KICK: { amplitude: 1, durationMs: 55, trauma: 0.15 },
  POWER_SHOT: { amplitude: 3, durationMs: 90, trauma: 0.35 },
  POST_HIT: { amplitude: 4, durationMs: 130, trauma: 0.5 },
  GOAL: { amplitude: 6, durationMs: 250, trauma: 0.8 },
  HARD_SAVE: { amplitude: 3, durationMs: 110, trauma: 0.4 },
} as const;

// --- Replay / VHS filter ---
export const REPLAY = {
  speed: 0.75,
  durationMs: 5000,
  bufferFrames: 300,
  vhsNoise: 0.06,
  vhsTrackingShift: 2,
  vhsChromaticAberration: 1.5,
  freezeFrameMs: 80,
} as const;

// --- Performance profiles ---
export type PerformanceProfile = 'LOW' | 'NORMAL' | 'HIGH';
export interface VisualSettings {
  crt: 'off' | 'subtle' | 'strong';
  particles: 'off' | 'low' | 'high';
  screenShake: 'off' | 'low' | 'normal';
  glow: 'off' | 'low' | 'normal';
  ballTrail: boolean;
  goalReplay: boolean;
  reducedMotion: boolean;
  fullscreen: boolean;
  profile: PerformanceProfile;
}

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  crt: 'subtle',
  particles: 'high',
  screenShake: 'normal',
  glow: 'normal',
  ballTrail: true,
  goalReplay: true,
  reducedMotion: false,
  fullscreen: false,
  profile: 'NORMAL',
};

export function autoDetectProfile(): PerformanceProfile {
  if (typeof navigator === 'undefined') return 'NORMAL';
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory != null &&
    (navigator as unknown as { deviceMemory?: number }).deviceMemory! < 4;
  if (isMobile || isLowMem) return 'LOW';
  return 'NORMAL';
}

export function settingsFromProfile(p: PerformanceProfile): Partial<VisualSettings> {
  switch (p) {
    case 'LOW': return { crt: 'off', particles: 'low', glow: 'off', ballTrail: true, goalReplay: false };
    case 'NORMAL': return { crt: 'subtle', particles: 'high', glow: 'normal', ballTrail: true, goalReplay: true };
    case 'HIGH': return { crt: 'strong', particles: 'high', glow: 'normal', ballTrail: true, goalReplay: true };
  }
}

export function applyReducedMotion(s: VisualSettings): VisualSettings {
  if (!s.reducedMotion) return s;
  return { ...s, screenShake: 'off', crt: s.crt === 'strong' ? 'subtle' : s.crt, goalReplay: false };
}
