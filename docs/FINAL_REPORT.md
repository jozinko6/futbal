# FINAL REPORT — Kačanovská FIFA Rework

## Čo bolo opravené

### Etapa 0 — Audit
- Vytvorené `docs/REWORK_PLAN.md` (problémy, súbory, architektúra, poradie, riziká, acceptance criteria) a `docs/BASELINE.md` (stav pred zmenami: typecheck/lint/test/build zelené, 67 deps, 1020 packages).

### Etapa 1 — Odľahčenie
- Odstránených **56 nepoužitých závislostí** (Prisma, NextAuth, React Query, React Table, MDX editor, DnD Kit, Recharts, date-fns, z-ai-web-dev-sdk, react-syntax-highlighter, 30+ Radix UI komponentov, ...).
- Odstránených 45 nepoužitých UI komponentov (zachované button/slider/switch), toaster/sonner, use-toast/use-mobile hooks, `src/lib/db.ts`, `prisma/`, `db/`, `src/app/api` route.
- 1020 → ~922 packages.

### Etapa 2 — Action systém
- Nový `src/game/simulation/actionSystem.ts`: `PlayerAction` s windup/contact/recovery fázami, `contactAtTick`, `finishAtTick`. Lopta sa kope **len v kontaktnom ticku** (nie okamžite). Možnosť prerušenia v windup, aim locked v contact/recovery. `lastContactTick` pre synchronizáciu zvuku/animácie.

### Etapa 3 — Pohyb + stamina
- `STAMINA` config (max 100, sprintDrain 18/22, regen, fatigueThreshold 25). Únava blokuje šprint a znižuje accel. Sharp turn pri šprinte spomaľuje. Separátne facing/moveDir/aimDir, backward/strafe rýchlosti.

### Etapa 4 — Dribling
- Odstránené `if (touchTimer <= 0 || sp > 1)` — re-touch len po touchTimer. **Malé fyzikálne impulzy** (nie interpolácia/teleport). Touch interval/distance podľa rýchlosti (walk 0.34s/0.25m, sprint 0.16s/1.10m). Sharp turn → lopta odskokí. Šprint → ľahšie odoberateľné.

### Etapa 5 — First touch
- `FirstTouchResult` (controlled/deflection). Majiteľ sa nastaví len pri `controlled`. Zlý dotyk → deflection 0.5-1.8m do voľného priestoru, krátky stun. **Žiaden cyklus** s resolvePossession (lopta ostáva LOOSE).

### Etapa 6 — Prihrávky
- 4 typy (short/driven/through/lob) cez action systém. Obmedzená asistencia ≤20°, rešpektuje vstup. Through-ball predikuje nábeh.

### Etapa 7 — Streľba
- Odstránené `1e6/-1e6` ciele — **reálna bránková čiara**. Mierenie: direction stick volí Y na bránke. 4 typy (placed/power/lob/firstTime). Presnosť z pohybu/rovnováhy/uhla/tlaku/energie/vzdialenosti/nabitia. Plne nabitá nie automaticky najlepšia.

### Etapa 8 — Obrana/Fauly
- Nový `fouls.ts`: `evaluateTackleFoul` sleduje ballContactTick vs playerContactTick. Faul pri zásahu hráča pred loptou, sklze zozadu, alebo keď lopta nie je v dosahu. **Čistý zásah lopty NIE je faul** (predtým automatický faul pri každom sklze).

### Etapy 9-11 — AI + Brankár
- `CLEAR_BALL` podľa **vlastnej** brány (nie súperovej). `INTERCEPT` predikuje priesečník (nie aktuálnu pozíciu). `MARK` medzi súperom a bránou. Brankár: pozícia na arke, reakcia na **pohyb lopty** (nie button), prediction bránkovej čiary, **parry** pri prudkej strele (lopta živá), rush out, distribúcia.

### Etapy 12-13 — Render/Camera
- **Y-sorting** hráčov (aktívny nie automaticky nad). `drawActiveIndicator` samostatne. Asset manifest (`src/game/assets/manifest.ts`). Camera look-ahead + **screen shake** (gól 6px, strela až 3px).

