// The Atlas's islands: each place of Heaven Lands drawn as a little floating
// diorama of what's there, on a lump of rock with roots and hanging grass
// underneath. Every island is painted into its own frame; `ISLE_ART` is keyed
// by place id, and a place without a painter of its own gets `generic` (a
// grassy isle with a few trees and a waymarker).
//
// An island's frame carries, besides its picture, where its top's middle is
// (the place's spot on the map), its top's size (for the pick ring), and the
// spots the scene brings to life: mist falling off the rim, windows and
// crystals glowing, chimney smoke, glints.

import { Art, INK, bayer, fbm, hash2, heapPuffs, hex, lit, mix, paintPuffs, piece, ramp, rng, smooth, softShadow, tone, valueNoise, CLOUD, type RGB } from './atlasPaint';

export interface IsleArt {
  art: Art;
  /** The middle of the island's top, in the frame: the place's spot on the map. */
  ax: number;
  ay: number;
  /** Radii of the island's top. */
  rx: number;
  ry: number;
  /** Where mist pours off the rim (frame px, the top of each fall). */
  falls: { x: number; y: number }[];
  /** Soft lights: windows, crystals, lamps (frame px, radius, colour). */
  glows: { x: number; y: number; r: number; tint: number }[];
  /** Spots that glint now and then (fountain spray, crystals, a star inlay). */
  glints: { x: number; y: number }[];
  /** Where chimney smoke rises from, if anywhere. */
  smoke?: { x: number; y: number };
}

// ---------------------------------------------------------------- Palettes

const GRASS = ramp('#22402e', '#2c5434', '#3a6a38', '#52823c', '#729c42', '#98b452', '#c2c86c', '#e6dc98');
const ROCK = ramp('#221a2e', '#32243c', '#46324a', '#5c4256', '#765662', '#916e6c', '#ad897a', '#c9a890');
const SOIL = ramp('#2c1b1e', '#482b26', '#683f30', '#88583a');
const BOUNCE = hex('#eea6a0');
const ROOT = hex('#38221e');
const ROOT_LIT = hex('#6a4632');

const MOSS = ramp('#16302e', '#1e403a', '#285244', '#36664c', '#4a7a54', '#64905e', '#86a66a');
const DEEP_ROCK = ramp('#1a1630', '#262042', '#342c56', '#463c6a', '#5a5080', '#726896', '#9086ae', '#ada6c4');
const NIGHT_GRASS = ramp('#14242e', '#1a3038', '#223e42', '#2c4e4c', '#3a6056', '#4c7460', '#64886c');
const NIGHT_ROCK = ramp('#141428', '#1c1c36', '#262646', '#323458', '#40446a', '#52587e', '#686e92', '#8288a8');
const NIGHT_BOUNCE = hex('#8a7ac8');

type TreeKind = 'oak' | 'birch' | 'pine' | 'sakura' | 'autumn' | 'meadow' | 'hollow';

const CROWN: Record<TreeKind, RGB[]> = {
  oak: ramp('#203a2c', '#2a5032', '#3a6838', '#52823e', '#72a046', '#9ab858', '#c6cc72'),
  birch: ramp('#34522c', '#4a7032', '#62883a', '#82a444', '#a8c056', '#d0d676', '#eee8a0'),
  pine: ramp('#142a2a', '#1a3a30', '#244e38', '#306242', '#42784a', '#5c8e54', '#7ca660'),
  sakura: ramp('#6a2c50', '#923e6c', '#ba5688', '#da7aa4', '#f0a0c0', '#fcc8dc', '#fff0f4'),
  autumn: ramp('#561c1a', '#842c1c', '#b04622', '#d4682a', '#ec9238', '#f8bc56', '#fff09c'),
  meadow: ramp('#2a4a2e', '#3a6236', '#507c3c', '#6c9644', '#90b052', '#b8c86a', '#dedc8e'),
  hollow: ramp('#141630', '#1c2240', '#263256', '#30446a', '#3e5a80', '#527496', '#6e90aa'),
};
const TRUNK = ramp('#2a1a1c', '#462c26', '#684232', '#8c6044');
const BIRCH_BARK = ramp('#5e5866', '#a49ea8', '#ddd4c6', '#fbf4e4');

// ---------------------------------------------------------------- The island itself

interface BodyOpts {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** How far the rock hangs below the rim at its deepest. */
  depth: number;
  seed: number;
  grass?: RGB[];
  rock?: RGB[];
  soil?: RGB[];
  bounce?: RGB;
  /** Rows of soil under the grass before the rock starts. */
  cliff?: number;
  /** Extra points of rock hanging lower. */
  spikes?: number;
  roots?: number;
  /** How ragged the top's edge is. */
  wobble?: number;
}

interface Body {
  top: Uint8Array;
  /** Per column: the lowest row of the top (its south rim), or -1. */
  rim: Int16Array;
  /** Per column: the rock's lowest row. */
  bottom: Int16Array;
  /** On the top, at least `m` px in from its edge. */
  inTop(x: number, y: number, m?: number): boolean;
}

/**
 * The island: a grassy top with a ragged edge, a band of soil, then rock in
 * strata hanging to a few points, lit from the left and warmed underneath
 * by the light off the clouds. Roots and grass hang from it.
 */
