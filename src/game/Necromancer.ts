import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { NECRO_H, NECRO_ORIGIN_X, NECRO_ORIGIN_Y, NECRO_W, RELEASE_FRAME } from '../art/necromancer';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { SmiteBurst } from './Holy';
import { BLOOD_FX, Risen, SOUL_FX, SoulBolt, type BoltKind, type RisenStats } from './Souls';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

/** The raised dead come up at the mouse, within these; ahead the way he last walked on touch. */
const MIN_RANGE = 16;
const MAX_RANGE = 70;
const TOUCH_RANGE = 30;
/** Where the three risen stand around the spot they were raised on. */
const GRAVES = [
  { x: 0, y: -9 },
  { x: -11, y: 6 },
  { x: 11, y: 6 },
];
/** Where they keep to around him when there's nothing to fight. */
const SLOTS = [
  { x: 0, y: 16 },
  { x: -18, y: 6 },
  { x: 18, y: 6 },
];

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'cast' | 'raise';

/** How a necromancer style plays: its look, its body, its bolts and its special. */
export interface NecroKit {
  key: string;
  maxHp: number;
  speed: number;
  /** A breath after each bolt before the next. */
  castRest: number;
  bolt: BoltKind;
  /** Health each foe struck by a bolt gives back. */
  boltHeal: number;
  specialCooldown: number;
  special: { kind: 'raise'; risen: RisenStats } | { kind: 'nova'; radius: number; damage: number; cost: number; healPerFoe: number };
}

/** Soul bolts that curve into foes; three skeletons raised to fight for 12 s. */
export const NECRO_KIT: NecroKit = {
  key: 'necro',
  maxHp: 80,
  speed: 60,
  castRest: 110,
  bolt: { suffix: '_soul', fx: SOUL_FX, speed: 150, range: 165, damage: 7, seek: 5, pierce: 0, blood: false },
  boltHeal: 0,
  specialCooldown: 14000,
  special: { kind: 'raise', risen: { life: 12000, damage: 5, speed: 46, rest: 650, leash: 130 } },
};

/**
 * The blood mage: tougher, with short, fast lances that tear through three
 * foes and heal him a little for each; the special spends his own blood on a
 * nova that drains every foe it catches.
 */
export const BLOOD_KIT: NecroKit = {
  key: 'necro_blood',
  maxHp: 100,
  speed: 62,
  castRest: 80,
  bolt: { suffix: '_blood', fx: BLOOD_FX, speed: 240, range: 115, damage: 6, seek: 0, pierce: 2, blood: true },
  boltHeal: 1,
  specialCooldown: 8000,
  special: { kind: 'nova', radius: 44, damage: 16, cost: 10, healPerFoe: 4 },
};

/**
 * The necromancer: casts on the attack button, a bolt from his open palm (at
 * the mouse on a computer); on the special he lifts his staff and drives it
 * into the ground, and the dead answer (or, as the blood mage, a nova of his
 * own blood bursts out around him).
 */
