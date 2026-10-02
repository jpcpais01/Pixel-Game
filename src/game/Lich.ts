import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { LICH_H, LICH_ORIGIN_X, LICH_ORIGIN_Y, LICH_RELEASE, LICH_W } from '../art/lich';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { BoneSpikes, DROWNED_RIME, FrostLock, LICH_RIME, RimeBolt, type RimeLook } from './Rime';
import { pal, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { turnMidMove } from './anims';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Lich: the necromancer kit's sorcerer-king of frost and bone, on his
// own rig (art/lich.ts).
//  - The attack is the rime bolt: a shard of bone-ice flung backhand from
//    his palm. It chills the foe it strikes, and every third bolt on the
//    same foe (each within a few seconds of the last) locks it in frost for
//    a moment.
//  - The ability is bone spikes: he rears back and rakes the ground ahead,
//    and a line of jagged ice-and-bone spikes bursts up one after another
//    along the aim, striking and rooting what stands on it; they stand a
//    moment, then shatter.
//  - His Special, Eternal Winter, is in ultimate/lich.ts.

const stats = HERO_STATS['necromancer.lich'];

/** A breath after each bolt before the next. */
const CAST_REST = 120;
const BOLT_DAMAGE = 7;
/** A bolt's chill: the foe's pace, and for how long. */
const CHILL_PACE = 0.6;
const CHILL_MS = 1400;
/** Every this many bolts on one foe, each within RIME_WINDOW of the last, it freezes solid for FREEZE_MS. */
const RIME_STACKS = 3;
const RIME_WINDOW = 3000;
const FREEZE_MS = 900;
const SPIKES_COOLDOWN = 7000;

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type State = 'free' | 'cast' | 'spikes';

/** How a lich look plays: its texture key, its frost, and the colours of its Special. */
export interface LichKit {
  key: string;
  rime: RimeLook;
  /** Eternal Winter's colours. */
  winter: Pal;
}

export const LICH_KIT: LichKit = {
  key: 'necro_lich',
  rime: LICH_RIME,
  winter: pal(0xf4fdff, 0xb8ecff, 0x5ab8f0, 0x1c3e98, 0x8ad8ff),
};

/** The Drowned King: brine and coral, a storm of sea spray. */
export const DROWNED_KIT: LichKit = {
  key: 'necro_drowned',
  rime: DROWNED_RIME,
  winter: pal(0xf0fffa, 0xa4ffe8, 0x2ad8b4, 0x0c5a66, 0x40f0c8),
};

export class Lich implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals = new Vitals(stats.hp);
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: LichKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  /** The phylactery's cold light round him. */
  private soulLight: Phaser.GameObjects.Light;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private line: Aim = { x: 0, y: 1 };
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  private clock = 0;
  /** Rime on each foe: bolts that have struck it, and when the last did. */
  private rime = new Map<Hurtbox, { n: number; at: number }>();

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: LichKit = LICH_KIT) {
    this.world = world;
    this.kit = kit;
    this.x = x;
    this.y = y;
    const k = kit.key;
    const ox = LICH_ORIGIN_X / LICH_W;
    const oy = LICH_ORIGIN_Y / LICH_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.soulLight = world.lights.addLight(x, y, 44, kit.rime.ice.light, 0);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if ((this.state === 'cast' && anim.key.startsWith(`${k}_cast_`)) || (this.state === 'spikes' && anim.key.startsWith(`${k}_spikes_`))) {
        this.state = 'free';
        this.cooldown = CAST_REST;
        this.body.play(`${k}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      world.lights.removeLight(this.soulLight);
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.start('spikes');
      else if (attack) this.start('cast');
    }

    const speed = { free: stats.speed * Math.min(1, len), cast: stats.speed * 0.5, spikes: stats.speed * 0.12 }[this.state];
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      if (!this.released) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.released && f && f.index - 1 >= LICH_RELEASE[this.state]) {
        this.released = true;
        if (this.state === 'spikes') this.spikes();
        else this.bolt();
      }
    }

    this.sync();
    this.updateHud();
  }

  private start(kind: 'cast' | 'spikes'): void {
    this.state = kind;
    this.released = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${kind}_${this.dir}`);
    if (kind === 'spikes') {
      this.specialCd = SPIKES_COOLDOWN;
      sound.frost('chime', this.world.pan(this.x));
    }
  }

  /** Which way: at the mouse on a computer, else the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    this.line = { x: a.x / l, y: a.y / l };
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      if (this.state !== 'free') turnMidMove(this.body, `${this.kit.key}_${this.state}_${dir}`);
    }
  }

  /** The bolt leaves his palm and flies over the whole world. */
  private bolt(): void {
    const u = this.line;
    const look = this.kit.rime;
    sound.soulCast(this.world.pan(this.x));
    sound.frost('chime', this.world.pan(this.x));
    this.world.addEffect(
      new RimeBolt(this.world, this.x + u.x * 6, this.y + u.y * 3, u.x, u.y, look, (h, ux, uy) => {
        h.hurt({ damage: BOLT_DAMAGE, heavy: false, knock: 40, fromX: h.x - ux * 8, fromY: h.y - h.bodyY - uy * 8 });
        this.chill(h);
      }),
    );
  }

  /** A bolt's rime on a foe: it slows; the third in a row locks it in frost. */
  private chill(h: Hurtbox): void {
    const now = this.clock;
    const r = this.rime.get(h);
    const n = r && now - r.at <= RIME_WINDOW ? r.n + 1 : 1;
    const tint = this.kit.rime.ice.hot;
    if (n >= RIME_STACKS && h.alive) {
      this.rime.delete(h);
      h.slow?.(0, FREEZE_MS, tint);
      this.world.addEffect(new FrostLock(this.world, h, FREEZE_MS, this.kit.rime));
    } else {
      this.rime.set(h, { n, at: now });
      h.slow?.(CHILL_PACE, CHILL_MS, tint);
    }
    // Forget foes long gone.
    if (this.rime.size > 24) for (const [k, v] of this.rime) if (!k.alive || now - v.at > RIME_WINDOW) this.rime.delete(k);
  }

  /** The spikes burst out along the aim, starting a little ahead of his feet. */
  private spikes(): void {
    const u = this.line;
    this.world.addEffect(new BoneSpikes(this.world, this.x, this.y, u.x, u.y, this.kit.rime, () => {}));
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / SPIKES_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'spikes';
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
    // The phylactery's light, faint by day, a cold glow round him by night.
    this.soulLight.setPosition(rx + (this.dir === 'left' ? -6 : 6), ry - 30);
    this.soulLight.intensity = (0.3 + 0.7 * (1 - this.daylight)) * this.alpha;
  }
}
