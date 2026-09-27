// The wizard, drawn procedurally from a small rig.
//
// Every frame is a Pose (body lift, breathing, foot offsets, staff transform,
// magic trail...) fed to a per-direction draw function. Animations are just
// sequences of poses, so timing and motion stay easy to tweak.

import { PixelCanvas, cyl, sphere, type Material, type RGB, type Vec3 } from './pixel';
import {
  BEARD,
  BOOT,
  CHAR_WOOD,
  CRYSTAL,
  EMBER_CORE,
  EMBER_CRYSTAL,
  EMBER_DEEP,
  EMBER_HOT,
  EMBER_MID,
  EYE,
  GOLD,
  HAIR,
  HOOD_SHADOW,
  LEATHER,
  MAGIC_CORE,
  MAGIC_DEEP,
  MAGIC_HOT,
  MAGIC_MID,
  OBSIDIAN,
  PALE_SKIN,
  PYRO_BEARD,
  PYRO_INNER,
  PYRO_ROBE,
  PYRO_TRIM,
  ROBE,
  ROBE_INNER,
  SILVER,
  SKIN,
  VOID_CORE,
  VOID_CRYSTAL,
  VOID_DEEP,
  VOID_EYE,
  VOID_HOT,
  VOID_LINING,
  VOID_MID,
  VOID_ROBE,
  WOOD,
} from './palette';
import {
  DEMON_SKIN,
  FEL_CORE,
  FEL_CRYSTAL,
  FEL_DEEP,
  FEL_EYE,
  FEL_HOT,
  FEL_MID,
  FEL_TRIM,
  HELL_HAIR,
  HELL_LINING,
  HELL_ROBE,
  HORN,
  STARWOOD,
  STAR_CORE,
  STAR_CRYSTAL,
  STAR_DEEP,
  STAR_HAIR,
  STAR_HOT,
  STAR_LINING,
  STAR_MID,
  STAR_ROBE,
} from './heroSkins';
import { ANTLER, AMBER, AUBURN, BARK, FANG, HIDE, LEAF, LIVEWOOD, MOSS, MUZZLE, PELT, SEED, TUNIC, WOAD, WOLF_EYE, WOLF_NOSE, GROVE_CORE, GROVE_DEEP, GROVE_HOT, GROVE_MID, WILD_CORE, WILD_DEEP, WILD_HOT, WILD_MID } from './druid';

// ---------------------------------------------------------------------------
// Looks (skins). Every look shares the rig, poses and staff geometry, so the
// crystal sits on the same pixel in every frame and gameplay is identical.

export interface WizardLook {
  /** Texture and animation key prefix, e.g. "wizard" or "wizard_void". */
  key: string;
  robe: Material;
  inner: Material;
  trim: Material;
  belt: Material;
  boot: Material;
  skin: Material;
  shaft: Material;
  crystal: Material;
  magic: { core: RGB; hot: RGB; mid: RGB; deep: RGB };
  /**
   * false: pointed hat, white beard, gold trim, forked wooden staff.
   * true: a deep cowl with glowing eyes, a shoulder mantle, a tattered hem
   * and a crescent-headed staff.
   */
  hooded: boolean;
  /** Beard and hair of the hatted look (default: white). */
  beard?: Material;
  /** The emblem on the hat: a star, or a flame. */
  sigil?: 'star' | 'flame';
  /**
   * A bare head in place of the hat or the cowl:
   * 'astral': long silver hair under a gold circlet, a tall fan collar and a
   * crown of stars; a starwood staff ringed like an armillary sphere.
   * 'fiend': a horned, crimson-skinned warlock with a goatee and green eyes,
   * bone spikes on a shoulder mantle, a ragged hem smouldering with fel fire,
   * and a black staff crowned with horns round the flame.
   * 'grove': the Druid's Grovekeeper, a hood of moss with antlers growing
   * through it, a mantle and hem of leaves, fireflies about the robe, and a
   * living staff whose twigs cradle a glowing seed.
   * 'wild': the Druid's Shapeshifter, a wolf's pelt worn as a hood (its head
   * over her brow, its eyes still burning), a fur mantle, woad on the cheeks,
   * a ragged hide robe and a staff hung with fangs round a lump of amber.
   */
  head?: 'astral' | 'fiend' | 'grove' | 'wild';
  /** Hair of the bare heads. */
  hair?: Material;
}

export const ARCANE_LOOK: WizardLook = {
  key: 'wizard',
  robe: ROBE,
  inner: ROBE_INNER,
  trim: GOLD,
  belt: LEATHER,
  boot: BOOT,
  skin: SKIN,
  shaft: WOOD,
  crystal: CRYSTAL,
  magic: { core: MAGIC_CORE, hot: MAGIC_HOT, mid: MAGIC_MID, deep: MAGIC_DEEP },
  hooded: false,
};

export const VOID_LOOK: WizardLook = {
  key: 'wizard_void',
  robe: VOID_ROBE,
  inner: VOID_LINING,
  trim: SILVER,
  belt: VOID_LINING,
  boot: BOOT,
  skin: PALE_SKIN,
  shaft: OBSIDIAN,
  crystal: VOID_CRYSTAL,
  magic: { core: VOID_CORE, hot: VOID_HOT, mid: VOID_MID, deep: VOID_DEEP },
  hooded: true,
};

/** The Pyromancer: the classic hat and beard in fire colours, a flame on the hat. */
export const PYRO_LOOK: WizardLook = {
  key: 'wizard_pyro',
  robe: PYRO_ROBE,
  inner: PYRO_INNER,
  trim: PYRO_TRIM,
  belt: PYRO_INNER,
  boot: BOOT,
  skin: SKIN,
  shaft: CHAR_WOOD,
  crystal: EMBER_CRYSTAL,
  magic: { core: EMBER_CORE, hot: EMBER_HOT, mid: EMBER_MID, deep: EMBER_DEEP },
  hooded: false,
  beard: PYRO_BEARD,
  sigil: 'flame',
};

/** The Arcanist's Astral skin: a reader of the stars. */
export const ASTRAL_LOOK: WizardLook = {
  key: 'wizard_astral',
  robe: STAR_ROBE,
  inner: STAR_LINING,
  trim: GOLD,
  belt: STAR_LINING,
  boot: BOOT,
  skin: SKIN,
  shaft: STARWOOD,
  crystal: STAR_CRYSTAL,
  magic: { core: STAR_CORE, hot: STAR_HOT, mid: STAR_MID, deep: STAR_DEEP },
  hooded: false,
  head: 'astral',
  hair: STAR_HAIR,
};

/** The Pyromancer's Hellfire skin: a horned warlock of green fire. */
export const HELL_LOOK: WizardLook = {
  key: 'wizard_hell',
  robe: HELL_ROBE,
  inner: HELL_LINING,
  trim: FEL_TRIM,
  belt: HELL_LINING,
  boot: BOOT,
  skin: DEMON_SKIN,
  shaft: OBSIDIAN,
  crystal: FEL_CRYSTAL,
  magic: { core: FEL_CORE, hot: FEL_HOT, mid: FEL_MID, deep: FEL_DEEP },
  hooded: false,
  head: 'fiend',
  hair: HELL_HAIR,
};

/** The Druid's Grovekeeper: moss, leaves and antlers, and the light of a sunlit glade. */
export const GROVE_LOOK: WizardLook = {
  key: 'druid',
  robe: MOSS,
  inner: BARK,
  trim: LEAF,
  belt: LEATHER,
  boot: BOOT,
  skin: SKIN,
  shaft: LIVEWOOD,
  crystal: SEED,
  magic: { core: GROVE_CORE, hot: GROVE_HOT, mid: GROVE_MID, deep: GROVE_DEEP },
  hooded: false,
  head: 'grove',
  hair: ANTLER,
};

/** The Druid's Shapeshifter: a wolf's pelt, hide and fangs, and amber spirit light. */
export const WILD_LOOK: WizardLook = {
  key: 'druid_wild',
  robe: HIDE,
  inner: TUNIC,
  trim: FANG,
  belt: LEATHER,
  boot: BOOT,
  skin: SKIN,
  shaft: WOOD,
  crystal: AMBER,
  magic: { core: WILD_CORE, hot: WILD_HOT, mid: WILD_MID, deep: WILD_DEEP },
  hooded: false,
  head: 'wild',
  hair: PELT,
  beard: AUBURN,
};

export const WIZARD_LOOKS = [ARCANE_LOOK, VOID_LOOK, PYRO_LOOK, ASTRAL_LOOK, HELL_LOOK, GROVE_LOOK, WILD_LOOK];

/** The look being drawn. Frame drawing is synchronous, so a module slot is enough. */
let S: WizardLook = ARCANE_LOOK;

export const FRAME_W = 24;
export const FRAME_H = 32;

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

export interface Staff {
  /** Hand (grip) position in frame pixels. */
  hx: number;
  hy: number;
  /** Degrees; 0 = crystal straight up, positive turns clockwise. */
  angle: number;
  len: number;
  /** Where along the staff the hand holds it, 0 = bottom, 1 = top. */
  grip: number;
  /** Crystal hovers this far past the fork (0 = seated at the tip). */
  float: number;
}

export interface Pose {
  /** Whole body raised by this many pixels (walk passing frames). */
  lift: number;
  /** Upper body lowered by this many pixels (idle breathing). */
  breath: number;
  /** Hat tip sway, in pixels. */
  hat: number;
  /** Foot offsets. Side view: forward (+) / back (-). Front/back: lift. */
  footA: number;
  footB: number;
  /** Robe hem sway in pixels. */
  hem: number;
  /** Free-arm swing in pixels. */
  arm: number;
  staff: Staff;
  /** Draw the staff behind the body. */
  staffBehind?: boolean;
  blink?: boolean;
  /** 0..1 crystal glow strength. */
  glow: number;
  /** Magic arc swept by the crystal: angles (deg) around the hand, newest last. */
  trail?: number[];
  /** Burst of light at the crystal (0..1). */
  flash?: number;
}

export interface FrameMeta {
  /** Crystal centre in frame pixels. */
  tipX: number;
  tipY: number;
  glow: number;
}

const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Shared parts

