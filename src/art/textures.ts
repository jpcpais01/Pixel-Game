// Turns the procedural art into Phaser textures. Each lit texture gets its
// normal map attached as a data source so Light2D can use it; emissive layers
// become separate textures with matching frame names, drawn additively.

import Phaser from 'phaser';
import type { PixelCanvas, RenderedFrame } from './pixel';
import { buildWizardFrames, FRAME_H, FRAME_W, ANIMS, DIRS, type FrameMeta } from './wizard';
import { ORB_FRAMES, ORB_SIZE, BURST_FRAMES, BURST_SIZE, orbFrame, burstFrame, glowCanvas, shadowCanvas, cloudShadowCanvas, sunShaftCanvas, skyIcon, beamIcon } from './effects';
import { buildGround, NIGHT_GROUND, DAY_GROUND, brazierFrame, crystalCluster, rock, dummyFrame } from './env';

function toCanvas(w: number, h: number, px: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0);
  return c;
}

interface Packed {
  diffuse: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  emissive: HTMLCanvasElement;
  /** Solid silhouette, used for sun shadows. */
  silhouette: HTMLCanvasElement;
  rects: { name: string; x: number; y: number }[];
}

/** Pack equally sized frames into one atlas per layer. */
function pack(frames: { name: string; r: RenderedFrame }[], fw: number, fh: number, cols = 16): Packed {
  const rows = Math.ceil(frames.length / cols);
  const W = Math.min(cols, frames.length) * fw;
  const H = rows * fh;
  const layers = { diffuse: new Uint8ClampedArray(W * H * 4), normal: new Uint8ClampedArray(W * H * 4), emissive: new Uint8ClampedArray(W * H * 4) };
  const rects: Packed['rects'] = [];
  frames.forEach((f, i) => {
    const ox = (i % cols) * fw;
    const oy = Math.floor(i / cols) * fh;
    rects.push({ name: f.name, x: ox, y: oy });
    for (const k of ['diffuse', 'normal', 'emissive'] as const) {
      const src = f.r[k];
      const dst = layers[k];
      for (let y = 0; y < fh; y++) {
        dst.set(src.subarray(y * fw * 4, (y + 1) * fw * 4), ((oy + y) * W + ox) * 4);
      }
    }
  });
  const sil = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    sil[i * 4] = 6;
    sil[i * 4 + 1] = 8;
    sil[i * 4 + 2] = 22;
    sil[i * 4 + 3] = layers.diffuse[i * 4 + 3];
  }
  return {
    silhouette: toCanvas(W, H, sil),
    diffuse: toCanvas(W, H, layers.diffuse),
    normal: toCanvas(W, H, layers.normal),
    emissive: toCanvas(W, H, layers.emissive),
    rects,
  };
}

function register(scene: Phaser.Scene, key: string, p: Packed, fw: number, fh: number, withEmissive = true): void {
  const tex = scene.textures.addCanvas(key, p.diffuse)!;
  tex.setDataSource(p.normal);
  const etex = withEmissive ? scene.textures.addCanvas(`${key}_e`, p.emissive)! : null;
  const stex = scene.textures.addCanvas(`${key}_s`, p.silhouette)!;
  for (const r of p.rects) {
    tex.add(r.name, 0, r.x, r.y, fw, fh);
    etex?.add(r.name, 0, r.x, r.y, fw, fh);
    stex.add(r.name, 0, r.x, r.y, fw, fh);
  }
}

const frameList = (canvases: PixelCanvas[], prefix: string) => canvases.map((c, i) => ({ name: `${prefix}${i}`, r: c.render() }));

export const wizardMeta = new Map<string, FrameMeta>();

