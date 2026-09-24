import Phaser from 'phaser';

// Renders a camera at art resolution (one texel per art pixel) and then
// scales it up to the screen with nearest filtering. Phones would otherwise
// run the lighting shader, the ground layers and every glow for each of the
// millions of device pixels, zoom² times per art pixel, which is what held the
// frame rate at 30-40. The camera still draws in device-pixel coordinates;
// only the GL viewport shrinks, so nothing else needs to know.
//
// The camera's vignette is applied in the same full-screen pass.

const FRAG = `
#define SHADER_NAME PIXEL_UPSCALE_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uRadius;
uniform float uStrength;

varying vec2 outTexCoord;

void main ()
{
    vec4 texture = texture2D(uMainSampler, outTexCoord);
    float d = length(outTexCoord - vec2(0.5));
    float v = 0.0;
    if (d <= uRadius)
    {
        float g = sin(d / uRadius * 3.14 * uStrength);
        v = 1.0 - g * g * g;
    }
    gl_FragColor = texture * v;
}
`;

export class PixelPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** Device pixels per art pixel. The canvas size must be a multiple of it (see display.ts). */
  zoom = 1;
  vignetteRadius = 0.92;
  vignetteStrength = 0.32;
  private target: Phaser.Renderer.WebGL.RenderTarget | null = null;

  constructor(game: Phaser.Game) {
    super({ game, name: 'Pixel', fragShader: FRAG, renderTarget: 0 } as unknown as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  /** The zoom a camera renders at: its pixel pipeline's, or 1 without one. */
  static zoomOf(camera: Phaser.Cameras.Scene2D.Camera): number {
    for (const p of camera.postPipelines) if (p instanceof PixelPipeline && p.active) return p.zoom;
    return 1;
  }

  preBatch(): this {
    if (!this.hasBooted) this.bootFX();
    const renderer = this.renderer;
    const w = Math.max(1, Math.ceil(renderer.width / this.zoom));
    const h = Math.max(1, Math.ceil(renderer.height / this.zoom));
    if (!this.target || this.target.width !== w || this.target.height !== h) {
      this.target?.destroy();
      // Nearest filtering, cleared on bind, sized by hand.
      this.target = new Phaser.Renderer.WebGL.RenderTarget(renderer, w, h, 1, 1, true, false);
    }
    this.currentRenderTarget = this.target;
    this.target.bind();
    // The projection still spans the full canvas; a smaller viewport maps it onto the target.
    this.gl.viewport(0, 0, w, h);
    return this;
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    this.set1f('uRadius', this.vignetteRadius);
    this.set1f('uStrength', this.vignetteStrength);
    this.bindAndDraw(target);
  }

  destroy(): this {
    this.target?.destroy();
    this.target = null;
    return super.destroy();
  }
}
