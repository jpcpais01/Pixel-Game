// Every class's emblem for the round medallions on the character select: one
// bold object that says the class at a glance (the Mage's hat, the Warrior's
// shield and sword, the Necromancer's skull...), drawn at the heroes' own
// pixel size with the same engine and materials as them, lit from the top
// left and outlined, and shown at 2x like the sprite heads on the cards.
//
// An emblem shares the busts' canvas and disc (art/busts/kit.ts): keep it
// inside the circle of radius R round (C, C). The busts stay in art/busts, and
// SelectScene's MEDAL_ART picks which the wheel shows.

import { PixelCanvas, cyl, hex, sphere, type Material, type RenderedFrame, type Vec3 } from './pixel';
import { BLADE, BONE, CRIMSON, CRYSTAL, FLETCH, GLASS, GOLD, HILT_DARK, KATANA, LEATHER, SABER_BLUE, SILVER, SOUL_EYE, TOXIN, YEW } from './palette';
import { ARCANE_LOOK } from './wizard';
import { LEAF } from './druid';
import { STRING } from './bard';
import { GUNMETAL, HELMET, JOINT, PLATE, VENT } from './mech';
import { BLUSH, MIST, SHEET, VOID } from './poltergeist';
import { BRASS } from './inventor';
import { BUST, C, pair } from './busts/kit';

type EmblemPainter = (c: PixelCanvas) => void;

/** Hollows: eye sockets, the gear's bore. */
const HOLLOW: Material = { ramp: [hex('#0a0810'), hex('#1a1424')], outline: hex('#050408'), noAO: true };
/** The bulb's glass, alight. */
const BULB: Material = {
  ramp: [hex('#c07a18'), hex('#f0b030'), hex('#ffd860'), hex('#fff2a8'), hex('#fffbe8')],
  outline: hex('#3a2006'),
  emissive: 0.6,
  shine: true,
  noAO: true,
};
/** The Nature paw: a warm tawny hide. */
const PAW: Material = {
  ramp: [hex('#3a1e0c'), hex('#6a3a16'), hex('#a0602a'), hex('#d0904a'), hex('#f0bc72')],
  outline: hex('#1a0c04'),
  outlineLit: hex('#2c1608'),
};

/** A flat thing facing us, tipped a little to the light. */
const FACE: Vec3 = { x: -0.25, y: 0.35, z: 0.9 };

