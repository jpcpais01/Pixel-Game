import Phaser from 'phaser';
import { CELL_H } from '../art/font';
import { DPR } from '../game/display';
import { pixelText } from '../ui/widgets';

/** Device pixels per font pixel for the counter. */
const fpsScale = () => Math.max(2, Math.round(DPR * 1.5));
const fpsTop = () => Math.round(6 * DPR);

/** Bottom edge of the counter in device pixels, so menus can keep clear of it. */
export const fpsBottom = () => fpsTop() + CELL_H * fpsScale();

/** A small frame-rate counter at the top centre of the screen, over every scene. */
export class FpsScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.BitmapText;
  private since = 0;

  constructor() {
    super('fps');
  }

  create(): void {
    this.cameras.main.setOrigin(0, 0).setZoom(fpsScale());
    this.text = pixelText(this, 0, 0, '-- FPS', 0xdfe6ff).setAlpha(0.85);
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this));
  }

  update(_time: number, dt: number): void {
    this.since += dt;
    if (this.since < 500) return;
    this.since = 0;
    const fps = Math.round(this.game.loop.actualFps);
    this.text.setText(`${fps} FPS`).setTint(fps >= 55 ? 0x9dffb0 : fps >= 30 ? 0xffe28a : 0xff8a8a);
    this.place();
  }

  private place(): void {
    const s = fpsScale();
    this.text.setPosition(Math.round((this.scale.width / s - this.text.width) / 2), Math.round(fpsTop() / s));
  }
}
