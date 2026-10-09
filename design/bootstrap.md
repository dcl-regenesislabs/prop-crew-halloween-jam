# Bootstrap — 2026-10-09 (agent working note)

- Project: `/Users/eibriel/Dev/GameJamHalloween/galpon-de-utileria`, `@dcl/sdk` 7.30.1, Node 24.13. Build: `npm run build`.
- Skills: `sdk-scenes` and topic skills installed at user level today (`npx skills add decentraland/sdk-skills --all -g`);
  read for this build: sdk-scenes, camera-control, parts of advanced-input, player-avatar, build-ui.
  `spawn-to-dcl` is a project skill in `../.claude/skills/`; `dcl-gdd` / `dcl-prototype` at user level.
- Route: Claude Code CLI, no Creator Hub MCP and no Explorer MCP connected in this session. Not called, not tested.
- Checked: build passes; headless load and self-played shift pass (see port notes).
- Working in-world route (used 2026-10-09): serve with `npx sdk-commands start --no-client --no-browser -p 8000`; in
  `Dev/GodotExplorer/godot-explorer` run `cargo run -- run -- "--fake-deeplink=decentraland://open?preview=http://127.0.0.1:8000&position=1,1&skip-hw-benchmark=true" --dev --landscape --rust-log="dclgodot::dcl::js=debug,warn"`;
  drive it through the debug hub (ports 9230/9231, `cargo run -- debug-hub` if none is up) with that repo's
  `.claude/skills/mobile-dev-debug-tool/scripts/unified.sh`. Each scene save reloads the scene and resets the shift.
  Check for a running Godot with `ps` before launching: `pkill -f godot4_bin` does not match it.
- Not connected: Creator Hub MCP, Unity Explorer MCP.
