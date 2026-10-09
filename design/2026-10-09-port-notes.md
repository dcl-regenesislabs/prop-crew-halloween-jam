# Port notes — Galpón de Utilería (Spawn → Decentraland), 2026-10-09

Source: `https://www.spawn.co/@sebadl/galpon-de-utileria`, world `23bcd7c2cf6b42e5ad384d1d85186e02`, **seq 224 at first port (written here as 218 by mistake), seq 292 since the update below**
(commit `4e90c1b92e3c6b643de230f75063e5490d59b727`). The owner may keep editing; later changes are not in this port.
Export lives in `../spawn/` (world-src: 56 files; assets: 67 files, none unresolved). Written by Claude.

## Where each Spawn file went

| Scene file | From Spawn | Port |
|---|---|---|
| `src/config.ts` | `scripts/lib/data/{shop,throw,player,aesthetic}.yml`, `lib/doors.js` | numbers verbatim |
| `src/shop.ts` | `scripts/lib/shop.js` | 1:1 (station grid, recipes, item rules) |
| `src/referee.ts` | `places/main/sim.js` | 1:1 logic as a pure function over a plain state object |
| `src/game.ts` | `scripts/maker.js`, `scripts/loose.js` | hands, verbs, hold-to-work, doors, throw, the referee's seat |
| `src/shed.ts` | `gen/shed.js`, `gen/station.js`, `scripts/station.js`, `gen/locked-door.js`, `shed-seal-*` | boxes/cylinders, same sizes and colours |
| `src/props.ts` | `gen/prop.js` | each prop from a few primitives; follows parts/sharp/blood/fuel |
| `src/customers.ts` | `scripts/customer.js`, the bubble/bar children in `sim.js` | local walk to a synced destination |
| `src/lot.ts` | `gen/lot-{rv,set,prop,dress}.js`, `wander.js`, both `.scene` files | simplified dressing, same positions |
| `src/camera.ts` | `scripts/camera.js` | VirtualCamera with the same pitch, distances and follow rule |
| `src/hud.tsx` | `scripts/ui.js`, `lib/guide.js` | React-ECS port of the HTML/CSS HUD (second version; see "HUD correction") |
| `src/net.ts` | Spawn relay / `ctx.place.state` / `player.state` | synced rows + host = lowest userId |

Coordinates: game logic stays in Spawn coordinates; `gfx.ts` `sp()` / `yaw()` convert (origin at scene 28,32; Z flipped
because Spawn is right-handed).

## Not 1:1

- **One lot instead of two places.** The open shed stands on the lot; the green door (E or ENTRAR) teleports in, SALIR
  teleports out. The red door (private room `rodaje-*`) is dressing only; room routing is not ported.
- **Throw is key 1**, not Q; the lob is computed (same launch numbers and landing rules), no rigid-body tumble.
  A prop that hits an occupied or unfitting station drops in front of it.
- **Start and guide are HUD buttons** (Spawn: Enter and H).
- **Lights:** Spawn has ~35; the scene keeps 3 shed lamps, the balloon light and one film spot, the rest only glow.
- **No fog, clouds, colour grade, grass/pebble/reed scatter, perimeter fence, ground cables, particles**
  (blood splash, sparks, confetti, smoke), squash/shake effects, custom nametag, custom lighting shader.
- **Extras wander in straight lines** (Spawn uses a navmesh) and are not synced between clients.
- **Customers walk locally** toward a synced destination; a late joiner sees them start from the entry.
- **Sounds Spawn never generated** (`wrong-buzz`, `quick-throw-whoosh`, `set-down-wood`, `cash-register-ka-ching`)
  are synthesised stand-ins (`synth-sfx.sh`). Music is re-encoded mono 80 kbps.
- **Character models** were converted for Decentraland: Meshopt geometry and KTX2 textures decoded, textures
  resized to 512 px (gltf-transform + Khronos `ktx`). Their own `Idle` / `Walk` clips are used; Spawn's separate
  clip files (clap, hit-react) are not.
- **Fire** is in `shop.yml` but not in Spawn's current code either; not ported. The gas-pump overflow in
  `design.md` is likewise absent from Spawn's `maker.js` at seq 218, so it is absent here.
