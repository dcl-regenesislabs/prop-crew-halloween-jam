// The film lot around the shed: RVs, the fake haunted-house set, light towers, trees, crew clutter, and six
// movie monsters killing time between takes.
// Positions come from places/main/cells/x0z0.scene and places/lobby/cells/x0z0.scene (lot-*, rv-*, film-*,
// extra-*). Spawn builds each from scripts/gen/lot-{rv,set,prop,dress}.js; here they are simplified to a few
// primitives each: same place, footprint and palette, less detail. Left out: the perimeter fence (it stands
// outside the parcels), ground cables, grass, pebbles and reeds, fog, clouds.
import { Animator, engine, Entity, GltfContainer, LightSource, Transform } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { insideShed, MODEL, ORIGIN, SCENE, TEX, WANDER_SPEED, WhoId } from './config'
import { anchor, box, c3, lball, lbox, lcyl, Mat, sp, yaw } from './gfx'
import { label } from './shed'

const DARK = 'oklch(0.22 0.02 260)'
const STEEL = 'oklch(0.6 0.01 250)'
// the character models face local -Z once loaded, so they are turned half a circle to walk forwards
// (seen in the Godot Explorer on 2026-10-09: with 0 they walked backwards)
export const MODEL_YAW_FIX = 180

function rv(x: number, z: number, rot: number, L: number, color: string, doorSide: number) {
  const a = anchor(x, 0, z, rot)
  const o = { parent: a }
  lbox(-1.2, 0.55, -L / 2, 1.2, 2.9, L / 2, { color, tex: TEX.siding, tile: [2, 1], rough: 0.5, metal: 0.2 }, { parent: a, collide: true })
  lbox(-1.22, 1.5, -L / 2 + 0.3, 1.22, 1.62, L / 2 - 0.3, { color: 'oklch(0.45 0.12 30)' }, o) // stripe
  lbox(-1.1, 2.9, -L / 2 + 0.2, 1.1, 2.98, L / 2 - 0.2, { color: 'oklch(0.8 0.01 250)' }, o) // roof
  for (const zz of [-L / 2 + 1, L / 2 - 1.2]) for (const xx of [-1.15, 0.9]) lcyl(xx + 0.12, 0, zz, 0.3, 0.6, { color: DARK }, o) // wheels
  // lit windows and the door on the door side
  const s = doorSide
  for (const zz of [-L / 2 + 1.2, L / 2 - 1.6]) lbox(s * 1.2 - 0.02, 1.75, zz - 0.45, s * 1.2 + 0.02, 2.4, zz + 0.45, { color: 'oklch(0.9 0.1 85)', emissive: 'oklch(0.85 0.1 80)', glow: 1.6 }, o)
  lbox(s * 1.2 - 0.03, 0.6, -0.4, s * 1.2 + 0.03, 2.5, 0.4, { color: 'oklch(0.3 0.03 250)' }, o)
  lbox(s * 1.25, 0.25, -0.45, s * 1.75, 0.5, 0.45, { color: STEEL, metal: 0.5 }, { parent: a, collide: true }) // step
}

function facade() {
  // film-set: a painted haunted-house front propped up from behind, facing the film lights
  const a = anchor(-11, 0, -7, 180)
  const o = { parent: a }
  const wall: Mat = { color: 'oklch(0.3 0.03 300)', tex: TEX.wood, tile: [4, 2], rough: 0.9 }
  lbox(-4.5, 0, -0.1, 4.5, 4.6, 0.1, wall, { parent: a, collide: true })
  lbox(-2.2, 4.6, -0.1, 2.2, 6.4, 0.1, wall, o) // gable
  lbox(-0.6, 0, -0.14, 0.6, 2.3, -0.1, { color: 'oklch(0.18 0.03 30)' }, o) // door
  for (const x of [-2.9, 2.9]) {
    lbox(x - 0.7, 1.3, -0.14, x + 0.7, 3.0, -0.1, { color: 'oklch(0.75 0.14 85)', emissive: 'oklch(0.7 0.15 80)', glow: 1.4 }, o)
    lbox(x - 0.04, 1.3, -0.16, x + 0.04, 3.0, -0.14, { color: 'oklch(0.18 0.03 30)' }, o)
    lbox(x - 0.7, 2.11, -0.16, x + 0.7, 2.19, -0.14, { color: 'oklch(0.18 0.03 30)' }, o)
  }
  lbox(-0.45, 5.0, -0.14, 0.45, 5.8, -0.1, { color: 'oklch(0.55 0.2 27)', emissive: 'oklch(0.5 0.2 27)', glow: 1.5 }, o) // attic window
  // the braces that give it away
  for (const x of [-3.5, 0, 3.5]) {
    lbox(x - 0.05, 0, 0.1, x + 0.05, 0.1, 2.2, { color: 'oklch(0.5 0.07 60)' }, o)
    box(x - 0.05, 0, -2.2, x + 0.05, 0.1, -0.1, { color: 'oklch(0.5 0.07 60)' }, { parent: a, rot: Quaternion.fromEulerDegrees(-55, 0, 0) })
  }
}

