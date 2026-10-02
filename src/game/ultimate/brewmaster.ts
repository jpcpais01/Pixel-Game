import Phaser from 'phaser';
import { sound } from '../../audio';
import { BREW_LOOK, JARL_LOOK, KEG_FOOT, KEG_R, KEG_SIZE, kegFrameName, kegKey } from '../../art/brewmaster';
import type { Hurtbox } from '../combat';
import { HitSpark, Shockwave, type Effect } from '../Slash';
import { FoamSplash, type Froth } from '../BrewFx';
import { bloom, clamp01, flare, Fx, hash, strikeGround, type Ink } from './ink';
import type { Cast } from './types';

// Rolling Thunder, the Brewmaster's Special: he hoists a huge keg over his
// head and bowls it along the aim. It rolls away gathering speed, rumbling
// and hopping over the ground, bowling aside every foe it meets and leaving
// a trail of froth; at the end of its run (or against a wall) it bursts in a
// foamy blast that knocks everything near off its feet and leaves them
// reeling, drunk on the spray, while the suds fizz away.

/** Drawn this many times its size: a great keg, half as tall as he is again. */
const KEG_SCALE = 2;
const START_SPEED = 70;
const TOP_SPEED = 200;
/** How fast it gathers speed, px/s². */
const ACCEL = 380;
/** How far it rolls before it bursts. */
const RANGE = 170;
/** Where it sets off, ahead of his feet. */
const START_AHEAD = 12;
/** Foes within this of its middle (plus their own size) are bowled over, once each. */
const HIT_R = KEG_R * KEG_SCALE + 2;
const ROLL_DAMAGE = 24;
const ROLL_KNOCK = 190;
const BURST_R = 42;
const BURST_DAMAGE = 36;
const BURST_KNOCK = 170;
/** Foes caught in the blast reel, slowed to this pace, for this long. */
const DRUNK_PACE = 0.6;
const DRUNK_MS = 2200;
/** How long the froth trail and the suds of the blast last. */
const TRAIL_MS = 900;
const SUDS_MS = 1600;
/** Room round its path for the trail and the suds. */
const MARGIN = BURST_R + 14;

/** The keg's wood, for the splinters. */
const OAK_TINTS = [0xc4925a, 0x9c6a38, 0x764a24, 0x4e2e16];
const HONEY_OAK_TINTS = [0xd8a456, 0xb47c34, 0x8a5620, 0x5e3812];

export function rollingThunder(c: Cast): void {
  c.world.addEffect(new RollingThunder(c));
}

class RollingThunder extends Fx {
  private keg: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private shade: Phaser.GameObjects.Image;
  private g: Ink;
  private x: number;
  private y: number;
  private readonly dx: number;
  private readonly dy: number;
  private speed = START_SPEED;
  private dist = 0;
  private turns = 0;
  private burstAt = -1;
  private bx = 0;
  private by = 0;
  private struck = new Set<Hurtbox>();
  private trail: { x: number; y: number; t: number; s: number }[] = [];
  private fx: Effect[] = [];
  private froth: Froth;
  private wood: number[];
  private lamp: Phaser.GameObjects.Light;

  constructor(private c: Cast) {
    super(c.world, 8000);
    const l = Math.hypot(c.dx, c.dy) || 1;
    this.dx = c.dx / l;
    this.dy = c.dy / l;
    this.x = c.x + this.dx * START_AHEAD;
    this.y = c.y + this.dy * START_AHEAD * 0.7;
    const look = c.look === 'jarl' ? JARL_LOOK : BREW_LOOK;
    const key = kegKey(look);
    const frame = kegFrameName(this.dx, this.dy, 0);
    const oy = KEG_FOOT / KEG_SIZE;
    this.shade = this.own(c.world.add.image(this.x, this.y, 'shadow').setScale(2.2, 1.6).setDepth(1).setAlpha(0.8));
    this.keg = this.own(c.world.add.sprite(this.x, this.y, key, frame).setOrigin(0.5, oy).setScale(KEG_SCALE).setPipeline('Lit'));
    this.glow = this.own(c.world.add.sprite(this.x, this.y, `${key}_e`, frame).setOrigin(0.5, oy).setScale(KEG_SCALE).setBlendMode(Phaser.BlendModes.ADD));
    this.froth = look.jarl ? { light: 0xfffbe6, mid: 0xffe69a, deep: 0xe0a830, glint: 0xffffff } : { light: 0xfffcf0, mid: 0xf0e2bc, deep: 0xc8a870, glint: 0xffffff };
    this.wood = look.jarl ? HONEY_OAK_TINTS : OAK_TINTS;
    // The trail's canvas spans the whole run, with room for the suds at its end.
    const w = Math.abs(this.dx) * RANGE + MARGIN * 2;
    const h = Math.abs(this.dy) * RANGE + MARGIN * 2;
    this.g = this.ink(Math.ceil(w), Math.ceil(h));
    this.lamp = this.light(this.x, this.y, 70, c.pal.light, 0);
    sound.kegRoll(c.world.pan(this.x));
  }

