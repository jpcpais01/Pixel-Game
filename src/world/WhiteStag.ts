import Phaser from 'phaser';
import { sound } from '../audio';
import { ALTAR_BASE, ALTAR_H, GROVE_BASE, GROVE_FOOT, GROVE_H, HOLLOW_BASE, HOLLOW_H, HOLLOW_MOUTH, SPRING_POOL, STAG_H, STAG_OX, STAG_OY, STAG_W } from '../art/stag';
import { RAY_FOOT_X, RAY_W } from '../art/trees';
import { STAG_GRACE, heroBuffs } from '../game/buffs';
import { critterById } from '../game/critters';
import { snap } from '../game/display';
import { session, type Msg } from '../net/session';
import type { WorldScene } from '../scenes/WorldScene';
import type { Forest } from './Forest';
import { CHUNK, type Blocker, type ForestGen } from './forestGen';

// The White Stag of the Everwood. Now and then, more often at dusk and by
// night, a glowing white stag steps out between the trees near the hero and
// looks at them. Walk toward it and it turns and goes, keeping a little ahead,
// stopping to look back when left behind, leaving faint glowing hoofprints.
// Rush right up to it, or fight near it, and it tenses, stamps, and then
// bolts and fades. Follow it gently and it leads, leg by leg, deep into the
// forest to a secret place that opens only for it: the trees stand aside and
//  - the Moonwell, a spring whose water blesses the hero (Stag's Grace);
//  - the Veiled Grove, an arch of ghost-birches hung with glowing moss that
//    parts to show an altar with a gift on it;
//  - the Moon Hare's Hollow, an ancient stump where the rare Moon Hare lives,
//    the only place it can be caught.
// Then the stag bows its head and is gone.
//
// Its way is found on the forest's own fields, only over ground already
// grown round the players (so it never makes the forest work harder), a leg
// at a time, searched a little each frame. Online the host decides: where it
// appears, where it goes, when it flees, and where its place opens; the
// others show it where the host says, and tell the host when they fight
// near it. Everyone takes their own gift from the place.

/** Time walking (ms) before the first stag of a visit, and between later ones (at random between the two). */
const FIRST_AFTER = 80000;
const EVERY = [150000, 240000];
/** Standing still, the wait passes this much slower; at dusk and by night this much faster. */
const IDLE_PACE = 0.25;
const NIGHT_PACE = 1.8;
/** After a stag has gone, whatever happened, none comes for at least this long. */
const COOLDOWN = 90000;
/** It steps out this far from the hero, inside the view. */
const APPEAR_NEAR = 140;
const APPEAR_FAR = 205;
/** Fading in and out, ms. */
const FADE_IN = 1400;
const FADE_OUT = 1500;
/** It turns to lead once a player comes this near; unnoticed this long, it wanders off. */
const NOTICE_R = 150;
const WATCH_MAX = 30000;
/** Leading: its walk and trot (px/s), the gap it keeps, and where it stops to wait and walks on again. */
const WALK = 34;
const TROT = 82;
const CLOSE = 72;
const WAIT_R = 165;
const RESUME_R = 112;
/** Left behind this far for this long, it gives up and fades. */
const LOSE_R = 480;
const LOSE_MS = 25000;
/** A player this near spooks it (per second of it), fighting this near too; and how fast that fades. */
const SPOOK_R = 38;
const SPOOK_RATE = 1 / 650;
const FIGHT_R = 140;
const FIGHT_RATE = 1 / 800;
const FIGHT_JOLT = 0.3;
const CALM_RATE = 1 / 4000;
/** Past this it stops, head up, and stamps (a warning); at 1 it bolts. */
const TENSE = 0.45;
const STAMP_MS = 800;
const GALLOP = 150;
const BOLT_MS = 1700;
/** Its journey: legs of about this length, turning a little each time, and how many before the place. */
const LEG = [230, 320];
const LEGS = [3, 5];
const TURN = 0.8;
/** The way-finding grid (px), and cells searched a frame / at most for one leg. */
const CELL = 10;
const SEARCH_PER_FRAME = 500;
const SEARCH_MAX = 9000;
/** How far round a secret place the forest stands aside. */
const GLADE_R: Record<SecretKind, number> = { spring: 44, grove: 50, hollow: 38 };
/** Hoofprints: one every so many px walked, how long they glow, and how many at most. */
const PRINT_EVERY = 9;
const PRINT_MS = 9000;
const MAX_PRINTS = 56;
/** The Moon Hare stays round its hollow this long. */
const HARE_LIFE = 150000;
/** How near (px) a player must come to take a place's gift. */
const TAKE_R = 26;
/** The host tells the others where the stag is this often (ms). */
const SEND_EVERY = 100;

export type SecretKind = 'spring' | 'grove' | 'hollow';

const SECRET_NAME: Record<SecretKind, string> = { spring: 'The Moonwell', grove: 'The Veiled Grove', hollow: "The Moon Hare's Hollow" };
const SECRET_LIGHT: Record<SecretKind, { r: number; color: number; i: number; dy: number }> = {
  spring: { r: 150, color: 0x9ad0ff, i: 1.6, dy: 0 },
  grove: { r: 150, color: 0xb8ffd8, i: 1.4, dy: -20 },
  hollow: { r: 110, color: 0xb8dcff, i: 1.4, dy: -8 },
};

