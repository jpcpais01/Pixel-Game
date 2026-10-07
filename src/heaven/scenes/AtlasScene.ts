// The Atlas: Heaven Lands' map of its places, the first thing seen after the
// title. A sea of cloud at golden hour seen from above, the places adrift on
// it as floating islands, faint dotted sky-paths between them. Tap an island
// (or step through them with the arrow keys) and the view eases to it, it
// brightens in a ring of gold, and a slim card shows what it is, with Go and
// Together. Drag to pan, pinch or wheel to zoom.
//
// Everything is painted once (art/atlas.ts) and moved cheaply: cloud heaps
// drift under the islands and wisps over them at different speeds, islands
// bob, mist pours off their rims, birds pass, an airship crosses, lanterns
// rise from Hearthhome, motes float, the stars over Starwatch twinkle.

import Phaser from 'phaser';
import { PLACES, type Place } from '../places';
import { together, travel } from '../travel';
import { menuZoom } from '../../game/display';
import { PixelButton, pixelText } from '../../ui/widgets';
import { buildPixelFont } from '../../art/font';
import {
  ATLAS_BG,
  ATLAS_H,
  ATLAS_MARGIN,
  ATLAS_W,
  BACK_STYLE,
  CARD_TEXT,
  FALL_FRAMES,
  GO_STYLE,
  HEAPS,
  ISLE_INFO,
  TOGETHER_STYLE,
  WISPS,
  cardTexture,
  layoutIsles,
  nightAt,
  pillTexture,
  warmAtlas,
  type Isle,
  type IsleInfo,
} from '../art/atlas';

/** The last place picked, so the Atlas opens on it next time. */
const PICK_KEY = 'heaven-lands.atlasPick';
/** ms a frame spent painting the Atlas on its first opening. */
const BUILD_BUDGET = 12;

/** The card: widest it gets, its inner margin, its buttons' size. */
const CARD_W = 340;
const CARD_PAD = 8;
const BTN_W = 64;
const GO_H = 22;
const TOGETHER_H = 18;
/** Lore lines on the card, on short and tall screens (UI px tall). */
const LORE_LINES = 2;
const LORE_LINES_TALL = 3;
const TALL_VH = 300;

/** How far a press may move (screen px) and still be a tap. */
const TAP_SLOP = 10;
/** How near (frame px) a tap must land to an island's pixels. */
const TAP_REACH = 4;
/** Easing of the zoom and of the view gliding to the picked island (ms). */
const ZOOM_EASE = 70;
const FOLLOW_EASE = 220;

/** Islands bob this far (map px) over this long (ms). */
const BOB_PX = 1.5;
const BOB_MS = 7000;
/** A sky-path's dots are this far apart (map px), and keep this far from an island's pixels. */
const DOT_STEP = 6;
const DOT_CLEAR = 4;
/** How fast the glow runs along the sky-paths (map px/s). */
const PATH_WAVE = 34;

/** Cloud heaps drifting under the islands and wisps over them, and their speeds (map px/s). */
const LOW_HEAPS = 10;
const LOW_DRIFT = [1.6, 3.2];
const HIGH_WISPS = 4;
const HIGH_DRIFT = [5, 8];
const WISP_ALPHA = 0.5;
/** Golden motes floating in view, sky lanterns rising from Hearthhome, stars twinkling in the night. */
const MOTES = 22;
const LANTERNS = 5;
const LANTERN_LIFE = [22000, 30000];
const STARS = 28;
/** Glints (fountain spray, crystals) shown at once, and the wait between them (ms). */
const GLINTS = 5;
/** A flock of birds crosses every so often (ms between), at this speed (map px/s). */
const BIRD_GAP = [12000, 30000];
const BIRD_SPEED = 21;
/** The airship's crossing (ms, edge to edge) and its height on the map. */
const SHIP_MS = 160000;
const SHIP_Y = 206;

/** The screen's colour while the Atlas is first painted (the colour it fades in from). */
const WAIT_BG = 0x140e22;

const BW = ATLAS_W + ATLAS_MARGIN * 2;
const BH = ATLAS_H + ATLAS_MARGIN * 2;

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

interface Spot {
  isle: Isle;
  info: IsleInfo;
  root: Phaser.GameObjects.Container;
  halo: Phaser.GameObjects.Image;
  bright: Phaser.GameObjects.Image;
  falls: Phaser.GameObjects.Image[];
  glows: Phaser.GameObjects.Image[];
  phase: number;
  /** 0..1, eased toward 1 while picked: how lit its ring and brightening are. */
  lit: number;
}

interface Dot {
  img: Phaser.GameObjects.Image;
  /** How far along its path. */
  s: number;
}

interface Path {
  a: string;
  b: string;
  len: number;
  dots: Dot[];
}

interface Drifter {
  img: Phaser.GameObjects.Image;
  speed: number;
}

interface Floater {
  img: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  t: number;
  life: number;
  ph: number;
}

interface Flock {
  birds: { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; dx: number; dy: number; ph: number }[];
  x: number;
  y: number;
  vx: number;
  end: number;
}

