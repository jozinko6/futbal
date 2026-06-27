/**
 * Player and team data definitions — originálne fiktívne tímy.
 *
 * Inšpirované všeobecným dátovým formátom futbalových hier.
 * Žiadne reálne tímy, hráči ani logá.
 */

export type PlayerRole =
  | 'GK' | 'LB' | 'CB' | 'RB' | 'DM' | 'CM' | 'AM'
  | 'LW' | 'RW' | 'ST' | 'CF';

export interface PlayerSkills {
  passing: number;      // 1-99
  shooting: number;
  heading: number;
  tackling: number;
  control: number;
  speed: number;
  finishing: number;
  goalkeeping: number;
  stamina: number;
}

export interface PlayerAppearance {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  height: number; // cm
}

export type PlayerTrait =
  | 'SPEEDSTER' | 'PLAYMAKER' | 'FINISHER' | 'WALL'
  | 'AERIAL_THREAT' | 'TACKLER' | 'LONG_SHOT' | 'CAPTAIN';

export interface PlayerDefinition {
  id: string;
  name: string;
  shirtName: string;
  number: number;
  role: PlayerRole;
  nationality?: string;
  appearance: PlayerAppearance;
  skills: PlayerSkills;
  traits: PlayerTrait[];
}

export interface KitDefinition {
  shirt1: string;
  shirt2: string;
  shorts: string;
  socks: string;
  style: 'PLAIN' | 'STRIPED' | 'HOOPED' | 'SASH';
}

export interface TeamRatings {
  speed: number;
  power: number;
  technique: number;
  goalkeeper: number;
}

export interface TeamDefinition {
  id: string;
  name: string;
  shortName: string;
  type: 'CLUB' | 'NATIONAL' | 'CUSTOM';
  kits: KitDefinition[];
  players: PlayerDefinition[];
  lineup: string[];
  substitutes: string[];
  formationId: string;
  captainId: string;
  stadiumId?: string;
  ratings: TeamRatings;
}

// --- Originálne fiktívne tímy ---

const SKILLS_GK: PlayerSkills = { passing: 40, shooting: 10, heading: 30, tackling: 20, control: 40, speed: 30, finishing: 5, goalkeeping: 80, stamina: 70 };
const SKILLS_DEF: PlayerSkills = { passing: 55, shooting: 30, heading: 65, tackling: 70, control: 55, speed: 60, finishing: 25, goalkeeping: 5, stamina: 75 };
const SKILLS_MID: PlayerSkills = { passing: 70, shooting: 50, heading: 50, tackling: 55, control: 70, speed: 65, finishing: 45, goalkeeping: 5, stamina: 80 };
const SKILLS_FWD: PlayerSkills = { passing: 60, shooting: 75, heading: 60, tackling: 30, control: 70, speed: 75, finishing: 75, goalkeeping: 5, stamina: 75 };
const SKILLS_CAP: PlayerSkills = { passing: 80, shooting: 85, heading: 65, tackling: 50, control: 85, speed: 80, finishing: 85, goalkeeping: 5, stamina: 90 };

function makePlayer(id: string, name: string, num: number, role: PlayerRole, skills: PlayerSkills, traits: PlayerTrait[] = []): PlayerDefinition {
  return {
    id, name, shirtName: name.split(' ').pop() ?? name, number: num, role,
    appearance: { skinColor: '#f1c27d', hairColor: '#3b2a1a', hairStyle: 'short', height: 180 },
    skills, traits,
  };
}

