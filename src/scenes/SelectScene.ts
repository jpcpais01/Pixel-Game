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
import { statIconsTexture } from '../ui/statIcons';
import { fpsBottom } from './FpsScene';

// The hero select. The class's name heads the page between two arrows. Under
// it, an arched hall: the picked character stands big on a lit dais at the
// front, and the class's other characters wait on plinths behind it, in
// shadow, each with its name on a plate. Tapping one brings it forward (the
// line-up turns like a carousel). A ribbon under the dais steps through the
// picked character's skins. Beside the hall, a card shows the picked
// character's stats, attack, ability and Special, with the Play button; and
// the roster of every class runs along the bottom. It is all built from
// CLASSES, so new classes, characters and skins show up by themselves.

/** The hall and the card beside it share one height. */
const MAIN_H = 150;
const STAGE_MIN = 224;
const STAGE_MAX = 292;
const INFO_W = 152;
const GAP = 6;
const MARGIN = 6;
/** The hall's arched top: the radius of its two rounded corners. */
const ARCH_R = 30;
/** Where the wall meets the floor. */
const FLOOR_Y = 74;
/** The rose window behind the front character's head. */
const ROSE_Y = 34;
const ROSE_R = 23;
/** The front character: its feet, and how big it is drawn. */
const FRONT_FEET = 108;
const FRONT_SCALE = 3;
/** The characters behind: their feet, how far out from the middle, and how big. */
const BACK_FEET = 86;
const BACK_X = 66;
const BACK_X_MAX = 84;
/** Each further one on a side stands this much further out and further back. */
const BACK_STEP_X = 30;
const BACK_STEP_Y = 5;
const BACK_SCALE = 2;
/** The most characters one class shows. */
const MAX_FIGURES = 4;
/** Name plates: on the dais's face for the front one, under the plinth for the others. */
const FRONT_PLATE_Y = 118;
const BACK_PLATE_DY = 12;
const PLATE_H = 10;
/** The skin ribbon under the dais. */
const RIBBON_Y = 128;
const RIBBON_H = 18;
const RIBBON_W = 124;
/** Sparks drifting up through the light. */
const MOTES = 8;
/** How long the line-up takes to turn to a new character. */
const TURN_MS = 320;

/** The card beside the hall, rows from its top. */
const PAD = 8;
const NAME_Y = 6;
const ROLE_Y = 22;
const RULE1_Y = 32;
const STATS_Y = 37;
const STAT_ROW = 9;
const STAT_COL_W = 64;
const RULE2_Y = STATS_Y + STAT_ROW * 3 + 1;
const ABIL_Y = RULE2_Y + 5;
const ABIL_ROW = 19;
const ICON_BOX = 18;
const SPECIAL_Y = ABIL_Y + ABIL_ROW * 2 + 1;
const SPECIAL_H = 20;
const PLAY_Y = SPECIAL_Y + SPECIAL_H + 2;
const PLAY_H = 16;

/** Top-bar buttons. */
const BACK_W = 40;
const BACK_H = 14;
/** Roster tiles, largest first: the largest that fits the view in one row is used. */
const TILE_SIZES = [28, 24, 21, 19];
const TILE_GAP = 2;
const tileH = (w: number): number => Math.round(w * 1.3) + 2;

/** How far a press on the hall must travel sideways to count as a swipe to the class's next character. */
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
const GOLD_DARK = 0xb8742c;
const DIMMED = 0x8a84a8;
/** Characters not picked stand in shadow. */
const SHADOWED = 0x5c5484;
const LOCKED = 0x4a4468;
const OUTLINE = 0x0b0818;

/** Stats, in two columns of three: an icon, a short name, and how its value reads (ATK/S: attacks a second; REGEN: HP a second). */
const STATS: { icon: number; name: string; value: (s: HeroStats) => string }[] = [
  { icon: 0, name: 'HP', value: (s) => `${s.hp}` },
  { icon: 1, name: 'DMG', value: (s) => `${s.damage}` },
  { icon: 2, name: 'MOVE', value: (s) => `${s.speed}` },
  { icon: 3, name: 'DEF', value: (s) => `${s.defense}` },
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

/** The shade a hero's colour gives the halls behind it: the stage, and its card in the roster. */
function hallShade(accent: number): number {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(accent), Phaser.Display.Color.ValueToColor(0xb8a8e8), 100, 15);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

const grey = (v: number): RGB => [v, v, v];
/** A cheap, steady per-cell random in 0..1, for stone that isn't all one shade. */
const hash = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---- Art, painted once per size and cached. ----

/**
 * How deep a pixel sits inside an arch-topped box `w` x `h` whose top corners
 * are rounded with radius `r`: 0 on its edge row, negative outside it.
 */
function archDepth(x: number, y: number, w: number, h: number, r: number): number {
  let d = Math.min(x, w - 1 - x, h - 1 - y, y);
  const cx = x < r ? r : x > w - 1 - r ? w - 1 - r : -1;
  if (cx >= 0 && y < r) d = Math.min(d, Math.floor(r - Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - r)));
  return d;
}

/**
 * The hall behind the characters, painted in greys so tinting it gives it the
 * shade of the hero on show: a stone wall with a rose window glowing behind
 * the front character's head, a pillar either side, and a checkered marble
 * floor running back to the wall in perspective, brightest where the light falls.
 */
function hallTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sel_hall_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const cx = w / 2;
  const black = grey(6);
  const mortar = grey(16);
  const vpY = FLOOR_Y - 46;
  const pillars = [11, w - 12];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (archDepth(x, y, w, h, ARCH_R) < 0) continue;
      let c: RGB;
      if (y < FLOOR_Y) {
        // Stone courses, each block its own shade, darker towards the vault.
        const f = y / FLOOR_Y;
        const row = Math.floor(y / 9);
        const shift = Math.floor(hash(row, 7) * 18);
        const col = Math.floor((x + shift) / 18);
        const base = 22 + 40 * Math.floor(f * 5 + bayer(x, y)) / 5 + (hash(col, row) - 0.5) * 10;
        c = grey(base);
        if (y % 9 === 0 || (x + shift) % 18 === 0) c = mix(c, mortar, 0.75);
        else if (y % 9 === 1) c = grey(base + 8);
        // Soft shafts of light falling from the rose window.
        const shaft = Math.abs(x - cx) / (ROSE_R + (y - ROSE_Y) * 0.55);
        if (y > ROSE_Y && shaft < 1 && (1 - shaft) * 0.5 > bayer(x, y)) c = mix(c, grey(120), 0.25);
        // The rose window: a stone ring round bright glass cut by tracery.
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - ROSE_Y;
        const r = Math.hypot(dx, dy);
        if (r <= ROSE_R + 2) {
          if (r > ROSE_R) c = grey(dy < 0 ? 120 : 80);
          else if (r > ROSE_R - 1.5) c = grey(40);
          else {
            const glass = 250 - 110 * Math.pow(r / ROSE_R, 1.4);
            c = grey(Math.round(glass / 22) * 22 + (bayer(x, y) > 0.5 ? 6 : 0));
            const a = Math.atan2(dy, dx);
            const spoke = Math.abs(Math.sin(a * 4)) * r;
            if (r > 8 && spoke < 1.1) c = grey(34);
            if (Math.abs(r - 8) < 0.9 || Math.abs(r - 16) < 0.8) c = grey(40);
            // Petals: small round lights between the spokes of the outer ring.
            if (r > 16.5 && Math.abs(Math.sin(a * 4)) > 0.75) c = grey(Math.min(255, glass + 20));
          }
        }
        // Pillars framing the hall, rounded by their shading, with a capital and a base.
        for (const px of pillars) {
          const u = x - px;
          const cap = y >= FLOOR_Y - 5 || (y >= 18 && y < 22);
          const half = cap ? 7 : 5;
          if (Math.abs(u) > half) continue;
          const lit = x < cx ? -u : u;
          const t = clamp01((lit + half) / (half * 2));
          c = grey(Math.round(38 + 70 * Math.floor(t * 4 + bayer(x, y)) / 4));
          if (Math.abs(u) === half) c = grey(18);
          if (y === 18 || y === FLOOR_Y - 5) c = grey(130);
          if (!cap && y % 14 === 7) c = mix(c, black, 0.3);
        }
        if (y === FLOOR_Y - 1) c = grey(18);
      } else {
        // Marble floor: checkered tiles in perspective, lit in a pool at the front middle.
        const dy = y + 0.5 - vpY;
        const u = ((x + 0.5 - cx) / dy) * 3.2;
        const v = 180 / dy;
        const u2 = ((x + 1.5 - cx) / dy) * 3.2;
        const v2 = 180 / (dy + 1);
        const check = (Math.floor(u) + Math.floor(v)) & 1;
        const light = clamp01(1 - Math.hypot((x - cx) / (w * 0.42), (y - FRONT_FEET) / 40));
        const f = 44 + light * 70 + (check ? 14 : 0);
        c = grey(Math.round(f / 12) * 12 + (bayer(x, y) > 0.6 ? 4 : 0));
        if (Math.floor(u) !== Math.floor(u2) || Math.floor(v) !== Math.floor(v2)) c = mix(c, mortar, 0.55);
        if (y === FLOOR_Y) c = grey(90);
      }
      // Darker towards the sides, the vault and the bottom corners, so the eye goes to the middle.
      const side = Math.abs(x - cx) / cx;
      const v = clamp01(side * side * 0.8 + (y < 14 ? (14 - y) / 26 : 0));
      if (v > bayer(x, y) * 0.9) c = mix(c, black, Math.min(0.6, v));
      b.set(x, y, c);
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** The hall's frame, never tinted: a dark edge, a lit stone rim, a gold hairline inside, a keystone gem, and a sill along the bottom. */
function frameTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sel_frame_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const outer = hex('#0b0818');
  const rimLit = hex('#8a7ad0');
  const rim = hex('#54468f');
  const rimDark = hex('#2b2258');
  const gold = hex('#b8742c');
  const goldLit = hex('#ffe08a');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = archDepth(x, y, w, h, ARCH_R);
      if (d < 0 || d > 3) continue;
      const lit = y < h / 2 && (x < w / 2 || y < ARCH_R / 2);
      if (d === 0) b.set(x, y, outer);
      else if (d === 1) b.set(x, y, lit ? rimLit : rim);
      else if (d === 2) b.set(x, y, rimDark);
      else b.set(x, y, lit ? goldLit : gold, 170);
    }
  }
  // A sill of stone along the bottom, where the ribbon sits.
  for (let y = h - 4; y < h - 1; y++) for (let x = 2; x < w - 2; x++) b.set(x, y, y === h - 4 ? rim : rimDark);
  // The keystone: a gold-set gem at the top of the arch.
  const kx = Math.floor(w / 2);
  const KEY = ['...#...', '..#+#..', '.#+o+#.', '#+ooo+#', '.#+o+#.', '..#+#..', '...#...'];
  KEY.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      b.set(kx - 3 + x, y, ch === '#' ? outer : ch === '+' ? gold : y < 3 ? goldLit : hex('#f4cf6a'));
    }),
  );
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

const STONE_TOP_LIT = hex('#9a8cd0');
const STONE_TOP_DARK = hex('#54468f');
const STONE_RIM = hex('#cfc2f0');
const STONE_DRUM_LIT = hex('#3e3278');
const STONE_DRUM_DARK = hex('#191335');
const STONE_EDGE = hex('#0b0818');

/** A round stone disc seen from above and in front: a lit top face with a pale rim, and a shaded drum `depth` tall. */
function paintDisc(b: Bitmap, cx: number, cy: number, rx: number, ry: number, depth: number): void {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx;
    if (Math.abs(dx) > 1) continue;
    const e = ry * Math.sqrt(1 - dx * dx);
    const top = Math.round(cy - e);
    const bottom = Math.round(cy + e);
    // The drum: lit on the left, falling off to the right, darker at its foot.
    for (let y = bottom; y <= bottom + depth; y++) {
      const t = clamp01((dx + 1) / 2);
      let c = mix(STONE_DRUM_LIT, STONE_DRUM_DARK, Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3));
      if (y === bottom + depth) c = STONE_EDGE;
      else if (y >= bottom + depth - 2) c = mix(c, STONE_EDGE, 0.5);
      b.set(x, y, c);
    }
    // The top face, brighter towards the back left, with a pale rim round the edge.
    for (let y = top; y <= bottom; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const t = clamp01((dx * 0.6 + dy * 0.8 + 1) / 2);
      let c = mix(STONE_TOP_LIT, STONE_TOP_DARK, Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3));
      if (y === top || y === bottom || Math.abs(dx) > 0.96) c = y === bottom ? mix(STONE_TOP_DARK, STONE_EDGE, 0.4) : STONE_RIM;
      b.set(x, y, c);
    }
  }
}

const DAIS_W = 116;
const DAIS_H = 32;
/** The dais's upper disc, centred this far down its texture. */
const DAIS_CY = 9;
const DAIS_RX = 44;
const DAIS_RY = 8;

