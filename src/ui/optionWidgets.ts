// The pause menu's controls besides the sliders: an On/Off switch, a value
// with arrows either side to step through its choices, and the mouse
// pointer picker (a card to swipe through the pointers, each shown large
// with a taste of its effects). All drawn in menu art px and positioned by
// their top-left corner at the scene's root, like the slider.

import Phaser from 'phaser';
import { pixelCanvas } from '../art/canvas';
import { hex } from '../art/pixel';
import { POINTERS, POINTER_SIZE, pointerPixels, type PointerDef } from '../art/pointers';
import { PANEL_INSET, panelTexture, pixelText, type PanelStyle } from './widgets';

const OUTER = hex('#0b0818');
/** A lit switch: a sunken green track. */
const SWITCH_ON: PanelStyle = { top: hex('#145a40'), bottom: hex('#2fae7a'), alpha: 1, border: hex('#0c3a28'), borderLit: hex('#0a2c1e'), outer: OUTER };
const KNOB: PanelStyle = { top: hex('#fff0b4'), bottom: hex('#d89a3c'), alpha: 1, border: hex('#8a5424'), borderLit: hex('#fff6d8'), outer: OUTER };
const TRACK_W = 24;
const SWITCH_H = 12;
const KNOB_W = 12;
const SLIDE_MS = 90;

/** The common shape of a menu row's control. */
export interface MenuControl extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH: number;
  place(x: number, y: number): this;
}

/** An On/Off switch: a track with a gold knob that slides across, and the word beside it. */
export class PixelSwitch extends Phaser.GameObjects.Container implements MenuControl {
  readonly boxW: number;
  readonly boxH = SWITCH_H;
  private lit: boolean;
  private track: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  private word: Phaser.GameObjects.BitmapText;
  private hit: Phaser.GameObjects.Zone;
  private keys: [string, string];
  private slide: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, w: number, on: boolean, onChange: (on: boolean) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.lit = on;
    this.keys = [panelTexture(scene, 'switch_off', TRACK_W, SWITCH_H, PANEL_INSET), panelTexture(scene, 'switch_on', TRACK_W, SWITCH_H, SWITCH_ON)];
    this.track = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    this.knob = scene.add.image(0, 0, panelTexture(scene, 'switch_knob', KNOB_W, SWITCH_H, KNOB)).setOrigin(0);
    this.word = pixelText(scene, TRACK_W + 5, 3, '');
    this.hit = scene.add.zone(-3, -3, w + 6, SWITCH_H + 6).setOrigin(0).setInteractive({ useHandCursor: true });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => onChange(!this.lit));
    this.add([this.track, this.knob, this.word, this.hit]);
    scene.add.existing(this);
    this.setOn(on, false);
  }

  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  setEnabled(on: boolean): this {
    if (this.hit.input) this.hit.input.enabled = on;
    return this;
  }

  setOn(on: boolean, animate = true): this {
    if (on === this.lit && animate) return this;
    this.lit = on;
    this.track.setTexture(this.keys[on ? 1 : 0]);
    this.word.setText(on ? 'ON' : 'OFF').setTint(on ? 0x9dffb0 : 0x8a7ab8);
    const to = on ? TRACK_W - KNOB_W : 0;
    this.slide?.stop();
    this.slide = null;
    if (!animate) this.knob.setX(to);
    else {
      const from = this.knob.x;
      // Whole pixels all the way across.
      this.slide = this.scene.tweens.addCounter({ from: 0, to: 1, duration: SLIDE_MS, ease: 'Cubic.Out', onUpdate: (t) => this.knob.setX(Math.round(from + (to - from) * t.getValue()!)) });
    }
    return this;
  }
}

/** A value with an arrow either side: the left steps back, the rest of it forward. */
export class PixelCycler extends Phaser.GameObjects.Container implements MenuControl {
  readonly boxW: number;
  readonly boxH = 14;
  private label: Phaser.GameObjects.BitmapText;
  private arrows: Phaser.GameObjects.Image[];
  private zones: Phaser.GameObjects.Zone[];

