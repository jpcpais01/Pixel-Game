import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';
import { menuZoom } from '../game/display';
import { CLASSES, type ClassDef, type Preview } from '../game/characters';
import { lastHero, lookOf, rememberHero, setLook, setType, worn } from '../game/skins';
import { ensureUltIcons, ultFor } from '../game/ultimate';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

// The hero select: a lit stage showing the hero big on a pedestal, with the
// chosen type's skins (how it looks) stepped through under it; a panel beside
// it with the class, a tab for each of its types (how it plays) and that
// type's stats, abilities and Special; and a roster of every class along the
// bottom.

/** Roster tiles: a small window onto the hero at 1x. */
const TILE_W = 28;
const TILE_H = 36;
const TILE_GAP = 3;
/** The stage on the left and the info panel on the right. */
const STAGE_W = 120;
const INFO_W = 236;
const MAIN_GAP = 6;
const PAD = 7;
/** Rows in the info panel, from its top. */
const NAME_Y = 6;
const BLURB_Y = 24;
/** Type tabs, and the body under them that shows the picked type. */
const TABS_Y = 35;
const TAB_H = 15;
const TAB_GAP = 2;
const BODY_Y = TABS_Y + TAB_H;
const ROLE_Y = BODY_Y + 6;
const STATS_Y = BODY_Y + 21;
const STAT_ROW = 12;
const SEG_W = 9;
const ABIL_X = PAD + 104;
const ABIL_Y = BODY_Y + 19;
const ICON_BOX = 18;
/** The Special: a gold strip across the bottom of the body. */
const SPECIAL_Y = BODY_Y + 61;
const SPECIAL_H = 24;
const INFO_H = SPECIAL_Y + SPECIAL_H + 9;
/** Stage: feet this far above its bottom, leaving room for the skin picker under the pedestal. */
const STAGE_FEET = 34;
const MOTES = 7;
/** Buttons and margins. */
const MARGIN = 8;
const BACK_W = 48;
const NEXT_W = 64;
const BUTTON_H = 20;
/** How far a press on the stage must travel sideways to count as a swipe to the next class. */
const SWIPE = 24;
const TAP_SLOP = 5;

/** The class picked last, kept while the game runs. */
let lastPicked: number | null = null;

const INK = 0xfff4d6;
const LAVENDER = 0xb8a8e8;
const SOFT = 0x9a8cd0;
const GOLD = 0xf4cf6a;
const DIMMED = 0x8a84a8;

