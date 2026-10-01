// The shop's furniture: the jewelled wish buttons, little tags and ribbons,
// gauges, the banner tabs' icons, the rune circle turning on the floor round
// the altar, and the halves of a hatched egg. Flat and unlit like the rest of
// the shop's art (see shop.ts), painted pixel by pixel.

import { Bitmap, bayer, clamp01, mix } from './bitmap';
import { hex, type RGB } from './pixel';

const INK = hex('#0b0818');
const WHITE: RGB = [255, 255, 255];
const GILT = [hex('#fff4bf'), hex('#f4cf6a'), hex('#d69a3a'), hex('#8a4e22')];

/** A wish button's colours: its rim (lit, body, shade) and its glass (top, bottom). */
export interface JewelStyle {
  rim: [RGB, RGB, RGB];
  top: RGB;
  bottom: RGB;
  /** The little gems set in its ends. */
  stud: RGB;
}

/** The single wish: teal glass in rose gold. */
export const JEWEL_TEAL: JewelStyle = { rim: [hex('#ffc8f0'), hex('#d0609e'), hex('#7a2a5a')], top: hex('#2ab0c8'), bottom: hex('#16206a'), stud: hex('#ffb0ec') };
/** Ten wishes: royal violet in gold. */
export const JEWEL_ROYAL: JewelStyle = { rim: [GILT[0], GILT[1], GILT[3]], top: hex('#7a62e8'), bottom: hex('#2a1a78'), stud: hex('#9ff6ff') };

/**
 * A wish button, `w` x `h`: an eight-sided slab of coloured glass in a
 * bevelled metal rim with a gem set in each end, a gloss across its upper
 * half. Pressed (`down`), the glass darkens and the gloss goes.
 */
export function jewelButton(w: number, h: number, st: JewelStyle, down: boolean): Bitmap {
  const b = new Bitmap(w, h);
  const cut = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      const e = Math.min(ex, ey, ex + ey - cut);
      if (e < 0) continue;
      let c: RGB;
      if (e === 0) c = INK;
      else if (e <= 2) {
        const litSide = ey <= ex ? y < h / 2 : x < w / 2;
        c = litSide ? st.rim[e === 1 ? 0 : 1] : st.rim[e === 1 ? 1 : 2];
        if (down) c = mix(c, INK, 0.2);
      } else if (e === 3) c = mix(INK, st.bottom, 0.4);
      else {
        const t = (y - 4) / Math.max(1, h - 9);
        const q = Math.floor(clamp01(t) * 4 + bayer(x, y)) / 4;
        c = mix(st.top, st.bottom, q);
        if (down) c = mix(c, INK, 0.3);
        // The gloss: a pale sheet over the upper part, a bright line along its top.
        else if (y === 4) c = mix(c, WHITE, 0.45);
        else if (y < h * 0.45 && bayer(x, y) < 0.5) c = mix(c, WHITE, 0.14);
        // A shadow inside the bottom of the glass.
        if (h - 1 - y === 4) c = mix(c, INK, 0.35);
      }
      b.set(x, y, c);
    }
  }
  // A gem set in each end of the rim.
  const my = Math.floor(h / 2);
  for (const gx of [2, w - 3]) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        if (m > 2) continue;
        b.set(gx + dx, my + dy, m === 2 ? INK : dx + dy < 0 ? mix(st.stud, WHITE, 0.6) : dx + dy > 0 ? mix(st.stud, INK, 0.35) : st.stud);
      }
    }
  }
  return b;
}

/** A small tag, `w` x 11: a pill of colour with a notch at its left, lit along its top. */
export function tagBitmap(w: number, body: RGB, edge: RGB): Bitmap {
  const h = 11;
  const b = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey < 2) continue;
      // The notch, like a ribbon's tail, cut into its left end.
      if (x < 3 && Math.abs(y - 5) < 3 - x) continue;
      const rim = ex === 0 || ey === 0 || ex + ey === 2 || (x < 4 && Math.abs(y - 5) === 3 - x);
      let c = rim ? INK : y === 1 ? mix(body, WHITE, 0.5) : y >= h - 3 ? edge : body;
      if (!rim && y > 1 && y < h - 3 && bayer(x, y) < 0.2) c = mix(c, WHITE, 0.15);
      b.set(x, y, c);
    }
  }
  return b;
}

/**
 * A ribbon, `w` x 13, for a rarity's name under a card: a band in the
 * rarity's deep colour edged in its own, with forked tails folding back at
 * both ends.
 */
