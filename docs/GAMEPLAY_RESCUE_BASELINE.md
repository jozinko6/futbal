# Gameplay Rescue Baseline

**Dátum:** 2025-06-28
**Vetva:** main
**Commit:** 79cba5f

## Kontroly
- typecheck: ✅
- lint: ✅
- test: ✅ 54/54
- build: ✅

## Aktuálny stav hrateľnosti

### ✅ Funguje
1. **Input edge queue** — krátke stlačenia sa nestrácajú (Etapa 4 hotová)
2. **BallMode ownership** — jeden zdroj pravdy (ball.ownerId + BallMode)
3. **Arkádový dribling** — foot socket, lopta pri hráčovi
4. **Response curve** — analógová intenzita (walk/jog/run/sprint)
5. **Action locomotion** — pohyb spomalený počas windup/contact/recovery
6. **Switching cooldown** — 0.65s auto, 0.8s manual lock
7. **Shoulder/standing/poke/slide** — 4 obranné možnosti
8. **Aftertouch** — post-kock trajectory influence
9. **Player selection** — hysterézia, predikcia dopadu
10. **Weather** — deterministické, modifiery

### ⚠️ Čiastočne
1. **Prihrávky** — fungujú ale chýba passLane safety integrácia do AI
2. **Streľba** — mierenie funguje ale charge mechanismus je jednoduchý
3. **Brankár** — position + dive + parry ale chýbajú save hit zones
4. **Tímová AI** — existuje ale role assignment je základný
5. **Formácie** — hardcoded 1-2-1, chýba dátovo riadený systém

### ❌ Chýba
1. **Trajectory predictor** — neexistuje
2. **Interception estimator** — neexistuje (playerSelection má vlastný)
3. **Ball reception module** — computeFirstTouch je v player.ts
4. **Match state machine** — pravidlá sú v jednom bloku
5. **Goal geometry** — jednoduchá kolízia so žrdami
6. **Gameplay Lab** — neexistuje
7. **7v7 / 11v11** — iba 5v5
8. **Kapitáni / Super Shot** — neexistujú
9. **Tournaments** — neexistujú
10. **Replay** — buffer existuje ale nie je integrovaný

## Prioritný poradie opráv
1. Trajectory predictor + interception estimator
2. Ball reception modul
3. Dátovo riadené formácie
4. Tímová AI s centralizovaným role assignment
5. Brankár save hit zones
6. Match state machine
7. Gameplay Lab
8. 7v7 → 11v11
