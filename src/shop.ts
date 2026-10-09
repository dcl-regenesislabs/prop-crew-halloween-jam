// The prop shed's layout and its rules, shared by the maker (player), the referee and the HUD.
// Ported from scripts/lib/shop.js. Pure logic: no engine imports, so the Node tests can load it.
import { DishId, S } from './config'

// one thing in the hands: k kind, p parts added, s sharpened, b bloodied, g fuelled
export type Item = { k: string; p?: string[]; s?: number; b?: number; g?: number }
export type StationKind = 'supply' | 'counter' | 'window' | 'grinder' | 'pump' | 'bucket' | 'trash'
export type Station = { id: string; kind: StationKind; x: number; z: number; yaw: number }

const XS = [-5.4, -4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2, 5.4]
const ZB = -3.4 // the back row (@sebadl: one tile deeper each way)
const ZF = 3.4 // the front row
export const STATIONS: Station[] = []
const kindOf = (id: string): StationKind =>
  /^(rack|bin)-/.test(id) ? 'supply' : id.startsWith('ctr') ? 'counter' : id.startsWith('win') ? 'window' : (id.replace(/-\d+$/, '') as StationKind)
const add = (id: string, x: number, z: number, yaw: number) => STATIONS.push({ id, kind: kindOf(id), x, z, yaw })
// back row: the two customer windows in the middle (customers stand outside, facing the camera), racks either
// side, a spare bench in each corner. Every base is far from its parts (@sebadl)
;['ctr-1', 'rack-glove', 'rack-knife', 'rack-walkie', 'win-1', 'win-2', 'rack-saw', 'rack-torch', 'rack-machete', 'ctr-2'].forEach((id, i) =>
  add(id, XS[i], ZB, 180)
)
// left wall: the parts crates, spread out
;['bin-chain', 'bin-bulb', 'bin-battery'].forEach((id, i) => add(id, -5.4, [-1.5, 0, 1.5][i], -90))
// right wall: antennas and claws
;['bin-antenna', 'bin-blades'].forEach((id, i) => add(id, 5.75, [-0.75, 0.75][i], 90))
// front row (nearest the camera): benches, the grinder, the gas pump, the blood bucket, the trash beside the door
;['ctr-5', 'ctr-6', 'grinder-1', 'ctr-7', 'pump-1', 'ctr-8', 'bucket-1', 'ctr-9', 'trash'].forEach((id, i) => add(id, XS[i], ZF, 0))

export const BY_ID: Record<string, Station> = {}
for (const s of STATIONS) BY_ID[s.id] = s
export const WINDOWS = ['win-1', 'win-2']
export const GIVES = (id: string) => (/^(rack|bin)-/.test(id) ? id.split('-')[1] : null)

// how each prop is made, as icons for the ticket
export const STEPS: Record<DishId, string[]> = {
  knife: ['knifebare', 'grinder', 'paint'],
  machete: ['machetebare', 'grinder', 'paint'],
  chainsaw: ['sawbare', 'chain', 'gas'],
  flashlight: ['torchbare', 'bulb', 'battery'],
  walkie: ['walkiebare', 'antenna', 'battery'],
  glove: ['glovebare', 'blades', 'grinder']
}

const BY_BASE: Record<string, { dish: DishId; parts: string[]; sharp?: boolean; blood?: boolean; gas?: boolean }> = {}
for (const d of Object.keys(S.dishes) as DishId[]) BY_BASE[S.dishes[d].base] = { dish: d, ...S.dishes[d] }

export const isBase = (it: Item | null) => !!it && !!BY_BASE[it.k]
// the glove sharpens once its blades are on (ticket: glove → blades → grinder); loose blades sharpen too
export const sharpenable = (it: Item | null) =>
  !!it && !it.s && (it.k === 'knife' || it.k === 'machete' || it.k === 'blades' || (it.k === 'glove' && (it.p ?? []).includes('blades')))
export const dippable = (it: Item | null) => !!it && (it.k === 'knife' || it.k === 'machete') && !it.b
export const fillsOn = (it: Item | null) => !!it && it.k === 'saw' && !it.g
// any part joins raw; blades already sharpened carry their edge onto the glove
export const canAdd = (base: Item | null, part: Item | null) =>
  !!base && isBase(base) && !!part && BY_BASE[base.k].parts.includes(part.k) && !(base.p ?? []).includes(part.k)
