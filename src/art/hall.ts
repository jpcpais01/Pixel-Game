// The home screen's Hall of Legends: a grand stone hall in the late afternoon. Sunlight
// pours through tall arched windows in the back wall, lands on the arena floor
// in bright window-shaped patches (with the mullions' and ivy's shadows in
// them) and bounces back up to warm the walls. Between the windows stand
// marble statues of old heroes, backlit so their edges glow, and a great gate
// opens onto a bright corridor in the middle.
//
// Everything is painted per pixel with a small light model: each pixel gets a
// material and a light level, and the level picks a colour from that
// material's ramp (deep cool shadow up to warm near-white). The direct sun is
// painted into its own layer, and the light shafts into two more, so the home
// scene can let clouds dim and brighten the sun, shimmer the shafts, and fill
// them with dust.

import { hex, type RGB } from './pixel';
import { rng } from './env';
import { Bitmap, bayer, clamp01 } from './bitmap';

const STONE = 1;
const MARBLE = 2;
const GOLD = 3;
const SAND = 4;
const TILE = 5;
const SKY = 6;
const DARK = 7;
const CLOTH = 8;
const LEAF = 9;

const ramp = (...c: string[]) => c.map(hex);
/** Colour ramps per material, darkest first; the light level (0..1) picks one. */
const RAMPS: RGB[][] = [
  [],
  ramp('#140f1c', '#221a2c', '#33273a', '#4a3844', '#6a4e52', '#946c5e', '#c99c78', '#f3d3a2', '#fff4dc'),
  ramp('#1c1622', '#2e2432', '#463846', '#645058', '#8a706c', '#b49484', '#d8b8a0', '#f2d8bc', '#fff2e0'),
  ramp('#2a170f', '#472812', '#6e3f16', '#9a5e1e', '#c7872c', '#e9b347', '#fad775', '#fff0b4', '#fffbe6'),
  ramp('#241a1f', '#382a2c', '#533f38', '#775a46', '#a27a58', '#c99e6c', '#ecc68c', '#fde3b0', '#fff6e0'),
  ramp('#18131f', '#262030', '#393040', '#524450', '#735e62', '#9c7f74', '#c9a78e', '#f0d4b0', '#fff4e0'),
  ramp('#4a3a7a', '#6a4a8e', '#8e5a98', '#b46a98', '#d88090', '#f09a80', '#fbb878', '#ffd490', '#fff0c8'),
  ramp('#07050b', '#0d0a14', '#15101e', '#1f1829', '#2b2135', '#3a2d42', '#57414f', '#86655e', '#c09a7a'),
  ramp('#16060d', '#290b17', '#431221', '#641a2c', '#8c2634', '#b53c3c', '#dd6446', '#f79a66', '#ffd3a0'),
  ramp('#0d1614', '#15241f', '#1f3629', '#2c4d33', '#3f683b', '#5c8a45', '#86ad55', '#bcd27a', '#eaf0b4'),
];

/** Screen-space slant of the sunlight: x px per px down. */
const SLANT = 0.38;
/** How much the light spreads as it travels (perspective). */
const SPREAD = 1.0;
/** What the direct sun adds to a lit floor pixel's light level. */
const SUN = 0.36;

function hash(i: number, s: number): number {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise. */
function noise(x: number, s: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const u = t * t * (3 - 2 * t);
  const a = hash(i, s);
  return a + (hash(i + 1, s) - a) * u;
}

type Pt = [number, number];

/** Per-pixel material, light level and object id; painted back to front. */
class Canvas {
  readonly mat: Uint8Array;
  readonly lum: Float32Array;
  readonly obj: Uint8Array;
  /** Floor surfaces, which catch the sun patches. */
  readonly recv: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.mat = new Uint8Array(w * h);
    this.lum = new Float32Array(w * h);
    this.obj = new Uint8Array(w * h);
    this.recv = new Uint8Array(w * h);
  }

  put(x: number, y: number, m: number, l: number, o = 0, recv = 0): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.mat[i] = m;
    this.lum[i] = l;
    this.obj[i] = o;
    this.recv[i] = recv;
  }

  /** Nudge the light level of whatever is at (x, y). */
  add(x: number, y: number, dl: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.lum[y * this.w + x] += dl;
  }

  objAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.obj[y * this.w + x];
  }

  matAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.mat[y * this.w + x];
  }

  /** Scanline-fill a polygon, calling `fn` for each pixel whose centre is inside. */
  poly(pts: Pt[], fn: (x: number, y: number) => void): void {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    const xs: number[] = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
          xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5)); x++) fn(x, y);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number) => void): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) fn(x, y);
      }
    }
  }

  rect(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(this.h, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(this.w, Math.round(x1)); x++) fn(x, y);
    }
  }
}

/** An opening with straight sides and a round arch on top. */
interface Arch {
  cx: number;
  /** Half the width. */
  hw: number;
  /** Top of the arch. */
  top: number;
  bottom: number;
}

/** Is (x, y) inside the arch grown by `g` px (negative shrinks it)? */
function inArch(a: Arch, x: number, y: number, g = 0): boolean {
  const dx = x + 0.5 - a.cx;
  const r = a.hw + g;
  const spring = a.top + a.hw;
  const py = y + 0.5;
  if (py > a.bottom + Math.max(0, g) || Math.abs(dx) > r) return false;
  if (py >= spring) return true;
  return dx * dx + (py - spring) ** 2 <= r * r;
}

