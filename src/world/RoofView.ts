import Phaser from 'phaser';
import { CHIMNEY_H } from '../art/homeArt';
import { paintRoof } from '../art/homeWalls';
import { paintTent } from '../art/tentArt';
import { pixelCanvas } from '../art/canvas';
import { build } from '../game/build';
import { SUN_SHADOW_ALPHA } from '../game/Wizard';
import { HouseShadow, type Stack } from './houseShadow';
import type { House } from './houses';

// What covers the houses on a build grid, the Home's or the Everwood's: a
// hipped roof over each house (art/homeWalls.ts) with chimneys over its
// hearths, and each tent's cloth (art/tentArt.ts), each one picture,
// repainted only when its cells change, casting its own sun shadow. It fades
// away round a hero inside, shows through while they're behind it, and
// thins while building.

/** How long a roof takes to fade away, or come back, in ms. */
const FADE_MS = 260;
/** A roof over the hero's head from behind shows this much; while building, this much. */
const ROOF_BEHIND = 0.45;
const ROOF_BUILDING = 0.45;
/** A tent's hem on the ground lies with the flat things, under every body. */
const HEM_DEPTH = 1.55;

type Img = Phaser.GameObjects.Image;

interface Cover {
  sig: string;
  house: House;
  keys: string[];
  img: Img;
  /** A tent's door, glowing at night, and its hem on the ground. */
  glow: Img | null;
  hem: Img | null;
  shadow: HouseShadow;
  depth: number;
  /** For chimneys: how far up the roof lifts grid point (px, py). */
  lift: ((px: number, py: number) => number) | null;
  reveal: number;
  alpha: number;
  chimneys: { img: Img; smoke: Phaser.GameObjects.Particles.ParticleEmitter }[];
}

/** A chimney to stand on a house: the house's id and its foot on the grid (px). */
export interface Chimney {
  house: number;
  x: number;
  y: number;
}

let made = 0;

export class RoofView {
  private covers: Cover[] = [];
  private id = made++;
  private version = 0;

  /** `ox`, `oy`: where the grid's corner is in the world. */
  constructor(
    private scene: Phaser.Scene,
    private ox = 0,
    private oy = 0,
  ) {}

  /** Cover these houses: new or changed ones painted, gone ones taken away; then their chimneys. */
  sync(houses: House[], roofAt: (cx: number, cy: number) => number, tentAt: (cx: number, cy: number) => number, chimneys: Chimney[]): void {
    const sigOf = (h: House) => `${h.tent ? 't' : 'r'}|${h.cells.map((c) => `${c.x},${c.y}.${h.tent ? tentAt(c.x, c.y) : roofAt(c.x, c.y)}`).join(';')}`;
    const wanted = houses.map((h) => ({ h, sig: sigOf(h) }));
    const keep: Cover[] = [];
    for (const c of this.covers) {
      const w = wanted.find((x) => x.sig === c.sig);
      if (w) {
        c.house = w.h;
        keep.push(c);
      } else this.drop(c);
    }
    for (const w of wanted) if (!keep.some((c) => c.sig === w.sig)) keep.push(this.paint(w.h, w.sig, roofAt, tentAt));
    this.covers = keep;

    // Chimneys: stood up again every time, as hearths come and go under a roof that stays.
    for (const c of this.covers) {
      for (const k of c.chimneys) {
        k.img.destroy();
        k.smoke.destroy();
      }
      c.chimneys = [];
    }
    const stacks = new Map<Cover, Stack[]>(this.covers.map((c) => [c, []]));
    for (const ch of chimneys) {
      const c = this.covers.find((x) => x.house.id === ch.house);
      if (!c?.lift) continue;
      const lift = c.lift(ch.x, ch.y);
      const x = this.ox + ch.x;
      const y = this.oy + ch.y - lift + 2;
      const img = this.scene.add.image(x, y, 'home', 'chimney').setOrigin(0.5, 1).setPipeline('Lit').setDepth(c.depth + 0.5);
      const smoke = this.scene.add.particles(x, y - CHIMNEY_H + 3, 'rogue_smoke', {
        lifespan: 2800,
        speedY: { min: -15, max: -8 },
        speedX: { min: 2, max: 6 },
        scale: { start: 0.3, end: 1.1 },
        alpha: { start: 0.32, end: 0 },
        tint: [0xc8c0b8, 0xa8a4a8],
        frequency: 420,
      }).setDepth(c.depth + 1);
      c.chimneys.push({ img, smoke });
      // It casts with the house: a stack a little narrower than its drawing, from the roof up.
      stacks.get(c)!.push({ x: ch.x - 4, y: ch.y - 2, w: 8, d: 5, base: lift, top: lift + CHIMNEY_H - 3 });
    }
    for (const [c, s] of stacks) c.shadow.setStacks(s);
  }

