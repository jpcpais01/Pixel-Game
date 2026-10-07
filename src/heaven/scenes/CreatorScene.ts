// Heaven Lands' character creator, a dressing room in the clouds: the
// wanderer stands large on a cloud on one side, in a warm glow, turning when
// dragged or tapped round; on the other a parchment panel with tabs (Body,
// Face, Hair, Clothes, Accessories, Carry, Outfits) holds every choice, each
// with arrows to cycle, and pictures or swatches to tap where they help.
// Started with `scene.start('creator', { first })`: the first time there is
// no Back, the name plate is invited and a welcome line greets the player.
// Done keeps the name and look and goes home; Back just leaves.
//
// Everything is drawn in art pixels at the menus' zoom (menuZoom) and the
// wanderer at a bigger whole number of those. Taps are worked out here from
// rectangles (`Hot`), not per object, so the scrolling list can tell a tap
// from a drag and nothing outside its window can be hit.

import Phaser from 'phaser';
import { menuZoom } from '../../game/display';
import { cleanName, OUTFIT_SLOTS, profile } from '../profile';
import {
  BACKS,
  BEARDS,
  BOTTOMS,
  BROWS,
  BUILDS,
  CHEEKS,
  CLOTH,
  colorOf,
  DRESSES,
  EARRINGS,
  encodeLook,
  EYE_COLORS,
  EYES,
  FIELDS,
  GLASSES,
  HAIR_COLORS,
  HAIRS,
  HATS,
  HEIGHTS,
  HELD,
  MOUTHS,
  NECKS,
  randomLook,
  SHOES,
  SKINS,
  TOPS,
  type Appearance,
  type Named,
} from '../look';
import { WFH } from '../art/sheet';
import { buildCreatorFonts } from '../art/creatorFont';
import {
  C,
  CLOUD_CARD,
  cloudBankTexture,
  cloudTextures,
  CREAM_CARD,
  drawCard,
  FIELD,
  HALO_R,
  haloTexture,
  iconTexture,
  inkText,
  inkWidth,
  moteTexture,
  panelTexture,
  PARCHMENT,
  PEDESTAL_W,
  pedestalTexture,
  ROSE_CARD,
  skyTexture,
  softText,
  TILE_CARD,
  TILE_PICKED,
  type IconName,
} from '../art/creatorArt';
import { Preview, type PreviewEmote } from '../ui/creatorPreview';
import { THUMB, Thumbs, type ThumbKind } from '../ui/creatorThumbs';
import { NameField } from '../ui/nameField';

// ---------------------------------------------------------------- Tuning

/** Space round the screen's edge and between the stage and the panel, art px. */
const MARGIN = 6;
const GAP = 6;
/** The tab strip's height, and the panel's inner padding. */
const TAB_H = 20;
const PAD = 8;
/** A row's label line, its control (arrows, field, segments), and the space after a row. */
const LABEL_H = 11;
const CTRL_H = 16;
const ROW_GAP = 9;
/** Picture tiles and colour swatches: size and step. */
const TILE = THUMB + 4;
const TILE_GAP = 2;
const SWATCH = 13;
const SWATCH_STEP = 15;
/** Small round buttons on the stage (dice, emotes, turning). */
const BTN = 18;
/** How far a press must move before it's a drag (scroll or turn), and how far a drag turns the wanderer a step. */
const DRAG_START = 4;
const TURN_DRAG = 26;
/** Mouse wheel to scroll, art px per wheel pixel; how quickly a flung list slows (per ms). */
const WHEEL_SCALE = 0.3;
const FLING_DECAY = 0.994;
/** Clouds drifting by and motes rising round the wanderer. */
const CLOUDS = 7;
const MOTES = 12;
/** A kept outfit's replace or clear waits this long for its second tap, ms. */
const ARM_MS = 3000;
/** The panel needs at least this much width to lay out its rows. */
const PANEL_MIN_W = 196;

// ---------------------------------------------------------------- What the tabs hold

type Key = keyof Appearance;

type RowDef =
  /** A choice from a list: arrows round its name, optional pictures of each option, or segments for a short list. */
  | { kind: 'pick'; key: Key; label: string; list: Named[]; thumb?: ThumbKind; seg?: boolean; face?: 'down' | 'up' }
  /** A colour: a grid of swatches; dimmed while the thing it dyes isn't worn (`of`). */
  | { kind: 'color'; key: Key; label: string; list: (Named & { c: string })[]; of?: Key }
  | { kind: 'outfits' };

interface TabDef {
  icon: IconName;
  name: string;
  rows: RowDef[];
  /** The way the wanderer turns to face when the tab opens. */
  face?: 'down' | 'up';
}

