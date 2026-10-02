// The Ballerina (the Automaton's third type): a clockwork music-box dancer
// come to life. A porcelain face with painted rosy cheeks and lashes, her
// hair in a bun; a bodice of pink enamel on a brass body, a band of turning
// gearwork at the waist; a tutu of fanned steel blades over pink tulle, and
// pointe shoes with their ribbons. A big wind-up key in her back turns as she
// dances: it is her mainspring (the Automaton's heat).
//
// Her Firebird skin (after Stravinsky's ballet) is a redesign on the same
// rig: crimson lacquer scaled in gold, a tutu of flame feathers whose tips
// glow, a plumed headdress, a train of long tail plumes, gilded clockwork and
// gold slippers, her eyes winged in gilt.
//
// Three views like every hero (down, up, and the side view drawn facing left
// and mirrored for right), but a frame mid-turn may be drawn facing another
// way (`face`): her pirouettes really turn.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB } from './pixel';
import { DIRS, type Dir } from './wizard';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

export const BALLET_W = 48;
export const BALLET_H = 50;
/** Drawn in the 24x32 body box every hero uses, placed in a larger frame (her kicks and splits reach out of it). */
const BODY_X = 12;
const BODY_Y = 12;
export const BALLET_ORIGIN_X = BODY_X + 12;
export const BALLET_ORIGIN_Y = BODY_Y + 31;
/** The tutu's height above her feet: where her blade rings are centred. */
export const BALLET_WAIST_Y = 12;
/** Her chest's height above the feet. */
export const BALLET_CHEST_Y = 15;

// ---------------------------------------------------------------------------
// Materials

const PORCELAIN: Material = { ramp: ramp('#7a5a5e', '#b89490', '#e2c6bc', '#f6e6dc', '#fffaf4'), outline: hex('#3a2226'), outlineLit: hex('#5a3a3a'), shine: true };
const BLUSH: Material = { ramp: ramp('#c04a64', '#e8708a', '#ff9ab0'), outline: hex('#3a2226'), noAO: true };
const LASH: Material = { ramp: ramp('#1a0c10', '#2e161c', '#4a2a30'), outline: hex('#0a0406'), noAO: true };
const LIPS: Material = { ramp: ramp('#8a1a30', '#c83a58', '#ec6a88'), outline: hex('#3a0a14'), noAO: true };
const HAIR: Material = { ramp: ramp('#1a0e0c', '#3a2018', '#5e3624', '#86523a', '#a87050'), outline: hex('#0c0606'), shine: true };
const ENAMEL: Material = { ramp: ramp('#5a1838', '#9a3868', '#d06898', '#f39ac4', '#ffd4ea'), outline: hex('#2a0a1a'), outlineLit: hex('#3a1026'), shine: true };
const BRASS: Material = { ramp: ramp('#3a2408', '#6e4812', '#a87424', '#d8aa48', '#f8e08e'), outline: hex('#1a1004'), outlineLit: hex('#2a1a06'), shine: true };
const COPPER: Material = { ramp: ramp('#3a1a0c', '#6e3418', '#a85a2c', '#d88a52', '#f6be8a'), outline: hex('#1a0a04'), shine: true };
const STEEL: Material = { ramp: ramp('#262c3a', '#4c5670', '#8692ac', '#c4cee0', '#f4f8ff'), outline: hex('#0c0f18'), outlineLit: hex('#1a2030'), shine: true };
const ROSE: Material = { ramp: ramp('#3e2434', '#74485e', '#b07a96', '#e2b2c8', '#fff0f8'), outline: hex('#1a0c14'), outlineLit: hex('#2a1420'), shine: true };
const TULLE: Material = { ramp: ramp('#7a4a64', '#b47c9a', '#e2aac4', '#f8d0e2'), outline: hex('#3a1a2a') };
const TIGHTS: Material = { ramp: ramp('#8a6a74', '#c0a2aa', '#e6d0d4', '#fbf0f2'), outline: hex('#3a2a30'), outlineLit: hex('#4a3a40') };
const SATIN: Material = { ramp: ramp('#8a4860', '#c87896', '#eeaac2', '#ffd8e6'), outline: hex('#3a1a26'), shine: true };
const DARK: Material = { ramp: ramp('#0a0608', '#1a1014', '#2a1c22'), outline: hex('#040204') };

// The Firebird's.
const FB_HAIR: Material = { ramp: ramp('#100406', '#2a0a0c', '#4a1414', '#6e2018', '#8e3020'), outline: hex('#060102'), shine: true };
const CRIMSON: Material = { ramp: ramp('#3a0408', '#6e0c12', '#b01c1e', '#e0402a', '#ff7a48'), outline: hex('#1a0204'), outlineLit: hex('#2a0406'), shine: true };
const GILT: Material = { ramp: ramp('#3e2206', '#7a4a0c', '#c08a1c', '#ecc040', '#fff0a0'), outline: hex('#1a0e02'), outlineLit: hex('#2a1804'), shine: true, emissive: 0.12 };
const FLAME: Material = { ramp: ramp('#4a0606', '#8a140c', '#c8301a', '#f06a24', '#ffb048'), outline: hex('#2a0402'), emissive: 0.12 };
const FLAME_HOT: Material = { ramp: ramp('#6a1a04', '#c0480c', '#f08a1a', '#ffc840', '#fff4b0'), outline: hex('#2a0802'), emissive: 0.25 };
const EMBER: Material = { ramp: ramp('#3a0606', '#6a1010', '#981c14', '#c03018'), outline: hex('#1a0202'), emissive: 0.1 };
const FB_TIGHTS: Material = { ramp: ramp('#2a0608', '#541014', '#7e1c1c', '#a8322a'), outline: hex('#120203') };
const FB_LIPS: Material = { ramp: ramp('#6a0410', '#b0102a', '#e83048'), outline: hex('#2a0206'), noAO: true };

/**
 * A look: the materials of each part (named the way the gear sets' dressing
 * reads them, see dress.ts), and whether she is the Firebird.
 */
export interface BalletLook {
  key: string;
  firebird: boolean;
  skin: Material;
  hair: Material;
  lips: Material;
  /** Bodice. */
  cloth: Material;
  /** Clockwork: joints, trims, the key. */
  brass: Material;
  /** The gears at her waist. */
  bronze: Material;
  /** The tutu's blades (or feathers), alternating. */
  blade: Material;
  blade2: Material;
  tulle: Material;
  legs: Material;
  shoe: Material;
}

export const BALLET_LOOK: BalletLook = {
  key: 'ballet',
  firebird: false,
  skin: PORCELAIN,
  hair: HAIR,
  lips: LIPS,
  cloth: ENAMEL,
  brass: BRASS,
  bronze: COPPER,
  blade: STEEL,
  blade2: ROSE,
  tulle: TULLE,
  legs: TIGHTS,
  shoe: SATIN,
};

