import Phaser from 'phaser';
import { buildStrip, stripCount, STRIP_H, type GroundSpec, type GroundStrip } from '../art/ground';

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
  private count: number;

  constructor(
    private scene: Phaser.Scene,
    private spec: GroundSpec,
    private adopt: (img: Img) => Img,
  ) {
    this.count = stripCount(spec);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.job = null;
      this.shown.clear();
    });
  }

  /**
   * Build the strips covering world rows `top` to `bottom` ahead of time
   * (while booting), so the world opens without a pause.
   */
  static prebuild(scene: Phaser.Scene, spec: GroundSpec, top: number, bottom: number): void {
    const streamer = new GroundStreamer(scene, spec, (img) => img);
    for (let i = Math.max(0, Math.floor(top / STRIP_H)); i <= Math.min(streamer.count - 1, Math.floor(bottom / STRIP_H)); i++) {
      if (!streamer.ready(i)) streamer.buildNow(i);
    }
  }

  /** The texture holding strip `i` of `spec`'s ground (day look adds `_day`, glow `_e`). */
  static key(spec: GroundSpec, i: number): string {
    return `gnd_${spec.key}_${i}`;
  }

  /**
   * Build the strips covering rows `top` to `bottom` a little at a time, at
   * most `budget` ms per call (a menu warming an arena up). Returns true
   * once they are all built.
   */
  static warm(scene: Phaser.Scene, spec: GroundSpec, top: number, bottom: number, budget: number): boolean {
    let w = warming.get(scene);
    if (!w || w.spec !== spec) {
      w = { spec, job: null };
      warming.set(scene, w);
    }
    const first = Math.max(0, Math.floor(top / STRIP_H));
    const last = Math.min(stripCount(spec) - 1, Math.floor(bottom / STRIP_H));
    const start = performance.now();
    for (let i = first; i <= last; i++) {
      if (scene.textures.exists(GroundStreamer.key(spec, i))) continue;
      if (w.job?.index !== i) w.job = { index: i, gen: buildStrip(spec, i) };
      while (performance.now() - start < budget) {
        const r = w.job.gen.next();
        if (r.done) {
          w.job = null;
          install(scene, spec, r.value);
          break;
        }
      }
      if (w.job) return false;
    }
    return true;
  }

  /** Build everything the view shows right now, however long it takes. */
  prime(view: Phaser.Geom.Rectangle): void {
    this.update(view, 0);
  }

  /**
   * Keep the strips around `view` built and shown; spend at most `budget` ms
   * building ahead. A strip the view already shows (after a jump, like
   * rising back at the plaza) is built at once, whatever it costs.
   */
  update(view: Phaser.Geom.Rectangle, budget: number): void {
    for (const i of this.wanted(view, 0)) {
      if (this.ready(i)) continue;
      if (this.job?.index === i) this.job = null;
      this.buildNow(i);
    }
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
        this.job = { index: next, gen: buildStrip(this.spec, next) };
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
    const last = Math.min(this.count - 1, Math.floor(view.bottom / STRIP_H) + ahead);
    const mid = view.centerY / STRIP_H;
    const list: number[] = [];
    for (let i = first; i <= last; i++) list.push(i);
    return list.sort((a, b) => Math.abs(a + 0.5 - mid) - Math.abs(b + 0.5 - mid));
  }

  private buildNow(i: number): void {
    const gen = buildStrip(this.spec, i);
    let r = gen.next();
    while (!r.done) r = gen.next();
    this.install(r.value);
  }

  private ready(i: number): boolean {
    return this.scene.textures.exists(this.key(i));
  }

  private key(i: number): string {
    return GroundStreamer.key(this.spec, i);
  }

  private install(s: GroundStrip): void {
    install(this.scene, this.spec, s);
  }

  private show(i: number): void {
    if (this.shown.has(i)) return;
    const k = this.key(i);
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
    const k = this.key(i);
    for (const t of [k, `${k}_day`, `${k}_e`]) if (this.scene.textures.exists(t)) this.scene.textures.remove(t);
  }
}

/** A menu's strip being built a little at a time, per scene. */
const warming = new WeakMap<Phaser.Scene, { spec: GroundSpec; job: { index: number; gen: Generator<void, GroundStrip, void> } | null }>();

/** Turn a built strip into textures: night and day, each with its normal map, and its glow. */
function install(scene: Phaser.Scene, spec: GroundSpec, s: GroundStrip): void {
  const k = GroundStreamer.key(spec, s.index);
  const textures = scene.textures;
  const night = textures.addCanvas(k, toCanvas(s.w, s.h, s.night.diffuse))!;
  night.setDataSource(toCanvas(s.w, s.h, s.night.normal));
  const day = textures.addCanvas(`${k}_day`, toCanvas(s.w, s.h, s.day.diffuse))!;
  day.setDataSource(toCanvas(s.w, s.h, s.day.normal));
  if (s.emissive) textures.addCanvas(`${k}_e`, toCanvas(s.w, s.h, s.emissive));
}
