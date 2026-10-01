import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { pixelText } from '../ui/widgets';
import { arenaById, isPainted, type ArenaDef } from '../world/arenas';
import { LOAD_BG, LOAD_H, LOAD_W, paintCosmos, paintDeep, paintFrost, paintHomeLoad, paintRift, paintSky, paintSpirit, paintTemple, type LoadArt } from '../art/loadArt';
import { warmHomeSoon } from '../art/homeArt';
import { GroundStreamer } from '../world/GroundStreamer';
import { HOME_GROUND } from '../world/homeGround';

// A painted arena's loading screen. Its textures (a cave floor the size of
// the Glimmerdeep, the monsters' sheets, the bosses') used to be built ahead
// on the home screen, which made the game's first seconds sluggish. Now they
// are built here, when the player sets off for that arena: a worker paints
// them (see art/arenaLoader.ts) while a little painted scene of the place
// lives on screen (art/loadArt.ts), and the world opens once they're in.
// An arena already built goes straight in.

/** ms of this thread spent on the arena's textures per frame: an upload at a time, so the scene keeps moving. */
const WARM_MS = 10;
/** The shortest the screen stays (ms), fade in included, so it never just flashes. */
const MIN_SHOW = 1100;
const FADE_IN = 260;
const FADE_OUT = 380;
/** How long a load is guessed to take before one has been timed (ms); the bar eases toward the end over it. */
const GUESS_MS = 2600;
const TIMES_KEY = 'pixel-battle.loadMs.';
/** ms the bar takes to catch up with the progress. */
const BAR_EASE = 220;
const BAR_W = 128;

/** A stream of motes over the picture: where they rise, how they move, their colours. */
interface Motes {
  /** Spawn area in picture px (x, y, w, h), or a list of spots to spawn round. */
  zone: [number, number, number, number] | 'spots';
  spot?: string;
  /** Spread round each spot (px). */
  spread?: number;
  speedX: [number, number];
  speedY: [number, number];
  life: [number, number];
  every: number;
  tints: number[];
  /** Pulled toward this spot instead of drifting. */
  pull?: string;
  /** Alpha at its brightest. */
  alpha?: number;
}

/** A light breathing or flickering at each of a picture's spots. */
interface Light {
  spot: string;
  tint: number;
  /** Radius (px) of the glow. */
  r: number;
  /** 'flicker' for a flame, 'breathe' for a slow pulse. */
  kind: 'flicker' | 'breathe';
  alpha: number;
}

interface Look {
  paint: () => LoadArt;
  /** The line under the name. */
  sub: string;
  title: number;
  text: number;
  /** The bar: its track, its fill and the fill's lit top row. */
  bar: [number, number, number];
  motes: Motes[];
  lights: Light[];
  /** Falling stars streak across now and then. */
  stars?: boolean;
  /**
   * For a place that isn't a painted arena (the Home): build it for at most
   * `budget` ms, true once done (a budget of 0 only checks). Painted arenas
   * use their ground's own `warm`.
   */
  warm?: (scene: Phaser.Scene, budget: number) => boolean;
  /** ms a frame for `warm`, when it isn't the default. */
  budget?: number;
}

/**
 * The Home: its sheet (painted on this thread, a piece at a time), then all
 * its ground. Its world must open on both, or its first frame paints them
 * while the screen stays black.
 */
function warmHomeArena(scene: Phaser.Scene, budget: number): boolean {
  if (budget <= 0) return scene.textures.exists('home') && GroundStreamer.warm(scene, HOME_GROUND, 0, HOME_GROUND.h, 0);
  return warmHomeSoon(scene, budget) && GroundStreamer.warm(scene, HOME_GROUND, 0, HOME_GROUND.h, budget);
}