  protected step(dt: number): void {
    const s = dt / 1000;
    for (const e of this.fx) e.update(dt);
    this.fx = this.fx.filter((e) => !e.dead);
    if (this.burstAt < 0) this.roll(s);
    this.draw();
  }

  /** Rolling on: speed gathered, ground checked ahead, foes in the way bowled aside. */
  private roll(s: number): void {
    const w = this.c.world;
    this.speed = Math.min(TOP_SPEED, this.speed + ACCEL * s);
    const stepLen = this.speed * s;
    const nx = this.x + this.dx * stepLen;
    const ny = this.y + this.dy * stepLen;
    // A wall (or water, or the world's edge) stops it: it bursts against it.
    if (!w.walkable(nx + this.dx * HIT_R * 0.6, ny + this.dy * HIT_R * 0.6) || this.dist + stepLen >= RANGE) {
      this.burst();
      return;
    }
    this.x = nx;
    this.y = ny;
    this.dist += stepLen;
    this.turns += stepLen / (Math.PI * 2 * KEG_R * KEG_SCALE);

    // Bowled over: knocked aside, off the side of its path they stood on, and a little ahead.
    const hit = w.hurtboxesWhere((h) => h.alive && !this.struck.has(h) && Math.hypot(h.x - this.x, (h.y - this.y) * 1.3) <= HIT_R + h.radius);
    for (const h of hit) {
      this.struck.add(h);
      const side = Math.sign(this.dx * (h.y - this.y) - this.dy * (h.x - this.x)) || (hash(h.x | 0, h.y | 0) < 0.5 ? -1 : 1);
      const px = -this.dy * side;
      const py = this.dx * side;
      h.hurt({ damage: ROLL_DAMAGE, heavy: true, knock: ROLL_KNOCK, fromX: h.x - (px * 0.8 + this.dx * 0.6) * 10, fromY: h.y - h.bodyY - (py * 0.8 + this.dy * 0.6) * 10 });
      this.fx.push(new HitSpark(w, h.x, h.y - h.bodyY, this.c.pal, h.y + 13, true));
      sound.thud(w.pan(h.x), true);
      w.cameras.main.shake(70, 0.0005);
    }

    // Froth squeezed out under it, and dust kicked up behind.
    const perpX = -this.dy;
    const perpY = this.dx;
    for (const sgn of [-1, 1]) this.trail.push({ x: this.x + perpX * sgn * 7 * KEG_SCALE * 0.5, y: this.y + perpY * sgn * 4, t: this.t, s: hash(this.trail.length, 3) });
    if (hash(Math.floor(this.t / 40), 9) < 0.5) w.debris([this.froth.light, this.froth.mid, 0xc8b49a], this.x - this.dx * 10, this.y - this.dy * 6, 1, this.y + 4, 'trail');

    const hop = Math.round(Math.abs(Math.sin(this.dist / 15)) * 1.5);
    const frame = kegFrameName(this.dx, this.dy, this.turns);
    this.keg.setFrame(frame).setPosition(Math.round(this.x), Math.round(this.y) - hop).setDepth(this.y);
    this.glow.setFrame(frame).setPosition(Math.round(this.x), Math.round(this.y) - hop).setDepth(this.y + 0.1);
    this.shade.setPosition(Math.round(this.x), Math.round(this.y)).setScale(2.2 - hop * 0.15, 1.6);
  }

