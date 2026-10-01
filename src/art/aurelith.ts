// Aurelith, Serpent of the Northern Lights: the Aurora Colosseum's second
// Myth and its namesake. A vast sky serpent that never touches the ground:
// a long body of crystal scales that shift from teal at the head through
// green to violet at the tail, a pale belly glowing like lit snow, and above
// its back, all the way along, curtains of aurora light rising and rippling
// as it swims through the air. Its head is long and fine, crowned with
// branching antlers of violet crystal, trailing whiskers of light; a pair of
// ribbon fins of crystal ribs and light spreads behind its neck, and its tail
// ends in a fan of light.
// Poses: swimming through the air (eight frames of a travelling wave),
// rearing back to breathe, breathing with its jaws wide, coiled high before
// a dive, plunging head first, lying crashed on the floor, and curled in a
// ring with its scales flaring (the volley).

import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { PixelCanvas, hex, sphere, type Material, type RGB } from './pixel';
import { hash2, rng } from './env';
import { C_AURORA, C_PINK, C_TEAL, C_VIOLET, C_WHITE, GLOW_AURORA, HOLLOW, INK, crystal, ramp, type FxRegistrar } from './frostKit';

// Scales: shadows lean navy-violet, lit faces go to the aurora's colours.
const SCALE_TEAL: Material = { ramp: ramp('#070b1e', '#0d1636', '#122650', '#143c66', '#13607a', '#1c8a8e', '#3ab8a6', '#86e8cc'), outline: INK, outlineLit: hex('#0e1a3a'), emissive: 0.14, shine: true };
const SCALE_GREEN: Material = { ...SCALE_TEAL, ramp: ramp('#070c1c', '#0c1a32', '#10304a', '#11505e', '#127a6c', '#20a474', '#4ad08a', '#a0f4bc') };
const SCALE_VIOLET: Material = { ...SCALE_TEAL, ramp: ramp('#0a081e', '#140f38', '#1e1856', '#2c2274', '#3e3094', '#5a48b8', '#8470dc', '#c0acff') };
/** Its belly plates: pale, lit from within like snow under the aurora. */
const BELLY: Material = { ramp: ramp('#14324a', '#22586a', '#3a8a8a', '#68c0aa', '#a8ecd2', '#e4fff4'), outline: INK, emissive: 0.4 };
/** Crystal: the antlers, the spines down its back, the ribs of its fins. */
const CRYSTAL_V: Material = { ramp: ramp('#22125a', '#3e269a', '#6a4cd8', '#a07cff', '#d8c8ff', '#ffffff'), outline: hex('#0c0626'), emissive: 0.6, shine: true, noAO: true };
/** The head drawn this much larger than its local measures. */
const HS = 1.3;
const CRYSTAL_T: Material = { ramp: ramp('#0a3040', '#126270', '#22a4a4', '#6ae8d8', '#d8fff6'), outline: hex('#041820'), emissive: 0.6, shine: true, noAO: true };
const MAW: Material = { ramp: ramp('#2a8a6a', '#5affb0', '#c8ffe8', '#ffffff'), outline: INK, emissive: 1, noAO: true, noOutline: true };
const TOOTH: Material = { ramp: ramp('#7a8aa0', '#c8d8e8', '#f4fcff'), outline: INK };

/** Particle tints for Aurelith's light: green, teal, violet, white and a touch of rose. */
export const AURELITH_TINTS = [0x5affb0, 0x4ae8e0, 0xb48aff, 0xffffff, 0xff8ad8];

/** Its body's middle and its jaws, above and ahead of the point under it (facing right), in the frame before hovering. */
export const AU_BODY_Y = 66;
export const AU_MOUTH_X = 76;
export const AU_MOUTH_Y = 72;

type P = [number, number];
type Mood = 'fly' | 'rear' | 'breath' | 'coil' | 'plunge' | 'crashed' | 'volley';

