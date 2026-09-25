import type Phaser from 'phaser';
import { sound } from '../../audio';
import { heroBuffs, type BuffDef } from '../buffs';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bump, clamp01, column, dither, drag, easeIn, easeOut, flare, Fx, GROUND, hash, line, pool, ring, segDist, star, stroke, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The fighting classes' Specials: the Knight's sword from the sky, the Jedi's
// thrown saber, the Brawler's dragon rush and the Iron monk's quake.

const SWORD_FALL = 230;
const SWORD_APPEAR = 160;

/** Draw a great sword standing point-down with its tip at (x, tip); pixels below `floor` are sunk in the ground. */
function greatSword(g: Ink, x: number, tip: number, p: Pal, a: number, floor = Infinity): void {
  const put = (px: number, py: number, c: number) => {
    if (py > floor) return;
    if (a < 1 && dither(Math.round(px), Math.round(py)) >= a) return;
    g.put(px, py, c);
  };
  // Blade: 44 long, widening from the point over its last 10.
  for (let i = 0; i < 44; i++) {
    const y = tip - i;
    const hw = i < 10 ? Math.floor((i / 10) * 3.5) : 3;
    for (let dx = -hw; dx <= hw; dx++) {
      const u = Math.abs(dx) / (hw + 0.5);
      put(x + dx, y, dx === -hw || dx === hw ? p.deep : dx === 0 && i > 6 ? p.hot : u < 0.4 ? p.core : p.mid);
    }
  }
  // Crossguard, grip and pommel.
  const gy = tip - 44;
  for (let dx = -9; dx <= 9; dx++) {
    const end = Math.abs(dx) > 7;
    put(x + dx, gy, end ? p.hot : p.mid);
    put(x + dx, gy - 1, end ? p.core : p.hot);
    put(x + dx, gy - 2, p.deep);
  }
  for (let i = 3; i < 12; i++) {
    put(x - 1, gy - i, 0x3a2a24);
    put(x, gy - i, i % 3 === 0 ? 0x8a6a4a : 0x5a3e30);
    put(x + 1, gy - i, 0x2a1c18);
  }
  for (let dy = 0; dy < 3; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, gy - 12 - dy, dx === 0 && dy === 1 ? p.core : p.hot);
}

/** The Knight's Skybreaker: a giant blade of light drops from the sky onto the spot and splits the ground. */
export class Skybreaker extends Fx {
  private sword: Ink;
  private ground: Ink;
  private glow: Phaser.GameObjects.Image;
  private landed = false;
  private cracks: { a: number; len: number; seed: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 2100);
    this.sword = this.ink(26, 90);
    this.ground = this.ink(150, 90);
    this.glow = this.halo(p.hot, 1.4, y + 3);
    for (let i = 0; i < 8; i++) this.cracks.push({ a: (i / 8) * Math.PI * 2 + hash(i, 1) * 0.5, len: 22 + hash(i, 2) * 20, seed: i });
    sound.starcall(world.pan(x));
  }

  protected step(): void {
    const { x, y, p, t } = this;
    const hit = SWORD_APPEAR + SWORD_FALL;
    const fall = clamp01((t - SWORD_APPEAR) / SWORD_FALL);
    const tip = t < hit ? y - 150 * (1 - easeIn(fall)) : y + 9;
    if (!this.landed && t >= hit) this.land();

    // The sword: fading in high up, plunging, stuck fast, then breaking up into light.
    const a = t < SWORD_APPEAR ? t / SWORD_APPEAR : t > 1400 ? 1 - (t - 1400) / 500 : 1;
    const s = this.sword.begin(x, tip + 1, y + 3, 0.5, 1);
    if (a > 0) {
      greatSword(s, x, tip, p, a, this.landed ? y : Infinity);
      // Streaks of speed above it as it drops.
      if (fall > 0 && fall < 1) for (const dx of [-4, 0, 4]) line(s, x + dx, tip - 60, x + dx, tip - 60 - 20 * fall, p.mid, 0.5);
    }
    s.end();
    this.glow.setPosition(x, tip - 26).setAlpha(0.5 * Math.max(0, a)).setScale(1.2 + (this.landed ? 0.3 * bump((t - hit) / 400) : 0));
    if (this.landed && t > 1400 && Math.floor(t / 60) !== Math.floor((t - 16) / 60)) this.world.debris(p.tints, x + (Math.random() - 0.5) * 6, y - Math.random() * 50, 3, y + 5, 'spores');

    // The ground: a shock ring, and cracks of light that cool and close.
    const g = this.ground.begin(x, y, 2.5);
    if (this.landed) {
      const k = (t - hit) / 480;
      if (k < 1) {
        ring(g, x, y, 4 + 62 * easeOut(k), 4 * (1 - k) + 1, p, 1 - k);
        ring(g, x, y, 2 + 36 * easeOut(k * 1.2), 2, p, 0.8 * (1 - k), GROUND, 0.35, 3);
      }
      const cool = 1 - clamp01((t - hit - 700) / 700);
      pool(g, x, y, 12, 0x2a2024, 0x3a3034, cool, GROUND, 0.8);
      for (const c of this.cracks) {
        let px = x;
        let py = y;
        const n = 6;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const wob = (hash(c.seed, i) - 0.5) * 0.7;
          const qx = x + Math.cos(c.a + wob) * c.len * f * Math.min(1, (t - hit) / 120);
          const qy = y + Math.sin(c.a + wob) * c.len * f * GROUND * Math.min(1, (t - hit) / 120);
          line(g, px, py, qx, qy, f < 0.5 ? p.hot : p.mid, cool);
          line(g, px, py + 1, qx, qy + 1, 0x241c20, cool);
          px = qx;
          py = qy;
        }
      }
    }
    g.end();
  }

  private land(): void {
    this.landed = true;
    const { world, x, y, p } = this;
    strikeGround(world, x, y, 44, { damage: 78, heavy: true, knock: 190, fromX: x, fromY: y - 4 });
    world.cameras.main.shake(260, 0.0045);
    world.debris(p.tints, x, y - 4, 30, y + 20, 'burst');
    world.debris([0xb8a890, 0x7a6a58, p.mid], x, y - 2, 14, y + 20, 'spores');
    flare(world, x, y - 20, 220, p.light, 4.5, 700);
    bloom(world, x, y - 10, p.hot, 4, 420, y + 30);
    sound.slam(world.pan(x));
    sound.starImpact(world.pan(x));
  }
}

