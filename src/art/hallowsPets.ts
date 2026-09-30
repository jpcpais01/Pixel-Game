// Hallow's Eve's two companions, sold for candy at Old Wick's stall (see
// game/season.ts): the Pumpling, a little jack-o'-lantern hopping on vine
// feet with a candle burning behind its carved face, and the Hexcat, a black
// cat in a witch's hat whose eyes and tail-tip glow with violet hexes. Drawn
// like the other companions (see pets.ts): 24x24, four looping frames,
// facing right, feet at (PET_OX, PET_OY).

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const W = 24;
const H = 24;
const OX = 12;
const OY = 22;

// ---------------------------------------------------------------- The Pumpling

const PUMPKIN: Material = { ramp: ramp('#4a1804', '#7a2e08', '#b2520e', '#e07a1e', '#ffa63e', '#ffd07a'), outline: hex('#240a02'), outlineLit: hex('#3a1204'), shine: true };
const STEM: Material = { ramp: ramp('#1e2a0e', '#34481a', '#56702a', '#809a44'), outline: hex('#0c1204') };
const LEAF: Material = { ramp: ramp('#1c3a12', '#2e5a1c', '#4a8a2a', '#78b84a'), outline: hex('#0a1806') };
const VINE: Material = { ramp: ramp('#1a2a0c', '#2e4816', '#4a6e24'), outline: hex('#0a1204') };
/** The candle's light through the carving: pure glow, brightest at its heart. */
const CANDLE: Material = { ramp: ramp('#ff8a1a', '#ffc040', '#fff0a8'), outline: hex('#3a1004'), emissive: 1, noAO: true, noOutline: true };
/** The cut wall of the carving, lit from inside. */
const CUT: Material = { ramp: ramp('#8a3208', '#d0661a'), outline: hex('#3a1004'), emissive: 0.45, noAO: true, noOutline: true };
const FLAME_CORE = hex('#fff4c8');
const FLAME_HOT = hex('#ffb040');

function pumpling(f: number): PixelCanvas {
  const c = new PixelCanvas(W, H);
  // It breathes by squashing, and its candle gutters from frame to frame.
  const sq = [0, 0.45, 0.8, 0.35][f];
  const flicker = [0.9, 1, 0.8, 0.95][f];
  const rx = 6.6 + sq * 0.5;
  const ry = 5.3 - sq * 0.45;
  const cx = OX;
  const cy = OY - ry - 0.6;

  // Two curling vine feet peeking out beneath it.
  c.part();
  c.capsule(cx - 3.5, cy + ry - 1.5, cx - 4.8, OY, 0.9, 0.7, VINE, { bias: -1 });
  c.capsule(cx + 3.2, cy + ry - 1.5, cx + 4.3, OY, 0.9, 0.7, VINE);
  c.px(cx - 6, OY, VINE, cyl(-0.4, 0));
  c.px(cx + 5, OY, VINE, cyl(0.4, 0));

  // The pumpkin: a squat, ribbed ball.
  c.part();
  c.ellipse(cx, cy, rx, ry, PUMPKIN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.85 - 0.12, 1) });
  // Its ribs: grooves curving from crown to base, turned a little toward its face on the right.
  for (const u of [-0.72, -0.3, 0.14, 0.56, 0.88]) {
    for (let y = Math.ceil(cy - ry) + 1; y <= Math.floor(cy + ry) - 1; y++) {
      const k = (y + 0.5 - cy) / ry;
      const x = cx + u * rx * Math.sqrt(Math.max(0, 1 - k * k));
      c.shade(x, y, -1);
    }
  }
  // Soft shine on its crown, where the light falls.
  c.shade(cx - 3, cy - ry + 1.5, 1);
  c.shade(cx - 2, cy - ry + 1, 1);

  // The stem, curled, and a leaf beside it.
  c.part();
  c.capsule(cx + 0.2, cy - ry + 1, cx + 1, cy - ry - 2.2, 1.1, 0.75, STEM);
  c.px(cx + 2, cy - ry - 3, STEM, cyl(0.5, 0.4), { bias: 1 });
  c.part();
  c.ellipse(cx - 2.4, cy - ry - 0.4, 2, 1, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.7 - 0.2, dy * 0.7 + 0.3, 1) });
  c.px(cx - 4.2, cy - ry - 0.6, LEAF, cyl(-0.6, 0.3));

  // The carved face, turned a touch to the right: two triangle eyes and a jagged grin.
  c.part();
  const fx = cx + 1.2;
  const ey = Math.round(cy - 2);
  const g = { glow: flicker };
  const eye = (x: number, blink: boolean) => {
    if (blink) {
      c.px(x, ey + 1, CANDLE, undefined, g);
      c.px(x + 1, ey + 1, CANDLE, undefined, g);
      return;
    }
    c.px(x, ey, CANDLE, undefined, g);
    c.px(x + 1, ey, CANDLE, undefined, g);
    c.px(x + 1, ey + 1, CANDLE, undefined, g);
    c.px(x, ey + 1, CUT);
  };
  eye(Math.round(fx - 3), f === 3);
  eye(Math.round(fx + 1), f === 3);
  const my = Math.round(cy + 1.4);
  for (let x = Math.round(fx - 3); x <= Math.round(fx + 3); x++) {
    // Teeth: the pumpkin left standing in the top row, and a gap in the bottom one.
    const tooth = x === Math.round(fx - 1) || x === Math.round(fx + 2);
    if (!tooth) c.px(x, my, CANDLE, undefined, g);
    if (x > Math.round(fx - 3) && x < Math.round(fx + 3) && x !== Math.round(fx)) c.px(x, my + 1, CANDLE, undefined, g);
  }
  c.px(Math.round(fx - 4), my - 1, CUT);
  c.px(Math.round(fx + 4), my - 1, CUT);
  // The candle's light spilling out of the carving.
  c.spark(fx - 2, ey, FLAME_HOT, 0.35 * flicker);
  c.spark(fx + 1.5, ey, FLAME_HOT, 0.35 * flicker);
  c.spark(fx, my, FLAME_CORE, 0.45 * flicker);
  return c;
}