type State = 'none' | 'appear' | 'watch' | 'lead' | 'wait' | 'stamp' | 'arrive' | 'bow' | 'leave' | 'bolt';
type Anim = 'idle' | 'look' | 'walk' | 'trot' | 'gallop' | 'graze' | 'alert';

interface Point {
  x: number;
  y: number;
}

interface Secret {
  id: number;
  kind: SecretKind;
  x: number;
  y: number;
  parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[];
  light: Phaser.GameObjects.Light;
  halo: Phaser.GameObjects.Image;
  /** This player has taken its gift. */
  taken: boolean;
  t: number;
  veil: Phaser.GameObjects.Sprite | null;
  veilGlow: Phaser.GameObjects.Sprite | null;
  altar: Phaser.GameObjects.Sprite | null;
  hareOut: boolean;
}

/** A binary heap of cell keys by cost, for the way-finding. */
class Heap {
  private k: number[] = [];
  private f: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, cost: number): void {
    this.k.push(key);
    this.f.push(cost);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.k[0];
    const lk = this.k.pop()!;
    const lf = this.f.pop()!;
    if (this.k.length) {
      this.k[0] = lk;
      this.f[0] = lf;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.k.length && this.f[l] < this.f[m]) m = l;
        if (r < this.k.length && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
  }
}

const cellKey = (gx: number, gy: number): number => gx * 131072 + gy;

export class WhiteStag {
  private state: State = 'none';
  private stateT = 0;
  /** Walking time left before the next stag comes. */
  private wait: number;
  private x = 0;
  private y = 0;
  private facing = 1;
  private shown = 0;
  private anim: Anim = 'idle';
  private speed = 0;
  private alarm = 0;
  private lostT = 0;
  /** Where it's going: the waypoints of this leg, the legs walked and to walk, which way it heads, and the place at the end. */
  private path: Point[] = [];
  private legs = 0;
  private legsTotal = 0;
  private heading = 0;
  private kind: SecretKind = 'spring';
  private final = false;
  private planning: Generator<void, Point[] | null, void> | null = null;
  /** How long (ms) it has been unable to find its next leg. */
  private stuckT = 0;
  /** It has stamped its warning, and won't again till it calms. */
  private tensed = false;
  /** Its body, glow, halo, shadow, light and the sparkles it sheds. */
  private body: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light | null = null;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private prints: { img: Phaser.GameObjects.Image; t: number }[] = [];
  private lastPrint: Point = { x: 0, y: 0 };
  private printSide = 1;
  private lastX = 0;
  private lastY = 0;
  private secrets: Secret[] = [];
  private nextSecret = 1;
  /** Online: where the host last said it was, and when this player last told the host they fought near it. */
  private net: { x: number; y: number; a: Anim; f: number; s: number; st: State } | null = null;
  private sendT = 0;
  private spookOut = 0;
  private wasFighting = false;
  private off: () => void;
  private heroX = 0;
  private heroY = 0;

