import Phaser from 'phaser';
import { BLOOM_H, BLOOM_BASE, FOUNTAIN_BASE, FOUNTAIN_H, FOUNTAIN_HEART_Y, FOUNTAIN_JET_Y, PILLAR_BASE, PILLAR_H, RUIN_H_BASE, RUIN_H_H, RUIN_V_BASE, RUIN_V_H, SEED_H, THORNBLOOM_BASE, THORNBLOOM_H, type BloomKind } from '../art/garden';
import { MIGHT, RENEW, SWIFTNESS, WARD, heroBuffs, type BuffDef } from '../game/buffs';
import type { Hit, Hurtbox } from '../game/combat';
import { snap } from '../game/display';
import { sunShadow } from '../game/Wizard';
import { sound } from '../audio';
import { settings } from '../game/settings';
import type { WorldScene } from '../scenes/WorldScene';
import { POOL, gardenLayout, type Rect } from './sunken';

// The Sunken Garden's living parts: the ruins (culled to the view), the
// fountain, and its flowers. Thornblooms block doorways until they are cut
// down; blooms let go of a glowing seed that grants a buff when touched.
// Both grow back after a while, once nobody is standing in the way.

type Img = Phaser.GameObjects.Image;

/** What each bloom gives, and the colours its petals scatter in. */
const BLOOM_BUFF: Record<BloomKind, BuffDef> = { might: MIGHT, swift: SWIFTNESS, ward: WARD, renew: RENEW };
const PETALS: Record<BloomKind | 'thorn', number[]> = {
  might: [0xfff0aa, 0xffd05c, 0xf2a530],
  swift: [0xd8f8ff, 0x86deff, 0x40b8e8],
  ward: [0xe4d8ff, 0xb69cff, 0x8a6ae6],
  renew: [0xffe0ec, 0xff9ec0, 0xf06a9c],
  thorn: [0xffc0d6, 0xf47aa2, 0xd8467c, 0xffd45c],
};

const FLASH_TIME = 110;

interface FlowerStyle {
  texture: string;
  up: string;
  down: string;
  /** Shown while growing back, before it is whole again. */
  bud?: string;
  originY: number;
  hp: number;
  bodyY: number;
  radius: number;
  /** ms before it grows back. */
  regrow: number;
  petals: number[];
}

/** A giant flower: struck like a monster, it falls, and grows back. */
class Flower implements Hurtbox {
  readonly bodyY: number;
  readonly radius: number;
  hp: number;
  private state: 'up' | 'down' = 'up';
  private timer = 0;
  private flashT = 0;
  private wobble = 0;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private flash: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Sprite;
  private halo: Img | null = null;
  private seed = Math.random() * 10;

