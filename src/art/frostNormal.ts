// The Aurora Colosseum's rank and file (game/monsters/FrostNormal.ts): the
// creatures that fill a wave once the little ones are gone.
//   - Rimefang:    a frost wolf, pale with a slate saddle and a mane of ice
//                  crystals that bristles when it means to pounce.
//   - Frostbound:  a dead shieldbearer frozen into his rimed iron, a tower
//                  shield of ice and iron held before him, a visor slit of
//                  cold light, a crown of ice grown from his helm.
//   - Rimewitch:   a hooded crone afloat on her own mist, a long nose out of
//                  the hood's dark, a birch staff cradling a burning crystal.
//   - Galeclaw:    a snow harpy: midnight wings frost-tipped at every
//                  primary, a white crest, a hooked beak, talons of ice.
//   - Chillstone:  a standing stone carved with runes and a face, capped in
//                  snow, that hops; the runes blaze before it lands hard.
//   - Snowstalker: a white lynx with grey spots, black ear tufts and aurora
//                  eyes, low and long, a paw raised to strike.
//
// All drawn side-on facing right (the sheets mirror them), lit from the top
// left in the colosseum's palette (frostKit.ts). The four-legged ones stand
// on a small rig: a rump, a barrel and a chest, legs solved from hip to paw
// (`joint`), feet moved through their stride (`stride`), a head that can be
// turned and lifted.
//
// And their spells (prefix fn_): a claw rake, the harpy's gust and her ice
// feathers, the witch's casting sigil and the spark of a blow turned on a
// shield.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { MONSTER_FRAME, sheet, type MonsterSheet } from './monsters';
import { bayer, clamp01 } from './bitmap';
import { hash2 } from './env';
import {
  C_AURORA,
  C_ICE,
  C_TEAL,
  C_WHITE,
  CLOTH,
  FEATHER,
  FUR_GREY,
  FUR_WHITE,
  GLOW_AURORA,
  GLOW_ICE,
  HOLLOW,
  HORN,
  ICE,
  ICE_DARK,
  ICE_GLOW,
  IRON,
  IVORY,
  LEATHER,
  PALE,
  RIME,
  SILVER,
  SNOW,
  STONE,
  VELVET,
  crystal,
  icicles,
  poly,
  type FxRegistrar,
} from './frostKit';

type Pt = [number, number];
type Anim = MonsterSheet['anims'][number];
type Poses = Record<string, () => PixelCanvas>;

// ---------------------------------------------------------------- Shared rig

/** An animation over frames `<prefix>0..n-1`. */
const anim = (name: string, prefix: string, n: number, fps: number, loop = true): Anim => ({ name, frames: Array.from({ length: n }, (_, i) => `${prefix}${i}`), fps, loop });

/** Poses `<prefix>0..n-1` drawn by `draw(f)`. */
function frames(prefix: string, n: number, draw: (f: number) => PixelCanvas): Poses {
  const out: Poses = {};
  for (let f = 0; f < n; f++) out[`${prefix}${f}`] = () => draw(f);
  return out;
}

/** Where the knee (or hock) goes between an upper joint and the foot, for limbs `l1` and `l2`; `bend` +1 bends it back, -1 forward. */
function joint(ax: number, ay: number, fx: number, fy: number, l1: number, l2: number, bend: number): [number, number, number, number] {
  let dx = fx - ax;
  let dy = fy - ay;
  let d = Math.hypot(dx, dy) || 0.01;
  const max = l1 + l2 - 0.05;
  if (d > max) {
    fx = ax + (dx / d) * max;
    fy = ay + (dy / d) * max;
    dx = fx - ax;
    dy = fy - ay;
    d = max;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const px = ax + (dx / d) * a;
  const py = ay + (dy / d) * a;
  return [px - bend * (dy / d) * h, py + bend * (dx / d) * h, fx, fy];
}

/** A point (u, v) in a frame turned by `a`, placed at (x, y). */
const turn = (x: number, y: number, a: number, u: number, v: number): Pt => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];

/** A foot's place in its stride at phase `ph` (0..1): planted and sliding back, then lifted and swung forward. */
function stride(rest: number, ground: number, ph: number, len: number, lift: number, stance: number): Pt {
  const t = ((ph % 1) + 1) % 1;
  if (t < stance) return [rest + len / 2 - (len * t) / stance, ground];
  const u = (t - stance) / (1 - stance);
  return [rest - len / 2 + len * u, ground - Math.sin(u * Math.PI) * lift];
}

/** A rounded normal for ellipses: `k` how domed, `lift` tips it toward the light. */
const round =
  (k = 0.9, lift = -0.1) =>
  (_x: number, _y: number, dx: number, dy: number): Vec3 =>
    sphere(dx * k, dy * k + lift, 1);

/**
 * Repaint pixels already drawn (where `test` holds) in another material,
 * keeping their shape, normals and layer: markings on a coat, a saddle of
 * darker fur, frost on a shoulder.
 */
function mark(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, test: (x: number, y: number) => boolean, m: Material, bias = 0): void {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(c.h - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(c.w - 1, Math.ceil(x1)); x++) {
      if (!c.filled(x, y) || !test(x, y)) continue;
      const i = y * c.w + x;
      const layer = c.layer[i];
      const b = c.bias[i];
      c.px(x, y, m, { x: c.nx[i], y: c.ny[i], z: c.nz[i] }, { bias: b + bias });
      c.layer[i] = layer;
    }
  }
}

/** A soft breath of frost: a few faint light pixels drifting up and ahead of a mouth. */
function breath(c: PixelCanvas, x: number, y: number, k: number, dir = 1): void {
  if (k <= 0) return;
  c.spark(x + dir * 1, y - 0.5, C_WHITE, 0.32 * k);
  c.spark(x + dir * 2, y - 1, C_ICE, 0.26 * k);
  c.spark(x + dir * 3, y - 2, C_WHITE, 0.18 * k);
  c.spark(x + dir * 2, y - 2.5, C_ICE, 0.12 * k);
}

/** Small claws of ice from a paw at (x, y), reaching along (ux, uy). */
function claws(c: PixelCanvas, x: number, y: number, ux: number, uy: number, n = 3): void {
  c.part();
  const nx = -uy;
  const ny = ux;
  for (let k = 0; k < n; k++) {
    const s = (k - (n - 1) / 2) * 1.1;
    const bx = x + nx * s;
    const by = y + ny * s;
    c.line(bx, by, bx + ux * 1.8 + nx * s * 0.2, by + uy * 1.8 + ny * s * 0.2, ICE, () => ({ x: -0.4, y: 0.4, z: 0.8 }));
    c.spark(bx + ux * 1.8, by + uy * 1.8, C_WHITE, 0.6);
  }
}

// ---------------------------------------------------------------- Rimefang

/** The row its paws stand on. */
const WG = 25;

interface WolfPose {
  bob: number;
  /** Chest higher than the rump (+) or lower (-). */
  pitch: number;
  /** Body drawn longer (a leap). */
  stretch: number;
  nh: Pt;
  fh: Pt;
  nf: Pt;
  ff: Pt;
  head: 'level' | 'low' | 'howl' | 'bite';
  nod: number;
  /** 0..1 how wide the jaw hangs open. */
  jaw: number;
  /** -1 tucked low, 0 hanging easy, 1 streaming out behind. */
  tail: number;
  wag: number;
  /** 0..1 the ice mane bristling. */
  hackles: number;
  /** 0 pricked, 1 pinned back. */
  ears: number;
  blink: boolean;
  breath: number;
}

const W_REST: WolfPose = { bob: 0, pitch: 0, stretch: 0, nh: [12.5, WG], fh: [13.5, WG], nf: [25.5, WG], ff: [26.5, WG], head: 'level', nod: 0, jaw: 0, tail: 0, wag: 0, hackles: 0, ears: 0, blink: false, breath: 0 };

function wolfLeg(c: PixelCanvas, hx: number, hy: number, foot: Pt, hind: boolean, far: boolean): void {
  const o = { bias: far ? -1 : 0 };
  const [jx, jy, fx, fy] = joint(hx, hy, foot[0], foot[1] - 0.8, hind ? 4.8 : 4.4, hind ? 5 : 4.6, hind ? 1 : -1);
  c.part();
  c.capsule(hx, hy, jx, jy, hind ? 2.5 : 1.9, hind ? 1.3 : 1.2, far ? FUR_GREY : FUR_WHITE, far ? { bias: 1 } : o);
  c.capsule(jx, jy, fx, fy, hind ? 1.15 : 1.2, 0.95, FUR_WHITE, o);
  c.part();
  c.ellipse(fx + 0.7, fy + 0.25, 1.7, 1.05, RIME, { ...o, normal: round(0.8, -0.3) });
}

function wolfTail(c: PixelCanvas, x: number, y: number, lift: number, wag: number): void {
  const mx = x - 3.4;
  const my = y + 2.4 - lift * 2.6 + wag * 0.4;
  const tx = x - 6 - lift * 0.8;
  const ty = y + 6.2 - lift * 6.4 + wag;
  c.part();
  c.capsule(x, y, mx, my, 1.4, 2.3, FUR_GREY);
  c.capsule(mx, my, tx, ty, 2.3, 1.7, FUR_GREY);
  c.part();
  c.ellipse(tx - 0.2, ty + 0.3, 1.8, 1.6, FUR_WHITE, { normal: round(0.8) });
  // The tip has frozen into a little crystal.
  c.part();
  crystal(c, tx - 0.4, ty + 0.6, tx - 1.8 - lift * 0.4, ty + 2.6 - lift * 2.8, 0.9, ICE, C_ICE);
}

