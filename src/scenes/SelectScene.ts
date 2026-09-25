import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { CHARACTERS, type CharacterDef } from '../game/characters';
import { setSkin, skinOf, wear } from '../game/skins';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

const CARD_W = 164;
const CARD_H = 92;
const GAP = 8;
// Skin arrows: tall, thin tabs down the card's left and right edges.
const ARROW_W = 8;
const ARROW_INSET = 3;
// Portrait's left edge: nudged right to make room for the arrows on cards that have skins.
const PORTRAIT_X = 5;
const PORTRAIT_X_SKINS = ARROW_INSET + ARROW_W + 1;
// Scrolling: how far (in art pixels) a press may travel and still count as a tap,
// and how quickly a flung row slows down (fraction of speed kept per second).
const TAP_SLOP = 5;
const FLING_KEEP = 0.004;

/** The hero picked last, kept while the game runs. */
let lastPicked = 0;

/** True when a released pointer moved too far from where it went down to be a tap. */
const dragged = (scene: Phaser.Scene, p: Phaser.Input.Pointer): boolean => p.getDistance() / scene.cameras.main.zoom > TAP_SLOP;

/** A tall, thin arrow tab on the side of a card that steps through skins. */
class SkinArrow extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private dir: -1 | 1;
  private h: number;
  private down = false;

  constructor(scene: Phaser.Scene, x: number, dir: -1 | 1, onStep: () => void) {
    super(scene, x, ARROW_INSET);
    this.dir = dir;
    this.h = CARD_H - ARROW_INSET * 2;
    this.g = scene.add.graphics();
    // A generous hit area: the full height of the card and out past its edge into the gap.
    const reach = ARROW_INSET + GAP / 2;
    const hit = scene.add.zone(dir < 0 ? -reach : -2, -ARROW_INSET, ARROW_W + reach + 2, CARD_H).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    // Steps on release, so a swipe that starts on an arrow scrolls instead.
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.draw(true));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      const wasDown = this.down;
      this.draw(false);
      if (wasDown && !dragged(scene, p)) onStep();
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.draw(false));
    this.add([this.g, hit]);
    this.draw(false);
  }

  draw(down = this.down, accent = 0xffe08a): void {
    this.down = down;
    const { g, h } = this;
    const w = ARROW_W;
    g.clear();
    // Recessed tab with a lit rim, pressed in when held.
    g.fillStyle(0x0b0818, 0.9).fillRect(0, 0, w, h);
    g.fillStyle(down ? 0x33296a : 0x231b46).fillRect(1, 1, w - 2, h - 2);
    g.fillStyle(down ? 0x1a1434 : 0x4a3d86).fillRect(1, 1, w - 2, 1);
    // Chevron: 4 wide, 9 tall, pointing out of the card.
    const cx = Math.floor(w / 2) - (this.dir < 0 ? -1 : 2) + (down ? this.dir : 0);
    const cy = Math.floor(h / 2) - 4;
    for (let i = 0; i < 4; i++) {
      const x = this.dir < 0 ? cx - i : cx + i;
      g.fillStyle(accent).fillRect(x, cy + i, 1, 9 - i * 2);
      g.fillStyle(0xffffff, 0.4).fillRect(x, cy + i, 1, 1);
    }
  }
}

/** One hero on the select screen: an animated portrait, stats and abilities, and skin arrows. */
class Card extends Phaser.GameObjects.Container {
  /** The registry entry, without a skin applied. */
  readonly base: CharacterDef;
  private bg: Phaser.GameObjects.Image;
  private keys: [string, string];
  private sprite: Phaser.GameObjects.Sprite;
  private glow?: Phaser.GameObjects.Sprite;
  private pedestal: Phaser.GameObjects.Image;
  private role: Phaser.GameObjects.BitmapText;
  private pips: Phaser.GameObjects.Graphics;
  private abilities: Phaser.GameObjects.BitmapText[];
  private skinName?: Phaser.GameObjects.BitmapText;
  private arrows: SkinArrow[] = [];
  private picked = false;
  /** Left edge of the portrait and of the text, in card pixels. */
  private px: number;
  private tx: number;

