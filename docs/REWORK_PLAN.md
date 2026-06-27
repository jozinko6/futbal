# REWORK PLAN — Kačanovská FIFA

Systematický rework existujúceho prototypu na kvalitný hrateľný futsal 5v5.
Hlavná priorita: **jeden kvalitný offline zápas 5v5 proti AI**.

## Súčasné problémy (audít)

Identifikované po prejdení `src/game/simulation`, `src/game/render`, `src/game/net`:

### Gameplay
1. **Lopta prilepená k hráčovi** — `dribble()` v `player.ts:269` re-touchuje každý tick
   keď `sp > 1` (`if (ball.touchTimer <= 0 || sp > 1)`), čím sa lopta neustále
   pripevňuje pred hráča silnou interpoláciou namiesto fyzikálnych impulzov.
2. **Streľba s fiktívnymi cieľmi** — `simulation.ts:155` používa
   `goalX = 1e6 / -1e6` namiesto skutočnej bránkovej čiary → nemožno cielene
   mieriť na rohy.
3. **Žiadny action systém** — prihrávka/strela okamžite kopnú loptu; animácia
   iba dodatočne predstiera windup/contact/recovery. Žiadny kontaktný tick.
4. **First-touch cyklus** — `computeFirstTouch` uvoľní loptu pri zlom dotyku,
   ale `resolvePossession` v ďalšom tiku znova priradí toho istého hráča ako
   majiteľa → zlý dotyk nemá následok.
5. **Pohyb** — chýba stamina systém; sharp turn penalty je prítomná ale
   netestovaná; backward/strafe rýchlosti v configu ale nie dôsledne použité.
6. **Obrana** — sklz → automatický faul pri každom kontakte s hráčom
   (`simulation.ts` collision loop), bez ohľadu na to, či trafil loptu.
7. **AI** — utility-based ale `CLEAR_BALL` sa hodnotí podľa vzdialenosti od
   *súperovej* brány (mal by od vlastnej); `INTERCEPT` ide na aktuálnu pozíciu
   lopty namiesto predikcie; `MARK` ide do stredu súpera namiesto medzi
   súpera a bránu.
8. **Brankár** — reakčný čas prítomný ale position-based, nie prediction-based;
   pri strele len porovnáva `t*1000 < reactMs`; žiadny parry rozlíšený od
   catch; po vyrazení lopta nie garantovane živá.
9. **Animácie** — kontaktný frame animácie nie synchronizovaný s kontaktným
   tickom akcie; chýba Y-sorting hráčov (aktívny vždy na vrch).
10. **Štandardné situácie** — possession shield chráni, ale chýba časový
    limit na rozohrávku a presná隔离 pre súperov.

### Architektúra / build
11. **Zbytočné závislosti** — 67 deps z Next.js štartéra (Prisma, NextAuth,
    React Query, React Table, MDX editor, DnD Kit, Recharts, date-fns,
    z-ai-web-dev-sdk, react-syntax-highlighter, ...) — väčšina nepoužitá.
12. **Vendor referencie** v `assets/vendor/` sa rešpektujú cez `.gitignore`.
13. **Build** prechádza, ale obsahuje nepoužité UI komponenty.

### Multiplayer (až po offline)
14. **Server** — `setInterval(Math.round(FIXED_DT*1000))` namiesto accumulator;
    aplikuje prázdny input v tickoch bez novej správy; `lastFullSnapshotAt`
    uložené ako pretypované pole v `MatchState`.
15. **Klient** — `interpolatedState` vracia len najnovší stav (žiadny buffer);
    reconciliation replay funguje ale bez smooth/kontrolrovanej korekcie;
    identita cez `socket.id` (žiadne reconnectToken/sessionId).

## Súbory na úpravu (podľa etapy)

