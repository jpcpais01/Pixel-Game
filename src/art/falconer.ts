// The falconer, the archer's fourth type, drawn procedurally on her own rig.
//
// A huntress who hunts with a bird: a russet felt cap with a long barred
// falcon feather swept back from its band, a thick chestnut braid over her
// right shoulder, a quilted russet gambeson to mid-thigh over a cream shirt,
// a hawking bag and its feathered lure at her hip, a side quiver of
// barred-fletched arrows on the other, and on her left arm a heavy buckskin
// gauntlet to the elbow. Her peregrine rides a thick leather pad on her left
// shoulder: slate back, a dark hood and moustache, a cream breast barred in
// grey, yellow feet with jesses hanging from them. She shoots a short,
// strongly recurved horn bow, quick and close.
//
// While the falcon is out hunting she is drawn without it (the `bare_`
// moves); the bird in flight is its own small sheet, drawn at the end of this
// file with the hawks of her Special and the golden eagle of her skin.
//
// Berkut is her skin: an eagle hunter of the steppe in a tall fox-fur hat
// (a russet fur brim and ear flaps round a red felt crown, a tassel on top),
// a long quilted felt coat of deep crimson bordered in indigo and worked in
// white and gold ram's-horn scrolls, a wide belt set with silver plaques,
// high black boots, a heavy leather gauntlet, a horn-and-sinew bow, and on
// her shoulder a great golden eagle, dark brown with a golden nape, hooded in
// tooled leather with a red plume until it flies.

// The rig is the archer's (see archer.ts): hands posed in her own terms and
// placed for each view, the bow aimed from the draw hand through the grip.

import { PixelCanvas, cyl, hex, sphere, type Material, type RGB, type Vec3 } from './pixel';
import { SKIN } from './palette';
import { ARROW_DIRS, ARROW_SIZE } from './archer';
import { DIRS, type Dir } from './wizard';

export const FALC_W = 48;
export const FALC_H = 50;
const BODY_X = 12;
const BODY_Y = 12;
/** Sprite origin in the frame: body centre, just under the feet (the archer's). */
export const FALC_ORIGIN_X = BODY_X + 12;
export const FALC_ORIGIN_Y = BODY_Y + 31;

const ramp = (...c: string[]): RGB[] => c.map(hex);
const mat = (r: string[], outline: string, o: Partial<Material> = {}): Material => ({ ramp: ramp(...r), outline: hex(outline), ...o });

// ---------------------------------------------------------------------------
// Looks

/** A bird's feathers: the falcon, the hawks of the Special, the golden eagle. */
export interface BirdLook {
  /** Back and wings, and the dark flight feathers at their tips. */
  back: Material;
  primary: Material;
  /** Crown and moustache (the eagle's golden crown and nape). */
  hood: Material;
  /** Breast, throat and underwing. */
  breast: Material;
  /** The bars on the breast and tail (the eagle's tawny shoulders and leggings). */
  bar: Material;
  tail: Material;
  /** Cere and feet. */
  foot: Material;
  beak: Material;
  eye: Material;
  /** Big, broad-winged and long-fingered, a heavy hooked beak; hooded while perched. */
  eagle?: boolean;
  /** Its size against the falcon's. */
  size: number;
}

/** One look for the falconer. Its field names follow dress.ts, so worn sets find the pad, the cuff and the buckles. */
export interface FalconerLook {
  key: string;
  /** The felt cap, its band, and its feather (pale with dark bars). */
  cap: Material;
  capBand: Material;
  quill: Material;
  quillBar: Material;
  hair: Material;
  tie: Material;
  eye: Material;
  lip: Material;
  /** The quilted gambeson, its seams, and the shirt at its collar. */
  coat: Material;
  shirt: Material;
  trouser: Material;
  boot: Material;
  /** The gauntlet on her bow arm, its flared cuff, and the leather pad on that shoulder. */
  glove: Material;
  cuff: Material;
  pad: Material;
  strap: Material;
  buckle: Material;
  /** The hawking bag and its lure. */
  bag: Material;
  /** The recurve bow, its tips, its string. */
  bow: Material;
  tip: Material;
  string: Material;
  /** Arrows: barred fletching, the head, the shaft. */
  fletch: Material;
  fletchBar: Material;
  head: Material;
  shaft: Material;
  /** The bird on her shoulder. */
  bird: BirdLook;
  /** Light her arrowheads gather, brightest first. */
  light: [RGB, RGB, RGB];
  /** Berkut: the fox-fur hat, the coat's indigo borders and their embroidery, the belt's plaques, the eagle's hood. */
  berkut?: BerkutDress;
}

/** What Berkut wears over the falconer's rig. */
export interface BerkutDress {
  /** Fox fur: the hat's brim and ear flaps. */
  fur: Material;
  /** Indigo felt: the coat's borders, collar and cuffs, the hat's crown seams. */
  felt: Material;
  /** The embroidery: white felt and gold thread. */
  stitch: Material;
  gold: Material;
  /** The hat's tassel and the hood's plume. */
  tassel: Material;
  /** Silver plaques on the belt. */
  plaque: Material;
  /** The eagle's tooled leather hood. */
  hood: Material;
}

// The peregrine.
export const FALCON: BirdLook = {
  back: mat(['#161a24', '#262c3a', '#3a4254', '#56607a', '#7a86a0'], '#07080c'),
  primary: mat(['#0c0d12', '#16181f', '#22252e', '#30343f'], '#040406'),
  hood: mat(['#08090c', '#121419', '#1c1f26', '#2a2e38'], '#030304'),
  breast: mat(['#7a6c54', '#ac9c7c', '#d6c8a6', '#f0e6cc', '#fffaee'], '#2a2214'),
  bar: mat(['#3a3a42', '#565662', '#74747e'], '#121216'),
  tail: mat(['#1a1e28', '#2c3242', '#424a5e', '#5c6680'], '#07080c'),
  foot: mat(['#7a5410', '#b88a18', '#e8be30', '#fff07a'], '#2a1a04', { noAO: true }),
  beak: mat(['#14161c', '#2c3040', '#4c5266'], '#050608'),
  eye: mat(['#030304', '#0a0a0e'], '#030304', { noAO: true }),
  size: 1,
};
// outlineLit can't go through mat's Partial<Material> as a string: fix it up here.
FALCON.breast.outlineLit = hex('#3e3424');

/** The Special's hawks: red-tailed, brown above, pale below with a dark belly band. */
export const HAWK: BirdLook = {
  back: mat(['#1c110a', '#342014', '#523420', '#724c30', '#946a46'], '#0a0503'),
  primary: mat(['#0e0906', '#1a120c', '#281c14', '#3a2a1e'], '#050302'),
  hood: mat(['#24160c', '#3a2414', '#58381e', '#74502c'], '#0c0704'),
  breast: mat(['#7a6450', '#a8907a', '#d2bea2', '#eee0c6', '#fff6e4'], '#2a1e12'),
  bar: mat(['#3a2414', '#58381e', '#74502c'], '#120a04'),
  tail: mat(['#4a1a0c', '#7a2e14', '#a8461e', '#cc6630', '#e8885a'], '#1a0804'),
  foot: mat(['#7a5410', '#b88a18', '#e8be30', '#fff07a'], '#2a1a04', { noAO: true }),
  beak: mat(['#14161c', '#2c3040', '#4c5266'], '#050608'),
  eye: mat(['#1a0c04', '#3a1c08'], '#030304', { noAO: true }),
  size: 1.12,
};

/** Berkut's golden eagle: dark brown, a golden crown and nape, tawny shoulders and leggings, a slate beak. */
export const GOLDEN_EAGLE: BirdLook = {
  back: mat(['#100906', '#1e130c', '#311e12', '#472e1c', '#604228'], '#050302'),
  primary: mat(['#0a0604', '#140e0a', '#201812', '#2e241c'], '#030201'),
  hood: mat(['#5a3410', '#8a5418', '#b87a24', '#dca040', '#f6cc6a'], '#1e1004'),
  breast: mat(['#140a06', '#24140c', '#3a2414', '#523420', '#6e4c2c'], '#060302'),
  bar: mat(['#3e2612', '#64401e', '#8c6030', '#ae7e46'], '#140a04'),
  tail: mat(['#1a120c', '#2e2218', '#463628', '#5e4c3c'], '#080604'),
  foot: mat(['#7a5410', '#b88a18', '#e8be30', '#fff07a'], '#2a1a04', { noAO: true }),
  beak: mat(['#14161c', '#2c3040', '#4c5266', '#6c7488'], '#050608'),
  eye: mat(['#2a1204', '#6a3a0c'], '#030201', { noAO: true }),
  eagle: true,
  size: 1.35,
};
GOLDEN_EAGLE.hood.outlineLit = hex('#2e1a08');

export const FALCONER_LOOK: FalconerLook = {
  key: 'archer_falconer',
  cap: mat(['#2a1009', '#461c10', '#682c18', '#8c4222', '#ac5c30'], '#120604'),
  capBand: mat(['#2a1a0c', '#46301a', '#644628', '#826038'], '#100a04'),
  quill: mat(['#8a7454', '#b8a07a', '#e0cca4', '#f8eed4'], '#2a2014'),
  quillBar: mat(['#2a1a10', '#46301e', '#62462c'], '#0e0804'),
  hair: mat(['#1e0c06', '#381a0e', '#582a16', '#7a3e20', '#9a562c'], '#0c0402'),
  tie: mat(['#2a1a0c', '#4a321c', '#6a4c2c'], '#0e0804'),
  eye: mat(['#1c1008', '#2e1a0c'], '#0a0604', { noAO: true }),
  lip: mat(['#7a3a32', '#a2524a', '#c06a5e'], '#2a1210', { noAO: true }),
  coat: mat(['#2a0e08', '#4a1a0e', '#6e2a16', '#944022', '#b45a34'], '#120402'),
  shirt: mat(['#5e4e3a', '#8e7a5c', '#bca682', '#e0d0aa', '#f6ecd0'], '#221a10'),
  trouser: mat(['#14120c', '#24201a', '#38322a', '#4e463a', '#665c4c'], '#060504'),
  boot: mat(['#1a0e08', '#2c1a10', '#442818', '#5e3a24', '#7a4e32'], '#080402'),
  glove: mat(['#3a2414', '#5c3c22', '#84603a', '#ac8656', '#cca874'], '#160c06'),
  cuff: mat(['#2e1c10', '#4c301c', '#6e4a2c', '#8e663e', '#ae8454'], '#120a04'),
  pad: mat(['#1e120a', '#342014', '#4e3220', '#6a482e', '#86603e'], '#0a0603'),
  strap: mat(['#1c100a', '#301c12', '#4a2c1c', '#663e28'], '#0a0604'),
  buckle: mat(['#3a2610', '#62461e', '#8a6a34', '#b08e50'], '#140c04', { shine: true }),
  bag: mat(['#26160c', '#402818', '#5e3e24', '#7c5634', '#9a7048'], '#0c0704'),
  bow: mat(['#1a0e08', '#321c10', '#4e2e1a', '#6c4428', '#8c5c38'], '#0a0503', { shine: true }),
  tip: mat(['#5e5442', '#968a70', '#c8bc9c', '#eee6cc'], '#1e1a12'),
  string: mat(['#7a6c50', '#b0a07c', '#ddd0aa'], '#2a2214'),
  fletch: mat(['#7a6a50', '#a8967a', '#d2c4a2', '#efe6cc'], '#2a2014'),
  fletchBar: mat(['#2a1e14', '#44321e', '#5e4830'], '#0e0a06'),
  head: mat(['#2a2e3a', '#4e5466', '#7e8698', '#bcc4d2', '#eef2f8'], '#0c0e14', { shine: true }),
  shaft: mat(['#3e2814', '#5e4020', '#86602e', '#a87e44'], '#140c06'),
  bird: FALCON,
  light: [hex('#fffbea'), hex('#ffd890'), hex('#e8a040')],
};

export const BERKUT_LOOK: FalconerLook = {
  key: 'archer_falconer_berkut',
  // The hat's red felt crown (the brim is the fur below).
  cap: mat(['#300406', '#560a0e', '#7c1214', '#a01e1c', '#bc3428'], '#140202'),
  capBand: mat(['#3a1406', '#64260c', '#924016', '#bc5e22', '#de8a44'], '#160602'),
  // The lure on her bag: tawny eagle feathers.
  quill: mat(['#76502a', '#a0743e', '#c89e5e', '#ead2a0'], '#1e1006'),
  quillBar: mat(['#1a0e08', '#2c1a0e', '#422816'], '#080402'),
  hair: mat(['#060508', '#100e12', '#1c181e', '#2a242c', '#3c3440'], '#020202'),
  tie: mat(['#5a0c0c', '#9a1e18', '#d0402e'], '#1a0404'),
  eye: mat(['#140a04', '#24140a'], '#080402', { noAO: true }),
  lip: mat(['#7a3030', '#a2463e', '#c25e52'], '#2a0e0c', { noAO: true }),
  coat: mat(['#2a0408', '#4a0a10', '#6e1218', '#941e22', '#b63832'], '#120204'),
  shirt: mat(['#0c0e26', '#161a40', '#22285e', '#323a7e', '#48529c'], '#04050e'),
  trouser: mat(['#0c0c18', '#16162a', '#22223e', '#303052', '#424268'], '#040408'),
  boot: mat(['#0c0908', '#1a1410', '#2a201a', '#3c3026', '#544436'], '#040302', { shine: true }),
  glove: mat(['#2a1608', '#4a2a12', '#70441e', '#966030', '#ba824c'], '#120802'),
  cuff: mat(['#1e0e06', '#36200e', '#523218', '#704a26', '#8e6438'], '#0c0602'),
  pad: mat(['#1e1008', '#341e10', '#4e301a', '#6a4626', '#865e36'], '#0a0503'),
  strap: mat(['#160c06', '#28160c', '#3e2414', '#56361e'], '#080402'),
  buckle: mat(['#4a4e58', '#7e8492', '#b4bac6', '#eef2f8'], '#14161c', { shine: true }),
  bag: mat(['#1e1008', '#382010', '#56341c', '#74502c', '#926c40'], '#0a0503'),
  // Horn and sinew: dark horn limbs, pale bone ears, a sinew string.
  bow: mat(['#100806', '#20140c', '#342214', '#4c341e', '#6a4c2e'], '#060302', { shine: true }),
  tip: mat(['#6a5a3a', '#a8946a', '#d8c49a', '#f4e8c8'], '#221c10'),
  string: mat(['#6a5034', '#9a7a52', '#c8a87a'], '#22180c'),
  fletch: mat(['#2a1a0e', '#4a3018', '#6e4a26', '#946a3a'], '#0c0604'),
  fletchBar: mat(['#bcae92', '#e8dcc0', '#fff8e8'], '#3a3020'),
  head: mat(['#2a2e3a', '#4e5466', '#7e8698', '#bcc4d2', '#eef2f8'], '#0c0e14', { shine: true }),
  shaft: mat(['#5a4428', '#866a40', '#b09060', '#d4b886'], '#1a120a'),
  bird: GOLDEN_EAGLE,
  light: [hex('#fffbe8'), hex('#ffd870'), hex('#e89a30')],
  berkut: {
    fur: mat(['#2a0e06', '#4c1c0a', '#763212', '#9e481a', '#c0642a', '#d8844a'], '#120502'),
    felt: mat(['#0c0e26', '#161a40', '#22285e', '#323a7e', '#48529c'], '#04050e'),
    stitch: mat(['#a8a8b4', '#dcdce4', '#f6f6fa', '#ffffff'], '#1a1a24', { noAO: true }),
    gold: mat(['#7a5410', '#b88a20', '#e8bc3a', '#fff08a'], '#2a1a04', { shine: true, noAO: true }),
    tassel: mat(['#5a0a08', '#9a1a12', '#d0341e', '#f0603a'], '#1a0202'),
    plaque: mat(['#4a4e58', '#7e8492', '#b4bac6', '#eef2f8'], '#14161c', { shine: true, noAO: true }),
    hood: mat(['#2a0606', '#4c0e0c', '#721a14', '#962a1c', '#b4442c'], '#100202'),
  },
};
BERKUT_LOOK.cap.outlineLit = hex('#2a0404');

