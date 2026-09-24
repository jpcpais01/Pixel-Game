import Phaser from 'phaser';
import { CELL_H } from '../art/font';
import { DPR } from '../game/display';
import { settings } from '../game/settings';
import { pixelText } from '../ui/widgets';

/** Device pixels per font pixel for the counter. */
const fpsScale = () => Math.max(2, Math.round(DPR * 1.5));
const fpsTop = () => Math.round(6 * DPR);

/** Bottom edge of the counter in device pixels, so menus can keep clear of it. */
export const fpsBottom = () => fpsTop() + CELL_H * fpsScale();

/**
 * A small frame-rate counter at the top centre of the screen, over every
 * scene. Beside the frame rate it shows how long each frame's update and
 * render take on the CPU, averaged: when that is far below the frame's
 * length (16.7 ms at 60 FPS), the screen's refresh rate is what caps the
 * frame rate, not the game.
 */
export class FpsScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.BitmapText;
  private since = 0;
  private stepStart = 0;
  private work = 0;
  private frames = 0;

  constructor() {
    super('fps');
  }

  create(): void {
    this.cameras.main.setOrigin(0, 0).setZoom(fpsScale());
    this.text = pixelText(this, 0, 0, '-- FPS', 0xdfe6ff).setAlpha(0.85);
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);
    const events = this.game.events;
    const start = () => {
      this.stepStart = performance.now();
    };
    const end = () => {
      this.work += performance.now() - this.stepStart;
      this.frames++;
    };
    events.on(Phaser.Core.Events.PRE_STEP, start);
    events.on(Phaser.Core.Events.POST_RENDER, end);
    const off = settings.watch((s) => this.text.setVisible(s.showFps));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this);
      events.off(Phaser.Core.Events.PRE_STEP, start);
      events.off(Phaser.Core.Events.POST_RENDER, end);
    });
  }

  update(_time: number, dt: number): void {
    this.since += dt;
    if (this.since < 500) return;
    this.since = 0;
    const fps = Math.round(this.game.loop.actualFps);
    const ms = this.frames ? this.work / this.frames : 0;
    this.work = 0;
    this.frames = 0;
    this.text.setText(`${fps} FPS  ${ms.toFixed(1)} MS`).setTint(fps >= 55 ? 0x9dffb0 : fps >= 30 ? 0xffe28a : 0xff8a8a);
    this.place();
  }

  private place(): void {
    const s = fpsScale();
    this.cameras.main.setZoom(s);
    this.text.setPosition(Math.round((this.scale.width / s - this.text.width) / 2), Math.round(fpsTop() / s));
  }
}
