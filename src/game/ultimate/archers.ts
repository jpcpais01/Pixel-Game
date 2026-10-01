import Phaser from 'phaser';
import type { Hurtbox } from '../combat';
import { onGround } from '../Toxins';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import type { Cast } from './types';
import { bloom, bump, circle, clamp01, dither, drag, easeOut, flare, Fx, GROUND, hash, type Ink, pool, ring, strikeGround } from './ink';

// The Specials of the archer's second and third types. The arbalest's Black
// Powder: a great bolt with a powder keg lashed to it, lobbed onto a spot,
// where its fuse spits for a moment before the whole thing goes up. The
// windrunner's Tempest: a cyclone set loose along the aim that drags foes
// into its heart, wears at them while it walks, and flings them away when it
// blows itself out.
//
// Their skins change more than colour here: Briar Rose's Rosethorn Bloom lobs
// a great rosebud instead of a keg, which bursts in petals and thorns over a
// ring of briar; Wisteria's Gale whirls wisteria petals up its funnel.

/** Black Powder: the keg's flight, its fuse, and the blast. */
const KEG_FLIGHT = 380;
const KEG_ARC = 30;
const KEG_FUSE = 750;
const KEG_R = 46;
const KEG_DAMAGE = 90;
const KEG_KNOCK = 230;
/** How long the scorch and smoke linger after. */
const KEG_AFTER = 1100;

const STAVE = [0xc89058, 0x9a6438, 0x6a4022];
const HOOP = [0x8a92a4, 0x444a58];
/** Briar Rose's bud: its petals lit to shadowed, the green sepals cupping it, its leaves and thorns. */
const BUD = [0xff8088, 0xe4344a, 0xb4162e, 0x7c0c22];
const SEPAL = [0x76a048, 0x3a5e24];
const ROSE_PETALS = [0xffd0d8, 0xff8088, 0xe4344a, 0xb4162e];
const BRIAR_LEAVES = [0x76a048, 0x4a9036, 0x2e6e24];

