// Dev tool: paint Auto Battle heroes' effects to a PNG, frame by frame, on a
// stand-in board: a row each for the basic attack, the ability and the
// Special. The caster stands near the front of the near half, foes across the
// board, allies beside it. Uses the same kits the game draws (kits/*.ts).
// Usage: npx tsx scripts/autofx.ts <class.type|origin|all> [out.png] [scale] [frames]
import { writeFileSync } from 'node:fs';
import { UNITS, type Spell, type UnitDef } from '../src/game/auto/units';
import { kitFor } from '../src/game/auto/kits';
import { CELL, type Cast, type DrawFn, type Kit, type Layers, type Pal, type Pt, type SparkOpts, type Stage } from '../src/game/auto/paint';
import { encodePNG } from './png';

const W = 264;
const H = 300;
const LEFT = 48;
const TOP = 130;
const CW = 24;
const CH = 15;
const COLS = 7;
const ROWS = 8;
/** Each frame is cropped to this part of the canvas. */
const CROP = { x: 40, y: 70, w: 184, h: 215 };
const FPS = 60;

const pal = (core: number, hot: number, mid: number, deep: number, light = hot): Pal => ({ core, hot, mid, deep, light, tints: [core, hot, mid, deep] });

/** Each type's own Special palette (from ultimate/index.ts and the hero files), so the render matches the game. */
const PALS: Record<string, Pal> = {
  'wizard.arcane': pal(0xf2ffff, 0x9ff6ff, 0x39c6f0, 0x3a5ce0, 0x6fe4ff),
  'wizard.pyro': pal(0xfff8e0, 0xffd66b, 0xff9a2e, 0xd9432b, 0xff9a40),
  'wizard.tide': pal(0xf0ffff, 0x9cf4ff, 0x2ec4e0, 0x1a5ab8, 0x6ae0ff),
  'warrior.knight': pal(0xffffff, 0xfff4c8, 0xffd66b, 0xb8762a, 0xffe0a0),
  'warrior.king': pal(0xfffdf0, 0xffe8a0, 0xf4c040, 0x7a2a9a, 0xffd870),
  'paladin.holy': pal(0xffffff, 0xfff4c0, 0xffd66b, 0xc8903a, 0xfff0b0),
  'paladin.crusader': pal(0xfff8e0, 0xffd66b, 0xff8a3a, 0xc8401e, 0xffa050),
  'jedi.knight': pal(0xffffff, 0xa8e0ff, 0x4aa6ff, 0x2a5cd0, 0x6fb8ff),
  'jedi.sith': pal(0xfff0f4, 0xff7a8c, 0xd0203a, 0x3a0616, 0xff4a5a),
  'fighter.brawler': pal(0xfff4d8, 0xffc060, 0xff6a3a, 0xb82a2a, 0xff8a50),
  'fighter.monk': pal(0xfffbe0, 0xffe08a, 0xf0a63a, 0x9a5a24, 0xffc060),
  'alchemist.plague': pal(0xf2ffd2, 0xb8ff5c, 0x52d62e, 0x1c7a3a, 0x8aff5a),
  'alchemist.chem': pal(0xfbffd6, 0xe2ff4a, 0xa6d80e, 0x4a6e0a, 0xd0ff30),
  'archer.ranger': pal(0xf4ffe8, 0xc8f59a, 0x8ad65a, 0x3f8a4a, 0xb0f080),
  'archer.arbalest': pal(0xfffbe8, 0xffd27a, 0xff7a2a, 0x9e2725, 0xffa040),
  'archer.wind': pal(0xffffff, 0xd8fff6, 0x6ef0dc, 0x2a9a9a, 0xa0fff0),
  'rogue.rogue': pal(0xffffff, 0xffd0d4, 0xe8505a, 0x8a1c2c, 0xff6070),
  'rogue.dancer': pal(0xf8f0ff, 0xd4b8ff, 0xa878ff, 0x4a2a8a, 0xb890ff),
  'necromancer.necro': pal(0xf0fff8, 0xa8ffd8, 0x5cf0b0, 0x1f8a70, 0x7affc8),
  'necromancer.blood': pal(0xfff0f0, 0xff8a8a, 0xff3a4a, 0x8a0f1f, 0xff4a5a),
  'bard.minstrel': pal(0xf4fffc, 0xa8fff0, 0x3fd8c8, 0x1a7a8a, 0x6fe8d8),
  'bard.drummer': pal(0xfffbe8, 0xffd98a, 0xff9a3a, 0xb8401e, 0xffa850),
  'chronomancer.keeper': pal(0xfffbe8, 0xffe6a0, 0xffc050, 0xb8701e, 0xffd070),
  'chronomancer.paradox': pal(0xf6eeff, 0xd4b0ff, 0x9a5cff, 0x4a2a9a, 0xb890ff),
  'samurai.bladewind': pal(0xf4ffff, 0xbff4ff, 0x6fd4f0, 0x2a86b8, 0x8ae0ff),
  'samurai.ronin': pal(0xfffbe8, 0xffe08a, 0xf0b040, 0xa0601e, 0xffc860),
  'druid.grove': pal(0xf4ffe0, 0xc8ff7a, 0x6ad83a, 0x2a7a2a, 0x9aff6a),
  'druid.wild': pal(0xfff8e0, 0xffd080, 0xf09a30, 0x8a4a1a, 0xffb050),
  'valkyrie.spear': pal(0xfffdf2, 0xffe6a0, 0xf4c050, 0xa06a1e, 0xffe08a),
  'valkyrie.storm': pal(0xf2fbff, 0xa8e4ff, 0x5ec8ff, 0x3a6ad8, 0x8ad8ff),
  'automaton.mech': pal(0xfffbe8, 0xffd860, 0xff8a2a, 0xc83a10, 0xffb040),
  'automaton.synth': pal(0xf2ffff, 0x9ff6ff, 0x3ad6ff, 0x1a86b0, 0x6fe4ff),
  'phantom.poltergeist': pal(0xeefff8, 0x9ff0d4, 0x4ac8a0, 0x1a6a5a, 0x8af0c8),
  'phantom.wraith': pal(0xe0fff4, 0x7af0c0, 0x2ab888, 0x0e4a3a, 0x6af0b8),
  'inventor.engineer': pal(0xfffbe8, 0xffe070, 0xffa030, 0xc0501a, 0xffc050),
  'inventor.scientist': pal(0xf0ffff, 0xa8f4ff, 0x40d0ff, 0x1a6ab0, 0x7ae4ff),
  'beast.eagle': pal(0xffffff, 0xd8f4ff, 0x6ec8f0, 0x2a6ab0, 0xa8e0ff),
  'beast.lion': pal(0xfffbe8, 0xffe08a, 0xf0a830, 0xa8581a, 0xffc860),
  'beast.dragon': pal(0xfff8d0, 0xffd060, 0xff7a10, 0xb02a08, 0xff9030),
};

