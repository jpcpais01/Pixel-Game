// Lumen Meadow's props, drawn with the shared pixel engine (art/pixel.ts):
// tall soft grass with feathery plumes that sways, clumps of wildflowers
// (bluebells, moonpetals, lavender, lupins, dandelion clocks, buttercups and
// daisies), reeds with glowing heads, willows hung with lantern fruit, giant
// old glowcaps, boulders split by crystal veins, the standing stones of a
// circle, a mossy bench, a little shrine, a hare, and the butterflies and
// moths. What glows is drawn in emissive materials, faint by day and lit by
// night. Lit from the warm top-left like everything else. Pure: the node
// script paints them too.

import { FLAT, PixelCanvas, cyl, sphere, type Material, type Vec3 } from '../../../art/pixel';
import { rng } from '../../../art/env';
import type { SheetDef } from '../types';
import {
  BARK, BELL, BODY, BOULDER, BUTTER, CAMPION, CAP_ROSE, CAP_TEAL, CAP_VIOLET, CRYSTAL_TEAL, CRYSTAL_VIOLET, DAISY, DAISY_EYE, EYE, FUR, FUR_WHITE, GILL, GRASS_GOLD, GRASS_TALL, LANTERN, LAVENDER, LICHEN, LUPINE, MEGALITH, MOSS, NOSE, ORB,
  PETAL_CORE, PETAL_MOON, PUFF, REED, REED_TIP, RUNE, SEED_HEAD, SHINGLE, SHRINE_STONE, SPOT, SPOT_PINK, STALK, STEM, THREAD, VEIN, VEIN_VIOLET, WILLOW, WING_MOTH, WING_ROSE, WING_SKY, WING_SUN, WING_TEAL, WING_VIOLET, WOOD, WOOD_DARK,
} from './palette';

/** Normals: facing up to the sky, and facing the viewer. */
const UP: Vec3 = { x: 0, y: 0.6, z: 0.8 };
const FRONT: Vec3 = { x: 0, y: -0.15, z: 1 };

// ---------------------------------------------------------------- tall grass

export const GRASS_W = 24;
export const GRASS_H = 30;
export const GRASS_FOOT_Y = 28;
/** Sway frames: how far (px) the wind pushes a blade's tip. */
const GRASS_SWAY = [-1.3, 0, 1.3];
/** Looks: 0-2 green, 3-5 gone to gold. */
const GRASS_LOOKS = 6;

function grassFrame(v: number, f: number): PixelCanvas {
  const c = new PixelCanvas(GRASS_W, GRASS_H);
  const R = rng(3100 + v * 31);
  const mat = v >= 3 ? GRASS_GOLD : GRASS_TALL;
  const n = 15 + (v % 3) * 3;
  const cx = GRASS_W / 2;
  const blades: { u: number; len: number; lean: number; far: boolean; plume: boolean }[] = [];
  for (let k = 0; k < n; k++) {
    const u = (k / (n - 1)) * 2 - 1 + (R() - 0.5) * 0.3;
    const len = 7 + (1 - Math.abs(u)) * 11 + R() * 6;
    blades.push({ u, len, lean: u * (4 + R() * 4) + (R() - 0.5) * 3, far: R() < 0.45, plume: R() < 0.22 });
  }
  // The far blades first, in shade; the near ones over them.
  blades.sort((a, b) => Number(b.far) - Number(a.far));
  for (const b of blades) {
    c.part();
    const steps = Math.round(b.len);
    let tipX = cx;
    let tipY = GRASS_FOOT_Y;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = cx + b.u * 2.5 + b.lean * t * t + GRASS_SWAY[f] * t * t * (0.5 + b.len / 36);
      const y = GRASS_FOOT_Y - s;
      const bias = Math.round(t * 3 - 2.4 - Math.abs(b.u) * 0.6) + (b.far ? -2 : 0) + (b.lean < 0 ? 1 : 0);
      const n2 = sphere(Math.sign(b.lean) * 0.5, -0.2, 0.8);
      c.px(x, y, mat, n2, { bias });
      // Blades are two pixels wide near their foot.
      if (t < 0.3) c.px(x + (b.lean < 0 ? 1 : -1), y, mat, n2, { bias: bias - 1 });
      tipX = x;
      tipY = y;
    }
    if (b.plume && !b.far && b.len > 14) {
      // A soft, feathery plume nodding at the tip.
      c.part();
      // It droops over the way the blade leans, airy, a few seeds apart.
      const dir = Math.sign(b.lean) || 1;
      for (let q = 0; q < 6; q++) {
        const x = tipX + dir * (q * 0.7);
        const y = tipY + q * q * 0.18;
        c.px(x, y, SEED_HEAD, UP, { bias: q < 2 ? 0 : -1 });
        if (q > 0 && q < 5 && (q & 1)) c.px(x, y + 1, SEED_HEAD, FLAT, { bias: -2 });
        if (q > 1 && q < 5 && !(q & 1)) c.px(x, y - 1, SEED_HEAD, UP, { bias: 1 });
      }
    }
  }
  return c;
}

// ---------------------------------------------------------------- wildflowers

export const BLOOM_W = 24;
export const BLOOM_H = 30;
export const BLOOM_FOOT_Y = 28;
export const BLOOMS = ['bluebell', 'bluebell2', 'moonpetal', 'moonpetal2', 'lavender', 'lupine', 'clock', 'clock2', 'wild', 'daisy'] as const;

/** A stem along a bent curve from its foot (x0, y0) to (x1, y1), arching `bend` px sideways at its middle; returns its points. */
function stem(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, bend: number, m: Material = STEM): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const x = x0 + (x1 - x0) * t + bend * Math.sin(t * Math.PI) * (1 - t * 0.3);
    const y = y0 + (y1 - y0) * t;
    pts.push({ x, y });
    c.px(x, y, m, cyl(0.3), { bias: t > 0.6 ? 1 : 0 });
  }
  return pts;
}

/** A long strap leaf from the foot, curving out. */
function leaf(c: PixelCanvas, x: number, y: number, dir: number, len: number): void {
  for (let s = 0; s < len; s++) {
    const t = s / len;
    c.px(x + dir * (s * 0.55 + t * t * 2), y - s * 0.75 + t * t * 3, STEM, UP, { bias: t < 0.3 ? 0 : 1 });
    if (t < 0.5) c.px(x + dir * (s * 0.55 + 1), y - s * 0.75 + 1, STEM, FLAT, { bias: -1 });
  }
}

