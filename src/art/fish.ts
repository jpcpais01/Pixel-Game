// The fish (see game/fish.ts), drawn side on and facing right like a plate in
// an angler's book: a body shaded round, back and belly in their own colours,
// its markings (bars, spots, scales, patches), fins with rays behind and in
// front of it, gill, eye and whiskers. Two frames each, the second with the
// tail flicked up, for a fish thrashing on the line or flapping in the hand.
// Also the reel gauge's fish shadows, the Inventory's plaques and the touch
// button's rod icon. Made the first time a Home or the Fish page needs them.

import type Phaser from 'phaser';
import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { hash2 } from './env';
import { packAtlas, registerAtlas } from './atlas';
import { pixelCanvas } from './canvas';
import { FISH } from '../game/fish';

export const FISH_W = 40;
export const FISH_H = 24;
export const FISH_FRAMES = 2;
/** The gauge's fish shadows. */
export const SHADOW_W = 16;
export const SHADOW_H = 9;
/** The Inventory's plaque, a fish mounted on each. */
export const PLAQUE_W = 50;
export const PLAQUE_H = 30;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const mat = (o: string, ...c: string[]): Material => ({ ramp: ramp(...c), outline: hex(o) });
const glowing = (m: Material, g: number): Material => ({ ...m, emissive: g, noAO: true });

const n3 = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};

// ---------------------------------------------------------------- Materials

