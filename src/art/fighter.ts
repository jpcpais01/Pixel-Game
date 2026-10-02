// The fighter, drawn procedurally from a small rig like the Jedi.
//
// A bare-knuckle martial artist: a sleeveless off-white gi tied with a black
// belt, indigo trousers, taped feet and forearms, red gloves, and a red
// headband whose tails stream behind him as he moves.
//
// The body keeps to the 24x32 box; frames are larger so a straight punch can
// reach past it. Drawing functions work in body-box coordinates. Fists are
// posed in the fighter's own terms (forward, out to the side, height) and
// placed for each view, so one set of keyframes serves every direction.
//
// Two skins share the rig. The luchador (the brawler's) is a masked wrestler:
// a blue mask with white flames round the eyes and a gold crest, a bare
// chest, a gold title belt, a crimson cape and tall boots. The stone guardian
// (the iron monk's) is a temple statue come to life: basalt skin cracked with
// fire, a moss-dark robe and ember sash, and a carved ring behind the head.
// The champ (also the brawler's) is a big ring hero off a merch stand: a green
// tee with an orange print, a matching cap, jorts past the knee, sweatbands,
// dog tags and white sneakers. Tigerclaw (the brawler's) is a kung-fu tiger:
// an orange gi striped black, a tiger's-head hood with ears and fangs, a
// banded tail, white wraps and claws on dark gloves. The Monkey King (the iron
// monk's) is Sun Wukong: gold mail, a red sash, fur at the shoulders, a gold
// circlet with two pheasant plumes, the staff across his back and a curling tail.

import { FLAT, PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import {
  BLACK_BELT, BRONZE, CHI_CORE, CHI_HOT, CHI_MID, EYE, FIGHTER_HAIR, GI, GI_TROUSER, GLOVE, HEADBAND, MONK_BROW, MONK_ROBE, MONK_SASH,
  MONK_TROUSER, MONK_WRAP, PRAYER_BEAD, QI_CORE, QI_HOT, QI_MID, SKIN, WRAP,
} from './palette';
import { DIRS, type Dir } from './wizard';

export const FIGHTER_W = 48;
export const FIGHTER_H = 50;
export const BODY_X = 12;
export const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet. */
export const FIGHTER_ORIGIN_X = BODY_X + 12;
export const FIGHTER_ORIGIN_Y = BODY_Y + 31;
/** The chest's height above the origin, where punches fly from. */
export const CHEST_Y = 12;

/** A fist, in the fighter's terms: `f` forward, `s` out to its own side, `h` up. */
export interface Fist {
  f: number;
  s: number;
  h: number;
}

export interface Pose {
  /** Whole body raised (bounce, walk passing frames). */
  lift: number;
  /** Upper body lowered (crouching into a blow). */
  breath: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Upper body shifted forward (side view), in pixels. */
  lean: number;
  /** Lead fist (screen left from the front and back, the near arm from the side) and rear fist. */
  a: Fist;
  b: Fist;
  /** Headband tails: how far they swing out behind. */
  tails: number;
  /** 0..1 chi burning round the fists. */
  chi: number;
  blink?: boolean;
  // The idle moment's (`rest`) extras, drawn facing the viewer only.
  /** 0..1 the screen-right knee drawn up, its foot off the ground (the monk's crane stance). */
  knee?: number;
  /** Knuckles cracking: little pops of light round the joined fists, struck by this seed (0: none). */
  pop?: number;
}

const F = (f: number, s: number, h: number): Fist => ({ f, s, h });

/** Guard: the lead fist forward at the chin, the rear one tucked by the cheek. */
const GUARD_A = F(2.2, 3.0, 1.0);
const GUARD_B = F(1.4, 3.3, 2.2);

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

/**
 * One of the fighter's styles: what he wears and which moves he knows. The
 * brawler is the default; the iron monk is a heavier fighter with his own
 * palm strikes and leap (see Fighter.ts), drawn on the same rig.
 */
export interface FighterLook {
  /** Texture key and animation prefix, e.g. "fighter" or "fighter_monk". */
  key: string;
  /** Shaved head, prayer beads and a sash over the shoulder, in place of the spiky hair and headband. */
  monk?: boolean;
  gi: Material;
  trouser: Material;
  belt: Material;
  band: Material;
  /** The hand: a red glove on the brawler, a bare palm on the monk. */
  glove: Material;
  /** Forearm tape, or bracers. */
  wrap: Material;
  feet: Material;
  hair: Material;
  /** Light-only colours round the hands: core, hot, mid. */
  chi: RGB[];
  /** Hand size. */
  hand: number;
  anims: FighterAnimDef[];
  /** Bare skin (the guardian's is stone), the eyes, the monk's sash and his beads. */
  skin: Material;
  eye: Material;
  sash: Material;
  bead: Material;
  /** The luchador: a masked wrestler with a cape, bare chest, a title belt and boots. */
  lucha?: { mask: Material; trim: Material; white: Material; cape: Material; jewel: Material };
  /** The stone guardian: a carved ring hovering behind the head, and veins of fire through the stone. */
  guardian?: { ring: Material; vein: Material };
  /** The champ: the tee's colour is `gi`; its print, the dark in it, the cap, the jorts' frayed hem and the dog tags. */
  champ?: { print: Material; ink: Material; cap: Material; fray: Material; chain: Material };
  /** Tigerclaw: a tiger's-head hood (the gi's orange), black stripes, white fur and fangs, pink in the ears, claws on the gloves, and a tail. */
  tiger?: { stripe: Material; fur: Material; fang: Material; ear: Material; claw: Material };
  /** The Monkey King: chain mail (the gi), golden fur, a circlet, two pheasant plumes and their bars, and the staff across his back. */
  wukong?: { fur: Material; circlet: Material; plume: Material; bar: Material; staff: Material };
}

/** The style being drawn (set per frame by drawFighterFrame). */
let LK: FighterLook;

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height fists are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  scale: number;
  /** Drawn behind the body. */
  behind: boolean;
}

/** Where a fist lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Fist, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') {
    // Towards us: lower on screen and a little larger.
    return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, scale: 1 + Math.max(0, q.f - 3) * 0.03, behind: q.f < -1 };
  }
  if (view === 'up') {
    // Away from us: higher on screen, and out past the head so it shows.
    // Out past the head when thrown, tucked in behind the shoulders on guard.
    const s = q.f > 4 ? Math.max(q.s, 4.6) : Math.min(q.s, 2.4);
    return { x: 12 + side * s, y: CH + U - q.h - q.f * 0.8, scale: 1 - Math.max(0, q.f - 3) * 0.02, behind: q.f > 1 };
  }
  // Facing left; the far arm sits a touch higher and behind the body.
  const far = arm === 'b';
  return { x: hx - 1.5 - q.f * 1.1 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), scale: 1, behind: far };
}

// ---------------------------------------------------------------------------
// Parts

/** A bare arm from the shoulder, bent at the elbow (towards `hint`), taped at the wrist, ending in a glove. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], chi: number, bias = 0): void {
  const { x: fx, y: fy } = p;
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
    // Two equal bones: the elbow sits where they meet, on the side the hint points.
    const ang = Math.acos(Math.min(1, d / (reach * 2)));
    const base = Math.atan2(dy, dx);
    let best = -Infinity;
    for (const t of [base + ang, base - ang]) {
      const cx = sx + Math.cos(t) * reach;
      const cy = sy + Math.sin(t) * reach;
      const score = (cx - sx) * hint[0] + (cy - sy) * hint[1];
      if (score > best) {
        best = score;
        ex = cx;
        ey = cy;
      }
    }
  }
  c.part();
  c.capsule(sx, sy, ex, ey, 1.65, 1.35, LK.skin, { bias });
  if (LK.champ || LK.wukong) {
    // The tee's short sleeve (or the Monkey King's mail), stretched over the top of the arm.
    c.part();
    c.capsule(sx, sy, sx + (ex - sx) * 0.45, sy + (ey - sy) * 0.45, 1.95, 1.8, LK.gi, { bias });
  }
  c.part();
  c.capsule(ex, ey, fx, fy, 1.4, 1.2, LK.skin, { bias });
  c.part();
  const band = LK.monk ? 1.5 : 1.3;
  c.capsule(ex + (fx - ex) * 0.45, ey + (fy - ey) * 0.45, fx, fy, band, band, LK.wrap, { bias });
  if (LK.tiger) {
    // Stripes painted round the bare forearm and the upper arm.
    const m = LK.tiger.stripe;
    for (const [ax, ay, bx, by, k] of [[sx, sy, ex, ey, 0.55], [ex, ey, fx, fy, 0.22]] as const) {
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / l;
      const ny = (bx - ax) / l;
      const mx = ax + (bx - ax) * k;
      const my = ay + (by - ay) * k;
      stripe(c, [[mx + nx * 0.7, my + ny * 0.7], [mx - nx * 0.5, my - ny * 0.5]], m);
    }
  }
  c.part();
  c.ellipse(fx, fy, LK.hand * p.scale, LK.hand * 0.92 * p.scale, LK.glove, { bias });
  if (LK.tiger && bias >= 0) {
    // Ivory claws curving out past the knuckles, along the line of the forearm.
    const l = Math.hypot(fx - ex, fy - ey) || 1;
    const ux = (fx - ex) / l;
    const uy = (fy - ey) / l;
    const r = LK.hand * p.scale + 0.4;
    c.part();
    for (const s of [-0.9, 0.9]) c.px(fx + ux * r - uy * s, fy + uy * r + ux * s, LK.tiger.claw, sphere(ux * 0.4, -0.5, 1), { bias: 1 });
  }
  if (LK.guardian) {
    // A crack of fire down the stone arm, from the shoulder to the elbow and on towards the bracer.
    const v = LK.guardian.vein;
    c.px(sx + (ex - sx) * 0.45, sy + (ey - sy) * 0.45, v, FLAT, { glow: bias < 0 ? 0.45 : 0.8 });
    c.px(ex + (fx - ex) * 0.2, ey + (fy - ey) * 0.2, v, FLAT, { glow: bias < 0 ? 0.45 : 0.8 });
  }
  chiGlow(c, fx, fy, chi * (bias < 0 ? 0.6 : 1));
}

/** Chi flickering round a fist, in the emissive layer. */
function chiGlow(c: PixelCanvas, x: number, y: number, k: number): void {
  if (k <= 0) return;
  const cols = LK.chi;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + x * 0.7;
    const r = 2.4 + (i % 3) * 0.6;
    c.spark(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, cols[1 + (i % 2)], k * (i % 2 ? 0.45 : 0.7));
  }
  c.spark(x, y, cols[0], k * 0.35);
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  if (LK.champ) {
    // Jorts past the knee, frayed at the hem, bare shins down to the sneakers.
    const kx = hx + (fx - hx) * 0.62;
    const ky = hy + (fy - hy) * 0.62;
    c.part();
    c.capsule(kx, ky, fx, fy, 1.3, 1.2, LK.skin, { bias });
    c.part();
    c.capsule(hx, hy, kx, ky, 1.95, 1.8, LK.trouser, { bias });
    c.part();
    c.px(kx - 1, ky + 1, LK.champ.fray, FLAT_DOWN, { bias });
    c.px(kx + 1, ky + 1, LK.champ.fray, FLAT_DOWN, { bias: bias - 1 });
    return;
  }
  c.part();
  c.capsule(hx, hy, fx, fy, 1.8, 1.45, LK.trouser, { bias });
  if (LK.lucha) {
    // Tall laced wrestling boots up the shin, a white band round the top.
    c.part();
    c.capsule(hx + (fx - hx) * 0.5, hy + (fy - hy) * 0.5, fx, fy, 1.85, 1.6, LK.feet, { bias });
    c.part();
    c.px(hx + (fx - hx) * 0.5, hy + (fy - hy) * 0.5, LK.lucha.white, FLAT_DOWN, { bias });
  }
}

/** A taped foot. */
function foot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.15, LK.feet, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.7, 1.2, LK.feet, { flatten: 0.8, bias });
  if (LK.champ) {
    // A green flash on the side of each sneaker.
    c.part();
    c.px(side ? x : x - 1, y, LK.gi, FLAT_DOWN, { bias });
  }
}

/** Bare shoulder: the gi has no sleeves. The monk's sash covers one of his. */
function deltoid(c: PixelCanvas, x: number, y: number, rx = 2.1, m: Material = LK.skin): void {
  c.part();
  c.ellipse(x, y, rx, 1.8, m, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 0.95) });
}

function tail(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.part();
  c.capsule(x0, y0, x1, y1, 0.75, 0.55, LK.band);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    // Heavy brows over a hard stare.
    c.px(x, y - 1, LK.hair, FLAT_DOWN);
    if (blink) c.px(x, y, LK.skin, FLAT_DOWN, { bias: -1 });
    else c.px(x, y, LK.eye);
  }
}

