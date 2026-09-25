// Turns the procedural art into Phaser textures. Each lit texture gets its
// normal map attached as a data source so Light2D can use it; emissive layers
// become separate textures with matching frame names, drawn additively.

import Phaser from 'phaser';
import type { PixelCanvas, RenderedFrame } from './pixel';
import { buildWizardFrames, FRAME_H, FRAME_W, ANIMS, DIRS, WIZARD_LOOKS, type FrameMeta } from './wizard';
import { ORB_FRAMES, ORB_SIZE, BURST_FRAMES, BURST_SIZE, orbFrame, burstFrame, ARCANE_SPELL, VOID_SPELL, glowCanvas, shadowCanvas, cloudShadowCanvas, sunShaftCanvas, skyIcon, beamIcon, swordIcon, whirlIcon, JADE_SWORD_ICON, maceIcon, sanctuaryIcon, saberIcon, forceIcon, fistIcon, barrageIcon, flaskIcon, bogIcon, fumeCanvas, type IconColors } from './effects';
import { buildJediFrames, JEDI_ANIMS, JEDI_H, JEDI_LOOKS, JEDI_W, TWIRL_FRAMES, twirlStart, TWIRL_FPS, type JediMeta } from './jedi';
import { ALCHEMIST_ANIMS, ALCH_H, ALCH_W, BIG_FLASK_SIZE, FLASK_FRAMES, FLASK_SIZE, buildAlchemistFrames, flaskFrame } from './alchemist';
import { buildFighterFrames, FIGHTER_ANIMS, FIGHTER_H, FIGHTER_W } from './fighter';
import { hex } from './pixel';
import { DROP_H, DROP_W, ITEM_ICON_SIZE, potionDrop, potionIcon } from './items';
import { buildPaladinFrames, PALADIN_ANIMS, PALADIN_H, PALADIN_W, type PaladinMeta } from './paladin';
import { buildWarriorFrames, JADE_LOOK, WARRIOR_ANIMS, WARRIOR_H, WARRIOR_LOOKS, WARRIOR_W, type WarriorMeta } from './warrior';
import { WIND_DEEP } from './palette';
import { buildBarklingSheet, buildBeetleSheet, buildFrogSheet, buildGlowmothSheet, buildPuffcapSheet, ringCanvas, thornFrame, THORN_H, THORN_W, venomGlob, type MonsterSheet } from './monsters';
import { brazierFrame, crystalCluster, rock, dummyFrame } from './env';
import { BOUGH_H, BOUGH_W, PROP_FRAMES, PROP_H, PROP_W, RAY_H, RAY_W, TREE_FRAMES, TREE_H, TREE_W, bough, leafBit, rayCanvas } from './trees';

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
  /** White silhouette, flashed over a sprite when it is struck. */
  white: () => HTMLCanvasElement;
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
  const white = () => {
    const px = new Uint8ClampedArray(W * H * 4).fill(255);
    for (let i = 0; i < W * H; i++) px[i * 4 + 3] = layers.diffuse[i * 4 + 3];
    return toCanvas(W, H, px);
  };
  return {
    white,
    silhouette: toCanvas(W, H, sil),
    diffuse: toCanvas(W, H, layers.diffuse),
    normal: toCanvas(W, H, layers.normal),
    emissive: toCanvas(W, H, layers.emissive),
    rects,
  };
}

function register(scene: Phaser.Scene, key: string, p: Packed, fw: number, fh: number, withEmissive = true, withFlash = false): void {
  const tex = scene.textures.addCanvas(key, p.diffuse)!;
  tex.setDataSource(p.normal);
  const etex = withEmissive ? scene.textures.addCanvas(`${key}_e`, p.emissive)! : null;
  const stex = scene.textures.addCanvas(`${key}_s`, p.silhouette)!;
  const wtex = withFlash ? scene.textures.addCanvas(`${key}_w`, p.white())! : null;
  for (const r of p.rects) {
    tex.add(r.name, 0, r.x, r.y, fw, fh);
    etex?.add(r.name, 0, r.x, r.y, fw, fh);
    stex.add(r.name, 0, r.x, r.y, fw, fh);
    wtex?.add(r.name, 0, r.x, r.y, fw, fh);
  }
}

/**
 * A monster's frames as `<key>` (lit), `<key>_e` (glow), `<key>_s` (sun
 * shadow) and `<key>_w` (hit flash), with animations `<key>_<anim>_<r|l>`.
 */