function staffGeom(s: Staff) {
  const a = s.angle * RAD;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const up = s.len * (1 - s.grip);
  const down = s.len * s.grip;
  const top = { x: s.hx + dx * up, y: s.hy + dy * up };
  const bottom = { x: s.hx - dx * down, y: s.hy - dy * down };
  const gem = { x: top.x + dx * (s.float + 1.6), y: top.y + dy * (s.float + 1.6) };
  return { dx, dy, top, bottom, gem };
}

function drawStaff(c: PixelCanvas, s: Staff, glow: number): { x: number; y: number } {
  const g = staffGeom(s);
  c.part();
  // Wood: lit from the left, with a couple of darker knots along the shaft.
  const woodN: Vec3 = { x: -0.45, y: 0.25, z: 0.86 };
  c.line(g.bottom.x, g.bottom.y, g.top.x, g.top.y, S.shaft, () => woodN);
  const steps = Math.round(Math.max(Math.abs(g.top.x - g.bottom.x), Math.abs(g.top.y - g.bottom.y)));
  for (let i = 5; i < steps - 2; i += 7) {
    const t = i / steps;
    c.shade(Math.round(g.bottom.x + (g.top.x - g.bottom.x) * t), Math.round(g.bottom.y + (g.top.y - g.bottom.y) * t), -1);
  }
  if (S.hooded) {
    // A silver crescent cradling the crystal, horns curling up past it.
    c.part();
    const cx = g.top.x + g.dx * 1.6;
    const cy = g.top.y + g.dy * 1.6;
    const r = 2.7;
    for (let a = -128; a <= 128; a += 11) {
      const th = a * RAD;
      const ox = -g.dx * Math.cos(th) - g.dy * Math.sin(th);
      const oy = -g.dy * Math.cos(th) + g.dx * Math.sin(th);
      c.px(Math.floor(cx + ox * r), Math.floor(cy + oy * r), S.trim, { x: ox * 0.6, y: -oy * 0.6, z: 0.8 });
    }
  } else if (S.head === 'astral') {
    // An armillary ring round the star: a gold hoop seen at a tilt, a finial above it.
    c.part();
    const px = -g.dy;
    const py = g.dx;
    for (let a = 0; a < 360; a += 12) {
      const th = a * RAD;
      const ox = px * Math.cos(th) * 3.1 + g.dx * Math.sin(th) * 1.3;
      const oy = py * Math.cos(th) * 3.1 + g.dy * Math.sin(th) * 1.3;
      c.px(Math.floor(g.gem.x + ox), Math.floor(g.gem.y + oy), S.trim, { x: Math.cos(th) * 0.5 - 0.2, y: Math.sin(th) * 0.4 + 0.2, z: 0.8 }, { bias: Math.sin(th) > 0 ? 1 : 0 });
    }
    // The shaft's collar where the ring is mounted.
    c.px(Math.round(g.top.x - 0.5), Math.round(g.top.y - 0.5), S.trim, { x: -0.4, y: 0.3, z: 0.85 }, { bias: 1 });
  } else if (S.head === 'fiend') {
    // Two horns rise from the head of the staff and curl in round the flame, over a small skull.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 1.0, 0.2);
      const a1 = at(k * 2.6, 1.8);
      const a2 = at(k * 2.2, 3.8);
      const a3 = at(k * 1.1, 4.6);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.75, 0.62, HORN, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.62, 0.48, HORN);
      c.capsule(a2.x, a2.y, a3.x, a3.y, 0.48, 0.3, HORN, { bias: 1 });
    }
    c.part();
    const sk = at(0, -0.4);
    c.ellipse(sk.x, sk.y, 1.35, 1.2, HORN, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.8 - 0.2, 1) });
    c.px(Math.floor(sk.x - 0.6), Math.floor(sk.y), FEL_EYE, { x: 0, y: 0, z: 1 });
  } else if (S.head === 'grove') {
    // Twigs curl up round the seed from the staff's head, a leaf budding on each.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.6, 0);
      const a1 = at(k * 2.3, 1.7);
      const a2 = at(k * 1.8, 3.8);
      const a3 = at(k * 0.5, 4.6);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.6, 0.5, S.shaft, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.5, 0.38, S.shaft);
      c.capsule(a2.x, a2.y, a3.x, a3.y, 0.38, 0.25, S.shaft, { bias: 1 });
      c.part();
      const leaf = at(k * 3.3, 1.2);
      c.px(leaf.x, leaf.y, S.trim, { x: k * 0.5 - 0.2, y: 0.4, z: 0.8 }, { bias: 1 });
    }
  } else if (S.head === 'wild') {
    // Two fangs curve up either side of the amber; a feather hangs from a thong below it.
    const px = -g.dy;
    const py = g.dx;
    const at = (side: number, up: number) => ({ x: g.top.x + px * side + g.dx * up, y: g.top.y + py * side + g.dy * up });
    for (const k of [-1, 1]) {
      c.part();
      const a0 = at(k * 0.8, 0.2);
      const a1 = at(k * 2.3, 1.8);
      const a2 = at(k * 1.7, 3.9);
      c.capsule(a0.x, a0.y, a1.x, a1.y, 0.62, 0.5, S.trim, { bias: 1 });
      c.capsule(a1.x, a1.y, a2.x, a2.y, 0.5, 0.25, S.trim);
    }
    c.part();
    const f0 = at(1.3, -0.8);
    const f1 = at(1.9, -3.6);
    c.line(f0.x, f0.y, f1.x, f1.y, S.inner, () => ({ x: 0.3, y: 0.2, z: 0.93 }));
    c.px(f1.x, f1.y, S.trim, { x: 0.2, y: -0.2, z: 0.95 });
  } else if (s.float > 0) {
    // Fork cradling the crystal.
    const px = -g.dy;
    const py = g.dx;
    c.px(Math.round(g.top.x + px * 1.2 + g.dx * 0.8 - 0.5), Math.round(g.top.y + py * 1.2 + g.dy * 0.8 - 0.5), S.shaft, { x: -0.6, y: 0.4, z: 0.7 });
    c.px(Math.round(g.top.x - px * 1.2 + g.dx * 0.8 - 0.5), Math.round(g.top.y - py * 1.2 + g.dy * 0.8 - 0.5), S.shaft, { x: 0.6, y: 0.4, z: 0.7 });
  }
  // Crystal: a small faceted gem, brighter on its upper-left facet.
  c.part();
  const gx = g.gem.x;
  const gy = g.gem.y;
  const cg = 0.55 + glow * 0.45;
  c.ellipse(gx, gy, 1.55, 2.3, S.crystal, {
    glow: S.crystal.emissive! * cg,
    normal: (_x, _y, dx, dy) => {
      // Faceted: quantise the normal so the gem reads as cut, not round.
      const fx = dx < -0.2 ? -0.7 : dx > 0.2 ? 0.7 : 0;
      const fy = dy < -0.2 ? 0.6 : dy > 0.3 ? -0.6 : 0.1;
      return { x: fx, y: fy, z: 0.7 };
    },
  });
  return { x: gx, y: gy };
}

function drawTrail(c: PixelCanvas, s: Staff, angles: number[]): void {
  // A sweeping ribbon of light following the crystal around the hand.
  const r = s.len * (1 - s.grip) + s.float + 1.6;
  const n = angles.length;
  for (let k = 0; k < n - 1; k++) {
    const a0 = angles[k];
    const a1 = angles[k + 1];
    const seg = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 7));
    for (let j = 0; j <= seg; j++) {
      const a = (a0 + ((a1 - a0) * j) / seg) * RAD;
      const age = (k + j / seg) / (n - 1); // 0 = oldest, 1 = newest
      const x = s.hx + Math.sin(a) * r;
      const y = s.hy - Math.cos(a) * r;
      const col = age > 0.75 ? S.magic.hot : age > 0.4 ? S.magic.mid : S.magic.deep;
      c.spark(x, y, col, 0.35 + age * 0.65);
      // A thinner inner line gives the ribbon some width.
      if (age > 0.35) {
        const xi = s.hx + Math.sin(a) * (r - 1);
        const yi = s.hy - Math.cos(a) * (r - 1);
        c.spark(xi, yi, S.magic.deep, age * 0.6);
      }
    }
  }
  // Loose sparkles flung off the arc.
  const last = angles[n - 1];
  for (let i = 0; i < 4; i++) {
    const a = (last - 25 - i * 28) * RAD;
    const rr = r + 1.5 + ((i * 7) % 3);
    c.spark(s.hx + Math.sin(a) * rr, s.hy - Math.cos(a) * rr, i % 2 ? S.magic.hot : S.magic.mid, 0.8 - i * 0.15);
  }
}

function drawFlash(c: PixelCanvas, x: number, y: number, f: number): void {
  // Star-shaped burst: bright core, four rays, a faint ring.
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const ray = Math.round(2 + f * 3);
  for (let i = -ray; i <= ray; i++) {
    const a = 1 - Math.abs(i) / (ray + 1);
    c.spark(cx + i, cy, i === 0 ? S.magic.core : S.magic.hot, a * f);
    if (i !== 0) c.spark(cx, cy + i, S.magic.hot, a * f);
  }
  const diag = Math.round(1 + f * 1.5);
  for (let i = 1; i <= diag; i++) {
    const a = (0.6 * f * (diag - i + 1)) / diag;
    c.spark(cx + i, cy + i, S.magic.mid, a);
    c.spark(cx - i, cy + i, S.magic.mid, a);
    c.spark(cx + i, cy - i, S.magic.mid, a);
    c.spark(cx - i, cy - i, S.magic.mid, a);
  }
  c.spark(cx, cy, S.magic.core, 1);
}

function hand(c: PixelCanvas, x: number, y: number): void {
  c.part();
  c.ellipse(x, y, 1.2, 1.2, S.skin);
}

function sleeve(c: PixelCanvas, sx: number, sy: number, hx: number, hy: number): void {
  // Wizard sleeves flare toward the cuff.
  c.part();
  const vx = hx - sx;
  const vy = hy - sy;
  const l = Math.hypot(vx, vy) || 1;
  const ex = hx - (vx / l) * 1.3;
  const ey = hy - (vy / l) * 1.3;
  c.capsule(sx, sy, ex, ey, 1.4, 2.0, S.robe);
}

