// The Siege Mech: a squat two-legged walker in hazard yellow and gunmetal,
// a pilot in a red helmet under its glass dome, a cannon on each arm, a
// smokestack at its back and reverse-jointed legs that stomp. Its Scrap
// Titan skin is built from junk on the same rig: an oil barrel for a body
// with a goblin in welding goggles peering out of a porthole (his ears poke
// out of holes in the lid), a traffic cone for a hat, a bent stovepipe,
// copper pipe legs on coil springs (one foot a tyre, one an iron boot), and a
// crane claw and a drill for arms.
//
// Three views like every hero: down, up, and the side view drawn facing
// left and mirrored for right. Frames are MECH_W x MECH_H with the feet on
// GROUND at the centre.

import { FLAT, PixelCanvas, cyl, hex, sphere, type DrawOpts, type Material, type RGB, type Vec3 } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const MECH_W = 58;
export const MECH_H = 44;
const CX = 28;
const GROUND = 41;
export const MECH_ORIGIN_X = CX;
export const MECH_ORIGIN_Y = GROUND;
/** Where the cannons fire from, above the feet: the shells leave at this height. */
export const MECH_GUN_Y = 16;
/** The cannons' distance to either side of the centre (front and back views). */
export const MECH_GUN_X = 13;
/** Below this power the rest's lamps and goggles are dark. */
const POWER_OFF = 0.35;

// ---------------------------------------------------------------------------
// Materials

const PLATE: Material = { ramp: ramp('#5a300c', '#9a5a16', '#d88e24', '#f4c040', '#fff0a0'), outline: hex('#241204'), outlineLit: hex('#3a200a'), shine: true };
const GUNMETAL: Material = { ramp: ramp('#161820', '#262a38', '#3e4458', '#606a84', '#9aa4bc'), outline: hex('#08090e'), outlineLit: hex('#141620'), shine: true };
const JOINT: Material = { ramp: ramp('#0a0b10', '#161822', '#252936'), outline: hex('#040406') };
const GLASS: Material = { ramp: ramp('#0a3444', '#16627a', '#34a6c0', '#86e2f4', '#e6ffff'), outline: hex('#051c24'), shine: true, emissive: 0.12 };
const HAZARD: Material = { ramp: ramp('#0c0c10', '#18181e', '#26262e'), outline: hex('#040406') };
const LAMP: Material = { ramp: ramp('#ffb040', '#ffe6a0', '#fffbe8'), outline: hex('#5a3006'), emissive: 1, noAO: true };
const VENT: Material = { ramp: ramp('#8a1e06', '#e0501a', '#ffa040', '#ffe08a'), outline: hex('#2a0802'), emissive: 0.85, noAO: true };
const HELMET: Material = { ramp: ramp('#4a0c0c', '#8e1e1a', '#d0402e', '#ff8060'), outline: hex('#1e0404'), shine: true };
const PILOT_VISOR: Material = { ramp: ramp('#10141c', '#2a3446', '#5a7090'), outline: hex('#05060a'), shine: true };

// The Scrap Titan's junk.
const RUST: Material = { ramp: ramp('#2e0e04', '#5a200c', '#8a3616', '#b8602c', '#de9656'), outline: hex('#140602'), outlineLit: hex('#220a04') };
const COPPER: Material = { ramp: ramp('#3a1606', '#743812', '#b0642a', '#e0a060', '#ffe0b0'), outline: hex('#160802'), shine: true };
const RUBBER: Material = { ramp: ramp('#070709', '#131318', '#222228', '#34343e'), outline: hex('#020203') };
const CONE: Material = { ramp: ramp('#7a2004', '#c8480c', '#f47a22', '#ffb060'), outline: hex('#2a0a02'), shine: true };
const CONE_BAND: Material = { ramp: ramp('#9a9aa4', '#dcdce4', '#ffffff'), outline: hex('#2a0a02'), shine: true };
const STEEL: Material = { ramp: ramp('#22262e', '#4c5260', '#8a94a6', '#d4dce8', '#ffffff'), outline: hex('#0a0c10'), shine: true };
const GOBLIN: Material = { ramp: ramp('#183a10', '#2e6a1c', '#58a034', '#94d864'), outline: hex('#081604') };
const GOGGLE: Material = { ramp: ramp('#ff9a1a', '#ffd860', '#fffbd0'), outline: hex('#1a0e04'), emissive: 0.9, noAO: true };
const TOOTH: Material = { ramp: ramp('#b8b09a', '#fff8e0'), outline: hex('#140a04'), noAO: true };
const WOOD: Material = { ramp: ramp('#3a220e', '#6a4420', '#9a6c38', '#c89a58'), outline: hex('#140a04') };
const PAINT: Material = { ramp: ramp('#7a0e0e', '#c82020'), outline: hex('#2a0404'), noOutline: true, noAO: true };

// The idle moment's: the lamps and goggles with the power cut, the steam it
// lets off, and the pilot's snores.
const LAMP_OFF: Material = { ramp: ramp('#2a2016', '#4a3a26', '#6a563a'), outline: hex('#140c04'), shine: true };
const GOGGLE_OFF: Material = { ramp: ramp('#2a1a0a', '#4a3216', '#6a4c26'), outline: hex('#1a0e04'), shine: true };
const STEAM: Material = { ramp: ramp('#8a96a6', '#c0cad6', '#e6ecf2', '#ffffff'), outline: hex('#4a5462'), noAO: true, noOutline: true, emissive: 0.15 };
const SNORE: Material = { ramp: ramp('#8ad8f0', '#d8f6ff'), outline: hex('#0a2a36'), emissive: 0.8, noAO: true, noOutline: true };

export interface MechLook {
  /** Texture key; animations are `${key}_${anim}_${dir}`. */
  key: string;
  /** The Scrap Titan: everything made of junk. */
  scrap: boolean;
}

export const MECH_LOOK: MechLook = { key: 'mech', scrap: false };
export const SCRAP_LOOK: MechLook = { key: 'mech_scrap', scrap: true };
export const MECH_LOOKS = [MECH_LOOK, SCRAP_LOOK];

/** The look being drawn; set by buildMechFrames. */
let L: MechLook = MECH_LOOK;
/** The frame being drawn will be mirrored (facing right): writing is drawn backwards so it reads right. */
let FLIP = false;

type View = 'down' | 'up' | 'side';