const TABS: TabDef[] = [
  {
    icon: 'body',
    name: 'Body',
    rows: [
      { kind: 'pick', key: 'height', label: 'Height', list: HEIGHTS, seg: true },
      { kind: 'pick', key: 'build', label: 'Build', list: BUILDS, seg: true },
      { kind: 'color', key: 'skin', label: 'Skin', list: SKINS },
    ],
  },
  {
    icon: 'face',
    name: 'Face',
    face: 'down',
    rows: [
      { kind: 'pick', key: 'eyes', label: 'Eyes', list: EYES, thumb: 'face' },
      { kind: 'color', key: 'eyeColor', label: 'Eye colour', list: EYE_COLORS },
      { kind: 'pick', key: 'brows', label: 'Brows', list: BROWS, thumb: 'face' },
      { kind: 'pick', key: 'mouth', label: 'Mouth', list: MOUTHS, thumb: 'face' },
      { kind: 'pick', key: 'cheeks', label: 'Cheeks', list: CHEEKS, thumb: 'face' },
    ],
  },
  {
    icon: 'hair',
    name: 'Hair',
    rows: [
      { kind: 'pick', key: 'hair', label: 'Style', list: HAIRS, thumb: 'head' },
      { kind: 'color', key: 'hairColor', label: 'Colour', list: HAIR_COLORS },
      { kind: 'pick', key: 'beard', label: 'Beard', list: BEARDS, thumb: 'head', face: 'down' },
    ],
  },
  {
    icon: 'clothes',
    name: 'Clothes',
    rows: [
      { kind: 'pick', key: 'top', label: 'Top', list: TOPS, thumb: 'torso' },
      { kind: 'color', key: 'topColor', label: 'Top colour', list: CLOTH },
      { kind: 'color', key: 'trim', label: 'Trim', list: CLOTH },
      { kind: 'pick', key: 'bottom', label: 'Bottoms', list: BOTTOMS, thumb: 'legs' },
      { kind: 'color', key: 'bottomColor', label: 'Bottoms colour', list: CLOTH },
      { kind: 'pick', key: 'dress', label: 'Dress', list: DRESSES, thumb: 'dress' },
      { kind: 'color', key: 'dressColor', label: 'Dress colour', list: CLOTH, of: 'dress' },
      { kind: 'pick', key: 'shoes', label: 'Shoes', list: SHOES, thumb: 'feet' },
      { kind: 'color', key: 'shoesColor', label: 'Shoes colour', list: CLOTH, of: 'shoes' },
    ],
  },
  {
    icon: 'accessories',
    name: 'Accessories',
    rows: [
      { kind: 'pick', key: 'hat', label: 'Hat', list: HATS, thumb: 'head' },
      { kind: 'color', key: 'hatColor', label: 'Hat colour', list: CLOTH, of: 'hat' },
      { kind: 'pick', key: 'glasses', label: 'Glasses', list: GLASSES, thumb: 'face', face: 'down' },
      { kind: 'pick', key: 'earrings', label: 'Earrings', list: EARRINGS },
      { kind: 'pick', key: 'neck', label: 'Neck', list: NECKS, thumb: 'torso' },
      { kind: 'color', key: 'neckColor', label: 'Neck colour', list: CLOTH, of: 'neck' },
      { kind: 'pick', key: 'back', label: 'Back', list: BACKS, thumb: 'back', face: 'up' },
      { kind: 'color', key: 'backColor', label: 'Back colour', list: CLOTH, of: 'back' },
    ],
  },
  {
    icon: 'carry',
    name: 'Carry',
    rows: [
      { kind: 'pick', key: 'held', label: 'In hand', list: HELD, thumb: 'hand' },
      { kind: 'color', key: 'heldColor', label: 'Colour', list: CLOTH, of: 'held' },
    ],
  },
  { icon: 'outfits', name: 'Outfits', rows: [{ kind: 'outfits' }] },
];

/** What an outfit is: everything from the top down to the thing carried (not the body, face or hair). */
const OUTFIT_KEYS: Key[] = FIELDS.slice(FIELDS.findIndex((f) => f.key === 'top')).map((f) => f.key);

const wearOutfit = (look: Appearance, outfit: Appearance): Appearance => {
  const a = { ...look };
  for (const k of OUTFIT_KEYS) a[k] = outfit[k];
  return a;
};
const sameOutfit = (a: Appearance, b: Appearance): boolean => OUTFIT_KEYS.every((k) => a[k] === b[k]);
/** Nothing worn there: the first entry of a list that starts with None (or bare feet). */
const unworn = (list: Named[], i: number): boolean => list[i]?.id === 'none' || list[i]?.id === 'bare';
const hexNum = (h: string): number => parseInt(h.slice(1), 16);

// ---------------------------------------------------------------- Layout

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Plan {
  wide: boolean;
  stage: Rect;
  /** The wanderer's zoom (art px per figure px) and where its soles stand. */
  s: number;
  feetX: number;
  feetY: number;
  titleY: number;
  back: Rect | null;
  dice: Rect;
  emotes: Rect[];
  turnL: Rect;
  turnR: Rect;
  name: Rect;
  done: Rect;
  panel: Rect;
}

const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A press on a rectangle: `content` ones are in the scrolling list's own coordinates. */
interface Hot extends Rect {
  tap: () => void;
}

interface Press {
  hot: Hot | null;
  content: boolean;
  stage: boolean;
  x: number;
  y: number;
  scroll: number;
  dragging: boolean;
  turnX: number;
  lastY: number;
  lastT: number;
  vel: number;
}

const EMOTES: { e: PreviewEmote; icon: IconName; float: IconName | null }[] = [
  { e: 'wave', icon: 'wave', float: null },
  { e: 'cheer', icon: 'cheer', float: 'star' },
  { e: 'dance', icon: 'dance', float: 'dance' },
  { e: 'heart', icon: 'heart', float: 'heart' },
];

export class CreatorScene extends Phaser.Scene {
  private first = false;
  private look!: Appearance;
  private tab = 0;
  private z = 1;
  private vw = 0;
  private vh = 0;
  private plan!: Plan;

  private sky!: Phaser.GameObjects.TileSprite;
  private bank!: Phaser.GameObjects.TileSprite;
  private clouds: { img: Phaser.GameObjects.Image; x: number; fy: number; speed: number }[] = [];
  private motes: { img: Phaser.GameObjects.Image; x: number; y: number; speed: number; phase: number }[] = [];
  private halo!: Phaser.GameObjects.Image;
  private pedestal!: Phaser.GameObjects.Image;
  private preview!: Preview;
  private thumbs!: Thumbs;
  private nameField!: NameField;

  private stageUi!: Phaser.GameObjects.Container;
  private plateUi!: Phaser.GameObjects.Container;
  private plateHint: Phaser.GameObjects.BitmapText | null = null;
  private caret: Phaser.GameObjects.Rectangle | null = null;
  private panelImg!: Phaser.GameObjects.Image;
  private panelKey = '';
  private tabsBack!: Phaser.GameObjects.Graphics;
  private tabsFront!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private maskG!: Phaser.GameObjects.Graphics;
  private scrollbar!: Phaser.GameObjects.Graphics;
  private pressG!: Phaser.GameObjects.Graphics;

  private fixed: Hot[] = [];
  private inner: Hot[] = [];
  private view: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private scroll = 0;
  private contentH = 0;
  private fling = 0;
  private press: Press | null = null;
  private armed: { slot: number; act: 'keep' | 'clear'; at: number } | null = null;
  /** The look code each thumbnail slot was last asked to show, so unchanged ones aren't painted again. */
  private shown = new Map<string, string>();
  private now = 0;

  constructor() {
    super('creator');
  }

  init(data?: { first?: boolean }): void {
    this.first = !!data?.first;
    this.look = profile.look;
    this.tab = 0;
    this.scroll = 0;
    this.fling = 0;
    this.press = null;
    this.armed = null;
    this.clouds = [];
    this.motes = [];
    this.shown.clear();
    this.panelKey = '';
    this.now = 0;
  }

