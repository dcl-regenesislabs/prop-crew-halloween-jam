// The prop maker's client: what you face, what the main action would do, and telling the server you tried.
// Ported from the read-only half of scripts/maker.js (targeting, verbs, the lot's doors); the half that changes
// anything (grab, set down, combine, dip, serve, sharpen, fuel, drop) runs on the server (server/server.ts),
// which answers through the synced components and a few messages (sounds, pop-ups, hints).
// Keys: E = IA_PRIMARY (the one interaction key: press, and hold at the grinder and pump), 1 = IA_ACTION_3
// (drop). On a phone E is the big button and 1 a small one (touch.ts). No jumping (@sebadl).
import { AvatarAnchorPointType, AvatarAttach, engine, Entity, InputAction, InputModifier, inputSystem, PointerEventType, Transform } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { loop, play, playFlat, stopLoop } from './audio'
import { DOOR, DROP_AHEAD, insideShed, MUSIC, MUSIC_VOLUME, NAMES_EN, ORIGIN, PICK_REACH, S, SND, SPAWN_IN_SHED, SPAWN_ON_LOT } from './config'
import { popNumber, updateCustomers, updatePops } from './customers'
import { rl, roomRoot, roomY, setRoomHeight, sp, yaw, hideRoom } from './gfx'
import { floor, hands, Loose, myHeld, myRoom, sendDrop, sendEnter, sendLeave, sendPick, sendStart, sendUse, sendWork, shift, stationItem } from './net'
import { PropSlot, slotAt } from './props'
import { room } from './shared/messages'
import { ROOM_Y } from './shared/rooms'
import { buildInterior, buildStations, crateBounce, setGuide, setMarker } from './shed'
import { canAdd, dippable, GIVES, Item, join, nextStep, sharpenable, Station, STATIONS } from './shop'
import { hint, UI } from './state'
import { applyTouch } from './touch'

// --- where the maker stands, in Spawn coordinates ---------------------------------------------------------
type Pose = { x: number; y: number; z: number; fx: number; fz: number }
let lastPose: Pose = { x: SPAWN_ON_LOT.x, y: 0, z: SPAWN_ON_LOT.z, fx: 0, fz: -1 }
function pose(): Pose {
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (!t) return lastPose
  const f = Vector3.rotate(Vector3.Forward(), t.rotation)
  const n = Math.hypot(f.x, f.z) || 1
  // the player's Transform sits at the avatar's middle; feet are about 0.9 m below
  return { x: t.position.x - ORIGIN.x, y: t.position.y - 0.9, z: ORIGIN.z - t.position.z, fx: f.x / n, fz: -f.z / n }
}

const nameOf = (k: string, en: boolean) => (en ? NAMES_EN[k] : S.names[k]) ?? k

