import Phaser from 'phaser';
import {
  FOG_KINDS,
  FOG_W,
  LANTERN_FRAMES,
  LANTERN_H,
  LANTERN_KINDS,
  LANTERN_OY,
  STALL_H,
  STALL_OX,
  STALL_OY,
  STALL_W,
  STALL_WICK_X,
  STALL_WICK_Y,
  WICK_H,
  WICK_OX,
  WICK_OY,
  WICK_W,
  registerHallowsDecor,
} from '../art/hallowsDecor';
import { keeperCall } from '../game/keepers';
import type { SeasonDef } from '../game/season';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';

type Img = Phaser.GameObjects.Image;

/** Jack-o'-lanterns on the lawn: where, and which carving. Two flank the Rune Temple's steps. */
const LANTERNS: { x: number; y: number; kind: number }[] = [
  { x: 150, y: 226, kind: 0 },
  { x: 492, y: 226, kind: 1 },
  { x: 196, y: 432, kind: 2 },
  { x: 446, y: 438, kind: 0 },
  { x: 318, y: 470, kind: 1 },
  { x: 292, y: 224, kind: 2 },
  { x: 350, y: 226, kind: 0 },
];
/** A lantern's candle: its light's reach and strength, and how much of it survives by day. */
const LANTERN_R = 64;
const LANTERN_I = 1.3;
const LANTERN_DAY = 0.35;
/** The feet of a lantern block this far round them, so the hero steps round rather than through. */
const LANTERN_BLOCK = 6;

/** The candy stall on the west lawn, where the counter's foot meets the grass. */
const STALL = { x: 124, y: 368 };
/** Its booth blocks the hero: half its width, and how deep it runs back from the counter's foot. */
const STALL_HW = 34;
const STALL_D = 22;
/** Where the hero stands to be served, and how close; they must step this much further off before she calls again. */
const TALK = { x: STALL.x, y: STALL.y + 14 };
const TALK_R = 22;
const REARM = 10;
/** How fast her name fades in and out as the hero comes and goes, per ms. */
const NAME_FADE = 1 / 240;

/** Banks of ground fog: how many, and the lawn they drift over. */
const FOG_BANKS = 10;
const FOG_AREA = { x0: -40, x1: 680, y0: 150, y1: 520 };
/** Fog is thin by day and thickens at night. */
const FOG_DAY = 0.2;
const FOG_NIGHT = 0.5;

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

interface Candle {
  light: Phaser.GameObjects.Light;
  halo: Img;
  base: number;
  seed: number;
}

interface Bank {
  img: Img;
  speed: number;
  seed: number;
  alpha: number;
}

/**
 * Hallow's Eve in the Runestone Clearing: carved jack-o'-lanterns round the
 * lawn with candles flickering inside, low violet fog drifting over the grass
 * (thicker at night), and Old Wick's candy stall on the west lawn, where the
 * season's candy buys its limited skins and companions. Walking up to her
 * counter opens it, as walking up to Nyx or Tharn does theirs.
 *
 * Built only while a season runs; the next season dresses the Clearing with
 * its own art through the same places.
 */
export class HallowsClearing {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  private candles: Candle[] = [];
  private banks: Bank[] = [];
  private name: Phaser.GameObjects.BitmapText;
  private nameAlpha = 0;
  private night = 0;
  private near = false;
  /** Did the stall call up the counter that is open? */
  private opened = false;

