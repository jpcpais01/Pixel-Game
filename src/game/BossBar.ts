import Phaser from 'phaser';
import { pixelGrid } from './display';

const W = 150; // inner width in art pixels
const DEPTH = 10005;

/**
 * A boss's health across the top of the screen, with its name above it.
 * The part just lost lingers as a pale trail before it drains away. It
 * fades in when the fight starts and out when it ends.
 */
export class BossBar {
  private parts: Phaser.GameObjects.Image[];
  private frame: Phaser.GameObjects.Image;
  private back: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;
  private lit: Phaser.GameObjects.Image;
  private capL: Phaser.GameObjects.Image;
  private capR: Phaser.GameObjects.Image;
  private name: Phaser.GameObjects.BitmapText;
  private shown = 0;
  private trailHp = -1;
  private hold = 0;

  constructor(
    private scene: Phaser.Scene,
    title: string,
  ) {
    const bar = (tint: number) => scene.add.image(0, 0, '__WHITE').setOrigin(0).setTint(tint).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);
    this.frame = bar(0x07061a);
    this.back = bar(0x1c1540);
    this.trail = bar(0xf4e8ff);
    this.fill = bar(0x8a4cf0);
    this.lit = bar(0xd8c0ff);
    this.capL = bar(0xe0a838);
    this.capR = bar(0xe0a838);
    this.name = scene.add.bitmapText(0, 0, 'pixel', title.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(0xeadcff).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);
    this.parts = [this.frame, this.back, this.trail, this.fill, this.lit, this.capL, this.capR];
  }

  /** `enraged` turns the bar from violet to rose. */
  update(dt: number, hp: number, max: number, show: boolean, enraged: boolean): void {
    this.shown = Phaser.Math.Clamp(this.shown + (show ? dt / 400 : -dt / 600), 0, 1);
    const vis = this.shown > 0;
    for (const p of this.parts) p.setVisible(vis).setAlpha(this.shown);
    this.name.setVisible(vis).setAlpha(this.shown);
    if (!vis) return;

    hp = Math.max(0, hp);
    if (this.trailHp < hp) this.trailHp = hp;
    if (this.trailHp > hp) {
      this.hold -= dt;
      if (this.hold <= 0) this.trailHp = Math.max(hp, this.trailHp - (max * dt) / 1400);
    } else this.hold = 450;

    // Screen-fixed: the zoom pivots on the screen's centre, so place by offsets from it in art pixels.
    const { width, height } = this.scene.scale;
    const z = pixelGrid.zoom;
    const viewW = width / z;
    const w = Math.min(W, Math.floor(viewW - 70));
    const cx = width / 2;
    const top = height / 2 + Math.round(-height / z / 2 + 16);
    const left = cx - Math.round(w / 2);
    const fw = Math.round((w * hp) / max);
    const tw = Math.round((w * this.trailHp) / max);
    this.frame.setPosition(left - 1, top - 1).setDisplaySize(w + 2, 6);
    this.back.setPosition(left, top).setDisplaySize(w, 4);
    this.trail.setPosition(left, top).setDisplaySize(tw, 4).setAlpha(this.shown * 0.7);
    this.fill.setPosition(left, top).setDisplaySize(fw, 4).setTint(enraged ? 0xe03a8a : 0x8a4cf0);
    this.lit.setPosition(left, top).setDisplaySize(fw, 1).setTint(enraged ? 0xffb0d8 : 0xd8c0ff);
    this.capL.setPosition(left - 3, top - 2).setDisplaySize(2, 8);
    this.capR.setPosition(left + w + 1, top - 2).setDisplaySize(2, 8);
    this.name.setPosition(cx, top - 3);
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
    this.name.destroy();
  }
}