class Canvas {
  px = new Uint8ClampedArray(W * H * 4);
  put(x: number, y: number, c: number, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    const A = Math.round(Math.min(1, a) * 255);
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    const d = this.px;
    if (A < d[i + 3] || (A === d[i + 3] && r + g + b <= d[i] + d[i + 1] + d[i + 2])) return;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = A;
  }
  clear(): void {
    this.px.fill(0);
  }
}

interface Live {
  t: number;
  dur: number;
  draw: DrawFn;
  wait: number;
  done?: () => void;
}

interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  life: number;
  max: number;
  col: number;
  low: boolean;
}

/** The game's FxLayer, without Phaser. */
class Mock implements Stage {
  lives: Live[] = [];
  sparkList: Spark[] = [];
  ground = new Canvas();
  air = new Canvas();
  lights: { x: number; y: number; size: number; col: number; a: number }[] = [];
  layers: Layers;
  constructor() {
    const at = (c: Canvas) => ({ put: (x: number, y: number, col: number, a?: number) => c.put(x, y, col, a) });
    this.layers = { ground: at(this.ground), air: at(this.air), light: (x, y, size, col, a) => this.lights.push({ x, y, size, col, a }) };
  }
  add(dur: number, draw: DrawFn, wait = 0, done?: () => void): void {
    this.lives.push({ t: 0, dur, draw, wait, done });
  }
  sparks(x: number, y: number, n: number, cols: number[], o: SparkOpts = {}): void {
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + (Math.random() - 0.5) * 2 * (o.cone ?? 0.5) : Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 30) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.45) * (0.6 + Math.random() * 0.7);
      const sx = (Math.random() - 0.5) * (o.spread ?? 0);
      this.sparkList.push({ x: x + sx, y: y + (Math.random() - 0.5) * (o.spread ?? 0) * 0.62, z: o.z ?? 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.62, vz: (o.up ?? 30) * (0.5 + Math.random()), g: o.g ?? 90, life, max: life, col: cols[i % cols.length], low: !!o.ground });
    }
  }
  shake(): void {}
  step(dt: number): void {
    this.ground.clear();
    this.air.clear();
    this.lights = [];
    const running = this.lives;
    this.lives = [];
    const kept = running.filter((f) => {
      let s = dt;
      if (f.wait > 0) {
        f.wait -= dt;
        if (f.wait > 0) return true;
        s = -f.wait;
        f.wait = 0;
      }
      f.t += s;
      const k = Math.min(1, f.t / f.dur);
      f.draw(this.layers, k, f.t);
      if (k >= 1) {
        f.done?.();
        return false;
      }
      return true;
    });
    // Effects started by one ending (a missile's landing) join the list after it.
    this.lives = kept.concat(this.lives);
    this.sparkList = this.sparkList.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) return false;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vz -= s.g * dt;
      s.z = Math.max(0, s.z + s.vz * dt);
      const a = Math.min(1, (s.life / s.max) * 1.6);
      const x = Math.round(s.x);
      const y = Math.round(s.y - s.z);
      if (a >= 1 || ((x * 7 + y * 13) & 7) / 8 < a) (s.low ? this.ground : this.air).put(x, y, s.col, 1);
      return true;
    });
  }
}

