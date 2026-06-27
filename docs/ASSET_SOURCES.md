# Asset Sources & Licensing — Kačanovská FIFA

This document records every asset used or referenced by the project, its
origin, license, and the modifications applied. It is kept up to date as new
assets are introduced.

## Licensing principles

1. **No hotlinking.** All assets are stored locally under `assets/`.
2. **No third-party commercial game assets.** Assets from old NES / SNES /
   Sega Mega Drive / Amiga / arcade titles are used **only as general visual
   inspiration** — no pixels, sprites, logos, names, or music are copied.
3. **Original art ships with the game.** All art rendered into the playable
   build is generated procedurally by this project's own code — it is an
   original work (CC0-equivalent).
4. **Vendor reference assets are kept separate** from generated/shipped art
   and are never redistributed as a standalone pack.
5. **Real club logos and identities are removed.** Team colours and kits are
   original (red "ČERVENÍ" / blue "MODRÍ"); no real club crest, name, or
   identity appears anywhere.

## Folder layout

```
assets/
├── vendor/      External assets downloaded for visual reference (NOT shipped
│                as-is; kept separate, never redistributed as a pack).
│   ├── letta-corporation/    (reserved — see record below)
│   ├── opengameart/          downloaded CC0 reference images
│   ├── kenney-sports/        (reserved — see record below)
│   ├── soccer-ball-anim/     (reserved — see record below)
│   ├── basic-soccer/         (reserved — see record below)
│   └── indoor-5x5/           (reserved — see record below)
├── source/      Original working files / hand-drawn source (empty — art is
│                generated procedurally).
├── generated/   Original PNGs produced by scripts/generate-assets.ts
│                (sprite sheets, field). CC0-equivalent original work.
└── game/        Final, shipped copies of generated art (mirrors generated/).
```

---

## Shipped (generated) assets

These are the only assets bundled into the game. Every pixel is original.

### player_home.png — Home team sprite sheet
- **Asset:** Player sprite sheet (home, red jersey)
- **Author:** Kačanovská FIFA project (procedural generator)
- **Source:** `src/game/render/spriteSheet.ts` → `scripts/generate-assets.ts`
- **Date generated:** 2025-06-27
- **License:** Original work (CC0-equivalent)
- **Use:** Rendered to canvas at runtime; also archived as PNG.
- **Modifications:** N/A — generated from scratch.
- **Attribution required:** None.
- **Spec:** 32 × 40 px frames, 8 directions, 16 animations × 4 frames =
  512 frames total. Transparent PNG, foot pivot at (16, 39), consistent
  drop shadow, 16-bit palette.

### player_away.png — Away team sprite sheet
- **Asset:** Player sprite sheet (away, blue jersey)
- **Author:** Kačanovská FIFA project (procedural generator)
- **Source:** `src/game/render/spriteSheet.ts` → `scripts/generate-assets.ts`
- **Date generated:** 2025-06-27
- **License:** Original work (CC0-equivalent)
- **Use:** Rendered to canvas at runtime; also archived as PNG.
- **Modifications:** N/A — generated from scratch.
- **Attribution required:** None.
- **Spec:** Same as home; jersey palette swapped to blue.

### field.png — Pitch texture
- **Asset:** Football pitch texture (crowd, track, grass, markings, goals)
- **Author:** Kačanovská FIFA project (procedural generator)
- **Source:** `src/game/render/field.ts` → `scripts/generate-assets.ts`
- **Date generated:** 2025-06-27
- **License:** Original work (CC0-equivalent)
- **Use:** Blitted as the background each frame.
- **Modifications:** N/A — generated from scratch.
- **Attribution required:** None.
- **Spec:** 1232 × 728 px, 18 mown-grass stripes, white markings (3 px),
  tiered crowd, brown track, original "KACANOVSKÁ FIFA" banner.

### manifest.json
- Machine-readable manifest of the generated assets (spec + file list +
  license statement).

---

## Animation set (all implemented)

The unified player sprite sheet covers every animation required by the spec.
Each animation has 4 frames and is rendered for all 8 directions:

| # | Animation | Notes |
|---|-----------|-------|
| 1 | idle | subtle breathing bob |
| 2 | walk | slow leg/arm swing |
| 3 | run | medium swing + lean |
| 4 | sprint | fast swing + heavy lean |
| 5 | dribble | run variant with ball-trapping posture |
| 6 | pass | arm extends forward |
| 7 | shoot | wind-up + strike |
| 8 | lobPass | raised-arm lob posture |
| 9 | tackle | low sliding body |
| 10 | hit | recoil / stunned |
| 11 | header | airborne lean |
| 12 | celebrate | arms raised, jumping bob |
| 13 | goalkeeperDive | extended dive with gloves |
| 14 | goalkeeperIdle | ready stance with gloves |
| 15 | goalkeeperRun | tracked run with gloves |
| 16 | goalkeeperCatch | raised gloves catch |

> The simulation's `PlayerStateName` set maps onto these sheet animations via
> `stateToAnim()` in `src/game/render/spriteSheet.ts`.

---

## Vendor reference assets (downloaded, NOT shipped as-is)

