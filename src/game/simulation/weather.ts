/**
 * Weather system — deterministické, synchronizovateľné počasie.
 *
 * Vlhadí ovplyvňuje fyziku lopty (mierne), vizuálne efekty sú oddelené.
 * Inšpirované pozorovaným správaním YSoccer (rain, snow, wind, fog) —
 * originálna TypeScript implementácia.
 */

export type Weather = 'CLEAR' | 'RAIN' | 'SNOW' | 'FOG' | 'WIND';
export type PitchSurface = 'DRY' | 'WET' | 'MUDDY' | 'FROZEN';

export interface WeatherState {
  weather: Weather;
  surface: PitchSurface;
  windX: number;  // px/s
  windY: number;  // px/s
  intensity: number; // 0..1
}

/** Predvolené počasie pre Classic Match. */
export const DEFAULT_WEATHER: WeatherState = {
  weather: 'CLEAR',
  surface: 'DRY',
  windX: 0,
  windY: 0,
  intensity: 0,
};

/** Vytvor náhodné počasie pre Arcade Cup (deterministické z seedu). */
export function createWeatherFromSeed(seed: number): WeatherState {
  const r = (seed * 9301 + 49297) % 233280 / 233280;
  if (r < 0.5) return DEFAULT_WEATHER;
  if (r < 0.7) return { weather: 'RAIN', surface: 'WET', windX: 20, windY: 0, intensity: 0.6 };
  if (r < 0.8) return { weather: 'SNOW', surface: 'FROZEN', windX: 10, windY: -5, intensity: 0.5 };
  if (r < 0.9) return { weather: 'WIND', surface: 'DRY', windX: 60, windY: 0, intensity: 0.7 };
  return { weather: 'FOG', surface: 'DRY', windX: 0, windY: 0, intensity: 0.4 };
}

/** Modifier trenia lopty podľa povrchu. */
export function frictionModifier(surface: PitchSurface): number {
  switch (surface) {
    case 'WET': return 0.7;    // menej trenia = lopta sa kĺže ďalej
    case 'MUDDY': return 1.4;   // viac trenia = lopta rýchlejšie zastaví
    case 'FROZEN': return 0.5;  // veľmi málo trenia = kĺzavé
    default: return 1.0;
  }
}

/** Modifier rýchlosti sklzu podľa povrchu. */
export function slideSpeedModifier(surface: PitchSurface): number {
  switch (surface) {
    case 'WET': return 1.2;
    case 'FROZEN': return 1.4;
    case 'MUDDY': return 0.8;
    default: return 1.0;
  }
}

/** Vplyv vetra na loptu (aplikuje sa každý tick na voľnú loptu). */
export function applyWind(ball: { vx: number; vy: number; vz: number; z: number }, weather: WeatherState, dt: number): void {
  if (weather.weather !== 'WIND' && weather.weather !== 'RAIN' && weather.weather !== 'SNOW') return;
  // Vietor pôsobí najmä na vysokú loptu.
  if (ball.z > 10) {
    const windForce = 0.5;
    ball.vx += weather.windX * windForce * dt;
    ball.vy += weather.windY * windForce * dt;
  }
}
