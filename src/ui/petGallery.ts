// The Inventory's third page: every companion the player owns, as cards in
// a grid (the same cards the Wishing Nest turns over), rarest first, each
// creature playing in its card. The one coming along on runs is framed in
// gold, its perk written at the top of the page; tapping a card brings that
// one instead, and tapping it again leaves every companion at home.

import Phaser from 'phaser';
import { PETS, ownedPets, type PetDef } from '../game/pets';
import { collection } from '../game/collection';
import { sound } from '../audio';
import { petFace } from './petCard';
import { pixelText } from './widgets';

const CARD_W = 60;
/** Cards are this tall when there's room; shorter (and compact) so at least MIN_ROWS rows always show. */
const CARD_H = 92;
const MIN_ROWS = 2;
const GAP = 6;
const HEAD_H = 14;
/** A drag this far (art px) moves the grid by a row. */
const DRAG_ROW = 28;
const TAP_SLOP = 5;
const ORDER = { legendary: 0, epic: 1, rare: 2 };
const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;

interface Card {
  pet: PetDef;
  box: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite | null;
  badge: Phaser.GameObjects.BitmapText;
}

export class PetGallery extends Phaser.GameObjects.Container {
  private boxW = 0;
  private boxH = 0;
  private cols = 1;
  private rowsShown = 1;
  private scrollRow = 0;
  private cards: Card[] = [];
  private title: Phaser.GameObjects.BitmapText;
  private hint: Phaser.GameObjects.BitmapText;
  private empty: Phaser.GameObjects.Container;
  /** The gold frame round the companion coming along, and the scroll bar. */
  private marks: Phaser.GameObjects.Graphics;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private press: { x: number; y: number; row: number; moved: boolean } | null = null;
  private owned = '';
  private cardH = CARD_H;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.title = pixelText(scene, 0, 0, '', GOLD);
    this.hint = pixelText(scene, 0, 0, 'Tap one to bring it along', 0x7c72b0);
    this.marks = scene.add.graphics();
    const egg = scene.add.image(0, 0, 'nest_egg');
    const l1 = pixelText(scene, 0, 0, 'No companions yet', GOLD);
    const l2 = pixelText(scene, 0, 0, 'Wish in the Shop\'s Nest', LAVENDER);
    l1.setPosition(Math.round(-l1.width / 2), 24);
    l2.setPosition(Math.round(-l2.width / 2), 36);
    this.empty = scene.add.container(0, 0, [egg, l1, l2]);
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 70 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 1.2, end: 0 },
      tint: [0xffffff, GOLD, 0xd8ff7a],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.add([this.title, this.hint, this.empty, this.marks, this.sparks]);
    scene.add.existing(this);
    this.refresh();
  }

  /** Rebuild the cards when the companions owned have changed; re-mark the one along either way. */
  refresh(): void {
    const owned = PETS.filter((p) => collection.hasPet(p.id));
    const key = owned.map((p) => p.id).join();
    if (key !== this.owned) {
      this.owned = key;
      for (const c of this.cards) c.box.destroy();
      owned.sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity] || PETS.indexOf(a) - PETS.indexOf(b));
      const h = this.cardH;
      this.cards = owned.map((pet) => {
        const face = petFace(this.scene, pet, CARD_W, h, 2, false, h < CARD_H);
        const badge = pixelText(this.scene, 0, 0, 'Along', GOLD);
        badge.setPosition(Math.round(CARD_W / 2 - badge.width - 1), Math.round(-h / 2 - 5));
        const box = this.scene.add.container(0, 0, [...face.parts, badge]);
        this.addAt(box, 3);
        return { pet, box, sprite: face.sprite, glow: face.glow, badge };
      });
    }
    // The hint says what the one along does (the cards are too narrow to).
    const along = PETS.find((p) => p.id === collection.pet);
    this.hint.setText((along ? `${along.name}: ${along.perk}` : 'Tap one to bring it along').toUpperCase());
    const o = ownedPets();
    this.title.setText(`Companions ${o.owned}/${o.of}`.toUpperCase());
    this.empty.setVisible(!this.cards.length);
    this.layout();
  }

  resize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    const fit = Math.floor((h - HEAD_H - 8 - (MIN_ROWS - 1) * GAP) / MIN_ROWS);
    const cardH = Math.max(60, Math.min(CARD_H, fit));
    if (cardH !== this.cardH) {
      this.cardH = cardH;
      this.owned = '';
      this.refresh();
    } else this.layout();
  }

  private layout(): void {
    if (!this.boxW) return;
    const { boxW: w, boxH: h } = this;
    this.title.setPosition(0, 0);
    this.hint.setPosition(Math.round(w - this.hint.width), 0).setVisible(this.cards.length > 0 && w - this.hint.width > this.title.width + 8);
    this.empty.setPosition(Math.round(w / 2), Math.round(h / 2 - 24));
    this.cols = Math.max(1, Math.floor((w - 6 + GAP) / (CARD_W + GAP)));
    this.rowsShown = Math.max(1, Math.floor((h - HEAD_H - 2 + GAP) / (this.cardH + GAP)));
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, this.maxRow);
    const gridW = this.cols * CARD_W + (this.cols - 1) * GAP;
    const x0 = Math.round((w - 6 - gridW) / 2 + CARD_W / 2);
    const y0 = HEAD_H + 6 + this.cardH / 2;
    this.cards.forEach((c, i) => {
      const row = Math.floor(i / this.cols) - this.scrollRow;
      const on = row >= 0 && row < this.rowsShown;
      c.box.setVisible(on);
      if (on) c.box.setPosition(x0 + (i % this.cols) * (CARD_W + GAP), y0 + row * (this.cardH + GAP));
    });
    this.markAlong();
  }

  private get maxRow(): number {
    return Math.max(0, Math.ceil(this.cards.length / this.cols) - this.rowsShown);
  }

  /** Gold round the companion coming along; and a scroll bar down the right when the grid runs on. */
  private markAlong(): void {
    const g = this.marks.clear();
    for (const c of this.cards) {
      const on = collection.pet === c.pet.id;
      c.badge.setVisible(on);
      c.box.setAlpha(on || !collection.pet ? 1 : 0.8);
      if (!on || !c.box.visible) continue;
      const x = c.box.x - CARD_W / 2 - 2;
      const y = c.box.y - this.cardH / 2 - 2;
      g.lineStyle(1, GOLD, 1).strokeRect(x + 0.5, y + 0.5, CARD_W + 3, this.cardH + 3);
      g.lineStyle(1, 0xfff0a8, 0.5).strokeRect(x - 0.5, y - 0.5, CARD_W + 5, this.cardH + 5);
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
    const card = this.cards.find((c) => c.box.visible && Math.abs(x - c.box.x) <= CARD_W / 2 && Math.abs(y - c.box.y) <= this.cardH / 2);
    if (card) this.choose(card);
  }

  wheel(dy: number): void {
    const row = Phaser.Math.Clamp(this.scrollRow + Math.sign(dy), 0, this.maxRow);
    if (row === this.scrollRow) return;
    this.scrollRow = row;
    this.layout();
  }

  /** Bring this companion along (or, if it already is, leave it home): it bounces for joy in its card. */
  private choose(card: Card): void {
    const along = collection.pet === card.pet.id;
    collection.pet = along ? '' : card.pet.id;
    if (!along) {
      this.sparks.explode(18, card.box.x, card.box.y);
      for (const o of [card.sprite, card.glow]) if (o) this.scene.tweens.add({ targets: o, scaleX: { from: 2.5, to: 2 }, scaleY: { from: 1.6, to: 2 }, duration: 320, ease: 'Back.easeOut' });
    }
    this.scene.tweens.add({ targets: card.box, scale: { from: along ? 0.96 : 1.06, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    sound.cardFlip(along ? 0 : { legendary: 2, epic: 1, rare: 0 }[card.pet.rarity]);
    this.refresh();
  }
}