/** Spiky hair on top of the head: tufts along row `y0 - 1`, taller ones on row `y0 - 2`. */
function spikes(c: PixelCanvas, low: number[], high: number[], y0: number): void {
  c.part();
  for (const x of low) c.px(x, y0 - 1, LK.hair, sphere(0, -0.8));
  for (const x of high) c.px(x, y0 - 2, LK.hair, sphere(-0.2, -0.9), { bias: 1 });
}

/** The monk's string of prayer beads, and the bronze disc hanging from it. */
function beads(c: PixelCanvas, pts: [number, number][], pendant?: [number, number]): void {
  c.part();
  pts.forEach(([x, y], i) => c.px(x, y, LK.bead, sphere(i % 2 ? 0.3 : -0.3, -0.6)));
  if (pendant) {
    c.part();
    c.px(pendant[0], pendant[1], LK.guardian?.vein ?? BRONZE, sphere(-0.3, -0.5), { bias: 1 });
  }
}

/**
 * The monk's sash slung across the torso: a band whose centre runs from x0 at
 * the top row to x1 at the bottom, clipped to the body's edges.
 */
function sash(c: PixelCanvas, top: number, bottom: number, x0: number, x1: number, half: number, edges: (y: number) => [number, number]): void {
  c.part();
  c.shape(top, bottom, (y) => {
    const k = (y - top) / Math.max(1, bottom - top);
    const m = x0 + (x1 - x0) * k;
    const [el, er] = edges(y);
    const l = Math.max(el, m - half);
    const r = Math.min(er, m + half);
    return r - l < 0.5 ? null : [l, r];
  }, LK.sash, (_x, _y, t, u) => sphere(t * 0.7 - 0.1, (u - 0.4) * 0.9, 1));
}

/**
 * The guardian's carved ring, hovering behind (or, seen from behind, in front
 * of) his head, with a rune of fire every eighth of the way round. Seen from
 * the side it is edge-on: a thin upright slab behind the head.
 */
function halo(c: PixelCanvas, x: number, y: number, r: number, edge = false): void {
  const g = LK.guardian;
  if (!g) return;
  c.part();
  if (edge) {
    c.ellipse(x, y, 1.05, r, g.ring, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8, 1) });
    for (const dy of [-r * 0.55, 0, r * 0.55]) c.px(x, y + dy, g.vein, FLAT, { glow: 0.8 });
    return;
  }
  for (let py = Math.floor(y - r - 1); py <= Math.ceil(y + r + 1); py++) {
    for (let px = Math.floor(x - r - 1); px <= Math.ceil(x + r + 1); px++) {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const d = Math.hypot(dx, dy);
      if (d < r - 0.55 || d > r + 0.55) continue;
      const a = Math.atan2(dy, dx) / (Math.PI / 4) + 0.5;
      const rune = Math.abs(a - Math.round(a)) < 0.13;
      if (rune) c.px(px, py, g.vein, FLAT, { glow: 0.85 });
      else c.px(px, py, g.ring, sphere((dx / d) * 0.7, (dy / d) * 0.7, 1));
    }
  }
}

/**
 * The luchador's cape seen from the front, hanging behind him from the
 * shoulders to the knees and flaring out past his arms, a gold hem at its foot.
 */
function capeFront(c: PixelCanvas, cx: number, top: number, bottom: number, sway: number): void {
  const k = LK.lucha!;
  const edge = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    const hw = 5.4 + 1.7 * u;
    const s = sway * u * 0.7;
    return [cx - hw + s, cx + hw + s];
  };
  c.part();
  c.shape(top, bottom - 1, edge, k.cape, (_x, _y, t, u) => sphere(t * 0.8, (u - 0.2) * 0.5, 1), { bias: -1 });
  c.part();
  c.shape(bottom, bottom, edge, k.trim, (_x, _y, t) => cyl(t, -0.2));
}

/** The cape from behind: it covers his back to the knees, folds running down it, his crest in gold between the shoulders. */
function capeBack(c: PixelCanvas, cx: number, top: number, bottom: number, sway: number): void {
  const k = LK.lucha!;
  const edge = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    const hw = 4.9 + 1.5 * u;
    const s = sway * u * 0.5;
    return [cx - hw + s, cx + hw + s];
  };
  c.part();
  c.shape(top, bottom - 1, edge, k.cape, (_x, _y, t, u) => sphere(t * 0.85, (u - 0.25) * 0.6, 1));
  for (let y = top + 3; y < bottom; y++) {
    const u = (y - top) / (bottom - top);
    for (const f of [-3.2, 0, 3.2]) c.shade(Math.round(cx - 0.5 + f * (1 + u * 0.3) + sway * u * 0.5), y, -1);
  }
  c.part();
  c.shape(bottom, bottom, edge, k.trim, (_x, _y, t) => cyl(t, -0.2));
  // The collar clasped across the shoulders, and a gold crest between them.
  c.part();
  c.shape(top, top, () => [cx - 4.2, cx + 4.2], k.trim, (_x, _y, t) => cyl(t, 0.3));
  c.part();
  for (const [x, y] of [[cx - 2, top + 3], [cx + 1, top + 3], [cx - 1, top + 4], [cx, top + 4], [cx - 1, top + 5], [cx, top + 5], [cx - 1, top + 2], [cx, top + 2]] as const) {
    c.px(x, y, k.trim, sphere(0, -0.4), { bias: y === top + 2 ? 1 : 0 });
  }
}

/** The cape in profile, streaming back from his shoulders, further the harder he moves. */
function capeSide(c: PixelCanvas, hx: number, top: number, bottom: number, sway: number): void {
  const k = LK.lucha!;
  const edge = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [hx + 0.2, hx + 3.1 + u * (2.2 + Math.max(0, sway) * 1.3)];
  };
  c.part();
  c.shape(top, bottom - 1, edge, k.cape, (_x, _y, t, u) => sphere(t * 0.7 + 0.2, (u - 0.2) * 0.5, 1), { bias: -1 });
  c.part();
  c.shape(bottom, bottom, edge, k.trim, (_x, _y, t) => cyl(t, -0.2));
}

/** A wrestler's bare chest from the front: the line under each pec, a breastbone, and the abs below. */
function muscles(c: PixelCanvas, cx: number, top: number, waist: number): void {
  for (const x of [cx - 4, cx - 3, cx - 2, cx + 1, cx + 2, cx + 3]) c.shade(x, top + 3, -1);
  c.shade(cx - 1, top + 2, -1);
  c.shade(cx, top + 2, -1);
  for (let y = top + 4; y < waist; y++) c.shade(y % 2 ? cx - 1 : cx, y, -1);
  c.shade(cx - 2, top + 5, -1);
  c.shade(cx + 1, top + 5, -1);
  // Light catching the top of each pec.
  c.shade(cx - 3, top + 1, 1);
  c.shade(cx + 2, top + 1, 1);
}

/** The championship belt: a gold strap two rows deep with a great plate at `plate` and a ruby set in it. */
function titleBelt(c: PixelCanvas, l: number, r: number, waist: number, plate: number): void {
  const k = LK.lucha!;
  c.part();
  c.shape(waist - 1, waist, () => [l, r], k.trim, (_x, _y, t) => cyl(t, 0), { bias: -1 });
  c.part();
  c.shape(waist - 2, waist + 1, (y) => (y === waist - 2 || y === waist + 1 ? [plate - 1.5, plate + 1.5] : [plate - 2.2, plate + 2.2]), k.trim, (_x, _y, t, u) => sphere(t * 0.8, (u - 0.5) * 0.9, 1));
  c.part();
  c.px(plate - 0.5, waist - 1, k.jewel, sphere(-0.3, -0.4));
  c.px(plate - 0.5, waist, k.jewel, sphere(-0.2, 0.3), { bias: -1 });
}

/**
 * The luchador's mask from the front: it covers his whole head but for the
 * mouth and chin, white flames licking up round the eyes, a gold stripe from
 * the brow over the crown into a short crest.
 */
function maskFront(c: PixelCanvas, cx: number, U: number, blink?: boolean): void {
  const k = LK.lucha!;
  c.part();
  c.ellipse(cx, 12.4 + U, 3.2, 2.95, k.mask);
  c.part();
  const dome = [2.3, 3.3];
  c.shape(8 + U, 9 + U, (y) => [cx - dome[y - 8 - U], cx + dome[y - 8 - U]], k.mask, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.9, 1));
  c.part();
  c.px(11, 13 + U, k.mask, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, k.mask, sphere(0.35, -0.2));
  // The mouth and chin, bare.
  c.part();
  c.shape(14 + U, 14 + U, () => [cx - 1.8, cx + 1.8], LK.skin, (_x, _y, t) => sphere(t * 0.8, 0.3, 1));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  // The stripe and crest.
  c.part();
  for (let y = 6; y <= 10; y++) {
    if (y === 6) {
      c.px(11, y + U, k.trim, sphere(-0.3, -0.8), { bias: 1 });
      c.px(12, y + U, k.trim, sphere(0.3, -0.8));
    } else {
      c.px(11, y + U, k.trim, sphere(-0.3, -0.4), { bias: y < 8 ? 1 : 0 });
      c.px(12, y + U, k.trim, sphere(0.3, -0.4), { bias: y < 8 ? 0 : -1 });
    }
  }
  // White flames round the eyes, the eyes dark within them.
  c.part();
  for (const [x, y] of [[10, 10], [9, 11], [10, 11], [9, 12], [13, 10], [14, 11], [13, 11], [14, 12]] as const) c.px(x, y + U, k.white, sphere(x < 12 ? -0.3 : 0.3, -0.3));
  for (const x of [10, 13]) {
    if (blink) c.px(x, 12 + U, k.white, FLAT_DOWN, { bias: -1 });
    else c.px(x, 12 + U, LK.eye);
  }
}

/** The mask from behind: the crest running down over the crown and the laces up the back of the head. */
function maskBack(c: PixelCanvas, cx: number, U: number): void {
  const k = LK.lucha!;
  c.part();
  c.ellipse(cx, 11.4 + U, 3.6, 3.5, k.mask, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.shade(cx - 2, 9 + U, 1);
  c.part();
  for (let y = 7; y <= 10; y++) {
    c.px(11, y + U, k.trim, sphere(-0.3, -0.5), { bias: y < 8 ? 1 : 0 });
    c.px(12, y + U, k.trim, sphere(0.3, -0.5), { bias: y < 8 ? 0 : -1 });
  }
  // The laces, criss-crossing.
  c.part();
  for (const [x, y] of [[11, 12], [12, 13], [11, 14], [12, 12], [11, 13], [12, 14]] as const) c.px(x, y + U, (x + y) % 2 ? k.white : k.mask, sphere(0, -0.2), { bias: (x + y) % 2 ? 0 : -1 });
}

/** The mask in profile: the crest sweeping back, a white flame round the eye, lace ends fluttering behind. */
function maskSide(c: PixelCanvas, hx: number, U: number, sway: number, blink?: boolean): void {
  const k = LK.lucha!;
  // The lace ends, behind the head.
  c.part();
  c.capsule(hx + 2.4, 12.8 + U, hx + 4.4 + sway * 0.5, 14.2 + U, 0.5, 0.45, k.white);
  c.capsule(hx + 2.4, 13.2 + U, hx + 3.8 + sway * 0.3, 15.2 + U, 0.5, 0.45, k.white);
  c.part();
  c.ellipse(hx - 1.1, 12.6 + U, 2.9, 2.8, k.mask);
  c.part();
  const skull: [number, number][] = [
    [-2.6, 2.0],
    [-3.6, 2.8],
    [-4.0, 3.1],
    [0.0, 3.1],
    [0.3, 2.9],
    [0.6, 2.3],
  ];
  c.shape(8 + U, 13 + U, (y) => [hx + skull[y - 8 - U][0], hx + skull[y - 8 - U][1]], k.mask, (_x, _y, t, u) => sphere(t * 0.9, u * 1.3 - 0.8, 1));
  c.part();
  c.px(hx - 5, 13 + U, k.mask, sphere(-0.6, -0.2), { bias: 1 });
  c.part();
  c.shape(14 + U, 14 + U, () => [hx - 4.4, hx - 1.6], LK.skin, (_x, _y, t) => sphere(t * 0.8 - 0.3, 0.3, 1));
  c.shade(hx - 4, 14 + U, -1);
  // The crest, a gold fin from the brow back over the crown.
  c.part();
  for (const [dx, y] of [[-3, 8], [-2, 7], [-1, 7], [0, 7], [1, 7], [-1, 6], [0, 6], [2, 8]] as const) c.px(hx + dx, y + U, k.trim, sphere(0.1 * dx, -0.8), { bias: y === 6 ? 1 : 0 });
  // The white flame round the eye, sweeping back.
  c.part();
  for (const [dx, y] of [[-4, 11], [-3, 11], [-2, 11], [-2, 12], [-1, 12], [-1, 11], [0, 12]] as const) c.px(hx + dx, y + U, k.white, sphere(-0.3, -0.3));
  if (blink) c.px(hx - 3, 12 + U, k.white, FLAT_DOWN, { bias: -1 });
  else c.px(hx - 3, 12 + U, LK.eye);
}


/**
 * The cap: a crown over rows 7 to 9 and a brim along row 10 that sticks out
 * past the head, throwing a line of shade over the brow. `x0`/`x1` bound the
 * crown on each row (screen coordinates); `brim` bounds the brim.
 */
function cap(c: PixelCanvas, U: number, crown: [number, number][], brim: [number, number]): void {
  const k = LK.champ!;
  c.part();
  c.shape(7 + U, 9 + U, (y) => crown[y - 7 - U], k.cap, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.8, 1));
  c.part();
  c.shape(10 + U, 10 + U, () => brim, k.cap, (_x, _y, t) => sphere(t * 0.6, -0.9, 0.5), { bias: 1 });
}

