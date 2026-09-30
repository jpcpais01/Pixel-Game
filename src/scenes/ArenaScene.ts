import Phaser from 'phaser';
import { STRIP_H } from '../art/ground';
import { warmWorldMap } from '../art/arenaLoader';
import { LANDMARKS, SEA_COLOUR } from '../art/worldMap';
import { menuZoom } from '../game/display';
import { characterById } from '../game/characters';
import { collection } from '../game/collection';
import { ARENAS, PREVIEW_H, arenaById, isPainted, lastArena, rememberArena, warmArena, type ArenaDef, type PreviewSprite } from '../world/arenas';
import { LABELS, LEGS, MAP_H, MAP_W, REALM_NAME, legRoad, placeFor, realm, standAt, type Place, type Pt } from '../world/realm';
import { GroundStreamer } from '../world/GroundStreamer';
import { buildId } from '../diagnostics';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText, type PanelStyle } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import { openOnlineForm } from '../ui/onlineForm';

/** The window onto the picked arena, at the top of its panel. */
const WIN_W = 158;
const WIN_H = PREVIEW_H;
const PANEL_W = 172;
const PANEL_H = 206;
/** ms per frame spent building an arena for its window (most of the work is in a worker; this is uploading). */
const WARM_BUDGET = 10;
/** Longest Play waits for the picked arena to finish loading before the world takes over and finishes it itself. */
const START_WAIT_MS = 8000;
/** Each window, saved once drawn, so it shows at once on later visits (until the next build changes the art). */
const THUMB_KEY = 'pixel-battle.thumb.';
/** The hero's walking pace on the map (px/s), and the longest a walk may take (ms) before it hurries. */
const WALK_SPEED = 70;
const WALK_MAX_MS = 3200;
/** Sea beyond the map's edge the view may drift over (map px), so far places can still be centred. */
const MAP_MARGIN = 120;
/** How far a press may move (screen px) and still be a tap. */
const TAP_SLOP = 10;
/** Glints on the sea at a time. */
const SPARKS = 16;

const PLATE: PanelStyle = { ...PANEL, alpha: 0.84 };

function savedThumb(id: string): string | null {
  try {
    const raw = localStorage.getItem(THUMB_KEY + id);
    const t = raw ? (JSON.parse(raw) as { b: string; u: string }) : null;
    return t && t.b === buildId ? t.u : null;
  } catch {
    return null;
  }
}

function saveThumb(id: string, url: string): void {
  try {
    localStorage.setItem(THUMB_KEY + id, JSON.stringify({ b: buildId, u: url }));
  } catch {
    // Storage full or blocked: it's drawn live next time.
  }
}

