import Phaser from 'phaser';
import { BUTTON_GOLD, PANEL_INSET, panelTexture } from './widgets';

const TRACK_H = 8;
const KNOB_W = 6;
const KNOB_H = 12;
/** Extra touch area around the track, in art px. */
const REACH = 5;

/**
 * A pixel-art slider for a 0..1 value: an inset track, a filled bar and a
 * gold knob. Drag anywhere along it; `onChange` fires as the value moves.
 * Positioned by its top-left corner at the scene's root (not in a container).
 */
export class PixelSlider extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH = KNOB_H;
  private value: number;
  private fill: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Image;
  private dragging: number | null = null;

  constructor(scene: Phaser.Scene, w: number, value: number, private color: number, private onChange: (v: number) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.value = value;
    const ty = (KNOB_H - TRACK_H) / 2;
    const track = scene.add.image(0, ty, panelTexture(scene, 'slider', w, TRACK_H, PANEL_INSET)).setOrigin(0);
    this.fill = scene.add.graphics();
    this.knob = scene.add.image(0, 0, panelTexture(scene, 'knob', KNOB_W, KNOB_H, BUTTON_GOLD[0])).setOrigin(0);
    const hit = scene.add
      .zone(-REACH, -REACH, w + REACH * 2, KNOB_H + REACH * 2)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.add([track, this.fill, this.knob, hit]);
    scene.add.existing(this);

    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragging = p.id;
      this.drag(p);
    });
    const move = (p: Phaser.Input.Pointer) => {
      if (p.id === this.dragging) this.drag(p);
    };
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.dragging) this.dragging = null;
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, move);
    scene.input.on(Phaser.Input.Events.POINTER_UP, release);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, move);
      scene.input.off(Phaser.Input.Events.POINTER_UP, release);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    });
    this.draw();
  }

  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  setValue(v: number): this {
    this.value = Phaser.Math.Clamp(v, 0, 1);
    this.draw();
    return this;
  }

  private drag(p: Phaser.Input.Pointer): void {
    const cam = this.scene.cameras.main;
    const local = p.positionToCamera(cam) as Phaser.Math.Vector2;
    const span = this.boxW - KNOB_W;
    // Snap to 5% steps so the knob lands on whole art pixels and values stay tidy.
    const v = Math.round(Phaser.Math.Clamp((local.x - this.x - KNOB_W / 2) / span, 0, 1) * 20) / 20;
    if (v === this.value) return;
    this.value = v;
    this.draw();
    this.onChange(v);
  }

  private draw(): void {
    const span = this.boxW - KNOB_W;
    const kx = Math.round(this.value * span);
    const ty = (KNOB_H - TRACK_H) / 2;
    const g = this.fill.clear();
    if (kx > 0) {
      g.fillStyle(this.color, 0.9).fillRect(2, ty + 2, kx + 1, TRACK_H - 4);
      g.fillStyle(0xffffff, 0.35).fillRect(2, ty + 2, kx + 1, 1);
    }
    this.knob.setX(kx);
  }
}
