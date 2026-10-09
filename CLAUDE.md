# Srulque — notes for Claude

Owner: Sergei (Mentula Immensa, music alias Traumträumer). Not a programmer: explain in plain Russian, cynical/dry tone, no code lectures.

## What it is
Clone of Dota 2 "Pick the Lock" (Dark Carnival) mechanics with original art. Single-file game: `docs/index.html` (HTML+CSS+JS, canvas). No build step for web; `docs/index.html` is the source of truth.
Android = Capacitor 7 wrapper (`webDir: docs`), appId `com.mentulaimmensa.srulque`. Signing key lives outside the repo (owner's D:\claude\Srulque\signing). Bump `versionCode`/`versionName` in `android/app/build.gradle` on every APK.

## Measured game parameters (from frame analysis of the original) — do not change without asking
needle 128°/s, reverses on hit; miss = 0.667 s penalty at 10% speed (no reversal); sector 22.5° wide, shrinks linearly to 0 over 3.6 s;
blue chance 0.25, +1.5 s; start 30 s; spawn interval max(0.45, 1.40 − 0.026·n), first at 1.25 s; after 35 s 13% chance of a second spawn; hit tolerance 1.5° (owner's choice after beta feedback; was 2°, measured ~1°).
No gameplay settings for players: P = DEFAULTS, frozen.

## Audio
Per theme (`audio` in THEMES). Cyber: menu = pad loop `music_pad.wav` (79 BPM) + drum sequencer (kick/snare from bar 5, hats from bar 9, 2.6 kHz lowpass); game = `music_retrowave.mp3` (owner's own edit, 98.8 s) via <audio> + MediaElementSource, `gameMode:'tape'`: spin-up 0.25→1 over 2.5 s, tape-stop on end.
Steam: `menu.mode:'loop'` (`music_menu.mp3`, 120 BPM, loop 48.000 s) and `gameMode:'loop'` (`music_game.mp3`, 142 BPM, loop 94.648 s, owner's version without lead): seamless WebAudio buffer loops, mp3 lead-in detected at runtime, NO speed changes. `start_crash.mp3` on start, `lose_fx44.mp3` on end, synthesized `tick.wav` with pitch rise (`tickRise`).
End timings per theme in `audio.end`. Each menu track has its own fader; on theme switch the new one starts only after the old faded out (`A.menuFreeAt`). SFX gains are loudness-matched (GAIN/MUSIC_BASE).

## Skins (done; planned monetization)
All setting-dependent things live in `THEMES` in `docs/index.html`; gameplay never reads a theme. Switched live via `applyTheme(id)`, picked in «Внешний вид» (main menu + settings), saved as `srq_theme`; last palette per world in `srq_palette`.
Worlds (`world` field, names in `WORLDS`): cyber = `cyber` (Неон) + `ice` (Лёд); steam = `steam` (Латунь) + `steam2` (Кузня).
A theme = `vars` (CSS tokens), `text`, `canvas` (sector/needle/rim colors, `style`, `glowK`), `bg` (renderer `type` + params), `overlay` (`type` + params), `lock` (body[data-lock]), `audio`.
`extends` inherits everything not overridden. `free:false` hides it behind `srq_owned` (purchase hook, no payments yet).
Renderers: bg `city` (neon city + rain) / `works` (machine-room wall: plates, pipes with elbows, valves, turning gears, Edison tube bulbs, light-map multiply, dust motes; gauges are sprites `docs/themes/steam/img/gauge*.png` with live needles); overlay `drops` / `steam` (steam puffs + sparks from VENTS, kept clear of the lock); lock `glass` / `brass` (worn ring, square-tooth gear, sooty dial, dirty sector plates, clock hand, falling sparks on hit).
Weathering = runtime value-noise textures (`buildTextures`, `weather`, CSS `--grime`).
Menu art: `bg.menuArt` image (steam: `img/menu.jpg`, owner's AI render with baked UI removed) shown behind menu panels (body.scene, lock hidden); `menuFilter` tints it per palette.

## Core & leaderboard
Rules live in `docs/core.js` (UMD, used by the game and the server): mulberry32 seeded RNG, 120 Hz fixed tick, clicks applied at tick start, `replay(seed, clicks)` recomputes score. Never use Math.random/time/trig inside core. Visual effects stay in index.html.
Server: `server/index.js` = Yandex Cloud Function, storage = Object Storage bucket mounted at `/function/storage/data` (one JSON per ticket/device, no rename). Flow: `ticket` (server seed, prefetched) → play → `submit` clicks → server replays, checks ticket single-use, device match, TTL 6 h, wall-clock ≥ game time − 3 s, nick filter. `top` = best per device.
Rules versions: `Core.VERSION` (now 2). Bump it on any rule change: client sends `v` with submit, server answers 426 to other versions and keeps one table per version (`scores` for v1, `scores-v<N>` after), so a rule change = clean season, old results stay on disk.
Moderation: env `MODERATION` (default `post`: nick shown at once after filter; `pre`: shown only after owner approval, else "Игрок XXXX"). Owner chose post-moderation. Blacklist in server (profanity, nazism, drugs, politics, sexual) + owner's words in bucket `config/words.json`. Admin: `docs/admin.html` → `?action=admin` with env `ADMIN_KEY` (owner keeps it in D:\claude\Srulque\signing\admin-key.txt, never in repo): list/approve/rename/hide/delete/ban/unban/words.
Client: `LB_URL` const in index.html (empty = leaderboard hidden). Tuned params (≠ DEFAULTS) are never submitted. Failed submits retry on next launch (`srq_pending`).
Deploy: `server/build.sh` → `srulque-server.zip`; owner uploads it in the Yandex console (see `server/DEPLOY.md`).

## Roguelite mode (planned)
Design agreed with the owner in `DESIGN.md` (lore, time-as-health, 5 systems, run structure, build order). Read it before touching the roguelite. Arcade + leaderboard stay untouched.

## Roadmap
1. Google Play (AAB, closed test).