/** The champ from the front: an untucked tee with its print, dog tags, and the cap pulled low over a hard stare. */
function champFront(c: PixelCanvas, cx: number, top: number, waist: number, U: number, blink?: boolean): void {
  const k = LK.champ!;
  // The tee hangs loose over the jorts.
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LK.gi, (_x, _y, t) => cyl(t, -0.3), { bias: -1 });
  // Its print: an orange shield with a dark badge in it.
  c.part();
  for (const [x, y] of [[10, 3], [11, 3], [12, 3], [13, 3], [10, 4], [13, 4], [11, 5], [12, 5]] as const) c.px(x, top + y, k.print, sphere(x < 12 ? -0.3 : 0.3, -0.2));
  c.px(11, top + 4, k.ink, FLAT_DOWN);
  c.px(12, top + 4, k.ink, FLAT_DOWN);
  // The chain of his dog tags, and the tags on it.
  c.part();
  for (const [x, y] of [[9, 0], [10, 1], [13, 1], [14, 0]] as const) c.px(x, top + y, k.chain, sphere(0, -0.5));
  c.px(11, top + 2, k.chain, sphere(-0.3, -0.4), { bias: 1 });
  c.px(12, top + 2, k.chain, sphere(0.3, -0.4));

  deltoid(c, 7.1, 16.8 + U, 2.1, LK.gi);
  deltoid(c, 16.9, 16.8 + U, 2.1, LK.gi);

  // A square jaw, ears, and a buzz cut showing at the temples under the cap.
  c.part();
  c.ellipse(cx, 12.4 + U, 3.2, 2.95, LK.skin);
  c.part();
  c.px(11, 13 + U, LK.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, LK.skin, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  c.part();
  c.px(8, 12 + U, LK.skin, cyl(-0.8, 0));
  c.px(15, 12 + U, LK.skin, cyl(0.8, 0));
  c.px(8, 11 + U, LK.hair, cyl(-0.8, 0));
  c.px(15, 11 + U, LK.hair, cyl(0.8, 0));
  cap(c, U, [[cx - 2.6, cx + 2.6], [cx - 3.5, cx + 3.5], [cx - 3.8, cx + 3.8]], [cx - 4.3, cx + 4.3]);
  // The logo on the front of the cap.
  c.part();
  c.px(11, 8 + U, k.print, sphere(-0.2, -0.5));
  c.px(12, 8 + U, k.print, sphere(0.2, -0.5));
  // The brim's shadow across his brow, then the eyes under it.
  for (let x = 9; x <= 14; x++) c.shade(x, 11 + U, -1);
  eyes(c, [[10, 12 + U], [13, 12 + U]], blink);
}

/** The champ from behind: the tee's back print, the cap's strap over a buzzed nape. */
function champBack(c: PixelCanvas, cx: number, top: number, waist: number, U: number): void {
  const k = LK.champ!;
  c.part();
  c.shape(waist, waist, () => [cx - 4.1, cx + 4.1], LK.gi, (_x, _y, t) => cyl(t, -0.3), { bias: -1 });
  // A slogan across the shoulders, too small to read, in orange.
  c.part();
  for (let x = 9; x <= 14; x++) c.px(x, top + 2, k.print, sphere(x < 12 ? -0.3 : 0.3, -0.3), { bias: x % 2 ? 0 : -1 });
  for (const x of [10, 11, 12, 13]) c.px(x, top + 4, k.print, sphere(0, -0.2), { bias: -1 });
  // The chain round the back of his neck.
  c.px(10, top, k.chain, sphere(-0.2, -0.5));
  c.px(13, top, k.chain, sphere(0.2, -0.5));

  deltoid(c, 7.1, 16.8 + U, 2.1, LK.gi);
  deltoid(c, 16.9, 16.8 + U, 2.1, LK.gi);

  // The back of a buzzed head, ears out at the sides, the cap over it.
  c.part();
  c.ellipse(cx, 11.6 + U, 3.5, 3.4, LK.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.part();
  c.px(8, 12 + U, LK.skin, cyl(-0.8, 0));
  c.px(16, 12 + U, LK.skin, cyl(0.8, 0));
  cap(c, U, [[cx - 2.8, cx + 2.8], [cx - 3.7, cx + 3.7], [cx - 3.9, cx + 3.9]], [cx - 3.9, cx + 3.9]);
  // The gap over the strap at the back, the hair showing through it.
  c.part();
  c.px(11, 10 + U, LK.hair, FLAT_DOWN, { bias: -1 });
  c.px(12, 10 + U, LK.hair, FLAT_DOWN, { bias: -1 });
}

/** The champ in profile, facing left: tee, tags, a buzzed nape, the cap's brim jutting out over his eyes. */
function champSide(c: PixelCanvas, hx: number, top: number, waist: number, U: number, blink?: boolean): void {
  const k = LK.champ!;
  c.part();
  c.shape(waist, waist, () => [hx - 3.3, hx + 3.0], LK.gi, (_x, _y, t) => cyl(t * 0.9 - 0.1, -0.3), { bias: -1 });
  // The front of the print, and the tags on his chest.
  c.part();
  c.px(hx - 2, top + 3, k.print, sphere(-0.4, -0.2));
  c.px(hx - 2, top + 4, k.print, sphere(-0.4, -0.1));
  c.px(hx - 1, top + 3, k.print, sphere(-0.2, -0.2));
  c.part();
  c.px(hx - 2, top, k.chain, sphere(-0.3, -0.5));
  c.px(hx - 3, top + 1, k.chain, sphere(-0.5, -0.4), { bias: 1 });

  // Head in profile: skin, a buzzed back and nape, an ear.
  c.part();
  c.ellipse(hx - 1.1, 12.6 + U, 2.9, 2.8, LK.skin);
  c.part();
  c.px(hx - 5, 13 + U, LK.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  c.part();
  c.shape(11 + U, 13 + U, (y) => [hx + 0.2, hx + (y === 13 + U ? 2.2 : 3.0)], LK.hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.2, u * 0.6, 1));
  c.part();
  c.px(hx + 1, 12 + U, LK.skin, sphere(0.4, 0), { bias: 1 });
  cap(c, U, [[hx - 2.6, hx + 2.4], [hx - 3.6, hx + 3.0], [hx - 4.0, hx + 3.3]], [hx - 6.3, hx + 3.3]);
  c.part();
  c.px(hx - 3, 8 + U, k.print, sphere(-0.5, -0.5));
  c.shade(hx - 4, 11 + U, -1);
  c.shade(hx - 3, 11 + U, -1);
  eyes(c, [[hx - 3, 12 + U]], blink);
}

// ---------------------------------------------------------------------------
// Tigerclaw and the Monkey King

/** A bold stripe painted over something already drawn (a tiger's stripe on the gi, the hood, a forearm). */
function stripe(c: PixelCanvas, pts: readonly (readonly [number, number])[], m: Material, n: Vec3 = sphere(0, -0.2, 1)): void {
  c.part();
  for (const [x, y] of pts) if (c.filled(Math.floor(x), Math.floor(y))) c.px(x, y, m, n);
}

/**
 * A tail as a chain of short capsules through `pts`, thinning from r0 to r1.
 * `mat(i, n)` picks each segment's material, so the tiger's can be banded
 * with a black tip and the monkey's plain fur.
 */
function tailChain(c: PixelCanvas, pts: [number, number][], r0: number, r1: number, mat: (i: number, n: number) => Material, bias = 0): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1);
    c.part();
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0 + (r1 - r0) * k, r0 + (r1 - r0) * Math.min(1, k + 1 / n), mat(i, n), { bias });
  }
}

/** Points along a quadratic curve from a through b (as a control) to c. */
function curve(a: [number, number], b: [number, number], e: [number, number], steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * b[0] + t * t * e[0], u * u * a[1] + 2 * u * t * b[1] + t * t * e[1]]);
  }
  return out;
}

/** The tiger's tail: orange ringed in black, the last of it black, swinging with his moves. */
function tigerTail(c: PixelCanvas, root: [number, number], bend: [number, number], tip: [number, number], bias = 0): void {
  const t = LK.tiger!;
  tailChain(c, curve(root, bend, tip, 8), 0.8, 0.5, (i, n) => (i === n - 1 || i % 3 === 2 ? t.stripe : LK.gi), bias);
}

/** The Monkey King's tail: golden fur, coiling up into a curl at its end. */
function monkeyTail(c: PixelCanvas, pts: [number, number][], bias = 0): void {
  tailChain(c, pts, 0.85, 0.6, () => LK.wukong!.fur, bias);
}

/**
 * One of the Monkey King's pheasant plumes: a long feather rising from the
 * circlet and arcing away, barred light and dark along its length, its tip pale.
 */
function plume(c: PixelCanvas, a: [number, number], b: [number, number], e: [number, number]): void {
  const w = LK.wukong!;
  const pts = curve(a, b, e, 14);
  c.part();
  let last = '';
  pts.forEach(([x, y], i) => {
    const key = `${Math.floor(x)},${Math.floor(y)}`;
    if (key === last) return;
    last = key;
    const tip = i > pts.length - 3;
    // Barred every few pixels, the way a pheasant's tail is.
    const bar = !tip && i % 4 === 3;
    c.px(x, y, bar ? w.bar : w.plume, sphere(0, -0.6, 1), { bias: tip ? 2 : i < 3 ? -1 : 0 });
  });
}

/** The staff, red lacquer between two golden bands, slung or held from (x0, y0) to (x1, y1). */
function staff(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, bias = 0): void {
  const w = LK.wukong!;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const cap = 2 / len;
  c.part();
  c.capsule(x0, y0, x1, y1, 0.8, 0.8, w.staff, { bias });
  c.part();
  c.capsule(x0, y0, x0 + (x1 - x0) * cap, y0 + (y1 - y0) * cap, 0.95, 0.95, w.circlet, { bias });
  c.capsule(x1, y1, x1 - (x1 - x0) * cap, y1 - (y1 - y0) * cap, 0.95, 0.95, w.circlet, { bias });
}

/** Chain mail: a fine grid of shadowed links over the gold, so it glitters rather than reading as plate. */
function mail(c: PixelCanvas, top: number, bottom: number, x0: number, x1: number): void {
  for (let y = top + 1; y <= bottom; y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (c.materialAt(x, y) === LK.gi && (x + y * 2) % 3 === 0) c.shade(x, y, -1);
    }
  }
}

/** A fur mantle over a shoulder: a rounded tuft, ragged along its lower edge. */
function furShoulder(c: PixelCanvas, x: number, y: number, rx = 2.4): void {
  const m = LK.wukong!.fur;
  c.part();
  c.ellipse(x, y - 0.2, rx, 1.9, m, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.35, 0.95) });
  c.part();
  for (let i = -1; i <= 1; i++) c.px(x + i * 1.4 - 0.5, y + 1.9, m, sphere(i * 0.4, 0.2, 1), { bias: (i + 3) % 2 ? -1 : 0 });
}

/**
 * The tiger hood from the front: a tiger's head pulled over his own, its
 * upper jaw across his brow with a fang either side, his face looking out
 * from its mouth, round ears on top and stripes across its forehead.
 */
function tigerHoodFront(c: PixelCanvas, cx: number, U: number): void {
  const t = LK.tiger!;
  c.part();
  const widths = [2.8, 3.7, 4.0, 4.1];
  c.shape(7 + U, 10 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], LK.gi, (_x, _y, tt, u) => sphere(tt * 0.9, u * 1.1 - 0.9, 1));
  // The cheeks of the hood coming down the sides of his face, a white ruff at their foot.
  c.part();
  for (let y = 11; y <= 13; y++) {
    const m = y === 13 ? t.fur : LK.gi;
    c.px(8, y + U, m, cyl(-0.8, 0));
    c.px(15, y + U, m, cyl(0.8, 0));
  }
  // Ears: orange, pink inside.
  c.part();
  for (const [x, y, m] of [[8, 6, LK.gi], [9, 5, LK.gi], [9, 6, t.ear], [15, 6, LK.gi], [14, 5, LK.gi], [14, 6, t.ear]] as const) {
    c.px(x, y + U, m, sphere(x < 12 ? -0.4 : 0.4, -0.7), { bias: m === t.ear ? 0 : 1 });
  }
  // The upper lip, white across his brow, and the fangs hanging from it.
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3.0, cx + 3.0], t.fur, (_x, _y, tt) => cyl(tt * 0.9, 0.3));
  c.px(9, 11 + U, t.fang, sphere(-0.3, 0.2));
  c.px(14, 11 + U, t.fang, sphere(0.3, 0.2));
  // Its stripes: one down the middle of the brow and a pair sweeping in from each temple.
  stripe(c, [[11, 7 + U], [12, 7 + U], [11, 8 + U], [8, 8 + U], [9, 9 + U], [15, 8 + U], [14, 9 + U]], t.stripe);
}

