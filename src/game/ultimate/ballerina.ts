import Phaser from 'phaser';
import { sound } from '../../audio';
import { BALLET_WAIST_Y } from '../../art/ballerina';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { Wrap } from '../Ballerina';
import { bloom, bump, clamp01, drag, easeIn, easeOut, flare, Fx, hash, strikeGround, type Ink } from './ink';
import type { Cast, IconPainter } from './types';

// The Ballerina's Special, Music Box. A great music box opens under her
// feet: its lid swings up on its hinge, a mirror inside, and the brass
// cylinder turns, its pins plucking the steel comb, a little tune of chimes
// with notes rising off it. She spins as a vortex of blades that goes where
// she goes, drawing foes in and slowing them as they're swept into the
// dance, every turn a cut; when the tune ends she curtsies, and the vortex
// bursts outward as a storm of steel petals. The Firebird's box is crimson
// lacquer and gold, her vortex fire feathers, her petals flame.
// She does the spinning herself (Ballerina.dance); this draws the box, the
// vortex and the petals and deals the blows.

/** How long the tune plays and she spins. */
export const MUSIC_MS = 4000;
/** After the tune: the curtsy, the burst, the lid closing. */
const END_MS = 1000;

const VORTEX_R = 32;
const PULL_R = 66;
const PULL_SPEED = 55;
const TICK = 250;
const TICK_DAMAGE = 3;
const SLOW = 0.55;
const BURST_R = 50;
const BURST_DAMAGE = 20;
const PETALS = 28;

/** The tune: steps up the box's scale (sound.noteHit), one every CHIME ms. */
const MELODY = [0, 2, 4, 3, 2, 1, 2, 0, 1, 3, 4, 2, 3, 1, 0, 0, 2, 4];
const CHIME = 222;

/** The box: its width, the depth of its top on screen, its front face, and the lid. */
const BOX_W = 46;
const BOX_D = 14;
const BOX_FRONT = 6;
const LID_H = 18;
/** How far the lid swings open, radians past flat. */
const LID_OPEN = 1.75;

/** An eighth note and a pair joined by a beam, as rows of pixels. */
const NOTES = [
  ['..##.', '..#.#', '..#..', '..#..', '###..', '##...'],
  ['.####', '.#..#', '.#..#', '.#..#', '##.##', '#..#.'],
];

interface Colours {
  lacquer: [number, number, number];
  gilt: [number, number, number];
  velvet: [number, number];
  mirror: [number, number];
  steel: [number, number, number];
}

const BOX_COLOURS: Colours = {
  lacquer: [0xf0a0c8, 0xc86898, 0x8a3868],
  gilt: [0xfff0a8, 0xd8aa48, 0x8a5a14],
  velvet: [0x7a1a48, 0x4a0c2a],
  mirror: [0xeef6ff, 0xb8c8e0],
  steel: [0xf4f8ff, 0xb8c4d8, 0x6a7690],
};

const FIREBIRD_COLOURS: Colours = {
  lacquer: [0xe8402a, 0xa8141a, 0x5a060c],
  gilt: [0xfff4b0, 0xecc040, 0x8a5a0c],
  velvet: [0x2a0808, 0x140303],
  mirror: [0xfff0c8, 0xe0a860],
  steel: [0xfff4c0, 0xffc840, 0xc06a18],
};

interface Note {
  x: number;
  y: number;
  t: number;
  kind: number;
  sway: number;
}

interface Petal {
  x: number;
  y: number;
  /** Height over the ground. */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  seed: number;
}

