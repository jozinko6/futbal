# YSoccer Behavior Map

| YSoccer systém | Pozorované správanie | Náš TS modul | Spôsob |
|---------------|---------------------|-------------|--------|
| Kontextové tlačidlo | Jedno tlačidlo = kontextová akcia | input/InputManager.ts | NEW_IMPLEMENTATION |
| Aftertouch | Post-contact trajectory influence | simulation/aftertouch.ts | NEW_IMPLEMENTATION |
| Voľná lopta | 3D fyzika s rotáciou | simulation/ball.ts | BEHAVIORAL_REFERENCE |
| Prepínanie | Výber relevantného hráča | simulation/playerSelection.ts | NEW_IMPLEMENTATION |
| Formácie | Dátovo riadené pozície | (plánované) data/formations/ | NEW_IMPLEMENTATION |
| Brankár | Poziciovanie, výbeh, zákrok | simulation/goalkeeper.ts | BEHAVIORAL_REFERENCE |
| Štandardné situácie | Setup → kick → live | simulation/rules.ts | BEHAVIORAL_REFERENCE |
| Tímy a hráči | JSON s vlastnosťami | (plánované) data/teams.ts | NEW_IMPLEMENTATION |
| Súťaže | League, cup, knockout | (plánované) competitions/ | NEW_IMPLEMENTATION |
| Počasie | Rain, snow, wind, fog | simulation/weather.ts | NEW_IMPLEMENTATION |
| Dresy | Kit definitions | (plánované) data/kits.ts | NEW_IMPLEMENTATION |
| Rozhodca | Píšťalky, karty | simulation/rules.ts | BEHAVIORAL_REFERENCE |
| Replay | Záznam priebehu | presentation/replay/ | NEW_IMPLEMENTATION |
| Trajectory predictor | Multi-curve predikcia | (plánované) trajectoryPredictor.ts | NEW_IMPLEMENTATION |
| Interception | Odhad času k lopte | (plánované) interception.ts | NEW_IMPLEMENTATION |
| Ball reception | Control/touch/deflection | (plánované) ballReception.ts | NEW_IMPLEMENTATION |
