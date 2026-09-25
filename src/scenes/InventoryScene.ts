import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { collection } from '../game/collection';
import { account, cloudReady, logOut, onAccount } from '../game/cloud';
import { openAccountForm } from '../ui/accountForm';
import { InventoryView } from '../ui/inventoryView';
import { BUTTON_PLAIN, PixelButton, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

const MARGIN = 8;

/**
 * The Inventory page: the shared inventory view (worn gear, set totals,
 * every item with its stats; see ui/inventoryView.ts) over the home screen's
 * backdrop, with Back and the account button along the bottom. Logging in
 * makes pickups and worn gear follow the player to other devices.
 */
export class InventoryScene extends Phaser.Scene {
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private who!: Phaser.GameObjects.BitmapText;
  private view!: InventoryView;
  private back!: PixelButton;
  private accountBtn!: PixelButton;
  private leaving = false;
  private formOpen = false;

  constructor() {
    super('inventory');
  }

  create(): void {
    this.leaving = false;
    this.formOpen = false;
    this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 200 });

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.6).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Inventory *', 0xf4cf6a);
    this.who = pixelText(this, 0, 0, '', 0x9a90c8);
    this.view = new InventoryView(this, { potions: true });
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'back', () => this.goBack());
    this.accountBtn = new PixelButton(this, 'Log in', 56, 18, BUTTON_PLAIN, 'inv_account', () => this.tapAccount());
    this.accountBtn.setVisible(cloudReady());

    this.bindInput();
    this.input.keyboard?.on('keydown-ESC', () => this.goBack());

    const unwatch = collection.watch(() => this.refresh());
    const unAccount = onAccount(() => this.refresh());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unwatch();
      unAccount();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.refresh();
    this.layout();
  }

  update(_t: number, dt: number): void {
    this.view.update(dt);
  }

  /** The account line along the bottom. */
  private refresh(): void {
    const a = account();
    const st = collection.status;
    let who = cloudReady() ? 'Guest: saved on this device' : 'Saved on this device';
    if (a) who = `${a.username}: ${st === 'loading' ? 'loading...' : st === 'saving' ? 'saving...' : st === 'error' ? 'offline, will retry' : 'saved'}`;
    this.who.setText(who.toUpperCase());
    this.accountBtn.setText(a ? 'Log out' : 'Log in');
    this.placeWho();
  }

  private tapAccount(): void {
    if (this.formOpen) return;
    if (account()) {
      collection.flush();
      logOut();
      return;
    }
    this.formOpen = true;
    openAccountForm(() => {
      this.formOpen = false;
      this.refresh();
    });
  }

  /** Pointer events go to the view, in its own coordinates. */
  private bindInput(): void {
    const at = (p: Phaser.Input.Pointer): [number, number] => {
      const z = this.cameras.main.zoom;
      return [p.x / z - this.view.x, p.y / z - this.view.y];
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.formOpen || this.leaving) return;
      const [x, y] = at(p);
      if (this.view.contains(x, y)) this.view.pointerDown(x, y);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.view.pointerMove(...at(p));
    });
    const up = (p: Phaser.Input.Pointer) => this.view.pointerUp(...at(p));
    this.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.view.wheel(dy));
  }

  private layout(): void {
    const { width, height } = this.scale;
    const z = menuZoom(width, height);
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);

    const headerY = Math.ceil(fpsBottom() / z) + 4;
    const buttonsY = Math.round(vh - 26);
    this.header.setPosition(Math.round((vw - this.header.width) / 2), headerY);
    this.back.place(MARGIN, buttonsY + 1);
    this.accountBtn.place(vw - MARGIN - this.accountBtn.boxW, buttonsY + 1);
    this.placeWho();

    const top = headerY + this.header.height + 4;
    this.view.setPosition(MARGIN, top);
    this.view.resize(Math.floor(vw - MARGIN * 2), buttonsY - 4 - top);
  }

  private placeWho(): void {
    const { width, height } = this.scale;
    const z = menuZoom(width, height);
    const buttonsY = Math.round(height / z - 26);
    this.who.setPosition(Math.round(this.accountBtn.x - 6 - this.who.width), buttonsY + 6);
  }

  private goBack(): void {
    if (this.leaving || this.formOpen) return;
    this.leaving = true;
    collection.flush();
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }
}
