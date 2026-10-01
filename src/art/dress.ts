// A boss set worn on the hero's own sprite. With four or more pieces of one
// set on (DRESS_AT in game/gear.ts), the look's sheet is built again with
// the set's dressing: its armour tinted towards the set's metal, its trim
// remade in it and faintly alight, an enchanted rim along the top edges, and
// the set's own mark (the Emberborn's rising embers, the Wraithbound's fading
// feet, the Sporeveil's glowing spots, the Wyrmshard's crystals on the
// shoulders, the Starborn's starlit cloth).
//
// It works on the drawn frame, before it's lit, where every pixel still
// knows its material and its normal, so one pass dresses every hero and
// every skin, and the light falls on the new colours as on the old. Like
// heroSheets.ts, nothing here may touch the DOM: it runs in the sheet worker.

import type { SetId } from '../game/gear';
import { hex, type Material, type PixelCanvas, type RGB, type RenderedFrame, type Vec3 } from './pixel';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Fields of a look that hold its armour: tinted towards the set's metal. */
const ARMOUR = /^(plate|platedark|mail|helm|steel|metal|pad|shell|iron|armou?r|greaves?|pauldrons?|cuirass)$/;
/** Fields that hold its trim and fittings: remade in the set's metal. */
const TRIM = /^(trim|band|guard|tsuba|hilt|crest|emblem|boss|buckle|cuff|crown|circlet|rim|gold|gilt|brass|bronze|clasp)$/;
/** Fields the marks keep off: faces, hair, eyes. */
const BARE = /^(skin|face|lips?|eyes?|hair|beard|nose|mouth)$/;
/** Materials glowing at least this much (gems, lit blades) keep their own colours. */
const KEEP_GLOW = 0.35;

/** How much of the set's metal armour and trim take. */
const ARMOUR_MIX = 0.55;
const TRIM_MIX = 0.85;

interface Dress {
  /** The set's metal, dark to light. */
  metal: RGB[];
  /** Emissive on dressed trim; armour gets half. */
  glow: number;
  /** The enchantment along the top edges. */
  rim: RGB;
  rimA: number;
  /** The set's own detail, drawn on the frame before it's lit. */
  mark(f: Figure): void;
  /** And after, on the lit frame. */
  after?(f: Figure, r: RenderedFrame): void;
}

/** A frame being dressed: the canvas, where the figure is, and what's what. */
interface Figure {
  c: PixelCanvas;
  /** Frame index in the sheet: marks that should twinkle change with it. */
  i: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** The figure's middle column: marks hashed from it stay put as the figure bobs. */
  cx: number;
  /** Filled pixels with nothing above them. */
  tops: { x: number; y: number }[];
  /** Pixels the marks keep off. */
  bare(i: number): boolean;
  /** How dark a pixel's material is at heart (0..1). */
  dark(i: number): number;
}

const lum = (c: RGB): number => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;

const mix = (a: RGB, b: RGB, k: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * k),
  Math.round(a[1] + (b[1] - a[1]) * k),
  Math.round(a[2] + (b[2] - a[2]) * k),
];

/** The colour `t` (0..1) of the way along a ramp. */
function along(r: RGB[], t: number): RGB {
  const p = Math.max(0, Math.min(0.999, t)) * (r.length - 1);
  const k = Math.floor(p);
  return mix(r[k], r[Math.min(r.length - 1, k + 1)], p - k);
}

/** A colour in the set's metal at its own brightness. */
const toMetal = (c: RGB, d: Dress, k: number): RGB => mix(c, along(d.metal, lum(c)), k);

/** A steady 0..1 from a few whole numbers. */
function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Add light at a pixel (the emissive layer only), straight into the buffer. */
function glint(c: PixelCanvas, x: number, y: number, col: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const o = (y * c.w + x) * 4;
  c.light[o] = Math.min(255, c.light[o] + col[0] * a);
  c.light[o + 1] = Math.min(255, c.light[o + 1] + col[1] * a);
  c.light[o + 2] = Math.min(255, c.light[o + 2] + col[2] * a);
  c.light[o + 3] = 1;
}

