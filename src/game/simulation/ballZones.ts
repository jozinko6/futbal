/**
 * Ball zones — rozdelenie ihriska do logických zón.
 * Inšpirované všeobecným futbalovým konceptom zón.
 */

export type BallZoneId =
  | 'OWN_BOX'
  | 'OWN_LEFT_DEF'
  | 'OWN_CENTER_DEF'
  | 'OWN_RIGHT_DEF'
  | 'OWN_LEFT_MID'
  | 'OWN_CENTER_MID'
  | 'OWN_RIGHT_MID'
  | 'CENTER_LEFT'
  | 'CENTER'
  | 'CENTER_RIGHT'
  | 'OPP_LEFT_MID'
  | 'OPP_CENTER_MID'
  | 'OPP_RIGHT_MID'
  | 'OPP_LEFT_DEF'
  | 'OPP_CENTER_DEF'
  | 'OPP_RIGHT_DEF'
  | 'OPP_BOX'
  | 'LEFT_WING'
  | 'RIGHT_WING'
  | 'OWN_LEFT_CORNER'
  | 'OWN_RIGHT_CORNER'
  | 'OPP_LEFT_CORNER'
  | 'OPP_RIGHT_CORNER';

/** Vypočítaj zónu lopty na základe normalizeovanej pozície (0..1 od vlastnej brány). */
export function getBallZone(normX: number, normY: number, team: number): BallZoneId {
  // Pre away tím (team=1) zrkadlíme X.
  const x = team === 0 ? normX : 1 - normX;
  const y = normY;

  // Rohy
  if (x < 0.05 && y < 0.10) return 'OWN_LEFT_CORNER' as BallZoneId;
  if (x < 0.05 && y > 0.90) return 'OWN_RIGHT_CORNER' as BallZoneId;
  if (x > 0.95 && y < 0.10) return 'OPP_LEFT_CORNER' as BallZoneId;
  if (x > 0.95 && y > 0.90) return 'OPP_RIGHT_CORNER' as BallZoneId;

  // Pokutové územia
  if (x < 0.12 && y > 0.30 && y < 0.70) return 'OWN_BOX' as BallZoneId;
  if (x > 0.88 && y > 0.30 && y < 0.70) return 'OPP_BOX' as BallZoneId;

  // Krídla
  if (y < 0.15) return 'LEFT_WING' as BallZoneId;
  if (y > 0.85) return 'RIGHT_WING' as BallZoneId;

  // Obrana
  if (x < 0.25) {
    if (y < 0.40) return 'OWN_LEFT_DEF' as BallZoneId;
    if (y < 0.60) return 'OWN_CENTER_DEF' as BallZoneId;
    return 'OWN_RIGHT_DEF' as BallZoneId;
  }

  // Stredná obrana
  if (x < 0.40) {
    if (y < 0.40) return 'OWN_LEFT_MID' as BallZoneId;
    if (y < 0.60) return 'OWN_CENTER_MID' as BallZoneId;
    return 'OWN_RIGHT_MID' as BallZoneId;
  }

  // Stred
  if (x < 0.55) {
    if (y < 0.40) return 'CENTER_LEFT' as BallZoneId;
    if (y < 0.60) return 'CENTER' as BallZoneId;
    return 'CENTER_RIGHT' as BallZoneId;
  }

  // Stredný útok
  if (x < 0.70) {
    if (y < 0.40) return 'OPP_LEFT_MID' as BallZoneId;
    if (y < 0.60) return 'OPP_CENTER_MID' as BallZoneId;
    return 'OPP_RIGHT_MID' as BallZoneId;
  }

  // Útočná obrana
  if (x < 0.85) {
    if (y < 0.40) return 'OPP_LEFT_DEF' as BallZoneId;
    if (y < 0.60) return 'OPP_CENTER_DEF' as BallZoneId;
    return 'OPP_RIGHT_DEF' as BallZoneId;
  }

  return 'OPP_BOX' as BallZoneId;
}
