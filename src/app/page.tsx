'use client';

import dynamic from 'next/dynamic';

const RebornGame = dynamic(
  () => import('@/components/game/RebornGame').then((m) => m.RebornGame),
  { ssr: false },
);

export default function Home() {
  return <RebornGame />;
}
