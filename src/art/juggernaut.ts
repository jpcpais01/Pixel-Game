// The Juggernaut: a hulking steam-powered brawler. A riveted iron boiler for
// a body, banded in brass, with a furnace grate in its chest whose coals
// flicker through the bars; a small domed head sunk between its shoulders, a
// slit visor glowing; a smokestack at its back; stubby legs in heavy boots;
// and two huge piston gauntlets, each fist driven out on a steel rod. A
// pressure gauge sits over the furnace (it taps it, idly).
//
// The Tin Man skin is built on the same rig but is its own figure: bright
// tin plate with seams and rivets, a funnel hat whose spout does the puffing,
// a kind painted face with rosy cheeks, a heart-shaped furnace window glowing
// rose, stovepipe limbs ringed at the joints, a belt, and an oil can at his
// hip.
//
// Three views like every hero: down, up, and the side view drawn facing left
// and mirrored for right. Frames are JUGG_W x JUGG_H with the feet on GROUND
// at the centre; the body itself keeps to about the usual 24x32 box, the
// gauntlets and the steam spilling past it.

import { FLAT, PixelCanvas, cyl, hex, sphere, type DrawOpts, type Material, type RGB, type Vec3 } from './pixel';
import { DIRS, type Dir } from './wizard';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const JUGG_W = 56;
export const JUGG_H = 56;
const CX = 28;
const GROUND = 52;
export const JUGG_ORIGIN_X = CX;
export const JUGG_ORIGIN_Y = GROUND;
/** The chest (the furnace) above the feet: where its fists meet foes and its steam rises from. */
export const JUGG_CHEST_Y = 18;
/** The mouth of its stack (the Tin Man's funnel spout is higher), above the feet: where the smoke leaves. */
export const JUGG_STACK_Y = 36;
export const TIN_STACK_Y = 40;
/** Where the hip sits above the feet, standing. */
const HIP = 9;
/** The boiler's height, hip to top. */
const BODY = 19;

// ---------------------------------------------------------------------------
// Materials

/** Blackened, riveted boiler iron, warm where the fire's in it. */
const PLATE: Material = { ramp: ramp('#1a1412', '#33281f', '#544232', '#7a6450', '#a8907a'), outline: hex('#0a0605'), outlineLit: hex('#1a120c'), shine: true };
/** The darker iron of the limbs and the stack. */
const IRON: Material = { ramp: ramp('#100c0c', '#221c1a', '#3a302c', '#584a42', '#7c6a5e'), outline: hex('#060404'), shine: true };
const BRASS: Material = { ramp: ramp('#4a2c0c', '#8a5a1a', '#c8902e', '#f0c860', '#fff0b0'), outline: hex('#1e1004'), outlineLit: hex('#2e1a06'), shine: true };
const COPPER: Material = { ramp: ramp('#3a1406', '#702c10', '#b0582a', '#e08a52', '#ffc89a'), outline: hex('#160602'), shine: true };
const STEEL: Material = { ramp: ramp('#2a2e36', '#5a626e', '#9aa4b2', '#dce4ee', '#ffffff'), outline: hex('#0c0e12'), shine: true };
const JOINT: Material = { ramp: ramp('#0a0808', '#1a1614', '#2c2622'), outline: hex('#030202') };
/** The furnace's coals behind the grate, and its blaze with the door burst open. */
const FIRE: Material = { ramp: ramp('#8a1a06', '#e04a10', '#ff8a2a', '#ffc860', '#fff4c0'), outline: hex('#2a0802'), emissive: 1, noAO: true };
const EYE: Material = { ramp: ramp('#ff6a2a', '#ffb050', '#fff0c0'), outline: hex('#2a0802'), emissive: 1, noAO: true };
/** Red-hot iron: the plates in a meltdown. */
const HOT: Material = { ramp: ramp('#2e0a06', '#5a1608', '#9a3012', '#d8582a', '#ffa060'), outline: hex('#140302'), emissive: 0.3, shine: true };
const GAUGE: Material = { ramp: ramp('#a8a090', '#e6e0d0', '#fffaf0'), outline: hex('#1e1004'), noAO: true };
const INK: Material = { ramp: ramp('#0a0606', '#1a1210'), outline: hex('#000000'), noOutline: true, noAO: true };
const STEAM: Material = { ramp: ramp('#8a96a6', '#c0cad6', '#e6ecf2', '#ffffff'), outline: hex('#4a5462'), noAO: true, noOutline: true, emissive: 0.15 };
/** The little musical notes of its whistle. */
const NOTE: Material = { ramp: ramp('#ffb050', '#fff0c0'), outline: hex('#2a1004'), emissive: 0.8, noAO: true, noOutline: true };

// The Tin Man's.
const TIN: Material = { ramp: ramp('#262c34', '#4a545e', '#76828e', '#a8b4c0', '#d4dce6', '#f4f8fc'), outline: hex('#0e1216'), outlineLit: hex('#1a2026'), shine: true };
const TIN_DARK: Material = { ramp: ramp('#1c2026', '#363e48', '#58626e', '#7c8894'), outline: hex('#080a0e'), shine: true };
const HEART: Material = { ramp: ramp('#6a0820', '#c81e44', '#ff5a7a', '#ffa0b8', '#fff0f4'), outline: hex('#2a0410'), emissive: 1, noAO: true };
const BELT: Material = { ramp: ramp('#2a160c', '#4a2a16', '#6e4426', '#946038'), outline: hex('#140a04') };
const BLUSH: Material = { ramp: ramp('#e06a80', '#ff9ab0'), outline: hex('#2a0410'), noOutline: true, noAO: true };
const HEART_NOTE: Material = { ramp: ramp('#ff5a7a', '#ffc0d0'), outline: hex('#2a0410'), emissive: 0.8, noAO: true, noOutline: true };

export interface JuggLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  /** The Tin Man: tin plate, a funnel hat, a heart for a furnace. */
  tin: boolean;
  /** Body plate, limb iron, bands and rods (named for the gear sets' dressing). */
  plate: Material;
  iron: Material;
  band: Material;
  steel: Material;
  /** What burns in its chest, and its eyes. */
  fire: Material;
  eye: Material;
}

export const JUGG_LOOK: JuggLook = { key: 'jugg', tin: false, plate: PLATE, iron: IRON, band: BRASS, steel: STEEL, fire: FIRE, eye: EYE };
export const TINMAN_LOOK: JuggLook = { key: 'jugg_tinman', tin: true, plate: TIN, iron: TIN_DARK, band: TIN, steel: STEEL, fire: HEART, eye: INK };
export const JUGG_LOOKS = [JUGG_LOOK, TINMAN_LOOK];

/** The look being drawn; set by buildJuggFrames. */
let L: JuggLook = JUGG_LOOK;

type View = 'down' | 'up' | 'side';

export interface JuggPose {
  /** Raised (walking) or lowered (+crouch) at the hip; the whole body jolted sideways (a rattle). */
  bob: number;
  crouch: number;
  shake: number;
  /** Feet lifted off the ground, and in the side view stepped forward (-, toward its face) or back. */
  liftA: number;
  liftB: number;
  strideA: number;
  strideB: number;
  /** Each gauntlet: thrown out (1 full reach, past 1 overreaching, under 0 cocked back). */
  reachA: number;
  reachB: number;
  /** Each piston's steel rod run out between forearm and fist, px. */
  pistA: number;
  pistB: number;
  /** Each arm raised up and out, 0..1 (the Meltdown's pose). */
  raiseA: number;
  raiseB: number;
  /** Steam blasting out of a gauntlet's piston: 1 the burst, 2 blown away and thinning. */
  jetA: number;
  jetB: number;
  /** The side view's lean into a blow, px at the shoulders. */
  lean: number;
  /** The fists hung lower, px. */
  sag: number;
  /** The coals' flicker, a phase. */
  fire: number;
  /** The furnace: 0 banked low, 1 as always, 2 blazing. */
  blaze: number;
  /** The furnace door burst open, 0..1. */
  door: number;
  /** The plates glowing red-hot. */
  hot: boolean;
  /** Steam boiling off it (overheated), 0..1. */
  vent: number;
  /** Steam streaming out behind it as it charges: 1 or 2 (two frames of the jets). */
  exhaust: number;
  /** The idle moment: the stack's puff (a stage of PUFFS), the whistle (1 a hiss, 2 full song), its fist tapping the gauge 0..1, the gauge's needle 0..1, a happy squint, a glance aside (-1..1). */
  puff: number;
  whistle: number;
  tap: number;
  needle: number;
  happy: boolean;
  look: number;
}

