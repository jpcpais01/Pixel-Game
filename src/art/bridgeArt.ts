// A bridge, painted from its shape (see world/bridge.ts): a deck of planks
// laid across the way, lifted over the water and drawn as high as it stands,
// so its ramps fore-shorten and stretch as a north-south bridge climbs and
// comes down, and an east-west one shows its side: the planks' ends, the
// beam under them and the posts that carry it down into the water. The deck
// is lit by its slope as a roof is (a ramp rising toward the sun catches it,
// one falling away is in shade, both in the colours and in the normal map the
// lights use), worn pale along the middle of the walk, nailed at the kerbs,
// with moss in the corners. Handrails run along the railed sides on posts,
// rising and falling with the deck, tall newel posts at the ends; and the
// deck lays a soft shadow on the water beside it.
//
// The rails are painted apart from the deck, a layer to each side, so the
// world can stand them in pieces that the heroes pass behind and in front of.

import { bayer } from './bitmap';
import { hash2, valueNoise } from './env';
import { ramp } from './ground';
import { KEY_LIGHT, type RGB } from './pixel';
import { CELL } from '../world/homeLayout';
import { Bridges, DECK_H, type Span } from '../world/bridge';

/** Weathered oak for the deck and rails, the darker beam under them, and the moss in their corners. */
const WOOD = ramp('#24160d', '#342114', '#462d1b', '#5a3a23', '#6f4a2d', '#865c38', '#9c6f45', '#b38556', '#c99c6a', '#dcb586');
const BEAM = ramp('#0f0906', '#1a100a', '#26180f', '#342016', '#432a1c', '#553624', '#69442d');
const MOSS = ramp('#16301a', '#20421f', '#2d5826', '#3d6e2e', '#548a3a');
/** The deck's shadow on the water or the bank, and the ripples round its posts. */
const SHADOW: RGB = [6, 12, 20];
const SHADOW_A = 0.4;
const RIPPLE: RGB = [196, 232, 226];

/** How high the handrail stands over the deck, and how far apart its posts are. */
export const RAIL_H = 8;
const POST_EVERY = 8;
/** The kerb board along a railed side, px. */
const KERB = 2;
/** Plank width (with its seam), px. */
const PLANK = 4;
/** How steeply the ramps tilt their light. */
const TILT = 1.6;

export interface Layer {
  diffuse: Uint8ClampedArray<ArrayBuffer>;
  normal: Uint8ClampedArray<ArrayBuffer>;
}

/** A piece of rail to stand on its own: its box in the picture, and how deep it sorts (grid y of its foot). */
export interface RailPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

/** A bridge's pictures: its box on the grid, the deck (with its side and shadow), and each railed side's layer and pieces. */
export interface BridgeArt {
  x: number;
  y: number;
  w: number;
  h: number;
  deck: Layer;
  rails: { layer: Layer; pieces: RailPiece[] }[];
}

const L = KEY_LIGHT;
const LL = Math.hypot(L.x, L.y, L.z);
const FLAT = L.z / LL;

/** Normals the rails and the side use: up, facing south, and a post's two lit sides. */
type N = [number, number, number];
const UP: N = [0, 0, 1];
const SOUTH: N = [0, -0.8, 0.6];
const POST_W: N = [-0.55, -0.55, 0.62];
const POST_E: N = [0.55, -0.55, 0.62];
const RAIL_TOP: N = [0, 0.35, 0.94];

