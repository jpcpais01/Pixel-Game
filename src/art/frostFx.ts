// The spells the Aurora Colosseum's creatures share, drawn once for all of
// them (game/monsters/frostFx.ts plays them):
//   - fz_spike:    ice bursting up out of the floor (three looks), lit
//   - fz_icicle:   a great icicle falling from above, lit
//   - fz_snowball: a packed snowball, lit
//   - fz_shard:    a dart of ice in flight, pure light, pointing right
//   - fz_ring:     a ring of frost racing out along the ground, pure light
//   - fz_lane:     the path a charge or a slide will take, pure light
//   - fz_patch:    hoarfrost on the floor where the cold lingers (four frames)
//   - fz_flake:    a snowflake (motes round a chilled hero)
//   - fz_mist:     a soft puff of freezing mist

import { bayer, clamp01 } from './bitmap';
import { hash2 } from './env';
import { PixelCanvas, hex, sphere, type RGB } from './pixel';
import { C_ICE, C_WHITE, ICE, ICE_DARK, ICE_GLOW, RIME, SNOW, crystal } from './frostKit';

type Px = Uint8ClampedArray;

const put = (px: Px, w: number, x: number, y: number, c: RGB, a = 255) => {
  if (x < 0 || y < 0 || x >= w || y * w * 4 >= px.length) return;
  const i = (y * w + x) * 4;
  // Keep the brighter where two strokes meet.
  if (px[i + 3] && px[i] + px[i + 1] + px[i + 2] > c[0] + c[1] + c[2]) return;
  px.set([c[0], c[1], c[2], a], i);
};

// ---------------------------------------------------------------- Spike

export const FZ_SPIKE_W = 22;
export const FZ_SPIKE_H = 30;
/** The spike's foot in its frame. */
export const FZ_SPIKE_OY = 27;

/** A burst of ice crystals out of a crust of snow, look `v` (0..2). */
export function frostSpike(v: number): PixelCanvas {
  const c = new PixelCanvas(FZ_SPIKE_W, FZ_SPIKE_H);
  const cx = 11;
  const by = FZ_SPIKE_OY;
  const j = (k: number) => (hash2(v, k, 71) - 0.5) * 3;
  c.part();
  c.ellipse(cx, by, 8.5, 2.6, SNOW, { flatten: 0.4 });
  // The back crystals first, then the tall one, then two small ones in front.
  const set: [number, number, number, number, number, typeof ICE][] = [
    [cx - 4, by - 1, cx - 8 + j(1), by - 13 + j(2), 2, ICE_DARK],
    [cx + 4, by - 1, cx + 8 + j(3), by - 15 + j(4), 2.1, ICE_DARK],
    [cx, by, cx + j(5) * 0.6, by - 24 + j(6), 3.2, ICE],
    [cx - 2, by + 1, cx - 5 + j(7), by - 8, 1.6, ICE],
    [cx + 3, by + 1, cx + 6 + j(8), by - 9, 1.5, ICE],
  ];
  set.forEach(([bx, bby, tx, ty, r, m], k) => {
    c.part();
    crystal(c, bx, bby, tx, ty, r, m, k === 2 ? C_WHITE : k > 2 ? C_ICE : null);
  });
  // A seam of light up the tall one's heart.
  c.part();
  for (let y = by - 4; y > by - 18; y -= 1) if ((y + v) % 3 !== 0) c.px(cx + Math.round(j(5) * 0.6 * ((by - y) / 24)), y, ICE_GLOW);
  c.part();
  for (const dx of [-7, -3, 2, 6]) c.px(cx + dx, by + 1, RIME, sphere(0, -0.5));
  return c;
}

// ---------------------------------------------------------------- Icicle

export const FZ_ICICLE_W = 12;
export const FZ_ICICLE_H = 30;