export const FIREBIRD_LOOK: BalletLook = {
  key: 'ballet_firebird',
  firebird: true,
  skin: PORCELAIN,
  hair: FB_HAIR,
  lips: FB_LIPS,
  cloth: CRIMSON,
  brass: GILT,
  bronze: BRASS,
  blade: FLAME,
  blade2: FLAME_HOT,
  tulle: EMBER,
  legs: FB_TIGHTS,
  shoe: GILT,
};

export const BALLET_LOOKS = [BALLET_LOOK, FIREBIRD_LOOK];

let L: BalletLook = BALLET_LOOK;

type View = 'down' | 'up' | 'side';

interface Pt {
  x: number;
  y: number;
}

/** A leg: the tip of the pointed toe (x from its hip, y in the body box) and the knee's bend off the straight line. Drawn over the tutu when `over`. */
interface Leg {
  tx: number;
  ty: number;
  bend: Pt;
  over?: boolean;
}

/** An arm: elbow and hand, from its shoulder (front and back views: the right arm's, mirrored for the left). */
interface Arm {
  e: Pt;
  h: Pt;
}

export interface BalletPose {
  /** Drawn facing this way (a frame mid-turn), instead of the way the animation faces. */
  face?: Dir;
  /** Whole body raised (on pointe) or lowered (plié). */
  bob: number;
  /** Upper body leaning forward (side view, px). */
  lean: number;
  /** Head lowered (a bow, a droop) and tilted, px. */
  nod: number;
  tilt: number;
  /** A: the screen-left leg and arm (the near ones in the side view); B: the other. */
  legA: Leg;
  legB: Leg;
  armA: Arm;
  armB: Arm;
  /** The tutu turned this far round (radians), spread out flat (1) or drooping (-1). */
  twirl: number;
  flare: number;
  /** The key's turn (radians) and the gears' step. */
  key: number;
  gear: number;
  /** 0..1: streaks of light round the tutu's rim, spinning fast. */
  blur: number;
  /** 0..1: glints of light off her (the Special's pose, springing back to life). */
  glint: number;
  /** 0..1: a spark at the key as it clicks round (her idle moment). */
  click: number;
}

// ---------------------------------------------------------------------------
// Positions

/** Turning to her right, the way she faces: down, left, up, right. */
const RING: Dir[] = ['down', 'left', 'up', 'right'];
const viewOf = (d: Dir): View => (d === 'left' || d === 'right' ? 'side' : d);
/** The way she faces `n` quarter turns on from `d` (`sense` -1 turns the other way). */
const turned = (d: Dir, n: number, sense = 1): Dir => RING[(((RING.indexOf(d) + sense * n) % 4) + 4) % 4];

const leg = (tx: number, ty = 31, bend: Pt = { x: 0, y: 0 }, over = false): Leg => ({ tx, ty, bend, over });
const arm = (ex: number, ey: number, hx: number, hy: number): Arm => ({ e: { x: ex, y: ey }, h: { x: hx, y: hy } });

type ArmPos = 'low' | 'first' | 'second' | 'high' | 'limp' | 'skirt' | 'reach';

/** Ballet's arm positions, for the right arm in front and back views, or [near, far] in the side view. */
function arms(p: ArmPos, view: View): [Arm, Arm] {
  if (view !== 'side') {
    const a = {
      low: arm(1.2, 3.5, -1.8, 6.6),
      first: arm(1.8, 3, -2.2, 4.6),
      second: arm(3.4, 1.2, 6.6, 1.8),
      high: arm(1.8, -4.4, -2, -8.6),
      limp: arm(0.8, 3.4, 1, 7.4),
      skirt: arm(2.4, 3, 4.8, 6.2),
      reach: arm(3, -1.6, 6.2, -4),
    }[p];
    return [a, a];
  }
  return {
    low: [arm(-0.8, 3.4, -2.4, 6.4), arm(-0.4, 3.4, -1.8, 6.4)],
    first: [arm(-2.4, 2.4, -3.8, 4.4), arm(-2, 2.4, -3.2, 4.2)],
    second: [arm(-1.2, 2.6, -3, 4), arm(0.8, 2.4, 2.6, 3.6)],
    high: [arm(-1.8, -4.4, 0, -8.6), arm(-1.2, -4.6, 0.6, -8.6)],
    limp: [arm(0, 3.6, 0.4, 7.4), arm(0.2, 3.6, 0.6, 7.2)],
    skirt: [arm(0.4, 3.2, -1.8, 6.4), arm(1, 3.2, 2.6, 6)],
    reach: [arm(-3.6, -1.4, -7.4, -3.4), arm(2.6, 0.6, 6.2, 1.6)],
  }[p] as [Arm, Arm];
}

/** Standing on pointe, feet close (fifth position). */
const standLegs = (view: View): [Leg, Leg] => (view === 'side' ? [leg(-0.8), leg(0.6)] : [leg(0.5), leg(-0.5)]);

/** One leg drawn up, its toe at the other's knee (retiré, for turning). */
const retire = (view: View): [Leg, Leg] =>
  view === 'side' ? [leg(0.4, 25.6, { x: -4, y: -1.4 }), leg(0)] : [leg(1, 31), leg(-1.4, 25.6, { x: 4.2, y: -1.2 })];

/** Knees bent over the toes. */
const plie = (view: View, k = 1): [Leg, Leg] =>
  view === 'side' ? [leg(-0.8, 31, { x: -1.6 * k, y: 0 }), leg(0.6, 31, { x: -1.2 * k, y: 0 })] : [leg(0.3, 31, { x: -1.6 * k, y: 0 }), leg(-0.3, 31, { x: 1.6 * k, y: 0 })];

const base = (view: View): BalletPose => {
  const [la, lb] = standLegs(view);
  const [aa, ab] = arms('low', view);
  return { bob: 0, lean: 0, nod: 0, tilt: 0, legA: la, legB: lb, armA: aa, armB: ab, twirl: 0, flare: 0, key: 0, gear: 0, blur: 0, glint: 0, click: 0 };
};

const pose = (view: View, o: Partial<BalletPose> & { arms?: ArmPos; legs?: [Leg, Leg] }): BalletPose => {
  const p = { ...base(view), ...o };
  if (o.arms) [p.armA, p.armB] = arms(o.arms, view);
  if (o.legs) [p.legA, p.legB] = o.legs;
  return p;
};

// ---------------------------------------------------------------------------
// Parts (in body-box coordinates: 24 wide, the feet at y 31)

/** Upper and lower part with a joint between, the knee or elbow bent off the straight line by `bend`. */
function limb(c: PixelCanvas, a: Pt, b: Pt, k: Pt, upper: Material, r0: number, r1: number, joint: Material | null): void {
  c.capsule(a.x, a.y, k.x, k.y, r0, r0 * 0.92, upper);
  c.capsule(k.x, k.y, b.x, b.y, r0 * 0.9, r1, upper);
  if (joint) c.px(Math.round(k.x - 0.5), Math.round(k.y - 0.5), joint, { x: 0, y: 0.3, z: 1 });
}

