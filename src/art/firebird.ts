// Materials, spell colours, the meteor and its button for the Pyromancer's
// Firebird skin: a priestess of the firebird. The figure is drawn by the
// wizard's rig (wizard.ts) with its `head` set to 'firebird': a crimson hood
// shaped like a bird's crested head, a gold beak over the brow, a crest of
// burning feathers, a mantle of flame feathers from crimson to gold, a robe
// feathered below the belt with tail feathers trailing from the hem, and a
// gilded staff crowned with burning plumes round a white-gold ember.

import { hex, type Material, type RGB } from './pixel';
import { meteorIcon, PYRO_METEOR_H, PYRO_METEOR_HEAD, PYRO_METEOR_W, type SpellColors } from './effects';

const ramp = (...c: string[]): RGB[] => c.map(hex);

/** The hood and robe: crimson, darkening to wine in the folds, flushed orange where it's lit. */
export const FIREBIRD_ROBE: Material = {
  ramp: ramp('#2a0410', '#560a1c', '#8e1424', '#c42a2a', '#ec5a34'),
  outline: hex('#120206'),
  outlineLit: hex('#2a0410'),
};

/** The lining, the hood's opening and the open front: smouldering dark. */
export const FIREBIRD_INNER: Material = {
  ramp: ramp('#160408', '#2c0a10', '#461218', '#62201e'),
  outline: hex('#070103'),
};

/** Burnished gold: the beak, the belt, the trim and the gilded staff. */
export const FIREBIRD_GOLD: Material = {
  ramp: ramp('#5a3208', '#9a6614', '#d8a42a', '#ffd860', '#fff6c0'),
  outline: hex('#1e1002'),
  outlineLit: hex('#2e1a04'),
  shine: true,
};

/** Flame feathers: crimson at the quill, burning out to gold at the tips, and glowing a little. */
export const PLUME: Material = {
  ramp: ramp('#7a0e1a', '#c42a1e', '#f06a1e', '#ffb030', '#ffe680'),
  outline: hex('#2a0406'),
  outlineLit: hex('#3e0a0a'),
  emissive: 0.35,
  shine: true,
};

/** The ember at the staff's head: white-gold fire. */
export const FIREBIRD_EMBER: Material = {
  ramp: ramp('#c84a14', '#ffa830', '#fff0a0', '#ffffff'),
  outline: hex('#3a1004'),
  outlineLit: hex('#4e1806'),
  emissive: 1,
  shine: true,
  noAO: true,
};

// Firebird flame (light-only colours): white-gold at the heart, through gold, to crimson.
export const FIREBIRD_CORE = hex('#fffdf0');
export const FIREBIRD_HOT = hex('#ffec90');
export const FIREBIRD_MID = hex('#ffb83a');
export const FIREBIRD_DEEP = hex('#d8203e');
/** A rose flush for the flecks and the feathers' quills. */
export const FIREBIRD_ROSE = hex('#ff6a8a');

export const FIREBIRD_SPELL: SpellColors = { core: FIREBIRD_CORE, hot: FIREBIRD_HOT, mid: FIREBIRD_MID, deep: FIREBIRD_DEEP, accent: FIREBIRD_ROSE, flame: true, feathers: true };

/** The scorch it leaves: gold embers fading through crimson to wine. */
export const FIREBIRD_EMBERS: [RGB, RGB, RGB] = [[255, 214, 96], [232, 56, 60], [118, 14, 40]];

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// The meteor: the firebird itself plunging head first, wings swept back in a
// burning V and three tail plumes streaming up behind it, each ending in an
// eye of crimson. Same frame as the pyromancer's meteor (its head at
// PYRO_METEOR_HEAD), drawn with normal blending; frames beat the wings and
// ripple the plumes.

const TAIL = ['#fff4c0', '#ffc848', '#f8702a', '#d0203a', '#80102c'];