export interface MechPose {
  /** Hull raised (walk) or lowered (+crouch), in px. */
  bob: number;
  crouch: number;
  /** Feet: lifted off the ground (all views), and in the side view stepped forward (+) or back. */
  liftA: number;
  liftB: number;
  strideA: number;
  strideB: number;
  /** Each cannon pulled back by its recoil, and flashing at the muzzle. */
  recoilA: number;
  recoilB: number;
  flashA: boolean;
  flashB: boolean;
  /** 0..1: the stabiliser legs let down (siege). */
  stab: number;
  /** 0..1: the missile pods on the shoulders open. */
  pods: number;
  /** The vents blowing out heat (overheat). */
  vent: number;
  /** Scrap: the drill's turn (0..3) and the claw opened 0..1; the OPEN sign planted. */
  drill: number;
  claw: number;
  sign: boolean;
  /** The idle moment: how lit the lamps (and goggles) are, 1 as always, 0 off, over 1 flaring as it reboots. */
  power: number;
  /** The pilot's (or goblin's) head nodded down, px; the arms hung lower as it slumps, px. */
  nod: number;
  sag: number;
  /** Steam: the chimney's puff (a stage of PUFFS), the hiss out of the hips (a stage of JETS), a snore (0 none, 1 small z, 2 big z). */
  puff: number;
  jets: number;
  snore: number;
}

const base = (): MechPose => ({ bob: 0, crouch: 0, liftA: 0, liftB: 0, strideA: 0, strideB: 0, recoilA: 0, recoilB: 0, flashA: false, flashB: false, stab: 0, pods: 0, vent: 0, drill: 0, claw: 0.3, sign: false, power: 1, nod: 0, sag: 0, puff: 0, jets: 0, snore: 0 });

// ---------------------------------------------------------------------------
// Drawing helpers

/** A box with its corners cut by `cham`, shaded like a slab curving round its width. */
function slab(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, m: Material, cham = 1.5, tilt = 0.2): void {
  c.shape(Math.round(y0), Math.round(y1), (y) => {
    const d = Math.min(y + 0.5 - y0, y1 + 0.5 - y - 0.5);
    const cut = d < cham ? cham - d : 0;
    return [x0 + cut, x1 + 1 - cut];
  }, m, (_x, _y, t, u) => cyl(t * 0.8, tilt - u * 0.35));
}

/** Hazard stripes on a band. */
function hazard(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, n: Vec3 = { x: 0, y: 0.1, z: 1 }): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (((x + y) >> 1) % 2 === 0) c.px(x, y, HAZARD, n);
}

/** A leg from the hip to the foot, the knee bending out (front and back) or back like a bird's (side). */
function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, kneeOut: number, foot: 'plate' | 'tyre' | 'boot', view: View): void {
  const kx = (hx + fx) / 2 + kneeOut;
  const ky = (hy + fy) / 2 - 1;
  const scrap = L.scrap;
  c.part();
  c.capsule(hx, hy, kx, ky, 2.2, 2, scrap ? COPPER : GUNMETAL);
  if (scrap) {
    // A coil spring for a knee.
    for (let i = -2; i <= 2; i++) c.ellipse(kx, ky + i, 2.2, 0.7, i % 2 ? RUST : COPPER, { flatten: 0.6 });
  } else c.ellipse(kx, ky, 2.2, 2.2, JOINT);
  c.capsule(kx, ky, fx, fy - 2, 2.4, 2.1, scrap ? COPPER : PLATE);
  c.part();
  if (foot === 'tyre') {
    if (view === 'side') {
      c.ellipse(fx, fy - 2.5, 3.6, 3.2, RUBBER);
      c.ellipse(fx, fy - 2.5, 1.4, 1.2, STEEL);
    } else {
      c.ellipse(fx, fy - 1.5, 3.2, 2.2, RUBBER, { flatten: 0.8 });
      for (let x = Math.round(fx - 2); x <= fx + 2; x += 2) c.px(x, Math.round(fy - 2), RUBBER, { x: 0, y: 0.6, z: 0.8 }, { bias: 1 });
    }
    return;
  }
  const w = foot === 'boot' ? 3 : 3.8;
  const back = view === 'side' ? 2.5 : w;
  const front = view === 'side' ? 4.5 : w;
  // Front and back views: a flat foot either side of the ankle. Side view: a long toe forward (left) and a short heel.
  c.shape(Math.round(fy - 3), Math.round(fy - 1), (y) => {
    const top = y < fy - 2.5 ? 1 : 0;
    return [fx - front + top, fx + back - top];
  }, GUNMETAL, (_x, _y, t, u) => sphere(t * 0.7, u * 0.8 - 0.4, 0.9));
  if (foot === 'plate') {
    // Toes: dark cuts across the front.
    if (view === 'down') for (const dx of [-1.5, 1.5]) c.px(Math.round(fx + dx), Math.round(fy - 1), JOINT, { x: 0, y: -0.5, z: 0.8 });
    if (view === 'side') c.px(Math.round(fx - 3), Math.round(fy - 1), JOINT);
  }
}

/** A stabiliser strut let down from the hull to the ground, with a claw foot. */
function strut(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  c.capsule(x0, y0, x1, y1 - 1, 1.5, 1.3, L.scrap ? RUST : GUNMETAL);
  c.px(Math.round(x1 - 1), Math.round(y1), JOINT);
  c.px(Math.round(x1), Math.round(y1), JOINT);
  c.px(Math.round(x1 + 1), Math.round(y1), JOINT);
}

/** The glass dome with the pilot inside, the glass drawn only round its rim and in a glint so he shows through. */
function dome(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, pilot: (c: PixelCanvas) => void): void {
  c.part();
  c.ellipse(cx, cy + 0.5, rx + 0.6, ry + 0.6, GUNMETAL);
  c.part();
  // The cabin's dark inside.
  c.ellipse(cx, cy, rx, ry, JOINT);
  pilot(c);
  c.part();
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const rim = d > 0.62;
      const glint = Math.abs(dx + dy + 0.55) < 0.22 && dy < 0.2;
      if (rim || glint) c.px(x, y, GLASS, sphere(dx, dy, 1.2), { bias: glint ? 2 : 0 });
    }
  }
}

/** A 3x5 letter for the scrap's sign. */
const GLYPHS: Record<string, string[]> = {
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  E: ['111', '100', '110', '100', '111'],
  N: ['101', '111', '111', '111', '101'],
};

function sign(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.capsule(x + 8, y + 6, x + 8, GROUND - 0.5, 0.8, 0.8, WOOD);
  c.part();
  for (let yy = y; yy <= y + 7; yy++) for (let xx = x; xx <= x + 16; xx++) c.px(xx, yy, WOOD, { x: 0, y: 0.1, z: 1 }, { bias: (xx + yy * 3) % 7 === 0 ? -1 : 0 });
  c.part();
  let lx = x + 1;
  for (const ch of FLIP ? 'NEPO' : 'OPEN') {
    GLYPHS[ch].forEach((row, r) => [...row].forEach((b, k) => b === '1' && c.px(lx + (FLIP ? 2 - k : k), y + 1 + r, PAINT, { x: 0, y: 0, z: 1 })));
    lx += 4;
  }
}

// ---------------------------------------------------------------------------
// The front view (facing the viewer, 'down') and the back ('up')