/** The front character's dais: a broad lower step and a raised disc on it, with a gold inlay ring. */
function daisTexture(scene: Phaser.Scene): string {
  const key = 'sel_dais';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(DAIS_W, DAIS_H);
  const cx = DAIS_W / 2;
  paintDisc(b, cx, DAIS_CY + 5, 54, 10, 5);
  paintDisc(b, cx, DAIS_CY, DAIS_RX, DAIS_RY, 5);
  // A gold ring set into the top face.
  const gold = hex('#b8742c');
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    b.set(cx + Math.cos(a) * (DAIS_RX - 5), DAIS_CY + Math.sin(a) * (DAIS_RY - 1.5), gold);
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

const PLINTH_W = 50;
const PLINTH_H = 16;
const PLINTH_CY = 5;

/** A plinth for a character waiting behind: a smaller disc of the same stone. */
function plinthTexture(scene: Phaser.Scene): string {
  const key = 'sel_plinth';
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(PLINTH_W, PLINTH_H);
  paintDisc(b, PLINTH_W / 2, PLINTH_CY, 22, 4.5, 6);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A dashed ring of runes on the dais's top face, white (tinted with the hero's colour). */
function runesTexture(scene: Phaser.Scene): string {
  const key = 'sel_runes_dais';
  if (scene.textures.exists(key)) return key;
  const rx = DAIS_RX - 10;
  const ry = DAIS_RY - 3;
  const w = rx * 2 + 2;
  const h = Math.ceil(ry * 2) + 2;
  const b = new Bitmap(w, h);
  const steps = 300;
  for (let i = 0; i < steps; i++) {
    // Twelve marks round the ring, each a dash with a gap after it.
    if (i % 25 >= 17) continue;
    const a = (i / steps) * Math.PI * 2;
    b.set(w / 2 + Math.cos(a) * rx, h / 2 + Math.sin(a) * ry, [255, 255, 255]);
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A soft column of light falling onto the dais, white (tinted with the hero's colour), `h` tall. */
function beamTexture(scene: Phaser.Scene, h: number): string {
  const key = `sel_beam_${h}`;
  if (scene.textures.exists(key)) return key;
  const w = 80;
  const b = new Bitmap(w, h);
  const white: RGB = [255, 255, 255];
  for (let y = 0; y < h; y++) {
    const f = y / (h - 1);
    const half = 10 + 28 * f;
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x + 0.5 - w / 2) / half;
      if (dx >= 1) continue;
      const a = 0.55 * Math.pow(f, 0.8) * Math.pow(1 - dx, 1.5);
      // Stepped with a dither so the light reads as pixel art, not a smooth gradient.
      const q = Math.floor(a * 6 + bayer(x, y)) / 6;
      if (q > 0) b.set(x, y, white, Math.round(q * 255));
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
  const white: RGB = [255, 255, 255];
  b.set(1, 1, white);
  for (const [x, y] of [[0, 1], [2, 1], [1, 0], [1, 2]]) b.set(x, y, white, 110);
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** A roster tile's alcove, in greys so it can take its hero's shade: round-topped, darker at the top. */
function tileTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sel_tile_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const r = Math.floor(w / 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = archDepth(x, y, w, h, r);
      if (d < 0) continue;
      const f = y / h;
      let c = grey(Math.round(26 + 60 * Math.floor(f * 4 + bayer(x, y)) / 4));
      if (d === 0) c = grey(10);
      else if (d === 1) c = grey(y < h / 2 ? 120 : 70);
      b.set(x, y, c);
    }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/** The gold rim laid over the picked roster tile, clear inside. */
function tileRimTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sel_tile_rim_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const r = Math.floor(w / 2);
  const lit = hex('#ffe08a');
  const dark = hex('#b8742c');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = archDepth(x, y, w, h, r);
      if (d === 1 || d === 2) b.set(x, y, d === 1 ? (y < h / 2 ? lit : dark) : dark, d === 1 ? 255 : 120);
    }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
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

// ---- Pieces of the page. ----

/** A class in the roster: a small alcove with its hero at 1x, and a pip per character in the class. */
class Tile extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private rim: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private sprite: Phaser.GameObjects.Sprite;
  private pips: Phaser.GameObjects.Graphics;
  private preview?: Preview;
  private shade = 0xffffff;
  private chars = 1;
  private picked = false;
  private hover = false;
  private size = 0;
  private tileH = 0;
  baseY = 0;

  constructor(scene: Phaser.Scene, tap: () => void) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    onTap(scene, this.bg, tap);
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (p: Phaser.Input.Pointer) => !p.wasTouch && this.setHover(true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setHover(false));
    this.rim = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.glow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD);
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.pips = scene.add.graphics();
    this.add([this.bg, this.glow, this.shadow, this.sprite, this.rim, this.pips]);
  }

  /** Size the tile `w` wide (and its height to match). */
  resize(w: number): void {
    if (w === this.size) return;
    this.size = w;
    this.tileH = tileH(w);
    this.bg.setTexture(tileTexture(this.scene, w, this.tileH));
    this.bg.input?.hitArea.setSize(w, this.tileH);
    this.rim.setTexture(tileRimTexture(this.scene, w, this.tileH));
    const fx = w / 2;
    const fy = this.tileH - 3;
    this.glow.setPosition(fx, fy - 1).setScale(w / 36, 0.3);
    this.shadow.setPosition(fx, fy);
    this.sprite.setPosition(fx, fy);
    if (this.preview) this.crop(this.preview);
    this.tintBg();
  }

  show(preview: Preview, accent: number, count: number): this {
    if (this.preview !== preview) {
      this.preview = preview;
      this.sprite.setTexture(preview.texture).setOrigin(0.5, preview.originY ?? 31 / 32);
      this.crop(preview);
      this.sprite.play(preview.idle);
    }
    this.glow.setTint(accent);
    this.shade = hallShade(accent);
    this.chars = count;
    this.tintBg();
    return this;
  }

  private crop(preview: Preview): void {
    cropToWindow(this.sprite, preview, this.size - 4, this.tileH - 5, 2, 1);
  }

  setPicked(on: boolean): this {
    this.picked = on;
    this.rim.setVisible(on);
    this.glow.setAlpha(on ? 0.85 : 0);
    this.tintBg();
    return this;
  }

  private setHover(on: boolean): void {
    this.hover = on;
    this.tintBg();
  }

  /** The alcove in its hero's shade, dimmer when not picked, and the tile raised a little when picked. */
  private tintBg(): void {
    const c = Phaser.Display.Color.IntegerToColor(this.shade);
    const k = this.picked ? 1 : this.hover ? 0.85 : 0.62;
    this.bg.setTint(Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k)));
    if (this.picked) this.sprite.clearTint();
    else this.sprite.setTint(this.hover ? 0xc8c0e0 : DIMMED);
    this.y = this.baseY - (this.picked ? 2 : 0);
    // A pip per character at the top of the alcove; only classes with a choice of characters get them.
    const g = this.pips.clear();
    if (this.chars < 2) return;
    const step = 3;
    const x0 = Math.round(this.size / 2 - (this.chars * step - 1) / 2);
    for (let i = 0; i < this.chars; i++) {
      g.fillStyle(OUTLINE).fillRect(x0 + i * step - 1, 2, 4, 4);
      g.fillStyle(this.picked ? GOLD : SOFT).fillRect(x0 + i * step, 3, 2, 2);
    }
  }
}

/** Which skin is worn, out of how many, for the ribbon under the dais. */
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

/** One character of the class in the hall: how it looks now, its colour and its name. */
interface Slot {
  preview: Preview;
  accent: number;
  name: string;
}