export function firebirdMeteor(f: number): Uint8ClampedArray {
  const W = PYRO_METEOR_W;
  const H = PYRO_METEOR_H;
  const px = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: string, a = 1) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * W + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = Math.round(a * 255);
  };
  const cx = W / 2;
  const hy = PYRO_METEOR_HEAD;

  // The tail: three plumes rising from the rump, the outer two fanning out as they climb.
  const rump = hy - 5;
  for (const s of [-1, 1, 0]) {
    for (let y = 1; y <= rump; y++) {
      const u = (rump - y) / (rump - 1);
      const x = cx + s * u * 3.4 + Math.sin(y * 0.42 + f * 2.1 + s * 1.9) * (0.4 + u * 1.1);
      const hw = (s === 0 ? 1.5 : 1.1) * (1 - u * 0.45);
      for (let xx = Math.floor(x - hw - 0.5); xx <= Math.ceil(x + hw); xx++) {
        const d = Math.abs(xx + 0.5 - x) / hw;
        if (d > 1) continue;
        // Ragged at the edges, thinning toward the top.
        if (d > 0.6 && hash(xx, y, f + 3) < u * 0.7) continue;
        const band = Math.min(4, Math.floor(u * 3.2 + d * 1.3));
        put(xx, y, TAIL[band], 1 - u * 0.35);
      }
      // The eye near each plume's end: a crimson spot ringed with gold.
      if (Math.abs(u - (s === 0 ? 0.86 : 0.78)) < 0.02) {
        const ex = Math.round(x - 0.5);
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(ex + ox, y + oy, '#ffd860');
        put(ex, y, '#a0102a');
      }
    }
  }

  // Flame wrapping the body.
  for (let y = hy - 9; y <= hy + 4; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - (hy - 2)) * 0.62;
      const rag = Math.hypot(dx, dy) - (hash(Math.floor((Math.atan2(dy, dx) + Math.PI) * 2.2), f, 9) - 0.3) * 1.6;
      if (rag <= 4.4) put(x, y, rag <= 3.2 ? '#ffc848' : '#f8702a', 0.95);
    }
  }

  // The wings: swept up and back from the shoulders in a V, the leading edge
  // white-gold, the flight feathers fanning behind it to crimson tips.
  const flap = [0, 2, -1][f % 3];
  for (const k of [-1, 1]) {
    const sx = cx + k * 1.2;
    const sy = hy - 3;
    const tx = cx + k * 7.4;
    const ty = hy - 13 + flap;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const lx = sx + (tx - sx) * t;
      const ly = sy + (ty - sy) * t;
      // Each feather runs up from the leading edge; longer toward the body, notched between them.
      const chord = 1 + (1 - t) * 4.2 + (i % 3 === 0 ? 1 : 0);
      for (let j = 0; j <= chord; j++) {
        const c = j < 1 ? (t < 0.5 ? '#fffbe0' : '#ffe680') : j < chord * 0.5 ? '#ffb030' : j < chord - 0.8 ? '#f0602a' : '#c01e34';
        put(lx, ly - j, c);
      }
    }
  }

  // The body, then the head and the hooked beak pointing down, a gold crest flicking back off the crown.
  for (let y = hy - 6; y <= hy + 1; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 2.1;
      const dy = (y + 0.5 - (hy - 2.5)) / 3.4;
      const d = dx * dx + dy * dy;
      if (d <= 1) put(x, y, d < 0.35 ? '#ffffff' : d < 0.7 ? '#fff2b0' : '#ffd050');
    }
  }
  for (let y = hy; y <= hy + 3; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 1.7;
      const dy = (y + 0.5 - (hy + 1.6)) / 1.7;
      const d = dx * dx + dy * dy;
      if (d <= 1) put(x, y, d < 0.45 ? '#ffffff' : '#ffe680');
    }
  }
  put(cx - 1, hy + 1, '#a0102a');
  put(cx - 1, hy + 4, '#ffa020');
  put(cx, hy + 4, '#ffb830');
  put(cx, hy + 5, '#c86010');
  put(cx + 1, hy - 1, '#ffb030');
  put(cx + 2, hy - 2, '#f0602a');
  return px;
}

// ---------------------------------------------------------------------------
// The meteor button: the flaming tail, and the firebird at its head with its
// wings swept back.

export function firebirdMeteorIcon(): Uint8ClampedArray {
  const px = meteorIcon(FIREBIRD_SPELL);
  const set = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * 16 + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  // Wings: from the shoulders back toward the tail, gold at the leading edge, crimson at the tips.
  const wings: [number, number, string][] = [
    [6, 8, '#fff2b0'], [7, 7, '#ffd860'], [7, 6, '#ffb030'], [8, 5, '#f0602a'], [8, 4, '#c01e34'], [6, 7, '#ffb030'],
    [8, 10, '#fff2b0'], [9, 10, '#ffd860'], [10, 10, '#ffb030'], [11, 9, '#f0602a'], [12, 9, '#c01e34'], [9, 9, '#ffb030'],
  ];
  for (const [x, y, c] of wings) set(x, y, c);
  // The body and head, white-hot, the beak hooking to the lower left, a dark eye.
  for (const [x, y] of [[6, 10], [5, 11], [6, 11], [5, 10], [7, 9]]) set(x, y, '#ffffff');
  set(4, 12, '#ffe680');
  set(3, 13, '#ffa020');
  set(2, 14, '#c86010');
  set(5, 11, '#a0102a');
  return px;
}
