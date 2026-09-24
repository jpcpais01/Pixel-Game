// Magic effects: the energy ball, its impact burst, and small helper sprites.
// These are pure light, so they only produce emissive pixels.

import { PixelCanvas, type RGB } from './pixel';
import { EMBER_CORE, EMBER_DEEP, EMBER_HOT, EMBER_MID, MAGIC_CORE, MAGIC_DEEP, MAGIC_HOT, MAGIC_MID, MAGIC_VIOLET, HOLY_CORE, HOLY_HOT, HOLY_MID, HOLY_SKY, VOID_CORE, VOID_DEEP, VOID_HOT, VOID_MID, VOID_TEAL } from './palette';

/** Colours of a spell, brightest first; `accent` is the contrasting fleck. */
export interface SpellColors {
  core: RGB;
  hot: RGB;
  mid: RGB;
  deep: RGB;
  accent: RGB;
  /** A hollow orb: a bright ring around a dim heart (the void look). */
  hollow?: boolean;
}

export const ARCANE_SPELL: SpellColors = { core: MAGIC_CORE, hot: MAGIC_HOT, mid: MAGIC_MID, deep: MAGIC_DEEP, accent: MAGIC_VIOLET };
export const VOID_SPELL: SpellColors = { core: VOID_CORE, hot: VOID_HOT, mid: VOID_MID, deep: VOID_DEEP, accent: VOID_TEAL, hollow: true };

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const ORB_SIZE = 16;
export const ORB_FRAMES = 4;

/**
 * Energy ball: white-hot core, bright body, flickering deep halo, two orbiting motes.
 * A hollow orb swaps the core for a dim heart inside a blazing ring.
 */
export function orbFrame(f: number, k: SpellColors = ARCANE_SPELL): PixelCanvas {
  const c = new PixelCanvas(ORB_SIZE, ORB_SIZE);
  const cx = 8;
  const cy = 8;
  const pulse = f % 2 === 0 ? 0 : 0.35;
  for (let y = 0; y < ORB_SIZE; y++) {
    for (let x = 0; x < ORB_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (k.hollow && d <= 1.6) c.spark(x, y, k.deep, 0.7);
      else if (d <= 1.6) c.spark(x, y, k.core, 1);
      else if (d <= 2.9) c.spark(x, y, k.hollow ? k.core : k.hot, 1);
      else if (d <= 4.0 + pulse) c.spark(x, y, k.hollow ? k.hot : k.mid, 0.85);
      else if (d <= 5.4 + pulse && hash(x, y, f) > 0.35) c.spark(x, y, k.hollow ? k.mid : k.deep, 0.55);
      else if (d <= 6.6 && hash(x, y, f + 9) > 0.86) c.spark(x, y, k.deep, 0.35);
    }
  }
  for (let m = 0; m < 2; m++) {
    const a = ((f * 45 + m * 180) * Math.PI) / 180;
    c.spark(cx + Math.cos(a) * 5.6, cy + Math.sin(a) * 5.6, k.hollow ? k.accent : k.hot, 1);
    c.spark(cx + Math.cos(a - 0.5) * 5.6, cy + Math.sin(a - 0.5) * 5.6, k.mid, 0.5);
  }
  return c;
}

export const BURST_SIZE = 32;
export const BURST_FRAMES = 7;