function wolfHead(c: PixelCanvas, x: number, y: number, a: number, p: WolfPose): void {
  const P = (u: number, v: number) => turn(x, y, a, u, v);
  const back = p.ears;
  // The far ear, the skull and its long muzzle.
  c.part();
  c.capsule(...P(0.4, -2), ...P(0.2 - back * 3, -6 + back * 2.8), 1.3, 0.35, FUR_GREY, { bias: -1 });
  c.part();
  c.ellipse(x, y, 3.6, 3.1, FUR_WHITE, { normal: round(0.85) });
  c.capsule(...P(1.2, 0.3), ...P(6, 0.9), 2.1, 1.25, FUR_WHITE);
  // The slate of the saddle runs up over the brow to the nose.
  c.part();
  c.capsule(...P(-2.2, -1.7), ...P(4.6, -0.3), 1.1, 0.6, FUR_GREY, { bias: 1 });
  if (p.jaw > 0) {
    const j = p.jaw;
    c.part();
    c.capsule(...P(1.6, 1.5), ...P(5.2, 1.4 + j * 1.4), 1.0, 0.8, HOLLOW);
    c.part();
    c.capsule(...P(1.2, 2.1 + j * 0.3), ...P(4.8, 2.4 + j * 2.6), 1.05, 0.7, FUR_WHITE, { bias: -1 });
    c.px(...P(5.4, 1.5), IVORY, sphere(0.2, 0.3));
    c.px(...P(4.4, 1.7 + j * 1.9), IVORY, sphere(0.2, -0.3));
    c.px(...P(3.2, 1.6), IVORY, sphere(0, 0.3), { bias: -1 });
  } else {
    c.part();
    c.line(...P(2.4, 1.7), ...P(5.2, 1.6), HOLLOW);
  }
  c.part();
  c.px(...P(6.9, 0.5), HORN, sphere(0.5, 0.5));
  c.px(...P(6.4, 0.0), HORN, sphere(0.3, 0.7));
  // The ruff at the cheek, crusted with rime.
  c.part();
  c.ellipse(...P(-1.3, 1.5), 2.4, 2.1, FUR_WHITE, { normal: round(0.8) });
  c.px(...P(-2.2, 2.6), RIME, FLAT);
  c.px(...P(-0.4, 3.0), RIME, FLAT);
  // The eye: ice-blue fire under a heavy brow.
  c.part();
  const [ex, ey] = P(1.9, -0.7);
  if (p.blink) c.px(ex, ey, FUR_GREY, FLAT, { bias: -1 });
  else {
    c.px(ex, ey, GLOW_ICE, FLAT);
    c.spark(ex, ey, C_ICE, 0.55);
    c.spark(ex + 1, ey, C_ICE, 0.2);
  }
  c.px(ex - 0.6, ey - 1, FUR_GREY, sphere(0, 0.8));
  // The near ear.
  c.part();
  const [tx, ty] = P(-1 - back * 3.2, -6.4 + back * 2.9);
  c.capsule(...P(-0.8, -2), tx, ty, 1.5, 0.4, FUR_WHITE);
  c.px(...P(-0.9 - back * 1.4, -3.6 + back * 1.2), FUR_GREY, FLAT, { bias: -1 });
  c.px(tx, ty, FUR_GREY, sphere(0, -0.6));
}

function wolf(p: WolfPose): PixelCanvas {
  const W = MONSTER_FRAME.rimefang;
  const c = new PixelCanvas(W.w, W.h);
  const rx = 12.5 - p.stretch * 0.5;
  const cx = 25 + p.stretch * 0.5;
  const ry = 14.4 + p.bob + p.pitch / 2;
  const cy = 13.6 + p.bob - p.pitch / 2;
  const far = (f: Pt): Pt => [f[0] + 1, f[1] - 0.8];

  wolfLeg(c, rx + 0.4, ry + 1.6, far(p.fh), true, true);
  wolfLeg(c, cx + 0.6, cy + 2.2, far(p.ff), false, true);
  wolfTail(c, rx - 3.4, ry - 2.4, p.tail, p.wag);

  // Body: a strong rump, a lean waist, a deep chest.
  c.part();
  c.capsule(rx + 1, ry + 0.2, cx - 1, cy + 0.4, 3.9, 4.3, FUR_WHITE);
  c.part();
  c.ellipse(rx, ry, 4.6, 4.4, FUR_WHITE, { normal: round() });
  c.part();
  c.ellipse(cx, cy + 0.4, 5, 5.2, FUR_WHITE, { normal: round() });
  // The slate saddle down the back, ragged at its edge like fur.
  const back = (x: number) => {
    const t = clamp01((x - rx) / (cx - rx));
    return ry - 4.4 + (cy - 4.8 - (ry - 4.4)) * t;
  };
  mark(c, rx - 5, 0, cx + 2, WG, (x, y) => y < back(x) + 3 + (hash2(x, 0, 7) > 0.5 ? 1 : 0) && x < cx + 1.5, FUR_GREY, 1);
  mark(c, rx - 5, 0, cx + 2, WG, (x, y) => y < back(x) + 1.6 + (hash2(x, 1, 7) > 0.6 ? 1 : 0) && x > rx - 3 && x < cx - 1, FUR_GREY, 0);

  // Neck and the ruff at the throat.
  const [hx, hy, ha] =
    p.head === 'howl' ? [cx + 3.8, cy - 6.4, -1.05] : p.head === 'low' ? [cx + 6.6, cy - 3 + p.nod, 0.3] : p.head === 'bite' ? [cx + 6.4, cy - 4.4 + p.nod, 0.05] : [cx + 5.8, cy - 5.6 + p.nod, 0.12];
  c.part();
  c.capsule(cx + 1.2, cy - 1.6, hx - 1, hy + 1.4, 3.2, 2.5, FUR_WHITE);
  c.part();
  c.ellipse(cx + 3, cy + 1, 2.6, 3.6, FUR_WHITE, { normal: round(0.8) });
  icicles(c, cx + 2, cx + 4, Math.round(cy + 4.4), 2, 3);

  // The mane: crystals of ice along the nape and shoulders, bristling as it gathers itself.
  const n = 5;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const bx = cx - 4.4 + (hx - 3 - (cx - 4.4)) * t;
    const by = cy - 3.6 + (hy + 0.4 - (cy - 3.6)) * t;
    const len = 2.6 + (k === 1 || k === 2 ? 1.4 : 0.5) + p.hackles * 1.8;
    const ang = -2.6 + t * 0.4 - p.hackles * 0.15;
    c.part();
    crystal(c, bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 1.15, k % 2 ? ICE_DARK : ICE, k % 2 ? null : C_WHITE);
  }
  c.part();
  for (const [dx, dy] of [[-1.5, -3.2], [0.5, -3.6], [-3.5, -2.6]]) c.px(cx + dx, cy + dy, RIME, sphere(0, 0.7));

  wolfHead(c, hx, hy, ha, p);
  const [nx, ny] = turn(hx, hy, ha, 6.6, 0.8);
  breath(c, nx, ny, p.breath);

  wolfLeg(c, rx + 1, ry + 2, p.nh, true, false);
  wolfLeg(c, cx + 0.4, cy + 2.6, p.nf, false, false);
  return c;
}

function wolfTrot(f: number, n: number): WolfPose {
  const ph = f / n;
  return {
    ...W_REST,
    nh: stride(12.5, WG, ph, 7, 2.4, 0.5),
    ff: stride(26.5, WG, ph, 7, 2.4, 0.5),
    fh: stride(13.5, WG, ph - 0.5, 7, 2.4, 0.5),
    nf: stride(25.5, WG, ph - 0.5, 7, 2.4, 0.5),
    bob: [0, -0.6, -1, 0, -0.6, -1][f % 6],
    nod: [0.6, 0, -0.4, 0.6, 0, -0.4][f % 6],
    tail: 0.35,
    wag: [0, 0.5, 1, 0.5, 0, -0.5][f % 6],
    hackles: 0.2,
  };
}

/**
 * Rimefang: idle (breathing frost, the tail stirring), walk (a trot), windup
 * (the crouch before a pounce: chest down, haunches gathered, mane up,
 * lips back), leap, bite (the landing), howl.
 */
export function buildRimefangSheet(): MonsterSheet {
  const crouch = (f: number): WolfPose => ({
    ...W_REST,
    bob: [1, 1.8, 2.2][f],
    pitch: [-0.8, -1.4, -1.8][f],
    nh: [15, WG],
    fh: [16, WG],
    nf: [27.5, WG],
    ff: [28.5, WG],
    head: 'low',
    nod: [0, 0.6, 1][f],
    jaw: [0.2, 0.4, 0.55][f],
    ears: 1,
    hackles: [0.6, 1, 1][f],
    tail: -0.5,
    wag: [0, 0.4, -0.4][f],
  });
  return sheet(
    MONSTER_FRAME.rimefang,
    {
      ...frames('idle', 6, (f) =>
        wolf({
          ...W_REST,
          bob: [0, 0, 0.5, 0.6, 0.5, 0][f],
          wag: [0, 0.4, 0.8, 0.4, 0, -0.4][f],
          nod: [0, 0, 0.3, 0.4, 0.3, 0][f],
          blink: f === 4,
          breath: [0, 0, 0.6, 1, 0.5, 0][f],
          ears: f === 5 ? 0.3 : 0,
        }),
      ),
      ...frames('trot', 6, (f) => wolf(wolfTrot(f, 6))),
      ...frames('crouch', 3, (f) => wolf(crouch(f))),
      leap0: () => wolf({ ...W_REST, stretch: 3, pitch: 2.2, bob: -1.5, nf: [34, 17.5], ff: [33, 18.5], nh: [5.5, 20], fh: [6.5, 21], head: 'bite', jaw: 0.9, ears: 1, tail: 0.7, hackles: 1 }),
      bite0: () => wolf({ ...W_REST, stretch: 1.5, pitch: -1.2, bob: 1, nf: [31, WG], ff: [30, WG], nh: [10, WG], fh: [11, WG], head: 'bite', nod: 1, jaw: 1, ears: 1, tail: 0.6, hackles: 1 }),
      ...frames('howl', 2, (f) => wolf({ ...W_REST, bob: 0.8, pitch: 0.6, head: 'howl', jaw: f ? 0.95 : 0.7, tail: -0.2, wag: f ? 0.4 : 0, hackles: 0.6, breath: f ? 1 : 0.6 })),
    },
    [
      anim('idle', 'idle', 6, 4),
      anim('walk', 'trot', 6, 12),
      anim('windup', 'crouch', 3, 7, false),
      anim('leap', 'leap', 1, 1, false),
      anim('bite', 'bite', 1, 1, false),
      anim('howl', 'howl', 2, 3),
    ],
  );
}

// ---------------------------------------------------------------- Snowstalker

/** The row its paws stand on. */
const LG = 23;

interface LynxPose {
  bob: number;
  pitch: number;
  stretch: number;
  nh: Pt;
  fh: Pt;
  nf: Pt;
  ff: Pt;
  head: 'level' | 'low' | 'snarl';
  nod: number;
  jaw: number;
  /** 0 pricked, 1 flat back. */
  ears: number;
  /** -1 down, 1 up. */
  tail: number;
  blink: boolean;
  /** Claws out: on the near forepaw (1), the far (2), both (3). */
  claws: number;
  /** A streak of light behind a swiping paw. */
  rake: 0 | 1 | 2;
}

const L_REST: LynxPose = { bob: 0, pitch: 0, stretch: 0, nh: [13, LG], fh: [14, LG], nf: [27, LG], ff: [28, LG], head: 'level', nod: 0, jaw: 0, ears: 0, tail: 0, blink: false, claws: 0, rake: 0 };

function lynxLeg(c: PixelCanvas, hx: number, hy: number, foot: Pt, hind: boolean, far: boolean, out: boolean): void {
  const o = { bias: far ? -1 : 0 };
  const [jx, jy, fx, fy] = joint(hx, hy, foot[0], foot[1] - 0.9, hind ? 4.3 : 4.1, hind ? 4.6 : 4.3, hind ? 1 : -1);
  c.part();
  c.capsule(hx, hy, jx, jy, hind ? 2.6 : 2, hind ? 1.5 : 1.4, FUR_WHITE, o);
  c.capsule(jx, jy, fx, fy, hind ? 1.3 : 1.35, 1.15, FUR_WHITE, o);
  // Great snowshoe paws.
  c.part();
  c.ellipse(fx + 0.6, fy + 0.2, 2.1, 1.25, FUR_WHITE, { ...o, normal: round(0.8, -0.3) });
  if (out) {
    const l = Math.hypot(fx - jx, fy - jy) || 1;
    claws(c, fx + ((fx - jx) / l) * 1.4, fy + ((fy - jy) / l) * 1.4, (fx - jx) / l, (fy - jy) / l);
  }
}