export function ribbonBitmap(w: number, tint: RGB, deep: RGB): Bitmap {
  const h = 13;
  const b = new Bitmap(w, h);
  const tail = 7;
  const body = mix(deep, INK, 0.25);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      let c: RGB | null = null;
      if (ex < tail) {
        // The tails sit a little lower, behind, darker, with a fork cut into them.
        if (y < 3 || y > h - 1) continue;
        const fork = Math.abs(y - 8) < 3 - ex;
        if (fork) continue;
        const rim = y === 3 || y === h - 1 || ex === 0 || Math.abs(y - 8) === 3 - ex || ex === tail - 1;
        c = rim ? INK : mix(deep, INK, 0.45);
      } else {
        if (y > h - 3) continue;
        const rim = y === 0 || y === h - 3 || ex === tail;
        c = rim ? INK : y === 1 ? mix(tint, WHITE, 0.4) : y === h - 4 ? tint : body;
        if (!rim && y > 1 && y < h - 4 && bayer(x, y) < 0.12) c = mix(c, tint, 0.3);
      }
      b.set(x, y, c);
    }
  }
  return b;
}

/** A gauge's frame, `w` x 7: an inset groove in a dark outline. */
export function gaugeFrame(w: number): Bitmap {
  const h = 7;
  const b = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey === 0) continue;
      const c = ex === 0 || ey === 0 ? INK : y === 1 ? hex('#06040e') : y === h - 2 ? hex('#3a2e6a') : hex('#120c2a');
      b.set(x, y, c);
    }
  }
  return b;
}

/** A gauge's fill, `w` x 5, in white and greys to be tinted: lit on top, with a sheen line, shaded below. */
export function gaugeFill(w: number): Bitmap {
  const rows = [hex('#ffffff'), hex('#f0f0f0'), hex('#d0d0d0'), hex('#b0b0b0'), hex('#8a8a8a')];
  const b = new Bitmap(w, rows.length);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) b.set(x, y, y === 1 && (x + 2) % 9 < 2 ? WHITE : rows[y]);
  }
  return b;
}

/** The skins' banner tab icon: the Wish Crystal small, 7 x 11. */
export function crystalIcon(): Bitmap {
  const rows = ['...o...', '..olo..', '.olLmo.', 'olLLmdo', 'olLWmdo', 'olLmmdo', 'olLmmdo', '.oLmdo.', '..omo..', '..odo..', '...o...'];
  const pal: Record<string, RGB> = { o: INK, l: hex('#b8ecff'), L: hex('#8a78f8'), W: WHITE, m: hex('#7040e0'), d: hex('#4a24b0') };
  const b = new Bitmap(7, 11);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && b.set(x, y, pal[ch])));
  return b;
}

/** The companions' banner tab icon: the wishing egg small, 8 x 10. */
export function eggIcon(): Bitmap {
  const rows = ['..oooo..', '.oWwwmo.', 'oWwwgwmo', 'owwgwtmo', 'owgwwmmo', 'ogwtwmdo', 'owwwmmdo', 'owwmmddo', '.ommddo.', '..oooo..'];
  const pal: Record<string, RGB> = { o: hex('#3a2e1e'), W: hex('#fff8e8'), w: hex('#e6d8b8'), m: hex('#b8a480'), d: hex('#7a6a50'), g: GILT[1], t: hex('#2ea88a') };
  const b = new Bitmap(8, 10);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && b.set(x, y, pal[ch])));
  return b;
}

/** The rune circle on the floor round the altar: its size and frames in one turn of its runes. */
export const SIGIL_W = 170;
export const SIGIL_H = 40;
export const SIGIL_FRAMES = 12;
const SIGIL_RUNES = 14;

/**
 * One frame of the rune circle round the altar, seen lying on the floor: an
 * outer ring, a dotted inner ring, and runes between them that walk round
 * (a frame moves them a twelfth of the way to the next rune's place, so the
 * frames loop). The near side is brighter than the far. White, to be tinted.
 */
