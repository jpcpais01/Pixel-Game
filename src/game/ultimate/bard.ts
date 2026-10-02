import Phaser from 'phaser';
import { sound } from '../../audio';
import { heroBuffs } from '../buffs';
import { snap } from '../display';
import { NOTE_H } from '../../art/bard';
import { HOWL_RHYTHM, MINSTREL_SONGS, Note, RHYTHM, TAIKO_RHYTHM, TROUBADOUR_SONG, type NoteKind } from '../Songs';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { circle, clamp01, easeOut, flare, Fx, GROUND, hash, line, ring, rune, shade, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Bard's Specials: the minstrel's encore, a ring of notes that turns
// round him and flies at every foe near, and the war drummer's thunder of
// war, five great beats that shake the ground.

const ENCORE_TIME = 5200;
/** Notes leave the ring at foes this close to the bard. */
const ENCORE_REACH = 150;
const ENCORE_NOTE: NoteKind = { damage: 11, bounces: 3, falloff: 0.85, speed: 210, range: 190, seek: 10, lit: false };

/** The Minstrel's Encore: healed and quickened, he plays on inside a ring of turning notes, each flying off at a foe in turn. */
export class Encore extends Fx {
  private ground: Ink;
  private notes: Phaser.GameObjects.Image[] = [];
  private nextShot = 250;
  private fired = 0;
  private beatT = 0;
  /** The skin's notes: the wildsong's leaves and wisps, the harlequin's diamonds... */
  private song = TROUBADOUR_SONG;
  /** Orpheus's: the dead rise to listen. */
  private orpheus: boolean;
  /** The skald's: runes of the elder futhark turning round him on the ground. */
  private skald: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, ENCORE_TIME);
    const { song, haste } = MINSTREL_SONGS[c.look] ?? MINSTREL_SONGS.minstrel;
    this.song = { tex: song.tex, pal: c.pal };
    this.orpheus = c.look === 'orpheus';
    this.skald = c.look === 'skald';
    this.ground = this.ink(this.orpheus ? 120 : 96, this.orpheus ? 96 : 60);
    for (let i = 0; i < 6; i++) this.notes.push(this.own(world.add.image(c.x, c.y, this.song.tex, i % 2 ? 'n1' : 'n0').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)));
    const v = c.hero.vitals;
    const got = v.heal(Math.round(v.max * 0.2));
    if (got > 0) world.popNumber(snap(c.hero.x), snap(c.hero.y) - 38, `+${got}`, 0x9dff9a);
    heroBuffs.add(haste);
    world.buffGained(haste);
    world.debris(c.pal.tints, snap(c.x), snap(c.y) - 14, 20, c.y + 20, 'spores');
    flare(world, c.x, c.y - 14, 140, c.pal.light, 3, 800);
    sound.encore(world.pan(c.x));
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const h = c.hero;
    const open = easeOut(t / 300) * clamp01((this.life - t) / 400);
    // The ring: six notes turning round his chest, passing behind him and in front.
    const at: [number, number][] = [];
    this.notes.forEach((n, i) => {
      const a = t * 0.004 + (i / this.notes.length) * Math.PI * 2;
      const x = h.x + Math.cos(a) * 17 * open;
      const y = h.y - 12 + Math.sin(a) * 7 * open;
      at.push([x, y]);
      n.setPosition(snap(x), snap(y))
        .setDepth(h.y + (Math.sin(a) > 0 ? 1 : -1))
        .setFlipX(Math.cos(a) < 0)
        .setAlpha(open * h.alpha * (0.75 + 0.25 * Math.sin(t * 0.01 + i)));
    });
    // Every few beats the next note in the ring flies at the nearest foe.
    while (t >= this.nextShot && this.nextShot < this.life - 300) {
      this.nextShot += 280;
      const foe = this.nearest(h.x, h.y);
      if (!foe) continue;
      const [x, y] = at[this.fired % at.length];
      this.fired++;
      const gy = y + NOTE_H;
      const dx = foe.x - x;
      const dy = foe.y - gy;
      const l = Math.hypot(dx, dy) || 1;
      world.addEffect(new Note(world, x, gy, dx / l, dy / l, ENCORE_NOTE, foe, this.song));
      sound.lutePluck(world.pan(x));
    }
    // Rings of music pulse out over the ground on the beat.
    this.beatT += dt;
    const g = this.ground.begin(h.x, h.y, 2.5);
    const k = (this.beatT % 560) / 560;
    ring(g, h.x, h.y, 8 + 34 * easeOut(k), 1.8 * (1 - k) + 0.4, c.pal, (1 - k) * open);
    if (this.orpheus) {
      greekKey(g, h.x, h.y, 22 * open, t * 0.0012, c.pal, 0.75 * open);
      shades(g, h.x, h.y, t, c.pal, open);
    } else if (this.skald) {
      rune(g, h.x, h.y, 14 * open, t * 0.003, c.pal, 0.6 * open);
      runeRing(g, h.x, h.y, 27 * open, -t * 0.0009, t, c.pal, 0.8 * open);
    } else rune(g, h.x, h.y, 14 * open, t * 0.003, c.pal, 0.6 * open);
    g.end();
  }

  private nearest(x: number, y: number): Hurtbox | null {
    let best = ENCORE_REACH;
    let pick: Hurtbox | null = null;
    for (const f of this.world.hurtboxesWhere((f) => f.alive)) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < best) {
        best = d;
        pick = f;
      }
    }
    return pick;
  }
}