const SILVER: Material = { ...mat('#10161e', '#2a3440', '#46525e', '#66727e', '#8a96a0', '#aeb8c0', '#ced6dc', '#eaf0f4'), shine: true };
const OLIVE_SILVER = mat('#0c140e', '#1e2a22', '#34443a', '#4c5e50', '#687a66', '#8a9a80');
const PERCH_BACK = mat('#0c1606', '#1e3210', '#30481a', '#446226', '#5c7c32', '#7a9a40', '#9ab44e');
const PERCH_BELLY = mat('#1a1808', '#4a4420', '#7a7036', '#aa9c52', '#d0c476', '#ece0a0', '#faf2cc');
const BAR = mat('#060a04', '#101a0a', '#1a2a10', '#243818');
const ORANGE_FIN: Material = { ...mat('#200802', '#5a1a06', '#8e2e0c', '#c04a16', '#e06a24', '#f48c3c'), noAO: true };
const SUN_BACK = mat('#041410', '#0a2a2a', '#124240', '#1c5a56', '#2a746a', '#3c8e7e', '#56a892');
const SUN_BELLY: Material = { ...mat('#200a02', '#5a2204', '#8e3a08', '#c05a10', '#e27c1c', '#f8a038', '#ffc868'), shine: true };
const SUN_FIN: Material = { ...mat('#06100c', '#142a22', '#223e30', '#34543c', '#4a6a44', '#66824e'), noAO: true };
const TURQ = mat('#062020', '#1a5a58', '#2e8a82', '#4ab4a6', '#72d8c6');
const INK = mat('#020204', '#06060a', '#0e0e14', '#18181e');
const CARP_BACK: Material = { ...mat('#140c02', '#302008', '#4a3410', '#664a18', '#846224', '#a07c32', '#bc9844', '#d6b45a'), shine: true };
const CARP_BELLY = mat('#1a1406', '#4a3c18', '#76622c', '#a08a44', '#c4ae62', '#e0cc84', '#f2e2a8');
const DUSK_FIN: Material = { ...mat('#140a04', '#34200e', '#543418', '#744a24', '#946030'), noAO: true };
const CAT_BACK = mat('#06080a', '#12161a', '#1e242a', '#2c343c', '#3c464e', '#4e5a62', '#626e76');
const CAT_BELLY = mat('#16181a', '#3a3e42', '#5a5e62', '#7c8084', '#9ea2a4', '#bec0c0', '#dadad6');
const CAT_FIN: Material = { ...mat('#040506', '#101418', '#1c2228', '#2a3238', '#3a444c'), noAO: true };
const WHISKER = mat('#08090a', '#2a2e32', '#4a5056', '#6c747a', '#9aa2a8');
const TROUT_BACK = mat('#0a1206', '#1a2a12', '#2a401c', '#3a5426', '#4e6a32', '#648240', '#7c9a50');
const TROUT_BAND: Material = { ...mat('#1a060c', '#4a1224', '#7a2238', '#a8364e', '#cc5068', '#e8748a', '#fa9eb0'), shine: true };
const TROUT_FIN: Material = { ...mat('#0c0e08', '#2a2e1c', '#484c30', '#686a46', '#8a8a5c'), noAO: true };
const PEARL: Material = { ...mat('#1a1a1e', '#5a5a64', '#84848e', '#a8a8b2', '#c8c8d0', '#e2e2e8', '#f4f4f8', '#ffffff'), shine: true };
const KOI_RED: Material = { ...mat('#200402', '#5a0e06', '#8a1a0a', '#b82a10', '#dc441c', '#f06a30', '#ff9450'), shine: true };
const KOI_FIN: Material = { ...mat('#2a1a1a', '#7a6468', '#a88c8e', '#ccb0ae', '#e8d0c8', '#f8e6de'), noAO: true };
const PIKE_BACK = mat('#060e04', '#10200a', '#1c3212', '#28461a', '#365c22', '#46722c', '#588a38');
const PIKE_BELLY = mat('#141608', '#3c4020', '#646a3a', '#8c9258', '#b4b87c', '#d4d6a0', '#ecead0');
const PIKE_SPOT = mat('#1a1c0a', '#6a7040', '#98a060', '#c0c888', '#dce2aa');
const PIKE_FIN: Material = { ...mat('#100a04', '#3a2410', '#62381a', '#8a5026', '#b06a32'), noAO: true };
const EMBER_BODY: Material = { ...mat('#0a0204', '#1c060a', '#300c10', '#461416', '#5e1e1a', '#782a1e', '#943a24') };
const EMBER_BELLY = mat('#140404', '#3a0e0a', '#5e1c12', '#82301a', '#a44824', '#c4642e');
const EMBER_FIN = glowing({ ...mat('#2a0802', '#6a1a04', '#b03a08', '#e26414', '#ff8c2a', '#ffb454', '#ffd88a') }, 0.75);
const MOON_BACK: Material = { ...mat('#060a14', '#10182a', '#1c2842', '#2a3a5a', '#3c5074', '#54688e', '#7086aa', '#90a8c6'), shine: true };
const MOON_BELLY: Material = { ...mat('#101420', '#3a4458', '#626e86', '#8c98ae', '#b4c0d2', '#d6e0ec', '#f0f6fc'), shine: true };
const MOON_FIN = glowing({ ...mat('#0a1428', '#1e3456', '#345482', '#5078aa', '#7aa2d0', '#a8c8ec', '#d8ecff') }, 0.45);
const MOON_DOT = glowing(mat('#1a2a44', '#a8d0ff', '#d8ecff', '#ffffff'), 1);
const EEL: Material = { ...mat('#0a2420', '#1a4a44', '#2a6a62', '#3c8a80', '#58aa9c', '#7cc8b8', '#a8e4d6', '#d4f6ee'), noAO: true };
const EEL_SPINE = glowing(mat('#0a2a24', '#6ad8c0', '#a8f4e2', '#e0fff6'), 0.6);
const EEL_HEART = glowing(mat('#3a0a1a', '#ff6a9a', '#ffa8c4', '#ffe0ea'), 1);
const GOLD_SCALE: Material = { ...mat('#1a0e02', '#3e2404', '#6a3e08', '#94580e', '#ba7616', '#d89622', '#f0b834', '#fcd65a', '#fff0a0'), shine: true, emissive: 0.12 };
const GOLD_BELLY: Material = { ...mat('#241804', '#5a3e0e', '#8a6418', '#b48a28', '#d8ae40', '#f0cc62', '#fce48e', '#fff4c8'), emissive: 0.1 };
const GOLD_FIN = glowing({ ...mat('#240402', '#5e0c06', '#921a0a', '#c02e12', '#e24a1e', '#f87034', '#ff9c56', '#ffc888') }, 0.3);
const EYE = mat('#000000', '#020203', '#08080c', '#101016');
const EYE_RING = mat('#1a1204', '#6a5020', '#a88a3a', '#e0c460', '#fff0a0');

// ---------------------------------------------------------------- The painter

/** A marking's say over one pixel of the body: another material, a nudge to its shade, a glow. */
interface Mark {
  m?: Material;
  bias?: number;
  glow?: number;
}

interface Fin {
  /** Along the body, 0 at the tail's root .. 1 at the nose. */
  from: number;
  to: number;
  /** How tall it stands, px. */
  h: number;
  /** Spiny fins stand in spikes; soft ones are one rounded sail; long ones trail back. */
  kind: 'spiny' | 'soft' | 'trail';
}

interface Look {
  /** Body length (tail's root to nose) and greatest depth, px. */
  len: number;
  depth: number;
  /** Where along the body it's deepest, and how thick the tail's root is (a share of the depth). */
  deep: number;
  ped: number;
  /** How round the body is toward the tail and toward the head (higher is blunter). */
  kt: number;
  kh: number;
  /** How much of the depth is back above the midline (the rest is belly). */
  hump: number;
  tail: { len: number; spread: number; kind: 'fork' | 'round' | 'fan' | 'none' };
  back: Material;
  belly: Material;
  fin: Material;
  /** Where the back's colour gives way to the belly's, -1 (top) .. 1 (bottom). */
  split: number;
  dorsal: Fin | null;
  anal: Fin | null;
  /** Pelvic and pectoral fins. */
  small: boolean;
  /** Whiskers from the mouth: how many pairs and how long. */
  barbels?: { n: number; len: number; m?: Material };
  mark?: (x: number, y: number, u: number, v: number) => Mark | null;
  /** Big scales traced over the body. */
  scales?: number;
  /** A stripe along the lateral line. */
  lateral?: Material;
  eyeRing?: boolean;
  /** Sparks of light (the legend's gleam). */
  gleam?: RGB;
}

