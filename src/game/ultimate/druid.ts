import type Phaser from 'phaser';
import { sound } from '../../audio';
import type { Hurtbox } from '../combat';
import { bindFoe } from '../Strings';
import { spiritBeast } from '../Druid';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, easeOut, flare, Fx, GROUND, hash, pool, ring, segDist, strikeGround, type Ink, type Pal } from './ink';
import type { Cast } from './types';

// The Druid's Specials: the Grovekeeper's Wrath of the Wild, roots bursting up
// in a spiral that seize and then crush everything on the spot; and the
// Shapeshifter's Primal Stampede, spirit wolves and stags charging out along
// the way she faces, trampling everything in their path.

/** Bark, darkest first. */
const BARK = [0x221710, 0x3a2818, 0x5a3e26, 0x7a5a38];

const WRATH_R = 46;
const WRATH_ROOTS = 16;
/** A root bursts up every so often, spiralling out from the heart. */
const WRATH_EVERY = 55;
const ROOT_R = 10;
const ROOT_DAMAGE = 20;
const ROOT_HOLD = 1900;
/** When the roots crush all they hold, and for how much. */
const CRUSH_AT = 1350;
const CRUSH_DAMAGE = 24;
const WRATH_LIFE = 2300;

interface Root {
  x: number;
  y: number;
  /** When it bursts up, its height, its lean (outward) and a seed for its wiggle. */
  at: number;
  h: number;
  lean: number;
  seed: number;
  burst: boolean;
}

/** The Grovekeeper's Wrath of the Wild: the ground splits and great thorned roots burst up in a spiral, seizing and then crushing all they hold. */
export class WildWrath extends Fx {
  private ground: Ink;
  private roots: Ink;
  private list: Root[] = [];
  private held = new Set<Hurtbox>();
  private struck = new Set<Hurtbox>();
  private crushed = false;
  private lamp: Phaser.GameObjects.Light;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, WRATH_LIFE);
    this.ground = this.ink(WRATH_R * 2 + 16, Math.ceil(WRATH_R * 2 * GROUND + 16));
    this.roots = this.ink(WRATH_R * 2 + 24, Math.ceil(WRATH_R * 2 * GROUND + 44));
    this.lamp = this.light(x, y - 10, 160, p.light, 0);
    for (let i = 0; i < WRATH_ROOTS; i++) {
      const q = i * 2.39996;
      const d = 5 + (WRATH_R - 8) * Math.sqrt((i + 0.5) / WRATH_ROOTS);
      this.list.push({
        x: x + Math.cos(q) * d,
        y: y + Math.sin(q) * d * GROUND,
        at: i * WRATH_EVERY,
        h: 11 + Math.round(hash(i, 5) * 7),
        lean: Math.cos(q) * 0.3,
        seed: i,
        burst: false,
      });
    }
    sound.bog(world.pan(x));
    sound.quakeSlam(world.pan(x));
  }

  protected step(): void {
    const { x, y, p, t } = this;
    for (const r of this.list) if (!r.burst && t >= r.at) this.burst(r);
    if (!this.crushed && t >= CRUSH_AT) this.crush();
    const fade = 1 - clamp01((t - (WRATH_LIFE - 450)) / 450);
    this.lamp.intensity = 2 * easeOut(t / 300) * fade;

    // The earth torn open under them, moss creeping over it.
    const g = this.ground.begin(x, y, 2.4);
    const spread = easeOut(t / 900);
    pool(g, x, y, WRATH_R * spread, 0x241a14, 0x2e2a1a, fade, GROUND, 0.75);
    pool(g, x, y, WRATH_R * 0.7 * spread, 0x2e5a26, 0x24401e, fade * clamp01((t - 300) / 500), GROUND, 0.6);
    if (t < 500) ring(g, x, y, 4 + WRATH_R * easeOut(t / 450), 2 * (1 - t / 500) + 0.6, p, 1 - t / 500);
    g.end();

    // The roots, drawn back to front so nearer ones stand over farther.
    const R = this.roots.begin(x, y, y + WRATH_R * GROUND, 0.5, (this.roots.h - WRATH_R * GROUND - 6) / this.roots.h);
    for (const r of [...this.list].sort((a, b) => a.y - b.y)) {
      if (t < r.at) continue;
      const up = easeOut((t - r.at) / 150);
      const sink = clamp01((t - (WRATH_LIFE - 500 - r.seed * 12)) / 350);
      drawRoot(R, r, Math.round(r.h * up * (1 - sink)), p, this.crushed && t - CRUSH_AT < 200);
    }
    R.end();
  }

  /** A root bursts up: whatever stands on it is struck and held. */
  private burst(r: Root): void {
    r.burst = true;
    const { world, p } = this;
    const hit = strikeGround(world, r.x, r.y, ROOT_R, { damage: ROOT_DAMAGE, heavy: true, knock: 40, fromX: this.x, fromY: this.y }, this.struck);
    for (const h of hit) {
      this.struck.add(h);
      if (bindFoe(h, ROOT_HOLD)) this.held.add(h);
    }
    world.debris([BARK[2], BARK[3], p.mid], r.x, r.y - 2, 5, r.y + 20, 'spores');
    if (r.seed % 3 === 0) sound.thud(world.pan(r.x), r.seed % 2 === 0);
  }

  /** The roots tighten: everything they hold is crushed, and the thorns flare. */
  private crush(): void {
    this.crushed = true;
    const { world, x, y, p } = this;
    for (const h of this.held) {
      if (!h.alive) continue;
      h.hurt({ damage: CRUSH_DAMAGE, heavy: true, knock: 0, fromX: x, fromY: y });
      world.debris(p.tints, h.x, h.y - h.bodyY, 6, h.y + 20, 'burst');
    }
    // Anything that wandered in since is struck too.
    strikeGround(world, x, y, WRATH_R, { damage: Math.round(CRUSH_DAMAGE / 2), heavy: false, knock: 60, fromX: x, fromY: y }, this.held);
    flare(world, x, y - 12, 200, p.light, 3.5, 600);
    bloom(world, x, y - 10, p.hot, 3.2, 420, y + 30);
    world.cameras.main.shake(220, 0.003);
    sound.slam(world.pan(x));
  }
}