/** Impact: a flash, an expanding shock ring and sparks flung outward. */
export function burstFrame(f: number, k: SpellColors = ARCANE_SPELL): PixelCanvas {
  const c = new PixelCanvas(BURST_SIZE, BURST_SIZE);
  const cx = 16;
  const cy = 16;
  const t = f / (BURST_FRAMES - 1);
  const r = 2.5 + f * 2.0;
  const thick = Math.max(0.7, 2.2 - f * 0.3);
  const ringCol: RGB = f < 2 ? k.hot : f < 4 ? k.mid : k.deep;
  for (let y = 0; y < BURST_SIZE; y++) {
    for (let x = 0; x < BURST_SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (f <= 1 && d <= 3.6 - f * 1.2) c.spark(x, y, k.core, 1);
      else if (f <= 2 && d <= 5 - f) c.spark(x, y, k.hot, 0.7);
      if (Math.abs(d - r) <= thick / 2 && hash(x, y, f) > t * 0.55) c.spark(x, y, ringCol, 1 - t * 0.6);
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + hash(i, 1) * 0.5;
    const dist = r + 1.5 + hash(i, 2) * 3;
    const col = i % 3 === 0 ? k.accent : k.hot;
    if (f < BURST_FRAMES - 1) c.spark(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, col, 1 - t);
  }
  return c;
}

/** Banded radial halo, drawn additively and tinted at runtime. */
export function glowCanvas(size = 32): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const bands = [
    [0.22, 0.55],
    [0.4, 0.3],
    [0.62, 0.15],
    [0.86, 0.07],
    [1.0, 0.03],
  ];
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      const band = bands.find((b) => d <= b[0]);
      const a = band ? band[1] : 0;
      const i = (y * size + x) * 4;
      // Premultiplied white: brightness carries the falloff for ADD blending.
      px[i] = px[i + 1] = px[i + 2] = Math.round(255 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** Soft two-band contact shadow. */
export function shadowCanvas(w = 16, h = 6): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const d = dx * dx + dy * dy;
      const i = (y * w + x) * 4;
      px[i] = 8;
      px[i + 1] = 6;
      px[i + 2] = 20;
      px[i + 3] = d <= 0.45 ? 150 : d <= 1 ? 90 : 0;
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// Sky: cloud shadows, sun shafts, motes and the day/night icons.

/** Tileable value noise: lattice wraps every `period` cells. */
function tileNoise(x: number, y: number, cell: number, period: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const h = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period, seed);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Soft, banded cloud shadows that tile seamlessly (size must divide by 64). */
export function cloudShadowCanvas(size = 256): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n =
        tileNoise(x, y, 64, size / 64, 1) * 0.6 + tileNoise(x, y, 32, size / 32, 2) * 0.28 + tileNoise(x, y, 16, size / 16, 3) * 0.12;
      const a = n > 0.66 ? 0.26 : n > 0.6 ? 0.17 : n > 0.56 ? 0.08 : 0;
      const i = (y * size + x) * 4;
      px[i] = 18;
      px[i + 1] = 26;
      px[i + 2] = 58;
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

/** Diagonal shafts of sunlight (drawn additively, very faint). */
export function sunShaftCanvas(w = 256, h = 256): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  const shafts = [
    { at: 40, width: 18, a: 0.5 },
    { at: 92, width: 9, a: 0.35 },
    { at: 150, width: 26, a: 0.45 },
    { at: 205, width: 12, a: 0.3 },
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Rays run from the top-left toward the bottom-right.
      const u = x - y * 0.55;
      let a = 0;
      for (const s of shafts) {
        const d = Math.abs(u - s.at) / s.width;
        if (d < 1) a = Math.max(a, (d < 0.5 ? 1 : 0.55) * s.a);
      }
      a *= Math.max(0, 1 - y / h) ** 0.7; // fade toward the bottom
      const i = (y * w + x) * 4;
      px[i] = Math.round(255 * a);
      px[i + 1] = Math.round(236 * a);
      px[i + 2] = Math.round(190 * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** 12x12 pixel sun and moon icons for the time-of-day toggle. */
export function skyIcon(kind: 'sun' | 'moon'): Uint8ClampedArray {
  const S = 12;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 6;
      const dy = y + 0.5 - 6;
      const d = Math.hypot(dx, dy);
      if (kind === 'sun') {
        if (d <= 2.6) put(x, y, dx + dy < -1.5 ? '#fff6c8' : '#ffd24a');
        else if (d <= 3.4) put(x, y, '#f29a2e');
      } else {
        const cut = Math.hypot(dx - 1.8, dy + 1.4);
        if (d <= 4.4 && cut > 3.4) put(x, y, dx < -2 && dy < 1 ? '#f2f0ff' : '#c9c8f0');
      }
    }
  }
  if (kind === 'sun') {
    for (const [x, y] of [
      [6, 0], [5, 0], [6, 11], [5, 11], [0, 5], [0, 6], [11, 5], [11, 6],
      [2, 2], [9, 2], [2, 9], [9, 9],
    ]) put(x, y, '#ffc23a');
  } else {
    put(9, 2, '#ffffff');
    put(10, 5, '#b8c0ff');
    put(8, 9, '#dfe4ff');
  }
  return px;
}

/** 16x16 icon for the beam button: a ray of light bursting from a star, with a strand of the accent colour, drawn additively. */
export function beamIcon(k: SpellColors = ARCANE_SPELL): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const cols: RGB[] = [k.core, k.hot, k.mid, k.deep, k.accent];
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    // Keep the brighter colour where shapes overlap.
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  // The ray runs from the lower left to the upper right, widening as it goes.
  const ox = 3.5;
  const oy = 12.5;
  const ux = Math.SQRT1_2;
  const uy = -Math.SQRT1_2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const rx = x + 0.5 - ox;
      const ry = y + 0.5 - oy;
      const along = rx * ux + ry * uy;
      const side = rx * uy - ry * ux;
      if (along < 0 || along > 14) continue;
      const w = 0.6 + along * 0.14;
      const d = Math.abs(side) / w;
      if (d <= 0.5) put(x, y, cols[0]);
      else if (d <= 1.1) put(x, y, cols[1]);
      else if (d <= 1.7) put(x, y, cols[2]);
      else if (d <= 2.3 && hash(x, y, 4) > 0.3) put(x, y, cols[3]);
      // A violet strand winding round the ray.
      if (Math.abs(side - Math.sin(along * 0.9) * w * 1.9) < 0.5 && d > 1) put(x, y, cols[4]);
    }
  }
  // Star at the source.
  const sx = Math.floor(ox);
  const sy = Math.floor(oy);
  for (let i = -3; i <= 3; i++) {
    const c = Math.abs(i) <= 1 ? cols[0] : cols[1];
    put(sx + i, sy, c);
    put(sx, sy + i, c);
  }
  for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) put(sx + dx, sy + dy, cols[2]);
  return px;
}