function lynxHead(c: PixelCanvas, x: number, y: number, a: number, p: LynxPose): void {
  const P = (u: number, v: number) => turn(x, y, a, u, v);
  const back = p.ears;
  const ear = (u: number, far: boolean) => {
    const [tx, ty] = P(u - 0.5 - back * 2.6, -4.8 + back * 2.4);
    c.part();
    c.capsule(...P(u, -2), tx, ty, 1.7, 0.55, FUR_GREY, { bias: far ? -1 : 0 });
    c.px(tx, ty, HORN, FLAT);
    // The black tuft standing off the tip.
    const [qx, qy] = P(u - 0.7 - back * 3.8, -6.4 + back * 3.4);
    c.line(tx, ty, qx, qy, HORN);
    if (!far) c.px(...P(u - 0.3 - back * 1.4, -3.2 + back * 1.2), FUR_WHITE, FLAT, { bias: -1 });
  };
  ear(0.8, true);
  // A round skull, a short broad muzzle.
  c.part();
  c.ellipse(x, y, 3.3, 3, FUR_WHITE, { normal: round(0.85) });
  c.capsule(...P(1.8, 0.9), ...P(4.2, 1.2), 1.8, 1.35, FUR_WHITE);
  // The forehead barred grey, a dark line from the eye back over the cheek.
  c.part();
  c.capsule(...P(-2, -1.8), ...P(2.4, -1.6), 1.1, 0.7, FUR_GREY, { bias: 1 });
  c.line(...P(-1.2, -2.6), ...P(1.4, -2.4), FUR_GREY, () => FLAT, { bias: -1 });
  if (p.jaw > 0) {
    c.part();
    c.capsule(...P(1.8, 2.1), ...P(4.2, 2.1 + p.jaw * 1.4), 1, 0.8, HOLLOW);
    c.part();
    c.capsule(...P(1.4, 2.7 + p.jaw * 0.3), ...P(3.8, 2.9 + p.jaw * 2.3), 1, 0.7, FUR_WHITE, { bias: -1 });
    c.px(...P(4.2, 2), IVORY, sphere(0.2, 0.3));
    c.px(...P(3.4, 2.3 + p.jaw * 1.6), IVORY, sphere(0.2, -0.3));
  } else {
    c.part();
    c.line(...P(2.6, 2.1), ...P(4.2, 2.2), HORN);
  }
  c.part();
  c.px(...P(5.2, 0.6), HORN, sphere(0.5, 0.5));
  c.px(...P(4.8, 0.2), HORN, sphere(0.3, 0.7));
  // The ruff: long sideburns hanging below the jaw, barred grey.
  c.part();
  c.ellipse(...P(-0.6, 2.4), 2.8, 2.4, FUR_WHITE, { normal: round(0.75) });
  c.capsule(...P(-0.4, 3.6), ...P(0.4, 6.2), 1.4, 0.5, FUR_WHITE);
  c.capsule(...P(-1.6, 3.4), ...P(-2.4, 5.6), 1.2, 0.5, FUR_WHITE, { bias: -1 });
  c.part();
  c.line(...P(0.4, 0.6), ...P(-1.6, 1.8), HORN);
  c.line(...P(-0.4, 2.6), ...P(0.4, 4.8), FUR_GREY, () => FLAT);
  c.line(...P(-1.8, 2.6), ...P(-1.8, 4.4), FUR_GREY, () => FLAT);
  // Aurora eyes, lined in black.
  c.part();
  const [ex, ey] = P(2.1, -0.4);
  if (p.blink) c.line(ex - 1, ey, ex + 0.6, ey, HORN);
  else {
    c.px(ex, ey, GLOW_AURORA, FLAT);
    c.px(ex - 1, ey, GLOW_AURORA, FLAT, { glow: 0.7 });
    c.spark(ex, ey, C_AURORA, 0.6);
    c.spark(ex + 1, ey, C_TEAL, 0.22);
  }
  c.px(...P(3.1, 0.1), HORN, FLAT);
  c.px(...P(1.6, -1.4), FUR_GREY, sphere(0, 0.8));
  ear(-0.9, false);
}

function lynx(p: LynxPose): PixelCanvas {
  const L = MONSTER_FRAME.snowstalker;
  const c = new PixelCanvas(L.w, L.h);
  const rx = 13 - p.stretch * 0.5;
  const cx = 27 + p.stretch * 0.5;
  const ry = 12.4 + p.bob + p.pitch / 2;
  const cy = 12.9 + p.bob - p.pitch / 2;
  const far = (f: Pt): Pt => [f[0] + 1, f[1] - 0.8];

  lynxLeg(c, rx + 0.4, ry + 1.8, far(p.fh), true, true, false);
  lynxLeg(c, cx + 0.6, cy + 2.2, far(p.ff), false, true, (p.claws & 2) > 0);

  // A short bobtail, black at the tip.
  const tx = rx - 6 - p.tail * 0.4;
  const ty = ry - 0.6 - p.tail * 2.6;
  c.part();
  c.capsule(rx - 3.6, ry - 2, tx, ty, 1.7, 1.45, FUR_WHITE);
  c.part();
  c.ellipse(tx - 0.3, ty - 0.1, 1.3, 1.25, HORN, { normal: round(0.8) });

  // A long body, high at the haunch.
  c.part();
  c.capsule(rx + 1, ry + 0.3, cx - 1, cy + 0.4, 3.7, 3.9, FUR_WHITE);
  c.part();
  c.ellipse(rx, ry, 4.6, 4.4, FUR_WHITE, { normal: round() });
  c.part();
  c.ellipse(cx, cy + 0.4, 4.4, 4.6, FUR_WHITE, { normal: round() });
  // A faint grey down the spine, and the spots.
  const back = (x: number) => ry - 4.4 + (cy - 4.2 - (ry - 4.4)) * clamp01((x - rx) / (cx - rx));
  mark(c, rx - 5, 0, cx + 3, LG, (x, y) => y < back(x) + 1.6 + (hash2(x, 2, 9) > 0.6 ? 1 : 0), FUR_GREY, 1);
  mark(c, rx - 4, 0, cx + 2, LG, (x, y) => y < back(x) + 6.5 && y > back(x) + 2 && hash2(x >> 1, (y + ((x >> 1) & 1)) >> 1, 41) > 0.66, FUR_GREY, 1);

  const [hx, hy, ha] = p.head === 'low' ? [cx + 7.2, cy - 2.6 + p.nod, 0.2] : p.head === 'snarl' ? [cx + 7, cy - 5 + p.nod, -0.05] : [cx + 6.6, cy - 6.4 + p.nod, 0.08];
  c.part();
  c.capsule(cx + 1, cy - 1.4, hx - 1.2, hy + 1.4, 3, 2.5, FUR_WHITE, { bias: -1 });
  lynxHead(c, hx, hy, ha, p);

  lynxLeg(c, rx + 1, ry + 2.2, p.nh, true, false, false);
  lynxLeg(c, cx + 0.4, cy + 2.6, p.nf, false, false, (p.claws & 1) > 0);

  // The arc a swiping paw leaves in the air.
  if (p.rake) {
    const [px, py] = p.nf;
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const ang = p.rake === 1 ? -1.9 + t * 1.6 : 1.5 - t * 1.9;
      const r = 6.5;
      c.spark(px - 1 + Math.cos(ang) * r * 0.8, py - 3 + Math.sin(ang) * r, k > 3 ? C_WHITE : C_ICE, 0.25 + t * 0.5);
    }
  }
  return c;
}

function lynxGait(f: number, n: number, len: number, lift: number): Pick<LynxPose, 'nh' | 'nf' | 'fh' | 'ff'> {
  const ph = f / n;
  return {
    nh: stride(13, LG, ph, len, lift, 0.6),
    nf: stride(27, LG, ph - 0.25, len, lift * 1.1, 0.6),
    fh: stride(14, LG, ph - 0.5, len, lift, 0.6),
    ff: stride(28, LG, ph - 0.75, len, lift * 1.1, 0.6),
  };
}

/**
 * Snowstalker: idle, walk (a prowl), stalk (belly to the snow, head low,
 * creeping), windup (the snarl: reared, ears flat, a paw raised with its
 * claws out), swipe (the first blow down and the backhand up).
 */
export function buildSnowstalkerSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.snowstalker,
    {
      ...frames('idle', 4, (f) => lynx({ ...L_REST, bob: [0, 0, 0.5, 0.5][f], tail: [0, 0.5, 0.2, -0.2][f], ears: f === 2 ? 0.4 : 0, blink: f === 3 })),
      ...frames('prowl', 6, (f) => lynx({ ...L_REST, ...lynxGait(f, 6, 6, 1.8), bob: Math.cos((f / 6) * Math.PI * 4) > 0.3 ? -0.5 : 0, nod: 0.5, tail: [0, 0.3, 0.5, 0.3, 0, -0.2][f] })),
      ...frames('stalk', 6, (f) =>
        lynx({ ...L_REST, ...lynxGait(f, 6, 4.4, 1.2), bob: 3, pitch: -0.6, head: 'low', nod: f % 3 === 0 ? 0.4 : 0, ears: 0.15, tail: [-0.6, -0.4, -0.2, -0.4, -0.6, -0.8][f] }),
      ),
      ...frames('snarl', 3, (f) =>
        lynx({
          ...L_REST,
          pitch: [1.2, 2.6, 2.8][f],
          bob: [0.6, 0.4, 0.2][f],
          nh: [15, LG],
          fh: [16, LG],
          nf: ([[31, 19], [34, 15], [34.5, 14.5]] as Pt[])[f],
          ff: [29, LG],
          head: 'snarl',
          jaw: [0.5, 0.9, 1][f],
          ears: [0.6, 1, 1][f],
          tail: 1,
          claws: f > 0 ? 1 : 0,
        }),
      ),
      swipe0: () => lynx({ ...L_REST, stretch: 3, pitch: -1, bob: 0.6, nf: [36, LG - 2], ff: [27, LG - 1], nh: [9, LG], fh: [10, LG], head: 'snarl', nod: 1, jaw: 1, ears: 1, tail: 1, claws: 1, rake: 1 }),
      swipe1: () => lynx({ ...L_REST, stretch: 2.4, pitch: 1.6, bob: 0, nf: [33, 13.5], ff: [33.5, LG - 1.5], nh: [11, LG], fh: [12, LG], head: 'snarl', jaw: 0.8, ears: 1, tail: 0.8, claws: 1, rake: 2 }),
    },
    [
      anim('idle', 'idle', 4, 3),
      anim('walk', 'prowl', 6, 10),
      anim('stalk', 'stalk', 6, 6),
      anim('windup', 'snarl', 3, 8, false),
      anim('swipe', 'swipe', 2, 7, false),
    ],
  );
}

// ---------------------------------------------------------------- Frostbound

/** The row his feet stand on. */
const BG = 34;

interface BoundPose {
  bob: number;
  /** Upper body leaning forward (+) or back (-), px. */
  lean: number;
  /** Feet: near and far, x and lift. */
  nx: number;
  fx: number;
  nl: number;
  fl: number;
  /** The shield's offset from where it's carried, and its tilt (px a row). */
  sx: number;
  sy: number;
  tilt: number;
  /** 0..1 the visor's light. */
  visor: number;
  /** The head bowed (+ px). */
  bow: number;
  /** Struck on the shield: sparks on its face. */
  sparks: boolean;
}