const empty = (c: PixelCanvas, x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && c.mat[y * c.w + x] < 0;

// The marks.

const EMBER_HOT = hex('#ffe08a');
const EMBER = hex('#ff9a30');
const EMBER_RED = hex('#e8481a');

/** Embers lifting off the shoulders and head, a new few each frame; the feet's edge smoulders. */
function embers(f: Figure): void {
  const { c } = f;
  for (let k = 0; k < 3; k++) {
    if (hash(f.i, k, 1) > 0.65 || !f.tops.length) continue;
    const t = f.tops[Math.floor(hash(f.i, k, 2) * f.tops.length)];
    if (t.y > f.y0 + (f.y1 - f.y0) * 0.6) continue;
    const x = t.x + (hash(f.i, k, 3) < 0.5 ? -1 : 1) * Math.floor(hash(f.i, k, 4) * 2);
    const y = t.y - 2 - Math.floor(hash(f.i, k, 5) * 5);
    if (!empty(c, x, y)) continue;
    glint(c, x, y, EMBER_HOT, 0.95);
    if (empty(c, x, y + 1)) glint(c, x, y + 1, EMBER_RED, 0.45);
  }
  for (let x = f.x0; x <= f.x1; x++) {
    if (hash(x - f.cx, 7) > 0.4) continue;
    for (let y = f.y1; y >= f.y0; y--) {
      if (empty(c, x, y)) continue;
      glint(c, x, y, EMBER, 0.32);
      break;
    }
  }
}

const SOUL = hex('#bffff4');
const SOUL_DEEP = hex('#4ad8c8');
/** How much of the bottom rows stays, from the lowest up: the feet fade into the dark. */
const WRAITH_FADE = [0.4, 0.58, 0.76, 0.9];

/** A soul-light or two drifting at the hero's sides. */
function souls(f: Figure): void {
  const { c } = f;
  for (let k = 0; k < 2; k++) {
    if (hash(f.i, k, 21) > 0.5) continue;
    const side = hash(f.i, k, 22) < 0.5 ? f.x0 - 1 - Math.floor(hash(f.i, k, 23) * 3) : f.x1 + 1 + Math.floor(hash(f.i, k, 23) * 3);
    const y = f.y0 + Math.floor((f.y1 - f.y0) * (0.3 + hash(f.i, k, 24) * 0.6));
    if (!empty(c, side, y)) continue;
    glint(c, side, y, SOUL, 0.8);
    if (empty(c, side, y + 1)) glint(c, side, y + 1, SOUL_DEEP, 0.35);
  }
}

/** The lowest rows (the feet and the hem's outline under them) thin to a ghostly teal. */
function fadeFeet(f: Figure, r: RenderedFrame): void {
  const { w, h } = r;
  for (let x = 0; x < w; x++) {
    let low = -1;
    for (let y = h - 1; y >= 0; y--) {
      if (r.diffuse[(y * w + x) * 4 + 3] > 0) {
        low = y;
        break;
      }
    }
    if (low < 0 || low < f.y1 - 1) continue;
    for (let k = 0; k < WRAITH_FADE.length; k++) {
      const y = low - k;
      if (y < 0) break;
      const o = (y * w + x) * 4;
      if (r.diffuse[o + 3] === 0) continue;
      r.diffuse[o + 3] = Math.round(r.diffuse[o + 3] * WRAITH_FADE[k]);
      const a = (1 - WRAITH_FADE[k]) * 0.6;
      r.emissive[o] = Math.min(255, r.emissive[o] + SOUL_DEEP[0] * a);
      r.emissive[o + 1] = Math.min(255, r.emissive[o + 1] + SOUL_DEEP[1] * a);
      r.emissive[o + 2] = Math.min(255, r.emissive[o + 2] + SOUL_DEEP[2] * a);
      r.emissive[o + 3] = 255;
    }
  }
}

const SPORE_PINK = hex('#ff6ad8');
const SPORE_CYAN = hex('#5ae4ff');
const SPORE_PALE = hex('#ffd0f4');

/** Glowing spots on the cloth below the head, the Sporemother's, and a spore adrift. */
function spores(f: Figure): void {
  const { c } = f;
  const below = f.y0 + (f.y1 - f.y0) * 0.3;
  for (let y = Math.ceil(below); y <= f.y1; y++) {
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * c.w + x;
      if (c.mat[i] < 0 || f.bare(i)) continue;
      const h = hash(x - f.cx, y - f.y0, 31);
      if (h > 0.035) continue;
      glint(c, x, y, h < 0.018 ? SPORE_PINK : SPORE_CYAN, 0.75);
    }
  }
  if (hash(f.i, 0, 32) < 0.6) {
    const x = f.x0 - 2 + Math.floor(hash(f.i, 1, 32) * (f.x1 - f.x0 + 5));
    const y = f.y0 + Math.floor(hash(f.i, 2, 32) * (f.y1 - f.y0) * 0.8);
    if (empty(c, x, y)) glint(c, x, y, SPORE_PALE, 0.6);
  }
}

const CRYSTAL: Material = { ramp: ramp('#2a0e5a', '#5a2aa8', '#9a62f0', '#d2b4ff', '#f6eeff'), outline: hex('#12062a'), emissive: 0.45, shine: true, noAO: true };
const CRYSTAL_N: Vec3 = { x: -0.35, y: 0.62, z: 0.7 };
const CRYSTAL_N2: Vec3 = { x: 0.4, y: 0.5, z: 0.77 };
const GLINT = hex('#ffffff');

