import { GEAR_SETS, SET_POWERS, gear, type PowerId, type SetId } from './gear';
import { WYRM_TINTS } from '../art/wyrm';
import { WARDEN_TINTS } from '../art/warden';
import type { Hurtbox } from './combat';
import type { WorldScene } from '../scenes/WorldScene';
import { BlackHole, BurrowFx, ShardBolt, StarStrike, crystalEruption, crystalWake, powerShout } from './setFx';

// The Myth sets' powers at 2, 4 and 6 pieces worn (SET_POWERS in gear.ts):
// when each goes off, and how hard. setFx.ts draws them. Every blow here is
// measured in the hero's own Damage (one basic attack), so they suit every
// hero alike, and gear, buffs and the rest lift them like any other blow.
// They strike through the same hurtboxes as the hero's own blows, so online
// they reach the host like any hit.
//
// What they add, for a hero dealing about 3 basic attacks' worth a second:
// Crystal Wake about a fifth more on one foe (more on a crowd), Starfall a
// sixth, Singularity a sixth and a pull; Shardskin, Stardust and Burrow
// answer being hit, kills, and near death.

/** Shardskin: struck, the hero flings a shard at each of up to this many foes this close, at most this often (ms). */
const SHARD_FOES = 4;
const SHARD_REACH = 90;
const SHARD_GAP = 600;
const SHARD_HIT = 0.8;

/**
 * Crystal Wake: every this many basic attacks, a line of crystal; each foe on
 * it is struck once. The quickest heroes (a Wraith's dozen a second) raise one
 * no oftener than WAKE_GAP ms, carrying all the attacks since in its blow.
 */
const WAKE_EVERY = 4;
const WAKE_GAP = 1000;
const WAKE_HIT = 0.9;

/** Burrow: below this share of health, once a minute, the hero dives for this long (ms) and bursts up. */
const BURROW_BELOW = 0.3;
const BURROW_EVERY = 60000;
const BURROW_UNDER = 1100;
/** Grace after rising, so the hero lands on their feet. */
const BURROW_LANDING = 500;
const BURROW_BLAST = 2;
const BURROW_SPIKE = 1.2;

/** Stardust: a kill calls a star on the nearest foe this close to it, no oftener than this (ms), so kills don't chain forever. */
const DUST_REACH = 140;
const DUST_GAP = 250;
const DUST_HIT = 1.2;

/** Starfall: this often (ms), a star on the last foe the hero struck, if they struck it lately and it's near. */
const STARFALL_EVERY = 3000;
const STARFALL_MEMORY = 5000;
const STARFALL_REACH = 220;
const STARFALL_HIT = 1.8;

/** Singularity: the normal ability also opens a black hole this far ahead (or on a foe near there), at most this often (ms). */
const HOLE_AHEAD = 64;
const HOLE_SNAP = 70;
const HOLE_EVERY = 8000;
/** Each grind while it holds (about six), then the nova. */
const HOLE_GRIND = 0.2;
const HOLE_NOVA = 2.6;

const SET_OF: Record<PowerId, SetId> = { shardskin: 'geode', wake: 'geode', burrow: 'geode', stardust: 'astral', starfall: 'astral', singularity: 'astral' };

export class SetPowers {
  private shardCd = 0;
  private swings = 0;
  private swingT = 0;
  private wakeT = 0;
  private wasAttack = false;
  private burrowCd = 0;
  private burrow: BurrowFx | null = null;
  private dustCd = 0;
  private starT = STARFALL_EVERY;
  private last: Hurtbox | null = null;
  private lastAge = Infinity;
  private holeCd = 0;
  private wasSpecial = false;
  /** Powers worn when last looked, to say which are new. */
  private had = new Set<PowerId>();

  constructor(private world: WorldScene) {}

  private has(p: PowerId): boolean {
    return gear.powers.has(p);
  }

  /** `k` basic attacks' worth, in the numbers the hero's own code uses. */
  private hit(k: number): number {
    return k * this.world.heroKit;
  }

  /** Under the floor: the world hides the hero and holds their attacks. */
  get burrowing(): boolean {
    return !!this.burrow?.below;
  }

  /** Gear changed: a power just reached is named over the hero (mid-run only). */
  worn(running: boolean): void {
    for (const p of gear.powers) {
      if (this.had.has(p) || !running) continue;
      const set = SET_OF[p];
      const def = SET_POWERS[set]!.find((d) => d.id === p)!;
      const h = this.world.player;
      powerShout(this.world, h.x, h.y - 8, def.name.toUpperCase(), GEAR_SETS[set].tint, set === 'geode' ? WYRM_TINTS : WARDEN_TINTS);
    }
    this.had = new Set(gear.powers);
  }

