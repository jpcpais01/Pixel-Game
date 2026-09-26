import type { WorldScene } from '../../scenes/WorldScene';
import { Barkling } from './Barkling';
import { Beetle } from './Beetle';
import { Frog } from './Frog';
import { Glowmoth } from './Glowmoth';
import type { Monster, Target } from './Monster';
import { Puffcap } from './Puffcap';
import { Warden } from './Warden';
import { Banshee, Shade, Wisp } from './Spirits';
import { Queen } from './Queen';
import { Blob, Gale, Golem, Salamander, Undine } from './Elementals';
import { Elementinho } from './Elementinho';

export { Monster, type Target } from './Monster';

/** Every kind of monster, by id. A new monster is one entry here plus its art. */
export const MONSTERS = {
  frog: (world: WorldScene, x: number, y: number) => new Frog(world, x, y),
  beetle: (world: WorldScene, x: number, y: number) => new Beetle(world, x, y),
  puffcap: (world: WorldScene, x: number, y: number) => new Puffcap(world, x, y),
  barkling: (world: WorldScene, x: number, y: number) => new Barkling(world, x, y),
  glowmoth: (world: WorldScene, x: number, y: number) => new Glowmoth(world, x, y),
  warden: (world: WorldScene, x: number, y: number) => new Warden(world, x, y),
  wisp: (world: WorldScene, x: number, y: number) => new Wisp(world, x, y),
  shade: (world: WorldScene, x: number, y: number) => new Shade(world, x, y),
  banshee: (world: WorldScene, x: number, y: number) => new Banshee(world, x, y),
  queen: (world: WorldScene, x: number, y: number) => new Queen(world, x, y),
  blob_water: (world: WorldScene, x: number, y: number) => new Blob(world, x, y, 'water'),
  blob_earth: (world: WorldScene, x: number, y: number) => new Blob(world, x, y, 'earth'),
  blob_air: (world: WorldScene, x: number, y: number) => new Blob(world, x, y, 'air'),
  blob_fire: (world: WorldScene, x: number, y: number) => new Blob(world, x, y, 'fire'),
  golem: (world: WorldScene, x: number, y: number) => new Golem(world, x, y),
  undine: (world: WorldScene, x: number, y: number) => new Undine(world, x, y),
  gale: (world: WorldScene, x: number, y: number) => new Gale(world, x, y),
  salamander: (world: WorldScene, x: number, y: number) => new Salamander(world, x, y),
  elementinho: (world: WorldScene, x: number, y: number) => new Elementinho(world, x, y),
} satisfies Record<string, (world: WorldScene, x: number, y: number) => Monster>;

export type MonsterKind = keyof typeof MONSTERS;

/** One monster's home: where it spawns, wanders and walks back to. */
export interface SpawnSpot {
  kind: MonsterKind;
  x: number;
  y: number;
  /** ms before this spot's monster returns, instead of the region's. */
  respawn?: number;
  /** How many times this spot's monster returns before it stays dead; unlimited when unset. */
  lives?: number;
  /** How far the player must be before it returns, in px (default 90). */
  keepAway?: number;
}

/** One monster as the host sees it, for the other players: [slot, x, y, hp, dying]. */
export type MonsterSnap = [number, number, number, number, number];

/** Every slot's generation (how many monsters it has had), and the monsters standing. */
export interface SpawnerSnap {
  g: number[];
  l: MonsterSnap[];
}

/** How far a player's copy of a monster may stray from the host's before it jumps there. */
const SNAP_DIST = 56;

/**
 * Keeps a region's monsters alive: one per spot, and when one dies another
 * fades in at the same spot after `respawn` ms. A region hands over its spawn
 * table; the world updates every spawner and keeps them from overlapping.
 */
export class Spawner {
  private slots: {
    spot: SpawnSpot;
    monster: Monster | null;
    wait: number;
    lives: number;
    gen: number;
    /** Online, where the host has this slot's monster, and for how long this player has seen none there while the host does. */
    net: { x: number; y: number } | null;
    missing: number;
  }[];
  /**
   * Online, in another player's game: the host decides when monsters return,
   * and this game only follows (see sync).
   */
  follower = false;
  /** When this game began, so monsters the host lost before this player arrived go quietly. */
  private born: number;

  constructor(
    private world: WorldScene,
    spots: SpawnSpot[],
    private respawn = 9000,
  ) {
    this.born = world.time.now;
    this.slots = spots.map((spot, i) => ({ spot, monster: this.make(spot, i, 0), wait: 0, lives: spot.lives ?? Infinity, gen: 0, net: null, missing: 0 }));
  }

  private make(spot: SpawnSpot, slot: number, gen: number): Monster {
    const m = MONSTERS[spot.kind](this.world, spot.x, spot.y);
    m.slot = slot;
    m.gen = gen;
    return m;
  }

  /** The monster in `slot` if it is still generation `gen`. */
  find(slot: number, gen: number): Monster | null {
    const m = this.slots[slot]?.monster;
    return m && m.gen === gen && !m.dead ? m : null;
  }

