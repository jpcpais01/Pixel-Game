// The Lantern Wraith: a tall hooded wraith drifting over the ground, an empty
// hood with two eye-lights in its dark, tattered robes streaming into ragged
// strips, wide sleeves, and an old iron lantern on a chain, burning with a
// green soul-flame. Its Calavera skin is a Día de Muertos spirit on the same
// drift: a painted sugar-skull face (flowers round the eyes, a heart for a
// nose, a stitched smile), a crown of marigolds, a black lace veil, a
// crimson gown embroidered with flowers and ruffled in black lace, fading to
// mist, and a paper lantern glowing gold through its cut-outs. Its Firefly
// skin is a gentle forest spirit rather than a dread one: a maiden in a mossy
// hooded cloak trimmed with ferns and tiny mushrooms, open over a pale sage
// gown, a soft face in the hood with long leafy hair spilling out of it, a
// willow-wicker lantern full of fireflies, and fireflies drifting round her.
// Its Ferryman skin is the ferryman of the dead: taller, in a deep hooded
// robe of charcoal-blue frayed at the hem and tied with a cord, a skull in
// the hood's shadow lit only by two pale cyan eye-lights, a coin for the
// crossing hung on a cord at its chest, and a long punting pole whose crook
// carries the lantern, burning with a spectral teal ghostfire.
//
// Also here: the wisps it leaves (green soul-flames; marigold petals for the
// Calavera; fireflies for the Firefly; pale teal soul-flames for the
// Ferryman) and the icons.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const WRAITH_W = 48;
export const WRAITH_H = 50;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame. */
const BODY_X = 12;
const BODY_Y = 12;
export const WRAITH_ORIGIN_X = BODY_X + 12;
export const WRAITH_ORIGIN_Y = BODY_Y + 31;
/** The lantern's height above the ground at rest, where wisps are left. */
export const WRAITH_LANTERN_Y = 8;
export const WRAITH_CHEST_Y = 14;
/** The idle moment's dissolve: how much later the top of it goes than the bottom (0 all at once), and its wisps. */
const DISSOLVE_TOP = 0.6;
const WISPS = 18;
/** The fireflies always drifting round the Firefly: how many, and how far out. */
const SWARM = 7;
const SWARM_RX = 9;
const SWARM_RY = 6;
/** The Ferryman stands this much taller, and its lantern hangs from the pole's crook, this high at rest. */
const FERRY_TALL = 1;
export const FERRY_LANTERN_Y = 19;

// ---------------------------------------------------------------------------
// Materials

const ROBE: Material = { ramp: ramp('#0a0e14', '#141c26', '#202c38', '#2e3e4c', '#425664'), outline: hex('#030406'), outlineLit: hex('#0c1218') };
const ROBE_EDGE: Material = { ramp: ramp('#0c2a28', '#17504a', '#2a7a6c', '#46a890'), outline: hex('#041412'), emissive: 0.25 };
const HOOD_DARK: Material = { ramp: ramp('#000000', '#030406', '#07090c'), outline: hex('#000000'), noAO: true, noOutline: true };
const SOUL: Material = { ramp: ramp('#1a8a6a', '#4af0b0', '#c8fff0'), outline: hex('#063a2a'), emissive: 1, noAO: true, noOutline: true };
const BONE: Material = { ramp: ramp('#4a4a4e', '#7e7a6c', '#b0a98e', '#dcd4b4'), outline: hex('#1a1814'), shine: true };
const IRON: Material = { ramp: ramp('#0c0d12', '#1a1c24', '#2e3240', '#4a5064'), outline: hex('#030305'), shine: true };
const GREEN_FLAME: Material = { ramp: ramp('#1a7a52', '#3ad890', '#b0ffd8', '#ffffff'), outline: hex('#063a22'), emissive: 1, noAO: true, noOutline: true };
const MIST: Material = { ramp: ramp('#16302e', '#2a5450', '#4a8880'), outline: hex('#081614'), emissive: 0.3, noAO: true, noOutline: true };

// The Calavera.
const SKULL: Material = { ramp: ramp('#7e786c', '#b4ae9c', '#dcd8cc', '#f6f4ec'), outline: hex('#221c18'), shine: true, emissive: 0.08 };
const INK: Material = { ramp: ramp('#07050a', '#140e1c', '#221a2e'), outline: hex('#020104'), noAO: true };
const PETAL_PINK: Material = { ramp: ramp('#901c56', '#e0448e', '#ff90c4'), outline: hex('#3a0a20'), noOutline: true, noAO: true, emissive: 0.25 };
const PETAL_TEAL: Material = { ramp: ramp('#0a6e6e', '#2ac0b8', '#90f0e8'), outline: hex('#063a3a'), noOutline: true, noAO: true, emissive: 0.25 };
const MARIGOLD: Material = { ramp: ramp('#8a3406', '#d8680e', '#f4a024', '#ffd460'), outline: hex('#2e1002'), shine: true, emissive: 0.12 };
const LACE_BLACK: Material = { ramp: ramp('#07060a', '#141220', '#221e30'), outline: hex('#020104'), noAO: true };
const GOWN: Material = { ramp: ramp('#22040c', '#4a0818', '#761428', '#a2243e', '#c84a5e'), outline: hex('#0c0204'), outlineLit: hex('#1a040a') };
const GOWN_MIST: Material = { ramp: ramp('#4a1422', '#8a3e4e', '#c47e88'), outline: hex('#2a0a10'), emissive: 0.4, noAO: true, noOutline: true };
const EMBROIDERY: Material[] = [
  { ramp: ramp('#a8580a', '#f0b030'), outline: hex('#3a1a02'), noOutline: true, noAO: true },
  { ramp: ramp('#0a7474', '#34ccbc'), outline: hex('#063a3a'), noOutline: true, noAO: true },
  { ramp: ramp('#901c70', '#e864b8'), outline: hex('#3a0a2a'), noOutline: true, noAO: true },
];
const PAPER: Material = { ramp: ramp('#6a0a38', '#b01e64', '#e04a8e', '#ff86b8'), outline: hex('#240414'), emissive: 0.2 };
const GOLD_LIGHT: Material = { ramp: ramp('#ff9a2a', '#ffd860', '#fffbd0'), outline: hex('#5a2a06'), emissive: 1, noAO: true, noOutline: true };

// The Firefly.
const MOSS: Material = { ramp: ramp('#132414', '#1e3a1e', '#2e5428', '#46703a', '#62904c'), outline: hex('#07100a'), outlineLit: hex('#0f1e10') };
const SAGE: Material = { ramp: ramp('#5a6a4a', '#8a9c74', '#b8c8a0', '#dce6c4', '#f2f6e2'), outline: hex('#1a2214'), outlineLit: hex('#2a3420') };
const FERN: Material = { ramp: ramp('#1e5a1e', '#3a8a2a', '#6ab840', '#a0e060'), outline: hex('#0a200a'), noAO: true };
const LEAF_HAIR: Material = { ramp: ramp('#3a4a1a', '#5e7a26', '#86a436', '#b4cc52', '#dcec84'), outline: hex('#141a08'), outlineLit: hex('#222e10') };
const FAE_SKIN: Material = { ramp: ramp('#8a6a5c', '#c49c88', '#e8c8b4', '#f8e4d6', '#fff4ea'), outline: hex('#2e1e18'), outlineLit: hex('#4a3428') };
const FAE_EYE: Material = { ramp: ramp('#14301a', '#1e4426'), outline: hex('#06100a'), noAO: true };
const FAE_LIP: Material = { ramp: ramp('#a05a5a', '#c87a74'), outline: hex('#2e1e18'), noAO: true };
const MUSH_CAP: Material = { ramp: ramp('#8a6a3a', '#c8a060', '#ecd4a0', '#fff2d0'), outline: hex('#2a1c0a'), shine: true, emissive: 0.15 };
const MUSH_STALK: Material = { ramp: ramp('#8a8468', '#b8b090', '#e8e2c8'), outline: hex('#2a2618'), noAO: true };
const WICKER: Material = { ramp: ramp('#3a2610', '#6a4a22', '#9a7438', '#c8a058'), outline: hex('#1a1006') };
const FIREFLY: Material = { ramp: ramp('#8ac02a', '#d0f050', '#f6ffb0'), outline: hex('#2a4006'), emissive: 1, noAO: true, noOutline: true };
/** The fireflies' light, for sparks. */
const FLY_GLOW: RGB = [210, 255, 120];