function registerMonster(scene: Phaser.Scene, key: string, sh: MonsterSheet): void {
  register(scene, key, pack(sh.frames.map((f) => ({ name: f.name, r: f.canvas.render() })), sh.w, sh.h), sh.w, sh.h, true, true);
  for (const a of sh.anims) {
    for (const side of ['r', 'l']) {
      scene.anims.create({
        key: `${key}_${a.name}_${side}`,
        frames: a.frames.map((f) => ({ key, frame: `${f}_${side}` })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}

/** Lay equally sized RGBA images out in a row. */
function sideBySide(w: number, h: number, images: Uint8ClampedArray[]): Uint8ClampedArray {
  const W = w * images.length;
  const out = new Uint8ClampedArray(W * h * 4);
  images.forEach((px, k) => {
    for (let y = 0; y < h; y++) out.set(px.subarray(y * w * 4, (y + 1) * w * 4), (y * W + k * w) * 4);
  });
  return out;
}

const frameList = (canvases: PixelCanvas[], prefix: string) => canvases.map((c, i) => ({ name: `${prefix}${i}`, r: c.render() }));

export const wizardMeta = new Map<string, FrameMeta>();
export const warriorMeta = new Map<string, WarriorMeta>();
export const paladinMeta = new Map<string, PaladinMeta>();
export const jediMeta = new Map<string, JediMeta>();

export function buildAllTextures(scene: Phaser.Scene): void {
  // Wizard, once per look. Every look shares the rig, so the crystal meta is the same for all.
  for (const look of WIZARD_LOOKS) {
    const wf = buildWizardFrames(look);
    if (!wizardMeta.size) wf.forEach((f) => wizardMeta.set(f.key, f.meta));
    register(scene, look.key, pack(wf.map((f) => ({ name: f.key, r: f.canvas.render() })), FRAME_W, FRAME_H), FRAME_W, FRAME_H);
    for (const a of ANIMS) {
      for (const d of DIRS) {
        const frames = wf.filter((f) => f.anim === a.name && f.dir === d);
        scene.anims.create({
          key: `${look.key}_${a.name}_${d}`,
          frames: frames.map((f) => ({ key: look.key, frame: f.key })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
  }

  // Warrior, once per look. Spin frames have no animation: the whirlwind picks them by angle.
  for (const look of WARRIOR_LOOKS) {
    const hf = buildWarriorFrames(look);
    if (!warriorMeta.size) hf.forEach((f) => warriorMeta.set(f.key, f.meta));
    register(scene, look.key, pack(hf.map((f) => ({ name: f.key, r: f.canvas.render() })), WARRIOR_W, WARRIOR_H), WARRIOR_W, WARRIOR_H);
    for (const a of WARRIOR_ANIMS) {
      for (const d of DIRS) {
        scene.anims.create({
          key: `${look.key}_${a.name}_${d}`,
          frames: hf.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: look.key, frame: f.key })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
  }

  // Effects (pure light).
  // Paladin.
  const pf = buildPaladinFrames();
  pf.forEach((f) => paladinMeta.set(f.key, f.meta));
  register(scene, 'paladin', pack(pf.map((f) => ({ name: f.key, r: f.canvas.render() })), PALADIN_W, PALADIN_H), PALADIN_W, PALADIN_H);
  for (const a of PALADIN_ANIMS) {
    for (const d of DIRS) {
      scene.anims.create({
        key: `paladin_${a.name}_${d}`,
        frames: pf.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: 'paladin', frame: f.key })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }

  // Jedi, once per look; the looks share the rig, so the blade meta is the same for all.
  // The twirl plays a whole turn starting from whichever way he faces.
  for (const look of JEDI_LOOKS) {
    const jf = buildJediFrames(look);
    if (!jediMeta.size) jf.forEach((f) => jediMeta.set(f.key, f.meta));
    register(scene, look.key, pack(jf.map((f) => ({ name: f.key, r: f.canvas.render() })), JEDI_W, JEDI_H), JEDI_W, JEDI_H);
    for (const d of DIRS) {
      for (const a of JEDI_ANIMS) {
        scene.anims.create({
          key: `${look.key}_${a.name}_${d}`,
          frames: jf.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: look.key, frame: f.key })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
      const k0 = twirlStart(d);
      scene.anims.create({
        key: `${look.key}_twirl_${d}`,
        frames: Array.from({ length: TWIRL_FRAMES + 1 }, (_, i) => ({ key: look.key, frame: `twirl_${(k0 + i) % TWIRL_FRAMES}` })),
        frameRate: TWIRL_FPS,
        repeat: 0,
      });
    }
  }

  // Fighter.
  const ff = buildFighterFrames();
  register(scene, 'fighter', pack(ff.map((f) => ({ name: f.key, r: f.canvas.render() })), FIGHTER_W, FIGHTER_H), FIGHTER_W, FIGHTER_H);
  for (const a of FIGHTER_ANIMS) {
    for (const d of DIRS) {
      scene.anims.create({
        key: `fighter_${a.name}_${d}`,
        frames: ff.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: 'fighter', frame: f.key })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }

  // Alchemist, and the flasks he throws (tumbling frames r0..r7), plus the fumes of his bog.
  const af = buildAlchemistFrames();
  register(scene, 'alchemist', pack(af.map((f) => ({ name: f.key, r: f.canvas.render() })), ALCH_W, ALCH_H), ALCH_W, ALCH_H);
  for (const a of ALCHEMIST_ANIMS) {
    for (const d of DIRS) {
      scene.anims.create({
        key: `alchemist_${a.name}_${d}`,
        frames: af.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: 'alchemist', frame: f.key })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
  for (const [key, big, size] of [['flask', false, FLASK_SIZE], ['flask_big', true, BIG_FLASK_SIZE]] as const) {
    register(scene, key, pack(frameList(Array.from({ length: FLASK_FRAMES }, (_, i) => flaskFrame(i, big)), 'r'), size, size), size, size);
  }
  const fumes = scene.textures.addCanvas('fume', toCanvas(18 * 3, 18, sideBySide(18, 18, [0, 1, 2].map((v) => fumeCanvas(18, v)))))!;
  [0, 1, 2].forEach((v) => fumes.add(`f${v}`, 0, v * 18, 0, 18, 18));

  // Energy ball and impact per spell look: 'orb'/'burst' (arcane) and 'orb_void'/'burst_void'.
  for (const [suffix, k] of [['', ARCANE_SPELL], ['_void', VOID_SPELL]] as const) {
    register(scene, `orb${suffix}`, pack(frameList(Array.from({ length: ORB_FRAMES }, (_, i) => orbFrame(i, k)), 'o'), ORB_SIZE, ORB_SIZE), ORB_SIZE, ORB_SIZE);
    register(scene, `burst${suffix}`, pack(frameList(Array.from({ length: BURST_FRAMES }, (_, i) => burstFrame(i, k)), 'b'), BURST_SIZE, BURST_SIZE), BURST_SIZE, BURST_SIZE);
    scene.anims.create({ key: `orb${suffix}_spin`, frames: scene.anims.generateFrameNames(`orb${suffix}_e`, { prefix: 'o', start: 0, end: ORB_FRAMES - 1 }), frameRate: 14, repeat: -1 });
    scene.anims.create({ key: `burst${suffix}_pop`, frames: scene.anims.generateFrameNames(`burst${suffix}_e`, { prefix: 'b', start: 0, end: BURST_FRAMES - 1 }), frameRate: 22, repeat: 0 });
  }
  scene.textures.addCanvas('glow', toCanvas(32, 32, glowCanvas(32)));
  scene.textures.addCanvas('shadow', toCanvas(16, 6, shadowCanvas(16, 6)));
  scene.textures.addCanvas('shadow_big', toCanvas(24, 8, shadowCanvas(24, 8)));
  const spark = new Uint8ClampedArray(4 * 4).fill(255);
  scene.textures.addCanvas('spark', toCanvas(2, 2, spark));

  // Environment. The ground itself streams in as the heroes walk (see world/GroundStreamer.ts).
  register(scene, 'tree', pack(TREE_FRAMES.map((f) => ({ name: f.name, r: f.draw().render() })), TREE_W, TREE_H, 9), TREE_W, TREE_H, false);
  register(scene, 'flora', pack(PROP_FRAMES.map((f) => ({ name: f.name, r: f.draw().render() })), PROP_W, PROP_H, 10), PROP_W, PROP_H);
  const rays = scene.textures.addCanvas('ray', toCanvas(RAY_W * 2, RAY_H, sideBySide(RAY_W, RAY_H, [rayCanvas(11), rayCanvas(29)])))!;
  rays.add('ray0', 0, 0, 0, RAY_W, RAY_H);
  rays.add('ray1', 0, RAY_W, 0, RAY_W, RAY_H);
  const boughs = [0, 1, 2].map((v) => bough(v).render().diffuse);
  const bt = scene.textures.addCanvas('bough', toCanvas(BOUGH_W * 3, BOUGH_H, sideBySide(BOUGH_W, BOUGH_H, boughs)))!;
  boughs.forEach((_, v) => bt.add(`b${v}`, 0, v * BOUGH_W, 0, BOUGH_W, BOUGH_H));
  scene.textures.addCanvas('leafbit', toCanvas(3, 2, leafBit()));

  // Sky.
  scene.textures.addCanvas('clouds', toCanvas(256, 256, cloudShadowCanvas(256)));
  scene.textures.addCanvas('shafts', toCanvas(256, 256, sunShaftCanvas(256, 256)));
  scene.textures.addCanvas('icon_sun', toCanvas(12, 12, skyIcon('sun')));
  scene.textures.addCanvas('icon_moon', toCanvas(12, 12, skyIcon('moon')));
  scene.textures.addCanvas('icon_beam', toCanvas(16, 16, beamIcon()));
  scene.textures.addCanvas('icon_beam_void', toCanvas(16, 16, beamIcon(VOID_SPELL)));
  scene.textures.addCanvas('icon_sword', toCanvas(16, 16, swordIcon()));
  scene.textures.addCanvas('icon_whirl', toCanvas(16, 16, whirlIcon()));
  scene.textures.addCanvas('icon_sword_jade', toCanvas(16, 16, swordIcon(JADE_SWORD_ICON)));
  scene.textures.addCanvas('icon_whirl_jade', toCanvas(16, 16, whirlIcon([JADE_LOOK.glow.core, JADE_LOOK.glow.hot, JADE_LOOK.glow.mid, WIND_DEEP])));
  scene.textures.addCanvas('icon_mace', toCanvas(16, 16, maceIcon()));
  scene.textures.addCanvas('icon_sanctuary', toCanvas(16, 16, sanctuaryIcon()));
  const icons: [string, IconColors, IconColors][] = [
    ['', [hex('#f6feff'), hex('#86d2ff'), hex('#4aa6ff'), hex('#2a7cff')], [hex('#ffffff'), hex('#d8f0ff'), hex('#8cc4ff'), hex('#4a70c0')]],
    ['_sith', [hex('#fff6f2'), hex('#ff6a62'), hex('#f0283a'), hex('#c81628')], [hex('#fff0f4'), hex('#ff8a9a'), hex('#d0304a'), hex('#6a1030')]],
  ];
  for (const [suffix, saber, force] of icons) {
    scene.textures.addCanvas(`icon_saber${suffix}`, toCanvas(16, 16, saberIcon(saber)));
    scene.textures.addCanvas(`icon_force${suffix}`, toCanvas(16, 16, forceIcon(force)));
  }

  scene.textures.addCanvas('icon_fist', toCanvas(16, 16, fistIcon()));
  scene.textures.addCanvas('icon_flask', toCanvas(16, 16, flaskIcon()));
  scene.textures.addCanvas('icon_bog', toCanvas(16, 16, bogIcon()));
  scene.textures.addCanvas('icon_barrage', toCanvas(16, 16, barrageIcon([hex('#fffbe8'), hex('#ffd66b'), hex('#ff8a36'), hex('#d8402a')])));

  // Items: hotbar icons and the bottles monsters drop.
  for (const kind of ['health', 'speed'] as const) {
    scene.textures.addCanvas(`item_${kind}`, toCanvas(ITEM_ICON_SIZE, ITEM_ICON_SIZE, potionIcon(kind)));
    scene.textures.addCanvas(`drop_${kind}`, toCanvas(DROP_W, DROP_H, potionDrop(kind)));
  }

  register(scene, 'brazier', pack(frameList([0, 1, 2, 3].map(brazierFrame), 'f'), 16, 26), 16, 26);
  scene.anims.create({ key: 'brazier_burn', frames: scene.anims.generateFrameNames('brazier_e', { prefix: 'f', start: 0, end: 3 }), frameRate: 9, repeat: -1 });
  register(scene, 'crystals', pack(frameList([crystalCluster(3), crystalCluster(8)], 'c'), 20, 22), 20, 22);
  register(scene, 'rock', pack(frameList([rock(1), rock(2), rock(5)], 'r'), 18, 14), 18, 14, false);
  // Monsters.
  registerMonster(scene, 'frog', buildFrogSheet());
  registerMonster(scene, 'beetle', buildBeetleSheet());
  registerMonster(scene, 'puffcap', buildPuffcapSheet());
  registerMonster(scene, 'barkling', buildBarklingSheet());
  registerMonster(scene, 'glowmoth', buildGlowmothSheet());
  register(scene, 'thorns', pack(frameList([0, 1, 2].map(thornFrame), 't'), THORN_W, THORN_H), THORN_W, THORN_H, false);
  scene.textures.addCanvas('venom', toCanvas(7, 7, venomGlob()));
  const ring = ringCanvas(22, 12);
  scene.textures.addCanvas('danger_ring', toCanvas(ring.w, ring.h, ring.px));

  register(scene, 'dummy', pack(frameList([dummyFrame(false), dummyFrame(true)], 'd'), 18, 28), 18, 28, false);
}