function body(a: Art, o: BodyOpts): Body {
  const { w, h } = a;
  const { cx, cy, rx, ry, depth, seed } = o;
  const grass = o.grass ?? GRASS;
  const rock = o.rock ?? ROCK;
  const soil = o.soil ?? SOIL;
  const bounce = o.bounce ?? BOUNCE;
  const cliff = o.cliff ?? 3;
  const wob = o.wobble ?? 0.08;
  const rand = rng(seed);
  const top = new Uint8Array(w * h);
  for (let y = Math.max(0, Math.floor(cy - ry * 1.2)); y <= Math.min(h - 1, Math.ceil(cy + ry * 1.2)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx * 1.2)); x <= Math.min(w - 1, Math.ceil(cx + rx * 1.2)); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const ang = Math.atan2(ny, nx);
      const n1 = valueNoise(Math.cos(ang) * 3 + 8, Math.sin(ang) * 3 + 8, 1, seed) - 0.5;
      const n2 = valueNoise(Math.cos(ang) * 9 + 20, Math.sin(ang) * 9 + 20, 1, seed + 7) - 0.5;
      const lim = 1 + n1 * wob * 2 + n2 * 0.05;
      if (nx * nx + ny * ny <= lim * lim) top[y * w + x] = 1;
    }
  }
  const rim = new Int16Array(w).fill(-1);
  const bottom = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) if (top[y * w + x]) {
    rim[x] = y;
    break;
  }
  // The rock's points: a long one near the middle and a few lesser ones.
  const spikes: [number, number, number][] = [[cx + (rand() - 0.5) * rx * 0.3, 3 + rand() * 3, depth * 0.25]];
  for (let k = 0; k < (o.spikes ?? 3); k++) spikes.push([cx + (rand() * 2 - 1) * rx * 0.7, 2 + rand() * 3, 3 + rand() * depth * 0.2]);
  for (let x = 0; x < w; x++) {
    if (rim[x] < 0) continue;
    const t = Math.min(1, Math.abs((x + 0.5 - cx) / rx));
    const shape = Math.pow(1 - Math.pow(t, 1.6), 1.1);
    let b = rim[x] + cliff + 1 + depth * 0.75 * shape * (0.75 + 0.45 * valueNoise(x, 0, 6, seed + 3));
    for (const [sx, sw, sh] of spikes) b += sh * shape * Math.pow(Math.max(0, 1 - Math.abs(x + 0.5 - sx) / sw), 1.4);
    bottom[x] = Math.min(h - 2, Math.round(b));
  }
  // Soil, then rock.
  for (let x = 0; x < w; x++) {
    if (rim[x] < 0) continue;
    const t = (x + 0.5 - cx) / rx;
    const crack = hash2(x, 0, seed) < 0.08;
    for (let y = rim[x] + 1; y <= bottom[x]; y++) {
      const dy = y - rim[x];
      if (dy <= cliff) {
        a.set(x, y, tone(soil, 0.62 - t * 0.3 - (dy / cliff) * 0.25, x, y));
        continue;
      }
      const d = (y - rim[x] - cliff) / Math.max(1, bottom[x] - rim[x] - cliff);
      const band = Math.floor((y + valueNoise(x, 0, 9, seed + 11) * 5) / 3) % 3;
      let v = 0.62 - t * 0.28 - d * 0.42 + (band === 0 ? -0.07 : band === 1 ? 0.05 : 0) + (valueNoise(x * 1.5, y, 3, seed + 5) - 0.5) * 0.16;
      if (crack && d > 0.12 && d < 0.8) v -= 0.16;
      let c = tone(rock, v, x, y);
      // Light thrown up off the clouds warms the rock's lowest rows.
      if (bottom[x] - y < 2.5 && t < 0.55) c = mix(c, bounce, 0.3);
      a.set(x, y, c);
    }
  }
  // The grassy top: lit from the top left, its north edge catching the sun, its south lip in shade.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!top[y * w + x]) continue;
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      let v = lit(nx * 0.8, ny * 0.8, 0.6) + (fbm(x, y, 6, seed + 2, 2) - 0.5) * 0.3;
      const above = y > 0 && top[(y - 1) * w + x];
      const below = y < h - 1 && top[(y + 1) * w + x];
      if (!above) v += 0.16;
      if (!below) v -= 0.22;
      else if (y < h - 2 && !top[(y + 2) * w + x]) v -= 0.08;
      if (hash2(x, y, seed + 9) < 0.05 && above && below) v += 0.18;
      a.set(x, y, tone(grass, v, x, y));
    }
  }
  // Grass hanging over the rim.
  for (let x = 0; x < w; x++) {
    if (rim[x] < 0 || hash2(x, 1, seed) > 0.42) continue;
    const len = 1 + Math.floor(hash2(x, 2, seed) * 3);
    for (let k = 1; k <= len; k++) a.set(x, rim[x] + k, grass[Math.max(1, 3 - k)]);
  }
  a.outline(INK, hex('#56364e'));
  // Roots hanging below the rock, swaying a little as they go.
  const roots = o.roots ?? Math.round(rx / 5);
  for (let k = 0; k < roots; k++) {
    const x = cx + (rand() * 2 - 1) * rx * 0.72;
    const col = Math.round(x);
    if (col < 0 || col >= w || bottom[col] < 0) continue;
    const t = Math.abs((x - cx) / rx);
    const len = Math.round(3 + rand() * 9 * (1 - t * 0.6));
    const ph = rand() * 6;
    const amp = 1 + rand() * 1.5;
    const y0 = bottom[col] - 1;
    for (let i = 0; i <= len; i++) {
      const xx = Math.round(x + Math.sin(i * 0.5 + ph) * amp * (i / Math.max(1, len)));
      a.set(xx, y0 + i, i < len * 0.5 && i % 3 !== 2 ? ROOT_LIT : ROOT);
      if (i < len * 0.35) a.set(xx + 1, y0 + i, ROOT);
    }
    if (rand() < 0.4) a.set(Math.round(x + Math.sin(len * 0.5 + ph) * amp) - 1, y0 + len, grass[3]);
  }
  // Roots creeping down over the rock from under the soil.
  for (let k = 0; k < Math.round(roots * 0.7); k++) {
    const x = Math.round(cx + (rand() * 2 - 1) * rx * 0.8);
    if (x < 0 || x >= w || rim[x] < 0) continue;
    const len = 2 + Math.floor(rand() * 5);
    for (let i = 0; i < len; i++) if (rim[x] + cliff + 1 + i < bottom[x]) a.set(x + (i > 2 ? 1 : 0), rim[x] + cliff + 1 + i, ROOT);
  }
  const inTop = (x: number, y: number, m = 0): boolean => {
    const at = (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < h && top[Math.floor(py) * w + Math.floor(px)] === 1;
    return at(x, y) && (m === 0 || (at(x - m, y) && at(x + m, y) && at(x, y - m) && at(x, y + m)));
  };
  return { top, rim, bottom, inTop };
}

/** Vines and moss trailing from the rim (on the greener isles). */
function vines(a: Art, b: Body, seed: number, count: number, pal: RGB[] = GRASS): void {
  const rand = rng(seed);
  const cols: number[] = [];
  for (let x = 0; x < a.w; x++) if (b.rim[x] >= 0) cols.push(x);
  for (let k = 0; k < count && cols.length; k++) {
    const x = cols[Math.floor(rand() * cols.length)];
    const len = 3 + Math.floor(rand() * 7);
    for (let i = 1; i <= len && b.rim[x] + i < a.h; i++) {
      const xx = x + (i > len / 2 && rand() < 0.5 ? 1 : 0);
      a.set(xx, b.rim[x] + i, i % 3 === 0 ? pal[4] : pal[2]);
    }
  }
}

/** Where a stream leaves the top: a few pixels of water at the rim, and the fall's spot. */
function outlet(a: Art, b: Body, x: number): { x: number; y: number } {
  const y = b.rim[x];
  a.set(x, y, hex('#bfe4f0'));
  a.set(x + 1, y, hex('#86b8dc'));
  a.set(x, y - 1, hex('#86b8dc'));
  return { x: x + 1, y: y + 1 };
}

// ---------------------------------------------------------------- Trees and props

