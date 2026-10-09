// The maker's screen: a port of the Spawn world's scripts/ui.js (the HUD, written there as HTML + CSS), with
// scripts/lib/guide.js for the station guide. Same elements, colours, wording and places:
//   lot    top-centre card with the two doors, ENTRAR when you stand at one, the walk-in curtain, ES/EN
//   shed   top-centre pills (REC clock, $ score, ?, the way out, público), tickets top-right, the hands block
//          bottom-centre (hint, key prompt, station tip, what you hold), ¡ACCIÓN! between takes, the ¡CORTEN! card
//   guide  opens by itself on the first visit; photo cards, a worked example, ¡A trabajar!
// What cannot be the same in scene UI: the typeface (Spawn: Geist Pixel Square), emoji (dropped or replaced by
// a word or an icon) and, on some clients, rounded corners. Sizes are Spawn's phone-landscape CSS scaled to the
// 1600x720 canvas a phone gets. Coded React-ECS (data-driven, not UI-Designer editable).
import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { DISH_EN, DishId, NAMES_EN, S } from './config'
import { cards, now, shift, stationItem } from './net'
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
function prompt(): string {
  const st = UI.look ? BY_ID[UI.look] : null
  if (!st) return ''
  const h = UI.held
  const it = stationItem(st.id)
  const en = EN()
  switch (st.kind) {
    case 'supply': {
      const g = { k: GIVES(st.id) as string }
      return !h ? (en ? 'E take ' : 'E tomar ') + nameOf(g.k) : canAdd(h, g) ? (en ? 'E add ' : 'E poner ') + nameOf(g.k) : ''
    }
    case 'grinder':
      return sharpenable(h) ? (en ? 'hold E to sharpen' : 'mantené E para afilar') : !h && it ? (en ? 'E take' : 'E tomar') : ''
    case 'pump':
      return h?.k === 'saw' && !h.g ? (en ? 'hold E to fuel up' : 'mantené E para cargar nafta') : !h && it ? (en ? 'E take' : 'E tomar') : ''
    case 'counter':
      return h && !it ? (en ? 'E set down' : 'E apoyar') : !h && it ? (en ? 'E take' : 'E tomar') : h && it ? (en ? 'E combine' : 'E combinar') : ''
    case 'bucket':
      return dippable(h) ? (en ? 'E dip in fake blood' : 'E mojar en sangre falsa') : ''
    case 'trash':
      return h ? (en ? 'E toss ' : 'E tirar ') + nameOf(h.k) : ''
    case 'window':
      return shift().orders[st.id] && h ? (en ? 'E hand over' : 'E entregar') : ''
  }
  return ''
}
// a station with nothing to do right now still says what it is and what it wants
function tip(): { k: string; n: string; d: string } | null {
  const st = UI.look ? BY_ID[UI.look] : null
  if (!st) return null
  const h = UI.held
  const en = EN()
  switch (st.kind) {
    case 'grinder':
      return { k: 'grinder', n: en ? 'Grinder' : 'Amoladora', d: h?.s ? (en ? 'already sharp' : 'ya está afilado') : en ? 'bring a knife, machete or blades and hold E' : 'traé un cuchillo, machete o cuchillas y mantené E' }
    case 'pump':
      return { k: 'gas', n: en ? 'Gas pump' : 'Surtidor de nafta', d: h?.k === 'saw' && h.g ? (en ? 'already fuelled' : 'ya tiene nafta') : en ? 'bring the chainsaw and hold E' : 'traé la motosierra y mantené E' }
    case 'trash':
      return { k: 'tacho', n: en ? 'Trash' : 'Tacho', d: en ? 'holding something, E tosses it' : 'con algo en la mano, E lo tira' }
    case 'bucket':
      return { k: 'paint', n: en ? 'Fake blood bucket' : 'Balde de sangre falsa', d: h?.b ? (en ? 'already bloody' : 'ya está ensangrentado') : en ? 'bring a sharpened knife or machete and E' : 'traé un cuchillo o machete afilado y E' }
  }
  return null
}

