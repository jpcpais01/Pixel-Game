import Phaser from 'phaser';
import { sound } from '../audio';
import { BIRD_H, BIRD_LOOKS, BIRD_OX, BIRD_OY, BIRD_W, DEER_H, DEER_OX, DEER_OY, DEER_W, FOX_H, FOX_OX, FOX_OY, FOX_W, OWL_H, OWL_OX, OWL_OY, OWL_W, type BirdLook, type DeerLook } from '../art/wildlife';
import { SUN_SHADOW_ALPHA, sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import type { Forest, StandingTree } from './Forest';
import { BIOMES, CHUNK, footKey, type ForestGen } from './forestGen';

// The Everwood's wild things: life, not foes. Nothing here is caught or
// fought, and each player sees their own (they are not sent online).
//  - Deer graze in little herds in the open: a doe or two, often a fawn,
//    now and then a young buck. They lift their heads to watch a hero who
//    comes near and edge away from one who walks right up, but a hero who
//    runs at them, or fights near them, sends the whole herd bounding off,
//    white tails up.
//  - A fox slips through the trees on its own errands, sniffing, sitting to
//    watch, trotting on; it dashes off if rushed.
//  - Songbirds peck in the grass in small flocks, and burst up and away from
//    a running hero. More hide in the treetops by day: run under their tree
//    and they start out of it all at once.
//  - By night an owl sits in a tree, its eyes catching the light, turning its
//    head and hooting now and then; rush beneath it and it glides away.
// Walking slowly (a light touch on the stick, or holding C on a keyboard) is
// how to get close.

/** Seconds between looks for somewhere to put new wild things. */
const SPAWN_EVERY = 2.5;
/** At most this many of each about at once (herds and flocks count as one). */
const MAX_HERDS = 1;
const MAX_FOXES = 1;
const MAX_FLOCKS = 2;
const MAX_OWLS = 2;
/** After a herd, fox or flock has gone, the wait (s) before another. */
const HERD_REST = [25, 50];
const FOX_REST = [40, 90];
const FLOCK_REST = [12, 30];
/** A hero moving faster than this (px/s) is running; slower than this is creeping. */
const RUN = 36;
const CREEP = 4;
/** Within these (px, y squashed) a running hero scatters them; a creeping one is watched, and one right up close is edged away from. */
const RUN_R = { deer: 150, fox: 135, bird: 85, owl: 75 };
const WATCH_R = { deer: 95, fox: 100, bird: 44, owl: 0 };
const CLOSE_R = { deer: 36, fox: 46, bird: 20, owl: 0 };
/** Fighting this near sends everything off. */
const FIGHT_R = 210;
/** Speeds (px/s): deer walking, edging away and bounding; the fox trotting and dashing; birds hopping and flying. */
const DEER_WALK = 9;
const DEER_EDGE = 17;
const DEER_BOUND = 100;
const FOX_TROT = 34;
const FOX_DASH = 125;
const HOP = 26;
const FLY = 92;
/** How long (s) a fleeing animal runs before it fades; and fading in and out (s). */
const FLEE_FOR = 3.6;
const FADE_IN = 1.2;
const FADE_OUT = 0.8;
/** Kept this far (px) beyond the view; further, they're gone. */
const KEEP = 380;
/** Treetop birds: a tree holds some with this chance, they start out of it when a running hero passes this near, and it is quiet for this long (s) after. */
const NEST_CHANCE = 0.35;
const NEST_R = 48;
const NEST_QUIET = 90;
const BURST_GAP = 3;

type Kind = 'deer' | 'fox' | 'bird' | 'owl';

interface Group {
  kind: Kind;
  members: Beast[];
  scared: boolean;
}

interface Beast {
  kind: Kind;
  look: string;
  group: Group;
  body: Phaser.GameObjects.Sprite;
  eyes: Phaser.GameObjects.Sprite | null;
  cast: Phaser.GameObjects.Sprite | null;
  blob: Phaser.GameObjects.Image | null;
  x: number;
  y: number;
  /** Height above its ground spot (birds aloft, an owl leaving). */
  z: number;
  face: 1 | -1;
  state: string;
  /** Time left in this state (s). */
  t: number;
  /** Where it's going, and how fast. */
  gx: number;
  gy: number;
  speed: number;
  alpha: number;
  fade: number;
  /** An owl's tree; a fox's legs still to go. */
  tree: StandingTree | null;
  legs: number;
  /** Fleeing: the way, and for how much longer. */
  fx: number;
  fy: number;
  anim: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const MEADOW = BIOMES.findIndex((b) => b.id === 'meadow');

export class Wildlife {
  private groups: Group[] = [];
  private spawnT = 1;
  private rest = { deer: 4, fox: rand(10, 30), bird: 2, owl: 0 };
  private lastX = NaN;
  private lastY = NaN;
  private heroSpeed = 0;
  /** The hero's smoothed heading, to put new things ahead of them. */
  private headX = 0;
  private headY = 0;
  private burstT = 0;
  /** When each tree's birds last started out of it (s, by foot key). */
  private nests = new Map<number, number>();
  private clock = 0;
  private hootT = rand(8, 16);

  constructor(
    private world: WorldScene,
    private forest: Forest,
    private gen: ForestGen,
  ) {
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const g of this.groups) for (const b of g.members) this.destroy(b);
      this.groups = [];
    });
  }

  update(dt: number, daylight: number, hero: { x: number; y: number; alive: boolean }, view: Phaser.Geom.Rectangle): void {
    const s = Math.min(0.1, dt / 1000);
    this.clock += s;
    this.sense(hero, s);
    for (const k of Object.keys(this.rest) as Kind[]) this.rest[k] = Math.max(0, this.rest[k] - s);

    this.spawnT -= s;
    if (this.spawnT <= 0) {
      this.spawnT = SPAWN_EVERY;
      this.populate(daylight, hero, view);
    }
    this.burstT -= s;
    if (hero.alive && daylight > 0.25) this.treetops(hero);

    const fighting = this.world.heroFighting && hero.alive;
    for (const g of this.groups) {
      // One spooked, all go.
      if (!g.scared && g.members.some((b) => this.threat(b, hero, fighting) === 'flee')) this.scare(g, hero);
      for (const b of g.members) this.step(b, s, daylight, hero, fighting);
    }
    // Owls hoot now and then, from where they sit.
    this.hootT -= s;
    if (this.hootT <= 0) {
      this.hootT = rand(9, 20);
      const owls = this.groups.filter((g) => g.kind === 'owl' && !g.scared).map((g) => g.members[0]);
      const o = owls[Math.floor(Math.random() * owls.length)];
      if (o && o.state === 'perch') {
        this.setState(o, 'hoot', 1.1);
        const d = Math.hypot(o.x - hero.x, o.y - hero.y);
        sound.owlHoot(this.world.pan(o.x), Math.max(0.25, 1 - d / 500));
      }
    }
    for (const g of this.groups) for (const b of g.members) this.show(b, daylight, view);

    // Gone: faded away, or left far behind.
    const far = (b: Beast) => b.x < view.left - KEEP || b.x > view.right + KEEP || b.y < view.top - KEEP || b.y > view.bottom + KEEP;
    for (const g of this.groups) {
      for (const b of g.members) if ((b.fade < 0 && b.alpha <= 0) || far(b) || (b.tree && !b.tree.obj.active)) this.destroy(b);
      g.members = g.members.filter((b) => b.body.active);
      if (!g.members.length) {
        const r = g.kind === 'deer' ? HERD_REST : g.kind === 'fox' ? FOX_REST : g.kind === 'bird' ? FLOCK_REST : [6, 14];
        this.rest[g.kind] = Math.max(this.rest[g.kind], rand(r[0], r[1]) * (g.scared ? 1 : 0.4));
      }
    }
    this.groups = this.groups.filter((g) => g.members.length);
  }

  /** How fast the hero is going (smoothed), and which way. */
  private sense(hero: { x: number; y: number }, s: number): void {
    if (Number.isNaN(this.lastX)) {
      this.lastX = hero.x;
      this.lastY = hero.y;
    }
    const mx = hero.x - this.lastX;
    const my = hero.y - this.lastY;
    const moved = Math.hypot(mx, my);
    // A jump (rising at a campfire) isn't running.
    const v = moved > 40 ? 0 : moved / Math.max(s, 0.001);
    this.heroSpeed += (v - this.heroSpeed) * Math.min(1, s * 8);
    if (moved > 0.01 && moved < 40) {
      const k = Math.min(1, s * 2);
      this.headX += (mx / moved - this.headX) * k;
      this.headY += (my / moved - this.headY) * k;
    }
    this.lastX = hero.x;
    this.lastY = hero.y;
  }

  /** What the hero is to this animal now. */
  private threat(b: Beast, hero: { x: number; y: number; alive: boolean }, fighting: boolean): 'flee' | 'edge' | 'watch' | 'calm' {
    if (!hero.alive || b.fade < 0) return 'calm';
    const d = Math.hypot(hero.x - b.x, (hero.y - b.y) * 1.25);
    if (fighting && d < FIGHT_R) return 'flee';
    if (this.heroSpeed > RUN && d < RUN_R[b.kind]) return 'flee';
    if (this.heroSpeed > CREEP && d < CLOSE_R[b.kind]) return 'edge';
    if (d < WATCH_R[b.kind]) return 'watch';
    return 'calm';
  }

  // ---------------------------------------------------------------- where they come

  /** New things just outside the view, ahead of the hero where possible. */
  private populate(daylight: number, hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const count = (k: Kind) => this.groups.filter((g) => g.kind === k).length;
    const day = daylight > 0.15;
    if (count('deer') < MAX_HERDS && this.rest.deer <= 0 && (day || Math.random() < 0.25)) {
      const at = this.spot(view, hero, 26);
      if (at) this.herd(at.x, at.y);
      else this.rest.deer = 3;
    }
    if (count('fox') < MAX_FOXES && this.rest.fox <= 0) {
      const at = this.spot(view, hero, 8);
      if (at) this.fox(at.x, at.y, view);
      else this.rest.fox = 4;
    }
    if (daylight > 0.3 && count('bird') < MAX_FLOCKS && this.rest.bird <= 0) {
      const at = this.spot(view, hero, 18);
      if (at) this.flock(at.x, at.y);
      else this.rest.bird = 3;
    }
    if (daylight < 0.35 && count('owl') < MAX_OWLS && this.rest.owl <= 0) this.owl(hero, view);
  }

  /**
   * A spot out of view (but not far), on open ground with `room` px free all
   * round, only where the forest has already grown; meadows are favoured.
   */
  private spot(view: Phaser.Geom.Rectangle, hero: { x: number; y: number }, room: number): { x: number; y: number } | null {
    const reach = Math.hypot(view.width, view.height) / 2;
    const ahead = Math.hypot(this.headX, this.headY) > 0.3 ? Math.atan2(this.headY, this.headX) : Math.random() * Math.PI * 2;
    let best: { x: number; y: number; score: number } | null = null;
    for (let i = 0; i < 10; i++) {
      const a = ahead + (Math.random() - 0.5) * (i < 6 ? 1.6 : Math.PI * 2);
      const d = reach + rand(30, 150);
      const x = hero.x + Math.cos(a) * d;
      const y = hero.y + Math.sin(a) * d * 0.85;
      if (view.contains(x, y) || !this.gen.hasFields(Math.floor(x / CHUNK), Math.floor(y / CHUNK))) continue;
      const h = this.gen.sample(x, y);
      if (h.grove > -36 || h.stream > -10 || h.pond > -10) continue;
      if (!this.open(x, y, room)) continue;
      const score = (this.gen.biomeAt(x, y) === MEADOW ? 2 : 1) + Math.random();
      if (!best || score > best.score) best = { x, y, score };
    }
    return best;
  }

  private open(x: number, y: number, r: number): boolean {
    if (!this.gen.walkable(x, y)) return false;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      if (!this.gen.walkable(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7)) return false;
    }
    return true;
  }

  private make(kind: Kind, look: string, group: Group, x: number, y: number): Beast {
    const add = this.world.add;
    const [key, w, h, ox, oy] =
      kind === 'deer' ? ['wdeer', DEER_W, DEER_H, DEER_OX, DEER_OY] : kind === 'fox' ? ['wfox', FOX_W, FOX_H, FOX_OX, FOX_OY] : kind === 'bird' ? ['wbird', BIRD_W, BIRD_H, BIRD_OX, BIRD_OY] : ['wowl', OWL_W, OWL_H, OWL_OX, OWL_OY];
    const frame = kind === 'deer' ? `${look}_idle0` : kind === 'bird' ? `${look}_idle0` : kind === 'fox' ? 'trot0' : 'perch0';
    const body = add.sprite(x, y, key, frame).setOrigin(ox / w, oy / h).setPipeline('Lit').setAlpha(0);
    // Owls sit up in the trees: no shadow on the ground under them.
    const grounded = kind !== 'owl';
    const cast = grounded ? sunShadow(add.sprite(x, y, `${key}_s`, frame).setOrigin(ox / w, oy / h)) : null;
    const blob = grounded ? add.image(x, y, 'shadow').setDepth(2).setScale(kind === 'deer' ? (look === 'fawn' ? 1 : 1.35) : kind === 'fox' ? 1.1 : 0.4, kind === 'bird' ? 0.4 : 0.7).setAlpha(0) : null;
    const eyes = kind === 'owl' ? add.sprite(x, y, 'wowl_e', frame).setOrigin(ox / w, oy / h).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0) : null;
    const b: Beast = { kind, look, group, body, eyes, cast, blob, x, y, z: 0, face: Math.random() < 0.5 ? 1 : -1, state: '', t: 0, gx: x, gy: y, speed: 0, alpha: 0, fade: 1, tree: null, legs: 0, fx: 0, fy: 0, anim: '' };
    group.members.push(b);
    return b;
  }

  private herd(x: number, y: number): void {
    const g: Group = { kind: 'deer', members: [], scared: false };
    const looks: DeerLook[] = ['doe'];
    if (Math.random() < 0.55) looks.push('doe');
    if (Math.random() < 0.5) looks.push('fawn');
    if (Math.random() < 0.35) looks.push('buck');
    for (const look of looks) {
      let px = x;
      let py = y;
      for (let i = 0; i < 6; i++) {
        const tx = x + rand(-30, 30);
        const ty = y + rand(-16, 16);
        if (this.gen.walkable(tx, ty)) {
          px = tx;
          py = ty;
          break;
        }
      }
      const b = this.make('deer', look, g, px, py);
      this.setState(b, Math.random() < 0.7 ? 'graze' : 'idle', rand(1, 6));
    }
    this.groups.push(g);
  }

  private fox(x: number, y: number, view: Phaser.Geom.Rectangle): void {
    const g: Group = { kind: 'fox', members: [], scared: false };
    const b = this.make('fox', 'fox', g, x, y);
    // Its errand takes it across the view and on out the other side.
    b.legs = 3 + Math.floor(Math.random() * 3);
    this.aimAcross(b, view);
    this.setState(b, 'trot', 30);
    this.groups.push(g);
  }

  /** A fox's next leg: somewhere across the view from where it is, picking its way between the trees. */
  private aimAcross(b: Beast, view: Phaser.Geom.Rectangle): void {
    for (let i = 0; i < 8; i++) {
      const tx = view.centerX + (view.centerX - b.x) * rand(0.2, 0.9) + rand(-60, 60);
      const ty = view.centerY + (view.centerY - b.y) * rand(0.2, 0.9) + rand(-50, 50);
      const len = Math.hypot(tx - b.x, ty - b.y);
      const gx = b.x + ((tx - b.x) / len) * Math.min(len, rand(70, 150));
      const gy = b.y + ((ty - b.y) / len) * Math.min(len, rand(70, 150));
      if (this.gen.walkable(gx, gy)) {
        b.gx = gx;
        b.gy = gy;
        return;
      }
    }
    b.gx = b.x + rand(-80, 80);
    b.gy = b.y + rand(-60, 60);
  }

  private flock(x: number, y: number): void {
    const g: Group = { kind: 'bird', members: [], scared: false };
    // Mostly one kind together, now and then another among them.
    const main = pick(BIRD_LOOKS);
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const look: BirdLook = Math.random() < 0.8 ? main : pick(BIRD_LOOKS);
      const px = x + rand(-20, 20);
      const py = y + rand(-12, 12);
      if (!this.gen.walkable(px, py)) continue;
      const b = this.make('bird', look, g, px, py);
      this.setState(b, 'peck', rand(0.3, 2));
    }
    if (g.members.length) this.groups.push(g);
  }

  /** An owl, on a branch of a tree in view but away from the hero, its eyes opening. */
  private owl(hero: { x: number; y: number }, view: Phaser.Geom.Rectangle): void {
    const taken = new Set(this.groups.filter((g) => g.kind === 'owl').map((g) => g.members[0].tree));
    const trees: StandingTree[] = [];
    this.forest.eachTree((t) => {
      if (t.kind === 'pine' || taken.has(t) || Math.hypot(t.x - hero.x, t.y - hero.y) < 150) return;
      if (t.x < view.left + 20 || t.x > view.right - 20 || t.y - t.top < view.top + 20 || t.y > view.bottom + 40) return;
      trees.push(t);
    });
    const t = trees[Math.floor(Math.random() * trees.length)];
    if (!t) {
      this.rest.owl = 4;
      return;
    }
    const g: Group = { kind: 'owl', members: [], scared: false };
    const side = Math.random() < 0.5 ? -1 : 1;
    const b = this.make('owl', 'owl', g, t.x + side * t.r * rand(0.25, 0.5), t.y);
    b.tree = t;
    // It sits low in the crown, on a branch: its ground spot is the tree's foot (so it draws in front of its own tree).
    b.z = t.top - t.r * rand(0.25, 0.45);
    b.fade = 1 / 2.2;
    this.setState(b, 'perch', rand(3, 8));
    this.groups.push(g);
    this.rest.owl = rand(8, 20);
  }

  /** Running past a tree with birds in it starts them out of the crown. */
  private treetops(hero: { x: number; y: number }): void {
    if (this.heroSpeed < RUN || this.burstT > 0) return;
    let hit: StandingTree | null = null;
    this.forest.eachTree((t) => {
      if (hit || t.kind === 'pine' || Math.abs(t.x - hero.x) > NEST_R || hero.y < t.y - t.top - 10 || hero.y > t.y + 30) return;
      const key = footKey(t.x, t.y);
      // Whether a tree has a nest is its own (the same tree, every visit).
      const h = Math.sin(t.x * 12.9898 + t.y * 78.233) * 43758.5453;
      if (h - Math.floor(h) > NEST_CHANCE) return;
      const last = this.nests.get(key);
      if (last !== undefined && this.clock - last < NEST_QUIET) return;
      this.nests.set(key, this.clock);
      hit = t;
    });
    const t = hit as StandingTree | null;
    if (!t) return;
    this.burstT = BURST_GAP;
    const g: Group = { kind: 'bird', members: [], scared: true };
    const main = pick(BIRD_LOOKS);
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const b = this.make('bird', Math.random() < 0.75 ? main : pick(BIRD_LOOKS), g, t.x + rand(-0.6, 0.6) * t.r, t.y + rand(-4, 4));
      b.z = t.top + rand(-0.5, 0.4) * t.r;
      b.alpha = 1;
      b.fade = 0;
      this.flee(b, hero, rand(0, 0.25));
    }
    this.groups.push(g);
    sound.wings(this.world.pan(t.x), n);
  }

  // ---------------------------------------------------------------- what they do

  private setState(b: Beast, state: string, t: number): void {
    b.state = state;
    b.t = t;
  }

  /** The whole group goes, each a moment after the last. */
  private scare(g: Group, hero: { x: number; y: number }): void {
    g.scared = true;
    for (const b of g.members) this.flee(b, hero, b.kind === 'bird' ? rand(0, 0.2) : rand(0, 0.35));
    const first = g.members[0];
    if (g.kind === 'deer') sound.deerBolt(this.world.pan(first.x));
    else if (g.kind === 'bird') sound.wings(this.world.pan(first.x), g.members.length);
    else if (g.kind === 'owl') sound.wings(this.world.pan(first.x), 1, true);
  }

  private flee(b: Beast, hero: { x: number; y: number }, delay: number): void {
    let ax = b.x - hero.x;
    let ay = b.y - hero.y;
    const l = Math.hypot(ax, ay) || 1;
    const a = Math.atan2(ay / l, ax / l) + (Math.random() - 0.5) * (b.kind === 'bird' ? 1.2 : 0.6);
    ax = Math.cos(a);
    ay = Math.sin(a);
    b.fx = ax;
    b.fy = ay;
    if (Math.abs(ax) > 0.15) b.face = ax > 0 ? 1 : -1;
    // Deer and the fox freeze for a beat first: a deer stamps, a fox's head comes up.
    this.setState(b, 'startle', delay + (b.kind === 'deer' ? 0.28 : b.kind === 'fox' ? 0.18 : 0));
  }

  private step(b: Beast, s: number, daylight: number, hero: { x: number; y: number; alive: boolean }, fighting: boolean): void {
    if (b.fade > 0) b.alpha = Math.min(1, b.alpha + s * (b.fade === 1 ? 1 / FADE_IN : b.fade));
    else if (b.fade < 0) b.alpha = Math.max(0, b.alpha - s / FADE_OUT);
    b.t -= s;
    if (b.state === 'startle') {
      this.play(b, b.kind === 'deer' ? 'alert' : b.kind === 'fox' ? 'alert' : b.kind === 'bird' ? 'fly' : 'fly');
      if (b.t <= 0) this.setState(b, 'flee', FLEE_FOR);
      return;
    }
    if (b.state === 'flee') {
      this.fleeing(b, s);
      return;
    }
    const threat = this.threat(b, hero, fighting);
    if (b.kind === 'deer') this.deer(b, s, threat, hero);
    else if (b.kind === 'fox') this.foxStep(b, s, threat, hero);
    else if (b.kind === 'bird') this.bird(b, s, threat, hero);
    else this.owlStep(b, s, daylight);
  }

  private fleeing(b: Beast, s: number): void {
    const v = b.kind === 'deer' ? DEER_BOUND : b.kind === 'fox' ? FOX_DASH : b.kind === 'bird' ? FLY : FLY * 0.7;
    if (b.kind === 'bird' || b.kind === 'owl') {
      // Up and away, over the trees.
      b.x += b.fx * v * s;
      b.y += b.fy * v * s * 0.6;
      b.z += v * s * (b.kind === 'owl' ? 0.35 : 0.55);
      this.play(b, 'fly');
    } else {
      this.move(b, b.fx * v, b.fy * v, s, true);
      this.play(b, b.kind === 'deer' ? 'bound' : 'dash');
    }
    if (b.t <= 0) b.fade = -1;
  }

  private deer(b: Beast, s: number, threat: string, hero: { x: number; y: number }): void {
    if (threat === 'edge' && b.state !== 'edge') {
      // Walked right up to: it turns and steps away, unhurried.
      const a = Math.atan2(b.y - hero.y, b.x - hero.x) + (Math.random() - 0.5) * 0.8;
      b.gx = b.x + Math.cos(a) * 46;
      b.gy = b.y + Math.sin(a) * 30;
      this.setState(b, 'edge', 2.6);
    } else if (threat === 'watch' && (b.state === 'graze' || b.state === 'idle' || b.state === 'walk')) {
      // A hero coming near: heads come up to watch them.
      b.face = hero.x >= b.x ? 1 : -1;
      this.setState(b, 'look', rand(2, 4));
    }
    switch (b.state) {
      case 'graze':
        this.play(b, 'graze');
        if (b.t > 0) break;
        if (Math.random() < 0.5) this.setState(b, 'idle', rand(1.5, 3.5));
        else {
          // A few steps to fresh grass, keeping near the others.
          this.setState(b, 'walk', rand(1.5, 3.5));
          this.wander(b, 30);
        }
        break;
      case 'idle':
        this.play(b, 'idle');
        if (b.t <= 0) this.setState(b, 'graze', rand(3, 8));
        break;
      case 'look':
        this.play(b, 'look');
        // Still watched while the hero stays near; back to grazing once they keep still or keep off.
        if (b.t <= 0) this.setState(b, threat === 'watch' && this.heroSpeed > CREEP ? 'look' : 'graze', threat === 'watch' ? rand(1.5, 3) : rand(3, 7));
        break;
      case 'walk':
      case 'edge': {
        this.play(b, 'walk');
        const dx = b.gx - b.x;
        const dy = b.gy - b.y;
        const d = Math.hypot(dx, dy);
        const v = b.state === 'edge' ? DEER_EDGE : DEER_WALK;
        if (d < 2 || b.t <= 0 || !this.move(b, (dx / d) * v, (dy / d) * v, s, false)) this.setState(b, b.state === 'edge' ? 'look' : 'graze', rand(2, 6));
        break;
      }
      default:
        this.setState(b, 'graze', rand(2, 6));
    }
  }

  /** Pick somewhere near its herd to wander to. */
  private wander(b: Beast, r: number): void {
    const others = b.group.members;
    const cx = others.reduce((a, o) => a + o.x, 0) / others.length;
    const cy = others.reduce((a, o) => a + o.y, 0) / others.length;
    b.gx = cx + rand(-r, r);
    b.gy = cy + rand(-r, r) * 0.6;
  }

  private foxStep(b: Beast, s: number, threat: string, hero: { x: number; y: number }): void {
    if (threat === 'edge' && b.state !== 'trot') {
      // Too close: it trots off, not quite in a hurry.
      const a = Math.atan2(b.y - hero.y, b.x - hero.x);
      b.gx = b.x + Math.cos(a) * 120;
      b.gy = b.y + Math.sin(a) * 90;
      b.legs = Math.max(b.legs, 1);
      this.setState(b, 'trot', 8);
    } else if (threat === 'watch' && b.state === 'trot' && this.heroSpeed > CREEP) {
      b.face = hero.x >= b.x ? 1 : -1;
      this.setState(b, 'watch', rand(1.5, 3));
    }
    switch (b.state) {
      case 'trot': {
        this.play(b, 'trot');
        const dx = b.gx - b.x;
        const dy = b.gy - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 3 || b.t <= 0 || !this.move(b, (dx / d) * FOX_TROT, (dy / d) * FOX_TROT, s, false)) {
          if (b.legs < 0) {
            // Gone on its way (out of sight, or melting into the trees where it's hemmed in).
            b.fade = -1;
            break;
          }
          b.legs--;
          if (b.legs === 0) {
            // Its errand done: off out of the view the way it's facing.
            const view = this.world.cameras.main.worldView;
            b.legs = -1;
            b.gx = b.x + b.face * (view.width + KEEP);
            b.gy = b.y + rand(-80, 80);
            this.setState(b, 'trot', 25);
            break;
          }
          // A pause along the way to sniff, or sit and look about.
          const r = Math.random();
          if (r < 0.85) this.setState(b, r < 0.5 ? 'sniff' : 'sit', r < 0.5 ? rand(1.2, 2.6) : rand(2.5, 6));
          else this.next(b);
        }
        break;
      }
      case 'sniff':
        this.play(b, 'sniff');
        if (b.t <= 0) this.next(b);
        break;
      case 'sit':
        this.play(b, threat === 'watch' ? 'sitlook' : 'sit');
        if (b.t <= 0) this.next(b);
        break;
      case 'watch':
        this.play(b, 'look');
        if (b.t <= 0) this.next(b);
        break;
      default:
        this.next(b);
    }
  }

  private next(b: Beast): void {
    this.aimAcross(b, this.world.cameras.main.worldView);
    this.setState(b, 'trot', 8);
  }

  private bird(b: Beast, s: number, threat: string, hero: { x: number; y: number }): void {
    if (threat === 'edge' && b.state !== 'hop') {
      // A careful step too close: it hops away from the hero.
      const a = Math.atan2(b.y - hero.y, b.x - hero.x) + (Math.random() - 0.5);
      b.gx = b.x + Math.cos(a) * 10;
      b.gy = b.y + Math.sin(a) * 6;
      this.setState(b, 'hop', 0.25);
    }
    switch (b.state) {
      case 'peck':
        this.play(b, 'peck');
        if (b.t <= 0) {
          const r = Math.random();
          if (r < 0.45) {
            const a = Math.random() * Math.PI * 2;
            b.gx = b.x + Math.cos(a) * rand(5, 10);
            b.gy = b.y + Math.sin(a) * rand(3, 6);
            this.setState(b, 'hop', 0.25);
          } else this.setState(b, r < 0.75 ? 'idle' : 'peck', rand(0.6, 2));
        }
        break;
      case 'idle':
        this.play(b, 'idle');
        if (b.t <= 0) this.setState(b, 'peck', rand(0.6, 2.4));
        break;
      case 'hop': {
        this.play(b, 'hop');
        const dx = b.gx - b.x;
        const dy = b.gy - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.5) this.move(b, (dx / d) * HOP, (dy / d) * HOP, s, false);
        if (b.t <= 0 || d <= 0.5) this.setState(b, Math.random() < 0.6 ? 'peck' : 'idle', rand(0.5, 1.8));
        break;
      }
      default:
        this.setState(b, 'peck', 1);
    }
  }

  private owlStep(b: Beast, _s: number, daylight: number): void {
    // Dawn: it slips away.
    if (daylight > 0.45 && !b.group.scared) {
      b.group.scared = true;
      b.fx = Math.random() < 0.5 ? -1 : 1;
      b.fy = -0.3;
      this.setState(b, 'flee', FLEE_FOR);
      return;
    }
    switch (b.state) {
      case 'perch':
        this.play(b, 'perch');
        if (b.t <= 0) this.setState(b, Math.random() < 0.6 ? 'turn' : 'perch', Math.random() < 0.6 ? 2 : rand(3, 7));
        break;
      case 'turn':
        this.play(b, 'turn');
        if (b.t <= 0) this.setState(b, 'perch', rand(3, 8));
        break;
      case 'hoot':
        this.play(b, 'hoot');
        if (b.t <= 0) this.setState(b, 'perch', rand(3, 8));
        break;
      default:
        this.setState(b, 'perch', 3);
    }
  }

  /** Walk (vx, vy) px/s, turning aside round what's in the way; false if it's stuck. */
  private move(b: Beast, vx: number, vy: number, s: number, fleeing: boolean): boolean {
    const turns = fleeing ? [0, 0.5, -0.5, 1, -1, 1.6, -1.6] : [0, 0.6, -0.6];
    for (const a of turns) {
      const c = Math.cos(a);
      const n = Math.sin(a);
      const dx = (vx * c - vy * n) * s;
      const dy = (vx * n + vy * c) * s;
      // Look a step ahead, so they turn before a tree, not in it.
      const lx = b.x + Math.sign(dx) * 6 + dx;
      const ly = b.y + Math.sign(dy) * 4 + dy;
      if (!this.gen.walkable(b.x + dx, b.y + dy) || !this.gen.walkable(lx, ly)) continue;
      b.x += dx;
      b.y += dy;
      if (Math.abs(dx) > 0.01) b.face = dx > 0 ? 1 : -1;
      if (fleeing && a !== 0) {
        // Keep the new way, so it doesn't run back into the same trunk.
        const fx = b.fx * c - b.fy * n;
        const fy = b.fx * n + b.fy * c;
        b.fx = fx;
        b.fy = fy;
      }
      return true;
    }
    return false;
  }

  private play(b: Beast, name: string): void {
    const key = b.kind === 'deer' ? `wdeer_${b.look}_${name}` : b.kind === 'fox' ? `wfox_${name}` : b.kind === 'bird' ? `wbird_${b.look}_${name}` : `wowl_${name}`;
    if (b.anim === key) return;
    b.anim = key;
    const frames = this.world.anims.get(key)?.frames.length ?? 1;
    // Each starts its loop at its own point, so a herd doesn't move as one.
    b.body.play({ key, startFrame: name === 'turn' || name === 'hoot' ? 0 : Math.floor(Math.random() * frames) });
  }

  /** Where everything is drawn, and how much of it. */
  private show(b: Beast, daylight: number, view: Phaser.Geom.Rectangle): void {
    const on = b.x > view.left - 40 && b.x < view.right + 40 && b.y - b.z > view.top - 40 && b.y - b.z < view.bottom + 50;
    const flip = b.kind !== 'owl' && b.face < 0;
    const ry = b.y - b.z;
    // Aloft (birds started from a crown, an owl taking off) they draw over the trees.
    const depth = b.kind === 'owl' ? (b.state === 'flee' ? 9989 : b.tree ? b.tree.y + 1 : b.y) : b.z > 6 ? 9989 : b.y;
    b.body.setVisible(on).setPosition(b.x, ry).setFlipX(flip).setAlpha(b.alpha).setDepth(depth);
    if (b.eyes) {
      b.eyes.setVisible(on).setPosition(b.x, ry).setAlpha(b.alpha * (0.35 + 0.65 * (1 - daylight))).setDepth(depth + 0.1);
      if (b.eyes.frame.name !== b.body.frame.name) b.eyes.setFrame(b.body.frame.name);
    }
    if (b.cast) {
      const low = b.z < 6;
      b.cast.setVisible(on && low).setPosition(b.x, b.y).setFlipX(flip).setAlpha(SUN_SHADOW_ALPHA * daylight * b.alpha);
      if (low && b.cast.frame.name !== b.body.frame.name) b.cast.setFrame(b.body.frame.name);
    }
    b.blob?.setVisible(on).setPosition(b.x, b.y).setAlpha(0.3 * b.alpha * Math.max(0, 1 - b.z / 40));
  }

  private destroy(b: Beast): void {
    for (const o of [b.body, b.eyes, b.cast, b.blob]) o?.destroy();
  }
}
