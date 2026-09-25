// Gear art: a 32x32 icon for each of the twenty pieces of gear, painted in
// code and lit from the top left like the potions. Shapes are shaded from
// five-step ramps (darkest first), then ringed in an outline tinted by what it
// wraps. Each icon also gives the 16x16 sprite that lies on the ground when a
// monster drops it: the unoutlined painting halved, then outlined again, so
// the drop always matches its icon.

export const GEAR_ICON = 32;
export const GEAR_DROP = 16;

type Ramp = readonly string[];
type RGB = [number, number, number];

const STEEL: Ramp = ['#262a3a', '#4a5470', '#7c89a8', '#b8c4dc', '#eef4ff'];
const IRON: Ramp = ['#1c1e2c', '#34394e', '#565e78', '#8189a4', '#b9c0d6'];
const GOLD: Ramp = ['#5b2f1d', '#9a5a26', '#d69a3a', '#f4cf6a', '#fff4bf'];
const BRONZE: Ramp = ['#3d2216', '#6e3f22', '#a86a34', '#d9a05a', '#f5d59a'];
const WOOD: Ramp = ['#2c1a16', '#523023', '#7d4f33', '#a9774c', '#cfa270'];
const LEATHER: Ramp = ['#26140f', '#45261a', '#6a3d26', '#8f5a36', '#b8804f'];
const RED_LEATHER: Ramp = ['#3a0c14', '#6a1626', '#9c2536', '#c94a4a', '#e88a70'];
const RUBY: Ramp = ['#3a0616', '#7a0e2a', '#c8203e', '#ff5a6a', '#ffd0d4'];
const BLOOD: Ramp = ['#2a0a14', '#5a1428', '#9a2a40', '#d8606a', '#ffd0d0'];
const EMERALD: Ramp = ['#062a1c', '#0e5a34', '#1ea05a', '#5ee08a', '#d0ffe0'];
const ICE: Ramp = ['#1c3a66', '#2f6fb0', '#5fb8f0', '#b2ecff', '#f2ffff'];
const ARCANE: Ramp = ['#1d1040', '#3a2080', '#6a40d0', '#a88aff', '#eee0ff'];
const FIRE: Ramp = ['#6a1206', '#c0300c', '#f06a1a', '#ffb030', '#fff0a0'];
const OBSIDIAN: Ramp = ['#140a22', '#2e1a4a', '#553080', '#8a5cc0', '#d8c0ff'];
const BONE: Ramp = ['#4a3a2a', '#8a7458', '#c0a880', '#e6d6b0', '#fff8e6'];
const ROYAL: Ramp = ['#0e1a44', '#1c3380', '#2e56c0', '#5a86e8', '#a8c8ff'];
const MOON: Ramp = ['#2a2a5a', '#4a4c8e', '#7a80c4', '#b8c0ec', '#f4f6ff'];
const PLUME: Ramp = ['#5a6078', '#8e96b0', '#c4cadc', '#e8ecf6', '#ffffff'];
const SKY_LEATHER: Ramp = ['#10284a', '#1d4a7a', '#2f78b0', '#58a8dc', '#9cd8f4'];
const PAGE: Ramp = ['#8a7050', '#c0a878', '#e8d8b0', '#fff4d8', '#ffffff'];

const OUTLINE: RGB = [18, 10, 20];
/** Light from the top left and a little in front: flat (2D) and for rounded shapes (3D). */
const L2 = [-Math.SQRT1_2, -Math.SQRT1_2];
const L3 = norm3(-0.55, -0.65, 0.55);

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

