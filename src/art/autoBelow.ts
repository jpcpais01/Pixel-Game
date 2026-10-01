// Auto Battle's backdrop: the world far below, seen straight down from the
// Floating Island the arena hangs off. A patchwork of the lowlands (meadows,
// hedged fields round villages, woods of round crowns, a river winding to a
// coast, roads with bridges) painted small and hazed by the height, with thin
// veils of high cloud. The puffs of cloud that drift between the board and the
// land (and their shadows on it) are separate (`paintCloud`), so they can move.

import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';

const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function noise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x: number, y: number, s = 0): number => noise(x, y, s) * 0.55 + noise(x * 2.1, y * 2.1, s + 7) * 0.3 + noise(x * 4.3, y * 4.3, s + 13) * 0.15;

function ramp(cols: RGB[], t: number, x: number, y: number): RGB {
  const f = clamp01(t) * (cols.length - 1);
  const i = Math.floor(f);
  if (i >= cols.length - 1) return cols[cols.length - 1];
  return f - i > bayer(x, y) ? cols[i + 1] : cols[i];
}

const pal = (list: string[]): RGB[] => list.map(hex);

const MEADOW = pal(['#2c4630', '#36553a', '#426440', '#517446', '#62844c', '#78964f']);
const WOOD = pal(['#142a22', '#1c3628', '#25442e', '#305436', '#3e6640', '#52784a']);
const SEA = pal(['#16284e', '#1c3460', '#244272', '#2e5484', '#3a6896', '#5288aa']);
const RIVER = pal(['#2a4c78', '#36628c', '#4a7ea2']);
const SAND = hex('#c8b488');
const FOAM = hex('#dce8ee');
const ROAD = hex('#b49a72');
const ROAD_DARK = hex('#8a7558');
const HEDGE = hex('#22402c');
/** Field crops: ripe wheat, young green, ploughed earth, flax in flower, pale barley. */
const CROPS: { a: RGB; b: RGB; rows: boolean }[] = [
  { a: hex('#c8a24e'), b: hex('#b08a40'), rows: false },
  { a: hex('#6e9a48'), b: hex('#5c8640'), rows: true },
  { a: hex('#7c5c3e'), b: hex('#664a32'), rows: true },
  { a: hex('#d8c27a'), b: hex('#c4ac66'), rows: true },
];
const ROOFS = pal(['#b4583c', '#c86e48', '#9a4a36', '#5e6280', '#7a5a4a']);
/** The air between: warm where the low sun is (top right), cool away from it, and the deep at the page's edges. */
const HAZE_WARM = hex('#d8a8a0');
const HAZE_COOL = hex('#7c88c0');
const DEEP = hex('#1a1838');
const VEIL = hex('#ece6f4');

/** How much of the air's colour lies over the land, and how dark the page's edges go. */
const HAZE = 0.3;
const EDGE = 0.5;

enum K {
  Land,
  Wood,
  Field,
  Sea,
  Sand,
  River,
  Bank,
  Road,
  Bridge,
  Roof,
  Shade,
}

type Pt = { x: number; y: number };

/** A winding line from a to b: a straight run bent side to side by noise, `n` points. */
function meander(a: Pt, b: Pt, bend: number, seed: number, n = 160): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Pinned at both ends, free to wander in between.
    const swing = (fbm(t * 3.2, seed, seed + 3) - 0.5) * 2 * bend * Math.sin(t * Math.PI);
    out.push({ x: a.x + dx * t + nx * swing, y: a.y + dy * t + ny * swing });
  }
  return out;
}