function bloomFrame(name: (typeof BLOOMS)[number]): PixelCanvas {
  const c = new PixelCanvas(BLOOM_W, BLOOM_H);
  const R = rng(4200 + BLOOMS.indexOf(name) * 53);
  const cx = BLOOM_W / 2;
  const foot = BLOOM_FOOT_Y;
  const leaves = (n: number) => {
    for (let k = 0; k < n; k++) leaf(c, cx + (R() - 0.5) * 6, foot, k % 2 ? 1 : -1, 5 + R() * 4);
  };
  if (name === 'bluebell' || name === 'bluebell2') {
    leaves(4);
    const n = name === 'bluebell' ? 3 : 5;
    for (let k = 0; k < n; k++) {
      c.part();
      const dir = k % 2 ? 1 : -1;
      const h = (name === 'bluebell' ? 15 : 11) + R() * 7;
      const bx = cx + (k - (n - 1) / 2) * 2.2;
      // An arching stem, nodding over at the top, its bells hanging down the outside of the arch.
      const pts = stem(c, bx, foot, bx + dir * (4 + R() * 3), foot - h, -dir * 3);
      const bells = 3 + Math.floor(R() * 2);
      for (let b = 0; b < bells; b++) {
        const p = pts[Math.max(0, pts.length - 1 - b * 3)];
        const x = p.x + dir * (1 + b * 0.3);
        const y = p.y + 1.5;
        c.px(x, y, BELL, UP, { bias: 2 });
        c.px(x - 1, y + 1, BELL, sphere(-0.5, 0, 0.8), { bias: 1 });
        c.px(x, y + 1, BELL, FLAT, { bias: 0 });
        c.px(x + 1, y + 1, BELL, sphere(0.5, 0, 0.8), { bias: -1 });
        c.px(x - 1, y + 2, BELL, FLAT, { bias: -1 });
        c.px(x + 1, y + 2, BELL, FLAT, { bias: -2 });
      }
    }
  } else if (name === 'moonpetal' || name === 'moonpetal2') {
    leaves(3);
    const big = name === 'moonpetal2';
    const n = big ? 2 : 4;
    for (let k = 0; k < n; k++) {
      c.part();
      const h = 10 + R() * 9 + (big && k === 0 ? 4 : 0);
      const bx = cx + (k - (n - 1) / 2) * 3.4;
      const tx = bx + (R() - 0.5) * 5;
      stem(c, bx, foot, tx, foot - h, (R() - 0.5) * 3);
      c.part();
      // A white star: petals round a glowing eye, the big one with longer points.
      const r = big && k === 0 ? 3 : 2;
      const y = foot - h - 1;
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2 - Math.PI / 2 + k;
        for (let q = 1; q <= r; q++) c.px(tx + Math.cos(ang) * q, y + Math.sin(ang) * q * 0.85, PETAL_MOON, sphere(Math.cos(ang) * 0.5, Math.sin(ang) * 0.5, 0.8), { bias: q === r ? 0 : 1 });
      }
      c.px(tx, y, PETAL_CORE, UP, { bias: 1 });
      if (big && k === 0) {
        c.px(tx + 1, y, PETAL_CORE, UP);
        c.px(tx, y + 1, PETAL_CORE, UP);
      }
    }
    // A bud or two.
    c.part();
    for (let k = 0; k < 2; k++) {
      const bx = cx + (k ? 5 : -5);
      const h = 7 + R() * 4;
      stem(c, bx, foot, bx + (k ? 1 : -1), foot - h, 0);
      c.px(bx + (k ? 1 : -1), foot - h - 1, PETAL_MOON, UP, { bias: 1 });
    }
  } else if (name === 'lavender') {
    const n = 7;
    for (let k = 0; k < n; k++) {
      c.part();
      const u = (k / (n - 1)) * 2 - 1;
      const h = 14 + (1 - Math.abs(u)) * 7 + R() * 4;
      const bx = cx + u * 2;
      const tx = bx + u * 6;
      const pts = stem(c, bx, foot, tx, foot - h, (R() - 0.5) * 1.5);
      // Its spike of tiny florets, alternating side to side.
      for (let s = 0; s < 7; s++) {
        const p = pts[pts.length - 1 - s];
        if (!p) break;
        const side = s % 2 ? 1 : -1;
        c.px(p.x, p.y, LAVENDER, UP, { bias: s < 2 ? 2 : 1 });
        if (s > 0 && s < 6) c.px(p.x + side, p.y, LAVENDER, sphere(side * 0.6, 0, 0.8), { bias: side < 0 ? 1 : -1 });
      }
    }
  } else if (name === 'lupine') {
    // Palmate leaves at the foot.
    for (let k = 0; k < 3; k++) {
      const lx = cx - 5 + k * 5;
      for (let a = 0; a < 5; a++) {
        const ang = Math.PI + (a / 4) * Math.PI;
        for (let q = 1; q <= 3; q++) c.px(lx + Math.cos(ang) * q, foot - 2 + Math.sin(ang) * q * 0.6, STEM, UP, { bias: q === 3 ? 1 : 0 });
      }
    }
    const spikes = [
      { x: cx - 3, h: 22, m: LUPINE },
      { x: cx + 3, h: 17, m: LAVENDER },
      { x: cx + 0.5, h: 25, m: LUPINE },
    ];
    for (const sp of spikes) {
      c.part();
      const pts = stem(c, sp.x, foot - 2, sp.x + (R() - 0.5) * 2, foot - sp.h, 0);
      // A tall cone of florets, widest at its foot.
      for (let s = 0; s < 11; s++) {
        const p = pts[pts.length - 1 - s];
        if (!p) break;
        const w = Math.min(2, s * 0.22 + 0.2);
        for (let q = -Math.round(w); q <= Math.round(w); q++) c.px(p.x + q, p.y, sp.m, sphere(q * 0.4, 0, 0.8), { bias: (s % 2 ? 0 : 1) + (q < 0 ? 1 : q > 0 ? -1 : 0) + (s < 2 ? 1 : 0) });
      }
    }
  } else if (name === 'clock' || name === 'clock2') {
    // A rosette of toothed leaves.
    for (let k = 0; k < 4; k++) {
      const dir = k % 2 ? 1 : -1;
      for (let s = 0; s < 7; s++) {
        c.px(cx + dir * (s + 1), foot - (k > 1 ? 1 : 0) - (s % 2), STEM, UP, { bias: s % 2 ? 1 : 0 });
        c.px(cx + dir * (s + 1), foot - (k > 1 ? 1 : 0) + 1 - (s % 2), STEM, FLAT, { bias: -1 });
      }
    }
    const heads = name === 'clock' ? [{ dx: -3, h: 19, r: 3 }, { dx: 3, h: 14, r: 2.6 }, { dx: 0, h: 23, r: 3.2 }] : [{ dx: 1, h: 22, r: 4 }];
    for (const hd of heads) {
      c.part();
      const tx = cx + hd.dx + (R() - 0.5) * 2;
      const ty = foot - hd.h;
      stem(c, cx + hd.dx * 0.4, foot, tx, ty + hd.r, (R() - 0.5) * 2);
      c.part();
      // A round silver puff: a ring of seeds, airy inside, a bright heart.
      for (let y = Math.floor(ty - hd.r - 1); y <= ty + hd.r + 1; y++) {
        for (let x = Math.floor(tx - hd.r - 1); x <= tx + hd.r + 1; x++) {
          const dx = x + 0.5 - tx;
          const dy = y + 0.5 - ty;
          const d = Math.hypot(dx, dy);
          if (d > hd.r + 0.3) continue;
          const ring = d > hd.r - 1.1;
          if (!ring && R() < 0.45) continue;
          c.px(x, y, PUFF, sphere(dx / hd.r, dy / hd.r, 0.9), { bias: ring ? 0 : -1 });
        }
      }
      c.px(tx, ty, PUFF, UP, { bias: 3 });
      // A few seeds already loose, drifting off.
      for (let k = 0; k < 3; k++) c.spark(tx + hd.r + 1 + R() * 3, ty - hd.r - R() * 4, [200, 255, 240], 0.7);
    }
    if (name === 'clock2') {
      c.part();
      // And a dandelion still in flower beside it.
      stem(c, cx - 2, foot, cx - 6, foot - 10, -1);
      for (let y = -2; y <= 1; y++) for (let x = -2; x <= 1; x++) if (x * x + y * y < 4) c.px(cx - 6 + x, foot - 11 + y, BUTTER, sphere(x / 2, y / 2, 0.8), { bias: 1 - (x > 0 ? 1 : 0) });
    }
  } else {
    leaves(3);
    // A posy of the day's colours: buttercups, campion and daisies.
    const flowers = name === 'daisy' ? ['daisy', 'daisy', 'daisy', 'butter', 'daisy'] : ['butter', 'campion', 'daisy', 'butter', 'campion'];
    flowers.forEach((kind, k) => {
      c.part();
      const u = (k / (flowers.length - 1)) * 2 - 1;
      const h = 8 + (1 - Math.abs(u)) * 9 + R() * 4;
      const bx = cx + u * 2;
      const tx = bx + u * 6 + (R() - 0.5) * 2;
      const ty = foot - h;
      stem(c, bx, foot, tx, ty + 1, (R() - 0.5) * 2);
      c.part();
      if (kind === 'butter') {
        c.px(tx, ty, BUTTER, UP, { bias: 2 });
        c.px(tx + 1, ty, BUTTER, sphere(0.6, 0, 0.8), { bias: 0 });
        c.px(tx, ty + 1, BUTTER, FLAT, { bias: 0 });
        c.px(tx + 1, ty + 1, BUTTER, FLAT, { bias: -1 });
        c.px(tx - 1, ty, BUTTER, sphere(-0.6, 0, 0.8), { bias: 1 });
      } else if (kind === 'campion') {
        for (const [dx, dy, b] of [[0, -1, 2], [-1, 0, 1], [1, 0, 0], [-1, 1, 0], [1, 1, -1]]) c.px(tx + dx, ty + dy, CAMPION, UP, { bias: b });
        c.px(tx, ty, CAMPION, FLAT, { bias: -2 });
      } else {
        for (const [dx, dy, b] of [[0, -1, 2], [-1, 0, 1], [1, 0, 0], [0, 1, -1], [-1, -1, 1], [1, 1, -2], [1, -1, 1], [-1, 1, 0]]) c.px(tx + dx, ty + dy, DAISY, UP, { bias: b });
        c.px(tx, ty, DAISY_EYE, UP, { bias: 1 });
      }
    });
  }
  return c;
}