const LOOKS: Record<string, Look> = {
  deep: {
    paint: paintDeep,
    sub: 'Lighting the crystals',
    title: 0xc8a0ff,
    text: 0x9ad8c8,
    bar: [0x1a1030, 0x7a3ac8, 0xd8a8ff],
    motes: [
      // Spores lifting off the glowcaps.
      { zone: 'spots', spot: 'caps', spread: 12, speedX: [-3, 3], speedY: [-9, -3], life: [2400, 4200], every: 140, tints: [0x5affd8, 0xa8fff0, 0x3ae8b0] },
      // Dust turning in the skylight.
      { zone: [96, 14, 30, 80], speedX: [-1, 3], speedY: [1, 5], life: [3000, 5000], every: 220, tints: [0xfff2c8, 0xf0e0a0], alpha: 0.7 },
      // Sparks off the amethyst.
      { zone: 'spots', spot: 'crystals', spread: 4, speedX: [-2, 2], speedY: [-4, 0], life: [700, 1400], every: 260, tints: [0xe0b0ff, 0xffffff] },
    ],
    lights: [
      { spot: 'crystals', tint: 0xa050ff, r: 8, kind: 'breathe', alpha: 0.35 },
      { spot: 'caps', tint: 0x30e8c0, r: 16, kind: 'breathe', alpha: 0.28 },
    ],
  },
  spirit: {
    paint: paintSpirit,
    sub: 'Waking the dead',
    title: 0x9ad0ff,
    text: 0x8a9ac0,
    bar: [0x0c1428, 0x2a6ad8, 0xa8e0ff],
    motes: [
      // Souls rising out of the stairwell.
      { zone: [100, 40, 24, 50], speedX: [-3, 3], speedY: [-8, -3], life: [2600, 4200], every: 320, tints: [0xa8e8ff, 0x6ab8ff, 0xffffff] },
      // Embers of cold fire off the braziers.
      { zone: 'spots', spot: 'braziers', spread: 3, speedX: [-3, 3], speedY: [-14, -6], life: [600, 1200], every: 120, tints: [0x9ad8ff, 0x4a8aff] },
    ],
    lights: [
      { spot: 'braziers', tint: 0x3a8aff, r: 22, kind: 'flicker', alpha: 0.5 },
      { spot: 'door', tint: 0x2a6aff, r: 26, kind: 'breathe', alpha: 0.35 },
    ],
  },
  temple: {
    paint: paintTemple,
    sub: 'Stoking the elements',
    title: 0xffb060,
    text: 0xe0a080,
    bar: [0x2a1010, 0xd85a20, 0xffd080],
    motes: [
      // Embers off the great fire.
      { zone: 'spots', spot: 'fire', spread: 5, speedX: [-5, 5], speedY: [-16, -7], life: [900, 1800], every: 70, tints: [0xffd080, 0xff8a30, 0xff5a10] },
      // Heat rising off the lava.
      { zone: [20, 114, 184, 14], speedX: [-2, 2], speedY: [-9, -4], life: [900, 1700], every: 110, tints: [0xffa040, 0xff6a20] },
    ],
    lights: [
      { spot: 'fire', tint: 0xff7a20, r: 26, kind: 'flicker', alpha: 0.55 },
      { spot: 'door', tint: 0xff6a10, r: 12, kind: 'flicker', alpha: 0.4 },
      { spot: 'gems', tint: 0xffffff, r: 7, kind: 'breathe', alpha: 0.3 },
    ],
  },
  cosmos: {
    paint: paintCosmos,
    sub: 'Aligning the stars',
    title: 0xa8d8ff,
    text: 0x9a9ad0,
    bar: [0x0e0c22, 0x3a6ae0, 0xc0e8ff],
    motes: [
      { zone: [40, 60, 150, 50], speedX: [-2, 2], speedY: [-5, -1], life: [2400, 4000], every: 200, tints: [0x8ad0ff, 0xd0c0ff, 0xffffff] },
      { zone: 'spots', spot: 'tips', spread: 3, speedX: [-2, 2], speedY: [-6, -2], life: [800, 1400], every: 240, tints: [0xffffff, 0xa0d8ff] },
    ],
    lights: [
      { spot: 'tips', tint: 0x8ac8ff, r: 9, kind: 'breathe', alpha: 0.45 },
      { spot: 'ring', tint: 0x3a8aff, r: 40, kind: 'breathe', alpha: 0.18 },
    ],
    stars: true,
  },
  rift: {
    paint: paintRift,
    sub: 'Tearing open the Rift',
    title: 0xff8ae8,
    text: 0xc090d0,
    bar: [0x200830, 0xc030c0, 0xffc0f4],
    motes: [
      // Specks of everything, drawn into the tear.
      { zone: [0, 0, LOAD_W, LOAD_H], speedX: [0, 0], speedY: [0, 0], life: [1800, 2800], every: 60, tints: [0xff8ae8, 0xc070ff, 0xffffff], pull: 'tear' },
    ],
    lights: [
      { spot: 'tear', tint: 0xff40d0, r: 44, kind: 'breathe', alpha: 0.45 },
      { spot: 'rocks', tint: 0xc040ff, r: 10, kind: 'breathe', alpha: 0.2 },
    ],
  },
  frost: {
    paint: paintFrost,
    sub: 'Kindling the aurora',
    title: 0x9af0d0,
    text: 0x9ab8d0,
    bar: [0x0a1424, 0x2aa0a0, 0xb0fff0],
    motes: [
      // Snow drifting down over everything.
      { zone: [0, -4, LOAD_W, 6], speedX: [-6, 2], speedY: [8, 16], life: [7000, 9000], every: 70, tints: [0xffffff, 0xd8ecff], alpha: 0.85 },
      { zone: 'spots', spot: 'ice', spread: 2, speedX: [-1, 1], speedY: [-3, 0], life: [600, 1100], every: 300, tints: [0xc0fff0, 0xffffff] },
    ],
    lights: [
      { spot: 'braziers', tint: 0xff9a40, r: 12, kind: 'flicker', alpha: 0.5 },
      { spot: 'aurora', tint: 0x30e0a0, r: 60, kind: 'breathe', alpha: 0.12 },
    ],
  },
  island: {
    paint: () => paintSky(false),
    sub: 'Raising the island',
    title: 0xffe0f0,
    text: 0xc0d0e8,
    bar: [0x1a2a50, 0xe07090, 0xffe0ec],
    motes: [
      // Blossom off the cherry tree, carried on the wind.
      { zone: 'spots', spot: 'tree', spread: 8, speedX: [6, 14], speedY: [1, 6], life: [3000, 5000], every: 260, tints: [0xffc4de, 0xfff4fa, 0xffe0ec] },
      { zone: 'spots', spot: 'fall', spread: 6, speedX: [-3, 3], speedY: [-4, -1], life: [900, 1500], every: 160, tints: [0xffffff], alpha: 0.6 },
    ],
    lights: [],
  },
  home: {
    paint: paintHomeLoad,
    sub: 'Lighting the hearth',
    title: 0xffc890,
    text: 0xc8b8d8,
    bar: [0x1a1430, 0xd8803a, 0xffe0a0],
    motes: [
      // Smoke curling up from the chimney, faintly moonlit.
      { zone: 'spots', spot: 'chimney', spread: 1, speedX: [1, 4], speedY: [-7, -4], life: [2600, 3800], every: 240, tints: [0x8a84a8, 0x6a6488], alpha: 0.5 },
      // Fireflies about the garden.
      { zone: [10, 80, 204, 44], speedX: [-3, 3], speedY: [-3, 2], life: [1800, 3200], every: 260, tints: [0xd8ff7a, 0xf6ffb0, 0x9dffb0] },
    ],
    lights: [
      { spot: 'windows', tint: 0xffb050, r: 14, kind: 'flicker', alpha: 0.32 },
      { spot: 'pond', tint: 0x8878d0, r: 18, kind: 'breathe', alpha: 0.2 },
    ],
    warm: warmHomeArena,
    // Painted here rather than by a worker: a bigger slice, as the screen asks little else of the frame.
    budget: 16,
  },
  glide: {
    paint: () => paintSky(true),
    sub: 'Catching the wind',
    title: 0xb8f0ff,
    text: 0xc0d0e8,
    bar: [0x1a2a50, 0x40a8e0, 0xd8f6ff],
    motes: [
      // Streaks of wind blowing past.
      { zone: [-10, 20, 10, 90], speedX: [60, 90], speedY: [-2, 2], life: [2600, 3600], every: 180, tints: [0xffffff], alpha: 0.55 },
      { zone: 'spots', spot: 'tree', spread: 8, speedX: [6, 14], speedY: [1, 6], life: [3000, 5000], every: 320, tints: [0xffc4de, 0xfff4fa] },
    ],
    lights: [],
  },
};