// ---------------------------------------------------------------- The Hexcat

const CAT: Material = { ramp: ramp('#07060d', '#110f1c', '#1c1830', '#2c2648', '#443a6c', '#6a5c9a'), outline: hex('#020104'), outlineLit: hex('#0a0814'), shine: true };
const CAT_EYE: Material = { ramp: ramp('#8ae03a', '#d8ff6a', '#faffd0'), outline: hex('#101a04'), emissive: 0.95, noAO: true, noOutline: true };
const NOSE: Material = { ramp: ramp('#6a3a58', '#a86088'), outline: hex('#1a0a14'), noAO: true };
const HAT: Material = { ramp: ramp('#0e0a1c', '#1c1434', '#2e2254', '#46367a'), outline: hex('#05030a'), outlineLit: hex('#120c22') };
const BAND: Material = { ramp: ramp('#5a2a9a', '#8a4ad8', '#c08aff'), outline: hex('#1a0a30'), emissive: 0.35 };
const BUCKLE: Material = { ramp: ramp('#a87a20', '#f0c850', '#fff0a0'), outline: hex('#2a1a04'), shine: true, noAO: true };
const HEX_HOT = hex('#e0b0ff');
const HEX_MID = hex('#a060ff');
const HEX_DEEP = hex('#6a2ad8');

