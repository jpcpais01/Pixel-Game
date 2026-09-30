import Phaser from 'phaser';
import { controls, beamHud, comboHud, critterHud } from '../game/controls';
import { daynight, PHASES } from '../game/daynight';
import { DPR as D } from '../game/display';
import { characterById } from '../game/characters';
import { HOTBAR_SIZE, inventory } from '../game/items';
import { heroBuffs } from '../game/buffs';
import { GearHud } from '../ui/gearHud';
import { KeeperHud } from '../ui/keeperHud';
import { BuildHud } from '../ui/buildHud';
import { build } from '../game/build';
import { energy } from '../game/energy';
import { ensureUltIcons, ultFor } from '../game/ultimate';
import type { Pal } from '../game/ultimate/ink';

/**
 * Touch controls: a floating joystick on the left half of the screen, an
 * attack button on the right and, above it, the special button (the wizard's
 * beam: hold to charge). Icons come from the chosen character. Rendered at
 * screen resolution over the world.
 *
 * With a mouse, a left click on the world is the attack (the world aims it
 * at the cursor), a right click the special, Space the Special and the keyboard walks, so the joystick
 * hides and the ability buttons shrink to indicators above the hotbar.
 *
 * Along the bottom, between the joystick and the buttons, the hotbar: nine
 * item slots, tapped or pressed 1 to 9. Active buffs show as badges under the
 * day/night toggle, draining as they run out. Gear found has a chest button
 * by the pause button (or I / G) opens the bag, where worn gear can be
 * swapped (see ui/gearHud.ts).
 */
/**
 * A touch ability button's press: where the finger went down and how far it
 * has been dragged since, like a small stick of its own.
 */
interface Pad {
  pointer: number | null;
  /** When it was pressed. */
  t: number;
  dx: number;
  dy: number;
  /** Dragged out of the centre at some point: it is being aimed. */
  out: boolean;
  /** Pressed down in the game (hold-style buttons). */
  held: boolean;
}

/** The time of day toggle's highlight in each phase: peach, sky blue, rose, indigo. */
const PHASE_TINT = [0xe8a878, 0x8ec9f5, 0xd87898, 0x6b74c9];
/** A tap shorter than this fires on release; holding longer presses the button down. */
const TAP_GRACE = 90;

export class UIScene extends Phaser.Scene {
  private stick!: Phaser.GameObjects.Graphics;
  private button!: Phaser.GameObjects.Graphics;
  private icon!: Phaser.GameObjects.Sprite;
  private stickPointer: number | null = null;
  private attackPad: Pad = UIScene.pad();
  private beamButton!: Phaser.GameObjects.Graphics;
  private beamIcon!: Phaser.GameObjects.Image;
  private beamPad: Pad = UIScene.pad();
  /** The special is held to charge (see CharacterDef.chargeSpecial). */
  private chargeSpecial = false;
  /** The Special's button: its energy ring fills as foes fall, and glows once there's enough. */
  private ultButton!: Phaser.GameObjects.Graphics;
  private ultIcon!: Phaser.GameObjects.Image;
  private ultKey!: Phaser.GameObjects.BitmapText;
  private ultPad: Pad = UIScene.pad();
  private ultPal!: Pal;
  /** The Special ring's drawn fill, sweeping up after the real one as energy arrives. */
  private ultShown = 0;
  private clickPointer: number | null = null;
  private rightPointer: number | null = null;
  private base = new Phaser.Math.Vector2();
  private knob = new Phaser.Math.Vector2();
  private toggle!: Phaser.GameObjects.Graphics;
  /** Morning, day, sunset and night, in `PHASES` order, one to a cell of the pill. */
  private phaseIcons: Phaser.GameObjects.Image[] = [];
  private autoButton!: Phaser.GameObjects.Graphics;
  private autoIcon!: Phaser.GameObjects.Image;
  private bar!: Phaser.GameObjects.Graphics;
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private slotKeys: Phaser.GameObjects.BitmapText[] = [];
  private slotCounts: Phaser.GameObjects.BitmapText[] = [];
  private buffBadges!: Phaser.GameObjects.Graphics;
  private buffIcons: Phaser.GameObjects.Image[] = [];
  private gearHud!: GearHud;
  /** A Rune Temple keeper's counter, when the hero talks to one. */
  private keeperHud!: KeeperHud;
  /** Build mode in a Home: its buttons and tray. */
  private buildHud!: BuildHud;
  /** The pointer building on the world, while build mode is on. */
  private buildPointer: number | null = null;
  /** The battle buttons and hotbar are hidden while building. */
  private building = false;
  /** The critter net's touch button: it rises into view while a critter is in reach. */
  private netButton!: Phaser.GameObjects.Graphics;
  private netIcon!: Phaser.GameObjects.Image;
  /** 0..1 shown, easing in and out. */
  private netShown = 0;
  private netPressed = 0;

