// Rooms: several independent sheds, each with its own shift. Spawn fills the fullest public room that still has
// space and opens another when they are all full (scripts/routing.js); so does this.
export const ROOMS = 3
export const ROOM_CAP = 4 // Spawn: routing.maxPlayers
// Each room is its own shed, stacked above the lot: makers in other rooms are out of sight, the parcels stay as
// they are, and a client only ever builds the one interior it is in.
export const ROOM_Y = [20, 38, 56]

// the room an arriving maker goes to: the fullest one with space (lowest number on a tie), or -1 if all are full
export function pickRoom(counts: number[], cap = ROOM_CAP): number {
  let best = -1
  for (let k = 0; k < counts.length; k++) {
    if (counts[k] >= cap) continue
    if (best < 0 || counts[k] > counts[best]) best = k
  }
  return best
}