- Scene entities are created in code, not in `main.composite` (they come from Spawn's generators and tables).

## Tested (by Claude, 2026-10-09)

- `npm run build`: clean.
- `test/logic.test.ts` in Node: every recipe completable through existing crates and rules; patience 34 s / 39 s;
  300 simulated shifts (never more than 2 orders, score adds up, every customer leaves, ends clean).
- Headless run (`@dcl/hammurabi-server` 1.8.0, `AUTO_SMOKE` on, 40 s shift): scene loads with no exceptions,
  shift starts, three orders built through the station code and served (score 110, 1 star), shift ends. Switch is off again.

## Seen in the Godot Explorer (by Claude, 2026-10-09)

Client: `Dev/GodotExplorer/godot-explorer`, branch `fix/emote-interop-2986` @ `65bf3d13c`, debug build, desktop with
phone emulation (in-world it is always landscape, 1560x720). Launched with a `preview=` deeplink; driven through the
debug hub (GDScript `eval` for screenshots, key actions, teleports and clicks). Single client, guest account.
Screenshots: `design/shots-2026-10-09/`. This is an agent run, not a human playtest; smoke: passed.

Works as intended:
- Scene loads with no script errors; lot, shed, 23 stations, signs (readable, not mirrored), night lighting.
- Green door + E (and the ENTRAR button) teleports inside; red door stays shut; SALIR returns to the lot.
- Overhead camera frames the whole shed and follows the maker sideways; back to the client camera on the lot.
  Walking under it is camera-relative by the client's own rule (`player.gd` uses the virtual camera's yaw); I
  teleported instead of walking, so stick feel is not judged.
- ¡ACCIÓN! starts the shift; clock, tickets with step icons and patience bars; customers walk in, stand at their
  window facing in, with bubble and bar; a miss takes 10 points; the whistle ends it, results show, benches and
  floor are cleared.
- Recipes played through the real keys: flashlight (two crates), bloody machete (crate, hold F at the grinder,
  bucket, give: +27), chainsaw (crate, chain, bench put/take, hold F at the pump with its bar, give: +39),
  glove (crate, blades, grinder). Trash works. Verb hints follow what is faced and held.
- Throw (key 1): the prop lobs, rests on the floor, and E picks it up.
- Wandering extras walk forwards and animate (after the fix below).

Fixed during this pass:
- Characters walked backwards (reported by the owner while it ran): `MODEL_YAW_FIX` 0 → 180 in `src/lot.ts`.
- HUD: a phone gets a 1600x720 canvas with the joystick bottom-left, action buttons bottom-right and the profile
  button top-left; the first layout covered the shed and sat under the buttons. Rebuilt as a top band plus a
  bottom-centre strip (`src/hud.tsx`).
- The doors and name board in the front wall hid the front row of stations from the overhead camera; they now
  drop out of sight while inside (`showFront` in `src/shed.ts`).
- Shed lamps brightened (9000 → 30000); the balloon light's tether removed (it cut the spawn view in two).

Open observations:
- The client logs `Bones array must be a PackedInt32Array` when loading the character models (7–14 times per
  run). They still render and animate. Likely from the dequantize step of my conversion; not investigated.