// The Ferryman.
const FERRY_ROBE: Material = { ramp: ramp('#07090f', '#0f131d', '#19202e', '#252e42', '#354058'), outline: hex('#020306'), outlineLit: hex('#0a0e16') };
/** The skull in the hood's shadow: bone, but dim, lit from its own eyes. */
const SHADE_SKULL: Material = { ramp: ramp('#262a2e', '#464a4a', '#6e706a', '#9a988c'), outline: hex('#050607'), noAO: true };
const CYAN_EYE: Material = { ramp: ramp('#2a9ab0', '#62d8f0', '#a8f4ff'), outline: hex('#0a3a44'), emissive: 1, noAO: true, noOutline: true };
const POLE: Material = { ramp: ramp('#18140f', '#30271d', '#4c3f2f', '#6c5c48', '#8c7a64'), outline: hex('#080604') };
const GHOSTFIRE: Material = { ramp: ramp('#1a7e86', '#36c8b6', '#7af0dc', '#c4fff2'), outline: hex('#063036'), emissive: 1, noAO: true, noOutline: true };
const FERRY_SOUL: Material = { ramp: ramp('#2a8a96', '#7ae8e0', '#dafffa'), outline: hex('#08343a'), emissive: 1, noAO: true, noOutline: true };
const RIVER_MIST: Material = { ramp: ramp('#162c38', '#2e5464', '#5a8a9a'), outline: hex('#08141a'), emissive: 0.3, noAO: true, noOutline: true };
const COIN: Material = { ramp: ramp('#5a3a0e', '#a07420', '#e0b440', '#fff0a0'), outline: hex('#1e1204'), shine: true, emissive: 0.1 };
const CORD: Material = { ramp: ramp('#140e08', '#2e2214', '#4a3820'), outline: hex('#060402'), noAO: true };
/** The ghostfire's light, and the eye-lights', for sparks. */
const TEAL_GLOW: RGB = [120, 255, 230];
const CYAN_GLOW: RGB = [150, 240, 255];

export interface WraithLook {
  key: string;
  calavera: boolean;
  /** The Firefly: a forest maiden in a mossy cloak, a wicker lantern of fireflies. */
  firefly?: boolean;
  /** The Ferryman: a skull in a deep hood, a punting pole with the lantern on its crook. */
  ferryman?: boolean;
}

export const WRAITH_LOOK: WraithLook = { key: 'wraith', calavera: false };
export const CALAVERA_LOOK: WraithLook = { key: 'wraith_cala', calavera: true };
export const FIREFLY_LOOK: WraithLook = { key: 'wraith_firefly', calavera: false, firefly: true };
export const FERRYMAN_LOOK: WraithLook = { key: 'wraith_ferry', calavera: false, ferryman: true };
export const WRAITH_LOOKS = [WRAITH_LOOK, CALAVERA_LOOK, FIREFLY_LOOK, FERRYMAN_LOOK];

let L: WraithLook = WRAITH_LOOK;

type View = 'down' | 'up' | 'side';

export interface WraithPose {
  bob: number;
  /** The ragged hem's stream (side view: how far behind), and its flutter phase. */
  trail: number;
  flutter: number;
  /** The lantern: sideways from the hand, raised, and how bright it burns 0..1. */
  swing: number;
  lift: number;
  blaze: number;
  /** Pitched forward (a dive), in px. */
  lean: number;
  /** 0..1: stretched thin (possessing). */
  stretch: number;
  /** The idle moment: the head tilted a px left (-) or right; 0..1 the body dissolved to wisps; 0..1 how far the wisps have drifted, and their swirl. */
  tilt: number;
  fade: number;
  scatter: number;
  swirl: number;
}

const base = (): WraithPose => ({ bob: 0, trail: 0, flutter: 0, swing: 0, lift: 0, blaze: 0.4, lean: 0, stretch: 0, tilt: 0, fade: 0, scatter: 0, swirl: 0 });

// ---------------------------------------------------------------------------
// The body (body-box coordinates: 24 wide, the ground at y 31; it floats)

/** The robe (or gown): shoulders to a hem of ragged strips (or ruffles fading to mist). */
function robe(c: PixelCanvas, cx: number, top: number, hem: number, p: WraithPose, view: View): void {
  const side = view === 'side';
  const cala = L.calavera;
  const fly = !!L.firefly;
  const ferry = !!L.ferryman;
  const m = cala ? GOWN : fly ? MOSS : ferry ? FERRY_ROBE : ROBE;
  const edge = (y: number): [number, number] => {
    const u = (y - top) / (hem - top);
    // The Firefly's cloak is narrow at the shoulders and flares to its hem.
    const hw = fly
      ? (side ? 2.9 : 3.5) + u * u * (side ? 2.6 : 3.0)
      : ferry
        ? (side ? 3.2 : 4.0) + u * u * (side ? 2.0 : 2.3)
        : (side ? 3.4 : 4.3) + u * u * (side ? 2.2 : 2.4);
    const back = side ? u * u * (1 + p.trail) : 0;
    return [cx - hw + back * 0.3, cx + hw + back];
  };
  c.shape(Math.round(top), Math.round(hem), edge, m, (_x, y, t) => sphere(t * 0.9, 0.3 - ((y - top) / (hem - top)) * 0.6, 1));
  // Folds falling down it.
  for (let y = Math.round(top + 3); y <= hem; y++) {
    const u = (y - top) / (hem - top);
    c.shade(Math.round(cx - 2.2 - u), y, -1);
    if (!side) c.shade(Math.round(cx + 2.2 + u), y, -1);
  }
  // The hem: ragged strips, or mist.
  c.part();
  const [l, r] = edge(hem);
  for (let x = Math.round(l); ferry && x < r; x++) {
    // The Ferryman's hem is frayed: loose threads of every length hanging
    // from it, thinning out, and the river's mist curling round their ends.
    const n = 1 + Math.round(hash(x, 5) * 3);
    for (let i = 1; i <= n + 2; i++) {
      const y = Math.round(hem + i);
      const drift = side ? Math.round((i / (n + 2)) * (0.5 + p.trail * 0.5)) : Math.round(Math.sin(x * 0.7 + p.flutter) * (i / (n + 2)) * 0.8);
      if (i <= n) {
        if (i < 2 || (x + i) % 2 === 0) c.px(x + drift, y, FERRY_ROBE, sphere(0, -0.3), { bias: i > 1 ? -1 : 0 });
      } else if ((x + y + Math.round(p.flutter)) % 2 === 0) c.px(x + drift, y, RIVER_MIST, { x: 0, y: 0, z: 1 });
    }
  }
  for (let x = Math.round(l); !ferry && x < r; x++) {
    const n = cala ? 3 : fly ? 1 + (hash(x, 7) > 0.45 ? 1 : 0) : 1 + (((x * 7 + 3) % 3) + ((x + Math.round(p.flutter)) % 2));
    for (let i = 1; i <= n; i++) {
      const y = Math.round(hem + i);
      const drift = side ? Math.round((i / n) * (0.5 + p.trail * 0.4)) : Math.round(Math.sin(x * 0.8 + p.flutter) * (i / n) * 0.8);
      if (cala) {
        if ((x + y + Math.round(p.flutter)) % (i < 2 ? 2 : 3) === 0) c.px(x + drift, y, GOWN_MIST, { x: 0, y: 0, z: 1 });
      } else if (fly) {
        // A fringe of little fern fronds.
        c.px(x + drift, y, i === n ? FERN : MOSS, sphere(0, 0.3), { bias: i === n && (x & 1) ? 1 : 0 });
      } else if (i < n || x % 2 === 0) c.px(x + drift, y, i === n ? MIST : ROBE, sphere(0, -0.3));
    }
  }
  c.part();
  if (ferry) {
    ferryTrim(c, cx, top, hem, edge, view);
  } else if (fly) {
    fernTrim(c, cx, top, hem, edge, p, view);
  } else if (cala) {
    // Embroidered flowers, and black lace ruffles.
    for (let y = Math.round(top + 2); y < hem; y += 3) {
      const [a, b] = edge(y);
      for (let x = Math.round(a + 1); x < b - 1; x += 3) {
        const k = (x * 5 + y * 3) % 7;
        if (k > 2) continue;
        c.px(x + ((y / 3) % 2), y, EMBROIDERY[k], { x: 0, y: 0, z: 1 });
      }
    }
    for (const fy of [Math.round(top + (hem - top) * 0.6), Math.round(hem)]) {
      const [a, b] = edge(fy);
      for (let x = Math.round(a); x < b; x++) if (c.filled(x, fy)) c.px(x, fy, LACE_BLACK, sphere(0, 0.3), { bias: x % 2 });
    }
  } else {
    // A faintly glowing trim along the hem, and down the front.
    for (let x = Math.round(l); x < r; x++) if (c.filled(x, Math.round(hem))) c.px(x, Math.round(hem), ROBE_EDGE, sphere(0, 0.4));
    if (!side) for (let y = Math.round(top + 4); y < hem; y++) c.px(Math.round(cx - 0.5), y, ROBE_EDGE, { x: 0, y: 0.1, z: 1 }, { bias: -1 });
  }
}

