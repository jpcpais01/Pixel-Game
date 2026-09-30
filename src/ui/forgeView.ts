// Brenna's counter at the Forge: she forges the one set piece the player is
// missing from dust and its boss's materials.
//
//  - Across the top: Brenna (animated, in a little alcove), her name and what
//    she says, and the player's dust.
//  - Left: the five sets as chips, each with its material and how many the
//    player holds; under them, the chosen set's six pieces (the ones not yet
//    owned dark), and what wearing the whole set does.
//  - Right: the chosen piece, its stats, what it costs and what the player has
//    of it, and the button that forges it.
//
// Drawn in art pixels like the Rune Temple's counters; the host (keeperHud.ts)
// scales it and passes pointer events in the view's own coordinates.

import Phaser from 'phaser';
import { sound } from '../audio';
import { collection } from '../game/collection';
import { FORGE_COST, FORGE_SETS, MATERIALS, matIcon } from '../game/forge';
import { GEAR, GEAR_SETS, RARITY, SLOTS, SLOT_NAME, statLines, type GearDef, type SetId } from '../game/gear';
import { KEEPERS } from '../game/keepers';
import { PORTRAIT_FRAMES, PORTRAIT_H, PORTRAIT_W } from '../art/forge';
import { TILE } from '../art/invTiles';
import { Button, Tile, wrap } from './inventoryView';
import { PANEL, PANEL_INSET, PANEL_PICKED, panelTexture, pixelText } from './widgets';

const GAP = 3;
const PITCH = TILE + GAP;
const LINE = 10;
const CH = 6;
const HEAD_H = 46;
const CARD_W = 152;
const COL_GAP = 10;
const BTN_H = 16;
/** The set chips: a material's icon over its count. */
const CHIP_W = 22;
const CHIP_H = 29;
const TILE_COLS = 3;

const DIM = 0x9a90c8;
const SOFT = 0x7c82b8;
const CREAM = 0xfff4d6;
const GOLD = 0xf4cf6a;
const GOOD = 0x8dff8a;
const BAD = 0xff7a6a;
const DUSTY = 0xd8b0ff;

/** A set's six pieces, in slot order. */
const piecesOf = (set: SetId): GearDef[] =>
  GEAR.filter((g) => g.set === set).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));

/** The set shown first: the one with the most materials in hand that still has a piece missing. */
function firstSet(): SetId {
  const missing = FORGE_SETS.filter((s) => piecesOf(s).some((g) => !collection.count(g.id)));
  const from = missing.length ? missing : FORGE_SETS;
  return from.reduce((best, s) => (collection.mats(s) > collection.mats(best) ? s : best), from[0]);
}

