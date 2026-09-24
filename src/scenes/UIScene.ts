import Phaser from 'phaser';
import { controls } from '../game/controls';
import { daynight } from '../game/daynight';
import { DPR as D } from '../game/display';

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
  private toggle!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;

  /** Day/night toggle: a two-segment pill in the top-left corner. */
  private get toggleRect(): Phaser.Geom.Rectangle {
    const seg = Math.round(Math.max(48 * D, Math.min(this.scale.width, this.scale.height) * 0.13));
    return new Phaser.Geom.Rectangle(12 * D, 12 * D, seg * 2, Math.round(seg * 0.8));
  }

  constructor() {
    super('ui');
  }

  private get R(): number {
    return Math.max(42 * D, Math.min(this.scale.width, this.scale.height) * 0.13);
  }

  private get buttonPos(): Phaser.Math.Vector2 {
    const R = this.R;
    // Inset from the edge by 70% of the button's diameter beyond the original spot.
    return new Phaser.Math.Vector2(this.scale.width - R * (1.55 + 0.7 * 1.68), this.scale.height - R * 1.45);
  }

  private get restPos(): Phaser.Math.Vector2 {
    const R = this.R;
    // Inset from the edge by 70% of the joystick's diameter beyond the original spot.
    return new Phaser.Math.Vector2(R * (1.6 + 0.7 * 2), this.scale.height - R * 1.45);
  }

  create(): void {
    this.stick = this.add.graphics();
    this.button = this.add.graphics();
    this.icon = this.add.sprite(0, 0, 'orb_e', 'o0').setBlendMode(Phaser.BlendModes.ADD);
    this.icon.play('orb_spin');
    this.toggle = this.add.graphics();
    this.sun = this.add.image(0, 0, 'icon_sun');
    this.moon = this.add.image(0, 0, 'icon_moon');
    this.hint = this.add
      .text(12 * D, 10 * D, 'Joystick or WASD to walk  ·  button or Space to cast  ·  N for day/night', {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: `${12 * D}px`,
        color: '#dfe6ff',
        stroke: '#0a0c1c',
        strokeThickness: 3 * D,
      })
      .setAlpha(0.75);
    this.base.copy(this.restPos);
    this.knob.copy(this.restPos);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      const bp = this.buttonPos;
      const tr = this.toggleRect;
      if (Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Clone(tr).setSize(tr.width + 8 * D, tr.height + 8 * D), p.x, p.y)) {
        // Tap a side to pick it; tapping the active side flips it.
        const onSun = p.x < tr.centerX;
        daynight.set(onSun === (daynight.target < 0.5) ? onSun : !onSun);
      } else if (Phaser.Math.Distance.Between(p.x, p.y, bp.x, bp.y) < this.R * 1.1) {
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
    g.lineStyle(2 * D, 0xb8c4ff, active ? 0.45 : 0.22);
    g.strokeCircle(this.base.x, this.base.y, R);
    g.fillStyle(0xdfe6ff, active ? 0.55 : 0.3);
    g.fillCircle(this.knob.x, this.knob.y, R * 0.42);
    g.lineStyle(2 * D, 0xffffff, active ? 0.5 : 0.2);
    g.strokeCircle(this.knob.x, this.knob.y, R * 0.42);

    const bp = this.buttonPos;
    const pressed = this.buttonPointer !== null;
    const br = R * (pressed ? 0.78 : 0.84);
    const b = this.button.clear();
    b.fillStyle(0x0c1433, pressed ? 0.75 : 0.55);
    b.fillCircle(bp.x, bp.y, br);
    b.lineStyle(3 * D, 0x6fe4ff, pressed ? 0.95 : 0.65);
    b.strokeCircle(bp.x, bp.y, br);
    b.lineStyle(1 * D, 0x6fe4ff, 0.25);
    b.strokeCircle(bp.x, bp.y, br + 6 * D);
    this.icon.setPosition(bp.x, bp.y).setScale(Math.max(2, Math.round(R / 14)) * (pressed ? 0.9 : 1));

    const tr = this.toggleRect;
    const seg = tr.width / 2;
    const d = daynight.daylight;
    const tg = this.toggle.clear();
    tg.fillStyle(0x0a0c1c, 0.55);
    tg.fillRoundedRect(tr.x, tr.y, tr.width, tr.height, tr.height / 2);
    // Sliding highlight: warm under the sun, cool under the moon.
    const pad = 3 * D;
    const hx = tr.x + pad + (1 - d) * seg;
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x6b74c9),
      Phaser.Display.Color.ValueToColor(0x8ec9f5),
      100,
      Math.round(d * 100),
    );
    tg.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 0.85);
    tg.fillRoundedRect(hx, tr.y + pad, seg - pad * 2, tr.height - pad * 2, (tr.height - pad * 2) / 2);
    tg.lineStyle(2 * D, 0xdfe6ff, 0.35);
    tg.strokeRoundedRect(tr.x, tr.y, tr.width, tr.height, tr.height / 2);
    const iconScale = Math.max(2, Math.floor(tr.height / 16));
    this.sun.setPosition(tr.x + seg / 2, tr.centerY).setScale(iconScale).setAlpha(0.55 + d * 0.45);
    this.moon.setPosition(tr.x + seg * 1.5, tr.centerY).setScale(iconScale).setAlpha(1 - d * 0.45);
    this.hint.setPosition(tr.right + 14 * D, tr.centerY - this.hint.height / 2);

    // Hide the keyboard hint on small touch screens.
    this.hint.setVisible(this.scale.width > 700 * D || !this.sys.game.device.input.touch);
  }
}
