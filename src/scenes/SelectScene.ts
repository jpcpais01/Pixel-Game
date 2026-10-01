import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from '../art/bitmap';
import { type RGB } from '../art/pixel';
import { BUST, classBust } from '../art/busts';
import { menuZoom } from '../game/display';
import { CLASSES, type ClassDef, type Preview, type SkinDef } from '../game/characters';
import { heroStats, type HeroStats } from '../game/stats';
import { lastHero, lastLookOf, lookOf, ownsSkin, rememberHero, setLook, setType, worn } from '../game/skins';
import { RARITY_INFO, rarityOf } from '../game/gacha';
import { ensureUltIcons, ultFor } from '../game/ultimate';
import { BUTTON_GOLD, BUTTON_PLAIN, PixelButton, pixelText } from '../ui/widgets';
import { statIconsTexture } from '../ui/statIcons';

// The hero select. The whole screen is a splash for the picked hero: a dark
// backdrop with a slanted slab of the hero's colour behind it, a halo round
// it and sparks rising, and the hero standing big in the light. Over it, with
// no boxes round them:
// - the picker, three steps read top to bottom and joined by a line:
//   1 Class (a wheel of round medallions, the picked one in the middle),
//   2 Character (a card per character of that class), 3 Skin (a swatch per
//   look of that character). Each step names what is picked in it;
// - the details: name and role, the six stats, attack, ability and Special,
//   and Play.
// On a wide screen the picker stands on the left, the hero in the middle and
// the details on the right; on a tall one the hero is on top, then the
// picker, then the details. It is all built from CLASSES, so new classes,
// characters and skins show up by themselves. Swiping the hero steps through
// the class's characters; the medallions, the wheel and Left/Right change class.

const MARGIN = 6;
const BACK_W = 40;
const BACK_H = 14;
/** Everything starts under the Back button. */
const TOP = MARGIN + BACK_H + 4;

/** The picker's steps: a header row (marker, step name, what is picked), then its choices. */
const STEP_HEAD = 9;
const STEP_GAP = 3;
const STEP_SPACE = 8;
/** The choices are indented past the line that joins the steps. */
const INDENT = 11;
/** Class medallions: their size, and the room each takes on the wheel (less on a narrow wheel, tucking the neighbours behind the middle one). */
const MEDAL = 40;
const MEDAL_STEP = 43;
/** The round window the class's head shows through, inside the medallion's rim. */
const MEDAL_FACE = MEDAL - 6;
/** How many times over the head is drawn in its medallion. */
const MEDAL_ZOOM = 2;
/** Character cards, largest first: the largest for which the biggest class fits in two rows (and the height there is) is used. */
const CARD_SIZES = [34, 30, 26, 24, 22];
const CARD_GAP = 4;
/** The most characters a class has: the picker keeps room for them all. */
const MOST_TYPES = Math.max(...CLASSES.map((c) => c.types.length));
/** Skin swatches. */
const SWATCH = 20;
const SWATCH_GAP = 3;
/** The picker's height but for the character cards' rows. */
const PICKER_FIXED = STEP_HEAD + STEP_GAP + MEDAL + 2 + STEP_SPACE + STEP_HEAD + STEP_GAP + STEP_SPACE + STEP_HEAD + STEP_GAP + SWATCH + 1;

/** The character cards: their size, how many fit a row, and how many rows the class with the most characters needs. */
interface CardGrid {
  size: number;
  perRow: number;
  rows: number;
}

const gridH = (g: CardGrid): number => g.rows * g.size + (g.rows - 1) * CARD_GAP;

/** The biggest cards for which the class with the most characters fits a picker `w` wide in two rows, within `room` px of height. */
function cardGrid(w: number, room = Infinity): CardGrid {
  const grid = (size: number): CardGrid => {
    const perRow = Math.max(1, Math.floor((w - INDENT + CARD_GAP) / (size + CARD_GAP)));
    return { size, perRow, rows: Math.ceil(MOST_TYPES / perRow) };
  };
  const fits = CARD_SIZES.map(grid).find((g) => g.rows <= 2 && gridH(g) <= room);
  return fits ?? grid(CARD_SIZES[CARD_SIZES.length - 1]);
}

/** How wide the picker and the details columns are on a wide screen. */
const PICKER_W = [140, 180];
const DETAILS_W = [124, 150];
/** The widest a stacked page gets. */
const STACK_MAX = 240;

/** The hero: its height in frame pixels, and the sizes it may be drawn at, biggest first. */
const HERO_TALL = 30;
const HERO_SCALES = [5, 4, 3, 2];
/** Sparks drifting up round the hero. */
const MOTES = 12;
/** How long a new character takes to slide in. */
const SLIDE_MS = 260;
/** How many backdrops are kept painted (the screen-sized pictures are big). */
const BACKDROPS_KEPT = 3;
/** How long the medallion wheel takes to turn to a class. */
const WHEEL_MS = 280;

/** The details. */
const NAME_H = 16;
const ROLE_H = 10;
const STAT_ROW = 10;
const ABIL_ROW = 21;
const ICON_BOX = 18;
const PLAY_H = 18;
const SECTION = 6;

/** How far a press on the hero must travel sideways to count as a swipe to the class's next character. */
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
const LINE = 0x43356e;
const NOTE = 0x9ff6ff;

const NIGHT: RGB = [11, 8, 24];
const WHITE: RGB = [255, 255, 255];
const rgbOf = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const numOf = (c: RGB): number => (c[0] << 16) | (c[1] << 8) | c[2];
const mixN = (a: number, b: number, t: number): number => numOf(mix(rgbOf(a), rgbOf(b), t));

/** Stats: an icon, a short name, and how its value reads (ATK/S: attacks a second; REGEN: HP a second). */
const STATS: { icon: number; name: string; value: (s: HeroStats) => string }[] = [
  { icon: 0, name: 'HP', value: (s) => `${s.hp}` },
  { icon: 1, name: 'DMG', value: (s) => `${s.damage}` },
  { icon: 3, name: 'DEF', value: (s) => `${s.defense}` },
  { icon: 2, name: 'MOVE', value: (s) => `${s.speed}` },
  { icon: 4, name: 'ATK/S', value: (s) => s.rate.toFixed(1) },
  { icon: 5, name: 'REGEN', value: (s) => `${s.regen}` },
];

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

// ---- Portraits: a look's head and shoulders, for the medallions, cards and swatches. ----

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
function portrait(s: Phaser.GameObjects.Sprite, preview: Preview, x: number, y: number, w: number, h: number, scale: number, drop = 1): void {
  const frame = idleFrame(s.scene, preview);
  const head = headOf(frame, preview);
  s.stop();
  s.setTexture(frame.texture.key, frame.name).setOrigin(0).setScale(scale);
  const fw = frame.width;
  const fh = frame.height;
  const cw = Math.min(fw, Math.floor(w / scale));
  const ch = Math.min(fh, Math.floor(h / scale));
  const cx = Phaser.Math.Clamp(head.x - Math.floor(cw / 2), 0, fw - cw);
  const cy = Phaser.Math.Clamp(head.y - Math.floor(ch / 2) + drop, 0, fh - ch);
  s.setCrop(cx, cy, cw, ch);
  s.setPosition(x + Math.floor((w - cw * scale) / 2) - cx * scale, y + Math.floor((h - ch * scale) / 2) - cy * scale);
}

