// Materials, the helm and the buttons for the Dragonslayer, the Knight's
// legendary skin. The figure itself is drawn by the warrior's rig
// (warrior.ts), switched by its `dragon` flag: plate blackened in dragonfire
// with molten red still glowing in its seams and edges, a closed great helm
// crowned by a horned dragon's skull, a cloak of dark red dragon scales, bone
// teeth rising from the pauldrons, and a huge jagged blade whose edge still
// burns.

import { cyl, hex, sphere, type Material, type PixelCanvas, type RGB } from './pixel';
import { icon16, seg } from './druid';
import { whirlIcon } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

const CHAR_INK = hex('#050304');

// ---------------------------------------------------------------------------
// Materials

/** Plate blackened in dragonfire: near black, a warm bronze-red sheen where the light finds it. */
export const DRAGON_IRON: Material = {
  ramp: ramp('#141012', '#2a2024', '#443536', '#6c5450', '#ac8a72'),
  outline: CHAR_INK,
  outlineLit: hex('#1a0e0e'),
  shine: true,
};

/** The mail under it, a skirt of small black scales. */
export const DRAGON_MAIL: Material = {
  ramp: ramp('#100c0e', '#221a1c', '#382c2c', '#54443e'),
  outline: CHAR_INK,
};

/** The cloak: a dragon's hide, dark red scales going to black in the folds. */
export const DRAGON_HIDE: Material = {
  ramp: ramp('#170406', '#2e080c', '#4c0f12', '#741a18', '#9e2e22'),
  outline: hex('#070102'),
  outlineLit: hex('#220608'),
};

/** Molten red: the edges and seams of the plate, still glowing from the fire. */
export const MOLTEN: Material = {
  ramp: ramp('#5a0c06', '#a01e0a', '#e04812', '#ff8a2a', '#ffd070'),
  outline: hex('#1a0302'),
  outlineLit: hex('#2e0704'),
  emissive: 0.45,
  noAO: true,
};

/** The skull and the teeth: old bone, smoked yellow. */
export const DRAGON_BONE: Material = {
  ramp: ramp('#3a2e22', '#6a5a42', '#a08c68', '#d2c29a', '#f2e8c8'),
  outline: hex('#140e08'),
  outlineLit: hex('#241a10'),
};

/** The horns, darkening to charred black at their points. */
export const DRAGON_HORN: Material = {
  ramp: ramp('#120c0a', '#2a1e18', '#4a3628', '#6e5640', '#968060'),
  outline: hex('#060403'),
  outlineLit: hex('#140c08'),
};

/** The jagged blade: dark, smoke-stained steel. */
export const DRAGON_BLADE: Material = {
  ramp: ramp('#14100f', '#29201e', '#43383a', '#6a5e62', '#a89ca0'),
  outline: hex('#070505'),
  outlineLit: hex('#171112'),
  shine: true,
  noAO: true,
};

/** Its edge, still hot from the dragon it was quenched in. */
export const EMBER_EDGE: Material = {
  ramp: ramp('#7a1206', '#c02a0a', '#f05a14', '#ffa040'),
  outline: hex('#2a0502'),
  emissive: 0.8,
  noAO: true,
};

/** The pommel's stone: a dragon's eye, a coal of red. */
export const DRAGON_EYE: Material = {
  ramp: ramp('#3a0402', '#8a0e06', '#e0300c', '#ffa050'),
  outline: hex('#140101'),
  emissive: 0.6,
  shine: true,
  noAO: true,
};

/** The fire seen through the slit and in the skull's sockets. */
const FIRE: Material = {
  ramp: ramp('#c02a0a', '#ff6a1a', '#ffb048', '#ffe8a0'),
  outline: hex('#2a0502'),
  emissive: 1,
  noAO: true,
};

/** The dark of the visor's slit and the skull's sockets. */
const HOLLOW: Material = { ramp: [hex('#080304'), hex('#120607')], outline: CHAR_INK, noAO: true };

/** The light of the embers (light-only colours). */
export const DRAGON_GLOW = { core: hex('#fff0d0'), hot: hex('#ffa040'), mid: hex('#ff4a14') };
/** Ash: grey flakes among the embers. */
const ASH_GREY = hex('#8a7a78');

// ---------------------------------------------------------------------------
// Scales, cracks and teeth

/**
 * Lay rows of overlapping scales over whatever of `m` was drawn in the box:
 * each scale is four pixels wide and two tall, rows staggered by half a
 * scale; its lower rim is shaded and its crown catches the light.
 */
