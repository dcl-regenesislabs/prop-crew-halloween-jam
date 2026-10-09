// The message contract between the makers' clients and the server. Registered once at module load on both
// sides. Clients only ever say what they try to do; the server decides what happens.
import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const Messages = {
  // client → server
  use: Schemas.Map({ station: Schemas.String }), // the main action at a station
  work: Schemas.Map({ station: Schemas.String, on: Schemas.Boolean }), // the main action held at the grinder or pump
  pick: Schemas.Map({ id: Schemas.String }), // take a prop off the floor
  // leave the held prop: on the bench you face (station), joined with what is there if it fits, in the trash if
  // that is what you face, otherwise on the floor at x, z
  drop: Schemas.Map({ x: Schemas.Float, z: Schemas.Float, yaw: Schemas.Float, station: Schemas.String }),
  start: Schemas.Map({}), // ¡ACCIÓN!
  enter: Schemas.Map({}), // the green door: ask for a place in a room
  leave: Schemas.Map({}), // back to the lot

  // server → client
  snd: Schemas.Map({ n: Schemas.String, x: Schemas.Float, y: Schemas.Float, z: Schemas.Float }), // a sound somewhere in the shed
  pop: Schemas.Map({ text: Schemas.String, x: Schemas.Float, z: Schemas.Float, good: Schemas.Boolean }), // "+25" / "-10" over a window
  crate: Schemas.Map({ station: Schemas.String, k: Schemas.String }), // a crate gave something: it bounces and names it
  hint: Schemas.Map({ es: Schemas.String, en: Schemas.String }) // why that did nothing (sent to the one who tried)
}

export const room = registerMessages(Messages)