export const FALCONER_LOOKS = [FALCONER_LOOK, BERKUT_LOOK];

/** The look being drawn; set by buildFalconerFrames. */
let S: FalconerLook = FALCONER_LOOK;

// ---------------------------------------------------------------------------
// The pose

/** A hand, in her own terms: `f` forward, `s` out to its own side, `h` up from the chest. */
interface Hand {
  f: number;
  s: number;
  h: number;
}

/** What the bird is doing, perched. */
type Wing = 'fold' | 'mantle' | 'spread' | 'ruffle' | 'preen' | 'eat' | 'gulp' | 'cry';

interface Pose {
  lift: number;
  breath: number;
  footA: number;
  footB: number;
  lean: number;
  /** The draw hand (screen left from the front and back, the near arm from the side) and the gauntleted bow hand. */
  a: Hand;
  b: Hand;
  raised: boolean;
  nock: boolean;
  draw: number;
  glint: number;
  /** The braid and the coat's skirts swinging. */
  sway: number;
  blink?: boolean;
  headX?: number;
  headY?: number;
  /** Where the bird is: on the pad at her shoulder, on her fist, or off hunting. */
  bird: 'shoulder' | 'fist' | 'none';
  wing: Wing;
  /** The bird's head turned to its right (+1) or left (-1), from the front. */
  peer?: number;
  /** The bird sits this much higher (it bobs against her step). */
  birdUp?: number;
  /** A morsel of meat in her draw hand. */
  morsel?: boolean;
  /** Fingers at her lips, whistling. */
  whistle?: number;
  /** Her eyes on the bird. */
  glance?: boolean;
  /** A down feather drifting off the ruffling bird (body coordinates). */
  down?: [number, number];
  /** Off the ground, px. */
  air?: number;
}

const H = (f: number, s: number, h: number): Hand => ({ f, s, h });

type View = 'down' | 'up' | 'side';

/** The chest row in body coordinates, the height hands are posed from. */
const CH = 18;

interface Placed {
  x: number;
  y: number;
  behind: boolean;
}

/** Where a hand lands on screen in each view. `hx` is the upper body's centre (side view). */
function place(view: View, arm: 'a' | 'b', q: Hand, U: number, hx: number): Placed {
  const side = arm === 'a' ? -1 : 1;
  if (view === 'down') return { x: 12 + side * q.s, y: CH + U - q.h + q.f * 0.7, behind: q.f < -1 };
  if (view === 'up') return { x: 12 + side * q.s, y: CH + U - q.h - q.f * 0.8, behind: q.f > 1 };
  const far = arm === 'b';
  return { x: hx - 1 - q.f * 1.05 + (far ? 0.8 : 0), y: CH + U - q.h + (far ? -0.6 : 0.3), behind: far };
}

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

/** A filled triangle: every pixel whose centre lies inside it. */
function tri(c: PixelCanvas, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, m: Material, n: (x: number, y: number) => Vec3, bias = 0): void {
  const x0 = Math.floor(Math.min(ax, bx, cx));
  const x1 = Math.ceil(Math.max(ax, bx, cx));
  const y0 = Math.floor(Math.min(ay, by, cy));
  const y1 = Math.ceil(Math.max(ay, by, cy));
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(d) < 0.001) return;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) c.px(x, y, m, n(x, y), { bias });
    }
  }
}

// ---------------------------------------------------------------------------
// The bow and arrows

/** The bow's grip, the way it points (n) and the line of its limbs (axis). */
function bowFrame(view: View, p: Pose, fa: Placed, fb: Placed): { x: number; y: number; nx: number; ny: number; ax: number; ay: number } {
  let nx: number;
  let ny: number;
  if (p.raised) {
    const d = Math.hypot(fb.x - fa.x, fb.y - fa.y);
    if (d > 2) [nx, ny] = unit(fb.x - fa.x, fb.y - fa.y);
    else [nx, ny] = view === 'side' ? [-1, 0] : view === 'down' ? [0, 1] : [0, -1];
  } else {
    // Carried at her side, belly out, a little more upright than the ranger's longbow.
    [nx, ny] = view === 'side' ? unit(-1, 0.3) : unit(1, -0.15);
  }
  let [ax, ay] = [-ny, nx];
  if (ay > 0 || (ay === 0 && ax > 0)) [ax, ay] = [-ax, -ay];
  return { x: fb.x, y: fb.y, nx, ny, ax, ay };
}

/**
 * The short recurve: two limbs bending back from a thick grip, then sweeping
 * forward hard at their ends (the recurve), bone (or silver) at the tips;
 * the string to the hand while an arrow is on it.
 */
function drawBow(c: PixelCanvas, view: View, p: Pose, fa: Placed, fb: Placed, bias = 0): void {
  const f = bowFrame(view, p, fa, fb);
  const L = view === 'side' ? 6.4 : 6.0;
  const bend = 1.8 + p.draw * 1.2;
  const at = (t: number): [number, number] => {
    const a = Math.abs(t);
    const back = bend * t * t - (a > 0.7 ? (a - 0.7) * 4.2 : 0);
    return [f.x + f.ax * t * L - f.nx * back, f.y + f.ay * t * L - f.ny * back];
  };
  c.part();
  const steps = 9;
  for (const s of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * s;
      const t1 = ((i + 1) / steps) * s;
      const [x0, y0] = at(t0);
      const [x1, y1] = at(t1);
      c.capsule(x0, y0, x1, y1, 1.2 - (i / steps) * 0.55, 1.2 - ((i + 1) / steps) * 0.55, S.bow, { bias });
    }
  }
  c.part();
  for (const s of [-1, 1]) {
    const [x0, y0] = at(s * 0.86);
    const [x1, y1] = at(s);
    c.line(x0, y0, x1, y1, S.tip, () => sphere(-0.3, -0.4), { bias: bias + 1 });
  }
  if (S.berkut) {
    // Horn and sinew: the limbs' horn bellies lit along their length, and red-and-gold thread bound round them where the bone ears are set.
    for (const t of [-0.5, -0.25, 0.25, 0.5]) {
      const [kx, ky] = at(t);
      c.shade(kx, ky, 1);
    }
    c.part();
    for (const t of [-0.72, 0.72]) {
      const [kx, ky] = at(t);
      c.px(kx, ky, S.berkut.gold, sphere(-0.3, -0.4), { bias: bias + 1 });
    }
  }
  // The grip, wrapped.
  c.part();
  c.capsule(f.x - f.ax * 1.2, f.y - f.ay * 1.2, f.x + f.ax * 1.2, f.y + f.ay * 1.2, 1.1, 1.1, S.strap, { bias });
  const [tx0, ty0] = at(-1);
  const [tx1, ty1] = at(1);
  c.part();
  if (p.nock) {
    c.line(tx0, ty0, fa.x, fa.y, S.string, () => sphere(0, -0.2));
    c.line(fa.x, fa.y, tx1, ty1, S.string, () => sphere(0, -0.2));
    arrowOnString(c, fa.x, fa.y, f.nx, f.ny, p.glint);
  } else {
    c.line(tx0, ty0, tx1, ty1, S.string, () => sphere(0, -0.2));
  }
}

/** Light gathering at a point: a small cross of it. */
function glintAt(c: PixelCanvas, x: number, y: number, glint: number): void {
  if (glint <= 0) return;
  const [core, hot, mid] = S.light;
  c.spark(x, y, core, glint);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + dx, y + dy, hot, 0.7 * glint);
  if (glint > 0.6) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.spark(x + dx, y + dy, mid, 0.5 * glint);
}

/** A short arrow nocked at (x, y), pointing along (nx, ny): barred fletching, the shaft, a steel head. */
function arrowOnString(c: PixelCanvas, x: number, y: number, nx: number, ny: number, glint: number): void {
  const len = 9;
  const hx = x + nx * len;
  const hy = y + ny * len;
  c.part();
  c.line(x + nx * 1.5, y + ny * 1.5, hx - nx * 1.2, hy - ny * 1.2, S.shaft, () => sphere(0, -0.3));
  c.part();
  for (const [k, m] of [[1.2, S.fletch], [2.4, S.fletchBar]] as const) {
    c.px(x + nx * k - ny, y + ny * k + nx, m, sphere(-0.3, 0.2));
    c.px(x + nx * k + ny, y + ny * k - nx, m, sphere(0.3, -0.2));
  }
  c.part();
  c.px(hx - nx * 0.6, hy - ny * 0.6, S.head, sphere(-0.3, -0.4));
  c.px(hx, hy, S.head, sphere(-0.5, -0.5), { bias: 1 });
  glintAt(c, hx, hy, glint);
}

// ---------------------------------------------------------------------------
// Her parts

/** A sleeved arm from the shoulder, bent at the elbow (towards `hint`); the bow arm wears the gauntlet. */
function arm(c: PixelCanvas, sx: number, sy: number, p: Placed, reach: number, hint: [number, number], gauntlet: boolean, bias = 0): void {
  const { x: fx, y: fy } = p;
  const dx = fx - sx;
  const dy = fy - sy;
  const d = Math.hypot(dx, dy) || 0.01;
  let ex = sx + dx / 2;
  let ey = sy + dy / 2;
  if (d < reach * 2) {
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
  c.capsule(sx, sy, ex, ey, 1.7, 1.45, S.coat, { bias });
  c.part();
  if (gauntlet) {
    // The heavy gauntlet: thick from the hand up to a flared cuff below the elbow.
    const cx0 = ex + (fx - ex) * 0.12;
    const cy0 = ey + (fy - ey) * 0.12;
    c.capsule(cx0, cy0, fx, fy, 1.75, 1.45, S.glove, { bias });
    c.part();
    c.capsule(cx0, cy0, ex + (fx - ex) * 0.3, ey + (fy - ey) * 0.3, 2.05, 1.85, S.cuff, { bias: bias + 1 });
    if (S.berkut) {
      // The berkutchi's gauntlet is heavier still: a thick welt round the cuff, stitched in gold.
      c.part();
      const wx = ex + (fx - ex) * 0.2;
      const wy = ey + (fy - ey) * 0.2;
      c.capsule(ex + (fx - ex) * 0.1, ey + (fy - ey) * 0.1, wx, wy, 2.25, 2.25, S.cuff, { bias: bias + 1 });
      c.part();
      c.px(wx, wy, S.berkut.gold, sphere(-0.2, -0.4));
    }
    c.part();
    c.ellipse(fx, fy, 1.45, 1.35, S.glove, { bias });
  } else {
    c.capsule(ex, ey, fx, fy, 1.45, 1.25, S.coat, { bias });
    if (S.berkut) {
      // An indigo cuff at the wrist, a white stitch on it.
      const wx = ex + (fx - ex) * 0.72;
      const wy = ey + (fy - ey) * 0.72;
      c.part();
      c.ellipse(wx, wy, 1.5, 1.35, S.berkut.felt, { bias });
      c.part();
      c.px(wx - 0.4, wy - 0.4, S.berkut.stitch, sphere(-0.3, -0.4), { bias });
    }
    c.part();
    c.ellipse(fx, fy, 1.2, 1.15, SKIN, { bias });
  }
}

function leg(c: PixelCanvas, hx: number, hy: number, fx: number, fy: number, bias = 0): void {
  c.part();
  c.capsule(hx, hy, fx, fy, 1.5, 1.3, S.trouser, { bias });
}

/** A tall riding boot, its top turned down (Berkut's rise higher, plain and black, a toe turned up). */
function boot(c: PixelCanvas, x: number, y: number, side = false, bias = 0): void {
  c.part();
  if (side) c.ellipse(x, y, 2.2, 1.2, S.boot, { flatten: 0.8, bias });
  else c.ellipse(x, y, 1.6, 1.3, S.boot, { flatten: 0.8, bias });
  if (S.berkut) {
    if (side) c.px(x - 2.4, y - 1, S.boot, sphere(-0.6, -0.5), { bias });
    c.part();
    c.shape(Math.round(y - 4.6), Math.round(y - 1), () => [x - (side ? 1.3 : 1.5), x + (side ? 1.5 : 1.5)], S.boot, (_x, _y, t) => cyl(t, 0.2), { bias });
    return;
  }
  c.part();
  c.shape(Math.round(y - 3.2), Math.round(y - 1), () => [x - (side ? 1.3 : 1.5), x + (side ? 1.5 : 1.5)], S.boot, (_x, _y, t) => cyl(t, 0.2), { bias });
  c.part();
  c.shape(Math.round(y - 3.6), Math.round(y - 3.6), () => [x - (side ? 1.6 : 1.8), x + (side ? 1.8 : 1.8)], S.cuff, (_x, _y, t) => cyl(t, 0.4), { bias: bias + 1 });
}

/** The side quiver at her hip, mouth up and back: barred fletchings fanned out of it. */
function quiver(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, bias = 0): void {
  const [ux, uy] = unit(x0 - x1, y0 - y1);
  c.part();
  for (const [k, o] of [[-1, 0.4], [0, 1], [1, 0.2]] as const) {
    const bx = x0 + ux * (1.4 + o) - uy * k * 0.9;
    const by = y0 + uy * (1.4 + o) + ux * k * 0.9;
    c.px(bx, by, S.fletch, sphere(k * 0.4 - 0.2, -0.5), { bias });
    c.px(bx + ux * 0.9, by + uy * 0.9, k === 0 ? S.fletchBar : S.fletch, sphere(k * 0.4, -0.6), { bias });
  }
  c.part();
  c.capsule(x0, y0, x1, y1, 1.5, 1.25, S.bag, { bias });
  c.part();
  c.capsule(x0, y0, x0 + (x1 - x0) * 0.1, y0 + (y1 - y0) * 0.1, 1.65, 1.65, S.strap, { bias: bias + 1 });
}

/** The hawking bag on her hip, its flap and ring, and the lure hanging from it: a pad of feathers on a cord. */
function hawkingBag(c: PixelCanvas, x: number, y: number, bias = 0, sway = 0): void {
  c.part();
  c.ellipse(x, y, 1.9, 1.7, S.bag, { bias });
  c.part();
  c.shape(Math.round(y - 1.6), Math.round(y - 0.4), () => [x - 1.9, x + 1.9], S.strap, (_x, _y, t, u) => sphere(t * 0.8, u * 0.5 - 0.4, 1), { bias });
  // The lure.
  const lx = x + 1.6 + sway * 0.4;
  c.part();
  c.line(x + 1.4, y + 0.6, lx, y + 2.4, S.strap, () => sphere(0.3, 0));
  c.part();
  c.px(lx, y + 3.2, S.quill, sphere(-0.4, -0.3), { bias });
  c.px(lx + 1, y + 3.2, S.quillBar, sphere(0.4, -0.2), { bias });
  c.px(lx, y + 4, S.quillBar, sphere(0, 0.4), { bias });
}

/** The quilting: seams down the coat every few pixels, and across it at the chest. */
function quilt(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, step = 3): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) {
      if (c.materialAt(x, y) !== S.coat) continue;
      if ((x - Math.round(x0)) % step === 1) c.shade(x, y, -1);
    }
  }
}