/** Trim a single line to `maxW`, ending in a dot, as a last resort for text too long to fit. */
function fitLine(probe: Phaser.GameObjects.BitmapText, text: string, maxW: number): string {
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
function cropToWindow(s: Phaser.GameObjects.Sprite, preview: Preview, w: number, up: number, down: number, scale: number): void {
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

const OUTER = hex('#0b0818');
const RIM = hex('#43356e');
const RIM_LIT = hex('#6b5aa6');

/** The stage's backdrop: a dim hall with two pillars, and a tiled floor that runs back to the wall. */
function stageTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `sel_stage_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const b = new Bitmap(w, h);
  const floorY = h - STAGE_FEET - 12;
  const wallTop = hex('#0a0719');
  const wallLow = hex('#1f1845');
  const pillar = hex('#2c2360');
  const pillarLit = hex('#46398a');
  const floorFar = hex('#2a2154');
  const floorNear = hex('#171131');
  const mortar = hex('#0f0b22');
  const black: RGB = [6, 4, 14];
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x);
      const ey = Math.min(y, h - 1 - y);
      if (ex + ey === 0) continue;
      if (ex === 0 || ey === 0) {
        b.set(x, y, OUTER);
        continue;
      }
      if (ex === 1 || ey === 1) {
        b.set(x, y, y === 1 || x === 1 ? RIM_LIT : RIM);
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

/** A small framed window onto a hero at 1x: the class roster and the type and skin pickers. */
class Tile extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private keys: [string, string];
  private glow: Phaser.GameObjects.Image;
  private sprite: Phaser.GameObjects.Sprite;
  private preview?: Preview;
  private picked = false;

  constructor(scene: Phaser.Scene, tap: () => void) {
    super(scene, 0, 0);
    this.keys = [panelTexture(scene, 'sel_tile', TILE_W, TILE_H, PANEL_INSET), panelTexture(scene, 'sel_tile_picked', TILE_W, TILE_H, { ...PANEL_PICKED, alpha: 0.95 })];
    this.bg = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    onTap(scene, this.bg, tap);
    const fx = TILE_W / 2;
    const fy = TILE_H - 4;
    this.glow = scene.add.image(fx, fy - 1, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.8, 0.3);
    const shadow = scene.add.image(fx, fy, 'shadow');
    this.sprite = scene.add.sprite(fx, fy, '__DEFAULT');
    this.add([this.bg, this.glow, shadow, this.sprite]);
  }

  show(preview: Preview, accent: number): this {
    if (this.preview !== preview) {
      this.preview = preview;
      this.sprite.setTexture(preview.texture).setOrigin(0.5, preview.originY ?? 31 / 32);
      cropToWindow(this.sprite, preview, TILE_W - 4, TILE_H - 6, 2, 1);
      this.sprite.play(preview.idle);
    }
    this.glow.setTint(accent);
    return this;
  }

  setPicked(on: boolean): this {
    this.picked = on;
    this.bg.setTexture(this.keys[on ? 1 : 0]);
    this.glow.setAlpha(on ? 0.8 : 0);
    if (on) this.sprite.clearTint();
    else this.sprite.setTint(DIMMED);
    return this;
  }

  get isPicked(): boolean {
    return this.picked;
  }
}

/** Which skin is worn, out of how many, for the picker under the pedestal. */
interface SkinPick {
  name: string;
  index: number;
  count: number;
}

/** The hero shown big, on a lit pedestal, with sparks drifting up through the light, and its skins stepped through underneath. */
class Stage extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH: number;
  private beam: Phaser.GameObjects.Image;
  private pool: Phaser.GameObjects.Image;
  private runes: Phaser.GameObjects.Image;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private skinName: Phaser.GameObjects.BitmapText;
  /** Arrows either side of the skin name and a dot per skin under it. */
  private picker: Phaser.GameObjects.Graphics;
  private stepZones: Phaser.GameObjects.Zone[];
  private motes: { img: Phaser.GameObjects.Image; t: number; life: number; x: number; rise: number }[] = [];
  private scale3: number;
  private feetX: number;
  private feetY: number;
  private preview?: Preview;

  constructor(scene: Phaser.Scene, w: number, h: number, tap: () => void, swipe: (dir: -1 | 1) => void, stepSkin: (dir: -1 | 1) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.boxH = h;
    this.feetX = Math.round(w / 2);
    this.feetY = h - STAGE_FEET;
    // Three times size when there's room for a hero's full height, else twice.
    this.scale3 = this.feetY - 4 >= 96 ? 3 : 2;
    const bg = scene.add.image(0, 0, stageTexture(scene, w, h)).setOrigin(0);
    this.beam = scene.add.image(this.feetX, 2, beamTexture(scene, this.feetY + 2)).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.pool = scene.add.image(this.feetX, this.feetY + 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6, 0.8);
    const pedestal = scene.add.image(this.feetX, this.feetY, pedestalTexture(scene)).setOrigin(0.5, PED_CY / PED_H);
    this.runes = scene.add.image(this.feetX, this.feetY, runesTexture(scene)).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.runes, alpha: { from: 0.35, to: 0.9 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const shadow = scene.add.image(this.feetX, this.feetY, 'shadow').setScale(this.scale3);
    this.sprite = scene.add.sprite(this.feetX, this.feetY, '__DEFAULT').setScale(this.scale3);
    this.glow = scene.add.sprite(this.feetX, this.feetY, '__DEFAULT').setScale(this.scale3).setBlendMode(Phaser.BlendModes.ADD);
    this.skinName = pixelText(scene, 0, h - 18, '');
    this.picker = scene.add.graphics();
    const mote = moteTexture(scene);
    for (let i = 0; i < MOTES; i++) {
      const img = scene.add.image(0, 0, mote).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.motes.push({ img, t: Math.random(), life: 1, x: 0, rise: 0 });
    }
    // A tap shows the hero's pose; a swipe moves to the next class.
    const hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    let down: { x: number; y: number } | null = null;
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y }));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (down = null));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!down) return;
      const z = scene.cameras.main.zoom;
      const dx = (p.x - down.x) / z;
      const dy = (p.y - down.y) / z;
      down = null;
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) swipe(dx < 0 ? 1 : -1);
      else if (!dragged(scene, p)) tap();
    });
    // The skin picker: the left and right halves of the strip under the pedestal step back and forward.
    const stripY = this.feetY + 12;
    this.stepZones = ([-1, 1] as const).map((dir) => {
      const z = scene.add.zone(dir < 0 ? 0 : w / 2, stripY, w / 2, h - stripY).setOrigin(0);
      onTap(scene, z, () => stepSkin(dir));
      return z;
    });
    this.add([bg, this.beam, this.pool, pedestal, this.runes, shadow, ...this.motes.map((m) => m.img), this.sprite, this.glow, this.skinName, this.picker, hit, ...this.stepZones]);
    for (const m of this.motes) this.spawnMote(m, true);
  }

  /** Show a look; `pose` plays its picked animation first. `fresh` fades the hero in (a new class or look). */
  show(preview: Preview, accent: number, skin: SkinPick, pose: boolean, fresh: boolean): void {
    if (this.preview !== preview) {
      this.preview = preview;
      const oy = preview.originY ?? 31 / 32;
      const up = this.feetY - 4;
      this.sprite.setTexture(preview.texture).setOrigin(0.5, oy);
      cropToWindow(this.sprite, preview, this.boxW - 8, up, 3, this.scale3);
      this.glow.setVisible(!!preview.glow);
      if (preview.glow) {
        this.glow.setTexture(preview.glow).setOrigin(0.5, oy);
        cropToWindow(this.glow, preview, this.boxW - 8, up, 3, this.scale3);
      }
    }
    this.beam.setTint(accent).setAlpha(0.75);
    this.pool.setTint(accent).setAlpha(0.7);
    this.runes.setTint(accent);
    for (const m of this.motes) m.img.setTint(accent);
    this.drawPicker(skin, accent);
    if (pose) this.pose();
    else this.sprite.play(preview.idle, true);
    if (fresh) {
      this.scene.tweens.killTweensOf([this.sprite, this.glow]);
      this.sprite.setAlpha(0).setY(this.feetY + 3);
      this.glow.setAlpha(0).setY(this.feetY + 3);
      this.scene.tweens.add({ targets: [this.sprite, this.glow], alpha: 1, y: this.feetY, duration: 160, ease: 'Quad.easeOut' });
    }
  }

  /** The skin's name, with arrows either side and a dot per skin when there's more than one. */
  private drawPicker(skin: SkinPick, accent: number): void {
    const { boxW: w, boxH: h } = this;
    const many = skin.count > 1;
    const nameY = many ? h - 18 : h - 14;
    this.skinName.setText(skin.name.toUpperCase()).setTint(accent);
    this.skinName.setPosition(Math.round((w - this.skinName.width) / 2), nameY);
    for (const z of this.stepZones) if (z.input) z.input.enabled = many;
    const g = this.picker.clear();
    if (!many) return;
    // Chevrons 4 wide and 7 tall, pointing out, with a dark outline.
    // Column i is 7 - 2i tall, so the widest column sits nearest the name and the tip points away.
    for (const dir of [-1, 1]) {
      const col = (i: number) => (dir < 0 ? 11 - i : w - 12 + i);
      for (let i = 0; i < 4; i++) g.fillStyle(0x0b0818, 0.8).fillRect(col(i) - 1, nameY + i - 1, 3, 9 - i * 2);
      for (let i = 0; i < 4; i++) g.fillStyle(accent).fillRect(col(i), nameY + i, 1, 7 - i * 2);
    }
    // A dot per skin, the worn one lit.
    const step = 7;
    const x0 = Math.round(w / 2 - ((skin.count - 1) * step) / 2) - 1;
    const y = h - 8;
    for (let i = 0; i < skin.count; i++) {
      const x = x0 + i * step;
      g.fillStyle(0x0b0818).fillRect(x - 1, y - 1, 5, 5);
      if (i === skin.index) {
        g.fillStyle(accent).fillRect(x, y, 3, 3);
        g.fillStyle(0xffffff, 0.6).fillRect(x, y, 3, 1);
      } else g.fillStyle(0x43356e).fillRect(x, y, 3, 3);
    }
  }

  pose(): void {
    if (this.preview) this.sprite.play(this.preview.chosen).chain(this.preview.idle);
  }

  update(dt: number): void {
    if (this.glow.visible) this.glow.setFrame(this.sprite.frame.name);
    for (const m of this.motes) {
      m.t += dt / m.life;
      if (m.t >= 1) this.spawnMote(m, false);
      // Fade in, drift up with a slight sway, fade out near the top.
      const a = Math.sin(Math.PI * Math.min(1, m.t)) * 0.9;
      m.img.setAlpha(a);
      m.img.setPosition(Math.round(m.x + Math.sin(m.t * 6 + m.rise) * 2), Math.round(this.feetY - 2 - m.t * m.rise));
    }
  }

  private spawnMote(m: Stage['motes'][number], scatter: boolean): void {
    m.t = scatter ? Math.random() : 0;
    m.life = Phaser.Math.FloatBetween(1.8, 3.2);
    m.x = this.feetX + Phaser.Math.Between(-24, 24);
    m.rise = Phaser.Math.Between(40, this.feetY - 12);
  }
}

/** The select page itself, opened over the home screen. */
export class SelectScene extends Phaser.Scene {
  private cls = 0;
  private leaving = false;
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private back!: PixelButton;
  private next!: PixelButton;
  private stage!: Stage;
  private roster: Tile[] = [];
  private info!: Phaser.GameObjects.Container;
  private probe!: Phaser.GameObjects.BitmapText;
  private nameText!: Phaser.GameObjects.BitmapText;
  private blurb!: Phaser.GameObjects.BitmapText;
  /** The type tabs and the body under them, redrawn for each class and type. */
  private frame!: Phaser.GameObjects.Graphics;
  private tabs: { label: Phaser.GameObjects.BitmapText; zone: Phaser.GameObjects.Zone }[] = [];
  private role!: Phaser.GameObjects.BitmapText;
  private bars!: Phaser.GameObjects.Graphics;
  private abilities: Phaser.GameObjects.BitmapText[] = [];
  private icons!: { attack: Phaser.GameObjects.Sprite; special: Phaser.GameObjects.Image; ult: Phaser.GameObjects.Image };
  private ultName!: Phaser.GameObjects.BitmapText;
  private ultCost!: Phaser.GameObjects.BitmapText;
  private bolt!: Phaser.GameObjects.Graphics;

  constructor() {
    super('select');
  }

  private get current(): ClassDef {
    return CLASSES[this.cls];
  }

  create(): void {
    this.leaving = false;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });
    const saved = CLASSES.findIndex((c) => c.id === lastHero());
    this.cls = Math.min(lastPicked ?? Math.max(0, saved), CLASSES.length - 1);
    ensureUltIcons(this);

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Choose your hero *', GOLD);
    this.probe = pixelText(this, 0, 0, '').setVisible(false);
    this.roster = CLASSES.map((_c, i) => new Tile(this, () => this.pickClass(i)));
    for (const t of this.roster) this.add.existing(t);
    this.tabs = [];
    this.buildInfo();
    this.stage = new Stage(
      this,
      STAGE_W,
      INFO_H,
      () => this.stage.pose(),
      (dir) => this.pickClass((this.cls + dir + CLASSES.length) % CLASSES.length),
      (dir) => this.stepSkin(dir),
    );
    this.add.existing(this.stage);
    this.back = new PixelButton(this, 'Back', BACK_W, BUTTON_H - 2, BUTTON_PLAIN, 'back', () => this.goBack());
    this.next = new PixelButton(this, 'Next', NEXT_W, BUTTON_H, BUTTON_GOLD, 'play', () => this.startGame());

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.pickClass((this.cls + CLASSES.length - 1) % CLASSES.length));
    kb?.on('keydown-RIGHT', () => this.pickClass((this.cls + 1) % CLASSES.length));
    kb?.on('keydown-UP', () => this.stepType(-1));
    kb?.on('keydown-DOWN', () => this.stepType(1));
    kb?.on('keydown-Q', () => this.stepSkin(-1));
    kb?.on('keydown-E', () => this.stepSkin(1));
    kb?.on('keydown-ENTER', () => this.startGame());
    kb?.on('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-ESC', () => this.goBack());

    this.layout();
    this.refresh(true, false);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, delta: number): void {
    this.stage.update(Math.min(0.1, delta / 1000));
  }

  /** The panel beside the stage: the class, then a tab per type over the picked type's stats, abilities and Special. */
  private buildInfo(): void {
    const bg = this.add.image(0, 0, panelTexture(this, 'sel_info', INFO_W, INFO_H, PANEL)).setOrigin(0);
    this.nameText = pixelText(this, PAD, NAME_Y, '', INK, 2);
    this.blurb = pixelText(this, PAD, BLURB_Y, '', LAVENDER);
    this.frame = this.add.graphics();
    this.role = pixelText(this, 0, ROLE_Y, '', LAVENDER);
    this.bars = this.add.graphics();
    const labels = ['Power', 'Speed', 'Range'].map((l, i) => pixelText(this, PAD + 6, STATS_Y + i * STAT_ROW, l, SOFT));

    // Attack and ability: an icon in a recessed box, and its name.
    const boxes = this.add.graphics();
    const box = (x: number, y: number, size: number, rim: number) => {
      boxes.fillStyle(0x0b0818).fillRect(x, y, size, size);
      boxes.fillStyle(0x140f2a).fillRect(x + 1, y + 1, size - 2, size - 2);
      boxes.fillStyle(rim).fillRect(x + 1, y + size - 2, size - 2, 1);
    };
    this.abilities = [0, 1].map((i) => {
      const y = ABIL_Y + i * (ICON_BOX + 2);
      box(ABIL_X, y, ICON_BOX, 0x43356e);
      return pixelText(this, ABIL_X + ICON_BOX + 5, y + 6, '');
    });
    const iconX = ABIL_X + ICON_BOX / 2;

    // The Special: a gold-rimmed strip with its icon, its name and what it costs in energy.
    const sx = PAD + 5;
    const sw = INFO_W - PAD * 2 - 10;
    const strip = this.add.graphics();
    strip.fillStyle(0x0b0818).fillRect(sx, SPECIAL_Y, sw, SPECIAL_H);
    strip.fillStyle(0xb8742c).fillRect(sx + 1, SPECIAL_Y + 1, sw - 2, SPECIAL_H - 2);
    strip.fillStyle(0x1c1538).fillRect(sx + 2, SPECIAL_Y + 2, sw - 4, SPECIAL_H - 4);
    strip.fillStyle(0xffe08a, 0.7).fillRect(sx + 2, SPECIAL_Y + 1, sw - 4, 1);
    strip.fillStyle(0xffe08a, 0.08).fillRect(sx + 2, SPECIAL_Y + 2, sw - 4, 6);
    const ultBox = sx + 3;
    box(ultBox, SPECIAL_Y + 3, ICON_BOX, 0x8a4e22);
    const ultLabel = pixelText(this, ultBox + ICON_BOX + 5, SPECIAL_Y + 4, 'Special', GOLD);
    this.ultName = pixelText(this, ultBox + ICON_BOX + 5, SPECIAL_Y + 14, '');
    this.ultCost = pixelText(this, 0, SPECIAL_Y + 9, '', GOLD);
    this.bolt = this.add.graphics();

    this.icons = {
      attack: this.add.sprite(iconX, ABIL_Y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      special: this.add.image(iconX, ABIL_Y + ICON_BOX + 2 + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      ult: this.add.image(ultBox + ICON_BOX / 2, SPECIAL_Y + 3 + ICON_BOX / 2, '__DEFAULT'),
    };
    this.info = this.add.container(0, 0, [
      bg,
      this.nameText,
      this.blurb,
      this.frame,
      this.role,
      this.bars,
      ...labels,
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

  /** Show the current class in its current type and skin. `pose` plays the hero's picked animation. */
  private refresh(pose: boolean, fresh: boolean): void {
    const cls = this.current;
    const look = lookOf(cls);
    const def = worn(cls, look);
    this.roster.forEach((t, i) => {
      const d = worn(CLASSES[i]);
      t.show(d.preview, d.accent).setPicked(i === this.cls);
    });
    const skins = look.type.skins ?? [];
    this.stage.show(
      def.preview,
      def.accent,
      { name: look.skin?.name ?? look.type.lookName ?? 'Classic', index: look.skin ? skins.indexOf(look.skin) + 1 : 0, count: skins.length + 1 },
      pose,
      fresh,
    );

    // Class name, big when it fits.
    const textW = INFO_W - PAD * 2;
    this.nameText.setScale(2).setText(cls.name.toUpperCase());
    if (this.nameText.width > textW) this.nameText.setScale(1).setText(fitLine(this.probe, cls.name, textW)).setY(NAME_Y + 4);
    else this.nameText.setY(NAME_Y);
    this.blurb.setText(fitLine(this.probe, cls.blurb, textW));

    this.drawTabs(cls, cls.types.indexOf(look.type), def.accent);
    this.role.setText(fitLine(this.probe, def.role, textW - 12));
    this.role.setX(Math.round((INFO_W - this.role.width) / 2));

    // Stats: a five-segment gauge each, in the look's colour.
    const g = this.bars.clear();
    const bx = PAD + 42;
    [def.stats.power, def.stats.speed, def.stats.range].forEach((value, i) => {
      const y = STATS_Y + i * STAT_ROW;
      g.fillStyle(0x0b0818).fillRect(bx - 1, y - 1, 5 * (SEG_W + 1) + 1, 9);
      for (let s = 0; s < 5; s++) {
        const x = bx + s * (SEG_W + 1);
        if (s < value) {
          g.fillStyle(def.accent).fillRect(x, y, SEG_W, 7);
          g.fillStyle(0xffffff, 0.45).fillRect(x, y, SEG_W, 1);
          g.fillStyle(0x000000, 0.25).fillRect(x, y + 5, SEG_W, 2);
        } else g.fillStyle(0x221a44).fillRect(x, y, SEG_W, 7);
      }
    });

    // Attack and ability, named for the look.
    const abW = INFO_W - PAD - 4 - this.abilities[0].x;
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
    const right = INFO_W - PAD - 10;
    this.ultCost.setText(`${ult.def.cost}`);
    this.ultCost.setX(right - this.ultCost.width);
    const boltX = this.ultCost.x - 7;
    const b = this.bolt.clear();
    const BOLT = ['..##', '.##.', '####', '.##.', '##..'];
    BOLT.forEach((row, y) => [...row].forEach((c, x) => c === '#' && b.fillStyle(0xffe08a).fillRect(boltX + x, SPECIAL_Y + 10 + y, 1, 1)));
    this.ultName.setText(fitLine(this.probe, ult.name, boltX - 4 - this.ultName.x));
  }

  /**
   * A tab per type across the panel, sharing its width, over a body that
   * holds the picked type; the picked tab opens into the body.
   */
  private drawTabs(cls: ClassDef, picked: number, accent: number): void {
    const n = cls.types.length;
    if (this.tabs.length !== n) {
      for (const t of this.tabs) {
        t.label.destroy();
        t.zone.destroy();
      }
      this.tabs = cls.types.map((_t, i) => {
        const label = pixelText(this, 0, 0, '');
        const zone = this.add.zone(0, TABS_Y, 1, TAB_H).setOrigin(0);
        onTap(this, zone, () => this.pickType(i));
        this.info.add([label, zone]);
        return { label, zone };
      });
    }
    const x0 = PAD;
    const total = INFO_W - PAD * 2;
    const tabW = Math.floor((total - (n - 1) * TAB_GAP) / n);
    const g = this.frame.clear();
    const body = 0x2b2258;
    const bodyBottom = INFO_H - 5;
    // The body: outlined, a lit inner edge, open where the picked tab meets it.
    g.fillStyle(0x0b0818).fillRect(x0, BODY_Y - 1, total, bodyBottom - BODY_Y + 1);
    g.fillStyle(body).fillRect(x0 + 1, BODY_Y, total - 2, bodyBottom - BODY_Y - 1);
    g.fillStyle(0x43356e).fillRect(x0 + 1, bodyBottom - 2, total - 2, 1);
    cls.types.forEach((type, i) => {
      const x = x0 + i * (tabW + TAB_GAP);
      const w = i === n - 1 ? total - (x - x0) : tabW;
      const on = i === picked;
      const top = on ? TABS_Y : TABS_Y + 2;
      g.fillStyle(0x0b0818).fillRect(x, top, w, BODY_Y - top);
      if (on) {
        g.fillStyle(body).fillRect(x + 1, top + 1, w - 2, BODY_Y - top);
        g.fillStyle(accent).fillRect(x + 1, top + 1, w - 2, 2);
        g.fillStyle(0xffffff, 0.35).fillRect(x + 1, top + 1, w - 2, 1);
      } else {
        g.fillStyle(0x17122f).fillRect(x + 1, top + 1, w - 2, BODY_Y - top - 2);
        g.fillStyle(0x2a2150).fillRect(x + 1, top + 1, w - 2, 1);
      }
      const { label, zone } = this.tabs[i];
      label.setText(fitLine(this.probe, type.name, w - 8)).setTint(on ? INK : SOFT);
      label.setPosition(Math.round(x + (w - label.width) / 2), top + (on ? 5 : 4));
      zone.setPosition(x, TABS_Y).setSize(w, TAB_H);
    });
  }

  private pickClass(i: number): void {
    if (this.leaving || i === this.cls) return;
    this.cls = lastPicked = i;
    this.refresh(true, true);
  }

  private pickType(i: number): void {
    const cls = this.current;
    const type = cls.types[i];
    if (this.leaving || !type || type === lookOf(cls).type) return;
    setType(cls, type);
    this.refresh(true, true);
  }

  private pickSkin(i: number): void {
    const cls = this.current;
    const { type, skin } = lookOf(cls);
    const next = i === 0 ? null : (type.skins?.[i - 1] ?? skin);
    if (this.leaving || next === skin) return;
    setLook(cls, type, next);
    this.refresh(true, true);
  }

  private stepType(step: -1 | 1): void {
    const cls = this.current;
    const n = cls.types.length;
    if (n < 2) return;
    this.pickType((cls.types.indexOf(lookOf(cls).type) + step + n) % n);
  }

  private stepSkin(step: -1 | 1): void {
    const { type, skin } = lookOf(this.current);
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
    this.leaving = true;
    const character = this.current.id;
    lastPicked = this.cls;
    rememberHero(character);
    this.scene.launch('arena', { character });
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  private layout(): void {
    const { width, height } = this.scale;
    const n = CLASSES.length;
    const rosterW = n * TILE_W + (n - 1) * TILE_GAP;
    // The roster sits between Back and Next when there's room, else on its own row above them.
    const inlineW = MARGIN * 2 + BACK_W + NEXT_W + rosterW + 16;
    const mainW = STAGE_W + MAIN_GAP + INFO_W + MARGIN * 2;
    const fits = (vw: number, vh: number) => {
      const top = this.headerY(vh) + this.header.height + 5;
      const inline = vw >= inlineW;
      const bottom = inline ? TILE_H : TILE_H + 6 + BUTTON_H;
      return vw >= mainW && vw >= rosterW + MARGIN * 2 && top + INFO_H + 6 + bottom + 6 <= vh;
    };
    // Zoom out a whole step at a time (keeping the pixels crisp) until it all fits.
    let z = menuZoom(width, height);
    while (z > 1 && !fits(width / z, height / z)) z--;
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    const headerY = this.headerY(vh);
    this.header.setPosition(Math.round((vw - this.header.width) / 2), headerY);

    const inline = vw >= inlineW;
    const buttonsY = Math.round(vh - 6 - BUTTON_H);
    const rosterY = inline ? Math.round(vh - 6 - TILE_H) : buttonsY - 6 - TILE_H;
    const rosterX = Math.round((vw - rosterW) / 2);
    this.roster.forEach((t, i) => t.setPosition(rosterX + i * (TILE_W + TILE_GAP), rosterY));
    const buttonY = inline ? Math.round(rosterY + (TILE_H - BUTTON_H) / 2) : buttonsY;
    this.back.place(MARGIN, buttonY + 1);
    this.next.place(vw - MARGIN - NEXT_W, buttonY);

    // The stage and the panel side by side, centred between the header and the roster.
    const top = headerY + this.header.height + 5;
    const room = rosterY - 6 - top;
    const y = Math.round(top + Math.max(0, (room - INFO_H) / 2));
    const x = Math.round((vw - (STAGE_W + MAIN_GAP + INFO_W)) / 2);
    this.stage.setPosition(x, y);
    this.info.setPosition(x + STAGE_W + MAIN_GAP, y);
  }

  private headerY(vh: number): number {
    return Math.ceil(fpsBottom() / (this.scale.height / vh)) + 4;
  }
}
