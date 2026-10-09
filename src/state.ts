// This machine's maker: what the HUD reads. Never on the wire (the card carries the few bits others need).
// In Spawn these lived in player.state (verb, canWork, workVerb, canThrow, hint, guide, lang) and ctx.session.
import { Item } from './shop'

export const UI = {
  inside: false, // in the shed (Spawn: player.place === "main")
  held: null as Item | null,
  look: null as string | null, // the station the maker faces
  verb: null as string | null, // the one word the USE key does right now
  canWork: false,
  workVerb: 'AFILAR',
  canThrow: false,
  hint: '',
  hintEn: '',
  hintAt: 0,
  guide: null as boolean | null, // null: never opened or closed yet, so it opens by itself on the first visit
  guideSeen: false,
  lang: 'es' as 'es' | 'en',
  nearDoor: null as null | 'public' | 'private',
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
