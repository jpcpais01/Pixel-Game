import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { INV_H, INV_HAND_Y, INV_ORIGIN_X, INV_ORIGIN_Y, INV_W } from '../art/inventor';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { bloom, bolt, circle, clamp01, drag, flare, Fx, pal, ring, strikeGround, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';
import { stand } from './rest';

// The Scientist (the Inventor's second type): a young experimenter with a
// Tesla gun.
//  - Attack (held): a crack of lightning from the gun to a foe the way it
//    aims, which leaps on to the next foe near it, and the next, weaker each
//    jump; each one it touches is jolted for a moment.
//  - Ability: Polarity Orb. A crackling orb tossed at a spot hangs there and
//    drags the foes round it in, then bursts in a shock.
//  - Special: Chain Reaction (see ultimate/inventor.ts). A great atom forms
//    over a spot, arcs lashing out of it, and then it splits.
// Einstein plays the same: his chalk throws golden sparks, his orb is a
// gravity well that bends the ground round it, and his Special is E = mc².

const ZAP_EVERY = 450;
/** The zap leaves the gun on its release frame. */
const ZAP_LAND = (1 / 14) * 1000;
const ZAP_POSE = (4 / 14) * 1000;
const ZAP_DAMAGE = 9;
const ZAP_RANGE = 110;
const ZAP_CONE = Math.cos((55 * Math.PI) / 180);
/** Each jump reaches this far from the last foe, and hits this much of the one before. */
const JUMP_RANGE = 50;
const JUMP_FALLOFF = 0.7;
const JUMPS = 2;
/** With no foe in reach, the arc crackles out this far and fizzles. */
const FIZZLE = 46;

const ORB_POSE = (5 / 13) * 1000;
const ORB_LAND = (2 / 13) * 1000;
const ORB_COOLDOWN = 6500;
const ORB_MIN = 35;
const ORB_MAX = 95;
const ORB_TOUCH = 62;

const FOOTFALLS = new Set([1, 4]);

export interface ScientistKit {
  key: string;
  einstein: boolean;
  maxHp: number;
  speed: number;
  pal: Pal;
}

export const SCIENTIST_KIT: ScientistKit = {
  key: 'scientist',
  einstein: false,
  maxHp: HERO_STATS['inventor.scientist'].hp,
  speed: HERO_STATS['inventor.scientist'].speed,
  pal: pal(0xf0ffff, 0xa8f4ff, 0x40d0ff, 0x1a6ab0, 0x7ae4ff),
};

export const EINSTEIN_KIT: ScientistKit = {
  ...SCIENTIST_KIT,
  key: 'scientist_einstein',
  einstein: true,
  pal: pal(0xfffdf0, 0xfff0b0, 0xffd060, 0xc08020, 0xffe090),
};

export class Scientist implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: ScientistKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private zapT = 0;
  private move: 'zap' | 'toss' | null = null;
  private moveT = 0;
  private landed = false;
  private orbCd = 0;
  private prevSpecial = false;
  private charge = 0;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: ScientistKit = SCIENTIST_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = INV_ORIGIN_X / INV_W;
    const oy = INV_ORIGIN_Y / INV_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 50, kit.pal.light, 0);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.zapT = Math.max(0, this.zapT - dt);
    this.orbCd = Math.max(0, this.orbCd - dt);
    this.charge = Math.max(0, this.charge - dt / 300);
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (this.move) {
      this.moveT += dt;
      if (!this.landed && this.moveT >= (this.move === 'zap' ? ZAP_LAND : ORB_LAND)) {
        this.landed = true;
        if (this.move === 'zap') this.zap();
        else this.throwOrb();
      }
      if (this.moveT >= (this.move === 'zap' ? ZAP_POSE : ORB_POSE)) this.move = null;
    }
    if (this.move !== 'toss') {
      if (pressed && this.orbCd === 0) this.start('toss');
      else if (attack && this.zapT === 0) this.start('zap');
    }

    const pace = this.kit.speed * (this.move ? 0.6 : 1);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (!this.move) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = moving ? `${this.kit.key}_walk_${this.dir}` : stand(this.body, `${this.kit.key}_idle_${this.dir}`);
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.sync();
    this.updateHud();
  }

  private start(move: 'zap' | 'toss'): void {
    this.move = move;
    this.moveT = 0;
    this.landed = false;
    if (move === 'zap') this.zapT = ZAP_EVERY;
    else this.orbCd = ORB_COOLDOWN;
    const u = this.aimVec();
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_${move}_${this.dir}`);
  }

  // -------------------------------------------------------------------------
  // The zap

  /** Where the arc leaves the gun: the hand, reaching the way it aims. */
  private muzzle(): { x: number; y: number } {
    const u = this.aimVec();
    return { x: this.x + u.x * 8, y: this.y - INV_HAND_Y + u.y * 5 };
  }

  /** Lightning to the best foe the way it aims, leaping on from foe to foe. */
  private zap(): void {
    const w = this.world;
    const u = this.aimVec();
    const m = this.muzzle();
    const first = this.pick(u, m);
    const pts: { x: number; y: number }[] = [m];
    this.charge = 1;
    if (!first) {
      pts.push({ x: m.x + u.x * FIZZLE, y: m.y + u.y * FIZZLE });
      w.addEffect(new Arc(w, pts, this.kit.pal, this.y, this.kit.einstein));
      sound.tesla(w.pan(this.x), false);
      return;
    }
    const struck = new Set<Hurtbox>();
    let h: Hurtbox | null = first;
    let dmg = ZAP_DAMAGE;
    for (let i = 0; i <= JUMPS && h; i++) {
      struck.add(h);
      h.hurt({ damage: dmg, heavy: false, knock: 30, fromX: pts[pts.length - 1].x, fromY: pts[pts.length - 1].y });
      h.slow?.(0.7, 280, this.kit.pal.mid);
      pts.push({ x: h.x, y: h.y - h.bodyY });
      w.debris(this.kit.pal.tints, h.x, h.y - h.bodyY, 4, h.y + 10, 'burst');
      dmg *= JUMP_FALLOFF;
      const from: Hurtbox = h;
      h = null;
      let best = JUMP_RANGE;
      for (const o of w.hurtboxesWhere((b) => b.alive && !struck.has(b))) {
        const d = Math.hypot(o.x - from.x, o.y - from.y);
        if (d <= best) {
          best = d;
          h = o;
        }
      }
    }
    w.addEffect(new Arc(w, pts, this.kit.pal, Math.max(...pts.map((p) => p.y)) + 20, this.kit.einstein));
    sound.tesla(w.pan(first.x), pts.length > 2);
  }

  /** The foe to strike first: the nearest the way it aims, else the nearest at all, within reach. */
  private pick(u: { x: number; y: number }, m: { x: number; y: number }): Hurtbox | null {
    let best: Hurtbox | null = null;
    let bestScore = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - m.x;
      const dy = h.y - h.bodyY - m.y;
      const d = Math.hypot(dx, dy);
      if (d > ZAP_RANGE) continue;
      const ahead = d > 0 && (dx * u.x + dy * u.y) / d >= ZAP_CONE;
      const score = d * (ahead ? 1 : 2.5);
      if (score < bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // The orb

  private throwOrb(): void {
    const u = this.aimVec();
    const want = this.aim?.dist === undefined ? ORB_TOUCH : Phaser.Math.Clamp(this.aim.dist, ORB_MIN, ORB_MAX);
    let tx = this.x;
    let ty = this.y;
    for (let r = want; r >= 0; r -= 4) {
      tx = this.x + u.x * r;
      ty = this.y + u.y * r - (this.aim?.dist === undefined ? 0 : INV_HAND_Y * 0.5);
      if (this.world.walkable(tx, ty)) break;
    }
    this.world.addEffect(new PolarityOrb(this.world, this.x - u.x * 3, this.y - INV_HAND_Y - 2, tx, ty, this.kit.pal, this.kit.einstein));
    sound.toss();
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = 1 - this.orbCd / ORB_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = false;
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
    const m = this.muzzle();
    this.aura.setPosition(m.x, m.y);
    // The bulb glows a little at night, and flares as it fires.
    this.aura.intensity = 0.4 * (1 - this.daylight) + 1.6 * this.charge;
  }
}

/**
 * The zap: a jagged, flickering bolt through each point in turn (the gun,
 * then every foe it leapt to). Einstein's is golden and throws sparks.
 */
export class Arc extends Fx {
  private g: Ink;
  private cx: number;
  private cy: number;

  constructor(
    world: WorldScene,
    private pts: { x: number; y: number }[],
    private p: Pal,
    private depth: number,
    private sparks = false,
    life = 200,
  ) {
    super(world, life);
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    this.cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    this.cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    this.g = this.ink(Math.ceil(Math.max(...xs) - Math.min(...xs) + 16), Math.ceil(Math.max(...ys) - Math.min(...ys) + 16));
    flare(world, pts[0].x, pts[0].y, 60, p.light, 1.2, 180);
  }

  protected step(): void {
    const a = 1 - clamp01((this.t - this.life * 0.45) / (this.life * 0.55));
    const g = this.g.begin(this.cx, this.cy, this.depth);
    const seed = Math.floor(this.t / 45);
    for (let i = 0; i < this.pts.length - 1; i++) {
      const s = this.pts[i];
      const e = this.pts[i + 1];
      bolt(g, s.x, s.y, e.x, e.y, this.p, seed + i * 7, a, 0.6);
      g.put(e.x, e.y, this.p.core, a);
      if (this.sparks && (seed + i) % 2 === 0) for (let k = 0; k < 3; k++) g.put(e.x + (Math.random() - 0.5) * 7, e.y + (Math.random() - 0.5) * 7, this.p.hot, a);
    }
    g.end();
  }
}

const ORB_FLY = 260;
const ORB_PULL = 1300;
const ORB_R = 62;
const ORB_PULL_SPEED = 75;
const ORB_TICK = 300;
const ORB_TICK_DAMAGE = 2;
const ORB_BURST_R = 36;
const ORB_BURST_DAMAGE = 22;
const ORB_H = 9;

/**
 * The polarity orb: tossed in an arc, it hangs over the spot crackling with
 * field lines that curl in, drags every foe near into it, then bursts in a
 * ring of shock. Einstein's is a gravity well: the ground bends into it in
 * rings that close on the middle.
 */
class PolarityOrb extends Fx {
  private g: Ink;
  private tickT = ORB_TICK;
  private burst = false;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private tx: number,
    private ty: number,
    private p: Pal,
    private well: boolean,
  ) {
    super(world, ORB_FLY + ORB_PULL + 420);
    this.g = this.ink(ORB_R * 2 + 24, Math.ceil(ORB_R * 1.4) + 60);
    this.lamp = this.light(x0, y0, 60, p.light, 0.8);
  }

  protected step(dt: number): void {
    const w = this.world;
    const { tx, ty, p } = this;
    const g = this.g.begin(tx, ty - 10, ty + ORB_R);
    let ox = tx;
    let oy = ty - ORB_H;
    if (this.t < ORB_FLY) {
      const k = this.t / ORB_FLY;
      ox = this.x0 + (tx - this.x0) * k;
      oy = this.y0 + (ty - ORB_H - this.y0) * k - Math.sin(k * Math.PI) * 16;
    } else if (this.t < ORB_FLY + ORB_PULL) {
      const k = (this.t - ORB_FLY) / ORB_PULL;
      oy += Math.sin(this.t * 0.012) * 1.2;
      if (this.well) {
        // Space bending: rings on the ground shrinking into the well, over and over.
        for (let i = 0; i < 3; i++) {
          const r = ORB_R * (1 - (((this.t * 0.0012 + i / 3) % 1) ** 0.8));
          ring(g, tx, ty, r, 0.6, p, 0.7 * (1 - r / ORB_R) + 0.15);
        }
        circle(g, tx, ty, ORB_R, p.deep, 0.35);
      } else {
        // Field lines curling in from the rim.
        for (let arm = 0; arm < 6; arm++) {
          for (let s = 0; s < 14; s++) {
            const f = s / 14;
            const a = (arm * Math.PI) / 3 + f * 1.8 - this.t * 0.004;
            const r = ORB_R * (1 - f) * (0.9 + 0.1 * Math.sin(this.t * 0.02 + arm));
            g.put(tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.58, f > 0.6 ? p.hot : f > 0.3 ? p.mid : p.deep, 0.4 + f * 0.5);
          }
        }
      }
      // Drag them in, jolting them as they come.
      const inside = w.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - tx, (h.y - ty) / 0.8) <= ORB_R);
      for (const h of inside) drag(h, tx, ty, ORB_PULL_SPEED * (0.6 + 0.4 * k), dt);
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = ORB_TICK;
        for (const h of inside) {
          h.hurt({ damage: ORB_TICK_DAMAGE, heavy: false, knock: 0, fromX: tx, fromY: ty });
          h.slow?.(0.6, ORB_TICK + 100, p.mid);
        }
        if (inside.length) sound.tesla(w.pan(tx), false);
      }
    } else {
      if (!this.burst) {
        this.burst = true;
        strikeGround(w, tx, ty, ORB_BURST_R, { damage: ORB_BURST_DAMAGE, heavy: true, knock: 140 });
        bloom(w, tx, ty - ORB_H, p.hot, 2, 420, ty + 30);
        flare(w, tx, ty - ORB_H, 110, p.light, 2.6, 420);
        w.debris(p.tints, tx, ty - ORB_H, 16, ty + 20, 'burst');
        w.cameras.main.shake(120, 0.0005);
        sound.blast(w.pan(tx));
      }
      const b = clamp01((this.t - ORB_FLY - ORB_PULL) / 360);
      ring(g, tx, ty, ORB_BURST_R * (0.25 + 0.75 * b), 2.2 * (1 - b) + 0.5, p, 1 - b);
      // Sparks thrown out along the ring.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const r = ORB_BURST_R * (0.4 + 0.8 * b);
        g.put(tx + Math.cos(a) * r, ty - ORB_H * (1 - b) + Math.sin(a) * r * 0.58, p.core, 1 - b);
      }
      g.end();
      this.lamp.intensity = 2.5 * (1 - b);
      return;
    }
    // The orb itself: a hot core, a ring of light round it, arcs flicking.
    const r = this.well ? 2.6 : 2.2;
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        const d = Math.hypot(x, y);
        if (d <= r) g.put(ox + x, oy + y, this.well && d < 1.2 ? 0x140c02 : d < r * 0.5 ? p.core : p.hot);
        else if (d <= r + 1.2) g.put(ox + x, oy + y, this.well ? p.core : p.mid, 0.7);
      }
    }
    const a = this.t * 0.03;
    g.put(ox + Math.cos(a) * 5, oy + Math.sin(a) * 3, p.core);
    g.put(ox + Math.cos(a + 2.1) * 5, oy + Math.sin(a + 2.1) * 3, p.hot, 0.8);
    g.put(ox + Math.cos(a + 4.2) * 5, oy + Math.sin(a + 4.2) * 3, p.mid, 0.7);
    g.end();
    this.lamp.setPosition(ox, oy);
  }
}