// scripts/lib/guide.js at seq 292, every line in both languages (keys line adapted: throw is 1 here, Q in Spawn)
const PHOTO: Record<string, string> = { crate: 'g-crate', bench: 'g-bench', grinder: 'g-grinder', paint: 'g-bucket', gas: 'g-pump', window: 'g-window' }
const GUIDE = {
  es: {
    title: 'Cómo se trabaja en el galpón',
    close: '¡A trabajar!',
    example: 'Ejemplo: Cuchillo ensangrentado',
    keys: '¡ACCIÓN! empieza el turno · TIRAR en el tacho descarta · LANZAR revolea lo que tenés · E para todo (mantené E para afilar y cargar) · 1 lanzar',
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
    keys: 'ACTION! starts the shift · USE at the trash bins it · THROW tosses what you hold · E for everything (hold E to sharpen and fuel) · 1 throw',
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
  ReactEcsRenderer.setUiRenderer(Hud, { virtualWidth: 1600, virtualHeight: 720 })
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
const img = (file: string, size: number, key?: string) => (
  <UiEntity key={key} uiTransform={{ width: size, height: size, margin: 2, flexShrink: 0 }} uiBackground={{ texture: { src: 'assets/Images/' + file }, textureMode: 'stretch' }} />
)
const icon = (name: string, size: number, key?: string) => img(name + '-ico.png', size, key)
// .lg / .lbl2: ES | EN, the one in use in amber
function LangToggle(small = false) {
  const h = small ? 40 : 48
  const w = small ? 54 : 70
  return (
    <UiEntity uiTransform={{ height: h + 16, padding: 5, margin: { left: 5 }, alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PANEL }}>
      <Btn v="ES" w={w} h={h} size={small ? 19 : 22} bg={EN() ? INK : AMBER} fg={EN() ? TEXT : INK} onPress={() => setLang('es')} />
      <Btn v="EN" w={w} h={h} size={small ? 19 : 22} bg={EN() ? AMBER : INK} fg={EN() ? INK : TEXT} onPress={() => setLang('en')} />
    </UiEntity>
  )
}

function Hud() {
  return <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>{UI.inside ? Shed() : Lot()}</UiEntity>
}

// --- the lot (ui.js lobby) -------------------------------------------------------------------------------------
function Lot() {
  const en = EN()
  const inside = cards().filter((x) => x.c.inside).length
  const door = (to: string) => (to === 'private' ? (en ? 'PRIVATE SHOOT' : 'RODAJE PRIVADO') : en ? 'PUBLIC SHOOT' : 'RODAJE PÚBLICO')
  const touch = isMobile()
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {/* .lbc: what the two doors are */}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, left: 0 }, width: '100%', height: 200, justifyContent: 'center', alignItems: 'flex-start' }}>
        <UiEntity uiTransform={{ width: 800, margin: { left: 60 }, flexDirection: 'column', alignItems: 'center', padding: { top: 8, bottom: 10 }, borderWidth: 4, borderColor: EDGE, borderRadius: 20 }} uiBackground={{ color: PANEL }}>
          <Txt v={en ? '<b>THE PROP SHED</b>' : '<b>GALPÓN DE UTILERÍA</b>'} size={32} w={780} h={40} />
          <Txt v={en ? 'THE LOT · BETWEEN TAKES' : 'EL SET · ENTRE TOMAS'} size={19} w={780} h={26} color={hex('#f6e3c4', 0.75)} />
          <UiEntity uiTransform={{ width: 770, height: 92, margin: { top: 6 } }}>
            <UiEntity uiTransform={{ width: 385, height: 92, flexDirection: 'column' }}>
              <Txt v={'<b>' + door('public') + '</b>'} size={23} w={375} h={30} color={PUB} align="middle-left" />
              <Txt v={(en ? "work with whoever's in, up to 4. inside now: " : 'trabajás con quien esté, hasta 4. adentro: ') + inside + '/4'} size={19} w={375} h={58} align="top-left" wrap />
            </UiEntity>
            <UiEntity uiTransform={{ width: 385, height: 92, flexDirection: 'column' }}>
              <Txt v={'<b>' + door('private') + '</b>'} size={23} w={375} h={30} color={PRV} align="middle-left" />
              <Txt v={en ? 'a private shed by link: not available in Decentraland' : 'un galpón privado por link: no disponible en Decentraland'} size={19} w={375} h={58} align="top-left" wrap />
            </UiEntity>
          </UiEntity>
          {touch ? null : <Txt v={en ? 'WASD walk · drag the mouse to look · E at a door' : 'WASD caminar · arrastrá el mouse para mirar · E en una puerta'} size={17} w={780} h={26} color={hex('#f6e3c4', 0.7)} />}
        </UiEntity>
      </UiEntity>

      {/* .enter: only when you stand at a door, in that door's colour */}
      {UI.nearDoor && !UI.entering ? (
        <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 22, left: 0 }, width: '100%', height: 104, justifyContent: 'center' }}>
          <UiEntity
            uiTransform={{ width: 360, height: 104, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: AMBER, borderRadius: 24 }}
            uiBackground={{ color: UI.nearDoor === 'private' ? BLOOD : GREEN }}
            onMouseDown={() => (UI.wantEnter = true)}
          >
            <Txt v={'<b>' + (en ? 'GO IN' : 'ENTRAR') + (touch ? '' : ' [E]') + '</b>'} size={38} w={350} h={52} color={CREAM} />
            <Txt v={door(UI.nearDoor)} size={20} w={350} h={28} color={CREAM} />
          </UiEntity>
        </UiEntity>
      ) : null}

      {/* .lbl2: the language, top-right */}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 110 }, height: 64 }}>{LangToggle()}</UiEntity>

      {/* .going: the walk-in curtain */}
      {UI.entering ? (
        <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: hex('#0e1420', 0.94) }}>
          <Txt v={'<b>' + (en ? 'Into the prop shed…' : 'Entrando al galpón…') + '</b>'} size={50} w={1000} h={70} />
          <Txt v={door('public')} size={26} w={1000} h={40} color={hex('#f6e3c4', 0.7)} />
        </UiEntity>
      ) : null}
    </UiEntity>
  )
}

