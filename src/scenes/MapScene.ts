import Phaser from 'phaser';
import { sound } from '../audio';
import { bakedCanvas, pixelCanvas } from '../art/canvas';
import { INK, MAP_CELL, RING_M, RING_MID, TREK_T, diskRow, groundMapBase, mapIconSheet, reliefMap, ringFrame, stampCrowns, type MapBase } from '../art/mapArt';
import { BUILD_PX, paintBuilds, type BuiltSource } from '../art/mapBuilds';
import { DPR as D, menuZoom } from '../game/display';
import { activeSeason } from '../game/season';
import { settings } from '../game/settings';
import { trek, type Fire } from '../game/trek';
import { session } from '../net/session';
import { BUTTON_GOLD, PixelButton } from '../ui/widgets';
import { isPainted, type ArenaDef } from '../world/arenas';
import { NATURALIST_CAMP } from '../world/clearing';
import { TREE_SHAPE } from '../world/common';
import { FG_CX, FG_FOOT, FG_TOP } from '../world/forgeLayout';
import type { ForestEdits } from '../world/forestEdits';
import { CHUNK } from '../world/forestGen';
import { CELL, COLS, PLOT_H, PLOT_W, PLOT_X, PLOT_Y, ROWS } from '../world/homeLayout';
import { TP_CX, TP_FOOT, TP_TOP } from '../world/sanctumLayout';
import { POOL } from '../world/sunken';
import { TrekMap } from '../world/trekMap';
import type { UIScene } from './UIScene';
import type { WorldScene } from './WorldScene';

// The round map in the top-left corner of every arena, in a framed rim: the
// arena drawn small round the hero (see art/mapArt.ts), the hero's arrow in
// the middle, friends in their colours, monsters as red dots, bosses by their
// rank (one too far off waits on the rim, the way to it), and the places
// worth finding (the keepers' halls, the fountain). A tap folds it smaller,
// or opens it out again; the pause menu can switch it off.
//
// In the Everwood it is the explorer's map: the forest on parchment, drawn
// only where the hero has walked (game/trek.ts), its places pinned as
// they're found. The scroll button beside it (or Tab) opens the whole map:
// drag to look round, zoom in and out, and tap a campfire rested at, or a
// shrine found, to travel back to it.

/** The minimap's width across against the screen's short side, and folded. */
const MINI = 0.25;
const FOLDED = 0.6;
/** Its frame's outside from the screen's top-left corner, device px (as the HUD's other corners). */
const EDGE = 10;
/** ms of painting an arena's map gets a frame, and the Everwood's tiles (more while its whole map is open). */
const BUILD_MS = 3;
const TILE_MS = 2.5;
const TILE_MS_OPEN = 10;
/** Most monsters marked at once. */
const MAX_MOBS = 80;
/** How near (device px) a tap must land to a campfire or shrine to pick it. */
const PICK = 22;
/** Remembered: the minimap folded. */
const FOLD_KEY = 'pixel-battle.minimap';

type Img = Phaser.GameObjects.Image;

/** An arena's finished map (its relief), kept for the next visit; the Home's is made again as it's built. */
const arenaMaps = new Map<string, { canvas: HTMLCanvasElement; w: number; h: number }>();

/** The places of note in an arena, pinned on its map. */
function arenaPins(id: string): { icon: string; x: number; y: number }[] {
  switch (id) {
    case 'clearing': {
      const pins = [
        { icon: 'temple', x: TP_CX, y: (TP_TOP + TP_FOOT) / 2 },
        { icon: 'anvil', x: FG_CX, y: (FG_TOP + FG_FOOT) / 2 },
        { icon: 'butterfly', x: NATURALIST_CAMP.x, y: NATURALIST_CAMP.y - 20 },
      ];
      if (activeSeason()) pins.push({ icon: 'pumpkin', x: 506, y: 436 });
      return pins;
    }
    case 'garden':
      return [{ icon: 'fountain', x: POOL.x, y: POOL.y }];
    default:
      return [];
  }
}

/** A pool of icons drawn from the map's sheet, given out afresh each frame. */
class Icons {
  private list: Img[] = [];
  private used = 0;

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  /** An icon with its middle at (x, y), `scale` device px per pixel. */
  put(frame: string, x: number, y: number, scale: number, depth = 0, tint?: number): Img {
    let im = this.list[this.used];
    if (!im) {
      im = this.scene.add.image(0, 0, 'mapicons', frame).setOrigin(0);
      this.list.push(im);
    }
    this.used++;
    im.setFrame(frame).setScale(scale).setVisible(true).setAlpha(1).setDepth(this.depth + depth);
    im.setPosition(Math.round(x) - Math.floor(im.width / 2) * scale, Math.round(y) - Math.floor(im.height / 2) * scale);
    if (tint === undefined) im.clearTint();
    else im.setTint(tint);
    return im;
  }

  end(): void {
    for (let i = this.used; i < this.list.length; i++) this.list[i].setVisible(false);
  }

  hide(): void {
    this.begin();
    this.end();
  }

  destroy(): void {
    for (const im of this.list) im.destroy();
    this.list = [];
  }
}

export class MapScene extends Phaser.Scene {
  private world!: WorldScene;
  private arena!: ArenaDef;
  private trekMap: TrekMap | null = null;

  // ---- the minimap
  private rect = new Phaser.Geom.Rectangle();
  /** Device px per map pixel, and the minimap's size in map pixels. */
  private px = 2;
  private cw = 0;
  private ch = 0;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private img!: Img;
  /** The rim round it, painted once a size (art/mapArt.ts ringFrame). */
  private frame!: Img;
  private frameTex: Phaser.Textures.CanvasTexture | null = null;
  private zone!: Phaser.GameObjects.Zone;
  private icons!: Icons;
  private drawn = '';
  private folded = false;
  /** The arena's map while it's painted, and once it is. */
  private job: Generator<void, void, void> | null = null;
  private full: { canvas: HTMLCanvasElement; w: number; h: number } | null = null;
  /** The Home's: kept to be drawn in relief again as it's built. */
  /** The Home's grounds in relief, without what's built: the plot's builds are laid over it as they change. */
  private homeRelief: HTMLCanvasElement | null = null;
  private homeSig = '';
  private homeT = 0;
  /** The Everwood's builds, drawn over the explorer's map. */
  private built: BuiltLayer | null = null;
  private fullVersion = 0;
  /** The hero's last spot and the way they last walked, for the arrow. */
  private last = { x: NaN, y: NaN, dir: 4 };
  private regionT = 0;
  /** Each row of the minimap's disk: its first and last pixel. */
  private spans: [number, number][] = [];
  /** The left column's bottom, for the HUD (see leftBottom). */
  private bottom = 0;
  /** The Everwood's places in the minimap's window, found again when it moves a chunk. */
  private pins: { icon: string; x: number; y: number; fire?: Fire }[] = [];
  private pinsKey = '';

