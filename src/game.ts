// The prop maker's hands and the referee's seat.
// Ported from scripts/maker.js (E grabs, sets down, combines, dips, serves; E HELD grinds and fuels; one thing
// in the hands; the lot's doors), scripts/loose.js (thrown props) and the wiring around places/main/sim.js.
// Keys: E = IA_PRIMARY (one interaction key since seq 292: press and hold), 1 = IA_ACTION_3 (throw; Q in Spawn,
// which a Decentraland scene cannot bind). On a phone the client draws those as its own on-screen buttons.
// No jumping (@sebadl): the jump input is switched off for the player.
import { AvatarAnchorPointType, AvatarAttach, engine, Entity, InputAction, InputModifier, inputSystem, PointerEventType, TouchScreenControls, Transform } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { DOORS, insideShed, MUSIC, NAMES_EN, ORIGIN, S, SND, SPAWN_IN_SHED, SPAWN_ON_LOT, T } from './config'
import { loop, play, playFlat, stopLoop } from './audio'
import { gone, popNumber, updateCustomers, updatePops } from './customers'
import { sp, yaw } from './gfx'
import { bus, cards, floor, isHost, Loose, me, meMut, myId, now, ready, setStation, setStationProg, shift, stampClock, stationItem, stationProg, writeFloor, writeShift } from './net'
import { PropSlot, slotAt } from './props'
import { Fx, ShiftState, tick } from './referee'
import { crateBounce, setGuide, setMarker, showFront } from './shed'
import { addPart, BY_ID, canAdd, dippable, dishOf, feelOf, GIVES, Item, itemKey, nextStep, packItem, sharpenable, Station, STATIONS, stationUnder, unpackItem } from './shop'
import { hint, UI } from './state'

// Headless test switch (references/testing.md): the scene plays a short shift by itself and logs it.
// Leave it false.
const AUTO_SMOKE = false

// --- where the maker stands, in Spawn coordinates ---------------------------------------------------------
type Pose = { x: number; y: number; z: number; fx: number; fz: number }
let lastPose: Pose = { x: SPAWN_ON_LOT.x, y: 0, z: SPAWN_ON_LOT.z, fx: 0, fz: -1 }
let lastAt = 0
let vel = { x: 0, z: 0 }
function pose(): Pose {
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (!t) return lastPose
  const f = Vector3.rotate(Vector3.Forward(), t.rotation)
  const n = Math.hypot(f.x, f.z) || 1
  // the player's Transform sits at the avatar's middle; feet are about 0.9 m below
  return { x: t.position.x - ORIGIN.x, y: Math.max(0, t.position.y - 0.9), z: ORIGIN.z - t.position.z, fx: f.x / n, fz: -f.z / n }
}

// --- hands ----------------------------------------------------------------------------------------------
const hand = () => UI.held
function setHand(it: Item | null) {
  UI.held = it
  const c = meMut()
  if (c && c.held !== packItem(it)) c.held = packItem(it)
}
const snd = (n: string, at: { x: number; y?: number; z: number }) => {
  play(n, at, 1)
  bus.emit('snd', { n, x: at.x, y: at.y ?? 1, z: at.z, from: myId })
}
function nope(why: string, en: string, at: { x: number; z: number }) {
  play('buzz-short', at, 1)
  hint(why, en)
}
const nameOf = (k: string, en: boolean) => (en ? NAMES_EN[k] : S.names[k]) ?? k
// a crate answers a good grab: it bounces and pops the item's name over it (maker.js crateHit)
function crateHit(st: Station, k: string) {
  crateBounce(st.id)
  popNumber('+' + nameOf(k, UI.lang === 'en'), st.x, st.z, Color4.create(0.965, 0.757, 0.467, 1), 0.9, 1.3)
}