  /**
   * Each frame, after the hero moved. `attack` and `special` are the buttons
   * as the hero got them; `dir` is where they aim (or face).
   */
  update(dt: number, attack: boolean, special: boolean, dir: { x: number; y: number }, down: boolean): void {
    this.shardCd -= dt;
    this.burrowCd -= dt;
    this.dustCd -= dt;
    this.holeCd -= dt;
    this.lastAge += dt;
    if (this.burrow?.dead) this.burrow = null;
    if (down) {
      this.wasAttack = this.wasSpecial = false;
      this.swings = 0;
      return;
    }
    const h = this.world.player;
    const l = Math.hypot(dir.x, dir.y) || 1;
    const ux = dir.x / l;
    const uy = dir.y / l;

    // Crystal Wake: count the basic attacks, one on each press and then one
    // each beat of the hero's attack speed while it's held.
    if (this.has('wake')) {
      const beat = 1000 / this.world.heroRate;
      if (attack && !this.wasAttack) {
        this.swings++;
        this.swingT = 0;
      } else if (attack) {
        this.swingT += dt;
        if (this.swingT >= beat) {
          this.swingT -= beat;
          this.swings++;
        }
      }
      this.wakeT += dt;
      if (this.swings >= WAKE_EVERY && this.wakeT >= WAKE_GAP) {
        crystalWake(this.world, h.x, h.y, ux, uy, this.hit((WAKE_HIT * this.swings) / WAKE_EVERY));
        this.swings = 0;
        this.wakeT = 0;
      }
    }
    this.wasAttack = attack;

    // Starfall: a star on the last foe struck, once it's due.
    if (this.has('starfall')) {
      this.starT -= dt;
      const t = this.last;
      if (this.starT <= 0) {
        if (t?.alive && this.lastAge < STARFALL_MEMORY && Math.hypot(t.x - h.x, t.y - h.y) < STARFALL_REACH) {
          this.world.addEffect(new StarStrike(this.world, t.x, t.y, t, this.hit(STARFALL_HIT), 1.3));
          this.starT = STARFALL_EVERY;
        } else this.starT = 0;
      }
    }

    // Singularity: the ability's press opens a black hole where it's aimed.
    if (this.has('singularity') && special && !this.wasSpecial && this.holeCd <= 0) {
      this.holeCd = HOLE_EVERY;
      let x = h.x + ux * HOLE_AHEAD;
      let y = h.y + uy * HOLE_AHEAD;
      const foe = this.nearest(x, y, HOLE_SNAP);
      if (foe) {
        x = foe.x;
        y = foe.y;
      } else {
        // Short of a wall, never inside it.
        for (let d = HOLE_AHEAD; d > 0 && !this.world.walkable(x, y); d -= 8) {
          x = h.x + ux * d;
          y = h.y + uy * d;
        }
      }
      this.world.addEffect(new BlackHole(this.world, x, y, this.hit(HOLE_GRIND), this.hit(HOLE_NOVA)));
    }
    this.wasSpecial = special;
  }

  /** The hero was struck and still stands. */
  hurt(): void {
    const w = this.world;
    const h = w.player;
    if (this.has('shardskin') && this.shardCd <= 0) {
      this.shardCd = SHARD_GAP;
      const x = h.x;
      const y = h.y - 14;
      const foes = w
        .hurtboxesWhere((b) => b.alive && Math.hypot(b.x - h.x, b.y - h.y) < SHARD_REACH)
        .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))
        .slice(0, SHARD_FOES);
      // One at each foe, flung out wide so they arc in; a few more burst loose for show.
      for (const f of foes) {
        const a = Math.atan2(f.y - f.bodyY - y, f.x - x) + (Math.random() - 0.5) * 1.8;
        w.addEffect(new ShardBolt(w, x, y, a, f, this.hit(SHARD_HIT)));
      }
      const loose = 6 - foes.length;
      const a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < loose; i++) w.addEffect(new ShardBolt(w, x, y, a0 + (i / loose) * Math.PI * 2, null, 0, 26 + Math.random() * 16));
      w.debris(WYRM_TINTS, x, y, 10, h.y + 20);
    }
    const v = h.vitals;
    if (this.has('burrow') && this.burrowCd <= 0 && !this.burrow && v.hp < v.max * BURROW_BELOW) {
      this.burrowCd = BURROW_EVERY;
      w.evade(BURROW_UNDER + BURROW_LANDING);
      powerShout(w, h.x, h.y, 'BURROW', GEAR_SETS.geode.tint, WYRM_TINTS);
      this.burrow = new BurrowFx(w, () => ({ x: h.x, y: h.y }), BURROW_UNDER, (x, y) => {
        crystalEruption(w, x, y, this.hit(BURROW_BLAST), this.hit(BURROW_SPIKE));
        w.evade(BURROW_LANDING);
      });
      w.addEffect(this.burrow);
    }
  }

  /** The hero's own blow landed on `h`: Starfall's mark. */
  struck(h: Hurtbox): void {
    this.last = h;
    this.lastAge = 0;
  }

  /** A foe fell at (x, y): Stardust calls a star on the next. */
  slain(x: number, y: number): void {
    if (!this.has('stardust') || this.dustCd > 0) return;
    const foe = this.nearest(x, y, DUST_REACH);
    if (!foe) return;
    this.dustCd = DUST_GAP;
    this.world.addEffect(new StarStrike(this.world, foe.x, foe.y, foe, this.hit(DUST_HIT)));
  }

  private nearest(x: number, y: number, reach: number): Hurtbox | null {
    let best: Hurtbox | null = null;
    let bestD = reach;
    for (const b of this.world.hurtboxesWhere((b) => b.alive)) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }
}
