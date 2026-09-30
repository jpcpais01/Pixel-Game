import Phaser from 'phaser';
import {
  BELLOWS_H,
  BELLOWS_OX,
  BELLOWS_OY,
  BELLOWS_W,
  HEARTH_H,
  HEARTH_OX,
  HEARTH_OY,
  HEARTH_W,
  SMITH_H,
  SMITH_OX,
  SMITH_OY,
  SMITH_STRIKE,
  SMITH_W,
  STRIKE_AT,
  TROUGH_H,
  TROUGH_OX,
  TROUGH_OY,
  TROUGH_W,
  YARD_H,
  YARD_OX,
  YARD_OY,
  YARD_W,
} from '../art/forge';
import { warmForge } from '../art/textures';
import { sound } from '../audio';
import { KEEPERS, keeperCall } from '../game/keepers';
import { settings } from '../game/settings';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { F_ANVIL, F_BELLOWS, F_HEARTH, F_TROUGH, FG_BARREL, FG_CX, FG_EXT_H, FG_EXT_W, FG_FOOT, FG_GRIND, FG_TOP, FG_X, inForge } from './forgeLayout';

type Img = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** How close the hero walks to Brenna for her counter to open; they must step this much further off before it can open again. */
const TALK_R = 24;
const REARM = 10;
/** How long the roof takes to fade away, or come back, in ms. */
const FADE_MS = 260;
/** The hearth's light: its reach and strength, and the flash off the anvil at each blow. */
const HEARTH_LIGHT = { radius: 120, intensity: 2.2, color: 0xff8a3a };
const STRIKE_LIGHT = { radius: 50, intensity: 1.6, color: 0xffc070 };
/** The anvil rings out this far from it (outside the smithy it is muffled). */
const CLANG_R = 150;

/**
 * The Forge on the west of the Runestone Clearing, part of the map: its hall
 * is painted on the ground under a roof that hides it, the chimney smoking
 * over it and the fire's glow in its door and window. When the hero steps
 * through the door the roof and front fade away, showing the forge with the
 * hero in it: the hearth roaring as the bellows blow, sparks flying up, steam
 * off the trough, and Brenna at her anvil, sparks bursting off the bar at
 * each blow. Walking up to her calls up her counter (ui/forgeView.ts).
 */
export class Forge {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  /** The roof and front, and what glows on them. */
  private outside: Img[] = [];
  /** Her name, only with the roof off. */
  private label: Phaser.GameObjects.BitmapText;
  private hearthLight: Phaser.GameObjects.Light;
  private strikeLight: Phaser.GameObjects.Light;
  private strikeT = 0;
  private hearthHalo: Img;
  private windowHalo: Img;
  /** What only runs with the roof off: sparks off the fire, steam off the trough. */
  private within: Emitter[] = [];
  private blowSparks: Emitter;
  private smith: Phaser.GameObjects.Sprite;
  private talkAt: { x: number; y: number };
  private near = false;
  /** Did the forge call up the counter that is open? */
  private opened = false;
  /** 0 with the roof on, 1 with it gone. */
  private reveal = 0;
  private heroX = 0;
  private heroY = 0;
  private offQuality: () => void;