interface Pose {
  t: number;
  mood: Mood;
  /** The body's path from the head to the tail tip. */
  path: P[];
  /** The head's tilt (radians, + looking down), the jaw's drop, and how bright it burns. */
  tilt: number;
  jaw: number;
  flare: number;
  /** The travelling wave's height along the body (swimming). */
  wave?: number;
}

/** Points along a Catmull-Rom spline through the control points. */
function spline(ctrl: P[], per: number): P[] {
  const out: P[] = [];
  const at = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

/** The body's radius `s` of the way from the head (0) to the tail tip (1): a slim neck, a full chest, a long taper. */
function radius(s: number): number {
  if (s < 0.1) return 8 + (s / 0.1) * 6;
  return 14 * Math.pow(1 - (s - 0.1) / 0.9, 0.8) + 1.2;
}

/** The scale colour along the body, its boundaries dithered: teal, then green, then violet toward the tail. */
function scaleAt(s: number, k: number): Material {
  const v = s * 3 + (hash2(k, 7, 3) - 0.5) * 0.35;
  return v < 1 ? SCALE_TEAL : v < 2 ? SCALE_GREEN : SCALE_VIOLET;
}

/** The colour of aurora light `u` (0 at the foot, 1 at the top) up a curtain. */
function auroraAt(u: number, k: number): RGB {
  if (u < 0.4) return C_AURORA;
  if (u < 0.7) return k % 3 === 0 ? C_TEAL : C_AURORA;
  return k % 4 === 0 ? C_PINK : C_VIOLET;
}

interface Sample {
  x: number;
  y: number;
  r: number;
  s: number;
  /** The unit normal pointing up the screen (the back), and along the body toward the tail. */
  nx: number;
  ny: number;
  tx: number;
  ty: number;
}

function samples(pts: P[]): Sample[] {
  // Arc length, so the radius and colours run evenly whatever the spacing.
  const len: number[] = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1] || 1;
  return pts.map(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l;
    let ny = dx / l;
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
    const s = len[i] / total;
    return { x, y, r: radius(s), s, nx, ny, tx: dx / l, ty: dy / l };
  });
}

