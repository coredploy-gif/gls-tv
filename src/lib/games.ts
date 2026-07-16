export type GameAudience = "kids" | "all" | "challenge";



export type GamePack = "brick";



export type GlsGame = {

  id: string;

  title: string;

  blurb: string;

  path: string;

  accent: string;

  /** UI grouping on /games */

  audience: GameAudience;

  /** Optional pack for themed hub sections */

  pack?: GamePack;

  /** Short control tips shown on the detail / player page */

  howToPlay?: string[];

};



/** First-party hosted HTML5 games (same-origin, can report scores). */

export const GLS_GAMES: GlsGame[] = [

  {

    id: "memory-match",

    title: "Memory Match",

    blurb: "Flip cards, find pairs — gentle memory fun for younger players.",

    path: "/games/memory-match/index.html",

    accent: "#f5c842",

    audience: "kids",

    howToPlay: [

      "Tap a card to flip it, then find its match.",

      "Clear the board with as few flips as you can.",

    ],

  },

  {

    id: "color-catch",

    title: "Color Catch",

    blurb: "Tap the matching falling orbs before time runs out.",

    path: "/games/color-catch/index.html",

    accent: "#4ade80",

    audience: "kids",

    howToPlay: [

      "Watch the target color at the top.",

      "Tap only the matching orbs before time runs out.",

    ],

  },

  {

    id: "balloon-pop",

    title: "Balloon Pop",

    blurb: "Pop rising balloons — don’t let them float away.",

    path: "/games/balloon-pop/index.html",

    accent: "#ff7ab8",

    audience: "kids",

    howToPlay: [

      "Tap balloons before they float off the top.",

      "Miss too many and the round ends.",

    ],

  },

  {

    id: "slide-puzzle",

    title: "Slide Puzzle",

    blurb: "Slide tiles into order. Calm puzzle play for everyone.",

    path: "/games/slide-puzzle/index.html",

    accent: "#7ec8ff",

    audience: "kids",

    howToPlay: [

      "Tap a tile next to the empty space to slide it.",

      "Arrange numbers (or pieces) into order.",

    ],

  },

  {

    id: "pulse-2048",

    title: "Pulse 2048",

    blurb: "Slide tiles, stack powers of two, chase the board high score.",

    path: "/games/pulse-2048/index.html",

    accent: "#ff5a6a",

    audience: "all",

    howToPlay: [

      "Swipe or use arrow keys to slide all tiles.",

      "Merge matching numbers to climb toward 2048.",

    ],

  },

  {

    id: "neon-snake",

    title: "Neon Snake",

    blurb: "Classic endless snake — grow fast, don’t hit the walls.",

    path: "/games/neon-snake/index.html",

    accent: "#5ee29a",

    audience: "all",

    howToPlay: [

      "Arrow keys or swipe to steer.",

      "Eat food to grow — don’t hit walls or yourself.",

    ],

  },

  {

    id: "brick-stack",

    title: "Brick Stack",

    blurb: "Falling blocks, clear lines — the classic handheld brick puzzle.",

    path: "/games/brick-stack/index.html",

    accent: "#5ee29a",

    audience: "all",

    pack: "brick",

    howToPlay: [

      "← → / A D move · ↑ / W rotate · ↓ / Space soft drop · Enter hard drop.",

      "Clear full rows for big points. Speed ramps up as you clear lines.",

      "Mute from the game bar if you want silent play.",

    ],

  },

  {

    id: "pixel-race",

    title: "Pixel Race",

    blurb: "Lane-dodge racing from the old brick handheld — survive the traffic.",

    path: "/games/pixel-race/index.html",

    accent: "#f5c842",

    audience: "all",

    pack: "brick",

    howToPlay: [

      "← → / A D (or tap left/right) to switch lanes.",

      "Dodge oncoming cars — score climbs with distance and speed.",

      "Crash ends the run. Mute available in-game.",

    ],

  },

  {

    id: "block-tank",

    title: "Block Tank",

    blurb: "Move, fire, clear waves — brick-style tank battles.",

    path: "/games/block-tank/index.html",

    accent: "#7ec8ff",

    audience: "challenge",

    pack: "brick",

    howToPlay: [

      "← → / A D move · Space / ↑ fire.",

      "Destroy enemy tanks, use walls for cover, survive each wave.",

      "Getting hit or colliding with an enemy ends the run.",

    ],

  },

  {

    id: "brick-pair",

    title: "Brick Pair",

    blurb: "Match shapes on a compact brick grid — quick memory rounds.",

    path: "/games/brick-pair/index.html",

    accent: "#ff8a65",

    audience: "kids",

    pack: "brick",

    howToPlay: [

      "Tap two tiles to flip them.",

      "Match identical shapes to score — finish the board for a clear bonus.",

    ],

  },

  {

    id: "orbit-runner",

    title: "Orbit Runner",

    blurb: "Dodge asteroids in a sharp canvas endless runner.",

    path: "/games/orbit-runner/index.html",

    accent: "#7ec8ff",

    audience: "challenge",

    howToPlay: [

      "Steer to dodge asteroids.",

      "Survive as long as you can for a higher score.",

    ],

  },

  {

    id: "reaction-rush",

    title: "Reaction Rush",

    blurb: "Wait for green, then tap — five rounds of pure reflex timing.",

    path: "/games/reaction-rush/index.html",

    accent: "#ff5a6a",

    audience: "challenge",

    howToPlay: [

      "Wait for the screen to turn green, then tap as fast as you can.",

      "Five rounds — early taps hurt your score.",

    ],

  },

  {

    id: "number-blitz",

    title: "Number Blitz",

    blurb: "45 seconds of mental math. Streaks multiply your score.",

    path: "/games/number-blitz/index.html",

    accent: "#fbbf24",

    audience: "challenge",

    howToPlay: [

      "Solve each equation before time runs out.",

      "Streaks multiply your score — keep answering correctly.",

    ],

  },

  {

    id: "brick-break",

    title: "Brick Break",

    blurb: "Precision paddle aim — clear rows, launch the next wave.",

    path: "/games/brick-break/index.html",

    accent: "#ff8a65",

    audience: "challenge",

    pack: "brick",

    howToPlay: [

      "Move the paddle with pointer / touch.",

      "Tap or click to launch the ball — clear every brick to start the next wave.",

      "Don’t let the ball fall past the paddle.",

    ],

  },

  {

    id: "mole-smash",

    title: "Mole Smash",

    blurb: "Whack popping moles on a 3×3 field before the timer ends.",

    path: "/games/mole-smash/index.html",

    accent: "#c4a35a",

    audience: "kids",

    howToPlay: [

      "Tap moles as they pop up from the holes.",

      "Score as many as you can in 30 seconds.",

    ],

  },

  {

    id: "flutter-dash",

    title: "Flutter Dash",

    blurb: "Tap to flap through gaps — a tiny endless flyer.",

    path: "/games/flutter-dash/index.html",

    accent: "#6ec8ff",

    audience: "all",

    howToPlay: [

      "Tap or press Space to flap upward.",

      "Clear pipe gaps — each gap is a point.",

    ],

  },

  {

    id: "star-scoop",

    title: "Star Scoop",

    blurb: "Catch falling stars, dodge rocks — quick scoop-and-survive.",

    path: "/games/star-scoop/index.html",

    accent: "#f5c842",

    audience: "kids",

    howToPlay: [

      "Move the scoop to catch stars.",

      "Avoid rocks and don’t miss stars — you have three lives.",

    ],

  },

  {

    id: "tone-echo",

    title: "Tone Echo",

    blurb: "Repeat the glowing pad sequence — memory with soft tones.",

    path: "/games/tone-echo/index.html",

    accent: "#b794f6",

    audience: "all",

    howToPlay: [

      "Watch the pads light up, then tap the same order.",

      "Each round adds one more step. Soft beeps play with each pad.",

    ],

  },

  {

    id: "paddle-duel",

    title: "Paddle Duel",

    blurb: "Side-to-side paddle rally vs a light CPU — first to seven.",

    path: "/games/paddle-duel/index.html",

    accent: "#5ee29a",

    audience: "challenge",

    howToPlay: [

      "Drag to move your paddle along the bottom.",

      "Score points past the CPU — first to 7 wins; your score is points you scored.",

    ],

  },

  {

    id: "sweet-match",

    title: "Sweet Match",

    blurb: "Swap colorful sweets to clear matches of three or more.",

    path: "/games/sweet-match/index.html",

    accent: "#ff8fab",

    audience: "kids",

    howToPlay: [

      "Tap two neighboring sweets to swap them.",

      "Make 3+ in a row to clear — chain matches for bigger scores before moves run out.",

    ],

  },

  {

    id: "balloon-burst",

    title: "Balloon Burst",

    blurb: "Aim your bow and burst rising balloons with arrows.",

    path: "/games/balloon-burst/index.html",

    accent: "#5ec8ff",

    audience: "all",

    howToPlay: [

      "Tap where you want to shoot — the bow aims and fires an arrow.",

      "Burst balloons before they float away. Lose three escapes and the round ends.",

    ],

  },

  {

    id: "spike-drop",

    title: "Spike Drop",

    blurb: "Steer a falling emoji — bounce on soft pads, dodge spike traps.",

    path: "/games/spike-drop/index.html",

    accent: "#f5c842",

    audience: "challenge",

    howToPlay: [

      "Slide or use ← → to steer as you fall.",

      "Land on green pads to bounce and score — spikes end the run.",

    ],

  },

];



export const AUDIENCE_META: Record<

  GameAudience,

  { label: string; description: string }

> = {

  kids: {

    label: "Kids",

    description: "Easy controls, bright play — great for younger viewers.",

  },

  all: {

    label: "Everyone",

    description: "Classic pick-up-and-play for any age.",

  },

  challenge: {

    label: "Challenge",

    description: "Tighter timing, sharper skill, higher stakes.",

  },

};



export const PACK_META: Record<

  GamePack,

  { label: string; description: string }

> = {

  brick: {

    label: "Brick Classics",

    description:

      "Old handheld brick-game vibes — stack, race, tank, pair, and break.",

  },

};



export function getGame(id: string) {

  return GLS_GAMES.find((g) => g.id === id) || null;

}



export function isKnownGameId(id: string) {

  return GLS_GAMES.some((g) => g.id === id);

}



export function gamesByAudience(audience: GameAudience) {

  return GLS_GAMES.filter((g) => g.audience === audience);

}



export function gamesByPack(pack: GamePack) {

  return GLS_GAMES.filter((g) => g.pack === pack);

}


