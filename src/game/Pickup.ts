import Phaser from 'phaser';
import { ITEMS, type ItemId } from './items';
import { DROP_H } from '../art/items';

/** Pulled towards the hero from this close, and picked up at this distance. */
const MAGNET = 30;
const REACH = 7;
/** Lies on the ground this long, blinking for the last few seconds. */
const LIFE = 60000;
const BLINK = 5000;
const POP_TIME = 420;

/**
 * An item lying on the ground: it hops out of a slain monster, bobs over a
 * soft glow and a shadow, drifts to the hero once they come near and is
 * picked up on touch (when the hotbar has room).
 */
export class Pickup {
  dead = false;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private age = 0;
  private fromX: number;
  private fromY: number;
  private seed = Math.random() * 10;

  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
    readonly id: ItemId,
  ) {
    const item = ITEMS[id];
    this.fromX = x;
    this.fromY = y;
    // Lands a short hop away from where it fell.
    const a = Math.random() * Math.PI * 2;
    this.x += Math.cos(a) * 10;
    this.y += Math.sin(a) * 6;
    this.shadow = scene.add.image(x, y, 'shadow').setScale(0.55, 0.8).setDepth(1).setAlpha(0.7);
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(item.tint).setScale(0.75).setAlpha(0);
    this.sprite = scene.add.image(x, y, item.drop).setOrigin(0.5, (DROP_H - 1) / DROP_H);
  }

  /** `hx, hy` are the hero's feet, or null when they can't pick things up. Returns true once touched. */
  update(dt: number, hx: number | null, hy: number | null, room: boolean, daylight: number): boolean {
    this.age += dt;
    let x: number;
    let y: number;
    let lift: number;
    if (this.age < POP_TIME) {
      // The hop out: an arc from the monster's body to the ground.
      const t = this.age / POP_TIME;
      x = this.fromX + (this.x - this.fromX) * t;
      y = this.fromY + (this.y - this.fromY) * t;
      lift = Math.sin(t * Math.PI) * 14 + (1 - t) * 6;
    } else {
      if (hx !== null && hy !== null && room) {
        const dx = hx - this.x;
        const dy = hy - this.y;
        const d = Math.hypot(dx, dy);
        if (d < REACH) return true;
        if (d < MAGNET) {
          const k = Math.min(1, (dt / 1000) * (60 + (MAGNET - d) * 6) / d);
          this.x += dx * k;
          this.y += dy * k;
        }
      }
      x = this.x;
      y = this.y;
      lift = 2 + Math.sin(this.age * 0.004 + this.seed) * 1.5;
    }
    const left = LIFE - this.age;
    if (left <= 0) {
      this.destroy();
      return false;
    }
    const blink = left < BLINK && Math.sin(this.age * 0.02) < -0.2 ? 0.25 : 1;
    const rx = Math.round(x);
    const ry = Math.round(y);
    // Unlit art, so dim it a touch at night to sit with the lit world; the glow carries it.
    const shade = Math.round(255 * (0.72 + 0.28 * daylight));
    this.sprite.setPosition(rx, Math.round(ry - lift)).setDepth(ry).setAlpha(blink).setTint(Phaser.Display.Color.GetColor(shade, shade, Math.min(255, shade + 20)));
    this.glow.setPosition(rx, Math.round(ry - lift - 4)).setDepth(ry - 0.1).setAlpha((0.35 + 0.15 * Math.sin(this.age * 0.006 + this.seed)) * (1.3 - daylight * 0.5) * blink);
    this.shadow.setPosition(rx, ry).setAlpha(0.6 * blink);
    return false;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const o of [this.sprite, this.glow, this.shadow]) o.destroy();
  }
}