const base = (): JuggPose => ({
  bob: 0, crouch: 0, shake: 0, liftA: 0, liftB: 0, strideA: 0, strideB: 0, reachA: 0, reachB: 0, pistA: 0, pistB: 0, raiseA: 0, raiseB: 0,
  jetA: 0, jetB: 0, lean: 0, sag: 0, fire: 0, blaze: 1, door: 0, hot: false, vent: 0, exhaust: 0, puff: 0, whistle: 0, tap: 0, needle: 0.3, happy: false, look: 0,
});

// ---------------------------------------------------------------------------
// Little helpers

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The plate it's made of now: red-hot in a meltdown. */
const plateOf = (p: JuggPose): Material => (p.hot && !L.tin ? HOT : L.plate);

/** A soft blob of steam (or smoke): solid at heart, dithering away as `solid` drops. */
function cloud(c: PixelCanvas, cx: number, cy: number, r: number, solid: number, m: Material = STEAM): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      if (solid < 1 && (d2 > 0.35 + solid || ((x + y) & 1 && d2 > solid * 0.6))) continue;
      c.px(x, y, m, sphere(nx, ny, 0.9), { bias: ny < -0.3 ? 1 : 0 });
    }
}

/** A heart, `s` 1 (5 wide) or 2 (7 wide), its top-left at (x, y). */
const HEARTS: Record<number, string[]> = {
  1: ['.1.1.', '11111', '.111.', '..1..'],
  2: ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'],
};

// ---------------------------------------------------------------------------
// Shared parts

/**
 * A gauntlet: an upper arm from the shoulder, the piston's housing (the
 * forearm), the steel rod run out `pist` px, and the fist on its end at F.
 * `size` scales the fist (nearer the viewer, bigger); `far` shades it back.
 */
function gauntlet(c: PixelCanvas, p: JuggPose, sx: number, sy: number, fx: number, fy: number, pist: number, jet: number, size: number, far: boolean, view: View): void {
  const tin = L.tin;
  let dx = fx - sx;
  let dy = fy - sy;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // Wrist and elbow back along the arm from the fist; the elbow bows outward.
  const fr = 4.1 * size;
  const wx = fx - dx * (fr * 0.7 + pist);
  const wy = fy - dy * (fr * 0.7 + pist);
  const fore = 6;
  const ex = wx - dx * fore;
  const ey = wy - dy * fore;
  const out = view === 'side' ? 0 : Math.sign(sx - CX) * 1.2;
  c.part();
  c.capsule(sx, sy, ex + out, ey, 2, 2.2, tin ? L.iron : JOINT);
  if (tin) for (let i = 1; i <= 2; i++) c.ellipse(lerp(sx, ex + out, i / 3), lerp(sy, ey, i / 3), 2.4, 1.2, L.plate, { flatten: 0.6 });
  c.part();
  // The housing: a fat cylinder banded at both ends.
  c.capsule(ex, ey, wx, wy, 3.2, 3.4, plateOf(p));
  c.part();
  for (const k of [0.15, 0.85]) {
    const bx = lerp(ex, wx, k);
    const by = lerp(ey, wy, k);
    // A thin ring round the housing, not a sleeve.
    c.capsule(bx - dy * 2.9, by + dx * 2.9, bx + dy * 2.9, by - dx * 2.9, 0.75, 0.75, tin ? L.iron : L.band);
  }
  // Steam pipe along its top (copper, or the tin's rings).
  if (!tin && view !== 'up') c.capsule(ex - dy * 2.2, ey + dx * 2.2 - 1, wx - dy * 2.2, wy + dx * 2.2 - 1, 0.7, 0.7, COPPER);
  // The rod.
  if (pist > 0.4) {
    c.part();
    c.capsule(wx, wy, wx + dx * (pist + 1), wy + dy * (pist + 1), 1.1, 1.1, L.steel);
  }
  // The fist: a heavy block with brass knuckle plates on the side it punches with.
  c.part();
  const fist = tin ? L.plate : plateOf(p);
  c.ellipse(fx, fy, fr * 1.08, fr, fist);
  c.part();
  const px = -dy;
  const py = dx;
  for (let k = -1; k <= 1; k++) {
    const kx = fx + dx * fr * 0.7 + px * k * 1.9 * size;
    const ky = fy + dy * fr * 0.7 + py * k * 1.9 * size;
    const n: Vec3 = { x: dx * 0.6 + px * k * 0.3, y: -dy * 0.6 - py * k * 0.3, z: 0.75 };
    c.ellipse(kx, ky, 1.15 * size, 1.15 * size, tin ? L.iron : L.band, { normal: () => n });
  }
  // Finger grooves.
  for (const k of [-0.5, 0.5]) c.shade(Math.round(fx + dx * fr * 0.2 + px * k * 1.9 * size), Math.round(fy + dy * fr * 0.2 + py * k * 1.9 * size), -1);
  if (tin) c.px(Math.round(fx - dx * fr * 0.4 - 1), Math.round(fy - dy * fr * 0.4 - 1), STEEL, { x: -0.5, y: 0.5, z: 0.7 }, { bias: 2 });
  if (far) for (let y = Math.floor(fy - fr - 1); y <= fy + fr + 1; y++) for (let x = Math.floor(fx - fr - 1); x <= fx + fr + 1; x++) c.shade(x, y, -1);
  if (jet > 0) pistonJet(c, ex, ey, dx, dy, jet);
}

/** Steam bursting out of a piston's housing as it fires: backward and to either side, then thinning. */
function pistonJet(c: PixelCanvas, x: number, y: number, dx: number, dy: number, stage: number): void {
  c.part();
  const white: RGB = [235, 240, 248];
  const px = -dy;
  const py = dx;
  for (const s of [-1, 1]) {
    const n = stage === 1 ? 5 : 7;
    for (let i = 1; i <= n; i++) {
      // Out to the side and back along the arm.
      const ax = x + px * s * (2 + i * 0.9) - dx * i * 0.8;
      const ay = y + py * s * (2 + i * 0.9) - dy * i * 0.8 - (stage === 2 ? i * 0.3 : 0);
      const w = i < 2 ? 0 : i < 4 ? 0.7 : 1.2;
      for (let d = -w; d <= w; d += 0.7) {
        if (stage === 2 && (i + Math.round(d)) % 2 === 0) continue;
        c.px(ax + dx * d, ay + dy * d, STEAM, sphere(0, d / 2, 1), { bias: d < 0 ? 1 : 0 });
      }
      c.spark(ax, ay, white, stage === 1 ? 0.3 : 0.12);
    }
  }
}

/**
 * The stages of the stack's puff: a gasp at the mouth, a column, a cloud
 * rolling off, then wisps thinning away. Offsets from the mouth: [dx, dy, radius, solid].
 */
const PUFFS: [number, number, number, number][][] = [
  [],
  [[0, -1, 1.2, 1]],
  [[0, -1, 1.5, 1], [0.6, -3.5, 2, 1]],
  [[0.4, -1.5, 1.3, 1], [1.4, -4, 2.3, 1], [3.6, -5, 2.4, 1]],
  [[2, -4, 1.8, 0.6], [4.6, -5.4, 2.6, 0.8], [7.6, -4.6, 1.8, 0.6]],
  [[5.5, -5.5, 2.2, 0.45], [9, -5, 2, 0.35]],
];

function puff(c: PixelCanvas, mx: number, my: number, stage: number): void {
  c.part();
  for (const [dx, dy, r, solid] of PUFFS[stage]) cloud(c, mx + dx, Math.max(r, my + dy), r, solid);
}

