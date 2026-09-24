import Phaser from 'phaser';
import { sound } from '../audio';

/** A small speaker button in the top-right corner (M on a keyboard) that mutes all sound. */
export class SoundScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private zone!: Phaser.GameObjects.Zone;
  private pressed = false;

  constructor() {
    super('sound');
  }

  private get size(): number {
    return Math.round(Math.max(34, Math.min(this.scale.width, this.scale.height) * 0.075));
  }

  create(): void {
    this.g = this.add.graphics();
    this.zone = this.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.pressed = true;
      // The very first tap only wakes the audio up; later taps toggle it.
      if (sound.running || sound.muted) sound.toggleMute();
      this.draw();
    });
    const release = () => {
      this.pressed = false;
      this.draw();
    };
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, release);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
    this.input.keyboard?.on('keydown-M', () => sound.toggleMute());

    const off = sound.onChange(() => this.draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.draw());
    this.draw();
  }

  private draw(): void {
    const s = this.size;
    const pad = 12;
    const x = this.scale.width - s - pad;
    const y = pad;
    this.zone.setPosition(x - 6, y - 6).setSize(s + 12, s + 12);
    this.zone.input!.hitArea.setTo(0, 0, s + 12, s + 12);

    const on = sound.running && !sound.muted;
    const g = this.g.clear();
    g.fillStyle(0x0a0c1c, this.pressed ? 0.6 : 0.42);
    g.fillRoundedRect(x, y, s, s, s * 0.22);
    g.lineStyle(2, 0xb8c4ff, on ? 0.45 : 0.25);
    g.strokeRoundedRect(x, y, s, s, s * 0.22);

    // Speaker: a box and a cone, then sound waves or a cross.
    const u = s / 24;
    const cx = x + s / 2;
    const cy = y + s / 2;
    const ink = on ? 0xdfe6ff : 0x8a93bd;
    g.fillStyle(ink, on ? 0.9 : 0.7);
    g.fillRect(cx - 8 * u, cy - 3 * u, 4 * u, 6 * u);
    g.fillTriangle(cx - 5 * u, cy, cx + 1 * u, cy - 7 * u, cx + 1 * u, cy + 7 * u);
    g.fillRect(cx - 5 * u, cy - 3 * u, 6 * u, 6 * u);
    if (on) {
      g.lineStyle(Math.max(1.5, 1.6 * u), ink, 0.9);
      for (const r of [4.5, 8]) {
        g.beginPath();
        g.arc(cx + 1 * u, cy, r * u, -0.8, 0.8);
        g.strokePath();
      }
    } else {
      g.lineStyle(Math.max(1.5, 1.8 * u), ink, 0.8);
      g.lineBetween(cx + 4 * u, cy - 3.5 * u, cx + 10 * u, cy + 3.5 * u);
      g.lineBetween(cx + 10 * u, cy - 3.5 * u, cx + 4 * u, cy + 3.5 * u);
    }
  }
}
