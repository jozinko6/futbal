'use client';

import { useEffect, useRef } from 'react';
import { CRT } from '@/game/presentation/theme';

interface Props {
  mode: 'off' | 'subtle' | 'strong';
}

/**
 * CRT overlay — scanlines, vignette, noise. Pure CSS, pointer-events:none.
 * Respects prefers-reduced-motion (disables flicker/noise animation).
 */
export function CRTOverlay({ mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mode === 'off') return;
    const settings = mode === 'subtle' ? CRT.subtle : CRT.strong;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = 640;
    c.height = 360;
    ctx.imageSmoothingEnabled = false;

    // Draw scanlines.
    ctx.fillStyle = `rgba(0,0,0,${settings.scanlineOpacity})`;
    for (let y = 0; y < 360; y += 2) {
      ctx.fillRect(0, y, 640, 1);
    }

    // Vignette.
    const grad = ctx.createRadialGradient(320, 180, 200, 320, 180, 360);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${settings.vignette})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);
  }, [mode]);

  if (mode === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-40"
      style={{
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        mixBlendMode: 'multiply',
      }}
    />
  );
}
