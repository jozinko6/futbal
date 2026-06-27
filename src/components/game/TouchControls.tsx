'use client';

import { useCallback, useRef, useState } from 'react';
import type { TouchState } from '@/game/input/InputManager';

interface Props {
  onChange: (s: Partial<TouchState>) => void;
}

/**
 * Mobile touch controls: a virtual analogue stick (left) and action buttons
 * (right) laid out for landscape. Uses Pointer Events with pointer capture so
 * multiple fingers are tracked simultaneously, and `touch-action: none` to
 * suppress scrolling/zooming during play.
 */
export function TouchControls({ onChange }: Props) {
  const stickRef = useRef<HTMLDivElement>(null);
  const stickPointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const RADIUS = 46;

  const updateStick = useCallback(
    (clientX: number, clientY: number) => {
      const el = stickRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) {
        dx = (dx / d) * RADIUS;
        dy = (dy / d) * RADIUS;
      }
      setKnob({ x: dx, y: dy });
      onChange({ active: true, moveX: dx / RADIUS, moveY: dy / RADIUS });
    },
    [onChange],
  );

  const onStickDown = (e: React.PointerEvent) => {
    e.preventDefault();
    stickPointer.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateStick(e.clientX, e.clientY);
  };
  const onStickMove = (e: React.PointerEvent) => {
    if (stickPointer.current !== e.pointerId) return;
    e.preventDefault();
    updateStick(e.clientX, e.clientY);
  };
  const onStickUp = (e: React.PointerEvent) => {
    if (stickPointer.current !== e.pointerId) return;
    stickPointer.current = null;
    setKnob({ x: 0, y: 0 });
    onChange({ active: true, moveX: 0, moveY: 0 });
  };

  const hold = (key: keyof TouchState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange({ active: true, [key]: true });
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onChange({ active: true, [key]: false });
    },
    onPointerCancel: () => onChange({ active: true, [key]: false }),
  });

  const tap = (key: keyof TouchState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onChange({ active: true, [key]: true });
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onChange({ active: true, [key]: false });
    },
  });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Joystick (left) */}
      <div
        ref={stickRef}
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
        className="pointer-events-auto absolute bottom-4 left-4 flex items-center justify-center rounded-full border-2 border-white/40 bg-black/30"
        style={{ width: 120, height: 120, touchAction: 'none' }}
      >
        <div
          className="rounded-full bg-white/70"
          style={{
            width: 48,
            height: 48,
            transform: `translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>

      {/* Action buttons (right) */}
      <div
        className="pointer-events-none absolute bottom-4 right-4 grid grid-cols-3 grid-rows-2 gap-2"
        style={{ width: 200, height: 132, touchAction: 'none' }}
      >
        <ActionBtn label="Q" sub="HRÁČ" className="col-start-1 row-start-1" {...tap('switchPlayer')} />
        <ActionBtn label="I" sub="LOB" className="col-start-2 row-start-1" {...tap('highPass')} />
        <ActionBtn label="L" sub="ŠPRINT" className="col-start-3 row-start-1" {...hold('sprint')} />
        <ActionBtn label="J" sub="PRIH." className="col-start-1 row-start-2" {...tap('pass')} />
        <ActionBtn label="K" sub="STRELA" className="col-start-2 col-span-2 row-start-2 bg-amber-500/80" {...hold('shootHeld')} />
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  sub,
  className = '',
  ...handlers
}: {
  label: string;
  sub: string;
  className?: string;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...handlers}
      className={`pointer-events-auto flex select-none flex-col items-center justify-center rounded-xl border-2 border-white/50 bg-white/15 font-mono font-bold text-white active:scale-95 active:bg-white/40 ${className}`}
      style={{ touchAction: 'none' }}
    >
      <span className="text-base leading-none">{label}</span>
      <span className="text-[8px] tracking-tight opacity-80">{sub}</span>
    </button>
  );
}