// a thrown prop lying in reach, a metre ahead of the maker
function looseAhead(p: Pose): Loose | null {
  const px = p.x + p.fx * 0.9
  const pz = p.z + p.fz * 0.9
  let best: Loose | null = null
  let bd = T.pickReach
  for (const r of floor()) {
    const d = Math.hypot(r.x - px, r.z - pz)
    if (d < bd) {
      bd = d
      best = r
    }
  }
  return best
}
// the station the maker faces: the nearest to a point 0.75 m ahead, else the nearest to the feet
function target(p: Pose): Station | null {
  const fx = p.x + p.fx * 0.75
  const fz = p.z + p.fz * 0.75
  let best: Station | null = null
  let bd = 1.05
  for (const s of STATIONS) {
    const d = Math.hypot(s.x - fx, s.z - fz)
    if (d < bd) {
      bd = d
      best = s
    }
  }
  if (best) return best
  bd = 1.2
  for (const s of STATIONS) {
    const d = Math.hypot(s.x - p.x, s.z - p.z)
    if (d < bd) {
      bd = d
      best = s
    }
  }
  return best
}

function takeLoose(l: Loose) {
  setHand(l.it)
  writeFloor(floor().filter((x) => x.id !== l.id))
  snd('grab-tool', l)
}

// E at a station (maker.js interact)
function useStation(st: Station) {
  const h = hand()
  const it = stationItem(st.id)
  const at = { x: st.x, y: 1, z: st.z }
  switch (st.kind) {
    case 'supply': {
      const g: Item = { k: GIVES(st.id) as string }
      if (!h) {
        setHand(g)
        snd('item-pickup-pop', at)
        crateHit(st, g.k)
      } else if (canAdd(h, g)) {
        setHand(addPart(h, g))
        snd('part-snap-click', at)
        crateHit(st, g.k)
      } else nope('eso no va con ' + (S.names[h.k] ?? h.k), "that doesn't go with the " + nameOf(h.k, true).toLowerCase(), at)
      return
    }
    case 'grinder':
    case 'pump': {
      // work stations never hold a prop: you keep it in your hands and HOLD E there (the frame fills the bar)
      if (!h && it) {
        setStation(st.id, null)
        setHand(it)
        snd('grab-tool', at)
        return
      }
      if (!h) return
      if (st.kind === 'pump') {
        if (h.k === 'saw' && !h.g) return
        return nope(h.k !== 'saw' ? 'el surtidor es solo para la motosierra' : 'ya tiene nafta', h.k !== 'saw' ? 'the pump is only for the chainsaw' : "it's already fuelled", at)
      }
      if (sharpenable(h)) return
      return nope(h.s ? 'ya está afilado' : 'la amoladora es para cuchillos, machetes, cuchillas y el guante', h.s ? "it's already sharp" : 'the grinder is for knives, machetes, blades and the glove', at)
    }
    case 'counter': {
      if (!h && it) {
        setStation(st.id, null)
        setHand(it)
        snd('grab-tool', at)
      } else if (h && !it) {
        setStation(st.id, h)
        setHand(null)
        snd('set-down-wood', at)
      } else if (h && it && canAdd(it, h)) {
        setStation(st.id, addPart(it, h))
        setHand(null)
        snd('part-snap-click', at)
      } else if (h && it && canAdd(h, it)) {
        setStation(st.id, null)
        setHand(addPart(h, it))
        snd('part-snap-click', at)
      } else if (h && it) nope('no encajan', "those don't fit", at)
      return
    }
    case 'bucket': {
      if (h && dippable(h)) {
        setHand({ ...h, b: 1 })
        snd('plunk-short', at)
      } else if (h) nope(h.b ? 'ya está ensangrentado' : 'solo cuchillos y machetes van a la sangre', h.b ? "it's already bloody" : 'only knives and machetes go in the blood', at)
      return
    }
    case 'trash':
      if (h) {
        setHand(null)
        snd('trash-clang', at)
      }
      return
    case 'window': {
      const ord = shift().orders[st.id]
      if (!ord) {
        if (h) nope('no hay nadie en esta ventanilla', "nobody's at this window", at)
        return
      }
      if (!h) return
      const d = dishOf(h)
      if (d !== ord.dish) return nope(d ? 'pidió otra cosa' : 'todavía no está terminado', d ? 'they ordered something else' : "it's not finished yet", at)
      // the referee scores it (Spawn: customer.state.served)
      const c = meMut()
      if (c) c.serve = ord.cust
      setHand(null)
      snd('serve-handover', at)
      return
    }
  }
}