function drawFront(c: PixelCanvas, p: MechPose, back: boolean): void {
  const scrap = L.scrap;
  const hb = 29 - p.bob + p.crouch;
  const ht = hb - 15;

  // The scrap's sign, planted behind him at his side.
  if (p.sign && L.scrap) sign(c, CX + 12, GROUND - 25);
  // Stabilisers, spread out to either side, behind everything.
  if (p.stab > 0) {
    c.part();
    for (const s of [-1, 1]) strut(c, CX + s * 9, hb - 2, CX + s * (10 + 9 * p.stab), GROUND - (1 - p.stab) * 9);
  }
  // The smokestack (or the bent stovepipe) behind the hull, and the idle moment's hiss from behind the hips.
  if (!back) chimney(c, ht, false);
  // The cannons behind, in the back view: their barrels stand up past the shoulders.
  if (back) for (const s of [-1, 1]) backGun(c, CX + s * MECH_GUN_X, ht, s < 0 ? p.recoilA : p.recoilB);

  // Legs.
  const feet: ['plate' | 'tyre' | 'boot', 'plate' | 'tyre' | 'boot'] = scrap ? (back ? ['boot', 'tyre'] : ['tyre', 'boot']) : ['plate', 'plate'];
  leg(c, CX - 5, hb, CX - 8, GROUND - p.liftA, -2, feet[0], back ? 'up' : 'down');
  leg(c, CX + 5, hb, CX + 8, GROUND - p.liftB, 2, feet[1], back ? 'up' : 'down');

  // The hull.
  c.part();
  if (scrap) barrel(c, CX - 9.5, CX + 9.5, ht - 1, hb + 1, back, p.power, p.nod);
  else {
    slab(c, CX - 11, ht, CX + 11, hb, PLATE, 2.5);
    c.part();
    // A dark belly plate over the hips, and hazard stripes along the bottom.
    hazard(c, CX - 9, CX + 9, hb - 3, hb - 2);
    if (back) {
      // The engine's vents, glowing (blazing when it overheats).
      c.part();
      for (let i = 0; i < 3; i++) {
        const y = ht + 5 + i * 2;
        for (let x = CX - 6; x <= CX + 6; x++) c.px(x, y, VENT, { x: 0, y: -0.4, z: 0.9 }, { glow: 0.5 + p.vent * 0.5, bias: p.vent > 0.5 ? 1 : 0 });
      }
      slab(c, CX - 3, ht + 1, CX + 3, ht + 3, GUNMETAL, 1);
    } else {
      // Headlamps either side of the dome (dimmed, dark or flaring in the idle moment).
      const [lamp, lo] = lit(LAMP, LAMP_OFF, p.power);
      for (const x of [CX - 8, CX - 7, CX + 7, CX + 8]) c.px(x, ht + 8, lamp, undefined, lo);
      if (p.power > 1) for (const x of [CX - 7.5, CX + 7.5]) flare(c, x, ht + 8.5, p.power - 1);
      // Rivets.
      for (const [x, y] of [[CX - 9, ht + 3], [CX + 9, ht + 3], [CX - 9, hb - 5], [CX + 9, hb - 5]]) c.px(x, y, GUNMETAL, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
      dome(c, CX, ht + 5.5, 5.5, 4.2, (cc) => {
        cc.ellipse(CX, ht + 6.5 + p.nod, 2.8, 2.6, HELMET);
        for (let x = CX - 2; x <= CX + 2; x++) cc.px(x, Math.round(ht + 7 + p.nod), PILOT_VISOR, { x: 0, y: 0.2, z: 1 });
      });
    }
  }
  if (back) chimney(c, ht, true);

  // Arms.
  if (scrap) {
    // Front: the claw on the left, the drill on the right; the back swaps them.
    const clawX = back ? CX + 12 : CX - 12;
    const drillX = back ? CX - 12 : CX + 12;
    arm(c, clawX, ht + 4, back ? 1 : -1, p.sag);
    arm(c, drillX, ht + 4, back ? -1 : 1, p.sag);
    if (!back) {
      claw(c, clawX - 1, ht + 12 - p.recoilA + p.sag, p.claw, p.flashA);
      drill(c, drillX + 1, ht + 12 - p.recoilB + p.sag, p.drill, p.flashB);
    } else {
      c.part();
      c.ellipse(clawX + 1, ht + 11, 2.2, 2, STEEL);
      c.ellipse(drillX - 1, ht + 11, 2.2, 2, STEEL);
    }
  } else {
    for (const s of [-1, 1]) {
      const sx = CX + s * MECH_GUN_X;
      const recoil = s < 0 ? p.recoilA : p.recoilB;
      const flash = s < 0 ? p.flashA : p.flashB;
      c.part();
      c.ellipse(sx, ht + 4, 3.6, 3.2, PLATE);
      if (p.pods > 0) pod(c, sx, ht + 1, p.pods);
      if (!back) {
        c.part();
        const gy = ht - recoil + p.sag;
        slab(c, sx - 2.5, gy + 6, sx + 2.5, gy + 13, GUNMETAL, 1);
        c.ellipse(sx, gy + 13.5, 2.4, 1.4, JOINT);
        c.px(Math.round(sx - 0.5), Math.round(gy + 13.5), HAZARD);
        if (flash) muzzle(c, sx, ht + 15.5 - recoil, 0, 1);
      }
    }
  }

  // The scrap's cone on top, drawn last so it sits over the lid.
  if (scrap) {
    c.part();
    cone(c, CX - 1, ht - 1);
    // His ears, poking out of holes in the lid.
    for (const s of [-1, 1]) {
      const x0 = CX + s * 6;
      for (let i = 0; i < 4; i++) c.px(Math.round(x0 + s * i), Math.round(ht - 1 - i * 0.6), GOBLIN, sphere(s * 0.3, 0.5, 1), { bias: i === 3 ? 1 : 0 });
    }
  }
  if (p.vent > 0) steam(c, p.vent, ht, back);
  if (p.puff > 0 && !back) puff(c, ht, p.puff);
  if (p.jets > 0) jets(c, hb, p.jets);
  if (p.snore > 0) snore(c, ht, p.snore);
}

/** How the rest's lamps burn at `power`: the lit material as always at 1, dimmed below, dark when off, flaring above. */
function lit(on: Material, off: Material, power: number): [Material, DrawOpts | undefined] {
  if (power === 1) return [on, undefined];
  if (power < POWER_OFF) return [off, undefined];
  return [on, { glow: Math.min(1, power) * (on.emissive ?? 1), bias: power > 1 ? 1 : power < 0.75 ? -1 : 0 }];
}

/** A lamp flaring back on: a little cross of light. */
function flare(c: PixelCanvas, x: number, y: number, k: number): void {
  const hot: RGB = [255, 240, 190];
  c.spark(x, y, hot, 0.6 * k + 0.3);
  for (let i = 1; i <= 3; i++) {
    const a = (0.75 - i * 0.2) * Math.min(1, k * 2);
    for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) c.spark(x + dx, y + dy, hot, a);
  }
}

