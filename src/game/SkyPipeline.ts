import Phaser from 'phaser';

// Drifting cloud shadows and the vignette, in one full-screen pass. They
// used to be two blended full-screen layers, and filling the screen is what
// phones struggle with most. The result is the same as drawing the clouds
// and then the black vignette over them.
//
// Drawn by one screen-fixed image covering the canvas; the image's texture
// is the cloud tile, sampled in world space from the fragment's position.

const FRAG = `
#define SHADER_NAME SKY_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform vec2 uWorldOrigin;
uniform float uZoom;
uniform vec2 uTile;
uniform vec2 uTileSize;
uniform float uCloudAlpha;
uniform float uVignette;

varying vec2 outTexCoord;

void main ()
{
    vec2 screen = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    vec2 world = uWorldOrigin + screen / uZoom;
    // Premultiplied, like every Phaser texture.
    vec4 cloud = texture2D(uMainSampler, fract((world + uTile) / uTileSize)) * uCloudAlpha;

    // Same falloff the vignette texture used to have.
    float d = length(screen / uResolution - 0.5) / 0.92;
    float g = sin(min(d, 1.0) * 3.14 * uVignette);
    float v = d > 1.0 ? 1.0 : g * g * g;

    gl_FragColor = vec4(cloud.rgb * (1.0 - v), 1.0 - (1.0 - cloud.a) * (1.0 - v));
}
`;

/** What the world scene sets each frame. */
export const skyState = {
  /** Cloud shadow strength, 0 to 1. */
  clouds: 0,
  tileX: 0,
  tileY: 0,
  /** Vignette strength, as Phaser's vignette effect. */
  vignette: 0.3,
};

export class SkyPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) {
    super({ game, fragShader: FRAG } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  onRender(_scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
    const z = camera.zoom;
    // Screen x = (worldX - scrollX) * z + width / 2 * (1 - z).
    this.set2f('uWorldOrigin', camera.scrollX - (camera.width / 2) * (1 - z) / z, camera.scrollY - (camera.height / 2) * (1 - z) / z);
    this.set1f('uZoom', z);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set2f('uTile', skyState.tileX, skyState.tileY);
    this.set1f('uCloudAlpha', skyState.clouds);
    this.set1f('uVignette', skyState.vignette);
  }

  onBind(gameObject?: Phaser.GameObjects.GameObject): void {
    const frame = (gameObject as Phaser.GameObjects.Image | undefined)?.frame;
    if (frame) this.set2f('uTileSize', frame.width, frame.height);
  }
}