function serpent(p: Pose): PixelCanvas {
  const { w, h } = MONSTER_FRAME.aurelith;
  const c = new PixelCanvas(w, h);
  const tau = p.t * Math.PI * 2;
  const pts = spline(p.path, 7);
  const body = samples(pts);
  const hd = body[0];
  const n = body.length;

  // ---- The far fin, behind the body.
  const finAt = body[Math.floor(n * 0.14)];
  fin(c, finAt, -1, p, tau);

  // ---- The body, from the tail up to the neck, so the neck lies over the coils.
  for (let i = n - 1; i >= 1; i--) {
    const a = body[i];
    const b = body[i - 1];
    if (i % 7 === 0) c.part();
    c.capsule(a.x, a.y, b.x, b.y, a.r, b.r, scaleAt(a.s, i));
  }
  // Scales: a diamond lattice pressed into the hide.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = c.materialAt(x, y);
      if (m !== SCALE_TEAL && m !== SCALE_GREEN && m !== SCALE_VIOLET) continue;
      if ((x + 2 * y) % 6 === 0 || (x - 2 * y + 600) % 6 === 0) c.shade(x, y, -1);
      else if (hash2(x, y, 19) > 0.97) c.spark(x, y, C_WHITE, 0.35);
    }
  }
  // ---- The belly: pale plates down its underside.
  c.part();
  for (let i = 1; i < n - 3; i++) {
    const a = body[i - 1];
    const b = body[i];
    const k = 0.5;
    c.capsule(a.x - a.nx * a.r * k, a.y - a.ny * a.r * k, b.x - b.nx * b.r * k, b.y - b.ny * b.r * k, a.r * 0.5, b.r * 0.5, BELLY);
  }
  for (let i = 3; i < n - 3; i += 3) {
    const b = body[i];
    // A seam between plates, across the belly.
    for (let d = -0.95; d <= -0.1; d += 0.15) c.shade(b.x + b.nx * b.r * d, b.y + b.ny * b.r * d, -1);
  }
  // ---- Crystal spines down its back, raked toward the tail.
  for (let i = 8; i < n - 6; i += 5) {
    const b = body[i];
    const len = b.r * (0.45 + hash2(i, 1, 5) * 0.3);
    c.part();
    crystal(c, b.x + b.nx * b.r * 0.75, b.y + b.ny * b.r * 0.75, b.x + b.nx * (b.r + len) + b.tx * len * 0.9, b.y + b.ny * (b.r + len) + b.ty * len * 0.9, Math.max(1, b.r * 0.17), i % 10 === 8 ? CRYSTAL_V : CRYSTAL_T, i % 10 === 8 ? C_WHITE : null);
  }

  // ---- Curtains of aurora rising off its back, rippling with the wave (light only, behind the body).
  for (let i = 3; i < n - 3; i++) {
    const a0 = body[i];
    const a1 = body[i + 1];
    const step = Math.max(1, Math.round(Math.hypot(a1.x - a0.x, a1.y - a0.y)));
    for (let j = 0; j < step; j++) {
      const m = j / step;
      const q = i + m;
      const x0 = a0.x + (a1.x - a0.x) * m + a0.nx * a0.r * 0.8;
      const y0 = a0.y + (a1.y - a0.y) * m + a0.ny * a0.r * 0.8;
      // Folds of the curtain: some columns run bright and tall, others faint.
      const ripple = 0.5 + 0.5 * Math.sin(tau * 2 - q * 0.5) * Math.sin(q * 0.23 + tau);
      const fold = 0.55 + 0.45 * Math.sin(q * 1.7 + tau * 3);
      const tall = (18 + ripple * 30 + p.flare * 10) * (0.45 + 0.55 * Math.min(1, (1 - a0.s) * 1.5));
      for (let k = 1; k < tall; k++) {
        const u = k / tall;
        // The curtain leans back along the body as it rises, and sways.
        const x = x0 + a0.tx * k * 0.3 + Math.sin(tau + q * 0.3 + k * 0.12) * 1.5;
        const y = y0 - k;
        if (c.filled(Math.floor(x), Math.floor(y))) continue;
        const a = (u < 0.12 ? 0.6 + u * 3 : (1 - u) ** 1.3) * (0.35 + 0.4 * ripple) * fold * (0.65 + p.flare * 0.35);
        c.spark(x, y, auroraAt(u, Math.round(q)), a);
      }
    }
  }

  // ---- The tail's fan of light.
  const tip = body[n - 1];
  const pre = body[n - 5];
  const ta = Math.atan2(tip.y - pre.y, tip.x - pre.x);
  for (let f = -3; f <= 3; f++) {
    const a = ta + f * 0.22 + Math.sin(tau + f) * 0.08;
    const L = 16 + (3 - Math.abs(f)) * 4;
    for (let k = 1; k < L; k++) {
      const x = tip.x + Math.cos(a) * k;
      const y = tip.y + Math.sin(a) * k + Math.sin(tau * 2 + k * 0.3) * 1.2;
      if (c.filled(Math.floor(x), Math.floor(y))) continue;
      c.spark(x, y, k < L * 0.4 ? C_TEAL : f % 2 ? C_VIOLET : C_AURORA, (1 - k / L) * 0.75);
    }
  }
  for (const f of [-2, 0, 2]) {
    c.part();
    const a = ta + f * 0.22;
    crystal(c, tip.x - Math.cos(ta) * 2, tip.y - Math.sin(ta) * 2, tip.x + Math.cos(a) * 12, tip.y + Math.sin(a) * 12, 1.2, CRYSTAL_V, C_WHITE);
  }

  // ---- The near fin, over the body.
  fin(c, finAt, 1, p, tau);

  // ---- The head.
  const back = body[Math.min(n - 1, 5)];
  const tilt = p.tilt;
  drawHead(c, hd.x, hd.y, tilt, p, tau, back);

  // ---- Motes of light drifting off it.
  const R = rng(Math.round(p.t * 97) + p.mood.length * 13);
  for (let k = 0; k < 14; k++) {
    const b = body[Math.floor(R() * (n - 1))];
    const x = b.x + (R() - 0.5) * 20;
    const y = b.y - b.r - R() * 26;
    if (!c.filled(Math.floor(x), Math.floor(y))) c.spark(x, y, k % 3 ? C_AURORA : C_VIOLET, 0.25 + R() * 0.4);
  }
  if (p.flare > 0.6) {
    // Its scales flaring: glints all along it.
    for (let i = 2; i < n; i += 3) {
      const b = body[i];
      c.spark(b.x + b.nx * b.r * 0.4, b.y + b.ny * b.r * 0.4, (i / 3) % 2 ? C_TEAL : C_VIOLET, 0.6 * p.flare);
    }
  }
  if (p.mood === 'plunge') {
    // Streaks of its fall, trailing up behind.
    for (let k = 0; k < 18; k++) {
      const b = body[Math.floor(hash2(k, 2, 9) * (n - 1))];
      for (let j = 0; j < 8; j++) c.spark(b.x + (hash2(k, 3, 9) - 0.5) * 26 - j * 0.6, b.y - j * 2 - 4, j < 3 ? C_WHITE : C_TEAL, 0.5 * (1 - j / 8));
    }
  }
  return c;
}