/** A wide sleeve from the shoulder to the hand, a bony hand at its end. */
function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number): void {
  if (L.firefly) {
    // A soft bell sleeve with a fern cuff, a slender hand.
    c.capsule(sx, sy, hx, hy - 0.8, 1.2, 1.6, MOSS);
    c.px(Math.round(hx - 0.5), Math.round(hy - 0.6), FERN, sphere(0, 0.3));
    c.ellipse(hx, hy + 0.3, 0.8, 0.85, FAE_SKIN);
    return;
  }
  c.capsule(sx, sy, hx, hy - 0.8, 1.4, L.calavera ? 1.2 : 1.9, L.calavera ? GOWN : L.ferryman ? FERRY_ROBE : ROBE);
  if (L.calavera) for (let a = -1; a <= 0; a++) c.px(Math.round(hx + a), Math.round(hy - 0.5), LACE_BLACK, { x: 0, y: -0.3, z: 0.9 });
  c.ellipse(hx, hy + 0.3, 0.9, 0.9, BONE);
}

/** The lantern hanging from the hand: an iron one with a soul-flame, or a paper one glowing gold. */
function lantern(c: PixelCanvas, hx: number, hy: number, p: WraithPose, view: View): void {
  const lx = hx + p.swing;
  const ly = hy + 1.5 - p.lift;
  if (L.firefly) {
    wickerLantern(c, hx, hy, lx, ly, p);
    return;
  }
  if (L.ferryman) {
    ferryPole(c, hx, hy, p, view);
    return;
  }
  c.part();
  c.line(hx, hy, lx, ly, L.calavera ? INK : IRON);
  c.part();
  const glow = 0.5 + p.blaze * 0.5;
  if (L.calavera) {
    c.ellipse(lx, ly + 2.6, 2.2, 2.4, PAPER);
    c.part();
    for (const dy of [-1, 1]) for (let x = Math.round(lx - 2); x <= lx + 1; x++) if ((x + dy) % 2 === 0) c.px(x, Math.round(ly + 2.6 + dy), GOLD_LIGHT, { x: 0, y: 0, z: 1 }, { glow });
    c.px(Math.round(lx - 0.5), Math.round(ly + 0.3), INK);
    c.px(Math.round(lx - 0.5), Math.round(ly + 5), PETAL_PINK);
  } else {
    c.shape(Math.round(ly + 1), Math.round(ly + 4), () => [lx - 1.6, lx + 1.6], IRON, (_x, _y, t) => cyl(t, 0.2));
    c.part();
    for (let y = Math.round(ly + 1.5); y <= ly + 3.5; y++) c.px(Math.round(lx - 0.5), y, GREEN_FLAME, { x: 0, y: 0, z: 1 }, { glow, bias: y < ly + 2.5 ? 1 : 0 });
    c.ellipse(lx, ly + 0.6, 2, 0.7, IRON, { flatten: 0.5 });
    c.ellipse(lx, ly + 4.6, 2, 0.6, IRON, { flatten: 0.5 });
  }
  const col: RGB = L.calavera ? [255, 210, 110] : [110, 255, 190];
  for (let a = 0; a < 10; a++) {
    const q = (a / 10) * Math.PI * 2;
    c.spark(lx + Math.cos(q) * 3.2, ly + 2.6 + Math.sin(q) * 3.2, col, 0.1 + p.blaze * 0.18);
  }
}

/** The hood: a point falling back, and inside, dark, two eye-lights. */
function hood(c: PixelCanvas, cx: number, cy: number, view: View, p: WraithPose): void {
  if (L.firefly) {
    faeHood(c, cx, cy, view, p);
    return;
  }
  if (L.ferryman) {
    ferryHood(c, cx, cy, view, p);
    return;
  }
  c.part();
  const side = view === 'side';
  c.ellipse(cx + (side ? 0.7 : 0), cy, side ? 3.8 : 4.2, 4.1, ROBE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // (A tilt of the head flops the hood's point over the other way.)
  c.capsule(cx + (side ? 1.6 : 0.3), cy - 3, cx + (side ? 3.8 : 1.2 - p.tilt * 2.2), cy - 6 + Math.abs(p.tilt) * 0.8, 1.7, 0.5, ROBE);
  if (view === 'up') return;
  c.part();
  const ox = side ? cx - 2 : cx;
  c.ellipse(ox, cy + 0.6, side ? 1.5 : 2.6, 2.8, HOOD_DARK);
  for (const [ex, ey] of eyeSpots(ox, cy, side, p.tilt)) c.px(ex, ey, SOUL, { x: 0, y: 0, z: 1 }, { glow: 0.7 + p.blaze * 0.3 });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.12 + (i / 8) * Math.PI * 0.76;
    if (side && Math.cos(a) > 0) continue;
    c.px(Math.round(ox - 0.5 - Math.cos(a) * (side ? 1.8 : 2.9)), Math.round(cy + 0.6 - Math.sin(a) * 3.1), ROBE_EDGE, sphere(-Math.cos(a) * 0.5, 0.4));
  }
}

/** Where the hood's eye-lights are (pixels): a tilt drops the eye on the side it leans to. */
function eyeSpots(ox: number, cy: number, side: boolean, tilt: number): [number, number][] {
  const eyes = side ? [ox - 0.5] : [ox - 1.2, ox + 1.2];
  return eyes.map((ex) => [Math.round(ex - 0.5), Math.round(cy + 0.2) + (!side && Math.sign(ex - ox) === Math.sign(tilt) ? 1 : 0)]);
}

