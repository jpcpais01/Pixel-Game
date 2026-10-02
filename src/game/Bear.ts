import Phaser from 'phaser';
import { BEAR_TIMING } from '../art/bear';
import { snap } from './display';
import { sound } from '../audio';
import { HitSpark, Shockwave } from './Slash';
import { pal } from './ultimate/ink';
import { Beast, ClawMarks, type BeastKit } from './Beast';
import { Dazed, EARTH, EarthCracks, RageWave, SwipeArc, WrathAura } from './BearFx';
import { heroBuffs, type BuffDef } from './buffs';
import type { WorldScene } from '../scenes/WorldScene';
import type { Aim } from './characters';
import { HERO_STATS } from './stats';

// The Bear (the Nature class's tank, its own kit on the Beastkin's body; art
// in art/bear.ts): a huge grizzly, slow and very hard to put down.
//  - Attack (held): Maul. Two heavy swipes, each a wide arc in front of him,
//    then both paws raised overhead and brought crashing down, cracking the
//    ground and throwing foes back. Slower than the Lion's claws, wider.
//  - Ability: Earthsplitter. He rears up on his hind legs and slams down: the
//    earth cracks in a ring round him, striking every foe in it and stunning
//    them for a moment.
//  - Special: Ursine Wrath (see ultimate/bear.ts). For a while he grows
//    bigger, his eyes and claws blaze, he takes far less harm, and every
//    Maul blow sends a short shockwave rolling on ahead of it.

const CHAIN = ['swipe', 'swipe2', 'smash'] as const;
type Blow = (typeof CHAIN)[number];
const SWIPE = BEAR_TIMING.swipe;
const SMASH = BEAR_TIMING.smash;
const BLOW_MS: Record<Blow, number> = { swipe: SWIPE.ms, swipe2: SWIPE.ms, smash: SMASH.ms };
const BLOW_LAND: Record<Blow, number> = { swipe: SWIPE.land, swipe2: SWIPE.land, smash: SMASH.land };
const SWIPE_DAMAGE = 11;
const SMASH_DAMAGE = 20;
/** The swipes reach far and wide: a big arc in front of him. */
const SWIPE_REACH = 24;
const SWIPE_SPREAD = (130 * Math.PI) / 180;
const SWIPE_KNOCK = 90;
/** The smash lands this far ahead, over this radius, and throws foes back hard. */
const SMASH_AHEAD = 13;
const SMASH_R = 18;
const SMASH_KNOCK = 220;
const COMBO_WINDOW = 560;

const QUAKE_MS = BEAR_TIMING.quake.ms;
const QUAKE_LAND = BEAR_TIMING.quake.land;
const QUAKE_COOLDOWN = 7000;
const QUAKE_R = 50;
const QUAKE_DAMAGE = 16;
const QUAKE_KNOCK = 90;
/** Foes caught in the quake stand stunned this long. */
const STUN_MS = 1100;

/** Ursine Wrath: how long, how much bigger, how much of each blow still gets through. */
export const WRATH_MS = 6000;
const WRATH_SIZE = 1.22;
const WRATH_GUARD = 0.45;
/** Grown and shrunk over this long. */
const GROW_MS = 260;
/** Each raging maul blow's shockwave: how far it rolls, and what it deals (the swipes', the smash's). */
const WAVE_REACH = 58;
const WAVE_SWIPE = 8;
const WAVE_SMASH = 14;

const bearStats = HERO_STATS['bear.bear'];

export interface BearKit extends BeastKit {
  /** The panda: bamboo leaves fly with his quakes. */
  leaves: boolean;
  /** The wrath, as a buff on the HUD: it carries the guard. */
  wrath: BuffDef;
}

const wrathBuff = (look: string, tint: number): BuffDef => ({
  id: 'ursine_wrath',
  name: 'Ursine Wrath',
  icon: `ult_icon_bear_${look}`,
  tint,
  duration: WRATH_MS,
  mods: { guard: WRATH_GUARD },
});

const GRIZZLY_PAL = pal(0xfff2dc, 0xffc070, 0xf07a2a, 0x8e2a12, 0xff9a40);

export const BEAR_KIT: BearKit = {
  key: 'bear',
  kind: 'bear',
  maxHp: bearStats?.hp ?? 130,
  speed: bearStats?.speed ?? 52,
  pal: GRIZZLY_PAL,
  fx: { core: 0xfff2dc, hot: 0xffc070, mid: 0xf07a2a, deep: 0x8e2a12, light: 0xff9a40 },
  club: false,
  leaves: false,
  wrath: wrathBuff('bear', 0xf07a2a),
};