/** A ribbon fin behind the neck: crystal ribs fanning back and down, light stretched between them. */
function fin(c: PixelCanvas, at: Sample, side: number, p: Pose, tau: number): void {
  const spread = p.mood === 'volley' ? 1.25 : p.mood === 'plunge' ? 0.55 : 1;
  const beat = Math.sin(tau) * 0.12;
  // Back along the body, and out: the near fin a little lower, the far one higher.
  const base = Math.atan2(at.ty, at.tx) + (side > 0 ? 0.55 : -0.25);
  const ribs: P[] = [];
  const ox = at.x + at.nx * at.r * (side > 0 ? -0.2 : 0.4);
  const oy = at.y + at.ny * at.r * (side > 0 ? -0.2 : 0.4);
  for (let k = 0; k < 4; k++) {
    const a = base + (k - 1.5) * 0.32 * spread + beat * (side > 0 ? 1 : -1);
    const L = (side > 0 ? 30 : 24) - Math.abs(k - 1) * 3;
    ribs.push([ox + Math.cos(a) * L, oy + Math.sin(a) * L - (side > 0 ? 0 : 6)]);
  }
  // The membrane: light, fading toward its edge.
  for (let k = 0; k < ribs.length - 1; k++) {
    const [ax, ay] = ribs[k];
    const [bx, by] = ribs[k + 1];
    for (let u = 0.15; u <= 1; u += 0.06) {
      for (let v = 0; v <= 1; v += 0.08) {
        const x = ox + ((ax - ox) * (1 - v) + (bx - ox) * v) * u;
        const y = oy + ((ay - oy) * (1 - v) + (by - oy) * v) * u;
        if (side < 0 && c.filled(Math.floor(x), Math.floor(y))) continue;
        c.spark(x, y, u > 0.75 ? C_VIOLET : k % 2 ? C_TEAL : C_AURORA, (side > 0 ? 0.16 : 0.1) * (1.1 - u * 0.5));
      }
    }
  }
  // The ribs.
  c.part();
  for (const [x, y] of ribs) {
    c.capsule(ox, oy, x, y, side > 0 ? 1.3 : 1.1, 0.5, side > 0 ? CRYSTAL_T : CRYSTAL_V, { bias: side > 0 ? 0 : -1 });
    c.spark(x, y, C_WHITE, 0.7);
  }
}