/**
 * One fish, facing right, centred in its frame. Frame 1 flicks the tail up.
 * Fins behind first, then the body, then what sits on it.
 */
function paintFish(look: Look, f: number): PixelCanvas {
  const c = new PixelCanvas(FISH_W, FISH_H);
  const L = look;
  const total = L.len + L.tail.len;
  const xT = Math.round((FISH_W - total) / 2);
  const xB = xT + L.tail.len;
  const xN = xB + L.len;
  const cy = FISH_H / 2 + 0.5;
  const bend = f === 1 ? -2.6 : 0;
  // The midline, bent toward the tail on the flicked frame.
  const mid = (x: number) => cy + bend * Math.pow(Math.max(0, (xN - x) / total), 2);
  const halfH = (u: number) => {
    const m = L.deep;
    const e = u < m ? (m - u) / m : (u - m) / (1 - m);
    const k = u < m ? L.kt : L.kh;
    const s = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, e), k)), 1 / k);
    return (L.depth / 2) * (u < m ? L.ped + (1 - L.ped) * s : s);
  };
  const top = (x: number) => mid(x) - halfH((x + 0.5 - xB) / L.len) * 2 * L.hump;
  const bot = (x: number) => mid(x) + halfH((x + 0.5 - xB) / L.len) * 2 * (1 - L.hump);
  const bodyX = (u: number) => xB + u * L.len;

  // Tail.
  if (L.tail.kind !== 'none') {
    c.part();
    const T = L.tail;
    const root = halfH(0) * 1.1;
    for (let x = xT; x < xB + 1; x++) {
      const d = Math.min(1, (xB + 0.5 - x) / T.len); // 0 at the root .. 1 at the tip
      let ext = root + (T.spread - root) * Math.pow(d, T.kind === 'fan' ? 0.5 : 0.8);
      if (T.kind === 'round' && d > 0.55) ext *= Math.sqrt(Math.max(0, 1 - Math.pow((d - 0.55) / 0.45, 2))) * 0.6 + 0.4;
      const my = mid(x);
      for (let y = Math.floor(my - ext - 1); y <= my + ext + 1; y++) {
        const dy = y + 0.5 - my;
        let e = ext;
        // The fan's edge ripples.
        if (T.kind === 'fan') e *= 1 + Math.sin(dy * 0.9 + f * 1.4) * 0.08 * d;
        if (Math.abs(dy) > e) continue;
        // The fork: a notch cut deeper toward the tip.
        if (T.kind === 'fork' && d > 0.4 && Math.abs(dy) < T.spread * 0.85 * Math.pow((d - 0.4) / 0.6, 1.3)) continue;
        // A veil tail parts in a shallow notch and trails in two soft lobes.
        if (T.kind === 'fan' && d > 0.65 && Math.abs(dy) < T.spread * 0.45 * ((d - 0.65) / 0.35)) continue;
        // Rays fanning from the root.
        const ang = Math.atan2(dy, Math.max(0.5, xB + 1 - x));
        const ray = Math.floor((ang + 2) * (T.kind === 'fan' ? 5 : 4)) % 2 === 0;
        c.px(x, y, L.fin, n3(-0.25, -dy / (e + 1) * 0.5, 0.85), { bias: (ray ? 1 : 0) + (d > 0.85 ? 1 : 0) });
      }
    }
  }

  // The fins along the back and underneath, behind the body.
  const fin = (F: Fin, under: boolean) => {
    c.part();
    const x0 = Math.floor(bodyX(F.from));
    const x1 = Math.ceil(bodyX(F.to));
    for (let x = x0; x < x1; x++) {
      const t = (x + 0.5 - bodyX(F.from)) / (bodyX(F.to) - bodyX(F.from));
      let h: number;
      if (F.kind === 'spiny') h = F.h * (t < 0.25 ? 0.55 + (t / 0.25) * 0.45 : 1 - (t - 0.25) * 0.55) * (x % 2 ? 0.72 : 1);
      else if (F.kind === 'soft') h = F.h * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.6);
      else h = F.h * (0.35 + t * 0.65) * (1 + Math.sin(t * 6 + f) * 0.08);
      // Trailing fins sweep back: their tips lean toward the tail.
      const edge = under ? bot(x) : top(x);
      for (let k = 0; k < h + 1.5; k++) {
        const y = under ? Math.floor(edge) + k - 1 : Math.ceil(edge) - k;
        const lean = F.kind === 'trail' ? Math.round(-k * 0.5) : 0;
        c.px(x + lean, y, L.fin, n3(0, under ? -0.3 : 0.3, 0.9), { bias: (x % 2 ? 0 : 1) + (k > h - 1 ? 1 : 0) });
      }
    }
  };
  if (L.dorsal) fin(L.dorsal, false);
  if (L.anal) fin(L.anal, true);
  // The far pelvic fin, just peeking under the belly.
  if (L.small) {
    c.part();
    const px = Math.round(bodyX(0.5));
    for (let k = 0; k < 3; k++) for (let j = 0; j <= k; j++) c.px(px - k, Math.ceil(bot(px)) + j - 1 + (k > 1 ? 1 : 0), L.fin, n3(-0.2, -0.3, 0.9), { bias: -1 });
  }

  // The body, round in section: the back's colour above, the belly's below, with its markings.
  c.part();
  for (let x = xB; x < xN; x++) {
    const u = (x + 0.5 - xB) / L.len;
    const t0 = top(x);
    const b0 = bot(x);
    // The nose and the tail's root turn away from the viewer.
    const du = u > 0.82 ? ((u - 0.82) / 0.18) * 0.7 : u < 0.12 ? -((0.12 - u) / 0.12) * 0.4 : 0;
    for (let y = Math.floor(t0); y <= Math.ceil(b0); y++) {
      const yc = y + 0.5;
      if (yc < t0 || yc > b0) continue;
      const v = (yc - (t0 + b0) / 2) / Math.max(0.5, (b0 - t0) / 2);
      const n = n3(du, -v * 0.85, Math.sqrt(Math.max(0.08, 1 - v * v * 0.8)));
      const wob = Math.sin(x * 0.7) * 0.06;
      let m = v < L.split + wob ? L.back : L.belly;
      let bias = 0;
      let glow: number | undefined;
      if (L.lateral && Math.abs(v - (L.split - 0.2)) < 0.16) m = L.lateral;
      if (L.scales) {
        // Scales in offset rows: each one's upper edge catches the light.
        const s = L.scales;
        const row = Math.floor((y - t0) / (s * 0.8));
        const col = (x + (row % 2) * s * 0.5) / s;
        const fx = col - Math.floor(col);
        const fy = (y - t0) / (s * 0.8) - row;
        if (fy < 0.3 && fx > 0.2 && fx < 0.8) bias += 1;
        else if (fy > 0.8) bias -= 1;
      }
      const mk = L.mark?.(x, y, u, v);
      if (mk) {
        if (mk.m) m = mk.m;
        bias += mk.bias ?? 0;
        glow = mk.glow;
      }
      c.px(x, y, m, n, glow !== undefined ? { bias, glow } : { bias });
    }
  }

  // The gill cover's edge: a curve of shade behind the head.
  const gu = L.len > 24 ? 0.76 : 0.74;
  for (let y = Math.floor(top(bodyX(gu))) + 1; y < bot(bodyX(gu)) - 1; y++) {
    const v = (y + 0.5 - mid(bodyX(gu))) / (L.depth / 2);
    const gx = Math.round(bodyX(gu) + v * v * 1.6);
    c.shade(gx, y, -2);
    c.shade(gx + 1, y, 1);
  }

  // The near pectoral fin, fanning back from behind the gill.
  if (L.small) {
    c.part();
    const px = bodyX(gu) - 1;
    const py = mid(px) + L.depth * 0.14;
    const r = Math.max(2.2, L.depth * 0.28);
    for (let k = 0; k < r * 1.8; k++) {
      const spread = (k / (r * 1.8)) * r * 0.55;
      for (let j = -spread; j <= spread; j += 1) c.px(px - k, py + j + k * 0.25, L.fin, n3(-0.3, 0.2, 0.9), { bias: Math.round(j) % 2 === 0 ? 2 : 1 });
    }
  }

  // Eye: dark, a bright glint, ringed on the bigger fish.
  c.part();
  const ex = Math.round(bodyX(L.len > 22 ? 0.9 : 0.88));
  const ey = Math.round(mid(ex) - L.depth * 0.14);
  const big = L.depth >= 9;
  if (L.eyeRing || big) {
    for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2]]) c.px(ex + dx, ey + dy, L.eyeRing ? EYE_RING : L.back, sphere(dx * 0.4, dy * 0.4), { bias: 1 });
  }
  const eyePx = big ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
  for (const [dx, dy] of eyePx) c.px(ex + dx, ey + dy, EYE, n3(0, 0, 1));
  c.spark(ex, ey, [255, 255, 255], 0.9);
  // The mouth: a short dark line at the nose.
  c.shade(xN - 1, Math.round(mid(xN - 1) + L.depth * 0.08), -3);
  c.shade(xN - 2, Math.round(mid(xN - 2) + L.depth * 0.1), -2);

  // Whiskers curling down and back from the mouth.
  if (L.barbels) {
    c.part();
    for (let b = 0; b < L.barbels.n; b++) {
      const bx = xN - 1 - b * 2;
      const by = Math.round(mid(bx) + L.depth * 0.14);
      const len = L.barbels.len - b * 1.5;
      for (let k = 1; k <= len; k++) {
        const t = k / len;
        c.px(bx + Math.round(Math.sin(t * 2.2) * 2 - t * len * 0.35), by + Math.round(t * len * 0.55 + Math.sin(t * 3 + f) * 0.6), L.barbels.m ?? WHISKER, n3(0.2, 0.3, 0.9), { bias: 1 });
      }
    }
  }

  // The legend's gleam: sparks glinting off its scales.
  if (L.gleam) {
    for (let k = 0; k < 6; k++) {
      const x = xB + 3 + Math.floor(hash2(k, f, 5501) * (L.len - 6));
      const y = Math.round(mid(x) - L.depth * (0.1 + hash2(k, 3, 5502) * 0.3));
      c.spark(x, y, L.gleam, 0.7);
    }
  }
  return c;
}