/**
 * Blur a mask down to a soft light map: `cell` px per cell, box blur of
 * `radius` cells, `passes` times. Returns a bilinear sampler scaled so the
 * brightest cell reads 1.
 */
function lightMap(w: number, h: number, src: (i: number) => number, cell: number, radius: number, passes: number) {
  const gw = Math.ceil(w / cell) + 1;
  const gh = Math.ceil(h / cell) + 1;
  const g = new Float32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = src(y * w + x);
      if (v) g[Math.floor(y / cell) * gw + Math.floor(x / cell)] += v / (cell * cell);
    }
  }
  const tmp = new Float32Array(gw * gh);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += g[y * gw + Math.min(gw - 1, Math.max(0, x + k))];
        tmp[y * gw + x] = s / (radius * 2 + 1);
      }
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += tmp[Math.min(gh - 1, Math.max(0, y + k)) * gw + x];
        g[y * gw + x] = s / (radius * 2 + 1);
      }
    }
  }
  let max = 1e-6;
  for (const v of g) max = Math.max(max, v);
  const out = g;
  return (x: number, y: number): number => {
    const fx = Math.max(0, Math.min(gw - 1.001, (x + 0.5) / cell - 0.5));
    const fy = Math.max(0, Math.min(gh - 1.001, (y + 0.5) / cell - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * gw + x0;
    const a = out[i] + (out[i + 1] - out[i]) * tx;
    const b = out[i + gw] + (out[i + gw + 1] - out[i + gw]) * tx;
    return (a + (b - a) * ty) / max;
  };
}

export interface HallArt {
  /** The hall in its ambient and bounced light. */
  base: Bitmap;
  /** What the direct sun adds on top (for additive blending). */
  sun: Bitmap;
  /** Two variants of the light shafts (additive), to cross-fade. */
  shafts: [Bitmap, Bitmap];
  /** Sample light rays as x0, y0, x1, y1 quadruples, to seed dust along. */
  rays: Float32Array;
  /** The windows' openings, for glow sprites. */
  windows: { x: number; y: number; w: number; h: number }[];
}

type Pose = 'sword' | 'staff' | 'shield' | 'raised';

/** Paint the hall for a `w` x `h` view (art px). */
export function paintHall(w: number, h: number): HallArt {
  const c = new Canvas(w, h);
  const r = rng(7);

  const ceilY = Math.round(h * 0.075);
  const floorY = Math.round(h * 0.64);
  /** Top of the floor proper, below the two steps. */
  const fy = floorY + 9;
  const winT = Math.round(h * 0.15);
  const winB = Math.round(h * 0.46);
  const winHw = Math.max(6, Math.round(Math.min(w * 0.035, h * 0.08)));
  const windows: Arch[] = [0.1, 0.27, 0.73, 0.9].map((f) => ({ cx: Math.round(w * f) + 0.5, hw: winHw, top: winT, bottom: winB }));
  const F = Math.round(Math.min(h * 0.3, w * 0.2));
  const plinthH = Math.round(F * 0.24);
  const gate: Arch = { cx: w / 2, hw: Math.round(Math.min(w * 0.065, h * 0.15)), top: Math.round(h * 0.3), bottom: floorY };

  // --- Back wall, frieze and ceiling ------------------------------------
  for (let y = 0; y < floorY; y++) {
    for (let x = 0; x < w; x++) {
      if (y < ceilY) {
        // Coffered ceiling, deep in shadow; each coffer's lower lip catches a little bounce.
        const cx = x % 20;
        const cy = y % 10;
        let l = 0.1;
        if (cx < 2 || cy < 2) l = 0.15;
        else if (cy === 9 || cx === 19) l = 0.13;
        else if (cy === 8) l = 0.1;
        else l = 0.06;
        c.put(x, y, STONE, l);
      } else if (y < ceilY + 11) {
        const k = y - ceilY;
        let m = STONE;
        let l = 0.16;
        if (k === 0) l = 0.24;
        else if (k === 1) l = x % 3 === 0 ? 0.08 : 0.22; // dentils
        else if (k === 2) l = 0.12;
        else if (k === 4 || k === 10) {
          m = GOLD;
          l = 0.3;
        } else if (k > 4 && k < 10) {
          // A band of gold lozenges.
          const d = Math.abs((x % 8) - 3.5) + Math.abs(k - 7);
          if (d <= 2.5 && d > 1.4) {
            m = GOLD;
            l = 0.26;
          } else l = 0.12;
        } else l = 0.2;
        c.put(x, y, m, l);
      } else {
        // Ashlar blocks: courses 7 px tall, staggered joints.
        const course = Math.floor((y - ceilY) / 7);
        const bx = x + (course % 2) * 7;
        const block = Math.floor(bx / 14);
        let l = 0.24 + 0.08 * ((y - ceilY) / (floorY - ceilY)) + (hash(block * 97 + course, 3) - 0.5) * 0.05;
        if ((y - ceilY) % 7 === 6 || bx % 14 === 13) l -= 0.05;
        else if ((y - ceilY) % 7 === 0) l += 0.02;
        c.put(x, y, STONE, l);
      }
    }
  }
  // A skirting course along the wall's foot.
  c.rect(0, floorY - 6, w, floorY, (x, y) => c.put(x, y, STONE, y === floorY - 6 ? 0.36 : y === floorY - 5 ? 0.3 : 0.24));

  // --- Windows ------------------------------------------------------------
  for (const win of windows) {
    const x0 = Math.floor(win.cx - win.hw - 5);
    const x1 = Math.ceil(win.cx + win.hw + 5);
    for (let y = win.top - 5; y <= win.bottom + 4; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inArch(win, x, y, 4)) continue;
        if (!inArch(win, x, y, 0)) {
          // Moulded surround, and a sill whose top edge catches the bounce.
          const sill = y >= win.bottom;
          let l = inArch(win, x, y, 2) ? 0.36 : 0.3;
          if (sill) l = y === win.bottom ? 0.5 : y === win.bottom + 1 ? 0.34 : 0.22;
          c.put(x, y, STONE, l);
          continue;
        }
        const dx = x + 0.5 - win.cx;
        // The embrasure: the left jamb faces away from the sun, the right one is sunlit.
        if (!inArch(win, x, y, -2)) {
          c.put(x, y, STONE, dx < 0 ? 0.3 : 0.62);
          continue;
        }
        const t = (y - win.top) / (win.bottom - win.top);
        // The sky: a late-afternoon violet overhead, burning gold toward the horizon, brightest on the sun's side.
        let l = 0.2 + t * 0.55 + (1 - win.cx / w) * 0.12;
        const cloud = noise(x / 9, 5) * 0.6 + noise(x / 4 + y / 3, 6) * 0.4;
        if (cloud > 0.62 && t < 0.6) l += 0.22;
        // Distant hills and the spires of a far city.
        const horizon = win.bottom - (win.bottom - win.top) * 0.22 + noise(x / 7, 8) * 4;
        const spire = hash(x >> 1, 9) > 0.9 ? 4 + hash(x >> 1, 10) * 10 : 0;
        if (y > horizon) l = 0.34 - (y - horizon) * 0.012;
        else if (y > horizon - spire) l = 0.44;
        c.put(x, y, SKY, clamp01(l));
      }
    }
    // Mullion and transom, dark against the sky.
    const spring = win.top + win.hw;
    for (let y = win.top; y < win.bottom; y++) {
      const x = Math.floor(win.cx);
      if (c.matAt(x, y) === SKY) c.put(x, y, STONE, 0.12);
    }
    for (let x = Math.floor(win.cx - win.hw); x <= win.cx + win.hw; x++) {
      if (c.matAt(x, spring) === SKY) c.put(x, spring, STONE, 0.12);
    }
    // Ivy spilling over the arch: dark leaves against the light.
    const vines = 3 + Math.floor(r() * 3);
    for (let v = 0; v < vines; v++) {
      let x = Math.round(win.cx - win.hw + 1 + r() * (win.hw * 2 - 2));
      let y = win.top - 3;
      while (y < win.top + win.hw && !inArch(win, x, y, -2)) y++;
      y -= 3;
      const len = 5 + r() * (win.bottom - win.top) * 0.4;
      for (let i = 0; i < len; i++, y++) {
        if (r() < 0.2) x += r() < 0.5 ? -1 : 1;
        c.put(x, y, LEAF, 0.14);
        if (i % 3 === 1) {
          const s = r() < 0.5 ? -1 : 1;
          c.put(x + s, y, LEAF, 0.2);
          c.put(x + s * 2, y, LEAF, 0.2);
          c.put(x + s, y - 1, LEAF, 0.26);
        }
      }
    }
  }

  // --- Statue niches ------------------------------------------------------
  const statues = ([
    { x: 0.185, pose: 'sword', mirror: false },
    { x: 0.385, pose: 'staff', mirror: false },
    { x: 0.615, pose: 'shield', mirror: true },
    { x: 0.815, pose: 'raised', mirror: true },
  ] as { x: number; pose: Pose; mirror: boolean }[]).map((s) => ({ ...s, x: Math.round(w * s.x) + 0.5 }));
  const base = floorY - plinthH;
  for (const s of statues) {
    const niche: Arch = { cx: s.x, hw: Math.round(F * 0.3), top: base - Math.round(F * 1.22), bottom: base };
    for (let y = niche.top - 3; y < floorY - 6; y++) {
      for (let x = Math.floor(niche.cx - niche.hw - 3); x <= niche.cx + niche.hw + 3; x++) {
        if (!inArch(niche, x, y, 2)) continue;
        if (!inArch(niche, x, y, 0)) c.add(x, y, 0.06);
        else if (!inArch(niche, x, y, -2)) c.put(x, y, STONE, x < niche.cx ? 0.14 : 0.22);
        else c.put(x, y, STONE, 0.15 + 0.1 * ((y - niche.top) / (base - niche.top)));
      }
    }
    // Keystone.
    c.rect(niche.cx - 2, niche.top - 3, niche.cx + 2, niche.top, (x, y) => c.put(x, y, GOLD, 0.34));
  }

  // --- The great gate -----------------------------------------------------
  {
    const g = gate;
    const inner: Arch = { ...g, hw: g.hw - 3, top: g.top + 3 };
    const exit: Arch = { cx: g.cx, hw: Math.max(3, Math.round(g.hw * 0.16)), top: Math.round(g.bottom - (g.bottom - g.top) * 0.42), bottom: g.bottom - 4 };
    for (let y = g.top - 6; y < g.bottom; y++) {
      for (let x = Math.floor(g.cx - g.hw - 6); x <= g.cx + g.hw + 6; x++) {
        if (!inArch(g, x, y, 5)) continue;
        const dx = x + 0.5 - g.cx;
        if (!inArch(g, x, y, 0)) {
          // Voussoirs: radial joints around the arch.
          const spring = g.top + g.hw;
          const a = Math.atan2(y + 0.5 - spring, dx);
          const joint = y + 0.5 < spring && Math.abs(Math.sin(a * 9)) < 0.12;
          c.put(x, y, STONE, (inArch(g, x, y, 1) || !inArch(g, x, y, 4) ? 0.26 : 0.38) - (joint ? 0.1 : 0));
          continue;
        }
        if (!inArch(inner, x, y, 0)) {
          c.put(x, y, STONE, 0.12);
          continue;
        }
        // The corridor beyond, fading into darkness then lit by its far doorway.
        const t = (y - inner.top) / (inner.bottom - inner.top);
        let l = 0.12 + t * 0.12;
        if (inArch(exit, x, y)) {
          c.put(x, y, SKY, 0.8 - ((y - exit.top) / (exit.bottom - exit.top)) * 0.1);
          continue;
        }
        const d = Math.hypot(dx / 1.3, y + 0.5 - (exit.top + exit.bottom) / 2);
        l += 0.45 * clamp01(1 - d / (g.hw * 0.9)) ** 2;
        // Floor of the corridor: lighter, with lines running to the doorway.
        if (y >= exit.bottom) l += 0.08 + (Math.abs(Math.round(dx / ((y - exit.bottom + 2) * 0.9))) % 2) * 0.03;
        c.put(x, y, DARK, l);
      }
    }
    // Gold keystone and the two open doors.
    c.poly([[g.cx - 3, g.top - 6], [g.cx + 3, g.top - 6], [g.cx + 2, g.top + 1], [g.cx - 2, g.top + 1]], (x, y) => c.put(x, y, GOLD, y < g.top - 4 ? 0.5 : 0.36));
    for (const side of [-1, 1]) {
      const ox = g.cx + side * (inner.hw - 0.5);
      const ix = g.cx + side * inner.hw * 0.52;
      const pts: Pt[] = [
        [ox, inner.top + inner.hw * 0.5],
        [ix, inner.top + inner.hw * 0.95],
        [ix, g.bottom - 3],
        [ox, g.bottom],
      ];
      c.poly(pts, (x, y) => {
        if (!inArch(inner, x, y)) return;
        const u = (x + 0.5 - ox) / (ix - ox);
        let l = 0.22 + (side < 0 ? 0.06 : 0) - u * 0.08;
        if (Math.abs(u - 0.5) < 0.08 || (y - Math.round(inner.top)) % 12 === 0) l -= 0.07;
        if ((y - Math.round(inner.top)) % 12 === 1 && Math.round(u * 6) % 2 === 0) l += 0.2;
        c.put(x, y, GOLD, l);
      });
    }
  }

  // --- Statues ------------------------------------------------------------
  statues.forEach((s, i) => drawStatue(c, s.x, base, floorY, F, s.pose, s.mirror, 10 + i));

  // --- Steps and floor ----------------------------------------------------
  const horizon = fy - (h - fy) * 0.8;
  const acx = w / 2;
  const acy = fy + (h - fy) * 0.62;
  const arx = Math.min(w * 0.42, (h - fy) * 5);
  const ary = (h - fy) * 0.42;
  for (let y = floorY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < fy) {
        const k = y - floorY;
        const l = k === 0 || k === 5 ? 0.38 : k < 3 || (k > 5 && k < 8) ? 0.3 : 0.18;
        c.put(x, y, STONE, l - (x % 23 === 0 ? 0.05 : 0));
        continue;
      }
      const t = (y - fy) / (h - fy);
      // Perspective tiles: rows even in depth, columns running to the vanishing point.
      const dy = y + 0.5 - horizon;
      const row = Math.floor(600 / dy);
      const col = Math.floor(((x + 0.5 - w / 2) / dy) * 3.2);
      const rowUp = Math.floor(600 / (dy - 1));
      const colL = Math.floor(((x - 0.5 - w / 2) / dy) * 3.2);
      let m = TILE;
      let l = 0.28 + t * 0.08 + ((row + col) % 2 === 0 ? 0.03 : 0);
      if (row !== rowUp || col !== colL) l -= 0.08;

      // The arena circle: sand ringed with gold and dark stone, a gold compass star inlaid.
      const u = (x + 0.5 - acx) / arx;
      const v = (y + 0.5 - acy) / ary;
      const rr = Math.hypot(u, v);
      const grad = Math.hypot(u / arx, v / ary) / Math.max(rr, 1e-6);
      const dist = (rr - 1) / grad; // px from the ellipse's edge, negative inside
      if (dist < 1) {
        if (dist >= -1) {
          m = TILE;
          l = 0.16;
        } else if (dist >= -3) {
          m = GOLD;
          l = dist >= -2 ? 0.34 : 0.26;
        } else {
          m = SAND;
          l = 0.3 + t * 0.06 + (hash(x + y * 977, 11) - 0.5) * 0.05;
          const inner = (rr - 0.48) / grad;
          const a = Math.atan2(v, u);
          const spoke = Math.abs(Math.sin(a * 4)) * rr * Math.min(arx, ary * 3);
          if (Math.abs(inner) < 0.7 || (rr < 0.46 && spoke < 0.9 - rr) || rr < 0.07) {
            m = GOLD;
            l = 0.28;
          }
        }
      }
      c.put(x, y, m, l, 0, 1);
    }
  }

  // Brass urns of ferns on the floor, one each side.
  for (const f of [0.14, 0.86]) urn(c, r, Math.round(w * f) + 0.5, Math.round(fy + (h - fy) * 0.3), Math.round(F * 0.2));

  // Everything below the foreground: which pixels are sky, for the sun patches.
  const sky = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) sky[i] = c.mat[i] === SKY ? 1 : 0;
  const isSky = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    return xi >= 0 && yi >= 0 && xi < w && yi < h && sky[yi * w + xi] === 1;
  };

  // --- Sun patches: trace each floor pixel back along the light to a window.
  const land0 = fy + 6;
  const landLen = (h - land0) * 0.92;
  const sunlit = new Uint8Array(w * h);
  for (let y = land0; y < h; y++) {
    const v = (y - land0) / landLen;
    const wy = winB - v * (winB - winT);
    const k = 1 + (SPREAD * (y - winB)) / h;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!c.recv[i]) continue;
      for (const win of windows) {
        const wx = win.cx + (x + 0.5 - SLANT * (y + 0.5 - wy) - win.cx) / k;
        if (Math.abs(wx - win.cx) > win.hw + 1) continue;
        if (isSky(wx, wy)) {
          sunlit[i] = 1;
          break;
        }
      }
    }
  }

  // --- Foreground: columns, drapes and a valance frame the hall. --------
  foreground(c, r, w, h);
  // Foreground things sit in front of the sun patches.
  for (let i = 0; i < w * h; i++) if (!c.recv[i]) sunlit[i] = 0;

  // --- Light: bounce from the sunlit floor, glow around the windows. ----
  const bounce = lightMap(w, h, (i) => sunlit[i], 4, 5, 3);
  const glow = lightMap(w, h, (i) => sky[i], 3, 3, 2);

  const baseBmp = new Bitmap(w, h);
  const sunBmp = new Bitmap(w, h);
  const pick = (m: number, l: number, x: number, y: number): RGB => {
    const rp = RAMPS[m];
    const idx = Math.max(0, Math.min(rp.length - 1, Math.floor(l * (rp.length - 1) + bayer(x, y) * 0.55 + 0.22)));
    return rp[idx];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = c.mat[i];
      if (!m) continue;
      let l = c.lum[i];
      if (m !== SKY) {
        const o = c.obj[i];
        const fg = o === 1;
        const b = bounce(x, y);
        const gl = glow(x, y);
        l += b * (fg ? 0.12 : 0.28) + gl * (fg ? 0.05 : 0.3);
        // Statues are backlit: their outlines glow with the windows' light.
        if (o >= 10 && (c.objAt(x - 1, y) !== o || c.objAt(x + 1, y) !== o || c.objAt(x, y - 1) !== o)) l += 0.12 + gl * 1.2 + b * 0.2;
        // Gold glints where it faces the light.
        if (m === GOLD && c.matAt(x, y - 1) !== GOLD) l += 0.1 + gl * 0.3;
      }
      const col = pick(m, l, x, y);
      baseBmp.set(x, y, col);
      if (sunlit[i]) {
        const lit = pick(m, l + SUN, x, y);
        sunBmp.set(x, y, [Math.max(0, lit[0] - col[0]), Math.max(0, lit[1] - col[1]), Math.max(0, lit[2] - col[2])]);
      }
    }
  }

  // --- Shafts: march every ray from its window pixel to where it lands. --
  const acc = new Float32Array(w * h);
  const rays: number[] = [];
  for (const win of windows) {
    for (let wy = win.top; wy < win.bottom; wy++) {
      for (let wx = Math.floor(win.cx - win.hw); wx <= win.cx + win.hw; wx++) {
        if (!sky[wy * w + wx]) continue;
        const px = wx + 0.5;
        const py = wy + 0.5;
        const v = (win.bottom - py) / (win.bottom - win.top);
        const ly = land0 + v * landLen;
        const lx = win.cx + (px - win.cx) * (1 + (SPREAD * (ly - win.bottom)) / h) + SLANT * (ly - py);
        const n = Math.ceil(ly - py);
        for (let s = 0; s < n; s++) {
          const t = s / n;
          const x = Math.floor(px + (lx - px) * t);
          const y = Math.floor(py + (ly - py) * t);
          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          acc[y * w + x] += clamp01(t / 0.06) * (1 - 0.6 * t);
        }
        if (r() < 0.12) rays.push(px, py, lx, ly);
      }
    }
  }
  const shaft = (seed: number): Bitmap => {
    const out = new Bitmap(w, h);
    const warm = hex('#ffc488');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!acc[i] || sky[i]) continue;
        // Streaks run along the light.
        const streak = 0.4 + 0.6 * noise((x - SLANT * y) / 3.5, seed);
        const a = (1 - Math.exp(-acc[i] / 10)) * streak;
        const q = Math.floor(a * 5 + bayer(x, y)) / 5;
        if (q > 0) out.set(x, y, [Math.round(warm[0] * q * 0.34), Math.round(warm[1] * q * 0.34), Math.round(warm[2] * q * 0.34)]);
      }
    }
    return out;
  };

  return {
    base: baseBmp,
    sun: sunBmp,
    shafts: [shaft(21), shaft(37)],
    rays: new Float32Array(rays),
    windows: windows.map((a) => ({ x: a.cx - a.hw, y: a.top, w: a.hw * 2, h: a.bottom - a.top })),
  };
}

