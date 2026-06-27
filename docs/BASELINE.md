# BASELINE — stav pred reworkom

Dátum auditu: 2025-06-27
Repozitár: https://github.com/jozinko6/futbal
Commit: 140a62d (main)

## Výsledky kontrol pred zmenami

### install
```
bun install v1.3.14
Checked 922 installs across 1020 packages (no changes)
```
- 1020 packages (veľa — Next.js štartér s nepoužitými deps).
- Žiadne chyby.

### typecheck
```
bunx tsc --noEmit
```
- ✅ Čisté (žiadne chyby mimo `examples/` a `skills/`).

### lint
```
bun run lint  →  $ eslint .
```
- ✅ Čisté (0 errors, 0 warnings).

### unit testy
```
bunx vitest run
```
- ✅ 34/34 prechádza.
  - `tests/simulation.test.ts` — 30 testov (fyzika lopty, ofsajd [no-op v
    futsale], hranice, restart shield, free kick, penalty, GK protection,
    GK 5s limit, penalty shootout, determinizmus).
  - `tests/futsal.sim.test.ts` — 4 testy (100 AI vs AI zápasov, skóre,
    determinizmus, reset formácie po góle).
- Trvanie ~5.4s (100-zápasový sim test ~5s).

### produkčný build
```
bun run build
```
- ✅ Prešiel.
  - Next.js 16.1.3 (Turbopack).
  - Compiled successfully in 9.1s.
  - Route `/` (static), `/_not-found` (static), `/api` (dynamic).

## Štruktúra projektu

```
src/game/
  simulation/   13 súborov — deterministická futsal 5v5 sim (metres-based)
  render/        4 súbory  — Canvas renderer, camera, field, spriteSheet
  input/         1 súbor   — InputManager (klávesnica/gamepad/touch)
  audio/         1 súbor   — Web Audio Sound
  net/           2 súbory  — Socket.IO klient + protokol
src/components/game/        React scény (Menu, Match, Online, ...)
src/components/ui/          shadcn/ui komponenty (mnoho nepoužitých)
mini-services/game-server/  autoritatívny Socket.IO server (port 3003)
tests/                      Vitest unit + sim testy
tests/e2e/                  Playwright e2e
docs/                       dokumentácia
assets/                     vendor/, generated/, game/
```

## Závislosti (67 deps, 13 devDeps)

Použité (potvrdené importmi):
- next, react, react-dom
- socket.io-client (klient), socket.io (server v mini-services)
- tailwind-merge, clsx, class-variance-authority (UI)
- lucide-react (ikony)
- tailwindcss, @tailwindcss/postcss, tw-animate-css, tailwindcss-animate
- framer-motion (animácie UI)
- sonner (toasty)
- next-themes (theme)
- @radix-ui/* (použité: dialog, switch, slider, label, slot, separator —
  zvyšné nepoužité)
- zod (validácia inputov)
- sharp (obrázky)

Nepoužité (kandidáti na odstránenie v Etape 1):
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- @hookform/resolvers, react-hook-form
- @mdxeditor/editor, react-markdown, react-syntax-highlighter
- @prisma/client, prisma
- @radix-ui/react-accordion, -alert-dialog, -aspect-ratio, -avatar,
  -checkbox, -collapsible, -context-menu, -dropdown-menu, -hover-card,
  -menubar, -navigation-menu, -popover, -progress, -radio-group,
  -scroll-area, -select, -tabs, -toast, -toggle, -toggle-group, -tooltip
- @reactuses/core
- @tanstack/react-query, @tanstack/react-table
- cmdk
- date-fns
- embla-carousel-react
- input-otp
- next-auth
- next-intl
- react-day-picker
- react-resizable-panels
- recharts
- uuid
- vaul
- z-ai-web-dev-sdk

devDeps nepoužité: @types/react, @types/react-dom (použité), @types/bun,
bun-types, eslint, eslint-config-next, typescript, vitest, @playwright/test,
canvas (všetky použité).

## Známe problémy (podrobne v REWORK_PLAN.md)

1. Lopta prilepená (dribble re-touch každý tick).
2. Streľba na `1e6` cieľ (nemožno mieriť na rohy).
3. Žiadny action systém (okamžitý kick, žiadny kontaktný tick).
4. First-touch cyklus (computeFirstTouch → resolvePossession znova priradí).
5. Sklz → automatický faul (bez ohľadu na zásah lopty).
6. CLEAR_BALL podľa súperovej brány, INTERCEPT na aktuálnu pozíciu, MARK do
   stredu súpera.
7. Brankár bez prediction, parry nie rozlíšený.
8. Animácie nie synchronizované s akciou, žiadny Y-sort.
9. Server: setInterval, prázdny input, lastFullSnapshotAt v MatchState.
10. Klient: žiadny snapshot buffer, identita cez socket.id.

## Záver

Baseline je zelený (typecheck/lint/test/build prechádzajú). Projekt je
spustiteľný prototyp, ale gameplay trpí problémami vyššie. Rework postupuje
podľa `REWORK_PLAN.md` — offline gameplay (etapy 1–15) ako priorita,
multiplayer (16–17) až potom.
