import type { Pal } from './ink';
import type { IconPainter } from './types';

// 16x16 icons for the Special button, one per Special, painted in the worn
// look's colours. The button draws them additively, so black is empty.

type Put = (x: number, y: number, c: number) => void;

const disc = (put: Put, cx: number, cy: number, r: number, c: number) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) put(x, y, c);
};
const ellipse = (put: Put, cx: number, cy: number, rx: number, ry: number, w: number, c: number) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.abs(Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) - 1) < w) put(x, y, c);
};
const seg = (put: Put, x0: number, y0: number, x1: number, y1: number, c: number) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
};

export const singularityIcon: IconPainter = (put, p) => {
  for (let arm = 0; arm < 3; arm++) {
    for (let k = 0; k < 14; k++) {
      const f = k / 14;
      const a = (arm * Math.PI * 2) / 3 + f * 3.2;
      const r = 7.5 * (1 - f) + 3;
      put(Math.round(8 + Math.cos(a) * r - 0.5), Math.round(8 + Math.sin(a) * r - 0.5), f > 0.6 ? p.hot : f > 0.3 ? p.mid : p.deep);
    }
  }
  ellipse(put, 8, 8, 2.8, 2.8, 0.3, p.core);
};

export const infernoIcon: IconPainter = (put, p) => {
  const flame = (x: number, base: number, h: number) => {
    for (let i = 0; i < h; i++) {
      const w = Math.round((1 - i / h) * (h / 3.2));
      for (let dx = -w; dx <= w; dx++) put(x + dx, base - i, Math.abs(dx) < w * 0.4 && i < h * 0.6 ? p.core : Math.abs(dx) < w * 0.8 ? p.hot : p.mid);
    }
    put(x, base - h, p.deep);
  };
  flame(3, 15, 5);
  flame(7, 13, 8);
  flame(12, 11, 11);
  seg(put, 0, 15, 15, 12, p.deep);
};

export const skybreakerIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 13.5, 7, 2, 0.22, p.mid);
  for (let y = 5; y <= 14; y++) {
    const hw = y > 11 ? 0 : 1;
    for (let dx = -hw; dx <= hw; dx++) put(8 + dx, y, dx === 0 ? p.core : p.hot);
  }
  seg(put, 4, 4, 12, 4, p.mid);
  seg(put, 5, 3, 11, 3, p.hot);
  seg(put, 8, 0, 8, 2, p.deep);
  for (const [x, y] of [[3, 7], [13, 7], [2, 11], [14, 11]]) put(x, y, p.deep);
};

/** The Crown of Kings: a great crown standing on a ring of light, a pillar rising from its middle point. */
export const kingsCrownIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 13, 7, 2.2, 0.22, p.mid);
  for (let x = 2; x <= 13; x++) {
    put(x, 11, p.hot);
    put(x, 10, p.mid);
    put(x, 9, x === 7 || x === 8 ? p.core : p.hot);
  }
  for (const [x, h] of [[2, 4], [5, 3], [7, 5], [8, 5], [10, 3], [13, 4]] as const) for (let i = 1; i <= h; i++) put(x, 9 - i, i === h ? p.core : p.hot);
  for (let y = 0; y <= 2; y++) {
    put(7, y, p.deep);
    put(8, y, p.deep);
  }
};

export const heavensLightIcon: IconPainter = (put, p) => {
  for (let y = 0; y <= 12; y++) for (let x = 5; x <= 10; x++) put(x, y, x === 7 || x === 8 ? p.core : x === 6 || x === 9 ? p.hot : p.mid);
  ellipse(put, 8, 12.5, 7, 2.4, 0.2, p.hot);
  ellipse(put, 8, 12.5, 4.5, 1.5, 0.25, p.deep);
  for (const [x, y] of [[2, 3], [13, 5], [3, 8], [12, 1]]) put(x, y, p.hot);
};

export const sunWrathIcon: IconPainter = (put, p) => {
  disc(put, 8, 4, 2.6, p.core);
  ellipse(put, 8, 4, 3.4, 3.4, 0.18, p.hot);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(Math.round(8 + Math.cos(a) * 5 - 0.5), Math.round(4 + Math.sin(a) * 5 - 0.5), p.mid);
  }
  seg(put, 6, 7, 2, 14, p.hot);
  seg(put, 8, 8, 8, 15, p.core);
  seg(put, 10, 7, 14, 14, p.hot);
  for (const x of [2, 8, 14]) put(x, x === 8 ? 15 : 14, p.deep);
};