- The explorer's own "Graphics reduced" notice covers the clock for a few seconds when it appears.
- A thrown prop only travels about 1.5 m (Spawn's numbers), so reaching a bench by throwing needs to be close.

## HUD correction (2026-10-09, later the same day)

The owner pointed out that the UI did not look like Spawn's. Cause: the first `src/hud.tsx` was **not** a port.
I (Claude) had not read `scripts/ui.js` and wrote the HUD from the design summary; its header claimed otherwise.
It was rewritten from `ui.js`, and checked in the Godot Explorer (screenshots `design/shots-2026-10-09/hud-*.jpg`):

- Spawn's palette, bordered rounded panels, and layout: lot card with both doors and "adentro n/4", ENTRAR only
  at a door in that door's colour, walk-in curtain, ES/EN toggle; in the shed the `● REC` clock and `$` score
  pills, round `?`, the way out, `público`; paper tickets top-right (dish icon, name, steps with `›`, bar), most
  urgent first; hands block (red hint, amber key prompt in full words, station tip card with icon, held pill with
  icon and full item name); big ¡ACCIÓN! bottom-centre between takes; ¡CORTEN! card with stars for 12 s.
- The guide opens by itself on the first visit, with the six in-game station photos, the worked example and
  its captions. All 31 UI images exported from Spawn are now used where Spawn uses them.
- Lot signs carry Spawn's texts (SILENCIO, SE GRABA ×3, DIRECTOR, PROTAGONISTA, MAQUILLAJE Y FX) and switch
  language with the HUD; my invented sign texts are gone.
- The phone's joystick and buttons are hidden while the guide is open (its close button sat under them).

Still different from Spawn, on purpose or by limit:
- Typeface (Spawn: Geist Pixel Square; scene UI has its own font).
- Emoji are not drawn: the clapperboard on buttons is dropped, the door button reads SET / LOT, the trash tip
  uses the guide's trash picture.
- The key prompt stays visible on phones (Spawn hides it there because its own buttons carry the word).
- The private-door column says it is not available; "Q lanzar" reads "1 lanzar".
- Signs are 3D text on boards, not HUD overlays, and the three small tags are approximate in placement.
- Sizes are Spawn's phone-landscape CSS scaled by eye to the 1600x720 canvas; not compared against a live Spawn
  screenshot.

Observation: twice, the first simulated E press after launching the client did nothing at the green door and
the second worked. Not reproduced by hand; cause unknown (the ENTRAR button is the other way in).

## Update to Spawn seq 292 (2026-10-09, by Claude)

Correction: the export this port was first made from was **seq 224**, not 218 (the head moved between my lookup and
my download; `spawn/head.json` had it right). That export is kept as `spawn/world-src-seq224`; `spawn/world-src`
is now seq 292 (commit `91ebd95…`), so the next diff starts there. 16 of 56 Spawn files had changed.

Applied:
- Renamed **The Set** (`scene.json`, README). The HUD title stays GALPÓN DE UTILERÍA / THE PROP SHED, as in Spawn.
- **One key:** E pressed does everything, E **held** sharpens and fuels. F is unused. Throw stays on key 1.
- **No jumping** (`InputModifier` `disableJump`).
- **Shed one tile deeper** (walls z ±4.05, rows z ±3.4), seals, locked door, customer spots moved with it.
  The doors of the merged lot stand on the new front wall (Spawn's lobby keeps its old closed shed).
- **New station layout**, 24 stations with the new bench `ctr-9`; every base far from its parts.
- **Fixed camera** (no follow), distance fitted to the shed's width. Hanging lamp shades removed, lights kept.
- **Orders:** no fixed teaching customers; never the same prop twice running.
- **First-order guide:** an amber label and bouncing arrow over the station needed next, until the shift's first
  delivery (`nextStep` in `src/shop.ts`, drawn in `src/shed.ts`).
- **Feedback:** crates bounce and pop "+Name" on a good grab; grinder and pump bob and play a motor loop while
  their bar fills.
- **Sounds:** Spawn's new buzz, plunk and two motor loops. `sfx-item-pickup-pop` was never generated on Spawn
  (it plays silence there); here it is a synthesised stand-in.
- **HUD:** ES/EN toggle in the shed's top bar; "mantené E…" prompts and tips; Spawn's own English wording for
  prompts, tips and hints; hints are bilingual.

Checked: build clean; logic test (24 stations, order rule, the guide walks every recipe to the window, 300 shifts);
headless self-played shift (3 served, switch off again); Godot Explorer pass with screenshots `v292-*.jpg`:
deeper shed framed whole, layout, crate grab, hold-E at grinder and pump with bars, guide arrow through a knife
order and gone after the first delivery, toggle in the bar, jump key does nothing.

Differences and loose ends:
- The guide label is 3D text on a billboard, not a HUD overlay; near the screen edges it looks tilted.
- During a shift the top bar sits left of the tickets instead of centred, so two tickets never cover it; in the
  preview client its left end is under the debug buttons (those are not in the published client).
- Crate dust and flash particles are not ported (as before).
- Not seen: the "+Name" pop in a screenshot; English in the shed; the bob of a working machine as motion.

## Phone controls after playtest feedback (2026-10-09, by Claude)

Feedback from a playtester, passed on by the owner: no jump, the big button is the main action, a small button to
drop items, and the main button's picture follows what you face (hold at the grinder and pump, a hand elsewhere).

- `src/touch.ts`: the big central button is E (the main action); jump, pointer, F and 2/3/4 are hidden; the small
  "1" button is **drop** and shows only while you hold something; the crosshair is hidden in the shed. The big
  button wears a hold icon when the faced grinder or pump can work the held prop, a hand otherwise. The guide still
  hides every control while open.
- **Drop replaces throw** (owner call): key 1 leaves the prop on the floor just in front of your feet; the main
  action picks it up. The lob and its landing rules are removed. This differs from Spawn, which still throws.
- Icons `btn-hand.png`, `btn-hold.png`, `btn-drop.png` are drawn here (self-made).

Seen in the Godot Explorer's phone emulation (`touch-*.jpg`): lot with one big hand button and no jump; in the
shed the hold icon at the grinder with a knife, the small drop button while holding, the knife dropped at the
feet and picked up again. Not checked on a real phone: the button order follows the documented stack, which the
SDK skill itself marks as not confirmed against the shipping client.

## Authoritative server (2026-10-09, by Claude, at the owner's request)

The scene now runs on the Multiplayer Server (`@dcl/sdk@auth-server`, `authoritativeMultiplayer: true`). The
peer-to-peer design (one client elected as referee, everyone writing shared state) is gone.

- `src/server/server.ts`: the only writer of shared state. It runs the referee (`referee.ts`, unchanged), every
  station rule (take, add, set down, combine, dip, serve), the hold-to-sharpen / hold-to-fuel progress, the floor
  and each maker's hands, and it empties everything when a shift ends. Clients cannot write these components
  (`validateBeforeChange`, server only).
- `src/shared/`: the synced components (`Shift`, `StationState`, `Floor`, `Hand`) and the messages. A client only
  says what it tries: `use`, `work`, `pick`, `drop`, `start`, `where`. The server answers through the components
  and with `snd`, `pop`, `crate`, `hint`.
- `src/net.ts`, `src/game.ts`: the client reads state and sends intentions; it keeps targeting, prompts, HUD,
  camera, visuals and the phone buttons. `MessageBus` and the host election are removed.
- The server's clock, rewritten every second, is the shared clock and its heartbeat. If a client stops seeing it
  tick, the HUD says "Despertando el set…" (a published server takes about 15 s to wake when the set was empty).
- The headless self-play switch (`AUTO_SMOKE`) is removed; it drove client-side rules that no longer exist.

Seen in the local preview (local server + Godot Explorer, one client, `server-*.jpg`): server boots, the maker
joins, ¡ACCIÓN! starts a shift on the server, crate grab, hold at the grinder, dip, drop and pick-up, and a glove
built and handed over with the score going up. Build clean; logic test passes.

Known limits and things found:
- **The server did not see player positions** in the local preview with the Godot client (no `Transform` on the
  player entity). So "inside the shed" falls back to what the client reports (`where`), and the distance check on
  station use only applies when a position is available. Whether the published server sees positions is unknown.
- Every action now waits for the server's answer before the hands change; on a slow connection that will be
  felt. No client-side prediction.
- A player who just left can linger in the server's list for a while (seen locally: a previous session's
  address "joined" a fresh server), which can inflate "adentro n/4".
- Local preview: editing a file makes the local server exit ("already served by another local server") and a
  killed preview leaves a stale lock in `~/Library/Application Support/org.decentraland.BevyExplorer/scene-locks/`;
  restart `npm run start`, removing that lock if the server refuses to start.
- Still not tested with two clients, nor against the published server.

## Playtest feedback, round 2: rooms, camera, HUD, sound (2026-10-09, by Claude)

- **Rooms.** The server runs 3 independent sheds of 4 makers (`src/shared/rooms.ts`), stacked above the lot at
  y 20 / 38 / 56. The green door asks for a place; the server gives the fullest room with space (Spawn's routing
  rule), or says "rodaje completo". SALIR, leaving or disconnecting frees it. An empty room's shift is reset.
  Each client builds one interior only, on first entry, and moves it to its room's height.
- **Lot.** A closed shed (high textured walls, roof, one green door, name board). No interior on the lot. No
  public/private anywhere.
- **Camera.** Closer: floor distance 10.6 m instead of Spawn's 13.5 m minimum (owner feedback beats the port here).
- **HUD.** Tickets are icon + (name / steps / patience), stacked at the right. Top bar: clock, score, ?, music
  on/off, SALIR / EXIT. Language toggle only on the lot and in the guide. Lot card reduced to title and "en rodaje: n".
- **Guide arrows** only until the first delivery you see, then never again in the session; for side-wall crates
  they sit toward the middle of the shed so the wall cannot hide them.
- **Sound.** Inside the shed every feedback sound is non-positional (they were placed at the bench, ~10 m from the
  overhead camera, and faded; the buzz was at the player and did not). Music 0.5 → 0.3. The delivery chime is
  re-synthesised as two notes (it was a weak single beep; still a stand-in, Spawn never generated one).
- **Looks.** Tin walls and the floor are textured; the blood footprints lead from the bucket's current spot.

Seen in the local preview (one client, `r2-*.jpg`): closed shed and lighter card on the lot; E at the door →
server log "enters room 0", avatar at y 20, interior there; the closer framing; stacked tickets; music and SALIR
buttons; the arrow in front of the right wall; no arrows after the first delivery ($27); SALIR → back on the lot
and "leaves room 0" in the server log. Room filling order is covered by the logic test (`pickRoom`).

Not verified: anything with two or more clients (rooms filling with real players, makers of different rooms not
seeing each other), audio, the music button's effect, the published server.

Local preview note: after stopping `npm run start`, wait about 15 s before starting it again, or the new local
server finds the old one's lock and exits.

## Playtest feedback, round 3: benches, joining, camera, nametags (2026-10-09, by Claude)

Reports: props dropped at a lit bench fell to the floor; base and part would not join in some orders; no joining
with things on the floor; camera too top-down and far; remove nametags.

Reproduced first: the **main button** at a bench did set down and join correctly. So the reports are explained
by the **drop** button, which always used the floor: bases ended up on the floor, where nothing could be joined.
That is my reading of the reports, not something the tester confirmed.

- **Drop means "leave it here"** (owner call): on the bench you face, joined with what is there if it fits, in
  the trash if you face it, otherwise on the floor.
- **Floor joining:** the main button on a floor prop takes it with empty hands, or joins it with what you hold
  (base + part in either order); otherwise the "no encajan" hint. Prompt: "E unir".
- One rule, `join(a, b)` in `src/shop.ts`, behind bench, floor and drop; tested in every order for all recipes.
- **Camera:** 42° instead of 56°, distance 9.8, aimed a little in front of the middle so the front row clears
  the bottom HUD; ¡ACCIÓN! button made smaller for the same reason.
- **Nametags** hidden in the rooms (`AvatarModifierArea`, `AMT_HIDE_NAMETAGS`); they stay on the lot.
- Owner question answered: the environment's shapes are **not** Spawn's (only the six characters are); owner
  chose to keep the simplified shapes rather than bake Spawn's generated geometry.

Seen in the local preview (one client, `r3-*.jpg`): walkie dropped facing a bench lands on it; antenna dropped
onto it joins; taking it back; drop in the open goes to the floor; with batteries in hand the floor prop offers
"E unir" and joins; drop at the trash bins it; the new framing during a shift; no nametag over my own avatar.
Not seen: another player's nametag hidden (single client); a phone.

Local preview note, corrected: after stopping `npm run start`, wait about a minute before starting again; the
local server (`bevy-headless-server`) refuses to start sooner ("already served by another local server").

## HUD placement: InteractableArea and ScreenInsetArea (2026-10-09, owner request, built by Claude)

- The guide, the tickets and the language switch sit in the client's `InteractableArea`; the small centred pieces
  (lot card, enter button, top bar, prompt and held pill, ¡ACCIÓN!, ¡CORTEN! card, "Preparando el set…") sit in the
  `ScreenInsetArea`, because they looked off-centre in the other (owner's observation). Dimmers cover the full screen.
- Measured in the Godot client's phone layout: interactable area about 1050 x 640 of a 1600 x 720 canvas (left 438,
  right 110, top 32, bottom 46). The guide did not fit, so the whole HUD draws at 80% (virtual screen 2000 x 900).
- Seen in the local preview (`r3-170`, `r3-171`, `r3-173`): lot, guide, idle shed, a shift with a ticket and a held
  prop. Not seen: a real phone, where the areas may measure differently.

## Not verified

- Audio (I cannot hear it).
- Multiplayer with two clients (host hand-over, shared stations, throws seen by others).
- The desktop Unity client and a real phone; HUD positions were tuned on the Godot client's phone layout only.
- Portrait: this client is landscape-only in-world, so the tall-screen camera branch never ran.
- The "+points" pop-up and the red hint bar were not caught in a screenshot.
- Next step (suggested, not chosen): the owner plays one shift by hand; then a two-client pass.