/** Her braid, from (x0, y0) along `pts`: bound in turns, a tie and a tuft at the end. */
function braid(c: PixelCanvas, pts: [number, number][], bias = 0): void {
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    c.capsule(x0, y0, x1, y1, 1.35 - i * 0.12, 1.25 - (i + 1) * 0.12, S.hair, { bias });
  }
  // The turns of the plait.
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k < n; k += 2) c.shade(x0 + ((x1 - x0) * k) / n + 0.5, y0 + ((y1 - y0) * k) / n, -1);
  }
  const [ex, ey] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const [ux, uy] = unit(ex - px, ey - py);
  c.part();
  c.px(ex, ey, S.tie, sphere(-0.3, -0.2), { bias: bias + 1 });
  c.part();
  c.px(ex + ux, ey + uy + 0.4, S.hair, sphere(-0.3, 0.3), { bias });
  c.px(ex + ux * 1.6 - 0.6, ey + uy * 1.6 + 0.8, S.hair, sphere(-0.5, 0.4), { bias });
  c.px(ex + ux * 1.6 + 0.6, ey + uy * 1.6 + 0.8, S.hair, sphere(0.5, 0.4), { bias: bias - 1 });
}

/** The long cap feather: a pale vane barred dark, from its quill at (x0, y0) curving out to its tip. */
function capFeather(c: PixelCanvas, pts: [number, number][], bias = 0): void {
  c.part();
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const r = i === pts.length - 2 ? 1 - t * 0.6 : 1;
      c.ellipse(x, y, 0.9 * r + 0.2, 0.9 * r + 0.2, Math.floor(k / 2.2) % 2 ? S.quillBar : S.quill, { bias });
      k++;
    }
  }
}

/** Fur: a few pixels nudged light and dark so it reads as fur, not cloth. */
function furry(c: PixelCanvas, fur: Material, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  for (let y = Math.round(y0); y <= y1; y++) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) {
      if (c.materialAt(x, y) !== fur) continue;
      const h = ((x * 7 + y * 13 + seed * 5) % 5 + 5) % 5;
      if (h === 0) c.shade(x, y, -1);
      else if (h === 3) c.shade(x, y, 1);
    }
  }
}

/**
 * Berkut's embroidery over whatever indigo felt lies in a box: ram's-horn
 * scrolls, little arches curling out at their feet, white and gold by turns.
 * Across a band (`across`), the arches run along it two rows deep; down a
 * band they stand one over another, a chain of horns.
 */
function ornament(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, across: boolean, phase = 0): void {
  const B = S.berkut;
  if (!B) return;
  const X0 = Math.round(x0);
  const Y0 = Math.round(y0);
  for (let y = Y0; y <= y1; y++) {
    for (let x = X0; x <= Math.round(x1); x++) {
      if (c.materialAt(x, y) !== B.felt) continue;
      // Position along the band (i) and across it (j).
      const i = (across ? x - X0 : y - Y0) + phase;
      const j = across ? y - Y0 : x - X0;
      let m: Material | null = null;
      if (across) {
        // Arches two rows deep, white and gold by turns, a gap between.
        const q = ((i % 5) + 5) % 5;
        const on = j % 2 === 0 ? q === 1 || q === 2 : q === 0 || q === 3;
        if (on) m = Math.floor(i / 5) % 2 ? B.gold : B.stitch;
      } else {
        // Down a narrow border: a chain of white and gold stitches zigzagging from side to side.
        const q = ((i % 4) + 4) % 4;
        if (j % 2 === 0 && q === 0) m = B.stitch;
        else if (j % 2 === 1 && q === 2) m = B.gold;
      }
      if (!m) continue;
      c.px(x, y, m, sphere(0, j % 2 ? 0.3 : -0.3));
    }
  }
}

// ---------------------------------------------------------------------------
// The bird, perched

/**
 * The bird standing at (x, y) (its feet), seen from the front ('down'), from
 * behind ('up') or facing left ('side'). Folded, it is a little upright bird
 * about 5 wide and 9 tall; it mantles, spreads its wings, ruffles, preens,
 * takes a morsel and cries.
 */
function perched(c: PixelCanvas, x: number, y: number, view: View, p: Pose): void {
  const B = S.bird;
  if (B.eagle) return perchedEagle(c, x, y, view, p);
  const w = p.wing;
  const peer = p.peer ?? 0;
  const fat = w === 'ruffle' ? 0.7 : 0;
  const by = y - 3.6;
  const bodyN = (_x: number, _y: number, dx: number, dy: number) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1);

  // Spread or mantled wings go behind the body.
  const wings = (side: number) => {
    if (w === 'mantle') {
      for (const s of [-1, 1]) {
        const sx = x + s * (view === 'side' ? 0.6 : 1.8);
        const out = view === 'side' ? 2.8 : 4.2;
        c.part();
        const tx = view === 'side' ? x + 2.6 + (s > 0 ? 1.2 : 0) : sx + s * out;
        tri(c, sx, by - 2, tx, by - 3.6, view === 'side' ? x + 3.6 : sx + s * (out - 0.4), by + 2.6, B.back, () => sphere(s * 0.5, -0.4), s > 0 && view === 'side' ? -1 : 0);
        c.part();
        c.capsule(tx, by - 3.6, view === 'side' ? x + 4 : sx + s * (out + 0.6), by + 0.8, 0.9, 0.6, B.primary, { bias: 0 });
      }
    } else if (w === 'spread' || w === 'cry') {
      // Up and out, heraldic: the arm of the wing to the wrist, the long primaries fanning from it.
      for (const s of view === 'side' ? [1, 0.6] : [-1, 1]) {
        const dir = view === 'side' ? 1 : s;
        const sx = x + (view === 'side' ? 1 : s * 1.6);
        const wx = sx + dir * (view === 'side' ? 3.2 * s : 3.6);
        const wy = by - 5.4 - (view === 'side' ? (1 - s) * 2 : 0);
        const tipx = sx + dir * (view === 'side' ? 6.4 * s : 7.2);
        const tipy = by - 3.2 - (view === 'side' ? (1 - s) * 2 : 0);
        const bias = view === 'side' && s < 1 ? -1 : 0;
        c.part();
        tri(c, sx, by - 2.2, wx, wy, sx + dir * 2, by + 2.2, B.back, () => sphere(dir * 0.3, -0.6), bias);
        tri(c, wx, wy, tipx, tipy, sx + dir * 2, by + 2.2, B.back, () => sphere(dir * 0.5, -0.3), bias);
        c.part();
        // The primaries: three fingers off the wrist, the trailing edge ragged.
        for (let k = 0; k < 3; k++) {
          const fx = tipx - dir * k * 1.1;
          const fy = tipy + k * 1.5;
          c.capsule(wx + dir * 0.6, wy + 0.4 + k * 0.6, fx, fy, 0.8, 0.45, B.primary, { bias });
        }
        for (let k = 0; k < 3; k++) c.shade(sx + dir * (1.8 + k * 1.2), by - 1 + k * 0.4, -1);
        if (side === 0) break;
      }
    }
  };
  if (w === 'mantle' || w === 'spread' || w === 'cry') wings(1);

  if (view === 'side') {
    // Facing left: tail down behind, the body leaning forward a little, the folded wing along its back.
    c.part();
    c.capsule(x + 1.8, y - 0.8, x + 3 + fat, y + 2.4, 0.9, 0.7, B.tail);
    c.part();
    c.capsule(x + 1.2, y - 1.6, x - 0.4, by - 1.6, 2.0 + fat, 2.2 + fat, B.back, { bias: 0 });
    c.part();
    // The breast, on the front of it.
    c.shape(Math.round(by - 2.4), Math.round(y - 1), (yy) => {
      const u = (yy - (by - 2.4)) / (y - 1 - (by - 2.4));
      const fx = x - 1.9 - fat - Math.sin(u * Math.PI) * 0.6 + u * 1.4;
      return [fx, fx + 1.9];
    }, B.breast, (_x, _y, t, u) => sphere(t * 0.6 - 0.4, u * 0.6 - 0.2, 1));
    for (let yy = Math.round(by - 1); yy <= y - 2; yy += 2) c.shade(x - 1, yy, -1);
    if (w === 'fold' || w === 'eat' || w === 'gulp' || w === 'preen' || w === 'ruffle') {
      c.part();
      c.capsule(x + 0.2, by - 2, x + 2.4, y - 0.4, 1.2 + fat * 0.6, 0.8, B.back, { bias: -1 });
      c.part();
      c.capsule(x + 1.6, y - 1.6, x + 2.8, y + 0.6, 0.7, 0.5, B.primary);
    }
    // The head.
    let hx = x - 0.6;
    let hy = by - 4.2;
    if (w === 'eat') {
      hx -= 1.6;
      hy += 1.6;
    } else if (w === 'gulp') {
      hy -= 0.6;
      hx += 0.2;
    } else if (w === 'preen') {
      hx += 1.8;
      hy += 1.4;
    } else if (w === 'ruffle') hy += 0.6;
    perchedHead(c, hx, hy, 'side', w, peer);
  } else {
    // Front or back: tail below, folded wings behind the breast (over the back from behind), the head.
    const back = view === 'up';
    c.part();
    c.capsule(x, y - 1, x + (back ? 0 : 0.3), y + 2.2, 1.1, 0.8, B.tail);
    if (back) for (let yy = Math.round(y); yy <= y + 2; yy += 2) c.shade(x, yy, -1);
    const folded = w !== 'spread' && w !== 'cry' && w !== 'mantle';
    const foldWings = () => {
      for (const s of [-1, 1]) {
        c.part();
        c.capsule(x + s * (1.6 + fat), by - 1.6, x + s * (1.0 + fat * 0.6), y + 0.8, 1.25 + fat * 0.4, 0.7, B.back, { bias: back ? 0 : -1 });
        c.part();
        c.px(x + s * 0.8, y + 1.2, B.primary, sphere(s * 0.4, 0.3));
      }
    };
    if (folded && !back) foldWings();
    c.part();
    c.ellipse(x, by + 0.4, 2.1 + fat, 2.9 + fat * 0.6, back ? B.back : B.breast, { normal: bodyN });
    if (!back) {
      for (let yy = Math.round(by); yy <= by + 2.4; yy += 2)
        for (let xx = Math.round(x - 1.2); xx <= x + 1.2; xx += 2) c.px(xx + ((Math.round(yy) & 2) ? 1 : 0), yy, B.bar, sphere(0, 0.2));
    }
    if (folded && back) {
      foldWings();
      c.shade(x, by + 1, -1);
    }
    let hx = x + peer * 0.6;
    let hy = by - 3.3;
    if (w === 'eat') {
      hx -= 1.4;
      hy += 1.4;
    } else if (w === 'gulp') hy -= 0.5;
    else if (w === 'preen') {
      hx += 1.5;
      hy += 1.6;
    } else if (w === 'ruffle') hy += 0.7;
    perchedHead(c, hx, hy, back ? 'up' : 'down', w, peer);
  }
  // The feet gripping, the jesses hanging.
  if (!(view === 'up')) {
    c.part();
    for (const s of view === 'side' ? [0] : [-1, 1]) c.px(x + s * 0.9 - (view === 'side' ? 0.6 : 0), y, B.foot, sphere(s * 0.3, -0.3));
    c.part();
    c.px(x + 0.4, y + 1, S.strap, sphere(0, 0.2));
    c.px(x + 0.8, y + 2, S.strap, sphere(0, 0.4), { bias: -1 });
  }
}

/**
 * Berkut's golden eagle perched: half again the falcon's size and hunched,
 * broad in the shoulder: its folded wings tawny at the shoulder, dark brown
 * down their length, near black at their tips; a dark breast, tawny
 * feathered legs, a long banded tail; its golden head in a tooled leather hood
 * with a plume, so the gold nape and the great hooked beak show. It mantles,
 * spreads its wings and screams through the hood, takes a morsel, rouses and
 * preens, like the falcon. On her shoulder it sits a little further out than
 * the falcon, clear of her hat.
 */