  constructor(scene: Phaser.Scene, w: number, onStep: (dir: 1 | -1) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    const bg = scene.add.image(0, 0, panelTexture(scene, 'cycler', w, this.boxH, PANEL_INSET)).setOrigin(0);
    const tex = arrowTexture(scene);
    this.arrows = [
      scene.add.image(4, 4, tex).setOrigin(0).setFlipX(true).setTint(0xffd970),
      scene.add.image(w - 8, 4, tex).setOrigin(0).setTint(0xffd970),
    ];
    this.label = pixelText(scene, 0, 4, '');
    const third = Math.round(w / 3);
    this.zones = [
      scene.add.zone(-3, -3, third + 3, this.boxH + 6).setOrigin(0).setInteractive({ useHandCursor: true }),
      scene.add.zone(third, -3, w - third + 3, this.boxH + 6).setOrigin(0).setInteractive({ useHandCursor: true }),
    ];
    this.zones.forEach((z, i) => {
      const dir = i === 0 ? -1 : 1;
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.nudge(i, true));
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.nudge(i, false));
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.nudge(i, false);
        onStep(dir);
      });
    });
    this.add([bg, ...this.arrows, this.label, ...this.zones]);
    scene.add.existing(this);
  }

  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  setEnabled(on: boolean): this {
    for (const z of this.zones) if (z.input) z.input.enabled = on;
    return this;
  }

  setText(text: string): this {
    this.label.setText(text.toUpperCase());
    this.label.setX(Math.round((this.boxW - this.label.width) / 2));
    return this;
  }

  /** The pressed side's arrow steps out a pixel and lights up. */
  private nudge(i: number, down: boolean): void {
    const a = this.arrows[i];
    a.setX(i === 0 ? 4 - (down ? 1 : 0) : this.boxW - 8 + (down ? 1 : 0)).setTint(down ? 0xffffff : 0xffd970);
  }
}

/** A small right-pointing arrowhead, 4 x 7, white to tint. */
function arrowTexture(scene: Phaser.Scene): string {
  const key = 'cycler_arrow';
  if (scene.textures.exists(key)) return key;
  const px = new Uint8ClampedArray(4 * 7 * 4);
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 4; x++) {
      if (x > 3 - Math.abs(y - 3)) continue;
      const lit = y < 3 || x === 0;
      px.set(lit ? [255, 255, 255, 255] : [200, 200, 200, 255], (y * 4 + x) * 4);
    }
  }
  scene.textures.addCanvas(key, pixelCanvas(4, 7, px));
  return key;
}

