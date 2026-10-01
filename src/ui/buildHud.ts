// Build mode on the HUD, in a Home (see world/Home.ts and game/build.ts): a
// hammer button beside the bag's chest turns it on, and a friends button
// beside that opens the invite panel. While building, a tray along the bottom
// holds the tabs (floors, walls, roofs, garden, furniture, lights, wall decor,
// critters), Undo and Done, and a row of parts that scrolls sideways under a
// finger or the mouse wheel. The first slot of every tab is the eraser.
//
// Drawn in device pixels like the other touch controls. Keys: B builds,
// R flips the picked part (or turns a seat or bed to face the next way),
// Ctrl+Z undoes; a right click erases.

import Phaser from 'phaser';
import { DPR as D } from '../game/display';
import { build, palette, stopBuilding, TABS, type PaletteItem } from '../game/build';
import { partIcon, wallFrameName } from '../art/homeArt';
import { pixelCanvas } from '../art/canvas';
import { partById, type BuildTab } from '../world/homeParts';

/** Under the bag (50) and the keepers' counters (51). */
const DEPTH = 40;
/** A press that moves this far (device px / D) scrolls the parts row instead of picking. */
const DRAG = 7;

/** Small 16x16 icons for the buttons and the eraser, one character a pixel. */
const ICONS: Record<string, { map: string[]; pal: Record<string, string> }> = {
  build_hammer: {
    pal: { H: '#dfe6ff', h: '#8a93b8', W: '#e0a15a', w: '#9a5a2c' },
    map: [
      '',
      '..HHHHHHHHHh',
      '..HHHHHHHHHhh',
      '..hhhhhhhhhhh',
      '...hhhhhhhhh',
      '......WW',
      '......Ww',
      '......Ww',
      '......Ww',
      '......Ww',
      '......Ww',
      '......Ww',
      '.....WWww',
      '.....Wwww',
      '......ww',
    ],
  },
  build_friends: {
    pal: { A: '#fff0b0', a: '#ffc44a', B: '#dff3ff', b: '#6fa8e0' },
    map: [
      '',
      '..........bb',
      '.........bBBb',
      '....aa...bBBb',
      '...aAAa...bb',
      '...aAAa..bbbb',
      '....aa..bBBBBb',
      '...aaaa.bBBBBb',
      '..aAAAAabBBBBb',
      '..aAAAAa.bbbb',
      '..aAAAAa',
      '..aaaaaa',
    ],
  },
  build_eraser: {
    pal: { P: '#ff8aa0', p: '#c8405e', W: '#f4f0ff', w: '#a9a3c8' },
    map: [
      '',
      '',
      '.........pp',
      '........pPPp',
      '.......pPPPPp',
      '......pPPPPPPp',
      '.....wpPPPPPp',
      '....wWwpPPPp',
      '...wWWWwpPp',
      '..wWWWWWwp',
      '...wWWWwp',
      '....wWwp',
      '.....ww',
    ],
  },
};

function makeIcons(scene: Phaser.Scene): void {
  for (const [key, { map, pal }] of Object.entries(ICONS)) {
    if (scene.textures.exists(key)) continue;
    const px = new Uint8ClampedArray(16 * 16 * 4);
    map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const hex = pal[row[x]];
        if (!hex) continue;
        const n = parseInt(hex.slice(1), 16);
        px.set([n >> 16, (n >> 8) & 255, n & 255, 255], (y * 16 + x) * 4);
      }
    });
    scene.textures.addCanvas(key, pixelCanvas(16, 16, px));
  }
}

const R = () => new Phaser.Geom.Rectangle();

export class BuildHud {
  private g: Phaser.GameObjects.Graphics;
  private hammer: Phaser.GameObjects.Image;
  private people: Phaser.GameObjects.Image;
  private tabTexts: Phaser.GameObjects.BitmapText[];
  private undoText: Phaser.GameObjects.BitmapText;
  private doneText: Phaser.GameObjects.BitmapText;
  private nameText: Phaser.GameObjects.BitmapText;
  private flipText: Phaser.GameObjects.BitmapText;
  private icons: Phaser.GameObjects.Image[] = [];