/**
 * The steam the rest lets off from its chimney, by stage: a gasp at the
 * mouth, a column, a cloud rolling off to the side, then wisps thinning away.
 * Offsets from the chimney's mouth: [dx, dy, radius, solid 0..1].
 */
const PUFFS: [number, number, number, number][][] = [
  [],
  [[0, -1, 1.2, 1]],
  [[0, -1, 1.5, 1], [0.8, -3.5, 2, 1]],
  [[0.5, -1.5, 1.3, 1], [1.8, -4, 2.3, 1], [4.2, -4.8, 2.4, 1]],
  [[2.5, -4, 1.8, 0.6], [5.5, -5, 2.6, 0.8], [8.5, -4.2, 1.8, 0.6]],
  [[6.5, -5, 2.2, 0.45], [10, -4.5, 2, 0.35]],
];

function puff(c: PixelCanvas, ht: number, stage: number): void {
  // The smokestack's mouth, or the stovepipe's bent end.
  const mx = L.scrap ? CX + 10.5 : CX + 6.5;
  const my = L.scrap ? ht - 7.5 : ht - 6.5;
  c.part();
  for (const [dx, dy, r, solid] of PUFFS[stage]) {
    const cx = mx + dx;
    const cy = Math.max(r, my + dy);
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const nx = (x + 0.5 - cx) / r;
        const ny = (y + 0.5 - cy) / r;
        if (nx * nx + ny * ny > 1) continue;
        // Thinning steam falls apart into a dither, from its edge in.
        const d2 = nx * nx + ny * ny;
        if (solid < 1 && (d2 > 0.35 + solid || ((x + y) & 1 && d2 > solid * 0.6))) continue;
        c.px(x, y, STEAM, sphere(nx, ny, 0.9), { bias: ny < -0.3 ? 1 : 0 });
      }
  }
}

/** Jets of steam hissing out under the hull, low and to either side: stage 1 a burst, 2 blown out and thinning. */
function jets(c: PixelCanvas, hb: number, stage: number): void {
  c.part();
  const white: RGB = [235, 240, 248];
  for (const s of [-1, 1]) {
    const len = stage === 1 ? 6 : 9;
    for (let i = 0; i < len; i++) {
      const x = CX + s * (9 + i);
      const y = hb + 2 - i * 0.3 - (stage === 2 ? i * 0.25 : 0);
      const w = i < 2 ? 0 : i < 5 ? 1 : 1.5;
      for (let d = -w; d <= w; d++) {
        if (stage === 2 && (i + d) % 2 === 0) continue;
        c.px(x, y + d, STEAM, sphere(0, d / 2, 1), { bias: d < 0 ? 1 : 0 });
      }
      c.spark(x, y, white, stage === 1 ? 0.25 : 0.12);
    }
  }
}

/** A snore rising off the dozing pilot: a small z, then a bigger one further up. */
function snore(c: PixelCanvas, ht: number, stage: number): void {
  c.part();
  const glyph = stage === 1 ? ['111', '010', '111'] : ['1111', '0010', '0100', '1111'];
  const x0 = CX - (stage === 1 ? 7 : 10);
  const y0 = ht - (stage === 1 ? 3 : 7);
  glyph.forEach((row, r) => [...row].forEach((b, k) => b === '1' && c.px(x0 + k, y0 + r, SNORE, FLAT)));
}

/** The smokestack at the mech's back, or the scrap's crooked stovepipe. */
function chimney(c: PixelCanvas, ht: number, front: boolean): void {
  c.part();
  const x = CX + 6;
  if (L.scrap) {
    c.capsule(x, ht + 1, x + 1, ht - 5, 1.3, 1.3, RUST);
    c.capsule(x + 1, ht - 5, x + 4, ht - 7, 1.3, 1.3, RUST);
    c.ellipse(x + 4.5, ht - 7, 1.5, 1.5, JOINT);
    return;
  }
  c.shape(Math.round(ht - 6), Math.round(ht + (front ? 3 : 1)), () => [x - 1.5, x + 2.5], GUNMETAL, (_x, _y, t) => cyl(t, 0.3));
  c.ellipse(x + 0.5, ht - 6, 2.3, 1, JOINT, { flatten: 0.5 });
}

/** A cannon seen from behind: a barrel standing up past the shoulder. */
function backGun(c: PixelCanvas, sx: number, ht: number, recoil: number): void {
  if (L.scrap) return;
  c.part();
  slab(c, sx - 2, ht - 3 + recoil, sx + 2, ht + 4, GUNMETAL, 1);
}

/** A copper-pipe arm from the shoulder, for the scrap. */
function arm(c: PixelCanvas, x: number, y: number, s: number, sag = 0): void {
  c.part();
  c.ellipse(x, y, 3, 2.6, RUST);
  c.capsule(x, y + 1, x + s, y + 7 + sag, 1.6, 1.6, COPPER);
}

/** The crane claw, three prongs, opened `open`. */
function claw(c: PixelCanvas, x: number, y: number, open: number, flash: boolean): void {
  c.part();
  c.ellipse(x, y, 2.6, 2, GUNMETAL);
  const o = 1 + open * 2.5;
  c.capsule(x - 1, y + 1, x - o - 1, y + 5, 1, 0.7, STEEL);
  c.capsule(x + 1, y + 1, x + o + 1, y + 5, 1, 0.7, STEEL);
  c.capsule(x, y + 1, x, y + 6, 1, 0.7, STEEL);
  if (flash) muzzle(c, x, y + 7.5, 0, 1);
}

/** The drill, pointing at the viewer: a steel cone ringed with a turning spiral. */
function drill(c: PixelCanvas, x: number, y: number, turn: number, flash: boolean): void {
  c.part();
  c.ellipse(x, y, 2.8, 1.8, GUNMETAL);
  c.shape(Math.round(y + 1), Math.round(y + 9), (yy) => {
    const k = (yy - y - 1) / 8;
    const hw = 3.4 * (1 - k) + 0.3;
    return [x - hw, x + hw];
  }, STEEL, (_x, yy, t) => cyl(t, 0.1 - (yy - y) * 0.05));
  // The spiral: a dark groove winding down it, turning frame by frame.
  for (let yy = Math.round(y + 1); yy <= y + 8; yy++) {
    const k = (yy - y - 1) / 8;
    const off = (((yy + turn) % 4) / 3) * 2 - 1;
    c.shade(Math.round(x + off * 3 * (1 - k)), yy, -2);
  }
  if (flash) muzzle(c, x, y + 10.5, 0, 1);
}

