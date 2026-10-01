import Phaser from 'phaser';
import { CHIMNEY_H, DOOR_OX, DOOR_OY, glows, thingFoot, thingLook, warmHome, wallFrameName } from '../art/homeArt';
import { DOOR_FH, DOOR_FW, DOOR_OPEN, DOOR_STEP, DOOR_STEPS, doorFrame, type DoorWay } from '../art/homeDoor';
import { paintFloors } from '../art/homeFloors';
import { paintRoof, type RoofArt } from '../art/homeWalls';
import { JAR_SPOTS } from '../art/homeProps';
import { CRITTER_H, CRITTER_OX, CRITTER_OY, CRITTER_W } from '../art/critters';
import { pixelCanvas } from '../art/canvas';
import { sound } from '../audio';
import { TABS, build, stopBuilding } from '../game/build';
import { collection } from '../game/collection';
import { CRITTERS, critterById } from '../game/critters';
import { daynight, type Phase } from '../game/daynight';
import { SUN_SHADOW_ALPHA, sunShadow } from '../game/Wizard';
import { sway, treeSwayReady } from '../game/treeSway';
import { session, type Msg } from '../net/session';
import type { WorldScene } from '../scenes/WorldScene';
import { HOME_SPAWN, homeWalkable, setHomeMask } from './homeGround';
import { HomeCritters } from './HomeCritters';
import { HouseShadow, type Stack } from './houseShadow';
import { treeLeaves } from './Scenery';
import { CELL, COLS, HomeLayout, HomeMask, PLOT_H, PLOT_W, PLOT_X, PLOT_Y, ROWS, cellIndex, doorAcross, findHouses, inPlot, starterHome, type House, type Thing } from './homeLayout';
import { FISH_REACH, FLOORS, WALLS, extent, partById, wallKind, wallMat, type PartDef } from './homeParts';

type Img = Phaser.GameObjects.Image;
type Sprite = Phaser.GameObjects.Sprite;

/** The phase and auto together, to notice a change worth sending the room. */
const dayKey = (): string => `${daynight.phase} ${daynight.auto}`;
/** How much of the day ground shows: all of it from morning to day, most of it at sunset, none at night. */
const dayGround = (d: number): number => Math.min(1, d * 1.8);

/** Floors are painted in square patches this big, so an edit repaints only the patches round it. */
const PATCH = 64;
const PATCH_COLS = PLOT_W / PATCH;
const PATCH_ROWS = PLOT_H / PATCH;
/** How many edits can be undone. */
const UNDO_MAX = 30;
/** How long a roof takes to fade away, or come back, in ms. */
const FADE_MS = 260;
/** A roof over the hero's head from behind shows this much; while building, this much. */
const ROOF_BEHIND = 0.45;
const ROOF_BUILDING = 0.25;
/** Walls along a house's south side, seen from inside, are cut down to this many px of face. */
const STUB = 6;
/** Visitors are sent the home this long after the last edit, and in pieces no longer than this. */
const SEND_MS = 700;
const PIECE = 12000;
/** How far round the hero the build cursor must keep, px, so no wall goes down on them. */
const HERO_R = 6;
/** ms between leaves or petals dropping from the trees planted here. */
const LEAF_MS = 1500;
/** What each planted tree drops. */
const LEAF_TINTS: Record<string, number[]> = {
  oak: [0x3b753c, 0x528d46, 0x71a653, 0xc8a040],
  birch: [0x8eb54c, 0xb2cd62, 0xd2e287, 0xe8c050],
  blossom: [0xf8c0d2, 0xec9cb8, 0xffe2ec, 0xd8789c],
};
/** A door opens for a hero within this far of its doorway, across it and along it, px. */
const DOOR_REACH = 24;
const DOOR_SIDE = 13;
/** It stays open this long after the last hero has gone, ms, then swings shut behind them. */
const DOOR_HOLD = 450;
/** Its swing: a spring (stiffness, per s^2, and damping, per s) that overshoots a little opening, and how much it bounces back off the frame shutting. */
const DOOR_K = 85;
const DOOR_DAMP = 9.5;
const DOOR_BOUNCE = 0.28;
/** Shutting faster than this (degrees a second) knocks; its sounds carry this far, px. */
const DOOR_KNOCK = 140;
const DOOR_HEAR = 220;

interface Placed {
  t: Thing;
  part: PartDef;
  sprite: Sprite;
  glow: Sprite | null;
  shadow: Img | null;
  light: Phaser.GameObjects.Light | null;
  halo: Img | null;
  base: number;
  seed: number;
  /** The house over it (-1 outdoors): its lights dim while the roof is on. */
  house: number;
  jars: { jar: Sprite; glow: Sprite }[];
  /** A door's swing; null for anything else. */
  door: Swing | null;
}

/** A door in its doorway: which way it opens, how far open it is (degrees) and how fast it's turning, and how long it stays open. */
interface Swing {
  way: DoorWay;
  /** Hung in a house's doorway (a doorway painted over leaves it hidden until it's taken away). */
  hung: boolean;
  deg: number;
  vel: number;
  hold: number;
  step: number;
  cut: number;
}

interface WallPiece {
  key: string;
  img: Img;
  glow: Img | null;
  /** On the south side of this house (-1 for none): cut down to a stub while the hero is inside. */
  south: number;
  /** A south corner the side wall runs into: it stays whole, so the side wall doesn't stop short of the stubs. */
  post: boolean;
  /** Its sun shadow, for walls out in the open (a house's walls are in its roof's). */
  shadow: Img | null;
  h: number;
  /** Rows cut off its top (0: whole). */
  cut: number;
}

interface Roof {
  sig: string;
  house: House;
  art: RoofArt;
  key: string;
  img: Img;
  shadow: HouseShadow;
  depth: number;
  reveal: number;
  alpha: number;
  chimneys: { img: Img; smoke: Phaser.GameObjects.Particles.ParticleEmitter }[];
}

/** A fishing rod placed in the Home, and the water it can reach: each water cell's middle, and whether water lies all round it. */
export interface RodSpot {
  key: string;
  x: number;
  y: number;
  flip: boolean;
  water: { x: number; y: number; open: boolean }[];
}

let uid = 0;

