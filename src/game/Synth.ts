import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { SYNTH_CHEST_Y, SYNTH_H, SYNTH_ORIGIN_X, SYNTH_ORIGIN_Y, SYNTH_W } from '../art/synth';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals, type Hurtbox } from './combat';
import { Heat } from './heat';
import { bolt, clamp01, Fx, line, pal, segDist, type Ink, type Pal } from './ultimate/ink';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Synth (the Automaton's second type): a slim android with three drones
// circling it.
//  - Attack (held): it flings out a hand and a drone darts at a foe the way
//    it aims, zaps it (a jolt that slows it a moment) and flies back; the
//    three take turns.
//  - Ability: Laser Grid. The drones fly out and hold a triangle over the
//    spot it aims at, joined by lasers: anything crossing a line is cut and
//    slowed. While the grid stands, attacks zap from its posts instead.
//  - Special: Swarm Protocol (see ultimate/robot.ts). Its chest opens and a
//    storm of micro-drones pours out to hunt everything near.
// Everything warms it (see heat.ts); overheated, it vents and stalls.
// The Hive Queen's drones are bee-bots whose stings leave honey, and her
// grid is a wall of honeycomb; she plays the same.

const DRONES = 3;
const ORBIT_R = 12;
const ORBIT_H = 17;
const DRONE_SPEED = 300;
const DRONE_RANGE = 120;
const DRONE_CONE = Math.cos((60 * Math.PI) / 180);
/** With no foe to go for, a drone darts this far out and back. */
const DRONE_REACH = 60;
const ZAP_DAMAGE = 7;
const ZAP_SLOW = 0.75;
const ZAP_SLOW_MS = 500;
const SEND_EVERY = 240;
const SEND_HEAT = 6;

const GRID_R = 30;
const GRID_MIN = 40;
const GRID_MAX = 95;
const GRID_TOUCH = 65;
const GRID_MS = 4500;
const GRID_TICK = 350;
const GRID_DAMAGE = 5;
const GRID_SLOW = 0.5;
const GRID_HEAT = 18;
const GRID_COOLDOWN = 7000;
/** From a post, the grid's drones zap foes within this reach. */
const POST_REACH = 90;
const POST_H = 10;

const FOOTFALLS = new Set([1, 4]);

export interface SynthKit {
  key: string;
  hive: boolean;
  maxHp: number;
  speed: number;
  /** Drone texture (its animation is `<drone>_spin`). */
  drone: string;
  pal: Pal;
  aura: number;
}

export const SYNTH_KIT: SynthKit = {
  key: 'synth',
  hive: false,
  maxHp: HERO_STATS['automaton.synth'].hp,
  speed: HERO_STATS['automaton.synth'].speed,
  drone: 'drone',
  pal: pal(0xf2ffff, 0x9ff6ff, 0x3ad6ff, 0x1a86b0, 0x6fe4ff),
  aura: 0xc8f4ff,
};

export const HIVE_KIT: SynthKit = {
  ...SYNTH_KIT,
  key: 'synth_hive',
  hive: true,
  drone: 'drone_hive',
  pal: pal(0xfffbe0, 0xffe08a, 0xffb03a, 0xc86a0e, 0xffc860),
  aura: 0xffe0a0,
};

type Goal = Hurtbox | { x: number; y: number };

interface Drone {
  i: number;
  x: number;
  y: number;
  /** Height over the ground. */
  z: number;
  state: 'orbit' | 'out' | 'back' | 'post';
  goal: Goal | null;
  post: { x: number; y: number } | null;
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  /** A post drone's own time to its next zap. */
  zapT: number;
}

export class Synth implements Hero {
  x: number;
  y: number;
  daylight = 0;
  readonly vitals: Vitals;
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private kit: SynthKit;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private aura: Phaser.GameObjects.Light;
  private heat: Heat;
  private drones: Drone[] = [];
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private aim: Aim | null = null;
  private clock = 0;
  private sendT = 0;
  private next = 0;
  /** The arm flung out (sending a drone) or raised (casting the grid): the walk waits. */
  private posing = 0;
  private gridT = 0;
  private gridCd = 0;
  private grid: LaserGrid | null = null;
  private prevSpecial = false;

  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: SynthKit = SYNTH_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    this.x = x;
    this.y = y;
    const key = kit.key;
    const ox = SYNTH_ORIGIN_X / SYNTH_W;
    const oy = SYNTH_ORIGIN_Y / SYNTH_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, key, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${key}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.aura = world.lights.addLight(x, y, 56, kit.aura, 0);
    this.heat = new Heat(world, this);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk_`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    for (let i = 0; i < DRONES; i++) {
      const a = (i / DRONES) * Math.PI * 2;
      const dx = x + Math.cos(a) * ORBIT_R;
      const dy = y + Math.sin(a) * ORBIT_R * 0.45;
      this.drones.push({
        i,
        x: dx,
        y: dy,
        z: ORBIT_H,
        state: 'orbit',
        goal: null,
        post: null,
        shadow: world.add.image(dx, dy, 'shadow').setScale(0.35, 0.3).setAlpha(0.5).setDepth(1),
        sprite: world.add.sprite(dx, dy, kit.drone, 'd0').setPipeline('Lit').play({ key: `${kit.drone}_spin`, startFrame: i }),
        glow: world.add.sprite(dx, dy, `${kit.drone}_e`, 'd0').setBlendMode(Phaser.BlendModes.ADD),
        zapT: 0,
      });
    }
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.heat.destroy();
      for (const d of this.drones) for (const o of [d.sprite, d.glow, d.shadow]) o.destroy();
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    this.clock += dt;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.sendT = Math.max(0, this.sendT - dt);
    this.posing = Math.max(0, this.posing - dt);
    this.gridCd = Math.max(0, this.gridCd - dt);
    this.heat.update(dt);
    const stalled = this.heat.overheated;
    const pressed = special && !this.prevSpecial;
    this.prevSpecial = special;

    if (!stalled) {
      if (pressed && this.gridCd === 0 && !this.grid) this.castGrid();
      else if (attack && this.sendT === 0) this.send();
    }
    if (this.grid) {
      this.gridT -= dt;
      if (this.gridT <= 0) this.endGrid();
    }

    const pace = this.kit.speed * (stalled ? 0.45 : this.posing > 0 ? 0.6 : 1);
    if (moving) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * pace * Math.min(1, len) * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * pace * Math.min(1, len) * (dt / 1000), bounds.top, bounds.bottom);
    }
    if (this.posing === 0) {
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    }
    this.updateDrones(dt);
    this.sync();
    this.updateHud();
  }

  // -------------------------------------------------------------------------
  // The drones' strikes

  /** Send the next drone at the best foe the way it aims (or, with the grid up, zap from its posts). */
  private send(): void {
    this.sendT = SEND_EVERY;
    if (this.grid) {
      this.postZap();
      return;
    }
    // The next drone still circling, in turn.
    let d: Drone | undefined;
    for (let k = 0; k < DRONES && !d; k++) {
      const c = this.drones[(this.next + k) % DRONES];
      if (c.state === 'orbit') d = c;
    }
    if (!d) return;
    this.next = (d.i + 1) % DRONES;
    const u = this.aimVec();
    const foe = this.pick(u);
    d.state = 'out';
    d.goal = foe ?? { x: this.x + u.x * DRONE_REACH, y: this.y + u.y * DRONE_REACH };
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_command_${this.dir}`, true);
    this.posing = 200;
    this.heat.add(SEND_HEAT);
  }

  /** A foe to send a drone at: the nearest the way it aims, else the nearest at all, within reach. */
  private pick(u: { x: number; y: number }): Hurtbox | null {
    const cx = this.x;
    const cy = this.y - SYNTH_CHEST_Y;
    let best: Hurtbox | null = null;
    let bestScore = Infinity;
    for (const h of this.world.hurtboxesWhere((b) => b.alive)) {
      const dx = h.x - cx;
      const dy = h.y - h.bodyY - cy;
      const d = Math.hypot(dx, dy);
      if (d > DRONE_RANGE) continue;
      const ahead = d > 0 && (dx * u.x + dy * u.y) / d >= DRONE_CONE;
      const score = d * (ahead ? 1 : 2.5);
      if (score < bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best;
  }

  /** With the grid up: each post drone zaps the nearest foe in its reach. */
  private postZap(): void {
    let any = false;
    for (const d of this.drones) {
      if (d.state !== 'post') continue;
      const near = this.world
        .hurtboxesWhere((h) => h.alive && Math.hypot(h.x - d.x, h.y - d.y) <= POST_REACH)
        .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
      if (!near) continue;
      this.zap(d, near);
      any = true;
    }
    if (any) {
      this.heat.add(SEND_HEAT);
      const u = this.aimVec();
      this.dir = dirOf(u.x, u.y);
      this.body.play(`${this.kit.key}_command_${this.dir}`, true);
      this.posing = 200;
    }
  }

  /** A drone jolts a foe: damage, a moment's slow, and a crack of light (or a sting) between them. */
  private zap(d: Drone, h: Hurtbox): void {
    const w = this.world;
    h.hurt({ damage: ZAP_DAMAGE * this.heat.power, heavy: false, knock: 35, fromX: d.x, fromY: d.y });
    h.slow?.(ZAP_SLOW, ZAP_SLOW_MS, this.kit.pal.mid);
    w.addEffect(new Zap(w, d.x, d.y - d.z, h.x, h.y - h.bodyY, this.kit.pal, this.kit.hive, h.y));
    sound.droneZap(w.pan(d.x), this.kit.hive);
  }

  private updateDrones(dt: number): void {
    const s = dt / 1000;
    const follow = 1 - Math.exp(-dt / 70);
    this.drones.forEach((d) => {
      if (d.state === 'orbit') {
        const a = this.clock * 0.0026 + (d.i / DRONES) * Math.PI * 2;
        const gx = this.x + Math.cos(a) * ORBIT_R;
        const gy = this.y + Math.sin(a) * ORBIT_R * 0.45;
        d.x += (gx - d.x) * follow;
        d.y += (gy - d.y) * follow;
        d.z += (ORBIT_H + Math.sin(this.clock * 0.004 + d.i * 2) * 1.5 - d.z) * follow;
      } else if (d.state === 'out') {
        const g = d.goal!;
        const foe = 'bodyY' in g;
        if (foe && !g.alive) {
          d.state = 'back';
        } else {
          const gz = foe ? g.bodyY : ORBIT_H;
          const dx = g.x - d.x;
          const dy = g.y - d.y;
          const dist = Math.hypot(dx, dy);
          const step = DRONE_SPEED * s;
          d.z += (gz - d.z) * follow;
          if (dist <= step + 4) {
            if (foe) this.zap(d, g);
            else this.world.debris(this.kit.pal.tints, d.x, d.y - d.z, 4, d.y + 10, 'spores');
            d.state = 'back';
          } else {
            d.x += (dx / dist) * step;
            d.y += (dy / dist) * step;
          }
        }
      } else if (d.state === 'back') {
        const a = this.clock * 0.0026 + (d.i / DRONES) * Math.PI * 2;
        const gx = this.x + Math.cos(a) * ORBIT_R;
        const gy = this.y + Math.sin(a) * ORBIT_R * 0.45;
        const dx = gx - d.x;
        const dy = gy - d.y;
        const dist = Math.hypot(dx, dy);
        const step = DRONE_SPEED * 1.1 * s;
        d.z += (ORBIT_H - d.z) * follow;
        if (dist <= step + 2) d.state = 'orbit';
        else {
          d.x += (dx / dist) * step;
          d.y += (dy / dist) * step;
        }
      } else if (d.state === 'post' && d.post) {
        const dx = d.post.x - d.x;
        const dy = d.post.y - d.y;
        const dist = Math.hypot(dx, dy);
        const step = DRONE_SPEED * 1.2 * s;
        if (dist <= step) {
          d.x = d.post.x;
          d.y = d.post.y;
        } else {
          d.x += (dx / dist) * step;
          d.y += (dy / dist) * step;
        }
        d.z += (POST_H + Math.sin(this.clock * 0.006 + d.i) - d.z) * follow;
      }
      const rx = snap(d.x);
      const ry = snap(d.y);
      const hy = snap(d.y - d.z);
      // In front of the hero while below them on screen, behind while above.
      d.sprite.setPosition(rx, hy).setDepth(ry + 0.2).setAlpha(this.alpha).setFlipX(d.x < this.x);
      d.glow.setPosition(rx, hy).setDepth(ry + 0.3).setFrame(d.sprite.frame.name).setFlipX(d.x < this.x).setAlpha(this.alpha);
      d.shadow.setPosition(rx, ry).setAlpha(0.45 * this.alpha);
    });
  }

  // -------------------------------------------------------------------------
  // The laser grid

  private castGrid(): void {
    const u = this.aimVec();
    const want = this.aim?.dist === undefined ? GRID_TOUCH : Phaser.Math.Clamp(this.aim.dist, GRID_MIN, GRID_MAX);
    // The spot on the ground; not past where the ground ends.
    let cx = this.x;
    let cy = this.y;
    for (let r = want; r >= 0; r -= 4) {
      cx = this.x + u.x * r;
      cy = this.y + u.y * r - (this.aim?.dist === undefined ? 0 : SYNTH_CHEST_Y * 0.5);
      if (this.world.walkable(cx, cy)) break;
    }
    const posts = [-90, 30, 150].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return { x: cx + Math.cos(a) * GRID_R, y: cy + Math.sin(a) * GRID_R * 0.7 };
    });
    this.drones.forEach((d, i) => {
      d.state = 'post';
      d.post = posts[i];
      d.goal = null;
      d.zapT = 0;
    });
    this.grid = new LaserGrid(this.world, this.drones, this.kit.pal, this.kit.hive);
    this.world.addEffect(this.grid);
    this.gridT = GRID_MS;
    this.gridCd = GRID_COOLDOWN;
    this.dir = dirOf(u.x, u.y);
    this.body.play(`${this.kit.key}_grid_${this.dir}`, true);
    this.posing = 360;
    this.heat.add(GRID_HEAT);
    sound.servo(this.world.pan(cx));
  }

  private endGrid(): void {
    this.grid?.destroy();
    this.grid = null;
    for (const d of this.drones) {
      d.state = 'back';
      d.post = null;
    }
  }

  // -------------------------------------------------------------------------

  private aimVec(): { x: number; y: number } {
    const a = this.aim ?? this.lastMove;
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  private updateHud(): void {
    beamHud.charge = this.grid ? clamp01(this.gridT / GRID_MS) : 1 - this.gridCd / GRID_COOLDOWN;
    beamHud.over = 0;
    beamHud.firing = !!this.grid;
    comboHud.hits = 0;
    comboHud.window = 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    const hot = this.heat.value / 100;
    const flush = hot > 0.7 && !this.heat.overheated ? 0.5 + 0.5 * Math.sin(this.clock * 0.02) : 0;
    if (!this.body.isTinted || this.body.tintTopLeft !== 0xff8070) this.body.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - flush * 70), Math.round(255 - flush * 90)));
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
    this.aura.setPosition(rx, ry - 18);
    this.aura.intensity = 0.55 * (1 - this.daylight);
  }
}