// ---- The Mage: a tall pointed hat, its tip bent over, banded and starred in gold.
function mageEmblem(c: PixelCanvas): void {
  const L = ARCANE_LOOK;
  c.shape(
    1,
    12,
    (y) => {
      const u = (y + 0.5 - 1) / 12;
      const hw = 0.6 + 4 * Math.pow(u, 1.15);
      const x = C + 3.2 * Math.pow(1 - u, 2.2);
      return [x - hw, x + hw];
    },
    L.robe,
    (_x, _y, t, u) => cyl(t, 0.45 - u * 0.25),
  );
  c.part();
  c.shape(11, 12, () => [C - 4.4, C + 4.4], L.trim, (_x, _y, t) => cyl(t, 0.1));
  c.part();
  c.px(8, 6, L.trim, FACE, { bias: 1, glow: 0.5 });
  c.px(7, 6, L.trim, FACE, { glow: 0.3 });
  c.px(9, 6, L.trim, FACE, { glow: 0.3 });
  c.px(8, 5, L.trim, FACE, { glow: 0.3 });
  c.px(8, 7, L.trim, FACE, { glow: 0.3 });
  // The brim, a domed disc facing up with its lip to us.
  c.part();
  c.ellipse(C, 13.6, 7.6, 1.9, L.robe, {
    normal: (_x, _y, dx, dy) => {
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
  // Motes of magic about the tip.
  c.part();
  c.px(4, 4, CRYSTAL, FACE);
  c.px(14, 9, CRYSTAL, FACE);
}

// ---- The Warrior: a crimson heater shield rimmed in gold, a sword upright on it.
function warriorEmblem(c: PixelCanvas): void {
  const shield = (inset: number) => (y: number): [number, number] => {
    const hw = (y < 9 ? 5.8 : 5.8 * (1 - Math.pow((y - 9 + 0.5) / 7, 1.5))) - inset;
    return [C - hw, C + hw];
  };
  c.shape(3, 15, shield(0), GOLD, (_x, _y, t, u) => sphere(t * 0.8, u * 0.8 - 0.4));
  c.part();
  c.shape(4, 14, shield(1), CRIMSON, (_x, _y, t, u) => sphere(t * 0.7, u * 0.7 - 0.3));
  // The sword over it: a two-pixel blade with a lit and a shaded edge.
  c.part();
  c.line(8, 1, 8, 10, BLADE, () => sphere(-0.5, 0.3));
  c.line(9, 1, 9, 10, BLADE, () => sphere(0.5, -0.1));
  c.erase(8, 1);
  c.part();
  c.shape(11, 11, () => [C - 4, C + 4], GOLD, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  c.shape(12, 13, () => [C - 1, C + 1], LEATHER, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.shape(14, 15, () => [C - 1, C + 1], GOLD, (_x, _y, t, u) => sphere(t, u - 0.5));
}

// ---- The Jedi: a lightsaber, lit, on the slant.
function jediEmblem(c: PixelCanvas): void {
  const glow = SABER_BLUE.edge.ramp[0];
  // A soft glow about the blade.
  for (let i = 0; i <= 8; i++) {
    c.spark(6 + i, 9 - i, glow, 0.3);
    c.spark(9 + i, 12 - i, glow, 0.3);
  }
  // The blade: blue light three pixels across round a white-hot core.
  c.part();
  c.capsule(7.5, 10.5, 14.8, 3.2, 1.5, 1.5, SABER_BLUE.edge, { bias: -1 });
  c.part();
  c.line(8, 10, 14, 4, SABER_BLUE.core, () => sphere(0, 0));
  // The hilt: silver emitter and pommel, a black grip ridged in between.
  c.part();
  c.capsule(3.5, 14.5, 6.6, 11.4, 1.4, 1.4, SILVER);
  c.part();
  c.line(4, 13, 5, 12, HILT_DARK, () => sphere(0.3, 0));
  c.line(5, 14, 6, 13, HILT_DARK, () => sphere(0.3, 0));
  c.px(3, 15, HILT_DARK, sphere(0, -0.3));
  c.part();
  c.px(6, 10, SILVER, sphere(-0.4, 0.5), { bias: 1 });
  c.px(7, 11, SILVER, sphere(0.4, 0.1));
}

// ---- The Alchemist: a round flask of glowing green brew, corked, bubbling.
function alchemistEmblem(c: PixelCanvas): void {
  c.ellipse(C, 11.2, 5.2, 5, GLASS);
  c.shape(3, 7, () => [C - 1.6, C + 1.6], GLASS, (_x, _y, t) => cyl(t, 0.1));
  // The brew, filling it past the middle.
  c.part();
  c.shape(
    10,
    15,
    (y) => {
      const d = (y + 0.5 - 11.2) / 4.1;
      const hw = 4.3 * Math.sqrt(Math.max(0, 1 - d * d));
      return [C - hw, C + hw];
    },
    TOXIN,
    (_x, _y, t, u) => sphere(t * 0.8, u * 0.6),
  );
  c.px(7, 12, TOXIN, FACE, { bias: 2 });
  c.px(10, 13, TOXIN, FACE, { bias: 2 });
  // The lip and the cork.
  c.part();
  c.shape(2, 2, () => [C - 2.2, C + 2.2], GLASS, (_x, _y, t) => cyl(t, 0.4));
  c.part();
  c.shape(0, 1, () => [C - 1.2, C + 1.2], LEATHER, (_x, _y, t) => cyl(t, 0.5));
  // A glint on the glass, and bubbles rising out of the neck.
  c.part();
  c.px(6, 9, GLASS, sphere(-0.5, 0.6), { bias: 3 });
  c.px(5, 10, GLASS, sphere(-0.5, 0.6), { bias: 2 });
  c.px(13, 3, TOXIN, FACE, { bias: 1 });
  c.px(12, 1, TOXIN, FACE);
}

// ---- The Ranger: a bow drawn, an arrow nocked across it.
function rangerEmblem(c: PixelCanvas): void {
  // The string, from tip to tip.
  c.line(5, 2, 5, 16, STRING, () => FACE);
  // The bow: its limbs bending out to the grip.
  c.part();
  let px = 0;
  let py = 0;
  for (let i = 0; i <= 14; i++) {
    const y = 1.5 + i;
    const x = 5 + 6.6 * Math.sin((Math.PI * i) / 14);
    if (i > 0) c.capsule(px, py, x, y, 0.85, 0.85, YEW);
    px = x;
    py = y;
  }
  c.part();
  c.shape(8, 10, () => [10.6, 12.6], LEATHER, (_x, _y, t) => cyl(t, 0));
  // The arrow, its red fletching at the string and a steel head past the bow.
  c.part();
  c.line(4, 9, 14, 9, YEW, () => cyl(0, 0.5), { bias: 1 });
  c.part();
  c.px(15, 9, BLADE, sphere(0.2, 0.3));
  c.px(14, 8, BLADE, sphere(-0.2, 0.6));
  c.px(14, 10, BLADE, sphere(0.2, -0.4));
  c.px(16, 9, BLADE, sphere(0.6, 0));
  c.part();
  for (const x of [2, 3]) {
    c.px(x, 8, FLETCH, sphere(0, 0.5));
    c.px(x, 10, FLETCH, sphere(0, -0.3));
  }
}

// ---- The Duelist: two katanas crossed, their red-wrapped hilts below.
function katana(c: PixelCanvas, s: -1 | 1): void {
  // Mirrored about the middle: s = 1 runs from a hilt at the bottom left up to the right.
  const X = (x: number) => (s > 0 ? x : BUST - 1 - x);
  // The blade, two pixels: a lit edge and a shaded one.
  c.line(X(6), 10, X(14), 2, KATANA, () => sphere(-0.4 * s, 0.5));
  c.line(X(7), 10, X(14), 3, KATANA, () => sphere(0.4 * s, -0.2), { bias: -1 });
  c.part();
  // The guard, across the blade.
  c.line(X(5), 10, X(7), 12, GOLD, () => sphere(0, 0.4));
  c.part();
  // The red-wrapped grip and a dark pommel.
  c.line(X(4), 13, X(5), 12, CRIMSON, () => cyl(0, 0.4));
  c.px(X(3), 14, HILT_DARK, sphere(0, 0));
}

function duelistEmblem(c: PixelCanvas): void {
  katana(c, -1);
  c.part();
  katana(c, 1);
}

// ---- The Necromancer: a skull, its eyes burning soul-green.
function necromancerEmblem(c: PixelCanvas): void {
  // The cranium, and the jaw narrowing under it.
  c.ellipse(C, 7.2, 5.6, 5.4, BONE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1) });
  c.shape(11, 15, (y) => {
    const hw = [4.8, 4, 3.4, 3.2, 2.8][y - 11];
    return [C - hw, C + hw];
  }, BONE, (_x, _y, t, u) => sphere(t * 0.8, u * 0.7));
  // Sockets, rounded, the green fire in them.
  c.part();
  pair(5, (x, s) => {
    for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2]] as const) c.px(s < 0 ? x + dx : x - dx, 7 + dy, HOLLOW, FACE);
  });
  c.part();
  pair(6, (x) => c.px(x, 8, SOUL_EYE, FACE, { glow: 1 }));
  // The nose, and teeth in a row.
  c.part();
  c.px(8, 11, HOLLOW, FACE);
  c.px(9, 11, HOLLOW, FACE);
  for (const x of [6, 8, 9, 11]) c.px(x, 13, HOLLOW, FACE);
}

