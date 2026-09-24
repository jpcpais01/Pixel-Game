// Pixel-art panels and buttons for the menus. Panel textures are painted
// on demand for each size and cached by key.

import Phaser from 'phaser';
import { Bitmap, bayer, mix } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';

export interface PanelStyle {
  top: RGB;
  bottom: RGB;
  alpha: number;
  border: RGB;
  borderLit: RGB;
  outer: RGB;
}

const OUTER = hex('#0b0818');

export const PANEL: PanelStyle = { top: hex('#2a2150'), bottom: hex('#140f2a'), alpha: 0.9, border: hex('#43356e'), borderLit: hex('#6b5aa6'), outer: OUTER };
export const PANEL_PICKED: PanelStyle = { ...PANEL, top: hex('#33296a'), border: hex('#b8742c'), borderLit: hex('#ffe08a') };
export const PANEL_INSET: PanelStyle = { top: hex('#0f0b22'), bottom: hex('#231a46'), alpha: 0.95, border: hex('#241c44'), borderLit: hex('#1a1434'), outer: OUTER };
export const BUTTON_GOLD: [PanelStyle, PanelStyle] = [
  { top: hex('#5a50c8'), bottom: hex('#2a2270'), alpha: 1, border: hex('#c07f30'), borderLit: hex('#ffe89a'), outer: hex('#120e1f') },
  { top: hex('#231c5e'), bottom: hex('#3a31a0'), alpha: 1, border: hex('#8a4e22'), borderLit: hex('#d69a3a'), outer: hex('#120e1f') },
];
export const BUTTON_PLAIN: [PanelStyle, PanelStyle] = [
  { top: hex('#2e2658'), bottom: hex('#191434'), alpha: 0.95, border: hex('#4a3a78'), borderLit: hex('#8a78c8'), outer: OUTER },
  { top: hex('#15102c'), bottom: hex('#221a46'), alpha: 0.95, border: hex('#33285a'), borderLit: hex('#5a4a90'), outer: OUTER },
];

/** A panel with cut corners, a dark outline, a two-tone border and a dithered fill. */
export function panelTexture(scene: Phaser.Scene, name: string, w: number, h: number, st: PanelStyle): string {
  const key = `panel_${name}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey === 0) continue;
      if (ex === 0 || ey === 0) b.set(x, y, st.outer);
      else if (ex === 1 || ey === 1) b.set(x, y, y === 1 || x === 1 ? st.borderLit : st.border);
      else {
        const f = (y - 2) / Math.max(1, h - 5);
        const q = Math.min(1, Math.floor(f * 4 + bayer(x, y)) / 4);
        let c = mix(st.top, st.bottom, q);
        if (y === 2) c = mix(c, st.borderLit, 0.3);
        b.set(x, y, c, Math.round(st.alpha * 255));
      }
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** Text in the pixel font, positioned by its top-left corner. */
export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, tint = 0xfff4d6, scale = 1): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(Math.round(x), Math.round(y), 'pixel', text.toUpperCase()).setLetterSpacing(-1).setScale(scale).setTint(tint).setOrigin(0);
}

/** A pressable pixel button; `onClick` fires when a press is released on it. */
export class PixelButton extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH: number;
  private bg: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.BitmapText;
  private keys: [string, string];
  private down = false;

  constructor(scene: Phaser.Scene, text: string, w: number, h: number, styles: [PanelStyle, PanelStyle], name: string, onClick: () => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.boxH = h;
    this.keys = [panelTexture(scene, name, w, h, styles[0]), panelTexture(scene, `${name}_down`, w, h, styles[1])];
    this.bg = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    this.label = pixelText(scene, 0, 0, text);
    this.add([this.bg, this.label]);
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

  setEnabled(on: boolean): this {
    if (this.bg.input) this.bg.input.enabled = on;
    if (!on && this.down) this.press(false);
    return this;
  }

  /** Place the button by its top-left corner, on whole art pixels. */
  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  private press(down: boolean): void {
    this.down = down;
    this.bg.setTexture(this.keys[down ? 1 : 0]);
    this.layoutLabel();
  }

  private layoutLabel(): void {
    this.label.setPosition(Math.round((this.boxW - this.label.width) / 2), Math.round((this.boxH - this.label.height) / 2) + (this.down ? 1 : 0));
    this.label.setTint(this.down ? 0xd8c8a0 : 0xfff4d6);
  }
}
