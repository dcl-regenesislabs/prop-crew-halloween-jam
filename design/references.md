# References and asset provenance

- Game design, code structure, tuning numbers, texts: the Spawn world `@sebadl/galpon-de-utileria` (seq 218), itself
  "inspired by @sebadl's Pipi's Kitchen" per its `design.md`. Decisions in that file are credited to @sebadl and @joa.
- `assets/Models/*.glb`, `assets/Textures/*.png`, `assets/Images/*`, `assets/Audio/*` except the four below:
  downloaded from Spawn's CDN (`spawnfile.io`, resolved through `play.bigspawn.net/cdn/resolve`), generated on Spawn
  for that world. **Their reuse terms outside Spawn are unverified.** No rights check has been done.
- `assets/Audio/sfx-{wrong-buzz,quick-throw-whoosh,set-down-wood,cash-register-ka-ching}.mp3`: synthesised locally
  with ffmpeg; self-made.
- The character archetypes reference well-known slasher films (ghost mask, hockey mask, leather mask, striped
  sweater and bladed glove). Whether that is acceptable for publishing has not been assessed.
- Reused code patterns: `spawn-to-dcl` skill example `fuera-de-la-realidad` (`gfx.ts`, `audio.ts`, `net.ts`).
