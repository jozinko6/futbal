'use client';
/* eslint-disable react-hooks/immutability */

import { useEffect, useRef, useState } from 'react';
import { FIXED_DT, MAX_FRAME_ACCUM, type MatchState } from '@/game/simulation';
import { createCamera, updateCamera } from '@/game/render/camera';
import { createFieldTexture } from '@/game/render/field';
import { render, type RenderAssets } from '@/game/render/renderer';
import { InputManager, P1_KEYS, type TouchState } from '@/game/input/InputManager';
import { getSound } from '@/game/audio/Sound';
import { NetClient } from '@/game/net/client';
import { TouchControls } from './TouchControls';
import { PauseOverlay, type Settings } from './Screens';

interface Props {
  net: NetClient;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  onQuit: () => void;
  onMatchEnd: (score: [number, number]) => void;
}

export function OnlineMatch({ net, settings, onSettingsChange, onQuit, onMatchEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const assetsRef = useRef<RenderAssets | null>(null);
  const camRef = useRef(createCamera());
  const inputRef = useRef<InputManager | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const sound = getSound();
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scale = Math.floor(Math.min(cw / 640, ch / 360));
      if (scale < 1) {
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
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (!assetsRef.current) assetsRef.current = { field: createFieldTexture() };
    camRef.current = createCamera();
    lastRef.current = performance.now();
    accRef.current = 0;

    inputRef.current = new InputManager({
      keys: P1_KEYS,
      useGamepad: true,
      gamepadIndex: 0,
      onPause: () => setPaused((p) => !p),
    });

    sound.setMuted(!settings.sound);
    sound.resume();
    sound.startCrowd();

    const endHandler = (score: [number, number]) => onMatchEnd(score);
    net.onMatchEnd = endHandler;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (dt > MAX_FRAME_ACCUM) dt = MAX_FRAME_ACCUM;

      const s = net.state;
      if (!s) return;

      // Read local input.
      const inp = inputRef.current?.getInput();

      // Send input to the authoritative server (rate-limited inside NetClient).
      if (inp && !pausedRef.current) {
        net.sendInput(
          inp.moveX,
          inp.moveY,
          inp.sprint,
          inp.pass,
          inp.shootHeld,
          inp.highPass,
          inp.switchPlayer,
        );
        // Client-side prediction: advance the local copy with our own input so
        // the player stays responsive between server snapshots.
        const inputs = [inp, inp]; // both controllers get our frame; server reconciles
        accRef.current += dt;
        while (accRef.current >= FIXED_DT) {
          net.predictStep(inputs, FIXED_DT);
          accRef.current -= FIXED_DT;
        }
      }

      updateCamera(camRef.current, s, dt);
      if (assetsRef.current) render(ctx, s, camRef.current, assetsRef.current);
      if (typeof window !== 'undefined') {
        (window as unknown as { __rfa?: MatchState }).__rfa = s;
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      inputRef.current?.destroy();
      inputRef.current = null;
      sound.stopCrowd();
      net.onMatchEnd = null;
    };
    
  }, []);

  const handleTouch = (t: Partial<TouchState>) => {
    inputRef.current?.setTouch(t);
  };

  return (
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
      {settings.showTouch && !paused && <TouchControls onChange={handleTouch} />}
      {paused && (
        <PauseOverlay
          onResume={() => setPaused(false)}
          onRestart={() => {
            setPaused(false);
            net.rematch();
          }}
          onQuit={onQuit}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      )}
    </div>
  );
}
