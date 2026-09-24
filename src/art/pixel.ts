// A tiny procedural pixel-art engine.
//
// Shapes are drawn into a buffer that stores, per pixel, a material, a
// surface normal and the layer (draw order) it came from. `render` then turns
// that into three images that share the same layout:
//   - diffuse:  palette-ramp shading from a fixed key light, selective
//               outlines and contact shadows between overlapping parts
//   - normal:   a tangent-space normal map for Phaser's Light2D pipeline
//   - emissive: glowing pixels, drawn additively and unaffected by lighting

export type RGB = [number, number, number];

export interface Material {
  /** Colour ramp, darkest first. */
  ramp: RGB[];
  /** Outline used on the shaded (bottom/right) side. */
  outline: RGB;
  /** Outline used on the lit (top/left) side. Defaults to `outline`. */
  outlineLit?: RGB;
  /** 0..1, how strongly this material glows in the emissive layer. */
  emissive?: number;
  /** Adds a specular pop to the brightest ramp step. */
  shine?: boolean;
  /** Shifts the whole ramp lookup (e.g. -1 for recessed cloth). */
  bias?: number;
  /** Skip contact shadows / edge darkening (for glowing things). */
  noAO?: boolean;
  /** Emits no outline around itself. */
  noOutline?: boolean;
}