export class ForgeView extends Phaser.GameObjects.Container {
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
  /** One chip per set: its frame, its material's icon and the count held. */
  private chips: { set: SetId; bg: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText; x: number; y: number }[] = [];
  private setTitle: Phaser.GameObjects.BitmapText;
  private setCount: Phaser.GameObjects.BitmapText;
  private setNote: Phaser.GameObjects.BitmapText[] = [];
  private tiles: Tile[] = [];
  private card: Phaser.GameObjects.Image;
  private cardTile: Tile;
  /** The flash over the card's tile when a piece is forged. */
  private burst: Phaser.GameObjects.Image;
  private lines: Phaser.GameObjects.BitmapText[] = [];
  /** The cost row: the material and the dust, each with its icon. */
  private costMat: Phaser.GameObjects.Image;
  private costDust: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.BitmapText;
  private button: Button;
  /** The set whose pieces are shown. */
  private chosen: SetId;
  private picked: string | null = null;
  private tileAt = { x: 0, y: 0 };
  private det = { x: 0, y: 0, w: CARD_W, h: 0 };
  private press: { x: number; y: number; button: boolean } | null = null;
  private time = 0;
  private areaW = 0;
  private unwatch: () => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const k = KEEPERS.forge;
    this.alcove = scene.add.image(0, 0, panelTexture(scene, 'keeper_alcove', PORTRAIT_W + 8, HEAD_H, PANEL_INSET)).setOrigin(0);
    this.portrait = scene.add.image(0, 0, k.texture, 'f0').setOrigin(0);
    this.portraitGlow = scene.add.image(0, 0, `${k.texture}_e`, 'f0').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.title = pixelText(scene, 0, 0, `${k.name} ${k.title}`, k.tint);
    this.dustBox = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.dustIcon = scene.add.image(0, 0, 'dust_icon').setOrigin(0);
    this.dustText = pixelText(scene, 0, 0, '', DUSTY);
    this.add([this.alcove, this.portrait, this.portraitGlow, this.title, this.dustBox, this.dustIcon, this.dustText]);
    for (const set of FORGE_SETS) {
      const bg = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
      const icon = scene.add.image(0, 0, matIcon(set)).setOrigin(0);
      const count = pixelText(scene, 0, 0, '');
      this.chips.push({ set, bg, icon, count, x: 0, y: 0 });
      this.add([bg, icon, count]);
    }
    this.setTitle = pixelText(scene, 0, 0, '');
    this.setCount = pixelText(scene, 0, 0, '', DIM);
    this.add([this.setTitle, this.setCount]);
    for (let i = 0; i < 6; i++) {
      const t = new Tile(scene);
      this.tiles.push(t);
      this.add(t);
    }
    this.card = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.cardTile = new Tile(scene);
    this.burst = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.costMat = scene.add.image(0, 0, matIcon('wraith')).setOrigin(0);
    this.costDust = scene.add.image(0, 0, 'dust_icon').setOrigin(0);
    this.button = new Button(scene);
    this.flash = pixelText(scene, 0, 0, '', GOLD, 2).setAlpha(0);
    this.add([this.card, this.cardTile, this.costMat, this.costDust, this.button, this.burst, this.flash]);
    this.chosen = firstSet();
    this.pickFirstMissing();
    this.unwatch = collection.watch(() => this.refresh());
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unwatch());
    scene.add.existing(this);
  }

  /** Lay the view out in a w x h area (art pixels). */
  resize(w: number, h: number): void {
    this.areaW = w;
    const leftW = Math.max(FORGE_SETS.length * (CHIP_W + GAP) - GAP, TILE_COLS * PITCH - GAP);
    this.usedW = leftW + COL_GAP + CARD_W;
    this.usedH = h;

    // Brenna in her alcove, her name and words, and the dust in hand.
    this.portrait.setPosition(4, HEAD_H - PORTRAIT_H - 3);
    this.portraitGlow.setPosition(4, HEAD_H - PORTRAIT_H - 3);
    const tx = PORTRAIT_W + 16;
    this.title.setPosition(tx, 3);
    const dustW = 58;
    this.dustBox.setTexture(panelTexture(this.scene, 'keeper_dust', dustW, 17, PANEL_INSET)).setPosition(this.usedW - dustW, 0);
    this.dustIcon.setPosition(this.usedW - dustW + 5, 3);
    this.dustText.setY(5);
    for (const t of this.says) t.destroy();
    this.says = wrap(KEEPERS.forge.hello.toUpperCase(), Math.floor((this.usedW - tx) / CH))
      .slice(0, 3)
      .map((s, i) => pixelText(this.scene, tx, 16 + i * LINE, s, DIM));
    this.add(this.says);

    // The set chips across the top of the left column, the set's pieces under them.
    const top = HEAD_H + 6;
    this.chips.forEach((c, i) => {
      c.x = i * (CHIP_W + GAP);
      c.y = top;
      c.icon.setPosition(c.x + (CHIP_W - 16) / 2, c.y + 3);
    });
    this.setTitle.setPosition(0, top + CHIP_H + 5);
    this.tileAt = { x: 0, y: top + CHIP_H + 5 + LINE + 3 };
    this.tiles.forEach((t, i) => t.setPosition(this.tileAt.x + (i % TILE_COLS) * PITCH, this.tileAt.y + Math.floor(i / TILE_COLS) * PITCH));
    this.det = { x: leftW + COL_GAP, y: top, w: CARD_W, h: Math.max(140, h - top) };
    this.card.setTexture(panelTexture(this.scene, 'keeper_card', CARD_W, this.det.h, PANEL)).setPosition(this.det.x, this.det.y);
    this.refresh();
  }

  refresh(): void {
    if (!this.areaW) return;
    this.dustText.setText(`${collection.dust}`);
    this.dustText.setX(Math.round(this.usedW - 6 - this.dustText.width));
    this.drawSets();
    this.drawCard();
  }

  update(dt: number): void {
    this.time += dt;
    for (const t of this.tiles) t.animate(this.time);
    this.cardTile.animate(this.time);
    const f = `f${Math.floor(this.time / 190) % PORTRAIT_FRAMES}`;
    if (this.portrait.frame.name !== f) {
      this.portrait.setFrame(f);
      this.portraitGlow.setFrame(f);
    }
  }

  // ---- Input, in the view's coordinates ----

  pointerDown(x: number, y: number): void {
    const button = this.button.visible && !this.button.dimmed && this.button.hit(x, y);
    this.press = { x, y, button };
    if (button) this.button.press(true);
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (p?.button && !this.button.hit(x, y)) {
      this.button.press(false);
      p.button = false;
    }
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.button) {
      this.button.press(false);
      if (this.button.hit(x, y)) this.forge();
      return;
    }
    if (Math.hypot(x - p.x, y - p.y) <= 5) this.tap(x, y);
  }

  /** Nothing here scrolls: all six pieces of a set fit. */
  wheel(_dy: number): void {}

  private tap(x: number, y: number): void {
    for (const c of this.chips) {
      if (x < c.x || y < c.y || x >= c.x + CHIP_W || y >= c.y + CHIP_H || c.set === this.chosen) continue;
      this.chosen = c.set;
      this.pickFirstMissing();
      sound.gear(false);
      this.refresh();
      return;
    }
    const pieces = piecesOf(this.chosen);
    for (let i = 0; i < pieces.length; i++) {
      const tx = this.tileAt.x + (i % TILE_COLS) * PITCH;
      const ty = this.tileAt.y + Math.floor(i / TILE_COLS) * PITCH;
      if (x < tx || y < ty || x >= tx + TILE || y >= ty + TILE || pieces[i].id === this.picked) continue;
      this.picked = pieces[i].id;
      this.refresh();
      return;
    }
  }

  /** Pick the set's first piece not yet owned (or its first, when the set is whole). */
  private pickFirstMissing(): void {
    const pieces = piecesOf(this.chosen);
    this.picked = (pieces.find((g) => !collection.count(g.id)) ?? pieces[0])?.id ?? null;
  }

  /** The button: forge the picked piece, with a ring of the anvil and a flash of its set's colour. */
  private forge(): void {
    const id = this.picked;
    if (!id || !collection.forge(id)) return;
    sound.forged();
    const tint = GEAR_SETS[this.chosen].tint;
    this.pop('FORGED!', tint);
    const b = this.burst;
    this.scene.tweens.killTweensOf(b);
    b.setTint(tint).setAlpha(1).setScale(1.2);
    this.scene.tweens.add({ targets: b, alpha: 0, scale: 2.4, duration: 700, ease: 'Sine.Out' });
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

  private drawSets(): void {
    for (const c of this.chips) {
      const on = c.set === this.chosen;
      const n = collection.mats(c.set);
      c.bg.setTexture(panelTexture(this.scene, on ? 'forge_chip_on' : 'forge_chip', CHIP_W, CHIP_H, on ? PANEL_PICKED : PANEL_INSET)).setPosition(c.x, c.y);
      c.icon.setAlpha(n || on ? 1 : 0.45);
      c.count.setText(`${n}`).setTint(n >= FORGE_COST.mats ? GOOD : n ? CREAM : SOFT);
      c.count.setPosition(Math.round(c.x + (CHIP_W - c.count.width) / 2), c.y + 20);
    }
    const s = GEAR_SETS[this.chosen];
    const pieces = piecesOf(this.chosen);
    const owned = pieces.filter((g) => collection.count(g.id)).length;
    this.setTitle.setText(s.name.toUpperCase()).setTint(s.tint);
    this.setCount.setText(`${owned}/${pieces.length}`).setTint(owned === pieces.length ? GOOD : DIM);
    const leftW = this.det.x - COL_GAP;
    this.setCount.setPosition(Math.round(leftW - this.setCount.width), this.setTitle.y);
    pieces.forEach((g, i) => {
      const have = collection.count(g.id) > 0;
      this.tiles[i].setVisible(true).show(g.id, { known: have, worn: collection.isEquipped(g.id), picked: g.id === this.picked, level: collection.level(g.id) });
    });
    for (let i = pieces.length; i < this.tiles.length; i++) this.tiles[i].setVisible(false);
    // What the whole set does, under its pieces.
    for (const t of this.setNote) t.destroy();
    const rows = Math.ceil(pieces.length / TILE_COLS);
    const ny = this.tileAt.y + rows * PITCH + 3;
    const room = Math.floor((this.usedH - ny) / LINE);
    this.setNote = room > 0 ? wrap(`Whole set: ${s.effect}`.toUpperCase(), Math.floor((leftW + 2) / CH)).slice(0, room).map((l, i) => pixelText(this.scene, 0, ny + i * LINE, l, SOFT)) : [];
    this.add(this.setNote);
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
    this.costMat.setVisible(false);
    this.costDust.setVisible(false);
    this.button.setVisible(false);
    this.bringToTop(this.burst);
    this.bringToTop(this.flash);

    const id = this.picked;
    const g = id ? collection.gear(id) : undefined;
    let y = this.det.y + pad;
    if (!id || !g?.set) {
      text('Forging', GOLD, x + pad, y);
      y += LINE + 4;
      y = para('Pick a set piece you are missing, and Brenna will forge it.', DIM, y) + 6;
      para(`Each costs ${FORGE_COST.mats} of its boss's material and ${FORGE_COST.dust} dust.`, SOFT, y);
      this.hideRest(n);
      return;
    }

    // The piece: its tile, name, set and slot.
    const have = collection.count(id) > 0;
    const set = g.set;
    this.cardTile.setVisible(true).setPosition(x + pad, y).show(id, { known: true, worn: collection.isEquipped(id), level: collection.level(id) });
    this.burst.setPosition(x + pad + TILE / 2, y + TILE / 2);
    const tx = x + pad + TILE + 5;
    const nameLines = wrap(g.name.toUpperCase(), Math.floor((x + w - pad - tx) / CH)).slice(0, 2);
    let ty = y + (nameLines.length > 1 ? 0 : 3);
    for (const s of nameLines) {
      text(s, GEAR_SETS[set].tint, tx, ty);
      ty += LINE;
    }
    text(RARITY[g.rarity].name, RARITY[g.rarity].tint, tx, ty);
    text(SLOT_NAME[g.slot], DIM, tx, ty + LINE);
    y += TILE + 5;
    for (const s of statLines(g.stats)) {
      text(s, GOOD, x + pad, y);
      y += LINE;
    }
    y += 3;
    const btnY = this.det.y + this.det.h - pad - BTN_H;

    if (have) {
      para(collection.isEquipped(id) ? 'You wear it already.' : 'You have it already. It is in your bag.', SOFT, y);
      this.button.setVisible(true).set('Owned', w - pad * 2, BTN_H, false).dim(true).setPosition(x + pad, btnY);
      this.hideRest(n);
      return;
    }

    // What it costs, and what the player holds of each.
    const m = MATERIALS[set];
    const mats = collection.mats(set);
    const dust = collection.dust;
    const costY = Math.max(y, btnY - 2 * (LINE + 8) - 2);
    text('Forge cost', DIM, x + pad, costY);
    const row = (icon: Phaser.GameObjects.Image, ry: number, need: number, hold: number, what: string) => {
      icon.setVisible(true).setPosition(x + pad, ry - (icon === this.costMat ? 4 : 2));
      text(`${need} ${what}`, hold >= need ? CREAM : BAD, x + pad + 19, ry);
      const own = this.line(n++).setText(`${hold}`).setTint(hold >= need ? GOOD : BAD).setVisible(true);
      own.setPosition(Math.round(x + w - pad - own.width), ry);
    };
    this.costMat.setTexture(matIcon(set));
    row(this.costMat, costY + LINE + 4, FORGE_COST.mats, mats, m.name);
    row(this.costDust, costY + 2 * LINE + 10, FORGE_COST.dust, dust, 'Dust');
    const shortMats = FORGE_COST.mats - mats;
    const label = shortMats > 0 ? `Need ${shortMats} more` : dust < FORGE_COST.dust ? `Need ${FORGE_COST.dust - dust} dust` : 'Forge';
    const ok = shortMats <= 0 && dust >= FORGE_COST.dust;
    this.button.setVisible(true).set(label, w - pad * 2, BTN_H, ok).dim(!ok).setPosition(x + pad, btnY);
    // Where the material comes from, if there's room above the cost.
    if (!ok && y + LINE * 2 <= costY - 2) para(`${m.name} drops from ${GEAR_SETS[set].boss}.`, SOFT, y);
    this.hideRest(n);
  }

  private hideRest(n: number): void {
    for (let i = n; i < this.lines.length; i++) this.lines[i].setVisible(false);
  }
}
