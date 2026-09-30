import Phaser from 'phaser';
import { BEAST_HAND_Y, BEAST_TIMING, FEATHER_DIRS } from '../art/beast';
import { snap } from './display';
import { sound } from '../audio';
import { inFlight, type Hurtbox } from './combat';
import { HitSpark, type Effect } from './Slash';
import { clamp01, Fx, pal, type Ink, type Pal } from './ultimate/ink';
import { Beast, type BeastKit } from './Beast';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Eagle (the Beastkin's first type): a sky warrior, quick on his feet.
//  - Attack (held): Razor feathers. He flings a fan of three feathers from
//    one hand then the other; the middle one cuts deepest.
//  - Ability: Gale. His wings beat down in a great gust that hurls foes
//    back, and the beat lifts him a few paces away from them.
//  - Special: Sky Sovereign (see ultimate/beast.ts). A giant spirit eagle
//    swoops down the way he aims, talons raking, wheels and swoops back.

const FLING_MS = BEAST_TIMING.fling.ms;
const FLING_LAND = BEAST_TIMING.fling.land;
const FEATHER_SPEED = 280;
const FEATHER_RANGE = 130;
/** Flight height of the feathers above the ground. */
const FEATHER_H = 14;
/** The fan's half-angle, and each feather's cut (the middle one's, then the sides'). */
const FAN = (9 * Math.PI) / 180;
const MID_DAMAGE = 5;
const SIDE_DAMAGE = 3;

const GUST_MS = BEAST_TIMING.gust.ms;
const GUST_LAND = BEAST_TIMING.gust.land;
const GUST_COOLDOWN = 6000;
const GUST_REACH = 58;
const GUST_SPREAD = (55 * Math.PI) / 180;
const GUST_DAMAGE = 8;
const GUST_KNOCK = 260;
/** The beat carries him back this far, over this long. */
const HOP = 34;
const HOP_MS = 220;

const eagleStats = HERO_STATS['beast.eagle'];

export const EAGLE_KIT: BeastKit = {
  key: 'eagle',
  kind: 'eagle',
  maxHp: eagleStats.hp,
  speed: eagleStats.speed,
  pal: pal(0xffffff, 0xd8f4ff, 0x6ec8f0, 0x2a6ab0, 0xa8e0ff),
  fx: { core: 0xffffff, hot: 0xd8f4ff, mid: 0x6ec8f0, deep: 0x2a6ab0, light: 0xa8e0ff },
  club: false,
};

/** Benfica: the same eagle in red and white, his wings gilded, his feathers red. */
export const BENFICA_KIT: BeastKit = {
  ...EAGLE_KIT,
  key: 'eagle_benfica',
  pal: pal(0xffffff, 0xffd6d0, 0xff4040, 0xa00818, 0xff6a50),
  fx: { core: 0xffffff, hot: 0xffd6d0, mid: 0xff4040, deep: 0xa00818, light: 0xff6a50 },
  club: true,
};

export class Eagle extends Beast {
  private hand = 0;
  private gustCd = 0;
  private hopT = -1;
  private hopDir = { x: 0, y: 0 };

  constructor(world: WorldScene, x: number, y: number, kit: BeastKit = EAGLE_KIT) {
    super(world, x, y, kit);
  }

  protected tick(dt: number): void {
    this.gustCd = Math.max(0, this.gustCd - dt);
    // The beat's lift carries him back, easing out.
    if (this.hopT >= 0) {
      const before = this.hopT;
      this.hopT += dt;
      const k = (t: number) => 1 - Math.pow(1 - clamp01(t / HOP_MS), 2);
      this.shove(this.hopDir.x, this.hopDir.y, HOP * (k(this.hopT) - k(before)));
      if (this.hopT >= HOP_MS) this.hopT = -1;
    }
  }

  protected attack(): void {
    this.hand = 1 - this.hand;
    this.begin('fling', this.hand ? 'fling' : 'fling2', FLING_MS, FLING_LAND);
  }

  protected ability(): void {
    if (this.gustCd > 0) return;
    this.gustCd = GUST_COOLDOWN;
    this.begin('gust', 'gust', GUST_MS, GUST_LAND);
    sound.screech(this.world.pan(this.x));
  }

  protected paceIn(move: string): number {
    return move === 'gust' ? 0 : 0.6;
  }

  protected readiness(): number {
    return 1 - this.gustCd / GUST_COOLDOWN;
  }

  protected lampLevel(): number {
    return this.move ? 0.5 : 0;
  }

  protected land(move: string): void {
    if (move === 'fling') this.throwFeathers();
    else this.beat();
  }

  /** Three feathers leave the hand in a fan. */
  private throwFeathers(): void {
    const u = this.aimVec();
    const a = Math.atan2(u.y, u.x);
    // From the throwing hand, a little ahead of the body.
    const side = this.hand ? 1 : -1;
    const sx = this.x + u.x * 5 - u.y * side * 3;
    const sy = this.y + u.y * 3 + u.x * side * 1.5;
    for (const k of [-1, 0, 1]) {
      const ang = a + k * FAN;
      const f = new Feather(this.world, sx, sy, Math.cos(ang), Math.sin(ang), k === 0 ? MID_DAMAGE : SIDE_DAMAGE, this.kit);
      this.fx.push(f);
    }
    sound.feather(this.world.pan(this.x));
  }

  /** The wings come down: a gust that hurls foes back, and the beat lifts him away. */
  private beat(): void {
    const w = this.world;
    const u = this.aimVec();
    const hits = w.melee(
      { kind: 'arc', x: this.x, y: this.y - 8, radius: GUST_REACH, angle: Math.atan2(u.y, u.x), spread: GUST_SPREAD },
      { damage: GUST_DAMAGE, heavy: true, knock: GUST_KNOCK, fromX: this.x, fromY: this.y },
    );
    for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, this.kit.fx, h.y + 13, false));
    this.fx.push(new Gale(w, this.x, this.y, u.x, u.y, this.kit.pal));
    w.debris(this.kit.club ? [0xde2230, 0xffffff, 0xdab058] : [0x7a5229, 0xa07642, 0xf4f6fc], this.x, this.y - 12, 10, this.y + 4, 'burst');
    sound.gust(w.pan(this.x));
    this.hopT = 0;
    this.hopDir = { x: -u.x, y: -u.y };
    w.evade(HOP_MS + 120);
  }
}