/** A missile pod opening on a shoulder: little red warheads showing in its mouth. */
function pod(c: PixelCanvas, sx: number, y: number, open: number): void {
  c.part();
  slab(c, sx - 3, y - 3, sx + 3, y + 1, GUNMETAL, 1);
  if (open > 0.3) {
    c.part();
    for (const dx of [-1.5, 1.5]) c.px(Math.round(sx + dx), Math.round(y - 2), HELMET, { x: 0, y: 0.5, z: 0.9 }, { glow: 0.3 });
    c.px(Math.round(sx), Math.round(y - 3), LAMP, { x: 0, y: 1, z: 0 }, { glow: open });
  }
}

/** A flash of fire out of a muzzle, pointing (dx, dy). */
function muzzle(c: PixelCanvas, x: number, y: number, dx: number, dy: number): void {
  const core: RGB = [255, 250, 220];
  const hot: RGB = [255, 200, 90];
  const mid: RGB = [255, 120, 40];
  const px = -dy;
  const py = dx;
  for (let i = 0; i < 5; i++) {
    const w = i < 2 ? 1.5 : 2.5 - (i - 2) * 0.8;
    for (let s = -w; s <= w; s += 0.5) c.spark(x + dx * i + px * s, y + dy * i + py * s, Math.abs(s) < 0.7 ? core : Math.abs(s) < 1.5 ? hot : mid, 1 - i * 0.12);
  }
}

/** Steam blowing off the overheating hull. */
function steam(c: PixelCanvas, k: number, ht: number, back: boolean): void {
  const white: RGB = [230, 236, 244];
  const pts: [number, number][] = back ? [[-6, 3], [0, 2], [6, 3], [-3, 0], [3, 0]] : [[-11, 1], [11, 1], [-12, -2], [12, -2], [0, -3]];
  pts.forEach(([dx, dy], i) => {
    const r = 1 + k * 1.5 + (i % 2);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) c.spark(CX + dx + x, ht + dy - k * 3 + y, white, 0.35 * k);
  });
}

/** The oil-barrel body: ribbed and dented, rust streaking down it, a porthole with the goblin in it (front). */
function barrel(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, back: boolean, power = 1, nod = 0): void {
  c.shape(Math.round(y0), Math.round(y1), () => [x0, x1 + 1], RUST, (_x, _y, t) => cyl(t, 0.18));
  c.part();
  // Two raised ribs and the rolled rim at the top.
  for (const y of [Math.round(y0 + 4), Math.round(y1 - 4)]) for (let x = Math.round(x0); x <= x1; x++) c.px(x, y, RUST, cyl(((x + 0.5 - x0) / (x1 - x0)) * 2 - 1, 0.6), { bias: 1 });
  c.ellipse((x0 + x1) / 2 + 0.5, y0, (x1 - x0) / 2 + 0.5, 1.4, RUST, { flatten: 0.4 });
  // Dents and streaks.
  for (const [x, y] of [[x0 + 3, y0 + 7], [x0 + 4, y0 + 8], [x1 - 3, y1 - 7], [x1 - 2, y0 + 2]]) c.shade(Math.round(x), Math.round(y), -1);
  for (const x of [x0 + 5, x1 - 5]) for (let y = Math.round(y0 + 5); y < y0 + 9; y++) c.shade(Math.round(x), y, -1);
  if (back) {
    // A patch riveted over a hole.
    c.part();
    slab(c, x0 + 4, y0 + 6, x0 + 9, y0 + 10, GUNMETAL, 0.5);
    for (const [x, y] of [[x0 + 4, y0 + 6], [x0 + 9, y0 + 6], [x0 + 4, y0 + 10], [x0 + 9, y0 + 10]]) c.px(Math.round(x), Math.round(y), STEEL);
    return;
  }
  // The porthole, and the goblin behind it.
  const cx = (x0 + x1) / 2 + 0.5;
  const cy = y0 + 7;
  c.part();
  c.ellipse(cx, cy, 4.6, 4.3, COPPER);
  c.part();
  c.ellipse(cx, cy, 3.4, 3.2, GOBLIN);
  c.part();
  // Welding goggles over his eyes, and a grin with one tooth.
  // (In the idle moment he nods off: his head drops and the goggles go dark.)
  const [gog, go] = lit(GOGGLE, GOGGLE_OFF, power);
  const gy = cy - 0.6 + nod;
  for (const dx of [-1.6, 1.4]) c.ellipse(cx + dx, gy, 1.2, 1.1, gog, go);
  for (let x = Math.round(cx - 2); x <= cx + 1; x++) c.px(x, Math.round(cy - 0.5 + nod), JOINT, { x: 0, y: 0, z: 1 });
  c.px(Math.round(cx - 1.6), Math.round(gy), gog, undefined, go);
  c.px(Math.round(cx + 1.4), Math.round(gy), gog, undefined, go);
  if (power > 1) for (const dx of [-1.6, 1.4]) flare(c, cx + dx, gy + 0.5, power - 1);
  for (let x = Math.round(cx - 1.5); x <= cx + 1.5; x++) c.px(x, Math.round(cy + 1.6 + nod), JOINT, { x: 0, y: 0, z: 1 });
  c.px(Math.round(cx + 0.5), Math.round(cy + 1.6 + nod), TOOTH);
  // A glint on the porthole's glass.
  c.px(Math.round(cx - 2.2), Math.round(cy - 2.2), GLASS, { x: -0.5, y: 0.5, z: 0.7 }, { bias: 2 });
}

/** The traffic cone hat, its tip at the top and a white band round it. */
function cone(c: PixelCanvas, x: number, base: number): void {
  const top = base - 9;
  c.shape(top, base, (y) => {
    const k = (y - top) / (base - top);
    const hw = 0.6 + k * 4;
    return [x + 0.5 - hw, x + 0.5 + hw];
  }, CONE, (_x, y, t) => cyl(t, 0.35 - (y - top) * 0.02));
  for (let y = top + 4; y <= top + 5; y++) {
    const k = (y - top) / (base - top);
    const hw = 0.6 + k * 4;
    for (let xx = Math.round(x + 0.5 - hw); xx < x + 0.5 + hw; xx++) c.px(xx, y, CONE_BAND, cyl(((xx + 0.5 - x - 0.5) / hw), 0.3));
  }
  // The square rubber foot it stands on.
  c.shape(base, base + 1, () => [x - 4.5, x + 5.5], RUBBER, (_x, _y, t) => cyl(t, 0.5));
}

// ---------------------------------------------------------------------------
// The side view, facing left

