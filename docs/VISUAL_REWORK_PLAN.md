# VISUAL REWORK PLAN — Modern Retro Football

## Audit súhrn
- Žiadna presentation vrstva; efekty priamo v renderer/GameContainer.
- Farby hardcoded ako magic strings.
- Procedurálne sprity iba (žiadny asset loader).
- Žiadne particles, glow, trail, CRT, replay.
- HUD základný; menu generický web vzhľad s emojis.
- Audio bez kategórií; crowd statický.
- Žiadne vizuálne nastavenia.

## Návrh novej palety (theme.ts)
- Tráva: grassDark `#1a6b2e`, grassMid `#248a3a`, grassLight `#2fa048`, grassHighlight `#3bb855`
- UI: backgroundDark `#0a0e1a`, panelDark `#0f1a2e`, cyanAccent `#22d3ee`, yellowAccent `#fde047`, magentaAccent `#e879f9`, dangerRed `#ef4444`, whiteText `#f8fafc`, mutedText `#94a3b8`
- Tímy: home `#e23b3b`, away `#2f7fd4` (zachované)
- Particle: sparkWhite `#ffffff`, sparkYellow `#fde047`, sparkCyan `#22d3ee`, grassDebris `#2fa048`

## Návrh efekt systému
1. **PresentationEvent** — čisté dáta zo simulácie (BALL_KICKED, POST_HIT, GOAL_SCORED, NET_HIT, SLIDE_STARTED, TACKLE_CONTACT, GK_SAVE, WHISTLE, ...).
2. **PresentationManager** — konzumuje eventy, spúšťa particles/shake/audio/trail/replay.
3. **ParticleSystem** — pixelové častice s pooling, presets (GRASS_KICK, SHOT_SPARK, POST_SPARK, GOAL_BURST, GK_SAVE, FOOTSTEP_DUST).
4. **CameraShake** — trauma/envelope systém, profily (LIGHT_KICK, POWER_SHOT, POST_HIT, GOAL, HARD_SAVE).
5. **BallTrail** — 3-6 historických pixel odtlačkov pri rýchlej lopte.
6. **GlowLayer** — offscreen canvas, obmedzený shadowBlur.
7. **CRTOverlay** — scanlines/vignette/noise cez CSS, pointer-events:none.
8. **ReplayBuffer** — kruhový buffer ~5s, ReplayFrame (lightweight), VHS filter.

## Zoznam upravovaných súborov
| Etapa | Súbory |
|-------|--------|
| 1 Theme | `src/game/presentation/theme.ts` (nový) |
| 2 Ihrisko | `src/game/render/field.ts` |
| 3 Assets | `src/game/assets/manifest.ts`, `loader.ts` (nový) |
| 4 AnimController | `src/game/presentation/animationController.ts` (nový) |
| 5 Y-sort | `src/game/render/renderer.ts` |
| 6 Events | `src/game/presentation/events.ts` (nový), `simulation.ts` |
| 7 Particles | `src/game/presentation/particles/*` (nový) |
| 8 Shake | `src/game/presentation/cameraShake.ts` (nový), `camera.ts` |
| 9 Trail | `src/game/presentation/ballTrail.ts` (nový) |
| 10 Glow | `src/game/presentation/glowLayer.ts` (nový) |
| 11 CRT | `src/components/game/CRTOverlay.tsx` (nový) |
| 12 Menu | `src/components/game/Screens.tsx` |
| 13 Font | `src/app/layout.tsx`, globals.css |
| 14 HUD | `src/game/render/renderer.ts` |
| 15 Feel | renderer, particles, audio |
| 16 Audio | `src/game/audio/Sound.ts` |
| 17 Replay | `src/game/presentation/replay/*` (nový) |
| 18 Settings | `src/components/game/Screens.tsx`, `GameContainer.tsx` |
| 19 Responzív | CSS, TouchControls |
| 20 Testy | `tests/presentation.test.ts` (nový) |
| 21 Docs | `docs/VISUAL_*.md` |

## Poradie implementácie
1. audit ✅ → 2. theme → 3. events → 4. ihrisko → 5. asset manifest → 6. spritesheet rendering → 7. animation controller → 8. Y-sort → 9. HUD → 10. menu → 11. particles → 12. shake → 13. trail → 14. glow → 15. CRT → 16. audio → 17. replay → 18. settings → 19. testy → 20. docs

## Riziká pre mobilný výkon
- Particles + glow + CRT môžu spôsobiť FPS pokles na slabých mobiloch.
- Riešenie: performance profily (LOW/NORMAL/HIGH), automatické zníženie.
- Replay buffer: 5s × 60fps = 300 frameov, ~10KB každý = ~3MB. Akceptovateľné.
- Offscreen canvas pre glow môže byť pomalý na starých GPU — použi menšie rozlíšenie.

## Acceptance criteria
- Jednotná Modern Retro identita (theme.ts ako jediný zdroj farieb).
- Ihrisko kvalitnejšie ale čitateľné.
- Procedurálne sprity ako fallback; renderer podporuje PNG sheets.
- Animácie synchronizované s action eventmi.
- Y-sorting hráčov.
- Bránkové siete vrstvené (back/posts/front).
- HUD čistý, kompaktný, so stamina/charge.
- Menu bez emojis, s pixel ikonami.
- Particles bez vplyvu na simuláciu.
- Camera shake čisto prezentačný.
- Ball trail pri rýchlej lopte.
- Glow decentný a výkonný.
- CRT voliteľný, nepoškodzuje čitateľnosť.
- Audio s kategóriami a hlasitosťami.
- Offline VHS replay po góle (~5s), preskakovateľný.
- Vizuálne nastavenia perzistentné.
- Reduced motion rešpektovaný.
- Mobil plynulý a použiteľný.
- typecheck/lint/test/build zelené.