/** The tiger hood from behind: the back of its head striped down to a white ruff, the ears up. */
function tigerHoodBack(c: PixelCanvas, cx: number, U: number): void {
  const t = LK.tiger!;
  c.part();
  c.ellipse(cx, 11.4 + U, 3.7, 3.6, LK.gi, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.part();
  for (const [x, y] of [[8, 7], [9, 6], [15, 7], [14, 6]] as const) c.px(x, y + U, LK.gi, sphere(x < 12 ? -0.4 : 0.4, -0.7), { bias: 1 });
  // Chevrons of stripes down the back of the head.
  stripe(c, [[11, 8 + U], [12, 8 + U], [9, 9 + U], [10, 10 + U], [14, 9 + U], [13, 10 + U], [8, 12 + U], [9, 12 + U], [15, 12 + U], [14, 12 + U], [11, 11 + U], [12, 11 + U]], t.stripe);
  c.part();
  c.shape(14 + U, 14 + U, () => [cx - 2.4, cx + 2.4], t.fur, (_x, _y, tt) => cyl(tt * 0.9, 0.3), { bias: -1 });
}

/** The tiger hood in profile, facing left: the jaw over his brow with its fang, an ear up behind, stripes. */
function tigerHoodSide(c: PixelCanvas, hx: number, U: number): void {
  const t = LK.tiger!;
  c.part();
  const rows: [number, number][] = [
    [-2.6, 2.4],
    [-3.6, 3.0],
    [-4.0, 3.3],
    [-4.4, 3.4],
    [-0.2, 3.4],
    [0.2, 3.2],
    [0.6, 2.8],
    [1.0, 2.4],
  ];
  c.shape(7 + U, 14 + U, (y) => [hx + rows[y - 7 - U][0], hx + rows[y - 7 - U][1]], LK.gi, (_x, _y, tt, u) => sphere(tt * 0.9, u * 1.3 - 0.8, 1));
  c.part();
  c.px(hx + 1, 6 + U, LK.gi, sphere(0.2, -0.8), { bias: 1 });
  c.px(hx + 2, 6 + U, LK.gi, sphere(0.5, -0.7));
  c.px(hx + 1, 5 + U, LK.gi, sphere(0.3, -0.9), { bias: 1 });
  c.px(hx, 6 + U, t.ear, sphere(-0.2, -0.6));
  // The lip along the brow, the fang at its front, the ruff at the nape.
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 4.4, hx - 0.6], t.fur, (_x, _y, tt) => sphere(tt * 0.7 - 0.3, 0.2, 1));
  c.px(hx - 4, 11 + U, t.fang, sphere(-0.4, 0.2));
  c.px(hx + 1, 14 + U, t.fur, sphere(0.3, 0.3), { bias: -1 });
  stripe(c, [[hx - 2, 7 + U], [hx - 1, 8 + U], [hx + 1, 8 + U], [hx + 2, 9 + U], [hx + 1, 11 + U], [hx + 2, 12 + U], [hx - 3, 9 + U]], t.stripe);
}

/** Tiger stripes across the front of the gi: chevrons sweeping in from each side, narrowing to the belt. */
function tigerChestFront(c: PixelCanvas, cx: number, top: number): void {
  const m = LK.tiger!.stripe;
  stripe(c, [[cx - 5, top + 1], [cx - 4, top + 2], [cx - 5, top + 4], [cx - 4, top + 4], [cx - 3, top + 5], [cx - 4, top + 6]], m, sphere(-0.6, -0.1, 1));
  stripe(c, [[cx + 4, top + 1], [cx + 3, top + 2], [cx + 4, top + 4], [cx + 3, top + 4], [cx + 2, top + 5], [cx + 3, top + 6]], m, sphere(0.6, -0.1, 1));
}

/** The stripes across the back of the gi, running from the sides towards the spine. */
function tigerChestBack(c: PixelCanvas, cx: number, top: number): void {
  const m = LK.tiger!.stripe;
  stripe(c, [[cx - 5, top + 1], [cx - 4, top + 2], [cx - 3, top + 2], [cx - 2, top + 3], [cx - 5, top + 4], [cx - 4, top + 5], [cx - 3, top + 5], [cx - 4, top + 6]], m, sphere(-0.6, -0.1, 1));
  stripe(c, [[cx + 4, top + 1], [cx + 3, top + 2], [cx + 2, top + 2], [cx + 1, top + 3], [cx + 4, top + 4], [cx + 3, top + 5], [cx + 2, top + 5], [cx + 3, top + 6]], m, sphere(0.6, -0.1, 1));
}

/**
 * The Monkey King's head from the front: a cap of golden fur with a tuft at
 * the crown, fur down his cheeks round a bare face, the golden circlet across
 * his brow, and the two long plumes rising from it.
 */
function wukongHeadFront(c: PixelCanvas, cx: number, U: number, sway: number): void {
  const w = LK.wukong!;
  c.part();
  const widths = [2.8, 3.7, 4.0];
  c.shape(7 + U, 9 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], w.fur, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
  c.part();
  for (const [x, y] of [[10, 6], [11, 5], [12, 6], [13, 6]] as const) c.px(x, y + U, w.fur, sphere((x - 11.5) * 0.3, -0.9), { bias: y === 5 ? 1 : 0 });
  // Fur framing the face, the ears showing through it.
  c.part();
  for (const y of [11, 13]) {
    c.px(8, y + U, w.fur, cyl(-0.8, 0));
    c.px(15, y + U, w.fur, cyl(0.8, 0));
  }
  c.px(8, 12 + U, LK.skin, cyl(-0.8, 0), { bias: 1 });
  c.px(15, 12 + U, LK.skin, cyl(0.8, 0));
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3.9, cx + 3.9], w.circlet, (_x, _y, t) => cyl(t, -0.2));
  c.part();
  c.px(11, 10 + U, w.circlet, sphere(-0.2, -0.6), { bias: 1 });
  c.px(12, 10 + U, w.circlet, sphere(0.2, -0.6), { bias: 1 });
  plume(c, [9.5, 8.5 + U], [7 + sway * 0.3, -0.5 + U], [2.5 - sway * 0.6, 3 + U]);
  plume(c, [14.5, 8.5 + U], [17 - sway * 0.3, -0.5 + U], [21.5 + sway * 0.6, 3 + U]);
}

/** The Monkey King from behind: a furred head, the circlet round it and the plumes rising over it. */
function wukongHeadBack(c: PixelCanvas, cx: number, U: number, sway: number): void {
  const w = LK.wukong!;
  c.part();
  c.ellipse(cx, 11.6 + U, 3.6, 3.5, w.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.shade(cx - 1, 9 + U, 1);
  c.part();
  for (const [x, y] of [[11, 7], [12, 7], [12, 6]] as const) c.px(x, y + U, w.fur, sphere(0, -0.9), { bias: 1 });
  c.part();
  c.px(8, 12 + U, LK.skin, cyl(-0.8, 0));
  c.px(16, 12 + U, LK.skin, cyl(0.8, 0));
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3.8, cx + 3.8], w.circlet, (_x, _y, t) => cyl(t, -0.2));
  plume(c, [9.5, 8.5 + U], [7 - sway * 0.3, -0.5 + U], [2.5 + sway * 0.6, 3 + U]);
  plume(c, [14.5, 8.5 + U], [17 + sway * 0.3, -0.5 + U], [21.5 - sway * 0.6, 3 + U]);
}

