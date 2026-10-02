// Materials, the wig and the buttons for the Sun King, the King's epic skin:
// a baroque monarch in the manner of Louis XIV. The figure itself is drawn by
// the warrior's rig (warrior.ts), switched by its `sunking` flag (with
// `king`): a tall curled golden-brown wig falling in ringlets past his
// shoulders under a small gold crown, a pencil moustache, a lace jabot at the
// throat, an ivory silk waistcoat, a royal-blue coat and mantle sewn with gold
// fleurs-de-lis and lined in ermine, a gold sunburst on his breast, white
// hose and red-heeled shoes, and a gilded greatsword with a sun for a pommel.

import { cyl, hex, sphere, type Material, type PixelCanvas, type RGB } from './pixel';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// Materials

/** The great wig: golden-brown curls, a shade darker than the gold so the two read apart. */
export const WIG: Material = {
  ramp: ramp('#2e170a', '#56300f', '#84521f', '#b07a36', '#dcaa5e'),
  outline: hex('#140904'),
  outlineLit: hex('#26140a'),
};

/** The mantle, the robe and the sword's grip: royal blue velvet. */
export const ROYAL_BLUE: Material = {
  ramp: ramp('#0a1236', '#14215e', '#1e3290', '#2c48b8', '#4a68dc'),
  outline: hex('#040818'),
  outlineLit: hex('#0e1a46'),
};

/** The jabot, the gloves and the cuffs: white lace. */
export const LACE: Material = {
  ramp: ramp('#7c7684', '#bdb7c6', '#e8e4ee', '#ffffff'),
  outline: hex('#26222e'),
  outlineLit: hex('#3a3646'),
};

/** The waistcoat down his front: ivory silk. */
export const IVORY: Material = {
  ramp: ramp('#7e6e5c', '#bcaa90', '#e6d8bc', '#fff6e0'),
  outline: hex('#2a2016'),
  outlineLit: hex('#3a2e20'),
};

/** White silk hose. */
export const SILK_HOSE: Material = {
  ramp: ramp('#837a74', '#c4bab0', '#ebe4da', '#fffaf2'),
  outline: hex('#2a2420'),
  outlineLit: hex('#3a322c'),
};

/** The red-heeled shoes of the court. */
export const RED_HEELS: Material = {
  ramp: ramp('#2e0408', '#5e0c12', '#981a20', '#cc3a36'),
  outline: hex('#100204'),
};

/** The gilded greatsword: pale steel washed with gold. */
export const GILDED: Material = {
  ramp: ramp('#5a4626', '#9a8052', '#d2bc86', '#f2e4b8', '#fffbe8'),
  outline: hex('#1e1408'),
  outlineLit: hex('#2e2210'),
  shine: true,
  noAO: true,
};

/** The sun: the pommel and the brooch, polished gold that glows a little. */
export const SUN_GOLD: Material = {
  ramp: ramp('#8a4a10', '#d08a20', '#ffc840', '#fff0a0'),
  outline: hex('#2a1404'),
  emissive: 0.4,
  shine: true,
  noAO: true,
};

/** The gold thread of the fleurs-de-lis. */
const FLEUR: Material = {
  ramp: ramp('#7a4a14', '#c08a2a', '#f0c050', '#fff0a8'),
  outline: hex('#2a1404'),
  noAO: true,
};

/** The sun's light (light-only colours). */
export const SUN_GLOW = { core: hex('#fffdf0'), hot: hex('#ffe680'), mid: hex('#ffb820') };

// ---------------------------------------------------------------------------
// Patterns

/**
 * Sew fleurs-de-lis over whatever of `m` was drawn in the box: a staggered
 * lattice of little gold marks, each a bud over a crossbar. Only marks that
 * fit wholly on the cloth are sewn, so none hang off its edge.
 */
export function fleurs(c: PixelCanvas, m: Material, x0: number, y0: number, x1: number, y1: number): void {
  const on = (x: number, y: number) => c.materialAt(x, y) === m;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const row = Math.floor(y / 4);
      if (((y % 4) + 4) % 4 !== 2 || ((((x + (row & 1) * 2) % 4) + 4) % 4) !== 1) continue;
      if (!on(x, y) || !on(x, y - 1) || !on(x - 1, y) || !on(x + 1, y)) continue;
      c.px(x, y - 1, FLEUR, { x: 0, y: 0.4, z: 0.9 }, { bias: 1 });
      c.px(x, y, FLEUR, { x: 0, y: 0.2, z: 0.97 });
      c.shade(x - 1, y, 1);
      c.shade(x + 1, y, 1);
    }
  }
}

