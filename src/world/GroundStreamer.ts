import Phaser from 'phaser';
import { buildStrip, STRIP_COUNT, STRIP_H, type GroundStrip } from '../art/ground';

// Streams the ground in and out as strips, so the world can be far larger
// than what fits in memory at once and there is never a loading screen.
// Strips near the view are built a little each frame, within a time budget;
// strips far from it give their textures back.

type Img = Phaser.GameObjects.Image;

interface Shown {
  night: Img;
  day: Img;
  glow: Img | null;
  y: number;
  h: number;
}

/** Strips kept beyond the view's edges before they are dropped. */
const KEEP = 5;
/** How far past the view to build ahead, in strips. */
const AHEAD = 2;

const key = (i: number) => `gnd${i}`;

function toCanvas(w: number, h: number, px: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
  return c;
}

export class GroundStreamer {
  private shown = new Map<number, Shown>();
  private job: { index: number; gen: Generator<void, GroundStrip, void> } | null = null;
  private daylight = 0;
  private glowAlpha = 1;

  /**
   * `adopt` hands each new ground image to the camera that draws the ground
   * (and hides it from the others).
   */
  constructor(
    private scene: Phaser.Scene,
    private adopt: (img: Img) => Img,
  ) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.job = null;
      this.shown.clear();
    });
  }

  /** Build everything the view shows right now, however long it takes. */
  prime(view: Phaser.Geom.Rectangle): void {
    for (const i of this.wanted(view, 0)) {
      if (this.ready(i)) continue;
      const gen = buildStrip(i);
      let r = gen.next();
      while (!r.done) r = gen.next();
      this.install(r.value);
    }
    this.update(view, 0);
  }

  /** Keep the strips around `view` built and shown; spend at most `budget` ms building. */
  update(view: Phaser.Geom.Rectangle, budget: number): void {
    const first = Math.floor(view.top / STRIP_H);
    const last = Math.floor(view.bottom / STRIP_H);
    for (const i of this.wanted(view, AHEAD)) {
      if (this.ready(i)) this.show(i);
    }
    for (const [i, s] of this.shown) {
      if (i < first - KEEP || i > last + KEEP) {
        this.drop(i);
        continue;
      }
      const on = s.y < view.bottom && s.y + s.h > view.top;
      s.night.setVisible(on);
      s.day.setVisible(on && this.daylight > 0.01);
      s.glow?.setVisible(on && this.glowAlpha > 0.01);
    }
    if (budget <= 0) return;

    const start = performance.now();
    while (performance.now() - start < budget) {
      if (!this.job) {
        const next = this.wanted(view, AHEAD).find((i) => !this.ready(i));
        if (next === undefined) return;
        this.job = { index: next, gen: buildStrip(next) };
      }
      const r = this.job.gen.next();
      if (r.done) {
        this.job = null;
        this.install(r.value);
        this.show(r.value.index);
      }
    }
  }

  /** Day ground's opacity, and the glow of runes and mushrooms. */
  setLight(daylight: number, glow: number): void {
    this.daylight = daylight;
    this.glowAlpha = glow;
    for (const s of this.shown.values()) {
      s.day.setAlpha(daylight);
      s.glow?.setAlpha(glow);
    }
  }

  /** Strip indices from the view's centre outward, reaching `ahead` strips past its edges. */
  private wanted(view: Phaser.Geom.Rectangle, ahead: number): number[] {
    const first = Math.max(0, Math.floor(view.top / STRIP_H) - ahead);
    const last = Math.min(STRIP_COUNT - 1, Math.floor(view.bottom / STRIP_H) + ahead);
    const mid = view.centerY / STRIP_H;
    const list: number[] = [];
    for (let i = first; i <= last; i++) list.push(i);
    return list.sort((a, b) => Math.abs(a + 0.5 - mid) - Math.abs(b + 0.5 - mid));
  }

  private ready(i: number): boolean {
    return this.scene.textures.exists(key(i));
  }

  private install(s: GroundStrip): void {
    const k = key(s.index);
    const textures = this.scene.textures;
    const night = textures.addCanvas(k, toCanvas(s.w, s.h, s.night.diffuse))!;
    night.setDataSource(toCanvas(s.w, s.h, s.night.normal));
    const day = textures.addCanvas(`${k}_day`, toCanvas(s.w, s.h, s.day.diffuse))!;
    day.setDataSource(toCanvas(s.w, s.h, s.day.normal));
    if (s.emissive) textures.addCanvas(`${k}_e`, toCanvas(s.w, s.h, s.emissive));
  }

  private show(i: number): void {
    if (this.shown.has(i)) return;
    const k = key(i);
    const y = i * STRIP_H;
    const add = this.scene.add;
    const night = this.adopt(add.image(0, y, k).setOrigin(0).setPipeline('Lit').setDepth(0));
    const day = this.adopt(add.image(0, y, `${k}_day`).setOrigin(0).setPipeline('Lit').setDepth(1).setAlpha(this.daylight));
    const glow = this.scene.textures.exists(`${k}_e`)
      ? this.adopt(add.image(0, y, `${k}_e`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setAlpha(this.glowAlpha))
      : null;
    this.shown.set(i, { night, day, glow, y, h: night.height });
  }

  private drop(i: number): void {
    const s = this.shown.get(i);
    if (!s) return;
    this.shown.delete(i);
    s.night.destroy();
    s.day.destroy();
    s.glow?.destroy();
    const k = key(i);
    for (const t of [k, `${k}_day`, `${k}_e`]) if (this.scene.textures.exists(t)) this.scene.textures.remove(t);
  }
}
