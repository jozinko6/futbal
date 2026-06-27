# Retro Football Arena — Worklog

This file is the shared worklog for all agents contributing to the
Retro Football Arena project. Append new sections, never overwrite.

---
Task ID: 1-2
Agent: main
Task: Etapa 1 (architektúra/konfig/docs) + Etapa 2 (deterministická simulácia + unit testy)

Work Log:
- Vyhodnotil som obmedzenia sandboxu (Next.js 16 na porte 3000, jediná routa `/`).
  Rozhodol som sa postaviť hru vnútri Next.js projektu ako client component s
  čistým deterministickým TS modulom `src/game/simulation` (bez DOM/Canvas) a
  vlastným Canvas rendererom pre pixel-perfect spoľahlivosť.
- Vytvoril som adresárovú štruktúru: `src/game/{simulation,render,audio,input,net}`,
  `src/components/game`, `docs`, `tests/e2e`.
- Nainštaloval vitest.
- Napísal som simuláciu:
  - constants.ts (geometria ihriska 848×472, fyzika, AI params, paleta)
  - types.ts (MatchState, PlayerEntity, BallState, InputFrame, Snapshot/Delta)
  - rng.ts (mulberry32 seeded — determinizmus)
  - input.ts (validácia vstupov, deadzone)
  - math.ts (vektorové pomocné funkcie)
  - ball.ts (integrácia lopty: trenie, gravitacia, odraz, cap rýchlosti, kickBall)
  - formation.ts (5v5 formácie, mirror pre away, reset)
  - player.ts (pohyb, sklz, držanie lopty, dribling, prihrávka, strela, brankársky zákrok, kolízie)
  - rules.ts (hranice, gól, žrde, aut, roh, kop od brány, výkop, oslava, polčas, koniec)
  - ai.ts (stavový automat: returnToFormation/support/press/mark/receive/shoot/pass/dribble/gkPosition/gkCharge/gkDive; reakčná latencia podľa náročnosti; seeded RNG)
  - simulation.ts (createMatchState, step/fixedStep, applyHumanInput s charge shot, auto/manuálne prepínanie hráča, match flow, processFieldEvents)
  - index.ts (barrel)
- Napísal som 17 Vitest unit testov pokrývajúcich: validáciu vstupov, pohyb lopty
  pri fixed timestep, trenie, cap rýchlosti, odraz, detekciu gólu, crossbar,
  goal kick, throw-in, corner, prepínanie stavov (kickoff→play, halftime, fulltime),
  reset po góle, a determinizmus (rovnaké vstupy+seed = rovnaký stav) +
  fixedStep≡step.

Stage Summary:
- Simulačný balík je čistý TS, použiteľný klientom aj serverom.
- `bunx vitest run` → 17/17 passing.
- Nájdené a opravené bugy: chýbajúci `FIELD_TOP` (importovaný ale nedefinovaný),
  `kickBall` necapoval rýchlosť, `Math.random` v AI nahradený seeded RNG.
- Pripravené na Etapa 3: Canvas renderer, kamera, HUD, ovládanie.

---
Task ID: 3-6
Agent: main
Task: Etapa 3-6 (renderer, kamera, HUD, ovládanie, AI/pravidlá už z etapy 2, React scény, mobil, audio, nastavenia)

Work Log:
- Vytvoril Canvas renderer: src/game/render/field.ts (procedurálna pixel-art textúra ihriska s
  tribúnami, pruhmi, čiarami, šestnástimi, rohovými oblúkmi, bránkami a sieťou — pre-render do
  offscreen canvasu), camera.ts (kamera sleduje loptu+aktívneho hráča, clamped, smooth), renderer.ts
  (kreslí tiene, hráčov s animáciou behu/sklzu/omráčenia/oslavy, loptu s výškou a tieňom, HUD so
  skóre a časom, banner, charge bar, ukazovateľ aktívneho hráča).
- Vytvoril InputManager (konfigurovateľný keymap P1/P2 + gamepad + touch), TouchControls (virtuálny
  joystick + tlačidlá, multitouch cez Pointer Events, touch-action:none).
- Vytvoril Sound (Web Audio — kopnutie, prihrávka, žrď, hvizd, gól, potvrdenie, ambient crowd),
 全过程 len originálne syntetizované.
- Refaktoroval simuláciu na controller-based model (HumanController[]) — podpora solo aj lokálneho
  2P bez narušenia determinizmu; 17/17 testov stále prechádza.
- Vytvoril React scény: Menu, TeamSelect, HowTo, Settings, PauseOverlay, Results, Lobby + GameContainer
  orchestrátor (fixed-timestep loop, input, zvukové udalosti, integer canvas scaling, sticky footer).
- page.tsx renderuje GameContainer cez dynamic ssr:false.

Stage Summary:
- Hra plne funguje a je overená v browseri (Agent Browser + VLM):
  * Menu → výber tímu → zápas tok OK.
  * Canvas renderuje ihrisko/hráčov/loptu/HUD/footer (VLM potvrdil).
  * Simulácia beží, góly padajú (0:3 pozorované), kickoff→play→goal→kickoff prechody OK.
  * Klávesnica hýbe aktívnym hráčom (D: x 320→474, vx=132).
  * Pauza (Esc) OK, sticky footer (gap=0 na desktope).
- Bugfix: loop stepoval len počas play/kickoff → oslava gólu nikdy neprešla na výkop; opravené
  (stepuje sa vždy okrem pauzy, advanceMatchFlow beží pri každom ticku).
- tsc čistý (mimo examples/skills), lint OK, 17/17 testov passing.

---
Task ID: 7
Agent: main
Task: Etapa 7 (Playwright, optimalizácia, Dockerfile, render.yaml, env, finálna dokumentácia) + finálna verifikácia

Work Log:
- `src/game/net/protocol.ts`: ClientToServer/ServerToClient messages, LobbyState,
  AuthoritativeMatch, isValidClientInput (seq + rozsah), buildDelta (delta snapshot).
- `playwright.config.ts` + `tests/e2e/rfa.spec.ts`: menu, offline zápas, ovládanie
  hráča (D → x rastie), pauza/pokračovanie (čas zastavený počas pauzy), nastavenia,
  lobby. Desktop + mobile-landscape projekty.
- `package.json` skripty: typecheck, test, test:watch, test:e2e.
- `Dockerfile` (multi-stage Next.js standalone), `render.yaml`, `.env.example`.
- `README.md` (run inštrukcie, ovládanie, architektúra, nasadenie), `docs/PROGRESS.md`,
  `docs/ARCHITECTURE.md`.
- Lint opravy: handleSoundEvents presunuté na úroveň modulu; touch detekcia do
  loadSettings (useState initializer); setPaused(false) do startMatch (mimo effect).
- Finálna verifikácia: tsc čistý, lint OK, 17/17 Vitest passing; v browseri menu→
  tím→zápas→pauza→pokračovanie OK, simulácia beží, žiadne chyby.

Stage Summary:
- Hra je plne hrateľná a overená v browseri (Agent Browser + VLM).
- `bun run lint` / `bun run typecheck` / `bun run test` / `bun run test:e2e` definované.
- Produkčné artefakty (Docker, Render, env) pripravené.
- Dokumentácia kompletná.
