// Saltglass Flats, grown: an endless salt flat under a sheet of still,
// ankle-deep water that holds the sky like glass. Where the water has gone
// the crust shows, cracked into the salt's polygons; at the edges the ridges
// rise out of the film first, so the polygons seem to surface. Low pale
// islands stand here and there with tola, cardón cacti and golden ichu; now
// and then a tea house on stilts with a boardwalk running out to a patch of
// salt, an old train car left on the crust, or rows of heaped salt cones.
// Rose lagoons tint the water pink where the flamingos gather.
//
// Everything is a function of the fixed seed and the position (see
// ../types.ts). The big one-offs (islands, sites) live on coarse cells so a
// pixel only ever asks its own cell; each pixel then adds its own small
// noise: the clouds the mirror holds, the stars by night, the crust's cracks.
//
// No Phaser here: the land worker and scripts/lands.ts grow it too.

import { hash2, rng, valueNoise } from '../../../art/env';
import { smooth } from '../paint';
import { CHUNK, LAND_MID, type ChunkLayout, type GroundCell, type LandGen, type LandGround, type LandLight, type LandProp, type LifeSpot, type TileFields } from '../types';
import { K, SALT_KINDS } from './palette';

/** The one Saltglass Flats everyone walks. */
export const SALT_SEED = 70913;

// ---------------------------------------------------------------- the crust

/** The dryness field's scales and weights: broad pans, patches, ragged edges. */
const DRY_SCALES: [number, number][] = [[560, 0.6], [180, 0.3], [52, 0.1]];
/** Crust where dryness passes DRY_T; a film of water over the salt for FILM below that. */
const DRY_T = 0.645;
const FILM = 0.045;
/** The salt's polygons: their grid (px), how squashed they look at the view's slant, and their ridges' half width. */
const POLY = 19;
const POLY_SQUASH = 0.74;
const RIDGE = 1.15;
/** The share of polygons deep in the crust that are an ojo, an eye of water. */
const OJO_ODDS = 0.012;
const OJO_R = 3.6;

// ---------------------------------------------------------------- the sky in the mirror

/** The clear sky's slow change of blue (px). */
const SKY_SCALE = 900;
/** Clouds: where their bank begins and is whole, how much wider than tall they are, and the grid their puffs heap on (px, stretched). */
const CLOUD_LO = 0.5;
const CLOUD_HI = 0.72;
const CLOUD_STRETCH = 0.62;
const PUFF = 16;
/** Stars in the mirror: a share of clear pixels, more in the Milky Way's band. */
const STAR_ODDS = 0.0026;
const BAND_STAR_ODDS = 0.011;
/** The Milky Way: a band across the sky (its period along the diagonal, px / 2π) and how narrow it is. */
const BAND_PERIOD = 340;
const BAND_EDGE: [number, number] = [0.8, 0.97];
/** Rose lagoons where their field passes this. */
const ROSE_T = 0.75;
/** Their pale rim, where pink water meets the mirror. */
const ROSE_RIM = 0.008;

// ---------------------------------------------------------------- islands

/** One island at most per cell (px), at these odds, this big (rx px); kept well inside its cell. */
const ISLE_CELL = 720;
const ISLE_ODDS = 0.5;
const ISLE_R: [number, number] = [50, 96];
const ISLE_MARGIN = 240;
/** Islands are this much wider than tall. */
const ISLE_SQUASH = 1.35;
/** Their salt beach, out to this far (in island radii). */
const BEACH = 1.12;

// ---------------------------------------------------------------- sites

/** One site at most per cell (px): a tea house and its boardwalk, an old train car, or a field of salt cones. */
const SITE_CELL = 1100;
const TEA_ODDS = 0.12;
const TRAIN_ODDS = 0.1;
const PILES_ODDS = 0.16;
/** The boardwalk: from the tea house's steps (px from its middle), this long, its deck this many rows, posts this far apart. */
const HOUSE_HALF = 34;
const WALK_LEN: [number, number] = [130, 180];
const DECK_TOP = 11;
const DECK_BOTTOM = 3;
const POSTS = 16;
/** Salt cones: rows of them, this far apart (px). */
const CONE_STEP: [number, number] = [22, 16];
const TEA_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 120, color: 0xffb46a, intensity: 1.25, day: 0, flicker: 0.25, halo: 0.55 };
const LAMP_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 90, color: 0xffb35e, intensity: 1.05, day: 0, flicker: 0.3, halo: 0.5 };
const TRAIN_LIGHT: Omit<LandLight, 'x' | 'y'> = { radius: 95, color: 0xffc070, intensity: 0.95, day: 0, flicker: 0.15, halo: 0.35 };

interface Isle {
  x: number;
  y: number;
  r: number;
  seed: number;
}

export interface Site {
  kind: 'tea' | 'train' | 'piles';
  x: number;
  y: number;
  /** The tea house's boardwalk runs west (-1) or east (1), this long. */
  side: number;
  len: number;
  flip: boolean;
  seed: number;
}

const ROW = 4096;

