import Phaser from 'phaser';
import type { Effect } from './Slash';
import type { Hurtbox } from './combat';
import { BIRD_CX, BIRD_CY, BIRD_FLAP, BIRD_H, BIRD_W } from '../art/falconer';
import { Ink } from './ultimate/ink';
import { snap } from './display';
import { sound } from '../audio';
import type { WorldScene } from '../scenes/WorldScene';

// The falconer's birds: the falcon (or Berkut's golden eagle) in flight, the
// hawks of her Special, the hunter's mark left on what they raked, and the
// feathers they shed. A bird flies at a height `z` over a ground point; it is
// drawn z px higher, its shadow lies on the ground under it and shrinks and
// fades as it climbs.

/** Its sheet's frame size, and where the body's middle sits in it. */
const OX = BIRD_CX / BIRD_W;
const OY = BIRD_CY / BIRD_H;
/** Wingbeats a second, flapping. */
const FLAP_FPS = 15;

/** One bird on the wing: its sprite (lit), and its shadow on the ground. */
export class BirdSprite {
  readonly body: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Sprite;
  private flapT = Math.random() * 1000;
  private faceRight = true;

  constructor(
    world: WorldScene,
    readonly key: string,
  ) {
    this.body = world.add.sprite(0, 0, key, 'f0').setOrigin(OX, OY).setPipeline('Lit');
    // The shadow is the bird's own silhouette laid flat on the ground.
    this.shade = world.add.sprite(0, 0, `${key}_s`, 'f0').setOrigin(OX, OY).setDepth(2).setTint(0x000000);
  }

  /** Over the ground point (x, y), z px up, facing right or left, its frame. */
  place(x: number, y: number, z: number, frame: string, faceRight = this.faceRight, alpha = 1): void {
    this.faceRight = faceRight;
    const rx = snap(x);
    const ry = snap(y - z);
    this.body.setFrame(frame).setPosition(rx, ry).setDepth(y + z * 0.5 + 6).setFlipX(!faceRight).setAlpha(alpha);
    const k = Math.max(0, 1 - z / 120);
    this.shade
      .setFrame(frame)
      .setPosition(snap(x), snap(y))
      .setFlipX(!faceRight)
      .setScale(0.5 + 0.5 * k, 0.3 + 0.2 * k)
      .setAlpha(0.32 * k * alpha);
  }

  /** The flap cycle's frame for this moment (beats faster when `hard`). */
  flap(dt: number, hard = false): string {
    this.flapT += dt * (hard ? 1.5 : 1);
    return `f${Math.floor((this.flapT * FLAP_FPS) / 1000) % BIRD_FLAP}`;
  }

  destroy(): void {
    this.body.destroy();
    this.shade.destroy();
  }
}

/**
 * Feathers knocked loose: each tumbles down from where it came off, rocking
 * side to side as it drifts, lies a moment on the ground, then fades.
 */
export class Feathers implements Effect {
  dead = false;
  private ink: Ink;
  private t = 0;
  private bits: { x: number; y: number; z: number; vx: number; vy: number; ph: number; c: number; d: number; landed: number }[] = [];
  private static readonly SIZE = 72;
  private static readonly LIFE = 2200;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    z: number,
    n: number,
    private cols: number[],
  ) {
    this.ink = new Ink(world, Feathers.SIZE, Feathers.SIZE + 40);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 10 + Math.random() * 22;
      this.bits.push({ x: 0, y: 0, z: z + Math.random() * 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, ph: Math.random() * 6, c: i % cols.length, d: 0, landed: -1 });
    }
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const s = dt / 1000;
    const g = this.ink.begin(this.x, this.y - 20, this.y + 4);
    for (const b of this.bits) {
      if (b.landed < 0) {
        b.vx *= 1 - s * 2.5;
        b.vy *= 1 - s * 2.5;
        b.x += b.vx * s + Math.sin(this.t * 0.008 + b.ph) * 0.35;
        b.y += b.vy * s;
        b.z = Math.max(0, b.z - s * 16);
        if (b.z <= 0) b.landed = this.t;
      }
      const fade = b.landed < 0 ? 1 : 1 - (this.t - b.landed) / 700;
      if (fade <= 0) continue;
      // A feather is two pixels across its tilt, its quill a shade lighter; it rocks as it falls.
      const rock = b.landed < 0 ? Math.sin(this.t * 0.012 + b.ph) : 0.6;
      const px = this.x + b.x;
      const py = this.y + b.y - b.z;
      const c0 = this.cols[b.c];
      const c1 = this.cols[(b.c + 1) % this.cols.length];
      g.put(px, py, c0, fade);
      g.put(px + (rock > 0 ? 1 : -1), py + (Math.abs(rock) < 0.5 ? 0 : 1), c1, fade);
      if (Math.abs(rock) < 0.5) g.put(px - (rock > 0 ? 1 : -1), py, c1, fade * 0.8);
    }
    g.end();
    if (this.t >= Feathers.LIFE) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ink.destroy();
  }
}

