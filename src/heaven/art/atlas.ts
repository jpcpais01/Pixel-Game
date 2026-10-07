// The Atlas: Heaven Lands' map, a sea of cloud at golden hour seen from
// above, with the places adrift on it as floating islands (atlasIsles.ts).
// The sun sits low off the map's west edge, warming everything apricot and
// rose; to the north the clouds part on a patch of night, where Starwatch
// floats among the stars.
//
// Everything is drawn once into three textures, built a slice at a time on
// the Atlas's first opening and kept for later ones:
//   atlas_sea   the cloud floor, the whole map and a margin round it
//   atlas_isles a frame per island (by place id, plus `generic`), its shadow
//               on the clouds (`<id>_sh`) and its pick ring (`<id>_halo`)
//   atlas_bits  everything that moves: cloud heaps and wisps drifting, mist
//               falls, birds, the airship, lanterns, motes, stars, the marker
// The scene moves a few dozen small sprites over the floor, nothing more.

import type Phaser from 'phaser';
import type { Place } from '../places';
import type { PanelStyle } from '../../ui/widgets';
import { Art, CLOUD, INK, MOON_CLOUD, bayer, clamp01, fbm, glowArt, hash2, heapPuffs, hex, mix, paintPuffs, ramp, rng, smooth, tone, type Puff, type RGB } from './atlasPaint';
import { ISLE_ART, isleHalo, isleShadow } from './atlasIsles';

/** The map's size (art px), and the cloud painted beyond its edge that the view may drift over. */
export const ATLAS_W = 840;
export const ATLAS_H = 560;
export const ATLAS_MARGIN = 48;
/** The colour past the painted clouds (only seen for a moment while the map is drawn). */
export const ATLAS_BG = 0x6a5290;

/** An island's spot: its top's middle on the map, how high it floats (sets its shadow's reach), and the isles a sky-path runs to. */
export interface IsleSpot {
  x: number;
  y: number;
  lift: number;
  links?: string[];
}

/** Where each known place floats. */
export const ISLE_SPOTS: Record<string, IsleSpot> = {
  home: { x: 330, y: 300, lift: 26, links: ['everwood', 'garden', 'cloudrest', 'glimmerdeep'] },
  everwood: { x: 640, y: 310, lift: 30, links: ['starwatch'] },
  cloudrest: { x: 290, y: 128, lift: 54, links: ['starwatch'] },
  garden: { x: 470, y: 444, lift: 24, links: ['everwood'] },
  glimmerdeep: { x: 160, y: 412, lift: 28 },
  starwatch: { x: 540, y: 72, lift: 40 },
  shore: { x: 652, y: 494, lift: 26, links: ['garden', 'everwood'] },
  saltflats: { x: 116, y: 236, lift: 22, links: ['cloudrest', 'glimmerdeep', 'home'] },
  hushfall: { x: 760, y: 142, lift: 36, links: ['starwatch', 'everwood'] },
  lumen: { x: 452, y: 200, lift: 32, links: ['home', 'cloudrest', 'starwatch'] },
};

/** Open sky for places still to come, taken in turn by places the table doesn't know. */
export const SPARE_SPOTS: [number, number][] = [
  [290, 502],
  [632, 186],
  [92, 96],
  [796, 456],
];

export interface Isle {
  place: Place;
  /** The frame its art is in (`generic` for a place without a painter). */
  art: string;
  x: number;
  y: number;
  lift: number;
  links: string[];
}

/** Every place's island: from the table where it's known, else on the next spare spot, linked to its nearest neighbour. */
export function layoutIsles(places: Place[]): Isle[] {
  let spare = 0;
  const isles: Isle[] = places.map((place) => {
    const known = ISLE_SPOTS[place.id];
    const art = ISLE_ART[place.id] ? place.id : 'generic';
    if (known) return { place, art, x: known.x, y: known.y, lift: known.lift, links: (known.links ?? []).filter((l) => places.some((p) => p.id === l)) };
    const [x, y] = SPARE_SPOTS[spare % SPARE_SPOTS.length];
    // Past the spare spots, drift further out so nothing sits on top of anything.
    const ring = Math.floor(spare / SPARE_SPOTS.length);
    spare++;
    return { place, art, x: x + ring * 24, y: y - ring * 18, lift: 28, links: [] };
  });
  for (const isle of isles) {
    if (ISLE_SPOTS[isle.place.id] || isles.length < 2) continue;
    let best: Isle | null = null;
    for (const o of isles) if (o !== isle && (!best || Math.hypot(o.x - isle.x, o.y - isle.y) < Math.hypot(best.x - isle.x, best.y - isle.y))) best = o;
    if (best) isle.links.push(best.place.id);
  }
  return isles;
}

