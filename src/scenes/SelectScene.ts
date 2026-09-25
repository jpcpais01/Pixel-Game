import Phaser from 'phaser';
import { Bitmap, bayer, clamp01, mix } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';
import { menuZoom } from '../game/display';
import { CLASSES, type ClassDef, type Preview } from '../game/characters';
import { lastHero, lastLookOf, lookOf, rememberHero, setLook, setType, worn, type Look } from '../game/skins';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

// The hero select: a lit stage showing the hero big on a pedestal, a panel
// beside it with the class, its types (how it plays) and the chosen type's
// skins (how it looks), and a roster of every class along the bottom.

/** Roster, type and skin tiles: a small window onto the hero at 1x. */
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
const RULE_Y = 34;
const TYPE_Y = 39;
const STATS_Y = TYPE_Y + TILE_H + 5;
const SKIN_Y = STATS_Y + 39;
const INFO_H = SKIN_Y + TILE_H + 6;
/** Where the tiles start in their rows, after the TYPE / SKIN label. */
const LABEL_W = 34;
const LINE_H = 9;
const ICON_BOX = 18;
/** Stage: feet this far above its bottom, leaving room for the look's name under the pedestal. */
const STAGE_FEET = 30;
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
const DIM = 0x8a7cc0;
const GOLD = 0xf4cf6a;
const DIMMED = 0x8a84a8;

/** Word-wrap `text` into lines no wider than `maxW` at the pixel font's size, at most `maxLines`. */
function wrapText(probe: Phaser.GameObjects.BitmapText, text: string, maxW: number, maxLines: number): string[] {
  const fits = (t: string) => probe.setText(t).width <= maxW;
  const lines: string[] = [];
  let line = '';
  for (const word of text.toUpperCase().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || fits(next)) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  // Too many lines: fold the rest into the last one, which then gets trimmed.
  if (lines.length > maxLines) lines.splice(maxLines - 1, lines.length, lines.slice(maxLines - 1).join(' '));
  return lines.map((l) => fitLine(probe, l, maxW));
}

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

/** The hero shown big, on a lit pedestal, with sparks drifting up through the light. */
class Stage extends Phaser.GameObjects.Container {
  readonly boxW: number;
  readonly boxH: number;
  private beam: Phaser.GameObjects.Image;
  private pool: Phaser.GameObjects.Image;
  private runes: Phaser.GameObjects.Image;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private caption: Phaser.GameObjects.BitmapText;
  private motes: { img: Phaser.GameObjects.Image; t: number; life: number; x: number; rise: number }[] = [];
  private scale3: number;
  private feetX: number;
  private feetY: number;
  private preview?: Preview;