/** A tree standing with its foot at (x, y): a lumpy lit crown on a trunk, its shadow cast to the right. */
function tree(a: Art, x: number, y: number, kind: TreeKind, R: number, seed: number, shadow = true): void {
  const pal = CROWN[kind];
  const rand = rng(seed);
  if (shadow) softShadow(a, x + R * 0.55, y, R * 0.85, Math.max(1.6, R * 0.32), 0.7);
  if (kind === 'pine') return pine(a, x, y, R, seed);
  const trunkH = kind === 'meadow' ? 0 : kind === 'birch' ? Math.round(R * 1.1) : Math.round(R * 0.7);
  const bw = R * 2 + 3;
  const bh = R * 2 + trunkH + 2;
  piece(a, Math.round(x - R - 1), Math.round(y - bh + 1), bw, bh, (p) => {
    const fx = R + 2;
    const fy = bh;
    // The trunk.
    for (let i = 0; i <= trunkH + 1; i++) {
      const ty = fy - i;
      if (kind === 'birch') {
        const mark = hash2(i, 3, seed) < 0.3;
        p.set(fx - 1, ty, mark ? BIRCH_BARK[0] : BIRCH_BARK[3]);
        p.set(fx, ty, mark ? BIRCH_BARK[0] : BIRCH_BARK[1]);
      } else if (kind === 'hollow') {
        p.set(fx - 1, ty, TRUNK[1]);
        p.set(fx, ty, TRUNK[0]);
        if (i === 0) p.set(fx + 1, ty, TRUNK[0]);
      } else if (trunkH > 0) {
        p.set(fx - 1, ty, TRUNK[2]);
        p.set(fx, ty, TRUNK[1]);
        if (i === 0) {
          p.set(fx - 2, ty, TRUNK[1]);
          p.set(fx + 1, ty, TRUNK[0]);
        }
      }
    }
    // The crown: overlapping clumps, the lower ones in front.
    const ccx = fx - 0.5;
    const ccy = fy - trunkH - R + (kind === 'meadow' ? 1 : 0);
    const clumps: [number, number, number][] = [[ccx, ccy - R * 0.25, R * 0.62]];
    const n = kind === 'meadow' ? 3 : 4 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const ang = rand() * Math.PI * 2;
      const d = R * (0.3 + rand() * 0.25);
      clumps.push([ccx + Math.cos(ang) * d, ccy + Math.sin(ang) * d * 0.8, R * (0.48 + rand() * 0.18)]);
    }
    clumps.sort((q, r) => q[1] - r[1]);
    for (const [kx, ky, kr] of clumps) {
      for (let py = Math.floor(ky - kr - 1); py <= Math.ceil(ky + kr + 1); py++) {
        for (let px = Math.floor(kx - kr - 1); px <= Math.ceil(kx + kr + 1); px++) {
          const nx = (px + 0.5 - kx) / kr;
          const ny = (py + 0.5 - ky) / kr;
          const d2 = nx * nx + ny * ny;
          const edge = 0.82 + 0.3 * valueNoise(px, py, 1.5, seed);
          if (d2 > edge * edge) continue;
          const gx = (px + 0.5 - ccx) / R;
          const gy = (py + 0.5 - ccy) / R;
          let v = lit(nx, ny, 0.45) - gx * 0.16 - gy * 0.2 + (ky - ccy) * -0.01;
          const hh = hash2(px, py, seed + 1);
          if (hh < 0.12) v += 0.14;
          else if (hh > 0.9) v -= 0.14;
          p.set(px + 1, py, tone(pal, v + 0.08, px, py, 0.8));
        }
      }
    }
    if (kind === 'meadow') {
      // Blossoms on the bush.
      for (let k = 0; k < R + 2; k++) {
        const px = Math.round(ccx + (rand() * 2 - 1) * R * 0.7) + 1;
        const py = Math.round(ccy + (rand() * 2 - 1.3) * R * 0.5);
        if (p.alpha(px, py)) p.set(px, py, [hex('#fff4e0'), hex('#ffd860'), hex('#ff9ab8')][k % 3]);
      }
    }
    if (kind === 'sakura' || kind === 'autumn') {
      // A few lit leaves catching the sun on the crown's top left.
      for (let k = 0; k < 3; k++) {
        const px = Math.round(ccx - R * 0.4 + rand() * R * 0.5) + 1;
        const py = Math.round(ccy - R * 0.6 + rand() * R * 0.3);
        if (p.alpha(px, py)) p.set(px, py, pal[6]);
      }
    }
  }, mix(pal[0], INK, 0.5));
  if (kind === 'hollow' && rand() < 0.6) {
    // Glowcaps at its foot.
    a.set(x + 2, y, hex('#9af6ff'));
    a.set(x + 2, y - 1, hex('#e0ffff'));
  }
  if (kind === 'sakura' && rand() < 0.7) {
    // Fallen petals.
    for (let k = 0; k < 3; k++) a.set(Math.round(x - 3 + rand() * 7), Math.round(y + rand() * 2), CROWN.sakura[5]);
  }
}

/** A pine: tiers of dark needles, each lit on its left. */
function pine(a: Art, x: number, y: number, R: number, seed: number): void {
  const pal = CROWN.pine;
  const H = Math.round(R * 2.6);
  const bw = R * 2 + 3;
  const bh = H + 2;
  piece(a, Math.round(x - R - 1), Math.round(y - bh + 1), bw, bh, (p) => {
    const fx = R + 2;
    const fy = bh;
    p.set(fx - 1, fy, TRUNK[2]);
    p.set(fx, fy, TRUNK[1]);
    p.set(fx - 1, fy - 1, TRUNK[1]);
    p.set(fx, fy - 1, TRUNK[0]);
    const tiers = 3;
    for (let k = 0; k < tiers; k++) {
      const ty = fy - 2 - H + 2 + Math.round((k * (H - 2)) / (tiers + 0.6));
      const th = Math.round((H - 2) / 2.1);
      const half = R * (0.55 + (k / (tiers - 1)) * 0.5);
      for (let py = ty; py <= ty + th; py++) {
        const u = (py - ty) / th;
        const hw = half * u + 0.5;
        for (let px = Math.floor(fx - 0.5 - hw); px <= Math.ceil(fx - 0.5 + hw); px++) {
          const s = (px + 0.5 - (fx - 0.5)) / Math.max(1, hw);
          if (Math.abs(s) > 1) continue;
          // A ragged hem.
          if (u > 0.85 && hash2(px, py, seed) < 0.4) continue;
          let v = 0.62 - s * 0.36 - u * 0.2 + (hash2(px, py, seed + 2) < 0.12 ? 0.12 : 0);
          if (Math.abs(s) < 0.15 && u < 0.5) v += 0.06;
          p.set(px, py, tone(pal, v, px, py, 0.8));
        }
      }
    }
  }, mix(pal[0], INK, 0.5));
}

/** A thatched cottage with its front wall's foot centred on (x, y): lit windows, a door, a chimney. */
function cottage(a: Art, x: number, y: number): { windows: { x: number; y: number }[]; chimney: { x: number; y: number } } {
  const ox = Math.round(x - 12);
  const oy = Math.round(y - 25);
  softShadow(a, x + 9, y - 3, 10, 5, 0.66);
  const THATCH = ramp('#5a3a20', '#80562a', '#a8763a', '#cc9a4e', '#e6be6c', '#f6dc96');
  const PLASTER = ramp('#9a7a72', '#c0a08e', '#ddc2a6', '#f2dcbe', '#fff0d8');
  const BEAM = ramp('#3a2420', '#5a3a2c', '#7a5238');
  const STONE = ramp('#4a3e4e', '#6e5e68', '#948088', '#b8a4a4');
  piece(a, ox, oy, 24, 26, (p) => {
    // Chimney, behind the roof's ridge.
    p.rect(16, 0, 18, 7, (px, py) => tone(STONE, 0.7 - (px - 16) * 0.2 + ((py + (px & 1)) % 3 === 0 ? -0.15 : 0), px, py));
    p.rect(15, 0, 19, 0, () => STONE[3]);
    // The front wall.
    p.rect(2, 16, 21, 25, (px, py) => tone(PLASTER, 0.72 - (px - 2) / 19 * 0.28 - (py - 16) * 0.015, px, py));
    for (const bx of [2, 11, 21]) p.rect(bx, 16, bx, 25, (_px, py) => BEAM[py === 16 ? 2 : 1]);
    p.rect(2, 16, 21, 16, () => BEAM[1]);
    // Windows, lit from inside.
    for (const wx of [5, 16]) {
      p.rect(wx - 1, 18, wx + 3, 22, () => BEAM[0]);
      p.rect(wx, 19, wx + 2, 21, (px, py) => (px === wx + 1 || py === 20 ? hex('#e8a040') : py === 19 ? hex('#fff0b4') : hex('#ffd070')));
      p.rect(wx - 1, 23, wx + 3, 23, (px) => (px % 2 ? hex('#ff8aa0') : hex('#e85a6a')));
    }
    // The door.
    p.rect(12, 19, 14, 25, (px, py) => (py === 19 && px !== 13 ? null : px === 12 ? hex('#7a4a2c') : hex('#5a3420')));
    p.set(14, 22, hex('#f4cf6a'));
    // The thatched roof: a deep straw hip, its rows combed, lit from the left.
    p.poly([[5, 3], [20, 3], [25, 17], [1, 17]], (px, py) => {
      const u = (py - 3) / 14;
      const s = (px - 12) / (12 * (0.66 + u * 0.34));
      let v = 0.66 - s * 0.3 - u * 0.18;
      if ((py + Math.floor(hash2(px, 0, 5) * 2)) % 3 === 0) v -= 0.1;
      if (py === 3) v += 0.18;
      if (py >= 16) v -= 0.22;
      return tone(THATCH, v, px, py, 0.8);
    });
    // The chimney's top above the thatch.
    p.rect(16, 0, 18, 2, (px) => tone(STONE, 0.7 - (px - 16) * 0.2, px, 0));
  });
  return {
    windows: [
      { x: ox + 6, y: oy + 20 },
      { x: ox + 17, y: oy + 20 },
    ],
    chimney: { x: ox + 17, y: oy - 1 },
  };
}

