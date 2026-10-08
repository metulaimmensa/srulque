# Srulque — notes for Claude

Owner: Sergei (Mentula Immensa, music alias Traumträumer). Not a programmer: explain in plain Russian, cynical/dry tone, no code lectures.

## What it is
Clone of Dota 2 "Pick the Lock" (Dark Carnival) mechanics with original art. Single-file game: `docs/index.html` (HTML+CSS+JS, canvas). No build step for web.
Android = Capacitor 7 wrapper (`webDir: docs`), appId `com.mentulaimmensa.srulque`. Signing key lives outside the repo (owner's D:\claude\Srulque\signing). Bump `versionCode`/`versionName` in `android/app/build.gradle` on every APK.

## Measured game parameters (from frame analysis of the original) — do not change without asking
needle 128°/s, reverses on hit; miss = 0.667 s penalty at 10% speed (no reversal); sector 22.5° wide, shrinks linearly to 0 over 3.6 s;
blue chance 0.25, +1.5 s; start 30 s; spawn interval max(0.45, 1.40 − 0.026·n), first at 1.25 s; after 35 s 13% chance of a second spawn.

## Audio
Menu: pad loop `music_pad.wav` (79 BPM, 8 bars) via WebAudio; drum sequencer locked to it: kick/snare from bar 5, hats on last three 16ths of each beat from bar 9, drums through 2.6 kHz lowpass.
Game: `music_retrowave.mp3` via <audio> + MediaElementSource; tape spin-up 0.25→1 over 2.5 s on start, tape-stop on end. SFX gains are loudness-matched (see GAIN/MUSIC_BASE).

## Roadmap
1. Skins system (planned monetization): move every theme-dependent thing (palette, fonts, background renderer, screen overlay effect, lock material, needle, sounds, music, texts, icon) into theme configs; cyberpunk = first theme.
2. Deterministic core (seeded RNG + fixed timestep) before any leaderboard.
3. Global leaderboard with server-side replay validation.
4. Google Play (AAB, closed test).