export function paintBelow(w: number, h: number): Bitmap {
  const b = new Bitmap(w, h);
  const kind = new Uint8Array(w * h);
  const tone = new Float32Array(w * h);
  const at = (x: number, y: number) => y * w + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const scale = Math.min(w, h);

  // The coast: the sea takes the bottom-left corner, its edge broken by noise.
  const seaField = (x: number, y: number) => (x / w) * 0.95 + (1 - y / h) * 0.95 + (fbm(x / 40, y / 40, 31) - 0.5) * 0.45;
  const SHORE = 0.42;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = seaField(x, y);
      if (s < SHORE) {
        kind[at(x, y)] = K.Sea;
        tone[at(x, y)] = clamp01((s - (SHORE - 0.28)) / 0.28);
      } else if (s < SHORE + 0.018) kind[at(x, y)] = K.Sand;
    }

  // Woods: big patches where one noise runs high.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (kind[at(x, y)] !== K.Land) continue;
      if (fbm(x / 48, y / 48, 60) > 0.57) kind[at(x, y)] = K.Wood;
    }

  // Villages: a few spots on land, apart, each with its fields round it.
  const villages: Pt[] = [];
  for (let i = 0; villages.length < 5 && i < 200; i++) {
    const p = { x: Math.round((0.06 + hash(i, 1, 70) * 0.88) * w), y: Math.round((0.06 + hash(i, 2, 70) * 0.88) * h) };
    if (seaField(p.x, p.y) < SHORE + 0.1) continue;
    if (villages.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < scale * 0.3)) continue;
    villages.push(p);
  }
  villages.forEach((v, vi) => {
    const reach = scale * (0.1 + hash(vi, 3, 71) * 0.06);
    const ang = hash(vi, 4, 71) * Math.PI;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let y = Math.floor(v.y - reach); y <= v.y + reach; y++)
      for (let x = Math.floor(v.x - reach); x <= v.x + reach; x++) {
        if (!inside(x, y)) continue;
        const k = kind[at(x, y)];
        if (k === K.Sea || k === K.Sand) continue;
        const d = Math.hypot(x - v.x, y - v.y) / reach;
        if (d + (fbm(x / 14, y / 14, 72 + vi) - 0.5) * 0.6 > 1) continue;
        // Plots on a grid turned to the village's own angle, each its own crop.
        const u = (x - v.x) * ca + (y - v.y) * sa;
        const q = -(x - v.x) * sa + (y - v.y) * ca;
        const pw = 9 + Math.floor(hash(vi, 5, 71) * 5);
        const ph = 6 + Math.floor(hash(vi, 6, 71) * 4);
        const cu = Math.floor(u / pw);
        const cq = Math.floor(q / ph);
        const crop = Math.floor(hash(cu, cq, 73 + vi) * (CROPS.length + 3));
        // The odd plot is left as pasture.
        if (crop >= CROPS.length) continue;
        kind[at(x, y)] = K.Field;
        const edge = u - cu * pw < 1 || q - cq * ph < 1;
        tone[at(x, y)] = edge ? -1 : crop + (CROPS[crop].rows && Math.floor(u) % 2 === 0 ? 0.5 : 0);
      }
  });

  // The river: from the top edge to the sea, with a stream joining it.
  const stamp = (path: Pt[], r: number, k: K, bank: boolean) => {
    for (const p of path) {
      const rr = Math.ceil(r + 1);
      for (let y = Math.floor(p.y - rr); y <= p.y + rr; y++)
        for (let x = Math.floor(p.x - rr); x <= p.x + rr; x++) {
          if (!inside(x, y)) continue;
          const d = Math.hypot(x - p.x, y - p.y);
          const i = at(x, y);
          if (kind[i] === K.Sea) continue;
          if (d <= r) kind[i] = k;
          else if (bank && d <= r + 1 && kind[i] !== k && kind[i] !== K.River) kind[i] = K.Bank;
        }
    }
  };
  const mouth = (() => {
    // Where the sea's edge crosses the page's middle diagonal.
    for (let t = 0.5; t > 0; t -= 0.01) {
      const x = Math.round(w * t);
      const y = Math.round(h * (1 - t));
      if (seaField(x, y) < SHORE) return { x: x + 4, y: y - 4 };
    }
    return { x: 0, y: h };
  })();
  const source = { x: w * (0.62 + hash(1, 1, 80) * 0.2), y: -4 };
  const river = meander(source, mouth, scale * 0.22, 81, 260);
  stamp(river, 1.6, K.River, true);
  const fork = river[Math.floor(river.length * 0.45)];
  const stream = meander({ x: w + 4, y: h * (0.3 + hash(2, 2, 80) * 0.3) }, fork, scale * 0.1, 82, 180);
  stamp(stream, 0.7, K.River, true);

  // Roads: village to village, crossing the river on bridges.
  const roads: Pt[][] = [];
  const order = [...villages].sort((a, c) => a.x + a.y - (c.x + c.y));
  for (let i = 1; i < order.length; i++) roads.push(meander(order[i - 1], order[i], scale * 0.08, 90 + i, 200));
  if (villages.length) roads.push(meander(order[order.length - 1], { x: w + 4, y: order[order.length - 1].y * 0.6 }, scale * 0.06, 99, 120));
  for (const road of roads)
    for (const p of road) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (!inside(x, y)) continue;
      const k = kind[at(x, y)];
      if (k === K.Sea) continue;
      kind[at(x, y)] = k === K.River || k === K.Bridge ? K.Bridge : K.Road;
    }

  // Houses: a cluster along each village's road, small roofs lit on the sun's side with a shadow cast away.
  villages.forEach((v, vi) => {
    const n = 7 + Math.floor(hash(vi, 7, 74) * 8);
    for (let j = 0; j < n * 4 && j < 80; j++) {
      const a = hash(vi, j, 75) * Math.PI * 2;
      const d = Math.sqrt(hash(vi, j, 76)) * scale * 0.06;
      const hx = Math.round(v.x + Math.cos(a) * d);
      const hy = Math.round(v.y + Math.sin(a) * d * 0.8);
      const hw = 2 + Math.floor(hash(vi, j, 77) * 2);
      const hh = 2;
      let ok = true;
      for (let y = hy - 1; y <= hy + hh && ok; y++)
        for (let x = hx - 1; x <= hx + hw && ok; x++) if (!inside(x, y) || [K.Sea, K.River, K.Road, K.Bridge, K.Roof, K.Sand].includes(kind[at(x, y)])) ok = false;
      if (!ok) continue;
      const roof = Math.floor(hash(vi, j, 78) * ROOFS.length);
      for (let y = hy; y < hy + hh; y++)
        for (let x = hx; x < hx + hw; x++) {
          kind[at(x, y)] = K.Roof;
          tone[at(x, y)] = roof + (y === hy ? 0.5 : 0);
        }
      // The low sun is up and to the right: shadows fall down-left.
      for (let x = hx - 1; x < hx + hw - 1; x++) if (inside(x, hy + hh) && kind[at(x, hy + hh)] < K.Sea) kind[at(x, hy + hh)] = K.Shade;
      if (inside(hx - 1, hy + 1) && kind[at(hx - 1, hy + 1)] < K.Sea) kind[at(hx - 1, hy + 1)] = K.Shade;
    }
  });

  // Crowns for the woods (and lone trees in the meadows): a jittered grid, each crown lit on its sun side.
  const CROWN = 5;
  const crown = (x: number, y: number) => {
    const gx = Math.floor(x / CROWN);
    const gy = Math.floor(y / CROWN);
    let best = 9;
    let bx = 0;
    let by = 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const cx = (gx + ox + 0.2 + hash(gx + ox, gy + oy, 61) * 0.6) * CROWN;
        const cy = (gy + oy + 0.2 + hash(gx + ox, gy + oy, 62) * 0.6) * CROWN;
        const d = Math.hypot(x - cx, y - cy);
        if (d < best) {
          best = d;
          bx = x - cx;
          by = y - cy;
        }
      }
    return { d: best, bx, by };
  };

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      let c: RGB;
      switch (kind[i] as K) {
        case K.Sea: {
          const t = tone[i];
          c = ramp(SEA, t * 0.85 + (fbm(x / 9, y / 5, 33) - 0.5) * 0.25, x, y);
          // Glints of the sun, and the surf's white line at the shore.
          if (t > 0.6 && hash(x, y, 34) > 0.997) c = mix(c, FOAM, 0.5);
          if (t > 0.93 && (x + y) % 3 !== 0) c = mix(c, FOAM, 0.7);
          break;
        }
        case K.Sand:
          c = mix(SAND, MEADOW[3], hash(x, y, 35) * 0.25);
          break;
        case K.River:
          c = ramp(RIVER, 0.4 + (fbm(x / 6, y / 6, 36) - 0.5) * 0.9, x, y);
          break;
        case K.Bank:
          c = MEADOW[1];
          break;
        case K.Road:
          c = hash(x, y, 37) > 0.8 ? ROAD_DARK : ROAD;
          break;
        case K.Bridge:
          c = hex('#8a6a4a');
          break;
        case K.Roof: {
          const r = ROOFS[Math.floor(tone[i])];
          c = tone[i] % 1 ? mix(r, hex('#ffe8c8'), 0.3) : r;
          break;
        }
        case K.Shade:
          c = mix(MEADOW[0], DEEP, 0.3);
          break;
        case K.Field: {
          if (tone[i] < 0) {
            c = HEDGE;
            break;
          }
          const crop = CROPS[Math.floor(tone[i])];
          c = mix(tone[i] % 1 ? crop.b : crop.a, MEADOW[3], 0.22);
          if (hash(x, y, 38) > 0.9) c = mix(c, crop.b, 0.5);
          break;
        }
        case K.Wood: {
          const cr = crown(x, y);
          // Between crowns, the shade of the wood floor; on one, lit up and right.
          const lit = clamp01(0.8 - cr.d / 3.2 + (cr.bx - cr.by) * 0.12 + (fbm(x / 20, y / 20, 63) - 0.5) * 0.5);
          c = cr.d > 2.9 ? WOOD[0] : ramp(WOOD, lit, x, y);
          break;
        }
        default: {
          // Meadow, rolling in broad swells, with a lone tree now and then.
          const g = fbm(x / 70, y / 70, 64) * 0.7 + fbm(x / 12, y / 12, 65) * 0.3;
          c = ramp(MEADOW, g * 0.95 + 0.05, x, y);
          if (hash(Math.floor(x / 5), Math.floor(y / 5), 66) > 0.93) {
            const cr = crown(x, y);
            if (cr.d < 1.4) c = cr.bx - cr.by > 0 ? WOOD[4] : WOOD[2];
            else if (cr.d < 2.2 && cr.bx < 0 && cr.by > 0) c = mix(c, DEEP, 0.3);
          }
        }
      }
      // The height: the air's own colour over everything, and veils of high cloud.
      const u = x / w;
      const v = y / h;
      c = mix(c, mix(HAZE_COOL, HAZE_WARM, clamp01(u * 0.7 + (1 - v) * 0.6 - 0.3)), HAZE);
      const veil = fbm(x / 90 + y / 260, y / 22, 40);
      if (veil > 0.58) c = mix(c, VEIL, Math.min(0.42, (veil - 0.58) * 1.6) * (bayer(x, y) * 0.3 + 0.85));
      // Darker toward the page's edges, so the board and the HUD stand out.
      const ex = Math.abs(u - 0.5) * 2;
      const ey = Math.abs(v - 0.5) * 2;
      const edge = Math.pow(clamp01(Math.max(ex * 0.9, ey) * 0.75 + Math.hypot(ex, ey) * 0.25), 2.4);
      c = mix(c, DEEP, edge * EDGE + (bayer(x, y) - 0.5) * 0.04);
      b.set(x, y, c);
    }
  return b;
}