  constructor(
    private scene: WorldScene,
    season: SeasonDef,
    ground: (img: Img) => Img,
    view: Phaser.Geom.Rectangle,
  ) {
    registerHallowsDecor(scene);
    const add = scene.add;
    const anims = scene.anims;

    // The lanterns' glow keeps step with their carving: one animation each, over the same frames.
    for (let k = 0; k < LANTERN_KINDS; k++) {
      const key = `hw_lantern_e_${k}`;
      if (!anims.exists(key)) {
        anims.create({ key, frames: anims.generateFrameNames('hw_lantern_e', { prefix: `l${k}_`, start: 0, end: LANTERN_FRAMES - 1 }), frameRate: 6, repeat: -1 });
      }
    }
    const oy = LANTERN_OY / LANTERN_H;
    for (const l of LANTERNS) {
      const start = Math.floor(Math.random() * LANTERN_FRAMES);
      add.image(l.x, l.y, 'shadow').setDepth(l.y - 1).setAlpha(0.8);
      add.sprite(l.x, l.y, 'hw_lantern', `l${l.kind}_0`).setOrigin(0.5, oy).setPipeline('Lit').setDepth(l.y).play({ key: `hw_lantern_${l.kind}`, startFrame: start });
      add.sprite(l.x, l.y, 'hw_lantern_e', `l${l.kind}_0`).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(l.y + 0.1).play({ key: `hw_lantern_e_${l.kind}`, startFrame: start });
      this.shadows.push(sunShadow(add.image(l.x, l.y, 'hw_lantern_s', `l${l.kind}_0`).setOrigin(0.5, oy)));
      this.candle(l.x, l.y - 7, LANTERN_R, 0xff8a2a, LANTERN_I, 0xff7a1a, 1.2);
    }

    // The stall: its back, Old Wick behind the counter, then the counter's front over her.
    const sx = STALL.x;
    const sy = STALL.y;
    const so = { x: STALL_OX / STALL_W, y: STALL_OY / STALL_H };
    add.image(sx, sy, 'shadow_big').setDepth(sy - STALL_D - 1).setScale(1.6, 1).setAlpha(0.7);
    const layer = (key: string, depth: number) => {
      add.sprite(sx, sy, key, 'f0').setOrigin(so.x, so.y).setPipeline('Lit').setDepth(depth).play(`${key}_loop`);
      add.sprite(sx, sy, `${key}_e`, 'f0').setOrigin(so.x, so.y).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1).play(`${key}_e_loop`);
    };
    layer('hw_stall_back', sy - STALL_D);
    // She stands behind the counter, where the stall's frame keeps room for her.
    const wx = sx - STALL_OX + STALL_WICK_X;
    const wy = sy - STALL_OY + STALL_WICK_Y;
    const wo = { x: WICK_OX / WICK_W, y: WICK_OY / WICK_H };
    add.sprite(wx, wy, 'hw_wick', 'f0').setOrigin(wo.x, wo.y).setPipeline('Lit').setDepth(wy).play('hw_wick_loop');
    add.sprite(wx, wy, 'hw_wick_e', 'f0').setOrigin(wo.x, wo.y).setBlendMode(Phaser.BlendModes.ADD).setDepth(wy + 0.1).play('hw_wick_e_loop');
    layer('hw_stall_front', sy);
    for (const key of ['hw_stall_back_s', 'hw_stall_front_s']) this.shadows.push(sunShadow(add.image(sx, sy, key, 'f0').setOrigin(so.x, so.y)));
    // Her hat's candles and the stall's paper lanterns, and the cauldron's green glow at its side.
    this.candle(sx, sy - 40, 96, 0xffa04a, 1.5, 0xff9a40, 1.6);
    this.candle(sx - 26, sy - 6, 44, 0x8aff6a, 0.9, 0x7aff5a, 0.8);

