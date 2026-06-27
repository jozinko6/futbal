'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  DIFFICULTY_PARAMS,
  HALF_LENGTH_OPTIONS,
  TEAM_COLORS,
  type Difficulty,
  type Team,
} from '@/game/simulation';

export interface MatchConfig {
  mode: 'solo' | '2p';
  difficulty: Difficulty;
  halfLength: number;
  humanTeam: Team;
}

export interface Settings {
  sound: boolean;
  showTouch: boolean;
  autoSwitch: boolean;
}

const PANEL =
  'rounded-xl border-2 border-emerald-400/40 bg-emerald-950/70 backdrop-blur-sm shadow-[0_0_0_2px_rgba(0,0,0,0.4)]';

export function RetroButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'variant'> & { variant?: 'primary' | 'ghost' }) {
  return (
    <Button
      {...props}
      className={
        (variant === 'primary'
          ? 'bg-amber-400 text-emerald-950 hover:bg-amber-300 border-2 border-amber-200/60'
          : 'bg-transparent text-emerald-100 hover:bg-emerald-800/60 border-2 border-emerald-400/50') +
        ' font-mono font-bold tracking-wide uppercase text-sm rounded-lg h-11 ' +
        className
      }
    >
      {children}
    </Button>
  );
}

export function Logo() {
  return (
    <div className="text-center">
      <h1
        className="font-mono font-black uppercase leading-none text-amber-300"
        style={{ fontSize: 'clamp(2rem, 7vw, 4.5rem)', textShadow: '4px 4px 0 #064e3b, 8px 8px 0 rgba(0,0,0,0.4)' }}
      >
        Kačanovská
      </h1>
      <h2
        className="font-mono font-bold uppercase tracking-[0.4em] text-emerald-300 mt-1"
        style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)' }}
      >
        FIFA
      </h2>
    </div>
  );
}

interface MenuProps {
  onPlay: () => void;
  onLocal2P: () => void;
  onOnline: () => void;
  onSettings: () => void;
  onHowTo: () => void;
}

export function MenuScreen({ onPlay, onLocal2P, onOnline, onSettings, onHowTo }: MenuProps) {
  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto">
      <div className="m-auto flex w-full max-w-sm flex-col items-center gap-4 p-4">
        <Logo />
        <div className={`${PANEL} flex w-full flex-col gap-2.5 p-5`}>
          <RetroButton onClick={onPlay} className="w-full">
            Hrať zápas (vs AI)
          </RetroButton>
          <RetroButton onClick={onLocal2P} className="w-full">
            Lokálny 2 hráči
          </RetroButton>
          <RetroButton onClick={onOnline} className="w-full">
            Online 1v1
          </RetroButton>
          <RetroButton variant="ghost" onClick={onHowTo} className="w-full">
            Ako hrať
          </RetroButton>
          <RetroButton variant="ghost" onClick={onSettings} className="w-full">
            Nastavenia
          </RetroButton>
        </div>
        <p className="font-mono text-[10px] text-emerald-300/70">
          Originálna arkáda · 5 vs 5 · pixel-art
        </p>
      </div>
    </div>
  );
}

interface TeamSelectProps {
  initial: MatchConfig;
  onStart: (cfg: MatchConfig) => void;
  onBack: () => void;
}