/** A tilled vegetable patch with a low fence, top left at (x, y). */
function garden(a: Art, x: number, y: number, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  const SOILR = ramp('#3a2420', '#5a3828', '#7a5034', '#9a6c44');
  softShadow(a, x + w / 2 + 2, y + h / 2 + 1, w / 2 + 1, h / 2 + 1, 0.85);
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const r = (py - y) % 3;
      a.set(px, py, tone(SOILR, r === 0 ? 0.75 - (px - x) / w * 0.2 : r === 1 ? 0.45 : 0.18, px, py));
    }
  }
  for (let py = y; py < y + h - 1; py += 3) {
    for (let px = x + 1; px < x + w - 1; px += 2) {
      const r = rand();
      if (r < 0.12) {
        a.set(px, py, hex('#f4a04a'));
        a.set(px + 1, py, hex('#d06a24'));
        a.set(px, py + 1, hex('#b0521e'));
      } else if (r < 0.75) {
        a.set(px, py, hex('#8ac44a'));
        a.set(px, py - 1, r < 0.4 ? hex('#c0e070') : hex('#5a9a3a'));
      }
    }
  }
  // The fence: posts and a rail round three sides, the gate side open.
  const POST = hex('#6a4428');
  const RAIL = hex('#c49464');
  for (let px = x - 1; px <= x + w; px++) {
    a.set(px, y - 2, RAIL);
    a.set(px, y + h + 1, RAIL);
    if ((px - x) % 4 === 0 || px === x + w) {
      a.set(px, y - 3, RAIL);
      a.set(px, y - 2, POST);
      a.set(px, y + h, RAIL);
      a.set(px, y + h + 1, POST);
    }
  }
  for (let py = y - 2; py <= y + h + 1; py++) {
    a.set(x + w + 1, py, py % 3 === 0 ? POST : RAIL);
  }
}

/** A pond in the golden light: dark near its far bank, the sky's peach on its near water, reeds and lilies. */
function pond(a: Art, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  const WATER = ramp('#2a3462', '#384c80', '#526ca0', '#7e94bc', '#c8b4b8', '#f4d0b0', '#fff0d4');
  const rand = rng(seed);
  a.oval(cx, cy, rx + 1, ry + 1, (_x, _y, _nx, ny) => (ny < 0 ? hex('#4a3428') : hex('#6a4c34')));
  a.oval(cx, cy, rx, ry, (x, y, nx, ny) => {
    let v = 0.35 + ny * 0.4 - nx * 0.08;
    if (ny < -0.6) v -= 0.2;
    // Long glints of sun across the water.
    if ((x + y * 3) % 9 === 0 && ny > -0.3) v += 0.3;
    return tone(WATER, v, x, y, 0.6);
  });
  // Lily pads with a bloom or two.
  for (let k = 0; k < 3; k++) {
    const px = Math.round(cx + (rand() * 1.2 - 0.6) * rx);
    const py = Math.round(cy + (rand() * 1.2 - 0.4) * ry);
    a.set(px, py, hex('#4a8a44'));
    a.set(px + 1, py, hex('#6aa850'));
    if (k === 0) a.set(px + 1, py - 1, hex('#ffb0c8'));
  }
  // Reeds at the west bank.
  for (let k = 0; k < 4; k++) {
    const px = Math.round(cx - rx + k * 1.5);
    const py = Math.round(cy + (k % 2) - 1);
    const hgt = 3 + (k % 3);
    for (let i = 0; i < hgt; i++) a.set(px, py - i, i === hgt - 1 ? hex('#c09a5a') : hex('#3e6a36'));
  }
}

/** A lit lantern on a post; returns the lamp's spot. */
function lampPost(a: Art, x: number, y: number, warm = true): { x: number; y: number } {
  piece(a, x - 1, y - 9, 3, 10, (p) => {
    for (let i = 3; i < 10; i++) p.set(2, i, i % 4 === 0 ? hex('#4a3a3a') : hex('#2e2430'));
    p.rect(1, 0, 3, 2, (px, py) => (py === 0 ? hex('#3a2a2a') : warm ? (px === 2 ? hex('#fff4c0') : hex('#ffc860')) : px === 2 ? hex('#f0f4ff') : hex('#a8c0ff')));
  });
  return { x, y: y - 8 };
}

/** A marble pillar with its foot at (x, y). */
function pillar(a: Art, x: number, y: number, h: number, broken: boolean, pal: RGB[]): void {
  softShadow(a, x + 3, y, 3, 1.4, 0.72);
  piece(a, x - 2, y - h - 1, 5, h + 2, (p) => {
    // Base and capital wider than the shaft.
    p.rect(0, h, 4, h + 1, (px) => tone(pal, 0.7 - px * 0.12, px, h));
    for (let py = 2; py < h; py++) {
      p.set(1, py, pal[3]);
      p.set(2, py, pal[py % 4 === 0 ? 3 : 2]);
      p.set(3, py, pal[1]);
    }
    if (broken) {
      p.set(1, 1, pal[3]);
      p.set(3, 2, pal[1]);
    } else {
      p.rect(0, 0, 4, 1, (px, py) => tone(pal, (py === 0 ? 0.85 : 0.6) - px * 0.1, px, py));
    }
  });
}

/** A crystal: a long six-sided prism, lit face on the left, pointing up (or down, hanging). */
function crystal(a: Art, x: number, y: number, h: number, w: number, pal: RGB[], down = false): void {
  const s = down ? 1 : -1;
  for (let i = 0; i <= h; i++) {
    const yy = y + s * i;
    const hw = i > h - w - 1 ? Math.max(0, h - i) : w;
    for (let dx = -hw; dx <= hw; dx++) {
      const c = i === h ? pal[4] : dx < 0 ? pal[3] : dx === 0 ? pal[4] : dx === hw ? pal[0] : pal[1];
      a.set(x + dx, yy, c);
    }
    if (hw > 0) {
      a.set(x - hw - 1, yy, INK);
      a.set(x + hw + 1, yy, INK);
    }
  }
  a.set(x, y + s * (h + 1), INK);
}

/** A clipped hedge block: its top lit, its front face darker. */
function hedge(a: Art, x0: number, y0: number, x1: number, y1: number, seed: number, flowers = false): void {
  const pal = CROWN.oak;
  softShadow(a, (x0 + x1) / 2 + 2, y1 + 1, (x1 - x0) / 2 + 1, 1.6, 0.7);
  piece(a, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (p) => {
    const w = x1 - x0;
    const h = y1 - y0;
    for (let py = 0; py <= h; py++) {
      for (let px = 0; px <= w; px++) {
        const front = py >= h - 1;
        let v = front ? 0.25 - px / w * 0.1 : 0.66 - px / w * 0.2 - py / Math.max(1, h) * 0.12;
        if (py === 0) v += 0.12;
        if (hash2(px + x0, py + y0, seed) < 0.15) v += 0.12;
        p.set(px + 1, py + 1, tone(pal, v, px, py, 0.7));
        if (flowers && !front && hash2(px + x0, py + y0, seed + 3) < 0.12) p.set(px + 1, py + 1, hash2(px, py, 1) < 0.5 ? hex('#ff9ab8') : hex('#fff0f0'));
      }
    }
  }, mix(pal[0], INK, 0.5));
}