/** A great icicle, point down, as it falls: broad and rimed at the top, a glassy point. */
export function frostIcicle(): PixelCanvas {
  const c = new PixelCanvas(FZ_ICICLE_W, FZ_ICICLE_H);
  const cx = 6;
  c.part();
  c.shape(1, 28, (y) => {
    const u = (y - 1) / 27;
    const hw = 4.6 * Math.pow(1 - u, 0.85) + 0.3;
    const x = cx + Math.sin(u * 5) * 0.4;
    return [x - hw, x + hw];
  }, ICE, (_x, _y, t, u) => ({ x: t < -0.15 ? -0.65 : t > 0.3 ? 0.6 : 0, y: 0.35 - u * 0.2, z: 0.7 }));
  // Its glowing core.
  c.part();
  for (let y = 4; y < 22; y++) if (y % 4 !== 0) c.px(cx - (y < 12 ? 1 : 0), y, ICE_GLOW);
  // A crust of rime where it broke from its ledge.
  c.part();
  c.ellipse(cx, 2, 5, 1.8, RIME, { flatten: 0.5 });
  c.spark(cx - 1, 26, C_WHITE, 0.9);
  return c;
}

// ---------------------------------------------------------------- Snowball

export const FZ_SNOWBALL = 12;

/** A packed snowball with a chip of ice in it. */
export function frostSnowball(): PixelCanvas {
  const c = new PixelCanvas(FZ_SNOWBALL, FZ_SNOWBALL);
  c.part();
  c.ellipse(6, 6, 4.6, 4.4, SNOW);
  for (const [x, y] of [[4, 7], [7, 4], [8, 8]]) c.shade(x, y, -1);
  c.part();
  c.px(7, 7, ICE);
  c.px(8, 7, ICE_DARK);
  c.spark(4, 4, C_WHITE, 0.5);
  return c;
}

// ---------------------------------------------------------------- Shard (pure light)

export const FZ_SHARD_W = 16;
export const FZ_SHARD_H = 7;

/** A dart of ice, pointing right: a white core, cyan edges, a broken tail of glints. */
export function frostShard(): Px {
  const w = FZ_SHARD_W;
  const h = FZ_SHARD_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cy = 3;
  for (let x = 0; x < w; x++) {
    // Widest two thirds along, needle at the front, frayed at the back.
    const u = x / (w - 1);
    const hw = u < 0.65 ? 0.4 + u * 3.4 : 2.6 * (1 - (u - 0.65) / 0.35);
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y - cy);
      if (d > hw) continue;
      const core = d < hw * 0.4 && u > 0.35;
      const edge = d > hw - 0.9;
      if (u < 0.3 && bayer(x, y) > u * 3) continue;
      put(px, w, x, y, core ? hex('#ffffff') : edge ? hex('#3a9ae8') : hex('#a8ecff'));
    }
  }
  put(px, w, w - 1, cy, hex('#ffffff'));
  return px;
}

// ---------------------------------------------------------------- Ring (pure light)

export const FZ_RING_W = 64;
export const FZ_RING_H = 34;

/**
 * A ring of frost on the ground, frame `f` of four: a bright crest of rime,
 * jagged little crystals standing up off its rim, a faint wash inside.
 */
export function frostRing(f: number): Px {
  const w = FZ_RING_W;
  const h = FZ_RING_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const rx = w / 2 - 2;
  const ry = h / 2 - 3;
  const cx = w / 2;
  const cy = h / 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      const jag = Math.sin(a * 13 + f * 1.7) * 0.025 + Math.sin(a * 29 - f * 2.3) * 0.015;
      const d = r - 1 - jag;
      if (d > 0.02 || d < -0.2) continue;
      if (d > -0.05) put(px, w, x, y, hex('#ffffff'));
      else if (d > -0.1) put(px, w, x, y, hex('#9ae8ff'));
      else if (bayer(x + f, y) < 0.5 + d * 2.5) put(px, w, x, y, hex('#2a7ad0'), 200);
    }
  }
  // Crystals standing up off the crest, the back ones shorter (seen from above).
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + f * 0.12 + hash2(k, f, 3) * 0.2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    const tall = 1 + Math.round(hash2(k, f, 5) * 2 + (Math.sin(a) > 0 ? 1 : 0));
    for (let t = 1; t <= tall; t++) put(px, w, x, y - t, t === tall ? hex('#ffffff') : hex('#c8f4ff'));
  }
  return px;
}