/** A leg from its hip to a pointed toe: tights, a brass knee, and the satin shoe laced with ribbon. */
function drawLeg(c: PixelCanvas, hip: Pt, l: Leg): void {
  c.part();
  const toe = { x: hip.x + l.tx, y: l.ty };
  const len = Math.hypot(toe.x - hip.x, toe.y - hip.y) || 1;
  // The shin runs on into the pointed foot: the ankle is a little back from the toe along it.
  const knee = { x: (hip.x + toe.x) / 2 + l.bend.x, y: (hip.y + toe.y) / 2 + l.bend.y };
  const sl = Math.hypot(toe.x - knee.x, toe.y - knee.y) || 1;
  const shoe = Math.min(2.6, len * 0.24);
  const ankle = { x: toe.x - ((toe.x - knee.x) / sl) * shoe, y: toe.y - ((toe.y - knee.y) / sl) * shoe };
  limb(c, hip, ankle, knee, L.legs, 1.15, 0.72, L.brass);
  c.part();
  c.capsule(ankle.x, ankle.y, toe.x, toe.y - 0.4, 0.82, 0.5, L.shoe);
  // The ribbon crossing the ankle.
  c.px(Math.round(ankle.x - 0.5), Math.round(ankle.y - 1.2), L.firebird ? FLAME_HOT : ENAMEL, { x: 0.3, y: 0.4, z: 0.9 });
}

/** An arm from its shoulder: a brass ball joint, porcelain upper arm, brass elbow, porcelain forearm and hand. */
function drawArm(c: PixelCanvas, sh: Pt, a: Arm, s: number): void {
  c.part();
  const e = { x: sh.x + a.e.x * s, y: sh.y + a.e.y };
  const h = { x: sh.x + a.h.x * s, y: sh.y + a.h.y };
  c.ellipse(sh.x, sh.y, 1.2, 1.1, L.brass);
  limb(c, { x: sh.x, y: sh.y + 0.4 }, h, e, L.skin, 0.85, 0.7, L.brass);
  c.part();
  c.ellipse(h.x, h.y, 0.9, 0.9, L.skin);
}

/** The bodice: shoulders to waist, its trims, and the band of turning gearwork under it. */
function torso(c: PixelCanvas, cx: number, top: number, view: View, gear: number): void {
  const waist = top + 5.2;
  const m = L.cloth;
  const edges = (y: number): [number, number] => {
    const k = (y - top) / (waist - top);
    // A little fuller at the bust, narrowing to the waist.
    const hw = view === 'side' ? 2.5 - k * 0.7 : 3.7 - k * 1.6 + Math.sin(k * Math.PI) * 0.3;
    const off = view === 'side' ? -0.3 + (k < 0.5 ? -0.4 * Math.sin(k * Math.PI * 2) : 0) : 0;
    return [cx - hw + off, cx + hw + off];
  };
  c.part();
  c.shape(Math.floor(top), Math.ceil(waist), edges, m, (_x, y, t) => sphere(t * 0.9, ((y - top) / (waist - top)) * 0.9 - 0.45, 1));
  c.part();
  const ty = Math.floor(top);
  if (L.firebird) {
    // Gold scales over the crimson: a feather-scale pattern of gilt points.
    for (let y = ty + 1; y <= waist; y++) {
      const [l, r] = edges(y);
      for (let x = Math.round(l) + 1; x < r - 1; x++) if ((x + (y % 2) * 1) % 2 === 0 && (y + x) % 3 === 0) c.px(x, y, GILT, sphere((x + 0.5 - cx) / 3, 0, 1), { bias: -1 });
    }
  }
  if (view === 'down') {
    // The neckline (a sweetheart, dipping in the middle) and the lacing down the front.
    const [l, r] = edges(ty);
    for (let x = Math.round(l); x < r; x++) if (Math.abs(x + 0.5 - cx) > 0.6) c.px(x, ty, L.brass, cyl((x + 0.5 - cx) / 4, 0.4));
    for (let y = ty + 2; y < waist; y += 2) {
      c.px(Math.round(cx - 1), y, L.brass, { x: -0.3, y: 0.3, z: 0.9 });
      c.px(Math.round(cx), y, L.brass, { x: 0.3, y: 0.3, z: 0.9 });
    }
  } else if (view === 'up') {
    // The back: lacing, and the boss where the key goes in.
    for (let y = ty + 1; y < waist; y += 2) c.px(Math.round(cx - 0.5), y, L.brass);
  } else {
    const [l, r] = edges(ty);
    for (let x = Math.round(l); x < r; x++) c.px(x, ty, L.brass, cyl((x + 0.5 - cx) / 3, 0.4));
  }
  // The waist: a brass band milled like a gear's rim, and below it a slot of teeth turning past.
  const wy = Math.round(waist) + 1;
  const hw = view === 'side' ? 1.9 : 2.3;
  for (let x = Math.round(cx - hw); x < cx + hw; x++) {
    const t = (x + 0.5 - cx) / hw;
    c.px(x, wy, L.brass, cyl(t, 0.3), { bias: (x + gear) % 2 === 0 ? 1 : -1 });
    const tooth = (x + gear) % 3 === 0;
    c.px(x, wy + 1, tooth ? L.bronze : DARK, cyl(t, 0.2), tooth ? { bias: 1, glow: L.firebird ? 0.3 : 0 } : undefined);
  }
}

/**
 * The tutu: a cone of blades (feathers for the Firebird) fanned round the
 * hips over a skirt of tulle, seen from above at a slant. Only the half
 * behind her waist (`back`) or in front of it is drawn, so the body sits
 * between them.
 */