/** A waymarker: a standing stone with a lit rune, for places the Atlas has no picture of yet. */
function waymarker(a: Art, x: number, y: number): { x: number; y: number } {
  const STONE = ramp('#4a4258', '#6c6478', '#908898', '#b8b0b8', '#ddd6d0');
  softShadow(a, x + 4, y, 4, 1.6, 0.7);
  piece(a, x - 2, y - 11, 5, 12, (p) => {
    p.poly([[1, 2], [3, 0], [5, 2], [5, 12], [1, 12]], (px, py) => tone(STONE, 0.75 - (px - 1) * 0.16 - py * 0.01, px, py));
    p.set(3, 5, hex('#ffe08a'));
    p.set(3, 6, hex('#ffb84a'));
    p.set(2, 6, hex('#fff4c0'));
    p.set(3, 7, hex('#ffe08a'));
  });
  return { x, y: y - 6 };
}

// ---------------------------------------------------------------- The places

/** Hearthhome: a meadow isle with a thatched cottage, a vegetable patch, a pond and a few trees. */
function homeIsle(): IsleArt {
  const a = new Art(116, 104);
  const cx = 58;
  const cy = 44;
  const b = body(a, { cx, cy, rx: 46, ry: 22, depth: 34, seed: 11 });
  vines(a, b, 12, 6);
  // A worn path from the door down to the south rim.
  for (let i = 0; i < 22; i++) {
    const px = Math.round(56 + Math.sin(i * 0.3) * 2);
    const py = 43 + i;
    if (!b.inTop(px, py, 1)) break;
    a.set(px, py, i % 4 === 0 ? hex('#c8a06a') : hex('#b08a58'));
    a.set(px + 1, py, hex('#9a7448'));
  }
  // Flowers scattered in the meadow.
  const rand = rng(14);
  for (let k = 0; k < 40; k++) {
    const px = Math.round(cx + (rand() * 2 - 1) * 42);
    const py = Math.round(cy + (rand() * 2 - 1) * 19);
    if (b.inTop(px, py, 2)) a.set(px, py, [hex('#fff4e0'), hex('#ffd860'), hex('#ff9ab8'), hex('#c8a8ff')][k % 4]);
  }
  pond(a, 28, 52, 9, 4.5, 15);
  // The pond spills over the rim to the south west.
  for (let y = 56; y <= b.rim[22]; y++) a.set(22 + (y > 59 ? -1 : 0), y, hex('#86b8dc'));
  const fall = outlet(a, b, 21);
  garden(a, 70, 44, 18, 9, 16);
  const items: { y: number; draw: () => void }[] = [];
  let home: ReturnType<typeof cottage> | null = null;
  items.push({ y: 42, draw: () => (home = cottage(a, 52, 42)) });
  for (const [x, y, k, r, s] of [
    [18, 38, 'oak', 6, 1],
    [27, 31, 'birch', 4, 2],
    [84, 32, 'sakura', 5, 3],
    [94, 38, 'oak', 4, 4],
    [76, 60, 'meadow', 3, 5],
    [36, 62, 'meadow', 3, 6],
  ] as [number, number, TreeKind, number, number][]) items.push({ y, draw: () => tree(a, x, y, k, r, s) });
  let lamp = { x: 0, y: 0 };
  items.push({ y: 50, draw: () => (lamp = lampPost(a, 61, 50)) });
  items.sort((p, q) => p.y - q.y).forEach((i) => i.draw());
  const h = home as unknown as ReturnType<typeof cottage>;
  return {
    art: a,
    ax: cx,
    ay: cy,
    rx: 46,
    ry: 22,
    falls: [fall],
    glows: [...h.windows.map((w) => ({ ...w, r: 9, tint: 0xffc060 })), { ...lamp, r: 10, tint: 0xffd080 }],
    glints: [{ x: 26, y: 51 }, { x: 31, y: 53 }],
    smoke: h.chimney,
  };
}

/** Kinds of tree across the Everwood, west to east, as its seven woods run into one another. */
const WOODS: TreeKind[] = ['meadow', 'oak', 'birch', 'sakura', 'oak', 'autumn', 'hollow'];

/**
 * The Everwood: a long isle crowded with trees of every wood, a brook
 * winding through to spill off the rim, a glade with a white stag in it,
 * and its east end melting into mist, for it has no end.
 */
function everwoodIsle(): IsleArt {
  const a = new Art(290, 156);
  const cx = 126;
  const cy = 62;
  const rx = 114;
  const ry = 40;
  const b = body(a, { cx, cy, rx, ry, depth: 52, seed: 23, wobble: 0.05, spikes: 6, roots: 30 });
  vines(a, b, 24, 18, CROWN.oak);
  // The brook, from the northern woods to the south rim.
  const brook: [number, number][] = [[64, 30], [72, 40], [90, 48], [104, 58], [112, 70], [124, 82], [131, 104]];
  const near = (x: number, y: number): number => {
    let best = Infinity;
    for (let i = 1; i < brook.length; i++) {
      const [x0, y0] = brook[i - 1];
      const [x1, y1] = brook[i];
      const vx = x1 - x0;
      const vy = y1 - y0;
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy)));
      best = Math.min(best, Math.hypot(x - x0 - vx * t, y - y0 - vy * t));
    }
    return best;
  };
  const BROOK = ramp('#2a3a6a', '#3e5c8c', '#6a8cb4', '#b4c8d8', '#fff0d4');
  for (let y = 26; y < 110; y++) {
    for (let x = 60; x < 136; x++) {
      if (!b.inTop(x, y)) continue;
      const d = near(x + 0.5, y + 0.5);
      if (d < 1.6) a.set(x, y, tone(BROOK, 0.45 + (1.6 - d) * 0.2 + ((x + y * 2) % 7 === 0 ? 0.3 : 0), x, y));
      else if (d < 2.4) a.set(x, y, hex('#3a2c2a'));
    }
  }
  let brookX = 131;
  while (brookX > 0 && b.rim[brookX] < 0) brookX--;
  const fall = outlet(a, b, brookX - 1);
  // The glade, where the stag stands.
  const glade = { x: 92, y: 68, r: 9 };
  // Trees on a jittered grid, each wood blending into the next.
  const rand = rng(29);
  const trees: [number, number, TreeKind, number, number][] = [];
  for (let gy = 18; gy < 110; gy += 6) {
    for (let gx = 6; gx < 260; gx += 8) {
      const x = Math.round(gx + (rand() - 0.5) * 6 + ((gy / 6) % 2) * 4);
      const y = Math.round(gy + (rand() - 0.5) * 4);
      if (!b.inTop(x, y, 2) || near(x, y) < 4 || Math.hypot(x - glade.x, (y - glade.y) * 1.4) < glade.r) continue;
      const zone = (x - 12) / 186 + (valueNoise(x, y, 18, 31) - 0.5) * 0.24;
      // Thinning out toward the mist.
      if (x > 178 && rand() < (x - 178) / 46) continue;
      let kind = WOODS[Math.max(0, Math.min(WOODS.length - 1, Math.floor(zone * WOODS.length)))];
      // Pines keep to the cooler north side of the middle woods.
      if (y < cy - 12 && zone > 0.2 && zone < 0.75 && valueNoise(x, y, 12, 33) > 0.45) kind = 'pine';
      const R = kind === 'meadow' ? 3 : 4 + Math.floor(rand() * 2.5);
      if (kind === 'meadow' && rand() < 0.4) continue;
      trees.push([x, y, kind, R, Math.floor(rand() * 9999)]);
    }
  }
  trees.sort((p, q) => p[1] - q[1]);
  let stagDrawn = false;
  const stag = () => {
    // A tiny white stag, head up, antlers lit.
    const sx = glade.x;
    const sy = glade.y + 1;
    const W = hex('#fffaf0');
    const S = hex('#d8d0e8');
    softShadow(a, sx + 2, sy + 1, 3, 1, 0.8);
    for (const [dx, dy, c] of [[-2, -1, W], [-1, -1, W], [0, -1, W], [1, -1, S], [-2, 0, S], [1, 0, S], [1, -2, W], [2, -3, W], [2, -4, W], [1, -5, W], [3, -5, W]] as [number, number, RGB][]) a.set(sx + dx, sy + dy, c);
  };
  for (const [x, y, kind, R, s] of trees) {
    if (!stagDrawn && y > glade.y + 1) {
      stag();
      stagDrawn = true;
    }
    tree(a, x, y, kind, R, s);
  }
  if (!stagDrawn) stag();
  // The east end melts into mist: colours wash toward the cloud, then the pixels thin out.
  const fx0 = 184;
  const fx1 = 252;
  const MIST = hex('#d8a8b4');
  for (let y = 0; y < a.h; y++) {
    for (let x = fx0; x < a.w; x++) {
      if (!a.alpha(x, y)) continue;
      const k = (x - fx0) / (fx1 - fx0) + (valueNoise(x, y, 8, 41) - 0.5) * 0.3;
      if (k <= 0) continue;
      if (bayer(x, y) < k * 1.2 - 0.25) a.erase(x, y);
      else a.set(x, y, mix(a.get(x, y), MIST, Math.min(0.8, k * 0.85)), a.alpha(x, y));
    }
  }
  // Heaps of cloud swallowing the fading end, each shading what's under it.
  const mist = rng(43);
  for (const [hx, hy, size] of [[236, 40, 15], [212, 62, 25], [252, 76, 20], [198, 96, 17], [240, 104, 14]]) {
    softShadow(a, hx + size * 0.5, hy + size * 0.35, size * 1.1, size * 0.45, 0.8);
    paintPuffs(a, heapPuffs(hx, hy, size, 0.3, mist, Math.round(size / 2)), 47, (v, x, y) => tone(CLOUD, v + 0.04, x, y));
  }
  return {
    art: a,
    ax: cx,
    ay: cy,
    rx,
    ry,
    falls: [fall],
    glows: [{ x: glade.x, y: glade.y - 2, r: 8, tint: 0xfff4e0 }],
    glints: [{ x: glade.x + 1, y: glade.y - 4 }, { x: 96, y: 52 }, { x: 116, y: 74 }],
  };
}