function drawHead(c: PixelCanvas, hx: number, hy: number, tilt: number, p: Pose, tau: number, neck: Sample): void {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  // Head-local (forward, down) to frame coordinates.
  const at = (f: number, d: number): P => [hx + (f * cos - d * sin) * HS, hy + (f * sin + d * cos) * HS];
  const jaw = p.jaw;
  const fierce = p.mood !== 'fly' && p.mood !== 'crashed';

  // The mane: streamers of light flowing back off the skull.
  for (let k = 0; k < 9; k++) {
    const [sx, sy] = at(-4 + (k % 3), -5 + k);
    for (let j = 1; j < 22; j++) {
      const x = sx - j * 1.1 + (neck.x < hx ? 0 : 0);
      const y = sy - j * 0.35 + Math.sin(tau + k * 0.7 + j * 0.25) * (1 + j * 0.08);
      if (c.filled(Math.floor(x), Math.floor(y))) continue;
      c.spark(x, y, k % 3 === 0 ? C_VIOLET : k % 3 === 1 ? C_AURORA : C_TEAL, (1 - j / 22) * 0.5);
    }
  }
  // Antlers: two branching crystals sweeping back and up, the far one first.
  const antler = (side: number) => {
    const sh = side > 0 ? 0 : -3;
    const [bx, by] = at(-3 + sh, -6);
    const [mx, my] = at(-14 + sh, -15);
    const [tx, ty] = at(-24 + sh, -19 + Math.sin(tau) * 0.5);
    const m = side > 0 ? CRYSTAL_V : CRYSTAL_T;
    c.part();
    crystal(c, bx, by, mx, my, (side > 0 ? 2.3 : 1.9) * HS, m, null);
    c.part();
    crystal(c, mx + (bx - mx) * 0.15, my + (by - my) * 0.15, tx, ty, (side > 0 ? 1.6 : 1.3) * HS, m, C_WHITE);
    // Tines off the beam, pointing up.
    for (const [f, d, l] of [
      [-8, -10, 7],
      [-16, -16, 6],
    ] as const) {
      const [ax, ay] = at(f + sh, d);
      c.part();
      crystal(c, ax, ay, ax + 1 - l * 0.2, ay - l * HS, 1.1 * HS, m, C_WHITE);
    }
  };
  antler(-1);

  // The lower jaw, dropped open to breathe.
  c.part();
  const [j0x, j0y] = at(-2, 4);
  const [j1x, j1y] = at(15, 5 + jaw);
  c.capsule(j0x, j0y, j1x, j1y, 3.6 * HS, 2 * HS, SCALE_TEAL);
  const [c0x, c0y] = at(0, 5 + jaw * 0.3);
  const [c1x, c1y] = at(12, 6 + jaw * 0.9);
  c.capsule(c0x, c0y, c1x, c1y, 1.8 * HS, 1.2 * HS, BELLY);
  if (jaw > 2) {
    c.part();
    const [m0x, m0y] = at(2, 2.5 + jaw * 0.35);
    const [m1x, m1y] = at(13, 3 + jaw * 0.6);
    c.capsule(m0x, m0y, m1x, m1y, (2 + jaw * 0.15) * HS, (1.2 + jaw * 0.2) * HS, MAW);
    for (let k = 0; k < 4; k++) {
      const [tx, ty] = at(5 + k * 2.6, 1.5);
      c.px(tx, ty, TOOTH);
      const [bx, by] = at(5 + k * 2.6, 3.5 + jaw * 0.85);
      c.px(bx, by, TOOTH);
    }
  }
  // The skull and the long snout.
  c.part();
  c.ellipse(hx, hy, 8 * HS, 6.5 * HS, SCALE_TEAL, { normal: (_x, _y, dx, dy) => sphere(dx, dy, 0.9) });
  c.part();
  const [n0x, n0y] = at(3, 0.5);
  const [n1x, n1y] = at(17, 2);
  c.capsule(n0x, n0y, n1x, n1y, 5 * HS, 3 * HS, SCALE_TEAL);
  // A pale chin and a ridge of crystal down the nose.
  c.part();
  const [b0x, b0y] = at(-1, -4.5);
  const [b1x, b1y] = at(9, -3.5);
  c.capsule(b0x, b0y, b1x, b1y, 1.8 * HS, 1.3 * HS, SCALE_GREEN);
  for (let k = 0; k < 3; k++) {
    const [kx, ky] = at(8 + k * 3, -2 + k * 0.4);
    const [tx, ty] = at(6 + k * 3, -5.5 + k * 0.5);
    c.part();
    crystal(c, kx, ky, tx, ty, 0.9, CRYSTAL_V, null);
  }
  antler(1);
  // The eye: a slit of green fire under the brow.
  c.part();
  const [ex, ey] = at(4, -1.5);
  c.ellipse(ex + 0.5, ey, 2.4, 1.5, HOLLOW);
  const dim = p.mood === 'crashed' ? 0.4 : 1;
  c.px(ex - 1, ey, GLOW_AURORA, { x: 0, y: 0, z: 1 }, { glow: dim });
  c.px(ex, ey, GLOW_AURORA, { x: 0, y: 0, z: 1 }, { glow: dim });
  c.px(ex + 1, ey + (fierce ? 0 : 0.5), GLOW_AURORA, { x: 0, y: 0, z: 1 }, { glow: dim });
  c.spark(ex, ey, C_WHITE, dim);
  c.spark(ex + 2, ey - 1, C_AURORA, 0.6 * dim);
  c.spark(ex - 2, ey, C_AURORA, 0.4 * dim);
  // Nostrils smoking with light, and whiskers of light trailing back from the snout.
  const [nx, ny] = at(16, 0.5);
  c.spark(nx, ny, C_AURORA, 0.8);
  for (const side of [-1, 1]) {
    const [wx, wy] = at(13, side > 0 ? 3 : 1);
    for (let j = 1; j < 30; j++) {
      const x = wx - j * 1.05 + j * j * 0.004;
      const y = wy + j * 0.35 * side + Math.sin(tau + j * 0.22 + side) * (0.6 + j * 0.09) + 2;
      if (side < 0 && c.filled(Math.floor(x), Math.floor(y))) continue;
      c.spark(x, y, j < 10 ? C_WHITE : j < 20 ? C_TEAL : C_VIOLET, (1 - j / 30) * 0.8);
    }
  }
  if (p.mood === 'rear' || p.mood === 'breath') {
    // Light gathering at its jaws (or pouring out of them).
    const R = rng(p.mood.length * 7);
    const n = p.mood === 'breath' ? 18 : 10;
    for (let k = 0; k < n; k++) {
      const d = R();
      const [px, py] = p.mood === 'breath' ? at(16 + d * 26, 3 + jaw * 0.5 + (R() - 0.5) * (4 + d * 14)) : at(17 + (R() - 0.5) * 10, 3 + (R() - 0.5) * 10);
      c.spark(px, py, k % 3 === 0 ? C_WHITE : k % 3 === 1 ? C_AURORA : C_TEAL, 0.4 + R() * 0.6);
    }
  }
}