export class SaltGen implements LandGen {
  readonly seed = SALT_SEED;
  readonly ground: LandGround;
  private isles = new Map<number, Isle | null>();
  private sites = new Map<number, Site | null>();
  private lastIsleKey = NaN;
  private lastIsle: Isle | null = null;
  private lastSiteKey = NaN;
  private lastSite: Site | null = null;
  /** The last polygon found: distance to its nearest edge, its own 0..1, distance to its middle. */
  private pe = 0;
  private ph = 0;
  private pd = 0;
  private pts = new Float64Array(18);
  /** The last cloud puff found (see puff). */
  private cSize = 0;
  private cRim = 0;
  private cOwn = 0;

  constructor() {
    const self = this;
    this.ground = {
      kinds: SALT_KINDS,
      cell: (x, y, c) => self.cell(x, y, c),
      decorate: (f) => self.decorate(f),
    };
  }

  /** A well-mixed 0..1 draw for cell (i, j). */
  private draw(i: number, j: number, salt: number): number {
    let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(salt + this.seed, 0x9e3779b9);
    // Mixed twice, j folded in between, so neighbouring cells don't come out alike.
    for (let k = 0; k < 2; k++) {
      h ^= h >>> 16;
      h = Math.imul(h, 0x7feb352d);
      h ^= h >>> 15;
      h = Math.imul(h, 0x846ca68b);
      h ^= h >>> 16;
      if (k === 0) h ^= Math.imul(j, 0x165667b1);
    }
    return (h >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- sites and islands, by cell

  /** The site of cell (i, j), if it has one. The cell the wanderer starts in always has a tea house. */
  siteOf(i: number, j: number): Site | null {
    const key = i * ROW + j;
    const had = this.sites.get(key);
    if (had !== undefined) return had;
    let s: Site | null = null;
    const ox = i * SITE_CELL;
    const oy = j * SITE_CELL;
    const d = (k: number) => this.draw(i, j, k);
    const si = Math.floor(LAND_MID / SITE_CELL);
    if (i === si && j === si) {
      s = { kind: 'tea', x: LAND_MID + 176, y: LAND_MID + 14, side: -1, len: 140, flip: false, seed: 7 };
    } else {
      const r = d(1);
      if (r < TEA_ODDS) {
        s = { kind: 'tea', x: ox + 400 + Math.floor(d(2) * 300), y: oy + 220 + Math.floor(d(3) * 660), side: d(4) < 0.5 ? -1 : 1, len: WALK_LEN[0] + Math.floor(d(5) * WALK_LEN[1]), flip: false, seed: Math.floor(d(6) * 1e6) };
      } else if (r < TEA_ODDS + TRAIN_ODDS) {
        s = { kind: 'train', x: ox + 250 + Math.floor(d(2) * 600), y: oy + 220 + Math.floor(d(3) * 660), side: 0, len: 0, flip: d(4) < 0.5, seed: Math.floor(d(6) * 1e6) };
      } else if (r < TEA_ODDS + TRAIN_ODDS + PILES_ODDS) {
        s = { kind: 'piles', x: ox + 250 + Math.floor(d(2) * 600), y: oy + 220 + Math.floor(d(3) * 660), side: 0, len: 0, flip: false, seed: Math.floor(d(6) * 1e6) };
      }
    }
    if (this.sites.size > 1024) this.sites.clear();
    this.sites.set(key, s);
    return s;
  }

  private siteAt(x: number, y: number): Site | null {
    const i = Math.floor(x / SITE_CELL);
    const j = Math.floor(y / SITE_CELL);
    const key = i * ROW + j;
    if (key !== this.lastSiteKey) {
      this.lastSiteKey = key;
      this.lastSite = this.siteOf(i, j);
    }
    return this.lastSite;
  }

  /** The island of cell (i, j), if it has one (never crowding a site). */
  isleOf(i: number, j: number): Isle | null {
    const key = i * ROW + j;
    const had = this.isles.get(key);
    if (had !== undefined) return had;
    let isle: Isle | null = null;
    if (this.draw(i, j, 101) < ISLE_ODDS) {
      const x = i * ISLE_CELL + ISLE_MARGIN + this.draw(i, j, 102) * (ISLE_CELL - ISLE_MARGIN * 2);
      const y = j * ISLE_CELL + ISLE_MARGIN + this.draw(i, j, 103) * (ISLE_CELL - ISLE_MARGIN * 2);
      const r = ISLE_R[0] + this.draw(i, j, 104) * (ISLE_R[1] - ISLE_R[0]);
      isle = { x, y, r, seed: Math.floor(this.draw(i, j, 105) * 1e6) };
      const si = Math.floor(x / SITE_CELL);
      const sj = Math.floor(y / SITE_CELL);
      for (let b = sj - 1; b <= sj + 1 && isle; b++) {
        for (let a = si - 1; a <= si + 1 && isle; a++) {
          const s = this.siteOf(a, b);
          if (!s) continue;
          const reach = s.kind === 'tea' ? s.len + 140 : 150;
          if (Math.hypot(x - s.x, (y - s.y) * 1.3) < r * 2.4 + reach) isle = null;
        }
      }
    }
    if (this.isles.size > 1024) this.isles.clear();
    this.isles.set(key, isle);
    return isle;
  }

  private isleAt(x: number, y: number): Isle | null {
    const i = Math.floor(x / ISLE_CELL);
    const j = Math.floor(y / ISLE_CELL);
    const key = i * ROW + j;
    if (key !== this.lastIsleKey) {
      this.lastIsleKey = key;
      this.lastIsle = this.isleOf(i, j);
    }
    return this.lastIsle;
  }

  /** How far out from island `s` (x, y) is, in its ragged radii: under 1 is the island. */
  private isleE(x: number, y: number, s: Isle): number {
    const dx = x - s.x;
    const dy = (y - s.y) * ISLE_SQUASH;
    const d = Math.hypot(dx, dy);
    if (d > s.r * 2.4) return 9;
    return d / (s.r * (0.78 + 0.44 * valueNoise(x, y, s.r * 0.7, s.seed)));
  }

  // ---------------------------------------------------------------- the fields

  /** How dry the flat is at (x, y): crust past DRY_T. Islands wear aprons of salt; sites shape the ground round them. */
  dryAt(x: number, y: number, isleE: number, site: Site | null): number {
    const s = this.seed;
    let v = valueNoise(x, y, DRY_SCALES[0][0], s + 1) * DRY_SCALES[0][1] + valueNoise(x, y, DRY_SCALES[1][0], s + 2) * DRY_SCALES[1][1];
    const [fine, w] = DRY_SCALES[2];
    // Far out on open water the finest octave can't bring the salt near, so it isn't worked out.
    if (!site && isleE >= 1.9 && v + w < DRY_T - FILM - 0.04) return v + w * 0.5;
    v += valueNoise(x, y, fine, s + 3) * w;
    if (isleE < 1.9) v += 0.24 * (1 - smooth(1, 1.9, isleE));
    if (!site) return v;
    if (site.kind === 'tea') {
      // Open water round the house, and a patch of salt where its boardwalk lands.
      v -= 0.34 * (1 - smooth(60, 150, Math.hypot(x - site.x, (y - site.y) * 1.3)));
      const ex = site.x + site.side * (HOUSE_HALF + site.len + 26);
      v += 0.42 * (1 - smooth(30, 88, Math.hypot(x - ex, (y - site.y + 6) * 1.3)));
    } else if (site.kind === 'train') {
      v += 0.36 * (1 - smooth(52, 118, Math.hypot(x - site.x, (y - site.y) * 1.4)));
    } else {
      // Salt cones stand in the thinnest film, the polygons just breaking the surface.
      const k = 1 - smooth(50, 140, Math.hypot(x - site.x, (y - site.y) * 1.3) * (0.7 + valueNoise(x, y, 44, this.seed + 5) * 0.6));
      v += (DRY_T - FILM * (0.1 + valueNoise(x, y, 26, this.seed + 6) * 0.6) - v) * k;
    }
    return v;
  }

  /**
   * The clouds the mirror holds: round puffs heaped wherever the cloud bank
   * is thick, so they read as crisp cumulus rather than a blur. How high the
   * puff stands at (x, y) (0 for clear sky); sets cSize (how thick the bank
   * is), cRim (how far toward the puff's sunny upper left) and cOwn (its own shade).
   */
  private puff(x: number, y: number): number {
    const s = this.seed;
    const sx = x * CLOUD_STRETCH;
    const bank = valueNoise(sx, y, 200, s + 31) * 0.65 + valueNoise(sx, y, 70, s + 32) * 0.35;
    const size = smooth(CLOUD_LO, CLOUD_HI, bank);
    this.cSize = size;
    if (size <= 0) return 0;
    const gx = Math.floor(sx / PUFF);
    const gy = Math.floor(y / PUFF);
    let best = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const ci = gx + i;
        const cj = gy + j;
        const h = hash2(ci, cj, s + 335);
        // At the bank's thin edge only some puffs form, so it frays into a few clouds, not a froth of little ones.
        if (h > size * 2.4) continue;
        const r = (5 + h * 6) * (0.55 + size * 0.75);
        const dx = (sx - (ci + 0.1 + hash2(ci, cj, s + 331) * 0.8) * PUFF) / r;
        const dy = (y - (cj + 0.1 + hash2(ci, cj, s + 333) * 0.8) * PUFF) / (r * 0.75);
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const z = Math.sqrt(1 - d2) + h * 0.5;
        if (z > best) {
          best = z;
          this.cRim = -dx * 0.55 - dy * 0.85;
          this.cOwn = h;
        }
      }
    }
    // Deep in the bank the puffs run together.
    if (best === 0 && size > 0.88) {
      best = 0.2;
      this.cRim = 0;
      this.cOwn = 0.5;
    }
    return best;
  }