/** Cloudrest: a small high isle with a ring of old pillars round a glowing stone. */
function cloudrestIsle(): IsleArt {
  const a = new Art(84, 100);
  const cx = 42;
  const cy = 40;
  const rx = 31;
  const ry = 15;
  const b = body(a, { cx, cy, rx, ry, depth: 46, seed: 31, spikes: 2, roots: 5, wobble: 0.1 });
  vines(a, b, 32, 3);
  const MARBLE = ramp('#6a6280', '#948aa4', '#bcb2c6', '#e2d8de', '#fff6ec');
  // A floor of pale flagstones in rings.
  a.oval(cx, cy, 15, 7.2, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    const ring = Math.floor(d * 3);
    const seam = Math.abs(d * 3 - Math.round(d * 3)) < 0.12 || (Math.floor((Math.atan2(ny, nx) / Math.PI) * (4 + ring * 4)) + ring) % 2 === 0 && hash2(x, y, 3) < 0.15;
    return tone(MARBLE, (seam ? 0.3 : 0.62) - nx * 0.18 - ny * 0.15, x, y);
  });
  // A runed stone in the middle.
  softShadow(a, cx + 3, cy + 1, 3, 1.2, 0.75);
  piece(a, cx - 2, cy - 4, 5, 5, (p) => {
    p.rect(1, 1, 5, 5, (px, py) => tone(MARBLE, 0.8 - (px - 1) * 0.12 - (py === 1 ? -0.1 : 0), px, py));
    p.set(3, 3, hex('#ffd870'));
  });
  const n = 7;
  const posts: [number, number, boolean][] = [];
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + (k / n) * Math.PI * 2;
    posts.push([Math.round(cx + Math.cos(ang) * 21), Math.round(cy + Math.sin(ang) * 10), k === 3]);
  }
  posts.sort((p, q) => p[1] - q[1]);
  for (const [x, y, broken] of posts) pillar(a, x, y, broken ? 5 : 11, broken, MARBLE);
  // A lintel across the two back pillars.
  const back = posts.slice(0, 2).sort((p, q) => p[0] - q[0]);
  piece(a, back[0][0] - 2, back[0][1] - 14, back[1][0] - back[0][0] + 5, 2, (p) => {
    p.rect(1, 1, back[1][0] - back[0][0] + 5, 2, (px, py) => tone(MARBLE, py === 1 ? 0.85 : 0.5, px, py));
  });
  return {
    art: a,
    ax: cx,
    ay: cy,
    rx,
    ry,
    falls: [outlet(a, b, 58)],
    glows: [{ x: cx, y: cy - 2, r: 12, tint: 0xffe0a0 }],
    glints: [{ x: cx, y: cy - 3 }],
  };
}

/** The Sunken Garden: hedges round a court sunk into the isle, a fountain in its heart, stairs going down. */
function gardenIsle(): IsleArt {
  const a = new Art(124, 108);
  const cx = 62;
  const cy = 44;
  const rx = 50;
  const ry = 25;
  const b = body(a, { cx, cy, rx, ry, depth: 38, seed: 41, roots: 8 });
  vines(a, b, 42, 9);
  const SAND = ramp('#4a3a46', '#6e5658', '#94786c', '#b89a80', '#d8bc98', '#f0dab4');
  const MARBLE = ramp('#6a6280', '#948aa4', '#bcb2c6', '#e2d8de', '#fff6ec');
  // The court: x0..x1, its rim at y0 and y1, the north wall's face showing as it drops.
  const x0 = 36;
  const x1 = 88;
  const y0 = 33;
  const y1 = 56;
  const WALL = 4;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (edge) {
        a.set(x, y, tone(SAND, y === y0 || x === x0 ? 0.9 : 0.6, x, y));
        continue;
      }
      if (y <= y0 + WALL) {
        // The north wall's face, mossy at its foot.
        const moss = y === y0 + WALL && hash2(x, y, 1) < 0.5;
        a.set(x, y, moss ? GRASS[2] : tone(SAND, 0.5 - (y - y0) * 0.06 + ((x + (y % 2) * 2) % 4 === 0 ? -0.12 : 0), x, y));
        continue;
      }
      // Paving, in the shade of the walls near the north and west.
      const shade = (y - y0 - WALL < 3 ? 0.18 : 0) + (x - x0 < 2 ? 0.12 : 0);
      const tile = (x % 4 === 0 || y % 3 === 0) ? -0.1 : 0;
      a.set(x, y, tone(SAND, 0.55 + tile - shade - (x - x0) / (x1 - x0) * 0.1, x, y));
    }
  }
  // Grass grown between the stones.
  for (let k = 0; k < 30; k++) {
    const x = x0 + 2 + Math.floor(hash2(k, 1, 4) * (x1 - x0 - 4));
    const y = y0 + WALL + 2 + Math.floor(hash2(k, 2, 4) * (y1 - y0 - WALL - 3));
    a.set(x, y, GRASS[3]);
  }
  const items: { y: number; draw: () => void }[] = [];
  // The parterre: four hedge beds round the fountain.
  for (const [hx0, hy0, hx1, hy1] of [[40, 41, 56, 44], [68, 41, 84, 44], [40, 50, 56, 53], [68, 50, 84, 53]]) items.push({ y: hy1, draw: () => hedge(a, hx0, hy0, hx1, hy1, hx0 + hy0, true) });
  // The fountain.
  const fx = 62;
  const fy = 47;
  items.push({
    y: fy + 3,
    draw: () => {
      softShadow(a, fx + 3, fy + 2, 7, 2.5, 0.75);
      piece(a, fx - 7, fy - 9, 15, 13, (p) => {
        p.oval(8, 9, 7, 3.4, (x, y, nx, ny) => (nx * nx + ny * ny > 0.5 ? tone(MARBLE, 0.7 - nx * 0.3 - ny * 0.2, x, y) : tone(ramp('#3e5c8c', '#6a90b8', '#a8c8dc', '#e8f4f4'), 0.5 - ny * 0.3 + ((x + y) % 4 === 0 ? 0.3 : 0), x, y)));
        p.rect(7, 3, 8, 8, (px) => (px === 7 ? MARBLE[3] : MARBLE[1]));
        p.oval(8, 3, 3, 1.3, (x, y, nx) => tone(MARBLE, 0.7 - nx * 0.3, x, y));
        p.set(8, 1, hex('#e8f8ff'));
        p.set(7, 0, hex('#bfe4f0'));
        p.set(9, 0, hex('#bfe4f0'));
      });
    },
  });
  // The stairs down into the court through its south rim.
  for (let y = y1 - 3; y <= y1 + 4; y++) {
    for (let x = 57; x <= 67; x++) {
      if (x === 57 || x === 67) a.set(x, y, tone(SAND, x === 57 ? 0.85 : 0.35, x, y));
      else a.set(x, y, tone(SAND, (y - y1) % 2 === 0 ? 0.8 - (x - 57) * 0.02 : 0.32, x, y));
    }
  }
  // Hedges and topiary on the grass round the court.
  items.push({ y: 29, draw: () => hedge(a, 38, 25, 86, 29, 7, true) });
  for (const [x, y] of [[28, 40], [96, 40], [28, 54], [96, 54]] as [number, number][]) items.push({ y, draw: () => tree(a, x, y, 'meadow', 3, x * 7 + y) });
  for (const [x, y, h, br] of [[24, 46, 9, false], [101, 47, 6, true], [46, 64, 5, true]] as [number, number, number, boolean][]) items.push({ y, draw: () => pillar(a, x, y, h, br, MARBLE) });
  items.push({ y: 30, draw: () => tree(a, 18, 30, 'sakura', 5, 77) });
  items.push({ y: 32, draw: () => tree(a, 104, 32, 'oak', 5, 78) });
  items.sort((p, q) => p.y - q.y).forEach((i) => i.draw());
  // A spout through the south rim, where the fountain's water leaves.
  let ox = 84;
  while (b.rim[ox] < 0) ox--;
  return {
    art: a,
    ax: cx,
    ay: cy,
    rx,
    ry,
    falls: [outlet(a, b, ox)],
    glows: [],
    glints: [{ x: fx + 1, y: fy - 8 }, { x: fx - 3, y: fy + 1 }, { x: fx + 4, y: fy }],
  };
}

