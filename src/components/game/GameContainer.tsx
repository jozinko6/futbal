'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMatchState,
  stepMulti,
  FIXED_DT,
  MAX_FRAME_ACCUM,
  type MatchState,
  type InputFrame,
  type Team,
} from '@/game/simulation';
import { createCamera, updateCamera } from '@/game/render/camera';
import { createRenderAssets, render, type RenderAssets } from '@/game/render/renderer';
import { InputManager, P2_KEYS, P1_KEYS, type TouchState } from '@/game/input/InputManager';
import { getSound } from '@/game/audio/Sound';
import { PresentationManager } from '@/game/presentation/presentationManager';
import { TouchControls } from './TouchControls';
import { OnlineLobby, type OnlineConfig } from './OnlineLobby';
import { OnlineMatch } from './OnlineMatch';
import { NetClient } from '@/game/net/client';
import {
  HowToScreen,
  LobbyScreen,
  MenuScreen,
  PauseOverlay,
  ResultsScreen,
  SettingsScreen,
  TeamSelectScreen,
  type MatchConfig,
  type Settings,
} from './Screens';

function handleSoundEvents(
  sound: ReturnType<typeof getSound>,
  s: MatchState,
  prevScore: [number, number],
  prevOwner: number | null,
  prevPeriod: string,
): void {
  // Most sounds are now triggered via PresentationEvents (BALL_KICKED, GOAL_SCORED, etc.)
  // consumed by PresentationManager. This fallback handles period-change whistles.
  if (s.period !== prevPeriod) {
    if (s.period === 'kickoff' || s.period === 'halftime' || s.period === 'fulltime') {
      sound.whistle();
    }
  }
}

type Scene =
  | 'menu'
  | 'teamselect'
  | 'howto'
  | 'settings'
  | 'lobby'
  | 'match'
  | 'online_lobby'
  | 'online_match'
  | 'results';

const DEFAULT_CONFIG: MatchConfig = {
  mode: 'solo',
  difficulty: 'normal',
  halfLength: 120,
  humanTeam: 0 as Team,
};

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  showTouch: false,
  autoSwitch: true,
};

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  let stored: Partial<Settings> = {};
  try {
    const raw = localStorage.getItem('rfa-settings');
    if (raw) stored = JSON.parse(raw) as Partial<Settings>;
  } catch {
    /* ignore */
  }
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // First load with no stored prefs -> enable touch controls on touch devices.
  return { ...DEFAULT_SETTINGS, showTouch: isTouch, ...stored };
}