/** A drone's zap: a flickering crack of lightning (or, for the hive, a golden sting and a drip of honey). */
class Zap extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x0: number,
    private y0: number,
    private x1: number,
    private y1: number,
    private p: Pal,
    private hive: boolean,
    private ground: number,
  ) {
    super(world, 170);
    this.g = this.ink(Math.ceil(Math.abs(x1 - x0) + 12), Math.ceil(Math.abs(y1 - y0) + 12));
    world.debris(hive ? [0xfff0b0, 0xffb03a, 0xc86a0e] : p.tints, x1, y1, hive ? 5 : 4, ground + 12, hive ? 'spores' : 'burst');
  }

  protected step(): void {
    const { x0, y0, x1, y1, p, t } = this;
    const a = 1 - clamp01((t - 60) / 110);
    const g = this.g.begin((x0 + x1) / 2, (y0 + y1) / 2, Math.max(y0, this.ground) + 12);
    if (this.hive) {
      line(g, x0, y0, x1, y1, p.mid, a * 0.8);
      line(g, x0, y0 + 1, x1, y1 + 1, p.deep, a * 0.4);
      g.put(x1, y1, p.core, a);
    } else bolt(g, x0, y0, x1, y1, p, Math.floor(t / 40), a, 0.5);
    g.end();
  }
}