// ---------------------------------------------------------------- Light

/** How deep into Starwatch's patch of night a map point is: 0 in the golden clouds, 1 under the stars. */
export function nightAt(x: number, y: number): number {
  const s = ISLE_SPOTS.starwatch;
  const wob = (fbm(x, y, 40, 91, 2) - 0.5) * 0.4;
  const round = 1.3 - Math.hypot((x - s.x) / 240, (y - s.y + 30) / 150) * 1.3;
  const band = clamp01((70 - y) / 120) * clamp01(1.1 - Math.abs(x - s.x) / 400);
  return clamp01(Math.max(round, band) + wob);
}

/** The low sun's warmth, strongest toward the west. */
const sunAt = (x: number, y: number): number => clamp01(1 - Math.hypot((x + 120) / 760, (y - 200) / 560));

const SUN_HAZE = hex('#ffd49a');
const NIGHT_SKY = ramp('#0b0920', '#100e2c', '#161438', '#1e1a46', '#2a2256', '#3a2c66');
const STAR = hex('#fff6e4');
const STAR_BLUE = hex('#c8d0ff');

/** A cloud's colour at a map point: golden, washed with the sun's haze, turning moonlit near the night. */
function cloudColour(v: number, sun: number, n: number, broad: number, px: number, py: number): RGB {
  let c = tone(CLOUD, v + broad + sun * 0.16 - n * 0.05, px, py);
  if (sun > 0.3) c = mix(c, SUN_HAZE, (sun - 0.3) * 0.18);
  if (n > 0.02) c = mix(c, tone(MOON_CLOUD, v + 0.08, px, py), smooth(0.02, 0.5, n));
  return c;
}

// ---------------------------------------------------------------- The cloud floor

/** Rows of the floor painted between yields. */
const SEA_ROWS = 20;
/** Puffs painted between yields. */
const PUFF_BATCH = 120;

/**
 * The sea of cloud: a soft floor of low cloud, heaps of cumulus standing on
 * it each with its shadow, and small billows everywhere between, all lit
 * from the low sun; in the north the floor gives way to night and stars.
 */