export function scales(c: PixelCanvas, m: Material, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const off = (Math.floor(y / 2) & 1) * 2;
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (c.materialAt(x, y) !== m) continue;
      const k = (((x + off) % 4) + 4) % 4;
      if (y & 1) {
        if (k === 0 || k === 3) c.shade(x, y, -1);
      } else if (k === 1) c.shade(x, y, 1);
    }
  }
}

/**
 * Cracks in the breastplate where the molten heat still shows through: thin
 * seams of a darker pixel each with an ember in it. `pts` are body pixels.
 */
export function moltenSeams(c: PixelCanvas, pts: [number, number][], plate: Material): void {
  for (const [x, y] of pts) {
    if (c.materialAt(x, y) !== plate) continue;
    c.px(x, y, MOLTEN, { x: 0, y: 0.1, z: 0.99 }, { bias: -2, glow: 0.35 });
  }
}

/** A dragon's tooth rising off a pauldron, curving out toward side `k` (-1 left, 1 right). */
export function pauldronTooth(c: PixelCanvas, x: number, y: number, k: number): void {
  c.part();
  c.capsule(x + k * 0.2, y - 0.8, x + k * 1.3, y - 2.6, 0.85, 0.45, DRAGON_BONE, { bias: 1 });
  c.px(x + k * 1.6, y - 3.4, DRAGON_BONE, sphere(k * 0.5, 0.6), { bias: 1 });
}

// ---------------------------------------------------------------------------
// The helm: a closed great helm under a horned dragon's skull

/** One horn sweeping up and out from a skull's temple, then curling in at the point. */
function horn(c: PixelCanvas, x: number, y: number, k: number, back = 0): void {
  c.part();
  c.capsule(x, y, x + k * 2.2 + back, y - 2.2, 0.95, 0.75, DRAGON_HORN, { bias: 1 });
  c.capsule(x + k * 2.2 + back, y - 2.2, x + k * 2.9 + back * 1.4, y - 4.8, 0.75, 0.5, DRAGON_HORN, { bias: 1 });
  c.capsule(x + k * 2.9 + back * 1.4, y - 4.8, x + k * 2.2 + back * 1.8, y - 6.6, 0.5, 0.3, DRAGON_HORN, { bias: 0 });
}

/** The great helm's bowl, rows 5..14, centred on cx: rounder above, squarer at the jaw. */
function greatHelm(c: PixelCanvas, cx: number, U: number, plate: Material, back = 0): void {
  c.part();
  c.shape(5 + U, 14 + U, (y) => {
    const u = (y + 0.5 - 5 - U) / 10;
    const hw = u < 0.45 ? 1.8 + 2.9 * Math.sqrt(u / 0.45) : 4.7 - Math.max(0, u - 0.8) * 2.6;
    return [cx - hw, cx + hw + back * u];
  }, plate, (_x, _y, t, u) => sphere(t * 0.95, u * 1.3 - 0.7, 1));
}

/** Embers in a slit or a socket: hot in the middle, dimmer at its ends. */
function glowAt(c: PixelCanvas, x: number, y: number, a: number): void {
  if (a > 0.6) c.px(x, y, FIRE, { x: 0, y: 0.3, z: 0.95 });
  else c.px(x, y, HOLLOW, { x: 0, y: 0, z: 1 });
  c.spark(x, y, a > 0.6 ? DRAGON_GLOW.hot : DRAGON_GLOW.mid, a);
}