/** Amethyst grown from the shoulders and helm, the wyrm's spines, with a glint now and then. */
function crystals(f: Figure): void {
  const { c } = f;
  const span = f.y1 - f.y0;
  for (const t of f.tops) {
    if (t.y < f.y0 + span * 0.12 || t.y > f.y0 + span * 0.55) continue;
    const h = hash(t.x - f.cx, 41);
    if (h > 0.24 || !empty(c, t.x, t.y - 1)) continue;
    // Faces lit from the left and the right, as a cut stone's.
    const n = t.x < f.cx ? CRYSTAL_N : CRYSTAL_N2;
    c.part();
    c.px(t.x, t.y - 1, CRYSTAL, n);
    if (h < 0.1 && empty(c, t.x, t.y - 2)) c.px(t.x, t.y - 2, CRYSTAL, n, { bias: 1 });
  }
  if (hash(f.i, 0, 42) < 0.35 && f.tops.length) {
    const t = f.tops[Math.floor(hash(f.i, 1, 42) * f.tops.length)];
    glint(c, t.x, t.y, GLINT, 0.7);
  }
}

const STARS = [hex('#ffffff'), hex('#cfdcff'), hex('#ffe08a')];

/** Stars in the dark of the cloth, as in the Warden's own robe, and one twinkling nearby now and then. */
function starlight(f: Figure): void {
  const { c } = f;
  for (let y = f.y0; y <= f.y1; y++) {
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * c.w + x;
      if (c.mat[i] < 0 || f.bare(i) || f.dark(i) > 0.32) continue;
      const h = hash(x - f.cx, y - f.y0, 51);
      if (h > 0.07) continue;
      glint(c, x, y, STARS[Math.floor((h / 0.07) * STARS.length)], 0.85);
    }
  }
  if (hash(f.i, 0, 52) < 0.35) {
    const left = hash(f.i, 1, 52) < 0.5;
    const x = left ? f.x0 - 2 - Math.floor(hash(f.i, 2, 52) * 2) : f.x1 + 2 + Math.floor(hash(f.i, 2, 52) * 2);
    const y = f.y0 + 2 + Math.floor(hash(f.i, 3, 52) * (f.y1 - f.y0) * 0.5);
    if (empty(c, x, y)) {
      glint(c, x, y, STARS[0], 0.9);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (empty(c, x + dx, y + dy)) glint(c, x + dx, y + dy, STARS[1], 0.4);
    }
  }
}

const DRESSES: Record<SetId, Dress> = {
  // Burnished copper and gold, alight like the Elementinho.
  ember: { metal: ramp('#2e0c04', '#6e2208', '#b8500e', '#f08a28', '#ffd070', '#fff4c8'), glow: 0.24, rim: hex('#ff8a2a'), rimA: 0.42, mark: embers },
  // Ghost-silver gone teal: the Hollow Queen's pale light.
  wraith: { metal: ramp('#08201f', '#164a4c', '#2e8a86', '#62cec2', '#b0f4e8', '#effffb'), glow: 0.26, rim: hex('#6af4dc'), rimA: 0.45, mark: souls, after: fadeFeet },
  // Rose pearl, the Sporemother's bloom.
  spore: { metal: ramp('#2e0824', '#661a54', '#a83e8e', '#e472c4', '#ffb4e6', '#fff0fa'), glow: 0.2, rim: hex('#ff6ad8'), rimA: 0.34, mark: spores },
  // Amethyst, Amethrax's own.
  geode: { metal: ramp('#1a0832', '#3e1a78', '#7444c4', '#ac84f4', '#dcc8ff', '#faf4ff'), glow: 0.24, rim: hex('#b37aff'), rimA: 0.42, mark: crystals },
  // Starlit silver and blue, the Astral Warden's.
  astral: { metal: ramp('#0c1036', '#222e7a', '#4a64c4', '#8aa8f4', '#d4e0ff', '#ffffff'), glow: 0.22, rim: hex('#8aa0ff'), rimA: 0.4, mark: starlight },
};

/** What a look's materials are, by the names of the fields that hold them. */
interface LookParts {
  armour: Set<Material>;
  trim: Set<Material>;
  bare: Set<Material>;
}

const isMaterial = (v: unknown): v is Material => !!v && typeof v === 'object' && Array.isArray((v as Material).ramp) && Array.isArray((v as Material).outline);