const parsed = new Map<string, RGB>();
function rgb(c: string): RGB {
  let v = parsed.get(c);
  if (!v) {
    const n = parseInt(c.slice(1), 16);
    v = [n >> 16, (n >> 8) & 255, n & 255];
    parsed.set(c, v);
  }
  return v;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The ramp's colour for a light level 0..1. */
function tone(ramp: Ramp, l: number): string {
  return ramp[Math.round(clamp01(l) * (ramp.length - 1))];
}

/** A tiny seeded random, so sparks and embers land the same every load. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Paint {
  readonly px: Uint8ClampedArray;

  constructor(
    readonly w = GEAR_ICON,
    readonly h = GEAR_ICON,
  ) {
    this.px = new Uint8ClampedArray(w * h * 4);
  }

  put(x: number, y: number, c: string, a = 255): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgb(c);
    const i = (y * this.w + x) * 4;
    if (a >= 255 || this.px[i + 3] === 0) {
      this.px.set([r, g, b, a], i);
      return;
    }
    // Soft light over paint blends in.
    const k = a / 255;
    this.px[i] += (r - this.px[i]) * k;
    this.px[i + 1] += (g - this.px[i + 1]) * k;
    this.px[i + 2] += (b - this.px[i + 2]) * k;
  }

  /** Paints only where nothing is yet: halos and sparks around a shape. */
  glow(x: number, y: number, c: string, a: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || this.filled(x, y)) return;
    this.put(x, y, c, a);
  }

  filled(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[(y * this.w + x) * 4 + 3] === 255;
  }

  /** Every pixel whose centre `shade` lights (0..1, or null to skip) takes that tone of `ramp`. */
  fill(ramp: Ramp, shade: (x: number, y: number) => number | null): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const l = shade(x + 0.5, y + 0.5);
        if (l !== null) this.put(x, y, tone(ramp, l));
      }
    }
  }

  /**
   * A band from a to b, `width(t)` wide on each side along its length (t 0..1).
   * 'round' shades it as a rod; 'bevel' as a blade's two ground faces with a
   * ridge down the middle.
   */
  band(ax: number, ay: number, bx: number, by: number, width: number | ((t: number) => number), ramp: Ramp, mode: 'round' | 'bevel' | 'flat' = 'round', bias = 0): void {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    const nx = -dy / len;
    const ny = dx / len;
    // Which side of the band faces the light.
    const lit = nx * L2[0] + ny * L2[1] >= 0 ? 1 : -1;
    const wf = typeof width === 'number' ? () => width : width;
    this.fill(ramp, (x, y) => {
      const t = ((x - ax) * dx + (y - ay) * dy) / len2;
      if (t < 0 || t > 1) return null;
      const w = wf(t);
      const s = (x - ax) * nx + (y - ay) * ny;
      if (Math.abs(s) > w + 0.2) return null;
      const k = (s / Math.max(0.6, w)) * lit;
      if (mode === 'flat') return 0.5 + bias;
      if (mode === 'bevel') return (Math.abs(s) < 0.5 ? 0.62 : k > 0 ? 0.9 : 0.38) + bias;
      return 0.52 + 0.42 * k + bias;
    });
  }

  /** A lit ball (or an egg, with rx != ry). */
  ball(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, bias = 0, spec = true): void {
    this.fill(ramp, (x, y) => {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) return null;
      const nz = Math.sqrt(1 - d);
      const l = nx * L3[0] + ny * L3[1] + nz * L3[2];
      if (spec && l > 0.96) return 1;
      return 0.12 + 0.8 * clamp01(l) + bias;
    });
  }

  /** A ring (a torus seen face on) between the inner and outer ellipses. */
  ring(cx: number, cy: number, rx: number, ry: number, inner: number, ramp: Ramp, bias = 0): void {
    const mid = (1 + inner) / 2;
    const half = (1 - inner) / 2;
    this.fill(ramp, (x, y) => {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const r = Math.hypot(nx, ny);
      if (r > 1 || r < inner) return null;
      const q = Math.max(-1, Math.min(1, (r - mid) / half));
      const ux = nx / (r || 1);
      const uy = ny / (r || 1);
      const qz = Math.sqrt(1 - q * q);
      const l = ux * q * L3[0] + uy * q * L3[1] + qz * L3[2];
      return 0.1 + 0.85 * clamp01(l) + bias;
    });
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string | ((i: number) => string)): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      this.put(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), typeof c === 'string' ? c : c(i));
    }
  }

  /** Draw a character map at (ox, oy); each letter is looked up in `pal`, '.' is empty. */
  map(ox: number, oy: number, rows: string[], pal: Record<string, string>): void {
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && this.put(ox + x, oy + y, pal[ch])));
  }

  /** A four-point twinkle. */
  twinkle(x: number, y: number, c = '#ffffff', arm = 2): void {
    this.put(x, y, c);
    for (let i = 1; i <= arm; i++) {
      const a = i === arm ? 150 : 230;
      for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) this.glow(x + dx, y + dy, c, a);
    }
  }

  /** A soft halo of `c` around the shape, fading out over `r` pixels. */
  halo(c: string, r: number, strength: number): void {
    const add: [number, number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.filled(x, y)) continue;
        let best = r + 1;
        for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) if (this.filled(x + ox, y + oy)) best = Math.min(best, Math.hypot(ox, oy));
        if (best <= r) add.push([x, y, Math.round(strength * (1 - (best - 1) / r))]);
      }
    }
    for (const [x, y, a] of add) if (a > 0) this.put(x, y, c, a);
  }

  /** Rings the shape in a dark line tinted by the colour beside it. */
  outline(): void {
    const out: [number, number, RGB][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.filled(x, y)) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!this.filled(x + dx, y + dy)) continue;
          const i = ((y + dy) * this.w + x + dx) * 4;
          r += this.px[i];
          g += this.px[i + 1];
          b += this.px[i + 2];
          n++;
        }
        if (!n) continue;
        const k = 0.22 / n;
        out.push([x, y, [OUTLINE[0] * 0.6 + r * k, OUTLINE[1] * 0.6 + g * k, OUTLINE[2] * 0.6 + b * k]]);
      }
    }
    for (const [x, y, c] of out) this.px.set([c[0], c[1], c[2], 255], (y * this.w + x) * 4);
  }

  /** Clears every pixel that is not fully painted (glows, halos). */
  solid(): Paint {
    const p = new Paint(this.w, this.h);
    for (let i = 0; i < this.px.length; i += 4) if (this.px[i + 3] === 255) p.px.set(this.px.subarray(i, i + 4), i);
    return p;
  }

  clone(): Paint {
    const p = new Paint(this.w, this.h);
    p.px.set(this.px);
    return p;
  }
}

/** Halves a painting: a pixel is kept where most of its 2x2 block is painted, in the block's average colour. */
function halve(src: Paint): Paint {
  const p = new Paint(src.w / 2, src.h / 2);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const i = ((y * 2 + oy) * src.w + x * 2 + ox) * 4;
          if (src.px[i + 3] !== 255) continue;
          r += src.px[i];
          g += src.px[i + 1];
          b += src.px[i + 2];
          n++;
        }
      }
      if (n >= 2) p.px.set([r / n, g / n, b / n, 255], (y * p.w + x) * 4);
    }
  }
  return p;
}

// ---- Shared pieces --------------------------------------------------------

interface SwordSpec {
  guard: [number, number];
  tip: [number, number];
  width: number;
  /** Share of the blade's length that narrows to the point. */
  taper: number;
  blade: Ramp;
  hilt: Ramp;
  grip: Ramp;
  guardHalf: number;
  gripLen: number;
  pommel: Ramp;
  pommelR: number;
  /** Colour of the groove down the blade, if any. */
  fuller?: string;
}

