# ARCADE REWORK PLAN

## Cieľ
Transformovať hru na arkádový futbal v štýle Taito Cup Finals (originálne, bez ripnutých assetov).
Priorita: okamžitá odozva, jednoduché ovládanie, čitateľná akcia, rýchly arkádový futbal.

## Poradie implementácie (podľa promptu)
1. Baseline + audit ✅
2. Vypnutie efektov (Etapa 1)
3. Jeden zdroj vlastníctva lopty — BallMode (Etapa 2)
4. Arkádový dribling (Etapa 3)
5. Input loop — edge queue (Etapa 4)
6. Analógový pohyb + response curve (Etapa 5)
7. Zjednodušené ovládanie — Classic Arcade (Etapa 6)
8. Oddelenie pohybu a mierenia (Etapa 7)
9. Action systém + locomotion (Etapa 8)
10. Prihrávky (Etapa 9)
11. Streľba (Etapa 10)
12. Obrana (Etapa 11)
13. Contain fix (Etapa 12)
14. Switching cooldown (Etapa 13)
15. Brankár (Etapa 14)
16. Tímová AI (Etapa 15)
17. 7v7 → 11v11 (Etapa 16)
18. Pseudo-perspektívna kamera (Etapa 17)
19. 4:3 rendering (Etapa 18)
20. Vizuálny štýl + sprity (Etapa 19)
21. HUD (Etapa 20)
22. Tímy + Ace Striker (Etapa 21)
23. Special Menu (Etapa 22)
24. Režimy (Etapa 23)
25. Pravidlá (Etapa 24)
26. Audio (Etapa 25)
27. Prezentačné efekty oprava (Etapa 26)
28. Gameplay Lab (Etapa 27)
29. Testy (Etapa 28)
30. Sim testy (Etapa 29)
31. Dokumentácia (Etapa 30)

## Acceptance criteria (z promptu)
- Krátke stlačenia sa nestrácajú
- Jeden zdroj vlastníctva lopty
- Dribling spoľahlivý a arkádový
- Analógový joystick ovláda intenzitu
- Prihrávky okamžité a čitateľné
- Streľba cieliteľná
- Obrana rozmanitá (shoulder/standing/poke/slide)
- Auto-switch má cooldown
- Brankár fyzicky zasiahne loptu pri dive
- Tímová AI prideľuje úlohy centrálne
- Quick Match plne hrateľný
- Offline zápas zábavný aj bez efektov
