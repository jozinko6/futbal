# ⚽ Retro Football Arena

Originálna arkádová futbalová hra inšpirovaná rýchlymi 16-bitovými futbalmi,
plne hrateľná v desktopovom aj mobilnom prehliadači. Žiadne cudzie assety,
logá, postavy ani hudba — všetko (grafika, zvuky, fyzika, AI) je originálne a
generované programovo.

- Pohľad zhora, pixel-art, virtuálne rozlíšenie **640 × 360** s integer
  scaling a nearest-neighbor renderingom.
- **5 vs 5** (vrátane brankárov), jeden hráč ovláda aktívneho hráča, zvyšok
  riadi AI stavový automat (Easy / Normal / Hard).
- **Deterministická simulácia** v čistom TypeScripte (nezávislá od DOM/Canvas),
  fixed timestep 60 Hz — použiteľná klientom aj autoritatívnym serverom.
- Rýchla arkádová hrateľnosť: prihrávky, vysoká prihrávka, nabíjanie strely,
  sklzy, držanie lopty, vlastná 2D fyzika lopty (trenie, odraz, výška, žrde).
- Pravidlá: úvodný výkop, gól, aut, rohový kop, kop od brány, polčas, koniec,
  pauza, rematch. (Ofsajd v MVP nie je; fauly zjednodušené na cooldown + omráčenie.)
- Ovládanie: klávesnica, gamepad aj mobil (virtuálny joystick + tlačidlá,
  landscape, multitouch).
- Lokálny 2-hráčovsky režim.

> **Poznámka k prostrediu:** tento repozitár beží v sandboxe ako Next.js 16
> aplikácia na porte 3000 (jediná viditeľná routa `/`). Architektúra, ktorú
> špecifikuje zadanie (pnpm workspaces: `apps/web`, `apps/server`,
> `packages/simulation`, `packages/protocol`, `packages/config`, `assets`,
> `docs`), je vnútorne prevedená ako moduly v `src/game/*` (`simulation`,
> `render`, `audio`, `input`, `net`) tak, aby bola **skutočne hrateľná v
> preview**. Deterministický simulačný balík `src/game/simulation` je čistý TS
> bez DOM závislostí — identický kód by bežal v samostatnom `apps/server`.
> Sieťový protokol je definovaný v `src/game/net/protocol.ts`.

---

## Rýchly štart (sandbox / lokálne)

```bash
bun install            # nainštaluje závislosti
bun run dev            # spustí Next.js dev server na http://localhost:3000
```

Otvor **Preview Panel** vpravo (alebo `Open in New Tab`). Neotváraj
`http://localhost:3000` priamo — tá adresa je interná.

Ostatné príkazy:

```bash
bun run lint           # ESLint
bun run typecheck      # TypeScript (tsc --noEmit)
bun run test           # Vitest unit testy simulácie
bun run test:e2e       # Playwright e2e (vyžaduje stiahnuté browstery)
```

> `pnpm` aj `bun` spúšťajú rovnaké skripty z `package.json`, takže
> `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm test:e2e` fungujú rovnako
> (stačí mať nainštalovaný pnpm). V sandboxe je predinštalovaný `bun`.

---

## Ovládanie

### Klávesnica (Hráč 1)
| Kláves | Akcia |
|---|---|
| `W A S D` / šípky | pohyb |
| `J` | prihrávka |
| `I` | vysoká prihrávka (lob) |
| `K` | strela (podrž pre nabitie sily) / sklz (bez lopty) |
| `L` / `Shift` | šprint |
| `Q` | prepnutie hráča |
| `Esc` | pauza |

### Klávesnica (Hráč 2 — lokálny multiplayer)
| Kláves | Akcia |
|---|---|
| šípky | pohyb |
| `,` | prihrávka |
| `/` | vysoká prihrávka |
| `.` | strela / sklz |
| `Shift` | šprint |
| `M` | prepnutie hráča |

