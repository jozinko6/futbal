/**
 * Formations for 5v5 (1-2-1), 7v7 (2-3-1), and 11v11 (4-4-2).
 * Home attacks right; away is mirrored across the halfway line.
 */
import {
  FIELD_CX, FIELD_CY, FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  METER_PX, m, mps, MOVEMENT,
  FORMATION_121_HOME,
  FORMAT_PLAYER_COUNT, type MatchFormat, type FutsalRole,
} from './constants';
import type { PlayerEntity, Team, Vec2 } from './types';

export interface FormationSlot { role: FutsalRole; x: number; y: number }

/** 7v7 formation (2-3-1) in metres. */
const FORMATION_231: Array<{ role: FutsalRole; x: number; y: number }> = [
  { role: 'goalkeeper', x: 1.2, y: 9.5 },
  { role: 'fixo', x: 8, y: 5 },
  { role: 'fixo', x: 8, y: 14 },
  { role: 'leftAla', x: 16, y: 3 },
  { role: 'pivot', x: 16, y: 9.5 },
  { role: 'rightAla', x: 16, y: 16 },
  { role: 'pivot', x: 24, y: 9.5 },
];

/** 11v11 formation (4-4-2) in metres — scaled to the larger field. */
const FORMATION_442: Array<{ role: FutsalRole; x: number; y: number }> = [
  { role: 'goalkeeper', x: 1.2, y: 9.5 },
  { role: 'fixo', x: 7, y: 3 },
  { role: 'fixo', x: 7, y: 7.5 },
  { role: 'fixo', x: 7, y: 11.5 },
  { role: 'fixo', x: 7, y: 16 },
  { role: 'leftAla', x: 15, y: 3 },
  { role: 'pivot', x: 15, y: 7.5 },
  { role: 'pivot', x: 15, y: 9.5 },
  { role: 'pivot', x: 15, y: 11.5 },
  { role: 'rightAla', x: 15, y: 16 },
  { role: 'pivot', x: 24, y: 7.5 },
  { role: 'pivot', x: 24, y: 11.5 },
];

function getFormationForFormat(format: MatchFormat): Array<{ role: FutsalRole; x: number; y: number }> {
  switch (format) {
    case '5v5': return FORMATION_121_HOME;
    case '7v7': return FORMATION_231;
    case '11v11': return FORMATION_442;
    default: return FORMATION_121_HOME;
  }
}

function homeSlotToPixels(slot: { x: number; y: number }): Vec2 {
  return { x: FIELD_X + slot.x * METER_PX, y: FIELD_Y + slot.y * METER_PX };
}

/** Returns the formation home position (pixels) for a player, mirrored for away. */
export function formationSlot(team: Team, index: number, format: MatchFormat = '5v5'): FormationSlot {
  const formation = getFormationForFormat(format);
  const base = formation[index] ?? formation[0];
  if (team === 0) {
    const px = homeSlotToPixels(base);
    return { role: base.role, x: px.x, y: px.y };
  }
  const px = homeSlotToPixels(base);
  return { role: base.role, x: 2 * FIELD_CX - px.x, y: px.y };
}

export function mirrorX(x: number): number { return 2 * FIELD_CX - x; }
export function roleForIndex(index: number, format: MatchFormat = '5v5'): FutsalRole {
  const formation = getFormationForFormat(format);
  return (formation[index] ?? formation[0]).role;
}

export function buildPlayers(format: MatchFormat = '5v5'): PlayerEntity[] {
  const count = FORMAT_PLAYER_COUNT[format];
  const players: PlayerEntity[] = [];
  let id = 0;
  for (let team = 0 as Team; team < 2; team = (team + 1) as Team) {
    for (let i = 0; i < count; i++) {
      const slot = formationSlot(team, i, format);
      players.push(makePlayer(id, team, slot.role, slot.x, slot.y));
      id++;
    }
  }
  return players;
}

export function makePlayer(
  id: number, team: Team, role: FutsalRole, x: number, y: number,
): PlayerEntity {
  const facing = team === 0 ? 0 : Math.PI;
  return {
    id, team, role,
    x, y, vx: 0, vy: 0,
    facing, moveDir: facing, aimDir: facing,
    maxSpeed: mpsFromRole(role).run,
    accel: 9,
    state: 'idle',
    slideCooldown: 0, hasBall: false, stunnedTime: 0, animTime: 0,
    aiTimer: 0, aiAction: 'idle', aiTarget: { x, y },
    diveDir: { x: 0, y: 0 }, diveTime: 0, actionLock: 0,
    baseFormationPosition: { x, y },
    dynamicFormationPosition: { x, y },
    supportTarget: null, markingTarget: null,
    personalSpaceRadius: m(1.4),
    tacticalRole: role,
    firstTouchQuality: 1,
    utilityScores: {},
    pokeCooldown: 0, shootPhase: 0,
    currentAction: null, lastContactTick: -1, stamina: 100,
    _sprintThisTick: false, _movingThisTick: false, _hasBallThisTick: false,
  };
}

function mpsFromRole(role: FutsalRole): { run: number; sprint: number } {
  if (role === 'goalkeeper') return { run: mps(MOVEMENT.jogSpeed), sprint: mps(MOVEMENT.runSpeed) };
  return { run: mps(MOVEMENT.runSpeed), sprint: mps(MOVEMENT.sprintSpeed) };
}

/** Reset all players to their formation slots. */
export function resetToFormation(players: PlayerEntity[], format: MatchFormat = '5v5'): void {
  const count = FORMAT_PLAYER_COUNT[format];
  for (const p of players) {
    const slot = formationSlot(p.team, indexInTeam(p.id, count), format);
    p.x = slot.x; p.y = slot.y;
    p.vx = 0; p.vy = 0;
    p.facing = p.team === 0 ? 0 : Math.PI;
    p.moveDir = p.facing; p.aimDir = p.facing;
    p.state = 'idle'; p.hasBall = false; p.stunnedTime = 0;
    p.slideCooldown = 0; p.actionLock = 0; p.diveTime = 0;
    p.aiAction = 'idle'; p.aiTarget = { x: slot.x, y: slot.y };
    p.baseFormationPosition = { x: slot.x, y: slot.y };
    p.dynamicFormationPosition = { x: slot.x, y: slot.y };
    p.supportTarget = null; p.markingTarget = null;
    p.shootPhase = 0;
  }
}

export function indexInTeam(playerId: number, count: number = 5): number { return playerId % count; }
export function teamOf(playerId: number, count: number = 5): Team { return (playerId < count ? 0 : 1) as Team; }
