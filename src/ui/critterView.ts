// Hazel the Naturalist's counter at her camp in the Clearing, where spare
// critters sell for dust. It opens over the world like the Rune Temple
// keepers' counters (see keeperHud.ts), and shares their shape:
//
//  - Across the top: Hazel (animated, in a little alcove), her name and what
//    she says, and the player's dust.
//  - A line of how many spares there are and what they're worth, with a
//    button that sells every one.
//  - Every critter as a jar on a shelf, how many spares of it are over each
//    (the first of each kind is kept, and never sold); tap one to pick it.
//  - Under them, the picked critter: its name and rarity, what she pays for
//    it, and buttons to sell one or all of its spares.
//
// Drawn in art pixels; the host scales it and passes pointer events in the
// view's own coordinates.

import Phaser from 'phaser';
import { sound } from '../audio';
import { HAZEL_FRAMES, HAZEL_H, HAZEL_W } from '../art/naturalist';
import { JAR_H, JAR_W } from '../art/critters';
import { CRITTERS, CRITTER_PRICE, type CritterDef } from '../game/critters';
import { collection } from '../game/collection';
import { NATURALIST } from '../game/keepers';
import { Button, wrap } from './inventoryView';
import { PANEL_INSET, panelTexture, pixelText } from './widgets';

const HEAD_H = 46;
const LINE = 10;
const CH = 6;
const ROW_H = 16;
const GAP = 4;
/** Under each jar: its shelf and the count of spares. */
const UNDER = 11;
const INFO_H = 34;
const BTN_H = 16;
const BTN_W = 60;
const ALL_W = 108;
const TAP_SLOP = 5;

const DIM = 0x9a90c8;
const SOFT = 0x7c82b8;
const CREAM = 0xfff4d6;
const GOLD = 0xf4cf6a;
const DUSTY = 0xd8b0ff;
const LAVENDER = 0xb8a8e8;
const OMEN = 0xff7a6a;
/** The shelves, as on the Inventory's Critters page. */
const WOOD = 0x6a4424;
const WOOD_LIT = 0xb88a50;
const WOOD_DARK = 0x2a1a0c;

const RARITY_NAME = { common: 'Common', rare: 'Rare', omen: 'Omen' } as const;
const RARITY_TINT = { common: LAVENDER, rare: GOLD, omen: OMEN } as const;
const RARITY_TIER = { common: 0, rare: 1, omen: 2 } as const;

interface Cell {
  def: CritterDef;
  box: Phaser.GameObjects.Container;
  jar: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite;
  count: Phaser.GameObjects.BitmapText;
  /** Its jar's rectangle, in the view's coordinates. */
  rect: [number, number, number, number];
}

