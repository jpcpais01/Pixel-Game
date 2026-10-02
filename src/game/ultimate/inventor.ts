import type Phaser from 'phaser';
import { sound } from '../../audio';
import { INV_HAND_Y } from '../../art/inventor';
import { FORGEBEARD_KIT, ENGINEER_KIT, Turret, type TurretSpec } from '../Engineer';
import { Arc } from '../Scientist';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, easeOut, flare, Fx, ring, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// The Inventor's Specials.
//  - Mega Sentry (the Engineer): a giant turret drops out of the sky onto
//    the spot, crushing what it lands on, unfolds, and for a while hoses
//    every foe near with fire from both barrels and a rocket now and then.
//  - Chain Reaction (the Scientist): a great atom forms over the spot, its
//    electrons whirling faster and faster, arcs lashing from it to the foes
//    round it; then it splits, in a blinding flash and a ring of force.
//    Einstein's is E = mc²: golden, with the equation chalked in the air.
// Forgebeard's Mega Sentry is his own stone-and-brass work, rune-eyed.

export const MEGA_SENTRY: TurretSpec = {
  scale: 2,
  life: 8000,
  range: 150,
  fireMs: 130,
  damage: 3,
  rocketMs: 1100,
  rocketDamage: 16,
  rocketR: 24,
  drop: true,
  dropDamage: 30,
};

export function megaSentry(c: Cast): void {
  const kit = c.look === 'forgebeard' ? FORGEBEARD_KIT : ENGINEER_KIT;
  c.world.addEffect(new Turret(c.world, c.tx, c.ty, c.tx, c.ty, MEGA_SENTRY, c.pal, kit.turret));
}

const FORM_MS = 1500;
const ATOM_R = 22;
const ATOM_H = 20;
const ARC_EVERY = 170;
const ARC_RANGE = 120;
const ARC_DAMAGE = 4;
const SPLIT_R = 78;
const SPLIT_DAMAGE = 40;
const W = 200;
const H = 150;

/** Tiny chalk letters, three wide and five tall: E = m c ². */
const CHALK: Record<string, string[]> = {
  E: ['###', '#..', '##.', '#..', '###'],
  '=': ['...', '###', '...', '###', '...'],
  m: ['...', '...', '#.#', '###', '#.#'],
  c: ['...', '...', '.##', '#..', '.##'],
  '2': ['##.', '.#.', '##.', '...', '...'],
};
const EQUATION = ['E', '=', 'm', 'c', '2'];

