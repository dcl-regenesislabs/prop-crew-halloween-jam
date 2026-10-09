// Galpón de Utilería, Decentraland port of the Spawn world @sebadl/galpon-de-utileria (seq 292).
// A co-op rush on a horror film lot: movie monsters queue at the prop shed's two windows, and the makers
// inside build what each one asks for (bloody knife, machete, chainsaw, flashlight, walkie, bladed glove)
// before their patience runs out. 180 s shifts, score, one to three stars.
// Spawn's two places (the lot as lobby, the shed in play) are one lot here: the green door goes in, the
// HUD's SALIR comes back out.
import { engine, SkyboxTime } from '@dcl/sdk/ecs'
import { initAudio } from './audio'
import { initCamera } from './camera'
import { initGame } from './game'
import { setupHud } from './hud'
import { buildLot } from './lot'
import { initNet } from './net'
import { buildShed, buildStations } from './shed'

export function main() {
  // aesthetic.yml: hour 21, "cold moonlight over the lot, warm bulbs in the prop shed"
  SkyboxTime.createOrReplace(engine.RootEntity, { fixedTime: 0 })
  initAudio()
  initNet()
  buildLot()
  buildShed()
  buildStations()
  initCamera()
  initGame()
  setupHud()
}