export function GameContainer() {
  const [scene, setScene] = useState<Scene>('menu');
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_CONFIG);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [paused, setPaused] = useState(false);
  const [finalScore, setFinalScore] = useState<[number, number]>([0, 0]);
  const [matchKey, setMatchKey] = useState(0);
  const [resultsOnline, setResultsOnline] = useState(false);
  const [net, setNet] = useState<NetClient | null>(null);
  const [onlineConfig, setOnlineConfig] = useState<OnlineConfig>({
    difficulty: 'normal',
    halfLength: 120,
    team: 0 as Team,
    name: '',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mutable game objects kept in refs to avoid re-renders during the match.
  const matchRef = useRef<MatchState | null>(null);
  const camRef = useRef(createCamera());
  const assetsRef = useRef<RenderAssets | null>(null);
  const presRef = useRef<PresentationManager | null>(null);
  const input1Ref = useRef<InputManager | null>(null);
  const input2Ref = useRef<InputManager | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const prevScoreRef = useRef<[number, number]>([0, 0]);
  const prevOwnerRef = useRef<number | null>(null);
  const prevPeriodRef = useRef<string>('');
  const pausedRef = useRef(false);
  const settingsRef = useRef(settings);
  const sound = getSound();

  useEffect(() => {
    settingsRef.current = settings;
    sound.setMuted(!settings.sound);
  }, [settings, sound]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Persist settings.
  useEffect(() => {
    try {
      localStorage.setItem('rfa-settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // Debug overlay toggle (F3 or B).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'f3' || k === 'b') {
        const s = matchRef.current;
        if (s) s.debug = !s.debug;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Persist settings.
  useEffect(() => {
    try {
      localStorage.setItem('rfa-settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // --- Canvas integer scaling ---
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      let scale = Math.floor(Math.min(cw / 640, ch / 360));
      if (scale < 1) {
        // Small screen: fractional fit, keep crisp via pixelated rendering.
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      } else {
        canvas.style.width = `${640 * scale}px`;
        canvas.style.height = `${360 * scale}px`;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [scene, matchKey]);

  // --- Match lifecycle ---
  useEffect(() => {
    if (scene !== 'match') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Build assets / state / inputs.
    if (!assetsRef.current) {
      assetsRef.current = createRenderAssets();
    }
    const state = createMatchState({
      difficulty: config.difficulty,
      halfLength: config.halfLength,
      humanTeam: config.humanTeam,
      humanPlayers: config.mode === '2p' ? 2 : 1,
      autoSwitch: settingsRef.current.autoSwitch,
    });
    // Apply autoSwitch setting to all controllers.
    for (const c of state.controllers) c.autoSwitch = settingsRef.current.autoSwitch;
    matchRef.current = state;
    camRef.current = createCamera();
    presRef.current = new PresentationManager();
    presRef.current.setSound(sound);
    prevScoreRef.current = [0, 0];
    prevOwnerRef.current = null;
    prevPeriodRef.current = state.period;
    accRef.current = 0;
    lastRef.current = performance.now();
    pausedRef.current = false;

    input1Ref.current = new InputManager({
      keys: P1_KEYS,
      useGamepad: config.mode === 'solo',
      gamepadIndex: 0,
      onPause: config.mode === 'solo' ? togglePause : undefined,
    });
    if (config.mode === '2p') {
      input2Ref.current = new InputManager({
        keys: P2_KEYS,
        useGamepad: true,
        gamepadIndex: 0,
        onPause: togglePause,
      });
    } else {
      input2Ref.current = null;
    }

    sound.setMuted(!settingsRef.current.sound);
    sound.resume();
    sound.startCrowd();

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (dt > MAX_FRAME_ACCUM) dt = MAX_FRAME_ACCUM;

      const s = matchRef.current!;
      const isPaused = pausedRef.current;
      if (!isPaused) {
        accRef.current += dt;
        const input1 = input1Ref.current?.getInput();
        const input2 = input2Ref.current?.getInput();
        const inputs: InputFrame[] = [];
        if (input1) inputs.push(input1);
        if (input2) inputs.push(input2);
        while (accRef.current >= FIXED_DT) {
          const prevScore = s.score.slice() as [number, number];
          const prevOwner = s.ball.ownerId;
          const prevPeriod = s.period;
          stepMulti(s, inputs, FIXED_DT);
          handleSoundEvents(sound, s, prevScore, prevOwner, prevPeriod);
          accRef.current -= FIXED_DT;
          if ((s.period as string) === 'fulltime') {
            setFinalScore([...s.score] as [number, number]);
            setScene('results');
            return;
          }
        }
      }

      updateCamera(camRef.current, s, dt);
      // Consume presentation events (sounds only during gameplay debugging;
      // visual effects disabled until gameplay is solid).
      if (presRef.current) {
        presRef.current.consumeEvents(s);
        presRef.current.update(dt);
      }
      // Render — no shake/particles/trail during gameplay debugging.
      if (assetsRef.current) {
        render(ctx, s, camRef.current, assetsRef.current);
      }
      // Expose state for in-browser verification / debugging.
      if (typeof window !== 'undefined') {
        (window as unknown as { __rfa?: MatchState }).__rfa = s;
        if (assetsRef.current) {
          (window as unknown as { __field?: HTMLCanvasElement }).__field = assetsRef.current.field;
        }
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      input1Ref.current?.destroy();
      input2Ref.current?.destroy();
      input1Ref.current = null;
      input2Ref.current = null;
      sound.stopCrowd();
    };
  }, [scene, matchKey]);

  const startMatch = (cfg: MatchConfig) => {
    setConfig(cfg);
    setPaused(false);
    setMatchKey((k) => k + 1);
    setScene('match');
  };

  const handleTouch = useCallback((t: Partial<TouchState>) => {
    input1Ref.current?.setTouch(t);
  }, []);

  // --- Online lifecycle helpers ---
  const enterOnline = useCallback(() => {
    if (!net) setNet(new NetClient());
    setScene('online_lobby');
  }, [net]);

  const quitOnline = useCallback(() => {
    if (net) {
      net.leaveRoom();
      net.destroy();
    }
    setNet(null);
    setScene('menu');
  }, [net]);

  // --- Render ---
  return (
    <div
      className="flex min-h-screen w-full flex-col overflow-hidden bg-emerald-950"
      style={{ touchAction: 'manipulation' }}
    >
      {scene === 'menu' && (
        <MenuScreen
          onPlay={() => {
            setConfig((c) => ({ ...c, mode: 'solo' }));
            setScene('teamselect');
          }}
          onLocal2P={() => {
            setConfig((c) => ({ ...c, mode: '2p' }));
            setScene('teamselect');
          }}
          onOnline={enterOnline}
          onSettings={() => setScene('settings')}
          onHowTo={() => setScene('howto')}
        />
      )}

      {scene === 'teamselect' && (
        <TeamSelectScreen
          initial={config}
          onStart={startMatch}
          onBack={() => setScene('menu')}
        />
      )}

      {scene === 'howto' && <HowToScreen onBack={() => setScene('menu')} />}

      {scene === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => setScene('menu')}
        />
      )}

      {scene === 'lobby' && <LobbyScreen onLeave={() => setScene('menu')} />}

      {scene === 'match' && (
        <div
          ref={containerRef}
          className="relative flex flex-1 w-full items-center justify-center overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className="block"
            style={{ imageRendering: 'pixelated', touchAction: 'none' }}
          />
          {settings.showTouch && !paused && (
            <TouchControls onChange={handleTouch} />
          )}
          {paused && (
            <PauseOverlay
              onResume={() => setPaused(false)}
              onRestart={() => {
                setPaused(false);
                setMatchKey((k) => k + 1);
              }}
              onQuit={() => {
                setPaused(false);
                setScene('menu');
              }}
              settings={settings}
              onSettingsChange={setSettings}
            />
          )}
        </div>
      )}

      {scene === 'online_lobby' && net && (
        <OnlineLobby
          net={net}
          config={onlineConfig}
          onMatchStart={() => setScene('online_match')}
          onLeave={quitOnline}
        />
      )}

      {scene === 'online_match' && net && (
        <OnlineMatch
          net={net}
          settings={settings}
          onSettingsChange={setSettings}
          onQuit={quitOnline}
          onMatchEnd={(score) => {
            setFinalScore(score);
            setResultsOnline(true);
            setScene('results');
          }}
        />
      )}

      {scene === 'results' && (
        <ResultsScreen
          score={finalScore}
          halfLength={config.halfLength}
          onRematch={() => {
            if (resultsOnline) {
              net?.rematch();
              setScene('online_lobby');
            } else {
              setMatchKey((k) => k + 1);
              setScene('match');
            }
          }}
          onMenu={() => {
            if (resultsOnline) quitOnline();
            else setScene('menu');
            setResultsOnline(false);
          }}
        />
      )}

      {/* Sticky footer */}
      <footer className="mt-auto w-full border-t border-emerald-800/60 bg-emerald-950/80 py-2 text-center font-mono text-[10px] text-emerald-400/60">
        Kačanovská FIFA · originálna arkáda · 5 vs 5 · deterministická simulácia
      </footer>
    </div>
  );
}
