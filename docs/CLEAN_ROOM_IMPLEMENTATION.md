# Clean Room Implementation

## Režim: CLEAN_ROOM_BEHAVIORAL_REFERENCE

YSoccer (GPL v2) je použitý výlučne ako behaviorálna referencia.
Žiadny kód, assety, zvuky, dáta neboli skopírované.

## Existujúce moduly (vlastné TypeScript implementácie)

| Modul | YSoccer koncept | Náš prístup |
|-------|----------------|-------------|
| simulation/ball.ts | Voľná lopta s 3D fyzikou | Vlastná 2D+x fyzika s aftertouch |
| simulation/player.ts | Hráč, pohyb, dribling | Arkádový foot socket |
| simulation/ownership.ts | Vlastníctvo lopty | BallMode state machine |
| simulation/aftertouch.ts | Post-kock rotácia | Vlastný aftertouch s limity |
| simulation/playerSelection.ts | Auto-switch | Hysterézia + predikcia |
| simulation/weather.ts | Počasie | Deterministické z seedu |
| simulation/actionSystem.ts | Akčné fázy | Windup/contact/recovery |
| simulation/passing.ts | Pass lane safety | Point-to-segment |
| simulation/fouls.ts | Fauly | Serializovateľný TackleState |
| simulation/goalkeeper.ts | Brankár | Position + dive + parry |
| simulation/teamTactics.ts | Tímová AI | 9 fáz, role assignment |
| simulation/ai.ts | Individuálna AI | Utility-based |
| presentation/events.ts | Presentation events | Čisté dátové eventy |

## Potvrdenie
Nijaký súbor z ysoccer19.zip nebol skopírovaný do produkčného bundle.