export const saberCycloneIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 8, 7, 5, 0.12, p.deep);
  ellipse(put, 8, 8, 5.2, 3.6, 0.12, p.mid);
  seg(put, 4, 12, 12, 3, p.hot);
  seg(put, 5, 12, 12, 4, p.core);
  seg(put, 2, 14, 4, 12, 0xa0a4ac);
};

export const dragonRushIcon: IconPainter = (put, p) => {
  for (let x = 0; x < 13; x++) {
    const y = 12 - x * 0.7 + Math.sin(x * 0.9) * 1.6;
    const w = x / 6;
    for (let o = -w; o <= w; o += 0.5) put(x, Math.round(y + o), Math.abs(o) < 0.6 ? p.core : Math.abs(o) < 1.2 ? p.hot : p.mid);
  }
  seg(put, 12, 3, 15, 1, p.hot);
  seg(put, 12, 5, 15, 5, p.hot);
  disc(put, 12.5, 4, 1.5, p.core);
};

export const mountainIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 12, 7.5, 2.5, 0.18, p.mid);
  const spike = (x: number, base: number, h: number) => {
    for (let i = 0; i < h; i++) {
      const w = Math.floor((1 - i / h) * 2.5);
      for (let dx = -w; dx <= w; dx++) put(x + dx, base - i, dx < 0 ? 0xd8ccb4 : dx === 0 ? 0x9a8a74 : 0x5e5044);
      put(x - w, base - i, i > h / 2 ? p.hot : p.mid);
    }
    put(x, base - h, p.core);
  };
  spike(4, 12, 6);
  spike(8, 11, 9);
  spike(12, 12, 6);
};

export const pestilenceIcon: IconPainter = (put, p) => {
  disc(put, 5, 8, 3.5, p.mid);
  disc(put, 10, 7, 4, p.mid);
  disc(put, 8, 10, 3.5, p.deep);
  disc(put, 9, 5.5, 2, p.hot);
  disc(put, 4.5, 7, 1.3, p.hot);
  ellipse(put, 3, 13, 1.5, 1.5, 0.35, p.hot);
  ellipse(put, 12, 13, 1.2, 1.2, 0.4, p.core);
  put(9, 5, p.core);
};

export const chemBombIcon: IconPainter = (put, p) => {
  ellipse(put, 10, 11.5, 5.5, 2.4, 0.2, p.mid);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) put(5 + dx + Math.round(dy * 0.4), 5 + dy, Math.abs(dy) === 3 ? 0xc8ccc0 : dy === 0 ? p.deep : dx < 0 ? p.core : p.hot);
  disc(put, 10, 9, 2, p.core);
  for (const [x, y] of [[13, 7], [8, 6], [14, 11], [6, 12]]) put(x, y, p.hot);
};

export const greatArrowIcon: IconPainter = (put, p) => {
  seg(put, 1, 14, 12, 3, p.hot);
  seg(put, 2, 14, 12, 4, p.mid);
  for (const [x, y] of [[13, 2], [14, 1], [12, 2], [13, 3], [11, 2], [13, 4], [10, 2], [13, 5]]) put(x, y, x + y < 16 ? p.core : p.hot);
  seg(put, 1, 11, 3, 13, p.deep);
  seg(put, 4, 14, 2, 12, p.deep);
  for (const [x, y] of [[4, 8], [7, 12], [9, 9]]) put(x, y, p.mid);
};

export const fanIcon: IconPainter = (put, p) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    for (let r = 3; r <= 7; r++) put(Math.round(7.5 + ux * r), Math.round(7.5 + uy * r), r >= 6 ? p.core : r >= 5 ? p.hot : p.deep);
  }
  put(7, 7, p.mid);
  put(8, 8, p.mid);
};

export const eclipseIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 8, 6, 6, 0.1, p.hot);
  ellipse(put, 8, 8, 7, 7, 0.07, p.deep);
  seg(put, 4, 4, 12, 12, p.core);
  seg(put, 12, 4, 4, 12, p.core);
  seg(put, 5, 4, 12, 11, p.mid);
  seg(put, 11, 4, 4, 11, p.mid);
};