const THROW_OUT = 420;
const THROW_HOVER = 700;
const RETURN_SPEED = 280;

/** The Jedi's Saber Cyclone: the saber is hurled spinning along the aim, whirls there as a storm of blades, then flies home. */
export class SaberCyclone extends Fx {
  private pix: Ink;
  private shadow: Phaser.GameObjects.Image;
  private lamp: Phaser.GameObjects.Light;
  private sx: number;
  private sy: number;
  private ex: number;
  private ey: number;
  private spin = 0;
  private tick = 0;
  private hum = 0;
  private home = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 4000);
    this.pix = this.ink(64, 64);
    this.shadow = this.own(world.add.image(0, 0, 'shadow').setDepth(1.5).setAlpha(0.5));
    this.lamp = this.light(c.x, c.y, 70, c.pal.light, 1.6);
    this.sx = this.ex = c.x;
    this.sy = this.ey = c.y;
    // Flies out until a wall or its full reach.
    for (let d = 0; d <= 92; d += 4) {
      const x = c.x + c.dx * d;
      const y = c.y + c.dy * d;
      if (!world.walkable(x, y)) break;
      this.ex = x;
      this.ey = y;
    }
  }

  protected step(dt: number): void {
    const { c, t, world } = this;
    const p = c.pal;
    // Where the saber is (its feet on the ground under it).
    if (t < THROW_OUT) {
      const k = easeOut(t / THROW_OUT);
      this.sx = c.x + (this.ex - c.x) * k;
      this.sy = c.y + (this.ey - c.y) * k;
    } else if (t >= THROW_OUT + THROW_HOVER) {
      const hx = c.hero.x;
      const hy = c.hero.y;
      const d = Math.hypot(hx - this.sx, hy - this.sy);
      const s = (RETURN_SPEED * dt) / 1000;
      if (d <= s + 4) {
        this.home = true;
        world.debris(p.tints, hx, hy - 14, 8, hy + 10, 'burst');
        this.destroy();
        return;
      }
      this.sx += ((hx - this.sx) / d) * s;
      this.sy += ((hy - this.sy) / d) * s;
    }
    const hovering = t >= THROW_OUT && t < THROW_OUT + THROW_HOVER;
    this.spin += dt * (hovering ? 0.045 : 0.03);
    const x = this.sx;
    const y = this.sy - 12;

    // Blades bite every tick; while it whirls in place it drags foes into it.
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 100;
      const hits = world.melee({ kind: 'circle', x, y, radius: hovering ? 17 : 12 }, { damage: 9, knock: 25, fromX: x, fromY: y });
      if (hits.length) sound.saberHit(world.pan(x));
      for (const h of hits) world.debris([p.core, p.hot], h.x, h.y, 3, y + 30, 'burst');
    }
    if (hovering) for (const h of world.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.sx, b.y - this.sy) < 44)) drag(h, this.sx, this.sy, 36, dt);
    this.hum -= dt;
    if (this.hum <= 0) {
      this.hum = hovering ? 140 : 190;
      sound.saberSwing(1 + (Math.floor(t / 150) % 3), world.pan(x));
    }

    // The spinning saber: its blade, a smear of afterimages behind it, and the hilt at the centre.
    const g = this.pix.begin(x, y, this.sy + 8);
    if (hovering) ring(g, x, y, 15, 1.2, p, 0.45, 0.62, 0.55, Math.floor(t / 50));
    for (let k = 5; k >= 0; k--) {
      const a = this.spin - k * 0.28;
      const ux = Math.cos(a);
      const uy = Math.sin(a) * 0.8;
      if (k === 0) {
        stroke(g, x + ux * 3, y + uy * 3, x + ux * 17, y + uy * 17, 1, p);
        line(g, x - ux * 4, y - uy * 4, x + ux * 2, y + uy * 2, 0x9aa0aa);
        g.put(x - ux * 4, y - uy * 4, 0x4a4e58);
        g.put(x, y, 0xd8dce4);
      } else {
        const fade = 0.55 - k * 0.08;
        for (let r = 6; r <= 17; r += 1) {
          const px = x + ux * r;
          const py = y + uy * r;
          if (dither(Math.round(px), Math.round(py)) < fade) g.put(px, py, r > 12 ? p.mid : p.deep, 0.9);
        }
      }
    }
    g.end();
    this.shadow.setPosition(Math.round(this.sx), Math.round(this.sy)).setScale(1.3, 0.8);
    this.lamp.setPosition(x, y);
  }

  destroy(): void {
    if (!this.home && !this.dead) this.world.debris(this.c.pal.tints, this.sx, this.sy - 12, 6, this.sy + 10, 'burst');
    super.destroy();
  }
}