// the one word the USE key does right now (and whether the work key does anything)
function verbOf(st: Station | null): { verb: string | null; work: boolean; wv?: string } {
  if (!st) return { verb: null, work: false }
  const h = hand()
  const it = stationItem(st.id)
  switch (st.kind) {
    case 'supply': {
      const g: Item = { k: GIVES(st.id) as string }
      return { verb: !h ? 'TOMAR' : canAdd(h, g) ? 'PONER' : null, work: false }
    }
    case 'grinder':
      return { verb: !h && it ? 'TOMAR' : sharpenable(h) ? 'AFILAR' : null, work: sharpenable(h), wv: 'AFILAR' }
    case 'pump':
      return { verb: !h && it ? 'TOMAR' : h && h.k === 'saw' && !h.g ? 'CARGAR' : null, work: !!h && h.k === 'saw' && !h.g, wv: 'CARGAR' }
    case 'counter':
      return { verb: h && !it ? 'APOYAR' : !h && it ? 'TOMAR' : h && it && (canAdd(it, h) || canAdd(h, it)) ? 'UNIR' : null, work: false }
    case 'bucket':
      return { verb: dippable(h) ? 'MOJAR' : null, work: false }
    case 'trash':
      return { verb: h ? 'TIRAR' : null, work: false }
    case 'window':
      return { verb: shift().orders[st.id] && h ? 'DAR' : null, work: false }
  }
  return { verb: null, work: false }
}

// --- throwing (maker.js toss + loose.js) ----------------------------------------------------------------------
// Spawn hands the prop to its physics engine; a scene has none, so the lob is worked out here: the same
// launch numbers, gravity and landing rules (a free bench takes it, the trash bins it, anything else drops it
// on the floor for E), without the tumble.
type Flight = { slot: PropSlot; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; dur: number; land: null | (() => void) }
const flights: Flight[] = []
let looseSeq = 0
function plan(it: Item, x0: number, y0: number, z0: number, vx: number, vy: number, vz: number) {
  let x = x0
  let y = y0
  let z = z0
  let v = vy
  let t = 0
  const dt = 1 / 60
  while (t < 3) {
    t += dt
    v -= T.gravity * dt
    x += vx * dt
    y += v * dt
    z += vz * dt
    // the tin walls stop it
    if (Math.abs(x) > 6.1 || Math.abs(z) > 3.9) {
      x = Math.max(-6.1, Math.min(6.1, x))
      z = Math.max(-3.9, Math.min(3.9, z))
      vx = 0
      vz = 0
    }
    // coming down onto a station's top, it lands there (or glances off and drops in front)
    if (y < 1.0 && y > 0.3 && v < 0) {
      const s = stationUnder(x, z)
      if (s) {
        if (s.kind === 'trash') return { t, x, y, z, s, kind: 'trash' as const }
        if (s.kind === 'counter' && !stationItem(s.id)) return { t, x, y: 0.92, z, s, kind: 'counter' as const }
        const n = s.yaw === 180 ? 1 : s.yaw === 0 ? -1 : 0
        const e = s.yaw === 90 ? -1 : s.yaw === -90 ? 1 : 0
        return { t: t + 0.25, x: s.x + e * 0.95, y: 0.03, z: s.z + n * 0.85, s: null, kind: 'floor' as const }
      }
    }
    if (y <= 0.03) return { t, x, y: 0.03, z, s: null, kind: 'floor' as const }
  }
  return { t, x, y: 0.03, z, s: null, kind: 'floor' as const }
}
function fly(it: Item, x: number, y: number, z: number, vx: number, vy: number, vz: number, dur: number, land: null | (() => void)) {
  const slot = slotAt(undefined, sp(x, y, z), yaw((Math.atan2(-vx, -vz) * 180) / Math.PI + 90), 1.7)
  slot.show(it)
  flights.push({ slot, x, y, z, vx, vy, vz, t: 0, dur, land })
}
function toss(p: Pose) {
  const held = hand()
  if (!held) return
  const speed = feelOf(held) === 'hard' ? T.hardSpeed : T.speed
  const x0 = p.x + p.fx * T.ahead
  const y0 = p.y + T.height
  const z0 = p.z + p.fz * T.ahead
  const vx = p.fx * speed + vel.x * T.carry
  const vz = p.fz * speed + vel.z * T.carry
  const r = plan(held, x0, y0, z0, vx, T.lift, vz)
  setHand(null)
  snd('quick-throw-whoosh', { x: p.x, y: 1.2, z: p.z })
  bus.emit('throw', { it: packItem(held), x: x0, y: y0, z: z0, vx, vy: T.lift, vz, dur: r.t, from: myId })
  fly(held, x0, y0, z0, vx, T.lift, vz, r.t, () => {
    if (r.kind === 'trash') return snd('trash-clang', r)
    if (r.kind === 'counter' && r.s && !stationItem(r.s.id)) {
      setStation(r.s.id, held)
      return snd('set-down-wood', r)
    }
    // on the floor it waits for a maker's E
    writeFloor([...floor(), { id: myId + '-' + ++looseSeq, it: held, x: r.x, z: r.z, yaw: (Math.atan2(-vx, -vz) * 180) / Math.PI + 90 }])
    snd('prop-clunk-on-concrete', r)
  })
}
function updateFlights(dt: number) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i]
    f.t += dt
    f.vy -= T.gravity * dt
    f.x += f.vx * dt
    f.y = Math.max(0.03, f.y + f.vy * dt)
    f.z += f.vz * dt
    Transform.getMutable(f.slot.root).position = sp(f.x, f.y, f.z)
    if (f.t >= f.dur) {
      f.slot.destroy()
      flights.splice(i, 1)
      f.land?.()
    }
  }
}