// ---------------------------------------------------------------- reeds

export const REED_W = 22;
export const REED_H = 32;
export const REED_FOOT_Y = 30;

function reedFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(REED_W, REED_H);
  const R = rng(5100 + v * 41);
  const cx = REED_W / 2;
  const n = 7 + v * 2;
  const tops: { x: number; y: number; h: number }[] = [];
  for (let k = 0; k < n; k++) {
    c.part();
    const u = (k / (n - 1)) * 2 - 1;
    const h = 12 + (1 - Math.abs(u)) * 12 + R() * 5;
    const lean = u * (2 + R() * 3);
    let x = cx;
    let y = REED_FOOT_Y;
    for (let s = 0; s <= h; s++) {
      const t = s / h;
      x = cx + u * 4.5 + lean * t * t;
      y = REED_FOOT_Y - s;
      c.px(x, y, REED, cyl(Math.sign(lean) * 0.4), { bias: Math.round(t * 2.5 - 1) + (u < 0 ? 1 : 0) });
      if (t < 0.55) c.px(x + (u < 0 ? 1 : -1), y, REED, FLAT, { bias: Math.round(t * 2.5 - 2) });
    }
    tops.push({ x, y, h });
  }
  // Glowing heads on the tallest few, like cattails filled with light.
  tops.sort((a, b) => b.h - a.h);
  for (let k = 0; k < 2 + v; k++) {
    const t = tops[k];
    if (!t) break;
    c.part();
    c.capsule(t.x, t.y + 3, t.x, t.y + 6.5, 1.3, 1.1, REED_TIP);
    c.px(t.x, t.y + 1, REED_TIP, UP, { bias: 2 });
  }
  return c;
}

// ---------------------------------------------------------------- glowcaps

export const SHROOM_W = 64;
export const SHROOM_H = 92;
export const SHROOM_FOOT_Y = 88;

interface Cap {
  x: number;
  height: number;
  rx: number;
  ry: number;
  lean: number;
  cap: Material;
  spot: Material;
  spots: number;
}

/** One giant mushroom: a pale stalk with a skirt, glowing gills under a domed cap freckled with light. */
function glowcap(c: PixelCanvas, R: () => number, foot: number, g: Cap): void {
  const capY = foot - g.height;
  const top = g.x + g.lean;
  const hw0 = Math.max(1.8, g.rx * 0.12);
  // The gills, under the cap's rim, drawn first so the stalk stands in front.
  c.part();
  const gillH = Math.max(2, g.ry * 0.45);
  for (let y = Math.floor(capY); y <= capY + gillH; y++) {
    const k = (y - capY) / gillH;
    const hw = g.rx * 0.94 * Math.sqrt(Math.max(0, 1 - k * k));
    for (let x = Math.floor(top - hw); x < top + hw; x++) {
      const dx = x + 0.5 - top;
      const radial = Math.round((dx / (y - capY + 3)) * 2.2);
      c.px(x, y, GILL, { x: dx / g.rx * 0.3, y: -0.6, z: 0.75 }, { bias: (radial % 2 ? -1 : 0) + (k > 0.6 ? -1 : 0) });
    }
  }
  // The stalk, flaring at its foot, a little curved, its fibres running up it.
  c.part();
  for (let y = Math.floor(capY + 1); y <= foot; y++) {
    const t = (foot - y) / g.height;
    const x = g.x + g.lean * t * t;
    const hw = hw0 * (1 - t * 0.15) + Math.pow(1 - t, 5) * hw0 * 1.1;
    for (let px = Math.floor(x - hw); px < x + hw; px++) {
      const u = (px + 0.5 - x) / hw;
      c.px(px, y, STALK, cyl(u, 0.1), { bias: (Math.abs(Math.round(px - x)) % 3 === 1 ? -1 : 0) + (t > 0.85 ? -1 : 0) });
    }
  }
  // Its skirt, a frill hanging from the stalk under the cap.
  c.part();
  const ringT = 0.78;
  const ry = Math.round(foot - g.height * ringT);
  const rx = g.x + g.lean * ringT * ringT;
  for (let j = 0; j < 3; j++) {
    const hw = hw0 * 0.85 + 1.5 + j * 0.6;
    for (let px = Math.floor(rx - hw); px < rx + hw; px++) {
      const u = (px + 0.5 - rx) / hw;
      c.px(px, ry + j, STALK, cyl(u, -0.3), { bias: j === 0 ? 1 : j === 2 && (px & 1) ? -2 : 0 });
    }
  }
  // The cap: a dome, lit on its upper left, its rim rolled under.
  c.part();
  for (let y = Math.floor(capY - g.ry); y <= capY + 1; y++) {
    const dy = (y + 0.5 - capY) / g.ry;
    const hw = y <= capY ? g.rx * Math.sqrt(Math.max(0, 1 - dy * dy)) : g.rx * (1 - (y - capY) * 0.05);
    for (let x = Math.floor(top - hw); x < top + hw; x++) {
      const dx = (x + 0.5 - top) / g.rx;
      const rim = y > capY - 1;
      const n = rim ? { x: dx * 0.5, y: -0.45, z: 0.75 } : sphere(dx, Math.min(0, dy) * 1.1, 0.9);
      c.px(x, y, g.cap, n, { bias: rim ? -1 : 0 });
    }
  }
  // Spots of light on the cap.
  c.part();
  for (let k = 0; k < g.spots; k++) {
    const a = R() * Math.PI;
    const d = 0.25 + R() * 0.6;
    const sx = top - Math.cos(a) * g.rx * d;
    const sy = capY - Math.sin(a) * g.ry * d * 0.95 + 1;
    const r = 0.8 + R() * (g.rx > 18 ? 1.5 : 0.8);
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const ex = (x + 0.5 - sx) / r;
        const ey = (y + 0.5 - sy) / (r * 0.75);
        if (ex * ex + ey * ey > 1 || c.materialAt(x, y) !== g.cap) continue;
        c.px(x, y, g.spot, UP, { bias: ey < 0 ? 1 : 0 });
      }
    }
  }
  // Spores drifting down from the gills, pure light.
  for (let k = 0; k < Math.round(g.rx / 3); k++) c.spark(top + (R() - 0.5) * g.rx * 1.6, capY + gillH + 2 + R() * 10, [120, 240, 230], 0.55);
}

function shroomFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(SHROOM_W, SHROOM_H);
  const R = rng(6100 + v * 67);
  const cx = SHROOM_W / 2;
  const foot = SHROOM_FOOT_Y;
  // A mossy mound round the foot.
  const mound = () => {
    c.part();
    c.ellipse(cx + (v === 1 ? -4 : 0), foot - 1, v === 1 ? 15 : 11, 3.4, MOSS, { flatten: 0.5 });
    for (let k = 0; k < 12; k++) {
      const x = cx + (R() - 0.5) * 26;
      const h = 2 + R() * 4;
      for (let s = 0; s < h; s++) c.px(x + (s > 2 ? Math.sign(x - cx) : 0), foot - s, GRASS_TALL, UP, { bias: s - 1 });
    }
  };
  const baby = (x: number, h: number, cap: Material) => {
    c.part();
    for (let s = 0; s < h; s++) c.px(x, foot - s, STALK, cyl(0), { bias: 1 });
    c.part();
    c.ellipse(x, foot - h, 2.6, 1.6, cap, { flatten: 0.8 });
    c.px(x - 1, foot - h - 1, v === 2 ? SPOT_PINK : SPOT, UP);
  };
  if (v === 0) {
    glowcap(c, R, foot, { x: cx - 2, height: 52, rx: 25, ry: 12, lean: 4, cap: CAP_VIOLET, spot: SPOT, spots: 11 });
    mound();
    baby(cx - 10, 5, CAP_VIOLET);
    baby(cx + 9, 4, CAP_TEAL);
  } else if (v === 1) {
    glowcap(c, R, foot, { x: cx + 4, height: 66, rx: 21, ry: 8, lean: -2, cap: CAP_TEAL, spot: SPOT, spots: 8 });
    glowcap(c, R, foot + 1, { x: cx - 13, height: 28, rx: 11, ry: 6.5, lean: -3, cap: CAP_VIOLET, spot: SPOT, spots: 5 });
    mound();
    baby(cx + 12, 5, CAP_TEAL);
  } else {
    glowcap(c, R, foot, { x: cx + 2, height: 40, rx: 27, ry: 13, lean: -5, cap: CAP_ROSE, spot: SPOT_PINK, spots: 12 });
    mound();
    baby(cx - 11, 6, CAP_ROSE);
    baby(cx - 7, 3, CAP_ROSE);
    baby(cx + 12, 4, CAP_VIOLET);
  }
  return c;
}

// ---------------------------------------------------------------- crystal boulders

export const ROCK_W = 52;
export const ROCK_H = 44;
export const ROCK_FOOT_Y = 38;

/** A crystal: a six-sided prism from (x, y) up along angle a, h long, w half wide, pointed at its tip. */
function prism(c: PixelCanvas, x: number, y: number, h: number, w: number, a: number, m: Material): void {
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  for (let s = 0; s <= h; s += 0.5) {
    const tip = h - w * 1.3;
    const hw = s > tip ? (w * (h - s)) / (w * 1.3) : w;
    for (let q = -hw; q <= hw; q += 0.5) {
      const u = q / w;
      const n = u < -0.35 ? { x: -0.7, y: 0.25, z: 0.65 } : u > 0.35 ? { x: 0.7, y: -0.1, z: 0.7 } : { x: 0, y: 0.35, z: 0.94 };
      c.px(x + dx * s - dy * q, y + dy * s + dx * q, m, n, { bias: s > tip ? 1 : 0 });
    }
  }
}

/** A glowing vein wandering across the stone it's drawn on, branching now and then. */
function vein(c: PixelCanvas, R: () => number, x: number, y: number, dir: number, len: number, stone: Material, m: Material): void {
  for (let s = 0; s < len; s++) {
    x += dir;
    y += R() < 0.35 ? (R() < 0.5 ? -1 : 1) : 0;
    if (c.materialAt(x, y) !== stone && c.materialAt(x, y) !== m) continue;
    c.px(x, y, m, FLAT, { bias: s % 5 === 0 ? 1 : 0 });
    if (R() < 0.07 && len - s > 4) vein(c, R, x, y, dir, Math.floor((len - s) * 0.5), stone, m);
  }
}

/** A boulder's moss: its top, under a wavy edge. */
function mossTop(c: PixelCanvas, R: () => number, cx: number, cy: number, rx: number, ry: number, stone: Material): void {
  c.part();
  for (let y = Math.floor(cy - ry); y < cy; y++) {
    for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 || c.materialAt(x, y) !== stone) continue;
      const edge = -0.45 + Math.sin(x * 0.9) * 0.12 + (R() - 0.5) * 0.15;
      if (dy > edge) continue;
      c.px(x, y, MOSS, sphere(dx, dy, 0.9), { bias: dy > edge - 0.12 ? -1 : 0 });
    }
  }
}

function rockFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(ROCK_W, ROCK_H);
  const R = rng(7100 + v * 13);
  const cx = ROCK_W / 2;
  const b = ROCK_FOOT_Y;
  const lump = (x: number, y: number, rx: number, ry: number) => {
    c.part();
    c.ellipse(x, y, rx, ry, BOULDER, { flatten: 0.8 });
  };
  if (v === 0) {
    lump(cx, b - 11, 17, 11.5);
    lump(cx - 11, b - 5, 8, 5.5);
    lump(cx + 12, b - 4, 7, 4.6);
    mossTop(c, R, cx, b - 11, 17, 11.5, BOULDER);
    vein(c, R, cx - 17, b - 12, 1, 34, BOULDER, VEIN);
    vein(c, R, cx - 8, b - 4, 1, 16, BOULDER, VEIN);
    c.part();
    prism(c, cx + 8, b - 18, 11, 2.2, 0.35, CRYSTAL_TEAL);
    prism(c, cx + 5, b - 17, 8, 1.8, -0.2, CRYSTAL_TEAL);
    prism(c, cx + 12, b - 15, 6, 1.6, 0.8, CRYSTAL_TEAL);
    c.part();
    prism(c, cx - 15, b - 1, 4, 1.3, -0.6, CRYSTAL_TEAL);
  } else if (v === 1) {
    lump(cx, b - 8, 12, 8.5);
    lump(cx + 8, b - 3, 5.5, 3.6);
    mossTop(c, R, cx, b - 8, 12, 8.5, BOULDER);
    vein(c, R, cx - 12, b - 7, 1, 24, BOULDER, VEIN_VIOLET);
    c.part();
    prism(c, cx - 2, b - 14, 12, 2.3, -0.1, CRYSTAL_VIOLET);
    prism(c, cx + 2, b - 13, 8, 1.8, 0.45, CRYSTAL_VIOLET);
    prism(c, cx - 5, b - 12, 6, 1.5, -0.6, CRYSTAL_VIOLET);
  } else {
    // A boulder split in two, crystal grown up out of the cleft.
    lump(cx - 10, b - 10, 11, 10.5);
    lump(cx + 11, b - 9, 11, 9.5);
    mossTop(c, R, cx - 10, b - 10, 11, 10.5, BOULDER);
    mossTop(c, R, cx + 11, b - 9, 11, 9.5, BOULDER);
    vein(c, R, cx - 20, b - 9, 1, 18, BOULDER, VEIN);
    vein(c, R, cx + 21, b - 6, -1, 18, BOULDER, VEIN_VIOLET);
    c.part();
    prism(c, cx, b - 6, 18, 2.6, 0.05, CRYSTAL_TEAL);
    prism(c, cx - 2, b - 5, 13, 2, -0.35, CRYSTAL_VIOLET);
    prism(c, cx + 3, b - 5, 11, 1.9, 0.45, CRYSTAL_TEAL);
    prism(c, cx + 1, b - 2, 6, 1.5, 0.9, CRYSTAL_VIOLET);
  }
  return c;
}

// ---------------------------------------------------------------- lantern willows

export const WILLOW_W = 108;
export const WILLOW_H = 116;
export const WILLOW_FOOT_Y = 110;
/** The willows' looks: how far the trunk leans, how tall it is, how many lantern fruit hang. */
const WILLOWS = [
  { lean: 4, trunk: 36, seed: 5, fruit: 9 },
  { lean: -5, trunk: 32, seed: 17, fruit: 8 },
];
/** Sway frames: how far (px) the wind swings a strand's tip. */
const WILLOW_SWAY = [-1.6, 0, 1.6];

function willowFrame(v: number, f: number): PixelCanvas {
  const L = WILLOWS[v];
  const c = new PixelCanvas(WILLOW_W, WILLOW_H);
  const R = rng(5200 + L.seed);
  const cx = WILLOW_W / 2;
  const foot = WILLOW_FOOT_Y;
  const sway = WILLOW_SWAY[f];
  const crownY = foot - L.trunk - 30;
  const RX = 36;
  const RY = 18;
  // Strands: where each starts on the crown and how far it falls (the same in every frame; only the wind moves them).
  const strands: { x: number; y: number; len: number; u: number; front: boolean; gaps: number }[] = [];
  for (let k = 0; k < 86; k++) {
    const u = R() * 2 - 1;
    const front = R() < 0.55;
    const x = cx + u * RX;
    const y = crownY - RY * Math.sqrt(1 - u * u) * (front ? 0.15 + R() * 0.85 : 0.9) + 2;
    // The hem: low at the sides, lifted at the front middle so the trunk shows through.
    let hem = foot - 4 - (1 - Math.abs(u)) * 8 - R() * 8;
    if (front && Math.abs(u) < 0.3) hem = crownY + 14 + R() * 10;
    strands.push({ x, y, len: Math.max(6, hem - y), u, front, gaps: Math.floor(R() * 1000) });
  }
  const drawStrand = (s: (typeof strands)[number]) => {
    c.part();
    const G = rng(s.gaps);
    for (let q = 0; q < s.len; q++) {
      const t = q / s.len;
      const x = s.x + s.u * 9 * Math.pow(t, 1.3) + sway * t * t * (0.6 + Math.abs(s.u) * 0.4);
      const y = s.y + q;
      if (t > 0.3 && G() < 0.06) continue;
      // Lit on the crown's sunny upper left, shading down toward the hem.
      const bias = Math.round(1.6 - t * 3 - s.u * 0.9) + (s.front ? 0 : -2) + (q % 3 === 0 ? 1 : 0);
      c.px(x, y, WILLOW, sphere(s.u * 0.5, 0.2, 0.85), { bias });
      // Narrow leaves along the strand, to one side then the other.
      if (t < 0.95) c.px(x + (q % 4 < 2 ? 1 : -1), y, WILLOW, sphere(s.u * 0.5 + (q % 4 < 2 ? 0.4 : -0.4), 0, 0.85), { bias: bias - 1 });
    }
  };
  // The curtain behind the trunk first.
  for (const s of strands) if (!s.front) drawStrand(s);
  // The trunk: short and gnarled, flaring into its roots.
  c.part();
  const trunkX = (t: number) => cx + L.lean * Math.pow(t, 1.4) + Math.sin(t * 5) * 1.1;
  for (let s = 0; s <= L.trunk + 6; s++) {
    const t = s / L.trunk;
    const x = trunkX(t);
    const hw = 3.8 - t * 1 + (s < 6 ? (6 - s) * 0.55 : 0);
    for (let px = Math.floor(x - hw); px < x + hw; px++) {
      const uu = (px + 0.5 - x) / hw;
      c.px(px, foot - s, BARK, cyl(uu, 0.15), { bias: (px + s * 3) % 7 === 0 ? -1 : 0 });
    }
  }
  c.part();
  for (const d of [-1, 1]) c.capsule(cx + d * 2, foot - 2, cx + d * 8, foot, 1.6, 0.8, BARK);
  // Limbs reaching up and out into the crown.
  c.part();
  const tx = trunkX(1);
  const ty = foot - L.trunk;
  for (const [ex, ey] of [[-26, -18], [-11, -26], [9, -27], [25, -17]]) c.capsule(tx, ty, tx + ex, ty + ey, 2.4, 1.1, BARK);
  // The crown under the strands: a dome of leaf clumps, darker, lit on its upper left.
  const clumps: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < 34; k++) {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    clumps.push({ x: cx + Math.cos(a) * d * (RX - 4), y: crownY + 2 + Math.sin(a) * d * (RY - 4), r: 3.5 + R() * 2.5 });
  }
  clumps.sort((a, b) => a.y - b.y);
  for (const cl of clumps) {
    c.part();
    const u = (cl.x - cx) / RX;
    const w = (cl.y - crownY) / RY;
    c.ellipse(cl.x, cl.y, cl.r, cl.r * 0.75, WILLOW, { flatten: 0.6, bias: Math.round(-w * 1.8 - u * 0.8) - 1 });
  }
  // The curtain in front.
  for (const s of strands) if (s.front) drawStrand(s);
  // Lantern fruit hung among the strands, each on its own thread (they hold still: their glow is drawn once).
  const F = rng(9900 + L.seed);
  for (let k = 0; k < L.fruit; k++) {
    const fx = Math.round(cx + (F() - 0.5) * 70);
    const fy = Math.round(crownY + 12 + F() * 40);
    if (Math.abs(fx - cx) < 8 && fy > crownY + 22) continue;
    c.part();
    for (let q = 1; q <= 3; q++) c.px(fx, fy - 2 - q, THREAD, FLAT);
    c.part();
    c.px(fx, fy - 2, BARK, UP, { bias: 2 });
    c.ellipse(fx + 0.5, fy + 0.5, 1.7, 2.2, LANTERN, { flatten: 0.8 });
    c.px(fx, fy, LANTERN, UP, { bias: 2 });
  }
  return c;
}

