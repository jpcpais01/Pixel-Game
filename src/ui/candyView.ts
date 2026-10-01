// A season's stall in the Clearing: Old Wick's counter for Hallow's Eve,
// where candy buys the season's limited skins and companions. It opens over
// the world like the Rune Temple keepers' counters (see keeperHud.ts), and
// shares their shape:
//
//  - Across the top: the keeper (animated, in a little alcove), their name
//    and what they say, and the player's candy.
//  - A row of the season's wares, as the same cards the shop's wishes turn
//    over, each with its price (or "owned") under it; tap one to pick it.
//  - Under them, the picked ware: its name and what it is, and the button
//    that buys it, or once it's owned, wears it (a skin) or takes it along
//    (a companion).
//
// Drawn in art pixels; the host scales it and passes pointer events in the
// view's own coordinates.

import Phaser from 'phaser';
import { sound } from '../audio';
import { collection } from '../game/collection';
import { ALL_SKINS, RARITY_INFO, type SkinEntry } from '../game/gacha';
import { petById, type PetDef } from '../game/pets';
import { activeSeason, buyWare, daysLeft, ownsWare, type SeasonDef, type SeasonWare } from '../game/season';
import { lookOf, setLook } from '../game/skins';
import { WICK_FRAMES, WICK_H, WICK_W } from '../art/hallowsDecor';
import { Button, wrap } from './inventoryView';
import { petFace } from './petCard';
import { skinFace } from './skinCard';
import { PANEL_INSET, panelTexture, pixelText } from './widgets';

const HEAD_H = 46;
const LINE = 10;
const CH = 6;
const LABEL_H = 11;
const GAP = 6;
/** Cards are at most this wide, and this much taller than wide. */
const CARD_MAX_W = 64;
const CARD_RATIO = 1.42;
const PRICE_H = 12;
const BTN_H = 16;
const BTN_W = 104;
const INFO_H = 40;
const TAP_SLOP = 5;

const DIM = 0x9a90c8;
const SOFT = 0x7c82b8;
const GOLD = 0xf4cf6a;
const GOOD = 0x8dff8a;
const CANDY = 0xffb45a;

interface Ware {
  ware: SeasonWare;
  skin: SkinEntry | null;
  pet: PetDef | null;
  box: Phaser.GameObjects.Container;
  price: Phaser.GameObjects.BitmapText;
  coin: Phaser.GameObjects.Image;
}

