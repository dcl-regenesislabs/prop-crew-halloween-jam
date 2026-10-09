// The referee of the prop shed: the shift clock, the line of monsters, the orders, the score.
// Ported from places/main/sim.js. In Spawn the relay seats one client to run it; here the host client does
// (net.ts isHost). Pure logic over a plain state object so the Node tests can run whole shifts.
import { DishId, S, WhoId } from './config'
import { ENTRY, EXIT, LINE_SPOT, WINDOWS, WINDOW_SPOT } from './shop'

export type Order = { cust: string; dish: DishId; who: WhoId; until: number; max: number }
export type Customer = {
  id: string
  who: WhoId
  dish: DishId
  to: { x: number; z: number }
  leave: boolean
  mood: '' | 'happy' | 'sad' | 'angry'
  bar: boolean // the patience bar shows once the customer is called to a window
}
export type Last = { score: number; served: number; missed: number; stars: number }
export type ShiftState = {
  on: boolean
  endsAt: number
  startAt: number
  score: number
  served: number
  missed: number
  best: number
  last: Last | null
  orders: Record<string, Order>
  line: string[]
  customers: Customer[]
  nextAt: number
  n: number
  rungAt: number
}
export const newShift = (): ShiftState => ({
  on: false,
  endsAt: 0,
  startAt: 0,
  score: 0,
  served: 0,
  missed: 0,
  best: 0,
  last: null,
  orders: {},
  line: [],
  customers: [],
  nextAt: 0,
  n: 0,
  rungAt: 0
})

export type Fx =
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'served'; cust: string; pts: number; x: number; z: number }
  | { t: 'missed'; cust: string; x: number; z: number }

export type Env = {
  now: number
  random: () => number
  startReq: number // the newest ¡ACCIÓN! request among the players
  served: string[] // customer ids a player handed the right prop to since the last tick
  gone: string[] // leaving customers whose walk out has finished
}

const WHO = Object.keys(S.who) as WhoId[]
export const patienceMs = (dish: DishId) => (S.dishes[dish].seconds + S.margin + S.walkIn) * 1000

function leave(P: ShiftState, id: string, mood: Customer['mood']) {
  const c = P.customers.find((x) => x.id === id)
  if (!c) return
  c.leave = true
  c.mood = mood
  c.to = { ...EXIT }
  c.bar = false
}

// Runs every 250 ms on the host. Mutates P; returns what happened (sounds, popups) and whether P changed.
export function tick(P: ShiftState, env: Env): { fx: Fx[]; changed: boolean } {
  const fx: Fx[] = []
  const now = env.now
  let changed = false
  // customers that finished their walk out
  if (env.gone.length) {
    const before = P.customers.length
    P.customers = P.customers.filter((c) => !(c.leave && env.gone.includes(c.id)))
    if (P.customers.length !== before) changed = true
  }
  // the HUD's ¡ACCIÓN! button: a request newer than the last one starts the shift
  if (env.startReq > P.rungAt) {
    P.rungAt = env.startReq
    changed = true
    if (!P.on) {
      Object.assign(P, {
        on: true,
        endsAt: now + S.shiftSeconds * 1000,
        startAt: now,
        score: 0,
        served: 0,
        missed: 0,
        orders: {},
        line: [],
        customers: [],
        nextAt: now + S.firstOrderDelay * 1000,
        n: 0,
        last: null
      })
      fx.push({ t: 'start' })
    }
  }
  if (!P.on) return { fx, changed }
  // the whistle
  if (now >= P.endsAt) {
    for (const id of [...Object.values(P.orders).map((o) => o.cust), ...P.line]) leave(P, id, 'sad')
    const stars = S.stars.filter((t) => P.score >= t).length
    P.last = { score: P.score, served: P.served, missed: P.missed, stars }
    P.best = Math.max(P.best, P.score)
    P.on = false
    P.orders = {}
    P.line = []
    // hands, benches and the floor are cleared by game.ts on the 'end' effect
    fx.push({ t: 'end' })
    return { fx, changed: true }
  }
  // a new monster joins the line
  const busy = Object.keys(P.orders).length + P.line.length
  if (now >= P.nextAt && busy < S.maxOrders + S.queue && P.customers.filter((c) => !c.leave).length < S.maxOrders + S.queue) {
    const n = P.n + 1
    const who = n <= S.teach.length ? S.teach[n - 1] : WHO[Math.floor(env.random() * WHO.length)]
    const id = 'c' + n + '-' + Math.floor(now % 100000)
    P.customers.push({ id, who, dish: S.who[who].dish, to: LINE_SPOT(P.line.length), leave: false, mood: '', bar: false })
    P.line.push(id)
    P.n = n
    const prog = Math.min(1, (now - P.startAt) / (S.shiftSeconds * 1000))
    P.nextAt = now + (S.orderGapStart + (S.orderGapEnd - S.orderGapStart) * prog) * 1000
    changed = true
  }
  // free windows call the front of the line
  for (const w of WINDOWS) {
    if (P.orders[w] || !P.line.length) continue
    const cust = P.line.shift() as string
    const c = P.customers.find((x) => x.id === cust)
    if (!c) continue
    const max = patienceMs(c.dish)
    P.orders[w] = { cust, dish: c.dish, who: c.who, until: now + max, max }
    c.to = WINDOW_SPOT(w)
    c.bar = true
    changed = true
  }
  P.line.forEach((id, i) => {
    const c = P.customers.find((x) => x.id === id)
    const t = LINE_SPOT(i)
    if (c && (c.to.x !== t.x || c.to.z !== t.z)) {
      c.to = t
      changed = true
    }
  })
  // patience, serves and walk-outs
  for (const w of Object.keys(P.orders)) {
    const o = P.orders[w]
    const c = P.customers.find((x) => x.id === o.cust)
    if (!c) {
      delete P.orders[w]
      changed = true
      continue
    }
    const spot = WINDOW_SPOT(w)
    if (env.served.includes(o.cust)) {
      const pct = Math.max(0, (o.until - now) / o.max)
      const pts = S.dishes[o.dish].reward + Math.round(S.tipMax * pct)
      P.score += pts
      P.served += 1
      fx.push({ t: 'served', cust: o.cust, pts, x: spot.x, z: spot.z })
      leave(P, o.cust, 'happy')
      delete P.orders[w]
      changed = true
      continue
    }
    if (now >= o.until) {
      P.score -= S.missPenalty
      P.missed += 1
      fx.push({ t: 'missed', cust: o.cust, x: spot.x, z: spot.z })
      leave(P, o.cust, 'angry')
      delete P.orders[w]
      changed = true
    }
  }
  return { fx, changed }
}

export { ENTRY }