/** Front/back robe body: rows top..hem, flaring toward the hem. */
function robeBody(c: PixelCanvas, cx: number, top: number, hem: number, sway: number): (y: number) => [number, number] {
  const edges = (y: number): [number, number] => {
    const u = (y + 0.5 - top) / (hem + 1 - top);
    const hw = 3.9 + 3.3 * Math.pow(Math.max(0, u), 1.35);
    const x = cx + sway * u * u;
    return [x - hw, x + hw];
  };
  c.part();
  c.shape(top, hem, edges, S.robe, (_x, _y, t, u) => cyl(t, 0.25 - u * 0.25));
  hemTrim(c, edges, hem, sway);
  return edges;
}

/** Gold trim along the hem, or for the hooded look a ragged, notched hem. */
function hemTrim(c: PixelCanvas, edges: (y: number) => [number, number], hem: number, sway: number): void {
  const [l, r] = edges(hem);
  if (S.head === 'grove') {
    // A hem of leaves: a band, and leaf tips hanging below it that stir with the sway.
    c.part();
    c.shape(hem, hem, () => [l, r], S.trim, (_x, _y, t) => cyl(t, -0.1));
    for (let x = Math.round(l) + 1; x <= Math.round(r) - 2; x++) {
      const k = (((x - Math.round(sway)) % 3) + 3) % 3;
      if (k === 0) c.px(x, hem + 1, S.trim, cyl(0, -0.3));
      else if (k === 2) c.shade(x, hem, -1);
    }
    return;
  }
  if (!S.hooded && S.head !== 'fiend' && S.head !== 'wild') {
    c.part();
    c.shape(hem, hem, () => [l, r], S.trim, (_x, _y, t) => cyl(t, -0.1));
    return;
  }
  // Tatters: points of cloth hanging below the hem every few pixels, darker in
  // the gaps between them. The pattern drifts with the sway, so the rags flutter.
  c.part();
  const x0 = Math.round(l) + 1;
  const x1 = Math.round(r) - 2;
  for (let x = x0; x <= x1; x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    if (k === 0) c.px(x, hem + 1, S.robe, cyl(0, -0.3), { bias: -1 });
    else if (k === 1) c.shade(x, hem, -1);
    // The warlock's rags smoulder: fel embers along the torn edge.
    if (S.head === 'fiend' && k !== 0) c.spark(x, hem, (x + hem) % 2 ? S.magic.mid : S.magic.deep, 0.55);
  }
}

function boot(c: PixelCanvas, x: number, y: number, side = false): void {
  c.part();
  if (side) {
    c.ellipse(x, y, 2.2, 1.25, S.boot, { flatten: 0.8 });
  } else {
    c.ellipse(x, y, 1.75, 1.3, S.boot, { flatten: 0.8 });
  }
}

/** Pointed hat. `bend` pushes the tip sideways; `cx` is the base centre. */
function hatCone(c: PixelCanvas, cx: number, tipY: number, baseY: number, baseHW: number, bend: number): void {
  c.part();
  c.shape(
    tipY,
    baseY,
    (y) => {
      const u = (y + 0.5 - tipY) / (baseY + 1 - tipY);
      const hw = 0.55 + (baseHW - 0.55) * Math.pow(u, 1.1);
      const x = cx + bend * Math.pow(1 - u, 2.0);
      return [x - hw, x + hw];
    },
    S.robe,
    (_x, _y, t, u) => cyl(t, 0.45 - u * 0.2),
  );
}

function hatBand(c: PixelCanvas, cx: number, y: number, hw: number): void {
  c.part();
  c.shape(y, y, () => [cx - hw, cx + hw], S.trim, (_x, _y, t) => cyl(t, 0.1));
}

function brim(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number): void {
  c.part();
  c.ellipse(cx, cy, rx, ry, S.robe, {
    normal: (_x, _y, dx, dy) => {
      // A slightly domed disc: mostly facing up, front lip facing us.
      const l = Math.hypot(dx * 0.55, 0.55 - dy * 0.35, 0.75);
      return { x: (dx * 0.55) / l, y: (0.55 - dy * 0.35) / l, z: 0.75 / l };
    },
  });
}

function star(c: PixelCanvas, x: number, y: number): void {
  c.part();
  const n: Vec3 = { x: -0.3, y: 0.4, z: 0.86 };
  if (S.sigil === 'flame') {
    // A little flame: a round base, a hot heart, licking up to a tip that curls right.
    c.px(x - 1, y + 1, S.trim, n);
    c.px(x, y + 1, S.trim, n);
    c.px(x + 1, y + 1, S.trim, n);
    c.px(x - 1, y, S.trim, n);
    c.px(x, y, S.trim, n, { bias: 2 });
    c.px(x, y - 1, S.trim, n, { bias: 1 });
    c.px(x + 1, y - 2, S.trim, n, { bias: 1 });
    return;
  }
  c.px(x, y, S.trim, n, { bias: 1 });
  c.px(x - 1, y, S.trim, n);
  c.px(x + 1, y, S.trim, n);
  c.px(x, y - 1, S.trim, n);
  c.px(x, y + 1, S.trim, n);
}

// ---------------------------------------------------------------------------
// Heads: the classic pointed hat and beard

function beardedHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // Head: face, sideburns, beard, nose, eyes.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.7, 2.7, S.skin);
  c.part();
  c.shape(12 + U, 14 + U, () => [7.6, 9.2], S.beard ?? BEARD, (_x, _y, t) => cyl(t - 0.6, 0.2));
  c.shape(12 + U, 14 + U, () => [14.8, 16.4], S.beard ?? BEARD, (_x, _y, t) => cyl(t + 0.6, 0.2));
  c.part();
  const bw = [4.3, 4.1, 3.7, 3.1, 2.4, 1.7, 1.0];
  c.shape(14 + U, 20 + U, (y) => {
    const hw = bw[y - 14 - U];
    return [cx - hw, cx + hw];
  }, S.beard ?? BEARD, (_x, _y, t, u) => sphere(t * 0.85, (u - 0.25) * 1.1, 0.9));
  // Strands.
  c.shade(10, 17 + U, -1);
  c.shade(13, 18 + U, -1);
  c.shade(11, 19 + U, -1);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.part();
  if (p.blink) {
    c.px(10, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 13 + U, EYE);
    c.px(13, 13 + U, EYE);
  }

  // Hat.
  brim(c, cx, 10.7 + U, 8.6, 1.45);
  hatCone(c, cx, 1 + U, 9 + U, 4.9, 3.4 + p.hat);
  hatBand(c, cx, 9 + U, 4.9);
  star(c, 11, 5 + U);
}

function beardedHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // Back of the head: long hair and beard edges.
  c.part();
  c.ellipse(cx, 13.6 + U, 4.0, 3.0, S.beard ?? HAIR, {
    normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9),
  });
  c.part();
  c.shape(15 + U, 17 + U, (y) => {
    const hw = [3.4, 2.8, 1.8][y - 15 - U];
    return [cx - hw, cx + hw];
  }, S.beard ?? HAIR, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 0.9));
  // Strands of hair.
  c.shade(10, 13 + U, -1);
  c.shade(10, 14 + U, -1);
  c.shade(12, 14 + U, -1);
  c.shade(12, 15 + U, -1);
  c.shade(14, 13 + U, -1);
  c.shade(13, 16 + U, -1);

  brim(c, cx, 10.7 + U, 8.6, 1.45);
  hatCone(c, cx, 1 + U, 9 + U, 4.9, -3.4 - p.hat);
  hatBand(c, cx, 9 + U, 4.9);
}

function beardedHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  // Head: hair at the back, profile face, nose, beard.
  c.part();
  c.ellipse(cx + 1.2, 13.4 + U, 3.3, 2.8, S.beard ?? HAIR, {
    normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 0.9),
  });
  c.part();
  c.ellipse(cx - 1.3, 13.4 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.part();
  const bw = [
    [cx - 4.4, cx + 0.6],
    [cx - 4.6, cx + 0.4],
    [cx - 4.6, cx + 0.0],
    [cx - 4.4, cx - 0.6],
    [cx - 4.0, cx - 1.2],
    [cx - 3.6, cx - 1.8],
  ];
  c.shape(14 + U, 19 + U, (y) => bw[y - 14 - U] as [number, number], S.beard ?? BEARD, (_x, _y, t, u) => sphere(t * 0.8 - 0.1, (u - 0.2) * 1.1, 0.9), { bias: 1 });
  c.shade(cx - 3, 17 + U, -1);
  c.shade(cx - 2, 15 + U, -1);
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);

  // Hat: brim, then cone leaning back with the tip flopping behind.
  brim(c, cx - 0.4, 10.7 + U, 8.4, 1.45);
  hatCone(c, cx + 0.6, 1 + U, 9 + U, 4.6, 5.2 + p.hat);
  hatBand(c, cx + 0.6, 9 + U, 4.6);
  star(c, cx, 6 + U);
}

// ---------------------------------------------------------------------------
// Heads: the deep cowl of the hooded look

/** Half-width of the cowl for a row, u = 0 at its peak down to 1 at the shoulders. */
function cowlHW(u: number, full: number): number {
  return 0.6 + (full - 0.6) * Math.sin(Math.min(1, u / 0.62) * (Math.PI / 2));
}

/** Short shoulder cape over the robe, its lower edge cut into points. */
function mantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const top = 15 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, bottom, edges, S.robe, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl) + 1; x < Math.round(br) - 1; x++) {
    if ((((x - sway) % 3) + 3) % 3 === 0) c.px(x, bottom + 1, S.robe, cyl(0, -0.2), { bias: -1 });
  }
  // Light catching the tops of the shoulders.
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

function eyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  if (blink) return;
  c.part();
  for (const [x, y] of pts) {
    c.px(x, y, VOID_EYE, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.35);
  }
}

function hoodDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, p.hem);
  // Clasp: a silver crescent pin holding the mantle closed.
  c.part();
  c.px(cx - 1, 16 + U, S.trim, { x: -0.4, y: 0.4, z: 0.8 }, { bias: 1 });
  c.px(cx, 17 + U, S.trim, { x: 0.2, y: 0, z: 0.95 });
  c.px(cx - 1, 17 + U, S.trim, { x: -0.3, y: -0.2, z: 0.9 });

  // The cowl, its peak drooping to one side.
  const top = 4 + U;
  const bottom = 16 + U;
  const bend = 1.6 + p.hat;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.4) - (u > 0.9 ? 0.4 : 0);
    const x = cx + bend * Math.pow(1 - u, 2.2);
    return [x - hw, x + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  // Folds where the cloth gathers above the face.
  c.shade(cx - 2, 8 + U, -1);
  c.shade(cx + 2, 8 + U, -1);
  c.shade(cx + 1, 7 + U, -1);

  // The opening: a wine-coloured lining around a darkness where only the eyes show.
  c.part();
  c.ellipse(cx, 12.6 + U, 3.6, 3.5, S.inner, {
    normal: (_x, _y, dx, dy) => ({ x: -dx * 0.55, y: dy * 0.45, z: 0.75 }),
  });
  c.part();
  c.ellipse(cx, 13.1 + U, 2.8, 2.9, HOOD_SHADOW, { normal: () => FLAT_DOWN });
  eyes(c, [[cx - 2, 12 + U], [cx + 1, 12 + U]], p.blink);
}

function hoodUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, -p.hem);
  const top = 4 + U;
  const bottom = 16 + U;
  const bend = -1.6 - p.hat;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.4) - (u > 0.9 ? 0.4 : 0);
    const x = cx + bend * Math.pow(1 - u, 2.2);
    return [x - hw, x + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.45 - u * 0.4));
  // The seam down the back of the hood, and a silver crescent sewn on the mantle.
  for (let y = 8 + U; y <= 15 + U; y++) c.shade(cx, y, -1);
  c.part();
  c.px(cx - 1, 17 + U, S.trim, { x: -0.4, y: 0.3, z: 0.85 }, { bias: 1 });
  c.px(cx, 18 + U, S.trim, { x: 0, y: -0.1, z: 1 });
  c.px(cx + 1, 17 + U, S.trim, { x: 0.4, y: 0.3, z: 0.85 });
}

/** Facing left, like drawSide. */
function hoodSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  mantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  const top = 4 + U;
  const bottom = 16 + U;
  // The peak leans back and flops behind him.
  const bend = 2.8 + p.hat;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const s = Math.sin(Math.min(1, u / 0.62) * (Math.PI / 2));
    const x = bend * Math.pow(1 - u, 2.2);
    return [cx + x - 0.4 - 4.2 * s, cx + x + 0.4 + 3.8 * s];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.9 + 0.1, 0.5 - u * 0.4));
  c.shade(cx + 1, 8 + U, -1);
  c.shade(cx + 2, 12 + U, -1);
  c.shade(cx + 2, 13 + U, -1);

  // Opening at the front edge, a sliver of lining around the dark.
  c.part();
  c.ellipse(cx - 3.0, 12.8 + U, 2.0, 3.2, S.inner, {
    normal: (_x, _y, dx, dy) => ({ x: -dx * 0.5, y: dy * 0.45, z: 0.75 }),
  });
  c.part();
  c.ellipse(cx - 3.6, 13.2 + U, 1.4, 2.5, HOOD_SHADOW, { normal: () => FLAT_DOWN });
  eyes(c, [[cx - 4, 12 + U]], p.blink);
}

// ---------------------------------------------------------------------------
// Heads: the Astral's silver hair, circlet, fan collar and crown of stars

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Five small stars in an arc over the head, each twinkling on its own beat. */
function starCrown(c: PixelCanvas, cx: number, y: number, p: Pose, spread = 1): void {
  for (let i = 0; i < 5; i++) {
    const a = (-64 + i * 32) * RAD;
    const x = cx + Math.sin(a) * 5.4 * spread;
    const yy = y - Math.cos(a) * 3.0;
    const k = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(p.glow * 9 + p.staff.float * 2 + i * 2.1));
    c.spark(x, yy, S.magic.core, k);
    if (i === 2) {
      // The middle star is the brightest: four short rays.
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.spark(x + ox, yy + oy, S.magic.hot, k * 0.65);
    } else c.spark(x, yy + 1, S.magic.deep, k * 0.4);
  }
}

/** The standing fan collar behind the head: its face (lining) toward us, gold along its points. */
function fanCollar(c: PixelCanvas, cx: number, U: number, m: Material): void {
  const top = 9 + U;
  const bottom = 16 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    const hw = 6.3 - 2.1 * u;
    return [cx - hw, cx + hw];
  };
  c.part();
  c.shape(top, bottom, edges, m, (_x, _y, t, u) => sphere(t * 0.7, 0.55 - u * 0.5, 1));
  // Gold edging and four points along the top.
  c.part();
  const [l, r] = edges(top);
  for (let x = Math.round(l); x < Math.round(r); x++) c.px(x, top, S.trim, cyl((x + 0.5 - cx) / 6.3, 0.5));
  for (const x of [6, 9, 14, 17]) c.px(x, top - 1, S.trim, { x: (x - 11.5) * 0.08, y: 0.6, z: 0.8 }, { bias: 1 });
  for (let y = top + 1; y <= top + 3; y++) {
    const [el, er] = edges(y);
    c.px(Math.round(el), y, S.trim, { x: -0.6, y: 0.3, z: 0.75 });
    c.px(Math.round(er) - 1, y, S.trim, { x: 0.6, y: 0.3, z: 0.75 });
  }
}

function astralHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  fanCollar(c, cx, U, S.inner);
  // Long hair behind the face, falling past the shoulders.
  c.part();
  c.shape(10 + U, 18 + U, (y) => {
    const u = (y - 10 - U) / 8;
    const hw = 4.3 - Math.max(0, u - 0.5) * 1.6;
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  c.shade(8, 17 + U, -1);
  c.shade(15, 17 + U, -1);
  // Face.
  c.part();
  c.ellipse(cx, 13.4 + U, 3.1, 2.7, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  c.part();
  if (p.blink) {
    c.px(10, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 13 + U, EYE);
    c.px(13, 13 + U, EYE);
  }
  // Crown of the head and the fringe, parted in the middle, locks framing the face.
  c.part();
  c.ellipse(cx, 10.6 + U, 3.9, 2.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.5, 1) });
  c.shade(cx, 9 + U, -1);
  for (let y = 12; y <= 17; y++) {
    c.px(8, y + U, hair, cyl(-0.7, 0.1), { bias: y > 15 ? -1 : 0 });
    c.px(15, y + U, hair, cyl(0.7, 0.1), { bias: y > 15 ? -1 : 0 });
  }
  // The circlet, a star-gem at the brow.
  c.part();
  c.shape(11 + U, 11 + U, () => [cx - 3.6, cx + 3.6], S.trim, (_x, _y, t) => cyl(t, 0.15));
  c.part();
  c.px(11, 11 + U, S.crystal, { x: -0.3, y: 0.4, z: 0.86 });
  c.spark(11, 11 + U, S.magic.hot, 0.5 + p.glow * 0.3);
  starCrown(c, cx - 0.5, 8 + U, p);
}

function astralHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  fanCollar(c, cx, U, S.robe);
  c.part();
  c.ellipse(cx, 11.8 + U, 4.0, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.3, 0.9) });
  // Long hair down the back, parting into strands.
  c.part();
  c.shape(13 + U, 20 + U, (y) => {
    const u = (y - 13 - U) / 7;
    const hw = 3.9 - u * 1.6;
    const x = cx - p.hem * u * 0.5;
    return [x - hw, x + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  for (let y = 13; y <= 20; y++) {
    c.shade(cx - 2, y + U, -1);
    c.shade(cx + 1, y + U, -1);
  }
  c.part();
  c.shape(11 + U, 11 + U, () => [cx - 4.0, cx + 4.0], S.trim, (_x, _y, t) => cyl(t, 0.1));
  starCrown(c, cx - 0.5, 8 + U, p);
}

/** Facing left, like drawSide. */
function astralHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  // The collar stands up behind the neck, gold along its edge.
  c.part();
  c.shape(9 + U, 16 + U, (y) => {
    const u = (y - 9 - U) / 7;
    return [cx + 0.6 + u * 0.4, cx + 4.2 - u * 1.4];
  }, S.inner, (_x, _y, t, u) => cyl(t * 0.7 - 0.2, 0.5 - u * 0.4));
  c.part();
  for (let y = 9; y <= 16; y++) c.px(Math.round(cx + 4.2 - ((y - 9) / 7) * 1.4) - 1, y + U, S.trim, { x: 0.5, y: 0.3, z: 0.8 });
  c.px(cx + 3, 8 + U, S.trim, { x: 0.2, y: 0.6, z: 0.8 }, { bias: 1 });
  // Hair behind, falling long down the back.
  c.part();
  c.ellipse(cx + 0.8, 12.4 + U, 3.4, 3.0, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 0.9) });
  c.part();
  c.shape(13 + U, 19 + U, (y) => {
    const u = (y - 13 - U) / 6;
    return [cx - 0.4 + u * 0.8 + p.hem * u * 0.4, cx + 3.4 - u * 0.6 + p.hem * u * 0.6];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8 + 0.1, u * 0.7, 0.9));
  c.shade(cx + 1, 16 + U, -1);
  c.shade(cx + 2, 18 + U, -1);
  // Face in profile.
  c.part();
  c.ellipse(cx - 1.3, 13.5 + U, 2.8, 2.5, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.5, 0.3));
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);
  // Crown of the head and fringe, then the circlet with its gem at the brow.
  c.part();
  c.shape(9 + U, 10 + U, (y) => (y === 9 + U ? [cx - 3.2, cx + 2.8] : [cx - 4.4, cx + 3.6]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.8, 1));
  c.px(cx - 5, 11 + U, hair, cyl(-0.7, 0.2));
  c.part();
  c.shape(11 + U, 11 + U, () => [cx - 4.4, cx + 2.4], S.trim, (_x, _y, t) => cyl(t * 0.9 - 0.1, 0.15));
  c.part();
  c.px(cx - 4, 11 + U, S.crystal, { x: -0.5, y: 0.4, z: 0.77 });
  c.spark(cx - 4, 11 + U, S.magic.hot, 0.5 + p.glow * 0.3);
  starCrown(c, cx - 0.2, 8 + U, p, 0.75);
}