function drawSide(c: PixelCanvas, p: MechPose): void {
  const scrap = L.scrap;
  const hb = 29 - p.bob + p.crouch;
  const ht = hb - 15;

  if (p.stab > 0) {
    c.part();
    strut(c, CX - 7, hb - 1, CX - 9 - 8 * p.stab, GROUND - (1 - p.stab) * 9);
    strut(c, CX + 7, hb - 1, CX + 9 + 8 * p.stab, GROUND - (1 - p.stab) * 9);
  }
  // The far cannon (or the drill), behind the hull.
  if (scrap) {
    arm(c, CX + 1, ht + 5, -1);
    c.part();
    sideDrill(c, CX - 3, ht + 12, p.recoilB, p.drill, p.flashB);
  } else sideGun(c, CX + 1, ht + 3, p.recoilB, p.flashB, true);
  // Far leg, then the near.
  leg(c, CX + 2, hb, CX + 1 + p.strideB, GROUND - p.liftB, 3, scrap ? 'boot' : 'plate', 'side');
  // The chimney at the back.
  chimney(c, ht, false);
  // The hull.
  c.part();
  if (scrap) {
    barrelSide(c, ht, hb);
  } else {
    slab(c, CX - 9, ht, CX + 9, hb, PLATE, 2.5);
    c.part();
    hazard(c, CX - 7, CX + 8, hb - 3, hb - 2);
    // The engine grille at the back.
    for (let y = ht + 5; y <= ht + 9; y += 2) for (let x = CX + 5; x <= CX + 7; x++) c.px(x, y, VENT, { x: 0.5, y: 0, z: 0.8 }, { glow: 0.5 + p.vent * 0.5 });
    c.px(CX - 8, ht + 9, LAMP);
    c.px(CX - 8, ht + 10, LAMP);
    dome(c, CX - 5, ht + 5, 4, 4, (cc) => {
      cc.ellipse(CX - 5, ht + 6, 2.4, 2.5, HELMET);
      cc.px(CX - 7, ht + 6, PILOT_VISOR);
      cc.px(CX - 7, ht + 7, PILOT_VISOR);
      cc.px(CX - 6, ht + 6, PILOT_VISOR);
    });
    if (p.pods > 0) pod(c, CX + 2, ht + 1, p.pods);
  }
  leg(c, CX - 1, hb, CX - 2 + p.strideA, GROUND - p.liftA, 3, scrap ? 'tyre' : 'plate', 'side');
  // The near cannon (or the claw).
  if (scrap) {
    arm(c, CX + 1, ht + 6, -1);
    c.part();
    sideClaw(c, CX - 4, ht + 15, p.recoilA, p.claw, p.flashA);
    c.part();
    cone(c, CX - 1, ht - 1);
    // An ear out of the lid.
    for (let i = 0; i < 4; i++) c.px(Math.round(CX + 4 + i), Math.round(ht - 1 - i * 0.6), GOBLIN, sphere(0.3, 0.5, 1));
  } else sideGun(c, CX + 1, ht + 10, p.recoilA, p.flashA, false);
  if (p.sign && L.scrap) sign(c, CX + 8, GROUND - 17);
  if (p.vent > 0) steam(c, p.vent, ht, false);
}

/** A cannon arm seen side on, pointing left. */
function sideGun(c: PixelCanvas, sx: number, sy: number, recoil: number, flash: boolean, far: boolean): void {
  c.part();
  c.ellipse(sx, sy, 3.4, 3.2, PLATE, { flatten: far ? 0.7 : 1 });
  c.part();
  const x0 = sx - 14 + recoil;
  c.shape(Math.round(sy - 1), Math.round(sy + 2), () => [x0, sx + 1], GUNMETAL, (_x, _y, _t, u) => cyl(u * 2 - 1, 0.1));
  c.ellipse(x0, sy + 0.5, 1, 2, JOINT);
  if (far) for (let x = Math.round(x0); x <= sx; x++) for (let y = Math.round(sy - 1); y <= sy + 2; y++) c.shade(x, y, -1);
  if (flash) muzzle(c, x0 - 2, sy + 0.5, -1, 0);
}

function sideClaw(c: PixelCanvas, x: number, y: number, recoil: number, open: number, flash: boolean): void {
  const cx = x + recoil;
  c.ellipse(cx + 1, y, 2.2, 2.4, GUNMETAL);
  const o = 1 + open * 2.2;
  c.capsule(cx - 1, y - 1, cx - 5, y - 1 - o, 0.9, 0.6, STEEL);
  c.capsule(cx - 1, y + 1, cx - 5, y + 1 + o, 0.9, 0.6, STEEL);
  if (flash) muzzle(c, cx - 6, y, -1, 0);
}

function sideDrill(c: PixelCanvas, x: number, y: number, recoil: number, turn: number, flash: boolean): void {
  const cx = x + recoil;
  c.ellipse(cx + 1, y, 1.8, 2.6, GUNMETAL);
  c.shape(Math.round(y - 2), Math.round(y + 2), (yy) => [cx - 7 + Math.abs(yy - y) * 2.2, cx], STEEL, (_x, _y, _t, u) => cyl(u * 2 - 1, 0));
  for (let xx = Math.round(cx - 6); xx < cx; xx++) if ((xx + turn) % 3 === 0) for (let yy = Math.round(y - 2); yy <= y + 2; yy++) c.shade(xx, yy, -2);
  if (flash) muzzle(c, cx - 8, y, -1, 0);
}

/** The barrel side on, the porthole on its front with the goblin in profile (a long nose). */
function barrelSide(c: PixelCanvas, ht: number, hb: number): void {
  barrel(c, CX - 8, CX + 8, ht - 1, hb + 1, true);
  const cx = CX - 5;
  const cy = ht + 6;
  c.part();
  c.ellipse(cx, cy, 3, 3.6, COPPER);
  c.part();
  c.ellipse(cx, cy, 2, 2.6, GOBLIN);
  c.part();
  c.ellipse(cx - 0.5, cy - 0.7, 1.2, 1.1, GOGGLE);
  // His nose, poking out past the porthole.
  c.capsule(cx - 1.5, cy + 0.5, cx - 4.5, cy + 1.2, 0.9, 0.6, GOBLIN);
  c.px(Math.round(cx - 1), Math.round(cy + 2), JOINT);
  c.px(Math.round(cx), Math.round(cy + 2), TOOTH);
}

// ---------------------------------------------------------------------------
// Animations

export type MechAnim = 'idle' | 'walk' | 'fireA' | 'fireB' | 'aim' | 'launch' | 'deploy' | 'siege' | 'vent' | 'rest';