export const TEAMS: TeamDefinition[] = [
  {
    id: 'crimson',
    name: 'CRIMSON FC',
    shortName: 'CRM',
    type: 'CLUB',
    kits: [
      { shirt1: '#e23b3b', shirt2: '#ffffff', shorts: '#1f2937', socks: '#e23b3b', style: 'PLAIN' },
      { shirt1: '#1f2937', shirt2: '#e23b3b', shorts: '#ffffff', socks: '#1f2937', style: 'STRIPED' },
    ],
    players: [
      makePlayer('crm-gk', 'KEEPER', 1, 'GK', SKILLS_GK),
      makePlayer('crm-lb', 'LEFTBACK', 2, 'LB', SKILLS_DEF),
      makePlayer('crm-cb1', 'CENTERBACK', 4, 'CB', SKILLS_DEF),
      makePlayer('crm-cb2', 'STOPPER', 5, 'CB', SKILLS_DEF),
      makePlayer('crm-rb', 'RIGHTBACK', 3, 'RB', SKILLS_DEF),
      makePlayer('crm-dm', 'ANCHOR', 6, 'DM', SKILLS_MID),
      makePlayer('crm-cm1', 'PLAYMAKER', 8, 'CM', { ...SKILLS_MID, passing: 80 }),
      makePlayer('crm-cm2', 'BOXBOX', 10, 'CM', SKILLS_MID),
      makePlayer('crm-lw', 'WINGER', 7, 'LW', { ...SKILLS_FWD, speed: 85 }),
      makePlayer('crm-st', 'STRIKER', 9, 'ST', { ...SKILLS_FWD, finishing: 85 }),
      makePlayer('crm-captain', 'CAPTAIN', 11, 'CF', SKILLS_CAP, ['CAPTAIN', 'FINISHER']),
    ],
    lineup: ['crm-gk','crm-lb','crm-cb1','crm-cb2','crm-rb','crm-dm','crm-cm1','crm-cm2','crm-lw','crm-st','crm-captain'],
    substitutes: [],
    formationId: '4-4-2',
    captainId: 'crm-captain',
    ratings: { speed: 72, power: 68, technique: 75, goalkeeper: 80 },
  },
  {
    id: 'azure',
    name: 'AZURE UNITED',
    shortName: 'AZU',
    type: 'CLUB',
    kits: [
      { shirt1: '#2f7fd4', shirt2: '#ffd23f', shorts: '#0b1f3a', socks: '#2f7fd4', style: 'PLAIN' },
      { shirt1: '#ffd23f', shirt2: '#2f7fd4', shorts: '#0b1f3a', socks: '#ffd23f', style: 'HOOPED' },
    ],
    players: [
      makePlayer('azu-gk', 'GUARDIAN', 1, 'GK', SKILLS_GK),
      makePlayer('azu-lb', 'SHIELD', 2, 'LB', SKILLS_DEF),
      makePlayer('azu-cb1', 'ROCK', 4, 'CB', { ...SKILLS_DEF, tackling: 80 }),
      makePlayer('azu-cb2', 'TOWER', 5, 'CB', { ...SKILLS_DEF, heading: 80 }),
      makePlayer('azu-rb', 'FLANK', 3, 'RB', SKILLS_DEF),
      makePlayer('azu-dm', 'SWEEPER', 6, 'DM', { ...SKILLS_MID, tackling: 70 }),
      makePlayer('azu-cm1', 'MAESTRO', 8, 'CM', { ...SKILLS_MID, passing: 85 }),
      makePlayer('azu-cm2', 'ENGINE', 10, 'CM', { ...SKILLS_MID, stamina: 90 }),
      makePlayer('azu-rw', 'DASHER', 7, 'RW', { ...SKILLS_FWD, speed: 88 }),
      makePlayer('azu-st', 'SNIPER', 9, 'ST', { ...SKILLS_FWD, shooting: 85 }),
      makePlayer('azu-captain', 'LEADER', 11, 'CF', SKILLS_CAP, ['CAPTAIN', 'LONG_SHOT']),
    ],
    lineup: ['azu-gk','azu-lb','azu-cb1','azu-cb2','azu-rb','azu-dm','azu-cm1','azu-cm2','azu-rw','azu-st','azu-captain'],
    substitutes: [],
    formationId: '4-3-3',
    captainId: 'azu-captain',
    ratings: { speed: 78, power: 65, technique: 72, goalkeeper: 80 },
  },
  {
    id: 'emerald',
    name: 'EMERALD CITY',
    shortName: 'EME',
    type: 'CLUB',
    kits: [
      { shirt1: '#22c55e', shirt2: '#000000', shorts: '#000000', socks: '#22c55e', style: 'STRIPED' },
      { shirt1: '#000000', shirt2: '#22c55e', shorts: '#22c55e', socks: '#000000', style: 'PLAIN' },
    ],
    players: [
      makePlayer('eme-gk', 'WALL', 1, 'GK', { ...SKILLS_GK, goalkeeping: 85 }),
      makePlayer('eme-lb', 'SPRINT', 2, 'LB', { ...SKILLS_DEF, speed: 80 }),
      makePlayer('eme-cb1', 'GIANT', 4, 'CB', { ...SKILLS_DEF, heading: 85 }),
      makePlayer('eme-cb2', 'BULL', 5, 'CB', { ...SKILLS_DEF, tackling: 85 }),
      makePlayer('eme-rb', 'DASH', 3, 'RB', { ...SKILLS_DEF, speed: 78 }),
      makePlayer('eme-dm', 'SHIELD', 6, 'DM', { ...SKILLS_MID, tackling: 75 }),
      makePlayer('eme-cm1', 'BRAIN', 8, 'CM', { ...SKILLS_MID, passing: 82 }),
      makePlayer('eme-cm2', 'HEART', 10, 'CM', { ...SKILLS_MID, stamina: 88 }),
      makePlayer('eme-lw', 'FLASH', 7, 'LW', { ...SKILLS_FWD, speed: 90 }, ['SPEEDSTER']),
      makePlayer('eme-st', 'BOMB', 9, 'ST', { ...SKILLS_FWD, shooting: 80 }),
      makePlayer('eme-captain', 'KING', 11, 'CF', SKILLS_CAP, ['CAPTAIN', 'FINISHER']),
    ],
    lineup: ['eme-gk','eme-lb','eme-cb1','eme-cb2','eme-rb','eme-dm','eme-cm1','eme-cm2','eme-lw','eme-st','eme-captain'],
    substitutes: [],
    formationId: '4-2-3-1',
    captainId: 'eme-captain',
    ratings: { speed: 82, power: 72, technique: 70, goalkeeper: 85 },
  },
];

export function getTeam(id: string): TeamDefinition | undefined {
  return TEAMS.find((t) => t.id === id);
}

export function getTeamByIndex(index: number): TeamDefinition {
  return TEAMS[index % TEAMS.length];
}
