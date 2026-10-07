// Colour helpers for Heaven Lands' wanderer: any colour picked in the
// creator becomes a lit material with a hand-made feel, shadows leaning cool
// and violet, lights leaning warm and golden, rather than plain darker and
// lighter copies of itself.

import { hex, type Material, type RGB } from '../../art/pixel';

function toHsl([r, g, b]: RGB): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const mx = Math.max(R, G, B);
  const mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Turn hue `h` toward `to` by `k` degrees at most (the short way round). */
function lean(h: number, to: number, k: number): number {
  let d = ((to - h + 540) % 360) - 180;
  if (Math.abs(d) > k) d = Math.sign(d) * k;
  return h + d;
}

/** A colour lighter (d > 0) or darker (d < 0) by about `d` in lightness, hue-shifted the painterly way. */
export function tone(c: RGB, d: number, cool = 250, warm = 48): RGB {
  const [h, s, l] = toHsl(c);
  if (d < 0) {
    const nl = l < 0.5 ? l * (1 + d * 2.1) : l + d * (0.6 + 0.4 * l);
    return fromHsl(s < 0.04 ? h : lean(h, cool, -d * 40), s + (s < 0.04 ? 0.04 : -d * 0.25), Math.max(0.03, nl));
  }
  const nl = l + d * Math.max(0.15, 1 - l) * 1.7;
  return fromHsl(s < 0.04 ? h : lean(h, warm, d * 30), s * (1 - d * 0.6), nl);
}

export interface MatOpts {
  shine?: boolean;
  emissive?: number;
  /** Shadows lean toward this hue (skin leans rosy, not violet). */
  cool?: number;
  /** How deep the shadow steps go (1 = usual). */
  depth?: number;
  noOutline?: boolean;
  noAO?: boolean;
  bias?: number;
  /** The outline's hue, when it shouldn't follow the shadows' (skin: a warm brown, not a red). */
  line?: number;
}

const cache = new Map<string, Material>();

/** A lit material whose fourth step (what a flat face shows) is `c`. */
export function mat(c: string, o: MatOpts = {}): Material {
  const key = `${c}|${o.shine ? 1 : 0}|${o.emissive ?? 0}|${o.cool ?? 250}|${o.depth ?? 1}|${o.noOutline ? 1 : 0}|${o.noAO ? 1 : 0}|${o.bias ?? 0}|${o.line ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = hex(c);
  const k = o.depth ?? 1;
  const cool = o.cool ?? 250;
  const ramp: RGB[] = [tone(base, -0.3 * k, cool), tone(base, -0.19 * k, cool), tone(base, -0.085 * k, cool), base, tone(base, 0.1)];
  const [h, s, l] = toHsl(base);
  const outline = o.line !== undefined ? fromHsl(o.line, Math.min(0.55, s), Math.max(0.08, Math.min(0.2, l * 0.28))) : fromHsl(lean(h, cool, 30), Math.min(1, s + 0.15), Math.max(0.06, Math.min(0.22, l * 0.3)));
  const m: Material = { ramp, outline, outlineLit: tone(outline, 0.05), shine: o.shine, emissive: o.emissive, noOutline: o.noOutline, noAO: o.noAO, bias: o.bias };
  cache.set(key, m);
  return m;
}

/** One colour whatever the light (eyes, mouths, buttons), never outlined against its neighbours. */
export function flat(c: string, emissive = 0): Material {
  const key = `flat|${c}|${emissive}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const v = hex(c);
  const m: Material = { ramp: [v, v, v, v, v], outline: tone(v, -0.4), noAO: true, emissive };
  cache.set(key, m);
  return m;
}

export const rgbHex = (c: RGB): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** `c` lighter or darker as a hex colour, for materials made from another's colour (a hair colour's brows). */
export const shade = (c: string, d: number): string => rgbHex(tone(hex(c), d));