/** The helm from the front: horns, bowl, molten brow and nasal, the burning slit, then the skull's face over the brow. */
export function dragonHelmFront(c: PixelCanvas, cx: number, U: number, plate: Material): void {
  horn(c, cx - 3.4, 6.6 + U, -1);
  horn(c, cx + 3.4, 6.6 + U, 1);
  greatHelm(c, cx, U, plate);
  // A brighter brow over the slit, and the helm's lower edge in shadow.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 4.6, cx + 4.6], plate, (_x, _y, t) => cyl(t, 0.5), { bias: 1 });
  c.shape(14 + U, 14 + U, () => [cx - 3.9, cx + 3.9], plate, (_x, _y, t) => cyl(t, -0.3), { bias: -1 });
  // The eye slit, two eyes burning in it.
  c.part();
  for (let x = cx - 4; x <= cx + 3; x++) {
    if (x === cx - 1) continue;
    glowAt(c, x, 11 + U, x === cx - 3 || x === cx + 1 ? 0.9 : 0.35);
  }
  // Breathing holes down the right cheek.
  for (const [x, y] of [[cx + 1, 13], [cx + 3, 13]]) c.shade(x, y + U, -2);
  // The skull over the top of the helm: its brow ridge, sockets and snout
  // hanging down over the forehead, fangs over the molten band.
  c.part();
  // Brow ridges flaring over the sockets, the cranium between them.
  c.shape(2 + U, 5 + U, (y) => {
    const hw = [1.6, 2.7, 3.4, 2.9][y - 2 - U];
    return [cx - hw, cx + hw];
  }, DRAGON_BONE, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.6, 1));
  // The snout, narrowing down over the brow.
  c.shape(6 + U, 8 + U, (y) => {
    const hw = [1.9, 1.5, 1.1][y - 6 - U];
    return [cx - hw, cx + hw];
  }, DRAGON_BONE, (_x, _y, t, u) => sphere(t * 0.8, u * 0.7 - 0.1, 1));
  // Deep sockets with a coal in each, under a lit ridge.
  for (const x of [cx - 3, cx + 2]) {
    glowAt(c, x, 5 + U, 0.8);
    c.shade(x, 4 + U, 1);
  }
  // Nostrils, and the ridge of the snout.
  c.shade(cx - 2, 8 + U, -2);
  c.shade(cx + 1, 8 + U, -2);
  for (let y = 3; y <= 7; y++) c.shade(cx - 1, y + U, 1);
  // Fangs hanging from the upper jaw either side, over the brow.
  c.part();
  for (const x of [cx - 3, cx + 2]) {
    c.px(x, 8 + U, DRAGON_BONE, { x: 0, y: -0.3, z: 0.95 }, { bias: 1 });
    c.px(x, 9 + U, DRAGON_BONE, { x: 0, y: -0.5, z: 0.85 });
  }
}

/** From behind: the bowl with a molten ridge down its back, the back of the skull and both horns. */
export function dragonHelmBack(c: PixelCanvas, cx: number, U: number, plate: Material): void {
  horn(c, cx - 3.4, 6.6 + U, -1);
  horn(c, cx + 3.4, 6.6 + U, 1);
  greatHelm(c, cx, U, plate);
  c.part();
  for (let y = 8; y <= 13; y++) c.shade(cx - 1, y + U, 1);
  c.shape(14 + U, 14 + U, () => [cx - 3.9, cx + 3.9], plate, (_x, _y, t) => cyl(t, -0.3), { bias: -1 });
  // The back of the skull, ridged where its spine began.
  c.part();
  c.shape(2 + U, 6 + U, (y) => {
    const hw = [2.0, 3.1, 3.6, 3.4, 2.6][y - 2 - U];
    return [cx - hw, cx + hw];
  }, DRAGON_BONE, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.5, 1));
  for (let y = 3; y <= 6; y++) c.shade(cx - 1, y + U, y & 1 ? -1 : 1);
}

/** In profile, facing left: the skull's long snout reaching over the brow, horns sweeping back. */
export function dragonHelmSide(c: PixelCanvas, hx: number, U: number, plate: Material): void {
  // The far horn, a little higher and darker, then the near one.
  horn(c, hx + 1.4, 5.6 + U, 1, 0.6);
  greatHelm(c, hx - 0.8, U, plate, 0.6);
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 5.6, hx + 1.0], plate, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.5), { bias: 1 });
  c.shape(14 + U, 14 + U, () => [hx - 4.4, hx + 3.6], plate, (_x, _y, t) => cyl(t * 0.9 - 0.1, -0.3), { bias: -1 });
  // The slit, toward the front of the face.
  c.part();
  for (let x = hx - 5; x <= hx - 2; x++) glowAt(c, x, 11 + U, x === hx - 4 ? 0.9 : 0.35);
  c.shade(hx - 4, 13 + U, -2);
  c.shade(hx - 3, 14 + U, -2);
  // The skull: cranium over the top of the helm, the snout running forward
  // and down past the brow, a fang at its tip.
  c.part();
  // Cranium over the back of the helm, then the long snout reaching out past the brow.
  c.shape(2 + U, 5 + U, (y) => {
    const [l, r] = ([[-1.0, 2.2], [-2.4, 3.2], [-3.4, 3.4], [-3.6, 2.6]] as const)[y - 2 - U];
    return [hx + l, hx + r];
  }, DRAGON_BONE, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, u * 0.9 - 0.6, 1));
  c.shape(5 + U, 7 + U, (y) => {
    const [l, r] = ([[-6.4, -2.0], [-7.6, -1.6], [-7.4, -3.4]] as const)[y - 5 - U];
    return [hx + l, hx + r];
  }, DRAGON_BONE, (_x, _y, t, u) => sphere(t * 0.7 - 0.3, u * 0.9 - 0.4, 1));
  glowAt(c, hx - 2, 4 + U, 0.8);
  c.shade(hx - 2, 3 + U, 1);
  c.shade(hx - 7, 6 + U, -2);
  for (let x = hx - 6; x <= hx - 3; x++) c.shade(x, 5 + U, 1);
  // The jaw's fangs over the brow.
  c.part();
  c.px(hx - 7, 8 + U, DRAGON_BONE, { x: -0.3, y: -0.4, z: 0.85 }, { bias: 1 });
  c.px(hx - 5, 8 + U, DRAGON_BONE, { x: -0.3, y: -0.4, z: 0.85 });
  horn(c, hx + 2.4, 6.6 + U, 1, 0.9);
}

