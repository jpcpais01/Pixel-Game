import Phaser from 'phaser';
import { controls, beamHud, comboHud, critterHud } from '../game/controls';
import { fishHud } from '../game/fish';
import { homeAct } from '../game/farm';
import { DPR as D, menuZoom } from '../game/display';
import { characterById } from '../game/characters';
import { HOTBAR_SIZE, inventory } from '../game/items';
import { heroTimers } from '../game/timers';
import { GLYPH_H } from '../art/font';
import { GearHud } from '../ui/gearHud';
import { KeeperHud } from '../ui/keeperHud';
import { BuildHud } from '../ui/buildHud';
import { StatsHud } from '../ui/statsHud';
import type { MapScene } from './MapScene';
import type { WorldScene } from './WorldScene';
import { build } from '../game/build';
import { cozy, type CozyHud } from '../game/cozy';
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
 * The hotbar: three item slots, tapped or pressed 1 to 3, in a row over the
 * ability buttons on a touch screen and along the bottom with a mouse. Active buffs show as badges under the
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
/** A tap shorter than this fires on release; holding longer presses the button down. */
const TAP_GRACE = 90;
/** A timer badge's side, in art px: a 16 px icon, a pixel of glass and the rim round it. */
const TIMER_ART = 20;
/** Badges to a row before they wrap under. */
const TIMER_ROW = 6;
/** ms a new timer badge takes to pop in. */
const TIMER_POP = 280;

/**
 * The rim of a timer badge, clockwise from the middle of its top edge (the
 * corners are cut, for studs or nothing): the order its light goes out in.
 */