/** Three talon rakes torn across a foe, fading fast. */
export class Rake implements Effect {
  dead = false;
  private ink: Ink;
  private t = 0;
  private static readonly LIFE = 200;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    depth: number,
    private dir: number,
    private cols: [number, number, number],
  ) {
    this.ink = new Ink(world, 24, 24);
    this.ink.begin(x, y, depth);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const k = this.t / Rake.LIFE;
    const g = this.ink.begin(this.x, this.y, this.ink.image.depth);
    // The claws drawn through in the first third, then the marks fade.
    const len = Math.min(1, k * 3);
    for (let i = -1; i <= 1; i++) {
      for (let s = 0; s <= 1; s += 0.08) {
        if (s > len) break;
        const u = s * 2 - 1;
        const x = this.x + this.dir * (u * 6 + i * 1.6) + i * 1.2;
        const y = this.y + u * 6 * 0.75 - i * 2.4;
        const c = s > len - 0.15 && k < 0.4 ? this.cols[0] : Math.abs(u) < 0.6 ? this.cols[1] : this.cols[2];
        g.put(x, y, c, 1 - Math.max(0, k - 0.35) / 0.65);
      }
    }
    g.end();
    if (this.t >= Rake.LIFE) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.ink.destroy();
  }
}

/** How long a mark lasts, and the bonus her arrows take from it. */
export const MARK_MS = 3500;
export const MARK_BONUS = 1.4;

/**
 * The hunter's mark: what the falcon (or the hawks) raked is marked for a
 * while, a feather-shaped chevron turning over its head; her arrows strike it
 * harder. One per falconer, drawn on one canvas per marked foe.
 */
export class HuntMarks {
  private marks = new Map<Hurtbox, { left: number; ink: Ink }>();
  private t = 0;

  constructor(
    private world: WorldScene,
    private cols: [number, number, number],
  ) {
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  mark(h: Hurtbox, ms = MARK_MS): void {
    const m = this.marks.get(h);
    if (m) m.left = Math.max(m.left, ms);
    else this.marks.set(h, { left: ms, ink: new Ink(this.world, 11, 9) });
  }

  marked(h: Hurtbox): boolean {
    return this.marks.has(h);
  }

  update(dt: number): void {
    this.t += dt;
    for (const [h, m] of this.marks) {
      m.left -= dt;
      if (m.left <= 0 || !h.alive) {
        m.ink.destroy();
        this.marks.delete(h);
        continue;
      }
      // Over the head, bobbing; it blinks as it runs out.
      const top = h.y - h.bodyY * 2 - 6 + Math.round(Math.sin(this.t * 0.006) * 1);
      const a = m.left < 700 ? (Math.floor(m.left / 90) % 2 ? 1 : 0.35) : 1;
      const g = m.ink.begin(h.x, top, h.y + 30);
      const [hot, mid, deep] = this.cols;
      // A falcon's stoop in five strokes: a downward chevron with a dot under it.
      const cx = h.x;
      const cy = top - 1;
      for (let i = 0; i <= 3; i++) {
        g.put(cx - 4 + i, cy - 2 + i, i === 3 ? hot : mid, a);
        g.put(cx + 4 - i, cy - 2 + i, i === 3 ? hot : mid, a);
        g.put(cx - 4 + i, cy - 3 + i, deep, a * 0.8);
        g.put(cx + 4 - i, cy - 3 + i, deep, a * 0.8);
      }
      g.put(cx, cy + 1, hot, a);
      g.put(cx, cy + 3, mid, a);
      m.ink.end();
    }
  }

  clear(): void {
    for (const m of this.marks.values()) m.ink.destroy();
    this.marks.clear();
  }
}

/** The colours a falcon's moves are drawn in. */
export interface FalconStyle {
  /** Bird sheet: 'bird_falcon' or 'bird_eagle'. */
  bird: string;
  /** The golden eagle: a deeper cry, heavier wingbeats. */
  eagle: boolean;
  /** Feathers it sheds, light to dark. */
  feathers: number[];
  /** Its rakes and marks, bright to deep. */
  claw: [number, number, number];
  light: number;
}

/** Falcon strike: how it flies and how hard it rakes. */
const FLY_SPEED = 230;
const HOME_SPEED = 270;
const CRUISE_Z = 28;
const STOOP_MS = 170;
const RAKES = 3;
const RAKE_EVERY = 170;
const RAKE_DAMAGE = 6;
/** With nothing to hunt, it flies out to the spot, wheels round it once, and comes back. */
const WHEEL_MS = 700;
const WHEEL_R = 14;

type Phase = 'out' | 'stoop' | 'rake' | 'wheel' | 'home';

/**
 * The falcon cast off her fist: it climbs and flies to its quarry, stoops
 * onto it, hangs over it beating its wings and rakes it three times with its
 * talons, marking it, then flies back to her shoulder. A quarry that falls
 * before it's raked is traded for the nearest other; with none it wheels
 * over the spot and comes home.
 */
export class FalconStrike implements Effect {
  dead = false;
  private bird: BirdSprite;
  private phase: Phase;
  private x: number;
  private y: number;
  private z = 20;
  private t = 0;
  private rakes = 0;
  private faceRight: boolean;
  private stoopFrom = { x: 0, y: 0, z: 0 };

