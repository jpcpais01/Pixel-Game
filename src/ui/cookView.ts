// The kitchen's counter, at a stove or a cooking pot in the Home (see
// game/cooking.ts), opened like the keepers' counters (keeperHud.ts). It's
// the cookbook too:
//
//  - Across the top: the station, its name and a line, and the dish taken
//    along in the hotbar, with how many are in the larder.
//  - On the left every recipe as a tile: its dish once it's been cooked (a
//    dark shape before), a green mark when it can be cooked now, and how many
//    are in the larder.
//  - On the right the picked recipe: what it does, what goes in (green when
//    there's enough, red when not), Cook, and Take along.
//  - Along the bottom the pantry: the produce and fish there are to cook with.
//
// Drawn in art pixels; the host scales it and passes pointer events in the
// view's own coordinates.

import Phaser from 'phaser';
import { sound } from '../audio';
import { collection } from '../game/collection';
import { RECIPES, canCook, cook, cookHud, cropKey, dishKey, fishKey, have, ingredientName, madeKey, syncLunch, type Ingredient, type RecipeDef } from '../game/cooking';
import { CROPS } from '../game/farm';
import { FISH } from '../game/fish';
import { Button, wrap } from './inventoryView';
import { PANEL_INSET, PANEL_PICKED, panelTexture, pixelText } from './widgets';

const HEAD_H = 40;
const LINE = 10;
const CH = 6;
const GAP = 3;
const PANTRY_H = 22;
const BTN_H = 16;
const COOK_MS = 750;
const TAP_SLOP = 5;

const DIM = 0x9a90c8;
const SOFT = 0x7c82b8;
const CREAM = 0xfff4d6;
const WARM = 0xffc070;
const GOOD = 0x9cff8a;
const SHORT = 0xff8a7a;

/** The picture for an ingredient: its produce, or a fish (for a kind of fish, one of that kind). */
const ingredientIcon = (i: Ingredient): string =>
  'crop' in i ? `crop_${i.crop}` : i.fish === 'any' ? 'fishi_perch' : i.fish === 'rare' ? 'fishi_koi' : i.fish === 'glow' ? 'fishi_moonscale' : `fishi_${i.fish}`;

interface Tile {
  r: RecipeDef;
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Graphics;
  count: Phaser.GameObjects.BitmapText;
  q: Phaser.GameObjects.BitmapText;
  rect: [number, number, number, number];
}

