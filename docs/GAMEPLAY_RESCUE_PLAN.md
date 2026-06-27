# Gameplay Rescue Plan

## Fáza 1: Trajectory + Interception
- src/game/simulation/trajectoryPredictor.ts — predikcia budúcej trajektórie lopty
- src/game/simulation/interception.ts — odhad času hráča k lopte
- Integrácia do playerSelection, AI, brankára

## Fáza 2: Ball Reception
- src/game/simulation/ballReception.ts — CLEAN_CONTROL / DIRECTED_TOUCH / HEAVY_TOUCH / DEFLECTION
- Nahradenie computeFirstTouch v player.ts

## Fáza 3: Dátovo riadené formácie
- src/game/data/formations/ — JSON formácie (4-4-2, 4-3-3, 3-5-2, ...)
- src/game/simulation/ballZones.ts — zóny ihriska
- src/game/simulation/teamShape.ts — dynamický tvar tímu

## Fáza 4: Tímová AI
- Centralizovaný role assignment (BALL_CARRIER, PRESSER, COVER, ...)
- Individuálna AI rešpektuje pridelenú rolu

## Fáza 5: Brankár
- Save hit zones (CATCH, PARRY, DEFLECT)
- Rush velocity smerom k intercept pointu
- Reakčný čas

## Fáza 6: Match state machine
- Explicitné stavy (KICKOFF, PLAYING, THROW_IN_SETUP, ...)
- Rýchle arkádové rozohrávky

## Fáza 7: Gameplay Lab
- ?lab=1 route
- Scenáre + debug nástroje

## Fáza 8: 7v7 → 11v11
- Rozšírenie formácií
- AI optimalizácia pre 22 hráčov