// props resting on the floor, drawn from the synced list
const floorSlots = new Map<string, PropSlot>()
function syncFloor() {
  const list = floor()
  const seen = new Set<string>()
  for (const l of list) {
    seen.add(l.id)
    if (floorSlots.has(l.id)) continue
    const s = slotAt(undefined, sp(l.x, 0.03, l.z), yaw(l.yaw), 1.7)
    s.show(l.it)
    floorSlots.set(l.id, s)
  }
  for (const [id, s] of [...floorSlots]) {
    if (seen.has(id)) continue
    s.destroy()
    floorSlots.delete(id)
  }
}

// what every maker holds, in their right hand (Spawn: the "held" child of the player)
const handSlots = new Map<string, { slot: PropSlot; e: Entity }>()
function syncHands() {
  const seen = new Set<string>()
  for (const { c } of cards()) {
    seen.add(c.userId)
    let h = handSlots.get(c.userId)
    if (!h) {
      const e = engine.addEntity()
      Transform.create(e, { position: Vector3.create(0, -5, 0) })
      if (!c.userId.startsWith('solo-')) AvatarAttach.create(e, { avatarId: c.userId, anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND })
      const slot = slotAt(e, Vector3.create(0, 0.05, 0.1), Quaternion.fromEulerDegrees(0, 90, 0), 1.5)
      h = { slot, e }
      handSlots.set(c.userId, h)
    }
    h.slot.show(c.userId === myId ? UI.held : unpackItem(c.held))
  }
  for (const [id, h] of [...handSlots]) {
    if (seen.has(id)) continue
    h.slot.destroy()
    engine.removeEntity(h.e)
    handSlots.delete(id)
  }
}