/** The Calavera's head: the painted skull and the marigold crown. */
function skull(c: PixelCanvas, cx: number, cy: number, view: View, p: WraithPose): void {
  const side = view === 'side';
  c.part();
  c.ellipse(cx + (side ? 0.4 : 0), cy + 0.2, side ? 3.3 : 3.7, 3.9, view === 'up' ? LACE_BLACK : SKULL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  if (view !== 'up') {
    c.part();
    const eyes = side ? [cx - 1.4] : [cx - 1.5, cx + 1.5];
    for (const ex of eyes) {
      // A tilt of the head drops the eye on the side it leans to.
      const ey = cy + (!side && Math.sign(ex - cx) === Math.sign(p.tilt) ? 1 : 0);
      c.px(Math.round(ex - 0.5), Math.round(ey - 0.2), INK);
      c.px(Math.round(ex - 0.5), Math.round(ey + 0.8), INK);
      // Petals painted round the socket.
      c.px(Math.round(ex - 1.5), Math.round(ey - 0.2), PETAL_PINK);
      c.px(Math.round(ex + 0.5), Math.round(ey - 0.2), PETAL_TEAL);
      c.px(Math.round(ex - 0.5), Math.round(ey - 1.2), PETAL_PINK);
      c.spark(ex - 0.5, ey + 0.3, [255, 210, 110], 0.4 + p.blaze * 0.4);
    }
    const nx = side ? cx - 2.6 : cx - 0.5;
    c.px(Math.round(nx), Math.round(cy + 1.8), INK);
    const m0 = side ? cx - 3 : cx - 2;
    const m1 = side ? cx - 0.5 : cx + 1;
    for (let x = Math.round(m0); x <= m1; x++) {
      c.px(x, Math.round(cy + 3), INK);
      if (x % 2 === 0) c.px(x, Math.round(cy + 2.5), INK, { x: 0, y: 0, z: 1 }, { bias: 1 });
    }
  }
  c.part();
  const n = side ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = Math.PI * (1.1 + k * 0.8);
    const fx = cx + (side ? 0.6 : 0) + Math.cos(a) * (side ? 3.4 : 3.9);
    const fy = cy - 0.6 + Math.sin(a) * 3.9;
    c.ellipse(fx, fy, 1.1, 1, MARIGOLD);
    c.px(Math.round(fx - 0.5), Math.round(fy - 0.5), MARIGOLD, { x: 0, y: 0, z: 1 }, { bias: -2 });
  }
}

/** The black lace veil hanging from the crown behind her. */
function veil(c: PixelCanvas, cx: number, cy: number, view: View): void {
  c.part();
  const side = view === 'side';
  const bottom = cy + (view === 'up' ? 12 : 8);
  for (let y = Math.round(cy - 2); y <= bottom; y++) {
    const k = (y - cy + 2) / (bottom - cy + 2);
    const hw = 4 + k * 2.2;
    const x0 = side ? cx - 0.5 + k * 2 : cx - hw;
    const x1 = side ? cx + 4 + k * 3 : cx + hw;
    for (let x = Math.round(x0); x < x1; x++) {
      const hole = (x + y) % 3 === 0 && (x - y) % 2 === 0;
      if (hole || (y === Math.round(bottom) && x % 2)) continue;
      c.px(x, y, LACE_BLACK, { x: 0, y: 0.1, z: 1 });
    }
  }
}

// ---------------------------------------------------------------------------
// The Firefly

/** A tiny mushroom: a cream cap (`big`: three wide with a crown) on a pale stalk, its foot at (x, y). */
function mushroom(c: PixelCanvas, x: number, y: number, big = false): void {
  c.part();
  c.px(x, y, MUSH_STALK, sphere(0, 0.2));
  c.px(x, y - 1, MUSH_CAP, sphere(0.1, -0.2));
  c.px(x - 1, y - 1, MUSH_CAP, sphere(-0.6, 0));
  if (big) {
    c.px(x + 1, y - 1, MUSH_CAP, sphere(0.6, 0.1));
    c.px(x, y - 2, MUSH_CAP, sphere(0, -0.7));
  }
}

/**
 * The cloak open over her gown: a panel of sage widening to the hem with ferns
 * along its edges, a fern ribbon under the bust, moss speckled lighter, and
 * mushrooms growing at the hem.
 */
function fernTrim(c: PixelCanvas, cx: number, top: number, hem: number, edge: (y: number) => [number, number], p: WraithPose, view: View): void {
  const side = view === 'side';
  // The moss: here and there a tuft a shade lighter.
  for (let y = Math.round(top); y <= hem; y++) {
    const [l, r] = edge(y);
    for (let x = Math.round(l); x < r; x++) if (c.filled(x, y) && hash(x, y) > 0.86) c.shade(x, y, 1);
  }
  if (view !== 'up') {
    for (let y = Math.round(top + 2); y <= hem; y++) {
      const u = (y - top) / (hem - top);
      const [l] = edge(y);
      const a = side ? l + 0.3 : cx - 0.5 - (0.5 + u * 2.3);
      const b = side ? l + 1.3 + u * 1.3 : cx - 0.5 + (0.5 + u * 2.3);
      for (let x = Math.round(a); x < Math.round(b); x++) {
        if (c.filled(x, y)) c.px(x, y, SAGE, sphere(((x + 0.5 - a) / Math.max(1, b - a)) * 1.4 - 0.7, -0.1 + u * 0.4, 1));
      }
      // Fern leaflets along the cloak's open edges, swaying a little.
      if ((y + Math.round(p.flutter)) % 2 === 0) {
        if (!side) c.px(Math.round(a) - 1, y, FERN, sphere(-0.4, 0), { bias: (y >> 1) & 1 });
        c.px(Math.round(b), y, FERN, sphere(0.4, 0), { bias: (y >> 1) & 1 });
      }
    }
  }
  // A ribbon of fern green under the bust.
  const ry = Math.round(top + 3);
  const [rl, rr] = edge(ry);
  for (let x = Math.round(rl); x < rr; x++) if (c.filled(x, ry)) c.px(x, ry, FERN, cyl(((x + 0.5 - rl) / (rr - rl)) * 2 - 1, 0.3), { bias: -1 });
  // Mushrooms at the hem.
  const [hl, hr] = edge(hem);
  if (side) mushroom(c, Math.round(hr - 2), Math.round(hem), true);
  else {
    mushroom(c, Math.round(hl + 1.5), Math.round(hem), true);
    mushroom(c, Math.round(hr - 2), Math.round(hem - 1));
  }
}

/** A long lock of leafy hair, from (x0, y0) to (x1, y1), its leaves catching the light. */
function leafLock(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.part();
  c.capsule(x0, y0, x1, y1, 1.15, 0.8, LEAF_HAIR);
  c.part();
  const n = Math.round(y1 - y0);
  const out = x1 >= x0 ? 1 : -1;
  for (let i = 1; i < n; i += 2) {
    const t = i / n;
    c.px(x0 + (x1 - x0) * t + out * ((i >> 1) & 1 ? 1 : -0.2), y0 + (y1 - y0) * t, LEAF_HAIR, sphere(out * 0.4, -0.4), { bias: 1 });
  }
  c.px(x1, y1 + 1, FERN, sphere(0, 0.4));
}

/** The Firefly's hood: moss, a fern sprig at its point, mushrooms on it, and her face inside, framed in leafy hair. */
function faeHood(c: PixelCanvas, cx: number, cy: number, view: View, p: WraithPose): void {
  const side = view === 'side';
  c.part();
  c.ellipse(cx + (side ? 0.7 : 0), cy, side ? 3.7 : 4.0, 4.0, MOSS, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  const tx = cx + (side ? 3.6 : 1.0 - p.tilt * 2.2);
  const ty = cy - 4.8 + Math.abs(p.tilt) * 0.8;
  c.capsule(cx + (side ? 1.6 : 0.3), cy - 3, tx, ty, 1.6, 0.7, MOSS);
  c.part();
  // A fern sprig at the point, and mushrooms on the hood's side.
  c.px(tx, ty - 1, FERN, sphere(0, -0.5));
  c.px(tx + 1, ty - 2, FERN, sphere(0.3, -0.6), { bias: 1 });
  c.px(tx - 1, ty - 1, FERN, sphere(-0.3, -0.4));
  mushroom(c, Math.round(cx + (side ? 2.6 : -3.2)), Math.round(cy - 1.4), true);
  if (!side) mushroom(c, Math.round(cx - 2), Math.round(cy - 2.6));
  if (view === 'up') return;
  const ox = side ? cx - 1.8 : cx;
  c.part();
  c.ellipse(ox, cy + 0.7, side ? 1.8 : 2.6, 2.8, FAE_SKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7, 1) });
  // Ferns round the hood's opening.
  c.part();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.1 + (i / 8) * Math.PI * 0.8;
    if (side && Math.cos(a) > 0) continue;
    c.px(Math.round(ox - 0.5 - Math.cos(a) * (side ? 2.0 : 3.1)), Math.round(cy + 0.6 - Math.sin(a) * 3.2), FERN, sphere(-Math.cos(a) * 0.5, 0.2), { bias: i & 1 });
  }
  // A fringe of leafy hair swept across her brow.
  c.part();
  const f0 = Math.round(cy - 2);
  c.shape(f0, f0 + 1, (y) => (y === f0 ? [ox - 2.8, ox + 2.8] : side ? [ox - 1.6, ox + 1.8] : [ox - 2.8, ox + 0.4]), LEAF_HAIR, (x, _y, t) => sphere(t * 0.8, -0.4 + (x & 1 ? 0.2 : 0), 1));
  for (const [ex, ey] of eyeSpots(ox, cy, side, p.tilt)) c.px(ex, ey, FAE_EYE);
  c.px(Math.round(ox - (side ? 1.4 : 0.5)), Math.round(cy + 2.4), FAE_LIP, sphere(0, 0.2));
  // Long leafy locks spilling out of the hood over her shoulders.
  if (side) leafLock(c, ox + 1.4, cy + 1, ox + 2, cy + 8);
  else for (const s of [-1, 1]) leafLock(c, ox + s * 2.8, cy + 1, ox + s * 3.3 + p.tilt * 0.3, cy + 8);
}

