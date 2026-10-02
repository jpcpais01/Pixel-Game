import type { Hurtbox } from '../combat';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import { BirdSprite, Feathers, Rake } from '../Falcon';
import type { Cast, IconPainter } from './types';
import { bloom, circle, clamp01, dither, easeIn, easeOut, flare, Fx, GROUND, hash, type Ink } from './ink';

// The falconer's Special, Skyhunt. She whistles, and a flight of hawks (golden
// eagles for Berkut) answers out of the sky: they wheel over her in a wide ring,
// their shadows sweeping the ground under them, then one after another they
// fold their wings and stoop on the foes round her, each striking hard in a
// burst of feathers before beating away up into the sky.

const HAWKS = 6;
/** How far round her they hunt, and how wide and high they wheel. */
const HUNT_R = 95;
const WHEEL_R = 34;
const WHEEL_Z = 62;
/** They come in from high and far, wheel, then stoop one after another. */
const ARRIVE = 420;
const WHEEL = 650;
const STAGGER = 110;
const STOOP = 260;
const CLIMB = 520;
const STRIKE_DAMAGE = 14;
const STRIKE_KNOCK = 90;
const LIFE = ARRIVE + WHEEL + STAGGER * (HAWKS - 1) + STOOP + CLIMB;

interface Hawk {
  bird: BirdSprite;
  /** Its place in the ring. */
  a0: number;
  /** When it stoops, and on what. */
  go: number;
  prey: Hurtbox | null;
  tx: number;
  ty: number;
  /** Where it was as it began the stoop. */
  sx: number;
  sy: number;
  sz: number;
  struck: boolean;
  /** Which way it climbs away. */
  out: number;
}

