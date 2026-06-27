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

---
Task ID: 8
Agent: main
Task: Pridať ofsajd, zväčšiť ihrisko, premenovať na Kačanovská FIFA, funkčný online multiplayer

Work Log:
- Premenovanie: "Retro Football Arena" → "Kačanovská FIFA" vo všetkých súboroch (UI, README, docs,
  metadata v layout.tsx, Logo komponent, footer).
- Zväčšené ihrisko: FIELD_W 848→1120, FIELD_H 472→640, WORLD 960×560→1232×728, penalty box
  96×232→132×300, goal area 44×132→56×176, center circle 66→84, GOAL_H 132→148. Formácie
  rozšírené pre väčší rozostup. Kamera a renderer automaticky adaptované (konštanty-driven).
- Ofsajd (OFFSIDE_ENABLED): pri pass() sa zaznamená snapshot pozícií všetkých hráčov.
  isReceiverOffside() kontroluje: prijímateľ v súperovej polovici, za second-last defenderom
  (okrem GK) o viac ako OFFSIDE_TOLERANCE, a nie na úrovni/za prihrávajúcim. awardOffside()
  → indirect free kick (freeKick reštart) pre brániaci tím + banner OFSAJD + počítadlo.
  Cleanup pri goal/stoppage/kickoff/súper získa loptu. Pridané polia do MatchState
  (offsideCheck, offsides[2]).
- Online multiplayer (autoritatívny):
  * mini-services/game-server/ (Socket.IO, port 3003, path /): rooms s 6-miestnym kódom,
    createRoom/joinRoom/setReady/selectTeam/input/rematch/leaveRoom/ping, fixed-tick loop
    (setInterval FIXED_DT), validácia vstupov (seq, rozsah), periodické snapshoty (full ~1s,
    delta inak), ack sekvencií, matchStart s controllerIndex, countdown, grace period pre
    disconnect (AI dočasne prevezme), matchEnd.
  * src/game/net/client.ts (NetClient): pripojenie cez io('/?XTransformPort=3003') (Caddy
    gateway), sendInput (rate-limited, seq), predictStep (client-side prediction),
    reconciliation (replay unacked inputs), interpolatedState, lobby/match callbacks.
  * OnlineLobby.tsx: setup (create/join), lobby UI (kód, hráči, ready, ping, countdown),
    auto-štart keď obaja ready.
  * OnlineMatch.tsx: match loop renderuje stav zo servera, posiela inputs, predikcia,
    pauza/rematch/quit.
  * GameContainer: 'online_lobby'/'online_match' scény, net state (nie ref — lint),
    resultsOnline flag pre online-aware results/rematch.
- Testy: 20/20 Vitest (pridané 3 ofsajd unit testy: offside flag, level/behind passer,
  own half). tsc čistý, lint OK.
- Verifikácia v browseri cez Caddy (port 81) + agent-browser (2 sessions):
  * Menu ukazuje "KACANOVSKÁ FIFA" + Online 1v1 tlačidlo (VLM potvrdené).
  * Offline zápas: väčšie ihrisko (VLM: "large pitch"), scoreboard, offsides počítadlá.
  * Online: P1 vytvoril miestnosť (kód 657631), P2 sa pripojil kódom, lobby 2/2,
    obaja ready → zápas začal na oboch klientoch (period=play), synchronizácia overená
    (hráč id=3 rovnaká pozícia x=587 y=364 na oboch).

Stage Summary:
- Ofsajd plne funkčný (detekcia + indirect free kick + banner + počítadlá).
- Ihrisko zväčšené (1120×640 hrateľná plocha, svet 1232×728).
- Hra premenovaná na Kačanovská FIFA.
- Online 1v1 cez internet funguje: autoritatívny Socket.IO server (mini-service 3003),
  6-miestny kód, lobby, synchronizovaný odpočet, prediction/reconciliation, snapshot sync,
  pauza/rematch. Verifikované s dvoma browser sessions.
- Server sa spúšťa: cd mini-services/game-server && bun run dev (na pozadí beží).
- Dokumentácia aktualizovaná (README, docs/PROGRESS.md, docs/ARCHITECTURE.md).

---
Task ID: 9
Agent: main
Task: Opraviť múchy: výkop sa nerozbehne, rýchlosť hráčov, throw-in, rohové kopy, realistickejší pohyb

Work Log:
- **Výkop**: setupKickoff teraz priradí loptu kickoff tímu (MID) priamo + restartTimer
  znížený na 0.6s. Hra sa rozbehne okamžite — AI rozohrá (dribble/pass) bez čakania.
  Overené: po 1s period=play, owner=MID, shield aktívny; po 5s lopta sa hýbe.