/**
 * Curl the wig: wherever it was drawn in the box, round curls three pixels
 * across in staggered rows, each lit on its upper left and shaded in a
 * crescent under its lower right, so the mass reads as heaped ringlets.
 */
export function curls(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const ly = ((y % 3) + 3) % 3;
    const off = (Math.floor(y / 3) & 1) * 2;
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (c.materialAt(x, y) !== WIG) continue;
      const lx = (((x + off) % 3) + 3) % 3;
      if (lx === 0 && ly === 0) c.shade(x, y, 1);
      else if ((ly === 2 && lx >= 1) || (lx === 2 && ly === 1)) c.shade(x, y, -1);
    }
  }
}

// ---------------------------------------------------------------------------
// The wig and the crown

/** The small gold crown sitting atop the wig, its band on row `by`: three points, a sapphire. */
function smallCrown(c: PixelCanvas, cx: number, by: number, gold: Material, gem: Material, front: boolean): void {
  c.part();
  c.shape(by, by, () => [cx - 2.4, cx + 2.4], gold, (_x, _y, t) => cyl(t, 0.1), { bias: 1 });
  for (const [dx, h] of [[-3, 1], [-1, 2], [0, 2], [2, 1]] as const) {
    for (let i = 1; i <= h; i++) c.px(cx + dx, by - i, gold, { x: dx < 0 ? -0.4 : 0.35, y: 0.4, z: 0.82 }, { bias: i === h ? 1 : 0 });
  }
  if (!front) return;
  c.part();
  c.px(cx - 1, by, gem, sphere(-0.4, -0.3), { bias: 1 });
}

/** The wig's two great lobes of curls either side of the parting, rows 3..9; the crown sits in the dip between them. */
function lobes(c: PixelCanvas, cx: number, U: number): void {
  for (const k of [-1, 1]) {
    c.ellipse(cx + k * 2.4 - 0.5, 6.6 + U, 3.1, 3.4, WIG, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.2, 1) });
  }
  // The parting between them.
  for (const y of [3, 4]) c.shade(cx - 1, y + U, -2);
  c.shade(cx - 1, 5 + U, -1);
}

/** The wig behind the head, framing the face either side, drawn before the face. */
export function wigFront(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.shape(7 + U, 16 + U, (y) => {
    const u = (y - 7 - U) / 9;
    const hw = 5.4 - Math.max(0, u - 0.7) * 2;
    return [cx - hw - 0.5, cx + hw - 0.5];
  }, WIG, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.5), { bias: -1 });
  curls(c, cx - 7, 7 + U, cx + 7, 16 + U);
}

/** The wig's top and the locks framing the face, drawn over the face. */
export function wigCrownFront(c: PixelCanvas, cx: number, U: number, gold: Material, gem: Material): void {
  c.part();
  lobes(c, cx, U);
  // Side locks hanging either side of the face down to the jaw.
  c.shape(9 + U, 15 + U, () => [cx - 6.0, cx - 3.6], WIG, (_x, _y, t) => cyl(t * 0.6 - 0.5, 0));
  c.shape(9 + U, 15 + U, () => [cx + 2.6, cx + 5.0], WIG, (_x, _y, t) => cyl(t * 0.6 + 0.5, 0));
  curls(c, cx - 7, 3 + U, cx + 7, 15 + U);
  smallCrown(c, cx - 0.5, 2 + U, gold, gem, true);
}

/** The long ringlets falling in front of both shoulders, over the mantle's ermine. */
export function wigLocksFront(c: PixelCanvas, cx: number, U: number, sway: number): void {
  c.part();
  for (const k of [-1, 1]) {
    c.shape(15 + U, 21 + U, (y) => {
      const u = (y - 15 - U) / 6;
      const x = cx - 0.5 + k * 4.2 + sway * u * 0.4;
      const hw = 1.1 - Math.max(0, u - 0.75) * 2;
      return [x - hw, x + hw];
    }, WIG, (_x, _y, t, u) => cyl(t * 0.8 + k * 0.2, 0.2 - u * 0.3));
  }
  curls(c, cx - 8, 15 + U, cx + 8, 22 + U);
}