/** A sword pointing from its hilt at the bottom left to its tip at the top right. */
function sword(p: Paint, s: SwordSpec): void {
  const [gx, gy] = s.guard;
  const [tx, ty] = s.tip;
  const len = Math.hypot(tx - gx, ty - gy);
  const ux = (tx - gx) / len;
  const uy = (ty - gy) / len;
  p.band(gx, gy, tx, ty, (t) => (t < 1 - s.taper ? s.width : s.width * ((1 - t) / s.taper) + 0.15), s.blade, 'bevel');
  if (s.fuller) p.line(Math.round(gx + ux * 3), Math.round(gy + uy * 3), Math.round(gx + ux * len * 0.62), Math.round(gy + uy * len * 0.62), s.fuller);
  const px = -uy;
  const py = ux;
  p.band(gx - px * s.guardHalf, gy - py * s.guardHalf, gx + px * s.guardHalf, gy + py * s.guardHalf, 1.25, s.hilt);
  const ex = gx - ux * s.gripLen;
  const ey = gy - uy * s.gripLen;
  p.band(gx - ux * 1, gy - uy * 1, ex, ey, 1.05, s.grip);
  // Leather wraps: a darker turn every other step down the grip.
  for (let i = 2; i < s.gripLen; i += 2) p.put(gx - ux * i + 0.5, gy - uy * i + 0.5, s.grip[0]);
  p.ball(ex - ux * s.pommelR * 0.7, ey - uy * s.pommelR * 0.7, s.pommelR, s.pommelR, s.pommel);
}

/** A boot seen from the side, toe to the right; `ox, oy` is the top-left of its shaft. */
function boot(p: Paint, ox: number, oy: number, ramp: Ramp, cuff: Ramp, bias: number): void {
  // Foot: the shaft's foot and a rounded toe.
  p.fill(ramp, (x, y) => {
    const inShaft = x >= ox && x <= ox + 8 && y >= oy + 2 && y <= oy + 16;
    const tx = (x - (ox + 9)) / 4.6;
    const ty = (y - (oy + 14.5)) / 3.2;
    const inToe = tx * tx + ty * ty <= 1 && y <= oy + 17;
    if (!inShaft && !inToe) return null;
    if (y > oy + 16.2) return 0.05;
    // A rounded leg: lit on the left, and the toe domed.
    const k = inShaft && !inToe ? (x - ox - 4.5) / 4.5 : Math.max(-1, Math.min(1, tx * 0.8 + ty * 0.6));
    return 0.62 - 0.38 * k + bias;
  });
  // Heel and sole.
  for (let x = ox; x <= ox + 3; x++) p.put(x, oy + 18, ramp[0]);
  for (let x = ox; x <= ox + 12; x++) if (p.filled(x, oy + 16)) p.put(x, oy + 17, ramp[0]);
  // Folded cuff over the top, a touch wider than the leg.
  p.fill(cuff, (x, y) => (x >= ox - 1 && x <= ox + 9 && y >= oy && y <= oy + 2.9 ? (y < oy + 1 ? 0.85 : 0.55) - (x - ox) / 40 + bias : null));
  // A strap with a small buckle.
  for (let x = ox; x <= ox + 8; x++) p.put(x, oy + 8, ramp[1]);
  p.put(ox + 6, oy + 8, GOLD[3]);
  p.put(ox + 6, oy + 9, GOLD[1]);
}

// ---- The twenty icons ------------------------------------------------------

function ironSword(p: Paint): void {
  sword(p, { guard: [10.5, 21.5], tip: [27, 5], width: 1.9, taper: 0.2, blade: STEEL, hilt: BRONZE, grip: LEATHER, guardHalf: 4.6, gripLen: 5, pommel: BRONZE, pommelR: 1.7, fuller: STEEL[2] });
}

function emberbrand(p: Paint): () => void {
  sword(p, { guard: [10.5, 21.5], tip: [27.5, 4.5], width: 2.2, taper: 0.3, blade: FIRE, hilt: IRON, grip: RED_LEATHER, guardHalf: 5, gripLen: 5, pommel: IRON, pommelR: 1.8, fuller: FIRE[4] });
  p.ball(10.5, 21.5, 1.3, 1.3, RUBY);
  return () => {
    // Flames licking off the blade, thicker toward the tip.
    const r = rng(7);
    for (let i = 0; i < 46; i++) {
      const t = 0.15 + r() * 0.85;
      const x = Math.round(10.5 + (27.5 - 10.5) * t + (r() - 0.5) * 6);
      const y = Math.round(21.5 + (4.5 - 21.5) * t + (r() - 0.5) * 6 - r() * 2);
      p.glow(x, y, r() < 0.5 ? FIRE[3] : FIRE[2], 90 + r() * 120);
    }
    p.twinkle(25, 3, FIRE[4], 1);
  };
}

function dragonfang(p: Paint): () => void {
  sword(p, { guard: [10, 22], tip: [28.5, 3.5], width: 3, taper: 0.28, blade: OBSIDIAN, hilt: GOLD, grip: LEATHER, guardHalf: 6.2, gripLen: 5, pommel: GOLD, pommelR: 2, fuller: OBSIDIAN[1] });
  // A golden edge down the unlit side and the dragon's eyes at the guard and pommel.
  p.line(12, 23, 27, 7, (i) => (i % 3 === 0 ? GOLD[4] : GOLD[3]));
  p.ball(4.5, 27.5, 1.2, 1.2, RUBY);
  // Swept-back claws on each end of the guard.
  p.band(5.6, 17.6, 5, 15.3, 0.8, GOLD);
  p.band(14.4, 26.4, 16.7, 27, 0.8, GOLD);
  p.ball(10, 22, 1.7, 1.7, RUBY);
  return () => {
    p.halo(OBSIDIAN[3], 2, 70);
    p.twinkle(26, 3);
    p.twinkle(19, 9, OBSIDIAN[4], 1);
  };
}

