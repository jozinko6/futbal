/**
 * Team formations and initial player layout for a 5v5 arcade match
 * (1 GK + 2 DEF + 1 MID + 1 FWD per side).
 */
import {
  FIELD_CX,
  FIELD_CY,
  FIELD_X,
  FIELD_W,
  PLAYERS_PER_TEAM,
} from './constants';
import type { PlayerEntity, PlayerRole, Team } from './types';

export interface FormationSlot {
  role: PlayerRole;
  /** Position in "home" coordinates (home attacks to the right). */
  x: number;
  y: number;
}

/**
 * Home-team formation slots expressed as fractions of the home half, then
 * mirrored for the away team. Home occupies the left half.
 */
const HOME_FORMATION: FormationSlot[] = [
  { role: 'GK', x: FIELD_X + 38, y: FIELD_CY },
  { role: 'DEF', x: FIELD_X + 190, y: FIELD_CY - 92 },
  { role: 'DEF', x: FIELD_X + 190, y: FIELD_CY + 92 },
  { role: 'MID', x: FIELD_X + 360, y: FIELD_CY },
  { role: 'FWD', x: FIELD_X + 360, y: FIELD_CY - 120 },
  // (5th slot uses the FWD above; see mapping below)
];

// We need exactly PLAYERS_PER_TEAM slots. Re-map to ensure 5 distinct roles.
const FORMATION_SLOTS: FormationSlot[] = [
  { role: 'GK', x: FIELD_X + 38, y: FIELD_CY },
  { role: 'DEF', x: FIELD_X + 190, y: FIELD_CY - 92 },
  { role: 'DEF', x: FIELD_X + 190, y: FIELD_CY + 92 },
  { role: 'MID', x: FIELD_X + 360, y: FIELD_CY },
  { role: 'FWD', x: FIELD_X + 560, y: FIELD_CY },
];

/** Returns the formation home position for a player, mirrored for away. */
export function formationSlot(team: Team, index: number): FormationSlot {
  const base = FORMATION_SLOTS[index] ?? FORMATION_SLOTS[0];
  if (team === 0) return base;
  // Mirror across the center line for the away team.
  return { role: base.role, x: 2 * FIELD_CX - base.x, y: base.y };
}

/** Mirror an arbitrary x across the halfway line (used for kickoffs etc.). */
export function mirrorX(x: number): number {
  return 2 * FIELD_CX - x;
}

export function roleForIndex(index: number): PlayerRole {
  return (FORMATION_SLOTS[index] ?? FORMATION_SLOTS[0]).role;
}

export function buildPlayers(): PlayerEntity[] {
  const players: PlayerEntity[] = [];
  let id = 0;
  for (let team = 0 as Team; team < 2; team = (team + 1) as Team) {
    for (let i = 0; i < PLAYERS_PER_TEAM; i++) {
      const slot = formationSlot(team, i);
      players.push(makePlayer(id, team, slot.role, slot.x, slot.y));
      id++;
    }
  }
  return players;
}

export function makePlayer(
  id: number,
  team: Team,
  role: PlayerRole,
  x: number,
  y: number,
): PlayerEntity {
  return {
    id,
    team,
    role,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: team === 0 ? 0 : Math.PI,
    maxSpeed: role === 'GK' ? 104 : 132,
    accel: 760,
    state: 'idle',
    slideCooldown: 0,
    hasBall: false,
    stunnedTime: 0,
    animTime: 0,
    aiTimer: 0,
    aiTarget: { x, y },
    aiAction: 'idle',
    diveDir: { x: 0, y: 0 },
    diveTime: 0,
    actionLock: 0,
  };
}

/** Reset all players to their formation slots (used for kickoff). */
export function resetToFormation(players: PlayerEntity[]): void {
  for (const p of players) {
    const slot = formationSlot(p.team, indexInTeam(p.id));
    p.x = slot.x;
    p.y = slot.y;
    p.vx = 0;
    p.vy = 0;
    p.facing = p.team === 0 ? 0 : Math.PI;
    p.state = 'idle';
    p.hasBall = false;
    p.stunnedTime = 0;
    p.slideCooldown = 0;
    p.actionLock = 0;
    p.diveTime = 0;
    p.aiAction = 'idle';
    p.aiTarget = { x: slot.x, y: slot.y };
  }
}

export function indexInTeam(playerId: number): number {
  return playerId % PLAYERS_PER_TEAM;
}

export function teamOf(playerId: number): Team {
  return (playerId < PLAYERS_PER_TEAM ? 0 : 1) as Team;
}