| Etapa | Súbory |
|-------|--------|
| 1 Odľahčenie | `package.json`, `src/components/ui/*` (odstrániť nepoužité), `src/app/**` |
| 2 Action systém | `src/game/simulation/types.ts` (PlayerAction), `src/game/simulation/player.ts`, nový `actionSystem.ts` |
| 3 Pohyb | `src/game/simulation/player.ts`, `tacticsConfig.ts` (stamina) |
| 4 Dribling | `src/game/simulation/player.ts` (dribble), `ball.ts` |
| 5 First touch | `src/game/simulation/player.ts` (computeFirstTouch, resolvePossession) |
| 6 Prihrávky | `src/game/simulation/player.ts` (pass types), `passing.ts` (lane safety) |
| 7 Streľba | `src/game/simulation/player.ts` (shoot), `simulation.ts` (cieľ) |
| 8 Obrana/Fauly | `src/game/simulation/player.ts` (tackles), `simulation.ts` (foul detection), nový `fouls.ts` |
| 9 Tímová AI | `src/game/simulation/teamTactics.ts` (role assignment, anti-cluster) |
| 10 Individuálna AI | `src/game/simulation/ai.ts` (utility rework, intercept/mark/clearball) |
| 11 Brankár | `src/game/simulation/goalkeeper.ts` (states, prediction, parry) |
| 12 Animácie/Render | `src/game/render/renderer.ts` (Y-sort, net layers), `spriteSheet.ts`, nový `src/game/assets/manifest.ts` |
| 13 Camera/Feel | `src/game/render/camera.ts`, `renderer.ts` (shake, flash), `audio/Sound.ts` |
| 14 Štandardné situácie | `src/game/simulation/rules.ts` (kickIn, goalClearance, time limits) |
| 15 Testy | `tests/gameplay.test.ts`, `tests/futsal.sim.test.ts`, `docs/AI_SIMULATION_REPORT.md` |
| 16 Multiplayer | `mini-services/game-server/index.ts`, `src/game/net/client.ts`, `protocol.ts` |
| 17 Online testy | `tests/online.test.ts` |
| 18 Dokumentácia | `docs/*.md`, `README.md`, `docs/FINAL_REPORT.md` |

## Navrhovaná architektúra

Zachováva existujúce oddelenie:

```
src/game/simulation/   deterministická, žiadny DOM, seeded RNG, fixed timestep
  ├── tacticsConfig.ts      všetky tunable hodnoty (SI units)
  ├── types.ts              PlayerAction, FirstTouchResult, BallState, ...
  ├── rng.ts                mulberry32 (zachovať)
  ├── math.ts               (zachovať)
  ├── input.ts              (zachovať)
  ├── ball.ts               fyzika lopty (impulzy, nie teleport)
  ├── formation.ts          1-2-1 futsal
  ├── player.ts             pohyb, dribling, first touch, tackles
  ├── actionSystem.ts       NOVÉ — PlayerAction windup/contact/recovery
  ├── passing.ts            NOVÉ — pass lane safety, assistencia
  ├── shooting.ts           NOVÉ — mierenie na bránu, presnosť
  ├── fouls.ts              NOVÉ — foul detekcia (zozadu/pred loptou)
  ├── ai.ts                 utility-based (rework utilities)
  ├── teamTactics.ts        9 fáz + role assignment + anti-cluster
  ├── goalkeeper.ts         stavy + prediction + parry
  ├── rules.ts              štandardné situácie + časové limity
  └── simulation.ts         orchestrácia step()
src/game/render/        browser-only, nemení sim stav
src/game/input/         InputManager (klávesnica/gamepad/touch)
src/game/audio/         Web Audio
src/game/net/           Socket.IO klient + protokol
src/components/game/    React scény
mini-services/game-server/  autoritatívny server
```

## Poradie implementácie

Etapy 0–15 tvoria **offline gameplay** (hlavná priorita). Až keď je offline
funkčný a otestovaný, pokračujú etapy 16–17 (multiplayer). Etapa 18
(dokumentácia) prebieha priebežne.