function bloodfang(p: Paint): () => void {
  sword(p, { guard: [12.5, 19.5], tip: [26.5, 5.5], width: 2.6, taper: 0.75, blade: BLOOD, hilt: BONE, grip: BONE, guardHalf: 4, gripLen: 6, pommel: RUBY, pommelR: 2, fuller: BLOOD[1] });
  return () => {
    // Drops of blood falling from the edge.
    p.put(18, 17, RUBY[2]);
    p.put(18, 18, RUBY[1]);
    p.put(21, 15, RUBY[3]);
    p.twinkle(24, 6, RUBY[4], 1);
  };
}

function battleAxe(p: Paint): void {
  const [ax, ay, bx, by] = [7, 29, 22.5, 6];
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const nx = -uy;
  const ny = ux;
  p.band(ax, ay, bx, by, 1.15, WOOD);
  // Two crescent bits either side of the haft, near the top.
  const cx = ax + ux * len * 0.74;
  const cy = ay + uy * len * 0.74;
  p.fill(STEEL, (x, y) => {
    const a = (x - cx) * ux + (y - cy) * uy;
    const v = (x - cx) * nx + (y - cy) * ny;
    const av = Math.abs(v);
    if (av < 1.3 || av > 9.6 - (a * a) / 11) return null;
    if (Math.abs(a) > 1.9 + (av - 1.3) * 0.72) return null;
    const edge = 9.6 - (a * a) / 11 - av;
    // The ground edge shines; the cheeks fall off away from the light.
    if (edge < 1.6) return x - cx + (y - cy) < 0 ? 1 : 0.78;
    return 0.58 - ((x - cx) + (y - cy)) / 30 - (av < 3 ? 0.14 : 0);
  });
  // The iron collar holding the head, and a spike on top.
  p.band(cx - ux * 2.6, cy - uy * 2.6, cx + ux * 2.6, cy + uy * 2.6, 1.9, IRON);
  p.band(bx - ux * 0.5, by - uy * 0.5, bx + ux * 3, by + uy * 3, (t) => 1.2 * (1 - t) + 0.2, STEEL, 'bevel');
  // Grip wrap near the foot of the haft.
  for (let i = 1; i < 7; i++) p.put(ax + ux * i + 0.5, ay + uy * i + 0.5, i % 2 ? LEATHER[1] : LEATHER[3]);
}

function frostSpear(p: Paint): () => void {
  const [ax, ay, bx, by] = [4, 29.5, 21, 11];
  p.band(ax, ay, bx, by, 0.85, PLUME, 'round', -0.12);
  // Blue bindings on the shaft.
  for (const t of [0.25, 0.28, 0.6, 0.63]) p.put(ax + (bx - ax) * t + 0.3, ay + (by - ay) * t + 0.3, ICE[1]);
  // A leaf-shaped head of blue ice.
  p.band(20, 12, 28.5, 2.5, (t) => 2.9 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.75) + 0.1, ICE, 'bevel');
  // Crossbar wings where head meets shaft.
  p.band(17.4, 10.6, 21.6, 14.6, 0.9, ICE, 'round', 0.1);
  return () => {
    p.halo(ICE[3], 2, 55);
    p.twinkle(27, 8, ICE[4], 2);
    p.twinkle(17, 5, ICE[3], 1);
    p.put(12, 16, ICE[4]);
  };
}

function thunderHammer(p: Paint): () => void {
  const [ax, ay] = [8, 29];
  const [cx, cy] = [19.5, 12];
  const len = Math.hypot(cx - ax, cy - ay);
  const ux = (cx - ax) / len;
  const uy = (cy - ay) / len;
  const nx = -uy;
  const ny = ux;
  p.band(ax, ay, cx, cy, 1.15, LEATHER);
  for (let i = 1; i < 12; i += 2) p.put(ax + ux * i + 0.5, ay + uy * i + 0.5, LEATHER[0]);
  p.ball(ax - ux * 0.8, ay - uy * 0.8, 1.6, 1.6, GOLD);
  // The head: a squared block across the haft, gold bands near each face.
  p.fill(STEEL, (x, y) => {
    const a = (x - cx) * ux + (y - cy) * uy;
    const v = (x - cx) * nx + (y - cy) * ny;
    if (Math.abs(a) > 4.4 || Math.abs(v) > 9) return null;
    if (Math.abs(a) > 3.4 && Math.abs(v) > 8) return null;
    const band = Math.abs(v) > 5.2 && Math.abs(v) < 6.8;
    if (band) return a > 2.6 ? 0.75 : a < -2.6 ? 0.3 : 0.55;
    // Top face lit, bottom face in shade, the struck ends brighter.
    let l = a > 2.8 ? 0.82 : a < -2.8 ? 0.28 : 0.52;
    if (Math.abs(v) > 7.9) l += v * ny < 0 ? 0.25 : -0.12;
    return l;
  });
  // Redo the bands in gold over the steel.
  p.fill(GOLD, (x, y) => {
    const a = (x - cx) * ux + (y - cy) * uy;
    const v = (x - cx) * nx + (y - cy) * ny;
    if (Math.abs(a) > 4.4 || Math.abs(v) <= 5.2 || Math.abs(v) >= 6.8) return null;
    return a > 2.6 ? 0.95 : a < -2.6 ? 0.35 : 0.65;
  });
  // A bolt struck into the face.
  p.map(17, 8, ['..yY', '.yY.', 'yyyY', '.yY.', 'yY..'], { y: '#fff27a', Y: '#ffc23a' });
  return () => {
    const r = rng(11);
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const d = 11 + r() * 2.5;
      p.glow(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8), i % 2 ? '#9cecff' : '#fff27a', 220);
    }
    p.twinkle(28, 5, '#fff8c0', 1);
  };
}

