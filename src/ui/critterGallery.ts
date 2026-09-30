// The Inventory's Critters page: every critter as a jar on wooden shelves.
// Caught ones glow and flutter in their jars, with how many were caught;
// the rest are empty jars with a question mark. Tapping a jar says what's in
// it (or where to look for it) across the top.

import Phaser from 'phaser';
import { CRITTERS, type CritterDef } from '../game/critters';
import { collection } from '../game/collection';
import { sound } from '../audio';
import { fitLine } from '../scenes/SelectScene';
import { pixelText } from './widgets';

const CELL_W = 50;
const CELL_H = 64;
const MIN_CELL_H = 56;
const MIN_ROWS = 2;
const GAP = 4;
const HEAD_H = 14;
const JAR_SCALE = 2;
const DRAG_ROW = 28;
const TAP_SLOP = 5;
const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;
const DIM = 0x7c72b0;
/** The shelves: a plank with a lit top edge and a dark lip under it. */
const WOOD = 0x6a4424;
const WOOD_LIT = 0xb88a50;
const WOOD_DARK = 0x2a1a0c;

interface Cell {
  def: CritterDef;
  box: Phaser.GameObjects.Container;
  jar: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite;
}

export class CritterGallery extends Phaser.GameObjects.Container {
  private boxW = 0;
  private boxH = 0;
  private cols = 1;
  private rowsShown = 1;
  private scrollRow = 0;
  private cellH = CELL_H;
  private cells: Cell[] = [];
  private title: Phaser.GameObjects.BitmapText;
  private hint: Phaser.GameObjects.BitmapText;
  private shelves: Phaser.GameObjects.Graphics;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private press: { x: number; y: number; row: number; moved: boolean } | null = null;
  /** What was caught when the cells were last built. */
  private caught = '';
  private picked: CritterDef | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.title = pixelText(scene, 0, 0, '', GOLD);
    this.hint = pixelText(scene, 0, 0, '', DIM);
    this.shelves = scene.add.graphics();
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 15, max: 50 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 1, end: 0 },
      tint: [0xffffff, GOLD, 0xd8ff7a],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.add([this.shelves, this.title, this.hint, this.sparks]);
    scene.add.existing(this);
    this.refresh();
  }

  /** Rebuild the jars when what's been caught has changed. */
  refresh(): void {
    const key = CRITTERS.map((d) => collection.critterCount(d.id)).join();
    if (key !== this.caught) {
      this.caught = key;
      for (const c of this.cells) c.box.destroy();
      this.cells = CRITTERS.map((def) => this.cell(def));
    }
    const got = CRITTERS.filter((d) => collection.critterCount(d.id) > 0).length;
    this.title.setText(`Critters ${got}/${CRITTERS.length}`.toUpperCase());
    this.setHint();
    this.layout();
  }

  private cell(def: CritterDef): Cell {
    const scene = this.scene;
    const n = collection.critterCount(def.id);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const floor = Math.round(this.cellH / 2 - 12);
    if (n && def.glow) parts.push(scene.add.image(0, floor - 24, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0.35).setScale(1.3));
    const jar = scene.add.sprite(0, floor, 'jars', n ? `${def.id}_0` : 'empty').setOrigin(0.5, 1).setScale(JAR_SCALE);
    if (n) jar.play({ key: `jar_${def.id}`, startFrame: Math.floor(Math.random() * 4) });
    else jar.setTint(0x8a86a8).setAlpha(0.75);
    const glow = scene.add.sprite(0, floor, 'jars_e', n ? `${def.id}_0` : 'empty').setOrigin(0.5, 1).setScale(JAR_SCALE).setBlendMode(Phaser.BlendModes.ADD).setVisible(n > 0);
    parts.push(jar, glow);
    if (!n) {
      const q = pixelText(scene, 0, 0, '?', DIM);
      q.setPosition(Math.round(-q.width / 2), floor - 24);
      parts.push(q);
    }
    const probe = pixelText(scene, 0, 0, '').setVisible(false);
    const name = pixelText(scene, 0, 0, fitLine(probe, n ? def.name : '???', CELL_W - 2), n ? (def.rarity === 'common' ? LAVENDER : GOLD) : DIM);
    probe.destroy();
    name.setPosition(Math.round(-name.width / 2), floor + 4);
    parts.push(name);
    if (n > 1) {
      const count = pixelText(this.scene, 0, 0, `x${n}`, 0xfff4d8);
      count.setPosition(Math.round(JAR_SCALE * 9 - count.width + 2), floor - 10);
      parts.push(count);
    }
    const box = scene.add.container(0, 0, parts);
    this.add(box);
    return { def, box, jar, glow };
  }

  private setHint(): void {
    const d = this.picked;
    let text = 'Catch critters with the net';
    if (d) {
      const n = collection.critterCount(d.id);
      text = n ? `${d.name} x${n}: ${d.hint}` : `???: ${d.hint}`;
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
      this.caught = '';
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
      if (on) c.box.setPosition(x0 + (i % this.cols) * (CELL_W + GAP), y0 + row * (this.cellH + GAP));
    });
    // A shelf under each row of jars.
    const g = this.shelves.clear();
    const rows = Math.min(this.rowsShown, Math.ceil(this.cells.length / this.cols) - this.scrollRow);
    const left = x0 - CELL_W / 2 - 2;
    for (let r = 0; r < rows; r++) {
      const y = Math.round(y0 + r * (this.cellH + GAP) + this.cellH / 2 - 12);
      g.fillStyle(WOOD, 1).fillRect(left, y, gridW + 4, 3);
      g.fillStyle(WOOD_LIT, 1).fillRect(left, y, gridW + 4, 1);
      g.fillStyle(WOOD_DARK, 1).fillRect(left, y + 3, gridW + 4, 1);
      // Brackets at either end.
      g.fillStyle(WOOD_DARK, 1).fillRect(left + 2, y + 4, 2, 3).fillRect(left + gridW, y + 4, 2, 3);
    }
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

  update(_time: number): void {
    for (const c of this.cells) if (c.box.visible && c.glow.visible) c.glow.setFrame(c.jar.frame.name);
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
    // Tapped: it says what's inside, and a caught one jiggles in its jar.
    this.picked = cell.def;
    this.setHint();
    this.hint.setPosition(Math.round(this.boxW - this.hint.width), 0);
    if (collection.critterCount(cell.def.id)) {
      this.sparks.explode(10, cell.box.x, cell.box.y - 10);
      this.scene.tweens.add({ targets: [cell.jar, cell.glow], angle: { from: -10, to: 0 }, duration: 500, ease: 'Elastic.easeOut' });
      sound.cardFlip(cell.def.rarity === 'common' ? 0 : 1);
    }
  }

  wheel(dy: number): void {
    const row = Phaser.Math.Clamp(this.scrollRow + Math.sign(dy), 0, this.maxRow);
    if (row === this.scrollRow) return;
    this.scrollRow = row;
    this.layout();
  }
}