/** The whistle's song: a thin white jet straight up off the stack, and (in full voice) two notes bobbing off. */
function whistle(c: PixelCanvas, mx: number, my: number, stage: number): void {
  c.part();
  const white: RGB = [240, 246, 255];
  const h = stage === 1 ? 4 : 7;
  for (let i = 1; i <= h; i++) {
    c.px(mx, my - i, STEAM, FLAT, { bias: 1 });
    if (i > 2 && stage === 2) c.px(mx + ((i & 1) ? 1 : -1), my - i, STEAM, FLAT);
    c.spark(mx, my - i, white, 0.25);
  }
  if (stage < 2) return;
  // Two notes (or two hearts) bobbing away to the side.
  const m = L.tin ? HEART_NOTE : NOTE;
  if (L.tin) {
    heart(c, mx + 3, my - 9, 1, m);
    heart(c, mx - 8, my - 6, 1, m);
    return;
  }
  for (const [x, y] of [[mx + 3, my - 8], [mx - 7, my - 5]]) {
    c.px(x, y + 2, m, FLAT);
    c.px(x + 1, y + 2, m, FLAT);
    c.px(x, y + 3, m, FLAT);
    c.px(x + 1, y + 3, m, FLAT);
    for (let k = 0; k < 4; k++) c.px(x + 2, y - 1 + k, m, FLAT);
    c.px(x + 3, y - 1, m, FLAT);
  }
}

function heart(c: PixelCanvas, x: number, y: number, s: 1 | 2, m: Material): void {
  HEARTS[s].forEach((row, r) => [...row].forEach((b, k) => b === '1' && c.px(x + k, y + r, m, sphere(((k + 0.5) / row.length) * 2 - 1, (r / HEARTS[s].length) * 2 - 1, 1), { bias: r === 0 ? 1 : 0 })));
}

/** Steam boiling off an overheated (or venting) body. */
function boilOff(c: PixelCanvas, k: number, tb: number, hb: number, bx: number): void {
  const white: RGB = [230, 236, 244];
  const pts: [number, number][] = [[-10, 2], [10, 2], [-11, 8], [11, 8], [-6, -3], [6, -3], [0, hb - tb - 2]];
  pts.forEach(([dx, dy], i) => {
    const r = 1 + k * 1.5 + (i % 2);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) c.spark(bx + dx + x, tb + dy - k * 3 + y, white, 0.32 * k);
  });
}

/** The furnace's glow on the ground under it, and spit sparks: drawn as light. */
function embers(c: PixelCanvas, x: number, y: number, n: number, seed: number): void {
  const hot: RGB[] = [[255, 240, 190], [255, 170, 80], [255, 110, 40]];
  for (let i = 0; i < n; i++) c.spark(x + (hash(i, seed, 1) - 0.5) * 12, y - hash(i, seed, 2) * 8, hot[i % 3], 0.8);
}

// ---------------------------------------------------------------------------
// The front of the boiler: the furnace (a grate, or the Tin Man's heart window) and the gauge

/** The furnace: an arched iron grate over flickering coals, the door blown aside as `door` opens. */
function furnace(c: PixelCanvas, p: JuggPose, gx: number, gy: number): void {
  const blaze = p.blaze;
  const glowOf = (x: number, y: number, deep: number): DrawOpts => {
    // Hotter low in the firebox; a flicker that moves with the phase.
    const f = hash(x, y, p.fire) > 0.62 ? 1 : hash(x + 7, y, p.fire) < 0.18 ? -1 : 0;
    return { glow: blaze < 0.5 ? 0.45 : 1, bias: Math.round(deep - 2 + f + (blaze - 1) * 1.2) };
  };
  if (L.tin) {
    // A heart-shaped window of rose glass, framed in tin and riveted.
    const rows = HEARTS[2];
    const ox = gx - 3;
    const oy = gy - 3;
    c.part();
    for (let r = -1; r <= rows.length; r++)
      for (let k = -1; k <= 7; k++) {
        const on = (rr: number, kk: number) => rows[rr]?.[kk] === '1';
        if (on(r, k)) continue;
        if (on(r - 1, k) || on(r + 1, k) || on(r, k - 1) || on(r, k + 1)) c.px(ox + k, oy + r, TIN_DARK, sphere(k / 4 - 0.75, r / 3 - 1, 1));
      }
    c.part();
    const open = p.door;
    rows.forEach((row, r) =>
      [...row].forEach((b, k) => {
        if (b !== '1') return;
        const o = glowOf(ox + k, oy + r, r / 3);
        c.px(ox + k, oy + r, L.fire, { x: 0, y: 0.2, z: 1 }, { glow: o.glow, bias: Math.min(1, (o.bias ?? 0) + Math.round(open * 0.6)) });
      }),
    );
    // The glint on the glass, top left; gone when the window's blown.
    if (open < 0.5) c.px(ox + 1, oy + 1, STEEL, FLAT, { bias: 3 });
    if (open > 0) embers(c, gx, gy - 2, Math.round(6 * open), 3 + p.fire);
    return;
  }
  // The hood over the grate.
  c.part();
  c.shape(gy - 5, gy - 4, (y) => (y === gy - 5 ? [gx - 4, gx + 5] : [gx - 5, gx + 6]), IRON, (_x, _y, t) => cyl(t, 0.7));
  for (const dx of [-4, 5]) c.px(gx + dx, gy - 4, L.band, { x: 0, y: 0.6, z: 0.8 }, { bias: 1 });
  // The firebox: an arch, coals in it.
  const open = p.door;
  const hw = 4 + open * 1.5;
  c.part();
  c.shape(gy - 3, gy + 3, (y) => {
    const top = y === gy - 3 ? 1.5 : 0;
    return [gx - hw + top + 0.5, gx + hw - top + 0.5];
  }, L.fire, (x, y) => {
    void x;
    return { x: 0, y: (gy - y) * 0.1, z: 1 };
  });
  for (let y = gy - 3; y <= gy + 3; y++) for (let x = Math.floor(gx - hw); x <= gx + hw; x++) {
    if (c.materialAt(x, y) !== L.fire) continue;
    const o = glowOf(x, y, (y - gy + 3) / 3.5);
    c.px(x, y, L.fire, { x: 0, y: 0.1, z: 1 }, o);
  }
  // The bars (gone as the door bursts), and the door's two halves blown aside.
  c.part();
  if (open < 0.4) for (const dx of [-2, 0, 2]) for (let y = gy - 2; y <= gy + 3; y++) c.px(gx + dx, y, JOINT, { x: 0.3, y: 0, z: 0.9 });
  else {
    for (const s of [-1, 1]) {
      const x = gx + s * (hw + 1.5);
      c.shape(gy - 3, gy + 3, () => [x - 0.5, x + 1.5], IRON, (_x, _y, t) => cyl(t * s, 0.2));
      c.px(x, gy, L.band, FLAT, { bias: 1 });
    }
  }
  // The sill under it.
  c.part();
  c.shape(gy + 4, gy + 4, () => [gx - 5, gx + 6], IRON, (_x, _y, t) => cyl(t, -0.2));
  if (open > 0) embers(c, gx, gy - 4, Math.round(8 * open), 5 + p.fire);
}

/** The pressure gauge: a brass ring, a white face and a needle at `needle` (0 the left stop, 1 the right). */
function gauge(c: PixelCanvas, x: number, y: number, needle: number): void {
  c.part();
  c.ellipse(x, y, 2.6, 2.6, BRASS);
  c.part();
  c.ellipse(x, y, 1.6, 1.6, GAUGE);
  c.part();
  const a = Math.PI * (0.75 + 1.5 * needle) + Math.PI / 2;
  c.px(Math.floor(x), Math.floor(y), INK);
  c.px(Math.floor(x + Math.cos(a) * 1.3), Math.floor(y + Math.sin(a) * 1.3), INK);
  // The red line, top right.
  c.px(Math.floor(x + 1), Math.floor(y - 1.4), HEART, FLAT, { glow: 0 });
}

