# Decisions

- 2026-10-09 · owner call (in the planning chat): scope is one lot with the open shed; no private rooms.
- 2026-10-09 · owner call (in the planning chat): fixed overhead camera inside the shed; fall back to third person if it does not hold up.
- 2026-10-09 · owner call (in the planning chat): throw moves to key 1 plus an on-screen button; the lob is simulated in scene code.
- 2026-10-09 · agent call (Claude): 3 × 4 parcels (48 × 64 m), lot origin at scene (28, 32). In the approved plan.
- 2026-10-09 · agent call (Claude): on phones the native E / F / 1 buttons act; the HUD shows what each does instead of
  adding its own action buttons (the client draws its buttons over the bottom-right corner).
- 2026-10-09 · agent call (Claude): lot dressing simplified to a few primitives per object; fence, cables and scatter left out.
- 2026-10-09 · agent call (Claude): Spanish stays the default language, with the ES/EN switch from the original.
- 2026-10-09 · owner feedback: the UI did not match Spawn's. Agent call (Claude): rebuild `src/hud.tsx` as a port of `scripts/ui.js`; plan approved by the owner. Supersedes the earlier agent call about HUD action hints.
