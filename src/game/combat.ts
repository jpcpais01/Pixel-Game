// The shared language of damage. Heroes strike through WorldScene.melee (an
// area) or WorldScene.strikeAt (a point, for projectiles); the world finds
// every Hurtbox inside and hands it a Hit. Monsters hurt the player through
// WorldScene.hurtHero. A new hero or monster only needs these types.

/** Where a blow reaches, in world pixels. Angles in radians. */
export type MeleeArea =
  | { kind: 'arc'; x: number; y: number; radius: number; angle: number; spread: number }
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'line'; x0: number; y0: number; x1: number; y1: number; radius: number };

/** What a hero's blow carries. */
export interface Strike {
  damage: number;
  /** Staggers monsters and throws them back harder. */
  heavy?: boolean;
  /** Knockback speed in world px/s (defaults: 60, or 130 when heavy). */
  knock?: number;
  /** Where the blow comes from, for the knockback direction. Defaults to the area's origin. */
  fromX?: number;
  fromY?: number;
  /** Poison: numbers pop up in this colour (the poison's own). */
  poison?: number;
  /** Dealt by a companion: its own numbers, not scaled by the hero's Damage. */
  companion?: boolean;
  /** Dealt by the world itself (a falling meteor): exactly `damage`, nothing of the hero's in it. */
  wild?: boolean;
}

/** A blow as it lands on one target. */
export interface Hit {
  damage: number;
  heavy: boolean;
  knock: number;
  fromX: number;
  fromY: number;
  poison?: number;
  companion?: boolean;
  wild?: boolean;
}

/** Anything the heroes can strike. (x, y) are the feet. */
export interface Hurtbox {
  readonly x: number;
  readonly y: number;
  /** Height of the body's centre above the feet. */
  readonly bodyY: number;
  /** Body radius. */
  readonly radius: number;
  /** False while it can't be struck (dying, spawning). */
  readonly alive: boolean;
  hurt(hit: Hit): void;
  /** Time around it runs at `k` of its pace (0 stands still) for `ms`; only monsters feel it. */
  slow?(k: number, ms: number, tint?: number): void;
  /** Its pace right now: 1, or less while slowed. */
  readonly tempo?: number;
  /** Up in the air (knocked up, or hoisted on strings); only monsters can be. */
  readonly airborne?: boolean;
}

/** What a monster's attack carries into the player. */
export interface Harm {
  damage: number;
  fromX: number;
  fromY: number;
  /** Knockback speed in world px/s. */
  knock?: number;
}

/** Health plus a barrier that soaks damage first. Owned by a hero, read by the world. */
export class Vitals {
  hp: number;
  barrier = 0;

  constructor(
    public max: number,
    readonly barrierMax = 0,
  ) {
    this.hp = max;
  }

  /** Raises (or lowers) max health, and health with it: gear worn or lost. */
  grow(amount: number): void {
    this.max += amount;
    this.hp = Math.max(1, Math.min(this.max, this.hp + amount));
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  /** Takes `amount`, barrier first; returns the health lost. */
  damage(amount: number): number {
    const soaked = Math.min(this.barrier, amount);
    this.barrier -= soaked;
    const lost = Math.min(this.hp, amount - soaked);
    this.hp -= lost;
    return lost;
  }

  /** Heals health first and the rest into the barrier; returns how much went to health. */
  heal(amount: number): number {
    const toHp = Math.min(amount, this.max - this.hp);
    this.hp += toHp;
    this.barrier = Math.min(this.barrierMax, this.barrier + amount - toHp);
    return toHp;
  }

  reset(): void {
    this.hp = this.max;
    this.barrier = 0;
  }
}

/** Does `area` reach a body centred at (bx, by) with radius `r`? */
export function reaches(area: MeleeArea, bx: number, by: number, r: number): boolean {
  if (area.kind === 'circle') return Math.hypot(bx - area.x, by - area.y) <= area.radius + r;
  if (area.kind === 'arc') {
    const dist = Math.hypot(bx - area.x, by - area.y);
    let off = Math.atan2(by - area.y, bx - area.x) - area.angle;
    off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
    return dist <= area.radius + r && (off <= area.spread || dist < r + 4);
  }
  const vx = area.x1 - area.x0;
  const vy = area.y1 - area.y0;
  const t = Math.max(0, Math.min(1, ((bx - area.x0) * vx + (by - area.y0) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(bx - (area.x0 + vx * t), by - (area.y0 + vy * t)) <= area.radius + r;
}

/**
 * Does `area` reach the whole body of `h`, not just its middle? The body is a
 * pillar of its radius from the feet up to the top of the sprite (2 x bodyY);
 * returns the point on it nearest the blow, or null when out of reach.
 */
export function reachesBody(area: MeleeArea, h: Hurtbox): { x: number; y: number } | null {
  const c = h.y - h.bodyY;
  const half = Math.max(0, h.bodyY - h.radius);
  let oy: number;
  if (area.kind === 'line') {
    const vx = area.x1 - area.x0;
    const vy = area.y1 - area.y0;
    const t = Math.max(0, Math.min(1, ((h.x - area.x0) * vx + (c - area.y0) * vy) / (vx * vx + vy * vy || 1)));
    oy = area.y0 + vy * t;
  } else oy = area.y;
  const by = Math.max(c - half, Math.min(c + half, oy));
  return reaches(area, h.x, by, h.radius) ? { x: h.x, y: by } : null;
}

/**
 * Does a projectile flying `fly` px above the ground point (gx, gy) touch `h`?
 * It does when its shadow crosses the feet, or when the projectile itself
 * passes through the sprite, anywhere from the feet to the head.
 */
export function inFlight(h: Hurtbox, gx: number, gy: number, fly: number, pad = 2): boolean {
  if (Math.abs(h.x - gx) > h.radius + pad) return false;
  if (Math.abs(h.y - gy) <= h.radius * 0.6 + 3.5) return true;
  const py = gy - fly;
  return py <= h.y + 1 && py >= h.y - h.bodyY * 2 - 2;
}

/** The point a knockback pushes away from. */
export function areaOrigin(area: MeleeArea): { x: number; y: number } {
  return area.kind === 'line' ? { x: area.x0, y: area.y0 } : { x: area.x, y: area.y };
}
