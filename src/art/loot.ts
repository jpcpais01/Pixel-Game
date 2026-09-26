/**
 * Light for gear lying on the ground: the pillar that marks a rare find from
 * afar, the god rays behind a legendary, the rune circle under it, the ring a
 * drop sends out as it lands, a four-point twinkle and the arrow that points
 * at a great find off screen.
 *
 * All but the arrow are premultiplied white on black, meant for ADD blending
 * and a rarity tint, like the 'glow' texture.
 */

export const BEAM_W = 11;
export const BEAM_H = 120;
export const LRAY_W = 7;
export const LRAY_H = 30;
export const LRING_W = 48;
export const LRING_H = 20;
export const RUNE_W = 36;
export const RUNE_H = 15;
export const TWINKLE = 7;
export const ARROW = 9;

/** Brightness in a few flat steps, so light stays pixel art rather than a smooth gradient. */
const step = (v: number, n = 6) => Math.round(Math.max(0, Math.min(1, v)) * n) / n;

function put(px: Uint8ClampedArray, w: number, x: number, y: number, v: number): void {
  const i = (y * w + x) * 4;
  const b = Math.round(255 * v);
  if (b <= px[i]) return;
  px[i] = px[i + 1] = px[i + 2] = b;
}

function blank(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  return px;
}

/** A column of light: a hot core, soft edges, strong at the ground and dying out high up. */
export function lootBeam(): Uint8ClampedArray {
  const px = blank(BEAM_W, BEAM_H);
  const across = [1, 0.72, 0.42, 0.22, 0.1, 0.04];
  const c = (BEAM_W - 1) / 2;
  for (let y = 0; y < BEAM_H; y++) {
    const up = 1 - y / (BEAM_H - 1);
    // Full over the lowest fifth, then fading away towards the sky; a soft foot.
    const along = (up < 0.2 ? 1 : Math.pow(1 - (up - 0.2) / 0.8, 1.6)) * (y > BEAM_H - 3 ? 0.7 : 1);
    for (let x = 0; x < BEAM_W; x++) put(px, BEAM_W, x, y, step(across[Math.abs(x - c)] * along, 8));
  }
  return px;
}

/** One god ray: a thin wedge that starts at its foot (the bottom middle) and widens and fades outwards. */
export function lootRay(): Uint8ClampedArray {
  const px = blank(LRAY_W, LRAY_H);
  const c = (LRAY_W - 1) / 2;
  for (let y = 0; y < LRAY_H; y++) {
    const u = (LRAY_H - 1 - y) / (LRAY_H - 1);
    const hw = 0.6 + u * 2.9;
    const fade = Math.pow(1 - u, 1.1) * (u < 0.08 ? 0.6 : 1);
    for (let x = 0; x < LRAY_W; x++) {
      const d = Math.abs(x - c) / hw;
      if (d > 1) continue;
      put(px, LRAY_W, x, y, step(fade * (d < 0.4 ? 1 : 0.55), 5));
    }
  }
  return px;
}

/** A flat ring on the ground, with a faint rim of light inside it: the landing shockwave. */
export function lootRing(): Uint8ClampedArray {
  const px = blank(LRING_W, LRING_H);
  const rx = LRING_W / 2 - 1;
  const ry = LRING_H / 2 - 1;
  for (let y = 0; y < LRING_H; y++) {
    for (let x = 0; x < LRING_W; x++) {
      const e = Math.hypot((x + 0.5 - LRING_W / 2) / rx, (y + 0.5 - LRING_H / 2) / ry);
      if (Math.abs(e - 1) < 0.075) put(px, LRING_W, x, y, 1);
      else if (e < 1 && e > 0.8) put(px, LRING_W, x, y, 0.28);
      else if (e <= 0.8 && e > 0.62) put(px, LRING_W, x, y, 0.1);
    }
  }
  return px;
}

/** A circle of runes under a great find: two dashed rings and eight marks between them. */
export function lootRunes(): Uint8ClampedArray {
  const px = blank(RUNE_W, RUNE_H);
  const cx = RUNE_W / 2;
  const cy = RUNE_H / 2;
  const ring = (rx: number, ry: number, dash: number, v: number) => {
    for (let y = 0; y < RUNE_H; y++) {
      for (let x = 0; x < RUNE_W; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (Math.abs(Math.hypot(dx, dy) - 1) > 0.09) continue;
        const a = Math.atan2(dy, dx) + Math.PI;
        if (dash && Math.floor((a / (Math.PI * 2)) * dash) % 2) continue;
        put(px, RUNE_W, x, y, v);
      }
    }
  };
  ring(cx - 1, cy - 1, 0, 0.8);
  ring(cx - 7, cy - 3.5, 24, 0.5);
  // The runes: tiny crosses and bars, alternating, round the band between the rings.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.round(cx - 0.5 + Math.cos(a) * (cx - 4));
    const y = Math.round(cy - 0.5 + Math.sin(a) * (cy - 2.3));
    put(px, RUNE_W, x, y, 1);
    if (k % 2) {
      put(px, RUNE_W, x - 1, y, 0.6);
      put(px, RUNE_W, x + 1, y, 0.6);
    } else {
      put(px, RUNE_W, x, y - 1, 0.6);
      if (y + 1 < RUNE_H) put(px, RUNE_W, x, y + 1, 0.45);
    }
  }
  return px;
}

/** A four-point star. */
export function lootTwinkle(): Uint8ClampedArray {
  const px = blank(TWINKLE, TWINKLE);
  const c = 3;
  put(px, TWINKLE, c, c, 1);
  [0.85, 0.5, 0.22].forEach((v, i) => {
    const d = i + 1;
    put(px, TWINKLE, c + d, c, v);
    put(px, TWINKLE, c - d, c, v);
    put(px, TWINKLE, c, c + d, v);
    put(px, TWINKLE, c, c - d, v);
  });
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(px, TWINKLE, c + dx, c + dy, 0.3);
  return px;
}

/** An arrowhead pointing right, white with a dark rim, tinted to the find's rarity. */
export function lootArrow(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(ARROW * ARROW * 4);
  const c = (ARROW - 1) / 2;
  const inside = (x: number, y: number) => x >= 1 && x <= 7 && Math.abs(y - c) <= (7 - x) * 0.62 + 0.3 && !(x < 3 && Math.abs(y - c) < 1.5 - x * 0.5);
  for (let y = 0; y < ARROW; y++) {
    for (let x = 0; x < ARROW; x++) {
      const i = (y * ARROW + x) * 4;
      if (inside(x, y)) {
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const v = edge ? 170 : 255;
        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = 255;
      } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) {
        px[i] = 20;
        px[i + 1] = 14;
        px[i + 2] = 32;
        px[i + 3] = 220;
      }
    }
  }
  return px;
}