// ---------------------------------------------------------------------------

/**
 * A razor feather: it flies FEATHER_H px up, spinning a little in its
 * heading, and cuts the first body in its path; spent, it fades as it drifts.
 */
export class Feather implements Effect {
  dead = false;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Image;
  private travelled = 0;
  private trailT = 0;
  private fade = -1;
  private readonly inPath = (h: Hurtbox) => inFlight(h, this.x, this.y, FEATHER_H, 1.5);

  constructor(
    private world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private damage: number,
    private kit: BeastKit,
  ) {
    const key = `feather_${kit.key}`;
    const frame = featherFrame(ux, uy);
    this.sprite = world.add.sprite(x, y - FEATHER_H, key, frame).setPipeline('Lit');
    this.glow = world.add.sprite(x, y - FEATHER_H, `${key}_e`, frame).setBlendMode(Phaser.BlendModes.ADD);
    this.shade = world.add.image(x, y, 'shadow').setDepth(1).setScale(0.35, 0.28).setAlpha(0.3);
    this.place();
  }

  update(dt: number): void {
    if (this.dead) return;
    if (this.fade >= 0) {
      this.fade += dt;
      const a = 1 - this.fade / 260;
      this.x += this.ux * dt * 0.04;
      this.y += this.uy * dt * 0.04 + dt * 0.02;
      this.sprite.setAlpha(a);
      this.glow.setAlpha(a);
      this.shade.setAlpha(0.3 * a);
      this.place();
      if (a <= 0) this.destroy();
      return;
    }
    let move = (FEATHER_SPEED * dt) / 1000;
    while (move > 0) {
      const d = Math.min(3, move);
      move -= d;
      this.x += this.ux * d;
      this.y += this.uy * d;
      this.travelled += d;
      if (!this.world.walkable(this.x, this.y) && this.travelled > 20) {
        this.fade = 0;
        return;
      }
      const h = this.world.firstHurtbox(this.inPath);
      if (h) {
        this.cut(h);
        return;
      }
      if (this.travelled >= FEATHER_RANGE) {
        this.fade = 0;
        return;
      }
    }
    this.place();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 45;
      const p = this.kit.pal;
      this.world.debris([p.hot, p.mid], snap(this.x - this.ux * 4), snap(this.y - FEATHER_H - this.uy * 4), 1, this.y, 'trail');
    }
  }

  private cut(h: Hurtbox): void {
    const w = this.world;
    const bx = h.x - this.ux * (h.radius - 1);
    const by = h.y - h.bodyY;
    h.hurt({ damage: this.damage, heavy: false, knock: 50, fromX: this.x - this.ux * 6, fromY: this.y - this.uy * 6 });
    w.addEffect(new HitSpark(w, bx, by, this.kit.fx, h.y + 13, false));
    sound.arrowHit(w.pan(bx), false);
    this.destroy();
  }

  private place(): void {
    const x = snap(this.x);
    const y = snap(this.y - FEATHER_H);
    this.sprite.setPosition(x, y).setDepth(this.y + 1);
    this.glow.setPosition(x, y).setDepth(this.y + 1.1);
    this.shade.setPosition(snap(this.x), snap(this.y));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.glow.destroy();
    this.shade.destroy();
  }
}