/** A great bolt with a keg of black powder lashed behind its head, lobbed onto the aimed spot. */
export class PowderKeg extends Fx {
  private air: Ink;
  private scar: Ink;
  private shadow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private landed = false;
  private blown = false;
  private readonly x0: number;
  private readonly y0: number;
  private readonly seed = Math.floor(Math.random() * 1000);
  /** Briar Rose's Rosethorn Bloom: a rosebud for a keg. */
  private readonly rose: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, KEG_FLIGHT + KEG_FUSE + KEG_AFTER);
    this.rose = c.look === 'briar';
    this.x0 = c.x + c.dx * 6;
    this.y0 = c.y + c.dy * 3;
    this.air = this.ink(32, 32);
    this.scar = this.ink(KEG_R * 2 + 12, Math.ceil(KEG_R * GROUND * 2) + 12);
    this.shadow = this.own(world.add.image(this.x0, this.y0, 'shadow').setDepth(1).setScale(0.5, 0.35).setAlpha(0.35));
    this.lamp = this.light(this.x0, this.y0, 40, this.rose ? c.pal.light : 0xffa040, 0.9);
    sound.crossbow(world.pan(c.x));
    sound.cannon(world.pan(c.x), false);
  }

  protected step(): void {
    const { c, t, world } = this;
    if (t < KEG_FLIGHT) {
      const k = t / KEG_FLIGHT;
      const gx = this.x0 + (c.tx - this.x0) * k;
      const gy = this.y0 + (c.ty - this.y0) * k;
      const h = 14 * (1 - k) + bump(k) * KEG_ARC;
      // Nose up as it climbs, nose down as it drops.
      const dy = (c.ty - this.y0) / KEG_FLIGHT - (Math.cos(k * Math.PI) * KEG_ARC * Math.PI) / KEG_FLIGHT;
      const dx = (c.tx - this.x0) / KEG_FLIGHT;
      const d = Math.hypot(dx, dy) || 1;
      this.drawKeg(this.air.begin(gx, gy - h, gy + 2), gx, gy - h, dx / d, dy / d, false);
      this.air.end();
      this.shadow.setPosition(Math.round(gx), Math.round(gy));
      this.lamp.setPosition(gx, gy - h);
      if (Math.random() < 0.4) world.debris(this.rose ? ROSE_PETALS : [0xfff0c0, 0xffa040], gx - (dx / d) * 6, gy - h - (dy / d) * 6, 1, gy + 2, 'trail');
      return;
    }
    if (!this.landed) {
      this.landed = true;
      this.shadow.setVisible(false);
      world.debris([0xe8dcc0, 0xb8a888, 0x8a7a60], c.tx, c.ty, 7, c.ty + 1);
      sound.thud(world.pan(c.tx), true);
      sound.sizzle(world.pan(c.tx));
    }
    const fuse = t - KEG_FLIGHT;
    if (fuse < KEG_FUSE) {
      // Stuck in the ground, the fuse spitting sparks, a warning ring on the ground pulsing faster.
      const g = this.air.begin(c.tx, c.ty - 6, c.ty + 1);
      this.drawKeg(g, c.tx, c.ty - 6, 0.35 * Math.sign(c.dx || 1), 0.94, true);
      this.air.end();
      const pulse = 0.5 + 0.5 * Math.sin(fuse * (0.012 + fuse * 0.00003));
      const s = this.scar.begin(c.tx, c.ty, 3);
      circle(s, c.tx, c.ty, KEG_R * easeOut(fuse / 200), c.pal.mid, 0.4 + 0.5 * pulse);
      circle(s, c.tx, c.ty, KEG_R * easeOut(fuse / 200) - 2, c.pal.deep, 0.3 * pulse);
      this.scar.end();
      this.lamp.setPosition(c.tx, c.ty - 12);
      this.lamp.intensity = 0.8 + pulse;
      if (Math.random() < 0.6) world.debris(this.rose ? [0xffffff, c.pal.hot, c.pal.mid] : [0xffffff, 0xfff0a0, 0xffa040], c.tx + 1, c.ty - 15, 1, c.ty + 1, 'burst');
      return;
    }
    if (!this.blown) this.blow();
    // The scorch and the smoke clearing.
    const after = (t - KEG_FLIGHT - KEG_FUSE) / KEG_AFTER;
    const s = this.scar.begin(c.tx, c.ty, 3);
    // A scorch, or for the rose a bed of fallen petals on dark leaves.
    pool(s, c.tx, c.ty, KEG_R * 0.55, this.rose ? 0x10200e : 0x1a120c, this.rose ? 0x5a0a18 : 0x2a1a10, 1 - after, GROUND, 0.7);
    if (this.rose) this.briarRing(s, after);
    ring(s, c.tx, c.ty, KEG_R * (0.6 + 0.5 * easeOut(after * 3)), 3 * (1 - after), c.pal, clamp01(1 - after * 3), GROUND, 0.3, this.seed);
    for (let i = 0; i < 14; i++) {
      // Embers left on the scorch, winking out one by one.
      if (hash(i, this.seed) < after) continue;
      const a = hash(i, this.seed, 1) * Math.PI * 2;
      const r = hash(i, this.seed, 2) * KEG_R * 0.6;
      const x = c.tx + Math.cos(a) * r;
      const y = c.ty + Math.sin(a) * r * GROUND;
      if (dither(Math.round(x), Math.round(y)) < 1 - after) s.put(x, y, hash(i, this.seed, 3) < 0.5 ? c.pal.hot : c.pal.mid);
    }
    this.scar.end();
    this.lamp.intensity = Math.max(0, 3 * (1 - after * 2));
  }

  /** The keg goes up: everything in the ring is struck and thrown, with fire, smoke and earth. */
  private blow(): void {
    const { c, world } = this;
    this.blown = true;
    this.air.begin(0, 0, 0).end();
    strikeGround(world, c.tx, c.ty, KEG_R, { damage: KEG_DAMAGE, heavy: true, knock: KEG_KNOCK, fromX: c.tx, fromY: c.ty });
    sound.blast(world.pan(c.tx));
    sound.cannon(world.pan(c.tx), false);
    world.cameras.main.shake(260, 0.004);
    flare(world, c.tx, c.ty - 8, 170, c.pal.light, 4, 500);
    bloom(world, c.tx, c.ty - 10, c.pal.hot, 3.2, 380, c.ty + 40);
    bloom(world, c.tx, c.ty - 6, c.pal.mid, 4.5, 600, c.ty + 39, 0.6);
    world.debris([c.pal.core, c.pal.hot, c.pal.mid], c.tx, c.ty - 8, 26, c.ty + 30);
    if (this.rose) {
      world.debris(ROSE_PETALS, c.tx, c.ty - 10, 34, c.ty + 30, 'spores');
      world.debris(BRIAR_LEAVES, c.tx, c.ty - 6, 14, c.ty + 30, 'spores');
    } else world.debris([0x4a4038, 0x6a5e52, 0x2e2822], c.tx, c.ty - 6, 18, c.ty + 30, 'spores');
    world.debris([0x8a6a4a, 0x5a4430], c.tx, c.ty, 12, c.ty + 2);
    this.lamp.setPosition(c.tx, c.ty - 10);
  }

  /** Briar Rose's ring: briar stems curling round the blast, thorns standing off them, withering as it fades. */
  private briarRing(s: Ink, after: number): void {
    const { c } = this;
    const a0 = clamp01(1 - after * 1.3);
    if (a0 <= 0) return;
    for (let i = 0; i < 90; i++) {
      const th = (i / 90) * Math.PI * 2;
      // Two stems twisting round each other.
      for (const k of [0, 1]) {
        const r = KEG_R * (0.78 + 0.06 * Math.sin(th * 7 + k * Math.PI));
        const x = c.tx + Math.cos(th) * r;
        const y = c.ty + Math.sin(th) * r * GROUND;
        if (dither(Math.round(x), Math.round(y)) < a0) s.put(x, y, k ? SEPAL[1] : SEPAL[0]);
        if (i % 9 === k * 4) s.put(x, y - 1, 0x96402c, a0);
      }
      // Here and there a rose blooming on it.
      if (i % 15 === 7 && hash(i, this.seed) < a0) {
        const x = c.tx + Math.cos(th) * KEG_R * 0.78;
        const y = c.ty + Math.sin(th) * KEG_R * 0.78 * GROUND;
        s.put(x, y - 1, BUD[0]);
        s.put(x + 1, y - 1, BUD[1]);
        s.put(x, y, BUD[2]);
        s.put(x + 1, y, BUD[3]);
      }
    }
  }

  /** The great bolt, head first along (ux, uy), with the keg lashed behind its head and the fuse burning (or Briar Rose's rosebud on a briar shaft). */
  private drawKeg(g: Ink, x: number, y: number, ux: number, uy: number, stuck: boolean): void {
    const nx = -uy;
    const ny = ux;
    if (this.rose) {
      this.drawBud(g, x, y, ux, uy, nx, ny, stuck);
      return;
    }
    // Shaft and red vanes.
    for (let i = -14; i <= 4; i++) g.put(x + ux * i, y + uy * i, i < -6 ? 0x94603a : 0xb88050);
    if (!stuck) for (const s of [-1, 1]) for (let i = 12; i <= 14; i++) g.put(x - ux * i + nx * s * (1 + (i - 12) * 0.5), y - uy * i + ny * s * (1 + (i - 12) * 0.5), 0xe8664a);
    // The broad steel head (buried when stuck).
    if (!stuck) for (let i = 5; i <= 8; i++) for (let o = -(8 - i) * 0.6; o <= (8 - i) * 0.6; o += 0.5) g.put(x + ux * i + nx * o, y + uy * i + ny * o, o < 0 ? 0xe6eef8 : 0xa8b4c8);
    // The keg: a little barrel, staves lit from the left, two iron hoops.
    for (let j = -3; j <= 3; j++) {
      const hw = Math.abs(j) === 3 ? 2 : 3;
      for (let o = -hw; o <= hw; o++) {
        const hoop = Math.abs(j) === 2;
        const col = hoop ? (o < 0 ? HOOP[0] : HOOP[1]) : o < -1 ? STAVE[0] : o < 2 ? STAVE[1] : STAVE[2];
        g.put(x + ux * j + nx * o, y + uy * j + ny * o, col);
      }
    }
    // The fuse, and its spark.
    const fx = x - ux * 3 - nx * 3;
    const fy = y - uy * 3 - ny * 3;
    g.put(fx, fy, 0x3a2a1a);
    g.put(fx - nx, fy - ny - 1, Math.random() < 0.5 ? 0xffffff : 0xfff0a0);
  }

  /** A great rosebud bound to a briar stem: petals furled to a point, green sepals cupping it, thorns down the stem, a glitter at its tip. */
  private drawBud(g: Ink, x: number, y: number, ux: number, uy: number, nx: number, ny: number, stuck: boolean): void {
    for (let i = -14; i <= -3; i++) g.put(x + ux * i, y + uy * i, i < -8 ? SEPAL[1] : SEPAL[0]);
    for (const i of [-12, -9, -6]) g.put(x + ux * i + nx * (i % 2 ? 1 : -1), y + uy * i + ny * (i % 2 ? 1 : -1), 0x96402c);
    if (!stuck) for (const s of [-1, 1]) g.put(x - ux * 14 + nx * s, y - uy * 14 + ny * s, BUD[1]);
    // The bud, widest near its base, furled to a point ahead.
    for (let j = -3; j <= 5; j++) {
      const hw = j < 0 ? 2.4 + j * 0.4 : 2.6 - j * 0.45;
      for (let o = -hw; o <= hw; o += 0.5) {
        const spiral = Math.sin(j * 1.3 + o * 1.6) > 0.55;
        const col = o < -hw * 0.4 ? BUD[0] : o < hw * 0.3 ? BUD[1] : BUD[2];
        g.put(x + ux * j + nx * o, y + uy * j + ny * o, spiral ? BUD[3] : col);
      }
    }
    // Green sepals cupping its base.
    for (const s of [-1, 1]) for (let j = -3; j <= -1; j++) g.put(x + ux * j + nx * s * (2.6 + j * 0.2), y + uy * j + ny * s * (2.6 + j * 0.2), SEPAL[j < -2 ? 1 : 0]);
    g.put(x + ux * 6, y + uy * 6, Math.random() < 0.5 ? 0xffffff : BUD[0]);
  }
}