export const hex = (s: string): RGB => {
  const n = parseInt(s.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const norm = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};

export const FLAT: Vec3 = { x: 0, y: 0, z: 1 };

/** Normal of a cylinder standing upright, `t` in -1..1 across its width. */
export const cyl = (t: number, tilt = 0.15): Vec3 => {
  const c = Math.max(-0.95, Math.min(0.95, t));
  return norm(c * 0.9, tilt, Math.sqrt(1 - c * c * 0.81));
};

/** Normal of an ellipsoid at offset (dx, dy) normalised to its radii. */
export const sphere = (dx: number, dy: number, flatten = 1): Vec3 => {
  const d2 = Math.min(0.95, dx * dx + dy * dy);
  return norm(dx, -dy, Math.sqrt(1 - d2) * flatten);
};

export type NormalFn = (x: number, y: number, t: number, u: number) => Vec3;

export interface DrawOpts {
  bias?: number;
  /** Emissive strength override for this primitive. */
  glow?: number;
}

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  mat: Int16Array;
  layer: Int16Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
  bias: Int8Array;
  glow: Float32Array;
  /** Pure light pixels (magic trails, sparks): only in the emissive layer. */
  light: Float32Array;
  private curLayer = 0;
  private materials: Material[] = [];
  private matIndex = new Map<Material, number>();

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.mat = new Int16Array(n).fill(-1);
    this.layer = new Int16Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n).fill(1);
    this.bias = new Int8Array(n);
    this.glow = new Float32Array(n);
    this.light = new Float32Array(n * 4);
  }

  private id(m: Material): number {
    let i = this.matIndex.get(m);
    if (i === undefined) {
      i = this.materials.length;
      this.materials.push(m);
      this.matIndex.set(m, i);
    }
    return i;
  }

  /** Start a new part: parts drawn later sit in front of earlier ones. */
  part(): this {
    this.curLayer++;
    return this;
  }

  px(x: number, y: number, m: Material, n: Vec3 = FLAT, o: DrawOpts = {}): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.mat[i] = this.id(m);
    this.layer[i] = this.curLayer;
    this.nx[i] = n.x;
    this.ny[i] = n.y;
    this.nz[i] = n.z;
    this.bias[i] = o.bias ?? 0;
    this.glow[i] = o.glow ?? m.emissive ?? 0;
  }

  /** Nudge the shading of an already drawn pixel. */
  shade(x: number, y: number, delta: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.mat[i] >= 0) this.bias[i] += delta;
  }

  erase(x: number, y: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.mat[y * this.w + x] = -1;
  }

  filled(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.mat[y * this.w + x] >= 0;
  }

  /**
   * Fill rows y0..y1 (inclusive). `edges(y)` returns the continuous left and
   * right edges for that row; a pixel is filled when its centre lies inside.
   * The normal callback receives t (-1..1 across the row) and u (0..1 down).
   */
  shape(
    y0: number,
    y1: number,
    edges: (y: number) => [number, number] | null,
    m: Material,
    normal: NormalFn = (_x, _y, t) => cyl(t),
    o: DrawOpts = {},
  ): void {
    for (let y = y0; y <= y1; y++) {
      const e = edges(y);
      if (!e) continue;
      const [l, r] = e;
      const u = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      const xa = Math.round(l);
      const xb = Math.round(r) - 1;
      for (let x = xa; x <= xb; x++) {
        const cx = x + 0.5;
        const t = r - l > 0.001 ? ((cx - l) / (r - l)) * 2 - 1 : 0;
        this.px(x, y, m, normal(x, y, t, u), o);
      }
    }
  }

  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    m: Material,
    o: DrawOpts & { flatten?: number; normal?: NormalFn } = {},
  ): void {
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          const n = o.normal ? o.normal(x, y, dx, dy) : sphere(dx, dy, o.flatten ?? 1);
          this.px(x, y, m, n, o);
        }
      }
    }
  }

  /**
   * Tapered capsule from (x0,y0) to (x1,y1), radius r0 -> r1. Normals wrap
   * around the capsule's axis, so limbs read as round.
   */
  capsule(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r0: number,
    r1: number,
    m: Material,
    o: DrawOpts = {},
  ): void {
    const r = Math.max(r0, r1);
    const minX = Math.floor(Math.min(x0, x1) - r);
    const maxX = Math.ceil(Math.max(x0, x1) + r);
    const minY = Math.floor(Math.min(y0, y1) - r);
    const maxY = Math.ceil(Math.max(y0, y1) + r);
    const vx = x1 - x0;
    const vy = y1 - y0;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / len2));
        const cx = x0 + vx * t;
        const cy = y0 + vy * t;
        const rr = r0 + (r1 - r0) * t;
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= rr * rr) {
          this.px(x, y, m, sphere(dx / rr, dy / rr, 1.1), o);
        }
      }
    }
  }

  /** 1px line between pixel coordinates. */
  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    m: Material,
    normal: (i: number, n: number) => Vec3 = () => FLAT,
    o: DrawOpts = {},
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(Math.round(x1) - Math.round(x0)), Math.abs(Math.round(y1) - Math.round(y0)));
    if (steps === 0) {
      this.px(x0, y0, m, normal(0, 1), o);
      return;
    }
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.px(Math.round(x0 + dx * t), Math.round(y0 + dy * t), m, normal(i, steps), o);
    }
  }

  /** Additive light pixel for the emissive layer only (sparks, trails). */
  spark(x: number, y: number, c: RGB, a = 1): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.light[i] = Math.min(255, this.light[i] + c[0] * a);
    this.light[i + 1] = Math.min(255, this.light[i + 1] + c[1] * a);
    this.light[i + 2] = Math.min(255, this.light[i + 2] + c[2] * a);
    this.light[i + 3] = 1;
  }

  /** Mirror horizontally (for right-facing frames), flipping normals too. */
  mirrored(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    c.materials = this.materials;
    c.matIndex = this.matIndex;
    c.curLayer = this.curLayer;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const s = y * this.w + x;
        const d = y * this.w + (this.w - 1 - x);
        c.mat[d] = this.mat[s];
        c.layer[d] = this.layer[s];
        c.nx[d] = -this.nx[s];
        c.ny[d] = this.ny[s];
        c.nz[d] = this.nz[s];
        c.bias[d] = this.bias[s];
        c.glow[d] = this.glow[s];
        for (let k = 0; k < 4; k++) c.light[d * 4 + k] = this.light[s * 4 + k];
      }
    }
    return c;
  }

  render(light: Vec3 = KEY_LIGHT): RenderedFrame {
    const { w, h } = this;
    const n = w * h;
    const diffuse = new Uint8ClampedArray(n * 4);
    const normal = new Uint8ClampedArray(n * 4);
    const emissive = new Uint8ClampedArray(n * 4);
    const L = norm(light.x, light.y, light.z);
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const o = i * 4;
        const mi = this.mat[i];
        if (mi >= 0) {
          const m = this.materials[mi];
          const nx = this.nx[i];
          const ny = this.ny[i];
          const nz = this.nz[i];
          const d = nx * L.x + ny * L.y + nz * L.z;
          // Map lighting to the ramp. Most of the surface lands on the middle
          // steps; only surfaces facing the key light reach the top step.
          const k = m.ramp.length;
          let t = (d + 0.25) / 1.45;
          t = Math.max(0, Math.min(0.999, t));
          let idx = Math.floor(t * k) + (m.bias ?? 0) + this.bias[i];
          if (m.shine && d > 0.9) idx += 1;

          if (!m.noAO) {
            const myLayer = this.layer[i];
            // Contact shadow: a part in front of us, toward the light.
            const up = at(x, y - 1);
            const left = at(x - 1, y);
            if ((up >= 0 && this.mat[up] >= 0 && this.layer[up] > myLayer) || (left >= 0 && this.mat[left] >= 0 && this.layer[left] > myLayer)) {
              idx -= 1;
            }
            // Separate overlapping parts made of the same material: darken our
            // own edge where we sit on top of it, away from the light.
            const right = at(x + 1, y);
            const down = at(x, y + 1);
            for (const j of [right, down]) {
              if (j >= 0 && this.mat[j] === mi && this.layer[j] < myLayer) {
                idx -= 1;
                break;
              }
            }
          }
          idx = Math.max(0, Math.min(k - 1, idx));
          const c = m.ramp[idx];
          diffuse[o] = c[0];
          diffuse[o + 1] = c[1];
          diffuse[o + 2] = c[2];
          diffuse[o + 3] = 255;
          normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
          normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          normal[o + 3] = 255;
          const g = this.glow[i];
          if (g > 0) {
            emissive[o] = c[0] * g;
            emissive[o + 1] = c[1] * g;
            emissive[o + 2] = c[2] * g;
            emissive[o + 3] = 255;
          }
        } else {
          // Outline: empty pixel touching a filled one (4-neighbourhood).
          let best = -1;
          let ox = 0;
          let oy = 0;
          let litSide = false;
          const nbrs: [number, number][] = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          for (const [ddx, ddy] of nbrs) {
            const j = at(x + ddx, y + ddy);
            if (j < 0) continue;
            const mj = this.mat[j];
            if (mj < 0 || this.materials[mj].noOutline) continue;
            ox -= ddx;
            oy -= ddy;
            // Outline pixel sits above or left of the shape: lit side.
            if (ddx === 1 || ddy === 1) litSide = true;
            if (best < 0 || this.layer[j] > this.layer[best]) best = j;
          }
          if (best >= 0) {
            const m = this.materials[this.mat[best]];
            const shadowSide = ox > 0 || oy > 0; // outline is right/below
            const c = litSide && !shadowSide && m.outlineLit ? m.outlineLit : m.outline;
            diffuse[o] = c[0];
            diffuse[o + 1] = c[1];
            diffuse[o + 2] = c[2];
            diffuse[o + 3] = 255;
            const on = norm(ox * 0.7, -oy * 0.7, 0.7);
            normal[o] = Math.round((on.x * 0.5 + 0.5) * 255);
            normal[o + 1] = Math.round((on.y * 0.5 + 0.5) * 255);
            normal[o + 2] = Math.round((on.z * 0.5 + 0.5) * 255);
            normal[o + 3] = 255;
          } else {
            normal[o] = 128;
            normal[o + 1] = 128;
            normal[o + 2] = 255;
            normal[o + 3] = 0;
          }
        }
        // Light-only pixels (sparks) go on top in the emissive layer.
        if (this.light[o + 3] > 0) {
          emissive[o] = Math.min(255, emissive[o] + this.light[o]);
          emissive[o + 1] = Math.min(255, emissive[o + 1] + this.light[o + 1]);
          emissive[o + 2] = Math.min(255, emissive[o + 2] + this.light[o + 2]);
          emissive[o + 3] = 255;
        }
      }
    }
    return { w, h, diffuse, normal, emissive };
  }
}

/** Key light baked into the diffuse ramps: from the top-left, toward camera. */
export const KEY_LIGHT: Vec3 = { x: -0.5, y: 0.55, z: 0.68 };

export interface RenderedFrame {
  w: number;
  h: number;
  diffuse: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}
