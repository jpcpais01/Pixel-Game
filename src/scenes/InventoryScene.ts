import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { collection } from '../game/collection';
import { account, cloudReady, logOut, onAccount } from '../game/cloud';
import { openAccountForm } from '../ui/accountForm';
import { InventoryView } from '../ui/inventoryView';
import { BUTTON_GOLD, BUTTON_PLAIN, PixelButton, pixelText } from '../ui/widgets';
import { SkinGallery } from '../ui/skinGallery';
import { PetGallery } from '../ui/petGallery';
import { CritterGallery } from '../ui/critterGallery';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

const MARGIN = 8;
const TAB_W = 56;
const TAB_H = 16;

type Page = 'gear' | 'skins' | 'pets' | 'critters';
const PAGES: Page[] = ['gear', 'skins', 'pets', 'critters'];
/** The Companions tab needs more room for its word. */
const TAB_WIDE = 70;

/**
 * The Inventory page, in three tabs over the home screen's backdrop: Gear (the
 * shared inventory view: worn gear, set totals, every item with its stats;
 * see ui/inventoryView.ts), Skins (every skin owned, as cards; see
 * ui/skinGallery.ts), Companions (ui/petGallery.ts) and Critters (jars on
 * shelves; ui/critterGallery.ts), with Back and the account button along the bottom. Logging in
 * makes pickups and worn gear follow the player to other devices.
 */
export class InventoryScene extends Phaser.Scene {
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private who!: Phaser.GameObjects.BitmapText;
  private view!: InventoryView;
  private gallery!: SkinGallery;
  private pets!: PetGallery;
  private critters!: CritterGallery;
  private page: Page = 'gear';
  /** Each tab as a lit button (open) and a plain one (closed). */
  private tabs!: Record<Page, [PixelButton, PixelButton]>;
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
    this.gallery = new SkinGallery(this);
    this.pets = new PetGallery(this);
    this.critters = new CritterGallery(this);
    const tab = (page: Page, label: string, w = TAB_W): [PixelButton, PixelButton] => [
      new PixelButton(this, label, w, TAB_H, BUTTON_GOLD, `inv_tab_${page}_on`, () => {}),
      new PixelButton(this, label, w, TAB_H, BUTTON_PLAIN, `inv_tab_${page}`, () => this.show(page)),
    ];
    this.tabs = { gear: tab('gear', 'Gear'), skins: tab('skins', 'Skins'), pets: tab('pets', 'Companions', TAB_WIDE), critters: tab('critters', 'Critters') };
    this.header.setVisible(false);
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
    this.page = 'gear';
    this.show('gear');
    this.refresh();
    this.layout();
  }

  /** Open a tab. */
  private show(page: Page): void {
    this.page = page;
    this.view.setVisible(page === 'gear');
    this.gallery.setVisible(page === 'skins');
    this.pets.setVisible(page === 'pets');
    this.critters.setVisible(page === 'critters');
    for (const p of PAGES) {
      this.tabs[p][0].setVisible(p === page);
      this.tabs[p][1].setVisible(p !== page).setEnabled(p !== page);
    }
    if (page === 'skins') this.gallery.refresh();
    if (page === 'pets') this.pets.refresh();
    if (page === 'critters') this.critters.refresh();
  }

  /** The open tab's view; both take pointer events alike. */
  private get active(): InventoryView | SkinGallery | PetGallery | CritterGallery {
    return this.page === 'gear' ? this.view : this.page === 'skins' ? this.gallery : this.page === 'pets' ? this.pets : this.critters;
  }

  update(t: number, dt: number): void {
    if (this.page === 'gear') this.view.update(dt);
    else if (this.page === 'skins') this.gallery.update(t);
    else if (this.page === 'pets') this.pets.update(t);
    else this.critters.update(t);
  }

  /** The account line along the bottom. */
  private refresh(): void {
    const a = account();
    const st = collection.status;
    let who = cloudReady() ? 'Guest: saved on this device' : 'Saved on this device';
    if (a) who = `${a.username}: ${st === 'loading' ? 'loading...' : st === 'saving' ? 'saving...' : st === 'error' ? 'offline, will retry' : 'saved'}`;
    this.who.setText(who.toUpperCase());
    this.gallery.refresh();
    this.pets.refresh();
    this.critters.refresh();
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
      return [p.x / z - this.active.x, p.y / z - this.active.y];
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.formOpen || this.leaving) return;
      const [x, y] = at(p);
      if (this.active.contains(x, y)) this.active.pointerDown(x, y);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.active.pointerMove(...at(p));
    });
    const up = (p: Phaser.Input.Pointer) => this.active.pointerUp(...at(p));
    this.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.active.wheel(dy));
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
    // The tabs side by side where the heading was.
    const tabsW = PAGES.reduce((w, p) => w + this.tabs[p][0].boxW, 0) + (PAGES.length - 1) * 4;
    let tx = Math.round((vw - tabsW) / 2);
    for (const p of PAGES) {
      for (const b of this.tabs[p]) b.place(tx, headerY - 4);
      tx += this.tabs[p][0].boxW + 4;
    }
    this.back.place(MARGIN, buttonsY + 1);
    this.accountBtn.place(vw - MARGIN - this.accountBtn.boxW, buttonsY + 1);
    this.placeWho();

    const top = headerY + TAB_H;
    this.view.setPosition(MARGIN, top);
    this.view.resize(Math.floor(vw - MARGIN * 2), buttonsY - 4 - top);
    this.gallery.setPosition(MARGIN, top);
    this.gallery.resize(Math.floor(vw - MARGIN * 2), buttonsY - 4 - top);
    this.pets.setPosition(MARGIN, top);
    this.pets.resize(Math.floor(vw - MARGIN * 2), buttonsY - 4 - top);
    this.critters.setPosition(MARGIN, top);
    this.critters.resize(Math.floor(vw - MARGIN * 2), buttonsY - 4 - top);
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