/** A strewing of stars over the robe: fixed to the cloth, so they ride along with it. */
function starfield(c: PixelCanvas, U: number): void {
  for (let y = 14; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const m = c.materialAt(x, y);
      if (m !== S.robe && m !== S.inner) continue;
      const h = hash(x, y - U, 11);
      if (h > 0.955) c.spark(x, y, S.magic.core, 0.55);
      else if (h > 0.92) c.spark(x, y, S.magic.mid, 0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// Heads: the Hellfire warlock's horns, demon face and bone-spiked mantle

/** A ram's horn along a chain of points, ridged as it tapers. */
function ramHorn(c: PixelCanvas, pts: [number, number][], r0 = 1.25, r1 = 0.45): void {
  c.part();
  for (let i = 0; i < pts.length - 1; i++) {
    const ra = r0 + ((r1 - r0) * i) / (pts.length - 1);
    const rb = r0 + ((r1 - r0) * (i + 1)) / (pts.length - 1);
    c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ra, rb, HORN, { bias: i % 2 ? 0 : -1 });
  }
}

function boneSpike(c: PixelCanvas, x: number, y: number, dx: number, dy: number): void {
  c.part();
  c.capsule(x, y, x + dx, y + dy, 0.95, 0.3, HORN, { bias: 1 });
}

function fiendEyes(c: PixelCanvas, pts: [number, number][], blink: boolean | undefined): void {
  c.part();
  for (const [x, y] of pts) {
    if (blink) {
      c.px(x, y, S.skin, FLAT_DOWN, { bias: -1 });
      continue;
    }
    c.px(x, y, FEL_EYE, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.4);
  }
}

function fiendHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, p.hem);
  boneSpike(c, cx - 4.3, 15.8 + U, -1.6, -3.0);
  boneSpike(c, cx + 4.3, 15.8 + U, 1.6, -3.0);
  // A fel clasp at the throat.
  c.part();
  c.px(cx - 1, 16 + U, S.trim, { x: -0.3, y: 0.4, z: 0.86 });
  c.px(cx, 16 + U, S.trim, { x: 0.3, y: 0.4, z: 0.86 });
  // Face, pointed ears, slicked black hair with a widow's peak.
  c.part();
  c.ellipse(cx, 13.1 + U, 3.2, 2.8, S.skin);
  c.part();
  c.px(8, 13 + U, S.skin, sphere(-0.7, 0), { bias: -1 });
  c.px(7, 12 + U, S.skin, sphere(-0.6, -0.4));
  c.px(15, 13 + U, S.skin, sphere(0.7, 0), { bias: -1 });
  c.px(16, 12 + U, S.skin, sphere(0.6, -0.4), { bias: -1 });
  c.part();
  c.shape(9 + U, 11 + U, (y) => {
    const hw = [2.4, 3.3, 3.5][y - 9 - U];
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  c.px(11, 12 + U, hair, FLAT_DOWN);
  c.px(12, 12 + U, hair, FLAT_DOWN);
  // Nose and cheekbones.
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.shade(9, 14 + U, -1);
  c.shade(14, 14 + U, -1);
  fiendEyes(c, [[10, 13 + U], [13, 13 + U]], p.blink);
  // A pointed black goatee.
  c.part();
  c.shape(15 + U, 17 + U, (y) => {
    const hw = [1.8, 1.0, 0.6][y - 15 - U];
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.8, u * 0.6, 1));
  // The horns sweep out from the temples and curl down at their tips.
  for (const k of [-1, 1]) {
    ramHorn(c, [
      [cx + k * 2.8, 10.2 + U],
      [cx + k * 4.9, 8.8 + U],
      [cx + k * 6.4, 6.8 + U],
      [cx + k * 7.0, 4.6 + U],
      [cx + k * 6.5, 2.8 + U],
    ], 1.35, 0.35);
  }
}

function fiendHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  mantle(c, cx - 5.0, cx + 5.0, U, 1.1, -p.hem);
  boneSpike(c, cx - 4.3, 15.8 + U, -1.6, -3.0);
  boneSpike(c, cx + 4.3, 15.8 + U, 1.6, -3.0);
  c.part();
  c.px(7, 12 + U, S.skin, sphere(-0.6, -0.4), { bias: -1 });
  c.px(16, 12 + U, S.skin, sphere(0.6, -0.4), { bias: -1 });
  c.part();
  c.ellipse(cx, 12.2 + U, 3.7, 3.3, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.shade(cx - 1, 10 + U, 1);
  c.shade(cx, 13 + U, -1);
  c.shade(cx, 14 + U, -1);
  for (const k of [-1, 1]) {
    ramHorn(c, [
      [cx + k * 2.8, 10.2 + U],
      [cx + k * 4.9, 8.8 + U],
      [cx + k * 6.4, 6.8 + U],
      [cx + k * 7.0, 4.6 + U],
      [cx + k * 6.5, 2.8 + U],
    ], 1.35, 0.35);
  }
}

/** Facing left, like drawSide. */
function fiendHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const hair = S.hair ?? HAIR;
  mantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  boneSpike(c, cx + 0.6, 15.8 + U, 1.4, -3.0);
  // The far horn, peeking over the head.
  ramHorn(c, [
    [cx + 1.4, 9.6 + U],
    [cx + 2.8, 7.4 + U],
    [cx + 4.4, 6.6 + U],
  ], 0.9, 0.5);
  c.part();
  c.ellipse(cx + 0.9, 12.3 + U, 3.0, 2.9, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  c.part();
  c.ellipse(cx - 1.4, 13.3 + U, 2.8, 2.6, S.skin);
  c.part();
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.shade(cx - 3, 14 + U, -1);
  // Hairline sweeping back from the brow.
  c.part();
  c.shape(10 + U, 11 + U, (y) => (y === 10 + U ? [cx - 3.6, cx + 2.4] : [cx - 2.4, cx + 2.8]), hair, (_x, _y, t, u) => sphere(t * 0.9, u - 0.7, 1));
  fiendEyes(c, [[cx - 3, 13 + U]], p.blink);
  // Goatee jutting from the chin.
  c.part();
  c.px(cx - 4, 15 + U, hair, sphere(-0.3, 0.2));
  c.px(cx - 3, 15 + U, hair, sphere(0.2, 0.2), { bias: -1 });
  c.px(cx - 4, 16 + U, hair, sphere(-0.2, 0.4));
  c.px(cx - 5, 17 + U, hair, sphere(-0.4, 0.6), { bias: 1 });
  // The near horn curls back round the pointed ear.
  c.part();
  c.px(cx + 1, 13 + U, S.skin, sphere(0.3, -0.2));
  c.px(cx + 2, 12 + U, S.skin, sphere(0.5, -0.5), { bias: -1 });
  ramHorn(c, [
    [cx - 0.2, 10.4 + U],
    [cx + 1.8, 8.2 + U],
    [cx + 4.0, 7.8 + U],
    [cx + 5.4, 9.6 + U],
    [cx + 4.8, 11.8 + U],
    [cx + 3.2, 12.4 + U],
  ]);
}

/** Fel runes smouldering down the open front of the warlock's robe. */
function felRunes(c: PixelCanvas, x: (y: number) => number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) % 3;
    if (k === 2) continue;
    c.spark(Math.round(x(y)) + (k === 0 ? 0 : -1), y, k === 0 ? S.magic.hot : S.magic.mid, 0.5);
  }
}

// ---------------------------------------------------------------------------
// Heads: the Grovekeeper's hood of moss, antlers and mantle of leaves

/** A mantle over the shoulders, its lower edge a row of leaf points. */
function leafMantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const top = 15 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, bottom, edges, S.robe, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
  // Leaves along the edge: a lit tip hanging below, a lighter leaf on the edge beside it.
  c.part();
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl); x < Math.round(br); x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    const t = (x + 0.5 - (bl + br) / 2) / ((br - bl) / 2);
    if (k === 0) c.px(x, bottom + 1, S.trim, cyl(t, -0.3));
    else if (k === 1) c.px(x, bottom, S.trim, cyl(t, 0.2), { bias: 1 });
  }
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

/**
 * An antler rooted at (x, y): a beam curving up and out, an inner tine and an
 * outer one. `k` is the way it spreads (-1 left); `s` narrows it (seen from the side).
 */
function antler(c: PixelCanvas, x: number, y: number, k: number, s = 1, bias = 0): void {
  const bone = S.hair ?? ANTLER;
  const at = (dx: number, dy: number) => ({ x: x + k * dx * s, y: y + dy });
  const a = at(0, 0);
  const b = at(1.8, -3.2);
  const tip = at(2.6, -6.2);
  c.part();
  c.capsule(a.x, a.y, b.x, b.y, 0.8, 0.65, bone, { bias });
  c.capsule(b.x, b.y, tip.x, tip.y, 0.65, 0.4, bone, { bias });
  const m = at(1.4, -2.6);
  const inner = at(0.1, -5.3);
  c.capsule(m.x, m.y, inner.x, inner.y, 0.55, 0.35, bone, { bias });
  const o0 = at(2.2, -4.4);
  const o1 = at(4.4, -5.6);
  c.capsule(o0.x, o0.y, o1.x, o1.y, 0.5, 0.35, bone, { bias: bias + 1 });
}

/** A blossom glowing at an antler's tip, breathing with the staff. */
function blossom(c: PixelCanvas, x: number, y: number, p: Pose): void {
  const k = 0.45 + p.glow * 0.4;
  c.spark(x, y, S.magic.core, k);
  c.spark(x + 1, y, S.magic.hot, k * 0.5);
  c.spark(x - 1, y, S.magic.hot, k * 0.5);
  c.spark(x, y - 1, S.magic.mid, k * 0.4);
}

/** The Grovekeeper's hood: round and close, falling to the shoulders. */
function mossHood(c: PixelCanvas, cx: number, U: number, lean: number): void {
  const top = 5 + U;
  const bottom = 16 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const hw = cowlHW(u, 5.2) - (u > 0.9 ? 0.4 : 0);
    const x = cx + lean * Math.pow(1 - u, 2.2);
    return [x - hw, x + hw];
  }, S.robe, (_x, _y, t, u) => cyl(t, 0.5 - u * 0.4));
  // Tufts of moss catching the light, and a hollow or two.
  c.shade(cx - 3, 8 + U, 1);
  c.shade(cx + 2, 7 + U, 1);
  c.shade(cx - 1, 6 + U, -1);
  c.shade(cx + 3, 11 + U, -1);
}

function groveHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  leafMantle(c, cx - 5.0, cx + 5.0, U, 1.2, p.hem);
  antler(c, cx - 2.6, 8 + U, -1);
  antler(c, cx + 2.6, 8 + U, 1);
  mossHood(c, cx, U, 0);
  // The opening lined with bark, the face within.
  c.part();
  c.ellipse(cx, 12.8 + U, 3.5, 3.4, S.inner, { normal: (_x, _y, dx, dy) => ({ x: -dx * 0.55, y: dy * 0.45, z: 0.75 }) });
  c.part();
  c.ellipse(cx, 13.4 + U, 2.8, 2.6, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  c.part();
  if (p.blink) {
    c.px(10, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 13 + U, EYE);
    c.px(13, 13 + U, EYE);
  }
  // A band of young leaves across the brow.
  c.part();
  for (let x = cx - 3; x <= cx + 2; x++) c.px(x, 10 + U, S.trim, cyl((x + 0.5 - cx) / 3.5, 0.4), { bias: x & 1 ? 1 : 0 });
  blossom(c, cx + 7, 2 + U, p);
}

function groveHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  leafMantle(c, cx - 5.0, cx + 5.0, U, 1.2, -p.hem);
  antler(c, cx - 2.6, 8 + U, -1);
  antler(c, cx + 2.6, 8 + U, 1);
  mossHood(c, cx, U, 0);
  // A seam down the back of the hood, and leaves trailing from its point.
  for (let y = 8 + U; y <= 15 + U; y++) c.shade(cx, y, -1);
  c.part();
  c.px(cx - 1, 16 + U, S.trim, cyl(-0.4, 0.2), { bias: 1 });
  c.px(cx, 17 + U, S.trim, cyl(0.2, 0));
  c.px(cx + 1, 16 + U, S.trim, cyl(0.5, 0.2));
  blossom(c, cx - 7, 2 + U, p);
}

/** Facing left, like drawSide. */
function groveHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  leafMantle(c, cx - 3.8, cx + 3.6, U, 1.0, p.hem);
  // The far antler, peeking up behind the near one.
  antler(c, cx + 1.6, 8 + U, 1, 0.8, -1);
  const top = 5 + U;
  const bottom = 16 + U;
  c.part();
  c.shape(top, bottom, (y) => {
    const u = (y + 0.5 - top) / (bottom + 1 - top);
    const s = Math.sin(Math.min(1, u / 0.62) * (Math.PI / 2));
    const x = 1.2 * Math.pow(1 - u, 2.2);
    return [cx + x - 0.4 - 4.2 * s, cx + x + 0.4 + 3.8 * s];
  }, S.robe, (_x, _y, t, u) => cyl(t * 0.9 + 0.1, 0.5 - u * 0.4));
  c.shade(cx + 1, 8 + U, 1);
  c.shade(cx + 2, 12 + U, -1);
  antler(c, cx - 0.6, 8 + U, 1, 0.9);
  // Bark round the opening, the face in profile within.
  c.part();
  c.ellipse(cx - 3.0, 12.8 + U, 2.0, 3.2, S.inner, { normal: (_x, _y, dx, dy) => ({ x: -dx * 0.5, y: dy * 0.45, z: 0.75 }) });
  c.part();
  c.ellipse(cx - 3.4, 13.4 + U, 1.6, 2.4, S.skin);
  c.px(cx - 5, 13 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.part();
  if (p.blink) c.px(cx - 4, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 4, 13 + U, EYE);
  c.part();
  for (let x = cx - 4; x <= cx - 1; x++) c.px(x, 10 + U, S.trim, cyl((x + 0.5 - cx + 2.5) / 2.5, 0.4), { bias: x & 1 ? 1 : 0 });
  blossom(c, cx + 3, 2 + U, p);
}

/** Leaves caught on the robe near the hem, and fireflies drifting round the Grovekeeper. */
function groveFlecks(c: PixelCanvas, U: number, p: Pose): void {
  for (let y = 22; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (c.materialAt(x, y) !== S.robe) continue;
      const h = hash(x, y - U, 23);
      if (h > 0.9 + (28 - y) * 0.012) c.px(x, y, S.trim, cyl(0, 0.2), { bias: h > 0.97 ? 1 : 0 });
    }
  }
  const ph = p.glow * 7 + p.staff.float * 3 + p.breath * 1.3 + p.hem;
  const spots: [number, number][] = [[3.5, 19], [20, 15], [6, 27], [19, 25]];
  spots.forEach(([x, y], i) => {
    const fx = x + Math.sin(ph + i * 2.1) * 1.5;
    const fy = y + Math.cos(ph * 1.3 + i) * 1.5;
    const on = 0.5 + 0.5 * Math.sin(ph * 2 + i * 1.7);
    c.spark(fx, fy, S.magic.hot, 0.35 + on * 0.45);
  });
}

// ---------------------------------------------------------------------------
// Heads: the Shapeshifter's wolf pelt, fur mantle and woad

/** A mantle of grey fur, its lower edge ragged with tufts. */
function furMantle(c: PixelCanvas, l: number, r: number, U: number, flare: number, sway: number): void {
  const pelt = S.hair ?? HAIR;
  const top = 14 + U;
  const bottom = 18 + U;
  const edges = (y: number): [number, number] => {
    const u = (y - top) / (bottom - top);
    return [l - flare * u, r + flare * u];
  };
  c.part();
  c.shape(top, bottom, edges, pelt, (_x, _y, t, u) => cyl(t, 0.55 - u * 0.4));
  const [bl, br] = edges(bottom);
  for (let x = Math.round(bl); x < Math.round(br); x++) {
    const k = (((x - Math.round(sway)) % 3) + 3) % 3;
    if (k === 0) c.px(x, bottom + 1, pelt, cyl(0, -0.3), { bias: -1 });
    if (k === 2) {
      c.shade(x, bottom, -1);
      c.shade(x, bottom - 1, -1);
    }
  }
  c.shade(Math.round(l), top, 1);
  c.shade(Math.round(r) - 1, top, 1);
}

/** The pelt's ears, standing up either side of its skull. */
function wolfEar(c: PixelCanvas, x: number, U: number): void {
  const pelt = S.hair ?? HAIR;
  c.part();
  c.shape(5 + U, 8 + U, (y) => {
    const u = (y - 5 - U) / 3;
    const hw = 0.45 + 1.15 * u;
    return [x - hw, x + hw];
  }, pelt, (_x, _y, t, u) => cyl(t * 0.8, 0.5 - u * 0.3));
  c.part();
  c.px(x - 0.5, 7 + U, S.inner, { x: 0, y: -0.2, z: 0.98 });
}

function wolfEyes(c: PixelCanvas, pts: [number, number][], p: Pose): void {
  c.part();
  for (const [x, y] of pts) {
    c.px(x, y, WOLF_EYE, { x: 0, y: 0, z: 1 });
    c.spark(x, y, S.magic.hot, 0.35 + p.glow * 0.3);
  }
}

function wildHeadDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const pelt = S.hair ?? HAIR;
  const hair = S.beard ?? HAIR;
  furMantle(c, cx - 5.2, cx + 5.2, U, 1.3, p.hem);
  // Her hair, falling either side of the face.
  c.part();
  c.shape(11 + U, 17 + U, (y) => {
    const u = (y - 11 - U) / 6;
    const hw = 4.2 - Math.max(0, u - 0.6) * 1.5;
    return [cx - hw, cx + hw];
  }, hair, (_x, _y, t, u) => sphere(t * 0.9, u * 0.9 - 0.3, 0.9));
  c.shade(8, 16 + U, -1);
  c.shade(15, 16 + U, -1);
  // The face, woad striped under the eyes.
  c.part();
  c.ellipse(cx, 13.7 + U, 2.9, 2.5, S.skin);
  c.part();
  c.px(11, 14 + U, S.skin, sphere(-0.4, -0.3), { bias: 1 });
  c.px(12, 14 + U, S.skin, sphere(0.35, -0.2));
  c.shade(12, 15 + U, -1);
  c.px(9, 14 + U, WOAD, FLAT_DOWN);
  c.px(14, 14 + U, WOAD, FLAT_DOWN);
  c.part();
  if (p.blink) {
    c.px(10, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
    c.px(13, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  } else {
    c.px(10, 13 + U, EYE);
    c.px(13, 13 + U, EYE);
  }
  // The wolf's head over her brow: its skull, ears, and the muzzle resting on her forehead.
  wolfEar(c, cx - 3.3, U);
  wolfEar(c, cx + 3.3, U);
  c.part();
  c.ellipse(cx, 9.3 + U, 4.6, 2.9, pelt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.4, 1) });
  c.shade(cx - 1, 7 + U, 1);
  c.shade(cx, 8 + U, -1);
  c.part();
  c.ellipse(cx, 11.2 + U, 2.2, 1.3, MUZZLE, { normal: (_x, _y, dx, dy) => sphere(dx * 0.8, dy * 0.7 - 0.2, 1) });
  c.part();
  c.px(11, 12 + U, WOLF_NOSE, FLAT_DOWN);
  c.px(12, 12 + U, WOLF_NOSE, FLAT_DOWN);
  wolfEyes(c, [[9, 9 + U], [14, 9 + U]], p);
}

function wildHeadUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const pelt = S.hair ?? HAIR;
  const hair = S.beard ?? HAIR;
  furMantle(c, cx - 5.2, cx + 5.2, U, 1.3, -p.hem);
  c.part();
  c.shape(12 + U, 18 + U, (y) => {
    const u = (y - 12 - U) / 6;
    return [cx - 4.0 + u * 0.8, cx + 4.0 - u * 0.8];
  }, hair, (_x, _y, t, u) => sphere(t * 0.85, u * 0.7, 0.9));
  wolfEar(c, cx - 3.3, U);
  wolfEar(c, cx + 3.3, U);
  c.part();
  c.ellipse(cx, 10.2 + U, 4.6, 3.3, pelt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.2, 1) });
  // The hide runs down her back to the tail, a darker stripe along its spine.
  const top = 12 + U;
  const tail = 23 + U;
  c.part();
  c.shape(top, tail, (y) => {
    const u = (y - top) / (tail - top);
    const hw = 3.6 - u * 2.6;
    const x = cx - p.hem * u * 0.6;
    return [x - hw, x + hw];
  }, pelt, (_x, _y, t, u) => cyl(t, 0.3 - u * 0.4));
  for (let y = 9 + U; y < tail; y++) c.shade(Math.round(cx - p.hem * Math.max(0, (y - top) / (tail - top)) * 0.6), y, -1);
  c.part();
  c.px(cx - Math.round(p.hem * 0.6), tail + 1, MUZZLE, cyl(0, -0.2));
}