/** The Monkey King in profile, facing left: fur over the skull, a bare face, the circlet, both plumes streaming back. */
function wukongHeadSide(c: PixelCanvas, hx: number, U: number, sway: number, blink?: boolean): void {
  const w = LK.wukong!;
  c.part();
  const skull: [number, number][] = [
    [-3.0, 2.6],
    [-3.8, 3.1],
    [-4.0, 3.3],
    [-1.0, 3.2],
    [-0.4, 3.0],
    [0.2, 2.6],
  ];
  c.shape(8 + U, 13 + U, (y) => [hx + skull[y - 8 - U][0], hx + skull[y - 8 - U][1]], w.fur, (_x, _y, t, u) => sphere(t * 0.9, u * 1.3 - 0.8, 1));
  c.part();
  c.px(hx - 1, 7 + U, w.fur, sphere(-0.2, -0.9), { bias: 1 });
  c.px(hx, 7 + U, w.fur, sphere(0.2, -0.9));
  c.part();
  c.px(hx + 1, 12 + U, LK.skin, sphere(0.4, 0), { bias: 1 });
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 4.1, hx + 3.3], w.circlet, (_x, _y, t) => cyl(t * 0.9, -0.2));
  eyes(c, [[hx - 3, 12 + U]], blink);
  plume(c, [hx - 2, 9 + U], [hx - 1 + sway * 0.2, 2.5 + U], [hx + 7 + sway * 0.8, 2 + U]);
  plume(c, [hx - 1, 9 + U], [hx + 2 + sway * 0.2, 4 + U], [hx + 9.5 + sway, 5 + U]);
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.6;
/** How high the monk's raised foot comes off the ground in the crane stance. */
const KNEE_LIFT = 4;
const REACH_SIDE = 5.4;

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  // A punching shoulder rolls in behind the fist.
  const shA = { x: 7.3 + (p.a.f > 6 ? 0.8 : 0), y: 16.6 + U };
  const shB = { x: 16.7 - (p.b.f > 6 ? 0.8 : 0), y: 16.6 + U };
  const armA = () => arm(c, shA.x, shA.y, fa, REACH_FRONT, [-0.3, 1], p.chi, fa.behind ? -1 : 0);
  const armB = () => arm(c, shB.x, shB.y, fb, REACH_FRONT, [0.3, 1], p.chi, fb.behind ? -1 : 0);

  // Headband tails, knotted behind the head, flying out past it.
  if (!LK.monk && !LK.lucha && !LK.champ && !LK.tiger) {
    tail(c, 14.6, 10.2 + U, 17.4 + p.tails, 11.8 + U - p.tails * 0.4);
    tail(c, 14.6, 10.6 + U, 16.8 + p.tails * 0.6, 13.8 + U);
  }
  halo(c, cx, 11.4 + U, 5.8);
  // The tiger's tail swinging out from behind his hip.
  if (LK.tiger) tigerTail(c, [cx + 2, 23 + U], [cx + 8 + p.tails * 0.6, 26 + L], [cx + 9 + p.tails, 20.5 + U - p.tails * 0.4], -1);
  if (LK.wukong) {
    // The staff slung across his back, its ends showing past a shoulder and a hip, and the tail curling up beside him.
    staff(c, cx - 8.2, 10.5 + U, cx + 8.2, 27 + U, -1);
    const s = p.tails * 0.4;
    monkeyTail(c, [[cx + 2, 23 + U], [cx + 6, 25 + L], [cx + 8.4 + s, 23 + L], [cx + 9 + s, 20 + U], [cx + 8 + s, 18.2 + U], [cx + 6.8 + s, 18.8 + U], [cx + 7.2 + s, 20 + U]], -1);
  }
  if (LK.lucha) capeFront(c, cx, 15 + U, 26 + L, p.tails);
  if (fa.behind) armA();
  if (fb.behind) armB();

  // Legs in a wide stance.
  leg(c, 10, 23.5 + L, 9.2, 28.2 - p.footA);
  foot(c, 9, 29.6 - p.footA);
  if (p.knee) raisedLeg(c, 14, 23.5 + L, p.knee);
  else {
    leg(c, 14, 23.5 + L, 14.8, 28.2 - p.footB);
    foot(c, 15, 29.6 - p.footB);
  }
  c.part();
  c.shape(22 + U, 24 + L, () => [cx - 4.2, cx + 4.2], LK.trouser, (_x, _y, t) => cyl(t, 0.1));

  // The gi: broad through the chest, a V of skin at the neck, the flap crossing down to the belt.
  const top = 15 + U;
  const waist = 22 + U;
  const torso = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.9 - 1.1 * u * u;
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(top, waist - 1, torso, LK.gi, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(top, top + (LK.champ ? 1 : 3), (y) => {
    const hw = 2.1 - (y - top) * 0.6;
    return hw < 0.4 ? null : [cx - hw, cx + hw];
  }, LK.skin, (_x, _y, t, u) => sphere(t * 0.7, u * 0.5 - 0.2, 1));
  if (LK.wukong) {
    // Gold mail to the throat, and the red sash across it from shoulder to hip.
    c.part();
    c.shape(top, top + 1, () => [cx - 1.6, cx + 1.6], LK.gi, (_x, _y, t) => sphere(t * 0.7, -0.4, 1));
    mail(c, top, waist - 1, cx - 5, cx + 5);
    sash(c, top, waist - 1, 15.4, 8.8, 1.15, torso);
  } else if (LK.monk) {
    // The sash from his left shoulder down across to the right hip, the beads over it.
    sash(c, top, waist - 1, 15.4, 8.8, 1.15, torso);
    beads(c, [[9, top], [9, top + 1], [10, top + 2], [11, top + 3], [12, top + 3], [13, top + 2], [14, top + 1], [14, top]], [12, top + 4]);
    // A seam of fire showing through the stone at his collar.
    if (LK.guardian) c.px(cx - 1, top + 1, LK.guardian.vein, FLAT, { glow: 0.8 });
  } else if (LK.lucha) {
    muscles(c, cx, top, waist);
  } else if (LK.champ) {
    champFront(c, cx, top, waist, U, p.blink);
    if (!fa.behind) armA();
    if (!fb.behind) armB();
    return;
  } else if (LK.tiger) {
    tigerChestFront(c, cx, top);
  } else {
    for (let y = top + 3; y < waist; y++) c.shade(Math.round(cx - 0.5 + (y - top - 3) * 0.45), y, -1);
  }
  if (LK.lucha) {
    titleBelt(c, cx - 4.2, cx + 4.2, waist, cx);
    deltoid(c, 7.1, 16.8 + U);
    deltoid(c, 16.9, 16.8 + U);
    // The cape's cord round his neck, clasped in gold at the collarbones.
    c.part();
    c.px(9, top, LK.lucha.trim, sphere(-0.3, -0.5), { bias: 1 });
    c.px(14, top, LK.lucha.trim, sphere(0.3, -0.5));
    maskFront(c, cx, U, p.blink);
    if (!fa.behind) armA();
    if (!fb.behind) armB();
    return;
  }
  // The jacket's skirt below the belt, split at the front.
  c.part();
  c.shape(waist + 1, waist + 2, () => [cx - 4.4, cx + 4.4], LK.gi, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
  c.shade(cx, waist + 1, -1);
  c.shade(cx, waist + 2, -1);
  // Black belt, knotted at the front, its ends hanging.
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(cx - 1, waist, LK.belt, sphere(-0.3, -0.3), { bias: 1 });
  c.px(cx, waist, LK.belt, sphere(0.2, -0.3), { bias: 1 });
  c.part();
  c.capsule(cx - 1, waist + 1, cx - 1.6 + p.tails * 0.25, waist + 3.2, 0.55, 0.5, LK.belt);
  c.capsule(cx + 0.4, waist + 1, cx + 0.9 + p.tails * 0.25, waist + 3.6, 0.55, 0.5, LK.belt);

  deltoid(c, 7.1, 16.8 + U);
  deltoid(c, 16.9, 16.8 + U, 2.1, LK.monk ? LK.sash : LK.skin);
  if (LK.wukong) {
    furShoulder(c, 7.1, 16.6 + U);
    furShoulder(c, 16.9, 16.6 + U);
  }

  // Head: a square jaw, spiky hair, the headband across the brow.
  c.part();
  c.ellipse(cx, 12.4 + U, 3.2, 2.95, LK.skin);
  c.part();
  c.px(11, 13 + U, LK.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 13 + U, LK.skin, sphere(0.35, -0.2));
  c.shade(11, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  if (LK.wukong) {
    wukongHeadFront(c, cx, U, p.tails);
  } else if (LK.tiger) {
    tigerHoodFront(c, cx, U);
  } else if (LK.monk) {
    // A shaved dome catching the light, and ears.
    c.part();
    const dome = [2.7, 3.5];
    c.shape(8 + U, 9 + U, (y) => [cx - dome[y - 8 - U], cx + dome[y - 8 - U]], LK.skin, (_x, _y, t, u) => sphere(t * 0.9, u * 0.8 - 0.9, 1));
    c.shade(cx - 2, 9 + U, 1);
    c.part();
    c.px(8, 12 + U, LK.skin, cyl(-0.8, 0));
    c.px(15, 12 + U, LK.skin, cyl(0.8, 0));
    if (LK.guardian) {
      // A crack of fire running down the crown to the brow.
      const v = LK.guardian.vein;
      c.px(13, 8 + U, v, FLAT, { glow: 0.7 });
      c.px(13, 9 + U, v, FLAT, { glow: 0.8 });
      c.px(12, 10 + U, v, FLAT, { glow: 0.7 });
    }
  } else {
    c.part();
    const widths = [2.8, 3.7, 4.0];
    c.shape(7 + U, 9 + U, (y) => [cx - widths[y - 7 - U], cx + widths[y - 7 - U]], LK.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.2 - 0.9, 1));
    spikes(c, [9, 11, 12, 14], [10, 13], 7 + U);
    c.part();
    c.shape(10 + U, 10 + U, () => [cx - 3.6, cx + 3.6], LK.band, (_x, _y, t) => cyl(t, 0.2));
    c.part();
    c.px(8, 11 + U, LK.hair, cyl(-0.8, 0));
    c.px(15, 11 + U, LK.hair, cyl(0.8, 0));
  }
  eyes(c, [[10, 12 + U], [13, 12 + U]], p.blink);

  if (!fa.behind) armA();
  if (!fb.behind) armB();
  if (p.pop) pops(c, (fa.x + fb.x) / 2, (fa.y + fb.y) / 2, p.pop);
}

/**
 * A knee drawn up towards us, seen from the front: the thigh foreshortened
 * to a round knee just under the hip, the shin hanging from it and the foot
 * lifted clear of the ground, toes down.
 */
function raisedLeg(c: PixelCanvas, hx: number, hy: number, k: number): void {
  const kx = hx + 0.7;
  const ky = hy + 2.6 - 1.4 * k;
  const fx = hx + 0.9;
  const fy = 29.6 - KNEE_LIFT * k;
  c.part();
  c.capsule(kx, ky + 1, fx, fy - 1, 1.55, 1.35, LK.trouser);
  c.part();
  c.ellipse(fx, fy, 1.4, 1.2, LK.feet, { flatten: 0.8 });
  c.part();
  c.capsule(hx, hy, kx, ky, 1.8, 1.9 + 0.2 * k, LK.trouser, { bias: 1 });
}

/** Knuckles cracking: a few white ticks of light jumping off the joined fists. */
function pops(c: PixelCanvas, x: number, y: number, seed: number): void {
  const core = LK.chi[0];
  for (let i = 0; i < 3; i++) {
    const a = seed * 1.7 + i * 2.1;
    const r = 2.6 + (i % 2) * 0.6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.8 - 0.5;
    c.spark(px, py, core, 1);
    c.spark(px + Math.cos(a), py + Math.sin(a) * 0.8, core, 0.7);
    c.spark(px + Math.cos(a) * 2, py + Math.sin(a) * 1.6, LK.chi[1], 0.35);
  }
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const shA = { x: 7.3 + (p.a.f > 6 ? 0.6 : 0), y: 16.6 + U };
  const shB = { x: 16.7 - (p.b.f > 6 ? 0.6 : 0), y: 16.6 + U };
  // Fists thrown ahead are beyond the body, so they go behind it.
  const armA = () => arm(c, shA.x, shA.y, fa, REACH_FRONT, [-0.5, 0.8], p.chi, fa.behind ? -1 : 0);
  const armB = () => arm(c, shB.x, shB.y, fb, REACH_FRONT, [0.5, 0.8], p.chi, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) armB();

  leg(c, 10, 23.5 + L, 9.2, 28.2 - p.footB);
  leg(c, 14, 23.5 + L, 14.8, 28.2 - p.footA);
  foot(c, 9, 29.6 - p.footB);
  foot(c, 15, 29.6 - p.footA);
  c.part();
  c.shape(22 + U, 24 + L, () => [cx - 4.2, cx + 4.2], LK.trouser, (_x, _y, t) => cyl(t, 0.1));

  // The gi from behind, a crease down the spine.
  const top = 15 + U;
  const waist = 22 + U;
  const torso = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (waist - top);
    const hw = 4.9 - 1.1 * u * u;
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(top, waist - 1, torso, LK.gi, (_x, _y, t, u) => sphere(t * 0.9, (u - 0.35) * 1.1, 1));
  for (let y = top + 2; y < waist; y++) c.shade(cx, y, -1);
  if (LK.wukong) mail(c, top, waist - 1, cx - 5, cx + 5);
  if (LK.tiger) tigerChestBack(c, cx, top);
  // The sash across his back, from the left shoulder (screen left from behind) down to the right hip.
  if (LK.monk) sash(c, top, waist - 1, 8.6, 15.2, 1.15, torso);
  if (LK.champ) {
    champBack(c, cx, top, waist, U);
    if (!fa.behind) armA();
    if (!fb.behind) armB();
    return;
  }
  c.part();
  c.shape(waist + 1, waist + 2, () => [cx - 4.4, cx + 4.4], LK.gi, (_x, _y, t) => cyl(t, -0.1), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [cx - 4.2, cx + 4.2], LK.belt, (_x, _y, t) => cyl(t, 0));

  deltoid(c, 7.1, 16.8 + U, 2.1, LK.monk ? LK.sash : LK.skin);
  deltoid(c, 16.9, 16.8 + U);
  if (LK.lucha) capeBack(c, cx, top, 26 + L, -p.tails);
  if (LK.tiger) tigerTail(c, [cx, 23 + U], [cx - 4 - p.tails * 0.4, 27 + L], [cx - 7.5 - p.tails, 23 + U + p.tails * 0.3]);
  if (LK.wukong) {
    // From behind: the tail curling up from the small of his back, the staff across it over the sash, fur on both shoulders.
    const s = -p.tails * 0.4;
    monkeyTail(c, [[cx, 23 + U], [cx - 3, 26 + L], [cx - 6.4 + s, 25 + L], [cx - 7.6 + s, 22 + U], [cx - 7 + s, 19.6 + U], [cx - 5.6 + s, 19.8 + U], [cx - 5.6 + s, 21 + U]]);
    staff(c, cx + 8.2, 10.5 + U, cx - 8.2, 27 + U);
    furShoulder(c, 7.1, 16.6 + U);
    furShoulder(c, 16.9, 16.6 + U);
  }
  if (!fa.behind) armA();
  if (!fb.behind) armB();

  if (LK.lucha) {
    maskBack(c, cx, U);
    return;
  }
  if (LK.wukong) {
    wukongHeadBack(c, cx, U, p.tails);
    return;
  }
  if (LK.tiger) {
    tigerHoodBack(c, cx, U);
    return;
  }
  if (LK.monk) {
    // The shaved back of the head, and the beads round the neck below it.
    beads(c, [[9, top], [10, top], [11, top], [13, top], [14, top], [15, top]]);
    c.part();
    c.ellipse(cx, 11.6 + U, 3.5, 3.4, LK.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
    c.shade(cx - 1, 9 + U, 1);
    c.part();
    c.px(8, 12 + U, LK.skin, cyl(-0.8, 0));
    c.px(16, 12 + U, LK.skin, cyl(0.8, 0));
    if (LK.guardian) {
      // Fire through a crack down the back of the skull, and the ring hovering behind it.
      const v = LK.guardian.vein;
      c.px(11, 10 + U, v, FLAT, { glow: 0.7 });
      c.px(10, 11 + U, v, FLAT, { glow: 0.8 });
      c.px(10, 12 + U, v, FLAT, { glow: 0.6 });
      halo(c, cx, 11.4 + U, 5.8);
    }
    return;
  }

  // The back of the head, the headband round it, knotted with its tails hanging.
  c.part();
  c.ellipse(cx, 11.2 + U, 3.9, 3.8, LK.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.95, dy * 0.9 - 0.2, 1) });
  c.shade(cx - 1, 8 + U, 1);
  spikes(c, [9, 11, 13, 15], [10, 14], 8 + U);
  c.part();
  c.shape(10 + U, 10 + U, () => [cx - 3.9, cx + 3.9], LK.band, (_x, _y, t) => cyl(t, 0.2));
  c.part();
  c.px(cx, 10 + U, LK.band, sphere(0, -0.5), { bias: 1 });
  c.part();
  // The tails fly out beside the head rather than down its back, where they'd read as a face.
  c.capsule(cx - 3.6, 10.4 + U, cx - 5.2 - p.tails * 0.6, 11.6 + U + p.tails * 0.3, 0.55, 0.45, LK.band);
  c.capsule(cx + 3.6, 10.6 + U, cx + 5.0 + p.tails * 0.4, 12.2 + U, 0.55, 0.45, LK.band);
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean; // upper body centre
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  halo(c, hx + 4.4, 11.4 + U, 5.8, true);
  if (LK.lucha) capeSide(c, hx, 15 + U, 26 + L, p.tails);
  // The tiger's tail streaming out behind; the monkey's curling up behind his back, the staff slung across it.
  if (LK.tiger) tigerTail(c, [hx + 2.5, 22.5 + U], [hx + 7 + p.tails * 0.6, 25 + L], [hx + 9.5 + p.tails, 20.5 + U - p.tails * 0.5], -1);
  if (LK.wukong) {
    const s = p.tails * 0.5;
    staff(c, hx + 7.5, 10 + U, hx - 0.5, 28.5 + U, -1);
    monkeyTail(c, [[hx + 2.5, 22.5 + U], [hx + 6 + s, 24 + L], [hx + 8 + s, 21.5 + U], [hx + 7.6 + s, 18.6 + U], [hx + 6 + s, 18.4 + U], [hx + 5.8 + s, 19.8 + U]], -1);
  }
  // Far arm, behind everything.
  arm(c, hx + 1.4, 16.6 + U, fb, REACH_SIDE, [0.3, 1], p.chi, -1);

  // Headband tails streaming back.
  if (!LK.monk && !LK.lucha && !LK.champ && !LK.tiger) {
    tail(c, hx + 3, 10.2 + U, hx + 6.6 + p.tails, 10.8 + U + (p.tails > 1 ? 0 : 1));
    tail(c, hx + 3, 10.6 + U, hx + 5.8 + p.tails * 0.8, 13 + U);
  }

  // Legs: back leg in shade first, then the front leg.
  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 1, 23.5 + L, cx + 1.3 - p.footB, 28.3 - lift(p.footB), -1);
  foot(c, cx + 0.6 - p.footB, 29.7 - lift(p.footB), true, -1);
  leg(c, cx - 0.3, 23.5 + L, cx - p.footA, 28.3 - lift(p.footA));
  foot(c, cx - 0.9 - p.footA, 29.7 - lift(p.footA), true);
  c.part();
  c.shape(22 + U, 24 + L, () => [cx - 2.8, cx + 3.0], LK.trouser, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.1));

  // The gi in profile, the chest pushing forward, skin at the collar.
  const top = 15 + U;
  const waist = 22 + U;
  c.part();
  c.shape(top, waist - 1, (y) => [hx - 3.0 - (y >= top + 1 && y <= top + 3 ? 0.5 : 0), hx + 2.8], LK.gi, (_x, _y, t, u) => sphere(t * 0.9 - 0.1, (u - 0.35) * 1.1, 1));
  c.part();
  c.shape(top, top + 1, (y) => [hx - 3.0, hx - 1.2 - (y - top)], LK.skin, (_x, _y, t) => sphere(t * 0.6 - 0.4, -0.2, 1));
  if (LK.wukong) {
    c.part();
    c.shape(top, top + 1, (y) => [hx - 3.0, hx - 1.2 - (y - top)], LK.gi, (_x, _y, t) => sphere(t * 0.6 - 0.4, -0.2, 1));
    mail(c, top, waist - 1, hx - 4, hx + 3);
  }
  if (LK.tiger) stripe(c, [[hx + 2, top + 1], [hx + 1, top + 2], [hx + 2, top + 4], [hx + 1, top + 5], [hx, top + 5], [hx - 3, top + 3], [hx - 2, top + 4]], LK.tiger.stripe);
  if (LK.monk) {
    // The sash runs from the near shoulder back to the far hip; the beads hang at the collar.
    sash(c, top, waist - 1, hx + 0.2, hx + 1.8, 1.1, (y) => [hx - 3.0 - (y >= top + 1 && y <= top + 3 ? 0.5 : 0), hx + 2.8]);
    if (!LK.wukong) beads(c, [[hx - 1, top], [hx - 2, top + 1], [hx - 3, top + 2], [hx - 3, top + 3]], [hx - 3, top + 4]);
  }
  if (LK.champ) {
    champSide(c, hx, top, waist, U, p.blink);
    deltoid(c, hx + 0.2, 17 + U, 1.9, LK.gi);
    arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
    return;
  }
  if (LK.lucha) {
    // A chest thrown out, the line of the pec under it, and the title belt's plate at the front.
    for (let x = Math.round(hx - 3); x <= Math.round(hx - 1); x++) c.shade(x, top + 3, -1);
    c.shade(Math.round(hx - 2), top + 5, -1);
    titleBelt(c, hx - 3.2, hx + 3.0, waist, hx - 2.2);
    maskSide(c, hx, U, p.tails, p.blink);
    deltoid(c, hx + 0.2, 17 + U, 1.9);
    arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
    return;
  }
  c.part();
  c.shape(waist + 1, waist + 2, () => [hx - 3.2, hx + 3.0], LK.gi, (_x, _y, t) => cyl(t * 0.9 - 0.1, -0.1), { bias: -1 });
  c.part();
  c.shape(waist, waist, () => [hx - 3.2, hx + 3.0], LK.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(hx - 3.2), waist, LK.belt, sphere(-0.4, -0.3), { bias: 1 });
  c.capsule(hx - 3.3, waist + 1, hx - 3.8 + p.tails * 0.4, waist + 3.4, 0.55, 0.5, LK.belt);

  // Head in profile.
  c.part();
  c.ellipse(hx - 1.1, 12.6 + U, 2.9, 2.8, LK.skin);
  c.part();
  c.px(hx - 5, 13 + U, LK.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(hx - 4, 14 + U, -1);
  if (LK.wukong) {
    wukongHeadSide(c, hx, U, p.tails, p.blink);
    deltoid(c, hx + 0.2, 17 + U, 1.9, LK.gi);
    furShoulder(c, hx + 0.2, 16.8 + U, 2.2);
    arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
    return;
  }
  if (LK.monk) {
    // A shaved crown and the back of the skull, an ear, heavy brows.
    c.part();
    const skull: [number, number][] = [
      [-3.0, 2.6],
      [-3.8, 3.1],
      [-4.0, 3.3],
      [0.0, 3.2],
      [0.4, 3.0],
      [0.8, 2.4],
    ];
    c.shape(8 + U, 13 + U, (y) => [hx + skull[y - 8 - U][0], hx + skull[y - 8 - U][1]], LK.skin, (_x, _y, t, u) => sphere(t * 0.9, u * 1.3 - 0.8, 1));
    c.shade(Math.round(hx - 1), 9 + U, 1);
    c.part();
    c.px(hx + 1, 12 + U, LK.skin, sphere(0.4, 0), { bias: 1 });
    c.shade(hx + 1, 13 + U, -1);
    if (LK.guardian) {
      const v = LK.guardian.vein;
      c.px(hx - 1, 8 + U, v, FLAT, { glow: 0.7 });
      c.px(hx, 9 + U, v, FLAT, { glow: 0.8 });
      c.px(hx + 2, 15 + U, v, FLAT, { glow: 0.6 });
    }
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    deltoid(c, hx + 0.2, 17 + U, 1.9, LK.sash);
    arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
    return;
  }
  c.part();
  const rows: [number, number][] = [
    [-2.6, 2.4],
    [-3.6, 3.0],
    [-4.1, 3.3],
    [0, 0],
    [0.0, 3.2],
    [0.4, 3.0],
    [0.8, 2.4],
  ];
  if (LK.tiger) {
    tigerHoodSide(c, hx, U);
    eyes(c, [[hx - 3, 12 + U]], p.blink);
    deltoid(c, hx + 0.2, 17 + U, 1.9);
    arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
    return;
  }
  c.shape(7 + U, 13 + U, (y) => {
    const [l, r] = rows[y - 7 - U];
    return l === r ? null : [hx + l, hx + r];
  }, LK.hair, (_x, _y, t, u) => sphere(t * 0.9, u * 1.4 - 0.9, 1));
  spikes(c, [Math.round(hx - 2), Math.round(hx), Math.round(hx + 2)], [Math.round(hx + 1), Math.round(hx + 3)], 7 + U);
  c.px(hx + 3.5, 7 + U, LK.hair, sphere(0.4, -0.6));
  c.part();
  c.shape(10 + U, 10 + U, () => [hx - 4.1, hx + 3.3], LK.band, (_x, _y, t) => cyl(t * 0.9, 0.2));
  c.part();
  c.ellipse(hx + 3.2, 10.5 + U, 1.1, 1.0, LK.band);
  eyes(c, [[hx - 3, 12 + U]], p.blink);

  // Near shoulder and arm.
  deltoid(c, hx + 0.2, 17 + U, 1.9);
  arm(c, hx + 0.2, 17 + U, fa, REACH_SIDE, [0.3, 1], p.chi);
}