const DASH = 300;
const DASH_LEN = 96;

/** The Brawler's Dragon Rush: a flying dash wrapped in a fire dragon, through every foe in the way, ending in a blast. */
export class DragonRush extends Fx {
  private trail: Ink;
  private ground: Ink;
  private path: { x: number; y: number }[] = [];
  private struck = new Set<Hurtbox>();
  private ended = false;
  private ex = 0;
  private ey = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 1150);
    this.trail = this.ink(170, 150);
    this.ground = this.ink(110, 70);
    this.path.push({ x: c.x, y: c.y });
    world.evade(DASH + 250);
    sound.flurry(world.pan(c.x));
  }

  protected step(): void {
    const { c, t, world } = this;
    const p = c.pal;
    const h = c.hero;
    if (t <= DASH + 16 && !this.ended) {
      // Carry the hero along the dash, stopping at walls.
      const want = DASH_LEN * easeOut(Math.min(1, t / DASH));
      const last = this.path[this.path.length - 1];
      const done = Math.hypot(last.x - c.x, last.y - c.y);
      let x = last.x;
      let y = last.y;
      for (let d = done + 2; d <= want; d += 2) {
        const nx = c.x + c.dx * d;
        const ny = c.y + c.dy * d;
        if (!world.walkable(nx, ny)) break;
        x = nx;
        y = ny;
      }
      h.x = x;
      h.y = y;
      // Everything the dash passes through is bowled aside.
      for (const b of world.hurtboxesWhere((b) => b.alive && !this.struck.has(b) && segDist(b.x, b.y - b.bodyY, last.x, last.y - 12, x, y - 12) < 12 + b.radius)) {
        this.struck.add(b);
        const side = (b.x - x) * -c.dy + (b.y - y) * c.dx >= 0 ? 1 : -1;
        b.hurt({ damage: 34, heavy: true, knock: 150, fromX: b.x + c.dy * side * 10 - c.dx * 6, fromY: b.y - b.bodyY - c.dx * side * 10 - c.dy * 6 });
        world.debris(p.tints, b.x, b.y - b.bodyY, 8, b.y + 10, 'burst');
        sound.punchHit(world.pan(b.x), true);
      }
      if (x !== last.x || y !== last.y) this.path.push({ x, y });
      if (t >= DASH || x === last.x && y === last.y && t > 60) this.finish(x, y);
    }

    // The dragon: a ribbon of fire weaving along the path, thick at the head, fading from the tail.
    const mid = this.path[Math.floor(this.path.length / 2)];
    const g = this.trail.begin(mid.x, mid.y - 12, (this.ended ? this.ey : h.y) + 2);
    const fade = this.ended ? 1 - clamp01((t - DASH) / 650) : 1;
    const pts = this.path;
    const total = pts.length;
    for (let i = 1; i < total; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const segs = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let j = 0; j < segs; j++) {
        const f = (i - 1 + j / segs) / Math.max(1, total - 1);
        const x = a.x + ((b.x - a.x) * j) / segs;
        const y = a.y + ((b.y - a.y) * j) / segs - 12;
        const wave = Math.sin(f * 11 - t * 0.02) * 5 * f;
        const cx = x - c.dy * wave;
        const cy = y + c.dx * wave;
        const w = 1 + 4 * f;
        const alpha = fade * (0.35 + 0.65 * f);
        for (let o = -w; o <= w; o += 0.5) {
          const px = cx - c.dy * o;
          const py = cy + c.dx * o;
          if (alpha < 1 && dither(Math.round(px), Math.round(py)) >= alpha) continue;
          g.put(px, py, o === 0 ? p.core : Math.abs(o) < w * 0.4 ? p.hot : Math.abs(o) < w * 0.75 ? p.mid : p.deep);
        }
        // Scales: bright flecks along the ribbon's back.
        if (hash(Math.round(f * 97), 5) > 0.82) g.put(cx - c.dy * w, cy + c.dx * w, p.core, alpha);
      }
    }
    if (!this.ended || t < DASH + 200) {
      // The head: jaws and horns swept back from the fist.
      const hx = h.x + c.dx * 6;
      const hy = h.y - 12 + c.dy * 6;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const bx = hx - c.dx * i + -c.dy * side * i * 0.7;
          const by = hy - c.dy * i + c.dx * side * i * 0.7;
          g.put(bx, by, i < 3 ? p.core : i < 6 ? p.hot : p.mid, fade);
        }
      }
      star(g, hx, hy, 4, p, fade);
    }
    g.end();

    // The blast where the dash ends.
    const gg = this.ground.begin(this.ex || h.x, this.ey || h.y, 2.5);
    if (this.ended) {
      const k = (t - DASH) / 450;
      if (k < 1) ring(gg, this.ex, this.ey, 4 + 36 * easeOut(k), 3 * (1 - k) + 1, p, 1 - k);
      pool(gg, this.ex, this.ey, 16, 0x2a1410, 0x4a2014, 1 - clamp01((t - DASH) / 800), GROUND, 0.7);
    }
    gg.end();
  }

  private finish(x: number, y: number): void {
    this.ended = true;
    this.ex = x;
    this.ey = y;
    const { world, c } = this;
    const p = c.pal;
    strikeGround(world, x + c.dx * 8, y + c.dy * 8, 38, { damage: 40, heavy: true, knock: 170, fromX: x, fromY: y - 10 });
    world.cameras.main.shake(200, 0.0035);
    world.debris(p.tints, x + c.dx * 8, y - 12, 24, y + 20, 'burst');
    flare(world, x, y - 14, 160, p.light, 3.5, 600);
    bloom(world, x + c.dx * 8, y - 12, p.hot, 3, 380, y + 30);
    world.addEffect(new Plume(world, x + c.dx * 8, y + c.dy * 8, p));
    sound.punchHit(world.pan(x), true);
    sound.starImpact(world.pan(x));
  }
}