// ---- Drawing helpers. ----

/** A box with 2 px rounded corners: a dark outline, a 1 px rim and a fill. */
function roundBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, rim: number): void {
  g.fillStyle(OUTLINE).fillRect(x + 2, y, w - 4, h).fillRect(x + 1, y + 1, w - 2, h - 2).fillRect(x, y + 2, w, h - 4);
  g.fillStyle(rim).fillRect(x + 2, y + 1, w - 4, h - 2).fillRect(x + 1, y + 2, w - 2, h - 4);
  g.fillStyle(fill).fillRect(x + 2, y + 2, w - 4, h - 4);
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

// ---- Painted once and cached. ----

/**
 * The backdrop for a hero in `accent` standing at (`hx`, `feet`), drawn at
 * `scale`: a night gradient; a slab of the hero's colour leaning to the right
 * as it rises, lit from below, ruled with fine stripes and dotted with halftone
 * towards its foot, with a thin echo either side; a halo of light behind the
 * hero ringed by a fine circle; a pool of light at its feet; and darkness
 * gathering towards the edges, so the text either side reads clearly.
 */
function backdropTexture(scene: Phaser.Scene, w: number, h: number, hx: number, feet: number, scale: number, accent: number): string {
  const key = `sel_bd_${w}x${h}_${hx}_${feet}_${scale}_${accent.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const A = rgbOf(accent);
  const skyLow = mix([26, 20, 52], A, 0.1);
  const deep = mix(NIGHT, A, 0.3);
  const mid = mix([38, 28, 78], A, 0.62);
  const lit = mix(A, WHITE, 0.4);
  const heroH = HERO_TALL * scale;
  const half = Math.round(Math.max(30, scale * 12));
  const slant = 0.36;
  const cy = feet - heroH * 0.55;
  const R = heroH * 0.6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = bayer(x, y);
      let c = mix(NIGHT, skyLow, Math.floor((y / h) * 7 + d) / 7);
      // The slab, fading out a little under the hero's feet.
      const rise = feet - y;
      const fade = clamp01((rise + 34) / 34);
      const bx = x - hx - rise * slant;
      const edge = Math.abs(bx);
      if (edge < half && fade > d * 0.999) {
        const up = clamp01(rise / (feet + 1));
        let s = mix(mid, deep, Math.floor(up * 5 + d) / 5);
        // Fine stripes along the slab, brighter towards its foot.
        if (((Math.floor(bx) % 7) + 7) % 7 === 0) s = mix(s, lit, 0.1 + (1 - up) * 0.12);
        // Halftone dots in its lower part, growing as they near the feet.
        if (up < 0.45) {
          const big = up < 0.2;
          if ((big ? (x & 3) < 2 && (y & 3) < 2 : (x & 3) === 0 && (y & 3) === 0) && rise > -30) s = mix(s, lit, 0.22);
        }
        if (edge > half - 1) s = mix(s, lit, 0.7);
        else if (edge > half - 2) s = mix(s, NIGHT, 0.4);
        c = s;
      } else {
        // Thin echoes of the slab on either side.
        const e1 = Math.abs(bx - half - 9);
        const e2 = Math.abs(bx + half + 7);
        if (fade > d && (e1 < 3 || e2 < 1.5)) c = mix(c, mid, 0.55);
      }
      // The halo behind the hero, in dithered steps, ringed by a fine circle.
      const r = Math.hypot(x + 0.5 - hx, (y + 0.5 - cy) * 1.05);
      if (r < R) c = mix(c, lit, (Math.floor(Math.pow(1 - r / R, 1.4) * 5 + d) / 5) * 0.5);
      if (Math.abs(r - R * 1.12) < 0.55) c = mix(c, lit, 0.5);
      if (Math.abs(r - R * 1.3) < 0.55 && (Math.floor(Math.atan2(y - cy, x - hx) * 40) & 3) === 0) c = mix(c, lit, 0.4);
      // The pool of light at its feet.
      const pe = Math.hypot((x + 0.5 - hx) / (heroH * 0.75), (y + 0.5 - feet) / Math.max(5, heroH * 0.12));
      if (pe < 1) c = mix(c, lit, (Math.floor((1 - pe) * 4 + d) / 4) * 0.35);
      // Darker away from the hero, and at the very bottom.
      const vx = Math.abs(x - hx) / Math.max(hx, w - hx);
      const v = clamp01(vx * vx * 0.85 + (y > h - 20 ? (y - (h - 20)) / 40 : 0));
      if (v > d * 0.9) c = mix(c, NIGHT, Math.min(0.6, v * 0.75));
      b.set(x, y, c);
    }
  }
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

/**
 * A class medallion's plate, in greys so it takes its hero's colour when
 * tinted: a disc lit from below, with a dark edge and a pale rim at the top.
 */
function plateTexture(scene: Phaser.Scene): string {
  const key = 'sel_medal';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(MEDAL, MEDAL);
  const c = MEDAL / 2;
  for (let y = 0; y < MEDAL; y++)
    for (let x = 0; x < MEDAL; x++) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (r > c) continue;
      const t = y / MEDAL;
      let v = 52 + 90 * (Math.floor(t * 4 + bayer(x, y)) / 4);
      if (r > c - 1.2) v = 14;
      else if (r > c - 2.2) v = y < c ? 200 : 110;
      b.set(x, y, [v, v, v]);
    }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** The gold ring round the picked medallion, with a faint glow outside it. */
function ringTexture(scene: Phaser.Scene): string {
  const key = 'sel_medal_ring';
  if (scene.textures.exists(key)) return key;
  const s = MEDAL + 6;
  const b = new Bitmap(s, s);
  const c = s / 2;
  const lit = rgbOf(GOLD_LIT);
  const dark = rgbOf(GOLD_DARK);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const edge = MEDAL / 2;
      if (r > edge - 2.2 && r <= edge - 0.8) b.set(x, y, y < c ? lit : dark);
      else if (r > edge - 0.8 && r <= edge + 0.4) b.set(x, y, NIGHT);
      else if (r > edge + 0.4 && r <= edge + 2.6) b.set(x, y, lit, Math.round(90 * (1 - (r - edge) / 2.6)));
    }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

// ---- The picker. ----

/**
 * A look's head and shoulders at `MEDAL_ZOOM` times size, cut to a disc `d` across, so
 * nothing of the hero (a hat, a staff, a wing) pokes out of its medallion.
 * Kept per frame once its head has been found in real pixels.
 */
function medalHead(scene: Phaser.Scene, preview: Preview, d: number): string {
  const frame = idleFrame(scene, preview);
  const head = headOf(frame, preview);
  const known = heads.has(`${frame.texture.key}:${frame.name}`);
  const key = `sel_mh_${frame.texture.key}_${frame.name}_${d}${known ? '' : '_guess'}`;
  if (known && scene.textures.exists(key)) return key;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const scale = MEDAL_ZOOM;
  const fw = frame.cutWidth;
  const fh = frame.cutHeight;
  const cw = Math.min(fw, Math.ceil(d / scale));
  const ch = Math.min(fh, Math.ceil(d / scale));
  const cx = Phaser.Math.Clamp(head.x - Math.floor(cw / 2), 0, fw - cw);
  const cy = Phaser.Math.Clamp(head.y - Math.floor(ch / 2) + 2, 0, fh - ch);
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = frame.source.image as CanvasImageSource | undefined;
  if (ctx && img) {
    ctx.imageSmoothingEnabled = false;
    try {
      ctx.drawImage(img, frame.cutX + cx, frame.cutY + cy, cw, ch, Math.floor((d - cw * scale) / 2), Math.floor((d - ch * scale) / 2), cw * scale, ch * scale);
      // Clear everything outside the disc, so the edge is a clean pixel circle.
      const px = ctx.getImageData(0, 0, d, d);
      const r = d / 2;
      for (let y = 0; y < d; y++)
        for (let x = 0; x < d; x++) if (Math.hypot(x + 0.5 - r, y + 0.5 - r) > r) px.data[(y * d + x) * 4 + 3] = 0;
      ctx.putImageData(px, 0, 0);
    } catch {
      // An image we can't read: the medallion shows its plate alone.
    }
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

/**
 * A class's own bust (see art/busts), painted at the screen's pixel size and
 * cut to the medallion's disc: sharper than the hero's sprite blown up. Null
 * for a class without one.
 */
function bustTexture(scene: Phaser.Scene, id: string, d: number): string | null {
  const key = `sel_bust_${id}_${d}`;
  if (scene.textures.exists(key)) return key;
  const b = classBust(id);
  if (!b) return null;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const px = ctx.createImageData(d, d);
  const o = Math.floor((d - BUST) / 2);
  const r = d / 2;
  for (let y = 0; y < d; y++)
    for (let x = 0; x < d; x++) {
      const bx = x - o;
      const by = y - o;
      if (bx < 0 || by < 0 || bx >= BUST || by >= BUST || Math.hypot(x + 0.5 - r, y + 0.5 - r) > r) continue;
      const i = (by * BUST + bx) * 4;
      const j = (y * d + x) * 4;
      // The glowing parts (eyes, lenses, gems) shine a little brighter, as they do in the world.
      for (let k = 0; k < 3; k++) px.data[j + k] = Math.min(255, b.diffuse[i + k] + b.emissive[i + k] * 0.5);
      px.data[j + 3] = b.diffuse[i + 3];
    }
  ctx.putImageData(px, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** A round class medallion: its plate in the hero's colour and the class's bust, cut to a disc inside the rim. */
class Medal extends Phaser.GameObjects.Container {
  private plate: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private preview?: Preview;
  private accent = 0xffffff;

  constructor(
    scene: Phaser.Scene,
    private classId: string,
  ) {
    super(scene, 0, 0);
    this.plate = scene.add.image(0, 0, plateTexture(scene)).setOrigin(0);
    this.head = scene.add.image((MEDAL - MEDAL_FACE) / 2, (MEDAL - MEDAL_FACE) / 2, '__DEFAULT').setOrigin(0);
    this.ring = scene.add.image(-3, -3, ringTexture(scene)).setOrigin(0).setVisible(false);
    this.add([this.plate, this.head, this.ring]);
  }

  show(preview: Preview, accent: number): void {
    // The class's bust when it has one; else the look's own head, cut from its sprite.
    if (preview !== this.preview) this.head.setTexture(bustTexture(this.scene, this.classId, MEDAL_FACE) ?? medalHead(this.scene, preview, MEDAL_FACE));
    this.preview = preview;
    this.accent = accent;
  }

  light(picked: boolean, hover: boolean): void {
    this.ring.setVisible(picked);
    this.plate.setTint(mixN(this.accent, 0xffffff, picked ? 0.2 : hover ? 0.05 : 0));
    this.plate.setAlpha(picked || hover ? 1 : 0.8);
    if (picked) this.head.clearTint();
    else this.head.setTint(hover ? 0xd8d0f0 : 0x8a82ac);
  }
}

/**
 * Step one: a wheel of class medallions, the picked one in the middle with a
 * gold ring and the others fading away to either side, with an arrow at each
 * end. It wraps round, so every class is a short turn away. Drag it to turn it;
 * tap a medallion (or an arrow) to pick.
 */
class Wheel extends Phaser.GameObjects.Container {
  private medals: Medal[];
  private arrows: Phaser.GameObjects.Graphics;
  private zone: Phaser.GameObjects.Zone;
  private arrowZones: Phaser.GameObjects.Zone[];
  /** Where the wheel stands: the class (as a fraction while turning) in the middle. */
  private pos = 0;
  private picked = 0;
  private hover = -1;
  private turn?: Phaser.Tweens.Tween;
  private drag: { x: number; pos: number; moved: boolean } | null = null;
  private boxW = 0;

  constructor(
    scene: Phaser.Scene,
    private pick: (i: number) => void,
  ) {
    super(scene, 0, 0);
    this.medals = CLASSES.map((c) => new Medal(scene, c.id));
    this.arrows = scene.add.graphics();
    this.zone = scene.add.zone(0, -2, 10, MEDAL + 4).setOrigin(0).setInteractive({ useHandCursor: true });
    this.arrowZones = ([-1, 1] as const).map((dir) => {
      const z = scene.add.zone(0, -2, 14, MEDAL + 4).setOrigin(0);
      onTap(scene, z, () => this.pick((this.picked + dir + CLASSES.length) % CLASSES.length));
      return z;
    });
    this.add([...this.medals, this.arrows, this.zone, ...this.arrowZones]);

    const z = () => scene.cameras.main.zoom;
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.turn?.stop();
      this.drag = { x: p.x, pos: this.pos, moved: false };
    });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch && !this.drag) this.setHover(this.medalAt(p));
    });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setHover(-1));
    const move = (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const dx = (p.x - this.drag.x) / z();
      if (Math.abs(dx) > TAP_SLOP) this.drag.moved = true;
      if (this.drag.moved) this.place(this.drag.pos - dx / this.step);
    };
    const up = (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      const n = CLASSES.length;
      const i = d.moved ? ((Math.round(this.pos) % n) + n) % n : this.medalAt(p);
      if (i >= 0 && i !== this.picked) this.pick(i);
      else this.settle();
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, move);
    scene.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, move);
      scene.input.off(Phaser.Input.Events.POINTER_UP, up);
    });
  }

  resize(w: number): void {
    this.boxW = w;
    this.zone.setSize(w - 24, MEDAL + 4).setX(12);
    this.arrowZones[0].setX(-2);
    this.arrowZones[1].setX(w - 12);
    const g = this.arrows.clear();
    drawTallArrow(g, 1, Math.round(MEDAL / 2) - 6, -1, GOLD);
    drawTallArrow(g, w - 6, Math.round(MEDAL / 2) - 6, 1, GOLD);
    this.place(this.pos);
  }

  /** Every class's look and colour; the picked one turns to the middle (at once, or over a moment). */
  show(looks: { preview: Preview; accent: number }[], picked: number, now: boolean): void {
    looks.forEach((l, i) => this.medals[i].show(l.preview, l.accent));
    this.picked = picked;
    this.turn?.stop();
    if (now) this.place(picked);
    else this.settle();
    this.lightAll();
  }

  /** Turn to the picked class the short way round: to the copy of it nearest where the wheel stands. */
  private settle(): void {
    const n = CLASSES.length;
    const from = this.pos;
    const target = from + ((((this.picked - from + n / 2) % n) + n) % n) - n / 2;
    this.turn?.stop();
    this.turn = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: WHEEL_MS,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => this.place(from + (target - from) * (tw.getValue() ?? 1)),
      onComplete: () => this.place(this.picked),
    });
  }

  /** How far apart the medallions stand: their full room, or close enough that both neighbours of the middle one fit between the arrows. */
  private get step(): number {
    return Math.min(MEDAL_STEP, Math.floor(this.boxW / 2 - 8 - MEDAL / 2));
  }

  /** Stand the wheel at `pos`: each medallion along the row by how far it is round from the middle, fading out to the ends. */
  private place(pos: number): void {
    const n = CLASSES.length;
    this.pos = ((pos % n) + n) % n;
    const cx = this.boxW / 2;
    const reach = cx - 8 - MEDAL / 2;
    this.medals.forEach((m, i) => {
      const rel = ((((i - this.pos + n / 2) % n) + n) % n) - n / 2;
      const x = cx + rel * this.step;
      const off = Math.abs(x - cx);
      m.setVisible(off <= reach + 2);
      m.setPosition(Math.round(x - MEDAL / 2), 0);
      m.setAlpha(clamp01(1 - Math.pow(off / (reach + this.step * 0.6), 2)));
    });
    // The middle one over its neighbours.
    this.bringToTop(this.medals[this.picked]);
  }

  /** The class whose medallion is under the pointer. */
  private medalAt(p: Phaser.Input.Pointer): number {
    const z = this.scene.cameras.main.zoom;
    const x = p.x / z - this.x - (this.parentContainer?.x ?? 0);
    const n = CLASSES.length;
    const rel = Math.round((x - this.boxW / 2) / this.step);
    return (((Math.round(this.pos) + rel) % n) + n) % n;
  }

  private setHover(i: number): void {
    if (i === this.hover) return;
    this.hover = i;
    this.lightAll();
  }

  private lightAll(): void {
    this.medals.forEach((m, i) => m.light(i === this.picked, i === this.hover));
  }
}

/** What a card or swatch shows: a look, its colour, and for skins, how rare it is and whether it's owned. */
interface ChipLook {
  preview: Preview;
  accent: number;
  rarity?: number | null;
  locked?: boolean;
}

/**
 * A square card with a hero's head and shoulders, lit from below in its
 * colour: a character in step two (at twice size) or a skin in step three (at
 * its own size). The picked one has a gold rim and stands a pixel higher.
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
    portrait(this.head, this.look.preview, 2, 2, this.size - 4, this.size - 4, this.headScale, this.headScale > 1 ? 2 : 3);
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
    const k = picked ? 1 : hover ? 0.7 : 0.4;
    const top = mixN(DEEP, a, 0.08 + 0.14 * k);
    const low = mixN(DEEP, a, 0.12 + 0.45 * k);
    const rim = picked ? GOLD : mixN(0x3a2f66, a, hover ? 0.5 : 0.2);
    const g = this.g.clear();
    if (picked) g.fillStyle(a, 0.35).fillRect(-1, 1, s + 2, s - 2).fillRect(1, -1, s - 2, s + 2);
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
    else this.head.setTint(hover ? 0xe0d8f4 : 0x9890b8);
    this.lock.setVisible(!!look.locked).setPosition(s - this.lock.width - 1, s - this.lock.height - 1);
  }
}

/** Which skin is worn and every look of the picked character, for step three. */
interface SkinPick {
  name: string;
  index: number;
  /** A skin not yet won, being looked at: its name dimmed, with a lock. */
  locked: boolean;
  looks: ChipLook[];
  /** The rarity's colour for the skin's name, or null for the type's own look. */
  rarity: number | null;
}

/** What the picker shows. */
interface PickData {
  classIndex: number;
  className: string;
  classes: { preview: Preview; accent: number }[];
  types: ChipLook[];
  typeName: string;
  picked: number;
  skin: SkinPick;
  jump: boolean;
}

/**
 * The picker: three steps, each a header (a gold diamond on the line that
 * joins them, the step's name, and what is picked in it) over its choices.
 */
class Picker extends Phaser.GameObjects.Container {
  private line: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.BitmapText[];
  private values: Phaser.GameObjects.BitmapText[];
  private lock: Phaser.GameObjects.Image;
  private wheel: Wheel;
  private cards: Chip[] = [];
  private swatches: Chip[] = [];
  private probe: Phaser.GameObjects.BitmapText;
  private rows: number[] = [0, 0, 0];
  private boxW = 0;
  private grid: CardGrid = cardGrid(PICKER_W[0]);
  private shown = false;
  private skin?: SkinPick;
  private note: string | null = null;
  private noteTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    private calls: { pickClass(i: number): void; pickType(i: number): void; pickSkin(i: number): void },
  ) {
    super(scene, 0, 0);
    this.line = scene.add.graphics();
    this.labels = ['Class', 'Character', 'Skin'].map((t) => pixelText(scene, 0, 0, t, SOFT));
    this.values = [0, 1, 2].map(() => pixelText(scene, 0, 0, '', INK));
    this.lock = scene.add.image(0, 0, 'icon_lock').setOrigin(0).setVisible(false);
    this.wheel = new Wheel(scene, (i) => calls.pickClass(i));
    this.probe = pixelText(scene, 0, 0, '').setVisible(false);
    this.add([this.line, ...this.labels, ...this.values, this.lock, this.wheel, this.probe]);
  }

  resize(w: number, grid: CardGrid): void {
    this.boxW = w;
    this.grid = grid;
    this.shown = false;
    // Where each step's header sits.
    const s1 = 0;
    const s2 = s1 + STEP_HEAD + STEP_GAP + MEDAL + 2 + STEP_SPACE;
    const s3 = s2 + STEP_HEAD + STEP_GAP + gridH(grid) + STEP_SPACE;
    this.rows = [s1, s2, s3];
    this.labels.forEach((l, i) => l.setPosition(INDENT, this.rows[i]));
    this.wheel.setPosition(INDENT - 2, s1 + STEP_HEAD + STEP_GAP);
    this.wheel.resize(w - INDENT + 2);
    // The line joining the steps' diamonds, and the diamonds.
    const g = this.line.clear();
    const lx = 3;
    g.fillStyle(LINE).fillRect(lx, this.rows[0] + 4, 1, this.rows[2] - this.rows[0]);
    for (const y of this.rows) {
      const cy = y + 3;
      g.fillStyle(OUTLINE).fillRect(lx - 3, cy - 1, 7, 3).fillRect(lx - 2, cy - 2, 5, 5).fillRect(lx - 1, cy - 3, 3, 7);
      g.fillStyle(GOLD_DARK).fillRect(lx - 2, cy, 5, 1).fillRect(lx - 1, cy - 1, 3, 3).fillRect(lx, cy - 2, 1, 5);
      g.fillStyle(GOLD_LIT).fillRect(lx, cy - 1, 1, 1);
    }
  }

  show(d: PickData): void {
    this.wheel.show(d.classes, d.classIndex, !this.shown);
    this.shown = true;
    this.setValue(0, d.className, GOLD);
    this.setValue(1, d.typeName, INK);

    // Step two: a card per character, left to right, in as few rows as they
    // fit and shared evenly between them (eight in two rows of four).
    const { size, perRow } = this.grid;
    const cols = Math.ceil(d.types.length / Math.ceil(d.types.length / perRow));
    while (this.cards.length < d.types.length) {
      const i = this.cards.length;
      const c = new Chip(this.scene, 2, () => this.calls.pickType(i));
      this.cards.push(c);
      this.add(c);
    }
    this.cards.forEach((c, i) => {
      c.setVisible(i < d.types.length);
      if (i >= d.types.length) return;
      c.resize(size);
      c.x = INDENT + (i % cols) * (size + CARD_GAP);
      c.baseY = this.rows[1] + STEP_HEAD + STEP_GAP + Math.floor(i / cols) * (size + CARD_GAP);
      c.show(d.types[i], i === d.picked);
    });

    this.skin = d.skin;
    this.note = null;
    this.noteTimer?.remove();
    this.drawSkins();
  }

  /** Step three: the skin's name (or a note for a moment) in its header, and a swatch per look. */
  private drawSkins(): void {
    const skin = this.skin;
    if (!skin) return;
    if (this.note) this.setValue(2, this.note, NOTE);
    else this.setValue(2, skin.name, skin.locked ? DIMMED : (skin.rarity ?? LAVENDER), skin.locked);
    while (this.swatches.length < skin.looks.length) {
      const i = this.swatches.length;
      const c = new Chip(this.scene, 1, () => this.calls.pickSkin(i)).resize(SWATCH);
      this.swatches.push(c);
      this.add(c);
    }
    this.swatches.forEach((c, i) => {
      c.setVisible(i < skin.looks.length);
      if (i >= skin.looks.length) return;
      c.x = INDENT + i * (SWATCH + SWATCH_GAP);
      c.baseY = this.rows[2] + STEP_HEAD + STEP_GAP;
      c.show(skin.looks[i], i === skin.index);
    });
  }

  /** A step's value, set to the column's right edge (with a lock before a skin not yet won). */
  private setValue(i: number, text: string, tint: number, locked = false): void {
    const lockW = locked ? this.lock.width + 2 : 0;
    const room = this.boxW - INDENT - this.labels[i].width - 8 - lockW;
    const t = this.values[i].setText(fitLine(this.probe, text, room)).setTint(tint);
    t.setPosition(this.boxW - t.width, this.rows[i]);
    if (i === 2) this.lock.setVisible(locked).setPosition(t.x - lockW, this.rows[i]);
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
    this.scene.tweens.add({ targets: this.lock, x: { from: x - 2, to: x }, duration: 60, repeat: 3, yoyo: true, onComplete: () => this.lock.setX(x) });
  }
}

// ---- The details. ----

/** The details' height: one narrow column, or wide (stats in three columns, abilities side by side). */
const detailsH = (wide: boolean): number =>
  NAME_H + ROLE_H + SECTION + (wide ? 2 * STAT_ROW : STATS.length * STAT_ROW) + SECTION + (wide ? ICON_BOX + 10 : 3 * ABIL_ROW) + SECTION + PLAY_H;

/**
 * The details: the picked character's name and role over a line of its
 * colour, its stats, its attack, ability and Special (the Special in gold,
 * with its energy cost), and Play.
 */
class Details extends Phaser.GameObjects.Container {
  private nameText: Phaser.GameObjects.BitmapText;
  private role: Phaser.GameObjects.BitmapText;
  private rule: Phaser.GameObjects.Graphics;
  private values: Phaser.GameObjects.BitmapText[] = [];
  private valueX: number[] = [];
  private names: Phaser.GameObjects.BitmapText[] = [];
  private nameW: number[] = [];
  private icons: { attack: Phaser.GameObjects.Sprite; special: Phaser.GameObjects.Image; ult: Phaser.GameObjects.Image };
  private cost: Phaser.GameObjects.BitmapText;
  private bolt: Phaser.GameObjects.Graphics;
  private boltAt: { x: number; y: number } | null = null;
  private probe: Phaser.GameObjects.BitmapText;

  constructor(
    scene: Phaser.Scene,
    readonly boxW: number,
    readonly wide: boolean,
    play: () => void,
  ) {
    super(scene, 0, 0);
    const w = boxW;
    this.probe = pixelText(scene, 0, 0, '').setVisible(false);
    this.nameText = pixelText(scene, 0, 0, '', INK, 2);
    this.role = pixelText(scene, 0, NAME_H, '', LAVENDER);
    this.rule = scene.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [];

    // The stats: an icon, a name and the value, in rows (or three columns of two when wide).
    let y = NAME_H + ROLE_H + SECTION;
    const cols = wide ? 3 : 1;
    const colGap = 8;
    const colW = Math.floor((w - (cols - 1) * colGap) / cols);
    const perCol = STATS.length / cols;
    STATS.forEach((s, i) => {
      const col = Math.floor(i / perCol);
      const x = col * (colW + colGap);
      const sy = y + (i % perCol) * STAT_ROW;
      parts.push(scene.add.image(x - 1, sy - 1, 'sel_stat_icons', s.icon).setOrigin(0));
      parts.push(pixelText(scene, x + 10, sy, s.name, SOFT));
      this.values.push(pixelText(scene, 0, sy, '', INK));
      this.valueX.push(x + colW);
    });
    y += perCol * STAT_ROW + SECTION;

    // Attack, ability and Special: an icon in a recessed box, what it is, and its name.
    const boxes = scene.add.graphics();
    const box = (x: number, by: number, rimC: number, edge: number) => {
      boxes.fillStyle(OUTLINE).fillRect(x, by, ICON_BOX, ICON_BOX);
      boxes.fillStyle(0x140f2a).fillRect(x + 1, by + 1, ICON_BOX - 2, ICON_BOX - 2);
      boxes.fillStyle(rimC).fillRect(x + 1, by + ICON_BOX - 2, ICON_BOX - 2, 1);
      boxes.fillStyle(edge).fillRect(x + 1, by + 1, ICON_BOX - 2, 1);
    };
    const kinds = ['Attack', 'Ability', 'Special'];
    const at: { x: number; y: number }[] = [];
    const third = Math.floor((w - 2 * colGap) / 3);
    kinds.forEach((kind, i) => {
      const special = i === 2;
      const tint = special ? GOLD : SOFT;
      if (wide) {
        // Side by side: the box, its kind beside it, its name under it.
        const x = i * (third + colGap);
        at.push({ x, y });
        box(x, y, special ? GOLD_DARK : LINE, special ? GOLD_LIT : 0x221a44);
        parts.push(pixelText(scene, x + ICON_BOX + 3, y + 1, kind, tint));
        this.names.push(pixelText(scene, x, y + ICON_BOX + 2, ''));
        this.nameW.push(third);
      } else {
        const ry = y + i * ABIL_ROW;
        at.push({ x: 0, y: ry });
        box(0, ry, special ? GOLD_DARK : LINE, special ? GOLD_LIT : 0x221a44);
        parts.push(pixelText(scene, ICON_BOX + 4, ry, kind, tint));
        this.names.push(pixelText(scene, ICON_BOX + 4, ry + 9, ''));
        this.nameW.push(w - ICON_BOX - 4);
      }
    });
    // The Special's cost, a bolt and a number: under its kind when wide, at the row's right when narrow.
    this.cost = pixelText(scene, 0, 0, '', GOLD);
    this.bolt = scene.add.graphics();
    this.boltAt = wide ? { x: at[2].x + ICON_BOX + 3, y: at[2].y + 9 } : null;
    const costY = wide ? at[2].y + 9 : at[2].y;
    this.cost.setY(costY);
    this.icons = {
      attack: scene.add.sprite(at[0].x + ICON_BOX / 2, at[0].y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      special: scene.add.image(at[1].x + ICON_BOX / 2, at[1].y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      ult: scene.add.image(at[2].x + ICON_BOX / 2, at[2].y + ICON_BOX / 2, '__DEFAULT'),
    };
    y += (wide ? ICON_BOX + 10 : 3 * ABIL_ROW) + SECTION;
    const playBtn = new PixelButton(scene, 'Play', w, PLAY_H, BUTTON_GOLD, `sel_play_${w}`, play).place(0, y);
    this.add([
      this.nameText,
      this.role,
      this.rule,
      ...parts,
      ...this.values,
      boxes,
      ...this.names,
      this.cost,
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
    abilities: string[],
    buttons: { attack: { texture: string; frame?: string; anim?: string }; special: { texture: string } },
    ult: { icon: string; name: string; cost: number },
  ): void {
    const w = this.boxW;
    // The name, big when it fits, and the role over a line of the hero's colour that fades out to the right.
    this.nameText.setScale(2).setText(name.toUpperCase());
    let nameY = 0;
    if (this.nameText.width > w) {
      this.nameText.setScale(1).setText(fitLine(this.probe, name, w));
      nameY = 5;
    }
    this.role.setText(fitLine(this.probe, role, w));
    const g = this.rule.clear();
    const ry = NAME_H + ROLE_H;
    for (let x = 0; x < w; x++) {
      const a = 1 - x / w;
      if (a < bayer(x, 0) * 0.9) continue;
      g.fillStyle(accent, 0.35 + a * 0.65).fillRect(x, ry - 1, 1, 1);
    }
    STATS.forEach((s, i) => {
      const t = this.values[i].setText(s.value(stats));
      t.setX(this.valueX[i] - t.width);
    });
    // The name and role come in from the right a little as the hero changes.
    this.scene.tweens.killTweensOf([this.nameText, this.role]);
    this.nameText.setY(nameY);
    for (const t of [this.nameText, this.role]) {
      t.setAlpha(0).setX(6);
      this.scene.tweens.add({ targets: t, alpha: 1, x: 0, duration: 220, ease: 'Cubic.easeOut' });
    }

    this.icons.attack.stop();
    this.icons.attack.setTexture(buttons.attack.texture, buttons.attack.frame);
    if (buttons.attack.anim) this.icons.attack.play(buttons.attack.anim);
    this.icons.special.setTexture(buttons.special.texture);
    if (this.scene.textures.exists(ult.icon)) this.icons.ult.setTexture(ult.icon).setVisible(true);
    else this.icons.ult.setVisible(false);

    // The Special's cost with a bolt.
    this.cost.setText(`${ult.cost}`);
    const boltX = this.boltAt ? this.boltAt.x : w - this.cost.width - 7;
    const by = this.cost.y;
    this.cost.setX(boltX + 6);
    const b = this.bolt.clear();
    const BOLT = ['..##', '.##.', '####', '.##.', '##..'];
    BOLT.forEach((row, yy) => [...row].forEach((c, xx) => c === '#' && b.fillStyle(GOLD_LIT).fillRect(boltX + xx, by + 1 + yy, 1, 1)));

    [abilities[0], abilities[1], ult.name].forEach((n, i) => {
      const room = i === 2 && !this.wide ? boltX - 4 - this.names[i].x : this.nameW[i];
      this.names[i].setText(fitLine(this.probe, n, room));
    });
  }
}

// ---- The page. ----

/** How the page fits a view. */
interface Plan {
  wide: boolean;
  pickerW: number;
  detailsW: number;
  scale: number;
  heroX: number;
  feet: number;
  pickerX: number;
  pickerY: number;
  detailsX: number;
  detailsY: number;
  cards: CardGrid;
}

/** Side by side: the picker on the left, the hero in the middle, the details on the right. Null when it can't fit. */
function widePlan(vw: number, vh: number): Plan | null {
  const pickerW = Math.round(Phaser.Math.Clamp(vw * 0.34, PICKER_W[0], PICKER_W[1]));
  const detailsW = Math.round(Phaser.Math.Clamp(vw * 0.27, DETAILS_W[0], DETAILS_W[1]));
  const middle = vw - MARGIN * 2 - pickerW - detailsW - 16;
  const room = vh - TOP - MARGIN;
  const cards = cardGrid(pickerW, room - PICKER_FIXED);
  const pickerH = PICKER_FIXED + gridH(cards);
  if (middle < 96 || room < Math.max(pickerH, detailsH(false))) return null;
  const scale = HERO_SCALES.find((s) => HERO_TALL * s + 70 <= room && 24 * s <= middle - 8);
  if (!scale) return null;
  const pickerX = MARGIN + 2;
  const detailsX = Math.round(vw - MARGIN - 2 - detailsW);
  const heroX = Math.round((pickerX + pickerW + detailsX) / 2);
  const feet = Math.round(TOP + (room + HERO_TALL * scale) / 2 + 4);
  return {
    wide: true,
    pickerW,
    detailsW,
    scale,
    heroX,
    feet,
    pickerX,
    pickerY: Math.round(TOP + (room - pickerH) / 2),
    detailsX,
    detailsY: Math.round(TOP + (room - detailsH(false)) / 2),
    cards,
  };
}

/** Stacked: the hero on top, the picker under it, the details at the bottom. Null when it can't fit. */
function tallPlan(vw: number, vh: number): Plan | null {
  const w = Math.floor(Math.min(vw - MARGIN * 2, STACK_MAX));
  if (w < PICKER_W[0]) return null;
  const cards = cardGrid(w);
  const pickerH = PICKER_FIXED + gridH(cards);
  const below = pickerH + 12 + detailsH(true);
  const room = vh - TOP - MARGIN - below - 12;
  const scale = HERO_SCALES.find((s) => HERO_TALL * s + 10 <= room && 24 * s <= w);
  if (!scale) return null;
  const x = Math.round((vw - w) / 2);
  // The hero in the middle of the room above the picker; the rest hangs below it.
  const heroRoom = Math.min(room, HERO_TALL * scale + 60);
  const top = Math.round(TOP + Math.max(0, (vh - TOP - MARGIN - heroRoom - 12 - below) / 2));
  const feet = top + Math.round((heroRoom + HERO_TALL * scale) / 2);
  const pickerY = top + heroRoom + 12;
  return { wide: false, pickerW: w, detailsW: w, scale, heroX: Math.round(vw / 2), feet, pickerX: x, pickerY, detailsX: x, detailsY: pickerY + pickerH + 12, cards };
}

/** The select page itself, opened over the home screen. */
export class SelectScene extends Phaser.Scene {
  private cls = 0;
  private leaving = false;
  /** A skin not yet won that the player is looking at (the look worn stays the one they own). */
  private peek: SkinDef | null = null;
  private plan?: Plan;
  private bgBack!: Phaser.GameObjects.Image;
  private bgFront!: Phaser.GameObjects.Image;
  private bgKeys: string[] = [];
  private halo!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Container;
  private sprite!: Phaser.GameObjects.Sprite;
  private glow!: Phaser.GameObjects.Sprite;
  private heroZone!: Phaser.GameObjects.Zone;
  private motes: { img: Phaser.GameObjects.Image; t: number; life: number; x: number; rise: number }[] = [];
  private preview?: Preview;
  private accent = -1;
  private back!: PixelButton;
  private picker!: Picker;
  private details?: Details;

  constructor() {
    super('select');
  }

  private get current(): ClassDef {
    return CLASSES[this.cls];
  }

  create(): void {
    this.leaving = false;
    this.peek = null;
    this.plan = undefined;
    this.details = undefined;
    this.preview = undefined;
    this.accent = -1;
    this.bgKeys = [];
    this.motes = [];
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });
    const saved = CLASSES.findIndex((c) => c.id === lastHero());
    this.cls = Math.min(lastPicked ?? Math.max(0, saved), CLASSES.length - 1);
    ensureUltIcons(this);
    statIconsTexture(this);

    // The splash: the backdrop (the new one fading in over the old), the halo, the hero and its sparks.
    this.bgBack = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    this.bgFront = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.halo = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.halo, alpha: { from: 0.35, to: 0.6 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const shadow = this.add.image(0, 0, 'shadow').setScale(1.4, 1);
    this.sprite = this.add.sprite(0, 0, '__DEFAULT');
    this.glow = this.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.hero = this.add.container(0, 0, [shadow, this.sprite, this.glow]);
    const mote = moteTexture(this);
    for (let i = 0; i < MOTES; i++) {
      const img = this.add.image(0, 0, mote).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.motes.push({ img, t: Math.random(), life: 1, x: 0, rise: 0 });
    }
    // A tap on the hero strikes its pose; a swipe steps to the class's next character (a swipe left brings the next one).
    this.heroZone = this.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    let down: { x: number; y: number } | null = null;
    this.heroZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y }));
    this.heroZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (down = null));
    this.heroZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const z = this.cameras.main.zoom;
      const dx = (p.x - down.x) / z;
      const dy = (p.y - down.y) / z;
      down = null;
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) this.stepType(dx < 0 ? 1 : -1);
      else if (!dragged(this, p)) this.pose();
    });

    this.picker = new Picker(this, { pickClass: (i) => this.pickClass(i), pickType: (i) => this.pickType(i), pickSkin: (i) => this.pickSkin(i) });
    this.add.existing(this.picker);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      // The backdrops are screen-sized: let them go.
      for (const k of this.bgKeys) if (this.textures.exists(k)) this.textures.remove(k);
      this.bgKeys = [];
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    if (this.glow.visible) this.glow.setFrame(this.sprite.frame.name);
    const plan = this.plan;
    if (!plan) return;
    for (const m of this.motes) {
      m.t += dt / m.life;
      if (m.t >= 1) this.spawnMote(m, false);
      // Fade in, drift up with a slight sway, fade out near the top.
      m.img.setAlpha(Math.sin(Math.PI * Math.min(1, m.t)) * 0.85);
      m.img.setPosition(Math.round(m.x + Math.sin(m.t * 6 + m.rise) * 2), Math.round(plan.feet - 2 - m.t * m.rise));
    }
  }

  private spawnMote(m: SelectScene['motes'][number], scatter: boolean): void {
    const plan = this.plan;
    if (!plan) return;
    const reach = 14 * plan.scale;
    m.t = scatter ? Math.random() : 0;
    m.life = Phaser.Math.FloatBetween(1.8, 3.6);
    m.x = plan.heroX + Phaser.Math.Between(-reach, reach);
    m.rise = Phaser.Math.Between(20, HERO_TALL * plan.scale + 10);
  }

  /**
   * Show the current class, its characters, and the picked one in its skin.
   * `pose` plays the picked character's pose; `jump` is a new class; `slide` the side a new character comes in from.
   */
  private refresh(pose: boolean, jump: boolean, slide: -1 | 0 | 1 = 0): void {
    if (!this.plan || !this.details) return;
    const cls = this.current;
    const own = lookOf(cls);
    const look = this.peek ? { type: own.type, skin: this.peek } : own;
    const def = worn(cls, look);
    const picked = cls.types.indexOf(look.type);
    // Every character of the class, each in the look it was last worn in (the picked one as it is now).
    const types: ChipLook[] = cls.types.map((type, i) => {
      const d = i === picked ? def : worn(cls, lastLookOf(cls, type));
      return { preview: d.preview, accent: d.accent };
    });
    const skins = look.type.skins ?? [];
    const looks: ChipLook[] = [null, ...skins].map((s) => {
      const d = worn(cls, { type: look.type, skin: s });
      return { preview: d.preview, accent: d.accent, rarity: s ? RARITY_INFO[rarityOf(s)].tint : null, locked: !ownsSkin(s) };
    });
    this.picker.show({
      classIndex: this.cls,
      className: cls.name,
      classes: CLASSES.map((c) => {
        const d = worn(c);
        return { preview: d.preview, accent: d.accent };
      }),
      types,
      typeName: look.type.name,
      picked,
      skin: {
        name: look.skin?.name ?? look.type.lookName ?? 'Classic',
        index: look.skin ? skins.indexOf(look.skin) + 1 : 0,
        locked: !!this.peek,
        looks,
        rarity: look.skin ? RARITY_INFO[rarityOf(look.skin)].tint : null,
      },
      jump,
    });
    this.showHero(def.preview, def.accent, !!this.peek, pose, jump ? 0 : slide);
    // Stats and ability names are the character's own: a skin only changes the look.
    const ult = ultFor(def);
    this.details.show(look.type.name, def.role, def.accent, heroStats(def.id, look.type.id), [def.attack, def.special], def.buttons, {
      icon: ult.icon,
      name: ult.name,
      cost: ult.def.cost,
    });
  }

  /** The hero in the light: a new look comes in from the side it was swiped from, or up from the floor. */
  private showHero(preview: Preview, accent: number, locked: boolean, pose: boolean, slide: -1 | 0 | 1): void {
    const plan = this.plan!;
    if (accent !== this.accent) this.paintBackdrop(accent);
    if (preview !== this.preview) {
      this.preview = preview;
      const oy = preview.originY ?? 31 / 32;
      // Drop a pose's queued return to the old look's idle first: stopping plays the queue, and one frame
      // of a smaller hero would clamp this look's crop for good (a samurai after the wizard was cut in half).
      this.sprite.chain();
      this.sprite.stop();
      this.sprite.setTexture(preview.texture).setOrigin(0.5, oy);
      cropToWindow(this.sprite, preview, 44, 46, 3, 1);
      this.glow.setVisible(!!preview.glow);
      if (preview.glow) {
        this.glow.setTexture(preview.glow).setOrigin(0.5, oy);
        cropToWindow(this.glow, preview, 44, 46, 3, 1);
      }
      this.sprite.play(preview.idle);
      this.tweens.killTweensOf(this.hero);
      const fromX = slide * 22;
      this.hero.setAlpha(0).setPosition(plan.heroX + fromX, plan.feet + (fromX ? 0 : 6));
      this.tweens.add({ targets: this.hero, alpha: 1, x: plan.heroX, y: plan.feet, duration: SLIDE_MS, ease: 'Cubic.easeOut' });
    }
    if (locked) this.sprite.setTint(0x4a4468);
    else this.sprite.clearTint();
    this.glow.setAlpha(locked ? 0.25 : 1);
    if (pose && !locked) this.pose();
  }

  /** Paint the backdrop for the hero's colour and fade it in over the last one. */
  private paintBackdrop(accent: number): void {
    const plan = this.plan!;
    const cam = this.cameras.main;
    const w = Math.ceil(this.scale.width / cam.zoom);
    const h = Math.ceil(this.scale.height / cam.zoom);
    const key = backdropTexture(this, w, h, plan.heroX, plan.feet, plan.scale, accent);
    const first = this.accent < 0 || this.bgFront.texture.key === '__DEFAULT';
    this.accent = accent;
    this.tweens.killTweensOf(this.bgFront);
    if (!first) this.bgBack.setTexture(this.bgFront.texture.key).setVisible(true);
    else this.bgBack.setVisible(false);
    this.bgFront.setTexture(key).setAlpha(first ? 1 : 0);
    if (!first) this.tweens.add({ targets: this.bgFront, alpha: 1, duration: 280, ease: 'Sine.easeOut', onComplete: () => this.bgBack.setVisible(false) });
    this.halo.setTint(accent);
    const lit = mixN(accent, 0xffffff, 0.45);
    for (const m of this.motes) m.img.setTint(lit);
    // Keep the last few painted; let older ones go (never the two on show).
    this.bgKeys = [key, ...this.bgKeys.filter((k) => k !== key)];
    for (const k of this.bgKeys.splice(BACKDROPS_KEPT)) if (this.textures.exists(k) && k !== this.bgBack.texture.key) this.textures.remove(k);
  }

  private pose(): void {
    if (this.preview && !this.peek) this.sprite.play(this.preview.chosen).chain(this.preview.idle);
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
    if (!ownsSkin(next)) this.peek = next;
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
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** On to the arena select, with this hero. */
  private startGame(): void {
    if (this.leaving) return;
    if (this.peek) {
      // Not theirs yet: the lock rattles, and the skin step says where to get it.
      this.picker.rattle();
      this.picker.say('Win it in the Shop');
      return;
    }
    this.leaving = true;
    const character = this.current.id;
    lastPicked = this.cls;
    rememberHero(character);
    this.scene.launch('arena', { character });
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  private layout(): void {
    const { width, height } = this.scale;
    // The layout that suits the view's shape; zoom out a whole step at a time (keeping the pixels crisp) until it fits.
    const planFor = (z: number): Plan | null => {
      const vw = width / z;
      const vh = height / z;
      return vw >= vh ? (widePlan(vw, vh) ?? tallPlan(vw, vh)) : (tallPlan(vw, vh) ?? widePlan(vw, vh));
    };
    let z = menuZoom(width, height);
    let plan = planFor(z);
    while (!plan && z > 1) plan = planFor(--z);
    this.cameras.main.setZoom(z);
    const vw = width / z;
    plan ??= tallPlan(Math.max(vw, PICKER_W[0] + 12), 2000)!;
    this.plan = plan;
    this.back.place(MARGIN, MARGIN);

    this.hero.setScale(plan.scale);
    this.halo.setPosition(plan.heroX, plan.feet - 16 * plan.scale).setScale(plan.scale * 1.5);
    const zoneX = plan.wide ? plan.pickerX + plan.pickerW + 4 : 0;
    const zoneW = plan.wide ? plan.detailsX - 4 - zoneX : vw;
    const zoneTop = plan.feet - HERO_TALL * plan.scale - 8;
    this.heroZone.setPosition(zoneX, zoneTop).setSize(zoneW, plan.feet + 8 - zoneTop);
    for (const m of this.motes) this.spawnMote(m, true);

    this.picker.setPosition(plan.pickerX, plan.pickerY);
    this.picker.resize(plan.pickerW, plan.cards);
    if (!this.details || this.details.boxW !== plan.detailsW || this.details.wide !== !plan.wide) {
      this.details?.destroy();
      this.details = new Details(this, plan.detailsW, !plan.wide, () => this.startGame());
      this.add.existing(this.details);
    }
    this.details.setPosition(plan.detailsX, plan.detailsY);

    // A new size paints a new backdrop and stands the hero afresh.
    this.accent = -1;
    this.preview = undefined;
    this.refresh(true, true);
  }
}
