# Galpón de Utilería (Decentraland)

Port of the Spawn world [`@sebadl/galpon-de-utileria`](https://www.spawn.co/@sebadl/galpon-de-utileria) (seq 218).
Co-op rush on a horror film lot: build the prop each movie monster asks for and hand it over at their window.

- Run: `npm run start` (or open this folder in the Creator Hub). Build and type-check: `npm run build`.
- Walk to the green door and press **E** to enter the shed; **¡ACCIÓN!** starts a 180 s shift.
- **E** use (take, add, put, dip, give) · hold **F** sharpen / fuel · **1** throw.
- Logic tests: `npx esbuild test/logic.test.ts --bundle --platform=node --outfile=test/out.js && node test/out.js`

What changed from Spawn, what was tested and what was not: `design/2026-10-09-port-notes.md`.
Asset provenance (reuse rights unverified): `design/references.md`.
