/**
 * Dátovo riadené formácie — originálne, fiktívne.
 * Inšpirované všeobecnými futbalovými princípmi.
 */

export interface FormationSlot {
  role: string;
  baseX: number; // 0..1 (podiel dĺžky ihriska od vlastnej brány)
  baseY: number; // 0..1 (podiel šírky ihriska, 0 = hore, 1 = dole)
  attackingOffsetX: number;
  attackingOffsetY: number;
  defendingOffsetX: number;
  defendingOffsetY: number;
  supportRadius: number;
  pressPriority: number;
}

export interface FormationDefinition {
  id: string;
  name: string;
  slots: FormationSlot[];
}

// 4-4-2
export const F_442: FormationDefinition = {
  id: '4-4-2',
  name: '4-4-2',
  slots: [
    { role: 'GK', baseX: 0.05, baseY: 0.50, attackingOffsetX: 0, attackingOffsetY: 0, defendingOffsetX: 0, defendingOffsetY: 0, supportRadius: 0.1, pressPriority: 0 },
    { role: 'LB', baseX: 0.20, baseY: 0.15, attackingOffsetX: 0.10, attackingOffsetY: -0.05, defendingOffsetX: -0.02, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 2 },
    { role: 'CB', baseX: 0.18, baseY: 0.38, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'CB', baseX: 0.18, baseY: 0.62, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'RB', baseX: 0.20, baseY: 0.85, attackingOffsetX: 0.10, attackingOffsetY: 0.05, defendingOffsetX: -0.02, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 2 },
    { role: 'LM', baseX: 0.40, baseY: 0.15, attackingOffsetX: 0.10, attackingOffsetY: -0.05, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.38, baseY: 0.38, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.38, baseY: 0.62, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'RM', baseX: 0.40, baseY: 0.85, attackingOffsetX: 0.10, attackingOffsetY: 0.05, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'ST', baseX: 0.60, baseY: 0.38, attackingOffsetX: 0.15, attackingOffsetY: -0.05, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
    { role: 'ST', baseX: 0.60, baseY: 0.62, attackingOffsetX: 0.15, attackingOffsetY: 0.05, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
  ],
};

// 4-3-3
export const F_433: FormationDefinition = {
  id: '4-3-3',
  name: '4-3-3',
  slots: [
    { role: 'GK', baseX: 0.05, baseY: 0.50, attackingOffsetX: 0, attackingOffsetY: 0, defendingOffsetX: 0, defendingOffsetY: 0, supportRadius: 0.1, pressPriority: 0 },
    { role: 'LB', baseX: 0.20, baseY: 0.15, attackingOffsetX: 0.10, attackingOffsetY: -0.05, defendingOffsetX: -0.02, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 2 },
    { role: 'CB', baseX: 0.18, baseY: 0.38, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'CB', baseX: 0.18, baseY: 0.62, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'RB', baseX: 0.20, baseY: 0.85, attackingOffsetX: 0.10, attackingOffsetY: 0.05, defendingOffsetX: -0.02, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 2 },
    { role: 'CM', baseX: 0.35, baseY: 0.30, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.35, baseY: 0.50, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.35, baseY: 0.70, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'LW', baseX: 0.55, baseY: 0.20, attackingOffsetX: 0.15, attackingOffsetY: -0.05, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
    { role: 'ST', baseX: 0.60, baseY: 0.50, attackingOffsetX: 0.15, attackingOffsetY: 0, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
    { role: 'RW', baseX: 0.55, baseY: 0.80, attackingOffsetX: 0.15, attackingOffsetY: 0.05, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
  ],
};

// 3-5-2
export const F_352: FormationDefinition = {
  id: '3-5-2',
  name: '3-5-2',
  slots: [
    { role: 'GK', baseX: 0.05, baseY: 0.50, attackingOffsetX: 0, attackingOffsetY: 0, defendingOffsetX: 0, defendingOffsetY: 0, supportRadius: 0.1, pressPriority: 0 },
    { role: 'CB', baseX: 0.18, baseY: 0.25, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'CB', baseX: 0.18, baseY: 0.50, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'CB', baseX: 0.18, baseY: 0.75, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'LWB', baseX: 0.35, baseY: 0.10, attackingOffsetX: 0.15, attackingOffsetY: -0.05, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.35, baseY: 0.35, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.35, baseY: 0.50, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'CM', baseX: 0.35, baseY: 0.65, attackingOffsetX: 0.12, attackingOffsetY: 0, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'RWB', baseX: 0.35, baseY: 0.90, attackingOffsetX: 0.15, attackingOffsetY: 0.05, defendingOffsetX: -0.05, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 3 },
    { role: 'ST', baseX: 0.60, baseY: 0.38, attackingOffsetX: 0.15, attackingOffsetY: -0.05, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
    { role: 'ST', baseX: 0.60, baseY: 0.62, attackingOffsetX: 0.15, attackingOffsetY: 0.05, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 4 },
  ],
};

// 4-2-3-1
export const F_4231: FormationDefinition = {
  id: '4-2-3-1',
  name: '4-2-3-1',
  slots: [
    { role: 'GK', baseX: 0.05, baseY: 0.50, attackingOffsetX: 0, attackingOffsetY: 0, defendingOffsetX: 0, defendingOffsetY: 0, supportRadius: 0.1, pressPriority: 0 },
    { role: 'LB', baseX: 0.20, baseY: 0.15, attackingOffsetX: 0.10, attackingOffsetY: -0.05, defendingOffsetX: -0.02, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 2 },
    { role: 'CB', baseX: 0.18, baseY: 0.38, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'CB', baseX: 0.18, baseY: 0.62, attackingOffsetX: 0.05, attackingOffsetY: 0, defendingOffsetX: -0.03, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 1 },
    { role: 'RB', baseX: 0.20, baseY: 0.85, attackingOffsetX: 0.10, attackingOffsetY: 0.05, defendingOffsetX: -0.02, defendingOffsetY: 0, supportRadius: 0.15, pressPriority: 2 },
    { role: 'DM', baseX: 0.30, baseY: 0.38, attackingOffsetX: 0.08, attackingOffsetY: 0, defendingOffsetX: -0.04, defendingOffsetY: 0, supportRadius: 0.13, pressPriority: 2 },
    { role: 'DM', baseX: 0.30, baseY: 0.62, attackingOffsetX: 0.08, attackingOffsetY: 0, defendingOffsetX: -0.04, defendingOffsetY: 0, supportRadius: 0.13, pressPriority: 2 },
    { role: 'LW', baseX: 0.48, baseY: 0.20, attackingOffsetX: 0.12, attackingOffsetY: -0.05, defendingOffsetX: -0.06, defendingOffsetY: 0, supportRadius: 0.14, pressPriority: 4 },
    { role: 'AM', baseX: 0.48, baseY: 0.50, attackingOffsetX: 0.14, attackingOffsetY: 0, defendingOffsetX: -0.06, defendingOffsetY: 0, supportRadius: 0.14, pressPriority: 4 },
    { role: 'RW', baseX: 0.48, baseY: 0.80, attackingOffsetX: 0.12, attackingOffsetY: 0.05, defendingOffsetX: -0.06, defendingOffsetY: 0, supportRadius: 0.14, pressPriority: 4 },
    { role: 'ST', baseX: 0.62, baseY: 0.50, attackingOffsetX: 0.15, attackingOffsetY: 0, defendingOffsetX: -0.08, defendingOffsetY: 0, supportRadius: 0.12, pressPriority: 5 },
  ],
};

export const FORMATIONS: Record<string, FormationDefinition> = {
  '4-4-2': F_442,
  '4-3-3': F_433,
  '3-5-2': F_352,
  '4-2-3-1': F_4231,
};

export function getFormation(id: string): FormationDefinition {
  return FORMATIONS[id] ?? F_442;
}
