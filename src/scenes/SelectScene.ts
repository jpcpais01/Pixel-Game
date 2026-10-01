import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from '../art/bitmap';
import { type RGB } from '../art/pixel';
import { menuZoom } from '../game/display';
import { CLASSES, type ClassDef, type Preview, type SkinDef } from '../game/characters';
import { heroStats, type HeroStats } from '../game/stats';
import { lastHero, lastLookOf, lookOf, ownsSkin, rememberHero, setLook, setType, worn } from '../game/skins';
import { RARITY_INFO, rarityOf } from '../game/gacha';
import { ensureUltIcons, ultFor } from '../game/ultimate';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { statIconsTexture } from '../ui/statIcons';

// The hero select, in three parts that sit side by side on a wide screen and
// stack on a tall one:
// - the roster: a grid of portrait chips, one per class, each its hero's head
//   and shoulders at twice size, lit from below in the hero's colour;
// - the showcase: the class's name between two arrows, a row of pills for its
//   characters (the picked one opens to show its name), the picked character
//   big on a lit platform with a turning ring of light, and a row of swatches
//   for its skins under it;
// - the card: name and role, the six stats as bars, attack, ability and the
//   Special, and Play.
// It is all built from CLASSES, so new classes, characters and skins show up by
// themselves. Swiping the showcase steps through the class's characters;
// the arrows, the roster, the wheel and Left/Right change class.

/** Space round the page and between its parts. */
const MARGIN = 6;
const GAP = 5;
const BACK_W = 40;
const BACK_H = 14;
/** The parts start under the Back button. */
const TOP = MARGIN + BACK_H + 4;
/** The card's width on a wide screen, and the tallest the row of parts gets. */
const INFO_W = 156;
const BAND_MAX = 250;
/** The showcase's width on a wide screen, and the widest a stacked page gets. */
const SHOW_MIN = 150;
const SHOW_MAX = 280;
const COLUMN_MAX = 300;

/** Roster chips, largest first: the largest that fits is used. */
const CHIP_SIZES = [30, 26, 24, 22, 20];
const CHIP_GAP = 2;
const ROSTER_PAD = 4;

/** The showcase, rows from its top: the class's name, then the pills. */
const HEAD_Y = 5;
const PILLS_Y = 23;
const PILL_H = 22;
const PILL_GAP = 3;
const PILLS_BOTTOM = PILLS_Y + PILL_H;
/** The skin row from the showcase's bottom: swatches, and the skin's name over them. */
const SWATCH = 18;
const SWATCH_GAP = 3;
const SWATCH_BOTTOM = 6;
const SKIN_NAME_DY = 11;
/** The hero's feet stand this far above the skin row; it is drawn at the biggest of these sizes that fits. */
const FEET_ABOVE_SKINS = 9;
const HERO_SCALES = [4, 3, 2];
/** A hero's height in frame pixels, for fitting. */
const HERO_TALL = 30;
/** The most characters one class shows. */
const MAX_TYPES = 4;
/** Sparks drifting up through the light. */
const MOTES = 10;
/** The ring of light on the platform: how many dashes, and how fast it turns (dashes a second). */
const RING_DASHES = 14;
const RING_SPEED = 1.2;
/** How long a new character takes to slide in. */
const SLIDE_MS = 240;

/** The card, rows from its top. */
const PAD = 7;
const NAME_Y = 7;
const ROLE_Y = 23;
const RULE_Y = 33;
const STATS_Y = 38;
const STAT_ROW = 10;
const BAR_H = 5;
const ABIL_ROW = 21;
const ICON_BOX = 18;
const PLAY_H = 18;
/** Wide cards put the stats and the attack and ability in two columns. */
const TWO_COLS = 200;
/** How long the stat bars take to grow to a new character's numbers. */
const BAR_MS = 260;

/** How far a press on the showcase must travel sideways to count as a swipe to the class's next character. */
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
const GOLD_LIT = 0xffe08a;
const GOLD_DARK = 0xb8742c;
const DIMMED = 0x8a84a8;
const OUTLINE = 0x0b0818;
const DEEP = 0x120e26;
/** The panels, solid so nothing on the screen behind shows through. */
const SOLID = { ...PANEL, alpha: 1 };
const NOTE = 0x9ff6ff;

const NIGHT: RGB = [11, 8, 24];
const WHITE: RGB = [255, 255, 255];
const rgbOf = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const numOf = (c: RGB): number => (c[0] << 16) | (c[1] << 8) | c[2];
const mixN = (a: number, b: number, t: number): number => numOf(mix(rgbOf(a), rgbOf(b), t));

/** Stats: an icon, a short name, how high it reads on its bar, and how its value reads (ATK/S: attacks a second; REGEN: HP a second). */
const STATS: {
  icon: number;
  name: string;
  num: (s: HeroStats) => number;
  value: (s: HeroStats) => string;
}[] = [
  { icon: 0, name: 'HP', num: (s) => s.hp, value: (s) => `${s.hp}` },
  { icon: 1, name: 'DMG', num: (s) => s.damage, value: (s) => `${s.damage}` },
  { icon: 3, name: 'DEF', num: (s) => s.defense, value: (s) => `${s.defense}` },
  { icon: 2, name: 'MOVE', num: (s) => s.speed, value: (s) => `${s.speed}` },
  {
    icon: 4,
    name: 'ATK/S',
    num: (s) => s.rate,
    value: (s) => s.rate.toFixed(1),
  },
  { icon: 5, name: 'REGEN', num: (s) => s.regen, value: (s) => `${s.regen}` },
];

/** Each stat's highest value over every character, so a full bar is the best there is. */
let statTops: number[] | null = null;
function statMax(): number[] {
  if (statTops) return statTops;
  const tops = STATS.map(() => 0);
  for (const cls of CLASSES)
    for (const type of cls.types) {
      const st = heroStats(cls.id, type.id);
      STATS.forEach((s, i) => (tops[i] = Math.max(tops[i], s.num(st))));
    }
  return (statTops = tops);
}

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

// ---- Portraits: a look's head and shoulders, for the chips, pills and swatches. ----

/** Where each look's head is in its first idle frame, found once from its pixels. */
const heads = new Map<string, { x: number; y: number }>();

function idleFrame(scene: Phaser.Scene, preview: Preview): Phaser.Textures.Frame {
  return scene.anims.get(preview.idle)?.frames[0]?.frame ?? scene.textures.getFrame(preview.texture);
}

/**
 * The middle of a look's head, in frame pixels: the top of what is drawn in the
 * frame's middle columns (so a staff held out to the side doesn't count), and a
 * little under a third of the way from there to the feet.
 */
function headOf(frame: Phaser.Textures.Frame, preview: Preview): { x: number; y: number } {
  const key = `${frame.texture.key}:${frame.name}`;
  const known = heads.get(key);
  if (known) return known;
  const fw = frame.cutWidth;
  const fh = frame.cutHeight;
  const feet = Math.round((preview.originY ?? 31 / 32) * fh);
  const mid = Math.floor(fw / 2);
  let top = Math.max(0, feet - 26);
  let found = false;
  try {
    const c = document.createElement('canvas');
    c.width = fw;
    c.height = fh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = frame.source.image as CanvasImageSource | undefined;
    if (ctx && img) {
      ctx.drawImage(img, frame.cutX, frame.cutY, fw, fh, 0, 0, fw, fh);
      const data = ctx.getImageData(0, 0, fw, fh).data;
      for (let y = 0; y < feet && !found; y++)
        for (let dx = -3; dx <= 3; dx++)
          if (data[(y * fw + mid + dx) * 4 + 3] > 60) {
            top = y;
            found = true;
            break;
          }
    }
  } catch {
    // An image we can't read: the guess above stands.
  }
  const head = { x: mid, y: Math.round(top + (feet - top) * 0.3) };
  // Only keep what was read from real pixels; a sheet still being built is read again next time.
  if (found) heads.set(key, head);
  return head;
}