// ---------------------------------------------------------------------------
// Animations

type Guard = [Fist, Fist];
const BRAWL_GUARD: Guard = [GUARD_A, GUARD_B];
/** The monk's stance: the lead palm open and low in front, the other upright at his chest. */
const MONK_GUARD: Guard = [F(4, 2.0, 0.6), F(0.8, 1.2, 2.6)];

const base = (view: View, guard: Guard = BRAWL_GUARD): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...guard[0] },
  b: { ...guard[1] },
  tails: 0,
  chi: 0,
});

/** Bouncing on his toes, guard up. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.lift = Math.sin(ph) > 0.2 ? 1 : 0;
    const bob = Math.sin(ph + 0.9) * 0.6;
    p.a.h += bob;
    p.b.h += bob * 0.7;
    p.a.f += Math.sin(ph) * 0.4;
    p.tails = Math.sin(ph - 1) * 0.8;
    p.blink = f === 4;
    frames.push(p);
  }
  return frames;
}

const walk = (view: View): Pose[] => walkIn(view, BRAWL_GUARD);

function walkIn(view: View, guard: Guard): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view, guard);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    p.tails = 1 + Math.cos(ph * 2) * 0.6;
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.lean = 1;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
    }
    // The guard shuffles with his steps.
    p.a.f += s * 0.6;
    p.b.f -= s * 0.6;
    p.a.h += p.lift * 0.5;
    p.b.h += p.lift * 0.5;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a?: Fist;
  b?: Fist;
  lean?: number;
  breath?: number;
  lift?: number;
  step?: number;
  chi?: number;
  /** Both feet drawn up off the ground (the monk's leap). */
  tuck?: number;
}

/** A blow as keyframes; anything left out stays at the guard. `step` plants the front foot forward. */
function blow(keys: Key[], guard: Guard = BRAWL_GUARD) {
  return (view: View): Pose[] =>
    keys.map((k, i) => {
      const p = base(view, guard);
      if (k.a) p.a = { ...k.a };
      if (k.b) p.b = { ...k.b };
      p.breath = k.breath ?? 0;
      p.lift = k.lift ?? 0;
      p.chi = k.chi ?? 0;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
      } else {
        p.footA = step > 0 ? 1 : 0;
      }
      if (k.tuck) {
        p.footA = view === 'side' ? 1 + k.tuck : k.tuck;
        p.footB = view === 'side' ? k.tuck - 1 : k.tuck;
      }
      // The tails whip back as he throws his weight.
      p.tails = 0.4 + Math.max(0, k.lean ?? 0) * 0.5 + (i % 2) * 0.4;
      return p;
    });
}

const jab = blow([
  { a: F(0.6, 3.2, 1.2) },
  { a: F(9, 1.2, 1.6), b: F(1.0, 3.3, 2.4), lean: 1, step: 1 },
  { a: F(8.4, 1.3, 1.5), b: F(1.0, 3.3, 2.4), lean: 1, step: 1 },
  { a: F(3.5, 2.8, 1.2), step: 1 },
]);

const cross = blow([
  { b: F(0.2, 3.6, 1.8), a: F(2.6, 2.8, 1.2) },
  { b: F(10, 0.6, 1.8), a: F(0.8, 3.4, 1.8), lean: 2, step: 2 },
  { b: F(9.4, 0.8, 1.7), a: F(0.8, 3.4, 1.8), lean: 2, step: 2 },
  { b: F(4, 2.6, 1.8), lean: 1, step: 1 },
]);

const hook = blow([
  { a: F(1.5, 6.5, 1.2), lean: -1 },
  { a: F(7.5, 2.5, 1.6), lean: 1, step: 1 },
  { a: F(5.5, -2.5, 1.6), b: F(1.2, 3.4, 2.4), lean: 1, step: 1 },
  { a: F(2.5, 1.5, 1.2), step: 1 },
]);

const upper = blow([
  { b: F(1.5, 2.5, -3.5), breath: 2 },
  { b: F(5, 1, 5), lift: 1, lean: 1, step: 1 },
  { b: F(4, 1, 8.5), lift: 1, lean: 1, step: 1 },
  { b: F(2.5, 2.8, 2.5), step: 1 },
]);

/** The finisher: wound all the way back, then an explosive straight with his whole body behind it. */
const smash = blow([
  { a: F(-2, 4, 1.5), b: F(3, 2, 2), lean: -1, breath: 1, chi: 0.5 },
  { a: F(-3, 4.5, 1.8), b: F(3, 2, 2), lean: -1, breath: 1, chi: 0.8 },
  { a: F(12, 0.5, 1.6), b: F(0.6, 3.4, 2), lean: 3, step: 2, chi: 1 },
  { a: F(11.5, 0.6, 1.6), b: F(0.6, 3.4, 2), lean: 3, step: 2, chi: 0.6 },
  { a: F(4, 2.6, 1.2), lean: 1, step: 1, chi: 0.2 },
]);

