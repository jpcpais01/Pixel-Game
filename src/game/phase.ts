import Phaser from 'phaser';
import { sound } from '../audio';
import { snap } from './display';
import type { Hurtbox } from './combat';
import type { WorldScene } from '../scenes/WorldScene';

// The Phantom's phasing: a ghost is only half here. The next blow that would
// land on it passes straight through instead: it goes see-through for a
// moment, slips through foes and their attacks untouched, and chills (and
// slows) whatever it drifts through. Then it takes a while to gather itself
// before it can phase again. While it's ready, a faint ring breathes at its
// feet.

const PHASE_MS = 1200;
const PHASE_COOLDOWN = 6000;
/** Drifting faster while phased. */
export const PHASE_SPEED = 1.35;
const CHILL_DAMAGE = 4;
const CHILL_SLOW = 0.5;
const CHILL_MS = 700;

export class Phase {
  private t = 0;
  private cd = 0;
  private chilled = new Set<Hurtbox>();
  private ring: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    private owner: { x: number; y: number },
    private tint: number,
  ) {
    this.ring = world.add.image(0, 0, 'loot_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(2).setScale(0.35, 0.2);
  }

  get active(): boolean {
    return this.t > 0;
  }

  get ready(): boolean {
    return this.cd <= 0 && this.t <= 0;
  }

  /** A blow is coming: phase through it if ready. */
  dodge(): boolean {
    if (!this.ready) return false;
    this.t = PHASE_MS;
    this.cd = PHASE_COOLDOWN;
    this.chilled.clear();
    const w = this.world;
    const { x, y } = this.owner;
    w.evade(PHASE_MS);
    w.popNumber(snap(x), snap(y) - 40, 'PHASED', this.tint);
    w.debris([0xffffff, this.tint], snap(x), snap(y) - 14, 14, y + 20, 'spores');
    sound.wail(w.pan(x));
    return true;
  }

  update(dt: number): void {
    const { x, y } = this.owner;
    if (this.t > 0) {
      this.t -= dt;
      // Chill whatever it drifts through, once per phase each.
      for (const h of this.world.hurtboxesWhere((b) => b.alive && !this.chilled.has(b) && Math.hypot(b.x - x, b.y - y) <= b.radius + 7)) {
        this.chilled.add(h);
        h.hurt({ damage: CHILL_DAMAGE, heavy: false, knock: 10, fromX: x, fromY: y });
        h.slow?.(CHILL_SLOW, CHILL_MS, this.tint);
        this.world.debris([0xffffff, this.tint], h.x, h.y - h.bodyY, 4, h.y + 10, 'spores');
      }
    } else this.cd -= dt;
    const breathe = 0.5 + 0.5 * Math.sin(this.world.time.now * 0.004);
    this.ring.setPosition(snap(x), snap(y)).setAlpha(this.ready ? 0.18 + breathe * 0.14 : 0);
  }

  /** How see-through the ghost is now: faint while phased. */
  get opacity(): number {
    return this.t > 0 ? 0.4 + 0.1 * Math.sin(this.t * 0.03) : 1;
  }

  destroy(): void {
    this.ring.destroy();
  }
}