function arcaneStaff(p: Paint): () => void {
  p.band(6, 29.5, 18.5, 12, 1.1, WOOD);
  for (const [x, y] of [[9, 25], [9, 26], [14, 18], [14, 19]]) p.put(x, y, GOLD[3]);
  // Gold prongs cradling the orb.
  p.band(18, 12.5, 17.2, 5.5, (t) => 0.9 - t * 0.4, GOLD);
  p.band(18, 12.5, 25.2, 13, (t) => 0.9 - t * 0.4, GOLD);
  p.band(18, 12.5, 20, 9.5, 1.2, GOLD);
  p.ball(22.5, 8, 4.3, 4.3, ARCANE, 0.08);
  // A swirl of light inside.
  p.put(22, 9, ARCANE[4]);
  p.put(23, 9, ARCANE[3]);
  p.put(24, 8, ARCANE[3]);
  return () => {
    p.halo(ARCANE[3], 3, 80);
    p.twinkle(28, 3, ARCANE[4], 2);
    p.twinkle(14, 6, ARCANE[3], 1);
  };
}

function ironHelm(p: Paint): void {
  p.fill(STEEL, (x, y) => {
    const nx = (x - 16) / 10.8;
    const ny = (y - 16) / 11.4;
    const d = nx * nx + ny * ny;
    if (d > 1 || y > 27.2) return null;
    const nz = Math.sqrt(1 - Math.min(1, d));
    return 0.1 + 0.8 * clamp01(nx * L3[0] + ny * L3[1] + nz * L3[2]);
  });
  // The brow band with rivets, and the rim at the bottom.
  for (let x = 5; x <= 27; x++) {
    for (const y of [11, 12]) if (p.filled(x, y)) p.put(x, y, y === 11 ? IRON[3] : IRON[1]);
    if (x % 3 === 0 && p.filled(x, 11)) p.put(x, 11, STEEL[4]);
    if (p.filled(x, 26)) p.put(x, 26, IRON[2]);
    if (p.filled(x, 27)) p.put(x, 27, IRON[1]);
  }
  // Eye slit, split by the nose guard.
  for (let x = 8; x <= 24; x++) {
    if (x === 15 || x === 16) continue;
    p.put(x, 16, '#0c0a16');
    p.put(x, 17, x < 16 ? '#1c1a2c' : '#0c0a16');
  }
  for (let y = 10; y <= 22; y++) {
    p.put(15, y, y === 10 ? STEEL[4] : STEEL[3]);
    p.put(16, y, STEEL[1]);
  }
  // A crest ridge over the dome and breathing holes on the cheeks.
  for (let y = 5; y <= 9; y++) {
    p.put(15, y, STEEL[4]);
    p.put(16, y, STEEL[2]);
  }
  for (const [x, y] of [[10, 20], [12, 20], [11, 22], [20, 20], [22, 20], [21, 22]]) p.put(x, y, '#141220');
}

function knightPlate(p: Paint): void {
  const hw = (y: number) => (y < 12 ? 9.4 : y < 20 ? 9.4 - (y - 12) * 0.28 : 7.2 - (y - 20) * 0.1);
  const inside = (x: number, y: number) => {
    if (y < 6 || y > 28) return false;
    if (Math.abs(x - 16) > hw(y)) return false;
    const nx = (x - 16) / 4.4;
    const ny = (y - 6.5) / 4;
    return nx * nx + ny * ny > 1;
  };
  p.fill(STEEL, (x, y) => {
    if (!inside(x, y)) return null;
    // Rounded chest: lit on the left, and a touch brighter high up.
    const k = (x - 16) / hw(y);
    let l = 0.62 - 0.42 * k - (y - 14) / 50;
    if (Math.abs(x - 16.5) < 0.6) l += 0.12;
    return l;
  });
  // Gold trim round every edge, and lines between the plates at the waist.
  const trim: [number, number][] = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    if (!inside(x + 1.5, y + 0.5) || !inside(x - 0.5, y + 0.5) || !inside(x + 0.5, y + 1.5) || !inside(x + 0.5, y - 0.5)) trim.push([x, y]);
  }
  for (const [x, y] of trim) p.put(x, y, x < 16 ? GOLD[3] : GOLD[2]);
  for (const y of [23, 26]) for (let x = 0; x < 32; x++) if (p.filled(x, y) && !trim.some(([tx, ty]) => tx === x && ty === y)) p.put(x, y, IRON[1]);
  // A blue crest on the chest.
  p.map(14, 12, ['bBBbb', 'bBBbb', 'bBbbd', '.bbd.', '..d..'], { B: ROYAL[4], b: ROYAL[2], d: ROYAL[1] });
  // Round pauldrons over the shoulders.
  for (const cx of [6.5, 25.5]) {
    p.ball(cx, 10, 4.3, 3.9, STEEL);
    p.ring(cx, 10, 4.3, 3.9, 0.72, GOLD);
  }
}