/** Break text into lines that fit `width` in the pixel font (6 px a letter), at most `max` lines. */
function wrap(text: string, width: number, max: number): string {
  const per = Math.floor((width + 1) / 6);
  const lines: string[] = [];
  let line = '';
  for (const word of text.toUpperCase().split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > per && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  return lines.slice(0, max).join('\n');
}

/** Animations to play on a preview sprite's glow layer. */
const GLOW_ANIMS: Record<string, string> = { brazier_e: 'brazier_burn', fountain_e: 'fountain_flow' };

/**
 * A window onto one arena: its day ground with its props standing on it.
 * Shows a picture saved on an earlier visit at once, and builds the arena
 * itself (then shows it live) only while it's the one picked.
 */
class ArenaWindow extends Phaser.GameObjects.Container {
  private view: Phaser.GameObjects.Container;
  private loading: Phaser.GameObjects.BitmapText;
  private built = false;
  /** The saved picture of the window, shown until the live one is built. */
  private thumb: Phaser.GameObjects.Image | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly arena: ArenaDef,
  ) {
    super(scene, 0, 0);
    const inset = scene.add.image(-1, -1, panelTexture(scene, 'arena_window', WIN_W + 2, WIN_H + 2, PANEL_INSET)).setOrigin(0);
    this.view = scene.add.container(0, 0);
    this.loading = pixelText(scene, 0, 0, '...', 0x8a7cc0);
    this.loading.setPosition(Math.round((WIN_W - this.loading.width) / 2), Math.round((WIN_H - this.loading.height) / 2));
    this.add([inset, this.view, this.loading]);
    this.showSaved();
  }

  /** A picture of the window saved on an earlier visit: shown at once, while the live window is built. */
  private showSaved(): void {
    const key = `arena_thumb_${this.arena.id}`;
    const show = () => {
      if (!this.active || this.built || this.thumb) return;
      this.thumb = this.scene.add.image(0, 0, key).setOrigin(0);
      this.view.add(this.thumb);
      this.loading.setVisible(false);
    };
    if (this.scene.textures.exists(key)) return show();
    const url = savedThumb(this.arena.id);
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      if (!this.scene?.textures) return;
      if (!this.scene.textures.exists(key)) this.scene.textures.addImage(key, img);
      show();
    };
    img.src = url;
  }

  /** Build the arena for the window a little at a time; show it live once it's all there. */
  warm(): void {
    if (this.built) return;
    if (!warmArena(this.scene, this.arena, WARM_BUDGET)) return;
    this.built = true;
    this.loading.setVisible(false);
    this.thumb?.destroy();
    this.thumb = null;
    this.buildView();
  }

  get ready(): boolean {
    return this.built;
  }

  /** The window: the arena's day ground, cropped to it, with its props standing on it. */
  private buildView(): void {
    const scene = this.scene;
    const { preview, ground } = this.arena;
    const x0 = Math.round(preview.x - WIN_W / 2);
    const y0 = Math.round(preview.y - WIN_H / 2);
    const objs: Phaser.GameObjects.GameObject[] = [];
    // Crop an image placed at window coordinates (x, y), top-left, to the window.
    const clip = (img: Phaser.GameObjects.Image, x: number, y: number) => {
      const fw = img.frame.width;
      const fh = img.frame.height;
      const cx = Math.max(0, -x);
      const cy = Math.max(0, -y);
      const cw = Math.min(fw, WIN_W - x) - cx;
      const ch = Math.min(fh, WIN_H - y) - cy;
      if (cw <= 0 || ch <= 0) {
        img.destroy();
        return false;
      }
      img.setOrigin(0).setPosition(x, y).setCrop(cx, cy, cw, ch);
      objs.push(img);
      return true;
    };
    if (isPainted(ground)) {
      for (const l of ground.layers) {
        const img = scene.add.image(0, 0, l.key);
        if (l.glow) img.setBlendMode(Phaser.BlendModes.ADD);
        clip(img, l.x - x0, l.y - y0);
      }
    } else {
      for (let i = Math.floor(y0 / STRIP_H); i <= Math.floor((y0 + WIN_H) / STRIP_H); i++) {
        const key = `${GroundStreamer.key(ground, i)}_day`;
        if (scene.textures.exists(key)) clip(scene.add.image(0, 0, key), -x0, i * STRIP_H - y0);
      }
    }
    const sprites: PreviewSprite[] = preview.sprites().sort((a, b) => a.y - b.y);
    for (const s of sprites) {
      const body = scene.add.sprite(0, 0, s.texture, s.frame);
      const w = body.frame.width;
      const h = body.frame.height;
      const x = Math.round(s.x - w / 2 - x0);
      const y = Math.round(s.y - (s.originY ?? 1) * h - y0);
      if (!clip(body, x, y) || !s.glow) continue;
      const glow = scene.add.sprite(0, 0, s.glow, s.frame).setBlendMode(Phaser.BlendModes.ADD);
      if (clip(glow, x, y) && GLOW_ANIMS[s.glow]) glow.play(GLOW_ANIMS[s.glow]);
    }
    this.view.add(objs);
    if (!savedThumb(this.arena.id)) this.save(objs);
    this.view.setAlpha(0);
    scene.tweens.add({ targets: this.view, alpha: 1, duration: 240 });
  }

  /** Keep a picture of the window, to show at once next time. */
  private save(objs: Phaser.GameObjects.GameObject[]): void {
    const rt = this.scene.make.renderTexture({ width: WIN_W, height: WIN_H }, false);
    rt.draw(objs);
    rt.snapshot((snap) => {
      rt.destroy();
      if (!(snap instanceof HTMLImageElement)) return;
      const c = document.createElement('canvas');
      c.width = WIN_W;
      c.height = WIN_H;
      c.getContext('2d')!.drawImage(snap, 0, 0);
      saveThumb(this.arena.id, c.toDataURL('image/png'));
    });
  }
}

/** One arena on the map: its landmark, name plate, fog while unvisited, and a flag per boss slain. */
interface Spot {
  arena: ArenaDef;
  place: Place;
  mark: Phaser.GameObjects.Image;
  plate: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  plateKeys: [string, string];
  glows: Phaser.GameObjects.Image[];
  fog: Phaser.GameObjects.Image[];
  flags: Phaser.GameObjects.Image[];
}

/**
 * The arena select: a map of the realm of Aurendel, panned by dragging and
 * zoomed by pinching (or the mouse wheel). Each arena is a landmark on the
 * road; the hero walks the road to the one picked, whose panel shows a
 * window onto it and a line of its lore. Places not yet visited lie under
 * fog, which parts the next time the map is opened after going there, and a
 * flag goes up where a boss has fallen.
 */
export class ArenaScene extends Phaser.Scene {
  private character = '';
  private spots: Spot[] = [];
  private picked = 0;
  /** The map, drawn by the map camera (panned and zoomed); the controls by the UI camera. */
  private mapLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private layers!: {
    labels: Phaser.GameObjects.Container;
    halo: Phaser.GameObjects.Container;
    things: Phaser.GameObjects.Container;
    hero: Phaser.GameObjects.Container;
    glows: Phaser.GameObjects.Container;
    fog: Phaser.GameObjects.Container;
    plates: Phaser.GameObjects.Container;
  };
  private mapBuilt = false;
  private drawing!: Phaser.GameObjects.BitmapText;

  // The view: its centre on the map (map px) and zoom (screen px per map px).
  private cx = MAP_W / 2;
  private cy = MAP_H / 2;
  private z = 1;
  private zMin = 1;
  private zMax = 2;
  private uiZoom = 1;
  /** Glide the view to keep this spot in the open part of the screen (off when the player takes over). */
  private follow: Pt | null = null;
  private vel = { x: 0, y: 0 };
  private zoomTo: { z: number; sx: number; sy: number; wx: number; wy: number } | null = null;

  // Touches: where each is, the gesture as it began, and whether it's still a tap.
  private touches = new Map<number, { x: number; y: number }>();
  private gesture: { cx: number; cy: number; z: number; mx: number; my: number; d: number; wx: number; wy: number } | null = null;
  private tap: { x: number; y: number; t: number; ok: boolean } | null = null;
  private lastMove = { t: 0, cx: 0, cy: 0 };

