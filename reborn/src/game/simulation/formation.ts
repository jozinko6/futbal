/**
 * Formation setup — data-driven, supports multiple formats.
 * Positions are in normalized coordinates (0..1 from own goal).
 */
import { FIELD_X, FIELD_Y, FIELD_W, FIELD_H, FIELD_CX, FORMAT_PLAYERS } from '../core/tuning';
import type { MatchFormat, PlayerRole, Team } from '../core/tuning';
import type { PlayerState, MatchState } from '../core/types';

interface FormationEntry { role: PlayerRole; x: number; y: number }

const FORMATIONS: Record<MatchFormat, FormationEntry[]> = {
  '3v3': [
    { role: 'GK', x: 0.06, y: 0.50 },
    { role: 'DEF', x: 0.30, y: 0.50 },
    { role: 'FWD', x: 0.60, y: 0.50 },
  ],
  '5v5': [
    { role: 'GK', x: 0.06, y: 0.50 },
    { role: 'DEF', x: 0.25, y: 0.25 },
    { role: 'DEF', x: 0.25, y: 0.75 },
    { role: 'MID', x: 0.45, y: 0.50 },
    { role: 'FWD', x: 0.65, y: 0.50 },
  ],
  '7v7': [
    { role: 'GK', x: 0.06, y: 0.50 },
    { role: 'DEF', x: 0.22, y: 0.25 },
    { role: 'DEF', x: 0.22, y: 0.75 },
    { role: 'MID', x: 0.40, y: 0.20 },
    { role: 'MID', x: 0.40, y: 0.50 },
    { role: 'MID', x: 0.40, y: 0.80 },
    { role: 'FWD', x: 0.62, y: 0.50 },
  ],
  '11v11': [
    { role: 'GK', x: 0.05, y: 0.50 },
    { role: 'DEF', x: 0.18, y: 0.15 },
    { role: 'DEF', x: 0.18, y: 0.38 },
    { role: 'DEF', x: 0.18, y: 0.62 },
    { role: 'DEF', x: 0.18, y: 0.85 },
    { role: 'MID', x: 0.35, y: 0.15 },
    { role: 'MID', x: 0.35, y: 0.38 },
    { role: 'MID', x: 0.35, y: 0.62 },
    { role: 'MID', x: 0.35, y: 0.85 },
    { role: 'FWD', x: 0.55, y: 0.35 },
    { role: 'FWD', x: 0.55, y: 0.65 },
  ],
};

function toPixels(team: Team, entry: FormationEntry): { x: number; y: number } {
  const px = FIELD_X + entry.x * FIELD_W;
  const py = FIELD_Y + entry.y * FIELD_H;
  if (team === 0) return { x: px, y: py };
  return { x: 2 * FIELD_CX - px, y: py };
}

export function buildPlayers(format: MatchFormat): PlayerState[] {
  const count = FORMAT_PLAYERS[format];
  const formation = FORMATIONS[format];
  const players: PlayerState[] = [];
  let id = 0;
  for (let team = 0 as Team; team < 2; team = (team + 1) as Team) {
    for (let i = 0; i < count; i++) {
      const entry = formation[i] ?? formation[0];
      const pos = toPixels(team, entry);
      players.push(makePlayer(id, team, entry.role, pos.x, pos.y, i === count - 1));
      id++;
    }
  }
  return players;
}

function makePlayer(id: number, team: Team, role: PlayerRole, x: number, y: number, isCaptain: boolean): PlayerState {
  const facing = team === 0 ? 0 : Math.PI;
  return {
    id, team, role, isCaptain,
    x, y, prevX: x, prevY: y, vx: 0, vy: 0,
    facing, desiredDirX: Math.cos(facing), desiredDirY: Math.sin(facing),
    movementMode: 'IDLE',
    currentAction: null, slideCooldown: 0, stunnedUntilTick: 0, animTime: 0,
    aiTimer: 0, aiTargetX: x, aiTargetY: y, teamAssignment: 'idle', utilityScores: {},
    baseX: x, baseY: y, markingTargetId: null,
    _brakedThisTurn: false,
  };
}

export function resetToFormation(state: MatchState): void {
  const format = state.format;
  const count = FORMAT_PLAYERS[format];
  const formation = FORMATIONS[format];
  for (const p of state.players) {
    const idx = p.id % count;
    const entry = formation[idx] ?? formation[0];
    const pos = toPixels(p.team, entry);
    p.x = pos.x; p.y = pos.y;
    p.prevX = pos.x; p.prevY = pos.y;
    p.vx = 0; p.vy = 0;
    p.facing = p.team === 0 ? 0 : Math.PI;
    p.movementMode = 'IDLE';
    p.currentAction = null;
    p.stunnedUntilTick = 0;
    p.slideCooldown = 0;
    p.baseX = pos.x; p.baseY = pos.y;
    p.markingTargetId = null;
    p._brakedThisTurn = false;
  }
}

export function getFormationPosition(team: Team, index: number, format: MatchFormat): { x: number; y: number } {
  const formation = FORMATIONS[format];
  const entry = formation[index] ?? formation[0];
  return toPixels(team, entry);
}
