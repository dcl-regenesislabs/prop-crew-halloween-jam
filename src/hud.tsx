// The maker's screen: a port of the Spawn world's scripts/ui.js (the HUD, written there as HTML + CSS), with
// scripts/lib/guide.js for the station guide. Same elements, colours, wording and places:
//   lot    top-centre card with the two doors, ENTRAR when you stand at one, the walk-in curtain, ES/EN
//   shed   top-centre pills (REC clock, $ score, ?, the way out, público), tickets top-right, the hands block
//          bottom-centre (hint, key prompt, station tip, what you hold), ¡ACCIÓN! between takes, the ¡CORTEN! card
//   guide  opens by itself on the first visit; photo cards, a worked example, ¡A trabajar!
// What cannot be the same in scene UI: the typeface (Spawn: Geist Pixel Square), emoji (dropped or replaced by
// a word or an icon) and, on some clients, rounded corners. Sizes are Spawn's phone-landscape CSS scaled to the
// 1600x720 canvas a phone gets. Coded React-ECS (data-driven, not UI-Designer editable).
import ReactEcs, { InteractableArea, Label, ReactEcsRenderer, ScreenInsetArea, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { DISH_EN, DishId, NAMES_EN, S } from './config'
import { hands, now, serverAwake, shift, stationItem, waitedFor } from './net'
import { setSignsLang } from './shed'
import { BY_ID, canAdd, dippable, dishOf, GIVES, Item, sharpenable, STEPS } from './shop'
import { UI } from './state'

const hex = (h: string, a = 1) => Color4.create(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, a)
// the colours of ui.js
const TEXT = hex('#f6e3c4')
const PANEL = hex('#1a1020', 0.9)
const EDGE = hex('#8a3a1a')
const AMBER = hex('#f6c177')
const PAPER = hex('#f3e6c8')
const INK = hex('#2b1b3d')
const RED = hex('#c0392b')
const REC = hex('#e0473a')
const ORANGE = hex('#e07b39')
const CREAM = hex('#fff3d0')
const SALMON = hex('#ff8a7a')
const PUB = hex('#7fd28f')
const PRV = hex('#ff7a6b')
const GREEN = hex('#2f8a4a')
const BLOOD = hex('#b3121b')
// matches the native client's own round icon buttons (profile/terminal/screenshot/reload, top-left)
const NATIVE_BG = hex('#000000', 0.55)
const NATIVE_EDGE = hex('#ffffff', 0.35)
const WHITE = hex('#ffffff')

const EN = () => UI.lang === 'en'
function setLang(l: 'es' | 'en') {
  UI.lang = l
  setSignsLang(l)
}
const nameOf = (k: string) => (EN() ? NAMES_EN[k] : S.names[k]) ?? k

// --- the words (ui.js itemName / prompt / tip) ----------------------------------------------------------------
function itemName(it: Item | null) {
  if (!it) return ''
  const d = dishOf(it)
  if (d) return (EN() ? DISH_EN[d] : S.dishes[d].name) + ' ✓'
  const adds = (it.p ?? []).map((p) => nameOf(p))
  if (it.s) adds.push(EN() ? 'sharpened' : 'afilado')
  if (it.b) adds.push(EN() ? 'bloody' : 'con sangre')
  if (it.g) adds.push(EN() ? 'fuelled' : 'con nafta')
  return adds.length ? nameOf(it.k) + ' + ' + adds.join(' + ') : nameOf(it.k)
}
// desktop has no on-screen button to point at, so it still needs the key named; mobile only has the main button
const K = (s: string) => (UI.mobile ? s : 'E ' + s)
const KHold = (en: boolean, s: string) => (UI.mobile ? (en ? 'hold ' : 'mantené ') + s : (en ? 'hold E ' : 'mantené E ') + s)
function prompt(): string {
  // a prop on the floor ahead: take it, or join it with what you hold
  if (UI.floorVerb) return EN() ? K(UI.floorVerb === 'UNIR' ? 'join' : 'take') : K(UI.floorVerb === 'UNIR' ? 'unir' : 'tomar')
  const st = UI.look ? BY_ID[UI.look] : null
  if (!st) return ''
  const h = UI.held
  const it = stationItem(st.id)
  const en = EN()
  switch (st.kind) {
    case 'supply': {
      const g = { k: GIVES(st.id) as string }
      return !h ? K(en ? 'take ' : 'tomar ') + nameOf(g.k) : canAdd(h, g) ? K(en ? 'add ' : 'poner ') + nameOf(g.k) : ''
    }
    case 'grinder':
      return sharpenable(h) ? KHold(en, en ? 'to sharpen' : 'para afilar') : !h && it ? K(en ? 'take' : 'tomar') : ''
    case 'pump':
      return h?.k === 'saw' && !h.g ? KHold(en, en ? 'to fuel up' : 'para cargar nafta') : !h && it ? K(en ? 'take' : 'tomar') : ''
    case 'counter':
      return h && !it ? K(en ? 'set down' : 'apoyar') : !h && it ? K(en ? 'take' : 'tomar') : h && it ? K(en ? 'combine' : 'combinar') : ''
    case 'bucket':
      return dippable(h) ? K(en ? 'dip in fake blood' : 'mojar en sangre falsa') : ''
    case 'trash':
      return h ? K(en ? 'toss ' : 'tirar ') + nameOf(h.k) : ''
    case 'window':
      return shift().orders[st.id] && h ? K(en ? 'hand over' : 'entregar') : ''
  }
  return ''
}
// a station with nothing to do right now still says what it is and what it wants
function tip(): { k: string; n: string; d: string } | null {
  const st = UI.look ? BY_ID[UI.look] : null
  if (!st) return null
  const h = UI.held
  const en = EN()
  const mobile = UI.mobile
  switch (st.kind) {
    case 'grinder':
      return {
        k: '',
        n: en ? 'Grinder' : 'Amoladora',
        d: h?.s
          ? en
            ? 'already sharp'
            : 'ya está afilado'
          : en
            ? (mobile ? 'hold' : 'hold E') + ' to sharpen'
            : (mobile ? 'mantené' : 'mantené E') + ' para afilar'
      }
    case 'pump':
      return {
        k: '',
        n: en ? 'Gas pump' : 'Surtidor de nafta',
        d: h?.k === 'saw' && h.g
          ? en
            ? 'already fuelled'
            : 'ya tiene nafta'
          : en
            ? (mobile ? 'hold' : 'hold E') + ' to fuel up'
            : (mobile ? 'mantené' : 'mantené E') + ' para cargar nafta'
      }
    case 'trash':
      return { k: '', n: en ? 'Trash' : 'Tacho', d: en ? (mobile ? 'holding something tosses it' : 'holding something, E tosses it') : mobile ? 'con algo en la mano, lo tira' : 'con algo en la mano, E lo tira' }
    case 'bucket':
      return {
        k: '',
        n: en ? 'Fake blood bucket' : 'Balde de sangre falsa',
        d: h?.b
          ? en
            ? 'already bloody'
            : 'ya está ensangrentado'
          : en
            ? (mobile ? '' : 'E ') + 'dip in fake blood'
            : (mobile ? '' : 'E ') + 'mojar en sangre falsa'
      }
  }
  return null
}

// scripts/lib/guide.js at seq 292, every line in both languages (keys line adapted: Spawn throws with Q, here 1 drops)
const PHOTO: Record<string, string> = { crate: 'g-crate', bench: 'g-bench', grinder: 'g-grinder', paint: 'g-bucket', gas: 'g-pump', window: 'g-window' }
const GUIDE = {
  es: {
    title: 'Cómo se trabaja en el galpón',
    close: '¡A trabajar!',
    example: 'Ejemplo: Cuchillo ensangrentado',
    keys: '¡ACCIÓN! empieza el turno · TIRAR en el tacho descarta · SOLTAR deja en el piso lo que tenés · E para todo (mantené E para afilar y cargar) · 1 soltar',
    cards: [
      ['crate', 'Cajones', 'USAR frente a un cajón agarra lo que tiene adentro. Con algo en la mano, le suma la pieza si encaja.'],
      ['bench', 'Banco', 'USAR apoya lo que tenés. Con otra pieza en la mano, UNIR las arma juntas.'],
      ['grinder', 'Amoladora', 'Con un cuchillo, machete, cuchillas o el guante con cuchillas en la mano, mantené AFILAR frente a la amoladora hasta llenar la barra.'],
      ['paint', 'Balde de sangre', 'Con una hoja afilada en la mano, MOJAR la deja ensangrentada.'],
      ['gas', 'Surtidor', 'Con la motosierra en la mano, mantené CARGAR frente al surtidor hasta llenar la barra.'],
      ['window', 'Ventanillas', 'Llevá el pedido terminado a la ventanilla de ese cliente y DAR. Si tarda, se va.']
    ],
    steps: ['Agarrá el cuchillo del cajón', 'Afilalo en la amoladora', 'Mojalo en el balde', 'Entregalo en la ventanilla']
  },
  en: {
    title: 'How the prop shed works',
    close: "Let's work!",
    example: 'Example: Bloody knife',
    keys: 'ACTION! starts the shift · USE at the trash bins it · DROP leaves what you hold on the floor · E for everything (hold E to sharpen and fuel) · 1 drop',
    cards: [
      ['crate', 'Crates', "USE at a crate grabs what's inside. Holding something, it adds the part if it fits."],
      ['bench', 'Bench', 'USE sets down what you hold. Holding another part, it puts them together.'],
      ['grinder', 'Grinder', 'Holding a knife, machete, blades or the bladed glove, hold SHARPEN at the grinder until the bar fills.'],
      ['paint', 'Blood bucket', 'Holding a sharpened blade, USE dips it in fake blood.'],
      ['gas', 'Gas pump', 'Holding the chainsaw, hold FUEL at the pump until the bar fills.'],
      ['window', 'Windows', "Bring the finished order to that customer's window and USE to hand it over. Wait too long and they leave."]
    ],
    steps: ['Grab a knife from its crate', 'Sharpen it at the grinder', 'Dip it in the bucket', 'Hand it over at the window']
  }
}
const EXAMPLE = ['knifebare', 'grinder', 'paint', 'knife']

// --- pieces -----------------------------------------------------------------------------------------------
export function setupHud() {
  // Where things sit (owner request): inside the client's InteractableArea (clear of its own controls), except the
  // small centred pieces, which looked off-centre there and sit in the ScreenInsetArea (device safe area) instead.
  // On a landscape phone the interactable area is about 1050 x 640 of a 1600 x 720 screen (measured in the Godot
  // client) and the guide is 1300 wide: the virtual screen is 2000 x 900 so everything draws at 80% and fits.
  ReactEcsRenderer.setUiRenderer(Hud, { virtualWidth: 2000, virtualHeight: 900, screenInset: 'none' })
}
const wide = (text: string, size: number) => Math.ceil(text.length * size * 0.52)

function Txt(p: { v: string; size: number; w: number | string; h: number; color?: Color4; align?: any; wrap?: boolean; key?: string }) {
  return <Label value={p.v} fontSize={p.size} color={p.color ?? TEXT} textAlign={p.align ?? 'middle-center'} textWrap={p.wrap ? 'wrap' : 'nowrap'} uiTransform={{ width: p.w as any, height: p.h }} />
}
// .pill: dark, thin rust border
function Pill(p: { v: string; size?: number; color?: Color4; key?: string }) {
  const size = p.size ?? 26
  const w = wide(p.v, size) + 30
  return (
    <UiEntity uiTransform={{ width: w, height: size + 20, margin: { left: 5, right: 5 }, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PANEL }}>
      <Txt v={p.v} size={size} w={w} h={size + 14} color={p.color} />
    </UiEntity>
  )
}
// a button: the listener sits on this small box only, never on a full-screen wrapper
function Btn(p: { v: string; w: number; h: number; size: number; bg: Color4; fg?: Color4; edge?: Color4; edgeW?: number; radius?: number; onPress: () => void; key?: string }) {
  return (
    <UiEntity
      uiTransform={{ width: p.w, height: p.h, margin: { left: 4, right: 4 }, justifyContent: 'center', alignItems: 'center', borderWidth: p.edgeW ?? 3, borderColor: p.edge ?? EDGE, borderRadius: p.radius ?? 12 }}
      uiBackground={{ color: p.bg }}
      onMouseDown={p.onPress}
    >
      <Txt v={p.v} size={p.size} w={p.w} h={p.h} color={p.fg ?? INK} />
    </UiEntity>
  )
}
const img = (file: string, size: number, key?: string, color?: Color4) => (
  <UiEntity key={key} uiTransform={{ width: size, height: size, margin: 2, flexShrink: 0 }} uiBackground={{ texture: { src: 'assets/Images/' + file }, textureMode: 'stretch', color }} />
)
const icon = (name: string, size: number, key?: string) => img(name + '-ico.png', size, key)

// The HUD is drawn in layers, back to front: 'full' (dimmers over the whole screen), 'centre' (small centred pieces,
// device safe area), 'area' (edge pieces, interactable area). The pause button (+ REC/$ when relevant), the guide
// and the hamburger menu all live here at the Hud level instead — reachable from the lot or the shed alike,
// instead of disappearing outside a take.
type ZoneId = 'full' | 'centre' | 'area'
const Zone = (z: ZoneId) => (UI.inside ? Shed(z) : Lot(z))
function Hud() {
  const P = shift()
  const en = EN()
  const left = P.on ? Math.max(0, Math.ceil((P.endsAt - now()) / 1000)) : 0
  const clock = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2)
  // the guide auto-opens on the first visit to the shed only; "how to play" in the menu can still open it anywhere
  const guideOpen = UI.guide ?? (UI.inside && !UI.guideSeen)
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {Zone('full')}
      <ScreenInsetArea>
        {Zone('centre')}
        {Waking()}
      </ScreenInsetArea>
      <InteractableArea>{Zone('area')}</InteractableArea>

      {/* .money / .rec: the pause button is the one true entry point to music/guide/exit, so it (and the
          take's own timer/score when there is one) stays up whether you're on the lot or in the shed. */}
      <InteractableArea>
        {P.on || P.best ? (
          <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 448 }, height: 80, justifyContent: 'flex-end', alignItems: 'center' }}>
            {P.on ? <Pill v={'$ ' + P.score} size={36} /> : P.best ? <Pill v={(en ? 'best' : 'récord') + ' $' + P.best} size={36} /> : null}
          </UiEntity>
        ) : null}
        <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 0 }, width: 400, height: 80, justifyContent: 'flex-end', alignItems: 'center' }}>
          {P.on ? (
            <UiEntity uiTransform={{ width: 272, height: 72, margin: { right: 48 }, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PANEL }}>
              <Txt v="● REC" size={36} w={150} h={46} color={REC} />
              <Txt v={clock} size={36} w={110} h={46} />
            </UiEntity>
          ) : null}
          {/* pause: opens the small menu modal (music, how to play, exit, back) */}
          <UiEntity uiTransform={{ width: 80, height: 80, justifyContent: 'center', alignItems: 'center', borderRadius: 40 }} uiBackground={{ color: NATIVE_BG }} onMouseDown={() => (UI.menu = true)}>
            {icon('pause', 44)}
          </UiEntity>
        </UiEntity>
      </InteractableArea>

      {guideOpen ? (
        <UiEntity
          uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }}
          uiBackground={{ color: hex('#000000', 0.7) }}
          onMouseDown={() => {
            UI.guide = false
            UI.guideSeen = true
          }}
        />
      ) : null}
      <ScreenInsetArea>{guideOpen ? Guide() : null}</ScreenInsetArea>

      {UI.menu ? <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: hex('#000000', 0.7) }} onMouseDown={() => (UI.menu = false)} /> : null}
      <ScreenInsetArea>{UI.menu ? Menu() : null}</ScreenInsetArea>
    </UiEntity>
  )
}
// The server sleeps when the set is empty and needs a moment to wake (about 15 s once published). Until its
// clock is seen ticking nothing you press would be heard, so say so instead of looking broken.
function Waking() {
  if (serverAwake() || waitedFor() < 3) return null
  const en = EN()
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 250, left: 0 }, width: '100%', height: 70, justifyContent: 'center' }}>
      <UiEntity uiTransform={{ width: 620, height: 70, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: ORANGE, borderRadius: 14 }} uiBackground={{ color: hex('#1a1020', 0.94) }}>
        <Txt v={en ? 'Preparing set…' : 'Preparando el set…'} size={26} w={600} h={50} />
      </UiEntity>
    </UiEntity>
  )
}