/** Tempest: the cyclone's walk, its pull and its bite. */
const TEMPEST_TIME = 2600;
const TEMPEST_SPEED = 52;
/** Foes this close are dragged in; this close to its heart they are struck. */
const PULL_R = 46;
const PULL_SPEED = 70;
const BITE_R = 24;
const BITE_EVERY = 200;
const BITE_DAMAGE = 6;
/** When it blows itself out: one last gust that throws everything near away. */
const BURST_R = 34;
const BURST_DAMAGE = 16;
const BURST_KNOCK = 260;
const TEMPEST_FADE = 300;
const FUNNEL_H = 52;

/** A cyclone loosed along the aim, walking slowly, pulling foes into its heart. */
export class Tempest extends Fx {
  private pix: Ink;
  private base: Ink;
  private lamp: Phaser.GameObjects.Light;
  private x: number;
  private y: number;
  private bite = 0;
  private burst = false;
  private whirlIn = 0;
  private readonly seed = Math.floor(Math.random() * 1000);
  /** Wisteria's Gale: petals whirled up the funnel instead of leaves and dust. */
  private readonly petals: boolean;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, TEMPEST_TIME + TEMPEST_FADE);
    this.petals = c.look === 'wisteria';
    this.x = c.x + c.dx * 20;
    this.y = c.y + c.dy * 14;
    this.pix = this.ink(72, 72);
    this.base = this.ink(PULL_R * 2 + 8, Math.ceil(PULL_R * GROUND * 2) + 8);
    this.lamp = this.light(this.x, this.y - 20, 90, c.pal.light, 1.6);
    sound.windCharge(world.pan(this.x));
    sound.gust(world.pan(this.x));
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const alive = t < TEMPEST_TIME;
    if (alive) {
      const nx = this.x + (c.dx * TEMPEST_SPEED * dt) / 1000;
      const ny = this.y + (c.dy * TEMPEST_SPEED * dt) / 1000;
      if (world.area.contains(nx, ny)) {
        this.x = nx;
        this.y = ny;
      }
      // Everything near is dragged toward its heart; what's in its heart is worn at.
      const near = world.hurtboxesWhere((h) => h.alive && onGround(h, this.x, this.y, PULL_R));
      for (const h of near) drag(h, this.x, this.y, PULL_SPEED, dt);
      this.bite -= dt;
      if (this.bite <= 0) {
        this.bite = BITE_EVERY;
        for (const h of near) {
          if (!onGround(h, this.x, this.y, BITE_R)) continue;
          h.hurt({ damage: BITE_DAMAGE, heavy: false, knock: 0, fromX: this.x, fromY: this.y });
          world.debris(c.pal.tints, h.x, h.y - h.bodyY, 2, h.y + 10, 'trail');
        }
      }
      this.whirlIn -= dt;
      if (this.whirlIn <= 0) {
        this.whirlIn = 520;
        sound.whirl(world.pan(this.x));
      }
      // Leaves and dust whipped round it.
      if (Math.random() < dt / 40) {
        const a = Math.random() * Math.PI * 2;
        world.debris(this.petals ? [0xffffff, 0xe0ccff, 0xb48af0, 0x8a52d8] : [c.pal.hot, c.pal.mid, 0x8ac06a, 0xd8c078], this.x + Math.cos(a) * 14, this.y - 4 - Math.random() * 30, 1, this.y + 4, 'gather');
      }
    } else if (!this.burst) {
      this.blowOut();
    }
    this.draw();
  }

  /** It blows itself out: a last gust throws everything near it away. */
  private blowOut(): void {
    const { c, world } = this;
    this.burst = true;
    const hit: Hurtbox[] = strikeGround(world, this.x, this.y, BURST_R, { damage: BURST_DAMAGE, heavy: true, knock: BURST_KNOCK, fromX: this.x, fromY: this.y });
    for (const h of hit) world.debris(c.pal.tints, h.x, h.y - h.bodyY, 6, h.y + 10);
    sound.gust(world.pan(this.x));
    sound.windDash(world.pan(this.x));
    world.cameras.main.shake(140, 0.0018);
    flare(world, this.x, this.y - 16, 110, c.pal.light, 2.4, 320);
    world.debris(c.pal.tints, this.x, this.y - 18, 22, this.y + 30);
  }

  private draw(): void {
    const { c, t } = this;
    const p = c.pal;
    const grow = easeOut(t / 260);
    const fade = 1 - clamp01((t - TEMPEST_TIME) / TEMPEST_FADE);
    const x = this.x;
    const y = this.y;
    // On the ground: the swirl of its skirts, a ring of dust spiralling in.
    const b = this.base.begin(x, y, 3);
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 26; i++) {
        const f = i / 26;
        const a = arm * ((Math.PI * 2) / 3) + f * 3 - t * 0.006;
        const r = (8 + f * (PULL_R - 10)) * grow;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * GROUND;
        if (dither(Math.round(px), Math.round(py)) < (1 - f) * 0.8 * fade) b.put(px, py, f < 0.3 ? p.hot : f < 0.65 ? p.mid : p.deep, 0.8);
      }
    }
    b.end();
    // The funnel: rings of wind stacked up from a point on the ground, widening as they climb,
    // its spine leaning and swaying, streaks racing round each ring.
    const g = this.pix.begin(x, y, y + 8, 0.5, 0.85);
    const lift = (1 - fade) * 10;
    for (let k = 0; k < 14; k++) {
      const f = k / 13;
      const h = f * FUNNEL_H * grow + lift;
      const cx = x + Math.sin(t * 0.004 + f * 2.2) * (2 + f * 5);
      const cy = y - h;
      const r = (3 + f * f * 18 + f * 4) * grow;
      const n = Math.ceil(r * 5);
      const spin = t * (0.016 - f * 0.006) + k * 0.7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        // Only the streaks of each ring show: wind, not a solid cone.
        const s = (a + spin) % (Math.PI * 2);
        const streak = Math.sin(s * 3 + hash(k, this.seed) * 6);
        if (streak < 0.15) continue;
        const front = Math.sin(a) > 0;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.32;
        const u = front ? (streak > 0.75 ? 0 : streak > 0.45 ? 1 : 2) : 3;
        const col = [p.core, p.hot, p.mid, p.deep][u];
        if (dither(Math.round(px), Math.round(py)) < fade * (front ? 1 : 0.55)) g.put(px, py, col, front ? 1 : 0.7);
        // Wisteria petals caught in the streaks, tumbling as they go round.
        if (this.petals && front && streak > 0.9 && hash(k, i, this.seed) < 0.5) {
          g.put(px, py, 0x8a52d8);
          g.put(px + (Math.floor(t / 80 + i) % 2 ? 1 : 0), py - 1, 0xe0ccff);
        }
      }
    }
    g.end();
    this.lamp.setPosition(x, y - 24);
    this.lamp.intensity = 1.6 * fade;
  }
}