  constructor(scene: Phaser.Scene, base: CharacterDef, onTap: () => void) {
    super(scene, 0, 0);
    this.base = base;
    const skins = base.skins ?? [];
    this.px = skins.length > 1 ? PORTRAIT_X_SKINS : PORTRAIT_X;
    this.tx = this.px + (skins.length > 1 ? 57 : 59);
    const def = this.def;
    this.keys = [panelTexture(scene, 'card', CARD_W, CARD_H, PANEL), panelTexture(scene, 'card_picked', CARD_W, CARD_H, PANEL_PICKED)];
    this.bg = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    // Picks on release, and only if the press wasn't a swipe.
    let pressed = false;
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => (pressed = true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (pressed && !dragged(scene, p)) onTap();
      pressed = false;
    });
    scene.input.on(Phaser.Input.Events.POINTER_UP, () => (pressed = false));
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => (pressed = false));

    // Portrait: the character at 2x on a lit pedestal.
    const inset = scene.add.image(this.px, 5, panelTexture(scene, 'portrait', 54, 82, PANEL_INSET)).setOrigin(0);
    const fx = this.px + 27;
    const fy = 78;
    this.pedestal = scene.add.image(fx, fy - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.4, 0.45);
    const shadow = scene.add.image(fx, fy, 'shadow').setScale(2);
    this.sprite = scene.add.sprite(fx, fy, def.preview.texture).setScale(2);
    if (def.preview.glow) this.glow = scene.add.sprite(fx, fy, def.preview.glow).setScale(2).setBlendMode(Phaser.BlendModes.ADD);

    const x = this.tx;
    const name = pixelText(scene, x, 7, def.name, 0xfff4d6, 2);
    this.role = pixelText(scene, x, 27, def.role, 0xb8a8e8);
    this.pips = scene.add.graphics();
    const labels = ['Power', 'Speed', 'Range'].map((label, i) => pixelText(scene, x, 39 + i * 9, label, 0x8a7cc0));
    this.abilities = [0, 1].map((i) => pixelText(scene, x, 68 + i * 10, ''));

    // Skins: arrows on both sides step through them; the worn one is named over the portrait.
    if (skins.length > 1) {
      this.skinName = pixelText(scene, 0, 9, '');
      this.arrows = [
        new SkinArrow(scene, ARROW_INSET, -1, () => this.stepSkin(-1, onTap)),
        new SkinArrow(scene, CARD_W - ARROW_INSET - ARROW_W, 1, () => this.stepSkin(1, onTap)),
      ];
    }

    this.add([this.bg, inset, this.pedestal, shadow, this.sprite, ...(this.glow ? [this.glow] : []), name, this.role, this.pips, ...labels, ...this.abilities, ...(this.skinName ? [this.skinName] : []), ...this.arrows]);
    scene.add.existing(this);
    this.applySkin(false);
    this.setPicked(false);
  }

  /** Wear the next (or previous) skin, and pick this card. */
  stepSkin(step: -1 | 1, pick: () => void): void {
    const skins = this.base.skins ?? [];
    if (skins.length < 2) return;
    const at = skins.findIndex((s) => s.id === skinOf(this.base)?.id);
    setSkin(this.base, skins[(at + step + skins.length) % skins.length].id);
    this.applySkin(true);
    pick();
  }

  /** The character in its worn skin. */
  get def(): CharacterDef {
    return wear(this.base);
  }

  /** Show the worn skin: portrait, accent colour, role, ability names, skin name and arrows. */
  private applySkin(animate: boolean): void {
    const def = this.def;
    const oy = def.preview.originY ?? 31 / 32;
    this.sprite.setTexture(def.preview.texture).setOrigin(0.5, oy);
    if (def.preview.glow) this.glow?.setTexture(def.preview.glow).setOrigin(0.5, oy);
    this.pedestal.setTint(def.accent);
    this.role.setText(def.role.toUpperCase());

    const x = this.tx;
    const stats = [def.stats.power, def.stats.speed, def.stats.range];
    const pips = this.pips.clear();
    stats.forEach((value, i) => {
      const y = 39 + i * 9;
      for (let p = 0; p < 5; p++) {
        pips.fillStyle(0x0b0818).fillRect(x + 36 + p * 7, y + 1, 7, 7);
        pips.fillStyle(p < value ? def.accent : 0x2a2150).fillRect(x + 37 + p * 7, y + 2, 5, 5);
        if (p < value) pips.fillStyle(0xffffff, 0.45).fillRect(x + 37 + p * 7, y + 2, 5, 1);
      }
    });
    [def.attack, def.special].forEach((a, i) => this.abilities[i].setText(`* ${a}`.toUpperCase()).setCharacterTint(0, 1, false, def.accent));

    if (this.skinName) {
      const skin = skinOf(this.base);
      this.skinName.setText((skin?.name ?? '').toUpperCase()).setTint(def.accent);
      this.skinName.setX(Math.round(this.px + 27 - this.skinName.width / 2));
      for (const a of this.arrows) a.draw(undefined, def.accent);
    }

    if (animate && this.picked) this.sprite.play(def.preview.chosen).chain(def.preview.idle);
    else this.sprite.play(def.preview.idle);
  }

  setPicked(on: boolean): void {
    const def = this.def;
    this.picked = on;
    this.bg.setTexture(this.keys[on ? 1 : 0]);
    this.pedestal.setAlpha(on ? 0.7 : 0.25);
    if (on) {
      this.sprite.clearTint().play(def.preview.chosen).chain(def.preview.idle);
    } else {
      this.sprite.setTint(0x8a84a8).play(def.preview.idle, true);
    }
    this.glow?.setAlpha(on ? 1 : 0.5);
  }

  sync(): void {
    this.glow?.setFrame(this.sprite.frame.name);
  }
}

