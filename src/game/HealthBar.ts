import Phaser from 'phaser';

const W = 20; // inner width in art pixels
const DEPTH = 10001; // over the world and its cloud shadows
const HP = 0x4fbf45;
const HP_LIT = 0xa6f27c;
const BARRIER = 0xf2b73a;
const BARRIER_LIT = 0xfff0a8;

/**
 * A small bar over a character's head: health in green, and any barrier in
 * gold after it (the bar rescales when health and barrier together overflow
 * it). It shows while anything is missing, shielded or just changed, then
 * fades away.
 */
export class HealthBar {
  private parts: Phaser.GameObjects.Image[];
  private frame: Phaser.GameObjects.Image;
  private back: Phaser.GameObjects.Image;
  private hp: Phaser.GameObjects.Image;
  private hpLit: Phaser.GameObjects.Image;
  private barrier: Phaser.GameObjects.Image;
  private barrierLit: Phaser.GameObjects.Image;
  private shown = 0;
  private hold = 0;
  private last = '';

  constructor(scene: Phaser.Scene) {
    const bar = (tint: number) => scene.add.image(0, 0, '__WHITE').setOrigin(0).setTint(tint).setDepth(DEPTH).setAlpha(0);
    this.frame = bar(0x0a0c1c);
    this.back = bar(0x2a2150);
    this.hp = bar(HP);
    this.hpLit = bar(HP_LIT);
    this.barrier = bar(BARRIER);
    this.barrierLit = bar(BARRIER_LIT);
    this.parts = [this.frame, this.back, this.hp, this.hpLit, this.barrier, this.barrierLit];
  }

  /** (x, y) is the bar's centre top, on the character's pixel grid. */
  update(dt: number, x: number, y: number, hp: number, max: number, barrier: number): void {
    const key = `${Math.round(hp)} ${Math.round(barrier)}`;
    if (key !== this.last || hp < max || barrier > 0.5) this.hold = 1800;
    else this.hold = Math.max(0, this.hold - dt);
    this.last = key;
    this.shown = Phaser.Math.Clamp(this.shown + (this.hold > 0 ? dt / 150 : -dt / 400), 0, 1);
    for (const p of this.parts) p.setVisible(this.shown > 0).setAlpha(this.shown);
    if (this.shown === 0) return;

    const total = Math.max(max, hp + barrier);
    const hw = (W * Math.max(0, hp)) / total;
    const bw = (W * Math.max(0, barrier)) / total;
    const left = x - W / 2;
    this.frame.setPosition(left - 1, y).setDisplaySize(W + 2, 4);
    this.back.setPosition(left, y + 1).setDisplaySize(W, 2);
    this.hp.setPosition(left, y + 1).setDisplaySize(hw, 2);
    this.hpLit.setPosition(left, y + 1).setDisplaySize(hw, 1);
    this.barrier.setPosition(left + hw, y + 1).setDisplaySize(bw, 2);
    this.barrierLit.setPosition(left + hw, y + 1).setDisplaySize(bw, 1);
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
  }
}
