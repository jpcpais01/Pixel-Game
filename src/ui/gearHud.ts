// The gear on the HUD: a chest button beside the pause button, the bag it
// opens (the same inventory as the Inventory page, so pieces can be swapped
// mid-run; see ui/inventoryView.ts), and a banner that slides in when a piece
// is picked up. The button and banner are drawn in device pixels; the bag is
// drawn in art pixels and scaled up to the menus' size.

import Phaser from 'phaser';
import { DPR as D, menuZoom } from '../game/display';
import { GEAR, RARITY, gear, statLines, type GearNews } from '../game/gear';
import { tileKey } from '../art/invTiles';
import { InventoryView } from './inventoryView';
import { PANEL, panelTexture, pixelText } from './widgets';

/** Banner: slide in, hold, fade out (ms). */
const BANNER_IN = 180;
const BANNER_TIME = 3200;
const BANNER_OUT = 400;
/** The bag's frame around the view, art pixels. */
const PAD = 6;
const TITLE_H = 16;
const CLOSE = 13;

const text = (scene: Phaser.Scene) => scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1);

export class GearHud {
  open = false;
  private button: Phaser.GameObjects.Graphics;
  private chest: Phaser.GameObjects.Image;
  private count: Phaser.GameObjects.BitmapText;
  /** Pieces picked up since the bag was last opened: a gold dot on the button. */
  private unseen = 0;
  private root: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.BitmapText;
  private closeBg: Phaser.GameObjects.Image;
  private closeX: Phaser.GameObjects.BitmapText;
  private view: InventoryView;
  private sized = '';
  private banner: Phaser.GameObjects.Container;
  private bannerBg: Phaser.GameObjects.Graphics;
  private bannerTile: Phaser.GameObjects.Image;
  private bannerIcon: Phaser.GameObjects.Image;
  private bannerName: Phaser.GameObjects.BitmapText;
  private bannerStats: Phaser.GameObjects.BitmapText;
  private bannerNote: Phaser.GameObjects.BitmapText;
  private showing: GearNews | null = null;
  private bannerT = 0;