export class MusicBox extends Fx {
  private box: Ink;
  private vortex: Wrap;
  private petalInk: Ink;
  private col: Colours;
  private fb: boolean;
  private readonly bx: number;
  private readonly by: number;
  private notes: Note[] = [];
  private petals: Petal[] = [];
  private chimeT = 0;
  private chimeN = 0;
  /** The comb's tooth last plucked, and how long ago. */
  private pluck = { tooth: 0, t: 999 };
  private tickT = 0;
  private whirlT = 0;
  private burst = false;
  private lamp: Phaser.GameObjects.Light;
  private stopped = false;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, MUSIC_MS + END_MS);
    this.fb = c.look === 'firebird';
    this.col = this.fb ? FIREBIRD_COLOURS : BOX_COLOURS;
    this.bx = Math.round(c.x);
    this.by = Math.round(c.y) - 2;
    this.box = this.ink(BOX_W + 44, 96);
    const vw = VORTEX_R * 2 + 16;
    this.vortex = new Wrap(this.ink(vw, 64), this.ink(vw, 64), c.y);
    this.petalInk = this.ink(BURST_R * 2 + 60, BURST_R + 70);
    this.lamp = this.light(c.x, c.y - 12, 90, c.pal.light, 0);
    bloom(world, this.bx, this.by - 4, c.pal.hot, 2.2, 600, this.by + 10, 0.6);
    flare(world, this.bx, this.by - 6, 120, c.pal.light, 2, 700);
    sound.hourStrike(world.pan(c.x));
    sound.whirl(world.pan(c.x));
  }

  protected step(dt: number): void {
    const w = this.world;
    const h = this.c.hero;
    // Struck down mid-dance: the box falls quiet and closes.
    if (!this.stopped && w.heroDown && this.t < MUSIC_MS) {
      this.stopped = true;
      this.t = MUSIC_MS + END_MS * 0.4;
    }
    const playing = this.t < MUSIC_MS && !this.stopped;
    this.pluck.t += dt;
    if (playing) this.play(dt);
    if (playing) this.sweep(dt, h.x, h.y);
    if (!this.burst && this.t >= MUSIC_MS && !this.stopped) this.burstOut(h.x, h.y);
    this.lamp.x = h.x;
    this.lamp.y = h.y - 14;
    this.lamp.intensity = playing ? 1.3 + 0.3 * Math.sin(this.t * 0.02) : Math.max(0, this.lamp.intensity - dt * 0.004);
    this.drawBox();
    this.drawVortex(h.x, h.y, playing);
    this.drawPetals(dt);
  }

  // -------------------------------------------------------------------------
  // The tune and the dance

  /** Chimes, one note at a time, and the notes floating up off the box. */
  private play(dt: number): void {
    this.chimeT -= dt;
    if (this.chimeT > 0) return;
    this.chimeT += CHIME;
    const step = MELODY[this.chimeN % MELODY.length];
    this.chimeN++;
    sound.noteHit(this.world.pan(this.bx), step);
    this.pluck = { tooth: 2 + step * 2 + (this.chimeN % 2), t: 0 };
    if (this.chimeN % 2 === 1) {
      this.notes.push({ x: this.bx - 12 + hash(this.chimeN, 7) * 24, y: this.by - 4, t: this.t, kind: this.chimeN % 5 === 0 ? 1 : 0, sway: hash(this.chimeN, 3) * Math.PI * 2 });
    }
  }

  /** The vortex: foes near are drawn in and slowed, and those in its blades cut each tick. */
  private sweep(dt: number, x: number, y: number): void {
    const w = this.world;
    const p = this.c.pal;
    for (const f of w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) * 1.3) <= PULL_R)) drag(f, x, y, PULL_SPEED, dt);
    this.whirlT -= dt;
    if (this.whirlT <= 0) {
      this.whirlT = 650;
      sound.whirl(w.pan(x));
    }
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT += TICK;
    const cut: Hurtbox[] = w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - x, (b.y - y) * 1.3) <= VORTEX_R + b.radius);
    for (const f of cut) {
      f.hurt({ damage: TICK_DAMAGE, heavy: false, knock: 0, fromX: x, fromY: y });
      f.slow?.(SLOW, TICK + 200, p.mid);
      w.debris(this.fb ? [p.core, p.hot, p.mid, p.deep] : [0xffffff, p.hot, p.mid], f.x, f.y - f.bodyY, 2, f.y + 12, 'spores');
    }
    if (cut.length) sound.knife(w.pan(x), 1 + (this.chimeN % 2), false);
  }

  /** The curtsy's end: the vortex flies apart as petals of steel (or flame), cutting all round her. */
  private burstOut(x: number, y: number): void {
    this.burst = true;
    const w = this.world;
    const p = this.c.pal;
    strikeGround(w, x, y, BURST_R, { damage: BURST_DAMAGE, heavy: true, knock: 170, fromX: x, fromY: y });
    for (let i = 0; i < PETALS; i++) {
      const a = (i / PETALS) * Math.PI * 2 + hash(i, 5) * 0.3;
      const sp = 90 + hash(i, 9) * 80;
      this.petals.push({ x, y, z: BALLET_WAIST_Y + hash(i, 2) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 30 + hash(i, 4) * 50, spin: hash(i, 6) * Math.PI * 2, seed: i });
    }
    bloom(w, x, y - BALLET_WAIST_Y, p.hot, 2.8, 520, y + 30, 0.8);
    flare(w, x, y - BALLET_WAIST_Y, 160, p.light, 3, 600);
    w.debris(p.tints, x, y - BALLET_WAIST_Y, 22, y + 30, 'burst');
    w.cameras.main.shake(260, 0.0014);
    sound.shatter(w.pan(x), true);
    sound.encore(w.pan(x));
  }

  // -------------------------------------------------------------------------
  // Drawing

  /**
   * The box, seen from the front and above: lacquered sides trimmed in
   * gilt, the lid on its hinge at the back, and inside, on velvet, the brass
   * cylinder with its pins and the steel comb they pluck.
   */
  private drawBox(): void {
    const { bx, by, col, t } = this;
    const p = this.c.pal;
    // Open over a third of a second; closing again after the burst, then fading.
    const open = easeOut(t / 380) * (1 - easeIn(clamp01((t - MUSIC_MS - 300) / 500)));
    const fade = 1 - clamp01((t - MUSIC_MS - 650) / 350);
    const appear = easeOut(t / 160);
    const g = this.box.begin(bx, by - 26, by - 12);
    if (fade <= 0) {
      g.end();
      return;
    }
    const a = fade * appear;
    const x0 = bx - BOX_W / 2;
    const x1 = bx + BOX_W / 2;
    const back = by - BOX_D / 2;
    const front = by + BOX_D / 2;
    // The front face: lacquer, a gilt band top and bottom, a keyhole plate in the middle.
    for (let y = front; y < front + BOX_FRONT; y++) {
      for (let x = x0; x < x1; x++) {
        const edge = y === front || y === front + BOX_FRONT - 1;
        const lit = x < x0 + 2 ? 0 : x > x1 - 3 ? 2 : 1;
        g.put(x, y, edge ? col.gilt[edge && y === front ? 0 : 1] : col.lacquer[lit], a);
      }
    }
    for (let y = front + 2; y <= front + 3; y++) for (let x = bx - 1; x <= bx; x++) g.put(x, y, col.gilt[1], a);
    g.put(bx, front + 3, col.gilt[2], a);
    // Little feet.
    for (const fx of [x0 + 1, x1 - 3]) for (let x = fx; x < fx + 2; x++) g.put(x, front + BOX_FRONT, col.gilt[2], a);
    // The top: a gilt rim round the opening, velvet within.
    for (let y = back; y < front; y++) {
      for (let x = x0; x < x1; x++) {
        const rim = y === back || y === front - 1 || x === x0 || x === x1 - 1;
        const inner = !rim && (y === back + 1 || x === x0 + 1);
        g.put(x, y, rim ? col.gilt[y === front - 1 ? 0 : 1] : inner ? col.velvet[1] : col.velvet[0], a);
      }
    }
    if (open > 0.05) {
      // The cylinder along the back: brass, its pins rolling over the top.
      const cy0 = back + 2;
      for (let x = x0 + 4; x < x1 - 4; x++) {
        g.put(x, cy0, col.gilt[0], a);
        g.put(x, cy0 + 1, col.gilt[1], a);
        g.put(x, cy0 + 2, col.gilt[2], a);
        const pin = (x * 7 + Math.floor(t / 70)) % 9;
        if (pin === 0) g.put(x, cy0 - 1, col.steel[0], a);
        if (pin === 4) g.put(x, cy0 + 1, col.steel[1], a);
      }
      // The comb: a bar of steel and its teeth, longest at the bass end; the plucked one rings out in light.
      const teeth = 14;
      const comb0 = bx - 13;
      for (let x = comb0; x < comb0 + 27; x++) g.put(x, cy0 + 4, col.steel[1], a);
      for (let i = 0; i < teeth; i++) {
        const tx = comb0 + 1 + i * 2;
        const len = 5 - Math.floor((i / teeth) * 3);
        const ring = this.pluck.tooth % teeth === i && this.pluck.t < 160;
        const shake = ring && Math.floor(this.pluck.t / 30) % 2 ? 1 : 0;
        for (let d = 1; d <= len; d++) g.put(tx + (d === len ? shake : 0), cy0 + 4 + d, ring ? (d === len ? 0xffffff : p.core) : col.steel[d === 1 ? 0 : d < len ? 1 : 2], a);
        if (ring) g.put(tx, cy0 + 4 + len + 1, p.hot, a * 0.8);
      }
      // A glow off the velvet while it plays.
      if (t < MUSIC_MS) for (let i = 0; i < 6; i++) g.put(bx - 15 + hash(i, Math.floor(t / 90)) * 30, back + 9 + hash(i, 1) * 3, p.hot, a * 0.5);
    }
    // The lid, swung up on its hinge along the back edge.
    const th = open * LID_OPEN;
    const edge = back + BOX_D * Math.cos(th) - LID_H * Math.sin(th);
    const inside = Math.cos(th) < 0.7;
    const top = Math.min(back, edge);
    const bot = Math.max(back, edge);
    for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
      for (let x = x0; x < x1; x++) {
        const rim = x === x0 || x === x1 - 1 || y === Math.floor(top) || y === Math.ceil(bot);
        let c: number;
        if (rim) c = col.gilt[y === Math.floor(top) ? 0 : 1];
        else if (inside) {
          // The lining, and a mirror oval set in it, a sheen running across.
          const mx = (x + 0.5 - bx) / (BOX_W * 0.26);
          const my = (y + 0.5 - (top + bot) / 2) / Math.max(1, (bot - top) * 0.38);
          const glass = mx * mx + my * my <= 1;
          const ringM = glass && mx * mx + my * my > 0.7;
          const sheen = glass && Math.abs(mx + my * 0.8 - Math.sin(t * 0.002) * 0.8) < 0.12;
          c = ringM ? col.gilt[1] : glass ? (sheen ? 0xffffff : col.mirror[(x + y) % 5 === 0 ? 1 : 0]) : col.velvet[0];
        } else c = (x + y) % 7 === 0 ? col.gilt[1] : col.lacquer[x < bx ? 0 : 1];
        g.put(x, y, c, a);
      }
    }
    // Notes rising off the box, swaying, fading.
    this.notes = this.notes.filter((n) => this.t - n.t < 1100);
    for (const n of this.notes) {
      const k = (this.t - n.t) / 1100;
      const nx = n.x + Math.sin(n.sway + k * 5) * 3;
      const ny = n.y - 24 * easeOut(k) - 6;
      const na = (1 - clamp01((k - 0.6) / 0.4)) * a;
      const rows = NOTES[n.kind];
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') g.put(nx + i - 2, ny + j, j < 2 ? p.core : p.hot, na);
      });
    }
    g.end();
  }

  /**
   * The vortex round her: three rings of blades (fire feathers) whirling at
   * her ankles, waist and shoulders, wider as they rise like a funnel, and
   * streaks of light wound between them.
   */
  private drawVortex(x: number, y: number, playing: boolean): void {
    const p = this.c.pal;
    const cy = y - 12;
    const g = this.vortex.begin(x, cy, y);
    const grow = easeOut(this.t / 300);
    const fade = playing ? grow : 1 - clamp01((this.t - MUSIC_MS) / 200);
    if (fade <= 0) {
      g.end();
      return;
    }
    const spin = this.t * 0.012;
    const rings = [
      { h: 2, r: 15, n: 5 },
      { h: 11, r: 24, n: 7 },
      { h: 20, r: VORTEX_R, n: 9 },
    ];
    rings.forEach((ring, ri) => {
      const R = ring.r * grow;
      const ry = y - ring.h;
      const dir = ri % 2 ? -1 : 1;
      for (let b = 0; b < ring.n; b++) {
        const head = spin * (1.2 + ri * 0.25) * dir + (b / ring.n) * Math.PI * 2;
        // Each blade drags a fading arc behind it.
        for (let i = 0; i < 12; i++) {
          const f = i / 12;
          const a = head - dir * f * 0.75;
          const px = x + Math.cos(a) * R;
          const py = ry + Math.sin(a) * R * 0.45;
          const c = f < 0.15 ? p.core : f < 0.45 ? p.hot : f < 0.75 ? p.mid : p.deep;
          g.put(px, py, c, fade * (1 - f * 0.7));
          if (f < 0.3) g.put(px, py - 1, this.fb ? p.mid : p.hot, fade * 0.8);
        }
        // The blade: a sliver standing on its edge (a flickering feather of fire).
        const hx = x + Math.cos(head) * R;
        const hy = ry + Math.sin(head) * R * 0.45;
        const tall = this.fb ? 3 + Math.round(Math.sin(this.t * 0.04 + b) + 1) : 3;
        for (let d = 0; d < tall; d++) g.put(hx, hy - d, d === tall - 1 ? 0xffffff : p.core, fade);
      }
    });
    // Streaks wound up the funnel.
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 16; i++) {
        const f = i / 16;
        const a = spin * 1.6 + s * (Math.PI / 2) + f * 2.4;
        const R = (12 + f * (VORTEX_R - 10)) * grow;
        g.put(x + Math.cos(a) * R, y - 2 - f * 20 + Math.sin(a) * R * 0.45, p.mid, fade * 0.5 * bump(f));
      }
    }
    g.end();
    if (playing && this.fb && Math.floor(this.t / 60) !== Math.floor((this.t - 16) / 60)) {
      this.world.debris([p.core, p.hot, p.mid, p.deep], x + (hash(Math.floor(this.t), 1) - 0.5) * VORTEX_R * 1.6, y - 6 - hash(Math.floor(this.t), 2) * 16, 2, y + 20, 'spores');
    }
  }

  /** The petals: blades (or flame feathers) flung out, tumbling, falling, winking out. */
  private drawPetals(dt: number): void {
    const p = this.c.pal;
    const h = this.c.hero;
    const g = this.petalInk.begin(h.x, h.y - 20, h.y + 40);
    const s = dt / 1000;
    const since = this.t - MUSIC_MS;
    for (const q of this.petals) {
      q.x += q.vx * s;
      q.y += q.vy * s;
      q.z += q.vz * s;
      q.vz -= 160 * s;
      q.vx *= 1 - 1.6 * s;
      q.vy *= 1 - 1.6 * s;
      if (q.z < 0) {
        q.z = 0;
        q.vz = 0;
      }
      q.spin += s * 9;
      const a = 1 - clamp01((since - 550) / 400);
      if (a <= 0) continue;
      const px = q.x;
      const py = q.y - q.z;
      // A petal: a little pointed leaf of light, turning as it tumbles.
      const ux = Math.cos(q.spin);
      const uy = Math.sin(q.spin) * 0.6;
      for (let d = -2; d <= 2; d++) {
        const c = d === -2 ? 0xffffff : Math.abs(d) < 1 ? p.core : this.fb && d > 0 ? p.mid : p.hot;
        g.put(px + ux * d, py + uy * d, c, a);
      }
      g.put(px - uy, py + ux * 0.6, this.fb ? p.deep : p.mid, a * 0.7);
      if (q.z > 0) g.put(q.x, q.y, 0x0b0818, a * 0.25);
    }
    g.end();
  }
}