// ---------------------------------------------------------------------------
// The front view (facing the viewer, 'down') and the back ('up')

function drawFront(c: PixelCanvas, p: JuggPose, back: boolean): void {
  const tin = L.tin;
  const bx = CX + p.shake;
  const hb = GROUND - HIP - p.bob + p.crouch;
  const tb = hb - BODY;
  const plate = plateOf(p);
  const view: View = back ? 'up' : 'down';

  // Where each fist is: hanging at its side, thrown out (toward the viewer, or away), raised, or at the gauge.
  const fistAt = (s: number, reach: number, raise: number, tap: number): { x: number; y: number; size: number; behind: boolean } => {
    let x = bx + s * 13.5;
    let y = tb + 16 + p.sag;
    if (reach < 0) {
      // Cocked back: up and out.
      x += s * 1.5 * -reach;
      y -= 4 * -reach;
    } else if (reach > 0) {
      const to = back ? { x: bx + s * 5, y: tb - 3 } : { x: bx + s * 4.5, y: hb + 5 };
      x = lerp(x, to.x, Math.min(1.3, reach));
      y = lerp(y, to.y, Math.min(1.3, reach));
    }
    if (raise > 0) {
      x = lerp(x, bx + s * 17, raise);
      y = lerp(y, tb - 5, raise);
    }
    if (tap > 0 && s < 0) {
      x = lerp(x, bx - 7.5, tap);
      y = lerp(y, tb + 8.5, tap);
    }
    const r = Math.max(0, reach);
    return { x, y, size: back ? 1 - 0.12 * Math.min(1, r) : 1 + 0.18 * Math.min(1.2, r), behind: back && r > 0.35 };
  };
  const arms = [
    { s: -1, ...fistAt(-1, p.reachA, p.raiseA, p.tap), pist: p.pistA, jet: p.jetA },
    { s: 1, ...fistAt(1, p.reachB, p.raiseB, 0), pist: p.pistB, jet: p.jetB },
  ];
  const drawArm = (a: (typeof arms)[number]) => gauntlet(c, p, bx + a.s * 11, tb + 4, a.x, a.y, a.pist, a.jet, a.size, false, view);

  // The smokestack at its back, seen past its shoulder from the front.
  if (!back && !tin) stack(c, bx + 7, tb + 3, false);
  // Fists thrown away from the viewer go behind the body.
  if (back) for (const a of arms) if (a.behind) drawArm(a);

  // Legs.
  for (const s of [-1, 1]) {
    const lift = s < 0 ? p.liftA : p.liftB;
    leg(c, bx + s * 4.5, hb - 1, bx + s * 6, GROUND - lift, view);
  }

  // The boiler.
  c.part();
  c.shape(tb, hb, (y) => {
    const u = (y - tb) / (hb - tb);
    let hw = 8 + 1.6 * Math.sin(u * Math.PI);
    if (y === tb) hw -= 2;
    else if (y === tb + 1 || y === hb) hw -= 1;
    return [bx - hw + 0.5, bx + hw + 0.5];
  }, plate, (_x, y, t) => cyl(t * 0.85, 0.35 - ((y - tb) / BODY) * 0.55));
  // Its top, seen a little from above.
  c.ellipse(bx + 0.5, tb + 1, 6.6, 1.6, plate, { flatten: 0.35, normal: (_x, _y, dx) => ({ x: dx * 0.4, y: 0.8, z: 0.5 }) });
  // Bands round it, and rivets.
  c.part();
  for (const y of [tb + 3, hb - 3]) {
    const u = (y - tb) / (hb - tb);
    const hw = 8 + 1.6 * Math.sin(u * Math.PI);
    for (let x = Math.round(bx - hw + 0.5); x < bx + hw + 0.5; x++) {
      const t = ((x + 0.5 - bx - 0.5) / hw) * 0.95;
      c.px(x, y, tin ? L.iron : L.band, cyl(t, 0.3), { bias: (x - Math.round(bx)) % 3 === 0 ? 1 : 0 });
    }
  }
  // Seams down the front (the tin's are its soldered joins), riveted.
  for (const s of [-1, 1]) {
    const x = Math.round(bx + 0.5 + s * 6.5);
    for (let y = tb + 4; y <= hb - 4; y++) {
      c.shade(x, y, -1);
      if ((y - tb) % 3 === 2) c.shade(x + s, y, 1);
    }
  }
  if (tin) {
    // The tin's belt with its brass buckle, and the oil can hanging at its hip.
    c.part();
    for (let x = Math.round(bx - 9); x <= bx + 9; x++) for (const y of [hb - 2, hb - 1]) c.px(x, y, BELT, cyl((x - bx) / 9.5, 0.2));
    c.part();
    for (let y = hb - 3; y <= hb; y++) for (let x = Math.round(bx - 1); x <= bx + 1; x++) c.px(x, y, BRASS, sphere((x - bx) / 2, (y - hb + 1.5) / 2, 1), { bias: x === Math.round(bx) && y > hb - 3 && y < hb ? -2 : 0 });
    if (!back) oilCan(c, bx + 8, hb + 1, 'front');
    else oilCan(c, bx - 9, hb + 1, 'back');
  } else {
    // A heavy hip ring, and a grille at the bottom.
    c.part();
    c.shape(hb - 1, hb, () => [bx - 7.5, bx + 8.5], IRON, (_x, _y, t) => cyl(t, -0.2));
  }

  if (back) {
    // A riveted hatch on its back, and the firebox's vents low down, glowing.
    c.part();
    const hx = bx + 0.5;
    c.shape(tb + 5, tb + 11, (y) => [hx - 4 + (y === tb + 5 || y === tb + 11 ? 1 : 0), hx + 4 - (y === tb + 5 || y === tb + 11 ? 1 : 0)], tin ? L.iron : IRON, (_x, _y, t, u) => sphere(t * 0.8, u * 1.4 - 0.7, 1.2));
    for (const [x, y] of [[hx - 3, tb + 6], [hx + 2, tb + 6], [hx - 3, tb + 10], [hx + 2, tb + 10]]) c.px(x, y, tin ? STEEL : L.band, FLAT, { bias: 1 });
    c.px(hx - 0.5, tb + 8, tin ? STEEL : L.band, FLAT, { bias: 0 });
    c.part();
    for (let i = 0; i < 2; i++) {
      const y = hb - 5 + i * 2 - (tin ? 0 : 0);
      for (let x = Math.round(bx - 4); x <= bx + 5; x++) c.px(x, y, L.fire, { x: 0, y: -0.4, z: 0.9 }, { glow: 0.5 + p.vent * 0.4 + (p.blaze - 1) * 0.3, bias: p.blaze > 1.5 ? 1 : 0 });
    }
  } else {
    furnace(c, p, Math.round(bx + 0.5), tb + 10);
    gauge(c, bx - 4.5, tb + 5.5, p.needle);
  }

  // Shoulders.
  c.part();
  for (const s of [-1, 1]) {
    const x = bx + 0.5 + s * 10.5;
    c.ellipse(x, tb + 3, 4.2, 3.8, plate);
    if (tin) c.ellipse(x, tb + 5.5, 3.6, 1, L.iron, { flatten: 0.5 });
    c.px(Math.round(x - 1), tb + 1, tin ? STEEL : L.band, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 1 });
  }
  if (back && !tin) stack(c, bx - 6, tb + 4, true);

  head(c, p, bx, tb, back);

  // Gauntlets in front of the body (all of them from the front; at its sides from behind).
  for (const a of arms) if (!a.behind) drawArm(a);

  // The stack's (or the funnel's) breath.
  const mouth = tin ? { x: bx + 0.5, y: tb - 12 } : back ? { x: bx - 6, y: tb - 9 } : { x: bx + 7.5, y: tb - 8 };
  if (p.puff > 0) puff(c, mouth.x, mouth.y, p.puff);
  if (p.whistle > 0) whistle(c, Math.round(mouth.x), mouth.y, p.whistle);
  if (p.exhaust > 0) exhaust(c, p.exhaust, mouth, bx, hb, view);
  if (p.vent > 0) boilOff(c, p.vent, tb, hb, bx);
}

