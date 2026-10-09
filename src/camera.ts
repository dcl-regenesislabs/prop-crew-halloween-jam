// The shed camera: high over the front, looking down into the workshop. Wide screens see the whole shed;
// a phone held upright gets a closer, wider lens that follows the maker side to side.
// Ported from scripts/camera.js. Spawn moves its own camera; a scene cannot, so a VirtualCamera stands where
// Spawn's would and becomes the main camera while the maker is inside. On the lot the client's own
// third-person camera takes over (Spawn's free orbit, scripts/camera-free.js).
import { engine, Entity, MainCamera, Transform, UiCanvasInformation, VirtualCamera } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'
import { insideShed, ORIGIN } from './config'
import { sp } from './gfx'
import { UI } from './state'

const PITCH = -0.98
const RATE = 6
let cam: Entity
let active = false
let px: number | null = null
let pz: number | null = null
let fov = 45

export function initCamera() {
  cam = engine.addEntity()
  const from = sp(0, 10.35, 6.1)
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
  const dist = tall ? 15.5 : aspect < 1.4 ? 13 : 11.5
  const wantFov = tall ? 62 : 45
  if (wantFov !== fov) {
    fov = wantFov
    VirtualCamera.getMutable(cam).fov = fov
  }
  const inside = insideShed(fx, fz)
  const gx = !inside ? fx : tall ? Math.max(-3.4, Math.min(3.4, fx)) : Math.max(-1.8, Math.min(1.8, fx * 0.4))
  const gz = !inside ? fz : tall ? Math.max(-1.6, Math.min(0.2, fz * 0.4 - 0.9)) : Math.max(-0.4, Math.min(0.6, fz * 0.2)) - 0.3
  const k = 1 - Math.exp(-RATE * dt)
  px = px === null ? gx : px + (gx - px) * k
  pz = pz === null ? gz : pz + (gz - pz) * k
  const from = sp(px, 0.8 - Math.sin(PITCH) * dist, pz + Math.cos(PITCH) * dist)
  const tr = Transform.getMutable(cam)
  tr.position = from
  tr.rotation = Quaternion.fromLookAt(from, sp(px, 0.8, pz))
}
