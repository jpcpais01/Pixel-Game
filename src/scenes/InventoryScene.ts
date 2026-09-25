import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { collection, EQUIP_SLOTS } from '../game/collection';
import { account, cloudReady, logOut, onAccount } from '../game/cloud';
import { itemInfo } from '../game/itemInfo';
import { openAccountForm } from '../ui/accountForm';
import { BUTTON_PLAIN, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

// Square slots big enough for a 32x32 icon, and the gap between them.
const CELL = 36;
const GAP = 4;
const MARGIN = 8;
/** Space between the equipped block and the item grid. */
const SPLIT = 14;
const TAP_SLOP = 5;

/** One square: a panel, an icon, and a count in its corner. */
class Cell extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private icon: Phaser.GameObjects.Image;
  private num: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, onTap: () => void) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, panelTexture(scene, 'inv_cell', CELL, CELL, PANEL_INSET)).setOrigin(0);
    this.icon = scene.add.image(CELL / 2, CELL / 2, '__DEFAULT').setVisible(false);
    this.num = pixelText(scene, 0, 0, '', 0xfff4d6);
    this.add([this.bg, this.icon, this.num]);
    scene.add.existing(this);
    let pressed = false;
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => (pressed = true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (pressed = false));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (pressed && p.getDistance() / scene.cameras.main.zoom <= TAP_SLOP) onTap();
      pressed = false;
    });
  }

  show(id: string | null, count: number, lit: boolean): this {
    this.bg.setTexture(panelTexture(this.scene, lit ? 'inv_cell_lit' : 'inv_cell', CELL, CELL, lit ? PANEL_PICKED : PANEL_INSET));
    const info = id ? itemInfo(id) : null;
    if (info && this.scene.textures.exists(info.icon)) {
      const src = this.scene.textures.get(info.icon).getSourceImage();
      // Small icons at a whole multiple, so they stay crisp.
      const scale = Math.max(1, Math.floor((CELL - 4) / Math.max(src.width, src.height)));
      this.icon.setTexture(info.icon).setScale(scale).setVisible(true);
    } else this.icon.setVisible(false);
    this.num.setText(count > 1 ? String(count) : '');
    this.num.setPosition(CELL - 3 - this.num.width, CELL - 3 - this.num.height);
    return this;
  }
}

/**
 * Everything the player has picked up, and the six items they keep
 * equipped. Opens over the home screen's backdrop. Tap an item to equip it
 * (or take it off again); tap an equipped slot to empty it. The account
 * button logs in, so pickups follow the player to other devices.
 */
export class InventoryScene extends Phaser.Scene {
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private equipLabel!: Phaser.GameObjects.BitmapText;
  private itemsLabel!: Phaser.GameObjects.BitmapText;
  private info!: Phaser.GameObjects.BitmapText;
  private detail!: Phaser.GameObjects.BitmapText;
  private who!: Phaser.GameObjects.BitmapText;
  private emptyNote!: Phaser.GameObjects.BitmapText;
  private slots: Cell[] = [];
  private cells: Cell[] = [];
  private back!: PixelButton;
  private accountBtn!: PixelButton;
  private leaving = false;
  /** Grid placement, in art pixels, and how far it's scrolled. */
  private grid = { x: 0, y: 0, h: 0, cols: 1 };
  private scroll = 0;
  private maxScroll = 0;
  private drag: { y: number; scroll: number } | null = null;
  private picked: string | null = null;
  private formOpen = false;

  constructor() {
    super('inventory');
  }

