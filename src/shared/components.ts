// Everything the makers share lives in these components. They are server-authoritative: the headless server
// creates the entities, syncs them (syncEntity, server only) and is the only one allowed to write them
// (validateBeforeChange in server/server.ts). Clients read them and send intentions (shared/messages.ts).
// There is one Shift, one Floor and one set of stations per room (shared/rooms.ts).
// In Spawn the same data was ctx.place.state (the shift), each station object's state, the objects tagged
// "loose", and player.state.held.
import { engine, Schemas } from '@dcl/sdk/ecs'

// ctx.place.state: the whole shift as one JSON string (small: two orders, two customers), plus the server's
// clock. The clock is rewritten every second, so it doubles as the server's heartbeat.
export const Shift = engine.defineComponent('theset::Shift', {
  room: Schemas.Int,
  data: Schemas.String,
  clock: Schemas.Int64
})
// one per station: what lies on it and its grinder/pump bar
export const StationState = engine.defineComponent('theset::Station', {
  room: Schemas.Int,
  id: Schemas.String,
  item: Schemas.String,
  prog: Schemas.Float
})
// props left on the floor
export const Floor = engine.defineComponent('theset::Floor', {
  room: Schemas.Int,
  data: Schemas.String
})
// one per connected player: what they hold and which room's shed they are in (-1: on the lot)
export const Hand = engine.defineComponent('theset::Hand', {
  userId: Schemas.String,
  held: Schemas.String,
  room: Schemas.Int
})