/** Show a look's head and shoulders, standing still, in a window `w` x `h` with its top left at (x, y), drawn at `scale`. */
function portrait(s: Phaser.GameObjects.Sprite, preview: Preview, x: number, y: number, w: number, h: number, scale: number): void {
  const frame = idleFrame(s.scene, preview);
  const head = headOf(frame, preview);
  s.stop();
  s.setTexture(frame.texture.key, frame.name).setOrigin(0).setScale(scale);
  const fw = frame.width;
  const fh = frame.height;
  const cw = Math.min(fw, Math.floor(w / scale));
  const ch = Math.min(fh, Math.floor(h / scale));
  const cx = Phaser.Math.Clamp(head.x - Math.floor(cw / 2), 0, fw - cw);
  const cy = Phaser.Math.Clamp(head.y - Math.floor(ch / 2) + 1, 0, fh - ch);
  s.setCrop(cx, cy, cw, ch);
  s.setPosition(x + Math.floor((w - cw * scale) / 2) - cx * scale, y + Math.floor((h - ch * scale) / 2) - cy * scale);
}

// ---- Drawing helpers. ----

/** A box with 2 px rounded corners: a dark outline, a 1 px rim and a fill. */
function roundBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, rim: number, fillAlpha = 1): void {
  g.fillStyle(OUTLINE)
    .fillRect(x + 2, y, w - 4, h)
    .fillRect(x + 1, y + 1, w - 2, h - 2)
    .fillRect(x, y + 2, w, h - 4);
  g.fillStyle(rim)
    .fillRect(x + 2, y + 1, w - 4, h - 2)
    .fillRect(x + 1, y + 2, w - 2, h - 4);
  g.fillStyle(fill, fillAlpha).fillRect(x + 2, y + 2, w - 4, h - 4);
}

/** Tall, thin arrows (5 x 13) pointing left or right, with a dark outline, drawn in `color`. */
function drawTallArrow(g: Phaser.GameObjects.Graphics, x: number, y: number, dir: -1 | 1, color: number, alpha = 1): void {
  // Column i (0 nearest the tip) is 2i + 3 tall; the tip is at x for dir -1 and x + 4 for dir 1.
  for (let i = 0; i < 5; i++) {
    const cx = dir < 0 ? x + i : x + 4 - i;
    const hgt = 3 + i * 2 + (i === 4 ? 2 : 0);
    g.fillStyle(OUTLINE, 0.85 * alpha).fillRect(cx - 1, y + 6 - Math.floor(hgt / 2) - 1, 3, hgt + 2);
  }
  for (let i = 0; i < 5; i++) {
    const cx = dir < 0 ? x + i : x + 4 - i;
    const hgt = 3 + i * 2 + (i === 4 ? 2 : 0);
    g.fillStyle(color, alpha).fillRect(cx, y + 6 - Math.floor(hgt / 2), 1, hgt);
  }
  g.fillStyle(0xffffff, 0.45 * alpha).fillRect(dir < 0 ? x : x + 4, y + 5, 1, 1);
}

// ---- The showcase's backdrop, painted once per colour and size and cached. ----

/** Blend `c` over the pixel at (x, y) by `a` (0..1). */
function blend(b: Bitmap, x: number, y: number, c: RGB, a: number): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= b.w || y >= b.h || b.alpha(x, y) === 0) return;
  const i = (y * b.w + x) * 4;
  b.set(x, y, mix([b.data[i], b.data[i + 1], b.data[i + 2]], c, a));
}

/** A round platform seen from above and in front: a top face with a pale rim and a shaded drum `depth` tall, in stone touched with `tint`. */
function paintDisc(b: Bitmap, cx: number, cy: number, rx: number, ry: number, depth: number, tint: RGB): void {
  const topLit = mix([110, 96, 170], tint, 0.3);
  const topDark = mix([46, 36, 92], tint, 0.25);
  const rim = mix(mix([214, 204, 244], tint, 0.35), WHITE, 0.2);
  const drumLit = mix([66, 52, 124], tint, 0.25);
  const drumDark = mix([22, 17, 48], tint, 0.15);
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx;
    if (Math.abs(dx) > 1) continue;
    const e = ry * Math.sqrt(1 - dx * dx);
    const top = Math.round(cy - e);
    const bottom = Math.round(cy + e);
    // The drum: lit on the left, falling off to the right, darker at its foot.
    for (let y = bottom; y <= bottom + depth; y++) {
      const t = clamp01((dx + 1) / 2);
      let c = mix(drumLit, drumDark, Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3));
      if (y === bottom + depth) c = NIGHT;
      else if (y === bottom + 1) c = mix(c, rim, 0.25);
      b.set(x, y, c);
    }
    // The top face, brighter towards the back left, with a pale rim round the edge.
    for (let y = top; y <= bottom; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const t = clamp01((dx * 0.6 + dy * 0.8 + 1) / 2);
      let c = mix(topLit, topDark, Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3));
      if (y === top || Math.abs(dx) > 0.97) c = rim;
      else if (y === bottom) c = mix(topDark, NIGHT, 0.4);
      b.set(x, y, c);
    }
  }
}

/** The platform's size for a hero drawn at `scale`: its top face's half-width and half-height. */
const platformOf = (scale: number) => {
  const rx = 12 * scale + 10;
  return { rx, ry: Math.max(5, Math.round(rx * 0.2)) };
};

/**
 * The showcase's backdrop for a hero in `accent`: a wall that darkens towards
 * the top, crossed by soft diagonal bands of light, a dithered glow of the
 * hero's colour behind where it stands, a floor below the horizon with a pool
 * of light and two dashed rings round a two-step platform, darker towards the
 * sides, all in a box with cut corners and a rim lit from above.
 */
