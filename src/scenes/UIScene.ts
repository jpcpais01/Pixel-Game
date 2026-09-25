import Phaser from 'phaser';
import { controls, beamHud, comboHud } from '../game/controls';
import { daynight } from '../game/daynight';
import { DPR as D } from '../game/display';
import { characterById } from '../game/characters';

/**
 * Touch controls: a floating joystick on the left half of the screen, an
 * attack button on the right and, above it, the special button (the wizard's
 * beam: hold to charge). Icons come from the chosen character. Rendered at
 * screen resolution over the world.
 *
 * With a mouse, a left click anywhere else on the world is the attack (the
 * world aims it at the cursor) and the joystick hides; the keyboard walks.
 */
export class UIScene extends Phaser.Scene {
  private stick!: Phaser.GameObjects.Graphics;
  private button!: Phaser.GameObjects.Graphics;
  private icon!: Phaser.GameObjects.Sprite;
  private stickPointer: number | null = null;
  private buttonPointer: number | null = null;
  private beamButton!: Phaser.GameObjects.Graphics;
  private beamIcon!: Phaser.GameObjects.Image;
  private beamPointer: number | null = null;
  private clickPointer: number | null = null;
  private base = new Phaser.Math.Vector2();
  private knob = new Phaser.Math.Vector2();
  private toggle!: Phaser.GameObjects.Graphics;
  private sun!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;

  /** Day/night toggle: a two-segment pill in the top-left corner. */
  private get toggleRect(): Phaser.Geom.Rectangle {
    const seg = Math.round(Math.max(48 * D, Math.min(this.scale.width, this.scale.height) * 0.13));
    return new Phaser.Geom.Rectangle(12 * D, 12 * D, seg * 2, Math.round(seg * 0.8));
  }

  /** What each Graphics last drew, so it is only rebuilt when that changes. */
  private drawn = new Map<Phaser.GameObjects.Graphics, string>();

  constructor() {
    super('ui');
  }

  /**
   * Clears `g` for redrawing if `state` differs from what it last drew, or
   * returns null to keep it. Rebuilding the circles means tessellating and
   * allocating every frame, which the touch controls rarely need.
   */
  private redraw(g: Phaser.GameObjects.Graphics, state: string): Phaser.GameObjects.Graphics | null {
    if (this.drawn.get(g) === state) return null;
    this.drawn.set(g, state);
    return g.clear();
  }

  private get R(): number {
    return Math.max(42 * D, Math.min(this.scale.width, this.scale.height) * 0.13);
  }

  private get buttonPos(): Phaser.Math.Vector2 {
    const R = this.R;
    // Inset from the edge by 70% of the button's diameter beyond the original spot.
    return new Phaser.Math.Vector2(this.scale.width - R * (1.55 + 0.7 * 1.68), this.scale.height - R * 1.45);
  }

  /** The beam button sits above and just outside the attack button, in easy reach of the thumb. */
  private get beamPos(): Phaser.Math.Vector2 {
    const R = this.R;
    const bp = this.buttonPos;
    return new Phaser.Math.Vector2(bp.x + R * 0.55, bp.y - R * 1.95);
  }

  private get restPos(): Phaser.Math.Vector2 {
    const R = this.R;
    // Inset from the edge by 70% of the joystick's diameter beyond the original spot.
    return new Phaser.Math.Vector2(R * (1.6 + 0.7 * 2), this.scale.height - R * 1.45);
  }