function lightStand(x: number, z: number, aimX: number, aimZ: number, lit: boolean) {
  const a = anchor(x, 0, z, (Math.atan2(-(aimX - x), -(aimZ - z)) * 180) / Math.PI)
  const o = { parent: a }
  lcyl(0, 0, 0, 0.04, 3.7, { color: DARK }, o)
  for (const r of [0, 120, 240]) box(-0.02, 0, 0, 0.02, 0.05, 0.9, { color: DARK }, { parent: a, rot: Quaternion.fromEulerDegrees(0, r, 0) })
  lbox(-0.35, 3.6, -0.25, 0.35, 4.1, 0.05, { color: DARK }, o)
  lbox(-0.3, 3.65, -0.27, 0.3, 4.05, -0.25, { color: 'oklch(0.95 0.04 230)', emissive: 'oklch(0.9 0.05 230)', glow: 4 }, o)
  if (!lit) return
  // film-light-1-beam: the one spot that throws shadows across the set
  const l = engine.addEntity()
  const from = sp(x, 3.85, z)
  Transform.create(l, { position: from, rotation: Quaternion.fromLookAt(from, sp(aimX, 2.6, aimZ)) })
  LightSource.create(l, { type: LightSource.Type.Spot({ innerAngle: 20, outerAngle: 38 }), color: c3('oklch(0.9 0.05 230)'), intensity: 60000, range: 28, shadow: true, active: true })
}

function tower(x: number, z: number, rot: number) {
  const a = anchor(x, 0, z, rot)
  const o = { parent: a }
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) lcyl(dx, 0, dz, 0.04, 7, { color: STEEL, metal: 0.6 }, o)
  for (const y of [1.75, 3.5, 5.25, 7]) lbox(-0.34, y - 0.03, -0.34, 0.34, y + 0.03, 0.34, { color: STEEL, metal: 0.6 }, o)
  lbox(-0.7, 7, -0.3, 0.7, 7.6, -0.1, { color: DARK }, o)
  lbox(-0.65, 7.05, -0.32, 0.65, 7.55, -0.3, { color: 'oklch(0.95 0.03 240)', emissive: 'oklch(0.85 0.05 240)', glow: 3 }, o)
  const c = lbox(-0.4, 0, -0.4, 0.4, 3, 0.4, null, { parent: a, collide: true })
  void c
}

function tree(x: number, z: number, h: number) {
  const a = anchor(x, 0, z)
  const o = { parent: a }
  lcyl(0, 0, 0, 0.28, h * 0.55, { color: 'oklch(0.28 0.03 60)', rough: 1 }, { parent: a, collide: true, top: 0.36 })
  const leaf: Mat = { color: 'oklch(0.27 0.05 150)', rough: 1 }
  lball(0, h * 0.68, 0, h * 0.26, h * 0.24, h * 0.26, leaf, o)
  lball(h * 0.12, h * 0.85, -h * 0.06, h * 0.18, h * 0.17, h * 0.18, leaf, o)
  lball(-h * 0.14, h * 0.6, h * 0.1, h * 0.17, h * 0.15, h * 0.17, { color: 'oklch(0.24 0.05 155)', rough: 1 }, o)
}