/** The special: fists hammering out in turn, a blur of straight punches. */
function barrage(view: View): Pose[] {
  const keys: [Fist, Fist][] = [
    [F(10, 1.5, 1.6), F(1.5, 3.2, 2)],
    [F(3, 2.8, 1.2), F(10, 0.5, 2.6)],
    [F(10, 0.4, 2.8), F(2, 3.2, 1.6)],
    [F(2, 3.0, 1.4), F(10, 1.8, 1.0)],
  ];
  return blow(keys.map(([a, b]) => ({ a, b, lean: 1, step: 2, chi: 0.8 })))(view).map((p, i) => {
    p.breath = i % 2;
    p.tails = 1.2 + (i % 2) * 0.5;
    return p;
  });
}

// ---------------------------------------------------------------------------
// The iron monk's moves

/** Standing still and rooted, breathing slowly. */
function monkIdle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view, MONK_GUARD);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.a.h += Math.sin(ph + 0.6) * 0.4;
    p.b.f += Math.sin(ph) * 0.3;
    p.blink = f === 3;
    frames.push(p);
  }
  return frames;
}

const monkWalk = (view: View): Pose[] => walkIn(view, MONK_GUARD);

/** Lead palm: a short, heavy heel-of-the-hand strike. */
const palm = blow(
  [
    { a: F(1.5, 2.6, 1.2), breath: 1 },
    { a: F(9.5, 0.8, 1.8), b: F(0.6, 1.2, 2.6), lean: 1, step: 1, chi: 0.5 },
    { a: F(9, 0.9, 1.7), lean: 1, step: 1, chi: 0.3 },
    { a: F(5, 1.8, 1), step: 1 },
  ],
  MONK_GUARD,
);

/** Rear palm, the hips turning behind it. */
const palm2 = blow(
  [
    { b: F(-0.5, 3.2, 2), a: F(3, 2.2, 0.8), lean: -1 },
    { b: F(10, 0.4, 2.2), a: F(0.6, 2.8, 1.4), lean: 2, step: 2, chi: 0.5 },
    { b: F(9.4, 0.5, 2.1), a: F(0.6, 2.8, 1.4), lean: 2, step: 2, chi: 0.3 },
    { b: F(3, 1.5, 2.2), lean: 1, step: 1 },
  ],
  MONK_GUARD,
);

/** The finisher: both hands drawn in to the chest, then driven out together in a wall of force. */
const thrust = blow(
  [
    { a: F(-1, 3.2, 1.2), b: F(-1, 3.2, 2.2), breath: 1, lean: -1, chi: 0.6 },
    { a: F(-1.5, 3.4, 1.2), b: F(-1.5, 3.4, 2.2), breath: 2, lean: -1, chi: 0.9 },
    { a: F(11, 1.8, 1.2), b: F(11, 1.8, 2.6), lean: 3, step: 2, chi: 1 },
    { a: F(10.5, 1.9, 1.2), b: F(10.5, 1.9, 2.6), lean: 3, step: 2, chi: 0.7 },
    { a: F(4, 2, 1), b: F(2, 1.5, 2.2), lean: 1, step: 1, chi: 0.2 },
  ],
  MONK_GUARD,
);

/**
 * The special: he crouches, springs up with his palms joined overhead, and
 * comes down driving both of them into the earth. Fighter.ts carries him
 * through the air between the spring and the landing.
 */
const leap = blow(
  [
    { a: F(0, 4, -2.5), b: F(0, 4, -2.5), breath: 2, chi: 0.3 },
    { a: F(1, 2.6, 10), b: F(1, 2.6, 10), lift: 1, tuck: 1, chi: 0.5 },
    { a: F(0.5, 1.6, 13), b: F(0.5, 1.6, 13), lift: 2, tuck: 2, chi: 0.8 },
    { a: F(0.5, 1.6, 13), b: F(0.5, 1.6, 13), lift: 2, tuck: 2, chi: 1 },
    { a: F(4, 1.4, 4), b: F(4, 1.4, 4), lift: 1, tuck: 1, chi: 1 },
    { a: F(6, 2.4, -5), b: F(6, 2.4, -5), breath: 3, lean: 2, step: 1, chi: 1 },
    { a: F(5, 2.4, -4), b: F(5, 2.4, -4), breath: 2, lean: 1, step: 1, chi: 0.6 },
    { a: F(3, 2.2, 0), breath: 1, chi: 0.2 },
  ],
  MONK_GUARD,
);

// ---------------------------------------------------------------------------
// The idle moments (`rest`): a little performance when he's left standing, drawn facing the viewer only.

/**
 * The brawler shadowboxes: bounces on his toes, snaps out a jab, another,
 * then a cross with his weight behind it, laces his fists together and
 * pushes them out to crack his knuckles, shakes his arms loose and bounces
 * back into his guard.
 */
function shadowbox(view: View): Pose[] {
  if (view !== 'down') return [];
  const at = (o: Partial<Pose>): Pose => ({ ...base('down'), ...o });
  return [
    idle('down')[0],
    // 1-2: up on the toes, and landing.
    at({ lift: 1, tails: 0.8 }),
    at({ breath: 1, tails: -0.4, a: F(2.2, 3.0, 0.6), b: F(1.4, 3.3, 1.8) }),
    // 3-5: jab, back, jab, out at an opponent only he can see on his lead side.
    at({ lift: 1, a: F(2.5, 8.2, 3.4), tails: 1 }),
    at({ a: F(2.6, 4.2, 1.6), tails: 0.3 }),
    at({ a: F(2.5, 8.4, 3.6), b: F(1.2, 3.3, 2.4), tails: 1.1 }),
    // 6: the cross thrown the other way, dipping into it.
    at({ breath: 1, b: F(2.5, 8.4, 3.2), a: F(1, 3.2, 2.2), tails: 1.4 }),
    // 7: back to the guard off a bounce.
    at({ lift: 1, b: F(3, 2.8, 2.2), tails: 0.9 }),
    // 8: fists laced together before his chest.
    at({ a: F(2.4, 0.7, 1.6), b: F(2.4, 0.7, 1.9), tails: 0.2 }),
    // 9-10: pushed out, the knuckles cracking.
    at({ breath: 1, a: F(6.4, 0.9, 3.4), b: F(6.4, 0.9, 3.7), pop: 1 }),
    at({ breath: 1, a: F(6.7, 0.9, 3.5), b: F(6.7, 0.9, 3.8), pop: 2, blink: true }),
    // 11: the arms dropped loose, shaken out.
    at({ a: F(1.2, 4.4, -2.5), b: F(1.2, 4.4, -2.2), tails: -0.6 }),
  ];
}

const SHADOWBOX_ORDER = [0, 1, 2, 1, 2, 3, 4, 5, 4, 6, 6, 7, 2, 8, 8, 9, 10, 9, 10, 11, 11, 1, 2, 0] as const;

/**
 * The iron monk's tai-chi: he sinks, floats both hands up before him and
 * presses them down, then shifts his weight and rises into the golden
 * rooster, one palm raised high and one knee drawn up, eyes closed and qi
 * gathering; holds it, and settles back into his stance.
 */
function taichi(view: View): Pose[] {
  if (view !== 'down') return [];
  const at = (o: Partial<Pose>): Pose => ({ ...base('down', MONK_GUARD), ...o });
  return [
    monkIdle('down')[0],
    // 1: sinking, the hands opening low before the belly.
    at({ breath: 1, a: F(1.5, 3, -2.5), b: F(1.5, 3, -2.5) }),
    // 2-3: both hands floating up to the shoulders.
    at({ a: F(2.5, 3.2, 2), b: F(2.5, 3.2, 2), chi: 0.15 }),
    at({ a: F(3, 3.4, 5), b: F(3, 3.4, 5), chi: 0.25 }),
    // 4: pressed slowly down again, the knees sinking.
    at({ breath: 1, a: F(3, 3.2, -1), b: F(3, 3.2, -1), chi: 0.2 }),
    // 5: the weight shifts, one palm rising, the foot peeling off the ground.
    at({ knee: 0.35, a: F(0.8, 4, -2.5), b: F(1.5, 2.2, 5), chi: 0.3 }),
    // 6-7: the golden rooster: palm high, knee up, balanced, qi burning.
    at({ knee: 1, a: F(0.8, 4.6, -3.5), b: F(0.5, 3.4, 11), chi: 0.5, blink: true }),
    at({ knee: 1, breath: 1, a: F(0.8, 4.7, -3.2), b: F(0.5, 3.5, 10.7), chi: 0.75, blink: true }),
    // 8: coming down, the palm lowering.
    at({ knee: 0.4, a: F(1.5, 3.6, -1.5), b: F(2, 3, 5), chi: 0.3 }),
    // 9: both hands pressed down as he breathes out.
    at({ breath: 1, a: F(2, 3, -1.5), b: F(2, 3, -1.5), chi: 0.1 }),
    // 10: back up into the stance.
    at({ a: F(3.2, 2.4, 0), b: F(1.2, 1.6, 1.8) }),
  ];
}

const TAICHI_ORDER = [0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 7, 7, 6, 7, 7, 6, 8, 9, 9, 10, 0] as const;

/** Screen angle (0 = right, 90 = down) he faces in each direction. */
export const FACING_DEG: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

// ---------------------------------------------------------------------------
// Frame generation

export type FighterAnim = 'idle' | 'walk' | 'jab' | 'cross' | 'hook' | 'upper' | 'smash' | 'barrage' | 'palm' | 'palm2' | 'thrust' | 'leap' | 'rest';

export interface FighterAnimDef {
  name: FighterAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  /** Frame indices to play in sequence, when some are held or repeated. */
  order?: readonly number[];
}

export const FIGHTER_ANIMS: FighterAnimDef[] = [
  { name: 'idle', fps: 8, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'jab', fps: 24, loop: false, poses: jab },
  { name: 'cross', fps: 22, loop: false, poses: cross },
  { name: 'hook', fps: 22, loop: false, poses: hook },
  { name: 'upper', fps: 20, loop: false, poses: upper },
  { name: 'smash', fps: 16, loop: false, poses: smash },
  { name: 'barrage', fps: 24, loop: true, poses: barrage },
  { name: 'rest', fps: 9, loop: false, poses: shadowbox, order: SHADOWBOX_ORDER },
];

export const MONK_ANIMS: FighterAnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: monkIdle },
  { name: 'walk', fps: 9, loop: true, poses: monkWalk },
  { name: 'palm', fps: 16, loop: false, poses: palm },
  { name: 'palm2', fps: 16, loop: false, poses: palm2 },
  { name: 'thrust', fps: 13, loop: false, poses: thrust },
  { name: 'leap', fps: 12, loop: false, poses: leap },
  { name: 'rest', fps: 6, loop: false, poses: taichi, order: TAICHI_ORDER },
];

/** Frame index at which each blow lands (the leap: where he meets the ground). */
export const HIT_FRAME: Partial<Record<FighterAnim, number>> = { jab: 1, cross: 1, hook: 1, upper: 1, smash: 2, palm: 1, palm2: 1, thrust: 2, leap: 5 };
/** The leap's frames in the air: from the spring (frame 1) to the landing. */
export const LEAP_AIR = { from: 1, to: 5, fps: 12 } as const;

/** The brawler: gi, black belt, red gloves and headband. */
export const BRAWLER_LOOK: FighterLook = {
  key: 'fighter',
  gi: GI,
  trouser: GI_TROUSER,
  belt: BLACK_BELT,
  band: HEADBAND,
  glove: GLOVE,
  wrap: WRAP,
  feet: WRAP,
  hair: FIGHTER_HAIR,
  chi: [CHI_CORE, CHI_HOT, CHI_MID],
  hand: 1.9,
  anims: FIGHTER_ANIMS,
  skin: SKIN,
  eye: EYE,
  sash: MONK_SASH,
  bead: PRAYER_BEAD,
};

/** The iron monk: saffron robe and crimson sash, bronze bracers, bare palms of golden qi. */
export const MONK_LOOK: FighterLook = {
  key: 'fighter_monk',
  monk: true,
  gi: MONK_ROBE,
  trouser: MONK_TROUSER,
  belt: MONK_SASH,
  band: MONK_SASH,
  glove: SKIN,
  wrap: BRONZE,
  feet: MONK_WRAP,
  hair: MONK_BROW,
  chi: [QI_CORE, QI_HOT, QI_MID],
  hand: 1.7,
  anims: MONK_ANIMS,
  skin: SKIN,
  eye: EYE,
  sash: MONK_SASH,
  bead: PRAYER_BEAD,
};

const ramp = (...c: string[]): RGB[] => c.map(hex);

