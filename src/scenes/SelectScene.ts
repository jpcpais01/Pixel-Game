import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';
import { menuZoom } from '../game/display';
import { CLASSES, type ClassDef, type Preview, type SkinDef } from '../game/characters';
import { heroStats, type HeroStats } from '../game/stats';
import { lastHero, lastLookOf, lookOf, ownsSkin, rememberHero, setLook, setType, worn } from '../game/skins';
import { RARITY_INFO, rarityOf } from '../game/gacha';
import { ensureUltIcons, ultFor } from '../game/ultimate';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

// The hero select, read top to bottom as the three steps of picking a hero:
// the class's name over the page; a lit stage where every character of that
// class stands on its own pedestal (the picked one in the light, the others in
// shadow, each tappable); and under them, the picked character's skins. A
// panel beside the stage shows the picked character's stats, abilities and
// Special, and a roster of every class runs along the bottom. It is all built
// from CLASSES, so new classes, characters and skins show up by themselves.

/** Roster tiles: a small window onto the hero at 1x. */
const TILE_W = 28;
const TILE_H = 36;
const TILE_GAP = 3;
/** The stage on the left and the info panel on the right, the same height. */
const STAGE_W = 228;
const INFO_W = 188;
const MAIN_H = 150;
const MAIN_GAP = 6;
const PAD = 7;
/** Stage rows, from its top: the class's line, the characters' feet, and the skin strip under them. */
const BAND_Y = 5;
const BAND_H = 14;
const SKIN_H = 22;
const SKIN_Y = MAIN_H - 3 - SKIN_H;
const FEET_Y = SKIN_Y - 19;
/** A name plate across the front of each pedestal. */
const PLATE_Y = FEET_Y + 6;
const PLATE_H = 11;
/** The most characters one class shows side by side. */
const MAX_FIGURES = 4;
/** Rows in the info panel, from its top. */
const NAME_Y = 6;
const ROLE_Y = 23;
const RULE1_Y = 33;
const STATS_Y = 38;
const STAT_ROW = 11;
/** Stats, three to a row: a short name, and how its value reads (ATK/S: attacks a second; REGEN: HP a second). */
const STAT_GRID: [string, (s: HeroStats) => string][][] = [
  [
    ['HP', (s) => `${s.hp}`],
    ['DMG', (s) => `${s.damage}`],
    ['MOVE', (s) => `${s.speed}`],
  ],
  [
    ['DEF', (s) => `${s.defense}`],
    ['ATK/S', (s) => s.rate.toFixed(1)],
    ['REGEN', (s) => `${s.regen}`],
  ],
];
/** Where each stat column starts, and where its values start after its longest name. */
const STAT_COL_X = [0, 54, 116];
const STAT_VALUE_X = [22, 34, 34];
const RULE2_Y = STATS_Y + STAT_ROW * 2 + 1;
const ABIL_Y = RULE2_Y + 5;
const ABIL_ROW = 22;
const ICON_BOX = 18;
/** The Special: a gold strip across the bottom of the panel. */
const SPECIAL_Y = ABIL_Y + ABIL_ROW * 2 + 3;
const SPECIAL_H = 24;
const MOTES = 7;
/** Buttons and margins. */
const MARGIN = 8;
const BACK_W = 48;
const NEXT_W = 64;
const BUTTON_H = 20;
/** How far a press on the stage must travel sideways to count as a swipe to the next class. */
const SWIPE = 24;
const TAP_SLOP = 5;
/** How long a note (a locked skin) replaces the skin's name. */
const NOTE_MS = 1800;

/** The class picked last, kept while the game runs. */
let lastPicked: number | null = null;

const INK = 0xfff4d6;
const LAVENDER = 0xb8a8e8;
const SOFT = 0x9a8cd0;
const GOLD = 0xf4cf6a;
const DIMMED = 0x8a84a8;
/** Characters not picked stand in shadow. */
const SHADOWED = 0x6a6290;
const LOCKED = 0x4a4468;
const OUTLINE = 0x0b0818;

/** Trim a single line to `maxW`, ending in a dot, as a last resort for text too long to fit. */
export function fitLine(probe: Phaser.GameObjects.BitmapText, text: string, maxW: number): string {
  let t = text.toUpperCase();
  while (t.length > 1 && probe.setText(t).width > maxW) t = t.slice(0, -2).trimEnd() + '.';
  return t;
}

/** True when a released pointer moved too far from where it went down to be a tap. */
const dragged = (scene: Phaser.Scene, p: Phaser.Input.Pointer): boolean => p.getDistance() / scene.cameras.main.zoom > TAP_SLOP;

/** Call `onTap` when a press on `target` is released on it without having moved. */
function onTap(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, tap: () => void): void {
  let pressed = false;
  target.setInteractive({ useHandCursor: true });
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => (pressed = true));
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (pressed = false));
  target.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
    if (pressed && !dragged(scene, p)) tap();
    pressed = false;
  });
}

/** Crop a sprite (in frame pixels) to a window `w` x `up` above its feet and `down` below, drawn at `scale`. */
export function cropToWindow(s: Phaser.GameObjects.Sprite, preview: Preview, w: number, up: number, down: number, scale: number): void {
  // Every frame of a look's animations is the same size; measure the first idle frame.
  const frame = s.scene.anims.get(preview.idle)?.frames[0]?.frame ?? s.scene.textures.getFrame(preview.texture);
  const fw = frame.width;
  const fh = frame.height;
  const feet = (preview.originY ?? 31 / 32) * fh;
  const cw = Math.min(fw, Math.floor(w / scale));
  const top = Math.max(0, Math.round(feet - up / scale));
  const bottom = Math.min(fh, Math.round(feet + down / scale));
  s.setCrop(Math.round((fw - cw) / 2), top, cw, bottom - top);
}

// ---- Art for the stage, painted once per size and cached. ----

const RIM = hex('#43356e');

/**
 * The stage's backdrop: a dim hall with two pillars, and a tiled floor that
 * runs back to the wall. Painted in greys, so tinting it gives the hall the
 * shade of the hero on show.
 */