function tutu(c: PixelCanvas, cx: number, cy: number, p: BalletPose, back: boolean): void {
  c.part();
  const fb = L.firebird;
  const n = fb ? 12 : 10;
  const R = 8.2 + p.flare * 1.6 + (fb ? 0.6 : 0);
  const r0 = 2.2;
  // Seen from above at a slant; drooping, the rim falls (and reads taller).
  const sq = 0.4;
  const sag = 1.2 - p.flare * 1.4;
  const span = (Math.PI * 2) / n;
  // Swept out from the waist ring by ring, each point placed where it falls
  // (inner rings first, so the rim lies over them).
  // Blades lie over the hub, the hub over the tulle.
  const rank = new Map<number, number>();
  const claim = (x: number, y: number, r: number): boolean => {
    const id = (y + 64) * 512 + x + 64;
    if ((rank.get(id) ?? 0) > r) return false;
    rank.set(id, r);
    return true;
  };
  for (let rad = r0 - 0.5; rad <= R; rad += 0.25) {
    const steps = Math.max(24, Math.ceil(rad * Math.PI * 2 * 2.5));
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * Math.PI * 2 - Math.PI;
      const u = Math.cos(ang) * rad;
      const v = Math.sin(ang) * rad;
      if (back !== v < 0) continue;
      const x = Math.floor(cx + u);
      const y = Math.floor(cy + v * sq + sag * (rad / R));
      // Where it falls across its blade: -0.5..0.5, 0 on the blade's spine.
      const a = ang - p.twirl;
      const f = a / span - Math.floor(a / span) - 0.5;
      const idx = (((Math.floor(a / span) % n) + n) % n);
      const along = (rad - r0) / (R - r0);
      // A blade is a long leaf: narrow at its root, widest past the middle, pointed at its tip.
      const w = 0.42 * Math.pow(Math.sin(Math.min(1, along * 0.92 + 0.08) * Math.PI), 0.55) + (fb ? 0.06 : 0);
      const outward = { x: (u / (rad || 1)) * 0.55, y: (v / (rad || 1)) * 0.3 };
      const nrm = sphere(outward.x + f * 0.5, -outward.y * 0.6 + 0.35, 1);
      if (rad < r0 + 0.5) {
        // The hub: a toothed ring of clockwork the blades are set in.
        const tooth = Math.floor((ang + Math.PI) * 3 + p.twirl * 3) % 2 === 0;
        if (claim(x, y, 2)) c.px(x, y, L.brass, nrm, { bias: tooth ? 1 : -1 });
      } else if (Math.abs(f) < w) {
        const m = idx % 2 === 0 ? L.blade : L.blade2;
        // The leading half of each blade catches the light, its edge and tip brighter still.
        const edge = Math.abs(f) > w * 0.62 || along > 0.9;
        let bias = f < 0 ? 1 : 0;
        if (edge) bias += 1;
        if (!back && v > R * 0.82) bias -= 1;
        if (!claim(x, y, 3)) continue;
        if (fb && Math.abs(f) < 0.05 && along < 0.85) c.px(x, y, GILT, nrm, { bias: 1 });
        else c.px(x, y, m, nrm, { bias, glow: fb ? (along > 0.75 ? 0.5 : 0.12) : undefined });
      } else if (along < 0.72 && claim(x, y, 1)) {
        // Tulle between the blades, in shadow under them.
        c.px(x, y, L.tulle, nrm, { bias: along > 0.5 ? -1 : 0 });
      }
    }
  }
  if (p.blur > 0) {
    // Spinning: streaks of light whipping round the rim.
    const col: RGB = fb ? hex('#ffc860') : hex('#e8f2ff');
    for (let i = 0; i < 3; i++) {
      const a0 = p.twirl * 2.3 + (i / 3) * Math.PI * 2;
      for (let s = 0; s < 9; s++) {
        const a = a0 - s * 0.11;
        const vv = Math.sin(a);
        if (back !== vv < 0) continue;
        c.spark(cx + Math.cos(a) * (R + 0.6), cy + vv * (R + 0.6) * sq + sag, col, p.blur * (1 - s / 9) * 0.9);
      }
    }
  }
}

/**
 * The wind-up key: a brass stem out of her back and a handle of two loops
 * turned `k` round it. From the front or back the loops turn in plain sight;
 * from the side they swing edge-on.
 */
function windKey(c: PixelCanvas, x: number, y: number, k: number, view: View, behind: boolean): void {
  c.part();
  const m = L.brass;
  const glow = L.firebird ? 0.35 : 0;
  const ux = Math.cos(k);
  const uy = Math.sin(k);
  // Points of the two loops, round a ring 1.9 long and 1.3 wide, each set 2.9 out along the handle.
  const pts: { y: number; z: number; t: number }[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 28; i++) {
      const th = (i / 28) * Math.PI * 2;
      for (const ring of [1, 0.62]) {
        const a = side * 2.9 + Math.cos(th) * 1.9 * ring;
        const b = Math.sin(th) * 1.3 * ring;
        pts.push({ y: a * ux - b * uy, z: a * uy + b * ux, t: th });
      }
    }
  }
  if (view === 'side') {
    // The stem out of her back (to the right of a figure facing left), then the handle, turning edge-on.
    c.capsule(x - 1, y, x + 2.2, y, 0.6, 0.6, m);
    for (const q of pts) c.px(Math.round(x + 2.8 + q.z * 0.32), Math.round(y + q.y * 0.9), m, { x: 0.6 * Math.sign(q.z), y: -q.y / 6, z: 0.8 }, { glow });
    c.ellipse(x + 2.6, y, 0.9, 0.9, m);
    return;
  }
  // Facing her or her back: the loops turn round the stem's boss.
  for (const q of pts) c.px(Math.round(x + q.y), Math.round(y + q.z * 0.8), m, { x: Math.cos(q.t) * 0.5, y: Math.sin(q.t) * 0.5, z: 0.8 }, { glow, bias: behind ? -1 : 0 });
  c.ellipse(x, y, 1.1, 1.1, m);
  if (!behind) c.px(Math.round(x - 0.5), Math.round(y - 0.5), DARK);
}

/** The Firebird's plumed headdress: feathers fanning up from her crown, their tips aglow. */
function plumes(c: PixelCanvas, x: number, y: number, view: View, sway: number): void {
  c.part();
  const fan = view === 'side' ? [-0.2, 0.25, 0.6, 0.95] : [-0.95, -0.5, 0, 0.5, 0.95];
  fan.forEach((a0, i) => {
    const a = a0 + sway * 0.12;
    const len = view === 'side' ? 6 - i * 0.4 : 6.8 - Math.abs(a0) * 1.8;
    const ex = x + Math.sin(a) * len;
    const ey = y - Math.cos(a) * len;
    c.capsule(x, y, ex, ey, 0.6, 0.9, i % 2 ? FLAME_HOT : FLAME, { glow: 0.2 });
    c.px(Math.round(ex - 0.5), Math.round(ey - 0.5), FLAME_HOT, { x: 0, y: 1, z: 0.6 }, { glow: 1, bias: 2 });
  });
  // The gilt crest the plumes rise from.
  c.ellipse(x, y + 0.3, 1.4, 0.9, GILT);
}

/** The Firebird's train: long tail plumes from the small of her back. */
function tail(c: PixelCanvas, root: Pt, tips: Pt[]): void {
  c.part();
  tips.forEach((tip, i) => {
    const mid = { x: (root.x + tip.x) / 2 + (tip.x - root.x) * 0.15, y: (root.y + tip.y) / 2 - 1.5 };
    c.capsule(root.x, root.y, mid.x, mid.y, 0.6, 1.1, FLAME, { glow: 0.1 });
    c.capsule(mid.x, mid.y, tip.x, tip.y, 1.1, 0.6, i % 2 ? FLAME : FLAME_HOT, { glow: 0.25 });
    c.px(Math.round(tip.x - 0.5), Math.round(tip.y - 0.5), FLAME_HOT, FLAT_UP, { glow: 0.9, bias: 2 });
  });
}

const FLAT_UP = { x: 0, y: 0.6, z: 0.8 };