// a prop on the floor in reach, a metre ahead of the maker
function looseAhead(p: Pose): Loose | null {
  const px = p.x + p.fx * 0.9
  const pz = p.z + p.fz * 0.9
  let best: Loose | null = null
  let bd = PICK_REACH
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

// the one word the main action does right now (and whether holding it works the station)
function verbOf(st: Station | null, h: Item | null): { verb: string | null; work: boolean; wv?: string } {
  if (!st) return { verb: null, work: false }
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

// props resting on the floor, drawn from the synced list
const floorSlots = new Map<string, PropSlot>()
function syncFloor() {
  const list = floor()
  const seen = new Set<string>()
  for (const l of list) {
    seen.add(l.id)
    if (floorSlots.has(l.id)) continue
    const s = slotAt(roomRoot(), rl(l.x, 0.03, l.z), yaw(l.yaw), 1.7)
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
  for (const h of hands()) {
    seen.add(h.userId)
    let v = handSlots.get(h.userId)
    if (!v) {
      const e = engine.addEntity()
      Transform.create(e, { position: Vector3.create(0, -5, 0) })
      AvatarAttach.create(e, { avatarId: h.userId, anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND })
      const slot = slotAt(e, Vector3.create(0, 0.05, 0.1), Quaternion.fromEulerDegrees(0, 90, 0), 1.5)
      v = { slot, e }
      handSlots.set(h.userId, v)
    }
    v.slot.show(h.held)
  }
  for (const [id, v] of [...handSlots]) {
    if (seen.has(id)) continue
    v.slot.destroy()
    engine.removeEntity(v.e)
    handSlots.delete(id)
  }
}

// --- the lot's door, rooms, and the way back out ----------------------------------------------------------------
// in front of the door: within its width, up to ~2.4 m out from the wall (scripts/lib/doors.js doorNear)
const atDoor = (p: Pose) => Math.abs(p.x - DOOR.x) < 1.4 && p.z > DOOR.z - 0.2 && p.z < DOOR.z + 2.8 && p.y < 3
// in my room's shed: over its floor, and up at its height
const inRoom = (p: Pose, k: number) => k >= 0 && insideShed(p.x, p.z) && Math.abs(p.y - ROOM_Y[k]) < 4
// movePlayerTo can fail without saying so: ask again until the body is where it should be
let moveNext = 0
let moveTries = 0
function moveTo(x: number, y: number, z: number, lookZ: number, dt: number) {
  moveNext -= dt
  if (moveNext > 0 || moveTries >= 8) return
  moveTries++
  moveNext = 0.8
  void movePlayerTo({ newRelativePosition: sp(x, y, z), cameraTarget: sp(x, y + 1, lookZ) })
}
// The server decides which room I am in (Hand.room); this keeps my body where that says: up in that room's shed,
// or down on the lot. The interior is built the first time it is needed and moved to the room's height.
let interior = false
let lastRoom = -1
function followRoom(p: Pose, dt: number): boolean {
  const k = myRoom()
  if (k !== lastRoom) {
    lastRoom = k
    moveTries = 0
    moveNext = 0
    if (k >= 0) {
      if (!interior) {
        interior = true
        buildInterior()
        buildStations()
      }
      setRoomHeight(ROOM_Y[k])
      play('heavy-wooden-barn-door-creak-open', { x: DOOR.x, y: 1.2, z: DOOR.z })
    }
  }
  if (k >= 0) {
    if (inRoom(p, k)) return true
    moveTo(SPAWN_IN_SHED.x, ROOM_Y[k] + SPAWN_IN_SHED.y, SPAWN_IN_SHED.z, -3.4, dt)
    return false
  }
  // on the lot; if I am still up in a room (I just left, or the server took my place), come down
  if (p.y > 8) moveTo(SPAWN_ON_LOT.x, SPAWN_ON_LOT.y, SPAWN_ON_LOT.z, 0, dt)
  else hideRoom()
  return false
}

// every client hears the clapperboard and the whistle off the shift's own switch
let wasOn = false
function shiftEdges() {
  const on = shift().on
  if (on === wasOn) return
  wasOn = on
  if (on) {
    playFlat('film-clapperboard-action')
  } else {
    playFlat('director-cut-whistle')
  }
}

// the music follows the HUD's button; the shed's hum is only heard inside
let musicOn = false
let humOn = false
function musicSwitch() {
  const want = UI.music && shift().on
  if (want !== musicOn) {
    musicOn = want
    if (want) loop('music', MUSIC, { volume: MUSIC_VOLUME, global: true })
    else stopLoop('music')
  }
  if (UI.inside !== humOn) {
    humOn = UI.inside
    if (humOn) loop('shed', SND('workshop-night-ambience-loop'), { volume: 0.35, global: true })
    else stopLoop('shed')
  }
}

// --- one frame of the maker (maker.js onInput + update) --------------------------------------------------------
// the phone's buttons follow the maker: see touch.ts
const touch = (inside: boolean) => applyTouch({ modal: inside && (UI.guide ?? !UI.guideSeen), inside, hold: inside && UI.canWork, holding: !!UI.held })
const pressed = (a: InputAction) => inputSystem.isTriggered(a, PointerEventType.PET_DOWN)
let workAt: string | null = null
let workSaid = 0

function frame(dt: number) {
  const p = pose()
  lastPose = p

  const inside = followRoom(p, dt)
  UI.entering = myRoom() >= 0 && !inside
  UI.inside = inside
  UI.held = myHeld() // the server's word on what is in my hands
  syncHands()
  shiftEdges()
  musicSwitch()
  if (interior) {
    updateCustomers(dt)
    updatePops(dt)
    syncFloor()
  }

  if (!inside) {
    // on the lot: E (or the HUD's ENTRAR) in front of the door asks the server for a place in a room
    setMarker(null)
    setGuide(null, '')
    UI.look = null
    UI.verb = null
    UI.canWork = false
    UI.canThrow = false
    touch(false)
    const d = myRoom() < 0 && atDoor(p)
    UI.nearDoor = d
    if (d && (pressed(InputAction.IA_PRIMARY) || UI.wantEnter)) sendEnter()
    UI.wantEnter = false
    UI.wantExit = false
    UI.wantStart = false
    if (workAt) workAt = null
    return
  }
  UI.nearDoor = false

  if (UI.wantExit) {
    UI.wantExit = false
    sendLeave() // the server frees my place; followRoom brings me down to the lot
    play('heavy-wooden-barn-door-creak-open', { x: 0, y: 1.2, z: 4.1 }, 0.7)
    return
  }
  if (UI.wantStart) {
    UI.wantStart = false
    if (!shift().on) {
      sendStart() // ¡ACCIÓN!: the server's referee starts the shift
      UI.guide = false
      UI.guideSeen = true
    }
  }

  const h = UI.held
  const st = target(p)
  // a prop on the floor ahead matters with empty hands (take it) or when it joins with what I hold
  const ahead = looseAhead(p)
  const l = ahead && (!h || join(h, ahead.it)) ? ahead : null
  const look = l ? null : st
  UI.look = look?.id ?? null
  setMarker(look)
  UI.floorVerb = l ? (h ? 'UNIR' : 'TOMAR') : null
  const v = l ? { verb: UI.floorVerb, work: false, wv: undefined } : verbOf(st, h)
  UI.canThrow = !!h
  UI.verb = v.verb
  UI.canWork = v.work
  touch(true)
  if (v.wv) UI.workVerb = v.wv

  if (pressed(InputAction.IA_PRIMARY)) {
    if (l) sendPick(l.id)
    else if (st) sendUse(st.id)
  }
  if (pressed(InputAction.IA_ACTION_3) && h) {
    // Spawn lobs the held prop with Q; after playtests the owner asked for a drop that means "leave it here": onto
    // the bench you face (joining if it fits), into the trash, else on the floor just in front of your feet
    sendDrop(p.x + p.fx * DROP_AHEAD, p.z + p.fz * DROP_AHEAD, (Math.atan2(-p.fx, -p.fz) * 180) / Math.PI + 90, st?.id ?? '')
  }

  // the first-order guide: until the shift's first delivery, an arrow over the station needed next (@sebadl)
  const P = shift()
  // only for the very first order: once a delivery has been seen, the arrows never come back (playtest feedback)
  if (P.served > 0) UI.guided = true
  // the ¡ACCIÓN! button only fronts the very first take; every take after that restarts from the ¡CORTEN! card
  if (P.on) UI.playedOnce = true
  const step = P.on && !UI.guided ? nextStep(P.orders, h, nameOf) : null
  setGuide(step?.id ?? null, step ? (UI.lang === 'en' ? step.en : step.es) : '')

  // the main action held at the grinder or the pump: say so to the server (and keep saying it, it forgets after
  // a second of silence); the server fills the bar and changes the prop in your grip
  const working = inputSystem.isPressed(InputAction.IA_PRIMARY) && v.work && !!st && !l ? (st as Station).id : null
  workSaid += dt
  if (working !== workAt) {
    if (workAt) sendWork(workAt, false)
    if (working) sendWork(working, true)
    workAt = working
    workSaid = 0
  } else if (working && workSaid > 0.4) {
    sendWork(working, true)
    workSaid = 0
  }
}

export function initGame() {
  // what the server lets everyone hear and see
  // The shed's camera hangs ~10 m up, so a sound placed at a bench arrived faint (playtest: the good-feedback
  // sounds went unheard, the buzz at the player did not). In the shed every feedback sound is heard flat.
  room.onMessage('snd', (m) => playFlat(m.n, 1))
  room.onMessage('pop', (m) => popNumber(m.text, m.x, m.z, m.good ? Color4.create(0.96, 0.76, 0.47, 1) : Color4.create(0.88, 0.28, 0.23, 1)))
  room.onMessage('crate', (m) => {
    // a crate answers a good grab: it bounces and pops the item's name over it (maker.js crateHit)
    const st = STATIONS.find((s) => s.id === m.station)
    if (!st) return
    crateBounce(st.id)
    popNumber('+' + nameOf(m.k, UI.lang === 'en'), st.x, st.z, Color4.create(0.965, 0.757, 0.467, 1), 0.9, 1.3)
  })
  room.onMessage('hint', (m) => {
    playFlat('buzz-short', 0.9)
    hint(m.es, m.en)
  })
  // the lot at night, the shed's hum
  loop('crickets', SND('night-crickets-distant-wind-eerie-ambience-loop'), { volume: 0.35, global: true })
  loop('balloon', SND('film-set-balloon-light-electric-hum-loop'), { at: { x: 0, y: 6, z: 10 }, volume: 0.5 })
  // @sebadl: no jumping or emoting in The Set. disableEmote only takes effect on the DCL 2.0 desktop client —
  // the web/mobile explorer ignores InputModifier entirely, so this is a no-op there (no scene-side way to
  // block it or hide the emote wheel button on those clients)
  InputModifier.createOrReplace(engine.PlayerEntity, { mode: InputModifier.Mode.Standard({ disableJump: true, disableEmote: true }) })
  engine.addSystem(frame)
}