const B_REST: BoundPose = { bob: 0, lean: 0, nx: 16.5, fx: 11, nl: 0, fl: 0, sx: 0, sy: 0, tilt: 0, visor: 0.8, bow: 0, sparks: false };

function boundLeg(c: PixelCanvas, hx: number, hy: number, foot: number, lift: number, far: boolean): void {
  const o = { bias: far ? -1 : 0 };
  const [kx, ky, ax, ay] = joint(hx, hy, foot, BG - 1.4 - lift, 5.4, 5.6, -1);
  c.part();
  c.capsule(hx, hy, kx, ky, 2.1, 1.7, IRON, o);
  c.capsule(kx, ky, ax, ay, 1.8, 1.5, IRON, o);
  // A rimed knee cop.
  c.part();
  c.ellipse(kx + 0.3, ky, 1.5, 1.4, far ? IRON : SILVER, { ...o, bias: far ? -2 : -1 });
  // The sabaton, pointed forward.
  c.part();
  c.capsule(ax - 0.6, ay + 0.6, ax + 2, ay + 0.9, 1.4, 0.9, IRON, o);
}

/** The tower shield: iron rim, a face of blue ice, a silver boss with a snowflake rune burning round it. */
function towerShield(c: PixelCanvas, x: number, y: number, tilt: number, sparks: boolean): void {
  const top = y - 11;
  const bot = y + 11;
  const half = (yy: number) => {
    const u = (yy - top) / (bot - top);
    // A slight waist, a rounded top and a tapered foot.
    const arch = u < 0.08 ? Math.sqrt(u / 0.08) : 1;
    const foot = u > 0.86 ? 1 - ((u - 0.86) / 0.14) * 0.5 : 1;
    return 4.6 * Math.min(arch, foot) * (1 - Math.sin(u * Math.PI) * 0.04);
  };
  const cxAt = (yy: number) => x + (yy - y) * tilt;
  const curve = (_x: number, _y: number, t: number) => cyl(t * 0.85, 0.12);
  c.part();
  c.shape(top, bot, (yy) => [cxAt(yy) - half(yy), cxAt(yy) + half(yy)], IRON, curve);
  c.part();
  c.shape(top + 1.5, bot - 1.5, (yy) => [cxAt(yy) - half(yy) + 1.2, cxAt(yy) + half(yy) - 1.2], ICE_DARK, curve);
  // Light caught in the ice: a pale streak down its lit side.
  c.part();
  for (let yy = top + 3; yy < bot - 3; yy++) if ((yy + 1) % 4 < 2) c.px(cxAt(yy) - half(yy) + 2, yy, ICE, { x: -0.6, y: 0.3, z: 0.75 }, { bias: -1 });
  // A crust of rime along the top, icicles off the foot.
  mark(c, x - 7, top - 1, x + 7, top + 1.6, () => true, RIME);
  icicles(c, Math.round(cxAt(bot) - 2), Math.round(cxAt(bot) + 2), Math.round(bot), 3, 7);
  // The boss and its rune.
  const bx = cxAt(y - 1);
  const by = y - 1;
  c.part();
  for (let k = 2; k <= 4; k++) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]] as const) {
      if (k === 4 && dx !== 0) continue;
      c.px(bx + dx * k * 0.75, by + dy * k, GLOW_ICE, FLAT, { glow: 0.8, bias: k > 2 ? -1 : 0 });
    }
  }
  c.part();
  c.ellipse(bx, by, 1.8, 1.8, SILVER, { normal: round(1, -0.2) });
  c.spark(bx - 0.6, by - 0.6, C_WHITE, 0.6);
  c.spark(x - 3, top + 1, C_WHITE, 0.5);
  if (sparks) {
    for (const [dx, dy, a] of [[0, -6, 1], [1, -4, 0.7], [-1, -3, 0.6], [2, -8, 0.5], [0, -1, 0.5], [3, -5, 0.4]] as const) c.spark(bx + 3 + dx, by + dy, a > 0.6 ? C_WHITE : C_ICE, a);
  }
}

function frostbound(p: BoundPose): PixelCanvas {
  const F = MONSTER_FRAME.frostbound;
  const c = new PixelCanvas(F.w, F.h);
  const b = p.bob;
  const L = p.lean;
  const hipX = 13.5 + L * 0.3;
  const hipY = 24 + b;

  // The cape behind him, hanging in tatters to his calves.
  c.part();
  const hem: Pt[] = [];
  for (let k = 0; k <= 6; k++) hem.push([11.5 - k * 1.25 + L * 0.2, 31 + b + (k % 2 ? -1.5 : 0.5) + (k === 3 ? 1 : 0)]);
  poly(c, [[12.5 + L, 13 + b], [9 + L * 0.8, 14 + b], [6.5 + L * 0.5, 22 + b], ...hem.reverse(), [12.5 + L * 0.3, 26 + b]], CLOTH, (x) => cyl((x - 9) / 4, 0.2));
  for (const [x0, y0] of [[8, 18], [7, 24]]) c.line(x0 + L * 0.6, y0 + b, x0 - 1 + L * 0.4, y0 + 6 + b, CLOTH, () => FLAT, { bias: -1 });

  boundLeg(c, hipX - 1.2, hipY, p.fx, p.fl, true);

  // The sword arm behind: a rimed blade hanging from his far hand.
  const shX = 11 + L;
  const shY = 14.5 + b;
  const [ex, ey] = [shX - 1.6, shY + 4.6];
  const [hx, hy] = [ex + 0.6, ey + 4.2];
  c.part();
  c.capsule(shX, shY, ex, ey, 1.6, 1.3, IRON, { bias: -1 });
  c.capsule(ex, ey, hx, hy, 1.3, 1.1, IRON, { bias: -1 });
  c.part();
  const [tx, ty] = [hx - 5.6, hy + 9.4];
  c.capsule(hx - 0.2, hy + 0.6, tx, ty, 1.05, 0.5, IRON, { bias: -1 });
  c.line(hx - 0.6, hy + 1.2, tx + 0.4, ty - 0.6, SILVER, () => ({ x: -0.5, y: 0.5, z: 0.7 }));
  crystal(c, hx - 2.4, hy + 4, hx - 4.2, hy + 3.6, 0.8, ICE, null);
  crystal(c, hx - 3.8, hy + 6.6, hx - 5.8, hy + 6.8, 0.7, ICE, C_ICE);
  c.capsule(hx - 2, hy - 0.4, hx + 1.6, hy + 1.6, 0.6, 0.6, SILVER);
  c.ellipse(hx, hy, 1.2, 1.2, IRON, { bias: -1 });

  // The torso: a breastplate blued with cold, a belt, a skirt of plates.
  c.part();
  poly(c, [[hipX - 4.6, hipY - 1], [hipX + 4.2, hipY - 1], [hipX + 5.2, hipY + 3.6], [hipX - 5, hipY + 3.6]], IRON, (x) => cyl((x - hipX) / 5, 0.1));
  for (let x = Math.round(hipX - 3); x <= hipX + 3; x += 2) c.line(x, hipY, x - 0.4, hipY + 3.2, IRON, () => FLAT, { bias: -1 });
  c.part();
  c.ellipse(13.5 + L * 0.8, 18.5 + b, 5.3, 5.8, IRON, { normal: round(0.9, -0.15), bias: -1 });
  c.part();
  c.capsule(hipX - 4.6, hipY - 1.4, hipX + 4.4, hipY - 1.4, 1, 1, LEATHER);
  c.px(hipX + 1, hipY - 1.4, SILVER, sphere(0, 0.6));
  // Rime on the breast and a gorget gap with cold light in it.
  mark(c, 8, 12 + b, 20, 14 + b, (x, y) => hash2(x, y, 3) > 0.72, RIME);
  c.part();
  c.ellipse(15.4 + L, 13.6 + b, 1.8, 1, HOLLOW);
  c.spark(15.4 + L, 13.8 + b, C_ICE, 0.35 * p.visor);

  boundLeg(c, hipX + 1.2, hipY + 0.4, p.nx, p.nl, false);

  // The helm: a great helm with a slit of cold light, a beard of icicles,
  // and a crown of ice grown out of its top.
  const hX = 14.6 + L;
  const hY = 8.6 + b + p.bow;
  c.part();
  for (const [dx, tx2, ty2, r] of [[-2.2, -5, -5, 0.9], [0.6, 0.2, -7.4, 1.2], [2.6, 4.4, -5.6, 0.95], [-0.8, -2.4, -6.6, 0.9]] as const) {
    crystal(c, hX + dx, hY - 2.6, hX + tx2, hY + ty2, r, dx === -0.8 ? ICE_DARK : ICE, dx === 0.6 ? C_WHITE : null);
  }
  c.part();
  c.shape(hY - 4, hY + 4, (y) => {
    const u = (y - (hY - 4)) / 8;
    const w = u < 0.25 ? 2.6 + Math.sqrt(u / 0.25) * 1.5 : 4.1;
    return [hX - w + u * 0.4, hX + w + u * 0.6];
  }, IRON, (_x, _y, t, u) => cyl(t * 0.9, 0.3 - u * 0.6), { bias: -2 });
  mark(c, hX - 5, hY - 5, hX + 5, hY - 3.6, (x, y) => hash2(x, y, 13) > 0.35, RIME);
  // The visor slit in a dark faceplate, and breaths.
  c.part();
  for (let x = Math.round(hX + 0.2); x <= Math.round(hX + 4.2); x++) {
    c.px(x, hY - 1.2, IRON, { x: 0.2, y: 0.8, z: 0.6 });
    c.px(x, hY + 0.8, IRON, { x: 0.2, y: -0.3, z: 0.9 }, { bias: -2 });
  }
  for (let x = Math.round(hX + 0.4); x <= Math.round(hX + 4); x++) c.px(x, hY - 0.2, GLOW_ICE, FLAT, { glow: p.visor });
  c.spark(hX + 3.6, hY - 0.2, C_ICE, 0.6 * p.visor);
  c.spark(hX + 5, hY - 0.4, C_ICE, 0.25 * p.visor);
  c.px(hX + 2.4, hY + 2, HOLLOW, FLAT);
  c.px(hX + 3.6, hY + 2, HOLLOW, FLAT);
  c.line(hX - 0.2, hY - 3.6, hX - 0.2, hY + 3.6, IRON, () => ({ x: 0.3, y: 0.2, z: 0.9 }), { bias: 1 });
  icicles(c, Math.round(hX), Math.round(hX + 3), Math.round(hY + 4.2), 3, 11);

  // The near pauldron, frosted on top.
  c.part();
  c.ellipse(12.6 + L, 14.4 + b, 3.6, 3, IRON, { normal: round(0.9, -0.2), bias: -1 });
  mark(c, 8 + L, 11 + b, 17 + L, 12.6 + b, (x, y) => hash2(x, y, 29) > 0.4, RIME);
  c.part();
  c.capsule(10 + L, 16.6 + b, 15 + L, 16.4 + b, 0.6, 0.6, IRON, { bias: -1 });

  towerShield(c, 21.6 + L * 0.6 + p.sx, 22.4 + b + p.sy, p.tilt, p.sparks);
  return c;
}