function cone(x: number, z: number) {
  const a = anchor(x, 0, z)
  lbox(-0.18, 0, -0.18, 0.18, 0.03, 0.18, { color: 'oklch(0.2 0.01 60)' }, { parent: a })
  lcyl(0, 0.03, 0, 0.13, 0.5, { color: 'oklch(0.68 0.2 45)' }, { parent: a, top: 0.04 })
  lcyl(0, 0.25, 0, 0.085, 0.08, { color: 'oklch(0.95 0.01 90)' }, { parent: a, top: 0.13 })
}
function cases(x: number, z: number, rot: number, n: number) {
  const a = anchor(x, 0, z, rot)
  for (let i = 0; i < n; i++) {
    const w = 0.9 - i * 0.12
    lbox(-w / 2 + i * 0.06, i * 0.45, -0.3, w / 2 + i * 0.06, i * 0.45 + 0.43, 0.3, { color: i % 2 ? 'oklch(0.25 0.01 260)' : 'oklch(0.32 0.02 250)', rough: 0.5, metal: 0.3 }, { parent: a, collide: i === 0 })
    lbox(-w / 2 + i * 0.06, i * 0.45 + 0.19, -0.31, w / 2 + i * 0.06, i * 0.45 + 0.24, 0.31, { color: STEEL, metal: 0.7 }, { parent: a })
  }
}
function sandbags(x: number, z: number, rot: number, n: number) {
  const a = anchor(x, 0, z, rot)
  for (let i = 0; i < n; i++) lball((i % 3) * 0.55 - 0.55, 0.12 + Math.floor(i / 3) * 0.2, (i % 2) * 0.12, 0.3, 0.13, 0.2, { color: 'oklch(0.55 0.05 85)', tex: TEX.burlap, rough: 1 }, { parent: a })
}
function chair(x: number, z: number, rot: number, color: string) {
  const a = anchor(x, 0, z, rot)
  const o = { parent: a }
  for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) lcyl(dx, 0, dz, 0.015, 0.45, { color: STEEL, metal: 0.6 }, o)
  lbox(-0.23, 0.45, -0.23, 0.23, 0.48, 0.23, { color, tex: TEX.cotton }, o)
  lbox(-0.23, 0.48, 0.2, 0.23, 0.95, 0.23, { color, tex: TEX.cotton }, o)
}
function sign(x: number, z: number, rot: number) {
  // lot-sign-1..3: Spawn hangs a red "SILENCIO, SE GRABA" label on each (ui.js SIGNS, class "red")
  const a = anchor(x, 0, z, rot)
  const o = { parent: a }
  for (const dx of [-0.45, 0.45]) lbox(dx - 0.03, 0, -0.03, dx + 0.03, 1.5, 0.03, { color: 'oklch(0.5 0.07 60)' }, o)
  lbox(-0.58, 0.87, -0.06, 0.58, 1.53, -0.05, { color: '#e8d9b0' }, o)
  lbox(-0.55, 0.9, -0.065, 0.55, 1.5, -0.055, { color: '#b3121b' }, o)
  label('SILENCIO,\nSE GRABA', 0, 1.2, -0.08, 0, 1.3, '#fff3d0', a, 'QUIET\nON SET')
}
// the small dark labels Spawn hangs on the director's chair and the trailers (ui.js SIGNS, class "sm")
function tag(es: string, en: string, x: number, y: number, z: number, facing: number, parent?: Entity) {
  const a = anchor(x, y, z, facing, { parent })
  const w = Math.max(es.length, en.length) * 0.075 + 0.12
  lbox(-w / 2, -0.11, -0.01, w / 2, 0.11, 0.0, { color: '#6b4a2a' }, { parent: a })
  lbox(-w / 2 + 0.02, -0.09, -0.02, w / 2 - 0.02, 0.09, -0.01, { color: '#1a1020' }, { parent: a })
  label(es, 0, 0, -0.03, 0, 1.0, '#e8d9b0', a, en)
}

