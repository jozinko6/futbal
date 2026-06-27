# ⚽ Kačanovská FIFA

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
- Pravidlá: úvodný výkop, gól, aut, rohový kop, kop od brány, **ofsajd**,
  polčas, koniec, pauza, rematch. Fauly zjednodušené na cooldown + omráčenie.
- Ovládanie: klávesnica, gamepad aj mobil (virtuálny joystick + tlačidlá,
  landscape, multitouch).
- **Online multiplayer 1v1** cez internet — autoritatívny Socket.IO server,
  6-miestny kód miestnosti, lobby, synchronizovaný zápas s client-side
  prediction a reconciliation.
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

### Online multiplayer server

Online 1v1 vyžaduje autoritatívny game server (mini-service):

```bash
cd mini-services/game-server
bun install
bun run dev            # spustí Socket.IO server na porte 3003 (bun --hot)
```

Server beží na porte 3003. Klient sa k nemu pripája cez Caddy gateway
(`?XTransformPort=3003`), takže v prehliadači otvor stránku cez Caddy
(port 81 v sandboxe) — nie priamo `localhost:3000`.

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

Autoritatívny Socket.IO server beží v `mini-services/game-server/` (port 3003).
Server používa rovnaký deterministický simulačný balík ako klient:

- vytvára miestnosti s 6-miestnym kódom,
- validuje a rate-limituje vstupy (sequence number, rozsah),
- beží fixed-tick loop nad simuláciou,
- vysiela full snapshoty (~1s) a delta snapshoty (20 Hz),
- ack-uje posledný spracovaný vstup pre client reconciliation,
- pri disconnecte prenechá tím AI počas grace period (8 s),
- nikdy neverí klientskemu skóre/času/pozíciám.

Klient (`src/game/net/client.ts`) posiela iba `InputFrame` so `seq`, beží
client-side prediction vlastného hráča, reconciliation podľa ack a
interpoláciu vzdialených entít.

Ako hrať online:
1. Spusti game server (`mini-services/game-server`).
2. Otvor hru cez Caddy (port 81 v sandboxe).
3. Hráč 1: Menu → Online 1v1 → Nová miestnosť → pošli 6-miestny kód.
4. Hráč 2: v druhom prehliadači/tab → Online 1v1 → zadaj kód → PRIPOJIŤ.
5. Obaja → SOM PRIPRAVENÝ → zápas sa začne po odpočte.

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
  **ofsajd** (3 testy: offside flag, level/behind passer, own half),
  prepínanie stavov zápasu, reset po góle a **determinizmus**.
- **E2E (Playwright):** `bun run test:e2e` — otvorenie menu, spustenie
  offline zápasu, ovládanie hráča, pauza/pokračovanie, nastavenia, lobby.

---

## Licencia

Originálne dielo. Žiadne použité Nintendo/EA/Konami assety, názvy, logá,
postavy, hudba ani kopírovaná grafika.
