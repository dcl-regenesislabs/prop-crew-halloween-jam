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

## Not verified

- Audio (I cannot hear it).
- Multiplayer with two clients (host hand-over, shared stations, throws seen by others).
- The desktop Unity client and a real phone; HUD positions were tuned on the Godot client's phone layout only.
- Portrait: this client is landscape-only in-world, so the tall-screen camera branch never ran.
- The "+points" pop-up and the red hint bar were not caught in a screenshot.
- Next step (suggested, not chosen): the owner plays one shift by hand; then a two-client pass.