/** Her head: porcelain, the hair drawn back into a bun, and the painted face. */
function head(c: PixelCanvas, hx: number, hy: number, view: View, p: BalletPose): void {
  const fb = L.firebird;
  c.part();
  c.ellipse(hx, hy, view === 'side' ? 3.6 : 4, 3.7, L.skin, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.85 - 0.1, 1) });
  c.part();
  // Hair: over the crown, and (from the side) the back of the head; all of it from behind.
  for (let y = Math.floor(hy - 4); y <= hy + 4; y++) {
    for (let x = Math.floor(hx - 4); x <= hx + 4; x++) {
      const dx = (x + 0.5 - hx) / (view === 'side' ? 3.6 : 4);
      const dy = (y + 0.5 - hy) / 3.7;
      if (dx * dx + dy * dy > 1) continue;
      let hair = false;
      if (view === 'up') hair = true;
      // Swept back from a middle parting, framing the face down to the ears.
      else if (view === 'down') hair = dy < -0.42 + Math.abs(dx) * 0.45 || (Math.abs(dx) > 0.88 && dy < 0.1);
      else hair = dy < -0.3 || dx > 0.05 - dy * 0.2;
      if (!hair) continue;
      // A parting down the middle (front), the hair swept back.
      const part = view === 'down' && Math.abs(x + 0.5 - hx) < 0.6 && dy < -0.5;
      c.px(x, y, L.hair, sphere(dx * 0.9, dy * 0.85, 1), { bias: part ? -1 : (x + y) % 3 === 0 ? 1 : 0 });
    }
  }
  // The bun, high on the crown (a little back, from the side), and its ribbon.
  const bx = view === 'side' ? hx + 1.7 : hx;
  const by = view === 'side' ? hy - 3.5 : hy - 3.9;
  c.part();
  c.ellipse(bx, by, 2, 1.6, L.hair);
  c.part();
  for (let i = -1; i <= 1; i++) c.shade(Math.round(bx + i - 0.5), Math.round(by + i * 0.4), 1);
  if (!fb) {
    const rib = view === 'side' ? [[bx - 1.6, by + 1.2]] : view === 'up' ? [[bx - 2, by + 1], [bx + 2, by + 1]] : [[bx + 1.6, by + 0.9]];
    for (const [rx, ry] of rib) c.px(Math.round(rx - 0.5), Math.round(ry - 0.5), ENAMEL, { x: 0.3, y: 0.5, z: 0.8 }, { bias: 1 });
  }

  if (view === 'down') {
    const ey = Math.round(hy + 0.4);
    const l = Math.round(hx - 2.5);
    const r = Math.round(hx + 1.5);
    c.part();
    if (fb) {
      // Gilt wings drawn out from the eyes, like a mask.
      c.px(l - 1, ey - 1, GILT, FLAT_UP, { bias: 1 });
      c.px(r + 1, ey - 1, GILT, FLAT_UP, { bias: 1 });
      c.px(l - 1, ey, GILT, FLAT_UP);
      c.px(r + 1, ey, GILT, FLAT_UP);
    }
    // Painted eyes, lowered, each with a flick of lash at its corner.
    c.px(l, ey, LASH);
    c.px(r, ey, LASH);
    if (!fb) {
      c.px(l - 1, ey - 1, LASH);
      c.px(r + 1, ey - 1, LASH);
    }
    // Rosy cheeks and a rosebud mouth.
    c.px(l - 1, ey + 1, BLUSH, FLAT_UP, { bias: fb ? 0 : 1 });
    c.px(r + 1, ey + 1, BLUSH, FLAT_UP, { bias: fb ? 0 : 1 });
    c.px(Math.round(hx - 0.5), ey + 2, L.lips, FLAT_UP, { bias: 1 });
  } else if (view === 'side') {
    const ey = Math.round(hy + 0.4);
    const ex = Math.round(hx - 2.5);
    c.part();
    c.px(ex, ey, LASH);
    c.px(ex - 1, ey - 1, fb ? GILT : LASH);
    c.px(ex + 1, ey + 1, BLUSH, FLAT_UP, { bias: 1 });
    c.px(ex - 1, ey + 2, L.lips, FLAT_UP);
  }
  if (fb) plumes(c, view === 'side' ? hx + 0.6 : hx, hy - 3.6, view, p.flare);
}

// ---------------------------------------------------------------------------
// The figure

function drawFigure(c: PixelCanvas, p: BalletPose, view: View): void {
  const fb = L.firebird;
  const U = -p.bob;
  const cx = 12;
  const ux = cx + p.lean;
  const chest = 13.3 + U;
  const tutuY = 19.8 + U;
  const hipY = 20 + U;
  const headY = 9.2 + U + p.nod;
  const keyY = chest + 2.6;
  const sideHip = view === 'side';
  const hipA = { x: sideHip ? cx - 0.4 : cx - 1.3, y: hipY };
  const hipB = { x: sideHip ? cx + 0.5 : cx + 1.3, y: hipY };
  const shA = view === 'side' ? { x: ux + 0.2, y: chest + 0.6 } : { x: ux - 3.9, y: chest + 0.6 };
  const shB = view === 'side' ? { x: ux + 1, y: chest + 0.6 } : { x: ux + 3.9, y: chest + 0.6 };
  const raised = (a: Arm) => a.h.y < -6;

  // Behind everything: the key (from the front), the Firebird's train.
  if (view === 'down') {
    if (fb) tail(c, { x: cx, y: tutuY - 1 }, [{ x: cx - 10, y: 26 }, { x: cx + 10, y: 26 }]);
    windKey(c, ux, keyY, p.key, view, true);
  }
  if (view === 'side') {
    // The far arm and leg, a shade darker.
    if (!p.legB.over) drawLeg(c, hipB, p.legB);
    drawArm(c, shB, p.armB, 1);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 24; x++) if (c.filled(x, y)) c.shade(x, y, -1);
    if (fb) tail(c, { x: cx + 1.5, y: tutuY - 0.5 }, [{ x: cx + 11, y: 29 }, { x: cx + 9, y: 31 }, { x: cx + 11.5, y: 25.5 }]);
  }
  if (view === 'up') {
    for (const [sh, a, s] of [[shA, p.armA, -1], [shB, p.armB, 1]] as const) if (a.h.y > 0 && a.h.x < 1) drawArm(c, sh, a, s);
  }

  tutu(c, cx, tutuY, p, true);
  if (view === 'side') {
    if (!p.legA.over) drawLeg(c, hipA, p.legA);
  } else {
    if (!p.legA.over) drawLeg(c, hipA, p.legA);
    if (!p.legB.over) drawLeg(c, hipB, p.legB);
  }
  // The neck, then the bodice and waist.
  c.part();
  c.capsule(ux - (view === 'side' ? 0.6 : 0), headY + 3, ux - (view === 'side' ? 0.3 : 0), chest + 0.5, 0.9, 1, L.skin);
  torso(c, ux, chest, view, p.gear);
  tutu(c, cx, tutuY, p, false);
  if (view === 'side') {
    if (p.legB.over) drawLeg(c, hipB, p.legB);
    if (p.legA.over) drawLeg(c, hipA, p.legA);
    windKey(c, ux + 2.6, keyY, p.key, view, false);
  } else {
    if (p.legA.over) drawLeg(c, hipA, p.legA);
    if (p.legB.over) drawLeg(c, hipB, p.legB);
  }
  if (view === 'up') {
    if (fb) tail(c, { x: cx, y: tutuY - 1.5 }, [{ x: cx - 3.5, y: 31 }, { x: cx + 3.5, y: 31 }, { x: cx, y: 30 }]);
    windKey(c, ux, keyY, p.key, view, false);
    for (const [sh, a, s] of [[shA, p.armA, -1], [shB, p.armB, 1]] as const) if (!(a.h.y > 0 && a.h.x < 1)) drawArm(c, sh, a, s);
  }
  if (view === 'down') {
    if (!raised(p.armA)) drawArm(c, shA, p.armA, -1);
    if (!raised(p.armB)) drawArm(c, shB, p.armB, 1);
  }
  if (view === 'side' && !raised(p.armA)) drawArm(c, shA, p.armA, 1);

  head(c, ux + p.tilt, headY, view, p);

  if (view === 'down') {
    if (raised(p.armA)) drawArm(c, shA, p.armA, -1);
    if (raised(p.armB)) drawArm(c, shB, p.armB, 1);
  }
  if (view === 'side' && raised(p.armA)) drawArm(c, shA, p.armA, 1);

  if (p.glint > 0) {
    // Glints off her: on the crown, the hands, the tutu's rim.
    const col: RGB = fb ? hex('#fff0a0') : hex('#ffffff');
    const pts: Pt[] = [{ x: ux + 3, y: headY - 5 }, { x: cx - 8, y: tutuY + 1 }, { x: cx + 7, y: tutuY - 1 }];
    for (const g of pts) {
      c.spark(g.x, g.y, col, p.glint);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(g.x + dx, g.y + dy, col, p.glint * 0.5);
    }
  }
  if (p.click > 0) {
    const kx = view === 'side' ? ux + 5.5 : ux;
    const ky = view === 'down' ? keyY - 4 : keyY;
    const col: RGB = fb ? hex('#ffc860') : hex('#fff4d0');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p.key;
      c.spark(kx + Math.cos(a) * 2.5, ky + Math.sin(a) * 2, col, p.click * 0.8);
    }
    c.spark(kx, ky, col, p.click);
  }
}