  /** The Milky Way's band (0..1). */
  private band(x: number, y: number): number {
    const w = Math.sin((x * 0.5 + y * 0.86) / BAND_PERIOD + valueNoise(x, y, 500, this.seed + 61) * 2.4);
    return smooth(BAND_EDGE[0], BAND_EDGE[1], w);
  }

  private rose(x: number, y: number): number {
    const broad = valueNoise(x, y, 340, this.seed + 11) * 0.7;
    // Too low for a lagoon whatever the finer octave says.
    if (broad + 0.3 <= ROSE_T) return broad;
    return broad + valueNoise(x, y, 96, this.seed + 12) * 0.3;
  }

  /** The salt's polygons at (x, y): sets pe (distance to the nearest crack), ph (the polygon's own 0..1) and pd (distance to its middle). */
  private poly(x: number, y: number): void {
    const s = this.seed;
    const yy = y / POLY_SQUASH;
    const gx = Math.floor(x / POLY);
    const gy = Math.floor(yy / POLY);
    const P = this.pts;
    let best = 0;
    let bd = Infinity;
    let n = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const ci = gx + i;
        const cj = gy + j;
        const px = (ci + 0.12 + hash2(ci, cj, s + 301) * 0.76) * POLY;
        const py = (cj + 0.12 + hash2(ci, cj, s + 303) * 0.76) * POLY;
        P[n * 2] = px;
        P[n * 2 + 1] = py;
        const d = (x - px) * (x - px) + (yy - py) * (yy - py);
        if (d < bd) {
          bd = d;
          best = n;
        }
        n++;
      }
    }
    const ax = P[best * 2];
    const ay = P[best * 2 + 1];
    let e = Infinity;
    for (let k = 0; k < 9; k++) {
      if (k === best) continue;
      const bx = P[k * 2];
      const by = P[k * 2 + 1];
      const vx = bx - ax;
      const vy = by - ay;
      const l = Math.hypot(vx, vy);
      // Distance to the line halfway between the two polygons' middles.
      const t = ((x - (ax + bx) / 2) * vx + (yy - (ay + by) / 2) * vy) / l;
      if (-t < e) e = -t;
    }
    this.pe = e;
    this.pd = Math.sqrt(bd);
    this.ph = hash2(gx + (best % 3) - 1, gy + Math.floor(best / 3) - 1, s + 307);
  }

  // ---------------------------------------------------------------- the ground, a pixel at a time

  cell(x: number, y: number, c: GroundCell): void {
    const site = this.siteAt(x, y);
    if (site && site.kind === 'tea' && this.walk(x, y, site, c)) return;
    const isle = this.isleAt(x, y);
    const e = isle ? this.isleE(x, y, isle) : 9;
    if (e < 1) return this.island(x, y, e, isle!, c);
    if (e < BEACH) {
      // The island's beach: a ring of bright salt, crusted thick.
      c.kind = K.Salt;
      c.height = 0.6 * (1 - (e - 1) / (BEACH - 1)) + valueNoise(x, y, 4, this.seed + 121) * 0.4;
      c.tone = 0.8 + (valueNoise(x, y, 6, this.seed + 123) - 0.5) * 0.9;
      return;
    }
    const v = this.dryAt(x, y, e, site);
    if (v > DRY_T) return this.crust(x, y, v, c);
    if (v > DRY_T - FILM) return this.film(x, y, (v - (DRY_T - FILM)) / FILM, c);
    this.mirror(x, y, v, site, c);
  }

  /** Open water: the sky, its clouds, and by night its stars and the Milky Way. */
  private mirror(x: number, y: number, v: number, site: Site | null, c: GroundCell): void {
    const s = this.seed;
    c.kind = K.Mirror;
    const z = this.puff(x, y);
    let t = 0.6 + valueNoise(x, y, SKY_SCALE, s + 21) * 2.4;
    if (z > 0) {
      // Each puff gold-white on its sunny upper left, lavender on its far side, darker where puffs tuck under one another.
      const r = this.cRim;
      t = 5 + this.cSize * 2.6 + this.cOwn * 1.2 + (r > 0.45 ? 2.3 : r > 0.1 ? 1 : 0) - (r < -0.45 ? 1.5 : 0) - (z < 0.32 ? 1.1 : 0);
    }
    else {
      // High wisps of cirrus, combed out by the wind.
      const patch = smooth(0.5, 0.7, valueNoise(x, y, 420, s + 27));
      if (patch > 0) t += smooth(0.64, 0.82, valueNoise(x * 0.22, y * 1.6, 34, s + 25)) * patch * 2.2;
    }
    // A breath of wind: faint streaks across the glass, here and there.
    if (valueNoise(x, y, 300, s + 41) > 0.74 && valueNoise(x * 0.12, y * 2.4, 6, s + 43) > 0.86) t += 0.6;
    // The water darkens a little toward the salt's edge, where it's shallowest over the grey mud.
    t -= smooth(DRY_T - FILM - 0.04, DRY_T - FILM, v) * 0.8;
    if (site && site.kind === 'tea') t -= this.deckReflection(x, y, site);
    // Never round a tea house, whose reflection wants the plain sky.
    const rv = site && site.kind === 'tea' && Math.abs(x - site.x) < 240 && Math.abs(y - site.y) < 200 ? 0 : this.rose(x, y);
    if (rv > ROSE_T) {
      // A rose lagoon: the water itself is pink and holds the sky only faintly, ringed by a pale rim.
      c.kind = K.Rose;
      if (rv < ROSE_T + ROSE_RIM) t = 8.5;
      else {
        // Deeper pink toward the middle, slow swirls of the algae that colour it.
        const swirl = valueNoise(x * 0.45 + valueNoise(x, y, 60, s + 15) * 40, y * 1.3, 16, s + 17);
        t = 1.8 + (t - 1.6) * 0.35 - smooth(ROSE_T + 0.02, ROSE_T + 0.1, rv) * 1.3 + (swirl > 0.64 ? 0.9 : swirl < 0.3 ? -0.5 : 0) + (rv < ROSE_T + ROSE_RIM * 2.5 ? 2 : 0);
      }
    }
    c.tone = t;
    if (z === 0) {
      const clear = 1 - this.cSize;
      const band = this.band(x, y);
      const odds = STAR_ODDS + band * BAND_STAR_ODDS;
      const h = hash2(x, y, s + 51);
      if (h > 1 - odds) {
        c.glow = (0.35 + ((h - 1 + odds) / odds) * 0.65) * clear;
        if (c.kind === K.Mirror && hash2(x, y, s + 53) < 0.3) c.kind = K.Warm;
      } else if (band > 0) {
        // The Milky Way's haze, mottled, with its dark lanes of dust.
        const lane = smooth(0.56, 0.72, valueNoise(x, y, 90, s + 65));
        c.glow = band * (0.05 + 0.13 * valueNoise(x, y, 26, s + 63)) * (1 - lane * 0.8) * clear;
      }
    }
  }

  /** How much a boardwalk darkens the water below it: its reflection, and its posts'. */
  private deckReflection(x: number, y: number, site: Site): number {
    const [xa, xb] = this.walkSpan(site);
    if (x < xa || x >= xb) return 0;
    const yb = site.y - DECK_BOTTOM;
    const dy = y - yb;
    if (dy < 3 || dy > 12) return 0;
    if ((x - xa) % POSTS < 2 && dy < 12) return 3.2;
    return dy < 7 ? 2.2 - (dy - 3) * 0.3 : 0;
  }

  /** A film of water over the crust: the ridges break its surface first. */
  private film(x: number, y: number, f: number, c: GroundCell): void {
    const s = this.seed;
    this.poly(x, y);
    const w = RIDGE * (0.2 + f * 1.15);
    if (this.pe < w) {
      c.kind = K.Salt;
      c.tone = -1.3 + f * 0.9;
      c.height = 0.5 * (1 - this.pe / w) + f * 0.3;
      return;
    }
    c.kind = K.Film;
    const cv = this.puff(x, y) > 0 ? 0.4 + this.cSize * 0.6 : 0;
    // The sky shows paler the thinner the film; a bright lip of wet salt along each ridge.
    c.tone = 0.8 + cv * 3.6 + f * 2.4 + (this.pe < w + 1.2 ? 1 : 0);
    if (cv < 0.2 && hash2(x, y, s + 51) > 1 - STAR_ODDS * 0.6) c.glow = 0.35;
  }

  /** The salt crust: polygons with raised ridges between, the odd ojo of deep water. */
  private crust(x: number, y: number, v: number, c: GroundCell): void {
    const s = this.seed;
    this.poly(x, y);
    const deep = v - DRY_T;
    c.kind = K.Salt;
    if (this.ph > 1 - OJO_ODDS && deep > 0.06 && this.pe > 2) {
      if (this.pd < OJO_R) {
        c.kind = K.Ojo;
        c.tone = this.pd / OJO_R * 3.2 + (this.pd > OJO_R - 1 ? 1 : 0);
        if (hash2(x, y, s + 55) > 0.9) c.glow = 0.4;
        return;
      }
      if (this.pd < OJO_R + 1.6) {
        c.height = 0.9;
        c.tone = 2;
        return;
      }
    }
    const firm = Math.min(1, deep * 8);
    if (this.pe < RIDGE) {
      c.height = 0.25 + 0.6 * (1 - this.pe / RIDGE) * (0.55 + firm * 0.45);
      c.tone = 1.1;
      return;
    }
    c.height = 0.12 + valueNoise(x, y, 5, s + 311) * 0.18;
    c.tone = (this.ph - 0.5) * 0.6 + (valueNoise(x, y, 7, s + 313) - 0.5) * 0.6 - (this.pe < RIDGE + 1.2 ? 0.4 : 0);
  }

  /** An island: pale earth rising to a low dome, outcrops of old coral stone. */
  private island(x: number, y: number, e: number, isle: Isle, c: GroundCell): void {
    const dome = (1 - e * e) * isle.r * 0.075;
    const rk = valueNoise(x, y, 11, isle.seed + 7) * 0.6 + valueNoise(x, y, 30, isle.seed + 9) * 0.4;
    if (rk > 0.64 && e < 0.86) {
      c.kind = K.Rock;
      c.height = dome + (rk - 0.64) * 28;
      c.tone = (valueNoise(x, y, 3, isle.seed + 11) - 0.5) * 1.4 + (hash2(x, y, isle.seed) > 0.9 ? -1.5 : 0);
      return;
    }
    c.kind = K.Earth;
    c.height = dome + valueNoise(x, y, 9, isle.seed + 13) * 0.5;
    c.tone = (valueNoise(x, y, 40, isle.seed + 15) - 0.5) * 1.0 - (e > 0.9 ? (e - 0.9) * 12 : 0);
    // Its low bank on the near (south) side, a step down to the salt.
    if (e > 0.9 && y > isle.y + 4) {
      c.height = dome * 0.4;
      c.tone -= 1.4 + (e - 0.9) * 8;
    }
  }

  private walkSpan(site: Site): [number, number] {
    return site.side > 0 ? [site.x + HOUSE_HALF, site.x + HOUSE_HALF + site.len] : [site.x - HOUSE_HALF - site.len, site.x - HOUSE_HALF];
  }

  /** The boardwalk from a tea house: boards across it, its face and posts below. False off it. */
  private walk(x: number, y: number, site: Site, c: GroundCell): boolean {
    const [xa, xb] = this.walkSpan(site);
    if (x < xa || x >= xb) return false;
    const y0 = site.y - DECK_TOP;
    const y1 = site.y - DECK_BOTTOM;
    if (y < y0 || y > y1 + 5) return false;
    const lx = x - xa;
    if (y <= y1) {
      c.height = 3;
      if (y === y0) {
        c.kind = K.Beam;
        c.tone = 1;
        c.height = 3.3;
      } else if (lx % 4 === 3) {
        c.kind = K.Beam;
        c.tone = 0.4;
        c.height = 2.6;
      } else {
        const board = Math.floor(lx / 4);
        c.kind = K.Plank;
        c.tone = (hash2(board, site.seed, this.seed + 91) - 0.5) * 1.4 + (hash2(board, y >> 2, this.seed + 93) > 0.88 ? -0.8 : 0) + (y === y0 + 1 ? 0.6 : 0);
      }
      return true;
    }
    if (y <= y1 + 2) {
      // The deck's front face.
      c.kind = K.Beam;
      c.tone = y === y1 + 1 ? 0.6 : -0.6;
      c.height = 2;
      return true;
    }
    if (lx % POSTS < 2) {
      c.kind = K.Beam;
      c.tone = lx % POSTS === 0 ? 0 : -1;
      c.height = 1;
      return true;
    }
    return false;
  }

  /** Small things over the finished ground: salt crystals, ichu grass and pebbles on the islands, bright stars. */
  decorate(f: TileFields): void {
    const R = rng(Math.floor(hash2(f.x0 / 64, f.y0 / 64, this.seed + 401) * 2 ** 31));
    const at = (x: number, y: number) => (y - f.y0 + 1) * f.pw + (x - f.x0) + 1;
    const inside = (x: number, y: number) => x >= f.x0 - 1 && x <= f.x0 + f.w && y >= f.y0 - 1 && y <= f.y0 + f.h;
    const W = f.w;
    const H = f.h;
    // Salt crystals heaped in little clusters on the crust's polygons.
    for (let k = 0; k < (W * H) / 140; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      const i = at(x, y);
      if (f.kind[i] !== K.Salt || f.height[i] > 0.4) continue;
      const n = 1 + Math.floor(R() * R() * 4);
      const gl = R() < 0.4 ? 0.3 + R() * 0.4 : 0;
      for (let q = 0; q < n; q++) {
        const cx = x + (q === 1 ? 1 : q === 3 ? -1 : 0);
        const cy = y + (q === 2 ? -1 : 0);
        if (!inside(cx, cy)) continue;
        const b = at(cx, cy);
        if (f.kind[b] !== K.Salt) continue;
        f.kind[b] = K.Crystal;
        f.height[b] += 0.25;
        f.tone[b] = q === 2 ? 1.5 : 0.6 + R();
        f.glow[b] = gl;
      }
    }
    // Ichu: tufts of golden grass on the islands, and pebbles of coral stone.
    for (let k = 0; k < (W * H) / 18; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      const i = at(x, y);
      if (f.kind[i] !== K.Earth) continue;
      if (valueNoise(x, y, 24, this.seed + 411) < 0.42) continue;
      const len = 2 + Math.floor(R() * 3);
      const lean = R() < 0.5 ? -1 : 1;
      for (let j = 0; j < len; j++) {
        const bx = x + (j >= 2 && R() < 0.6 ? lean : 0);
        const by = y - j;
        if (!inside(bx, by)) break;
        const b = at(bx, by);
        if (f.kind[b] !== K.Earth && f.kind[b] !== K.Ichu) break;
        f.kind[b] = K.Ichu;
        f.height[b] += 0.5 + j * 0.3;
        f.tone[b] = (j - 1) * 0.7 + (lean < 0 ? 0.5 : -0.3);
      }
    }
    for (let k = 0; k < (W * H) / 500; k++) {
      const x = f.x0 + Math.floor(R() * W);
      const y = f.y0 + Math.floor(R() * H);
      if (f.kind[at(x, y)] !== K.Earth) continue;
      const big = R() < 0.3;
      for (const [i, j] of big ? PEBBLE_BIG : PEBBLE) {
        if (!inside(x + i, y + j)) continue;
        const b = at(x + i, y + j);
        if (f.kind[b] !== K.Earth && f.kind[b] !== K.Ichu) continue;
        f.kind[b] = K.Rock;
        f.height[b] += 1 + (j < 0 ? 0.5 : 0);
        f.tone[b] = 1.2 + (j < 0 ? 0.6 : 0) + (i > 0 ? -0.5 : 0);
      }
    }
    // The brightest stars, with a cross of light (only seen by night).
    for (let k = 0; k < (W * H) / 3800; k++) {
      const x = f.x0 + 1 + Math.floor(R() * (W - 2));
      const y = f.y0 + 1 + Math.floor(R() * (H - 2));
      const i = at(x, y);
      const kd = f.kind[i];
      if ((kd !== K.Mirror && kd !== K.Warm && kd !== K.Rose) || f.tone[i] > 3.4) continue;
      const warm = kd !== K.Rose && R() < 0.3;
      for (const [dx, dy, g] of CROSS) {
        const b = at(x + dx, y + dy);
        const kb = f.kind[b];
        if (kb !== K.Mirror && kb !== K.Warm && kb !== K.Rose) continue;
        if (warm && kb === K.Mirror) f.kind[b] = K.Warm;
        f.glow[b] = Math.max(f.glow[b], g);
      }
    }
  }

  // ---------------------------------------------------------------- feet

  /** Ankle-deep everywhere: all of the flat can be walked; only what stands blocks. */
  open(_x: number, _y: number): boolean {
    return true;
  }

  spawn(): { x: number; y: number } {
    // On the patch of salt where the first tea house's boardwalk lands, looking out over the glass.
    return { x: LAND_MID - 30, y: LAND_MID + 6 };
  }

  // ---------------------------------------------------------------- questions the land's life asks

  /** Is (x, y) water (the mirror, a rose lagoon or the film over the crust), off any boardwalk? */
  wet(x: number, y: number): boolean {
    const site = this.siteAt(x, y);
    if (site && site.kind === 'tea' && this.onWalk(x, y, site)) return false;
    const isle = this.isleAt(x, y);
    const e = isle ? this.isleE(x, y, isle) : 9;
    if (e < BEACH) return false;
    return this.dryAt(x, y, e, site) < DRY_T;
  }

  /** Is (x, y) open mirror under a clear sky (where stars twinkle and the sun glints)? */
  clearSky(x: number, y: number): boolean {
    const site = this.siteAt(x, y);
    if (site && site.kind === 'tea' && this.onWalk(x, y, site)) return false;
    const isle = this.isleAt(x, y);
    const e = isle ? this.isleE(x, y, isle) : 9;
    if (e < BEACH * 1.2) return false;
    if (this.dryAt(x, y, e, site) > DRY_T - FILM) return false;
    return this.puff(x, y) === 0 && this.cSize < 0.3;
  }

  /** Is (x, y) a rose lagoon? */
  rosy(x: number, y: number): boolean {
    return this.rose(x, y) > ROSE_T && this.wet(x, y);
  }

  private onWalk(x: number, y: number, site: Site): boolean {
    const [xa, xb] = this.walkSpan(site);
    return x >= xa && x < xb && y >= site.y - DECK_TOP - 1 && y <= site.y - DECK_BOTTOM + 3;
  }

  /** Is (x, y) kept clear for a site's buildings and boardwalk? */
  private crowds(x: number, y: number): boolean {
    for (const s of this.sitesNear(x, y)) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (s.kind === 'tea') {
        if (Math.abs(dx) < 54 && dy > -112 && dy < 34) return true;
        const [xa, xb] = this.walkSpan(s);
        if (x > xa - 14 && x < xb + 14 && dy > -34 && dy < 18) return true;
      } else if (s.kind === 'train') {
        if (Math.abs(dx) < 66 && dy > -64 && dy < 22) return true;
      } else if (Math.hypot(dx, dy * 1.3) < 92) return true;
    }
    return false;
  }

  private sitesNear(x: number, y: number): Site[] {
    const out: Site[] = [];
    const i = Math.floor(x / SITE_CELL);
    const j = Math.floor(y / SITE_CELL);
    for (let b = j - 1; b <= j + 1; b++) {
      for (let a = i - 1; a <= i + 1; a++) {
        const s = this.siteOf(a, b);
        if (s && Math.abs(s.x - x) < 520 && Math.abs(s.y - y) < 200) out.push(s);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- what stands

  layout(cx: number, cy: number): ChunkLayout {
    const props: LandProp[] = [];
    const lights: LandLight[] = [];
    const life: LifeSpot[] = [];
    const R = rng(Math.floor(hash2(cx, cy, this.seed + 501) * 2 ** 31));
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const inChunk = (x: number, y: number) => x >= x0 && x < x0 + CHUNK && y >= y0 && y < y0 + CHUNK;

    // The sites whose things stand in this chunk.
    for (const s of this.sitesNear(x0 + CHUNK / 2, y0 + CHUNK / 2)) {
      if (s.kind === 'tea') {
        if (inChunk(s.x, s.y)) {
          props.push({ sheet: 'salt_teahouse', frame: 'tea', x: s.x, y: s.y, block: { rx: 30, ry: 7, oy: -5 } });
          lights.push({ x: s.x, y: s.y - 46, ...TEA_LIGHT });
        }
        // A lantern where the boardwalk ends.
        const lx = s.x + s.side * (HOUSE_HALF + s.len - 4);
        const ly = s.y - DECK_TOP + 1;
        if (inChunk(lx, ly)) {
          props.push({ sheet: 'salt_lamp', frame: 'l0', x: lx, y: ly, block: { rx: 3, ry: 2 } });
          lights.push({ x: lx, y: ly - 26, ...LAMP_LIGHT });
        }
      } else if (s.kind === 'train') {
        if (inChunk(s.x, s.y)) {
          props.push({ sheet: 'salt_train', frame: 'car', x: s.x, y: s.y, flip: s.flip, block: { rx: 46, ry: 8, oy: -6 } });
          lights.push({ x: s.x + (s.flip ? 18 : -18), y: s.y - 20, ...TRAIN_LIGHT });
        }
      } else {
        // Rows of salt cones, raked up by hand and left to dry.
        const Rp = rng(s.seed);
        const cols = 5 + Math.floor(Rp() * 3);
        const rows = 3 + Math.floor(Rp() * 2);
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const x = Math.round(s.x + (i - (cols - 1) / 2) * CONE_STEP[0] + (j % 2) * 6 + (Rp() - 0.5) * 4);
            const y = Math.round(s.y + (j - (rows - 1) / 2) * CONE_STEP[1] + (Rp() - 0.5) * 3);
            const v = Rp();
            if (Rp() < 0.12 || !inChunk(x, y)) continue;
            props.push({ sheet: 'salt_pile', frame: `p${Math.floor(v * 3)}`, x, y, flip: Rp() < 0.5, block: { rx: 6, ry: 3, oy: -1 } });
          }
        }
      }
    }

    // What's scattered: island plants, cairns and wind chimes on the salt and in the water.
    const G = 32;
    for (let j = 0; j < CHUNK / G; j++) {
      for (let i = 0; i < CHUNK / G; i++) {
        const x = Math.round(x0 + (i + 0.15 + R() * 0.7) * G);
        const y = Math.round(y0 + (j + 0.15 + R() * 0.7) * G);
        const r = R();
        const v = R();
        const flip = R() < 0.5;
        if (this.crowds(x, y)) continue;
        const isle = this.isleAt(x, y);
        const e = isle ? this.isleE(x, y, isle) : 9;
        if (e < 0.9) {
          if (r < 0.2) props.push({ sheet: 'salt_shrub', frame: `b${Math.floor(v * 3)}`, x, y, flip, block: { rx: 8, ry: 3.5 } });
          else if (r < 0.32 && e < 0.72) props.push({ sheet: 'salt_cactus', frame: `k${Math.floor(v * 3)}`, x, y, flip, block: { rx: 4, ry: 2.5 } });
          else if (r < 0.4) props.push(rock(x, y, v, flip));
          else if (r < 0.8) grass(props, R, x, y, 1 + Math.floor(R() * 3));
          continue;
        }
        if (e < BEACH + 0.1) {
          if (r < 0.06) props.push(cairn(x, y, v, flip));
          continue;
        }
        const dry = this.dryAt(x, y, e, this.siteAt(x, y));
        if (dry > DRY_T) {
          if (r < 0.014) props.push(cairn(x, y, v, flip));
          else if (r < 0.02) props.push(chime(x, y, v));
        } else {
          if (r < 0.006) props.push(cairn(x, y, v, flip));
          else if (r < 0.0085) props.push(chime(x, y, v));
        }
      }
    }

    // Flamingos: flocks in the rose lagoons, a pair now and then on the open glass.
    const mx = x0 + CHUNK / 2;
    const my = y0 + CHUNK / 2;
    let flock: { x: number; y: number } | null = null;
    for (let k = 0; k < 10 && !flock; k++) {
      const x = x0 + 30 + R() * (CHUNK - 60);
      const y = y0 + 30 + R() * (CHUNK - 60);
      if (this.rose(x, y) > ROSE_T + 0.02) flock = { x, y };
    }
    if (flock && R() < 0.8) {
      const n = 5 + Math.floor(R() * 6);
      const fx = flock.x;
      const fy = flock.y;
      for (let k = 0; k < n; k++) {
        const x = Math.round(fx + (R() - 0.5) * 90);
        const y = Math.round(fy + (R() - 0.5) * 44);
        if (this.rosy(x, y) && !this.crowds(x, y)) life.push({ kind: 'flamingo', x, y });
      }
    } else if (R() < 0.05) {
      const x = Math.round(mx + (R() - 0.5) * 160);
      const y = Math.round(my + (R() - 0.5) * 160);
      for (let k = 0; k < 2; k++) if (this.wet(x + k * 14, y + k * 5) && !this.crowds(x + k * 14, y + k * 5)) life.push({ kind: 'flamingo', x: x + k * 14, y: y + k * 5 });
    }
    return { props, lights, life };
  }
}