/** The meander that rings Orpheus's Lament: a band of Greek key turning slowly round him on the ground. */
function greekKey(g: Ink, cx: number, cy: number, r: number, rot: number, p: Pal, a: number): void {
  if (r < 6 || a <= 0) return;
  const sq = 0.58;
  circle(g, cx, cy, r + 3, p.mid, a * 0.8, sq);
  circle(g, cx, cy, r - 3, p.mid, a * 0.8, sq);
  // Each key: a hook stepping out from the inner ring to the outer and back in.
  const n = Math.max(8, Math.round(r * 0.75));
  for (let i = 0; i < n; i++) {
    const t0 = rot + (i / n) * Math.PI * 2;
    const t1 = rot + ((i + 0.6) / n) * Math.PI * 2;
    const at = (t: number, rr: number): [number, number] => [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * sq];
    const [ax, ay] = at(t0, r - 2);
    const [bx, by] = at(t0, r + 2);
    const [dx, dy] = at(t1, r + 2);
    const [ex, ey] = at(t1, r);
    line(g, ax, ay, bx, by, p.hot, a);
    line(g, bx, by, dx, dy, p.hot, a);
    line(g, dx, dy, ex, ey, p.core, a);
  }
}

/** The shades of the dead, rising out of the ground round him to hear the song: pale wisps in the underworld's violet. */
function shades(g: Ink, cx: number, cy: number, t: number, p: Pal, open: number): void {
  for (let i = 0; i < 7; i++) {
    const life = 1400;
    const k = ((t + i * 211) % life) / life;
    const a = hash(i, Math.floor((t + i * 211) / life)) * Math.PI * 2;
    const r = 26 + hash(i, 7) * 16;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.58 - k * 22;
    const fade = open * Math.sin(k * Math.PI) * 0.8;
    if (fade <= 0.02) continue;
    // A head, a body tapering into a tail that sways as it climbs.
    g.put(x, y, p.core, fade);
    g.put(x + 1, y, p.hot, fade);
    g.put(x, y + 1, p.hot, fade);
    g.put(x + 1, y + 1, p.mid, fade);
    for (let j = 2; j <= 5; j++) g.put(x + Math.sin(k * 9 + j) * 0.8, y + j, j < 4 ? p.mid : p.deep, fade * (1 - j * 0.14));
  }
}