// ---------------------------------------------------------------- standing stones

export const STONE_W = 26;
export const STONE_H = 48;
export const STONE_FOOT_Y = 44;
const STONES = [
  { h: 38, w: 6.5, lean: 0.8, top: 1.3 },
  { h: 30, w: 7.5, lean: -0.9, top: -1.6 },
  { h: 42, w: 6, lean: 0.4, top: 0.6 },
  { h: 26, w: 8, lean: 1.2, top: 2 },
];
/** Rune glyphs carved down a stone's face, 3 wide. */
const STONE_RUNES = [
  ['.#.', '##.', '.#.', '.##'],
  ['#.#', '.#.', '#.#', '...'],
  ['##.', '#..', '##.', '..#'],
  ['.#.', '###', '.#.', '.#.'],
  ['#..', '##.', '#.#', '#..'],
];

function stoneFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(STONE_W, STONE_H);
  const L = STONES[v];
  const R = rng(8100 + v * 19);
  const cx = STONE_W / 2;
  const foot = STONE_FOOT_Y;
  const midX = (y: number) => cx + L.lean * ((foot - y) / L.h) * 3;
  for (let y = foot - L.h - 4; y <= foot; y++) {
    const t = (foot - y) / L.h;
    const hw = L.w * (1.08 - t * 0.32) * (1 + Math.sin(y * 0.7 + v) * 0.05);
    const mx = midX(y);
    for (let x = Math.floor(mx - hw); x < mx + hw; x++) {
      const u = (x + 0.5 - mx) / hw;
      // A worn top, slanting, rounded at its shoulders.
      const yTop = foot - L.h + L.top * u * 3 + u * u * 2.4 + Math.abs(Math.sin(u * 4 + v * 2)) * 1.6;
      if (y < yTop) continue;
      const lip = y - yTop < 2;
      const strata = Math.floor((y + v * 7) / 5) % 3 === 0 ? -1 : 0;
      c.px(x, y, MEGALITH, lip ? UP : cyl(u, 0.1), { bias: (lip ? 1 : 0) + strata });
    }
  }
  // Lichen on its sunny side.
  c.part();
  for (let k = 0; k < 7; k++) {
    const y = foot - 6 - R() * (L.h - 10);
    const x = midX(y) - L.w * 0.7 + R() * L.w;
    for (let j = 0; j < 4; j++) {
      const lx = x + (R() - 0.5) * 3;
      const ly = y + (R() - 0.5) * 2;
      if (c.materialAt(lx, ly) === MEGALITH) c.px(lx, ly, LICHEN, UP, { bias: Math.floor(R() * 3) });
    }
  }
  // Runes down its face, glowing.
  c.part();
  const rows = Math.floor((L.h - 12) / 6);
  for (let r = 0; r < rows; r++) {
    const g = STONE_RUNES[Math.floor(R() * STONE_RUNES.length)];
    const y0 = foot - L.h + 7 + r * 6;
    const x0 = Math.round(midX(y0) - 1.5);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '#') c.px(x0 + i, y0 + j, RUNE, FLAT);
  }
  // Moss and grass round its foot.
  c.part();
  c.ellipse(midX(foot), foot - 0.5, L.w + 2.5, 2.4, MOSS, { flatten: 0.5 });
  for (let k = 0; k < 6; k++) {
    const x = midX(foot) + (R() - 0.5) * (L.w * 2 + 6);
    for (let s = 0; s < 2 + R() * 3; s++) c.px(x, foot - s, GRASS_TALL, UP, { bias: s });
  }
  return c;
}

// ---------------------------------------------------------------- the bench

export const BENCH_W = 38;
export const BENCH_H = 28;
export const BENCH_FOOT_Y = 24;

function benchFrame(v: number): PixelCanvas {
  const c = new PixelCanvas(BENCH_W, BENCH_H);
  const R = rng(9100 + v * 7);
  const x0 = 4;
  const x1 = 33;
  // Back legs, then the backrest's two rails between its posts.
  c.part();
  for (const px of [x0 + 2, x1 - 3]) for (let y = 4; y <= 16; y++) for (let k = 0; k < 2; k++) c.px(px + k, y, WOOD_DARK, cyl(k ? 0.6 : -0.6), { bias: y === 4 ? 2 : 0 });
  c.part();
  for (const [ya, yb] of [[5, 7], [10, 11]]) {
    for (let y = ya; y <= yb; y++) {
      for (let x = x0; x <= x1; x++) {
        const grain = (x * 7 + y * 3) % 11 === 0 ? -1 : 0;
        c.px(x, y, WOOD, FRONT, { bias: (y === ya ? 1 : y === yb ? -1 : 0) + grain });
      }
    }
  }
  // The seat: three boards, their tops to the sky, a dark front edge.
  c.part();
  for (let y = 14; y <= 18; y++) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const front = y === 18;
      const seam = y === 15 || y === 17;
      c.px(x, y, WOOD, front ? FRONT : UP, { bias: front ? -2 : seam ? -1 : (x * 5 + y) % 13 === 0 ? 1 : 0 });
    }
  }
  // Front legs.
  c.part();
  for (const px of [x0 + 1, x1 - 2]) for (let y = 19; y <= BENCH_FOOT_Y; y++) for (let k = 0; k < 2; k++) c.px(px + k, y, WOOD_DARK, cyl(k ? 0.6 : -0.6), { bias: y === 19 ? -1 : 0 });
  // Moss, as old benches gather, and a flower that grew up through the slats.
  c.part();
  const moss = (x: number, y: number, rx: number, ry: number) => {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1 && c.filled(x + i, y + j) && R() < 0.8) c.px(x + i, y + j, MOSS, UP, { bias: j < 0 ? 1 : 0 });
  };
  moss(x0 + 2, 5, 3, 1);
  moss(x1 - 1, 14, 3, 1);
  if (v === 1) {
    moss(x0 + 6, 10, 4, 1);
    moss(x0 + 1, 15, 2, 1);
    c.part();
    stem(c, x1 - 4, BENCH_FOOT_Y, x1 - 3, BENCH_FOOT_Y - 9, 1);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) c.px(x1 - 3 + dx, BENCH_FOOT_Y - 10 + dy, PETAL_MOON, UP, { bias: dy < 0 ? 1 : 0 });
    c.px(x1 - 3, BENCH_FOOT_Y - 10, PETAL_CORE, UP);
    c.part();
    c.px(x0 + 3, BENCH_FOOT_Y, STALK, FLAT, { bias: 1 });
    c.ellipse(x0 + 3, BENCH_FOOT_Y - 1.5, 1.8, 1.1, CAP_VIOLET, { flatten: 0.8 });
    c.px(x0 + 2, BENCH_FOOT_Y - 2, SPOT, UP);
  }
  return c;
}