/** Does setting off for this arena go through a loading screen (it has one, and isn't built yet)? */
export function needsLoading(scene: Phaser.Scene, arena: ArenaDef): boolean {
  const look = LOOKS[arena.id];
  if (!look) return false;
  if (look.warm) return !look.warm(scene, 0);
  return isPainted(arena.ground) && !arena.ground.warm(scene, 0);
}

/** Does this arena have a loading screen of its own? */
export const hasLoadScreen = (id: string): boolean => !!LOOKS[id];

/** Into an arena whose textures are in: its world (or its mode's scene), with the overlays over it. */
export function enterArena(scene: Phaser.Scene, character: string | undefined, id: string): void {
  const mode = arenaById(id).mode;
  scene.scene.launch('shade');
  if (mode) {
    // A mode with a scene of its own (Sky Glide): its HUD, and the pause menu over it.
    scene.scene.launch(mode.ui);
    scene.scene.launch('pause', { world: mode.scene, ui: mode.ui });
    scene.scene.start(mode.scene, { character });
    return;
  }
  scene.scene.launch('ui', { character });
  scene.scene.launch('pause');
  scene.scene.start('world', { character, arena: id });
}

function lastTime(id: string): number {
  try {
    return Number(localStorage.getItem(TIMES_KEY + id)) || GUESS_MS;
  } catch {
    return GUESS_MS;
  }
}

