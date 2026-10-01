import Phaser from 'phaser';
import { sound } from '../audio';
import { warmGlide } from '../art/arenaLoader';
import { COLUMN_BASE, COLUMN_H } from '../art/island';
import { GLIDER_H, GLIDER_HX, GLIDER_HY, GLIDER_W, PUFF_H, gliderSheet, isletBox } from '../art/glide';
import { TREE_BASE_Y, TREE_H, PROP_BASE_Y, PROP_H } from '../art/trees';
import { account } from '../game/cloud';
import { CLASSES, characterById, type Preview } from '../game/characters';
import { playedAs } from '../game/skins';
import { collection } from '../game/collection';
import { artZoom, snap } from '../game/display';
import { sky } from '../game/LitPipeline';
import { settings } from '../game/settings';
import {
  BIG_BOOST,
  FALL_PENALTY,
  GhostRecorder,
  RING_BOOST,
  ghostAt,
  glideHud,
  glideInput,
  loadGhost,
  newFlight,
  saveGhost,
  stepFlight,
  surfaceAt,
  toast,
  type Flight,
  type GhostRun,
  type RaceRow,
} from '../game/glide';
import { session, type Msg, type PeerInfo } from '../net/session';
import { COLUMNS, islandScenery } from '../world/islandLayout';
import {
  ARCH,
  BEACON_AT,
  CHECKPOINTS,
  COURSE_ID,
  COURSE_W,
  DECK_PUFFS,
  DECK_Z,
  FALL_Z,
  FAR_ISLES,
  FAR_PARALLAX,
  GOAL,
  ISLE_DX,
  ISLE_DY,
  ISLE_FALLS,
  ISLE_IMG_X,
  ISLE_IMG_Y,
  ISLETS,
  LANES,
  LAUNCH_Y,
  RINGS,
  RUN_UP,
  START_Z,
  UPDRAFTS,
  WORLD_BOTTOM,
  WORLD_TOP,
  lipY,
  progressOf,
  type GlideRing,
  type SkyIslet,
} from '../world/glideLayout';

/** Art pixels on the view's short side (the world's is about 250): a little wider, for room to see ahead. */
const VIEW_SHORT = 300;
/** Where the glider sits, as a fraction of the view's height from the top, so there's more sky ahead. */
const HERO_AT = 0.3;
/** How fast the camera catches up (per second). */
const CAM_EASE_X = 5;
const CAM_EASE_Y = 9;
/** The pilot's shoulders, where the lines meet, above their feet. */
const HANG = 17;
/** Countdown steps and how long the run-up takes (px/s). */
const COUNT_MS = 750;
const RUN_SPEED = 80;
/** The longest step the flight takes at once (s): longer frames are split. */
const MAX_STEP = 1 / 60;
/**
 * How near a ring's middle the pilot's body must pass, as seen on screen, to count as through it:
 * the hoop's hole and a little, since players aim by eye.
 */
const RING_TOL = { gold: 12, big: 16 };
/** The pilot's body as drawn, from this far above the feet (the flight's x, y - z) down to this far. */
const PILOT_TOP = 26;
const PILOT_FOOT = 2;
/** A ring can be caught while the glider is within this far of it down the course, before or past. */
const RING_DEPTH = 34;
/** Rings in a row, each within this long of the last, climb the chime. */
const STREAK_MS = 3500;
/** How long a fall into the clouds takes before rising at the last beacon. */
const FALL_MS = 900;
/** Online: how often this glider's state goes out. */
const SEND_EVERY = 60;
/** Speed (px/s) past which the wind streams past and the wingtips leave trails. */
const FAST = 125;
/** Depths: things far below, the islets, gliders and rings among them, clouds above. */
const D_SEA = -100;
const D_FAR = -90;
const D_DECK = -50;
const D_DECK_SHADOW = -40;
const D_DRAFT_BASE = -30;
const D_ISLET = 100;
const D_AIR = 150;
const D_LANE = 160;
const D_FLY = 200;
const D_BURST = 260;
const D_OVER = 900;
const D_BIRDS = 950;
/** The Floating Island's own light, a clear bright day. */
const DAY_SKY = { sunDir: [-0.45, 0.5, 0.74] as [number, number, number], sun: [0.78, 0.66, 0.5] as [number, number, number], sky: [0.5, 0.58, 0.72] as [number, number, number], bounce: [0.4, 0.36, 0.32] as [number, number, number] };

type Img = Phaser.GameObjects.Image;

/** A look (texture and animations) and its wing colour. */
interface Look {
  preview: Preview;
  accent: number;
}

/** The look a player picked: `hero` a kit's id, `look` a type's or skin's id within it. */
function lookOf(hero: string, look: string): Look {
  const ch = playedAs(hero, look);
  return { preview: ch.preview, accent: ch.accent };
}