  constructor(
    private world: WorldScene,
    x: number,
    y: number,
    private prey: Hurtbox | null,
    private spot: { x: number; y: number },
    private style: FalconStyle,
    private marks: HuntMarks,
    /** Where she is now (it flies home to her). */
    private home: () => { x: number; y: number },
    /** Called once it's back on her shoulder (or called back). */
    private landed: () => void,
    /** Scales every rake (the world sets the hero's Damage on blows; this is only the code's own number). */
    private damage = RAKE_DAMAGE,
  ) {
    this.x = x;
    this.y = y;
    this.phase = prey ? 'out' : 'wheel';
    this.faceRight = (prey?.x ?? spot.x) >= x;
    this.bird = new BirdSprite(world, style.bird);
    sound.wings(world.pan(x), style.eagle ? 1 : 2);
    sound.falconCall(world.pan(x), style.eagle);
    this.draw('f0');
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const w = this.world;
    // Quarry gone before it was raked: the nearest other in reach, or home.
    if (this.prey && !this.prey.alive && (this.phase === 'out' || this.phase === 'stoop')) {
      this.prey = w.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - this.x, h.y - this.y) < 90).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0] ?? null;
      if (!this.prey) this.goHome();
      else this.phase = 'out';
    }
    switch (this.phase) {
      case 'out': {
        const p = this.prey!;
        const tx = p.x - (this.faceRight ? 8 : -8);
        const ty = p.y;
        const d = Math.hypot(tx - this.x, ty - this.y);
        this.steer(tx, ty, FLY_SPEED, dt);
        this.z += (CRUISE_Z - this.z) * Math.min(1, dt / 160);
        if (d < 26) {
          this.phase = 'stoop';
          this.t = 0;
          this.stoopFrom = { x: this.x, y: this.y, z: this.z };
          sound.screech(w.pan(this.x));
        }
        this.draw(this.bird.flap(dt, true));
        break;
      }
      case 'stoop': {
        const p = this.prey!;
        const k = Math.min(1, this.t / STOOP_MS);
        const e = k * k;
        const tx = p.x - (this.faceRight ? 5 : -5);
        this.x = this.stoopFrom.x + (tx - this.stoopFrom.x) * e;
        this.y = this.stoopFrom.y + (p.y - this.stoopFrom.y) * e;
        this.z = this.stoopFrom.z + (p.bodyY + 4 - this.stoopFrom.z) * e;
        this.draw(this.t < STOOP_MS / 2 ? 'd0' : 'd1');
        if (k >= 1) {
          this.phase = 'rake';
          this.t = RAKE_EVERY;
          this.rakes = 0;
        }
        break;
      }
      case 'rake': {
        const p = this.prey;
        if (p) {
          this.x += (p.x - (this.faceRight ? 5 : -5) - this.x) * Math.min(1, dt / 60);
          this.y += (p.y - this.y) * Math.min(1, dt / 60);
          this.z = p.bodyY + 4 + Math.sin(this.t * 0.03) * 1.5;
        }
        // The strike frames turn over with the beats; a rake lands on each one.
        if (this.t >= RAKE_EVERY) {
          this.t -= RAKE_EVERY;
          if (p && p.alive && this.rakes < RAKES) this.rake(p);
          else {
            this.goHome();
            break;
          }
        }
        this.draw(`k${Math.min(3, Math.floor((this.t / RAKE_EVERY) * 4))}`);
        break;
      }
      case 'wheel': {
        // Out to the spot, then once round it, gliding.
        const d = Math.hypot(this.spot.x - this.x, this.spot.y - this.y);
        if (this.t < 2000 && d > WHEEL_R + 2 && this.rakes === 0) {
          this.steer(this.spot.x, this.spot.y, FLY_SPEED, dt);
          this.z += (CRUISE_Z + 6 - this.z) * Math.min(1, dt / 200);
          this.draw(this.bird.flap(dt));
          this.t = Math.min(this.t, 1999);
          break;
        }
        if (this.rakes === 0) {
          this.rakes = -1;
          this.t = 0;
        }
        const a = (this.t / WHEEL_MS) * Math.PI * 2;
        const nx = this.spot.x + Math.sin(a) * WHEEL_R;
        const ny = this.spot.y - (1 - Math.cos(a)) * WHEEL_R * 0.5;
        this.faceRight = nx >= this.x;
        this.x = nx;
        this.y = ny;
        // A foe straying under it is taken.
        const seen = w.firstHurtbox((h) => h.alive && Math.hypot(h.x - this.x, h.y - this.y) < 40);
        if (seen) {
          this.prey = seen;
          this.phase = 'out';
          break;
        }
        this.draw(Math.floor(this.t / 180) % 3 === 2 ? this.bird.flap(dt) : 'g0');
        if (this.t >= WHEEL_MS) this.goHome();
        break;
      }
      case 'home': {
        const h = this.home();
        const d = Math.hypot(h.x - this.x, h.y - this.y);
        this.steer(h.x, h.y, HOME_SPEED, dt);
        this.z += (18 - this.z) * Math.min(1, dt / 200);
        this.draw(d < 30 ? 'g1' : this.bird.flap(dt));
        if (d < 6 || this.t > 4000) this.land();
        break;
      }
    }
  }

  /** Back on her shoulder at once (she whistled it in): a flurry of feathers where it was. */
  recall(): void {
    if (this.dead) return;
    this.world.addEffect(new Feathers(this.world, this.x, this.y, this.z, 3, this.style.feathers));
    this.land();
  }

  private land(): void {
    sound.wings(this.world.pan(this.x), 1, true);
    this.landed();
    this.destroy();
  }

  private goHome(): void {
    this.phase = 'home';
    this.t = 0;
    this.prey = null;
  }

  /** Flies toward (tx, ty) at `speed`, turning to face the way it goes. */
  private steer(tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const s = Math.min(d, (speed * dt) / 1000);
    this.x += (dx / d) * s;
    this.y += (dy / d) * s;
    if (Math.abs(dx) > 2) this.faceRight = dx > 0;
  }

  private rake(p: Hurtbox): void {
    const w = this.world;
    this.rakes++;
    const dir = this.faceRight ? 1 : -1;
    p.hurt({ damage: this.damage, heavy: this.rakes === RAKES, knock: this.rakes === RAKES ? 70 : 15, fromX: this.x - dir * 6, fromY: p.y });
    this.marks.mark(p);
    const by = p.y - p.bodyY;
    w.addEffect(new Rake(w, p.x, by, p.y + 20, dir, this.style.claw));
    w.debris([0xffffff, this.style.claw[0], this.style.claw[1]], snap(p.x), snap(by), 5, p.y + 20);
    w.addEffect(new Feathers(w, p.x, p.y, p.bodyY + 4, 2, this.style.feathers));
    sound.rake(w.pan(p.x), this.rakes === RAKES);
    if (this.rakes === RAKES) w.cameras.main.shake(60, 0.0012);
    if (this.rakes >= RAKES) this.t = RAKE_EVERY * 0.5;
  }

  private draw(frame: string): void {
    this.bird.place(this.x, this.y, this.z, frame, this.faceRight);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.bird.destroy();
  }
}