/** Facing left, like drawSide. */
function wildHeadSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  const pelt = S.hair ?? HAIR;
  const hair = S.beard ?? HAIR;
  furMantle(c, cx - 3.9, cx + 3.8, U, 1.1, p.hem);
  // The hide trailing down her back.
  c.part();
  c.shape(11 + U, 21 + U, (y) => {
    const u = (y - 11 - U) / 10;
    return [cx + 0.6 + u * 0.8 + p.hem * u * 0.5, cx + 4.2 - u * 1.4 + p.hem * u * 0.7];
  }, pelt, (_x, _y, t, u) => cyl(t * 0.8 + 0.1, 0.3 - u * 0.4));
  c.part();
  c.ellipse(cx + 0.9, 13.6 + U, 2.8, 2.8, hair, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9, dy * 0.8 - 0.1, 0.9) });
  // The face in profile, woad on the cheek.
  c.part();
  c.ellipse(cx - 1.3, 13.9 + U, 2.8, 2.4, S.skin);
  c.part();
  c.px(cx - 5, 14 + U, S.skin, sphere(-0.6, -0.2), { bias: 1 });
  c.px(cx - 2, 14 + U, WOAD, FLAT_DOWN);
  c.part();
  if (p.blink) c.px(cx - 3, 13 + U, S.skin, FLAT_DOWN, { bias: -1 });
  else c.px(cx - 3, 13 + U, EYE);
  // The wolf's head in profile, its muzzle jutting out over her brow.
  wolfEar(c, cx + 1.6, U);
  c.part();
  c.ellipse(cx + 0.2, 9.6 + U, 4.0, 2.7, pelt, { normal: (_x, _y, dx, dy) => sphere(dx * 0.9 - 0.1, dy * 0.8 - 0.3, 1) });
  c.part();
  c.capsule(cx - 3, 10.6 + U, cx - 6.0, 11.2 + U, 1.35, 0.95, MUZZLE);
  c.part();
  c.px(cx - 7, 11 + U, WOLF_NOSE, FLAT_DOWN);
  wolfEyes(c, [[cx - 2, 9 + U]], p);
}

function headDown(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  if (S.head === 'astral') astralHeadDown(c, cx, U, p);
  else if (S.head === 'fiend') fiendHeadDown(c, cx, U, p);
  else if (S.head === 'grove') groveHeadDown(c, cx, U, p);
  else if (S.head === 'wild') wildHeadDown(c, cx, U, p);
  else if (S.hooded) hoodDown(c, cx, U, p);
  else beardedHeadDown(c, cx, U, p);
}

function headUp(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  if (S.head === 'astral') astralHeadUp(c, cx, U, p);
  else if (S.head === 'fiend') fiendHeadUp(c, cx, U, p);
  else if (S.head === 'grove') groveHeadUp(c, cx, U, p);
  else if (S.head === 'wild') wildHeadUp(c, cx, U, p);
  else if (S.hooded) hoodUp(c, cx, U, p);
  else beardedHeadUp(c, cx, U, p);
}

function headSide(c: PixelCanvas, cx: number, U: number, p: Pose): void {
  if (S.head === 'astral') astralHeadSide(c, cx, U, p);
  else if (S.head === 'fiend') fiendHeadSide(c, cx, U, p);
  else if (S.head === 'grove') groveHeadSide(c, cx, U, p);
  else if (S.head === 'wild') wildHeadSide(c, cx, U, p);
  else if (S.hooded) hoodSide(c, cx, U, p);
  else beardedHeadSide(c, cx, U, p);
}

// ---------------------------------------------------------------------------
// Directions

function drawDown(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  boot(c, 9.5, 29.6 - p.footA);
  boot(c, 14.5, 29.6 - p.footB);

  const top = 16 + U;
  const hem = 28 + L;
  const edges = robeBody(c, cx, top, hem, p.hem);

  // Open robe front showing the darker inner layer.
  const belt = 21 + U;
  c.part();
  c.shape(belt + 1, hem - 1, (y) => {
    const u = (y - belt) / (hem - belt);
    const x = cx + p.hem * Math.pow((y + 0.5 - top) / (hem + 1 - top), 2);
    return [x - 0.5 - u * 0.6, x + 0.5 + u * 0.6];
  }, S.inner, (_x, _y, t) => cyl(t * 0.5, 0.1));
  if (S.head === 'fiend') felRunes(c, (y) => cx + p.hem * Math.pow((y + 0.5 - top) / (hem + 1 - top), 2), belt + 2, hem - 1);

  // Belt with buckle.
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(11, belt, S.trim, { x: -0.3, y: 0.3, z: 0.9 }, { bias: 1 });
  c.px(12, belt, S.trim, { x: 0.2, y: 0.3, z: 0.9 });

  // Free arm (character's left, screen right).
  sleeve(c, 15.8, 17.2 + U, 17.6, 21.6 + U + p.arm);
  hand(c, 17.9, 22.4 + U + p.arm);

  headDown(c, cx, U, p);

  // Staff hand.
  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  sleeve(c, 8.2, 17.2 + U, p.staff.hx + 0.4, p.staff.hy - 0.3);
  hand(c, p.staff.hx, p.staff.hy);

  if (S.head === 'astral') starfield(c, U);
  if (S.head === 'grove') groveFlecks(c, U, p);
  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

function drawUp(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 12;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  boot(c, 9.5, 29.6 - p.footB);
  boot(c, 14.5, 29.6 - p.footA);

  const top = 16 + U;
  const hem = 28 + L;
  const edges = robeBody(c, cx, top, hem, p.hem);
  // A soft back seam.
  for (let y = top + 2; y < hem; y++) c.shade(12, y, -1);

  const belt = 21 + U;
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], S.belt, (_x, _y, t) => cyl(t, 0));

  // Free arm (character's left, now screen left).
  sleeve(c, 8.2, 17.2 + U, 6.4, 21.6 + U + p.arm);
  hand(c, 6.1, 22.4 + U + p.arm);

  headUp(c, cx, U, p);

  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  sleeve(c, 15.8, 17.2 + U, p.staff.hx - 0.4, p.staff.hy - 0.3);
  hand(c, p.staff.hx, p.staff.hy);

  if (S.head === 'astral') starfield(c, U);
  if (S.head === 'grove') groveFlecks(c, U, p);
  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

/** Facing left. Right-facing frames are mirrored from these. */
function drawSide(c: PixelCanvas, p: Pose): FrameMeta {
  const L = -p.lift;
  const U = L + p.breath;
  const cx = 13;

  let tip = { x: 0, y: 0 };
  if (p.staffBehind) tip = drawStaff(c, p.staff, p.glow);

  // Back foot first, then front foot.
  boot(c, 14.2 - p.footB, 29.6 - Math.max(0, p.footB) * 0.35, true);
  boot(c, 11.2 - p.footA, 29.6 - Math.max(0, p.footA) * 0.35, true);

  const top = 16 + U;
  const hem = 28 + L;
  // Robe in profile: chest in front, flaring more toward the back.
  const edges = (y: number): [number, number] => {
    const u = Math.max(0, (y + 0.5 - top) / (hem + 1 - top));
    const sw = p.hem * u * u;
    const l = cx - 3.6 - 2.2 * Math.pow(u, 1.4) + sw;
    const r = cx + 2.6 + 3.6 * Math.pow(u, 1.2) + sw;
    return [l, r];
  };
  c.part();
  c.shape(top, hem, edges, S.robe, (_x, _y, t, u) => cyl(t * 0.9 - 0.1, 0.25 - u * 0.25));
  hemTrim(c, edges, hem, p.hem);
  const belt = 21 + U;
  const [bl, br] = edges(belt);
  c.part();
  c.shape(belt, belt, () => [bl, br], S.belt, (_x, _y, t) => cyl(t, 0));
  c.part();
  c.px(Math.round(bl), belt, S.trim, { x: -0.5, y: 0.3, z: 0.8 }, { bias: 1 });
  // Front edge of the robe opening.
  for (let y = belt + 1; y < hem; y++) {
    const [l] = edges(y);
    c.px(Math.round(l) + 1, y, S.inner, cyl(-0.4, 0));
  }

  // Near arm sits under the beard; the hand is redrawn over the staff later.
  sleeve(c, cx + 0.8, 17.4 + U, p.staff.hx + 0.6, p.staff.hy - 0.4);
  hand(c, p.staff.hx, p.staff.hy);

  headSide(c, cx, U, p);

  if (!p.staffBehind) tip = drawStaff(c, p.staff, p.glow);
  hand(c, p.staff.hx, p.staff.hy);

  if (S.head === 'astral') starfield(c, U);
  if (S.head === 'grove') groveFlecks(c, U, p);
  finishMagic(c, p, tip);
  return { tipX: tip.x, tipY: tip.y, glow: p.glow };
}

const FLAT_DOWN: Vec3 = { x: 0, y: -0.3, z: 0.95 };