export function* paintSea(): Generator<void, Art, void> {
  const M = ATLAS_MARGIN;
  const W = ATLAS_W + M * 2;
  const H = ATLAS_H + M * 2;
  const a = new Art(W, H);
  // The light at each pixel, worked out once for the floor and the billows over it: the sun's
  // warmth, the night's reach, and broad patches of light and shade (as if under higher clouds).
  const sunMap = new Float32Array(W * H);
  const nightMap = new Float32Array(W * H);
  const broadMap = new Float32Array(W * H);
  const colour = (v: number, bx: number, by: number): RGB => {
    const i = by * W + bx;
    return cloudColour(v, sunMap[i], nightMap[i], broadMap[i], bx, by);
  };
  for (let by = 0; by < H; by++) {
    for (let bx = 0; bx < W; bx++) {
      const x = bx - M;
      const y = by - M;
      const i = by * W + bx;
      const n = nightAt(x, y);
      nightMap[i] = n;
      sunMap[i] = sunAt(x, y);
      broadMap[i] = (fbm(x, y, 150, 55, 2) - 0.5) * 0.26;
      if (n + (bayer(bx, by) - 0.5) * 0.12 > 0.64) {
        // The night: deep blue, lighter toward its rim, a hazy band of stars across it.
        const s = clamp01((n - 0.64) / 0.36);
        const band = fbm(x * 0.7 + y * 0.5, y, 30, 77, 3);
        a.set(bx, by, tone(NIGHT_SKY, 0.85 - s * 0.85 + (band - 0.5) * 0.3, bx, by, 1));
        const h = hash2(bx, by, 5);
        if (h < 0.0016 * s) {
          a.set(bx, by, STAR);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) a.set(bx + dx, by + dy, mix(STAR_BLUE, NIGHT_SKY[2], 0.3));
        } else if (h < 0.014 * s * (0.6 + band)) a.set(bx, by, h < 0.006 * s ? STAR : STAR_BLUE);
        continue;
      }
      const f = fbm(x, y, 46, 3, 3);
      const g = fbm(x - 4, y - 4, 46, 3, 3);
      const v = 0.17 + f * 0.26 + (f - g) * 3.2;
      a.set(bx, by, colour(v, bx, by));
    }
    if (by % SEA_ROWS === SEA_ROWS - 1) yield;
  }
  // Heaps of cumulus on a loose grid, fewer toward the night; each casts its shadow first.
  const rand = rng(17);
  const puffs: Puff[] = [];
  const GRID = 58;
  for (let gy = -GRID / 2; gy < H + GRID; gy += GRID) {
    for (let gx = -GRID / 2; gx < W + GRID; gx += GRID) {
      const cx = gx + (rand() - 0.5) * GRID * 0.9;
      const cy = gy + (rand() - 0.5) * GRID * 0.9;
      const n = nightAt(cx - M, cy - M);
      const size = 18 + rand() * 30;
      if (rand() < n * 1.4) continue;
      for (let y = Math.floor(cy - size * 0.2); y <= cy + size * 0.8; y++) {
        for (let x = Math.floor(cx - size * 0.6); x <= cx + size * 1.6; x++) {
          const d = Math.hypot((x - cx - size * 0.45) / (size * 1.05), (y - cy - size * 0.3) / (size * 0.46));
          if (d < 1 && bayer(x, y) > d * d * 0.9) a.shade(x, y, 0.84);
        }
      }
      puffs.push(...heapPuffs(cx, cy, size, 0.22 + rand() * 0.3, rand));
    }
  }
  yield;
  // Low rolls of cloud between the heaps: chains of soft billows in rows, like slow waves.
  const ROW = 11;
  for (let ry = 0; ry < H + ROW; ry += ROW) {
    let x = -20 - rand() * 40;
    while (x < W + 20) {
      const len = 30 + rand() * 90;
      const r0 = 4 + rand() * 3.5;
      for (let d = 0; d < len; d += r0 * 1.15) {
        const t = d / len;
        const px = x + d;
        const py = ry + Math.sin(px / 37 + ry * 0.7) * 3 + (rand() - 0.5) * 2;
        if (rand() < nightAt(px - M, py - M) * 1.6) continue;
        const swell = Math.sin(t * Math.PI);
        puffs.push({ x: px, y: py, r: r0 * (0.7 + swell * 0.6), alt: 0.03 + swell * 0.12, soft: 0.45 });
      }
      x += len + 6 + rand() * 26;
    }
  }
  puffs.sort((p, q) => p.y + p.r * 0.3 - (q.y + q.r * 0.3));
  for (let i = 0; i < puffs.length; i += PUFF_BATCH) {
    paintPuffs(a, puffs.slice(i, i + PUFF_BATCH), 19, colour);
    yield;
  }
  return a;
}

// ---------------------------------------------------------------- What moves

/** A heap of cloud on its own, with its shadow, to drift over the floor. */
function heapArt(size: number, seed: number, light = 0): Art {
  const w = Math.ceil(size * 3.2);
  const h = Math.ceil(size * 1.9);
  const a = new Art(w, h);
  const cx = size * 1.3;
  const cy = size * 0.9;
  const rand = rng(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx - size * 0.55) / (size * 1.2), (y - cy - size * 0.42) / (size * 0.5));
      if (d < 1 && bayer(x, y) > d * d) a.set(x, y, hex('#2c1e4c'), 70);
    }
  }
  paintPuffs(a, heapPuffs(cx, cy, size, 0.36 + light, rand, Math.round(size / 2)), seed, (v, x, y) => tone(CLOUD, v + 0.04, x, y));
  return a;
}