/** The wig from behind: the two lobes, one great mass of curls down past the shoulders, and the crown's back. */
export function wigBack(c: PixelCanvas, cx: number, U: number, sway: number, gold: Material, gem: Material): void {
  c.part();
  c.shape(8 + U, 19 + U, (y) => {
    const u = (y - 8 - U) / 11;
    const x = cx - 0.5 + sway * u * 0.4;
    const hw = 5.4 - Math.max(0, u - 0.7) * 3;
    return [x - hw, x + hw];
  }, WIG, (_x, _y, t, u) => cyl(t * 0.9, 0.4 - u * 0.6));
  // A ragged hem of ringlet ends.
  for (let x = Math.round(cx - 5); x <= cx + 5; x += 2) c.erase(x + Math.round(sway * 0.4), 19 + U);
  c.part();
  lobes(c, cx, U);
  curls(c, cx - 8, 3 + U, cx + 8, 19 + U);
  smallCrown(c, cx - 0.5, 2 + U, gold, gem, false);
}

/** In profile, facing left: the mass behind the face and down the back. */
export function wigSideBehind(c: PixelCanvas, hx: number, U: number, sway: number): void {
  c.part();
  c.shape(5 + U, 21 + U, (y) => {
    const u = (y - 5 - U) / 16;
    return [hx - 1.4 + u * 0.6, hx + 4.6 + Math.min(1, u * 3) * 0.6 - Math.max(0, u - 0.7) * 4 + sway * u * 0.5];
  }, WIG, (_x, _y, t, u) => cyl(t * 0.8 + 0.2, 0.3 - u * 0.5), { bias: -1 });
  curls(c, hx - 3, 5 + U, hx + 8, 21 + U);
}

/** In profile: the top of the wig over the brow and the crown on it. */
export function wigSideTop(c: PixelCanvas, hx: number, U: number, gold: Material, gem: Material): void {
  c.part();
  c.shape(3 + U, 10 + U, (y) => {
    const [l, r] = ([[-2.6, 2.4], [-4.0, 3.6], [-4.6, 4.4], [-4.8, 4.8], [-4.8, 4.9], [-4.6, 4.9], [-4.2, 4.9], [-1.0, 4.9]] as const)[y - 3 - U];
    return [hx + l, hx + r];
  }, WIG, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, u * 1.2 - 0.9, 1));
  curls(c, hx - 6, 3 + U, hx + 6, 10 + U);
  c.part();
  c.shape(2 + U, 2 + U, () => [hx - 2.6, hx + 1.8], gold, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.1), { bias: 1 });
  for (const [dx, h] of [[-3, 1], [-1, 2], [1, 1]] as const) {
    for (let i = 1; i <= h; i++) c.px(hx + dx, 2 + U - i, gold, { x: -0.3, y: 0.4, z: 0.85 }, { bias: i === h ? 1 : 0 });
  }
  c.part();
  c.px(hx - 2, 2 + U, gem, sphere(-0.5, -0.3), { bias: 1 });
}

/** In profile: the lock falling before the ear and over the near shoulder. */
export function wigLockSide(c: PixelCanvas, hx: number, U: number, sway: number): void {
  c.part();
  c.shape(11 + U, 21 + U, (y) => {
    const u = (y - 11 - U) / 10;
    const x = hx + 0.8 + sway * u * 0.4;
    const hw = 1.3 - Math.max(0, u - 0.8) * 2;
    return [x - hw, x + hw];
  }, WIG, (_x, _y, t, u) => cyl(t * 0.8, 0.2 - u * 0.3));
  curls(c, hx - 2, 11 + U, hx + 4, 21 + U);
}

/** The pencil moustache under the nose, from the front. */
export function moustache(c: PixelCanvas, cx: number, U: number): void {
  c.part();
  c.px(cx - 2, 14 + U, WIG, { x: -0.3, y: 0.2, z: 0.93 }, { bias: -1 });
  c.px(cx + 1, 14 + U, WIG, { x: 0.3, y: 0.2, z: 0.93 }, { bias: -1 });
}

