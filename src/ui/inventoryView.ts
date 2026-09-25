// The inventory, as one piece of UI shared by the Inventory page and the bag
// that opens in a run (I, or the chest button). Three columns:
//
//  - Equipped: the six slots laid out like a body (headwear over chest over
//    boots, weapon and defence at the hands, the accessory by the neck), and
//    under them the set's total stats, the numbers that actually count.
//  - Items: a grid of everything owned, filtered by slot type with the tabs on
//    top, then the pieces not found yet as shadows. Each icon sits on its
//    rarity's tile.
//  - Details: the chosen item's name, rarity, type and stats, compared with
//    what is worn in that slot now, and an Equip / Unequip button.
//
// Tap an item to see it; tap it again (or the button) to wear it. Tapping a
// worn slot shows its piece and filters the grid to that type, so the
// alternatives are right there.
//
// It is drawn in art pixels; the host scales it (the page's camera zoom, or
// the container's scale in the run's HUD). The host passes pointer events in
// the view's own coordinates, so both hosts handle input the same way.

import Phaser from 'phaser';
import { collection, EQUIP_SLOTS, slotIndex } from '../game/collection';
import {
  GEAR,
  GEAR_SETS,
  RARITIES,
  RARITY,
  SLOTS,
  SLOT_NAME,
  STAT_CAP,
  STAT_KEYS,
  STAT_LABEL,
  gearById,
  setCount,
  statLines,
  statValue,
  wornStats,
  type GearDef,
  type GearStats,
  type Slot,
} from '../game/gear';
import { itemInfo } from '../game/itemInfo';
import { TILE, TILE_FRAMES, TILE_LOOP, glyphKey, tileKey } from '../art/invTiles';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, panelTexture, pixelText } from './widgets';

type Filter = 'all' | Slot | 'potion';

const GAP = 3;
const PITCH = TILE + GAP;
const DOLL_GAP = 4;
const DOLL_W = 3 * TILE + 2 * DOLL_GAP;
/** The left column: the body layout, and the set's totals in two columns under it. */
const LEFT_W = 136;
const COL_GAP = 10;
const LABEL_H = 11;
const TAB = 13;
const LINE = 10;
/** Width of one character in the pixel font. */
const CH = 6;
const TAP_SLOP = 5;

const DIM = 0x9a90c8;
const SOFT = 0x7c82b8;
const CREAM = 0xfff4d6;
const GOLD = 0xf4cf6a;
const GOOD = 0x8dff8a;
const BAD = 0xff7a6a;

/** Where each slot sits in the 3x3 body layout: column, row. */
const DOLL: Record<Slot, [number, number]> = {
  headwear: [1, 0],
  accessory: [2, 0],
  weapon: [0, 1],
  chest: [1, 1],
  defence: [2, 1],
  boots: [1, 2],
};

const rarityRank = (d: GearDef) => RARITIES.indexOf(d.rarity);