### Gamepad
ľavá páčka / D-pad = pohyb, **A** prihrávka, **B** strela/sklz, **X** lob,
**RB** šprint, **LB** prepínanie, **Start** pauza.

### Mobil
Virtuálny analógový joystick (vľavo) + tlačidlá prihrávka / strela / šprint /
prepínanie / lob (vpravo), landscape, multitouch. Scrollovanie a zoom počas
zápasu sú blokované (`touch-action: none`).

---

## Architektúra

Pozri [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Skratka:

- **`src/game/simulation/`** — deterministický TS modul (žiadny DOM/Canvas).
  `step(state, input, dt)` je čistá vzhľadom na externý stav a používa seeded
  RNG, takže rovnaké vstupy dávajú rovnaký výsledok na klientovi aj serveri.
  Obsahuje: fyziku lopty, hráčov (stavový automat), AI (stavový automat +
  reakčná latencia podľa náročnosti), pravidlá (gól, aut, roh, kop od brány,
  výkop, polčas, koniec), formácie, validáciu vstupov.
- **`src/game/render/`** — Canvas renderer (pixel-art), kamera, HUD.
- **`src/game/input/`** — klávesnica + gamepad + touch → `InputFrame`.
- **`src/game/audio/`** — Web Audio programové zvuky.
- **`src/game/net/protocol.ts`** — Socket.IO protokol pre autoritatívny server
  (client posiela iba časovo označené vstupy so `seq`; server posiela
  full/delta snapshoty, ack posledného spracovaného vstupu).
- **`src/components/game/`** — React scény (Menu, TeamSelect, HowTo, Settings,
  Pause, Results, Lobby) + `GameContainer` (fixed-timestep loop, integer
  scaling, sticky footer).

Klient nikdy neposiela serveru pozície, skóre ani čas — iba `InputFrame` so
sequence numberom.

---

## Online multiplayer (1v1)

Architektúra je pripravená pre autoritatívny Socket.IO server (protokol v
`src/game/net/protocol.ts`). Server by:
- bežal na samostatnom porte s vlastným fixed-tick loopom nad
  `src/game/simulation`,
- vytváral miestnosti s 6-miestnym kódom,
- validoval a rate-limitoval vstupy,
- vysielal full snapshot pri pripojení/resync a delta snapshoty počas hry,
- dočasne prenechal tím odpojeného hráča AI (grace period),
- nikdy neveril klientskemu skóre/času/pozíciám.

Klient by robil client-side prediction vlastného hráča, reconciliation podľa
posledného ack-ovaného vstupu a interpoláciu vzdialených entít.

> V jednopoužívateľskom sandboxe nie je reálny 1v1 cez sieť demonštrovateľný;
> plne hrateľný je **offline zápas vs AI** a **lokálny 2 hráči**. Lobby UI
  (`LobbyScreen`) generuje kód miestnosti a zobrazuje stav/ping.

---

## Produkčné nasadenie

```bash
# Render (render.yaml je pripravený)
# Nastav NEXT_PUBLIC_GAME_SERVER_URL na URL samostatného game servera.

# Docker
docker build -t retro-football-arena .
docker run -p 3000:3000 retro-football-arena
```

Pozri [`.env.example`](.env.example) pre všetky premenné.

---

## Testy

- **Unit (Vitest):** `bun run test` — pokrýva pohyb lopty pri fixed timestep,
  trenie, cap rýchlosti, odraz, detekciu gólu, crossbar, aut/roh/kop od brány,
  prepínanie stavov zápasu (výkop→play→polčas→koniec), reset po góle a
  **determinizmus** (rovnaké vstupy + seed → rovnaký stav).
- **E2E (Playwright):** `bun run test:e2e` — otvorenie menu, spustenie
  offline zápasu, ovládanie hráča, pauza/pokračovanie, nastavenia, lobby.

---

## Licencia

Originálne dielo. Žiadne použité Nintendo/EA/Konami assety, názvy, logá,
postavy, hudba ani kopírovaná grafika.