// --- the lot's doors and the way back out ---------------------------------------------------------------------
// in front of a door: within a door's width, up to ~2.4 m out from the wall (scripts/lib/doors.js doorNear)
const doorNear = (p: Pose) => DOORS.find((d) => Math.abs(p.x - d.x) < 1.3 && p.z > d.z - 0.2 && p.z < d.z + 2.6) ?? null
let move: null | { to: { x: number; y: number; z: number }; look: { x: number; y: number; z: number }; inside: boolean; tries: number; next: number } = null
function go(to: { x: number; y: number; z: number }, look: { x: number; y: number; z: number }, inside: boolean) {
  move = { to, look, inside, tries: 0, next: 0 }
}
// movePlayerTo can fail without saying so: ask again until the body is where it should be
function updateMove(p: Pose, dt: number) {
  if (!move) return
  if (insideShed(p.x, p.z) === move.inside && move.tries > 0) {
    move = null
    return
  }
  move.next -= dt
  if (move.next > 0) return
  if (move.tries >= 6) {
    move = null
    return
  }
  move.tries++
  move.next = 0.7
  void movePlayerTo({ newRelativePosition: sp(move.to.x, move.to.y, move.to.z), cameraTarget: sp(move.look.x, move.look.y, move.look.z) })
}
function enterShed(d: { x: number; z: number }) {
  play('heavy-wooden-barn-door-creak-open', { x: d.x, y: 1.2, z: d.z })
  go(SPAWN_IN_SHED, { x: 0, y: 1, z: -3.4 }, true)
}
function goLot() {
  if (hand()) setHand(null)
  play('heavy-wooden-barn-door-creak-open', { x: 0, y: 1.2, z: 4.1 }, 0.7)
  go(SPAWN_ON_LOT, { x: 0, y: 1.5, z: 0 }, false)
}

// --- the referee's seat -----------------------------------------------------------------------------------
let refAcc = 0
function applyFx(f: Fx) {
  if (f.t === 'served') {
    popNumber('+' + f.pts, f.x, f.z, Color4.create(0.96, 0.76, 0.47, 1))
    play('cash-register-ka-ching', { x: f.x, y: 1.5, z: f.z })
  } else if (f.t === 'missed') {
    popNumber('-' + S.missPenalty, f.x, f.z, Color4.create(0.88, 0.28, 0.23, 1))
    play('monster-angry-growl', { x: f.x, y: 1.5, z: f.z })
  }
}
function referee(dt: number) {
  refAcc += dt
  if (refAcc < 0.25) return // sim.js cadence: 250 ms
  refAcc = 0
  stampClock()
  const P = JSON.parse(JSON.stringify(shift())) as ShiftState
  const cs = cards().map((x) => x.c)
  const r = tick(P, {
    now: now(),
    random: Math.random,
    startReq: Math.max(0, ...cs.map((c) => c.startReq)),
    served: cs.map((c) => c.serve).filter((s) => !!s),
    gone: gone.splice(0, gone.length)
  })
  if (r.changed) writeShift(P)
  for (const f of r.fx) {
    if (f.t === 'end') {
      // the set is struck: benches, grinder and pump emptied, thrown props swept off the floor
      for (const st of STATIONS) if (st.kind !== 'supply' && (stationItem(st.id) || stationProg(st.id))) setStation(st.id, null)
      if (floor().length) writeFloor([])
    }
    if (f.t === 'served' || f.t === 'missed') {
      bus.emit('fx', { ...f, from: myId })
      applyFx(f)
    }
  }
}

// every client hears the clapperboard and the whistle off the shift's own switch
let wasOn = false
function shiftEdges() {
  const on = shift().on
  if (on === wasOn) return
  wasOn = on
  if (on) {
    playFlat('film-clapperboard-action')
    loop('music', MUSIC, { volume: 0.5, global: true })
  } else {
    playFlat('director-cut-whistle')
    stopLoop('music')
    if (hand()) setHand(null) // the shift's over: hands empty
  }
}

// While the guide covers the screen the phone's joystick and action buttons would sit on top of it (its close
// button ended up under them), so they step aside and come back when it closes. No-ops on desktop.
let modalOpen = false
function modalControls(open: boolean) {
  if (open === modalOpen) return
  modalOpen = open
  if (open) {
    TouchScreenControls.hideAll()
    TouchScreenControls.hideJoystick()
  } else {
    TouchScreenControls.showAll()
    TouchScreenControls.showJoystick()
  }
}

// --- one frame of the maker (maker.js onInput + update) --------------------------------------------------------
let workAt: string | null = null
let grTick = -1
const pressed = (a: InputAction) => inputSystem.isTriggered(a, PointerEventType.PET_DOWN)