  // ---- the map button (the Everwood) and the whole map
  private mapButton: { g: Phaser.GameObjects.Graphics; zone: Phaser.GameObjects.Zone; r: Phaser.Geom.Rectangle; pressed: boolean } | null = null;
  private big: BigMap | null = null;

  constructor() {
    super('map');
  }

  create(): void {
    this.world = this.scene.get('world') as WorldScene;
    this.arena = this.world.arenaDef;
    this.cameras.main.setOrigin(0, 0);
    this.drawn = '';
    this.pinsKey = '';
    this.big = null;
    // The scene is started afresh for each arena: the last one's scroll button went with it.
    this.mapButton = null;
    this.last = { x: NaN, y: NaN, dir: 4 };
    this.homeRelief = null;
    this.homeSig = '';
    ensureIcons(this);
    try {
      this.folded = localStorage.getItem(FOLD_KEY) === '1';
    } catch {
      this.folded = false;
    }

    const forest = this.world.everwood;
    this.trekMap = forest ? new TrekMap(forest.gen) : null;
    this.built = forest ? new BuiltLayer(() => this.world.everwood?.edits ?? null) : null;
    if (forest) trek.load();
    // A phone may close the game without warning: keep the map (and where the hero stands) when the page is hidden.
    const hidden = () => document.visibilityState === 'hidden' && this.trekMap && trek.save();
    document.addEventListener('visibilitychange', hidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', hidden));
    this.full = forest ? null : (arenaMaps.get(this.arena.id) ?? null);
    this.job = forest || this.full ? null : this.buildArena();

    this.img = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(2);
    this.frame = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(2.5);
    this.icons = new Icons(this, 3);
    this.zone = this.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.fold(!this.folded));

    if (forest) {
      const g = this.add.graphics().setDepth(1);
      const zone = this.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
      const mb: NonNullable<MapScene['mapButton']> = (this.mapButton = { g, zone, r: new Phaser.Geom.Rectangle(), pressed: false });
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        mb.pressed = true;
        this.drawMapButton();
      });
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        mb.pressed = false;
        this.drawMapButton();
      });
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (!mb.pressed) return;
        mb.pressed = false;
        this.drawMapButton();
        this.openBig();
      });
      const kb = this.input.keyboard;
      kb?.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, true).on('down', () => (this.big ? this.closeBig() : this.openBig()));
      kb?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false).on('down', () => this.closeBig());
    }

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    // The pause menu's Minimap row: the scroll button moves into the minimap's corner when it's off.
    let shown = settings.values.minimap;
    const unwatch = settings.watch((s) => {
      if (s.minimap === shown) return;
      shown = s.minimap;
      this.layout();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unwatch();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      if (this.big) this.closeBig();
      if (this.trekMap) trek.save();
      this.trekMap = null;
      this.job = null;
      if (this.tex) this.textures.remove(this.tex);
      if (this.frameTex) this.textures.remove(this.frameTex);
      this.tex = this.frameTex = null;
    });
  }

  private get ui(): UIScene | null {
    const ui = this.scene.get('ui') as UIScene | null;
    return ui && this.scene.isActive('ui') ? ui : null;
  }

  private fold(on: boolean): void {
    this.folded = on;
    try {
      localStorage.setItem(FOLD_KEY, on ? '1' : '0');
    } catch {
      // Not remembered: no storage here.
    }
    this.layout();
  }

  /** How far down the screen's left side the minimap and the Everwood's scroll button reach, device px (0: nothing there): the HUD's buffs and stats stand below. */
  get leftBottom(): number {
    return this.bottom;
  }

  /** Where the minimap goes: a disk in its rim in the top-left corner, the Everwood's scroll button tucked by its lower right. */
  private layout(): void {
    const { width, height } = this.scale;
    const s = Math.round(Math.max(34 * D, Math.min(width, height) * 0.075));
    const p = (this.px = Math.max(1, Math.round(menuZoom(width, height) / 2)));
    let d = Math.min(width, height) * MINI;
    if (this.folded) d *= FOLDED;
    // An even number of map pixels across, so the hero stands at the very middle.
    const n = Math.max(16, Math.floor(d / p / 2) * 2);
    this.cw = this.ch = n;
    // The rim's inked outside (6 map pixels out) touches the corner's margin.
    this.rect.setTo(EDGE * D + 6 * p, EDGE * D + 6 * p, n * p, n * p);
    this.spans = Array.from({ length: n }, (_, j) => diskRow(n, j));

    if (this.tex) this.textures.remove(this.tex);
    this.tex = this.textures.createCanvas(`minimap_${Date.now()}`, n, n);
    this.img.setTexture(this.tex!.key).setPosition(this.rect.x, this.rect.y).setScale(p);
    if (this.frameTex) this.textures.remove(this.frameTex);
    const ring = ringFrame(n, !!this.trekMap);
    this.frameTex = this.textures.addCanvas(`minimapring_${Date.now()}`, canvasOf(ring.px, ring.w, ring.w));
    this.frame.setTexture(this.frameTex!.key).setPosition(this.rect.x - RING_M * p, this.rect.y - RING_M * p).setScale(p);
    this.drawn = '';
    const z = 4 * D;
    this.zone.setPosition(this.rect.x - z, this.rect.y - z).setSize(this.rect.width + z * 2, this.rect.height + z * 2);
    this.zone.input!.hitArea.setTo(0, 0, this.rect.width + z * 2, this.rect.height + z * 2);

    const on = settings.values.minimap;
    let bottom = on ? this.rect.bottom + 6 * p : 0;
    if (this.mapButton) {
      const b = Math.round(s * 0.92);
      // Its top-left corner on a circle just outside the rim, at the lower right: the rest of it falls clear.
      const out = (n / 2 + 6) * p + 4 * D;
      if (on) this.mapButton.r.setTo(Math.round(this.rect.centerX + out * Math.SQRT1_2), Math.round(this.rect.centerY + out * Math.SQRT1_2), b, b);
      else this.mapButton.r.setTo(EDGE * D, EDGE * D, b, b);
      const r = this.mapButton.r;
      this.mapButton.zone.setPosition(r.x - 5 * D, r.y - 5 * D).setSize(r.width + 10 * D, r.height + 10 * D);
      this.mapButton.zone.input!.hitArea.setTo(0, 0, r.width + 10 * D, r.height + 10 * D);
      this.drawMapButton();
      bottom = Math.max(bottom, r.bottom);
    }
    this.bottom = bottom;
    this.big?.layout();
  }

  /** The scroll button beside the Everwood's minimap, that opens the whole map. */
  private drawMapButton(): void {
    const mb = this.mapButton;
    if (!mb) return;
    const { x, y, width: s } = mb.r;
    const g = mb.g.clear();
    g.fillStyle(0x0a0c1c, mb.pressed ? 0.6 : 0.42).fillRoundedRect(x, y, s, s, s * 0.22);
    g.lineStyle(2 * D, 0xb8c4ff, 0.45).strokeRoundedRect(x, y, s, s, s * 0.22);
    // A rolled map: parchment between two rods, a red route across it.
    const u = s / 24;
    const push = mb.pressed ? u : 0;
    g.fillStyle(0xead7a8, 1).fillRect(x + 6 * u, y + 7 * u + push, 12 * u, 10 * u);
    g.fillStyle(0xcfb47e, 1).fillRect(x + 6 * u, y + 15 * u + push, 12 * u, 2 * u);
    g.fillStyle(0x8a6036, 1).fillRect(x + 4 * u, y + 5 * u + push, 16 * u, 3 * u);
    g.fillRect(x + 4 * u, y + 16 * u + push, 16 * u, 3 * u);
    g.fillStyle(0xc89a5a, 1).fillRect(x + 4 * u, y + 5 * u + push, 16 * u, u);
    g.fillStyle(0xd04a2a, 1);
    for (const [px, py] of [[8, 13], [10, 12], [12, 11], [14, 10]]) g.fillRect(x + px * u, y + py * u + push, u, u);
    g.fillRect(x + 14.5 * u, y + 9 * u + push, 2 * u, 2 * u);
  }

  // ---------------------------------------------------------------- an arena's map

  /** Paint this arena's map a little each frame: its ground, its trees, then the relief from what can be walked. */
  private *buildArena(): Generator<void, void, void> {
    const a = this.arena;
    const W = a.world?.w ?? a.ground.w;
    const H = a.world?.h ?? a.ground.h;
    const cw = Math.ceil(W / MAP_CELL);
    const ch = Math.ceil(H / MAP_CELL);
    let base: MapBase;
    if (isPainted(a.ground)) {
      // A painted arena's own pictures, scaled down.
      let got: MapBase | null = null;
      while (!(got = paintedBase(this, a, cw, ch))) yield;
      base = got;
    } else {
      const g = a.ground;
      const made = yield* groundMapBase(g, g.w, g.h);
      base = made.w === cw && made.h === ch ? made : padBase(made, cw, ch);
    }
    const trees = a.scenery().trees.map((t) => ({ x: t.x, y: t.y, kind: t.kind, r: TREE_SHAPE[t.kind]?.canopyR ?? 30 }));
    stampCrowns(base, trees);
    yield;
    // The Home's plot counts as open ground here: what's built on it is drawn as itself (art/mapBuilds.ts), not sunk as a blocked patch.
    const home = a.id === 'home';
    const open = (x: number, y: number) => home && x >= PLOT_X && y >= PLOT_Y && x < PLOT_X + PLOT_W && y < PLOT_Y + PLOT_H;
    const walk = new Uint8Array(cw * ch);
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const x = i * MAP_CELL + 4;
        const y = j * MAP_CELL + 4;
        walk[j * cw + i] = open(x, y) || a.walkable(x, y) ? 1 : 0;
      }
      if ((j & 15) === 15) yield;
    }
    const relief = canvasOf(reliefMap(base, walk), cw, ch);
    if (home) {
      this.homeRelief = relief;
      this.homeSig = '';
      this.followHome(Infinity);
    } else {
      this.full = { canvas: relief, w: cw, h: ch };
      this.fullVersion++;
      arenaMaps.set(a.id, this.full);
    }
  }

  /** The Home's map follows what's built on it: floors, walls, roofs and things are laid over the grounds as they change. */
  private followHome(dt: number): void {
    const plot = this.world.homePlot;
    if (!this.homeRelief || !plot) return;
    this.homeT += dt;
    if (this.homeT < 1000) return;
    this.homeT = 0;
    const sig = plot.layout.encode();
    if (sig === this.homeSig) return;
    this.homeSig = sig;
    const { width: w, height: h } = this.homeRelief;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(this.homeRelief, 0, 0);
    ctx.drawImage(canvasOf(paintBuilds(plot.layout, 0, 0, COLS, ROWS), COLS * BUILD_PX, ROWS * BUILD_PX), PLOT_X / MAP_CELL, PLOT_Y / MAP_CELL);
    this.full = { canvas: c, w, h };
    this.fullVersion++;
  }

  // ---------------------------------------------------------------- every frame

  update(_time: number, dt: number): void {
    const world = this.world;
    if (!world.scene.isActive() && !world.scene.isPaused()) return;
    const hero = world.player;
    if (!hero) return;

    if (this.job) {
      const t0 = performance.now();
      while (this.job && performance.now() - t0 < BUILD_MS) if (this.job.next().done) this.job = null;
    }
    if (this.arena.id === 'home') this.followHome(dt);

    // The way the hero walked last, for the arrow.
    const mx = hero.x - this.last.x;
    const my = hero.y - this.last.y;
    if (Number.isFinite(mx) && Math.hypot(mx, my) > 0.4) this.last.dir = (Math.round(Math.atan2(mx, -my) / (Math.PI / 4)) + 8) % 8;
    this.last.x = hero.x;
    this.last.y = hero.y;

    const tm = this.trekMap;
    const forest = world.everwood;
    if (tm && forest) {
      if (!world.heroDown) trek.walk(hero.x, hero.y, dt);
      this.regionT += dt;
      if (this.regionT > 1000) {
        this.regionT = 0;
        const s = forest.gen.sample(hero.x, hero.y);
        const w = forest.gen.region(hero.x, hero.y, s.wx, s.wy);
        trek.region(w.ci, w.cj, hero.x, hero.y);
      }
      tm.sync();
      tm.work(this.big ? TILE_MS_OPEN : TILE_MS, !!this.big || this.game.loop.frame % 6 === 0);
    }

    if (this.big) {
      this.big.update();
      this.hideMini();
      return;
    }
    if (this.ui?.covered) {
      this.hideMini();
      return;
    }
    if (!settings.values.minimap) {
      // Switched off in the pause menu: only the Everwood's scroll button stays, to open the whole map.
      this.hideMini();
      if (this.mapButton) {
        this.mapButton.g.setVisible(true);
        this.mapButton.zone.input!.enabled = true;
      }
      return;
    }
    this.showMini();
  }

  private hideMini(): void {
    this.img.setVisible(false);
    this.frame.setVisible(false);
    this.icons.hide();
    this.zone.input!.enabled = false;
    if (this.mapButton) {
      this.mapButton.g.setVisible(false);
      this.mapButton.zone.input!.enabled = false;
    }
  }

  private showMini(): void {
    this.img.setVisible(true);
    this.frame.setVisible(true);
    this.zone.input!.enabled = true;
    if (this.mapButton) {
      this.mapButton.g.setVisible(true);
      this.mapButton.zone.input!.enabled = true;
    }
    const hero = this.world.player;
    const tm = this.trekMap;
    const { cw, ch } = this;
    const hx = hero.x / MAP_CELL;
    const hy = (hero.y - 8) / MAP_CELL;
    // The hero at the middle, but an arena's map keeps inside the arena (or sits in the middle when smaller than the window) rather than show the dark past its edge.
    let x0 = Math.round(hx - cw / 2);
    let y0 = Math.round(hy - ch / 2);
    if (!tm && this.full) {
      x0 = this.full.w <= cw ? Math.round((this.full.w - cw) / 2) : Phaser.Math.Clamp(x0, 0, this.full.w - cw);
      y0 = this.full.h <= ch ? Math.round((this.full.h - ch) / 2) : Phaser.Math.Clamp(y0, 0, this.full.h - ch);
    }
    const key = `${x0},${y0},${tm ? `${tm.version},${this.built?.version}` : this.fullVersion}`;
    if (key !== this.drawn && this.tex) {
      this.drawn = key;
      const ctx = this.tex.context;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = tm ? '#dcc495' : '#0b0a14';
      ctx.fillRect(0, 0, cw, ch);
      if (tm) {
        drawTrek(ctx, tm, x0, y0, cw, ch);
        this.built?.draw(ctx, x0, y0, cw, ch);
      } else if (this.full) {
        const sx = Math.max(0, x0);
        const sy = Math.max(0, y0);
        const sw = Math.min(this.full.w, x0 + cw) - sx;
        const sh = Math.min(this.full.h, y0 + ch) - sy;
        if (sw > 0 && sh > 0) ctx.drawImage(this.full.canvas, sx, sy, sw, sh, sx - x0, sy - y0, sw, sh);
      }
      // Round: what's outside the disk is cleared, under the rim.
      this.spans.forEach(([a, b], j) => {
        if (a > 0) ctx.clearRect(0, j, a, 1);
        if (b < cw - 1) ctx.clearRect(b + 1, j, cw - b - 1, 1);
      });
      this.tex.refresh();
    }

    // What's on it.
    const p = this.px;
    const r = this.rect;
    const sx = (wx: number) => r.x + (wx / MAP_CELL - x0) * p;
    const sy = (wy: number) => r.y + (wy / MAP_CELL - y0) * p;
    const cx = r.centerX;
    const cy = r.centerY;
    const rad = (cw / 2) * p;
    const inside = (x: number, y: number) => Math.hypot(x - cx, y - cy) <= rad - 3 * p;
    /** (x, y) pulled in toward the middle to `at` px from it, if it lies further out. */
    const within = (x: number, y: number, at: number): [number, number] => {
      const d = Math.hypot(x - cx, y - cy);
      return d <= at ? [x, y] : [cx + ((x - cx) / d) * at, cy + ((y - cy) / d) * at];
    };
    const icons = this.icons;
    icons.begin();
    if (tm) {
      this.findPins(x0, y0);
      for (const pin of this.pins) {
        const x = sx(pin.x);
        const y = sy(pin.y);
        if (inside(x, y)) icons.put(pin.icon, x, y, p, 0);
      }
    } else {
      for (const pin of arenaPins(this.arena.id)) {
        const x = sx(pin.x);
        const y = sy(pin.y);
        if (inside(x, y)) icons.put(pin.icon, x, y, p, 0);
      }
    }
    let mobs = 0;
    for (const sp of this.world.spawnerList) {
      for (const m of sp.monsters) {
        if (!m.alive) continue;
        const rank = m.stats.rank;
        const x = sx(m.x);
        const y = sy(m.y);
        if (rank) {
          // A boss is never lost off the edge: it waits on the rim, the way to it.
          const [bx, by] = inside(x, y) ? [x, y] : within(x, y, rad + RING_MID * p);
          icons.put(rank, bx, by, p, 2);
        } else if (inside(x, y) && mobs++ < MAX_MOBS) icons.put('mob', x, y, p, 1);
      }
    }
    for (const mate of this.world.mates) {
      const [x, y] = within(sx(mate.x), sy(mate.y), rad - 4 * p);
      icons.put('mate', x, y, p, 3, mate.accent).setAlpha(mate.alive ? 1 : 0.5);
    }
    icons.put(`me${this.last.dir}`, sx(hero.x), sy(hero.y - 8), p, 4).setAlpha(this.world.heroDown ? 0.5 : 1);
    icons.end();
  }

  /** The Everwood's places in and round the minimap's window, found again when it moves into another chunk. */
  private findPins(x0: number, y0: number): void {
    const tm = this.trekMap!;
    const c0 = Math.floor((x0 * MAP_CELL) / CHUNK) - 1;
    const r0 = Math.floor((y0 * MAP_CELL) / CHUNK) - 1;
    const c1 = Math.floor(((x0 + this.cw) * MAP_CELL) / CHUNK) + 1;
    const r1 = Math.floor(((y0 + this.ch) * MAP_CELL) / CHUNK) + 1;
    const key = `${c0},${r0},${c1},${r1},${trek.version},${this.world.everwood?.edits?.version ?? 0}`;
    if (key === this.pinsKey) return;
    this.pinsKey = key;
    this.pins = everwoodPins(this.world, tm, c0 * CHUNK, r0 * CHUNK, (c1 + 1) * CHUNK, (r1 + 1) * CHUNK);
  }

  // ---------------------------------------------------------------- the whole map

  private openBig(): void {
    // Not over the pause menu, or a counter or the bag.
    if (this.big || !this.trekMap || this.ui?.covered || !this.scene.isActive('world')) return;
    this.big = new BigMap(this, this.world, this.trekMap, this.built, () => this.closeBig(), () => this.last.dir);
    sound.cardFlip(0);
    // Alone, the world waits while the map is read; online it can't.
    if (!session.active) {
      this.scene.pause('world');
      if (this.scene.isActive('ui')) this.scene.pause('ui');
    }
  }

  private closeBig(): void {
    if (!this.big) return;
    this.big.destroy();
    this.big = null;
    this.drawn = '';
    if (this.scene.isPaused('world')) this.scene.resume('world');
    if (this.scene.isPaused('ui')) this.scene.resume('ui');
  }
}