  private paint(h: House, sig: string, roofAt: (cx: number, cy: number) => number, tentAt: (cx: number, cy: number) => number): Cover {
    const tex = this.scene.textures;
    const add = this.scene.add;
    const base = `rv${this.id}_${this.version++}`;
    const keys: string[] = [];
    const texture = (suffix: string, w: number, hh: number, diffuse: Uint8ClampedArray, normal: Uint8ClampedArray | null) => {
      const key = base + suffix;
      const t = tex.addCanvas(key, pixelCanvas(w, hh, diffuse))!;
      if (normal) t.setDataSource(pixelCanvas(w, hh, normal));
      keys.push(key);
      return key;
    };
    // Its picture sorts at the house's front (the foot of its south wall, or the tent's hem).
    const depth = this.oy + (h.y1 + 1) * 16 + 1;
    if (h.tent) {
      const art = paintTent(tentAt, h);
      const img = add.image(this.ox + art.x, this.oy + art.y, texture('', art.w, art.h, art.diffuse, art.normal)).setOrigin(0).setPipeline('Lit').setDepth(depth);
      const glow = add.image(this.ox + art.x, this.oy + art.y, texture('_e', art.w, art.h, art.glow, null)).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1);
      const m = art.hem;
      const hem = add.image(this.ox + m.x, this.oy + m.y, texture('_h', m.w, m.h, m.diffuse, m.normal)).setOrigin(0).setPipeline('Lit').setDepth(HEM_DEPTH);
      const shadow = new HouseShadow(this.scene, `${base}_s`, art.solid, this.ox, this.oy);
      return { sig, house: h, keys, img, glow, hem, shadow, depth, lift: null, reveal: 0, alpha: 1, chimneys: [] };
    }
    const art = paintRoof(roofAt, h);
    const img = add.image(this.ox + art.x, this.oy + art.y, texture('', art.w, art.h, art.diffuse, art.normal)).setOrigin(0).setPipeline('Lit').setDepth(depth);
    const shadow = new HouseShadow(this.scene, `${base}_s`, art.solid, this.ox, this.oy);
    return { sig, house: h, keys, img, glow: null, hem: null, shadow, depth, lift: art.lift, reveal: 0, alpha: 1, chimneys: [] };
  }

  /** How far house `id`'s cover has faded away for a hero inside (0 on .. 1 gone; 1 for none). */
  reveal(id: number): number {
    return this.covers.find((c) => c.house.id === id)?.reveal ?? 1;
  }

  /**
   * Each frame: the house the hero is `inside` (-1 for none) fades its cover
   * away, one they're behind shows through; `d` is the daylight, which sets
   * the shadows and how much a tent's door glows.
   */
  update(dt: number, heroX: number, heroY: number, inside: number, d: number): void {
    const step = dt / FADE_MS;
    const night = 0.15 + (1 - Math.max(0, d)) * 0.85;
    for (const c of this.covers) {
      c.reveal = Phaser.Math.Clamp(c.reveal + (c.house.id === inside ? step : -step), 0, 1);
      const behind = heroY < c.depth && heroY > c.img.y && heroX > c.img.x && heroX < c.img.x + c.img.width;
      const want = build.on ? (build.tab === 'roof' || build.tab === 'tent' ? 0.8 : ROOF_BUILDING) : behind ? ROOF_BEHIND : 1;
      c.alpha += (want - c.alpha) * Math.min(1, dt / 120);
      const a = c.alpha * (1 - Phaser.Math.Easing.Sine.InOut(c.reveal));
      c.img.setAlpha(a);
      c.glow?.setAlpha(a * night);
      c.shadow.img.setAlpha(SUN_SHADOW_ALPHA * d * (1 - c.reveal));
      if (d > 0.01 && c.reveal < 1) c.shadow.update();
      for (const k of c.chimneys) {
        k.img.setAlpha(a);
        k.smoke.emitting = a > 0.5;
      }
    }
  }

  private drop(c: Cover): void {
    c.img.destroy();
    c.glow?.destroy();
    c.hem?.destroy();
    c.shadow.destroy();
    for (const k of c.chimneys) {
      k.img.destroy();
      k.smoke.destroy();
    }
    for (const k of c.keys) this.scene.textures.remove(k);
  }

  destroy(): void {
    for (const c of this.covers) this.drop(c);
    this.covers = [];
  }
}