// ---- The Mystic: a golden lyre strung in light, leaves twined at its foot.
function mysticEmblem(c: PixelCanvas): void {
  // The arms, bowing out from the foot and curling outward at the horns.
  pair(6, (x, s) => {
    const at = (i: number): [number, number] => [x + 0.5 + s * 2.2 * Math.sin((Math.PI * i) / 11) + s * (i > 9 ? 1.1 * (i - 9) : 0), 14.5 - i];
    for (let i = 0; i < 12; i++) {
      const [x0, y0] = at(i);
      const [x1, y1] = at(i + 1);
      c.capsule(x0, y0, x1, y1, 0.85, 0.85, GOLD);
    }
  });
  // The yoke across the top and the sounding foot.
  c.part();
  c.shape(4, 4, () => [C - 4.4, C + 4.4], GOLD, (_x, _y, t) => cyl(t, 0.4));
  c.part();
  c.shape(14, 15, (y) => (y === 14 ? [C - 3.6, C + 3.6] : [C - 2.8, C + 2.8]), GOLD, (_x, _y, t, u) => sphere(t, 0.3 - u));
  // Strings of light.
  c.part();
  for (const x of [7, 10]) c.line(x, 5, x, 13, STRING, () => FACE, { glow: 0.2 });
  // Leaves twined at the foot, and a gem in the yoke.
  c.part();
  pair(4, (x, s) => c.ellipse(x + 0.5 + s * 0.4, 15.4, 1.6, 1, LEAF, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2) }));
  c.part();
  c.px(8, 4, CRYSTAL, FACE);
  c.px(9, 4, CRYSTAL, FACE);
}