function rememberTime(id: string, ms: number): void {
  try {
    localStorage.setItem(TIMES_KEY + id, String(Math.round(ms)));
  } catch {
    // Not remembered; the bar guesses next time.
  }
}

export class ArenaLoadScene extends Phaser.Scene {
  private arena!: ArenaDef;
  private character?: string;
  private look!: Look;
  private pic!: Phaser.GameObjects.Container;
  private glow!: Phaser.GameObjects.Image;
  private bar!: Phaser.GameObjects.Graphics;
  private streaks!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.BitmapText;
  private sub!: Phaser.GameObjects.BitmapText;
  private flames: { img: Phaser.GameObjects.Image; light: Light; seed: number }[] = [];
  private star: { x: number; y: number; vx: number; vy: number; t: number } | null = null;
  private nextStar = 0;
  private elapsed = 0;
  private expected = GUESS_MS;
  private loadedAt: number | null = null;
  private shown = 0;
  private leaving = false;

  constructor() {
    super('arenaload');
  }

  create(data: { character?: string; arena: string }): void {
    this.arena = arenaById(data.arena);
    this.character = data.character;
    this.look = LOOKS[this.arena.id];
    this.elapsed = 0;
    this.shown = 0;
    this.loadedAt = null;
    this.leaving = false;
    this.flames = [];
    this.star = null;
    this.nextStar = 1500;
    this.expected = lastTime(this.arena.id);
    // Set the worker going before anything else, so it paints while this screen is put up.
    if (!this.look.warm && isPainted(this.arena.ground)) this.arena.ground.warm(this, 0.01);

    const cam = this.cameras.main.setOrigin(0, 0).setBackgroundColor(LOAD_BG);
    cam.fadeIn(FADE_IN, 7, 8, 13);

    // The picture, painted once a visit to the game and kept.
    const key = `load_${this.arena.id}`;
    if (!this.textures.exists(key)) {
      const art = this.look.paint();
      this.textures.addCanvas(key, art.base.toCanvas());
      this.textures.addCanvas(`${key}_g`, art.glow.toCanvas());
      this.registry.set(`${key}_spots`, art.spots);
    }
    const spots = (this.registry.get(`${key}_spots`) as LoadArt['spots'] | undefined) ?? {};
    const x0 = -LOAD_W / 2;
    const y0 = -LOAD_H / 2;
    const parts: Phaser.GameObjects.GameObject[] = [this.add.image(x0, y0, key).setOrigin(0)];
    this.glow = this.add.image(x0, y0, `${key}_g`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    parts.push(this.glow);

    // Lights over its fires and crystals.
    this.look.lights.forEach((light, n) => {
      (spots[light.spot] ?? []).forEach(([x, y], i) => {
        const img = this.add.image(x0 + x, y0 + y, 'glow').setTint(light.tint).setBlendMode(Phaser.BlendModes.ADD).setScale(light.r / 16).setAlpha(0);
        parts.push(img);
        this.flames.push({ img, light, seed: n * 7 + i * 1.7 });
      });
    });

    // Its motes.
    for (const m of this.look.motes) {
      const where = m.zone === 'spots' ? (spots[m.spot ?? ''] ?? []) : null;
      if (where && !where.length) continue;
      const spread = m.spread ?? 4;
      const peak = m.alpha ?? 1;
      const to = m.pull ? spots[m.pull]?.[0] : undefined;
      // Where each mote starts: round one of the spots, or anywhere in a box.
      const source = where
        ? {
            getRandomPoint: (pt: Phaser.Types.Math.Vector2Like) => {
              const [sx, sy] = where[Math.floor(Math.random() * where.length)];
              pt.x = sx + (Math.random() * 2 - 1) * spread;
              pt.y = sy + (Math.random() * 2 - 1) * spread * 0.6;
              return pt;
            },
          }
        : new Phaser.Geom.Rectangle(...(m.zone as [number, number, number, number]));
      const emitter = this.add.particles(x0, y0, 'spark', {
        emitZone: { type: 'random', source } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: m.life[0], max: m.life[1] },
        speedX: { min: m.speedX[0], max: m.speedX[1] },
        speedY: { min: m.speedY[0], max: m.speedY[1] },
        ...(to ? { moveToX: to[0], moveToY: to[1] } : {}),
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * peak },
        tint: m.tints,
        blendMode: Phaser.BlendModes.ADD,
        frequency: m.every,
      });
      // Fill the air at once rather than starting empty.
      emitter.fastForward(m.life[1], 50);
      parts.push(emitter);
    }
    this.streaks = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    parts.push(this.streaks);
    this.pic = this.add.container(0, 0, parts);

