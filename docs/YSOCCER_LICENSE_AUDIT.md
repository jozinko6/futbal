# YSoccer License Audit

**Archív:** ysoccer19.zip
**Dátum auditu:** 2025-06-28
**Verzia:** YSoccer 19

## Nájdená licencia

**GNU General Public License v2 (GPL-2.0)**

Copyright (C) 2016 by Massimo Modica, Daniele Giannarini, Marco Modica

Súbor: `docs/license/gpl.txt`

## Dôsledky GPL v2

- ❌ Nekopírovať implementačný kód (Java JAR)
- ❌ Nekopírovať grafické assety (655 PNG, 12 JPG)
- ❌ Nekopírovať zvuky/hudbu (13 OGG)
- ❌ Nekopírovať databázu tímov (reálne mená hráčov a klubov)
- ❌ Nekopírovať názvy, texty, level dáta
- ❌ Nekopírovať konštanty bez technického odôvodnenia
- ✅ Použiť ako behaviorálnu referenciu (pozorované správanie)
- ✅ Implementovať vlastné TypeScript moduly podľa futbalových princípov

## Samostatné licencie

### Grafika (PNG/JPG)
- Súčasť GPL v2 distribúcie — nepoužiteľné bez zmeny licencie celého projektu
- **Stav:** REJECTED

### Zvuky (OGG)
- Súčasť GPL v2 distribúcie
- **Stav:** REJECTED

### Databáza tímov (JSON)
- Obsahuje reálne mená hráčov a klubov (napr. "ITALY", "ENRICO ALBERTOSI")
- Licencované pod GPL v2
- **Stav:** REJECTED

### Taktiky/Formácie (TAC)
- Binárny formát, súčasť GPL v2
- **Stav:** REJECTED (koncept formácií je všeobecný futbalový princíp — implementujeme vlastné)

### Konfiguračné súbory (properties)
- Súčasť GPL v2
- **Stav:** REJECTED

## Nejasné alebo nelicencované súbory

- `ysoccer.jar` — kompilovaný Java kód pod GPL v2
- `.pal` súbory — palety, súčasť GPL v2
- `.bin` súbor — binárne dáta, súčasť GPL v2

Všetky súbory v archíve sú pod GPL v2.

## Odporúčanie

**YSOCCER_INTEGRATION_MODE = CLEAN_ROOM_REFERENCE**

- Žiadny súbor z archívu nebude použitý priamo
- Všetky implementácie budú vlastné TypeScript moduly
- Použijeme iba pozorované futbalové princípy:
  - kontextové ovládanie
  - aftertouch
  - správanie lopty
  - prepínanie hráča
  - tímové formácie
  - brankárske správanie
  - štandardné situácie