export const soulStormIcon: IconPainter = (put, p) => {
  for (let k = 0; k < 26; k++) {
    const a = k * 0.5;
    const r = 2 + k * 0.23;
    put(Math.round(8 + Math.cos(a) * r - 0.5), Math.round(8 + Math.sin(a) * r * 0.8 - 0.5), k % 5 === 0 ? p.core : k % 2 ? p.mid : p.deep);
  }
  for (let dy = -2; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(8 + dx, 7 + dy, p.core);
  put(7, 6, 0);
  put(9, 6, 0);
};

export const bloodMoonIcon: IconPainter = (put, p) => {
  disc(put, 8, 5, 4.2, p.mid);
  disc(put, 6.5, 3.8, 1.6, p.hot);
  put(9, 6, p.deep);
  put(10, 4, p.deep);
  ellipse(put, 8, 5, 4.6, 4.6, 0.1, p.hot);
  for (const x of [3, 8, 13]) {
    seg(put, x, 11, x, 13, p.hot);
    put(x, 14, p.core);
  }
};

export const encoreIcon: IconPainter = (put, p) => {
  // Two beamed notes, a ring of light turning round them.
  ellipse(put, 8, 8, 7, 5.5, 0.08, p.deep);
  disc(put, 5, 11, 1.8, p.hot);
  disc(put, 10.5, 10, 1.8, p.hot);
  put(4, 10, p.core);
  put(10, 9, p.core);
  seg(put, 6, 4, 6, 11, p.mid);
  seg(put, 12, 3, 12, 10, p.mid);
  seg(put, 6, 4, 12, 3, p.core);
  seg(put, 6, 5, 12, 4, p.hot);
  for (const [x, y] of [[1, 8], [15, 7], [8, 1], [8, 14]]) put(x, y, p.core);
};

export const thunderIcon: IconPainter = (put, p) => {
  // A drum's lit head, rings of sound rolling out round it.
  ellipse(put, 8, 10, 3.2, 1.6, 0.35, p.core);
  disc(put, 8, 10, 1.4, p.hot);
  ellipse(put, 8, 10, 5.4, 3.2, 0.12, p.mid);
  ellipse(put, 8, 10, 7.4, 4.6, 0.08, p.deep);
  seg(put, 3, 2, 7, 8, p.hot);
  seg(put, 13, 2, 9, 8, p.hot);
  disc(put, 3, 2, 1.2, p.core);
  disc(put, 13, 2, 1.2, p.core);
};

export const timeStopIcon: IconPainter = (put, p) => {
  // A clock face, its hands stopped at the stroke, frozen sparks round it.
  ellipse(put, 8, 8, 6.4, 6.4, 0.1, p.hot);
  ellipse(put, 8, 8, 5.2, 5.2, 0.06, p.deep);
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    put(Math.round(7.5 + Math.cos(a) * 4.4), Math.round(7.5 + Math.sin(a) * 4.4), h % 3 === 0 ? p.core : p.mid);
  }
  seg(put, 8, 8, 8, 3, p.core);
  seg(put, 8, 8, 11, 8, p.hot);
  put(8, 8, p.core);
  for (const [x, y] of [[1, 2], [14, 1], [15, 13], [0, 12]]) put(x, y, p.core);
};

export const legionIcon: IconPainter = (put, p) => {
  // Hooded figures side by side: himself in front, his echoes fading behind.
  const figure = (cx: number, c: number, e: number) => {
    disc(put, cx, 5, 2.2, c);
    for (let y = 7; y < 15; y++) {
      const w = 1.6 + (y - 7) * 0.35;
      for (let x = Math.round(cx - w); x <= Math.round(cx + w - 1); x++) put(x, y, c);
    }
    put(Math.round(cx - 1), 5, e);
    put(Math.round(cx), 5, e);
  };
  figure(3.5, p.deep, p.mid);
  figure(12.5, p.deep, p.mid);
  figure(8, p.mid, p.core);
  for (let y = 7; y < 15; y++) put(8, y, p.hot);
};

export const finaleIcon: IconPainter = (put, p) => {
  // A giant puppet's sword coming down on a ring, strings running up out of the frame.
  ellipse(put, 8, 12.5, 6.5, 2.4, 0.2, p.mid);
  ellipse(put, 8, 12.5, 3.6, 1.2, 0.3, p.deep);
  seg(put, 8, 1, 8, 11, p.core);
  seg(put, 9, 1, 9, 10, p.hot);
  seg(put, 5, 3, 12, 3, p.hot);
  for (const x of [2, 14]) for (let y = 0; y < 7; y += 2) put(x, y, p.mid);
  for (const [x, y] of [[4, 9], [12, 9], [3, 13], [13, 13]]) put(x, y, p.core);
};