/** A high wisp: a long, thin streak of bright cloud, shown see-through above the islands. */
function wispArt(len: number, seed: number): Art {
  const a = new Art(len + 8, 18);
  const rand = rng(seed);
  const puffs: Puff[] = [];
  for (let k = 0; k < len / 5; k++) {
    const t = k / (len / 5);
    const r = 2.5 + Math.sin(t * Math.PI) * 5 * (0.6 + rand() * 0.5);
    puffs.push({ x: 4 + t * len, y: 10 + (rand() - 0.5) * 3 - Math.sin(t * Math.PI) * 2, r, alt: 0.6 });
  }
  paintPuffs(a, puffs, seed, (v, x, y) => tone(CLOUD, 0.55 + v * 0.45, x, y));
  return a;
}

/** Mist pouring off an island's rim: a frame of the stream falling, fading as it goes. */
function fallArt(frame: number): Art {
  const w = 7;
  const h = 26;
  const a = new Art(w, h);
  const top = hex('#fff2dc');
  const low = hex('#e6aab8');
  for (let y = 0; y < h; y++) {
    const u = y / h;
    const half = 1 + u * 2.2;
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x + 0.5 - w / 2) / half;
      if (dx > 1) continue;
      const streak = (y - frame * 2 + (x % 3) * 4 + 64) % 7 < 3 ? 1 : 0.55;
      const al = Math.pow(1 - u, 1.3) * streak * (1 - dx * 0.6);
      const q = Math.floor(al * 4 + bayer(x, y + frame * 2) * 0.999) / 4;
      if (q > 0) a.set(x, y, mix(top, low, u), Math.round(q * 230));
    }
  }
  return a;
}

/** A small airship: a striped envelope over a little boat with a lantern, its propeller turning. */
function airshipArt(frame: number): Art {
  const a = new Art(30, 22);
  const ENV = ramp('#7a4a6a', '#a8667a', '#d08a8a', '#eeb4a0', '#fcdcbc', '#fff4e0');
  const b = new Art(30, 22);
  b.oval(14, 7, 11, 5.5, (x, y, nx, ny) => {
    let v = 0.62 - nx * 0.3 - ny * 0.38;
    if (Math.abs(nx * 11 - Math.round(nx * 11 / 4) * 4) < 0.6) v -= 0.12;
    return tone(ENV, v, x, y);
  });
  // Tail fins.
  b.poly([[2, 4], [5, 6], [5, 8], [2, 10]], (x, y) => tone(ENV, 0.4 - (y - 4) * 0.04, x, y));
  // Ropes and the boat.
  b.line(9, 12, 10, 15, hex('#5a3a3a'));
  b.line(19, 12, 18, 15, hex('#5a3a3a'));
  b.rect(8, 15, 20, 17, (px, py) => (py === 15 ? hex('#c08a58') : px > 16 ? hex('#5a3820') : hex('#7a5030')));
  b.rect(10, 18, 18, 18, () => hex('#4a2c1c'));
  b.outline(INK);
  a.stamp(b, 0, 0);
  // The lantern at the bow, and the propeller at the stern.
  a.set(20, 14, hex('#ffe08a'));
  a.set(21, 14, hex('#ffb04a'));
  if (frame === 0) {
    a.set(6, 15, hex('#d8c8b8'));
    a.set(6, 17, hex('#d8c8b8'));
  } else {
    a.set(5, 16, hex('#d8c8b8'));
    a.set(7, 16, hex('#d8c8b8'));
  }
  a.set(6, 16, hex('#4a3a3a'));
  return a;
}

/** The airship's shadow on the clouds. */
function airshipShadow(): Art {
  const a = new Art(22, 8);
  a.oval(11, 4, 10, 3.5, (x, y, nx, ny) => (bayer(x, y) > (nx * nx + ny * ny) * 0.8 ? hex('#2a1c4a') : null));
  for (let i = 3; i < a.data.length; i += 4) if (a.data[i]) a.data[i] = 90;
  return a;
}

