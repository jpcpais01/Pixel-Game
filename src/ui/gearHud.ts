// The gear on the HUD: a chest button beside the pause button with the count
// found, the bag it opens (every piece in a 5x4 grid, the missing ones as
// shadows, the tapped or hovered piece's stats and the totals) and a banner
// that slides in when a piece is picked up. Drawn in device pixels by the UI
// scene; Graphics are only rebuilt when what they show changes.

import Phaser from 'phaser';
import { DPR as D } from '../game/display';
import { GEAR, RARITY, gear, statLines, type GearDef } from '../game/gear';

const COLS = 5;
const ROWS = 4;
/** Banner: slide in, hold, fade out (ms). */
const BANNER_IN = 180;
const BANNER_TIME = 2800;
const BANNER_OUT = 400;

const text = (scene: Phaser.Scene) => scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1);

/** Packs stat strings into lines no wider than `max` characters. */
function wrap(parts: string[], max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (cur && cur.length + 2 + p.length > max) {
      lines.push(cur);
      cur = p;
    } else cur = cur ? `${cur}  ${p}` : p;
  }
  if (cur) lines.push(cur);
  return lines;
}

export class GearHud {
  open = false;
  private selected = -1;
  private button: Phaser.GameObjects.Graphics;
  private chest: Phaser.GameObjects.Image;
  private count: Phaser.GameObjects.BitmapText;
  private panel: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.BitmapText;
  private icons: Phaser.GameObjects.Image[];
  private lines: Phaser.GameObjects.BitmapText[] = [];
  private drawn = '';
  private banner: Phaser.GameObjects.Container;
  private bannerBg: Phaser.GameObjects.Graphics;
  private bannerIcon: Phaser.GameObjects.Image;
  private bannerName: Phaser.GameObjects.BitmapText;
  private bannerStats: Phaser.GameObjects.BitmapText;
  private showing: GearDef | null = null;
  private bannerT = 0;

  constructor(private scene: Phaser.Scene) {
    this.button = scene.add.graphics();
    this.chest = scene.add.image(0, 0, 'icon_chest');
    this.count = text(scene).setOrigin(1, 1).setTint(0xfff4d8);
    this.panel = scene.add.graphics().setVisible(false);
    this.title = text(scene).setVisible(false);
    this.icons = GEAR.map((g) => scene.add.image(0, 0, g.icon).setVisible(false));
    this.bannerBg = scene.add.graphics();
    this.bannerIcon = scene.add.image(0, 0, GEAR[0].icon);
    this.bannerName = text(scene).setOrigin(0, 0);
    this.bannerStats = text(scene).setOrigin(0, 0).setTint(0xdfe6ff);
    this.banner = scene.add.container(0, 0, [this.bannerBg, this.bannerIcon, this.bannerName, this.bannerStats]).setVisible(false);
    scene.input.keyboard?.on('keydown-I', () => this.toggle());
    scene.input.keyboard?.on('keydown-G', () => this.toggle());
  }

  toggle(): void {
    this.open = !this.open;
    if (!this.open) this.selected = -1;
  }

  /** The chest button: the pause button's size, just left of it. */
  private get buttonRect(): Phaser.Geom.Rectangle {
    const { width, height } = this.scene.scale;
    const s = Math.round(Math.max(34 * D, Math.min(width, height) * 0.075));
    const pad = 12 * D;
    return new Phaser.Geom.Rectangle(width - s * 3 - pad - 20 * D, pad, s, s);
  }

  /** The bag's layout: cell size, text scale, and where the grid and text sit. */
  private get layout() {
    const { width, height } = this.scene.scale;
    const c = Math.round(Phaser.Math.Clamp(Math.min(width, height) * 0.1, 34 * D, 64 * D));
    const g = Math.round(4 * D);
    const pad = Math.round(10 * D);
    const ts = Math.max(1, Math.floor(c / 36));
    const lineH = 10 * ts;
    const w = COLS * c + (COLS - 1) * g + pad * 2;
    const gridH = ROWS * c + (ROWS - 1) * g;
    const h = pad + lineH + pad / 2 + gridH + pad + lineH * 6 + pad;
    const x = Math.round((width - w) / 2);
    const y = Math.round(Math.max(pad, (height - h) / 2));
    return { c, g, pad, ts, lineH, w, h, x, y, gridX: x + pad, gridY: y + pad + lineH + Math.round(pad / 2), chars: Math.floor((w - pad * 2) / (6 * ts)) };
  }