/** A marble hero on a plinth; `base` is the plinth's top, `F` the figure's height. */
function drawStatue(c: Canvas, cx: number, base: number, floorY: number, F: number, pose: Pose, mirror: boolean, id: number): void {
  // Plinth: cornice, panel with a gold name plate, and a foot course.
  const pw = Math.round(F * 0.3);
  c.rect(cx - pw, base, cx + pw, floorY - 6, (x, y) => {
    const edge = x === Math.round(cx - pw) + 1 || x === Math.round(cx + pw) - 2 || y === base + 3 || y === floorY - 8;
    c.put(x, y, STONE, edge ? 0.22 : 0.28, id);
  });
  c.rect(cx - pw - 2, base, cx + pw + 2, base + 3, (x, y) => c.put(x, y, STONE, y === base ? 0.44 : 0.3, id));
  c.rect(cx - pw - 2, floorY - 7, cx + pw + 2, floorY, (x, y) => c.put(x, y, STONE, y === floorY - 7 ? 0.4 : 0.26, id));
  const py = Math.round((base + 3 + floorY - 8) / 2);
  c.rect(cx - F * 0.11, py - 1, cx + F * 0.11, py + 2, (x, y) => c.put(x, y, GOLD, y === py - 1 ? 0.42 : 0.3, id));

  const sx = mirror ? -1 : 1;
  const P = (dx: number, up: number): Pt => [cx + dx * F * sx, base - up * F];
  const fill = (pts: [number, number][], m: number, l: number) => c.poly(pts.map(([a, b]) => P(a, b)), (x, y) => c.put(x, y, m, l, id));
  const disc = (dx: number, up: number, rad: number, m: number, l: number) => {
    const [x, y] = P(dx, up);
    c.ellipse(x, y, Math.max(1, rad * F), Math.max(1, rad * F), (px, py) => c.put(px, py, m, l, id));
  };
  const line = (dx0: number, up0: number, dx1: number, up1: number, dl: number) => {
    const [x0, y0] = P(dx0, up0);
    const [x1, y1] = P(dx1, up1);
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(x0 + ((x1 - x0) * i) / n);
      const y = Math.floor(y0 + ((y1 - y0) * i) / n);
      if (c.objAt(x, y) === id) c.add(x, y, dl);
    }
  };

  // Cape behind, robe, torso, belt, head.
  if (pose !== 'staff') fill([[-0.17, 0.8], [0.17, 0.8], [0.26, 0], [-0.26, 0]], MARBLE, 0.24);
  fill([[-0.11, 0.52], [0.11, 0.52], [0.18, 0], [-0.18, 0]], MARBLE, 0.34);
  fill([[-0.15, 0.8], [0.15, 0.8], [0.1, 0.5], [-0.1, 0.5]], MARBLE, 0.36);
  for (const [a, b] of [[-0.05, -0.1], [0.03, 0.07], [-0.01, -0.02]]) line(a, 0.46, b, 0.02, -0.08);
  fill([[-0.03, 0.78], [0.03, 0.78], [0.03, 0.85], [-0.03, 0.85]], MARBLE, 0.34);
  disc(0, 0.89, 0.058, MARBLE, 0.38);

  if (pose === 'sword') {
    disc(-0.14, 0.77, 0.05, MARBLE, 0.4);
    disc(0.14, 0.77, 0.05, MARBLE, 0.4);
    fill([[-0.16, 0.77], [-0.1, 0.79], [0.02, 0.58], [-0.04, 0.55]], MARBLE, 0.38);
    fill([[0.16, 0.77], [0.1, 0.79], [-0.02, 0.58], [0.04, 0.55]], MARBLE, 0.38);
    fill([[-0.025, 0.51], [0.025, 0.51], [0.025, 0.07], [0, 0.02], [-0.025, 0.07]], MARBLE, 0.46);
    line(0, 0.5, 0, 0.08, 0.1);
    fill([[-0.1, 0.505], [0.1, 0.505], [0.1, 0.535], [-0.1, 0.535]], GOLD, 0.34);
    disc(0, 0.57, 0.035, MARBLE, 0.4);
    disc(0, 0.62, 0.025, GOLD, 0.4);
    fill([[-0.01, 0.94], [0.02, 0.94], [0.08, 1.02], [0.0, 1.05], [-0.06, 1.0]], GOLD, 0.3);
    fill([[-0.1, 0.52], [0.1, 0.52], [0.1, 0.49], [-0.1, 0.49]], GOLD, 0.28);
  } else if (pose === 'staff') {
    // Robed sage: long sleeves, a book, a staff crowned with a gold orb.
    fill([[-0.13, 0.52], [0.13, 0.52], [0.22, 0], [-0.22, 0]], MARBLE, 0.34);
    for (const [a, b] of [[-0.06, -0.14], [0.05, 0.12], [0, 0.01]]) line(a, 0.48, b, 0.02, -0.08);
    fill([[0.2, 0.02], [0.225, 0.02], [0.225, 1.14], [0.2, 1.14]], MARBLE, 0.3);
    fill([[0.12, 0.79], [0.17, 0.8], [0.25, 0.63], [0.19, 0.58]], MARBLE, 0.38);
    disc(0.212, 0.63, 0.034, MARBLE, 0.4);
    fill([[-0.15, 0.79], [-0.1, 0.8], [0.03, 0.66], [-0.03, 0.6]], MARBLE, 0.38);
    fill([[-0.08, 0.6], [0.05, 0.6], [0.05, 0.71], [-0.08, 0.71]], MARBLE, 0.32);
    fill([[-0.08, 0.6], [-0.06, 0.6], [-0.06, 0.71], [-0.08, 0.71]], GOLD, 0.34);
    fill([[-0.08, 0.84], [0.08, 0.84], [0.085, 0.93], [0.0, 1.01], [-0.085, 0.93]], MARBLE, 0.3);
    disc(0, 0.885, 0.038, MARBLE, 0.16);
    disc(0.212, 1.17, 0.05, GOLD, 0.46);
    fill([[0.17, 1.12], [0.255, 1.12], [0.24, 1.14], [0.185, 1.14]], GOLD, 0.3);
  } else if (pose === 'shield') {
    // Guardian: spear upright, kite shield with a gold sun.
    disc(-0.14, 0.77, 0.05, MARBLE, 0.4);
    disc(0.14, 0.77, 0.05, MARBLE, 0.4);
    fill([[0.2, 0.02], [0.22, 0.02], [0.22, 1.2], [0.2, 1.2]], MARBLE, 0.32);
    fill([[0.165, 1.19], [0.255, 1.19], [0.21, 1.34]], GOLD, 0.36);
    fill([[0.12, 0.79], [0.17, 0.8], [0.24, 0.67], [0.18, 0.62]], MARBLE, 0.38);
    disc(0.21, 0.65, 0.034, MARBLE, 0.4);
    const shield: [number, number][] = [[-0.25, 0.7], [0.05, 0.7], [0.05, 0.44], [-0.1, 0.16], [-0.25, 0.44]];
    fill(shield, GOLD, 0.3);
    const inset = 1.8 / F;
    fill(
      [[-0.25 + inset, 0.7 - inset], [0.05 - inset, 0.7 - inset], [0.05 - inset, 0.44], [-0.1, 0.16 + inset * 2.2], [-0.25 + inset, 0.44]],
      MARBLE,
      0.38,
    );
    disc(-0.1, 0.5, 0.045, GOLD, 0.36);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      line(-0.1 + Math.cos(a) * 0.06, 0.5 + Math.sin(a) * 0.06, -0.1 + Math.cos(a) * 0.1, 0.5 + Math.sin(a) * 0.1, 0);
      const [x, y] = P(-0.1 + Math.cos(a) * 0.085, 0.5 + Math.sin(a) * 0.085);
      c.put(Math.floor(x), Math.floor(y), GOLD, 0.32, id);
    }
    fill([[-0.06, 0.93], [0.06, 0.93], [0.06, 0.97], [0.03, 0.95], [0, 0.99], [-0.03, 0.95], [-0.06, 0.97]], GOLD, 0.36);
  } else {
    // Champion: blade raised to the sky, laurel crown.
    disc(-0.14, 0.77, 0.05, MARBLE, 0.4);
    disc(0.14, 0.77, 0.05, MARBLE, 0.4);
    fill([[-0.16, 0.77], [-0.1, 0.79], [-0.12, 0.56], [-0.18, 0.57]], MARBLE, 0.38);
    disc(-0.15, 0.55, 0.034, MARBLE, 0.4);
    fill([[0.12, 0.79], [0.17, 0.81], [0.23, 1.02], [0.18, 1.03]], MARBLE, 0.38);
    fill([[0.187, 1.07], [0.217, 1.07], [0.217, 1.42], [0.202, 1.47], [0.187, 1.42]], MARBLE, 0.48);
    line(0.202, 1.08, 0.202, 1.42, 0.1);
    fill([[0.13, 1.05], [0.27, 1.05], [0.27, 1.08], [0.13, 1.08]], GOLD, 0.36);
    disc(0.202, 1.035, 0.034, MARBLE, 0.4);
    disc(0.202, 0.99, 0.02, GOLD, 0.4);
    fill([[-0.065, 0.92], [0.065, 0.92], [0.07, 0.95], [-0.07, 0.95]], GOLD, 0.36);
    fill([[-0.1, 0.52], [0.1, 0.52], [0.1, 0.49], [-0.1, 0.49]], GOLD, 0.28);
  }
}