const PANDA_PAL = pal(0xf0fff6, 0xb0ffd8, 0x3ad89a, 0x0e7a58, 0x6af0b8);

/** The Panda: black and white, jade in his eyes and his quakes, bamboo leaves flying. */
export const PANDA_KIT: BearKit = {
  ...BEAR_KIT,
  key: 'bear_panda',
  pal: PANDA_PAL,
  fx: { core: 0xf0fff6, hot: 0xb0ffd8, mid: 0x3ad89a, deep: 0x0e7a58, light: 0x6af0b8 },
  leaves: true,
  wrath: wrathBuff('panda', 0x3ad89a),
};

export class Bear extends Beast {
  private step = 0;
  private lastBlowAt = -99999;
  private quakeCd = 0;
  /** The wrath's time left, and his drawn size easing toward where it should be. */
  private wrathT = 0;
  private grown = 1;
  private aura: WrathAura | null = null;
  /** His wrath's second glow layer, over the first, so his eyes and claws blaze. */
  private blaze: Phaser.GameObjects.Sprite;
  private readonly bk: BearKit;

  constructor(world: WorldScene, x: number, y: number, kit: BearKit = BEAR_KIT) {
    super(world, x, y, kit);
    this.bk = kit;
    this.blaze = world.add.sprite(x, y, `${kit.key}_e`, 'idle_down_0').setOrigin(this.body.originX, this.body.originY).setBlendMode(Phaser.BlendModes.ADD).setTint(kit.pal.hot).setVisible(false);
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.blaze.destroy());
  }

  /** Ursine Wrath: grow, blaze, shrug off blows, and send a shockwave with every maul blow. */
  enrage(): void {
    this.wrathT = WRATH_MS;
    heroBuffs.add(this.bk.wrath);
    this.aura?.destroy();
    this.aura = new WrathAura(this.world, this.auraAt, WRATH_MS, this.kit.pal);
    this.fx.push(this.aura);
  }

  /** Where the aura stands: his feet, and how big he is. */
  private auraAt = { x: 0, y: 0, size: 1 };

  get raging(): boolean {
    return this.wrathT > 0;
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    super.update(dt, mx, my, attack, special, bounds, aim);
    // The blaze layer follows the body's frame.
    const b = this.body;
    const on = this.grown > 1.01 && this.alpha > 0;
    this.blaze.setVisible(on);
    if (on) {
      const pulse = 0.75 + 0.25 * Math.sin(this.clock * 0.012);
      this.blaze
        .setTexture(`${this.kit.key}_e`, b.frame.name)
        .setPosition(b.x, b.y)
        .setDepth(b.depth + 0.15)
        .setScale(b.scaleX, b.scaleY)
        .setAlpha(this.alpha * pulse * Math.min(1, (this.grown - 1) / (WRATH_SIZE - 1)));
    }
    this.auraAt.x = this.x;
    this.auraAt.y = this.y;
    this.auraAt.size = this.grown;
  }

  protected tick(dt: number): void {
    this.quakeCd = Math.max(0, this.quakeCd - dt);
    if (!this.vitals.alive && this.wrathT > 0) {
      this.wrathT = 0;
      this.aura?.destroy();
    }
    this.wrathT = Math.max(0, this.wrathT - dt);
    const want = this.wrathT > 0 ? WRATH_SIZE : 1;
    const stepK = ((WRATH_SIZE - 1) * dt) / GROW_MS;
    this.grown = want > this.grown ? Math.min(want, this.grown + stepK) : Math.max(want, this.grown - stepK);
    this.size = this.grown;
    if (this.wrathT <= 0) this.aura = null;
  }

  protected glowLevel(): number {
    // His eyes shine a little in the dark; in wrath they blaze.
    return this.raging ? 1 : 0.55;
  }

  protected lampLevel(): number {
    return this.move === 'quake' ? 0.7 : this.raging ? 0.5 : 0;
  }

  protected attack(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastBlowAt <= COMBO_WINDOW + BLOW_MS.swipe;
    this.step = chain ? this.step + 1 : 1;
    this.lastBlowAt = this.clock;
    const b = CHAIN[this.step - 1];
    this.begin(b, b, BLOW_MS[b], BLOW_LAND[b]);
    sound.swing(this.step, this.world.pan(this.x));
  }

  protected ability(): void {
    if (this.quakeCd > 0) return;
    this.quakeCd = QUAKE_COOLDOWN;
    this.step = 0;
    this.begin('quake', 'quake', QUAKE_MS, QUAKE_LAND);
    sound.bearGrowl(this.world.pan(this.x), false);
  }

  protected paceIn(move: string): number {
    return move === 'quake' || move === 'smash' ? 0 : 0.4;
  }

  protected readiness(): number {
    return 1 - this.quakeCd / QUAKE_COOLDOWN;
  }

  protected combo(): { hits: number; max: number; window: number } {
    const since = this.clock - this.lastBlowAt;
    return { hits: this.step, max: 3, window: this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / (COMBO_WINDOW + BLOW_MS.swipe)) : Math.max(0, 1 - since / 800) };
  }

  protected land(move: string): void {
    if (move === 'quake') this.quake();
    else this.strike(move as Blow);
  }

  /** The paws connect: a wide swipe, or the smash cracking the ground. */
  private strike(b: Blow): void {
    const w = this.world;
    const u = this.aimVec();
    const k = this.kit;
    const big = this.grown;
    const cx = this.x;
    const cy = this.y - 12 * big;
    const a = Math.atan2(u.y, u.x);
    if (b === 'smash') {
      const bx = cx + u.x * SMASH_AHEAD * big;
      const gy = this.y + u.y * SMASH_AHEAD * big * 0.8;
      const hits = w.melee({ kind: 'circle', x: bx, y: gy - 6, radius: SMASH_R * big }, { damage: SMASH_DAMAGE, heavy: true, knock: SMASH_KNOCK });
      for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, k.fx, h.y + 13, true));
      this.fx.push(new EarthCracks(w, snap(bx), snap(gy), (SMASH_R + 6) * big, k.pal, this.bk.leaves, 500));
      this.fx.push(new Shockwave(w, snap(bx), snap(gy), SMASH_R * big, k.fx));
      w.debris([EARTH.crust, EARTH.side, EARTH.dust], bx, gy, 10, gy + 10, 'burst');
      sound.quakeSlam(w.pan(bx));
      w.cameras.main.shake(140, hits.length ? 0.0009 : 0.0005);
      if (this.raging) this.fx.push(new RageWave(w, bx, gy, u.x, u.y, WAVE_REACH * big, WAVE_SMASH, k.pal));
      return;
    }
    // The swipe sweeps across the aim: the right paw one way, the left paw back.
    const turn = b === 'swipe' ? -1 : 1;
    this.fx.push(new SwipeArc(w, cx + u.x * 4, cy + u.y * 3, a, (SWIPE_REACH - 6) * big, turn, k.pal));
    this.fx.push(new ClawMarks(w, cx + u.x * 15 * big, cy + u.y * 11 * big, a + turn * (Math.PI / 2 + 0.4), 10 * big, k.pal, snap(this.y) + 2));
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: SWIPE_REACH * big, angle: a, spread: SWIPE_SPREAD }, { damage: SWIPE_DAMAGE, heavy: true, knock: SWIPE_KNOCK });
    for (const h of hits) {
      this.fx.push(new HitSpark(w, h.x, h.y, k.fx, h.y + 13, true));
      sound.rake(w.pan(h.x), true);
    }
    if (hits.length) w.cameras.main.shake(80, 0.0004);
    if (this.raging) this.fx.push(new RageWave(w, this.x, this.y, u.x, u.y, WAVE_REACH * big, WAVE_SWIPE, k.pal));
  }

  /** Earthsplitter: the ground breaks round him; every foe in the ring is struck and stunned. */
  private quake(): void {
    const w = this.world;
    const k = this.kit;
    const R = QUAKE_R * this.grown;
    const hits = w.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - this.x, (h.y - this.y) / 0.75) <= R + h.radius);
    for (const h of hits) {
      h.hurt({ damage: QUAKE_DAMAGE, heavy: true, knock: QUAKE_KNOCK, fromX: this.x, fromY: this.y });
      h.slow?.(0, STUN_MS, k.pal.mid);
      this.fx.push(new Dazed(w, h, STUN_MS, k.pal));
    }
    this.fx.push(new EarthCracks(w, snap(this.x), snap(this.y), R, k.pal, this.bk.leaves));
    this.fx.push(new Shockwave(w, snap(this.x), snap(this.y), R * 0.55, k.fx));
    w.debris([EARTH.crust, EARTH.side, EARTH.dust, k.pal.hot], this.x, this.y, 16, this.y + 10, 'burst');
    w.cameras.main.shake(300, 0.0013);
    sound.quakeSlam(w.pan(this.x));
  }
}