// ---------------------------------------------------------------------------
// Animations

export type BalletAnim = 'idle' | 'walk' | 'spinA' | 'spinB' | 'kick' | 'leap' | 'cast' | 'vortex' | 'curtsy' | 'rest';

interface AnimDef {
  name: BalletAnim;
  fps: number;
  loop: boolean;
  poses: (dir: Dir) => BalletPose[];
  /** Frame indices to play in order, when some are held or repeated. */
  order?: readonly number[];
}

/** Rising and settling on her toes, arms low; the key turns a half and the tutu sways. */
const idle = (dir: Dir): BalletPose[] =>
  [0, 1, 2, 3].map((i) => pose(viewOf(dir), { bob: i === 1 || i === 2 ? 1 : 0, key: (i * Math.PI) / 4, gear: i, twirl: Math.sin((i / 4) * Math.PI * 2) * 0.08, flare: i === 2 ? 0.1 : 0 }));

/** Quick little steps on pointe (a bourrée), arms open. */
const walk = (dir: Dir): BalletPose[] =>
  Array.from({ length: 6 }, (_, i) => {
    const v = viewOf(dir);
    const a = (i / 6) * Math.PI * 2;
    const s = Math.sin(a);
    const liftA = Math.max(0, s) * 1.6;
    const liftB = Math.max(0, -s) * 1.6;
    const legs: [Leg, Leg] =
      v === 'side'
        ? [leg(-0.8 - Math.cos(a) * 1.6, 31 - liftA, { x: -liftA * 0.5, y: 0 }), leg(0.6 + Math.cos(a) * 1.6, 31 - liftB, { x: -liftB * 0.5, y: 0 })]
        : [leg(0.4, 31 - liftA, { x: -liftA * 0.3, y: 0 }), leg(-0.4, 31 - liftB, { x: liftB * 0.3, y: 0 })];
    const p = pose(v, { arms: 'second', legs, bob: Math.round(Math.abs(Math.cos(a)) * 0.6 + 0.4), key: (i * Math.PI) / 6, gear: i, twirl: Math.sin(a) * 0.15 });
    // The arms float a touch with each step.
    const lift = Math.round(Math.cos(a));
    p.armA = { e: p.armA.e, h: { x: p.armA.h.x, y: p.armA.h.y + lift } };
    p.armB = { e: p.armB.e, h: { x: p.armB.h.x, y: p.armB.h.y - lift } };
    return p;
  });

/**
 * A pirouette: a quick plié, then a whole turn on one toe in retiré, the
 * tutu's blades flung out flat and streaking, and she opens out facing the
 * way she began. The first turns with her arms rounded in front, the second
 * the other way with them over her head.
 */
const spin = (sense: number, hold: ArmPos) => (dir: Dir): BalletPose[] => {
  const out: BalletPose[] = [];
  const v0 = viewOf(dir);
  out.push(pose(v0, { arms: 'second', legs: plie(v0, 0.8), bob: -1, key: 0, gear: 0 }));
  for (let i = 1; i <= 4; i++) {
    const face = turned(dir, i % 4, sense);
    const v = viewOf(face);
    out.push(pose(v, { face, arms: hold, legs: retire(v), bob: 1, twirl: sense * i * 0.9, flare: 1, blur: i < 4 ? 1 : 0.5, key: i * 0.8, gear: i }));
  }
  out.push(pose(v0, { arms: 'second', bob: 0, twirl: sense * 4.2, flare: 0.4, key: 4, gear: 5 }));
  return out;
};

/**
 * The finisher: her leg drawn back, a great sweeping kick (grand battement)
 * that flings a blade arc, held in an arabesque, then she gathers in.
 */