/** Pack words into lines of at most `max` characters. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && cur.length + 1 + w.length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** One square: a rarity tile, an icon, and what goes on top (ring, worn tick, count, a slot glyph when empty). */
class Tile extends Phaser.GameObjects.Container {
  id: string | null = null;
  private bg: Phaser.GameObjects.Image;
  private glyph: Phaser.GameObjects.Image;
  private icon: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private tick: Phaser.GameObjects.Image;
  private num: Phaser.GameObjects.BitmapText;
  private anim: { frames: number; loop: number } | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, 'rtile_empty').setOrigin(0);
    this.glyph = scene.add.image(TILE / 2, TILE / 2, glyphKey('all')).setScale(2).setTint(0x4a3f7a).setVisible(false);
    this.icon = scene.add.image(TILE / 2, TILE / 2, '__DEFAULT').setVisible(false);
    this.ring = scene.add.image(-2, -2, 'inv_ring').setOrigin(0).setVisible(false);
    this.tick = scene.add.image(TILE - 10, 1, 'inv_tick').setOrigin(0).setVisible(false);
    this.num = pixelText(scene, 0, 0, '', CREAM);
    this.add([this.bg, this.glyph, this.icon, this.tick, this.num, this.ring]);
  }

  /**
   * Show item `id` (null: an empty slot showing `slot`'s glyph). `known` false
   * draws it as a dark shape on an empty tile: not found yet.
   */
  show(id: string | null, o: { count?: number; worn?: boolean; picked?: boolean; known?: boolean; slot?: Slot } = {}): this {
    this.id = id;
    const g = id ? gearById(id) : undefined;
    const known = o.known ?? true;
    this.anim = null;
    if (g && known) {
      this.bg.setTexture(tileKey(g.rarity), 0);
      if (TILE_FRAMES[g.rarity] > 1) this.anim = { frames: TILE_FRAMES[g.rarity], loop: TILE_LOOP[g.rarity] };
    } else this.bg.setTexture('rtile_empty');
    const info = id ? itemInfo(id) : null;
    if (info && this.scene.textures.exists(info.icon)) {
      const src = this.scene.textures.get(info.icon).getSourceImage();
      // Small icons (potions) at a whole multiple, so they stay crisp.
      const scale = Math.max(1, Math.floor((TILE - 4) / Math.max(src.width, src.height)));
      this.icon.setTexture(info.icon).setScale(scale).setVisible(true);
      if (known) this.icon.clearTint().setAlpha(1);
      else this.icon.setTint(0x000000).setAlpha(0.45);
    } else this.icon.setVisible(false);
    this.glyph.setVisible(!id && !!o.slot);
    if (o.slot) this.glyph.setTexture(glyphKey(o.slot));
    this.ring.setVisible(!!o.picked);
    this.tick.setVisible(!!o.worn);
    const n = o.count ?? 0;
    this.num.setText(n > 1 ? `X${n}` : '');
    this.num.setPosition(TILE - 3 - this.num.width, TILE - 2 - this.num.height);
    return this;
  }

  /** Step an animated tile to its frame for time `t` (ms). */
  animate(t: number): void {
    if (!this.anim || !this.visible) return;
    const f = Math.floor((t / this.anim.loop) * this.anim.frames) % this.anim.frames;
    if (this.bg.frame.name !== String(f)) this.bg.setFrame(f);
  }
}

/** A flat button drawn from panel textures; the view hit-tests it itself. */
class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.BitmapText;
  private keys: [string, string] = ['', ''];
  private bw = 0;
  private bh = 0;
  down = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.label = pixelText(scene, 0, 0, '');
    this.add([this.bg, this.label]);
  }

  set(text: string, w: number, h: number, gold: boolean): this {
    const st = gold ? BUTTON_GOLD : BUTTON_PLAIN;
    const name = `invbtn_${gold ? 'g' : 'p'}`;
    this.bw = w;
    this.bh = h;
    this.keys = [panelTexture(this.scene, name, w, h, st[0]), panelTexture(this.scene, `${name}_down`, w, h, st[1])];
    this.label.setText(text.toUpperCase());
    return this.press(this.down);
  }

  press(down: boolean): this {
    this.down = down;
    this.bg.setTexture(this.keys[down ? 1 : 0]);
    this.label.setPosition(Math.round((this.bw - this.label.width) / 2), Math.round((this.bh - this.label.height) / 2) + (down ? 1 : 0));
    this.label.setTint(down ? 0xd8c8a0 : CREAM);
    return this;
  }

  hit(x: number, y: number): boolean {
    return this.visible && x >= this.x && y >= this.y && x < this.x + this.bw && y < this.y + this.bh;
  }
}

export interface InventoryViewOptions {
  /** List potions too (the page does; the bag in a run is gear only). */
  potions: boolean;
  /** Most item columns to use. */
  maxCols?: number;
}