/**
 * Frostbound: idle (breathing that isn't breath, the visor guttering),
 * walk (a heavy march behind the shield), windup (braced, the shield drawn
 * in), bash, block (a blow turned), recover (the shield hangs low: his
 * opening).
 */
export function buildFrostboundSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.frostbound,
    {
      ...frames('idle', 4, (f) => frostbound({ ...B_REST, bob: [0, 0.4, 0.8, 0.4][f], visor: [0.9, 0.7, 1, 0.55][f] })),
      ...frames('march', 4, (f) =>
        frostbound({
          ...B_REST,
          bob: [0, -0.8, 0, -0.8][f],
          nx: [18.5, 15.5, 12.5, 15.5][f],
          fx: [9.5, 12, 15.5, 12][f],
          nl: [0, 0, 0, 1.6][f],
          fl: [0, 1.6, 0, 0][f],
          sy: [0, -0.6, 0, -0.6][f],
          lean: 0.6,
        }),
      ),
      ...frames('brace', 2, (f) => frostbound({ ...B_REST, bob: [0.8, 1.4][f], lean: [-1, -2][f], sx: [-1.5, -2.6][f], tilt: [-0.04, -0.08][f], nx: 19, fx: 9, visor: [1, 1][f] })),
      bash0: () => frostbound({ ...B_REST, bob: 0.4, lean: 3, sx: 4, sy: -0.6, tilt: 0.05, nx: 21, fx: 8, nl: 0, visor: 1 }),
      block0: () => frostbound({ ...B_REST, bob: 0.6, lean: -1, sx: -1.2, tilt: -0.06, visor: 1, sparks: true }),
      ...frames('lowered', 2, (f) => frostbound({ ...B_REST, bob: [1, 1.2][f], lean: 0.8, sx: [3.2, 3.4][f], sy: [5, 5.6][f], tilt: [0.32, 0.36][f], visor: [0.35, 0.25][f], bow: 1, nx: 18, fx: 10 })),
    },
    [
      anim('idle', 'idle', 4, 3),
      anim('walk', 'march', 4, 5),
      anim('windup', 'brace', 2, 4, false),
      anim('bash', 'bash', 1, 1, false),
      anim('block', 'block', 1, 1, false),
      anim('recover', 'lowered', 2, 2),
    ],
  );
}

// ---------------------------------------------------------------- Rimewitch

/** Her hem floats over this row. */
const HEM = 35.5;

interface WitchPose {
  bob: number;
  lean: number;
  /** Phase of the tatters at her hem. */
  hem: number;
  /** How the tatters stream: 0 hanging, 1 swept back. */
  sweep: number;
  staff: 'hold' | 'raise' | 'thrust';
  /** 0..1 the crystal's fire. */
  glow: number;
  /** Her free hand: at rest in the sleeve, or open toward the foe. */
  hand: 'rest' | 'open';
  /** Wrapped in her own mist, about to go (a blink). */
  whirl: number;
}

const H_REST: WitchPose = { bob: 0, lean: 0, hem: 0, sweep: 0, staff: 'hold', glow: 0.55, hand: 'rest', whirl: 0 };

/** The witch's staff of white birch, a crook at its head cradling the crystal. */
function staff(c: PixelCanvas, bx: number, by: number, tx: number, ty: number, glow: number): void {
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const ux = (tx - bx) / len;
  const uy = (ty - by) / len;
  const nx = -uy;
  const ny = ux;
  c.part();
  // A little crooked, knotted halfway.
  const mx = bx + ux * len * 0.5 + nx * 0.6;
  const my = by + uy * len * 0.5 + ny * 0.6;
  c.capsule(bx, by, mx, my, 0.75, 0.85, IVORY);
  c.capsule(mx, my, tx, ty, 0.85, 0.75, IVORY);
  c.px(mx - nx * 0.6, my - ny * 0.6, LEATHER, FLAT);
  c.px(bx + ux * len * 0.25, by + uy * len * 0.25, LEATHER, FLAT);
  // The crook: it curls forward and down round the crystal.
  const [c1x, c1y] = [tx + ux * 2.6 + nx * 1.6, ty + uy * 2.6 + ny * 1.6];
  const [c2x, c2y] = [tx + ux * 4.2 + nx * 3.8, ty + uy * 4.2 + ny * 3.8];
  c.capsule(tx, ty, c1x, c1y, 0.75, 0.65, IVORY);
  c.capsule(c1x, c1y, c2x, c2y, 0.65, 0.5, IVORY);
  // The crystal it holds, burning.
  const kx = tx + ux * 1.4 + nx * 2.4;
  const ky = ty + uy * 1.4 + ny * 2.4;
  c.part();
  crystal(c, kx - ux * 2.2, ky - uy * 2.2, kx + ux * 2.6, ky + uy * 2.6, 1.5, ICE_GLOW, C_WHITE);
  c.spark(kx, ky, C_ICE, 0.4 + glow * 0.5);
  if (glow > 0.6) {
    const k = (glow - 0.6) / 0.4;
    for (const [dx, dy, a] of [[-2, -1, 0.5], [2, 1, 0.5], [0, -3, 0.6], [-3, 2, 0.35], [3, -2, 0.4], [1, 3, 0.3]] as const) c.spark(kx + dx * (1 + k * 0.5), ky + dy * (1 + k * 0.5), a > 0.45 ? C_WHITE : C_ICE, a * k);
  }
}

function witch(p: WitchPose): PixelCanvas {
  const F = MONSTER_FRAME.rimewitch;
  const c = new PixelCanvas(F.w, F.h);
  const b = p.bob;
  const L = p.lean;
  const top = 13.5 + b;
  const bot = HEM - 1 + b;
  // Her robe leans with her: the shoulders ride `lean` px ahead of the hem.
  const mid = (y: number) => 15 + L * (1 - (y - top) / (bot - top)) - p.whirl * Math.sin((y - top) * 0.5) * 1.2;
  const half = (y: number) => {
    const u = (y - top) / (bot - top);
    return (3.8 + u * 4.6 + Math.pow(u, 3) * 1.6) * (1 - p.whirl * 0.25);
  };

  // The far sleeve, a bell of cloth.
  c.part();
  if (p.hand === 'open') {
    c.capsule(14 + L, 17 + b, 21 + L, 20 + b, 1.8, 2.4, CLOTH, { bias: -1 });
  } else {
    c.capsule(14 + L, 17 + b, 15.5 + L, 24 + b, 1.8, 2.4, CLOTH, { bias: -1 });
  }

  // The robe, in folds, with tatters dragging behind as she glides.
  c.part();
  c.shape(Math.floor(top), Math.ceil(bot), (y) => [mid(y) - half(y), mid(y) + half(y)], CLOTH, (_x, _y, t, u) => cyl(t, 0.3 - u * 0.2));
  const fold = (x0: number) => {
    for (let y = Math.round(top + 7); y < bot; y++) {
      const u = (y - top) / (bot - top);
      c.shade(mid(y) + x0 * half(y), y, -1);
      if (u > 0.5 && x0 < 0) c.shade(mid(y) + x0 * half(y) + 1, y, 1);
    }
  };
  fold(-0.45);
  fold(0.15);
  // The velvet lining at the robe's opening.
  c.part();
  poly(c, [[mid(top + 9) + 1.5, top + 9], [mid(bot) + half(bot) * 0.5 + 1, bot + 0.5], [mid(bot) + half(bot) * 0.05, bot + 0.5]], VELVET, () => ({ x: 0.3, y: 0.2, z: 0.9 }));
  // Tatters off the hem, each tipped with rime.
  for (let k = 0; k < 6; k++) {
    const x0 = mid(bot) - half(bot) + 1 + k * ((half(bot) * 2 - 2) / 5);
    const len = 2.2 + ((k * 7 + 3) % 4) * 0.6 + Math.sin(p.hem * 1.6 + k * 1.3) * 0.8;
    const sw = p.sweep * (2 + k * 0.3);
    c.part();
    c.capsule(x0, bot - 0.5, x0 - sw, bot + len - p.sweep * 0.8, 1.1, 0.45, CLOTH, { bias: k % 2 ? -1 : 0 });
    c.px(x0 - sw, bot + len - p.sweep * 0.8, RIME, FLAT);
  }
  // Mist curling off her hem.
  for (let k = 0; k < 7; k++) {
    const x = mid(bot) - half(bot) + 1 + k * 2.4 - p.sweep * 2;
    c.spark(x, HEM + 1.5 + b + ((k + Math.round(p.hem)) % 3) * 0.6, C_ICE, 0.18);
    if (k % 2) c.spark(x + 1, HEM + 2.5 + b, C_WHITE, 0.12);
  }
  // A belt of cord, charms of bone and ice hanging off it.
  c.part();
  const wy = top + 9.5;
  c.capsule(mid(wy) - half(wy) + 0.5, wy, mid(wy) + half(wy) - 0.5, wy + 0.4, 0.6, 0.6, LEATHER);
  c.line(mid(wy) - 1, wy + 1, mid(wy) - 1.2, wy + 3.4, LEATHER);
  c.px(mid(wy) - 1.2, wy + 4, IVORY, sphere(0, 0.3));
  c.line(mid(wy) + 2.4, wy + 1, mid(wy) + 2.6, wy + 2.6, LEATHER);
  crystal(c, mid(wy) + 2.6, wy + 2.6, mid(wy) + 2.6, wy + 5.4, 0.9, ICE, C_ICE);

  // A shawl of white fur on her shoulders.
  c.part();
  c.ellipse(15.6 + L, 16.4 + b, 4.6, 2.5, FUR_WHITE, { normal: round(0.8, -0.2) });
  for (let x = Math.round(11.5 + L); x <= 19.5 + L; x += 2) c.px(x, 18.4 + b + (x % 4 ? 0.6 : 0), FUR_WHITE, sphere(0, -0.5), { bias: -1 });

  // The hood: deep, its peak drooping back, a long nose out of its dark.
  const hx = 16.5 + L * 1.1;
  const hy = 10 + b;
  c.part();
  c.capsule(hx - 2, hy - 3, hx - 5.6, hy - 5.4, 2.4, 1.4, CLOTH);
  c.capsule(hx - 5.6, hy - 5.4, hx - 8.4, hy - 3.2 + p.whirl * 2, 1.4, 0.6, CLOTH);
  c.part();
  c.ellipse(hx, hy, 4.4, 4.7, CLOTH, { normal: round(0.85, -0.2) });
  c.part();
  c.ellipse(hx + 1.9, hy + 0.8, 2.3, 3.3, HOLLOW);
  // Rime on the hood's edge.
  c.part();
  for (let y = Math.round(hy - 2.6); y <= hy + 3.6; y++) c.px(hx + 0.2 - (y > hy + 2 ? 0.6 : 0), y, RIME, sphere(-0.3, 0.2), { bias: -1 });
  // Eyes, a pale nose and chin, white hair spilling out.
  c.part();
  c.px(hx + 1.6, hy, GLOW_ICE, FLAT);
  c.px(hx + 3.2, hy - 0.2, GLOW_ICE, FLAT, { glow: 0.75 });
  c.spark(hx + 1.6, hy, C_ICE, 0.5);
  c.spark(hx + 3.2, hy - 0.2, C_ICE, 0.35);
  c.capsule(hx + 3.2, hy + 1, hx + 5.4, hy + 2.6, 0.7, 0.5, PALE);
  c.px(hx + 2.6, hy + 3.4, PALE, sphere(0.2, -0.3), { bias: -1 });
  c.part();
  c.capsule(hx + 0.6, hy + 2.6, hx + 0.4 + L * 0.2, hy + 8, 0.9, 0.5, FUR_WHITE);
  c.capsule(hx + 1.8, hy + 3.6, hx + 2.6, hy + 7, 0.7, 0.4, FUR_WHITE, { bias: -1 });

  // The staff hand and its sleeve, and the free hand open (casting) or not.
  const [sbx, sby, stx, sty, gx, gy] =
    p.staff === 'raise' ? [21 + L, 30 + b, 25.5 + L, 7 + b, 23.8 + L, 17 + b] : p.staff === 'thrust' ? [16 + L, 33.5 + b, 26.5 + L, 13 + b, 22 + L, 22 + b] : [25.5 + L, HEM + 1.5 + b, 24.6 + L, 9.5 + b, 24.8 + L, 21 + b];
  c.part();
  c.capsule(16 + L, 17 + b, gx - 1, gy, 1.9, 2.3, CLOTH);
  staff(c, sbx, sby, stx, sty, p.glow);
  c.part();
  c.ellipse(gx, gy, 1.3, 1.2, PALE, { normal: round(0.8) });
  if (p.hand === 'open') {
    c.part();
    const [ox, oy] = [22.6 + L, 20.2 + b];
    c.ellipse(ox, oy, 1.2, 1, PALE);
    for (const [dx, dy] of [[1.4, -1], [1.8, 0], [1.4, 1]] as const) c.line(ox + 0.6, oy + dy * 0.5, ox + dx + 0.6, oy + dy, PALE);
    for (const [dx, dy, a] of [[3, -1, 0.7], [3.6, 0.5, 0.5], [2.6, 1.6, 0.4], [4.4, -1.6, 0.3]] as const) c.spark(ox + dx, oy + dy, a > 0.5 ? C_WHITE : C_ICE, a * p.glow);
  }
  return c;
}