  /** The host's view of every slot, for the other players. */
  snapshot(): SpawnerSnap {
    const l: MonsterSnap[] = [];
    for (const s of this.slots) {
      const m = s.monster;
      if (m && !m.dead) l.push([m.slot, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, Math.round(m.hp * 10) / 10, m.alive || m.state === 'spawn' ? 0 : 1]);
    }
    return { g: this.slots.map((s) => s.gen), l };
  }

  /** Follow the host: bring back, remove and kill monsters as it says, and note where they stand. */
  sync(snap: SpawnerSnap): void {
    const standing = new Map<number, MonsterSnap>();
    for (const e of snap.l) standing.set(e[0], e);
    this.slots.forEach((s, i) => {
      const hostGen = snap.g[i] ?? 0;
      const e = standing.get(i);
      if (hostGen > s.gen) {
        // The host is on a later monster: this one (long gone for the host) goes quietly.
        s.monster?.netKill(true);
        s.monster = e && !e[4] ? this.make(s.spot, i, hostGen) : null;
        s.gen = hostGen;
        s.missing = 0;
      } else if (hostGen < s.gen) return;
      const m = s.monster && !s.monster.dead ? s.monster : null;
      const quiet = this.world.time.now - this.born < 4000;
      if (!e) {
        // Fallen for the host: fall here too.
        m?.netKill(quiet);
        s.net = null;
        return;
      }
      s.net = { x: e[1], y: e[2] };
      if (!m) return;
      if (e[4]) {
        m.netKill(quiet);
        return;
      }
      // Health: the host's, unless a blow landed here a moment ago and the host hasn't counted it yet.
      if (this.world.time.now - m.lastHitAt > 450 || e[3] < m.hp) m.hp = Math.min(m.stats.hp, e[3]);
    });
  }

  /** Ease each monster toward where the host has it (before they move this frame). */
  follow(dt: number): void {
    const k = 1 - Math.exp(-dt / 140);
    for (const s of this.slots) {
      const m = s.monster;
      const n = s.net;
      if (n && !m) {
        // The host still has it standing after this player saw it fall: bring it back.
        s.missing += dt;
        if (s.missing > 2500) {
          s.monster = this.make(s.spot, this.slots.indexOf(s), s.gen);
          s.missing = 0;
        }
        continue;
      }
      s.missing = 0;
      if (!m || !n || !m.alive) continue;
      const dx = n.x - m.x;
      const dy = n.y - m.y;
      if (dx * dx + dy * dy > SNAP_DIST * SNAP_DIST) {
        m.x = n.x;
        m.y = n.y;
      } else {
        m.x += dx * k;
        m.y += dy * k;
      }
    }
  }

  get monsters(): Monster[] {
    const out: Monster[] = [];
    for (const s of this.slots) if (s.monster) out.push(s.monster);
    return out;
  }

  /** `targets` are the players standing (each monster hunts the nearest); empty when all are down. */
  update(dt: number, targets: Target[], daylight: number): void {
    this.slots.forEach((s, i) => {
      if (s.monster) {
        // A slowed monster lives through less of each moment.
        s.monster.update(s.monster.warp(dt), nearest(s.monster, targets), daylight);
        if (s.monster.dead) {
          s.monster = null;
          s.wait = s.spot.respawn ?? this.respawn;
        }
      } else if (s.lives > 0 && !this.follower) {
        s.wait -= dt;
        // Don't pop in right next to a player.
        const away = s.spot.keepAway ?? 90;
        const near = targets.some((t) => Math.hypot(t.x - s.spot.x, t.y - s.spot.y) < away);
        if (s.wait <= 0 && !near) {
          s.gen++;
          s.monster = this.make(s.spot, i, s.gen);
          s.lives--;
        }
      }
    });
  }

  destroy(): void {
    for (const s of this.slots) s.monster?.destroy();
    this.slots = [];
  }
}

/** The target nearest `m`, or null when there is none. */
function nearest(m: Monster, targets: Target[]): Target | null {
  let best: Target | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = (t.x - m.x) ** 2 + (t.y - m.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Push overlapping monsters apart, and out of the players' bodies. */
export function separate(monsters: Monster[], players: Target[], playerRadius = 6): void {
  for (let i = 0; i < monsters.length; i++) {
    const a = monsters[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < monsters.length; j++) {
      const b = monsters[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = (b.y - a.y) * 1.4;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01;
      const push = (min - d) * 0.5;
      const ux = d2 ? dx / d : Math.random() - 0.5;
      const uy = d2 ? dy / d : Math.random() - 0.5;
      a.shove(-ux * push, -uy * push * 0.7);
      b.shove(ux * push, uy * push * 0.7);
    }
    for (const player of players) {
      const dx = a.x - player.x;
      const dy = (a.y - player.y) * 1.4;
      const min = a.radius + playerRadius;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0.01) a.shove((dx / d) * (min - d) * 0.6, ((dy / d) * (min - d) * 0.6) / 1.4);
    }
  }
}
