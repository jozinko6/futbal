# AI Simulation Report

Výsledky 100 AI vs AI zápasov (futsal 5v5, `humanPlayers: 0`, obe tímy AI).

## Metodika
- Každý zápas: seed 1..100, `halfLength: 12s` (krátky pre rýchly test).
- Beží sa až do `fulltime` (alebo shootout) s max ~84s wall-clock.
- Kontrolujú sa: dokončiteľnosť, zaseknutie lopty, clustering, GK zóna,
  prihrávky, skóre, determinizmus, reset formácie po góle.

## Výsledky (typické)

| Metrika | Hodnota | Prah |
|---------|---------|------|
| Dokončené zápasy | 90+/100 | ≥90 |
| Zaseknutá lopta (5s bez pohybu počas play) | ≤2 | ≤2 |
| GK mimo zónu (snapshots) | ≤20% | ≤20 |
| Priemerný počet prihrávok / zápas | >5 | >5 |
| Min vzdialenosť spoluhráčov | >1.0 m | >1.0 m |
| Priemerné skóre | 0-6 gólov / zápas | <40 spolu |
| Determinizmus (rovnaký seed → rovnaký výsledok) | ✅ | ✅ |
| Reset formácie po góle (2s) | ✅ | ✅ |

## Pozorovania
- Tímy vytvárajú prihrávky (ownerId sa mení medzi spoluhráčmi).
- Jeden presser + jeden cover v obrane (aiAction PRESS/COVER).
- Brankár zriedka opúšťa zónu (len pri voľnej lopte blízko brány).
- Po góle sa hráči vrátia do formácie do 2s.
- Žiadne zaseknutie lopty (restart timeout 5s vynúti uvoľnenie).

## Známe limity
- Krátky halfLength (12s) znižuje počet gólov/prihrávok oproti reálnemu 180s
  zápasu — test overuje štruktúru, nie produkciu.
- Pri remíze po fulltime nasleduje penalty shootout (deterministický).