export function TeamSelectScreen({ initial, onStart, onBack }: TeamSelectProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [halfIdx, setHalfIdx] = useState<number>(
    Math.max(0, HALF_LENGTH_OPTIONS.indexOf(initial.halfLength as (typeof HALF_LENGTH_OPTIONS)[number])),
  );
  const [humanTeam, setHumanTeam] = useState<Team>(initial.humanTeam);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4">
      <h2 className="font-mono text-2xl font-black uppercase text-amber-300">Nastavenie zápasu</h2>
      <div className={`${PANEL} grid w-full max-w-lg gap-5 p-6`}>
        {/* Team pick */}
        <div>
          <Label>Tvoj tím</Label>
          <div className="grid grid-cols-2 gap-3">
            <TeamCard
              active={humanTeam === 0}
              onClick={() => setHumanTeam(0)}
              name="ČERVENÍ"
              color={TEAM_COLORS.home.jersey}
              trim={TEAM_COLORS.home.trim}
            />
            <TeamCard
              active={humanTeam === 1}
              onClick={() => setHumanTeam(1)}
              name="MODRÍ"
              color={TEAM_COLORS.away.jersey}
              trim={TEAM_COLORS.away.trim}
            />
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <Label>Náročnosť AI</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
              <RetroButton
                key={d}
                variant={difficulty === d ? 'primary' : 'ghost'}
                onClick={() => setDifficulty(d)}
                className="w-full"
              >
                {d === 'easy' ? 'Ľahké' : d === 'normal' ? 'Normál' : 'Ťažké'}
              </RetroButton>
            ))}
          </div>
          <p className="mt-1 font-mono text-[10px] text-emerald-300/60">
            reakcia {DIFFICULTY_PARAMS[difficulty].reactionMs}ms · presnosť{' '}
            {Math.round(DIFFICULTY_PARAMS[difficulty].precision * 100)}%
          </p>
        </div>

        {/* Half length */}
        <div>
          <Label>Dĺžka polčasu: {formatTime(HALF_LENGTH_OPTIONS[halfIdx])}</Label>
          <div className="grid grid-cols-4 gap-2">
            {HALF_LENGTH_OPTIONS.map((len, i) => (
              <RetroButton
                key={len}
                variant={halfIdx === i ? 'primary' : 'ghost'}
                onClick={() => setHalfIdx(i)}
                className="w-full px-0"
              >
                {formatTime(len)}
              </RetroButton>
            ))}
          </div>
        </div>

        <div className="mt-2 flex gap-3">
          <RetroButton variant="ghost" onClick={onBack} className="flex-1">
            Späť
          </RetroButton>
          <RetroButton
            onClick={() =>
              onStart({
                mode: initial.mode,
                difficulty,
                halfLength: HALF_LENGTH_OPTIONS[halfIdx],
                humanTeam,
              })
            }
            className="flex-[2]"
          >
            ŠTART
          </RetroButton>
        </div>
      </div>
    </div>
  );
}