function showcaseTexture(scene: Phaser.Scene, w: number, h: number, feet: number, scale: number, accent: number): string {
  const key = `sel_show_${w}x${h}_${feet}_${scale}_${accent.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const A = rgbOf(accent);
  const wallTop = mix(NIGHT, A, 0.1);
  const wallLow = mix([30, 24, 60], A, 0.4);
  const light = mix(A, WHITE, 0.45);
  const floorFar = mix([24, 19, 48], A, 0.32);
  const floorNear = mix(NIGHT, A, 0.2);
  const cx = w / 2;
  const horizon = feet - 10 * scale;
  const gy = feet - 17 * scale;
  const grx = Math.min(w * 0.48, 34 * scale);
  const gry = 30 * scale;
  const { rx, ry } = platformOf(scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      // Cut corners, 3 px on the diagonal.
      if (ex + ey < 3) continue;
      const edge = ex + ey === 3 ? 0 : Math.min(ex, ey);
      let c: RGB;
      if (y < horizon) {
        const t = y / horizon;
        c = mix(wallTop, wallLow, Math.floor(t * 6 + bayer(x, y)) / 6);
        // Wide bands of light falling from the upper left, fading down the wall.
        const band = (((x + y * 0.7) % 52) + 52) % 52;
        if (band < 18) {
          const k = 1 - Math.abs(band - 9) / 9;
          if (k * (1 - t * 0.6) > bayer(x, y) + 0.15) c = mix(c, light, 0.09);
        }
      } else {
        const t = (y - horizon) / Math.max(1, h - horizon);
        c = mix(floorFar, floorNear, Math.floor(t * 4 + bayer(x, y)) / 4);
        if (y === horizon) c = mix(c, light, 0.4);
        else if (y === horizon + 1) c = mix(c, NIGHT, 0.35);
        // A pool of light on the floor round the platform.
        const pe = Math.hypot((x + 0.5 - cx) / (rx * 2.3), (y + 0.5 - feet) / (ry * 3.2));
        if (pe < 1) c = mix(c, light, (Math.floor((1 - pe) * 4 + bayer(x, y)) / 4) * 0.22);
      }
      // The glow of the hero's colour behind it, in dithered steps.
      const ge = Math.hypot((x + 0.5 - cx) / grx, (y + 0.5 - gy) / gry);
      if (ge < 1) c = mix(c, light, (Math.floor((1 - ge) * (1 - ge) * 5 + bayer(x, y)) / 5) * 0.4);
      // Darker towards the sides and the very top, so the eye goes to the middle.
      const vx = Math.abs(x + 0.5 - cx) / cx;
      const v = clamp01(vx * vx * 0.9 + (y < 16 ? (16 - y) / 40 : 0));
      if (v * 0.95 > bayer(x, y)) c = mix(c, NIGHT, Math.min(0.55, v * 0.7));
      // The rim: lit along the top, the hero's colour down the sides, dark along the bottom.
      if (edge === 0) c = NIGHT;
      else if (edge === 1) c = y < h * 0.4 ? mix(light, WHITE, 0.15) : y < h - 2 ? mix(A, NIGHT, 0.35) : mix(A, NIGHT, 0.6);
      else if (edge === 2) c = mix(c, NIGHT, 0.5);
      b.set(x, y, c);
    }
  }
  // Two dashed rings on the floor round the platform.
  for (const [k, a] of [
    [1.55, 0.45],
    [2.2, 0.25],
  ] as const) {
    const steps = Math.round(rx * k * 7);
    for (let i = 0; i < steps; i++) {
      if (i % 9 >= 6) continue;
      const t = (i / steps) * Math.PI * 2;
      const py = feet + 1 + Math.sin(t) * ry * k;
      if (py < horizon + 2) continue;
      blend(b, cx + Math.cos(t) * rx * k, py, light, a);
    }
  }
  // The platform: a broad lower step and a raised top.
  paintDisc(b, cx, feet + 4, rx + 9, ry + 2, 3, A);
  paintDisc(b, cx, feet + 1, rx, ry, 4, A);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A tiny spark that drifts up through the light. */
function moteTexture(scene: Phaser.Scene): string {
  const key = 'sel_mote';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(3, 3);
  b.set(1, 1, WHITE);
  for (const [x, y] of [
    [0, 1],
    [2, 1],
    [1, 0],
    [1, 2],
  ])
    b.set(x, y, WHITE, 110);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

// ---- Pieces of the page. ----

/** What a chip shows: a look, its colour, and for skins, how rare it is and whether it's owned. */
interface ChipLook {
  preview: Preview;
  accent: number;
  /** The rarity's colour, drawn as a line along the chip's foot; null for none. */
  rarity?: number | null;
  locked?: boolean;
}

/**
 * A square chip with a hero's head and shoulders in it, lit from below in the
 * hero's colour: a class in the roster (heads at twice size) or a skin under
 * the showcase (at their own size). The picked one has a gold rim and stands
 * a pixel higher; one under the pointer brightens.
 */
class Chip extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Sprite;
  private lock: Phaser.GameObjects.Image;
  private zone: Phaser.GameObjects.Zone;
  private size = 0;
  private look?: ChipLook;
  private picked = false;
  private hover = false;
  baseY = 0;

  constructor(
    scene: Phaser.Scene,
    private headScale: number,
    tap: () => void,
  ) {
    super(scene, 0, 0);
    this.g = scene.add.graphics();
    this.head = scene.add.sprite(0, 0, '__DEFAULT');
    this.lock = scene.add.image(0, 0, 'icon_lock').setOrigin(0).setVisible(false);
    this.zone = scene.add.zone(0, 0, 1, 1).setOrigin(0);
    onTap(scene, this.zone, tap);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (p: Phaser.Input.Pointer) => !p.wasTouch && this.setHover(true));
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setHover(false));
    this.add([this.g, this.head, this.lock, this.zone]);
  }

  resize(s: number): this {
    if (s === this.size) return this;
    this.size = s;
    this.zone.setSize(s, s);
    this.frame();
    return this;
  }

  show(look: ChipLook, picked: boolean): this {
    const same = this.look?.preview === look.preview;
    this.look = look;
    this.picked = picked;
    if (!same) this.frame();
    else this.draw();
    return this;
  }

  private frame(): void {
    if (!this.look || !this.size) return;
    portrait(this.head, this.look.preview, 2, 2, this.size - 4, this.size - 4, this.headScale);
    this.draw();
  }

  private setHover(on: boolean): void {
    this.hover = on;
    this.draw();
  }

  private draw(): void {
    const look = this.look;
    const s = this.size;
    if (!look || !s) return;
    const { picked, hover } = this;
    this.y = this.baseY - (picked ? 1 : 0);
    const a = look.accent;
    const k = picked ? 1 : hover ? 0.75 : 0.5;
    const top = mixN(DEEP, a, 0.08 + 0.14 * k);
    const low = mixN(DEEP, a, 0.12 + 0.45 * k);
    const rim = picked ? GOLD : mixN(0x3a2f66, a, hover ? 0.5 : 0.22);
    const g = this.g.clear();
    // The picked chip glows in its colour round the rim.
    if (picked)
      g.fillStyle(a, 0.35)
        .fillRect(-1, 1, s + 2, s - 2)
        .fillRect(1, -1, s - 2, s + 2);
    roundBox(g, 0, 0, s, s, top, rim);
    // The lower part lit with the hero's colour, dithered into the top.
    const inner = s - 4;
    const lowY = 2 + Math.floor(inner * 0.5);
    g.fillStyle(low).fillRect(2, lowY + 1, inner, s - 2 - lowY - 1);
    for (let x = 0; x < inner; x += 2) g.fillRect(2 + x, lowY, 1, 1);
    g.fillStyle(0xffffff, picked ? 0.3 : 0.1).fillRect(3, 2, s - 6, 1);
    if (picked) g.fillStyle(GOLD_LIT).fillRect(2, 1, s - 4, 1);
    // A line of the skin's rarity along the foot.
    if (look.rarity != null) g.fillStyle(look.rarity, look.locked ? 0.5 : 1).fillRect(2, s - 3, s - 4, 1);
    if (look.locked) this.head.setTint(0x5a5480);
    else if (picked) this.head.clearTint();
    else this.head.setTint(hover ? 0xe0d8f4 : 0xa49cc4);
    this.lock.setVisible(!!look.locked).setPosition(s - this.lock.width - 1, s - this.lock.height - 1);
  }
}

/**
 * A pill for one of the class's characters: its head in a lit square, and for
 * the picked one, its name beside it. It knows how wide it wants to be.
 */
class Pill extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.BitmapText;
  private zone: Phaser.GameObjects.Zone;
  private preview?: Preview;
  private accent = 0xffffff;
  private picked = false;
  private hover = false;
  boxW = PILL_H;

  constructor(scene: Phaser.Scene, tap: () => void) {
    super(scene, 0, 0);
    this.g = scene.add.graphics();
    this.head = scene.add.sprite(0, 0, '__DEFAULT');
    this.label = pixelText(scene, 0, 0, '');
    this.zone = scene.add.zone(0, 0, PILL_H, PILL_H).setOrigin(0);
    onTap(scene, this.zone, tap);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (p: Phaser.Input.Pointer) => !p.wasTouch && this.setHover(true));
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setHover(false));
    this.add([this.g, this.head, this.label, this.zone]);
  }

  /** The width it takes with its name showing (when picked) or not. */
  set(preview: Preview, name: string, accent: number, picked: boolean): void {
    if (preview !== this.preview) portrait(this.head, preview, 2, 2, PILL_H - 4, PILL_H - 4, 2);
    this.preview = preview;
    this.accent = accent;
    this.picked = picked;
    this.label.setText(name.toUpperCase());
  }

  /** Its width with the name shown or hidden. */
  widthWith(named: boolean): number {
    return named ? PILL_H + this.label.width + 6 : PILL_H;
  }

  /** Lay it out with or without its name. */
  open(named: boolean): void {
    this.boxW = this.widthWith(named);
    this.label.setVisible(named).setPosition(PILL_H + 1, Math.round((PILL_H - this.label.height) / 2));
    this.zone.setSize(this.boxW, PILL_H);
    this.draw();
  }

  private setHover(on: boolean): void {
    this.hover = on;
    this.draw();
  }

  private draw(): void {
    const { picked, hover, accent } = this;
    const w = this.boxW;
    const g = this.g.clear();
    const fill = picked ? mixN(0x1a1433, accent, 0.4) : hover ? 0x2a2150 : 0x17122f;
    const rim = picked ? mixN(accent, 0xffffff, 0.4) : hover ? 0x6b5aa6 : 0x43356e;
    roundBox(g, 0, 0, w, PILL_H, fill, rim, 0.95);
    // The head's square, lit from below in its colour.
    const inner = PILL_H - 4;
    g.fillStyle(mixN(DEEP, accent, picked ? 0.3 : 0.12)).fillRect(2, 2, inner, inner);
    g.fillStyle(mixN(DEEP, accent, picked ? 0.62 : 0.28)).fillRect(2, 2 + inner / 2, inner, inner / 2);
    if (picked) g.fillStyle(0xffffff, 0.3).fillRect(3, 2, w - 6, 1);
    this.label.setTint(INK);
    if (picked) this.head.clearTint();
    else this.head.setTint(hover ? 0xe0d8f4 : 0x9890b8);
  }
}

/** Which skin is worn and every look of the picked character, for the swatches. */
interface SkinPick {
  name: string;
  index: number;
  /** A skin not yet won, being looked at: its name dimmed, with a lock. */
  locked: boolean;
  looks: ChipLook[];
  /** The rarity's colour for the skin's name, or null for the type's own look. */
  rarity: number | null;
}

/** Everything the showcase shows. */
interface ShowData {
  className: string;
  types: { preview: Preview; name: string; accent: number }[];
  picked: number;
  hero: Preview;
  accent: number;
  skin: SkinPick;
  /** -1 or 1: a new character slides in from that side; 0: the same character. */
  slide: -1 | 0 | 1;
  /** A new class: everything comes in at once. */
  jump: boolean;
  pose: boolean;
}

/** What the showcase calls back. */
interface ShowHandlers {
  stepClass(dir: -1 | 1): void;
  pickType(i: number): void;
  stepType(dir: -1 | 1): void;
  pose(): void;
  pickSkin(i: number): void;
  stepSkin(dir: -1 | 1): void;
}

/** The least height a showcase needs for a hero drawn at `scale`. */
const showMinH = (scale: number): number => PILLS_BOTTOM + 3 + HERO_TALL * scale + FEET_ABOVE_SKINS + SKIN_NAME_DY + 2 + SWATCH + SWATCH_BOTTOM;

/**
 * The showcase: the class's name between arrows, the pills of its characters,
 * the picked one big on a platform with a ring of light turning under it and
 * sparks rising round it, and the swatches of its skins below.
 */
class Showcase extends Phaser.GameObjects.Container {
  private bgBack: Phaser.GameObjects.Image;
  private bgFront: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private ringTurn = 0;
  private ringColor = 0xffffff;
  private hero: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private header: Phaser.GameObjects.BitmapText;
  private headerShadow: Phaser.GameObjects.BitmapText;
  private arrows: Phaser.GameObjects.Graphics;
  private arrowZones: Phaser.GameObjects.Zone[];
  private pills: Pill[] = [];
  private skinName: Phaser.GameObjects.BitmapText;
  private lock: Phaser.GameObjects.Image;
  private swatches: Chip[] = [];
  private skinArrows: Phaser.GameObjects.Graphics;
  private skinZones: Phaser.GameObjects.Zone[];
  private motes: {
    img: Phaser.GameObjects.Image;
    t: number;
    life: number;
    x: number;
    rise: number;
  }[] = [];
  private probe: Phaser.GameObjects.BitmapText;
  private readonly cx: number;
  private readonly feet: number;
  private readonly swatchY: number;
  private preview?: Preview;
  private accent = -1;
  private skin?: SkinPick;
  private locked = false;
  private note: string | null = null;
  private noteTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    readonly boxW: number,
    readonly boxH: number,
    readonly heroScale: number,
    private calls: ShowHandlers,
  ) {
    super(scene, 0, 0);
    const cx = (this.cx = Math.round(boxW / 2));
    this.swatchY = boxH - SWATCH_BOTTOM - SWATCH;
    this.feet = this.swatchY - SKIN_NAME_DY - 2 - FEET_ABOVE_SKINS;
    this.bgBack = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    this.bgFront = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.aura = scene.add
      .image(cx, this.feet - 15 * heroScale, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(heroScale * 1.4);
    scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.3, to: 0.55 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.ring = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

    const shadow = scene.add.image(0, 0, 'shadow').setScale(1.3, 1);
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.glow = scene.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.hero = scene.add.container(cx, this.feet, [shadow, this.sprite, this.glow]).setScale(heroScale);

    const mote = moteTexture(scene);
    for (let i = 0; i < MOTES; i++) {
      const img = scene.add.image(0, 0, mote).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.motes.push({ img, t: Math.random(), life: 1, x: 0, rise: 0 });
    }

    this.headerShadow = pixelText(scene, 0, 0, '', OUTLINE, 2).setAlpha(0.6);
    this.header = pixelText(scene, 0, 0, '', GOLD, 2);
    this.arrows = scene.add.graphics();
    this.arrowZones = ([-1, 1] as const).map((dir) => {
      const z = scene.add.zone(0, 0, 24, 22).setOrigin(0);
      onTap(scene, z, () => calls.stepClass(dir));
      return z;
    });
    for (let i = 0; i < MAX_TYPES; i++) this.pills.push(new Pill(scene, () => calls.pickType(i)));

    // Over the hero: a tap on it strikes its pose; a swipe steps to the class's next character
    // (a swipe left bringing the next one in from the right).
    const hit = scene.add
      .zone(0, PILLS_BOTTOM + 2, boxW, this.swatchY - SKIN_NAME_DY - 3 - PILLS_BOTTOM - 2)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    let down: { x: number; y: number } | null = null;
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y }));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (down = null));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const z = scene.cameras.main.zoom;
      const dx = (p.x - down.x) / z;
      const dy = (p.y - down.y) / z;
      down = null;
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) calls.stepType(dx < 0 ? 1 : -1);
      else if (!dragged(scene, p)) {
        const x = p.x / z - this.x;
        const y = p.y / z - this.y;
        const s = this.heroScale;
        if (Math.abs(x - this.cx) <= 12 * s && y <= this.feet + 6 && y >= this.feet - 31 * s) calls.pose();
      }
    });

    this.skinName = pixelText(scene, 0, 0, '');
    this.lock = scene.add.image(0, 0, 'icon_lock').setOrigin(0).setVisible(false);
    this.skinArrows = scene.add.graphics();
    this.skinZones = ([-1, 1] as const).map((dir) => {
      const z = scene.add.zone(0, 0, 16, SWATCH + 6).setOrigin(0);
      onTap(scene, z, () => calls.stepSkin(dir));
      return z;
    });
    this.probe = pixelText(scene, 0, 0, '').setVisible(false);

    this.add([
      this.bgBack,
      this.bgFront,
      this.aura,
      this.ring,
      this.hero,
      ...this.motes.map((m) => m.img),
      hit,
      this.headerShadow,
      this.header,
      this.arrows,
      ...this.arrowZones,
      ...this.pills,
      this.skinArrows,
      ...this.skinZones,
      this.skinName,
      this.lock,
      this.probe,
    ]);
    for (const m of this.motes) this.spawnMote(m, true);
  }

  show(d: ShowData): void {
    // The backdrop takes the hero's colour, the new one fading in over the old.
    if (d.accent !== this.accent) {
      const key = showcaseTexture(this.scene, this.boxW, this.boxH, this.feet, this.heroScale, d.accent);
      const first = this.accent < 0;
      this.accent = d.accent;
      this.scene.tweens.killTweensOf(this.bgFront);
      if (!first) this.bgBack.setTexture(this.bgFront.texture.key).setVisible(true);
      this.bgFront.setTexture(key).setAlpha(first ? 1 : 0);
      if (!first)
        this.scene.tweens.add({
          targets: this.bgFront,
          alpha: 1,
          duration: 260,
          ease: 'Sine.easeOut',
          onComplete: () => this.bgBack.setVisible(false),
        });
      this.aura.setTint(d.accent);
      this.ringColor = mixN(d.accent, 0xffffff, 0.45);
      for (const m of this.motes) m.img.setTint(this.ringColor);
    }
    this.showHeader(d.className);
    this.showPills(d);
    this.showHero(d);
    this.skin = d.skin;
    this.note = null;
    this.noteTimer?.remove();
    this.drawSkins();
  }

  private showHeader(name: string): void {
    const text = name.toUpperCase();
    this.header.setText(text);
    this.headerShadow.setText(text);
    const x = Math.round(this.cx - this.header.width / 2);
    this.header.setPosition(x, HEAD_Y);
    this.headerShadow.setPosition(x + 1, HEAD_Y + 2);
    const g = this.arrows.clear();
    const mid = HEAD_Y + Math.round(this.header.height / 2) - 6;
    for (const dir of [-1, 1] as const) {
      const at = dir < 0 ? x - 13 : x + this.header.width + 8;
      drawTallArrow(g, at, mid, dir, GOLD);
      this.arrowZones[dir < 0 ? 0 : 1].setPosition(at - 9, mid - 4);
    }
  }

  /** The pills, centred in a row; the picked one opens to show its name when the row has room. */
  private showPills(d: ShowData): void {
    const n = Math.min(d.types.length, MAX_TYPES);
    this.pills.forEach((p, i) => {
      p.setVisible(n > 1 && i < n);
      if (n > 1 && i < n) p.set(d.types[i].preview, d.types[i].name, d.types[i].accent, i === d.picked);
    });
    if (n < 2) return;
    const room = this.boxW - 12;
    const width = (named: boolean) => this.pills.slice(0, n).reduce((sum, p, i) => sum + p.widthWith(named && i === d.picked), 0) + (n - 1) * PILL_GAP;
    const named = width(true) <= room;
    let x = Math.round(this.cx - width(named) / 2);
    for (let i = 0; i < n; i++) {
      const p = this.pills[i];
      p.open(named && i === d.picked);
      p.setPosition(x, PILLS_Y);
      x += p.boxW + PILL_GAP;
    }
  }

  private showHero(d: ShowData): void {
    const preview = d.hero;
    this.locked = d.skin.locked;
    if (preview !== this.preview) {
      this.preview = preview;
      const oy = preview.originY ?? 31 / 32;
      // Drop a pose's queued return to the old look's idle first: stopping plays the queue, and one frame
      // of a smaller hero would clamp this look's crop for good (a samurai after the wizard was cut in half).
      this.sprite.chain();
      this.sprite.stop();
      this.sprite.setTexture(preview.texture).setOrigin(0.5, oy);
      const wide = Math.floor((this.boxW - 8) / this.heroScale);
      cropToWindow(this.sprite, preview, Math.min(40, wide), 44, 3, 1);
      this.glow.setVisible(!!preview.glow);
      if (preview.glow) {
        this.glow.setTexture(preview.glow).setOrigin(0.5, oy);
        cropToWindow(this.glow, preview, Math.min(40, wide), 44, 3, 1);
      }
      this.sprite.play(preview.idle);
      // In from the side it was swiped from, or up from the platform for a new class or skin.
      this.scene.tweens.killTweensOf(this.hero);
      const fromX = d.slide && !d.jump ? d.slide * 18 : 0;
      this.hero.setAlpha(0).setPosition(this.cx + fromX, this.feet + (fromX ? 0 : 4));
      this.scene.tweens.add({
        targets: this.hero,
        alpha: 1,
        x: this.cx,
        y: this.feet,
        duration: SLIDE_MS,
        ease: 'Cubic.easeOut',
      });
    }
    if (this.locked) this.sprite.setTint(0x4a4468);
    else this.sprite.clearTint();
    this.glow.setAlpha(this.locked ? 0.25 : 1);
    if (d.pose && !this.locked) this.pose();
  }

  /** The skin's name (or a note for a moment) over a row of swatches, one per look, with arrows either side. */
  private drawSkins(): void {
    const skin = this.skin;
    if (!skin) return;
    const n = skin.looks.length;
    const many = n > 1;
    const nameY = this.swatchY - SKIN_NAME_DY;
    const note = this.note;
    this.lock.setVisible(!note && skin.locked);
    if (note) this.skinName.setText(note.toUpperCase()).setTint(NOTE);
    else this.skinName.setText(fitLine(this.probe, skin.name, this.boxW - 24)).setTint(skin.locked ? DIMMED : (skin.rarity ?? LAVENDER));
    const lockW = this.lock.visible ? this.lock.width + 2 : 0;
    const left = Math.round(this.cx - (lockW + this.skinName.width) / 2);
    this.lock.setPosition(left, nameY);
    this.skinName.setPosition(left + lockW, nameY);

    while (this.swatches.length < n) {
      const i = this.swatches.length;
      const c = new Chip(this.scene, 1, () => this.calls.pickSkin(i)).resize(SWATCH);
      this.swatches.push(c);
      this.addAt(c, this.getIndex(this.skinName));
    }
    const total = n * SWATCH + (n - 1) * SWATCH_GAP;
    const x0 = Math.round(this.cx - total / 2);
    this.swatches.forEach((c, i) => {
      c.setVisible(many && i < n);
      if (!many || i >= n) return;
      c.x = x0 + i * (SWATCH + SWATCH_GAP);
      c.baseY = this.swatchY;
      c.show(skin.looks[i], i === skin.index);
    });
    const g = this.skinArrows.clear();
    this.skinZones.forEach((z) => z.setVisible(many));
    for (const z of this.skinZones) if (z.input) z.input.enabled = many;
    if (!many) return;
    const ay = this.swatchY + 2;
    drawTallArrow(g, x0 - 11, ay, -1, this.ringColor);
    drawTallArrow(g, x0 + total + 6, ay, 1, this.ringColor);
    this.skinZones[0].setPosition(x0 - 16, this.swatchY - 3);
    this.skinZones[1].setPosition(x0 + total, this.swatchY - 3);
  }

  /** Show `text` where the skin's name goes for a moment. */
  say(text: string): void {
    this.note = text;
    this.drawSkins();
    this.noteTimer?.remove();
    this.noteTimer = this.scene.time.delayedCall(NOTE_MS, () => {
      this.note = null;
      this.drawSkins();
    });
  }

  /** Tried to play a locked skin: the lock shakes. */
  rattle(): void {
    const x = this.lock.x;
    this.scene.tweens.add({
      targets: this.lock,
      x: { from: x - 2, to: x },
      duration: 60,
      repeat: 3,
      yoyo: true,
      onComplete: () => this.lock.setX(x),
    });
  }

  pose(): void {
    if (this.preview && !this.locked) this.sprite.play(this.preview.chosen).chain(this.preview.idle);
  }

  update(dt: number): void {
    if (this.glow.visible) this.glow.setFrame(this.sprite.frame.name);
    this.drawRing(dt);
    for (const m of this.motes) {
      m.t += dt / m.life;
      if (m.t >= 1) this.spawnMote(m, false);
      // Fade in, drift up with a slight sway, fade out near the top.
      const a = Math.sin(Math.PI * Math.min(1, m.t)) * 0.85;
      m.img.setAlpha(a);
      m.img.setPosition(Math.round(m.x + Math.sin(m.t * 6 + m.rise) * 2), Math.round(this.feet - 2 - m.t * m.rise));
    }
  }

  /** A dashed ring of light on the platform's top face, turning slowly. */
  private drawRing(dt: number): void {
    this.ringTurn = (this.ringTurn + dt * RING_SPEED) % RING_DASHES;
    const { rx, ry } = platformOf(this.heroScale);
    const rrx = rx - 6;
    const rry = ry - 2;
    const steps = Math.round(rrx * 5);
    const g = this.ring.clear();
    g.fillStyle(this.ringColor, 0.85);
    let last = '';
    for (let i = 0; i < steps; i++) {
      const u = (i / steps) * RING_DASHES + this.ringTurn;
      if (u % 1 > 0.6) continue;
      const t = (i / steps) * Math.PI * 2;
      const x = Math.round(this.cx + Math.cos(t) * rrx);
      const y = Math.round(this.feet + 1 + Math.sin(t) * rry);
      const k = `${x},${y}`;
      if (k === last) continue;
      last = k;
      g.fillRect(x, y, 1, 1);
    }
  }

  private spawnMote(m: Showcase['motes'][number], scatter: boolean): void {
    const { rx } = platformOf(this.heroScale);
    m.t = scatter ? Math.random() : 0;
    m.life = Phaser.Math.FloatBetween(1.8, 3.4);
    m.x = this.cx + Phaser.Math.Between(-rx + 4, rx - 4);
    m.rise = Phaser.Math.Between(30, Math.max(40, this.feet - PILLS_BOTTOM - 6));
  }
}

/** How the card lays out at width `w`: where its rows go, and the least height it needs. */
function cardRows(w: number, h = 0) {
  const cols = w >= TWO_COLS ? 2 : 1;
  const perCol = STATS.length / cols;
  const abilRows = 2 / cols;
  const minH = STATS_Y + perCol * STAT_ROW + 5 + abilRows * ABIL_ROW + ICON_BOX + 2 + 5 + PLAY_H + PAD;
  // A card taller than it needs spreads its rows a little rather than leaving a gap over Play.
  const extra = Math.max(0, h - minH);
  const statRow = STAT_ROW + Math.min(3, Math.floor((extra * 0.4) / perCol));
  const left = extra - (statRow - STAT_ROW) * perCol;
  const abilRow = ABIL_ROW + Math.min(6, Math.floor((left * 0.4) / abilRows));
  const space = 5 + Math.min(5, Math.floor(left * 0.1));
  const rule2 = STATS_Y + perCol * statRow;
  const abilY = rule2 + space;
  const specialY = abilY + abilRows * abilRow + (space - 5);
  return { cols, statRow, abilRow, rule2, abilY, specialY, minH };
}

/**
 * The card: the picked character's name and role over a line of its colour,
 * its six stats as segmented bars measured against the best of every
 * character, its attack and ability, the gold Special strip, and Play.
 */
class InfoCard extends Phaser.GameObjects.Container {
  private top: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.BitmapText;
  private role: Phaser.GameObjects.BitmapText;
  private bars: Phaser.GameObjects.Graphics;
  private values: Phaser.GameObjects.BitmapText[];
  private abilities: Phaser.GameObjects.BitmapText[];
  private icons: {
    attack: Phaser.GameObjects.Sprite;
    special: Phaser.GameObjects.Image;
    ult: Phaser.GameObjects.Image;
  };
  private ultName: Phaser.GameObjects.BitmapText;
  private ultCost: Phaser.GameObjects.BitmapText;
  private bolt: Phaser.GameObjects.Graphics;
  private probe: Phaser.GameObjects.BitmapText;
  private rows: ReturnType<typeof cardRows>;
  /** Each stat bar: its place, and how full it is now and is growing to. */
  private barAt: { x: number; y: number; w: number }[] = [];
  /** Each stat value's right edge. */
  private valueX: number[] = [];
  private fill: number[] = STATS.map(() => 0);
  private from: number[] = STATS.map(() => 0);
  private to: number[] = STATS.map(() => 0);
  private grow?: Phaser.Tweens.Tween;
  private accent = 0xffffff;

  constructor(
    scene: Phaser.Scene,
    readonly boxW: number,
    readonly boxH: number,
    play: () => void,
  ) {
    super(scene, 0, 0);
    const w = boxW;
    const rows = (this.rows = cardRows(w, boxH));
    const bg = scene.add.image(0, 0, panelTexture(scene, 'sel_card', w, boxH, SOLID)).setOrigin(0);
    this.top = scene.add.graphics();
    this.nameText = pixelText(scene, PAD, NAME_Y, '', INK, 2);
    this.role = pixelText(scene, PAD, ROLE_Y, '', LAVENDER);
    this.probe = pixelText(scene, 0, 0, '').setVisible(false);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const lines = scene.add.graphics();
    const rule = (y: number) => {
      lines.fillStyle(OUTLINE).fillRect(PAD, y, w - PAD * 2, 1);
      lines.fillStyle(0x43356e).fillRect(PAD, y + 1, w - PAD * 2, 1);
    };

    // The stats: an icon, a name, a bar, and the value at the column's right edge.
    const colGap = 10;
    const colW = Math.floor((w - PAD * 2 - (rows.cols - 1) * colGap) / rows.cols);
    const labelW = Math.max(...STATS.map((s) => this.probe.setText(s.name).width)) + 3;
    const valueW = this.probe.setText('000').width + 1;
    const perCol = STATS.length / rows.cols;
    this.values = STATS.map((s, i) => {
      const col = Math.floor(i / perCol);
      const x = PAD + col * (colW + colGap);
      const y = STATS_Y + (i % perCol) * rows.statRow;
      parts.push(scene.add.image(x - 1, y - 1, 'sel_stat_icons', s.icon).setOrigin(0));
      parts.push(pixelText(scene, x + 10, y, s.name, SOFT));
      const bx = x + 10 + labelW;
      this.barAt.push({ x: bx, y: y + 1, w: x + colW - valueW - 3 - bx });
      this.valueX.push(x + colW);
      return pixelText(scene, x + colW, y, '', INK);
    });
    this.bars = scene.add.graphics();
    rule(rows.rule2);

    // Attack and ability: an icon in a recessed box, what it is, and its name.
    const boxes = scene.add.graphics();
    const box = (x: number, y: number, size: number, rimC: number) => {
      boxes.fillStyle(OUTLINE).fillRect(x, y, size, size);
      boxes.fillStyle(0x140f2a).fillRect(x + 1, y + 1, size - 2, size - 2);
      boxes.fillStyle(rimC).fillRect(x + 1, y + size - 2, size - 2, 1);
    };
    const abilW = Math.floor((w - PAD * 2 - (rows.cols - 1) * colGap) / rows.cols);
    const abilAt = (i: number) => (rows.cols === 2 ? { x: PAD + i * (abilW + colGap), y: rows.abilY } : { x: PAD, y: rows.abilY + i * rows.abilRow });
    this.abilities = ['Attack', 'Ability'].map((kind, i) => {
      const { x, y } = abilAt(i);
      box(x, y, ICON_BOX, 0x43356e);
      parts.push(pixelText(scene, x + ICON_BOX + 5, y, kind, SOFT));
      return pixelText(scene, x + ICON_BOX + 5, y + 9, '');
    });

    // The Special: a gold-rimmed strip with its icon, its name and what it costs in energy.
    const sx = PAD - 2;
    const sw = w - (PAD - 2) * 2;
    const sy = rows.specialY;
    const sh = ICON_BOX + 2;
    const strip = scene.add.graphics();
    strip.fillStyle(OUTLINE).fillRect(sx, sy, sw, sh);
    strip.fillStyle(GOLD_DARK).fillRect(sx + 1, sy + 1, sw - 2, sh - 2);
    strip.fillStyle(0x1c1538).fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
    strip.fillStyle(GOLD_LIT, 0.7).fillRect(sx + 2, sy + 1, sw - 4, 1);
    strip.fillStyle(GOLD_LIT, 0.08).fillRect(sx + 2, sy + 2, sw - 4, 6);
    const ultBox = sx + 2;
    box(ultBox, sy + 1, ICON_BOX, 0x8a4e22);
    const ultLabel = pixelText(scene, ultBox + ICON_BOX + 5, sy + 2, 'Special', GOLD);
    this.ultName = pixelText(scene, ultBox + ICON_BOX + 5, sy + 11, '');
    this.ultCost = pixelText(scene, 0, sy + 6, '', GOLD);
    this.bolt = scene.add.graphics();

    const a0 = abilAt(0);
    const a1 = abilAt(1);
    this.icons = {
      attack: scene.add.sprite(a0.x + ICON_BOX / 2, a0.y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      special: scene.add.image(a1.x + ICON_BOX / 2, a1.y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      ult: scene.add.image(ultBox + ICON_BOX / 2, sy + 1 + ICON_BOX / 2, '__DEFAULT'),
    };
    const playBtn = new PixelButton(scene, 'Play', w - PAD * 2, PLAY_H, BUTTON_GOLD, `sel_play_${w}`, play).place(PAD, boxH - PAD - PLAY_H);
    this.add([
      bg,
      this.top,
      this.nameText,
      this.role,
      lines,
      ...parts,
      this.bars,
      ...this.values,
      boxes,
      ...this.abilities,
      strip,
      ultLabel,
      this.ultName,
      this.ultCost,
      this.bolt,
      this.icons.attack,
      this.icons.special,
      this.icons.ult,
      playBtn,
      this.probe,
    ]);
  }

  show(
    name: string,
    role: string,
    accent: number,
    stats: HeroStats,
    attack: string,
    special: string,
    buttons: {
      attack: { texture: string; frame?: string; anim?: string };
      special: { texture: string };
    },
    ult: { icon: string; name: string; cost: number },
  ): void {
    const w = this.boxW;
    const textW = w - PAD * 2;
    this.accent = accent;
    // A band of the hero's colour along the top, and a line under its role that fades out to the right.
    const g = this.top.clear();
    g.fillStyle(accent).fillRect(2, 2, w - 4, 2);
    g.fillStyle(0xffffff, 0.35).fillRect(2, 2, w - 4, 1);
    for (let x = 0; x < textW; x++) {
      const a = 1 - x / textW;
      if (a < bayer(x, 0) * 0.9) continue;
      g.fillStyle(accent, 0.35 + a * 0.65).fillRect(PAD + x, RULE_Y, 1, 1);
    }
    g.fillStyle(OUTLINE, 0.8).fillRect(PAD, RULE_Y + 1, textW, 1);

    // The name, big when it fits, and the role.
    this.nameText.setScale(2).setText(name.toUpperCase());
    if (this.nameText.width > textW)
      this.nameText
        .setScale(1)
        .setText(fitLine(this.probe, name, textW))
        .setY(NAME_Y + 5);
    else this.nameText.setY(NAME_Y);
    this.role.setText(fitLine(this.probe, role, textW));

    // The stats: values set to their column's right edge, the bars growing to the new numbers.
    const tops = statMax();
    STATS.forEach((s, i) => {
      const t = this.values[i].setText(s.value(stats));
      t.setX(this.valueX[i] - t.width);
      this.to[i] = Phaser.Math.Clamp(s.num(stats) / tops[i], 0.06, 1);
    });
    this.from = [...this.fill];
    this.grow?.stop();
    this.grow = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: BAR_MS,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => this.drawBars(tw.getValue() ?? 1),
      onComplete: () => this.drawBars(1),
    });

    // Attack and ability, named for the look.
    const abW = (i: number) => this.abilityRight(i) - this.abilities[i].x;
    this.abilities[0].setText(fitLine(this.probe, attack, abW(0)));
    this.abilities[1].setText(fitLine(this.probe, special, abW(1)));
    this.icons.attack.stop();
    this.icons.attack.setTexture(buttons.attack.texture, buttons.attack.frame);
    if (buttons.attack.anim) this.icons.attack.play(buttons.attack.anim);
    this.icons.special.setTexture(buttons.special.texture);

    // The Special, and its energy cost at the right with a bolt.
    if (this.scene.textures.exists(ult.icon)) this.icons.ult.setTexture(ult.icon).setVisible(true);
    else this.icons.ult.setVisible(false);
    const right = w - PAD - 3;
    const sy = this.rows.specialY;
    this.ultCost.setText(`${ult.cost}`);
    this.ultCost.setX(right - this.ultCost.width);
    const boltX = this.ultCost.x - 7;
    const b = this.bolt.clear();
    const BOLT = ['..##', '.##.', '####', '.##.', '##..'];
    BOLT.forEach((row, y) => [...row].forEach((c, x) => c === '#' && b.fillStyle(GOLD_LIT).fillRect(boltX + x, sy + 7 + y, 1, 1)));
    this.ultName.setText(fitLine(this.probe, ult.name, boltX - 4 - this.ultName.x));
  }

  /** The right edge an ability's name may run to. */
  private abilityRight(i: number): number {
    if (this.rows.cols === 1) return this.boxW - PAD;
    const colGap = 10;
    const colW = Math.floor((this.boxW - PAD * 2 - colGap) / 2);
    return PAD + i * (colW + colGap) + colW;
  }

  /** The stat bars, `t` of the way from their old fill to the new: a dark trough, then segments of the hero's colour lit along the top. */
  private drawBars(t: number): void {
    const g = this.bars.clear();
    const lit = mixN(this.accent, 0xffffff, 0.45);
    const dark = mixN(this.accent, OUTLINE, 0.35);
    this.barAt.forEach((at, i) => {
      const f = (this.fill[i] = this.from[i] + (this.to[i] - this.from[i]) * t);
      const inner = at.w - 2;
      const fw = Math.max(1, Math.round(inner * f));
      g.fillStyle(OUTLINE).fillRect(at.x, at.y, at.w, BAR_H);
      g.fillStyle(0x1e1840).fillRect(at.x + 1, at.y + 1, inner, BAR_H - 2);
      g.fillStyle(dark).fillRect(at.x + 1, at.y + 1, fw, BAR_H - 2);
      g.fillStyle(this.accent).fillRect(at.x + 1, at.y + 1, fw, BAR_H - 3);
      g.fillStyle(lit).fillRect(at.x + 1, at.y + 1, fw, 1);
      // Notches every few pixels split the bar into segments.
      for (let x = 5; x < fw; x += 6) g.fillStyle(OUTLINE, 0.5).fillRect(at.x + 1 + x, at.y + 1, 1, BAR_H - 2);
      g.fillStyle(0xffffff, 0.75).fillRect(at.x + fw, at.y + 1, 1, BAR_H - 2);
    });
  }
}

/** How the page fits a view: stacked or side by side, and every part's size. */
interface Plan {
  tall: boolean;
  chip: number;
  cols: number;
  rosterW: number;
  rosterH: number;
  showW: number;
  showH: number;
  scale: number;
  infoW: number;
  infoH: number;
}

/** The roster's size with `chip`-sized chips in `cols` columns. */
const rosterSize = (chip: number, cols: number) => {
  const rows = Math.ceil(CLASSES.length / cols);
  return {
    w: cols * (chip + CHIP_GAP) - CHIP_GAP + ROSTER_PAD * 2,
    h: rows * (chip + CHIP_GAP) - CHIP_GAP + ROSTER_PAD * 2,
  };
};

/** Side by side, for a wide view: the roster on the left, the showcase in the middle, the card on the right. Null when it can't fit. */
function widePlan(vw: number, vh: number): Plan | null {
  const band = Math.min(vh - TOP - MARGIN, BAND_MAX);
  if (band < cardRows(INFO_W).minH) return null;
  for (const chip of CHIP_SIZES)
    for (const cols of [3, 4]) {
      const r = rosterSize(chip, cols);
      if (r.h > band) continue;
      const showW = Math.min(SHOW_MAX, Math.floor((vw - MARGIN * 2 - r.w - INFO_W - GAP * 2) / 2) * 2);
      if (showW < SHOW_MIN) continue;
      const scale = HERO_SCALES.find((s) => showMinH(s) <= band && 24 * s <= showW - 20);
      if (!scale) continue;
      return {
        tall: false,
        chip,
        cols,
        rosterW: r.w,
        rosterH: band,
        showW,
        showH: band,
        scale,
        infoW: INFO_W,
        infoH: band,
      };
    }
  return null;
}

/** Stacked, for a tall view: the showcase, the card under it, and the roster at the bottom. Null when it can't fit. */
function tallPlan(vw: number, vh: number): Plan | null {
  const w = Math.floor(Math.min(vw - MARGIN * 2, COLUMN_MAX) / 2) * 2;
  if (w < SHOW_MIN) return null;
  const infoH = cardRows(w).minH;
  // The biggest chips that keep the roster to three rows, else the smallest.
  let chip = CHIP_SIZES[CHIP_SIZES.length - 1];
  for (const c of CHIP_SIZES) {
    const cols = Math.floor((w - ROSTER_PAD * 2 + CHIP_GAP) / (c + CHIP_GAP));
    if (Math.ceil(CLASSES.length / cols) <= 3) {
      chip = c;
      break;
    }
  }
  const cols = Math.floor((w - ROSTER_PAD * 2 + CHIP_GAP) / (chip + CHIP_GAP));
  const r = rosterSize(chip, cols);
  const room = vh - TOP - MARGIN - GAP * 2 - infoH - r.h;
  const scale = HERO_SCALES.find((s) => showMinH(s) <= room && 24 * s <= w - 20);
  if (!scale) return null;
  return {
    tall: true,
    chip,
    cols,
    rosterW: w,
    rosterH: r.h,
    showW: w,
    showH: Math.min(room, showMinH(scale) + 30),
    scale,
    infoW: w,
    infoH,
  };
}

/** The select page itself, opened over the home screen. */
export class SelectScene extends Phaser.Scene {
  private cls = 0;
  private leaving = false;
  private shade!: Phaser.GameObjects.Graphics;
  private back!: PixelButton;
  private rosterBg!: Phaser.GameObjects.Image;
  private roster: Chip[] = [];
  private show?: Showcase;
  private info?: InfoCard;
  /** A skin not yet won that the player is looking at (the look worn stays the one they own). */
  private peek: SkinDef | null = null;

  constructor() {
    super('select');
  }

  private get current(): ClassDef {
    return CLASSES[this.cls];
  }

  create(): void {
    this.leaving = false;
    this.peek = null;
    this.show = undefined;
    this.info = undefined;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });
    const saved = CLASSES.findIndex((c) => c.id === lastHero());
    this.cls = Math.min(lastPicked ?? Math.max(0, saved), CLASSES.length - 1);
    ensureUltIcons(this);
    statIconsTexture(this);

    this.shade = this.add.graphics();
    this.rosterBg = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.roster = CLASSES.map((_c, i) => new Chip(this, 2, () => this.pickClass(i)));
    for (const c of this.roster) this.add.existing(c);
    this.back = new PixelButton(this, 'Back', BACK_W, BACK_H, BUTTON_PLAIN, 'sel_back', () => this.goBack());

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
    // A mouse wheel steps through the classes.
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      const d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
      if (Math.abs(d) > 2) this.stepClass(d > 0 ? 1 : -1);
    });

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, delta: number): void {
    this.show?.update(Math.min(0.1, delta / 1000));
  }

  /**
   * Show the current class, its characters, and the picked one in its skin.
   * `pose` plays the picked character's pose; `jump` is a new class; `slide` the side a new character comes in from.
   */
  private refresh(pose: boolean, jump: boolean, slide: -1 | 0 | 1 = 0): void {
    const show = this.show;
    const info = this.info;
    if (!show || !info) return;
    const cls = this.current;
    const own = lookOf(cls);
    const look = this.peek ? { type: own.type, skin: this.peek } : own;
    const def = worn(cls, look);
    this.roster.forEach((c, i) => {
      const d = worn(CLASSES[i]);
      c.show({ preview: d.preview, accent: d.accent }, i === this.cls);
    });
    const picked = cls.types.indexOf(look.type);
    // Every character of the class, each in the look it was last worn in (the picked one as it is now).
    const types = cls.types.map((type, i) => {
      const d = i === picked ? def : worn(cls, lastLookOf(cls, type));
      return { preview: d.preview, name: type.name, accent: d.accent };
    });
    const skins = look.type.skins ?? [];
    const looks: ChipLook[] = [null, ...skins].map((s) => {
      const d = worn(cls, { type: look.type, skin: s });
      return {
        preview: d.preview,
        accent: d.accent,
        rarity: s ? RARITY_INFO[rarityOf(cls, s)].tint : null,
        locked: !ownsSkin(cls, s),
      };
    });
    show.show({
      className: cls.name,
      types,
      picked,
      hero: def.preview,
      accent: def.accent,
      skin: {
        name: look.skin?.name ?? look.type.lookName ?? 'Classic',
        index: look.skin ? skins.indexOf(look.skin) + 1 : 0,
        locked: !!this.peek,
        looks,
        rarity: look.skin ? RARITY_INFO[rarityOf(cls, look.skin)].tint : null,
      },
      slide,
      jump,
      pose,
    });
    // Stats are the type's own numbers (skins never change them); the abilities are named for the look.
    const ult = ultFor(def);
    info.show(look.type.name, def.role, def.accent, heroStats(cls.id, look.type.id), def.attack, def.special, def.buttons, {
      icon: ult.icon,
      name: ult.name,
      cost: ult.def.cost,
    });
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

  private pickType(i: number, slide?: -1 | 1): void {
    const cls = this.current;
    const type = cls.types[i];
    const at = cls.types.indexOf(lookOf(cls).type);
    if (this.leaving || !type || i === at) return;
    this.peek = null;
    setType(cls, type);
    this.refresh(true, false, slide ?? (i > at ? 1 : -1));
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
    this.pickType((cls.types.indexOf(lookOf(cls).type) + step + n) % n, step);
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
    // Back to the game mode menu, still over the home screen.
    this.scene.launch('modes');
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 0,
      duration: 200,
      onComplete: () => this.scene.stop(),
    });
  }

  /** On to the arena select, with this hero. */
  private startGame(): void {
    if (this.leaving) return;
    if (this.peek) {
      // Not theirs yet: the lock rattles, and the skin row says where to get it.
      this.show?.rattle();
      this.show?.say('Win it in the Shop');
      return;
    }
    this.leaving = true;
    const character = this.current.id;
    lastPicked = this.cls;
    rememberHero(character);
    this.scene.launch('arena', { character });
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 0,
      duration: 200,
      onComplete: () => this.scene.stop(),
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    // The layout that suits the view's shape; zoom out a whole step at a time (keeping the pixels crisp) until it fits.
    let z = menuZoom(width, height);
    const planFor = (zz: number): Plan | null => {
      const vw = width / zz;
      const vh = height / zz;
      return vw >= vh * 1.1 ? (widePlan(vw, vh) ?? tallPlan(vw, vh)) : (tallPlan(vw, vh) ?? widePlan(vw, vh));
    };
    let plan = planFor(z);
    while (!plan && z > 1) plan = planFor(--z);
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    plan ??= {
      tall: true,
      chip: 20,
      cols: 9,
      rosterW: vw - 12,
      rosterH: 74,
      showW: SHOW_MIN,
      showH: showMinH(2),
      scale: 2,
      infoW: SHOW_MIN,
      infoH: cardRows(SHOW_MIN).minH,
    };

    // The page behind dims, most at the bottom, so the parts stand out.
    const g = this.shade.clear();
    g.fillStyle(OUTLINE, 0.5).fillRect(0, 0, Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    for (let i = 0; i < 6; i++) g.fillStyle(OUTLINE, 0.07).fillRect(0, vh - 48 + i * 8, Math.ceil(vw) + 1, 48 - i * 8);
    this.back.place(MARGIN, MARGIN);

    // The showcase and the card are built anew when their size changes.
    let fresh = false;
    if (!this.show || this.show.boxW !== plan.showW || this.show.boxH !== plan.showH || this.show.heroScale !== plan.scale) {
      this.show?.destroy();
      this.show = new Showcase(this, plan.showW, plan.showH, plan.scale, {
        stepClass: (d) => this.stepClass(d),
        pickType: (i) => this.pickType(i),
        stepType: (d) => this.stepType(d),
        pose: () => this.show?.pose(),
        pickSkin: (i) => this.pickSkin(i),
        stepSkin: (d) => this.stepSkin(d),
      });
      this.add.existing(this.show);
      fresh = true;
    }
    if (!this.info || this.info.boxW !== plan.infoW || this.info.boxH !== plan.infoH) {
      this.info?.destroy();
      this.info = new InfoCard(this, plan.infoW, plan.infoH, () => this.startGame());
      this.add.existing(this.info);
      fresh = true;
    }

    // Where each part goes.
    let rx: number, ry: number, sx: number, sy: number, ix: number, iy: number;
    if (plan.tall) {
      const total = plan.showH + GAP + plan.infoH + GAP + plan.rosterH;
      const x = Math.round((vw - plan.showW) / 2);
      const y = Math.round(TOP + Math.max(0, (vh - TOP - MARGIN - total) / 2));
      sx = ix = rx = x;
      sy = y;
      iy = sy + plan.showH + GAP;
      ry = iy + plan.infoH + GAP;
    } else {
      const total = plan.rosterW + GAP + plan.showW + GAP + plan.infoW;
      rx = Math.round((vw - total) / 2);
      sx = rx + plan.rosterW + GAP;
      ix = sx + plan.showW + GAP;
      ry = sy = iy = Math.round(TOP + Math.max(0, (vh - TOP - MARGIN - plan.showH) / 2));
    }
    this.show.setPosition(sx, sy);
    this.info.setPosition(ix, iy);

    // The roster: its panel, and the chips in rows, each row centred (the last may be shorter), the grid centred in the panel.
    this.rosterBg.setTexture(panelTexture(this, 'sel_roster', plan.rosterW, plan.rosterH, SOLID)).setPosition(rx, ry);
    const n = CLASSES.length;
    const rows = Math.ceil(n / plan.cols);
    const step = plan.chip + CHIP_GAP;
    const gridH = rows * step - CHIP_GAP;
    const y0 = ry + Math.round((plan.rosterH - gridH) / 2);
    this.roster.forEach((c, i) => {
      const row = Math.floor(i / plan.cols);
      const inRow = Math.min(plan.cols, n - row * plan.cols);
      const rowW = inRow * step - CHIP_GAP;
      c.resize(plan.chip);
      c.x = rx + Math.round((plan.rosterW - rowW) / 2) + (i % plan.cols) * step;
      c.baseY = y0 + row * step;
      c.y = c.baseY - (i === this.cls ? 1 : 0);
    });
    if (fresh) this.refresh(true, true);
  }
}
