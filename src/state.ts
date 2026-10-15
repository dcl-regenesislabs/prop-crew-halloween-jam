// This machine's maker: what the HUD reads. Never on the wire (the card carries the few bits others need).
// In Spawn these lived in player.state (verb, canWork, workVerb, canThrow, hint, guide, lang) and ctx.session.
import { Item } from './shop'

export const UI = {
  inside: false, // in the shed (Spawn: player.place === "main")
  held: null as Item | null,
  look: null as string | null, // the station the maker faces
  verb: null as string | null, // the one word the USE key does right now
  floorVerb: null as string | null, // set when the main action is about a prop on the floor ahead
  canWork: false,
  workVerb: 'AFILAR',
  canThrow: false,
  hint: '',
  hintEn: '',
  hintAt: 0,
  guide: null as boolean | null, // null: never opened or closed yet, so it opens by itself on the first visit
  guideSeen: false,
  menu: false, // the hamburger button's own small modal: music, how to play, exit, back
  lang: 'es' as 'es' | 'en',
  nearDoor: false, // standing at the lot's green door
  music: true, // the HUD's music button
  guided: false, // the first-order arrows have done their job: never again this session
  playedOnce: false, // the first take has started: ¡ACCIÓN! hides for good, ¡CORTEN!'s own button restarts from here on
  mobile: false, // set once the platform is known (index.ts)
  entering: false, // walking in through the green door: the HUD draws the curtain
  // HUD buttons set these; game.ts consumes them on the next frame
  wantStart: false,
  wantEnter: false,
  wantExit: false
}

export function hint(text: string, en?: string) {
  UI.hint = text
  UI.hintEn = en ?? text
  UI.hintAt = Date.now()
}