export class CookView extends Phaser.GameObjects.Container {
  usedW = 0;
  usedH = 0;
  private alcove: Phaser.GameObjects.Image;
  private station: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.BitmapText;
  private says: Phaser.GameObjects.BitmapText[] = [];
  private lunchBox: Phaser.GameObjects.Image;
  private lunchIcon: Phaser.GameObjects.Image;
  private lunchText: Phaser.GameObjects.BitmapText;
  private tiles: Tile[] = [];
  private tileSize = 36;
  private iconScale = 2;
  private dishName: Phaser.GameObjects.BitmapText;
  private does: Phaser.GameObjects.BitmapText;
  private line: Phaser.GameObjects.BitmapText[] = [];
  private needs: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.BitmapText }[] = [];
  private larder: Phaser.GameObjects.BitmapText;
  private cookBtn: Button;
  private takeBtn: Button;
  private pantryTitle: Phaser.GameObjects.BitmapText;
  private pantry: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.BitmapText }[] = [];
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private flash: Phaser.GameObjects.BitmapText;
  private picked = 0;
  private infoX = 0;
  private cooking = 0;
  private press: { x: number; y: number; moved: boolean; button: Button | null } | null = null;
  private time = 0;
  private unwatch: () => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const fire = cookHud.station === 'fire';
    this.alcove = scene.add.image(0, 0, panelTexture(scene, 'ck_alcove', 38, HEAD_H - 2, PANEL_INSET)).setOrigin(0);
    this.station = scene.add.image(0, 0, 'icon_cook').setScale(2);
    this.title = pixelText(scene, 0, 0, fire ? 'The cooking pot' : 'The kitchen stove', WARM);
    this.lunchBox = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.lunchIcon = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.lunchText = pixelText(scene, 0, 0, '', CREAM);
    this.dishName = pixelText(scene, 0, 0, '');
    this.does = pixelText(scene, 0, 0, '', GOOD);
    this.larder = pixelText(scene, 0, 0, '', DIM);
    this.cookBtn = new Button(scene);
    this.takeBtn = new Button(scene);
    this.pantryTitle = pixelText(scene, 0, 0, 'Pantry', SOFT);
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 15, max: 55 },
      lifespan: { min: 300, max: 700 },
      scale: { start: 1, end: 0 },
      tint: [0xffffff, 0xffe08a, 0xff9a4a],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.flash = pixelText(scene, 0, 0, '', CREAM).setAlpha(0);
    this.add([this.alcove, this.station, this.title, this.lunchBox, this.lunchIcon, this.lunchText, this.dishName, this.does, this.larder, this.cookBtn, this.takeBtn, this.pantryTitle]);
    // Open on something that can be cooked now, else the first.
    this.picked = Math.max(0, RECIPES.findIndex((r) => canCook(r)));
    this.unwatch = collection.watch(() => this.refresh());
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.unwatch());
    scene.add.existing(this);
  }

  resize(w: number, h: number): void {
    this.usedW = w;
    this.usedH = h;
    const scene = this.scene;
    this.alcove.setPosition(0, 0);
    this.station.setPosition(19, (HEAD_H - 2) / 2);
    const tx = 46;
    this.title.setPosition(tx, 3);
    const lunchW = 58;
    this.lunchBox.setTexture(panelTexture(scene, 'ck_lunch', lunchW, 20, PANEL_INSET)).setPosition(w - lunchW, 0);
    this.lunchIcon.setPosition(w - lunchW + 4, 2);
    this.lunchText.setPosition(w - lunchW + 23, 6);
    for (const t of this.says) t.destroy();
    const chars = Math.floor((w - tx - lunchW - 70) / CH);
    this.says = wrap('Cook what you grow and catch. The dish you take along waits in your hotbar.'.toUpperCase(), Math.max(12, chars))
      .slice(0, 2)
      .map((s, i) => pixelText(scene, tx, 15 + i * LINE, s, DIM));
    this.add(this.says);

    // The cookbook's tiles: dishes at twice their size if the rows fit, else their own.
    const top = HEAD_H + 4;
    const room = h - top - PANTRY_H - 4;
    const cols = 4;
    const rows = Math.ceil(RECIPES.length / cols);
    this.iconScale = rows * (36 + GAP) - GAP <= room ? 2 : 1;
    this.tileSize = this.iconScale === 2 ? 36 : 20;
    const ts = this.tileSize;
    for (const t of this.tiles) t.box.destroy();
    this.tiles = RECIPES.map((r, i) => {
      const x = (i % cols) * (ts + GAP);
      const y = top + Math.floor(i / cols) * (ts + GAP);
      const bg = scene.add.image(0, 0, panelTexture(scene, 'ck_tile', ts, ts, PANEL_INSET)).setOrigin(0);
      const icon = scene.add.image(ts / 2, ts / 2, `dish_${r.id}`).setScale(this.iconScale);
      const mark = scene.add.graphics();
      const count = pixelText(scene, 0, 0, '', CREAM);
      const q = pixelText(scene, 0, 0, '?', SOFT);
      q.setPosition(Math.round((ts - q.width) / 2), Math.round((ts - q.height) / 2));
      const box = scene.add.container(x, y, [bg, icon, mark, count, q]);
      this.add(box);
      return { r, box, bg, icon, mark, count, q, rect: [x, y, ts, ts] as [number, number, number, number] };
    });
    this.infoX = cols * (ts + GAP) + 6;
    this.add([this.sparks, this.flash]);
    this.refresh();
  }

  refresh(): void {
    if (!this.usedW) return;
    const ts = this.tileSize;
    for (const [i, t] of this.tiles.entries()) {
      const made = collection.stock(madeKey(t.r.id)) > 0;
      const ready = canCook(t.r);
      const n = collection.stock(dishKey(t.r.id));
      t.bg.setTexture(panelTexture(this.scene, i === this.picked ? 'ck_tile_on' : 'ck_tile', ts, ts, i === this.picked ? PANEL_PICKED : PANEL_INSET));
      if (made) t.icon.clearTint().setAlpha(1);
      else t.icon.setTint(0x000000).setAlpha(0.4);
      t.q.setVisible(!made);
      t.count.setText(n ? `${n}` : '').setPosition(ts - 3 - t.count.width, ts - 2 - t.count.height + 1);
      const g = t.mark.clear();
      if (ready) {
        g.fillStyle(0x0a1a08, 1).fillRect(ts - 7, 2, 5, 5);
        g.fillStyle(GOOD, 1).fillRect(ts - 6, 3, 3, 3);
      }
    }
    // The dish taken along.
    const lunch = collection.lunch;
    this.lunchIcon.setVisible(!!lunch);
    if (lunch) this.lunchIcon.setTexture(`dish_${lunch}`);
    this.lunchText.setText(lunch ? `X${collection.stock(dishKey(lunch))}` : '').setTint(CREAM);
    if (!lunch) this.lunchText.setText('NO DISH').setX(this.usedW - 52).setTint(SOFT);
    else this.lunchText.setX(this.usedW - 58 + 23);
    this.drawInfo();
    this.drawPantry();
  }

  /** The picked recipe on the right: name, what it does, what goes in, and its buttons. */
  private drawInfo(): void {
    const r = RECIPES[this.picked];
    const x = this.infoX;
    const w = this.usedW - x;
    const chars = Math.max(8, Math.floor(w / CH));
    const fit = (s: string) => (s.length > chars ? `${s.slice(0, chars - 1)}.` : s);
    const made = collection.stock(madeKey(r.id)) > 0;
    let y = HEAD_H + 4;
    this.dishName.setText(fit(r.name.toUpperCase())).setTint(made ? r.tint : CREAM).setPosition(x, y);
    y += LINE;
    this.does.setText(fit(r.does.toUpperCase())).setPosition(x, y);
    y += LINE;
    for (const t of this.line) t.destroy();
    this.line = wrap((made ? r.line : 'Not cooked yet: gather what it needs.').toUpperCase(), chars)
      .slice(0, 2)
      .map((s, i) => pixelText(this.scene, x, y + i * LINE, s, made ? DIM : SOFT));
    this.add(this.line);
    y += LINE * 2 + 2;
    // What goes in, a row each: its picture, then how many there are of how many it needs.
    for (const n of this.needs) {
      n.icon.destroy();
      n.text.destroy();
    }
    this.needs = r.needs.map((i, k) => {
      const yy = y + k * 17;
      const got = have(i);
      const icon = this.scene.add.image(x, yy, ingredientIcon(i)).setOrigin(0);
      const text = pixelText(this.scene, x + 19, yy + 4, fit(`${Math.min(got, 99)}/${i.n}  ${ingredientName(i)}`.toUpperCase()).slice(0, chars - 3), got >= i.n ? GOOD : SHORT);
      this.add([icon, text]);
      return { icon, text };
    });
    // The buttons along the info's foot, over the pantry.
    const by = this.usedH - PANTRY_H - BTN_H - 6;
    const n = collection.stock(dishKey(r.id));
    this.larder.setText(n ? `${n} in the larder`.toUpperCase() : '').setPosition(x, by - LINE);
    // The last ingredient row mustn't sit under the larder line.
    this.larder.setVisible(y + r.needs.length * 17 <= by - LINE);
    const bw = Math.min(70, Math.floor((w - 4) / 2));
    const ready = canCook(r) && !this.cooking;
    this.cookBtn.set(this.cooking ? 'Cooking...' : 'Cook', bw, BTN_H, ready).dim(!ready).setPosition(x, by);
    const taken = collection.lunch === r.id;
    this.takeBtn.set(taken ? 'Taken along' : 'Take along', bw, BTN_H, false).dim(taken || !made).setPosition(x + bw + 4, by);
  }

  /** The produce and fish there are, along the bottom. */
  private drawPantry(): void {
    for (const p of this.pantry) {
      p.icon.destroy();
      p.text.destroy();
    }
    const y = this.usedH - PANTRY_H + 3;
    this.pantryTitle.setPosition(0, y + 4);
    const items: [string, number][] = [
      ...CROPS.map((c): [string, number] => [`crop_${c.id}`, collection.stock(cropKey(c.id))]),
      ...FISH.map((f): [string, number] => [`fishi_${f.id}`, collection.stock(fishKey(f.id))]),
    ].filter(([, n]) => n > 0);
    let x = 46;
    this.pantry = [];
    if (!items.length) {
      const text = pixelText(this.scene, x, y + 4, 'Empty: harvest the garden beds, or fish the pond', SOFT);
      const icon = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
      this.add([icon, text]);
      this.pantry.push({ icon, text });
      return;
    }
    for (const [key, n] of items) {
      const label = `${Math.min(n, 999)}`;
      const width = 17 + label.length * 5 + 4;
      if (x + width > this.usedW) break;
      const icon = this.scene.add.image(x, y, key).setOrigin(0);
      const text = pixelText(this.scene, x + 16, y + 6, label, CREAM);
      this.add([icon, text]);
      this.pantry.push({ icon, text });
      x += width;
    }
    this.bringToTop(this.sparks);
    this.bringToTop(this.flash);
  }

  update(dt: number): void {
    this.time += dt;
    // Cooking: the dish's tile simmers, then it's done.
    if (this.cooking > 0) {
      this.cooking -= dt;
      const t = this.tiles[this.picked];
      if (t) t.icon.setAngle(Math.sin(this.time * 0.05) * 6);
      if (Math.random() < dt / 90 && t) this.sparks.explode(1, t.rect[0] + this.tileSize / 2 + (Math.random() - 0.5) * 16, t.rect[1] + this.tileSize / 2);
      if (this.cooking <= 0) this.finish();
    }
  }

  private finish(): void {
    this.cooking = 0;
    const r = RECIPES[this.picked];
    const t = this.tiles[this.picked];
    t?.icon.setAngle(0);
    const first = cook(r);
    if (first === null) {
      this.refresh();
      return;
    }
    sound.cooked(first ? 1 : 0);
    syncLunch();
    if (!t) return;
    const [x, y] = t.rect;
    this.sparks.explode(first ? 24 : 12, x + this.tileSize / 2, y + this.tileSize / 2);
    this.scene.tweens.add({ targets: t.icon, scale: { from: this.iconScale * 1.4, to: this.iconScale }, duration: 420, ease: 'Back.Out' });
    const f = this.flash;
    this.scene.tweens.killTweensOf(f);
    f.setText((first ? `New dish: ${r.name}` : `+1 ${r.name}`).toUpperCase()).setTint(first ? 0xfff0a0 : CREAM).setAlpha(1);
    const fx = Phaser.Math.Clamp(Math.round(x + this.tileSize / 2 - f.width / 2), 0, this.usedW - f.width);
    f.setPosition(fx, y - 4);
    this.bringToTop(f);
    this.scene.tweens.add({ targets: f, y: y - 18, alpha: 0, duration: 1300, ease: 'Sine.Out' });
  }

  // ---- Input, in the view's coordinates ----

  private buttonAt(x: number, y: number): Button | null {
    for (const b of [this.cookBtn, this.takeBtn]) if (b.visible && !b.dimmed && b.hit(x, y)) return b;
    return null;
  }

  pointerDown(x: number, y: number): void {
    const button = this.buttonAt(x, y);
    this.press = { x, y, moved: false, button };
    button?.press(true);
  }

  pointerMove(x: number, y: number): void {
    const p = this.press;
    if (!p) return;
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) p.moved = true;
    if (p.button && !p.button.hit(x, y)) p.button.press(false);
  }

  pointerUp(x: number, y: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.button) {
      p.button.press(false);
      if (!p.button.hit(x, y)) return;
      const r = RECIPES[this.picked];
      if (p.button === this.cookBtn && canCook(r) && !this.cooking) {
        this.cooking = COOK_MS;
        sound.brew();
        this.refresh();
      } else if (p.button === this.takeBtn) {
        collection.lunch = r.id;
        syncLunch();
        sound.cardFlip(0);
      }
      return;
    }
    if (p.moved || this.cooking) return;
    const i = this.tiles.findIndex((t) => {
      const [rx, ry, rw, rh] = t.rect;
      return x >= rx && y >= ry && x < rx + rw && y < ry + rh;
    });
    if (i < 0 || i === this.picked) return;
    this.picked = i;
    sound.cardFlip(0);
    this.refresh();
  }

  wheel(_dy: number): void {}
}
