// Geometry helpers: Spawn draws its shell from code (ctx.quad, lathes); SDK7 has no procedural mesh, so the
// same shapes become boxes, cylinders and spheres. Colours stay in OKLCH like the original and are converted here.
import {
  ColliderLayer,
  engine,
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  TextureWrapMode,
  Transform
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

// --- colour -------------------------------------------------------------------------------------------
function srgb(x: number) {
  const v = Math.max(0, Math.min(1, x))
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}
const cache = new Map<string, { r: number; g: number; b: number; a: number }>()
// "oklch(L C h / a)" or "#rrggbb"
export function col(css: string) {
  const hit = cache.get(css)
  if (hit) return hit
  let out = { r: 1, g: 1, b: 1, a: 1 }
  if (css.startsWith('#')) {
    const h = css.slice(1)
    out = { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 }
  } else {
    const m = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/)
    if (m) {
      const L = +m[1]
      const C = +m[2]
      const hr = (+m[3] * Math.PI) / 180
      const a = C * Math.cos(hr)
      const b = C * Math.sin(hr)
      const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
      const mm = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
      const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
      out = {
        r: srgb(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
        g: srgb(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
        b: srgb(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
        a: m[4] ? +m[4] : 1
      }
    }
  }
  cache.set(css, out)
  return out
}
export const c4 = (css: string) => {
  const c = col(css)
  return Color4.create(c.r, c.g, c.b, c.a)
}
export const c3 = (css: string) => {
  const c = col(css)
  return Color3.create(c.r, c.g, c.b)
}

// --- materials ----------------------------------------------------------------------------------------
export type Mat = {
  color?: string
  tex?: string
  tile?: [number, number]
  rough?: number
  metal?: number
  emissive?: string
  glow?: number
  alpha?: boolean
}
export function setMat(e: Entity, m: Mat) {
  const a = m.color ? col(m.color).a : 1
  Material.setPbrMaterial(e, {
    albedoColor: m.color ? c4(m.color) : Color4.White(),
    texture: m.tex
      ? Material.Texture.Common({
          src: m.tex,
          wrapMode: TextureWrapMode.TWM_REPEAT,
          tiling: m.tile ? { x: m.tile[0], y: m.tile[1] } : undefined
        })
      : undefined,
    roughness: m.rough ?? 0.9,
    metallic: m.metal ?? 0,
    emissiveColor: m.emissive ? c3(m.emissive) : undefined,
    emissiveIntensity: m.emissive ? m.glow ?? 1 : undefined,
    transparencyMode: m.alpha || a < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : undefined
  })
}

// --- a group of entities that die together (one level, one hallucination) -------------------------------
export class Group {
  list: Entity[] = []
  add(e: Entity) {
    this.list.push(e)
    return e
  }
  clear() {
    for (const e of this.list) engine.removeEntity(e)
    this.list = []
  }
}

type Opt = { parent?: Entity; collide?: boolean; group?: Group; rot?: Quaternion }

// an axis-aligned box from corner to corner, in the parent's space
export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: Mat | null, o: Opt = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  Transform.create(e, {
    parent: o.parent,
    position: Vector3.create((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    scale: Vector3.create(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
    rotation: o.rot ?? Quaternion.Identity()
  })
  if (m) {
    MeshRenderer.setBox(e)
    setMat(e, m)
  }
  if (o.collide) MeshCollider.setBox(e, ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER)
  return e
}

// a centred box of a size, rotated
export function cbox(p: Vector3, size: Vector3, m: Mat | null, o: Opt = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  Transform.create(e, { parent: o.parent, position: p, scale: size, rotation: o.rot ?? Quaternion.Identity() })
  if (m) {
    MeshRenderer.setBox(e)
    setMat(e, m)
  }
  if (o.collide) MeshCollider.setBox(e, ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER)
  return e
}

// a limb from a to b: a cylinder (unit height, radius 0.5 by default) stretched along the segment
export function tube(a: number[], b: number[], r0: number, r1: number, m: Mat, o: Opt = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  const d = Vector3.create(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const len = Vector3.length(d) || 0.001
  Transform.create(e, {
    parent: o.parent,
    position: Vector3.create((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
    rotation: Quaternion.fromToRotation(Vector3.Up(), Vector3.normalize(d)),
    scale: Vector3.create(1, len, 1)
  })
  MeshRenderer.setCylinder(e, r0, r1)
  setMat(e, m)
  return e
}

export function blob(c: number[], rx: number, ry: number, rz: number, m: Mat, o: Opt = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  Transform.create(e, { parent: o.parent, position: Vector3.create(c[0], c[1], c[2]), scale: Vector3.create(rx * 2, ry * 2, rz * 2) })
  MeshRenderer.setSphere(e)
  setMat(e, m)
  return e
}

export const yawQ = (deg: number) => Quaternion.fromEulerDegrees(0, deg, 0)

// --- Spawn space → scene space --------------------------------------------------------------------------
// Spawn is right-handed with -Z as "front"; Decentraland is left-handed. Flipping Z keeps the lot unmirrored:
// a Spawn point (x, y, z) lands at (ORIGIN.x + x, y, ORIGIN.z - z); a Spawn yaw θ becomes a scene yaw of -θ,
// which leaves a prop's Spawn front (-Z) on the entity's local +Z; and a Spawn-local (x, y, z) is the scene-local (x, y, -z).
import { ORIGIN } from './config'
export const sp = (x: number, y: number, z: number) => Vector3.create(ORIGIN.x + x, y, ORIGIN.z - z)
export const yaw = (deg: number) => Quaternion.fromEulerDegrees(0, -deg, 0)

// an empty entity standing at a Spawn position with a Spawn yaw; build children under it with the l* helpers
export function anchor(x: number, y: number, z: number, yawDeg = 0, o: { parent?: Entity; group?: Group; scale?: number } = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  Transform.create(e, {
    parent: o.parent,
    position: o.parent ? Vector3.create(x, y, -z) : sp(x, y, z),
    rotation: yaw(yawDeg),
    scale: Vector3.create(o.scale ?? 1, o.scale ?? 1, o.scale ?? 1)
  })
  return e
}
// a box from corner to corner in Spawn-local coordinates
export const lbox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: Mat | null, o: Opt = {}) =>
  box(x0, y0, -z1, x1, y1, -z0, m, o)
// an upright cylinder standing on (cx, y0, cz), Spawn-local
export function lcyl(cx: number, y0: number, cz: number, r: number, h: number, m: Mat, o: Opt & { top?: number } = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  Transform.create(e, { parent: o.parent, position: Vector3.create(cx, y0 + h / 2, -cz), scale: Vector3.create(r * 2, h, r * 2) })
  MeshRenderer.setCylinder(e, 0.5, o.top === undefined ? 0.5 : o.top / (r * 2))
  setMat(e, m)
  if (o.collide) MeshCollider.setCylinder(e, 0.5, 0.5, ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER)
  return e
}
// a cylinder lying along local X from x0, centred on (cy, cz), Spawn-local
export function lcylX(x0: number, cy: number, cz: number, r: number, len: number, m: Mat, o: Opt = {}) {
  const e = engine.addEntity()
  o.group?.add(e)
  Transform.create(e, {
    parent: o.parent,
    position: Vector3.create(x0 + len / 2, cy, -cz),
    rotation: Quaternion.fromEulerDegrees(0, 0, 90),
    scale: Vector3.create(r * 2, len, r * 2)
  })
  MeshRenderer.setCylinder(e, 0.5, 0.5)
  setMat(e, m)
  return e
}
export function lball(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, m: Mat, o: Opt = {}) {
  return blob([cx, cy, -cz], rx, ry, rz, m, o)
}

// --- room space -------------------------------------------------------------------------------------------------
// The working shed is not on the lot: each room is a copy stacked above it (shared/rooms.ts), and a client only
// builds the one it is in. Everything of that room hangs from one root entity, placed at the room's height;
// children use room-local coordinates (rl), which are Spawn coordinates with Z flipped.
let roomRootEntity: Entity | null = null
export let roomY = 0
export function roomRoot(): Entity {
  if (roomRootEntity === null) {
    roomRootEntity = engine.addEntity()
    Transform.create(roomRootEntity, { position: sp(0, -300, 0) }) // out of sight until a room is entered
  }
  return roomRootEntity
}
export function setRoomHeight(y: number) {
  roomY = y
  Transform.getMutable(roomRoot()).position = sp(0, y, 0)
}
export const rl = (x: number, y: number, z: number) => Vector3.create(x, y, -z)
