// The headless server: the one authority over every room's shift, stations and floor, and every maker's hands.
// It is Spawn's referee (places/main/sim.js, here referee.ts) plus the half of scripts/maker.js that changes
// shared state, plus Spawn's room routing (scripts/routing.js). Clients send what they try to do
// (shared/messages.ts); every rule is checked here and the result goes out through the synced components.
import { engine, Entity, PlayerIdentityData } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { CUSTOMER_SPEED, NAMES_EN, S } from '../config'
import { Fx, newShift, ShiftState, tick } from '../referee'
import { addPart, BY_ID, canAdd, dippable, dishOf, ENTRY, GIVES, Item, join, packItem, sharpenable, STATIONS, unpackItem } from '../shop'
import { Floor, Hand, Shift, StationState } from '../shared/components'
import { room } from '../shared/messages'
import { pickRoom, ROOMS } from '../shared/rooms'

type Loose = { id: string; it: Item; x: number; z: number; yaw: number }
// one shed: its own shift, benches, floor and customers
type Room = {
  k: number
  shiftEntity: Entity
  floorEntity: Entity
  station: Record<string, Entity>
  P: ShiftState
  floor: Loose[]
  startReq: number
  served: string[]
  // each customer walks on the server too (same speed as on the clients), only to know when one has left
  walkers: Map<string, { x: number; z: number }>
  // who holds the main action at which grinder or pump, when they last said so, and how far the bar is
  working: Map<string, { station: string; at: number; prog: number }>
  refAcc: number
}
const rooms: Room[] = []
let looseSeq = 0

// --- players ----------------------------------------------------------------------------------------------
// Note: in the local preview the server saw no position for players (no Transform on their entities, seen
// 2026-10-09 with the Godot client), so nothing here depends on where a maker stands: being in a room is a
// matter of having asked for the door and been given a place.
const key = (address: string) => address.toLowerCase()
function handOf(address: string): Entity | null {
  for (const [e, h] of engine.getEntitiesWith(Hand)) if (h.userId === key(address)) return e
  return null
}
const heldOf = (e: Entity) => unpackItem(Hand.get(e).held)
function setHeld(e: Entity, it: Item | null) {
  const v = packItem(it)
  if (Hand.get(e).held !== v) Hand.getMutable(e).held = v
}
const roomOf = (address: string): Room | null => {
  const e = handOf(address)
  const k = e ? Hand.get(e).room : -1
  return k >= 0 ? rooms[k] : null
}
function members(k: number): string[] {
  const out: string[] = []
  for (const [, h] of engine.getEntitiesWith(Hand)) if (h.room === k) out.push(h.userId)
  return out
}
function setRoom(e: Entity, k: number) {
  const h = Hand.getMutable(e)
  if (h.room >= 0) rooms[h.room].working.delete(h.userId)
  h.room = k
  h.held = '' // hands are empty on the way in and on the way out
}
// one Hand per connected player; gone (and its place in a room freed) when they leave
function syncHands() {
  const seen = new Set<string>()
  // the server shows up in its own player list (seen in the local preview): it is not a maker
  const self = key(PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address ?? '')
  for (const [, id] of engine.getEntitiesWith(PlayerIdentityData)) {
    const k = key(id.address)
    if (!k || k === self) continue
    seen.add(k)
    if (!handOf(k)) {
      const e = engine.addEntity()
      Hand.create(e, { userId: k, held: '', room: -1 })
      syncEntity(e, [Hand.componentId]) // no explicit id: a reconnect can never collide
      console.log('[SERVER] maker joined', k)
    }
  }
  const first = new Set<string>()
  for (const [e, h] of engine.getEntitiesWith(Hand)) {
    if (!seen.has(h.userId) || first.has(h.userId)) {
      if (h.room >= 0) rooms[h.room].working.delete(h.userId)
      console.log('[SERVER] maker left', h.userId)
      engine.removeEntity(e)
    } else first.add(h.userId)
  }
}