/** Text cut into lines of at most `per` letters, words kept whole. */
function wrapWords(text: string, per: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (next.length <= per) line = next;
    else {
      if (line) lines.push(line);
      line = word.length > per ? word.slice(0, per) : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The lore in at most `max` lines: as many whole sentences as fit, or the
 * first sentence cut short with dots if even that won't.
 */
function loreLines(lore: string, per: number, max: number): string[] {
  const sentences = lore.split(/(?<=[.!?])\s+/);
  let best: string[] | null = null;
  for (let k = 1; k <= sentences.length; k++) {
    const lines = wrapWords(sentences.slice(0, k).join(' '), per);
    if (lines.length > max) break;
    best = lines;
  }
  if (best) return best;
  const lines = wrapWords(sentences[0], per).slice(0, max);
  const last = lines[max - 1] ?? '';
  lines[max - 1] = `${(last.length + 2 > per ? last.slice(0, Math.max(0, last.lastIndexOf(' '))) : last).replace(/[,.;:]$/, '')}..`;
  return lines;
}

function savedPick(): string | null {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

function savePick(id: string): void {
  try {
    localStorage.setItem(PICK_KEY, id);
  } catch {
    // Storage blocked: the Atlas opens on the first place next time.
  }
}

export class AtlasScene extends Phaser.Scene {
  private isles: Isle[] = [];
  private spots: Spot[] = [];
  private picked = 0;
  private built = false;
  private leaving = false;
  /** The room panel is open over the page. */
  private roomOpen = false;
  private clock = 0;

  /** The map, drawn by the main camera (panned and zoomed); the card and buttons by the UI camera. */
  private mapLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private layers!: {
    shadows: Phaser.GameObjects.Container;
    low: Phaser.GameObjects.Container;
    paths: Phaser.GameObjects.Container;
    isles: Phaser.GameObjects.Container;
    sky: Phaser.GameObjects.Container;
    high: Phaser.GameObjects.Container;
  };

  // The view: its centre on the map (map px) and zoom (screen px per map px).
  private cx = ATLAS_W / 2;
  private cy = ATLAS_H / 2;
  private z = 2;
  private zMin = 1;
  private zMax = 4;
  private uiZoom = 2;
  private follow: { x: number; y: number } | null = null;
  private vel = { x: 0, y: 0 };
  private zoomTo: { z: number; sx: number; sy: number; wx: number; wy: number } | null = null;

  // Touches: where each is, the gesture as it began, and whether it's still a tap.
  private touches = new Map<number, { x: number; y: number }>();
  private gesture: { z: number; d: number; wx: number; wy: number } | null = null;
  private tap: { x: number; y: number; t: number; ok: boolean } | null = null;
  private lastMove = 0;

  // The living bits.
  private paths: Path[] = [];
  private heaps: Drifter[] = [];
  private wisps: Drifter[] = [];
  private motes: Floater[] = [];
  private lanterns: Floater[] = [];
  private smoke: Floater[] = [];
  private stars: { img: Phaser.GameObjects.Image; ph: number; speed: number }[] = [];
  private glints: { img: Phaser.GameObjects.Image; spot: Spot | null; t: number; life: number }[] = [];
  private flock: Flock | null = null;
  private nextFlock = 0;
  private ship: { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; t: number } | null = null;
  private marker: Phaser.GameObjects.Image | null = null;

  // The card and the controls.
  private card!: Phaser.GameObjects.Container;
  private cardBg!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.BitmapText;
  private blurbText!: Phaser.GameObjects.BitmapText;
  private loreTexts: Phaser.GameObjects.BitmapText[] = [];
  private tags!: Phaser.GameObjects.Container;
  private goBtn!: PixelButton;
  private togetherBtn!: PixelButton;
  private back!: PixelButton;
  private waiting!: Phaser.GameObjects.BitmapText;
  /** The card's spot on screen (UI px), to keep the picked island clear of it. */
  private cardBox = new Phaser.Geom.Rectangle();

  constructor() {
    super('atlas');
  }

  create(): void {
    buildPixelFont(this);
    this.built = false;
    this.leaving = false;
    this.roomOpen = false;
    this.clock = 0;
    this.spots = [];
    this.paths = [];
    this.heaps = [];
    this.wisps = [];
    this.motes = [];
    this.lanterns = [];
    this.smoke = [];
    this.stars = [];
    this.glints = [];
    this.flock = null;
    this.nextFlock = rnd(4000, 9000);
    this.ship = null;
    this.marker = null;
    this.touches.clear();
    this.gesture = null;
    this.tap = null;
    this.follow = null;
    this.zoomTo = null;
    this.vel = { x: 0, y: 0 };

    this.isles = layoutIsles(PLACES);
    const saved = savedPick();
    this.picked = Math.max(0, this.isles.findIndex((i) => i.place.id === saved));

    // Dusk-dark while the Atlas is first painted; the clouds fade in out of it.
    const cam = this.cameras.main.setBackgroundColor(WAIT_BG);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0);
    // Whatever fades the map out (travel does, for Go and for a room) fades the controls with it.
    cam.on(Phaser.Cameras.Scene2D.Events.FADE_OUT_START, (_c: unknown, _fx: unknown, duration: number) => this.uiCam.fadeOut(duration, 12, 14, 26));

    this.mapLayer = this.add.container(0, 0);
    const layer = () => {
      const c = this.add.container(0, 0);
      this.mapLayer.add(c);
      return c;
    };
    this.layers = { shadows: layer(), low: layer(), paths: layer(), isles: layer(), sky: layer(), high: layer() };
    this.uiLayer = this.add.container(0, 0);
    cam.ignore(this.uiLayer);
    this.uiCam.ignore(this.mapLayer);

    this.buildUi();
    if (this.input.manager.pointersTotal < 2) this.input.addPointer(1);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);

    const kb = this.input.keyboard;
    const dir = (dx: number, dy: number) => () => this.pickToward(dx, dy);
    kb?.on('keydown-LEFT', dir(-1, 0));
    kb?.on('keydown-A', dir(-1, 0));
    kb?.on('keydown-RIGHT', dir(1, 0));
    kb?.on('keydown-D', dir(1, 0));
    kb?.on('keydown-UP', dir(0, -1));
    kb?.on('keydown-W', dir(0, -1));
    kb?.on('keydown-DOWN', dir(0, 1));
    kb?.on('keydown-S', dir(0, 1));
    kb?.on('keydown-ENTER', () => this.go());
    kb?.on('keydown-SPACE', () => this.go());
    kb?.on('keydown-T', () => this.openTogether());
    kb?.on('keydown-ESC', () => this.goBack());
    kb?.on('keydown-PLUS', () => this.stepZoom(1));
    kb?.on('keydown-MINUS', () => this.stepZoom(-1));

    this.layout();
    this.z = Phaser.Math.Clamp(this.uiZoom, this.zMin, this.zMax);
    const f = this.focusOf(this.picked);
    this.cx = f.x;
    this.cy = f.y;
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      cam.off(Phaser.Cameras.Scene2D.Events.FADE_OUT_START);
    });
    if (warmAtlas(this, BUILD_BUDGET)) this.buildMap();
  }

  // ---------------------------------------------------------------- Building

  private buildUi(): void {
    this.waiting = pixelText(this, 0, 0, '. . .', 0xfde6bc);
    this.back = new PixelButton(this, 'Back', 46, 18, BACK_STYLE, 'atlas_back', () => this.goBack());
    this.cardBg = this.add.image(0, 0, cardTexture(this, CARD_W, 56)).setOrigin(0);
    // Presses on the card stay on the card instead of dragging the map.
    this.cardBg.setInteractive();
    this.nameText = pixelText(this, 0, 0, '', CARD_TEXT.name);
    this.blurbText = pixelText(this, 0, 0, '', CARD_TEXT.blurb);
    this.loreTexts = [0, 1, 2].map(() => pixelText(this, 0, 0, '', CARD_TEXT.lore));
    this.tags = this.add.container(0, 0);
    this.goBtn = new PixelButton(this, 'Go', BTN_W, GO_H, GO_STYLE, 'atlas_go', () => this.go());
    this.togetherBtn = new PixelButton(this, 'Together', BTN_W, TOGETHER_H, TOGETHER_STYLE, 'atlas_together', () => this.openTogether());
    this.card = this.add.container(0, 0, [this.cardBg, this.nameText, this.blurbText, ...this.loreTexts, this.tags, this.goBtn, this.togetherBtn]);
    this.card.setVisible(false);
    this.uiLayer.add([this.waiting, this.card, this.back]);
  }

  /** Lay the map out once its textures are there. */
  private buildMap(): void {
    this.built = true;
    this.waiting.setVisible(false);
    this.card.setVisible(true);
    this.cameras.main.setBackgroundColor(ATLAS_BG).fadeIn(700, 20, 14, 34);
    this.uiCam.fadeIn(700, 20, 14, 34);
    this.mapLayer.addAt(this.add.image(-ATLAS_MARGIN, -ATLAS_MARGIN, 'atlas_sea').setOrigin(0), 0);

    // The islands, back to front, each with its shadow on the clouds.
    const order = this.isles.map((isle, i) => ({ isle, i })).sort((p, q) => p.isle.y - q.isle.y);
    const spots: Spot[] = new Array(this.isles.length);
    for (const { isle, i } of order) {
      const info = ISLE_INFO[isle.art];
      const shadow = this.add.image(isle.x + isle.lift * 0.5, isle.y + isle.lift, 'atlas_isles', `${isle.art}_sh`);
      this.layers.shadows.add(shadow);
      const root = this.add.container(isle.x, isle.y);
      const halo = this.add.image(0, 0, 'atlas_isles', `${isle.art}_halo`).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      const body = this.add.image(0, 0, 'atlas_isles', isle.art).setOrigin(info.ax / info.w, info.ay / info.h);
      const bright = this.add.image(0, 0, 'atlas_isles', isle.art).setOrigin(info.ax / info.w, info.ay / info.h).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      const falls = info.falls.map((f) => this.add.image(f.x - info.ax, f.y - info.ay, 'atlas_bits', 'fall0').setOrigin(0.5, 0).setAlpha(0.9));
      const glows = info.glows.map((g) =>
        this.add
          .image(g.x - info.ax, g.y - info.ay, 'atlas_bits', 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(g.tint)
          .setScale(g.r / 16)
          .setAlpha(0.4),
      );
      root.add([halo, ...falls, body, bright, ...glows]);
      this.layers.isles.add(root);
      spots[i] = { isle, info, root, halo, bright, falls, glows, phase: Math.random() * Math.PI * 2, lit: 0 };
    }
    this.spots = spots;
    this.makePaths();
    this.makeSky();
    this.showPicked();
  }

  /** Faint dotted sky-paths between linked islands, sagging a little like a rope between them. */
  private makePaths(): void {
    const seen = new Set<string>();
    for (const s of this.spots) {
      for (const to of s.isle.links) {
        const key = [s.isle.place.id, to].sort().join('|');
        const t = this.spots.find((o) => o.isle.place.id === to);
        if (!t || seen.has(key)) continue;
        seen.add(key);
        const ax = s.isle.x;
        const ay = s.isle.y + 4;
        const bx = t.isle.x;
        const by = t.isle.y + 4;
        const len = Math.hypot(bx - ax, by - ay);
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2 + len * 0.14;
        const path: Path = { a: s.isle.place.id, b: to, len: 0, dots: [] };
        let s0 = 0;
        let next = DOT_STEP / 2;
        let px = ax;
        let py = ay;
        const steps = Math.ceil(len);
        for (let k = 1; k <= steps; k++) {
          const u = k / steps;
          const x = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * bx;
          const y = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * by;
          s0 += Math.hypot(x - px, y - py);
          px = x;
          py = y;
          if (s0 < next) continue;
          next += DOT_STEP;
          if (this.nearIsle(x, y, DOT_CLEAR)) continue;
          const img = this.add.image(Math.round(x), Math.round(y), 'atlas_bits', 'dot').setAlpha(0.4);
          this.layers.paths.add(img);
          path.dots.push({ img, s: s0 });
        }
        path.len = s0;
        this.paths.push(path);
      }
    }
  }

  /** The drifting clouds, the stars, the motes, lanterns, birds and airship. */
  private makeSky(): void {
    for (let k = 0; k < LOW_HEAPS; k++) {
      const img = this.add.image(rnd(-ATLAS_MARGIN, ATLAS_W + ATLAS_MARGIN), rnd(ATLAS_H * 0.18, ATLAS_H), 'atlas_bits', HEAPS[k % HEAPS.length]);
      // Not into the night: heaps there would cover Starwatch's stars.
      if (nightAt(img.x, img.y) > 0.3) img.y = rnd(ATLAS_H * 0.45, ATLAS_H);
      this.layers.low.add(img);
      this.heaps.push({ img, speed: rnd(LOW_DRIFT[0], LOW_DRIFT[1]) });
    }
    for (let k = 0; k < HIGH_WISPS; k++) {
      const img = this.add.image(rnd(-ATLAS_MARGIN, ATLAS_W), rnd(ATLAS_H * 0.25, ATLAS_H * 0.95), 'atlas_bits', WISPS[k % WISPS.length]).setAlpha(WISP_ALPHA);
      this.layers.high.add(img);
      this.wisps.push({ img, speed: rnd(HIGH_DRIFT[0], HIGH_DRIFT[1]) });
    }
    // Stars that twinkle, where the night is deep.
    for (let k = 0, tries = 0; k < STARS && tries < 2000; tries++) {
      const x = rnd(-ATLAS_MARGIN, ATLAS_W + ATLAS_MARGIN);
      const y = rnd(-ATLAS_MARGIN, ATLAS_H * 0.45);
      if (nightAt(x, y) < 0.85 || this.nearIsle(x, y, 6)) continue;
      const img = this.add.image(Math.round(x), Math.round(y), 'atlas_bits', 'star0').setBlendMode(Phaser.BlendModes.ADD);
      this.layers.shadows.add(img);
      this.stars.push({ img, ph: Math.random() * 10, speed: rnd(0.6, 1.6) });
      k++;
    }
    for (let k = 0; k < MOTES; k++) {
      const img = this.add.image(0, 0, 'atlas_bits', k % 3 ? 'mote0' : 'mote1').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.layers.sky.add(img);
      this.motes.push({ img, x: 0, y: 0, t: -rnd(0, 6000), life: 0, ph: Math.random() * 6 });
    }
    for (let k = 0; k < LANTERNS; k++) {
      const glow = this.add.image(0, 0, 'atlas_bits', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050).setScale(0.6).setAlpha(0);
      const img = this.add.image(0, 0, 'atlas_bits', 'lantern').setAlpha(0);
      this.layers.sky.add([glow, img]);
      this.lanterns.push({ img, glow, x: 0, y: 0, t: -k * 5200 - rnd(0, 2000), life: 0, ph: Math.random() * 6 });
    }
    const chimney = this.spots.find((s) => s.info.smoke);
    if (chimney) {
      for (let k = 0; k < 3; k++) {
        const img = this.add.image(0, 0, 'atlas_bits', 'smoke').setAlpha(0);
        this.layers.sky.add(img);
        this.smoke.push({ img, x: 0, y: 0, t: -k * 1100, life: 3300, ph: k });
      }
    }
    for (let k = 0; k < GLINTS; k++) {
      const img = this.add.image(0, 0, 'atlas_bits', 'star0').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.layers.sky.add(img);
      this.glints.push({ img, spot: null, t: -rnd(0, 3000), life: 600 });
    }
    const shadow = this.add.image(0, 0, 'atlas_bits', 'shipsh');
    this.layers.shadows.add(shadow);
    const glow = this.add.image(0, 0, 'atlas_bits', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc060).setScale(0.35).setAlpha(0.5);
    const ship = this.add.image(0, 0, 'atlas_bits', 'ship0');
    this.layers.sky.add([ship, glow]);
    this.ship = { img: ship, shadow, glow, t: SHIP_MS * 0.3 };
    this.marker = this.add.image(0, 0, 'atlas_bits', 'marker');
    this.layers.sky.add(this.marker);
  }

  /** A map point lies on (or within `pad` px of) an island's pixels. */
  private nearIsle(x: number, y: number, pad: number): boolean {
    return this.spots.some((s) => this.onIsle(s, x, y, pad));
  }

  private onIsle(s: Spot, x: number, y: number, pad: number): boolean {
    const { info } = s;
    const lx = Math.floor(x - (s.root.x - info.ax));
    const ly = Math.floor(y - (s.root.y - info.ay));
    if (lx < -pad || ly < -pad || lx >= info.w + pad || ly >= info.h + pad) return false;
    for (let dy = -pad; dy <= pad; dy += 2) {
      for (let dx = -pad; dx <= pad; dx += 2) {
        const px = lx + dx;
        const py = ly + dy;
        if (px >= 0 && py >= 0 && px < info.w && py < info.h && info.mask[py * info.w + px]) return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Picking

  private pick(i: number): void {
    if (this.leaving || this.roomOpen || i === this.picked || i < 0) return;
    this.picked = i;
    savePick(this.isles[i].place.id);
    this.showPicked();
    // A quick breath on the card as it changes.
    this.tweens.killTweensOf(this.card);
    this.card.setAlpha(0.35);
    this.tweens.add({ targets: this.card, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
  }

  /** The nearest island in a direction from the picked one (arrows, WASD); round in turn if there's none that way. */
  private pickToward(dx: number, dy: number): void {
    const from = this.focusOf(this.picked);
    let best = -1;
    let bestScore = Infinity;
    this.isles.forEach((_isle, i) => {
      if (i === this.picked) return;
      const f = this.focusOf(i);
      const vx = f.x - from.x;
      const vy = f.y - from.y;
      const len = Math.hypot(vx, vy) || 1;
      const cos = (vx * dx + vy * dy) / len;
      if (cos < 0.35) return;
      const score = len / (cos * cos);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0) best = (this.picked + (dx + dy > 0 ? 1 : this.isles.length - 1)) % this.isles.length;
    this.pick(best);
  }

  /** Where the view centres on an island: the middle of its picture. */
  private focusOf(i: number): { x: number; y: number } {
    const isle = this.isles[i];
    const info = ISLE_INFO[isle.art];
    return info ? { x: isle.x, y: isle.y - info.ay + info.h * 0.42 } : { x: isle.x, y: isle.y };
  }

  /** Fill in the card for the picked place and glide the view to it. */
  private showPicked(): void {
    if (!this.isles.length) return;
    this.refreshCard();
    this.follow = this.focusOf(this.picked);
  }

  private refreshCard(): void {
    const place: Place = this.isles[this.picked].place;
    const { width, height } = this.scale;
    const u = this.uiZoom;
    const vw = width / u;
    const vh = height / u;
    const w = Math.min(CARD_W, Math.floor(vw) - 12);
    const narrow = w < 280;
    const textW = narrow ? w - CARD_PAD * 2 : w - CARD_PAD * 2 - BTN_W - 6;
    const per = Math.max(8, Math.floor((textW + 1) / 6));
    let y = CARD_PAD - 1;
    this.nameText.setText(place.name.toUpperCase().slice(0, per)).setPosition(CARD_PAD, y);
    // The tags: on the name's line when they fit there, else on a line of their own.
    this.tags.removeAll(true);
    const labels = [place.endless ? 'Endless' : '', place.dayNight ? 'Day and night' : ''].filter(Boolean);
    let tx = 0;
    for (const l of labels) {
      const t = pixelText(this, 4, 1, l, CARD_TEXT.tag);
      const pw = t.width + 8;
      const pill = this.add.image(tx, 0, pillTexture(this, pw)).setOrigin(0);
      t.setX(tx + 4);
      this.tags.add([pill, t]);
      tx += pw + 3;
    }
    const tagsW = Math.max(0, tx - 3);
    if (labels.length && CARD_PAD + this.nameText.width + 6 + tagsW <= CARD_PAD + textW) this.tags.setPosition(CARD_PAD + this.nameText.width + 6, y - 2);
    else if (labels.length) {
      y += 12;
      this.tags.setPosition(CARD_PAD, y - 2);
    }
    y += 12;
    this.blurbText.setText(place.blurb.toUpperCase().slice(0, per)).setPosition(CARD_PAD, y);
    y += 12;
    const lines = loreLines(place.lore.toUpperCase(), per, vh >= TALL_VH ? LORE_LINES_TALL : LORE_LINES);
    this.loreTexts.forEach((t, k) => {
      t.setText(lines[k] ?? '').setPosition(CARD_PAD, y + k * 10).setVisible(k < lines.length);
    });
    y += lines.length * 10 - 1;
    let h: number;
    if (narrow) {
      const by = y + 5;
      this.goBtn.place(w - CARD_PAD - BTN_W, by);
      this.togetherBtn.place(w - CARD_PAD - BTN_W * 2 - 4, by + (GO_H - TOGETHER_H) / 2);
      h = by + GO_H + CARD_PAD - 1;
    } else {
      this.goBtn.place(w - CARD_PAD - BTN_W, CARD_PAD - 2);
      this.togetherBtn.place(w - CARD_PAD - BTN_W, CARD_PAD - 2 + GO_H + 4);
      h = Math.max(y + CARD_PAD, CARD_PAD * 2 - 4 + GO_H + 4 + TOGETHER_H);
    }
    const can = place.together;
    this.togetherBtn.setEnabled(can && !this.roomOpen).setAlpha(can ? 1 : 0.45);
    this.cardBg.setTexture(cardTexture(this, w, h));
    const px = Math.round((vw - w) / 2);
    const py = Math.round(vh - h - 8);
    this.card.setPosition(px, py);
    this.cardBox.setTo(px, py, w, h);
  }

  // ---------------------------------------------------------------- Panning and zooming

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.leaving || this.roomOpen || over.length) return;
    this.touches.set(p.id, { x: p.x, y: p.y });
    this.follow = null;
    this.zoomTo = null;
    this.vel = { x: 0, y: 0 };
    this.tap = this.touches.size === 1 ? { x: p.x, y: p.y, t: this.time.now, ok: true } : null;
    this.beginGesture();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    if (!t || !p.isDown) return;
    t.x = p.x;
    t.y = p.y;
    if (this.tap && Math.hypot(p.x - this.tap.x, p.y - this.tap.y) > TAP_SLOP) this.tap.ok = false;
    const g = this.gesture;
    if (!g) return;
    const { mx, my, d } = this.touchMid();
    const now = this.time.now;
    const pcx = this.cx;
    const pcy = this.cy;
    if (this.touches.size > 1 && g.d > 0) this.z = Phaser.Math.Clamp((g.z * d) / g.d, this.zMin * 0.85, this.zMax * 1.2);
    const { width, height } = this.scale;
    this.cx = g.wx - (mx - width / 2) / this.z;
    this.cy = g.wy - (my - height / 2) / this.z;
    const dt = Math.max(1, now - this.lastMove);
    if (this.touches.size === 1) {
      // Keep the fling's speed (map px per ms), smoothed over the last few moves.
      this.vel.x = this.vel.x * 0.4 + ((this.cx - pcx) / dt) * 0.6;
      this.vel.y = this.vel.y * 0.4 + ((this.cy - pcy) / dt) * 0.6;
    }
    this.lastMove = now;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.touches.has(p.id)) return;
    this.touches.delete(p.id);
    const tap = this.tap;
    if (tap?.ok && this.touches.size === 0 && this.time.now - tap.t < 600) {
      this.vel = { x: 0, y: 0 };
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.tapAt(w.x, w.y);
    }
    this.tap = null;
    if (this.touches.size > 0) return this.beginGesture();
    this.gesture = null;
    if (this.time.now - this.lastMove > 80) this.vel = { x: 0, y: 0 };
    // Settle on a whole zoom, where the pixels are crisp.
    const whole = Phaser.Math.Clamp(Math.round(this.z), this.zMin, this.zMax);
    if (whole !== this.z) this.zoomAround(whole, this.scale.width / 2, this.scale.height / 2);
  }

  private onWheel(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void {
    if (this.leaving || this.roomOpen || over.length || dy === 0) return;
    this.follow = null;
    const base = this.zoomTo ? this.zoomTo.z : Math.round(this.z);
    this.zoomAround(Phaser.Math.Clamp(base + (dy < 0 ? 1 : -1), this.zMin, this.zMax), p.x, p.y);
  }

  /** The + and - keys: a whole step, about the middle of the screen. */
  private stepZoom(step: number): void {
    if (this.leaving || this.roomOpen) return;
    const base = this.zoomTo ? this.zoomTo.z : Math.round(this.z);
    this.zoomAround(Phaser.Math.Clamp(base + step, this.zMin, this.zMax), this.scale.width / 2, this.scale.height / 2);
  }

  /** Glide the zoom to `z`, keeping the map under screen point (sx, sy) where it is. */
  private zoomAround(z: number, sx: number, sy: number): void {
    const { width, height } = this.scale;
    const wx = this.cx + (sx - width / 2) / this.z;
    const wy = this.cy + (sy - height / 2) / this.z;
    this.zoomTo = { z, sx, sy, wx, wy };
    this.vel = { x: 0, y: 0 };
  }

  private beginGesture(): void {
    const { mx, my, d } = this.touchMid();
    const { width, height } = this.scale;
    this.gesture = { z: this.z, d, wx: this.cx + (mx - width / 2) / this.z, wy: this.cy + (my - height / 2) / this.z };
    this.lastMove = this.time.now;
  }

  private touchMid(): { mx: number; my: number; d: number } {
    const ts = [...this.touches.values()];
    if (!ts.length) return { mx: 0, my: 0, d: 0 };
    const mx = ts.reduce((s, t) => s + t.x, 0) / ts.length;
    const my = ts.reduce((s, t) => s + t.y, 0) / ts.length;
    const d = ts.length > 1 ? Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y) : 0;
    return { mx, my, d };
  }

  /** A tap on the map: the island under it (the nearest, if two overlap). */
  private tapAt(x: number, y: number): void {
    let best = -1;
    let bestD = Infinity;
    this.spots.forEach((s, i) => {
      if (!this.onIsle(s, x, y, TAP_REACH)) return;
      const f = this.focusOf(i);
      const d = Math.hypot(x - f.x, y - f.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return;
    if (best === this.picked) this.follow = this.focusOf(best);
    else this.pick(best);
  }

  /** Keep the view over the painted clouds, on whole screen pixels. */
  private clampView(): void {
    const { width, height } = this.scale;
    const hw = width / (2 * this.z);
    const hh = height / (2 * this.z);
    const clamp = (c: number, half: number, size: number) => (half * 2 >= size + ATLAS_MARGIN * 2 ? size / 2 : Phaser.Math.Clamp(c, half - ATLAS_MARGIN, size + ATLAS_MARGIN - half));
    this.cx = clamp(this.cx, hw, ATLAS_W);
    this.cy = clamp(this.cy, hh, ATLAS_H);
  }

  /** Where the view's centre goes so map point `p` sits in the middle of the open sky above the card. */
  private centreFor(p: { x: number; y: number }): { x: number; y: number } {
    const { height } = this.scale;
    const top = this.cardBox.height > 0 ? this.cardBox.y * this.uiZoom : height;
    const oy = Math.min(height / 2, top / 2 + 4 * this.uiZoom);
    return { x: p.x, y: p.y - (oy - height / 2) / this.z };
  }

  private moveView(dt: number): void {
    const { width, height } = this.scale;
    if (this.zoomTo) {
      const zt = this.zoomTo;
      this.z += (zt.z - this.z) * (1 - Math.exp(-dt / ZOOM_EASE));
      if (Math.abs(zt.z - this.z) < 0.01) {
        this.z = zt.z;
        this.zoomTo = null;
      }
      if (!this.follow) {
        this.cx = zt.wx - (zt.sx - width / 2) / this.z;
        this.cy = zt.wy - (zt.sy - height / 2) / this.z;
      }
    }
    if (this.follow && !this.gesture) {
      const want = this.centreFor(this.follow);
      const k = 1 - Math.exp(-dt / FOLLOW_EASE);
      this.cx += (want.x - this.cx) * k;
      this.cy += (want.y - this.cy) * k;
      if (Math.abs(want.x - this.cx) < 0.3 && Math.abs(want.y - this.cy) < 0.3 && !this.zoomTo) this.follow = null;
    } else if (!this.gesture && (this.vel.x || this.vel.y)) {
      this.cx += this.vel.x * dt;
      this.cy += this.vel.y * dt;
      const k = Math.exp(-dt / 240);
      this.vel.x *= k;
      this.vel.y *= k;
      if (Math.hypot(this.vel.x, this.vel.y) < 0.002) this.vel = { x: 0, y: 0 };
    }
    this.clampView();
    const cam = this.cameras.main;
    const z = this.z;
    cam.setZoom(z);
    // Whole screen pixels at a whole zoom, so the art stays crisp while it moves.
    const crisp = Math.abs(z - Math.round(z)) < 0.001;
    cam.setScroll(crisp ? Math.round(this.cx * z) / z - width / 2 : this.cx - width / 2, crisp ? Math.round(this.cy * z) / z - height / 2 : this.cy - height / 2);
  }

  /** The part of the map in view (map px). */
  private viewRect(): { x: number; y: number; w: number; h: number } {
    const { width, height } = this.scale;
    const w = width / this.z;
    const h = height / this.z;
    return { x: this.cx - w / 2, y: this.cy - h / 2, w, h };
  }

  // ---------------------------------------------------------------- Frame

  update(_time: number, dt: number): void {
    dt = Math.min(dt, 100);
    this.clock += dt;
    if (!this.built) {
      this.waiting.setAlpha(0.45 + 0.35 * Math.sin(this.clock / 300));
      if (warmAtlas(this, BUILD_BUDGET)) this.buildMap();
      return;
    }
    this.moveView(dt);
    this.animate(dt);
  }

  private animate(dt: number): void {
    const t = this.clock;
    const s = dt / 1000;
    // Islands bob gently, each in its own time; the picked one's ring and light swell in.
    this.spots.forEach((sp, i) => {
      const bob = Math.sin((t / BOB_MS) * Math.PI * 2 + sp.phase) * BOB_PX;
      sp.root.setPosition(sp.isle.x, sp.isle.y + bob);
      const want = i === this.picked ? 1 : 0;
      sp.lit += (want - sp.lit) * (1 - Math.exp(-dt / 220));
      const beat = 0.5 + 0.5 * Math.sin(t / 420);
      sp.halo.setAlpha(sp.lit * (0.5 + 0.3 * beat));
      sp.bright.setAlpha(sp.lit * (0.1 + 0.07 * beat));
      const f = Math.floor(t / 110);
      sp.falls.forEach((img, k) => img.setFrame(`fall${(f + k) % FALL_FRAMES}`));
      sp.glows.forEach((g, k) => g.setAlpha(0.32 + 0.1 * Math.sin(t / 700 + k * 1.7 + sp.phase) + sp.lit * 0.08));
    });
    const pickedSpot = this.spots[this.picked];
    if (this.marker && pickedSpot) {
      const info = pickedSpot.info;
      this.marker.setPosition(pickedSpot.root.x, pickedSpot.root.y - info.ay - 4 + Math.sin(t / 500) * 2).setAlpha(Math.min(1, pickedSpot.lit * 1.4));
    }

    // The sky-paths: a soft light runs along each, outward from the picked island.
    const pickedId = pickedSpot?.isle.place.id;
    for (const p of this.paths) {
      const fromB = p.b === pickedId;
      const span = p.len + 80;
      const wave = ((t / 1000) * PATH_WAVE) % span - 40;
      const hot = p.a === pickedId || fromB;
      for (const d of p.dots) {
        const along = fromB ? p.len - d.s : d.s;
        const near = Math.max(0, 1 - Math.abs(along - wave) / 18);
        d.img.setAlpha((hot ? 0.45 : 0.28) + near * near * (hot ? 0.5 : 0.3));
      }
    }

    const left = -ATLAS_MARGIN;
    const right = ATLAS_W + ATLAS_MARGIN;
    for (const d of [...this.heaps, ...this.wisps]) {
      d.img.x += d.speed * s;
      if (d.img.x - d.img.width / 2 > right) {
        d.img.x = left - d.img.width / 2;
        if (this.heaps.includes(d)) {
          d.img.y = rnd(ATLAS_H * 0.2, ATLAS_H);
          if (nightAt(d.img.x + 120, d.img.y) > 0.3) d.img.y = rnd(ATLAS_H * 0.45, ATLAS_H);
        } else d.img.y = rnd(ATLAS_H * 0.25, ATLAS_H * 0.95);
      }
    }

    for (const st of this.stars) {
      const v = Math.sin(t / 1000 * st.speed + st.ph);
      st.img.setFrame(v > 0.85 ? 'star2' : v > 0.2 ? 'star1' : 'star0').setAlpha(0.5 + 0.5 * Math.max(0, v));
    }

    this.stepMotes(dt);
    this.stepLanterns(dt);
    this.stepSmoke(dt);
    this.stepGlints(dt);
    this.stepBirds(dt);
    this.stepShip(dt, t);
  }

  /** Golden motes drifting up through whatever's in view, fading in and out. */
  private stepMotes(dt: number): void {
    const v = this.viewRect();
    for (const m of this.motes) {
      m.t += dt;
      if (m.t < 0) continue;
      const out = m.x < v.x - 20 || m.x > v.x + v.w + 20 || m.y < v.y - 20 || m.y > v.y + v.h + 20;
      if (m.life === 0 || m.t >= m.life || out) {
        // Somewhere new in view, after a little while.
        m.x = rnd(v.x, v.x + v.w);
        m.y = rnd(v.y, v.y + v.h);
        m.t = -rnd(0, 1500);
        m.life = rnd(5000, 9000);
        m.img.setAlpha(0);
        continue;
      }
      m.y -= (dt / 1000) * 4;
      m.x += Math.sin(m.t / 900 + m.ph) * (dt / 1000) * 3;
      const u = m.t / m.life;
      m.img.setPosition(m.x, m.y).setAlpha(Math.min(1, u * 4, (1 - u) * 3) * 0.85);
    }
  }

  /** Sky lanterns rising slowly from Hearthhome (or the first island) and fading high up. */
  private stepLanterns(dt: number): void {
    const home = this.spots.find((s) => s.isle.place.id === 'home') ?? this.spots[0];
    if (!home) return;
    for (const l of this.lanterns) {
      l.t += dt;
      if (l.t < 0) continue;
      if (l.life === 0 || l.t >= l.life) {
        l.x = home.isle.x + rnd(-28, 28);
        l.y = home.isle.y + rnd(-6, 8);
        l.t = l.life === 0 ? 0 : -rnd(2000, 9000);
        l.life = rnd(LANTERN_LIFE[0], LANTERN_LIFE[1]);
        if (l.t < 0) {
          l.img.setAlpha(0);
          l.glow?.setAlpha(0);
          continue;
        }
      }
      const u = l.t / l.life;
      const x = l.x + Math.sin(l.t / 2200 + l.ph) * 4 + u * 26;
      const y = l.y - u * 120;
      const a = Math.min(1, u * 8, (1 - u) * 3);
      l.img.setPosition(x, y).setAlpha(a);
      l.glow?.setPosition(x, y).setAlpha(a * (0.45 + 0.1 * Math.sin(l.t / 300 + l.ph)));
    }
  }

  /** Puffs of smoke from the cottage's chimney, leaning with the wind. */
  private stepSmoke(dt: number): void {
    const home = this.spots.find((s) => s.info.smoke);
    if (!home?.info.smoke) return;
    const ox = home.root.x - home.info.ax + home.info.smoke.x;
    const oy = home.root.y - home.info.ay + home.info.smoke.y;
    for (const p of this.smoke) {
      p.t += dt;
      if (p.t < 0) continue;
      if (p.t >= p.life) p.t -= p.life;
      const u = p.t / p.life;
      p.img.setPosition(ox + u * 6 + Math.sin(u * 5 + p.ph) * 0.8, oy - u * 12).setAlpha(Math.min(1, u * 6) * (1 - u) * 0.85);
    }
  }

  /** Glints winking on the islands' bright spots: fountain spray, crystals, the star in Starwatch's floor. */
  private stepGlints(dt: number): void {
    const withGlints = this.spots.filter((s) => s.info.glints.length);
    if (!withGlints.length) return;
    for (const g of this.glints) {
      g.t += dt;
      if (g.t < 0) continue;
      if (g.t >= g.life) {
        g.spot = null;
        g.t = -rnd(400, 2600);
        g.img.setVisible(false);
        continue;
      }
      if (!g.spot) {
        g.spot = withGlints[Math.floor(Math.random() * withGlints.length)];
        g.img.setData('at', g.spot.info.glints[Math.floor(Math.random() * g.spot.info.glints.length)]);
      }
      const at = g.img.getData('at') as { x: number; y: number };
      const sp = g.spot;
      const u = g.t / g.life;
      const f = u < 0.2 || u > 0.8 ? 0 : u < 0.4 || u > 0.6 ? 1 : 2;
      g.img
        .setVisible(true)
        .setFrame(`star${f}`)
        .setPosition(sp.root.x - sp.info.ax + at.x, sp.root.y - sp.info.ay + at.y);
    }
  }

  /** Now and then a little flock crosses the view, its shadows sliding over the clouds below. */
  private stepBirds(dt: number): void {
    if (!this.flock) {
      this.nextFlock -= dt;
      if (this.nextFlock > 0) return;
      this.nextFlock = rnd(BIRD_GAP[0], BIRD_GAP[1]);
      const v = this.viewRect();
      const ltr = Math.random() < 0.6;
      const n = 3 + Math.floor(Math.random() * 3);
      const birds: Flock['birds'] = [];
      for (let k = 0; k < n; k++) {
        // A loose V: each bird a little behind and to one side of the one before.
        const side = k % 2 ? 1 : -1;
        const row = Math.ceil(k / 2);
        const shadow = this.add.image(0, 0, 'atlas_bits', 'bird1').setTint(0x2a1c4a).setAlpha(0.28);
        const img = this.add.image(0, 0, 'atlas_bits', 'bird0').setFlipX(!ltr);
        this.layers.shadows.add(shadow);
        this.layers.sky.add(img);
        birds.push({ img, shadow, dx: -row * 7 * (ltr ? 1 : -1), dy: side * row * 4, ph: Math.random() * 4 });
      }
      const y = v.y + v.h * rnd(0.15, 0.75);
      this.flock = { birds, x: ltr ? v.x - 30 : v.x + v.w + 30, y, vx: ltr ? BIRD_SPEED : -BIRD_SPEED, end: ltr ? v.x + v.w + 60 : v.x - 60 };
      return;
    }
    const fl = this.flock;
    fl.x += (fl.vx * dt) / 1000;
    fl.y += Math.sin(this.clock / 1700) * 0.04;
    for (const b of fl.birds) {
      const x = fl.x + b.dx;
      const y = fl.y + b.dy;
      const flap = Math.floor(this.clock / 170 + b.ph) % 6;
      b.img.setPosition(x, y).setFrame(flap < 3 ? `bird${flap % 2}` : 'bird1');
      b.shadow.setPosition(x + 16, y + 32);
    }
    if ((fl.vx > 0 && fl.x > fl.end) || (fl.vx < 0 && fl.x < fl.end)) {
      for (const b of fl.birds) {
        b.img.destroy();
        b.shadow.destroy();
      }
      this.flock = null;
    }
  }

  /** The airship drifting across the whole map, its propeller turning, its lantern lit. */
  private stepShip(dt: number, t: number): void {
    const sh = this.ship;
    if (!sh) return;
    sh.t = (sh.t + dt) % SHIP_MS;
    const u = sh.t / SHIP_MS;
    const x = -ATLAS_MARGIN - 40 + (ATLAS_W + ATLAS_MARGIN * 2 + 80) * u;
    const y = SHIP_Y + Math.sin(u * Math.PI * 2) * 22 + Math.sin(t / 1300) * 1.2;
    sh.img.setPosition(x, y).setFrame(Math.floor(t / 140) % 2 ? 'ship1' : 'ship0');
    sh.glow.setPosition(x + 6, y + 3).setAlpha(0.4 + 0.1 * Math.sin(t / 260));
    sh.shadow.setPosition(x + 34, y + 58);
  }

  // ---------------------------------------------------------------- Leaving

  private goBack(): void {
    if (this.leaving || this.roomOpen) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220, 12, 14, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('home'));
  }

  private go(): void {
    if (this.leaving || this.roomOpen || !this.built) return;
    const place = this.isles[this.picked].place;
    this.leaving = true;
    savePick(place.id);
    travel(this, place.id);
  }

  /** Go with friends: the room panel opens over the page, and the map rests until it closes. */
  private openTogether(): void {
    if (this.leaving || this.roomOpen || !this.built) return;
    const place = this.isles[this.picked].place;
    if (!place.together) return;
    savePick(place.id);
    this.roomOpen = true;
    this.input.enabled = false;
    this.touches.clear();
    this.gesture = null;
    this.tap = null;
    together(this, place.id, () => {
      this.roomOpen = false;
      if (!this.leaving) this.input.enabled = true;
      this.refreshCard();
    });
  }

  // ---------------------------------------------------------------- Layout

  private layout(): void {
    const { width, height } = this.scale;
    const u = menuZoom(width, height);
    this.uiZoom = u;
    this.uiCam.setSize(width, height).setZoom(u);
    // From the painted clouds just filling the screen to twice the menus' size.
    this.zMin = Math.max(1, Math.ceil(Math.max(width / BW, height / BH)));
    this.zMax = Math.max(this.zMin + 1, u * 2);
    this.z = Phaser.Math.Clamp(Math.round(this.z), this.zMin, this.zMax);
    const vw = width / u;
    const vh = height / u;
    this.back.place(6, 6);
    this.waiting.setPosition(Math.round((vw - this.waiting.width) / 2), Math.round(vh / 2));
    this.refreshCard();
    if (this.built) this.follow = this.focusOf(this.picked);
  }
}