function perchedEagle(c: PixelCanvas, x0: number, y: number, view: View, p: Pose): void {
  const B = S.bird;
  const leather = S.berkut?.hood ?? B.back;
  const w = p.wing;
  const peer = p.peer ?? 0;
  const fat = w === 'ruffle' ? 0.8 : 0;
  const side = view === 'side';
  const back = view === 'up';
  // On her shoulder it sits further out than the falcon, clear of her hat; on her raised fist, out past her face.
  const x = x0 + (p.bird === 'shoulder' ? (side ? 2.2 : 1.4) : side ? -2.6 : 2.6);
  /** The top of its shoulders. */
  const sy = y - 9;
  const folded = w !== 'spread' && w !== 'cry' && w !== 'mantle';

  /** The tawny band over the shoulder of a wing, from (ax, ay) towards (bx, by). */
  const coverts = (ax: number, ay: number, bx: number, bY: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      c.px(ax + (bx - ax) * u, ay + (bY - ay) * u, B.bar, sphere(0, -0.4));
    }
  };
  /** An open wing: the arm from shoulder to wrist, the hand out towards the tip, four primaries fingering from it. */
  const openWing = (sx: number, sy0: number, wx: number, wy: number, tx: number, ty: number, rx: number, ry: number, dir: number, bias: number) => {
    const hx = wx + (tx - wx) * 0.5;
    const hy = wy + (ty - wy) * 0.5;
    c.part();
    tri(c, sx, sy0, wx, wy, rx, ry, B.back, () => sphere(dir * 0.3, -0.6), bias);
    tri(c, wx, wy, hx, hy, rx, ry, B.back, () => sphere(dir * 0.5, -0.3), bias);
    c.part();
    // The fingers: from the hand out, spread apart, the first longest.
    for (let k = 0; k < 4; k++) {
      const u = k / 3;
      const fx = tx + (rx - tx) * u * 0.6;
      const fy = ty + (ry - ty) * u * 0.6;
      const bx = hx + (rx - hx) * u * 0.5;
      const by = hy + (ry - hy) * u * 0.5;
      c.capsule(bx, by, fx, fy, 0.75, 0.4, B.primary, { bias });
    }
    // The tawny coverts along the arm, the leading edge lit.
    c.part();
    coverts(sx + (rx - sx) * 0.18, sy0 + (ry - sy0) * 0.18, wx + (rx - wx) * 0.2, wy + (ry - wy) * 0.2, 4);
  };

  if (w === 'mantle') {
    // Half open and drooped over the perch, like a cloak.
    for (const s of side ? [1.4, 0] : [-1, 1]) {
      if (side) {
        const b = s > 0 ? -1 : 0;
        c.part();
        tri(c, x + 0.4 + s, sy + 1 - s * 0.6, x + 3.6 + s, sy - 0.6 - s * 0.6, x + 4.8 + s, y + 0.6, B.back, () => sphere(0.4, -0.4), b);
        c.part();
        c.capsule(x + 3.8 + s, sy - 0.4 - s * 0.6, x + 5.2 + s, y - 0.6, 1.0, 0.6, B.primary, { bias: b });
        if (s === 0) coverts(x + 0.8, sy + 1.4, x + 3.4, sy + 0.2, 3);
      } else {
        const ax = x + s * 2.6;
        c.part();
        tri(c, ax, sy + 0.6, ax + s * 3.4, sy - 0.4, ax + s * 3, y + 1.4, B.back, () => sphere(s * 0.5, -0.4));
        c.part();
        c.capsule(ax + s * 3.4, sy, ax + s * 3.6, y + 0.6, 1.0, 0.6, B.primary);
        coverts(ax + s * 0.6, sy + 1.2, ax + s * 3, sy + 0.4, 3);
      }
    }
  } else if (w === 'spread' || w === 'cry') {
    // Heraldic, up and out. From the front the wing on her side is swept higher, over her hat rather than across her face.
    if (side) {
      for (const s of [1.4, 0]) {
        const ax = x + 0.6 + s;
        const ay = sy + 1.6 - s * 0.6;
        openWing(ax, ay, ax + 2.4, ay - 5, ax + 6.2, ay - 7.4, ax + 3.8, y - 1, 1, s > 0 ? -1 : 0);
      }
    } else {
      for (const s of [-1, 1]) {
        const high = s < 0;
        const ax = x + s * 2.2;
        const ay = sy + 1.2;
        openWing(ax, ay, ax + s * (high ? 2.6 : 4.4), ay - (high ? 5.8 : 4.8), ax + s * (high ? 5.2 : 9.4), ay - (high ? 8.6 : 2.2), ax + s * (high ? 1.4 : 2.8), y - (high ? 1.6 : 0.6), s, 0);
      }
    }
  }

  // Leather jesses hanging from its legs, and the yellow feet gripping, black talons at their tips.
  const feet = (fx: number[]) => {
    c.part();
    for (const f of fx) {
      c.px(f, y, B.foot, sphere(0, -0.3));
      c.px(f + (f < x ? -1 : 1), y, B.beak, sphere(0, 0.2), { bias: -1 });
    }
    c.part();
    c.px(x + 0.4, y + 1, S.strap, sphere(0, 0.2));
    c.px(x + 0.9, y + 2, S.strap, sphere(0, 0.4), { bias: -1 });
    c.px(x - 0.7, y + 1, S.strap, sphere(0, 0.3), { bias: -1 });
  };

  let hx: number;
  let hy: number;
  if (side) {
    // Facing left: the long tail down behind, the body hunched forward, the folded wing along its back.
    c.part();
    c.capsule(x + 2.0, y - 1.2, x + 3.8 + fat, y + 3.8, 1.4, 1.0, B.tail);
    for (const k of [0.45, 0.75]) c.shade(x + 2 + (1.8 + fat) * k, y - 1.2 + 5 * k, -1);
    c.part();
    c.capsule(x + 1.4, y - 2, x - 0.4, sy + 2.2, 2.4 + fat, 2.8 + fat, B.back);
    c.part();
    c.shape(Math.round(sy + 1), Math.round(y - 1), (yy) => {
      const u = (yy - (sy + 1)) / (y - 1 - (sy + 1));
      const fx = x - 3 - fat - Math.sin(u * Math.PI) * 0.6 + u * 1.8;
      return [fx, fx + 2.4];
    }, B.breast, (_x, _y, t, u) => sphere(t * 0.6 - 0.4, u * 0.6 - 0.2, 1));
    for (let yy = Math.round(sy + 2); yy <= y - 2; yy += 2) c.shade(x - 1.8 + ((yy & 2) ? 0.6 : 0), yy, -1);
    c.part();
    c.ellipse(x - 0.6, y - 1.4, 1.5, 1.7, B.bar, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6, 1) });
    c.shade(x - 0.4, y - 1, -1);
    if (folded) {
      c.part();
      c.capsule(x + 0.2, sy + 1.6, x + 3, y + 0.2, 2.0 + fat * 0.6, 1.0, B.back, { bias: -1 });
      c.part();
      c.shape(Math.round(sy + 0.6), Math.round(sy + 3.4), (yy) => {
        const u = (yy - sy - 0.6) / 2.8;
        return [x - 1.4 + u * 1.2, x + 1.8 + u * 0.6];
      }, B.bar, (_x, _y, t, u) => sphere(t * 0.6, u * 0.4 - 0.5, 1));
      c.part();
      c.capsule(x + 1.6, y - 2.4, x + 3.6, y + 1.8, 1.1, 0.5, B.primary);
    }
    feet([x - 1.4]);
    hx = x - 1.6;
    hy = sy - 1.2;
    if (w === 'eat') {
      hx -= 1.8;
      hy += 2.2;
    } else if (w === 'gulp') {
      hy -= 0.6;
      hx += 0.2;
    } else if (w === 'preen') {
      hx += 2.2;
      hy += 2;
    } else if (w === 'ruffle') hy += 0.6;
  } else {
    // Front or back: the tail below, the folded wings broad at the shoulder and narrowing to their crossed tips.
    c.part();
    c.capsule(x, y - 1, x + (back ? 0 : 0.3), y + 4.2, 1.6, 1.2, B.tail);
    for (const yy of [y + 1.6, y + 3.2]) for (const dx of [-1, 0, 1]) c.shade(x + dx, yy, -1);
    const foldWings = () => {
      c.part();
      c.shape(Math.round(sy), Math.round(y + 2), (yy) => {
        const u = Math.max(0, (yy + 0.5 - sy) / (y + 2 - sy));
        const hw = (u < 0.3 ? 3.2 + u * 1.4 : 3.6 - (u - 0.3) * 3) + fat;
        return [x - hw, x + hw];
      }, B.back, (_x, _y, t, u) => sphere(t * 0.9, u * 0.7 - 0.45, 1), { bias: back ? 0 : -1 });
      // Tawny shoulders, near-black tips crossed below.
      c.part();
      for (let yy = Math.round(sy); yy <= sy + 3; yy++)
        for (let xx = Math.round(x - 4 - fat); xx <= x + 4 + fat; xx++) {
          const m = c.materialAt(xx, yy);
          if (m !== B.back) continue;
          if (back ? yy < sy + 2 || (yy < sy + 3 && Math.abs(xx + 0.5 - x) > 1.6) : Math.abs(xx + 0.5 - x) > 1.6) c.px(xx, yy, B.bar, sphere(Math.sign(xx + 0.5 - x) * 0.5, -0.5));
        }
      for (let yy = Math.round(y - 1); yy <= y + 2; yy++)
        for (let xx = Math.round(x - 3); xx <= x + 3; xx++) if (c.materialAt(xx, yy) === B.back) c.px(xx, yy, B.primary, sphere(Math.sign(xx + 0.5 - x) * 0.5, 0.3));
      // The edges of the feathers, rows of them down the wing.
      for (let yy = Math.round(sy + 4); yy < y - 1; yy += 2)
        for (const s of [-1, 1]) c.shade(x + s * 2.4, yy, -1);
    };
    foldWings();
    if (!back) {
      // The dark breast between them, streaked, and the tawny leggings under it.
      c.part();
      c.shape(Math.round(sy + 1), Math.round(y - 2), (yy) => {
        const u = (yy + 0.5 - sy - 1) / (y - 3 - sy);
        const hw = 1.9 + fat * 0.8 - Math.max(0, u - 0.6) * 1.2;
        return [x - hw, x + hw];
      }, B.breast, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6 - 0.3, 1));
      for (let yy = Math.round(sy + 2); yy <= y - 3; yy += 2) c.shade(x - 0.6 + ((yy & 2) ? 1 : 0), yy, -1);
      c.part();
      for (const s of [-1, 1]) {
        c.ellipse(x + s * 1.1, y - 1.5, 1.2, 1.4, B.bar, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8 + s * 0.2, dy * 0.6, 1) });
        c.shade(x + s * 1.1, y - 2, -1);
      }
      feet([x - 1.4, x + 1.0]);
    } else {
      c.shade(x, sy + 3, -1);
      c.shade(x, sy + 5, -1);
    }
    hx = x + peer * 0.6;
    hy = sy - 1.4;
    if (w === 'eat') {
      hx -= 1.8;
      hy += 2;
    } else if (w === 'gulp') hy -= 0.6;
    else if (w === 'preen') {
      hx += 2;
      hy += 2.2;
    } else if (w === 'ruffle') hy += 0.6;
  }
  eagleHead(c, hx, hy, view, w, peer, leather);
}

/**
 * The hooded eagle's head at (hx, hy): golden all round its nape and cheeks,
 * the leather hood a snug cap over its crown and eyes, tooled with a gold
 * boss and tufted with a gold-and-white plume, the cere and the great dark
 * hook of the beak out under it.
 */
function eagleHead(c: PixelCanvas, hx: number, hy: number, view: View, w: Wing, peer: number, leather: Material): void {
  const B = S.bird;
  const gold = S.berkut?.gold ?? B.foot;
  const plume = S.berkut?.stitch ?? B.breast;
  const hackles = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = Math.round(y0); y <= y1; y++)
      for (let x = Math.round(x0); x <= x1; x++) if (c.materialAt(x, y) === B.hood && (x + y * 2) % 3 === 0) c.shade(x, y, -1);
  };
  const plumeAt = (px: number, py: number, lean: number) => {
    c.part();
    c.px(px, py, gold, sphere(-0.2, -0.5));
    c.part();
    c.px(px + lean * 0.6, py - 1, plume, sphere(-0.3, -0.5));
    c.px(px + lean * 1.4, py - 1.4, plume, sphere(0.3, -0.4), { bias: -1 });
  };
  if (view === 'up') {
    // From behind: the golden nape and hackles, the back of the hood laced shut, its braces hanging.
    c.part();
    c.ellipse(hx, hy + 0.4, 2.4, 2.3, B.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.1, 1) });
    hackles(hx - 2.4, hx + 2.4, hy, hy + 3);
    c.part();
    c.ellipse(hx, hy - 0.8, 1.8, 1.4, leather, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 1) });
    c.part();
    c.px(hx, hy - 0.4, gold, sphere(0, 0));
    c.px(hx - 0.8, hy + 0.6, S.strap, sphere(-0.2, 0.2));
    c.px(hx - 1, hy + 1.6, S.strap, sphere(-0.2, 0.4), { bias: -1 });
    c.px(hx + 0.8, hy + 0.6, S.strap, sphere(0.2, 0.2));
    plumeAt(hx, hy - 2.3, 1);
    return;
  }
  // From the side it faces her way. From the front its body faces the viewer but its head is
  // turned in profile, away from her (towards her when it peers her way or takes a morsel):
  // the hook of the beak is what tells an eagle.
  const d = view === 'side' || peer < 0 || w === 'eat' || w === 'gulp' ? -1 : 1;
  eagleProfile(c, hx, hy, d, w, leather);
}

/** The hooded eagle's head in profile at (hx, hy), its beak towards `d` (-1 left, 1 right). */
function eagleProfile(c: PixelCanvas, hx: number, hy: number, d: number, w: Wing, leather: Material): void {
  const B = S.bird;
  const gold = S.berkut?.gold ?? B.foot;
  const plume = S.berkut?.stitch ?? B.breast;
  const X = (dx: number) => hx + dx * -d;
  // The golden head and its hackles running down its nape, the hood over its crown and eye.
  c.part();
  c.ellipse(X(0.6), hy + 1.6, 2.2, 1.6, B.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.5, 1) });
  c.ellipse(X(0), hy + 0.1, 2.5, 2.2, B.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.7 - 0.1, 1) });
  for (let y = Math.round(hy + 1); y <= hy + 3.4; y++)
    for (let x = Math.round(X(0) - 3); x <= X(0) + 3; x++) if (c.materialAt(x, y) === B.hood && (x + y * 2) % 3 === 0) c.shade(x, y, -1);
  c.part();
  c.ellipse(X(-0.4), hy - 0.8, 1.8, 1.2, leather, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - d * 0.1, dy * 0.8 - 0.3, 1) });
  c.part();
  c.px(X(-1), hy - 0.6, gold, sphere(d * 0.3, -0.2));
  c.px(X(1.2), hy + 0.2, S.strap, sphere(-d * 0.3, 0.1));
  c.px(X(1.8), hy + 1.2, S.strap, sphere(-d * 0.3, 0.3), { bias: -1 });
  // The cere and the great hook of the beak, its gape running back under the hood.
  c.part();
  if (w === 'gulp') {
    c.px(X(-2.2), hy - 0.4, B.foot, sphere(d * 0.4, -0.5));
    c.px(X(-3), hy - 1, B.beak, sphere(d * 0.5, -0.6), { bias: 1 });
    c.px(X(-3.6), hy - 0.4, B.beak, sphere(d * 0.5, -0.2), { bias: -1 });
  } else {
    c.px(X(-2.2), hy + 0.2, B.foot, sphere(d * 0.4, -0.4));
    c.px(X(-1.6), hy + 1, B.foot, sphere(d * 0.2, 0), { bias: -1 });
    c.px(X(-3), hy + 0.2, B.beak, sphere(d * 0.5, -0.5), { bias: 1 });
    c.px(X(-3), hy + 1.1, B.beak, sphere(d * 0.5, 0.1));
    c.px(X(-3.8), hy + 0.9, B.beak, sphere(d * 0.6, -0.2), { bias: 1 });
    c.px(X(-3.8), hy + 1.9, B.beak, sphere(d * 0.5, 0.5), { bias: -1 });
    if (w === 'cry' || w === 'eat') {
      c.px(X(-2.8), hy + 2.4, B.beak, sphere(d * 0.4, 0.5), { bias: -1 });
      c.erase(X(-3), hy + 1.6);
    }
  }
  // The plume: a gold knot, a white tuft lying back.
  c.part();
  c.px(X(0), hy - 2.1, gold, sphere(-0.2, -0.5));
  c.part();
  c.px(X(0.8), hy - 2.6, plume, sphere(-d * 0.3, -0.5));
  c.px(X(1.6), hy - 2.4, plume, sphere(-d * 0.3, -0.3), { bias: -1 });
}

