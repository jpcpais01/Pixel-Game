import Phaser from 'phaser';
import { sound } from '../../audio';
import { heroBuffs } from '../buffs';
import { snap } from '../display';
import { NOTE_H } from '../../art/bard';
import { HASTE, Note, RHYTHM, type NoteKind } from '../Songs';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { clamp01, easeOut, flare, Fx, ring, rune, strikeGround, type Ink } from './ink';
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

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, ENCORE_TIME);
    this.ground = this.ink(96, 60);
    for (let i = 0; i < 6; i++) this.notes.push(this.own(world.add.image(c.x, c.y, 'note_e', i % 2 ? 'n1' : 'n0').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)));
    const v = c.hero.vitals;
    const got = v.heal(Math.round(v.max * 0.2));
    if (got > 0) world.popNumber(snap(c.hero.x), snap(c.hero.y) - 38, `+${got}`, 0x9dff9a);
    heroBuffs.add(HASTE);
    world.buffGained(HASTE);
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
      world.addEffect(new Note(world, x, gy, dx / l, dy / l, ENCORE_NOTE, foe));
      sound.lutePluck(world.pan(x));
    }
    // Rings of music pulse out over the ground on the beat.
    this.beatT += dt;
    const g = this.ground.begin(h.x, h.y, 2.5);
    const k = (this.beatT % 560) / 560;
    ring(g, h.x, h.y, 8 + 34 * easeOut(k), 1.8 * (1 - k) + 0.4, c.pal, (1 - k) * open);
    rune(g, h.x, h.y, 14 * open, t * 0.003, c.pal, 0.6 * open);
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

/** When each great beat falls, in ms; the last is the heaviest. */
const BEATS = [0, 360, 720, 1080, 1500];

/** The War Drummer's Thunder of War: five great beats, each a ring of sound that shakes the ground and hurls foes back, the fifth the greatest; and the battle rhythm for all of it. */
export class ThunderOfWar extends Fx {
  private ground: Ink;
  private next = 0;
  private rings: { t0: number; x: number; y: number; r: number }[] = [];

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 2200);
    this.ground = this.ink(260, 170);
    heroBuffs.add(RHYTHM);
    world.buffGained(RHYTHM);
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
      ring(g, rg.x, rg.y, 6 + (rg.r - 6) * easeOut(k), 4 * (1 - k) + 1, p, 1 - k);
      const k2 = k - 0.18;
      if (k2 > 0) ring(g, rg.x, rg.y, 4 + (rg.r - 16) * easeOut(k2), 2 * (1 - k2) + 0.5, p, 0.6 * (1 - k2));
    }
    const fade = clamp01((this.life - t) / 500);
    rune(g, h.x, h.y, 22 * easeOut(t / 250) * fade, t * 0.004, p, fade);
    g.end();
  }
}
