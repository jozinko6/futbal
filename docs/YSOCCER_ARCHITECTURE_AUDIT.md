# YSoccer Architecture Audit

**Archív:** ysoccer19.zip (kompilovaný JAR + dáta)
**Licencia:** GPL v2 — CLEAN_ROOM_REFERENCE only

## Pozorovaná architektúra (z dát a dokumentácie)

### Dátová štruktúra tímov
- JSON formát: name, type, country, confederation, city, stadium, coach, tactics, kits[], players[]
- Hráč: name, shirtName, nationality, role, number, skinColor, hairColor, hairStyle, skills{passing,shooting,heading,...}, value
- Role: GOALKEEPER, RIGHT_BACK, LEFT_BACK, CENTER_BACK, DEFENSIVE_MIDFIELDER, etc.
- Tímové taktiky: SWEEP, 4-4-2, 4-3-3, 3-5-2, atď.

### Formácie (TAC súbory)
- Binárny formát s pozíciami hráčov
- Podporované: 3-4-3, 4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 5-3-2, atď.
- Každá formácia má útočné a obranné pozície

### Súťaže
- JSON formát: leagues, cups, tournaments
- Podpora: ligy, skupinové fázy, knockout, poháre
- Historické sezóny (1964-65, 1996-97)

### Konfigurácia
- Properties súbory pre nastavenia hry
- Import/export funkcie pre tímové dáta

## Kľúčové behaviorálne koncepty (pre našu implementáciu)

### 1. Kontextové ovládanie
- Jedno tlačidlo = kontextová akcia (prihrávka/strela/tackle podľa situácie)
- Smer určuje cieľ prihrávky/strely
- Držanie = silnejšia akcia

### 2. Aftertouch
- Po kontakte s loptou môže hráč krátko ovplyvniť trajektóriu
- Bočná rotácia (zakrivenie)
- Vertikálna rotácia (lob/pokles)
- Časovo obmedzené okno

### 3. Prepínanie hráča
- Automatický výber najrelevantnejšieho hráča
- Zohľadňuje: vzdialenosť, smer, rolu, tímové postavenie
- Manuálne prepínanie má prioritu

### 4. Brankár
- Poziciovanie podľa uhla strely
- Výbeh pri prihrávke za obranu
- Chytenie vs vyrazenie
- Reakčný čas

### 5. Formácie
- Dátovo riadené pozície
- Útočné/obranné offsety
- Podpora viacerých systémov (4-4-2, 4-3-3, atď.)

### 6. Štandardné situácie
- Kickoff, throw-in, corner, goal kick, free kick, penalty
- Rozohrávajúci hráč je určený
- Súperi dodržujú odstup

## Čo je zastarané / nevhodné pre browser
- Java/libGDX rendering — nahradené Canvas 2D
- Desktop window management — nahradené Next.js/React
- Presné hardcoded rozlíšenia — používame 640×360 virtuálne
- Binárne TAC súbory — použijeme JSON/TypeScript
- Reálne tímy/hráči — použijeme fiktívne

## Moduly pre našu implementáciu

| Koncept | Náš TS modul | Spôsob |
|---------|-------------|--------|
| Aftertouch | simulation/aftertouch.ts | NEW_IMPLEMENTATION |
| Ball physics | simulation/ball.ts | BEHAVIORAL_REFERENCE |
| Player selection | simulation/playerSelection.ts | NEW_IMPLEMENTATION |
| Formations | data/formations/ | NEW_IMPLEMENTATION |
| Team shape | simulation/teamShape.ts | NEW_IMPLEMENTATION |
| Goalkeeper | simulation/goalkeeper.ts | BEHAVIORAL_REFERENCE |
| Set pieces | simulation/rules.ts | BEHAVIORAL_REFERENCE |
| Team data | data/teams.ts | NEW_IMPLEMENTATION |
| Competitions | competitions/ | NEW_IMPLEMENTATION |
| Weather | simulation/weather.ts | NEW_IMPLEMENTATION |