function oakShield(p: Paint): void {
  p.fill(WOOD, (x, y) => {
    const d = Math.hypot(x - 16, y - 16);
    if (d > 12.5) return null;
    const board = Math.floor((x - 1.5) / 5);
    const seam = (x - 1.5) % 5 < 1;
    if (seam) return 0.1;
    return 0.55 + (board % 2 ? -0.08 : 0.1) - ((x - 16) + (y - 16)) / 40;
  });
  p.ring(16, 16, 12.5, 12.5, 0.86, IRON);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.round(16 + Math.cos(a) * 11.5 - 0.5);
    const y = Math.round(16 + Math.sin(a) * 11.5 - 0.5);
    p.put(x, y, IRON[4]);
  }
  p.ball(16, 16, 3.6, 3.6, STEEL);
  p.ring(16, 16, 4.4, 4.4, 0.8, IRON);
}

function goldenAegis(p: Paint): () => void {
  const hw = (y: number) => (y <= 13 ? 11.5 : 11.5 * Math.sqrt(Math.max(0, 1 - ((y - 13) / 16.4) ** 2)));
  const inside = (x: number, y: number) => y >= 3.6 && y <= 29.4 && Math.abs(x - 16) <= hw(y) && !(y < 5 && Math.abs(x - 16) > hw(y) - 1);
  const edge = (x: number, y: number, d: number) => {
    for (let oy = -d; oy <= d; oy++) for (let ox = -d; ox <= d; ox++) if (Math.abs(ox) + Math.abs(oy) <= d && !inside(x + ox, y + oy)) return true;
    return false;
  };
  p.fill(ROYAL, (x, y) => {
    if (!inside(x, y)) return null;
    return 0.6 - ((x - 16) + (y - 16)) / 30;
  });
  p.fill(GOLD, (x, y) => {
    if (!inside(x, y) || !edge(x, y, 2)) return null;
    const outer = edge(x, y, 1);
    return (outer ? 0.72 : 0.5) - ((x - 16) + (y - 16)) / 34;
  });
  // A golden sun on the field.
  p.ball(16, 15, 3.4, 3.4, GOLD, 0.1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r1 = i % 2 ? 6 : 7.3;
    p.band(16 + Math.cos(a) * 4, 15 + Math.sin(a) * 4, 16 + Math.cos(a) * r1, 15 + Math.sin(a) * r1, (t) => 0.9 * (1 - t) + 0.25, GOLD, 'round', 0.15);
  }
  return () => {
    p.halo(GOLD[3], 2, 60);
    p.twinkle(6, 5);
    p.twinkle(25, 24, GOLD[4], 1);
  };
}

function leatherBoots(p: Paint): void {
  boot(p, 6, 9, LEATHER, LEATHER, -0.18);
  boot(p, 12, 6, LEATHER, BRONZE, 0.04);
}

function wingedBoots(p: Paint): () => void {
  boot(p, 6, 9, SKY_LEATHER, GOLD, -0.2);
  boot(p, 12, 6, SKY_LEATHER, GOLD, 0.04);
  // White wings off the ankle, sweeping back and up.
  p.band(14, 13, 5, 3.5, (t) => 1.8 * (1 - t) + 0.3, PLUME, 'round', 0.1);
  p.band(14, 14, 3.5, 7.5, (t) => 1.7 * (1 - t) + 0.3, PLUME, 'round', 0);
  p.band(14, 15, 4, 11.5, (t) => 1.5 * (1 - t) + 0.3, PLUME, 'round', -0.12);
  return () => {
    p.twinkle(27, 4, '#ffffff', 1);
    p.glow(2, 10, PLUME[3], 150);
    p.glow(1, 13, PLUME[2], 110);
  };
}

function gauntlets(p: Paint): void {
  // The flared cuff.
  p.fill(STEEL, (x, y) => {
    if (y < 20.5 || y > 29) return null;
    const hw = 6 + (y - 20.5) * 0.4;
    if (Math.abs(x - 16) > hw) return null;
    return (y > 28 || y < 21.5 ? 0.85 : 0.6) - ((x - 16) / hw) * 0.35;
  });
  for (let x = 9; x <= 23; x++) {
    if (p.filled(x, 21)) p.put(x, 21, x < 16 ? GOLD[3] : GOLD[2]);
    if (p.filled(x, 28)) p.put(x, 28, x < 16 ? GOLD[3] : GOLD[2]);
  }
  // The back of the hand.
  p.fill(STEEL, (x, y) => {
    if (x < 9 || x > 23 || y < 10.5 || y > 21) return null;
    if ((x < 10 || x > 22) && (y < 11.5 || y > 20)) return null;
    const k = (x - 16) / 7;
    return 0.6 - 0.35 * k - (y - 15) / 30;
  });
  // Curled fingers along the top, a gold stud on each knuckle.
  for (let i = 0; i < 4; i++) {
    const fx = 11 + i * 3.4;
    p.ball(fx, 9, 1.8, 2.6, STEEL, i === 0 ? 0.08 : 0);
    p.put(fx - 0.5, 11, GOLD[4]);
    p.put(fx + 0.5, 11, GOLD[2]);
  }
  // The thumb, over the left of the hand.
  p.ball(8.2, 15.5, 2.3, 3.8, STEEL, 0.05);
  // A ruby set in the back of the hand.
  p.ball(16.5, 16, 2, 2, RUBY);
  for (const [x, y] of [[14, 16], [19, 16], [16, 13], [16, 19]]) p.put(x, y, GOLD[3]);
}