// ---------------------------------------------------------------- The fish

const LOOKS: Record<string, Look> = {
  minnow: {
    len: 14, depth: 5, deep: 0.55, ped: 0.4, kt: 1.6, kh: 1.8, hump: 0.5,
    tail: { len: 5, spread: 3.2, kind: 'fork' },
    back: OLIVE_SILVER, belly: SILVER, fin: { ...SILVER, noAO: true }, split: -0.15,
    dorsal: { from: 0.4, to: 0.55, h: 2.5, kind: 'soft' }, anal: { from: 0.18, to: 0.3, h: 1.5, kind: 'soft' }, small: false,
    mark: (_x, _y, _u, v) => (Math.abs(v + 0.02) < 0.14 ? { m: INK, bias: 2 } : null),
  },
  perch: {
    len: 17, depth: 8, deep: 0.55, ped: 0.34, kt: 1.5, kh: 1.9, hump: 0.55,
    tail: { len: 5, spread: 4, kind: 'fork' },
    back: PERCH_BACK, belly: PERCH_BELLY, fin: ORANGE_FIN, split: 0.25,
    dorsal: { from: 0.38, to: 0.8, h: 4, kind: 'spiny' }, anal: { from: 0.16, to: 0.32, h: 2.5, kind: 'soft' }, small: true,
    // Dark bars down the flank, fading into the belly.
    mark: (x, _y, u, v) => (u > 0.08 && u < 0.78 && Math.floor((x + Math.round(v * 1.2)) / 2.6) % 2 === 0 && v < 0.45 ? { m: v < 0.25 ? BAR : PERCH_BACK, bias: v < 0.25 ? 0 : -1 } : null),
  },
  sunfish: {
    len: 15, depth: 11, deep: 0.52, ped: 0.26, kt: 1.9, kh: 1.9, hump: 0.52,
    tail: { len: 5, spread: 4.5, kind: 'round' },
    back: SUN_BACK, belly: SUN_BELLY, fin: SUN_FIN, split: 0.2,
    dorsal: { from: 0.22, to: 0.74, h: 3, kind: 'soft' }, anal: { from: 0.12, to: 0.4, h: 2.5, kind: 'soft' }, small: true,
    // Turquoise squiggles on the cheek, and the black ear-flap behind the gill.
    mark: (x, y, u, v) => {
      if (u > 0.66 && u < 0.74 && v > -0.5 && v < -0.05) return { m: INK };
      if (u > 0.74 && v > -0.3 && v < 0.4 && (x + y * 2) % 5 === 0) return { m: TURQ, bias: 1 };
      if (u < 0.66 && v < 0.1 && Math.floor(x * 0.5 + v * 3) % 3 === 0) return { bias: 1 };
      return null;
    },
  },
  carp: {
    len: 21, depth: 10, deep: 0.5, ped: 0.34, kt: 1.6, kh: 1.6, hump: 0.55,
    tail: { len: 6, spread: 5, kind: 'fork' },
    back: CARP_BACK, belly: CARP_BELLY, fin: DUSK_FIN, split: 0.3, scales: 3.4,
    dorsal: { from: 0.28, to: 0.72, h: 3, kind: 'soft' }, anal: { from: 0.14, to: 0.26, h: 2.5, kind: 'soft' }, small: true,
  },
  catfish: {
    len: 21, depth: 8, deep: 0.72, ped: 0.4, kt: 1.3, kh: 2.4, hump: 0.48,
    tail: { len: 5, spread: 3.6, kind: 'round' },
    back: CAT_BACK, belly: CAT_BELLY, fin: CAT_FIN, split: 0.2,
    dorsal: { from: 0.58, to: 0.7, h: 3, kind: 'soft' }, anal: { from: 0.05, to: 0.45, h: 2, kind: 'soft' }, small: true,
    barbels: { n: 2, len: 7 },
    // Freckles over the back.
    mark: (x, y, _u, v) => (v < 0.1 && hash2(x, y, 771) > 0.86 ? { m: INK, bias: 1 } : null),
  },
  trout: {
    len: 20, depth: 8, deep: 0.52, ped: 0.4, kt: 1.6, kh: 1.7, hump: 0.52,
    tail: { len: 5, spread: 4.2, kind: 'fork' },
    back: TROUT_BACK, belly: PEARL, fin: TROUT_FIN, split: 0.3, lateral: TROUT_BAND,
    dorsal: { from: 0.42, to: 0.62, h: 3, kind: 'soft' }, anal: { from: 0.16, to: 0.28, h: 2.5, kind: 'soft' }, small: true,
    // Black spots over the back and the rosy band.
    mark: (x, y, _u, v) => (v < 0.15 && hash2(x >> 1, y >> 1, 912) > 0.72 && (x + y) % 2 === 0 ? { m: INK, bias: 1 } : null),
  },
  koi: {
    len: 19, depth: 9, deep: 0.5, ped: 0.36, kt: 1.6, kh: 1.7, hump: 0.55,
    tail: { len: 8, spread: 6, kind: 'fan' },
    back: PEARL, belly: PEARL, fin: KOI_FIN, split: 0.6, scales: 3,
    dorsal: { from: 0.3, to: 0.72, h: 3.5, kind: 'trail' }, anal: { from: 0.14, to: 0.26, h: 3, kind: 'trail' }, small: true,
    // Bold red-orange patches: a crown on the head, saddles along the back.
    mark: (x, y, u, v) => {
      const blob = Math.sin(x * 0.55 + 1.3) + Math.sin(y * 0.7 + x * 0.21) * 0.7 + (u > 0.82 ? 1.2 : 0) - v * 1.4;
      return blob > 0.35 ? { m: KOI_RED } : null;
    },
  },
  pike: {
    len: 27, depth: 7, deep: 0.42, ped: 0.45, kt: 1.8, kh: 1.25, hump: 0.5,
    tail: { len: 6, spread: 4.2, kind: 'fork' },
    back: PIKE_BACK, belly: PIKE_BELLY, fin: PIKE_FIN, split: 0.3,
    dorsal: { from: 0.08, to: 0.24, h: 3.5, kind: 'soft' }, anal: { from: 0.06, to: 0.2, h: 3, kind: 'soft' }, small: true,
    // Rows of pale bean-shaped spots down its flank.
    mark: (x, y, u, v) => (u < 0.8 && v < 0.35 && (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0 && hash2(Math.floor(x / 3), Math.floor(y / 2), 331) > 0.45 ? { m: PIKE_SPOT } : null),
    eyeRing: true,
  },
  emberfin: {
    len: 17, depth: 8, deep: 0.5, ped: 0.36, kt: 1.6, kh: 1.8, hump: 0.52,
    tail: { len: 7, spread: 5.5, kind: 'fan' },
    back: EMBER_BODY, belly: EMBER_BELLY, fin: EMBER_FIN, split: 0.3,
    dorsal: { from: 0.3, to: 0.75, h: 4.5, kind: 'trail' }, anal: { from: 0.12, to: 0.3, h: 3.5, kind: 'trail' }, small: true,
    // Embers smouldering along its sides.
    mark: (x, y, _u, v) => (Math.abs(v) < 0.55 && hash2(x, y, 4401) > 0.84 ? { m: EMBER_FIN, glow: 0.9 } : null),
  },
  moonscale: {
    len: 18, depth: 9, deep: 0.5, ped: 0.36, kt: 1.6, kh: 1.8, hump: 0.52,
    tail: { len: 6, spread: 5, kind: 'fork' },
    back: MOON_BACK, belly: MOON_BELLY, fin: MOON_FIN, split: 0.05, scales: 2.8,
    dorsal: { from: 0.35, to: 0.65, h: 3.5, kind: 'soft' }, anal: { from: 0.14, to: 0.3, h: 2.5, kind: 'soft' }, small: true,
    // A row of glowing dots down the lateral line, like moonlight on ripples.
    mark: (x, _y, u, v) => (u > 0.1 && u < 0.8 && Math.abs(v - 0.28) < 0.12 && x % 3 === 0 ? { m: MOON_DOT } : null),
    eyeRing: true,
  },
  glasseel: {
    len: 32, depth: 4, deep: 0.62, ped: 0, kt: 1.1, kh: 2.2, hump: 0.5,
    tail: { len: 0, spread: 0, kind: 'none' },
    back: EEL, belly: EEL, fin: { ...EEL, noOutline: true }, split: 1,
    dorsal: { from: 0.02, to: 0.6, h: 1.4, kind: 'soft' }, anal: { from: 0.02, to: 0.5, h: 1.2, kind: 'soft' }, small: false,
    // You can see through it: its spine, and its heart glowing behind the head.
    mark: (_x, _y, u, v) => {
      if (u > 0.7 && u < 0.77 && Math.abs(v - 0.2) < 0.45) return { m: EEL_HEART };
      if (Math.abs(v + 0.05) < 0.3) return { m: EEL_SPINE };
      return v > 0.3 ? { bias: 1 } : null;
    },
  },
  goldmaw: {
    len: 27, depth: 13, deep: 0.5, ped: 0.32, kt: 1.6, kh: 1.7, hump: 0.56,
    tail: { len: 9, spread: 8, kind: 'fan' },
    back: GOLD_SCALE, belly: GOLD_BELLY, fin: GOLD_FIN, split: 0.35, scales: 4,
    dorsal: { from: 0.26, to: 0.74, h: 5, kind: 'spiny' }, anal: { from: 0.12, to: 0.3, h: 4, kind: 'trail' }, small: true,
    barbels: { n: 2, len: 8, m: GOLD_FIN },
    eyeRing: true,
    gleam: [255, 240, 170],
  },
};

/** A fish's frame (0 still, 1 flicked). */
export function fishFrame(id: string, f: number): PixelCanvas {
  return paintFish(LOOKS[id] ?? LOOKS.minnow, f);
}

// ---------------------------------------------------------------- The gauge's shadows

/** A fish's dark shape in the reel's gauge: its kind hidden until it's landed; the legend's is bigger. */
export function fishShadow(big: boolean): PixelCanvas {
  const c = new PixelCanvas(SHADOW_W, SHADOW_H);
  const SHADE: Material = { ...mat('#02060a', '#061018', '#0a1824', '#10222e'), noAO: true };
  const len = big ? 11 : 8;
  const depth = big ? 6 : 4;
  const x0 = big ? 4 : 6;
  const cy = SHADOW_H / 2;
  c.part();
  for (let x = x0; x < x0 + len; x++) {
    const u = (x + 0.5 - x0) / len;
    const hh = (depth / 2) * Math.sin(Math.PI * Math.pow(u, 0.8)) + 0.4;
    for (let y = Math.floor(cy - hh); y <= cy + hh; y++) if (Math.abs(y + 0.5 - cy) <= hh) c.px(x, y, SHADE, sphere(0, (y + 0.5 - cy) / hh, 0.8));
  }
  for (let x = x0 - (big ? 4 : 3); x < x0 + 1; x++) {
    const d = (x0 + 1 - x) / (big ? 4 : 3);
    const ext = 0.8 + d * (big ? 3 : 2);
    for (let y = Math.floor(cy - ext); y <= cy + ext; y++) if (Math.abs(y + 0.5 - cy) <= ext && !(d > 0.6 && Math.abs(y + 0.5 - cy) < 1)) c.px(x, y, SHADE, n3(0, 0, 1));
  }
  return c;
}

// ---------------------------------------------------------------- The plaque

const PLAQUE_WOOD = mat('#120904', '#2a170c', '#3d2413', '#52311a', '#6a4122', '#83532c', '#9c6737', '#b57d46');
const PLAQUE_EDGE = mat('#0a0503', '#1a0e07', '#2c180c', '#402414', '#56321c', '#6e4226');
const BRASS: Material = { ...mat('#1c1004', '#3a2408', '#5c3c10', '#84581a', '#a87624', '#c89634', '#e2b84e', '#f6dc84'), shine: true };

/** A varnished wooden plaque with a bevelled edge, brass screws and a nameplate: a landed fish is mounted on each. */
export function plaque(): PixelCanvas {
  const c = new PixelCanvas(PLAQUE_W, PLAQUE_H);
  const cx = PLAQUE_W / 2;
  const cy = PLAQUE_H / 2 - 1;
  const rx = PLAQUE_W / 2 - 1.5;
  const ry = PLAQUE_H / 2 - 2.5;
  // A shield-like oval: the bevel round it, the face inside.
  c.part();
  c.ellipse(cx, cy, rx, ry, PLAQUE_EDGE, { normal: (_x, _y, dx, dy) => n3(dx * 0.8, -dy * 0.8, 0.5) });
  c.part();
  c.ellipse(cx, cy, rx - 2, ry - 2, PLAQUE_WOOD, { normal: (_x, _y, dx, dy) => n3(dx * 0.15, -dy * 0.15, 0.98) });
  // Grain across the face.
  for (let y = 0; y < PLAQUE_H; y++) {
    for (let x = 0; x < PLAQUE_W; x++) {
      if (c.materialAt(x, y) !== PLAQUE_WOOD) continue;
      const a = hash2(Math.floor(x / 6), y, 6101);
      if (a > 0.8) c.shade(x, y, -1);
      else if (a < 0.1) c.shade(x, y, 1);
    }
  }
  // Brass screws either side, and a little nameplate at the foot.
  c.part();
  for (const sx of [5, PLAQUE_W - 6]) {
    c.px(sx, cy, BRASS, sphere(-0.4, 0.4), { bias: 1 });
    c.px(sx + 1, cy, BRASS, sphere(0.4, 0.4), { bias: -1 });
  }
  c.part();
  for (let x = cx - 7; x < cx + 7; x++) for (let y = PLAQUE_H - 7; y < PLAQUE_H - 4; y++) c.px(x, y, BRASS, cyl((x + 0.5 - cx) / 7, 0.3), { bias: y === PLAQUE_H - 7 ? 1 : 0 });
  return c;
}

// ---------------------------------------------------------------- The rod's button icon

const ROD_WOOD = mat('#120904', '#2a170c', '#4a2c16', '#6a4122', '#8c5a30', '#b07a44');
const CORK = mat('#1a1006', '#5a3e1e', '#7e5a30', '#a07a46', '#c09a60', '#dcbc82');
const LINE: Material = { ...mat('#0a0a10', '#8a96a8', '#c0cad8', '#eef4ff'), noAO: true, noOutline: true };
const BOB_RED: Material = { ...mat('#1a0204', '#4a0608', '#7a0c10', '#a8161a', '#d02a26', '#f04a3a', '#ff7a60'), shine: true };
const BOB_WHITE: Material = { ...mat('#1a1a1e', '#8a8a92', '#b8b8c0', '#dcdce2', '#f4f4f8', '#ffffff'), shine: true };

/** A 16x16 icon of a rod with its line and float, for the touch button. */
export function rodIcon(): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  c.part();
  // The line from the tip, curving down to the float.
  for (let k = 0; k <= 8; k++) c.px(13 + Math.round(Math.sin(k * 0.3) * 0.6), 2 + k, LINE, n3(0, 0, 1), { bias: 1 });
  c.part();
  // The rod, from the grip at the bottom left up to the tip at the top right.
  c.line(2, 14, 13, 2, ROD_WOOD, (i, n) => cyl((i / n - 0.5) * 0.2, 0.4), { bias: 1 });
  c.part();
  c.line(2, 14, 4, 12, CORK, () => cyl(0, 0.4), { bias: 1 });
  c.part();
  // The reel on its side.
  c.ellipse(5.5, 12.5, 1.6, 1.6, BRASS);
  c.part();
  // The float: red cap, white body.
  c.px(13, 11, BOB_RED, sphere(-0.3, 0.5), { bias: 1 });
  c.px(14, 11, BOB_RED, sphere(0.3, 0.5));
  c.px(13, 12, BOB_WHITE, sphere(-0.3, -0.3), { bias: 1 });
  c.px(14, 12, BOB_WHITE, sphere(0.3, -0.3));
  return c;
}