// ---------------------------------------------------------------- helpers

/** The icon sheet, made once. */
function ensureIcons(scene: Phaser.Scene): void {
  if (scene.textures.exists('mapicons')) return;
  const s = mapIconSheet();
  const tex = scene.textures.addCanvas('mapicons', pixelCanvas(s.w, s.h, s.px))!;
  for (const [id, [x, y, w, h]] of Object.entries(s.frames)) tex.add(id, 0, x, y, w, h);
}

function canvasOf(px: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
  // Finished art: a plain texture, without Phaser reading it back off the GPU (see game/bakedTextures.ts).
  return bakedCanvas(c);
}

/** A base widened to the whole world, where the world reaches past the ground. */
function padBase(b: MapBase, w: number, h: number): MapBase {
  const rgb = new Uint8ClampedArray(w * h * 3);
  const raised = new Uint8Array(w * h);
  for (let j = 0; j < Math.min(h, b.h); j++) {
    rgb.set(b.rgb.subarray(j * b.w * 3, j * b.w * 3 + Math.min(w, b.w) * 3), j * w * 3);
    raised.set(b.raised.subarray(j * b.w, j * b.w + Math.min(w, b.w)), j * w);
  }
  return { w, h, rgb, raised };
}

/**
 * A painted arena's map colours: its own pictures scaled down to a pixel a
 * cell (glowing layers added on), read back once. Null until its textures
 * are in.
 */