/** Where a character stands in the hall: its feet, its size, and where its name plate sits. */
interface Place {
  x: number;
  feet: number;
  scale: number;
  plateY: number;
  front: boolean;
}

/** A character in the hall: the hero (its shadow, sprite and glow, drawn at its place's size) and its name plate. */
class Figure extends Phaser.GameObjects.Container {
  private hero: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private plate: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.BitmapText;
  private preview?: Preview;
  private locked = false;
  private plateW = 0;
  private lit: [boolean, boolean, boolean] = [false, false, false];
  place: Place = { x: 0, feet: 0, scale: 1, plateY: 0, front: false };
  private turn?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const shadow = scene.add.image(0, 0, 'shadow').setScale(1.2, 1);
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.glow = scene.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.hero = scene.add.container(0, 0, [shadow, this.sprite, this.glow]);
    this.plate = scene.add.graphics();
    this.label = pixelText(scene, 0, 0, '');
    this.add([this.hero, this.plate, this.label]);
  }

  /** Wear a look; a new one rises in. */
  setLook(slot: Slot, probe: Phaser.GameObjects.BitmapText): void {
    const { preview } = slot;
    if (this.preview !== preview) {
      this.preview = preview;
      const oy = preview.originY ?? 31 / 32;
      // Drop a pose's queued return to the old look's idle first: stopping plays the queue, and one frame
      // of a smaller hero would clamp this look's crop for good (a samurai after the wizard was cut in half).
      this.sprite.chain();
      this.sprite.stop();
      this.sprite.setTexture(preview.texture).setOrigin(0.5, oy);
      cropToWindow(this.sprite, preview, 36, 42, 3, 1);
      this.glow.setVisible(!!preview.glow);
      if (preview.glow) {
        this.glow.setTexture(preview.glow).setOrigin(0.5, oy);
        cropToWindow(this.glow, preview, 36, 42, 3, 1);
      }
      this.sprite.play(preview.idle);
      this.scene.tweens.killTweensOf(this.hero);
      this.hero.setAlpha(0).setY(4);
      this.scene.tweens.add({ targets: this.hero, alpha: 1, y: 0, duration: 180, ease: 'Quad.easeOut' });
    }
    this.label.setText(fitLine(probe, slot.name, 84));
    this.plateW = this.label.width + 8;
    this.drawPlate();
  }

  /** Stand at `to`, walking there over a moment (with a little hop) unless `now`. */
  walkTo(to: Place, now: boolean): void {
    this.turn?.stop();
    const from = { ...this.place };
    this.place = to;
    if (now) {
      this.apply(to, to, 1);
      return;
    }
    this.turn = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TURN_MS,
      ease: 'Cubic.easeInOut',
      onUpdate: (tw) => this.apply(from, to, tw.getValue() ?? 1),
      onComplete: () => this.apply(to, to, 1),
    });
  }

  private apply(a: Place, b: Place, t: number): void {
    const lerp = (p: number, q: number) => p + (q - p) * t;
    const feet = lerp(a.feet, b.feet) - Math.sin(Math.PI * t) * (a.x === b.x ? 0 : 5);
    this.setPosition(Math.round(lerp(a.x, b.x)), Math.round(feet));
    // Whole sizes at rest keep the pixels crisp; in between, the size glides.
    this.hero.setScale(t >= 1 ? b.scale : lerp(a.scale, b.scale));
    const py = Math.round(lerp(a.plateY, b.plateY) - feet);
    this.plate.setY(py);
    this.label.setY(py + 2);
  }

  /** In the light (picked), in shadow, or brightened a little under the pointer; a locked skin stands dark. */
  light(picked: boolean, hover: boolean, locked: boolean): void {
    this.locked = locked;
    this.lit = [picked, hover, locked];
    if (locked) this.sprite.setTint(LOCKED);
    else if (picked) this.sprite.clearTint();
    else this.sprite.setTint(hover ? DIMMED : SHADOWED);
    this.glow.setAlpha(locked ? 0.25 : picked ? 1 : hover ? 0.5 : 0.25);
    this.drawPlate();
  }

  /** The name plate: gold-rimmed with bright letters for the picked character, dark for the others. */
  private drawPlate(): void {
    const [picked, hover] = this.lit;
    const g = this.plate.clear();
    const w = this.plateW;
    const x = -Math.floor(w / 2);
    g.fillStyle(OUTLINE).fillRect(x, 0, w, PLATE_H);
    g.fillStyle(picked ? GOLD_DARK : 0x33285a).fillRect(x + 1, 1, w - 2, PLATE_H - 2);
    g.fillStyle(picked ? 0x2b2258 : 0x17122f).fillRect(x + 2, 2, w - 4, PLATE_H - 4);
    if (picked) g.fillStyle(0xffe08a).fillRect(x + 1, 1, w - 2, 1);
    this.label.setX(x + 4).setTint(picked ? INK : hover ? LAVENDER : SOFT);
  }

  /** Whether (x, y), in the hall's coordinates, is on this character. */
  hits(x: number, y: number): boolean {
    const s = this.place.scale;
    return Math.abs(x - this.place.x) <= 12 * s && y <= this.place.feet + 8 && y >= this.place.feet - 31 * s;
  }

  pose(): void {
    if (this.preview && !this.locked) this.sprite.play(this.preview.chosen).chain(this.preview.idle);
  }

  update(): void {
    if (this.glow.visible) this.glow.setFrame(this.sprite.frame.name);
  }
}

/**
 * The hall: an arched room with a rose window, where the picked character
 * stands on a dais under a beam of light with sparks drifting up through it,
 * and the class's other characters wait on plinths behind. Under the dais, a
 * ribbon steps through the picked character's skins.
 */
