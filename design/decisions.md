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
- 2026-10-09 · owner request: bring the scene up to Spawn's latest version. Agent calls (Claude): doors moved to the deeper front wall; throw stays on key 1; guide arrow as a 3D billboard; top bar left of the tickets during a shift.
- 2026-10-09 · playtest feedback via the owner: no jump, big button = main action with a state icon, small drop button. Owner calls: the small button drops at your feet (replaces the throw); icons drawn by the agent.
- 2026-10-09 · owner call: use the authoritative server branch and logic. Agent calls (Claude): client reports inside/outside as a fallback because the local server saw no player positions; no client-side prediction; AUTO_SMOKE removed.
- 2026-10-09 · playtest feedback round 2 via the owner. Owner call: build multiple rooms now. Agent calls (Claude): 3 rooms of 4 stacked above the lot; camera closer than Spawn's minimum; arrows only until the first delivery of the session; feedback sounds non-positional in the shed.
- 2026-10-09 · playtest feedback round 3 via the owner. Owner calls: drop puts the prop on the faced bench; keep the simplified environment shapes. Agent calls (Claude): floor joining in either order; camera 42 degrees at 9.8 m; nametags hidden only in the rooms.
- 2026-10-09 · copy corrections via the owner (playtest feedback): lot card reads THE SET / SET DE GRABACIÓN, BETWEEN TAKES · on props now: N / ENTRE TOMAS · en utilería ahora: N; enter button TO PROPS / A UTILERÍA.
- 2026-10-09 · owner: keep the HUD inside InteractableArea, shrinking as needed; small centred pieces may use ScreenInsetArea. Agent call (Claude): which piece goes where, and the 80% scale.