/** A bird far below the sun: a dark plum flick, wings up (0) or down (1). */
function birdArt(frame: number): Art {
  const a = new Art(7, 4);
  const c = hex('#3a2440');
  const pts = frame === 0 ? [[0, 0], [1, 1], [2, 2], [3, 2], [4, 2], [5, 1], [6, 0]] : [[0, 2], [1, 1], [2, 1], [3, 2], [4, 1], [5, 1], [6, 2]];
  for (const [x, y] of pts) a.set(x, y, c);
  a.set(3, 3, c);
  return a;
}

/** A paper sky lantern, glowing. */
function lanternArt(): Art {
  const a = new Art(5, 6);
  a.rect(1, 0, 3, 0, () => hex('#a8582a'));
  a.rect(0, 1, 4, 4, (x, y) => (x === 0 || x === 4 ? hex('#ff9a3a') : y === 4 ? hex('#ffb84a') : x === 2 ? hex('#fff4c8') : hex('#ffd27a')));
  a.set(2, 5, hex('#ffe8a0'));
  return a;
}

/** A twinkle: a dot, a small cross, a bigger cross. */
function twinkleArt(size: number, c: RGB): Art {
  const a = new Art(5, 5);
  a.set(2, 2, c);
  if (size > 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) a.set(2 + dx, 2 + dy, mix(c, hex('#8a7ac8'), 0.4));
  if (size > 1) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) a.set(2 + dx, 2 + dy, mix(c, hex('#6a5aa8'), 0.6));
  return a;
}

/** The marker over the picked island: a small gold star. */
function markerArt(): Art {
  const a = new Art(11, 11);
  const GOLD = ramp('#b8782a', '#e8a840', '#ffd870', '#fff4c8');
  a.poly([[5.5, 0], [7, 4], [11, 5.5], [7, 7], [5.5, 11], [4, 7], [0, 5.5], [4, 4]], (x, y) => {
    const v = 0.75 - (x - 5) * 0.08 - (y - 5) * 0.09;
    return tone(GOLD, v, x, y);
  });
  a.set(5, 5, GOLD[3]);
  const o = new Art(13, 13);
  o.stamp(a, 1, 1);
  o.outline(hex('#5a2e1e'));
  return o;
}

/** A puff of chimney smoke. */
function smokeArt(): Art {
  const a = new Art(5, 4);
  a.oval(2.5, 2, 2.5, 2, (_x, _y, nx, ny) => (nx + ny < -0.3 ? hex('#fff0e0') : hex('#d8b8c0')));
  return a;
}

/** A path dot: one bright pixel with a softer one beside it. */
function dotArt(): Art {
  const a = new Art(2, 2);
  a.set(0, 0, hex('#fff6dc'));
  a.set(1, 0, hex('#ffe0b0'), 160);
  a.set(0, 1, hex('#ffe0b0'), 160);
  return a;
}

// ---------------------------------------------------------------- Packing

/** Pack pieces into one texture, left to right in rows, a frame each. */
function pack(scene: Phaser.Scene, key: string, parts: [string, Art][], width: number): void {
  let x = 0;
  let y = 0;
  let rowH = 0;
  const at: [string, number, number, Art][] = [];
  for (const [name, art] of parts) {
    if (x + art.w > width) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    at.push([name, x, y, art]);
    x += art.w + 1;
    rowH = Math.max(rowH, art.h);
  }
  const sheet = new Art(width, y + rowH);
  for (const [, px, py, art] of at) sheet.stamp(art, px, py);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  for (const [name, px, py, art] of at) tex.add(name, 0, px, py, art.w, art.h);
}

/** What the scene needs to know of an island's frame. */
export interface IsleInfo {
  w: number;
  h: number;
  ax: number;
  ay: number;
  rx: number;
  ry: number;
  falls: { x: number; y: number }[];
  glows: { x: number; y: number; r: number; tint: number }[];
  glints: { x: number; y: number }[];
  smoke?: { x: number; y: number };
  /** Which pixels of the frame are island, for taps. */
  mask: Uint8Array;
}

/** Each island frame's details, by frame name; filled as the islands are painted. */
export const ISLE_INFO: Record<string, IsleInfo> = {};

