import Phaser from 'phaser';
import { sound } from '../../audio';
import { Venom, type ToxStyle } from '../Toxins';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bolt, clamp01, column, dither, easeOut, flare, Fx, GROUND, hash, line, pool, ring, segDist, star, stroke, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Alchemist's and the Archer's Specials: a plague cloud, a chem bomb,
// and one great arrow.

const CLOUD_R = 48;
const CLOUD_TIME = 5000;

/** The Plague doctor's Pestilence: a great churning miasma settles on the spot, poisoning everything inside deeper and deeper. */
export class Pestilence extends Fx {
  private cloud: Ink;
  private ground: Ink;
  private venom: Venom;
  private tick = 0;
  private first = true;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private tox: ToxStyle,
  ) {
    super(world, CLOUD_TIME + 3000);
    this.cloud = this.ink(130, 84);
    this.ground = this.ink(130, 80);
    this.venom = new Venom(world, tox, 6);
    sound.bog(world.pan(x));
    sound.splash(world.pan(x));
  }

  protected step(dt: number): void {
    const { x, y, t, tox, world } = this;
    const on = t < CLOUD_TIME;
    const open = easeOut(t / 500) * (1 - clamp01((t - CLOUD_TIME + 600) / 600));
    this.tick -= dt;
    if (on && this.tick <= 0) {
      this.tick = 500;
      const hit = strikeGround(world, x, y, CLOUD_R, { damage: this.first ? 18 : 0, knock: 0, poison: tox.numbers });
      this.first = false;
      for (const h of hit) this.venom.dose(h, 2600, 2);
    }
    this.venom.update(dt);

    const g = this.ground.begin(x, y, 2.5);
    pool(g, x, y, CLOUD_R * open, tox.murk, tox.deep, open, GROUND, 0.7);
    g.end();

    // The miasma: puffs wheeling slowly round the heart, each a dithered blob of the brew's colours.
    const c = this.cloud.begin(x, y - 12, y + 16);
    if (open > 0) {
      for (let i = 0; i < 16; i++) {
        const rr = CLOUD_R * (0.2 + 0.75 * hash(i, 1)) * open;
        const a = hash(i, 2) * Math.PI * 2 + t * 0.0006 * (hash(i, 3) > 0.5 ? 1 : -1.3);
        const px = x + Math.cos(a) * rr;
        const py = y - 6 + Math.sin(a) * rr * GROUND - (4 + 6 * hash(i, 4)) - Math.sin(t * 0.002 + i) * 2;
        const pr = (5 + 5 * hash(i, 5)) * (0.6 + 0.4 * open);
        puff(c, px, py, pr, tox, open * 0.85);
      }
      // Bubbles swelling and popping in the murk.
      for (let i = 0; i < 6; i++) {
        const life = (t + i * 347) % 900;
        const s = Math.floor((t + i * 347) / 900);
        const bx = x + (hash(i, s) - 0.5) * CLOUD_R * 1.4 * open;
        const by = y + (hash(i, s, 2) - 0.5) * CLOUD_R * GROUND * open;
        const r = life < 700 ? (life / 700) * 2 : 0;
        if (r > 0) {
          circleSmall(c, bx, by - 1, r, tox.hot);
          c.put(bx - 1, by - 2, tox.core);
        } else star(c, bx, by - 1, 2, { core: tox.core, hot: tox.hot, mid: tox.mid, deep: tox.deep, light: tox.light, tints: tox.tints });
      }
    }
    c.end();
    if (on && Math.floor(t / 110) !== Math.floor((t - dt) / 110)) world.debris(tox.tints, x + (Math.random() - 0.5) * CLOUD_R * 1.5, y - 4 - Math.random() * 14, 1, y + 20, 'spores');
  }
}

/** A soft round puff: solid at heart, dithering away at its edge. */
function puff(g: Ink, x: number, y: number, r: number, tox: ToxStyle, a: number): void {
  for (let dy = -Math.ceil(r); dy <= r; dy++) {
    for (let dx = -Math.ceil(r); dx <= r; dx++) {
      const d = Math.hypot(dx, dy * 1.2) / r;
      if (d > 1) continue;
      const px = Math.round(x + dx);
      const py = Math.round(y + dy);
      if (dither(px, py) >= a * (1 - d * d)) continue;
      // Lit from above: brighter on top.
      g.put(px, py, dy < -r * 0.4 && d < 0.7 ? tox.hot : d < 0.6 ? tox.mid : tox.deep, 0.9);
    }
  }
}

function circleSmall(g: Ink, x: number, y: number, r: number, c: number): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.put(x + Math.cos(a) * r, y + Math.sin(a) * r, c);
  }
}

const FLIGHT = 560;
const ARC = 62;

