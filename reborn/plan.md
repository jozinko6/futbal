# Plan — Futbal Reborn

## Cieľ
Úplne nová arkádová futbalová hra od nuly. Originálny duchovný nástupca
Taito Cup Finals / Sensible Soccer. Žiadny kód zo starého projektu.

## Technologický stack
- Next.js (sandbox obmedzenie — port 3000, routa `/`)
- TypeScript strict
- Canvas 2D (namiesto PixiJS — sandbox kompatibilita)
- Web Audio API
- Vitest, Playwright
- Bun

## Architektúra
```
reborn/src/game/
  core/         — constants, types, RNG, math, tuning
  simulation/   — čistá TS, žiadny DOM/Canvas
  input/        — input buffer, edge queue
  rendering/    — Canvas 2D renderer
  camera/       — kamera
  audio/        — Web Audio
  presentation/ — particles, shake, events
  replay/       — replay buffer
  data/         — tímy, formácie, tuning
  ai/           — tímová AI, individuálna AI
  rules/        — pravidlá, štandardné situácie
  debug/        — debug overlay
```

## Etapy
0. Projekt setup — štruktúra, lint, build, prázdne menu
1. Simulačné jadro — fixed timestep, RNG, MatchState, input buffer
2. Jeden hráč a lopta — pohyb, dribling, BallMode, ownership
3. Prihrávka — short pass, príjem, targeting, action phases
4. Streľba a bránka — shot, goal detection, žrde, sieť
5. Trajectory predictor — predikcia, interception
6. 3v3 vertical slice — switching, AI, brankár, skóre, výkop
7. 5v5 — tímová AI, formácie, pressing, fauly, auty, rohy
8. 7v7 — stabilná AI, štandardné situácie, kamera
9. Vizuál — sprity, HUD, efekty, audio, crowd
10. 11v11 — optimalizácia, plné pravidlá
11. Arcade funkcie — kapitáni, Super Shot, Cup, replay, počasie
12. Multiplayer — autoritatívny server

## Akceptačné kritériá (prvá hrateľná verzia)
1. Projekt vznikol od nuly ✅
2. Žiadny starý kód ✅
3. Hra sa spustí bez chýb
4. Fixed timestep funguje
5. Vstupy sa nestrácajú
6. Pohyb okamžitý a presný
7. Dribling spoľahlivý
8. Prihrávka funguje
9. Spracovanie lopty funguje
10. Strela predvídateľná
11. Gól sa rozpozná
12. Brankár zasahuje loptu
13. Prepínanie stabilné
14. AI vytvorí útok
15. Obrana drží tvar
16. 3v3 zábavné
17. 5v5 zábavné
18. Funguje bez efektov
19-22. typecheck/lint/test/build zelené
23. Gameplay Lab funguje
24. Ownership invarianty platia
25. Žiadne neautorizované assety

## Testovacia stratégia
- Unit testy: determinizmus, input, ownership, lopta, prihrávky
- Sim testy: 100 zápasov 3v3, 5v5, 7v7
- E2E: menu, zápas, pauza