function stageTexture(scene: Phaser.Scene, w: number, h: number, feet: number): string {
  const key = `sel_stage_${w}x${h}_${feet}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const floorY = feet - 12;
  const outer = grey(14);
  const rim = grey(105);
  const rimLit = grey(170);
  const wallTop = grey(14);
  const wallLow = grey(74);
  const pillar = grey(96);
  const pillarLit = grey(128);
  const floorFar = grey(96);
  const floorNear = grey(52);
  const mortar = grey(24);
  const black = grey(8);
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey === 0) continue;
      if (ex === 0 || ey === 0) {
        b.set(x, y, outer);
        continue;
      }
      if (ex === 1 || ey === 1) {
        b.set(x, y, y === 1 || x === 1 ? rimLit : rim);
        continue;
      }
      let c: RGB;
      if (y < floorY) {
        const f = y / floorY;
        c = mix(wallTop, wallLow, Math.min(1, Math.floor(f * 5 + bayer(x, y)) / 5));
        // Two pillars framing the hero, lit from the middle.
        const px = Math.min(Math.abs(x - 14), Math.abs(x - (w - 15)));
        if (px <= 4) {
          const inner = x < cx ? x - 14 : w - 15 - x;
          c = inner >= 3 ? pillarLit : mix(pillar, wallTop, 1 - f);
          if (y % 22 === 0) c = mortar;
        }
      } else if (y === floorY) {
        c = RIM;
      } else {
        // Floor tiles in rough perspective: rows grow and columns fan out towards the viewer.
        const d = y - floorY;
        const f = d / (h - floorY);
        c = mix(floorFar, floorNear, Math.min(1, Math.floor(f * 4 + bayer(x, y)) / 4));
        const rows = [3, 8, 15, 24];
        const spread = 1 + d / 9;
        if (rows.includes(d) || Math.abs(((x - cx) / spread) % 12) < 0.5 / spread + 0.3) c = mix(c, mortar, 0.7);
      }
      // Darker towards the sides and the top, so the eye goes to the middle.
      const side = Math.abs(x - cx) / cx;
      const v = clamp01(side * side * 0.7 + (y < 12 ? (12 - y) / 24 : 0));
      if (v > bayer(x, y) * 0.9) c = mix(c, black, Math.min(0.55, v));
      b.set(x, y, c);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A soft column of light falling onto the pedestal, white (tinted with the hero's colour), `h` tall. */
function beamTexture(scene: Phaser.Scene, h: number): string {
  const key = `sel_beam_${h}`;
  if (scene.textures.exists(key)) return key;
  const w = 64;
  const b = new Bitmap(w, h);
  const white: RGB = [255, 255, 255];
  for (let y = 0; y < h; y++) {
    const f = y / (h - 1);
    const half = 7 + 23 * f;
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x + 0.5 - w / 2) / half;
      if (dx >= 1) continue;
      const a = 0.6 * Math.pow(f, 0.7) * Math.pow(1 - dx, 1.4);
      // Stepped with a dither so the light reads as pixel art, not a smooth gradient.
      const q = Math.floor(a * 6 + bayer(x, y)) / 6;
      if (q > 0) b.set(x, y, white, Math.round(q * 255));
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

const PED_W = 62;
const PED_H = 22;
const PED_CY = 7;
const PED_RX = 29;
const PED_RY = 6;
const PED_DEPTH = 7;

/** A round stone pedestal: a lit top face with a worn rim, and a shaded drum below it. */
function pedestalTexture(scene: Phaser.Scene): string {
  const key = 'sel_pedestal';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(PED_W, PED_H);
  const cx = PED_W / 2;
  const topLit = hex('#9a8cd0');
  const topDark = hex('#54468f');
  const rim = hex('#cfc2f0');
  const drumLit = hex('#3e3278');
  const drumDark = hex('#191335');
  const edge = hex('#0b0818');
  for (let x = 0; x < PED_W; x++) {
    const dx = (x + 0.5 - cx) / PED_RX;
    if (Math.abs(dx) > 1) continue;
    const ry = PED_RY * Math.sqrt(1 - dx * dx);
    const top = Math.round(PED_CY - ry);
    const bottom = Math.round(PED_CY + ry);
    // The drum: lit on the left, falling off to the right, darker at its foot.
    for (let y = bottom; y <= bottom + PED_DEPTH; y++) {
      const t = clamp01((dx + 1) / 2);
      let c = mix(drumLit, drumDark, Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3));
      if (y === bottom + PED_DEPTH) c = edge;
      else if (y >= bottom + PED_DEPTH - 2) c = mix(c, edge, 0.5);
      b.set(x, y, c);
    }
    // The top face, brighter towards the back left, with a pale rim round the edge.
    for (let y = top; y <= bottom; y++) {
      const dy = (y + 0.5 - PED_CY) / PED_RY;
      const t = clamp01((dx * 0.6 + dy * 0.8 + 1) / 2);
      let c = mix(topLit, topDark, Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3));
      if (y === top || y === bottom || Math.abs(dx) > 0.95) c = y === bottom ? mix(topDark, edge, 0.4) : rim;
      b.set(x, y, c);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A dashed ring of runes on the pedestal's top face, white (tinted with the hero's colour). */
function runesTexture(scene: Phaser.Scene): string {
  const key = 'sel_runes';
  if (scene.textures.exists(key)) return key;
  const rx = PED_RX - 5;
  const ry = PED_RY - 1.5;
  const w = rx * 2 + 2;
  const h = Math.ceil(ry * 2) + 2;
  const b = new Bitmap(w, h);
  const steps = 240;
  for (let i = 0; i < steps; i++) {
    // Twelve marks round the ring, each a dash with a gap after it.
    if (i % 20 >= 14) continue;
    const a = (i / steps) * Math.PI * 2;
    b.set(w / 2 + Math.cos(a) * rx, h / 2 + Math.sin(a) * ry, [255, 255, 255]);
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A tiny spark that drifts up through the light. */
function moteTexture(scene: Phaser.Scene): string {
  const key = 'sel_mote';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(3, 3);
  const white: RGB = [255, 255, 255];
  b.set(1, 1, white);
  for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]]) b.set(x, y, white, 110);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

// ---- Pieces of the page. ----


/** The shade a hero's colour gives the halls behind it: the stage, and its card in the roster. */
function hallShade(accent: number): number {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(accent), Phaser.Display.Color.ValueToColor(0xb8a8e8), 100, 15);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

const grey = (v: number): RGB => [v, v, v];
/** A roster card's panel, in greys so it can take its hero's shade. */
const TILE_PANEL = { top: grey(30), bottom: grey(78), alpha: 0.95, border: grey(58), borderLit: grey(36), outer: grey(12) };

/** The gold rim laid over the picked roster card, clear inside. */
function tileRimTexture(scene: Phaser.Scene): string {
  const key = 'sel_tile_rim';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(TILE_W, TILE_H);
  const lit = hex('#ffe08a');
  const dark = hex('#b8742c');
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const ex = Math.min(x, TILE_W - 1 - x);
      const ey = Math.min(y, TILE_H - 1 - y);
      if (ex + ey <= 1) continue;
      if (ex === 1 || ey === 1) b.set(x, y, y === 1 || x === 1 ? lit : dark);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A class in the roster: a small window onto its hero at 1x, with a pip per character in the class. */
class Tile extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private rim: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private sprite: Phaser.GameObjects.Sprite;
  private pips: Phaser.GameObjects.Graphics;
  private preview?: Preview;
  private shade = 0xffffff;
  private chars = 1;
  private picked = false;

  constructor(scene: Phaser.Scene, tap: () => void) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, panelTexture(scene, 'sel_tile_grey', TILE_W, TILE_H, TILE_PANEL)).setOrigin(0);
    onTap(scene, this.bg, tap);
    this.rim = scene.add.image(0, 0, tileRimTexture(scene)).setOrigin(0);
    const fx = TILE_W / 2;
    const fy = TILE_H - 4;
    this.glow = scene.add.image(fx, fy - 1, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.8, 0.3);
    const shadow = scene.add.image(fx, fy, 'shadow');
    this.sprite = scene.add.sprite(fx, fy, '__DEFAULT');
    this.pips = scene.add.graphics();
    this.add([this.bg, this.glow, shadow, this.sprite, this.rim, this.pips]);
  }

  show(preview: Preview, accent: number, count: number): this {
    if (this.preview !== preview) {
      this.preview = preview;
      this.sprite.setTexture(preview.texture).setOrigin(0.5, preview.originY ?? 31 / 32);
      cropToWindow(this.sprite, preview, TILE_W - 4, TILE_H - 6, 2, 1);
      this.sprite.play(preview.idle);
    }
    this.glow.setTint(accent);
    this.shade = hallShade(accent);
    this.chars = count;
    this.tintBg();
    return this;
  }

  setPicked(on: boolean): this {
    this.picked = on;
    this.rim.setVisible(on);
    this.glow.setAlpha(on ? 0.8 : 0);
    if (on) this.sprite.clearTint();
    else this.sprite.setTint(DIMMED);
    this.tintBg();
    return this;
  }

  /** The card's hall in its hero's shade, dimmer when not picked; and its pips, gold when picked. */
  private tintBg(): void {
    const c = Phaser.Display.Color.IntegerToColor(this.shade);
    const k = this.picked ? 1 : 0.7;
    this.bg.setTint(Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k)));
    // Only classes with a choice of characters get pips, so one hero alone stays clean.
    const g = this.pips.clear();
    if (this.chars < 2) return;
    for (let i = 0; i < this.chars; i++) {
      const x = 3 + i * 4;
      g.fillStyle(OUTLINE).fillRect(x, 3, 4, 4);
      g.fillStyle(this.picked ? GOLD : SOFT).fillRect(x + 1, 4, 2, 2);
    }
  }
}

/** Which skin is worn, out of how many, for the strip under the characters. */
interface SkinPick {
  name: string;
  index: number;
  count: number;
  /** A skin not yet won, being looked at: shown dimmed, with a lock. */
  locked: boolean;
  /** Which of the type's looks the player owns, in picker order. */
  owned: boolean[];
  /** The rarity's colour for a skin, or null for the type's own look. */
  rarity: number | null;
}

/** One character of the class on the stage: how it looks now, its colour and its name. */
interface Slot {
  preview: Preview;
  accent: number;
  name: string;
}

/** A character standing on its own pedestal, with its name on a plate across the pedestal's front. */
class Figure extends Phaser.GameObjects.Container {
  /** What rises in when the look changes: the shadow, the hero and its glow. */
  private rise: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private plate: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.BitmapText;
  private preview?: Preview;
  private size = 0;
  private locked = false;
  plateW = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, FEET_Y);
    const pedestal = scene.add.image(0, 0, pedestalTexture(scene)).setOrigin(0.5, PED_CY / PED_H);
    const shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.glow = scene.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.rise = scene.add.container(0, 0, [shadow, this.sprite, this.glow]);
    this.plate = scene.add.graphics();
    this.label = pixelText(scene, 0, PLATE_Y - FEET_Y + 1, '');
    this.add([pedestal, this.rise, this.plate, this.label]);
  }

  /** Show a look at `scale` in a slot `w` wide; a new look rises in. */
  show(slot: Slot, scale: number, w: number, probe: Phaser.GameObjects.BitmapText): void {
    const { preview } = slot;
    if (this.preview !== preview || this.size !== scale) {
      this.preview = preview;
      this.size = scale;
      const oy = preview.originY ?? 31 / 32;
      const up = FEET_Y - BAND_H;
      this.rise.list.forEach((o) => (o as Phaser.GameObjects.Image).setScale(scale));
      // Drop a pose's queued return to the old look's idle first: stopping plays the queue, and one frame
      // of a smaller hero would clamp this look's crop for good (a samurai after the wizard was cut in half).
      this.sprite.chain();
      this.sprite.stop();
      this.sprite.setTexture(preview.texture).setOrigin(0.5, oy);
      cropToWindow(this.sprite, preview, w - 2, up, 3, scale);
      this.glow.setVisible(!!preview.glow);
      if (preview.glow) {
        this.glow.setTexture(preview.glow).setOrigin(0.5, oy);
        cropToWindow(this.glow, preview, w - 2, up, 3, scale);
      }
      this.sprite.play(preview.idle);
      this.scene.tweens.killTweensOf(this.rise);
      this.rise.setAlpha(0).setY(3);
      this.scene.tweens.add({ targets: this.rise, alpha: 1, y: 0, duration: 160, ease: 'Quad.easeOut' });
    }
    this.label.setText(fitLine(probe, slot.name, w - 8));
    this.plateW = this.label.width + 7;
  }

  /** In the light (picked), in shadow, or brightened a little under the pointer; a locked skin stands dark. */
  light(picked: boolean, hover: boolean, locked: boolean): void {
    this.locked = locked;
    if (locked) this.sprite.setTint(LOCKED);
    else if (picked) this.sprite.clearTint();
    else this.sprite.setTint(hover ? DIMMED : SHADOWED);
    this.glow.setAlpha(locked ? 0.25 : picked ? 1 : hover ? 0.5 : 0.3);
    // The plate: gold-rimmed with bright letters for the picked character, dark for the others.
    const g = this.plate.clear();
    const x = -Math.floor(this.plateW / 2);
    const y = PLATE_Y - FEET_Y;
    g.fillStyle(OUTLINE).fillRect(x, y, this.plateW, PLATE_H);
    g.fillStyle(picked ? 0xb8742c : 0x33285a).fillRect(x + 1, y + 1, this.plateW - 2, PLATE_H - 2);
    g.fillStyle(picked ? 0x2b2258 : 0x17122f).fillRect(x + 2, y + 2, this.plateW - 4, PLATE_H - 4);
    if (picked) g.fillStyle(0xffe08a).fillRect(x + 1, y + 1, this.plateW - 2, 1);
    this.label.setX(x + 4).setTint(picked ? INK : hover ? LAVENDER : SOFT);
  }

  pose(): void {
    if (this.preview && !this.locked) this.sprite.play(this.preview.chosen).chain(this.preview.idle);
  }

  update(): void {
    if (this.glow.visible) this.glow.setFrame(this.sprite.frame.name);
  }
}

/**
 * The stage: a lit hall where every character of the class stands on its own
 * pedestal, the picked one under a beam of light with sparks drifting up
 * through it. Under them, a strip tied to the picked character steps through
 * its skins.
 */
class Stage extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH: number;
  /** The hall behind the characters, tinted with the picked one's shade. */
  readonly bg: Phaser.GameObjects.Image;
  private beam: Phaser.GameObjects.Image;
  private pool: Phaser.GameObjects.Image;
  private runes: Phaser.GameObjects.Image;
  private figures: Figure[] = [];
  private blurb: Phaser.GameObjects.BitmapText;
  private countText: Phaser.GameObjects.BitmapText;
  private strip: Phaser.GameObjects.Graphics;
  private skinLabel: Phaser.GameObjects.BitmapText;
  private skinName: Phaser.GameObjects.BitmapText;
  private lock: Phaser.GameObjects.Image;
  private stepZones: Phaser.GameObjects.Zone[];
  private motes: { img: Phaser.GameObjects.Image; t: number; life: number; x: number; rise: number }[] = [];
  private probe: Phaser.GameObjects.BitmapText;
  /** What the stage shows now, kept to redraw on hover and notes. */
  private slots: Slot[] = [];
  private picked = 0;
  private hover = -1;
  private skin?: SkinPick;
  private accent = 0xffffff;
  /** Where the light falls: over the picked character. */
  private lightX: number;
  /** A note shown in place of the skin's name for a moment. */
  private note: string | null = null;
  private noteTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, w: number, h: number, tapFigure: (i: number) => void, swipe: (dir: -1 | 1) => void, stepSkin: (dir: -1 | 1) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.boxH = h;
    this.lightX = Math.round(w / 2);
    this.bg = scene.add.image(0, 0, stageTexture(scene, w, h, FEET_Y)).setOrigin(0);
    this.beam = scene.add.image(this.lightX, 2, beamTexture(scene, FEET_Y + 2)).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.pool = scene.add.image(this.lightX, FEET_Y + 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6, 0.8);
    this.runes = scene.add.image(this.lightX, FEET_Y, runesTexture(scene)).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.runes, alpha: { from: 0.35, to: 0.9 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (let i = 0; i < MAX_FIGURES; i++) this.figures.push(new Figure(scene));
    this.blurb = pixelText(scene, 0, BAND_Y, '', LAVENDER);
    this.countText = pixelText(scene, 0, BAND_Y, '', GOLD);
    this.probe = pixelText(scene, 0, 0, '').setVisible(false);
    this.strip = scene.add.graphics();
    this.skinLabel = pixelText(scene, 0, 0, 'Skin', SOFT);
    this.skinName = pixelText(scene, 0, 0, '');
    this.lock = scene.add.image(0, 0, 'icon_lock').setOrigin(0).setVisible(false);
    const mote = moteTexture(scene);
    for (let i = 0; i < MOTES; i++) {
      const img = scene.add.image(0, 0, mote).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.motes.push({ img, t: Math.random(), life: 1, x: 0, rise: 0 });
    }
    // Over the characters: a tap picks the one under it (or strikes its pose if already picked), a swipe moves to the next class.
    const hit = scene.add.zone(0, 0, w, SKIN_Y).setOrigin(0).setInteractive({ useHandCursor: true });
    const slotAt = (p: Phaser.Input.Pointer): number => {
      const n = this.slots.length;
      const x = p.x / scene.cameras.main.zoom - this.x;
      return n ? Phaser.Math.Clamp(Math.floor(((x - 4) / (w - 8)) * n), 0, n - 1) : -1;
    };
    let down: { x: number; y: number } | null = null;
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y }));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (p: Phaser.Input.Pointer) => this.setHover(p.wasTouch ? -1 : slotAt(p)));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      down = null;
      this.setHover(-1);
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const z = scene.cameras.main.zoom;
      const dx = (p.x - down.x) / z;
      const dy = (p.y - down.y) / z;
      down = null;
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) swipe(dx < 0 ? 1 : -1);
      else if (!dragged(scene, p) && slotAt(p) >= 0) tapFigure(slotAt(p));
    });
    // The skin strip: its left and right halves step back and forward.
    this.stepZones = ([-1, 1] as const).map((dir) => {
      const z = scene.add.zone(dir < 0 ? 0 : w / 2, SKIN_Y - 1, w / 2, h - SKIN_Y + 1).setOrigin(0);
      onTap(scene, z, () => stepSkin(dir));
      return z;
    });
    this.add([
      this.bg,
      this.beam,
      this.pool,
      this.runes,
      ...this.motes.map((m) => m.img),
      ...this.figures,
      this.blurb,
      this.countText,
      this.strip,
      this.skinLabel,
      this.skinName,
      this.lock,
      this.probe,
      hit,
      ...this.stepZones,
    ]);
    for (const m of this.motes) this.spawnMote(m, true);
  }

  /**
   * Show a class: its line (what it is, how many characters), its characters
   * side by side with `picked` in the light, and the picked one's skins.
   * `jump` moves the light at once (a new class) rather than gliding it over.
   */
  show(blurb: string, slots: Slot[], picked: number, skin: SkinPick, pose: boolean, jump: boolean): void {
    this.slots = slots.slice(0, MAX_FIGURES);
    this.picked = Math.min(picked, this.slots.length - 1);
    this.skin = skin;
    this.accent = slots[this.picked].accent;
    const n = this.slots.length;
    this.setHover(-1, false);

    // The class's line: what it is, then how many characters it holds.
    const many = n > 1 ? `${n} characters` : '1 character';
    this.countText.setText(many.toUpperCase());
    this.blurb.setText(fitLine(this.probe, blurb, this.boxW - 20 - this.countText.width));
    const lineW = this.blurb.width + 8 + this.countText.width;
    this.blurb.setX(Math.round((this.boxW - lineW) / 2));
    this.countText.setX(this.blurb.x + this.blurb.width + 8);

    // The characters, evenly across the stage; three times size when each has the room, else twice.
    const slotW = (this.boxW - 8) / n;
    const scale = slotW >= 66 ? 3 : 2;
    this.figures.forEach((f, i) => {
      f.setVisible(i < n);
      if (i >= n) return;
      f.setX(Math.round(4 + slotW * (i + 0.5)));
      f.show(this.slots[i], scale, Math.floor(slotW), this.probe);
    });
    this.lightFigures();

    // The light over the picked character.
    const x = this.figures[this.picked].x;
    this.scene.tweens.killTweensOf([this.beam, this.pool, this.runes]);
    if (jump || x === this.lightX) [this.beam, this.pool, this.runes].forEach((o) => o.setX(x));
    else this.scene.tweens.add({ targets: [this.beam, this.pool, this.runes], x, duration: 200, ease: 'Quad.easeOut' });
    // The runes' pulse was killed with the glide; start it again.
    this.scene.tweens.add({ targets: this.runes, alpha: { from: 0.35, to: 0.9 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lightX = x;
    this.beam.setTint(this.accent).setAlpha(0.75);
    this.pool.setTint(this.accent).setAlpha(0.7);
    this.runes.setTint(this.accent);
    for (const m of this.motes) m.img.setTint(this.accent);

    this.note = null;
    this.noteTimer?.remove();
    this.drawStrip();
    if (pose && !skin.locked) this.figures[this.picked].pose();
  }

  private setHover(i: number, redraw = true): void {
    if (i === this.hover) return;
    this.hover = i;
    if (redraw) this.lightFigures();
  }

  private lightFigures(): void {
    this.slots.forEach((_s, i) => this.figures[i].light(i === this.picked, i === this.hover, i === this.picked && !!this.skin?.locked));
  }

  /**
   * The skin strip: tied to the picked character by a notch up to its plate,
   * with the skin's name between arrows and a dot per skin under it.
   */
  private drawStrip(): void {
    const skin = this.skin;
    if (!skin) return;
    const { boxW: w, accent } = this;
    const many = skin.count > 1;
    const g = this.strip.clear();
    const x0 = 4;
    const sw = w - 8;
    g.fillStyle(OUTLINE).fillRect(x0, SKIN_Y, sw, SKIN_H);
    g.fillStyle(0x140f2a, 0.92).fillRect(x0 + 1, SKIN_Y + 1, sw - 2, SKIN_H - 2);
    g.fillStyle(0x2b2258).fillRect(x0 + 1, SKIN_Y + 1, sw - 2, 1);
    // The tie to the picked character: its colour along the top edge under it, rising in a notch to its plate.
    const f = this.figures[this.picked];
    const segW = Math.max(16, f.plateW);
    g.fillStyle(accent).fillRect(Math.round(f.x - segW / 2), SKIN_Y, segW, 1);
    g.fillStyle(accent).fillRect(f.x - 2, SKIN_Y - 1, 5, 1);
    g.fillStyle(accent).fillRect(f.x - 1, SKIN_Y - 2, 3, 1);

    // "Skin", then the lock for one not yet won, then its name; or a note for a moment.
    const nameY = many ? SKIN_Y + 3 : SKIN_Y + 7;
    const note = this.note;
    this.skinLabel.setVisible(!note);
    this.lock.setVisible(!note && skin.locked);
    if (note) this.skinName.setText(note.toUpperCase()).setTint(0x9ff6ff);
    else this.skinName.setText(fitLine(this.probe, skin.name, sw - 70)).setTint(skin.locked ? DIMMED : (skin.rarity ?? accent));
    const labelW = note ? 0 : this.skinLabel.width + 5;
    const lockW = this.lock.visible ? this.lock.width + 2 : 0;
    const left = Math.round((w - labelW - lockW - this.skinName.width) / 2);
    this.skinLabel.setPosition(left, nameY);
    this.lock.setPosition(left + labelW, nameY);
    this.skinName.setPosition(left + labelW + lockW, nameY);
    for (const z of this.stepZones) if (z.input) z.input.enabled = many;
    if (!many) return;
    // Chevrons 4 wide and 7 tall at the strip's ends, pointing out, with a dark outline.
    // Column i is 7 - 2i tall, so the widest column sits nearest the middle and the tip points away.
    for (const dir of [-1, 1]) {
      const col = (i: number) => (dir < 0 ? 12 - i : w - 13 + i);
      for (let i = 0; i < 4; i++) g.fillStyle(OUTLINE, 0.8).fillRect(col(i) - 1, SKIN_Y + 7 + i - 1, 3, 9 - i * 2);
      for (let i = 0; i < 4; i++) g.fillStyle(accent).fillRect(col(i), SKIN_Y + 7 + i, 1, 7 - i * 2);
    }
    // A dot per skin, the worn one lit; skins not yet won are hollow.
    const step = 7;
    const dx0 = Math.round(w / 2 - ((skin.count - 1) * step) / 2) - 1;
    const y = SKIN_Y + 14;
    for (let i = 0; i < skin.count; i++) {
      const x = dx0 + i * step;
      g.fillStyle(OUTLINE).fillRect(x - 1, y - 1, 5, 5);
      if (i === skin.index) {
        g.fillStyle(skin.owned[i] ? accent : DIMMED).fillRect(x, y, 3, 3);
        g.fillStyle(0xffffff, 0.6).fillRect(x, y, 3, 1);
      } else {
        g.fillStyle(0x43356e).fillRect(x, y, 3, 3);
        if (!skin.owned[i]) g.fillStyle(OUTLINE).fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }

  /** Show `text` where the skin's name goes for a moment. */
  say(text: string): void {
    this.note = text;
    this.drawStrip();
    this.noteTimer?.remove();
    this.noteTimer = this.scene.time.delayedCall(NOTE_MS, () => {
      this.note = null;
      this.drawStrip();
    });
  }

  pose(): void {
    this.figures[this.picked]?.pose();
  }

  /** Tried to play a locked skin: the lock shakes. */
  rattle(): void {
    const x = this.lock.x;
    this.scene.tweens.add({ targets: this.lock, x: { from: x - 2, to: x }, duration: 60, repeat: 3, yoyo: true, onComplete: () => this.lock.setX(x) });
  }

  update(dt: number): void {
    for (const f of this.figures) if (f.visible) f.update();
    for (const m of this.motes) {
      m.t += dt / m.life;
      if (m.t >= 1) this.spawnMote(m, false);
      // Fade in, drift up with a slight sway, fade out near the top.
      const a = Math.sin(Math.PI * Math.min(1, m.t)) * 0.9;
      m.img.setAlpha(a);
      m.img.setPosition(Math.round(m.x + Math.sin(m.t * 6 + m.rise) * 2), Math.round(FEET_Y - 2 - m.t * m.rise));
    }
  }

  private spawnMote(m: Stage['motes'][number], scatter: boolean): void {
    m.t = scatter ? Math.random() : 0;
    m.life = Phaser.Math.FloatBetween(1.8, 3.2);
    m.x = this.lightX + Phaser.Math.Between(-22, 22);
    m.rise = Phaser.Math.Between(40, FEET_Y - BAND_H);
  }
}

/** The select page itself, opened over the home screen. */
export class SelectScene extends Phaser.Scene {
  private cls = 0;
  private leaving = false;
  private shade!: Phaser.GameObjects.Rectangle;
  /** The class's name over the page, with arrows either side to step through the classes. */
  private header!: Phaser.GameObjects.BitmapText;
  private arrows!: Phaser.GameObjects.Graphics;
  private arrowZones: Phaser.GameObjects.Zone[] = [];
  private back!: PixelButton;
  private next!: PixelButton;
  private stage!: Stage;
  /** A skin not yet won that the player is looking at (the look worn stays the one they own). */
  private peek: SkinDef | null = null;
  private roster: Tile[] = [];
  private info!: Phaser.GameObjects.Container;
  private probe!: Phaser.GameObjects.BitmapText;
  private nameText!: Phaser.GameObjects.BitmapText;
  private role!: Phaser.GameObjects.BitmapText;
  private statValues: Phaser.GameObjects.BitmapText[] = [];
  private abilities: Phaser.GameObjects.BitmapText[] = [];
  private icons!: { attack: Phaser.GameObjects.Sprite; special: Phaser.GameObjects.Image; ult: Phaser.GameObjects.Image };
  private ultName!: Phaser.GameObjects.BitmapText;
  private ultCost!: Phaser.GameObjects.BitmapText;
  private bolt!: Phaser.GameObjects.Graphics;

  constructor() {
    super('select');
  }

  /** The shade the stage is tinted with, and its tween. */
  private tint = -1;
  private tintTween?: Phaser.Tweens.Tween;

  private get current(): ClassDef {
    return CLASSES[this.cls];
  }

  create(): void {
    this.leaving = false;
    this.peek = null;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });
    const saved = CLASSES.findIndex((c) => c.id === lastHero());
    this.cls = Math.min(lastPicked ?? Math.max(0, saved), CLASSES.length - 1);
    ensureUltIcons(this);

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0);
    this.header = pixelText(this, 0, 0, '', GOLD, 2);
    this.arrows = this.add.graphics();
    this.arrowZones = ([-1, 1] as const).map((dir) => {
      const z = this.add.zone(0, 0, 20, 20).setOrigin(0);
      onTap(this, z, () => this.stepClass(dir));
      return z;
    });
    this.probe = pixelText(this, 0, 0, '').setVisible(false);
    this.roster = CLASSES.map((_c, i) => new Tile(this, () => this.pickClass(i)));
    for (const t of this.roster) this.add.existing(t);
    this.tint = -1;
    this.tintTween = undefined;
    this.buildInfo();
    this.stage = new Stage(
      this,
      STAGE_W,
      MAIN_H,
      (i) => (i === this.current.types.indexOf(lookOf(this.current).type) ? this.stage.pose() : this.pickType(i)),
      (dir) => this.stepClass(dir),
      (dir) => this.stepSkin(dir),
    );
    this.add.existing(this.stage);
    this.back = new PixelButton(this, 'Back', BACK_W, BUTTON_H - 2, BUTTON_PLAIN, 'back', () => this.goBack());
    this.next = new PixelButton(this, 'Next', NEXT_W, BUTTON_H, BUTTON_GOLD, 'play', () => this.startGame());

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.stepClass(-1));
    kb?.on('keydown-RIGHT', () => this.stepClass(1));
    kb?.on('keydown-UP', () => this.stepType(-1));
    kb?.on('keydown-DOWN', () => this.stepType(1));
    kb?.on('keydown-A', () => this.stepType(-1));
    kb?.on('keydown-D', () => this.stepType(1));
    kb?.on('keydown-Q', () => this.stepSkin(-1));
    kb?.on('keydown-E', () => this.stepSkin(1));
    kb?.on('keydown-ENTER', () => this.startGame());
    kb?.on('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-ESC', () => this.goBack());

    this.refresh(true, true);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, delta: number): void {
    this.stage.update(Math.min(0.1, delta / 1000));
  }

  /** The panel beside the stage: the picked character's name and role, its stats, its attack and ability, and its Special. */
  private buildInfo(): void {
    const bg = this.add.image(0, 0, panelTexture(this, 'sel_info', INFO_W, MAIN_H, PANEL)).setOrigin(0);
    this.nameText = pixelText(this, PAD, NAME_Y, '', INK, 2);
    this.role = pixelText(this, PAD, ROLE_Y, '', LAVENDER);
    // Thin rules between the name, the stats and the abilities.
    const rules = this.add.graphics();
    for (const y of [RULE1_Y, RULE2_Y]) {
      rules.fillStyle(OUTLINE).fillRect(PAD, y, INFO_W - PAD * 2, 1);
      rules.fillStyle(0x43356e).fillRect(PAD, y + 1, INFO_W - PAD * 2, 1);
    }
    // The stats, three to a row: a name, and its value in the look's colour.
    const labels = STAT_GRID.flatMap((row, i) => row.map(([name], j) => pixelText(this, PAD + STAT_COL_X[j], STATS_Y + i * STAT_ROW, name, SOFT)));
    this.statValues = STAT_GRID.flatMap((row, i) => row.map((_, j) => pixelText(this, PAD + STAT_COL_X[j] + STAT_VALUE_X[j], STATS_Y + i * STAT_ROW, '')));

    // Attack and ability: an icon in a recessed box, what it is, and its name.
    const boxes = this.add.graphics();
    const box = (x: number, y: number, size: number, rim: number) => {
      boxes.fillStyle(OUTLINE).fillRect(x, y, size, size);
      boxes.fillStyle(0x140f2a).fillRect(x + 1, y + 1, size - 2, size - 2);
      boxes.fillStyle(rim).fillRect(x + 1, y + size - 2, size - 2, 1);
    };
    const kinds: Phaser.GameObjects.BitmapText[] = [];
    this.abilities = ['Attack', 'Ability'].map((kind, i) => {
      const y = ABIL_Y + i * ABIL_ROW;
      box(PAD, y, ICON_BOX, 0x43356e);
      kinds.push(pixelText(this, PAD + ICON_BOX + 5, y, kind, SOFT));
      return pixelText(this, PAD + ICON_BOX + 5, y + 9, '');
    });
    const iconX = PAD + ICON_BOX / 2;

    // The Special: a gold-rimmed strip with its icon, its name and what it costs in energy.
    const sx = PAD;
    const sw = INFO_W - PAD * 2;
    const strip = this.add.graphics();
    strip.fillStyle(OUTLINE).fillRect(sx, SPECIAL_Y, sw, SPECIAL_H);
    strip.fillStyle(0xb8742c).fillRect(sx + 1, SPECIAL_Y + 1, sw - 2, SPECIAL_H - 2);
    strip.fillStyle(0x1c1538).fillRect(sx + 2, SPECIAL_Y + 2, sw - 4, SPECIAL_H - 4);
    strip.fillStyle(0xffe08a, 0.7).fillRect(sx + 2, SPECIAL_Y + 1, sw - 4, 1);
    strip.fillStyle(0xffe08a, 0.08).fillRect(sx + 2, SPECIAL_Y + 2, sw - 4, 6);
    const ultBox = sx + 3;
    box(ultBox, SPECIAL_Y + 3, ICON_BOX, 0x8a4e22);
    const ultLabel = pixelText(this, ultBox + ICON_BOX + 5, SPECIAL_Y + 3, 'Special', GOLD);
    this.ultName = pixelText(this, ultBox + ICON_BOX + 5, SPECIAL_Y + 12, '');
    this.ultCost = pixelText(this, 0, SPECIAL_Y + 8, '', GOLD);
    this.bolt = this.add.graphics();

    this.icons = {
      attack: this.add.sprite(iconX, ABIL_Y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      special: this.add.image(iconX, ABIL_Y + ABIL_ROW + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      ult: this.add.image(ultBox + ICON_BOX / 2, SPECIAL_Y + 3 + ICON_BOX / 2, '__DEFAULT'),
    };
    this.info = this.add.container(0, 0, [
      bg,
      this.nameText,
      this.role,
      rules,
      ...labels,
      ...this.statValues,
      boxes,
      ...kinds,
      ...this.abilities,
      strip,
      ultLabel,
      this.ultName,
      this.ultCost,
      this.bolt,
      this.icons.attack,
      this.icons.special,
      this.icons.ult,
    ]);
  }

  /**
   * Show the current class, its characters, and the picked one in its skin.
   * `pose` plays the picked character's pose; `jump` is a new class (the light moves at once).
   */
  private refresh(pose: boolean, jump: boolean): void {
    const cls = this.current;
    const own = lookOf(cls);
    const look = this.peek ? { type: own.type, skin: this.peek } : own;
    const def = worn(cls, look);
    this.roster.forEach((t, i) => {
      const d = worn(CLASSES[i]);
      t.show(d.preview, d.accent, CLASSES[i].types.length).setPicked(i === this.cls);
    });
    const picked = cls.types.indexOf(look.type);
    // Every character of the class, each in the look it was last worn in (the picked one as it is now).
    const slots: Slot[] = cls.types.map((type, i) => {
      const d = i === picked ? def : worn(cls, lastLookOf(cls, type));
      return { preview: d.preview, accent: d.accent, name: type.name };
    });
    const skins = look.type.skins ?? [];
    this.shadeTo(def.accent);
    this.stage.show(
      cls.blurb,
      slots,
      picked,
      {
        name: look.skin?.name ?? look.type.lookName ?? 'Classic',
        index: look.skin ? skins.indexOf(look.skin) + 1 : 0,
        count: skins.length + 1,
        locked: !!this.peek,
        owned: [true, ...skins.map((s) => ownsSkin(cls, s))],
        rarity: look.skin ? RARITY_INFO[rarityOf(cls, look.skin)].tint : null,
      },
      pose,
      jump,
    );
    this.header.setText(cls.name.toUpperCase());
    this.placeHeader();

    // The picked character's name, big when it fits, and its role.
    const textW = INFO_W - PAD * 2;
    this.nameText.setScale(2).setText(look.type.name.toUpperCase());
    if (this.nameText.width > textW) this.nameText.setScale(1).setText(fitLine(this.probe, look.type.name, textW)).setY(NAME_Y + 4);
    else this.nameText.setY(NAME_Y);
    this.role.setText(fitLine(this.probe, def.role, textW));

    // Stats: the type's own numbers (skins never change them).
    const st = heroStats(cls.id, look.type.id);
    STAT_GRID.flat().forEach(([, value], i) => this.statValues[i].setText(value(st)).setTint(def.accent));

    // Attack and ability, named for the look.
    const abW = INFO_W - PAD - this.abilities[0].x;
    this.abilities[0].setText(fitLine(this.probe, def.attack, abW));
    this.abilities[1].setText(fitLine(this.probe, def.special, abW));
    const { attack, special } = def.buttons;
    this.icons.attack.stop();
    this.icons.attack.setTexture(attack.texture, attack.frame);
    if (attack.anim) this.icons.attack.play(attack.anim);
    this.icons.special.setTexture(special.texture);

    // The Special, and its energy cost at the right with a bolt.
    const ult = ultFor(def);
    if (this.textures.exists(ult.icon)) this.icons.ult.setTexture(ult.icon).setVisible(true);
    else this.icons.ult.setVisible(false);
    const right = INFO_W - PAD - 5;
    this.ultCost.setText(`${ult.def.cost}`);
    this.ultCost.setX(right - this.ultCost.width);
    const boltX = this.ultCost.x - 7;
    const b = this.bolt.clear();
    const BOLT = ['..##', '.##.', '####', '.##.', '##..'];
    BOLT.forEach((row, y) => [...row].forEach((c, x) => c === '#' && b.fillStyle(0xffe08a).fillRect(boltX + x, SPECIAL_Y + 9 + y, 1, 1)));
    this.ultName.setText(fitLine(this.probe, ult.name, boltX - 4 - this.ultName.x));
  }

  /** Tint the stage's hall (only; the screen behind keeps its own colours) with a shade of the hero's colour, easing from the last one. */
  private shadeTo(accent: number): void {
    const target = hallShade(accent);
    if (target === this.tint) return;
    const from = Phaser.Display.Color.ValueToColor(this.tint < 0 ? target : this.tint);
    const to = Phaser.Display.Color.ValueToColor(target);
    this.tint = target;
    this.tintTween?.stop();
    const apply = (t: number) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t * 100);
      this.stage.bg.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    };
    apply(0);
    this.tintTween = this.tweens.addCounter({ from: 0, to: 1, duration: 280, ease: 'Sine.easeOut', onUpdate: (tw) => apply(tw.getValue() ?? 1) });
  }

  private pickClass(i: number): void {
    if (this.leaving || i === this.cls) return;
    this.cls = lastPicked = i;
    this.peek = null;
    this.refresh(true, true);
  }

  private stepClass(dir: -1 | 1): void {
    this.pickClass((this.cls + dir + CLASSES.length) % CLASSES.length);
  }

  private pickType(i: number): void {
    const cls = this.current;
    const type = cls.types[i];
    if (this.leaving || !type || type === lookOf(cls).type) return;
    this.peek = null;
    setType(cls, type);
    this.refresh(true, false);
  }

  private pickSkin(i: number): void {
    const cls = this.current;
    const { type, skin } = lookOf(cls);
    const next = i === 0 ? null : (type.skins?.[i - 1] ?? skin);
    if (this.leaving || next === (this.peek ?? skin)) return;
    // A skin not yet won can be looked at, not worn.
    if (!ownsSkin(cls, next)) this.peek = next;
    else {
      this.peek = null;
      setLook(cls, type, next);
    }
    this.refresh(true, false);
  }

  private stepType(step: -1 | 1): void {
    const cls = this.current;
    const n = cls.types.length;
    if (n < 2) return;
    this.pickType((cls.types.indexOf(lookOf(cls).type) + step + n) % n);
  }

  private stepSkin(step: -1 | 1): void {
    const { type, skin: wornSkin } = lookOf(this.current);
    const skin = this.peek ?? wornSkin;
    const n = 1 + (type.skins?.length ?? 0);
    if (n < 2) return;
    const at = skin ? type.skins!.indexOf(skin) + 1 : 0;
    this.pickSkin((at + step + n) % n);
  }

  private goBack(): void {
    if (this.leaving) return;
    this.leaving = true;
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** On to the arena select, with this hero. */
  private startGame(): void {
    if (this.leaving) return;
    if (this.peek) {
      // Not theirs yet: the lock rattles, and the strip says where to get it.
      this.stage.rattle();
      this.stage.say('Win it in the Shop');
      return;
    }
    this.leaving = true;
    const character = this.current.id;
    lastPicked = this.cls;
    rememberHero(character);
    this.scene.launch('arena', { character });
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** The class's name centred over the page, with a chevron either side. */
  private placeHeader(): void {
    const vw = this.scale.width / this.cameras.main.zoom;
    const y = this.headerY(this.scale.height / this.cameras.main.zoom);
    this.header.setPosition(Math.round((vw - this.header.width) / 2), y);
    const g = this.arrows.clear();
    const mid = y + Math.round(this.header.height / 2) - 4;
    for (const dir of [-1, 1] as const) {
      const at = dir < 0 ? this.header.x - 10 : this.header.x + this.header.width + 6;
      // Four columns, the tallest nearest the name, so the tip points away.
      const col = (i: number) => (dir < 0 ? at + 3 - i : at + i);
      for (let i = 0; i < 4; i++) g.fillStyle(OUTLINE, 0.8).fillRect(col(i) - 1, mid + i - 1, 3, 9 - i * 2);
      for (let i = 0; i < 4; i++) g.fillStyle(GOLD).fillRect(col(i), mid + i, 1, 7 - i * 2);
      this.arrowZones[dir < 0 ? 0 : 1].setPosition(at - 8, mid - 6);
    }
  }

  /**
   * How the roster fits a view `vw` x `vh`: in one row if it can, else in two
   * (or three); between Back and Next when there's room, else on its own
   * above them. Null when the view is too small for it all.
   */
  private rosterPlan(vw: number, vh: number): { inline: boolean; cols: number; rows: number } | null {
    const n = CLASSES.length;
    const top = this.headerY(vh) + this.header.height + 5;
    if (vw < STAGE_W + MAIN_GAP + INFO_W + MARGIN * 2) return null;
    for (let rows = 1; rows <= 3; rows++) {
      const cols = Math.ceil(n / rows);
      const w = cols * TILE_W + (cols - 1) * TILE_GAP;
      const h = rows * TILE_H + (rows - 1) * TILE_GAP;
      for (const inline of [true, false]) {
        const wide = inline ? MARGIN * 2 + BACK_W + NEXT_W + w + 16 : w + MARGIN * 2;
        const bottom = inline ? h : h + 6 + BUTTON_H;
        if (vw >= wide && top + MAIN_H + 6 + bottom + 6 <= vh) return { inline, cols, rows };
      }
    }
    return null;
  }

  private layout(): void {
    const { width, height } = this.scale;
    const n = CLASSES.length;
    // Zoom out a whole step at a time (keeping the pixels crisp) until it all fits.
    let z = menuZoom(width, height);
    while (z > 1 && !this.rosterPlan(width / z, height / z)) z--;
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    const headerY = this.headerY(vh);
    this.placeHeader();

    const fit = Math.max(1, Math.floor((vw - MARGIN * 2 + TILE_GAP) / (TILE_W + TILE_GAP)));
    const plan = this.rosterPlan(vw, vh) ?? { inline: false, cols: Math.min(n, fit), rows: Math.ceil(n / Math.min(n, fit)) };
    const { inline, cols, rows } = plan;
    const rosterH = rows * TILE_H + (rows - 1) * TILE_GAP;
    const buttonsY = Math.round(vh - 6 - BUTTON_H);
    const rosterY = inline ? Math.round(vh - 6 - rosterH) : buttonsY - 6 - rosterH;
    // Row by row, each centred (the last may be shorter).
    this.roster.forEach((t, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * TILE_W + (inRow - 1) * TILE_GAP;
      const x = Math.round((vw - rowW) / 2) + (i % cols) * (TILE_W + TILE_GAP);
      t.setPosition(x, rosterY + row * (TILE_H + TILE_GAP));
    });
    const buttonY = inline ? Math.round(rosterY + (rosterH - BUTTON_H) / 2) : buttonsY;
    this.back.place(MARGIN, buttonY + 1);
    this.next.place(vw - MARGIN - NEXT_W, buttonY);

    // The stage and the panel side by side, centred between the header and the roster.
    const top = headerY + this.header.height + 5;
    const room = rosterY - 6 - top;
    const y = Math.round(top + Math.max(0, (room - MAIN_H) / 2));
    const x = Math.round((vw - (STAGE_W + MAIN_GAP + INFO_W)) / 2);
    this.stage.setPosition(x, y);
    this.info.setPosition(x + STAGE_W + MAIN_GAP, y);
  }

  private headerY(vh: number): number {
    return Math.ceil(fpsBottom() / (this.scale.height / vh)) + 4;
  }
}