/** Little shapes stamped into the ground: [dx, dy] and [dx, dy, glow]. */
const PEBBLE: [number, number][] = [[0, 0], [1, 0]];
const PEBBLE_BIG: [number, number][] = [[0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [1, 1]];
const CROSS: [number, number, number][] = [[0, 0, 1], [-1, 0, 0.45], [1, 0, 0.45], [0, -1, 0.45], [0, 1, 0.45]];

const cairn = (x: number, y: number, v: number, flip: boolean): LandProp => {
  const k = Math.min(2, Math.floor(v * 3));
  return { sheet: 'salt_cairn', frame: `c${k}`, x, y, flip, block: { rx: [4, 5, 6][k], ry: [2, 2.5, 3][k] } };
};
const chime = (x: number, y: number, v: number): LandProp => {
  const k = v < 0.5 ? 0 : 1;
  return { sheet: 'salt_chime', frame: `v${k}_0`, x, y, flip: v > 0.25 && v < 0.75, anim: `ring${k}`, block: { rx: 3, ry: 2 } };
};
const rock = (x: number, y: number, v: number, flip: boolean): LandProp => {
  const k = Math.min(2, Math.floor(v * 3));
  return { sheet: 'salt_rock', frame: `r${k}`, x, y, flip, block: k === 0 ? undefined : { rx: [0, 7, 10][k], ry: [0, 3, 4][k] } };
};
function grass(props: LandProp[], R: () => number, x: number, y: number, n: number): void {
  for (let k = 0; k < n; k++) {
    props.push({ sheet: 'salt_grass', frame: `g${Math.floor(R() * 4)}`, x: Math.round(x + (k ? (R() - 0.5) * 18 : 0)), y: Math.round(y + (k ? (R() - 0.5) * 10 : 0)), flip: R() < 0.5, shadow: false });
  }
}
