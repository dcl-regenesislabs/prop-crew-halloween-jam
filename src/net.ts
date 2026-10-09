// The client's view of the shared state. The server owns it (server/server.ts); here it is only read, and
// the maker's intentions go out as messages. Spawn's relay did the same job for ctx.place.state.
import { engine, Entity } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { newShift, ShiftState } from './referee'
import { Floor, Hand, Shift, StationState } from './shared/components'
import { room } from './shared/messages'
import { Item, unpackItem } from './shop'

export let myId = ''
let shiftEntity: Entity | null = null
let floorEntity: Entity | null = null
let stationEntity: Record<string, Entity> = {}
let viewRoom = -2 // the room the entities above belong to
let clockOffset = 0 // server clock minus this machine's clock
let lastClock = 0
let clockSeenAt = 0 // this machine's time when the server's clock last changed: its heartbeat as seen from here
let started = 0

export function initNet() {
  engine.addSystem((dt) => {
    started += dt
    if (!myId) myId = (getPlayer()?.userId ?? '').toLowerCase()
    // the server's clock ticks in every room's Shift: any of them tells the time and that the server is awake
    for (const [, s] of engine.getEntitiesWith(Shift)) {
      const c = Number(s.clock)
      if (c && c > lastClock) {
        lastClock = c
        clockOffset = c - Date.now()
        clockSeenAt = Date.now()
      }
    }
    // my room's shift, floor and stations (there is one set per room)
    const k = myRoom()
    if (k !== viewRoom) {
      viewRoom = k
      shiftEntity = null
      floorEntity = null
      stationEntity = {}
    }
    if (k < 0) return
    if (shiftEntity === null) for (const [e, s] of engine.getEntitiesWith(Shift)) if (s.room === k) shiftEntity = e
    if (floorEntity === null) for (const [e, f] of engine.getEntitiesWith(Floor)) if (f.room === k) floorEntity = e
    for (const [e, s] of engine.getEntitiesWith(StationState)) if (s.room === k && stationEntity[s.id] !== e) stationEntity[s.id] = e
  })
}

// The server sleeps when nobody is around and takes a while to wake (about 15 s once published). Its clock
// ticks every second; it counts as awake only while this client keeps seeing that clock change.
export const serverAwake = () => clockSeenAt > 0 && Date.now() - clockSeenAt < 5000
export const waitedFor = () => started
// the shared clock every time in the shift is written in (Spawn's ctx.now())
export const now = () => Date.now() + clockOffset

// --- the shift ------------------------------------------------------------------------------------------
let shiftCache = { raw: '', value: newShift() }
const idle = newShift() // on the lot there is no shift to look at
export function shift(): ShiftState {
  if (shiftEntity === null) return idle
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

// --- stations -------------------------------------------------------------------------------------------
export const stationItem = (id: string): Item | null => (stationEntity[id] !== undefined ? unpackItem(StationState.get(stationEntity[id]).item) : null)
export const stationProg = (id: string) => (stationEntity[id] !== undefined ? StationState.get(stationEntity[id]).prog : 0)

// --- the floor ------------------------------------------------------------------------------------------
export type Loose = { id: string; it: Item; x: number; z: number; yaw: number }
let floorCache = { raw: '', value: [] as Loose[] }
export function floor(): Loose[] {
  if (floorEntity === null) return []
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

// --- hands ----------------------------------------------------------------------------------------------
export function hands() {
  const out: { userId: string; held: Item | null; room: number }[] = []
  for (const [, h] of engine.getEntitiesWith(Hand)) if (h.userId) out.push({ userId: h.userId, held: unpackItem(h.held), room: h.room })
  return out
}
export const myHeld = (): Item | null => hands().find((h) => h.userId === myId)?.held ?? null
// the room the server put me in, -1 on the lot
export function myRoom(): number {
  if (!myId) return -1
  for (const [, h] of engine.getEntitiesWith(Hand)) if (h.userId === myId) return h.room
  return -1
}

// --- intentions -----------------------------------------------------------------------------------------
const canSend = () => isStateSyncronized()
export const sendUse = (station: string) => canSend() && room.send('use', { station })
export const sendWork = (station: string, on: boolean) => canSend() && room.send('work', { station, on })
export const sendPick = (id: string) => canSend() && room.send('pick', { id })
export const sendDrop = (x: number, z: number, yaw: number, station: string) => canSend() && room.send('drop', { x, z, yaw, station })
export const sendStart = () => canSend() && room.send('start', {})
export const sendEnter = () => canSend() && room.send('enter', {})
export const sendLeave = () => canSend() && room.send('leave', {})
