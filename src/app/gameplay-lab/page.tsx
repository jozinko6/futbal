'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createMatchState,
  stepMulti,
  FIXED_DT,
  MAX_FRAME_ACCUM,
  emptyInput,
  type MatchState,
} from '@/game/simulation';
import { createCamera, updateCamera } from '@/game/render/camera';
import { createRenderAssets, render, type RenderAssets } from '@/game/render/renderer';
import { InputManager, P1_KEYS, type TouchState } from '@/game/input/InputManager';

type LabScenario = 'movement' | 'dribbling' | 'passing' | 'shooting' | 'gk_save' | 'one_v_one' | 'two_v_one' | 'tackle' | 'auto_switch' | 'aftertouch' | 'full_5v5';

const SCENARIOS: { id: LabScenario; label: string; desc: string }[] = [
  { id: 'movement', label: 'Pohyb', desc: 'Hráč sám, bez lopty' },
  { id: 'dribbling', label: 'Dribling', desc: 'Hráč s loptou, bez súpera' },
  { id: 'passing', label: 'Prihrávky', desc: 'Dvaja hráči, prihrávky' },
  { id: 'shooting', label: 'Streľba', desc: 'Strela na prázdnu bránu' },
  { id: 'gk_save', label: 'Brankár', desc: 'Strela proti brankárovi' },
  { id: 'one_v_one', label: '1v1', desc: 'Dribling proti obrancovi' },
  { id: 'two_v_one', label: '2v1', desc: 'Prihrávka cez obrancu' },
  { id: 'tackle', label: 'Zákroky', desc: 'Standing/slide tackle' },
  { id: 'auto_switch', label: 'Auto-switch', desc: 'Test prepínania' },
  { id: 'aftertouch', label: 'Aftertouch', desc: 'Zakrivenie strely' },
  { id: 'full_5v5', label: '5v5 zápas', desc: 'Plný zápas' },
];

export default function GameplayLabPage() {
  const [scenario, setScenario] = useState<LabScenario>('movement');
  const [paused, setPaused] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const [debug, setDebug] = useState(true);
  const [tickInfo, setTickInfo] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const matchRef = useRef<MatchState | null>(null);
  const camRef = useRef(createCamera());
  const assetsRef = useRef<RenderAssets | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const accRef = useRef(0);

  const setupScenario = useCallback((sc: LabScenario) => {
    const state = createMatchState({ halfLength: 600, humanPlayers: 1, difficulty: 'normal', seed: sc });
    state.period = 'play';
    state.debug = true;
    matchRef.current = state;
    camRef.current = createCamera();
  }, []);

  useEffect(() => {
    if (!assetsRef.current) assetsRef.current = createRenderAssets();
    setupScenario(scenario);
  }, [scenario, setupScenario]);

  useEffect(() => {
    inputRef.current = new InputManager({ keys: P1_KEYS, useGamepad: true, gamepadIndex: 0, onPause: () => setPaused((p) => !p) });
    return () => { inputRef.current?.destroy(); };
  }, []);

  useEffect(() => {
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const s = matchRef.current;
      if (!s) return;
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (dt > MAX_FRAME_ACCUM) dt = MAX_FRAME_ACCUM;
      if (!paused) {
        accRef.current += dt * (slowMo ? 0.25 : 1);
        while (accRef.current >= FIXED_DT) {
          const input = inputRef.current?.consumeForSimulationTick() ?? emptyInput();
          stepMulti(s, [input], FIXED_DT);
          accRef.current -= FIXED_DT;
        }
      }
      updateCamera(camRef.current, s, 0.016);
      const ctx = canvasRef.current?.getContext('2d', { alpha: false });
      if (ctx && assetsRef.current) render(ctx, s, camRef.current, assetsRef.current);
      if (debug) setTickInfo(`tick=${s.tick} mode=${s.ball.mode} owner=${s.ball.ownerId} phase=${s.teamPhase[0]}`);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [paused, slowMo, debug]);

  return (
    <div className="flex min-h-screen flex-col bg-emerald-950 text-white">
      <div className="flex flex-wrap gap-2 border-b border-emerald-700 p-2">
        {SCENARIOS.map((sc) => (
          <button key={sc.id} onClick={() => setScenario(sc.id)} className={`rounded px-3 py-1 font-mono text-xs ${scenario === sc.id ? 'bg-amber-400 text-black' : 'bg-emerald-800 hover:bg-emerald-700'}`} title={sc.desc}>{sc.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-emerald-700 p-2">
        <button onClick={() => setPaused((p) => !p)} className="rounded bg-emerald-800 px-3 py-1 font-mono text-xs hover:bg-emerald-700">{paused ? '▶ Pokračovať' : '⏸ Pauza'}</button>
        <button onClick={() => setSlowMo((s) => !s)} className={`rounded px-3 py-1 font-mono text-xs ${slowMo ? 'bg-amber-400 text-black' : 'bg-emerald-800 hover:bg-emerald-700'}`}>Slow-mo</button>
        <button onClick={() => setAiOff((a) => !a)} className={`rounded px-3 py-1 font-mono text-xs ${aiOff ? 'bg-amber-400 text-black' : 'bg-emerald-800 hover:bg-emerald-700'}`}>AI off</button>
        <button onClick={() => setDebug((d) => !d)} className={`rounded px-3 py-1 font-mono text-xs ${debug ? 'bg-amber-400 text-black' : 'bg-emerald-800 hover:bg-emerald-700'}`}>Debug</button>
        <button onClick={() => setupScenario(scenario)} className="rounded bg-red-800 px-3 py-1 font-mono text-xs hover:bg-red-700">↻ Reset</button>
        <button onClick={() => { if (matchRef.current) { stepMulti(matchRef.current, [emptyInput()], FIXED_DT); } }} className="rounded bg-emerald-800 px-3 py-1 font-mono text-xs hover:bg-emerald-700">⏭ Frame</button>
      </div>
      <div className="flex flex-1 items-center justify-center p-2">
        <canvas ref={canvasRef} width={640} height={360} className="block" style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '100%' }} />
      </div>
      {debug && <div className="border-t border-emerald-700 p-2 font-mono text-xs text-emerald-300">{tickInfo}</div>}
    </div>
  );
}