const kick = (dir: Dir): BalletPose[] => {
  const v = viewOf(dir);
  if (v === 'side') {
    return [
      pose(v, { arms: 'first', legs: [leg(3.5, 30, { x: 0.5, y: 0 }), leg(0)], lean: 0.5, key: 0 }),
      pose(v, { arms: 'second', legs: [leg(-6, 27.5, { x: 0, y: 0.3 }, true), leg(0)], key: 0.6, flare: 0.4, twirl: -0.2 }),
      pose(v, { arms: 'reach', legs: [leg(-9.5, 15.5, { x: 0, y: -0.4 }, true), leg(0.2)], bob: 1, key: 1.2, flare: 1, twirl: -0.5, blur: 0.6 }),
      pose(v, { arms: 'reach', legs: [leg(9.5, 18.5, { x: 0, y: -0.4 }, true), leg(-0.3)], bob: 1, lean: -1.5, key: 1.8, flare: 0.6, twirl: -0.7 }),
      pose(v, { arms: 'low', key: 2.2, twirl: -0.8 }),
    ];
  }
  // From the front or back: the leg flung high out to the side.
  const s = v === 'down' ? 1 : -1;
  const kickLeg = (tx: number, ty: number, over: boolean): Leg => leg(tx, ty, { x: 0, y: -0.4 }, over);
  const two = (k: Leg): [Leg, Leg] => (s > 0 ? [leg(0.8), k] : [k, leg(-0.8)]);
  return [
    pose(v, { arms: 'first', legs: two(kickLeg(s * 2.5, 30, false)), key: 0 }),
    pose(v, { arms: 'second', legs: two(kickLeg(s * 6, 27, true)), key: 0.6, flare: 0.4, twirl: 0.2 * s }),
    pose(v, { arms: 'high', legs: two(kickLeg(s * 9, 13, true)), bob: 1, key: 1.2, flare: 1, twirl: 0.5 * s, blur: 0.6 }),
    pose(v, { arms: 'reach', legs: two(kickLeg(s * 8, 22, v === 'up')), bob: 1, key: 1.8, flare: 0.6, twirl: 0.7 * s }),
    pose(v, { arms: 'low', key: 2.2, twirl: 0.8 * s }),
  ];
};

/** The grand jeté: a deep plié, the spring, a full split through the air, and landing on her toes. */
const leap = (dir: Dir): BalletPose[] => {
  const v = viewOf(dir);
  const split: [Leg, Leg] = v === 'side' ? [leg(-10, 21.5, { x: 0, y: -0.3 }, true), leg(9.5, 20, { x: 0, y: -0.3 }, true)] : [leg(-8.5, 23.5, { x: 0, y: -0.5 }, true), leg(8.5, 23.5, { x: 0, y: -0.5 }, true)];
  const take: [Leg, Leg] = v === 'side' ? [leg(-6, 26, { x: 0, y: -0.3 }, true), leg(3, 30.5)] : [leg(-4.5, 27.5, { x: 0, y: -0.4 }, true), leg(0.8, 31)];
  return [
    pose(v, { arms: 'low', legs: plie(v, 1.4), bob: -1.5, key: 0 }),
    pose(v, { arms: 'second', legs: take, bob: 0.5, key: 0.5, flare: 0.3 }),
    pose(v, { arms: 'high', legs: split, bob: 1, key: 1, flare: 1, twirl: 0.2 }),
    pose(v, { arms: 'second', legs: split, bob: 1, key: 1.4, flare: 1, twirl: 0.3 }),
    pose(v, { arms: 'second', legs: plie(v, 1), bob: -1, key: 1.8, flare: -0.3, twirl: 0.35 }),
    pose(v, { arms: 'second', bob: 1, key: 2.2, flare: 0.2, twirl: 0.4 }),
  ];
};

/** The Special's pose: up on her toes, arms rising into a crown over her head, the tutu flaring and the key whirring round. */
const cast = (dir: Dir): BalletPose[] => {
  const v = viewOf(dir);
  return [
    pose(v, { arms: 'low', key: 0 }),
    pose(v, { arms: 'first', bob: 1, key: 1.2, flare: 0.2, twirl: 0.2 }),
    pose(v, { arms: 'high', bob: 1, key: 2.4, flare: 0.5, twirl: 0.5, gear: 1 }),
    pose(v, { arms: 'high', bob: 2, key: 3.6, flare: 1, twirl: 0.9, gear: 2, glint: 0.6 }),
    pose(v, { arms: 'high', bob: 2, key: 4.8, flare: 1, twirl: 1.3, gear: 3, glint: 1 }),
    pose(v, { arms: 'high', bob: 2, key: 6, flare: 1, twirl: 1.7, gear: 4, glint: 0.7 }),
  ];
};

/** The Music Box: turning and turning on one toe, arms in a crown, the blades a blur. */
const vortex = (dir: Dir): BalletPose[] =>
  [0, 1, 2, 3].map((i) => {
    const face = turned(dir, i);
    const v = viewOf(face);
    return pose(v, { face, arms: 'high', legs: retire(v), bob: 1, twirl: i * 0.8, flare: 1, blur: 1, key: i * 1.6, gear: i });
  });

/** A curtsy (révérence): a foot behind, a deep bend with her head bowed, the blades held out like a skirt. */
const curtsy = (dir: Dir): BalletPose[] => {
  const v = viewOf(dir);
  const back: [Leg, Leg] = v === 'side' ? [leg(-1, 31, { x: -1.6, y: 0 }), leg(4, 31, { x: 1.8, y: -0.5 })] : [leg(0.4, 31, { x: -1.8, y: 0 }), leg(-0.4, 31, { x: 1.8, y: 0 })];
  return [
    pose(v, { arms: 'second', key: 0 }),
    pose(v, { arms: 'skirt', legs: back, bob: -0.5, flare: 0.3, key: 0.3 }),
    pose(v, { arms: 'skirt', legs: back, bob: -1.5, nod: 1, flare: 0.5, key: 0.6 }),
    pose(v, { arms: 'skirt', legs: back, bob: -2, nod: 2, flare: 0.5, key: 0.8 }),
    pose(v, { arms: 'skirt', legs: back, bob: -1, nod: 1, flare: 0.3, key: 1 }),
    pose(v, { arms: 'low', key: 1.2 }),
  ];
};

/**
 * The idle moment, facing the viewer only: her key runs down; she slows,
 * droops and stops like a music box left unwound, head fallen to one side.
 * Then the key clicks round of its own accord, once, twice; she springs back
 * up, arms flung over her head, and sinks into a little curtsy.
 */
const rest = (dir: Dir): BalletPose[] => {
  if (dir !== 'down') return [];
  const v: View = 'down';
  const limp = plie(v, 0.6);
  return [
    pose(v, {}),
    pose(v, { key: 0.3, tilt: 0, nod: 0, flare: -0.2 }),
    pose(v, { arms: 'limp', key: 0.45, nod: 1, tilt: 0, bob: -0.5, flare: -0.6, legs: plie(v, 0.3) }),
    pose(v, { arms: 'limp', key: 0.5, nod: 2, tilt: 1, bob: -1, flare: -1, legs: limp }),
    pose(v, { arms: 'limp', key: 0.5, nod: 2, tilt: 1, bob: -1.4, flare: -1, legs: limp }),
    pose(v, { arms: 'limp', key: 1.3, nod: 2, tilt: 1, bob: -1, flare: -1, legs: limp, click: 1 }),
    pose(v, { arms: 'limp', key: 2.1, nod: 1, tilt: 0, bob: -0.5, flare: -0.6, legs: plie(v, 0.3), click: 1 }),
    pose(v, { arms: 'high', key: 3, bob: 2, flare: 1, twirl: 0.4, glint: 1 }),
    pose(v, { arms: 'second', key: 3.6, bob: 1, flare: 0.5, twirl: 0.6 }),
    pose(v, { arms: 'skirt', key: 4, bob: -1.5, nod: 1, flare: 0.4, twirl: 0.7, legs: plie(v, 1) }),
    pose(v, { arms: 'low', key: 4.3, twirl: 0.75 }),
  ];
};

