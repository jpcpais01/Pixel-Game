import type { WorldScene } from '../../scenes/WorldScene';
import { Beetle } from './Beetle';
import { Frog } from './Frog';
import type { Monster, Target } from './Monster';
import { Puffcap } from './Puffcap';

export { Monster, type Target } from './Monster';

/** Every kind of monster, by id. A new monster is one entry here plus its art. */
export const MONSTERS = {
  frog: (world: WorldScene, x: number, y: number) => new Frog(world, x, y),
  beetle: (world: WorldScene, x: number, y: number) => new Beetle(world, x, y),
  puffcap: (world: WorldScene, x: number, y: number) => new Puffcap(world, x, y),
} satisfies Record<string, (world: WorldScene, x: number, y: number) => Monster>;

export type MonsterKind = keyof typeof MONSTERS;

/** One monster's home: where it spawns, wanders and walks back to. */
export interface SpawnSpot {
  kind: MonsterKind;
  x: number;
  y: number;
}

/**
 * Keeps a region's monsters alive: one per spot, and when one dies another
 * fades in at the same spot after `respawn` ms. A region hands over its spawn
 * table; the world updates every spawner and keeps them from overlapping.
 */
export class Spawner {
  private slots: { spot: SpawnSpot; monster: Monster | null; wait: number }[];

  constructor(
    private world: WorldScene,
    spots: SpawnSpot[],
    private respawn = 9000,
  ) {
    this.slots = spots.map((spot) => ({ spot, monster: MONSTERS[spot.kind](world, spot.x, spot.y), wait: 0 }));
  }

  get monsters(): Monster[] {
    const out: Monster[] = [];
    for (const s of this.slots) if (s.monster) out.push(s.monster);
    return out;
  }

  update(dt: number, target: Target | null, daylight: number): void {
    for (const s of this.slots) {
      if (s.monster) {
        s.monster.update(dt, target, daylight);
        if (s.monster.dead) {
          s.monster = null;
          s.wait = this.respawn;
        }
      } else {
        s.wait -= dt;
        // Don't pop in right next to the player.
        const near = target && Math.hypot(target.x - s.spot.x, target.y - s.spot.y) < 90;
        if (s.wait <= 0 && !near) s.monster = MONSTERS[s.spot.kind](this.world, s.spot.x, s.spot.y);
      }
    }
  }

  destroy(): void {
    for (const s of this.slots) s.monster?.destroy();
    this.slots = [];
  }
}

/** Push overlapping monsters apart, and out of the player's body. */
export function separate(monsters: Monster[], player: Target | null, playerRadius = 6): void {
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
    if (player) {
      const dx = a.x - player.x;
      const dy = (a.y - player.y) * 1.4;
      const min = a.radius + playerRadius;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0.01) a.shove((dx / d) * (min - d) * 0.6, ((dy / d) * (min - d) * 0.6) / 1.4);
    }
  }
}