// --- one room's shared state -----------------------------------------------------------------------------------
const stationItem = (R: Room, id: string) => unpackItem(StationState.get(R.station[id]).item)
function setStation(R: Room, id: string, item: Item | null, prog = 0) {
  const s = StationState.getMutable(R.station[id])
  s.item = packItem(item)
  s.prog = prog
}
function setProg(R: Room, id: string, prog: number) {
  if (StationState.get(R.station[id]).prog !== prog) StationState.getMutable(R.station[id]).prog = prog
}
const writeFloor = (R: Room) => (Floor.getMutable(R.floorEntity).data = JSON.stringify(R.floor))
const writeShift = (R: Room) => (Shift.getMutable(R.shiftEntity).data = JSON.stringify(R.P))
// sounds and pop-ups go only to the makers of that room
const snd = (R: Room, n: string, at: { x: number; z: number }, y = 1) => {
  const to = members(R.k)
  if (to.length) room.send('snd', { n, x: at.x, y, z: at.z }, { to })
}
const pop = (R: Room, text: string, at: { x: number; z: number }, good: boolean) => {
  const to = members(R.k)
  if (to.length) room.send('pop', { text, x: at.x, z: at.z, good }, { to })
}
const crate = (R: Room, station: string, k: string) => {
  const to = members(R.k)
  if (to.length) room.send('crate', { station, k }, { to })
}
const nameOf = (k: string, en: boolean) => (en ? NAMES_EN[k] : S.names[k]) ?? k
function nope(to: string, es: string, en: string) {
  room.send('hint', { es, en }, { to: [to] })
}

// --- the main action at a station (maker.js interact) --------------------------------------------------------
function use(address: string, id: string) {
  const st = BY_ID[id]
  const me = handOf(address)
  const R = roomOf(address)
  if (!st || !me || !R) return
  const h = heldOf(me)
  const it = stationItem(R, st.id)
  switch (st.kind) {
    case 'supply': {
      const g: Item = { k: GIVES(st.id) as string }
      if (!h) {
        setHeld(me, g)
        snd(R, 'item-pickup-pop', st)
        crate(R, st.id, g.k)
      } else if (canAdd(h, g)) {
        setHeld(me, addPart(h, g))
        snd(R, 'part-snap-click', st)
        crate(R, st.id, g.k)
      } else nope(address, 'eso no va con ' + nameOf(h.k, false), "that doesn't go with the " + nameOf(h.k, true).toLowerCase())
      return
    }
    case 'grinder':
    case 'pump': {
      // work stations never hold a prop: you keep it in your hands and HOLD the main action there
      if (!h && it) {
        setStation(R, st.id, null)
        setHeld(me, it)
        return snd(R, 'grab-tool', st)
      }
      if (!h) return
      if (st.kind === 'pump') {
        if (h.k === 'saw' && !h.g) return
        return nope(address, h.k !== 'saw' ? 'el surtidor es solo para la motosierra' : 'ya tiene nafta', h.k !== 'saw' ? 'the pump is only for the chainsaw' : "it's already fuelled")
      }
      if (sharpenable(h)) return
      return nope(address, h.s ? 'ya está afilado' : 'la amoladora es para cuchillos, machetes, cuchillas y el guante', h.s ? "it's already sharp" : 'the grinder is for knives, machetes, blades and the glove')
    }
    case 'counter': {
      if (!h && it) {
        setStation(R, st.id, null)
        setHeld(me, it)
        snd(R, 'grab-tool', st)
      } else if (h && !it) {
        setStation(R, st.id, h)
        setHeld(me, null)
        snd(R, 'set-down-wood', st)
      } else if (h && it && join(it, h)) {
        // base and part meet on the bench, whichever of the two was lying there: the joined prop comes to your hands
        // if you were holding the base, stays on the bench if the base was there
        const made = join(it, h) as Item
        if (canAdd(h, it)) {
          setStation(R, st.id, null)
          setHeld(me, made)
        } else {
          setStation(R, st.id, made)
          setHeld(me, null)
        }
        snd(R, 'part-snap-click', st)
      } else if (h && it) nope(address, 'no encajan', "those don't fit")
      return
    }
    case 'bucket': {
      if (h && dippable(h)) {
        setHeld(me, { ...h, b: 1 })
        snd(R, 'plunk-short', st)
      } else if (h) nope(address, h.b ? 'ya está ensangrentado' : 'solo cuchillos y machetes van a la sangre', h.b ? "it's already bloody" : 'only knives and machetes go in the blood')
      return
    }
    case 'trash':
      if (h) {
        setHeld(me, null)
        snd(R, 'trash-clang', st)
      }
      return
    case 'window': {
      const ord = R.P.orders[st.id]
      if (!ord) {
        if (h) nope(address, 'no hay nadie en esta ventanilla', "nobody's at this window")
        return
      }
      if (!h) return
      const d = dishOf(h)
      if (d !== ord.dish) return nope(address, d ? 'pidió otra cosa' : 'todavía no está terminado', d ? 'they ordered something else' : "it's not finished yet")
      R.served.push(ord.cust) // the referee scores it on its next tick
      setHeld(me, null)
      snd(R, 'serve-handover', st)
      return
    }
  }
}