/** The pointer's sprite as a texture (its plain look), for the picker's card. */
export function pointerTexture(scene: Phaser.Scene, def: PointerDef): string {
  const key = `ptr_${def.id}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pixelCanvas(POINTER_SIZE, POINTER_SIZE, pointerPixels(def.id, false)));
  return key;
}

const boxes = new Map<string, { cx: number; cy: number }>();
/** The middle of a pointer's drawn pixels (outline in, shadow and glow out), in its art px. */
function pointerBox(def: PointerDef): { cx: number; cy: number } {
  const done = boxes.get(def.id);
  if (done) return done;
  const px = pointerPixels(def.id, false);
  let x0 = POINTER_SIZE;
  let y0 = POINTER_SIZE;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < POINTER_SIZE; y++) {
    for (let x = 0; x < POINTER_SIZE; x++) {
      if (px[(y * POINTER_SIZE + x) * 4 + 3] < 255) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  }
  const box = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  boxes.set(def.id, box);
  return box;
}

/** A soft dithered disc, white to tint: the glow behind the pointer on its card. */
function glowTexture(scene: Phaser.Scene): string {
  const key = 'ptr_glow';
  if (scene.textures.exists(key)) return key;
  const R = 20;
  const S = R * 2;
  const px = new Uint8ClampedArray(S * S * 4);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - R, y + 0.5 - R) / R;
      if (d >= 1) continue;
      // Three steps of light, dithered where they meet.
      const v = (1 - d) * 3 + (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
      const step = Math.max(0, Math.min(3, Math.floor(v)));
      if (!step) continue;
      px.set([255, 255, 255, [0, 40, 80, 130][step]], (y * S + x) * 4);
    }
  }
  scene.textures.addCanvas(key, pixelCanvas(S, S, px));
  return key;
}

const CARD_W = 92;
const CARD_H = 50;
const ARROW_W = 16;
const DOTS_H = 7;
/** How far (menu px) a drag goes before it counts as a swipe. */
const SWIPE = 12;

interface MiniPart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  seed: number;
}

/**
 * The pointer picker: the picked pointer drawn large on a card with its own
 * glow and name, arrows either side and a dot for each. Swipe the card (or
 * tap the arrows) to go through them; the pick applies at once, so the
 * mouse itself shows it off. The heavy ones burn or sparkle on the card too.
 */
export class PointerPicker extends Phaser.GameObjects.Container implements MenuControl {
  readonly boxW = CARD_W + (ARROW_W + 3) * 2;
  readonly boxH = CARD_H + DOTS_H;
  private index: number;
  private content: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Image;
  private art: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.BitmapText;
  private dots: Phaser.GameObjects.Graphics;
  private fx: Phaser.GameObjects.Graphics;
  private parts: MiniPart[] = [];
  private spawn = 0;
  private clock = 0;
  private hits: Phaser.GameObjects.Zone[];
  private arrows: Phaser.GameObjects.Image[];
  private dragFrom: number | null = null;
  private artX = 0;
  private artY = 0;
  private slide: Phaser.Tweens.Tween | null = null;
  private swiped = false;

  constructor(scene: Phaser.Scene, current: string, private onPick: (def: PointerDef) => void) {
    super(scene, 0, 0);
    this.index = Math.max(0, POINTERS.findIndex((p) => p.id === current));
    const cx = ARROW_W + 3;
    const card = scene.add.image(cx, 0, panelTexture(scene, 'ptr_card', CARD_W, CARD_H, PANEL_INSET)).setOrigin(0);
    this.glow = scene.add.image(CARD_W / 2, 20, glowTexture(scene)).setBlendMode(Phaser.BlendModes.ADD);
    this.art = scene.add.image(CARD_W / 2 - POINTER_SIZE, 4, pointerTexture(scene, POINTERS[0])).setOrigin(0).setScale(2);
    this.title = pixelText(scene, 0, CARD_H - 11, '');
    this.fx = scene.add.graphics();
    this.content = scene.add.container(cx, 0, [this.glow, this.fx, this.art, this.title]);
    this.dots = scene.add.graphics();

    const tex = bigArrowTexture(scene);
    this.arrows = [
      scene.add.image(0, Math.round((CARD_H - 13) / 2), tex).setOrigin(0).setFlipX(true).setTint(0xffd970),
      scene.add.image(this.boxW - ARROW_W, Math.round((CARD_H - 13) / 2), tex).setOrigin(0).setTint(0xffd970),
    ];
    const arrowHit = (i: number) => {
      const z = scene.add.zone(i === 0 ? -4 : this.boxW - ARROW_W - 2, -2, ARROW_W + 6, CARD_H + 4).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.arrows[i].setTint(0xffffff).setX(i === 0 ? -1 : this.boxW - ARROW_W + 1));
      const lift = () => this.arrows[i].setTint(0xffd970).setX(i === 0 ? 0 : this.boxW - ARROW_W);
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, lift);
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        lift();
        this.step(i === 0 ? -1 : 1);
      });
      return z;
    };
    // The card itself: drag sideways to swipe, or tap for the next one.
    const cardHit = scene.add.zone(cx, 0, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
    cardHit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragFrom = p.x;
      this.swiped = false;
    });
    cardHit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.dragFrom !== null && !this.swiped) this.step(1);
      this.dragFrom = null;
    });
    const move = (p: Phaser.Input.Pointer) => {
      if (this.dragFrom === null || !p.isDown) return;
      const dx = (p.x - this.dragFrom) / this.scene.cameras.main.zoom;
      if (Math.abs(dx) < SWIPE) return;
      this.swiped = true;
      this.dragFrom = p.x;
      this.step(dx < 0 ? 1 : -1);
    };
    const release = () => {
      // A swipe that ends off the card still counts; only a tap needs to end on it.
      if (this.swiped) this.dragFrom = null;
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, move);
    scene.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, move);
      scene.input.off(Phaser.Input.Events.POINTER_UP, release);
    });
    this.hits = [arrowHit(0), arrowHit(1), cardHit];

    this.add([card, this.content, this.dots, ...this.arrows, ...this.hits]);
    scene.add.existing(this);
    this.show(0);
  }

  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  setEnabled(on: boolean): this {
    for (const z of this.hits) if (z.input) z.input.enabled = on;
    if (!on) this.dragFrom = null;
    return this;
  }

  /** Show the pointer that's picked now (it may have changed elsewhere). */
  sync(id: string): void {
    const i = POINTERS.findIndex((p) => p.id === id);
    if (i >= 0 && i !== this.index) {
      this.index = i;
      this.show(0);
    }
  }

  private step(dir: 1 | -1): void {
    this.index = (this.index + dir + POINTERS.length) % POINTERS.length;
    this.show(dir);
    this.onPick(POINTERS[this.index]);
  }

  /** Put the picked pointer on the card, sliding in from the side it came from. */
  private show(dir: number): void {
    const def = POINTERS[this.index];
    this.art.setTexture(pointerTexture(this.scene, def));
    // Centre the drawing itself, not its square: the arrows sit in its top-left corner, the blades fill it.
    const box = pointerBox(def);
    this.artX = Math.round(CARD_W / 2 - box.cx * 2);
    this.artY = Math.round(20 - box.cy * 2);
    this.art.setPosition(this.artX, this.artY);
    this.glow.setTint(def.accent).setAlpha(0.8);
    this.title.setText(def.name.toUpperCase()).setTint(def.accent);
    this.title.setX(Math.round((CARD_W - this.title.width) / 2));
    this.parts.length = 0;
    this.fx.clear();
    this.drawDots();
    const cx = ARROW_W + 3;
    this.slide?.stop();
    this.slide = null;
    if (!dir) {
      this.content.setPosition(cx, 0).setAlpha(1);
      return;
    }
    this.content.setAlpha(0);
    this.slide = this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration: 160,
      ease: 'Cubic.Out',
      onUpdate: (t) => {
        const v = t.getValue()!;
        this.content.setPosition(cx + Math.round(dir * 10 * v), 0).setAlpha(1 - v);
      },
    });
  }

  private drawDots(): void {
    const g = this.dots.clear();
    const n = POINTERS.length;
    const w = n * 3 + (n - 1) * 3 + 3;
    let x = Math.round((this.boxW - w) / 2);
    const y = CARD_H + 3;
    for (let i = 0; i < n; i++) {
      const on = i === this.index;
      const dw = on ? 6 : 3;
      g.fillStyle(0x0b0818).fillRect(x - 1, y - 1, dw + 2, 5);
      g.fillStyle(on ? 0xffd970 : 0x5a4a90).fillRect(x, y, dw, 3);
      if (on) g.fillStyle(0xfff6d8).fillRect(x, y, dw, 1);
      x += dw + 3;
    }
  }

  /** The card's own little show: Ember burns, Starfall's motes circle and stars fall; the rest bob gently. */
  update(dt: number): void {
    if (!this.visible) return;
    const s = dt / 1000;
    this.clock += s;
    const def = POINTERS[this.index];
    const ax = this.artX;
    // A slow bob of a pixel, so the card feels alive.
    this.art.setY(this.artY + (Math.floor(this.clock * 1.6) % 2));
    const g = this.fx.clear();
    if (!def.heavy) return;
    // Art px on the card are 2 menu px; the tip is at (ax + 2, art.y + 2).
    const tipX = ax + 2;
    const tipY = this.art.y + 2;
    if (def.fx === 'ember') {
      this.spawn += s * 22;
      for (; this.spawn >= 1; this.spawn--) {
        const oy = Math.random() * 18;
        const ox = Math.random() * Math.min(oy * 0.8, 10);
        this.parts.push({ x: tipX + ox, y: tipY + oy, vx: (Math.random() - 0.5) * 10, vy: -16 - Math.random() * 22, age: 0, life: 0.35 + Math.random() * 0.4, seed: Math.random() });
      }
    } else if (def.fx === 'petals') {
      // Petals letting go of the blossom and drifting down past the twig.
      this.spawn += s * 2.2;
      for (; this.spawn >= 1; this.spawn--) {
        this.parts.push({ x: tipX + Math.random() * 10, y: tipY + Math.random() * 8, vx: 4 + Math.random() * 8, vy: 6 + Math.random() * 6, age: 0, life: 1.6 + Math.random() * 0.8, seed: Math.random() });
      }
    } else {
      // Starfall's stars, or Frost's snow, falling across the card.
      this.spawn += s * (def.fx === 'frost' ? 6 : 3);
      for (; this.spawn >= 1; this.spawn--) {
        this.parts.push({ x: tipX - 6 + Math.random() * 36, y: tipY - 4 + Math.random() * 10, vx: 0, vy: 8 + Math.random() * 10, age: 0, life: 0.9 + Math.random() * 0.6, seed: Math.random() });
      }
    }
    const FIRE = [0xfffbe0, 0xffe070, 0xffb03a, 0xff8a28, 0xf2601e, 0xd23a18, 0xa82418];
    const STAR = [0xffffff, 0x9ef0ff, 0xc8a8ff, 0xffe08a];
    const PETAL = [0xffd0e2, 0xffb0cc, 0xff8ab4, 0xfff0f6];
    let n = 0;
    for (const p of this.parts) {
      p.age += s;
      if (p.age >= p.life) continue;
      // Snow and petals swing side to side as they fall.
      const sway = def.fx === 'frost' || def.fx === 'petals' ? Math.sin(p.age * 4 + p.seed * 6) * 6 : 0;
      p.x += (p.vx + sway) * s;
      p.y += p.vy * s;
      this.parts[n++] = p;
      // Kept inside the card.
      if (p.x < 3 || p.x > CARD_W - 4 || p.y < 3 || p.y > CARD_H - 13) continue;
      const f = p.age / p.life;
      if (def.fx === 'ember') {
        g.fillStyle(FIRE[Math.min(FIRE.length - 1, Math.floor(f * FIRE.length))]).fillRect(Math.floor(p.x), Math.floor(p.y), f < 0.4 ? 2 : 1, f < 0.4 ? 2 : 1);
      } else if (def.fx === 'petals') {
        const c = PETAL[Math.floor(p.seed * PETAL.length)];
        g.fillStyle(c, f > 0.8 ? (1 - f) * 5 : 1).fillRect(Math.floor(p.x), Math.floor(p.y), Math.sin(p.age * 5 + p.seed * 9) > 0 ? 2 : 1, 1);
      } else if (def.fx === 'frost') {
        g.fillStyle(p.seed < 0.6 ? 0xffffff : 0xbff4ff, f > 0.7 ? (1 - f) / 0.3 : 1).fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
        if (p.seed > 0.75) g.fillRect(Math.floor(p.x) - 1, Math.floor(p.y), 3, 1).fillRect(Math.floor(p.x), Math.floor(p.y) - 1, 1, 3);
      } else {
        const c = STAR[Math.floor(p.seed * STAR.length)];
        g.fillStyle(c, f > 0.7 ? (1 - f) / 0.3 : 1).fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
        if (Math.floor(p.age * 9 + p.seed * 7) % 3 === 0) {
          g.fillRect(Math.floor(p.x) - 1, Math.floor(p.y), 3, 1).fillRect(Math.floor(p.x), Math.floor(p.y) - 1, 1, 3);
        }
      }
    }
    this.parts.length = n;
    if (def.fx === 'starfall') {
      // Two motes round the crystal, its long axis across the diagonal.
      const cx = tipX + 10;
      const cy = tipY + 10;
      for (let m = 0; m < 2; m++) {
        for (let k = 3; k >= 0; k--) {
          const a = (this.clock / 1.7) * Math.PI * 2 + m * Math.PI - k * 0.2;
          const along = Math.cos(a) * 15;
          const across = Math.sin(a) * 5;
          const x = cx + (along + across) * Math.SQRT1_2;
          const y = cy + (-along + across) * Math.SQRT1_2;
          const c = k === 0 ? 0xffffff : k === 1 ? 0x8ee4ff : k === 2 ? 0x9a7aff : 0x4a2a90;
          g.fillStyle(c).fillRect(Math.floor(x), Math.floor(y), k === 0 ? 2 : 1, k === 0 ? 2 : 1);
        }
      }
    }
  }
}

/** The picker's arrows: a gold chevron, 8 x 13, white to tint. */
function bigArrowTexture(scene: Phaser.Scene): string {
  const key = 'ptr_arrow';
  if (scene.textures.exists(key)) return key;
  const W = 8;
  const H = 13;
  const px = new Uint8ClampedArray(W * H * 4);
  const on = (x: number, y: number) => {
    // A chevron three pixels thick.
    const d = 6 - Math.abs(y - 6);
    return x >= d - 1 && x <= d + 1 && x >= 0 && x < W;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (on(x, y)) px.set(y < 6 ? [255, 255, 255, 255] : [210, 210, 210, 255], (y * W + x) * 4);
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) px.set([11, 8, 24, 255], (y * W + x) * 4);
    }
  }
  scene.textures.addCanvas(key, pixelCanvas(W, H, px));
  return key;
}