  /** Each tab's slots, the eraser (null) first; made once the Home's art exists. */
  private lists = new Map<BuildTab, (PaletteItem | null)[]>();
  private picked = new Map<BuildTab, number>();
  private scrolls = new Map<BuildTab, number>();
  private drag: { id: number; x: number; scroll: number; moved: boolean } | null = null;

  private buildRect = R();
  private friendsRect = R();
  private panel = R();
  private row = R();
  private tabRects: Phaser.Geom.Rectangle[] = TABS.map(R);
  private undoRect = R();
  private doneRect = R();
  private nameRect = R();
  private flipRect = R();
  private cell = 0;
  private cellGap = 0;
  private drawn = '';

  /** `onOpen` lets go of the controls held when build mode starts. */
  constructor(
    private scene: Phaser.Scene,
    private onOpen: () => void,
  ) {
    makeIcons(scene);
    const text = (tint: number) => scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setTint(tint).setDepth(DEPTH + 1);
    this.g = scene.add.graphics().setDepth(DEPTH);
    this.hammer = scene.add.image(0, 0, 'build_hammer').setDepth(DEPTH + 1);
    this.people = scene.add.image(0, 0, 'build_friends').setDepth(DEPTH + 1);
    this.tabTexts = TABS.map((t) => text(0xdfe6ff).setText(t.name.toUpperCase()));
    this.undoText = text(0xdfe6ff).setText('UNDO');
    this.doneText = text(0x1a1206).setText('DONE');
    this.nameText = text(0xfff4d6);
    this.flipText = text(0xdfe6ff).setText('FLIP');

    const kb = scene.input.keyboard;
    kb?.on('keydown-B', () => this.toggle());
    kb?.on('keydown-R', () => build.on && this.twist());
    kb?.on('keydown-Z', (e: KeyboardEvent) => build.on && (e.ctrlKey || e.metaKey) && (build.undo = true));
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (build.on && this.panel.contains(p.x, p.y)) this.scrollBy(dy || dx);
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopBuilding);
  }

  /** How much of the screen's bottom the tray covers (0 when not building), so the joystick can sit above it. */
  get height(): number {
    return build.on ? this.scene.scale.height - this.panel.y : 0;
  }

  private toggle(): void {
    if (build.on) stopBuilding();
    else if (build.available) {
      build.on = true;
      // The critters caught since the tray last opened join its Critters tab.
      this.lists.delete('critters');
      this.pick(this.picked.get(build.tab) ?? 1);
      this.onOpen();
    }
  }

  private list(tab: BuildTab = build.tab): (PaletteItem | null)[] {
    let l = this.lists.get(tab);
    if (!l) {
      const allow = build.allow;
      l = [null, ...palette(tab, partIcon, (m, f) => ({ key: 'home', frame: wallFrameName(m, f) })).filter((item) => !allow || allow(item))];
      this.lists.set(tab, l);
    }
    return l;
  }

  private pick(i: number): void {
    const l = this.list();
    i = Phaser.Math.Clamp(i, 0, l.length - 1);
    this.picked.set(build.tab, i);
    build.pick = l[i];
  }

  private flippable(): boolean {
    const p = build.pick;
    return p?.layer === 'thing' && !!partById(p.id)?.flip;
  }

  private turnable(): boolean {
    const p = build.pick;
    return p?.layer === 'thing' && !!partById(p.id)?.turns;
  }

  /** The pill's press: a turning part faces the next way round (front, right, back, left), anything else mirrors. */
  private twist(): void {
    if (this.turnable()) build.turn = (build.turn + 1) % 4;
    else if (this.flippable()) build.flip = !build.flip;
  }

  private setTab(tab: BuildTab): void {
    build.tab = tab;
    this.pick(this.picked.get(tab) ?? 1);
  }

  private get scroll(): number {
    return this.scrolls.get(build.tab) ?? 0;
  }

  private set scroll(v: number) {
    const n = this.list().length;
    const max = Math.max(0, n * (this.cell + this.cellGap) - this.cellGap - this.row.width);
    this.scrolls.set(build.tab, Phaser.Math.Clamp(v, 0, max));
  }

  private scrollBy(d: number): void {
    this.scroll = this.scroll + d;
  }

  /** Where everything sits on this screen. */
  private layout(): void {
    const { width, height } = this.scene.scale;
    const s = Math.round(Math.max(34 * D, Math.min(width, height) * 0.075));
    const pad = 12 * D;
    const gap = Math.round(8 * D);
    // Left of the bag's chest (see GearHud.buttonRect); the friends button takes the hammer's spot for a visitor.
    const chestX = width - s * 3 - pad - 20 * D;
    this.buildRect.setTo(chestX - s - gap, pad, s, s);
    this.friendsRect.setTo((build.available ? this.buildRect.x : chestX) - s - gap, pad, s, s);

    const m = Math.round(8 * D);
    const ip = Math.round(6 * D);
    this.cell = Math.round(Math.max(40 * D, Math.min(width, height) * 0.1));
    this.cellGap = Math.round(4 * D);
    const tabH = Math.round(this.cell * 0.5);
    const ph = ip * 3 + tabH + this.cell;
    this.panel.setTo(m, height - m - ph, width - m * 2, ph);
    const ty = this.panel.y + ip;
    this.row.setTo(this.panel.x + ip, ty + tabH + ip, this.panel.width - ip * 2, this.cell);

    // The tab labels shrink a step at a time until the row fits.
    const texts = [...this.tabTexts.filter((_, i) => build.tabs.includes(TABS[i].id)), this.undoText, this.doneText];
    const tp = Math.round(5 * D);
    const tg = Math.round(3 * D);
    let ts = Math.max(1, Math.floor(tabH / 12));
    const fits = () => texts.reduce((w, t) => w + t.setScale(ts).width + tp * 2 + tg, 0) + gap <= this.row.width;
    while (ts > 1 && !fits()) ts--;
    let x = this.row.x;
    this.tabTexts.forEach((t, i) => {
      if (!build.tabs.includes(TABS[i].id)) {
        this.tabRects[i].setTo(0, 0, 0, 0);
        return;
      }
      const w = Math.round(t.width + tp * 2);
      this.tabRects[i].setTo(x, ty, w, tabH);
      t.setPosition(Math.round(x + tp), Math.round(ty + (tabH - t.height) / 2));
      x += w + tg;
    });
    let rx = this.row.right;
    for (const [t, r] of [[this.doneText, this.doneRect], [this.undoText, this.undoRect]] as const) {
      const w = Math.round(t.width + tp * 2);
      rx -= w;
      r.setTo(rx, ty, w, tabH);
      t.setPosition(Math.round(rx + tp), Math.round(ty + (tabH - t.height) / 2));
      rx -= tg;
    }

    // The picked part's name over the tray, and a Flip toggle beside it for parts that mirror.
    const pick = build.pick;
    const name = pick ? pick.name : build.tab === 'critters' && this.list().length < 2 ? 'Critters you catch with the net can live here' : 'Eraser';
    const hint = this.scene.input.activePointer.wasTouch ? '' : pick ? '   RIGHT CLICK ERASES' : '';
    this.nameText.setText((name + hint).toUpperCase()).setScale(ts);
    const nh = Math.round(this.nameText.height + ip * 1.4);
    this.nameRect.setTo(this.panel.x, this.panel.y - nh - Math.round(4 * D), Math.round(this.nameText.width + ip * 2), nh);
    this.nameText.setPosition(this.nameRect.x + ip, Math.round(this.nameRect.centerY - this.nameText.height / 2));
    this.flipText.setText(this.turnable() ? 'TURN' : 'FLIP').setScale(ts);
    this.flipRect.setTo(this.nameRect.right + Math.round(4 * D), this.nameRect.y, Math.round(this.flipText.width + ip * 2), nh);
    this.flipText.setPosition(this.flipRect.x + ip, Math.round(this.flipRect.centerY - this.flipText.height / 2));
    this.scroll = this.scroll; // re-clamp for a new size
  }

  /** Handles a press; returns true when the build HUD took it. */
  pointerDown(p: Phaser.Input.Pointer): boolean {
    const grow = (r: Phaser.Geom.Rectangle) => Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(r.x - 6 * D, r.y - 6 * D, r.width + 12 * D, r.height + 12 * D), p.x, p.y);
    if (build.available && grow(this.buildRect)) {
      this.toggle();
      return true;
    }
    if (build.home && grow(this.friendsRect)) {
      stopBuilding();
      build.friends = true;
      return true;
    }
    if (!build.on) return false;
    if ((this.flippable() || this.turnable()) && this.flipRect.contains(p.x, p.y)) {
      this.twist();
      return true;
    }
    if (!this.panel.contains(p.x, p.y)) return false;
    if (this.doneRect.contains(p.x, p.y)) stopBuilding();
    else if (this.undoRect.contains(p.x, p.y)) build.undo = true;
    else if (this.row.contains(p.x, p.y)) this.drag = { id: p.id, x: p.x, scroll: this.scroll, moved: false };
    else {
      const i = this.tabRects.findIndex((r) => r.contains(p.x, p.y));
      if (i >= 0) this.setTab(TABS[i].id);
    }
    return true;
  }

  pointerMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.id) return;
    if (Math.abs(p.x - d.x) > DRAG * D) d.moved = true;
    if (d.moved) this.scroll = d.scroll - (p.x - d.x);
  }

  pointerUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.id) return;
    this.drag = null;
    if (d.moved) return;
    const i = Math.floor((p.x - this.row.x + this.scroll) / (this.cell + this.cellGap));
    const x = p.x - this.row.x + this.scroll - i * (this.cell + this.cellGap);
    if (x <= this.cell && i >= 0 && i < this.list().length) this.pick(i);
  }

  update(_dt: number): void {
    if (build.on && !build.available) stopBuilding();
    if (!build.on) this.drag = null;
    this.layout();
    const on = build.on;
    this.hammer.setVisible(build.available);
    this.people.setVisible(build.home);
    const bs = (r: Phaser.Geom.Rectangle) => Math.max(1, Math.floor((r.width - 6 * D) / 16));
    this.hammer.setPosition(Math.round(this.buildRect.centerX), Math.round(this.buildRect.centerY)).setScale(bs(this.buildRect));
    this.people.setPosition(Math.round(this.friendsRect.centerX), Math.round(this.friendsRect.centerY)).setScale(bs(this.friendsRect));
    for (const t of [this.undoText, this.doneText, this.nameText]) t.setVisible(on);
    this.tabTexts.forEach((t, i) => t.setVisible(on && build.tabs.includes(TABS[i].id)));
    const flip = on && (this.flippable() || this.turnable());
    const lit = this.flippable() && build.flip;
    this.flipText.setVisible(flip).setTint(lit ? 0x1a1206 : 0xdfe6ff);
    this.undoText.setAlpha(build.canUndo ? 1 : 0.4);
    this.tabTexts.forEach((t, i) => t.setTint(TABS[i].id === build.tab ? 0x1a1206 : 0xdfe6ff));
    const list = on ? this.list() : [];
    const picked = this.picked.get(build.tab) ?? 1;
    this.placeIcons(list);

    const state = `${build.tabs.join()} ${this.scene.scale.width} ${this.scene.scale.height} ${build.available} ${build.home} ${on} ${build.tab} ${picked} ${Math.round(this.scroll)} ${build.canUndo} ${flip} ${lit} ${this.nameRect.width}`;
    if (state === this.drawn) return;
    this.drawn = state;
    const g = this.g.clear();
    const button = (r: Phaser.Geom.Rectangle, lit: boolean) => {
      g.fillStyle(0x0a0c1c, lit ? 0.62 : 0.42);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
      g.lineStyle(2 * D, lit ? 0xffd66b : 0xb8c4ff, 0.45);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
    };
    if (build.available) button(this.buildRect, on);
    if (build.home) button(this.friendsRect, false);
    if (!on) return;

    const round = Math.round(6 * D);
    const pill = (r: Phaser.Geom.Rectangle, lit: boolean, gold = 0xffd66b) => {
      g.fillStyle(lit ? gold : 0x1c1a3a, lit ? 0.95 : 0.8);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, Math.min(round, r.height / 2));
      g.lineStyle(Math.round(1.5 * D), lit ? 0xfff0b0 : 0x6b5aa6, 0.7);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, Math.min(round, r.height / 2));
    };
    const p = this.panel;
    g.fillStyle(0x0a0c1c, 0.78);
    g.fillRoundedRect(p.x, p.y, p.width, p.height, round);
    g.lineStyle(Math.round(2 * D), 0x6b5aa6, 0.6);
    g.strokeRoundedRect(p.x, p.y, p.width, p.height, round);
    this.tabRects.forEach((r, i) => build.tabs.includes(TABS[i].id) && pill(r, TABS[i].id === build.tab));
    pill(this.undoRect, false);
    pill(this.doneRect, true, 0x8dff8a);
    g.fillStyle(0x0a0c1c, 0.72);
    g.fillRoundedRect(this.nameRect.x, this.nameRect.y, this.nameRect.width, this.nameRect.height, round);
    if (flip) pill(this.flipRect, lit);

    // The parts' slots, cut off at the row's ends as they scroll.
    const row = this.row;
    for (let i = 0; i < list.length; i++) {
      const x = row.x + i * (this.cell + this.cellGap) - this.scroll;
      const x0 = Math.max(row.x, x);
      const x1 = Math.min(row.right, x + this.cell);
      if (x1 <= x0) continue;
      const sel = i === picked;
      g.fillStyle(sel ? 0x33296a : 0x151233, 0.95);
      g.fillRect(x0, row.y, x1 - x0, this.cell);
      g.lineStyle(Math.round((sel ? 2 : 1) * D), sel ? 0xffd66b : list[i] ? 0x43356e : 0xc8405e, sel ? 1 : 0.8);
      g.strokeRect(x0, row.y, x1 - x0, this.cell);
    }
  }

  /** Each slot's picture, scaled to fit (whole steps when it's small) and cropped at the row's ends. */
  private placeIcons(list: (PaletteItem | null)[]): void {
    while (this.icons.length < list.length) this.icons.push(this.scene.add.image(0, 0, '__DEFAULT').setDepth(DEPTH + 1));
    const row = this.row;
    const inner = this.cell - 8 * D;
    this.icons.forEach((img, i) => {
      const item = list[i];
      if (i >= list.length) {
        img.setVisible(false);
        return;
      }
      const icon = item ? item.icon : { key: 'build_eraser' };
      if (img.texture.key !== icon.key || (icon.frame !== undefined && img.frame.name !== icon.frame)) img.setTexture(icon.key, icon.frame);
      const fw = img.frame.realWidth;
      const fh = img.frame.realHeight;
      let k = Math.min(inner / fw, inner / fh);
      if (k >= 1) k = Math.floor(k);
      const cx = row.x + i * (this.cell + this.cellGap) - this.scroll + this.cell / 2;
      const left = cx - (fw * k) / 2;
      const c0 = Math.max(0, (row.x - left) / k);
      const c1 = Math.min(fw, (row.right - left) / k);
      if (c1 <= c0) {
        img.setVisible(false);
        return;
      }
      img.setVisible(true).setScale(k).setPosition(Math.round(cx), Math.round(row.centerY)).setCrop(c0, 0, c1 - c0, fh);
    });
  }
}