// ---------------------------------------------------------------- Poses

/** Swimming through the air: a wave travels down the body from the head to the tail. */
function fly(t: number): Pose {
  const base: P[] = [
    [146, 36],
    [129, 48],
    [111, 63],
    [90, 73],
    [68, 73],
    [48, 63],
    [31, 58],
    [17, 67],
    [11, 84],
    [18, 101],
    [34, 109],
    [52, 107],
  ];
  const tau = t * Math.PI * 2;
  const path = base.map(([x, y], i): P => {
    const env = Math.min(1, i / 3);
    return [x + Math.cos(tau - i * 0.8) * 1.5 * env, y + Math.sin(tau - i * 0.8) * 5 * env];
  });
  path[0] = [path[0][0], path[0][1] + Math.sin(tau) * 1.5];
  return { t, mood: 'fly', path, tilt: 0.12 + Math.sin(tau - 0.8) * 0.06, jaw: 0, flare: 0.3 };
}

const POSES: Record<string, () => Pose> = {
  rear: () => ({
    t: 0.25,
    mood: 'rear',
    path: [[122, 26], [128, 42], [128, 60], [114, 76], [92, 84], [70, 82], [50, 71], [32, 66], [17, 75], [11, 92], [18, 109], [34, 117], [52, 115]],
    tilt: -0.15,
    jaw: 3,
    flare: 0.7,
  }),
  breath0: () => ({
    t: 0.5,
    mood: 'breath',
    path: [[146, 66], [132, 58], [116, 56], [98, 63], [78, 74], [58, 74], [42, 63], [26, 58], [14, 67], [9, 84], [17, 101], [33, 109], [51, 107]],
    tilt: 0.5,
    jaw: 8,
    flare: 1,
  }),
  breath1: () => ({
    t: 0.75,
    mood: 'breath',
    path: [[147, 68], [133, 59], [117, 57], [99, 64], [79, 75], [59, 75], [43, 65], [27, 60], [15, 69], [10, 86], [18, 103], [34, 110], [52, 108]],
    tilt: 0.52,
    jaw: 9,
    flare: 1,
  }),
  coil: () => ({
    t: 0.1,
    mood: 'coil',
    path: [[104, 30], [96, 42], [98, 60], [112, 72], [124, 88], [116, 106], [94, 114], [72, 108], [54, 96], [36, 92], [20, 102], [14, 118], [22, 130]],
    tilt: 1.0,
    jaw: 2,
    flare: 0.8,
  }),
  plunge: () => ({
    t: 0.6,
    mood: 'plunge',
    path: [[112, 124], [106, 110], [98, 94], [90, 78], [80, 62], [68, 48], [56, 37], [43, 29], [30, 24], [18, 22], [8, 26]],
    tilt: 1.15,
    jaw: 4,
    flare: 1,
  }),
  crashed: () => ({
    t: 0.4,
    mood: 'crashed',
    path: [[130, 132], [116, 131], [102, 124], [92, 110], [88, 92], [84, 74], [74, 60], [58, 54], [42, 58], [32, 70], [28, 86], [30, 102], [38, 118], [50, 128], [64, 132]],
    tilt: 0.2,
    jaw: 2,
    flare: 0.2,
  }),
};