  constructor(scene: Phaser.Scene, w: number, h: number, tap: () => void, swipe: (dir: -1 | 1) => void) {
    super(scene, 0, 0);
    this.boxW = w;
    this.boxH = h;
    this.feetX = Math.round(w / 2);
    this.feetY = h - STAGE_FEET;
    // Three times size when there's room for it, else twice.
    this.scale3 = this.feetY - 8 >= 100 ? 3 : 2;
    const bg = scene.add.image(0, 0, stageTexture(scene, w, h)).setOrigin(0);
    this.beam = scene.add.image(this.feetX, 2, beamTexture(scene, this.feetY + 2)).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.pool = scene.add.image(this.feetX, this.feetY + 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6, 0.8);
    const pedestal = scene.add.image(this.feetX, this.feetY, pedestalTexture(scene)).setOrigin(0.5, PED_CY / PED_H);
    this.runes = scene.add.image(this.feetX, this.feetY, runesTexture(scene)).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.runes, alpha: { from: 0.35, to: 0.9 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const shadow = scene.add.image(this.feetX, this.feetY, 'shadow').setScale(this.scale3);
    this.sprite = scene.add.sprite(this.feetX, this.feetY, '__DEFAULT').setScale(this.scale3);
    this.glow = scene.add.sprite(this.feetX, this.feetY, '__DEFAULT').setScale(this.scale3).setBlendMode(Phaser.BlendModes.ADD);
    this.caption = pixelText(scene, 0, h - 13, '');
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
    this.add([bg, this.beam, this.pool, pedestal, this.runes, shadow, ...this.motes.map((m) => m.img), this.sprite, this.glow, this.caption, hit]);
    for (const m of this.motes) this.spawnMote(m, true);
  }

  /** Show a look; `pose` plays its picked animation first. `fresh` fades the hero in (a new class or look). */
  show(preview: Preview, accent: number, caption: string, pose: boolean, fresh: boolean): void {
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
    this.caption.setText(caption.toUpperCase()).setTint(accent);
    this.caption.setX(Math.round((this.boxW - this.caption.width) / 2));
    if (pose) this.pose();
    else this.sprite.play(preview.idle, true);
    if (fresh) {
      this.scene.tweens.killTweensOf([this.sprite, this.glow]);
      this.sprite.setAlpha(0).setY(this.feetY + 3);
      this.glow.setAlpha(0).setY(this.feetY + 3);
      this.scene.tweens.add({ targets: [this.sprite, this.glow], alpha: 1, y: this.feetY, duration: 160, ease: 'Quad.easeOut' });
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
  private typeName!: Phaser.GameObjects.BitmapText;
  private typeRole!: Phaser.GameObjects.BitmapText;
  private skinName!: Phaser.GameObjects.BitmapText;
  private pips!: Phaser.GameObjects.Graphics;
  private abilities: Phaser.GameObjects.BitmapText[] = [];
  private icons: { attack: Phaser.GameObjects.Sprite; special: Phaser.GameObjects.Image } | null = null;
  private typeTiles: Tile[] = [];
  private skinTiles: Tile[] = [];

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
    this.cls = lastPicked ?? Math.max(0, saved);

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Choose your hero *', GOLD);
    this.probe = pixelText(this, 0, 0, '').setVisible(false);
    this.roster = CLASSES.map((_c, i) => new Tile(this, () => this.pickClass(i)));
    for (const t of this.roster) this.add.existing(t);
    this.typeTiles = [];
    this.skinTiles = [];
    this.buildInfo();
    this.stage = new Stage(
      this,
      STAGE_W,
      INFO_H,
      () => this.stage.pose(),
      (dir) => this.pickClass((this.cls + dir + CLASSES.length) % CLASSES.length),
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

  /** The panel beside the stage: the class, then its types, stats and abilities, then the type's skins. */
  private buildInfo(): void {
    const bg = this.add.image(0, 0, panelTexture(this, 'sel_info', INFO_W, INFO_H, PANEL)).setOrigin(0);
    this.nameText = pixelText(this, PAD, NAME_Y, '', INK, 2);
    this.blurb = pixelText(this, PAD, BLURB_Y, '', LAVENDER);
    const rule = this.add.graphics();
    rule.fillStyle(0x0b0818, 0.8).fillRect(PAD, RULE_Y, INFO_W - PAD * 2, 1);
    rule.fillStyle(0x6b5aa6, 0.6).fillRect(PAD, RULE_Y + 1, INFO_W - PAD * 2, 1);
    const typeLabel = pixelText(this, PAD, TYPE_Y + 14, 'Type', LAVENDER);
    const skinLabel = pixelText(this, PAD, SKIN_Y + 14, 'Skin', LAVENDER);
    this.typeName = pixelText(this, 0, 0, '');
    this.typeRole = pixelText(this, 0, 0, '', LAVENDER);
    this.skinName = pixelText(this, 0, 0, '');
    this.pips = this.add.graphics();
    const labels = ['Power', 'Speed', 'Range'].map((l, i) => pixelText(this, PAD, STATS_Y + 3 + i * LINE_H, l, DIM));
    const abX = PAD + 82;
    const boxes = this.add.graphics();
    this.abilities = [0, 1].map((i) => {
      const y = STATS_Y + i * (ICON_BOX + 2);
      boxes.fillStyle(0x0b0818).fillRect(abX, y, ICON_BOX, ICON_BOX);
      boxes.fillStyle(0x1a1434).fillRect(abX + 1, y + 1, ICON_BOX - 2, ICON_BOX - 2);
      boxes.fillStyle(0x43356e).fillRect(abX + 1, y + ICON_BOX - 2, ICON_BOX - 2, 1);
      return pixelText(this, abX + ICON_BOX + 5, y + 6, '');
    });
    const iconX = abX + ICON_BOX / 2;
    this.icons = {
      attack: this.add.sprite(iconX, STATS_Y + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
      special: this.add.image(iconX, STATS_Y + ICON_BOX + 2 + ICON_BOX / 2, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD),
    };
    this.info = this.add.container(0, 0, [bg, rule, this.nameText, this.blurb, typeLabel, skinLabel, this.typeName, this.typeRole, this.skinName, this.pips, ...labels, boxes, ...this.abilities, this.icons.attack, this.icons.special]);
  }

  /** Show the current class in its current type and skin. `pose` plays the hero's picked animation. */
  private refresh(pose: boolean, fresh: boolean): void {
    const cls = this.current;
    const look = lookOf(cls);
    const def = worn(cls, look);
    this.roster.forEach((t, i) => {
      const c = CLASSES[i];
      const d = worn(c);
      t.show(d.preview, d.accent).setPicked(i === this.cls);
    });
    this.stage.show(def.preview, def.accent, look.type.name, pose, fresh);

    // Class name, big when it fits.
    const textW = INFO_W - PAD * 2;
    this.nameText.setScale(2).setText(cls.name.toUpperCase());
    if (this.nameText.width > textW) this.nameText.setScale(1).setText(fitLine(this.probe, cls.name, textW)).setY(NAME_Y + 4);
    else this.nameText.setY(NAME_Y);
    this.blurb.setText(fitLine(this.probe, cls.blurb, textW));

    // Types: a tile for each, with the picked one's name and how it plays beside them.
    this.typeTiles = this.syncTiles(this.typeTiles, cls.types.length, TYPE_Y, (i) => this.pickType(i));
    cls.types.forEach((type, i) => {
      const d = worn(cls, type === look.type ? look : lastLookOf(cls, type));
      this.typeTiles[i].show(d.preview, d.accent).setPicked(type === look.type);
    });
    const typeX = this.besideTiles(cls.types.length);
    const typeW = INFO_W - PAD - typeX;
    this.typeName.setText(fitLine(this.probe, look.type.name, typeW)).setTint(look.type.accent);
    this.typeRole.setText(wrapText(this.probe, look.type.role, typeW, 2).join('\n'));
    const typeBlock = this.typeName.height + 3 + this.typeRole.height;
    const typeTop = Math.round(TYPE_Y + (TILE_H - typeBlock) / 2);
    this.typeName.setPosition(typeX, typeTop);
    this.typeRole.setPosition(typeX, typeTop + this.typeName.height + 3);

    // Stats (the type's) and abilities (named for the look).
    const pips = this.pips.clear();
    const px = PAD + 36;
    [def.stats.power, def.stats.speed, def.stats.range].forEach((value, i) => {
      const y = STATS_Y + 3 + i * LINE_H;
      for (let p = 0; p < 5; p++) {
        pips.fillStyle(0x0b0818).fillRect(px + p * 7, y, 7, 7);
        pips.fillStyle(p < value ? def.accent : 0x2a2150).fillRect(px + 1 + p * 7, y + 1, 5, 5);
        if (p < value) pips.fillStyle(0xffffff, 0.45).fillRect(px + 1 + p * 7, y + 1, 5, 1);
      }
    });
    const abW = INFO_W - PAD - this.abilities[0].x;
    this.abilities[0].setText(fitLine(this.probe, def.attack, abW));
    this.abilities[1].setText(fitLine(this.probe, def.special, abW));
    if (this.icons) {
      const { attack, special } = def.buttons;
      this.icons.attack.stop();
      this.icons.attack.setTexture(attack.texture, attack.frame);
      if (attack.anim) this.icons.attack.play(attack.anim);
      this.icons.special.setTexture(special.texture);
    }

    // Skins of the picked type: its own look first.
    const looks: Look[] = [{ type: look.type, skin: null }, ...(look.type.skins ?? []).map((skin) => ({ type: look.type, skin }))];
    this.skinTiles = this.syncTiles(this.skinTiles, looks.length, SKIN_Y, (i) => this.pickSkin(i));
    looks.forEach((l, i) => {
      const d = worn(cls, l);
      this.skinTiles[i].show(d.preview, d.accent).setPicked(l.skin === look.skin);
    });
    const skinX = this.besideTiles(looks.length);
    const skinW = INFO_W - PAD - skinX;
    this.skinName.setText(fitLine(this.probe, look.skin?.name ?? look.type.lookName ?? 'Classic', skinW)).setTint(def.accent);
    this.skinName.setPosition(skinX, Math.round(SKIN_Y + (TILE_H - this.skinName.height) / 2));
  }

  /** Keep `count` tiles in the info panel's row at `y`, making or removing tiles as needed. */
  private syncTiles(tiles: Tile[], count: number, y: number, pick: (i: number) => void): Tile[] {
    while (tiles.length > count) tiles.pop()!.destroy();
    while (tiles.length < count) {
      const i = tiles.length;
      const t = new Tile(this, () => pick(i));
      this.info.add(t);
      tiles.push(t);
    }
    tiles.forEach((t, i) => t.setPosition(PAD + LABEL_W + i * (TILE_W + TILE_GAP), y));
    return tiles;
  }

  /** Where text beside a row of `n` tiles starts. */
  private besideTiles(n: number): number {
    return PAD + LABEL_W + n * (TILE_W + TILE_GAP) + 4;
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