function paintedBase(scene: Phaser.Scene, a: ArenaDef, w: number, h: number): MapBase | null {
  if (!isPainted(a.ground)) return null;
  const layers = a.ground.layers;
  if (layers.some((l) => !scene.textures.exists(l.key))) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0a0814';
  ctx.fillRect(0, 0, w, h);
  for (const l of layers) {
    const src = scene.textures.get(l.key).getSourceImage() as HTMLCanvasElement;
    ctx.globalCompositeOperation = l.glow ? 'lighter' : 'source-over';
    ctx.globalAlpha = l.glow ? 0.55 : 1;
    ctx.drawImage(src, l.x / MAP_CELL, l.y / MAP_CELL, src.width / MAP_CELL, src.height / MAP_CELL);
  }
  const d = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Uint8ClampedArray(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = d[i * 4];
    rgb[i * 3 + 1] = d[i * 4 + 1];
    rgb[i * 3 + 2] = d[i * 4 + 2];
  }
  return { w, h, rgb, raised: new Uint8Array(w * h) };
}

/** Draw the Everwood's map from map pixel (x0, y0), w x h, onto `ctx`. */
function drawTrek(ctx: CanvasRenderingContext2D, tm: TrekMap, x0: number, y0: number, w: number, h: number): void {
  for (let cy = Math.floor(y0 / TREK_T); cy <= Math.floor((y0 + h - 1) / TREK_T); cy++) {
    for (let cx = Math.floor(x0 / TREK_T); cx <= Math.floor((x0 + w - 1) / TREK_T); cx++) {
      const t = tm.tile(cx, cy);
      if (t) ctx.drawImage(t, cx * TREK_T - x0, cy * TREK_T - y0);
    }
  }
}