function hexcat(f: number): PixelCanvas {
  const c = new PixelCanvas(W, H);
  // A padding walk: legs in diagonal pairs, the body bobbing, the tail swaying.
  const stride = [1, 0, -1, 0][f];
  const bob = [0, -0.5, 0, -0.5][f];
  const sway = [0, 0.8, 0, -0.8][f];
  const by = 15.5 + bob;

  // The tail, curling up behind it, a violet hex smouldering at its tip.
  c.part();
  c.capsule(7.5, by - 0.5, 4.5 + sway * 0.4, by - 4.5, 1.2, 1, CAT, { bias: -1 });
  c.capsule(4.5 + sway * 0.4, by - 4.5, 5 + sway, by - 8.5, 1, 0.8, CAT, { bias: -1 });
  c.capsule(5 + sway, by - 8.5, 6.8 + sway, by - 10, 0.8, 0.6, CAT);
  c.spark(7 + sway, by - 10.5, HEX_HOT, 0.8);
  c.spark(6.5 + sway, by - 11.5, HEX_MID, 0.6);
  c.spark(7.5 + sway, by - 13 + (f % 2), HEX_DEEP, 0.45);

  // Far legs, behind the body.
  c.part();
  c.capsule(9 - stride, by + 1, 9 - stride * 1.6, OY, 0.9, 0.8, CAT, { bias: -1 });
  c.capsule(14.5 + stride, by + 1, 14.5 + stride * 1.6, OY, 0.9, 0.8, CAT, { bias: -1 });

  // The body: long and low, the back arched a little.
  c.part();
  c.capsule(8.5, by - 0.2, 14, by - 0.6, 3.1, 2.8, CAT);
  c.shade(10, by - 3, 1);
  c.shade(11, by - 3, 1);

  // Near legs.
  c.part();
  c.capsule(10 + stride, by + 1.5, 10 + stride * 1.6, OY, 0.95, 0.85, CAT);
  c.capsule(15 - stride, by + 1, 15.5 - stride * 1.6, OY, 0.95, 0.85, CAT);

  // Head, turned to face right, with its ears pricked.
  c.part();
  const hx = 16.8;
  const hy = by - 5 + bob * 0.5;
  c.ellipse(hx, hy, 3.6, 3, CAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  c.part();
  c.capsule(hx + 2.6, hy + 1, hx + 3.8, hy + 1.3, 1.2, 0.8, CAT);
  c.part();
  c.capsule(hx - 1.8, hy - 1.8, hx - 2.4, hy - 4.6, 1, 0.3, CAT, { bias: -1 });
  c.capsule(hx + 1.2, hy - 2, hx + 1.8, hy - 4.8, 1, 0.3, CAT);
  // A little violet collar with a gold charm.
  c.part();
  c.line(hx - 2.5, hy + 2.6, hx + 1.5, hy + 3, BAND, () => cyl(0, 0.1));
  c.px(hx + 0.5, hy + 3.8, BUCKLE, sphere(-0.3, 0.3));

  // A tiny witch's hat, tipped over the far ear, its point flopping back.
  c.part();
  c.ellipse(hx - 0.8, hy - 2.8, 3.2, 0.9, HAT, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5, 0.6 - dy * 0.3, 0.8) });
  c.part();
  c.capsule(hx - 0.6, hy - 3.4, hx - 1.4, hy - 6.4, 1.7, 1, HAT);
  c.capsule(hx - 1.4, hy - 6.4, hx - 3.6 - sway * 0.3, hy - 8, 1, 0.45, HAT);
  c.part();
  c.shape(Math.round(hy - 4), Math.round(hy - 4), () => [hx - 2.2, hx + 1], BAND, (_x, _y, t) => cyl(t, 0.1));
  c.px(hx - 0.5, hy - 4, BUCKLE, sphere(-0.2, 0.2));

  // Glowing eyes (half-shut on the blink), and a small nose.
  c.part();
  const ey = Math.round(hy - 0.5);
  if (f === 2) {
    c.px(hx + 0.5, ey + 1, CAT_EYE, undefined, { glow: 0.5 });
    c.px(hx + 2.8, ey + 1, CAT_EYE, undefined, { glow: 0.5 });
  } else {
    c.px(hx + 0.5, ey, CAT_EYE);
    c.px(hx + 0.5, ey + 1, CAT_EYE, undefined, { glow: 0.7 });
    c.px(hx + 2.8, ey, CAT_EYE);
    c.px(hx + 2.8, ey + 1, CAT_EYE, undefined, { glow: 0.7 });
    c.spark(hx + 0.5, ey, hex('#eaff9a'), 0.35);
    c.spark(hx + 2.8, ey, hex('#eaff9a'), 0.35);
  }
  c.px(hx + 4.4, hy + 0.6, NOSE, sphere(0.3, 0.2));
  // Whiskers catch a glint of the hex-light.
  c.spark(hx + 5.2, hy + 1.2, HEX_HOT, 0.25);
  c.spark(hx + 5.2, hy + 2.2, HEX_HOT, 0.2);
  return c;
}

/** Hallow's Eve's companions, by id: folded into PET_ART. */
export const HALLOWS_PET_ART: Record<string, (f: number) => PixelCanvas> = { pumpling, hexcat };