- **Rýchlosť hráčov**: PLAYER_MAX_SPEED 132→96, SPRINT 186→138, ACCEL 760→520,
  DECEL 1100→760, GK 104→78. SLIDE_SPEED 250→190. DRIBBLE_NUDGE 132→56.
  BALL_PASS 360→300, HIGH_PASS 300→250, SHOOT 380-560→340-520. formation.ts
  používa konštanty (nie hardcoded).
- **Possession shield (nové)**: BallState.possessionShield + shieldTeam. Po
  restart (kickoff/throwIn/corner/freeKick/goalKick) sa nastaví POSSESSION_SHIELD=1.4s
  pre restart tím. tryTackle + resolvePossession rešpektujú shield — protihráč
  nemôže zobrať loptu počas shieldu. Shield sa tickuje v stepMulti nezávisle
  (bugfix: dribble nevolá integrateBall, takže shield by sa inak netickoval).
- **Throw-in / corner**: processFieldEvents nedáva loptu priamo hráčovi
  (givePossessionAt odstránené). Namiesto toho moveNearestToBall presunie
  najbližšieho hráča restart tímu ~22px od lopty; lopta ostáva voľná, shield
  chráni. Hráč prijde (AI 'receive') a rozohrá — real throw-in namiesto
  okamžitého hand-off. Goal kick stále priradí GK (rozohráva).
- **Realistickejší pohyb**: turn rate závisí od rýchlosti (6-12 rad/s namiesto
  fixných 14) — pomalšie otáčanie pri nízkych rýchlostiach. Znížená akcelerácia
  = plynulejšie rozbehy a zastavenia.
- **Bugfix**: pass()/shoot() v player.ts používajú konštanty (BALL_PASS_SPEED,
  BALL_HIGH_PASS_SPEED/Z, BALL_SHOOT_MIN/MAX) namiesto hardcoded hodnôt.
- **Testy**: 23/23 Vitest (pridané 3 restart shield testy: throw-in shield,
  corner shield, opponents nemôžu ukradnúť počas shieldu). Bounce test
  upravený (izoluje loptu od hráčov). tsc čistý, lint OK.
- **Verifikácia v browseri**:
  * Výkop: po 1s period=play, owner=MID(id3), shield=0.35 (odpočítava); po 5s
    shield=0, lopta sa hýbe (616→840), score 0-0.
  * Po 30s: score 1-0, time=37s, restartType=kickoff (gól padol), žiadne chyby.
  * VLM: skóre 1-1, čas 0:20, ihrisko s čiarami, hráči rozmiestnení, žiadne
    vizuálne problémy.

Stage Summary:
- Výkop sa rozbehne automaticky (AI rozohrá, shield chráni).
- Hráči pomalší (96/138 px/s), realistickejšie otáčanie a akcelerácia.
- Throw-in/corner: lopta voľná, shield chráni restart tím, hráč prijde a rozohrá.
- Rohové kopy fungujú (corner s shieldom).
- 23/23 testov passing, tsc/lint čistý.

---
Task ID: 10
Agent: main
Task: Vizuálne prerobiť ihrisko podľa referenčného obrázku (publikum, banner, pruhy, čiary, bránky)

Work Log:
- VLM analýza referencie (pitch1.png): farebné publikum v pruhoch, veľký banner text
  hore, vibrant zelená tráva s výraznými pruhmi, hrubšie biele čiary, viditeľné bránky
  so sieťou, hnedý bežecký ovál.
- Prepísal som src/game/render/field.ts:
  * drawStands(): tmavomodré stánky + farebné publikum v pruhoch (red/yellow/green/blue
    dots 3×3px) so shimmer jitterom. Publikum na celom svete.
  * drawBanner(): originálny žltý banner "★ KACANOVSKÁ FIFA ★" v chunky pixel-style
    písme, opakovaný naprieč hornej tabule (nie SEGA — originálny text).
  * Vibrant paleta: GRASS_LIGHT #3aa84a, GRASS_DARK #2f9240, hrubšie čiary (lineWidth 3),
    18 pruhov, sunlit edge highlight.
  * drawGoal: lepšie viditeľné žrde (5×7) + tmavé pozadie siete pre kontrast.
  * Track len ako úzky rámik (8px) okolo ihriska — neprepisuje publikum (bugfix).
- Kamera (camera.ts): clamp rozšírený na celý svet (0..WORLD_W/H) aby bolo publikum
  viditeľné pri okrajoch (aut/roh/bránka).
- Pridaný debug hook window.__field pre overenie textúry.
- Bugfix: drawStands sa volala s chýbajúcim 6. argumentom (TS chyba).