    this.name = add.bitmapText(sx, sy - STALL_OY - 4, 'pixel', season.keeper.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(season.keeper.tint).setDepth(10002).setAlpha(0);

    // Low fog on the grass: drawn with the ground, so everything stands in it.
    for (let i = 0; i < FOG_BANKS; i++) {
      const x = FOG_AREA.x0 + ((i * 0.618 + 0.13) % 1) * (FOG_AREA.x1 - FOG_AREA.x0);
      const y = FOG_AREA.y0 + ((i * 0.382 + 0.07) % 1) * (FOG_AREA.y1 - FOG_AREA.y0);
      const scale = 1.4 + ((i * 0.53) % 1) * 1.1;
      const img = ground(add.image(x, y, 'hw_fog', `g${i % FOG_KINDS}`).setScale(scale, scale * 0.8).setDepth(7).setFlipX(i % 2 === 1));
      this.banks.push({ img, speed: 2.5 + ((i * 0.71) % 1) * 4, seed: i * 1.7, alpha: 0.7 + ((i * 0.29) % 1) * 0.3 });
    }

    // Violet and ghost-green wisps rising out of it, only after dark.
    add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2600, max: 4200 },
      speedX: { min: -3, max: 3 },
      speedY: { min: -9, max: -3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 * this.night },
      tint: [0xb07aff, 0x8a5ae0, 0x9cff8a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 220,
    }).setDepth(9999);
  }

  /** A candle's light with a soft halo, flickered in update. */
  private candle(x: number, y: number, radius: number, color: number, base: number, haloTint: number, haloScale: number): void {
    const halo = this.scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(haloTint).setScale(haloScale).setDepth(y + 60).setAlpha(0.4);
    const light = this.scene.lights.addLight(x, y, radius, color, base);
    this.candles.push({ light, halo, base, seed: Math.random() * 100 });
  }

  /** Can the hero stand here? Not in the stall's booth or on a lantern. */
  walkable(x: number, y: number): boolean {
    if (Math.abs(x - STALL.x) < STALL_HW && y > STALL.y - STALL_D && y < STALL.y + 2) return false;
    for (const l of LANTERNS) if (Math.hypot(x - l.x, (y - l.y) * 1.6) < LANTERN_BLOCK) return false;
    return true;
  }

  /** Each frame: the candles flicker, the fog drifts, and the stall calls or closes its counter as the hero comes and goes. */
  update(time: number, dt: number, daylight: number, hx: number, hy: number): void {
    this.night = 1 - daylight;
    const k = 1 + (LANTERN_DAY - 1) * daylight;
    for (const c of this.candles) {
      const n = Math.sin(time * 0.013 + c.seed) * 0.5 + Math.sin(time * 0.031 + c.seed * 3) * 0.3 + Math.sin(time * 0.07 + c.seed * 7) * 0.2;
      c.light.intensity = c.base * (0.84 + n * 0.16) * k;
      c.halo.setAlpha((0.3 + n * 0.06) * k);
    }

    const tint = lerpColor(0x5a3aa8, 0xb8a0e0, daylight);
    const thick = FOG_NIGHT + (FOG_DAY - FOG_NIGHT) * daylight;
    const span = FOG_AREA.x1 - FOG_AREA.x0 + FOG_W * 3;
    for (const b of this.banks) {
      let x = b.img.x + (b.speed * dt) / 1000;
      if (x > FOG_AREA.x1 + FOG_W * 1.5) x -= span;
      // It thins as it drifts in and out at the lawn's ends, and breathes slowly.
      const edge = Phaser.Math.Clamp(Math.min(x - FOG_AREA.x0 + FOG_W, FOG_AREA.x1 + FOG_W - x) / FOG_W, 0, 1);
      const breathe = 0.85 + Math.sin(time * 0.0005 + b.seed) * 0.15;
      b.img.setX(x).setY(b.img.y + Math.sin(time * 0.0003 + b.seed) * 0.004 * dt).setTint(tint).setAlpha(thick * b.alpha * breathe * edge);
    }

    const close = Math.hypot(hx - TALK.x, (hy - TALK.y) * 1.3);
    this.nameAlpha = Phaser.Math.Clamp(this.nameAlpha + (close < TALK_R + 40 ? dt : -dt) * NAME_FADE, 0, 1);
    this.name.setAlpha(this.nameAlpha);
    if (close < TALK_R && !this.near) {
      this.near = true;
      keeperCall.want = 'candy';
      this.opened = true;
    } else if (this.near && close > TALK_R + REARM) this.near = false;
    // Walking away from her counter closes it.
    if (this.opened && keeperCall.open === 'candy' && close > TALK_R + REARM + 6) {
      keeperCall.leave = true;
      this.opened = false;
    }
  }

  /** Talk to Old Wick, if the hero stands at her counter (the E key). */
  talk(x: number, y: number): boolean {
    if (Math.hypot(x - TALK.x, (y - TALK.y) * 1.3) >= TALK_R + REARM) return false;
    keeperCall.want = 'candy';
    this.opened = true;
    return true;
  }
}