function finishMagic(c: PixelCanvas, p: Pose, tip: { x: number; y: number }): void {
  if (p.trail && p.trail.length > 1) drawTrail(c, p.staff, p.trail);
  if (p.flash) drawFlash(c, tip.x, tip.y, p.flash);
  // A single bright glint at the heart of the crystal.
  c.spark(tip.x - 0.4, tip.y - 0.6, S.magic.core, 0.35 + p.glow * 0.5);
  if (S.head === 'fiend') {
    // The crystal is a green flame: its tongue licks up, flickering with the pose.
    const lean = p.hat + (p.staff.float % 2 ? 1 : 0);
    c.spark(tip.x - 0.4, tip.y - 3, S.magic.hot, 0.45 + p.glow * 0.3);
    c.spark(tip.x - 0.4 + (lean % 2 ? 1 : -1), tip.y - 4, S.magic.mid, 0.35 + p.glow * 0.25);
  } else if (S.head === 'astral') {
    // The star at the staff's head throws out four long rays.
    const r = 2 + Math.round(p.glow * 1.5);
    for (let i = 2; i <= r + 1; i++) {
      const a = (0.5 + p.glow * 0.3) * (1 - (i - 1) / (r + 1));
      c.spark(tip.x + i, tip.y, S.magic.hot, a);
      c.spark(tip.x - i, tip.y, S.magic.hot, a);
      c.spark(tip.x, tip.y + i, S.magic.hot, a);
      c.spark(tip.x, tip.y - i, S.magic.hot, a);
    }
  }
}

// ---------------------------------------------------------------------------
// Animations

const IDLE_STAFF: Record<'down' | 'up' | 'side', Staff> = {
  down: { hx: 4.6, hy: 21.6, angle: 0, len: 23, grip: 0.38, float: 1.2 },
  up: { hx: 19.4, hy: 21.6, angle: 0, len: 23, grip: 0.38, float: 1.2 },
  side: { hx: 7.6, hy: 21.4, angle: -4, len: 23, grip: 0.38, float: 1.2 },
};

const base = (view: 'down' | 'up' | 'side'): Pose => ({
  lift: 0,
  breath: 0,
  hat: 0,
  footA: 0,
  footB: 0,
  hem: 0,
  arm: 0,
  staff: { ...IDLE_STAFF[view] },
  glow: 0.6,
});

function idle(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const N = 16;
  for (let f = 0; f < N; f++) {
    const ph = (f / N) * Math.PI * 4; // two breaths per loop
    const p = base(view);
    p.breath = Math.sin(ph - 0.6) > 0.1 ? 1 : 0;
    p.hat = Math.sin(ph - 1.6) > 0.3 ? (view === 'side' ? -1 : 1) : 0;
    p.staff.hy += p.breath * 0.5;
    p.staff.float = 1.2 + Math.round(Math.sin((f / N) * Math.PI * 2) * 1);
    p.glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((f / N) * Math.PI * 2));
    p.blink = f === 11;
    frames.push(p);
  }
  return frames;
}

function walk(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const N = 6;
  for (let f = 0; f < N; f++) {
    const ph = ((f + 0.5) / N) * Math.PI * 2;
    const s = Math.sin(ph);
    const p = base(view);
    p.lift = Math.abs(s) < 0.6 ? 1 : 0; // passing frames rise
    if (view === 'side') {
      p.footA = Math.round(s * 2.4);
      p.footB = -p.footA;
      p.hem = -Math.round(s * 1);
      p.hat = p.lift ? 0 : 1;
      p.staff.angle = -4 - s * 9;
      p.staff.hx += -s * 1.2;
    } else {
      p.footA = s > 0.3 ? 1 : 0;
      p.footB = s < -0.3 ? 1 : 0;
      p.hem = Math.round(s * 0.9);
      p.arm = Math.round(-s * 1);
      p.hat = p.lift ? 1 : 0;
      p.staff.hy += s > 0 ? -1 : 0;
    }
    p.staff.hy -= p.lift;
    p.glow = 0.7;
    frames.push(p);
  }
  return frames;
}

/** Index of the frame in the cast animation that releases the projectile. */
export const CAST_RELEASE = 6;

// Twirl centre and release pose per view (shared by the cast and the beam).
const CAST_CFG = {
  down: {
    wind: { hx: 6.4, hy: 19.2, angle: -18, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 12, hy: 18, len: 15, grip: 0.5 },
    release: { hx: 12, hy: 19.5, angle: 180, len: 12, grip: 0.3, float: 0 },
    recover: { hx: 6.2, hy: 20.6, angle: -8, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: false,
  },
  up: {
    wind: { hx: 17.6, hy: 19.2, angle: 18, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 16, hy: 11, len: 12, grip: 0.5 },
    release: { hx: 14.8, hy: 12.5, angle: -8, len: 13, grip: 0.3, float: 0 },
    recover: { hx: 17.8, hy: 20.6, angle: 8, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: true,
  },
  side: {
    wind: { hx: 14.6, hy: 18.6, angle: 24, len: 21, grip: 0.4, float: 1.2 },
    spin: { hx: 9, hy: 17, len: 14, grip: 0.5 },
    release: { hx: 10, hy: 18, angle: -75, len: 11, grip: 0.3, float: 0 },
    recover: { hx: 9, hy: 20.4, angle: -14, len: 22, grip: 0.38, float: 1.2 },
    behindRelease: false,
  },
};

function cast(view: 'down' | 'up' | 'side'): Pose[] {
  const frames: Pose[] = [];
  const twirl = [30, 100, 170, 240, 310];
  const cfg = CAST_CFG[view];

  // 0: wind-up, gathering light.
  const w = base(view);
  w.staff = { ...cfg.wind };
  w.breath = 1;
  w.glow = 0.9;
  w.hat = view === 'side' ? -1 : 1;
  frames.push(w);

  // 1-5: the staff twirls around the hand, crystal carving an arc.
  twirl.forEach((a, i) => {
    const p = base(view);
    p.staff = { ...cfg.spin, angle: a, float: 0 };
    p.glow = 1;
    p.trail = [a - 150, a - 100, a - 50, a];
    p.hat = i % 2 ? 1 : 0;
    p.hem = view === 'side' ? (i % 2 ? 1 : 0) : 0;
    frames.push(p);
  });

  // 6: release, a burst at the crystal.
  const r = base(view);
  r.staff = { ...cfg.release };
  r.staffBehind = cfg.behindRelease;
  r.glow = 1;
  r.flash = 1;
  r.lift = 0;
  r.hem = view === 'side' ? 1 : 0;
  frames.push(r);

  // 7: follow-through, the burst fading.
  const h = base(view);
  h.staff = { ...cfg.release };
  h.staffBehind = cfg.behindRelease;
  h.glow = 0.85;
  h.flash = 0.45;
  frames.push(h);

  // 8: settle back toward idle.
  const s = base(view);
  s.staff = { ...cfg.recover };
  s.glow = 0.7;
  s.breath = 1;
  frames.push(s);
  return frames;
}

/** Beam, part 1: the staff swings from a wind-up to level at the target. */
function aim(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  const w = base(view);
  w.staff = { ...cfg.wind };
  w.breath = 1;
  w.glow = 0.9;
  w.hat = view === 'side' ? -1 : 1;

  const l = base(view);
  l.staff = { ...cfg.release };
  l.staffBehind = cfg.behindRelease;
  l.glow = 1;
  l.flash = 0.3;
  return [w, l];
}

/** Beam, part 2: braced and gathering light, the crystal thrumming at the staff's end. */
function charge(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  const flash = [0.25, 0.4, 0.55, 0.4];
  return flash.map((f, i) => {
    const p = base(view);
    p.staff = { ...cfg.release, float: i === 1 || i === 2 ? 1 : 0 };
    p.staffBehind = cfg.behindRelease;
    p.glow = 1;
    p.flash = f;
    p.breath = i === 1 || i === 2 ? 1 : 0;
    // The gathering magic stirs the robe and hat.
    p.hem = view === 'side' ? (i < 2 ? 1 : 0) : [0, 1, 0, -1][i];
    p.hat = i % 2 ? (view === 'side' ? -1 : 1) : 0;
    return p;
  });
}

/** Beam, part 3: firing. The staff kicks back against the beam's push. */
function fire(view: 'down' | 'up' | 'side'): Pose[] {
  const cfg = CAST_CFG[view];
  return [1, 0.8].map((f, i) => {
    const p = base(view);
    p.staff = { ...cfg.release };
    p.staffBehind = cfg.behindRelease;
    p.glow = 1;
    p.flash = f;
    p.hem = view === 'side' ? 1 : i ? 1 : -1;
    p.hat = view === 'side' ? -1 : 1;
    return p;
  });
}

// ---------------------------------------------------------------------------
// Frame generation

export type AnimName = 'idle' | 'walk' | 'cast' | 'aim' | 'charge' | 'beam';

export interface AnimDef {
  name: AnimName;
  fps: number;
  loop: boolean;
  poses: (view: 'down' | 'up' | 'side') => Pose[];
}

export const ANIMS: AnimDef[] = [
  { name: 'idle', fps: 8, loop: true, poses: idle },
  { name: 'walk', fps: 10, loop: true, poses: walk },
  { name: 'cast', fps: 15, loop: false, poses: cast },
  { name: 'aim', fps: 14, loop: false, poses: aim },
  { name: 'charge', fps: 10, loop: true, poses: charge },
  { name: 'beam', fps: 16, loop: true, poses: fire },
];

export interface WizardFrame {
  key: string; // e.g. "walk_left_3"
  anim: AnimName;
  dir: Dir;
  index: number;
  canvas: PixelCanvas;
  meta: FrameMeta;
}

export function drawWizardFrame(dir: Dir, pose: Pose, look: WizardLook = ARCANE_LOOK): { canvas: PixelCanvas; meta: FrameMeta } {
  S = look;
  const c = new PixelCanvas(FRAME_W, FRAME_H);
  let meta: FrameMeta;
  if (dir === 'down') meta = drawDown(c, pose);
  else if (dir === 'up') meta = drawUp(c, pose);
  else {
    meta = drawSide(c, pose);
    if (dir === 'right') {
      return { canvas: c.mirrored(), meta: { ...meta, tipX: FRAME_W - meta.tipX } };
    }
  }
  return { canvas: c, meta };
}

export function buildWizardFrames(look: WizardLook = ARCANE_LOOK): WizardFrame[] {
  const out: WizardFrame[] = [];
  for (const a of ANIMS) {
    for (const dir of DIRS) {
      const view = dir === 'left' || dir === 'right' ? 'side' : dir;
      a.poses(view).forEach((pose, index) => {
        const { canvas, meta } = drawWizardFrame(dir, pose, look);
        out.push({ key: `${a.name}_${dir}_${index}`, anim: a.name, dir, index, canvas, meta });
      });
    }
  }
  return out;
}