// --- the shed (ui.js render) -------------------------------------------------------------------------------------
// .tk: a paper ticket: the dish, its name, how it is made, the customer's patience
function Ticket(o: { dish: DishId; until: number; max: number }, key: string) {
  const pct = Math.max(0, Math.min(1, (o.until - now()) / o.max))
  const col = pct > 0.5 ? hex('#3f9e5a') : pct > 0.25 ? hex('#d99a2b') : RED
  const steps: any[] = []
  STEPS[o.dish].forEach((k, i) => {
    if (i) steps.push(<Txt key={'a' + i} v="<b>›</b>" size={24} w={14} h={40} color={INK} />)
    steps.push(icon(k, 40, 's' + i))
  })
  return (
    <UiEntity key={key} uiTransform={{ width: 196, height: 212, margin: { left: 6, right: 6 }, padding: 8, flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', borderWidth: 4, borderColor: EDGE, borderRadius: 20 }} uiBackground={{ color: PAPER }}>
      {icon(o.dish, 78)}
      <Txt v={'<b>' + (EN() ? DISH_EN[o.dish] : S.dishes[o.dish].name) + '</b>'} size={19} w={176} h={44} color={INK} wrap />
      <UiEntity uiTransform={{ width: 176, height: 44, justifyContent: 'center', alignItems: 'center' }}>{steps}</UiEntity>
      <UiEntity uiTransform={{ width: 172, height: 14, borderRadius: 7 }} uiBackground={{ color: hex('#000000', 0.2) }}>
        <UiEntity uiTransform={{ width: Math.max(2, Math.round(172 * pct)), height: 14, borderRadius: 7 }} uiBackground={{ color: col }} />
      </UiEntity>
    </UiEntity>
  )
}

function Shed() {
  const P = shift()
  const en = EN()
  const t = now()
  const guideOpen = UI.guide ?? !UI.guideSeen
  const left = P.on ? Math.max(0, Math.ceil((P.endsAt - t) / 1000)) : 0
  const clock = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2)
  const orders = Object.values(P.orders).sort((a, b) => a.until - b.until)
  const hint = UI.hintAt && Date.now() - UI.hintAt < 1800 ? (en ? UI.hintEn || UI.hint : UI.hint) : ''
  const p = prompt()
  const tt = !p ? tip() : null
  const h = UI.held
  const heldIcon = h ? (h.k === 'saw' ? 'chainsaw' : h.k === 'torch' ? 'flashlight' : h.k) : ''
  const heldText = itemName(h)
  const throwText = en ? ' · 1 throw' : ' · 1 lanzar'
  const wrap = !P.on && P.last && t - P.endsAt < 12000 ? P.last : null
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
      {/* .top: REC clock and the take, or the record between takes; the guide, the way out, the room, the language.
          Centred between takes; during a shift it sits left of the tickets so two of them never cover it */}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, left: P.on ? 100 : 0 }, width: P.on ? 780 : '100%', height: 60, justifyContent: P.on ? 'flex-start' : 'center', alignItems: 'center' }}>
        {P.on ? (
          <UiEntity uiTransform={{ width: 196, height: 46, margin: { left: 5, right: 5 }, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PANEL }}>
            <Txt v="● REC" size={26} w={100} h={40} color={REC} />
            <Txt v={clock} size={26} w={76} h={40} />
          </UiEntity>
        ) : null}
        {P.on ? <Pill v={'$ ' + P.score} /> : P.best ? <Pill v={(en ? 'best' : 'récord') + ' $' + P.best} /> : null}
        <Btn v="<b>?</b>" w={56} h={56} size={34} bg={AMBER} radius={28} onPress={() => (UI.guide = true)} />
        <Btn v={en ? 'LOT' : 'SET'} w={84} h={56} size={22} bg={AMBER} radius={28} onPress={() => (UI.wantExit = true)} />
        <Pill v={en ? 'public' : 'público'} size={19} color={hex('#f6e3c4', 0.8)} />
        {/* .lg: ES/EN always in the shed's top bar (seq 292) */}
        {LangToggle(true)}
      </UiEntity>

      {/* .tix: the tickets, most urgent first from the right edge */}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 104 }, height: 220, flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
        {orders.map((o, i) => Ticket(o, 't' + i))}
      </UiEntity>

      {/* .hand: the hint, what the key does now (or what the station wants), what is in your hands */}
      <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: P.on || guideOpen ? 18 : 128, left: 0 }, width: '100%', height: 190, flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
        {hint ? <Txt v={hint} size={24} w={900} h={34} color={SALMON} /> : null}
        {p ? (
          <UiEntity uiTransform={{ width: wide(p, 26) + 36, height: 46, margin: 3, justifyContent: 'center', alignItems: 'center', borderRadius: 12 }} uiBackground={{ color: AMBER }}>
            <Txt v={p} size={26} w={wide(p, 26) + 30} h={40} color={INK} />
          </UiEntity>
        ) : null}
        {tt ? (
          <UiEntity uiTransform={{ width: Math.max(wide(tt.d, 20), wide(tt.n, 22)) + 90, height: 70, margin: 3, padding: { left: 12, right: 12 }, alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PANEL }}>
            {icon(tt.k, 46)}
            <UiEntity uiTransform={{ flexDirection: 'column', margin: { left: 10 } }}>
              <Txt v={'<b>' + tt.n + '</b>'} size={22} w={Math.max(wide(tt.d, 20), wide(tt.n, 22))} h={28} color={AMBER} align="middle-left" />
              <Txt v={tt.d} size={20} w={Math.max(wide(tt.d, 20), wide(tt.n, 22))} h={26} align="middle-left" />
            </UiEntity>
          </UiEntity>
        ) : null}
        {h ? (
          <UiEntity uiTransform={{ width: wide(heldText + throwText, 22) + 80, height: 48, margin: 3, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: EDGE, borderRadius: 14 }} uiBackground={{ color: PANEL }}>
            {icon(heldIcon, 34)}
            <Txt v={heldText} size={22} w={wide(heldText, 22) + 12} h={40} />
            <Txt v={throwText} size={19} w={wide(throwText, 19)} h={40} color={hex('#f6e3c4', 0.65)} />
          </UiEntity>
        ) : null}
      </UiEntity>

      {/* .wrap: ¡CORTEN! for a few seconds after the whistle */}
      {wrap && !guideOpen ? (
        <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: hex('#000000', 0.5) }}>
          <UiEntity uiTransform={{ width: 760, height: 290, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: ORANGE, borderRadius: 20 }} uiBackground={{ color: hex('#1a1020', 0.94) }}>
            <Txt v={'<b>' + (en ? 'CUT!' : '¡CORTEN!') + '</b>'} size={54} w={740} h={70} />
            <Txt v={'★ '.repeat(wrap.stars) + '☆ '.repeat(3 - wrap.stars)} size={56} w={740} h={74} color={AMBER} />
            <Txt v={'$ ' + wrap.score + ' · ' + wrap.served + (en ? ' delivered · ' : ' entregados · ') + wrap.missed + (en ? ' walked out' : ' se fueron')} size={32} w={740} h={48} />
            <Txt v={en ? 'tap ACTION! for another take' : 'tocá ¡ACCIÓN! para otra toma'} size={22} w={740} h={40} color={hex('#f6e3c4', 0.8)} />
          </UiEntity>
        </UiEntity>
      ) : null}

      {/* .action: between takes, drawn over the ¡CORTEN! card's dimmer like Spawn's z-index */}
      {!P.on && !guideOpen ? (
        <UiEntity uiTransform={{ positionType: 'absolute', position: { bottom: 18, left: 0 }, width: '100%', height: 100, justifyContent: 'center' }}>
          <Btn v={'<b>' + (en ? 'ACTION!' : '¡ACCIÓN!') + '</b>'} w={360} h={100} size={46} bg={RED} fg={CREAM} edge={AMBER} edgeW={5} radius={26} onPress={() => (UI.wantStart = true)} />
        </UiEntity>
      ) : null}

      {guideOpen ? Guide() : null}
    </UiEntity>
  )
}