/**
 * Rimewitch: idle (afloat, her hem stirring), walk (gliding, tatters swept
 * back), windup (the staff raised, the crystal blazing, her hand open),
 * cast (the staff swept down at the foe), blink (wrapped in her mist).
 */
export function buildRimewitchSheet(): MonsterSheet {
  return sheet(
    MONSTER_FRAME.rimewitch,
    {
      ...frames('idle', 4, (f) => witch({ ...H_REST, bob: [0, -0.5, -1, -0.5][f], hem: f * 1.5, glow: [0.5, 0.6, 0.7, 0.6][f] })),
      ...frames('glide', 4, (f) => witch({ ...H_REST, bob: [0, -0.5, -1, -0.5][f], lean: 1.5, hem: f * 1.5, sweep: 1, glow: 0.55 })),
      ...frames('raise', 3, (f) => witch({ ...H_REST, bob: [-0.5, -1, -1.5][f], lean: -0.5, hem: f * 1.5, staff: 'raise', glow: [0.65, 0.85, 1][f], hand: 'open' })),
      cast0: () => witch({ ...H_REST, lean: 2, staff: 'thrust', glow: 1, hand: 'open', sweep: 0.6, hem: 1 }),
      ...frames('blink', 2, (f) => witch({ ...H_REST, bob: -1, hem: f * 3, whirl: [0.6, 1][f], sweep: [0.4, 0.8][f], glow: 0.8 })),
    },
    [
      anim('idle', 'idle', 4, 4),
      anim('walk', 'glide', 4, 5),
      anim('windup', 'raise', 3, 5, false),
      anim('cast', 'cast', 1, 1, false),
      anim('blink', 'blink', 2, 8),
    ],
  );
}

// ---------------------------------------------------------------- Galeclaw

interface WingSet {
  /** The arm's angle at the shoulder, then from the wrist (radians, y down: 0 points ahead, pi back). */
  a1: number;
  a2: number;
  /** The hand's length (shorter when the wing is folded). */
  hand: number;
}

interface HarpyPose {
  bob: number;
  lean: number;
  /** The near wing sweeps behind her, the far one rises ahead of her: spread, she fills the sky. */
  near: WingSet;
  far: WingSet;
  /** Legs: dangling (0), or kicked forward with talons spread (1). */
  kick: number;
  /** Glints of ice gathering on her primaries. */
  glints: number;
  /** Beak open (a screech). */
  beak: boolean;
  /** Crest raised. */
  crest: number;
}

const WING_ARM = 7.5;

/**
 * A wing from the shoulder (x, y): its arm, white coverts along the leading
 * edge and the flight feathers trailing from it, each tipped with frost.
 * `far` for the far wing, drawn smaller and darker. A wing reaching
 * forward trails its feathers the other way.
 */
function wing(c: PixelCanvas, x: number, y: number, w: WingSet, far: boolean, glints: number): void {
  const s = far ? 0.86 : 1;
  const o = { bias: far ? -1 : 0 };
  const ahead = Math.cos(w.a1) > 0;
  const wx = x + Math.cos(w.a1) * WING_ARM * s;
  const wy = y + Math.sin(w.a1) * WING_ARM * s;
  const tx = wx + Math.cos(w.a2) * w.hand * s;
  const ty = wy + Math.sin(w.a2) * w.hand * s;
  const at = (t: number): [number, number, number, number] => {
    if (t < 0.45) {
      const u = t / 0.45;
      return [x + (wx - x) * u, y + (wy - y) * u, Math.cos(w.a1), Math.sin(w.a1)];
    }
    const u = (t - 0.45) / 0.55;
    return [wx + (tx - wx) * u, wy + (ty - wy) * u, Math.cos(w.a2), Math.sin(w.a2)];
  };
  // Secondaries short, primaries long and swept out along the hand.
  const n = 8;
  const side = ahead ? -1 : 1;
  for (let k = n - 1; k >= 0; k--) {
    const t = k / (n - 1);
    const [bx, by, ux, uy] = at(t);
    let dx = side * uy * (1 - t * 0.55) + ux * t * 0.95;
    let dy = -side * ux * (1 - t * 0.55) + uy * t * 0.95;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const len = (4.5 + t * 5.5) * s * (w.hand < 7 ? 0.75 : 1);
    const ex = bx + dx * len;
    const ey = by + dy * len;
    c.part();
    c.capsule(bx, by, ex - dx * 1.8, ey - dy * 1.8, 1.3, 0.9, FEATHER, o);
    c.capsule(ex - dx * 2, ey - dy * 2, ex, ey, 0.85, 0.45, k >= 5 ? ICE : RIME, o);
    if (k >= 4) c.spark(ex, ey, C_ICE, (far ? 0.15 : 0.3) + glints * 0.55);
    if (glints > 0 && k % 2 === 0) c.spark(ex - dx * 2.4, ey - dy * 2.4, C_WHITE, glints * 0.5);
  }
  // The arm, and its white coverts along the leading edge.
  c.part();
  c.capsule(x, y, wx, wy, 2.2, 1.6, FEATHER, o);
  c.capsule(wx, wy, tx, ty, 1.6, 0.8, FEATHER, o);
  c.part();
  const lx = Math.sin(w.a1) * side * 0.9;
  const ly = -Math.cos(w.a1) * side * 0.9;
  const cov = far ? FUR_GREY : FUR_WHITE;
  const co = far ? { bias: 2 } : o;
  c.capsule(x + lx, y + ly, wx + lx, wy + ly, 1.4, 1.1, cov, co);
  c.capsule(wx + lx * 0.6, wy + ly * 0.6, wx + (tx - wx) * 0.45, wy + (ty - wy) * 0.45, 1.1, 0.6, cov, co);
}

function harpy(p: HarpyPose): PixelCanvas {
  const F = MONSTER_FRAME.galeclaw;
  const c = new PixelCanvas(F.w, F.h);
  const b = p.bob;
  const L = p.lean;
  const chX = 23.5 + L;
  const chY = 18.5 + b;
  const hipX = 21 + L * 0.3;
  const hipY = 24.5 + b;

  wing(c, chX + 1, chY - 3, p.far, true, p.glints);

  // A fan of tail feathers, barred white.
  for (const [ex, ey, k] of [[11.5, 31, 0], [13.5, 33, 1], [16, 34, 2]] as const) {
    c.part();
    const sx = hipX - 1;
    const sy = hipY + 0.5;
    c.capsule(sx, sy, ex + L * 0.2, ey + b, 1.3, 0.8, FEATHER, { bias: k === 1 ? 0 : -1 });
    const mx = sx + (ex + L * 0.2 - sx) * 0.6;
    const my = sy + (ey + b - sy) * 0.6;
    c.capsule(mx, my, mx + (ex - sx) * 0.1, my + (ey + b - sy) * 0.1, 1, 0.9, RIME, { bias: k === 1 ? 0 : -1 });
  }

  // Legs: white feathered thighs, black scaled shins, talons of ice.
  const leg = (dx: number, far: boolean) => {
    const o = { bias: far ? -1 : 0 };
    const kx = hipX + 1.5 + dx + p.kick * 2.6;
    const ky = hipY + 3.6 - p.kick * 1.4;
    const fx = kx + 1 + p.kick * 3;
    const fy = ky + 4.2 - p.kick * 1.6;
    c.part();
    c.capsule(hipX + dx, hipY, kx, ky, 2.3, 1.6, FUR_WHITE, o);
    c.capsule(kx, ky, fx, fy, 0.9, 0.8, HORN, o);
    c.part();
    const spread = 0.5 + p.kick * 0.5;
    for (const [ax, ay] of [[1.6, 1.2 * spread + 0.6], [0.4, 2], [-1.2, 1.4 * spread + 0.4]] as const) {
      c.line(fx, fy, fx + ax * (1 + p.kick * 0.4), fy + ay, ICE, () => ({ x: -0.4, y: 0.4, z: 0.8 }));
      c.spark(fx + ax * (1 + p.kick * 0.4), fy + ay, C_ICE, 0.35);
    }
  };
  leg(-1.2, true);

  // The body: a midnight back, a white breast scalloped with feathers.
  c.part();
  c.capsule(chX, chY, hipX, hipY, 4, 3, FEATHER);
  const front = (y: number) => chX + (hipX - chX) * clamp01((y - chY) / (hipY - chY));
  mark(c, chX - 7, chY - 5, chX + 6, hipY + 4, (x, y) => x - front(y) > -1.4 + (hash2(x, y, 5) > 0.6 ? 1 : 0), FUR_WHITE, 1);
  for (let y = Math.round(chY - 1); y < hipY + 1; y += 2) {
    for (let x = Math.round(chX - 2); x < chX + 4; x += 2) {
      const yy = y + ((x >> 1) & 1);
      if (c.materialAt(x, yy) === FUR_WHITE) c.shade(x, yy, -1);
    }
  }
  leg(0.6, false);

  // The head: a dark cowl of feathers, a white crest swept back, a pale
  // face with ice-lit eyes under a scowl, a black hooked beak.
  const hx = chX + 3.4;
  const hy = chY - 6.4;
  const cr = p.crest;
  c.part();
  for (const [ax, ay, ex, ey, r] of [[-0.6, -2.6, -6.8, -6.2 - cr * 2.2, 1.4], [-1.6, -1.2, -8, -2.8 - cr * 1.6, 1.3], [-1.6, 0.6, -6.6, 1.2 - cr * 0.8, 1.1]] as const) {
    c.capsule(hx + ax, hy + ay, hx + ex, hy + ey, r, 0.45, FUR_WHITE);
    c.px(hx + ex, hy + ey, ICE, FLAT);
    c.spark(hx + ex, hy + ey, C_ICE, 0.5);
  }
  c.part();
  c.ellipse(hx - 0.6, hy - 0.2, 3.9, 3.6, FEATHER, { normal: round(0.85) });
  c.part();
  c.ellipse(hx + 0.6, hy + 3.2, 2.6, 1.7, FUR_WHITE, { normal: round(0.8) });
  c.part();
  c.ellipse(hx + 1.4, hy + 0.7, 2.6, 2.8, PALE, { normal: round(0.8) });
  c.part();
  c.px(hx + 1.8, hy - 0.1, GLOW_ICE, FLAT);
  c.spark(hx + 1.8, hy - 0.1, C_ICE, 0.6);
  c.line(hx + 0.6, hy - 1.6, hx + 2.6, hy - 1, FEATHER);
  // The beak.
  c.part();
  c.capsule(hx + 3, hy + 0.6, hx + 5, hy + 1.5, 1, 0.55, HORN);
  c.px(hx + 4.8, hy + 2.4, HORN, sphere(0.3, -0.4));
  if (p.beak) {
    c.px(hx + 3.6, hy + 2, HOLLOW, FLAT);
    c.line(hx + 3, hy + 2.8, hx + 4.2, hy + 3.4, HORN);
  }

  wing(c, chX - 2, chY - 1.6, p.near, false, p.glints);
  return c;
}