// ---------------------------------------------------------------- Textures

/**
 * The fish as `fish` (lit, frames `<id>_0` and `<id>_1`, animated as
 * `fish_<id>`), `fish_e` (glow) and `fish_s` (shadow); the gauge's shadows
 * `fish_shadow` and `fish_shadow_big`; the plaque `fish_plaque`; and the
 * button's `icon_rod`. Made once.
 */
export function warmFish(scene: Phaser.Scene): void {
  if (scene.textures.exists('fish')) return;
  const frames = FISH.flatMap((d) => Array.from({ length: FISH_FRAMES }, (_, f) => ({ name: `${d.id}_${f}`, r: fishFrame(d.id, f).render() })));
  registerAtlas(scene, 'fish', packAtlas(frames, FISH_W, FISH_H, 8), FISH_W, FISH_H);
  for (const d of FISH) {
    scene.anims.create({ key: `fish_${d.id}`, frames: Array.from({ length: FISH_FRAMES }, (_, f) => ({ key: 'fish', frame: `${d.id}_${f}` })), frameRate: 6, repeat: -1 });
  }
  scene.textures.addCanvas('fish_shadow', pixelCanvas(SHADOW_W, SHADOW_H, fishShadow(false).render().diffuse));
  scene.textures.addCanvas('fish_shadow_big', pixelCanvas(SHADOW_W, SHADOW_H, fishShadow(true).render().diffuse));
  scene.textures.addCanvas('fish_plaque', pixelCanvas(PLAQUE_W, PLAQUE_H, plaque().render().diffuse));
  scene.textures.addCanvas('icon_rod', pixelCanvas(16, 16, rodIcon().render().diffuse));
}

export { LINE as ROD_LINE, BOB_RED, BOB_WHITE, CORK, ROD_WOOD };