/** Character select, opened over the home screen's forest. */
export class SelectScene extends Phaser.Scene {
  private cards: Card[] = [];
  private picked = 0;
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private back!: PixelButton;
  private play!: PixelButton;
  private leaving = false;
  /** The cards in two rows, which scroll sideways only when they can't fit. */
  private strip!: Phaser.GameObjects.Container;
  private hints: Phaser.GameObjects.Graphics[] = [];
  private scroll = 0;
  private maxScroll = 0;
  /** Where the row sits when unscrolled, and how wide the visible part is (art pixels). */
  private stripX = 0;
  private viewW = 0;
  private stripH = CARD_H;
  /** Scroll speed in art pixels per second, left over from a fling or a nudge. */
  private velocity = 0;
  /** Scroll position being eased to (keyboard, hint taps), or null. */
  private target: number | null = null;
  private drag: { x: number; scroll: number; t: number; last: number } | null = null;

  constructor() {
    super('select');
  }

  create(): void {
    this.leaving = false;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Choose your hero *', 0xf4cf6a);
    // Tapping a card only picks it; the game starts from the Play button (or Enter).
    this.cards = CHARACTERS.map((def, i) => new Card(this, def, () => this.pick(i, true)));
    this.strip = this.add.container(0, 0, this.cards);
    this.hints = [-1, 1].map((dir) => this.scrollHint(dir as -1 | 1));
    this.scroll = 0;
    this.velocity = 0;
    this.target = null;
    this.drag = null;
    this.bindScrolling();
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'back', () => this.goBack());
    this.play = new PixelButton(this, 'Next', 64, 20, BUTTON_GOLD, 'play', () => this.startGame());
    // Coming back from the arena select keeps the hero picked before.
    this.picked = Math.min(lastPicked, this.cards.length - 1);
    this.cards[this.picked].setPicked(true);

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.pick((this.picked + this.cards.length - 1) % this.cards.length, true));
    kb?.on('keydown-RIGHT', () => this.pick((this.picked + 1) % this.cards.length, true));
    kb?.on('keydown-UP', () => this.cards[this.picked].stepSkin(-1, () => {}));
    kb?.on('keydown-DOWN', () => this.cards[this.picked].stepSkin(1, () => {}));
    kb?.on('keydown-ENTER', () => this.startGame());
    kb?.on('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-ESC', () => this.goBack());

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, delta: number): void {
    for (const c of this.cards) c.sync();
    if (this.drag || this.maxScroll <= 0) return;
    const dt = delta / 1000;
    if (this.target !== null) {
      // Ease towards the target, snapping once within half a pixel.
      const next = this.scroll + (this.target - this.scroll) * Math.min(1, dt * 12);
      this.setScroll(Math.abs(this.target - next) < 0.5 ? this.target : next);
      if (this.scroll === this.target) this.target = null;
    } else if (this.velocity !== 0) {
      this.velocity *= Math.pow(FLING_KEEP, dt);
      if (Math.abs(this.velocity) < 8) this.velocity = 0;
      const before = this.scroll;
      this.setScroll(this.scroll + this.velocity * dt);
      if (this.scroll === before) this.velocity = 0;
    }
  }

  private pick(i: number, reveal = false): void {
    if (this.leaving || i === this.picked) return;
    this.cards[this.picked].setPicked(false);
    this.picked = lastPicked = i;
    this.cards[i].setPicked(true);
    if (reveal) this.reveal(i);
  }

  /** Drag or swipe the row, fling it on release, and scroll it with the mouse wheel. */
  private bindScrolling(): void {
    const toArt = (px: number) => px / this.cameras.main.zoom;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      // Only a press on the row of cards (or the gaps around it) drags it.
      const y = p.y / this.cameras.main.zoom - this.strip.y;
      if (this.maxScroll <= 0 || y < -GAP || y > this.stripH + GAP) return;
      this.drag = { x: p.x, scroll: this.scroll, t: p.time, last: this.scroll };
      this.velocity = 0;
      this.target = null;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      const next = d.scroll - toArt(p.x - d.x);
      // Track speed over the last few frames for the fling.
      const dt = Math.max(1, p.time - d.t) / 1000;
      this.velocity = Phaser.Math.Linear(this.velocity, (next - d.last) / dt, 0.5);
      d.t = p.time;
      d.last = next;
      this.setScroll(next);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (!this.drag) return;
      // A press that barely moved, or a pause before letting go, doesn't fling.
      if (!dragged(this, p) || p.time - this.drag.t > 80) this.velocity = 0;
      this.drag = null;
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) => {
      if (this.maxScroll <= 0 || this.drag) return;
      const step = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      this.target = Phaser.Math.Clamp((this.target ?? this.scroll) + toArt(step), 0, this.maxScroll);
      this.velocity = 0;
    });
  }

  /** A chevron at the screen's edge that shows there are more heroes that way; tap it to scroll. */
  private scrollHint(dir: -1 | 1): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      const x = dir < 0 ? 3 - i : i;
      g.fillStyle(0x0b0818, 0.8).fillRect(x - 1, i - 1, 3, 13 - i * 2);
    }
    for (let i = 0; i < 4; i++) {
      const x = dir < 0 ? 3 - i : i;
      g.fillStyle(0xf4cf6a).fillRect(x, i, 1, 11 - i * 2);
    }
    g.setInteractive(new Phaser.Geom.Rectangle(dir < 0 ? -4 : -6, -12, 14, 35), Phaser.Geom.Rectangle.Contains);
    g.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (dragged(this, p)) return;
      this.target = Phaser.Math.Clamp((this.target ?? this.scroll) + dir * (CARD_W + GAP), 0, this.maxScroll);
      this.velocity = 0;
    });
    return g;
  }

  private setScroll(value: number): void {
    this.scroll = Phaser.Math.Clamp(value, 0, Math.max(0, this.maxScroll));
    this.strip.x = Math.round(this.stripX - this.scroll);
    const [left, right] = this.hints;
    const on = this.maxScroll > 0;
    left.setAlpha(on && this.scroll > 1 ? 1 : 0);
    right.setAlpha(on && this.scroll < this.maxScroll - 1 ? 1 : 0);
    // A hidden hint mustn't swallow taps meant for the card under it.
    for (const h of this.hints) if (h.input) h.input.enabled = h.alpha > 0;
  }

  /** Scroll just enough to show the whole of card i. */
  private reveal(i: number): void {
    if (this.maxScroll <= 0) return;
    const x = this.cards[i].x;
    const from = this.target ?? this.scroll;
    const to = Math.min(Math.max(from, x + CARD_W - this.viewW), x);
    this.target = Phaser.Math.Clamp(to, 0, this.maxScroll);
    this.velocity = 0;
  }

  private goBack(): void {
    if (this.leaving) return;
    this.leaving = true;
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** On to the arena select, with this hero. */
  private startGame(): void {
    if (this.leaving) return;
    this.leaving = true;
    const character = this.cards[this.picked].def.id;
    this.scene.launch('arena', { character });
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  private layout(): void {
    const { width, height } = this.scale;
    // Two rows of cards, as many columns as that takes. When they don't fit at the
    // usual zoom, zoom out a whole step at a time (keeping the pixels crisp), but no
    // further than half; past that the rows scroll sideways.
    const n = this.cards.length;
    const rows = Math.min(2, n);
    const cols = Math.ceil(n / rows);
    const margin = 8;
    const fullW = cols * CARD_W + (cols - 1) * GAP;
    const blockH = rows * CARD_H + (rows - 1) * GAP;
    const zMax = menuZoom(width, height);
    const zMin = Math.max(1, Math.ceil(zMax / 2));
    let z = zMax;
    let area = this.area(height / z, z);
    while (z > zMin && (fullW + margin * 2 > width / z || blockH > area.h)) {
      z--;
      area = this.area(height / z, z);
    }
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    this.header.setPosition(Math.round((vw - this.header.width) / 2), area.headerY);
    this.play.place((vw - this.play.boxW) / 2, area.buttonsY);
    this.back.place(8, area.buttonsY + 1);

    // The rows are centred on each other and in the space between the header and the buttons.
    const y0 = Math.max(area.top, Math.round(area.top + (area.h - blockH) / 2));
    this.cards.forEach((c, i) => {
      const r = Math.floor(i / cols);
      const inRow = Math.min(cols, n - r * cols);
      const rowW = inRow * CARD_W + (inRow - 1) * GAP;
      c.setPosition(Math.round((fullW - rowW) / 2) + (i % cols) * (CARD_W + GAP), r * (CARD_H + GAP));
    });

    this.viewW = vw - margin * 2;
    this.maxScroll = Math.max(0, fullW - this.viewW);
    this.stripX = this.maxScroll > 0 ? margin : Math.round((vw - fullW) / 2);
    this.strip.y = y0;
    this.stripH = blockH;
    const hintY = Math.round(y0 + blockH / 2 - 5);
    this.hints[0].setPosition(2, hintY);
    this.hints[1].setPosition(Math.floor(vw) - 6, hintY);
    this.target = null;
    this.velocity = 0;
    this.setScroll(this.scroll);
    this.reveal(this.picked);
  }

  /** Where the header and buttons go on a view this tall (art pixels), and the space left for cards. */
  private area(vh: number, z: number): { headerY: number; buttonsY: number; top: number; h: number } {
    const headerY = Math.ceil(fpsBottom() / z) + 4;
    const buttonsY = Math.round(vh - 26);
    const top = headerY + this.header.height + 6;
    return { headerY, buttonsY, top, h: buttonsY - 6 - top };
  }
}
