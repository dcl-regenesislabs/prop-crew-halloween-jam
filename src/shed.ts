// The prop shed and its stations.
// Ported from scripts/gen/shed.js (shell), scripts/gen/station.js + scripts/station.js (the 23 stations and
// what they show), scripts/gen/locked-door.js and the shed-seal-* colliders of places/main/cells/x0z0.scene.
// Spawn draws these as scripted meshes; here they are boxes and cylinders in the same places and colours.
import {
  AvatarModifierArea,
  AvatarModifierType,
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
import { loop, stopLoop } from './audio'
import { DOOR, ICON, SND, TEX } from './config'
import { anchor, c3, c4, lball, lbox, lcyl, lcylX, Mat, rl, roomRoot, sp, yaw } from './gfx'
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
const Z0 = -4.05 // one tile deeper at the back and the front since seq 292 (@sebadl)
const Z1 = 4.05
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

// --- the lot's shed: closed --------------------------------------------------------------------------------------
// What stands on the lot is only a shell: high tin walls, a roof, one green door and the name board (Spawn's
// lobby shed, scripts/gen/shed-closed.js, simplified). Playtest feedback: the inside must not be visible from the
// lobby, nor built there. The working shed lives in a room above (buildInterior, on first entry).
export function buildClosedShed() {
  const root = anchor(0, 0, 0)
  const oc = { parent: root, collide: true }
  const o = { parent: root }
  const tin: Mat = { color: 'oklch(0.42 0.03 240)', tex: TEX.siding, tile: [6, 2], rough: 0.55, metal: 0.35 }
  const HC = 4.2
  lbox(X0 - 0.05, 0, Z0, X0, HC, Z1, tin, oc)
  lbox(X1, 0, Z0, X1 + 0.05, HC, Z1, tin, oc)
  lbox(X0, 0, Z0 - 0.05, X1, HC, Z0, tin, oc)
  lbox(X0, 0, Z1, X1, HC, Z1 + 0.05, tin, oc)
  lbox(X0 - 0.3, HC, Z0 - 0.3, X1 + 0.3, HC + 0.12, Z1 + 0.3, { color: 'oklch(0.3 0.03 240)', rough: 0.6, metal: 0.3 }, o) // roof
  // the door (door-public)
  const a = anchor(DOOR.x, 0, DOOR.z, 180, { parent: root })
  const od = { parent: a }
  lbox(-0.6, 0, -0.06, 0.6, 2.2, 0.0, { color: 'oklch(0.36 0.09 150)', rough: 0.8 }, od)
  lbox(-0.72, 0, -0.08, -0.6, 2.35, 0.02, { color: DARK }, od)
  lbox(0.6, 0, -0.08, 0.72, 2.35, 0.02, { color: DARK }, od)
  lbox(-0.72, 2.2, -0.08, 0.72, 2.35, 0.02, { color: DARK }, od)
  lball(0, 3.5, -0.35, 0.08, 0.08, 0.08, { color: 'oklch(0.95 0.1 75)', emissive: 'oklch(0.85 0.11 70)', glow: 4 }, od)
  // the glowing disc on the ground in front
  lcyl(0, 0.03, -1.3, 1.1, 0.02, { color: 'oklch(0.9 0.08 150 / 0.35)', emissive: '#2f8a4a', glow: 1.2 }, od)
  // shed-name over the door
  lbox(-1.6, 2.5, Z1 + 0.05, 1.6, 3.14, Z1 + 0.09, { color: 'oklch(0.25 0.03 50)' }, o)
  label('GALPÓN DE UTILERÍA', 0, 2.82, Z1 + 0.12, 180, 2.4, '#e8d9b0', root, 'THE PROP SHED')
}

// --- the shell ------------------------------------------------------------------------------------------
// No nametags over the makers while they work (playtest feedback; Spawn: nameplates off in its own way). One
// area covering the three rooms' heights; on the lot the names stay.
let tagsHidden = false
function hideNametags() {
  if (tagsHidden) return
  tagsHidden = true
  const e = engine.addEntity()
  const size = Vector3.create(40, 60, 30)
  Transform.create(e, { position: sp(0, 42, 0), scale: size })
  AvatarModifierArea.create(e, { area: size, modifiers: [AvatarModifierType.AMT_HIDE_NAMETAGS], excludeIds: [] })
}

// The working shed, hung from the room root (gfx.ts): built once, on the first entry, and moved to whichever
// room the server gives you.
export function buildInterior() {
  hideNametags()
  const root = anchor(0, 0, 0, 0, { parent: roomRoot() })
  const o = { parent: root }
  const oc = { parent: root, collide: true }
  // the room's ground: hides the lot below and gives the customers their strip behind the back wall
  lbox(-30, -0.4, -22, 30, -0.07, 24, { color: 'oklch(0.36 0.04 140)', tex: TEX.grass, tile: [12, 10], rough: 1 }, oc)
  lbox(-9, -0.07, -7.5, 9, -0.055, 6, { color: 'oklch(0.6 0.015 240)', tex: TEX.gravel, tile: [6, 5], rough: 1 }, o)
  // floor: concrete
  lbox(X0, -0.06, Z0, X1, 0.02, Z1, { color: 'oklch(0.82 0.01 70)', tex: TEX.rock, tile: [5, 3], rough: 0.95 }, o)
  for (let i = 1; i < 5; i++) lbox(X0 + i * 2.5 - 0.01, 0.02, Z0, X0 + i * 2.5 + 0.01, 0.022, Z1, { color: 'oklch(0.4 0.01 70)' }, o) // seams
  // fake-blood footprints, walking away from the bucket in the front row (it moved there at seq 292)
  for (let i = 0; i < 9; i++) lbox(1.52 - i * 0.14 + (i % 2) * 0.2, 0.022, 2.66 - i * 0.34, 1.6 - i * 0.14 + (i % 2) * 0.2, 0.026, 2.8 - i * 0.34, { color: 'oklch(0.38 0.16 25)' }, o)
  // walls: corrugated tin, sides full height
  const tin: Mat = { color: 'oklch(0.42 0.03 240)', tex: TEX.siding, tile: [4, 1.5], rough: 0.55, metal: 0.35 }
  lbox(X0 - 0.05, 0, Z0, X0, H, Z1, tin, oc)
  lbox(X1, 0, Z0, X1 + 0.05, H, Z1, tin, oc)
  // back: knee wall under the two service windows, tin either side of them; the customers stand outside it
  lbox(-1.25, 0, Z0 - 0.1, 1.25, 0.84, Z0 + 0.02, { color: 'oklch(0.35 0.05 50)', rough: 0.85 }, oc)
  for (const x of [-1.32, -0.07, 1.18]) lbox(x, 0, Z0 - 0.12, x + 0.14, 1.1, Z0 + 0.05, { color: 'oklch(0.32 0.04 50)' }, o)
  const tin2: Mat = { color: 'oklch(0.45 0.03 240)', tex: TEX.siding, tile: [2.5, 1], rough: 0.55, metal: 0.35 }
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
  // the hanging work lamps are light only: their shades hid the maker from the camera (@sebadl)
  // Spawn lights nine lamps in here (lamp-1..9); Decentraland renders a handful, so the three big ones stay
  for (const [x, z, shadow] of [[-3, -0.6, 0], [3, -0.6, 0], [0, 0.9, 1]]) {
    const l = engine.addEntity()
    Transform.create(l, { parent: roomRoot(), position: rl(x, 1.95, z) })
    LightSource.create(l, { type: LightSource.Type.Point({}), color: c3('oklch(0.9 0.08 80)'), intensity: 30000, range: 12, shadow: !!shadow, active: true })
  }
  // scripts/gen/locked-door.js: the side door past x 4.8 is boarded and padlocked
  lbox(4.94, 0.84, Z1 - 0.02, X1 - 0.14, 2.0, Z1 + 0.04, { color: WOOD2, tex: TEX.wood }, oc)
  for (const y of [1.05, 1.5]) lbox(4.85, y, Z1 + 0.04, X1 - 0.05, y + 0.14, Z1 + 0.07, { color: WOOD }, o)
  lbox(5.45, 1.25, Z1 + 0.07, 5.6, 1.42, Z1 + 0.1, { color: STEEL, metal: 0.7 }, o)
  // shed-seal-*: invisible walls 6 m high. Once inside nobody walks out; nobody walks in either (doors or HUD only)
  for (const [x0, z0, x1, z1] of [[-6.5, -4.26, 6.5, -4.14], [-6.5, 4.12, 6.5, 4.24], [-6.44, -4.3, -6.32, 4.3], [6.32, -4.3, 6.44, 4.3]]) {
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
function crate(a: Entity, gives: string, bare: boolean) {
  const o = { parent: a }
  const h = 0.86
  lbox(-W, 0, -D, W, h, -D + 0.03, { color: WOOD, tex: TEX.wood }, o)
  lbox(-W, 0, D - 0.03, W, h, D, { color: WOOD2, tex: TEX.wood }, o)
  lbox(-W, 0, -D, -W + 0.03, h, D, { color: WOOD2, tex: TEX.wood }, o)
  lbox(W - 0.03, 0, -D, W, h, D, { color: WOOD, tex: TEX.wood }, o)
  for (const x of [-W, W - 0.05]) lbox(x - 0.005, 0, -D - 0.01, x + 0.055, h, -D + 0.04, { color: DARK }, o)
  lbox(-W + 0.03, 0.6, -D + 0.03, W - 0.03, 0.62, D - 0.03, { color: WOOD2 }, o) // false floor, stuff sits high
  // plaque: a square icon of what's inside (playtest feedback: the plain colour band wasn't distinct enough,
  // and the prop models themselves are too plain to read at a glance). Racks give the unworked "bare" look,
  // bins the plain part icon (same art already used in the HUD and tickets).
  lbox(-0.285, 0.105, -D - 0.004, 0.285, 0.675, -D - 0.002, { color: 'oklch(0.95 0.02 90)' }, o) // plaque backing, recessed
  lbox(-0.255, 0.135, -D - 0.012, 0.255, 0.645, -D - 0.004, { color: 'white', tex: ICON(gives + (bare ? 'bare' : '')), alpha: true }, o) // icon, frontmost so the backing can't hide it
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

type Built = { st: Station; root: Entity; slot: PropSlot; twin: PropSlot | null; bg: Entity | null; fill: Entity | null; shown: number; running: boolean; hitAt: number }
const built: Built[] = []
let marker: Entity

export function buildStations() {
  for (const st of STATIONS) {
    const a = anchor(st.x, 0, st.z, st.yaw, { parent: roomRoot() })
    // the collider Spawn gives every station: 1.18 x 0.9 x 0.8
    const col = lbox(-0.59, 0, -0.4, 0.59, 0.9, 0.4, null, { parent: a })
    MeshCollider.setBox(col, ColliderLayer.CL_PHYSICS)
    const gives = GIVES(st.id)
    if (st.kind === 'supply') crate(a, gives as string, st.id.startsWith('rack-'))
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
      Transform.create(bar, { parent: roomRoot(), position: rl(st.x, 2.0, st.z) })
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
    built.push({ st, root: a, slot, twin, bg, fill, shown: -1, running: false, hitAt: 0 })
  }
  // what the maker faces right now: a small lit bar over the station (maker.js state.look)
  marker = engine.addEntity()
  Transform.create(marker, { parent: roomRoot(), position: Vector3.create(0, -5, 0), scale: Vector3.create(0.9, 0.04, 0.06) })
  MeshRenderer.setBox(marker)
  Material.setBasicMaterial(marker, { diffuseColor: Color4.create(1, 0.85, 0.45, 1) })
  // the first-order guide: an amber label and a bouncing arrow over the station needed next (ui.js arrow)
  guide = engine.addEntity()
  Transform.create(guide, { parent: roomRoot(), position: Vector3.create(0, -5, 0), scale: Vector3.create(1.4, 1.4, 1.4) })
  Billboard.create(guide, { billboardMode: BillboardMode.BM_ALL })
  guideBoard = engine.addEntity()
  Transform.create(guideBoard, { parent: guide, position: Vector3.create(0, 0.62, 0.01), scale: Vector3.create(1, 0.3, 0.01) })
  MeshRenderer.setBox(guideBoard)
  Material.setBasicMaterial(guideBoard, { diffuseColor: Color4.create(0.965, 0.757, 0.467, 1) })
  guideText = engine.addEntity()
  Transform.create(guideText, { parent: guide, position: Vector3.create(0, 0.62, -0.02) })
  TextShape.create(guideText, { text: '', fontSize: 2, textColor: Color4.create(0.17, 0.106, 0.24, 1), textAlign: TextAlignMode.TAM_MIDDLE_CENTER })
  const tip = engine.addEntity()
  Transform.create(tip, { parent: guide, position: Vector3.create(0, 0.2, 0), scale: Vector3.create(0.34, 0.4, 0.34) })
  MeshRenderer.setCylinder(tip, 0, 0.5) // a cone, point down
  Material.setBasicMaterial(tip, { diffuseColor: Color4.create(0.965, 0.757, 0.467, 1) })
  engine.addSystem(syncStations)
  ready = true
}

let ready = false // the interior exists (it is built on the first entry)
let guide: Entity
let guideBoard: Entity
let guideText: Entity
let guideAt: Station | null = null
let guideSays = ''
export function setGuide(id: string | null, text: string) {
  if (!ready) return
  const st = id ? STATIONS.find((s) => s.id === id) ?? null : null
  if (st !== guideAt && !st) Transform.getMutable(guide).position = Vector3.create(0, -5, 0)
  guideAt = st
  if (st && text !== guideSays) {
    guideSays = text
    TextShape.getMutable(guideText).text = text
    Transform.getMutable(guideBoard).scale = Vector3.create(text.length * 0.115 + 0.25, 0.3, 0.01)
  }
}
// a crate answers a good grab: it bounces (maker.js crateHit)
export function crateBounce(id: string) {
  const b = built.find((x) => x.st.id === id)
  if (b) b.hitAt = Date.now()
}

// scripts/station.js: show what lies on the station, run the bar; a working grinder or pump bobs on its feet
// and plays its own motor loop
function syncStations() {
  const t = Date.now()
  // over the station; for the crates on the side walls it sits a step toward the middle, so the wall never hides it
  if (guideAt) Transform.getMutable(guide).position = rl(guideAt.x - Math.sign(guideAt.x) * (Math.abs(guideAt.x) > 5 ? 1.3 : 0), 1.5 + Math.abs(Math.sin(t / 220)) * 0.25, guideAt.z)
  for (const b of built) {
    if (b.hitAt) {
      const k = (t - b.hitAt) / 180
      const s = k >= 1 ? 1 : 1 - Math.sin(k * Math.PI) * 0.18
      Transform.getMutable(b.root).scale = Vector3.create(1 + (1 - s) * 0.5, s, 1 + (1 - s) * 0.5)
      if (k >= 1) b.hitAt = 0
    }
    if (b.st.kind === 'grinder' || b.st.kind === 'pump') {
      const on = stationProg(b.st.id) > 0
      if (on !== b.running) {
        b.running = on
        if (on) loop('motor-' + b.st.id, SND(b.st.kind === 'grinder' ? 'bench-grinder-motor-loop' : 'gas-pump-fuel-flow-loop'), { volume: 0.8, global: true })
        else {
          stopLoop('motor-' + b.st.id)
          Transform.getMutable(b.root).scale = Vector3.One()
        }
      }
      if (on) {
        const w = Math.abs(Math.sin((t / 1000) * 9))
        Transform.getMutable(b.root).scale = Vector3.create(1 + w * 0.03, 1 + w * 0.07, 1 + w * 0.03)
      }
    }
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
  if (!ready) return
  const t = Transform.getMutable(marker)
  if (!st) {
    if (t.position.y > -1) t.position = Vector3.create(0, -5, 0)
    return
  }
  // on the station's edge that faces the shed's middle
  const front = st.yaw === 180 ? { x: 0, z: 0.43 } : st.yaw === 0 ? { x: 0, z: -0.43 } : st.yaw === 90 ? { x: -0.43, z: 0 } : { x: 0.43, z: 0 }
  const side = st.yaw === 90 || st.yaw === -90
  t.position = rl(st.x + front.x, 0.93, st.z + front.z)
  t.rotation = yaw(side ? 90 : 0)
}