function TeamCard({
  active,
  onClick,
  name,
  color,
  trim,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  color: string;
  trim: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
        active ? 'border-amber-300 bg-amber-300/10' : 'border-emerald-400/40 bg-emerald-900/40'
      }`}
    >
      <span
        className="inline-block h-8 w-8 rounded-full border-2"
        style={{ background: color, borderColor: trim }}
      />
      <span className="font-mono text-sm font-bold text-white">{name}</span>
    </button>
  );
}

interface SettingsProps {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onChange, onBack }: SettingsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4">
      <h2 className="font-mono text-2xl font-black uppercase text-amber-300">Nastavenia</h2>
      <div className={`${PANEL} w-full max-w-md space-y-5 p-6`}>
        <Row label="Zvuk">
          <Switch
            checked={settings.sound}
            onCheckedChange={(v) => onChange({ ...settings, sound: v })}
          />
        </Row>
        <Row label="Mobilné ovládanie">
          <Switch
            checked={settings.showTouch}
            onCheckedChange={(v) => onChange({ ...settings, showTouch: v })}
          />
        </Row>
        <Row label="Auto-prepínanie hráča">
          <Switch
            checked={settings.autoSwitch}
            onCheckedChange={(v) => onChange({ ...settings, autoSwitch: v })}
          />
        </Row>
        <RetroButton variant="ghost" onClick={onBack} className="mt-2 w-full">
          Späť
        </RetroButton>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-sm text-emerald-100">{label}</span>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-xs uppercase tracking-wider text-emerald-300/80">{children}</p>
  );
}

export function HowToScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <h2 className="font-mono text-2xl font-black uppercase text-amber-300">Ako hrať</h2>
      <div className={`${PANEL} w-full max-w-lg space-y-3 p-6 font-mono text-sm text-emerald-100`}>
        <Control keys="WASD / Šípky" desc="Pohyb (analóg = rýchlosť)" />
        <Control keys="J" desc="S loptou: prihrávka / Bez lopty: obrana" />
        <Control keys="I" desc="Lob prihrávka / modifikátor strely" />
        <Control keys="K" desc="S loptou: strela / Bez lopty: sklz" />
        <Control keys="L / Shift" desc="Šprint" />
        <Control keys="Q" desc="Prepnutie hráča" />
        <Control keys="Esc" desc="Pauza" />
        <div className="my-2 h-px bg-emerald-400/30" />
        <p className="text-xs text-emerald-300/70">One-touch pass: stlač J tesne pred príchodom lopty.</p>
        <p className="text-xs text-emerald-300/70">Gamepad: A=prihrávka/obrana, B=strela/sklz, X=lob, RB=šprint, LB=prepínať.</p>
        <p className="text-xs text-emerald-300/70">Mobil: virtuálny joystick + tlačidlá, landscape, multitouch.</p>
      </div>
      <RetroButton variant="ghost" onClick={onBack} className="w-full max-w-lg">
        Späť
      </RetroButton>
    </div>
  );
}

function Control({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="min-w-[120px] rounded border-2 border-amber-300/60 bg-amber-300/10 px-2 py-1 text-center text-xs text-amber-200">
        {keys}
      </kbd>
      <span>{desc}</span>
    </div>
  );
}

interface PauseProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit, settings, onSettingsChange }: PauseProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className={`${PANEL} w-full max-w-xs space-y-3 p-6`}>
        <h2 className="text-center font-mono text-2xl font-black uppercase text-amber-300">Pauza</h2>
        <Row label="Zvuk">
          <Switch
            checked={settings.sound}
            onCheckedChange={(v) => onSettingsChange({ ...settings, sound: v })}
          />
        </Row>
        <Row label="Mobilné ovládanie">
          <Switch
            checked={settings.showTouch}
            onCheckedChange={(v) => onSettingsChange({ ...settings, showTouch: v })}
          />
        </Row>
        <RetroButton onClick={onResume} className="w-full">Pokračovať</RetroButton>
        <RetroButton variant="ghost" onClick={onRestart} className="w-full">Reštart zápasu</RetroButton>
        <RetroButton variant="ghost" onClick={onQuit} className="w-full">Hlavné menu</RetroButton>
      </div>
    </div>
  );
}

interface ResultsProps {
  score: [number, number];
  halfLength: number;
  onRematch: () => void;
  onMenu: () => void;
}

export function ResultsScreen({ score, halfLength, onRematch, onMenu }: ResultsProps) {
  const [home, away] = score;
  const winner = home === away ? 'remíza' : home > away ? 'ČERVENÍ' : 'MODRÍ';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4">
      <h2 className="font-mono text-3xl font-black uppercase text-amber-300">Koniec zápasu</h2>
      <div className={`${PANEL} flex w-full max-w-md flex-col items-center gap-3 p-8`}>
        <div className="font-mono text-xs uppercase tracking-widest text-emerald-300/70">Výsledok</div>
        <div className="flex items-center gap-6">
          <TeamBadge color={TEAM_COLORS.home.jersey} trim={TEAM_COLORS.home.trim} name="ČERVENÍ" />
          <div className="font-mono text-5xl font-black text-white">
            {home} <span className="text-emerald-400/60">:</span> {away}
          </div>
          <TeamBadge color={TEAM_COLORS.away.jersey} trim={TEAM_COLORS.away.trim} name="MODRÍ" />
        </div>
        <div className="mt-2 font-mono text-lg text-amber-200">
          {home === away ? '🤝 Remíza' : `🏆 ${winner} vyhrali`}
        </div>
        <div className="font-mono text-[10px] text-emerald-300/50">Polčas: {formatTime(halfLength)}</div>
        <div className="mt-4 flex w-full gap-3">
          <RetroButton variant="ghost" onClick={onMenu} className="flex-1">Menu</RetroButton>
          <RetroButton onClick={onRematch} className="flex-[2]">Rematch</RetroButton>
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ color, trim, name }: { color: string; trim: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="h-7 w-7 rounded-full border-2" style={{ background: color, borderColor: trim }} />
      <span className="font-mono text-[10px] text-white">{name}</span>
    </div>
  );
}

export function LobbyScreen({ onLeave }: { onLeave: () => void }) {
  const [code] = useState(() => generateCode());
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4">
      <h2 className="font-mono text-2xl font-black uppercase text-amber-300">Online miestnosť</h2>
      <div className={`${PANEL} w-full max-w-md space-y-4 p-6 text-center`}>
        <p className="font-mono text-sm text-emerald-100">Kód miestnosti</p>
        <div className="font-mono text-4xl font-black tracking-[0.5em] text-amber-300">{code}</div>
        <p className="font-mono text-xs text-emerald-300/70">
          Autoritatívny Socket.IO server (packages/simulation + apps/server) beží na samostatnom
          porte. V tomto jednopoužívateľskom sandboxe otvor druhý preview tab a zadaj rovnaký kód.
        </p>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-900/40 p-3 text-left font-mono text-[11px] text-emerald-200/80">
          <div>Stav: čaká na súpera (0/2)</div>
          <div>Ping: —</div>
          <div>Režim: 1v1, server je autoritatívny</div>
        </div>
        <RetroButton variant="ghost" onClick={onLeave} className="w-full">Opustiť</RetroButton>
      </div>
    </div>
  );
}

function generateCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}:${s.toString().padStart(2, '0')}`;
}

export { Slider };
