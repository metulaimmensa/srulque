# Srulque — notes for Claude

Owner: Sergei (Mentula Immensa, music alias Traumträumer). Not a programmer: explain in plain Russian, cynical/dry tone, no code lectures.

## What it is
Clone of Dota 2 "Pick the Lock" (Dark Carnival) mechanics with original art. Single-file game: `docs/index.html` (HTML+CSS+JS, canvas). No build step for web; `docs/index.html` is the source of truth.
Android = Capacitor 7 wrapper (`webDir: docs`), appId `com.mentulaimmensa.srulque`. Signing key lives outside the repo (owner's D:\claude\Srulque\signing). Bump `versionCode`/`versionName` in `android/app/build.gradle` on every APK.

## Measured game parameters (from frame analysis of the original) — do not change without asking
needle 128°/s, reverses on hit; miss = 0.667 s penalty at 10% speed (no reversal); sector 22.5° wide, shrinks linearly to 0 over 3.6 s;
blue chance 0.25, +1.5 s; start 30 s; spawn interval max(0.45, 1.40 − 0.026·n), first at 1.25 s; after 35 s 13% chance of a second spawn.

## Audio
Menu: pad loop `music_pad.wav` (79 BPM, 8 bars) via WebAudio; drum sequencer locked to it: kick/snare from bar 5, hats on last three 16ths of each beat from bar 9, drums through 2.6 kHz lowpass.
Game: `music_retrowave.mp3` via <audio> + MediaElementSource; tape spin-up 0.25→1 over 2.5 s on start, tape-stop on end. SFX gains are loudness-matched (see GAIN/MUSIC_BASE).

## Skins (done; planned monetization)
All setting-dependent things live in `THEMES` in `docs/index.html`; gameplay never reads a theme. Switched live via `applyTheme(id)`, picked in Settings, saved as `srq_theme`.
A theme = `vars` (CSS tokens: --c1 normal sector rgb, --c2 bonus rgb, --c3 needle/accent, --tint glass tint, fonts), `text`, `canvas` (sector/needle/rim/particle colors), `bg` (renderer `type` + params), `overlay` (`type` + params), `lock` (material class on body[data-lock]), `audio` (`dir` = `docs/themes/<id>/`, file names, gains, menu pad bpm + drum pattern).
`extends:'cyber'` inherits everything not overridden. `free:false` hides it behind `srq_owned` (purchase hook, no payments yet).
To add a skin: put sounds in `docs/themes/<id>/`, add a THEMES entry; new background/overlay/lock looks need a new renderer `type` (currently only bg `city`, overlay `drops`, lock `glass`).
`ice` is a palette-only demo; delete it when a real second skin exists.

## Roadmap
1. Deterministic core (seeded RNG + fixed timestep) before any leaderboard.
2. Global leaderboard with server-side replay validation.
3. Google Play (AAB, closed test).
