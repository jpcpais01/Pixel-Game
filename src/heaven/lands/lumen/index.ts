// Lumen Meadow: an endless rolling meadow of tall grass and wildflowers, warm
// and gold by day, a sea of blue, teal and violet light by night (see gen.ts
// for how it grows, art.ts for what stands in it, life.ts for its fireflies,
// seeds, butterflies and the streams' motes).

import { smooth } from '../paint';
import type { LandDef } from '../types';
import { landGen, landSheets } from '../gens';
import type { LumenGen } from './gen';
import { LumenLife } from './life';

/** The brook's sound: heard this far from a stream (px), and how far to either side (px) its pan is judged. */
const BROOK_REACH = 260;
const PAN_STEP = 48;

const gen = () => landGen('lumen') as LumenGen;

export const LUMEN: LandDef = {
  id: 'lumen',
  name: 'Lumen Meadow',
  blurb: 'A meadow that glows at night',
  accent: 0x8ec8ff,
  gen,
  sheets: () => landSheets('lumen'),
  dayNight: true,
  // Pollen and the odd petal drifting down: warm white, lavender, pale gold.
  drift: { tints: [0xfff6dc, 0xe6d8ff, 0xfff0b8, 0xffffff], frequency: 1500 },
  walkers: [
    {
      id: 'hare',
      sheet: 'lumen_hare',
      walk: 'hop',
      idle: 'idle',
      speed: 16,
      run: 70,
      range: 40,
      fear: 44,
      where: (x, y) => gen().meadow(x, y),
    },
  ],
  extra: (world, g) => new LumenLife(world, g as LumenGen),
  sound: (g, x, y) => {
    const m = g as LumenGen;
    const away = (px: number) => {
      m.sample(px, y);
      return Math.abs(m.sd) - m.sw;
    };
    const here = Math.max(0, away(x));
    const near = 1 - smooth(6, BROOK_REACH, here);
    // The side the water lies on is the side its distance falls toward.
    const pan = Math.max(-1, Math.min(1, (away(x - PAN_STEP) - away(x + PAN_STEP)) / (PAN_STEP * 2)));
    // A little of it as still water too, so frogs call from the banks by night.
    return { stream: near * 0.75, streamPan: pan * 0.6, pond: near * 0.3, pondPan: pan * 0.6 };
  },
};