interface AnimDef {
  name: MechAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => MechPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

const idle = (): MechPose[] =>
  [0, 0, 1, 1].map((b, i) => {
    const p = base();
    p.crouch = b;
    p.drill = i;
    p.claw = 0.3 + (i % 2) * 0.1;
    return p;
  });

/** A heavy stride: each foot lifts, swings and stamps down, the hull rolling over it. */
const walk = (view: View): MechPose[] =>
  Array.from({ length: 6 }, (_, i) => {
    const p = base();
    const a = (i / 6) * Math.PI * 2;
    const s = Math.sin(a);
    p.bob = Math.round(Math.abs(Math.cos(a)) * 1);
    p.liftA = Math.max(0, Math.round(s * 3));
    p.liftB = Math.max(0, Math.round(-s * 3));
    if (view === 'side') {
      p.strideA = Math.round(-Math.cos(a) * 4);
      p.strideB = Math.round(Math.cos(a) * 4);
    }
    p.drill = i % 3;
    return p;
  });

/** One cannon fires: it kicks back and flashes, the hull rocking on its legs. */
const fire = (which: 'A' | 'B') => (): MechPose[] =>
  [3, 2, 1, 0].map((r, i) => {
    const p = base();
    if (which === 'A') {
      p.recoilA = r;
      p.flashA = i === 0;
    } else {
      p.recoilB = r;
      p.flashB = i === 0;
    }
    p.crouch = i < 2 ? 1 : 0;
    p.claw = which === 'A' && i < 2 ? 1 : 0.3;
    p.drill = i;
    return p;
  });

/** Painting targets: braced, the missile pods open, humming. */
const aim = (): MechPose[] =>
  [0, 1].map((i) => {
    const p = base();
    p.crouch = 1;
    p.pods = 1;
    p.claw = 0.7;
    p.drill = i * 2;
    return p;
  });

/** The pods loose their missiles. */
const launch = (): MechPose[] =>
  [1, 1, 0.6, 0.2].map((k, i) => {
    const p = base();
    p.pods = k;
    p.crouch = i < 2 ? 2 : 1;
    p.bob = 0;
    return p;
  });

/** Siege: the stabilisers come down and the hull settles onto them. Also the Special's pose. */
const deploy = (): MechPose[] =>
  [0.2, 0.5, 0.8, 1, 1].map((k, i) => {
    const p = base();
    p.stab = k;
    p.crouch = Math.round(k * 2);
    p.sign = i >= 3;
    p.claw = k;
    return p;
  });

/** Planted in siege, both guns hammering in turn. */
const siege = (): MechPose[] =>
  [0, 1, 2, 3].map((i) => {
    const p = base();
    p.stab = 1;
    p.crouch = 2;
    p.sign = true;
    p.recoilA = i === 0 ? 3 : i === 1 ? 1 : 0;
    p.recoilB = i === 2 ? 3 : i === 3 ? 1 : 0;
    p.flashA = i === 0;
    p.flashB = i === 2;
    p.drill = i;
    p.claw = i % 2;
    return p;
  });

/** Overheated: slumped, vents blazing and steam pouring off it. */
const vent = (): MechPose[] =>
  [1, 0.8, 0.6, 0.8].map((k) => {
    const p = base();
    p.vent = k;
    p.crouch = 2;
    p.claw = 1;
    return p;
  });

/**
 * The idle moment, facing the viewer only: it rises as the pressure builds,
 * lets off a great hiss of steam from its stack and hips, and powers down
 * into a slump, lamps dimming out and arms hanging, the pilot nodding off
 * with a snore. Then the lamps stutter back on, it jolts upright a touch too
 * tall, and settles.
 */
const rest = (view: View): MechPose[] => {
  if (view !== 'down') return [];
  const at = (o: Partial<MechPose>): MechPose => ({ ...base(), ...o });
  return [
    at({}),
    at({ bob: 1, puff: 1 }),
    at({ puff: 2, jets: 1, claw: 0.5 }),
    at({ crouch: 1, puff: 3, jets: 2, power: 0.8, claw: 0.6 }),
    at({ crouch: 2, puff: 4, sag: 1, power: 0.5, nod: 1, claw: 0.8 }),
    at({ crouch: 3, puff: 5, sag: 2, power: 0, nod: 1, claw: 1 }),
    at({ crouch: 3, sag: 2, power: 0, nod: 1, claw: 1 }),
    at({ crouch: 3, sag: 2, power: 0, nod: 1, claw: 1, snore: 1 }),
    at({ crouch: 3, sag: 2, power: 0, nod: 1, claw: 1, snore: 2 }),
    // Rebooting: the lamps flare, drop out, and catch.
    at({ crouch: 3, sag: 2, power: 1.6, claw: 1 }),
    at({ crouch: 3, sag: 1, power: 0, claw: 0.8 }),
    at({ crouch: 2, sag: 1, power: 1.3, claw: 0.6, drill: 1 }),
    at({ bob: 1, power: 1.1, claw: 0.2, drill: 2 }),
    at({ crouch: 1, claw: 0.3, drill: 3 }),
  ];
};

export const MECH_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 4, loop: true, poses: idle },
  { name: 'walk', fps: 9, loop: true, poses: walk },
  { name: 'fireA', fps: 24, loop: false, poses: fire('A') },
  { name: 'fireB', fps: 24, loop: false, poses: fire('B') },
  { name: 'aim', fps: 6, loop: true, poses: aim },
  { name: 'launch', fps: 14, loop: false, poses: launch },
  { name: 'deploy', fps: 12, loop: false, poses: deploy },
  { name: 'siege', fps: 20, loop: true, poses: siege },
  { name: 'vent', fps: 8, loop: true, poses: vent },
  { name: 'rest', fps: 8, loop: false, poses: rest, order: [0, 0, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7, 7, 6, 6, 8, 8, 8, 6, 6, 9, 10, 9, 10, 9, 11, 12, 13, 0] },
];

export interface MechFrame {
  key: string;
  anim: MechAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: MechPose): PixelCanvas {
  FLIP = dir === 'right';
  const c = new PixelCanvas(MECH_W, MECH_H);
  if (dir === 'down') drawFront(c, p, false);
  else if (dir === 'up') drawFront(c, p, true);
  else drawSide(c, p);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildMechFrames(look: MechLook = MECH_LOOK): MechFrame[] {
  L = look;
  const out: MechFrame[] = [];
  for (const a of MECH_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, pose) }));
    }
  }
  L = MECH_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons

/** The cannons: two barrels side by side, one flashing. */
export function cannonIcon(scrap = false): Uint8ClampedArray {
  const t: Tones = scrap ? [hex('#fffbe8'), hex('#d4dce8'), hex('#8a94a6'), hex('#4c5260')] : [hex('#fff0a0'), hex('#f4c040'), hex('#9aa4bc'), hex('#3e4458')];
  const fire: Tones = [hex('#fffbe8'), hex('#ffd860'), hex('#ff8a2a'), hex('#c83a10')];
  return icon16((put) => {
    if (scrap) {
      // A nail gun spitting nails.
      for (let x = 2; x <= 8; x++) for (let y = 7; y <= 10; y++) put(x, y, y === 7 ? t[1] : t[2]);
      for (let y = 10; y <= 14; y++) put(4, y, t[3]);
      for (let y = 10; y <= 14; y++) put(5, y, t[2]);
      for (const [x, y] of [[10, 6], [12, 9], [11, 12]]) {
        seg(put, x, y, x + 3, y - 1, t[1]);
        put(x + 3, y - 1, t[0]);
      }
      put(9, 8, fire[0]);
      put(9, 9, fire[1]);
      return;
    }
    for (const y0 of [3, 9]) {
      for (let x = 1; x <= 10; x++) for (let y = y0; y <= y0 + 3; y++) put(x, y, y === y0 ? t[2] : y === y0 + 3 ? t[3] : x < 4 ? t[1] : t[2]);
    }
    // The upper one fires.
    for (let i = 0; i < 5; i++) for (let s = -1; s <= 1; s++) put(11 + i, 4.5 + s * (i < 3 ? 1 : 0.5), s === 0 ? fire[0] : fire[1 + (i > 2 ? 1 : 0)]);
    put(12, 10, fire[2]);
  });
}