class Stage extends Phaser.GameObjects.Container {
  readonly boxW: number;
  /** The hall behind the characters, tinted with the picked one's shade. */
  readonly bg: Phaser.GameObjects.Image;
  private rose: Phaser.GameObjects.Image;
  private beam: Phaser.GameObjects.Image;
  private pool: Phaser.GameObjects.Image;
  private runes: Phaser.GameObjects.Image;
  private plinths: Phaser.GameObjects.Image[] = [];
  private crowd: Phaser.GameObjects.Container;
  private figures: Figure[] = [];
  private ribbon: Phaser.GameObjects.Graphics;
  private skinLabel: Phaser.GameObjects.BitmapText;
  private skinName: Phaser.GameObjects.BitmapText;
  private lock: Phaser.GameObjects.Image;
  private stepZones: Phaser.GameObjects.Zone[];
  private motes: { img: Phaser.GameObjects.Image; t: number; life: number; x: number; rise: number }[] = [];
  private probe: Phaser.GameObjects.BitmapText;
  private cx: number;
  /** How far out the nearest characters behind stand: further on a wider hall, clear of the dais. */
  private backX: number;
  /** What the hall shows now, kept to redraw on hover and notes. */
  private slots: Slot[] = [];
  private picked = 0;
  private hover = -1;
  private skin?: SkinPick;
  private accent = 0xffffff;
  /** A note shown in place of the skin's name for a moment. */
  private note: string | null = null;
  private noteTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, w: number, tapFigure: (i: number) => void, swipe: (dir: -1 | 1) => void, stepSkin: (dir: -1 | 1) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    const cx = (this.cx = Math.round(w / 2));
    this.backX = Phaser.Math.Clamp(cx - 40, BACK_X, BACK_X_MAX);
    this.bg = scene.add.image(0, 0, hallTexture(scene, w, MAIN_H)).setOrigin(0);
    this.rose = scene.add.image(cx, ROSE_Y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2);
    scene.tweens.add({ targets: this.rose, alpha: { from: 0.35, to: 0.6 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const plinth = plinthTexture(scene);
    for (let i = 0; i < MAX_FIGURES - 1; i++) this.plinths.push(scene.add.image(0, 0, plinth).setOrigin(0.5, PLINTH_CY / PLINTH_H).setVisible(false));
    const dais = scene.add.image(cx, FRONT_FEET + 1, daisTexture(scene)).setOrigin(0.5, DAIS_CY / DAIS_H);
    this.runes = scene.add.image(cx, FRONT_FEET + 1, runesTexture(scene)).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.runes, alpha: { from: 0.3, to: 0.95 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.pool = scene.add.image(cx, FRONT_FEET + 1, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.8, 0.7);
    this.beam = scene.add.image(cx, 4, beamTexture(scene, FRONT_FEET)).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.crowd = scene.add.container(0, 0);
    for (let i = 0; i < MAX_FIGURES; i++) {
      const f = new Figure(scene);
      this.figures.push(f);
      this.crowd.add(f);
    }
    const mote = moteTexture(scene);
    for (let i = 0; i < MOTES; i++) {
      const img = scene.add.image(0, 0, mote).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.motes.push({ img, t: Math.random(), life: 1, x: 0, rise: 0 });
    }
    const frame = scene.add.image(0, 0, frameTexture(scene, w, MAIN_H)).setOrigin(0);
    this.probe = pixelText(scene, 0, 0, '').setVisible(false);
    this.ribbon = scene.add.graphics();
    this.skinLabel = pixelText(scene, 0, 0, 'Skin', SOFT);
    this.skinName = pixelText(scene, 0, 0, '');
    this.lock = scene.add.image(0, 0, 'icon_lock').setOrigin(0).setVisible(false);

    // Over the characters: a tap picks the one under it (or strikes its pose if already picked); a swipe turns the
    // line-up, a swipe left bringing the next character (the one standing to the right) to the front.
    const hit = scene.add.zone(0, 0, w, RIBBON_Y - 2).setOrigin(0).setInteractive({ useHandCursor: true });
    const local = (p: Phaser.Input.Pointer) => {
      const z = scene.cameras.main.zoom;
      return { x: p.x / z - this.x, y: p.y / z - this.y };
    };
    const figureAt = (p: Phaser.Input.Pointer): number => {
      const { x, y } = local(p);
      const n = this.slots.length;
      // The front character first: it stands over the others.
      const order = [...Array(n).keys()].sort((a, b) => Number(this.figures[b].place.front) - Number(this.figures[a].place.front));
      return order.find((i) => this.figures[i].hits(x, y)) ?? -1;
    };
    let down: { x: number; y: number } | null = null;
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y }));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (p: Phaser.Input.Pointer) => this.setHover(p.wasTouch ? -1 : figureAt(p)));
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
      else if (!dragged(scene, p)) {
        const i = figureAt(p);
        if (i >= 0) tapFigure(i);
      }
    });
    // The ribbon: its left and right halves (arrows included) step back and forward through the skins.
    this.stepZones = ([-1, 1] as const).map((dir) => {
      const zw = RIBBON_W / 2 + 22;
      const z = scene.add.zone(dir < 0 ? cx - zw : cx, RIBBON_Y - 4, zw, MAIN_H - RIBBON_Y + 4).setOrigin(0);
      onTap(scene, z, () => stepSkin(dir));
      return z;
    });
    this.add([
      this.bg,
      this.rose,
      ...this.plinths,
      dais,
      this.runes,
      this.pool,
      this.beam,
      this.crowd,
      ...this.motes.map((m) => m.img),
      frame,
      this.ribbon,
      this.skinLabel,
      this.skinName,
      this.lock,
      this.probe,
      hit,
      ...this.stepZones,
    ]);
    for (const m of this.motes) this.spawnMote(m, true);
  }

  /** Where character `i` of `n` stands when `picked` is at the front: the next ones to its right, the ones before to its left. */
  private placeFor(i: number, picked: number, n: number): Place {
    const rel = (i - picked + n) % n;
    if (rel === 0) return { x: this.cx, feet: FRONT_FEET, scale: FRONT_SCALE, plateY: FRONT_PLATE_Y, front: true };
    const right = Math.ceil((n - 1) / 2);
    const side = rel <= right ? 1 : -1;
    const j = side > 0 ? rel - 1 : n - 1 - rel;
    const feet = BACK_FEET - j * BACK_STEP_Y;
    return { x: this.cx + side * (this.backX + j * BACK_STEP_X), feet, scale: BACK_SCALE, plateY: feet + BACK_PLATE_DY, front: false };
  }

  /**
   * Show a class: its characters, `picked` at the front, and the picked one's skins.
   * `jump` is a new class (everyone takes their place at once) rather than a turn of the line-up.
   */
  show(slots: Slot[], picked: number, skin: SkinPick, pose: boolean, jump: boolean): void {
    const n = Math.min(slots.length, MAX_FIGURES);
    const turn = !jump && n === this.slots.length && picked !== this.picked;
    this.slots = slots.slice(0, n);
    this.picked = Math.min(picked, n - 1);
    this.skin = skin;
    this.accent = slots[this.picked].accent;
    this.setHover(-1, false);

    this.figures.forEach((f, i) => {
      f.setVisible(i < n);
      if (i >= n) return;
      f.setLook(this.slots[i], this.probe);
      f.walkTo(this.placeFor(i, this.picked, n), !turn);
    });
    // The plinths stand where the characters behind stand, whoever is at the front.
    this.plinths.forEach((p, k) => {
      p.setVisible(k < n - 1);
      if (k >= n - 1) return;
      const at = this.placeFor(k + 1, 0, n);
      p.setPosition(at.x, at.feet);
    });
    // The front character over the others; the ones further back under the nearer ones.
    const order = this.figures.slice(0, n).sort((a, b) => a.place.feet - b.place.feet || Number(a.place.front) - Number(b.place.front));
    order.forEach((f) => this.crowd.bringToTop(f));
    this.lightFigures();

    this.beam.setTint(this.accent).setAlpha(0.8);
    this.pool.setTint(this.accent).setAlpha(0.75);
    this.runes.setTint(this.accent);
    this.rose.setTint(this.accent);
    for (const m of this.motes) m.img.setTint(this.accent);

    this.note = null;
    this.noteTimer?.remove();
    this.drawRibbon();
    if (pose && !skin.locked) {
      const f = this.figures[this.picked];
      if (turn) this.scene.time.delayedCall(TURN_MS, () => f.pose());
      else f.pose();
    }
  }

  private setHover(i: number, redraw = true): void {
    if (i === this.hover) return;
    this.hover = i;
    if (redraw) this.lightFigures();
  }

  private lightFigures(): void {
    this.slots.forEach((_s, i) => this.figures[i].light(i === this.picked, i === this.hover, i === this.picked && !!this.skin?.locked));
  }

  /** The skin ribbon: a swallow-tailed banner with the skin's name, a dot per skin, and a tall arrow at each end. */
  private drawRibbon(): void {
    const skin = this.skin;
    if (!skin) return;
    const { cx, accent } = this;
    const many = skin.count > 1;
    const g = this.ribbon.clear();
    const x0 = cx - RIBBON_W / 2;
    const y0 = RIBBON_Y;
    // The banner: dark cloth between two rows of its colour, with a notch cut into each end.
    for (let y = 0; y < RIBBON_H; y++) {
      const notch = 4 - Math.abs(y - (RIBBON_H - 1) / 2) * (8 / RIBBON_H);
      const inset = Math.max(0, Math.round(notch));
      g.fillStyle(OUTLINE).fillRect(x0 + inset - 1, y0 + y, RIBBON_W - inset * 2 + 2, 1);
      const edge = y === 0 || y === RIBBON_H - 1;
      if (edge) continue;
      const body = y === 1 || y === RIBBON_H - 2 ? accent : y < RIBBON_H / 2 ? 0x221a44 : 0x17122f;
      g.fillStyle(body, y === 1 || y === RIBBON_H - 2 ? 0.9 : 0.96).fillRect(x0 + inset, y0 + y, RIBBON_W - inset * 2, 1);
    }

    // "Skin", then the lock for one not yet won, then its name; or a note for a moment.
    const nameY = many ? y0 + 2 : y0 + 5;
    const note = this.note;
    this.skinLabel.setVisible(!note);
    this.lock.setVisible(!note && skin.locked);
    if (note) this.skinName.setText(note.toUpperCase()).setTint(0x9ff6ff);
    else this.skinName.setText(fitLine(this.probe, skin.name, RIBBON_W - 44)).setTint(skin.locked ? DIMMED : (skin.rarity ?? INK));
    const labelW = note ? 0 : this.skinLabel.width + 4;
    const lockW = this.lock.visible ? this.lock.width + 2 : 0;
    const left = Math.round(cx - (labelW + lockW + this.skinName.width) / 2);
    this.skinLabel.setPosition(left, nameY);
    this.lock.setPosition(left + labelW, nameY);
    this.skinName.setPosition(left + labelW + lockW, nameY);
    for (const z of this.stepZones) if (z.input) z.input.enabled = many;
    if (!many) return;
    // Tall, thin arrows just outside the ribbon's ends.
    drawTallArrow(g, x0 - 10, y0 + 1, -1, accent);
    drawTallArrow(g, x0 + RIBBON_W + 5, y0 + 1, 1, accent);
    // A dot per skin, the worn one lit; skins not yet won are hollow.
    const step = 6;
    const dx0 = Math.round(cx - ((skin.count - 1) * step) / 2) - 1;
    const y = y0 + 13;
    for (let i = 0; i < skin.count; i++) {
      const x = dx0 + i * step;
      if (i === skin.index) {
        g.fillStyle(skin.owned[i] ? accent : DIMMED).fillRect(x - 1, y, 5, 2);
        g.fillStyle(0xffffff, 0.7).fillRect(x - 1, y, 5, 1);
      } else g.fillStyle(skin.owned[i] ? 0x8a7ad0 : 0x43356e).fillRect(x, y, 3, 2);
    }
  }

  /** Show `text` where the skin's name goes for a moment. */
  say(text: string): void {
    this.note = text;
    this.drawRibbon();
    this.noteTimer?.remove();
    this.noteTimer = this.scene.time.delayedCall(NOTE_MS, () => {
      this.note = null;
      this.drawRibbon();
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
      m.img.setPosition(Math.round(m.x + Math.sin(m.t * 6 + m.rise) * 2), Math.round(FRONT_FEET - 2 - m.t * m.rise));
    }
  }

  private spawnMote(m: Stage['motes'][number], scatter: boolean): void {
    m.t = scatter ? Math.random() : 0;
    m.life = Phaser.Math.FloatBetween(1.8, 3.4);
    m.x = this.cx + Phaser.Math.Between(-26, 26);
    m.rise = Phaser.Math.Between(40, FRONT_FEET - 12);
  }
}

