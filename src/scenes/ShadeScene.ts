import Phaser from 'phaser';
import { settings } from '../game/settings';

/**
 * The brightness setting, as one full-screen quad between the world and the
 * HUD: black at partial alpha darkens, an additive grey lifts the shadows.
 * Hidden at the neutral setting, so it costs nothing by default.
 */
export class ShadeScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private lift!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('shade');
  }

  create(): void {
    this.cameras.main.setOrigin(0, 0);
    this.dim = this.add.rectangle(0, 0, 1, 1, 0x000000).setOrigin(0);
    this.lift = this.add.rectangle(0, 0, 1, 1, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    const off = settings.watch((s) => this.apply(s.brightness));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this);
    });
  }

  private fit(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.lift.setSize(width, height);
  }

  private apply(b: number): void {
    const d = b - 0.5;
    this.dim.setVisible(d < 0).setAlpha(Math.max(0, -d) * 1.1);
    const lift = Math.round(Math.max(0, d) * 0.36 * 255);
    this.lift.setVisible(d > 0).setFillStyle(Phaser.Display.Color.GetColor(lift, lift, lift));
  }
}