/** Curled in a ring, its scales flaring as it looses its volley. */
function volley(t: number, flare: number): Pose {
  const path: P[] = [[128, 66]];
  for (let k = 0; k <= 12; k++) {
    // Round from the neck, down and under, up the far side and over the top, the tail inside the ring.
    const a = -0.1 + (k / 12) * Math.PI * 1.85;
    const r = 34 - k * 0.6;
    path.push([84 + Math.cos(a) * r * 1.15, 70 + Math.sin(a) * r]);
  }
  path.push([96, 58]);
  return { t, mood: 'volley', path, tilt: 0, jaw: 4, flare };
}

export function buildAurelithSheet(): MonsterSheet {
  const poses: Record<string, () => PixelCanvas> = {};
  for (let i = 0; i < 8; i++) poses[`fly${i}`] = () => serpent(fly(i / 8));
  for (const [name, pose] of Object.entries(POSES)) poses[name] = () => serpent(pose());
  poses.volley0 = () => serpent(volley(0.2, 0.7));
  poses.volley1 = () => serpent(volley(0.6, 1));
  const flyFrames = Array.from({ length: 8 }, (_, i) => `fly${i}`);
  return sheet(MONSTER_FRAME.aurelith, poses, [
    { name: 'idle', frames: flyFrames, fps: 7, loop: true },
    { name: 'walk', frames: flyFrames, fps: 10, loop: true },
    { name: 'breath', frames: ['breath0', 'breath1'], fps: 8, loop: true },
    { name: 'volley', frames: ['volley0', 'volley1'], fps: 8, loop: true },
  ]);
}

