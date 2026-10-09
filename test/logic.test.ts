// Pure-logic checks for the port (no engine): recipes through the station rules, patience numbers, and whole
// shifts run through the referee. Run: npx esbuild test/logic.test.ts --bundle --platform=node --outfile=test/out.js && node test/out.js
import { DishId, S } from '../src/config'
import { newShift, patienceMs, tick } from '../src/referee'
import { pickRoom, ROOM_CAP, ROOM_Y, ROOMS } from '../src/shared/rooms'
import { addPart, BY_ID, canAdd, dippable, dishOf, GIVES, Item, nextStep, sharpenable, STATIONS, stationUnder, WINDOWS } from '../src/shop'

let fails = 0
const ok = (cond: boolean, what: string) => {
  if (!cond) {
    fails++
    console.log('FAIL', what)
  }
}

// 1. every recipe is completable through the stations that exist, and dishOf recognises it only when finished
const supplies = STATIONS.filter((s) => s.kind === 'supply').map((s) => GIVES(s.id))
for (const d of Object.keys(S.dishes) as DishId[]) {
  const R = S.dishes[d]
  ok(supplies.includes(R.base), d + ': a crate gives the base ' + R.base)
  let it: Item = { k: R.base }
  ok(dishOf(it) === null || (R.parts.length === 0 && !R.sharp && !R.blood && !R.gas), d + ': bare base is not finished')
  for (const p of R.parts) {
    ok(supplies.includes(p), d + ': a crate gives the part ' + p)
    ok(canAdd(it, { k: p }), d + ': part ' + p + ' fits')
    it = addPart(it, { k: p })
    ok(!canAdd(it, { k: p }), d + ': part ' + p + ' fits only once')
  }
  if (R.sharp) {
    ok(dishOf(it) === null, d + ': not finished before sharpening')
    ok(sharpenable(it), d + ': the grinder takes it')
    it = { ...it, s: 1 }
  }
  if (R.blood) {
    ok(dishOf(it) === null, d + ': not finished before the bucket')
    ok(dippable(it), d + ': the bucket takes it')
    it = { ...it, b: 1 }
  }
  if (R.gas) {
    ok(dishOf(it) === null, d + ': not finished before fuel')
    it = { ...it, g: 1 }
  }
  ok(dishOf(it) === d, d + ': finished prop is recognised, got ' + dishOf(it))
}
// the glove: blades sharpened first carry their edge; a bare glove does not sharpen
ok(!sharpenable({ k: 'glove' }), 'bare glove does not sharpen')
ok(dishOf(addPart({ k: 'glove' }, { k: 'blades', s: 1 })) === 'glove', 'pre-sharpened blades finish the glove')
ok(!canAdd({ k: 'knife' }, { k: 'bulb' }), 'a bulb does not go on a knife')
ok(STATIONS.length === 24, '24 stations, got ' + STATIONS.length)
ok(new Set(STATIONS.map((s) => s.x + ',' + s.z)).size === 24, 'no two stations share a spot')
ok(WINDOWS.every((w) => STATIONS.some((s) => s.id === w)), 'both windows are placed')
ok(stationUnder(-5.4, -3.4)?.id === 'ctr-1' && stationUnder(0, 0) === null, 'stationUnder finds a bench and not the middle of the floor')

// 1b. the first-order guide walks every recipe from empty hands to the right window, one station at a time
for (const d of Object.keys(S.dishes) as DishId[]) {
  const orders = { 'win-2': { dish: d, until: 5 } }
  let h: Item | null = null
  let steps = 0
  const names = (k: string) => k
  ok(nextStep(orders, { k: 'scrap' }, names)?.id === 'trash', d + ': holding the wrong thing points at the trash')
  for (; steps < 8; steps++) {
    const n = nextStep(orders, h, names)
    ok(!!n && !!BY_ID[n.id], d + ': guide names a real station at step ' + steps)
    if (!n) break
    const st = BY_ID[n.id]
    if (st.kind === 'window') break
    const cur: Item | null = h
    if (st.kind === 'supply') h = cur ? addPart(cur, { k: GIVES(st.id) as string }) : { k: GIVES(st.id) as string }
    else if (st.kind === 'grinder' && cur) h = { ...cur, s: 1 }
    else if (st.kind === 'bucket' && cur) h = { ...cur, b: 1 }
    else if (st.kind === 'pump' && cur) h = { ...cur, g: 1 }
  }
  ok(dishOf(h) === d && nextStep(orders, h, names)?.id === 'win-2', d + ': guide ends at the window with the finished prop, got ' + dishOf(h))
}
ok(nextStep({}, null, (k) => k) === null, 'no orders, no guide')