function partsOf(look: object): LookParts {
  const p: LookParts = { armour: new Set(), trim: new Set(), bare: new Set() };
  const walk = (o: object, depth: number): void => {
    for (const [k, v] of Object.entries(o)) {
      const name = k.toLowerCase();
      if (isMaterial(v)) {
        if (BARE.test(name)) p.bare.add(v);
        else if ((v.emissive ?? 0) >= KEEP_GLOW) continue;
        else if (ARMOUR.test(name)) p.armour.add(v);
        else if (TRIM.test(name)) p.trim.add(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && depth < 3) walk(v, depth + 1);
    }
  };
  walk(look, 0);
  return p;
}

/** Bright, colourless and polished: steel or silver the look didn't name. */
function plainMetal(m: Material): boolean {
  if (!m.shine || (m.emissive ?? 0) >= KEEP_GLOW) return false;
  const top = m.ramp[m.ramp.length - 1];
  const mid = m.ramp[Math.floor(m.ramp.length / 2)];
  const hi = Math.max(...mid);
  const sat = hi ? (hi - Math.min(...mid)) / hi : 0;
  return sat < 0.18 && lum(top) > 0.75;
}

/**
 * Dresses a look's frames in a set, one at a time; one per sheet build, so
 * every frame shares its swapped materials.
 */
export function dresser(look: object, set: SetId): (c: PixelCanvas, index: number) => RenderedFrame {
  const d = DRESSES[set];
  const parts = partsOf(look);
  const swapped = new Map<Material, Material>();
  const made = new Map<Material, number>(); // dressed material -> its glow
  const swap = (m: Material): Material => {
    if (made.has(m)) return m;
    let out = swapped.get(m);
    if (!out) {
      const trim = parts.trim.has(m);
      const armour = !trim && (parts.armour.has(m) || plainMetal(m));
      if (!trim && !armour) out = m;
      else {
        const k = trim ? TRIM_MIX : ARMOUR_MIX;
        out = {
          ...m,
          ramp: m.ramp.map((c) => toMetal(c, d, k)),
          outline: toMetal(m.outline, d, k * 0.5),
          outlineLit: m.outlineLit && toMetal(m.outlineLit, d, k * 0.5),
          shine: true,
        };
        made.set(out, Math.max(m.emissive ?? 0, trim ? d.glow : d.glow * 0.5));
      }
      swapped.set(m, out);
    }
    return out;
  };
  const seen = new Set<PixelCanvas>();

  return (c, index) => {
    if (seen.has(c)) return c.render();
    seen.add(c);
    c.offset(0, 0);
    c.remap(swap);
    const n = c.w * c.h;
    let x0 = c.w;
    let x1 = -1;
    let y0 = c.h;
    let y1 = -1;
    for (let i = 0; i < n; i++) {
      const m = c.materialOf(i);
      if (!m) continue;
      const g = made.get(m);
      if (g !== undefined && c.glow[i] < g) c.glow[i] = g;
      const x = i % c.w;
      const y = (i - x) / c.w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 < 0) return c.render();

    const tops: { x: number; y: number }[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (c.mat[y * c.w + x] < 0) continue;
        if (y === 0 || empty(c, x, y - 1)) tops.push({ x, y });
      }
    }
    const bareOf = (m: Material | null) => !!m && parts.bare.has(m);
    const f: Figure = {
      c,
      i: index,
      x0,
      x1,
      y0,
      y1,
      cx: Math.round((x0 + x1) / 2),
      tops,
      bare: (i) => bareOf(c.materialOf(i)),
      dark: (i) => {
        const m = c.materialOf(i);
        return m ? lum(m.ramp[Math.floor(m.ramp.length / 2)]) : 1;
      },
    };

    // The enchantment's rim: on every top edge, and more faintly down the
    // sides of the upper body, so the hero reads as lit from within the gear.
    for (const t of tops) glint(c, t.x, t.y, d.rim, d.rimA);
    const sides = y0 + (y1 - y0) * 0.6;
    for (let y = y0; y <= sides; y++) {
      for (let x = x0; x <= x1; x++) {
        // Top edges have theirs already.
        if (c.mat[y * c.w + x] < 0 || empty(c, x, y - 1) || !(empty(c, x - 1, y) || empty(c, x + 1, y))) continue;
        glint(c, x, y, d.rim, d.rimA * 0.45);
      }
    }

    d.mark(f);
    const r = c.render();
    d.after?.(f, r);
    return r;
  };
}

/** A dressed sheet's key: the look's, then the set's (`wizard_void.ember`). */
export const dressedKey = (look: string, set: SetId): string => `${look}.${set}`;

/** The look and set of a dressed sheet's key (or one of its layers' keys), if it is one. */
export function undress(key: string): { look: string; set: SetId; layer: string } | null {
  const m = /^(\w+)\.([a-z]+)(_[esw])?$/.exec(key);
  if (!m || !(m[2] in DRESSES)) return null;
  return { look: m[1], set: m[2] as SetId, layer: m[3] ?? '' };
}