/**
 * The grid: lasers strung between the three post drones (a chain of
 * honeycomb for the hive), cutting and slowing whatever crosses them.
 */
class LaserGrid extends Fx {
  private g: Ink;
  private tickT = 0;
  private bounds = { x: 0, y: 0 };

  constructor(
    world: WorldScene,
    private drones: Drone[],
    private p: Pal,
    private hive: boolean,
  ) {
    super(world, GRID_MS + 400);
    this.g = this.ink(GRID_R * 2 + 40, GRID_R * 2 + 50);
  }

  /** The grid holds once its drones are near their posts. */
  private get up(): boolean {
    return this.drones.every((d) => d.post && Math.hypot(d.post.x - d.x, d.post.y - d.y) < 6);
  }

  protected step(dt: number): void {
    const posts = this.drones.map((d) => ({ x: d.x, y: d.y - d.z, gx: d.x, gy: d.y }));
    const cx = (posts[0].gx + posts[1].gx + posts[2].gx) / 3;
    const cy = (posts[0].gy + posts[1].gy + posts[2].gy) / 3;
    this.bounds = { x: cx, y: cy };
    const g = this.g.begin(cx, cy - POST_H, cy + GRID_R);
    const up = this.up;
    const a = up ? 0.85 + 0.15 * Math.sin(this.t * 0.03) : 0.3;
    for (let i = 0; i < 3; i++) {
      const s = posts[i];
      const e = posts[(i + 1) % 3];
      if (this.hive) this.comb(g, s.x, s.y, e.x, e.y, a);
      else {
        line(g, s.x, s.y, e.x, e.y, this.p.hot, a);
        // A flickering glow either side of the beam.
        if (up) {
          const n = Math.ceil(Math.hypot(e.x - s.x, e.y - s.y));
          for (let k = 0; k <= n; k += 2) {
            const q = k / n;
            if ((k + Math.floor(this.t / 50)) % 3 !== 0) continue;
            g.put(s.x + (e.x - s.x) * q, s.y + (e.y - s.y) * q - 1, this.p.mid, a * 0.5);
            g.put(s.x + (e.x - s.x) * q, s.y + (e.y - s.y) * q + 1, this.p.deep, a * 0.4);
          }
        }
      }
    }
    g.end();
    if (!up) return;
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = GRID_TICK;
    const w = this.world;
    const cut = w.hurtboxesWhere((h) => {
      if (!h.alive) return false;
      for (let i = 0; i < 3; i++) {
        const s = posts[i];
        const e = posts[(i + 1) % 3];
        if (segDist(h.x, h.y, s.gx, s.gy, e.gx, e.gy) <= h.radius + 3) return true;
      }
      return false;
    });
    for (const h of cut) {
      h.hurt({ damage: GRID_DAMAGE, heavy: false, knock: 20, fromX: this.bounds.x, fromY: this.bounds.y });
      h.slow?.(GRID_SLOW, GRID_TICK + 150, this.p.mid);
      w.debris(this.hive ? [0xfff0b0, 0xffb03a] : this.p.tints, h.x, h.y - h.bodyY, 3, h.y + 10, 'spores');
    }
    if (cut.length) sound.droneZap(w.pan(this.bounds.x), this.hive);
  }

  /** A chain of little hexagons from one post to the next, the cells filled with honey light. */
  private comb(g: Ink, x0: number, y0: number, x1: number, y1: number, a: number): void {
    const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 5));
    for (let k = 0; k <= n; k++) {
      const q = k / n;
      const x = x0 + (x1 - x0) * q;
      const y = y0 + (y1 - y0) * q;
      for (let s = 0; s < 6; s++) {
        const u = (s / 6) * Math.PI * 2;
        const v = ((s + 1) / 6) * Math.PI * 2;
        line(g, x + Math.cos(u) * 2.6, y + Math.sin(u) * 2.6, x + Math.cos(v) * 2.6, y + Math.sin(v) * 2.6, this.p.mid, a);
      }
      if ((k + Math.floor(this.t / 120)) % 2 === 0) g.put(x, y, this.p.hot, a * 0.6);
    }
  }
}