export const puppetMasterIcon: IconPainter = (put, p) => {
  // A cross of light, strings from it down to two foes pulled together.
  seg(put, 3, 2, 13, 2, p.core);
  seg(put, 8, 0, 8, 4, p.hot);
  seg(put, 4, 3, 4, 9, p.mid);
  seg(put, 12, 3, 12, 9, p.mid);
  disc(put, 4.5, 11.5, 2.6, p.hot);
  disc(put, 11.5, 11.5, 2.6, p.hot);
  put(4, 11, p.core);
  put(11, 11, p.core);
  for (const [x, y] of [[8, 9], [8, 12], [7, 11], [9, 11]]) put(x, y, p.core);
};

/** Paint an icon into RGBA pixels (the colours of `p`). */
export function paintIcon(icon: IconPainter, p: Pal): Uint8ClampedArray {
  const px = new Uint8ClampedArray(16 * 16 * 4);
  icon((x, y, c) => {
    if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
    const i = (y * 16 + x) * 4;
    px[i] = (c >> 16) & 255;
    px[i + 1] = (c >> 8) & 255;
    px[i + 2] = c & 255;
    px[i + 3] = c ? 255 : 0;
  }, p);
  return px;
}

export const skyQuakeIcon: IconPainter = (put, p) => {
  // A storm cloud pouring blades of rain on a foe thrown into the air.
  for (let y = 0; y < 4; y++) for (let x = 2; x < 14; x++) if (Math.hypot((x + 0.5 - 8) / 6, (y + 0.5 - 2) / 2.2) <= 1) put(x, y, y === 3 ? p.mid : p.deep);
  for (const x of [3, 6, 9, 12]) for (let y = 5; y < 5 + (x % 2 ? 5 : 7); y++) put(x, y, y > 7 ? p.hot : p.mid);
  seg(put, 10, 3, 8, 7, p.core);
  seg(put, 8, 7, 10, 8, p.core);
  seg(put, 10, 8, 8, 12, p.core);
  ellipse(put, 8, 14, 5, 1.4, 0.3, p.hot);
};

export const hundredCutsIcon: IconPainter = (put, p) => {
  // Streaks crossing and crossing again.
  seg(put, 1, 12, 14, 3, p.hot);
  seg(put, 2, 3, 13, 13, p.mid);
  seg(put, 0, 8, 15, 7, p.core);
  seg(put, 6, 0, 9, 15, p.deep);
  disc(put, 8, 7.5, 1.3, p.core);
};

export const wrathIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 13.5, 7, 2, 0.24, p.deep);
  // Three roots bursting up and curling out, thorns along them.
  const root = (x0: number, lean: number, h: number) => {
    for (let i = 0; i <= h; i++) {
      const f = i / h;
      const x = x0 + lean * f * f * 4 + Math.sin(f * 5) * 0.6;
      const w = f < 0.5 ? 1 : 0;
      for (let dx = -w; dx <= w; dx++) put(Math.round(x + dx), 14 - i, f > 0.85 ? p.core : dx < 0 || w === 0 ? p.hot : p.mid);
      if (i % 3 === 1 && i < h - 1) put(Math.round(x + (i % 2 ? 2 : -2)), 13 - i, p.deep);
    }
  };
  root(4, -0.8, 8);
  root(12, 0.8, 9);
  root(8, 0.4, 13);
};

export const stampedeIcon: IconPainter = (put, p) => {
  // A spirit stag charging, streaks of speed behind it.
  seg(put, 0, 6, 4, 6, p.deep);
  seg(put, 0, 9, 5, 9, p.mid);
  seg(put, 0, 12, 4, 12, p.deep);
  disc(put, 7.5, 12, 2.4, p.mid);
  seg(put, 7, 11, 10, 9, p.mid);
  disc(put, 11, 9, 2.2, p.hot);
  seg(put, 12, 10, 15, 11, p.hot);
  seg(put, 12, 11, 14, 12, p.mid);
  put(12, 8, p.core);
  seg(put, 10, 7, 8, 2, p.core);
  seg(put, 9, 4, 6, 3, p.hot);
  seg(put, 11, 7, 13, 2, p.core);
  seg(put, 12, 4, 15, 3, p.hot);
};

