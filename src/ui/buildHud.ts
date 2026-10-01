// Build mode on the HUD, in a Home (see world/Home.ts and game/build.ts): a
// hammer button beside the bag's chest turns it on, and a friends button
// beside that opens the invite panel. While building, a tray along the bottom
// holds a row of tab chips (each a small picture; the open one also shows its
// name), Undo and Done on the right, and under them a row of parts that
// scrolls sideways under a finger or the mouse wheel, with arrows at an end
// that has more beyond it. The first slot of every tab is the eraser. Above
// the tray sit the picked part's name and, for parts that turn or mirror,
// a Turn or Flip button.
//
// Drawn in device pixels like the other touch controls. Keys: B builds,
// R turns the picked part to face the next way (or mirrors it), X picks the
// eraser, Ctrl+Z undoes, Esc leaves building (see PauseScene); a right click
// erases.

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

// The tray's colours: a deep night-blue body, violet chips, gold for what's picked.
const BODY = 0x0d0f22;
const CHIP = 0x1a1836;
const CHIP_ON = 0x352b70;
const EDGE = 0x5a4c96;
const GOLD = 0xffd66b;
const INK = 0xdfe6ff;
const CREAM = 0xfff4d6;
const DONE = 0x8ee68a;

/** Small 16x16 icons for the buttons, tabs and the eraser, one character a pixel. */
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
  build_undo: {
    pal: { W: '#dfe6ff', w: '#8a93b8' },
    map: [
      '',
      '',
      '',
      '.....W',
      '....WW',
      '...WWWWWWWWw',
      '..WWWWWWWWWWw',
      '...WWW.....WWw',
      '....WW......WW',
      '.....W......WW',
      '............WW',
      '...........WWw',
      '.....WWWWWWWw',
      '.....WWWWWWw',
    ],
  },
  build_done: {
    pal: { K: '#14301a', k: '#2e5a34' },
    map: [
      '',
      '',
      '',
      '............KK',
      '...........KKk',
      '..........KKk',
      '..KK.....KKk',
      '..kKK...KKk',
      '...kKK.KKk',
      '....kKKKk',
      '.....kKk',
      '......k',
    ],
  },
  build_turn: {
    pal: { W: '#dfe6ff', w: '#8a93b8' },
    map: [
      '',
      '',
      '......WWWW',
      '....WWwwwwWW..W',
      '...Ww......WwWW',
      '..Ww.......WWWW',
      '..W.......WWWWW',
      '.Ww',
      '.W',
      '.Ww..........Ww',
      '..W..........W',
      '..Ww........Ww',
      '...Ww......Ww',
      '....WWwwwwWW',
      '......WWWW',
    ],
  },
  build_flip: {
    pal: { W: '#dfe6ff', w: '#8a93b8' },
    map: [
      '',
      '',
      '',
      '.......w',
      '...W...w...W',
      '..WW...w...WW',
      '.WWWWW.w.WWWWW',
      'WWWWWW.w.WWWWWW',
      '.WWWWW.w.WWWWW',
      '..WW...w...WW',
      '...W...w...W',
      '.......w',
    ],
  },
  // The tabs.
  tab_floor: {
    pal: { d: '#4a2e1a', W: '#ecbc7c', w: '#b8804a' },
    map: [
      '',
      '',
      '.dddddddddddddd',
      '.dWWWWWWdWWWWWd',
      '.dwwwwwwdwwwwwd',
      '.dddddddddddddd',
      '.dWWWdWWWWWWWWd',
      '.dwwwdwwwwwwwwd',
      '.dddddddddddddd',
      '.dWWWWWWWWWdWWd',
      '.dwwwwwwwwwdwwd',
      '.dddddddddddddd',
      '.dWWWWWdWWWWWWd',
      '.dwwwwwdwwwwwwd',
      '.dddddddddddddd',
    ],
  },
  tab_wall: {
    pal: { m: '#3a3448', B: '#e2dae8', b: '#9a90ac' },
    map: [
      '',
      '',
      '.mmmmmmmmmmmmmm',
      '.mBBBBBBmBBBBBm',
      '.mbbbbbbmbbbbbm',
      '.mmmmmmmmmmmmmm',
      '.mBBBmBBBBBBmBm',
      '.mbbbmbbbbbbmbm',
      '.mmmmmmmmmmmmmm',
      '.mBBBBBBmBBBBBm',
      '.mbbbbbbmbbbbbm',
      '.mmmmmmmmmmmmmm',
      '.mBBBmBBBBBBmBm',
      '.mbbbmbbbbbbmbm',
      '.mmmmmmmmmmmmmm',
    ],
  },
  tab_roof: {
    pal: { R: '#ff8a6a', r: '#b84a3a', W: '#f4e6c8', w: '#b8a088', D: '#7a4a2a', G: '#ffd66b' },
    map: [
      '',
      '.......rr',
      '......rRRr',
      '.....rRRRRr',
      '....rRRRRRRr',
      '...rRRRRRRRRr',
      '..rRRRRRRRRRRr',
      '.rrrrrrrrrrrrrr',
      '...WWWWWWWWWW',
      '...WGGWWWWDDW',
      '...WGGWWWWDDW',
      '...WWWWWWWDDW',
      '...wwwwwwwDDw',
    ],
  },
  tab_garden: {
    pal: { P: '#ffa2c0', p: '#d0507a', Y: '#ffe27a', L: '#9ae486', l: '#3e9a4a' },
    map: [
      '',
      '.......pp',
      '......pPPp',
      '.....pPYYPp',
      '.....pPYYPp',
      '......pPPp',
      '.......pl',
      '...LL...l',
      '..LLLl..l..LL',
      '...Lll..l.LLLl',
      '.....l..lLll',
      '......l.l',
      '.......ll',
      '.....lllllll',
    ],
  },
  tab_furniture: {
    pal: { A: '#ffc870', a: '#c8803a', d: '#6a3e1e' },
    map: [
      '',
      '',
      '....aaaaaaa',
      '...aAAAAAAAa',
      '...aAAAAAAAa',
      '.aaaAAAAAAAaaa',
      '.aAaAAAAAAAaAa',
      '.aAaaaaaaaaaAa',
      '.aAaAAAAAAAaAa',
      '.aAaAAAAAAAaAa',
      '.aaaaaaaaaaaaa',
      '..d.........d',
      '..d.........d',
    ],
  },
  tab_light: {
    pal: { I: '#c8d0e8', i: '#5a6080', Y: '#fff2b0', y: '#ffb84a' },
    map: [
      '',
      '.......ii',
      '......i..i',
      '.....iiiiii',
      '....iIIIIIIi',
      '.....iYYYYi',
      '.....iYyyYi',
      '.....iYyyYi',
      '.....iYyyYi',
      '.....iYYYYi',
      '....iIIIIIIi',
      '.....iiiiii',
    ],
  },
  tab_decor: {
    pal: { G: '#ffd66b', g: '#a8762a', S: '#9ad0ff', H: '#7ad06a', h: '#3a8a4a', Y: '#fff2a0' },
    map: [
      '',
      '.......g',
      '......g.g',
      '.gggggggggggggg',
      '.gGGGGGGGGGGGGg',
      '.gGSSSSSSSSYYGg',
      '.gGSSSSSSSSYYGg',
      '.gGSSSSSHSSSSGg',
      '.gGSSSSHHHSSSGg',
      '.gGHHSHHHHHSSGg',
      '.gGHHHHhHHHHHGg',
      '.gGhhhhhhhhhhGg',
      '.gGGGGGGGGGGGGg',
      '.gggggggggggggg',
    ],
  },
  tab_seeds: {
    pal: { B: '#e8c890', b: '#a07a4a', d: '#5a3e22', S: '#ffe27a', L: '#9ae486', l: '#3e9a4a' },
    map: [
      '',
      '..........L',
      '.........LLl',
      '......LL.Ll',
      '.....LLLlLl',
      '.......lll',
      '....dddddddd',
      '...dbBBBBBBbd',
      '..dbBBBBBBBBbd',
      '..dbBBSBBBSBbd',
      '..dbBBBBSBBBbd',
      '..dbBSBBBBBBbd',
      '...dbBBBBBBbd',
      '....dddddddd',
    ],
  },
  tab_critters: {
    pal: { B: '#a2dcff', b: '#4a8ad0', d: '#2a2440', Y: '#fff2a0' },
    map: [
      '',
      '',
      '..bb.......bb',
      '.bBBb.d.d.bBBb',
      '.bBBBb.d.bBBBb',
      '.bBYBBbdbBBYBb',
      '..bBBBbdbBBBb',
      '...bbbbdbbbb',
      '....bBbdbBb',
      '...bBBbdbBBb',
      '...bBbb.bbBb',
      '....bb...bb',
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

/** A button: its spot, its picture and its label (either may be left out). */
interface Btn {
  rect: Phaser.Geom.Rectangle;
  icon: Phaser.GameObjects.Image | null;
  text: Phaser.GameObjects.BitmapText | null;
}

export class BuildHud {
  private g: Phaser.GameObjects.Graphics;
  private hammer: Phaser.GameObjects.Image;
  private people: Phaser.GameObjects.Image;
  private tabs: Btn[];
  private undoBtn: Btn;
  private doneBtn: Btn;
  private twistBtn: Btn;
  private nameText: Phaser.GameObjects.BitmapText;
  private hintText: Phaser.GameObjects.BitmapText;
  private icons: Phaser.GameObjects.Image[] = [];
  /** How many are in hand, over the slots that count (seeds). */
  private counts: Phaser.GameObjects.BitmapText[] = [];

  /** Each tab's slots, the eraser (null) first; made once the Home's art exists. */
  private lists = new Map<BuildTab, (PaletteItem | null)[]>();
  private picked = new Map<BuildTab, number>();
  private scrolls = new Map<BuildTab, number>();
  private drag: { id: number; x: number; scroll: number; moved: boolean } | null = null;
  /** The slot under the mouse, or -1: its name shows in the caption. */
  private hover = -1;

  private buildRect = R();
  private friendsRect = R();
  private panel = R();
  private row = R();
  private nameRect = R();
  private cell = 0;
  private cellGap = 0;
  private iconScale = 1;
  private drawn = '';

  /** `onOpen` lets go of the controls held when build mode starts. */
  constructor(
    private scene: Phaser.Scene,
    private onOpen: () => void,
  ) {
    makeIcons(scene);
    const text = (tint: number) => scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setTint(tint).setDepth(DEPTH + 1);
    const icon = (key: string) => scene.add.image(0, 0, key).setDepth(DEPTH + 1);
    this.g = scene.add.graphics().setDepth(DEPTH);
    this.hammer = icon('build_hammer');
    this.people = icon('build_friends');
    this.tabs = TABS.map((t) => ({ rect: R(), icon: icon(`tab_${t.id}`), text: text(CREAM).setText(t.name.toUpperCase()) }));
    this.undoBtn = { rect: R(), icon: icon('build_undo'), text: null };
    this.doneBtn = { rect: R(), icon: icon('build_done'), text: text(0x14301a).setText('DONE') };
    this.twistBtn = { rect: R(), icon: icon('build_turn'), text: text(INK).setText('TURN') };
    this.nameText = text(CREAM);
    this.hintText = text(0x8a93b8);

    const kb = scene.input.keyboard;
    kb?.on('keydown-B', () => this.toggle());
    kb?.on('keydown-R', () => build.on && this.twist());
    kb?.on('keydown-X', () => build.on && this.pick(0));
    kb?.on('keydown-Z', (e: KeyboardEvent) => build.on && (e.ctrlKey || e.metaKey) && (build.undo = true));
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (build.on && this.panel.contains(p.x, p.y)) this.scrollBy(dy || dx);
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopBuilding);
  }

  /** How much of the screen's bottom the tray covers (0 when not building), so the joystick can sit above it. */
  get height(): number {
    return build.on ? this.scene.scale.height - this.nameRect.y : 0;
  }

  /** Whether a spot on the screen is on the tray or its buttons (the world shows no build cursor under them). */
  covers(x: number, y: number): boolean {
    if (!build.on) return false;
    return this.panel.contains(x, y) || this.nameRect.contains(x, y) || (this.twistable() && this.twistBtn.rect.contains(x, y));
  }

  private toggle(): void {
    if (build.on) stopBuilding();
    else if (build.available) {
      build.on = true;
      // The critters caught since the tray last opened join its Critters tab.
      this.lists.delete('critters');
      // And the seeds picked up since.
      this.lists.delete('seeds');
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

  private twistable(): boolean {
    return this.flippable() || this.turnable();
  }

  /** The button's press: a turning part faces the next way round (front, right, back, left), anything else mirrors. */
  private twist(): void {
    if (this.turnable()) build.turn = (build.turn + 1) % 4;
    else if (this.flippable()) build.flip = !build.flip;
  }

  private setTab(tab: BuildTab): void {
    build.tab = tab;
    this.hover = -1;
    this.pick(this.picked.get(tab) ?? 1);
  }

  private get scroll(): number {
    return this.scrolls.get(build.tab) ?? 0;
  }

  private set scroll(v: number) {
    this.scrolls.set(build.tab, Phaser.Math.Clamp(v, 0, this.maxScroll()));
  }

  private maxScroll(): number {
    const n = this.list().length;
    return Math.max(0, n * (this.cell + this.cellGap) - this.cellGap - this.row.width);
  }

  private scrollBy(d: number): void {
    this.scroll = this.scroll + d;
  }

  /** Which slot is under a screen spot, or -1. */
  private slotAt(x: number, y: number): number {
    if (!this.row.contains(x, y)) return -1;
    const i = Math.floor((x - this.row.x + this.scroll) / (this.cell + this.cellGap));
    const dx = x - this.row.x + this.scroll - i * (this.cell + this.cellGap);
    return dx <= this.cell && i >= 0 && i < this.list().length ? i : -1;
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
    const tg = Math.round(4 * D);
    this.cell = Math.round(Math.max(40 * D, Math.min(width, height) * 0.1));
    this.cellGap = Math.round(5 * D);
    // The tab chips are square, with the icon at a whole scale; the open tab grows to show its name.
    const chip = Math.round(Math.max(28 * D, this.cell * 0.66));
    this.iconScale = Math.max(1, Math.floor((chip - 8 * D) / 16));
    const ph = ip * 3 + chip + this.cell;
    this.panel.setTo(m, height - m - ph, width - m * 2, ph);
    const ty = this.panel.y + ip;
    this.row.setTo(this.panel.x + ip, ty + chip + ip, this.panel.width - ip * 2, this.cell);

    let ts = Math.max(1, Math.floor(chip / 18));
    const tp = Math.round(6 * D);
    const shown = TABS.map((t) => build.tabs.includes(t.id));
    const open = TABS.findIndex((t) => t.id === build.tab);
    const doneW = () => Math.round(chip + this.doneBtn.text!.setScale(ts).width + tp);
    // Room for the chips, Undo, Done and the open tab's name; the text shrinks, then the name goes, until it fits.
    const chipsW = shown.filter(Boolean).length * (chip + tg) + chip + tg;
    let label = true;
    const fits = () => chipsW + (label ? this.tabs[open].text!.setScale(ts).width + tp : 0) + doneW() + tg * 2 <= this.row.width;
    while (!fits() && ts > 1) ts--;
    if (!fits()) label = false;

    let x = this.row.x;
    this.tabs.forEach((b, i) => {
      if (!shown[i]) {
        b.rect.setTo(0, 0, 0, 0);
        return;
      }
      const named = i === open && label;
      const w = named ? Math.round(chip + b.text!.width + tp) : chip;
      b.rect.setTo(x, ty, w, chip);
      b.icon!.setPosition(Math.round(x + chip / 2), Math.round(ty + chip / 2));
      b.text!.setScale(ts).setPosition(Math.round(x + chip - 2 * D), Math.round(ty + (chip - b.text!.height) / 2));
      x += w + tg;
    });
    const dw = doneW();
    this.doneBtn.rect.setTo(this.row.right - dw, ty, dw, chip);
    this.doneBtn.icon!.setPosition(Math.round(this.doneBtn.rect.x + chip / 2), Math.round(ty + chip / 2));
    this.doneBtn.text!.setPosition(Math.round(this.doneBtn.rect.x + chip - 2 * D), Math.round(ty + (chip - this.doneBtn.text!.height) / 2));
    this.undoBtn.rect.setTo(this.doneBtn.rect.x - tg - chip, ty, chip, chip);
    this.undoBtn.icon!.setPosition(Math.round(this.undoBtn.rect.centerX), Math.round(this.undoBtn.rect.centerY));

    // The caption over the tray: the picked (or hovered) part's name, and on a PC the keys, dimmer.
    const l = this.list();
    const item = this.hover >= 0 ? l[this.hover] : build.pick;
    const empty = l.length < 2;
    const name = item
      ? item.name
      : build.tab === 'critters' && empty
        ? 'Critters you catch with the net can live here'
        : build.tab === 'seeds' && empty
          ? 'Seeds come from harvests, and from monsters now and then'
          : build.tab === 'seeds'
            ? 'Pull up a crop'
            : 'Eraser';
    const mouse = !this.scene.input.activePointer.wasTouch;
    const keys = [this.twistable() ? (this.turnable() ? 'R TURN' : 'R FLIP') : '', 'X ERASER', 'RIGHT CLICK ERASES'].filter(Boolean).join('  ');
    this.nameText.setText(name.toUpperCase()).setScale(ts);
    this.hintText.setText(mouse && width > 700 * D ? `   ${keys}` : '').setScale(ts);
    const nh = Math.round(Math.max(this.nameText.height + ip * 1.6, chip * 0.8));
    const ny = this.panel.y - nh - Math.round(5 * D);
    this.nameRect.setTo(this.panel.x, ny, Math.round(this.nameText.width + this.hintText.width + ip * 2.4), nh);
    this.nameText.setPosition(Math.round(this.nameRect.x + ip * 1.2), Math.round(this.nameRect.centerY - this.nameText.height / 2));
    this.hintText.setPosition(Math.round(this.nameText.x + this.nameText.width), this.nameText.y);

    // Turn (or Flip) beside it, with its picture.
    const tb = this.twistBtn;
    tb.icon!.setTexture(this.turnable() ? 'build_turn' : 'build_flip');
    tb.text!.setText(this.turnable() ? 'TURN' : 'FLIP').setScale(ts);
    tb.rect.setTo(this.nameRect.right + Math.round(5 * D), ny, Math.round(nh + tb.text!.width + tp), nh);
    tb.icon!.setPosition(Math.round(tb.rect.x + nh / 2), Math.round(tb.rect.centerY));
    tb.text!.setPosition(Math.round(tb.rect.x + nh - 2 * D), Math.round(tb.rect.centerY - tb.text!.height / 2));
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
    if (this.twistable() && this.twistBtn.rect.contains(p.x, p.y)) {
      this.twist();
      return true;
    }
    if (this.nameRect.contains(p.x, p.y)) return true;
    if (!this.panel.contains(p.x, p.y)) return false;
    if (this.doneBtn.rect.contains(p.x, p.y)) stopBuilding();
    else if (this.undoBtn.rect.contains(p.x, p.y)) build.undo = true;
    else if (this.row.contains(p.x, p.y)) this.drag = { id: p.id, x: p.x, scroll: this.scroll, moved: false };
    else {
      const i = this.tabs.findIndex((b) => b.rect.contains(p.x, p.y));
      if (i >= 0) this.setTab(TABS[i].id);
    }
    return true;
  }

  pointerMove(p: Phaser.Input.Pointer): void {
    if (build.on && !p.wasTouch) this.hover = this.drag ? -1 : this.slotAt(p.x, p.y);
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
    const i = this.slotAt(p.x, p.y);
    if (i >= 0) this.pick(i);
  }

  update(_dt: number): void {
    if (build.on && !build.available) stopBuilding();
    if (!build.on) this.drag = null;
    if (!build.on || this.hover >= this.list().length) this.hover = -1;
    this.layout();
    const on = build.on;
    this.hammer.setVisible(build.available);
    this.people.setVisible(build.home);
    const bs = (r: Phaser.Geom.Rectangle) => Math.max(1, Math.floor((r.width - 6 * D) / 16));
    this.hammer.setPosition(Math.round(this.buildRect.centerX), Math.round(this.buildRect.centerY)).setScale(bs(this.buildRect));
    this.people.setPosition(Math.round(this.friendsRect.centerX), Math.round(this.friendsRect.centerY)).setScale(bs(this.friendsRect));

    const twist = on && this.twistable();
    const lit = this.flippable() && !this.turnable() && build.flip;
    const k = this.iconScale;
    this.tabs.forEach((b, i) => {
      const shown = on && build.tabs.includes(TABS[i].id);
      const open = TABS[i].id === build.tab;
      b.icon!.setVisible(shown).setScale(k).setAlpha(open ? 1 : 0.7);
      b.text!.setVisible(shown && open && b.rect.width > b.rect.height + 1);
    });
    this.undoBtn.icon!.setVisible(on).setScale(k).setAlpha(build.canUndo ? 1 : 0.35);
    this.doneBtn.icon!.setVisible(on).setScale(k);
    this.doneBtn.text!.setVisible(on);
    this.twistBtn.icon!.setVisible(twist).setScale(Math.max(1, Math.floor((this.twistBtn.rect.height - 8 * D) / 16))).setTint(lit ? 0x1a1206 : 0xffffff);
    this.twistBtn.text!.setVisible(twist).setTint(lit ? 0x1a1206 : INK);
    this.nameText.setVisible(on);
    this.hintText.setVisible(on);
    const list = on ? this.list() : [];
    const picked = this.picked.get(build.tab) ?? 1;
    this.placeIcons(list);

    const state = `${build.tabs.join()} ${this.scene.scale.width} ${this.scene.scale.height} ${build.available} ${build.home} ${on} ${build.tab} ${picked} ${this.hover} ${Math.round(this.scroll)} ${build.canUndo} ${twist} ${lit} ${this.nameRect.width} ${this.twistBtn.rect.width}`;
    if (state === this.drawn) return;
    this.drawn = state;
    const g = this.g.clear();
    const button = (r: Phaser.Geom.Rectangle, lit: boolean) => {
      g.fillStyle(0x0a0c1c, lit ? 0.62 : 0.42);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
      g.lineStyle(2 * D, lit ? GOLD : 0xb8c4ff, 0.45);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, r.width * 0.22);
    };
    if (build.available) button(this.buildRect, on);
    if (build.home) button(this.friendsRect, false);
    if (!on) return;

    const round = Math.round(7 * D);
    const line = Math.max(1, Math.round(1.5 * D));
    /** A chip: dark and quiet, or lit (gold rim) when it's the open one; `fill` for a coloured one. */
    const chip = (r: Phaser.Geom.Rectangle, lit: boolean, fill?: number) => {
      const rr = Math.min(round, r.height / 2);
      g.fillStyle(fill ?? (lit ? CHIP_ON : CHIP), fill ? 0.95 : 0.92);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, rr);
      // A soft lip of light along the top, so the chips read as raised.
      g.fillStyle(0xffffff, fill ? 0.18 : 0.05);
      g.fillRoundedRect(r.x + line, r.y + line, r.width - line * 2, Math.max(line, r.height * 0.3), { tl: rr - line, tr: rr - line, bl: 0, br: 0 });
      g.lineStyle(line, fill ? 0xffffff : lit ? GOLD : EDGE, fill ? 0.45 : lit ? 0.9 : 0.55);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, rr);
    };

    // The tray: a dark body with a faint rim, the tabs' row parted from the parts by a hairline.
    const p = this.panel;
    g.fillStyle(BODY, 0.86);
    g.fillRoundedRect(p.x, p.y, p.width, p.height, round * 1.4);
    g.lineStyle(Math.round(2 * D), EDGE, 0.5);
    g.strokeRoundedRect(p.x, p.y, p.width, p.height, round * 1.4);
    g.fillStyle(EDGE, 0.35);
    g.fillRect(this.row.x, this.row.y - Math.round(3.5 * D), this.row.width, Math.max(1, Math.round(D)));

    this.tabs.forEach((b, i) => build.tabs.includes(TABS[i].id) && chip(b.rect, TABS[i].id === build.tab));
    chip(this.undoBtn.rect, false);
    chip(this.doneBtn.rect, false, DONE);

    // The caption and the Turn/Flip button.
    const n = this.nameRect;
    g.fillStyle(BODY, 0.8);
    g.fillRoundedRect(n.x, n.y, n.width, n.height, Math.min(round, n.height / 2));
    g.lineStyle(line, EDGE, 0.45);
    g.strokeRoundedRect(n.x, n.y, n.width, n.height, Math.min(round, n.height / 2));
    if (twist) chip(this.twistBtn.rect, lit, lit ? GOLD : undefined);

    // The parts' slots, cut off at the row's ends as they scroll.
    const row = this.row;
    const sr = Math.round(5 * D);
    for (let i = 0; i < list.length; i++) {
      const x = row.x + i * (this.cell + this.cellGap) - this.scroll;
      const x0 = Math.max(row.x, x);
      const x1 = Math.min(row.right, x + this.cell);
      if (x1 <= x0) continue;
      const sel = i === picked;
      const hov = i === this.hover && !sel;
      const whole = x0 === x && x1 === x + this.cell;
      g.fillStyle(sel ? CHIP_ON : hov ? 0x231e4c : 0x141230, 0.95);
      if (whole) g.fillRoundedRect(x0, row.y, x1 - x0, this.cell, sr);
      else g.fillRect(x0, row.y, x1 - x0, this.cell);
      if (sel) {
        // A warm pool under the picked part.
        g.fillStyle(GOLD, 0.1);
        g.fillEllipse((x0 + x1) / 2, row.y + this.cell * 0.78, (x1 - x0) * 0.8, this.cell * 0.3);
      }
      g.lineStyle(Math.round((sel ? 2 : 1) * D), sel ? GOLD : list[i] ? (hov ? 0x8a7ad0 : 0x3a2f66) : 0xc8405e, sel ? 1 : 0.85);
      if (whole) g.strokeRoundedRect(x0, row.y, x1 - x0, this.cell, sr);
      else g.strokeRect(x0, row.y, x1 - x0, this.cell);
    }
    // Arrows at an end with more parts beyond it.
    const arrow = (x: number, dir: number) => {
      const cy = row.centerY;
      const a = Math.round(7 * D);
      g.fillStyle(BODY, 0.85);
      g.fillCircle(x, cy, a * 1.3);
      g.fillStyle(GOLD, 0.95);
      g.fillTriangle(x + dir * a * 0.6, cy, x - dir * a * 0.4, cy - a * 0.7, x - dir * a * 0.4, cy + a * 0.7);
    };
    if (this.scroll > 1) arrow(row.x + Math.round(4 * D), -1);
    if (this.scroll < this.maxScroll() - 1) arrow(row.right - Math.round(4 * D), 1);
  }

  /** Each slot's picture, scaled to fit (whole steps when it's small) and cropped at the row's ends. */
  private placeIcons(list: (PaletteItem | null)[]): void {
    while (this.icons.length < list.length) this.icons.push(this.scene.add.image(0, 0, '__DEFAULT').setDepth(DEPTH + 1));
    const row = this.row;
    const inner = this.cell - 10 * D;
    // Room at the row's ends for the scroll arrows, which sit over the pictures.
    const edge = Math.round(10 * D);
    const left = this.scroll > 1 ? row.x + edge : row.x;
    const right = this.scroll < this.maxScroll() - 1 ? row.right - edge : row.right;
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
      const x0 = cx - (fw * k) / 2;
      const c0 = Math.max(0, (left - x0) / k);
      const c1 = Math.min(fw, (right - x0) / k);
      if (c1 <= c0) {
        img.setVisible(false);
        return;
      }
      img.setVisible(true).setScale(k).setPosition(Math.round(cx), Math.round(row.centerY)).setCrop(c0, 0, c1 - c0, fh);
    });
    // Counts in the slots' bottom right corners, while the whole slot shows.
    while (this.counts.length < list.length) this.counts.push(this.scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(1, 1).setDepth(DEPTH + 2));
    this.counts.forEach((t, i) => {
      const item = list[i];
      const x = row.x + i * (this.cell + this.cellGap) - this.scroll;
      if (!item?.count || x < row.x || x + this.cell > row.right) {
        t.setVisible(false);
        return;
      }
      const n = item.count();
      t.setVisible(true).setText(`${n}`).setScale(Math.max(1, Math.round(D * 1.5))).setTint(n ? 0xfff4d6 : 0xff8a8a);
      t.setPosition(Math.round(x + this.cell - 3 * D), Math.round(row.y + this.cell - 2 * D));
    });
  }
}