export const BALLET_ANIMS: AnimDef[] = [
  { name: 'idle', fps: 5, loop: true, poses: idle },
  { name: 'walk', fps: 12, loop: true, poses: walk },
  { name: 'spinA', fps: 20, loop: false, poses: spin(1, 'first') },
  { name: 'spinB', fps: 20, loop: false, poses: spin(-1, 'high') },
  { name: 'kick', fps: 12, loop: false, poses: kick },
  { name: 'leap', fps: 12, loop: false, poses: leap, order: [0, 1, 2, 3, 3, 4, 5] },
  { name: 'cast', fps: 10, loop: false, poses: cast },
  { name: 'vortex', fps: 16, loop: true, poses: vortex },
  { name: 'curtsy', fps: 10, loop: false, poses: curtsy },
  { name: 'rest', fps: 7, loop: false, poses: rest, order: [0, 1, 1, 2, 3, 3, 4, 3, 4, 4, 4, 5, 4, 5, 6, 7, 7, 8, 9, 9, 10, 0] },
];

/** How long her moves take, from their frames (the game times its blows by them). */
export const BALLET_TIMING = {
  spin: (6 / 20) * 1000,
  kick: (5 / 12) * 1000,
  leap: (7 / 12) * 1000,
  curtsy: (6 / 10) * 1000,
};

export interface BalletFrame {
  key: string;
  anim: BalletAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, p: BalletPose): PixelCanvas {
  const face = p.face ?? dir;
  const c = new PixelCanvas(BALLET_W, BALLET_H).offset(BODY_X, BODY_Y);
  drawFigure(c, p, viewOf(face));
  return face === 'right' ? c.mirrored() : c;
}

export function buildBalletFrames(look: BalletLook = BALLET_LOOK): BalletFrame[] {
  L = look;
  const out: BalletFrame[] = [];
  for (const a of BALLET_ANIMS) {
    for (const dir of DIRS) {
      a.poses(dir).forEach((p, i) => out.push({ key: `${a.name}_${dir}_${i}`, anim: a.name, dir, canvas: drawFrame(dir, p) }));
    }
  }
  L = BALLET_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Button icons

export const BALLET_TONES: Tones = [hex('#ffffff'), hex('#ffc8e4'), hex('#ff8ac4'), hex('#8a2a60')];
export const FIREBIRD_TONES: Tones = [hex('#fff4b0'), hex('#ffc840'), hex('#ff6a1a'), hex('#8a1206')];

/**
 * Pirouette: a little dancer on one toe inside a ring of blades, seen at a
 * slant (the Firebird's ring is of flame feathers).
 */
export function balletSpinIcon(fb = false): Uint8ClampedArray {
  const t = fb ? FIREBIRD_TONES : BALLET_TONES;
  const steel: RGB = fb ? hex('#ff9a2a') : hex('#c4cee0');
  const steelHi: RGB = fb ? hex('#ffe070') : hex('#f4f8ff');
  const body: RGB = fb ? hex('#e0402a') : hex('#f39ac4');
  const skin = hex('#f6e6dc');
  const hair: RGB = fb ? hex('#4a1414') : hex('#5e3624');
  return icon16((put) => {
    // The ring's far half, behind her.
    const ring = (front: boolean) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.2;
        if (Math.sin(a) > 0 !== front) continue;
        const x0 = 7.5 + Math.cos(a) * 3;
        const y0 = 10 + Math.sin(a) * 1.3;
        const x1 = 7.5 + Math.cos(a + 0.35) * 7.2;
        const y1 = 10 + Math.sin(a + 0.35) * 3.2;
        seg(put, x0, y0, x1, y1, i % 2 ? steel : steelHi);
      }
    };
    ring(false);
    // Her: bun, head, bodice, a leg to the toe, one drawn up.
    put(7, 2, hair);
    put(8, 2, hair);
    for (let y = 3; y <= 5; y++) for (let x = 6; x <= 9; x++) put(x, y, y === 3 ? hair : skin);
    // Arms rounded over her head (en haut).
    seg(put, 5, 6, 4, 3, skin);
    seg(put, 4, 3, 6, 1, skin);
    seg(put, 10, 6, 11, 3, skin);
    seg(put, 11, 3, 9, 1, skin);
    for (let y = 6; y <= 8; y++) for (let x = 6; x <= 9; x++) put(x, y, body);
    for (let y = 11; y <= 15; y++) put(7, y, skin);
    seg(put, 8, 11, 10, 12, skin);
    seg(put, 10, 12, 8, 13, skin);
    ring(true);
    put(7, 15, t[1]);
    // Streaks of the turn.
    seg(put, 0, 9, 1, 11, t[2]);
    seg(put, 15, 11, 14, 9, t[2]);
    put(1, 12, t[0]);
    put(14, 8, t[0]);
  });
}

/** Grand jeté: a dancer flying in a split, her arc dotted behind her, blades springing up from the ground below. */
export function balletLeapIcon(fb = false): Uint8ClampedArray {
  const t = fb ? FIREBIRD_TONES : BALLET_TONES;
  const steel: RGB = fb ? hex('#ff9a2a') : hex('#c4cee0');
  const steelHi: RGB = fb ? hex('#ffe070') : hex('#f4f8ff');
  const body: RGB = fb ? hex('#e0402a') : hex('#f39ac4');
  const legs: RGB = fb ? hex('#a8322a') : hex('#f6e6dc');
  const skin = hex('#f6e6dc');
  const hair: RGB = fb ? hex('#4a1414') : hex('#5e3624');
  return icon16((put) => {
    // The arc of her flight, dotted, rising from the left.
    for (const [x, y] of [[0, 13], [1, 11], [2, 10], [3, 9]] as const) put(x, y, t[2]);
    // Legs split wide, toes pointed.
    seg(put, 7, 8, 13, 6, legs);
    seg(put, 7, 8, 2, 10, legs);
    put(14, 6, t[1]);
    put(1, 10, t[1]);
    // The tutu's blades fanned round her hips.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      put(7.5 + Math.cos(a) * 3.4, 8 + Math.sin(a) * 1.3, i % 2 ? steel : steelHi);
    }
    // Bodice, head and bun, arms flung up and open.
    for (let y = 5; y <= 7; y++) {
      put(7, y, body);
      put(8, y, body);
    }
    put(8, 4, skin);
    put(8, 3, skin);
    put(9, 3, skin);
    put(8, 2, hair);
    put(9, 2, hair);
    put(9, 1, hair);
    seg(put, 7, 5, 4, 2, skin);
    seg(put, 9, 5, 12, 2, skin);
    // Blades springing up from the ground below her.
    for (const x of [3, 6, 9, 12]) {
      seg(put, x, 15, x, 13, steel);
      put(x, 12, t[0]);
    }
  });
}