// 1c. rooms fill like Spawn's routing: the fullest room with space, the next one when that is full, nobody when all are
ok(pickRoom([0, 0, 0]) === 0, 'the first maker opens room 0')
ok(pickRoom([1, 0, 0]) === 0 && pickRoom([3, 0, 0]) === 0, 'later makers join the room that is filling')
ok(pickRoom([4, 0, 0]) === 1, 'a full room sends the next maker to a new one')
ok(pickRoom([4, 2, 3]) === 2 && pickRoom([2, 4, 2]) === 0, 'the fullest room with space wins, lowest number on a tie')
ok(pickRoom([4, 4, 4]) === -1, 'all rooms full: no place')
{
  // twelve arrivals fill three rooms of four in order; one leaving frees a place in its room
  const counts = [0, 0, 0]
  const order: number[] = []
  for (let i = 0; i < 13; i++) {
    const k = pickRoom(counts)
    order.push(k)
    if (k >= 0) counts[k]++
  }
  ok(order.join('') === '000011112222-1', 'arrival order fills rooms 0, 1, 2 then refuses: ' + order.join(','))
  counts[1]--
  ok(pickRoom(counts) === 1, 'a place freed in room 1 is the next one given')
}
ok(ROOMS === ROOM_Y.length && ROOM_CAP === 4, 'one height per room, four makers each')

// 2. patience = seconds + margin + walkIn
ok(patienceMs('knife') === 34000 && patienceMs('walkie') === 39000 && patienceMs('glove') === 39000, 'patience 34 s / 39 s')

// 3. whole shifts through the referee, seeded, with makers of different skill
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
let totalServed = 0
let totalMissed = 0
for (let seed = 1; seed <= 300; seed++) {
  const r = rng(seed)
  const skill = (seed % 10) / 25 // chance per second that an open order gets served: from never to quick
  const P = newShift()
  let now = 1_000_000 + seed * 977
  const leftAt: Record<string, number> = {}
  let started = false
  let ended = false
  let maxOrders = 0
  let maxHere = 0
  let scoreCheck = 0
  let prevDish = ''
  let seenN = 0
  for (let step = 0; step < (S.shiftSeconds + 30) * 4; step++) {
    now += 250
    const served: string[] = []
    for (const w of Object.keys(P.orders)) if (r() < skill / 4) served.push(P.orders[w].cust)
    const gone = P.customers.filter((c) => c.leave && now - (leftAt[c.id] ??= now) > 8000).map((c) => c.id)
    const out = tick(P, { now, random: r, startReq: 1, served, gone })
    for (const f of out.fx) {
      if (f.t === 'start') started = true
      if (f.t === 'end') ended = true
      if (f.t === 'served') {
        scoreCheck += f.pts
        const max = Math.max(...Object.values(S.dishes).map((d) => d.reward)) + S.tipMax
        ok(f.pts >= 20 && f.pts <= max, 'seed ' + seed + ': reward in range, got ' + f.pts)
      }
      if (f.t === 'missed') scoreCheck -= S.missPenalty
    }
    if (P.n !== seenN) {
      seenN = P.n
      ok(P.lastDish !== prevDish, 'seed ' + seed + ': never the same prop twice running (' + P.lastDish + ')')
      prevDish = P.lastDish
    }
    maxOrders = Math.max(maxOrders, Object.keys(P.orders).length)
    maxHere = Math.max(maxHere, P.customers.filter((c) => !c.leave).length)
    for (const w of Object.keys(P.orders)) ok(P.customers.some((c) => c.id === P.orders[w].cust), 'seed ' + seed + ': every order has its customer')
  }
  ok(started && ended, 'seed ' + seed + ': the shift started and ended')
  ok(maxOrders <= S.maxOrders, 'seed ' + seed + ': never more than ' + S.maxOrders + ' orders, got ' + maxOrders)
  ok(maxHere <= S.maxOrders + S.queue, 'seed ' + seed + ': never more than ' + (S.maxOrders + S.queue) + ' customers waiting, got ' + maxHere)
  ok(!P.on && Object.keys(P.orders).length === 0 && P.line.length === 0, 'seed ' + seed + ': ends with no orders and no line')
  ok(!!P.last && P.last.score === scoreCheck && P.score === scoreCheck, 'seed ' + seed + ': score adds up')
  ok(P.customers.length === 0, 'seed ' + seed + ': every customer walked off, left ' + P.customers.length)
  ok(P.n >= 3, 'seed ' + seed + ': customers kept coming, got ' + P.n)
  totalServed += P.served
  totalMissed += P.missed
}
console.log('shifts 300 · served ' + totalServed + ' · missed ' + totalMissed)
console.log(fails ? fails + ' FAILED' : 'all checks passed')
process.exit(fails ? 1 : 0)