/** The bird's head at (hx, hy): the falcon's dark hood, moustache and hooked beak. */
function perchedHead(c: PixelCanvas, hx: number, hy: number, view: View, w: Wing, peer: number): void {
  const B = S.bird;
  const r = 1.95;
  c.part();
  if (view === 'up') {
    c.ellipse(hx, hy, r, r * 0.95, B.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
    return;
  }
  if (view === 'side') {
    c.ellipse(hx, hy, r, r * 0.92, B.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.1, dy * 0.8 - 0.1, 1) });
    {
      // Cream cheek and throat under the dark hood, the moustache streak, the eye, the beak.
      c.part();
      c.shape(Math.round(hy), Math.round(hy + 1.6), () => [hx - 2, hx + 0.2], B.breast, (_x, _y, t) => sphere(t * 0.6 - 0.3, 0.3, 1));
      c.px(hx - 1, hy + 1, B.hood, sphere(-0.2, 0.2));
      c.part();
      c.px(hx - 1, hy - 0.5, B.eye, sphere(-0.3, -0.3));
      c.part();
      c.px(hx - 2.2, hy - 0.2, B.foot, sphere(-0.5, -0.4));
      c.px(hx - 3.0, hy + 0.2, B.beak, sphere(-0.6, -0.2));
      c.px(hx - 3.0, hy + 1.0, B.beak, sphere(-0.5, 0.5), { bias: -1 });
      if (w === 'cry') c.px(hx - 3.0, hy + 2.0, B.beak, sphere(-0.5, 0.5));
    }
    return;
  }
  // From the front.
  c.ellipse(hx, hy, r, r * 0.92, B.breast, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // The falcon's dark crown down over its eyes, its moustache streaks on the cream cheeks.
  c.part();
  c.shape(Math.round(hy - 1.9), Math.round(hy - 0.9), (yy) => {
    const u = (yy - (hy - 1.9)) / 1.0;
    const hw = 1.9 - u * 0.1;
    return [hx - hw + peer * 0.3, hx + hw + peer * 0.3];
  }, B.hood, (_x, _y, t) => sphere(t * 0.8, -0.5, 1));
  const ex = hx + peer * 0.7;
  if (w === 'preen') {
    c.px(hx + 1.4, hy + 0.2, B.hood, sphere(0.4, 0));
    return;
  }
  for (const s of [-1, 1]) {
    if (peer * s < 0 && Math.abs(peer) > 0.5) continue;
    c.part();
    c.px(ex + s * 1.1, hy - 0.4, B.eye, sphere(s * 0.3, -0.3));
    c.px(ex + s * 1.1, hy + 0.7, B.hood, sphere(s * 0.4, 0.2));
  }
  c.part();
  const bx = ex + peer * 0.8;
  if (w === 'gulp') {
    c.px(bx, hy - 0.8, B.foot, sphere(0, -0.6));
    c.px(bx, hy - 1.6, B.beak, sphere(0, -0.6));
  } else {
    c.px(bx, hy + 0.4, B.foot, sphere(0, -0.3));
    c.px(bx, hy + 1.3, B.beak, sphere(0, 0.3));
    if (w === 'cry' || w === 'eat') c.px(bx, hy + 2.3, B.beak, sphere(0, 0.5), { bias: -1 });
  }
}

// ---------------------------------------------------------------------------
// Her head

/** The face, hair, cap and feather (or Berkut's fox-fur hat), from the front. */
function headFront(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const fy = 12.6 + U;
  if (S.berkut) {
    // Black hair behind the face, the fox-fur ear flaps, the face, then the hat.
    c.part();
    c.ellipse(cx, 11.8 + U, 3.6, 3.4, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    earFlaps(c, cx, U, 3.5);
    c.part();
    c.ellipse(cx, fy, 2.6, 2.4, SKIN);
    c.part();
    c.px(cx - 2.6, 11.2 + U, S.hair, sphere(-0.6, 0.1));
    c.px(cx + 2.2, 11.2 + U, S.hair, sphere(0.5, 0.1), { bias: -1 });
    foxHat(c, cx, U, 'down', p.sway);
  } else {
    // Hair behind the face, the face, the fringe swept to one side.
    c.part();
    c.ellipse(cx, 11.6 + U, 3.7, 3.6, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    c.part();
    c.ellipse(cx, fy, 2.6, 2.4, SKIN);
    c.part();
    c.shape(Math.round(10 + U), Math.round(10 + U), () => [cx - 2.6, cx + 2.6], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(cx - 2, 11 + U, S.hair, sphere(-0.4, 0.2));
    c.px(cx - 3, 11 + U, S.hair, sphere(-0.6, 0.2));
    c.px(cx + 2, 11 + U, S.hair, sphere(0.4, 0.1), { bias: -1 });
    // The cap: a soft crown of felt over a turned-up band, set back on her head and tipped to one side.
    c.part();
    c.ellipse(cx + 0.4, 8.4 + U, 3.9, 2.3, S.cap, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
    c.part();
    c.shape(Math.round(9.6 + U), Math.round(10.2 + U), () => [cx - 4.1, cx + 4.3], S.capBand, (_x, _y, t) => cyl(t, 0.2));
    c.shade(cx + 2, 10 + U, -1);
    // The feather, from the band over her right ear, sweeping up and back.
    capFeather(c, [[cx - 3.4, 9.4 + U], [cx - 5.0, 8.2 + U], [cx - 6.4, 6.6 + U], [cx - 7.4, 5.4 + U]]);
  }
  // Eyes (on the bird when she looks at it), a mouth.
  c.part();
  const look = p.glance ? 1 : 0;
  for (const ex of [cx - 1.5, cx + 1.2]) {
    if (p.blink) c.px(ex + look * 0.5, 12.2 + U, SKIN, sphere(0, -0.3), { bias: -1 });
    else c.px(ex + look * 0.5, 12.2 + U, S.eye);
  }
  for (let x = cx - 2; x <= cx + 1; x++) c.shade(x, 11.4 + U, -1);
  if (p.whistle) {
    // Pursed lips round two fingers.
    c.px(cx, 14.2 + U, S.lip, sphere(0, 0));
  } else {
    c.px(cx - 0.4, 14.4 + U, S.lip, sphere(0, 0.2));
  }
  c.shade(cx - 1, 14.8 + U, -1);
}

/** Her head from behind: the hair, the cap, the feather's sweep over it (Berkut: two braids, the fox-fur hat). */
function headBack(c: PixelCanvas, cx: number, U: number, sway = 0): void {
  if (S.berkut) {
    c.part();
    c.ellipse(cx, 11.6 + U, 3.6, 3.5, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
    for (let y = 11; y <= 14; y++) c.shade(cx, y + U, -1);
    for (const s of [-1, 1]) braid(c, [[cx + s * 1.5, 13.6 + U], [cx + s * 2.1, 16.4 + U], [cx + s * 2.2 + sway * 0.3, 19.4 + U]]);
    earFlaps(c, cx, U, 3.5);
    foxHat(c, cx, U, 'up', sway);
    return;
  }
  c.part();
  c.ellipse(cx, 11.6 + U, 3.7, 3.6, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 1) });
  for (let y = 11; y <= 14; y++) c.shade(cx - 1 + (y & 1), y + U, -1);
  c.part();
  c.ellipse(cx - 0.4, 8.4 + U, 3.9, 2.3, S.cap, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.9 - 0.3, 1) });
  c.part();
  c.shape(Math.round(9.6 + U), Math.round(10.2 + U), () => [cx - 4.3, cx + 4.1], S.capBand, (_x, _y, t) => cyl(t, 0.2));
  capFeather(c, [[cx + 3.4, 9.4 + U], [cx + 5.0, 8.2 + U], [cx + 6.4, 6.6 + U], [cx + 7.4, 5.4 + U]]);
}

/** Her head facing left: the profile under the cap, the feather sweeping back, the braid down her back. */
function headSide(c: PixelCanvas, hx: number, U: number, p: Pose): void {
  if (S.berkut) {
    // The braid behind, the black hair, the face, the near ear flap, then the hat tipped a little back.
    braid(c, [[hx + 2.2, 12.6 + U], [hx + 3 + p.sway * 0.3, 15.4 + U], [hx + 3.2 + p.sway * 0.6, 18.6 + U]], -1);
    c.part();
    c.ellipse(hx + 0.6, 11.8 + U, 3.2, 3.2, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
    c.part();
    c.px(hx - 3.9, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 3, 14 + U, -1);
    c.part();
    c.px(hx - 3.2, 11.2 + U, S.hair, sphere(-0.5, 0.1));
    c.part();
    c.capsule(hx + 0.9, 10.8 + U, hx + 0.7, 14 + U, 1.5, 1.1, S.berkut.fur, { bias: -1 });
    furry(c, S.berkut.fur, hx - 1, hx + 3, 10 + U, 16 + U, 4);
    foxHat(c, hx, U, 'side', p.sway);
  } else {
    // The braid first, hanging behind her.
    braid(c, [[hx + 2.2, 12.6 + U], [hx + 3 + p.sway * 0.3, 15.4 + U], [hx + 3.2 + p.sway * 0.6, 18.6 + U]], -1);
    c.part();
    c.ellipse(hx + 0.6, 11.6 + U, 3.2, 3.4, S.hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.2, dy * 0.8 - 0.1, 1) });
    c.part();
    c.ellipse(hx - 1.4, 12.8 + U, 2.2, 2.2, SKIN);
    c.part();
    c.px(hx - 3.9, 12.6 + U, SKIN, sphere(-0.7, -0.1), { bias: 1 });
    c.shade(hx - 3, 14 + U, -1);
    c.part();
    c.shape(Math.round(10.2 + U), Math.round(10.2 + U), () => [hx - 3.6, hx + 0.6], S.hair, (_x, _y, t) => sphere(t * 0.8, -0.3, 1));
    c.px(hx + 0.2, 11 + U, S.hair, sphere(0.3, 0.2));
    // The cap tipped forward, its feather sweeping back over the crown.
    c.part();
    c.ellipse(hx + 0.6, 8.4 + U, 3.6, 2.3, S.cap, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 + 0.1, dy * 0.9 - 0.3, 1) });
    c.part();
    c.shape(Math.round(9.6 + U), Math.round(10.2 + U), () => [hx - 3.4, hx + 3.6], S.capBand, (_x, _y, t) => cyl(t, 0.2));
    capFeather(c, [[hx + 1.8, 9.2 + U], [hx + 4.4, 7.4 + U], [hx + 6.6, 6.2 + U], [hx + 8.4, 6.0 + U]]);
  }
  c.part();
  if (p.blink) c.px(hx - 3, 12.2 + U, SKIN, sphere(0, -0.3), { bias: -1 });
  else c.px(hx - 3, 12.2 + U, S.eye);
}

/** Berkut's fox-fur ear flaps, hanging either side of her face (`r` out from its middle). */
function earFlaps(c: PixelCanvas, cx: number, U: number, r: number): void {
  const fur = S.berkut!.fur;
  c.part();
  for (const s of [-1, 1]) c.capsule(cx + s * r, 10.4 + U, cx + s * (r - 0.3), 13.8 + U, 1.4, 1.1, fur, { bias: -1 });
  furry(c, fur, cx - r - 2, cx + r + 2, 10 + U, 16 + U, 5);
}

/**
 * Berkut's tall hat at (cx, U): a great round of russet fox fur standing up
 * from her brow, ragged at its edges, and set into its top a small crown of
 * red felt seamed in gold, a red tassel on a cord at its peak. From the side
 * it tips a little back and the tassel swings behind.
 */
function foxHat(c: PixelCanvas, cx: number, U: number, view: View, sway: number): void {
  const D = S.berkut!;
  const back = view === 'side' ? 1 : 0;
  const top = 3.8 + U;
  // The crown, a felt dome rising out of the fur.
  c.part();
  const crownX = cx + back * 0.8;
  c.shape(Math.round(top), Math.round(7 + U), (y) => {
    const u = Math.max(0, (y + 0.5 - top) / (7 + U - top));
    const hw = 1.2 + 1.7 * Math.sqrt(u);
    return [crownX - hw, crownX + hw];
  }, S.cap, (_x, _y, t, u) => sphere(t * 0.85, u * 0.5 - 0.6, 1));
  // Its seam in gold, quartering it.
  c.part();
  for (let y = Math.round(top) + 1; y <= 6 + U; y++) {
    const x = crownX - (view === 'side' ? 0.8 : 0.5);
    if (c.materialAt(x, y) === S.cap) c.px(x, y, D.gold, sphere(-0.1, -0.3), { bias: y === Math.round(top) + 1 ? 1 : 0 });
  }
  // The fur: a round of it, thick and ragged, standing tall round her head.
  c.part();
  const bx = cx + back * 0.3;
  const by = 8.4 + U;
  const rx = view === 'side' ? 4.3 : 4.6;
  c.ellipse(bx, by, rx, 2.6, D.fur, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.75 - 0.15, 1) });
  // Tufts breaking its outline, and a shadow under its lip where it meets her brow.
  for (const [dx, dy] of [[-4.8, -0.6], [4.6, 0.4], [-3.8, -2.2], [3.6, -2.0], [-1.6, -2.9], [1.8, -2.8], [-4.4, 1.4], [4.2, 1.6]] as const) {
    c.px(bx + dx, by + dy, D.fur, sphere(dx * 0.2, dy * 0.35 - 0.1), { bias: dy < 0 ? 1 : 0 });
  }
  furry(c, D.fur, bx - 6, bx + 6, by - 4, by + 3, 2);
  // Dark streaks down the pelt, where the fox's guard hairs part.
  for (const dx of [-2.6, 0.4, 3]) {
    if (view === 'side' && dx > 2) continue;
    c.shade(bx + dx, by - 0.6, -1);
    c.shade(bx + dx + 0.4, by + 0.6, -1);
  }
  // The tassel: a gold knot at the peak, a red cord swinging off it to a tuft.
  const kx = crownX;
  const sw = sway * 0.4 + (view === 'side' ? 0.8 : 0);
  const dir = view === 'up' ? -1 : 1;
  c.part();
  c.px(kx, top - 0.6, D.gold, sphere(-0.2, -0.6), { bias: 1 });
  c.part();
  c.line(kx + dir * 0.6, top - 0.4, kx + dir * (1.6 + sw), top + 0.6, D.tassel, () => sphere(dir * 0.3, -0.3));
  c.part();
  const tx = kx + dir * (2.0 + sw);
  c.px(tx, top + 1.4, D.tassel, sphere(-0.3, 0.1));
  c.px(tx + dir, top + 1.6, D.tassel, sphere(0.3, 0.2), { bias: -1 });
  c.px(tx + dir * 0.5, top + 2.4, D.tassel, sphere(0, 0.5), { bias: -1 });
}

// ---------------------------------------------------------------------------
// Directions

const REACH_FRONT = 4.4;
const REACH_SIDE = 5.2;

/** The gambeson's outline: broad at the chest, nipped at the belt, its skirts flaring to mid-thigh. */
function coatWidth(y: number, top: number, waist: number, chest: number): number {
  if (y <= waist) {
    const u = (y + 0.5 - top) / (waist - top);
    return chest - 0.6 * u * u;
  }
  return chest - 0.5 + (y - waist) * 0.3;
}