const cellPt = (c: number, r: number): Pt => ({ x: LEFT + c * CW + CW / 2, y: TOP + r * CH + Math.round(CH * 0.7) });

/** The stand-in fight: who stands where. */
const CASTER = { c: 3, r: 6 };
const ALLIES = [
  { c: 2, r: 6 },
  { c: 4, r: 7 },
  { c: 5, r: 6 },
];
const FOES = [
  { c: 3, r: 3 },
  { c: 2, r: 3 },
  { c: 4, r: 2 },
  { c: 3, r: 2 },
  { c: 1, r: 2 },
  { c: 5, r: 3 },
];

function blend(out: Uint8ClampedArray, src: Uint8ClampedArray): void {
  for (let i = 0; i < out.length; i += 4) {
    const a = src[i + 3] / 255;
    if (a <= 0) continue;
    out[i] = out[i] * (1 - a) + src[i] * a;
    out[i + 1] = out[i + 1] * (1 - a) + src[i + 1] * a;
    out[i + 2] = out[i + 2] * (1 - a) + src[i + 2] * a;
  }
}

function backdrop(out: Uint8ClampedArray): void {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const bx = x - LEFT;
      const by = y - TOP;
      let c: number;
      if (bx >= 0 && by >= 0 && bx < COLS * CW && by < ROWS * CH) {
        const cc = Math.floor(bx / CW);
        const cr = Math.floor(by / CH);
        c = (cc + cr) % 2 ? 0x4a4466 : 0x534d72;
        if (bx % CW === 0 || by % CH === 0) c = 0x3a3452;
        if (cr === 4 && by % CH === 0) c = 0x6a5a8a;
      } else c = y < TOP ? 0x241c3c : 0x1a1530;
      out[i] = (c >> 16) & 255;
      out[i + 1] = (c >> 8) & 255;
      out[i + 2] = c & 255;
      out[i + 3] = 255;
    }
}

/** A plain figure standing at its feet. */
function figure(out: Uint8ClampedArray, p: Pt, body: number): void {
  const put = (x: number, y: number, c: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    out[i] = (c >> 16) & 255;
    out[i + 1] = (c >> 8) & 255;
    out[i + 2] = c & 255;
  };
  for (let dx = -5; dx <= 5; dx++) put(Math.round(p.x + dx), Math.round(p.y), 0x16122a);
  for (let y = 0; y < 22; y++) {
    const w = y > 17 ? 3 : y > 14 ? 2 : 4;
    for (let dx = -w; dx <= w; dx++) put(Math.round(p.x + dx), Math.round(p.y - 1 - y), y > 16 ? 0xe8c8a8 : body);
  }
}