/**
 * The player's Home: the plot they build on, drawn from its layout (see
 * homeLayout.ts): floors painted on the ground, walls joined into runs with
 * doors and windows, hipped roofs over houses that fade away as the hero
 * steps inside (the chapel's walk-in, see Chapel.ts), and everything placed,
 * lit by its lamps and the day. In build mode taps on the world build (the
 * palette is ui/buildHud.ts). Online, the owner hosts: visitors are sent the
 * home and see it change as it's built; the day and night are shared.
 */
export class Home {
  layout: HomeLayout;
  /** The player's own home, which they can build and which is saved; else a friend's, being visited. */
  readonly owner: boolean;
  private shown = new HomeLayout();
  private mask!: HomeMask;
  private houses: House[] = [];
  private houseAt: Int16Array = new Int16Array(COLS * ROWS).fill(-1);
  private patches = new Map<number, { day: Img; night: Img; keys: string[] }>();
  private walls = new Map<number, WallPiece>();
  private placed = new Map<string, Placed>();
  private roofs: Roof[] = [];
  private caught: string[] = [];
  private grid: Phaser.GameObjects.Graphics;
  private cursor: Phaser.GameObjects.Graphics;
  private ghost: Img;
  private undoStack: string[] = [];
  private before = '';
  private lastCell: { x: number; y: number } | null = null;
  private inside = -1;
  private daylight = -1;
  private lastDay = dayKey();
  private sendT = 0;
  private sendSeq = 0;
  private pieces: { k: number; parts: string[] } | null = null;
  private netOff: (() => void) | null = null;
  private hero = { x: 0, y: 0 };
  private id = uid++;
  private version = 0;
  /** Trees planted before their sway was ready: they start swaying when it is. */
  private stillTrees: { sprite: Sprite; anim: string }[] = [];
  private leaves!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** The rods and the water round them, worked out again after any change. */
  private rodSpots: RodSpot[] | null = null;
  /** The critters let out here, living round their spots. */
  private critters: HomeCritters;
  /** A visitor has been sent the home at least once. */
  private arrived = false;

  constructor(
    private scene: WorldScene,
    private ground: (img: Img) => Img,
  ) {
    warmHome(scene);
    // Online, the room's host is the one whose home it is; everyone else visits.
    this.owner = !session.active || session.isHost;
    this.layout = this.owner ? (HomeLayout.decode(collection.home) ?? starterHome()) : new HomeLayout();
    if (this.owner) this.caught = CRITTERS.filter((c) => collection.critterCount(c.id) > 0).map((c) => c.id);
    build.available = this.owner;
    build.home = true;
    // Every tab and every part (the Everwood keeps to fewer).
    build.tabs = TABS.map((t) => t.id);
    build.allow = null;
    stopBuilding();
    build.canUndo = false;

    const add = scene.add;
    this.grid = add.graphics().setDepth(1.6).setVisible(false);
    this.drawGrid();
    this.cursor = add.graphics().setDepth(9000).setVisible(false);
    this.ghost = add.image(0, 0, 'home', 'chimney').setAlpha(0.6).setDepth(9001).setVisible(false);
    this.critters = new HomeCritters(scene);
    this.refresh(true);
    // Now and then a leaf, or a cherry petal, comes loose from a tree planted here.
    this.leaves = treeLeaves(
      scene,
      () => {
        const trees = [...this.placed.values()].filter((p) => LEAF_TINTS[p.t.id] && p.sprite.visible);
        const p = trees[Math.floor(Math.random() * trees.length)];
        if (!p) return null;
        return { x: p.sprite.x + (Math.random() - 0.5) * 44, y: p.sprite.y - 66 + (Math.random() - 0.3) * 24, tints: LEAF_TINTS[p.t.id] };
      },
      LEAF_MS,
    );
    this.leaves.emitting = this.layout.things.some((t) => LEAF_TINTS[t.id]);

    if (session.active) {
      this.netOff = session.on((m) => this.receive(m));
      // A visitor asks for the home; the owner answers them alone.
      if (!this.owner) session.send({ t: 'hq' });
    }
  }

  /** Where a visit starts: the foot of the plot, or the nearest open ground to it. */
  spawnPoint(): { x: number; y: number } {
    for (let r = 0; r < 200; r += 6) {
      for (let a = 0; a < 16; a++) {
        const x = HOME_SPAWN.x + Math.cos((a / 16) * Math.PI * 2) * r;
        const y = HOME_SPAWN.y + Math.sin((a / 16) * Math.PI * 2) * r * 0.6 + (r > 0 ? r * 0.4 : 0);
        if (homeWalkable(x, y)) return { x, y };
      }
    }
    return HOME_SPAWN;
  }

  // ---------------------------------------------------------------- Drawing the layout