const POI_ICON: Record<string, string> = { shrine: 'shrine', chest: 'chest', ruins: 'ruins', stones: 'stones', elder: 'elder', fairy: 'fairy', lookout: 'lookout', glade: 'glade', bog: 'bog', glowcaps: 'glowcaps', brambles: 'brambles', camp: 'camp' };

/** The build tray's part that is a campfire, and a travel id for one at cell (cx, cy) (below zero, apart from the forest's own). */
const BUILT_FIRE = 'campfire';
const builtFireId = (cx: number, cy: number): number => -1 - (cx * 100000 + cy);
const builtFires = (world: WorldScene): boolean => !!world.everwood?.edits?.things.some((t) => t.id === BUILT_FIRE);

/** The Everwood's pins in a box: its places where walked, the Stag's secrets, and the campfires the player built. */
function everwoodPins(world: WorldScene, tm: TrekMap, x0: number, y0: number, x1: number, y1: number): { icon: string; x: number; y: number; fire?: Fire }[] {
  const out: { icon: string; x: number; y: number; fire?: Fire }[] = [];
  const known = (x: number, y: number) => trek.known(Math.floor(x / 64), Math.floor(y / 64));
  for (const p of tm.places(x0, y0, x1, y1)) {
    if (!known(p.x, p.y)) continue;
    if (p.kind === 'campfire') out.push({ icon: trek.fires.has(p.id) ? 'campfire' : 'ember', x: p.x, y: p.y - 4, fire: trek.fires.has(p.id) ? p : undefined });
    // A shrine is a place to travel to as soon as it's found.
    else out.push({ icon: POI_ICON[p.kind], x: p.x, y: p.y - 6, fire: p.kind === 'shrine' ? p : undefined });
  }
  for (const s of trek.secrets) if (s.x >= x0 && s.x < x1 && s.y >= y0 && s.y < y1) out.push({ icon: s.kind, x: s.x, y: s.y });
  // Campfires the player built are places to travel to at once, with no need to rest at them; everything else they built is drawn on the map itself (BuiltLayer).
  const edits = world.everwood?.edits;
  if (edits) {
    for (let cy = Math.floor(y0 / CHUNK); cy < Math.ceil(y1 / CHUNK); cy++) {
      for (let cx = Math.floor(x0 / CHUNK); cx < Math.ceil(x1 / CHUNK); cx++) {
        for (const t of edits.thingsInChunk(cx, cy)) {
          if (t.id === BUILT_FIRE) out.push({ icon: 'campfire', x: t.x * 16 + 8, y: t.y * 16 + 8, fire: { id: builtFireId(t.x, t.y), x: t.x * 16 + 8, y: t.y * 16 + 12 } });
        }
      }
    }
  }
  // Travel points on top of the rest.
  return out.sort((a, b) => Number(!!a.fire) - Number(!!b.fire));
}