/** The little domed head with its slit visor; or the Tin Man's can of a head under his funnel. */
function head(c: PixelCanvas, p: JuggPose, bx: number, tb: number, back: boolean): void {
  const hx = bx + 0.5;
  const hy = tb - 1;
  c.part();
  if (L.tin) {
    // Collar.
    c.ellipse(hx, tb + 1, 4.4, 1.4, L.iron, { flatten: 0.5 });
    c.part();
    // The can: straight sides, a hinged jaw.
    c.shape(hy - 3, hy + 2, (y) => [hx - 3.5 + (y === hy + 2 ? 0.5 : 0), hx + 3.5 - (y === hy + 2 ? 0.5 : 0)], TIN, (_x, _y, t) => cyl(t, 0.15));
    c.part();
    // The funnel hat: a brim, the cone, and its spout.
    c.shape(hy - 4, hy - 4, () => [hx - 4.5, hx + 4.5], TIN, (_x, _y, t) => cyl(t, 0.6));
    c.shape(hy - 10, hy - 5, (y) => {
      const k = (y - (hy - 10)) / 5;
      const w = 0.8 + k * 3.2;
      return [hx - w, hx + w];
    }, TIN, (_x, y, t) => cyl(t, 0.45 - (y - hy + 10) * 0.06));
    c.shape(hy - 12, hy - 11, () => [hx - 0.5, hx + 0.5], TIN, (_x, _y, t) => cyl(t, 0.4));
    c.px(Math.round(hx - 2), hy - 6, STEEL, FLAT, { bias: 2 });
    if (back) return;
    // His face: kind painted eyes under sad little brows, a nose, a hinged jaw, rosy cheeks.
    c.part();
    const ex = Math.round(hx) + p.look;
    if (p.happy) {
      for (const x of [ex - 3, ex + 1]) {
        c.px(x, hy - 1, INK);
        c.px(x + 1, hy - 2, INK);
        c.px(x + 2, hy - 1, INK);
      }
      c.px(ex - 1, hy + 1, INK);
      c.px(ex, hy + 1, INK);
      c.px(ex - 2, hy, INK);
      c.px(ex + 1, hy, INK);
    } else {
      for (const x of [ex - 2, ex + 1]) c.px(x, hy - 1, INK);
      c.px(ex - 3, hy - 2, INK);
      c.px(ex + 2, hy - 2, INK);
      c.px(ex - 1, hy + 1, INK);
      c.px(ex, hy + 1, INK);
    }
    c.px(ex - 1, hy, TIN, { x: -0.3, y: 0.5, z: 0.8 }, { bias: 1 });
    for (const x of [ex - 3, ex + 2]) c.px(x, hy, BLUSH, FLAT);
    // Jaw hinges.
    c.px(Math.round(hx - 4), hy + 1, TIN_DARK, FLAT);
    c.px(Math.round(hx + 3), hy + 1, TIN_DARK, FLAT);
    return;
  }
  // A dark collar ring it's sunk into.
  c.ellipse(hx, tb + 1.2, 4.6, 1.5, JOINT, { flatten: 0.5 });
  c.part();
  c.ellipse(hx, hy, 4, 3.8, L.iron);
  // A brow ridge over the slit, and a rivet on the crown.
  c.part();
  c.px(Math.round(hx - 0.5), hy - 3, L.band, { x: -0.3, y: 0.7, z: 0.6 }, { bias: 1 });
  if (back) {
    for (let x = Math.round(hx - 2); x <= hx + 1; x++) c.shade(x, hy + 1, -1);
    return;
  }
  for (let x = Math.round(hx - 3); x <= hx + 2; x++) c.shade(x, hy - 2, 1);
  const ex = Math.round(hx) + p.look;
  if (p.happy) {
    // A contented squint: the slit bends up into two little arcs.
    for (const x of [ex - 3, ex + 1]) {
      c.px(x, hy, L.eye);
      c.px(x + 1, hy - 1, L.eye);
      c.px(x + 2, hy, L.eye);
    }
  } else {
    for (let x = ex - 3; x <= ex + 2; x++) c.px(x, hy, JOINT);
    for (let x = ex - 2; x <= ex + 1; x++) c.px(x, hy, L.eye, FLAT, { bias: x === ex - 2 || x === ex + 1 ? 0 : 1 });
  }
}

/** A short, thick leg in a heavy boot (the tin's a stovepipe ringed at the knee). */
function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, view: View): void {
  const kx = (hx + fx) / 2 + (view === 'side' ? -1 : Math.sign(hx - CX) * 0.6);
  const ky = (hy + fy) / 2 - 0.5;
  c.part();
  c.capsule(hx, hy, kx, ky, 3, 2.8, L.iron);
  c.capsule(kx, ky, fx, fy - 2.5, 2.8, 2.6, L.iron);
  c.part();
  if (L.tin) c.ellipse(kx, ky, 3.2, 1.3, L.plate, { flatten: 0.5 });
  else c.ellipse(kx, ky, 2.1, 2, JOINT);
  c.part();
  // The boot: a rounded iron clog with a toe cap.
  if (view === 'side') {
    c.shape(Math.round(fy - 4), Math.round(fy - 1), (y) => [fx - 5 + (y < fy - 3 ? 2 : 0), fx + 3 - (y < fy - 3 ? 1 : 0)], plateBoot(), (_x, _y, t, u) => sphere(t * 0.8, u - 0.4, 0.9));
    c.ellipse(fx - 4, fy - 2, 1.4, 1.4, L.tin ? L.iron : L.band);
  } else {
    c.shape(Math.round(fy - 4), Math.round(fy - 1), (y) => [fx - 3.8 + (y < fy - 3 ? 1 : 0), fx + 3.8 - (y < fy - 3 ? 1 : 0)], plateBoot(), (_x, _y, t, u) => sphere(t * 0.8, u - 0.4, 0.9));
    if (view === 'down') c.ellipse(fx, fy - 1.6, 2, 1.1, L.tin ? L.iron : L.band, { flatten: 0.6 });
  }
}

const plateBoot = (): Material => L.plate;

/** The smokestack: an iron pipe rising behind it, a lip at its mouth (front seen past its shoulder; back, whole). */
function stack(c: PixelCanvas, x: number, y0: number, whole: boolean): void {
  c.part();
  const top = y0 - 11;
  c.shape(top, y0 + (whole ? 3 : 0), (y) => [x - 1.5, x + 1.5 + (y < top + 2 ? 0.5 : 0)], IRON, (_x, _y, t) => cyl(t, 0.25));
  c.part();
  // A band and the flared mouth.
  c.shape(top + 4, top + 4, () => [x - 2, x + 2], L.band, (_x, _y, t) => cyl(t, 0.4));
  c.ellipse(x + 0.5, top, 2.6, 1.1, IRON, { flatten: 0.5 });
  c.ellipse(x + 0.5, top, 1.4, 0.6, JOINT);
}

/** The oil can at the Tin Man's hip: a round tin with a long thin spout. */
function oilCan(c: PixelCanvas, x: number, y: number, view: 'front' | 'back' | 'side'): void {
  c.part();
  c.ellipse(x, y, 2.2, 2.4, BRASS);
  c.part();
  c.px(Math.round(x - 1), Math.round(y - 1), BRASS, { x: -0.5, y: 0.5, z: 0.7 }, { bias: 2 });
  const dir = view === 'back' ? -1 : 1;
  for (let i = 1; i <= 4; i++) c.px(Math.round(x + dir * (0.5 + i * 0.7)), Math.round(y - 2 - i * 0.8), TIN, { x: 0, y: 0.6, z: 0.8 });
  c.px(Math.round(x), Math.round(y - 3), BELT, FLAT);
}

