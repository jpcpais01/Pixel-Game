// A Rune Temple keeper's counter: Nyx the Unmaker's, where gear is broken
// down into dust, or Tharn the Runesmith's, where dust raises an epic or
// legendary piece a level and the player picks the stat its new point goes
// into. One view serves both.
//
//  - Across the top: the keeper (animated, in a little alcove), their name and
//    what they say, and the player's dust.
//  - Left: the pieces this keeper works on, as tiles (with counts, levels and
//    the worn tick), scrolled by dragging.
//  - Right: the chosen piece. For Nyx, the dust it breaks into and the button
//    that unmakes it (asking twice only for a legendary; held down, it
//    unmakes piece after piece, stopping at the first that needs asking); for Tharn,
//    its level as ten pips, the six stats to put the next point in with what
//    each would become, and the button that pays for it.
//
// Drawn in art pixels like the inventory; the host scales it and passes
// pointer events in the view's own coordinates.

import Phaser from 'phaser';
import { sound } from '../audio';
import { collection } from '../game/collection';
import {
  DUST_VALUE,
  GEAR,
  MAX_LEVEL,
  RARITIES,
  RARITY,
  SLOT_NAME,
  STAT_KEYS,
  STAT_LABEL,
  STAT_STEP,
  canUpgrade,
  gearById,
  statValue,
  type GearDef,
  type StatKey,
} from '../game/gear';
import { KEEPERS, type Keeper } from '../game/keepers';
import { KEEPER_FRAMES, KEEPER_H, KEEPER_W } from '../art/sanctum';
import { TILE } from '../art/invTiles';
import { Button, Tile, wrap } from './inventoryView';
import { PANEL, PANEL_INSET, PANEL_PICKED, panelTexture, pixelText } from './widgets';

const GAP = 3;
const PITCH = TILE + GAP;
const LINE = 10;
const ROW = 10;
const CH = 6;
const LABEL_H = 11;
const HEAD_H = 46;
const CARD_W = 152;
const COL_GAP = 10;
const TAP_SLOP = 5;
const BTN_H = 16;
/** Holding Nyx's button: the first repeat after this long, then faster and faster down to the quickest. */
const HOLD_START = 420;
const HOLD_EVERY = 170;
const HOLD_FASTEST = 55;
const HOLD_SPEEDUP = 0.88;

const DIM = 0x9a90c8;
const SOFT = 0x7c82b8;
const CREAM = 0xfff4d6;
const GOLD = 0xf4cf6a;
const GOOD = 0x8dff8a;
const BAD = 0xff7a6a;
const DUSTY = 0xd8b0ff;

const rank = (d: GearDef) => RARITIES.indexOf(d.rarity);
const CHIP_H = 12;

/** Nyx's list: rarest last or first, and whether pieces only worn (not spare) are left out. Kept while the game runs. */
const unmaking = { highFirst: false, hideWorn: true };

export class KeeperView extends Phaser.GameObjects.Container {
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
  private gridLabel: Phaser.GameObjects.BitmapText;
  private emptyNote: Phaser.GameObjects.BitmapText[] = [];
  private cells: Tile[] = [];
  private card: Phaser.GameObjects.Image;
  private cardTile: Tile;
  private lines: Phaser.GameObjects.BitmapText[] = [];
  /** Tharn's stat rows: a highlight, the stat, what it is now, and what the next point adds. */
  private rows: { bg: Phaser.GameObjects.Image; texts: Phaser.GameObjects.BitmapText[]; key: StatKey; y: number }[] = [];
  private pips: Phaser.GameObjects.Graphics;
  private bigDust: Phaser.GameObjects.BitmapText;
  private bigIcon: Phaser.GameObjects.Image;
  /** "+15 DUST" or "LEVEL 3!" rising off the card after it's done. */
  private flash: Phaser.GameObjects.BitmapText;
  private button: Button;
  /** Nyx's list controls: the rarity order, and leaving out worn pieces. */
  private sortChip: Button;
  private wornChip: Button;
  private picked: string | null = null;
  private stat: StatKey | null = null;
  /** Nyx asks once more before unmaking anything rare or upgraded. */
  private confirm = false;
  /** Nyx's button held down: time to the next unmaking, the pace, how many so far, and the dust they gave. */
  private hold: { t: number; every: number; fired: number; dust: number } | null = null;
  private entries: string[] = [];
  private grid = { x: 0, y: 0, cols: 1, rows: 1 };
  private det = { x: 0, y: 0, w: CARD_W, h: 0 };
  private scrollRow = 0;
  private press: { x: number; y: number; row: number; moved: boolean; button: boolean } | null = null;
  private time = 0;
  private areaW = 0;
  private unwatch: () => void;