const FLAP: [WingSet, WingSet][] = [
  // Up, coming down, down, going up (folded a little).
  [{ a1: -2.3, a2: -2.75, hand: 8.5 }, { a1: -0.85, a2: -0.4, hand: 8.5 }],
  [{ a1: -2.95, a2: 3.0, hand: 8.5 }, { a1: -0.25, a2: 0.15, hand: 8.5 }],
  [{ a1: 2.5, a2: 2.1, hand: 8.5 }, { a1: 0.6, a2: 1.0, hand: 8.5 }],
  [{ a1: -2.65, a2: -2.2, hand: 6 }, { a1: -0.5, a2: -0.95, hand: 6 }],
];

/**
 * Galeclaw: idle and walk (the wingbeat she hovers on), windup (wings
 * swept up high, crest raised: a gust coming), gust (both wings thrown
 * forward), gather (wings folded high, ice glinting on every primary: a
 * volley coming), throw (wings flung wide).
 */
export function buildGaleclawSheet(): MonsterSheet {
  const flap = (f: number, fast: boolean): HarpyPose => ({
    bob: fast ? [1, 0, -1, 0][f] : [1, 0.5, -0.5, 0][f],
    lean: fast ? 1 : 0,
    near: FLAP[f][0],
    far: FLAP[f][1],
    kick: 0,
    glints: 0,
    beak: false,
    crest: 0,
  });
  return sheet(
    MONSTER_FRAME.galeclaw,
    {
      ...frames('flap', 4, (f) => harpy(flap(f, false))),
      ...frames('rush', 4, (f) => harpy(flap(f, true))),
      ...frames('rear', 2, (f) =>
        harpy({ bob: [0, 0.5][f], lean: [-1, -2][f], near: { a1: -2.0, a2: -2.5, hand: 8.5 }, far: { a1: -1.25, a2: -0.8, hand: 8.5 }, kick: [0.5, 1][f], glints: 0, beak: f === 1, crest: [0.6, 1][f] }),
      ),
      gust0: () => harpy({ bob: 1, lean: 2, near: { a1: 0.2, a2: 0.7, hand: 8.5 }, far: { a1: -0.45, a2: 0.05, hand: 8.5 }, kick: 0.3, glints: 0, beak: true, crest: 1 }),
      ...frames('gather', 2, (f) =>
        harpy({ bob: [0, -0.5][f], lean: -0.5, near: { a1: -2.0, a2: -1.6, hand: 6 }, far: { a1: -1.2, a2: -1.6, hand: 6 }, kick: 0.2, glints: [0.6, 1][f], beak: false, crest: 0.5 }),
      ),
      throw0: () => harpy({ bob: 0.5, lean: 1.5, near: { a1: -3.05, a2: 2.95, hand: 8.5 }, far: { a1: -0.4, a2: 0, hand: 8.5 }, kick: 0.6, glints: 0.4, beak: true, crest: 0.8 }),
    },
    [
      anim('idle', 'flap', 4, 7),
      anim('walk', 'rush', 4, 10),
      anim('windup', 'rear', 2, 4, false),
      anim('gust', 'gust', 1, 1, false),
      anim('gather', 'gather', 2, 6),
      anim('throw', 'throw', 1, 1, false),
    ],
  );
}

// ---------------------------------------------------------------- Chillstone

/** The row it rests on. */
const SG = 32.5;

interface StonePose {
  /** Squash and stretch about its foot. */
  sx: number;
  sy: number;
  /** A tremble, px. */
  dx: number;
  /** 0 dark (spent), up to 1 blazing. */
  rune: number;
  /** Snow shaken off (landing). */
  puff: boolean;
}

/** The stone's outline before squash: a lean menhir, its top slanting up to the right. */
const STONE_SHAPE: Pt[] = [
  [7.2, SG],
  [6.3, 26],
  [6.7, 17],
  [7.9, 10.5],
  [10.1, 6],
  [13.2, 3.4],
  [16.4, 2.4],
  [19.2, 3.2],
  [21.2, 5.8],
  [20.4, 7.8],
  [22.4, 9.2],
  [23.2, 15],
  [23.6, 24],
  [23, SG],
];

/** Runes cut into its face: two slit eyes, a jagged mouth and a column of marks. */
const EYES: Pt[] = [[10.5, 11.5], [11.5, 12], [12.5, 12.5], [16.5, 12.5], [17.5, 12], [18.5, 11.5]];
const BROWS: Pt[] = [[10.5, 10.5], [11.5, 11], [12.5, 11.5], [16.5, 11.5], [17.5, 11], [18.5, 10.5]];
const MOUTH: Pt[] = [[11.5, 18.5], [12.5, 17.5], [13.5, 17.5], [14.5, 17.5], [15.5, 17.5], [16.5, 17.5], [17.5, 18.5]];
const GLYPHS: Pt[] = [
  // An algiz down its breast, and two short marks beside it.
  [14.5, 21.5], [14.5, 22.5], [14.5, 23.5], [14.5, 24.5], [14.5, 25.5], [14.5, 26.5], [14.5, 27.5], [13.5, 22.5], [15.5, 22.5], [12.5, 21.5], [16.5, 21.5],
  [13.5, 26.5], [15.5, 26.5], [12.5, 27.5], [16.5, 27.5],
  [9.5, 22.5], [9.5, 23.5], [9.5, 24.5], [10.5, 25.5],
  [20.5, 21.5], [20.5, 22.5], [19.5, 23.5], [20.5, 24.5],
];

function chillstone(p: StonePose): PixelCanvas {
  const F = MONSTER_FRAME.chillstone;
  const c = new PixelCanvas(F.w, F.h);
  const ax = 15;
  const T = (x: number, y: number): Pt => [ax + (x - ax) * p.sx + p.dx, SG - (SG - y) * p.sy];
  const shape = STONE_SHAPE.map(([x, y]) => T(x, y));

  // The stone: faceted, its lit face to the left, rough with frost-pocked grain.
  c.part();
  const leftAt = (y: number) => T(6.2, y)[0];
  const rightAt = (y: number) => T(23.4, y)[0];
  poly(c, shape, STONE, (x, y) => {
    const yy = SG - (SG - y) / p.sy;
    const l = leftAt(yy);
    const r = rightAt(yy);
    const t = ((x + 0.5 - l) / Math.max(1, r - l)) * 2 - 1;
    const g = (hash2(x - Math.round(p.dx), Math.round(yy), 17) - 0.5) * 0.3;
    const top = yy < 9.5 ? 0.55 : 0;
    const nx = t < -0.45 ? -0.62 : t > 0.48 ? 0.6 : -0.05;
    const l2 = Math.hypot(nx + g, 0.2 + top, 0.8) || 1;
    return { x: (nx + g) / l2, y: (0.2 + top + g * 0.5) / l2, z: 0.8 / l2 };
  });
  // Cracks.
  c.part();
  const crack = (pts: Pt[]) => {
    for (let k = 0; k < pts.length - 1; k++) c.line(...T(...pts[k]), ...T(...pts[k + 1]), HOLLOW);
  };
  crack([[20.4, 8], [19.4, 10], [20.2, 13]]);
  crack([[7.4, 14], [9.2, 15.6]]);
  // Faint strata through the stone.
  for (const yy of [15.5, 22.5, 28.5]) for (let x = 7; x < 24; x++) if (hash2(x, yy, 19) > 0.35) c.shade(...T(x, yy), -1);
  crack([[7.4, 28], [9, 30], [8.6, SG - 0.5]]);
  crack([[19.6, 29], [21, 27.2]]);

  // Runes: lit from within, or cold grooves once it has spent itself.
  c.part();
  const rune = (pts: Pt[], bright: number) => {
    for (const [x, y] of pts) {
      const [tx, ty] = T(x, y);
      if (p.rune <= 0.05) c.px(tx, ty, HOLLOW, FLAT);
      else {
        c.px(tx, ty, GLOW_ICE, FLAT, { glow: Math.min(1, p.rune * bright), bias: p.rune < 0.6 ? -1 : 0 });
        if (p.rune > 0.8) c.spark(tx, ty, C_ICE, (p.rune - 0.8) * 2.5 * bright);
      }
    }
  };
  for (const [x, y] of BROWS) c.px(...T(x, y), HOLLOW, FLAT);
  for (const [x, y] of MOUTH) c.px(...T(x, y - 1), HOLLOW, FLAT);
  rune(EYES, 1.2);
  rune(MOUTH, 0.75);
  rune(GLYPHS, 0.85);
  if (p.rune > 0.9) {
    for (const [x, y] of [[11.5, 12], [17.5, 12]] as const) {
      const [tx, ty] = T(x, y);
      c.spark(tx, ty - 1, C_WHITE, 0.6);
      c.spark(tx - 1, ty, C_ICE, 0.4);
      c.spark(tx + 1, ty, C_ICE, 0.4);
    }
  }

  // A cap of snow on its slanted top, a brow of icicles, frost at its foot.
  c.part();
  poly(c, [T(9, 8.6), T(10.4, 5.4), T(13.2, 2.8), T(16.4, 1.8), T(19.4, 2.6), T(21.6, 5.6), T(20.2, 6.6), T(18.4, 5.4), T(16.6, 6.4), T(14.2, 5.8), T(12.4, 7.2), T(10.4, 7.6)], SNOW, (x, y) => sphere(0, -0.6 + (hash2(x, y, 23) - 0.5) * 0.3, 1));
  c.part();
  const [ix0, iy0] = T(12, 7.6);
  const [ix1] = T(15.5, 7.6);
  icicles(c, Math.round(ix0), Math.round(ix1), Math.round(iy0 - 0.6), 3, 5);
  mark(c, 0, T(0, 29)[1], 30, SG + 1, (x, y) => hash2(x, y, 31) > 0.55, RIME);
  mark(c, 0, T(0, 15)[1], T(9, 0)[0], T(0, 23)[1], (x, y) => hash2(x, y, 37) > 0.82, RIME);
  if (p.puff) {
    for (const [x, y, a] of [[4, SG - 1, 0.6], [26, SG - 1, 0.6], [3, SG - 3, 0.35], [27, SG - 2.5, 0.4], [9, 4, 0.4], [20, 2, 0.35]] as const) c.spark(x, y, C_WHITE, a);
  }
  return c;
}