/** Skyhunt: the hawks wheel over her and stoop on everything round her. */
export class Skyhunt extends Fx {
  private hawks: Hawk[] = [];
  private ground: Ink;
  private readonly eagles: boolean;
  private readonly seed = Math.floor(Math.random() * 1000);
  private readonly feathers: number[];

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, LIFE);
    this.eagles = c.look === 'berkut';
    this.feathers = this.eagles ? [0xf0c058, 0x6a4428, 0xa0743e, 0x2a1a10] : [0xeee0c6, 0x946a46, 0xd2bea2, 0xcc6630];
    this.ground = this.ink(HUNT_R * 2 + 8, Math.ceil(HUNT_R * GROUND * 2) + 8);
    // Each hawk takes the next foe nearest her, round the ring; with more hawks than foes they double up.
    const foes = world
      .hurtboxesWhere((h) => h.alive && Math.hypot(h.x - c.x, (h.y - c.y) / GROUND) <= HUNT_R)
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    for (let i = 0; i < HAWKS; i++) {
      const prey = foes.length ? foes[i % foes.length] : null;
      const a = (i / HAWKS) * Math.PI * 2 + hash(i, this.seed) * 0.4;
      const r = HUNT_R * (0.35 + hash(i, this.seed, 1) * 0.5);
      this.hawks.push({
        bird: this.own(new BirdSprite(world, this.eagles ? 'bird_eagle' : 'bird_hawk')),
        a0: (i / HAWKS) * Math.PI * 2,
        go: ARRIVE + WHEEL + i * STAGGER,
        prey,
        tx: prey ? prey.x : c.x + Math.cos(a) * r,
        ty: prey ? prey.y : c.y + Math.sin(a) * r * GROUND,
        sx: 0,
        sy: 0,
        sz: 0,
        struck: false,
        out: a,
      });
    }
    sound.whistle(world.pan(c.x));
    world.time.delayedCall(260, () => {
      sound.screech(world.pan(c.x));
      if (this.eagles) sound.falconCall(world.pan(c.x), true);
      sound.wings(world.pan(c.x), this.eagles ? 3 : 5);
    });
  }

  /** Where a hawk wheels at time t: round her, the ring turning, rising and dipping. */
  private wheel(h: Hawk, t: number): { x: number; y: number; z: number; dx: number } {
    const { c } = this;
    const a = h.a0 + t * 0.0042;
    const come = 1 - easeOut(t / ARRIVE);
    const r = WHEEL_R * (1 + come * 2.5);
    return {
      x: c.x + Math.cos(a) * r,
      y: c.y + Math.sin(a) * r * GROUND,
      z: WHEEL_Z + come * 70 + Math.sin(a * 2 + h.a0) * 5,
      // Going round anticlockwise on screen: its heading's sideways part.
      dx: -Math.sin(a),
    };
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    for (const h of this.hawks) {
      const b = h.bird;
      if (t < h.go) {
        const w = this.wheel(h, t);
        // Mostly gliding, a few beats now and then.
        const gliding = Math.floor((t + h.a0 * 300) / 340) % 3 !== 0;
        b.place(w.x, w.y, w.z, gliding ? (Math.floor(t / 200 + h.a0) % 2 ? 'g0' : 'g1') : b.flap(dt), w.dx > 0, clamp01(t / 200));
        h.sx = w.x;
        h.sy = w.y;
        h.sz = w.z;
        continue;
      }
      const s = t - h.go;
      if (s < STOOP) {
        // The stoop: wings folded, falling on the quarry wherever it has gone.
        if (h.prey?.alive) {
          h.tx = h.prey.x;
          h.ty = h.prey.y;
        }
        const k = easeIn(s / STOOP);
        const x = h.sx + (h.tx - h.sx) * k;
        const y = h.sy + (h.ty - h.sy) * k;
        const z = h.sz + ((h.prey ? h.prey.bodyY + 2 : 4) - h.sz) * k;
        b.place(x, y, z, s < STOOP * 0.5 ? 'd0' : 'd1', h.tx >= h.sx);
        if (s > STOOP * 0.3 && Math.random() < dt / 30) world.debris(c.pal.tints, x, y - z, 1, y + 4, 'trail');
        continue;
      }
      if (!h.struck) this.strike(h);
      // Beating away up into the sky, fading.
      const k = (s - STOOP) / CLIMB;
      const x = h.tx + Math.cos(h.out) * 40 * k;
      const y = h.ty + Math.sin(h.out) * 40 * k * GROUND;
      const z = (h.prey ? h.prey.bodyY + 2 : 4) + 90 * easeIn(k);
      b.place(x, y, z, k < 0.18 ? 'k3' : b.flap(dt, true), Math.cos(h.out) >= 0, 1 - clamp01((k - 0.5) / 0.5));
    }
    this.drawGround();
  }

  /** A hawk strikes: its quarry (or whatever stands where it lands) is struck hard, feathers fly. */
  private strike(h: Hawk): void {
    const { c, world } = this;
    h.struck = true;
    const dir = h.tx >= h.sx ? 1 : -1;
    const hit = h.prey?.alive ? [h.prey] : world.hurtboxesWhere((m) => m.alive && Math.hypot(m.x - h.tx, (m.y - h.ty) / GROUND) < 14);
    for (const m of hit) {
      m.hurt({ damage: STRIKE_DAMAGE, heavy: true, knock: STRIKE_KNOCK, fromX: m.x - dir * 6, fromY: m.y - 4 });
      world.addEffect(new Rake(world, m.x, m.y - m.bodyY, m.y + 20, dir, [c.pal.core, c.pal.hot, c.pal.mid]));
    }
    const z = h.prey ? h.prey.bodyY : 6;
    world.addEffect(new Feathers(world, h.tx, h.ty, z, 4, this.feathers));
    world.debris(c.pal.tints, h.tx, h.ty - z, hit.length ? 10 : 5, h.ty + 20);
    bloom(world, h.tx, h.ty - z, c.pal.hot, 1.2, 220, h.ty + 21, 0.6);
    flare(world, h.tx, h.ty - z, 60, c.pal.light, 1.6, 260);
    sound.rake(world.pan(h.tx), true);
    world.cameras.main.shake(70, hit.length ? 0.0016 : 0.0008);
  }

  /** On the ground: a faint ring of the hunt's reach, and the hawks' dark wakes sweeping round it as they wheel. */
  private drawGround(): void {
    const { c, t } = this;
    const g = this.ground.begin(c.x, c.y, 3);
    const open = easeOut(t / 300) * (1 - clamp01((t - (LIFE - 400)) / 400));
    if (open > 0) {
      circle(g, c.x, c.y, HUNT_R * (0.9 + 0.1 * open), c.pal.mid, 0.35 * open);
      // Arcs chasing round the ring, as the shadows of the flight pass over it.
      const wheeling = t < ARRIVE + WHEEL + STAGGER * HAWKS;
      if (wheeling) {
        for (let i = 0; i < HAWKS; i++) {
          const a = (i / HAWKS) * Math.PI * 2 + t * 0.0042;
          for (let j = 0; j < 14; j++) {
            const aa = a - j * 0.045;
            const r = WHEEL_R + 2;
            const x = c.x + Math.cos(aa) * r;
            const y = c.y + Math.sin(aa) * r * GROUND;
            if (dither(Math.round(x), Math.round(y)) < (1 - j / 14) * 0.5 * open) g.put(x, y, c.pal.deep, 0.5);
          }
        }
      }
    }
    this.ground.end();
  }
}

/** Skyhunt's button: a hawk stooping, wings folded, and two more wheeling above it. */
export const skyhuntIcon: IconPainter = (put, p) => {
  // The wheeling pair: little open-winged birds.
  for (const [x, y] of [[3, 3], [10, 1]]) {
    put(x - 2, y, p.mid);
    put(x - 1, y + 1, p.hot);
    put(x, y + 1, p.core);
    put(x + 1, y + 1, p.hot);
    put(x + 2, y, p.mid);
  }
  // The stooping hawk, head down to the lower right.
  const body: [number, number, number][] = [
    [5, 6, 3], [6, 6, 2], [6, 7, 1], [7, 7, 1], [7, 8, 0], [8, 8, 1], [8, 9, 0], [9, 9, 1], [9, 10, 0], [10, 10, 1], [10, 11, 1], [11, 11, 2], [11, 12, 0],
  ];
  const col = [p.core, p.hot, p.mid, p.deep];
  for (const [x, y, k] of body) put(x, y, col[k]);
  // Folded wings swept back along it.
  for (const [x, y] of [[4, 8], [5, 8], [6, 9], [7, 10], [5, 5], [4, 5], [3, 4]]) put(x, y, p.deep);
  put(12, 13, p.core);
  // Its speed: streaks behind.
  for (const [x, y] of [[2, 7], [1, 6], [3, 10], [2, 9]]) put(x, y, p.mid);
  put(13, 14, p.hot);
};
