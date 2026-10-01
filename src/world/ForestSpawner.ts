import { MONSTERS, Spawner, type Monster, type MonsterSnap, type SpawnerSnap, type Target } from '../game/monsters';
import type { WorldScene } from '../scenes/WorldScene';
import { CHUNK, type FSpot, type ForestGen } from './forestGen';

// The Everwood's creatures. The forest has no end, so there is no list of
// spots made up front: each chunk names a creature or two of its own (see
// ForestGen.layout), and a spot comes alive when a player walks within reach
// of its chunk and goes quiet again once every player is far away. A slot is
// named by its spot's id, so the host and the other players, who grow the
// same forest from the same seed, agree which creature is which. No creature
// rises within a ward lantern's reach (see ForestEdits.warded): those already
// out stay out, but once slain, or asleep and woken again, they don't come back
// while it stands. Online the host decides, so the host's lanterns count.

/** Chunks round each player whose creatures are awake, and past which they sleep again. */
const WAKE = 2;
const SLEEP = 3;
/** A slain creature is back after this long, if nobody is standing right by. */
const RESPAWN = 45000;
const KEEP_AWAY = 110;

interface Slot {
  spot: FSpot;
  monster: Monster | null;
  gen: number;
  wait: number;
  /** Online, where the host has its creature, and how long this player has seen none there while the host does. */
  net: { x: number; y: number } | null;
  missing: number;
}

const SNAP_DIST = 56;

export class ForestSpawner extends Spawner {
  private spots = new Map<number, Slot>();
  private readonly started: number;

  constructor(
    private host: WorldScene,
    private gen: ForestGen,
    /** Is a spot inside a ward's reach? */
    private warded: (x: number, y: number) => boolean = () => false,
  ) {
    super(host, [], RESPAWN);
    this.started = host.time.now;
  }

  private wakeUp(s: Slot): Monster {
    const m = MONSTERS[s.spot.kind](this.host, s.spot.x, s.spot.y);
    m.slot = s.spot.id;
    m.gen = s.gen;
    return m;
  }

  find(slot: number, gen: number): Monster | null {
    const m = this.spots.get(slot)?.monster;
    return m && m.gen === gen && !m.dead ? m : null;
  }

  /** Every awake spot's generation (as id, gen pairs), and the creatures standing. */
  snapshot(): SpawnerSnap {
    const g: number[] = [];
    const l: MonsterSnap[] = [];
    for (const s of this.spots.values()) {
      g.push(s.spot.id, s.gen);
      const m = s.monster;
      if (m && !m.dead) l.push([m.slot, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, Math.round(m.hp * 10) / 10, m.alive || m.state === 'spawn' ? 0 : 1]);
    }
    return { g, l };
  }

  /** Follow the host: its awake spots, and what stands on them. */
  sync(snap: SpawnerSnap): void {
    const gens = new Map<number, number>();
    for (let i = 0; i + 1 < snap.g.length; i += 2) gens.set(snap.g[i], snap.g[i + 1]);
    const standing = new Map<number, MonsterSnap>();
    for (const e of snap.l) standing.set(e[0], e);
    // Spots the host has put to sleep go quiet here too.
    for (const [id, s] of this.spots) {
      if (gens.has(id)) continue;
      s.monster?.destroy();
      this.spots.delete(id);
    }
    const quiet = this.host.time.now - this.started < 4000;
    for (const [id, hostGen] of gens) {
      let s = this.spots.get(id);
      const e = standing.get(id);
      if (!s) {
        const spot = this.gen.spotById(id);
        if (!spot) continue;
        s = { spot, monster: null, gen: hostGen, wait: 0, net: null, missing: 0 };
        this.spots.set(id, s);
        if (e && !e[4]) s.monster = this.wakeUp(s);
      } else if (hostGen > s.gen) {
        s.monster?.netKill(true);
        s.gen = hostGen;
        s.monster = e && !e[4] ? this.wakeUp(s) : null;
        s.missing = 0;
      } else if (hostGen < s.gen) continue;
      const m = s.monster && !s.monster.dead ? s.monster : null;
      if (!e) {
        m?.netKill(quiet);
        s.net = null;
        continue;
      }
      s.net = { x: e[1], y: e[2] };
      if (!m) continue;
      if (e[4]) {
        m.netKill(quiet);
        continue;
      }
      if (this.host.time.now - m.lastHitAt > 450 || e[3] < m.hp) m.hp = Math.min(m.maxHp, e[3]);
    }
  }

  follow(dt: number): void {
    const k = 1 - Math.exp(-dt / 140);
    for (const s of this.spots.values()) {
      const m = s.monster;
      const n = s.net;
      if (n && !m) {
        s.missing += dt;
        if (s.missing > 2500) {
          s.monster = this.wakeUp(s);
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
    for (const s of this.spots.values()) if (s.monster) out.push(s.monster);
    return out;
  }

  update(dt: number, targets: Target[], daylight: number): void {
    if (!this.follower) this.wake(targets);
    for (const s of this.spots.values()) {
      if (s.monster) {
        s.monster.update(s.monster.warp(dt), nearest(s.monster, targets), daylight);
        if (s.monster.dead) {
          s.monster = null;
          s.wait = RESPAWN;
        }
      } else if (!this.follower) {
        s.wait -= dt;
        if (s.wait <= 0 && !targets.some((t) => Math.hypot(t.x - s.spot.x, t.y - s.spot.y) < KEEP_AWAY) && !this.warded(s.spot.x, s.spot.y)) {
          s.gen++;
          s.monster = this.wakeUp(s);
        }
      }
    }
  }

  /** Wake the spots in the chunks round each player; put those far from all of them to sleep. */
  private wake(targets: Target[]): void {
    // Nobody standing (all fallen): leave things as they are until someone rises.
    if (!targets.length) return;
    for (const t of targets) {
      const cx = Math.floor(t.x / CHUNK);
      const cy = Math.floor(t.y / CHUNK);
      for (let j = cy - WAKE; j <= cy + WAKE; j++) {
        for (let i = cx - WAKE; i <= cx + WAKE; i++) {
          // Only chunks already laid out (the forest lays out what is near the view); the rest wake a moment later.
          if (!this.gen.hasLayout(i, j)) continue;
          for (const spot of this.gen.layout(i, j).spots) {
            if (this.spots.has(spot.id)) continue;
            const s: Slot = { spot, monster: null, gen: 1, wait: 0, net: null, missing: 0 };
            // A warded spot is kept, empty, and fills as soon as its ward is gone.
            if (!this.warded(spot.x, spot.y)) s.monster = this.wakeUp(s);
            this.spots.set(spot.id, s);
          }
        }
      }
    }
    for (const [id, s] of this.spots) {
      const cx = Math.floor(s.spot.x / CHUNK);
      const cy = Math.floor(s.spot.y / CHUNK);
      const near = targets.some((t) => Math.abs(Math.floor(t.x / CHUNK) - cx) <= SLEEP && Math.abs(Math.floor(t.y / CHUNK) - cy) <= SLEEP);
      // A creature out hunting stays awake while it is near someone, wherever its spot is.
      const m = s.monster;
      const busy = m && !m.dead && targets.some((t) => Math.hypot(t.x - m.x, t.y - m.y) < CHUNK);
      if (near || busy) continue;
      m?.destroy();
      this.spots.delete(id);
    }
  }

  destroy(): void {
    for (const s of this.spots.values()) s.monster?.destroy();
    this.spots.clear();
  }
}

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