// --- the lot (ui.js lobby) -------------------------------------------------------------------------------------
function Lot(z: ZoneId) {
  const en = EN()
  const inside = hands().filter((x) => x.room >= 0).length
  const touch = UI.mobile
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {/* .lbc, lighter: one door now, rooms fill in arrival order (playtest feedback) */}
      <UiEntity uiTransform={{ display: z === 'centre' ? 'flex' : 'none', positionType: 'absolute', position: { top: 12, left: 0 }, width: '100%', height: 130, justifyContent: 'center', alignItems: 'flex-start' }}>
        <UiEntity uiTransform={{ width: 620, flexDirection: 'column', alignItems: 'center', padding: { top: 8, bottom: 10 }, borderWidth: 4, borderColor: EDGE, borderRadius: 20 }} uiBackground={{ color: PANEL }}>
          <Txt v={en ? '<b>THE SET</b>' : '<b>SET DE GRABACIÓN</b>'} size={32} w={600} h={40} />
          <Txt v={(en ? 'BETWEEN TAKES · on props now: ' : 'ENTRE TOMAS · en utilería ahora: ') + inside} size={19} w={600} h={26} color={hex('#f6e3c4', 0.75)} />
          {touch ? null : <Txt v={en ? 'WASD walk · drag the mouse to look · E at the door' : 'WASD caminar · arrastrá el mouse para mirar · E en la puerta'} size={17} w={600} h={26} color={hex('#f6e3c4', 0.7)} />}
        </UiEntity>
      </UiEntity>

      {/* .enter: only when you stand at the door */}
      {z === 'centre' && UI.nearDoor && !UI.entering ? (
        <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 22, left: 0 }, width: '100%', height: 104, justifyContent: 'center' }}>
          <UiEntity
            uiTransform={{ width: 360, height: 104, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: AMBER, borderRadius: 24 }}
            uiBackground={{ color: GREEN }}
            onMouseDown={() => (UI.wantEnter = true)}
          >
            <Txt v={'<b>' + (en ? 'GO IN' : 'ENTRAR') + (touch ? '' : ' [E]') + '</b>'} size={38} w={350} h={52} color={CREAM} />
            <Txt v={en ? 'TO PROPS' : 'A UTILERÍA'} size={20} w={350} h={28} color={CREAM} />
          </UiEntity>
        </UiEntity>
      ) : null}

      {/* .going: the walk-in curtain */}
      {UI.entering && z === 'full' ? <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: hex('#0e1420', 0.94) }} /> : null}
      {UI.entering && z === 'centre' ? (
        <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Txt v={'<b>' + (en ? 'Into the prop shed…' : 'Entrando al galpón…') + '</b>'} size={50} w={1000} h={70} />
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

// --- the shed (ui.js render) -------------------------------------------------------------------------------------
// .tk, reshaped after a playtest: the dish icon on the left; on its right the name, how it is made, and the
// customer's patience. Small, so two can sit one under the other at the right edge.
function Ticket(o: { dish: DishId; until: number; max: number }, key: string) {
  const pct = Math.max(0, Math.min(1, (o.until - now()) / o.max))
  const col = pct > 0.5 ? hex('#3f9e5a') : pct > 0.25 ? hex('#d99a2b') : RED
  const steps: any[] = []
  STEPS[o.dish].forEach((k, i) => {
    if (i) steps.push(<Txt key={'a' + i} v="<b>›</b>" size={26} w={16} h={40} color={INK} />)
    steps.push(icon(k, 60, 's' + i))
  })
  return (
    <UiEntity key={key} uiTransform={{ width: 390, height: 116, margin: { bottom: 16 }, padding: 8, alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PAPER }}>
      {icon(o.dish, 90)}
      <UiEntity uiTransform={{ width: 245, height: 100, margin: { left: 10 }, flexDirection: 'column', justifyContent: 'space-between' }}>
        <Txt v={'<b>' + (EN() ? DISH_EN[o.dish] : S.dishes[o.dish].name) + '</b>'} size={18} w={245} h={22} color={INK} align="middle-left" />
        <UiEntity uiTransform={{ width: 245, height: 64, alignItems: 'center' }}>{steps}</UiEntity>
        <UiEntity uiTransform={{ width: 241, height: 14, borderRadius: 7 }} uiBackground={{ color: hex('#000000', 0.2) }}>
          <UiEntity uiTransform={{ width: Math.max(2, Math.round(241 * pct)), height: 14, borderRadius: 7 }} uiBackground={{ color: col }} />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function Shed(z: ZoneId) {
  const P = shift()
  const en = EN()
  const guideOpen = UI.guide ?? !UI.guideSeen
  const orders = Object.values(P.orders).sort((a, b) => a.until - b.until)
  const hint = UI.hintAt && Date.now() - UI.hintAt < 1800 ? (en ? UI.hintEn || UI.hint : UI.hint) : ''
  const p = prompt()
  const tt = !p ? tip() : null
  const h = UI.held
  const heldIcon = h ? (h.k === 'saw' ? 'chainsaw' : h.k === 'torch' ? 'flashlight' : h.k) : ''
  const heldText = itemName(h)
  // @debug: forces the ¡CORTEN! card open on entry (before any real P.last) to iterate on its layout without
  // playing a round. Flip to false (or delete) once you're done — tell me and I'll take it out.
  const DEBUG_WRAP = true
  // stays up until "VOLVER A JUGAR" is tapped — no more auto-hiding after a few seconds
  const wrap = !P.on ? (P.last ?? (DEBUG_WRAP ? { score: 180, served: 7, missed: 2, stars: 2 } : null)) : null
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>

      {/* .tix: the tickets, most urgent on top, stacked at the right edge below .rec. Grown to double the
          recipe-step icons (playtest feedback: too small to read) — card compacted elsewhere (dish icon, name,
          bar) to make room for .rec above while still clearing .prompt/.held/.tip's top edge (~y=308). */}
      <UiEntity uiTransform={{ display: z === 'area' ? 'flex' : 'none', positionType: 'absolute', position: { top: 140, right: 0 }, width: 400, height: 248, flexDirection: 'column', alignItems: 'flex-end' }}>
        {orders.map((o, i) => Ticket(o, 't' + i))}
      </UiEntity>

      {/* .prompt: what the main button does right now, flush to the right edge, parked above the native touch button's
          footprint — the client always draws that button over scene UI there, so this sits clear of it, not on top */}
      {/* .hint: one shared box for the server's "that didn't work" toast, the main-button prompt, the looked-at
          station's tip, or what's in your hands — only one ever shows, always at this same spot. Priority:
          server toast (buzz-short feedback, 1.8s) > prompt > station tip > held item. Same 36pt-turned-28pt font
          as REC/timer/money, parked 48px further from the native button's footprint than before. */}
      {(hint || p || tt || h) && z === 'area' ? (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { bottom: 224, right: 0 },
            width: hint ? wide(hint, 28) + 36 : p ? wide(p, 28) + 36 : tt ? Math.max(wide(tt.d, 28), wide(tt.n, 28)) + (tt.k ? 90 : 24) : wide(heldText, 28) + 80,
            height: 88,
            padding: { left: 12, right: 12, top: 8, bottom: 8 },
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: hint ? 3 : p ? 0 : 3,
            borderColor: hint ? SALMON : EDGE,
            borderRadius: p ? 12 : 14
          }}
          uiBackground={{ color: p ? AMBER : PANEL }}
        >
          {hint ? (
            <Txt v={hint} size={28} w={wide(hint, 28) + 30} h={42} color={SALMON} />
          ) : p ? (
            <Txt v={p} size={28} w={wide(p, 28) + 30} h={42} color={INK} />
          ) : tt ? (
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              {tt.k ? icon(tt.k, 46) : null}
              <UiEntity uiTransform={{ flexDirection: 'column', margin: { left: tt.k ? 10 : 0 } }}>
                <Txt v={'<b>' + tt.n + '</b>'} size={28} w={Math.max(wide(tt.d, 28), wide(tt.n, 28))} h={36} color={AMBER} align="middle-left" />
                <Txt v={tt.d} size={28} w={Math.max(wide(tt.d, 28), wide(tt.n, 28))} h={36} align="middle-left" />
              </UiEntity>
            </UiEntity>
          ) : (
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              {icon(heldIcon, 34)}
              <Txt v={heldText} size={28} w={wide(heldText, 28) + 12} h={42} />
            </UiEntity>
          )}
        </UiEntity>
      ) : null}

      {/* .action: the FIRST take only — after that, ¡CORTEN!'s own "VOLVER A JUGAR" restarts the next ones, so
          this never has to compete with that card for screen space again. Centred now that the two can't coexist.
          Drawn before .wrap (below it in z-order) and gated on !wrap too, so if both are ever true at once
          (e.g. DEBUG_WRAP) ¡CORTEN! always wins instead of the two overlapping. */}
      {!P.on && !guideOpen && !UI.playedOnce && !wrap && z === 'centre' ? (
        <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <UiEntity
            uiTransform={{ width: 400, height: 112, justifyContent: 'center', alignItems: 'center', borderWidth: 5, borderColor: AMBER, borderRadius: 22 }}
            uiBackground={{ color: RED }}
            onMouseDown={() => (UI.wantStart = true)}
          >
            {icon('clapper', 54)}
            <Txt v={'<b>' + (en ? 'ACTION!' : '¡ACCIÓN!') + '</b>'} size={42} w={290} h={112} color={CREAM} />
          </UiEntity>
        </UiEntity>
      ) : null}

      {/* .wrap: ¡CORTEN! — stays up until "VOLVER A JUGAR" is tapped (no more auto-hiding after a few seconds),
          so it needs its own restart button now that ¡ACCIÓN! only ever shows for the very first take. Drawn
          after .action (above it in z-order), so it always covers the loose button if both were ever visible. */}
      {wrap && !guideOpen && z === 'full' ? <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%' }} uiBackground={{ color: hex('#000000', 0.5) }} /> : null}
      {wrap && !guideOpen && z === 'centre' ? (
        <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <UiEntity uiTransform={{ width: 760, height: 480 }}>
            <UiEntity uiTransform={{ width: 760, height: 480, flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: { top: 70, bottom: 20 }, borderWidth: 4, borderColor: ORANGE, borderRadius: 20 }} uiBackground={{ color: hex('#1a1020', 0.94) }}>
              <Txt v={'<b>' + (en ? 'CUT!' : '¡CORTEN!') + '</b>'} size={54} w={wide(en ? 'CUT!' : '¡CORTEN!', 54) + 10} h={70} />
              <UiEntity uiTransform={{ margin: { top: 24 } }}>
                <Txt v={'★ '.repeat(wrap.stars) + '☆ '.repeat(3 - wrap.stars)} size={56} w={740} h={74} color={AMBER} />
              </UiEntity>
              <UiEntity uiTransform={{ margin: { top: 12 } }}>
                <Txt v={'$ ' + wrap.score + ' · ' + wrap.served + (en ? ' delivered · ' : ' entregados · ') + wrap.missed + (en ? ' walked out' : ' se fueron')} size={32} w={740} h={48} />
              </UiEntity>
              <UiEntity uiTransform={{ margin: { top: 28 } }}>
                <Txt v={(en ? 'PLAY AGAIN' : 'VOLVER A JUGAR') + ':'} size={22} w={300} h={30} color={hex('#f6e3c4', 0.8)} />
              </UiEntity>
              {/* same wording as the loose first-take button, so the game speaks one language throughout */}
              <UiEntity
                uiTransform={{ width: 420, height: 80, margin: { top: 16 }, justifyContent: 'center', alignItems: 'center', borderWidth: 5, borderColor: AMBER, borderRadius: 22 }}
                uiBackground={{ color: RED }}
                onMouseDown={() => (UI.wantStart = true)}
              >
                <Txt v={'<b>' + (en ? 'ACTION!' : '¡ACCIÓN!') + '</b>'} size={30} w={290} h={80} color={CREAM} />
              </UiEntity>
            </UiEntity>
            {/* the clapper as a badge straddling the top border — half in, half out, 200% bigger than before. A
                sibling drawn after the card (not a child of it), so it paints over the card's own border instead
                of the border cutting across it. */}
            <UiEntity uiTransform={{ positionType: 'absolute', position: { top: -60, left: 320 } }}>{icon('clapper', 120)}</UiEntity>
          </UiEntity>
        </UiEntity>
      ) : null}

    </UiEntity>
  )
}

// --- the hamburger's menu modal: music, how to play (opens the guide), exit, back -----------------------------
function Menu() {
  const en = EN()
  const items: { v: string; onPress: () => void }[] = [
    { v: en ? (UI.music ? 'Music: ON' : 'Music: OFF') : UI.music ? 'Música: ON' : 'Música: OFF', onPress: () => (UI.music = !UI.music) },
    { v: en ? 'LANGUAGE: ENGLISH' : 'LENGUAJE: ESPAÑOL', onPress: () => setLang(en ? 'es' : 'en') },
    {
      v: en ? 'How to play' : 'Cómo jugar',
      onPress: () => {
        UI.menu = false
        UI.guide = true
      }
    },
    { v: en ? 'EXIT' : 'SALIR', onPress: () => (UI.wantExit = true) },
    { v: en ? 'BACK' : 'VOLVER', onPress: () => (UI.menu = false) }
  ]
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: 440, flexDirection: 'column', alignItems: 'center', padding: 24, borderWidth: 4, borderColor: ORANGE, borderRadius: 22 }} uiBackground={{ color: hex('#1a1020', 0.96) }}>
        <Txt v={'<b>' + (en ? 'Menu' : 'Menú') + '</b>'} size={30} w={392} h={44} />
        {items.map((it, i) => (
          <UiEntity
            key={'m' + i}
            uiTransform={{ width: 392, height: 80, margin: { top: 14 }, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: AMBER, borderRadius: 16 }}
            uiBackground={{ color: AMBER }}
            onMouseDown={it.onPress}
          >
            <Txt v={'<b>' + it.v + '</b>'} size={28} w={360} h={50} color={INK} />
          </UiEntity>
        ))}
      </UiEntity>
    </UiEntity>
  )
}