  constructor(
    private world: WorldScene,
    readonly x: number,
    readonly y: number,
    private style: FlowerStyle,
    /** Where it blocks the way while standing. */
    readonly block: Rect,
    /** Called when it is cut down. */
    private onCut: (f: Flower) => void,
    haloTint?: number,
  ) {
    this.bodyY = style.bodyY;
    this.radius = style.radius;
    this.hp = style.hp;
    const add = world.add;
    const oy = style.originY;
    const k = style.texture;
    this.shadow = world.addShadow(sunShadow(add.sprite(x, y, `${k}_s`, style.up).setOrigin(0.5, oy)));
    this.sprite = add.sprite(x, y, k, style.up).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y);
    this.glow = add.sprite(x, y, `${k}_e`, style.up).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
    this.flash = add.sprite(x, y, `${k}_w`, style.up).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.2).setVisible(false);
    if (haloTint !== undefined) this.halo = add.image(x, y - style.bodyY, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(haloTint).setScale(1.3).setDepth(y + 0.3);
  }

  get alive(): boolean {
    return this.state === 'up';
  }

  hurt(hit: Hit): void {
    if (!this.alive) return;
    const damage = hit.damage * this.world.might;
    this.hp -= damage;
    this.flashT = FLASH_TIME;
    this.wobble = hit.heavy ? 1.4 : 1;
    this.world.popNumber(snap(this.x), snap(this.y) - this.bodyY - 16, `${Math.round(damage)}`, hit.poison ?? (hit.heavy ? 0xffe28a : 0xffffff));
    this.world.debris(this.style.petals, snap(this.x), snap(this.y) - this.bodyY, 4, this.y + 1);
    sound.thud(this.world.pan(this.x), false);
    if (this.hp <= 0) this.cut();
  }

  private cut(): void {
    this.state = 'down';
    this.timer = this.style.regrow;
    this.flashT = 0;
    this.wobble = 0;
    this.setFrame(this.style.down);
    this.world.debris(this.style.petals, snap(this.x), snap(this.y) - this.bodyY, this.style.hp > 40 ? 30 : 16, this.y + 2, 'spores');
    sound.monsterDie(this.world.pan(this.x), this.style.hp > 40 ? 2 : 1);
    this.onCut(this);
  }

  private setFrame(frame: string): void {
    for (const s of [this.sprite, this.glow, this.flash, this.shadow]) s.setFrame(frame);
  }

  /** `hero` is where the player stands, or null while they are down. */
  update(time: number, dt: number, hero: { x: number; y: number } | null, daylight: number, visible: boolean): void {
    if (this.state === 'down') {
      this.timer -= dt;
      const bud = this.style.bud;
      if (bud && this.timer < this.style.regrow * 0.35 && this.sprite.frame.name !== bud) this.setFrame(bud);
      // Grows back once the way is clear.
      const clear = !hero || Math.hypot(hero.x - this.x, (hero.y - this.y) * 1.4) > this.radius + 22;
      if (this.timer <= 0 && clear) this.regrow();
    }
    if (this.halo) this.halo.setVisible(visible && this.state === 'up').setAlpha((0.28 + Math.sin(time * 0.003 + this.seed) * 0.08) * (1.25 - daylight * 0.55));
    for (const s of [this.sprite, this.glow, this.shadow]) s.setVisible(visible);
    if (!visible) {
      this.flash.setVisible(false);
      return;
    }
    if (this.flashT > 0) this.flashT -= dt;
    this.flash.setVisible(this.flashT > 0);
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt / 450);
      const a = Math.sin(this.wobble * 22) * 7 * this.wobble;
      for (const s of [this.sprite, this.glow, this.flash]) s.setAngle(a);
    }
  }

  private regrow(): void {
    this.state = 'up';
    this.hp = this.style.hp;
    this.setFrame(this.style.up);
    for (const s of [this.sprite, this.glow, this.flash]) s.setAngle(0).setScale(1, 0.3);
    this.world.tweens.add({ targets: [this.sprite, this.glow, this.flash], scaleY: 1, duration: 520, ease: 'Back.Out' });
    this.world.debris([0xffffff, ...this.style.petals], snap(this.x), snap(this.y) - this.bodyY, 10, this.y + 2, 'gather');
  }
}

/** Pulled towards the hero from this close, and taken at this distance. */
const MAGNET = 34;
const REACH = 8;
const SEED_LIFE = 30000;
const SEED_BLINK = 5000;
const POP_TIME = 460;