  // The hero on the road.
  private hero: Phaser.GameObjects.Sprite | null = null;
  private heroGlow: Phaser.GameObjects.Sprite | null = null;
  private heroShadow: Phaser.GameObjects.Image | null = null;
  private heroKey = '';
  private idleAnim = '';
  private at = '';
  private route: Pt[] = [];
  private routeTo = '';
  private walked = 0;
  private walkSpeed = WALK_SPEED;

  private halo: Phaser.GameObjects.Image | null = null;
  private sparks: { img: Phaser.GameObjects.Image; t: number; life: number }[] = [];
  private ship: { img: Phaser.GameObjects.Image; t: number } | null = null;
  private clock = 0;

  // The panel.
  private panel!: Phaser.GameObjects.Container;
  private windowSlot!: Phaser.GameObjects.Container;
  private windows = new Map<string, ArenaWindow>();
  private title!: Phaser.GameObjects.BitmapText;
  private region!: Phaser.GameObjects.BitmapText;
  private lore!: Phaser.GameObjects.BitmapText;
  private status: Phaser.GameObjects.BitmapText[] = [];
  private header!: Phaser.GameObjects.Container;
  private back!: PixelButton;
  private play!: PixelButton;
  private online!: PixelButton;
  private zoomIn!: PixelButton;
  private zoomOut!: PixelButton;
  /** The panel's spot on screen (UI px), to keep the picked place out from under it. */
  private panelBox = new Phaser.Geom.Rectangle();

  /** The online panel is open over the page. */
  private onlineOpen = false;
  private leaving = false;
  /** Play was pressed before the picked arena had loaded: when that was. */
  private waitingSince: number | null = null;

  constructor() {
    super('arena');
  }