// ---------------------------------------------------------------- Spells (pure light)

/** The breath's ribbon: a band of aurora light that tiles along its length (white core, green, teal and violet edges). */
export const AU_BEAM_W = 48;
export const AU_BEAM_H = 16;

function beamArt(): Uint8ClampedArray {
  const w = AU_BEAM_W;
  const h = AU_BEAM_H;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let x = 0; x < w; x++) {
    // Two waves whose periods divide the width, so the band tiles without a seam.
    const mid = h / 2 + Math.sin((x / w) * Math.PI * 4) * 1.6 + Math.sin((x / w) * Math.PI * 6) * 0.8;
    const half = 4.2 + Math.sin((x / w) * Math.PI * 2) * 1;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y + 0.5 - mid) / half;
      if (d > 1.6) continue;
      let c: RGB;
      let a: number;
      if (d < 0.35) [c, a] = [C_WHITE, 1];
      else if (d < 0.8) [c, a] = [C_AURORA, 0.95];
      else if (d < 1.15) [c, a] = [C_TEAL, 0.7];
      else [c, a] = [y < mid ? C_VIOLET : C_PINK, 0.45 * (1.6 - d) / 0.45];
      if (hash2(x, y, 61) > 0.93) a *= 0.5;
      px.set([c[0] * a, c[1] * a, c[2] * a, 255], (y * w + x) * 4);
    }
  }
  return px;
}

/** A shard of prismatic crystal in flight, pointing right, in three colours (frames s0..s2). */
export const AU_SHARD_W = 14;
export const AU_SHARD_H = 7;

function shardArt(v: number): Uint8ClampedArray {
  const w = AU_SHARD_W;
  const h = AU_SHARD_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const col = [C_AURORA, C_TEAL, C_VIOLET][v];
  const edge = hex(['#1a9a6a', '#1a8aa0', '#6a3ad0'][v]);
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    // A long diamond: widest just past the middle, needle at the front, a frayed tail of light.
    const hw = u < 0.6 ? u * 4.6 : 2.8 * (1 - (u - 0.6) / 0.4);
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y - 3);
      if (d > hw) continue;
      if (u < 0.3 && (x + y) % 2) continue;
      const c = d < hw * 0.35 ? C_WHITE : d > hw - 0.9 ? edge : col;
      px.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return px;
}

/** A mote of aurora falling from on high: a bright bead with a soft cross of light. */
export const AU_MOTE = 11;

function moteArt(): Uint8ClampedArray {
  const w = AU_MOTE;
  const px = new Uint8ClampedArray(w * w * 4);
  const m = 5;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - m);
      const dy = Math.abs(y - m);
      const r = Math.hypot(dx, dy);
      let a = Math.max(0, 1 - r / 2.6);
      if (dx === 0 || dy === 0) a = Math.max(a, 0.6 * (1 - Math.max(dx, dy) / 6));
      if (a <= 0) continue;
      const c = r < 1.2 ? C_WHITE : C_AURORA;
      px.set([c[0] * a, c[1] * a, c[2] * a, 255], (y * w + x) * 4);
    }
  }
  return px;
}

export function aurelithFx(r: FxRegistrar): void {
  r.image('au_beam', AU_BEAM_W, AU_BEAM_H, beamArt());
  r.strip('au_shard', AU_SHARD_W, AU_SHARD_H, [0, 1, 2].map(shardArt), 's');
  r.image('au_mote', AU_MOTE, AU_MOTE, moteArt());
}
