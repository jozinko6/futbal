/**
 * Futsal 5v5 formation (1-2-1): goalkeeper, fixo, leftAla, rightAla, pivot.
 * Home attacks right; away is mirrored across the halfway line.
 */
import {
  FIELD_CX, FIELD_CY, FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  METER_PX, m, mps, MOVEMENT, PLAYERS_PER_TEAM,
  FORMATION_121_HOME,
  type FutsalRole,
} from './constants';
import type { PlayerEntity, Team, Vec2 } from './types';

export interface FormationSlot { role: FutsalRole; x: number; y: number }

const FIELD_METRES_W = FIELD_W / METER_PX;
const FIELD_METRES_H = FIELD_H / METER_PX;

/** Convert a home-formation metre slot to world pixels (home = left half). */
function homeSlotToPixels(slot: { x: number; y: number }): Vec2 {
  return {
    x: FIELD_X + slot.x * METER_PX,
    y: FIELD_Y + slot.y * METER_PX,
  };
}

/** Returns the formation home position (pixels) for a player, mirrored for away. */
export function formationSlot(team: Team, index: number): FormationSlot {
  const base = FORMATION_121_HOME[index] ?? FORMATION_121_HOME[0];
  if (team === 0) {
    const px = homeSlotToPixels(base);
    return { role: base.role, x: px.x, y: px.y };
  }
  // Mirror across the halfway line for away.
  const px = homeSlotToPixels(base);
  return { role: base.role, x: 2 * FIELD_CX - px.x, y: px.y };
}

export function mirrorX(x: number): number { return 2 * FIELD_CX - x; }
export function roleForIndex(index: number): FutsalRole {
  return (FORMATION_121_HOME[index] ?? FORMATION_121_HOME[0]).role;
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
    supportTarget: null,
    markingTarget: null,
    personalSpaceRadius: m(1.4),
    tacticalRole: role,
    firstTouchQuality: 1,
    utilityScores: {},
    pokeCooldown: 0,
    shootPhase: 0,
    currentAction: null,
    lastContactTick: -1,
    stamina: 100,
    _sprintThisTick: false,
    _movingThisTick: false,
    _hasBallThisTick: false,
  };
}

/** Speeds (px/s) for a role, derived from the SI config. */
function mpsFromRole(role: FutsalRole): { run: number; sprint: number } {
  if (role === 'goalkeeper') {
    return { run: mps(MOVEMENT.jogSpeed), sprint: mps(MOVEMENT.runSpeed) };
  }
  return { run: mps(MOVEMENT.runSpeed), sprint: mps(MOVEMENT.sprintSpeed) };
}

/** Reset all players to their formation slots. */
export function resetToFormation(players: PlayerEntity[]): void {
  for (const p of players) {
    const slot = formationSlot(p.team, indexInTeam(p.id));
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

export function indexInTeam(playerId: number): number { return playerId % PLAYERS_PER_TEAM; }
export function teamOf(playerId: number): Team { return (playerId < PLAYERS_PER_TEAM ? 0 : 1) as Team; }
export { PLAYERS_PER_TEAM };