/** A bloom's seed: it arcs out of the flower, hovers glowing, and gives its buff to whoever touches it. */
class Seed {
  dead = false;
  private sprite: Phaser.GameObjects.Image;
  private glowLayer: Phaser.GameObjects.Image;
  private halo: Img;
  private shadow: Img;
  private age = 0;
  private fromX: number;
  private fromY: number;
  private phase = Math.random() * 10;

  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
    fromY: number,
    readonly kind: BloomKind,
  ) {
    this.fromX = x;
    this.fromY = fromY;
    // Lands a short hop in front of the flower.
    this.x += (Math.random() - 0.5) * 18;
    this.y += 8 + Math.random() * 6;
    const oy = (SEED_H - 1) / SEED_H;
    this.shadow = scene.add.image(x, y, 'shadow').setScale(0.5, 0.7).setDepth(1).setAlpha(0.6);
    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(BLOOM_BUFF[kind].tint).setScale(0.9);
    this.sprite = scene.add.image(x, y, 'seed', kind).setOrigin(0.5, oy);
    this.glowLayer = scene.add.image(x, y, 'seed_e', kind).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Returns true once touched. */
  update(dt: number, hero: { x: number; y: number } | null): boolean {
    this.age += dt;
    let x: number;
    let y: number;
    let lift: number;
    if (this.age < POP_TIME) {
      const t = this.age / POP_TIME;
      x = this.fromX + (this.x - this.fromX) * t;
      y = this.fromY + (this.y - this.fromY) * t;
      lift = Math.sin(t * Math.PI) * 16;
    } else {
      if (hero) {
        const dx = hero.x - this.x;
        const dy = hero.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < REACH) return true;
        if (d < MAGNET) {
          const k = Math.min(1, ((dt / 1000) * (70 + (MAGNET - d) * 6)) / d);
          this.x += dx * k;
          this.y += dy * k;
        }
      }
      x = this.x;
      y = this.y;
      lift = 5 + Math.sin(this.age * 0.004 + this.phase) * 2;
    }
    const left = SEED_LIFE - this.age;
    if (left <= 0) {
      this.destroy();
      return false;
    }
    const blink = left < SEED_BLINK && Math.sin(this.age * 0.02) < -0.2 ? 0.25 : 1;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const sy = Math.round(ry - lift);
    this.sprite.setPosition(rx, sy).setDepth(ry).setAlpha(blink);
    this.glowLayer.setPosition(rx, sy).setDepth(ry + 0.1).setAlpha(blink * (0.8 + Math.sin(this.age * 0.008) * 0.2));
    this.halo.setPosition(rx, sy - 5).setDepth(ry - 0.1).setAlpha((0.5 + 0.15 * Math.sin(this.age * 0.006 + this.phase)) * blink);
    this.shadow.setPosition(rx, ry).setAlpha(0.55 * blink);
    return false;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.sprite, this.glowLayer, this.halo, this.shadow]) o.destroy();
  }
}