/** The willow-wicker lantern: a basket woven loose, fireflies glowing through the gaps, a willow leaf on its loop. */
function wickerLantern(c: PixelCanvas, hx: number, hy: number, lx: number, ly: number, p: WraithPose): void {
  c.part();
  c.line(hx, hy, lx, ly + 0.5, WICKER);
  c.px(Math.round(hx + (lx - hx) * 0.5 + 0.5), Math.round(hy + (ly - hy) * 0.5) + 1, FERN, sphere(0.3, 0.4));
  c.part();
  c.ellipse(lx, ly + 2.9, 2.2, 2.5, WICKER, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7, 1) });
  c.part();
  const glow = 0.5 + p.blaze * 0.5;
  for (let y = Math.round(ly + 1.5); y <= ly + 4.4; y++) {
    for (let x = Math.round(lx - 1.6); x <= lx + 1.1; x++) if (((x + y) & 1) === 0 && c.filled(x, y)) c.px(x, y, FIREFLY, { x: 0, y: 0, z: 1 }, { glow });
  }
  c.ellipse(lx, ly + 0.6, 1.6, 0.6, WICKER, { flatten: 0.5 });
  c.px(Math.round(lx - 0.5), Math.round(ly + 5.4), WICKER, sphere(0, 0.6));
  // Fireflies slipping out of the weave, and its soft glow.
  for (let i = 0; i < 3; i++) {
    const a = p.flutter * 1.3 + i * 2.1;
    c.spark(lx + Math.cos(a) * 3.4, ly + 2.2 + Math.sin(a) * 2.6 - i * 0.6, FLY_GLOW, 0.5 + p.blaze * 0.4);
  }
  for (let a = 0; a < 10; a++) {
    const q = (a / 10) * Math.PI * 2;
    c.spark(lx + Math.cos(q) * 3.2, ly + 2.8 + Math.sin(q) * 3.2, FLY_GLOW, 0.08 + p.blaze * 0.15);
  }
}

/** Fireflies drifting round her, each on its own slow loop, some dark between blinks. */
function swarm(c: PixelCanvas, cx: number, top: number, p: WraithPose): void {
  c.part();
  for (let i = 0; i < SWARM; i++) {
    if ((i + Math.round(p.flutter)) % 4 === 0) continue;
    const a = hash(i, 3) * Math.PI * 2 + p.flutter * (0.35 + hash(i, 5) * 0.3);
    const x = Math.round(cx + Math.cos(a) * SWARM_RX * (0.7 + hash(i, 11) * 0.3));
    const y = Math.round(top + 2 + Math.sin(a * 1.3) * SWARM_RY * (0.6 + hash(i, 17) * 0.4) - hash(i, 23) * 4);
    c.px(x, y, FIREFLY, { x: 0, y: 0, z: 1 }, { glow: 0.9 });
    c.spark(x, y, FLY_GLOW, 0.35);
  }
}

// ---------------------------------------------------------------------------
// The Ferryman

/** The Ferryman's robe: a seam down its front and a cord tied at the waist, its ends hanging. */
function ferryTrim(c: PixelCanvas, cx: number, top: number, hem: number, edge: (y: number) => [number, number], view: View): void {
  const side = view === 'side';
  if (!side) for (let y = Math.round(top + 3); y < hem; y++) c.shade(Math.round(cx - 0.5), y, -1);
  const by = Math.round(top + 5);
  const [l, r] = edge(by);
  for (let x = Math.round(l); x < r; x++) if (c.filled(x, by)) c.px(x, by, CORD, cyl(((x + 0.5 - l) / (r - l)) * 2 - 1, -0.2));
  if (view === 'up') return;
  // The knot, and its two ends hanging down the front.
  const kx = side ? Math.round(l + 1) : Math.round(cx - 1.5);
  c.part();
  c.px(kx, by, CORD, sphere(0, -0.5), { bias: 1 });
  for (let i = 1; i <= 3; i++) {
    c.px(kx, by + i, CORD, sphere(-0.3, 0.2));
    if (i < 3 && !side) c.px(kx + 1, by + i + 1, CORD, sphere(0.3, 0.2));
  }
}

/** The Ferryman's hood: deep and pointed, and in its dark a skull, dim, lit only by two cyan eye-lights. */
function ferryHood(c: PixelCanvas, cx: number, cy: number, view: View, p: WraithPose): void {
  const side = view === 'side';
  c.part();
  c.ellipse(cx + (side ? 0.7 : 0), cy, side ? 4.0 : 4.4, 4.3, FERRY_ROBE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.capsule(cx + (side ? 1.8 : 0.3), cy - 3, cx + (side ? 4.6 : 1.4 - p.tilt * 2.2), cy - 6.2 + Math.abs(p.tilt) * 0.8, 1.8, 0.5, FERRY_ROBE);
  if (view === 'up') return;
  c.part();
  const ox = side ? cx - 2 : cx;
  c.ellipse(ox, cy + 0.7, side ? 1.6 : 2.7, 3.0, HOOD_DARK);
  // The skull, set back in the dark: its brow lost in the hood's shadow.
  c.part();
  const sx = ox - (side ? 0.3 : 0);
  c.ellipse(sx, cy + 1.2, side ? 1.3 : 1.9, 2.1, SHADE_SKULL, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 + 0.3, 1) });
  for (let x = Math.floor(sx - 2); x <= sx + 2; x++) c.shade(x, Math.round(cy - 0.6), -1);
  for (const [ex, ey] of eyeSpots(ox, cy, side, p.tilt)) {
    c.px(ex, ey, CYAN_EYE, { x: 0, y: 0, z: 1 }, { glow: 0.75 + p.blaze * 0.25 });
    c.spark(ex, ey, CYAN_GLOW, 0.2 + p.blaze * 0.25);
  }
  c.px(Math.round(sx - 0.5), Math.round(cy + 1.5), HOOD_DARK);
  // The teeth: a row of bone with dark between.
  const ty = Math.round(cy + 2.5);
  for (let x = Math.round(sx - (side ? 1.2 : 1.5)); x <= sx + (side ? 0 : 0.6); x++) c.px(x, ty, (x & 1) === 0 ? SHADE_SKULL : HOOD_DARK, sphere(0, 0.2), { bias: 1 });
  // The hood's lip, catching a little light round the opening.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.12 + (i / 8) * Math.PI * 0.76;
    if (side && Math.cos(a) > 0) continue;
    c.px(Math.round(ox - 0.5 - Math.cos(a) * (side ? 1.8 : 2.9)), Math.round(cy + 0.7 - Math.sin(a) * 3.2), FERRY_ROBE, sphere(-Math.cos(a) * 0.5, -0.5), { bias: 1 });
  }
}