export function paintBridge(b: Bridges, s: Span): BridgeArt {
  const X0 = s.x0 * CELL - 4;
  const Y0 = s.y0 * CELL - DECK_H - RAIL_H - 6;
  const W = (s.x1 + 1) * CELL + 10 - X0;
  const H = (s.y1 + 1) * CELL + 6 - Y0;
  const layer = (): Layer => ({ diffuse: new Uint8ClampedArray(W * H * 4), normal: new Uint8ClampedArray(W * H * 4) });
  const deck = layer();
  const has = (cx: number, cy: number) => b.inSpan(s, cx, cy);
  const height = (cx: number, cy: number, x: number, y: number) => b.height(s, cx, cy, x, y);

  /** Set a pixel (grid coordinates) of a layer: colour, opacity, normal. */
  const put = (l: Layer, gx: number, gy: number, c: RGB, n: N, a = 255) => {
    const x = gx - X0;
    const y = gy - Y0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    l.diffuse[o] = c[0];
    l.diffuse[o + 1] = c[1];
    l.diffuse[o + 2] = c[2];
    l.diffuse[o + 3] = a;
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    l.normal[o] = Math.round((n[0] / nl) * 127.5 + 127.5);
    l.normal[o + 1] = Math.round((n[1] / nl) * 127.5 + 127.5);
    l.normal[o + 2] = Math.round((n[2] / nl) * 127.5 + 127.5);
    l.normal[o + 3] = 255;
  };
  /** A shade of a ramp: `t` its place on it, lit by normal `n`, dithered. */
  const tone = (r: RGB[], t: number, n: N, gx: number, gy: number): RGB => {
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    const lit = ((n[0] * L.x + n[1] * L.y + n[2] * L.z) / nl / LL - FLAT) * 3;
    return r[Math.max(0, Math.min(r.length - 1, Math.floor(t + lit + bayer(gx, gy) * 0.7 + 0.15)))];
  };
  const shadowAt = (gx: number, gy: number) => {
    const x = gx - X0;
    const y = gy - Y0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    if (deck.diffuse[o + 3] > 0) return;
    put(deck, gx, gy, SHADOW, UP, Math.round(SHADOW_A * 255));
  };

  // How far a point is from each railed side of its cell (Infinity where the bridge goes on), and from the walk's middle.
  const sides = (cx: number, cy: number, x: number, y: number) => {
    const lx = x - cx * CELL;
    const ly = y - cy * CELL;
    if (s.ns) return { a: has(cx - 1, cy) ? Infinity : lx, b: has(cx + 1, cy) ? Infinity : CELL - 1 - lx };
    return { a: has(cx, cy - 1) ? Infinity : ly, b: has(cx, cy + 1) ? Infinity : CELL - 1 - ly };
  };
  // The middle of the walk, across the way: the box's middle on the cross axis.
  const mid = s.ns ? ((s.x0 + s.x1 + 1) * CELL) / 2 : ((s.y0 + s.y1 + 1) * CELL) / 2;

  // ---- The shadow first, on the ground beside and below: the deck covers the rest of it.
  for (const c of s.cells) {
    for (let y = c.y * CELL; y < (c.y + 1) * CELL; y++) {
      for (let x = c.x * CELL; x < (c.x + 1) * CELL; x++) {
        const h = height(c.x, c.y, x, y);
        if (h < 0.5) continue;
        shadowAt(x + Math.round(h * 0.75) + 1, y + Math.round(h * 0.45));
      }
    }
  }

  // ---- The deck, north to south so the nearer planks lie over the farther, and its south side.
  for (const c of s.cells) {
    for (let x = c.x * CELL; x < (c.x + 1) * CELL; x++) {
      for (let y = c.y * CELL; y < (c.y + 1) * CELL; y++) {
        const h = height(c.x, c.y, x, y);
        const { u, len } = b.along(s, c.x, c.y, x, y);
        const p = s.ns ? x : y;
        const board = Math.floor((s.ns ? y : x) / PLANK);
        const f = (s.ns ? y : x) - board * PLANK;
        const side = sides(c.x, c.y, x, y);
        const edge = Math.min(side.a, side.b);
        // The slope along the run tilts the light: up toward the sun bright, away from it dim.
        const slope = (b.height(s, c.x, c.y, x + (s.ns ? 0 : 1), y + (s.ns ? 1 : 0)) - b.height(s, c.x, c.y, x - (s.ns ? 0 : 1), y - (s.ns ? 1 : 0))) / 2;
        let n: N = s.ns ? [0, slope * TILT, 1] : [-slope * TILT, 0, 1];
        let r = WOOD;
        let t: number;
        if (edge < KERB) {
          // The kerb board, a step up from the planks, its outer edge darker.
          t = 4.4 + (hash2(Math.floor(u / 12), p, 821) - 0.5) * 0.6 - (edge === 0 ? 1.4 : 0);
          if (edge === KERB - 1) n = s.ns ? [side.a < side.b ? 0.5 : -0.5, n[1], 1] : [n[0], side.a < side.b ? -0.5 : 0.5, 1];
        } else {
          t = 4.1 + (hash2(board, Math.floor(p / CELL), 811) - 0.5) * 1.5;
          // The seam between planks; a plank's grain along its length.
          if (f === PLANK - 1) t -= 2.3;
          t += (valueNoise(p, board * 7, 3, 813) - 0.5) * 0.9 + (hash2(x, y, 817) > 0.94 ? -0.7 : 0);
          // Worn pale where feet go, down the middle of the walk.
          t += 0.55 * Math.max(0, 1 - Math.abs(p + 0.5 - mid) / 6);
          // Nails where the planks cross the stringers, just inside each kerb.
          if (edge === KERB + 1 && f === 1) t += 1.5;
          // The rail's shadow, falling toward the south-east across the planks.
          if (side.a !== Infinity && side.a - KERB < 2) t -= 0.9;
          // Moss creeping in from the kerbs, and a little where the deck meets the bank.
          const mossy = valueNoise(x, y, 5, 819);
          if ((edge < KERB + 3 && mossy > 0.74 && hash2(x, y, 823) > 0.4) || ((u < 3 || u > len - 4) && hash2(x, y, 825) > 0.8)) {
            r = MOSS;
            t = 2.2 + mossy * 1.6;
          }
        }
        const col = tone(r, t, n, x, y);
        const sy = y - Math.round(h);
        // Down to where the next row south is drawn: a ramp coming down stretches toward the viewer.
        const below = y + 1 < (c.y + 1) * CELL || has(c.x, c.y + 1);
        const next = below ? y + 1 - Math.round(height(c.x, y + 1 < (c.y + 1) * CELL ? c.y : c.y + 1, x, y + 1)) : sy + 1;
        for (let k = sy; k < Math.max(sy + 1, next); k++) put(deck, x, k, col, n);
        if (!below) side_(x, y, sy, u, len, h);
      }
    }
  }

  /** The south side under the last row of planks: their ends, the beam, and the dark under it with the posts going down. */
  function side_(x: number, y: number, sy: number, u: number, len: number, h: number): void {
    const ground = y + 1;
    const board = Math.floor(x / PLANK);
    const f = x - board * PLANK;
    for (let k = sy + 1; k <= ground; k++) {
      const d = k - sy - 1;
      let c: RGB;
      if (d === 0) c = tone(WOOD, f === PLANK - 1 ? 2.6 : 5.2 + (hash2(board, 3, 831) - 0.5), SOUTH, x, k);
      else if (d < 4) c = tone(BEAM, 5 - d * 0.9, SOUTH, x, k);
      else c = tone(BEAM, 0.6, SOUTH, x, k);
      put(deck, x, k, c, SOUTH);
    }
    // Posts down into the water at every cell's seam along the high part, the light catching their west side.
    const at = ((u % CELL) + CELL) % CELL;
    if (h > DECK_H * 0.5 && u > 1 && u < len - 2 && (at === 0 || at === CELL - 1)) {
      const west = at === CELL - 1;
      for (let k = sy + 4; k <= ground + 1; k++) put(deck, x, k, tone(BEAM, west ? 4.6 : 2.6, west ? POST_W : POST_E, x, k), west ? POST_W : POST_E);
      put(deck, x + (west ? -1 : 1), ground + 2, RIPPLE, UP, 110);
    }
  }

  // ---- The rails, a layer to each side that has them.
  const rails: { layer: Layer; pieces: RailPiece[] }[] = [];
  const sidesOf: ('n' | 's' | 'w' | 'e')[] = s.ns ? ['w', 'e'] : ['n', 's'];
  for (const which of sidesOf) {
    const l = layer();
    const pieces: RailPiece[] = [];
    for (const c of s.cells) {
      const open = which === 'n' ? !has(c.x, c.y - 1) : which === 's' ? !has(c.x, c.y + 1) : which === 'w' ? !has(c.x - 1, c.y) : !has(c.x + 1, c.y);
      if (!open) continue;
      if (s.ns) pieces.push(railNS(l, c.x, c.y, which === 'w'));
      else pieces.push(railEW(l, c.x, c.y, which === 'n'));
    }
    if (pieces.length) rails.push({ layer: l, pieces });
  }

  /** One cell's length of an east-west bridge's rail, on its north or south kerb. */
  function railEW(l: Layer, cx: number, cy: number, north: boolean): RailPiece {
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
      const gy = north ? cy * CELL : (cy + 1) * CELL - 1;
      const h = Math.round(height(cx, cy, x, gy));
      const foot = north ? cy * CELL - h + 1 : (cy + 1) * CELL - 2 - h;
      const { u, len } = b.along(s, cx, cy, x, gy);
      lo = Math.min(lo, foot);
      hi = Math.max(hi, foot);
      const newel = u < 2 || u >= len - 2;
      const post = newel || (u - 1) % POST_EVERY < 2;
      const top = foot - RAIL_H - (newel ? 2 : 0);
      if (post) {
        const west = newel ? u % 2 === 0 : (u - 1) % POST_EVERY === 0;
        for (let k = top + 1; k <= foot; k++) put(l, x, k, tone(WOOD, west ? 5 : 2.8, west ? POST_W : POST_E, x, k), west ? POST_W : POST_E);
        // A newel's cap, pale on top.
        if (newel) put(l, x, top, tone(WOOD, 7, RAIL_TOP, x, top), RAIL_TOP);
      }
      // The handrail over the posts, and a thinner one halfway down; neither past the newels.
      if (u >= 1 && u < len - 1) {
        const rt = foot - RAIL_H;
        put(l, x, rt, tone(WOOD, 6.4, RAIL_TOP, x, rt), RAIL_TOP);
        put(l, x, rt + 1, tone(WOOD, 3.4, SOUTH, x, rt + 1), SOUTH);
        if (!post) put(l, x, foot - Math.round(RAIL_H * 0.45), tone(WOOD, 3.8, SOUTH, x, foot), SOUTH);
      }
    }
    // It sorts by its foot: the north rail behind whoever walks the deck, the south one in front.
    return box(cx * CELL, lo - RAIL_H - 3, CELL, hi - lo + RAIL_H + 5, north ? lo - 1 : hi + 1);
  }

  /** One cell's length of a north-south bridge's rail, on its west or east kerb: from above, a line down the side with the posts' caps along it. */
  function railNS(l: Layer, cx: number, cy: number, west: boolean): RailPiece {
    const x = west ? cx * CELL : (cx + 1) * CELL - 2;
    let prev = NaN;
    let first = NaN;
    let last = NaN;
    for (let y = cy * CELL; y < (cy + 1) * CELL; y++) {
      const h = Math.round(height(cx, cy, x, y));
      const { u, len } = b.along(s, cx, cy, x, y);
      const foot = y - h;
      const newel = u < 2 || u >= len - 2;
      const rt = foot - RAIL_H - (newel ? 2 : 0);
      if (Number.isNaN(first)) first = rt;
      last = foot;
      // The rail's top, a light stripe and its shaded east edge, closing any gap the ramp's stretch leaves.
      const from = Number.isNaN(prev) ? rt : Math.min(rt, prev + 1);
      for (let k = from; k <= rt; k++) {
        put(l, x, k, tone(WOOD, 6.2, RAIL_TOP, x, k), RAIL_TOP);
        put(l, x + 1, k, tone(WOOD, 3.6, POST_E, x + 1, k), POST_E);
      }
      prev = rt;
      // Each post's cap juts out a little, so the posts read along the line.
      if (u % POST_EVERY === 1 || u === 0 || u === len - 1) {
        put(l, x - 1, rt, tone(WOOD, 4.8, POST_W, x - 1, rt), POST_W);
        put(l, x + 2, rt, tone(WOOD, 2.4, POST_E, x + 2, rt), POST_E);
      }
      // At the south end the newel post stands whole, its face toward the viewer.
      if (u >= len - 2 && !has(cx, cy + 1)) {
        for (let k = rt + 1; k <= foot; k++) {
          put(l, x, k, tone(WOOD, 4.6, POST_W, x, k), POST_W);
          put(l, x + 1, k, tone(WOOD, 2.6, POST_E, x + 1, k), POST_E);
        }
      }
    }
    const bottom = has(cx, cy + 1) ? last - RAIL_H : last + 1;
    return box(x - 1, first - 1, 4, Math.max(1, bottom - first + 2), last);
  }

  /** A piece's box in the picture (clipped to it), from grid coordinates. */
  function box(gx: number, gy: number, w: number, h: number, depth: number): RailPiece {
    const x = Math.max(0, gx - X0);
    const y = Math.max(0, gy - Y0);
    return { x, y, w: Math.max(1, Math.min(W, gx - X0 + w) - x), h: Math.max(1, Math.min(H, gy - Y0 + h) - y), depth };
  }

  return { x: X0, y: Y0, w: W, h: H, deck, rails };
}

/** The bridge's picture for the build palette: a short one, deck and rails together, `w` x `h`. */
export function bridgeIcon(): { w: number; h: number; px: Uint8ClampedArray<ArrayBuffer> } {
  const b = new Bridges([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]);
  const art = paintBridge(b, b.spans[0]);
  const out = art.deck.diffuse.slice();
  // The shadow is for the water, not the button.
  for (let i = 0; i < out.length; i += 4) if (out[i + 3] < 255) out[i + 3] = 0;
  for (const r of art.rails) {
    const d = r.layer.diffuse;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) out.set(d.subarray(i, i + 4), i);
  }
  return { w: art.w, h: art.h, px: out };
}