  create(data: { character: string }): void {
    this.leaving = false;
    this.waitingSince = null;
    this.onlineOpen = false;
    this.mapBuilt = false;
    this.character = data.character;
    this.spots = [];
    this.windows = new Map();
    this.touches.clear();
    this.gesture = null;
    this.tap = null;
    this.follow = null;
    this.zoomTo = null;
    this.vel = { x: 0, y: 0 };
    this.hero = this.heroGlow = this.heroShadow = null;
    this.route = [];
    this.sparks = [];
    this.ship = null;
    this.halo = null;

    // The map covers the home screen: stop drawing it underneath.
    this.homeCam()?.setVisible(false);
    const cam = this.cameras.main.setBackgroundColor(SEA_COLOUR).setAlpha(0);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: [cam, this.uiCam], alpha: 1, duration: 260 });

    this.mapLayer = this.add.container(0, 0);
    const layer = () => {
      const c = this.add.container(0, 0);
      this.mapLayer.add(c);
      return c;
    };
    this.layers = { labels: layer(), halo: layer(), things: layer(), hero: layer(), glows: layer(), fog: layer(), plates: layer() };
    this.uiLayer = this.add.container(0, 0);
    cam.ignore(this.uiLayer);
    this.uiCam.ignore(this.mapLayer);

    this.picked = Math.max(0, ARENAS.findIndex((a) => a.id === lastArena()));
    this.buildUi();
    // A second touch, for pinching.
    if (this.input.manager.pointersTotal < 2) this.input.addPointer(1);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.pick((this.picked + ARENAS.length - 1) % ARENAS.length));
    kb?.on('keydown-RIGHT', () => this.pick((this.picked + 1) % ARENAS.length));
    kb?.on('keydown-ENTER', () => this.startGame());
    kb?.on('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-ESC', () => this.goBack());
    kb?.on('keydown-O', () => this.openOnline());
    kb?.on('keydown-PLUS', () => this.stepZoom(1));
    kb?.on('keydown-MINUS', () => this.stepZoom(-1));

    this.layout();
    this.z = this.uiZoom;
    this.showPicked();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  private homeCam(): Phaser.Cameras.Scene2D.Camera | undefined {
    const home = this.scene.get('home');
    return this.scene.isActive('home') ? home.cameras.main : undefined;
  }

  // ---------------------------------------------------------------- Building

  private buildUi(): void {
    const ui = this.uiLayer;
    this.drawing = pixelText(this, 0, 0, 'Drawing the map...', 0x8a7cc0);
    const titleText = pixelText(this, 8, 3, `* The realm of ${REALM_NAME} *`, 0xf4cf6a);
    const titleBg = this.add.image(0, 0, panelTexture(this, 'wm_title', titleText.width + 16, 15, PLATE)).setOrigin(0);
    this.header = this.add.container(0, 0, [titleBg, titleText]);
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'back', () => this.goBack());
    this.zoomIn = new PixelButton(this, '+', 18, 18, BUTTON_PLAIN, 'wm_zoom_in', () => this.stepZoom(1));
    this.zoomOut = new PixelButton(this, '-', 18, 18, BUTTON_PLAIN, 'wm_zoom_out', () => this.stepZoom(-1));

    // The panel: a window onto the arena, its name, land and lore, and the buttons.
    const bg = this.add.image(0, 0, panelTexture(this, 'wm_panel', PANEL_W, PANEL_H, PANEL)).setOrigin(0);
    // Presses on the panel stay on the panel instead of dragging the map.
    bg.setInteractive();
    this.windowSlot = this.add.container(7, 7);
    this.region = pixelText(this, 7, 97, '', 0x8a7cc0);
    this.title = pixelText(this, 7, 107, '', 0xfff4d6);
    const rule = this.add.rectangle(7, 119, WIN_W, 1, 0x43356e).setOrigin(0);
    this.lore = pixelText(this, 7, 124, '', 0xe8dcc0);
    this.status = [pixelText(this, 7, 158, '', 0xf4cf6a), pixelText(this, 7, 168, '', 0xf4cf6a)];
    this.play = new PixelButton(this, 'Play', 64, 20, BUTTON_GOLD, 'play', () => this.startGame());
    this.online = new PixelButton(this, 'Online', 56, 18, BUTTON_PLAIN, 'online', () => this.openOnline());
    this.play.place(7, PANEL_H - 27);
    this.online.place(PANEL_W - 7 - 56, PANEL_H - 26);
    this.panel = this.add.container(0, 0, [bg, this.windowSlot, this.region, this.title, rule, this.lore, ...this.status, this.play, this.online]);
    ui.add([this.drawing, this.header, this.back, this.zoomIn, this.zoomOut, this.panel]);
  }

  /** Lay out the map once its textures are there. */
  private buildMap(): void {
    this.mapBuilt = true;
    this.drawing.setVisible(false);
    // The whole texture: its other frames are only the sea's glint spots.
    const land = this.add.image(0, 0, 'wm_land', '__BASE').setOrigin(0);
    this.mapLayer.addAt(land, 0);

    for (const l of LABELS) {
      const t = pixelText(this, 0, 0, l.text, l.sea ? 0x9ac8f0 : 0xf4e6c0).setLetterSpacing(l.sea ? 2 : 1);
      t.setPosition(Math.round(l.x - t.width / 2), Math.round(l.y - t.height / 2)).setAlpha(l.sea ? 0.6 : 0.78);
      this.layers.labels.add(t);
    }
    this.halo = this.add.image(0, 0, 'wm_bits', 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.layers.halo.add(this.halo);

    const progress = realm.get();
    const unveil: Spot[] = [];
    const plant: { flag: Phaser.GameObjects.Image }[] = [];
    ARENAS.forEach((arena, i) => {
      const place = placeFor(arena.id, i);
      const art = LANDMARKS[place.id] ? place.id : 'waymark';
      const L = LANDMARKS[art];
      const mark = this.add.image(place.x, place.y, 'wm_places', art).setOrigin(L.ax / L.w, L.ay / L.h);
      this.layers.things.add(mark);
      const name = pixelText(this, 0, 0, arena.name, 0xfff4d6);
      const pw = name.width + 8;
      const plateKeys: [string, string] = [panelTexture(this, 'wm_plate', pw, 13, PLATE), panelTexture(this, 'wm_plate_picked', pw, 13, PANEL_PICKED)];
      const py = Math.max(2, place.y - L.ay - 15);
      const plate = this.add.image(Math.round(place.x - pw / 2), py, plateKeys[0]).setOrigin(0);
      name.setPosition(plate.x + 4, py + 2);
      this.layers.plates.add([plate, name]);
      const glows = (place.glows ?? []).map((g) => {
        const img = this.add.image(place.x + g.dx, place.y + g.dy, 'wm_bits', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(g.tint).setScale(g.r / 16).setAlpha(0.4);
        this.layers.glows.add(img);
        return img;
      });
      const spot: Spot = { arena, place, mark, plate, name, plateKeys, glows, fog: [], flags: [] };
      // A flag for each boss slain here, planted beside the landmark.
      (place.bosses ?? []).forEach((b, k) => {
        if (!progress.slain.includes(b.kind)) return;
        const flag = this.add.image(place.x + L.w - L.ax - 6 + k * 8, place.y + 2, 'wm_bits', `${b.rank}0`).setOrigin(0.1, 1);
        flag.setData('rank', b.rank).setData('kind', b.kind);
        this.layers.things.add(flag);
        spot.flags.push(flag);
        if (!progress.flagged.includes(b.kind)) plant.push({ flag });
      });
      if (!progress.unveiled.includes(place.id)) {
        // Fog over what hasn't been seen yet.
        spot.fog = [
          [-16, -L.ay * 0.6, 0],
          [12, -L.ay * 0.75, 1],
          [-2, -L.ay * 0.3, 2],
          [18, -L.ay * 0.25, 0],
        ].map(([dx, dy, f], k) => {
          const img = this.add.image(place.x + dx, place.y + dy, 'wm_bits', `cloud${f}`).setAlpha(0.96).setFlipX(k % 2 === 1);
          img.setData('home', { x: img.x, y: img.y, k });
          this.layers.fog.add(img);
          return img;
        });
        mark.setTint(0x8c88b0);
        glows.forEach((g) => g.setVisible(false));
        if (progress.seen.includes(place.id)) unveil.push(spot);
      }
      this.spots.push(spot);
    });
    this.layers.things.sort('y');

    this.placeHero();
    this.makeSea();
    this.showPicked();
    this.celebrate(unveil, plant);
  }

  /** Part the fog over places visited since the map was last open, then plant flags for bosses newly slain. */
  private celebrate(unveil: Spot[], plant: { flag: Phaser.GameObjects.Image }[]): void {
    let delay = 500;
    for (const s of unveil) {
      s.fog.forEach((f) => {
        const home = f.getData('home') as { x: number; y: number };
        const away = Math.sign(home.x - s.place.x || 1);
        this.tweens.add({ targets: f, x: home.x + away * 26, y: home.y - 6, alpha: 0, duration: 1500, delay, ease: 'Sine.easeInOut', onComplete: () => f.destroy() });
      });
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1200,
        delay: delay + 300,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 1;
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x8c88b0), Phaser.Display.Color.ValueToColor(0xffffff), 1, v);
          s.mark.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        },
        onComplete: () => {
          s.mark.clearTint();
          s.glows.forEach((g) => g.setVisible(true));
        },
      });
      s.fog = [];
      delay += 700;
    }
    for (const { flag } of plant) {
      const y = flag.y;
      flag.setAlpha(0).setY(y - 14);
      this.tweens.add({ targets: flag, alpha: 1, y, duration: 500, delay: delay + 200, ease: 'Bounce.easeOut' });
      delay += 250;
    }
    realm.shown(
      unveil.map((s) => s.place.id),
      plant.map(({ flag }) => flag.getData('kind') as string),
    );
  }

  private placeHero(): void {
    const look = characterById(this.character).preview;
    this.heroKey = look.texture;
    this.idleAnim = look.idle;
    const spot = this.spots[this.picked];
    this.at = spot.place.id;
    const s = standAt(spot.place);
    this.heroShadow = this.add.image(s.x, s.y, 'wm_bits', 'shadow');
    this.layers.hero.add(this.heroShadow);
    if (!this.textures.exists(look.texture)) return;
    this.hero = this.add.sprite(s.x, s.y, look.texture).setOrigin(0.5, look.originY ?? 1);
    if (this.anims.exists(look.idle)) this.hero.play(look.idle);
    this.layers.hero.add(this.hero);
    if (look.glow && this.textures.exists(look.glow)) {
      this.heroGlow = this.add.sprite(s.x, s.y, look.glow).setOrigin(0.5, look.originY ?? 1).setBlendMode(Phaser.BlendModes.ADD);
      this.layers.hero.add(this.heroGlow);
    }
  }

  /** Glints on the open sea, and a ship sailing the Glass Sea. */
  private makeSea(): void {
    for (let i = 0; i < SPARKS; i++) {
      const img = this.add.image(0, 0, 'wm_bits', 'spark0').setAlpha(0);
      this.layers.labels.addAt(img, 0);
      this.sparks.push({ img, t: -Math.random() * 3000, life: 0 });
    }
    const ship = this.add.image(0, 0, 'wm_bits', 'ship0');
    this.layers.labels.add(ship);
    this.ship = { img: ship, t: 0 };
  }

  /** A spot out on open water (the map marks some as frames of its texture). */
  private seaSpot(): Pt {
    const land = this.textures.get('wm_land');
    const names = land.getFrameNames().filter((n) => n.startsWith('sea'));
    const f = names.length ? land.get(names[Math.floor(Math.random() * names.length)]) : null;
    return f ? { x: f.cutX, y: f.cutY } : { x: 20, y: 20 };
  }

  // ---------------------------------------------------------------- Picking

  private pick(i: number): void {
    if (this.leaving || i === this.picked) return;
    this.picked = i;
    this.showPicked();
    this.walkTo(this.spots[i]?.place.id);
  }

  /** Show the picked arena: its plate lit, its halo, the panel filled in, and the view gliding to it. */
  private showPicked(): void {
    const arena = ARENAS[this.picked];
    const place = placeFor(arena.id, this.picked);
    this.spots.forEach((s, k) => {
      const on = k === this.picked;
      s.plate.setTexture(s.plateKeys[on ? 1 : 0]);
      s.name.setTint(on ? arena.accent : 0xfff4d6);
    });
    if (this.halo) this.halo.setPosition(place.x, place.y - 2).setTint(arena.accent).setScale(2.2, 0.9);

    for (const w of this.windows.values()) w.setVisible(false);
    let win = this.windows.get(arena.id);
    if (!win) {
      win = new ArenaWindow(this, arena);
      this.windows.set(arena.id, win);
      this.windowSlot.add(win);
    }
    win.setVisible(true);

    this.title.setText(arena.name.toUpperCase()).setTint(arena.accent);
    this.region.setText(place.region.toUpperCase());
    this.lore.setText(wrap(place.lore, WIN_W, 3));
    const lines = this.statusLines(arena, place);
    this.status.forEach((t, k) => {
      const l = lines[k];
      t.setVisible(!!l);
      if (l) t.setText(wrap(l.text, WIN_W, 1)).setTint(l.tint);
    });
    const solo = !!arena.solo;
    this.online.setEnabled(!solo).setAlpha(solo ? 0.4 : 1);
    this.follow = { x: place.x, y: place.y - 16 };
  }

  /** What the panel says under the lore: a place's bosses (and which have fallen), its best wave, or a note. */
  private statusLines(arena: ArenaDef, place: Place): { text: string; tint: number }[] {
    const slain = realm.get().slain;
    if (place.bosses?.length) {
      return place.bosses.map((b) =>
        slain.includes(b.kind)
          ? { text: `Slain: ${b.name}`, tint: 0x8ae07a }
          : { text: `${b.rank === 'myth' ? 'Myth' : 'Legend'}: ${b.name}`, tint: b.rank === 'myth' ? 0xc8a0ff : 0xf4cf6a },
      );
    }
    if (arena.id === 'rift') {
      const best = collection.riftBest(this.character);
      if (best > 0) return [{ text: `Best wave: ${best}`, tint: 0xff8ad8 }];
    }
    return [{ text: place.note ?? arena.blurb, tint: 0xb8a8e8 }];
  }

  // ---------------------------------------------------------------- The hero's walk

  /** The road from one place to another, as points: legs chained along the way. */
  private roadBetween(from: string, to: string): Pt[] {
    const spots = this.spots.map((s) => s.place);
    const next = new Map<string, { to: string; pts: Pt[] }[]>();
    for (const leg of LEGS) {
      const { walk, sky } = legRoad(leg, spots);
      const pts = [...walk, ...sky];
      if (!pts.length) continue;
      next.set(leg.a, [...(next.get(leg.a) ?? []), { to: leg.b, pts }]);
      next.set(leg.b, [...(next.get(leg.b) ?? []), { to: leg.a, pts: pts.slice().reverse() }]);
    }
    // Breadth first: the road has no loops, so the first way found is the way.
    const came = new Map<string, { from: string; pts: Pt[] }>([[from, { from: '', pts: [] }]]);
    const queue = [from];
    while (queue.length) {
      const at = queue.shift()!;
      if (at === to) break;
      for (const n of next.get(at) ?? []) {
        if (came.has(n.to)) continue;
        came.set(n.to, { from: at, pts: n.pts });
        queue.push(n.to);
      }
    }
    if (!came.has(to)) {
      // Off the road (a place with no leg yet): straight there.
      const a = spots.find((p) => p.id === from);
      const b = spots.find((p) => p.id === to);
      return a && b ? [standAt(a), standAt(b)] : [];
    }
    const legs: Pt[][] = [];
    for (let at = to; at !== from; at = came.get(at)!.from) legs.unshift(came.get(at)!.pts);
    return legs.flat();
  }

  private walkTo(id: string | undefined): void {
    if (!id || !this.hero) return;
    // Mid-walk: carry on to where it was going, then on from there.
    const from = this.route.length ? this.routeTo : this.at;
    const rest = this.route.length ? this.remaining() : [{ x: this.hero.x, y: this.hero.y }];
    this.route = from === id ? rest : [...rest, ...this.roadBetween(from, id)];
    this.routeTo = id;
    this.walked = 0;
    const len = this.routeLength();
    this.walkSpeed = Math.max(WALK_SPEED, (len / WALK_MAX_MS) * 1000);
  }

  /** What's left of the route, from the hero on. */
  private remaining(): Pt[] {
    const out: Pt[] = [{ x: this.hero!.x, y: this.hero!.y }];
    let d = 0;
    for (let i = 1; i < this.route.length; i++) {
      d += Math.hypot(this.route[i].x - this.route[i - 1].x, this.route[i].y - this.route[i - 1].y);
      if (d > this.walked) out.push(this.route[i]);
    }
    return out;
  }

  private routeLength(): number {
    let d = 0;
    for (let i = 1; i < this.route.length; i++) d += Math.hypot(this.route[i].x - this.route[i - 1].x, this.route[i].y - this.route[i - 1].y);
    return d;
  }

  private stepHero(dt: number): void {
    const hero = this.hero;
    if (!hero) return;
    if (this.route.length > 1) {
      this.walked += (this.walkSpeed * dt) / 1000;
      let d = 0;
      let x = this.route[this.route.length - 1].x;
      let y = this.route[this.route.length - 1].y;
      let dx = 0;
      let dy = 0;
      let done = true;
      for (let i = 1; i < this.route.length; i++) {
        const a = this.route[i - 1];
        const b = this.route[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (d + len >= this.walked && len > 0) {
          const t = (this.walked - d) / len;
          x = a.x + (b.x - a.x) * t;
          y = a.y + (b.y - a.y) * t;
          // Face the way the road runs a few steps ahead, so small wiggles don't flip it.
          const ahead = this.route[Math.min(this.route.length - 1, i + 3)];
          dx = ahead.x - a.x;
          dy = ahead.y - a.y;
          done = false;
          break;
        }
        d += len;
      }
      hero.setPosition(x, y);
      if (done) {
        this.route = [];
        this.at = this.routeTo;
        if (this.anims.exists(this.idleAnim)) hero.play(this.idleAnim);
      } else {
        const dir = Math.abs(dx) > Math.abs(dy) * 0.8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        const walk = `${this.heroKey}_walk_${dir}`;
        if (this.anims.exists(walk)) hero.play(walk, true);
      }
    }
    const sx = Math.round(hero.x);
    const sy = Math.round(hero.y);
    hero.setPosition(sx, sy);
    this.heroShadow?.setPosition(sx, sy);
    if (this.heroGlow) {
      this.heroGlow.setPosition(sx, sy);
      if (this.textures.get(this.heroGlow.texture.key).has(hero.frame.name)) this.heroGlow.setFrame(hero.frame.name);
    }
  }

  // ---------------------------------------------------------------- Panning and zooming

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.leaving || this.onlineOpen || over.length) return;
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
    if (this.touches.size > 1 && g.d > 0) this.z = Phaser.Math.Clamp((g.z * d) / g.d, this.zMin * 0.8, this.zMax * 1.25);
    const { width, height } = this.scale;
    this.cx = g.wx - (mx - width / 2) / this.z;
    this.cy = g.wy - (my - height / 2) / this.z;
    const dt = Math.max(1, now - this.lastMove.t);
    if (this.touches.size === 1) {
      // Keep the fling's speed (map px per ms), smoothed over the last few moves.
      this.vel.x = this.vel.x * 0.4 + ((this.cx - pcx) / dt) * 0.6;
      this.vel.y = this.vel.y * 0.4 + ((this.cy - pcy) / dt) * 0.6;
    }
    this.lastMove = { t: now, cx: this.cx, cy: this.cy };
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
    if (this.time.now - this.lastMove.t > 80) this.vel = { x: 0, y: 0 };
    // Settle on a whole zoom, where the pixels are crisp.
    const whole = Phaser.Math.Clamp(Math.round(this.z), this.zMin, this.zMax);
    if (whole !== this.z) this.zoomAround(whole, this.scale.width / 2, this.scale.height / 2);
  }

  private onWheel(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void {
    if (this.leaving || this.onlineOpen || over.length || dy === 0) return;
    const base = this.zoomTo ? this.zoomTo.z : Math.round(this.z);
    this.zoomAround(Phaser.Math.Clamp(base + (dy < 0 ? 1 : -1), this.zMin, this.zMax), p.x, p.y);
  }

  /** The + and - buttons (and keys): a whole step, about the middle of the screen. */
  private stepZoom(step: number): void {
    if (this.leaving || this.onlineOpen) return;
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
    this.gesture = { cx: this.cx, cy: this.cy, z: this.z, mx, my, d, wx: this.cx + (mx - width / 2) / this.z, wy: this.cy + (my - height / 2) / this.z };
    this.lastMove = { t: this.time.now, cx: this.cx, cy: this.cy };
  }

  private touchMid(): { mx: number; my: number; d: number } {
    const ts = [...this.touches.values()];
    if (!ts.length) return { mx: 0, my: 0, d: 0 };
    const mx = ts.reduce((s, t) => s + t.x, 0) / ts.length;
    const my = ts.reduce((s, t) => s + t.y, 0) / ts.length;
    const d = ts.length > 1 ? Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y) : 0;
    return { mx, my, d };
  }

  /** A tap on the map: the place whose landmark or name plate is under it. */
  private tapAt(x: number, y: number): void {
    let best = -1;
    let bestD = Infinity;
    this.spots.forEach((s, i) => {
      const m = s.mark.getBounds();
      const pl = s.plate.getBounds();
      const inside = (r: Phaser.Geom.Rectangle, pad: number) => x >= r.x - pad && x <= r.right + pad && y >= r.y - pad && y <= r.bottom + pad;
      if (!inside(m, 3) && !inside(pl, 2)) return;
      const d = Math.hypot(x - s.place.x, y - (s.place.y - 12));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) this.pick(best);
  }

  /** Keep the view over the map (and a little of the sea about it), and on whole screen pixels. */
  private clampView(): void {
    const { width, height } = this.scale;
    const hw = width / (2 * this.z);
    const hh = height / (2 * this.z);
    const clamp = (c: number, half: number, size: number) => (size + MAP_MARGIN * 2 <= half * 2 ? size / 2 : Phaser.Math.Clamp(c, half - MAP_MARGIN, size - half + MAP_MARGIN));
    this.cx = clamp(this.cx, hw, MAP_W);
    this.cy = clamp(this.cy, hh, MAP_H);
  }

  /** Where the view's centre goes so map point `p` sits in the middle of the screen's open part (clear of the panel). */
  private centreFor(p: Pt): Pt {
    const { width, height } = this.scale;
    const u = this.uiZoom;
    const b = this.panelBox;
    let ox = width / 2;
    let oy = height / 2;
    if (b.width > 0) {
      if (b.x * u > width / 2) ox = (b.x * u) / 2;
      else if (b.y * u > height / 3) oy = (b.y * u) / 2 + 12 * u;
    }
    return { x: p.x - (ox - width / 2) / this.z, y: p.y - (oy - height / 2) / this.z };
  }

  private moveView(dt: number): void {
    const { width, height } = this.scale;
    if (this.zoomTo) {
      const zt = this.zoomTo;
      const k = 1 - Math.exp(-dt / 70);
      this.z += (zt.z - this.z) * k;
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
      const k = 1 - Math.exp(-dt / 180);
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
    const sx = this.cx - width / 2;
    const sy = this.cy - height / 2;
    const crisp = Math.abs(z - Math.round(z)) < 0.001;
    cam.setScroll(crisp ? Math.round(this.cx * z) / z - width / 2 : sx, crisp ? Math.round(this.cy * z) / z - height / 2 : sy);
  }

  // ---------------------------------------------------------------- Frame

  update(_time: number, dt: number): void {
    this.clock += dt;
    if (!this.mapBuilt && warmWorldMap(this, 12)) this.buildMap();
    this.moveView(dt);
    if (this.mapBuilt) {
      this.stepHero(dt);
      this.animate(dt);
    }

    // Only the picked arena is built, for its window; the rest stay pictures.
    const arena = ARENAS[this.picked];
    const win = this.windows.get(arena.id);
    win?.warm();
    if (this.waitingSince !== null && (win?.ready || this.time.now - this.waitingSince > START_WAIT_MS)) {
      this.waitingSince = null;
      this.go(arena.id, false);
    }
  }

  /** The living bits: glows breathing, fog drifting, flags flapping, the halo, the sea's glints, the ship. */
  private animate(dt: number): void {
    const t = this.clock / 1000;
    for (const s of this.spots) {
      s.glows.forEach((g, k) => g.setAlpha(0.32 + 0.12 * Math.sin(t * 1.7 + k * 1.3 + s.place.x)));
      for (const f of s.fog) {
        const home = f.getData('home') as { x: number; y: number; k: number };
        f.setPosition(Math.round(home.x + Math.sin(t * 0.5 + home.k * 1.7) * 2), Math.round(home.y + Math.sin(t * 0.7 + home.k) * 1));
      }
      const wave = Math.floor(t * 2.5 + s.place.x) % 2;
      for (const f of s.flags) f.setFrame(`${f.getData('rank')}${wave}`);
    }
    this.halo?.setAlpha(0.45 + 0.15 * Math.sin(t * 3));

    for (const s of this.sparks) {
      s.t += dt;
      if (s.t < 0) continue;
      if (s.t >= s.life) {
        // Somewhere new on open water.
        const at = this.seaSpot();
        s.img.setPosition(at.x, at.y);
        s.t = -Math.random() * 1500;
        s.life = 700 + Math.random() * 500;
        s.img.setAlpha(0);
        continue;
      }
      const u = s.t / s.life;
      const f = u < 0.25 || u > 0.75 ? 0 : u < 0.4 || u > 0.6 ? 1 : 2;
      s.img.setFrame(`spark${f}`).setAlpha(1);
    }

    if (this.ship) {
      // Back and forth across the Glass Sea, turning at each end.
      const sh = this.ship;
      sh.t += dt;
      const period = 90000;
      const u = (sh.t % period) / period;
      const k = u < 0.5 ? u * 2 : 2 - u * 2;
      const e = k * k * (3 - 2 * k);
      const x = 562 + (612 - 562) * e;
      const y = 172 + (292 - 172) * e;
      sh.img.setPosition(Math.round(x), Math.round(y)).setFlipX(u >= 0.5);
      sh.img.setFrame(Math.floor(t * 1.4) % 2 ? 'ship1' : 'ship0');
    }
  }

  // ---------------------------------------------------------------- Leaving

  private goBack(): void {
    if (this.leaving || this.onlineOpen) return;
    this.leaving = true;
    this.homeCam()?.setVisible(true);
    this.scene.launch('select');
    this.tweens.add({ targets: [this.cameras.main, this.uiCam], alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  /** Play online: create or join a room, then into its arena. */
  private openOnline(): void {
    const arena = ARENAS[this.picked];
    if (this.leaving || this.onlineOpen || arena.solo) return;
    this.onlineOpen = true;
    this.input.enabled = false;
    this.touches.clear();
    this.gesture = null;
    openOnlineForm(
      arena,
      this.character,
      (room) => {
        this.onlineOpen = false;
        this.input.enabled = true;
        this.startGame(arenaById(room.arena).id);
      },
      () => {
        this.onlineOpen = false;
        this.input.enabled = true;
      },
    );
  }

  /** `arenaId`: a room's arena, online; else the one picked. */
  private startGame(arenaId?: string): void {
    if (this.leaving || (this.onlineOpen && !arenaId)) return;
    this.leaving = true;
    const arena = ARENAS[this.picked];
    const win = this.windows.get(arena.id);
    if (arenaId || win?.ready) return this.go(arenaId ?? arena.id, !!arenaId);
    // Still loading: wait for it here, where the frame rate holds, rather
    // than in the world's first frame.
    this.waitingSince = this.time.now;
    this.play.setAlpha(0.6);
  }

  private go(arena: string, online: boolean): void {
    const character = this.character;
    if (!online) rememberArena(arena);
    realm.visit(arena);
    for (const cam of [this.cameras.main, this.uiCam]) cam.fadeOut(450, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('home');
      this.scene.launch('shade');
      this.scene.launch('ui', { character });
      this.scene.launch('pause');
      this.scene.start('world', { character, arena });
    });
  }

  // ---------------------------------------------------------------- Layout

  private layout(): void {
    const { width, height } = this.scale;
    const u = menuZoom(width, height);
    this.uiZoom = u;
    this.uiCam.setSize(width, height).setZoom(u);
    // Zoom from about the whole map in view to twice the menus' size.
    const fit = Math.min(width / (MAP_W + 24), height / (MAP_H + 24));
    this.zMin = Math.max(1, Math.min(u, Math.floor(fit) || 1));
    this.zMax = Math.max(this.zMin + 1, u * 2);
    this.z = Phaser.Math.Clamp(Math.round(this.z), this.zMin, this.zMax);

    const vw = width / u;
    const vh = height / u;
    const top = Math.ceil(fpsBottom() / u) + 4;
    this.header.setPosition(Math.round((vw - (this.header.getBounds().width || 0)) / 2), top);
    this.back.place(6, top - 1);
    this.drawing.setPosition(Math.round((vw - this.drawing.width) / 2), Math.round(vh / 2));

    // The panel: down the right side on a wide screen, along the bottom on a tall one.
    const wide = vw >= PANEL_W + 220 || vw > vh * 1.2;
    let px: number;
    let py: number;
    if (wide) {
      px = vw - PANEL_W - 6;
      py = Math.max(top + 18, Math.round((vh - PANEL_H) / 2));
      if (py + PANEL_H > vh - 4) py = Math.max(4, vh - PANEL_H - 4);
    } else {
      px = Math.round((vw - PANEL_W) / 2);
      py = vh - PANEL_H - 6;
    }
    this.panel.setPosition(px, py);
    this.panelBox.setTo(px, py, PANEL_W, PANEL_H);
    // Zoom buttons at the bottom left, clear of the panel.
    const zy = wide ? vh - 26 : py - 26;
    this.zoomOut.place(6, zy);
    this.zoomIn.place(28, zy);
    if (this.spots.length) this.follow = this.follow ?? { x: this.spots[this.picked].place.x, y: this.spots[this.picked].place.y - 16 };
  }
}