/** The Chemtech's Chem Bomb: a great canister lobbed high, bursting in a towering green blast that leaves the ground seething with acid. */
export class ChemBomb extends Fx {
  private can: Ink;
  private ground: Ink;
  private plume: Ink;
  private shadow: Phaser.GameObjects.Image;
  private venom: Venom;
  private landed = false;
  private tick = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
    private tox: ToxStyle,
  ) {
    super(world, FLIGHT + 4200);
    this.can = this.ink(20, 20);
    this.ground = this.ink(170, 104);
    this.plume = this.ink(70, 90);
    this.shadow = this.own(world.add.image(c.x, c.y, 'shadow').setDepth(1.5).setAlpha(0));
    this.venom = new Venom(world, tox, 4);
    sound.toss(world.pan(c.x), true);
  }

  protected step(dt: number): void {
    const { c, t, tox, world } = this;
    const p = c.pal;
    const { tx, ty } = c;
    if (t < FLIGHT) {
      const k = t / FLIGHT;
      const gx = c.x + (tx - c.x) * k;
      const gy = c.y + (ty - c.y) * k;
      const h = 16 * (1 - k) + ARC * 4 * k * (1 - k);
      const g = this.can.begin(gx, gy - h, gy + 40);
      canister(g, gx, gy - h, t * 0.018, p);
      g.end();
      this.shadow.setPosition(Math.round(gx), Math.round(gy)).setAlpha(0.25 + 0.35 * k).setScale(0.6 + 0.5 * k);
      if (Math.floor(t / 50) !== Math.floor((t - dt) / 50)) world.debris(tox.tints, gx, gy - h, 1, gy + 40, 'trail');
    } else if (!this.landed) {
      this.landed = true;
      this.can.begin(tx, ty, 0).end();
      this.shadow.setVisible(false);
      const hit = strikeGround(world, tx, ty, 60, { damage: 60, heavy: true, knock: 190, fromX: tx, fromY: ty - 6, poison: undefined });
      for (const h of hit) this.venom.dose(h, 4000, 3);
      world.cameras.main.shake(280, 0.0045);
      world.debris(tox.tints, tx, ty - 8, 32, ty + 30, 'burst');
      world.debris([tox.hot, tox.mid, 0x4a4a40], tx, ty - 4, 16, ty + 30, 'spores');
      flare(world, tx, ty - 20, 240, tox.light, 4.5, 800);
      bloom(world, tx, ty - 16, tox.hot, 5, 500, ty + 40);
      sound.shatter(world.pan(tx), true);
      sound.starImpact(world.pan(tx));
    }

    if (this.landed) {
      const a = t - FLIGHT;
      // Acid seething where it burst, biting whatever stands in it.
      this.tick -= dt;
      if (this.tick <= 0 && a < 3400) {
        this.tick = 500;
        for (const h of world.hurtboxesWhere((b: Hurtbox) => b.alive && Math.hypot(b.x - tx, (b.y - ty) / GROUND) < 50)) this.venom.dose(h, 1500, 1);
      }
      const g = this.ground.begin(tx, ty, 2.5);
      const pooled = easeOut(a / 300) * (1 - clamp01((a - 3000) / 600));
      pool(g, tx, ty, 50 * pooled, tox.murk, tox.deep, pooled, GROUND, 0.75);
      for (let i = 0; i < 5; i++) {
        const life = (a + i * 211) % 600;
        const s = Math.floor((a + i * 211) / 600);
        if (pooled > 0.3 && life < 400) star(g, tx + (hash(i, s) - 0.5) * 80 * pooled, ty + (hash(i, s, 1) - 0.5) * 44 * pooled, life < 200 ? 1 : 2, p, 1 - life / 400);
      }
      const k = a / 520;
      if (k < 1) {
        ring(g, tx, ty, 6 + 70 * easeOut(k), 4 * (1 - k) + 1, p, 1 - k);
        ring(g, tx, ty, 4 + 44 * easeOut(k * 1.3), 2, p, 0.8 * (1 - k), GROUND, 0.4, 5);
      }
      g.end();

      // The blast's cloud: a stem of green fire, and a cap of smoke boiling up over it and thinning away.
      const m = this.plume.begin(tx, ty + 4, ty + 3, 0.5, 1);
      const pk = a / 1500;
      if (pk < 1) {
        const rise = easeOut(pk * 2);
        column(m, tx, ty, 50 * rise, 3.5 * (1 - pk) + 1, p, 1 - pk, a);
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * Math.PI * 2 + a * 0.002;
          const cx = tx + Math.cos(ang) * 11 * rise;
          const cy = ty - 50 * rise + Math.sin(ang) * 5 * rise - 4;
          puff(m, cx, cy, 6 + 3 * rise, tox, (1 - pk) * 0.95);
        }
      }
      m.end();
    }
    this.venom.update(dt);
  }
}