  create(): void {
    this.leaving = false;
    this.formOpen = false;
    this.picked = null;
    this.scroll = 0;
    this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 200 });

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.55).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Inventory *', 0xf4cf6a);
    this.equipLabel = pixelText(this, 0, 0, 'Equipped', 0x9a90c8);
    this.itemsLabel = pixelText(this, 0, 0, 'Items', 0x9a90c8);
    this.info = pixelText(this, 0, 0, '', 0xfff4d6);
    this.detail = pixelText(this, 0, 0, '', 0x9a90c8);
    this.who = pixelText(this, 0, 0, '', 0x9a90c8);
    this.emptyNote = pixelText(this, 0, 0, 'Nothing yet. Monsters drop gear and potions.', 0x7c82b8);
    this.slots = [];
    for (let i = 0; i < EQUIP_SLOTS; i++) this.slots.push(new Cell(this, () => this.tapSlot(i)));
    this.cells = [];
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'back', () => this.goBack());
    this.accountBtn = new PixelButton(this, 'Log in', 56, 18, BUTTON_PLAIN, 'inv_account', () => this.tapAccount());
    this.accountBtn.setVisible(cloudReady());

    this.bindScrolling();
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.goBack());

    const unwatch = collection.watch(() => this.refresh());
    const unAccount = onAccount(() => this.refresh());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unwatch();
      unAccount();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.refresh();
  }

  /** Redraw the slots and grid from the collection. */
  private refresh(): void {
    const owned = this.order();
    while (this.cells.length < owned.length) {
      const cell = new Cell(this, () => this.tapItem(cell.getData('id')));
      this.cells.push(cell);
    }
    this.cells.forEach((c, i) => {
      const id = owned[i] ?? null;
      c.setData('id', id).setVisible(!!id);
      if (id) c.show(id, collection.count(id), collection.isEquipped(id));
    });
    this.slots.forEach((s, i) => {
      const id = collection.data.equipped[i];
      s.show(id, 0, !!id);
    });
    this.emptyNote.setVisible(owned.length === 0);

    const a = account();
    const st = collection.status;
    let who = cloudReady() ? 'Guest: saved on this device' : 'Saved on this device';
    if (a) who = `${a.username}: ${st === 'loading' ? 'loading...' : st === 'saving' ? 'saving...' : st === 'error' ? 'offline, will retry' : 'saved'}`;
    this.who.setText(who.toUpperCase());
    this.accountBtn.setText(a ? 'Log out' : 'Log in');
    this.showInfo();
    this.layout();
  }

  /** Gear first (it's what gets equipped), then potions, each in the order found. */
  private order(): string[] {
    const ids = collection.owned();
    return [...ids.filter((id) => itemInfo(id).equippable), ...ids.filter((id) => !itemInfo(id).equippable)];
  }

  private showInfo(msg?: string): void {
    const id = this.picked;
    if (!msg && id && collection.count(id)) {
      const info = itemInfo(id);
      const n = collection.count(id);
      this.info.setText(`${info.name}${n > 1 ? ` x${n}` : ''}${collection.isEquipped(id) ? '  (equipped)' : ''}`.toUpperCase()).setTint(info.tint);
      this.detail.setText(info.detail.toUpperCase());
      return;
    }
    this.info.setText((msg ?? 'Tap gear to equip it').toUpperCase()).setTint(0xfff4d6);
    this.detail.setText(msg ? '' : 'Equipped gear counts from the start of every run'.toUpperCase());
  }

  private tapItem(id: string | null): void {
    if (!id || this.formOpen) return;
    this.picked = id;
    if (!itemInfo(id).equippable) return this.showInfo();
    const at = collection.data.equipped.indexOf(id);
    if (at >= 0) collection.unequip(at);
    else collection.equip(id);
  }

  private tapSlot(i: number): void {
    if (this.formOpen) return;
    const id = collection.data.equipped[i];
    if (!id) return this.showInfo('Tap a piece of gear to equip it');
    this.picked = id;
    collection.unequip(i);
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

  private bindScrolling(): void {
    const z = () => this.cameras.main.zoom;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      const x = p.x / z();
      const y = p.y / z();
      const g = this.grid;
      if (this.maxScroll <= 0 || x < g.x - GAP || y < g.y || y > g.y + g.h) return;
      this.drag = { y: p.y, scroll: this.scroll };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      this.setScroll(this.drag.scroll - (p.y - this.drag.y) / z());
    });
    const release = () => (this.drag = null);
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.setScroll(this.scroll + dy / z());
    });
  }

  /** Scroll the grid; rows that don't fully fit the view hide rather than get clipped. */
  private setScroll(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, Math.max(0, this.maxScroll));
    const g = this.grid;
    const owned = this.order().length;
    this.cells.forEach((c, i) => {
      if (i >= owned) return;
      const y = g.y + Math.floor(i / g.cols) * (CELL + GAP) - Math.round(this.scroll);
      c.setPosition(g.x + (i % g.cols) * (CELL + GAP), y);
      c.setVisible(y >= g.y - 1 && y + CELL <= g.y + g.h + 1);
    });
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
    this.who.setPosition(Math.round(this.accountBtn.x - 6 - this.who.width), buttonsY + 6);
    const infoY = buttonsY - 20;

    const top = headerY + this.header.height + 6;
    const labelH = 11;
    const areaH = infoY - 6 - top - labelH;
    // Equipped slots in two columns of three, or three columns of two on short screens.
    const eqCols = areaH >= 3 * CELL + 2 * GAP ? 2 : 3;
    const eqW = eqCols * CELL + (eqCols - 1) * GAP;
    const cols = Math.max(1, Math.min(10, Math.floor((vw - MARGIN * 2 - eqW - SPLIT + GAP) / (CELL + GAP))));
    const gridW = cols * CELL + (cols - 1) * GAP;
    const x0 = Math.round((vw - (eqW + SPLIT + gridW)) / 2);
    const y0 = top + labelH;

    this.equipLabel.setPosition(x0, top);
    this.slots.forEach((s, i) => s.setPosition(x0 + (i % eqCols) * (CELL + GAP), y0 + Math.floor(i / eqCols) * (CELL + GAP)));
    const gx = x0 + eqW + SPLIT;
    this.itemsLabel.setPosition(gx, top);
    this.emptyNote.setPosition(gx, y0 + 4);
    this.info.setPosition(x0, infoY);
    this.detail.setPosition(x0, infoY + 10);

    const rows = Math.ceil(collection.owned().length / cols);
    const fullH = rows * CELL + Math.max(0, rows - 1) * GAP;
    this.grid = { x: gx, y: y0, h: Math.max(CELL, areaH), cols };
    this.maxScroll = Math.max(0, fullH - this.grid.h);
    this.setScroll(this.scroll);
  }

  private goBack(): void {
    if (this.leaving || this.formOpen) return;
    this.leaving = true;
    collection.flush();
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }
}