/** A brass urn of ferns standing on the floor (catches the sun). */
function urn(c: Canvas, r: () => number, cx: number, base: number, s: number): void {
  const hgt = Math.max(6, Math.round(s * 0.9));
  const top = base - hgt;
  for (let y = top; y <= base; y++) {
    const t = (y - top) / hgt;
    const hw = s * (0.3 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.1))) + (y === top ? 1 : 0);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      const u = (x + 0.5 - cx) / hw;
      let l = 0.3 - u * 0.1 + (u < -0.4 && u > -0.7 ? 0.1 : 0);
      if (y === top) l = 0.4;
      c.put(x, y, GOLD, l, 0, 1);
    }
  }
  const fronds = 9;
  for (let k = 0; k < fronds; k++) {
    const a = Math.PI + ((k + 0.5) / fronds) * Math.PI + (r() - 0.5) * 0.2;
    const len = s * (0.9 + r() * 0.6) * (0.7 + 0.3 * Math.sin(((k + 0.5) / fronds) * Math.PI));
    let px = cx;
    const droop = 0.9 + r() * 0.5;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = Math.round(cx + Math.cos(a) * i);
      const y = Math.round(top + Math.sin(a) * i + droop * t * t * len * 0.6);
      c.put(x, y, LEAF, 0.26 + (1 - t) * 0.04, 0, 1);
      if (i % 2 === 0 && t > 0.15) {
        c.put(x, y - 1, LEAF, 0.36, 0, 1);
        c.put(x + (x > px ? 1 : -1), y + 1, LEAF, 0.22, 0, 1);
      }
      px = x;
    }
  }
}