/** A root `h` px tall: thick and barked at its foot, twisting as it rises, thorns along it and a glowing tip curling outward. */
function drawRoot(g: Ink, r: Root, h: number, p: Pal, flash: boolean): void {
  if (h <= 0) return;
  for (let j = 0; j <= h; j++) {
    const f = j / h;
    const w = Math.max(0.5, 2.3 * (1 - f) + 0.4);
    const cx = r.x + r.lean * j + Math.sin(j * 0.55 + r.seed) * 0.9 + (f > 0.75 ? Math.sign(r.lean || 1) * (f - 0.75) * 10 : 0);
    const cy = r.y - j;
    for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
      if (Math.abs(dx) > w) continue;
      const lit = dx < 0;
      let c = Math.abs(dx) >= w - 0.5 ? BARK[0] : lit ? BARK[3] : BARK[1];
      // Veins of green light running up it.
      if (dx === 0 && (j + r.seed) % 4 === 0) c = flash ? p.core : p.mid;
      g.put(cx + dx, cy, c);
    }
    // Thorns on alternate sides.
    if (j > 1 && j < h - 1 && (j + r.seed) % 3 === 0) {
      const side = (j + r.seed) % 2 ? 1 : -1;
      g.put(cx + side * (w + 1), cy - 1, flash ? p.hot : BARK[2]);
    }
  }
  const tip = r.x + r.lean * h + Math.sign(r.lean || 1) * 2.5;
  g.put(tip, r.y - h - 1, p.core);
  g.put(tip, r.y - h, p.hot);
}

// ---------------------------------------------------------------------------

const HERD = 5;
const RUN_FROM = -26;
const RUN_TO = 175;
const RUN_TIME = 820;
const HOOF_R = 9;
const TRAMPLE_DAMAGE = 32;
const LANES = [-18, -9, 0, 9, 18];
const DELAYS = [110, 30, 0, 60, 150];