/** Berkut's wide belt: silver plaques along it two rows tall, and a buckle (one pixel per x given). */
function beltPlaques(c: PixelCanvas, at: number[], waist: number, buckle: number[] | null): void {
  const D = S.berkut!;
  for (const x of at) {
    c.px(x, waist, D.plaque, sphere(-0.2, -0.5));
    c.px(x, waist + 1, D.plaque, sphere(-0.2, 0.3), { bias: -1 });
  }
  if (buckle) {
    for (const x of buckle) {
      c.px(x, waist, S.buckle, sphere(x - buckle[0] - 0.5, -0.4), { bias: 1 });
      c.px(x, waist + 1, S.buckle, sphere(x - buckle[0] - 0.5, 0.4));
    }
  }
}

/**
 * The back of Berkut's coat: a medallion of indigo felt on the skirts under
 * her belt, a pair of ram's horns curling out from a stem in white and gold.
 */
function hornMedallion(c: PixelCanvas, cx: number, y: number): void {
  const D = S.berkut!;
  c.part();
  c.ellipse(cx, y + 1.5, 2.9, 2.2, D.felt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 - 0.1, 1) });
  c.part();
  // The stem, gold, and the horns curling out and down from its top, white.
  c.px(cx - 0.5, y + 1, D.gold, sphere(0, -0.3));
  c.px(cx - 0.5, y + 2, D.gold, sphere(0, 0.1));
  c.px(cx - 0.5, y + 3, D.gold, sphere(0, 0.3));
  for (const s of [-1, 1]) {
    const o = s < 0 ? -0.5 : -0.5;
    c.px(cx + o + s * 1, y, D.stitch, sphere(s * 0.3, -0.4));
    c.px(cx + o + s * 2, y + 0.4, D.stitch, sphere(s * 0.4, -0.3));
    c.px(cx + o + s * 2.2, y + 1.6, D.stitch, sphere(s * 0.5, 0));
    c.px(cx + o + s * 1.4, y + 2, D.stitch, sphere(s * 0.3, 0.2));
  }
}

function drawDown(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const air = p.air ?? 0;
  const fa = place('down', 'a', p.a, U, cx);
  const fb = place('down', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 1], false, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 1], true, fb.behind ? -1 : 0);
  const head = (draw: () => void) => {
    c.offset(BODY_X + (p.headX ?? 0), BODY_Y + (p.headY ?? 0));
    draw();
    c.offset(BODY_X, BODY_Y);
  };

  // The quiver at her right hip, behind her coat.
  quiver(c, 6.2, 20.6 + U, 5.2, 26.4 + L, -1);
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (fb.behind) drawBow(c, 'down', p, fa, fb, -1);

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footA - air);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footB - air);
  boot(c, 10, 29.6 - p.footA - air);
  boot(c, 14, 29.6 - p.footB - air);

  // The gambeson, quilted, split at the front below the belt (Berkut's felt coat longer, to the shin).
  const top = 15 + U;
  const waist = 22 + U;
  const hem = (S.berkut ? 28 : 26) + L;
  const edges = (y: number): [number, number] => {
    const hw = coatWidth(y, top, waist, 4.6);
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway * 0.5 : 0;
    return [cx - hw + sw, cx + hw + sw];
  };
  c.part();
  c.shape(top, hem, edges, S.coat, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  quilt(c, cx - 5.6, cx + 5.6, top + 2, hem - 1);
  for (let y = top + 1; y <= hem; y++) c.shade(cx, y, -1);
  for (let y = waist + 1; y <= hem; y++) c.erase(cx, y);
  if (S.berkut) {
    const felt = S.berkut.felt;
    // Indigo borders down the front edges and round the hem, worked in ram's horns.
    c.part();
    c.shape(top + 3, waist - 1, () => [cx - 1, cx + 1], felt, (_x, _y, t) => sphere(t * 0.5, -0.1, 1));
    c.shape(waist + 1, hem, (y) => {
      const [l] = edges(y);
      const sw = (edges(y)[0] + edges(y)[1]) / 2 - cx;
      return [Math.max(l, cx - 2 + sw), cx + sw];
    }, felt, (_x, _y, t) => sphere(t * 0.5 - 0.2, 0.2, 1));
    c.shape(waist + 1, hem, (y) => {
      const sw = (edges(y)[0] + edges(y)[1]) / 2 - cx;
      return [cx + 1 + sw, cx + 3 + sw];
    }, felt, (_x, _y, t) => sphere(t * 0.5 + 0.2, 0.2, 1));
    c.shape(hem - 1, hem, edges, felt, (_x, _y, t) => cyl(t, 0.3));
    for (let y = waist + 1; y <= hem; y++) c.erase(cx + Math.round(((y - waist) / (hem - waist)) * p.sway * 0.5), y);
    ornament(c, cx - 1, cx, top + 3, waist - 1, false);
    ornament(c, cx - 2.5, cx - 1, waist + 1, hem - 2, false, 1);
    ornament(c, cx + 1, cx + 2.5, waist + 1, hem - 2, false, 1);
    ornament(c, cx - 7, cx + 7, hem - 1, hem, true);
  }
  // The shirt at the open collar, the coat's quilted collar standing round it (Berkut: a stand collar of indigo, a gold clasp).
  c.part();
  c.shape(top, top + 2, (y) => {
    const v = 1.8 - (y - top) * 0.7;
    return v < 0.3 ? null : [cx - v, cx + v];
  }, S.shirt, (_x, _y, t) => sphere(t * 0.7, -0.2, 1));
  if (S.berkut) {
    c.part();
    c.px(cx - 0.5, top + 2, S.berkut.gold, sphere(-0.3, -0.4));
  }
  // The belt and buckle (Berkut's wide, set with silver plaques); the hawking bag at her left hip.
  c.part();
  c.shape(waist, waist + (S.berkut ? 1 : 0), () => [cx - 4.1, cx + 4.1], S.strap, (_x, _y, t) => cyl(t, 0));
  c.part();
  if (S.berkut) beltPlaques(c, [cx - 3.4, cx + 2.6], waist, [cx - 1, cx]);
  else c.px(cx - 1, waist, S.buckle, sphere(-0.2, -0.3));
  hawkingBag(c, 16.2, 23.4 + U, 0, p.sway);
  // The quiver's strap over her left shoulder down to her right hip.
  c.part();
  c.capsule(15.2, 15.6 + U, 7.6, 21.6 + U, 0.5, 0.5, S.strap);
  // The leather pad on her left shoulder, where the bird sits.
  c.part();
  c.ellipse(16.4, 15.2 + U, 2.6, 1.5, S.pad, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.5, 1) });
  c.shade(15, 16 + U, -1);

  if (!S.berkut) braid(c, [[8.4, 13.6 + U], [7.6, 16.2 + U], [7.8 + p.sway * 0.3, 19.6 + U]]);
  head(() => headFront(c, cx, U, p));
  // Berkut's braid falls in front of her ear flap, over her shoulder.
  if (S.berkut) braid(c, [[8.6, 14.6 + U], [7.8, 17 + U], [8 + p.sway * 0.3, 20.2 + U]]);

  if (p.bird === 'shoulder') perched(c, 16.6, 14.2 + U - (p.birdUp ?? 0), 'down', p);
  if (!fb.behind) armB();
  if (!fb.behind) drawBow(c, 'down', p, fa, fb, 0);
  if (p.bird === 'fist') perched(c, fb.x, fb.y - 1.6, 'down', p);
  if (!fa.behind) armA();
  if (p.morsel) {
    c.part();
    c.px(fa.x + 0.6, fa.y - 1.4, MEAT, sphere(-0.3, -0.4));
    c.px(fa.x + 1.4, fa.y - 1.2, MEAT, sphere(0.3, -0.2), { bias: -1 });
  }
  if (p.whistle) whistleNotes(c, cx + 2.4, 13 + U, p.whistle);
  if (p.down) {
    c.part();
    c.px(p.down[0], p.down[1], S.bird.breast, sphere(-0.3, -0.4));
    c.px(p.down[0] + 1, p.down[1], S.bird.breast, sphere(0.3, -0.2), { bias: -1 });
  }
}

/** A morsel of meat for the bird. */
const MEAT: Material = mat(['#4a0a0c', '#7a1418', '#a82a2a', '#d0504a'], '#1a0204');

/** The whistle: two thin notes of light lifting off her lips. */
function whistleNotes(c: PixelCanvas, x: number, y: number, k: number): void {
  const [core, hot, mid] = S.light;
  for (let i = 0; i < 3; i++) {
    const a = k * (1 - i * 0.28);
    c.spark(x + i * 1.2, y - i * 1.4, i === 0 ? core : i === 1 ? hot : mid, a);
  }
  c.spark(x + 2.8, y - 1, mid, k * 0.5);
}

function drawUp(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const air = p.air ?? 0;
  const fa = place('up', 'a', p.a, U, cx);
  const fb = place('up', 'b', p.b, U, cx);
  const armA = () => arm(c, 7.4, 16.4 + U, fa, REACH_FRONT, [-0.5, 0.8], false, fa.behind ? -1 : 0);
  const armB = () => arm(c, 16.6, 16.4 + U, fb, REACH_FRONT, [0.5, 0.8], true, fb.behind ? -1 : 0);
  if (fa.behind) armA();
  if (fb.behind) armB();
  if (fb.behind) drawBow(c, 'up', p, fa, fb, -1);

  leg(c, 10.2, 24.5 + L, 10, 28.4 - p.footB - air);
  leg(c, 13.8, 24.5 + L, 14, 28.4 - p.footA - air);
  boot(c, 10, 29.6 - p.footB - air);
  boot(c, 14, 29.6 - p.footA - air);

  const top = 15 + U;
  const waist = 22 + U;
  const hem = (S.berkut ? 28 : 26) + L;
  hawkingBag(c, 7.8, 23.4 + U, -1, -p.sway);
  const edges = (y: number): [number, number] => {
    const hw = coatWidth(y, top, waist, 4.6);
    const sw = y > waist ? ((y - waist) / (hem - waist)) * p.sway * 0.5 : 0;
    return [cx - hw + sw, cx + hw + sw];
  };
  c.part();
  c.shape(top, hem, edges, S.coat, (_x, y, t) => sphere(t * 0.9, y <= waist ? ((y - top) / (waist - top)) * 0.6 - 0.1 : 0.3, 1));
  quilt(c, cx - 5.6, cx + 5.6, top + 1, hem - 1);
  if (S.berkut) {
    // The hem's indigo border, and a great ram's-horn medallion worked across her shoulders.
    const felt = S.berkut.felt;
    c.part();
    c.shape(hem - 1, hem, edges, felt, (_x, _y, t) => cyl(t, 0.3));
    ornament(c, cx - 7, cx + 7, hem - 1, hem, true);
    hornMedallion(c, cx + p.sway * 0.3, waist + 1.6);
  } else {
    // A vent up the back of the skirts.
    for (let y = waist + 2; y <= hem; y++) c.shade(cx, y, -2);
  }
  c.part();
  c.shape(waist, waist + (S.berkut ? 1 : 0), () => [cx - 4.1, cx + 4.1], S.strap, (_x, _y, t) => cyl(t, 0));
  if (S.berkut) {
    c.part();
    beltPlaques(c, [cx - 2.6, cx + 1.6], waist, null);
  }
  // The quiver at her hip and its strap across her back.
  quiver(c, 17.8, 20.6 + U, 18.8, 26.4 + L);
  c.part();
  c.capsule(8.8, 15.6 + U, 16.4, 21.6 + U, 0.5, 0.5, S.strap);
  c.part();
  c.ellipse(16.4, 15.2 + U, 2.6, 1.5, S.pad, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.5, 1) });
  // The collar, and her head.
  c.part();
  c.shape(top - 1, top, () => [cx - 2.6, cx + 2.6], S.berkut ? S.berkut.felt : S.coat, (_x, _y, t) => cyl(t, -0.2));
  headBack(c, cx, U, p.sway);
  if (!S.berkut) {
    // The braid's root, the rest of it over her shoulder in front.
    c.part();
    c.capsule(14.2, 13.4 + U, 15.0, 15.2 + U, 1.2, 1.0, S.hair, { bias: -1 });
  }
  if (p.bird === 'shoulder') perched(c, 16.6, 14.2 + U - (p.birdUp ?? 0), 'up', p);
  if (!fb.behind) armB();
  if (!fb.behind) drawBow(c, 'up', p, fa, fb, 0);
  if (p.bird === 'fist') perched(c, fb.x, fb.y - 1.6, 'up', p);
  if (!fa.behind) armA();
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): void {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;
  const hx = cx - p.lean;
  const air = p.air ?? 0;
  const fa = place('side', 'a', p.a, U, hx);
  const fb = place('side', 'b', p.b, U, hx);

  // The hawking bag on her far hip, behind.
  hawkingBag(c, hx + 3.2, 22.6 + U, -1, p.sway);
  // Far arm (the gauntlet) behind everything, and the bow it carries low.
  arm(c, hx + 1.2, 16.6 + U, fb, REACH_SIDE, [0.3, 1], true, -1);
  if (fb.behind && !p.raised) drawBow(c, 'side', p, fa, fb, -1);

  const lift = (f: number) => Math.max(0, f) * 0.35;
  leg(c, cx + 0.8, 24.5 + L, cx + 1 - p.footB, 28.4 - lift(p.footB) - air, -1);
  boot(c, cx + 0.4 - p.footB, 29.7 - lift(p.footB) - air, true, -1);
  leg(c, cx - 0.6, 24.5 + L, cx - 0.4 - p.footA, 28.4 - lift(p.footA) - air);
  boot(c, cx - 1.2 - p.footA, 29.7 - lift(p.footA) - air, true);

  // The gambeson in profile.
  const top = 15 + U;
  const waist = 22 + U;
  const hem = (S.berkut ? 28 : 26) + L;
  const edges = (y: number): [number, number] => {
    const u = y <= waist ? 0 : (y - waist) / (hem - waist);
    const shift = y <= waist ? hx : hx + (cx - hx) * u + u * p.sway * 0.6;
    const hw = coatWidth(y, top, waist, 3.2);
    return [shift - hw - 0.2, shift + hw + 0.2];
  };
  c.part();
  c.shape(top, hem, edges, S.coat, (_x, y, t) => sphere(t * 0.9 - 0.1, y <= waist ? ((y - top) / (waist - top)) * 0.8 - 0.35 : 0.3, 1));
  quilt(c, hx - 5, hx + 6, top + 2, hem - 1);
  if (S.berkut) {
    // The coat's front edge bordered in indigo down to the hem, and the hem's border round.
    const felt = S.berkut.felt;
    c.part();
    c.shape(top + 2, hem, (y) => {
      const [l] = edges(y);
      return [l, l + 2];
    }, felt, (_x, _y, t) => sphere(t * 0.5 - 0.4, 0, 1));
    c.shape(hem - 1, hem, edges, felt, (_x, _y, t) => cyl(t - 0.1, 0.3));
    ornament(c, hx - 6, hx - 1, top + 2, hem - 2, false);
    ornament(c, hx - 7, hx + 8, hem - 1, hem, true, 2);
  }
  c.part();
  c.shape(top, top + 1, () => [hx - 3, hx - 1], S.shirt, (_x, _y, t) => sphere(t * 0.7 - 0.3, -0.2, 1));
  c.part();
  c.shape(waist, waist + (S.berkut ? 1 : 0), () => [hx - 3.2, hx + 3.2], S.strap, (_x, _y, t) => cyl(t, 0));
  c.part();
  if (S.berkut) beltPlaques(c, [hx - 0.6, hx + 1.8], waist, [hx - 3.2]);
  else c.px(Math.round(hx - 3.2), waist, S.buckle, sphere(-0.5, -0.3));
  // The quiver at her near hip, mouth back, and its strap up across her chest.
  quiver(c, hx + 2.6, 20.2 + U, hx - 0.4, 25.6 + L);
  c.part();
  c.capsule(hx + 0.6, 15.4 + U, hx - 2.2, 21.2 + U, 0.5, 0.5, S.strap);
  // The shoulder pad.
  c.part();
  c.ellipse(hx + 1.4, 15.2 + U, 2.4, 1.5, S.pad, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.6 - 0.5, 1) });
  if (S.berkut) {
    c.part();
    c.px(hx - 2.6, top + 1, S.berkut.gold, sphere(-0.4, -0.3));
  }

  // The eagle on her far fist is behind her head, up past it; the falcon is small enough to sit in front.
  const big = !!S.bird.eagle;
  if (p.bird === 'fist' && big) perched(c, fb.x, fb.y - 1.6, 'side', p);
  headSide(c, hx, U, p);
  if (p.bird === 'shoulder') perched(c, hx + 2.4, 14.2 + U - (p.birdUp ?? 0), 'side', p);
  drawBow(c, 'side', p, fa, fb, 0);
  if (p.bird === 'fist' && !big) perched(c, fb.x, fb.y - 1.6, 'side', p);
  arm(c, hx + 0.2, 16.8 + U, fa, REACH_SIDE, [0.4, 1], false);
  if (p.morsel) {
    c.part();
    c.px(fa.x - 0.6, fa.y - 1.4, MEAT, sphere(-0.3, -0.4));
  }
  if (p.whistle) whistleNotes(c, hx - 4.4, 13 + U, p.whistle);
}