Stage Summary:
- VLM overil pri rohu ihriska: farebné publikum (áno), žltý KACANOVSKÁ FIFA banner (áno),
  hnedý track (áno), výrazné zelené pruhy (áno), hrubšie biele čiary (áno), bránka so sieťou (áno).
- Pri strede hry kamera neukáže okraje (očakávané — ihrisko 1120×640 > viewport 640×360),
  ale pri aut/roh/bránke je publikum a banner jasne viditeľné.
- VLM: "lively retro stadium feel similar to Sensible Soccer" — presne podľa referencie.
- 23/23 testov passing, tsc čistý, lint OK.

---
Task ID: 11
Agent: main
Task: Logické AI pozície, GK ochrana + 5s limit, vylepšené oberanie, voľné kopy (priame/nepriame), penalty systém

Work Log:
- **AI formácia + pozície**: pridaná WING rola. Nová formácia (GK, 2 DEF, WING-ľavé, FWD-stred).
  decideSupport prepísané role-aware: DEF ostáva vzadu (clamp na vlastnú polovicu),
  WING drží krídlo (y toward flank), FWD stred a vysoko. decideDefensiveShape:
  DEF hlboká línia (malý ball-track), WING ustupuje na krídlo, FWD vysoko (counter-threat),
  MID komprimuje. Podporné nábehy: keď je nosič lopty pod tlakom, najbližší spoluhráč
  sa ponúka na prihrávku v otvorenom priestore (away from nearest opponent) — nie clustering.
- **GK possession protection**: tryTackle vracia false ak je owner GK — brankára s loptou
  nemožno oberať. resolvePossession reset gkHoldTime keď GK získa loptu. Pridané
  BallState.gkHoldTime + GK_HOLD_MAX=5s. V step loope: keď GK drží > 5s, automatický
  kop od brány pre súpera (turnover).
- **Voľné kopy (priame/nepriame)**: BallState.indirect flag. setupFreeKick(team,x,y,indirect).
  Priamy voľný kop = možno streliť gól; nepriamy (offside, nepriamy faul) = lopta musí
  byť dotknutá iným hráčom pred gólom. checkFieldEvents: ak indirect a lopta ide do bránky,
  namiesto gólu sa prizná kop od brány. indirect sa resetuje pri dotyku hráča (resolvePossession).
- **Faul system**: pri kolízii hráča v sklze (state='tackle') so súperom sa prizná faul.
  awardFoul(foulingTeam, x, y): ak je faul v pokutovom území fauliaceho tímu → PENALTA,
  inak priamy voľný kop pre súpera. Tackler po faule omráčený (stunned 0.8s).
- **Penalty systém**: setupPenalty umiestni loptu na penaltú značku. RestartType 'penalty'.
  Po remíze na konci zápasu → penalty shootout (period='penalties'): automatický sled
  deterministických kopov (RNG-based, pravdepodobnosť gólu podľa náročnosti), best-of-5
  + sudden death. decideShootoutWinner ukončí keď je rozhodnuté. Po skončení → fulltime.
- **Nové polia**: BallState.gkHoldTime, BallState.indirect; MatchState.shootout
  (kicksTaken, kicksScored, nextKicker, suddenDeath, kickerIndex). Konštanty GK_HOLD_MAX,
  PENALTY_SPOT_X, PENALTY_SHOOTOUT_KICKS.
- **Testy**: 31/31 Vitest (pridané 8: freeKick setup+indirect, penalty spot, awardFoul
  box→penalty + outside→freekick, GK nemožno oberať, GK 5s limit, penalty shootout
  end-to-end). tsc čistý, lint OK.
- **Verifikácia v browseri**:
  * AI pozície logické: GK vzadu, DEF na pozícii (x~350 T0 / ~820 T1), WING na krídle
    (y~140), FWD v strede (y~364) — držia sa aj počas hry.
  * Faul sa priznal prirodzene (restartType=freeKick pozorované).
  * Penalty shootout: po remíze 2:2 sa rozstrelil, skončil 6:3 → fulltime.

Stage Summary:
- AI už nie je náhodná: DEF vzadu, WING po stranách, FWD v strede, spoluhráči sa
  ponúkajú na prihrávku keď je nosič pod tlakom.
- Brankára s loptou nemožno oberať; po 5s sa automaticky uvoľní (kop od brány súperovi).
- Voľné kopy: priame (gól) + nepriame (offside, nutný dotyk).
- Fauly zo sklzov → priamy voľný kop alebo penaľta v pokutovom území.
- Penalty shootout po remíze: best-of-5 + sudden death, deterministický.
- 31/31 testov passing, tsc/lint čistý.