/** Most chunks of builds kept painted, and building cells to a chunk's side. */
const KEEP_BUILT = 400;
const CELLS = CHUNK / CELL;

/**
 * What the player has built in the Everwood, drawn over the explorer's map:
 * each chunk with anything in it painted once (art/mapBuilds.ts, washed
 * toward the parchment) and kept until something is built or cleared.
 */
class BuiltLayer {
  private tiles = new Map<number, HTMLCanvasElement | null>();
  private seen = -1;
  /** Chunks with floors laid in them. */
  private floored = new Set<number>();

  constructor(private edits: () => ForestEdits | null) {}

  /** Changes with every build, so the maps showing it draw again. */
  get version(): number {
    return this.edits()?.version ?? 0;
  }

  /** Draw the builds over a map window whose top-left is map pixel (x0, y0). */
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number): void {
    const e = this.edits();
    if (!e) return;
    if (e.version !== this.seen) {
      this.seen = e.version;
      this.tiles.clear();
      this.floored.clear();
      for (const k of e.floors.keys()) this.floored.add(Math.floor(Math.floor(k / 65536) / CELLS) * 4096 + Math.floor((k % 65536) / CELLS));
    }
    for (let cy = Math.floor(y0 / TREK_T); cy <= Math.floor((y0 + h - 1) / TREK_T); cy++) {
      for (let cx = Math.floor(x0 / TREK_T); cx <= Math.floor((x0 + w - 1) / TREK_T); cx++) {
        const t = this.tile(e, cx, cy);
        if (t) ctx.drawImage(t, cx * TREK_T - x0, cy * TREK_T - y0);
      }
    }
  }

  private tile(e: ForestEdits, cx: number, cy: number): HTMLCanvasElement | null {
    const k = cx * 4096 + cy;
    if (this.tiles.has(k)) return this.tiles.get(k)!;
    // Things from the chunks round it too: a tree's crown reaches over the edge.
    const things = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) things.push(...e.thingsInChunk(cx + i, cy + j));
    let t: HTMLCanvasElement | null = null;
    if (things.length || e.wallsInChunk(cx, cy).length || this.floored.has(k)) {
      const src: BuiltSource = { floorAt: (x, y) => e.floorAt(x, y), wallAt: (x, y) => e.wallAt(x, y), roofAt: () => 0, things };
      t = canvasOf(paintBuilds(src, cx * CELLS, cy * CELLS, CELLS, CELLS, true), TREK_T, TREK_T);
    }
    this.tiles.set(k, t);
    if (this.tiles.size > KEEP_BUILT) this.tiles.delete(this.tiles.keys().next().value!);
    return t;
  }
}

// ---------------------------------------------------------------- the explorer's map, whole

/**
 * The whole explorer's map, open over the screen as a scroll of parchment
 * between two rods: dragged to look round, zoomed in and out, the names of
 * the woods written where they were walked, and every campfire rested at
 * and shrine found a place to travel back to.
 */
class BigMap {
  private shade: Phaser.GameObjects.Graphics;
  private paper: Phaser.GameObjects.Graphics;
  private img: Img;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private zone: Phaser.GameObjects.Zone;
  private icons: Icons;
  private names: Phaser.GameObjects.BitmapText[] = [];
  private title: Phaser.GameObjects.BitmapText;
  private hint: Phaser.GameObjects.BitmapText;
  private buttons: Phaser.GameObjects.Graphics;
  private close: Phaser.GameObjects.Zone;
  private plus: Phaser.GameObjects.Zone;
  private minus: Phaser.GameObjects.Zone;
  private travel: PixelButton | null = null;
  private sheet = new Phaser.Geom.Rectangle();
  /** World point in the middle of the sheet, and device px per map pixel. */
  private cx: number;
  private cy: number;
  private level = 1;
  private bz = 4;
  private vw = 0;
  private vh = 0;
  private drawn = '';
  private pins: { icon: string; x: number; y: number; fire?: Fire }[] = [];
  private pinsKey = '';
  private picked: Fire | null = null;
  private drag: { id: number; x: number; y: number; cx: number; cy: number; moved: number } | null = null;
  private zoom = 4;
  private btn = { close: new Phaser.Geom.Rectangle(), plus: new Phaser.Geom.Rectangle(), minus: new Phaser.Geom.Rectangle() };
  private wheel: (p: Phaser.Input.Pointer, o: unknown, dx: number, dy: number) => void;