function lights(out: Uint8ClampedArray, ls: Mock['lights']): void {
  for (const l of ls) {
    const r = l.size / 2;
    for (let y = Math.floor(l.y - r); y <= l.y + r; y++)
      for (let x = Math.floor(l.x - r); x <= l.x + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.hypot(x - l.x, (y - l.y) / 0.8) / r;
        if (d >= 1) continue;
        const k = l.a * Math.pow(1 - d, 2) * 0.8;
        const i = (y * W + x) * 4;
        out[i] = Math.min(255, out[i] + ((l.col >> 16) & 255) * k);
        out[i + 1] = Math.min(255, out[i + 1] + ((l.col >> 8) & 255) * k);
        out[i + 2] = Math.min(255, out[i + 2] + (l.col & 255) * k);
      }
  }
}

const d2 = (a: { c: number; r: number }, c: number, r: number) => (a.c - c) * (a.c - c) + (a.r - r) * (a.r - r);

/** What the sim would strike, roughly, for a spell aimed from the caster. */
function plan(s: Spell): { aim: { c: number; r: number }; atHit: Pt; hits: Pt[]; path: Pt[] } {
  const pts = (l: { c: number; r: number }[]) => l.map((o) => cellPt(o.c, o.r));
  const aim = s.aim === 'self' ? CASTER : FOES[0];
  const within = (c: number, r: number, R: number) => FOES.filter((o) => d2(o, c, r) <= R * R + 0.01);
  switch (s.kind) {
    case 'nova':
      return { aim, atHit: cellPt(CASTER.c, CASTER.r), hits: pts(within(CASTER.c, CASTER.r, s.r ?? 1.5)), path: [] };
    case 'blast':
      return { aim, atHit: cellPt(aim.c, aim.r), hits: pts(within(aim.c, aim.r, s.r ?? 1)), path: [] };
    case 'beam': {
      const L = s.r ?? 4;
      const end = { c: CASTER.c, r: CASTER.r - L };
      return { aim, atHit: cellPt(end.c, end.r), hits: pts(FOES.filter((o) => Math.abs(o.c - CASTER.c) <= 0.75 && CASTER.r - o.r <= L + 0.5)), path: [] };
    }
    case 'chain': {
      const order = [FOES[0], FOES[1], FOES[4], FOES[3], FOES[2], FOES[5]].slice(0, (s.n ?? 3) + 1);
      return { aim, atHit: cellPt(aim.c, aim.r), hits: pts(order), path: pts(order) };
    }
    case 'rain': {
      const pool = s.r ? within(aim.c, aim.r, s.r) : FOES;
      const list = pool.length ? pool : FOES;
      const path = Array.from({ length: s.n ?? 6 }, (_, i) => list[(i * 7 + 3) % list.length]);
      return { aim, atHit: cellPt(aim.c, aim.r), hits: [], path: pts(path) };
    }
    case 'mend':
      return { aim: CASTER, atHit: cellPt(CASTER.c, CASTER.r), hits: pts([CASTER, ...ALLIES.filter((o) => (s.r ?? 0) > 0 && d2(o, CASTER.c, CASTER.r) <= (s.r ?? 0) ** 2)]), path: [] };
    case 'leap':
    case 'dash':
      return { aim, atHit: cellPt(aim.c, aim.r), hits: pts([aim]), path: [] };
    default:
      return { aim, atHit: cellPt(aim.c, aim.r), hits: pts([aim]), path: [] };
  }
}

type Row = { label: string; total: number; start: (s: Mock) => void };

