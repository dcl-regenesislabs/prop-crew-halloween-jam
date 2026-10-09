// Every prop the shed makes, lying on its feet; long axis along X, handle at -X.
// Ported from scripts/gen/prop.js. Spawn builds these as scripted meshes (slabs, lathes); here each is a
// handful of boxes, cylinders and spheres with the same sizes and colours. The look follows the item data:
// parts added (p), sharpened (s), bloodied (b), fuelled (g).
import { engine, Entity, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { Group, lball, lbox, lcyl, lcylX, Mat } from './gfx'
import { Item, itemKey } from './shop'

const STEEL = 'oklch(0.86 0.01 250)'
const BLACK = 'oklch(0.2 0.01 260)'
const BLOOD = 'oklch(0.42 0.2 25)'
const has = (it: Item, p: string) => (it.p ?? []).includes(p)

function blade(it: Item, x0: number, len: number, wid: number, o: { parent: Entity; group: Group }) {
  lbox(x0 - 0.17, 0, -0.022, x0, 0.04, 0.022, { color: BLACK, rough: 0.6 }, o) // handle
  lbox(x0, 0.002, -0.032, x0 + 0.02, 0.038, 0.032, { color: STEEL, metal: 0.9, rough: 0.3 }, o) // guard
  // the blade: spine straight at -z, edge toward +z
  const m: Mat = it.s
    ? { color: 'oklch(0.93 0.01 240)', metal: 0.9, rough: 0.12, emissive: 'oklch(0.55 0.03 230)', glow: 0.6 }
    : { color: 'oklch(0.72 0.01 250)', metal: 0.9, rough: 0.45 }
  lbox(x0 + 0.02, 0.012, -0.025, x0 + len * 0.85, 0.022, wid, m, o)
  lbox(x0 + len * 0.85, 0.012, -0.025, x0 + len, 0.022, wid * 0.55, m, o) // the tip narrows
  if (it.b) {
    lbox(x0 + len * 0.3, 0.023, -0.015, x0 + len * 0.9, 0.027, wid * 0.7, { color: BLOOD, rough: 0.15 }, o)
    lbox(x0 + len * 0.45, 0.004, wid * 0.7, x0 + len * 0.5, 0.027, wid * 0.7 + 0.012, { color: BLOOD, rough: 0.15 }, o)
  }
}
function saw(it: Item, o: { parent: Entity; group: Group }) {
  lbox(-0.24, 0, -0.1, 0.06, 0.2, 0.1, { color: 'oklch(0.62 0.19 42)', rough: 0.5 }, o) // body
  lbox(-0.22, 0.2, -0.08, 0.02, 0.24, 0.08, { color: 'oklch(0.3 0.02 250)' }, o) // engine cover
  // top handle loop and rear grip
  lbox(-0.18, 0.24, -0.015, -0.15, 0.34, 0.015, { color: BLACK }, o)
  lbox(0.0, 0.24, -0.015, 0.03, 0.34, 0.015, { color: BLACK }, o)
  lbox(-0.18, 0.31, -0.015, 0.03, 0.34, 0.015, { color: BLACK }, o)
  lbox(-0.36, 0.06, -0.025, -0.24, 0.12, 0.025, { color: BLACK }, o)
  // fuel window
  lbox(-0.12, 0.05, 0.1, -0.02, 0.1, 0.104, it.g ? { color: 'oklch(0.8 0.16 80)', emissive: 'oklch(0.7 0.16 80)', glow: 1.5 } : { color: 'oklch(0.25 0.02 60)' }, o)
  // guide bar
  lbox(0.06, 0.08, -0.045, 0.56, 0.1, 0.045, { color: 'oklch(0.6 0.01 250)', metal: 0.7, rough: 0.35 }, o)
  if (has(it, 'chain')) {
    const c: Mat = { color: 'oklch(0.32 0.01 250)', metal: 0.8, rough: 0.3 }
    lbox(0.08, 0.075, -0.06, 0.55, 0.105, -0.045, c, o)
    lbox(0.08, 0.075, 0.045, 0.55, 0.105, 0.06, c, o)
    lbox(0.55, 0.075, -0.06, 0.575, 0.105, 0.06, c, o)
  }
}
function torch(it: Item, o: { parent: Entity; group: Group }) {
  const bulb = has(it, 'bulb')
  const bat = has(it, 'battery')
  lcylX(-0.2, 0.05, 0, 0.045, 0.3, { color: 'oklch(0.8 0.16 92)', rough: 0.4 }, o)
  lcylX(0.1, 0.05, 0, 0.07, 0.1, { color: BLACK }, o) // head
  lcylX(-0.22, 0.05, 0, 0.047, 0.03, { color: 'oklch(0.25 0.01 260)' }, o) // tail cap
  lcylX(0.2, 0.05, 0, 0.066, 0.006, bulb && bat ? { color: 'oklch(0.98 0.05 95)', emissive: 'oklch(0.98 0.06 95)', glow: 3 } : { color: bulb ? 'oklch(0.9 0.03 90)' : 'oklch(0.35 0.02 260)' }, o)
  if (bat) lbox(-0.13, 0.093, -0.008, -0.115, 0.1, 0.008, { color: 'oklch(0.75 0.2 145)', emissive: 'oklch(0.75 0.2 145)', glow: 2 }, o)
}
function walkie(it: Item, o: { parent: Entity; group: Group }) {
  const bat = has(it, 'battery')
  lbox(-0.13, 0, -0.065, 0.11, 0.055, 0.065, { color: 'oklch(0.24 0.01 260)', rough: 0.6 }, o)
  lbox(-0.1, 0.055, -0.04, 0.03, 0.058, 0.04, { color: 'oklch(0.15 0.01 260)' }, o) // grille
  lcylX(0.11, 0.03, -0.035, 0.016, 0.03, { color: BLACK }, o) // knob
  if (has(it, 'antenna')) {
    lcylX(0.11, 0.03, 0.045, 0.014, 0.04, { color: BLACK }, o)
    lcylX(0.15, 0.03, 0.045, 0.009, 0.2, { color: BLACK }, o)
  }
  lbox(0.07, 0.055, 0.035, 0.09, 0.06, 0.05, bat ? { color: 'oklch(0.65 0.22 30)', emissive: 'oklch(0.65 0.22 30)', glow: 2 } : { color: 'oklch(0.3 0.03 30)' }, o)
}
function glove(it: Item, o: { parent: Entity; group: Group }) {
  const leather: Mat = { color: 'oklch(0.4 0.07 50)', rough: 0.85 }
  lbox(-0.12, 0, -0.07, 0.06, 0.05, 0.07, leather, o)
  lbox(-0.22, 0.002, -0.075, -0.12, 0.048, 0.075, { color: 'oklch(0.3 0.05 45)', rough: 0.85 }, o) // cuff
  const fz = [-0.05, -0.017, 0.017, 0.05]
  fz.forEach((z, i) => lbox(0.06, 0.008, z - 0.014, 0.17 - Math.abs(i - 1.5) * 0.02, 0.04, z + 0.014, leather, o))
  lbox(-0.06, 0.01, 0.07, 0.02, 0.04, 0.1, leather, o) // thumb
  lbox(-0.1, 0.05, -0.06, 0.055, 0.056, 0.06, { color: 'oklch(0.6 0.02 70)', metal: 0.6 }, o) // brass straps
  if (has(it, 'blades')) {
    const m: Mat = it.s ? { color: STEEL, metal: 0.9, rough: 0.15, emissive: 'oklch(0.45 0.02 240)', glow: 0.6 } : { color: 'oklch(0.68 0.01 250)', metal: 0.9, rough: 0.45 }
    fz.forEach((z) => lbox(0.1, 0.044, z - 0.008, 0.44, 0.05, z + 0.008, m, o))
  }
}
function part(it: Item, o: { parent: Entity; group: Group }) {
  const k = it.k
  if (k === 'chain') {
    const c: Mat = { color: 'oklch(0.32 0.01 250)', metal: 0.8, rough: 0.3 }
    lbox(-0.17, 0, -0.09, 0.17, 0.02, -0.07, c, o)
    lbox(-0.17, 0, 0.07, 0.17, 0.02, 0.09, c, o)
    lbox(-0.19, 0, -0.09, -0.17, 0.02, 0.09, c, o)
    lbox(0.17, 0, -0.09, 0.19, 0.02, 0.09, c, o)
  } else if (k === 'bulb') {
    lcyl(0, 0, 0, 0.032, 0.05, { color: 'oklch(0.75 0.1 85)', metal: 0.8, rough: 0.3 }, o)
    lball(0, 0.115, 0, 0.065, 0.07, 0.065, { color: 'oklch(0.95 0.02 90)', rough: 0.05 }, o)
  } else if (k === 'battery') {
    for (const z of [-0.03, 0.03]) {
      lcylX(-0.07, 0.026, z, 0.026, 0.11, { color: BLACK }, o)
      lcylX(0.04, 0.026, z, 0.026, 0.03, { color: 'oklch(0.55 0.2 28)' }, o)
    }
  } else if (k === 'antenna') {
    lcylX(-0.12, 0.016, 0, 0.016, 0.05, { color: BLACK }, o)
    lcylX(-0.07, 0.016, 0, 0.01, 0.2, { color: BLACK }, o)
  } else if (k === 'blades') {
    const m: Mat = it.s ? { color: 'oklch(0.95 0.01 240)', metal: 0.9, rough: 0.1, emissive: 'oklch(0.5 0.02 240)', glow: 0.6 } : { color: 'oklch(0.7 0.01 250)', metal: 0.9, rough: 0.45 }
    for (const z of [-0.06, -0.02, 0.02, 0.06]) lbox(-0.16, 0, z - 0.01, 0.18, 0.008, z + 0.01, m, o)
  } else {
    // scrap, or anything unknown: a dark lump
    lbox(-0.12, 0, -0.08, 0.12, 0.08, 0.08, { color: 'oklch(0.18 0.01 50)' }, o)
    lbox(-0.05, 0.05, -0.04, 0.14, 0.12, 0.06, { color: 'oklch(0.35 0.08 45)' }, o)
  }
}

function build(it: Item, o: { parent: Entity; group: Group }) {
  if (it.k === 'knife') return blade(it, -0.06, 0.3, 0.035, o)
  if (it.k === 'machete') return blade(it, -0.18, 0.5, 0.065, o)
  if (it.k === 'saw') return saw(it, o)
  if (it.k === 'torch') return torch(it, o)
  if (it.k === 'walkie') return walkie(it, o)
  if (it.k === 'glove') return glove(it, o)
  return part(it, o)
}

// A slot that shows one item (or nothing) and rebuilds only when the item changes: a station's top, a hand,
// a prop on the floor. Spawn's showItem(ctx, visId, item).
export class PropSlot {
  root: Entity
  private group = new Group()
  private key = ''
  constructor(root: Entity) {
    this.root = root
  }
  show(it: Item | null) {
    const k = itemKey(it)
    if (k === this.key) return
    this.key = k
    this.group.clear()
    if (it) build(it, { parent: this.root, group: this.group })
  }
  destroy() {
    this.group.clear()
    engine.removeEntity(this.root)
  }
}

export function slotAt(parent: Entity | undefined, pos: Vector3, rot: Quaternion, scale: number) {
  const e = engine.addEntity()
  Transform.create(e, { parent, position: pos, rotation: rot, scale: Vector3.create(scale, scale, scale) })
  return new PropSlot(e)
}

export function setVisible(e: Entity, on: boolean) {
  const v = VisibilityComponent.getOrNull(e)
  if (!v) VisibilityComponent.create(e, { visible: on })
  else if (v.visible !== on) VisibilityComponent.getMutable(e).visible = on
}
