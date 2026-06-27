# Architektúra — Kačanovská FIFA

## Prehľad

Hra je postavená ako **Next.js 16** aplikácia (App Router) s jedinou routou `/`,
ktorá renderuje client component `GameContainer`. Vnútri sú moduly organizované
tak, aby zrkadlili pnpm-workspace monorepo zo zadania:

| Zadaný balík | Implementácia | Popis |
|---|---|---|
| `packages/simulation` | `src/game/simulation/` | deterministický TS, žiadny DOM/Canvas |
| `packages/protocol` | `src/game/net/protocol.ts` | Socket.IO správy, snapshoty, validácia |
| `packages/config` | `src/game/simulation/constants.ts` | všetky konštanty |
| `apps/web` | `src/app/page.tsx` + `src/components/game/` | Next.js klient (Canvas renderer) |
| `apps/server` | (mimo sandbox) | autoritatívny Node.js + Socket.IO nad `simulation` |
| `assets` | procedurálne generované v `src/game/render/field.ts` | pixel-art ihrisko |
| `docs` | `docs/` | Architektúra, Progress |

## Deterministická simulácia (`src/game/simulation`)

Jadro. **Žiadne DOM, Canvas ani Phaser závislosti** — použiteľné klientom
(predikcia) aj autoritatívnym serverom.

- **`constants.ts`** — geometria ihriska (848×472 hrateľná plocha vo svete
  960×560), fyzikálne konštanty, AI parametre podľa náročnosti, paleta.
- **`types.ts`** — `MatchState`, `PlayerEntity`, `BallState`, `HumanController`,
  `InputFrame`, `Snapshot`, `DeltaSnapshot`.
- **`rng.ts`** — mulberry32 seeded RNG. **Nikde v simulácii nie je `Math.random`**,
  preto rovnaké vstupy + seed dávajú rovnaký výsledok (overené testom).
- **`ball.ts`** — integrácia lopty: lineárna rýchlosť, výška `z`, vertikálna
  rýchlosť, trenie na zemi, air drag, gravitácia, odraz s restitúciou, cap
  rýchlosti, `kickBall` (s cap), `clampBallSpeed`.
- **`formation.ts`** — 5v5 formácie (1 GK + 2 DEF + 1 MID + 1 FWD), mirror
  pre away, `resetToFormation`.
- **`player.ts`** — pohyb (akcelerácia/decelerácia, sprint), sklz (dash +
  cooldown + omráčenie), držanie lopty, dribling, prihrávka, strela s
  nabíjaním, brankársky pad, kolízie medzi hráčmi.
- **`rules.ts`** — hranice ihriska, detekcia gólu (medzi žrdami, pod
  brvnom), kolízie o žrde, aut → throw-in, roh → corner, kop od brány →
  goal kick, výkop, oslava gólu, polčas, koniec.
- **`ai.ts`** — stavový automat (`returnToFormation`, `support`,
  `runToSpace`, `mark`, `press`, `receive`, `shoot`, `pass`, `dribble`,
  `gkPosition`, `gkCharge`, `gkDive`). AI číta **iba aktuálny** stav (nič
  budúce) a reevaluuje rozhodnutia na časovači (reakčná latencia podľa
  náročnosti). Náhodnosť ide cez seeded RNG.
- **`simulation.ts`** — `createMatchState`, `step`/`stepMulti`/`fixedStep`.
  Orchestrácia: aplikácia vstupov každého `HumanController`, AI pre zvyšok,
  integrácia hráčov, kolízie, lopta, `resolvePossession`, `resolveGoalPosts`,
  `trackLastTouch`, `processFieldEvents`, `advanceMatchFlow` (periódy).

### Controller model
`MatchState.controllers: HumanController[]` — 1 pre solo vs AI, 2 pre lokálny
2P. Každý controller má vlastný `activeId`, `chargeTime` a edge-stavy
(`prevShootHeld`, `prevPass`, …), takže determinizmus nie je narušený. `step`
používa `controllers[0]`, `stepMulti` zoberie pole vstupov zarovnané k
controllerom.

### Fixed timestep
`FIXED_DT = 1/60`. Klientský loop používa akumulátor: `acc += dt;
while (acc >= FIXED_DT) stepMulti(...)`. Výsledok fyziky nie je naviazaný na
FPS monitora.

## Renderer (`src/game/render`)

Browser-only (Canvas 2D). **Nie je súčasť deterministického balíka.**

- **`field.ts`** — `createFieldTexture()` prerenderuje celé ihrisko
  (tribúny s publikom, mowing stripes, čiarky, šestnástky, rohové oblúky,
  bránky so sieťou) do offscreen canvasu raz; renderer ho potom blit-uje
  podľa kamery.
- **`camera.ts`** — sleduje vážený stred lopta+aktívny hráč, clamped na svet,
  smooth lerp.
- **`renderer.ts`** — kreslí tiene, hráčov (animácia behu/sklzu/omráčenia/
  oslavy, smer, brankárske rukavice), loptu (s výškou a tieňom), HUD (skóre,
  čas, polčas), banner, charge bar, ukazovateľ aktívneho hráča (chevron +
  ring). `imageSmoothingEnabled = false`, všetky súradnice floored.

## Vstup (`src/game/input/InputManager`)

Konfigurovateľný keymap (`P1_KEYS`, `P2_KEYS`) + voliteľný gamepad index +
touch (z `TouchControls`). Produkuje jeden validovaný `InputFrame` na frame
(sekvencované `seq`). **Klient posiela serveru iba tieto rámce.**

## Audio (`src/game/audio/Sound`)

Web Audio, všetko syntetizované: `kick`, `pass`, `post`, `whistle`, `goal`,
`confirm`, ambient `crowd`. Lazy `AudioContext`, resume na prvom gesto.

## React scény (`src/components/game`)

- `GameContainer` — orchestrátor: scene stavový automat, fixed-timestep loop,
  input, zvukové udalosti, integer canvas scaling, sticky footer, debug hook
  `window.__rfa`.
- Scény: `MenuScreen`, `TeamSelectScreen`, `HowToScreen`, `SettingsScreen`,
  `PauseOverlay`, `ResultsScreen`, `LobbyScreen`, `TouchControls`.

## Sieť (`src/game/net/protocol.ts`)

Protokol pre autoritatívny Socket.IO server. Klient → server: `createRoom`,
`joinRoom`, `setReady`, `selectTeam`, `leaveRoom`, `input` (validovaný cez
`isValidClientInput` — seq, rozsah), `rematch`, `ping`. Server → klient:
`roomCreated`, `lobbyUpdate`, `countdown`, `matchStart`, `snapshot` (full),
`delta` (`buildDelta`), `ack` (posledný spracovaný seq pre reconciliation),
`matchEnd`, `netStatus`, `opponentDisconnected`/`opponentReconnected`.

Server nikdy neverí klientskemu skóre/času/pozíciám. Client-side prediction +
reconciliation (podľa `ack`) + interpolation buffer pre vzdialené entity.

## Determinizmus — dôkaz

Test `determinism > produces identical state from identical inputs & seed`
spustí 300 rôznych vstupov cez dva nezávislé `createMatchState({seed:99})` a
overí, že `tick`, `score`, `ball`, všetky pozície hráčov aj `rngState` sú
identické. `fixedStep ≡ step` s `FIXED_DT` je tiež overené.