/** The select page itself, opened over the home screen. */
export class SelectScene extends Phaser.Scene {
  private cls = 0;
  private leaving = false;
  private shade!: Phaser.GameObjects.Graphics;
  /** The class's name over the page, with arrows either side to step through the classes. */
  private header!: Phaser.GameObjects.BitmapText;
  private headerShadow!: Phaser.GameObjects.BitmapText;
  private arrows!: Phaser.GameObjects.Graphics;
  private arrowZones: Phaser.GameObjects.Zone[] = [];
  private back!: PixelButton;
  private play!: PixelButton;
  private stage?: Stage;
  /** A skin not yet won that the player is looking at (the look worn stays the one they own). */
  private peek: SkinDef | null = null;
  private roster: Tile[] = [];
  private info!: Phaser.GameObjects.Container;
  private probe!: Phaser.GameObjects.BitmapText;
  private nameText!: Phaser.GameObjects.BitmapText;
  private role!: Phaser.GameObjects.BitmapText;
  private accentLine!: Phaser.GameObjects.Graphics;
  private statValues: Phaser.GameObjects.BitmapText[] = [];
  private abilities: Phaser.GameObjects.BitmapText[] = [];
  private icons!: { attack: Phaser.GameObjects.Sprite; special: Phaser.GameObjects.Image; ult: Phaser.GameObjects.Image };
  private ultName!: Phaser.GameObjects.BitmapText;
  private ultCost!: Phaser.GameObjects.BitmapText;
  private bolt!: Phaser.GameObjects.Graphics;
  /** The shade the hall is tinted with, and its tween. */
  private tint = -1;
  private tintTween?: Phaser.Tweens.Tween;

  constructor() {
    super('select');
  }

  private get current(): ClassDef {
    return CLASSES[this.cls];
  }