/** The feather frame for a heading. */
function featherFrame(ux: number, uy: number): string {
  const i = Math.round((Math.atan2(uy, ux) / (Math.PI * 2)) * FEATHER_DIRS);
  return `r${((i % FEATHER_DIRS) + FEATHER_DIRS) % FEATHER_DIRS}`;
}

/**
 * The gust: streaks of wind racing out in a cone from the wings, curling at
 * their ends, and loose feathers of light tumbling along with them.
 */
class Gale extends Fx {
  private g: Ink;
  private streaks: { a: number; r0: number; speed: number; curl: number }[] = [];

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private ux: number,
    private uy: number,
    private p: Pal,
  ) {
    super(world, 380);
    this.g = this.ink(GUST_REACH * 2 + 30, GUST_REACH * 2 + 30);
    const a0 = Math.atan2(uy, ux);
    for (let i = 0; i < 11; i++) {
      this.streaks.push({ a: a0 + (Math.random() * 2 - 1) * GUST_SPREAD * 0.9, r0: 4 + Math.random() * 8, speed: 0.17 + Math.random() * 0.08, curl: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random()) });
    }
  }

  protected step(): void {
    const { p } = this;
    const cx = this.x;
    const cy = this.y - BEAST_HAND_Y * 0.5;
    const g = this.g.begin(cx, cy, this.y + 20);
    const fade = 1 - clamp01((this.t - 200) / 180);
    for (const s of this.streaks) {
      const head = s.r0 + this.t * s.speed;
      const tail = Math.max(s.r0, head - 18);
      for (let r = tail; r <= Math.min(head, GUST_REACH + 8); r += 0.8) {
        const f = (r - tail) / Math.max(1, head - tail);
        const bend = s.curl * Math.pow(r / GUST_REACH, 2) * 0.35;
        const a = s.a + bend;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.75;
        g.put(px, py, f > 0.85 ? p.core : f > 0.5 ? p.hot : p.mid, fade * (0.35 + 0.65 * f));
      }
    }
    // The first instant: a pale flash of air pushed off the wings.
    if (this.t < 90) {
      for (let i = -6; i <= 6; i++) {
        const a = Math.atan2(this.uy, this.ux) + (i / 6) * GUST_SPREAD;
        g.put(cx + Math.cos(a) * 12, cy + Math.sin(a) * 9, p.core, 1 - this.t / 90);
      }
    }
    g.end();
  }
}