export function sigilSheet(): Bitmap {
  const W = SIGIL_W;
  const H = SIGIL_H;
  const F = SIGIL_FRAMES;
  const b = new Bitmap(W * F, H);
  const cx = W / 2;
  const cy = H / 2;
  const rx = W / 2 - 2;
  const ry = H / 2 - 2;
  for (let f = 0; f < F; f++) {
    const turn = (f / F) * ((Math.PI * 2) / SIGIL_RUNES);
    const put = (x: number, y: number, a: number) => {
      const near = clamp01(0.45 + 0.55 * ((y - cy) / ry));
      b.set(f * W + Math.round(x), Math.round(y), WHITE, Math.round(a * (0.45 + 0.55 * near)));
    };
    for (let i = 0; i < 720; i++) {
      const t = (i / 720) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      put(cx + c * rx, cy + s * ry, 255);
      if (i % 12 < 5) put(cx + c * rx * 0.74, cy + s * ry * 0.74, 170);
    }
    // Runes: a few strokes each, standing between the rings, a different shape for each.
    for (let r = 0; r < SIGIL_RUNES; r++) {
      const t = (r / SIGIL_RUNES) * Math.PI * 2 + turn;
      const x = cx + Math.cos(t) * rx * 0.87;
      const y = cy + Math.sin(t) * ry * 0.87;
      const shape = r % 4;
      const strokes: [number, number][] =
        shape === 0 ? [[0, -2], [0, -1], [0, 0], [0, 1], [-1, -2], [1, 0]] : shape === 1 ? [[-1, -1], [0, 0], [1, 1], [1, -1], [-1, 1]] : shape === 2 ? [[-1, -2], [-1, -1], [-1, 0], [0, -1], [1, -2], [1, -1], [1, 0]] : [[0, -2], [-1, -1], [1, -1], [0, 0], [0, 1]];
      // Squashed into the floor: rows count half.
      for (const [dx, dy] of strokes) put(x + dx, y + dy * 0.6, 230);
    }
  }
  return b;
}

/**
 * The egg split in two along a jagged line, from its picture's pixels
 * (`w` x `h`): the crown above and the cup below, each edged where it broke
 * with a bright line, as if light still spills out of the crack.
 */
export function eggHalves(px: Uint8ClampedArray, w: number, h: number): [Bitmap, Bitmap] {
  const top = new Bitmap(w, h);
  const bottom = new Bitmap(w, h);
  const cutAt = (x: number) => Math.round(h * 0.46 + (x % 6 < 3 ? x % 3 : 3 - (x % 3)) * 1.4 - 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!px[i + 3]) continue;
      const c: RGB = [px[i], px[i + 1], px[i + 2]];
      const cut = cutAt(x);
      if (y < cut) top.set(x, y, y === cut - 1 ? hex('#fff4c0') : c, px[i + 3]);
      else bottom.set(x, y, y === cut ? hex('#ffc860') : c, px[i + 3]);
    }
  }
  return [top, bottom];
}

/**
 * A doorway on the storefront to one of the wishing pages, `w` x `h`: a
 * gilt-rimmed panel holding a little sky, the Sanctum's starry violet or
 * the Nest's warm dusk with drifting motes, brightest round the place on its
 * left where the crystal (or egg) is shown.
 */
export function portalBitmap(w: number, h: number, egg: boolean): Bitmap {
  const b = new Bitmap(w, h);
  const cut = 3;
  const top = egg ? hex('#4a3412') : hex('#2a1660');
  const low = egg ? hex('#0e1a10') : hex('#0a0824');
  const bloom = egg ? hex('#e8b040') : hex('#8a5ae8');
  const speck = egg ? [hex('#d8ff7a'), hex('#ffe08a')] : [hex('#c8d8ff'), hex('#fff4d0')];
  const ix = 4 + Math.round((h - 8) * 0.55);
  const iy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      const e = Math.min(ex, ey, ex + ey - cut);
      if (e < 0) continue;
      let c: RGB;
      if (e === 0) c = INK;
      else if (e <= 2) {
        const litSide = ey <= ex ? y < h / 2 : x < w / 2;
        c = litSide ? GILT[e === 1 ? 0 : 1] : GILT[e === 1 ? 2 : 3];
      } else if (e === 3) c = INK;
      else {
        const t = (y - 4) / Math.max(1, h - 9);
        c = mix(top, low, Math.floor(clamp01(t) * 4 + bayer(x, y)) / 4);
        const d = clamp01(1 - Math.hypot((x - ix) / (h * 0.9), (y - iy) / (h * 0.55)));
        if (d > 0) c = mix(c, bloom, (Math.floor(d * d * 4 + bayer(x, y)) / 4) * 0.55);
        const s = (Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0) / 4294967296;
        if (s < 0.02) c = speck[s < 0.008 ? 1 : 0];
        if (e === 4) c = mix(c, INK, 0.35);
      }
      b.set(x, y, c);
    }
  }
  // A gilt arch over the picture's place.
  const ar = (h - 12) / 2;
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.02) {
    b.set(Math.round(ix + Math.cos(a) * (ar + 2)), Math.round(iy + 2 + Math.sin(a) * (ar + 1)), GILT[2]);
  }
  return b;
}