  /** Bring what's drawn up to date with the layout: only what changed is redrawn. */
  private refresh(all = false): void {
    const l = this.layout;
    const old = this.shown;
    this.mask = new HomeMask(l);
    setHomeMask(this.mask);
    this.rodSpots = null;
    const found = findHouses(l);
    this.houses = found.houses;
    this.houseAt = found.at;

    // Floors: the patches round every cell whose floor or wall changed (a wall shades the floor at its foot).
    const dirty = new Set<number>();
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = cellIndex(cx, cy);
        if (!all && l.floor[i] === old.floor[i] && l.wall[i] === old.wall[i]) continue;
        for (let py = Math.floor((cy * CELL - CELL) / PATCH); py <= Math.floor((cy * CELL + CELL * 2) / PATCH); py++) {
          for (let px = Math.floor((cx * CELL - CELL) / PATCH); px <= Math.floor((cx * CELL + CELL * 2) / PATCH); px++) {
            if (px >= 0 && py >= 0 && px < PATCH_COLS && py < PATCH_ROWS) dirty.add(py * PATCH_COLS + px);
          }
        }
      }
    }
    for (const p of dirty) this.paintPatch(p);

    this.refreshWalls();
    this.refreshRoofs();
    this.refreshThings();
    this.shown = l.clone();
  }

  private paintPatch(p: number): void {
    const px = (p % PATCH_COLS) * PATCH;
    const py = Math.floor(p / PATCH_COLS) * PATCH;
    const patch = paintFloors(this.layout, px, py, PATCH, PATCH);
    const old = this.patches.get(p);
    if (old) {
      old.day.destroy();
      old.night.destroy();
      for (const k of old.keys) this.scene.textures.remove(k);
      this.patches.delete(p);
    }
    if (!patch.any) return;
    const v = this.version++;
    const keys = [`hf${this.id}_${v}_d`, `hf${this.id}_${v}_n`];
    const tex = this.scene.textures;
    tex.addCanvas(keys[0], pixelCanvas(PATCH, PATCH, patch.day))!.setDataSource(pixelCanvas(PATCH, PATCH, patch.normal));
    tex.addCanvas(keys[1], pixelCanvas(PATCH, PATCH, patch.night))!.setDataSource(pixelCanvas(PATCH, PATCH, patch.normal));
    // Night under day, as the ground's own strips are: the day fades in over it.
    const night = this.ground(this.scene.add.image(PLOT_X + px, PLOT_Y + py, keys[1]).setOrigin(0).setPipeline('Lit').setDepth(3));
    const day = this.ground(this.scene.add.image(PLOT_X + px, PLOT_Y + py, keys[0]).setOrigin(0).setPipeline('Lit').setDepth(3.1).setAlpha(dayGround(Math.max(0, this.daylight))));
    this.patches.set(p, { day, night, keys });
  }

  /** Each wall cell: its frame for its material, kind and the walls it joins. */
  private refreshWalls(): void {
    const l = this.layout;
    // Doorways with a door hung in them leave out the door they'd otherwise show standing open.
    const doors = new Set(l.things.filter((t) => partById(t.id)?.door).map((t) => cellIndex(t.x, t.y)));
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = cellIndex(cx, cy);
        const v = l.wall[i];
        let key = '';
        let mat = 0;
        if (v) {
          mat = wallMat(v);
          const mask = l.wallMask(cx, cy);
          const kind = wallKind(v);
          const frame = kind === 'door' ? `${doors.has(i) && WALLS[mat].house ? 'o' : 'd'}${mask}` : kind === 'window' && WALLS[mat].house ? `n${mask}` : `w${mask}_${(cx * 7 + cy * 13) % 2}`;
          key = wallFrameName(mat, frame);
        }
        const h = this.houseAt[i];
        const south = h >= 0 && (cy === ROWS - 1 || this.houseAt[i + COLS] !== h) ? h : -1;
        const post = south >= 0 && !!(l.wallMask(cx, cy) & 1);
        const old = this.walls.get(i);
        if (old && old.key === key && !!old.shadow === (h < 0)) {
          old.south = south;
          old.post = post;
          continue;
        }
        if (old) {
          old.img.destroy();
          old.glow?.destroy();
          old.shadow?.destroy();
          this.walls.delete(i);
        }
        if (!key) continue;
        const H = WALLS[mat].height;
        const x = PLOT_X + cx * CELL;
        const y = PLOT_Y + cy * CELL - H;
        const depth = PLOT_Y + cy * CELL + 11;
        const img = this.scene.add.image(x, y, 'home', key).setOrigin(0).setPipeline('Lit').setDepth(depth);
        const glow = glows(key) ? this.scene.add.image(x, y, 'home_e', key).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1) : null;
        const shadow = h < 0 ? sunShadow(this.scene.add.image(x + CELL / 2, PLOT_Y + (cy + 1) * CELL, 'home_s', key).setOrigin(0.5, 1)).setAlpha(SUN_SHADOW_ALPHA * Math.max(0, this.daylight)) : null;
        this.walls.set(i, { key, img, glow, south, post, shadow, h: H, cut: 0 });
      }
    }
  }

  /** One roof per house, repainted only when its cells or tiles change; chimneys over its hearths. */
  private refreshRoofs(): void {
    const l = this.layout;
    const keep: Roof[] = [];
    const sigOf = (h: House) => h.cells.map((c) => `${c}.${l.roof[c]}`).sort().join(',');
    const wanted = this.houses.map((h) => ({ h, sig: sigOf(h) }));
    for (const r of this.roofs) {
      const w = wanted.find((x) => x.sig === r.sig);
      if (w) {
        r.house = w.h;
        keep.push(r);
      } else this.dropRoof(r);
    }
    for (const w of wanted) {
      if (keep.some((r) => r.sig === w.sig)) continue;
      const art = paintRoof(l, w.h);
      const key = `hr${this.id}_${this.version++}`;
      const tex = this.scene.textures;
      tex.addCanvas(key, pixelCanvas(art.w, art.h, art.diffuse))!.setDataSource(pixelCanvas(art.w, art.h, art.normal));
      const depth = PLOT_Y + (w.h.y1 + 1) * CELL + 1;
      const img = this.scene.add.image(PLOT_X + art.x, PLOT_Y + art.y, key).setOrigin(0).setPipeline('Lit').setDepth(depth);
      const shadow = new HouseShadow(this.scene, `${key}_s`, art.solid, PLOT_X, PLOT_Y);
      keep.push({ sig: w.sig, house: w.h, art, key, img, shadow, depth, reveal: 0, alpha: 1, chimneys: [] });
    }
    this.roofs = keep;
    // Chimneys: rebuilt every time, as hearths come and go under a roof that stays.
    const stacks = new Map<Roof, Stack[]>(this.roofs.map((r) => [r, []]));
    for (const r of this.roofs) {
      for (const c of r.chimneys) {
        c.img.destroy();
        c.smoke.destroy();
      }
      r.chimneys = [];
    }
    for (const t of l.things) {
      const p = partById(t.id);
      if (!p?.chimney) continue;
      const h = this.houseAt[cellIndex(t.x, t.y)];
      const r = this.roofs.find((x) => x.house.id === h);
      if (!r) continue;
      const px = (t.x + p.w / 2) * CELL;
      const py = t.y * CELL + 5;
      const x = PLOT_X + px;
      const y = PLOT_Y + py - r.art.lift(px, py) + 2;
      const img = this.scene.add.image(x, y, 'home', 'chimney').setOrigin(0.5, 1).setPipeline('Lit').setDepth(r.depth + 0.5);
      const smoke = this.scene.add.particles(x, y - CHIMNEY_H + 3, 'rogue_smoke', {
        lifespan: 2800,
        speedY: { min: -15, max: -8 },
        speedX: { min: 2, max: 6 },
        scale: { start: 0.3, end: 1.1 },
        alpha: { start: 0.32, end: 0 },
        tint: [0xc8c0b8, 0xa8a4a8],
        frequency: 420,
      }).setDepth(r.depth + 1);
      r.chimneys.push({ img, smoke });
      // It casts with the house: a stack a little narrower than its drawing, from the roof up.
      const lift = r.art.lift(px, py);
      stacks.get(r)!.push({ x: px - 4, y: py - 2, w: 8, d: 5, base: lift, top: lift + CHIMNEY_H - 3 });
    }
    for (const [r, s] of stacks) r.shadow.setStacks(s);
  }

  private dropRoof(r: Roof): void {
    r.img.destroy();
    r.shadow.destroy();
    for (const c of r.chimneys) {
      c.img.destroy();
      c.smoke.destroy();
    }
    this.scene.textures.remove(r.key);
  }

  private static keyOf(t: Thing): string {
    return `${t.id}@${t.x},${t.y}${t.flip ? 'f' : ''}${t.turn ? `r${t.turn}` : ''}`;
  }

  /** Placed things: new ones stood up, removed ones taken away; the critter shelves refilled. */
  private refreshThings(): void {
    const l = this.layout;
    // Critters aren't stood up as things: they live their own lives (HomeCritters).
    const want = new Map(l.things.filter((t) => !partById(t.id)?.critter).map((t) => [Home.keyOf(t), t]));
    for (const [k, p] of this.placed) {
      if (want.has(k)) continue;
      this.unplace(p);
      this.placed.delete(k);
    }
    for (const [k, t] of want) if (!this.placed.has(k)) this.place(k, t);
    this.hangDoors();
    for (const p of this.placed.values()) p.house = this.houseAt[cellIndex(p.t.x, p.t.y + extent(p.part, p.t.turn).h - 1)];
    if (this.leaves) this.leaves.emitting = l.things.some((t) => LEAF_TINTS[t.id]);
    this.fillShelves();
    // Let out with a sparkle while building (or, for a visitor, once the home has come), not as the home first appears.
    this.critters.sync(l, this.houseAt, this.owner ? build.on : this.arrived);
  }

  private place(k: string, t: Thing): void {
    const part = partById(t.id)!;
    if (part.door) {
      this.placeDoor(k, t, part);
      return;
    }
    const look = thingLook(t);
    const add = this.scene.add;
    const depth = part.wall ? PLOT_Y + t.y * CELL + 11.2 : part.flat ? 1.5 : look.y;
    const sprite = add.sprite(look.x, look.y, look.key, look.frame).setOrigin(look.ox, look.oy).setFlipX(look.flipX).setPipeline('Lit').setDepth(depth);
    if (look.sway) {
      if (this.scene.anims.exists(look.sway)) sway(sprite, look.sway);
      else this.stillTrees.push({ sprite, anim: look.sway });
    }
    let glow: Sprite | null = null;
    if (look.glow) {
      glow = add.sprite(look.x, look.y, look.glow, look.frame).setOrigin(look.ox, look.oy).setFlipX(look.flipX).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1);
      if (look.anim) glow.play({ key: look.anim, startFrame: Math.floor(Math.random() * 4) });
    }
    const shadow = part.flat || part.wall ? null : sunShadow(add.image(look.x, look.y, `${look.key}_s`, look.frame).setOrigin(look.ox, look.oy).setFlipX(look.flipX));
    let light: Phaser.GameObjects.Light | null = null;
    let halo: Img | null = null;
    const L = part.light;
    if (L) {
      const lx = part.wall ? look.x + 2 : look.x;
      const ly = part.wall ? PLOT_Y + t.y * CELL - 9 : look.y - L.y;
      light = this.scene.lights.addLight(lx, ly, L.radius, L.color, L.intensity);
      halo = add.image(lx, ly, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(L.color).setScale(Math.max(0.8, L.radius / 70)).setDepth(depth + 0.2).setAlpha(0.4);
    }
    this.placed.set(k, { t, part, sprite, glow, shadow, light, halo, base: L?.intensity ?? 0, seed: Math.random() * 100, house: -1, jars: [], door: null });
  }

  /** A door: drawn over its doorway's wall, each frame of its swing a whole picture of the doorway (see art/homeDoor.ts). */
  private placeDoor(k: string, t: Thing, part: PartDef): void {
    const x = PLOT_X + t.x * CELL - DOOR_OX;
    const y = PLOT_Y + t.y * CELL - DOOR_OY;
    const frame = doorFrame('n', t.flip ? 1 : 0, 0);
    const sprite = this.scene.add.sprite(x, y, 'home', frame).setOrigin(0).setPipeline('Lit');
    // Its little window shows the lamplight inside, like the house's windows.
    const glow = this.scene.add.sprite(x, y, 'home_e', frame).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(this.windowGlow());
    const door: Swing = { way: 'n', hung: false, deg: 0, vel: 0, hold: 0, step: -1, cut: 0 };
    this.placed.set(k, { t, part, sprite, glow, shadow: null, light: null, halo: null, base: 0, seed: 0, house: -1, jars: [], door });
  }

  /**
   * Each door, after a change: hung if its doorway is still a house's, and
   * opening into the house (north or south through an east-west wall, east
   * or west through a north-south one), drawn just in front of its wall, or
   * for a north-south wall at its leaf, so heroes pass it the right side.
   */
  private hangDoors(): void {
    const l = this.layout;
    const home = (cx: number, cy: number) => inPlot(cx, cy) && this.houseAt[cellIndex(cx, cy)] >= 0;
    for (const p of this.placed.values()) {
      const d = p.door;
      if (!d) continue;
      const { x: cx, y: cy } = p.t;
      d.hung = this.hungHere(p);
      const across = doorAcross(l.wallMask(cx, cy));
      const way: DoorWay = across ? (home(cx, cy + 1) && !home(cx, cy - 1) ? 's' : 'n') : home(cx - 1, cy) && !home(cx + 1, cy) ? 'w' : 'e';
      if (way !== d.way) {
        d.way = way;
        d.step = -1;
      }
      const base = PLOT_Y + cy * CELL;
      p.sprite.setDepth(across ? base + 11.05 : base + (p.t.flip ? 13.5 : 2.5));
      p.glow?.setDepth(p.sprite.depth + 0.01);
      for (const o of [p.sprite, p.glow]) o?.setVisible(d.hung);
    }
  }

  /** Is this door's cell still a house's doorway? (Asked without the door itself, which would otherwise be in its own way.) */
  private hungHere(p: Placed): boolean {
    const l = this.layout;
    const others = l.things;
    l.things = others.filter((o) => o !== p.t);
    const ok = l.canPlace(p.part, p.t.x, p.t.y);
    l.things = others;
    return ok;
  }

  /** How strongly windows (and a door's little window) glow: hardly by day, fully at night. */
  private windowGlow(): number {
    return 0.15 + (1 - Math.max(0, this.daylight)) * 0.85;
  }

  /**
   * Doors swing open for any hero walking up to them, this player's or a
   * friend's (so everyone online sees the same), and shut behind them once
   * they've gone. The swing is a spring: it overshoots a touch opening, and
   * knocks against the frame and settles shutting. A door in a wall cut down
   * to a stub (the hero inside) is cut with it.
   */
  private swingDoors(dt: number, heroes: { x: number; y: number }[]): void {
    const s = Math.min(dt, 50) / 1000;
    const max = (DOOR_STEPS - 1) * DOOR_STEP;
    const glow = this.windowGlow();
    for (const p of this.placed.values()) {
      const d = p.door;
      if (!d || !d.hung) continue;
      const cx = PLOT_X + (p.t.x + 0.5) * CELL;
      const cy = PLOT_Y + (p.t.y + 0.5) * CELL;
      const across = d.way === 'n' || d.way === 's';
      const near = heroes.some((h) => {
        const a = across ? h.x - cx : h.y - cy;
        const b = across ? h.y - cy : h.x - cx;
        return (a / DOOR_SIDE) ** 2 + (b / DOOR_REACH) ** 2 < 1;
      });
      if (near) d.hold = DOOR_HOLD;
      else d.hold = Math.max(0, d.hold - dt);
      const want = d.hold > 0 ? DOOR_OPEN : 0;
      const pan = Phaser.Math.Clamp((cx - this.hero.x) / 160, -1, 1);
      const heard = Math.hypot(cx - this.hero.x, cy - this.hero.y) < DOOR_HEAR;
      if (want > 0 && d.deg < 1 && d.vel <= 0 && heard) sound.doorOpen(pan);
      d.vel += (DOOR_K * (want - d.deg) - DOOR_DAMP * d.vel) * s;
      d.deg += d.vel * s;
      if (d.deg < 0) {
        // Against the frame: a knock if it came hard, and a little bounce back.
        if (d.vel < -DOOR_KNOCK && heard) sound.doorShut(pan, Math.min(1, -d.vel / 400));
        d.deg = -d.deg * DOOR_BOUNCE;
        d.vel = -d.vel * DOOR_BOUNCE;
        if (d.vel < 20) d.deg = d.vel = 0;
      }
      if (d.deg > max) {
        d.deg = max;
        d.vel = Math.min(0, d.vel);
      }
      const step = Math.round(d.deg / DOOR_STEP);
      if (step !== d.step) {
        d.step = step;
        const frame = doorFrame(d.way, p.t.flip ? 1 : 0, step);
        p.sprite.setFrame(frame);
        p.glow?.setFrame(frame);
      }
      p.glow?.setAlpha(glow);
      const cut = this.walls.get(cellIndex(p.t.x, p.t.y))?.cut ?? 0;
      if (cut !== d.cut) {
        d.cut = cut;
        for (const o of [p.sprite, p.glow]) {
          if (cut) o?.setCrop(0, cut, DOOR_FW, DOOR_FH - cut);
          else o?.setCrop();
        }
      }
    }
  }

  private unplace(p: Placed): void {
    p.sprite.destroy();
    p.glow?.destroy();
    p.shadow?.destroy();
    p.halo?.destroy();
    if (p.light) this.scene.lights.removeLight(p.light);
    for (const j of p.jars) {
      j.jar.destroy();
      j.glow.destroy();
    }
  }

  /** The critter shelves show the owner's caught critters in turn, three to a shelf, in the order the shelves went up. */
  private fillShelves(): void {
    let n = 0;
    for (const t of this.layout.things) {
      const p = this.placed.get(Home.keyOf(t));
      if (!p?.part.jars) continue;
      for (const j of p.jars) {
        j.jar.destroy();
        j.glow.destroy();
      }
      p.jars = [];
      const x0 = PLOT_X + t.x * CELL;
      const y = PLOT_Y + t.y * CELL + JAR_SPOTS.y;
      for (let k = 0; k < p.part.jars; k++) {
        const id = this.caught[n++];
        const x = x0 + JAR_SPOTS.xs[k];
        const jar = this.scene.add.sprite(x, y, 'jars', id ? `${id}_0` : 'empty').setOrigin(0.5, 1).setPipeline('Lit').setDepth(p.sprite.depth + 0.2);
        const glow = this.scene.add.sprite(x, y, 'jars_e', id ? `${id}_0` : 'empty').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.sprite.depth + 0.3).setVisible(!!id);
        if (id) jar.play({ key: `jar_${id}`, startFrame: k });
        p.jars.push({ jar, glow });
      }
      // The shelf glows in the colour of its brightest critter.
      const lit = p.jars.map((_j, k) => critterById(this.caught[n - p.jars.length + k] ?? '')).find((d) => d?.glow);
      if (p.light) this.scene.lights.removeLight(p.light);
      p.halo?.destroy();
      p.light = null;
      p.halo = null;
      if (lit?.glow) {
        const col = (lit.glow[0] << 16) | (lit.glow[1] << 8) | lit.glow[2];
        p.light = this.scene.lights.addLight(x0 + 24, y - 10, 70, col, 0.9);
        p.base = 0.9;
      }
    }
  }

  /** The fishing rods placed here, each with the water within FISH_REACH cells of it (see world/Fishing.ts). */
  rods(): RodSpot[] {
    if (this.rodSpots) return this.rodSpots;
    const l = this.layout;
    this.rodSpots = [];
    for (const t of l.things) {
      if (!partById(t.id)?.fishing) continue;
      const water: RodSpot['water'] = [];
      for (let y = t.y - FISH_REACH; y <= t.y + FISH_REACH; y++) {
        for (let x = t.x - FISH_REACH; x <= t.x + FISH_REACH; x++) {
          if (!l.isWater(x, y)) continue;
          const open = l.isWater(x - 1, y) && l.isWater(x + 1, y) && l.isWater(x, y - 1) && l.isWater(x, y + 1);
          water.push({ x: PLOT_X + (x + 0.5) * CELL, y: PLOT_Y + (y + 0.5) * CELL, open });
        }
      }
      const foot = thingFoot(t);
      this.rodSpots.push({ key: Home.keyOf(t), x: foot.x, y: foot.y, flip: t.flip, water });
    }
    return this.rodSpots;
  }

  /** Take a rod out of its pail for fishing, or stand it back in. */
  holdRod(key: string, out: boolean): void {
    const p = this.placed.get(key);
    if (!p) return;
    const frame = out ? (p.t.flip ? 'rodbucket_m' : 'rodbucket') : thingLook(p.t).frame;
    p.sprite.setFrame(frame);
    p.shadow?.setFrame(frame);
  }

  private drawGrid(): void {
    const g = this.grid.clear();
    g.lineStyle(1, 0xffffff, 0.1);
    for (let x = 1; x < COLS; x++) g.lineBetween(PLOT_X + x * CELL, PLOT_Y, PLOT_X + x * CELL, PLOT_Y + PLOT_H);
    for (let y = 1; y < ROWS; y++) g.lineBetween(PLOT_X, PLOT_Y + y * CELL, PLOT_X + PLOT_W, PLOT_Y + y * CELL);
    g.lineStyle(2, 0xffe2a0, 0.45);
    g.strokeRect(PLOT_X, PLOT_Y, PLOT_W, PLOT_H);
  }

  // ---------------------------------------------------------------- Each frame

  /** `others`: the other heroes here online, whom doors open for too. */
  update(dt: number, heroX: number, heroY: number, daylight: number, others: readonly { x: number; y: number }[] = []): void {
    this.hero.x = heroX;
    this.hero.y = heroY;
    const d = daylight;
    if (Math.abs(d - this.daylight) > 0.003) {
      this.daylight = d;
      for (const p of this.patches.values()) p.day.setAlpha(dayGround(d));
      const windows = this.windowGlow();
      for (const w of this.walls.values()) {
        w.glow?.setAlpha(windows);
        w.shadow?.setAlpha(SUN_SHADOW_ALPHA * d);
      }
    }

    // Which house the hero stands in: its roof fades, its south walls drop to stubs.
    const cx = Math.floor((heroX - PLOT_X) / CELL);
    const cy = Math.floor((heroY - PLOT_Y) / CELL);
    const inside = inPlot(cx, cy) ? this.houseAt[cellIndex(cx, cy)] : -1;
    if (inside !== this.inside) {
      this.inside = inside;
      sound.setOutdoors(inside < 0);
    }
    const step = dt / FADE_MS;
    for (const r of this.roofs) {
      r.reveal = Phaser.Math.Clamp(r.reveal + (r.house.id === inside ? step : -step), 0, 1);
      const behind = heroY < r.depth && heroY > r.img.y && heroX > r.img.x && heroX < r.img.x + r.img.width;
      const want = build.on ? (build.tab === 'roof' ? 0.8 : ROOF_BUILDING) : behind ? ROOF_BEHIND : 1;
      r.alpha += (want - r.alpha) * Math.min(1, dt / 120);
      const a = r.alpha * (1 - Phaser.Math.Easing.Sine.InOut(r.reveal));
      r.img.setAlpha(a);
      r.shadow.img.setAlpha(SUN_SHADOW_ALPHA * d * (1 - r.reveal));
      if (d > 0.01 && r.reveal < 1) r.shadow.update();
      for (const c of r.chimneys) {
        c.img.setAlpha(a);
        c.smoke.emitting = a > 0.5;
      }
    }
    for (const w of this.walls.values()) {
      const stub = w.south >= 0 && !w.post && (this.roofs.find((r) => r.house.id === w.south)?.reveal ?? 0) > 0.5;
      const top = stub ? w.h + 11 - STUB : 0;
      if (w.cut === top) continue;
      w.cut = top;
      if (stub) {
        w.img.setCrop(0, top, CELL, CELL + w.h - top);
        w.glow?.setCrop(0, top, CELL, CELL + w.h - top);
      } else {
        w.img.setCrop();
        w.glow?.setCrop();
      }
    }

    // Lamps: fire flickers, the day washes them out, a roof over them dims them.
    // Things hung on a wall cut down to a stub go with it; nothing under a roof casts a sun shadow.
    const t = this.scene.time.now;
    for (const p of this.placed.values()) {
      if (p.door) continue;
      p.shadow?.setAlpha(p.house >= 0 ? 0 : SUN_SHADOW_ALPHA * d);
      const hidden = !!p.part.wall && (this.walls.get(cellIndex(p.t.x, p.t.y))?.cut ?? 0) > 0;
      if (hidden === p.sprite.visible) {
        for (const o of [p.sprite, p.glow, p.halo]) o?.setVisible(!hidden);
        if (p.light) p.light.visible = !hidden;
      }
      if (p.jars.length) for (const j of p.jars) if (j.glow.visible) j.glow.setFrame(j.jar.frame.name);
      if (!p.light || hidden) continue;
      const L = p.part.light;
      const day = L ? L.day : 0.3;
      const k = (1 + (day - 1) * d) * (p.house >= 0 ? 0.3 + 0.7 * (this.roofs.find((r) => r.house.id === p.house)?.reveal ?? 1) : 1);
      const n = L?.flicker ? Math.sin(t * 0.011 + p.seed) * 0.5 + Math.sin(t * 0.027 + p.seed * 3) * 0.3 + Math.sin(t * 0.061 + p.seed * 7) * 0.2 : Math.sin(t * 0.002 + p.seed) * 0.6;
      p.light.intensity = p.base * (0.87 + n * 0.13) * k;
      p.halo?.setAlpha((0.32 + n * 0.06) * k);
    }

    this.swingDoors(dt, [this.hero, ...others]);
    this.critters.update(dt, heroX, heroY, d, this.scene.cameras.main.worldView);

    if (this.stillTrees.length && treeSwayReady(this.scene)) {
      for (const t of this.stillTrees.splice(0)) if (t.sprite.active) sway(t.sprite, t.anim);
    }

    this.buildStep();
    this.shareDay();
    if (this.sendT > 0 && (this.sendT -= dt) <= 0) this.sendHome();
  }

  /** How far the hero is from a fire burning here, for its crackle. */
  fireDistance(x: number, y: number): number {
    let near = Infinity;
    for (const p of this.placed.values()) {
      if (!p.light || !p.part.light?.flicker || p.part.id === 'sconce' || p.part.id === 'candelabra') continue;
      near = Math.min(near, Math.hypot(p.light.x - x, p.light.y - y));
    }
    return near;
  }

  // ---------------------------------------------------------------- Building

  private buildStep(): void {
    const on = build.on && this.owner;
    this.grid.setVisible(on);
    if (!on) {
      this.cursor.setVisible(false);
      this.ghost.setVisible(false);
      build.pressed = build.released = false;
      this.lastCell = null;
      return;
    }
    if (build.undo) {
      build.undo = false;
      this.undo();
    }
    const p = build.pointer;
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    const cx = Math.floor((w.x - PLOT_X) / CELL);
    const cy = Math.floor((w.y - PLOT_Y) / CELL);
    const pick = build.pick;
    const erase = p.erase || !pick;
    const thing = !erase && pick?.layer === 'thing' ? partById(pick.id) ?? null : null;
    const turn = thing?.turns ? build.turn : 0;
    const size = thing ? extent(thing, turn) : { w: 1, h: 1 };
    // A thing's footprint hangs from the cell under the pointer by its middle, so the pointer is at its foot.
    const fx = cx - Math.floor((size.w - 1) / 2);
    const fy = cy - (size.h - 1);

    if (build.pressed) {
      build.pressed = false;
      this.before = this.layout.encode();
      this.lastCell = null;
    }
    if (p.down && !thing) this.stroke(cx, cy, erase);
    if (build.released) {
      build.released = false;
      if (thing) this.placeThing(thing, fx, fy, turn);
      else this.stroke(cx, cy, erase);
      this.lastCell = null;
      this.endStroke();
    }

    // The cursor: the footprint, green where it can go and red where it can't, and a ghost of the thing.
    const show = (p.over || p.down) && inPlot(cx, cy);
    this.cursor.setVisible(show);
    this.ghost.setVisible(show && !!thing);
    if (!show) return;
    const ok = erase ? this.canErase(cx, cy) : thing ? this.layout.canPlace(thing, fx, fy, turn) && !this.onHero(thing, fx, fy, turn) : this.canPaint(cx, cy);
    const col = erase ? 0xff9a6a : ok ? 0x9cff8a : 0xff6a6a;
    const bw = size.w * CELL;
    const bh = size.h * CELL;
    const g = this.cursor.clear();
    g.fillStyle(col, 0.16);
    g.fillRect(PLOT_X + fx * CELL, PLOT_Y + fy * CELL, bw, bh);
    g.lineStyle(1, col, 0.85);
    g.strokeRect(PLOT_X + fx * CELL + 0.5, PLOT_Y + fy * CELL + 0.5, bw - 1, bh - 1);
    if (thing?.critter) {
      this.ghost.setTexture('critters', `${thing.critter}_0`).setOrigin(CRITTER_OX / CRITTER_W, CRITTER_OY / CRITTER_H).setFlipX(false);
      this.ghost.setPosition(PLOT_X + (fx + 0.5) * CELL, PLOT_Y + (fy + 1) * CELL - 5).setTint(ok ? 0xffffff : 0xff8080);
    } else if (thing) {
      const look = thingLook({ id: thing.id, x: fx, y: fy, flip: build.flip && !!thing.flip, turn });
      this.ghost.setTexture(look.key, look.frame).setOrigin(look.ox, look.oy).setFlipX(look.flipX).setPosition(look.x, look.y).setTint(ok ? 0xffffff : 0xff8080);
    }
  }

  /** Paint (or erase) every cell from the last one the pointer was on to this one. */
  private stroke(cx: number, cy: number, erase: boolean): void {
    const from = this.lastCell ?? { x: cx, y: cy };
    if (this.lastCell && from.x === cx && from.y === cy) return;
    this.lastCell = { x: cx, y: cy };
    const n = Math.max(Math.abs(cx - from.x), Math.abs(cy - from.y));
    let changed = false;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(from.x + ((cx - from.x) * s) / Math.max(1, n));
      const y = Math.round(from.y + ((cy - from.y) * s) / Math.max(1, n));
      if (!inPlot(x, y)) continue;
      if (erase ? this.eraseAt(x, y) : this.paintAt(x, y)) changed = true;
    }
    if (changed) this.refresh();
  }

  private canPaint(cx: number, cy: number): boolean {
    const pick = build.pick;
    if (!pick || !inPlot(cx, cy)) return false;
    const i = cellIndex(cx, cy);
    if (pick.layer === 'floor') {
      if (!FLOORS[pick.value - 1]?.water) return true;
      return !this.layout.thingsAt(cx, cy).some((t) => !partById(t.id)?.water && !partById(t.id)?.wall && !partById(t.id)?.door && !partById(t.id)?.critter);
    }
    // A critter's spot doesn't hold anything up: it finds open ground nearby.
    if (pick.layer === 'wall') return !this.layout.thingsAt(cx, cy).some((t) => !partById(t.id)?.wall && !partById(t.id)?.door && !partById(t.id)?.critter) && !this.heroIn(cx, cy) && !this.layout.isWater(cx, cy);
    return pick.layer === 'roof' || i >= 0;
  }

  private paintAt(cx: number, cy: number): boolean {
    const pick = build.pick!;
    const l = this.layout;
    const i = cellIndex(cx, cy);
    if (!this.canPaint(cx, cy)) return false;
    if (pick.layer === 'floor') {
      if (l.floor[i] === pick.value) return false;
      l.floor[i] = pick.value;
      // Off the water, lily pads go with it.
      if (!FLOORS[pick.value - 1]?.water) l.things = l.things.filter((t) => !(partById(t.id)?.water === 'only' && t.x === cx && t.y === cy));
      return true;
    }
    if (pick.layer === 'wall') {
      if (l.wall[i] === pick.value) return false;
      l.wall[i] = pick.value;
      this.checkDecor();
      return true;
    }
    if (pick.layer === 'roof') {
      if (l.roof[i] === pick.value) return false;
      l.roof[i] = pick.value;
      return true;
    }
    return false;
  }

  /** What the eraser would take at a cell in this tab: a thing of the tab (or any), or the tab's layer. */
  private eraseTarget(cx: number, cy: number): 'floor' | 'wall' | 'roof' | Thing | null {
    const l = this.layout;
    const i = cellIndex(cx, cy);
    const tab = build.tab;
    if (tab === 'floor') return l.floor[i] ? 'floor' : null;
    // A door comes out of its doorway before the doorway goes.
    if (tab === 'wall') return l.thingsAt(cx, cy).find((t) => partById(t.id)?.door) ?? (l.wall[i] ? 'wall' : null);
    if (tab === 'roof') return l.roof[i] ? 'roof' : null;
    // Critters roam off their spots, so the eraser takes the one it touches, wherever it has got to.
    if (tab === 'critters') return this.critters.at(PLOT_X + (cx + 0.5) * CELL, PLOT_Y + (cy + 0.5) * CELL, CELL * 0.75) ?? l.thingsAt(cx, cy).find((t) => partById(t.id)?.critter) ?? null;
    const here = l.thingsAt(cx, cy).filter((t) => !partById(t.id)?.critter);
    return here.find((t) => partById(t.id)?.tab === tab) ?? (tab === 'decor' ? null : here.find((t) => !partById(t.id)?.wall && !partById(t.id)?.door)) ?? null;
  }

  private canErase(cx: number, cy: number): boolean {
    return inPlot(cx, cy) && this.eraseTarget(cx, cy) !== null;
  }

  private eraseAt(cx: number, cy: number): boolean {
    const l = this.layout;
    const i = cellIndex(cx, cy);
    const what = this.eraseTarget(cx, cy);
    if (!what) return false;
    if (what === 'floor') l.floor[i] = 0;
    else if (what === 'wall') {
      l.wall[i] = 0;
      this.checkDecor();
    } else if (what === 'roof') l.roof[i] = 0;
    else {
      l.things = l.things.filter((t) => t !== what);
      sound.puff(0);
    }
    return true;
  }

  /** Wall hangings only stay on plain house walls whose face shows, and doors in house doorways. */
  private checkDecor(): void {
    const l = this.layout;
    const all = l.things;
    l.things = [];
    for (const t of all) {
      const p = partById(t.id);
      if (!(p?.wall || p?.door) || l.canPlace(p, t.x, t.y)) l.things.push(t);
    }
  }

  private heroIn(cx: number, cy: number): boolean {
    const x = PLOT_X + cx * CELL;
    const y = PLOT_Y + cy * CELL;
    return this.hero.x > x - HERO_R && this.hero.x < x + CELL + HERO_R && this.hero.y > y - HERO_R && this.hero.y < y + CELL + HERO_R;
  }

  /** Would this thing stand on the hero? */
  private onHero(p: PartDef, fx: number, fy: number, turn: number): boolean {
    if (p.block === 'none' || p.wall) return false;
    const { w, h } = extent(p, turn);
    for (let y = fy; y < fy + h; y++) for (let x = fx; x < fx + w; x++) if (this.heroIn(x, y)) return true;
    return false;
  }

  private placeThing(p: PartDef, fx: number, fy: number, turn: number): void {
    if (!this.layout.canPlace(p, fx, fy, turn) || this.onHero(p, fx, fy, turn)) return;
    this.layout.things.push({ id: p.id, x: fx, y: fy, flip: build.flip && !!p.flip, turn });
    if (!p.critter) sound.thud(0);
    this.refresh();
  }

  /** A stroke is over: keep it for undo, save it and show visitors. */
  private endStroke(): void {
    const now = this.layout.encode();
    if (!this.before || now === this.before) return;
    this.undoStack.push(this.before);
    if (this.undoStack.length > UNDO_MAX) this.undoStack.shift();
    build.canUndo = true;
    this.before = '';
    this.changed(now);
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    build.canUndo = this.undoStack.length > 0;
    const l = prev ? HomeLayout.decode(prev) : null;
    if (!l) return;
    this.layout = l;
    this.refresh();
    this.changed(prev!);
  }

  private changed(encoded: string): void {
    if (this.owner) collection.saveHome(encoded);
    if (session.active && this.owner) this.sendT = SEND_MS;
  }

  // ---------------------------------------------------------------- Online

  private receive(m: Msg): void {
    switch (m.t) {
      case 'hq':
        if (this.owner) this.sendHome(m.f);
        break;
      case 'hl': {
        if (this.owner) break;
        const k = m.k as number;
        const n = m.n as number;
        if (!this.pieces || this.pieces.k !== k) this.pieces = { k, parts: new Array(n).fill('') };
        this.pieces.parts[m.i as number] = String(m.d ?? '');
        if (typeof m.c === 'string') this.caught = m.c ? m.c.split(',').filter((id) => critterById(id)) : [];
        if (typeof m.dn === 'string') {
          daynight.adopt(m.dn as Phase, !!m.da, m.dl as number);
          this.lastDay = dayKey();
        }
        if (this.pieces.parts.some((s) => !s)) break;
        const l = HomeLayout.decode(this.pieces.parts.join(''));
        this.pieces = null;
        if (!l) break;
        this.layout = l;
        this.refresh();
        this.arrived = true;
        break;
      }
      case 'dn':
        daynight.adopt(m.v as Phase, !!m.a, m.l as number);
        this.lastDay = dayKey();
        break;
    }
  }

  /** The home to the room (or one visitor), in pieces small enough for the server. */
  private sendHome(to?: number): void {
    this.sendT = 0;
    if (!session.active || !this.owner) return;
    const s = this.layout.encode();
    const n = Math.max(1, Math.ceil(s.length / PIECE));
    const k = ++this.sendSeq;
    for (let i = 0; i < n; i++) {
      const m: Msg = { t: 'hl', k, i, n, d: s.slice(i * PIECE, (i + 1) * PIECE) };
      if (i === 0) {
        m.c = this.caught.join(',');
        m.dn = daynight.phase;
        m.da = daynight.auto;
        m.dl = Math.round(daynight.left);
      }
      session.send(m, to);
    }
  }

  /**
   * The time of day is the room's: a pick here turns it for everyone. The
   * owner keeps the clock on auto; visitors follow the phases it sends.
   */
  private shareDay(): void {
    daynight.follower = session.active && !this.owner;
    if (dayKey() === this.lastDay) return;
    this.lastDay = dayKey();
    if (session.active) session.send({ t: 'dn', v: daynight.phase, a: daynight.auto, l: Math.round(daynight.left) });
  }

  destroy(): void {
    this.netOff?.();
    this.netOff = null;
    setHomeMask(null);
    daynight.follower = false;
    build.available = build.home = false;
    stopBuilding();
    for (const p of this.patches.values()) for (const k of p.keys) this.scene.textures.remove(k);
    for (const r of this.roofs) {
      this.scene.textures.remove(r.key);
      this.scene.textures.remove(`${r.key}_s`);
    }
    this.patches.clear();
    this.roofs = [];
    this.critters.destroy();
  }
}