/** Steam streaming out behind it as it charges: from the stack, and off its back in plumes. */
function exhaust(c: PixelCanvas, stage: number, mouth: { x: number; y: number }, bx: number, hb: number, view: View): void {
  c.part();
  const white: RGB = [235, 240, 248];
  const sh = stage === 1 ? 0 : 1;
  if (view === 'side') {
    // Facing left: everything streams off to the right.
    for (let i = 0; i < 4; i++) cloud(c, mouth.x + 2 + i * 3 + sh, mouth.y - 1 + i * 0.3, 1.3 + i * 0.35, 1 - i * 0.22);
    for (const y of [hb - 6, hb - 12]) for (let i = 0; i < 9; i++) {
      if ((i + sh) % 3 === 2) continue;
      c.px(bx + 9 + i, y + (i > 5 ? 1 : 0), STEAM, FLAT, { bias: i < 3 ? 1 : 0 });
      c.spark(bx + 9 + i, y, white, 0.2);
    }
    return;
  }
  if (view === 'down') {
    // Coming at the viewer: plumes rise behind both shoulders and the stack.
    for (let i = 0; i < 3; i++) cloud(c, mouth.x + 0.5 * i, mouth.y - 1 - i * 2.5 - sh, 1.4 + i * 0.4, 1 - i * 0.25);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cloud(c, bx + s * (9 + i), hb - 20 - i * 2 - sh, 1.2 + i * 0.3, 0.9 - i * 0.25);
    return;
  }
  // Going away: the jets blast back at the viewer, low either side.
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) cloud(c, bx + s * (6 + i * 1.5), hb + 2 + i * 1.2 + sh, 1.2 + i * 0.35, 1 - i * 0.22);
}

// ---------------------------------------------------------------------------
// The side view, facing left

function drawSide(c: PixelCanvas, p: JuggPose): void {
  const tin = L.tin;
  const bx = CX + p.shake;
  const hb = GROUND - HIP - p.bob + p.crouch;
  const tb = hb - BODY;
  const plate = plateOf(p);
  const lean = p.lean;
  /** How far a point at height y has leant forward (left). */
  const off = (y: number): number => -lean * clamp((hb - y) / BODY, 0, 1.2);

  // Fists: hanging at its side, thrown forward at chest height, raised, cocked back.
  const fistAt = (near: boolean, reach: number, raise: number): { x: number; y: number } => {
    let x = bx + (near ? -4 : 0);
    let y = tb + 15 + p.sag;
    if (reach < 0) {
      x += 4 * -reach;
      y -= 2 * -reach;
    } else if (reach > 0) {
      x = lerp(x, bx - 15 + off(tb + 9), Math.min(1.3, reach));
      y = lerp(y, tb + 9, Math.min(1.3, reach));
    }
    if (raise > 0) {
      x = lerp(x, bx - 6 + (near ? 0 : 4), raise);
      y = lerp(y, tb - 7, raise);
    }
    return { x, y };
  };
  const far = fistAt(false, p.reachB, p.raiseB);
  const near = fistAt(true, p.reachA, p.raiseA);

  // The far gauntlet, behind everything.
  gauntlet(c, p, bx + 2 + off(tb + 3), tb + 3, far.x, far.y, p.pistB, p.jetB, 0.92, true, 'side');
  // The far leg.
  leg(c, bx + 1.5, hb - 1, bx + 1 + p.strideB, GROUND - p.liftB, 'side');
  // The stack at its back.
  if (!tin) stack(c, bx + 4.5 + off(tb), tb + 3, false);
  // The near leg.
  leg(c, bx - 0.5, hb - 1, bx - 1 + p.strideA, GROUND - p.liftA, 'side');

  // The boiler, side on, leaning into the blow.
  c.part();
  c.shape(tb, hb, (y) => {
    const u = (y - tb) / (hb - tb);
    let hw = 6.5 + 1.2 * Math.sin(u * Math.PI);
    if (y === tb) hw -= 2;
    else if (y === tb + 1 || y === hb) hw -= 1;
    const o = off(y);
    return [bx - hw + 0.5 + o, bx + hw + 0.5 + o];
  }, plate, (_x, y, t) => cyl(t * 0.85, 0.35 - ((y - tb) / BODY) * 0.55));
  c.ellipse(bx + 0.5 + off(tb), tb + 1, 5, 1.4, plate, { flatten: 0.35, normal: (_x, _y, dx) => ({ x: dx * 0.4, y: 0.8, z: 0.5 }) });
  c.part();
  for (const y of [tb + 3, hb - 3]) {
    const u = (y - tb) / (hb - tb);
    const hw = 6.5 + 1.2 * Math.sin(u * Math.PI);
    const o = off(y);
    for (let x = Math.round(bx - hw + 0.5 + o); x < bx + hw + 0.5 + o; x++) c.px(x, y, tin ? L.iron : L.band, cyl(((x - bx - o) / hw) * 0.95, 0.3), { bias: (x - Math.round(bx)) % 3 === 0 ? 1 : 0 });
  }
  // The furnace's glow showing at its front edge, through the grate's side (the tin's heart window side on).
  c.part();
  const gy = tb + 10;
  for (let y = gy - 3; y <= gy + 3; y++) {
    const x0 = Math.round(bx - 6.5 + off(y)) + (y === gy - 3 || y === gy + 3 ? 1 : 0);
    if (tin && (y === gy + 3 || y === gy - 3)) continue;
    for (let x = x0; x <= x0 + 1; x++) c.px(x, y, L.fire, { x: -0.6, y: 0, z: 0.8 }, { glow: p.blaze < 0.5 ? 0.45 : 1, bias: Math.round((y - gy + 3) / 3.5 + (hash(x, y, p.fire) > 0.6 ? 1 : 0) + (p.blaze - 1) + p.door) });
    if (!tin && p.door < 0.4 && (y - gy) % 2 === 0) c.px(x0 + 1, y, JOINT);
  }
  if (p.door > 0) embers(c, bx - 9 + off(gy), gy - 2, Math.round(6 * p.door), 9 + p.fire);
  if (tin) {
    c.part();
    for (let x = Math.round(bx - 7 + off(hb)); x <= bx + 7 + off(hb); x++) for (const y of [hb - 2, hb - 1]) c.px(x, y, BELT, cyl((x - bx) / 7.5, 0.2));
    oilCan(c, bx + 2.5, hb + 1, 'side');
  } else {
    c.part();
    c.shape(hb - 1, hb, () => [bx - 6 + off(hb), bx + 7 + off(hb)], IRON, (_x, _y, t) => cyl(t, -0.2));
    // A rivet row at the back.
    for (let y = tb + 5; y <= hb - 5; y += 3) c.px(Math.round(bx + 4 + off(y)), y, plate, { x: 0.3, y: 0.4, z: 0.85 }, { bias: 1 });
  }

  // Head, at the front of its top.
  const hx = bx - 2.5 + off(tb - 1);
  const hy = tb - 1;
  c.part();
  if (tin) {
    c.ellipse(hx + 1, tb + 1, 3.4, 1.2, L.iron, { flatten: 0.5 });
    c.part();
    c.shape(hy - 3, hy + 2, () => [hx - 2.5, hx + 3.5], TIN, (_x, _y, t) => cyl(t, 0.15));
    c.part();
    c.shape(hy - 4, hy - 4, () => [hx - 3.5, hx + 4.5], TIN, (_x, _y, t) => cyl(t, 0.6));
    c.shape(hy - 10, hy - 5, (y) => {
      const k = (y - (hy - 10)) / 5;
      const w = 0.8 + k * 3.2;
      return [hx + 0.5 - w, hx + 0.5 + w];
    }, TIN, (_x, y, t) => cyl(t, 0.45 - (y - hy + 10) * 0.06));
    c.shape(hy - 12, hy - 11, () => [hx, hx + 1], TIN, (_x, _y, t) => cyl(t, 0.4));
    c.part();
    const fx = Math.round(hx - 2);
    c.px(fx + 1, hy - 1, INK);
    c.px(fx + 1, hy - 2 + (p.happy ? 0 : -0), INK);
    // His nose, a little cone poking out of the can.
    c.px(fx - 1, hy, TIN, { x: -0.6, y: 0.3, z: 0.7 }, { bias: 1 });
    c.px(fx, hy, TIN, { x: -0.6, y: 0.3, z: 0.7 });
    c.px(fx + 1, hy + 1, INK);
    c.px(fx + 2, hy + 1, INK);
    c.px(fx + 3, hy, BLUSH, FLAT);
    c.px(Math.round(hx + 3), hy + 1, TIN_DARK, FLAT);
  } else {
    c.ellipse(hx + 1, tb + 1.2, 3.6, 1.4, JOINT, { flatten: 0.5 });
    c.part();
    c.ellipse(hx + 0.5, hy, 3.6, 3.7, L.iron);
    c.part();
    c.px(Math.round(hx + 0.5), hy - 3, L.band, { x: -0.3, y: 0.7, z: 0.6 }, { bias: 1 });
    // The slit visor, wrapping round its face.
    const vx = Math.round(hx - 3);
    c.px(vx, hy, JOINT);
    for (let x = vx; x <= vx + 2; x++) c.px(x, hy, L.eye, FLAT, { bias: x === vx ? 1 : 0 });
    for (let x = vx; x <= vx + 3; x++) c.shade(x, hy - 1, 1);
  }

  // The near shoulder and gauntlet, in front of it all.
  c.part();
  const sx = bx + 0.5 + off(tb + 3);
  c.ellipse(sx, tb + 4, 4.4, 4, plate);
  c.px(Math.round(sx - 1), tb + 1, tin ? STEEL : L.band, { x: -0.4, y: 0.6, z: 0.7 }, { bias: 1 });
  gauntlet(c, p, sx, tb + 5, near.x, near.y, p.pistA, p.jetA, 1, false, 'side');

  const mouth = tin ? { x: hx + 0.5, y: hy - 12 } : { x: bx + 5 + off(tb), y: tb - 8 };
  if (p.puff > 0) puff(c, mouth.x, mouth.y, p.puff);
  if (p.whistle > 0) whistle(c, Math.round(mouth.x), mouth.y, p.whistle);
  if (p.exhaust > 0) exhaust(c, p.exhaust, mouth, bx, hb, 'side');
  if (p.vent > 0) boilOff(c, p.vent, tb, hb, bx);
}