// ---- The Automaton: a golden cog with a red eye glowing at its heart.
function automatonEmblem(c: PixelCanvas): void {
  // Eight teeth placed by hand so they come out even: four square ones on the
  // axes, four on the diagonals, all mirrored about the middle.
  const teeth = new Set<string>();
  const mirror = (x: number, y: number) => {
    for (const [mx, my] of [[x, y], [BUST - 1 - x, y], [x, BUST - 1 - y], [BUST - 1 - x, BUST - 1 - y]]) {
      teeth.add(`${mx},${my}`);
      teeth.add(`${my},${mx}`);
    }
  };
  for (const [x, y] of [[7, 2], [8, 2], [7, 3], [8, 3], [4, 4], [5, 4], [4, 5]]) mirror(x, y);
  for (let y = 0; y < BUST; y++)
    for (let x = 0; x < BUST; x++) {
      const dx = x + 0.5 - C;
      const dy = y + 0.5 - C;
      const tooth = teeth.has(`${x},${y}`);
      if (!tooth && Math.hypot(dx, dy) > 5.1) continue;
      // Domed a little, the teeth a shade deeper than the face.
      c.px(x, y, PLATE, sphere((dx / 7) * 0.8, (dy / 7) * 0.8), { bias: tooth ? -1 : 0 });
    }
  // The bore: a dark ring, then the eye.
  c.part();
  c.ellipse(C, C, 3.2, 3.2, JOINT);
  c.part();
  c.ellipse(C, C, 2.2, 2.2, HELMET, { glow: 0.9 });
  c.px(8, 8, VENT, FACE, { glow: 1, bias: 2 });
  c.px(9, 9, VENT, FACE, { glow: 1, bias: 1 });
  c.px(8, 9, VENT, FACE, { glow: 1, bias: 1 });
  // Rivets round the face.
  c.part();
  for (const [x, y] of [[8, 4], [13, 8], [9, 13], [4, 9]] as const) c.px(x, y, GUNMETAL, sphere(-0.3, 0.5));
}

// ---- The Phantom: a ghost in a sheet, drifting, its tail wisping off.
function phantomEmblem(c: PixelCanvas): void {
  c.ellipse(13.5, 15.5, 1.5, 1.1, MIST);
  c.ellipse(4.5, 15, 1.4, 1, MIST);
  c.part();
  c.shape(
    2,
    15,
    (y) => {
      const d = (y + 0.5 - 8) / 6;
      const hw = y < 8 ? 5.4 * Math.sqrt(Math.max(0, 1 - d * d)) + 0.4 : 5.8 + (y - 8) * 0.12;
      const lean = y > 10 ? (y - 10) * 0.35 : 0;
      return [C - hw + lean, C + hw + lean];
    },
    SHEET,
    (_x, _y, t, u) => sphere(t * 0.9, u * 1.5 - 0.6),
  );
  // A ragged hem.
  for (const [x, y] of [[4, 15], [8, 15], [11, 14], [12, 15]] as const) c.erase(x, y);
  // Little arms, raised.
  c.part();
  c.ellipse(3, 10, 1.4, 1.1, SHEET);
  c.ellipse(15, 9.5, 1.3, 1.1, SHEET);
  // Big dark eyes with a glint, blushing cheeks, an open mouth.
  c.part();
  pair(6, (x, s) => {
    c.px(x, 7, VOID);
    c.px(x + s * -1, 7, VOID);
    c.px(x, 8, VOID);
    c.px(x + s * -1, 8, VOID);
  });
  pair(6, (x) => c.px(x, 7, SHEET, sphere(-0.4, 0.6), { bias: 4, glow: 0.6 }));
  pair(5, (x) => c.px(x, 9, BLUSH));
  c.px(8, 10, VOID);
  c.px(9, 10, VOID);
  c.px(8, 11, VOID);
  c.px(9, 11, VOID);
}