const TIMER_RIM: readonly (readonly [number, number])[] = (() => {
  const n = TIMER_ART;
  const h = n / 2;
  const rim: [number, number][] = [];
  for (let x = h; x <= n - 2; x++) rim.push([x, 0]);
  for (let y = 1; y <= n - 2; y++) rim.push([n - 1, y]);
  for (let x = n - 2; x >= 1; x--) rim.push([x, n - 1]);
  for (let y = n - 2; y >= 1; y--) rim.push([0, y]);
  for (let x = 1; x < h; x++) rim.push([x, 0]);
  return rim;
})();

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
  private bar!: Phaser.GameObjects.Graphics;
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private slotKeys: Phaser.GameObjects.BitmapText[] = [];
  private slotCounts: Phaser.GameObjects.BitmapText[] = [];
  /** The timer badges under the minimap: their rims, icons and seconds left. */
  private timerRims!: Phaser.GameObjects.Graphics;
  private timerIcons: Phaser.GameObjects.Image[] = [];
  private timerLabels: Phaser.GameObjects.BitmapText[] = [];
  /** When each timer badge first showed, for its pop-in. */
  private timerBorn = new Map<string, number>();
  private gearHud!: GearHud;
  /** A Rune Temple keeper's counter, when the hero talks to one. */
  private keeperHud!: KeeperHud;
  /** The hero's stats under the buff badges, and the "i" card on their moves. */
  private statsHud!: StatsHud;
  /** Where the stats panel stands, eased as timer badges come and go. */
  private statsY = -1;
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
  /** Heaven Lands' buttons, when it runs. */
  private cozyHud: CozyHud | null = null;

  /**
   * The left column under the minimap (scenes/MapScene.ts, top-left): where
   * the buff badges start, and how big they are. With no minimap they start
   * in the corner.
   */
  private get column(): { x: number; y: number; size: number } {
    const map = this.scene.isActive('map') ? (this.scene.get('map') as MapScene).leftBottom : 0;
    const seg = Math.round(Math.max(48 * D, Math.min(this.scale.width, this.scale.height) * 0.13));
    return { x: 12 * D, y: Math.round(map ? map + 8 * D : 12 * D), size: Math.round(Math.round(seg * 0.8) * 0.9) };
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

  /** Something drawn over the whole HUD is open (the bag, a keeper's counter, the "i" card, fishing): the minimap keeps out of its way. */
  get covered(): boolean {
    return !!(this.gearHud?.open || this.keeperHud?.open || this.statsHud?.open || fishHud.active);
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

  /** The Special's button sits up and to the left of the attack button. */
  private get ultPos(): Phaser.Math.Vector2 {
    if (controls.mouse) return this.indicatorPos.ult;
    const R = this.R;
    const bp = this.padPos;
    return new Phaser.Math.Vector2(bp.x - R * 1.8, bp.y - R * 1.2);
  }

  /**
   * The hotbar's slots: square, side by side. On a touch screen they sit in a
   * row just over the ability buttons, just past the beam button's
   * outer edge so the thumb finds them with the rest of its buttons and the
   * row stays clear of the net's button on its left. With a mouse they are
   * centred along the bottom edge, between the joystick's resting spot and
   * the attack button's.
   */
  private get hotbar(): { x: number; y: number; s: number; gap: number } {
    const R = this.R;
    if (!controls.mouse) {
      const gap = Math.round(4 * D);
      const s = Math.round(Phaser.Math.Clamp(R * 0.66, 30 * D, 46 * D));
      const w = s * HOTBAR_SIZE + gap * (HOTBAR_SIZE - 1);
      const bp = this.padPos;
      const right = Math.min(bp.x + R * 1.6, this.scale.width - 8 * D);
      // The beam button's ring reaches about R * 0.9 above its centre; the row keeps a clear gap over it.
      const bottom = bp.y - R * 1.95 - R * 1.1;
      return { x: Math.round(right - w), y: Math.round(bottom - s), s, gap };
    }
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
    this.timerRims = this.add.graphics();
    this.timerIcons = [];
    this.timerLabels = [];
    this.timerBorn.clear();
    this.gearHud = new GearHud(this, () => this.releaseAll());
    this.keeperHud = new KeeperHud(this, () => this.releaseAll());
    this.buildHud = new BuildHud(this, () => this.releaseAll());
    const world = this.scene.get('world') as WorldScene;
    this.statsHud = new StatsHud(this, hero, () => world.heroSheet(), () => this.releaseAll());
    this.statsY = -1;
    this.buildPointer = null;
    this.building = false;
    this.netButton = this.add.graphics();
    this.netIcon = this.add.image(0, 0, 'icon_net').setVisible(false);
    this.netShown = this.netPressed = 0;
    this.cozyHud = cozy.on && cozy.hud ? cozy.hud(this) : null;

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      controls.mouse = !p.wasTouch;
      const bp = this.buttonPos;
      const mp = this.beamPos;
      const up = this.ultPos;
      if (fishHud.active) {
        // Fishing: its overlay takes every press (see FishScene).
      } else if (this.statsHud.open && this.statsHud.pointerDown(p)) {
        // The "i" card is open: a tap anywhere closes it.
      } else if (this.keeperHud.pointerDown(p)) {
        // A keeper's counter is open: it takes every press.
      } else if (!cozy.on && this.gearHud.pointerDown(p)) {
        // The bag's button, or a tap while the bag is open.
      } else if (this.buildHud.pointerDown(p)) {
        // The build and friends buttons, or the build tray.
      } else if (this.cozyHud?.pointerDown(p)) {
        // Heaven Lands' emote buttons.
      } else if (!cozy.on && this.statsHud.pointerDown(p)) {
        // The stats panel folds or opens; the "i" opens the card.
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
        // No cursor on the world under the tray and its buttons.
        build.pointer.over = p.id === this.buildPointer || !this.buildHud.covers(p.x, p.y);
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
    if (!cozy.on) this.gearHud.update(delta);
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

    if (cozy.on) {
      // No fighting: the emote buttons stand where the ability buttons were.
      for (const o of [this.button, this.icon, this.beamButton, this.beamIcon, this.ultButton, this.ultIcon, this.ultKey]) o.setVisible(false);
      this.cozyHud?.update(delta, build.on || fishHud.active || this.covered);
    } else {
      this.drawBeamButton(R * k, u);
      this.drawUltButton(R * k, u);
    }
    this.drawNetButton(delta);

    const col = this.column;
    const timers = this.drawTimers(col);
    this.placeStats(col, timers, delta);
    this.drawHotbar();
    this.hideForBuilding();
  }

  /** The scale of the left column's art: the stats panel and the timer badges. */
  private get columnZoom(): number {
    const menu = menuZoom(this.scale.width, this.scale.height);
    return menu >= 3 ? menu - 1 : menu;
  }

  /**
   * The stats panel stands at the left under the timer badges, and moves up
   * into their place when there are none, easing between the two.
   */
  private placeStats(col: { x: number; y: number; size: number }, timers: number, delta: number): void {
    const z = this.columnZoom;
    const want = col.y + timers;
    this.statsY = this.statsY < 0 ? want : this.statsY + (want - this.statsY) * Math.min(1, delta / 90);
    if (Math.abs(want - this.statsY) < 0.5) this.statsY = want;
    this.statsHud.place(col.x, this.statsY, z, cozy.on || build.on || fishHud.active);
    this.statsHud.update();
  }

  /** While building, the battle buttons and the hotbar make way for the build tray. */
  private hideForBuilding(): void {
    const on = build.on;
    if (!on && !this.building) return;
    // These are shown by their draws each frame, so they only need hiding.
    const drawn = [this.ultKey, this.netIcon, ...this.slotIcons];
    const fixed = [this.button, this.icon, this.beamButton, this.beamIcon, this.ultButton, this.ultIcon, this.bar, this.netButton, ...this.slotKeys, ...this.slotCounts];
    if (on) for (const o of [...drawn, ...fixed]) o.setVisible(false);
    else for (const o of fixed) if (!cozy.on || o === this.bar || o === this.netButton || this.slotKeys.includes(o as never) || this.slotCounts.includes(o as never)) o.setVisible(true);
    this.building = on;
  }

  /** Three slots: an item's icon and count, its key in the corner, a dark wipe while it cools down. */
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

  /**
   * The timer badges, a row (or two) under the minimap: everything timed on
   * the hero, the Special first, then the ability's lasting effects, then the
   * buffs. Each is a small chamfered pixel badge round its icon; its rim is
   * lit in the timer's colour and goes dark clockwise from the top as the
   * time runs out, like a clock hand sweeping, with the seconds left under
   * it. Specials wear gold corner studs, abilities steel ones. A new badge
   * pops in with a white rim; through its last two seconds it blinks.
   * Returns how much height the badges take, for the stats panel under them.
   */
  private drawTimers(col: { x: number; y: number; size: number }): number {
    const list = build.on || fishHud.active ? [] : heroTimers.list();
    const u = this.columnZoom;
    const size = TIMER_ART * u;
    const gap = 3 * u;
    const textScale = Math.max(1, Math.floor(u / 2));
    const labelH = (GLYPH_H + 2) * textScale;
    const rowH = size + u + labelH + gap;
    const perRow = Math.max(1, Math.min(TIMER_ROW, Math.floor((this.scale.width * 0.45 + gap) / (size + gap))));
    const now = this.time.now;

    // Forget badges that have gone, so one that comes again pops in again.
    for (const id of this.timerBorn.keys()) if (!list.some((t) => t.id === id)) this.timerBorn.delete(id);
    for (const t of list) if (!this.timerBorn.has(t.id)) this.timerBorn.set(t.id, now);

    while (this.timerIcons.length < list.length) {
      this.timerIcons.push(this.add.image(0, 0, '__DEFAULT'));
      this.timerLabels.push(this.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(0.5, 0));
    }
    const at = (i: number) => ({ x: col.x + (i % perRow) * (size + gap), y: col.y + Math.floor(i / perRow) * rowH });
    let state = `${col.x} ${col.y} ${u}`;
    this.timerIcons.forEach((icon, i) => {
      const label = this.timerLabels[i];
      const t = list[i];
      if (!t) {
        icon.setVisible(false);
        label.setVisible(false);
        return;
      }
      const { x, y } = at(i);
      const key = t.icon || (t.kind === 'ability' ? this.beamIcon.texture.key : '__DEFAULT');
      if (icon.texture.key !== key) icon.setTexture(key);
      const age = now - (this.timerBorn.get(t.id) ?? now);
      const pop = Math.max(0, 1 - age / TIMER_POP);
      const blink = t.left < 2000 && Math.sin(now * 0.018) < 0;
      // Button icons are drawn to glow on the dark buttons; the buff icons are plain.
      icon
        .setBlendMode(t.kind === 'buff' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD)
        .setVisible(true)
        .setPosition(x + size / 2, y + size / 2)
        .setScale(u * (1 + 0.3 * pop * pop))
        .setAlpha(blink ? 0.45 : 1);
      const secs = Math.ceil(t.left / 1000);
      label
        .setVisible(true)
        .setText(secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs}`)
        .setScale(textScale)
        .setPosition(Math.round(x + size / 2), y + size + u)
        .setTint(secs <= 3 ? 0xffb08a : 0xdfe6ff)
        .setAlpha(blink ? 0.6 : 0.95);
      const lit = Math.ceil(TIMER_RIM.length * Math.max(0, Math.min(1, t.left / t.total)));
      state += `|${t.id} ${lit} ${blink ? 1 : 0} ${Math.ceil(pop * 6)}`;
    });

    const g = this.redraw(this.timerRims, state);
    if (g) {
      const N = TIMER_ART;
      const px = (x: number, y: number, ax: number, ay: number, w = 1, h = 1) => g.fillRect(x + ax * u, y + ay * u, w * u, h * u);
      list.forEach((t, i) => {
        const { x, y } = at(i);
        const age = now - (this.timerBorn.get(t.id) ?? now);
        const pop = Math.max(0, 1 - age / TIMER_POP);
        const blink = t.left < 2000 && Math.sin(now * 0.018) < 0;
        // The body: dark glass with a wash of the timer's colour, lit along the top, shaded along the bottom.
        g.fillStyle(0x0a0c1c, 0.78);
        px(x, y, 1, 1, N - 2, N - 2);
        g.fillStyle(t.tint, 0.13);
        px(x, y, 2, 2, N - 4, N - 4);
        g.fillStyle(0xffffff, 0.1);
        px(x, y, 2, 1, N - 4, 1);
        g.fillStyle(0x000000, 0.3);
        px(x, y, 2, N - 2, N - 4, 1);
        // The rim: dark where the time has gone, lit where it is left, the hand a bright pixel.
        const n = TIMER_RIM.length;
        const lit = Math.ceil(n * Math.max(0, Math.min(1, t.left / t.total)));
        TIMER_RIM.forEach(([ax, ay], k) => {
          const on = k >= n - lit;
          if (pop > 0) g.fillStyle(0xffffff, 0.5 + 0.5 * pop);
          else if (!on) g.fillStyle(t.tint, 0.2);
          else if (k === n - lit) g.fillStyle(0xffffff, 0.95);
          else g.fillStyle(t.tint, blink ? 0.55 : 1);
          px(x, y, ax, ay);
        });
        // Corner studs: gold on a Special, steel on an ability's effect.
        if (t.kind !== 'buff') {
          const stud = t.kind === 'special' ? 0xffd66b : 0xb8c4e0;
          for (const [ax, ay] of [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]]) {
            g.fillStyle(stud, 0.95);
            px(x, y, ax, ay);
          }
        }
      });
    }
    if (!list.length) return 0;
    return Math.ceil(list.length / perRow) * rowH + 5 * u;
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
    // By a fishing rod in the Home it's the rod's button instead.
    const rod = fishHud.near;
    const icon = rod ? 'icon_rod' : homeAct.near === 'harvest' ? 'icon_harvest' : homeAct.near === 'cook' ? 'icon_cook' : 'icon_net';
    if (this.netIcon.texture.key !== icon && this.textures.exists(icon)) this.netIcon.setTexture(icon);
    const want = (critterHud.near || rod || homeAct.near) && !controls.mouse ? 1 : 0;
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