export const addPart = (base: Item, part: Item): Item => ({
  ...base,
  p: [...(base.p ?? []), part.k],
  ...(part.k === 'blades' && part.s ? { s: 1 } : {})
})
// Two things meeting, in either order: a base and a part of it become the base with the part on. null if they do
// not fit. The one rule behind joining on a bench, with a prop on the floor, and when dropping onto a bench.
export function join(a: Item | null, b: Item | null): Item | null {
  if (!a || !b) return null
  if (canAdd(a, b)) return addPart(a, b)
  if (canAdd(b, a)) return addPart(b, a)
  return null
}
// a finished prop's dish id, or null
export function dishOf(it: Item | null): DishId | null {
  if (!it || !isBase(it)) return null
  const R = BY_BASE[it.k]
  if (R.parts.some((p) => !(it.p ?? []).includes(p))) return null
  if (R.sharp && !it.s) return null
  if (R.blood && !it.b) return null
  if (R.gas && !it.g) return null
  return R.dish
}

// knives, saws, torches clunk down flat; bulbs, batteries, chains, blades take a short tumble (scripts/loose.js)
const BASES = ['knife', 'machete', 'saw', 'torch', 'walkie', 'glove']
export const feelOf = (it: Item | null) => (it && BASES.includes(it.k) ? 'hard' : 'part')
// the station a falling prop is over (scripts/loose.js over())
export const stationUnder = (x: number, z: number) =>
  STATIONS.find((s) => {
    const side = s.yaw === 90 || s.yaw === -90
    return Math.abs(s.x - x) < (side ? 0.42 : 0.6) && Math.abs(s.z - z) < (side ? 0.6 : 0.42)
  }) ?? null

// customers walk the strip behind the shed's back wall (z -4.05) and stand at their window facing in, toward the camera
export const WINDOW_SPOT = (id: string) => ({ x: BY_ID[id].x, z: -4.6 })
export const LINE_SPOT = (i: number) => ({ x: 4.2 + i * 1.1, z: -6.0 })
export const ENTRY = { x: 14, z: -7.7 }
export const EXIT = { x: 14, z: -9.2 }

// The first-order guide (ui.js nextStep): the one station the maker needs next for the most urgent order, and
// what to do there. es/en are the short lines Spawn shows over the bouncing arrow.
const supplyOf = (k: string) => STATIONS.find((s) => s.kind === 'supply' && GIVES(s.id) === k)?.id ?? null
export function nextStep(orders: Record<string, { dish: DishId; until: number }>, h: Item | null, names: (k: string, en: boolean) => string): { id: string; es: string; en: string } | null {
  const ords = Object.entries(orders).sort((a, b) => a[1].until - b[1].until)
  if (!ords.length) return null
  const [win, o] = ords[0]
  const R = S.dishes[o.dish]
  if (!R) return null
  const at = (id: string | null, es: string, en: string) => (id ? { id, es, en } : null)
  if (h && h.k !== R.base) return at('trash', 'tirá eso al tacho', 'toss that in the trash')
  if (!h) return at(supplyOf(R.base), 'agarrá: ' + names(R.base, false), 'grab: ' + names(R.base, true))
  const part = R.parts.find((p) => !(h.p ?? []).includes(p))
  if (part) return at(supplyOf(part), 'sumale: ' + names(part, false), 'add: ' + names(part, true))
  if (R.sharp && !h.s) return at('grinder-1', 'mantené E para afilar', 'hold E to sharpen')
  if (R.blood && !h.b) return at('bucket-1', 'mojalo en la sangre', 'dip it in the blood')
  if (R.gas && !h.g) return at('pump-1', 'mantené E para cargar nafta', 'hold E to fuel up')
  return at(win, '¡entregalo acá!', 'hand it over here!')
}

export const itemKey = (it: Item | null) => (it ? JSON.stringify([it.k, [...(it.p ?? [])].sort(), it.s ? 1 : 0, it.b ? 1 : 0, it.g ? 1 : 0]) : '')
export const packItem = (it: Item | null) => (it ? JSON.stringify(it) : '')
export const unpackItem = (s: string | undefined): Item | null => {
  if (!s) return null
  try {
    return JSON.parse(s) as Item
  } catch (e) {
    return null
  }
}
