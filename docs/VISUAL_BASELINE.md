# VISUAL BASELINE — stav pred vizuálnym reworkom

Dátum: 2025-06-27
Repozitár: https://github.com/jozinko6/futbal
Commit: 601e4f3 (main)

## Kontroly pred zmenami

- **typecheck**: ✅ čisté
- **lint**: ✅ čisté
- **unit testy**: ✅ 48/48 (3 test suites)
- **build**: ✅ prešiel

## Aktuálny vizuálny audit

### src/game/render/ (4 súbory, 1046 riadkov)
- **field.ts** (265): Procedurálne ihrisko s tribúnami, publikom, bannerom. Farby hardcoded (`GRASS_LIGHT = '#3aa84a'` atď.). Bránky majú sieť ale bez vrstvenia (back/posts/front). Žiadne animované prvky publika.
- **renderer.ts** (362): Canvas renderer. Y-sorting hráčov implementovaný. Debug overlay. HUD je základný (skóre, čas, banner — text na canvas). Žiadne particles, glow, trail. Camera shake cez Math.random v cameraOrigin.
- **spriteSheet.ts** (352): Procedurálne generované 32×40 sprity, 8 smerov, 16 animácií. Jediný zdroj postáv (žiadny asset loader pre PNG).
- **camera.ts** (67): Look-ahead + shake. Shake je Math.random-based (nedereterministický, ale OK pre render).

### src/game/presentation/ — NEEXISTUJE
Žiadna presentation vrstva. Vizuálne efekty sú priamo v rendereri/GameContaineri.

### src/game/audio/ (1 súbor, 204 riadkov)
- **Sound.ts**: Web Audio, syntetizované zvuky (kick, pass, post, whistle, goal, confirm, crowd). Žiadne kategórie/hlasitosti. Žiadne menu UI zvuky. Crowd je statická slučka bez reakcií.

### src/components/game/ (5 súborov)
- **Screens.tsx**: Menu, TeamSelect, HowTo, Settings, Pause, Results, Lobby. Generický Tailwind vzhľad. Emojis v tlačidlách (▶, 👥, 🌐). Žiadne pixel-art ikony. Žiadne snappy animácie.
- **GameContainer.tsx**: Herný loop. Zvukové efekty detekované porovnávaním skóre/owner changes (nie event systém).
- **TouchControls.tsx**: Virtuálny joystick + tlačidlá.
- **OnlineLobby/OnlineMatch.tsx**: Online UI.

### CSS / Tailwind
- globals.css: Next.js štartér CSS premenné (sidebar, chart, ...). Žiadne retro/pixel-art štýly.
- tailwind.config.ts: Default štartér config. Žiadne custom farby pre hru.

### public/
- logo.svg, robots.txt. Žiadne herné assety.

### Simulačné udalosti
- Simulácia NEprodukuje PresentationEvent udalosti. Vizuálne/zvukové efekty sú odhadované v GameContainer.handleSoundEvents porovnávaním prevScore/prevOwner/prevPeriod.

## Problémy s čitateľnosťou
1. HUD je malý text na canvas — ťažko čitateľný na mobilných displejoch.
2. Žiadne stamina/charge indikátory v HUD.
3. Bannery (GÓL, AUT, ...) sú jednoduchý text bez animácie.
4. Aktívny hráč indikátor (chevron) môže prekrývať loptu.

## Problémy s animáciami
1. Animácia je priamo naviazaná na sim state (stateToAnim) — žiadny samostatný animation controller.
2. Žiadne prechody medzi animáciami (idle→run, run→shot, ...).
3. Kontaktný frame animácie nie synchronizovaný s action systémom (hoci lastContactTick existuje v sim, renderer ho nepoužíva).
4. Žiadne odlišné smerové varianty (len nos detail).

## Problémy s HUD
1. Žiadny stamina bar.
2. Žiadny shot charge bar v HUD (len nad hráčom).
3. Žiadne team skratky.
4. Žiadne online ping/reconnect stav.

## Problémy s menu
1. Generický webový vzhľad (zaoblené rohy, blur).
2. Emojis v tlačidlach.
3. Žiadne pixel-art ikony.
4. Žiadne snappy animácie.
5. Žiadne keyboard/gamepad focus indikátory.

## Zhrnutie
Vizuálna vrstva je funkčná ale základná. Chýba: presentation event systém, particle systém, ball trail, glow, CRT, animačný kontrolér, asset loader, replay, audio kategórie, vizuálne nastavenia. Farby sú roztrúsené ako magic strings.