/** Runes of the elder futhark as strokes on a 2x4 grid: Fehu, Uruz, Thurisaz, Raido, Kenaz, Algiz, Sowilo, Tiwaz. */
const FUTHARK: [number, number, number, number][][] = [
  [[0, 0, 0, 4], [0, 1, 2, 0], [0, 2, 2, 1]],
  [[0, 4, 0, 0], [0, 0, 2, 1.5], [2, 1.5, 2, 4]],
  [[0, 0, 0, 4], [0, 1, 1.6, 2], [1.6, 2, 0, 3]],
  [[0, 0, 0, 4], [0, 0, 2, 1], [2, 1, 0, 2], [0, 2, 2, 4]],
  [[2, 0, 0, 2], [0, 2, 2, 4]],
  [[1, 0, 1, 4], [1, 1.6, 0, 0], [1, 1.6, 2, 0]],
  [[2, 0, 0, 1.4], [0, 1.4, 2, 2.6], [2, 2.6, 0, 4]],
  [[1, 0, 1, 4], [1, 0, 0, 1.3], [1, 0, 2, 1.3]],
];

/** The skald's ring of runes: eight upright glyphs of light standing round him on the ground, turning slowly, each flaring in turn as the saga reaches it. */
function runeRing(g: Ink, cx: number, cy: number, r: number, rot: number, t: number, p: Pal, a: number): void {
  if (r < 8 || a <= 0) return;
  FUTHARK.forEach((strokes, i) => {
    const th = rot + (i / FUTHARK.length) * Math.PI * 2;
    const x0 = cx + Math.cos(th) * r - 1.5;
    const y0 = cy + Math.sin(th) * r * GROUND - 6;
    const lit = Math.max(0, Math.sin(t * 0.004 - i * 0.8));
    const k = a * (0.55 + 0.45 * lit);
    for (const [ax, ay, bx, by] of strokes) {
      // A halo of ice under the gold stroke.
      line(g, x0 + ax * 1.5 + 1, y0 + ay * 1.5, x0 + bx * 1.5 + 1, y0 + by * 1.5, p.mid, k * 0.5);
      line(g, x0 + ax * 1.5, y0 + ay * 1.5, x0 + bx * 1.5, y0 + by * 1.5, lit > 0.7 ? p.core : p.hot, k);
    }
  });
}

/** An ensō: one stroke of the brush round the ground, pressed thick where it starts, thinning and running dry before it closes. */
function enso(g: Ink, cx: number, cy: number, r: number, w: number, start: number, p: Pal, a: number): void {
  if (r < 3 || a <= 0) return;
  const sweep = Math.PI * 1.82;
  const steps = Math.ceil(sweep * r * 1.4);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const th = start + sweep * u;
    const bw = w * (0.45 + 1.15 * Math.min(1, u * 6) * (1 - u * 0.7));
    const n = Math.max(1, Math.ceil(bw));
    for (let j = -n; j <= n; j++) {
      if (hash(j + 5, Math.floor(u * 14)) < u * u * 0.6) continue;
      const rr = r + (j / n) * bw;
      g.put(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * GROUND, shade(p, Math.abs(j / n)), a);
    }
  }
  // A spatter flung off where the brush lifted.
  const end = start + sweep;
  for (let i = 0; i < 4; i++) g.put(cx + Math.cos(end + i * 0.07) * (r + 2 + i * 1.6), cy + Math.sin(end + i * 0.07) * (r + 2 + i * 1.6) * GROUND, p.mid, a * (1 - i * 0.2));
}

/** Mitsudomoe: three commas chasing round a ring, the crest painted on the taiko's head, here turning on the ground. */
function tomoe(g: Ink, cx: number, cy: number, r: number, rot: number, p: Pal, a: number): void {
  if (r < 6 || a <= 0) return;
  circle(g, cx, cy, r, p.hot, a);
  for (let i = 0; i < 3; i++) {
    const th0 = rot + (i / 3) * Math.PI * 2;
    // The comma's head: a round blot two-fifths out.
    const hx = cx + Math.cos(th0) * r * 0.42;
    const hy = cy + Math.sin(th0) * r * 0.42 * GROUND;
    const hr = r * 0.26;
    for (let dy = -hr; dy <= hr; dy++) for (let dx = -hr; dx <= hr; dx++) if (Math.hypot(dx, dy / GROUND) <= hr) g.put(hx + dx, hy + dy * GROUND, Math.hypot(dx, dy) < hr * 0.5 ? p.core : p.mid, a);
    // Its tail sweeping round behind it, thinning.
    for (let k = 0; k <= 14; k++) {
      const u = k / 14;
      const th = th0 - u * 1.9;
      const rr = r * (0.42 + u * 0.4);
      const tw = hr * (1 - u) * 0.9;
      for (let j = -1; j <= 1; j++) g.put(cx + Math.cos(th) * (rr + j * tw), cy + Math.sin(th) * (rr + j * tw) * GROUND, j === 0 ? p.hot : p.mid, a * (1 - u * 0.4));
    }
  }
}