// ---------------------------------------------------------------------------
// Buttons (drawn additively: black is empty)

/** The attack button: the jagged black blade, its edge burning, on a bone guard with a dragon's-eye pommel. */
export function dragonSwordIcon(): Uint8ClampedArray {
  const steel = hex('#8a7c80');
  const steelLit = hex('#c8bcc0');
  const edge = hex('#ff5a14');
  const hot = hex('#ffb040');
  return icon16((put) => {
    // A broad blade from the lower left to the upper right, three wide, its
    // back edge toothed and its front edge glowing hotter toward the point.
    for (let i = 0; i < 10; i++) {
      put(4 + i, 11 - i, i > 7 ? steelLit : steel);
      put(5 + i, 11 - i, i % 3 === 1 ? steelLit : steel);
      put(5 + i, 12 - i, i > 5 ? hot : edge);
      if (i % 2 === 0 && i < 9) put(3 + i, 11 - i, hex('#5a4e52'));
    }
    put(15, 0, hex('#fff0c0'));
    // Embers flaking off the edge.
    put(13, 6, hex('#e04412'));
    put(11, 9, hex('#a02a0a'));
    // A bone crossguard swept up like wings.
    for (const [x, y] of [[1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14]]) put(x, y, hex('#d2c29a'));
    put(1, 8, hex('#f2e8c8'));
    put(7, 14, hex('#a08c68'));
    // Grip and the red pommel stone.
    seg(put, 3, 13, 2, 14, hex('#5a3a2c'));
    put(1, 15, hex('#ff4a14'));
    put(0, 14, hex('#c02a0a'));
  });
}

/** Colours of the whirlwind button: dragonfire, from white heat to char. */
const DRAGONFIRE: RGB[] = [hex('#fff0d0'), hex('#ffa040'), hex('#ff4a14'), hex('#6a1008')];

/** The special button: a whirl of dragonfire round a little horned skull. */
export function dragonWhirlIcon(): Uint8ClampedArray {
  const px = whirlIcon(DRAGONFIRE);
  const set = (x: number, y: number, c: RGB | null) => {
    const i = (y * 16 + x) * 4;
    px[i] = c ? c[0] : 0;
    px[i + 1] = c ? c[1] : 0;
    px[i + 2] = c ? c[2] : 0;
    px[i + 3] = 255;
  };
  const bone = hex('#d2c29a');
  const boneLit = hex('#f2e8c8');
  const boneDark = hex('#7a6a4e');
  const hornC = hex('#8a7058');
  const eye = hex('#ff6a1a');
  // A dark ring round the skull so it reads against the fire.
  for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) if (Math.hypot(x - 7.5, (y - 7.5) * 1.1) < 3.9) set(x, y, null);
  // Cranium, snout and two sockets.
  for (const [y, l, r] of [[6, 6, 9], [7, 5, 10], [8, 6, 9], [9, 7, 8], [10, 7, 8]] as const) {
    for (let x = l; x <= r; x++) set(x, y, y === 6 && x <= 7 ? boneLit : y >= 9 ? boneDark : bone);
  }
  set(6, 7, eye);
  set(9, 7, eye);
  // Horns curling up off its temples.
  for (const [x, y] of [[5, 5], [4, 4], [4, 3], [10, 5], [11, 4], [11, 3]] as const) set(x, y, hornC);
  return px;
}

/** Ember and ash flecks thrown off the Dragonslayer's swings (tints for the world's debris). */
export const DRAGON_EMBERS = [0xffd070, 0xff8a2a, 0xff4a14, (ASH_GREY[0] << 16) | (ASH_GREY[1] << 8) | ASH_GREY[2]];