export class InventoryView extends Phaser.GameObjects.Container {
  /** Width and height actually used after `resize`. */
  usedW = 0;
  usedH = 0;
  private opts: InventoryViewOptions;
  private equipLabel: Phaser.GameObjects.BitmapText;
  private setLabel: Phaser.GameObjects.BitmapText;
  private setRows: Phaser.GameObjects.BitmapText[][] = [];
  private slots: Tile[];
  private itemsLabel: Phaser.GameObjects.BitmapText;
  private tabs: { f: Filter; bg: Phaser.GameObjects.Image; glyph: Phaser.GameObjects.Image }[] = [];
  private cells: Tile[] = [];
  private emptyNote: Phaser.GameObjects.BitmapText;
  private card: Phaser.GameObjects.Image;
  private cardTile: Tile;
  private cardText: Phaser.GameObjects.BitmapText[] = [];
  private cardRows: Phaser.GameObjects.BitmapText[][] = [];
  private button: Button;
  private filter: Filter = 'all';
  private picked: string | null = null;
  /** Grid placement and scroll, in rows. */
  private grid = { x: 0, y: 0, cols: 1, rows: 1 };
  private det = { x: 0, w: 124, h: 0 };
  private scrollRow = 0;
  private entries: { id: string; known: boolean }[] = [];
  private press: { x: number; y: number; row: number; moved: boolean; button: boolean } | null = null;
  private time = 0;
  private unwatch: () => void;
  private areaW = 0;
  private areaH = 0;