/** When each great beat falls, in ms; the last is the heaviest. */
const BEATS = [0, 360, 720, 1080, 1500];

/** The War Drummer's Thunder of War: five great beats, each a ring of sound that shakes the ground and hurls foes back, the fifth the greatest; and the battle rhythm for all of it. */
export class ThunderOfWar extends Fx {
  private ground: Ink;
  private next = 0;
  private rings: { t0: number; x: number; y: number; r: number }[] = [];
  /** The taiko's: each beat an ensō brushed round him, the drum's three commas turning beneath. */
  private taiko: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 2200);
    this.ground = this.ink(260, 170);
    this.taiko = c.look === 'taiko';
    const rhythm = c.look === 'howl' ? HOWL_RHYTHM : this.taiko ? TAIKO_RHYTHM : RHYTHM;
    heroBuffs.add(rhythm);
    world.buffGained(rhythm);
  }

  protected step(): void {
    const { c, t, world } = this;
    const h = c.hero;
    const p = c.pal;
    while (this.next < BEATS.length && t >= BEATS[this.next]) {
      const last = this.next === BEATS.length - 1;
      this.next++;
      const r = last ? 95 : 64;
      strikeGround(world, h.x, h.y, r, { damage: last ? 34 : 14, heavy: last, knock: last ? 320 : 210, fromX: h.x, fromY: h.y });
      this.rings.push({ t0: t, x: h.x, y: h.y, r });
      sound.drumBeat(world.pan(h.x), last);
      world.cameras.main.shake(last ? 220 : 110, last ? 0.004 : 0.0015);
      flare(world, h.x, h.y - 10, r * 1.4, p.light, last ? 4 : 2.2, last ? 700 : 400);
      world.debris(p.tints, snap(h.x), snap(h.y) - 4, last ? 26 : 12, h.y + 20);
    }
    const g = this.ground.begin(h.x, h.y, 2.5);
    for (const rg of this.rings) {
      const k = (t - rg.t0) / 520;
      if (k < 0 || k > 1) continue;
      if (this.taiko) {
        const start = hash(Math.round(rg.t0), 3) * Math.PI * 2;
        enso(g, rg.x, rg.y, 6 + (rg.r - 6) * easeOut(k), 4 * (1 - k) + 1, start, p, 1 - k);
        const k2 = k - 0.18;
        if (k2 > 0) enso(g, rg.x, rg.y, 4 + (rg.r - 16) * easeOut(k2), 2 * (1 - k2) + 0.6, start + 2.4, p, 0.6 * (1 - k2));
        continue;
      }
      ring(g, rg.x, rg.y, 6 + (rg.r - 6) * easeOut(k), 4 * (1 - k) + 1, p, 1 - k);
      const k2 = k - 0.18;
      if (k2 > 0) ring(g, rg.x, rg.y, 4 + (rg.r - 16) * easeOut(k2), 2 * (1 - k2) + 0.5, p, 0.6 * (1 - k2));
    }
    const fade = clamp01((this.life - t) / 500);
    if (this.taiko) tomoe(g, h.x, h.y, 22 * easeOut(t / 250) * fade, t * 0.004, p, fade);
    else rune(g, h.x, h.y, 22 * easeOut(t / 250) * fade, t * 0.004, p, fade);
    g.end();
  }
}