// --- the station guide (ui.js guide): opens on its own the first visit, ? brings it back ----------------------------
function Guide() {
  const G = GUIDE[UI.lang]
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
    <UiEntity uiTransform={{ positionType: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }} uiBackground={{ color: hex('#000000', 0.7) }}>
      <UiEntity uiTransform={{ width: 1300, height: 690, flexDirection: 'column', borderWidth: 4, borderColor: ORANGE, borderRadius: 22 }} uiBackground={{ color: hex('#1a1020', 0.96) }}>
        {/* .gh */}
        <UiEntity uiTransform={{ width: 1292, height: 76, alignItems: 'center', padding: { left: 110, right: 14 } }}>
          <Txt v={'<b>' + G.title + '</b>'} size={30} w={968} h={60} align="middle-left" />
          {LangToggle()}
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
        {/* .gf */}
        <UiEntity uiTransform={{ width: 1292, height: 86, alignItems: 'center', padding: { left: 100, right: 14 } }}>
          <Txt v={G.keys} size={17} w={908} h={70} color={hex('#f6e3c4', 0.8)} align="middle-left" wrap />
          <Btn
            v={'<b>' + G.close + '</b>'}
            w={250}
            h={64}
            size={26}
            bg={ORANGE}
            fg={hex('#1a1020')}
            edge={ORANGE}
            radius={14}
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