interface Placed {
  objs: Phaser.GameObjects.GameObject[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Garden {
  private flowers: Flower[] = [];
  private seeds: Seed[] = [];
  private placed: Placed[] = [];
  private fountain: Fountain;

  constructor(private world: WorldScene) {
    const g = gardenLayout();
    const add = world.add;
    const place = (x: number, y: number, w: number, h: number, ...objs: Phaser.GameObjects.GameObject[]) => this.placed.push({ objs, x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y + 4 });
    const lit = (key: string, frame: string, x: number, y: number, oy: number, depth = y) => {
      const img = add.image(x, y, key, frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(depth);
      const sh = world.addShadow(sunShadow(add.image(x, y, `${key}_s`, frame).setOrigin(0.5, oy)));
      return [img, sh];
    };

    for (const w of g.hwalls) place(w.x, w.y, 30, RUIN_H_H + 20, ...lit('ruin_h', `h${w.v}`, w.x, w.y, RUIN_H_BASE / RUIN_H_H));
    for (const w of g.vwalls) place(w.x, w.y, 30, RUIN_V_H + 20, ...lit('ruin_v', `v${w.v}`, w.x, w.y, RUIN_V_BASE / RUIN_V_H));
    for (const p of g.pillars) place(p.x, p.y, 44, PILLAR_H + 10, ...lit('pillar', `p${p.v}`, p.x, p.y, PILLAR_BASE / PILLAR_H));
    for (const c of g.crystals) world.crystals(c.x, c.y, c.frame);

    this.fountain = new Fountain(world, g.fountain.x, g.fountain.y);

    const thorn: FlowerStyle = {
      texture: 'thornbloom',
      up: 'bloom',
      down: 'stump',
      originY: THORNBLOOM_BASE / THORNBLOOM_H,
      hp: 90,
      bodyY: 26,
      radius: 13,
      regrow: 40000,
      petals: PETALS.thorn,
    };
    for (const t of g.thorns) this.flowers.push(new Flower(world, t.x, t.y, thorn, t.door, () => sound.thud(world.pan(t.x), true)));
    for (const b of g.blooms) {
      const style: FlowerStyle = {
        texture: 'bloom',
        up: `${b.kind}_open`,
        down: `${b.kind}_cut`,
        bud: `${b.kind}_bud`,
        originY: BLOOM_BASE / BLOOM_H,
        hp: 18,
        bodyY: 16,
        radius: 8,
        regrow: 30000,
        petals: PETALS[b.kind],
      };
      const block = { x0: b.x - 6, x1: b.x + 6, y0: b.y - 4, y1: b.y + 1 };
      this.flowers.push(new Flower(world, b.x, b.y, style, block, (fl) => this.seeds.push(new Seed(world, fl.x, fl.y, fl.y - 16, b.kind)), BLOOM_BUFF[b.kind].tint));
    }
  }

  /** Standing flowers block the way. */
  walkable(x: number, y: number): boolean {
    for (const f of this.flowers) {
      if (!f.alive) continue;
      const b = f.block;
      if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return false;
    }
    return true;
  }

  /** The flowers that can be struck right now. */
  hurtboxes(): Hurtbox[] {
    return this.flowers.filter((f) => f.alive);
  }

  /** Every flower, alive or not, without building a list (for per-frame scans). */
  get allHurtboxes(): readonly Hurtbox[] {
    return this.flowers;
  }

  update(time: number, dt: number, hero: { x: number; y: number } | null, daylight: number, view: Phaser.Geom.Rectangle): void {
    const vx0 = view.x - 24;
    const vx1 = view.right + 24;
    const vy0 = view.y - 24;
    const vy1 = view.bottom + 70;
    for (const p of this.placed) {
      const on = p.x1 > vx0 && p.x0 < vx1 && p.y1 > vy0 && p.y0 < vy1;
      for (const o of p.objs) (o as Img).setVisible(on);
    }
    this.fountain.update(time, view);
    for (const f of this.flowers) f.update(time, dt, hero, daylight, f.x + 30 > vx0 && f.x - 30 < vx1 && f.y + 4 > vy0 && f.y - THORNBLOOM_H < vy1);

    for (const s of this.seeds) {
      if (!s.update(dt, hero)) continue;
      const def = BLOOM_BUFF[s.kind];
      heroBuffs.add(def);
      sound.pickup(this.world.pan(s.x));
      this.world.buffGained(def);
      s.destroy();
    }
    this.seeds = this.seeds.filter((s) => !s.dead);
  }
}

/**
 * The fountain and what plays round it: spray thrown off the jet, a mist
 * breathing over the basin, rings spreading across the pool and specks of
 * light rising off the water. All of it is small sprites and a few dozen
 * particles, and it stops when the fountain is out of view.
 */
class Fountain {
  private glow: Phaser.GameObjects.Sprite;
  private spray: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private mists: { img: Img; base: number; seed: number }[] = [];
  private ripples: Phaser.GameObjects.Sprite[] = [];
  private nextRipple = 0;
  private shown = true;
  private fast = false;

  constructor(
    world: WorldScene,
    x: number,
    private y: number,
  ) {
    const add = world.add;
    const oy = FOUNTAIN_BASE / FOUNTAIN_H;
    const top = y - FOUNTAIN_BASE;
    add.image(x, y, 'fountain', 'f0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(y);
    this.glow = add.sprite(x, y, 'fountain_e', 'f0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play('fountain_flow');
    // The heart lights the stone round it and the water below.
    world.glowLight(x, top + FOUNTAIN_HEART_Y + 14, 170, 0x5ad8ff, 1.1, 0.5, 0x5ad8ff, 1.1);

    // Mist over the basin and round the middle bowl, breathing slowly.
    for (const [my, sx, sy, a] of [
      [y - 10, 2.6, 0.6, 0.09],
      [y - 44, 1.4, 0.5, 0.08],
      [top + FOUNTAIN_HEART_Y, 0.8, 0.8, 0.26],
    ] as const) {
      const img = add.image(x, my, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5ad8ff).setScale(sx, sy).setAlpha(a).setDepth(y + 0.2);
      this.mists.push({ img, base: a, seed: Math.random() * 10 });
    }

    // Spray thrown off the top of the jet, falling back into the bowls.
    this.spray = add
      .particles(x, top + FOUNTAIN_JET_Y, 'spark', {
        speedX: { min: -17, max: 17 },
        speedY: { min: -24, max: -6 },
        gravityY: 72,
        lifespan: { min: 650, max: 1050 },
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, (1 - t) * 2.5) * 0.9 },
        tint: [0xd6faff, 0xffffff, 0x96e2ff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 75,
      })
      .setDepth(y + 0.3);

    // Specks of light lifting off the pool.
    const zone = {
      getRandomPoint: (pt: Phaser.Types.Math.Vector2Like) => {
        const a = Math.random() * Math.PI * 2;
        const r = 0.45 + Math.random() * 0.45;
        pt.x = POOL.x + Math.cos(a) * POOL.rx * r;
        pt.y = POOL.y + Math.sin(a) * POOL.ry * r;
        return pt;
      },
    };
    this.motes = add
      .particles(0, 0, 'spark', {
        emitZone: { type: 'random', source: zone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: -3, max: 3 },
        speedY: { min: -12, max: -5 },
        lifespan: { min: 2400, max: 3800 },
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
        tint: [0x9af4ff, 0xc8fff4, 0xffb4d8],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 240,
      })
      .setDepth(POOL.y + POOL.ry + 40);

    // Rings spreading on the pool, on the water just above the ground.
    for (let i = 0; i < 5; i++) {
      const r = add.sprite(0, 0, 'ripple', 'r0').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb8f2ff).setAlpha(0.55).setDepth(2).setVisible(false);
      r.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.setVisible(false));
      this.ripples.push(r);
    }

    const offQuality = settings.watch((s) => {
      this.fast = s.quality !== 'full';
      this.spray.frequency = this.fast ? 150 : 75;
      this.motes.frequency = this.fast ? 480 : 240;
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, offQuality);
  }

  update(time: number, view: Phaser.Geom.Rectangle): void {
    const on = view.right > POOL.x - POOL.rx - 20 && view.x < POOL.x + POOL.rx + 20 && view.bottom > this.y - FOUNTAIN_BASE - 30 && view.y < POOL.y + POOL.ry + 20;
    if (on !== this.shown) {
      this.shown = on;
      this.spray.emitting = on;
      this.motes.emitting = on;
      this.glow.anims[on ? 'resume' : 'pause']();
    }
    if (!on) return;
    for (const m of this.mists) m.img.setAlpha(m.base * (0.75 + Math.sin(time * 0.0013 + m.seed) * 0.25));

    if (time < this.nextRipple) return;
    this.nextRipple = time + (this.fast ? 900 : 450) + Math.random() * 500;
    const r = this.ripples.find((s) => !s.visible);
    if (!r) return;
    // Anywhere on open water: not under the basin, not off the pool's edge.
    const a = Math.random() * Math.PI * 2;
    const k = 0.62 + Math.random() * 0.26;
    const rx = Math.round(POOL.x + Math.cos(a) * POOL.rx * k);
    const ry = Math.round(POOL.y + Math.sin(a) * POOL.ry * k);
    r.setPosition(rx, ry).setVisible(true).play('ripple_spread');
  }
}
