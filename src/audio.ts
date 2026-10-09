// Sound: a pool of one-shot emitters moved to where the sound happens, plus named loops.
// Spawn's ctx.emit("playSound", {clip, position}) becomes play(name, position) in Spawn coordinates.
// Adapted from the skill's reference port (examples/fuera-de-la-realidad/src/audio.ts).
import { AudioSource, engine, Entity, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { SND } from './config'
import { sp } from './gfx'

const POOL = 10
const pool: Entity[] = []
let next = 0
const flatPool: Entity[] = []
let flatNext = 0

export function initAudio() {
  for (let k = 0; k < POOL; k++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, -10, 0) })
    AudioSource.create(e, { audioClipUrl: SND('grab-tool'), playing: false, volume: 1 })
    pool.push(e)
  }
  for (let k = 0; k < 3; k++) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.Zero() })
    AudioSource.create(e, { audioClipUrl: SND('grab-tool'), playing: false, volume: 1, global: true })
    flatPool.push(e)
  }
}

// a positioned one-shot (Spawn coordinates)
export function play(name: string, at: { x: number; y?: number; z: number }, volume = 0.8) {
  const e = pool[next]
  next = (next + 1) % POOL
  Transform.getMutable(e).position = sp(at.x, at.y ?? 1, at.z)
  AudioSource.getMutable(e).volume = volume
  AudioSource.playSound(e, SND(name))
}

// a sound for everyone wherever they stand: the clapperboard, the whistle
export function playFlat(name: string, volume = 1) {
  const e = flatPool[flatNext]
  flatNext = (flatNext + 1) % flatPool.length
  AudioSource.getMutable(e).volume = volume
  AudioSource.playSound(e, SND(name))
}

const loops = new Map<string, Entity>()
export function loop(id: string, url: string, opts: { at?: { x: number; y: number; z: number }; volume?: number; global?: boolean }) {
  let e = loops.get(id)
  if (!e) {
    e = engine.addEntity()
    loops.set(id, e)
    Transform.create(e, { position: opts.at ? sp(opts.at.x, opts.at.y, opts.at.z) : Vector3.Zero() })
  }
  const cur = AudioSource.getOrNull(e)
  if (cur && cur.audioClipUrl === url && cur.playing) return e
  AudioSource.createOrReplace(e, { audioClipUrl: url, playing: true, loop: true, volume: opts.volume ?? 1, global: !!opts.global })
  return e
}
export function stopLoop(id: string) {
  const e = loops.get(id)
  if (!e) return
  const a = AudioSource.getOrNull(e)
  if (a?.playing) AudioSource.getMutable(e).playing = false
}