### Etapa 14 — Štandardné situácie
- Restart time limit (5s) — žiadne nekonečné rozohrávky. Futsal: žiadny ofsajd, aut nohou.

### Etapa 15 — Testy
- `tests/gameplay.test.ts` — **14 testov**: dribling (pomalý/šprint/neprilepená), first touch (dobrý/zlý), contact tick (prihrávka/strela), mierenie (horný/dolný roh), čistý sklz nie faul, sklz zozadu faul, AI štruktúra (1 presser, anti-cluster, GK zóna).
- `tests/futsal.sim.test.ts` — **100 AI vs AI zápasov** (dokončiteľnosť ≥90, lopta nezaseknutá, GK v zóne, prihrávky, anti-cluster, determinizmus, reset formácie).
- `docs/AI_SIMULATION_REPORT.md`.

### Etapa 16 — Multiplayer
- Server: **accumulator loop** (monotónny čas, spiral guard), **last input hold** (nie empty input), `lastFullSnapshotAt` samostatné pole, **AI takeover** (controllerIndex=-1 pri disconnecte), **sessionId + reconnectToken**, reconnect handler.
- Klient: **reálna interpolácia** (snapshot buffer ~100ms, x/y/facing/z), `reconnectRoom()`, reconciliation (replay unacked).

## Výsledky testov

| Test suite | Počet | Stav |
|-----------|-------|------|
| `simulation.test.ts` | 30 | ✅ |
| `futsal.sim.test.ts` | 4 (100 zápasov) | ✅ |
| `gameplay.test.ts` | 14 | ✅ |
| **Spolu** | **48** | ✅ |

- `bunx tsc --noEmit` — čisté
- `bun run lint` — čisté
- `bun run build` — prešiel

## Výsledky AI simulácií
- 100/100 zápasov beží bez zaseknutia lopty.
- ≥90/100 sa dokončí (zvyšné tied→shootout).
- Priemerné skóre 0-6 gólov (nie absurdné).
- Tímy tvoria prihrávky (avgPasses > 5).
- Hráči sa nezhlukujú (min vzdialenosť > 1.0 m).
- Brankár zriedka mimo zónu.
- Determinizmus: rovnaký seed → rovnaký výsledok.

## Známe limity
- Procedurálne generované sprity (32×40, 8 smerov, 16 animácií) sú placeholder; asset manifest je pripravený na načítanie reálnych PNG.
- Online multiplayer vyžaduje spustený game server (`mini-services/game-server`) a prístup cez Caddy gateway (port 81).
- Krátky halfLength v sim testoch (12s) — testuje štruktúru, nie produkciu.
- Penaltový rozstrel je deterministický (RNG-based), nie interaktívny.

## Presný postup lokálneho spustenia

```bash
bun install            # nainštaluje závislosti
bun run dev            # Next.js dev server na porte 3000
```

Otvor **Preview Panel** (port 81 cez Caddy v sandboxe). Hra: Menu → Hrať zápas (vs AI) → Štart. Debug overlay: **F3**.

## Presný postup spustenia multiplayer servera

```bash
cd mini-services/game-server
bun install
bun run dev            # Socket.IO server na porte 3003
```

Klient sa pripája cez `io('/?XTransformPort=3003')` (Caddy gateway). Online: Menu → Online 1v1 → Nová miestnosť → pošli kód súperovi → obaja SOM PRIPRAVENÝ.

## Odporúčané ďalšie vylepšenia
1. **Reálne spritesheety** — nahradiť procedurálne sprity PNG sheetmi podľa manifestu (27 animácií).
2. **Zvuky v kontaktnom ticku** — prepojiť `lastContactTick` s audio systémom pre presný kick sound.
3. **Pass lane safety** — implementovať `passing.ts` s ray-castom pre blokovanie prihrávok cez obrancov.
4. **Predĺženie/penalty v normálnom zápase** — pridať extra time pred shootout.
5. **Replay systém** — nahrávať snapshoty pre goal replay.
6. **Online e2e testy** — Playwright testy pre room/join/reconnect.
7. **Lepšia AI朝čné útoky** — implementovať BACK_POST_RUN a MOVE_WIDE pre krídla.
8. **Stamina vizualizácia** — HUD bar pre aktivného hráča.
