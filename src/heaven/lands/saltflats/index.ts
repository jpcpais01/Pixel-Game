// Saltglass Flats: an endless salt flat under a sheet of still, ankle-deep
// water that mirrors the sky, pastel and gold by day, holding the stars by
// night (see gen.ts for how it grows, art.ts for what stands on it, life.ts
// for the mirror's reflections, ripples, drifting clouds and sparkles).

import type { LandDef } from '../types';
import { landGen, landSheets } from '../gens';
import type { SaltGen } from './gen';
import { SaltMirror } from './life';

/** The water's hush round feet that wade it (0..1 of the brook's voice): barely there. */
const LAP = 0.07;

const gen = () => landGen('saltflats') as SaltGen;

export const SALTFLATS: LandDef = {
  id: 'saltflats',
  name: 'Saltglass Flats',
  blurb: 'Where the sky lies down',
  accent: 0xf2c6d0,
  gen,
  sheets: () => landSheets('saltflats'),
  dayNight: true,
  drift: { tints: [0xfff6e0, 0xffe8c0, 0xffffff], frequency: 1700 },
  walkers: [
    {
      id: 'flamingo',
      sheet: 'salt_flamingo',
      walk: 'walk',
      idle: 'idle',
      speed: 7,
      run: 26,
      range: 30,
      fear: 46,
      where: (x, y) => gen().wet(x, y),
    },
  ],
  flyers: [{ id: 'flamingo', sheet: 'salt_flyer', anim: 'fly', count: 3, height: 84, radius: 80, speed: 30, when: 'day' }],
  extra: (world, g) => new SaltMirror(world, g as SaltGen),
  sound: (g, x, y) => ({ stream: (g as SaltGen).wet(x, y) ? LAP : 0, streamPan: 0, pond: 0, pondPan: 0 }),
};