    this.title = pixelText(this, 0, 0, this.arena.name, this.look.title, 2);
    this.sub = pixelText(this, 0, 0, this.look.sub, this.look.text).setAlpha(0.85);
    this.bar = this.add.graphics();

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  private layout(): void {
    const { width, height } = this.scale;
    const z = menuZoom(width, height);
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    // The name at 2x when it fits across.
    this.title.setScale(this.title.width * 2 <= vw - 16 ? 2 : 1);
    const textH = 6 + this.title.displayHeight + 4 + this.sub.height + 8 + 4;
    const top = Math.max(0, Math.round((vh - LOAD_H - textH) / 2));
    const cx = Math.round(vw / 2);
    this.pic.setPosition(cx, top + LOAD_H / 2);
    let y = top + LOAD_H + 6;
    this.title.setPosition(Math.round(cx - this.title.displayWidth / 2), y);
    y += this.title.displayHeight + 4;
    this.sub.setPosition(Math.round(cx - this.sub.width / 2), y);
    y += this.sub.height + 8;
    this.bar.setPosition(cx - BAR_W / 2, y);
  }

  update(_time: number, dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed;

    // The arena's textures: a slice of this thread a frame.
    if (this.loadedAt === null) {
      const g = this.arena.ground;
      const look = this.look;
      if (look.warm ? look.warm(this, look.budget ?? WARM_MS) : !isPainted(g) || g.warm(this, WARM_MS)) {
        this.loadedAt = t;
        // Timed only when there was real work, so a quick second visit doesn't shorten the guess.
        if (t > 300) rememberTime(this.arena.id, t);
      }
    }

    // The bar eases toward the end over the time a load took last time, and finishes when it's done.
    const goal = this.loadedAt !== null ? 1 : Math.min(0.94, 1 - Math.exp((-2.2 * t) / this.expected));
    this.shown += (goal - this.shown) * Math.min(1, dt / BAR_EASE);
    const [track, fill, top] = this.look.bar;
    const g = this.bar.clear();
    g.fillStyle(0x020304).fillRect(-1, -1, BAR_W + 2, 5);
    g.fillStyle(track).fillRect(0, 0, BAR_W, 3);
    const w = Math.round(BAR_W * Phaser.Math.Clamp(this.shown, 0, 1));
    g.fillStyle(fill).fillRect(0, 0, w, 3);
    g.fillStyle(top).fillRect(0, 0, w, 1);
    if (w > 0 && w < BAR_W) g.fillStyle(0xffffff, 0.8).fillRect(w - 1, 0, 1, 3);

    this.animate(t, dt);

    if (this.loadedAt !== null && !this.leaving && t >= MIN_SHOW && this.shown > 0.97) {
      this.leaving = true;
      const cam = this.cameras.main;
      cam.fadeOut(FADE_OUT, 7, 8, 13);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => enterArena(this, this.character, this.arena.id));
    }
  }

  /** The glow layer breathing, flames flickering, the odd falling star. */
  private animate(t: number, dt: number): void {
    const s = t / 1000;
    this.glow.setAlpha(0.86 + 0.14 * Math.sin(s * 1.7));
    for (const { img, light, seed } of this.flames) {
      const k =
        light.kind === 'flicker'
          ? 0.75 + 0.15 * Math.sin(s * 13 + seed) + 0.1 * Math.sin(s * 23.7 + seed * 3)
          : 0.6 + 0.4 * Math.sin(s * 1.3 + seed);
      img.setAlpha(light.alpha * k);
    }
    if (!this.look.stars) return;
    const g = this.streaks.clear();
    const x0 = -LOAD_W / 2;
    const y0 = -LOAD_H / 2;
    if (!this.star && t > this.nextStar) {
      this.star = { x: 40 + Math.random() * 150, y: 4 + Math.random() * 30, vx: -(90 + Math.random() * 40), vy: 45 + Math.random() * 20, t: 0 };
      this.nextStar = t + 1800 + Math.random() * 2200;
    }
    const st = this.star;
    if (!st) return;
    st.t += dt;
    st.x += (st.vx * dt) / 1000;
    st.y += (st.vy * dt) / 1000;
    const life = Math.sin(Math.min(1, st.t / 700) * Math.PI);
    // A bright head and a tail fading behind it, a pixel at a time.
    for (let k = 0; k < 10; k++) {
      const px = Math.round(st.x - (st.vx / 120) * k);
      const py = Math.round(st.y - (st.vy / 120) * k);
      g.fillStyle(k === 0 ? 0xffffff : 0xa8d0ff, life * (1 - k / 10)).fillRect(x0 + px, y0 + py, 1, 1);
    }
    if (st.t > 700) this.star = null;
  }
}
