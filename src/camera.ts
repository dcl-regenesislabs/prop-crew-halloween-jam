// The shed camera: fixed high over the front, the whole shed centred across the screen (@sebadl: no follow).
// The distance grows until the shed's full width fits the screen, so a phone held upright still sees wall to wall.
// Ported from scripts/camera.js. Spawn moves its own camera; a scene cannot, so a VirtualCamera stands where
// Spawn's would and becomes the main camera while the maker is inside. On the lot the client's own
// third-person camera takes over (Spawn's free orbit, scripts/camera-free.js).
import { engine, Entity, MainCamera, Transform, UiCanvasInformation, VirtualCamera } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'
import { insideShed, ORIGIN } from './config'
import { roomY, sp } from './gfx'
import { UI } from './state'

// Spawn looks down at 56 degrees (pitch -0.98). Playtest: "no verlo tan desde arriba y acercarla": 42 degrees.
const PITCH = -0.74
const RATE = 6
const HALF_W = 6.7
const CLOSE = 9.8
let cam: Entity
let active = false
let px: number | null = null
let pz: number | null = null
let fov = 45

export function initCamera() {
  cam = engine.addEntity()
  const from = sp(0, 12, 7.2)
  Transform.create(cam, { position: from, rotation: Quaternion.fromLookAt(from, sp(0, 0.8, -0.3)) })
  VirtualCamera.create(cam, { defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0.6) }, fov })
  engine.addSystem(update)
}

function update(dt: number) {
  const want = UI.inside
  if (want !== active) {
    active = want
    // createOrReplace on first use: MainCamera may not exist yet
    MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: want ? cam : undefined })
    if (!want) {
      px = null
      pz = null
    }
  }
  if (!active) return
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (!t) return
  const fx = t.position.x - ORIGIN.x
  const fz = ORIGIN.z - t.position.z
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  const aspect = canvas && canvas.height > 0 ? canvas.width / canvas.height : 1.7
  const tall = aspect < 1
  const wantFov = tall ? 62 : 45
  const hfov = 2 * Math.atan(Math.tan((wantFov * Math.PI) / 360) * aspect)
  // Spawn keeps at least 13.5 m (15 on narrow screens). Playtest feedback was "no se ve nada": on a phone the
  // shed filled only half the height, so the floor distance comes in to CLOSE and only the width fit can push it out.
  const dist = Math.max(CLOSE, (HALF_W / Math.tan(hfov / 2)) * 1.03)
  if (wantFov !== fov) {
    fov = wantFov
    VirtualCamera.getMutable(cam).fov = fov
  }
  const inside = insideShed(fx, fz)
  const gx = inside ? 0 : fx
  const gz = inside ? 1.2 : fz // aimed a little in front of the middle, so the front row clears the bottom HUD
  const k = 1 - Math.exp(-RATE * dt)
  px = px === null ? gx : px + (gx - px) * k
  pz = pz === null ? gz : pz + (gz - pz) * k
  const from = sp(px, roomY + 0.8 - Math.sin(PITCH) * dist, pz + Math.cos(PITCH) * dist)
  const tr = Transform.getMutable(cam)
  tr.position = from
  tr.rotation = Quaternion.fromLookAt(from, sp(px, roomY + 0.8, pz))
}
