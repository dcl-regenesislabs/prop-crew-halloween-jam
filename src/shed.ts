// The prop shed and its stations.
// Ported from scripts/gen/shed.js (shell), scripts/gen/station.js + scripts/station.js (the 23 stations and
// what they show), scripts/gen/locked-door.js and the shed-seal-* colliders of places/main/cells/x0z0.scene.
// Spawn draws these as scripted meshes; here they are boxes and cylinders in the same places and colours.
import {
  Billboard,
  BillboardMode,
  ColliderLayer,
  engine,
  Entity,
  LightSource,
  Material,
  MeshCollider,
  MeshRenderer,
  TextAlignMode,
  TextShape,
  Transform
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { DOORS, TEX } from './config'
import { anchor, c3, c4, lball, lbox, lcyl, lcylX, Mat, sp, yaw } from './gfx'
import { stationItem, stationProg } from './net'
import { PropSlot, setVisible, slotAt } from './props'
import { GIVES, Item, Station, STATIONS } from './shop'

const WOOD = 'oklch(0.5 0.07 60)'
const WOOD2 = 'oklch(0.42 0.06 55)'
const DARK = 'oklch(0.25 0.02 50)'
const STEEL = 'oklch(0.6 0.01 250)'
const W = 0.59
const D = 0.4
const X0 = -6.25
const X1 = 6.25
const Z0 = -2.85
const Z1 = 2.85
const H = 3.0

// text that reads from the Spawn direction `facing` (a Spawn yaw): TextShape shows its face toward local -Z
// Spawn draws its signs in the HUD, anchored to the boards, so each player reads them in their own language;
// here they are 3D text that switches with the HUD's ES/EN (ui.js SIGNS).
const signs: { e: Entity; es: string; en: string }[] = []
export function label(text: string, x: number, y: number, z: number, facing: number, size: number, color: string, parent?: Entity, en?: string) {
  const e = anchor(x, y, z, facing + 180, { parent })
  TextShape.create(e, { text, fontSize: size, textColor: c4(color), textAlign: TextAlignMode.TAM_MIDDLE_CENTER })
  if (en) signs.push({ e, es: text, en })
  return e
}
export function setSignsLang(lang: 'es' | 'en') {
  for (const s of signs) TextShape.getMutable(s.e).text = lang === 'en' ? s.en : s.es
}

// The doors and the name board stand in the front wall, between the overhead camera and the front row of
// stations. Seen in the Godot Explorer they covered the grinder and the benches, so they drop out of sight
// while the maker is inside (Spawn never shows both: its doors belong to the lobby's closed shed).
let front: Entity
let frontShown = true
export function showFront(on: boolean) {
  if (on === frontShown) return
  frontShown = on
  Transform.getMutable(front).position = on ? sp(0, 0, 0) : sp(0, -40, 0)
}

// --- the shell ------------------------------------------------------------------------------------------
export function buildShed() {
  const root = anchor(0, 0, 0)
  const o = { parent: root }
  const oc = { parent: root, collide: true }
  front = anchor(0, 0, 0)
  const of = { parent: front }
  // floor: concrete
  lbox(X0, -0.06, Z0, X1, 0.02, Z1, { color: 'oklch(0.54 0.01 70)', rough: 0.95 }, o)
  for (let i = 1; i < 5; i++) lbox(X0 + i * 2.5 - 0.01, 0.02, Z0, X0 + i * 2.5 + 0.01, 0.022, Z1, { color: 'oklch(0.4 0.01 70)' }, o) // seams
  for (let i = 0; i < 9; i++) lbox(0.33 + i * 0.5, 0.022, 0.86 - i * 0.12 + (i % 2) * 0.2, 0.47 + i * 0.5, 0.026, 0.94 - i * 0.12 + (i % 2) * 0.2, { color: 'oklch(0.38 0.16 25)' }, o) // fake-blood footprints
  // walls: corrugated tin, sides full height
  const tin: Mat = { color: 'oklch(0.42 0.03 240)', rough: 0.55, metal: 0.35 }
  lbox(X0 - 0.05, 0, Z0, X0, H, Z1, tin, oc)
  lbox(X1, 0, Z0, X1 + 0.05, H, Z1, tin, oc)
  // back: knee wall under the two service windows, tin either side of them; the customers stand outside it
  lbox(-1.25, 0, Z0 - 0.1, 1.25, 0.84, Z0 + 0.02, { color: 'oklch(0.35 0.05 50)', rough: 0.85 }, oc)
  for (const x of [-1.32, -0.07, 1.18]) lbox(x, 0, Z0 - 0.12, x + 0.14, 1.1, Z0 + 0.05, { color: 'oklch(0.32 0.04 50)' }, o)
  const tin2: Mat = { color: 'oklch(0.45 0.03 240)', rough: 0.55, metal: 0.35 }
  lbox(X0, 0, Z0 - 0.05, -1.3, 1.7, Z0, tin2, oc)
  lbox(1.3, 0, Z0 - 0.05, X1, 1.7, Z0, tin2, oc)
  // front: knee wall, posts
  lbox(X0, 0, Z1 - 0.02, X1, 0.84, Z1 + 0.1, { color: 'oklch(0.35 0.05 50)', rough: 0.85 }, oc)
  for (const x of [X0, -2.4, 2.4, 4.8, X1 - 0.14]) lbox(x, 0, Z1 - 0.05, x + 0.14, 1.3, Z1 + 0.12, { color: 'oklch(0.32 0.04 50)' }, o)
  // pegboards on the back wall with tool silhouettes
  for (const x0 of [-5.9, 3.3]) {
    lbox(x0, 0.95, Z0 + 0.05, x0 + 2.4, 1.65, Z0 + 0.08, { color: 'oklch(0.6 0.07 65)' }, o)
    for (let i = 0; i < 6; i++) lbox(x0 + 0.28 + i * 0.38, 1.12, Z0 + 0.08, x0 + 0.33 + i * 0.38, 1.45, Z0 + 0.11, { color: 'oklch(0.25 0.02 60)' }, o)
  }
  // work lamps hanging on their cords (no roof: the camera looks in)
  for (const [x, z] of [[-3, -0.6], [3, -0.6], [0, 0.9]]) {
    lbox(x - 0.01, 2.2, z - 0.01, x + 0.01, H, z + 0.01, { color: 'oklch(0.12 0.01 60)' }, o)
    lcyl(x, 2.05, z, 0.22, 0.15, { color: 'oklch(0.3 0.08 150)' }, { parent: root, top: 0.12 })
    lball(x, 2.03, z, 0.07, 0.07, 0.07, { color: 'oklch(0.95 0.08 85)', emissive: 'oklch(0.9 0.08 80)', glow: 4 }, o)
  }
  // Spawn lights nine lamps in here (lamp-1..9); Decentraland renders a handful, so the three big ones stay
  for (const [x, z, shadow] of [[-3, -0.6, 0], [3, -0.6, 0], [0, 0.9, 1]]) {
    const l = engine.addEntity()
    Transform.create(l, { position: sp(x, 1.95, z) })
    LightSource.create(l, { type: LightSource.Type.Point({}), color: c3('oklch(0.9 0.08 80)'), intensity: 30000, range: 12, shadow: !!shadow, active: true })
  }
  // the lot side: the two doors of the lobby's closed shed (door-public, door-private) standing in the front wall
  for (const d of DOORS) {
    const green = d.to === 'public'
    const a = anchor(d.x, 0, d.z, 180, { parent: front })
    const od = { parent: a }
    lbox(-0.55, 0, -0.06, 0.55, 2.1, 0.0, { color: green ? 'oklch(0.36 0.09 150)' : 'oklch(0.36 0.12 25)', rough: 0.8 }, od)
    lbox(-0.65, 0, -0.08, -0.55, 2.25, 0.02, { color: DARK }, od)
    lbox(0.55, 0, -0.08, 0.65, 2.25, 0.02, { color: DARK }, od)
    lbox(-0.65, 2.1, -0.08, 0.65, 2.25, 0.02, { color: DARK }, od)
    lbox(-0.75, 2.34, -0.1, 0.75, 2.66, -0.07, { color: 'oklch(0.18 0.02 50)' }, od) // the sign board
    lball(0, 2.8, -0.3, 0.07, 0.07, 0.07, { color: 'oklch(0.95 0.1 75)', emissive: 'oklch(0.85 0.11 70)', glow: 4 }, od)
    // the glowing disc on the ground in front
    lcyl(0, 0.03, -1.2, 1, 0.02, { color: green ? 'oklch(0.9 0.08 150 / 0.35)' : 'oklch(0.9 0.06 25 / 0.35)', emissive: green ? '#2f8a4a' : '#b3121b', glow: 1.2 }, od)
    label(green ? 'RODAJE PÚBLICO' : 'RODAJE PRIVADO', d.x, 2.5, d.z + 0.13, 180, 1.6, green ? '#9be3a8' : '#ffb0a6', front, green ? 'PUBLIC SHOOT' : 'PRIVATE SHOOT')
  }
  // shed-name over the front
  lbox(-1.45, 2.11, Z1 + 0.1, 1.45, 2.65, Z1 + 0.13, { color: 'oklch(0.25 0.03 50)' }, of)
  lbox(-1.3, 0, Z1 + 0.09, -1.2, 2.15, Z1 + 0.14, { color: DARK }, of)
  lbox(1.2, 0, Z1 + 0.09, 1.3, 2.15, Z1 + 0.14, { color: DARK }, of)
  label('GALPÓN DE UTILERÍA', 0, 2.38, Z1 + 0.16, 180, 2.2, '#e8d9b0', front, 'THE PROP SHED')
  // scripts/gen/locked-door.js: the side door past x 4.8 is boarded and padlocked
  lbox(4.94, 0.84, Z1 - 0.02, X1 - 0.14, 2.0, Z1 + 0.04, { color: WOOD2, tex: TEX.wood }, oc)
  for (const y of [1.05, 1.5]) lbox(4.85, y, Z1 + 0.04, X1 - 0.05, y + 0.14, Z1 + 0.07, { color: WOOD }, o)
  lbox(5.45, 1.25, Z1 + 0.07, 5.6, 1.42, Z1 + 0.1, { color: STEEL, metal: 0.7 }, o)
  // shed-seal-*: invisible walls 6 m high. Once inside nobody walks out; nobody walks in either (doors or HUD only)
  for (const [x0, z0, x1, z1] of [[-6.5, -3.06, 6.5, -2.94], [-6.5, 2.92, 6.5, 3.04], [-6.44, -3.1, -6.32, 3.1], [6.32, -3.1, 6.44, 3.1]]) {
    const e = lbox(x0, 0, z0, x1, 6, z1, null, o)
    MeshCollider.setBox(e, ColliderLayer.CL_PHYSICS)
  }
}

// --- one shed station, 1.18 wide, front at -Z, work top at y 0.9 ----------------------------------------------
function bench(a: Entity, top = 0.9) {
  const o = { parent: a }
  lbox(-W, top - 0.06, -D, W, top, D, { color: WOOD, tex: TEX.wood, rough: 0.85 }, o)
  lbox(-W, top - 0.16, -D, W, top - 0.06, -D + 0.03, { color: WOOD2 }, o) // apron
  for (const x of [-W + 0.03, W - 0.09]) for (const z of [-D + 0.03, D - 0.09]) lbox(x, 0, z, x + 0.06, top - 0.06, z + 0.06, { color: DARK }, o)
  lbox(-W + 0.03, 0.18, -D + 0.05, W - 0.03, 0.22, D - 0.05, { color: WOOD2 }, o) // low shelf
  const cans = ['oklch(0.5 0.15 30)', 'oklch(0.55 0.05 240)', 'oklch(0.6 0.12 90)']
  cans.forEach((c, i) => lcyl(-0.4 + i * 0.35, 0.22, 0.05, 0.06, 0.14, { color: c }, o))
}
const TINT: Record<string, string> = {
  knife: 'oklch(0.75 0.03 240)',
  machete: 'oklch(0.6 0.1 150)',
  saw: 'oklch(0.62 0.19 42)',
  torch: 'oklch(0.8 0.16 92)',
  walkie: 'oklch(0.45 0.05 260)',
  glove: 'oklch(0.5 0.1 50)',
  chain: 'oklch(0.5 0.01 250)',
  bulb: 'oklch(0.9 0.1 90)',
  battery: 'oklch(0.55 0.2 28)',
  antenna: 'oklch(0.35 0.02 260)',
  blades: 'oklch(0.8 0.02 240)'
}
function crate(a: Entity, gives: string) {
  const o = { parent: a }
  const h = 0.86
  lbox(-W, 0, -D, W, h, -D + 0.03, { color: WOOD, tex: TEX.wood }, o)
  lbox(-W, 0, D - 0.03, W, h, D, { color: WOOD2, tex: TEX.wood }, o)
  lbox(-W, 0, -D, -W + 0.03, h, D, { color: WOOD2, tex: TEX.wood }, o)
  lbox(W - 0.03, 0, -D, W, h, D, { color: WOOD, tex: TEX.wood }, o)
  for (const x of [-W, W - 0.05]) lbox(x - 0.005, 0, -D - 0.01, x + 0.055, h, -D + 0.04, { color: DARK }, o)
  lbox(-W + 0.03, 0.6, -D + 0.03, W - 0.03, 0.62, D - 0.03, { color: WOOD2 }, o) // false floor, stuff sits high
  lbox(-0.3, 0.32, -D - 0.012, 0.3, 0.46, -D - 0.002, { color: TINT[gives] ?? 'oklch(0.7 0.12 75)' }, o) // stencil band
}
function grinder(a: Entity) {
  bench(a)
  const o = { parent: a }
  const green: Mat = { color: 'oklch(0.35 0.09 150)', rough: 0.5 }
  lbox(-0.12, 0.9, -0.05, 0.12, 0.93, 0.15, green, o) // foot
  lcylX(-0.12, 1.08, 0.05, 0.09, 0.24, green, o) // motor
  lcylX(-0.3, 1.08, 0.05, 0.015, 0.6, { color: STEEL, metal: 0.6 }, o)
  lcylX(-0.3, 1.08, 0.05, 0.1, 0.05, { color: 'oklch(0.4 0.01 250)' }, o)
  lcylX(0.24, 1.08, 0.05, 0.1, 0.05, { color: 'oklch(0.75 0.03 70)' }, o)
  lbox(-0.04, 1.17, 0.12, 0.04, 1.2, 0.15, { color: 'oklch(0.55 0.15 30)' }, o) // switch
}
function bucket(a: Entity) {
  const o = { parent: a }
  for (const x of [-0.35, 0.3]) for (const z of [-0.3, 0.25]) lbox(x, 0, z, x + 0.05, 0.42, z + 0.05, { color: DARK }, o)
  lbox(-0.4, 0.42, -0.35, 0.4, 0.47, 0.35, { color: WOOD2 }, o)
  lcyl(0, 0.47, 0, 0.3, 0.43, { color: 'oklch(0.82 0.01 90)', rough: 0.6 }, o)
  lcyl(0, 0.9, 0, 0.27, 0.01, { color: 'oklch(0.4 0.2 25)', rough: 0.12 }, o) // the fake blood
  lbox(-0.5, 0.001, -0.45, 0.5, 0.006, 0.1, { color: 'oklch(0.4 0.2 25)', rough: 0.12 }, o) // a puddle on the floor
  lbox(0.1, 0.75, 0.06, 0.13, 1.2, 0.1, { color: WOOD }, o) // stir stick
}
function pump(a: Entity) {
  const o = { parent: a }
  lbox(-0.35, 0, 0.05, 0.25, 1.55, 0.38, { color: 'oklch(0.5 0.19 27)', rough: 0.6 }, o) // pump body
  lbox(-0.3, 1.15, 0.04, 0.2, 1.45, 0.05, { color: 'oklch(0.92 0.02 90)' }, o) // dial face
  lbox(-0.36, 1.55, 0.04, 0.26, 1.7, 0.39, { color: 'oklch(0.85 0.15 90)', emissive: 'oklch(0.6 0.15 90)', glow: 2 }, o) // lit globe box
  lbox(-W, 0.86, -D, W, 0.9, 0.05, { color: STEEL, metal: 0.5 }, o) // the tray where a saw sits
  for (const x of [-W + 0.02, W - 0.07]) lbox(x, 0, -D + 0.02, x + 0.05, 0.86, -D + 0.07, { color: DARK }, o)
  lbox(0.26, 0.7, -0.15, 0.31, 1.2, 0.2, { color: 'oklch(0.15 0.01 260)' }, o) // hose
  for (const x of [-0.5, 0.42]) lbox(x - 0.07, 0, -0.32, x + 0.07, 0.36, -0.08, { color: 'oklch(0.48 0.16 140)' }, o) // jerry cans
}
function windowSill(a: Entity) {
  const o = { parent: a }
  lbox(-W, 0, -D, W, 0.84, D, { color: WOOD2, tex: TEX.wood, rough: 0.8 }, o)
  lbox(-W - 0.02, 0.84, -D - 0.04, W + 0.02, 0.9, D + 0.12, { color: WOOD }, o) // counter sill, overhangs outside
  lbox(-0.25, 0.9, -D + 0.05, 0.25, 0.905, -D + 0.25, { color: 'oklch(0.85 0.1 85)' }, o) // a pad of order slips
}
function trash(a: Entity) {
  const o = { parent: a }
  lcyl(0, 0, 0, 0.32, 0.85, { color: 'oklch(0.35 0.06 140)', rough: 0.6, metal: 0.3 }, o)
  lcyl(0, 0.85, 0, 0.28, 0.02, { color: 'oklch(0.2 0.01 60)' }, o)
  lbox(-0.05, 0.86, -0.03, 0.15, 0.9, 0.07, { color: 'oklch(0.4 0.18 25)' }, o)
}

type Built = { st: Station; root: Entity; slot: PropSlot; twin: PropSlot | null; bg: Entity | null; fill: Entity | null; shown: number }
const built: Built[] = []
let marker: Entity

export function buildStations() {
  for (const st of STATIONS) {
    const a = anchor(st.x, 0, st.z, st.yaw)
    // the collider Spawn gives every station: 1.18 x 0.9 x 0.8
    const col = lbox(-0.59, 0, -0.4, 0.59, 0.9, 0.4, null, { parent: a })
    MeshCollider.setBox(col, ColliderLayer.CL_PHYSICS)
    const gives = GIVES(st.id)
    if (st.kind === 'supply') crate(a, gives as string)
    else if (st.kind === 'grinder') grinder(a)
    else if (st.kind === 'bucket') bucket(a)
    else if (st.kind === 'pump') pump(a)
    else if (st.kind === 'window') windowSill(a)
    else if (st.kind === 'trash') trash(a)
    else bench(a)
    // what lies on it (item), or the crate's samples (item + item2), as the .scene children place them
    const supply = st.kind === 'supply'
    const slot = slotAt(a, Vector3.create(supply ? -0.22 : 0, supply ? 0.66 : 0.92, supply ? 0 : 0.05), Quaternion.fromEulerDegrees(0, -15, 0), 1.7)
    const twin = supply && gives !== 'saw' ? slotAt(a, Vector3.create(0.22, 0.66, -0.04), Quaternion.fromEulerDegrees(0, 20, 0), 1.7) : null
    if (supply) {
      if (gives === 'saw') Transform.getMutable(slot.root).position = Vector3.create(-0.1, 0.66, 0)
      slot.show({ k: gives as string })
      twin?.show({ k: gives as string })
    }
    // the grinder's and the pump's progress bar
    let bg: Entity | null = null
    let fill: Entity | null = null
    if (st.kind === 'grinder' || st.kind === 'pump') {
      const bar = engine.addEntity()
      Transform.create(bar, { position: sp(st.x, 2.0, st.z) })
      Billboard.create(bar, { billboardMode: BillboardMode.BM_ALL })
      bg = engine.addEntity()
      Transform.create(bg, { parent: bar, scale: Vector3.create(0.84, 0.14, 0.01) })
      MeshRenderer.setBox(bg)
      Material.setBasicMaterial(bg, { diffuseColor: Color4.create(0.1, 0.06, 0.12, 1) })
      fill = engine.addEntity()
      Transform.create(fill, { parent: bar, position: Vector3.create(0, 0, -0.01), scale: Vector3.create(0.8, 0.1, 0.01) })
      MeshRenderer.setBox(fill)
      Material.setBasicMaterial(fill, { diffuseColor: Color4.create(0.96, 0.76, 0.47, 1) })
      setVisible(bg, false)
      setVisible(fill, false)
    }
    built.push({ st, root: a, slot, twin, bg, fill, shown: -1 })
  }
  // what the maker faces right now: a small lit bar over the station (maker.js state.look)
  marker = engine.addEntity()
  Transform.create(marker, { position: Vector3.create(0, -5, 0), scale: Vector3.create(0.9, 0.04, 0.06) })
  MeshRenderer.setBox(marker)
  Material.setBasicMaterial(marker, { diffuseColor: Color4.create(1, 0.85, 0.45, 1) })
  engine.addSystem(syncStations)
}

// scripts/station.js: show what lies on the station, run the bar
function syncStations() {
  for (const b of built) {
    if (b.st.kind !== 'supply') b.slot.show(stationItem(b.st.id) as Item | null)
    if (b.bg && b.fill) {
      const pct = Math.round(Math.min(1, Math.max(0, stationProg(b.st.id))) * 100)
      if (pct !== b.shown) {
        b.shown = pct
        const on = pct > 0 && pct < 100
        setVisible(b.bg, on)
        setVisible(b.fill, on)
        const t = Transform.getMutable(b.fill)
        t.scale = Vector3.create(0.8 * (pct / 100), 0.1, 0.01)
        t.position = Vector3.create(-0.4 + 0.4 * (pct / 100), 0, -0.01)
      }
    }
  }
}
export function setMarker(st: Station | null) {
  const t = Transform.getMutable(marker)
  if (!st) {
    if (t.position.y > -1) t.position = Vector3.create(0, -5, 0)
    return
  }
  // on the station's edge that faces the shed's middle
  const front = st.yaw === 180 ? { x: 0, z: 0.43 } : st.yaw === 0 ? { x: 0, z: -0.43 } : st.yaw === 90 ? { x: -0.43, z: 0 } : { x: 0.43, z: 0 }
  const side = st.yaw === 90 || st.yaw === -90
  t.position = sp(st.x + front.x, 0.93, st.z + front.z)
  t.rotation = yaw(side ? 90 : 0)
}
