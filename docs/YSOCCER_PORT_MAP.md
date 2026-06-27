# YSoccer Clean-Room Port Map

| YSoccer koncept | Pozorované správanie | Náš cieľ | Nový TS modul | Spôsob použitia |
|----------------|---------------------|----------|--------------|-----------------|
| Kontextové tlačidlo | Jedno tlačidlo = kontextová akcia | Classic Arcade preset | input/InputManager.ts | NEW_IMPLEMENTATION |
| Aftertouch | Post-contact trajectory influence | Arkádový aftertouch s limity | simulation/aftertouch.ts | NEW_IMPLEMENTATION |
| Voľná lopta | 3D fyzika s rotáciou | 2D+x fyzika s aftertouch | simulation/ball.ts | BEHAVIORAL_REFERENCE |
| Prepínanie | Výber relevantného hráča | Stabilný auto-switch s hysteréziou | simulation/playerSelection.ts | NEW_IMPLEMENTATION |
| Formácie | Dátovo riadené pozície | JSON formácie s offsetmi | data/formations/ | NEW_IMPLEMENTATION |
| Tímový tvar | Posun za loptou s útoč./obrann. offsetmi | teamShape.ts s fázami | simulation/teamShape.ts | NEW_IMPLEMENTATION |
| Brankár | Poziciovanie, výbeh, zákrok | GK controller so save zónami | simulation/goalkeeper.ts | BEHAVIORAL_REFERENCE |
| Štandardné situácie | Setup → positioning → kick → live | RestartPhase state machine | simulation/rules.ts | BEHAVIORAL_REFERENCE |
| Tímy a hráči | JSON s vlastnosťami | Fiktívne tímy s PlayerData | data/teams.ts | NEW_IMPLEMENTATION |
| Súťaže | League, cup, knockout | competitions/ modul | competitions/ | NEW_IMPLEMENTATION |
| Počasie | Rain, snow, wind, fog | Deterministické počasie | simulation/weather.ts | NEW_IMPLEMENTATION |
| Dresy | Kit definitions s farbami | KitDefinition s štýlmi | data/kits.ts | NEW_IMPLEMENTATION |
| Rozhodca | Píšťalka, karty, smery | Banner + PresentationEvent | simulation/rules.ts | BEHAVIORAL_REFERENCE |
| Replay | Záznam priebehu | ReplayBuffer z snapshotov | presentation/replay/ | NEW_IMPLEMENTATION |