function frame(dt: number) {
  const p = pose()
  const t = Date.now()
  if (lastAt && t > lastAt) {
    const k = 1000 / (t - lastAt)
    vel = { x: (p.x - lastPose.x) * k, z: (p.z - lastPose.z) * k }
    if (Math.hypot(vel.x, vel.z) > 12) vel = { x: 0, z: 0 } // a teleport, not a run
  }
  lastPose = p
  lastAt = t

  updateCustomers(dt)
  updatePops(dt)
  updateFlights(dt)
  syncFloor()
  syncHands()
  shiftEdges()
  if (ready() && isHost()) referee(dt)
  updateMove(p, dt)
  UI.entering = !!move && move.inside
  if (AUTO_SMOKE) smoke(dt)

  const inside = insideShed(p.x, p.z)
  UI.inside = inside
  modalControls(inside && (UI.guide ?? !UI.guideSeen))
  showFront(!inside)
  const card = meMut()
  if (card && card.inside !== inside) card.inside = inside
  // the customer I served has been scored (its order is gone): clear the request
  const mine = me()
  if (mine?.serve && !Object.values(shift().orders).some((o) => o.cust === mine.serve)) {
    const c = meMut()
    if (c) c.serve = ''
  }

  if (!inside) {
    // on the lot: E (or the HUD's ENTRAR) in front of a door walks you in
    setMarker(null)
    setGuide(null, '')
    UI.look = null
    UI.verb = null
    UI.canWork = false
    UI.canThrow = false
    const d = doorNear(p)
    UI.nearDoor = d ? (d.to as 'public' | 'private') : null
    if ((pressed(InputAction.IA_PRIMARY) || UI.wantEnter) && !move) {
      if (d?.to === 'public' || (UI.wantEnter && !d)) enterShed(d ?? DOORS[0])
      else if (d) hint('el rodaje privado no existe en Decentraland: usá la puerta verde', 'private shoots do not exist in Decentraland: use the green door')
    }
    UI.wantEnter = false
    UI.wantExit = false
    UI.wantStart = false
    if (hand()) setHand(null)
    return
  }
  UI.nearDoor = null

  if (UI.wantExit) {
    UI.wantExit = false
    return goLot()
  }
  if (UI.wantStart) {
    UI.wantStart = false
    if (!shift().on && card) {
      // ¡ACCIÓN!: a request newer than the last one the referee took
      card.startReq = Math.max(shift().rungAt, ...cards().map((x) => x.c.startReq)) + 1
      UI.guide = false
      UI.guideSeen = true
    }
  }

  const st = target(p)
  const l = !hand() ? looseAhead(p) : null
  const look = l ? null : st
  UI.look = look?.id ?? null
  setMarker(look)
  const v = l ? { verb: 'TOMAR', work: false, wv: undefined } : verbOf(st)
  UI.canThrow = !!hand()
  UI.verb = v.verb
  UI.canWork = v.work
  if (v.wv) UI.workVerb = v.wv

  if (pressed(InputAction.IA_PRIMARY)) {
    if (l) takeLoose(l)
    else if (st) useStation(st)
  }
  if (pressed(InputAction.IA_ACTION_3)) toss(p)

  // the first-order guide: until the shift's first delivery, an arrow over the station needed next (@sebadl)
  const P = shift()
  const step = P.on && P.served === 0 ? nextStep(P.orders, hand(), nameOf) : null
  setGuide(step?.id ?? null, step ? (UI.lang === 'en' ? step.en : step.es) : '')

  // E held at the grinder or the pump, the prop still in your hands: the station's bar fills, the prop changes in your grip
  const working = inputSystem.isPressed(InputAction.IA_PRIMARY) && v.work && !!st && !l
  if (!working || !st) {
    if (workAt) {
      setStationProg(workAt, 0)
      workAt = null
      grTick = -1
    }
    return
  }
  if (workAt && workAt !== st.id) setStationProg(workAt, 0)
  workAt = st.id
  const h = hand() as Item
  const grind = st.kind === 'grinder'
  const at = { x: st.x, y: 1, z: st.z }
  const prog = stationProg(st.id) + dt / (grind ? S.grindSeconds : S.fillSeconds)
  // the motor's sound is the station's own loop now (shed.ts), not a tick from here
  if (prog >= 1) {
    setHand(grind ? { ...h, s: 1 } : { ...h, g: 1 })
    setStationProg(st.id, 0)
    grTick = -1
    snd('ding-done', at)
  } else setStationProg(st.id, prog)
}