export class CandyView extends Phaser.GameObjects.Container {
  usedW = 0;
  usedH = 0;
  private season: SeasonDef | null;
  private alcove: Phaser.GameObjects.Image;
  private portrait: Phaser.GameObjects.Image;
  private portraitGlow: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.BitmapText;
  private says: Phaser.GameObjects.BitmapText[] = [];
  private candyBox: Phaser.GameObjects.Image;
  private candyIcon: Phaser.GameObjects.Image;
  private candyText: Phaser.GameObjects.BitmapText;
  private label: Phaser.GameObjects.BitmapText;
  private marks: Phaser.GameObjects.Graphics;
  private wares: Ware[] = [];
  private wareName: Phaser.GameObjects.BitmapText;
  private what: Phaser.GameObjects.BitmapText;
  private button: Button;
  /** "YOURS!" rising off the picked card after it's bought. */
  private flash: Phaser.GameObjects.BitmapText;
  private picked = 0;
  private cardW = CARD_MAX_W;
  private cardH = Math.round(CARD_MAX_W * CARD_RATIO);
  private cols = 5;
  private press: { x: number; y: number; moved: boolean; button: boolean } | null = null;
  private time = 0;
  private unwatch: () => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.season = activeSeason();
    const k = this.season?.keeper ?? { name: 'Stall', title: '', tint: CANDY, hello: 'Closed until the next season.' };
    this.alcove = scene.add.image(0, 0, panelTexture(scene, 'candy_alcove', WICK_W + 8, HEAD_H, PANEL_INSET)).setOrigin(0);
    this.portrait = scene.add.image(0, 0, 'hw_wick', 'f0').setOrigin(0);
    this.portraitGlow = scene.add.image(0, 0, 'hw_wick_e', 'f0').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.title = pixelText(scene, 0, 0, `${k.name} ${k.title}`, k.tint);
    this.candyBox = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.candyIcon = scene.add.image(0, 0, 'candy_s').setOrigin(0);
    this.candyText = pixelText(scene, 0, 0, '', CANDY);
    this.label = pixelText(scene, 0, 0, '', CANDY);
    this.marks = scene.add.graphics();
    this.wareName = pixelText(scene, 0, 0, '');
    this.what = pixelText(scene, 0, 0, '', DIM);
    this.button = new Button(scene);
    this.flash = pixelText(scene, 0, 0, '', GOLD, 2).setAlpha(0);
    this.add([this.alcove, this.portrait, this.portraitGlow, this.title, this.candyBox, this.candyIcon, this.candyText, this.label, this.marks, this.wareName, this.what, this.button, this.flash]);
    this.unwatch = collection.watch(() => this.refresh());
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unwatch());
    scene.add.existing(this);
  }

  /** Lay the view out in a w x h area (art pixels). */
  resize(w: number, h: number): void {
    // As many cards to a row as fit, all of them if they can; their size from what's left of the height.
    const n = Math.max(1, this.season?.wares.length ?? 1);
    const top = HEAD_H + 6 + LABEL_H;
    const fitW = (cols: number) => Math.floor((w - (cols - 1) * GAP) / cols);
    this.cols = fitW(n) >= 46 ? n : Math.ceil(n / 2);
    const rows = Math.ceil(n / this.cols);
    const room = h - top - INFO_H - rows * PRICE_H - (rows - 1) * 4;
    const cw = Math.min(CARD_MAX_W, fitW(this.cols), Math.floor(room / rows / CARD_RATIO));
    const ch = Math.round(cw * CARD_RATIO);
    this.usedW = Math.max(this.cols * cw + (this.cols - 1) * GAP, Math.min(w, 300));
    this.usedH = h;

    // The keeper in her alcove, her name and words, and the candy in hand.
    this.portrait.setPosition(4, HEAD_H - WICK_H - 3);
    this.portraitGlow.setPosition(4, HEAD_H - WICK_H - 3);
    const tx = WICK_W + 16;
    this.title.setPosition(tx, 3);
    const boxW = 58;
    this.candyBox.setTexture(panelTexture(this.scene, 'candy_count', boxW, 17, PANEL_INSET)).setPosition(this.usedW - boxW, 0);
    this.candyIcon.setPosition(this.usedW - boxW + 5, 5);
    this.candyText.setY(5);
    for (const t of this.says) t.destroy();
    const chars = Math.floor((this.usedW - tx) / CH);
    this.says = wrap((this.season?.keeper.hello ?? '').toUpperCase(), chars)
      .slice(0, 3)
      .map((s, i) => pixelText(this.scene, tx, 16 + i * LINE, s, DIM));
    this.add(this.says);
    this.label.setPosition(0, HEAD_H + 6);

    // The cards are remade when their size changes.
    if (cw !== this.cardW || ch !== this.cardH || !this.wares.length) {
      this.cardW = cw;
      this.cardH = ch;
      this.build();
    }
    const rowW = this.cols * cw + (this.cols - 1) * GAP;
    const x0 = Math.round((this.usedW - rowW) / 2);
    this.wares.forEach((wr, i) => {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = x0 + col * (cw + GAP);
      const y = top + row * (ch + PRICE_H + 4);
      wr.box.setPosition(x + cw / 2, y + ch / 2);
      wr.box.setData('rect', [x, y, cw, ch + PRICE_H]);
    });
    this.bringToTop(this.marks);
    this.bringToTop(this.flash);
    this.refresh();
  }

  /** The season's wares as cards, each with a price line under it. */
  private build(): void {
    for (const wr of this.wares) wr.box.destroy();
    this.wares = [];
    for (const ware of this.season?.wares ?? []) {
      const skin = ware.kind === 'skin' ? (ALL_SKINS.find((e) => e.id === ware.id) ?? null) : null;
      const pet = ware.kind === 'pet' ? (petById(ware.id) ?? null) : null;
      if (!skin && !pet) continue;
      const scale = this.cardW >= 56 ? 2 : 1;
      const face = skin ? skinFace(this.scene, skin, this.cardW, this.cardH, scale, undefined, true) : petFace(this.scene, pet!, this.cardW, this.cardH, scale + 0.5, false, true);
      const coin = this.scene.add.image(0, 0, 'candy_s').setOrigin(0);
      const price = pixelText(this.scene, 0, 0, '', CANDY);
      const box = this.scene.add.container(0, 0, [...face.parts, coin, price]);
      this.add(box);
      this.wares.push({ ware, skin, pet, box, price, coin });
    }
  }

  refresh(): void {
    if (!this.usedW) return;
    const s = this.season;
    const have = s ? collection.candy(s.id) : 0;
    this.candyText.setText(`${have}`);
    this.candyText.setX(Math.round(this.usedW - 6 - this.candyText.width));
    if (s) {
      const d = daysLeft(s);
      this.label.setText(`${s.name}  ${d === 1 ? 'last day!' : `${d} days left`}`.toUpperCase());
    }
    // Each card's price, or that it's owned.
    for (const wr of this.wares) {
      const owned = ownsWare(wr.ware);
      const y = Math.round(this.cardH / 2 + 3);
      wr.coin.setVisible(!owned);
      wr.price.setText(owned ? 'OWNED' : `${wr.ware.price}`).setTint(owned ? GOOD : have >= wr.ware.price ? CANDY : SOFT);
      const w = wr.price.width + (owned ? 0 : 11);
      const x = Math.round(-w / 2);
      wr.coin.setPosition(x, y + 1);
      wr.price.setPosition(owned ? x : x + 11, y);
    }
    this.drawMarks();
    this.drawInfo();
  }

  update(dt: number): void {
    this.time += dt;
    const f = `f${Math.floor(this.time / 200) % WICK_FRAMES}`;
    if (this.portrait.frame.name !== f) {
      this.portrait.setFrame(f);
      this.portraitGlow.setFrame(f);
    }
    // The picked card's frame shimmers.
    if (Math.floor(this.time / 120) % 2 !== this.marks.getData('blink')) this.drawMarks();
  }

  // ---- Input, in the view's coordinates ----

  pointerDown(x: number, y: number): void {
    this.press = { x, y, moved: false, button: this.button.visible && !this.button.dimmed && this.button.hit(x, y) };
    if (this.press.button) this.button.press(true);
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) p.moved = true;
    if (p.button && !this.button.hit(x, y)) this.button.press(false);
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.button) {
      this.button.press(false);
      if (this.button.hit(x, y)) this.act();
      return;
    }
    if (p.moved) return;
    const i = this.wares.findIndex((wr) => {
      const [rx, ry, rw, rh] = wr.box.getData('rect') as number[];
      return x >= rx && y >= ry && x < rx + rw && y < ry + rh;
    });
    if (i < 0 || i === this.picked) return;
    this.picked = i;
    sound.cardFlip(0);
    this.refresh();
  }

  wheel(_dy: number): void {}

  /** The button: buy the picked ware, or wear it, or take it along. */
  private act(): void {
    const s = this.season;
    const wr = this.wares[this.picked];
    if (!s || !wr) return;
    if (!ownsWare(wr.ware)) {
      if (!buyWare(s, wr.ware)) return;
      sound.gemSpend();
      sound.wishBurst(RARITY_TIER[(wr.skin?.rarity ?? wr.pet?.rarity) ?? 'rare']);
      this.pop('YOURS!', CANDY);
      return;
    }
    if (wr.skin) {
      setLook(wr.skin.cls, wr.skin.type, wr.skin.skin);
      sound.cardFlip(1);
      this.pop('WORN!', GOLD);
    } else if (wr.pet) {
      collection.pet = wr.pet.id;
      sound.cardFlip(1);
      this.pop('ALONG!', GOLD);
    }
    this.refresh();
  }

  /** Words rising off the picked card for a moment. */
  private pop(text: string, tint: number): void {
    const wr = this.wares[this.picked];
    if (!wr) return;
    const f = this.flash;
    this.scene.tweens.killTweensOf(f);
    f.setText(text).setTint(tint).setAlpha(1);
    const x = Math.round(wr.box.x - f.width / 2);
    const y = Math.round(wr.box.y - 8);
    f.setPosition(x, y);
    this.scene.tweens.add({ targets: f, y: y - 18, alpha: 0, duration: 900, ease: 'Sine.Out' });
  }

  // ---- Drawing ----

  /** A frame round the picked card, in its rarity's colour, flickering like candlelight. */
  private drawMarks(): void {
    const g = this.marks.clear();
    const wr = this.wares[this.picked];
    const blink = Math.floor(this.time / 120) % 2;
    g.setData('blink', blink);
    if (!wr) return;
    const [x, y] = wr.box.getData('rect') as number[];
    const tint = RARITY_INFO[(wr.skin?.rarity ?? wr.pet?.rarity) ?? 'rare'].tint;
    g.lineStyle(1, CANDY, 1).strokeRect(x - 1.5, y - 1.5, this.cardW + 3, this.cardH + 3);
    g.lineStyle(1, tint, blink ? 0.7 : 0.45).strokeRect(x - 2.5, y - 2.5, this.cardW + 5, this.cardH + 5);
  }

  /** The picked ware's name and what it is, and its button, along the bottom. */
  private drawInfo(): void {
    const wr = this.wares[this.picked];
    const y0 = this.usedH - INFO_H + 4;
    const s = this.season;
    this.wareName.setVisible(!!wr);
    this.what.setVisible(!!wr);
    this.button.setVisible(!!wr && !!s);
    if (!wr || !s) return;
    const rarity = (wr.skin?.rarity ?? wr.pet?.rarity) ?? 'rare';
    const info = RARITY_INFO[rarity];
    const textW = this.usedW - BTN_W - 8;
    const fit = (t: string) => (t.length * CH > textW ? `${t.slice(0, Math.max(3, Math.floor(textW / CH) - 1))}.` : t);
    if (wr.skin) {
      const e = wr.skin;
      this.wareName.setText(fit(`${e.skin.name}  ${info.name}`.toUpperCase())).setTint(info.tint);
      this.what.setText(fit(`${e.type.name} skin. ${e.type.role}`.toUpperCase()));
    } else if (wr.pet) {
      this.wareName.setText(fit(`${wr.pet.name}  ${info.name}`.toUpperCase())).setTint(info.tint);
      this.what.setText(fit(`Companion. ${wr.pet.perk}`.toUpperCase()));
    }
    this.wareName.setPosition(0, y0);
    this.what.setPosition(0, y0 + LINE + 2);

    const owned = ownsWare(wr.ware);
    const have = collection.candy(s.id);
    let label: string;
    let gold = false;
    let dim = false;
    if (!owned) {
      const short = have < wr.ware.price;
      label = short ? `Need ${wr.ware.price - have} more` : `Buy: ${wr.ware.price} candy`;
      gold = !short;
      dim = short;
    } else if (wr.skin) {
      const on = lookOf(wr.skin.cls).skin === wr.skin.skin;
      label = on ? 'Worn' : 'Wear it';
      gold = !on;
      dim = on;
    } else {
      const along = collection.pet === wr.pet?.id;
      label = along ? 'Coming along' : 'Take along';
      gold = !along;
      dim = along;
    }
    this.button.set(label, BTN_W, BTN_H, gold).dim(dim);
    this.button.setPosition(this.usedW - BTN_W, y0 + 2);
    this.wareName.setTint(owned ? GOOD : info.tint);
    if (!owned && have < wr.ware.price) this.what.setTint(DIM);
  }
}

/** A rarity as the wish sounds count it. */
const RARITY_TIER = { rare: 0, epic: 1, legendary: 2 } as const;
