// Pure-logic checks for the port (no engine): recipes through the station rules, patience numbers, and whole
// shifts run through the referee. Run: npx esbuild test/logic.test.ts --bundle --platform=node --outfile=test/out.js && node test/out.js
import { DishId, S } from '../src/config'
import { newShift, patienceMs, tick } from '../src/referee'
import { addPart, canAdd, dippable, dishOf, GIVES, Item, sharpenable, STATIONS, stationUnder, WINDOWS } from '../src/shop'

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
ok(STATIONS.length === 23, '23 stations, got ' + STATIONS.length)
ok(WINDOWS.every((w) => STATIONS.some((s) => s.id === w)), 'both windows are placed')
ok(stationUnder(-4.2, -2.2)?.id === 'ctr-1' && stationUnder(0, 0) === null, 'stationUnder finds a bench and not the middle of the floor')

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
  ok(P.n >= 3, 'seed ' + seed + ': at least the three teaching customers came, got ' + P.n)
  totalServed += P.served
  totalMissed += P.missed
}
console.log('shifts 300 · served ' + totalServed + ' · missed ' + totalMissed)
console.log(fails ? fails + ' FAILED' : 'all checks passed')
process.exit(fails ? 1 : 0)