// --- headless smoke run (AUTO_SMOKE) ------------------------------------------------------------------------
// A headless client cannot press keys or walk, so this drives the same station code the keys do: it starts a
// shift, builds each order through the real stations and hands it over, and logs the state.
let smokeT = 0
let smokeStep = 0
const smokePlans: Record<string, string[]> = {
  knife: ['rack-knife', 'F:grinder-1', 'bucket-1'],
  machete: ['rack-machete', 'F:grinder-1', 'bucket-1'],
  chainsaw: ['rack-saw', 'bin-chain', 'F:pump-1'],
  flashlight: ['rack-torch', 'bin-bulb', 'bin-battery'],
  walkie: ['rack-walkie', 'bin-antenna', 'bin-battery'],
  glove: ['rack-glove', 'bin-blades', 'F:grinder-1']
}
function smoke(dt: number) {
  smokeT += dt
  if (smokeT < 1) return
  smokeT = 0
  smokeStep++
  const P = shift()
  const card = meMut()
  if (!card) return console.log('[smoke] waiting for a card')
  if (!P.on && !P.last && card.startReq <= P.rungAt) {
    card.startReq = Math.max(P.rungAt, card.startReq) + 1
    console.log('[smoke] asked for a shift · host=' + isHost() + ' stations=' + STATIONS.length)
  }
  if (P.on) {
    for (const w of Object.keys(P.orders)) {
      const o = P.orders[w]
      if (card.serve === o.cust) continue
      setHand(null)
      for (const step of smokePlans[o.dish]) {
        if (step.startsWith('F:')) {
          const h = hand() as Item
          setHand(BY_ID[step.slice(2)].kind === 'grinder' ? { ...h, s: 1 } : { ...h, g: 1 })
        } else useStation(BY_ID[step])
      }
      const made = dishOf(hand())
      useStation(BY_ID[w])
      console.log('[smoke] order ' + o.dish + ' at ' + w + ' built=' + made + ' item=' + itemKey(hand()) + ' serve=' + card.serve)
      break
    }
  }
  if (smokeStep % 5 === 0)
    console.log('[smoke] t=' + smokeStep + ' on=' + P.on + ' score=' + P.score + ' served=' + P.served + ' missed=' + P.missed + ' customers=' + P.customers.length + ' orders=' + Object.keys(P.orders).length + ' last=' + JSON.stringify(P.last))
}

export function initGame() {
  if (AUTO_SMOKE) S.shiftSeconds = 40
  bus.on('snd', (m: { n: string; x: number; y: number; z: number; from: string }) => {
    if (m.from !== myId) play(m.n, m)
  })
  bus.on('fx', (m: Fx & { from: string }) => {
    if (m.from !== myId) applyFx(m)
  })
  bus.on('throw', (m: { it: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; dur: number; from: string }) => {
    const it = unpackItem(m.it)
    if (m.from !== myId && it) fly(it, m.x, m.y, m.z, m.vx, m.vy, m.vz, m.dur, null)
  })
  // the lot at night, the shed's hum
  loop('crickets', SND('night-crickets-distant-wind-eerie-ambience-loop'), { volume: 0.35, global: true })
  loop('shed', SND('workshop-night-ambience-loop'), { at: { x: 0, y: 1.5, z: 0 }, volume: 0.6 })
  loop('balloon', SND('film-set-balloon-light-electric-hum-loop'), { at: { x: 0, y: 6, z: 10 }, volume: 0.5 })
  // @sebadl: no jumping in The Set
  InputModifier.createOrReplace(engine.PlayerEntity, { mode: InputModifier.Mode.Standard({ disableJump: true }) })
  engine.addSystem(frame)
}
