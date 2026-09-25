import Phaser from 'phaser';
import { PixelPipeline } from './PixelPipeline';

// Phaser's Light2D only has point lights, all sitting just above the ground,
// so it can't make sunlight. This pipeline keeps those point lights and adds:
//   - a directional sun (or moon) with its own colour and elevation
//   - hemispheric ambient: surfaces facing up catch the sky colour, surfaces
//     facing down (toward the camera's bottom edge) catch bounce light
// Everything else (normal maps, batching) is inherited from LightPipeline.

const FRAG = `
#define SHADER_NAME LIT_FS
precision mediump float;

struct Light
{
    vec2 position;
    vec3 color;
    float intensity;
    float radius;
};

const int kMaxLights = %LIGHT_COUNT%;

uniform vec4 uCamera;
uniform vec2 uResolution;
uniform sampler2D uMainSampler;
uniform sampler2D uNormSampler;
uniform vec3 uAmbientLightColor;
uniform Light uLights[kMaxLights];
uniform mat3 uInverseRotationMatrix;
uniform int uLightCount;

uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uBounceColor;
// Maps a fragment to device pixels of the light coordinates: above 1 when the
// camera renders at art resolution (see PixelPipeline).
uniform float uFragScale;
uniform float uFragShiftY;

varying vec2 outTexCoord;
varying float outTexId;
varying float outTintEffect;
varying vec4 outTint;

void main ()
{
    vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
    vec4 texture = texture2D(uMainSampler, outTexCoord);
    vec4 color = texture * texel;

    if (outTintEffect == 1.0)
    {
        color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
    }
    else if (outTintEffect == 2.0)
    {
        color = texel;
    }

    // Empty texels (half of a tree's quad) add nothing: skip the lighting.
    if (color.a == 0.0)
    {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec3 normalMap = texture2D(uNormSampler, outTexCoord).rgb;
    vec3 normal = normalize(uInverseRotationMatrix * vec3(normalMap * 2.0 - 1.0));
    vec2 res = vec2(min(uResolution.x, uResolution.y)) * uCamera.w;

    // Hemispheric ambient.
    float up = normal.y * 0.5 + 0.5;
    vec3 finalColor = uAmbientLightColor + mix(uBounceColor, uSkyColor, up);

    // Sun: wrapped diffuse keeps the terminator soft, like pixel-art shading.
    float sun = dot(normal, uSunDir);
    finalColor += uSunColor * clamp(sun * 0.8 + 0.2, 0.0, 1.0);

    vec2 frag = (gl_FragCoord.xy * uFragScale - vec2(0.0, uFragShiftY)) / res;
    for (int index = 0; index < kMaxLights; ++index)
    {
        // Only the lights in use, and only those that reach this fragment.
        if (index >= uLightCount) break;
        Light light = uLights[index];
        vec3 lightDir = vec3(light.position.xy / res - frag, 0.1);
        float distToSurf = length(lightDir) * uCamera.w;
        float radius = (light.radius / res.x * uCamera.w) * uCamera.w;
        if (distToSurf >= radius) continue;
        vec3 lightNormal = lightDir / length(lightDir);
        float diffuseFactor = max(dot(normal, lightNormal), 0.0);
        float attenuation = 1.0 - distToSurf * distToSurf / (radius * radius);
        finalColor += (attenuation * light.color * diffuseFactor) * light.intensity;
    }

    gl_FragColor = color * vec4(finalColor, 1.0);
}
`;

export interface SkyState {
  sunDir: [number, number, number];
  sunColor: [number, number, number];
  sky: [number, number, number];
  bounce: [number, number, number];
}

/** Shared lighting state, written by the world scene each frame. */
export const sky: SkyState = {
  sunDir: [-0.45, 0.5, 0.74],
  sunColor: [0, 0, 0],
  sky: [0, 0, 0],
  bounce: [0, 0, 0],
};

export class LitPipeline extends Phaser.Renderer.WebGL.Pipelines.LightPipeline {
  constructor(game: Phaser.Game) {
    super({ game, fragShader: FRAG } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  onRender(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
    super.onRender(scene, camera);
    const [x, y, z] = sky.sunDir;
    const l = Math.hypot(x, y, z) || 1;
    this.set3f('uSunDir', x / l, y / l, z / l);
    this.set3f('uSunColor', ...sky.sunColor);
    this.set3f('uSkyColor', ...sky.sky);
    this.set3f('uBounceColor', ...sky.bounce);
    const frame = PixelPipeline.frameOf(camera);
    this.set1f('uFragScale', frame.scale);
    this.set1f('uFragShiftY', frame.shiftY);
  }
}
