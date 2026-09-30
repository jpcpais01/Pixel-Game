import Phaser from 'phaser';
import { sound } from '../audio';
import { menuZoom } from '../game/display';
import { omenHud, type OmenCall, type OmenDef, type TradeOffer } from '../game/omens';
import { RARITY, statLines } from '../game/gear';
import { collection } from '../game/collection';
import { BUTTON_GOLD, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';

/** The chip at the top while an omen lasts. */
const CHIP_W = 112;
const CHIP_H = 24;
/** The merchant's card. */
const CARD_W = 128;
const CARD_H = 76;
/** How long a banner stays up: the big one an omen opens with, and the small lines. */
const BANNER_TIME = 2600;
const CALL_TIME = 1800;
const TEXT = 0xe8e0ff;
const DIM = 0x8a80b8;

/**
 * The omens' overlay, over the world in the arenas they come to: a banner as
 * each omen comes (its sigil, its name and what it means, ruled above and
 * below in its colour), smaller lines as things happen and as it passes, a
 * chip at the top with its name, how it goes and a bar, and the Wandering
 * Merchant's card while the hero stands at his rug. It reads omenHud
 * (game/omens.ts) and hands a purchase back.
 */
export class OmenScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private call: Phaser.GameObjects.Container | null = null;
  private callT = 0;
  private chip!: Phaser.GameObjects.Container;
  private chipIcon!: Phaser.GameObjects.Image;
  private chipName!: Phaser.GameObjects.BitmapText;
  private chipLabel!: Phaser.GameObjects.BitmapText;
  private chipBar!: Phaser.GameObjects.Graphics;
  private chipDef: OmenDef | null = null;
  private card: Phaser.GameObjects.Container | null = null;
  private cardOffer: TradeOffer | null = null;
  private cardState = '';
  private buy: PixelButton | null = null;
  private priceText: Phaser.GameObjects.BitmapText | null = null;

  constructor() {
    super('omen');
  }

  create(): void {
    this.call = null;
    this.card = null;
    this.cardOffer = null;
    this.cardState = '';
    this.chipDef = null;
    this.buy = null;
    this.priceText = null;
    this.cameras.main.setOrigin(0, 0);

    const panel = this.add.image(0, 0, panelTexture(this, 'omen_chip', CHIP_W, CHIP_H, PANEL)).setOrigin(0);
    this.chipIcon = this.add.image(4, 4, '__DEFAULT').setOrigin(0);
    this.chipName = pixelText(this, 23, 4, '');
    this.chipLabel = pixelText(this, 23, 12, '', TEXT);
    this.chipBar = this.add.graphics();
    this.chip = this.add.container(0, 0, [panel, this.chipIcon, this.chipName, this.chipLabel, this.chipBar]).setVisible(false);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, dt: number): void {
    if (!omenHud.active) {
      this.chip.setVisible(false);
      this.showCard(null);
      return;
    }
    this.updateChip();
    this.updateCalls(dt);
    this.showCard(omenHud.trade);
    this.updateCard();
  }

  // ---------------------------------------------------------------- The chip

  private updateChip(): void {
    const def = omenHud.current;
    if (def !== this.chipDef) {
      this.chipDef = def;
      if (def) {
        this.chipIcon.setTexture(`omen_icon_${def.id}`);
        this.chipName.setText(def.name.toUpperCase()).setTint(def.tint);
        this.chip.setAlpha(0);
        this.tweens.add({ targets: this.chip, alpha: 1, duration: 300, delay: 600 });
      }
    }
    this.chip.setVisible(!!def);
    if (!def) return;
    this.chipLabel.setText(omenHud.label.toUpperCase());
    const w = CHIP_W - 27;
    const fill = Math.round(w * Phaser.Math.Clamp(omenHud.bar, 0, 1));
    const g = this.chipBar.clear();
    g.fillStyle(0x07061a).fillRect(22, 19, w + 2, 3);
    g.fillStyle(0x1e1838).fillRect(23, 20, w, 1);
    g.fillStyle(def.tint).fillRect(23, 20, fill, 1);
    this.placeChip();
  }

  private placeChip(): void {
    const top = Math.ceil(fpsBottom() / this.z) + 3;
    this.chip.setPosition(Math.round((this.vw - CHIP_W) / 2), top);
  }

  // ---------------------------------------------------------------- Banners

  private updateCalls(dt: number): void {
    if (this.call) {
      this.callT -= dt;
      if (this.callT <= 0) {
        const old = this.call;
        this.call = null;
        this.tweens.add({ targets: old, alpha: 0, y: old.y - 6, duration: 320, onComplete: () => old.destroy() });
      }
    }
    if (!this.call && omenHud.calls.length) this.showCall(omenHud.calls.shift()!);
  }

  /**
   * An omen's banner: its sigil in a glow of its colour, the name large, a
   * rule either side in its colour, and what it means beneath. A plain line
   * (an imp caught, the fog lifting) is the name and the line alone.
   */
  private showCall(c: OmenCall): void {
    const parts: Phaser.GameObjects.GameObject[] = [];
    let y = 0;
    if (c.icon) {
      const glow = this.add.image(0, 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(c.tint).setScale(1.6).setAlpha(0.45);
      const icon = this.add.image(0, 14, `omen_icon_${c.icon}`).setScale(2);
      this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.6 }, scale: { from: 1.4, to: 1.8 }, duration: 700, yoyo: true, repeat: -1 });
      parts.push(glow, icon);
      y = 34;
    }
    const title = pixelText(this, 0, y, c.title, c.tint, 2);
    title.setX(Math.round(-title.width / 2));
    parts.push(title);
    if (c.icon) {
      // Rules either side of the name, bright at the name and fading outward.
      const g = this.add.graphics();
      const half = Math.round(title.width / 2) + 6;
      for (let i = 0; i < 28; i++) {
        const a = 1 - i / 28;
        g.fillStyle(c.tint, a * 0.9).fillRect(half + i, y + 6, 1, 1).fillRect(-half - i - 1, y + 6, 1, 1);
      }
      g.fillStyle(0xffffff, 0.9).fillRect(half - 2, y + 5, 1, 3).fillRect(-half + 1, y + 5, 1, 3);
      parts.push(g);
    }
    if (c.sub) {
      const s = pixelText(this, 0, y + 17, c.sub, TEXT);
      s.setX(Math.round(-s.width / 2));
      parts.push(s);
    }
    const box = this.add.container(Math.round(this.vw / 2), Math.round(this.vh * (c.icon ? 0.18 : 0.26)) + 4, parts).setAlpha(0);
    if (c.icon) {
      box.setScale(1.12);
      this.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 360, ease: 'Back.Out' });
    } else this.tweens.add({ targets: box, alpha: 1, y: box.y - 4, duration: 220 });
    this.call = box;
    this.callT = c.icon ? BANNER_TIME : CALL_TIME;
  }

  // ---------------------------------------------------------------- The merchant's card

  /** Show the card for `offer`, or take it away. */
  private showCard(offer: TradeOffer | null): void {
    if (offer === this.cardOffer) return;
    this.cardOffer = offer;
    const old = this.card;
    this.card = null;
    this.buy = null;
    this.priceText = null;
    this.cardState = '';
    if (old) this.tweens.add({ targets: old, alpha: 0, y: old.y + 6, duration: 200, onComplete: () => old.destroy() });
    if (!offer) return;
    const def = offer.def;
    const tint = RARITY[def.rarity].tint;
    const bg = this.add.image(0, 0, panelTexture(this, 'omen_trade', CARD_W, CARD_H, PANEL)).setOrigin(0);
    const glow = this.add.image(20, 22, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0.35).setScale(1.1);
    const icon = this.add.image(20, 22, def.icon);
    const head = pixelText(this, 38, 6, 'The merchant offers', DIM);
    const name = pixelText(this, 38, 15, def.name, tint);
    const rarity = pixelText(this, 38, 24, RARITY[def.rarity].name, tint).setAlpha(0.7);
    const stats = statLines(def.stats).slice(0, 2);
    const parts: Phaser.GameObjects.GameObject[] = [bg, glow, icon, head, name, rarity];
    stats.forEach((line, i) => parts.push(pixelText(this, 8, 38 + i * 8, line, TEXT)));
    const dust = this.add.image(8, CARD_H - 20, 'dust_icon').setOrigin(0);
    this.priceText = pixelText(this, 8 + dust.width + 3, CARD_H - 17, `${offer.price}`, 0xe0ccff);
    this.buy = new PixelButton(this, 'Buy', 60, 18, BUTTON_GOLD, 'omen_buy', () => {
      if (offer.bought || collection.dust < offer.price) return;
      omenHud.buy = true;
      sound.cardFlip(0);
    }).place(CARD_W - 68, CARD_H - 24);
    parts.push(dust, this.priceText, this.buy);
    this.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
    this.card = this.add.container(0, 0, parts).setAlpha(0);
    this.tweens.add({ targets: this.card, alpha: 1, duration: 220 });
    this.placeCard();
    this.updateCard();
  }

  /** The button follows what the hero can do: buy, not afford it, or already bought. */
  private updateCard(): void {
    const offer = this.cardOffer;
    if (!offer || !this.buy || !this.priceText) return;
    const can = collection.dust >= offer.price;
    const state = offer.bought ? 'sold' : can ? 'buy' : 'poor';
    if (state === this.cardState) return;
    this.cardState = state;
    this.buy.setText(state === 'sold' ? 'Sold' : state === 'poor' ? 'Need dust' : 'Buy').setEnabled(state === 'buy').setAlpha(state === 'buy' ? 1 : 0.5);
        this.priceText.setTint(state === 'poor' ? 0xff9a8a : 0xe0ccff);
  }

  private placeCard(): void {
    // Low in the middle, clear of the hero and above the thumbs.
    this.card?.setPosition(Math.round((this.vw - CARD_W) / 2), Math.round(this.vh * 0.62));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    this.vw = width / this.z;
    this.vh = height / this.z;
    this.placeChip();
    this.placeCard();
    this.call?.setX(Math.round(this.vw / 2));
  }
}