/** Colours for the sword icon: blade (lit, shaded, tip), guard (lit, highlight, dark), grip and outline. */
export interface SwordIconColors {
  blade: string;
  bladeDark: string;
  tip: string;
  guard: string;
  guardLit: string;
  guardDark: string;
  grip: string;
  ink: string;
  /** A short round tsuba and a longer grip. */
  katana?: boolean;
}

const KNIGHT_SWORD_ICON: SwordIconColors = {
  blade: '#dfe8f7',
  bladeDark: '#8d9dbd',
  tip: '#f4f8ff',
  guard: '#f4cf6a',
  guardLit: '#fff4bf',
  guardDark: '#d69a3a',
  grip: '#8f5a36',
  ink: '#0c0f18',
};

/** The jade warrior's katana: pale green-tempered steel, a short gold tsuba, a long jade grip. */
export const JADE_SWORD_ICON: SwordIconColors = {
  blade: '#d6ece5',
  bladeDark: '#82a39b',
  tip: '#f2fffa',
  guard: '#f4cf6a',
  guardLit: '#fff4bf',
  guardDark: '#d69a3a',
  grip: '#22845e',
  ink: '#040907',
  katana: true,
};

/** 16x16 sword for the warrior's attack button: steel blade, gold guard, dark outline (normal blend). */
export function swordIcon(k: SwordIconColors = KNIGHT_SWORD_ICON): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // Blade from the lower left up to the upper right, a lit and a shaded bevel.
  for (let i = 0; i < 9; i++) {
    put(5 + i, 10 - i, i > 6 ? k.tip : k.blade);
    put(6 + i, 10 - i, k.bladeDark);
  }
  put(14, 1, k.tip);
  // Crossguard, grip and pommel.
  if (k.katana) {
    for (const [x, y] of [[3, 10], [4, 11], [5, 12]]) put(x, y, k.guard);
    put(3, 10, k.guardLit);
    for (const [x, y] of [[3, 12], [2, 13], [1, 14]]) put(x, y, k.grip);
    put(0, 15, k.guard);
  } else {
    for (const [x, y] of [[2, 9], [3, 10], [4, 11], [5, 12], [6, 13]]) put(x, y, k.guard);
    put(3, 9, k.guardLit);
    for (const [x, y] of [[3, 12], [2, 13]]) put(x, y, k.grip);
    put(1, 14, k.guardDark);
  }
  // Outline.
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, k.ink);
  return px;
}