function rows(u: UnitDef, kit: Kit, p: Pal): Row[] {
  const from = cellPt(CASTER.c, CASTER.r);
  const foe = cellPt(FOES[0].c, FOES[0].r);
  const out: Row[] = [];
  if (u.missile) {
    const dur = Math.max(0.12, (Math.hypot(FOES[0].c - CASTER.c, FOES[0].r - CASTER.r) / 9));
    out.push({ label: 'shot', total: dur + 0.35, start: (s) => (kit.shot ? kit.shot(s, from, foe, dur, p) : undefined) });
  } else {
    const near = cellPt(FOES[0].c, CASTER.r - 1);
    out.push({ label: 'melee', total: 0.5, start: (s) => (kit.melee ? (kit.melee(s, near, from, p, false), s.add(0.25, () => {}, 0, () => kit.melee?.(s, near, from, p, true))) : undefined) });
  }
  for (const [label, spell, move, ult] of [
    ['skill', u.skill, kit.skill, false],
    ['ult', u.ult, kit.ult, true],
  ] as const) {
    const lead = (ult ? 0.4 : 0.3) + (spell.kind === 'blast' ? spell.delay ?? 0 : 0);
    const pl = plan(spell);
    const base: Cast = { from, at: cellPt(pl.aim.c, pl.aim.r), hits: [], path: [], r: (spell.r ?? 1) * CELL, pal: p, look: u.type, lead, span: spell.delay ?? 1.2, stun: spell.stun ?? 0 };
    const span = spell.kind === 'rain' ? base.span : 0;
    out.push({
      label,
      total: lead + span + 1.1,
      start: (s) => {
        if (!move) return;
        move.cast?.(s, base);
        s.add(lead, () => {}, 0, () => move.hit(s, { ...base, at: pl.atHit, hits: pl.hits, path: pl.path }));
      },
    });
  }
  return out;
}

function render(keys: string[], file: string, scale: number, frames: number): void {
  const strips: { label: string; px: Uint8ClampedArray[] }[] = [];
  for (const key of keys) {
    const u = UNITS[key];
    const kit = kitFor(key);
    const p = PALS[key] ?? PALS['wizard.arcane'];
    for (const row of rows(u, kit, p)) {
      const s = new Mock();
      row.start(s);
      const shots: Uint8ClampedArray[] = [];
      const steps = Math.ceil(row.total * FPS);
      const every = steps / frames;
      let next = every * 0.5;
      for (let i = 0; i < steps && shots.length < frames; i++) {
        s.step(1 / FPS);
        if (i + 1 >= next) {
          next += every;
          const out = new Uint8ClampedArray(W * H * 4);
          backdrop(out);
          blend(out, s.ground.px);
          figure(out, cellPt(CASTER.c, CASTER.r), 0x4a8ad0);
          for (const a of ALLIES) figure(out, cellPt(a.c, a.r), 0x3a6aa0);
          for (const f of FOES) figure(out, cellPt(f.c, f.r), 0xa04a4a);
          blend(out, s.air.px);
          lights(out, s.lights);
          shots.push(out);
        }
      }
      strips.push({ label: `${key} ${row.label}`, px: shots });
    }
  }
  const fw = CROP.w * scale;
  const fh = CROP.h * scale;
  const gap = 2 * scale;
  const OW = frames * (fw + gap);
  const OH = strips.length * (fh + gap);
  const img = new Uint8ClampedArray(OW * OH * 4);
  strips.forEach((st, ri) => {
    st.px.forEach((src, fi) => {
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          const sx = CROP.x + Math.floor(x / scale);
          const sy = CROP.y + Math.floor(y / scale);
          const si = (sy * W + sx) * 4;
          const di = ((ri * (fh + gap) + y) * OW + fi * (fw + gap) + x) * 4;
          img[di] = src[si];
          img[di + 1] = src[si + 1];
          img[di + 2] = src[si + 2];
          img[di + 3] = 255;
        }
    });
  });
  writeFileSync(file, encodePNG(OW, OH, img));
  console.log(`${file}: ${strips.map((s) => s.label).join(', ')}`);
}

const arg = process.argv[2] ?? 'all';
const keys = Object.keys(UNITS).filter((k) => arg === 'all' || k === arg || UNITS[k].origin === arg || k.startsWith(arg + '.'));
if (!keys.length) throw new Error(`No hero matches ${arg}`);
render(keys, process.argv[3] ?? 'autofx.png', Number(process.argv[4] ?? 2), Number(process.argv[5] ?? 8));
