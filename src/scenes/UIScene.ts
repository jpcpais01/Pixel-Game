import Phaser from 'phaser';
import { controls, beamHud, comboHud } from '../game/controls';
import { daynight } from '../game/daynight';
import { DPR as D } from '../game/display';
import { characterById } from '../game/characters';
import { HOTBAR_SIZE, inventory } from '../game/items';
import { heroBuffs } from '../game/buffs';

/**
 * Touch controls: a floating joystick on the left half of the screen, an
 * attack button on the right and, above it, the special button (the wizard's
 * beam: hold to charge). Icons come from the chosen character. Rendered at
 * screen resolution over the world.
 *
 * With a mouse, a left click on the world is the attack (the world aims it
 * at the cursor), Space the special and the keyboard walks, so the joystick
 * hides and the ability buttons shrink to indicators above the hotbar.
 *
 * Along the bottom, between the joystick and the buttons, the hotbar: nine
 * item slots, tapped or pressed 1 to 9. Active buffs show as badges under the
 * day/night toggle, draining as they run out.
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
  private bar!: Phaser.GameObjects.Graphics;
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private slotKeys: Phaser.GameObjects.BitmapText[] = [];
  private slotCounts: Phaser.GameObjects.BitmapText[] = [];
  private buffBadges!: Phaser.GameObjects.Graphics;
  private buffIcons: Phaser.GameObjects.Image[] = [];

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

  /** Where the touch attack button sits (the hotbar is laid out around it). */
  private get padPos(): Phaser.Math.Vector2 {
    const R = this.R;
    // Inset from the edge by 70% of the button's diameter beyond the original spot.
    return new Phaser.Math.Vector2(this.scale.width - R * (1.55 + 0.7 * 1.68), this.scale.height - R * 1.45);
  }

  /** With a mouse the buttons shrink to indicators; this is their size against the touch buttons. */
  private get padScale(): number {
    return controls.mouse ? 0.42 : 1;
  }

  /** With a mouse: the two indicators side by side, centred just above the hotbar. */
  private get indicatorPos(): { attack: Phaser.Math.Vector2; special: Phaser.Math.Vector2 } {
    const r = this.R * this.padScale;
    const { x, y, s, gap } = this.hotbar;
    const cx = x + (s * HOTBAR_SIZE + gap * (HOTBAR_SIZE - 1)) / 2;
    const cy = y - r - 10 * D;
    return { attack: new Phaser.Math.Vector2(cx - r * 1.25, cy), special: new Phaser.Math.Vector2(cx + r * 1.25, cy) };
  }

  private get buttonPos(): Phaser.Math.Vector2 {
    return controls.mouse ? this.indicatorPos.attack : this.padPos;
  }

  /** The beam button sits above and just outside the attack button, in easy reach of the thumb. */
  private get beamPos(): Phaser.Math.Vector2 {
    if (controls.mouse) return this.indicatorPos.special;
    const R = this.R;
    const bp = this.padPos;
    return new Phaser.Math.Vector2(bp.x + R * 0.55, bp.y - R * 1.95);
  }

  /**
   * The hotbar's slots: square, side by side, centred in the room between the
   * joystick's resting spot and the attack button, along the bottom edge.
   */
  private get hotbar(): { x: number; y: number; s: number; gap: number } {
    const R = this.R;
    const left = this.restPos.x + R * 1.1;
    const right = this.padPos.x - R * 1.2;
    const gap = Math.round(3 * D);
    const fit = Math.floor((right - left - gap * (HOTBAR_SIZE - 1)) / HOTBAR_SIZE);
    const s = Math.max(Math.round(20 * D), Math.min(fit, Math.round(Phaser.Math.Clamp(Math.min(this.scale.width, this.scale.height) * 0.085, 30 * D, 46 * D))));
    const w = s * HOTBAR_SIZE + gap * (HOTBAR_SIZE - 1);
    const cx = Phaser.Math.Clamp((left + right) / 2, w / 2 + 8 * D, this.scale.width - w / 2 - 8 * D);
    return { x: Math.round(cx - w / 2), y: Math.round(this.scale.height - s - 10 * D), s, gap };
  }

  /** The hotbar slot under (x, y), or -1. */
  private slotAt(x: number, y: number): number {
    const { x: bx, y: by, s, gap } = this.hotbar;
    if (y < by - gap || y > by + s + gap) return -1;
    const i = Math.floor((x - bx + gap / 2) / (s + gap));
    return i >= 0 && i < HOTBAR_SIZE ? i : -1;
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

    this.bar = this.add.graphics();
    this.slotIcons = [];
    this.slotKeys = [];
    this.slotCounts = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.slotIcons.push(this.add.image(0, 0, '__DEFAULT').setVisible(false));
      this.slotKeys.push(this.add.bitmapText(0, 0, 'pixel', `${i + 1}`).setLetterSpacing(-1).setOrigin(0, 0).setTint(0xb8c4ff));
      this.slotCounts.push(this.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(1, 1).setTint(0xfff4d8));
    }
    this.buffBadges = this.add.graphics();
    this.buffIcons = [];

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      controls.mouse = !p.wasTouch;
      const bp = this.buttonPos;
      const mp = this.beamPos;
      const tr = this.toggleRect;
      if (Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Clone(tr).setSize(tr.width + 8 * D, tr.height + 8 * D), p.x, p.y)) {
        // Tap a side to pick it; tapping the active side flips it.
        const onSun = p.x < tr.centerX;
        daynight.set(onSun === (daynight.target < 0.5) ? onSun : !onSun);
      } else if (p.wasTouch && Phaser.Math.Distance.Between(p.x, p.y, mp.x, mp.y) < this.R * 0.95) {
        this.beamPointer = p.id;
        controls.beam = true;
      } else if (p.wasTouch && Phaser.Math.Distance.Between(p.x, p.y, bp.x, bp.y) < this.R * 1.1) {
        this.buttonPointer = p.id;
        controls.attack = true;
      } else if (this.slotAt(p.x, p.y) >= 0) {
        controls.items.push(this.slotAt(p.x, p.y));
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

    // With a mouse the abilities are the click and Space, so the buttons become
    // small indicators above the hotbar: same combo pips and cooldown rings.
    const k = this.padScale;
    const u = controls.mouse ? 0.6 : 1; // pip and ring spacing
    const bp = this.buttonPos;
    const pressed = this.buttonPointer !== null || (controls.mouse && controls.click);
    const br = R * k * (pressed ? 0.78 : 0.84);
    this.icon.setPosition(bp.x, bp.y).setScale(Math.max(controls.mouse ? 1 : 2, Math.round((R * k) / 14)) * (pressed ? 0.9 : 1));
    const b = this.redraw(this.button, `${pressed} ${bp.x} ${bp.y} ${R * k} ${comboHud.window} ${comboHud.hits} ${comboHud.max}`);
    if (b) {
      b.fillStyle(0x0c1433, pressed ? 0.75 : 0.55);
      b.fillCircle(bp.x, bp.y, br);
      b.lineStyle(3 * D, 0x6fe4ff, pressed ? 0.95 : 0.65);
      b.strokeCircle(bp.x, bp.y, br);
      b.lineStyle(1 * D, 0x6fe4ff, 0.25);
      b.strokeCircle(bp.x, bp.y, br + 6 * D * u);

      // Combo pips over the attack button: one per hit landed, and a thin arc
      // draining over the time left to chain the next.
      if (comboHud.window > 0) {
        const top = -Math.PI / 2;
        b.lineStyle(2 * D, 0xffd66b, 0.55 * Math.min(1, comboHud.window * 3));
        b.beginPath();
        b.arc(bp.x, bp.y, br + 6 * D * u, top, top + Math.PI * 2 * comboHud.window, false);
        b.strokePath();
        const n = comboHud.max;
        const gap = n > 3 ? 0.27 : 0.34;
        for (let i = 0; i < n; i++) {
          const a = top + (i - (n - 1) / 2) * gap;
          const px = bp.x + Math.cos(a) * (br + 15 * D * u);
          const py = bp.y + Math.sin(a) * (br + 15 * D * u);
          const lit = i < comboHud.hits;
          b.fillStyle(lit ? 0xffd66b : 0x0a0c1c, lit ? 0.95 : 0.5);
          b.fillCircle(px, py, 4 * D * u);
          b.lineStyle(1.5 * D, lit ? 0xfff4bf : 0xffd66b, lit ? 0.9 : 0.45);
          b.strokeCircle(px, py, 4 * D * u);
        }
      }
    }

    this.drawBeamButton(R * k, u);

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
    this.drawBuffs(tr);
    this.drawHotbar();
  }

  /** Nine slots: an item's icon and count, its key in the corner, a dark wipe while it cools down. */
  private drawHotbar(): void {
    const { x: bx, y: by, s, gap } = this.hotbar;
    const iconScale = Math.max(1, Math.floor((s - 6 * D) / 16));
    const textScale = Math.max(1, Math.floor(s / 30));
    const keyScale = Math.max(1, Math.floor(s / 44));
    const inset = Math.round(3 * D);
    let state = `${bx} ${by} ${s}`;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = inventory.slots[i];
      state += `|${slot?.item.id ?? ''}${slot?.count ?? ''} ${Math.ceil(inventory.cooldown(i) * 24)} ${Math.ceil(inventory.flash[i] / 30)}`;
      const x = bx + i * (s + gap);
      const icon = this.slotIcons[i];
      if (slot) {
        if (icon.texture.key !== slot.item.icon) icon.setTexture(slot.item.icon);
        icon.setVisible(true).setPosition(Math.round(x + s / 2), Math.round(by + s / 2)).setScale(iconScale).setAlpha(inventory.cooldown(i) > 0 ? 0.55 : 1);
      } else icon.setVisible(false);
      this.slotKeys[i].setPosition(x + inset, by + inset).setScale(keyScale).setAlpha(slot ? 0.8 : 0.35);
      this.slotCounts[i]
        .setText(slot && slot.count > 1 ? `${slot.count}` : '')
        .setPosition(x + s - inset + D, by + s - inset + D)
        .setScale(textScale);
    }
    const g = this.redraw(this.bar, state);
    if (!g) return;
    const r = Math.round(4 * D);
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = inventory.slots[i];
      const x = bx + i * (s + gap);
      g.fillStyle(0x0a0c1c, slot ? 0.62 : 0.34);
      g.fillRoundedRect(x, by, s, s, r);
      // A faint inner bevel: light along the top, as the buttons have.
      g.fillStyle(0xffffff, slot ? 0.06 : 0.03);
      g.fillRect(x + r, by + D, s - r * 2, Math.round(2 * D));
      const cd = inventory.cooldown(i);
      if (cd > 0) {
        // The dark part shrinks upward as the cooldown runs out.
        g.fillStyle(0x000000, 0.45);
        g.fillRect(x + D, by + D + (s - 2 * D) * (1 - cd), s - 2 * D, (s - 2 * D) * cd);
      }
      const f = inventory.flash[i] / 300;
      const tint = slot ? slot.item.tint : 0xdfe6ff;
      g.lineStyle(Math.round(1.5 * D), f > 0 ? 0xffffff : tint, slot ? 0.35 + f * 0.6 : 0.16);
      g.strokeRoundedRect(x, by, s, s, r);
      if (f > 0) {
        g.lineStyle(Math.round(2 * D), tint, f * 0.7);
        g.strokeRoundedRect(x - 2 * D, by - 2 * D, s + 4 * D, s + 4 * D, r + 2 * D);
      }
    }
  }

  /** A badge per active buff under the day/night toggle: its icon, ringed by a bar draining with the time left. */
  private drawBuffs(tr: Phaser.Geom.Rectangle): void {
    const list = heroBuffs.active;
    const size = Math.round(tr.height * 0.9);
    const gap = Math.round(6 * D);
    const y = Math.round(tr.bottom + 10 * D);
    const iconScale = Math.max(1, Math.floor((size - 6 * D) / 16));
    while (this.buffIcons.length < list.length) this.buffIcons.push(this.add.image(0, 0, '__DEFAULT'));
    this.buffIcons.forEach((icon, i) => {
      const b = list[i];
      if (!b) {
        icon.setVisible(false);
        return;
      }
      if (icon.texture.key !== b.def.icon) icon.setTexture(b.def.icon);
      // Blinks through its last two seconds.
      const blink = b.left < 2000 && Math.sin(this.time.now * 0.018) < 0 ? 0.45 : 1;
      icon.setVisible(true).setPosition(tr.x + i * (size + gap) + size / 2, y + size / 2).setScale(iconScale).setAlpha(blink);
    });
    const state = list.map((b) => `${b.def.id} ${Math.ceil((b.left / b.def.duration) * 60)}`).join('|') + ` ${tr.x} ${y} ${size}`;
    const g = this.redraw(this.buffBadges, state);
    if (!g) return;
    list.forEach((b, i) => {
      const x = tr.x + i * (size + gap);
      const r = Math.round(5 * D);
      g.fillStyle(0x0a0c1c, 0.6);
      g.fillRoundedRect(x, y, size, size, r);
      g.lineStyle(Math.round(1.5 * D), b.def.tint, 0.35);
      g.strokeRoundedRect(x, y, size, size, r);
      // Time left: a bar under the badge.
      const k = Math.max(0, b.left / b.def.duration);
      const bh = Math.round(3 * D);
      g.fillStyle(0x0a0c1c, 0.6);
      g.fillRect(x, y + size + 3 * D, size, bh);
      g.fillStyle(b.def.tint, 0.95);
      g.fillRect(x, y + size + 3 * D, Math.round(size * k), bh);
    });
  }
  /** The beam button, ringed by its charge: filling cyan, white-hot when full, draining violet when held too long. */
  private drawBeamButton(R: number, u: number): void {
    const mp = this.beamPos;
    const pressed = this.beamPointer !== null;
    const { charge, over, firing } = beamHud;
    const t = this.time.now;
    const full = charge >= 1;
    const br = R * (pressed ? 0.66 : 0.72);

    const scale = Math.max(controls.mouse ? 1 : 2, Math.round(R / 16));
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
    const rr = br + 5 * D * u;
    const top = -Math.PI / 2;
    g.lineStyle(4 * D * u, 0x0a0c1c, 0.45);
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
      g.lineStyle(4 * D * u, col, alpha);
      g.beginPath();
      g.arc(mp.x, mp.y, rr, top, top + Math.PI * 2 * fill, false);
      g.strokePath();
      if (full && over === 0) {
        g.lineStyle(1.5 * D, 0x9ff6ff, 0.35 + 0.25 * Math.sin(t * 0.012));
        g.strokeCircle(mp.x, mp.y, rr + 5 * D * u);
      }
    } else {
      g.lineStyle(1 * D, 0x6fe4ff, 0.25);
      g.strokeCircle(mp.x, mp.y, rr);
    }
  }
}
