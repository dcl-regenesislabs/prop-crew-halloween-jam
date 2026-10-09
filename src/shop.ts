// The prop shed's layout and its rules, shared by the maker (player), the referee and the HUD.
// Ported from scripts/lib/shop.js. Pure logic: no engine imports, so the Node tests can load it.
import { DishId, S } from './config'

// one thing in the hands: k kind, p parts added, s sharpened, b bloodied, g fuelled
export type Item = { k: string; p?: string[]; s?: number; b?: number; g?: number }
export type StationKind = 'supply' | 'counter' | 'window' | 'grinder' | 'pump' | 'bucket' | 'trash'
export type Station = { id: string; kind: StationKind; x: number; z: number; yaw: number }

const XS = [-5.4, -4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2, 5.4]
const ZS = [-1.2, 0, 1.2]
const ZB = -2.2 // the back row
const ZF = 2.2 // the front row
export const STATIONS: Station[] = []
const kindOf = (id: string): StationKind =>
  /^(rack|bin)-/.test(id) ? 'supply' : id.startsWith('ctr') ? 'counter' : id.startsWith('win') ? 'window' : (id.replace(/-\d+$/, '') as StationKind)
const add = (id: string, x: number, z: number, yaw: number) => STATIONS.push({ id, kind: kindOf(id), x, z, yaw })
// back row: the two customer windows in the middle (customers stand outside, facing the camera), racks either side
;[null, 'ctr-1', 'rack-knife', 'rack-machete', 'win-1', 'win-2', 'rack-saw', 'rack-torch', 'rack-walkie', 'ctr-2'].forEach(
  (id, i) => id && add(id, XS[i], ZB, 180)
)
// left wall: the parts crates
;['bin-chain', 'bin-bulb', 'bin-battery'].forEach((id, i) => add(id, -5.4, ZS[i], -90))
// right wall: gloves, the blood bucket, the trash
;['rack-glove', 'bucket-1', 'trash'].forEach((id, i) => add(id, 5.75, ZS[i], 90))
// front row (nearest the camera): benches, the grinder, the gas pump and two crates; the corner past x 4.8 is the door
;['ctr-5', 'ctr-6', 'grinder-1', 'ctr-7', 'pump-1', 'ctr-8', 'bin-antenna', 'bin-blades'].forEach((id, i) => add(id, XS[i], ZF, 0))

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

// customers walk the strip behind the shed's back wall (z -2.85) and stand at their window facing in, toward the camera
export const WINDOW_SPOT = (id: string) => ({ x: BY_ID[id].x, z: -3.4 })
export const LINE_SPOT = (i: number) => ({ x: 4.2 + i * 1.1, z: -4.8 })
export const ENTRY = { x: 14, z: -6.5 }
export const EXIT = { x: 14, z: -8 }

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