/** The coin for the crossing, hung on a cord round the neck. */
function obol(c: PixelCanvas, hx: number, headY: number, side: boolean): void {
  c.part();
  const cx = side ? hx - 2.6 : hx - 0.5;
  const cy = headY + 7.8;
  if (side) c.line(hx - 1.4, headY + 4, cx, cy - 1, CORD);
  else {
    c.line(hx - 2.2, headY + 4, cx - 0.5, cy - 1, CORD);
    c.line(hx + 1.2, headY + 4, cx + 0.5, cy - 1, CORD);
  }
  c.part();
  c.ellipse(cx, cy + 0.2, side ? 0.7 : 1.15, 1.15, COIN);
  c.spark(cx - 0.5, cy - 0.3, [255, 230, 150], 0.35);
}

/**
 * The punting pole: grey weathered wood from below the hem to above the
 * head, gripped in the bony hand, a shepherd's crook at the top with the
 * lantern hung from it on a short chain, burning teal. It tilts as the
 * lantern is swung, and the lantern lags behind on its chain.
 */
function ferryPole(c: PixelCanvas, hx: number, hy: number, p: WraithPose, view: View): void {
  const o = view === 'side' ? -1 : 1;
  const bx = hx - p.swing * 0.3;
  const by = hy + 9;
  const tx = hx + p.swing * 0.8;
  const ty = hy - 12 - p.lift * 0.6;
  c.part();
  c.line(bx, by, tx, ty, POLE, () => sphere(-0.35, 0, 1));
  c.px(Math.round(bx), Math.round(by), IRON, sphere(0, 0.3));
  // The crook.
  const pts: [number, number][] = [
    [tx, ty],
    [tx + o * 0.8, ty - 1.2],
    [tx + o * 2, ty - 1.7],
    [tx + o * 3.1, ty - 0.9],
    [tx + o * 3.3, ty + 0.2],
  ];
  for (let i = 1; i < pts.length; i++) c.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], POLE, () => sphere(0, -0.6, 1));
  const kx = tx + o * 3.3;
  const ky = ty + 0.6;
  const lx = kx - p.swing * 0.25;
  const ly = ky + 1.6;
  c.line(kx, ky, lx, ly, IRON);
  c.part();
  const glow = 0.5 + p.blaze * 0.5;
  c.shape(Math.round(ly + 1), Math.round(ly + 4), () => [lx - 1.6, lx + 1.6], IRON, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  for (let y = Math.round(ly + 1.5); y <= ly + 3.5; y++) c.px(Math.round(lx - 0.5), y, GHOSTFIRE, { x: 0, y: 0, z: 1 }, { glow, bias: y < ly + 2.5 ? 1 : 0 });
  c.ellipse(lx, ly + 0.6, 2, 0.7, IRON, { flatten: 0.5 });
  c.ellipse(lx, ly + 4.6, 2, 0.6, IRON, { flatten: 0.5 });
  for (let a = 0; a < 10; a++) {
    const q = (a / 10) * Math.PI * 2;
    c.spark(lx + Math.cos(q) * 3.2, ly + 2.6 + Math.sin(q) * 3.2, TEAL_GLOW, 0.1 + p.blaze * 0.18);
  }
  // The bony hand round the pole.
  if (view === 'up') return;
  c.part();
  c.ellipse(hx, hy + 0.3, 0.9, 0.9, BONE);
}

function drawFigure(c: PixelCanvas, p: WraithPose, view: View): void {
  const side = view === 'side';
  const cala = L.calavera;
  const U = -p.bob;
  const stretch = Math.round(p.stretch * 2);
  const tall = L.ferryman ? FERRY_TALL : 0;
  const top = 15 + U - stretch - tall;
  const hem = 26 + U;
  const headY = 10.4 + U - stretch * 0.7 - tall;
  const cx = 12 - (side ? p.lean : 0);
  const hx = side ? cx - 4.5 - p.lean * 0.5 : cx + 5.5;
  const hy = top + 5.5;

  if (cala && view !== 'down') veil(c, cx, headY, view);
  if (view === 'up') lantern(c, cx + 5.5, hy, p, view);
  if (side) {
    c.part();
    sleeve(c, cx + 0.8, top + 1.5, cx + 2.5, top + 6.5);
  }
  c.part();
  robe(c, cx + (side ? p.lean * 0.4 : 0), top, hem, p, view);
  if (L.firefly && view === 'up') leafLock(c, cx + p.tilt, headY + 2, cx + p.tilt + 0.4, top + 8);
  if (cala && view === 'down') {
    c.part();
    for (const s of [-1, 1]) c.capsule(cx + s * 3.6, headY + 1, cx + s * 4.4, top + 2, 0.9, 1.3, LACE_BLACK);
  }
  c.part();
  if (side) sleeve(c, cx - 0.8, top + 1.5, hx, hy);
  else {
    sleeve(c, cx - 3.9, top + 1.5, cx - 5, top + 6.5);
    sleeve(c, cx + 3.9, top + 1.5, hx, hy);
  }
  const headX = cx + p.tilt;
  if (cala) skull(c, headX, headY, view, p);
  else hood(c, headX, headY, view, p);
  if (L.ferryman && view !== 'up') obol(c, headX, headY, side);
  if (p.fade > 0) dissolve(c, cx, headY, hem, p);
  if (view !== 'up') lantern(c, hx, hy, p, view);
  if (L.firefly) swarm(c, cx, top, p);
}

/**
 * The idle moment: the body coming apart into wisps (green soul-flame,
 * marigold petals for the Calavera, fireflies for the Firefly), the bottom going first, until only the
 * eyes hang in the air by the lantern; drawn backwards it gathers again.
 */
function dissolve(c: PixelCanvas, cx: number, headY: number, hem: number, p: WraithPose): void {
  const topY = headY - 7;
  const botY = hem + 4;
  for (let y = Math.floor(topY); y <= botY; y++) {
    const v = (y - topY) / (botY - topY);
    for (let x = cx - 10; x <= cx + 10; x++) {
      if (!c.filled(x, y)) continue;
      if (hash(x, y) + (1 - v) * DISSOLVE_TOP < p.fade * (1 + DISSOLVE_TOP)) c.erase(x, y);
    }
  }
  // The wisps: each flies off its own way from somewhere in the body, more of them the further it has gone.
  c.part();
  const cala = L.calavera;
  for (let i = 0; i < WISPS; i++) {
    const r = hash(i, 91);
    if (r > p.fade * 1.4 || (p.fade > 0.9 && r > 1.15 - p.scatter * 0.5)) continue;
    const ox = cx - 5 + hash(i, 7) * 10;
    const oy = topY + 4 + hash(i, 13) * (hem - topY - 2);
    const a = p.swirl * 0.9 + i;
    const dx = (ox - cx) * 0.8 + Math.sin(a) * 1.5;
    const dy = -3.5 - hash(i, 29) * 4;
    const x = Math.round(ox + dx * p.scatter);
    const y = Math.round(oy + dy * p.scatter);
    // Kept clear of the eyes, so they read alone.
    if (Math.abs(x - cx - p.tilt) < 5 && Math.abs(y - headY) < 4) continue;
    if (cala) {
      c.px(x, y, i % 3 === 0 ? PETAL_PINK : MARIGOLD, { x: 0, y: 0.3, z: 0.9 });
      c.spark(x, y, [255, 200, 90], 0.25);
    } else if (L.firefly) {
      // She comes apart into fireflies.
      c.px(x, y, FIREFLY, { x: 0, y: 0, z: 1 }, { glow: 0.8 });
      c.spark(x, y, FLY_GLOW, 0.3);
    } else {
      const ferry = !!L.ferryman;
      c.px(x, y, ferry ? FERRY_SOUL : SOUL, { x: 0, y: 0, z: 1 }, { glow: 0.55 });
      // A faint tail of mist below each, where it came from (river mist for the Ferryman).
      if (p.scatter > 0.3) c.px(x - Math.round(Math.sin(a)), y + 1, ferry ? RIVER_MIST : MIST, { x: 0, y: 0, z: 1 });
      c.spark(x, y, ferry ? TEAL_GLOW : [110, 255, 190], 0.2);
    }
  }
  // The eyes stay, glowing cold in the air, the last to go and the first back.
  c.part();
  const hx = cx + p.tilt;
  const eyes: [number, number][] = cala
    ? [-1.5, 1.5].map((dx) => [Math.round(hx + dx - 0.5), Math.round(headY + (Math.sign(dx) === Math.sign(p.tilt) ? 1 : 0) + 0.3)])
    : eyeSpots(hx, headY, false, p.tilt);
  const col: RGB = cala ? [255, 210, 110] : L.firefly ? FLY_GLOW : L.ferryman ? CYAN_GLOW : [110, 255, 190];
  for (const [ex, ey] of eyes) {
    c.px(ex, ey, cala ? GOLD_LIGHT : L.firefly ? FIREFLY : L.ferryman ? CYAN_EYE : SOUL, { x: 0, y: 0, z: 1 }, { glow: 1, bias: 2 });
    // With the body gone they burn a little bigger: a soft halo round each.
    c.spark(ex, ey, col, 0.3 + p.fade * 0.5);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(ex + dx, ey + dy, col, p.fade * 0.3);
  }
}

