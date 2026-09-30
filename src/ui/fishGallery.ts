// The Inventory's Fish page: every fish mounted on a varnished plaque, as an
// angler hangs a catch on the wall. Landed ones show in their colours (the
// glowing ones lit up), with how many were landed; the rest are dark shapes
// with a question mark. Tapping a plaque says what it is (or when to fish
// for it) across the top.

import Phaser from 'phaser';
import { warmFish } from '../art/fish';
import { FISH, type FishDef } from '../game/fish';
import { collection } from '../game/collection';
import { sound } from '../audio';
import { fitLine } from '../scenes/SelectScene';
import { pixelText } from './widgets';

const CELL_W = 56;
const CELL_H = 50;
const MIN_CELL_H = 44;
const MIN_ROWS = 2;
const GAP = 4;
const HEAD_H = 14;
const DRAG_ROW = 28;
const TAP_SLOP = 5;
const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;
const DIM = 0x7c72b0;
const NAME_TINT = { common: LAVENDER, rare: GOLD, legendary: 0xffffff } as const;

interface Cell {
  def: FishDef;
  box: Phaser.GameObjects.Container;
  fish: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite | null;
}

export class FishGallery extends Phaser.GameObjects.Container {
  private boxW = 0;
  private boxH = 0;
  private cols = 1;
  private rowsShown = 1;
  private scrollRow = 0;
  private cellH = CELL_H;
  private cells: Cell[] = [];
  private title: Phaser.GameObjects.BitmapText;
  private hint: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Graphics;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private press: { x: number; y: number; row: number; moved: boolean } | null = null;
  /** What was landed when the cells were last built. */
  private landed = '';
  private picked: FishDef | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    warmFish(scene);
    this.title = pixelText(scene, 0, 0, '', GOLD);
    this.hint = pixelText(scene, 0, 0, '', DIM);
    this.bar = scene.add.graphics();
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 15, max: 50 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 1, end: 0 },
      tint: [0xffffff, 0xb8e8ff, GOLD],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.add([this.bar, this.title, this.hint, this.sparks]);
    scene.add.existing(this);
    this.refresh();
  }

  /** Rebuild the plaques when what's been landed has changed. */
  refresh(): void {
    const key = FISH.map((d) => collection.fishCount(d.id)).join();
    if (key !== this.landed) {
      this.landed = key;
      for (const c of this.cells) c.box.destroy();
      this.cells = FISH.map((def) => this.cell(def));
    }
    const got = FISH.filter((d) => collection.fishCount(d.id) > 0).length;
    this.title.setText(`Fish ${got}/${FISH.length}`.toUpperCase());
    this.setHint();
    this.layout();
  }

  private cell(def: FishDef): Cell {
    const scene = this.scene;
    const n = collection.fishCount(def.id);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const py = Math.round(-this.cellH / 2 + 16);
    parts.push(scene.add.image(0, py, 'fish_plaque'));
    if (n && def.glow) parts.push(scene.add.image(0, py - 1, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0.35).setScale(1.1));
    // The fish lies across the plaque, head to the right; one not landed yet is only its dark shape.
    const fish = scene.add.sprite(0, py - 2, 'fish', `${def.id}_0`);
    let glow: Phaser.GameObjects.Sprite | null = null;
    if (n) {
      if (def.glow) glow = scene.add.sprite(0, py - 2, 'fish_e', `${def.id}_0`).setBlendMode(Phaser.BlendModes.ADD);
    } else fish.setTintFill(0x1a1430).setAlpha(0.85);
    parts.push(fish);
    if (glow) parts.push(glow);
    if (!n) {
      const q = pixelText(scene, 0, 0, '?', DIM);
      q.setPosition(Math.round(-q.width / 2), py - 5);
      parts.push(q);
    }
    const probe = pixelText(scene, 0, 0, '').setVisible(false);
    const name = pixelText(scene, 0, 0, fitLine(probe, n ? def.name : '???', CELL_W - 2), n ? NAME_TINT[def.rarity] : DIM);
    probe.destroy();
    name.setPosition(Math.round(-name.width / 2), py + 17);
    parts.push(name);
    if (n > 1) {
      const count = pixelText(scene, 0, 0, `x${n}`, 0xfff4d8);
      count.setPosition(Math.round(24 - count.width), py + 5);
      parts.push(count);
    }
    const box = scene.add.container(0, 0, parts);
    this.add(box);
    return { def, box, fish, glow };
  }

  private setHint(): void {
    const d = this.picked;
    let text = 'Fish with a rod by the water in your Home';
    if (d) {
      const n = collection.fishCount(d.id);
      text = n ? `${d.name} x${n}: ${d.line}` : `???: ${d.hint}`;
    }
    const probe = pixelText(this.scene, 0, 0, '').setVisible(false);
    this.hint.setText(fitLine(probe, text.toUpperCase(), Math.max(40, this.boxW - this.title.width - 10)));
    probe.destroy();
  }

  resize(w: number, h: number): void {
    this.boxW = w;
    this.boxH = h;
    const fit = Math.floor((h - HEAD_H - 8 - (MIN_ROWS - 1) * GAP) / MIN_ROWS);
    const cellH = Phaser.Math.Clamp(fit, MIN_CELL_H, CELL_H);
    if (cellH !== this.cellH) {
      this.cellH = cellH;
      this.landed = '';
    }
    this.refresh();
  }

  private layout(): void {
    if (!this.boxW) return;
    const { boxW: w, boxH: h } = this;
    this.title.setPosition(0, 0);
    this.hint.setPosition(Math.round(w - this.hint.width), 0);
    this.cols = Math.max(1, Math.floor((w - 6 + GAP) / (CELL_W + GAP)));
    this.rowsShown = Math.max(1, Math.floor((h - HEAD_H - 2 + GAP) / (this.cellH + GAP)));
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, this.maxRow);
    const gridW = this.cols * CELL_W + (this.cols - 1) * GAP;
    const x0 = Math.round((w - 6 - gridW) / 2 + CELL_W / 2);
    const y0 = HEAD_H + 6 + this.cellH / 2;
    this.cells.forEach((c, i) => {
      const row = Math.floor(i / this.cols) - this.scrollRow;
      const on = row >= 0 && row < this.rowsShown;
      c.box.setVisible(on);
      if (on) c.box.setPosition(x0 + (i % this.cols) * (CELL_W + GAP), Math.round(y0 + row * (this.cellH + GAP)));
    });
    const g = this.bar.clear();
    const max = this.maxRow;
    if (max > 0) {
      const top = HEAD_H + 4;
      const trackH = h - top - 2;
      const thumbH = Math.max(10, Math.round((trackH * this.rowsShown) / (this.rowsShown + max)));
      const ty = top + Math.round(((trackH - thumbH) * this.scrollRow) / max);
      g.fillStyle(0x221a44).fillRect(w - 3, top, 2, trackH);
      g.fillStyle(LAVENDER).fillRect(w - 3, ty, 2, thumbH);
    }
  }

  private get maxRow(): number {
    return Math.max(0, Math.ceil(this.cells.length / this.cols) - this.rowsShown);
  }

  update(time: number): void {
    // The glowing ones breathe on their plaques.
    for (const c of this.cells) if (c.box.visible && c.glow) c.glow.setAlpha(0.75 + Math.sin(time * 0.003 + c.box.x) * 0.25);
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
    const cell = this.cells.find((c) => c.box.visible && Math.abs(x - c.box.x) <= CELL_W / 2 && Math.abs(y - c.box.y) <= this.cellH / 2);
    if (!cell) return;
    // Tapped: it says what it is, and a landed one flaps on its plaque.
    this.picked = cell.def;
    this.setHint();
    this.hint.setPosition(Math.round(this.boxW - this.hint.width), 0);
    if (collection.fishCount(cell.def.id)) {
      this.sparks.explode(10, cell.box.x, cell.box.y - 10);
      const flap = [cell.fish, cell.glow].filter((s): s is Phaser.GameObjects.Sprite => !!s);
      for (const s of flap) s.play(`fish_${cell.def.id}`);
      this.scene.time.delayedCall(700, () => flap.forEach((s) => s.active && s.stop().setFrame(`${cell.def.id}_0`)));
      this.scene.tweens.add({ targets: flap, angle: { from: -12, to: 0 }, duration: 600, ease: 'Elastic.easeOut' });
      sound.cardFlip(cell.def.rarity === 'legendary' ? 2 : cell.def.rarity === 'rare' ? 1 : 0);
    }
  }

  wheel(dy: number): void {
    const row = Phaser.Math.Clamp(this.scrollRow + Math.sign(dy), 0, this.maxRow);
    if (row === this.scrollRow) return;
    this.scrollRow = row;
    this.layout();
  }
}