/** Music Box: an open music box, its lid up with a mirror, notes rising over it. */
export const musicBoxIcon: IconPainter = (put, p) => {
  // The box's front and top rim.
  for (let x = 2; x <= 13; x++) {
    put(x, 13, p.mid);
    put(x, 15, p.deep);
    put(x, 11, p.hot);
  }
  for (let y = 11; y <= 15; y++) {
    put(2, y, p.hot);
    put(13, y, p.deep);
  }
  for (let x = 4; x <= 11; x += 2) put(x, 12, p.core);
  // The lid standing open behind, a mirror in it.
  for (let x = 3; x <= 12; x++) put(x, 6, p.hot);
  for (let y = 6; y <= 10; y++) {
    put(3, y, p.mid);
    put(12, y, p.mid);
  }
  for (let y = 7; y <= 9; y++) for (let x = 6; x <= 9; x++) put(x, y, (x + y) % 3 === 0 ? p.core : p.deep);
  // Notes over it.
  const note = (x: number, y: number) => {
    put(x, y, p.core);
    put(x + 1, y, p.core);
    put(x + 1, y - 1, p.hot);
    put(x + 1, y - 2, p.hot);
    put(x + 2, y - 3, p.hot);
  };
  note(2, 4);
  note(10, 3);
  put(7, 1, p.core);
  put(6, 2, p.mid);
  put(8, 2, p.mid);
};
