// Glowtide Shore: an endless coast at the edge of a calm sea, gold in the
// long evening light and glowing blue by night (see gen.ts for how it grows,
// art.ts for what stands on it, life.ts for its waves and sparkles).

import { smooth } from '../paint';
import type { LandDef } from '../types';
import { landGen, landSheets } from '../gens';
import type { ShoreGen } from './gen';
import { ShoreWaves, WAVE_MS } from './life';

/** The surf's sound: heard this far from the water (px), louder as each wave runs up. */
const SURF_REACH = 340;

const gen = () => landGen('shore') as ShoreGen;

export const SHORE: LandDef = {
  id: 'shore',
  name: 'Glowtide Shore',
  blurb: 'A coast that never ends',
  accent: 0x7ad8d0,
  gen,
  sheets: () => landSheets('shore'),
  dayNight: true,
  drift: { tints: [0xfff4d8, 0xffe2b0, 0xffffff], frequency: 1400 },
  walkers: [
    {
      id: 'crab',
      sheet: 'shore_crab',
      walk: 'walk',
      idle: 'idle',
      speed: 12,
      run: 48,
      range: 26,
      fear: 36,
      sideways: true,
      where: (x, y) => gen().sandy(x, y),
    },
  ],
  flyers: [{ id: 'gull', sheet: 'shore_gull', anim: 'fly', count: 3, height: 72, radius: 64, speed: 34, when: 'day' }],
  extra: (world, g) => new ShoreWaves(world, g as ShoreGen),
  sound: (g, x, y, time) => {
    const away = Math.max(0, (g as ShoreGen).shore(x) - y);
    const near = 1 - smooth(20, SURF_REACH, away);
    const wash = 0.6 + 0.4 * Math.sin((time / WAVE_MS) * Math.PI * 2);
    return { stream: near * wash * 0.9, streamPan: 0, pond: 0, pondPan: 0 };
  },
};