  create(data: { character?: string }): void {
    const hero = characterById(data?.character);
    this.stickPointer = this.buttonPointer = this.beamPointer = this.clickPointer = null;
    this.stick = this.add.graphics();
    this.button = this.add.graphics();
    const { attack, special } = hero.buttons;
    this.icon = this.add.sprite(0, 0, attack.texture, attack.frame).setBlendMode(Phaser.BlendModes.ADD);
    if (attack.anim) this.icon.play(attack.anim);
    this.beamButton = this.add.graphics();
    this.beamIcon = this.add.image(0, 0, special.texture).setBlendMode(Phaser.BlendModes.ADD);
    this.toggle = this.add.graphics();
    this.sun = this.add.image(0, 0, 'icon_sun');
    this.moon = this.add.image(0, 0, 'icon_moon');
    this.base.copy(this.restPos);
    this.knob.copy(this.restPos);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      controls.mouse = !p.wasTouch;
      const bp = this.buttonPos;
      const mp = this.beamPos;
      const tr = this.toggleRect;
      if (Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Clone(tr).setSize(tr.width + 8 * D, tr.height + 8 * D), p.x, p.y)) {
        // Tap a side to pick it; tapping the active side flips it.
        const onSun = p.x < tr.centerX;
        daynight.set(onSun === (daynight.target < 0.5) ? onSun : !onSun);
      } else if (Phaser.Math.Distance.Between(p.x, p.y, mp.x, mp.y) < this.R * 0.95) {
        this.beamPointer = p.id;
        controls.beam = true;
      } else if (Phaser.Math.Distance.Between(p.x, p.y, bp.x, bp.y) < this.R * 1.1) {
        this.buttonPointer = p.id;
        controls.attack = true;
      } else if (!p.wasTouch) {
        // Clicks on the pause and sound buttons never get here: their scenes sit on top and take them.
        if (p.leftButtonDown()) {
          this.clickPointer = p.id;
          controls.click = true;
        }
      } else if (p.x < this.scale.width * 0.55 && this.stickPointer === null) {
        this.stickPointer = p.id;
        this.base.set(p.x, p.y);
        this.knob.set(p.x, p.y);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) controls.mouse = true;
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
      if (p.id === this.beamPointer) {
        this.beamPointer = null;
        controls.beam = false;
      }
      if (p.id === this.clickPointer) {
        this.clickPointer = null;
        controls.click = false;
      }
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    // A paused scene misses its pointer-ups, so let go of everything on pause.
    this.events.on(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.events.off(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
    });
  }

  private onResize(): void {
    if (this.stickPointer === null) {
      this.base.copy(this.restPos);
      this.knob.copy(this.restPos);
    }
  }

  private releaseAll(): void {
    this.stickPointer = this.buttonPointer = this.beamPointer = this.clickPointer = null;
    controls.moveX = controls.moveY = 0;
    controls.attack = controls.beam = controls.click = false;
    this.base.copy(this.restPos);
    this.knob.copy(this.restPos);
  }

  update(): void {
    const R = this.R;
    const active = this.stickPointer !== null;
    this.stick.setVisible(active || !controls.mouse);
    const g = this.redraw(this.stick, `${active} ${this.base.x} ${this.base.y} ${this.knob.x} ${this.knob.y} ${R}`);
    if (g) {
      g.fillStyle(0x0a0c1c, active ? 0.45 : 0.28);
      g.fillCircle(this.base.x, this.base.y, R);
      g.lineStyle(2 * D, 0xb8c4ff, active ? 0.45 : 0.22);
      g.strokeCircle(this.base.x, this.base.y, R);
      g.fillStyle(0xdfe6ff, active ? 0.55 : 0.3);
      g.fillCircle(this.knob.x, this.knob.y, R * 0.42);
      g.lineStyle(2 * D, 0xffffff, active ? 0.5 : 0.2);
      g.strokeCircle(this.knob.x, this.knob.y, R * 0.42);
    }

    const bp = this.buttonPos;
    const pressed = this.buttonPointer !== null;
    const br = R * (pressed ? 0.78 : 0.84);
    this.icon.setPosition(bp.x, bp.y).setScale(Math.max(2, Math.round(R / 14)) * (pressed ? 0.9 : 1));
    const b = this.redraw(this.button, `${pressed} ${bp.x} ${bp.y} ${R} ${comboHud.window} ${comboHud.hits}`);
    if (b) {
      b.fillStyle(0x0c1433, pressed ? 0.75 : 0.55);
      b.fillCircle(bp.x, bp.y, br);
      b.lineStyle(3 * D, 0x6fe4ff, pressed ? 0.95 : 0.65);
      b.strokeCircle(bp.x, bp.y, br);
      b.lineStyle(1 * D, 0x6fe4ff, 0.25);
      b.strokeCircle(bp.x, bp.y, br + 6 * D);

      // Combo pips over the attack button: one per hit landed, and a thin arc
      // draining over the time left to chain the next.
      if (comboHud.window > 0) {
        const top = -Math.PI / 2;
        b.lineStyle(2 * D, 0xffd66b, 0.55 * Math.min(1, comboHud.window * 3));
        b.beginPath();
        b.arc(bp.x, bp.y, br + 6 * D, top, top + Math.PI * 2 * comboHud.window, false);
        b.strokePath();
        for (let i = 0; i < 3; i++) {
          const a = top + (i - 1) * 0.34;
          const px = bp.x + Math.cos(a) * (br + 15 * D);
          const py = bp.y + Math.sin(a) * (br + 15 * D);
          const lit = i < comboHud.hits;
          b.fillStyle(lit ? 0xffd66b : 0x0a0c1c, lit ? 0.95 : 0.5);
          b.fillCircle(px, py, 4 * D);
          b.lineStyle(1.5 * D, lit ? 0xfff4bf : 0xffd66b, lit ? 0.9 : 0.45);
          b.strokeCircle(px, py, 4 * D);
        }
      }
    }

    this.drawBeamButton(R);

    const tr = this.toggleRect;
    const seg = tr.width / 2;
    const d = daynight.daylight;
    const tg = this.redraw(this.toggle, `${d} ${tr.x} ${tr.y} ${tr.width} ${tr.height}`);
    if (tg) {
      tg.fillStyle(0x0a0c1c, 0.55);
      tg.fillRoundedRect(tr.x, tr.y, tr.width, tr.height, tr.height / 2);
      // Sliding highlight: warm under the sun, cool under the moon.
      const pad = 3 * D;
      const hx = tr.x + pad + (1 - d) * seg;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x6b74c9), Phaser.Display.Color.ValueToColor(0x8ec9f5), 100, Math.round(d * 100));
      tg.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 0.85);
      tg.fillRoundedRect(hx, tr.y + pad, seg - pad * 2, tr.height - pad * 2, (tr.height - pad * 2) / 2);
      tg.lineStyle(2 * D, 0xdfe6ff, 0.35);
      tg.strokeRoundedRect(tr.x, tr.y, tr.width, tr.height, tr.height / 2);
    }
    const iconScale = Math.max(2, Math.floor(tr.height / 16));
    this.sun
      .setPosition(tr.x + seg / 2, tr.centerY)
      .setScale(iconScale)
      .setAlpha(0.55 + d * 0.45);
    this.moon
      .setPosition(tr.x + seg * 1.5, tr.centerY)
      .setScale(iconScale)
      .setAlpha(1 - d * 0.45);
    // Under the toggle, clear of the FPS counter at the top centre.

  }
  /** The beam button, ringed by its charge: filling cyan, white-hot when full, draining violet when held too long. */
  private drawBeamButton(R: number): void {
    const mp = this.beamPos;
    const pressed = this.beamPointer !== null;
    const { charge, over, firing } = beamHud;
    const t = this.time.now;
    const full = charge >= 1;
    const br = R * (pressed ? 0.66 : 0.72);

    const scale = Math.max(2, Math.round(R / 16));
    const shake = over > 0.25 ? (Math.random() - 0.5) * over * 0.3 * D : 0;
    this.beamIcon
      .setPosition(Math.round(mp.x + shake), Math.round(mp.y))
      .setScale(scale * (pressed ? 0.9 : 1))
      .setAlpha(firing || full ? 1 : 0.7 + charge * 0.3);

    // The ring only animates with time while full or draining.
    const tick = full || over > 0 ? t : 0;
    const g = this.redraw(this.beamButton, `${pressed} ${charge} ${over} ${firing} ${mp.x} ${mp.y} ${R} ${tick}`);
    if (!g) return;

    g.fillStyle(firing ? 0x1a3a66 : 0x0c1433, pressed || firing ? 0.78 : 0.55);
    g.fillCircle(mp.x, mp.y, br);
    g.lineStyle(2 * D, 0x6fe4ff, pressed ? 0.5 : 0.65);
    g.strokeCircle(mp.x, mp.y, br);

    // Charge ring just outside the rim, filling clockwise from the top.
    const rr = br + 5 * D;
    const top = -Math.PI / 2;
    g.lineStyle(4 * D, 0x0a0c1c, 0.45);
    g.strokeCircle(mp.x, mp.y, rr);
    if (charge > 0) {
      let col = 0x39c6f0;
      let alpha = 0.95;
      let fill = charge;
      if (over > 0) {
        // Draining: the grace period left before the charge slips away, blinking faster near the end.
        col = 0xa27cff;
        fill = 1 - over;
        alpha = 0.6 + 0.4 * Math.abs(Math.sin(t * (0.008 + over * 0.02)));
      } else if (full) {
        col = 0xf2ffff;
        alpha = 0.75 + 0.25 * Math.sin(t * 0.012);
      }
      g.lineStyle(4 * D, col, alpha);
      g.beginPath();
      g.arc(mp.x, mp.y, rr, top, top + Math.PI * 2 * fill, false);
      g.strokePath();
      if (full && over === 0) {
        g.lineStyle(1.5 * D, 0x9ff6ff, 0.35 + 0.25 * Math.sin(t * 0.012));
        g.strokeCircle(mp.x, mp.y, rr + 5 * D);
      }
    } else {
      g.lineStyle(1 * D, 0x6fe4ff, 0.25);
      g.strokeCircle(mp.x, mp.y, rr);
    }
  }
}