export class ChainReaction extends Fx {
  private g: Ink;
  private arcT = ARC_EVERY;
  private split = false;
  private chalk: boolean;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, FORM_MS + 700);
    this.chalk = c.look === 'einstein';
    this.g = this.ink(W, H);
    this.lamp = this.light(c.tx, c.ty - ATOM_H, 80, c.pal.light, 0.5);
    flare(world, c.x, c.y - INV_HAND_Y, 90, c.pal.light, 2, 400);
    sound.tesla(world.pan(c.tx), true);
  }

  protected step(dt: number): void {
    const w = this.world;
    const { tx, ty, pal: p } = this.c;
    const ax = tx;
    const ay = ty - ATOM_H;
    const g = this.g.begin(tx, ty - 30, ty + 40);

    if (this.t < FORM_MS) {
      const k = this.t / FORM_MS;
      const grow = easeOut(k * 1.6);
      const R = ATOM_R * grow;
      // The glow gathering on the ground under it.
      ring(g, tx, ty, R * 1.2, 1, p, 0.35 * grow);
      // Three orbits at a slant, their electrons whirling faster as it builds.
      const spin = this.t * (0.006 + k * 0.02);
      for (let o = 0; o < 3; o++) {
        const tilt = (o * Math.PI) / 3;
        const ct = Math.cos(tilt);
        const st = Math.sin(tilt);
        const pt = (a: number) => {
          const ex = Math.cos(a) * R;
          const ey = Math.sin(a) * R * 0.32;
          return { x: ax + ex * ct - ey * st, y: ay + (ex * st + ey * ct) * 0.8 };
        };
        const steps = Math.max(16, Math.ceil(R * 5));
        for (let i = 0; i < steps; i++) {
          const q = pt((i / steps) * Math.PI * 2);
          g.put(q.x, q.y, p.deep, 0.55 * grow);
        }
        for (let e = 0; e < 2; e++) {
          const q = pt(spin * (1 + o * 0.15) + e * Math.PI + o);
          g.put(q.x, q.y, p.core);
          g.put(q.x + 1, q.y, p.hot, 0.8);
          g.put(q.x, q.y + 1, p.hot, 0.6);
          // A short tail behind each electron.
          const b = pt(spin * (1 + o * 0.15) + e * Math.PI + o - 0.25);
          g.put(b.x, b.y, p.mid, 0.7);
        }
      }
      // The nucleus: a knot of bright balls, trembling as it strains.
      const shake = k > 0.7 ? Math.round((Math.random() - 0.5) * 2 * (k - 0.7) * 4) : 0;
      const nucleus: [number, number][] = [[0, 0], [2, 1], [-2, 1], [1, -2], [-1, 2], [1, 2]];
      for (const [nx, ny] of nucleus) {
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (x * x + y * y <= 1) g.put(ax + nx + x + shake, ay + ny + y, (nx + ny) & 1 ? p.hot : p.core, grow);
      }
      if (this.chalk) this.equation(g, ax, ay, k);
      this.lamp.intensity = 0.8 + k * 2.2;
      // Arcs lash out to the foes round it.
      this.arcT -= dt;
      if (this.arcT <= 0 && k > 0.2) {
        this.arcT = ARC_EVERY;
        const foes = w.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - tx, h.y - ty) <= ARC_RANGE);
        if (foes.length) {
          const h = foes[Math.floor(Math.random() * foes.length)];
          h.hurt({ damage: ARC_DAMAGE, heavy: false, knock: 20, fromX: tx, fromY: ty });
          h.slow?.(0.6, 300, p.mid);
          w.addEffect(new Arc(w, [{ x: ax, y: ay }, { x: h.x, y: h.y - h.bodyY }], p, Math.max(ty, h.y) + 20, this.chalk, 160));
          sound.tesla(w.pan(h.x), false);
        }
      }
    } else {
      if (!this.split) {
        this.split = true;
        strikeGround(w, tx, ty, SPLIT_R, { damage: SPLIT_DAMAGE, heavy: true, knock: 200 });
        bloom(w, ax, ay, p.core, 4.5, 650, ty + 60);
        flare(w, ax, ay, 260, p.light, 4, 700);
        w.debris(p.tints, ax, ay, 30, ty + 40, 'burst');
        w.cameras.main.shake(320, 0.0012);
        sound.blast(w.pan(tx));
        sound.nova();
      }
      const b = clamp01((this.t - FORM_MS) / 600);
      // The flash, then the ring of force racing out over the ground.
      if (b < 0.25) {
        const fr = 12 + b * 60;
        for (let y = -fr; y <= fr; y += 1) for (let x = -fr; x <= fr; x += 1) if (x * x + y * y * 1.6 <= fr * fr && (x + y) % 2 === 0) g.put(ax + x, ay + y, p.core, 1 - b * 4);
      }
      ring(g, tx, ty, SPLIT_R * easeOut(b), 3 * (1 - b) + 0.6, p, 1 - b);
      ring(g, tx, ty, SPLIT_R * 0.6 * easeOut(b), 1.4 * (1 - b) + 0.4, p, 0.7 * (1 - b), undefined, 0.4, 3);
      this.lamp.intensity = 3.5 * (1 - b);
    }
    g.end();
  }

  /** E = mc², chalked in the air over the atom, rising and fading as it builds. */
  private equation(g: Ink, ax: number, ay: number, k: number): void {
    const a = Math.min(1, k * 3) * (1 - clamp01((k - 0.85) / 0.15));
    let x = ax - 11;
    const y = ay - ATOM_R * 0.8 - 10 - k * 6;
    for (const ch of EQUATION) {
      const rows = CHALK[ch];
      const up = ch === '2' ? -1 : 0;
      rows.forEach((row, ry) => {
        [...row].forEach((on, rx) => {
          if (on === '#') g.put(x + rx, y + ry + up, 0xf8f8fc, a);
        });
      });
      x += ch === '2' ? 3 : 4 + (ch === '=' ? 1 : 0);
    }
  }
}

export function chainReaction(c: Cast): void {
  c.world.addEffect(new ChainReaction(c.world, c));
}
