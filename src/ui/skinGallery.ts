// The Inventory's second page: every skin the player owns, as cards in a
// grid (the same cards the shop's wishes turn over), rarest first. Each hero
// idles in its card; the one being worn is framed in gold. Tapping a card
// puts that skin on (its type with it), and the hero strikes its pose.

import Phaser from 'phaser';
import { ALL_SKINS, ownedSkins, type SkinEntry } from '../game/gacha';
import { collection } from '../game/collection';
import { CLASSES } from '../game/characters';
import { lookOf, setLook, worn } from '../game/skins';
import { sound } from '../audio';
import { skinFace } from './skinCard';
import { pixelText } from './widgets';

const CARD_W = 60;
const CARD_H = 92;
const GAP = 6;
const HEAD_H = 14;
/** A drag this far (art px) moves the grid by a row. */
const DRAG_ROW = 28;
const TAP_SLOP = 5;
const ORDER = { legendary: 0, epic: 1, rare: 2 };
const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;

interface Card {
  entry: SkinEntry;
  box: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite | null;
  badge: Phaser.GameObjects.BitmapText;
}

export class SkinGallery extends Phaser.GameObjects.Container {
  private boxW = 0;
  private boxH = 0;
  private cols = 1;
  private rowsShown = 1;
  private scrollRow = 0;
  private cards: Card[] = [];
  private title: Phaser.GameObjects.BitmapText;
  private hint: Phaser.GameObjects.BitmapText;
  private empty: Phaser.GameObjects.Container;
  /** The gold frame round the worn skin's card, and the scroll bar. */
  private marks: Phaser.GameObjects.Graphics;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private press: { x: number; y: number; row: number; moved: boolean } | null = null;
  private owned = '';

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.title = pixelText(scene, 0, 0, '', GOLD);
    this.hint = pixelText(scene, 0, 0, 'Tap a skin to wear it', 0x7c72b0);
    this.marks = scene.add.graphics();
    const gem = scene.add.image(0, 0, 'gem_l');
    const l1 = pixelText(scene, 0, 0, 'No skins yet', GOLD);
    const l2 = pixelText(scene, 0, 0, 'Make a wish in the Shop', LAVENDER);
    l1.setPosition(Math.round(-l1.width / 2), 14);
    l2.setPosition(Math.round(-l2.width / 2), 26);
    this.empty = scene.add.container(0, 0, [gem, l1, l2]);
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 70 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 1.2, end: 0 },
      tint: [0xffffff, GOLD, 0xfff0a8],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.add([this.title, this.hint, this.empty, this.marks, this.sparks]);
    scene.add.existing(this);
    this.refresh();
  }

  /** Rebuild the cards when the skins owned have changed; re-mark the worn one either way. */
  refresh(): void {
    const owned = ALL_SKINS.filter((e) => collection.hasSkin(e.id));
    const key = owned.map((e) => e.id).join();
    if (key !== this.owned) {
      this.owned = key;
      for (const c of this.cards) c.box.destroy();
      const classOrder = (e: SkinEntry) => CLASSES.indexOf(e.cls);
      owned.sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity] || classOrder(a) - classOrder(b));
      this.cards = owned.map((entry) => {
        const face = skinFace(this.scene, entry, CARD_W, CARD_H, 2, { text: entry.cls.name, tint: 0x8a80b8 });
        const badge = pixelText(this.scene, 0, 0, 'Worn', GOLD);
        badge.setPosition(Math.round(CARD_W / 2 - badge.width - 1), Math.round(-CARD_H / 2 - 5));
        const box = this.scene.add.container(0, 0, [...face.parts, badge]);
        this.addAt(box, 3);
        return { entry, box, sprite: face.sprite, glow: face.glow, badge };
      });
    }
    const o = ownedSkins();
    this.title.setText(`Skins ${o.owned}/${o.of}`.toUpperCase());
    this.empty.setVisible(!this.cards.length);
    this.layout();
  }

  resize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    this.layout();
  }

  private layout(): void {
    if (!this.boxW) return;
    const { boxW: w, boxH: h } = this;
    this.title.setPosition(0, 0);
    this.hint.setPosition(Math.round(w - this.hint.width), 0).setVisible(this.cards.length > 0 && w - this.hint.width > this.title.width + 8);
    this.empty.setPosition(Math.round(w / 2), Math.round(h / 2 - 20));
    this.cols = Math.max(1, Math.floor((w - 6 + GAP) / (CARD_W + GAP)));
    this.rowsShown = Math.max(1, Math.floor((h - HEAD_H - 2 + GAP) / (CARD_H + GAP)));
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, this.maxRow);
    const gridW = this.cols * CARD_W + (this.cols - 1) * GAP;
    const x0 = Math.round((w - 6 - gridW) / 2 + CARD_W / 2);
    const y0 = HEAD_H + 6 + CARD_H / 2;
    this.cards.forEach((c, i) => {
      const row = Math.floor(i / this.cols) - this.scrollRow;
      const on = row >= 0 && row < this.rowsShown;
      c.box.setVisible(on);
      if (on) c.box.setPosition(x0 + (i % this.cols) * (CARD_W + GAP), y0 + row * (CARD_H + GAP));
    });
    this.markWorn();
  }

  private get maxRow(): number {
    return Math.max(0, Math.ceil(this.cards.length / this.cols) - this.rowsShown);
  }

  /** Gold round the worn skin's card; and a scroll bar down the right when the grid runs on. */
  private markWorn(): void {
    const g = this.marks.clear();
    for (const c of this.cards) {
      const on = lookOf(c.entry.cls).skin === c.entry.skin;
      c.badge.setVisible(on);
      if (!on || !c.box.visible) continue;
      const x = c.box.x - CARD_W / 2 - 2;
      const y = c.box.y - CARD_H / 2 - 2;
      g.lineStyle(1, GOLD, 1).strokeRect(x + 0.5, y + 0.5, CARD_W + 3, CARD_H + 3);
      g.lineStyle(1, 0xfff0a8, 0.5).strokeRect(x - 0.5, y - 0.5, CARD_W + 5, CARD_H + 5);
    }
    const max = this.maxRow;
    if (max > 0) {
      const top = HEAD_H + 4;
      const trackH = this.boxH - top - 2;
      const thumbH = Math.max(10, Math.round((trackH * this.rowsShown) / (this.rowsShown + max)));
      const ty = top + Math.round(((trackH - thumbH) * this.scrollRow) / max);
      g.fillStyle(0x221a44).fillRect(this.boxW - 3, top, 2, trackH);
      g.fillStyle(LAVENDER).fillRect(this.boxW - 3, ty, 2, thumbH);
    }
  }

  update(time: number): void {
    for (const c of this.cards) if (c.box.visible && c.glow) c.glow.setFrame(c.sprite.frame.name);
    // The worn card's frame glimmers.
    this.marks.setAlpha(0.75 + 0.25 * Math.sin(time * 0.005));
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.boxW && y < this.boxH;
  }

  pointerDown(x: number, y: number): void {
    this.press = { x, y, row: this.scrollRow, moved: false };
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) p.moved = true;
    const row = Phaser.Math.Clamp(p.row + Math.round((p.y - y) / DRAG_ROW), 0, this.maxRow);
    if (row !== this.scrollRow) {
      this.scrollRow = row;
      this.layout();
    }
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p || p.moved) return;
    const card = this.cards.find((c) => c.box.visible && Math.abs(x - c.box.x) <= CARD_W / 2 && Math.abs(y - c.box.y) <= CARD_H / 2);
    if (card) this.wear(card);
  }

  wheel(dy: number): void {
    const row = Phaser.Math.Clamp(this.scrollRow + Math.sign(dy), 0, this.maxRow);
    if (row === this.scrollRow) return;
    this.scrollRow = row;
    this.layout();
  }

  /** Put this skin on: its hero strikes a pose, and light bursts from the card. */
  private wear(card: Card): void {
    const { cls, type, skin } = card.entry;
    if (lookOf(cls).skin !== skin) setLook(cls, type, skin);
    const p = worn(cls, { type, skin }).preview;
    card.sprite.play(p.chosen).chain(p.idle);
    this.sparks.explode(18, card.box.x, card.box.y);
    this.scene.tweens.add({ targets: card.box, scale: { from: 1.06, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    sound.cardFlip({ legendary: 2, epic: 1, rare: 0 }[card.entry.rarity]);
    this.markWorn();
  }
}