// --- the six extras (scripts/wander.js): stroll to a spot, stand, look around, stroll on ----------------------
type Extra = { e: Entity; x: number; z: number; to: { x: number; z: number } | null; rest: number; walking: boolean }
const extras: Extra[] = []
function pick() {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2
    const d = 6 + Math.random() * 14
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (Math.abs(x) < 7.4 && Math.abs(z) < 4.4) continue // not into the shed
    if (Math.abs(x) < 4.2 && z > 3 && z < 9) continue // keep the doors clear
    if (ORIGIN.x + x < 2 || ORIGIN.x + x > SCENE.w - 2 || ORIGIN.z - z < 2 || ORIGIN.z - z > SCENE.d - 2) continue // stay on the parcels
    return { x, z }
  }
  return { x: 0, z: 12 }
}
// Spawn walks them along a navmesh path; here it is a straight line that refuses to cross the shed
const crossesShed = (ax: number, az: number, bx: number, bz: number) => {
  for (let t = 0; t <= 1; t += 0.05) if (insideShed(ax + (bx - ax) * t, az + (bz - az) * t) || (Math.abs(ax + (bx - ax) * t) < 7.4 && Math.abs(az + (bz - az) * t) < 4.4)) return true
  return false
}
function wander(dt: number) {
  for (const m of extras) {
    if (!m.to) {
      m.rest -= dt
      if (m.rest > 0) continue
      const to = pick()
      if (crossesShed(m.x, m.z, to.x, to.z)) continue
      m.to = to
      if (!m.walking) {
        m.walking = true
        Animator.playSingleAnimation(m.e, 'Walk')
      }
    }
    const dx = m.to.x - m.x
    const dz = m.to.z - m.z
    const d = Math.hypot(dx, dz)
    if (d < 0.15) {
      m.to = null
      m.rest = 2.5 + Math.random() * 5
      m.walking = false
      Animator.playSingleAnimation(m.e, 'Idle')
      continue
    }
    const k = Math.min(1, (WANDER_SPEED * dt) / d)
    m.x += dx * k
    m.z += dz * k
    const t = Transform.getMutable(m.e)
    t.position = sp(m.x, 0, m.z)
    t.rotation = yaw((Math.atan2(-dx, -dz) * 180) / Math.PI + MODEL_YAW_FIX)
  }
}

export function character(who: WhoId, x: number, z: number, rot: number) {
  const e = engine.addEntity()
  Transform.create(e, { position: sp(x, 0, z), rotation: yaw(rot + MODEL_YAW_FIX) })
  GltfContainer.create(e, { src: MODEL(who) })
  Animator.create(e, {
    states: [
      { clip: 'Idle', playing: true, loop: true },
      { clip: 'Walk', playing: false, loop: true }
    ]
  })
  return e
}