// The luchador's colours: a royal blue mask and tights, a crimson cape, gold for his crest, belt and bands.
const LUCHA_MASK: Material = { ramp: ramp('#0c1248', '#18267e', '#2a44bc', '#4a74ec', '#9cc0ff'), outline: hex('#060820'), outlineLit: hex('#141c50'), shine: true };
const LUCHA_TIGHTS: Material = { ramp: ramp('#0a0c30', '#141c5a', '#22348e', '#3a58c0'), outline: hex('#06081c') };
const LUCHA_TRIM: Material = { ramp: ramp('#4e2c06', '#8e5a12', '#d09a28', '#ffd458', '#fff6c0'), outline: hex('#241404'), shine: true };
const LUCHA_WHITE: Material = { ramp: ramp('#5e5e7c', '#a2a2c0', '#e0e0ee', '#ffffff'), outline: hex('#181828'), outlineLit: hex('#2c2c44') };
const LUCHA_CAPE: Material = { ramp: ramp('#34041a', '#6a0c28', '#a8163e', '#dc2e5c', '#ff7aa0'), outline: hex('#180410'), outlineLit: hex('#2e0a1c'), shine: true };
const LUCHA_BOOT: Material = { ramp: ramp('#34041a', '#6a0c28', '#a8163e', '#dc2e5c', '#ff9ab8'), outline: hex('#180410'), shine: true };
const LUCHA_RUBY: Material = { ramp: ramp('#5a0414', '#b0102c', '#ff3050', '#ffb0c0'), outline: hex('#240208'), emissive: 0.55, shine: true };

// The stone guardian's: basalt skin, a moss-dark robe and an ember sash, a sandstone ring, and fire in the cracks.
const BASALT: Material = { ramp: ramp('#14121a', '#26222e', '#3e3848', '#5e5668', '#8c8296'), outline: hex('#060509'), outlineLit: hex('#18141e') };
const BASALT_BROW: Material = { ramp: ramp('#0a080e', '#16121c', '#241e2c', '#342c3e'), outline: hex('#040306') };
const MOSS_ROBE: Material = { ramp: ramp('#10200f', '#1e381c', '#305430', '#4c7444', '#7ea062'), outline: hex('#060d06'), outlineLit: hex('#122012') };
const MOSS_TROUSER: Material = { ramp: ramp('#121410', '#1e221a', '#2e3426', '#444c36'), outline: hex('#070806') };
const EMBER_SASH: Material = { ramp: ramp('#360e04', '#68200c', '#a23810', '#d8601c', '#ffa050'), outline: hex('#180602'), outlineLit: hex('#2e0e06') };
const SANDSTONE: Material = { ramp: ramp('#34281e', '#56463a', '#80705a', '#ac9a7e', '#d8c8a8'), outline: hex('#120c08'), outlineLit: hex('#2a2018') };
const MAGMA: Material = { ramp: ramp('#8a1a06', '#d8400c', '#ff7a1a', '#ffc050', '#fff0b0'), outline: hex('#3a0a02'), emissive: 0.9, noAO: true };

/** Luchador, the brawler's skin: a masked showman of the ring with a crimson cape and a gold title belt. */
export const LUCHA_LOOK: FighterLook = {
  ...BRAWLER_LOOK,
  key: 'fighter_lucha',
  gi: SKIN,
  trouser: LUCHA_TIGHTS,
  belt: LUCHA_TRIM,
  band: LUCHA_CAPE,
  glove: LUCHA_WHITE,
  wrap: LUCHA_TRIM,
  feet: LUCHA_BOOT,
  hair: LUCHA_MASK,
  chi: [hex('#fff4fa'), hex('#ffd35c'), hex('#ff4fa0')],
  lucha: { mask: LUCHA_MASK, trim: LUCHA_TRIM, white: LUCHA_WHITE, cape: LUCHA_CAPE, jewel: LUCHA_RUBY },
};

/** Stone guardian, the iron monk's skin: a temple statue woken to fight, fire in its cracks and a carved ring at its back. */
export const GUARDIAN_LOOK: FighterLook = {
  ...MONK_LOOK,
  key: 'fighter_guardian',
  gi: MOSS_ROBE,
  trouser: MOSS_TROUSER,
  belt: EMBER_SASH,
  band: EMBER_SASH,
  glove: BASALT,
  wrap: SANDSTONE,
  feet: BASALT,
  hair: BASALT_BROW,
  chi: [hex('#fff4d0'), hex('#ffc050'), hex('#ff6a1a')],
  skin: BASALT,
  eye: MAGMA,
  sash: EMBER_SASH,
  bead: SANDSTONE,
  guardian: { ring: SANDSTONE, vein: MAGMA },
};

// The champ's colours: a lime-green tee and cap, an orange print, faded jorts, silver tags, white sneakers.
const CHAMP_TEE: Material = { ramp: ramp('#0c3410', '#186418', '#2ea02a', '#5ada3e', '#b0ff86'), outline: hex('#061a08'), outlineLit: hex('#0e2c10') };
const CHAMP_CAP: Material = { ramp: ramp('#0c3410', '#186418', '#2ea02a', '#5ada3e', '#b0ff86'), outline: hex('#061a08'), outlineLit: hex('#0e2c10'), shine: true };
const CHAMP_PRINT: Material = { ramp: ramp('#5a1e04', '#a8400a', '#f07a1a', '#ffb050', '#ffe0a0'), outline: hex('#260c02') };
const CHAMP_INK: Material = { ramp: ramp('#06100a', '#122014', '#20321e'), outline: hex('#040806') };
const JORTS: Material = { ramp: ramp('#101c34', '#1e3258', '#34507e', '#5474a4', '#8aa6cc'), outline: hex('#080e1c'), outlineLit: hex('#141e36') };
const JORTS_FRAY: Material = { ramp: ramp('#5474a4', '#8aa6cc', '#c0d2ea', '#eef4fc'), outline: hex('#141e36') };
const SNEAKER: Material = { ramp: ramp('#5e6270', '#a4a8b8', '#e2e6ee', '#ffffff'), outline: hex('#161822'), outlineLit: hex('#2a2c38') };
const DOG_TAG: Material = { ramp: ramp('#3a3e48', '#7a808e', '#c0c6d2', '#f4f8ff'), outline: hex('#14161c'), shine: true };
const BUZZ_CUT: Material = { ramp: ramp('#241810', '#3a2818', '#543c26', '#705234'), outline: hex('#0e0806') };

/** Champ, the brawler's skin: a ring hero in merch green, jorts and a cap, who never gives up. */
export const CHAMP_LOOK: FighterLook = {
  ...BRAWLER_LOOK,
  key: 'fighter_champ',
  gi: CHAMP_TEE,
  trouser: JORTS,
  belt: JORTS,
  band: CHAMP_TEE,
  glove: SKIN,
  wrap: CHAMP_TEE,
  feet: SNEAKER,
  hair: BUZZ_CUT,
  chi: [hex('#f4ffe8'), hex('#9cff5a'), hex('#ff8a2a')],
  champ: { print: CHAMP_PRINT, ink: CHAMP_INK, cap: CHAMP_CAP, fray: JORTS_FRAY, chain: DOG_TAG },
};

// Tigerclaw's colours: a tiger-orange gi and hood, black stripes and trousers, white fur, wraps and fangs, dark claw gloves.
const TIGER_ORANGE: Material = { ramp: ramp('#40140a', '#82300c', '#c85a12', '#f48a26', '#ffc26a'), outline: hex('#1c0804'), outlineLit: hex('#3a1408') };
const TIGER_STRIPE: Material = { ramp: ramp('#060408', '#100c12', '#1c161e', '#2c2430'), outline: hex('#040306') };
const TIGER_PANTS: Material = { ramp: ramp('#0a080c', '#16121a', '#241e2a', '#383040', '#56485e'), outline: hex('#050406'), outlineLit: hex('#120e16') };
const TIGER_WHITE: Material = { ramp: ramp('#686270', '#aea6b4', '#e8e2ea', '#ffffff'), outline: hex('#16141c'), outlineLit: hex('#2c2834') };
const TIGER_EAR: Material = { ramp: ramp('#7a3040', '#c0606e', '#f0a0aa', '#ffd8dc'), outline: hex('#2a0c12') };
const TIGER_GLOVE: Material = { ramp: ramp('#120a08', '#24160e', '#3e2818', '#5e3e24', '#8a6040'), outline: hex('#080404'), shine: true };
const TIGER_CLAW: Material = { ramp: ramp('#8a7c62', '#cabc98', '#f4ecd2', '#ffffff'), outline: hex('#1a140c'), shine: true };

/** Tigerclaw, the brawler's skin: a kung-fu tiger in a striped orange gi and a tiger's-head hood, claws on his fists. */
export const TIGER_LOOK: FighterLook = {
  ...BRAWLER_LOOK,
  key: 'fighter_tiger',
  gi: TIGER_ORANGE,
  trouser: TIGER_PANTS,
  belt: TIGER_WHITE,
  band: TIGER_ORANGE,
  glove: TIGER_GLOVE,
  wrap: TIGER_WHITE,
  feet: TIGER_WHITE,
  hair: TIGER_STRIPE,
  chi: [hex('#fff6e8'), hex('#ffb040'), hex('#ff6a10')],
  tiger: { stripe: TIGER_STRIPE, fur: TIGER_WHITE, fang: TIGER_CLAW, ear: TIGER_EAR, claw: TIGER_CLAW },
};

// The Monkey King's colours: gold mail and circlet, golden-brown fur, a red sash and lacquered staff, pheasant plumes, black boots.
const WUKONG_MAIL: Material = { ramp: ramp('#3a2206', '#74480e', '#b88220', '#eab840', '#fff0a8'), outline: hex('#1a0e02'), outlineLit: hex('#3a2408'), shine: true };
const WUKONG_GOLD: Material = { ramp: ramp('#4a2c06', '#90600e', '#d8a428', '#ffd860', '#fffad0'), outline: hex('#201202'), shine: true, emissive: 0.15 };
const WUKONG_FUR: Material = { ramp: ramp('#3a2210', '#6a4220', '#a06c34', '#cc9a52', '#ecc88a'), outline: hex('#180c04'), outlineLit: hex('#30200e') };
const WUKONG_SASH: Material = { ramp: ramp('#3e0608', '#7a0e12', '#c01c1c', '#ec4430', '#ff9a78'), outline: hex('#1a0204'), outlineLit: hex('#300608') };
const WUKONG_TROUSER: Material = { ramp: ramp('#200406', '#40080c', '#661214', '#902420'), outline: hex('#0e0204') };
const WUKONG_BOOT: Material = { ramp: ramp('#08070a', '#141218', '#221e28', '#38323e'), outline: hex('#040306') };
const WUKONG_STAFF: Material = { ramp: ramp('#3a0406', '#760a10', '#b8161a', '#ea3a2c', '#ffa080'), outline: hex('#180204'), shine: true };
const WUKONG_PLUME: Material = { ramp: ramp('#3e1806', '#7a3410', '#b85e1e', '#e8943e', '#fff0c8'), outline: hex('#1a0a04') };
const WUKONG_BAR: Material = { ramp: ramp('#140806', '#24120c', '#3a2014', '#54321e'), outline: hex('#0a0402') };
const WUKONG_FACE: Material = { ramp: ramp('#6a3a30', '#b06a50', '#e8a682', '#fcd4b4'), outline: hex('#2a1410'), outlineLit: hex('#4a2620') };

/** The Monkey King, the iron monk's skin: Sun Wukong in gold mail and a red sash, plumed circlet, staff on his back and a curling tail. */
export const WUKONG_LOOK: FighterLook = {
  ...MONK_LOOK,
  key: 'fighter_wukong',
  gi: WUKONG_MAIL,
  trouser: WUKONG_TROUSER,
  belt: WUKONG_SASH,
  band: WUKONG_SASH,
  glove: WUKONG_FACE,
  wrap: WUKONG_GOLD,
  feet: WUKONG_BOOT,
  hair: WUKONG_BAR,
  chi: [hex('#fffbe0'), hex('#ffd84a'), hex('#ff9a1a')],
  skin: WUKONG_FACE,
  sash: WUKONG_SASH,
  bead: WUKONG_GOLD,
  wukong: { fur: WUKONG_FUR, circlet: WUKONG_GOLD, plume: WUKONG_PLUME, bar: WUKONG_BAR, staff: WUKONG_STAFF },
};

export const FIGHTER_LOOKS = [BRAWLER_LOOK, MONK_LOOK, LUCHA_LOOK, GUARDIAN_LOOK, CHAMP_LOOK, TIGER_LOOK, WUKONG_LOOK];

export interface FighterFrame {
  key: string; // e.g. "walk_left_3"
  anim: FighterAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFighterFrame(look: FighterLook, dir: Dir, pose: Pose): PixelCanvas {
  LK = look;
  const c = new PixelCanvas(FIGHTER_W, FIGHTER_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildFighterFrames(look: FighterLook = BRAWLER_LOOK): FighterFrame[] {
  const out: FighterFrame[] = [];
  for (const a of look.anims) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawFighterFrame(look, dir, pose) });
      });
    }
  }
  return out;
}
