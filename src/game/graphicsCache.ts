import Phaser from 'phaser';

/**
 * The HUD (joystick, ability buttons, hotbar) cost a large share of every
 * frame's drawing, on a phone several milliseconds.
 *
 * Phaser rebuilds a Graphics object's shapes from its commands every frame,
 * even when nothing changed: each arc becomes a hundred points, a fill is cut
 * into triangles (earcut) and an outline into a quad per segment. Two fixes,
 * both leaving the pixels as they were:
 *   - arcs get only as many points as their size needs (`lighterArcs`);
 *   - the triangles and quads a Graphics produced are kept and handed to the
 *     pipeline again while its commands, its place on screen and its alpha
 *     stay the same. A Graphics whose drawing changes every frame (a camera
 *     that scrolls it, say) is drawn as before and never recorded.
 */

type Tracked = Phaser.GameObjects.Graphics & {
  /** Bumped by `clear`, so a redraw with as many commands still counts as new. */
  drawVersion?: number;
  /** What the last frame drew: version, commands, alpha and the six numbers of the transform. */
  lastKey?: number[];
  /** Triangles and quads recorded for `lastKey`, or null while it is still settling. */
  recorded?: number[] | null;
};

type Pipeline = Phaser.Renderer.WebGL.Pipelines.MultiPipeline;
type Render = (renderer: Phaser.Renderer.WebGL.WebGLRenderer, src: Tracked, camera: Phaser.Cameras.Scene2D.Camera, parentMatrix?: Phaser.GameObjects.Components.TransformMatrix) => void;
type Batch = (...args: unknown[]) => boolean;

/** Arguments a triangle and a quad take after the game object: coordinates, uvs, tints and the tint effect. */
const TRI_ARGS = 14;
const QUAD_ARGS = 17;
const TRI = 0;
const QUAD = 1;

const key: number[] = [];

/**
 * How far a curve's segments may stray from the true circle, in pixels of
 * the Graphics: a fifth of a device pixel on the HUD, too little to change
 * which pixels a ring covers.
 */
const ARC_TOLERANCE = 0.2;
/** Phaser's own count, which stays the most any arc gets. */
const MAX_ARC_POINTS = 100;

/**
 * Phaser draws every arc with a hundred points, whatever its size, so each
 * hotbar slot's rounded corners (four arcs a few pixels across) came to four
 * hundred points and some seven thousand quads a frame for the bar. An arc is
 * the same list of points either way, so it is written out here as line
 * segments, only as many as its size needs: a big ring keeps close to a
 * hundred, a small corner gets a handful. The path they make is the one
 * Phaser's renderer would build from the arc (see its ARC case).
 */
function lighterArcs(proto: Phaser.GameObjects.Graphics): void {
  const PI2 = Math.PI * 2;
  proto.arc = function (this: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false, overshoot = 0) {
    let sweep = endAngle - startAngle;
    if (anticlockwise) {
      if (sweep < -PI2) sweep = -PI2;
      else if (sweep > 0) sweep = -PI2 + (sweep % PI2);
    } else if (sweep > PI2) sweep = PI2;
    else if (sweep < 0) sweep = PI2 + (sweep % PI2);
    const r = Math.abs(radius);
    // The widest angle one segment may cover and stay within the tolerance.
    const step = r > ARC_TOLERANCE / 2 ? 2 * Math.acos(1 - ARC_TOLERANCE / r) : Math.PI;
    const n = Math.max(1, Math.min(MAX_ARC_POINTS, Math.ceil(Math.abs(sweep) / step)));
    for (let k = 0; k / n < 1 + overshoot; k++) {
      const a = sweep * (k / n) + startAngle;
      this.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    const a = sweep + startAngle;
    return this.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
  };
}

function sameKey(a: number[] | undefined, b: number[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function cacheGraphics(): void {
  const proto = Phaser.GameObjects.Graphics.prototype as Tracked & { renderWebGL: Render };
  const render = proto.renderWebGL;
  lighterArcs(proto);
  const clear = proto.clear;
  proto.clear = function (this: Tracked) {
    this.drawVersion = (this.drawVersion ?? 0) + 1;
    return clear.call(this);
  };

  proto.renderWebGL = function (renderer, src, camera, parentMatrix) {
    if (src.commandBuffer.length === 0) return;
    const m = Phaser.GameObjects.GetCalcMatrix(src, camera, parentMatrix).calc;
    key.length = 0;
    key.push(src.drawVersion ?? 0, src.commandBuffer.length, camera.alpha * src.alpha, m.a, m.b, m.c, m.d, m.e, m.f);

    if (sameKey(src.lastKey, key) && src.recorded) {
      replay(renderer, src, camera, src.recorded);
      return;
    }
    // Record only once a drawing has held for a frame: one that changes
    // every frame would pay for recording and never use it.
    const settled = sameKey(src.lastKey, key);
    src.lastKey = key.slice();
    src.recorded = null;
    if (!settled) {
      render(renderer, src, camera, parentMatrix);
      return;
    }
    const out: number[] = [];
    let ok = true;
    const pipe = src.pipeline as Pipeline & { batchTri: Batch; batchQuad: Batch };
    const tri = pipe.batchTri;
    const quad = pipe.batchQuad;
    pipe.batchTri = function (this: Pipeline, ...args: unknown[]) {
      // Shapes are flat colour, no texture; anything else isn't kept.
      if (args[0] !== null || args.length !== TRI_ARGS + 1) ok = false;
      else out.push(TRI, ...(args.slice(1) as number[]));
      return tri.apply(this, args);
    };
    pipe.batchQuad = function (this: Pipeline, ...args: unknown[]) {
      if (args[0] !== null || args.length !== QUAD_ARGS + 1) ok = false;
      else out.push(QUAD, ...(args.slice(1) as number[]));
      return quad.apply(this, args);
    };
    try {
      render(renderer, src, camera, parentMatrix);
    } finally {
      delete (pipe as Partial<typeof pipe>).batchTri;
      delete (pipe as Partial<typeof pipe>).batchQuad;
    }
    if (ok) src.recorded = out;
  };
}

/** What GraphicsWebGLRenderer does around its shapes, with the recorded shapes in between. */
function replay(renderer: Phaser.Renderer.WebGL.WebGLRenderer, src: Tracked, camera: Phaser.Cameras.Scene2D.Camera, calls: number[]): void {
  camera.addToRenderList(src);
  const pipe = renderer.pipelines.set(src.pipeline, src) as Pipeline;
  renderer.pipelines.preBatch(src);
  const a = calls;
  for (let i = 0; i < a.length; ) {
    if (a[i] === TRI) {
      pipe.batchTri(null as unknown as Phaser.GameObjects.GameObject, a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6], a[i + 7], a[i + 8], a[i + 9], a[i + 10], a[i + 11], a[i + 12], a[i + 13], a[i + 14]);
      i += TRI_ARGS + 1;
    } else {
      pipe.batchQuad(null as unknown as Phaser.GameObjects.GameObject, a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6], a[i + 7], a[i + 8], a[i + 9], a[i + 10], a[i + 11], a[i + 12], a[i + 13], a[i + 14], a[i + 15], a[i + 16], a[i + 17]);
      i += QUAD_ARGS + 1;
    }
  }
  renderer.pipelines.postBatch(src);
}