/** A short pillar of fire bursting upward (the end of the dragon rush). */
class Plume extends Fx {
  private pix: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 520);
    this.pix = this.ink(30, 64);
  }

  protected step(): void {
    const f = this.t / 520;
    const g = this.pix.begin(this.x, this.y + 2, this.y + 3, 0.5, 1);
    column(g, this.x, this.y, 56 * Math.pow(bump(Math.min(1, f * 1.5)), 0.5), 1 + 6 * (1 - f), this.p, 1 - f * 0.5, this.t);
    g.end();
  }
}

const STONE = { light: 0xd8ccb4, mid: 0x9a8a74, dark: 0x5e5044, edge: 0x3a3028 };
const WAVES = [
  { at: 0, r: 56 },
  { at: 280, r: 72 },
  { at: 560, r: 88 },
];

/** Stoneskin: the Iron monk's hide hardens after the quake. */
const stoneskin = (p: Pal): BuffDef => ({ id: 'stoneskin', name: 'Stoneskin', icon: 'ult_icon_fighter_monk', tint: p.mid, duration: 6000, mods: { guard: 0.5 } });

/** The Iron monk's Mountain's Wrath: three quakes rolling out from his fist, each raising a ring of stone spikes; his skin turns to stone. */
export class MountainWrath extends Fx {
  private ground: Ink;
  private back: Ink;
  private front: Ink;
  private next = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, 1900);
    this.ground = this.ink(200, 120);
    this.back = this.ink(200, 130);
    this.front = this.ink(200, 130);
    heroBuffs.add(stoneskin(c.pal));
    world.buffGained(stoneskin(c.pal));
  }

  protected step(): void {
    const { c, t, world } = this;
    const p = c.pal;
    const { x, y } = c;
    while (this.next < WAVES.length && t >= WAVES[this.next].at) {
      const w = WAVES[this.next++];
      strikeGround(world, x, y, w.r, { damage: 26, heavy: true, knock: 110 + this.next * 20, fromX: x, fromY: y });
      world.cameras.main.shake(160, 0.002 + this.next * 0.001);
      world.debris([STONE.light, STONE.mid, p.mid], x, y - 4, 10, y + 20, 'burst');
      flare(world, x, y - 8, w.r * 2, p.light, 2.2, 450);
      sound.thud(world.pan(x), true);
    }

    const g = this.ground.begin(x, y, 2.5);
    const bk = this.back.begin(x, y - 20, y - 0.5);
    const fr = this.front.begin(x, y - 20, y + 60);
    for (let i = 0; i < this.next; i++) {
      const w = WAVES[i];
      const age = t - w.at;
      const k = age / 460;
      if (k < 1) {
        ring(g, x, y, 6 + w.r * easeOut(k), 3 * (1 - k) + 1.5, p, 1 - k * 0.8);
        ring(g, x, y, 3 + w.r * 0.7 * easeOut(k), 1.5, { ...p, core: STONE.light, hot: STONE.mid, mid: STONE.dark, deep: STONE.edge }, 1 - k, GROUND, 0.3, i);
      }
      // A ring of spikes rising where the quake has passed, then sinking back.
      const n = 9 + i * 3;
      for (let j = 0; j < n; j++) {
        const th = (j / n) * Math.PI * 2 + i * 0.6 + hash(i, j) * 0.3;
        const rr = w.r * (0.72 + hash(j, i, 4) * 0.2);
        const reach = easeOut(k) * w.r;
        if (reach < rr) continue;
        const born = age - (rr / w.r) * 300;
        const hgt = (8 + hash(j, i, 2) * 6) * Math.min(1, born / 90) * (1 - clamp01((born - 600) / 250));
        if (hgt < 1) continue;
        const sx = x + Math.cos(th) * rr;
        const sy = y + Math.sin(th) * rr * GROUND;
        spike(sy < y ? bk : fr, sx, sy, hgt, p);
      }
    }
    pool(g, x, y, 14, 0x3a3028, 0x4e4238, 1 - clamp01((t - 800) / 800), GROUND, 0.7);
    g.end();
    bk.end();
    fr.end();
  }
}

/** A jag of stone thrust up from the ground, lit on one side, with a seam of chi glowing up its edge. */
function spike(g: Ink, x: number, y: number, h: number, p: Pal): void {
  for (let dy = 0; dy < h; dy++) {
    const hw = Math.max(0, (1 - dy / h) * 3.5);
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
      if (Math.abs(dx) > hw + 0.3) continue;
      const edge = Math.abs(dx) >= hw - 0.5;
      g.put(x + dx, y - dy, edge ? STONE.edge : dx < 0 ? STONE.light : dx === 0 ? STONE.mid : STONE.dark);
    }
    if (dy > 1) g.put(x - Math.floor(hw), y - dy, dy > h * 0.6 ? p.hot : p.mid);
  }
  g.put(x, y - h, p.core);
}
