// Multiplayer, Spawn-style. Spawn's relay seats one client to run sim.js and keeps ctx.place.state for
// everyone; here the shift lives in one synced row, each station and the floor in theirs, each player
// carries a synced card (what Spawn kept in player.state), and the referee is the client with the lowest
// userId among the cards. Same model as the skill's reference port (examples/fuera-de-la-realidad/src/net.ts).
import { engine, Entity, Schemas } from '@dcl/sdk/ecs'
import { MessageBus } from '@dcl/sdk/message-bus'
import { isStateSyncronized, syncEntity } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { newShift, ShiftState } from './referee'
import { Item, packItem, STATIONS, unpackItem } from './shop'

// ctx.place.state: the whole shift as one JSON string (small: two orders, two customers), plus the host's clock
export const Shift = engine.defineComponent('galpon::Shift', {
  data: Schemas.String,
  clock: Schemas.Int64
})
// a station object's state: what lies on it and its grinder/pump bar
export const StationState = engine.defineComponent('galpon::Station', {
  item: Schemas.String,
  prog: Schemas.Float
})
// thrown props resting on the floor (Spawn: objects tagged "loose")
export const Floor = engine.defineComponent('galpon::Floor', {
  data: Schemas.String
})
// player.state: what the others and the referee need to know about one maker
export const Card = engine.defineComponent('galpon::Card', {
  userId: Schemas.String,
  name: Schemas.String,
  held: Schemas.String,
  inside: Schemas.Boolean,
  startReq: Schemas.Int, // ¡ACCIÓN!: a number above the shift's rungAt asks the referee to start
  serve: Schemas.String // the customer this maker just handed the right prop to
})

enum SyncId {
  SHIFT = 1,
  FLOOR = 2,
  STATION0 = 100
}

export let shiftEntity: Entity
export let floorEntity: Entity
export const stationEntities: Record<string, Entity> = {}
export let myCard: Entity | null = null
export let myId = ''
export const bus = new MessageBus()

let started = 0
let clockOffset = 0 // host clock minus this machine's clock
let lastClock = 0

export function initNet() {
  shiftEntity = engine.addEntity()
  Shift.create(shiftEntity, { data: JSON.stringify(newShift()), clock: 0 })
  syncEntity(shiftEntity, [Shift.componentId], SyncId.SHIFT)
  floorEntity = engine.addEntity()
  Floor.create(floorEntity, { data: '[]' })
  syncEntity(floorEntity, [Floor.componentId], SyncId.FLOOR)
  STATIONS.forEach((s, i) => {
    const e = engine.addEntity()
    StationState.create(e, { item: '', prog: 0 })
    syncEntity(e, [StationState.componentId], SyncId.STATION0 + i)
    stationEntities[s.id] = e
  })
  engine.addSystem((dt) => {
    started += dt
    // follow the host's clock: every time its stamp changes, re-measure the offset
    const c = Shift.get(shiftEntity).clock
    if (c && c !== lastClock) {
      lastClock = c
      if (!isHost()) clockOffset = c - Date.now()
    }
    if (myCard) return
    const p = getPlayer()
    // no player row after a while (a headless client): play as an anonymous local body
    if (!p && started < 8) return
    if (!ready()) return
    myId = p?.userId ?? 'solo-' + ((Math.random() * 1e9) | 0).toString(36)
    myCard = engine.addEntity()
    Card.create(myCard, { userId: myId, name: p?.name || 'alguien', held: '', inside: false, startReq: 0, serve: '' })
    syncEntity(myCard, [Card.componentId])
  })
}

// Writes wait for the room's state to arrive; alone in a preview that may never be reported, so after a
// few seconds the scene goes ahead on its own.
export function ready() {
  return isStateSyncronized() || started > 6
}

// the shared clock every time in the shift is written in (Spawn's ctx.now())
export const now = () => Date.now() + clockOffset
export function stampClock() {
  const t = now()
  if (Math.abs(t - Number(Shift.get(shiftEntity).clock)) > 900) Shift.getMutable(shiftEntity).clock = t
}

// --- the shift ------------------------------------------------------------------------------------------
let shiftCache = { raw: '', value: newShift() }
export function shift(): ShiftState {
  const raw = Shift.get(shiftEntity).data
  if (raw !== shiftCache.raw) {
    try {
      shiftCache = { raw, value: JSON.parse(raw) as ShiftState }
    } catch (e) {
      shiftCache = { raw, value: newShift() }
    }
  }
  return shiftCache.value
}
export function writeShift(P: ShiftState) {
  const raw = JSON.stringify(P)
  shiftCache = { raw, value: JSON.parse(raw) as ShiftState }
  Shift.getMutable(shiftEntity).data = raw
}

// --- stations -------------------------------------------------------------------------------------------
export const stationItem = (id: string): Item | null => unpackItem(StationState.get(stationEntities[id]).item)
export const stationProg = (id: string) => StationState.get(stationEntities[id]).prog
export function setStation(id: string, item: Item | null, prog = 0) {
  const s = StationState.getMutable(stationEntities[id])
  s.item = packItem(item)
  s.prog = prog
}
export function setStationProg(id: string, prog: number) {
  if (StationState.get(stationEntities[id]).prog !== prog) StationState.getMutable(stationEntities[id]).prog = prog
}

// --- the floor ------------------------------------------------------------------------------------------
export type Loose = { id: string; it: Item; x: number; z: number; yaw: number }
let floorCache = { raw: '', value: [] as Loose[] }
export function floor(): Loose[] {
  const raw = Floor.get(floorEntity).data
  if (raw !== floorCache.raw) {
    try {
      floorCache = { raw, value: JSON.parse(raw) as Loose[] }
    } catch (e) {
      floorCache = { raw, value: [] }
    }
  }
  return floorCache.value
}
export function writeFloor(list: Loose[]) {
  Floor.getMutable(floorEntity).data = JSON.stringify(list)
}

// --- cards ----------------------------------------------------------------------------------------------
export function cards() {
  const out: { e: Entity; c: ReturnType<typeof Card.get> }[] = []
  for (const [e, c] of engine.getEntitiesWith(Card)) if (c.userId) out.push({ e, c })
  return out
}
export const me = () => (myCard ? Card.get(myCard) : null)
export const meMut = () => (myCard ? Card.getMutable(myCard) : null)

// the referee: lowest userId among the cards present
export function isHost() {
  if (!myId) return false
  let low = myId
  for (const { c } of cards()) if (c.userId < low) low = c.userId
  return low === myId
}