/** 16x16 icon for the whirlwind button: a spiral of golden fire around a bright heart, drawn additively. */
export function whirlIcon(cols: RGB[] = [EMBER_CORE, EMBER_HOT, EMBER_MID, EMBER_DEEP]): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  // Two crescents chasing each other round the centre, thick and hot at their heads.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const r = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) / Math.PI + 1) * 180; // 0..360
      for (const head of [40, 220]) {
        const behind = (((head - a) % 360) + 360) % 360;
        if (behind > 170) continue;
        const k = 1 - behind / 170;
        const rr = 3 + 4.3 * (1 - behind / 170) ** 0.6;
        const d = Math.abs(r - rr);
        const th = 0.45 + k * 1.1;
        if (d <= th * 0.45) put(x, y, k > 0.7 ? cols[0] : cols[1]);
        else if (d <= th) put(x, y, k > 0.45 ? cols[1] : cols[2]);
        else if (d <= th + 0.6 && k > 0.2 && hash(x, y, 3) > 0.4) put(x, y, cols[3]);
      }
      if (r <= 1.3) put(x, y, cols[0]);
      else if (r <= 2.1) put(x, y, cols[1]);
    }
  }
  return px;
}

/** 16x16 mace for the paladin's attack button: a flanged steel head with a spike, gold bands, dark outline. */
export function maceIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * S + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // Haft from the lower left up toward the head.
  for (let i = 0; i < 8; i++) put(2 + i, 13 - i, i < 3 ? '#6a3d26' : i === 5 ? '#f4cf6a' : '#a9774c');
  put(1, 14, '#d69a3a');
  // Head: a round steel ball lit from the upper left.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 11;
      const dy = y + 0.5 - 5;
      const d = Math.hypot(dx, dy);
      if (d <= 2.9) put(x, y, dx + dy < -2.2 ? '#eef2fb' : dx + dy < 0.6 ? '#bcc6dc' : d > 2.2 ? '#48536f' : '#7f8ba8');
    }
  }
  // Gold flanges across the head and a spike out of the top.
  for (const [x, y] of [[7, 3], [8, 2], [13, 8], [14, 9], [8, 8], [7, 9], [14, 2], [13, 3]]) put(x, y, '#f4cf6a');
  put(12, 1, '#fff4bf');
  put(13, 0, '#fff4bf');
  put(11, 4, '#ffffff');
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] === 255;
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) put(x, y, '#0e1120');
  return px;
}

/** 16x16 icon for the consecration button: a ring of holy light on the ground under a rising sun cross, drawn additively. */
export function sanctuaryIcon(): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  const cols: RGB[] = [HOLY_CORE, HOLY_HOT, HOLY_MID, HOLY_SKY];
  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    if (px[i] + px[i + 1] + px[i + 2] >= c[0] + c[1] + c[2]) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // The ring, seen at an angle, low in the icon.
      const q = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 11.5) / 3.6);
      if (Math.abs(q - 0.9) < 0.1) put(x, y, y > 11 ? cols[1] : cols[2]);
      else if (Math.abs(q - 0.72) < 0.08 && hash(x, y, 5) > 0.45) put(x, y, cols[3]);
    }
  }
  // The cross rising from its centre, with a bright heart.
  for (let y = 2; y <= 12; y++) put(8, y, y < 5 || y > 9 ? cols[1] : cols[0]);
  for (let y = 3; y <= 10; y++) put(7, y, cols[2]);
  for (let x = 4; x <= 11; x++) put(x, 5, x > 5 && x < 10 ? cols[0] : cols[1]);
  for (let x = 5; x <= 10; x++) put(x, 6, cols[2]);
  for (const [x, y] of [[3, 2], [12, 3], [5, 9], [11, 8]]) put(x, y, cols[3]);
  return px;
}
