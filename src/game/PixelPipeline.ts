import Phaser from 'phaser';

// Renders a camera at art resolution (one texel per art pixel) and scales it
// up to the screen with nearest filtering. Phones would otherwise run the
// lighting shader on the full-screen ground layers for each of the millions
// of device pixels, zoom² times per art pixel.
//
// The camera scrolls in whole art pixels, so its render stays exactly on the
// texel grid; `offset` then shifts the upscaled image by the remaining device
// pixels, so the result scrolls as smoothly as the full-resolution sprites
// drawn over it. The target keeps a one-texel margin on the right and bottom
// for that shift to reveal.

const FRAG = `
#define SHADER_NAME PIXEL_UPSCALE_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2 uOffset;
uniform vec2 uTexSize;
uniform float uZoom;
uniform float uScreenH;

varying vec2 outTexCoord;

void main ()
{
    // Top-left origin, in device pixels of the camera's (larger) frame.
    vec2 p = vec2(gl_FragCoord.x, uScreenH - gl_FragCoord.y) + uOffset;
    vec2 t = floor(p / uZoom);
    gl_FragColor = texture2D(uMainSampler, vec2((t.x + 0.5) / uTexSize.x, 1.0 - (t.y + 0.5) / uTexSize.y));
}
`;

export class PixelPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** Device pixels per art pixel. */
  zoom = 1;
  /** Whole device pixels the upscaled image is shifted left and up, 0 to zoom - 1. */
  offsetX = 0;
  offsetY = 0;
  private target: Phaser.Renderer.WebGL.RenderTarget | null = null;

  constructor(game: Phaser.Game) {
    super({ game, name: 'Pixel', fragShader: FRAG, renderTarget: 0 } as unknown as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  /**
   * How a camera's fragments map to its light coordinates: device pixels per
   * fragment, and how far its frame's bottom edge sits below the canvas's.
   */
  static frameOf(camera: Phaser.Cameras.Scene2D.Camera): { scale: number; shiftY: number } {
    for (const p of camera.postPipelines) {
      if (p instanceof PixelPipeline && p.active) {
        const h = p.renderer.height;
        return { scale: p.zoom, shiftY: p.frameH(h) - h };
      }
    }
    return { scale: 1, shiftY: 0 };
  }

  /** Height of the rendered frame in device pixels: whole art pixels plus the margin. */
  private frameH(height: number): number {
    return (Math.ceil(height / this.zoom) + 1) * this.zoom;
  }

  preBatch(): this {
    if (!this.hasBooted) this.bootFX();
    const renderer = this.renderer;
    const z = this.zoom;
    const w = Math.ceil(renderer.width / z) + 1;
    const h = Math.ceil(renderer.height / z) + 1;
    if (!this.target || this.target.width !== w || this.target.height !== h) {
      this.target?.destroy();
      // Nearest filtering, cleared on bind, sized by hand.
      this.target = new Phaser.Renderer.WebGL.RenderTarget(renderer, w, h, 1, 1, true, false);
    }
    this.currentRenderTarget = this.target;
    // Project a frame of exactly w x h art pixels (a little larger than the
    // canvas) onto the target, one texel per art pixel.
    renderer.setProjectionMatrix(w * z, h * z);
    this.target.bind();
    this.gl.viewport(0, 0, w, h);
    return this;
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    const renderer = this.renderer;
    renderer.resetProjectionMatrix();
    this.set2f('uOffset', this.offsetX, this.offsetY);
    this.set2f('uTexSize', target.width, target.height);
    this.set1f('uZoom', this.zoom);
    this.set1f('uScreenH', renderer.height);
    this.bindAndDraw(target);
  }

  destroy(): this {
    this.target?.destroy();
    this.target = null;
    return super.destroy();
  }
}