0. Audit + baseline ✅ (tento dokument)
1. Odľahčenie projektu (odstráň nepoužité deps)
2. Action systém (PlayerAction, kontaktný tick)
3. Pohyb (stamina, separátne smery, sharp turn)
4. Dribling (impulzy, nie interpolácia)
5. First touch (controlled/deflection, žiaden cyklus)
6. Prihrávky (4 typy, lane safety)
7. Streľba (reálny cieľ na bráne, mierenie)
8. Obrana (4 typy, fouly podľa uhla/zoza)
9. Tímová AI (9 fáz, role, anti-cluster)
10. Individuálna AI (utility rework, intercept/mark)
11. Brankár (stavy, prediction, parry)
12. Animácie/Render (Y-sort, net layers, manifest)
13. Camera/Feel (look-ahead, shake, flash)
14. Štandardné situácie (kickIn, goalClearance, time limits)
15. Testy gameplay + AI sim report
16. Multiplayer (server loop, interpolation, reconciliation, reconnect)
17. Online testy
18. Dokumentácia + FINAL_REPORT

## Riziká

- **Determinizmus** — action systém a stamina nesmú zaviesť `Math.random`;
  všetka náhodnosť cez seeded `rng.ts`.
- **API stabilita** — renderer a GameContainer importujú z `@/game/simulation`;
  zachovať exporty (`createMatchState`, `step`, `stepMulti`, konštanty, typy).
- **Výkon** — 100 AI zápasov musí bežať rozumne (<30s); anti-cluster a lane
  safety nemajú byť O(n³).
- **Multiplayer neskôr** — offline musí byť hotový; riziko regressie ak sa
  mení `stepMulti` API.
- **Build** — Next.js 16 standalone build; odstránenie deps nesmie rozbíjať
  `next/font` alebo Tailwind.

## Acceptance criteria každej etapy

- **Etapa 1**: `bun install` inštaluje menej balíkov; typecheck/lint/test/build
  zelené.
- **Etapa 2**: `PlayerAction` existuje; lopta sa kope len v `contact` fáze;
  zvuk v kontaktnom ticku.
- **Etapa 3**: stamina 0–100; sharp turn spomaľuje; backward pomalší;
  spoluhráči sa neprekrývajú.
- **Etapa 4**: dribling používa impulzy; touch interval podľa rýchlosti;
  šprint → ľahšie odoberateľné.
- **Etapa 5**: `FirstTouchResult` controlled/deflection; zlý dotyk reálne
  uvoľní loptu; žiaden cyklus s resolvePossession.
- **Etapa 6**: 4 typy prihrávok s odlišnou rýchlosťou/dráhou; asistencia ≤20°;
  lane safety blokuje prihrávku cez obrancu.
- **Etapa 7**: mierenie na reálnu bránkovú čiaru; 4 typy strely; presnosť
  podľa pohybu/energie/tlaku.
- **Etapa 8**: 4 obranné možnosti; sklz má windup/active/recovery; čistý
  zásah lopty ≠ faul; faul zozadu/pred loptou.
- **Etapa 9**: 9 tímových fáz; role assignment; jeden presser + jeden cover;
  anti-cluster.
- **Etapa 10**: 10+11 akcií; INTERCEPT predikuje; MARK medzi súperom a bránou;
  CLEAR_BALL podľa vlastnej brány.
- **Etapa 11**: GK stavy; prediction bránkovej čiary; parry pri prudkej strele;
  reakčný čas.
- **Etapa 12**: asset manifest; kontaktný frame = kontaktný tick; Y-sort;
  predná sieť nad hráčom v bráne.
- **Etapa 13**: look-ahead; shake pri strele/žrdi; freeze frame pri góle;
  flash siete.
- **Etapa 14**: kickIn/goalClearance/freeKick/penalty; odstup súperov; časový
  limit; žiadny ofsajd.
- **Etapa 15**: unit testy (dribling, first touch, contact tick, fouly, GK,
  anti-cluster); 100 AI zápasov zelených; `AI_SIMULATION_REPORT.md`.
- **Etapa 16**: server accumulator; last input hold; `lastFullSnapshotAt`
  samostatné; snapshot buffer 100ms; reconciliation; reconnectToken; AI
  takeover.
- **Etapa 17**: online testy (room, ready, ack, reconciliation, interpolation,
  disconnect, AI takeover, reconnect, rematch).
- **Etapa 18**: README/ARCHITECTURE/GAMEPLAY/AI/NETWORKING/CONTROLS/ASSETS/
  TESTING/PROGRESS aktualizované; `FINAL_REPORT.md`.

Po každej etape: typecheck + lint + test + build musia prejsť.