export function buildAllTextures(scene: Phaser.Scene, worldW: number, worldH: number): void {
  // Wizard.
  const wf = buildWizardFrames();
  wf.forEach((f) => wizardMeta.set(f.key, f.meta));
  register(scene, 'wizard', pack(wf.map((f) => ({ name: f.key, r: f.canvas.render() })), FRAME_W, FRAME_H), FRAME_W, FRAME_H);
  for (const a of ANIMS) {
    for (const d of DIRS) {
      const frames = wf.filter((f) => f.anim === a.name && f.dir === d);
      scene.anims.create({
        key: `wizard_${a.name}_${d}`,
        frames: frames.map((f) => ({ key: 'wizard', frame: f.key })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }

  // Effects (pure light).
  register(scene, 'orb', pack(frameList(Array.from({ length: ORB_FRAMES }, (_, i) => orbFrame(i)), 'o'), ORB_SIZE, ORB_SIZE), ORB_SIZE, ORB_SIZE);
  register(scene, 'burst', pack(frameList(Array.from({ length: BURST_FRAMES }, (_, i) => burstFrame(i)), 'b'), BURST_SIZE, BURST_SIZE), BURST_SIZE, BURST_SIZE);
  scene.anims.create({ key: 'orb_spin', frames: scene.anims.generateFrameNames('orb_e', { prefix: 'o', start: 0, end: ORB_FRAMES - 1 }), frameRate: 14, repeat: -1 });
  scene.anims.create({ key: 'burst_pop', frames: scene.anims.generateFrameNames('burst_e', { prefix: 'b', start: 0, end: BURST_FRAMES - 1 }), frameRate: 22, repeat: 0 });
  scene.textures.addCanvas('glow', toCanvas(32, 32, glowCanvas(32)));
  scene.textures.addCanvas('shadow', toCanvas(16, 6, shadowCanvas(16, 6)));
  scene.textures.addCanvas('shadow_big', toCanvas(24, 8, shadowCanvas(24, 8)));
  const spark = new Uint8ClampedArray(4 * 4).fill(255);
  scene.textures.addCanvas('spark', toCanvas(2, 2, spark));

  // Environment.
  const g = buildGround(worldW, worldH, NIGHT_GROUND);
  const gt = scene.textures.addCanvas('ground', toCanvas(g.w, g.h, g.diffuse))!;
  gt.setDataSource(toCanvas(g.w, g.h, g.normal));
  scene.textures.addCanvas('ground_e', toCanvas(g.w, g.h, g.emissive));
  const gd = buildGround(worldW, worldH, DAY_GROUND);
  const gdt = scene.textures.addCanvas('ground_day', toCanvas(gd.w, gd.h, gd.diffuse))!;
  gdt.setDataSource(toCanvas(gd.w, gd.h, gd.normal));

  // Sky.
  scene.textures.addCanvas('clouds', toCanvas(256, 256, cloudShadowCanvas(256)));
  scene.textures.addCanvas('shafts', toCanvas(256, 256, sunShaftCanvas(256, 256)));
  scene.textures.addCanvas('icon_sun', toCanvas(12, 12, skyIcon('sun')));
  scene.textures.addCanvas('icon_moon', toCanvas(12, 12, skyIcon('moon')));
  scene.textures.addCanvas('icon_beam', toCanvas(16, 16, beamIcon()));

  register(scene, 'brazier', pack(frameList([0, 1, 2, 3].map(brazierFrame), 'f'), 16, 26), 16, 26);
  scene.anims.create({ key: 'brazier_burn', frames: scene.anims.generateFrameNames('brazier_e', { prefix: 'f', start: 0, end: 3 }), frameRate: 9, repeat: -1 });
  register(scene, 'crystals', pack(frameList([crystalCluster(3), crystalCluster(8)], 'c'), 20, 22), 20, 22);
  register(scene, 'rock', pack(frameList([rock(1), rock(2), rock(5)], 'r'), 18, 14), 18, 14, false);
  register(scene, 'dummy', pack(frameList([dummyFrame(false), dummyFrame(true)], 'd'), 18, 28), 18, 28, false);
}