/** Cloud heaps and wisps in atlas_bits: their frame names. */
export const HEAPS = ['heap0', 'heap1', 'heap2', 'heap3', 'heap4', 'heap5'];
export const WISPS = ['wisp0', 'wisp1', 'wisp2'];
export const FALL_FRAMES = 4;

const DONE = 'atlas_bits';

function* atlasTextures(scene: Phaser.Scene): Generator<void, void, void> {
  if (!scene.textures.exists('atlas_sea')) {
    const sea = yield* paintSea();
    scene.textures.addCanvas('atlas_sea', sea.toCanvas());
    yield;
  }
  const parts: [string, Art][] = [];
  for (const [id, paint] of Object.entries(ISLE_ART)) {
    const isle = paint();
    const { art } = isle;
    const mask = new Uint8Array(art.w * art.h);
    for (let i = 0; i < mask.length; i++) mask[i] = art.data[i * 4 + 3] > 0 ? 1 : 0;
    ISLE_INFO[id] = { w: art.w, h: art.h, ax: isle.ax, ay: isle.ay, rx: isle.rx, ry: isle.ry, falls: isle.falls, glows: isle.glows, glints: isle.glints, smoke: isle.smoke, mask };
    parts.push([id, art], [`${id}_sh`, isleShadow(isle)], [`${id}_halo`, isleHalo(isle)]);
    yield;
  }
  pack(scene, 'atlas_isles', parts, 512);
  yield;
  const bits: [string, Art][] = [
    ['heap0', heapArt(30, 101)],
    ['heap1', heapArt(22, 102)],
    ['heap2', heapArt(38, 103, 0.04)],
    ['heap3', heapArt(18, 104)],
    ['heap4', heapArt(26, 105)],
    ['heap5', heapArt(34, 106, 0.06)],
    ['wisp0', wispArt(90, 111)],
    ['wisp1', wispArt(60, 112)],
    ['wisp2', wispArt(120, 113)],
  ];
  yield;
  for (let f = 0; f < FALL_FRAMES; f++) bits.push([`fall${f}`, fallArt(f)]);
  bits.push(
    ['glow', glowArt(32)],
    ['ship0', airshipArt(0)],
    ['ship1', airshipArt(1)],
    ['shipsh', airshipShadow()],
    ['bird0', birdArt(0)],
    ['bird1', birdArt(1)],
    ['lantern', lanternArt()],
    ['marker', markerArt()],
    ['smoke', smokeArt()],
    ['dot', dotArt()],
    ['mote0', twinkleArt(0, hex('#ffe8b0'))],
    ['mote1', twinkleArt(1, hex('#ffe8b0'))],
    ['star0', twinkleArt(0, hex('#fff6e4'))],
    ['star1', twinkleArt(1, hex('#fff6e4'))],
    ['star2', twinkleArt(2, hex('#fff6e4'))],
  );
  pack(scene, DONE, bits, 400);
}

let job: { gen: Generator<void, void, void>; textures: Phaser.Textures.TextureManager } | null = null;

/** The Atlas's textures are built (and its islands' details known). */
export const atlasReady = (scene: Phaser.Scene): boolean => scene.textures.exists(DONE) && !!ISLE_INFO.generic;

