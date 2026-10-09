// Galpón de Utilería, Decentraland port of the Spawn world @sebadl/galpon-de-utileria (seq 292).
// A co-op rush on a horror film lot: movie monsters queue at the prop shed's two windows, and the makers
// inside build what each one asks for (bloody knife, machete, chainsaw, flashlight, walkie, bladed glove)
// before their patience runs out. 180 s shifts, score, one to three stars.
// Spawn's two places (the lot as lobby, the shed in play) are one lot here: the green door goes in, the
// HUD's SALIR comes back out.
import { engine, SkyboxTime } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { initAudio } from './audio'
import { initCamera } from './camera'
import { initGame } from './game'
import { setupHud } from './hud'
import { buildLot } from './lot'
import { initNet } from './net'
import { buildClosedShed } from './shed'
import { initServer } from './server/server'
import { UI } from './state'
// the shared components and messages must be defined at module load, on both sides
import './shared/components'
import './shared/messages'

export function main() {
  if (isServer()) {
    // the headless authority: the referee, the stations, the floor, everyone's hands
    initServer()
    return
  }
  // a maker's client: the world, the camera, the HUD, and telling the server what you try to do
  // aesthetic.yml: hour 21, "cold moonlight over the lot, warm bulbs in the prop shed"
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 0 })
  initAudio()
  initNet()
  buildLot()
  buildClosedShed()
  initCamera()
  initGame()
  setupHud()
  // phone or desktop: only the HUD's wording cares. Loaded here, off the server's path.
  void import('@dcl/sdk/platform').then((m) => (UI.mobile = m.isMobile()))
}
