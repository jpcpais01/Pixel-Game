import Phaser from 'phaser';
import { controls } from '../game/controls';

/**
 * Touch controls: a floating joystick on the left half of the screen and an
 * attack button on the right. Rendered at screen resolution over the world.
 */
export class UIScene extends Phaser.Scene {
  private stick!: Phaser.GameObjects.Graphics;
  private button!: Phaser.GameObjects.Graphics;
  private icon!: Phaser.GameObjects.Sprite;
  private stickPointer: number | null = null;
  private buttonPointer: number | null = null;
  private base = new Phaser.Math.Vector2();
  private knob = new Phaser.Math.Vector2();
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('ui');
  }

  private get R(): number {
    return Math.max(42, Math.min(this.scale.width, this.scale.height) * 0.13);
  }

  private get buttonPos(): Phaser.Math.Vector2 {
    const R = this.R;
    return new Phaser.Math.Vector2(this.scale.width - R * 1.55, this.scale.height - R * 1.45);
  }

  private get restPos(): Phaser.Math.Vector2 {
    const R = this.R;
    return new Phaser.Math.Vector2(R * 1.6, this.scale.height - R * 1.45);
  }

  create(): void {
    this.stick = this.add.graphics();
    this.button = this.add.graphics();
    this.icon = this.add.sprite(0, 0, 'orb_e', 'o0').setBlendMode(Phaser.BlendModes.ADD);
    this.icon.play('orb_spin');
    this.hint = this.add
      .text(12, 10, 'Wizard preview  ·  joystick or WASD to walk  ·  button or Space to cast', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: '12px',
        color: '#a9b4e8',
      })
      .setAlpha(0.75);
    this.base.copy(this.restPos);
    this.knob.copy(this.restPos);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      const bp = this.buttonPos;
      if (Phaser.Math.Distance.Between(p.x, p.y, bp.x, bp.y) < this.R * 1.1) {
        this.buttonPointer = p.id;
        controls.attack = true;
      } else if (p.x < this.scale.width * 0.55 && this.stickPointer === null) {
        this.stickPointer = p.id;
        this.base.set(p.x, p.y);
        this.knob.set(p.x, p.y);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointer) return;
      const R = this.R;
      const v = new Phaser.Math.Vector2(p.x - this.base.x, p.y - this.base.y);
      if (v.length() > R) v.setLength(R);
      this.knob.set(this.base.x + v.x, this.base.y + v.y);
      const m = v.length() / R;
      const dead = 0.12;
      const s = m < dead ? 0 : (m - dead) / (1 - dead) / (m || 1);
      controls.moveX = v.x / R * s;
      controls.moveY = v.y / R * s;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointer) {
        this.stickPointer = null;
        controls.moveX = 0;
        controls.moveY = 0;
        this.base.copy(this.restPos);
        this.knob.copy(this.restPos);
      }
      if (p.id === this.buttonPointer) {
        this.buttonPointer = null;
        controls.attack = false;
      }
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      if (this.stickPointer === null) {
        this.base.copy(this.restPos);
        this.knob.copy(this.restPos);
      }
    });
  }

  update(): void {
    const R = this.R;
    const active = this.stickPointer !== null;
    const g = this.stick.clear();
    g.fillStyle(0x0a0c1c, active ? 0.45 : 0.28);
    g.fillCircle(this.base.x, this.base.y, R);
    g.lineStyle(2, 0xb8c4ff, active ? 0.45 : 0.22);
    g.strokeCircle(this.base.x, this.base.y, R);
    g.fillStyle(0xdfe6ff, active ? 0.55 : 0.3);
    g.fillCircle(this.knob.x, this.knob.y, R * 0.42);
    g.lineStyle(2, 0xffffff, active ? 0.5 : 0.2);
    g.strokeCircle(this.knob.x, this.knob.y, R * 0.42);

    const bp = this.buttonPos;
    const pressed = this.buttonPointer !== null;
    const br = R * (pressed ? 0.78 : 0.84);
    const b = this.button.clear();
    b.fillStyle(0x0c1433, pressed ? 0.75 : 0.55);
    b.fillCircle(bp.x, bp.y, br);
    b.lineStyle(3, 0x6fe4ff, pressed ? 0.95 : 0.65);
    b.strokeCircle(bp.x, bp.y, br);
    b.lineStyle(1, 0x6fe4ff, 0.25);
    b.strokeCircle(bp.x, bp.y, br + 6);
    this.icon.setPosition(bp.x, bp.y).setScale(Math.max(2, Math.round(R / 14)) * (pressed ? 0.9 : 1));

    // Hide the keyboard hint on small touch screens.
    this.hint.setVisible(this.scale.width > 700 || !this.sys.game.device.input.touch);
  }
}
