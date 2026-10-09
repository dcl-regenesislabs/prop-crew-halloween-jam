// The movie monsters (and victims) who come for their props: each walks to its line spot, to its window, away.
// Ported from scripts/customer.js and the children places/main/sim.js spawns on each one (the order bubble
// and the patience bar). The referee writes where each should go (referee.ts Customer.to); every client walks
// its own copy there at the same speed, so only the destination rides the wire.
import { Animator, Billboard, BillboardMode, engine, Entity, Material, MeshRenderer, TextAlignMode, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { CUSTOMER_SPEED, ICON } from './config'
import { rl, roomRoot, yaw } from './gfx'
import { character, MODEL_YAW_FIX } from './lot'
import { now, shift } from './net'
import { setVisible } from './props'
import { ENTRY } from './shop'

type Body = { id: string; e: Entity; x: number; z: number; anim: string; bub: Entity; bar: Entity; fill: Entity; pct: number; leaving: boolean }
const bodies = new Map<string, Body>()
// leaving customers whose walk out is done; the referee drains this (referee.ts Env.gone)
export const gone: string[] = []

function setAnim(b: Body, a: string) {
  if (b.anim === a) return
  b.anim = a
  Animator.playSingleAnimation(b.e, a)
}

function spawn(id: string, who: any, dish: string): Body {
  const e = character(who, ENTRY.x, ENTRY.z, 180, roomRoot())
  // the order bubble over the head
  const bub = engine.addEntity()
  Transform.create(bub, { parent: e, position: Vector3.create(0, 2.25, 0), scale: Vector3.create(0.55, 0.55, 0.55) })
  MeshRenderer.setPlane(bub)
  Billboard.create(bub, { billboardMode: BillboardMode.BM_ALL })
  Material.setBasicMaterial(bub, { texture: Material.Texture.Common({ src: ICON(dish) }), alphaTest: 0.3 })
  // the patience bar under it, shown once the customer is called to a window
  const bar = engine.addEntity()
  Transform.create(bar, { parent: e, position: Vector3.create(0, 1.9, 0) })
  Billboard.create(bar, { billboardMode: BillboardMode.BM_ALL })
  const bg = engine.addEntity()
  Transform.create(bg, { parent: bar, scale: Vector3.create(0.8, 0.1, 0.01) })
  MeshRenderer.setBox(bg)
  Material.setBasicMaterial(bg, { diffuseColor: Color4.create(0.1, 0.06, 0.12, 1) })
  const fill = engine.addEntity()
  Transform.create(fill, { parent: bar, position: Vector3.create(0, 0, -0.01), scale: Vector3.create(0.76, 0.066, 0.01) })
  MeshRenderer.setBox(fill)
  Material.setBasicMaterial(fill, { diffuseColor: Color4.create(0.48, 0.85, 0.56, 1) })
  setVisible(bg, false)
  setVisible(fill, false)
  return { id, e, x: ENTRY.x, z: ENTRY.z, anim: 'Idle', bub, bar: bg, fill, pct: -1, leaving: false }
}

function remove(b: Body) {
  for (const x of [b.fill, b.bar, b.bub]) engine.removeEntity(x)
  engine.removeEntityWithChildren(b.e)
  bodies.delete(b.id)
}

export function updateCustomers(dt: number) {
  const P = shift()
  const seen = new Set<string>()
  for (const c of P.customers) {
    seen.add(c.id)
    let b = bodies.get(c.id)
    if (!b) {
      b = spawn(c.id, c.who, c.dish)
      bodies.set(c.id, b)
    }
    if (c.leave && !b.leaving) {
      b.leaving = true
      setVisible(b.bub, false)
    }
    // the bar: green, amber, red as patience runs out
    const order = Object.values(P.orders).find((o) => o.cust === c.id)
    const pct = c.bar && order ? Math.round(Math.max(0, (order.until - now()) / order.max) * 100) : -1
    if (pct !== b.pct) {
      b.pct = pct
      setVisible(b.bar, pct >= 0)
      setVisible(b.fill, pct >= 0)
      if (pct >= 0) {
        const t = Transform.getMutable(b.fill)
        t.scale = Vector3.create(0.76 * (pct / 100), 0.066, 0.01)
        t.position = Vector3.create(-0.38 + 0.38 * (pct / 100), 0, -0.01)
        Material.setBasicMaterial(b.fill, { diffuseColor: pct > 50 ? Color4.create(0.48, 0.85, 0.56, 1) : pct > 25 ? Color4.create(0.96, 0.76, 0.47, 1) : Color4.create(0.88, 0.28, 0.23, 1) })
      }
    }
    // walk toward where the referee sent it
    const dx = c.to.x - b.x
    const dz = c.to.z - b.z
    const d = Math.hypot(dx, dz)
    const t = Transform.getMutable(b.e)
    if (d > 0.05) {
      const k = Math.min(1, (CUSTOMER_SPEED * dt) / d)
      b.x += dx * k
      b.z += dz * k
      t.position = rl(b.x, 0, b.z)
      t.rotation = yaw((Math.atan2(-dx, -dz) * 180) / Math.PI + MODEL_YAW_FIX)
      setAnim(b, 'Walk')
      continue
    }
    if (c.leave) {
      if (!gone.includes(c.id)) gone.push(c.id)
      continue
    }
    t.rotation = yaw(180 + MODEL_YAW_FIX) // at the window, facing in, toward the camera
    setAnim(b, 'Idle')
  }
  for (const b of [...bodies.values()]) if (!seen.has(b.id)) remove(b)
}

// "+25" rising over the window, "-10" when one storms off (Spawn's damageNumber event)
const pops: { e: Entity; t: number; y: number; x: number; z: number }[] = []
export function popNumber(text: string, x: number, z: number, color: Color4, size = 1.4, y = 2.6) {
  const e = engine.addEntity()
  Transform.create(e, { parent: roomRoot(), position: rl(x, y, z), scale: Vector3.create(size, size, size) })
  Billboard.create(e, { billboardMode: BillboardMode.BM_ALL })
  TextShape.create(e, { text, fontSize: 5, textColor: color, outlineColor: { r: 0.1, g: 0.06, b: 0.12 }, outlineWidth: 0.2, textAlign: TextAlignMode.TAM_MIDDLE_CENTER })
  pops.push({ e, t: 0, y, x, z })
}
export function updatePops(dt: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]
    p.t += dt
    Transform.getMutable(p.e).position = rl(p.x, p.y + p.t * 0.8, p.z)
    if (p.t > 1.4) {
      engine.removeEntity(p.e)
      pops.splice(i, 1)
    }
  }
}