// ---------------------------------------------------------------------------
// Animations

export type JuggAnim = 'idle' | 'walk' | 'jabA' | 'jabB' | 'slam' | 'rush' | 'shove' | 'vent' | 'cast' | 'rest';

interface AnimDef {
  name: JuggAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => JuggPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const at = (o: Partial<JuggPose>): JuggPose => ({ ...base(), ...o });

/** Standing: the boiler breathes, the coals flicker. */
const idle = (): JuggPose[] => [0, 0, 1, 1].map((b, i) => at({ crouch: b, fire: i, sag: b }));

/** A heavy, rolling stomp: each boot lifts and comes down hard, the fists swinging against the legs. */
const walk = (view: View): JuggPose[] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const s = Math.sin(a);
    const p = at({ fire: i % 4 });
    p.bob = Math.round(Math.abs(Math.cos(a)));
    p.liftA = Math.max(0, Math.round(s * 3));
    p.liftB = Math.max(0, Math.round(-s * 3));
    if (view === 'side') {
      p.strideA = Math.round(-Math.cos(a) * 3.5);
      p.strideB = Math.round(Math.cos(a) * 3.5);
      p.lean = 1;
    }
    p.reachA = Math.cos(a) * 0.14;
    p.reachB = -Math.cos(a) * 0.14;
    return p;
  });

/** A jab: a short cock, the piston kicks the fist out, holds a beat, and draws back. */
const jab = (which: 'A' | 'B') => (view: View): JuggPose[] =>
  [
    { reach: -0.3, pist: 0, lean: -1, crouch: 0 },
    { reach: 1, pist: 3, lean: 3, crouch: 1 },
    { reach: 1.05, pist: 4, lean: 3, crouch: 1 },
    { reach: 0.4, pist: 1, lean: 1, crouch: 0 },
  ].map((k, i) => {
    const p = at({ fire: i, crouch: k.crouch, lean: view === 'side' ? k.lean : 0 });
    if (which === 'A') {
      p.reachA = k.reach;
      p.pistA = k.pist;
      p.reachB = 0.25;
    } else {
      p.reachB = k.reach;
      p.pistB = k.pist;
      p.reachA = 0.25;
    }
    return p;
  });

/**
 * The piston slam: it draws the fist right back as pressure builds (steam
 * leaking), then the piston fires with a blast of steam out of the housing,
 * the whole body thrown in behind it, and it hauls the fist back.
 */
const slam = (view: View): JuggPose[] =>
  [
    { reach: -0.6, pist: 0, jet: 0, lean: -2, crouch: 1, puff: 0 },
    { reach: -0.8, pist: 0, jet: 0, lean: -2, crouch: 2, puff: 1 },
    { reach: 1.25, pist: 7, jet: 1, lean: 5, crouch: 2, puff: 2 },
    { reach: 1.25, pist: 7, jet: 2, lean: 5, crouch: 1, puff: 3 },
    { reach: 0.7, pist: 3, jet: 0, lean: 2, crouch: 1, puff: 4 },
    { reach: 0.2, pist: 0, jet: 0, lean: 0, crouch: 0, puff: 5 },
  ].map((k, i) => at({ fire: i % 4, reachA: k.reach, pistA: k.pist, jetA: k.jet, reachB: 0.3, crouch: k.crouch, lean: view === 'side' ? k.lean : 0, puff: k.puff, blaze: i === 2 ? 1.6 : 1 }));

/** Steam rush: bent low behind both fists, legs driving, steam streaming out behind. */
const rush = (view: View): JuggPose[] =>
  [0, 1].map((i) =>
    at({ fire: i * 2, crouch: 2, lean: view === 'side' ? 5 : 0, reachA: 0.55, reachB: 0.55, liftA: i ? 2 : 0, liftB: i ? 0 : 2, strideA: view === 'side' ? (i ? -4 : 2) : 0, strideB: view === 'side' ? (i ? 2 : -4) : 0, exhaust: i + 1, blaze: 1.5 }),
  );

/** The shove that ends the rush: both pistons fire at once, and it hauls back. */
const shove = (view: View): JuggPose[] =>
  [
    { reach: 0.4, pist: 0, jet: 0, lean: 3 },
    { reach: 1.2, pist: 6, jet: 1, lean: 5 },
    { reach: 1.2, pist: 6, jet: 2, lean: 4 },
    { reach: 0.5, pist: 2, jet: 0, lean: 1 },
  ].map((k, i) => at({ fire: i, crouch: i < 3 ? 2 : 1, reachA: k.reach, reachB: k.reach, pistA: k.pist, pistB: k.pist, jetA: k.jet, jetB: k.jet, lean: view === 'side' ? k.lean : 0, blaze: 1.4 }));

/** Overheated: slumped, fists hanging, steam boiling off every seam, the furnace roaring white. */
const vent = (): JuggPose[] => [1, 0.8, 0.6, 0.8].map((k, i) => at({ vent: k, crouch: 2, sag: 2, fire: i, blaze: 2, reachA: -0.1, reachB: -0.1 }));

/**
 * Meltdown (also its pose on the select screen): it throws its arms wide and
 * up as the furnace door bursts open, the plates going red-hot and the
 * coals roaring.
 */
const cast = (view: View): JuggPose[] =>
  [0, 0.35, 0.7, 1, 1, 1].map((k, i) =>
    at({ raiseA: k, raiseB: k, crouch: i < 2 ? 2 : i === 2 ? 1 : 0, bob: i >= 3 ? 1 : 0, door: i >= 2 ? Math.min(1, (i - 1) * 0.5) : 0, blaze: 1 + k, hot: i >= 3, fire: i % 4, puff: [0, 1, 2, 3, 4, 5][i], vent: i >= 4 ? 0.5 : 0, lean: view === 'side' ? -1 : 0, look: 0 }),
  );

/**
 * The idle moment, facing the viewer only: it taps its pressure gauge with a
 * knuckle, once, twice, the needle jumping, gives a little rattle as the
 * pressure comes up, lets off a puff from its stack, and sounds a satisfied
 * whistle, squinting happily.
 */
