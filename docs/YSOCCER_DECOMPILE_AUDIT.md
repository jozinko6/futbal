# YSoccer Decompile Audit

**Archív:** ysoccer19.zip (kompilovaný JAR + dáta)
**Licencia:** GPL v2
**Režim:** CLEAN_ROOM_BEHAVIORAL_REFERENCE

## Pozorované systémy (z dát a JSON)

### Tímové dáta
- JSON formát s hráčmi, dresmi, taktikami
- Hráčské vlastnosti: passing, shooting, heading, tackling, control, speed
- Role: GOALKEEPER, RIGHT_BACK, LEFT_BACK, CENTER_BACK, etc.

### Formácie (TAC súbory)
- Binárne súbory: T442.TAC, T433.TAC, T352.TAC, T343.TAC, etc.
- Pozície hráčov v útočnej a obrannej fáze

### Súťaže
- JSON: leagues, cups, tournaments
- Historické sezóny (1964-65, 1996-97)

### Config
- Properties súbory pre nastavenia
- Import/export pre tímové dáta

## Pozorované správanie (z hrania/referencií)

### Lopta
- 3D pozícia (x, y, z) s rýchlosťou a rotáciou
- Aftertouch po kope
- Trenie, odraz, gravitácia
- Odraz od žrdí a hráčov

### Ovládanie
- Jedno kontextové tlačidlo
- Smer určuje cieľ
- Krátke = prihrávka, dlhé = strela
- Aftertouch po kontakte

### AI
- Hráči sa držia formácie
- Najbližší napáda
- Spoluhráči ponúkajú možnosti
- Obrancovia nekrižujú

### Brankár
- Poziciovanie na čiare
- Výbeh pri prihrávke za obranu
- Chytenie vs vyrazenie
- Reakčný čas

## Potvrdenie
Nijaký dekompilovaný kód nebol použitý.
Nijaké assety, zvuky, dáta tímov neboli skopírované.
Všetky implementácie sú vlastné TypeScript moduly.
