import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { JUGG_CHEST_Y, JUGG_H, JUGG_HIT_FRAME, JUGG_ORIGIN_X, JUGG_ORIGIN_Y, JUGG_STACK_Y, JUGG_W, TIN_STACK_Y, type JuggAnim } from '../art/juggernaut';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox, type MeleeArea } from './combat';
import { Heat, HEAT_MAX } from './heat';
import { HitSpark, Shockwave, type Effect, type Scheme } from './Slash';
import { PunchBlast } from './Fists';
import { drag, pal, type Pal } from './ultimate/ink';
import { HeartPop, HeatWave, Meltdown, WAVE_DAMAGE, WAVE_SLAM_DAMAGE } from './ultimate/juggernaut';
import type { Cast } from './ultimate/types';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Juggernaut (the Automaton's brawler): a hulking steam-powered iron
// boiler on stubby legs, two piston gauntlets for fists.
//  - Attack (held): Piston fists. A left jab, a right jab, then the piston
//    slam: the rod fires with a blast of steam and the fist lands heavy,
//    throwing foes back. Every blow warms it.
//  - Ability: Steam rush. Boilers wide open, it charges the way it aims,
//    ramming whatever it meets and carrying it along on its fists, and ends
//    in a double-piston shove that hurls them all away.
//  - Special: Meltdown (see ultimate/juggernaut.ts). The furnace bursts open:
//    for a while its heat is pinned in the red and never vents, so every
//    blow lands hot and throws a shockwave of heat on past the fist, and it
//    is wreathed in scalding steam; it ends in one great vent.
// Its heat is the Automaton's (heat.ts): hot past the red line, it hits
// harder; topped out, it vents and stalls.
// The Tin Man plays the same in tin plate, with a heart for a furnace.

type Blow = 'jabA' | 'jabB' | 'slam';

interface BlowDef {
  /** How far the fist reaches from the chest, and the half-width of the line it strikes along. */
  reach: number;
  radius: number;
  damage: number;
  heavy?: boolean;
  knock: number;
  /** The step it takes into the blow, px/s. */
  lunge: number;
  heat: number;
  /** The air cracking off the knuckles: how big. */
  size: number;
}

const BLOWS: Record<Blow, BlowDef> = {
  jabA: { reach: 22, radius: 7, damage: 9, knock: 70, lunge: 30, heat: 5, size: 0.9 },
  jabB: { reach: 22, radius: 7, damage: 9, knock: 70, lunge: 30, heat: 5, size: 0.9 },
  slam: { reach: 28, radius: 9, damage: 20, heavy: true, knock: 240, lunge: 70, heat: 10, size: 1.6 },
};
const COMBO: readonly Blow[] = ['jabA', 'jabB', 'slam'];
/** A blow chains into the next if it starts within this long of the last. */
const COMBO_WINDOW = 900;
/** The pause after a blow before the next can start: a jab's, and the slam's heavier one. */
const JAB_REST = 30;
const SLAM_REST = 160;

/** Steam rush: how far and how fast it charges, what the ram and the shove deal, and how long till the next. */
const RUSH_DIST = 90;
const RUSH_SPEED = 300;
const RUSH_DAMAGE = 10;
const RUSH_RADIUS = 13;
/** Foes it rams ride along this far ahead of its feet. */
const RUSH_CARRY = 15;
const SHOVE_DAMAGE = 16;
const SHOVE_REACH = 28;
const SHOVE_KNOCK = 270;
const RUSH_HEAT = 15;
const RUSH_COOLDOWN = 6000;

/** In a meltdown: the gauge is held here, in the red but short of venting. */
const MELT_HEAT = 0.96;

const WALK_STOMPS = new Set([1, 4]);

type State = 'free' | 'punch' | 'rush' | 'shove';

export interface JuggKit {
  key: string;
  tin: boolean;
  maxHp: number;
  speed: number;
  /** The jabs' crack of air, and the slam's and shove's. */
  air: Scheme;
  heavy: Scheme;
  /** Meltdown's colours. */
  pal: Pal;
  /** Steam and dust it kicks up as it charges. */
  steam: number[];
  /** The furnace's light around it at night. */
  aura: number;
}

export const JUGG_KIT: JuggKit = {
  key: 'jugg',
  tin: false,
  maxHp: HERO_STATS['automaton.juggernaut'].hp,
  speed: HERO_STATS['automaton.juggernaut'].speed,
  air: { core: 0xffffff, hot: 0xf4f0ea, mid: 0xd0c8c0, deep: 0x8a8078 },
  heavy: { core: 0xfff4d8, hot: 0xffc060, mid: 0xff6a3a, deep: 0xb02a14, light: 0xff8a40 },
  pal: pal(0xfff6e0, 0xffc860, 0xff6a3a, 0xa8281a, 0xff8a4a),
  steam: [0xffffff, 0xe6ecf2, 0xc0cad6],
  aura: 0xffa060,
};

/** The Tin Man: silver air and a rose-red heart's fire. */
export const TINMAN_KIT: JuggKit = {
  ...JUGG_KIT,
  key: 'jugg_tinman',
  tin: true,
  air: { core: 0xffffff, hot: 0xeef4ff, mid: 0xc0cad8, deep: 0x7a8698 },
  heavy: { core: 0xfff0f4, hot: 0xffb0c4, mid: 0xff5a7a, deep: 0xa01a3a, light: 0xff7a9a },
  pal: pal(0xfff0f4, 0xffa0b8, 0xff5a7a, 0xa01a3a, 0xff7a9a),
  aura: 0xff8aa8,
};

export class Juggernaut implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: JuggKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private heat: Heat;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  /** Where the current blow or rush goes. */
  private line = { x: 0, y: 1 };
  private clock = 0;
  private cooldown = 0;

  private blow: Blow = 'jabA';
  private step = 0;
  private lastPunchAt = -Infinity;
  private struck = false;
  private buffered = false;
  private prevAttack = false;
  private prevSpecial = false;
  private dash = { vx: 0, vy: 0, t: 0 };

  private rushCd = 0;
  private rushLeft = 0;
  private carried = new Set<Hurtbox>();
  private trailT = 0;

  private melt: Meltdown | null = null;
  private smokeT = 0;
  private fx: Effect[] = [];

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: JuggKit = JUGG_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = JUGG_ORIGIN_X / JUGG_W;
    const oy = JUGG_ORIGIN_Y / JUGG_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1).setScale(1.5, 1.2);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 50, kit.aura, 0);
    this.heat = new Heat(world, this);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && WALK_STOMPS.has(frame.index - 1)) this.stomp();
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state === 'punch' && anim.key.startsWith(`${key}_${this.blow}_`)) {
        this.state = 'free';
        this.cooldown = this.blow === 'slam' ? SLAM_REST : JAB_REST;
      } else if (this.state === 'shove' && anim.key.startsWith(`${key}_shove_`)) {
        this.state = 'free';
        this.cooldown = SLAM_REST;
      }
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.heat.destroy();
      beamHud.firing = false;
      comboHud.max = 3;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.rushCd = Math.max(0, this.rushCd - dt);

    // In a meltdown its heat is pinned in the red: always hot, never venting.
    const melting = !!this.melt?.melting;
    if (melting) {
      this.heat.stall = 0;
      this.heat.value = HEAT_MAX * MELT_HEAT;
    } else if (this.melt) {
      // The great vent has blown: it's spent all its pressure.
      this.melt = null;
      this.heat.value = 0;
    }
    this.heat.update(dt);
    const stalled = this.heat.overheated;

    const pressedAttack = attack && !this.prevAttack;
    this.prevAttack = attack;
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;
    if (pressedAttack && this.state === 'punch') this.buffered = true;

    if (this.state === 'rush') this.updateRush(dt, bounds);
    else if (this.state === 'punch' || this.state === 'shove') this.watchHit();
    else if (this.state === 'free' && !stalled && this.cooldown === 0) {
      if (pressed && this.rushCd === 0) this.startRush();
      else if (attack || this.buffered) this.startPunch();
    }

    // Heavy: slowed into its blows, slowest venting; the rush moves it itself.
    if (this.state !== 'rush') {
      const k = stalled ? 0.4 : this.state === 'punch' ? 0.3 : this.state === 'shove' ? 0.15 : 1;
      const speed = this.kit.speed * k * Math.min(1, len);
      let vx = moving ? (mx / len) * speed : 0;
      let vy = moving ? (my / len) * speed : 0;
      if (this.dash.t > 0) {
        vx += this.dash.vx;
        vy += this.dash.vy;
        this.dash.t -= dt;
      }
      this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);
    }
    this.animate(moving, stalled);
    this.sync(dt);
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    this.updateHud();
  }

  private animate(moving: boolean, stalled: boolean): void {
    if (this.state !== 'free') return;
    const key = this.kit.key;
    if (stalled) {
      this.play(`${key}_vent_${this.dir}`);
      return;
    }
    if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
    else if (moving) this.dir = dirOf(this.lastMove.x, this.lastMove.y);
    this.play(moving ? `${key}_walk_${this.dir}` : stand(this.body, `${key}_idle_${this.dir}`));
  }

  private play(key: string): void {
    if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
  }

  /** A boot coming down: a thud and a puff of dust. */
  private stomp(): void {
    sound.step();
    this.world.debris([0xb8a888, 0x8a7a60, 0x6a5e4a], snap(this.x), snap(this.y) - 1, 3, this.y + 2, 'burst');
  }

  // -------------------------------------------------------------------------
  // Piston fists

  private startPunch(): void {
    const chain = this.step > 0 && this.step < COMBO.length && this.clock - this.lastPunchAt <= COMBO_WINDOW;
    this.step = chain ? this.step + 1 : 1;
    this.lastPunchAt = this.clock;
    const blow = COMBO[this.step - 1];
    this.blow = blow;
    this.buffered = false;
    this.struck = false;
    this.state = 'punch';
    this.line = this.aimVec();
    this.dir = dirOf(this.line.x, this.line.y);
    this.body.play(`${this.kit.key}_${blow}_${this.dir}`);
    sound.punch(blow === 'slam' ? 5 : this.step + 1, this.world.pan(this.x));
    // The slam saves its step for the moment the piston fires.
    if (blow !== 'slam') {
      const b = BLOWS[blow];
      this.dash = { vx: this.line.x * b.lunge, vy: this.line.y * b.lunge, t: 90 };
    } else sound.servo(this.world.pan(this.x));
  }

  /** A blow's (or the shove's) anim reaching the frame where it lands. */
  private watchHit(): void {
    if (this.struck) return;
    const f = this.body.anims.currentFrame;
    const anim: JuggAnim = this.state === 'shove' ? 'shove' : this.blow;
    if (!f || f.index - 1 < (JUGG_HIT_FRAME[anim] ?? 1)) return;
    this.struck = true;
    if (this.state === 'shove') this.shove();
    else this.land();
  }

  /** The fist lands: the air cracks off the knuckles, and whatever it reaches is struck. */
  private land(): void {
    const b = BLOWS[this.blow];
    const u = this.line;
    const w = this.world;
    const cx = snap(this.x);
    const cy = snap(this.y) - JUGG_CHEST_Y;
    const heavy = this.blow === 'slam';
    const scheme = heavy ? this.kit.heavy : this.kit.air;
    const area: MeleeArea = { kind: 'line', x0: cx, y0: cy, x1: cx + u.x * b.reach, y1: cy + u.y * b.reach, radius: b.radius };
    const fist = { x: Math.round(cx + u.x * (b.reach - 8)), y: Math.round(cy + u.y * (b.reach - 8)) };
    this.fx.push(new PunchBlast(w, fist.x, fist.y, u.x, u.y, scheme, snap(this.y), b.size));
    const hits = w.melee(area, { damage: b.damage * this.heat.power, heavy: b.heavy, knock: b.knock, fromX: cx, fromY: cy });
    hits.forEach((h, i) => {
      this.fx.push(new HitSpark(w, h.x, h.y, scheme, h.y + 13, heavy));
      if (i < 2) sound.punchHit(w.pan(h.x), heavy);
    });
    this.heat.add(b.heat);
    if (this.melt?.melting) {
      // Burning open, every blow throws a shockwave of heat on past the fist (the Special's own blow).
      w.castSpecial(() => w.addEffect(new HeatWave(w, this.x, this.y, u.x, u.y, this.kit.pal, heavy ? WAVE_SLAM_DAMAGE : WAVE_DAMAGE, heavy)));
    }
    if (heavy) {
      // The piston fires: steam blasts out of the housing and the whole body goes in behind the fist.
      this.dash = { vx: u.x * b.lunge, vy: u.y * b.lunge, t: 120 };
      const back = { x: cx - u.x * 6, y: cy - u.y * 6 + 2 };
      w.debris(this.kit.steam, back.x - u.y * 6, back.y + u.x * 3, 5, this.y + 14, 'spores');
      w.debris(this.kit.steam, back.x + u.y * 6, back.y - u.x * 3, 5, this.y + 14, 'spores');
      sound.slam(w.pan(this.x));
      w.cameras.main.shake(150, 0.0009);
      if (hits.length) {
        this.fx.push(new Shockwave(w, snap(this.x + u.x * b.reach), snap(this.y + u.y * b.reach * 0.6), 16, scheme));
        if (this.kit.tin) w.addEffect(new HeartPop(w, hits[0].x, hits[0].y - 4, this.kit.pal, 3));
      }
    } else if (hits.length) w.cameras.main.shake(50, 0.0003);
  }

  // -------------------------------------------------------------------------
  // Steam rush

  private startRush(): void {
    this.state = 'rush';
    this.step = 0;
    this.buffered = false;
    this.line = this.aimVec();
    // Once the aim lets go (a touch button released), the stick steers on from here.
    this.lastMove.set(this.line.x, this.line.y);
    this.dir = dirOf(this.line.x, this.line.y);
    this.body.play(`${this.kit.key}_rush_${this.dir}`, true);
    this.rushLeft = RUSH_DIST;
    this.rushCd = RUSH_COOLDOWN;
    this.carried.clear();
    this.trailT = 0;
    const w = this.world;
    // The boilers open: a blast of steam out of its back.
    w.debris(this.kit.steam, snap(this.x - this.line.x * 10), snap(this.y) - 14, 14, this.y + 10, 'burst');
    sound.windDash(w.pan(this.x));
    sound.servo(w.pan(this.x));
  }

  /** Charging: on along the line, ramming what's in the way and carrying it on its fists; a wall or the end stops it in a shove. */
  private updateRush(dt: number, bounds: Phaser.Geom.Rectangle): void {
    const w = this.world;
    const u = this.line;
    let move = Math.min(this.rushLeft, (RUSH_SPEED * dt) / 1000);
    let blocked = false;
    // In small steps, so it can't pass through a wall or a foe.
    while (move > 0) {
      const s = Math.min(3, move);
      const nx = Phaser.Math.Clamp(this.x + u.x * s, bounds.left, bounds.right);
      const ny = Phaser.Math.Clamp(this.y + u.y * s, bounds.top, bounds.bottom);
      if (!w.walkable(nx, ny) || (nx === this.x && ny === this.y)) {
        blocked = true;
        break;
      }
      this.x = nx;
      this.y = ny;
      move -= s;
      this.rushLeft -= s;
    }
    // Whatever it runs into is rammed (once) and carried along ahead of it.
    const ahead = { x: this.x + u.x * RUSH_CARRY, y: this.y + u.y * RUSH_CARRY };
    const rammed = w.hurtboxesWhere((h) => h.alive && !this.carried.has(h) && Math.hypot(h.x - ahead.x, h.y - ahead.y) <= RUSH_RADIUS + h.radius);
    for (const h of rammed) {
      this.carried.add(h);
      h.hurt({ damage: RUSH_DAMAGE * this.heat.power, heavy: true, knock: 0, fromX: this.x, fromY: this.y });
      this.fx.push(new HitSpark(w, h.x, h.y - h.bodyY, this.kit.air, h.y + 13, true));
    }
    if (rammed.length) {
      sound.punchHit(w.pan(this.x), true);
      w.cameras.main.shake(70, 0.0006);
    }
    for (const h of this.carried) if (h.alive) drag(h, ahead.x, ahead.y, RUSH_SPEED * 2, dt);
    // Steam streaming out behind it, and its boots tearing up the ground.
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 35;
      w.debris(this.kit.steam, snap(this.x - u.x * 12), snap(this.y - u.y * 6) - 16, 2, this.y + 4, 'trail');
      w.debris([0xb8a888, 0x8a7a60], snap(this.x - u.x * 4), snap(this.y), 1, this.y + 2, 'burst');
    }
    if (blocked || this.rushLeft <= 0 || !this.vitals.alive) this.startShove();
  }

  private startShove(): void {
    this.state = 'shove';
    this.struck = false;
    this.body.play(`${this.kit.key}_shove_${this.dir}`, true);
  }

  /** Both pistons fire at once: everything it carried, and anything in front, hurled away. */
  private shove(): void {
    const w = this.world;
    const u = this.line;
    const cx = snap(this.x);
    const cy = snap(this.y) - JUGG_CHEST_Y;
    const area: MeleeArea = { kind: 'line', x0: cx, y0: cy, x1: cx + u.x * SHOVE_REACH, y1: cy + u.y * SHOVE_REACH, radius: 14 };
    const hits = w.melee(area, { damage: SHOVE_DAMAGE * this.heat.power, heavy: true, knock: SHOVE_KNOCK, fromX: this.x, fromY: this.y });
    // Anything it carried that slipped out of the line still goes flying.
    for (const h of this.carried) {
      if (!h.alive || Math.hypot(h.x - this.x, h.y - this.y) > SHOVE_REACH + 12) continue;
      const inLine = hits.some((p) => Math.hypot(p.x - h.x, p.y - (h.y - h.bodyY)) < h.radius + 4);
      if (!inLine) h.hurt({ damage: SHOVE_DAMAGE * this.heat.power, heavy: true, knock: SHOVE_KNOCK, fromX: this.x, fromY: this.y });
    }
    this.carried.clear();
    this.fx.push(new PunchBlast(w, Math.round(cx + u.x * 16), Math.round(cy + u.y * 16), u.x, u.y, this.kit.heavy, snap(this.y), 1.8));
    hits.slice(0, 3).forEach((h) => this.fx.push(new HitSpark(w, h.x, h.y, this.kit.heavy, h.y + 13, true)));
    if (this.melt?.melting) w.castSpecial(() => w.addEffect(new HeatWave(w, this.x, this.y, u.x, u.y, this.kit.pal, WAVE_SLAM_DAMAGE, true)));
    if (this.kit.tin && hits.length) w.addEffect(new HeartPop(w, hits[0].x, hits[0].y - 4, this.kit.pal, 4));
    w.debris(this.kit.steam, cx - u.y * 8, cy + u.x * 4, 6, this.y + 14, 'spores');
    w.debris(this.kit.steam, cx + u.y * 8, cy - u.x * 4, 6, this.y + 14, 'spores');
    sound.slam(w.pan(this.x));
    if (hits.length) sound.punchHit(w.pan(hits[0].x), true);
    w.cameras.main.shake(170, 0.0011);
    this.heat.add(RUSH_HEAT);
  }

  // -------------------------------------------------------------------------
  // Meltdown (the Special)

  /** The Special's doing: the furnace bursts open, and the wreath of scalding steam goes with it. */
  meltdown(c: Cast): void {
    this.melt?.destroy();
    this.heat.stall = 0;
    this.heat.value = HEAT_MAX * MELT_HEAT;
    this.melt = new Meltdown(this.world, c, this);
    this.world.addEffect(this.melt);
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.rushCd / RUSH_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = this.state === 'rush' || this.state === 'shove';
    const since = this.clock - this.lastPunchAt;
    const n = COMBO.length;
    comboHud.max = n;
    comboHud.hits = this.step;
    comboHud.window = this.step === 0 ? 0 : this.step < n ? Math.max(0, 1 - since / COMBO_WINDOW) : Math.max(0, 1 - since / 600);
  }

  private sync(dt: number): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    // Running hot the plating flushes red; burning open, it glows.
    const hot = this.heat.value / HEAT_MAX;
    const melting = !!this.melt?.melting;
    const flush = melting ? 0.7 + 0.3 * Math.sin(this.clock * 0.03) : hot > 0.7 && !this.heat.overheated ? 0.5 + 0.5 * Math.sin(this.clock * 0.02) : 0;
    const tint = this.kit.tin
      ? Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 70), Math.round(255 - flush * 50))
      : Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 80), Math.round(255 - flush * 110));
    if (!this.body.isTinted || this.body.tintTopLeft !== 0xff8070) this.body.setTint(tint);
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    // The furnace's glow at night, roaring in a meltdown.
    this.aura.setPosition(rx, ry - JUGG_CHEST_Y);
    this.aura.intensity = (0.5 + hot * 0.4) * (1 - this.daylight) + (melting ? 0.6 : 0);
    // Smoke from the stack (the funnel's spout), thicker the hotter it runs.
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = melting ? 90 : 460 - hot * 320;
      const side = this.dir === 'down' ? 7 : this.dir === 'up' ? -6 : this.dir === 'left' ? 5 : -5;
      const sx = this.kit.tin ? 0 : side;
      const top = this.kit.tin ? TIN_STACK_Y : JUGG_STACK_Y;
      const tints = this.kit.tin ? [0xe6ecf2, 0xc0cad6, 0xffffff] : hot > 0.7 ? [0x6a6a70, 0x4a4a50, 0x8a8a90] : [0x9a9aa0, 0x7a7a80, 0xb8b8c0];
      this.world.debris(tints, rx + sx, ry - top, 1, ry + 1, 'spores');
    }
  }
}