interface Beast {
  lane: number;
  delay: number;
  kind: 'wolf' | 'stag';
  hit: Set<Hurtbox>;
  ink: Ink;
  /** Where it was last frame, on the ground. */
  px: number;
  py: number;
  dustT: number;
}

/** The Shapeshifter's Primal Stampede: spirit wolves and stags pour out past her and charge along the way she faces, trampling all in their path. */
export class PrimalStampede extends Fx {
  private herd: Beast[] = [];
  private dir: number;
  private hoofT = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, RUN_TIME + Math.max(...DELAYS) + 300);
    this.dir = c.dx >= 0 ? 1 : -1;
    for (let i = 0; i < HERD; i++) {
      const b: Beast = { lane: LANES[i], delay: DELAYS[i], kind: i % 2 ? 'stag' : 'wolf', hit: new Set(), ink: this.ink(60, 44), px: 0, py: 0, dustT: 0 };
      const at = this.at(b, 0);
      b.px = at.x;
      b.py = at.y;
      this.herd.push(b);
    }
    sound.windDash(world.pan(c.x));
    sound.gust(world.pan(c.x));
  }

  /** Where beast `b` runs at `k` (0..1) of its run: along the aim, in its lane beside the others. */
  private at(b: Beast, k: number): { x: number; y: number } {
    const { x, y, dx, dy } = this.c;
    const d = RUN_FROM + (RUN_TO - RUN_FROM) * k;
    // Lanes lie across the way they run; seen from above they squash as the ground does.
    return { x: x + dx * d - dy * b.lane, y: y + dy * d + dx * b.lane * GROUND };
  }

  protected step(dt: number): void {
    const { world, c, t } = this;
    this.hoofT -= dt;
    if (this.hoofT <= 0 && t < RUN_TIME) {
      this.hoofT = 95;
      sound.thud(world.pan(c.x + c.dx * 60), false);
    }
    for (const b of this.herd) {
      const k = clamp01((t - b.delay) / RUN_TIME);
      const alive = t >= b.delay && k < 1;
      const pos = this.at(b, k);
      const g = b.ink.begin(pos.x, pos.y - 8, pos.y + 0.5);
      if (alive) {
        // They come out of the air behind her and fade back into it at the end of the run.
        const a = Math.min(clamp01(k / 0.12), 1 - clamp01((k - 0.85) / 0.15));
        const stride = 0.5 + 0.5 * Math.sin(t * 0.03 + b.lane);
        // Two ghosts behind each, the way it came.
        for (const back of [12, 6]) spiritBeast(g, pos.x - c.dx * back, pos.y - 8 - c.dy * back * GROUND, this.dir, b.kind, stride, c.pal, a * (back > 8 ? 0.25 : 0.45));
        spiritBeast(g, pos.x, pos.y - 8, this.dir, b.kind, stride, c.pal, a);
        this.trample(b, pos.x, pos.y);
        b.dustT -= dt;
        if (b.dustT <= 0) {
          b.dustT = 60;
          world.debris([0x8a7a60, 0x6a5a48, c.pal.mid], pos.x - c.dx * 6, pos.y, 2, pos.y + 20, 'spores');
        }
      }
      g.end();
      b.px = pos.x;
      b.py = pos.y;
    }
  }

  /** Whatever the beast runs through since last frame is thrown aside. */
  private trample(b: Beast, x: number, y: number): void {
    const { world, c } = this;
    for (const h of world.hurtboxesWhere((q) => q.alive && !b.hit.has(q) && segDist(q.x, q.y, b.px, b.py, x, y) <= HOOF_R + q.radius)) {
      b.hit.add(h);
      h.hurt({ damage: TRAMPLE_DAMAGE, heavy: true, knock: 200, fromX: h.x - c.dx * 10 - c.dy * Math.sign(b.lane || 1) * 4, fromY: h.y - c.dy * 10 });
      world.debris(c.pal.tints, h.x, h.y - h.bodyY, 8, h.y + 20, 'burst');
      bloom(world, h.x, h.y - h.bodyY, c.pal.hot, 1, 220, h.y + 20, 0.7);
      sound.punchHit(world.pan(h.x), true);
    }
  }
}