// ---- The Inventor: a light bulb, lit: the bright idea.
function inventorEmblem(c: PixelCanvas): void {
  // Its light about it.
  for (const [x, y, a] of [[2, 6, 0.5], [16, 6, 0.5], [3, 2, 0.35], [15, 2, 0.35], [9, 0, 0.45]] as const) c.spark(x, y, hex('#ffd860'), a);
  c.ellipse(C, 6.8, 5, 5, BULB);
  c.shape(10, 11, (y) => (y === 10 ? [C - 3, C + 3] : [C - 2.2, C + 2.2]), BULB, (_x, _y, t, u) => sphere(t, 0.2 - u));
  // The filament glowing white inside.
  c.part();
  c.line(7, 9, 7, 7, BRASS, () => FACE);
  c.line(10, 9, 10, 7, BRASS, () => FACE);
  c.line(7, 6, 10, 6, BULB, () => FACE, { bias: 3, glow: 1 });
  // A glint on the glass.
  c.part();
  c.px(6, 4, BULB, sphere(-0.5, 0.6), { bias: 4 });
  c.px(5, 5, BULB, sphere(-0.5, 0.6), { bias: 3 });
  // The brass screw, threaded, and its contact.
  c.part();
  c.shape(12, 15, () => [C - 2.4, C + 2.4], BRASS, (_x, _y, t) => cyl(t, 0.2));
  for (let x = 7; x <= 10; x++) c.shade(x, 13, -1);
  for (let x = 7; x <= 10; x++) c.shade(x, 15, -1);
  c.part();
  c.shape(16, 16, () => [C - 1, C + 1], HILT_DARK, (_x, _y, t) => cyl(t, 0));
}

// ---- Nature: a great paw print, clawed.
function natureEmblem(c: PixelCanvas): void {
  // Claws first, so the toes sit over their roots.
  for (const [x, y] of [[3, 4], [6, 1], [11, 1], [14, 4]] as const) c.px(x, y, BONE, sphere(0, 0.6));
  c.part();
  c.ellipse(C, 12.2, 4.2, 3.4, PAW, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1) });
  c.shape(10, 11, (y) => (y === 10 ? [C - 1.6, C + 1.6] : [C - 3, C + 3]), PAW, (_x, _y, t, u) => sphere(t * 0.8, u - 0.6));
  c.part();
  for (const [x, y, rx, ry] of [[4, 7, 1.6, 1.9], [7, 4.4, 1.6, 2], [11, 4.4, 1.6, 2], [14, 7, 1.6, 1.9]] as const)
    c.ellipse(x, y, rx, ry, PAW, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.1) });
}

const EMBLEMS: Record<string, EmblemPainter> = {
  mage: mageEmblem,
  warrior: warriorEmblem,
  jedi: jediEmblem,
  alchemist: alchemistEmblem,
  archer: rangerEmblem,
  duelist: duelistEmblem,
  necromancer: necromancerEmblem,
  mystic: mysticEmblem,
  automaton: automatonEmblem,
  phantom: phantomEmblem,
  inventor: inventorEmblem,
  beast: natureEmblem,
};

const done = new Map<string, RenderedFrame>();

/** A class's emblem, lit and outlined, on the busts' canvas; null for a class that has none. */
export function classEmblem(id: string): RenderedFrame | null {
  const paint = EMBLEMS[id];
  if (!paint) return null;
  let r = done.get(id);
  if (!r) {
    const c = new PixelCanvas(BUST, BUST);
    paint(c);
    r = c.render();
    done.set(id, r);
  }
  return r;
}