function emeraldRing(p: Paint): () => void {
  p.ring(16, 21, 9.4, 6.8, 0.64, GOLD);
  // The bezel, then the cut stone.
  p.ball(16, 12, 5.6, 5, GOLD, -0.05);
  p.fill(EMERALD, (x, y) => {
    const dx = (x - 16) / 4.4;
    const dy = (y - 11.7) / 3.9;
    const r = Math.hypot(dx, dy);
    if (r > 1) return null;
    if (Math.abs(dx) < 0.36 && Math.abs(dy) < 0.36) return 0.75;
    // Eight facets, brightest toward the light.
    const a = Math.atan2(dy, dx);
    const sector = ((Math.round(((a + Math.PI) / (Math.PI * 2)) * 8) % 8) + 8) % 8;
    const bright = [0.95, 1, 0.8, 0.5, 0.25, 0.1, 0.25, 0.55][sector];
    return r > 0.72 ? bright - 0.2 : bright;
  });
  return () => {
    p.twinkle(13, 9, '#ffffff', 2);
    p.twinkle(25, 16, GOLD[4], 1);
  };
}

function rubyAmulet(p: Paint): () => void {
  // The chain: two sagging strands of beads meeting at the bail.
  for (const side of [-1, 1]) {
    let prev: [number, number] | null = null;
    let n = 0;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = 16 + side * ((1 - t) * (1 - t) * 11 + 2 * (1 - t) * t * 10.5 + t * t * 1.2);
      const y = (1 - t) * (1 - t) * 2 + 2 * (1 - t) * t * 12 + t * t * 13;
      const q: [number, number] = [Math.round(x - 0.5), Math.round(y - 0.5)];
      if (prev && prev[0] === q[0] && prev[1] === q[1]) continue;
      prev = q;
      p.put(q[0], q[1], n++ % 2 ? GOLD[1] : GOLD[3]);
    }
  }
  p.ring(16, 14, 1.8, 1.8, 0.2, GOLD);
  p.ball(16, 22, 7.2, 7.2, GOLD);
  p.ball(16, 22, 5.2, 5.2, RUBY, 0.05);
  // Four small studs around the setting.
  for (const [x, y] of [[16, 15], [9, 22], [23, 22], [16, 29]]) p.put(x - 0.5, y - 0.5, GOLD[4]);
  return () => {
    p.twinkle(13, 19, '#ffffff', 1);
    p.halo(RUBY[3], 2, 40);
  };
}

function tomeOfEmbers(p: Paint): () => void {
  // Page block peeking out on the right and bottom.
  p.fill(PAGE, (x, y) => {
    if (x < 9 || x > 26 || y < 7 || y > 29) return null;
    if (x > 24) return x % 2 ? 0.55 : 0.8;
    if (y > 27) return y % 2 ? 0.55 : 0.8;
    return 0.6;
  });
  // The cover: red leather, a darker spine, gold corners.
  p.fill(RED_LEATHER, (x, y) => {
    if (x < 6 || x > 24 || y < 5 || y > 27) return null;
    if (x < 9) return x < 7 ? 0.3 : 0.2;
    return 0.62 - ((x - 15) + (y - 16)) / 40;
  });
  for (const y of [8, 24]) for (let x = 6; x < 9; x++) p.put(x, y, GOLD[x === 6 ? 3 : 2]);
  const corner = (cx: number, cy: number, sx: number, sy: number) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) p.put(cx + sx * i, cy + sy * j, i + j < 2 ? GOLD[4] : GOLD[2]);
  };
  corner(24, 5, -1, 1);
  corner(24, 27, -1, -1);
  // A gold ring framing a flame.
  for (let a = 0; a < Math.PI * 2; a += 0.08) p.put(Math.round(16.5 + Math.cos(a) * 6.2 - 0.5), Math.round(16 + Math.sin(a) * 6.8 - 0.5), a > Math.PI * 0.75 && a < Math.PI * 1.75 ? GOLD[3] : GOLD[1]);
  p.map(12, 11, ['....a....', '...ab....', '...abb...', '..abcb.a.', '..abccbab', '.abcdcbb.', '.abcddcb.', '.abcddcb.', '..abccb..', '...aaa...'], { a: FIRE[1], b: FIRE[2], c: FIRE[3], d: FIRE[4] });
  // A ribbon marker hanging below.
  p.put(20, 28, GOLD[3]);
  p.put(20, 29, GOLD[2]);
  p.put(20, 30, GOLD[3]);
  return () => {
    p.glow(15, 9, FIRE[3], 140);
    p.glow(19, 10, FIRE[2], 120);
    p.twinkle(27, 4, FIRE[4], 1);
  };
}

