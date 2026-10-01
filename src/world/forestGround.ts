// The Everwood's ground, painted a tile at a time by the ground engine
// (art/ground.ts): a tile is a GroundSpec of one chunk's width, placed at its
// column's world x, built one strip of rows at a time. Everything it paints
// comes from the forest's fields (world/forestGen.ts): the thickets' roof of
// leaves (coloured by the wood it grows in), streams and ponds with their
// banks, lily pads and fords, trails and the plank bridges that carry them
// over the water, the floor of each kind of wood, the places' floors, and
// the litter, needles or petals at every tree's foot.

import { DAY_GROUND, NIGHT_GROUND, hash2, rng, valueNoise } from '../art/env';
import { K, STRIP_H, flagstone, nightify, ramp, stone, type Cell, type GroundSpec, type Look, type StripFields } from '../art/ground';
import type { RGB } from '../art/pixel';
import { BIOMES, CHUNK, FOREST_WORLD, WOOD_SHAPE, type ForestGen, type FTree, type Poi } from './forestGen';

const smooth = (a: number, b: number, v: number): number => {
  const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- palettes

export const FOREST_DAY: Look = {
  ground: {
    ...DAY_GROUND,
    grass: ramp('#1a4128', '#26582f', '#347037', '#4a893d', '#66a246', '#89bb54', '#b1d468'),
    dirt: ramp('#3f2f27', '#54402f', '#6e553e', '#8a6d4f', '#a4886a'),
  },
  moss: ramp('#17331f', '#1e4226', '#28542d', '#356a34', '#4a803b', '#679a46', '#8ab45a'),
  litter: ramp('#3a2718', '#58391f', '#7a5024', '#9c6c2c', '#bf8e3c', '#93402a'),
  path: ramp('#3e2e22', '#55402d', '#6e553a', '#876c4a', '#a1865d', '#baa072', '#cfb788'),
  bark: ramp('#1f140e', '#352318', '#4f3524', '#6b4a32'),
  roof: [
    // Oak green, birch's yellow green, pine's blue green, autumn gold, Sakura pink, the hollow's deep teal.
    ramp('#0d2419', '#133220', '#1b4328', '#255630', '#336b38', '#468241', '#5f9a4b', '#80b35a'),
    ramp('#1a3319', '#26461f', '#355d25', '#46742c', '#5c8c35', '#77a53f', '#96be4f', '#b8d466'),
    ramp('#081c1b', '#0c2724', '#11332d', '#184237', '#205142', '#2b634d', '#3a7658', '#4d8a62'),
    ramp('#3a0e0a', '#5a160c', '#7e240e', '#a23612', '#c44e16', '#dc6c1e', '#ee922e', '#f8b848'),
    ramp('#3b1a33', '#5a2642', '#7c3552', '#a04a66', '#c0637c', '#d98396', '#eba6b4', '#f8c8d2'),
    ramp('#07161a', '#0b2124', '#102c2c', '#173a35', '#1f4a3e', '#2a5b48', '#386e52', '#4a825e'),
    // The autumn wood's other crowns: gold and crimson among the orange.
    ramp('#3a2408', '#5a360a', '#7c4e0e', '#a06a12', '#c48a1a', '#dcaa28', '#eec63e', '#f8e070'),
    ramp('#300a14', '#4a0e1a', '#681420', '#8a1c26', '#ac2a2e', '#c8423a', '#e0644a', '#f08c62'),
  ],
  bloom: ramp('#7d8cf0', '#eef3ff', '#f4e27c', '#f0a0cf', '#a6d8ff'),
  shroom: [200, 255, 240],
  stem: [232, 226, 204],
  cast: [14, 16],
  shadow: 1.9,
  pool: 2.4,
  wallDark: 1.1,
  water: ramp('#123a4a', '#17506a', '#1f6a86', '#2a86a0', '#3fa4b6', '#6cc6cc', '#b4ece6'),
  petal: ramp('#e07898', '#f2a2b8', '#fbc8d4', '#fff0f4'),
  pad: ramp('#1c4a26', '#2a6430', '#3c7e38', '#58983f', '#7cb24c'),
  lotus: ramp('#ffd0e0', '#ff9ec0', '#fff8fc'),
  plank: ramp('#2a1a10', '#3e2816', '#58391f', '#74502c', '#906a3c', '#ad8752', '#c7a36c'),
  fallen: ramp('#5a1612', '#8e2418', '#c0461c', '#e07422', '#f0a032', '#f6c85a'),
};

const night = (r: RGB[]) => r.map(nightify);

export const FOREST_NIGHT: Look = {
  ground: { ...NIGHT_GROUND, grass: night(FOREST_DAY.ground.grass), dirt: night(FOREST_DAY.ground.dirt) },
  moss: night(FOREST_DAY.moss),
  litter: night(FOREST_DAY.litter),
  path: night(FOREST_DAY.path),
  bark: night(FOREST_DAY.bark),
  roof: FOREST_DAY.roof.map(night),
  bloom: ramp('#4a5694', '#8a93b8', '#7b7a6a', '#7a5a86', '#5a7aa0'),
  shroom: [159, 255, 240],
  stem: [106, 120, 136],
  cast: [-12, 14],
  shadow: 0.9,
  pool: 0.9,
  wallDark: 1.7,
  // Moonlit water keeps a little more of its blue than the land round it.
  water: ramp('#07131e', '#0a1c2c', '#0e2638', '#133246', '#1b4256', '#2c5a6c', '#5a8a98'),
  petal: ramp('#6a4a66', '#7e5a78', '#90708a', '#a48aa0'),
  pad: night(FOREST_DAY.pad!),
  lotus: ramp('#a890b4', '#8a6a9a', '#c8b8d4'),
  plank: night(FOREST_DAY.plank!),
  fallen: night(FOREST_DAY.fallen!),
};

/** Glow of the hollows' moss and mushrooms, fairy rings, and the runes of shrines and standing stones. */
const GLOW_TEAL: RGB = [80, 255, 214];
const GLOW_FAIRY: RGB = [200, 150, 255];
const RUNE_STONES: RGB = [150, 120, 255];
const RUNE_SHRINE: RGB = [120, 255, 200];

// ---------------------------------------------------------------- a tile

/**
 * The spec for the ground tile in column `col`, strip row `row`: its floor
 * and roof from the forest's fields, the trees round it for their shadows
 * and litter, the places on it, the sunbeams' pools.
 */
export function forestTile(gen: ForestGen, col: number, row: number, ver = 0): GroundSpec {
  const ox = col * CHUNK;
  const y0 = row * STRIP_H;
  const pois = gen.poisIn(ox - 4, y0 - 4, ox + CHUNK + 4, y0 + STRIP_H + 4);
  const cy = Math.floor(y0 / CHUNK);
  const trees: FTree[] = [];
  const rays: { x: number; y: number }[] = [];
  for (let j = cy - 1; j <= cy + 1; j++) {
    for (let i = col - 1; i <= col + 1; i++) {
      const l = gen.layout(i, j);
      // Trees the player cleared leave no shadow or litter behind.
      for (const t of l.trees) if (!gen.isCleared(t.x, t.y)) trees.push(t);
      rays.push(...l.rays);
    }
  }
  return {
    // A tile painted again (a tree cleared near it) gets new textures beside the old, which show till it's done.
    key: ver ? `fw${gen.seed}_${col}v${ver}` : `fw${gen.seed}_${col}`,
    w: CHUNK,
    h: FOREST_WORLD,
    ox,
    night: FOREST_NIGHT,
    day: FOREST_DAY,
    roofDepth: (x, y) => gen.sample(x, y).roof,
    roofSpecies: (x, y) => {
      const b = BIOMES[gen.biomeAt(x, y)];
      // Now and then a crown of another colour in the mass.
      const odd = hash2(Math.floor(x / 17), Math.floor(y / 17), 611 + gen.seed);
      if (odd > 0.93 && b.roof === 0) return 1;
      if (odd > 0.96 && b.roof === 1) return 0;
      // The autumn wood is every colour a maple turns.
      if (b.roof === 3) return odd < 0.3 ? 6 : odd < 0.55 ? 7 : 3;
      return b.roof;
    },
    floor: (x, y, wall, c) => floor(gen, pois, x, y, wall, c),
    gloom: (_x, _y, wall, look) => smooth(-46, 0, wall) * look.wallDark,
    decorate: (s) => decorate(gen, s, trees, pois),
    casters: () => trees.map((t) => ({ x: t.x, y: t.y, r: WOOD_SHAPE[t.kind].canopyR * (t.kind === 'willow' ? 1.1 : 1) })),
    pools: () => rays,
  };
}

// ---------------------------------------------------------------- the floor

function floor(gen: ForestGen, pois: Poi[], wx: number, wy: number, wall: number, c: Cell): void {
  const s = gen.sample(wx, wy);
  const water = Math.max(s.stream, s.pond);
  const inStream = s.stream >= s.pond;

  // A plank bridge (or a boardwalk over a pond) where a trail meets the water:
  // boards laid across the way, their seams dark, a rail beam along each side.
  if (s.trail < 0.6 && water > -1.2) {
    const along = wx * -s.tgy + wy * s.tgx;
    const board = Math.floor(along / 3);
    const f = along / 3 - board;
    const rail = s.trail > -0.9;
    c.kind = K.Plank;
    c.height = rail ? 1.6 : f < 0.34 ? 0.6 : 1.1;
    c.tone = (hash2(board, 3, 613 + gen.seed) - 0.5) * 1.3 + (f < 0.34 ? -1.6 : 0) + (rail ? -0.5 : 0) + (hash2(wx, wy, 615) > 0.93 ? -0.8 : 0);
    return;
  }

  if (water > 0) {
    const ford = inStream && s.ford > 0.5;
    if (ford) {
      // Stepping stones through the shallows.
      const gx = Math.floor(wx / 7);
      const gy = Math.floor(wy / 7);
      const sx = (gx + 0.3 + hash2(gx, gy, 617) * 0.4) * 7;
      const sy = (gy + 0.3 + hash2(gx, gy, 619) * 0.4) * 7;
      const r = 1.6 + hash2(gx, gy, 621) * 0.9;
      const d = Math.hypot(wx + 0.5 - sx, (wy + 0.5 - sy) * 1.2);
      if (hash2(gx, gy, 623) > 0.3 && d < r) {
        c.kind = K.Stone;
        c.height = (1 - d / r) * 0.9 + 0.3;
        c.tone = (hash2(gx, gy, 625) - 0.5) * 0.8 + (hash2(wx, wy, 627) > 0.8 ? -0.6 : 0);
        return;
      }
    }
    c.kind = K.Water;
    c.height = 0;
    // Light at the banks, deep in the middle; a pond deeper still; shallows pale.
    let t = 1.6 - Math.min(water, 6) * 0.42;
    if (!inStream) t -= Math.min(14, water) * 0.07;
    if (ford) t += 1.1;
    // Glints: short dashes along the flow on a stream, scattered sparkles on a pond.
    const along = inStream ? wx * -s.sgy + wy * s.sgx : wx;
    const across = inStream ? wx * s.sgx + wy * s.sgy : wy;
    if (hash2(Math.floor(along / 3), Math.floor(across), 629 + gen.seed) > (inStream ? 0.9 : 0.955)) t += 1.6;
    // The shade under a bridge's edge.
    if (s.trail < 2.6) t -= 1.5;
    c.tone = t;
    // Lily pads, some flowering, out on a pond.
    if (!inStream && water > 3) {
      const gx = Math.floor(wx / 9);
      const gy = Math.floor(wy / 9);
      if (hash2(gx, gy, 631 + gen.seed) > 0.58) {
        const px = (gx + 0.25 + hash2(gx, gy, 633) * 0.5) * 9;
        const py = (gy + 0.25 + hash2(gx, gy, 635) * 0.5) * 9;
        const r = 2.2 + hash2(gx, gy, 637) * 1.4;
        const dx = wx + 0.5 - px;
        const dy = (wy + 0.5 - py) * 1.35;
        const d = Math.hypot(dx, dy);
        // A notch cut toward the middle, turned at random.
        const a = Math.atan2(dy, dx) - hash2(gx, gy, 639) * Math.PI * 2;
        const notch = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35 && d > 0.8;
        if (d < r && !notch) {
          const bloom = hash2(gx, gy, 641) > 0.7;
          if (bloom && d < 1.1) {
            c.kind = K.Lotus;
            c.sub = Math.floor(hash2(wx, wy, 643) * 3);
            c.height = 1;
          } else {
            c.kind = K.Pad;
            c.height = 0.5 + (1 - d / r) * 0.3;
            c.tone = (hash2(gx, gy, 645) - 0.5) * 0.8 - (d > r - 0.8 ? 0.6 : 0);
          }
        }
      }
    }
    return;
  }
  // Banks: wet earth and pebbles, then damp moss.
  if (water > -2.4) {
    const pebble = hash2(wx, wy, 647) > 0.72;
    c.kind = pebble ? K.Pebble : K.Dirt;
    c.height = pebble ? 0.6 : 0.1 + valueNoise(wx, wy, 3, 649) * 0.2;
    c.tone = pebble ? (hash2(wx, wy, 651) - 0.5) * 1.2 : -0.8 + (water + 2.4) * -0.2;
    return;
  }
  if (water > -5.5 && hash2(wx, wy, 653) > (water + 5.5) / 3.1 - 0.2) {
    c.kind = K.Moss;
    c.height = valueNoise(wx, wy, 3, 655) * 0.35;
    c.tone = -0.9 + (valueNoise(wx, wy, 6, 657) - 0.5) * 1.2;
    return;
  }

  // Trails: packed earth worn bare, pebbles in it, grass creeping over its edges.
  if (s.trail < 0) {
    if (s.trail > -1.1 && hash2(wx, wy, 659) > 0.55) {
      c.kind = K.Grass;
      c.height = 0.3;
      c.tone = -0.4;
      return;
    }
    const pebble = hash2(wx, wy, 661) > 0.93 && s.trail < -1.2;
    c.kind = pebble ? K.Pebble : K.Path;
    c.height = pebble ? 0.5 : valueNoise(wx, wy, 3, 663) * 0.25 + (s.trail > -1 ? 0.15 : 0);
    c.tone = (valueNoise(wx, wy, 5, 665) - 0.5) * 1.2 - (s.trail > -0.8 ? 0.4 : 0);
    return;
  }
  if (s.trail < 1.6 && hash2(wx, wy, 667) > 0.62) {
    c.kind = K.Dirt;
    c.height = 0.1;
    c.tone = (hash2(wx, wy, 669) - 0.5) * 1.2;
    return;
  }

  // The places' own floors.
  for (const p of pois) {
    if (placeFloor(p, wx, wy, c)) return;
  }

  woodFloor(gen, wx, wy, wall, c);
}

/** A place's floor under (x, y), if it has one there. */
function placeFloor(p: Poi, wx: number, wy: number, c: Cell): boolean {
  const dx = wx + 0.5 - p.x;
  const dy = (wy + 0.5 - p.y) * 1.25;
  const d = Math.hypot(dx, dy);
  if (d > p.r + 8) return false;
  const wob = (valueNoise(wx, wy, 7, 671) - 0.5) * 10;
  switch (p.kind) {
    case 'ruins': {
      // A broken floor of old flagstones, moss and grass taking it back.
      if (d > 50 + wob) return false;
      if (valueNoise(wx, wy, 11, 673) > 0.64 || (d > 38 + wob && hash2(wx >> 2, wy >> 2, 675) > 0.5)) return false;
      const mossy = valueNoise(wx, wy, 14, 677);
      flagstone(wx, wy);
      if (stone.edge < 0.55) {
        c.kind = K.Grout;
        c.tone = mossy > 0.5 ? 2 : mossy > 0.35 ? 1 : 0;
      } else {
        c.kind = K.Stone;
        c.height = Math.min(1, stone.edge / 2.2) * 0.7 + valueNoise(wx, wy, 3, 679) * 0.08;
        c.tone = (stone.t - 0.5) * 0.9 + (valueNoise(wx, wy, 6, 681) - 0.5) * 0.6 - 0.3;
        if (mossy > 0.6 && hash2(wx, wy, 683) > 0.4) {
          c.kind = K.Moss;
          c.tone = -0.2;
        }
      }
      return true;
    }
    case 'shrine': {
      if (d > 17) return false;
      if (d > 14.5) {
        c.kind = K.Pebble;
        c.height = 0.6;
        c.tone = (hash2(wx, wy, 685) - 0.5) * 1.2;
        return true;
      }
      flagstone(wx, wy);
      c.kind = stone.edge < 0.5 ? K.Grout : K.Stone;
      c.height = c.kind === K.Stone ? Math.min(1, stone.edge / 2.2) * 0.6 : 0;
      c.tone = c.kind === K.Stone ? (stone.t - 0.5) * 0.8 + 0.4 : 1;
      return true;
    }
    case 'campfire': {
      if (d > 20) return false;
      if (d > 12 + wob * 0.3) {
        if (hash2(wx, wy, 687) > 0.5) return false;
        c.kind = K.Dirt;
        c.height = 0.1;
        c.tone = (hash2(wx, wy, 689) - 0.5);
        return true;
      }
      // Trodden earth, ash in the middle.
      c.kind = K.Dirt;
      c.height = valueNoise(wx, wy, 2, 691) * 0.2;
      c.tone = d < 6 ? -1.6 + hash2(wx, wy, 693) * 0.8 : (valueNoise(wx, wy, 4, 695) - 0.5) * 1.2;
      return true;
    }
    case 'stones': {
      // A ring worn into the grass round the stones, as if walked for ages.
      const ring = Math.abs(d - 34);
      if (ring > 4 + wob * 0.2) return false;
      if (hash2(wx, wy, 697) > 0.72) return false;
      c.kind = ring < 2 ? K.Path : K.Dirt;
      c.height = 0.15;
      c.tone = (valueNoise(wx, wy, 4, 699) - 0.5) * 1.2 - 0.3;
      return true;
    }
    case 'elder': {
      // A carpet of moss under the old tree.
      if (d > 44 + wob) return false;
      c.kind = hash2(wx, wy, 701) > 0.9 ? K.Litter : K.Moss;
      c.height = valueNoise(wx, wy, 3, 703) * 0.4;
      c.tone = c.kind === K.Litter ? 1 + Math.floor(hash2(wx, wy, 705) * 3) : (valueNoise(wx, wy, 8, 707) - 0.5) * 1.6 + 0.2;
      return true;
    }
    case 'chest': {
      if (d > 10 + wob * 0.2) return false;
      const pebble = hash2(wx, wy, 709) > 0.8;
      c.kind = pebble ? K.Pebble : K.Dirt;
      c.height = pebble ? 0.5 : 0.2;
      c.tone = (hash2(wx, wy, 711) - 0.5) * 1.2;
      return true;
    }
    default:
      return false;
  }
}

/** The floor of whichever wood (x, y) is in. */
function woodFloor(gen: ForestGen, wx: number, wy: number, wall: number, c: Cell): void {
  const biome = BIOMES[gen.biomeAt(wx, wy)].id;
  // Toward a thicket the open floor gives way to the forest's own: moss and litter, needles or petals.
  const shade = smooth(-70, -16, wall);
  const under = shade > 0.5 + (valueNoise(wx, wy, 9, 713) - 0.5) * 0.9;
  const grass = (lift: number) => {
    c.kind = K.Grass;
    c.height = valueNoise(wx, wy, 4, 715) * 0.25 + valueNoise(wx, wy, 11, 717) * 0.25;
    c.tone = (valueNoise(wx, wy, 18, 719) - 0.5) * 2.2 + lift;
  };
  const moss = (lift: number) => {
    c.kind = K.Moss;
    c.height = valueNoise(wx, wy, 3, 721) * 0.3 + valueNoise(wx, wy, 9, 723) * 0.2;
    c.tone = (valueNoise(wx, wy, 16, 725) - 0.5) * 2 + (valueNoise(wx, wy, 5, 727) - 0.5) * 0.8 + lift;
  };
  const litter = (lo: number, span: number) => {
    c.kind = K.Litter;
    c.height = 0.35 + hash2(wx, wy, 729) * 0.35;
    c.tone = lo + Math.floor(hash2(wx >> 1, wy, 731) * span);
  };
  const flower = (colour: number, blue: boolean) => {
    c.kind = K.Flower;
    c.sub = blue ? 1 : 0;
    c.height = 0.9;
    c.tone = colour;
  };

  switch (biome) {
    case 'oak':
      if (!under) return grass(-0.2);
      if (valueNoise(wx, wy, 13, 733) > 0.56 && hash2(wx, wy, 735) > 0.32) return litter(1, 4);
      return moss(0);
    case 'birch':
      if (!under) {
        grass(0.55);
        // Wood anemones and lady's smock, pale among the birches.
        if (hash2(wx, wy, 737) > 0.988) flower(hash2(wx, wy, 739) > 0.5 ? 0 : 3, false);
        return;
      }
      if (hash2(wx, wy, 741) > 0.86) return litter(3, 2);
      return moss(0.5);
    case 'pine': {
      // A floor of fallen needles, moss in the damp hollows, grass only in the sunniest gaps.
      if (!under && valueNoise(wx, wy, 40, 743) > 0.66) return grass(-0.8);
      if (valueNoise(wx, wy, 16, 745) > 0.6) return moss(-0.5);
      if (hash2(wx, wy, 747) > 0.97) {
        c.kind = K.Twig;
        c.height = 0.8;
        return;
      }
      c.kind = K.Litter;
      c.height = 0.25 + hash2(wx, wy, 749) * 0.3;
      c.tone = Math.floor(valueNoise(wx, wy, 5, 751) * 1.6 + hash2(wx, wy, 753) * 1.2);
      return;
    }
    case 'sakura': {
      // Petal drifts, thicker toward the trees.
      const drift = valueNoise(wx, wy, 10, 755) * 0.6 + valueNoise(wx, wy, 3, 757) * 0.4 + shade * 0.25;
      if (drift > 0.62 && hash2(wx, wy, 759) > 0.2) {
        c.kind = K.Petal;
        c.sub = Math.floor(hash2(wx, wy, 761) * 4);
        c.height = 0.4;
        return;
      }
      return grass(0.35);
    }
    case 'meadow': {
      // Lush grass and flowers in drifts, each drift mostly one colour.
      const gx = Math.floor(wx / 6);
      const gy = Math.floor(wy / 6);
      if (valueNoise(wx, wy, 26, 763) > 0.42 && hash2(gx, gy, 765 + gen.seed) > 0.45) {
        const fx = (gx + 0.5) * 6 + (hash2(gx, gy, 767) - 0.5) * 3;
        const fy = (gy + 0.5) * 6 + (hash2(gx, gy, 769) - 0.5) * 3;
        if (Math.hypot(wx + 0.5 - fx, wy + 0.5 - fy) < 1.4 + hash2(wx, wy, 771) * 0.9 && hash2(wx, wy, 773) > 0.35) {
          const hue = Math.floor(valueNoise(wx, wy, 30, 775) * 9);
          return flower(hue % 5, hue >= 4);
        }
      }
      return grass(0.8);
    }
    case 'autumn': {
      // Carpets of fallen leaves in patches of one colour, over dry grass.
      const carpet = valueNoise(wx, wy, 13, 777) * 0.7 + hash2(wx, wy, 779) * 0.3 + shade * 0.3;
      if (carpet > 0.5) {
        c.kind = K.Fallen;
        c.height = 0.35 + hash2(wx, wy, 781) * 0.4;
        c.tone = Math.min(5, Math.floor(valueNoise(wx, wy, 7, 783) * 5 + hash2(wx, wy, 785) * 1.6));
        return;
      }
      if (under) return litter(2, 3);
      return grass(-0.4);
    }
    case 'hollow':
      if (valueNoise(wx, wy, 12, 787) > 0.62 && hash2(wx, wy, 789) > 0.3) return litter(0, 3);
      return moss(-0.7);
  }
}

// ---------------------------------------------------------------- over the floor

/**
 * Drawn over the finished fields: litter, needles or petals at each tree's
 * foot, glowing specks in the hollows' moss, fairy rings, and the runes of
 * shrines and standing stones (which glow by night).
 */
function decorate(gen: ForestGen, s: StripFields, trees: FTree[], pois: Poi[]): boolean {
  const { x0, y0, W, H, PW, kind, sub, height, tone, emissive } = s;
  let glows = false;
  const inside = (x: number, y: number) => x >= x0 && x < x0 + W && y >= y0 && y < y0 + H;
  const at = (x: number, y: number) => (y - y0 + 1) * PW + (x - x0) + 1;
  const glow = (x: number, y: number, c: RGB, k: number) => {
    const e = ((y - y0) * W + (x - x0)) * 4;
    emissive[e] = Math.max(emissive[e], c[0] * k);
    emissive[e + 1] = Math.max(emissive[e + 1], c[1] * k);
    emissive[e + 2] = Math.max(emissive[e + 2], c[2] * k);
    emissive[e + 3] = 255;
    glows = true;
  };
  const soft = (k: number) => k === K.Grass || k === K.Flower || k === K.Moss || k === K.Petal || k === K.Litter || k === K.Fallen;

  // What falls at each tree's foot.
  for (const t of trees) {
    if (t.y < y0 - 8 || t.y > y0 + H + 8 || t.x < x0 - 20 || t.x > x0 + W + 20) continue;
    const rx = t.kind === 'birch' ? 8 : t.kind === 'pine' ? 12 : t.kind === 'cherry' ? 15 : 13;
    const ry = rx * 0.42;
    for (let y = Math.floor(t.y - ry - 2); y <= t.y + ry + 2; y++) {
      for (let x = Math.floor(t.x - rx - 2); x <= t.x + rx + 2; x++) {
        if (!inside(x, y)) continue;
        const e = ((x + 0.5 - t.x) / rx) ** 2 + ((y - 0.5 - t.y) / ry) ** 2 + (hash2(x, y, 801) - 0.5) * 0.6;
        if (e > 1) continue;
        const i = at(x, y);
        if (!soft(kind[i])) continue;
        const h = hash2(x, y, 803);
        switch (t.kind) {
          case 'maple':
            kind[i] = K.Fallen;
            tone[i] = Math.floor(hash2(x >> 1, y, 805) * 6);
            break;
          case 'cherry':
            if (h < 0.25) continue;
            kind[i] = K.Petal;
            sub[i] = Math.floor(hash2(x, y, 807) * 4);
            break;
          case 'birch':
            if (h < 0.45) continue;
            kind[i] = K.Litter;
            tone[i] = 3 + (h > 0.8 ? 1 : 0);
            break;
          case 'pine':
            kind[i] = K.Litter;
            tone[i] = h > 0.6 ? 1 : 0;
            break;
          default:
            kind[i] = e < 0.3 && h > 0.4 ? K.Moss : K.Litter;
            tone[i] = kind[i] === K.Moss ? -0.3 : 1 + Math.floor(h * 4);
        }
        height[i] = 0.35 + h * 0.3;
      }
    }
  }

  // Glowing specks in the hollows' moss.
  const R = rng(x0 * 7 + y0 * 13 + gen.seed);
  for (let k = 0; k < 60; k++) {
    const x = x0 + Math.floor(R() * W);
    const y = y0 + Math.floor(R() * H);
    const i = at(x, y);
    if (kind[i] !== K.Moss || BIOMES[gen.biomeAt(x, y)].id !== 'hollow') continue;
    const n = 1 + Math.floor(R() * 4);
    for (let j = 0; j < n; j++) {
      const px = x + Math.floor(R() * 5) - 2;
      const py = y + Math.floor(R() * 3) - 1;
      if (!inside(px, py) || kind[at(px, py)] !== K.Moss) continue;
      kind[at(px, py)] = K.Shroom;
      sub[at(px, py)] = 0;
      height[at(px, py)] = 1;
      glow(px, py, GLOW_TEAL, 0.45 + R() * 0.3);
    }
  }

  for (const p of pois) {
    if (p.kind === 'fairy') {
      // A ring of little mushrooms that glow by night.
      const n = 18;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + hash2(p.x, k, 811) * 0.2;
        const x = Math.round(p.x + Math.cos(a) * 15);
        const y = Math.round(p.y + Math.sin(a) * 11);
        for (const [dx, dy, part] of [[0, 0, 0], [0, 1, 1], [1, 0, 0]] as [number, number, number][]) {
          if (part === 0 && dx === 1 && hash2(x, y, 813) > 0.5) continue;
          if (!inside(x + dx, y + dy)) continue;
          const i = at(x + dx, y + dy);
          kind[i] = K.Shroom;
          sub[i] = part;
          height[i] = part ? 0.9 : 1.2;
          if (!part) glow(x + dx, y + dy, hash2(x, y, 815) > 0.5 ? GLOW_FAIRY : GLOW_TEAL, 0.7);
        }
      }
    } else if (p.kind === 'stones' || p.kind === 'shrine') {
      // A faint circle of runes inside the ring.
      const r = p.kind === 'stones' ? 20 : 12;
      const col = p.kind === 'stones' ? RUNE_STONES : RUNE_SHRINE;
      for (let y = Math.floor(p.y - r / 1.25 - 3); y <= p.y + r / 1.25 + 3; y++) {
        for (let x = Math.floor(p.x - r - 3); x <= p.x + r + 3; x++) {
          if (!inside(x, y)) continue;
          const dx = x + 0.5 - p.x;
          const dy = (y + 0.5 - p.y) * 1.25;
          const d = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          const ring = Math.abs(d - r) < 0.6;
          const glyph = Math.abs(d - r + 2.2) < 1.2 && hash2(Math.floor(a * 24), Math.floor(d), 817) > 0.7;
          if (!ring && !glyph) continue;
          glow(x, y, col, ring ? 0.5 : 0.36);
        }
      }
    }
  }
  return glows;
}
