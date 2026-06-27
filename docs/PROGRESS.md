# PROGRESS — Kačanovská FIFA Rework

## Etapa 0 — Audit ✅
- **Dokončené**: audit, `docs/REWORK_PLAN.md`, `docs/BASELINE.md`.
- **Súbory**: docs/REWORK_PLAN.md, docs/BASELINE.md.
- **Testy**: 34/34 passing, tsc/lint/build zelené.
- **Známe nedostatky**: 67 deps, lopta prilepená, 1e6 ciele, žiadny action systém.
- **Ďalší krok**: Etapa 1 — odľahčenie.

## Etapa 1 — Odľahčenie ✅
- **Dokončené**: odstránených 56 nepoužitých deps, 45 UI komponentov, Prisma, API route.
- **Súbory**: package.json, src/components/ui/*, src/app/layout.tsx, components.json, .env.example.
- **Testy**: 34/34, tsc/lint/build zelené.
- **Ďalší krok**: Etapa 2 — action systém.

## Etapa 2 — Action systém ✅
- **Dokončené**: PlayerAction (windup/contact/recovery), kontaktný tick, executePassKick/executeShotKick.
- **Súbory**: src/game/simulation/actionSystem.ts (nový), types.ts, player.ts, simulation.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 3 — pohyb/stamina.

## Etapa 3 — Pohyb + stamina ✅
- **Dokončené**: STAMINA config, fatigue blokuje šprint, sharp turn penalty, separátne smery.
- **Súbory**: tacticsConfig.ts, constants.ts, player.ts, formation.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 4 — dribling.

## Etapa 4 — Dribling ✅
- **Dokončené**: impulzy namiesto interpolácie, touch interval podľa rýchlosti, šprint ľahšie odoberateľné.
- **Súbory**: player.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 5 — first touch.

## Etapa 5 — First touch ✅
- **Dokončené**: FirstTouchResult (controlled/deflection), žiaden cyklus s resolvePossession.
- **Súbory**: player.ts, types.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 6 — prihrávky.

## Etapa 6 — Prihrávky ✅
- **Dokončené**: 4 typy cez action systém, obmedzená asistencia ≤20°, through-ball predikcia.
- **Súbory**: player.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 7 — streľba.

## Etapa 7 — Streľba ✅
- **Dokončené**: reálna bránková čiara (nie 1e6), mierenie, 4 typy, presnosť z viacerých faktorov.
- **Súbory**: player.ts, simulation.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 8 — obrana/fauly.

## Etapa 8 — Obrana/Fauly ✅
- **Dokončené**: fouls.ts (ball-first vs player-first, zozadu), čistý zásah lopty nie faul.
- **Súbory**: fouls.ts (nový), simulation.ts, player.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 9-11 — AI + brankár.

## Etapy 9-11 — AI + Brankár ✅
- **Dokončené**: CLEAR_BALL podľa vlastnej brány, INTERCEPT predikcia, MARK medzi súperom a bránou, GK prediction/parry/rush.
- **Súbory**: ai.ts, goalkeeper.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 12-13 — render/camera.

## Etapy 12-13 — Render/Camera ✅
- **Dokončené**: Y-sorting, drawActiveIndicator, asset manifest, camera look-ahead, screen shake.
- **Súbory**: renderer.ts, camera.ts, src/game/assets/manifest.ts (nový), GameContainer.tsx.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 14 — štandardné situácie.

## Etapa 14 — Štandardné situácie ✅
- **Dokončené**: restart time limit (5s), žiadny ofsajd (futsal), aut nohou.
- **Súbory**: simulation.ts.
- **Testy**: 34/34.
- **Ďalší krok**: Etapa 15 — testy.

## Etapa 15 — Testy ✅
- **Dokončené**: 14 gameplay testov, 100 AI vs AI zápasov, AI_SIMULATION_REPORT.md.
- **Súbory**: tests/gameplay.test.ts (nový), docs/AI_SIMULATION_REPORT.md.
- **Testy**: 48/48.
- **Ďalší krok**: Etapa 16 — multiplayer.

## Etapa 16 — Multiplayer ✅
- **Dokončené**: server accumulator loop, last input hold, lastFullSnapshotAt, AI takeover, sessionId+reconnectToken, klient interpolácia (snapshot buffer 100ms), reconnect.
- **Súbory**: mini-services/game-server/index.ts, src/game/net/client.ts.
- **Testy**: 48/48.
- **Ďalší krok**: Etapa 17 — online testy (odložené — vyžaduje bežiaci server).

## Etapa 18 — Dokumentácia ✅
- **Dokončené**: FINAL_REPORT.md, PROGRESS.md (tento súbor).
- **Súbory**: docs/FINAL_REPORT.md, docs/PROGRESS.md.
- **Testy**: 48/48, tsc/lint/build zelené.
