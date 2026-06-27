
'use client';
/* eslint-disable react-hooks/immutability */

import { useEffect, useState } from 'react';
import { NetClient, type LobbyStateView, type NetStatus } from '@/game/net/client';
import type { Difficulty, Team } from '@/game/simulation';
import { RetroButton } from './Screens';

const PANEL =
  'rounded-xl border-2 border-emerald-400/40 bg-emerald-950/70 backdrop-blur-sm shadow-[0_0_0_2px_rgba(0,0,0,0.4)]';

export interface OnlineConfig {
  difficulty: Difficulty;
  halfLength: number;
  team: Team;
  name?: string;
}

type Phase = 'setup' | 'lobby' | 'connecting';

interface Props {
  net: NetClient;
  config: OnlineConfig;
  onMatchStart: () => void;
  onLeave: () => void;
}

export function OnlineLobby({ net, config, onMatchStart, onLeave }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState<LobbyStateView | null>(null);
  const [error, setError] = useState('');
  const [netStatus, setNetStatus] = useState<NetStatus>({ connected: false, pingMs: 0 });
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    // The NetClient is a mutable singleton; assigning its event callbacks is
    // intentional (the class is designed this way, see src/game/net/client.ts).
    
    net.onLobby = (s) => {
      setLobby(s);
      setCode(s.code);
      setPhase('lobby');
    };
    net.onCountdown = (secs) => setCountdown(secs);
    net.onMatchStart = () => {
      setCountdown(null);
      onMatchStart();
    };
    net.onNetStatus = (n) => setNetStatus(n);
    net.onError = (msg) => setError(msg);
    net.onDisconnect = () => setError('Spojenie so serverom sa prerušilo.');
    
    return () => {
      
      net.onLobby = null;
      net.onCountdown = null;
      net.onMatchStart = null;
      net.onNetStatus = null;
      net.onError = null;
      net.onDisconnect = null;
      
    };
  }, [net, onMatchStart]);

  const handleCreate = () => {
    setError('');
    setPhase('connecting');
    net.createRoom(config, (c) => {
      setCode(c);
    });
  };

  const handleJoin = () => {
    setError('');
    if (joinCode.length !== 6) {
      setError('Kód musí mať 6 číslic.');
      return;
    }
    setPhase('connecting');
    net.joinRoom(joinCode, config, (ok, reason) => {
      if (!ok) {
        setError(reason ?? 'Nepodarilo sa pripojiť.');
        setPhase('setup');
      }
    });
  };

  const toggleReady = () => {
    const me = lobby?.players.find((p) => p.id === (net.socket as unknown as { id: string }).id);
    net.setReady(!me?.ready);
  };

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto">
      <div className="m-auto flex w-full max-w-md flex-col items-center gap-4 p-4">
        <h2 className="font-mono text-2xl font-black uppercase text-amber-300">Online 1v1</h2>

        {phase === 'setup' && (
          <div className={`${PANEL} w-full space-y-4 p-6`}>
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-wider text-emerald-300/80">
                Vytvoriť miestnosť
              </p>
              <RetroButton onClick={handleCreate} className="w-full">
                ➕ Nová miestnosť
              </RetroButton>
            </div>
            <div className="h-px bg-emerald-400/30" />
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-wider text-emerald-300/80">
                Pripojiť sa kódom
              </p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="mb-3 w-full rounded-lg border-2 border-emerald-400/40 bg-emerald-900/60 px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] text-amber-200 placeholder:text-emerald-700 focus:border-amber-300 focus:outline-none"
              />
              <RetroButton onClick={handleJoin} className="w-full">
                Pripojiť
              </RetroButton>
            </div>
            {error && <p className="font-mono text-xs text-red-300">{error}</p>}
            <RetroButton variant="ghost" onClick={onLeave} className="w-full">
              Späť
            </RetroButton>
          </div>
        )}

        {phase === 'connecting' && (
          <div className={`${PANEL} w-full p-6 text-center`}>
            <p className="font-mono text-sm text-emerald-100">Pripájam sa…</p>
          </div>
        )}

        {phase === 'lobby' && lobby && (
          <div className={`${PANEL} w-full space-y-4 p-6`}>
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-wider text-emerald-300/80">Kód miestnosti</p>
              <p className="font-mono text-3xl font-black tracking-[0.4em] text-amber-300">{code}</p>
              <p className="mt-1 font-mono text-[10px] text-emerald-300/60">
                Pošli kód súperovi — otvorí hru v druhom prehliadači a zadá ho.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {lobby.players.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-lg border-2 p-3 text-center ${
                    p.ready ? 'border-amber-300 bg-amber-300/10' : 'border-emerald-400/40 bg-emerald-900/40'
                  }`}
                >
                  <div className="font-mono text-sm font-bold text-white">{p.name}</div>
                  <div className="font-mono text-[10px] text-emerald-300/70">
                    {p.team === 0 ? 'ČERVENÍ' : 'MODRÍ'}
                  </div>
                  <div className="font-mono text-[10px]">
                    {p.connected ? (p.ready ? '✓ Pripravený' : '…') : 'odpojený'}
                  </div>
                </div>
              ))}
              {lobby.players.length < 2 && (
                <div className="rounded-lg border-2 border-dashed border-emerald-700 p-3 text-center font-mono text-xs text-emerald-600">
                  Čaká na súpera…
                </div>
              )}
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-emerald-300/70">
              <span>Stav: {netStatus.connected ? 'pripojené' : 'odpojené'}</span>
              <span>Ping: {netStatus.pingMs}ms</span>
              <span>
                {lobby.players.length}/2
              </span>
            </div>

            {countdown != null && (
              <div className="text-center font-mono text-5xl font-black text-amber-300">{countdown}</div>
            )}

            <div className="flex gap-3">
              <RetroButton variant="ghost" onClick={() => { net.leaveRoom(); onLeave(); }} className="flex-1">
                Odísť
              </RetroButton>
              <RetroButton
                onClick={toggleReady}
                className="flex-[2]"
                disabled={lobby.players.length < 2}
              >
                {lobby.players.find((p) => p.id === (net.socket as unknown as { id: string }).id)?.ready
                  ? 'Nie som pripravený'
                  : 'Som pripravený'}
              </RetroButton>
            </div>
            {lobby.players.length < 2 && (
              <p className="text-center font-mono text-[10px] text-emerald-300/60">
                Zápas sa začne, keď sa pripojí súper a obaja budete pripravení.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
