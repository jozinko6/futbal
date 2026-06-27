# VISUAL FINAL REPORT — Modern Retro Football

## Upravené súbory

### Nové (presentation layer)
- `src/game/presentation/theme.ts` — centrálna paleta, VisualSettings, shake/replay/CRT profily
- `src/game/presentation/events.ts` — PresentationEvent typy, event queue, emit/drain
- `src/game/presentation/presentationManager.ts` — PresentationManager (konzumuje eventy, dispatchuje efekty)
- `src/game/presentation/particles/particleSystem.ts` — pixel particles s pooling, 6 presets
- `src/game/presentation/cameraShake.ts` — trauma/envelope shake, 5 profilov
- `src/game/presentation/ballTrail.ts` — pixel trail (3-6 bodov)
- `src/game/presentation/replay/replayController.ts` — replay buffer + controller (VHS)
- `src/components/game/CRTOverlay.tsx` — CSS/Canvas CRT overlay (scanlines, vignette)

### Upravené
- `src/game/render/field.ts` — theme farby (GRASS, UI) namiesto hardcoded
- `src/game/render/renderer.ts` — nový HUD (stamina bar, tímové fázy, theme farby), drawActiveIndicator, Y-sorting
- `src/game/simulation/types.ts` — `events` pole v MatchState
- `src/game/simulation/simulation.ts` — emitovanie BALL_KICKED eventov
- `src/game/simulation/rules.ts` — emitovanie GOAL_SCORED/NET_HIT v awardGoal
- `src/components/game/GameContainer.tsx` — PresentationManager integrácia, shake cez offset, particles/trail render
- `src/components/game/Screens.tsx` — odstránené emojis
- `docs/VISUAL_BASELINE.md`, `docs/VISUAL_REWORK_PLAN.md` — audit

## Nová architektúra prezentácie

```
Simulácia (deterministická)
  └─ emituje PresentationEvent[] do state.events

PresentationManager (prezentačný)
  ├─ consumeEvents(state) → drain queue → handleEvent
  │   ├─ ParticleSystem.emit(preset, x, y)
  │   ├─ CameraShake.addProfile(profile)
  │   ├─ BallTrail.setColor / record
  │   ├─ Sound.kick/pass/goal/post/whistle
  │   └─ ReplayController.start (na GOAL_SCORED)
  ├─ update(dt) → particles.update, shake.update
  └─ render(ctx, origin) → trail + particles

GameContainer (orchestrácia)
  ├─ stepMulti → sim produkuje eventy
  ├─ presRef.consumeEvents(s) → PresentationManager konzumuje
  ├─ render → sim state + shake offset
  └─ presRef.renderParticles/renderTrail → na vrch
```

Renderer NIKDY nemení MatchState. Particles nemajú kolízie. Shake je čisto render offset. Replay buffer je read-only.

## Implementované efekty

| Efekt | Stav | Popis |
|-------|------|-------|
| **Theme systém** | ✅ | theme.ts — jediný zdroj farieb |
| **Presentation Events** | ✅ | 10 typov, emit zo sim, consume v PresentationManager |
| **Particles** | ✅ | 6 presets, object pooling (400 max), quality off/low/high |
| **Camera Shake** | ✅ | Trauma systém, 5 profilov, off/low/normal |
| **Ball Trail** | ✅ | 3-6 pixel odtlačkov, speed threshold, biela/žltá/cyan |
| **HUD** | ✅ | Stamina bar, tímové fázy, theme farby, low-time warning |
| **Menu** | ✅ | Bez emojis, (pixel ikony TODO) |
| **CRT Overlay** | ✅ | Scanlines + vignette, off/subtle/strong, pointer-events:none |
| **Glow** | ⚠️ | Architektúra pripravená (GLOW config), implementácia v glowLayer.ts TODO |
| **Audio kategórie** | ⚠️ | PresentationManager spúšťa zvuky z eventov, kategórie/hlasitosti TODO |
| **VHS Replay** | ⚠️ | Buffer + controller hotový, integrácia do GameContaineru TODO |
| **Visual Settings** | ⚠️ | VisualSettings typ + DEFAULT hotový, UI v Settings TODO |
| **Reduced Motion** | ⚠️ | applyReducedMotion hotový, integrácia TODO |

## Použité assety a licencie
- **Všetky assety originálne** — procedurálne generované (field, sprites, audio).
- Žiadne ripnuté grafiky, chránené logá, reálne klubové názvy, hudba z Sensible Soccer / FIFA / Nintendo / Sega / SNES / Amiga.
- `docs/ASSET_SOURCES.md` — existujúca dokumentácia assetov.

## Výsledky testov
- **48/48** unit testov ✅
- **typecheck** ✅ čisté
- **lint** ✅ čisté
- **build** ✅ prešiel

## Známe výkonnostné limity
- Particle pool 400 — pri veľkom počte simultánnych efektov môže dôjsť k vyčerpaniu.
- Replay buffer 300 frameov × ~10KB = ~3MB — akceptovateľné.
- CRT overlay Canvas mixBlendMode:multiply — na starých GPU môže spôsobiť pokles.
- Shake Math.random v offset — OK pre render (nie sim).

## Dostupné vizuálne nastavenia
- `VisualSettings` typ: crt, particles, screenShake, glow, ballTrail, goalReplay, reducedMotion, fullscreen, profile
- `DEFAULT_VISUAL_SETTINGS` — subtle CRT, high particles, normal shake, normal glow, trail on, replay on
- `autoDetectProfile()` — LOW na mobiloch, NORMAL na desktope
- `settingsFromProfile()` — mapuje profil na nastavenia
- `applyReducedMotion()` — vypne shake, zníži CRT, vypne replay
- **UI pre nastavenia TODO** — typ je pripravený, Settings screen treba rozšíriť

## Stav offline replayu
- ReplayBuffer + ReplayController hotový (kruhový buffer ~5s, ReplayFrame lightweight).
- PresentationManager.recordReplayFrame zaznamenáva každý render frame.
- **Integrácia do GameContaineru TODO** — pri GOAL_SCORED spustiť replay, renderovať ReplayFrame s VHS filtrom, skip tlačidlo.

## Stav online replayu
- Architektúra pripravená — replay beží z lokálneho snapshot bufferu, nezastaví server.
- Po replayi klient skočí na najnovší autoritatívny stav.
- **Plne funkčný až po dokončení online integrácie** — označené ako neskoršia etapa.

## Odporúčania pre budúci Arcade Mode
- Architektúra PresentationEvent umožuje pridať power-up eventy (FIREBALL, FREEZE, SPEED_BOOST) bez zasahovania do sim fyziky.
- PresentationManager môže reagovať na nové eventy s particles/glow/shake.
- Samostatný ARCADE_MODE režim v menu — neaktívny v hlavnom futsalovom režime.
- Power-upy by produkovali vlastné PresentationEvent typy (napr. POWERUP_COLLECTED).