  constructor(
    scene: Phaser.Scene,
    private keeper: Keeper,
  ) {
    super(scene, 0, 0);
    const k = KEEPERS[keeper];
    this.alcove = scene.add.image(0, 0, panelTexture(scene, 'keeper_alcove', KEEPER_W + 8, HEAD_H, PANEL_INSET)).setOrigin(0);
    this.portrait = scene.add.image(0, 0, k.texture, 'f0').setOrigin(0);
    this.portraitGlow = scene.add.image(0, 0, `${k.texture}_e`, 'f0').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.title = pixelText(scene, 0, 0, `${k.name} ${k.title}`, k.tint);
    this.dustBox = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.dustIcon = scene.add.image(0, 0, 'dust_icon').setOrigin(0);
    this.dustText = pixelText(scene, 0, 0, '', DUSTY);
    this.gridLabel = pixelText(scene, 0, 0, '', DIM);
    this.card = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.cardTile = new Tile(scene);
    this.pips = scene.add.graphics();
    this.bigIcon = scene.add.image(0, 0, 'dust_icon').setOrigin(0).setScale(2);
    this.bigDust = pixelText(scene, 0, 0, '', DUSTY, 2);
    this.button = new Button(scene);
    this.flash = pixelText(scene, 0, 0, '', GOLD, 2).setAlpha(0);
    this.sortChip = new Button(scene).setVisible(keeper === 'disenchant');
    this.wornChip = new Button(scene).setVisible(keeper === 'disenchant');
    this.add([this.alcove, this.portrait, this.portraitGlow, this.title, this.dustBox, this.dustIcon, this.dustText, this.gridLabel, this.card, this.cardTile, this.pips, this.bigIcon, this.bigDust]);
    for (const key of STAT_KEYS) {
      const bg = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
      const texts = [0, 1, 2].map(() => pixelText(scene, 0, 0, ''));
      this.rows.push({ bg, texts, key, y: 0 });
      this.add([bg, ...texts]);
    }
    this.add([this.sortChip, this.wornChip, this.button, this.flash]);
    this.unwatch = collection.watch(() => this.refresh());
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unwatch());
    scene.add.existing(this);
  }

  /** Lay the view out in a w x h area (art pixels). */
  resize(w: number, h: number): void {
    this.areaW = w;

    const cols = Phaser.Math.Clamp(Math.floor((w - CARD_W - COL_GAP + GAP) / PITCH), 2, 6);
    const gridW = cols * PITCH - GAP;
    this.usedW = gridW + COL_GAP + CARD_W;
    this.usedH = h;

    // The keeper in their alcove, their name and words, and the dust in hand.
    this.alcove.setPosition(0, 0);
    this.portrait.setPosition(4, HEAD_H - KEEPER_H - 3);
    this.portraitGlow.setPosition(4, HEAD_H - KEEPER_H - 3);
    const tx = KEEPER_W + 16;
    this.title.setPosition(tx, 3);
    const dustW = 58;
    this.dustBox.setTexture(panelTexture(this.scene, 'keeper_dust', dustW, 17, PANEL_INSET)).setPosition(this.usedW - dustW, 0);
    this.dustIcon.setPosition(this.usedW - dustW + 5, 3);
    this.dustText.setY(5);
    for (const t of this.says) t.destroy();
    const chars = Math.floor((this.usedW - tx) / CH);
    this.says = wrap(KEEPERS[this.keeper].hello.toUpperCase(), chars)
      .slice(0, 3)
      .map((s, i) => pixelText(this.scene, tx, 16 + i * LINE, s, DIM));
    this.add(this.says);

    // The pieces on the left, the chosen one on the right.
    const top = HEAD_H + 6;
    this.gridLabel.setPosition(0, top);
    this.grid = { x: 0, y: top + LABEL_H, cols, rows: Math.max(1, Math.floor((h - top - LABEL_H + GAP) / PITCH)) };
    this.det = { x: gridW + COL_GAP, y: top, w: CARD_W, h: Math.max(120, h - top) };
    this.card.setTexture(panelTexture(this.scene, 'keeper_card', CARD_W, this.det.h, PANEL)).setPosition(this.det.x, this.det.y);
    this.refresh();
  }

  refresh(): void {
    if (!this.areaW) return;
    this.dustText.setText(`${collection.dust}`);
    this.dustText.setX(Math.round(this.usedW - 6 - this.dustText.width));
    this.entries = this.items();
    if (this.picked && !collection.count(this.picked)) this.picked = null;
    const maxRow = Math.max(0, Math.ceil(this.entries.length / this.grid.cols) - this.grid.rows);
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, maxRow);
    this.drawGrid();
    this.drawCard();
  }

  update(dt: number): void {
    this.time += dt;
    for (const t of this.cells) t.animate(this.time);
    this.cardTile.animate(this.time);
    const f = `f${Math.floor(this.time / 190) % KEEPER_FRAMES}`;
    if (this.portrait.frame.name !== f) {
      this.portrait.setFrame(f);
      this.portraitGlow.setFrame(f);
    }
    // The next pip blinks, waiting for its dust.
    if (this.keeper === 'upgrade' && this.picked) this.pips.setData('blink', Math.floor(this.time / 400) % 2);
    this.updateHold(dt);
    if (this.keeper === 'upgrade' && this.pips.getData('drawn') !== `${this.picked} ${collection.level(this.picked ?? '')} ${this.pips.getData('blink')}`) this.drawPips();
  }

  // ---- Input, in the view's coordinates ----

  pointerDown(x: number, y: number): void {
    this.press = { x, y, row: this.scrollRow, moved: false, button: this.button.visible && !this.button.dimmed && this.button.hit(x, y) };
    if (this.press.button) {
      this.button.press(true);
      if (this.keeper === 'disenchant') this.hold = { t: HOLD_START, every: HOLD_EVERY, fired: 0, dust: 0 };
    }
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) p.moved = true;
    if (p.button && !this.button.hit(x, y)) {
      this.button.press(false);
      this.hold = null;
    }
    if (!p.button && this.inGrid(p.x, p.y)) this.scrollTo(p.row - Math.round((y - p.y) / PITCH));
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.button) {
      // A hold that already unmade something is done; otherwise it was a tap.
      const held = (this.hold?.fired ?? 0) > 0;
      this.hold = null;
      this.button.press(false);
      if (!held && this.button.hit(x, y)) this.act();
      return;
    }
    if (!p.moved) this.tap(x, y);
  }

  wheel(dy: number): void {
    this.scrollTo(this.scrollRow + Math.sign(dy));
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
    if (this.sortChip.hit(x, y) || this.wornChip.hit(x, y)) {
      if (this.sortChip.hit(x, y)) unmaking.highFirst = !unmaking.highFirst;
      else unmaking.hideWorn = !unmaking.hideWorn;
      sound.gear(false);
      this.scrollRow = 0;
      this.refresh();
      return;
    }
    if (this.inGrid(x, y)) {
      const g = this.grid;
      const c = Math.floor((x - g.x) / PITCH);
      const r = Math.floor((y - g.y) / PITCH);
      if (x - g.x - c * PITCH >= TILE || y - g.y - r * PITCH >= TILE) return;
      const id = this.entries[(this.scrollRow + r) * g.cols + c];
      if (!id || id === this.picked) return;
      this.picked = id;
      this.confirm = false;
      // Tharn suggests the stat the piece is strongest in.
      const def = gearById(id);
      this.stat = def ? (STAT_KEYS.find((k) => def.stats[k]) ?? 'power') : null;
      this.refresh();
      return;
    }
    if (this.keeper === 'upgrade') {
      for (const row of this.rows) {
        if (!row.bg.visible) continue;
        if (x >= this.det.x + 4 && x < this.det.x + this.det.w - 4 && y >= row.y - 2 && y < row.y + ROW - 2) {
          this.stat = row.key;
          this.drawCard();
          return;
        }
      }
    }
  }

  /** Legendary only: Nyx asks twice, and a held button stops short of it. */
  private careful(id: string): boolean {
    const g = gearById(id);
    return !g || g.rarity === 'legendary';
  }

  /** The button: unmake the piece, or raise it a level. */
  private act(): void {
    const id = this.picked;
    if (!id) return;
    if (this.keeper === 'disenchant') {
      if (this.careful(id) && !this.confirm) {
        this.confirm = true;
        this.drawCard();
        return;
      }
      this.confirm = false;
      const got = this.unmake(id);
      if (got) this.pop(`+${got}`, DUSTY);
    } else {
      if (!this.stat || !collection.upgrade(id, this.stat)) return;
      sound.clash(0, true);
      sound.gear(true);
      this.pop(`LV ${collection.level(id)}!`, GOLD);
    }
  }

  /** Break `id` into dust (the next piece in the list taking its place once the last is gone); the dust it gave. */
  private unmake(id: string): number {
    const g = gearById(id);
    if (!g) return 0;
    // Where it sits in the list, so the next piece can take its place when this one is gone.
    const at = this.entries.indexOf(id);
    const got = collection.disenchant(id);
    if (!got) return 0;
    if (!this.entries.includes(id)) {
      this.picked = this.entries[Math.min(at, this.entries.length - 1)] ?? null;
      this.keepInView();
      this.refresh();
    }
    sound.shatter(0, rank(g) >= RARITIES.indexOf('epic'));
    return got;
  }

  /**
   * Nyx's button held: after a moment it unmakes the picked piece, then again
   * and again, quicker each time, moving on down the list as stacks run out,
   * the dust counting up over the card. It stops at the first piece that
   * would need asking twice (or one being worn), or when there's nothing left.
   */
  private updateHold(dt: number): void {
    const h = this.hold;
    if (!h) return;
    h.t -= dt;
    while (h.t <= 0) {
      const id = this.picked;
      const got = id && !this.careful(id) && collection.disenchantValue(id) !== null ? this.unmake(id) : 0;
      if (!got) {
        // Stopped: if nothing was unmade yet, letting go still counts as a tap (Nyx asks about a rare piece).
        if (h.fired) h.t = Infinity;
        else this.hold = null;
        return;
      }
      h.fired++;
      h.dust += got;
      this.pop(`+${h.dust}`, DUSTY);
      h.every = Math.max(HOLD_FASTEST, h.every * HOLD_SPEEDUP);
      h.t += h.every;
    }
  }

  /** Scroll so the picked piece is on screen. */
  private keepInView(): void {
    const i = this.picked ? this.entries.indexOf(this.picked) : -1;
    if (i < 0) return;
    const row = Math.floor(i / this.grid.cols);
    if (row < this.scrollRow) this.scrollRow = row;
    else if (row >= this.scrollRow + this.grid.rows) this.scrollRow = row - this.grid.rows + 1;
  }

  /** Words rising off the card for a moment. */
  private pop(text: string, tint: number): void {
    const f = this.flash;
    this.scene.tweens.killTweensOf(f);
    f.setText(text).setTint(tint).setAlpha(1);
    const x = Math.round(this.det.x + (this.det.w - f.width) / 2);
    const y = this.det.y + 44;
    f.setPosition(x, y);
    this.scene.tweens.add({ targets: f, y: y - 16, alpha: 0, duration: 900, ease: 'Sine.Out' });
  }

  // ---- Drawing ----

  /** The pieces this keeper works on. */
  private items(): string[] {
    const owned = GEAR.filter((g) => collection.count(g.id) > 0);
    if (this.keeper === 'disenchant') {
      // By rarity, whichever way round the player chose; pieces they are wearing their only copy of left out unless asked for.
      const dir = unmaking.highFirst ? -1 : 1;
      return owned
        .filter((g) => !unmaking.hideWorn || !collection.isEquipped(g.id) || collection.count(g.id) > 1)
        .sort((a, b) => (rank(a) - rank(b)) * dir || a.name.localeCompare(b.name))
        .map((g) => g.id);
    }
    // Worn pieces first, then the finest.
    return owned
      .filter(canUpgrade)
      .sort((a, b) => Number(collection.isEquipped(b.id)) - Number(collection.isEquipped(a.id)) || rank(b) - rank(a) || collection.level(b.id) - collection.level(a.id) || a.name.localeCompare(b.name))
      .map((g) => g.id);
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
      this.bringToTop(this.flash);
    }
    this.cells.forEach((t, i) => {
      const id = i < shown ? this.entries[this.scrollRow * g.cols + i] : undefined;
      t.setVisible(!!id);
      if (!id) return;
      t.setPosition(g.x + (i % g.cols) * PITCH, g.y + Math.floor(i / g.cols) * PITCH);
      t.show(id, { count: collection.count(id), level: collection.level(id), worn: collection.isEquipped(id), picked: id === this.picked });
    });
    const more = (this.scrollRow + g.rows) * g.cols < this.entries.length;
    if (this.keeper === 'disenchant') {
      // The two controls sit at the right of the label row, the count at its left if it fits.
      const gridW = g.cols * PITCH - GAP;
      const sortText = unmaking.highFirst ? 'HI-LOW' : 'LOW-HI';
      const sw = sortText.length * CH + 10;
      const ww = 7 * CH + 10;
      this.wornChip.set('NO WORN', ww, CHIP_H, unmaking.hideWorn).setPosition(gridW - ww, g.y - LABEL_H - 1);
      this.sortChip.set(sortText, sw, CHIP_H, true).setPosition(gridW - ww - 3 - sw, g.y - LABEL_H - 1);
      const label = `GEAR ${this.entries.length}${more ? '+' : ''}`;
      this.gridLabel.setText(label.length * CH + 4 <= gridW - ww - sw - 3 ? label : '');
    } else this.gridLabel.setText(`EPIC AND LEGENDARY  ${this.entries.length}${more ? '  +MORE' : ''}`);
    for (const t of this.emptyNote) t.destroy();
    this.emptyNote = [];
    if (!this.entries.length) {
      const msg = this.keeper === 'disenchant' ? (unmaking.hideWorn && collection.ownedGear().length ? 'ONLY WORN PIECES. TAP NO WORN TO SHOW THEM.' : 'NOTHING TO UNMAKE YET. MONSTERS DROP GEAR.') : 'NO EPIC OR LEGENDARY GEAR YET. BOSSES DROP THEM.';
      this.emptyNote = wrap(msg, Math.floor((g.cols * PITCH) / CH)).map((s, i) => pixelText(this.scene, g.x, g.y + 4 + i * LINE, s, SOFT));
      this.add(this.emptyNote);
    }
  }

  private line(i: number): Phaser.GameObjects.BitmapText {
    while (this.lines.length <= i) {
      const t = pixelText(this.scene, 0, 0, '');
      this.lines.push(t);
      this.add(t);
    }
    return this.lines[i];
  }

  private drawCard(): void {
    const { x, w } = this.det;
    const pad = 6;
    const chars = Math.floor((w - pad * 2) / CH);
    let n = 0;
    const text = (s: string, tint: number, lx: number, ly: number) => this.line(n++).setText(s.toUpperCase()).setTint(tint).setPosition(Math.round(lx), Math.round(ly)).setVisible(true);
    const para = (s: string, tint: number, ly: number) => {
      for (const l of wrap(s.toUpperCase(), chars)) {
        text(l, tint, x + pad, ly);
        ly += LINE;
      }
      return ly;
    };
    this.cardTile.setVisible(false);
    this.button.setVisible(false);
    this.bigDust.setVisible(false);
    this.bigIcon.setVisible(false);
    this.pips.clear().setData('drawn', '');
    for (const r of this.rows) {
      r.bg.setVisible(false);
      for (const t of r.texts) t.setVisible(false);
    }

    const id = this.picked;
    const g = id ? collection.gear(id) : undefined;
    let y = this.det.y + pad;
    if (!id || !g) {
      text(this.keeper === 'disenchant' ? 'Unmaking' : 'Runeforging', GOLD, x + pad, y);
      y += LINE + 4;
      if (this.keeper === 'disenchant') {
        y = para('Pick a piece to break it down into dust.', DIM, y) + 6;
        y = para('Common 1, uncommon 2, rare 5, epic 15, legendary 40. Upgraded pieces give back half the dust spent on them.', SOFT, y) + 6;
        y = para('Worn pieces must come off first.', SOFT, y) + 6;
        para('Hold the button to unmake piece after piece.', SOFT, y);
      } else {
        y = para('Pick an epic or legendary piece to raise it a level, up to 10.', DIM, y) + 6;
        para('Each level adds a point to a stat of your choice. Epic pieces cost half as much dust.', SOFT, y);
      }
      this.hideRest(n);
      return;
    }

    // The piece: its tile, name, rarity, type and level.
    const lv = collection.level(id);
    this.cardTile.setVisible(true).setPosition(x + pad, y).show(id, { worn: collection.isEquipped(id), level: lv });
    const tx = x + pad + TILE + 5;
    const nameLines = wrap(g.name.toUpperCase(), Math.floor((x + w - pad - tx) / CH)).slice(0, 2);
    let ty = y + (nameLines.length > 1 ? 0 : 3);
    for (const s of nameLines) {
      text(s, RARITY[g.rarity].tint, tx, ty);
      ty += LINE;
    }
    text(RARITY[g.rarity].name, RARITY[g.rarity].tint, tx, ty);
    text(canUpgrade(g) ? `${SLOT_NAME[g.slot]}  Lv${lv}` : SLOT_NAME[g.slot], DIM, tx, ty + LINE);
    y += TILE + 4;
    const btnY = this.det.y + this.det.h - pad - BTN_H;

    if (this.keeper === 'disenchant') {
      const value = collection.disenchantValue(id);
      const count = collection.count(id);
      if (value === null) {
        y = para('You are wearing it. Take it off to unmake it.', BAD, y);
      } else {
        text('Breaks into', DIM, x + pad, y);
        y += LINE + 2;
        this.bigIcon.setVisible(true).setPosition(x + pad, y + 1);
        this.bigDust.setVisible(true).setText(`+${value}`).setPosition(x + pad + 26, y + 2);
        y += 24;
        const refund = value - DUST_VALUE[g.rarity];
        if (refund > 0) y = para(`${refund} of it from its ${lv - 1} levels`, SOFT, y);
        if (count > 1) y = para(`A spare: you keep ${count - 1}`, GOOD, y);
      }
      this.button.setVisible(true).set(this.confirm ? 'Tap again to unmake' : 'Disenchant', w - pad * 2, BTN_H, this.confirm).dim(value === null);
      this.button.setPosition(x + pad, btnY);
      this.hideRest(n);
      return;
    }

    // Tharn: the level as ten pips, then the six stats to put the next point in.
    this.pips.setData('y', y).setData('x', x + pad).setData('w', w - pad * 2);
    this.drawPips();
    y += 9;
    const cost = collection.nextCost(id);
    if (cost === null) {
      text('Level 10: it is whole', GOLD, x + pad, y);
      y += LINE + 2;
    }
    for (const row of this.rows) {
      if (y + ROW > btnY) break;
      const k = row.key;
      const cur = g.stats[k] ?? 0;
      const on = cost !== null && this.stat === k;
      row.y = y;
      row.bg.setVisible(on).setTexture(panelTexture(this.scene, 'keeper_row', w - 8, ROW + 1, PANEL_PICKED)).setPosition(x + 4, y - 2);
      const [lab, val, add] = row.texts;
      lab.setText(STAT_LABEL[k]).setTint(on ? GOLD : cur ? CREAM : SOFT).setPosition(x + pad + 2, y).setVisible(true);
      val.setText(cur ? statValue(k, cur) : '-').setTint(cur ? GOOD : SOFT).setVisible(true);
      val.setPosition(Math.round(x + pad + 2 + 7 * CH + 30 - val.width), y);
      add.setText(cost !== null ? statValue(k, STAT_STEP[k]) : '').setTint(on ? GOLD : SOFT).setVisible(true);
      add.setPosition(Math.round(x + w - pad - 2 - add.width), y);
      y += ROW;
    }
    if (cost !== null) {
      const short = collection.dust < cost;
      const label = !this.stat ? 'Pick a stat' : short ? `Need ${cost} dust` : `Upgrade: ${cost} dust`;
      this.button.setVisible(true).set(label, w - pad * 2, BTN_H, !short && !!this.stat).dim(short || !this.stat);
      this.button.setPosition(x + pad, btnY);
    }
    this.hideRest(n);
  }

  /** The level: ten pips, the reached ones gold, the next one blinking. */
  private drawPips(): void {
    const id = this.picked;
    const g = this.pips.clear();
    if (!id || this.keeper !== 'upgrade' || !this.card.visible || this.pips.getData('y') === undefined) return;
    const lv = collection.level(id);
    const blink = this.pips.getData('blink') ?? 0;
    this.pips.setData('drawn', `${id} ${lv} ${blink}`);
    const x0 = this.pips.getData('x') as number;
    const y0 = this.pips.getData('y') as number;
    const w = this.pips.getData('w') as number;
    const pw = Math.floor((w - (MAX_LEVEL - 1) * 2) / MAX_LEVEL);
    for (let i = 0; i < MAX_LEVEL; i++) {
      const px = x0 + i * (pw + 2);
      g.fillStyle(0x0b0818, 1).fillRect(px, y0, pw, 6);
      const reached = i < lv;
      const next = i === lv && blink;
      g.fillStyle(reached ? 0xf4cf6a : next ? 0x8a6a2a : 0x231a46, 1).fillRect(px + 1, y0 + 1, pw - 2, 4);
      if (reached) g.fillStyle(0xfff4bf, 1).fillRect(px + 1, y0 + 1, pw - 2, 1);
    }
  }

  private hideRest(n: number): void {
    for (let i = n; i < this.lines.length; i++) this.lines[i].setVisible(false);
  }
}