  constructor(
    private scene: WorldScene,
    ground: (img: Img) => Img,
  ) {
    warmForge(scene);
    const add = scene.add;

    // The hall, on the ground.
    ground(add.image(FG_X, FG_TOP, 'fg_hall').setOrigin(0).setPipeline('Lit').setDepth(4));
    ground(add.image(FG_X, FG_TOP, 'fg_hall_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(5));

    /** A sprite standing in the hall with its glow over it, feet at (x, y). */
    const stand = (key: string, x: number, y: number, ox: number, oy: number, w: number, h: number, anim: boolean) => {
      const s = add.sprite(x, y, key, 'f0').setOrigin(ox / w, oy / h).setPipeline('Lit').setDepth(y);
      const e = add.sprite(x, y, `${key}_e`, 'f0').setOrigin(ox / w, oy / h).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
      if (anim) {
        s.play(`${key}_loop`);
        e.play(`${key}_e_loop`);
      }
      return s;
    };
    const hx = FG_X + F_HEARTH.x;
    const hy = FG_TOP + F_HEARTH.y;
    stand('fg_hearth', hx, hy, HEARTH_OX, HEARTH_OY, HEARTH_W, HEARTH_H, true);
    stand('fg_bellows', FG_X + F_BELLOWS.x, FG_TOP + F_BELLOWS.y, BELLOWS_OX, BELLOWS_OY, BELLOWS_W, BELLOWS_H, true);
    const tx = FG_X + F_TROUGH.x;
    const ty = FG_TOP + F_TROUGH.y;
    add.image(tx, ty, 'fg_trough', 't0').setOrigin(TROUGH_OX / TROUGH_W, TROUGH_OY / TROUGH_H).setPipeline('Lit').setDepth(ty);
    add.image(tx, ty, 'fg_trough_e', 't0').setOrigin(TROUGH_OX / TROUGH_W, TROUGH_OY / TROUGH_H).setBlendMode(Phaser.BlendModes.ADD).setDepth(ty + 0.1);
    const ax = FG_X + F_ANVIL.x;
    const ay = FG_TOP + F_ANVIL.y;
    add.image(ax - 2, ay - 1, 'shadow_big').setDepth(ay - 8).setAlpha(0.7);
    this.smith = stand('fg_smith', ax, ay, SMITH_OX, SMITH_OY, SMITH_W, SMITH_H, true);
    this.talkAt = { x: ax - 4, y: ay - 6 };
    this.label = add.bitmapText(ax - 4, ay - 40, 'pixel', KEEPERS.forge.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(KEEPERS.forge.tint).setDepth(10002).setAlpha(0);

    // The fire's light over the hall, and the flash off the anvil at each blow.
    this.hearthLight = scene.lights.addLight(hx, hy - 14, HEARTH_LIGHT.radius, HEARTH_LIGHT.color, 0);
    this.strikeLight = scene.lights.addLight(ax + STRIKE_AT.x - SMITH_OX, ay + STRIKE_AT.y - SMITH_OY - 2, STRIKE_LIGHT.radius, STRIKE_LIGHT.color, 0);
    this.hearthHalo = add.image(hx, hy - 16, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a2a).setScale(2.4, 1.6).setDepth(hy + 1).setAlpha(0);

    // Sparks up off the fire, steam off the trough.
    const fire = add.particles(0, 0, 'spark', {
      x: { min: hx - 12, max: hx + 12 },
      y: { min: hy - 22, max: hy - 18 },
      lifespan: { min: 600, max: 1200 },
      speedY: { min: -46, max: -22 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd070, 0xff9a3a, 0xff6a20],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 140,
    }).setDepth(hy + 2);
    const steam = add.particles(0, 0, 'glow', {
      x: { min: tx - 9, max: tx + 9 },
      y: ty - 11,
      lifespan: { min: 1400, max: 2200 },
      speedY: { min: -12, max: -6 },
      speedX: { min: -3, max: 3 },
      scale: { start: 0.15, end: 0.55 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.16 },
      tint: 0xd8dde4,
      frequency: 520,
    }).setDepth(ty + 1);
    this.within.push(fire, steam);
    // The burst off the bar at each blow, falling as it fades.
    this.blowSparks = add.particles(0, 0, 'spark', {
      lifespan: { min: 260, max: 520 },
      speed: { min: 30, max: 80 },
      angle: { min: 200, max: 340 },
      gravityY: 220,
      scale: { start: 0.55, end: 0.15 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff0b0, 0xffc060, 0xff8a30],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(ay + 2);
    this.smith.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (frame.textureFrame === `f${SMITH_STRIKE}`) this.strike();
    });

    // The smithy over it all, and its shadow on the grass.
    this.outside.push(add.image(FG_CX, FG_FOOT, 'fg_out', 't0').setOrigin(0.5, 1).setPipeline('Lit').setDepth(FG_FOOT - 0.5));
    this.outside.push(add.image(FG_CX, FG_FOOT, 'fg_out_e', 't0').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(FG_FOOT - 0.4));
    this.shadows.push(sunShadow(add.image(FG_CX, FG_FOOT, 'fg_out_s', 't0').setOrigin(0.5, 1)));
    // The forge's glow out of the door and the window, on the path and the grass.
    scene.glowLight(FG_CX, FG_FOOT - 8, 80, 0xff8a3a, 1.5, 0.4, 0xff8030, 1.2);
    const extLeft = FG_CX - FG_EXT_W / 2;
    const extTop = FG_FOOT - FG_EXT_H;
    this.windowHalo = add.image(extLeft + 4 + F_HEARTH.x - 12, FG_FOOT - 42 + 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a2a).setScale(1.1).setDepth(FG_FOOT + 1).setAlpha(0.5);

    // Smoke from the chimney, and now and then an ember with it.
    const chx = extLeft + 4 + F_HEARTH.x;
    const chy = extTop + 3;
    add.particles(0, 0, 'glow', {
      x: { min: chx - 3, max: chx + 3 },
      y: chy,
      lifespan: { min: 2600, max: 3800 },
      speedY: { min: -16, max: -9 },
      speedX: { min: 2, max: 7 },
      scale: { start: 0.25, end: 1.1 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, t * 6) * (1 - t) * 0.32 },
      tint: [0x3a3634, 0x4a4542, 0x2e2a28],
      frequency: 300,
    }).setDepth(FG_FOOT + 2);
    add.particles(0, 0, 'spark', {
      x: { min: chx - 3, max: chx + 3 },
      y: chy,
      lifespan: { min: 900, max: 1500 },
      speedY: { min: -30, max: -16 },
      speedX: { min: -4, max: 8 },
      scale: 0.45,
      alpha: { start: 1, end: 0 },
      tint: [0xffb050, 0xff7a2a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 900,
    }).setDepth(FG_FOOT + 2);

    // Outside by the door: the water barrel and the grindstone.
    for (const [p, frame] of [
      [FG_BARREL, 'y0'],
      [FG_GRIND, 'y1'],
    ] as [{ x: number; y: number }, string][]) {
      add.image(p.x, p.y, 'shadow').setDepth(1).setAlpha(0.6);
      add.image(p.x, p.y, 'fg_yard', frame).setOrigin(YARD_OX / YARD_W, YARD_OY / YARD_H).setPipeline('Lit').setDepth(p.y);
      this.shadows.push(sunShadow(add.image(p.x, p.y, 'fg_yard_s', frame).setOrigin(YARD_OX / YARD_W, YARD_OY / YARD_H)));
    }

    // Fewer sparks and less steam on Fast graphics.
    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      fire.frequency = 140 * k;
      steam.frequency = 520 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offQuality());
  }

  /** Brenna's hammer lands: sparks off the bar, a flash, and the anvil's ring for a hero close enough to hear it. */
  private strike(): void {
    this.strikeT = 1;
    if (this.reveal > 0.3) this.blowSparks.explode(settings.values.quality !== 'full' ? 5 : 9, this.smith.x + STRIKE_AT.x - SMITH_OX, this.smith.y + STRIKE_AT.y - SMITH_OY - 1);
    const d = Math.hypot(this.heroX - this.talkAt.x, this.heroY - this.talkAt.y);
    if (d > CLANG_R) return;
    // Muffled by the walls from outside, ringing within.
    const k = (1 - d / CLANG_R) * (0.35 + this.reveal * 0.65);
    if (k > 0.08) sound.anvil(this.scene.pan(this.smith.x), k);
  }

  /** How far the hero is from the fire, for its crackle: only from inside. */
  fireDistance(x: number, y: number): number {
    return this.reveal > 0.5 ? Math.hypot(x - this.hearthLight.x, y - this.hearthLight.y) : Infinity;
  }

  /** After the hero moves: fade the roof as they come and go, and call Brenna up when they walk up to her. */
  update(x: number, y: number, dt: number): void {
    this.heroX = x;
    this.heroY = y;
    const inside = inForge(x, y);
    const step = dt / FADE_MS;
    this.reveal = Phaser.Math.Clamp(this.reveal + (inside ? step : -step), 0, 1);
    const r = Phaser.Math.Easing.Sine.InOut(this.reveal);
    for (const o of this.outside) o.setAlpha(1 - r);
    this.label.setAlpha(r);
    for (const e of this.within) e.emitting = r > 0.5;

    // The fire breathes with the bellows, and flickers.
    const t = this.scene.time.now;
    const n = Math.sin(t * 0.011) * 0.5 + Math.sin(t * 0.029 + 1.3) * 0.3 + Math.sin(t * 0.067 + 4.1) * 0.2;
    const breath = 0.5 - 0.5 * Math.cos(((t / 1000) * 9 * Math.PI * 2) / 8);
    const f = 0.82 + n * 0.1 + breath * 0.14;
    this.hearthLight.intensity = HEARTH_LIGHT.intensity * f * r;
    this.hearthLight.radius = HEARTH_LIGHT.radius * (0.95 + n * 0.05);
    this.hearthHalo.setAlpha((0.28 + n * 0.06 + breath * 0.08) * r);
    this.windowHalo.setAlpha((0.42 + n * 0.08 + breath * 0.06) * (1 - r));
    this.strikeT = Math.max(0, this.strikeT - dt / 180);
    this.strikeLight.intensity = STRIKE_LIGHT.intensity * this.strikeT * r;

    if (!inside) {
      this.near = false;
      if (this.opened && keeperCall.open) keeperCall.leave = true;
      this.opened = false;
      return;
    }
    const at = this.nearSmith(x, y, TALK_R);
    if (at && !this.near) {
      this.near = true;
      keeperCall.want = 'forge';
      this.opened = true;
    } else if (this.near && !this.nearSmith(x, y, TALK_R + REARM)) this.near = false;
    // Walking away from her closes her counter.
    if (this.opened && keeperCall.open === 'forge' && !this.nearSmith(x, y, TALK_R + REARM + 6)) {
      keeperCall.leave = true;
      this.opened = false;
    }
  }

  /** Talk to Brenna if the hero stands by her (the E key). */
  talk(x: number, y: number): boolean {
    if (!this.nearSmith(x, y, TALK_R + REARM)) return false;
    keeperCall.want = 'forge';
    this.opened = true;
    return true;
  }

  private nearSmith(x: number, y: number, r: number): boolean {
    return Math.hypot(x - this.talkAt.x, (y - this.talkAt.y) * 1.3) < r;
  }
}
