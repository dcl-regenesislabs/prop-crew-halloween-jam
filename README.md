# The Set (Decentraland)

Port of the Spawn world [`@sebadl/galpon-de-utileria`](https://www.spawn.co/@sebadl/galpon-de-utileria) (seq 292; the game was called Galpón de Utilería until then).
Co-op rush on a horror film lot: build the prop each movie monster asks for and hand it over at their window.

- Run: `npm run start` (or open this folder in the Creator Hub). Build and type-check: `npm run build`.
- Walk to the green door and press **E** to enter the shed; **¡ACCIÓN!** starts a 180 s shift.
- **E** does everything (take, add, put, dip, give); hold **E** at the grinder and the pump · **1** throw.
- Multiplayer runs on the authoritative server (`@dcl/sdk@auth-server`); `npm run start` also starts a local server.
- Logic tests: `npx esbuild test/logic.test.ts --bundle --platform=node --outfile=test/out.js && node test/out.js`

What changed from Spawn, what was tested and what was not: `design/2026-10-09-port-notes.md`.
Asset provenance (reuse rights unverified): `design/references.md`.