// the main action held at the grinder or the pump: the bar fills, the prop changes in the maker's grip
function work(R: Room, dt: number) {
  const t = Date.now()
  const busy = new Set<string>()
  for (const [address, w] of [...R.working]) {
    const st = BY_ID[w.station]
    const me = handOf(address)
    const h = me ? heldOf(me) : null
    const grind = st?.kind === 'grinder'
    const fits = !!h && (grind ? sharpenable(h) : st?.kind === 'pump' && h.k === 'saw' && !h.g)
    if (!st || !me || !fits || t - w.at > 1200 || Hand.get(me).room !== R.k) {
      R.working.delete(address)
      continue
    }
    busy.add(st.id)
    w.prog += dt / (grind ? S.grindSeconds : S.fillSeconds)
    if (w.prog >= 1) {
      setHeld(me, grind ? { ...(h as Item), s: 1 } : { ...(h as Item), g: 1 })
      R.working.delete(address)
      busy.delete(st.id)
      setProg(R, st.id, 0)
      snd(R, 'ding-done', st)
    } else setProg(R, st.id, Math.round(w.prog * 20) / 20) // steps of 5 %: the bar does not need every frame on the wire
  }
  for (const st of STATIONS) if ((st.kind === 'grinder' || st.kind === 'pump') && !busy.has(st.id)) setProg(R, st.id, 0)
}

// --- the referee's seat, one per room --------------------------------------------------------------------------
function walkCustomers(R: Room, dt: number): string[] {
  const gone: string[] = []
  const alive = new Set<string>()
  for (const c of R.P.customers) {
    alive.add(c.id)
    let w = R.walkers.get(c.id)
    if (!w) R.walkers.set(c.id, (w = { x: ENTRY.x, z: ENTRY.z }))
    const dx = c.to.x - w.x
    const dz = c.to.z - w.z
    const d = Math.hypot(dx, dz)
    if (d > 0.05) {
      const k = Math.min(1, (CUSTOMER_SPEED * dt) / d)
      w.x += dx * k
      w.z += dz * k
    } else if (c.leave) gone.push(c.id)
  }
  for (const id of [...R.walkers.keys()]) if (!alive.has(id)) R.walkers.delete(id)
  return gone
}
function strike(R: Room) {
  // the set is struck: hands empty, benches, grinder and pump emptied, the floor swept
  for (const [e, h] of engine.getEntitiesWith(Hand)) if (h.room === R.k && h.held) setHeld(e, null)
  for (const st of STATIONS) if (st.kind !== 'supply') setStation(R, st.id, null)
  R.working.clear()
  if (R.floor.length) {
    R.floor = []
    writeFloor(R)
  }
}
function onFx(R: Room, f: Fx) {
  if (f.t === 'served') {
    pop(R, '+' + f.pts, f, true)
    snd(R, 'cash-register-ka-ching', f, 1.5)
  } else if (f.t === 'missed') {
    pop(R, '-' + S.missPenalty, f, false)
    snd(R, 'monster-angry-growl', f, 1.5)
  } else if (f.t === 'end') strike(R)
}

let beat = 0
function frame(dt: number) {
  syncHands()
  beat += dt
  const stamp = beat >= 1
  if (stamp) beat = 0
  for (const R of rooms) {
    work(R, dt)
    const gone = walkCustomers(R, dt)
    R.refAcc += dt
    if (R.refAcc >= 0.25) {
      // sim.js cadence: 250 ms
      R.refAcc = 0
      // an empty room does not keep a shift going for nobody
      if (R.P.on && members(R.k).length === 0) {
        R.P = { ...newShift(), best: R.P.best, rungAt: R.P.rungAt }
        R.startReq = R.P.rungAt
        strike(R)
        writeShift(R)
      } else {
        const r = tick(R.P, { now: Date.now(), random: Math.random, startReq: R.startReq, served: R.served.splice(0, R.served.length), gone })
        if (r.changed) writeShift(R)
        for (const f of r.fx) onFx(R, f)
      }
    }
    // the shared clock, and the proof that the server is awake
    if (stamp) Shift.getMutable(R.shiftEntity).clock = Date.now()
  }
}

