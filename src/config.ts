// Every tuned number of the prop shed. Ported verbatim from the Spawn world's data files:
// scripts/lib/data/shop.yml, throw.yml, player.yml, aesthetic.yml (world seq 292).

// --- where the Spawn lot sits in the scene --------------------------------------------------------------
// Game logic runs in Spawn coordinates (shed centred on 0,0; -Z is the back wall, where the customers stand).
// Spawn is right-handed and Decentraland left-handed, so Z is flipped on the way out (see gfx.ts sp()/yaw()).
export const ORIGIN = { x: 28, z: 32 }
export const SCENE = { w: 48, d: 64 }

// --- shop.yml -------------------------------------------------------------------------------------------
export type DishId = 'knife' | 'machete' | 'chainsaw' | 'flashlight' | 'walkie' | 'glove'
export type Dish = { name: string; base: string; parts: string[]; sharp?: boolean; blood?: boolean; gas?: boolean; reward: number; seconds: number }
export type WhoId = 'ghost' | 'masked' | 'butcher' | 'dream' | 'girl' | 'sheriff'

export const S = {
  shiftSeconds: 180,
  grindSeconds: 1.8, // hold F at a grinder
  fillSeconds: 2.4, // hold F at the gas pump with the chainsaw in hand
  maxOrders: 2, // orders open at once (@sebadl: two at a time)
  firstOrderDelay: 2,
  orderGapStart: 18,
  orderGapEnd: 10,
  walkIn: 4, // seconds added to each ticket: the customer's walk to the window
  margin: 20, // extra seconds per recipe on top of its quick-pace time (@joa: 20 s for level 1)
  missPenalty: 10,
  tipMax: 10,
  stars: [60, 120, 200],
  queue: 0, // nobody waits behind them: two customers in the shed at once
  // seconds = the recipe walked at a quick pace; patience = seconds + margin + walkIn
  dishes: {
    knife: { name: 'Cuchillo ensangrentado', base: 'knife', parts: [], sharp: true, blood: true, reward: 20, seconds: 10 },
    machete: { name: 'Machete ensangrentado', base: 'machete', parts: [], sharp: true, blood: true, reward: 25, seconds: 10 },
    chainsaw: { name: 'Motosierra', base: 'saw', parts: ['chain'], gas: true, reward: 35, seconds: 10 },
    flashlight: { name: 'Linterna', base: 'torch', parts: ['bulb', 'battery'], reward: 25, seconds: 10 },
    walkie: { name: 'Walkie-talkie', base: 'walkie', parts: ['antenna', 'battery'], reward: 25, seconds: 15 },
    glove: { name: 'Guante con cuchillas', base: 'glove', parts: ['blades'], sharp: true, reward: 30, seconds: 15 }
  } as Record<DishId, Dish>,
  who: {
    ghost: { name: 'Cara de Fantasma', dish: 'knife' },
    masked: { name: 'El de la Máscara', dish: 'machete' },
    butcher: { name: 'Cara de Cuero', dish: 'chainsaw' },
    dream: { name: 'El de los Sueños', dish: 'glove' },
    girl: { name: 'La Última Chica', dish: 'flashlight' },
    sheriff: { name: 'El Sheriff', dish: 'walkie' }
  } as Record<WhoId, { name: string; dish: DishId }>,
  names: {
    knife: 'Cuchillo',
    machete: 'Machete',
    saw: 'Motosierra',
    torch: 'Linterna',
    walkie: 'Walkie',
    glove: 'Guante',
    chain: 'Cadena',
    bulb: 'Lamparita',
    battery: 'Pilas',
    antenna: 'Antena',
    blades: 'Cuchillas',
    scrap: 'Chatarra'
  } as Record<string, string>
}
export const NAMES_EN: Record<string, string> = {
  knife: 'Knife',
  machete: 'Machete',
  saw: 'Chainsaw',
  torch: 'Flashlight',
  walkie: 'Walkie',
  glove: 'Glove',
  chain: 'Chain',
  bulb: 'Bulb',
  battery: 'Batteries',
  antenna: 'Antenna',
  blades: 'Blades',
  scrap: 'Scrap'
}
export const DISH_EN: Record<DishId, string> = {
  knife: 'Bloody knife',
  machete: 'Bloody machete',
  chainsaw: 'Chainsaw',
  flashlight: 'Flashlight',
  walkie: 'Walkie-talkie',
  glove: 'Bladed glove'
}

// --- throw.yml (Q / LANZAR in Spawn; key 1 here) -----------------------------------------------------------
export const T = {
  speed: 2.4, // m/s forward: a soft lob, lands a bench and a half out
  carry: 1.0, // share of the maker's walking speed the throw keeps
  lift: 1.5, // m/s upward at release
  height: 1.05, // m, release height above the maker's feet
  ahead: 0.7, // m in front of the chest
  pickReach: 0.9, // m from the spot a metre ahead of the maker
  hardSpeed: 2.6, // knives, saws, torches
  gravity: 24 // places/main/config.yaml gravity.y
}

// --- player.yml / customer.js / wander.js --------------------------------------------------------------
export const WALK_SPEED = 6
export const CUSTOMER_SPEED = 1.9
export const WANDER_SPEED = 1.1

// --- places ---------------------------------------------------------------------------------------------
export const SPAWN_IN_SHED = { x: 0, y: 0.2, z: 0.4 } // places/main defaultSpawnPoint
export const SPAWN_ON_LOT = { x: 0, y: 0.2, z: 10.5 } // places/lobby defaultSpawnPoint (z 9.5), a step back from the deeper shed
// scripts/lib/doors.js: the shed's two doors on the lot. Green goes in; red was the private shoot (not ported).
// Spawn's lobby keeps its closed shed at the old depth (doors at z 2.95); here the one shed is the deeper
// working one (front wall z 4.05 since seq 292), so the doors stand on that wall.
export const DOORS = [
  { id: 'door-public', to: 'public', x: -2.6, z: 4.15 },
  { id: 'door-private', to: 'private', x: 2.6, z: 4.15 }
]
// the shed's inside, as scripts/camera.js tests it
export const insideShed = (x: number, z: number) => Math.abs(x) < 6.3 && Math.abs(z) < 4.3

// --- assets ---------------------------------------------------------------------------------------------
export const SND = (n: string) => `assets/Audio/sfx-${n}.mp3`
export const MUSIC = 'assets/Audio/music-prop-shop-rush-loop.mp3'
export const ICON = (n: string) => `assets/Images/${n}-ico.png`
export const MODEL = (who: string) => `assets/Models/${who}.glb`
export const TEX = {
  grass: 'assets/Textures/terrain-grass-realistic-albedo-summer-exploration.png',
  gravel: 'assets/Textures/terrain-gravel-realistic-albedo.png',
  wood: 'assets/Textures/pine-lumber-wood-grain.png',
  siding: 'assets/Textures/painted-aluminum-camper-siding.png',
  burlap: 'assets/Textures/burlap-canvas-weave.png',
  cotton: 'assets/Textures/wrinkled-cotton-fabric.png'
}