/** A steady 0..1 per pixel, so the same pixels go first in every frame. */
const hash = (x: number, y: number): number => {
  const h = Math.imul(Math.round(x) * 374761393 + Math.round(y) * 668265263, 1274126177) >>> 0;
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000;
};

// ---------------------------------------------------------------------------
// Animations

export type WraithAnim = 'idle' | 'move' | 'swing' | 'possess' | 'cast' | 'rest';

interface AnimDef {
  name: WraithAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => WraithPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const idle = (): WraithPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [0, 1, 1, 0][i];
    p.flutter = i;
    p.swing = [0, 1, 0, -1][i] * 0.6;
    return p;
  });

const move = (view: View): WraithPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.bob = [1, 2, 2, 1][i];
    p.flutter = i + 0.5;
    p.trail = view === 'side' ? 1.5 + (i % 2) : 0;
    p.lean = view === 'side' ? 1 : 0;
    p.swing = view === 'side' ? 1.5 : [1, 0, -1, 0][i];
    return p;
  });

/** The lantern swung: back, up and through in an arc, flaring as it comes round. */
const swing = (view: View): WraithPose[] =>
  [
    [3, 0, 0.4],
    [1.5, 3, 0.8],
    [-2, 2, 1],
    [-3.5, 0, 0.7],
  ].map(([s, l, b], i) => {
    const p = base();
    p.swing = view === 'side' ? -s : s;
    p.lift = l;
    p.blaze = b;
    p.bob = 1;
    p.flutter = i;
    p.lean = view === 'side' && i >= 2 ? 1 : 0;
    return p;
  });

/** Diving into a foe: pitched forward and stretched thin. */
const possess = (view: View): WraithPose[] =>
  [0.3, 0.7, 1, 1].map((k, i) => {
    const p = base();
    p.stretch = k;
    p.lean = view === 'side' ? Math.round(k * 2) : 0;
    p.trail = 3 * k;
    p.blaze = 1;
    p.lift = Math.round(k * 2);
    p.flutter = i;
    return p;
  });

/** Its Special's pose: rising, the lantern lifted high and blazing. */
const cast = (): WraithPose[] =>
  [0.3, 0.6, 1, 1, 1].map((k, i) => {
    const p = base();
    p.bob = Math.round(k * 2);
    p.lift = Math.round(k * 6);
    p.blaze = k;
    p.flutter = i;
    return p;
  });

/**
 * The idle moment, facing the viewer only: the hood tilts one way, then the
 * other, curious, the eyes kindling; then the body comes apart from the hem
 * up into drifting wisps until only the two cold eyes and the lantern hang
 * in the air, and it gathers itself back together, bobbing up as it forms.
 */
const rest = (view: View): WraithPose[] => {
  if (view !== 'down') return [];
  const at = (o: Partial<WraithPose>): WraithPose => ({ ...base(), ...o });
  return [
    at({}),
    at({ tilt: -1, blaze: 0.6, flutter: 1, swing: -0.6 }),
    at({ tilt: -1, blaze: 0.8, flutter: 2, bob: 1, swing: -0.6 }),
    at({ tilt: 1, blaze: 0.8, flutter: 3, bob: 1, swing: 0.6 }),
    at({ blaze: 0.9, fade: 0.3, scatter: 0.25, flutter: 1 }),
    at({ blaze: 1, fade: 0.65, scatter: 0.55, swirl: 1, flutter: 2 }),
    at({ blaze: 1, fade: 1, scatter: 0.85, swirl: 2 }),
    at({ blaze: 1, fade: 1, scatter: 1, swirl: 3, swing: 0.6 }),
    at({ blaze: 1, bob: 1, flutter: 3 }),
    at({ blaze: 0.6, flutter: 2 }),
  ];
};

export const WRAITH_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'move', fps: 8, loop: true, poses: move },
  { name: 'swing', fps: 16, loop: false, poses: swing },
  { name: 'possess', fps: 14, loop: false, poses: possess },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'rest', fps: 7, loop: false, poses: rest, order: [0, 1, 2, 2, 2, 1, 0, 3, 3, 3, 0, 4, 5, 6, 7, 6, 7, 6, 7, 5, 4, 8, 8, 9, 0] },
];