/** Build the Atlas's textures for up to `budget` ms; true once they're all there. */
export function warmAtlas(scene: Phaser.Scene, budget: number): boolean {
  if (atlasReady(scene)) return true;
  if (!job || job.textures !== scene.textures) job = { gen: atlasTextures(scene), textures: scene.textures };
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    if (job.gen.next().done) {
      job = null;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- The card

/** The card's face: cream at the top, warming to apricot at its foot. */
const CARD_TOP = hex('#fbf0d8');
const CARD_FOOT = hex('#f0d6b0');
const GOLD_LIT = hex('#ffe9a8');
const GOLD = hex('#d49a48');
const GOLD_DEEP = hex('#9a6430');
const CARD_INK = hex('#3e2434');

/**
 * The picked place's card: a slip of cream parchment with a gold rim (lit
 * on its top and left), cut corners, a gold rivet at each corner and a soft
 * shadow under it. Cached per size.
 */
export function cardTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `atlas_card_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const a = new Art(w, h + 2);
  for (let y = 0; y < h + 2; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (y >= h) {
        // The shadow beneath.
        if (x > 2 && x < w - 2) a.set(x, y, hex('#2a1c3a'), y === h ? 90 : 45);
        continue;
      }
      if (ex + ey < 2) continue;
      if (ex === 0 || ey === 0 || ex + ey === 2) a.set(x, y, CARD_INK);
      else if (ex === 1 || ey === 1 || ex + ey === 3) a.set(x, y, y <= 1 || x <= 1 || (ex + ey === 3 && (x < w / 2) && y < h / 2) ? GOLD_LIT : GOLD);
      else if (ex === 2 || ey === 2) a.set(x, y, GOLD_DEEP);
      else {
        const f = (y - 3) / Math.max(1, h - 6);
        const q = Math.min(1, Math.floor(f * 5 + bayer(x, y)) / 5);
        let c = mix(CARD_TOP, CARD_FOOT, q);
        // A faint inner rule, a pixel in from the rim, like a printed border.
        if ((ex === 4 || ey === 4) && ex >= 4 && ey >= 4) c = mix(c, GOLD, 0.35);
        a.set(x, y, c);
      }
    }
  }
  // Rivets at the corners.
  for (const [x, y] of [[5, 5], [w - 6, 5], [5, h - 6], [w - 6, h - 6]]) {
    a.set(x, y, GOLD_LIT);
    a.set(x + 1, y, GOLD);
    a.set(x, y + 1, GOLD);
    a.set(x + 1, y + 1, GOLD_DEEP);
  }
  scene.textures.addCanvas(key, a.toCanvas());
  return key;
}

/** A tag's pill: soft rose with a gold rim, cached per width. */
export function pillTexture(scene: Phaser.Scene, w: number): string {
  const key = `atlas_pill_${w}`;
  if (scene.textures.exists(key)) return key;
  const h = 11;
  const a = new Art(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey < 2) continue;
      if (ex === 0 || ey === 0 || ex + ey === 2) a.set(x, y, GOLD);
      else a.set(x, y, y < 3 ? hex('#f8d8c8') : hex('#ecc0b4'));
    }
  }
  scene.textures.addCanvas(key, a.toCanvas());
  return key;
}

/** Heaven's buttons for the card and the Back button, as panel styles for `PixelButton` (resting, pressed). */
export const GO_STYLE: [PanelStyle, PanelStyle] = [
  { top: hex('#f6b850'), bottom: hex('#c86a2a'), alpha: 1, border: hex('#a8602a'), borderLit: hex('#fff0b4'), outer: CARD_INK },
  { top: hex('#c06a2a'), bottom: hex('#e09a40'), alpha: 1, border: hex('#7a4020'), borderLit: hex('#d89a50'), outer: CARD_INK },
];
export const TOGETHER_STYLE: [PanelStyle, PanelStyle] = [
  { top: hex('#8a9ad8'), bottom: hex('#5a5aa8'), alpha: 1, border: hex('#b07a3a'), borderLit: hex('#ffe4a0'), outer: CARD_INK },
  { top: hex('#4a4a90'), bottom: hex('#6e7ac0'), alpha: 1, border: hex('#7a4e26'), borderLit: hex('#c89a5a'), outer: CARD_INK },
];
export const BACK_STYLE: [PanelStyle, PanelStyle] = [
  { top: hex('#a0688e'), bottom: hex('#6a4070'), alpha: 0.95, border: hex('#b07a3a'), borderLit: hex('#ffe4a0'), outer: CARD_INK },
  { top: hex('#5a3460'), bottom: hex('#8a5a80'), alpha: 0.95, border: hex('#7a4e26'), borderLit: hex('#c89a5a'), outer: CARD_INK },
];

/** Ink colours for the card's text (the pixel font is white and tinted). */
export const CARD_TEXT = { name: 0xb04a34, blurb: 0x8a5a48, lore: 0x5e3e44, tag: 0x7a3a50 };