/** Dark framing: great columns at the sides, crimson drapes and a scalloped valance. */
function foreground(c: Canvas, r: () => number, w: number, h: number): void {
  const colW = Math.max(12, Math.round(w * 0.055));
  const dW = Math.round(w * 0.19);
  const dropH = h * 0.5;
  for (const side of [0, 1]) {
    const X = (x: number) => (side ? w - 1 - x : x);
    // Drape, gathered to the column with a gold tie.
    for (let x = colW - 3; x < dW; x++) {
      const u = (x - (colW - 3)) / (dW - (colW - 3));
      const yb = dropH * (1 - u) ** 1.7;
      for (let y = 0; y < yb; y++) {
        const a = Math.atan2(dropH * 0.92 - y, x - colW);
        let l = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(a * 26));
        if (y > yb - 2) {
          c.put(X(x), y, GOLD, 0.28, 1);
          continue;
        }
        l += 0.06 * (1 - u);
        c.put(X(x), y, CLOTH, l, 1);
      }
      // Tassels along the hem.
      if (x % 5 === 0 && yb > 2) for (let k = 0; k < 3; k++) c.put(X(x), Math.floor(yb) + k, GOLD, 0.24 + (k === 2 ? 0.08 : 0), 1);
    }
    c.ellipse(X(colW) + (side ? -0.5 : 0.5), dropH * 0.92, 3, 2, (x, y) => c.put(x, y, GOLD, 0.34, 1));

    // Column: fluted shaft lit a little on its inner side, capital and base.
    for (let y = 0; y < h; y++) {
      let cw = colW;
      let cap = false;
      if (y < 10) {
        cw += 4;
        cap = true;
      } else if (y > h - 14) cw += y > h - 10 ? 4 : 2;
      for (let x = 0; x < cw; x++) {
        const n = x / cw;
        let l = 0.04 + 0.18 * n ** 3;
        if (x === cw - 1) l += 0.1;
        if (!cap && y <= h - 14 && x % 4 === 1) l -= 0.03;
        if (y === 10 || y === h - 14 || y === h - 10) l += 0.07;
        c.put(X(x), y, STONE, l, 1);
      }
    }
    // Ivy climbing the column.
    let x = colW - 3;
    for (let y = h - 12; y > h * 0.45; y--) {
      x = Math.round(colW - 3 + Math.sin(y * 0.18) * 2.5);
      c.put(X(x), y, LEAF, 0.12, 1);
      if (y % 3 === 0) {
        const s = r() < 0.5 ? -1 : 1;
        c.put(X(x + s), y, LEAF, 0.16, 1);
        c.put(X(x + s), y - 1, LEAF, 0.22, 1);
        c.put(X(x + s * 2), y, LEAF, 0.16, 1);
      }
    }
  }
  // Valance: crimson scallops along the top with a gold edge.
  for (let x = 0; x < w; x++) {
    const p = ((x % 30) - 15) / 15;
    const yb = 3 + Math.round(5 * Math.sqrt(Math.max(0, 1 - p * p)));
    for (let y = 0; y <= yb; y++) {
      if (y >= yb - 1) c.put(x, y, GOLD, y === yb ? 0.22 : 0.3, 1);
      else c.put(x, y, CLOTH, 0.1 + 0.08 * (1 - Math.abs(p)), 1);
    }
  }
}