export function initServer() {
  console.log('[SERVER] The Set: starting,', ROOMS, 'rooms')
  // only the server writes shared state
  const serverOnly = (value: { senderAddress: string }) => value.senderAddress === AUTH_SERVER_PEER_ID
  Shift.validateBeforeChange(serverOnly)
  StationState.validateBeforeChange(serverOnly)
  Floor.validateBeforeChange(serverOnly)
  Hand.validateBeforeChange(serverOnly)

  let syncId = 1
  for (let k = 0; k < ROOMS; k++) {
    const P = newShift()
    const shiftEntity = engine.addEntity()
    Shift.create(shiftEntity, { room: k, data: JSON.stringify(P), clock: Date.now() })
    syncEntity(shiftEntity, [Shift.componentId], syncId++)
    const floorEntity = engine.addEntity()
    Floor.create(floorEntity, { room: k, data: '[]' })
    syncEntity(floorEntity, [Floor.componentId], syncId++)
    const station: Record<string, Entity> = {}
    for (const st of STATIONS) {
      const e = engine.addEntity()
      StationState.create(e, { room: k, id: st.id, item: '', prog: 0 })
      syncEntity(e, [StationState.componentId], syncId++)
      station[st.id] = e
    }
    rooms.push({ k, shiftEntity, floorEntity, station, P, floor: [], startReq: 0, served: [], walkers: new Map(), working: new Map(), refAcc: 0 })
  }

  // the green door: the fullest room that still has space, as Spawn's routing does
  room.onMessage('enter', (_m, ctx) => {
    const me = ctx ? handOf(ctx.from) : null
    if (!ctx || !me || Hand.get(me).room >= 0) return
    const k = pickRoom(rooms.map((R) => members(R.k).length))
    if (k < 0) return nope(ctx.from, 'rodaje completo: esperá a que salga alguien', 'the shoot is full: wait for someone to leave')
    setRoom(me, k)
    console.log('[SERVER]', key(ctx.from), 'enters room', k, '(' + members(k).length + ' inside)')
  })
  room.onMessage('leave', (_m, ctx) => {
    const me = ctx ? handOf(ctx.from) : null
    if (!ctx || !me || Hand.get(me).room < 0) return
    console.log('[SERVER]', key(ctx.from), 'leaves room', Hand.get(me).room)
    setRoom(me, -1)
  })
  room.onMessage('use', (m, ctx) => {
    if (ctx) use(ctx.from, m.station)
  })
  room.onMessage('work', (m, ctx) => {
    const R = ctx ? roomOf(ctx.from) : null
    if (!ctx || !R) return
    const k = key(ctx.from)
    if (!m.on) return void R.working.delete(k)
    const w = R.working.get(k)
    if (w && w.station === m.station) w.at = Date.now()
    else if (BY_ID[m.station]) R.working.set(k, { station: m.station, at: Date.now(), prog: 0 })
  })
  room.onMessage('pick', (m, ctx) => {
    const R = ctx ? roomOf(ctx.from) : null
    const me = ctx ? handOf(ctx.from) : null
    if (!ctx || !R || !me) return
    const l = R.floor.find((x) => x.id === m.id)
    if (!l) return
    const h = heldOf(me)
    // empty hands take it; a base and its part join in your hands, whichever of the two was on the floor
    const got = h ? join(h, l.it) : l.it
    if (!got) return nope(ctx.from, 'no encajan', "those don't fit")
    R.floor = R.floor.filter((x) => x.id !== l.id)
    writeFloor(R)
    setHeld(me, got)
    snd(R, h ? 'part-snap-click' : 'grab-tool', l)
  })
  room.onMessage('drop', (m, ctx) => {
    const R = ctx ? roomOf(ctx.from) : null
    const me = ctx ? handOf(ctx.from) : null
    const h = me ? heldOf(me) : null
    if (!R || !me || !h) return
    // facing a bench or the trash, "drop" means "leave it here" (playtest: dropping at a lit bench put it on the floor)
    const st = BY_ID[m.station]
    if (st?.kind === 'trash') {
      setHeld(me, null)
      return snd(R, 'trash-clang', st)
    }
    if (st?.kind === 'counter') {
      const it = stationItem(R, st.id)
      const made = it ? join(it, h) : h
      if (made) {
        setStation(R, st.id, made)
        setHeld(me, null)
        return snd(R, it ? 'part-snap-click' : 'set-down-wood', st)
      }
    }
    // on the floor, inside the walls
    const x = Math.max(-6.0, Math.min(6.0, m.x))
    const z = Math.max(-3.9, Math.min(3.9, m.z))
    setHeld(me, null)
    R.floor = [...R.floor, { id: 'l' + ++looseSeq, it: h, x, z, yaw: m.yaw }]
    writeFloor(R)
    snd(R, 'prop-clunk-on-concrete', { x, z }, 0.1)
  })
  room.onMessage('start', (_m, ctx) => {
    const R = ctx ? roomOf(ctx.from) : null
    if (R && !R.P.on) R.startReq = R.P.rungAt + 1 // ¡ACCIÓN!
  })

  engine.addSystem(frame)
}
