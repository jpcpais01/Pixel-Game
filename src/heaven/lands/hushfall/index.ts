// Hushfall: an endless snowy vale in soft, gentle snowfall, white and lilac
// and pale blue by day, deep blue by night with the lanterns pooling warm and
// the hot springs glowing (see gen.ts for how it grows, art.ts for what
// stands in it, life.ts for its snowfall, footprints and steam).

import { smooth } from '../paint';
import type { LandDef } from '../types';
import { landGen, landSheets } from '../gens';
import type { HushGen } from './gen';
import { HushLife } from './life';

/** The springs' bubbling: heard this far away (px), at most this loud. */
const SPRING_REACH = 240;
const SPRING_LOUD = 0.45;

const gen = () => landGen('hushfall') as HushGen;

export const HUSHFALL: LandDef = {
  id: 'hushfall',
  name: 'Hushfall',
  blurb: 'Where the snow falls softly',
  accent: 0xb8c8f0,
  gen,
  sheets: () => landSheets('hushfall'),
  dayNight: true,
  // The land's own snowfall (life.ts) settles on the ground; the shared drift only adds the odd flake tumbling past.
  drift: { tints: [0xffffff, 0xe8eeff], frequency: 2600 },
  walkers: [
    {
      id: 'hare',
      sheet: 'hush_hare',
      walk: 'hop',
      idle: 'idle',
      speed: 14,
      run: 74,
      range: 40,
      fear: 52,
      where: (x, y) => gen().roam(x, y),
    },
    {
      id: 'fox',
      sheet: 'hush_fox',
      walk: 'trot',
      idle: 'idle',
      speed: 18,
      run: 62,
      range: 80,
      fear: 64,
      where: (x, y) => gen().roam(x, y),
    },
  ],
  extra: (world, g) => new HushLife(world, g as HushGen),
  sound: (g, x, y) => {
    // The nearest spring's warm bubbling, from its side.
    const near = (g as HushGen).springsIn(x - SPRING_REACH, y - SPRING_REACH, x + SPRING_REACH, y + SPRING_REACH);
    let best = Infinity;
    let pan = 0;
    for (const sp of near) {
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < best) {
        best = d;
        pan = Math.max(-1, Math.min(1, (sp.x - x) / 160));
      }
    }
    const loud = Number.isFinite(best) ? (1 - smooth(30, SPRING_REACH, best)) * SPRING_LOUD : 0;
    return { stream: loud, streamPan: pan, pond: 0, pondPan: 0 };
  },
};