/** Glimmerdeep: a hill of dark rock with a cave mouth full of crystal light, crystals hanging beneath. */
function glimmerIsle(): IsleArt {
  const a = new Art(104, 124);
  const cx = 52;
  const cy = 48;
  const rx = 39;
  const ry = 19;
  const b = body(a, { cx, cy, rx, ry, depth: 54, seed: 53, grass: MOSS, rock: DEEP_ROCK, bounce: hex('#c890c8'), roots: 4, spikes: 4 });
  const AMETHYST = ramp('#3a1e6a', '#6a3aa8', '#9a6ae0', '#c8a0ff', '#f4e8ff');
  const TEAL = ramp('#0e3a4a', '#1a6a7a', '#2aa8b4', '#7ae8e8', '#e8ffff');
  // The hill.
  const hill = new Art(a.w, a.h);
  hill.oval(52, 44, 25, 17, (x, y, nx, ny) => {
    if (y > 50) return null;
    if (ny < -1 + valueNoise(x, 0, 4, 5) * 0.5 + Math.abs(nx) * 0.1) return null;
    let v = lit(nx, ny, 0.56) + (valueNoise(x * 2, y, 3, 9) - 0.5) * 0.3;
    if ((y + (x >> 2)) % 5 === 0) v -= 0.1;
    if (ny < -0.5 && hash2(x, y, 2) < 0.4) return tone(MOSS, v, x, y);
    return tone(DEEP_ROCK, v, x, y);
  });
  // The cave's mouth, glowing from within.
  hill.poly([[42, 51], [43, 44], [47, 39], [52, 38], [57, 39], [61, 44], [62, 51]], (x, y) => {
    const d = Math.hypot((x - 52) / 10, (y - 51) / 13);
    return tone(ramp('#0a0618', '#1a1034', '#2e1e5a', '#3a5a9a', '#5ac8d8', '#b8ffff'), 0.95 - d * 1.05, x, y, 0.8);
  });
  hill.outline(hex('#0e0a1c'));
  softShadow(a, 66, 50, 12, 4, 0.7);
  a.stamp(hill, 0, 0);
  // Crystals on the hill and by the mouth.
  for (const [x, y, h, w, p] of [[36, 46, 6, 1, 0], [33, 48, 3, 1, 1], [66, 44, 8, 2, 0], [70, 47, 4, 1, 1], [50, 30, 6, 1, 1], [55, 31, 4, 1, 0], [41, 54, 3, 1, 1], [63, 55, 4, 1, 0]] as [number, number, number, number, number][]) crystal(a, x, y, h, w, p ? TEAL : AMETHYST);
  // Glowcaps on the moss.
  for (const [x, y] of [[24, 50], [78, 52], [30, 58], [72, 60]] as [number, number][]) {
    a.set(x, y, hex('#c8d0e0'));
    a.rect(x - 1, y - 2, x + 1, y - 1, (px, py) => (py === y - 2 ? hex('#b0ffff') : px === x + 1 ? hex('#2aa8c8') : hex('#5af0ff')));
  }
  // Crystals hanging from the rock beneath, the biggest near the middle.
  const rand = rng(57);
  const under: { x: number; y: number }[] = [];
  for (let k = 0; k < 12; k++) {
    const x = Math.round(cx + (rand() * 2 - 1) * rx * 0.75);
    if (b.bottom[x] < 0) continue;
    const t = Math.abs(x - cx) / rx;
    const h = Math.round(3 + rand() * 9 * (1 - t));
    const y = b.bottom[x] - Math.floor(rand() * 4);
    crystal(a, x, y, h, h > 6 ? 2 : 1, k % 3 === 0 ? TEAL : AMETHYST, true);
    under.push({ x, y: y + Math.round(h / 2) });
  }
  return {
    art: a,
    ax: cx,
    ay: cy,
    rx,
    ry,
    falls: [],
    glows: [{ x: 52, y: 46, r: 16, tint: 0x6ae0ff }, ...under.slice(0, 5).map((u, k) => ({ ...u, r: 9, tint: k % 3 === 0 ? 0x6ae8e8 : 0xb880ff }))],
    glints: [{ x: 66, y: 37 }, { x: 36, y: 41 }, ...under.slice(0, 4)],
  };
}