  constructor(
    private world: WorldScene,
    private forest: Forest,
    private gen: ForestGen,
  ) {
    // ?stag brings one out at once, to see it.
    this.wait = new URLSearchParams(location.search).has('stag') ? 4000 : FIRST_AFTER;
    const add = world.add;
    this.shadow = add.image(0, 0, 'shadow').setScale(1.8, 0.8).setDepth(3).setVisible(false);
    this.halo = add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xcfe6ff).setScale(2.4, 2).setVisible(false);
    this.body = add.sprite(0, 0, 'stag', 'idle0').setOrigin(STAG_OX / STAG_W, STAG_OY / STAG_H).setPipeline('Lit').setVisible(false);
    this.glow = add.sprite(0, 0, 'stag_e', 'idle0').setOrigin(STAG_OX / STAG_W, STAG_OY / STAG_H).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.motes = add
      .particles(0, 0, 'spark', {
        lifespan: { min: 900, max: 1800 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -18, max: -6 },
        scale: { start: 0.55, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffffff, 0xd8f0ff, 0xfff0c0],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 110,
        emitting: false,
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-12, -32, 24, 26) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      })
      .setDepth(9989);
    this.off = session.on((m) => this.receive(m));
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** This game decides: alone, or the room's host. */
  private get leads(): boolean {
    return !session.active || session.isHost;
  }

  // ---------------------------------------------------------------- each frame

  update(time: number, dt: number, daylight: number, hero: { x: number; y: number; alive: boolean }, view: Phaser.Geom.Rectangle): void {
    this.heroX = hero.x;
    this.heroY = hero.y;
    if (this.leads) this.lead(dt, daylight, hero, view);
    else this.follow(dt);
    this.draw(time, dt, daylight, view);
    this.updateSecrets(time, dt, daylight, hero, view);
  }

  /** The heroes standing (this player's and the others'). */
  private players(): Point[] {
    return this.world.standing;
  }

  private nearest(): { p: Point | null; d: number } {
    let p: Point | null = null;
    let d = Infinity;
    for (const t of this.players()) {
      const e = Math.hypot(t.x - this.x, t.y - this.y);
      if (e < d) {
        d = e;
        p = t;
      }
    }
    return { p, d };
  }

  private go(s: State): void {
    this.state = s;
    this.stateT = 0;
  }

  /** Decide what it does (alone, or as the host). */
  private lead(dt: number, daylight: number, hero: { x: number; y: number; alive: boolean }, view: Phaser.Geom.Rectangle): void {
    this.stateT += dt;
    if (this.state === 'none') {
      const moving = Math.hypot(hero.x - this.lastX, hero.y - this.lastY) > 0.2;
      this.lastX = hero.x;
      this.lastY = hero.y;
      if (!hero.alive) return;
      this.wait -= dt * (moving ? 1 : IDLE_PACE) * (daylight < 0.6 ? NIGHT_PACE : 1);
      if (this.wait <= 0) {
        if (this.appear(hero, view)) sound.stag('appear', this.world.pan(this.x));
        else this.wait = 3000;
      }
      this.send(dt);
      return;
    }
    this.spook(dt);
    const { p, d } = this.nearest();
    if (this.state !== 'bolt' && this.state !== 'leave' && this.alarm >= 1) {
      this.bolt(p);
    } else if (this.alarm >= TENSE && !this.tensed && (this.state === 'lead' || this.state === 'wait' || this.state === 'watch')) {
      this.tensed = true;
      this.go('stamp');
    }
    if (this.alarm < TENSE * 0.5) this.tensed = false;
    switch (this.state) {
      case 'appear':
        this.shown = Math.min(1, this.stateT / FADE_IN);
        this.anim = 'look';
        this.face(p);
        if (this.shown >= 1) this.go('watch');
        break;
      case 'watch':
        this.anim = 'look';
        this.face(p);
        if (d < NOTICE_R) {
          this.startJourney(p);
          this.go('lead');
        } else if (this.stateT > WATCH_MAX) this.go('leave');
        break;
      case 'stamp':
        // Head up, a hoof stamped: a warning. Then it goes on, a little quicker.
        this.anim = 'alert';
        this.speed = 0;
        if (this.stateT > STAMP_MS) this.go(this.path.length || this.planning ? 'lead' : 'watch');
        break;
      case 'lead':
      case 'wait':
        this.pace(dt, d);
        break;
      case 'arrive':
        // Its place opens round it; it bows its head.
        this.anim = 'graze';
        this.speed = 0;
        if (this.stateT > 1300) {
          const off = this.standOff();
          this.reveal(this.kind, Math.round(this.x - off.x), Math.round(this.y - off.y), this.nextSecret++, true);
          this.go('bow');
        }
        break;
      case 'bow':
        this.anim = this.stateT < 1800 ? 'graze' : 'look';
        this.face(p);
        if (this.stateT > 4200 && (d < 90 || this.stateT > 9000)) this.go('leave');
        break;
      case 'leave':
        this.anim = 'look';
        this.speed = 0;
        this.shown = Math.max(0, this.shown - dt / FADE_OUT);
        if (this.shown <= 0) this.gone();
        break;
      case 'bolt': {
        this.anim = 'gallop';
        this.move((this.facing * GALLOP * dt) / 1000, 0, true);
        this.shown = Math.max(0, 1 - Math.max(0, this.stateT - 400) / (BOLT_MS - 400));
        if (this.stateT > BOLT_MS) this.gone();
        break;
      }
    }
    this.send(dt);
  }

  /** Leading: keep a little ahead of the nearest player, wait when they fall behind, give up if they're lost. */
  private pace(dt: number, d: number): void {
    this.plan(dt);
    if (this.state !== 'lead' && this.state !== 'wait') return;
    this.lostT = d > LOSE_R ? this.lostT + dt : 0;
    if (this.lostT > LOSE_MS) {
      this.go('leave');
      return;
    }
    if (this.state === 'wait') {
      this.speed = 0;
      // Standing, it turns to look back; now and then it grazes.
      this.anim = this.stateT % 9000 > 6000 ? 'graze' : 'look';
      this.face(this.nearest().p);
      if (d < RESUME_R) this.go('lead');
      return;
    }
    if (d > WAIT_R) {
      this.go('wait');
      return;
    }
    const goal = d < CLOSE ? TROT : WALK;
    this.speed += (goal - this.speed) * Math.min(1, dt / 350);
    if (!this.path.length) {
      // Still finding the way on: it stands and waits for it.
      this.speed = 0;
      this.anim = 'idle';
      if (!this.planning && this.final) this.go('arrive');
      return;
    }
    let step = (this.speed * dt) / 1000;
    while (step > 0 && this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const l = Math.hypot(dx, dy);
      if (l <= step) {
        this.move(dx, dy, false);
        step -= l;
        this.path.shift();
      } else {
        this.move((dx / l) * step, (dy / l) * step, false);
        step = 0;
      }
    }
    this.anim = this.speed > 58 ? 'trot' : 'walk';
    if (!this.path.length && !this.planning && this.final) this.go('arrive');
  }

  private move(dx: number, dy: number, free: boolean): void {
    if (Math.abs(dx) > 0.05) this.facing = Math.sign(dx);
    // Bolting, it goes where it likes (it's fading); otherwise it keeps to its way.
    if (free && !this.gen.walkable(this.x + dx, this.y + dy)) {
      dy = 0;
      if (!this.gen.walkable(this.x + dx, this.y)) return;
    }
    this.x += dx;
    this.y += dy;
  }

  private face(p: Point | null): void {
    if (p && Math.abs(p.x - this.x) > 4) this.facing = Math.sign(p.x - this.x);
  }

  /** How it's being spooked: players too close, and fighting nearby. */
  private spook(dt: number): void {
    if (this.state === 'bolt' || this.state === 'leave' || this.state === 'appear') return;
    for (const t of this.players()) if (Math.hypot(t.x - this.x, (t.y - this.y) * 1.2) < SPOOK_R) this.alarm += dt * SPOOK_RATE;
    this.alarm += this.fightNear(dt);
    this.alarm = Math.max(0, this.alarm - dt * CALM_RATE);
  }

  /** How much this player's own fighting near the stag alarms it this frame (a jolt when a fight begins). */
  private fightNear(dt: number): number {
    const fighting = this.world.heroFighting && this.state !== 'none' && this.shown > 0.2 && Math.hypot(this.heroX - this.x, this.heroY - this.y) < FIGHT_R;
    const jolt = fighting && !this.wasFighting ? FIGHT_JOLT : 0;
    this.wasFighting = fighting;
    return fighting ? jolt + dt * FIGHT_RATE : 0;
  }

  /** It bolts away from `from`, galloping and fading. */
  private bolt(from: Point | null): void {
    this.facing = from ? (from.x > this.x ? -1 : 1) : this.facing;
    this.path = [];
    this.planning = null;
    this.go('bolt');
    sound.stag('flee', this.world.pan(this.x));
    this.world.popNumber(snap(this.x), snap(this.y) - 52, 'IT FLED', 0xcfe0ff);
    this.world.debris([0xffffff, 0xd8f0ff], snap(this.x), snap(this.y) - 4, 10, this.y + 20, 'burst');
  }

  /** Gone: it will come again later. */
  private gone(): void {
    this.go('none');
    this.shown = 0;
    this.alarm = 0;
    this.path = [];
    this.planning = null;
    this.wait = COOLDOWN + EVERY[0] + Math.random() * (EVERY[1] - EVERY[0]);
  }

  // ---------------------------------------------------------------- appearing

  /** It steps out somewhere open near the hero, in view. False if nowhere will do yet. */
  private appear(hero: Point, view: Phaser.Geom.Rectangle): boolean {
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = APPEAR_NEAR + Math.random() * (APPEAR_FAR - APPEAR_NEAR);
      const x = Math.round(hero.x + Math.cos(a) * r);
      const y = Math.round(hero.y + Math.sin(a) * r * 0.8);
      if (x < view.x + 30 || x > view.right - 30 || y < view.y + 50 || y > view.bottom - 20) continue;
      if (!this.open(x, y) || !this.open(x - 14, y) || !this.open(x + 14, y)) continue;
      this.x = x;
      this.y = y;
      this.shown = 0;
      this.alarm = 0;
      this.speed = 0;
      this.lostT = 0;
      this.path = [];
      this.planning = null;
      this.face(hero);
      this.go('appear');
      this.world.announce('A White Stag');
      return true;
    }
    return false;
  }

  /** Setting off: its way leads on away from whoever noticed it. */
  private startJourney(from: Point | null): void {
    this.heading = from ? Math.atan2(this.y - from.y, this.x - from.x) : Math.random() * Math.PI * 2;
    this.legs = 0;
    this.legsTotal = LEGS[0] + Math.floor(Math.random() * (LEGS[1] - LEGS[0] + 1));
    const r = Math.random();
    this.kind = r < 0.36 ? 'spring' : r < 0.7 ? 'grove' : 'hollow';
    this.final = false;
    this.stuckT = 0;
  }

  // ---------------------------------------------------------------- finding the way

  /** Is (x, y) open ground it may walk, in forest already grown? */
  private open(x: number, y: number): boolean {
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    if (!this.gen.hasFields(cx, cy)) return false;
    // With its and its neighbours' layouts made, ask the forest itself (trunks, rocks and all).
    let laid = true;
    for (let j = -1; j <= 1 && laid; j++) for (let i = -1; i <= 1 && laid; i++) laid = this.gen.hasLayout(cx + i, cy + j) && this.gen.hasFields(cx + i, cy + j);
    if (laid) return this.gen.walkable(x, y);
    const s = this.gen.sample(x, y);
    if (s.roof > -12) return false;
    const water = Math.max(s.stream, s.pond);
    return !(water > -1 && s.trail > 0.5 && !(s.ford > 0.5 && s.stream >= s.pond));
  }

  /** Room for a secret place at (x, y): open all round, clear of the forest's own places and of other secret ones. */
  private roomy(x: number, y: number): boolean {
    const r = GLADE_R[this.kind];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const s = this.gen.hasFields(Math.floor((x + Math.cos(a) * r) / CHUNK), Math.floor((y + Math.sin(a) * r) / CHUNK)) ? this.gen.sample(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8) : null;
      if (!s || s.roof > -6 || Math.max(s.stream, s.pond) > -4) return false;
    }
    const s = this.gen.sample(x, y);
    if (s.roof > -14 || Math.max(s.stream, s.pond) > -10 || s.trail < 0) return false;
    if (this.gen.poisNear(x, y).some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 40)) return false;
    return !this.secrets.some((q) => Math.hypot(q.x - x, q.y - y) < 260);
  }

  /** Keep the way ahead planned: when this leg is nearly walked, find the next. */
  private plan(dt: number): void {
    if (this.final && !this.planning) return;
    if (!this.planning) {
      let left = 0;
      let px = this.x;
      let py = this.y;
      for (const t of this.path) {
        left += Math.hypot(t.x - px, t.y - py);
        px = t.x;
        py = t.y;
      }
      if (left > 70) return;
      const from = this.path.length ? this.path[this.path.length - 1] : { x: this.x, y: this.y };
      const last = this.legs + 1 >= this.legsTotal;
      const to = this.pickLeg(from, last);
      if (to) this.planning = this.search(from, to, last);
    }
    if (this.planning) {
      const r = this.planning.next();
      if (!r.done) return;
      this.planning = null;
      if (r.value) {
        this.path.push(...r.value);
        this.stuckT = 0;
        if (++this.legs >= this.legsTotal) this.final = true;
        return;
      }
    }
    // Nowhere ahead it can reach (the forest there not grown yet, or no room): it tries again, and in the end gives up.
    if (!this.path.length) {
      this.stuckT += dt;
      if (this.stuckT > 12000) this.go('leave');
    }
  }

  /** Where the next leg ends: ahead on its heading, somewhere open (and roomy, for the last). */
  private pickLeg(from: Point, last: boolean): Point | null {
    let best: Point | null = null;
    for (let k = 0; k < 14; k++) {
      const a = this.heading + (Math.random() - 0.5) * 2 * TURN * (k < 6 ? 0.6 : 1.4);
      const len = LEG[0] + Math.random() * (LEG[1] - LEG[0]);
      const x = Math.round(from.x + Math.cos(a) * len);
      const y = Math.round(from.y + Math.sin(a) * len * 0.85);
      if (!this.open(x, y)) continue;
      if (last) {
        const s = this.standOff();
        if (!this.roomy(x - s.x, y - s.y)) continue;
      }
      best = { x, y };
      this.heading = a;
      break;
    }
    return best;
  }

  /** Where the stag stands, from its place's middle: just in front of it. */
  private standOff(): Point {
    return this.kind === 'spring' ? { x: 0, y: SPRING_POOL.ry + 10 } : this.kind === 'grove' ? { x: 0, y: 34 } : { x: 30, y: 8 };
  }

  /** A* over the open ground from `a` to `b`, a slice a frame; the way as waypoints, or null. */
  private *search(a: Point, b: Point, last: boolean): Generator<void, Point[] | null, void> {
    const sx = Math.round(a.x / CELL);
    const sy = Math.round(a.y / CELL);
    const tx = Math.round(b.x / CELL);
    const ty = Math.round(b.y / CELL);
    const pad = 16;
    const x0 = Math.min(sx, tx) - pad;
    const x1 = Math.max(sx, tx) + pad;
    const y0 = Math.min(sy, ty) - pad;
    const y1 = Math.max(sy, ty) + pad;
    const g = new Map<number, number>();
    const from = new Map<number, number>();
    const openCache = new Map<number, boolean>();
    const isOpen = (gx: number, gy: number) => {
      const k = cellKey(gx, gy);
      let v = openCache.get(k);
      if (v === undefined) openCache.set(k, (v = this.open(gx * CELL, gy * CELL)));
      return v;
    };
    const heap = new Heap();
    const start = cellKey(sx, sy);
    g.set(start, 0);
    heap.push(start, Math.hypot(tx - sx, ty - sy));
    let n = 0;
    let found = -1;
    while (heap.size) {
      const k = heap.pop();
      const gx = Math.floor(k / 131072);
      const gy = k - gx * 131072;
      if (gx === tx && gy === ty) {
        found = k;
        break;
      }
      const gk = g.get(k)!;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || !isOpen(nx, ny)) continue;
          // No cutting corners past a trunk.
          if (dx && dy && (!isOpen(gx + dx, gy) || !isOpen(gx, gy + dy))) continue;
          const nk = cellKey(nx, ny);
          const cost = gk + (dx && dy ? 1.414 : 1);
          if (cost >= (g.get(nk) ?? Infinity)) continue;
          g.set(nk, cost);
          from.set(nk, k);
          heap.push(nk, cost + Math.hypot(tx - nx, ty - ny) * 1.05);
        }
      }
      if (++n > SEARCH_MAX) return null;
      if (n % SEARCH_PER_FRAME === 0) yield;
    }
    if (found < 0) return null;
    const cells: Point[] = [];
    for (let k: number | undefined = found; k !== undefined && k !== start; k = from.get(k)) {
      const gx = Math.floor(k / 131072);
      cells.push({ x: gx * CELL, y: (k - gx * 131072) * CELL });
    }
    cells.reverse();
    // The last cell is exactly where the leg ends (the place's own spot, on the last leg).
    if (last && cells.length) cells[cells.length - 1] = { x: b.x, y: b.y };
    // Straightened: from each waypoint, on to the farthest one in a clear line.
    const out: Point[] = [];
    let at: Point = a;
    let i = 0;
    while (i < cells.length) {
      let j = i;
      for (let k = Math.min(cells.length - 1, i + 14); k > i; k--) {
        if (this.clear(at, cells[k])) {
          j = k;
          break;
        }
      }
      out.push(cells[j]);
      at = cells[j];
      i = j + 1;
    }
    return out;
  }

  private clear(a: Point, b: Point): boolean {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let k = 1; k < n; k++) if (!this.open(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)) return false;
    return true;
  }

  // ---------------------------------------------------------------- online

  private send(dt: number): void {
    if (!session.active || !session.isHost) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = SEND_EVERY;
    if (this.state === 'none' && this.net?.st === 'none') return;
    const r1 = (v: number) => Math.round(v * 10) / 10;
    session.send({ t: 'sgp', x: r1(this.x), y: r1(this.y), a: this.anim, f: this.facing, s: Math.round(this.shown * 100) / 100, st: this.state });
    this.net = { x: this.x, y: this.y, a: this.anim, f: this.facing, s: this.shown, st: this.state };
  }

  /** Not the host: show the stag where the host says, and tell the host when fighting near it. */
  private follow(dt: number): void {
    const n = this.net;
    if (!n) {
      this.shown = Math.max(0, this.shown - dt / FADE_OUT);
      return;
    }
    if (n.st !== this.state) {
      if (n.st === 'appear' && this.state === 'none') {
        this.x = n.x;
        this.y = n.y;
        sound.stag('appear', this.world.pan(n.x));
        this.world.announce('A White Stag');
      }
      if (n.st === 'bolt') sound.stag('flee', this.world.pan(n.x));
      this.state = n.st;
    }
    const k = 1 - Math.exp(-dt / 120);
    const far = Math.hypot(n.x - this.x, n.y - this.y) > 60;
    const px = this.x;
    this.x = far ? n.x : this.x + (n.x - this.x) * k;
    this.y = far ? n.y : this.y + (n.y - this.y) * k;
    this.speed = (Math.abs(this.x - px) / Math.max(dt, 1)) * 1000;
    this.anim = n.a;
    this.facing = n.f;
    this.shown += (n.s - this.shown) * k;
    // This player fighting near it: the host hears of it.
    this.spookOut += this.fightNear(dt);
    this.sendT -= dt;
    if (this.spookOut > 0 && this.sendT <= 0) {
      session.send({ t: 'sk', v: Math.round(this.spookOut * 100) / 100 });
      this.spookOut = 0;
      this.sendT = 250;
    }
  }

  private receive(m: Msg): void {
    switch (m.t) {
      case 'sgp':
        if (!this.leads) this.net = { x: m.x as number, y: m.y as number, a: m.a as Anim, f: m.f as number, s: m.s as number, st: m.st as State };
        break;
      case 'sk':
        if (this.leads && this.state !== 'none') this.alarm += Math.min(1, m.v as number);
        break;
      case 'sgr':
        if (!this.leads && !this.secrets.some((s) => s.id === m.id)) this.reveal(m.k as SecretKind, m.x as number, m.y as number, m.id as number, !m.old);
        break;
      case 'peer+': {
        // Someone joined: show them the places already opened.
        if (!session.isHost) break;
        const to = (m.p as { id: number }).id;
        for (const s of this.secrets) session.send({ t: 'sgr', k: s.kind, x: s.x, y: s.y, id: s.id, old: 1 }, to);
        break;
      }
      case 'host':
        // The host changed: whoever leads now starts afresh; a stag that was out fades.
        if (this.leads && this.state !== 'none') this.go('leave');
        this.net = null;
        break;
    }
  }

  // ---------------------------------------------------------------- drawing

  private draw(time: number, dt: number, daylight: number, view: Phaser.Geom.Rectangle): void {
    const night = 1 - daylight;
    const out = this.shown > 0.01 && this.state !== 'none';
    const on = out && this.x > view.x - 60 && this.x < view.right + 60 && this.y > view.y - 20 && this.y < view.bottom + 70;
    for (const o of [this.body, this.glow, this.halo, this.shadow]) o.setVisible(on);
    this.motes.emitting = on && (this.speed > 8 || this.state === 'appear' || this.state === 'leave' || this.state === 'bolt');
    if (on && !this.light) this.light = this.world.lights.addLight(this.x, this.y, 110, 0xcfe0ff, 0);
    if (!on && this.light) {
      this.world.lights.removeLight(this.light);
      this.light = null;
    }
    this.updatePrints(dt, night, out);
    if (!on) return;
    const key = `stag_${this.anim}`;
    if (this.body.anims.currentAnim?.key !== key) {
      this.body.play(key);
      this.glow.play(`stag_e_${this.anim}`);
    }
    // Its legs keep time with its pace.
    const pace = this.anim === 'walk' ? Math.max(0.5, this.speed / WALK) : this.anim === 'trot' ? Math.max(0.6, this.speed / TROT) : 1;
    this.body.anims.timeScale = pace;
    this.glow.anims.timeScale = pace;
    const x = snap(this.x);
    const y = snap(this.y);
    const flip = this.facing < 0;
    const a = this.shown;
    this.body.setPosition(x, y).setDepth(y).setFlipX(flip).setAlpha(a);
    this.glow.setPosition(x, y).setDepth(y + 0.1).setFlipX(flip).setAlpha(a * (0.55 + night * 0.45));
    if (this.glow.frame.name !== this.body.frame.name) this.glow.setFrame(this.body.frame.name);
    const breathe = 0.9 + Math.sin(time * 0.003) * 0.1;
    this.halo.setPosition(x, y - 20).setDepth(y - 1).setAlpha(a * (0.12 + night * 0.4) * breathe);
    this.shadow.setPosition(x, y).setAlpha(a * (0.2 + daylight * 0.25));
    if (this.light) {
      this.light.x = this.x;
      this.light.y = this.y - 16;
      this.light.intensity = a * (0.35 + night * 1.3) * breathe;
    }
    this.motes.setPosition(x, y);
  }

  /** Faint glowing hoofprints where it walks, fading. */
  private updatePrints(dt: number, night: number, out: boolean): void {
    if (out && this.shown > 0.3 && this.state !== 'bolt') {
      const d = Math.hypot(this.x - this.lastPrint.x, this.y - this.lastPrint.y);
      if (d > 40) this.lastPrint = { x: this.x, y: this.y };
      else if (d >= PRINT_EVERY) {
        const ux = (this.x - this.lastPrint.x) / d;
        const uy = (this.y - this.lastPrint.y) / d;
        this.printSide = -this.printSide;
        this.stamp(this.x - uy * 2.5 * this.printSide, this.y + ux * 1.5 * this.printSide);
        this.lastPrint = { x: this.x, y: this.y };
      }
    } else this.lastPrint = { x: this.x, y: this.y };
    for (const p of this.prints) {
      if (p.t <= 0) continue;
      p.t -= dt;
      const k = Math.max(0, p.t / PRINT_MS);
      p.img.setAlpha(k * k * (0.3 + night * 0.55)).setVisible(p.t > 0);
    }
  }

  private stamp(x: number, y: number): void {
    let p = this.prints.find((q) => q.t <= 0);
    if (!p) {
      if (this.prints.length < MAX_PRINTS) {
        p = { img: this.world.add.image(0, 0, 'stag_print').setBlendMode(Phaser.BlendModes.ADD).setTint(0xcfe8ff).setDepth(3), t: 0 };
        this.prints.push(p);
      } else p = this.prints.reduce((a, b) => (a.t < b.t ? a : b));
    }
    p.t = PRINT_MS;
    p.img.setPosition(snap(x), snap(y)).setVisible(true).setFlipX(this.facing < 0);
  }

  // ---------------------------------------------------------------- the secret places

  /**
   * Open a secret place of `kind` round (x, y): the forest stands aside, the
   * place blooms out of the light. `fanfare` for one opening now (not one
   * shown to a player joining later).
   */
  private reveal(kind: SecretKind, x: number, y: number, id: number, fanfare: boolean): void {
    if (session.active && session.isHost) session.send({ t: 'sgr', k: kind, x, y, id });
    const add = this.world.add;
    const parts: Secret['parts'] = [];
    const blocks: Blocker[] = [];
    const lit = (key: string, frame: string, px: number, py: number, oy: number, depth: number, anim?: string) => {
      const body = add.sprite(px, py, key, frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(depth);
      const glow = add.sprite(px, py, `${key}_e`, frame).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1);
      if (anim) {
        body.play(`${key}_${anim}`);
        glow.play(`${key}_e_${anim}`);
      }
      parts.push(body, glow);
      return [body, glow] as const;
    };
    const s: Secret = { id, kind, x, y, parts, light: null!, halo: null!, taken: false, t: 0, veil: null, veilGlow: null, altar: null, hareOut: false };
    switch (kind) {
      case 'spring': {
        // Flat on the ground, under everything that stands.
        const [w, e] = lit('stag_spring', 'w0', x, y, 0.5, 3, 'loop');
        w.setDepth(2.6);
        e.setDepth(2.7);
        // A shaft of moonlight on the water.
        parts.push(add.image(x + 10, y + 4, 'ray', 'ray0').setOrigin(RAY_FOOT_X / RAY_W, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xa8c8ff).setAlpha(0.35).setDepth(y + 20));
        blocks.push({ x, y, rx: SPRING_POOL.rx - 2, ry: SPRING_POOL.ry - 1.5 });
        break;
      }
      case 'grove': {
        const ay = y + 16;
        const [veil, veilGlow] = lit('stag_grove', 'v0', x, ay, GROVE_BASE / GROVE_H, ay, 'veiled');
        s.veil = veil;
        s.veilGlow = veilGlow;
        const [altar] = lit('stag_altar', 'full', x, y - 6, ALTAR_BASE / ALTAR_H, y - 6);
        s.altar = altar;
        blocks.push({ x: x - GROVE_FOOT, y: ay - 1, rx: 4, ry: 3 }, { x: x + GROVE_FOOT, y: ay - 1, rx: 4, ry: 3 }, { x, y: y - 7, rx: 10, ry: 4 });
        break;
      }
      case 'hollow':
        lit('stag_hollow', 'h0', x, y, HOLLOW_BASE / HOLLOW_H, y, 'loop');
        blocks.push({ x, y: y - 3, rx: 14, ry: 5 }, { x: x - 18, y: y - 2, rx: 6, ry: 3 }, { x: x + 18, y: y - 2, rx: 6, ry: 3 });
        break;
    }
    // The forest stands aside for it.
    this.forest.part(x, y, GLADE_R[kind], blocks);
    const l = SECRET_LIGHT[kind];
    s.light = this.world.lights.addLight(x, y + l.dy, l.r, l.color, fanfare ? 0 : l.i);
    s.halo = add.image(x, y + l.dy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(l.color).setScale(3.2, 2.2).setDepth(y + 40).setAlpha(0.25);
    parts.push(s.halo);
    if (fanfare) {
      // Blooming out of the light.
      for (const p of parts) {
        const goal = p.alpha;
        p.setAlpha(0);
        this.world.tweens.add({ targets: p, alpha: goal, duration: 1600, ease: 'Sine.easeInOut' });
      }
      this.world.tweens.add({ targets: s.light, intensity: l.i, duration: 1600 });
      this.world.debris([0xffffff, 0xd8f0ff, l.color], snap(x), snap(y) - 10, 36, y + 30, 'gather');
      sound.stag('reveal', this.world.pan(x));
      this.world.announce(SECRET_NAME[kind]);
    } else s.t = 5000;
    this.secrets.push(s);
  }

  private updateSecrets(time: number, dt: number, daylight: number, hero: { x: number; y: number; alive: boolean }, view: Phaser.Geom.Rectangle): void {
    const night = 1 - daylight;
    for (const s of this.secrets) {
      const prev = s.t;
      s.t += dt;
      const on = s.x > view.x - 100 && s.x < view.right + 100 && s.y > view.y - 60 && s.y < view.bottom + 140;
      for (const p of s.parts) p.setVisible(on);
      const l = SECRET_LIGHT[s.kind];
      if (s.t > 1600) s.light.intensity = l.i * (0.45 + night * 0.55) * (0.9 + Math.sin(time * 0.002 + s.id) * 0.1);
      s.halo.setAlpha((0.08 + night * 0.25) * (0.9 + Math.sin(time * 0.002 + s.id) * 0.1));
      // The grove's veil parts once the place has bloomed.
      if (s.veil && prev < 1800 && s.t >= 1800) {
        s.veil.play('stag_grove_part').chain('stag_grove_open');
        s.veilGlow?.play('stag_grove_e_part').chain('stag_grove_e_open');
        sound.critterRelease(this.world.pan(s.x));
      }
      // The Moon Hare peeks out of its hollow.
      if (s.kind === 'hollow' && !s.hareOut && s.t >= 2200) {
        s.hareOut = true;
        const def = critterById('moonhare');
        const field = this.world.critterField;
        if (def && field) {
          field.release(def, s.x + 2, s.y + HOLLOW_MOUTH + 4, HARE_LIFE);
          sound.critterRelease(this.world.pan(s.x));
        }
      }
      if (!hero.alive || s.taken || s.t < 1800) continue;
      if (s.kind === 'spring' && Math.hypot((hero.x - s.x) / (SPRING_POOL.rx + 8), (hero.y - s.y) / (SPRING_POOL.ry + 8)) < 1) {
        s.taken = true;
        heroBuffs.add(STAG_GRACE);
        this.world.buffGained(STAG_GRACE);
        this.world.mendHero(1);
        sound.heal(this.world.pan(s.x));
        this.world.debris([0xffffff, 0xa8d8ff, 0xd8f0ff], snap(hero.x), snap(hero.y) - 10, 28, hero.y + 20, 'burst');
      } else if (s.kind === 'grove' && Math.hypot(hero.x - s.x, (hero.y - s.y) * 1.3) < TAKE_R) {
        s.taken = true;
        s.altar?.setFrame('spent');
        s.parts.find((p) => p.texture.key === 'stag_altar_e')?.setFrame('spent');
        this.world.openTreasure(s.x, s.y - 14);
        this.world.dropGems(3 + Math.floor(Math.random() * 3), s.x, s.y - 14);
      }
    }
  }

  destroy(): void {
    this.off();
    this.motes.destroy();
    if (this.light) this.world.lights.removeLight(this.light);
    this.light = null;
    for (const s of this.secrets) this.world.lights.removeLight(s.light);
    this.secrets = [];
  }
}