  create(): void {
    buildCreatorFonts(this);
    iconTexture(this);
    this.cameras.main.setOrigin(0, 0).setBackgroundColor('#c8d2f4');

    this.sky = this.add.tileSprite(0, 0, 4, 4, skyTexture(this, 4)).setOrigin(0).setDepth(0);
    const cloudKeys = cloudTextures(this);
    for (let i = 0; i < CLOUDS; i++) {
      const far = i < 3;
      const img = this.add
        .image(0, 0, cloudKeys[(i * 2 + 1) % cloudKeys.length])
        .setOrigin(0)
        .setScale(far ? 1 : 2)
        .setAlpha(far ? 0.75 : 0.95)
        .setDepth(far ? 1 : 2);
      this.clouds.push({ img, x: Math.random() * 600, fy: 0.04 + Math.random() * 0.55, speed: (far ? 1.5 : 3.5) + Math.random() * 2.5 });
    }
    this.bank = this.add.tileSprite(0, 0, 4, 30, cloudBankTexture(this)).setOrigin(0).setDepth(3);
    this.halo = this.add.image(0, 0, haloTexture(this)).setOrigin(0).setDepth(4);
    const mote = moteTexture(this);
    for (let i = 0; i < MOTES; i++) {
      const img = this.add.image(0, 0, mote, i % 3 ? 'dot' : 'plus').setOrigin(0).setDepth(5);
      this.motes.push({ img, x: Math.random(), y: Math.random(), speed: 0.03 + Math.random() * 0.05, phase: Math.random() * 6.28 });
    }
    this.pedestal = this.add.image(0, 0, pedestalTexture(this)).setOrigin(0).setDepth(6);
    this.preview = new Preview(this, this.look);
    this.preview.image.setDepth(7);
    this.preview.onEmote = (e) => this.floatUp(e);
    this.thumbs = new Thumbs(this);

    this.stageUi = this.add.container(0, 0).setDepth(9);
    this.plateUi = this.add.container(0, 0).setDepth(9);
    this.tabsBack = this.add.graphics().setDepth(10);
    this.panelImg = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(11);
    this.tabsFront = this.add.container(0, 0).setDepth(12);
    this.content = this.add.container(0, 0).setDepth(13);
    this.maskG = this.make.graphics({}, false);
    this.content.setMask(this.maskG.createGeometryMask());
    this.scrollbar = this.add.graphics().setDepth(14);
    this.pressG = this.add.graphics().setDepth(15);

    this.nameField = new NameField(profile.rawName, () => this.drawPlate());

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (inside(this.view, p.x / this.z, p.y / this.z)) this.scrollTo(this.scroll + dy * WHEEL_SCALE);
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.preview.turn(-1));
    kb?.on('keydown-RIGHT', () => this.preview.turn(1));
    kb?.on('keydown-UP', () => this.scrollTo(this.scroll - 24));
    kb?.on('keydown-DOWN', () => this.scrollTo(this.scroll + 24));
    kb?.on('keydown-ESC', () => {
      if (!this.first) this.leave(false);
    });
    kb?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= TABS.length) this.openTab(n - 1);
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.layout();
  }

  update(_t: number, dt: number): void {
    this.now += dt;
    this.preview.update(dt);
    this.thumbs.update();

    // The sky's life: clouds drift east and wrap round, the bank rolls slowly, motes rise and twinkle.
    for (const c of this.clouds) {
      // Kept unrounded, shown on device pixels: a slow cloud still creeps.
      c.x += (c.speed * dt) / 1000;
      if (c.x > this.vw + 4) c.x = -c.img.displayWidth - 4 - Math.random() * 40;
      c.img.x = Math.round(c.x * this.z) / this.z;
    }
    this.bank.tilePositionX += dt * 0.004;
    const p = this.plan;
    const s = p.s;
    for (const m of this.motes) {
      m.y -= (m.speed * dt) / 1000;
      if (m.y < 0) {
        m.y = 1;
        m.x = Math.random();
      }
      const span = 54 * s;
      const x = p.feetX - span / 2 + m.x * span + Math.sin(this.now / 900 + m.phase) * 3;
      const y = p.feetY - m.y * 46 * s;
      m.img.setPosition(Math.round(x * this.z) / this.z, Math.round(y * this.z) / this.z);
      m.img.setAlpha(Math.max(0, Math.sin(this.now / 500 + m.phase)) * Math.min(1, m.y * 3) * 0.9);
    }
    this.halo.setAlpha(0.86 + Math.sin(this.now / 1400) * 0.12);

    // A flung list glides to a stop.
    if (!this.press && Math.abs(this.fling) > 0.005) {
      this.scrollTo(this.scroll + this.fling * dt);
      this.fling *= Math.pow(FLING_DECAY, dt);
      if (this.scroll <= 0 || this.scroll >= this.maxScroll) this.fling = 0;
    }

    // The name plate: a blinking caret while typing, a gentle pulse on the invitation.
    if (this.caret) this.caret.setVisible(this.nameField.focused && Math.floor(this.now / 450) % 2 === 0);
    if (this.plateHint) this.plateHint.setAlpha(0.6 + Math.sin(this.now / 380) * 0.35);

    if (this.armed && this.now - this.armed.at > ARM_MS) {
      this.armed = null;
      this.buildContent();
    }
  }

  // ---------------------------------------------------------------- Layout

  private layout(): void {
    const { width, height } = this.scale;
    let z = menuZoom(width, height);
    let plan = this.planFor(width / z, height / z);
    while (!plan && z > 1) plan = this.planFor(width / --z, height / z);
    this.z = z;
    this.vw = width / z;
    this.vh = height / z;
    this.plan = plan ?? this.tallPlan(Math.max(this.vw, PANEL_MIN_W + 2 * MARGIN), this.vh, true)!;
    this.cameras.main.setZoom(z);
    const P = this.plan;

    const skyH = Math.ceil(this.vh);
    const oldSky = this.sky.texture.key;
    this.sky.setTexture(skyTexture(this, skyH)).setSize(Math.ceil(this.vw), skyH);
    if (oldSky !== this.sky.texture.key && this.textures.exists(oldSky)) this.textures.remove(oldSky);
    this.bank.setSize(Math.ceil(this.vw), 30).setPosition(0, Math.round(this.vh - 26));
    for (const c of this.clouds) c.img.y = Math.round(c.fy * this.vh);

    // The figure, its cloud and glow, all in the figure's own pixels.
    const s = P.s;
    this.preview.image.setScale(s).setPosition(P.feetX - 16 * s, P.feetY - 41 * s);
    this.pedestal.setScale(s).setPosition(P.feetX - (PEDESTAL_W / 2) * s, P.feetY - 4 * s);
    this.halo.setScale(s).setPosition(P.feetX - HALO_R * s, P.feetY - 22 * s - HALO_R * s);

    this.drawStage();
    this.drawPlate();
    this.drawPanel();
    this.buildContent();
    this.placeNameField();
  }

  private planFor(vw: number, vh: number): Plan | null {
    return vw >= vh * 1.15 ? (this.widePlan(vw, vh) ?? this.tallPlan(vw, vh)) : (this.tallPlan(vw, vh) ?? this.widePlan(vw, vh));
  }

  /** Stage on the left, the panel on the right: landscape phones and desktops. */
  private widePlan(vw: number, vh: number): Plan | null {
    const stageW = clamp(Math.round(vw * 0.4), 124, 210);
    const panelW = Math.floor(vw - 2 * MARGIN - GAP - stageW);
    if (panelW < PANEL_MIN_W || vh < 180) return null;
    const stage = { x: MARGIN, y: MARGIN, w: stageW, h: Math.floor(vh - 2 * MARGIN) };
    const cx = Math.round(stage.x + stageW / 2);
    const titleBottom = stage.y + (this.first ? 22 : 16);
    const done = { x: cx - Math.min(48, (stageW - 8) >> 1), y: Math.floor(vh - MARGIN - 20), w: Math.min(96, stageW - 8), h: 20 };
    const nameW = Math.min(124, stageW - 8);
    const name = { x: cx - (nameW >> 1), y: done.y - 5 - 18, w: nameW, h: 18 };
    const fig = this.fitFigure(cx, titleBottom + 4, name.y, stageW);
    if (!fig) return null;
    return { wide: true, stage, ...fig, titleY: stage.y + 3, back: this.first ? null : { x: stage.x, y: stage.y, w: 40, h: 16 }, name, done, panel: { x: stage.x + stageW + GAP, y: MARGIN, w: panelW, h: Math.floor(vh - 2 * MARGIN) } };
  }

  /** Stage above, the panel below: portrait phones. `force` takes whatever fits. */
  private tallPlan(vw: number, vh: number, force = false): Plan | null {
    const w = Math.floor(vw - 2 * MARGIN);
    if (w < PANEL_MIN_W && !force) return null;
    const stage0 = { x: MARGIN, y: MARGIN, w, h: 0 };
    const titleBottom = MARGIN + (this.first ? 22 : 16);
    for (let s = 5; s >= 2; s--) {
      const stageH = titleBottom - MARGIN + 4 + 45 * s + 4 + 20;
      const panelH = Math.floor(vh - 2 * MARGIN - GAP - stageH);
      if (panelH < 150 && s > 2) continue;
      if (panelH < 120 && !force) return null;
      const cx = Math.round(MARGIN + w / 2);
      const rowY = MARGIN + stageH - 20;
      const doneW = 76;
      const nameW = Math.min(124, w - doneW - 6 - 8);
      const left = cx - ((nameW + 6 + doneW) >> 1);
      const name = { x: left, y: rowY + 1, w: nameW, h: 18 };
      const done = { x: left + nameW + 6, y: rowY, w: doneW, h: 20 };
      const fig = this.fitFigure(cx, titleBottom + 4, rowY - 2, w, s);
      if (!fig) continue;
      return {
        wide: false,
        stage: { ...stage0, h: stageH },
        ...fig,
        titleY: MARGIN + 3,
        back: this.first ? null : { x: MARGIN, y: MARGIN, w: 40, h: 16 },
        name,
        done,
        panel: { x: MARGIN, y: MARGIN + stageH + GAP, w, h: panelH },
      };
    }
    return null;
  }

  /** The wanderer's zoom and spot between `top` and `bottom`, with the dice, emotes and turning arrows round it. */
  private fitFigure(cx: number, top: number, bottom: number, stageW: number, want?: number): Pick<Plan, 's' | 'feetX' | 'feetY' | 'dice' | 'emotes' | 'turnL' | 'turnR'> | null {
    const avail = bottom - top;
    // The figure runs 41 of its pixels above the soles and its cloud a few below (the rest tucks under the name plate).
    const s = want ?? clamp(Math.min(Math.floor(avail / 45), Math.floor(stageW / (PEDESTAL_W * 0.85))), 2, 6);
    if (45 * s > avail + 2) return null;
    const feetY = Math.round(top + 41 * s + Math.max(0, Math.floor((avail - 45 * s) / 2)));
    const mid = feetY - 22 * s;
    const left = Math.round(cx - stageW / 2) + 2;
    const right = Math.round(cx + stageW / 2) - 2 - BTN;
    const colTop = Math.max(top, Math.round(mid - (4 * BTN + 9) / 2));
    const emotes = EMOTES.map((_, i) => ({ x: right, y: colTop + i * (BTN + 3), w: BTN, h: BTN }));
    const turnY = feetY - 2 * s - 9;
    const off = Math.min(15 * s, Math.floor(stageW / 2) - 2 - 16);
    return {
      s,
      feetX: cx,
      feetY,
      dice: { x: left, y: colTop, w: BTN + 2, h: BTN + 2 },
      emotes,
      turnL: { x: cx - off - 16, y: turnY, w: 16, h: 16 },
      turnR: { x: cx + off, y: turnY, w: 16, h: 16 },
    };
  }

  /** The page's input laid over the name plate, in CSS pixels. */
  private placeNameField(): void {
    const rect = this.game.canvas.getBoundingClientRect();
    const k = (rect.width / this.scale.width) * this.z;
    const r = this.plan.name;
    this.nameField.place(rect.left + r.x * k, rect.top + r.y * k, r.w * k, r.h * k);
  }

  // ---------------------------------------------------------------- The stage

  private drawStage(): void {
    this.stageUi.removeAll(true);
    this.fixed = [];
    const P = this.plan;
    const g = this.add.graphics();
    this.stageUi.add(g);
    const cx = P.stage.x + P.stage.w / 2;

    // The title over the sky, and the welcome the first time.
    const lines = this.first ? ['Welcome, wanderer', 'Who will you be?'] : ['Dressing room'];
    lines.forEach((t, i) => {
      const txt = softText(this, 0, P.titleY + i * 11, t);
      let x = Math.round(cx - txt.width / 2);
      if (P.back && x < P.back.x + P.back.w + 4) x = P.back.x + P.back.w + 4;
      txt.setX(x);
      this.stageUi.add(txt);
    });

    if (P.back) {
      const b = P.back;
      drawCard(g, b.x, b.y, b.w, b.h, CREAM_CARD);
      this.icon(this.stageUi, 'left', b.x + 5, b.y + 4).setTint(C.rose);
      this.stageUi.add(inkText(this, b.x + 12, b.y + 5, 'Back'));
      this.fixed.push({ ...b, tap: () => this.leave(false) });
    }

    // Dice for a whole new person.
    const d = P.dice;
    drawCard(g, d.x, d.y, d.w, d.h, CLOUD_CARD);
    this.icon(this.stageUi, 'dice', d.x + (d.w >> 1), d.y + (d.h >> 1), true);
    this.fixed.push({ ...d, tap: () => this.randomize() });

    // The emotes to try.
    P.emotes.forEach((r, i) => {
      drawCard(g, r.x, r.y, r.w, r.h, CLOUD_CARD);
      this.icon(this.stageUi, EMOTES[i].icon, r.x + (r.w >> 1), r.y + (r.h >> 1), true);
      this.fixed.push({ ...r, tap: () => this.preview.emote(EMOTES[i].e) });
    });

    // Turning arrows by the cloud.
    for (const [r, dir, icon] of [[P.turnL, -1, 'left'], [P.turnR, 1, 'right']] as const) {
      drawCard(g, r.x, r.y, r.w, r.h, CLOUD_CARD, 0.92);
      this.icon(this.stageUi, icon, r.x + (r.w >> 1), r.y + (r.h >> 1), true).setTint(0xf2b0c4);
      this.fixed.push({ ...r, tap: () => this.preview.turn(dir) });
    }

    // Done: rosy, gold-rimmed, a tick and the word.
    const D = P.done;
    drawCard(g, D.x, D.y, D.w, D.h, ROSE_CARD);
    g.fillStyle(0xffffff, 0.35).fillRect(D.x + 3, D.y + 3, D.w - 6, 1);
    const label = softText(this, 0, 0, 'Done');
    const tick = this.icon(this.stageUi, 'check', 0, 0);
    const lw = tick.width + 3 + label.width;
    const lx = Math.round(D.x + (D.w - lw) / 2);
    tick.setPosition(lx, D.y + 6);
    label.setPosition(lx + tick.width + 3, D.y + 5);
    this.stageUi.add(label);
    this.fixed.push({ ...D, tap: () => this.leave(true) });
  }

  /** The name plate: the name in ink (or an invitation), a pencil, the caret while typing. */
  private drawPlate(): void {
    this.plateUi.removeAll(true);
    this.plateHint = null;
    this.caret = null;
    const r = this.plan.name;
    const g = this.add.graphics();
    this.plateUi.add(g);
    const focused = this.nameField.focused;
    drawCard(g, r.x, r.y, r.w, r.h, focused ? { ...CREAM_CARD, border: C.gold, lit: C.goldLit, dark: C.goldDeep } : CREAM_CARD);
    // Ribbon tails either side, so it reads as a name plate rather than a button.
    g.fillStyle(0xe9a3b6).fillRect(r.x - 4, r.y + 5, 4, 9).fillRect(r.x + r.w, r.y + 5, 4, 9);
    g.fillStyle(0xc96f8c).fillRect(r.x - 4, r.y + 13, 4, 1).fillRect(r.x + r.w, r.y + 13, 4, 1).fillRect(r.x - 4, r.y + 5, 1, 9).fillRect(r.x + r.w + 3, r.y + 5, 1, 9);
    this.icon(this.plateUi, 'pencil', r.x + r.w - 12, r.y + 5);
    const name = this.nameField.value;
    const room = r.w - 20;
    if (name) {
      let shown = name.toUpperCase();
      while (inkWidth(shown) > room && shown.length > 1) shown = shown.slice(1);
      const x = Math.round(r.x + 4 + (room - inkWidth(shown)) / 2);
      this.plateUi.add(inkText(this, x, r.y + 6, shown));
      this.caret = this.add.rectangle(x + inkWidth(shown) + 1, r.y + 5, 1, 9, C.rose).setOrigin(0);
    } else {
      const hint = inkText(this, 0, r.y + 6, focused ? '' : 'Tap to name', C.inkSoft);
      hint.setX(Math.round(r.x + 4 + (room - hint.width) / 2));
      this.plateUi.add(hint);
      if (this.first && !focused) this.plateHint = hint;
      this.caret = this.add.rectangle(Math.round(r.x + 4 + room / 2), r.y + 5, 1, 9, C.rose).setOrigin(0);
    }
    this.plateUi.add(this.caret);
  }

  // ---------------------------------------------------------------- The panel

  private drawPanel(): void {
    const P = this.plan.panel;
    const bodyY = P.y + TAB_H - 2;
    const bodyH = P.h - TAB_H + 2;
    const key = panelTexture(this, 'panel', P.w, bodyH, PARCHMENT);
    if (this.panelKey && this.panelKey !== key && this.textures.exists(this.panelKey)) {
      this.panelImg.setTexture(key);
      this.textures.remove(this.panelKey);
    }
    this.panelKey = key;
    this.panelImg.setTexture(key).setPosition(P.x, bodyY);
    this.view = { x: P.x + PAD, y: bodyY + 6, w: P.w - 2 * PAD - 4, h: bodyH - 12 };
    this.maskG.clear().fillStyle(0xffffff).fillRect(this.view.x - 2, this.view.y, this.view.w + 4, this.view.h);
    this.drawTabs();
  }

  private drawTabs(): void {
    const P = this.plan.panel;
    const bodyY = P.y + TAB_H - 2;
    this.tabsBack.clear();
    this.tabsFront.removeAll(true);
    const front = this.add.graphics();
    this.tabsFront.add(front);
    const tabW = Math.min(30, Math.floor((P.w - 12 - (TABS.length - 1) * 2) / TABS.length));
    const x0 = Math.round(P.x + (P.w - (TABS.length * tabW + (TABS.length - 1) * 2)) / 2);
    TABS.forEach((t, i) => {
      const x = x0 + i * (tabW + 2);
      const on = i === this.tab;
      if (on) {
        drawCard(front, x, P.y, tabW, TAB_H + 1, PARCHMENT);
        // Join the tab to the panel: no border between them.
        front.fillStyle(0xfffcf4).fillRect(x + 2, bodyY, tabW - 4, 4);
        front.fillStyle(C.goldLit).fillRect(x + 1, bodyY, 1, 3);
        front.fillStyle(C.goldDeep).fillRect(x + tabW - 2, bodyY, 1, 3);
      } else drawCard(this.tabsBack, x, P.y + 3, tabW, TAB_H, CLOUD_CARD);
      const ic = this.icon(this.tabsFront, t.icon, x + (tabW >> 1), P.y + (on ? 10 : 12), true);
      if (!on) ic.setAlpha(0.7);
      // The inactive tabs sit under the panel, but their taps still count over the part that shows.
      this.fixed.push({ x, y: P.y, w: tabW, h: TAB_H - 1, tap: () => this.openTab(i) });
    });
  }

  private openTab(i: number): void {
    if (i === this.tab) return;
    this.tab = i;
    this.scroll = 0;
    this.fling = 0;
    this.armed = null;
    this.shown.clear();
    this.thumbs.clear();
    const face = TABS[i].face;
    if (face) this.preview.face(face);
    // The tabs' taps were made with the stage's; rebuild both lists.
    this.drawStage();
    this.drawTabs();
    this.buildContent();
  }

  /** The current tab's rows, rebuilt from scratch whenever anything changes (a few dozen small objects). */
  private buildContent(): void {
    this.content.removeAll(true);
    this.inner = [];
    const g = this.add.graphics();
    this.content.add(g);
    const cw = this.view.w;
    const tab = TABS[this.tab];
    let slot = 0;

    // Heading: the tab's name, then a gold rule ending in a little diamond.
    const head = inkText(this, 0, 1, tab.name, C.plum);
    this.content.add(head);
    const rx = head.width + 5;
    g.fillStyle(C.gold).fillRect(rx, 4, cw - rx - 4, 1);
    g.fillStyle(C.goldLit).fillRect(rx, 3, cw - rx - 4, 1);
    g.fillStyle(C.gold).fillRect(cw - 3, 2, 1, 5).fillRect(cw - 4, 3, 3, 3);
    let y = 14;

    for (const row of tab.rows) {
      if (row.kind === 'outfits') {
        y = this.outfitsRow(g, y, cw);
        continue;
      }
      const list = row.list as Named[];
      const value = this.look[row.key];
      const dim = row.kind === 'color' && row.of ? unworn(FIELDS.find((f) => f.key === row.of)!.list as Named[], this.look[row.of]) : false;
      const a = dim ? 0.45 : 1;

      // The label line: what it is, and on the right the pick's place in its list or the colour's name.
      this.content.add(inkText(this, 0, y, row.label, C.inkSoft).setAlpha(a));
      if (row.kind === 'pick') {
        const n = `${value + 1}/${list.length}`;
        this.content.add(inkText(this, cw - inkWidth(n), y, n, C.inkFaint).setAlpha(a));
      } else {
        const name = list[value]?.name ?? '';
        const nx = cw - inkWidth(name);
        this.content.add(inkText(this, nx, y, name, C.ink).setAlpha(a));
        const chip = hexNum(colorOf(list, value) ?? '#ffffff');
        g.fillStyle(0x8a5a5e, a).fillRect(nx - 10, y - 1, 8, 8);
        g.fillStyle(chip, a).fillRect(nx - 9, y, 6, 6);
      }
      y += LABEL_H;

      if (row.kind === 'pick' && row.seg) {
        // A short list: every option as a segment, the picked one rosy.
        const n = list.length;
        const sw = Math.floor((cw - (n - 1) * 3) / n);
        list.forEach((o, i) => {
          const x = i * (sw + 3);
          const on = i === value;
          drawCard(g, x, y, sw, CTRL_H, on ? ROSE_CARD : CREAM_CARD);
          const t = on ? softText(this, 0, y + 3, o.name) : inkText(this, 0, y + 5, o.name);
          t.setX(Math.round(x + (sw - t.width) / 2));
          this.content.add(t);
          this.inner.push({ x, y, w: sw, h: CTRL_H, tap: () => this.set(row.key, i, row.face) });
        });
        y += CTRL_H;
      } else if (row.kind === 'pick') {
        // Arrows round the picked option's name; the field itself steps forward too.
        const step = (d: number) => () => this.set(row.key, (value + d + list.length) % list.length, row.face);
        this.arrowButton(g, 0, y, 'left', a);
        this.arrowButton(g, cw - CTRL_H, y, 'right', a);
        drawCard(g, CTRL_H + 2, y, cw - 2 * CTRL_H - 4, CTRL_H, FIELD, a);
        const name = inkText(this, 0, y + 5, list[value]?.name ?? '', C.ink).setAlpha(a);
        name.setX(Math.round((cw - name.width) / 2));
        this.content.add(name);
        this.inner.push({ x: -2, y: y - 2, w: CTRL_H + 3, h: CTRL_H + 4, tap: step(-1) });
        this.inner.push({ x: cw - CTRL_H - 1, y: y - 2, w: CTRL_H + 3, h: CTRL_H + 4, tap: step(1) });
        this.inner.push({ x: CTRL_H + 2, y, w: cw - 2 * CTRL_H - 4, h: CTRL_H, tap: step(1) });
        y += CTRL_H;
        if (row.thumb) {
          // A picture of each option on the wanderer being made.
          y += 4;
          const cols = Math.max(1, Math.floor((cw + TILE_GAP) / (TILE + TILE_GAP)));
          const ox = Math.floor((cw - (cols * TILE + (cols - 1) * TILE_GAP)) / 2);
          list.forEach((_, i) => {
            const x = ox + (i % cols) * (TILE + TILE_GAP);
            const ty = y + Math.floor(i / cols) * (TILE + TILE_GAP);
            drawCard(g, x, ty, TILE, TILE, i === value ? TILE_PICKED : TILE_CARD);
            const s = slot++;
            this.queueThumb(s, row.thumb!, row.key, i);
            this.content.add(this.add.image(x + 2, ty + 2, this.thumbs.thumbKey, `t${s}`).setOrigin(0));
            this.inner.push({ x, y: ty, w: TILE, h: TILE, tap: () => this.set(row.key, i, row.face) });
          });
          y += Math.ceil(list.length / cols) * (TILE + TILE_GAP) - TILE_GAP;
        }
      } else {
        // Swatches, the picked one lifted in a gold ring.
        const cols = Math.max(1, Math.floor((cw + SWATCH_STEP - SWATCH) / SWATCH_STEP));
        const ox = Math.floor((cw - ((cols - 1) * SWATCH_STEP + SWATCH)) / 2);
        list.forEach((_, i) => {
          const x = ox + (i % cols) * SWATCH_STEP;
          const sy = y + 1 + Math.floor(i / cols) * SWATCH_STEP;
          this.swatch(g, x, sy, hexNum(colorOf(list, i) ?? '#ffffff'), i === value, a);
          this.inner.push({ x: x - 1, y: sy - 1, w: SWATCH_STEP, h: SWATCH_STEP, tap: () => this.set(row.key, i) });
        });
        y += Math.ceil(list.length / cols) * SWATCH_STEP;
      }
      y += ROW_GAP;
    }

    this.contentH = y + 2;
    this.scrollTo(this.scroll);
  }

  /** The wardrobe: a hanger per outfit with a tiny portrait; tap an empty one to keep, a kept one to wear. */
  private outfitsRow(g: Phaser.GameObjects.Graphics, y: number, cw: number): number {
    const cols = clamp(Math.floor((cw + 4) / 48), 2, 4);
    const cardW = Math.floor((cw - (cols - 1) * 4) / cols);
    const cardH = WFH + 22;
    for (let i = 0; i < OUTFIT_SLOTS; i++) {
      const x = (i % cols) * (cardW + 4);
      const cy = y + Math.floor(i / cols) * (cardH + 4);
      const saved = profile.outfit(i);
      const worn = !!saved && sameOutfit(saved, this.look);
      drawCard(g, x, cy, cardW, cardH, worn ? TILE_PICKED : TILE_CARD);
      // A little brass hook at the top of each.
      g.fillStyle(C.goldDeep).fillRect(x + (cardW >> 1) - 1, cy + 2, 3, 1);
      g.fillStyle(C.gold).fillRect(x + (cardW >> 1), cy + 3, 1, 2);
      this.content.add(inkText(this, x + 4, cy + 4, String(i + 1), C.inkFaint));
      const px = x + Math.round((cardW - 32) / 2);
      if (saved) {
        this.thumbs.outfit(i, () => wearOutfit(this.look, saved));
        this.content.add(this.add.image(px, cy + 4, this.thumbs.outfitKey, `o${i}`).setOrigin(0));
        this.inner.push({ x, y: cy, w: cardW, h: cardH - 16, tap: () => this.wear(saved) });
        // Replace and clear, each asking for a second tap.
        const bw = Math.min(16, Math.floor((cardW - 6) / 2));
        for (const [act, bx, icon] of [['keep', x + 2, 'keep'], ['clear', x + cardW - 2 - bw, 'cross']] as const) {
          const hot = this.armed?.slot === i && this.armed.act === act;
          drawCard(g, bx, cy + cardH - 15, bw, 13, hot ? ROSE_CARD : CREAM_CARD);
          this.icon(this.content, icon, bx + (bw >> 1), cy + cardH - 9, true).setTint(hot ? 0xffffff : C.rose);
          this.inner.push({ x: bx - 1, y: cy + cardH - 16, w: bw + 2, h: 16, tap: () => this.armOrDo(i, act) });
        }
      } else {
        this.thumbs.outfit(i, null);
        g.fillStyle(0xead8b4).fillRect(px + 6, cy + 14, 20, 1);
        this.icon(this.content, 'plus', x + (cardW >> 1), cy + 26, true).setTint(C.gold);
        const t = inkText(this, 0, cy + cardH - 12, 'Keep', C.inkSoft);
        t.setX(Math.round(x + (cardW - t.width) / 2));
        this.content.add(t);
        this.inner.push({ x, y: cy, w: cardW, h: cardH, tap: () => this.keep(i) });
      }
    }
    y += Math.ceil(OUTFIT_SLOTS / cols) * (cardH + 4) + 2;
    const hint = this.armed
      ? this.armed.act === 'keep'
        ? 'Tap again to keep what you wear now in its place.'
        : 'Tap again to clear this hanger.'
      : 'Tap an empty hanger to keep what you wear. Tap a kept outfit to put it on.';
    const t = inkText(this, 0, y, hint, this.armed ? C.roseDeep : C.inkSoft).setMaxWidth(cw);
    this.content.add(t);
    return y + t.height + ROW_GAP;
  }

  private arrowButton(g: Phaser.GameObjects.Graphics, x: number, y: number, dir: 'left' | 'right', a: number): void {
    drawCard(g, x, y, CTRL_H, CTRL_H, ROSE_CARD, a);
    this.icon(this.content, dir, x + (CTRL_H >> 1), y + (CTRL_H >> 1), true).setAlpha(a);
  }

  private swatch(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, on: boolean, a: number): void {
    if (on) {
      // Lifted a pixel, in a gold ring with a glint.
      y -= 1;
      g.fillStyle(C.goldDeep, a).fillRect(x - 1, y - 1, SWATCH + 2, SWATCH + 2);
      g.fillStyle(C.goldLit, a).fillRect(x - 1, y - 1, SWATCH + 1, 1).fillRect(x - 1, y - 1, 1, SWATCH + 1);
      g.fillStyle(C.gold, a).fillRect(x, y, SWATCH, SWATCH);
      g.fillStyle(c, a).fillRect(x + 2, y + 2, SWATCH - 4, SWATCH - 4);
      g.fillStyle(0xffffff, a * 0.9).fillRect(x + 3, y + 3, 2, 1).fillRect(x + 3, y + 4, 1, 1);
      g.fillStyle(0x6b4560, 0.18 * a).fillRect(x, y + SWATCH + 1, SWATCH, 1);
    } else {
      g.fillStyle(0xa98a8e, a).fillRect(x + 1, y, SWATCH - 2, SWATCH).fillRect(x, y + 1, SWATCH, SWATCH - 2);
      g.fillStyle(c, a).fillRect(x + 1, y + 1, SWATCH - 2, SWATCH - 2);
      g.fillStyle(0xffffff, 0.35 * a).fillRect(x + 1, y + 1, SWATCH - 3, 1);
      g.fillStyle(0x000000, 0.12 * a).fillRect(x + 1, y + SWATCH - 2, SWATCH - 2, 1);
    }
  }

  /** An icon from the sheet, by its top-left corner or (centred) by its middle, added to a container. */
  private icon(parent: Phaser.GameObjects.Container, name: IconName, x: number, y: number, centred = false): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, 'hl_cr_icons', name).setOrigin(0);
    if (centred) img.setPosition(Math.round(x - img.width / 2), Math.round(y - img.height / 2));
    parent.add(img);
    return img;
  }

  private queueThumb(slot: number, kind: ThumbKind, key: Key, i: number): void {
    const code = encodeLook({ ...this.look, [key]: i });
    const id = `t${slot}`;
    if (this.shown.get(id) === code) return;
    this.shown.set(id, code);
    this.thumbs.thumb(slot, kind, () => ({ ...this.look, [key]: i }));
  }

  // ---------------------------------------------------------------- Scrolling

  private get maxScroll(): number {
    return Math.max(0, this.contentH - this.view.h);
  }

  private scrollTo(v: number): void {
    this.scroll = clamp(v, 0, this.maxScroll);
    const y = this.view.y - this.scroll;
    this.content.setPosition(this.view.x, Math.round(y * this.z) / this.z);
    const g = this.scrollbar.clear();
    if (this.maxScroll <= 0) return;
    // A slim gold thumb on a faint track down the panel's right side.
    const tx = this.view.x + this.view.w + 3;
    g.fillStyle(0xe9d6b0).fillRect(tx, this.view.y, 2, this.view.h);
    const th = Math.max(14, Math.round((this.view.h * this.view.h) / this.contentH));
    const ty = this.view.y + Math.round((this.scroll / this.maxScroll) * (this.view.h - th));
    g.fillStyle(C.gold).fillRect(tx, ty, 2, th);
    g.fillStyle(C.goldLit).fillRect(tx, ty, 1, th);
  }

  // ---------------------------------------------------------------- Input

  private hotAt(x: number, y: number): { hot: Hot | null; content: boolean } {
    // Fixed ones last added are on top (the panel's tabs over the stage's).
    for (let i = this.fixed.length - 1; i >= 0; i--) if (inside(this.fixed[i], x, y)) return { hot: this.fixed[i], content: false };
    if (inside(this.view, x, y)) {
      const cx = x - this.view.x;
      const cy = y - this.view.y + this.scroll;
      return { hot: this.inner.find((h) => inside(h, cx, cy)) ?? null, content: true };
    }
    return { hot: null, content: false };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.nameField.focused) this.nameField.blur();
    const x = p.x / this.z;
    const y = p.y / this.z;
    const { hot, content } = this.hotAt(x, y);
    const stage = !hot && !content && inside(this.plan.stage, x, y);
    this.press = { hot, content, stage, x, y, scroll: this.scroll, dragging: false, turnX: x, lastY: y, lastT: this.now, vel: 0 };
    this.fling = 0;
    this.drawPress();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    if (!pr || !p.isDown) return;
    const x = p.x / this.z;
    const y = p.y / this.z;
    if (pr.content) {
      if (!pr.dragging && Math.abs(y - pr.y) > DRAG_START && this.maxScroll > 0) {
        pr.dragging = true;
        pr.hot = null;
        this.drawPress();
      }
      if (pr.dragging) {
        const dt = Math.max(1, this.now - pr.lastT);
        pr.vel = pr.vel * 0.5 + ((pr.lastY - y) / dt) * 0.5;
        pr.lastY = y;
        pr.lastT = this.now;
        this.scrollTo(pr.scroll - (y - pr.y));
      }
    } else if (pr.stage) {
      // Dragging across the stage turns the wanderer, a step every little way.
      while (x - pr.turnX >= TURN_DRAG) {
        pr.turnX += TURN_DRAG;
        this.preview.turn(1);
      }
      while (pr.turnX - x >= TURN_DRAG) {
        pr.turnX -= TURN_DRAG;
        this.preview.turn(-1);
      }
    } else if (pr.hot && !inside(pr.hot, x, y)) {
      pr.hot = null;
      this.drawPress();
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    this.press = null;
    this.pressG.clear();
    if (!pr) return;
    if (pr.dragging) {
      this.fling = this.now - pr.lastT < 80 ? pr.vel : 0;
      return;
    }
    if (!pr.hot) return;
    const { hot } = this.hotAt(p.x / this.z, p.y / this.z);
    if (hot === pr.hot) pr.hot.tap();
  }

  /** A soft light over whatever is being pressed. */
  private drawPress(): void {
    const g = this.pressG.clear();
    const pr = this.press;
    if (!pr?.hot) return;
    let { x, y } = pr.hot;
    const { w, h } = pr.hot;
    if (pr.content) {
      x += this.view.x;
      y += this.view.y - this.scroll;
      // Only inside the list's window.
      const top = Math.max(y, this.view.y);
      const bottom = Math.min(y + h, this.view.y + this.view.h);
      if (bottom <= top) return;
      g.fillStyle(0xffffff, 0.35).fillRect(x + 1, top, w - 2, bottom - top);
      return;
    }
    g.fillStyle(0xffffff, 0.35).fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  // ---------------------------------------------------------------- Changes

  private set(key: Key, value: number, face?: 'down' | 'up'): void {
    if (this.look[key] === value) return;
    this.look = { ...this.look, [key]: value };
    this.changed();
    if (face && value > 0) this.preview.face(face);
  }

  private changed(): void {
    this.armed = null;
    this.preview.setLook(this.look);
    this.buildContent();
  }

  private randomize(): void {
    this.look = randomLook();
    this.changed();
  }

  private wear(outfit: Appearance): void {
    this.look = wearOutfit(this.look, outfit);
    this.changed();
  }

  private keep(slot: number): void {
    profile.keepOutfit(slot, this.look);
    this.armed = null;
    this.buildContent();
  }

  private armOrDo(slot: number, act: 'keep' | 'clear'): void {
    if (this.armed?.slot === slot && this.armed.act === act) {
      this.armed = null;
      profile.keepOutfit(slot, act === 'keep' ? this.look : null);
    } else this.armed = { slot, act, at: this.now };
    this.buildContent();
  }

  /** Hearts, notes or stars floating up from an emote. */
  private floatUp(e: PreviewEmote): void {
    const kind = EMOTES.find((m) => m.e === e)?.float;
    if (!kind) return;
    const P = this.plan;
    for (let i = 0; i < 3; i++) {
      const img = this.add
        .image(P.feetX + (i - 1) * 7 * P.s * 0.6, P.feetY - 38 * P.s, 'hl_cr_icons', kind)
        .setOrigin(0.5)
        .setDepth(8)
        .setAlpha(0);
      this.tweens.add({
        targets: img,
        y: img.y - 18 - i * 4,
        alpha: { from: 1, to: 0 },
        delay: i * 260,
        duration: 1300,
        ease: 'Sine.easeOut',
        onStart: () => img.setAlpha(1),
        onComplete: () => img.destroy(),
      });
    }
  }

  private leave(save: boolean): void {
    if (save) profile.set(cleanName(this.nameField.value), this.look);
    this.scene.start('home');
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.input.removeAllListeners(Phaser.Input.Events.POINTER_WHEEL);
    this.nameField.destroy();
    this.preview.destroy();
    this.content.clearMask(true);
    this.maskG.destroy();
    // Everything this scene painted goes with it: nothing waits in GPU memory for the next visit.
    for (const key of this.textures.getTextureKeys()) if (key.startsWith('hl_cr_')) this.textures.remove(key);
  }
}
