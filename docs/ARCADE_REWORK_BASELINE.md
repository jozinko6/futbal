# ARCADE REWORK BASELINE

**Vetva:** rework/arcade-cup-finals
**Dátum:** 2025-06-28
**Commit:** 9fe6507

## Baseline kontroly
- typecheck: ✅ čisté
- lint: ✅ čisté
- unit testy: ✅ 48/48
- build: ✅ prešiel

## Aktuálne fundamentálne problémy
1. **Dvojitý zdroj vlastníctva lopty** — `ball.ownerId` AJ `player.hasBall` sa zapisujú nezávisle, rozchádzajú sa.
2. **Input edge events sa strácajú** — InputManager konzumuje edge v render frame, nie v sim tick.
3. **Lopta odpojí sa náhodne** — dribling používa fyzikálne impulzy s trením, lopta odchádza pri sharp turn.
4. **resolvePossession cyklus** — pri zlom first touch znova priradí toho istého hráča.
5. **Contain integruje pozíciu dvakrát** — containMovement mení pozíciu, potom integratePlayer znova.
6. **Camera shake Math.random** — v cameraOrigin, nedeterministický (OK pre render, ale nečistý).
7. **Power > 300 threshold** — v px/s, obyčajné prihrávky spúšťajú Power Shot efekty.
8. **Stamina komplikovaná** — blokuje šprint pod fatigueThreshold.
9. **Efekty zapnuté počas ladenia** — CRT, particles, shake komplikujú debugging.
10. **Fouls WeakMap** — nedeterministická, neserializovateľná.

## Kľúčové súbory na úpravu
- src/game/simulation/types.ts — BallMode, playerHasBall, odstrániť hasBall
- src/game/simulation/player.ts — dribling, contain, resolvePossession
- src/game/simulation/simulation.ts — step loop, event emit
- src/game/input/InputManager.ts — edge queue, consumeForSimulationTick
- src/game/simulation/actionSystem.ts — locomotion multiplier
- src/game/presentation/ — dočasne vypnúť efekty
- src/game/render/renderer.ts — HUD, Y-sort
- src/game/render/camera.ts — shake cleanup
