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
}

/** A blow as it lands on one target. */
export interface Hit {
  damage: number;
  heavy: boolean;
  knock: number;
  fromX: number;
  fromY: number;
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
    readonly max: number,
    readonly barrierMax = 0,
  ) {
    this.hp = max;
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

/** The point a knockback pushes away from. */
export function areaOrigin(area: MeleeArea): { x: number; y: number } {
  return area.kind === 'line' ? { x: area.x0, y: area.y0 } : { x: area.x, y: area.y };
}