export function buildLot() {
  // the ground: grass under moonlight, a gravel pad around the shed
  box(0, -0.2, 0, SCENE.w, 0, SCENE.d, { color: 'oklch(0.52 0.05 140)', tex: TEX.grass, tile: [12, 16], rough: 1 }, { collide: true })
  const pad = anchor(0, 0, 0)
  lbox(-9, 0, -6, 9, 0.012, 9, { color: 'oklch(0.6 0.015 240)', tex: TEX.gravel, tile: [6, 5], rough: 1 }, { parent: pad })

  rv(11, -1, 0, 6, 'oklch(0.85 0.02 90)', -1) // rv-1, the lead's
  rv(13, 10, 90, 7, 'oklch(0.8 0.04 20)', 1) // rv-2, makeup
  rv(-12, 5, 0, 6, 'oklch(0.6 0.08 150)', 1) // rv-3
  facade()
  lightStand(-15.2, -1.8, -11, -7.2, true)
  lightStand(-7.6, -2.4, -11, -7.2, false)
  // film-camera on its tripod, the director's chair
  const cam = anchor(-10.6, 0, -0.6, 8)
  for (const r of [0, 120, 240]) box(-0.02, 0, 0, 0.02, 1.3, 0.04, { color: DARK }, { parent: cam, rot: Quaternion.fromEulerDegrees(18, r, 0) })
  lbox(-0.15, 1.3, -0.35, 0.15, 1.6, 0.25, { color: DARK }, { parent: cam })
  lcyl(0, 1.6, 0.05, 0.16, 0.06, { color: DARK }, { parent: cam })
  lbox(-0.07, 1.38, -0.55, 0.07, 1.52, -0.35, { color: 'oklch(0.3 0.02 250)' }, { parent: cam })
  chair(-13.2, -0.2, 15, 'oklch(0.25 0.02 260)')

  tower(18, 16, 20)
  tower(-18, 16, 90)
  tower(-18, -16, 160)
  tower(18, -16, 230)
  for (const [x, z, h] of [[18.39, 15.43, 7.5], [-2.27, 25.9, 6], [-17.62, 14.78, 8], [-26.9, -2.35, 6.5], [-16.85, -14.14, 7], [-2.18, -24.9, 8.5], [17.36, -20.68, 6]]) tree(x, z, h)
  for (const [x, z] of [[8, 4.6], [10.4, 4.7], [-8, -5.2], [19.5, 1]]) cone(x, z)
  cases(16.2, -5.5, 12, 3)
  cases(-16, -10.5, -20, 2)
  cases(8.4, -12.5, 40, 3)
  sandbags(16.6, -14.2, 30, 5)
  sandbags(-16.3, 14.3, -60, 4)
  sandbags(-8.2, -10.6, 90, 5)
  chair(14.6, 7.7, 160, 'oklch(0.5 0.1 195)')
  chair(15.5, 7.5, 200, 'oklch(0.45 0.12 25)')
  // lot-cooler, lot-craft (the snack table), lot-laundry-rack (costumes)
  const cooler = anchor(16.4, 0, 7.8, 10)
  lbox(-0.35, 0, -0.22, 0.35, 0.4, 0.22, { color: 'oklch(0.55 0.15 250)' }, { parent: cooler, collide: true })
  lbox(-0.36, 0.4, -0.23, 0.36, 0.47, 0.23, { color: 'oklch(0.95 0.01 90)' }, { parent: cooler })
  const craft = anchor(6.2, 0, 13.6, 180)
  lbox(-1.1, 0.72, -0.4, 1.1, 0.76, 0.4, { color: 'oklch(0.92 0.01 90)', tex: TEX.cotton }, { parent: craft, collide: true })
  for (const dx of [-1, 1]) for (const dz of [-0.3, 0.3]) lcyl(dx, 0, dz, 0.02, 0.72, { color: STEEL }, { parent: craft })
  for (let i = 0; i < 4; i++) lcyl(-0.7 + i * 0.45, 0.76, 0, 0.09, 0.14, { color: ['oklch(0.6 0.15 30)', 'oklch(0.8 0.12 90)', 'oklch(0.5 0.1 150)', 'oklch(0.95 0.01 90)'][i] }, { parent: craft })
  const rack = anchor(-9.4, 0, 6.6, 80)
  for (const dx of [-0.8, 0.8]) lcyl(dx, 0, 0, 0.02, 1.7, { color: STEEL, metal: 0.6 }, { parent: rack })
  lbox(-0.8, 1.68, -0.02, 0.8, 1.72, 0.02, { color: STEEL, metal: 0.6 }, { parent: rack })
  const cloth = ['oklch(0.2 0.01 300)', 'oklch(0.45 0.15 27)', 'oklch(0.5 0.08 150)', 'oklch(0.85 0.02 90)', 'oklch(0.4 0.05 60)']
  cloth.forEach((c, i) => lbox(-0.65 + i * 0.32, 0.7, -0.05, -0.45 + i * 0.32, 1.65, 0.05, { color: c, tex: TEX.cotton }, { parent: rack }))
  sign(-8.6, -3.6, 200)
  sign(9.2, 12.4, 160)
  sign(-16.5, 9.5, 240)
  tag('DIRECTOR', 'DIRECTOR', -13.2, 1.15, -0.2, 15)
  tag('PROTAGONISTA', 'LEAD', 11 - 1.26, 2.7, -1, 90) // rv-1, on its door side
  tag('MAQUILLAJE Y FX', 'MAKEUP & FX', 13, 2.7, 10 - 1.26, 0) // rv-2
  // lot-balloon: the balloon light humming over the lot, the lot's moon
  const b = anchor(0, 9, 10)
  lball(0, 0, 0, 0.9, 0.9, 0.9, { color: 'oklch(0.95 0.03 85)', emissive: 'oklch(0.95 0.05 85)', glow: 2.5 }, { parent: b })
  // (its tether is left out: it hangs right in front of the lot's spawn point and cut the view in two)
  const bl = engine.addEntity()
  Transform.create(bl, { position: sp(0, 8, 10) })
  LightSource.create(bl, { type: LightSource.Type.Point({}), color: c3('oklch(0.95 0.05 85)'), intensity: 40000, range: 30, shadow: false, active: true })

  const where: [WhoId, number, number][] = [['butcher', -14, 2], ['dream', 14, 4], ['ghost', -9, 8], ['girl', -4, 15], ['masked', 9, 9], ['sheriff', 6, 16]]
  for (const [who, x, z] of where) extras.push({ e: character(who, x, z, 180), x, z, to: null, rest: 1 + Math.random() * 4, walking: false })
  engine.addSystem(wander)
}
