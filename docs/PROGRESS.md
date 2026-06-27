# Progress — Retro Football Arena

Stav etáp podľa zadania. Po každej etape: typecheck + unit testy + oprava chýb + update tohto súboru.

## Etapa 1 — Inicializácia, konfigurácia, dokumentácia ✅
- Adresárová štruktúra: `src/game/{simulation,render,audio,input,net}`,
  `src/components/game`, `docs`, `tests/e2e`.
- TypeScript strict, path alias `@/`, ESLint (Next config), Vitest.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`.

## Etapa 2 — Čistá offline simulácia ✅
- `src/game/simulation/`: constants, types, rng (mulberry32), input, math,
  ball, formation, player, rules, ai, simulation.
- Fyzika lopty (trenie, gravitacia, odraz, cap, žrde), hráči (stavový automat,
  sklz, dribling, prihrávka, strela s nabíjaním, brankársky zákrok), AI
  (stavový automat s reakčnou latenciou podľa náročnosti, seeded RNG),
  pravidlá (gól, aut, roh, kop od brány, výkop, polčas, koniec, oslava).
- Fixed timestep 60 Hz, deterministické (žiadne Math.random).
- 17 Vitest unit testov — all passing.

## Etapa 3 — Phaser/Canvas rendering, ovládanie, kamera, HUD ✅
- Canvas renderer (pixel-art), pre-renderovaná textúra ihriska, kamera
  sledujúca akciu, HUD (skóre, čas, banner, charge bar, ukazovateľ
  aktívneho hráča), integer scaling, nearest-neighbor.
- InputManager (klávesnica + gamepad + touch), TouchControls (multitouch).

## Etapa 4 — AI, brankár, pravidlá, lokálny multiplayer ✅
- AI stavový automat: returnToFormation, support, runToSpace, mark, press,
  receive, shoot, pass, dribble, gkPosition, gkCharge, gkDive.
- Brankár: postavenie na čiare, výbeh, zákrok/pad podľa predikcie strely.
- Pravidlá: výkop, gól, aut, roh, kop od brány, polčas, koniec, pauza,
  rematch. Ofsajd v MVP vynechaný; fauly → cooldown + omráčenie.
- Lokálny 2-hráčovsky režim (controller-based model).

## Etapa 5 — Socket.IO server, miestnosti, autoritatívna simulácia ⚙️ (architektúra)
- `src/game/net/protocol.ts`: ClientToServer / ServerToClient messages,
  LobbyState, AuthoritativeMatch, validácia vstupov (seq, rozsah),
  buildDelta (delta snapshot).
- Plán: autoritatívny server nad `src/game/simulation`, miestnosti s
  6-miestnym kódom, periodické + delta snapshoty, ack sekvencií, grace period
  pre disconnect (AI prevezme tím), client prediction + reconciliation +
  interpolation.
- V sandboxe (jediný port 3000, jeden používateľ) reálny 1v1 nie je
  demonštrovateľný; plne hrateľný offline vs AI + lokálny 2P.

## Etapa 6 — Mobilné ovládanie, nastavenia, audio, pixel-art, responzívne UI ✅
- Virtuálny joystick + tlačidlá (Pointer Events, multitouch, landscape,
  `touch-action:none`, blok scroll/zoom).
- Web Audio programové zvuky (kop, prihrávka, žrď, hvizd, gól, potvrdenie,
  ambient crowd). Nastavenia: zvuk, mobilné ovládanie, auto-prepínanie
  (perzistentné v localStorage). Responzívne scény so sticky footerom.

## Etapa 7 — Playwright, optimalizácia, Dockerfile, render.yaml, dokumentácia ✅
- Playwright config + e2e testy (menu, offline zápas, ovládanie, pauza,
  nastavenia, lobby).
- `Dockerfile` (multi-stage Next.js standalone), `render.yaml`,
  `.env.example`.
- `package.json` skripty: `dev`, `build`, `start`, `lint`, `typecheck`,
  `test`, `test:watch`, `test:e2e`.

## Verifikácia v browseri (Agent Browser + VLM) ✅
- Menu → výber tímu → zápas tok.
- Canvas renderuje ihrisko, hráčov (červení/modrí), loptu, scoreboard, footer.
- Simulácia beží, góly padajú, kickoff→play→goal→kickoff prechody.
- Klávesnica hýbe aktívnym hráčom (D: x 320→474, vx=132).
- Pauza (Esc) funguje, čas sa zastaví.
- Sticky footer (gap=0 na desktope), responzívne na mobile.
- tsc čistý, lint OK, 17/17 Vitest passing.

## Známe obmedzenia
- Ofsajd nie je implementovaný (MVP).
- Reálny online 1v1 cez sieť nie je v sandboxe spustiteľný (jeden port,
  jeden používateľ); protokol a klient sú pripravené.