export const odinIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 13.5, 6.5, 2, 0.25, p.mid);
  for (let y = 0; y <= 6; y++) {
    put(7, y, p.hot);
    put(8, y, p.mid);
  }
  // Wings spread from the socket.
  seg(put, 6, 7, 2, 4, p.hot);
  seg(put, 6, 8, 3, 6, p.mid);
  seg(put, 9, 7, 13, 4, p.hot);
  seg(put, 9, 8, 12, 6, p.mid);
  // The head, point down into the ground.
  for (let y = 7; y <= 14; y++) {
    const hw = y < 11 ? 0.6 + (y - 7) * 0.45 : (14 - y) * 0.6;
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      if (Math.abs(dx) <= hw + 0.1) put(x, y, Math.abs(dx) < 0.6 ? p.core : p.hot);
    }
  }
};

export const asgardIcon: IconPainter = (put, p) => {
  ellipse(put, 8, 12.5, 7, 2.6, 0.2, p.mid);
  const zig = (pts: [number, number][], c: number) => {
    for (let i = 0; i < pts.length - 1; i++) seg(put, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c);
  };
  zig([[5, 0], [3, 4], [6, 5], [4, 11]], p.core);
  zig([[6, 0], [4, 4], [7, 5], [5, 10]], p.hot);
  zig([[12, 1], [10, 5], [13, 6], [11, 11]], p.hot);
  zig([[13, 1], [11, 5], [14, 6], [12, 10]], p.deep);
  put(4, 11, p.core);
  put(11, 11, p.core);
};

/** Siege Mode: a planted turret on splayed legs, a fan of fire from its guns. */
export const siegeIcon: IconPainter = (put, p) => {
  for (let x = 5; x <= 10; x++) for (let y = 6; y <= 9; y++) put(x, y, y === 6 ? p.hot : p.mid);
  seg(put, 6, 10, 2, 14, p.deep);
  seg(put, 9, 10, 13, 14, p.deep);
  seg(put, 7, 10, 7, 14, p.deep);
  for (const [dx, dy] of [[1, -0.45], [1, 0], [1, 0.45]]) {
    for (let k = 1; k <= 4; k++) put(Math.round(10 + dx * k), Math.round(7.5 + dy * k * 3), k === 1 ? p.core : k < 3 ? p.hot : p.mid);
  }
  put(4, 5, p.deep);
  put(4, 4, p.mid);
};

/** Swarm Protocol: an open core and a cloud of tiny drones pouring out of it. */
export const swarmIcon: IconPainter = (put, p) => {
  disc(put, 8, 9, 2.4, p.core);
  ellipse(put, 8, 9, 3.6, 3.6, 0.22, p.mid);
  const pts: [number, number][] = [[3, 3], [6, 2], [11, 2], [13, 5], [2, 7], [14, 9], [3, 12], [12, 13], [7, 14], [10, 4], [5, 5]];
  for (const [x, y] of pts) {
    put(x, y, p.hot);
    put(x + 1, y, p.deep);
  }
};

/** Haunted House: a crooked house of ghost-light, its windows lit. */
export const hauntIcon: IconPainter = (put, p) => {
  seg(put, 3, 14, 3, 7, p.hot);
  seg(put, 13, 14, 13, 7, p.hot);
  seg(put, 3, 14, 13, 14, p.mid);
  seg(put, 2, 7, 8, 1, p.hot);
  seg(put, 14, 7, 8, 1, p.hot);
  seg(put, 11, 4, 11, 1, p.mid);
  for (const [x, y] of [[5, 9], [10, 9]]) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(x + dx, y + dy, p.core);
  seg(put, 7, 14, 7, 11, p.deep);
  seg(put, 9, 14, 9, 11, p.deep);
  put(8, 11, p.deep);
};

/** Dead of Night: a crescent moon over a lantern's glow. */
export const nightIcon: IconPainter = (put, p) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const inMoon = Math.hypot(x - 5, y - 5) <= 4.2 && Math.hypot(x - 7, y - 3.8) > 3.6;
      if (inMoon) put(x, y, p.mid);
    }
  }
  seg(put, 11, 6, 11, 8, p.deep);
  for (let y = 9; y <= 13; y++) for (let x = 9; x <= 13; x++) put(x, y, x === 9 || x === 13 || y === 9 || y === 13 ? p.deep : p.core);
  put(11, 11, 0xffffff);
};