  constructor(
    private scene: MapScene,
    private world: WorldScene,
    private tm: TrekMap,
    private built: BuiltLayer | null,
    private onClose: () => void,
    private heading: () => number,
  ) {
    const add = scene.add;
    this.cx = world.player.x;
    this.cy = world.player.y;
    this.shade = add.graphics().setDepth(100);
    this.paper = add.graphics().setDepth(101);
    this.img = add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(102);
    this.icons = new Icons(scene, 104);
    this.title = add.bitmapText(0, 0, 'pixel', 'THE EVERWOOD').setLetterSpacing(-1).setOrigin(0.5, 0.5).setTint(0xfff0c8).setDepth(110);
    this.hint = add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(0.5, 1).setTint(0x3b2a1e).setDepth(110);
    this.buttons = add.graphics().setDepth(110);
    this.zone = add.zone(0, 0, 1, 1).setOrigin(0).setDepth(103).setInteractive();
    const button = (on: () => void) => {
      const z = add.zone(0, 0, 1, 1).setOrigin(0).setDepth(111).setInteractive({ useHandCursor: true });
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, on);
      return z;
    };
    this.close = button(() => this.onClose());
    this.plus = button(() => this.setLevel(this.level + 1));
    this.minus = button(() => this.setLevel(this.level - 1));

    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.drag) return;
      this.drag = { id: p.id, x: p.x, y: p.y, cx: this.cx, cy: this.cy, moved: 0 };
    });
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.move, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.up, this);
    this.wheel = (_p, _o, _dx, dy) => this.setLevel(this.level + (dy < 0 ? 1 : -1));
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.wheel);
    this.layout();
  }

  private move(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.id) return;
    d.moved = Math.max(d.moved, Math.hypot(p.x - d.x, p.y - d.y));
    this.cx = d.cx - ((p.x - d.x) / this.bz) * MAP_CELL;
    this.cy = d.cy - ((p.y - d.y) / this.bz) * MAP_CELL;
  }

  private up(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || p.id !== d.id) return;
    this.drag = null;
    if (d.moved < 8 * D) this.tap(p.x, p.y);
  }

  /** A tap on the sheet: picks the travel point nearest it (a campfire rested at or built, a shrine found) if close enough. */
  private tap(x: number, y: number): void {
    let best: Fire | null = null;
    let near = PICK * D;
    for (const pin of this.pins) {
      if (!pin.fire) continue;
      const d = Math.hypot(this.toX(pin.x) - x, this.toY(pin.y) - y);
      if (d < near) {
        near = d;
        best = pin.fire;
      }
    }
    this.picked = best;
    this.layoutTravel();
  }

  private setLevel(n: number): void {
    const next = Phaser.Math.Clamp(n, 0, 2);
    if (next === this.level) return;
    this.level = next;
    this.layout();
  }

  private toX(wx: number): number {
    return this.sheet.x + (wx / MAP_CELL - this.x0) * this.bz;
  }

  private toY(wy: number): number {
    return this.sheet.y + (wy / MAP_CELL - this.y0) * this.bz;
  }

  private get x0(): number {
    return Math.round(this.cx / MAP_CELL - this.vw / 2);
  }

  private get y0(): number {
    return Math.round(this.cy / MAP_CELL - this.vh / 2);
  }

  layout(): void {
    const { width, height } = this.scene.scale;
    const zoom = (this.zoom = menuZoom(width, height));
    this.bz = [Math.max(1, Math.round(zoom / 2)), zoom, zoom * 2][this.level];
    const m = Math.round(Math.min(width, height) * 0.05);
    const rod = zoom * 6;
    this.vw = Math.floor((width - m * 2) / this.bz);
    this.vh = Math.floor((height - m * 2 - rod * 2) / this.bz);
    this.sheet.setTo(Math.round((width - this.vw * this.bz) / 2), Math.round((height - this.vh * this.bz) / 2), this.vw * this.bz, this.vh * this.bz);
    if (this.tex) this.scene.textures.remove(this.tex);
    this.tex = this.scene.textures.createCanvas(`trekview_${Date.now()}`, this.vw, this.vh);
    this.img.setTexture(this.tex!.key).setPosition(this.sheet.x, this.sheet.y).setScale(this.bz);
    this.drawn = '';
    this.pinsKey = '';

    this.shade.clear().fillStyle(0x05040a, 0.78).fillRect(0, 0, width, height);
    this.zone.setPosition(0, 0).setSize(width, height);
    this.zone.input!.hitArea.setTo(0, 0, width, height);
    this.drawPaper(rod);

    const s = Math.round(Math.max(34 * D, Math.min(width, height) * 0.075));
    const r = this.sheet;
    // Top left: the pause and sound buttons keep the top-right corner.
    this.btn.close.setTo(r.x + zoom * 3, r.y + zoom * 3, s, s);
    this.btn.plus.setTo(r.right - s - zoom * 3, r.bottom - s * 2 - zoom * 5, s, s);
    this.btn.minus.setTo(r.right - s - zoom * 3, r.bottom - s - zoom * 3, s, s);
    for (const [z, b] of [
      [this.close, this.btn.close],
      [this.plus, this.btn.plus],
      [this.minus, this.btn.minus],
    ] as const) {
      z.setPosition(b.x - 4 * D, b.y - 4 * D).setSize(b.width + 8 * D, b.height + 8 * D);
      z.input!.hitArea.setTo(0, 0, b.width + 8 * D, b.height + 8 * D);
    }
    this.drawButtons();
    this.title.setScale(zoom).setPosition(Math.round(width / 2), Math.round(r.y - rod / 2));
    this.hint.setScale(Math.max(1, Math.round(zoom * 0.75))).setPosition(Math.round(width / 2), r.bottom - zoom * 3);
    this.layoutTravel();
  }

  /** The scroll: two wooden rods with turned ends above and below the sheet, a dark rim round the paper. */
  private drawPaper(rod: number): void {
    const g = this.paper.clear();
    const r = this.sheet;
    const z = this.zoom;
    g.fillStyle(0x000000, 0.35).fillRect(r.x - z * 2, r.y - z, r.width + z * 6, r.height + z * 6);
    g.fillStyle(0x3b2a1e, 1).fillRect(r.x - z, r.y - z, r.width + z * 2, r.height + z * 2);
    for (const y of [r.y - rod, r.bottom]) {
      const x0 = r.x - z * 6;
      const w = r.width + z * 12;
      g.fillStyle(0x2a180c, 1).fillRect(x0 - z, y - z, w + z * 2, rod + z * 2);
      g.fillStyle(0x8a6036, 1).fillRect(x0, y, w, rod);
      g.fillStyle(0xc89a5a, 1).fillRect(x0, y + z, w, z);
      g.fillStyle(0xe8c078, 1).fillRect(x0, y + z, w, Math.max(1, Math.round(z / 2)));
      g.fillStyle(0x5a3a1e, 1).fillRect(x0, y + rod - z * 2, w, z * 2);
      // Turned knobs at the ends.
      for (const kx of [x0 - z * 4, x0 + w]) {
        g.fillStyle(0x2a180c, 1).fillRect(kx - z, y - z * 2, z * 6, rod + z * 4);
        g.fillStyle(0xc8901e, 1).fillRect(kx, y - z, z * 4, rod + z * 2);
        g.fillStyle(0xffd84a, 1).fillRect(kx + z, y - z, z, rod + z * 2);
        g.fillStyle(0x8a5a10, 1).fillRect(kx + z * 3, y - z, z, rod + z * 2);
      }
    }
  }

  private drawButtons(): void {
    const g = this.buttons.clear();
    for (const b of [this.btn.close, this.btn.plus, this.btn.minus]) {
      g.fillStyle(0x2a1a10, 0.85).fillRoundedRect(b.x, b.y, b.width, b.height, b.width * 0.22);
      g.lineStyle(2 * D, 0xe8c078, 0.6).strokeRoundedRect(b.x, b.y, b.width, b.height, b.width * 0.22);
    }
    const u = this.btn.close.width / 24;
    const c = this.btn.close;
    g.lineStyle(3 * u, 0xfff0c8, 0.95);
    g.lineBetween(c.x + 8 * u, c.y + 8 * u, c.x + 16 * u, c.y + 16 * u);
    g.lineBetween(c.x + 16 * u, c.y + 8 * u, c.x + 8 * u, c.y + 16 * u);
    const p = this.btn.plus;
    const m = this.btn.minus;
    g.fillStyle(this.level < 2 ? 0xfff0c8 : 0x8a7a60, 1);
    g.fillRect(p.x + 7 * u, p.y + 11 * u, 10 * u, 2 * u);
    g.fillRect(p.x + 11 * u, p.y + 7 * u, 2 * u, 10 * u);
    g.fillStyle(this.level > 0 ? 0xfff0c8 : 0x8a7a60, 1);
    g.fillRect(m.x + 7 * u, m.y + 11 * u, 10 * u, 2 * u);
  }

  /** The Travel button under the sheet, while a travel point is picked. */
  private layoutTravel(): void {
    this.travel?.destroy();
    this.travel = null;
    const f = this.picked;
    this.hint.setText(f ? '' : trek.fires.size || builtFires(this.world) || this.pins.some((p) => p.fire) ? 'TAP A CAMPFIRE OR SHRINE TO TRAVEL' : 'REST AT A CAMPFIRE TO TRAVEL BACK LATER');
    if (!f) return;
    const z = this.zoom;
    const b = new PixelButton(this.scene, 'TRAVEL HERE', 64, 16, BUTTON_GOLD, 'trektravel', () => {
      this.onClose();
      this.world.travel(f.x, f.y + 18);
    });
    b.setScale(z).setDepth(112);
    b.place(Math.round(this.scene.scale.width / 2 - 32 * z), Math.round(this.sheet.bottom - 20 * z));
    this.travel = b;
  }

  update(): void {
    const tm = this.tm;
    const key = `${this.x0},${this.y0},${tm.version},${this.built?.version},${this.bz}`;
    if (key !== this.drawn && this.tex) {
      this.drawn = key;
      const ctx = this.tex.context;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#dcc495';
      ctx.fillRect(0, 0, this.vw, this.vh);
      drawTrek(ctx, tm, this.x0, this.y0, this.vw, this.vh);
      this.built?.draw(ctx, this.x0, this.y0, this.vw, this.vh);
      // A faint grid of the chunks, as a surveyor would rule it.
      ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},0.07)`;
      for (let c = Math.ceil(this.x0 / TREK_T) * TREK_T; c < this.x0 + this.vw; c += TREK_T * 2) ctx.fillRect(c - this.x0, 0, 1, this.vh);
      for (let r = Math.ceil(this.y0 / TREK_T) * TREK_T; r < this.y0 + this.vh; r += TREK_T * 2) ctx.fillRect(0, r - this.y0, this.vw, 1);
      this.tex.refresh();
    }

    // Pins and names, found again as the view moves a chunk.
    const c0 = Math.floor((this.x0 * MAP_CELL) / CHUNK);
    const r0 = Math.floor((this.y0 * MAP_CELL) / CHUNK);
    const c1 = Math.floor(((this.x0 + this.vw) * MAP_CELL) / CHUNK);
    const r1 = Math.floor(((this.y0 + this.vh) * MAP_CELL) / CHUNK);
    const pk = `${c0},${r0},${c1},${r1},${trek.version},${this.world.everwood?.edits?.version ?? 0}`;
    if (pk !== this.pinsKey) {
      this.pinsKey = pk;
      this.pins = everwoodPins(this.world, tm, c0 * CHUNK, r0 * CHUNK, (c1 + 1) * CHUNK, (r1 + 1) * CHUNK);
    }
    const r = this.sheet;
    const inside = (x: number, y: number) => x >= r.x + 4 && x <= r.right - 4 && y >= r.y + 4 && y <= r.bottom - 4;
    const s = Math.max(1, Math.min(this.zoom, this.bz));
    const icons = this.icons;
    icons.begin();
    const t = this.scene.time.now;
    for (const pin of this.pins) {
      const x = this.toX(pin.x);
      const y = this.toY(pin.y);
      if (!inside(x, y)) continue;
      const im = icons.put(pin.icon, x, y, s, pin.fire ? 1 : 0);
      if (pin.fire && this.picked?.id === pin.fire.id) im.setAlpha(0.65 + Math.sin(t * 0.008) * 0.35);
    }
    for (const mate of this.world.mates) {
      const x = this.toX(mate.x);
      const y = this.toY(mate.y);
      if (inside(x, y)) icons.put('mate', x, y, s, 2, mate.accent);
    }
    const hero = this.world.player;
    const hx = this.toX(hero.x);
    const hy = this.toY(hero.y - 8);
    if (inside(hx, hy)) icons.put(`me${this.heading()}`, hx, hy, s, 3);
    icons.end();

    // The woods' names, where they were walked.
    const fz = Math.max(1, Math.round(this.zoom * (this.level === 0 ? 0.5 : 0.75)));
    let n = 0;
    const gen = this.world.everwood?.gen;
    if (gen) {
      for (const reg of trek.regions.values()) {
        const x = this.toX(reg.x);
        const y = this.toY(reg.y);
        if (!inside(x, y)) continue;
        let label = this.names[n];
        if (!label) {
          label = this.scene.add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(0.5).setTint(0x3b2a1e).setDepth(103.5);
          this.names.push(label);
        }
        const name = gen.regionName(reg.ci, reg.cj).toUpperCase();
        if (label.text !== name) label.setText(name);
        label.setScale(fz).setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(0.8);
        n++;
      }
    }
    for (let i = n; i < this.names.length; i++) this.names[i].setVisible(false);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_MOVE, this.move, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.up, this);
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.wheel);
    this.travel?.destroy();
    for (const o of [this.shade, this.paper, this.img, this.zone, this.title, this.hint, this.buttons, this.close, this.plus, this.minus, ...this.names]) o.destroy();
    this.icons.destroy();
    if (this.tex) this.scene.textures.remove(this.tex);
    this.tex = null;
  }
}