/** The lace jabot falling from the throat, rows y..y+2 under the chin. */
export function jabot(c: PixelCanvas, cx: number, y: number): void {
  c.part();
  c.shape(y, y + 2, (yy) => {
    const hw = [1.3, 1.6, 1.1][yy - y];
    return [cx - hw, cx + hw];
  }, LACE, (_x, _y, t, u) => sphere(t * 0.8, u * 0.8 - 0.2, 1));
  // Its frills.
  c.shade(cx - 1, y + 1, -1);
  c.shade(cx, y + 2, -1);
}

/** The gold sunburst brooch on the breast, its disc at (x, y): rays out on the diagonals and the four ways. */
export function sunBrooch(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.px(x - 1, y, SUN_GOLD, sphere(-0.5, -0.4), { bias: 1 });
  c.px(x, y, SUN_GOLD, sphere(0.4, -0.4));
  c.px(x - 1, y + 1, SUN_GOLD, sphere(-0.4, 0.4));
  c.px(x, y + 1, SUN_GOLD, sphere(0.4, 0.4), { bias: -1 });
  for (const [dx, dy] of [[-2, -1], [1, -1], [-2, 2], [1, 2]] as const) c.px(x + dx, y + dy, SUN_GOLD, { x: dx < 0 ? -0.5 : 0.5, y: dy < 0 ? 0.5 : -0.5, z: 0.7 }, { glow: 0.25 });
  c.spark(x - 1, y, SUN_GLOW.core, 0.5);
  c.spark(x, y + 1, SUN_GLOW.hot, 0.35);
}

// ---------------------------------------------------------------------------
// Buttons (additive, see druid.ts icon16)

export const SUN_TONES: Tones = [hex('#fffdf0'), hex('#ffe680'), hex('#ffb820'), hex('#2a4ab8')];

/** The attack button: the gilded greatsword, its pommel a little sun. */
export function sunSwordIcon(): Uint8ClampedArray {
  const blade = hex('#f2e4b8');
  const bladeDark = hex('#a8925e');
  const tip = hex('#fffbe8');
  const gold = hex('#ffc840');
  const goldLit = hex('#fff0a0');
  const blue = hex('#2c48b8');
  return icon16((put) => {
    // The blade, lower left to upper right, a lit and a shaded bevel.
    for (let i = 0; i < 9; i++) {
      put(6 + i, 9 - i, i > 6 ? tip : blade);
      put(7 + i, 9 - i, bladeDark);
    }
    put(15, 0, tip);
    // A broad gold crossguard, a blue grip.
    for (const [x, y] of [[3, 8], [4, 9], [5, 10], [6, 11], [7, 12]]) put(x, y, gold);
    put(4, 8, goldLit);
    seg(put, 4, 11, 3, 12, blue);
    // The sun pommel: a disc with rays round it.
    for (const [x, y] of [[1, 13], [2, 13], [1, 14], [2, 14]]) put(x, y, goldLit);
    for (const [x, y] of [[0, 12], [3, 12], [0, 15], [3, 15], [1, 11], [4, 14]]) put(x, y, gold);
  });
}

/**
 * The Royal Decree as the Sun King's: the sun held high, rays falling from it
 * onto a ring of light spreading on the ground.
 */
export function sunDecreeIcon(k: Tones = SUN_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // The ring on the ground.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 13) / 2.4);
        if (Math.abs(d - 1) < 0.16) put(x, y, k[2]);
        else if (d < 0.6) put(x, y, k[3]);
      }
    }
    // Rays down from the sun onto it.
    for (const [x0, x1] of [[6, 3], [8, 8], [10, 13]] as const) seg(put, x0, 8, x1, 12, k[3]);
    // The sun: rays all round, then the disc.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r0 = 3.6;
      const r1 = i % 2 ? 4.8 : 5.8;
      seg(put, 7.5 + Math.cos(a) * r0, 4.5 + Math.sin(a) * r0, 7.5 + Math.cos(a) * r1, 4.5 + Math.sin(a) * r1, i % 2 ? k[2] : k[1]);
    }
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 4.5);
        if (d < 1.4) put(x, y, k[0]);
        else if (d < 2.6) put(x, y, k[1]);
      }
    }
  });
}
