// The shop's jewelled buttons: a slab of coloured glass in a metal rim (see
// art/wishArt.ts jewelButton), its label on top and, under it, a gem and a
// price. Pressing sinks the glass and the words a pixel.

import Phaser from 'phaser';
import { addBitmap } from '../art/shop';
import { jewelButton, type JewelStyle } from '../art/wishArt';
import { pixelText } from './widgets';

const GEM_CYAN = 0x9ff6ff;
const SHORT = 0xff8a8a;

export class JewelButton extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH: number;
  private bg: Phaser.GameObjects.Image;
  private keys: [string, string];
  private label: Phaser.GameObjects.BitmapText;
  private gem: Phaser.GameObjects.Image | null = null;
  private price: Phaser.GameObjects.BitmapText | null = null;
  private down = false;

  constructor(scene: Phaser.Scene, text: string, cost: number | null, w: number, h: number, style: JewelStyle, name: string, onClick: () => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.boxH = h;
    this.keys = [addBitmap(scene, `jewel_${name}_${w}x${h}`, jewelButton(w, h, style, false)), addBitmap(scene, `jewel_${name}_${w}x${h}_down`, jewelButton(w, h, style, true))];
    this.bg = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    this.label = pixelText(scene, 0, 0, text);
    this.add([this.bg, this.label]);
    if (cost !== null) {
      this.gem = scene.add.image(0, 0, 'gem_s').setOrigin(0);
      this.price = pixelText(scene, 0, 0, `${cost}`, GEM_CYAN);
      this.add([this.gem, this.price]);
    }
    scene.add.existing(this);
    this.layoutLabel();
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.press(true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.press(false));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!this.down) return;
      this.press(false);
      onClick();
    });
  }

  /** A new price, red when the gems fall short. */
  setCost(cost: number, affordable: boolean): this {
    this.price?.setText(`${cost}`).setTint(affordable ? GEM_CYAN : SHORT);
    this.gem?.setAlpha(affordable ? 1 : 0.6);
    this.layoutLabel();
    return this;
  }

  setEnabled(on: boolean): this {
    if (this.bg.input) this.bg.input.enabled = on;
    if (!on && this.down) this.press(false);
    return this;
  }

  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  private press(down: boolean): void {
    this.down = down;
    this.bg.setTexture(this.keys[down ? 1 : 0]);
    this.layoutLabel();
  }

  private layoutLabel(): void {
    const push = this.down ? 1 : 0;
    const two = !!this.price;
    const ly = two ? Math.round(this.boxH / 2 - 9) : Math.round((this.boxH - this.label.height) / 2);
    this.label.setPosition(Math.round((this.boxW - this.label.width) / 2), ly + push).setTint(this.down ? 0xd8c8a0 : 0xfff4d6);
    if (this.gem && this.price) {
      const w = this.gem.width + 2 + this.price.width;
      const x = Math.round((this.boxW - w) / 2);
      const y = Math.round(this.boxH / 2 + 1) + push;
      this.gem.setPosition(x, y + 1);
      this.price.setPosition(x + this.gem.width + 2, y);
    }
  }
}