/**
 * Chillstone: idle (its runes breathing), crouch (squat before a hop),
 * air (stretched, aloft), land (squashed, snow shaken off), windup (runes
 * blazing, trembling: the big leap coming), spent (runes dark, slumped:
 * its opening).
 */
export function buildChillstoneSheet(): MonsterSheet {
  const S = { sx: 1, sy: 1, dx: 0, rune: 0.6, puff: false };
  return sheet(
    MONSTER_FRAME.chillstone,
    {
      ...frames('idle', 4, (f) => chillstone({ ...S, rune: [0.5, 0.62, 0.74, 0.62][f], sy: [1, 1, 1.02, 1][f] })),
      crouch0: () => chillstone({ ...S, sx: 1.14, sy: 0.84, rune: 0.7 }),
      air0: () => chillstone({ ...S, sx: 0.9, sy: 1.1, rune: 0.75 }),
      land0: () => chillstone({ ...S, sx: 1.2, sy: 0.8, rune: 0.85, puff: true }),
      ...frames('charge', 3, (f) => chillstone({ ...S, sx: [1.04, 1.08, 1.12][f], sy: [0.97, 0.93, 0.88][f], dx: [-0.6, 0.6, -0.6][f], rune: [0.85, 0.95, 1][f] })),
      ...frames('spent', 2, (f) => chillstone({ ...S, sx: 1.12, sy: 0.9, rune: [0.02, 0.2][f] })),
    },
    [
      anim('idle', 'idle', 4, 3),
      anim('crouch', 'crouch', 1, 1, false),
      anim('air', 'air', 1, 1, false),
      anim('land', 'land', 1, 1, false),
      anim('windup', 'charge', 3, 10),
      anim('spent', 'spent', 2, 2),
    ],
  );
}

// ---------------------------------------------------------------- Spells (pure light)

type Px = Uint8ClampedArray;

const put = (px: Px, w: number, x: number, y: number, c: RGB, a = 255) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || (y * w + x) * 4 >= px.length) return;
  const i = (y * w + x) * 4;
  if (px[i + 3] && px[i] + px[i + 1] + px[i + 2] > c[0] + c[1] + c[2]) return;
  px.set([c[0], c[1], c[2], a], i);
};

const WHITE = hex('#ffffff');
const PALE_ICE = hex('#c8f4ff');
const MID_ICE = hex('#7ad4ff');
const DEEP_ICE = hex('#2a86d8');

export const FN_CLAW_W = 24;
export const FN_CLAW_H = 22;

/** Three claw streaks raked downward and forward, frame `f` of three: whole, thinning, scattered. */
function clawRake(f: number): Px {
  const w = FN_CLAW_W;
  const h = FN_CLAW_H;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let k = 0; k < 3; k++) {
    for (let s = 0; s <= 40; s++) {
      const t = s / 40;
      const x = 3 + t * 17 + k * 1.5;
      const y = 2 + k * 5 + t * 6 + Math.sin(t * Math.PI) * -2.5;
      const thick = Math.sin(t * Math.PI) * (1.7 - f * 0.5) * (0.7 + t * 0.5);
      for (let d = -2; d <= 2; d++) {
        if (Math.abs(d) > thick) continue;
        if (f === 2 && bayer(Math.round(x), Math.round(y + d)) > 0.45) continue;
        put(px, w, x, y + d, Math.abs(d) < thick * 0.45 ? WHITE : Math.abs(d) < thick * 0.8 ? PALE_ICE : MID_ICE);
      }
    }
  }
  return px;
}

export const FN_GUST_W = 64;
export const FN_GUST_H = 40;

/**
 * The harpy's gust: a cone of wind from its apex at the left middle,
 * streaks racing out, frame `f` of three (the streaks move on).
 */
function gustCone(f: number): Px {
  const w = FN_GUST_W;
  const h = FN_GUST_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cy = h / 2;
  // A faint wash filling the cone, thinning outward.
  for (let y = 0; y < h; y++) {
    for (let x = 2; x < w; x++) {
      const u = x / w;
      const half = 2 + u * (h / 2 - 3);
      const v = Math.abs(y + 0.5 - cy) / half;
      if (v > 1) continue;
      const k = (1 - v * v) * (0.5 + u * 0.5) * (1 - Math.pow(u, 4));
      if (bayer(x, y) < k * 0.3) put(px, w, x, y, DEEP_ICE, 255);
    }
  }
  // Streaks along the cone, broken into dashes that ride outward frame by frame.
  for (let k = 0; k < 9; k++) {
    const lane = (k / 8) * 2 - 1;
    const curl = Math.sin(k * 2.3) * 0.12;
    for (let x = 3; x < w - 1; x++) {
      const u = x / w;
      const half = 2 + u * (h / 2 - 3);
      const y = cy + lane * half * 0.85 + Math.sin(u * 6 + k) * 1.2 + curl * x * 0.2;
      const dash = (x + f * 7 + k * 5) % 14;
      if (dash > 7) continue;
      const bright = dash < 2 ? WHITE : dash < 5 ? PALE_ICE : MID_ICE;
      put(px, w, x, y, bright);
    }
  }
  return px;
}

export const FN_FEATHER_W = 13;
export const FN_FEATHER_H = 7;

/** A feather turned to ice, pointing right: a white quill, frosted vanes, a needle tip. */
function iceFeather(): Px {
  const w = FN_FEATHER_W;
  const h = FN_FEATHER_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cy = 3;
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    const half = u < 0.2 ? u * 6 : 1.9 * (1 - Math.pow((u - 0.2) / 0.8, 2.2)) + 0.4;
    for (let y = 0; y < h; y++) {
      const d = Math.abs(y - cy);
      if (d > half) continue;
      // Barbs: the vane broken into slanting strokes.
      if (d > 0.5 && (x + d) % 3 === 0) continue;
      put(px, w, x, y, d < 0.5 ? WHITE : d < half - 0.6 ? PALE_ICE : MID_ICE);
    }
  }
  put(px, w, w - 1, cy, WHITE);
  return px;
}

export const FN_SIGIL_W = 44;
export const FN_SIGIL_H = 24;

/** The witch's sigil laid on the floor: twin rings, rune ticks between them and a six-pointed star, frame `f` of two. */
function sigil(f: number): Px {
  const w = FN_SIGIL_W;
  const h = FN_SIGIL_H;
  const px = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 1.5;
  const ry = h / 2 - 1.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      if (Math.abs(r - 1) < 0.06) put(px, w, x, y, r > 1 ? MID_ICE : WHITE);
      else if (Math.abs(r - 0.8) < 0.05) put(px, w, x, y, PALE_ICE);
      else if (r < 1 && r > 0.8) {
        // Rune ticks between the rings, every one a different little mark.
        const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16 + f * 0.5) % 16;
        const s = (((a + Math.PI) / (Math.PI * 2)) * 16 + f * 0.5) % 1;
        const ticks = [0.25, 0.5, 0.75].filter((_, i) => (seg >> i) & 1 || i === 1);
        if (ticks.some((q) => Math.abs(s - q) < 0.08)) put(px, w, x, y, (seg + f) % 3 ? PALE_ICE : WHITE);
      }
    }
  }
  // The star: two triangles.
  for (const off of [0, Math.PI / 3]) {
    for (let k = 0; k < 3; k++) {
      const a0 = off + (k / 3) * Math.PI * 2 - Math.PI / 2 + f * 0.05;
      const a1 = off + ((k + 1) / 3) * Math.PI * 2 - Math.PI / 2 + f * 0.05;
      const x0 = cx + Math.cos(a0) * rx * 0.78;
      const y0 = cy + Math.sin(a0) * ry * 0.78;
      const x1 = cx + Math.cos(a1) * rx * 0.78;
      const y1 = cy + Math.sin(a1) * ry * 0.78;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let s = 0; s <= n; s++) if ((s + f) % 4 !== 3) put(px, w, x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, MID_ICE, 255);
    }
  }
  put(px, w, cx, cy, WHITE);
  return px;
}

export const FN_SPARK = 15;

/** A blow turned aside: a four-pointed star of white light with short diagonals. */
function blockSpark(): Px {
  const s = FN_SPARK;
  const px = new Uint8ClampedArray(s * s * 4);
  const c = 7;
  for (let k = -7; k <= 7; k++) {
    const d = Math.abs(k);
    const col = d < 2 ? WHITE : d < 4 ? PALE_ICE : MID_ICE;
    if (d < 7 || k < 0) put(px, s, c + k, c, col);
    if (d < 6) put(px, s, c, c + k, col);
  }
  for (let k = 1; k <= 3; k++) for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) put(px, s, c + sx * k, c + sy * k, k === 1 ? WHITE : PALE_ICE);
  return px;
}

/**
 * The normal creatures' own spells: `fn_claw` (strip c0..c2, anim
 * `fn_claw_rake`), `fn_gust` (strip g0..g2, anim `fn_gust_blow`),
 * `fn_feather`, `fn_sigil` (strip s0..s1, anim `fn_sigil_turn`),
 * `fn_spark`. All pure light, for ADD.
 */
export function frostNormalFx(r: FxRegistrar): void {
  r.strip('fn_claw', FN_CLAW_W, FN_CLAW_H, [0, 1, 2].map(clawRake), 'c');
  r.anim('fn_claw_rake', 'fn_claw', ['c0', 'c1', 'c2'], 16, false);
  r.strip('fn_gust', FN_GUST_W, FN_GUST_H, [0, 1, 2].map(gustCone), 'g');
  r.anim('fn_gust_blow', 'fn_gust', ['g0', 'g1', 'g2'], 14, true);
  r.image('fn_feather', FN_FEATHER_W, FN_FEATHER_H, iceFeather());
  r.strip('fn_sigil', FN_SIGIL_W, FN_SIGIL_H, [0, 1].map(sigil), 's');
  r.anim('fn_sigil_turn', 'fn_sigil', ['s0', 's1'], 5, true);
  r.image('fn_spark', FN_SPARK, FN_SPARK, blockSpark());
}