// ---------------------------------------------------------------------------
// Animations

const CARRY_A = H(0.8, 4.2, -3.4);
const CARRY_B = H(1.6, 4.6, -3.0);
const CARRY_B_SIDE = H(3.2, 0, -2.6);

const base = (view: View): Pose => ({
  lift: 0,
  breath: 0,
  footA: view === 'side' ? 1 : 0,
  footB: view === 'side' ? -1 : 0,
  lean: 0,
  a: { ...CARRY_A },
  b: view === 'side' ? { ...CARRY_B_SIDE } : { ...CARRY_B },
  raised: false,
  nock: false,
  draw: 0,
  glint: 0,
  sway: 0,
  bird: 'shoulder',
  wing: 'fold',
});

/** Standing easy; the falcon turns its head to look about. */
function idle(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 2;
    const p = base(view);
    p.breath = Math.sin(ph) > 0.5 ? 1 : 0;
    p.b.h += Math.sin(ph) * 0.3;
    p.a.h += Math.sin(ph) * 0.4;
    p.sway = Math.sin(ph - 1) * 0.6;
    p.blink = f === 4;
    p.peer = f === 2 || f === 3 ? 1 : f === 5 ? -1 : 0;
    // The bird sits a beat behind her breath.
    p.birdUp = p.breath && f !== 1 ? 1 : 0;
    frames.push(p);
  }
  return frames;
}

function walk(view: View): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0;
    if (view === 'side') {
      p.footA = Math.round(s * 2.2);
      p.footB = -p.footA;
      p.lean = 1;
      p.sway = 1 + Math.abs(s) * 0.9;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.sway = s * 0.8;
    }
    p.b = view === 'side' ? H(3.2 - s * 0.4, 0, -2.6 + p.lift * 0.4) : H(1.6 - s * 0.5, 4.6, -3 + p.lift * 0.4);
    p.a = H(0.8 + s * 1.6, 4.2, -3.4 + p.lift * 0.4);
    // The bird rides the step a beat late: it sinks as she rises.
    p.birdUp = p.lift ? -1 : 0;
    frames.push(p);
  }
  return frames;
}

interface Key {
  a: Hand;
  b: Hand;
  aSide?: Hand;
  bSide?: Hand;
  nock?: boolean;
  draw?: number;
  glint?: number;
  lean?: number;
  breath?: number;
  step?: number;
  /** The bow hangs from her hand rather than being aimed. */
  carry?: boolean;
  bird?: Pose['bird'];
  wing?: Wing;
  whistle?: number;
  crouch?: number;
  headY?: number;
}

/** An action as keyframes, the bow raised throughout unless carried. */
function action(keys: Key[]) {
  return (view: View): Pose[] =>
    keys.map((k) => {
      const p = base(view);
      p.a = { ...(view === 'side' && k.aSide ? k.aSide : k.a) };
      p.b = { ...(view === 'side' && k.bSide ? k.bSide : k.b) };
      p.raised = !k.carry;
      p.nock = k.nock ?? false;
      p.draw = k.draw ?? 0;
      p.glint = k.glint ?? 0;
      p.breath = k.breath ?? 0;
      p.bird = k.bird ?? 'shoulder';
      p.wing = k.wing ?? 'fold';
      p.whistle = k.whistle;
      p.headY = k.headY;
      if (k.crouch) p.lift = -k.crouch;
      const step = k.step ?? 0;
      if (view === 'side') {
        p.lean = k.lean ?? 0;
        p.footA = 1 + step;
        p.footB = -1 - Math.round(step * 0.5);
        p.sway = Math.max(0, (k.lean ?? 0) * 0.6) + 0.4;
      } else {
        p.footA = step > 0 ? 1 : 0;
        p.sway = (k.lean ?? 0) * -0.4;
      }
      return p;
    });
}

const AIM_B = H(5.2, 0.6, 2);
/** The quick shot: nock and half-draw at once, to the chin, loose, the hand flicking back. */
const shot = action([
  { a: H(3.4, 0.7, 2.0), b: AIM_B, nock: true, draw: 0.3, step: 1 },
  { a: H(0.8, 1.0, 2.8), b: AIM_B, nock: true, draw: 0.85, step: 1, lean: -1, wing: 'fold' },
  { a: H(-1.6, 2.2, 3.4), b: H(5.6, 0.6, 2.2), step: 1 },
  { a: H(-0.6, 2.6, 1.6), b: H(5.0, 0.8, 1.4), step: 1 },
]);

/**
 * Falcon strike: the bird steps down onto her raised fist, she swings the
 * gauntlet back and casts it off up and forward, and her arm follows through.
 */
const send = action([
  { a: H(0.8, 4.0, -2.8), b: H(2.4, 2.0, 4.4), bSide: H(2.6, 0, 4.2), carry: true, bird: 'fist', wing: 'fold', breath: 1 },
  { a: H(0.4, 4.2, -2.4), b: H(1.2, 2.6, 5.4), bSide: H(1.4, 0, 5.2), carry: true, bird: 'fist', wing: 'mantle', crouch: 1, lean: 1 },
  { a: H(1.0, 4.4, -2.8), b: H(5.0, 1.4, 8.4), bSide: H(5.4, 0, 8.0), carry: true, bird: 'none', step: 1, lean: -1 },
  { a: H(1.0, 4.4, -3.0), b: H(5.4, 1.2, 8.8), bSide: H(5.6, 0, 8.4), carry: true, bird: 'none', step: 1, lean: -1 },
  { a: H(0.8, 4.2, -3.2), b: H(3.0, 3.0, 2.2), bSide: H(3.6, 0, 1.6), carry: true, bird: 'none', step: 1 },
  { a: H(0.8, 4.2, -3.4), b: H(1.8, 4.4, -2.0), bSide: H(3.2, 0, -2.0), carry: true, bird: 'none' },
]);

/** Fingers to her lips. */
const LIPS_A = H(1.6, 0.4, 4.4);
const LIPS_A_SIDE = H(1.8, 0, 4.8);
/**
 * Skyhunt: fingers to her lips and a long, rising whistle; the bird on her
 * shoulder spreads its wings and cries out, and the sky answers.
 */
const whistle = action([
  { a: H(1.2, 2.0, 2.2), b: CARRY_B, bSide: CARRY_B_SIDE, carry: true, wing: 'mantle' },
  { a: LIPS_A, aSide: LIPS_A_SIDE, b: CARRY_B, bSide: CARRY_B_SIDE, carry: true, wing: 'mantle', whistle: 0.5, breath: 1 },
  { a: LIPS_A, aSide: LIPS_A_SIDE, b: CARRY_B, bSide: CARRY_B_SIDE, carry: true, wing: 'spread', whistle: 1, headY: -1 },
  { a: LIPS_A, aSide: LIPS_A_SIDE, b: CARRY_B, bSide: CARRY_B_SIDE, carry: true, wing: 'cry', whistle: 0.8, headY: -1 },
  { a: LIPS_A, aSide: LIPS_A_SIDE, b: CARRY_B, bSide: CARRY_B_SIDE, carry: true, wing: 'spread', whistle: 0.6, headY: -1, breath: 1 },
  { a: H(1.0, 3.2, 0.4), b: CARRY_B, bSide: CARRY_B_SIDE, carry: true, wing: 'mantle' },
]);

// ---------------------------------------------------------------------------
// The idle moment (`rest`), facing the viewer only

const from = (k: Partial<Pose>): Pose => ({ ...idle('down')[0], ...k });
/** Her free hand at the bag, and up at the bird on her other shoulder. */
const BAG_A = H(0.6, -3.4, -4.2);
const FEED_A = H(2.4, -3.0, 4.4);

/**
 * She reaches into the hawking bag for a morsel and lifts it to the falcon on
 * her shoulder, watching it; it leans down and snatches it, tips its head
 * back to gulp it down, rouses (every feather on end, a wisp of down drifting
 * off), preens a wing, and settles.
 */
const FALC_REST: Pose[] = [
  from({}),
  from({ a: H(0.8, -1.2, -2.6), glance: true }),
  from({ a: BAG_A, glance: true, sway: 0.2 }),
  from({ a: BAG_A, morsel: true, peer: 1, glance: true }),
  from({ a: H(1.6, -1.8, 1.4), morsel: true, peer: 1, glance: true, breath: 1 }),
  from({ a: FEED_A, morsel: true, peer: 1, glance: true, headX: 1 }),
  from({ a: FEED_A, morsel: true, wing: 'eat', glance: true, headX: 1 }),
  from({ a: FEED_A, wing: 'gulp', glance: true, headX: 1 }),
  from({ a: H(1.6, -1.6, 1.2), wing: 'gulp', glance: true, birdUp: 1 }),
  from({ a: CARRY_A, wing: 'fold', glance: true }),
  from({ a: CARRY_A, wing: 'ruffle', blink: true }),
  from({ a: CARRY_A, wing: 'ruffle', birdUp: 1, down: [20.5, 11] }),
  from({ a: CARRY_A, wing: 'ruffle', down: [22, 12.5] }),
  from({ a: CARRY_A, wing: 'preen', down: [23, 15] }),
  from({ a: CARRY_A, wing: 'preen', breath: 1, down: [24, 18] }),
  from({ a: CARRY_A, wing: 'mantle', down: [24.5, 21.5] }),
  from({ a: CARRY_A, wing: 'fold', glance: true, blink: true }),
];
const FALC_ORDER = [0, 1, 2, 2, 3, 4, 5, 5, 5, 6, 6, 7, 8, 7, 8, 9, 9, 10, 11, 10, 11, 12, 13, 14, 13, 14, 15, 16, 0];

function rest(view: View): Pose[] {
  return view === 'down' ? FALC_REST : [];
}

// ---------------------------------------------------------------------------
// Frame generation

export type FalconerAnim = 'idle' | 'walk' | 'shot' | 'send' | 'whistle' | 'rest' | 'bare_idle' | 'bare_walk' | 'bare_shot';

export interface FalconerAnimDef {
  name: FalconerAnim;
  fps: number;
  loop: boolean;
  poses: (view: View) => Pose[];
  order?: readonly number[];
}

/** The same move with the bird away hunting. */
const bare = (f: (view: View) => Pose[]) => (view: View): Pose[] => f(view).map((p) => ({ ...p, bird: 'none' as const }));

export const FALCONER_ANIMS: FalconerAnimDef[] = [
  { name: 'idle', fps: 7, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'shot', fps: 22, loop: false, poses: shot },
  { name: 'send', fps: 16, loop: false, poses: send },
  { name: 'whistle', fps: 9, loop: false, poses: whistle },
  { name: 'rest', fps: 9, loop: false, poses: rest, order: FALC_ORDER },
  { name: 'bare_idle', fps: 7, loop: true, poses: bare(idle) },
  { name: 'bare_walk', fps: 10, loop: true, poses: bare(walk) },
  { name: 'bare_shot', fps: 22, loop: false, poses: bare(shot) },
];

/** Frame index at which the arrow leaves the string, and the falcon her fist. */
export const FALC_LOOSE = { shot: 2, bare_shot: 2, send: 2 } as const;

export interface FalconerFrame {
  key: string;
  anim: FalconerAnim;
  dir: Dir;
  canvas: PixelCanvas;
}

function drawFrame(dir: Dir, pose: Pose): PixelCanvas {
  const c = new PixelCanvas(FALC_W, FALC_H).offset(BODY_X, BODY_Y);
  if (dir === 'down') drawDown(c, pose);
  else if (dir === 'up') drawUp(c, pose);
  else drawSide(c, pose);
  return dir === 'right' ? c.mirrored() : c;
}

export function buildFalconerFrames(look: FalconerLook = FALCONER_LOOK): FalconerFrame[] {
  S = look;
  const out: FalconerFrame[] = [];
  for (const a of FALCONER_ANIMS) {
    for (const dir of DIRS) {
      const view: View = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, canvas: drawFrame(dir, pose) });
      });
    }
  }
  S = FALCONER_LOOK;
  return out;
}

// ---------------------------------------------------------------------------
// Her arrows in flight

/** A short hunting arrow along heading `i` (of ARROW_DIRS): steel head, shaft, barred fletching. */
export function falconArrowFrame(i: number, look: FalconerLook): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const a = (i / ARROW_DIRS) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const m = (ARROW_SIZE - 1) / 2 + 0.5;
  const px = (t: number, side = 0): [number, number] => [m + ux * t - uy * side, m + uy * t + ux * side];
  c.part();
  const [x0, y0] = px(-4.4);
  const [x1, y1] = px(3.8);
  c.line(x0, y0, x1, y1, look.shaft, () => sphere(-uy * 0.3, -0.4));
  c.part();
  for (const [t, f] of [[-4.2, look.fletch], [-3.2, look.fletchBar], [-2.4, look.fletch]] as const) {
    for (const s of [-1, 1]) {
      const [fx, fy] = px(t, s);
      c.px(fx, fy, f, sphere(-uy * s * 0.4, ux * s * 0.4 - 0.2));
    }
  }
  c.part();
  const [bx, by] = px(4.4);
  const [hx, hy] = px(5.4);
  c.px(bx, by, look.head, sphere(-0.3, -0.3));
  c.px(hx, hy, look.head, sphere(-0.5, -0.5), { bias: 1 });
  if (look.berkut) {
    // A wisp of gold off the head.
    c.spark(hx, hy, look.light[1], 0.45);
  }
  return c;
}