// ---------------------------------------------------------------- the shrine

export const SHRINE_W = 28;
export const SHRINE_H = 42;
export const SHRINE_FOOT_Y = 38;

function shrineFrame(): PixelCanvas {
  const c = new PixelCanvas(SHRINE_W, SHRINE_H);
  const R = rng(9500);
  const cx = SHRINE_W / 2;
  const foot = SHRINE_FOOT_Y;
  // A footing of two stones, top lit, face in shade.
  c.part();
  for (let y = foot - 8; y <= foot; y++) {
    const top = y <= foot - 7;
    const hw = y > foot - 3 ? 10 : 9;
    for (let x = cx - hw; x < cx + hw; x++) c.px(x, y, SHRINE_STONE, top ? UP : FRONT, { bias: top ? 1 : y === foot - 3 || (x - cx + 20) % 7 === 0 ? -2 : -1 });
  }
  // The little house: a dark back, two posts, an orb of light on a dish.
  c.part();
  for (let y = foot - 23; y <= foot - 9; y++) for (let x = cx - 5; x < cx + 5; x++) c.px(x, y, WOOD_DARK, FRONT, { bias: -2 });
  c.part();
  for (const px of [cx - 7, cx + 5]) for (let y = foot - 23; y <= foot - 9; y++) for (let k = 0; k < 2; k++) c.px(px + k, y, WOOD, cyl(k ? 0.6 : -0.6), { bias: 0 });
  c.part();
  for (let x = cx - 3; x < cx + 3; x++) c.px(x, foot - 11, SHRINE_STONE, UP, { bias: 1 });
  for (let x = cx - 2; x < cx + 2; x++) c.px(x, foot - 10, SHRINE_STONE, FRONT, { bias: -1 });
  c.part();
  c.ellipse(cx, foot - 14.5, 2.8, 2.8, ORB, { flatten: 0.9 });
  c.px(cx - 1, foot - 16, ORB, UP, { bias: 3 });
  // A gabled roof of mossy shingles.
  c.part();
  for (let y = foot - 33; y <= foot - 23; y++) {
    const k = (y - (foot - 33)) / 10;
    const hw = 2 + k * 11;
    for (let x = Math.floor(cx - hw); x < cx + hw; x++) {
      const left = x + 0.5 < cx;
      const row = Math.floor((y - (foot - 33)) / 2);
      const seam = (y - (foot - 33)) % 2 === 1 || (x + row * 2) % 4 === 0;
      const eave = y === foot - 23;
      c.px(x, y, eave ? WOOD : SHINGLE, eave ? FRONT : left ? { x: -0.5, y: 0.5, z: 0.7 } : { x: 0.5, y: 0.4, z: 0.75 }, { bias: (seam ? -1 : 0) + (eave ? -1 : 0) });
    }
  }
  c.part();
  for (let k = 0; k < 14; k++) {
    const y = foot - 31 + Math.floor(R() * 7);
    const x = cx - 2 - R() * (2 + (y - (foot - 33)) * 1.1);
    if (c.materialAt(x, y) === SHINGLE) c.px(x, y, MOSS, UP, { bias: Math.floor(R() * 3) });
  }
  c.px(cx, foot - 34, WOOD, UP, { bias: 2 });
  c.px(cx - 1, foot - 34, WOOD, UP, { bias: 1 });
  // Offerings at its foot: bluebells and a moonpetal.
  c.part();
  for (let k = 0; k < 3; k++) {
    const x = cx - 9 + k * 1.5;
    stem(c, x, foot, x - 1, foot - 5 - k, 0);
    c.px(x - 1, foot - 5 - k, BELL, UP, { bias: 1 });
    c.px(x - 2, foot - 4 - k, BELL, FLAT, { bias: 0 });
  }
  stem(c, cx + 8, foot, cx + 9, foot - 6, 0);
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) c.px(cx + 9 + dx, foot - 7 + dy, PETAL_MOON, UP, { bias: dy < 0 ? 1 : 0 });
  c.px(cx + 9, foot - 7, PETAL_CORE, UP);
  return c;
}

// ---------------------------------------------------------------- the hare

export const HARE_W = 18;
export const HARE_H = 16;
export const HARE_FOOT_Y = 14;

function hareFrame(pose: 'sit' | 'twitch' | 'crouch' | 'leap' | 'land'): PixelCanvas {
  const c = new PixelCanvas(HARE_W, HARE_H);
  const f = HARE_FOOT_Y;
  const body = (x: number, y: number, rx: number, ry: number) => {
    c.part();
    c.ellipse(x, y, rx, ry, FUR, { flatten: 0.8 });
  };
  const head = (x: number, y: number, earBack: number, earTwitch = 0) => {
    c.part();
    c.capsule(x - 0.5, y - 1.5, x - 1.5 - earBack, y - 6 + earBack * 0.6, 0.9, 0.7, FUR);
    c.capsule(x + 0.5, y - 1.5, x + 0.3 - earBack + earTwitch, y - 5.6 + earBack * 0.6, 0.9, 0.7, FUR);
    c.part();
    c.ellipse(x, y, 2.6, 2.2, FUR, { flatten: 0.85 });
    c.px(x + 1, y - 0.5, EYE, FLAT, { bias: 0 });
    c.px(x + 2.4, y + 0.5, NOSE, FLAT, { bias: 1 });
  };
  const tail = (x: number, y: number) => {
    c.part();
    c.ellipse(x, y, 1.4, 1.3, FUR_WHITE, { flatten: 0.8 });
  };
  if (pose === 'sit' || pose === 'twitch') {
    tail(3.2, f - 4);
    body(7.5, f - 4.5, 4.6, 3.4);
    c.part();
    c.ellipse(6, f - 2.5, 3, 2.3, FUR, { flatten: 0.8 });
    c.px(11, f - 1, FUR, UP, { bias: -1 });
    head(11.5, f - 8, 0, pose === 'twitch' ? 1.5 : 0);
  } else if (pose === 'crouch' || pose === 'land') {
    tail(2.8, f - 3);
    body(7.5, f - 3, 5, 2.8);
    c.px(pose === 'land' ? 12 : 11, f - 0.5, FUR, UP, { bias: -1 });
    head(12, f - 5.5, 1.8);
  } else {
    // Mid-leap: stretched out long, hind legs kicked back.
    tail(2.5, f - 7);
    c.part();
    c.capsule(4.5, f - 5.5, 1.5, f - 3, 1, 0.7, FUR);
    body(8, f - 7, 5.6, 2.6);
    c.part();
    c.capsule(11, f - 6, 13.5, f - 4.5, 0.8, 0.6, FUR);
    head(13, f - 10, 2.6);
  }
  return c;
}