export class CritterView extends Phaser.GameObjects.Container {
  usedW = 0;
  usedH = 0;
  private alcove: Phaser.GameObjects.Image;
  private portrait: Phaser.GameObjects.Image;
  private portraitGlow: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.BitmapText;
  private says: Phaser.GameObjects.BitmapText[] = [];
  private dustBox: Phaser.GameObjects.Image;
  private dustIcon: Phaser.GameObjects.Image;
  private dustText: Phaser.GameObjects.BitmapText;
  private total: Phaser.GameObjects.BitmapText;
  private sellEvery: Button;
  private shelves: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Graphics;
  private cells: Cell[] = [];
  private critterName: Phaser.GameObjects.BitmapText;
  private what: Phaser.GameObjects.BitmapText;
  private sellOne: Button;
  private sellAll: Button;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** "+N DUST" rising off a jar as it's sold. */
  private flash: Phaser.GameObjects.BitmapText;
  private picked = 0;
  private jarScale = 2;
  private cellW = 0;
  private cellH = 0;
  /** What was caught when the cells were last built, and at what size. */
  private built = '';
  private press: { x: number; y: number; moved: boolean; button: Button | null } | null = null;
  private time = 0;
  private unwatch: () => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const k = NATURALIST;
    this.alcove = scene.add.image(0, 0, panelTexture(scene, 'nt_alcove', HAZEL_W + 8, HEAD_H, PANEL_INSET)).setOrigin(0);
    this.portrait = scene.add.image(0, 0, k.texture, 'f0').setOrigin(0);
    this.portraitGlow = scene.add.image(0, 0, `${k.texture}_e`, 'f0').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.title = pixelText(scene, 0, 0, `${k.name} ${k.title}`, k.tint);
    this.dustBox = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.dustIcon = scene.add.image(0, 0, 'dust_icon').setOrigin(0);
    this.dustText = pixelText(scene, 0, 0, '', DUSTY);
    this.total = pixelText(scene, 0, 0, '', DIM);
    this.sellEvery = new Button(scene);
    this.shelves = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.critterName = pixelText(scene, 0, 0, '');
    this.what = pixelText(scene, 0, 0, '', DIM);
    this.sellOne = new Button(scene);
    this.sellAll = new Button(scene);
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 15, max: 50 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 1, end: 0 },
      tint: [0xffffff, DUSTY, 0xb070ff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.flash = pixelText(scene, 0, 0, '', DUSTY).setAlpha(0);
    this.add([this.alcove, this.portrait, this.portraitGlow, this.title, this.dustBox, this.dustIcon, this.dustText, this.total, this.sellEvery, this.shelves]);
    this.add([this.marks, this.critterName, this.what, this.sellOne, this.sellAll, this.sparks, this.flash]);
    this.picked = Math.max(0, CRITTERS.findIndex((d) => collection.critterSpares(d.id) > 0));
    this.unwatch = collection.watch(() => this.refresh());
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unwatch());
    scene.add.existing(this);
  }

  /** Lay the view out in a w x h area (art pixels). */
  resize(w: number, h: number): void {
    this.usedW = w;
    this.usedH = h;

    // Hazel in her alcove, her name and words, and the dust in hand.
    this.portrait.setPosition(4, HEAD_H - HAZEL_H - 3);
    this.portraitGlow.setPosition(4, HEAD_H - HAZEL_H - 3);
    const tx = HAZEL_W + 16;
    this.title.setPosition(tx, 3);
    const dustW = 58;
    this.dustBox.setTexture(panelTexture(this.scene, 'keeper_dust', dustW, 17, PANEL_INSET)).setPosition(w - dustW, 0);
    this.dustIcon.setPosition(w - dustW + 5, 3);
    this.dustText.setY(5);
    for (const t of this.says) t.destroy();
    const chars = Math.floor((w - tx) / CH);
    this.says = wrap(NATURALIST.hello.toUpperCase(), chars)
      .slice(0, 3)
      .map((s, i) => pixelText(this.scene, tx, 16 + i * LINE, s, DIM));
    this.add(this.says);

    // The jars as big as they'll go: twice their size if every row fits, else their own.
    const top = HEAD_H + 6 + ROW_H + 4;
    const room = h - top - INFO_H;
    const fits = (s: number) => {
      const cw = JAR_W * s + 6;
      const ch = JAR_H * s + UNDER;
      const cols = Math.max(1, Math.floor((w + GAP) / (cw + GAP)));
      const rows = Math.ceil(CRITTERS.length / cols);
      return rows * ch + (rows - 1) * GAP <= room;
    };
    this.jarScale = fits(2) ? 2 : 1;
    this.cellW = JAR_W * this.jarScale + 6;
    this.cellH = JAR_H * this.jarScale + UNDER;
    this.build(true);
    this.layout(top);
    this.refresh();
  }

  /** Make the jars again when what's been caught has changed (or their size has). */
  private build(force = false): void {
    const key = `${this.jarScale} ${CRITTERS.map((d) => collection.critterCount(d.id)).join()}`;
    if (key === this.built && !force) return;
    this.built = key;
    for (const c of this.cells) c.box.destroy();
    const s = this.jarScale;
    this.cells = CRITTERS.map((def) => {
      const scene = this.scene;
      const n = collection.critterCount(def.id);
      const parts: Phaser.GameObjects.GameObject[] = [];
      if (n && def.glow) parts.push(scene.add.image(0, -JAR_H * s * 0.55, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0.3).setScale(0.65 * s));
      const jar = scene.add.sprite(0, 0, 'jars', n ? `${def.id}_0` : 'empty').setOrigin(0.5, 1).setScale(s);
      if (n) jar.play({ key: `jar_${def.id}`, startFrame: Math.floor(Math.random() * 4) });
      else jar.setTint(0x8a86a8).setAlpha(0.7);
      const glow = scene.add.sprite(0, 0, 'jars_e', n ? `${def.id}_0` : 'empty').setOrigin(0.5, 1).setScale(s).setBlendMode(Phaser.BlendModes.ADD).setVisible(n > 0);
      parts.push(jar, glow);
      if (!n) {
        const q = pixelText(scene, 0, 0, '?', SOFT);
        q.setPosition(Math.round(-q.width / 2), Math.round(-JAR_H * s * 0.5 - 3));
        parts.push(q);
      }
      const count = pixelText(scene, 0, 3, '');
      parts.push(count);
      const box = scene.add.container(0, 0, parts);
      this.addAt(box, this.getIndex(this.shelves) + 1);
      return { def, box, jar, glow, count, rect: [0, 0, 0, 0] as [number, number, number, number] };
    });
  }

  /** Put the jars in rows on their shelves, from `top` down. */
  private layout(top: number): void {
    const { cellW: cw, cellH: ch, usedW: w } = this;
    const cols = Math.max(1, Math.floor((w + GAP) / (cw + GAP)));
    const rows = Math.ceil(this.cells.length / cols);
    const rowW = cols * cw + (cols - 1) * GAP;
    const x0 = Math.round((w - rowW) / 2);
    const floor = (row: number) => top + row * (ch + GAP) + ch - UNDER;
    this.cells.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = x0 + col * (cw + GAP);
      c.box.setPosition(x + cw / 2, floor(row));
      c.rect = [x, top + row * (ch + GAP), cw, ch];
    });
    // A shelf under each row: a plank with a lit top edge, a dark lip under it and a bracket at each end.
    const g = this.shelves.clear();
    const left = x0 - 3;
    const width = rowW + 6;
    for (let r = 0; r < rows; r++) {
      const y = floor(r);
      g.fillStyle(WOOD, 1).fillRect(left, y, width, 3);
      g.fillStyle(WOOD_LIT, 1).fillRect(left, y, width, 1);
      g.fillStyle(WOOD_DARK, 1).fillRect(left, y + 3, width, 1);
      g.fillStyle(WOOD_DARK, 1).fillRect(left + 2, y + 4, 2, 2).fillRect(left + width - 4, y + 4, 2, 2);
    }
  }

  refresh(): void {
    if (!this.usedW) return;
    // A critter caught while the counter is open (or sold elsewhere) remakes the jars.
    const was = this.built;
    this.build();
    if (this.built !== was) this.layout(HEAD_H + 6 + ROW_H + 4);
    const w = this.usedW;
    this.dustText.setText(`${collection.dust}`);
    this.dustText.setX(Math.round(w - 6 - this.dustText.width));

    // Each jar's spares over its shelf.
    let spares = 0;
    let worth = 0;
    for (const c of this.cells) {
      const n = collection.critterSpares(c.def.id);
      spares += n;
      worth += n * CRITTER_PRICE[c.def.rarity];
      const caught = collection.critterCount(c.def.id) > 0;
      c.count.setText(n ? `+${n}` : caught ? 'kept' : '').setTint(n ? GOLD : SOFT);
      c.count.setX(Math.round(-c.count.width / 2));
    }
    this.total.setText(spares ? `${spares} spare${spares === 1 ? '' : 's'}, worth ${worth} dust`.toUpperCase() : 'No spares yet: the first of each stays yours'.toUpperCase());
    this.total.setPosition(0, HEAD_H + 6 + Math.round((ROW_H - 7) / 2));
    this.sellEvery.set(spares ? `Sell all: ${worth}` : 'Sell all', ALL_W, ROW_H - 2, spares > 0).dim(!spares);
    this.sellEvery.setPosition(w - ALL_W, HEAD_H + 6);
    // Room for the line only if it clears the button.
    this.total.setVisible(this.total.width < w - ALL_W - 6);
    this.drawMarks();
    this.drawInfo();
  }

  update(dt: number): void {
    this.time += dt;
    const f = `f${Math.floor(this.time / 330) % HAZEL_FRAMES}`;
    if (this.portrait.frame.name !== f) {
      this.portrait.setFrame(f);
      this.portraitGlow.setFrame(f);
    }
    for (const c of this.cells) if (c.glow.visible) c.glow.setFrame(c.jar.frame.name);
    if (Math.floor(this.time / 160) % 2 !== this.marks.getData('blink')) this.drawMarks();
  }

  // ---- Input, in the view's coordinates ----

  private buttonAt(x: number, y: number): Button | null {
    for (const b of [this.sellEvery, this.sellOne, this.sellAll]) if (b.visible && !b.dimmed && b.hit(x, y)) return b;
    return null;
  }

  pointerDown(x: number, y: number): void {
    const button = this.buttonAt(x, y);
    this.press = { x, y, moved: false, button };
    button?.press(true);
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) p.moved = true;
    if (p.button && !p.button.hit(x, y)) p.button.press(false);
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.button) {
      p.button.press(false);
      if (!p.button.hit(x, y)) return;
      if (p.button === this.sellEvery) this.sellEverything();
      else this.sell(p.button === this.sellOne ? 1 : Infinity);
      return;
    }
    if (p.moved) return;
    const i = this.cells.findIndex((c) => {
      const [rx, ry, rw, rh] = c.rect;
      return x >= rx && y >= ry && x < rx + rw && y < ry + rh;
    });
    if (i < 0 || i === this.picked) return;
    this.picked = i;
    const c = this.cells[i];
    if (collection.critterCount(c.def.id)) {
      this.scene.tweens.add({ targets: [c.jar, c.glow], angle: { from: -10, to: 0 }, duration: 500, ease: 'Elastic.easeOut' });
      sound.cardFlip(c.def.rarity === 'common' ? 0 : 1);
    }
    this.refresh();
  }

  wheel(_dy: number): void {}

  /** Sell `n` of the picked critter's spares (all of them for Infinity). */
  private sell(n: number): void {
    const c = this.cells[this.picked];
    if (!c) return;
    const got = collection.sellCritters(c.def.id, n);
    if (!got) return;
    sound.critterCatch(RARITY_TIER[c.def.rarity]);
    this.pop(got, [c]);
  }

  /** Sell every spare of every kind. */
  private sellEverything(): void {
    const sold: Cell[] = [];
    let got = 0;
    for (const c of this.cells) {
      const g = collection.sellCritters(c.def.id, Infinity);
      if (g) sold.push(c);
      got += g;
    }
    if (!got) return;
    sound.critterCatch(Math.max(...sold.map((c) => RARITY_TIER[c.def.rarity])));
    this.pop(got, sold);
  }

  /** Dust glitters off the jars that were sold from, and "+N DUST" rises off the last. */
  private pop(got: number, from: Cell[]): void {
    const jarMid = (c: Cell) => [c.box.x, c.box.y - (JAR_H * this.jarScale) / 2] as const;
    for (const c of from) this.sparks.explode(from.length > 1 ? 6 : 12, ...jarMid(c));
    const last = from[from.length - 1];
    const f = this.flash;
    this.scene.tweens.killTweensOf(f);
    f.setText(`+${got} dust`.toUpperCase()).setAlpha(1);
    const [mx, my] = jarMid(last);
    const x = Phaser.Math.Clamp(Math.round(mx - f.width / 2), 0, this.usedW - f.width);
    const y = Math.round(my - 6);
    f.setPosition(x, y);
    this.bringToTop(f);
    this.scene.tweens.add({ targets: f, y: y - 16, alpha: 0, duration: 1000, ease: 'Sine.Out' });
  }

  // ---- Drawing ----

  /** A frame round the picked jar, in its rarity's colour, softly blinking. */
  private drawMarks(): void {
    const g = this.marks.clear();
    const blink = Math.floor(this.time / 160) % 2;
    g.setData('blink', blink);
    const c = this.cells[this.picked];
    if (!c) return;
    const [x, y, w, h] = c.rect;
    g.lineStyle(1, RARITY_TINT[c.def.rarity], blink ? 0.9 : 0.55).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  /** The picked critter's name, what she pays for it, and its buttons, along the bottom. */
  private drawInfo(): void {
    const c = this.cells[this.picked];
    const y0 = this.usedH - INFO_H + 6;
    const vis = !!c;
    for (const o of [this.critterName, this.what, this.sellOne, this.sellAll]) o.setVisible(vis);
    if (!c) return;
    const d = c.def;
    const n = collection.critterCount(d.id);
    const spares = collection.critterSpares(d.id);
    const price = CRITTER_PRICE[d.rarity];
    const textW = this.usedW - BTN_W * 2 - 12;
    const fit = (t: string) => (t.length * CH > textW ? `${t.slice(0, Math.max(3, Math.floor(textW / CH) - 1))}.` : t);
    const tint = RARITY_TINT[d.rarity];
    if (n) {
      this.critterName.setText(fit(`${d.name}  ${RARITY_NAME[d.rarity]}`.toUpperCase())).setTint(tint);
      this.what.setText(fit((spares ? `${spares} spare${spares === 1 ? '' : 's'}, ${price} dust each` : `Only yours: ${price} dust a spare`).toUpperCase())).setTint(spares ? CREAM : DIM);
    } else {
      this.critterName.setText(fit('???').toUpperCase()).setTint(SOFT);
      this.what.setText(fit(d.hint.toUpperCase())).setTint(DIM);
    }
    this.critterName.setPosition(0, y0);
    this.what.setPosition(0, y0 + LINE + 2);
    this.sellOne.set('Sell 1', BTN_W, BTN_H, spares > 0).dim(!spares).setPosition(this.usedW - BTN_W * 2 - 4, y0 + 2);
    this.sellAll.set(spares > 1 ? `Sell ${spares}` : 'Sell all', BTN_W, BTN_H, spares > 1).dim(spares < 2).setPosition(this.usedW - BTN_W, y0 + 2);
  }
}
