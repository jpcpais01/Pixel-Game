import { IMP_TINTS } from '../../art/omens';
import { sound } from '../../audio';
import type { WorldScene } from '../../scenes/WorldScene';
import { Monster, type Target } from './Monster';
import { mobHp } from '../tiers';

/** He runs a little slower than most heroes, so he can be caught, but he weaves. */
const RUN_SPEED = 54;
/** Past this far from the nearest hero he stops to jeer; further still he waits for them. */
const SAFE = 92;
const LOITER = 130;
const TAUNT_TIME = 950;
/** Close enough to his portal to dive in. */
const DIVE_REACH = 6;
/** A blow knocks a little dust out of his sack this often. */
const SPILL_CHANCE = 0.35;

/**
 * The Treasure Imp (an omen's): a goblin hauling a sack of loot. He never
 * fights; he runs from whoever is nearest, weaving and turning round walls,
 * stops to cackle once he is clear, and in the end makes for his portal.
 * Blows knock dust loose from his sack, and catching him bursts it.
 */
export class Imp extends Monster {
  /** Caught (slain) at (x, y): his sack bursts. Set by the omen. */
  onCaught: ((x: number, y: number) => void) | null = null;
  /** A blow knocked dust loose at (x, y). */
  onSpill: ((x: number, y: number) => void) | null = null;
  /** Making for his portal, and there. */
  private exit: { x: number; y: number } | null = null;
  private dived = false;
  private weave = Math.random() < 0.5 ? 1 : -1;
  private weaveT = 0;

  constructor(world: WorldScene, x: number, y: number) {
    super(world, x, y, {
      key: 'imp',
      hp: mobHp('imp'),
      radius: 5,
      bodyY: 10,
      speed: RUN_SPEED,
      sight: 400,
      leash: 99999,
      mass: 0.7,
      barY: 27,
      debris: IMP_TINTS,
    });
    this.hunter = true;
    this.cooldown = 1800;
  }

  /** He has reached his portal and jumped in. */
  get escaped(): boolean {
    return this.dived;
  }

  /** Time's up: he runs for his portal at (x, y). */
  escapeTo(x: number, y: number): void {
    this.exit = { x, y };
    if (this.state === 'recover') this.enter('chase', 0);
  }

  protected chase(dt: number, target: Target, dist: number): void {
    if (this.exit) {
      if (this.dived) {
        this.pose('hop0');
        return;
      }
      if (this.walkTo(dt, this.exit.x, this.exit.y, this.stats.speed * 1.25) || Math.hypot(this.exit.x - this.x, this.exit.y - this.y) < DIVE_REACH) {
        this.dived = true;
        this.pose('hop0');
      }
      return;
    }
    // Clear of them: a jeer, fingers waggling.
    if (dist > SAFE && this.cooldown === 0) {
      this.face(target.x - this.x);
      this.enter('recover', TAUNT_TIME);
      this.play('taunt', true);
      this.cooldown = 2600 + Math.random() * 1800;
      sound.cackle(this.world.pan(this.x));
      return;
    }
    if (dist > LOITER) {
      this.face(target.x - this.x);
      this.stand(dt);
      return;
    }
    // Away from them, weaving from side to side, and round anything in the way.
    this.weaveT -= dt;
    if (this.weaveT <= 0) {
      this.weaveT = 450 + Math.random() * 700;
      this.weave = -this.weave;
    }
    const away = Math.atan2(this.y - target.y, this.x - target.x) + this.weave * 0.45;
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2, Math.PI]) {
      const ux = Math.cos(away + turn);
      const uy = Math.sin(away + turn);
      if (!this.world.walkable(this.x + ux * 12, this.y + uy * 12)) continue;
      this.move(dt, ux, uy, this.stats.speed * (dist < 36 ? 1.15 : 1));
      return;
    }
    this.stand(dt);
  }

  /** Jeering: he holds still, until someone comes too close. */
  protected act(dt: number, _target: Target | null, dist: number): void {
    this.stand(dt);
    if (this.timer <= 0 || dist < 44 || this.exit) this.enter('chase', 0);
  }

  protected stand(_dt: number): void {
    if (this.state === 'recover') return;
    this.play('idle');
  }

  protected afterHit(): void {
    if (this.alive && Math.random() < SPILL_CHANCE) this.onSpill?.(this.x, this.y);
  }

  protected onDeath(): void {
    this.onCaught?.(this.x, this.y);
  }
}