/** Mega Sentry: a great turret on splayed legs, both barrels blazing, a rocket leaving. */
export const megaSentryIcon: IconPainter = (put, p) => {
  seg(put, 6, 10, 2, 15, p.deep);
  seg(put, 9, 10, 13, 15, p.deep);
  seg(put, 7, 10, 7, 15, p.deep);
  for (let y = 5; y <= 10; y++) for (let x = 2; x <= 11; x++) if ((x - 6.5) ** 2 / 20 + (y - 7.5) ** 2 / 8 <= 1) put(x, y, y < 7 ? p.hot : p.mid);
  seg(put, 11, 6, 14, 6, p.hot);
  seg(put, 11, 8, 14, 8, p.hot);
  put(15, 6, p.core);
  put(15, 8, p.core);
  put(15, 7, p.hot);
  seg(put, 9, 3, 13, 1, p.mid);
  put(14, 1, p.core);
  put(8, 3, p.deep);
};

/** Chain Reaction: an atom, three orbits round a bright nucleus. */
export const chainReactionIcon: IconPainter = (put, p) => {
  for (let o = 0; o < 3; o++) {
    const tilt = (o * Math.PI) / 3;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const ex = Math.cos(a) * 6.8;
      const ey = Math.sin(a) * 2.3;
      put(Math.round(8 + ex * Math.cos(tilt) - ey * Math.sin(tilt) - 0.5), Math.round(8 + ex * Math.sin(tilt) + ey * Math.cos(tilt) - 0.5), p.mid);
    }
  }
  disc(put, 8, 8, 2, p.core);
  put(14, 8, p.hot);
  put(4, 3, p.hot);
  put(5, 13, p.hot);
};

export const maelstromIcon: IconPainter = (put, p) => {
  // A whirlpool seen at a slant, its arms spiralling in, and a spout bursting from its eye.
  for (let arm = 0; arm < 3; arm++) {
    for (let k = 0; k <= 18; k++) {
      const f = k / 18;
      const a = (arm * Math.PI * 2) / 3 + f * 4.2;
      const r = 7.2 * (1 - f) + 0.8;
      put(Math.round(8 + Math.cos(a) * r - 0.5), Math.round(12 + Math.sin(a) * r * 0.45 - 0.5), f > 0.7 ? p.hot : f > 0.35 ? p.mid : p.deep);
    }
  }
  for (let y = 2; y <= 11; y++) {
    const w = y < 5 ? 1 : 0;
    for (let dx = -w; dx <= w + 1; dx++) put(7 + dx, y, dx === 0 || dx === 1 ? (y < 6 ? p.core : p.hot) : p.mid);
  }
  for (const [x, y] of [[4, 2], [11, 1], [3, 5], [12, 4]]) put(x, y, p.core);
};

/** Sky Sovereign: a great eagle seen from below, wings spread wide, primaries parted at the tips. */
export const skySovereignIcon: IconPainter = (put, p) => {
  for (let x = 0; x < 16; x++) {
    const d = Math.abs(x + 0.5 - 8);
    if (d < 1.5) continue;
    const top = 6 - d * 0.35;
    const bot = 8.5 - d * 0.05 + (d > 5 && Math.floor(d) % 2 === 0 ? 1.5 : 0);
    for (let y = Math.round(top); y <= Math.round(bot); y++) put(x, y, y === Math.round(top) ? p.hot : d > 6 ? p.deep : p.mid);
  }
  for (let y = 4; y <= 11; y++) {
    put(7, y, y < 6 ? p.core : p.hot);
    put(8, y, y < 6 ? p.core : p.hot);
  }
  put(7, 3, p.core);
  put(8, 3, p.core);
  // The tail's fan.
  for (let x = 5; x <= 10; x++) put(x, 12 + (x === 5 || x === 10 ? 0 : 1), p.mid);
  put(7, 14, p.hot);
  put(8, 14, p.hot);
};

/** King's Roar: a lion's head in its mane, jaws wide, rings of the roar round it. */
export const kingsRoarIcon: IconPainter = (put, p) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const d = Math.hypot(dx, dy);
      const rim = 5.6 + 0.9 * Math.sin(Math.atan2(dy, dx) * 8);
      if (d <= 3.4) put(x, y, p.hot);
      else if (d <= rim) put(x, y, p.mid);
      else if (Math.abs(d - 7.4) < 0.5) put(x, y, (x + y) % 2 ? p.deep : p.mid);
    }
  }
  put(6, 7, p.core);
  put(9, 7, p.core);
  seg(put, 7, 10, 8, 10, p.deep);
  put(7, 11, p.deep);
  put(8, 11, p.deep);
  put(7, 8, p.deep);
  put(8, 8, p.deep);
};