// --- the station guide (ui.js guide): opens on its own the first visit, ? brings it back ----------------------------
function Guide() {
  const G = GUIDE[UI.lang]
  const en = EN()
  const ex: any[] = []
  EXAMPLE.forEach((k, i) => {
    if (i) ex.push(<Txt key={'x' + i} v="<b>›</b>" size={34} w={30} h={64} color={AMBER} />)
    ex.push(
      <UiEntity key={'e' + i} uiTransform={{ width: 190, height: 112, flexDirection: 'column', alignItems: 'center' }}>
        {icon(k, 62)}
        <Txt v={G.steps[i]} size={17} w={190} h={44} wrap />
      </UiEntity>
    )
  })
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <UiEntity uiTransform={{ width: 1300, height: 706, flexDirection: 'column', borderWidth: 4, borderColor: ORANGE, borderRadius: 22 }} uiBackground={{ color: hex('#1a1020', 0.96) }}>
        {/* .gh: "how to play", opened from the hamburger menu now, not straight from the live HUD. Language
            moved to the menu — the only place it lives now. */}
        <UiEntity uiTransform={{ width: 1292, height: 76, alignItems: 'center', padding: { left: 26, right: 14 } }}>
          <Txt v={'<b>' + G.title + '</b>'} size={30} w={1052} h={60} align="middle-left" />
        </UiEntity>
        <UiEntity uiTransform={{ width: 1292, height: 3 }} uiBackground={{ color: EDGE }} />
        {/* .gb: one card per station, with its photo */}
        <UiEntity uiTransform={{ width: 1292, height: 340, flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center' }}>
          {G.cards.map((c, i) => (
            <UiEntity key={'g' + i} uiTransform={{ width: 414, height: 156, margin: 6, padding: 10, alignItems: 'center', borderRadius: 16 }} uiBackground={{ color: PAPER }}>
              <UiEntity uiTransform={{ width: 124, height: 124, flexShrink: 0, borderWidth: 3, borderColor: EDGE, borderRadius: 12 }} uiBackground={{ texture: { src: 'assets/Images/' + PHOTO[c[0]] + '.jpg' }, textureMode: 'stretch' }} />
              <UiEntity uiTransform={{ width: 262, height: 136, margin: { left: 10 }, flexDirection: 'column' }}>
                <Txt v={'<b>' + c[1] + '</b>'} size={24} w={262} h={30} color={INK} align="middle-left" />
                <Txt v={c[2]} size={16} w={262} h={104} color={INK} align="top-left" wrap />
              </UiEntity>
            </UiEntity>
          ))}
        </UiEntity>
        {/* .gx: the worked example */}
        <UiEntity uiTransform={{ width: 1292, height: 170, justifyContent: 'center' }}>
          <UiEntity uiTransform={{ width: 1266, height: 164, flexDirection: 'column', alignItems: 'center', borderRadius: 16 }} uiBackground={{ color: INK }}>
            <Txt v={'<b>' + G.example + '</b>'} size={22} w={1200} h={40} color={AMBER} />
            <UiEntity uiTransform={{ width: 1200, height: 116, justifyContent: 'center', alignItems: 'flex-start' }}>{ex}</UiEntity>
          </UiEntity>
        </UiEntity>
        <UiEntity uiTransform={{ width: 1292, height: 3 }} uiBackground={{ color: EDGE }} />
        {/* .gf: playtest feedback — still hard to tap; the row had no other content to share it with (the old
          hint text here is gone), so the button now fills the whole free width instead of hugging the right */}
        <UiEntity uiTransform={{ width: 1292, height: 102, alignItems: 'center', justifyContent: 'center', padding: { left: 26, right: 14 } }}>
          <Btn
            v={'<b>' + G.close + '</b>'}
            w={1252}
            h={94}
            size={34}
            bg={ORANGE}
            fg={hex('#1a1020')}
            edge={ORANGE}
            radius={18}
            onPress={() => {
              UI.guide = false
              UI.guideSeen = true
            }}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