  /** Time of day toggle: a four-cell pill in the top-left corner (morning, day, sunset, night)... */
  private get toggleRect(): Phaser.Geom.Rectangle {
    const seg = Math.round(Math.max(48 * D, Math.min(this.scale.width, this.scale.height) * 0.13));
    const h = Math.round(seg * 0.8);
    return new Phaser.Geom.Rectangle(12 * D, 12 * D, Math.round(h * 0.8) * 4, h);
  }

  /** ...and the round auto button just right of it. */
  private get autoCircle(): Phaser.Geom.Circle {
    const tr = this.toggleRect;
    const r = Math.round(tr.height * 0.43);
    return new Phaser.Geom.Circle(tr.right + 6 * D + r, tr.centerY, r);
  }

  /** What each Graphics last drew, so it is only rebuilt when that changes. */
  private drawn = new Map<Phaser.GameObjects.Graphics, string>();

  constructor() {
    super('ui');
  }

  private static pad(pointer: number | null = null, t = 0): Pad {
    return { pointer, t, dx: 0, dy: 0, out: false, held: false };
  }

  /** How far a button must be dragged to aim it; pulling back inside cancels the special. */
  private get deadZone(): number {
    return this.R * 0.32;
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

  /** With a mouse: the three indicators side by side, centred just above the hotbar. */
  private get indicatorPos(): { attack: Phaser.Math.Vector2; special: Phaser.Math.Vector2; ult: Phaser.Math.Vector2 } {
    const r = this.R * this.padScale;
    const { x, y, s, gap } = this.hotbar;
    const cx = x + (s * HOTBAR_SIZE + gap * (HOTBAR_SIZE - 1)) / 2;
    const cy = y - r - 10 * D;
    return { attack: new Phaser.Math.Vector2(cx - r * 2.5, cy), special: new Phaser.Math.Vector2(cx, cy), ult: new Phaser.Math.Vector2(cx + r * 2.5, cy) };
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

  /** The net's button sits above the Special's, out of the way of the thumb's fighting. */
  private get netPos(): Phaser.Math.Vector2 {
    const R = this.R;
    const bp = this.padPos;
    return new Phaser.Math.Vector2(bp.x - R * 1.45, bp.y - R * 2.75);
  }

  /** The Special's button sits up and to the left of the attack button, clear of the hotbar. */
  private get ultPos(): Phaser.Math.Vector2 {
    if (controls.mouse) return this.indicatorPos.ult;
    const R = this.R;
    const bp = this.padPos;
    return new Phaser.Math.Vector2(bp.x - R * 1.8, bp.y - R * 1.2);
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
    // While building, it rests above the build tray.
    return new Phaser.Math.Vector2(R * (1.6 + 0.7 * 2), this.scale.height - R * 1.45 - (this.buildHud?.height ?? 0));
  }

  create(data: { character?: string }): void {
    const hero = characterById(data?.character);
    this.stickPointer = this.clickPointer = this.rightPointer = null;
    this.attackPad = UIScene.pad();
    this.beamPad = UIScene.pad();
    this.ultPad = UIScene.pad();
    this.chargeSpecial = !!hero.chargeSpecial;
    this.stick = this.add.graphics();
    this.button = this.add.graphics();
    const { attack, special } = hero.buttons;
    this.icon = this.add.sprite(0, 0, attack.texture, attack.frame).setBlendMode(Phaser.BlendModes.ADD);
    if (attack.anim) this.icon.play(attack.anim);
    this.beamButton = this.add.graphics();
    this.beamIcon = this.add.image(0, 0, special.texture).setBlendMode(Phaser.BlendModes.ADD);
    ensureUltIcons(this);
    const ult = ultFor(hero);
    this.ultPal = ult.pal;
    this.ultButton = this.add.graphics();
    this.ultIcon = this.add.image(0, 0, ult.icon).setBlendMode(Phaser.BlendModes.ADD);
    this.ultKey = this.add.bitmapText(0, 0, 'pixel', 'SPACE').setLetterSpacing(-1).setOrigin(0.5, 0).setTint(0xdfe6ff);
    this.toggle = this.add.graphics();
    this.phaseIcons = ['icon_dawn', 'icon_sun', 'icon_dusk', 'icon_moon'].map((k) => this.add.image(0, 0, k));
    this.autoButton = this.add.graphics();
    this.autoIcon = this.add.image(0, 0, 'icon_cycle');
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
    this.gearHud = new GearHud(this, () => this.releaseAll());
    this.keeperHud = new KeeperHud(this, () => this.releaseAll());
    this.buildHud = new BuildHud(this, () => this.releaseAll());
    this.buildPointer = null;
    this.building = false;
    this.netButton = this.add.graphics();
    this.netIcon = this.add.image(0, 0, 'icon_net').setVisible(false);
    this.netShown = this.netPressed = 0;

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      controls.mouse = !p.wasTouch;
      const bp = this.buttonPos;
      const mp = this.beamPos;
      const up = this.ultPos;
      const tr = this.toggleRect;
      if (this.keeperHud.pointerDown(p)) {
        // A keeper's counter is open: it takes every press.
      } else if (this.gearHud.pointerDown(p)) {
        // The bag's button, or a tap while the bag is open.
      } else if (this.buildHud.pointerDown(p)) {
        // The build and friends buttons, or the build tray.
      } else if (daynight.enabled && Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Clone(tr).setSize(tr.width, tr.height + 8 * D), p.x, p.y)) {
        // Tap a cell to pick its time of day (which stops auto).
        daynight.set(PHASES[Phaser.Math.Clamp(Math.floor(((p.x - tr.x) / tr.width) * 4), 0, 3)]);
      } else if (daynight.enabled && Phaser.Math.Distance.Between(p.x, p.y, this.autoCircle.x, this.autoCircle.y) < this.autoCircle.radius + 5 * D) {
        daynight.setAuto(!daynight.auto);
      } else if (build.on) {
        // Building: a touch by the joystick still walks; any other press builds (a right click erases).
        if (p.wasTouch && this.stickPointer === null && Phaser.Math.Distance.Between(p.x, p.y, this.restPos.x, this.restPos.y) < this.R * 1.3) {
          this.stickPointer = p.id;
          this.base.set(p.x, p.y);
          this.knob.set(p.x, p.y);
        } else if (this.buildPointer === null) {
          this.buildPointer = p.id;
          Object.assign(build.pointer, { x: p.x, y: p.y, down: true, erase: !p.wasTouch && p.rightButtonDown(), over: true });
          build.pressed = true;
        }
      } else if (p.wasTouch && this.netShown > 0.5 && Phaser.Math.Distance.Between(p.x, p.y, this.netPos.x, this.netPos.y) < this.R * 0.7) {
        controls.netTap = true;
        this.netPressed = 1;
      } else if (p.wasTouch && this.ultPad.pointer === null && Phaser.Math.Distance.Between(p.x, p.y, up.x, up.y) < this.R * 0.85) {
        this.ultPad = UIScene.pad(p.id, this.time.now);
        controls.ultAim = null;
      } else if (p.wasTouch && this.beamPad.pointer === null && Phaser.Math.Distance.Between(p.x, p.y, mp.x, mp.y) < this.R * 0.95) {
        this.beamPad = UIScene.pad(p.id, this.time.now);
        controls.beamAim = null;
      } else if (p.wasTouch && this.attackPad.pointer === null && Phaser.Math.Distance.Between(p.x, p.y, bp.x, bp.y) < this.R * 1.1) {
        this.attackPad = UIScene.pad(p.id, this.time.now);
        controls.attackAim = null;
      } else if (this.slotAt(p.x, p.y) >= 0) {
        controls.items.push(this.slotAt(p.x, p.y));
      } else if (!p.wasTouch) {
        // Clicks on the pause and sound buttons never get here: their scenes sit on top and take them.
        if (p.leftButtonDown()) {
          this.clickPointer = p.id;
          controls.click = true;
        }
        if (p.rightButtonDown()) {
          this.rightPointer = p.id;
          controls.rightClick = true;
        }
      } else if (p.x < this.scale.width * 0.55 && this.stickPointer === null) {
        this.stickPointer = p.id;
        this.base.set(p.x, p.y);
        this.knob.set(p.x, p.y);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) controls.mouse = true;
      this.gearHud.pointerMove(p);
      this.keeperHud.pointerMove(p);
      this.buildHud.pointerMove(p);
      // The build cursor follows the finger building, or the mouse hovering.
      if (build.on && (p.id === this.buildPointer || (this.buildPointer === null && !p.wasTouch))) {
        build.pointer.x = p.x;
        build.pointer.y = p.y;
        build.pointer.over = true;
      }
      if (p.id === this.attackPad.pointer) this.dragPad(this.attackPad, p, false);
      if (p.id === this.beamPad.pointer) this.dragPad(this.beamPad, p, true);
      if (p.id === this.ultPad.pointer) this.dragUlt(p);
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
      this.gearHud.pointerUp(p);
      this.keeperHud.pointerUp(p);
      this.buildHud.pointerUp(p);
      if (p.id === this.buildPointer) {
        this.buildPointer = null;
        build.pointer.down = false;
        // A finger lifted leaves no cursor behind; the mouse still hovers.
        build.pointer.over = !p.wasTouch;
        build.released = true;
      }
      if (p.id === this.stickPointer) {
        this.stickPointer = null;
        controls.moveX = 0;
        controls.moveY = 0;
        this.base.copy(this.restPos);
        this.knob.copy(this.restPos);
      }
      if (p.id === this.attackPad.pointer) {
        // A quick tap never got pressed down: fire it once now.
        if (!this.attackPad.held) controls.attackTap = true;
        this.attackPad = UIScene.pad();
        controls.attack = false;
        if (controls.aiming && !controls.aiming.special) controls.aiming = null;
      }
      if (p.id === this.beamPad.pointer) {
        const pad = this.beamPad;
        // Held to charge: let go to fire. Otherwise it fires now, where it was
        // dragged (or at the nearest enemy for a tap), unless pulled back to the centre.
        if (this.chargeSpecial ? !pad.held : !(pad.out && Math.hypot(pad.dx, pad.dy) < this.deadZone)) controls.beamTap = true;
        this.beamPad = UIScene.pad();
        controls.beam = false;
        if (controls.aiming?.special) controls.aiming = null;
      }
      if (p.id === this.ultPad.pointer) {
        const pad = this.ultPad;
        // Cast where it was dragged (or at the nearest foe for a tap), unless pulled back to the centre.
        if (!(pad.out && Math.hypot(pad.dx, pad.dy) < this.deadZone)) controls.ultTap = true;
        this.ultPad = UIScene.pad();
        controls.ultAim = null;
        if (controls.aiming?.ult) controls.aiming = null;
      }
      // One mouse, two buttons: let go of whichever is no longer held.
      if (p.id === this.clickPointer && !p.leftButtonDown()) {
        this.clickPointer = null;
        controls.click = false;
      }
      if (p.id === this.rightPointer && !p.rightButtonDown()) {
        this.rightPointer = null;
        controls.rightClick = false;
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

  /** The finger on an ability button moved: aim the way it is dragged, or at the nearest enemy while inside the centre. */
  private dragPad(pad: Pad, p: Phaser.Input.Pointer, special: boolean): void {
    pad.dx = p.x - p.downX;
    pad.dy = p.y - p.downY;
    const l = Math.hypot(pad.dx, pad.dy);
    const inside = l < this.deadZone;
    if (!inside) pad.out = true;
    const aim = inside ? null : { x: pad.dx / l, y: pad.dy / l };
    if (special) controls.beamAim = aim;
    else controls.attackAim = aim;
    // The aim line in the world; the special's wins when both are dragged.
    if (pad.out && !controls.aiming?.ult && (special || !controls.aiming?.special)) controls.aiming = { special, cancel: inside && special && !this.chargeSpecial };
  }

  /** The finger on the Special's button moved: aim it the way it is dragged; its aim line wins over the others. */
  private dragUlt(p: Phaser.Input.Pointer): void {
    const pad = this.ultPad;
    pad.dx = p.x - p.downX;
    pad.dy = p.y - p.downY;
    const l = Math.hypot(pad.dx, pad.dy);
    const inside = l < this.deadZone;
    if (!inside) pad.out = true;
    controls.ultAim = inside ? null : { x: pad.dx / l, y: pad.dy / l };
    if (pad.out) controls.aiming = { special: false, ult: true, cancel: inside };
  }

  /**
   * Hold-style buttons (the attack, a charged special) press down once held
   * past a tap or dragged out, and stay down until let go.
   */
  private holdPads(): void {
    const now = this.time.now;
    const a = this.attackPad;
    if (a.pointer !== null && !a.held && (a.out || now - a.t >= TAP_GRACE)) a.held = controls.attack = true;
    const b = this.beamPad;
    if (this.chargeSpecial && b.pointer !== null && !b.held && (b.out || now - b.t >= TAP_GRACE)) b.held = controls.beam = true;
  }

  private onResize(): void {
    if (this.stickPointer === null) {
      this.base.copy(this.restPos);
      this.knob.copy(this.restPos);
    }
  }

  private releaseAll(): void {
    this.stickPointer = this.clickPointer = this.rightPointer = null;
    if (this.buildPointer !== null) {
      this.buildPointer = null;
      build.pointer.down = false;
      build.released = true;
    }
    this.attackPad = UIScene.pad();
    this.beamPad = UIScene.pad();
    this.ultPad = UIScene.pad();
    controls.ultAim = null;
    controls.ultTap = false;
    controls.moveX = controls.moveY = 0;
    controls.attack = controls.beam = controls.click = controls.rightClick = false;
    controls.attackTap = controls.beamTap = false;
    controls.attackAim = controls.beamAim = null;
    controls.aiming = null;
    this.base.copy(this.restPos);
    this.knob.copy(this.restPos);
  }

  update(_time: number, delta: number): void {
    this.gearHud.update(delta);
    this.keeperHud.update(delta);
    this.buildHud.update(delta);
    if (!build.on) this.buildPointer = null;
    // The joystick's resting spot moves with the build tray.
    if (this.stickPointer === null) {
      this.base.copy(this.restPos);
      this.knob.copy(this.restPos);
    }
    this.holdPads();
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

    // With a mouse the abilities are the left and right clicks, so the buttons become
    // small indicators above the hotbar: same combo pips and cooldown rings.
    const k = this.padScale;
    const u = controls.mouse ? 0.6 : 1; // pip and ring spacing
    const bp = this.buttonPos;
    const pressed = this.attackPad.pointer !== null || (controls.mouse && controls.click);
    const br = R * k * (pressed ? 0.78 : 0.84);
    const ak = this.knobOffset(this.attackPad, br);
    this.icon.setPosition(bp.x + ak.x, bp.y + ak.y).setScale(Math.max(controls.mouse ? 1 : 2, Math.round((R * k) / 14)) * (pressed ? 0.9 : 1));
    const b = this.redraw(this.button, `${pressed} ${bp.x} ${bp.y} ${R * k} ${comboHud.window} ${comboHud.hits} ${comboHud.max} ${ak.x} ${ak.y}`);
    if (b) {
      b.fillStyle(0x0c1433, pressed ? 0.75 : 0.55);
      b.fillCircle(bp.x, bp.y, br);
      b.lineStyle(3 * D, 0x6fe4ff, pressed ? 0.95 : 0.65);
      b.strokeCircle(bp.x, bp.y, br);
      b.lineStyle(1 * D, 0x6fe4ff, 0.25);
      b.strokeCircle(bp.x, bp.y, br + 6 * D * u);
      this.drawKnob(b, bp.x, bp.y, ak, br, 0x9ff6ff);

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
    this.drawUltButton(R * k, u);
    this.drawNetButton(delta);

    const tr = this.toggleRect;
    const cell = tr.width / 4;
    // Arenas without day and night have no toggle.
    const on = daynight.enabled;
    for (const o of [this.toggle, this.autoButton, this.autoIcon, ...this.phaseIcons]) o.setVisible(on);
    const w = daynight.mix;
    // Where the highlight sits (a weighted cell index) and its colour, both eased with the light.
    let at = 0;
    let rgb = [0, 0, 0];
    w.forEach((k, i) => {
      at += k * i;
      const c = PHASE_TINT[i];
      rgb = [rgb[0] + ((c >> 16) & 255) * k, rgb[1] + ((c >> 8) & 255) * k, rgb[2] + (c & 255) * k];
    });
    const tg = on ? this.redraw(this.toggle, `${at.toFixed(3)} ${tr.x} ${tr.y} ${tr.width} ${tr.height}`) : null;
    if (tg) {
      tg.fillStyle(0x0a0c1c, 0.55);
      tg.fillRoundedRect(tr.x, tr.y, tr.width, tr.height, tr.height / 2);
      // Sliding highlight: peach at morning, sky blue by day, rose at sunset, indigo at night.
      const pad = 3 * D;
      const hw = cell - pad;
      const hx = Phaser.Math.Clamp(tr.x + at * cell + pad / 2, tr.x + pad, tr.right - pad - hw);
      tg.fillStyle(Phaser.Display.Color.GetColor(rgb[0], rgb[1], rgb[2]), 0.85);
      tg.fillRoundedRect(hx, tr.y + pad, hw, tr.height - pad * 2, Math.min(hw, tr.height - pad * 2) / 2);
      tg.lineStyle(2 * D, 0xdfe6ff, 0.35);
      tg.strokeRoundedRect(tr.x, tr.y, tr.width, tr.height, tr.height / 2);
    }
    const iconScale = Math.max(2, Math.floor(tr.height / 16));
    this.phaseIcons.forEach((icon, i) =>
      icon
        .setPosition(Math.round(tr.x + cell * (i + 0.5)), Math.round(tr.centerY))
        .setScale(iconScale)
        .setAlpha(0.5 + w[i] * 0.5),
    );
    // Auto: lit while on, with a ring filling up as the phase runs out.
    const ac = this.autoCircle;
    const auto = daynight.auto;
    const fill = auto ? Math.round(daynight.progress * 120) / 120 : 0;
    const ag = on ? this.redraw(this.autoButton, `${auto} ${fill} ${ac.x} ${ac.y} ${ac.radius}`) : null;
    if (ag) {
      ag.fillStyle(auto ? 0x2a3160 : 0x0a0c1c, auto ? 0.8 : 0.55);
      ag.fillCircle(ac.x, ac.y, ac.radius);
      ag.lineStyle(2 * D, 0xdfe6ff, auto ? 0.25 : 0.35);
      ag.strokeCircle(ac.x, ac.y, ac.radius);
      if (auto && fill > 0) {
        ag.lineStyle(2 * D, 0xffd66b, 0.9);
        ag.beginPath();
        ag.arc(ac.x, ac.y, ac.radius, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
        ag.strokePath();
      }
    }
    this.autoIcon
      .setPosition(Math.round(ac.x), Math.round(ac.y))
      .setScale(Math.max(2, Math.floor((ac.radius * 2) / 16)))
      .setAlpha(auto ? 1 : 0.5);
    this.drawBuffs(tr);
    this.drawHotbar();
    this.hideForBuilding();
  }

  /** While building, the battle buttons and the hotbar make way for the build tray. */
  private hideForBuilding(): void {
    const on = build.on;
    if (!on && !this.building) return;
    // These are shown by their draws each frame, so they only need hiding.
    const drawn = [this.ultKey, this.netIcon, ...this.slotIcons];
    const fixed = [this.button, this.icon, this.beamButton, this.beamIcon, this.ultButton, this.ultIcon, this.bar, this.netButton, ...this.slotKeys, ...this.slotCounts];
    if (on) for (const o of [...drawn, ...fixed]) o.setVisible(false);
    else for (const o of fixed) o.setVisible(true);
    this.building = on;
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
    const y = Math.round(daynight.enabled ? tr.bottom + 10 * D : tr.y);
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
  /**
   * The Special's button: dark and dim while energy gathers, its ring filling
   * clockwise in the Special's colour; once there is enough, the icon lights,
   * the ring burns white-hot and pulses, and a burst rolls off it.
   */
  private drawUltButton(R: number, u: number): void {
    const up = this.ultPos;
    const pad = this.ultPad;
    const pressed = pad.pointer !== null;
    const cancel = pad.out && Math.hypot(pad.dx, pad.dy) < this.deadZone;
    const ready = energy.ready;
    const fill = Math.min(1, energy.value / energy.cost);
    // The ring sweeps up to new energy rather than jumping; spending drops it at once.
    this.ultShown = fill < this.ultShown ? fill : this.ultShown + (fill - this.ultShown) * (1 - Math.exp(-this.game.loop.delta / 90));
    if (fill - this.ultShown < 0.002) this.ultShown = fill;
    const shown = this.ultShown;
    const t = this.time.now;
    const p = this.ultPal;
    const br = R * (pressed ? 0.62 : 0.68);
    const knob = this.knobOffset(pad, br);
    const scale = Math.max(controls.mouse ? 1 : 2, Math.round(R / 16));
    const pulse = ready ? 0.5 + 0.5 * Math.sin(t * 0.008) : 0;
    this.ultIcon
      .setPosition(Math.round(up.x + knob.x), Math.round(up.y + knob.y))
      .setScale(scale * (pressed ? 0.9 : 1) * (ready ? 1 + 0.06 * pulse : 1))
      .setAlpha(ready ? 1 : 0.35 + 0.35 * shown);
    this.ultKey
      .setVisible(controls.mouse)
      .setPosition(Math.round(up.x), Math.round(up.y - br * 1.35))
      .setScale(Math.max(1, Math.round(D)))
      .setAlpha(ready ? 0.95 : 0.55);

    // Animate with time only while there's something moving: the ready pulse, the burst, a flash of arriving energy.
    const age = energy.readyAge;
    const busy = ready || energy.flash > 0 || shown < fill;
    const g = this.redraw(this.ultButton, `${pressed} ${Math.round(fill * 200)} ${Math.round(shown * 400)} ${ready} ${up.x} ${up.y} ${R} ${busy ? t : 0} ${knob.x} ${knob.y} ${cancel}`);
    if (!g) return;
    g.fillStyle(cancel ? 0x3a0c14 : ready ? 0x1c1440 : 0x0c1433, pressed ? 0.8 : ready ? 0.7 : 0.55);
    g.fillCircle(up.x, up.y, br);
    g.lineStyle(2 * D, cancel ? 0xff6b6b : ready ? p.hot : p.deep, ready ? 0.7 + 0.3 * pulse : 0.55);
    g.strokeCircle(up.x, up.y, br);
    this.drawKnob(g, up.x, up.y, knob, br, p.hot);

    const rr = br + 5 * D * u;
    const top = -Math.PI / 2;
    const w = 4 * D * u;
    g.lineStyle(w, 0x0a0c1c, 0.5);
    g.strokeCircle(up.x, up.y, rr);
    if (fill > 0) {
      // Energy just gained shows first as a pale band the ring then sweeps into.
      if (shown < fill && !ready) {
        g.lineStyle(w, p.core, 0.45 + 0.35 * energy.flash);
        g.beginPath();
        g.arc(up.x, up.y, rr, top + Math.PI * 2 * shown, top + Math.PI * 2 * fill, false);
        g.strokePath();
      }
      g.lineStyle(w, ready ? p.core : p.mid, ready ? 0.8 + 0.2 * pulse : 0.9);
      g.beginPath();
      g.arc(up.x, up.y, rr, top, top + Math.PI * 2 * (ready ? fill : shown), false);
      g.strokePath();
      // A bright bead at the head of the filling ring, flaring as energy arrives.
      if (!ready && shown > 0) {
        const a = top + Math.PI * 2 * shown;
        g.fillStyle(p.core, 0.6 + 0.4 * energy.flash);
        g.fillCircle(up.x + Math.cos(a) * rr, up.y + Math.sin(a) * rr, w * (0.6 + 0.5 * energy.flash));
      }
    }
    if (energy.flash > 0 && !ready) {
      g.lineStyle(2 * D, p.hot, 0.5 * energy.flash);
      g.strokeCircle(up.x, up.y, rr + 4 * D * u);
    }
    if (ready) {
      // Rays turning round the ring, and a soft outer halo.
      g.lineStyle(1.5 * D, p.hot, 0.3 + 0.3 * pulse);
      g.strokeCircle(up.x, up.y, rr + 6 * D * u);
      const n = 8;
      g.lineStyle(2 * D, p.core, 0.55 + 0.35 * pulse);
      for (let i = 0; i < n; i++) {
        const a = t * 0.0012 + (i / n) * Math.PI * 2;
        const r0 = rr + 8 * D * u;
        const r1 = r0 + (4 + 3 * pulse) * D * u;
        g.lineBetween(up.x + Math.cos(a) * r0, up.y + Math.sin(a) * r0, up.x + Math.cos(a) * r1, up.y + Math.sin(a) * r1);
      }
      // The moment it becomes ready, a ring bursts off the button.
      if (age >= 0 && age < 700) {
        const k = age / 700;
        g.lineStyle(3 * D * (1 - k), p.core, 1 - k);
        g.strokeCircle(up.x, up.y, rr + (6 + 30 * k) * D * u);
      }
    }
  }

  /** The net's button: a small round button with the net on it, fading in while a critter is in reach (touch only; E with a keyboard). */
  private drawNetButton(delta: number): void {
    const want = critterHud.near && !controls.mouse ? 1 : 0;
    this.netShown = Phaser.Math.Clamp(this.netShown + (want ? 1 : -1) * (delta / 160), 0, 1);
    this.netPressed = Math.max(0, this.netPressed - delta / 180);
    const on = this.netShown > 0;
    this.netIcon.setVisible(on);
    const np = this.netPos;
    const r = Math.round(this.R * 0.5 * (0.8 + 0.2 * this.netShown) * (1 - this.netPressed * 0.12));
    const a = this.netShown;
    this.netIcon.setPosition(Math.round(np.x), Math.round(np.y)).setScale(Math.max(2, Math.round(this.R / 18))).setAlpha(a);
    const g = this.redraw(this.netButton, `${on} ${np.x} ${np.y} ${r} ${Math.round(a * 20)} ${Math.round(this.netPressed * 10)}`);
    if (!g || !on) return;
    g.fillStyle(this.netPressed > 0 ? 0x2a2410 : 0x0c1433, 0.6 * a);
    g.fillCircle(np.x, np.y, r);
    g.lineStyle(2 * D, 0xffe08a, 0.75 * a);
    g.strokeCircle(np.x, np.y, r);
    g.lineStyle(1 * D, 0xffe08a, 0.25 * a);
    g.strokeCircle(np.x, np.y, r + 5 * D);
  }

  /** Where the knob of a dragged button sits against its centre (zero when not dragged out). */
  private knobOffset(pad: Pad, br: number): { x: number; y: number } {
    if (pad.pointer === null || !pad.out) return { x: 0, y: 0 };
    const l = Math.hypot(pad.dx, pad.dy);
    const k = l > 0 ? Math.min(l, br * 0.7) / l : 0;
    return { x: Math.round(pad.dx * k), y: Math.round(pad.dy * k) };
  }

  /** A small knob on a button being aimed, showing which way it is dragged. */
  private drawKnob(g: Phaser.GameObjects.Graphics, x: number, y: number, off: { x: number; y: number }, br: number, col: number): void {
    if (!off.x && !off.y) return;
    g.fillStyle(col, 0.3);
    g.fillCircle(x + off.x, y + off.y, br * 0.38);
    g.lineStyle(2 * D, 0xffffff, 0.6);
    g.strokeCircle(x + off.x, y + off.y, br * 0.38);
  }

  /** The beam button, ringed by its charge: filling cyan, white-hot when full, draining violet when held too long. */
  private drawBeamButton(R: number, u: number): void {
    const mp = this.beamPos;
    const pressed = this.beamPad.pointer !== null || (controls.mouse && controls.rightClick);
    const pad = this.beamPad;
    // Pulled back to the centre after aiming: letting go now cancels the special.
    const cancel = !this.chargeSpecial && pad.out && Math.hypot(pad.dx, pad.dy) < this.deadZone;
    const { charge, over, firing } = beamHud;
    const t = this.time.now;
    const full = charge >= 1;
    const br = R * (pressed ? 0.66 : 0.72);

    const scale = Math.max(controls.mouse ? 1 : 2, Math.round(R / 16));
    const shake = over > 0.25 ? (Math.random() - 0.5) * over * 0.3 * D : 0;
    const knob = this.knobOffset(pad, br);
    this.beamIcon
      .setPosition(Math.round(mp.x + knob.x + shake), Math.round(mp.y + knob.y))
      .setScale(scale * (pressed ? 0.9 : 1))
      .setAlpha(firing || full ? 1 : 0.7 + charge * 0.3);

    // The ring only animates with time while full or draining.
    const tick = full || over > 0 ? t : 0;
    const g = this.redraw(this.beamButton, `${pressed} ${charge} ${over} ${firing} ${mp.x} ${mp.y} ${R} ${tick} ${knob.x} ${knob.y} ${cancel}`);
    if (!g) return;

    g.fillStyle(cancel ? 0x3a0c14 : firing ? 0x1a3a66 : 0x0c1433, pressed || firing ? 0.78 : 0.55);
    g.fillCircle(mp.x, mp.y, br);
    g.lineStyle(2 * D, cancel ? 0xff6b6b : 0x6fe4ff, pressed ? 0.5 : 0.65);
    g.strokeCircle(mp.x, mp.y, br);
    this.drawKnob(g, mp.x, mp.y, knob, br, 0xffd66b);

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