  constructor(scene: Phaser.Scene, opts: InventoryViewOptions) {
    super(scene, 0, 0);
    this.opts = opts;
    this.equipLabel = pixelText(scene, 0, 0, 'Equipped', DIM);
    this.setLabel = pixelText(scene, 0, 0, 'Set bonus', DIM);
    this.itemsLabel = pixelText(scene, 0, 0, '', DIM);
    this.emptyNote = pixelText(scene, 0, 0, '', SOFT);
    this.add([this.equipLabel, this.setLabel, this.itemsLabel, this.emptyNote]);
    for (let i = 0; i < 3; i++) {
      const row = [0, 1, 2, 3].map(() => pixelText(scene, 0, 0, ''));
      this.setRows.push(row);
      this.add(row);
    }
    this.slots = SLOTS.map(() => new Tile(scene));
    this.add(this.slots);
    const filters: Filter[] = ['all', ...SLOTS, ...(opts.potions ? (['potion'] as Filter[]) : [])];
    for (const f of filters) {
      const bg = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
      const glyph = scene.add.image(0, 0, glyphKey(f)).setOrigin(0);
      this.tabs.push({ f, bg, glyph });
      this.add([bg, glyph]);
    }
    this.card = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.cardTile = new Tile(scene);
    this.add([this.card, this.cardTile]);
    this.button = new Button(scene);
    this.add(this.button);
    this.unwatch = collection.watch(() => this.refresh());
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unwatch());
    scene.add.existing(this);
  }

  /** Lay the view out in a w x h area (art pixels). */
  resize(w: number, h: number): void {
    this.areaW = w;
    this.areaH = h;
    let detW = 124;
    const fixed = () => LEFT_W + COL_GAP * 2 + detW;
    let cols = Math.floor((w - fixed() + GAP) / PITCH);
    if (cols < 3) {
      detW = 100;
      cols = Math.floor((w - fixed() + GAP) / PITCH);
    }
    cols = Phaser.Math.Clamp(cols, 1, this.opts.maxCols ?? 8);
    const gridW = cols * PITCH - GAP;
    this.usedW = fixed() + gridW;
    this.usedH = h;
    const x0 = Math.max(0, Math.floor((w - this.usedW) / 2));

    // Equipped, and the set's totals under it; on short screens the slots
    // close up and the totals lose their heading.
    const tall = h >= LABEL_H * 2 + DOLL_W + 6 + 3 * LINE;
    const gap = tall ? DOLL_GAP : 2;
    const dollW = 3 * TILE + 2 * gap;
    this.equipLabel.setPosition(x0, 0);
    SLOTS.forEach((s, i) => {
      const [c, r] = DOLL[s];
      this.slots[i].setPosition(x0 + Math.floor((LEFT_W - dollW) / 2) + c * (TILE + gap), LABEL_H + r * (TILE + gap));
    });
    const setY = LABEL_H + dollW + (tall ? 6 : 3);
    this.setLabel.setPosition(x0, setY).setVisible(tall);
    this.setRows.forEach((row, r) => {
      const y = setY + (tall ? LABEL_H : 0) + r * LINE;
      row[0].setPosition(x0, y);
      row[2].setPosition(x0 + LEFT_W / 2 + 4, y);
      // Values are right-aligned when drawn.
      row[1].setData('right', x0 + LEFT_W / 2 - 4).setY(y);
      row[3].setData('right', x0 + LEFT_W).setY(y);
    });

    // The item grid, under its tabs.
    const gx = x0 + LEFT_W + COL_GAP;
    this.itemsLabel.setPosition(gx, 0);
    this.tabs.forEach((t, i) => t.bg.setPosition(gx + i * (TAB + 2), LABEL_H));
    const gy = LABEL_H + TAB + 5;
    this.grid = { x: gx, y: gy, cols, rows: Math.max(1, Math.floor((h - gy + GAP) / PITCH)) };
    this.emptyNote.setPosition(gx, gy + 4);

    // The details card.
    this.det = { x: gx + gridW + COL_GAP, w: detW, h: Math.max(90, h - LABEL_H) };
    this.card.setTexture(panelTexture(this.scene, 'inv_card', detW, this.det.h, PANEL)).setPosition(this.det.x, LABEL_H);
    this.refresh();
  }

  /** Redraw everything from the collection. */
  refresh(): void {
    if (!this.areaW) return;
    const eq = collection.data.equipped;
    SLOTS.forEach((s, i) => {
      const id = eq[i];
      this.slots[i].show(id, { slot: s, picked: !!id && id === this.picked });
    });
    this.drawTotals();
    this.drawTabs();
    this.entries = this.items();
    const maxRow = Math.max(0, Math.ceil(this.entries.length / this.grid.cols) - this.grid.rows);
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, maxRow);
    this.drawGrid();
    this.drawCard();
  }

  /** Animate the epic and legendary tiles. */
  update(dt: number): void {
    this.time += dt;
    for (const t of this.slots) t.animate(this.time);
    for (const t of this.cells) t.animate(this.time);
    this.cardTile.animate(this.time);
  }

  // ---- Input, in the view's coordinates ----

  pointerDown(x: number, y: number): void {
    this.press = { x, y, row: this.scrollRow, moved: false, button: this.button.hit(x, y) };
    if (this.press.button) this.button.press(true);
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) p.moved = true;
    if (p.button && !this.button.hit(x, y)) this.button.press(false);
    // Dragging in the grid scrolls it a row at a time.
    if (!p.button && this.inGrid(p.x, p.y)) this.scrollTo(p.row - Math.round((y - p.y) / PITCH));
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.button) {
      this.button.press(false);
      if (this.button.hit(x, y)) this.toggleWorn();
      return;
    }
    if (!p.moved) this.tap(x, y);
  }

  wheel(dy: number): void {
    this.scrollTo(this.scrollRow + Math.sign(dy));
  }

  /** Is (x, y) inside the whole view? */
  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.areaW && y < this.areaH;
  }

  private inGrid(x: number, y: number): boolean {
    const g = this.grid;
    return x >= g.x && y >= g.y && x < g.x + g.cols * PITCH && y < g.y + g.rows * PITCH;
  }

  private scrollTo(row: number): void {
    const maxRow = Math.max(0, Math.ceil(this.entries.length / this.grid.cols) - this.grid.rows);
    const r = Phaser.Math.Clamp(row, 0, maxRow);
    if (r === this.scrollRow) return;
    this.scrollRow = r;
    this.drawGrid();
  }

  private tap(x: number, y: number): void {
    // An equipped slot: show its piece, and its type's alternatives in the grid.
    for (let i = 0; i < EQUIP_SLOTS; i++) {
      const t = this.slots[i];
      if (x < t.x || y < t.y || x >= t.x + TILE || y >= t.y + TILE) continue;
      this.filter = SLOTS[i];
      this.scrollRow = 0;
      this.picked = collection.data.equipped[i];
      this.refresh();
      return;
    }
    for (const t of this.tabs) {
      if (x < t.bg.x || y < t.bg.y || x >= t.bg.x + TAB || y >= t.bg.y + TAB) continue;
      if (this.filter !== t.f) {
        this.filter = t.f;
        this.scrollRow = 0;
        this.refresh();
      }
      return;
    }
    if (this.inGrid(x, y)) {
      const g = this.grid;
      const c = Math.floor((x - g.x) / PITCH);
      const r = Math.floor((y - g.y) / PITCH);
      // The gaps between tiles don't count.
      if (x - g.x - c * PITCH >= TILE || y - g.y - r * PITCH >= TILE) return;
      const item = this.entries[(this.scrollRow + r) * g.cols + c];
      if (!item) return;
      // A second tap on the chosen piece wears it (or takes it off).
      if (this.picked === item.id && item.known && slotIndex(item.id) >= 0) this.toggleWorn();
      else {
        this.picked = item.id;
        this.refresh();
      }
    }
  }

  private toggleWorn(): void {
    const id = this.picked;
    if (!id || !collection.count(id)) return;
    const i = slotIndex(id);
    if (i < 0) return;
    if (collection.data.equipped[i] === id) collection.unequip(i);
    else collection.equip(id);
  }

  // ---- Drawing ----

  /** What the grid lists under the current filter: owned gear, gear not found yet, then potions. */
  private items(): { id: string; known: boolean }[] {
    const f = this.filter;
    const sort = (a: GearDef, b: GearDef) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || rarityRank(b) - rarityRank(a) || a.name.localeCompare(b.name);
    const out: { id: string; known: boolean }[] = [];
    if (f !== 'potion') {
      const gear = GEAR.filter((g) => f === 'all' || g.slot === f).sort(sort);
      for (const g of gear) if (collection.count(g.id)) out.push({ id: g.id, known: true });
      for (const g of gear) if (!collection.count(g.id)) out.push({ id: g.id, known: false });
    }
    if (this.opts.potions && (f === 'all' || f === 'potion')) {
      for (const id of collection.owned()) if (slotIndex(id) < 0) out.push({ id, known: true });
    }
    return out;
  }

  private drawTabs(): void {
    this.tabs.forEach((t) => {
      const on = t.f === this.filter;
      t.bg.setTexture(panelTexture(this.scene, on ? 'inv_tab_on' : 'inv_tab', TAB, TAB, on ? BUTTON_GOLD[0] : PANEL_INSET));
      t.glyph.setPosition(t.bg.x + 1, t.bg.y + 1).setTint(on ? 0xfff4d6 : 0x8a80c0);
    });
  }

  private drawGrid(): void {
    const g = this.grid;
    const shown = g.cols * g.rows;
    if (this.cells.length < shown) {
      while (this.cells.length < shown) {
        const t = new Tile(this.scene);
        this.cells.push(t);
        this.add(t);
      }
      // Keep the card on top of the grid's tiles.
      for (const o of [this.card, this.cardTile, this.button, ...this.cardText, ...this.cardRows.flat()]) this.bringToTop(o);
    }
    this.cells.forEach((t, i) => {
      const item = i < shown ? this.entries[this.scrollRow * g.cols + i] : undefined;
      t.setVisible(!!item);
      if (!item) return;
      t.setPosition(g.x + (i % g.cols) * PITCH, g.y + Math.floor(i / g.cols) * PITCH);
      t.show(item.id, {
        known: item.known,
        count: item.known ? collection.count(item.id) : 0,
        worn: item.known && collection.isEquipped(item.id),
        picked: item.id === this.picked,
      });
    });
    this.emptyNote.setVisible(this.entries.length === 0).setText(this.filter === 'potion' ? 'NO POTIONS YET' : 'NOTHING HERE YET');
    // Say so when there are more rows below.
    const more = (this.scrollRow + g.rows) * g.cols < this.entries.length;
    this.itemsLabel.setText(`ITEMS  ${collection.ownedGear().length}/${GEAR.length}${more ? '  +MORE' : ''}`);
  }

  private drawTotals(): void {
    const worn = collection.equippedGear();
    const t = wornStats(worn);
    // Wearing pieces of a set: say how many, in the set's colour (bright once it's whole).
    const set = worn.find((g) => g.set)?.set;
    if (set) {
      const c = setCount(worn, set);
      this.setLabel.setText(`${GEAR_SETS[set].name} ${c.worn}/${c.of}`.toUpperCase()).setTint(c.worn === c.of ? GEAR_SETS[set].tint : DIM);
    } else this.setLabel.setText('SET BONUS').setTint(DIM);
    STAT_KEYS.forEach((k, i) => {
      const row = this.setRows[i % 3];
      const [lab, val] = i < 3 ? [row[0], row[1]] : [row[2], row[3]];
      const v = t[k];
      const cap = STAT_CAP[k];
      const capped = cap !== undefined && v >= cap;
      lab.setText(STAT_LABEL[k]).setTint(v ? CREAM : SOFT);
      val.setText(v ? statValue(k, capped ? cap : v) : '-').setTint(capped ? GOLD : v ? GOOD : SOFT);
      val.setX(Math.round(val.getData('right') - val.width));
    });
  }

  /** A text line in the card, from a pool. */
  private cardLine(i: number): Phaser.GameObjects.BitmapText {
    while (this.cardText.length <= i) {
      const t = pixelText(this.scene, 0, 0, '');
      this.cardText.push(t);
      this.add(t);
    }
    return this.cardText[i];
  }

  private cardRow(i: number): Phaser.GameObjects.BitmapText[] {
    while (this.cardRows.length <= i) {
      const row = [0, 1, 2].map(() => pixelText(this.scene, 0, 0, ''));
      this.cardRows.push(row);
      this.add(row);
    }
    return this.cardRows[i];
  }

  private drawCard(): void {
    const { x, w } = this.det;
    const top = LABEL_H;
    const pad = 5;
    const chars = Math.floor((w - pad * 2) / CH);
    let n = 0;
    const line = (s: string, tint: number, lx: number, ly: number) => this.cardLine(n++).setText(s.toUpperCase()).setTint(tint).setPosition(Math.round(lx), Math.round(ly)).setVisible(true);
    let rowN = 0;
    this.button.setVisible(false);
    this.cardTile.setVisible(false);

    const id = this.picked;
    const known = !!id && collection.count(id) > 0;
    const g = id ? gearById(id) : undefined;
    let y = top + pad;
    if (!id) {
      line('Details', GOLD, x + pad, y);
      y += LINE + 4;
      for (const s of wrap('Tap an item to see its stats. Tap it again to wear it.', chars)) {
        line(s, DIM, x + pad, y);
        y += LINE;
      }
      y += 6;
      for (const s of wrap('Only the six worn pieces count: one of each type.', chars)) {
        line(s, SOFT, x + pad, y);
        y += LINE;
      }
    } else {
      // The item's tile, and beside it its name, rarity and type.
      this.cardTile.setVisible(true).setPosition(x + pad, y).show(id, { known, worn: known && collection.isEquipped(id) });
      const tx = x + pad + TILE + 5;
      const nameChars = Math.floor((x + w - pad - tx) / CH);
      const info = itemInfo(id);
      const name = known || !g ? info.name : '???';
      const nameLines = wrap(name.toUpperCase(), nameChars).slice(0, 2);
      let ty = y + (nameLines.length > 1 ? 0 : 3);
      for (const s of nameLines) {
        line(s, known ? info.tint : SOFT, tx, ty);
        ty += LINE;
      }
      if (g) {
        line(RARITY[g.rarity].name, RARITY[g.rarity].tint, tx, ty);
        line(SLOT_NAME[g.slot], DIM, tx, ty + LINE);
      } else line(known ? `Potion x${collection.count(id)}` : '', DIM, tx, ty);
      y += TILE + 6;

      if (g && known) {
        // Stats, and how each would change the set against what is worn in that slot now.
        const worn = gearById(collection.data.equipped[SLOTS.indexOf(g.slot)] ?? '');
        const isWorn = worn?.id === g.id;
        const base: GearStats = isWorn ? {} : (worn?.stats ?? {});
        const keys = STAT_KEYS.filter((k) => g.stats[k] || base[k]);
        if (!isWorn) {
          line(worn ? `vs ${worn.name}` : `${SLOT_NAME[g.slot]} slot empty`, SOFT, x + pad, y);
          y += LINE + 2;
        }
        for (const k of keys) {
          const [lab, val, diff] = this.cardRow(rowN++);
          const v = g.stats[k] ?? 0;
          lab.setText(STAT_LABEL[k]).setTint(v ? CREAM : SOFT).setPosition(x + pad, y).setVisible(true);
          val.setText(v ? statValue(k, v) : '-').setTint(v ? GOOD : SOFT).setVisible(true);
          val.setPosition(Math.round(x + pad + 5 * CH + 34 - val.width), y);
          const d = v - (base[k] ?? 0);
          const dv = Math.abs(d) < 1e-6 || !worn || isWorn ? '' : statValue(k, d);
          diff.setText(dv).setTint(d > 0 ? GOOD : BAD).setVisible(true);
          diff.setPosition(Math.round(x + w - pad - diff.width), y);
          y += LINE;
        }
        if (g.set) {
          // The set it belongs to, how much of it is worn, and what the whole set gives.
          const set = GEAR_SETS[g.set];
          const c = setCount(collection.equippedGear(), g.set);
          y += 3;
          line(`${set.name} ${c.worn}/${c.of}`, c.worn === c.of ? set.tint : DIM, x + pad, y);
          y += LINE;
          for (const s of wrap(`All ${c.of}: ${statLines(set.bonus).join(' ')}`, chars)) {
            line(s, c.worn === c.of ? GOOD : SOFT, x + pad, y);
            y += LINE;
          }
        }
        const btnH = 18;
        this.button.setVisible(true).set(isWorn ? 'Unequip' : worn ? 'Swap in' : 'Equip', w - pad * 2, btnH, !isWorn);
        this.button.setPosition(x + pad, Math.max(y + 6, Math.min(top + this.det.h - pad - btnH, y + 40)));
      } else if (g) {
        for (const s of wrap(g.set ? `Not found yet. Only the Hollow Queen drops the ${GEAR_SETS[g.set].name} set.` : 'Not found yet. Monsters drop it.', chars)) {
          line(s, SOFT, x + pad, y);
          y += LINE;
        }
      } else if (known) {
        for (const s of wrap(info.detail, chars)) {
          line(s, DIM, x + pad, y);
          y += LINE;
        }
      }
    }
    for (let i = n; i < this.cardText.length; i++) this.cardText[i].setVisible(false);
    for (let i = rowN; i < this.cardRows.length; i++) for (const t of this.cardRows[i]) t.setVisible(false);
  }
}
