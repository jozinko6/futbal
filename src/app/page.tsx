'use client';

import dynamic from 'next/dynamic';

// The game is fully client-side (Canvas, AudioContext, pointer events) and
// reads the window/gamepad APIs, so render it only on the client.
const GameContainer = dynamic(
  () => import('@/components/game/GameContainer').then((m) => m.GameContainer),
  { ssr: false },
);

export default function Home() {
  return <GameContainer />;
}
