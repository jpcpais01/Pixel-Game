// Materials and button icons for the King, the warrior's second type, and his
// Afonso Henriques skin. The figure itself is drawn by the warrior's rig
// (warrior.ts), switched by its `king` and `afonso` flags: a jewelled crown,
// a beard, an ermine mantle and a gold-hilted greatsword; or a crowned conical
// helm, a mail coif, a white surcoat with the blue cross and a kite shield.

import { hex, type Material, type RGB } from './pixel';
import { icon16, seg, type Tones } from './druid';

const ramp = (...c: string[]): RGB[] => c.map(hex);

// ---------------------------------------------------------------------------
// The King: royal purple, gold and ermine.

export const ROYAL: Material = {
  ramp: ramp('#1c0a2c', '#34124e', '#4e1c72', '#6c2c96', '#8c44b8'),
  outline: hex('#0c0414'),
  outlineLit: hex('#221034'),
};

/** Ermine: white winter fur. */
export const ERMINE: Material = {
  ramp: ramp('#7e7a8e', '#bcb8ca', '#e8e6f0', '#ffffff'),
  outline: hex('#26222e'),
  outlineLit: hex('#3a3646'),
};

/** The black tail tips sewn into ermine. */
export const ERMINE_TAIL: Material = {
  ramp: ramp('#08070c', '#16141c', '#24202c'),
  outline: hex('#050408'),
  noAO: true,
};

/** Chestnut hair and beard. */
export const KING_HAIR: Material = {
  ramp: ramp('#241008', '#4a2412', '#74401e', '#a0642e', '#c68a4a'),
  outline: hex('#100604'),
  outlineLit: hex('#1e0e06'),
};

export const RUBY: Material = {
  ramp: ramp('#4a0610', '#8e1424', '#d43044', '#ff8a96'),
  outline: hex('#1e0206'),
  emissive: 0.35,
  shine: true,
  noAO: true,
};

// ---------------------------------------------------------------------------
// Afonso Henriques, as his statue stands in Guimarães: dark iron, mail, a
// white surcoat with the blue cross of his banner, a long dark beard.

/** The conical helm and the shield's rim: dark hammered iron. */
export const NORMAN_IRON: Material = {
  ramp: ramp('#121419', '#252a34', '#3d4452', '#5e6878', '#98a2b4'),
  outline: hex('#06070a'),
  outlineLit: hex('#171a22'),
  shine: true,
};

export const SURCOAT: Material = {
  ramp: ramp('#5e5e6c', '#9c9cac', '#d4d4de', '#f6f6fa'),
  outline: hex('#18181f'),
  outlineLit: hex('#2a2a34'),
};

/** The blue of the cross, the cloak and the gems. */
export const CROSS_BLUE: Material = {
  ramp: ramp('#080f30', '#10205e', '#1a3690', '#2a52c0', '#4a74e0'),
  outline: hex('#040818'),
  outlineLit: hex('#0e1a40'),
};

export const SAPPHIRE: Material = {
  ramp: ramp('#06103e', '#12288a', '#2e5ae0', '#9ab8ff'),
  outline: hex('#02061a'),
  emissive: 0.35,
  shine: true,
  noAO: true,
};

export const AFONSO_BEARD: Material = {
  ramp: ramp('#24160c', '#46301c', '#6c4a2c', '#94704a', '#b8966c'),
  outline: hex('#080504'),
  outlineLit: hex('#140e0a'),
};

// ---------------------------------------------------------------------------
// Button icons (additive, see druid.ts icon16).

export const KING_TONES: Tones = [hex('#fffdf0'), hex('#ffe8a0'), hex('#f4c040'), hex('#8a3ab0')];
export const AFONSO_TONES: Tones = [hex('#ffffff'), hex('#d8e8ff'), hex('#5a8aff'), hex('#1a3a9a')];

/**
 * The Royal Decree: a crown held high, light pouring down from it, and a
 * ring of it spreading on the ground where his foes kneel.
 */
export function decreeIcon(k: Tones = KING_TONES): Uint8ClampedArray {
  return icon16((put) => {
    // The ring on the ground.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 7, (y + 0.5 - 13) / 2.4);
        if (Math.abs(d - 1) < 0.16) put(x, y, k[2]);
        else if (d < 0.6) put(x, y, k[3]);
      }
    }
    // Rays down from the crown.
    for (const [x0, x1] of [[5, 3], [8, 8], [11, 13]] as const) seg(put, x0, 7, x1, 12, k[3]);
    // The crown: a band, five points, a gem in the middle.
    seg(put, 3, 6, 12, 6, k[1]);
    seg(put, 3, 5, 12, 5, k[2]);
    for (const [x, h] of [[3, 3], [5, 2], [7, 4], [8, 4], [10, 2], [12, 3]] as const) seg(put, x, 5, x, 5 - h, k[1]);
    for (const x of [3, 12]) put(x, 1, k[0]);
    put(7, 0, k[0]);
    put(8, 0, k[0]);
    put(7, 5, k[0]);
    put(8, 5, k[0]);
  });
}