/** A tumbling chem canister: a steel shell with glowing brew behind a hazard band. */
function canister(g: Ink, x: number, y: number, a: number, p: Pal): void {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let dy = -7; dy <= 7; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const lx = dx * ca + dy * sa;
      const ly = -dx * sa + dy * ca;
      if (Math.abs(lx) > 2.6 || Math.abs(ly) > 5) continue;
      const edge = Math.abs(lx) > 1.8 || Math.abs(ly) > 4.2;
      const cap = Math.abs(ly) > 3.4;
      const band = Math.abs(ly) < 0.9;
      g.put(x + dx, y + dy, edge ? 0x3a3a34 : cap ? 0xc8ccc0 : band ? (Math.floor(lx + 3) % 2 ? 0x2a2a24 : p.hot) : lx < 0 ? p.core : p.mid);
    }
  }
}

const ARROW_SPEED = 430;
const ARROW_TIME = 720;

/** The Ranger's Great Arrow: one huge arrow loosed along the aim, piercing everything in its path and trailing a gale (or, for the storm, lightning). */
export class GreatArrow extends Fx {
  private pix: Ink;
  private lamp: Phaser.GameObjects.Light;
  private struck = new Set<Hurtbox>();
  private px: number;
  private py: number;
  private storm: boolean;
  private stopped = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, ARROW_TIME + 200);
    this.pix = this.ink(64, 64);
    this.px = c.x + c.dx * 8;
    this.py = c.y - 13 + c.dy * 8;
    this.storm = c.look === 'storm';
    this.lamp = this.light(this.px, this.py, 80, c.pal.light, 1.8);
    sound.bowShot(world.pan(c.x), this.storm);
    sound.volley(world.pan(c.x), this.storm);
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    const flying = t < ARROW_TIME && !this.stopped;
    const ox = this.px;
    const oy = this.py;
    if (flying) {
      this.px += (c.dx * ARROW_SPEED * dt) / 1000;
      this.py += (c.dy * ARROW_SPEED * dt) / 1000;
      if (!Phaser.Geom.Rectangle.Contains(world.area, this.px, this.py)) this.stopped = true;
      for (const h of world.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && segDist(b.x, b.y - b.bodyY, ox, oy, this.px, this.py) < b.radius + 5)) {
        this.struck.add(h);
        h.hurt({ damage: 62, heavy: true, knock: 150, fromX: h.x - c.dx * 10, fromY: h.y - h.bodyY - c.dy * 10 });
        world.debris(p.tints, h.x, h.y - h.bodyY, 10, h.y + 10, 'burst');
        flare(world, h.x, h.y - h.bodyY, 70, p.light, 2, 250);
        sound.arrowHit(world.pan(h.x), this.storm);
      }
      // The gale: two strands of wind twisting round the arrow's wake.
      for (const side of [-1, 1]) {
        const w = Math.sin(t * 0.03 + side * 1.6) * 5;
        world.debris(p.tints, this.px - c.dx * 14 - c.dy * w, this.py - c.dy * 14 + c.dx * w, 1, this.py + 30, 'trail');
      }
    }

    const x = this.px;
    const y = this.py;
    const g = this.pix.begin(x, y, c.y + 30);
    const fade = flying ? 1 : 1 - clamp01((t - ARROW_TIME) / 200);
    if (fade > 0) {
      const ux = c.dx;
      const uy = c.dy;
      const nx = -uy;
      const ny = ux;
      // Streak of speed behind.
      for (let i = 20; i < 30; i++) if (dither(Math.round(x - ux * i), Math.round(y - uy * i)) < 0.5 * fade) g.put(x - ux * i, y - uy * i, p.mid);
      // Shaft, head and fletching.
      stroke(g, x - ux * 22, y - uy * 22, x - ux * 3, y - uy * 3, 0.9, p, fade);
      for (let i = 0; i < 7; i++) {
        const hw = (i / 6) * 3;
        for (let o = -hw; o <= hw; o += 0.5) g.put(x - ux * i + nx * o, y - uy * i + ny * o, Math.abs(o) < 0.8 ? p.core : Math.abs(o) < 2 ? p.hot : p.mid, fade);
      }
      for (const s of [-1, 1]) line(g, x - ux * 19, y - uy * 19, x - ux * 25 + nx * 4 * s, y - uy * 25 + ny * 4 * s, p.deep, fade);
      if (this.storm) {
        const seed = Math.floor(t / 45);
        bolt(g, x - ux * 28 + nx * 6, y - uy * 28 + ny * 6, x - ux * 4, y - uy * 4, p, seed, fade, 0.8);
        bolt(g, x - ux * 28 - nx * 6, y - uy * 28 - ny * 6, x - ux * 8, y - uy * 8, p, seed + 99, fade * 0.8, 0.8);
      }
    }
    g.end();
    this.lamp.setPosition(x, y);
    this.lamp.intensity = 1.8 * fade;
  }
}