function moonstoneOrb(p: Paint): () => void {
  // A dark stand with gold claws.
  p.fill(IRON, (x, y) => {
    if (y < 22.5 || y > 28.5) return null;
    const hw = 4.5 + (y - 22.5) * 0.45;
    if (Math.abs(x - 16) > hw) return null;
    return (y > 27.5 ? 0.25 : 0.55) - ((x - 16) / hw) * 0.3;
  });
  for (let x = 10; x <= 22; x++) if (p.filled(x, 26)) p.put(x, 26, x < 16 ? GOLD[3] : GOLD[2]);
  p.fill(MOON, (x, y) => {
    const nx = (x - 16) / 9.6;
    const ny = (y - 13) / 9.6;
    const d = nx * nx + ny * ny;
    if (d > 1) return null;
    const nz = Math.sqrt(1 - d);
    let l = 0.1 + 0.75 * clamp01(nx * L3[0] + ny * L3[1] + nz * L3[2]);
    // Light gathering inside, on the far side from the sun.
    l += 0.4 * clamp01(1 - Math.hypot(x - 19.5, y - 17.5) / 5.5);
    return l;
  });
  // A crescent moon glowing in its heart.
  p.fill(PLUME, (x, y) => {
    if (Math.hypot(x - 15.5, y - 13.5) > 4 || Math.hypot(x - 17.2, y - 12) < 3.4) return null;
    return 0.95;
  });
  p.put(10, 8, '#ffffff');
  p.put(11, 8, '#ffffff');
  p.put(10, 9, '#ffffff');
  for (const cx of [9.5, 22.5]) p.band(cx, 23, cx + (cx < 16 ? 1.5 : -1.5), 19.5, 0.8, GOLD);
  return () => {
    p.halo(MOON[3], 3, 70);
    p.twinkle(27, 4, '#ffffff', 2);
    p.twinkle(5, 20, MOON[4], 1);
  };
}

function phoenixFeather(p: Paint): () => void {
  const P0 = [5.5, 29.5];
  const P1 = [12, 13];
  const P2 = [27.5, 3];
  const at = (t: number) => [
    (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  const samples = Array.from({ length: 97 }, (_, i) => {
    const t = i / 96;
    const [x, y] = at(t);
    const [x2, y2] = at(Math.min(1, t + 0.01));
    const [x1, y1] = at(Math.max(0, t - 0.01));
    const l = Math.hypot(x2 - x1, y2 - y1);
    return { t, x, y, tx: (x2 - x1) / l, ty: (y2 - y1) / l };
  });
  const FEATHER = ['#5a0a10', '#a0161a', '#e0381c', '#ff7a1e', '#ffb52e', '#ffe066', '#fff8c0'];
  p.fill(FEATHER, (x, y) => {
    let best = samples[0];
    let bd = Infinity;
    for (const s of samples) {
      const d = (x - s.x) ** 2 + (y - s.y) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    const { t } = best;
    const side = (x - best.x) * -best.ty + (y - best.y) * best.tx;
    const s = Math.abs(side);
    if (t < 0.14) return s < 0.75 ? 0.9 : null;
    const w = 5 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.1) / 0.92)), 0.7) * (side > 0 ? 1 : 0.8) + 0.3;
    if (s > w) return null;
    if (s < 0.55) return 0.95;
    // Barbs: slanted stripes, the lit side and the tips warmer.
    const stripe = Math.floor((t * 34 + s * 0.9) / 1.6) % 2 === 0;
    const lit = side < 0;
    return (t * 4 + (lit ? 1 : 0) + (s / w > 0.62 ? 0.8 : 0) - (stripe ? 1 : 0) + 0.4) / 6;
  });
  return () => {
    const r = rng(23);
    for (let i = 0; i < 9; i++) {
      const [x, y] = at(0.35 + r() * 0.65);
      p.glow(Math.round(x + (r() - 0.5) * 16), Math.round(y + (r() - 0.5) * 12), r() < 0.5 ? '#ffb52e' : '#ffe066', 200);
    }
    p.halo('#ff7a1e', 2, 50);
    p.twinkle(28, 2, '#fff8c0', 1);
  };
}

/** Every piece's painter, by gear id. Returns a finishing pass for glows and sparks, drawn after the outline. */
const PAINTERS: Record<string, (p: Paint) => void | (() => void)> = {
  iron_sword: ironSword,
  battle_axe: battleAxe,
  frost_spear: frostSpear,
  bloodfang: bloodfang,
  thunder_hammer: thunderHammer,
  emberbrand: emberbrand,
  dragonfang: dragonfang,
  iron_helm: ironHelm,
  knight_plate: knightPlate,
  oak_shield: oakShield,
  golden_aegis: goldenAegis,
  leather_boots: leatherBoots,
  winged_boots: wingedBoots,
  gauntlets: gauntlets,
  arcane_staff: arcaneStaff,
  emerald_ring: emeraldRing,
  ruby_amulet: rubyAmulet,
  tome_of_embers: tomeOfEmbers,
  moonstone_orb: moonstoneOrb,
  phoenix_feather: phoenixFeather,
};

export const GEAR_ART_IDS = Object.keys(PAINTERS);

/** A piece's 32x32 icon and its 16x16 ground sprite. */
export function gearArt(id: string): { icon: Uint8ClampedArray; drop: Uint8ClampedArray } {
  const p = new Paint();
  const finish = PAINTERS[id](p);
  const drop = halve(p.solid());
  drop.outline();
  p.outline();
  finish?.();
  return { icon: p.px, drop: drop.px };
}

/** The HUD's gear button: a small treasure chest (16x16). */
export function chestIcon(): Uint8ClampedArray {
  const p = new Paint(16, 16);
  p.map(1, 2, [
    '..WWWWWWWWWW..',
    '.WwwwwwwwwwwW.',
    'WwwwwwwwwwwwwW',
    'ggggggGGgggggg',
    'GGGGGGyyGGGGGG',
    'WWWWWWyYWWWWWW',
    'wwwwwwyywwwwww',
    'wwwwwwwwwwwwww',
    'gwwwwwwwwwwwwg',
    'dddddddddddddd',
    'GGGGGGGGGGGGGG',
  ], { W: WOOD[4], w: WOOD[2], d: WOOD[1], g: GOLD[1], G: GOLD[3], y: GOLD[4], Y: '#1a0e10' });
  p.outline();
  p.twinkle(13, 2, '#fff4bf', 1);
  return p.px;
}