// ---------------------------------------------------------------- butterflies and moths

export const FLY_W = 14;
export const FLY_H = 12;
/** How wide the wings open by frame (open to folded). */
const FLAP = [1, 0.62, 0.28];
/** Their looks: three by day, two glowing ones and a moth by night. */
export const FLIES = { d: WING_SKY, y: WING_SUN, p: WING_ROSE, t: WING_TEAL, v: WING_VIOLET, m: WING_MOTH } as const;
export type FlyKind = keyof typeof FLIES;

function flyFrame(kind: FlyKind, f: number): PixelCanvas {
  const c = new PixelCanvas(FLY_W, FLY_H);
  const m = FLIES[kind];
  const sp = FLAP[f];
  const cx = FLY_W / 2;
  const moth = kind === 'm';
  // Seen from above: the forewings bigger, the hindwings tucked behind them.
  for (const side of [-1, 1]) {
    c.part();
    const hx = cx + side * (moth ? 1.8 : 1.6) * sp;
    c.ellipse(hx, 7.2, Math.max(0.6, (moth ? 2 : 1.8) * sp), moth ? 1.8 : 1.6, m, { flatten: 0.6, bias: -1 });
    c.part();
    const fx = cx + side * (moth ? 2.6 : 2.7) * sp;
    c.ellipse(fx, 4.6, Math.max(0.6, (moth ? 2.8 : 2.8) * sp), moth ? 2.2 : 2.4, m, { flatten: 0.6, bias: side < 0 ? 1 : 0 });
    // An eye on each forewing, a dark rim on the butterflies.
    if (!moth && sp > 0.5) {
      c.px(fx + side * 0.8, 4, m, UP, { bias: 3 });
      c.px(fx + side * 2.2, 3.5, m, FLAT, { bias: -3 });
    }
  }
  c.part();
  for (let y = 3; y <= 8; y++) c.px(cx - 0.5, y, BODY, cyl(0), { bias: y === 3 ? 2 : 0 });
  c.px(cx - 1.5, 2, BODY, FLAT, { bias: moth ? 2 : 1 });
  c.px(cx + 0.5, 2, BODY, FLAT, { bias: moth ? 2 : 1 });
  if (moth) {
    c.px(cx - 2.5, 1, BODY, FLAT, { bias: 2 });
    c.px(cx + 1.5, 1, BODY, FLAT, { bias: 2 });
  }
  return c;
}

// ---------------------------------------------------------------- the sheets

export function lumenSheets(): SheetDef[] {
  const grass: SheetDef['frames'] = [];
  for (let v = 0; v < GRASS_LOOKS; v++) for (let f = 0; f < GRASS_SWAY.length; f++) grass.push({ name: `g${v}_${f}`, draw: () => grassFrame(v, f) });
  const willow: SheetDef['frames'] = [];
  for (let v = 0; v < WILLOWS.length; v++) for (let f = 0; f < WILLOW_SWAY.length; f++) willow.push({ name: `w${v}_${f}`, draw: () => willowFrame(v, f) });
  const flies: SheetDef['frames'] = [];
  for (const k of Object.keys(FLIES) as FlyKind[]) for (let f = 0; f < FLAP.length; f++) flies.push({ name: `${k}${f}`, draw: () => flyFrame(k, f) });
  return [
    {
      key: 'lumen_grass',
      w: GRASS_W,
      h: GRASS_H,
      footX: GRASS_W / 2,
      footY: GRASS_FOOT_Y,
      frames: grass,
      anims: Array.from({ length: GRASS_LOOKS }, (_, v) => ({ name: `sway${v}`, frames: [`g${v}_0`, `g${v}_1`, `g${v}_2`, `g${v}_1`], fps: 2.2, loop: true })),
    },
    { key: 'lumen_bloom', w: BLOOM_W, h: BLOOM_H, footX: BLOOM_W / 2, footY: BLOOM_FOOT_Y, frames: BLOOMS.map((name) => ({ name, draw: () => bloomFrame(name) })), glows: true },
    { key: 'lumen_reed', w: REED_W, h: REED_H, footX: REED_W / 2, footY: REED_FOOT_Y, frames: [0, 1, 2].map((v) => ({ name: `e${v}`, draw: () => reedFrame(v) })), glows: true },
    { key: 'lumen_shroom', w: SHROOM_W, h: SHROOM_H, footX: SHROOM_W / 2, footY: SHROOM_FOOT_Y, frames: [0, 1, 2].map((v) => ({ name: `m${v}`, draw: () => shroomFrame(v) })), glows: true },
    { key: 'lumen_rock', w: ROCK_W, h: ROCK_H, footX: ROCK_W / 2, footY: ROCK_FOOT_Y, frames: [0, 1, 2].map((v) => ({ name: `r${v}`, draw: () => rockFrame(v) })), glows: true },
    {
      key: 'lumen_willow',
      w: WILLOW_W,
      h: WILLOW_H,
      footX: WILLOW_W / 2,
      footY: WILLOW_FOOT_Y,
      frames: willow,
      anims: WILLOWS.map((_, v) => ({ name: `sway${v}`, frames: [`w${v}_0`, `w${v}_1`, `w${v}_2`, `w${v}_1`], fps: 1.3, loop: true })),
      glows: true,
    },
    { key: 'lumen_stone', w: STONE_W, h: STONE_H, footX: STONE_W / 2, footY: STONE_FOOT_Y, frames: STONES.map((_, v) => ({ name: `s${v}`, draw: () => stoneFrame(v) })), glows: true },
    { key: 'lumen_bench', w: BENCH_W, h: BENCH_H, footX: BENCH_W / 2, footY: BENCH_FOOT_Y, frames: [0, 1].map((v) => ({ name: `b${v}`, draw: () => benchFrame(v) })), glows: true },
    { key: 'lumen_shrine', w: SHRINE_W, h: SHRINE_H, footX: SHRINE_W / 2, footY: SHRINE_FOOT_Y, frames: [{ name: 'h0', draw: shrineFrame }], glows: true },
    {
      key: 'lumen_hare',
      w: HARE_W,
      h: HARE_H,
      footX: HARE_W / 2,
      footY: HARE_FOOT_Y,
      frames: [
        { name: 'sit', draw: () => hareFrame('sit') },
        { name: 'twitch', draw: () => hareFrame('twitch') },
        { name: 'crouch', draw: () => hareFrame('crouch') },
        { name: 'leap', draw: () => hareFrame('leap') },
        { name: 'land', draw: () => hareFrame('land') },
      ],
      anims: [
        { name: 'hop', frames: ['crouch', 'leap', 'land'], fps: 9, loop: true },
        { name: 'idle', frames: ['sit', 'sit', 'sit', 'twitch', 'sit', 'sit', 'crouch', 'sit'], fps: 3, loop: true },
      ],
    },
    { key: 'lumen_fly', w: FLY_W, h: FLY_H, footX: FLY_W / 2, footY: FLY_H / 2, frames: flies, glows: true },
  ];
}