  /** `onOpen` lets go of the controls held when the bag opens. */
  constructor(
    private scene: Phaser.Scene,
    private onOpen: () => void,
  ) {
    this.button = scene.add.graphics();
    this.chest = scene.add.image(0, 0, 'icon_chest');
    this.count = text(scene).setOrigin(1, 1).setTint(0xfff4d8);
    this.bannerBg = scene.add.graphics();
    this.bannerTile = scene.add.image(0, 0, tileKey('common'), 0);
    this.bannerIcon = scene.add.image(0, 0, GEAR[0].icon);
    this.bannerName = text(scene).setOrigin(0, 0);
    this.bannerStats = text(scene).setOrigin(0, 0).setTint(0xdfe6ff);
    this.bannerNote = text(scene).setOrigin(0, 0);
    this.banner = scene.add.container(0, 0, [this.bannerBg, this.bannerTile, this.bannerIcon, this.bannerName, this.bannerStats, this.bannerNote]).setVisible(false);

    this.frame = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.title = pixelText(scene, PAD, 5, 'Inventory', 0xf4cf6a);
    this.closeBg = scene.add.image(0, 3, '__DEFAULT').setOrigin(0);
    this.closeX = pixelText(scene, 0, 5, 'X', 0xfff4d6);
    this.view = new InventoryView(scene, { potions: false, maxCols: 6 });
    this.view.setPosition(PAD, TITLE_H);
    this.root = scene.add.container(0, 0, [this.frame, this.title, this.closeBg, this.closeX, this.view]).setVisible(false).setDepth(50);

    scene.input.keyboard?.on('keydown-I', () => this.toggle());
    scene.input.keyboard?.on('keydown-G', () => this.toggle());
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.open) this.view.wheel(dy);
    });
  }

  toggle(): void {
    this.open = !this.open;
    this.root.setVisible(this.open);
    if (this.open) {
      this.unseen = 0;
      this.sized = '';
      this.onOpen();
    }
  }

  /** The chest button: the pause button's size, just left of it. */
  private get buttonRect(): Phaser.Geom.Rectangle {
    const { width, height } = this.scene.scale;
    const s = Math.round(Math.max(34 * D, Math.min(width, height) * 0.075));
    const pad = 12 * D;
    return new Phaser.Geom.Rectangle(width - s * 3 - pad - 20 * D, pad, s, s);
  }

  /** Size the bag to the screen: art pixels at the menus' zoom, centred. */
  private place(): void {
    const { width, height } = this.scene.scale;
    const key = `${width} ${height}`;
    if (key === this.sized) return;
    this.sized = key;
    const z = menuZoom(width, height);
    const vw = Math.floor(width / z);
    const vh = Math.floor(height / z);
    // About four fifths of the screen, so the run stays in view around it.
    const h = Math.min(Math.round(vh * 0.8), 210);
    this.view.resize(Math.min(Math.round(vw * 0.8), 460) - PAD * 2, h - TITLE_H - PAD);
    const w = this.view.usedW + PAD * 2;
    this.frame.setTexture(panelTexture(this.scene, 'bag', w, h, PANEL));
    this.closeBg.setTexture(panelTexture(this.scene, 'bag_close', CLOSE, CLOSE, PANEL)).setX(w - PAD - CLOSE + 2);
    this.closeX.setX(this.closeBg.x + Math.round((CLOSE - this.closeX.width) / 2));
    this.root.setScale(z).setPosition(Math.round((width - w * z) / 2), Math.round((height - h * z) / 2));
    this.root.setData('size', [w, h]);
  }

  /** A pointer in the bag's art pixels. */
  private local(p: Phaser.Input.Pointer): [number, number] {
    const z = this.root.scaleX;
    return [(p.x - this.root.x) / z, (p.y - this.root.y) / z];
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
    const [x, y] = this.local(p);
    const [w, h] = this.root.getData('size') as [number, number];
    const c = this.closeBg;
    // A tap outside the bag, or on its X, closes it.
    if (x < 0 || y < 0 || x >= w || y >= h || (x >= c.x - 2 && y <= c.y + CLOSE + 2)) this.toggle();
    else this.view.pointerDown(x - this.view.x, y - this.view.y);
    return true;
  }

  pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.open || !p.isDown) return;
    const [x, y] = this.local(p);
    this.view.pointerMove(x - this.view.x, y - this.view.y);
  }

  pointerUp(p: Phaser.Input.Pointer): void {
    if (!this.open) return;
    const [x, y] = this.local(p);
    this.view.pointerUp(x - this.view.x, y - this.view.y);
  }

  update(dt: number): void {
    this.drawButton();
    if (this.open) {
      this.place();
      this.view.update(dt);
    }
    this.drawBanner(dt);
  }

  private drawButton(): void {
    const r = this.buttonRect;
    const state = `${r.x} ${r.y} ${r.width} ${this.open} ${gear.found.size} ${this.unseen > 0}`;
    if (this.button.getData('s') === state) return;
    this.button.setData('s', state);
    const g = this.button.clear();
    g.fillStyle(0x0a0c1c, this.open ? 0.62 : 0.42);
    g.fillRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
    g.lineStyle(2 * D, this.open ? 0xffd66b : 0xb8c4ff, 0.45);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
    if (this.unseen > 0 && !this.open) {
      // New pieces to look at.
      g.fillStyle(0x0a0c1c, 1);
      g.fillCircle(r.right - 2 * D, r.y + 2 * D, 5 * D);
      g.fillStyle(0xffd66b, 1);
      g.fillCircle(r.right - 2 * D, r.y + 2 * D, 3.5 * D);
    }
    this.chest.setPosition(Math.round(r.centerX), Math.round(r.centerY)).setScale(Math.max(1, Math.floor((r.width - 6 * D) / 16)));
    this.count
      .setText(gear.found.size ? `${gear.found.size}` : '')
      .setScale(Math.max(1, Math.floor(r.width / 34)))
      .setPosition(Math.round(r.right + 2 * D), Math.round(r.bottom + 3 * D));
  }

  /** Takes the next piece picked up and shows it under the buttons for a moment. */
  private drawBanner(dt: number): void {
    if (!this.showing && gear.news.length) {
      this.showing = gear.news.shift()!;
      this.bannerT = 0;
      if (!this.open) this.unseen++;
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

  private layoutBanner(news: GearNews): void {
    const def = news.def;
    const { width } = this.scene.scale;
    const btn = this.buttonRect;
    const ts = Math.max(1, Math.floor(btn.height / 24));
    const scale = Math.max(1, Math.floor((btn.height * 1.1) / 32));
    const icon = 36 * scale;
    const pad = Math.round(6 * D);
    const tint = RARITY[def.rarity].tint;
    this.bannerName.setText(def.name.toUpperCase()).setScale(ts).setTint(tint);
    this.bannerStats.setText(statLines(def.stats).join('  ')).setScale(ts);
    const touch = !this.scene.input.activePointer.wasTouch ? 'PRESS I' : 'TAP THE CHEST';
    this.bannerNote
      .setText(news.worn ? 'EQUIPPED' : `IN YOUR BAG: ${touch} TO SWAP`)
      .setScale(ts)
      .setTint(news.worn ? 0x8dff8a : 0xb8c4ff);
    const tw = Math.max(this.bannerName.width, this.bannerStats.width, this.bannerNote.width);
    const w = pad * 3 + icon + tw;
    const h = pad * 2 + icon;
    const x = Math.round((width - w) / 2);
    const y = Math.round(btn.bottom + 10 * D);
    const g = this.bannerBg.clear();
    g.fillStyle(0x0a0c1c, 0.72);
    g.fillRoundedRect(x, y, w, h, Math.round(6 * D));
    g.lineStyle(Math.round(2 * D), tint, 0.7);
    g.strokeRoundedRect(x, y, w, h, Math.round(6 * D));
    const cx = x + pad + icon / 2;
    this.bannerTile.setTexture(tileKey(def.rarity), 0).setScale(scale).setPosition(cx, y + h / 2);
    this.bannerIcon.setTexture(def.icon).setScale(scale).setPosition(cx, y + h / 2);
    const lineH = 10 * ts;
    const top = Math.round(y + h / 2 - lineH * 1.5 - D);
    this.bannerName.setPosition(x + pad * 2 + icon, top);
    this.bannerStats.setPosition(x + pad * 2 + icon, top + lineH + Math.round(D));
    this.bannerNote.setPosition(x + pad * 2 + icon, top + lineH * 2 + Math.round(2 * D));
  }
}