/** Lock-on salvo: a target reticle and missiles (or bottle rockets) curving in. */
export function salvoIcon(scrap = false): Uint8ClampedArray {
  const ring: Tones = scrap ? [hex('#ffffff'), hex('#ff8a8a'), hex('#e02020'), hex('#7a0e0e')] : [hex('#ffffff'), hex('#ffb0a0'), hex('#ff5a3a'), hex('#8a1e06')];
  const body: Tones = scrap ? [hex('#fff0f0'), hex('#ff5050'), hex('#c82020'), hex('#6a0a0a')] : [hex('#ffffff'), hex('#dfe6f0'), hex('#8a94a6'), hex('#4c5260')];
  return icon16((put) => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      put(10 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, ring[2]);
    }
    for (const [x0, y0, x1, y1] of [[10, 0, 10, 3], [10, 9, 10, 12], [4, 6, 7, 6], [13, 6, 15, 6]]) seg(put, x0, y0, x1, y1, ring[1]);
    put(10, 6, ring[0]);
    // Two missiles on their way in.
    for (const [x, y] of [[2, 13], [5, 15]]) {
      seg(put, x, y, x + 3, y - 3, body[1]);
      put(x + 3, y - 3, body[0]);
      put(x - 1, y + 1, hex('#ffd860'));
      put(x - 2, y + 2, hex('#ff8a2a'));
      if (scrap) put(x - 1, y, hex('#fff8c0'));
    }
  });
}

// ---------------------------------------------------------------------------
// What the mech fires: frames for sixteen headings (0 = right, turning
// clockwise), MECH_BOLT_SIZE square.

export const MECH_BOLT_SIZE = 14;
export const BOLT_DIRS = 16;
export type BoltKind = 'shell' | 'nail' | 'missile' | 'rocket';

const BRASS: Material = { ramp: ramp('#5a3a0e', '#a8761e', '#e8b440', '#fff0a0'), outline: hex('#1e1204'), shine: true };
const WARHEAD: Material = { ramp: ramp('#6a0e0a', '#c02a1a', '#ff6a4a'), outline: hex('#200404'), shine: true };
const MISSILE: Material = { ramp: ramp('#5a6070', '#aab4c4', '#eef2f8'), outline: hex('#141820'), shine: true };
const ROCKET: Material = { ramp: ramp('#6a0a0a', '#c82020', '#ff6060'), outline: hex('#200404'), shine: true };

/** One shot, turned to heading `i`: a brass tracer, a nail, a missile with fins and flame, or a bottle rocket on its stick. */
export function boltFrame(kind: BoltKind, i: number): PixelCanvas {
  const c = new PixelCanvas(MECH_BOLT_SIZE, MECH_BOLT_SIZE);
  const a = (i / BOLT_DIRS) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const m = MECH_BOLT_SIZE / 2;
  const at = (along: number, side = 0): [number, number] => [Math.floor(m + dx * along + px * side), Math.floor(m + dy * along + py * side)];
  const put = (along: number, mat: Material, side = 0) => {
    const [x, y] = at(along, side);
    c.px(x, y, mat, { x: -py * 0.3, y: px * 0.3 + 0.3, z: 0.9 });
  };
  const flame = (from: number, n: number) => {
    const cols: RGB[] = [[255, 250, 220], [255, 200, 90], [255, 120, 40], [200, 60, 20]];
    for (let k = 0; k < n; k++) {
      const [x, y] = at(from - k);
      c.spark(x, y, cols[Math.min(3, k)], 1 - k * 0.15);
    }
  };
  if (kind === 'shell') {
    for (let k = -1; k <= 2; k += 0.5) put(k, BRASS);
    const [x, y] = at(3);
    c.spark(x, y, [255, 250, 220], 1);
    for (let k = 1; k <= 4; k++) {
      const [tx, ty] = at(-1 - k);
      c.spark(tx, ty, [255, 190, 80], 0.6 - k * 0.12);
    }
  } else if (kind === 'nail') {
    for (let k = -2; k <= 2; k += 0.5) put(k, STEEL);
    for (const s of [-1, 1]) put(-2.5, STEEL, s);
    const [x, y] = at(2.5);
    c.spark(x, y, [240, 248, 255], 0.8);
  } else if (kind === 'missile') {
    for (let k = -3; k <= 2; k += 0.5) put(k, MISSILE);
    put(2.5, WARHEAD);
    put(3, WARHEAD);
    for (const s of [-1, 1]) {
      put(-2.5, WARHEAD, s);
      put(-3, WARHEAD, s * 1.5);
    }
    flame(-4, 3);
  } else {
    // A bottle rocket: a red tube with a paper cone, sparks spitting out behind, and its stick trailing.
    for (let k = -1.5; k <= 1.5; k += 0.5) put(k, ROCKET);
    put(2, CONE_BAND);
    put(2.5, CONE_BAND);
    for (let k = -2; k >= -5.5; k -= 0.5) put(k, WOOD, 1);
    flame(-2, 2);
    const [x, y] = at(-3, -1);
    c.spark(x, y, [255, 255, 180], 0.9);
  }
  return c;
}

/** The lock-on reticle painted over a target: a broken red ring with ticks and a centre pip. */
export function reticle(size = 13): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const put = (x: number, y: number, c: RGB) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    px.set([c[0], c[1], c[2], 255], (y * size + x) * 4);
  };
  const m = (size - 1) / 2;
  const red: RGB = [255, 70, 50];
  const hot: RGB = [255, 200, 180];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    // Four arcs, broken at the diagonals.
    if (Math.abs(Math.sin(2 * a)) > 0.75) continue;
    put(m + Math.cos(a) * (m - 1), m + Math.sin(a) * (m - 1), red);
  }
  for (let k = 0; k < 3; k++) {
    put(m, k, hot);
    put(m, size - 1 - k, hot);
    put(k, m, hot);
    put(size - 1 - k, m, hot);
  }
  put(m, m, hot);
  return px;
}