  create(): void {
    this.leaving = false;
    this.peek = null;
    this.stage = undefined;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });
    const saved = CLASSES.findIndex((c) => c.id === lastHero());
    this.cls = Math.min(lastPicked ?? Math.max(0, saved), CLASSES.length - 1);
    ensureUltIcons(this);
    statIconsTexture(this);

    this.shade = this.add.graphics();
    this.headerShadow = pixelText(this, 0, 0, '', OUTLINE, 2).setAlpha(0.6);
    this.header = pixelText(this, 0, 0, '', GOLD, 2);
    this.arrows = this.add.graphics();
    this.arrowZones = ([-1, 1] as const).map((dir) => {
      const z = this.add.zone(0, 0, 26, 24).setOrigin(0);
      onTap(this, z, () => this.stepClass(dir));
      return z;
    });
    this.probe = pixelText(this, 0, 0, '').setVisible(false);
    this.roster = CLASSES.map((_c, i) => new Tile(this, () => this.pickClass(i)));
    for (const t of this.roster) this.add.existing(t);
    this.tint = -1;
    this.tintTween = undefined;
    this.buildInfo();
    this.back = new PixelButton(this, 'Back', BACK_W, BACK_H, BUTTON_PLAIN, 'sel_back', () => this.goBack());
    this.play = new PixelButton(this, 'Play', INFO_W - PAD * 2, PLAY_H, BUTTON_GOLD, 'sel_play', () => this.startGame());

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
    this.stage?.update(Math.min(0.1, delta / 1000));
  }

  /** The card beside the hall: the picked character's name and role, its stats, its attack and ability, its Special, and Play. */
  private buildInfo(): void {
    const bg = this.add.image(0, 0, panelTexture(this, 'sel_card', INFO_W, MAIN_H, PANEL)).setOrigin(0);
    this.nameText = pixelText(this, PAD, NAME_Y, '', INK, 2);
    this.role = pixelText(this, PAD, ROLE_Y, '', LAVENDER);
    this.accentLine = this.add.graphics();
    // A thin rule between the stats and the abilities.
    const rules = this.add.graphics();
    rules.fillStyle(OUTLINE).fillRect(PAD, RULE2_Y, INFO_W - PAD * 2, 1);
    rules.fillStyle(0x43356e).fillRect(PAD, RULE2_Y + 1, INFO_W - PAD * 2, 1);

    // The stats, in two columns of three: an icon, a name, and the value set to the column's right edge.
    const parts: Phaser.GameObjects.GameObject[] = [];
    this.statValues = STATS.map((s, i) => {
      const col = Math.floor(i / 3);
      const x = PAD + col * (STAT_COL_W + 8);
      const y = STATS_Y + (i % 3) * STAT_ROW;
      parts.push(this.add.image(x - 1, y - 1, 'sel_stat_icons', s.icon).setOrigin(0));
      parts.push(pixelText(this, x + 10, y, s.name, SOFT));
      return pixelText(this, x + STAT_COL_W, y, '', INK);
    });

    // Attack and ability: an icon in a recessed box, what it is, and its name.
    const boxes = this.add.graphics();
    const box = (x: number, y: number, size: number, rim: number) => {
      boxes.fillStyle(OUTLINE).fillRect(x, y, size, size);
      boxes.fillStyle(0x140f2a).fillRect(x + 1, y + 1, size - 2, size - 2);
      boxes.fillStyle(rim).fillRect(x + 1, y + size - 2, size - 2, 1);
    };
    this.abilities = ['Attack', 'Ability'].map((kind, i) => {
      const y = ABIL_Y + i * ABIL_ROW;
      box(PAD, y, ICON_BOX, 0x43356e);
      parts.push(pixelText(this, PAD + ICON_BOX + 5, y, kind, SOFT));
      return pixelText(this, PAD + ICON_BOX + 5, y + 9, '');
    });
    const iconX = PAD + ICON_BOX / 2;

    // The Special: a gold-rimmed strip with its icon, its name and what it costs in energy.
    const sx = PAD - 2;
    const sw = INFO_W - (PAD - 2) * 2;
    const strip = this.add.graphics();
    strip.fillStyle(OUTLINE).fillRect(sx, SPECIAL_Y, sw, SPECIAL_H);
    strip.fillStyle(GOLD_DARK).fillRect(sx + 1, SPECIAL_Y + 1, sw - 2, SPECIAL_H - 2);
    strip.fillStyle(0x1c1538).fillRect(sx + 2, SPECIAL_Y + 2, sw - 4, SPECIAL_H - 4);
    strip.fillStyle(0xffe08a, 0.7).fillRect(sx + 2, SPECIAL_Y + 1, sw - 4, 1);
    strip.fillStyle(0xffe08a, 0.08).fillRect(sx + 2, SPECIAL_Y + 2, sw - 4, 6);
    const ultBox = sx + 2;
    box(ultBox, SPECIAL_Y + 1, ICON_BOX, 0x8a4e22);
    const ultLabel = pixelText(this, ultBox + ICON_BOX + 5, SPECIAL_Y + 3, 'Special', GOLD);
    this.ultName = pixelText(this, ultBox + ICON_BOX + 5, SPECIAL_Y + 11, '');
    this.ultCost = pixelText(this, 0, SPECIAL_Y + 7, '', GOLD);
    this.bolt = this.add.graphics();

    this.icons = {
      attack: this.add.sprite(iconX, ABIL_Y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      special: this.add.image(iconX, ABIL_Y + ABIL_ROW + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      ult: this.add.image(ultBox + ICON_BOX / 2, SPECIAL_Y + 1 + ICON_BOX / 2, '__DEFAULT'),
    };
    this.info = this.add.container(0, 0, [
      bg,
      this.accentLine,
      this.nameText,
      this.role,
      rules,
      ...parts,
      ...this.statValues,
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
    ]);
  }

  /**
   * Show the current class, its characters, and the picked one in its skin.
   * `pose` plays the picked character's pose; `jump` is a new class (no turn of the line-up).
   */
  private refresh(pose: boolean, jump: boolean): void {
    const stage = this.stage;
    if (!stage) return;
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
    stage.show(
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
    this.headerShadow.setText(cls.name.toUpperCase());
    this.placeHeader();

    // The picked character's name, big when it fits, and its role, over a line of its colour.
    const textW = INFO_W - PAD * 2;
    this.nameText.setScale(2).setText(look.type.name.toUpperCase());
    if (this.nameText.width > textW) this.nameText.setScale(1).setText(fitLine(this.probe, look.type.name, textW)).setY(NAME_Y + 5);
    else this.nameText.setY(NAME_Y);
    this.role.setText(fitLine(this.probe, def.role, textW));
    const g = this.accentLine.clear();
    // The line fades out to the right in dithered steps.
    for (let x = 0; x < textW; x++) {
      const a = 1 - x / textW;
      if (a < bayer(x, 0) * 0.9) continue;
      g.fillStyle(def.accent, 0.35 + a * 0.65).fillRect(PAD + x, RULE1_Y, 1, 1);
    }
    g.fillStyle(OUTLINE, 0.8).fillRect(PAD, RULE1_Y + 1, textW, 1);

    // Stats: the type's own numbers (skins never change them).
    const st = heroStats(cls.id, look.type.id);
    STATS.forEach((s, i) => {
      const t = this.statValues[i].setText(s.value(st));
      const col = Math.floor(i / 3);
      t.setX(PAD + col * (STAT_COL_W + 8) + STAT_COL_W - t.width);
    });

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
    const right = INFO_W - PAD - 3;
    this.ultCost.setText(`${ult.def.cost}`);
    this.ultCost.setX(right - this.ultCost.width);
    const boltX = this.ultCost.x - 7;
    const b = this.bolt.clear();
    const BOLT = ['..##', '.##.', '####', '.##.', '##..'];
    BOLT.forEach((row, y) => [...row].forEach((c, x) => c === '#' && b.fillStyle(0xffe08a).fillRect(boltX + x, SPECIAL_Y + 8 + y, 1, 1)));
    this.ultName.setText(fitLine(this.probe, ult.name, boltX - 4 - this.ultName.x));
  }

  /** Tint the hall (only; the screen behind keeps its own colours) with a shade of the hero's colour, easing from the last one. */
  private shadeTo(accent: number): void {
    const stage = this.stage;
    if (!stage) return;
    const target = hallShade(accent);
    if (target === this.tint) return;
    const from = Phaser.Display.Color.ValueToColor(this.tint < 0 ? target : this.tint);
    const to = Phaser.Display.Color.ValueToColor(target);
    this.tint = target;
    this.tintTween?.stop();
    const apply = (t: number) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t * 100);
      stage.bg.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
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
    // Back to the game mode menu, still over the home screen.
    this.scene.launch('modes');
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** On to the arena select, with this hero. */
  private startGame(): void {
    if (this.leaving) return;
    if (this.peek) {
      // Not theirs yet: the lock rattles, and the ribbon says where to get it.
      this.stage?.rattle();
      this.stage?.say('Win it in the Shop');
      return;
    }
    this.leaving = true;
    const character = this.current.id;
    lastPicked = this.cls;
    rememberHero(character);
    this.scene.launch('arena', { character });
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** The class's name centred over the page with a shadow under it, a tall arrow either side, and gold flourishes running out from them. */
  private placeHeader(): void {
    const vw = this.scale.width / this.cameras.main.zoom;
    const y = this.headerY(this.scale.height / this.cameras.main.zoom);
    const x = Math.round((vw - this.header.width) / 2);
    this.header.setPosition(x, y);
    this.headerShadow.setPosition(x + 1, y + 2);
    const g = this.arrows.clear();
    const mid = y + Math.round(this.header.height / 2) - 6;
    for (const dir of [-1, 1] as const) {
      const at = dir < 0 ? x - 14 : x + this.header.width + 9;
      drawTallArrow(g, at, mid, dir, GOLD);
      // A flourish: a hairline running out from the arrow, fading in dithered steps, with a diamond at its end.
      const len = 34;
      for (let i = 0; i < len; i++) {
        const a = 1 - i / len;
        if (a < bayer(i, 1) * 0.8) continue;
        const px = dir < 0 ? at - 4 - i : at + 8 + i;
        g.fillStyle(GOLD_DARK, 0.4 + a * 0.6).fillRect(px, mid + 6, 1, 1);
      }
      const dx = dir < 0 ? at - 4 - len : at + 8 + len;
      g.fillStyle(GOLD_DARK).fillRect(dx - 1, mid + 5, 3, 3);
      g.fillStyle(0xffe08a).fillRect(dx, mid + 6, 1, 1);
      this.arrowZones[dir < 0 ? 0 : 1].setPosition(at - 10, mid - 5);
    }
  }

  private headerY(vh: number): number {
    return Math.ceil(fpsBottom() / (this.scale.height / vh)) + 3;
  }

  /** How the roster fits a view `vw` x `vh`: the biggest tiles that fit in one row, else in two. Null when it can't fit with the hall. */
  private rosterPlan(vw: number, vh: number): { tile: number; cols: number; rows: number } | null {
    const n = CLASSES.length;
    if (vw < STAGE_MIN + GAP + INFO_W + MARGIN * 2) return null;
    const top = this.headerY(vh) + 18;
    for (const rows of [1, 2]) {
      const cols = Math.ceil(n / rows);
      for (const tile of TILE_SIZES) {
        const w = cols * tile + (cols - 1) * TILE_GAP;
        const h = rows * tileH(tile) + (rows - 1) * TILE_GAP;
        if (w <= vw - MARGIN * 2 && top + MAIN_H + 6 + h + 4 <= vh) return { tile, cols, rows };
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

    // The page behind dims, most at its edges and bottom, so the hall and card stand out (in black, never tinted).
    const g = this.shade.clear();
    g.fillStyle(0x0b0818, 0.42).fillRect(0, 0, Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    for (let i = 0; i < 6; i++) g.fillStyle(0x0b0818, 0.07).fillRect(0, vh - 44 + i * 7, Math.ceil(vw) + 1, 44 - i * 7);
    this.placeHeader();
    const headerY = this.headerY(vh);
    this.back.place(MARGIN, headerY);

    const fit = TILE_SIZES[TILE_SIZES.length - 1];
    const plan = this.rosterPlan(vw, vh) ?? { tile: fit, cols: Math.min(n, Math.max(1, Math.floor((vw - MARGIN * 2) / (fit + TILE_GAP)))), rows: 0 };
    const cols = plan.cols;
    const rows = Math.ceil(n / cols);
    const th = tileH(plan.tile);
    const rosterH = rows * th + (rows - 1) * TILE_GAP;
    const rosterY = Math.round(vh - 5 - rosterH);
    // Row by row, each centred (the last may be shorter).
    this.roster.forEach((t, i) => {
      t.resize(plan.tile);
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * plan.tile + (inRow - 1) * TILE_GAP;
      t.x = Math.round((vw - rowW) / 2) + (i % cols) * (plan.tile + TILE_GAP);
      t.baseY = rosterY + row * (th + TILE_GAP);
      t.setPicked(i === this.cls);
    });

    // The hall is as wide as the view allows, within bounds; build it anew when that width changes.
    const stageW = Math.floor(Phaser.Math.Clamp(vw - MARGIN * 2 - GAP - INFO_W - 8, STAGE_MIN, STAGE_MAX) / 2) * 2;
    if (!this.stage || this.stage.boxW !== stageW) {
      this.stage?.destroy();
      this.stage = new Stage(
        this,
        stageW,
        (i) => (i === this.current.types.indexOf(lookOf(this.current).type) ? this.stage?.pose() : this.pickType(i)),
        (dir) => this.stepType(dir),
        (dir) => this.stepSkin(dir),
      );
      this.add.existing(this.stage);
      this.tint = -1;
      this.refresh(true, true);
    }

    // The hall and the card side by side, centred between the header and the roster.
    const top = headerY + 18;
    const room = rosterY - 5 - top;
    const y = Math.round(top + Math.max(0, (room - MAIN_H) / 2));
    const x = Math.round((vw - (stageW + GAP + INFO_W)) / 2);
    this.stage.setPosition(x, y);
    this.info.setPosition(x + stageW + GAP, y);
    this.play.place(x + stageW + GAP + PAD, y + PLAY_Y);
  }
}
