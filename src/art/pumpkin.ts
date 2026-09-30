// Materials, spell colours, the jack-o'-bolt and the meteor button for the
// Pumpkin Witch, the Pyromancer's Hallow's Eve skin. The figure itself is drawn
// by the wizard's rig (wizard.ts) with its `head` set to 'witch': a tall,
// crooked hat with a bent tip and a band carrying a tiny jack-o'-lantern, long
// flame-orange hair past the shoulders, a pale green face with glowing eyes, a
// plum robe trimmed in orange with a ragged hem, embers and ghost-motes
// drifting round her, and a gnarled staff cradling a carved, glowing pumpkin.

import { PixelCanvas, hex, type Material, type RGB } from './pixel';
import { ORB_SIZE, meteorIcon, type MeteorColors, type SpellColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const WITCH_INK = hex('#07030a');

/** The robe: deep plum going nearly black in its folds. */
export const WITCH_ROBE: Material = {
  ramp: ramp('#10061a', '#1e0c2c', '#2e1440', '#442058', '#5e2e74'),
  outline: WITCH_INK,
  outlineLit: hex('#1a0a24'),
};

/** The robe's open front, the belt and the hat's underside: black with a violet sheen. */
export const WITCH_LINING: Material = {
  ramp: ramp('#08040c', '#120a1a', '#1c1028', '#2a1a3a'),
  outline: WITCH_INK,
};

/** The hat: violet-black felt, its lit side catching a little purple. */
export const WITCH_HAT: Material = {
  ramp: ramp('#0a0610', '#150c20', '#221434', '#321e4a', '#48306a'),
  outline: WITCH_INK,
  outlineLit: hex('#140a1e'),
};

/** The ribbon above the hat's band: a dusky violet. */
export const WITCH_RIBBON: Material = {
  ramp: ramp('#1e0a34', '#361458', '#52207e', '#7434a6'),
  outline: WITCH_INK,
  shine: true,
};

/** Pumpkin-orange trim: the hat band, the hem's stripe, the lacing. Glows faintly, like a candle behind it. */
export const PUMPKIN_TRIM: Material = {
  ramp: ramp('#5a1e06', '#a8440e', '#e8741a', '#ffa83a', '#ffd88a'),
  outline: hex('#1e0802'),
  outlineLit: hex('#3a1204'),
  shine: true,
  emissive: 0.2,
};

/** Long hair the colour of flame, dark at the roots. */
export const WITCH_HAIR: Material = {
  ramp: ramp('#3a0e06', '#7a2208', '#b8420e', '#ec6e1c', '#ffa448'),
  outline: hex('#140402'),
  outlineLit: hex('#2a0804'),
  shine: true,
};

/** A witch's pallor: pale, with a faint green cast. */
export const WITCH_SKIN: Material = {
  ramp: ramp('#3e5446', '#6a8a70', '#9cbc98', '#cae4c0'),
  outline: hex('#121c14'),
  outlineLit: hex('#1e2c20'),
};

/** Eyes lit from within, the orange of the lantern. */
export const WITCH_EYE: Material = {
  ramp: ramp('#ffb03a', '#fff0b0'),
  outline: WITCH_INK,
  emissive: 1,
  noAO: true,
};

/** Gnarled, blackened wood for the staff. */
export const GNARLWOOD: Material = {
  ramp: ramp('#140c0a', '#281a14', '#40291e', '#5a3c2a'),
  outline: hex('#060302'),
};

/** The carved pumpkin's rind: ribbed orange, warm from the candle inside. */
export const JACK_RIND: Material = {
  ramp: ramp('#6a2406', '#b4480c', '#ec7a1a', '#ffae40', '#ffdc90'),
  outline: hex('#200802'),
  outlineLit: hex('#3a1004'),
  shine: true,
  emissive: 0.35,
  noAO: true,
};

/** The candlelight showing through the carved face. */
export const JACK_FIRE: Material = {
  ramp: ramp('#ffc040', '#fff2b8'),
  outline: hex('#200802'),
  emissive: 1,
  noAO: true,
  noOutline: true,
};

/** The pumpkin's stem and the hat charm's: a dry green-brown. */
export const JACK_STEM: Material = {
  ramp: ramp('#1a2410', '#34461c', '#566a2a', '#7a8a3e'),
  outline: hex('#080c04'),
};

// Witchfire (light-only colours): candle white through pumpkin orange, to a violet dusk.
export const WITCH_CORE = hex('#fff4d8');
export const WITCH_HOT = hex('#ffc04a');
export const WITCH_MID = hex('#ff7a1a');
export const WITCH_DEEP = hex('#7a2ad0');
/** Ghost-light: the pale green of will-o'-the-wisps, for flecks and motes. */
export const WITCH_GHOST = hex('#9affa0');

export const PUMPKIN_SPELL: SpellColors = { core: WITCH_CORE, hot: WITCH_HOT, mid: WITCH_MID, deep: WITCH_DEEP, accent: WITCH_GHOST, flame: true };

/** A pumpkin plunging in flame: an orange rind for the rock, a candlelit face for its cracks, violet fire at the tail's end. */
export const PUMPKIN_METEOR: MeteorColors = {
  flame: ['#fff4d8', '#ffc04a', '#ff7a1a', '#7a2ad0'],
  rock: ['#ffc060', '#ff9a2e', '#e0661a', '#a8420e', '#3a1204'],
  cracks: ['#fff2b0', '#ffc040'],
};

/** The scorch it leaves: orange embers fading to violet. */
export const PUMPKIN_EMBERS: [RGB, RGB, RGB] = [[255, 170, 60], [224, 90, 26], [110, 36, 150]];

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// The jack-o'-bolt: a burning jack-o'-lantern. Pure light, like every orb.

/** Offsets of the carved face from the orb's centre: two slanted eyes and a gap-toothed grin. */
const FACE: [number, number][] = [
  [-2, -1], [-1, -1], [-1, -2], [1, -2], [1, -1], [2, -1],
  [-2, 1], [-1, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2],
];

export function jackOrbFrame(f: number, k: SpellColors = PUMPKIN_SPELL): PixelCanvas {
  const c = new PixelCanvas(ORB_SIZE, ORB_SIZE);
  const cx = 8;
  const cy = 8;
  const pulse = f % 2 === 0 ? 0 : 0.35;
  const face = new Set(FACE.map(([x, y]) => `${cx + x},${cy + y}`));
  for (let y = 0; y < ORB_SIZE; y++) {
    for (let x = 0; x < ORB_SIZE; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.12;
      let d = Math.hypot(dx, dy);
      if (face.has(`${x},${y}`)) {
        // The candle behind the carving: the brightest thing in the orb.
        c.spark(x, y, k.core, 1);
        continue;
      }
      if (d <= 4.1) {
        // The rind, dimmer than the carving so the face reads: grooves between
        // the lobes, and its upper-left rim catching the fire round it.
        const groove = Math.abs(Math.abs(dx) - 1.5) < 0.5 && d < 3.4;
        const rim = d > 2.9 && dx + dy < -1.5;
        c.spark(x, y, rim ? k.hot : k.mid, groove ? 0.55 : rim ? 0.85 : 0.92);
        continue;
      }
      // Fire licking round it, violet at its ragged edge.
      d -= (hash(Math.floor((Math.atan2(dy, dx) + Math.PI) * 2.4), f, 5) - 0.4) * 1.8;
      if (d <= 5.0 + pulse) c.spark(x, y, k.mid, 0.5);
      else if (d <= 6.0 + pulse && hash(x, y, f) > 0.35) c.spark(x, y, k.deep, 0.6);
      else if (d <= 6.8 && hash(x, y, f + 9) > 0.86) c.spark(x, y, k.deep, 0.35);
    }
  }
  // The stem.
  c.spark(cx, cy - 5, k.accent, 0.8);
  c.spark(cx + 1, cy - 6, k.accent, 0.5);
  // Two ghost-motes circling it.
  for (let m = 0; m < 2; m++) {
    const a = ((f * 45 + m * 180) * Math.PI) / 180;
    c.spark(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, k.accent, 0.95);
    c.spark(cx + Math.cos(a - 0.5) * 6, cy + Math.sin(a - 0.5) * 6, k.deep, 0.5);
  }
  return c;
}

// ---------------------------------------------------------------------------
// The meteor button: the flaming tail, with a carved pumpkin at its head.

export function pumpkinMeteorIcon(): Uint8ClampedArray {
  const px = meteorIcon(PUMPKIN_SPELL);
  const S = 16;
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // The pumpkin, lit from the upper left, ribs darker, over the tail's head.
  const hx = 5;
  const hy = 11;
  for (let y = hy - 4; y <= hy + 4; y++) {
    for (let x = hx - 5; x <= hx + 5; x++) {
      const dx = (x + 0.5 - (hx + 0.5)) / 4.2;
      const dy = (y + 0.5 - (hy + 0.5)) / 3.6;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const lit = -dx * 0.6 - dy * 0.8;
      let c = d > 0.72 ? '#5a1e06' : lit > 0.35 ? '#ffb040' : lit > -0.25 ? '#ec7a1a' : '#a8440e';
      if ((x === hx - 2 || x === hx + 2) && d < 0.72) c = '#a8440e';
      put(x, y, c);
    }
  }
  // Its carved face, candle-bright, and the stem.
  for (const [x, y] of [[-2, -1], [2, -1], [-2, 1], [-1, 2], [0, 1], [1, 2], [2, 1]]) put(hx + x, hy + y, x === 0 || y < 0 ? '#fff2b0' : '#ffc040');
  put(hx, hy - 4, '#566a2a');
  put(hx + 1, hy - 5, '#34461c');
  return px;
}