export class Necromancer implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private line: Aim = { x: 0, y: 1 };
  private range = TOUCH_RANGE;
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  private risen: Risen[] = [];
  private kit: NecroKit;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: NecroKit = NECRO_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    const k = kit.key;
    this.x = x;
    this.y = y;
    const ox = NECRO_ORIGIN_X / NECRO_W;
    const oy = NECRO_ORIGIN_Y / NECRO_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'cast' && anim.key.startsWith(`${k}_cast_`)) || (this.state === 'raise' && anim.key.startsWith(`${k}_raise_`))) {
        this.state = 'free';
        this.cooldown = this.kit.castRest;
        this.body.play(`${k}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    if (this.risen.length) this.risen = this.risen.filter((r) => r.standing);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.start('raise');
      else if (attack) this.start('cast');
    }

    const speed = { free: this.kit.speed * Math.min(1, len), cast: this.kit.speed * 0.55, raise: this.kit.speed * 0.15 }[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      // Until the spell leaves him, the aim follows the mouse.
      if (!this.released) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.released && f && f.index - 1 >= RELEASE_FRAME[this.state]) {
        this.released = true;
        if (this.state === 'raise') this.releaseSpecial();
        else this.bolt();
      }
    }

    this.sync();
    this.updateHud();
  }

  private start(kind: 'cast' | 'raise'): void {
    this.state = kind;
    this.released = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${kind}_${this.dir}`);
  }

  /** Which way, and how far: at the mouse on a computer, else ahead the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    this.range = this.aim?.dist !== undefined ? Phaser.Math.Clamp(this.aim.dist, MIN_RANGE, MAX_RANGE) : TOUCH_RANGE;
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      const frame = this.body.anims.currentFrame;
      if (frame && this.state !== 'free') this.body.play({ key: `${this.kit.key}_${this.state}_${dir}`, startFrame: frame.index - 1 });
    }
  }

  /** The bolt leaves his palm, flying over the whole world, not just the room his step is clamped to. */
  private bolt(): void {
    const u = this.line;
    const kind = this.kit.bolt;
    sound.soulCast(this.world.pan(this.x), kind.blood);
    this.world.addEffect(
      new SoulBolt(this.world, this.x + u.x * 6, this.y + u.y * 3, u.x, u.y, kind, (h, ux, uy) => {
        h.hurt({ damage: kind.damage, heavy: false, knock: kind.blood ? 45 : 60, fromX: h.x - ux * 8, fromY: h.y - h.bodyY - uy * 8 });
        if (this.kit.boltHeal > 0 && this.vitals.hp < this.vitals.max) {
          this.vitals.heal(this.kit.boltHeal);
          this.world.debris([0xff8a96, 0xe8243c], snap(this.x), snap(this.y) - 14, 2, this.y + 20, 'spores');
        }
      }),
    );
  }

  private releaseSpecial(): void {
    this.specialCd = this.kit.specialCooldown;
    const sp = this.kit.special;
    if (sp.kind === 'raise') this.raiseDead(sp.risen);
    else this.nova(sp.radius, sp.damage, sp.cost, sp.healPerFoe);
  }

  /** Three skeletons claw their way up where he aimed, each in a pillar of soul fire. */
  private raiseDead(stats: RisenStats): void {
    for (const r of this.risen) r.crumble();
    this.risen = [];
    const u = this.line;
    const area = this.world.area;
    const cx = this.x + u.x * this.range;
    const cy = this.y + u.y * this.range;
    sound.raiseDead(this.world.pan(cx));
    this.world.cameras.main.shake(90, 0.0003);
    GRAVES.forEach((g, i) => {
      let x = Phaser.Math.Clamp(cx + g.x, area.left + 4, area.right - 4);
      let y = Phaser.Math.Clamp(cy + g.y, area.top + 4, area.bottom - 4);
      // Nothing rises out of a wall or a tree: fall back to his own feet.
      if (!this.world.walkable(x, y)) {
        x = this.x + g.x * 0.6;
        y = this.y + g.y * 0.6 + 6;
      }
      this.world.addEffect(new SmiteBurst(this.world, x, y, false, SOUL_FX));
      this.world.debris([0x8a6646, 0x6a4a34, 0x9dffd4], snap(x), snap(y) - 2, 8, y + 1);
      const r = new Risen(this.world, x, y, this, SLOTS[i], stats);
      this.risen.push(r);
      this.world.addEffect(r);
    });
  }

  /** He pays in his own blood; it bursts out around him and drains every foe it catches. */
  private nova(radius: number, damage: number, cost: number, healPerFoe: number): void {
    const x = this.x;
    const y = this.y;
    const paid = Math.min(cost, this.vitals.hp - 1);
    if (paid > 0) {
      this.vitals.hp -= paid;
      this.world.popNumber(snap(x), snap(y) - 34, `-${paid}`, 0xff4a5a);
    }
    this.world.addEffect(new SmiteBurst(this.world, x, y, true, BLOOD_FX, radius));
    this.world.debris([0xfff0f0, 0xff8a96, 0xe8243c, 0x7a0a1e], snap(x), snap(y) - 10, 22, y + 20);
    sound.bloodNova(this.world.pan(x));
    this.world.cameras.main.shake(120, 0.0006);
    const hits = this.world.melee({ kind: 'circle', x, y: y - 6, radius }, { damage, heavy: true, knock: 110, fromX: x, fromY: y - 6 });
    if (hits.length) {
      const got = this.vitals.heal(hits.length * healPerFoe);
      if (got > 0) this.world.popNumber(snap(x), snap(y) - 40, `+${got}`, 0x7dff8a);
      for (const h of hits) this.world.debris([0xff8a96, 0xe8243c], snap(h.x), snap(h.y), 4, h.y + 20, 'spores');
    }
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'raise';
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
  }
}