/** The wing's sheet in this colour, painted the first time it's needed. */
function gliderTexture(scene: Phaser.Scene, accent: number): string {
  const key = `gl_glider_${accent.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const { img, frames } = gliderSheet(accent);
  const tex = scene.textures.addCanvas(key, img.toCanvas())!;
  for (const f of frames) tex.add(f.name, 0, f.x, 0, GLIDER_W, GLIDER_H);
  return key;
}

/** A pilot under their wing, with a shadow on whatever lies below. */
class GliderView {
  readonly wing: Phaser.GameObjects.Sprite;
  readonly body: Phaser.GameObjects.Sprite;
  readonly shadow: Img;
  private label: Phaser.GameObjects.BitmapText | null = null;
  private walkAnim: string;
  private moving = false;
  private folded = false;
  private seed = Math.random() * 10;
  alpha = 1;

  constructor(
    private scene: GlideScene,
    readonly look: Look,
    o: { ghost?: boolean; name?: string } = {},
  ) {
    const p = look.preview;
    this.wing = scene.add.sprite(0, 0, gliderTexture(scene, look.accent), 'g2_1').setOrigin(GLIDER_HX / GLIDER_W, GLIDER_HY / GLIDER_H);
    this.body = scene.add.sprite(0, 0, p.texture).setOrigin(0.5, p.originY ?? 31 / 32).setPipeline('Lit');
    this.body.play(p.idle);
    const walk = p.idle.replace('_idle_', '_walk_');
    this.walkAnim = scene.anims.exists(walk) ? walk : p.idle;
    this.shadow = scene.add.image(0, 0, 'shadow');
    if (o.ghost) {
      for (const s of [this.wing, this.body]) s.setTint(0xbfe6ff);
      this.alpha = 0.42;
    }
    if (o.name) this.label = scene.add.bitmapText(0, 0, 'pixel', o.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(0xfff4d6).setDepth(D_OVER - 1);
  }

  /** Walking (on the island before the lip) or hanging still in the harness. */
  setMoving(on: boolean): void {
    if (on === this.moving) return;
    this.moving = on;
    this.body.play(on ? this.walkAnim : this.look.preview.idle, true);
  }

  /** Off the lip: the wing snaps open overhead. */
  unfurl(): void {
    this.scene.tweens.killTweensOf(this.wing);
    this.wing.setScale(1, 0.25);
    this.scene.tweens.add({ targets: this.wing, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** Landed: the wing sinks down behind the pilot and fades. */
  fold(): void {
    if (this.folded) return;
    this.folded = true;
    this.scene.tweens.add({ targets: this.wing, scaleY: 0.2, alpha: 0, duration: 420, ease: 'Quad.easeIn' });
  }

  place(x: number, y: number, z: number, bank: number, pitch: number, time: number, wingOpen: boolean): void {
    const bob = wingOpen && !this.folded ? Math.sin(time * 0.0024 + this.seed) * 0.8 : 0;
    const sx = snap(x);
    const sy = snap(y - z + bob);
    const depth = this.scene.depthFor(x, y, z);
    this.body.setPosition(sx, sy).setDepth(depth).setAlpha(this.alpha);
    const b = Math.max(0, Math.min(4, Math.round(bank * 2) + 2));
    if (!this.folded) {
      this.wing.setFrame(`g${b}_${pitch}`).setVisible(wingOpen).setAlpha(this.alpha);
      this.wing.setPosition(sx + Math.sin(time * 0.0017 + this.seed) * 0.4, snap(sy - HANG)).setDepth(depth - 2e-6);
    } else this.wing.setPosition(sx, snap(sy - HANG)).setDepth(depth - 2e-6);
    // The shadow on the island's meadow before the lip, on the islet below, or faint on the cloud deck far down.
    const ground = surfaceAt(x, y);
    if (y <= lipY(x) + 1 && z >= START_Z - 20) {
      this.shadow
        .setPosition(snap(x), snap(y - START_Z))
        .setScale(wingOpen ? 2.6 : 1, 1)
        .setAlpha(0.5 * this.alpha)
        .setDepth(D_ISLET + 0.005);
    } else if (ground) {
      const h = Math.max(0, z - ground.top);
      const s = Math.max(0.7, 1.6 - h / 180);
      this.shadow
        .setPosition(snap(x), snap(y - ground.top))
        .setScale(wingOpen && !this.folded ? s * 2.6 : 1, s * 1.1)
        .setAlpha(Math.max(0.12, 0.5 - h / 300) * this.alpha)
        .setDepth(this.scene.isletDepth(ground) + 0.005);
    } else {
      const h = Math.max(0, z - DECK_Z);
      const s = Math.max(0.9, 2 - h / 160);
      this.shadow
        .setPosition(snap(x), snap(y - DECK_Z))
        .setScale(s * 2.6, s)
        .setAlpha(Math.max(0.07, 0.24 - h / 700) * this.alpha)
        .setDepth(D_DECK_SHADOW);
    }
    this.label?.setPosition(sx, snap(sy - HANG - 30)).setAlpha(this.alpha);
  }

  setVisible(on: boolean): void {
    for (const o of [this.wing, this.body, this.shadow]) o.setVisible(on);
    this.label?.setVisible(on);
  }

  destroy(): void {
    for (const o of [this.wing, this.body, this.shadow]) o.destroy();
    this.label?.destroy();
  }
}

/** Another racer online: eased toward where they last said they were. */
interface Racer {
  id: number;
  info: PeerInfo;
  view: GliderView;
  x: number;
  y: number;
  z: number;
  bank: number;
  pitch: number;
  /** 0 standing, 1 running, 2 flying, 3 landed, 4 fallen. */
  st: number;
  /** The state last drawn, to open the wing as they leave the lip. */
  was: number;
  tx: number;
  ty: number;
  tz: number;
  finish: number | null;
}

interface RingObj {
  ring: GlideRing;
  img: Phaser.GameObjects.Sprite;
  halo: Img;
  shadow: Img;
  passed: boolean;
}

/**
 * Sky Glide: jump off the Floating Island's front lip under a paraglider
 * and ride the wind down to the goal islet far below, through rings,
 * updrafts and wind rivers, round (or over, or under) floating islets.
 * A race against the clock and the ghost of your best run, or online
 * against friends in the same room, everyone launching together.
 *
 * Height is drawn the game's way: a thing z up is drawn z pixels higher
 * than the spot it's over, where its shadow lies; the sea of clouds deep
 * below scrolls slower than the course, and wisps high above faster.
 */
export class GlideScene extends Phaser.Scene {
  private character = '';
  private look!: Look;
  private hero!: GliderView;
  private f!: Flight;
  /** On the island, running for the lip, not yet flying. */
  private launched = false;
  private landed = false;
  private fallT = 0;
  private cp = 0;
  private streak = 0;
  private lastRingT = -99999;
  private ringNext = 0;
  private rings: RingObj[] = [];
  private beacons: { islet: SkyIslet; glow: Img; lit: boolean }[] = [];
  private isletImgs: { islet: SkyIslet; img: Img; depth: number }[] = [];
  private puffs: Img[] = [];
  private drafts: { base: Phaser.GameObjects.Sprite; rings: Phaser.GameObjects.Sprite[]; motes: Phaser.GameObjects.Particles.ParticleEmitter; y: number }[] = [];
  private lanes: { emitter: Phaser.GameObjects.Particles.ParticleEmitter; y0: number; y1: number }[] = [];
  private wisps: { img: Img; x: number; y: number }[] = [];
  private birds: { img: Phaser.GameObjects.Sprite; dx: number }[] = [];
  private flockT = 6000;
  private sea!: Phaser.GameObjects.TileSprite;
  private falls: { solid: Phaser.GameObjects.TileSprite; fade: Phaser.GameObjects.TileSprite }[] = [];
  private streaks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trails!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cloudSplash!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private camX = 0;
  private camY = 0;
  private zoom = 2;
  private viewW = 400;
  private viewH = 300;
  /** Run time (ms), from GO. */
  private runMs = 0;
  private countT = 0;
  private ghost: GhostRun | null = null;
  private ghostView: GliderView | null = null;
  private recorder = new GhostRecorder();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private wasDiving = false;
  private inDraft = false;
  private gustT = 0;
  private bonkT = 0;
  /** Online. */
  private racers = new Map<number, Racer>();
  private offNet: (() => void) | null = null;
  private sendT = 0;
  private restarting = false;
  private offQuality: (() => void) | null = null;

  constructor() {
    super('glide');
  }

  create(data: { character?: string; go?: boolean }): void {
    this.character = data?.character ?? '';
    this.restarting = false;
    this.launched = this.landed = false;
    this.fallT = this.cp = this.streak = this.ringNext = this.runMs = this.countT = 0;
    this.lastRingT = -99999;
    this.rings = [];
    this.beacons = [];
    this.isletImgs = [];
    this.puffs = [];
    this.drafts = [];
    this.lanes = [];
    this.wisps = [];
    this.birds = [];
    this.falls = [];
    this.racers = new Map();
    this.recorder = new GhostRecorder();
    this.wasDiving = this.inDraft = false;
    this.gustT = this.bonkT = this.sendT = 0;
    this.flockT = 6000;
    warmGlide(this);

    const ch = characterById(this.character);
    this.look = { preview: ch.preview, accent: ch.accent };
    this.lights.enable().setAmbientColor(0x000000);
    sound.setOutdoors(true);
    sound.setDaylight(1);
    sound.setFire(0);

    const cam = this.cameras.main.setOrigin(0, 0).setRoundPixels(true);
    this.buildSky();
    this.buildIsland();
    this.buildCourse();
    this.buildEffects();

    // Racers wait on the island's meadow, side by side, back from the lip.
    const online = session.active;
    const slot = online ? this.slotOf(session.you) : 1.5;
    const x0 = COURSE_W / 2 + (slot - 1.5) * 26;
    this.f = newFlight(x0, lipY(x0) - RUN_UP, START_Z);
    this.hero = new GliderView(this, this.look);

    // The ghost of the best run on this course (alone only: racing friends is enough company).
    this.ghost = online ? null : loadGhost(COURSE_ID);
    this.ghostView = this.ghost ? new GliderView(this, { preview: lookPreview(this.ghost.look) ?? this.look.preview, accent: this.ghost.accent }, { ghost: true }) : null;
    this.ghostView?.setVisible(false);

    Object.assign(glideHud, {
      phase: online && !data?.go ? 'lobby' : 'count',
      count: 3,
      time: 0,
      best: collection.glideBest(COURSE_ID),
      newBest: false,
      rings: 0,
      ringsTotal: RINGS.length,
      z: START_Z,
      v: 0,
      progress: 0,
      ghost: this.ghost ? 0 : -1,
      diving: false,
      low: false,
      penalty: 0,
      online,
      host: session.isHost,
      code: session.room?.code ?? '',
      players: [],
      results: [],
      toast: '',
      toastT: 0,
    });

    if (online) {
      for (const p of session.peers.values()) this.addRacer(p);
      this.offNet = session.on((m) => this.receive(m));
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-ENTER', () => this.retry());
    kb.on('keydown-R', () => this.retry());

    this.fit();
    this.followHero(1);
    cam.fadeIn(450, 7, 8, 13);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => cam.fadeEffect.reset());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    // Paused, the wind falls quiet (it picks up again with the flight).
    this.events.on(Phaser.Scenes.Events.PAUSE, this.hush, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  private hush(): void {
    sound.glideWindEnd();
  }

  private shutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this);
    this.events.off(Phaser.Scenes.Events.PAUSE, this.hush, this);
    this.offNet?.();
    this.offNet = null;
    this.offQuality?.();
    this.offQuality = null;
    sound.glideWindEnd();
    glideInput.mx = glideInput.my = 0;
    glideInput.dive = false;
    // Leaving for good (not restarting a run): out of the room too.
    if (!this.restarting) session.close();
  }

  // ---------------------------------------------------------------- Building the sky

  private buildSky(): void {
    const add = this.add;
    // The sea of clouds far below, scrolling slower than the course.
    this.sea = add.tileSprite(0, 0, 8, 8, 'gl_sea').setOrigin(0).setScrollFactor(0).setDepth(D_SEA);
    // Far islands deep down in it.
    for (const f of FAR_ISLES) add.image(f.x, f.y, `isle_islet${f.k}`).setScrollFactor(FAR_PARALLAX).setDepth(D_FAR).setTint(0xcfe2f4).setAlpha(0.8);
    // Cloud tops on the deck just below the course.
    for (const p of DECK_PUFFS) this.puffs.push(add.image(p.x, p.y - DECK_Z, `gl_puff${p.v}`).setFlipX(p.flip).setDepth(D_DECK + p.y * 1e-5).setOrigin(0.5, 0.7));
    // Wisps high above, drifting past faster than the course.
    for (let k = 0; k < 5; k++) {
      const img = add.image(0, 0, `isle_wisp${k % 3}`).setScrollFactor(1.35).setDepth(D_OVER).setAlpha(0.5).setFlipX(k % 2 === 1);
      this.wisps.push({ img, x: Math.random() * COURSE_W, y: WORLD_TOP * 1.35 + k * 140 + Math.random() * 60 });
    }
  }

  /** The Floating Island at the top, its meadow START_Z up, with its trees, columns and falls. */
  private buildIsland(): void {
    const add = this.add;
    add.image(ISLE_IMG_X, ISLE_IMG_Y, 'isle_land').setOrigin(0).setPipeline('Lit').setDepth(D_ISLET);
    add.image(ISLE_IMG_X, ISLE_IMG_Y, 'isle_land_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_ISLET + 0.001);
    for (const fl of ISLE_FALLS) {
      const solid = add.tileSprite(fl.x - 5, fl.y - 1, 10, 44, 'isle_fall').setOrigin(0).setDepth(D_ISLET + 0.002).setAlpha(0.95);
      const fade = add.tileSprite(fl.x - 5, fl.y + 43, 10, 120, 'isle_fall').setOrigin(0).setDepth(D_ISLET + 0.002);
      fade.setAlpha(0.95, 0.95, 0, 0);
      add.image(fl.x, fl.y - 1, 'isle_foam').setDepth(D_ISLET + 0.003);
      this.falls.push({ solid, fade });
    }
    const sc = islandScenery();
    const on = (x: number, y: number) => ({ x: x + ISLE_DX, y: y + ISLE_DY });
    for (const t of sc.trees) {
      const p = on(t.x, t.y);
      add.image(p.x, p.y, 'tree', `${t.kind}${t.v}`).setOrigin(0.5, TREE_BASE_Y / TREE_H).setFlipX(t.flip).setPipeline('Lit').setDepth(D_ISLET + 0.01 + p.y * 1e-5);
    }
    for (const pr of sc.props) {
      const p = on(pr.x, pr.y);
      const img = pr.kind === 'rock' ? add.image(p.x, p.y, 'rock', `r${pr.v}`).setOrigin(0.5, 12 / 14) : add.image(p.x, p.y, 'flora', `${pr.kind}${pr.v}`).setOrigin(0.5, PROP_BASE_Y / PROP_H);
      img.setFlipX(pr.flip).setPipeline('Lit').setDepth(D_ISLET + 0.01 + p.y * 1e-5);
    }
    for (const c of COLUMNS) {
      const p = on(c.x, c.y);
      add.image(p.x, p.y, 'shadow').setDepth(D_ISLET + 0.005).setAlpha(0.6);
      add.image(p.x, p.y, 'isle_column', `c${c.v}`).setOrigin(0.5, COLUMN_BASE / COLUMN_H).setPipeline('Lit').setDepth(D_ISLET + 0.01 + p.y * 1e-5);
    }
  }

  /** Islets, the goal and its arch, rings, updrafts and wind rivers. */
  private buildCourse(): void {
    const add = this.add;
    const islet = (l: SkyIslet, key: string, i: number) => {
      const box = isletBox(l);
      const depth = D_ISLET + 1 + i * 0.02;
      const img = add.image(Math.round(l.x - box.ox), Math.round(l.y - l.top - box.oy), key).setOrigin(0).setDepth(depth);
      this.isletImgs.push({ islet: l, img, depth });
      if (l.kind === 'beacon') {
        const glow = add
          .image(Math.round(l.x + BEACON_AT.dx * l.rx), Math.round(l.y - l.top + BEACON_AT.dy * l.ry - 21), 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0x5ad8ff)
          .setDepth(depth + 0.01);
        this.beacons.push({ islet: l, glow, lit: false });
      }
    };
    ISLETS.forEach((l, i) => islet(l, `gl_islet${i}`, i));
    islet(GOAL, 'gl_goal', ISLETS.length);
    add.image(ARCH.x, ARCH.y - GOAL.top, 'gl_arch').setOrigin(0.5, 1).setDepth(D_FLY + ARCH.y * 1e-5);

    for (const r of RINGS) {
      const key = r.big ? 'gl_ring_big' : 'gl_ring';
      const img = add.sprite(r.x, r.y - r.z, key).setDepth(D_FLY + r.y * 1e-5);
      img.play({ key: `${key}_spin`, startFrame: Math.floor(Math.random() * 8) });
      const halo = add
        .image(r.x, r.y - r.z, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(r.big ? 0x6ac8ff : 0xffd060)
        .setScale(r.big ? 2 : 1.5)
        .setAlpha(0.35)
        .setDepth(D_FLY + r.y * 1e-5 - 1e-6);
      const shadow = add.image(r.x, r.y - DECK_Z, 'shadow').setScale(r.big ? 2.2 : 1.6, 0.9).setAlpha(0.16).setDepth(D_DECK_SHADOW);
      this.rings.push({ ring: r, img, halo, shadow, passed: false });
    }

    for (const u of UPDRAFTS) {
      const k = u.r / 32;
      const base = add.sprite(u.x, u.y - DECK_Z, 'gl_draft').setScale(k).setAlpha(0.6).setTint(0xfff4dc).setDepth(D_DRAFT_BASE);
      base.play('gl_draft_spin');
      const rings: Phaser.GameObjects.Sprite[] = [];
      [42, 92, 142].forEach((z, i) => {
        const s = add.sprite(u.x, u.y - z, 'gl_draft').setScale(k * (1 - i * 0.12)).setAlpha(0.32 - i * 0.08).setTint(0xfffaf0).setDepth(D_AIR);
        s.play({ key: 'gl_draft_spin', startFrame: i * 2 });
        rings.push(s);
      });
      const motes = add.particles(0, 0, 'spark', {
        emitZone: {
          type: 'random',
          source: {
            getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
              const a = Math.random() * Math.PI * 2;
              const d = Math.sqrt(Math.random()) * u.r * 0.8;
              p.x = u.x + Math.cos(a) * d;
              p.y = u.y - DECK_Z + Math.sin(a) * d * 0.35;
              return p;
            },
          },
        } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 1500, max: 2300 },
        speedY: { min: -120, max: -80 },
        speedX: { min: -6, max: 6 },
        scale: { start: 0.55, end: 0.35 },
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
        tint: [0xffffff, 0xfff4c8, 0xdff4ff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 55,
        emitting: false,
      }).setDepth(D_AIR);
      this.drafts.push({ base, rings, motes, y: u.y });
    }

    for (const l of LANES) {
      const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      const ux = (l.x2 - l.x1) / len;
      const uy = (l.y2 - l.y1) / len;
      const angle = Phaser.Math.RadToDeg(Math.atan2(uy, ux));
      const emitter = add.particles(0, 0, 'gl_streak', {
        emitZone: {
          type: 'random',
          source: {
            getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
              const t = Math.random();
              const o = (Math.random() * 2 - 1) * l.w * 0.9;
              // Streaks fill the air at the heights a glider rides the river.
              p.x = l.x1 + (l.x2 - l.x1) * t - uy * o;
              p.y = l.y1 + (l.y2 - l.y1) * t + ux * o - (40 + Math.random() * 80);
              return p;
            },
          },
        } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 500, max: 850 },
        speed: { min: 200, max: 280 },
        angle,
        rotate: angle,
        scaleX: { min: 0.8, max: 1.6 },
        scaleY: 1,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
        frequency: 35,
        emitting: false,
      }).setDepth(D_LANE);
      this.lanes.push({ emitter, y0: Math.min(l.y1, l.y2) - 140, y1: Math.max(l.y1, l.y2) + 40 });
    }
  }

  /** Wind streaming past a fast glider, wingtip trails, clouds splashing up, and sparks for rings. */
  private buildEffects(): void {
    const add = this.add;
    this.streaks = add.particles(0, 0, 'gl_streak', {
      lifespan: { min: 260, max: 420 },
      speed: { min: 260, max: 360 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.55 },
      scaleX: { min: 0.6, max: 1.3 },
      frequency: 40,
      emitting: false,
    }).setDepth(D_BURST);
    this.trails = add.particles(0, 0, 'spark', {
      lifespan: 420,
      speed: 0,
      scale: { start: 0.45, end: 0.2 },
      alpha: { start: 0.55, end: 0 },
      tint: 0xffffff,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(D_FLY - 0.01);
    this.cloudSplash = add.particles(0, 0, 'glow', {
      lifespan: { min: 600, max: 1100 },
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      gravityY: 40,
      scale: { start: 0.6, end: 1.4 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xffffff, 0xe6ecf8, 0xc8d4ee],
      emitting: false,
    }).setDepth(D_BURST);
    this.sparks = add.particles(0, 0, 'spark', {
      lifespan: { min: 350, max: 700 },
      speed: { min: 30, max: 110 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(D_BURST);
    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      for (const d of this.drafts) d.motes.frequency = 55 * k;
      for (const l of this.lanes) l.emitter.frequency = 35 * k;
      this.streaks.frequency = 40 * k;
    });
  }

  // ---------------------------------------------------------------- Layout and camera

  private fit(): void {
    const { width, height } = this.scale;
    // Whole canvas pixels per art pixel, a step wider than the world's view where it can be.
    this.zoom = Math.max(1, Math.round((artZoom(width, height) * 250) / VIEW_SHORT));
    this.cameras.main.setZoom(this.zoom);
    this.viewW = width / this.zoom;
    this.viewH = height / this.zoom;
    this.sea.setSize(Math.ceil(this.viewW) + 2, Math.ceil(this.viewH) + 2);
  }

  private followHero(ease: number): void {
    const f = this.f;
    const tx = f.x - this.viewW / 2;
    const ty = f.y - f.z - this.viewH * HERO_AT;
    this.camX += (tx - this.camX) * Math.min(1, ease * CAM_EASE_X);
    this.camY += (ty - this.camY) * Math.min(1, ease * CAM_EASE_Y);
    // Keep the course in view: centred when the view is wider than it.
    const minX = -60;
    const maxX = COURSE_W + 60 - this.viewW;
    const x = maxX < minX ? (COURSE_W - this.viewW) / 2 : Math.max(minX, Math.min(maxX, this.camX));
    const y = Math.max(WORLD_TOP, Math.min(WORLD_BOTTOM - this.viewH, this.camY));
    this.cameras.main.setScroll(snap(x), snap(y));
  }

  /** Where a glider at (x, y, z) sorts: among the rings by how far down the course, but under an islet it's below or behind. */
  depthFor(x: number, y: number, z: number): number {
    let d = D_FLY + y * 1e-5 + 0.00001;
    for (const it of this.isletImgs) {
      const l = it.islet;
      if (Math.abs(x - l.x) > l.rx + 30 || y > l.y + l.ry + 4 || y < l.y - l.ry - l.thick - 40) continue;
      if (z < l.top - 2) d = Math.min(d, it.depth - 0.01);
    }
    return d;
  }

  isletDepth(l: SkyIslet): number {
    return this.isletImgs.find((it) => it.islet === l)?.depth ?? D_ISLET;
  }

  // ---------------------------------------------------------------- Each frame

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    sky.sunDir = DAY_SKY.sunDir;
    sky.sunColor = DAY_SKY.sun;
    sky.sky = DAY_SKY.sky;
    sky.bounce = DAY_SKY.bounce;
    if (glideHud.toastT > 0) glideHud.toastT -= dt;
    if (glideHud.penalty > 0) glideHud.penalty -= dt;
    glideHud.host = session.isHost;
    glideHud.online = session.active;

    const phase = glideHud.phase;
    if (phase === 'count') this.countdown(dt);
    else if (phase === 'fly') this.fly(dt, time);
    // Landed: the ghost's clock runs on, so it flies its run out rather than freezing.
    else if (phase === 'done') this.runMs += dt;
    this.runUp(dt);

    const f = this.f;
    const open = this.launched && !this.landed;
    this.hero.place(f.x, f.y, f.z, f.bank, f.pitch, time, open);
    this.updateGhost(time);
    this.updateRacers(dt, time);
    this.updateHud();
    this.followHero(dt / 1000);
    this.updateScenery(time, dt);
    this.net(dt);
  }

  private countdown(dt: number): void {
    this.countT += dt;
    const step = Math.floor(this.countT / COUNT_MS);
    const count = 3 - step;
    if (count !== glideHud.count || this.countT === dt) {
      glideHud.count = Math.max(0, count);
      if (count >= 1) sound.glideCount(false);
    }
    if (count <= 0) {
      glideHud.count = 0;
      glideHud.phase = 'fly';
      sound.glideCount(true);
      toast('GO!', 700);
      this.hero.setMoving(true);
    }
  }

  /** From GO, the pilot runs for the lip and leaps off it into the air. */
  private runUp(dt: number): void {
    if (this.launched || glideHud.phase !== 'fly') return;
    const f = this.f;
    f.y += (RUN_SPEED * dt) / 1000;
    if (f.y >= lipY(f.x)) {
      this.launched = true;
      f.y = lipY(f.x);
      f.v = 95;
      this.hero.setMoving(false);
      this.hero.unfurl();
      sound.glideWhoosh(0, 0.8);
    }
  }

  private fly(dt: number, time: number): void {
    const f = this.f;
    this.runMs += dt;
    if (!this.landed) this.recorder.push(this.runMs, f);
    if (!this.launched || this.landed) return;

    if (this.fallT > 0) {
      this.fallT -= dt;
      f.z -= (60 * dt) / 1000;
      f.y += (f.v * 0.4 * dt) / 1000;
      this.hero.alpha = Math.max(0, this.fallT / FALL_MS);
      if (this.fallT <= 0) this.respawn();
      return;
    }

    const inp = this.readInput();
    const steps = Math.ceil(dt / 1000 / MAX_STEP);
    const h = dt / 1000 / steps;
    for (let i = 0; i < steps && !this.landed && this.fallT <= 0; i++) {
      for (const e of stepFlight(f, inp, h)) {
        if (e.kind === 'land') this.land();
        else if (e.kind === 'hop') {
          sound.hop(0);
          this.sparks.setParticleTint(0x9ad066);
          this.sparks.emitParticleAt(f.x, f.y - e.islet.top, 6);
        } else if (e.kind === 'bonk' && this.bonkT <= 0) {
          this.bonkT = 400;
          sound.thud(0, true);
          this.cameras.main.shake(140, 0.004);
          this.sparks.setParticleTint(0xfff0b0);
          this.sparks.emitParticleAt(f.x, f.y - f.z - 8, 8);
        }
      }
      this.checkRings(time);
    }
    this.bonkT -= dt;

    // Past a beacon, it's where a fall comes back to.
    for (let i = this.cp + 1; i < CHECKPOINTS.length; i++) {
      if (f.y < CHECKPOINTS[i].y) break;
      this.cp = i;
      const b = this.beacons[i - 1];
      if (b && !b.lit) {
        b.lit = true;
        b.glow.setTint(0xffd060);
        this.sparks.setParticleTint(0xffe08a);
        this.sparks.emitParticleAt(b.glow.x, b.glow.y, 14);
        sound.glideRing(0, 10, false);
        toast('CHECKPOINT');
      }
    }

    // Into the clouds.
    if (!this.landed && f.z < FALL_Z && !surfaceAt(f.x, f.y)) {
      this.fallT = FALL_MS;
      sound.glideSplash();
      sound.glideWindEnd();
      this.cloudSplash.emitParticleAt(f.x, f.y - DECK_Z, 14);
      return;
    }

    // Diving and rising air, heard and seen.
    const diving = f.pitch === 2;
    if (diving && !this.wasDiving) sound.glideWhoosh(0, 1);
    this.wasDiving = diving;
    this.gustT -= dt;
    const drafting = f.draft > 6;
    if (drafting && !this.inDraft && this.gustT <= 0) {
      sound.glideGust();
      this.gustT = 1200;
    }
    this.inDraft = drafting;
    sound.glideWind(Math.min(1, f.v / 220), diving);
  }

  private readInput(): { steer: number; pitch: number; dive: boolean } {
    const k = this.keys;
    // Online with the pause menu open the glider flies on, hands off.
    if (session.paused) return { steer: 0, pitch: 0, dive: false };
    const right = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const down = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    return {
      steer: Math.max(-1, Math.min(1, glideInput.mx + right)),
      pitch: Math.max(-1, Math.min(1, glideInput.my + down)),
      dive: glideInput.dive || k.SPACE.isDown || k.SHIFT.isDown,
    };
  }

  private checkRings(time: number): void {
    const f = this.f;
    // Screen space, not the ring's exact spot in the air: height and distance down the course
    // look the same from above, so a pilot drawn inside the hoop has to count as through it.
    const feet = f.y - f.z;
    while (this.ringNext < this.rings.length && this.rings[this.ringNext].ring.y < f.y - RING_DEPTH) this.ringNext++;
    for (let i = this.ringNext; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (r.ring.y > f.y + RING_DEPTH) break;
      if (r.passed) continue;
      const tol = r.ring.big ? RING_TOL.big : RING_TOL.gold;
      const ry = r.ring.y - r.ring.z;
      const dx = f.x - r.ring.x;
      // The nearest point of the pilot's body to the ring's middle.
      const dy = Math.max(feet - PILOT_TOP, Math.min(feet - PILOT_FOOT, ry)) - ry;
      if (dx * dx + dy * dy < tol * tol) this.passRing(r, time);
    }
  }

  private passRing(r: RingObj, time: number): void {
    r.passed = true;
    glideHud.rings++;
    this.streak = time - this.lastRingT < STREAK_MS ? this.streak + 1 : 0;
    this.lastRingT = time;
    this.f.v += r.ring.big ? BIG_BOOST : RING_BOOST;
    sound.glideRing(0, this.streak, !!r.ring.big);
    if (r.ring.big) sound.glideWhoosh(0, 1);
    // A flash of the ring swelling away, and sparks.
    const key = r.ring.big ? 'gl_ring_big' : 'gl_ring';
    const burst = this.add.image(r.img.x, r.img.y, key, r.img.frame.name).setBlendMode(Phaser.BlendModes.ADD).setDepth(D_BURST);
    this.tweens.add({ targets: burst, scale: 2.1, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });
    this.sparks.setParticleTint(r.ring.big ? 0x9adcff : 0xffe08a);
    this.sparks.emitParticleAt(r.img.x, r.img.y, r.ring.big ? 18 : 10);
    r.img.stop().setTint(0x9a98b8).setAlpha(0.3);
    r.halo.setVisible(false);
    r.shadow.setVisible(false);
  }

  private respawn(): void {
    const c = CHECKPOINTS[this.cp];
    const f = newFlight(c.x, c.y, c.z);
    this.f = f;
    this.hero.alpha = 1;
    this.runMs += FALL_PENALTY;
    glideHud.penalty = 1300;
    toast(`+${FALL_PENALTY / 1000}S`, 1100);
    this.ringNext = 0;
    this.streak = 0;
    sound.glideGust();
    this.cameras.main.flash(250, 255, 255, 255);
  }

  private land(): void {
    if (this.landed) return;
    this.landed = true;
    const ms = Math.round(this.runMs);
    glideHud.time = ms;
    glideHud.phase = 'done';
    sound.glideWindEnd();
    sound.glideLand();
    this.hero.fold();
    this.cloudSplash.setParticleTint(0xd8f0b0);
    this.cloudSplash.emitParticleAt(this.f.x, this.f.y, 8);
    // Confetti over the meadow.
    this.sparks.setParticleTint(0xffe08a);
    this.sparks.emitParticleAt(this.f.x, this.f.y - 20, 24);
    const best = collection.recordGlide(COURSE_ID, ms);
    glideHud.newBest = best;
    glideHud.best = collection.glideBest(COURSE_ID);
    if (best || !this.ghost || ms < this.ghost.t) saveGhost(COURSE_ID, { t: ms, look: this.look.preview.texture, accent: this.look.accent, s: this.recorder.s });
    if (best) toast('NEW BEST!', 2200);
    if (session.active) session.send({ t: 'gf', ms });
    this.standings();
  }

  // ---------------------------------------------------------------- The ghost and other racers

  private updateGhost(time: number): void {
    const g = this.ghost;
    const v = this.ghostView;
    if (!g || !v) return;
    const s = glideHud.phase === 'fly' || glideHud.phase === 'done' ? ghostAt(g, this.runMs) : null;
    if (!s) {
      // Before GO it waits unseen; once its run is over it has landed and gone.
      v.setVisible(false);
      glideHud.ghost = glideHud.phase === 'fly' || glideHud.phase === 'done' ? 1 : 0;
      return;
    }
    v.setVisible(true);
    const flying = s.y > LAUNCH_Y + 2;
    v.setMoving(!flying && glideHud.phase === 'fly');
    v.place(s.x, s.y, s.z, s.bank, s.pitch, time, flying);
    glideHud.ghost = progressOf(s.y);
  }

  private slotOf(id: number): number {
    const ids = [session.you, ...session.peers.keys()].sort((a, b) => a - b);
    return Math.max(0, ids.indexOf(id));
  }

  private addRacer(p: PeerInfo): void {
    if (this.racers.has(p.id)) return;
    const look = lookOf(p.hero, p.look);
    const view = new GliderView(this, look, { name: p.name });
    const x = COURSE_W / 2 + (this.slotOf(p.id) - 1.5) * 26;
    const y = lipY(x) - RUN_UP;
    this.racers.set(p.id, { id: p.id, info: p, view, x, y, z: START_Z, bank: 0, pitch: 1, st: 0, was: 0, tx: x, ty: y, tz: START_Z, finish: null });
  }

  private removeRacer(id: number): void {
    this.racers.get(id)?.view.destroy();
    this.racers.delete(id);
    this.standings();
  }

  private receive(m: Msg): void {
    if (m.t === 'peer+') this.addRacer(m.p as PeerInfo);
    else if (m.t === 'peer-') this.removeRacer(m.id as number);
    else if (m.t === 'closed') {
      toast('CONNECTION LOST', 2200);
      for (const id of [...this.racers.keys()]) this.removeRacer(id);
      if (glideHud.phase === 'lobby') glideHud.phase = 'count';
    } else if (m.t === 'gs') {
      // The host started the race: everyone to the lip for the countdown.
      this.restart(true);
    } else if (m.t === 'gp') {
      const r = this.racers.get(m.f as number);
      if (!r) return;
      r.tx = Number(m.x);
      r.ty = Number(m.y);
      r.tz = Number(m.z);
      r.bank = Number(m.b) / 10;
      r.pitch = Number(m.p);
      r.st = Number(m.st);
    } else if (m.t === 'gf') {
      const r = this.racers.get(m.f as number);
      if (!r) return;
      r.finish = Number(m.ms);
      this.standings();
    }
  }

  private updateRacers(dt: number, time: number): void {
    const k = Math.min(1, (dt / 1000) * 14);
    for (const r of this.racers.values()) {
      if (Math.hypot(r.tx - r.x, r.ty - r.y) > 90) {
        r.x = r.tx;
        r.y = r.ty;
        r.z = r.tz;
      } else {
        r.x += (r.tx - r.x) * k;
        r.y += (r.ty - r.y) * k;
        r.z += (r.tz - r.z) * k;
      }
      r.view.setVisible(r.st !== 4);
      r.view.setMoving(r.st === 1);
      if (r.st === 2 && r.was < 2) r.view.unfurl();
      r.was = r.st;
      if (r.st === 3) r.view.fold();
      r.view.place(r.x, r.y, r.z, r.bank, r.pitch, time, r.st === 2);
    }
    const names = [account()?.username ?? 'You', ...[...this.racers.values()].map((r) => r.info.name)];
    if (names.join() !== glideHud.players.join()) glideHud.players = names;
  }

  private net(dt: number): void {
    if (!session.active) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = SEND_EVERY;
    const f = this.f;
    const st = this.fallT > 0 ? 4 : this.landed ? 3 : this.launched ? 2 : glideHud.phase === 'fly' ? 1 : 0;
    session.send({ t: 'gp', x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10, z: Math.round(f.z * 10) / 10, b: Math.round(f.bank * 10), p: f.pitch, st });
  }

  /** The race's finishers, fastest first, then those still flying. */
  private standings(): void {
    if (!session.active) return;
    const rows: RaceRow[] = [{ name: account()?.username ?? 'You', ms: this.landed ? glideHud.time : null, me: true }];
    for (const r of this.racers.values()) rows.push({ name: r.info.name, ms: r.finish, me: false });
    rows.sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    glideHud.results = rows;
  }

  // ---------------------------------------------------------------- The HUD's buttons

  /** Fly again (alone), or start the race again for everyone (the host, online). */
  retry(): void {
    if (session.active) {
      if (!session.isHost || glideHud.phase === 'count' || (glideHud.phase === 'fly' && !this.landed)) return;
      session.send({ t: 'gs' });
      this.restart(true);
      return;
    }
    if (glideHud.phase !== 'done' && glideHud.phase !== 'fly') return;
    this.restart(false);
  }

  /** The host starts the race from the lobby. */
  startRace(): void {
    if (!session.active || !session.isHost || glideHud.phase !== 'lobby') return;
    session.send({ t: 'gs' });
    this.restart(true);
  }

  private restart(go: boolean): void {
    if (this.restarting) return;
    this.restarting = true;
    this.scene.restart({ character: this.character, go });
  }

  // ---------------------------------------------------------------- The HUD's numbers, and the scenery's motion

  private updateHud(): void {
    const f = this.f;
    if (glideHud.phase === 'fly') glideHud.time = Math.round(this.runMs);
    glideHud.z = Math.max(0, f.z);
    glideHud.v = f.v;
    glideHud.progress = progressOf(f.y);
    glideHud.diving = f.pitch === 2 && this.launched && !this.landed;
    glideHud.low = this.launched && !this.landed && f.z < 22 && !surfaceAt(f.x, f.y + 40);
  }

  private updateScenery(time: number, dt: number): void {
    const cam = this.cameras.main;
    const top = cam.scrollY - 80;
    const bottom = cam.scrollY + this.viewH + 200;
    this.sea.setTilePosition(cam.scrollX * 0.35 + time * 0.004, cam.scrollY * 0.35);

    for (const p of this.puffs) p.setVisible(p.y > top - PUFF_H && p.y < bottom);
    for (const it of this.isletImgs) it.img.setVisible(it.img.y < bottom + 40 && it.img.y + it.img.height > top);
    for (const b of this.beacons) b.glow.setScale(1.4 + Math.sin(time * 0.004) * 0.2).setAlpha(0.7);
    for (const r of this.rings) {
      const on = r.img.y > top - 40 && r.img.y < bottom;
      r.img.setVisible(on);
      if (!r.passed) {
        r.halo.setVisible(on).setAlpha(0.28 + Math.sin(time * 0.006 + r.ring.y) * 0.1);
        r.shadow.setVisible(on);
      }
    }
    for (const d of this.drafts) {
      const on = d.y > top - 40 && d.y - 160 < bottom;
      d.motes.emitting = on;
      d.base.setVisible(on);
      for (const s of d.rings) s.setVisible(on);
    }
    for (const l of this.lanes) l.emitter.emitting = l.y1 > top && l.y0 < bottom;
    for (const fl of this.falls) {
      fl.solid.tilePositionY = -time * 0.085;
      fl.fade.tilePositionY = -time * 0.085 - 44;
    }

    // Wisps high above slide past faster than the course; round again from below once past.
    for (const w of this.wisps) {
      w.x += dt * 0.004;
      const sy = w.y - cam.scrollY * 1.35;
      if (sy < -60) {
        w.y = cam.scrollY * 1.35 + this.viewH + 40 + Math.random() * 160;
        w.x = -40 + Math.random() * (COURSE_W + 80);
      }
      w.img.setPosition(Math.round(w.x + cam.scrollX * 0.35), Math.round(w.y));
    }

    // Wind streaming past and wingtip trails when fast.
    const f = this.f;
    const flying = this.launched && !this.landed && this.fallT <= 0;
    const fast = flying && (f.v > FAST || f.pitch === 2);
    this.streaks.emitting = false;
    this.trails.emitting = false;
    if (fast) {
      const back = Phaser.Math.RadToDeg(Math.atan2(-Math.cos(f.h), -Math.sin(f.h)));
      const n = Math.random() < (f.v - 90) / 200 ? 1 : 0;
      if (n) {
        this.streaks.setParticleSpeed(f.v * 1.6);
        this.streaks.particleAngle = back;
        this.streaks.particleRotate = back;
        this.streaks.emitParticleAt(f.x + (Math.random() - 0.5) * 120, f.y - f.z + 20 + Math.random() * 90, 1);
      }
      const sy = f.y - f.z - HANG - 30;
      this.trails.emitParticleAt(f.x - 26 + f.bank * 2, sy + f.bank * 3, 1);
      this.trails.emitParticleAt(f.x + 26 + f.bank * 2, sy - f.bank * 3, 1);
    }

    this.updateBirds(dt);
  }

  /** Now and then a little flock crosses high above. */
  private updateBirds(dt: number): void {
    const cam = this.cameras.main;
    for (const b of this.birds) {
      b.img.x += (b.dx * dt) / 1000;
      b.img.setFrame(Math.floor(this.time.now / 160) % 2 ? 'b1' : 'b0');
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      const sx = b.img.x - cam.scrollX * 1.2;
      if ((b.dx > 0 && sx > this.viewW + 30) || (b.dx < 0 && sx < -30)) {
        b.img.destroy();
        this.birds.splice(i, 1);
      }
    }
    if (this.birds.length) return;
    this.flockT -= dt;
    if (this.flockT > 0) return;
    this.flockT = 9000 + Math.random() * 11000;
    const right = Math.random() < 0.5;
    const n = 3 + Math.floor(Math.random() * 3);
    const y0 = cam.scrollY * 1.2 + this.viewH * (0.15 + Math.random() * 0.5);
    for (let k = 0; k < n; k++) {
      const back = k * 8;
      const x = cam.scrollX * 1.2 + (right ? -10 - back : this.viewW + 10 + back);
      const img = this.add.sprite(x, y0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 5, 'isle_bird', 'b0').setScrollFactor(1.2).setDepth(D_BIRDS).setAlpha(0.85);
      this.birds.push({ img, dx: right ? 34 : -34 });
    }
  }
}

/** A look's preview from its texture key, for a ghost flown by another hero. */
function lookPreview(texture: string): Preview | null {
  for (const cls of CLASSES) {
    for (const t of cls.types) {
      if (t.preview.texture === texture) return t.preview;
      for (const s of t.skins ?? []) if (s.preview.texture === texture) return s.preview;
    }
  }
  return null;
}
