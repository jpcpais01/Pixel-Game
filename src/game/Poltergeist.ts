import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { POLTER_CHEST_Y, POLTER_H, POLTER_ORIGIN_X, POLTER_ORIGIN_Y, POLTER_W, type HauntKind } from '../art/poltergeist';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Phase, PHASE_SPEED } from './phase';
import { bloom, clamp01, easeOut, Fx, GROUND, pal, ring, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Poltergeist (the Phantom's first type): a mischievous sheet-ghost.
//  - Attack (held): it hurls haunted household things with its mind, a
//    chair, a book, a candlestick, a pot, at a foe the way it aims; they
//    tumble through the air and shatter. Every fourth is a big one (a trunk)
//    that bursts over everything near.
//  - Ability: Rattle. Everything round it jumps: haunted things burst up out
//    of the ground, flinging the foes near it into the air.
//  - Special: Haunted House (see ultimate/phantom.ts).
// Like every Phantom it phases through the next blow (see phase.ts).
// The Tea Party throws the tea set (the teapot is the big one); the Banshee
// a mourner's keepsakes (a comb, a mirror, an urn, a bell; a coffin for the
// big one), and her rattle goes out as a keening shriek in rings. Both play
// the same.

const THROW_EVERY = 400;
const THROW_RANGE = 160;
const THROW_SPEED = 240;
const THROW_DAMAGE = 10;
const BIG_EVERY = 4;
const BIG_DAMAGE = 18;
const BIG_SPLASH = 18;
const BIG_SPLASH_DAMAGE = 9;
const AIM_CONE = Math.cos((60 * Math.PI) / 180);

const RATTLE_R = 40;
const RATTLE_DAMAGE = 10;
const RATTLE_UP_MS = 700;
const RATTLE_LIFT = 14;
const RATTLE_COOLDOWN = 5200;
/** The Banshee's keen: rings of shriek spreading out past the rattle's reach, one after another. */
const KEEN_MS = 560;
const KEEN_RINGS = 3;
const KEEN_GAP = 90;

type State = 'free' | 'throw' | 'rattle';

export interface PolterKit {
  key: string;
  tea: boolean;
  maxHp: number;
  speed: number;
  /** What it throws, in turn, and the big one. */
  things: HauntKind[];
  big: HauntKind;
  pal: Pal;
  /** The colours a thrown thing breaks into (wood by default). */
  bits?: number[];
  /** The rattle goes out as a keening shriek in rings (the Banshee). */
  keen?: boolean;
}

export const POLTER_KIT: PolterKit = {
  key: 'polter',
  tea: false,
  maxHp: HERO_STATS['phantom.poltergeist'].hp,
  speed: HERO_STATS['phantom.poltergeist'].speed,
  things: ['chair', 'book', 'candle', 'pot'],
  big: 'trunk',
  pal: pal(0xeefff8, 0x9ff0d4, 0x4ac8a0, 0x1a6a5a, 0x8af0c8),
};

export const TEA_KIT: PolterKit = {
  ...POLTER_KIT,
  key: 'polter_tea',
  tea: true,
  things: ['cup', 'saucer', 'jug', 'cup'],
  big: 'teapot',
  pal: pal(0xfff4ff, 0xe0c8ff, 0xa888e0, 0x4a3a7a, 0xd0b0ff),
  bits: [0xffffff, 0xf0f4ff, 0x3a5ad0],
};

/** The Banshee: a mourner's keepsakes glowing sickly green-silver, and a keen for a rattle. */
export const BANSHEE_KIT: PolterKit = {
  ...POLTER_KIT,
  key: 'polter_banshee',
  things: ['comb', 'mirror', 'urn', 'bell'],
  big: 'coffin',
  pal: pal(0xf6fff4, 0xd4f4c4, 0x8cc49a, 0x24443a, 0xc0f0b8),
  bits: [0xdce8e4, 0x8a989c, 0x58a07e],
  keen: true,
};

export class Poltergeist implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: PolterKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private phase: Phase;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private throwT = 0;
  private thrown = 0;
  private rattleCd = 0;
  private prevSpecial = false;
  /** Two little haunted things always drifting round it. */
  private orbit: Phaser.GameObjects.Image[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: PolterKit = POLTER_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = POLTER_ORIGIN_X / POLTER_W;
    const oy = POLTER_ORIGIN_Y / POLTER_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.8, 0.7);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 60, kit.pal.light, 0);
    this.phase = new Phase(world, this, kit.pal.hot);
    for (let i = 0; i < 2; i++) this.orbit.push(world.add.image(x, y, 'haunt', kit.things[i + 1]).setPipeline('Lit').setScale(0.75));
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'throw' && anim.key.startsWith(`${key}_throw_`)) || (this.state === 'rattle' && anim.key.startsWith(`${key}_rattle_`))) this.state = 'free';
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.phase.destroy();
      for (const o of this.orbit) o.destroy();
    });
  }

  dodge(): boolean {
    return this.phase.dodge();
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.throwT = Math.max(0, this.throwT - dt);
    this.rattleCd = Math.max(0, this.rattleCd - dt);
    this.phase.update(dt);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.state !== 'rattle') {
      if (pressed && this.rattleCd === 0) this.rattle();
      else if (attack && this.throwT === 0) this.hurl();
    }

    const k = this.state === 'rattle' ? 0.25 : this.state === 'throw' ? 0.7 : 1;
    const speed = this.kit.speed * k * (this.phase.active ? PHASE_SPEED : 1) * Math.min(1, len);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (this.state === 'free') {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_move_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------

  /** Fling the next haunted thing at the best foe the way it aims (or just that way). */
  private hurl(): void {
    const u = this.aimVec();
    this.throwT = THROW_EVERY;
    this.state = 'throw';
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_throw_${this.dir}`, true);
    this.thrown++;
    const big = this.thrown % BIG_EVERY === 0;
    const kind = big ? this.kit.big : this.kit.things[this.thrown % this.kit.things.length];
    const foe = this.pick(u);
    const side = this.dir === 'left' ? -1 : 1;
    const x = this.x + side * 7;
    const y = this.y - POLTER_CHEST_Y - 4;
    const goal = foe ?? { x: this.x + u.x * THROW_RANGE, y: this.y + u.y * THROW_RANGE, bodyY: POLTER_CHEST_Y };
    this.world.time.delayedCall(90, () => this.world.addEffect(new HauntedThing(this.world, x, y, goal, kind, big, this.kit)));
    sound.toss(this.world.pan(x), big);
  }

  private pick(u: { x: number; y: number }): Hurtbox | null {
    const cx = this.x;
    const cy = this.y - POLTER_CHEST_Y;
    let best: Hurtbox | null = null;
    let bestD = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - cx;
      const dy = h.y - h.bodyY - cy;
      const d = Math.hypot(dx, dy);
      if (d > THROW_RANGE || d === 0 || (dx * u.x + dy * u.y) / d < AIM_CONE) continue;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** Everything round it jumps: haunted things burst out of the ground and fling foes up. */
  private rattle(): void {
    const w = this.world;
    this.state = 'rattle';
    this.rattleCd = RATTLE_COOLDOWN;
    this.dir = dirOf(this.aimVec().x, this.aimVec().y);
    this.body.play(`${this.kit.key}_rattle_${this.dir}`, true);
    const x = this.x;
    const y = this.y;
    for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, b.y - y) <= RATTLE_R + b.radius)) {
      h.hurt({ damage: RATTLE_DAMAGE, heavy: true, knock: 60, fromX: x, fromY: y });
      (h as Hurtbox & { bind?(ms: number, lift: number): boolean }).bind?.(RATTLE_UP_MS, RATTLE_LIFT);
      w.debris(this.kit.pal.tints, h.x, h.y - h.bodyY, 5, h.y + 10, 'burst');
    }
    // Things erupting from the ground in a ring.
    const all = [...this.kit.things, this.kit.big];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      const r = 12 + Math.random() * (RATTLE_R - 12);
      const gx = x + Math.cos(a) * r;
      const gy = y + Math.sin(a) * r * 0.6;
      const img = w.add.image(snap(gx), snap(gy), 'haunt', all[i % all.length]).setOrigin(0.5, 1).setPipeline('Lit').setDepth(gy).setAlpha(0).setRotation((Math.random() - 0.5) * 0.6);
      w.tweens.chain({
        targets: img,
        tweens: [
          { y: gy - 16 - Math.random() * 10, alpha: 1, rotation: (Math.random() - 0.5) * 3, duration: 220, delay: i * 25, ease: 'Quad.easeOut' },
          { y: gy, rotation: (Math.random() - 0.5) * 6, duration: 260, ease: 'Quad.easeIn' },
        ],
        onComplete: () => {
          w.debris([0xffffff, ...this.kit.pal.tints.slice(1, 3)], gx, gy - 4, 5, gy + 2, 'burst');
          img.destroy();
        },
      });
    }
    w.debris([0xb8a888, 0x8a7a60], snap(x), snap(y), 16, y + 2, 'burst');
    bloom(w, x, y - 6, this.kit.pal.mid, 2.2, 360, y + 20);
    if (this.kit.keen) {
      w.addEffect(new Keen(w, x, y, this.kit.pal));
      sound.wail(w.pan(x));
    }
    w.cameras.main.shake(140, 0.0008);
    sound.creak(w.pan(x));
    sound.slam(w.pan(x));
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.rattleCd / RATTLE_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'rattle';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    const a = this.alpha * this.phase.opacity;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(a);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    // It floats: a soft shadow, a little off the ground.
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha * 0.55);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * a * 0.6);
    this.aura.setPosition(rx, ry - 18);
    this.aura.intensity = 0.7 * (1 - this.daylight) + 0.2;
    this.orbit.forEach((o, i) => {
      const q = this.clock * 0.0017 + i * Math.PI;
      const ox = Math.cos(q) * 12;
      const oy = Math.sin(q) * 6;
      o.setPosition(snap(this.x + ox), snap(this.y - 16 + oy + Math.sin(this.clock * 0.004 + i) * 2))
        .setDepth(this.y + (oy > 0 ? 0.2 : -0.2))
        .setRotation(Math.sin(this.clock * 0.002 + i) * 0.4)
        .setAlpha(a * 0.9);
    });
  }
}

/**
 * A haunted thing in flight: it lifts, then tumbles through the air at its
 * mark (bending after it a little), and shatters on the first body it meets,
 * or on the ground at the end of its flight. The big one bursts over
 * everything round where it breaks.
 */
class HauntedThing extends Fx {
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private vx = 0;
  private vy = 0;
  private travelled = 0;
  private spin: number;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private goal: { x: number; y: number; bodyY: number; alive?: boolean },
    kind: HauntKind,
    private big: boolean,
    private kit: PolterKit,
  ) {
    super(world, 3000);
    this.img = this.own(world.add.image(snap(x), snap(y), 'haunt', kind).setPipeline('Lit').setScale(big ? 1.3 : 1));
    this.glow = this.own(world.add.image(snap(x), snap(y), 'haunt_e', kind).setBlendMode(Phaser.BlendModes.ADD).setScale(big ? 1.3 : 1));
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (big ? 7 : 11);
    const dx = goal.x - x;
    const dy = goal.y - goal.bodyY - y;
    const l = Math.hypot(dx, dy) || 1;
    this.vx = (dx / l) * THROW_SPEED;
    this.vy = (dy / l) * THROW_SPEED;
    world.debris([0xffffff, kit.pal.hot], x, y, 4, y + 20, 'spores');
  }

  protected step(dt: number): void {
    const w = this.world;
    const s = dt / 1000;
    // Bend after a live mark.
    if (this.goal.alive !== undefined && this.goal.alive) {
      const dx = this.goal.x - this.x;
      const dy = this.goal.y - this.goal.bodyY - this.y;
      const l = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-dt / 160);
      this.vx += ((dx / l) * THROW_SPEED - this.vx) * k;
      this.vy += ((dy / l) * THROW_SPEED - this.vy) * k;
    }
    const steps = Math.ceil((THROW_SPEED * s) / 4);
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * s) / steps;
      this.y += (this.vy * s) / steps;
      this.travelled += (THROW_SPEED * s) / steps;
      if (w.strikeAt(this.x, this.y, { damage: this.big ? BIG_DAMAGE : THROW_DAMAGE, heavy: this.big, knock: this.big ? 120 : 70, fromX: this.x - this.vx * 0.03, fromY: this.y - this.vy * 0.03 })) {
        this.shatter();
        return;
      }
    }
    if (this.travelled >= THROW_RANGE + 10) {
      this.shatter();
      return;
    }
    const depth = this.y + POLTER_CHEST_Y + 2;
    const r = this.t * 0.001 * this.spin;
    this.img.setPosition(snap(this.x), snap(this.y)).setRotation(r).setDepth(depth);
    this.glow.setPosition(snap(this.x), snap(this.y)).setRotation(r).setDepth(depth + 0.1);
    if (Math.floor(this.t / 45) !== Math.floor((this.t - dt) / 45)) w.debris([this.kit.pal.hot, this.kit.pal.mid], this.x, this.y, 1, depth, 'trail');
  }

  private shatter(): void {
    const w = this.world;
    const bits = this.kit.bits ?? [0xb88448, 0x8a5a2e, 0xe0d4b0];
    w.debris([...bits, this.kit.pal.hot], this.x, this.y, this.big ? 22 : 10, this.y + POLTER_CHEST_Y + 4, 'burst');
    if (this.big) {
      for (const h of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - this.x, b.y - b.bodyY - this.y) <= BIG_SPLASH + b.radius)) {
        h.hurt({ damage: BIG_SPLASH_DAMAGE, heavy: false, knock: 60, fromX: this.x, fromY: this.y });
      }
      bloom(w, this.x, this.y, this.kit.pal.hot, 1.6, 260, this.y + 40);
      w.cameras.main.shake(80, 0.0005);
    }
    sound.shatter(w.pan(this.x), this.big);
    this.destroy();
  }
}

/**
 * The Banshee's keen: rings of shriek going out from her one after another,
 * ragged (broken into arcs that shift as they spread) and fading, read at
 * chest height so they look like sound and not a mark on the ground.
 */
class Keen extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, KEEN_MS + KEEN_GAP * (KEEN_RINGS - 1));
    const R = RATTLE_R + 24;
    this.g = this.ink(R * 2 + 8, Math.ceil(R * 2 * GROUND) + 8);
  }

  protected step(): void {
    const g = this.g.begin(this.x, this.y - POLTER_CHEST_Y + 4, this.y + 30);
    for (let i = 0; i < KEEN_RINGS; i++) {
      const k = clamp01((this.t - i * KEEN_GAP) / KEEN_MS);
      if (k <= 0 || k >= 1) continue;
      const r = 6 + (RATTLE_R + 18) * easeOut(k);
      ring(g, this.x, this.y - POLTER_CHEST_Y + 4, r, 1.4 - k * 0.6, this.p, (1 - k) * 0.9, GROUND, 0.3, i * 7 + Math.floor(this.t / 60));
    }
    g.end();
  }
}
