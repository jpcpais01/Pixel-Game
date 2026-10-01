// The pause menu's art: a framed panel with gold studs at its corners, a
// header band for the title and gold dividers between its parts, and the
// little icons beside each of its rows. Painted pixel by pixel on demand and
// cached by key.

import Phaser from 'phaser';
import { Bitmap, bayer, mix } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';

const INK = hex('#0b0818');
const TOP = hex('#2d2358');
const BOTTOM = hex('#120d26');
const HEAD_TOP = hex('#3e3078');
const HEAD_BOTTOM = hex('#2a2056');
const RIM = hex('#4a3a7c');
const RIM_LIT = hex('#7a68b8');
const INNER = hex('#1c1638');
const GOLD = hex('#ffd970');
const GOLD_MID = hex('#d89a3c');
const GOLD_DARK = hex('#8a5424');

export interface Divider {
  y: number;
  /** A gold line with a jewel at its middle; a plain one is a faint groove between groups of rows. */
  gold: boolean;
}

/**
 * A menu panel: a dithered dusk fill, a two-tone rim inside a dark outline,
 * a thin inner line, gold studs in the corners, a lighter header band down to
 * `head` px and dividers across. Returns the texture's key.
 */
export function ornatePanel(scene: Phaser.Scene, name: string, w: number, h: number, head: number, dividers: Divider[]): string {
  const key = `ornate_${name}_${w}x${h}_${head}_${dividers.map((d) => `${d.y}${d.gold ? 'g' : ''}`).join('.')}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      // Cut corners, two pixels deep.
      if (ex + ey <= 1) continue;
      if (ex === 0 || ey === 0 || ex + ey === 2) b.set(x, y, INK);
      else if (ex === 1 || ey === 1) b.set(x, y, y <= 1 || x <= 1 ? RIM_LIT : RIM);
      else if (ex === 2 || ey === 2) b.set(x, y, INK, 230);
      else if (ex === 4 || ey === 4) b.set(x, y, INNER, 240);
      else {
        let c: RGB;
        if (y < head) {
          const f = (y - 3) / Math.max(1, head - 3);
          c = mix(HEAD_TOP, HEAD_BOTTOM, Math.min(1, Math.floor(f * 3 + bayer(x, y)) / 3));
          if (y === 3) c = mix(c, RIM_LIT, 0.35);
        } else {
          const f = (y - head) / Math.max(1, h - head - 4);
          c = mix(TOP, BOTTOM, Math.min(1, Math.floor(f * 5 + bayer(x, y)) / 5));
        }
        b.set(x, y, c, 238);
      }
    }
  }
  const line = (y: number, x0: number, x1: number, c: RGB, a = 255) => {
    for (let x = x0; x <= x1; x++) b.set(x, y, c, a);
  };
  for (const d of dividers) {
    const cx = Math.floor(w / 2);
    if (!d.gold) {
      line(d.y, 14, w - 15, INK, 150);
      line(d.y + 1, 14, w - 15, RIM_LIT, 60);
      continue;
    }
    // A gold rule with dark under it, tapering to dots at its ends, and a jewel in the middle.
    line(d.y, 16, w - 17, GOLD_MID);
    line(d.y - 1, 16, w - 17, GOLD, 90);
    line(d.y + 1, 16, w - 17, INK, 200);
    for (const s of [-1, 1]) {
      const e = s < 0 ? 16 : w - 17;
      b.set(e + s * 2, d.y, GOLD_MID);
      b.set(e + s * 4, d.y, GOLD_DARK);
    }
    jewel(b, cx, d.y);
  }
  // Studs in the four corners.
  for (const [sx, sy] of [[5, 5], [w - 6, 5], [5, h - 6], [w - 6, h - 6]]) stud(b, sx, sy);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A gold diamond with a violet stone, centred on (cx, cy). */
function jewel(b: Bitmap, cx: number, cy: number): void {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const r = Math.abs(dx) + Math.abs(dy);
      if (r > 3) continue;
      if (r === 3) b.set(cx + dx, cy + dy, INK);
      else if (r === 2) b.set(cx + dx, cy + dy, dy < 0 || (dy === 0 && dx < 0) ? GOLD : GOLD_DARK);
      else if (r === 1) b.set(cx + dx, cy + dy, dy < 0 || dx < 0 ? hex('#c8a8ff') : hex('#6a46c8'));
      else b.set(cx, cy, hex('#ffffff'));
    }
  }
}

/** A round gold stud, lit from the top left. */
function stud(b: Bitmap, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const r = dx * dx + dy * dy;
      if (r > 5) continue;
      if (r >= 4) b.set(cx + dx, cy + dy, INK);
      else b.set(cx + dx, cy + dy, dx + dy < -1 ? hex('#fff0b0') : dx + dy < 1 ? GOLD : GOLD_MID);
    }
  }
}

// Icons: 7 px grids. Capitals are the icon's body and get a dark outline;
// small letters are drawn as they are (rays, glints, motion lines).
const ICON_ART: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  bright: {
    rows: ['..YYD..', '.WYYDD.', 'YWYYDDD', 'YYYYDDD', 'YYYYDDD', '.YYYDD.', '..YYD..'],
    pal: { Y: '#ffe08a', W: '#fffbe0', D: '#6a5aa8' },
  },
  music: {
    rows: ['..CCCCC', '..CCCCC', '..C...C', '..C...C', 'CCC.CCC', 'CCC.CCC', 'BB..BB.'],
    pal: { C: '#6fe4ff', B: '#2a9ac8' },
  },
  sfx: {
    rows: ['...G...', '..GG.g.', 'GGGG..g', 'GGGG..g', 'GGGG..g', '..GG.g.', '...G...'],
    pal: { G: '#9dffb0', g: '#9dffb0' },
  },
  fps: {
    rows: ['.....P.', '.....P.', '...P.P.', '...P.P.', '.P.P.P.', '.P.P.P.', 'PPPPPPP'],
    pal: { P: '#ff9a8a' },
  },
  gfx: {
    rows: ['.......', '.AABBB.', 'AABBBCC', '.ABBBC.', '..ABC..', '...B...', '.......'],
    pal: { A: '#ffffff', B: '#b48aff', C: '#6a46c8' },
  },
  map: {
    rows: ['..RRR..', '.RGGGR.', 'RGGHGGR', 'RGHWHGR', 'RGGHGGR', '.RGGGR.', '..RRR..'],
    pal: { R: '#e0a848', G: '#4a9a48', H: '#7ac868', W: '#ffffff' },
  },
  shake: {
    rows: ['.......', 'l.SSS.l', '.lSQSl.', 'l.SQS.l', '.lSSSl.', '.......', '.......'],
    pal: { S: '#ffb070', Q: '#ffe0b0', l: '#ffb070' },
  },
  zoom: {
    rows: ['.MMM...', 'MGGWM..', 'MGGGM..', 'MGGGM..', '.MMMH..', '....HH.', '.....HH'],
    pal: { M: '#c9cce4', G: '#4a6ab8', W: '#ffffff', H: '#c88a48' },
  },
  pointer: {
    rows: ['A......', 'AA.....', 'AAA....', 'AAAA...', 'AAAAA..', 'AA.....', '..A....'],
    pal: { A: '#ffffff' },
  },
};

/** An icon for a menu row (one of ICON_ART's names), 9 px square with its outline. Returns the texture's key. */
export function menuIcon(scene: Phaser.Scene, name: string): string {
  const key = `micon_${name}`;
  if (scene.textures.exists(key)) return key;
  const art = ICON_ART[name];
  const b = new Bitmap(9, 9);
  const body = (x: number, y: number) => {
    const ch = art.rows[y - 1]?.[x - 1];
    return !!ch && ch >= 'A' && ch <= 'Z';
  };
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const ch = art.rows[y - 1]?.[x - 1];
      if (ch && ch !== '.' && ch !== ' ') b.set(x, y, hex(art.pal[ch]));
      else if (body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)) b.set(x, y, INK);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}
