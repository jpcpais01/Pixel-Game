// The keepers on the HUD: when the hero walks up to Nyx or Tharn in the Rune
// Temple, or Brenna at the Forge, their counter opens over the room (see
// ui/keeperView.ts and ui/forgeView.ts), drawn in art pixels and scaled like
// the bag. A tap outside it, or its X, closes it.

import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { keeperCall, type Keeper } from '../game/keepers';
import { ForgeView } from './forgeView';
import { KeeperView } from './keeperView';
import { PANEL, panelTexture, pixelText } from './widgets';

const PAD = 7;
const CLOSE = 13;

export class KeeperHud {
  private root: Phaser.GameObjects.Container | null = null;
  private view: KeeperView | ForgeView | null = null;
  private frame: Phaser.GameObjects.Image | null = null;
  private closeBg: Phaser.GameObjects.Image | null = null;
  private sized = '';

  /** `onOpen` lets go of the controls held when a counter opens. */
  constructor(
    private scene: Phaser.Scene,
    private onOpen: () => void,
  ) {
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.view?.wheel(dy));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keeperCall.open = null;
      keeperCall.want = null;
    });
  }

  get open(): boolean {
    return !!this.root;
  }

  private show(keeper: Keeper): void {
    this.close();
    const scene = this.scene;
    this.frame = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.closeBg = scene.add.image(0, PAD - 3, '__DEFAULT').setOrigin(0);
    const x = pixelText(scene, 0, PAD - 1, 'X', 0xfff4d6);
    this.closeBg.setData('x', x);
    this.view = keeper === 'forge' ? new ForgeView(scene) : new KeeperView(scene, keeper);
    this.view.setPosition(PAD, PAD);
    this.root = scene.add.container(0, 0, [this.frame, this.view, this.closeBg, x]).setDepth(51);
    this.sized = '';
    keeperCall.open = keeper;
    this.onOpen();
  }

  close(): void {
    if (!this.root) return;
    this.root.destroy();
    this.root = this.view = this.frame = this.closeBg = null;
    keeperCall.open = null;
  }

  /** Size the counter to the screen, a step smaller than the menus like the bag, centred. */
  private place(): void {
    const { width, height } = this.scene.scale;
    const key = `${width} ${height}`;
    if (key === this.sized || !this.root || !this.view || !this.frame || !this.closeBg) return;
    this.sized = key;
    const menu = menuZoom(width, height);
    const z = menu >= 3 ? menu - 1 : menu;
    const vw = Math.floor(width / z);
    const vh = Math.floor(height / z);
    const h = Math.min(vh - 12, 236);
    this.view.resize(Math.min(vw - 12, 440) - PAD * 2, h - PAD * 2);
    const w = this.view.usedW + PAD * 2;
    this.frame.setTexture(panelTexture(this.scene, 'keeper_frame', w, h, PANEL));
    // The close button sits in the header's top right, left of the dust.
    this.closeBg.setTexture(panelTexture(this.scene, 'keeper_close', CLOSE, CLOSE, PANEL)).setX(w - PAD - CLOSE - 64);
    const x = this.closeBg.getData('x') as Phaser.GameObjects.BitmapText;
    x.setX(this.closeBg.x + Math.round((CLOSE - x.width) / 2));
    this.root.setScale(z).setPosition(Math.round((width - w * z) / 2), Math.round((height - h * z) / 2));
    this.root.setData('size', [w, h]);
  }

  private local(p: Phaser.Input.Pointer): [number, number] {
    const r = this.root!;
    return [(p.x - r.x) / r.scaleX, (p.y - r.y) / r.scaleX];
  }

  /** Handles a press; returns true when the counter took it. */
  pointerDown(p: Phaser.Input.Pointer): boolean {
    if (!this.root || !this.view || !this.closeBg) return false;
    const [x, y] = this.local(p);
    const [w, h] = (this.root.getData('size') as [number, number]) ?? [0, 0];
    const c = this.closeBg;
    const onClose = x >= c.x - 2 && x < c.x + CLOSE + 2 && y >= c.y - 2 && y < c.y + CLOSE + 2;
    // A press outside closes it and goes on to the controls, so a drag there walks away.
    if (x < 0 || y < 0 || x >= w || y >= h) {
      this.close();
      return false;
    }
    if (onClose) this.close();
    else this.view.pointerDown(x - this.view.x, y - this.view.y);
    return true;
  }

  pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.view || !p.isDown) return;
    const [x, y] = this.local(p);
    this.view.pointerMove(x - this.view.x, y - this.view.y);
  }

  pointerUp(p: Phaser.Input.Pointer): void {
    if (!this.view) return;
    const [x, y] = this.local(p);
    this.view.pointerUp(x - this.view.x, y - this.view.y);
  }

  update(dt: number): void {
    // The world called a keeper up.
    if (keeperCall.leave) {
      keeperCall.leave = false;
      this.close();
    }
    if (keeperCall.want) {
      const k = keeperCall.want;
      keeperCall.want = null;
      if (keeperCall.open !== k) this.show(k);
    }
    if (!this.root || !this.view) return;
    this.place();
    this.view.update(dt);
  }
}
