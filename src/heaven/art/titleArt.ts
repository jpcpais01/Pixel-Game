// The title screen's art: a dawn sky with a low sun, cloud puffs, a sea of
// cloud along the bottom, and the little floating isle the wanderer stands on
// (a blossom tree, a lantern post, flowers in the grass, roots hanging from
// the rock beneath).

import type Phaser from 'phaser';
import { Bitmap, bayer, mix } from '../../art/bitmap';
import { cyl, hex, PixelCanvas, type RGB } from '../../art/pixel';
import { hsh } from './kit';
import { mat } from './paint';

/** The sky from its top down to the horizon. */
const SKY: RGB[] = ['#6f93d6', '#93a6e4', '#b9b0ec', '#dcb8e2', '#f6c4c4', '#ffd8b4', '#ffe8c4'].map(hex);
const SUN = hex('#fff6dc');
const SUN_HALO = hex('#ffe2b0');

/** A sky as tall and wide as the view (art px), dithered from band to band. */
export function skyTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `hl_sky_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const n = SKY.length - 1;
  for (let y = 0; y < h; y++) {
    const f = Math.min(0.999, (y / Math.max(1, h - 1)) * n);
    const i = Math.floor(f);
    const t = f - i;
    for (let x = 0; x < w; x++) b.set(x, y, t > bayer(x, y) ? SKY[i + 1] : SKY[i]);
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** The low sun: a pale disc in rings of halo, dithered out. */
export function sunTexture(scene: Phaser.Scene): string {
  const key = 'hl_sun';
  if (scene.textures.exists(key)) return key;
  const R = 46;
  const b = new Bitmap(R * 2, R * 2);
  for (let y = 0; y < R * 2; y++)
    for (let x = 0; x < R * 2; x++) {
      const d = Math.hypot(x + 0.5 - R, y + 0.5 - R);
      if (d < 13) b.set(x, y, SUN);
      else if (d < 16) b.set(x, y, mix(SUN, SUN_HALO, 0.5));
      else {
        const t = 1 - (d - 16) / (R - 16);
        if (t > 0 && t * t * 0.9 > bayer(x, y)) b.set(x, y, SUN_HALO, Math.round(70 + t * 90));
      }
    }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

const CLOUD_LIT = hex('#fff8f0');
const CLOUD_MID = hex('#f8e2ea');
const CLOUD_SHADE = hex('#d9c6ea');
const CLOUD_DEEP = hex('#b7a8d8');

/** A cloud puff: round lumps over a flat base, lit warm from above, violet underneath. */
function puff(w: number, h: number, seed: number): Bitmap {
  const b = new Bitmap(w, h);
  const lumps: [number, number, number][] = [];
  const n = Math.max(3, Math.round(w / 11));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = h * (0.32 + 0.3 * Math.sin(t * Math.PI)) * (0.85 + hsh(i, seed) * 0.3);
    lumps.push([w * (0.08 + t * 0.84), h - r - 2, r]);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let inside = false;
      let top = 0;
      for (const [cx, cy, r] of lumps) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) {
          inside = true;
          top = Math.max(top, -(dy / r) * 0.8 - (dx / r) * 0.25);
        }
      }
      if (y >= h - 3 && x > w * 0.1 && x < w * 0.9) inside = true;
      if (!inside) continue;
      const low = y / h;
      const c = top > 0.45 ? CLOUD_LIT : top > 0.05 ? CLOUD_MID : low > 0.82 ? CLOUD_DEEP : CLOUD_SHADE;
      b.set(x, y, c);
    }
  return b;
}

export const CLOUD_KINDS = 4;

/** Cloud puffs of a few sizes: frames `c0`..`c3` of `hl_clouds`. */
export function cloudTextures(scene: Phaser.Scene): string {
  const key = 'hl_clouds';
  if (scene.textures.exists(key)) return key;
  const sizes: [number, number][] = [
    [64, 22],
    [44, 16],
    [86, 26],
    [30, 12],
  ];
  const W = sizes.reduce((s, [w]) => s + w, 0);
  const H = Math.max(...sizes.map(([, h]) => h));
  const sheet = new Bitmap(W, H);
  let ox = 0;
  const rects: [number, number, number][] = [];
  sizes.forEach(([w, h], i) => {
    const p = puff(w, h, i * 7 + 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4;
        if (p.data[j + 3]) sheet.set(ox + x, H - h + y, [p.data[j], p.data[j + 1], p.data[j + 2]]);
      }
    rects.push([ox, w, h]);
    ox += w;
  });
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  rects.forEach(([x, w, h], i) => tex.add(`c${i}`, 0, x, H - h, w, h));
  return key;
}

/** A strip of cloud sea that tiles sideways, for the bottom of the screen. */
export function cloudSeaTexture(scene: Phaser.Scene): string {
  const key = 'hl_cloudsea';
  if (scene.textures.exists(key)) return key;
  const W = 160;
  const H = 34;
  const b = new Bitmap(W, H);
  for (let x = 0; x < W; x++) {
    // Rolling tops: a few sine waves that repeat exactly across the tile.
    const a = (x / W) * Math.PI * 2;
    const top = 9 + Math.sin(a * 3) * 3 + Math.sin(a * 7 + 1) * 1.6 + Math.sin(a * 11 + 2) * 0.8;
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) {
      const d = y - top;
      const c = d < 2 ? CLOUD_LIT : d < 5 ? (bayer(x, y) < 0.5 ? CLOUD_LIT : CLOUD_MID) : d < 11 ? CLOUD_MID : d < 18 ? (bayer(x, y) < 0.5 ? CLOUD_MID : CLOUD_SHADE) : CLOUD_SHADE;
      b.set(x, y, c);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

// ---------------------------------------------------------------- the isle

export const ISLE_W = 132;
export const ISLE_H = 112;
/** Where the wanderer stands on the isle's texture. */
export const ISLE_STAND = { x: 70, y: 50 };

const GRASS = mat('#86c862');
const GRASS_DEEP = mat('#5fa451');
const DIRT = mat('#a56d48');
const ROCK = [mat('#a8939a'), mat('#8b7889'), mat('#6f5f78')];
const ROOT = mat('#6a7d3c');
const BARK = mat('#8a5a3c');
const BLOSSOM = mat('#f6b1c8');
const BLOSSOM_DEEP = mat('#e486a6');
const WOOD = mat('#9a6a40');
const LAMP = mat('#ffe6a0', { emissive: 1, noAO: true });
const PETALS = [mat('#ffffff'), mat('#ffd86a'), mat('#f6a8c0'), mat('#b9a4f0')];

/** The isle, painted with the engine's light: grass, a lip of earth, the rock below and its roots. */
export function isleTexture(scene: Phaser.Scene): string {
  const key = 'hl_isle';
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintIsle().toCanvas());
  return key;
}

export function paintIsle(): Bitmap {
  const c = new PixelCanvas(ISLE_W, ISLE_H);
  const cx = 66;
  const top = 48;
  const rx = 56;
  const ry = 15;
  // The rock beneath, first: strata narrowing to a point, a little ragged.
  c.part();
  for (let x = cx - rx; x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx;
    if (Math.abs(dx) > 1) continue;
    const edge = top + ry * Math.sqrt(1 - dx * dx);
    // Ragged, but in runs of a few columns rather than a comb.
    const j0 = hsh(x >> 2, 3);
    const j1 = hsh((x >> 2) + 1, 3);
    const jag = j0 + (j1 - j0) * ((x & 3) / 4);
    const depth = 46 * Math.pow(1 - dx * dx, 0.85) + (jag - 0.5) * 7;
    for (let y = Math.floor(edge) + 3; y < edge + depth; y++) {
      const u = (y - edge) / Math.max(1, depth);
      const band = Math.floor((y + Math.sin(x * 0.2) * 2) / 5) % 3;
      c.px(x, y, ROCK[Math.min(2, Math.floor(u * 2.2 + (band === 0 ? 0.4 : 0)))], cyl(dx, -0.3), { bias: hsh(x, y) < 0.035 ? -1 : 0 });
    }
  }
  // The lip of earth all round the front.
  c.part();
  for (let x = cx - rx; x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx;
    if (Math.abs(dx) > 1) continue;
    const edge = top + ry * Math.sqrt(1 - dx * dx);
    for (let y = Math.floor(edge); y < edge + 4; y++) c.px(x, y, y < edge + 1 ? GRASS_DEEP : DIRT, cyl(dx, 0.1), { bias: y > edge + 2.5 ? -1 : 0 });
  }
  // The meadow on top.
  c.part();
  c.ellipse(cx, top, rx, ry, GRASS, { normal: (_x, _y, dx, dy) => ({ x: dx * 0.3, y: dy * 0.3 - 0.25, z: 0.9 }) });
  for (let y = top - ry; y <= top + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (c.materialAt(x, y) !== GRASS) continue;
      // Light from the top-left across the meadow, tufts of darker grass, and flowers in little drifts.
      const lx = (x - cx) / rx;
      const ly = (y - top) / ry;
      if (lx + ly < -0.7 && hsh(x, y, 1) < 0.6) c.shade(x, y, 1);
      const h = hsh(x, y, 5);
      const drift = hsh(x >> 3, y >> 2, 4) > 0.72;
      if (h < 0.05 || (h < 0.12 && (x + y) % 3 === 0)) c.shade(x, y, -1);
      else if (drift && h > 0.88) c.px(x, y, PETALS[Math.floor(hsh(x >> 3, y >> 2, 9) * PETALS.length)], { x: 0, y: -0.3, z: 0.9 });
    }
  // Roots hanging from under the lip.
  c.part();
  for (const [x0, len] of [
    [24, 9],
    [37, 14],
    [52, 7],
    [79, 12],
    [93, 8],
    [104, 10],
  ]) {
    const dx = (x0 + 0.5 - cx) / rx;
    const y0 = Math.round(top + ry * Math.sqrt(1 - dx * dx) + 3);
    for (let i = 0; i < len; i++) c.px(x0 + Math.round(Math.sin(i * 0.7 + x0) * 0.8), y0 + i, ROOT, FLATISH, { bias: i > len - 3 ? -1 : 0 });
  }
  // A blossom tree on the left.
  const tx = 34;
  const ty = top - 2;
  c.part();
  c.capsule(tx, ty, tx + 1, ty - 15, 2.2, 1.3, BARK);
  c.capsule(tx + 1, ty - 11, tx + 7, ty - 18, 1.1, 0.8, BARK);
  c.capsule(tx, ty - 12, tx - 6, ty - 17, 1.1, 0.8, BARK);
  for (const [dx, dy, r] of [
    [-7, -20, 7],
    [6, -22, 8],
    [0, -27, 8],
    [-2, -18, 6],
    [9, -16, 5],
    [-10, -15, 5],
  ]) {
    c.part();
    c.ellipse(tx + dx, ty + dy, r, r * 0.86, BLOSSOM);
  }
  for (let y = ty - 36; y <= ty - 8; y++)
    for (let x = tx - 18; x <= tx + 18; x++) {
      if (c.materialAt(x, y) !== BLOSSOM) continue;
      const h = hsh(x, y, 2);
      if (h < 0.16) c.px(x, y, BLOSSOM_DEEP, { x: 0, y: 0.3, z: 0.9 });
      else if (h > 0.93) c.shade(x, y, 1);
    }
  // Fallen petals under it.
  for (let i = 0; i < 9; i++) c.px(tx - 10 + Math.round(hsh(i, 1) * 22), ty + 2 + Math.round(hsh(i, 2) * 6), BLOSSOM, { x: 0, y: -0.4, z: 0.9 });
  // A lantern post on the right.
  const lx = 104;
  const ly = top + 3;
  c.part();
  c.capsule(lx, ly, lx, ly - 16, 0.9, 0.8, WOOD);
  c.capsule(lx, ly - 16, lx - 4, ly - 16, 0.7, 0.7, WOOD);
  c.part();
  c.ellipse(lx - 4, ly - 12.5, 1.6, 2, LAMP);
  // A few stones.
  c.part();
  c.ellipse(86, top + 7, 2.4, 1.6, ROCK[0]);
  c.ellipse(89, top + 8, 1.6, 1.1, ROCK[1]);
  const r = c.render();
  const b = new Bitmap(ISLE_W, ISLE_H);
  b.data.set(r.diffuse);
  // The lamp's own light, added over its frame.
  for (let i = 0; i < ISLE_W * ISLE_H; i++) {
    if (r.emissive[i * 4 + 3]) {
      b.data[i * 4] = Math.min(255, b.data[i * 4] + r.emissive[i * 4] * 0.4);
      b.data[i * 4 + 1] = Math.min(255, b.data[i * 4 + 1] + r.emissive[i * 4 + 1] * 0.4);
      b.data[i * 4 + 2] = Math.min(255, b.data[i * 4 + 2] + r.emissive[i * 4 + 2] * 0.4);
    }
  }
  return b;
}

const FLATISH = { x: 0, y: 0.2, z: 0.95 };

/** A soft warm glow (the lamp's, the isle's), dithered out: `hl_glow`. */
export function glowTexture(scene: Phaser.Scene): string {
  const key = 'hl_glow';
  if (scene.textures.exists(key)) return key;
  const R = 24;
  const b = new Bitmap(R * 2, R * 2);
  for (let y = 0; y < R * 2; y++)
    for (let x = 0; x < R * 2; x++) {
      const t = 1 - Math.hypot(x + 0.5 - R, y + 0.5 - R) / R;
      if (t > 0) b.set(x, y, [255, 226, 160], Math.round(t * t * 255));
    }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}