  private cellAt(px: number, py: number): number {
    const { c, g, gridX, gridY } = this.layout;
    const i = Math.floor((px - gridX + g / 2) / (c + g));
    const j = Math.floor((py - gridY + g / 2) / (c + g));
    return i >= 0 && i < COLS && j >= 0 && j < ROWS ? j * COLS + i : -1;
  }

  /** Handles a press; returns true if the gear took it. */
  pointerDown(p: Phaser.Input.Pointer): boolean {
    const b = Phaser.Geom.Rectangle.Clone(this.buttonRect);
    b.setTo(b.x - 6 * D, b.y - 6 * D, b.width + 12 * D, b.height + 12 * D);
    if (b.contains(p.x, p.y)) {
      this.toggle();
      return true;
    }
    if (!this.open) return false;
    const i = this.cellAt(p.x, p.y);
    const { x, y, w, h } = this.layout;
    if (i >= 0) this.selected = i;
    else if (!Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(x, y, w, h), p.x, p.y)) this.toggle();
    return true;
  }

  /** A mouse over a cell picks it, like a tap. */
  pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.open || p.wasTouch) return;
    const i = this.cellAt(p.x, p.y);
    if (i >= 0) this.selected = i;
  }

  update(dt: number): void {
    this.drawButton();
    this.drawBag();
    this.drawBanner(dt);
  }

  private drawButton(): void {
    const r = this.buttonRect;
    const state = `${r.x} ${r.y} ${r.width} ${this.open} ${gear.owned.length}`;
    if (this.button.getData('s') === state) return;
    this.button.setData('s', state);
    const g = this.button.clear();
    g.fillStyle(0x0a0c1c, this.open ? 0.62 : 0.42);
    g.fillRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
    g.lineStyle(2 * D, this.open ? 0xffd66b : 0xb8c4ff, 0.45);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
    this.chest.setPosition(Math.round(r.centerX), Math.round(r.centerY)).setScale(Math.max(1, Math.floor((r.width - 6 * D) / 16)));
    this.count
      .setText(gear.owned.length ? `${gear.owned.length}` : '')
      .setScale(Math.max(1, Math.floor(r.width / 34)))
      .setPosition(Math.round(r.right + 2 * D), Math.round(r.bottom + 3 * D));
  }

  private drawBag(): void {
    const open = this.open;
    this.panel.setVisible(open);
    this.title.setVisible(open);
    for (const l of this.lines) l.setVisible(open);
    if (!open) {
      for (const icon of this.icons) icon.setVisible(false);
      this.drawn = '';
      return;
    }
    const L = this.layout;
    const state = `${L.x} ${L.y} ${L.c} ${gear.owned.length} ${this.selected}`;
    if (state === this.drawn) return;
    this.drawn = state;

    const g = this.panel.clear();
    const r = Math.round(6 * D);
    g.fillGradientStyle(0x2a2150, 0x2a2150, 0x140f2a, 0x140f2a, 0.94);
    g.fillRoundedRect(L.x, L.y, L.w, L.h, r);
    g.lineStyle(Math.round(2 * D), 0x6b5aa6, 0.9);
    g.strokeRoundedRect(L.x, L.y, L.w, L.h, r);
    this.title
      .setText(`GEAR  ${gear.owned.length}/${GEAR.length}`)
      .setScale(L.ts)
      .setTint(0xffe08a)
      .setPosition(L.gridX, L.y + L.pad);

    const scale = Math.max(1, Math.floor((L.c - 4 * D) / 32));
    GEAR.forEach((def, i) => {
      const cx = L.gridX + (i % COLS) * (L.c + L.g);
      const cy = L.gridY + Math.floor(i / COLS) * (L.c + L.g);
      const owned = gear.has(def.id);
      const tint = RARITY[def.rarity].tint;
      g.fillStyle(0x0a0c1c, owned ? 0.7 : 0.45);
      g.fillRoundedRect(cx, cy, L.c, L.c, Math.round(4 * D));
      g.lineStyle(Math.round((i === this.selected ? 2 : 1.5) * D), i === this.selected ? 0xffffff : tint, i === this.selected ? 0.95 : owned ? 0.6 : 0.14);
      g.strokeRoundedRect(cx, cy, L.c, L.c, Math.round(4 * D));
      const icon = this.icons[i].setVisible(true).setPosition(Math.round(cx + L.c / 2), Math.round(cy + L.c / 2)).setScale(scale);
      // Pieces not found yet show as dark shapes, a hint of what is out there.
      if (owned) icon.clearTint().setAlpha(1);
      else icon.setTint(0x000000).setAlpha(0.4);
    });

    // Below the grid: the chosen piece (name in its rarity's colour, and stats), then the totals.
    const rows: [string, number][] = [];
    const def = GEAR[this.selected];
    if (def) {
      const owned = gear.has(def.id);
      rows.push([owned ? def.name.toUpperCase() : '???', owned ? RARITY[def.rarity].tint : 0x8a90a8]);
      rows.push([owned ? statLines(def.stats).join('  ') : `${RARITY[def.rarity].name.toUpperCase()} - NOT FOUND YET`, 0xdfe6ff]);
    } else {
      rows.push([gear.owned.length ? 'TAP A PIECE' : 'SLAY MONSTERS TO FIND GEAR', 0x8a90a8]);
      rows.push(['', 0]);
    }
    const totals = statLines(gear.totals);
    rows.push([totals.length ? 'TOTAL' : '', 0xffe08a]);
    for (const line of wrap(totals, L.chars).slice(0, 3)) rows.push([line, 0x9dff9a]);
    while (this.lines.length < rows.length) this.lines.push(text(this.scene));
    const ty = L.gridY + ROWS * L.c + (ROWS - 1) * L.g + L.pad;
    this.lines.forEach((l, i) => {
      const row = rows[i];
      l.setVisible(!!row).setText(row?.[0] ?? '').setScale(L.ts).setTint(row?.[1] ?? 0xffffff).setPosition(L.gridX, ty + i * L.lineH);
    });
  }

  /** Takes the next piece picked up and shows it under the buttons for a moment. */
  private drawBanner(dt: number): void {
    if (!this.showing && gear.news.length) {
      this.showing = gear.news.shift()!;
      this.bannerT = 0;
      this.layoutBanner(this.showing);
    }
    if (!this.showing) return;
    this.bannerT += dt;
    const t = this.bannerT;
    const total = BANNER_IN + BANNER_TIME + BANNER_OUT;
    if (t >= total || this.open) {
      this.showing = null;
      this.banner.setVisible(false);
      return;
    }
    const k = t < BANNER_IN ? t / BANNER_IN : t > total - BANNER_OUT ? (total - t) / BANNER_OUT : 1;
    this.banner.setVisible(true).setAlpha(k).setY(Math.round((1 - k) * -8 * D));
  }

  private layoutBanner(def: GearDef): void {
    const { width } = this.scene.scale;
    const btn = this.buttonRect;
    const ts = Math.max(1, Math.floor(btn.height / 24));
    const scale = Math.max(1, Math.floor((btn.height * 1.1) / 32));
    const icon = 32 * scale;
    const pad = Math.round(6 * D);
    const tint = RARITY[def.rarity].tint;
    this.bannerName.setText(def.name.toUpperCase()).setScale(ts).setTint(tint);
    this.bannerStats.setText(statLines(def.stats).join('  ')).setScale(ts);
    const tw = Math.max(this.bannerName.width, this.bannerStats.width);
    const w = pad * 3 + icon + tw;
    const h = pad * 2 + icon;
    const x = Math.round((width - w) / 2);
    const y = Math.round(btn.bottom + 10 * D);
    const g = this.bannerBg.clear();
    g.fillStyle(0x0a0c1c, 0.72);
    g.fillRoundedRect(x, y, w, h, Math.round(6 * D));
    g.lineStyle(Math.round(2 * D), tint, 0.7);
    g.strokeRoundedRect(x, y, w, h, Math.round(6 * D));
    this.bannerIcon.setTexture(def.icon).setScale(scale).setPosition(x + pad + icon / 2, y + h / 2);
    const lineH = 10 * ts;
    const top = Math.round(y + h / 2 - lineH);
    this.bannerName.setPosition(x + pad * 2 + icon, top);
    this.bannerStats.setPosition(x + pad * 2 + icon, top + lineH + Math.round(2 * D));
  }
}
