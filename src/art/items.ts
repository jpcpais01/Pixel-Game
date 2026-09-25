// Item art: 16x16 hotbar icons and the small bottles that lie on the ground
// when a monster drops one. Painted pixel by pixel, lit from the top left,
// in the same style as the ability icons (see effects.ts).

export type PotionKind = 'health' | 'speed';

/** Colour ramps per potion, darkest first: deep, dark, mid, light, highlight. */
const LIQUID: Record<PotionKind, [string, string, string, string, string]> = {
  health: ['#5a0c22', '#a81c3a', '#e8384e', '#ff7a78', '#ffd4c8'],
  speed: ['#0a3a66', '#1a78c0', '#36c2f2', '#9cecff', '#eaffff'],
};
const GLASS = '#8fc0c8';
const GLASS_LIT = '#d8f6f4';
const GLASS_DARK = '#4d7886';
const CORK = '#a9774c';
const CORK_DARK = '#7d4f33';
const CORK_DEEP = '#523023';
const OUTLINE = '#120a14';

/** Paints a `w` x `h` image from hex colours, then rings the shape in an outline. */
function painter(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const n = parseInt(c.slice(1), 16);
    const i = (y * w + x) * 4;
    px[i] = n >> 16;
    px[i + 1] = (n >> 8) & 255;
    px[i + 2] = n & 255;
    px[i + 3] = 255;
  };
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] === 255;
  const outline = (c: string) => {
    const out: [number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) out.push([x, y]);
      }
    }
    for (const [x, y] of out) put(x, y, c);
  };
  /** Draw a character map at (ox, oy); each letter is looked up in `pal`, '.' is empty. */
  const map = (ox: number, oy: number, rows: string[], pal: Record<string, string>) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && put(ox + x, oy + y, pal[ch])));
  };
  return { px, put, outline, map };
}

/** A cork in a short glass neck, centred between columns `x` and `x + 1`. */
function neck(put: (x: number, y: number, c: string) => void, x: number, top: number): void {
  put(x, top, CORK_DARK);
  put(x + 1, top, CORK_DEEP);
  put(x - 1, top + 1, CORK);
  put(x, top + 1, CORK);
  put(x + 1, top + 1, CORK_DARK);
  put(x + 2, top + 1, CORK_DEEP);
  for (let y = top + 2; y <= top + 3; y++) {
    put(x, y, GLASS);
    put(x + 1, y, GLASS_DARK);
  }
}

/** Health potion icon: a round flask of red draught with a heart glowing in it. */
function healthIcon(): Uint8ClampedArray {
  const { px, put, outline } = painter(16, 16);
  const [deep, dark, mid, light, hi] = LIQUID.health;
  const cx = 8;
  const cy = 10.4;
  const r = 5.3;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      if (dy < -2.2) put(x, y, dx + dy < -4.5 ? GLASS_LIT : GLASS);
      else {
        const k = dx + dy * 0.6;
        put(x, y, d > r - 1 && k > 1.2 ? deep : k < -2.6 ? light : k < 0.8 ? mid : dark);
      }
    }
  }
  // The draught's surface catching the light.
  for (let x = 3; x <= 12; x++) if (Math.hypot(x + 0.5 - cx, 8.5 - cy) <= r) put(x, 8, light);
  put(4, 8, hi);
  // A small heart in the middle, pale and warm.
  const heart = ['.#.#.', '#####', '.###.', '..#..'];
  heart.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && put(6 + x, 10 + y, x + y < 2 ? '#ffffff' : hi)));
  // Glints on the glass.
  put(4, 7, '#ffffff');
  put(5, 6, GLASS_LIT);
  neck(put, 7, 1);
  outline(OUTLINE);
  return px;
}

/** Speed potion icon: a slim bottle of crackling blue with a lightning bolt, wind streaking past. */
function speedIcon(): Uint8ClampedArray {
  const { px, put, outline } = painter(16, 16);
  const [deep, dark, mid, light, hi] = LIQUID.speed;
  // Body: columns 6..11, rows 6..14, corners clipped; a shoulder row above.
  for (let y = 5; y <= 14; y++) {
    for (let x = 6; x <= 11; x++) {
      const corner = (y === 5 || y === 14) && (x === 6 || x === 11);
      if (corner) continue;
      if (y <= 6) put(x, y, x <= 7 ? GLASS_LIT : x >= 10 ? GLASS_DARK : GLASS);
      else put(x, y, x === 6 ? light : x === 7 ? mid : x === 11 ? deep : x === 10 ? dark : mid);
    }
  }
  for (let x = 7; x <= 10; x++) put(x, 7, x === 7 ? hi : light);
  // A bolt, top right to bottom left.
  const bolt: [number, number][] = [[9, 8], [8, 9], [9, 9], [8, 10], [7, 11], [8, 11], [7, 12]];
  for (const [x, y] of bolt) put(x, y, y < 10 ? '#fffbd0' : '#ffe04a');
  neck(put, 8, 1);
  outline(OUTLINE);
  // Wind lines streaming off the left, outside the outline.
  put(1, 8, light);
  put(2, 8, hi);
  put(3, 8, hi);
  put(0, 11, mid);
  put(1, 11, light);
  put(2, 11, light);
  put(2, 14, mid);
  put(3, 14, light);
  return px;
}

export const ITEM_ICON_SIZE = 16;

export function potionIcon(kind: PotionKind): Uint8ClampedArray {
  return kind === 'health' ? healthIcon() : speedIcon();
}

/** Ground drops: small enough to sit by a 24x32 hero's boots. */
export const DROP_W = 8;
export const DROP_H = 10;

export function potionDrop(kind: PotionKind): Uint8ClampedArray {
  const { px, outline, map } = painter(DROP_W, DROP_H);
  const [deep, dark, mid, light, hi] = LIQUID[kind];
  const pal = { k: CORK, K: CORK_DARK, g: GLASS_LIT, G: GLASS, n: GLASS_DARK, d: deep, D: dark, m: mid, l: light, h: hi, y: '#ffe04a', w: '#ffffff' };
  const rows =
    kind === 'health'
      ? ['..kK..', '..Gn..', '.gGGn.', 'hllmDd', 'lmwmDd', 'mmmDDd', '.mDDd.']
      : ['.kK...', '.Gn...', 'gGGn..', 'hlmD..', 'lmyD..', 'lyDd..', 'mmDd..'];
  // The slim speed bottle sits one column in, so both stand centred.
  map(kind === 'health' ? 1 : 2, 1, rows, pal);
  outline(OUTLINE);
  return px;
}