  /** The keg bursts: staves flying, a blast of foam that bowls everything near over and leaves it reeling. */
  private burst(): void {
    const w = this.c.world;
    this.burstAt = this.t;
    this.bx = this.x;
    this.by = this.y;
    this.keg.setVisible(false);
    this.glow.setVisible(false);
    this.shade.setVisible(false);
    const cy = this.y - KEG_R * KEG_SCALE;
    const hit = strikeGround(w, this.x, this.y, BURST_R, { damage: BURST_DAMAGE, heavy: true, knock: BURST_KNOCK, fromX: this.x, fromY: this.y - 4 });
    for (const h of hit) h.slow?.(DRUNK_PACE, DRUNK_MS, this.c.pal.mid);
    this.fx.push(new Shockwave(w, Math.round(this.x), Math.round(this.y), BURST_R, this.c.pal));
    this.fx.push(new FoamSplash(w, Math.round(this.x), Math.round(this.y), this.froth, true, this.dx, this.dy));
    this.fx.push(new FoamSplash(w, Math.round(this.x), Math.round(this.y), this.froth, true, -this.dx, -this.dy));
    bloom(w, this.x, cy, this.c.pal.hot, 3.2, 600, this.y + 40);
    flare(w, this.x, cy, 160, this.c.pal.light, 2.4, 700);
    w.debris(this.wood, this.x, cy, 18, this.y + 20, 'burst');
    w.debris([this.froth.light, this.froth.mid, this.froth.deep, this.c.pal.core], this.x, cy, 30, this.y + 20, 'burst');
    w.debris([this.froth.light, this.froth.mid], this.x, this.y - 2, 16, this.y + 24, 'spores');
    sound.foamBurst(w.pan(this.x));
    w.cameras.main.shake(260, 0.0016);
    this.lamp.setPosition(this.x, cy);
    this.life = this.t + SUDS_MS;
  }

  /** The froth trail along its path, and after the blast a spreading puddle of suds, fizzing away. */
  private draw(): void {
    const midX = this.c.x + this.dx * (START_AHEAD + RANGE / 2);
    const midY = this.c.y + this.dy * (START_AHEAD * 0.7 + RANGE / 2);
    const g = this.g.begin(midX, midY, 2);
    const f = this.froth;
    this.trail = this.trail.filter((p) => this.t - p.t < TRAIL_MS);
    for (const p of this.trail) {
      const k = (this.t - p.t) / TRAIL_MS;
      if (p.s < k) continue;
      g.put(p.x, p.y, p.s > 0.6 ? f.light : f.mid, 0.9 * (1 - k));
    }
    if (this.burstAt >= 0) {
      const k = clamp01((this.t - this.burstAt) / SUDS_MS);
      const r = BURST_R * (0.45 + 0.35 * Math.sqrt(k));
      // Bubbles over the puddle, popping as it thins: fewer and fewer stay.
      for (let i = 0; i < 90; i++) {
        if (hash(i, 31) < k * 1.1) continue;
        const a = hash(i, 5) * Math.PI * 2;
        const rr = r * Math.sqrt(hash(i, 7));
        const x = this.bx + Math.cos(a) * rr;
        const y = this.by + Math.sin(a) * rr * 0.55;
        const pop = hash(i, Math.floor((this.t - this.burstAt) / 120)) > 0.92;
        g.put(x, y, pop ? f.glint : i & 1 ? f.light : f.mid, (pop ? 1 : 0.75) * (1 - k * 0.7));
        if (hash(i, 13) > 0.6) g.put(x + 1, y, f.deep, 0.5 * (1 - k));
      }
      this.lamp.intensity = 1.6 * (1 - clamp01((this.t - this.burstAt) / 500));
    } else {
      // The keg's hoops catch the light a touch as it rolls (the Special's own glow, faint).
      this.lamp.setPosition(this.x, this.y - 10);
      this.lamp.intensity = 0.5 * clamp01(this.speed / TOP_SPEED);
    }
    g.end();
  }

  destroy(): void {
    for (const e of this.fx) e.destroy();
    this.fx = [];
    super.destroy();
  }
}