export interface WraithFrame {
  key: string;
  anim: WraithAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: WraithPose): PixelCanvas {
  const c = new PixelCanvas(WRAITH_W, WRAITH_H).offset(BODY_X, BODY_Y);
  drawFigure(c, p, dir === 'left' || dir === 'right' ? 'side' : dir);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildWraithFrames(look: WraithLook = WRAITH_LOOK): WraithFrame[] {
  L = look;
  const out: WraithFrame[] = [];
  for (const a of WRAITH_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = WRAITH_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// The wisps: a soul-flame flickering (frames 0-3), a marigold petal turning, or a firefly blinking.

export const WISP_SIZE = 10;
export const WISP_FRAMES = 4;

export function wispFrame(f: number, petal: boolean, fly = false, ferry = false): PixelCanvas {
  const c = new PixelCanvas(WISP_SIZE, WISP_SIZE);
  if (ferry) {
    // A pale teal soul-flame, tall and thin, a white heart in it, swaying, a breath of river mist under it.
    const lick = [0, 1, 0, -1][f];
    c.px(4 + (f & 1), 9, RIVER_MIST, { x: 0, y: 0, z: 1 });
    c.px(6 - (f & 1), 9, RIVER_MIST, { x: 0, y: 0, z: 1 });
    c.part();
    c.ellipse(5, 6.8, 1.9, 2, FERRY_SOUL);
    c.capsule(5, 6.2, 5 + lick, 1.5, 1.3, 0.3, FERRY_SOUL);
    c.part();
    c.ellipse(5, 6.8, 0.8, 1.1, FERRY_SOUL, { bias: 2 });
    c.spark(5, 6, TEAL_GLOW, 0.5);
    return c;
  }
  if (fly) {
    // A firefly: a dark little body, wings beating, its tail glowing brighter and dimmer.
    c.px(5, 3, FAE_EYE);
    c.px(5, 4, WICKER, sphere(0, -0.3));
    c.part();
    const up = f % 2 === 0;
    c.px(4, up ? 3 : 4, SAGE, sphere(-0.5, -0.5), { glow: 0.3 });
    c.px(6, up ? 3 : 4, SAGE, sphere(0.5, -0.5), { glow: 0.3 });
    c.part();
    const lit = [1, 0.75, 0.45, 0.8][f];
    c.ellipse(5.5, 6.4, 1.2, 1.4, FIREFLY, { glow: lit });
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(5 + dx, 6 + dy, FLY_GLOW, lit * (dx || dy ? 0.35 : 0.8));
    return c;
  }
  if (petal) {
    // A petal turning over: wide, edge-on, and back.
    const w = [2.6, 1.6, 0.8, 1.6][f];
    c.ellipse(5, 5, w, 2.4, MARIGOLD);
    c.part();
    c.px(5, 5, MARIGOLD, { x: 0, y: 0, z: 1 }, { bias: -1 });
    c.spark(5, 2, [255, 220, 120], 0.6);
    return c;
  }
  const lick = [0, 1, 0, -1][f];
  c.ellipse(5, 6.5, 2.4, 2.2, GREEN_FLAME);
  c.capsule(5, 6, 5 + lick, 2, 1.6, 0.4, GREEN_FLAME);
  c.part();
  c.ellipse(5, 6.5, 1, 1, GREEN_FLAME, { bias: 2 });
  return c;
}

// ---------------------------------------------------------------------------
// Icons

const WRAITH_TONES: Tones = [hex('#e0fff4'), hex('#7af0c0'), hex('#2ab888'), hex('#0e4a3a')];
const CALA_TONES: Tones = [hex('#fffbd0'), hex('#ffd860'), hex('#ff9a2a'), hex('#a0400a')];
const FLY_TONES: Tones = [hex('#fbffd8'), hex('#e4ff8a'), hex('#a8e04a'), hex('#2e5a22')];
const FERRY_TONES: Tones = [hex('#e8fffc'), hex('#8af0e4'), hex('#2eb4b0'), hex('#0c3e48')];

/** The Ferryman's swing: the punting pole sweeping, the lantern on its crook at the end of the arc, wisps behind. */
export function ferryLanternIcon(): Uint8ClampedArray {
  const t = FERRY_TONES;
  const wood = hex('#6c5c48');
  const dark = hex('#30271d');
  return icon16((put) => {
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.55 + (i / 10) * 0.5);
      put(9 + Math.cos(a) * 8, 3 + Math.sin(a) * 9, t[3]);
    }
    // The pole, leaning across, and its crook.
    seg(put, 2, 15, 9, 2, wood);
    seg(put, 3, 15, 10, 2, dark);
    seg(put, 9, 1, 11, 0, wood);
    seg(put, 12, 0, 13, 2, wood);
    put(13, 3, hex('#34384a'));
    // The lantern on it, teal fire inside.
    for (let y = 4; y <= 9; y++) {
      for (let x = 11; x <= 15; x++) {
        const rim = x === 11 || x === 15 || y === 4 || y === 9;
        put(x, y, rim ? hex('#545a70') : y < 6 ? t[0] : t[1]);
      }
    }
    for (const [x, y] of [[5, 6], [7, 11], [12, 13]]) {
      put(x, y, t[1]);
      put(x, y - 1, t[2]);
    }
  });
}

/** The lantern's swing: a lantern at the end of its arc, wisps left behind it. */
export function lanternIcon(cala = false, fly = false): Uint8ClampedArray {
  const t = fly ? FLY_TONES : cala ? CALA_TONES : WRAITH_TONES;
  const frame: RGB = fly ? hex('#9a7438') : cala ? hex('#ff62a8') : hex('#545a70');
  return icon16((put) => {
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.1 + (i / 10) * 0.7);
      put(8 + Math.cos(a) * 7, 2 + Math.sin(a) * 7, t[3]);
    }
    seg(put, 8, 1, 11, 6, hex('#34384a'));
    for (let y = 7; y <= 12; y++) {
      for (let x = 9; x <= 13; x++) {
        const rim = x === 9 || x === 13 || y === 7 || y === 12;
        // The Firefly's wicker: woven across, the light showing through every other gap.
        if (fly && !rim) put(x, y, (x + y) % 2 ? frame : y < 10 ? t[0] : t[1]);
        else put(x, y, rim ? frame : y < 9 ? t[0] : t[1]);
      }
    }
    for (const [x, y] of [[3, 7], [2, 11], [5, 13]]) {
      put(x, y, t[1]);
      put(x, y - 1, t[2]);
    }
  });
}

/** Possess: a ghostly figure diving head-first into a dark shape. */
export function possessIcon(cala = false, fly = false, ferry = false): Uint8ClampedArray {
  const t = ferry ? FERRY_TONES : fly ? FLY_TONES : cala ? CALA_TONES : WRAITH_TONES;
  return icon16((put) => {
    // The foe: a dark mound, its eyes lit by the ghost inside.
    for (let y = 8; y <= 15; y++) for (let x = 6; x <= 15; x++) if ((x - 10.5) ** 2 / 20 + (y - 13) ** 2 / 25 <= 1) put(x, y, hex('#2a2e3a'));
    // Its eyes lit by the ghost inside (the Ferryman's foe has a coin laid on each).
    const eye = ferry ? hex('#e0b440') : t[0];
    put(9, 11, eye);
    put(12, 11, eye);
    if (ferry) {
      put(9, 12, hex('#a07420'));
      put(12, 12, hex('#a07420'));
    }
    // The ghost diving in, its trail streaming back.
    seg(put, 1, 1, 8, 8, t[2]);
    seg(put, 2, 1, 9, 8, t[1]);
    seg(put, 1, 2, 8, 9, t[1]);
    put(8, 8, t[0]);
    put(0, 3, t[3]);
    put(3, 0, t[3]);
    if (fly) {
      // Fireflies scattered off the dive.
      for (const [x, y] of [[5, 2], [1, 6], [4, 5], [12, 3]]) put(x, y, t[0]);
    }
  });
}

// ---------------------------------------------------------------------------
// A possessed foe wears a mark over its face: two soul-lights burning in it,
// or (for the Calavera) a little painted sugar skull, or (for the Firefly) a
// wreath of fern with two fireflies for eyes, or (for the Ferryman) a coin
// on each eye. Frames 'w', 'c', 'f' and 'r'.

export const MARK_SIZE = 9;

export function possessMark(cala: boolean, fly = false, ferry = false): PixelCanvas {
  const c = new PixelCanvas(MARK_SIZE, MARK_SIZE);
  if (ferry) {
    // Coins on the eyes, as the dead are laid out for the crossing, the cyan light showing round them.
    for (const ex of [2.5, 6.5]) {
      c.ellipse(ex, 4.5, 1.25, 1.25, COIN);
      c.spark(ex - 0.5, 3.5, [255, 230, 150], 0.4);
      c.spark(ex - 0.5, 6, CYAN_GLOW, 0.6);
    }
    return c;
  }
  if (fly) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.sin(a) > 0.8) continue;
      c.px(4.5 + Math.cos(a) * 3.6, 4.5 + Math.sin(a) * 3.6, FERN, sphere(Math.cos(a) * 0.5, Math.sin(a) * 0.5), { bias: i & 1 });
    }
    c.part();
    for (const ex of [3, 6]) {
      c.px(ex, 4, FIREFLY, { x: 0, y: 0, z: 1 }, { glow: 1 });
      c.spark(ex, 4, FLY_GLOW, 0.7);
    }
    return c;
  }
  if (cala) {
    c.ellipse(4.5, 4.5, 3.6, 3.8, SKULL);
    c.part();
    for (const ex of [3, 6]) {
      c.px(ex, 4, INK);
      c.px(ex - 1, 3, PETAL_PINK);
      c.px(ex + 1, 3, PETAL_TEAL);
    }
    c.px(4, 6, INK);
    c.px(5, 6, INK);
    c.px(4, 7, INK, { x: 0, y: 0, z: 1 }, { bias: 1 });
    return c;
  }
  for (const ex of [3, 6]) {
    c.px(ex, 4, SOUL);
    c.px(ex, 5, SOUL, { x: 0, y: -0.5, z: 0.8 });
    c.spark(ex, 3, [110, 255, 190], 0.6);
  }
  return c;
}

/**
 * The dark of the Dead of Night: black, with a soft round hole of light in
 * the middle (where the lantern is), `size` square. Alpha only.
 */
export function nightHole(size = 128): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const m = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - m, y + 0.5 - m) / m;
      const a = Math.min(1, Math.max(0, (d - 0.16) / 0.3));
      px.set([0, 0, 0, Math.round(a * a * (3 - 2 * a) * 255)], (y * size + x) * 4);
    }
  }
  return px;
}
