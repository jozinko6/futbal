# Progress — Futbal Reborn

## Etapa 0 — Projekt setup ✅
- Nová štruktúra `reborn/` vytvorená úplne od nuly
- Žiadny kód zo starého projektu
- `reborn/plan.md`, `reborn/progress.md`
- TypeScript strict, Vitest config

## Etapa 1 — Simulačné jadro ✅
**Vytvorené súbory:**
- `reborn/src/game/core/tuning.ts` — všetky konštanty (field, player, ball, AI, aftertouch)
- `reborn/src/game/core/types.ts` — MatchState, BallState, PlayerState, InputFrame, BallMode, PlayerAction, MatchPhase
- `reborn/src/game/core/rng.ts` — deterministický mulberry32 RNG
- `reborn/src/game/core/math.ts` — vektorová matematika
- `reborn/src/game/simulation/match.ts` — hlavný step() loop, AI, input handling, match flow
- `reborn/src/game/simulation/ball.ts` — fyzika lopty (gravitácia, trenie, odraz, aftertouch)
- `reborn/src/game/simulation/player.ts` — pohyb, dribling (foot socket), kolízie
- `reborn/src/game/simulation/ownership.ts` — single source of truth (ball.ownerId), invariant check
- `reborn/src/game/simulation/actions.ts` — phased actions (WINDUP/CONTACT/RECOVERY)
- `reborn/src/game/simulation/formation.ts` — dátovo riadené formácie (3v3, 5v5, 7v7, 11v11)
- `reborn/src/game/index.ts` — barrel export

**Testy:**
- `reborn/tests/unit/simulation.test.ts` — 11 testov
  - createMatchState, tick advancement, KICKOFF→PLAYING
  - Ownership invarianty (CONTROLLED má ownerId, FREE nemá, 0 violations/600 ticks)
  - Determinizmus (rovnaký seed = rovnaký stav)
  - Formáty (3v3=6, 5v5=10, 7v7=14, 11v11=22 hráčov)

**Renderer:**
- `src/components/game/RebornGame.tsx` — Canvas 2D renderer s:
  - Kamera sleduje loptu
  - Grass stripes, lines, goals
  - Hráči s animáciou (legs, body, head, facing)
  - Lopta s tieňom a výškou
  - HUD (skóre, čas, polčas)
  - Banner (GÓL, VÝKOP, atď)
  - Active player indicator
  - Pauza (ESC)

**Integrácia:**
- `src/app/page.tsx` — dynamický import RebornGame (ssr: false)
- `tsconfig.json` — `@reborn/*` path alias

## Známe problémy
- Next.js dev server v sandboxe je nestabilný (zomrie po ~20s)
- Browser testovanie obmedzené server stabilitou
- Simulácia a testy fungujú nezávisle (11/11 passing)

## Ďalšia etapa
- Etapa 2: Jeden hráč a lopta — pohyb, dribling, BallMode, ownership (čiastočne hotové)
- Etapa 3: Prihrávka medzi dvomi hráčmi
- Etapa 4: Streľba a bránka
- Etapa 5: Trajectory predictor
