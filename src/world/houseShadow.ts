import Phaser from 'phaser';
import { SOLID_NONE, type HouseSolid } from '../art/homeWalls';
import { sunCastNow } from '../game/Wizard';

/** Redraw once the sun has swung this many degrees, or stretched by this much, since the last drawing. */
const REDRAW_ANGLE = 1.2;
const REDRAW_LENGTH = 0.015;
/** Steps along each pixel's column, px of height: under 1 px on the ground at the longest cast, so no gaps. */
const STEP = 0.8;
/** The longest a shadow is cast, per px of height (the evening sun's), for room round the drawing. */
const MAX_LENGTH = 1.1;
/** The silhouettes' colour (as the `_s` textures). */
const INK = [6, 8, 22];

/** Something standing on the house (a chimney): a block `w` x `d` px from (x, y) on the plot, from `base` up to `top`. */
export interface Stack {
  x: number;
  y: number;
  w: number;
  d: number;
  base: number;
  top: number;
}

/**
 * A house's sun shadow. A flat silhouette laid on the ground (as sunShadow
 * does) can't follow a hipped roof: its slopes reach up and back, so the
 * shadow is its own shape. Every pixel of the house is a column from its base
 * to its top; the shadow is each column swept along the ground the way the
 * sun casts, so walls throw a band and the roof its hips and ridge. It's
 * drawn again only when the sun has moved.
 */
export class HouseShadow {
  readonly img: Phaser.GameObjects.Image;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly pad: number;
  private readonly W: number;
  private readonly H: number;
  private readonly mask: Uint8Array;
  private readonly data: ImageData;
  private stacks: Stack[] = [];
  private angle = NaN;
  private length = NaN;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly key: string,
    private readonly solid: HouseSolid,
    /** Where the plot's top-left sits in the world. */
    ox: number,
    oy: number,
  ) {
    let top = 0;
    for (let i = 0; i < solid.top.length; i++) if (solid.top[i] !== SOLID_NONE) top = Math.max(top, solid.top[i]);
    // Room for chimneys too, which stand well above the ridge.
    this.pad = Math.ceil((top + 24) * MAX_LENGTH) + 2;
    this.W = solid.w + this.pad * 2;
    this.H = solid.h + this.pad + 2;
    this.tex = scene.textures.createCanvas(key, this.W, this.H)!;
    this.data = this.tex.context.createImageData(this.W, this.H);
    this.mask = new Uint8Array(this.W * this.H);
    this.img = scene.add.image(ox + solid.x - this.pad, oy + solid.y - 2, key).setOrigin(0).setDepth(2).setAlpha(0);
  }

  /** The chimneys on it (they come and go under a roof that stays). */
  setStacks(stacks: Stack[]): void {
    this.stacks = stacks;
    this.angle = NaN;
  }

  /** Follow the sun: redraw when it has moved enough to see. */
  update(): void {
    const { angle, length } = sunCastNow();
    if (Math.abs(angle - this.angle) < REDRAW_ANGLE && Math.abs(length - this.length) < REDRAW_LENGTH) return;
    this.angle = angle;
    this.length = length;
    this.draw();
  }

  private draw(): void {
    const { W, H, mask, solid } = this;
    mask.fill(0);
    // The ground offset per px of height, as sunShadow's flip, squash and turn lay it.
    const a = Phaser.Math.DegToRad(this.angle);
    const ux = -Math.sin(a) * this.length;
    const uy = Math.cos(a) * this.length;
    // Frame pixel (x, y) lands at mask (x + pad, y + 2).
    const sweep = (x: number, y: number, z0: number, z1: number) => {
      for (let z = z0; ; z += STEP) {
        const zz = Math.min(z, z1);
        const mx = Math.round(x + this.pad + ux * zz);
        const my = Math.round(y + 2 + uy * zz);
        if (mx >= 0 && my >= 0 && mx < W && my < H) mask[my * W + mx] = 1;
        if (zz >= z1) break;
      }
    };
    const { w: FW, h: FH, base, top } = solid;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= FW || y >= FH ? SOLID_NONE : base[y * FW + x]);
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const i = y * FW + x;
        const b = base[i];
        if (b === SOLID_NONE) continue;
        const t = top[i];
        if (b === 0) {
          // Inside the walls a column only adds to the roof's own sweep; the
          // walls' band comes from their outer edge.
          const edge = at(x - 1, y) !== 0 || at(x + 1, y) !== 0 || at(x, y - 1) !== 0 || at(x, y + 1) !== 0;
          sweep(x, y, edge ? 0 : top[i] - 1, t);
        } else sweep(x, y, b, t);
      }
    }
    for (const s of this.stacks) {
      for (let y = 0; y < s.d; y++) for (let x = 0; x < s.w; x++) sweep(s.x - solid.x + x, s.y - solid.y + y, s.base, s.top);
    }
    // The ground under the walls is the house's floor, not in the shade.
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) if (base[y * FW + x] === 0) mask[(y + 2) * W + x + this.pad] = 0;
    }
    const px = this.data.data;
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      px[o] = INK[0];
      px[o + 1] = INK[1];
      px[o + 2] = INK[2];
      px[o + 3] = mask[i] ? 255 : 0;
    }
    this.tex.context.putImageData(this.data, 0, 0);
    this.tex.refresh();
  }

  destroy(): void {
    this.img.destroy();
    this.scene.textures.remove(this.key);
  }
}