/** Starwatch: a terrace of old stone under the night, a star laid in gold in its floor, a telescope and lamps. */
function starwatchIsle(): IsleArt {
  const a = new Art(108, 100);
  const cx = 54;
  const cy = 42;
  const rx = 43;
  const ry = 20;
  body(a, { cx, cy, rx, ry, depth: 40, seed: 61, grass: NIGHT_GRASS, rock: NIGHT_ROCK, soil: ramp('#1c1622', '#2a2030', '#3a2c3c', '#4a3a48'), bounce: NIGHT_BOUNCE, roots: 5 });
  const STONE = ramp('#24243e', '#30324e', '#40445e', '#545a74', '#6c748c', '#8c94aa', '#b0b8cc');
  const GOLD = ramp('#7a5a2a', '#b88a3a', '#e8c060', '#fff0b0');
  // The terrace: flagstones laid in rings.
  a.oval(cx, cy, 33, 15.5, (x, y, nx, ny) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.9) return tone(STONE, 0.75 - nx * 0.2 - ny * 0.3, x, y);
    const ring = Math.floor(d * 4);
    const ang = Math.atan2(ny, nx);
    const seam = Math.abs(d * 4 - Math.round(d * 4)) < 0.1 || Math.abs(Math.sin(ang * (3 + ring * 3))) < 0.1;
    return tone(STONE, (seam ? 0.25 : 0.55) - nx * 0.15 - ny * 0.12 + (hash2(x, y, 5) < 0.06 ? 0.1 : 0), x, y);
  });
  // The star in the floor: eight gold rays and a ring.
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    const len = k % 2 === 0 ? 10 : 6;
    for (let i = 1; i <= len; i++) a.set(Math.round(cx + Math.cos(ang) * i), Math.round(cy + Math.sin(ang) * i * 0.48), GOLD[i < 3 ? 3 : 2]);
  }
  for (let k = 0; k < 40; k++) {
    const ang = (k / 40) * Math.PI * 2;
    a.set(Math.round(cx + Math.cos(ang) * 7), Math.round(cy + Math.sin(ang) * 3.4), GOLD[1]);
  }
  a.set(cx, cy, GOLD[3]);
  const items: { y: number; draw: () => void }[] = [];
  // The balustrade along the terrace's front.
  items.push({
    y: cy + 15,
    draw: () => {
      for (let k = 0; k <= 24; k++) {
        const ang = Math.PI * 0.12 + (k / 24) * Math.PI * 0.76;
        const x = Math.round(cx + Math.cos(ang) * 33);
        const y = Math.round(cy + Math.sin(ang) * 15.5);
        a.set(x, y - 2, STONE[6]);
        a.set(x, y - 1, k % 3 === 0 ? STONE[4] : STONE[2]);
        a.set(x, y, k % 3 === 0 ? STONE[3] : STONE[1]);
      }
    },
  });
  // A telescope on its tripod, aimed at the sky.
  items.push({
    y: cy - 2,
    draw: () => {
      softShadow(a, 76, cy - 1, 4, 1.4, 0.7);
      piece(a, 68, cy - 14, 12, 13, (p) => {
        p.line(6, 8, 3, 13, hex('#5a4030'));
        p.line(7, 8, 7, 13, hex('#3a2a20'));
        p.line(8, 8, 11, 13, hex('#5a4030'));
        for (let i = 0; i < 9; i++) {
          p.set(2 + i, 9 - i, GOLD[2]);
          p.set(3 + i, 9 - i, GOLD[1]);
          if (i > 5) p.set(2 + i, 8 - i, GOLD[3]);
        }
      });
    },
  });
  // A stone bench to sit on and say nothing.
  items.push({
    y: cy - 8,
    draw: () =>
      piece(a, 30, cy - 11, 9, 4, (p) => {
        p.rect(1, 1, 9, 2, (px, py) => tone(STONE, py === 1 ? 0.85 : 0.6, px, py));
        p.rect(2, 3, 2, 4, () => STONE[2]);
        p.rect(8, 3, 8, 4, () => STONE[2]);
      }),
  });
  const lamps: { x: number; y: number }[] = [];
  items.push({ y: cy + 6, draw: () => lamps.push(lampPost(a, cx - 27, cy + 6, false)) });
  items.push({ y: cy + 8, draw: () => lamps.push(lampPost(a, cx + 26, cy + 8, false)) });
  items.sort((p, q) => p.y - q.y).forEach((i) => i.draw());
  return {
    art: a,
    ax: cx,
    ay: cy,
    rx,
    ry,
    falls: [],
    glows: [...lamps.map((l) => ({ ...l, r: 10, tint: 0xb8c8ff })), { x: cx, y: cy, r: 12, tint: 0xffe0a0 }],
    glints: [{ x: cx, y: cy }, { x: cx + 10, y: cy }, { x: cx - 10, y: cy }, { x: 79, y: cy - 13 }],
  };
}

/** A place with no picture of its own yet: a grassy isle with a few trees and a waymarker. */
function genericIsle(): IsleArt {
  const a = new Art(88, 88);
  const cx = 44;
  const cy = 38;
  const rx = 33;
  const ry = 16;
  const b = body(a, { cx, cy, rx, ry, depth: 32, seed: 71 });
  vines(a, b, 72, 4);
  const rand = rng(73);
  for (let k = 0; k < 20; k++) {
    const px = Math.round(cx + (rand() * 2 - 1) * 30);
    const py = Math.round(cy + (rand() * 2 - 1) * 14);
    if (b.inTop(px, py, 2)) a.set(px, py, [hex('#fff4e0'), hex('#ffd860'), hex('#ff9ab8')][k % 3]);
  }
  const items: { y: number; draw: () => void }[] = [];
  for (const [x, y, k, r] of [[26, 32, 'oak', 6], [60, 30, 'birch', 4], [66, 40, 'pine', 4], [20, 44, 'meadow', 3]] as [number, number, TreeKind, number][]) items.push({ y, draw: () => tree(a, x, y, k, r, x + y) });
  let mark = { x: 0, y: 0 };
  items.push({ y: cy + 4, draw: () => (mark = waymarker(a, cx + 2, cy + 4)) });
  items.sort((p, q) => p.y - q.y).forEach((i) => i.draw());
  let fx = 30;
  while (b.rim[fx] < 0) fx++;
  return { art: a, ax: cx, ay: cy, rx, ry, falls: [outlet(a, b, fx)], glows: [{ ...mark, r: 8, tint: 0xffd080 }], glints: [mark] };
}

/** Each place's painter, by place id; `generic` for any place not listed. */
export const ISLE_ART: Record<string, () => IsleArt> = {
  home: homeIsle,
  everwood: everwoodIsle,
  cloudrest: cloudrestIsle,
  garden: gardenIsle,
  glimmerdeep: glimmerIsle,
  starwatch: starwatchIsle,
  generic: genericIsle,
};

/** The island's shadow on the clouds below: its outline, softened, in a few dithered steps. */
export function isleShadow(isle: IsleArt): Art {
  const src = isle.art;
  // The shadow is of the island's top: squashed a little, as it falls on the clouds at a slant.
  const pad = 4;
  const w = Math.ceil(isle.rx * 2 + pad * 2 + 4);
  const h = Math.ceil(isle.ry * 2 * 0.9 + pad * 2 + 4);
  const out = new Art(w, h);
  const ccx = w / 2;
  const ccy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Fraction of the island's top within a few px (an average over a small disc).
      let hit = 0;
      let all = 0;
      for (let dy = -3; dy <= 3; dy += 1.5) {
        for (let dx = -3; dx <= 3; dx += 1.5) {
          all++;
          const sx = Math.round(isle.ax + (x + dx - ccx));
          const sy = Math.round(isle.ay + (y + dy - ccy) / 0.9);
          if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h && src.alpha(sx, sy) > 0 && Math.abs(sy - isle.ay) <= isle.ry + 1) hit++;
        }
      }
      const f = smooth(0.05, 0.9, hit / all);
      const q = Math.floor(f * 3 + bayer(x, y) * 0.999) / 3;
      if (q > 0) out.set(x, y, hex('#2a1c4a'), Math.round(q * 150));
    }
  }
  return out;
}

/** A soft gold ring round an island's top, for when it's picked (drawn additively). */
export function isleHalo(isle: IsleArt): Art {
  const rx = isle.rx + 7;
  const ry = isle.ry + 5;
  const w = Math.ceil(rx * 2 + 6);
  const h = Math.ceil(ry * 2 + 6);
  const out = new Art(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / rx, (y + 0.5 - h / 2) / ry);
      // A thin bright ring with a soft dithered falloff each side, brightest at the back.
      const ring = Math.max(0, 1 - Math.abs(d - 1) * 9);
      const soft = Math.max(0, 1 - Math.abs(d - 0.96) * 3.2) * 0.45;
      const v = Math.max(ring, soft);
      const q = Math.floor(v * 4 + bayer(x, y) * 0.999) / 4;
      if (q > 0) out.set(x, y, hex('#ffd890'), Math.round(q * 255));
    }
  }
  return out;
}