/** Stuck in the ground, leaning `k` 0 left, 1 straight, 2 right; its foot at the bottom centre. */
export function falconStuckFrame(k: number, look: FalconerLook): PixelCanvas {
  const c = new PixelCanvas(ARROW_SIZE, ARROW_SIZE);
  const lean = (k - 1) * 0.45;
  const x0 = (ARROW_SIZE - 1) / 2 + 0.5;
  const y0 = ARROW_SIZE - 1.5;
  const len = 6;
  c.part();
  c.line(x0, y0, x0 + lean * len, y0 - len, look.shaft, () => sphere(-0.3, -0.3));
  c.part();
  for (const [t, f] of [[len - 1.4, look.fletchBar], [len - 0.4, look.fletch]] as const) {
    const x = x0 + lean * t;
    const y = y0 - t;
    c.px(x - 1, y + 0.5, f, sphere(-0.5, 0));
    c.px(x + 1, y + 0.5, f, sphere(0.5, 0));
  }
  return c;
}

// ---------------------------------------------------------------------------
// Birds in flight

/** A flying bird's frame, facing right, its body's middle at BIRD_CX, BIRD_CY (room for the eagle's wings). */
export const BIRD_W = 44;
export const BIRD_H = 38;
export const BIRD_CX = 21;
export const BIRD_CY = 19;

/** The birds' frames: a flap cycle, glides, the stoop, the strike. */
export const BIRD_FLAP = 6;
export type BirdFrame = `f${number}` | `g${number}` | `d${number}` | `k${number}`;

/** The birds that fly: the falcon, the golden eagle, and the hawks of the Special. */
export const BIRD_LOOKS: { key: string; bird: BirdLook }[] = [
  { key: 'bird_falcon', bird: FALCON },
  { key: 'bird_eagle', bird: GOLDEN_EAGLE },
  { key: 'bird_hawk', bird: HAWK },
];

interface Flight {
  /** Wing beat: -1 fully down, 1 fully up. */
  beat: number;
  /** Nose up (-) or down (+), radians. */
  pitch: number;
  /** Wings swept back to the body (the stoop), 0..1. */
  tuck: number;
  /** Talons thrown forward. */
  talons: boolean;
  /** Tail fanned. */
  fan: number;
  /** The body bobbing with the beat, px. */
  bob: number;
  /** Beak open, crying. */
  cry?: boolean;
}

/**
 * A bird in flight, side on, facing right: the far wing behind the body, the
 * near wing over it. Wings are drawn as an arm to the wrist and a hand of
 * primaries out to the tip; the beat swings the wrist and tip up and down
 * about the shoulder, the stoop folds them back along the body. All points are
 * in the bird's own frame and turned by its pitch.
 */
function flyingBird(B: BirdLook, f: Flight): PixelCanvas {
  const c = new PixelCanvas(BIRD_W, BIRD_H);
  const k = B.size;
  const eagle = !!B.eagle;
  const cp = Math.cos(f.pitch);
  const sp = Math.sin(f.pitch);
  // Bird space: +u forward (head), +v down.
  const P = (u: number, v: number): [number, number] => {
    const uu = u * k;
    const vv = v * k;
    return [BIRD_CX + uu * cp - vv * sp, BIRD_CY + f.bob + uu * sp + vv * cp];
  };
  const shoulder = (far: boolean): [number, number] => P(far ? 1.2 : 0.6, far ? -1.6 : -1.0);
  const wing = (far: boolean) => {
    const [sx, sy] = shoulder(far);
    const beat = f.beat * (far ? 0.9 : 1);
    const span = 11.5;
    // The wrist swings on the beat; folded back by the tuck.
    const th = (-0.15 - beat * 1.05) * (1 - f.tuck) + (-0.05) * f.tuck;
    const reach = (far ? 0.82 : 1) * (1 - f.tuck * 0.45);
    const wu = -1.2 - f.tuck * 2.8;
    const wv = Math.sin(th) * 5.2 * reach;
    const wristU = wu + (1 - Math.abs(Math.sin(th))) * 0.4;
    const [wx, wy] = P(wristU + (far ? 0.6 : 0), wv - (far ? 1.6 : 1.0));
    const tipTh = th * 1.18 + (f.beat < 0 ? 0.22 : -0.1) * (1 - f.tuck);
    const tipU = wristU - 2.4 - f.tuck * 4.2 - 1;
    const tipV = Math.sin(tipTh) * span * reach - (far ? 1.6 : 1.0);
    const [tx, ty] = P(tipU + (far ? 0.6 : 0), tipV);
    // The trailing edge, back towards the tail, lifted a little with the wing so it reads broad (broader still on the eagle).
    const [rx, ry] = P(-4.6 - f.tuck * 0.6 - (eagle ? 0.8 : 0), -0.8 + Math.sin(th) * 2.2 * reach - (far ? 0.6 : 0));
    const bias = far ? -2 : 0;
    const n = () => sphere(far ? -0.2 : -0.4, f.beat > 0 ? -0.6 : -0.2, 1);
    c.part();
    tri(c, sx, sy, wx, wy, rx, ry, B.back, n, bias);
    tri(c, wx, wy, tx, ty, rx, ry, B.back, n, bias);
    // The leading edge: the arm, thick at the shoulder.
    c.part();
    c.capsule(sx, sy, wx, wy, 1.3 * k, 1.0 * k, B.back, { bias: bias + 1 });
    // The primaries, fingered at the tip: the eagle's five long fingers splay wide.
    c.part();
    const fingers = eagle ? 5 : 3;
    const splay = eagle ? 0.7 : 0.45;
    for (let i = 0; i < fingers; i++) {
      const u = i / (fingers - 1);
      const ex = tx + (rx - tx) * u * splay;
      const ey = ty + (ry - ty) * u * splay;
      c.capsule(wx + (tx - wx) * 0.35, wy + (ty - wy) * 0.35, ex, ey, 0.85 * k, 0.45, B.primary, { bias });
    }
    if (eagle) {
      // The tawny band over the near wing's shoulder.
      if (!far) {
        for (let i = 0; i < 4; i++) {
          const u = (i + 0.5) / 4;
          const x = sx + (wx - sx) * u + (rx - sx) * 0.22;
          const y = sy + (wy - sy) * u + (ry - sy) * 0.22;
          c.px(x, y, B.bar, sphere(-0.3, -0.4), { bias });
        }
      }
    } else if (!far) {
      // Bars across the underwing on the near wing, from the barred birds.
      for (let i = 1; i <= 3; i++) {
        const u = i / 4;
        c.shade(sx + (tx - sx) * u * 0.8 + (rx - sx) * 0.25, sy + (ty - sy) * u * 0.8 + (ry - sy) * 0.25, -1);
      }
    }
  };

  wing(true);
  // The tail: narrow and square on the falcon, longer and rounder on the eagle, fanned when braking.
  c.part();
  const tl = eagle ? 4.4 : 5.2;
  const [t0x, t0y] = P(-3.2, 0.2);
  const feathers = eagle ? [-1.2, -0.4, 0.4, 1.2] : [-1, 0, 1];
  for (const i of feathers) {
    const spread = (0.25 + f.fan * 0.6) * i;
    const [ex, ey] = P(-3.2 - tl + Math.abs(i) * (eagle ? 0.5 : 0), 0.4 + spread * 3 + f.fan * 1.4);
    c.capsule(t0x, t0y, ex, ey, 1.1 * k, 0.9 * k, B.tail, { bias: i > 0.5 ? -1 : 0 });
  }
  // Its bars.
  for (const q of eagle ? [0.4, 0.62, 0.84] : [0.55, 0.85]) {
    const [bx, by] = P(-3.2 - tl * q, 0.6 + f.fan);
    c.shade(bx, by, -1);
  }
  // The body: a teardrop from the tail to the chest, the breast underneath.
  c.part();
  const [b0x, b0y] = P(-3.6, 0.2);
  const [b1x, b1y] = P(2.0, -0.4);
  c.capsule(b0x, b0y, b1x, b1y, 1.4 * k, 2.2 * k, B.back);
  c.part();
  const [c0x, c0y] = P(-2.6, 1.0);
  const [c1x, c1y] = P(2.0, 0.8);
  c.capsule(c0x, c0y, c1x, c1y, 1.0 * k, 1.4 * k, B.breast, { bias: 0 });
  for (let i = 0; i < 3; i++) {
    const [qx, qy] = P(-1.6 + i * 1.5, 1.6);
    c.shade(qx, qy, -1);
  }
  // The eagle's feathered leggings, tawny, under it.
  if (eagle && !f.talons) {
    c.part();
    const [lx, ly] = P(-1.2, 1.8);
    c.ellipse(lx, ly, 1.2 * k, 0.9 * k, B.bar, { normal: (_x, _y, dx, dy) => sphere(dx * 0.6, dy * 0.6 + 0.3, 1) });
  }
  // The feet: tucked under in flight, thrown forward to strike.
  c.part();
  if (f.talons) {
    const [hx0, hy0] = P(0.4, 1.6);
    const [fx, fy] = P(3.4, 4.6);
    if (eagle) {
      c.capsule(hx0, hy0, (hx0 + fx) / 2, (hy0 + fy) / 2, 1.1 * k, 0.8 * k, B.bar);
      c.part();
    }
    c.capsule(hx0, hy0, fx, fy, 0.75, 0.6, B.foot);
    c.part();
    for (const [du, dv] of [[1.2, 0.2], [0.8, 1.0], [-0.4, 1.0]]) {
      const [x, y] = P(3.4 + du, 4.6 + dv);
      c.px(x, y, B.beak, sphere(0.3, 0.4));
    }
  } else {
    const [fx, fy] = P(-1.6, 2.4);
    c.px(fx, fy, B.foot, sphere(0, 0.3), { bias: -1 });
  }
  // The head.
  const [hx, hy] = P(3.6, -1.2);
  const r = 2.0 * k;
  c.part();
  c.ellipse(hx, hy, r, r * 0.92, B.hood, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
  const [ex, ey] = P(4.2, -1.4);
  c.part();
  const [cx0, cy0] = P(3.8, 0.2);
  c.ellipse(cx0, cy0, 1.3 * k, 0.9 * k, B.breast, { normal: (_x, _y, dx, dy) => sphere(dx * 0.5 + 0.3, dy * 0.5 + 0.2, 1) });
  if (eagle) {
    // The golden hackles ruffled at the nape; a heavy brow over the eye; the great hooked beak.
    for (const [du, dv] of [[2.0, -0.4], [1.8, 0.6], [2.4, -1.8]]) {
      const [nx, ny] = P(du, dv);
      c.px(nx, ny, B.hood, sphere(-0.3, -0.2), { bias: 1 });
    }
    c.part();
    c.px(ex, ey, B.eye, sphere(0.3, -0.3));
    const [brx, bry] = P(4.2, -2.2);
    c.shade(brx, bry, -1);
    const [cerex, cerey] = P(5.2, -0.8);
    c.px(cerex, cerey, B.foot, sphere(0.5, -0.4));
    const [bkx, bky] = P(6.1, -0.6);
    c.px(bkx, bky, B.beak, sphere(0.6, -0.3), { bias: 1 });
    const [b2x, b2y] = P(6.6, 0.2);
    c.px(b2x, b2y, B.beak, sphere(0.6, 0.2));
    const [b3x, b3y] = P(6.2, 0.8);
    c.px(b3x, b3y, B.beak, sphere(0.5, 0.5), { bias: -1 });
    if (f.cry) {
      const [b4x, b4y] = P(5.4, 1.4);
      c.px(b4x, b4y, B.beak, sphere(0.4, 0.5), { bias: -1 });
    }
  } else {
    const [mx, my] = P(4.0, 0.0);
    c.px(mx, my, B.hood, sphere(0.2, 0.2));
    c.part();
    c.px(ex, ey, B.eye, sphere(0.3, -0.3));
    const [cerex, cerey] = P(5.4, -1.0);
    c.px(cerex, cerey, B.foot, sphere(0.5, -0.4));
    const [bkx, bky] = P(6.3, -0.6);
    c.px(bkx, bky, B.beak, sphere(0.6, -0.2));
    const [b2x, b2y] = P(6.2, 0.4);
    c.px(b2x, b2y, B.beak, sphere(0.5, 0.5), { bias: -1 });
    if (f.cry) {
      const [b3x, b3y] = P(5.6, 1.2);
      c.px(b3x, b3y, B.beak, sphere(0.4, 0.5), { bias: -1 });
    }
  }
  wing(false);
  return c;
}

/**
 * Every frame of a flying bird, facing right (flip the sprite to face left):
 * f0..f5 a flap cycle, g0..g1 gliding, d0..d1 the stoop (wings folded, head
 * down), k0..k3 the strike (talons forward, wings back-beating, tail fanned).
 */
export function birdFrames(B: BirdLook): { name: string; canvas: PixelCanvas }[] {
  const out: { name: string; canvas: PixelCanvas }[] = [];
  const beats = [1, 0.55, -0.1, -0.85, -0.45, 0.35];
  beats.forEach((beat, i) => out.push({ name: `f${i}`, canvas: flyingBird(B, { beat, pitch: -0.08, tuck: 0, talons: false, fan: 0, bob: beat < -0.5 ? -1 : beat > 0.8 ? 1 : 0 }) }));
  out.push({ name: 'g0', canvas: flyingBird(B, { beat: 0.25, pitch: 0, tuck: 0, talons: false, fan: 0.2, bob: 0 }) });
  out.push({ name: 'g1', canvas: flyingBird(B, { beat: 0.12, pitch: 0.04, tuck: 0, talons: false, fan: 0.3, bob: 0 }) });
  out.push({ name: 'd0', canvas: flyingBird(B, { beat: 0.3, pitch: 0.8, tuck: 0.85, talons: false, fan: 0, bob: 0 }) });
  out.push({ name: 'd1', canvas: flyingBird(B, { beat: 0.4, pitch: 0.95, tuck: 1, talons: false, fan: 0, bob: 0 }) });
  out.push({ name: 'k0', canvas: flyingBird(B, { beat: 1, pitch: -0.55, tuck: 0, talons: true, fan: 1, bob: 0, cry: true }) });
  out.push({ name: 'k1', canvas: flyingBird(B, { beat: 0.1, pitch: -0.4, tuck: 0, talons: true, fan: 0.9, bob: 1 }) });
  out.push({ name: 'k2', canvas: flyingBird(B, { beat: -0.9, pitch: -0.3, tuck: 0, talons: true, fan: 0.8, bob: 1 }) });
  out.push({ name: 'k3', canvas: flyingBird(B, { beat: 0.4, pitch: -0.5, tuck: 0, talons: true, fan: 1, bob: 0 }) });
  return out;
}