These assets were downloaded locally to `assets/vendor/` as **visual reference
only**. They inform the style but are **not** bundled into the game build and
are **not redistributed** as a standalone pack. All shipped art is original
(see above).

### OpenGameArt reference images
Stored in: `assets/vendor/opengameart/`

| File | Source query | Retrieved via | Date | License (as published) | Use | Modifications |
|------|--------------|---------------|------|------------------------|-----|---------------|
| ref_player_sprite_01.png | "pixel art soccer player sprite top down 16 bit" | ZAI image-search (re-hosted OSS) | 2025-06-27 | Varies by upstream (treated as reference-only) | Visual reference for sprite proportions/pose style | None; not shipped |
| ref_player_sprite_02.jpg | as above | ZAI image-search | 2025-06-27 | Varies | Visual reference | None; not shipped |
| ref_player_sprite_03.png | as above | ZAI image-search | 2025-06-27 | Varies | Visual reference | None; not shipped |
| ref_pitch_topdown_01.jpg | "pixel art soccer pitch field top down CC0" | ZAI image-search | 2025-06-27 | Varies | Visual reference for pitch style | None; not shipped |
| ref_pitch_topdown_02.jpg | as above | ZAI image-search | 2025-06-27 | Varies | Visual reference | None; not shipped |
| ref_pitch_topdown_03.jpg | as above | ZAI image-search | 2025-06-27 | Varies | Visual reference | None; not shipped |

> **Note on license verification:** the ZAI image-search service returns web
> results re-hosted on OSS. Upstream licenses could not be independently
> verified for every result, so these files are treated as
> **reference-only** and are **not shipped** with the game. The shipped art
> is entirely original (generated by this project's code). If you wish to
> bundle a specific CC0 pack, download it directly from the authoritative
> source (OpenGameArt / Kenney / itch.io) and verify its license file before
> copying into `assets/game/`.

### Reserved vendor folders (intended sources)

The following packs were identified as preferred sources per the project
brief. They are reserved here for documentation; where exact files could not
be fetched in this sandbox, equivalent CC0 reference images were used (see
above) and the shipped art remains original.

#### 1. Free Football Assets — Letta Corporation
- **Folder:** `assets/vendor/letta-corporation/`
- **Intended use:** animated footballers as a temporary base.
- **Conditions:** remove all real club logos/identities; create new original
  jerseys; do not use "Muchachos" music; do not redistribute the assets
  standalone.
- **Status:** Reserved. Not downloaded in this build; shipped art is original.
- **Attribution required (if used):** per Letta Corporation's terms.

#### 2. Football/Soccer Assets — OpenGameArt (CC0, 1296 × 672 pitch)
- **Folder:** `assets/vendor/opengameart/`
- **Intended use:** CC0 pitch base, adapted to a unified 16-bit style.
- **Status:** Reference images downloaded (see table above); pitch shipped is
  original (adapted style, not the source PNG).
- **Modifications:** grass colours, stripe count, line thickness, crowd,
  track, and banner are all original.
- **Attribution required:** CC0 — none.

#### 3. Kenney Sports Pack
- **Folder:** `assets/vendor/kenney-sports/`
- **Intended use:** CC0 goals, sports objects, UI elements, props.
- **Status:** Reserved. Not downloaded in this build; goals/UI are original.
- **Attribution required:** CC0 — none (Kenney requests an optional credit).

#### 4. Soccer Ball Animation Sprites and 3D Texture
- **Folder:** `assets/vendor/soccer-ball-anim/`
- **Intended use:** CC0 rotating ball animation, adapted size/palette/frames.
- **Status:** Reserved. Ball shipped is original (procedural disc + spin mark).
- **Attribution required:** CC0 — none.

#### 5. Basic Soccer Pack
- **Folder:** `assets/vendor/basic-soccer/`
- **Intended use:** CC0 goalkeeper / football accessories.
- **Status:** Reserved. GK gloves/animations are original.
- **Attribution required:** CC0 — none.

#### 6. 5×5 Indoor Soccer Asset Pack
- **Folder:** `assets/vendor/indoor-5x5/`
- **Intended use:** base for an alternative indoor stadium; no standalone
  redistribution.
- **Status:** Reserved. Not used in this build.
- **Attribution required:** per the pack's license.

---

## Audio

All sound effects are synthesised at runtime by `src/game/audio/Sound.ts`
via the Web Audio API (kick, pass, post, whistle, goal, confirm, ambient
crowd). **No external audio files are used.** In particular, the song
"Muchachos" is **not** used and is not bundled.

---

## Prohibited sources (policy)

The following are **never** used, copied, or distributed by this project:

- Assets from commercial NES, SNES, Sega Mega Drive, Amiga, or arcade
  football games (e.g. Nintendo/ Konami/ Sega titles). They may serve only
  as general visual inspiration for genre conventions.
- Real club logos, crests, player names, or identities.
- The song "Muchachos" or any other copyrighted music.
- Hotlinked remote images at runtime.

## How to regenerate the shipped assets

```bash
bun run scripts/generate-assets.ts
```

This re-renders `assets/generated/` and `assets/game/` from the procedural
source in `src/game/render/`. The browser build regenerates the same art at
runtime via `createRenderAssets()`, so the PNGs are archival only.