const CLOUD = pal(['#8288b4', '#a0a4cc', '#bec0e0', '#dcdcf0', '#f4f0fc']);

/**
 * A puff of cloud seen from above, `w` x `h`: overlapping billows, lit on
 * the sun's side (up and right), shaded under, its rim frayed. Number `i`
 * picks its shape.
 */
export function paintCloud(w: number, h: number, i: number): Bitmap {
  const b = new Bitmap(w, h);
  const blobs: { x: number; y: number; r: number }[] = [];
  const n = 6 + Math.floor(hash(i, 1, 90) * 5);
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const r = Math.min(w, h) * (0.22 + hash(i, k, 91) * 0.2) * (1 - Math.abs(t - 0.5) * 0.8);
    blobs.push({ x: w * (0.15 + t * 0.7) + (hash(i, k, 92) - 0.5) * w * 0.12, y: h * 0.5 + (hash(i, k, 93) - 0.5) * h * 0.35, r });
  }
  const field = (x: number, y: number) => {
    let f = -1;
    for (const o of blobs) f = Math.max(f, 1 - Math.hypot(x - o.x, (y - o.y) * 1.15) / o.r);
    return f + (fbm(x / 5, y / 5, 94 + i) - 0.5) * 0.35;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const f = field(x, y);
      if (f <= 0) continue;
      const slope = field(x + 2, y - 2) - field(x - 2, y + 2);
      const lit = clamp01(0.45 + f * 0.7 + slope * 1.4);
      // A frayed rim: the outermost pixels thin out.
      const a = f < 0.08 ? (bayer(x, y) < f / 0.08 ? 200 : 0) : 235;
      if (a) b.set(x, y, ramp(CLOUD, lit, x, y), a);
    }
  return b;
}