const rest = (view: View): JuggPose[] => {
  if (view !== 'down') return [];
  return [
    at({}),
    at({ tap: 0.55, look: -1 }),
    at({ tap: 1, needle: 0.15, look: -1, crouch: 1 }),
    at({ tap: 0.75, needle: 0.15, look: -1 }),
    at({ tap: 1, needle: 0.75, look: -1, crouch: 1 }),
    at({ tap: 0.65, needle: 0.8, look: -1, fire: 1 }),
    at({ tap: 0.2, needle: 0.8, shake: 1, fire: 2 }),
    at({ needle: 0.85, shake: -1, fire: 3, crouch: 1 }),
    at({ needle: 0.85, shake: 1, puff: 1, fire: 0 }),
    at({ needle: 0.8, puff: 2, fire: 1, blaze: 1.3 }),
    at({ needle: 0.75, puff: 3, whistle: 1, happy: true, fire: 2, blaze: 1.3 }),
    at({ needle: 0.6, puff: 4, whistle: 2, happy: true, bob: 1, fire: 3, blaze: 1.3 }),
    at({ needle: 0.5, puff: 5, whistle: 2, happy: true, bob: 1, fire: 0, blaze: 1.2 }),
    at({ needle: 0.4, whistle: 1, happy: true, fire: 1 }),
    at({ needle: 0.3, fire: 2 }),
  ];
};

export const JUGG_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'jabA', fps: 16, loop: false, poses: jab('A') },
  { name: 'jabB', fps: 16, loop: false, poses: jab('B') },
  { name: 'slam', fps: 14, loop: false, poses: slam },
  { name: 'rush', fps: 12, loop: true, poses: rush },
  { name: 'shove', fps: 14, loop: false, poses: shove },
  { name: 'vent', fps: 8, loop: true, poses: vent },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: [0, 0, 1, 2, 3, 2, 3, 4, 5, 5, 5, 6, 7, 6, 7, 8, 9, 10, 11, 12, 11, 12, 11, 13, 14, 0] },
];

/** The frame of each blow's anim where it lands (the jabs and slam), or the shove where it pushes. */
export const JUGG_HIT_FRAME: Partial<Record<JuggAnim, number>> = { jabA: 1, jabB: 1, slam: 2, shove: 1 };

export interface JuggFrame {
  key: string;
  anim: JuggAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: JuggPose): PixelCanvas {
  const c = new PixelCanvas(JUGG_W, JUGG_H);
  if (dir === 'down') drawFront(c, p, false);
  else if (dir === 'up') drawFront(c, p, true);
  else drawSide(c, p);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildJuggFrames(look: JuggLook = JUGG_LOOK): JuggFrame[] {
  L = look;
  const out: JuggFrame[] = [];
  for (const a of JUGG_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = JUGG_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons (drawn additively on the buttons: dark is empty)

type Put = (x: number, y: number, c: RGB) => void;

/** A 16x16 icon where later strokes overwrite earlier ones, so dark detail can cut into a bright fill. */
function icon(draw: (put: Put) => void): Uint8ClampedArray {
  const S = 16;
  const px = new Uint8ClampedArray(S * S * 4);
  draw((x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    px.set([c[0], c[1], c[2], 255], (y * S + x) * 4);
  });
  return px;
}

type Tones = [RGB, RGB, RGB, RGB];
const IRON_TONES: Tones = [hex('#fff0d8'), hex('#c8a888'), hex('#7a6450'), hex('#3a2c22')];
const FIRE_TONES: Tones = [hex('#fff4c0'), hex('#ffc860'), hex('#ff6a3a'), hex('#a8281a')];
const TIN_TONES: Tones = [hex('#ffffff'), hex('#d4dce6'), hex('#8c98a4'), hex('#3e4650')];
const ROSE_TONES: Tones = [hex('#fff0f4'), hex('#ffa0b8'), hex('#ff5a7a'), hex('#a01a3a')];
const STEAM_RGB: RGB = hex('#e6ecf2');

/** Piston fists: a gauntlet driving its fist out on the rod, steam bursting from the housing, the air cracking ahead. */
export function fistsIcon(tin = false): Uint8ClampedArray {
  const m = tin ? TIN_TONES : IRON_TONES;
  const f = tin ? ROSE_TONES : FIRE_TONES;
  return icon((put) => {
    // Steam out of the back of the housing.
    for (const [x, y] of [[0, 5], [1, 4], [0, 11], [1, 12], [2, 3], [2, 13]]) put(x, y, STEAM_RGB);
    // The housing, banded.
    for (let x = 2; x <= 6; x++) for (let y = 5; y <= 11; y++) put(x, y, y === 5 ? m[1] : y === 11 ? m[3] : m[2]);
    for (let y = 5; y <= 11; y++) {
      put(3, y, tin ? m[1] : FIRE_TONES[1]);
      put(6, y, tin ? m[1] : FIRE_TONES[1]);
    }
    // The rod.
    for (let x = 7; x <= 8; x++) {
      put(x, 7, m[0]);
      put(x, 8, m[1]);
      put(x, 9, m[2]);
    }
    // The fist, knuckles forward.
    for (let x = 9; x <= 13; x++) for (let y = 5; y <= 11; y++) {
      if ((x === 9 || x === 13) && (y === 5 || y === 11)) continue;
      put(x, y, y < 7 ? m[1] : y > 9 ? m[3] : m[2]);
    }
    for (const y of [6, 8, 10]) put(13, y, tin ? m[0] : FIRE_TONES[1]);
    for (const y of [7, 9]) put(12, y, m[3]);
    // The blow: the air cracking off the knuckles.
    for (const [x, y] of [[15, 8], [15, 6], [15, 10], [14, 4], [14, 12]]) put(x, y, f[1]);
    put(15, 8, f[0]);
    if (tin) heartIcon(put, 1, 0, ROSE_TONES);
  });
}

/** Steam rush: the boiler barrelling forward, shoulder first, steam jets streaming out behind. */
export function rushIcon(tin = false): Uint8ClampedArray {
  const m = tin ? TIN_TONES : IRON_TONES;
  const f = tin ? ROSE_TONES : FIRE_TONES;
  return icon((put) => {
    // Jets and speed lines streaming back.
    for (const [y, x0, x1] of [[4, 0, 3], [7, 0, 4], [10, 1, 4], [13, 0, 3]] as const) for (let x = x0; x <= x1; x++) put(x, y, x < x0 + 1 ? hex('#8a96a6') : STEAM_RGB);
    // The boiler, leant forward.
    for (let y = 3; y <= 13; y++) {
      const lean = Math.round((13 - y) * 0.35);
      for (let x = 5 + lean; x <= 11 + lean; x++) put(x, y, x === 5 + lean ? m[1] : x === 11 + lean ? m[3] : m[2]);
    }
    // A band, and the furnace's glow at its front.
    for (let x = 6; x <= 13; x++) put(x, 6, tin ? m[1] : FIRE_TONES[1]);
    for (let y = 8; y <= 11; y++) put(11 + Math.round((13 - y) * 0.35), y, f[y > 9 ? 2 : 1]);
    // The fist out front, ready to meet whatever's there.
    for (let x = 12; x <= 15; x++) for (let y = 8; y <= 11; y++) if (!((x === 15) && (y === 8 || y === 11))) put(x, y, y === 8 ? m[1] : m[2]);
    put(15, 9, f[0]);
    put(15, 10, f[1]);
    // The stack, smoking.
    put(7, 1, m[2]);
    put(7, 2, m[2]);
    put(5, 0, STEAM_RGB);
    put(6, 0, STEAM_RGB);
  });
}

/** A tiny heart in the icon's corner, for the Tin Man's. */
function heartIcon(put: Put, x: number, y: number, t: Tones): void {
  HEARTS[1].forEach((row, r) => [...row].forEach((b, k) => b === '1' && put(x + k, y + r, r === 0 ? t[1] : t[2])));
  put(x + 1, y + 1, t[0]);
}