/** Wrath of the Wyrm: a serpent of fire coiled in a ring round a burning heart. */
export const wyrmIcon: IconPainter = (put, p) => {
  for (let i = 0; i < 60; i++) {
    const f = i / 60;
    const a = f * Math.PI * 2.2 - 0.6;
    const r = 6.2 - f * 0.8;
    const x = 8 + Math.cos(a) * r;
    const y = 8.5 + Math.sin(a) * r * 0.8;
    const w = f < 0.9 ? 1.2 - f * 0.8 : 1.4;
    disc(put, x, y, w, f > 0.85 ? p.core : f > 0.5 ? p.hot : p.mid);
  }
  disc(put, 8, 8.5, 1.8, p.hot);
  put(7, 8, p.core);
  put(8, 8, p.core);
  put(3, 2, p.deep);
  put(12, 14, p.deep);
};

export const dominionIcon: IconPainter = (put, p) => {
  // A hooked hand above, holding a foe in the air in a band of dark light, over the pit it will be crushed into.
  ellipse(put, 8, 14.5, 6, 1.4, 0.35, p.deep);
  disc(put, 8, 10.5, 2.4, p.deep);
  put(8, 7, p.deep);
  put(7, 8, p.deep);
  put(9, 8, p.deep);
  for (const x of [4, 12]) for (let y = 6; y <= 9; y++) if (y % 2 === 0) put(x, y, p.mid);
  ellipse(put, 8, 10.5, 4.6, 1.9, 0.3, p.mid);
  for (const [x, y] of [[5, 12], [7, 12], [8, 12], [9, 12], [11, 12]] as const) put(x, y, p.hot);
  put(8, 12, p.core);
  // The hand: a dark palm, knuckles lit, fingers hooked down with bright tips.
  for (let x = 5; x <= 11; x++) for (let y = 1; y <= 2; y++) put(x, y, y === 1 ? p.mid : p.deep);
  put(4, 2, p.mid);
  put(3, 3, p.hot);
  for (const x of [5, 7, 9, 11]) {
    put(x, 3, p.hot);
    put(x, 4, p.hot);
    put(x, 5, p.core);
  }
};

/** Black Powder: a keg on a great bolt, its fuse spitting, a burst behind it. */
export const powderIcon: IconPainter = (put, p) => {
  // The burst's rays behind.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    for (let r = 5; r <= (i % 2 ? 6.5 : 7.5); r += 0.5) put(Math.round(8 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r), r > 6.5 ? p.mid : p.deep);
  }
  // The keg: staves, two hoops, a bung.
  for (let y = 6; y <= 13; y++) {
    const hw = y === 6 || y === 13 ? 2 : 3;
    for (let x = 8 - hw; x <= 7 + hw; x++) put(x, y, y === 7 || y === 12 ? p.deep : x <= 6 ? p.hot : x >= 9 ? p.deep : p.mid);
  }
  // The bolt it rides, and the fuse's spark.
  seg(put, 1, 15, 4, 12, p.mid);
  seg(put, 11, 7, 14, 4, p.hot);
  put(14, 3, p.core);
  put(8, 5, p.hot);
  put(9, 4, p.mid);
  put(10, 3, p.core);
  put(11, 2, p.core);
  put(10, 1, p.hot);
  put(12, 3, p.hot);
};

/** Tempest: a funnel of wind, wide at the top, whirling down to a point. */
export const tempestIcon: IconPainter = (put, p) => {
  for (let k = 0; k < 6; k++) {
    const y = 2 + k * 2.2;
    const r = 6.5 - k * 0.95;
    ellipse(put, 8 + Math.sin(k * 0.9) * 0.8, y, r, Math.max(0.9, r * 0.32), 0.22, k < 2 ? p.core : k < 4 ? p.hot : p.mid);
  }
  put(8, 14, p.mid);
  put(9, 15, p.deep);
  // Leaves caught in it.
  for (const [x, y] of [[2, 5], [13, 8], [4, 11]]) put(x, y, p.deep);
};
