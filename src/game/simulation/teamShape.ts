/**
 * Team Shape — dynamický tvar tímu podľa zóny lopty, vlastníctva a fázy.
 *
 * Inšpirované všeobecným futbalovým konceptom zón a formácií.
 * Originálna TypeScript implementácia.
 *
 * Hráči sa neposúvajú rovnakým vektorom za loptou — každý reaguje podľa
 * svojej roly, zóny lopty a útočnej/obrannej fázy.
 */
import { FIELD_X, FIELD_RIGHT, FIELD_W, FIELD_H, FIELD_Y, m } from './constants';
import type { MatchState, PlayerEntity, Team } from './types';
import { getBallZone, type BallZoneId } from './ballZones';
import { getFormation, type FormationDefinition, type FormationSlot } from '@/game/data/formations';

export interface TeamShapeConfig {
  formationId: string;
  attackingWidth: number;
  defensiveWidth: number;
  attackingDepth: number;
  defensiveDepth: number;
}

/** Vypočítaj dynamickú pozíciu hráča podľa formácie a zóny lopty. */
export function calculateDynamicPosition(
  state: MatchState,
  player: PlayerEntity,
  formation: FormationDefinition,
  config: TeamShapeConfig,
): { x: number; y: number } {
  if (player.role === 'goalkeeper') {
    // Brankár — vlastná bránka.
    const ownGoalX = player.team === 0 ? FIELD_X : FIELD_RIGHT;
    return { x: ownGoalX + (player.team === 0 ? m(1) : -m(1)), y: FIELD_Y + FIELD_H / 2 };
  }

  // Nájdi slot v formácii podľa role a indexu.
  const slotIndex = state.players
    .filter((p) => p.team === player.team && p.role === player.role)
    .indexOf(player);
  const slot = formation.slots[Math.min(slotIndex + 1, formation.slots.length - 1)] ?? formation.slots[1];

  // Normalizovaná pozícia lopty (0..1 od vlastnej brány).
  const ballNormX = (state.ball.x - FIELD_X) / FIELD_W;
  const ballNormY = (state.ball.y - FIELD_Y) / FIELD_H;
  const teamBallX = player.team === 0 ? ballNormX : 1 - ballNormX;
  const teamBallY = ballNormY;

  // Zóna lopty.
  const zone = getBallZone(teamBallX, teamBallY, player.team);

  // Vlastníctvo — útočíme alebo bránime?
  const owner = state.ball.ownerId != null ? state.players[state.ball.ownerId] : null;
  const weHaveBall = owner != null && owner.team === player.team;

  // Základná pozícia (v pixeloch).
  const ownGoalX = player.team === 0 ? FIELD_X : FIELD_RIGHT;
  const dirSign = player.team === 0 ? 1 : -1;
  const baseX = ownGoalX + dirSign * slot.baseX * FIELD_W;
  const baseY = FIELD_Y + slot.baseY * FIELD_H;

  // Offset podľa fázy.
  let offsetX = 0;
  let offsetY = 0;

  if (weHaveBall) {
    // Útok — posuň sa dopredu.
    offsetX = slot.attackingOffsetX * FIELD_W * dirSign;
    offsetY = slot.attackingOffsetY * FIELD_H;
  } else {
    // Obrana — stiahni sa.
    offsetX = slot.defendingOffsetX * FIELD_W * dirSign;
    offsetY = slot.defendingOffsetY * FIELD_H;
  }

  // Posun smerom k lopte (mierne, podľa zóny).
  const ballShiftX = (state.ball.x - FIELD_X - FIELD_W / 2) * 0.15;
  const ballShiftY = (state.ball.y - FIELD_Y - FIELD_H / 2) * 0.15;

  // Kompresia tímu — pri obrane sa stiahni.
  if (!weHaveBall) {
    const compressFactor = 0.3;
    const center = FIELD_X + FIELD_W / 2;
    return {
      x: baseX + offsetX + (ballShiftX - (baseX - center) * compressFactor) * 0.5,
      y: baseY + offsetY + ballShiftY * 0.3,
    };
  }

  return {
    x: baseX + offsetX + ballShiftX * 0.3,
    y: baseY + offsetY + ballShiftY * 0.2,
  };
}

/** Predvolená konfigurácia tímového tvaru. */
export const DEFAULT_TEAM_SHAPE: TeamShapeConfig = {
  formationId: '4-4-2',
  attackingWidth: 0.9,
  defensiveWidth: 0.6,
  attackingDepth: 0.7,
  defensiveDepth: 0.3,
};