// ---------------------------------------------------------------- Lane (pure light)

export const FZ_LANE_W = 32;
export const FZ_LANE_H = 11;

/** The path a charge will take: a pale band with frosted edges, white (tinted at runtime). */
export function frostLaneArt(): Px {
  const w = FZ_LANE_W;
  const h = FZ_LANE_H;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = Math.abs(y + 0.5 - h / 2) / (h / 2);
    for (let x = 0; x < w; x++) {
      const fringe = v > 0.72 && v < 0.9 + hash2(x, y, 9) * 0.1;
      const a = fringe ? 0.85 : v < 0.72 ? 0.18 + (1 - v) * 0.22 + (bayer(x, y) > 0.8 ? 0.12 : 0) : 0;
      if (a <= 0) continue;
      const c = Math.round(255 * a);
      px.set([c, c, c, 255], (y * w + x) * 4);
    }
  }
  return px;
}

// ---------------------------------------------------------------- Patch (pure colour)

export const FZ_PATCH_W = 56;
export const FZ_PATCH_H = 28;
export const FZ_PATCH_FRAMES = 4;

/**
 * Hoarfrost spread over the floor, frame `f`: feathery crystals growing out
 * from the middle to a ragged rim, glinting. Drawn as it is (not added), a
 * little see-through.
 */
export function frostPatch(f: number): Px {
  const w = FZ_PATCH_W;
  const h = FZ_PATCH_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / (w / 2 - 1);
      const v = (y + 0.5 - cy) / (h / 2 - 1);
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      const rim = 0.86 + Math.sin(a * 7 + 1.3) * 0.06 + Math.sin(a * 17) * 0.04;
      if (r > rim) continue;
      // Fern-like frost: bright where spokes run out from the middle.
      const spoke = Math.abs(Math.sin(a * 9 + r * 6)) < 0.18 + (1 - r) * 0.12;
      const glint = hash2(x, y, 13 + f) > 0.985;
      const k = clamp01(1 - r / rim);
      if (glint) put(px, w, x, y, hex('#ffffff'), 255);
      else if (spoke) put(px, w, x, y, hex('#d8f6ff'), Math.round(140 + k * 80));
      else if (bayer(x, y) < 0.35 + k * 0.4) put(px, w, x, y, hex('#9ad6f4'), Math.round(70 + k * 70));
    }
  }
  return px;
}

// ---------------------------------------------------------------- Flake and mist (pure light)

export const FZ_FLAKE = 5;

/** A snowflake: a plus with bright tips. */
export function frostFlake(): Px {
  const px = new Uint8ClampedArray(FZ_FLAKE * FZ_FLAKE * 4);
  for (const [x, y, b] of [[2, 2, 1], [2, 0, 0.7], [2, 4, 0.7], [0, 2, 0.7], [4, 2, 0.7], [2, 1, 0.9], [2, 3, 0.9], [1, 2, 0.9], [3, 2, 0.9]] as const) {
    const c = Math.round(255 * b);
    put(px, FZ_FLAKE, x, y, [c, c, 255]);
  }
  return px;
}

export const FZ_MIST_W = 28;
export const FZ_MIST_H = 14;

/** A soft puff of freezing mist, dithered at its edges. White. */
export function frostMist(): Px {
  const w = FZ_MIST_W;
  const h = FZ_MIST_H;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      const k = clamp01(1 - Math.hypot(u, v * 1.05)) * (0.8 + hash2(x >> 2, y >> 1, 3) * 0.4);
      if (k <= 0 || bayer(x, y) > k * 1.6) continue;
      const c = Math.round(110 + k * 120);
      px.set([c, c, c, 255], (y * w + x) * 4);
    }
  }
  return px;
}
