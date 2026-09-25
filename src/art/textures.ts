// Turns the procedural art into Phaser textures. Each lit texture gets its
// normal map attached as a data source so Light2D can use it; emissive layers
// become separate textures with matching frame names, drawn additively.

import Phaser from 'phaser';
import type { PixelCanvas, RenderedFrame } from './pixel';
import { buildWizardFrames, FRAME_H, FRAME_W, ANIMS, DIRS, WIZARD_LOOKS, type FrameMeta } from './wizard';
import { ORB_FRAMES, ORB_SIZE, BURST_FRAMES, BURST_SIZE, orbFrame, burstFrame, ARCANE_SPELL, VOID_SPELL, glowCanvas, shadowCanvas, cloudShadowCanvas, sunShaftCanvas, skyIcon, beamIcon, swordIcon, whirlIcon, JADE_SWORD_ICON, maceIcon, sanctuaryIcon, saberIcon, forceIcon, fistIcon, barrageIcon, palmIcon, quakeIcon, flaskIcon, bogIcon, fumeCanvas, HEX_BREW_COLORS, PLAGUE_BREW, bowIcon, rainIcon, RANGER_QUIVER, STORM_QUIVER, type IconColors } from './effects';
import { buildJediFrames, JEDI_ANIMS, JEDI_H, JEDI_LOOKS, JEDI_W, TWIRL_FRAMES, twirlStart, TWIRL_FPS, type JediMeta } from './jedi';
import { ALCHEMIST_ANIMS, ALCHEMIST_LOOKS, ALCH_H, ALCH_W, BIG_FLASK_SIZE, FLASK_FRAMES, FLASK_SIZE, buildAlchemistFrames, flaskFrame } from './alchemist';
import { ARCHER_ANIMS, ARCHER_LOOKS, ARCHER_H, ARCHER_W, ARROW_DIRS, ARROW_SIZE, arrowFrame, buildArcherFrames, stuckArrowFrame } from './archer';
import { buildFighterFrames, FIGHTER_H, FIGHTER_LOOKS, FIGHTER_W } from './fighter';
import { hex } from './pixel';
import { DROP_H, DROP_W, ITEM_ICON_SIZE, potionDrop, potionIcon } from './items';
import { buildPaladinFrames, PALADIN_ANIMS, PALADIN_H, PALADIN_W, type PaladinMeta } from './paladin';
import { buildWarriorFrames, JADE_LOOK, WARRIOR_ANIMS, WARRIOR_H, WARRIOR_LOOKS, WARRIOR_W, type WarriorMeta } from './warrior';
import { WIND_DEEP } from './palette';
import { buildBarklingSheet, buildBeetleSheet, buildFrogSheet, buildGlowmothSheet, buildPuffcapSheet, ringCanvas, thornFrame, THORN_H, THORN_W, venomGlob, type MonsterSheet } from './monsters';
import { buildWardenSheet } from './warden';
import { FLOAT_ROCK_H, FLOAT_ROCK_W, HOLE_SIZE, METEOR_H, METEOR_W, OBELISK_H, OBELISK_W, PLATFORM_H, PLATFORM_W, RAY_H as COSMIC_RAY_H, RAY_W as COSMIC_RAY_W, cosmicRay, floatingRock, lightPool, meteor, obelisk, platformArt, shockRing, singularity, spaceCanvas, streak } from './cosmos';
import { COSMOS_H, COSMOS_W } from '../world/cosmosLayout';
import { brazierFrame, crystalCluster, rock, dummyFrame } from './env';
import { PROP_FRAMES, PROP_H, PROP_W, RAY_H, RAY_W, TREE_FRAMES, TREE_H, TREE_W, leafBit, rayCanvas } from './trees';
import { BLOOM_H, BLOOM_KINDS, BLOOM_W, FOUNTAIN_FRAMES, FOUNTAIN_H, FOUNTAIN_W, PILLAR_H, PILLAR_W, RUIN_H_H, RUIN_H_W, RUIN_V_H, RUIN_V_W, SEED_H, SEED_W, THORNBLOOM_H, THORNBLOOM_W, bloom, bloomSeed, buffIcon, fountain, pillar, ruinH, ruinV, thornbloom } from './garden';

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

  // Fighter once per style: 'fighter' for the brawler, 'fighter_monk' for the iron monk.
  for (const look of FIGHTER_LOOKS) {
    const ff = buildFighterFrames(look);
    register(scene, look.key, pack(ff.map((f) => ({ name: f.key, r: f.canvas.render() })), FIGHTER_W, FIGHTER_H), FIGHTER_W, FIGHTER_H);
    for (const a of look.anims) {
      for (const d of DIRS) {
        scene.anims.create({
          key: `${look.key}_${a.name}_${d}`,
          frames: ff.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: look.key, frame: f.key })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
  }

  // Alchemist once per look, and the flasks each throws (tumbling frames r0..r7),
  // plus the fumes of each bog: 'alchemist'/'flask'/'fume' for the plague
  // doctor, with a '_witch' suffix for the hex witch.
  for (const look of ALCHEMIST_LOOKS) {
    const sfx = look.key.slice('alchemist'.length);
    const af = buildAlchemistFrames(look);
    register(scene, look.key, pack(af.map((f) => ({ name: f.key, r: f.canvas.render() })), ALCH_W, ALCH_H), ALCH_W, ALCH_H);
    for (const a of ALCHEMIST_ANIMS) {
      for (const d of DIRS) {
        scene.anims.create({
          key: `${look.key}_${a.name}_${d}`,
          frames: af.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: look.key, frame: f.key })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
    for (const [key, big, size] of [[`flask${sfx}`, false, FLASK_SIZE], [`flask_big${sfx}`, true, BIG_FLASK_SIZE]] as const) {
      register(scene, key, pack(frameList(Array.from({ length: FLASK_FRAMES }, (_, i) => flaskFrame(i, big, look)), 'r'), size, size), size, size);
    }
    const brew = look.witch ? HEX_BREW_COLORS : PLAGUE_BREW;
    const fumes = scene.textures.addCanvas(`fume${sfx}`, toCanvas(18 * 3, 18, sideBySide(18, 18, [0, 1, 2].map((v) => fumeCanvas(18, v, brew)))))!;
    [0, 1, 2].forEach((v) => fumes.add(`f${v}`, 0, v * 18, 0, 18, 18));
    scene.textures.addCanvas(`icon_flask${sfx}`, toCanvas(16, 16, flaskIcon(brew)));
    scene.textures.addCanvas(`icon_bog${sfx}`, toCanvas(16, 16, bogIcon(brew)));
  }

  // Archer once per look, and the arrows each looses: 'arrow' frames r0..r15
  // (sixteen headings in flight) and k0..k2 (stuck in the ground), with a
  // '_storm' suffix for the storm archer.
  for (const look of ARCHER_LOOKS) {
    const sfx = look.key.slice('archer'.length);
    const rf = buildArcherFrames(look);
    register(scene, look.key, pack(rf.map((f) => ({ name: f.key, r: f.canvas.render() })), ARCHER_W, ARCHER_H), ARCHER_W, ARCHER_H);
    for (const a of ARCHER_ANIMS) {
      for (const d of DIRS) {
        scene.anims.create({
          key: `${look.key}_${a.name}_${d}`,
          frames: rf.filter((f) => f.anim === a.name && f.dir === d).map((f) => ({ key: look.key, frame: f.key })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
    const arrows = [
      ...frameList(Array.from({ length: ARROW_DIRS }, (_, i) => arrowFrame(i, look)), 'r'),
      ...frameList([0, 1, 2].map((k) => stuckArrowFrame(k, look)), 'k'),
    ];
    register(scene, `arrow${sfx}`, pack(arrows, ARROW_SIZE, ARROW_SIZE), ARROW_SIZE, ARROW_SIZE);
    const q = look.storm ? STORM_QUIVER : RANGER_QUIVER;
    scene.textures.addCanvas(`icon_bow${sfx}`, toCanvas(16, 16, bowIcon(q)));
    scene.textures.addCanvas(`icon_rain${sfx}`, toCanvas(16, 16, rainIcon(q, look.storm)));
  }

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
  scene.textures.addCanvas('icon_palm', toCanvas(16, 16, palmIcon()));
  scene.textures.addCanvas('icon_quake', toCanvas(16, 16, quakeIcon()));
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
  // The Sunken Garden: ruins, the fountain, thornblooms, blooms and their seeds, and the buffs' icons.
  register(scene, 'ruin_h', pack(frameList([0, 1, 2].map(ruinH), 'h'), RUIN_H_W, RUIN_H_H), RUIN_H_W, RUIN_H_H, false);
  register(scene, 'ruin_v', pack(frameList([0, 1, 2].map(ruinV), 'v'), RUIN_V_W, RUIN_V_H), RUIN_V_W, RUIN_V_H, false);
  register(scene, 'pillar', pack(frameList([0, 1, 2].map(pillar), 'p'), PILLAR_W, PILLAR_H), PILLAR_W, PILLAR_H, false);
  register(scene, 'fountain', pack(frameList(Array.from({ length: FOUNTAIN_FRAMES }, (_, f) => fountain(f)), 'f'), FOUNTAIN_W, FOUNTAIN_H), FOUNTAIN_W, FOUNTAIN_H);
  scene.anims.create({ key: 'fountain_flow', frames: scene.anims.generateFrameNames('fountain_e', { prefix: 'f', start: 0, end: FOUNTAIN_FRAMES - 1 }), frameRate: 8, repeat: -1 });
  register(scene, 'thornbloom', pack([{ name: 'bloom', r: thornbloom(false).render() }, { name: 'stump', r: thornbloom(true).render() }], THORNBLOOM_W, THORNBLOOM_H), THORNBLOOM_W, THORNBLOOM_H, true, true);
  const blooms = BLOOM_KINDS.flatMap((k) => (['open', 'bud', 'cut'] as const).map((stage) => ({ name: `${k}_${stage}`, r: bloom(k, stage).render() })));
  register(scene, 'bloom', pack(blooms, BLOOM_W, BLOOM_H, 12), BLOOM_W, BLOOM_H, true, true);
  register(scene, 'seed', pack(BLOOM_KINDS.map((k) => ({ name: k, r: bloomSeed(k).render() })), SEED_W, SEED_H), SEED_W, SEED_H);
  for (const k of ['might', 'ward', 'renew'] as const) scene.textures.addCanvas(`buff_${k}`, toCanvas(16, 16, buffIcon(k)));

  registerMonster(scene, 'frog', buildFrogSheet());
  registerMonster(scene, 'beetle', buildBeetleSheet());
  registerMonster(scene, 'puffcap', buildPuffcapSheet());
  registerMonster(scene, 'barkling', buildBarklingSheet());
  registerMonster(scene, 'glowmoth', buildGlowmothSheet());
  registerMonster(scene, 'warden', buildWardenSheet());
  register(scene, 'thorns', pack(frameList([0, 1, 2].map(thornFrame), 't'), THORN_W, THORN_H), THORN_W, THORN_H, false);
  scene.textures.addCanvas('venom', toCanvas(7, 7, venomGlob()));
  const ring = ringCanvas(22, 12);
  scene.textures.addCanvas('danger_ring', toCanvas(ring.w, ring.h, ring.px));

  register(scene, 'dummy', pack(frameList([dummyFrame(false), dummyFrame(true)], 'd'), 18, 28), 18, 28, false);
}

/** The Cosmos Arena's textures being built, a little per call. */
const cosmosJobs = new WeakMap<Phaser.Scene, Generator<void, void, void>>();

/**
 * Build the Cosmos Arena's backdrop, platform, props and spell textures,
 * spending at most `budget` ms (the arena select warms it up a little each
 * frame; the world finishes it at once). They are kept once built. Returns
 * true when they are all there.
 */
export function warmCosmos(scene: Phaser.Scene, budget = Infinity): boolean {
  if (scene.textures.exists('cosmos_streak')) return true;
  let job = cosmosJobs.get(scene);
  if (!job) {
    job = cosmosTextures(scene);
    cosmosJobs.set(scene, job);
  }
  const start = performance.now();
  while (performance.now() - start < budget) {
    if (job.next().done) {
      cosmosJobs.delete(scene);
      return true;
    }
  }
  return false;
}

function* cosmosTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const space = yield* spaceCanvas();
  scene.textures.addCanvas('cosmos_space', toCanvas(COSMOS_W, COSMOS_H, space));
  const plat = yield* platformArt();
  scene.textures.addCanvas('cosmos_platform', toCanvas(PLATFORM_W, PLATFORM_H, plat.diffuse))!.setDataSource(toCanvas(PLATFORM_W, PLATFORM_H, plat.normal));
  scene.textures.addCanvas('cosmos_platform_e', toCanvas(PLATFORM_W, PLATFORM_H, plat.emissive));
  yield;
  register(scene, 'cosmos_obelisk', pack(frameList([0, 1, 2].map(obelisk), 'o'), OBELISK_W, OBELISK_H), OBELISK_W, OBELISK_H);
  register(scene, 'cosmos_rock', pack(frameList([0, 1, 2].map(floatingRock), 'r'), FLOAT_ROCK_W, FLOAT_ROCK_H), FLOAT_ROCK_W, FLOAT_ROCK_H);
  yield;
  const rays = scene.textures.addCanvas('cosmos_ray', toCanvas(COSMIC_RAY_W * 3, COSMIC_RAY_H, sideBySide(COSMIC_RAY_W, COSMIC_RAY_H, [cosmicRay(5), cosmicRay(17), cosmicRay(40)])))!;
  [0, 1, 2].forEach((v) => rays.add(`ray${v}`, 0, v * COSMIC_RAY_W, 0, COSMIC_RAY_W, COSMIC_RAY_H));
  scene.textures.addCanvas('cosmos_pool', toCanvas(64, 26, lightPool(64, 26)));
  scene.textures.addCanvas('cosmos_meteor', toCanvas(METEOR_W, METEOR_H, meteor()));
  scene.textures.addCanvas('cosmos_wave', toCanvas(80, 80, shockRing(80, 80, 0.22)));
  const hole = singularity();
  scene.textures.addCanvas('cosmos_hole', toCanvas(HOLE_SIZE, HOLE_SIZE, hole.core));
  scene.textures.addCanvas('cosmos_hole_ring', toCanvas(HOLE_SIZE, HOLE_SIZE, hole.ring));
  const nova = ringCanvas(92, 62);
  scene.textures.addCanvas('cosmos_nova_ring', toCanvas(nova.w, nova.h, nova.px));
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('cosmos_streak', toCanvas(40, 3, streak(40)));
}
