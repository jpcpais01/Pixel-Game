import Phaser from 'phaser';
import {
  CAMP_CABINET,
  CAMP_H,
  CAMP_JARS,
  CAMP_KEEPER_X,
  CAMP_KEEPER_Y,
  CAMP_LANTERN,
  CAMP_OX,
  CAMP_OY,
  CAMP_W,
  HAZEL_H,
  HAZEL_OX,
  HAZEL_OY,
  HAZEL_W,
  registerNaturalist,
} from '../art/naturalist';
import { NATURALIST, keeperCall } from '../game/keepers';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { NATURALIST_CAMP } from './clearing';

type Img = Phaser.GameObjects.Image;

/** The camp blocks the hero: half its width, and how deep it runs back from the table's foot. */
const CAMP_HW = 38;
const CAMP_D = 24;
/** Where the hero stands to talk to Hazel, and how close; they must step this much further off before she calls again. */
const TALK = { x: NATURALIST_CAMP.x, y: NATURALIST_CAMP.y + 14 };
const TALK_R = 22;
const REARM = 10;
/** How fast her name fades in and out as the hero comes and goes, per ms. */
const NAME_FADE = 1 / 240;
/** The lantern's light, and how much of it is left by day. */
const LANTERN_R = 72;
const LANTERN_I = 1.3;
/** The jars' glow on the table and in the cabinet. */
const JAR_R = 34;
const JAR_I = 0.7;
const LIGHT_DAY = 0.3;
/** Fireflies drifting round the camp after dark. */
const FIREFLY_GAP = 420;

interface Glow {
  light: Phaser.GameObjects.Light;
  halo: Img;
  base: number;
  seed: number;
}

/**
 * Hazel the Naturalist's field camp on the Runestone Clearing's east lawn: a
 * canvas fly on birch poles over a specimen cabinet and a table of glowing
 * jars. Hazel buys the player's spare critters for dust; walking up to her
 * table opens her counter (ui/critterView.ts), as walking up to Nyx or Tharn
 * does theirs.
 */
export class NaturalistCamp {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  private glows: Glow[] = [];
  private name: Phaser.GameObjects.BitmapText;
  private nameAlpha = 0;
  private night = 0;
  private near = false;
  /** Did the camp call up the counter that is open? */
  private opened = false;

  constructor(private scene: WorldScene) {
    registerNaturalist(scene);
    const add = scene.add;
    const { x: sx, y: sy } = NATURALIST_CAMP;
    const so = { x: CAMP_OX / CAMP_W, y: CAMP_OY / CAMP_H };
    add.image(sx, sy, 'shadow_big').setDepth(sy - CAMP_D - 1).setScale(1.9, 1).setAlpha(0.6);
    const layer = (key: string, depth: number) => {
      add.sprite(sx, sy, key, 'f0').setOrigin(so.x, so.y).setPipeline('Lit').setDepth(depth).play(`${key}_loop`);
      add.sprite(sx, sy, `${key}_e`, 'f0').setOrigin(so.x, so.y).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1).play(`${key}_e_loop`);
    };
    // The back of the camp, Hazel behind her table, then the table and the poles in front of her.
    layer('nt_camp_back', sy - CAMP_D + 1);
    const hx = sx - CAMP_OX + CAMP_KEEPER_X;
    const hy = sy - CAMP_OY + CAMP_KEEPER_Y;
    const ho = { x: HAZEL_OX / HAZEL_W, y: HAZEL_OY / HAZEL_H };
    add.sprite(hx, hy, 'nt_hazel', 'f0').setOrigin(ho.x, ho.y).setPipeline('Lit').setDepth(hy).play('nt_hazel_loop');
    add.sprite(hx, hy, 'nt_hazel_e', 'f0').setOrigin(ho.x, ho.y).setBlendMode(Phaser.BlendModes.ADD).setDepth(hy + 0.1).play('nt_hazel_e_loop');
    layer('nt_camp_front', sy);
    for (const key of ['nt_camp_back_s', 'nt_camp_front_s']) this.shadows.push(sunShadow(add.image(sx, sy, key, 'f0').setOrigin(so.x, so.y)));

    // The lantern's warm light, and the jars' own glow on the table and in the cabinet.
    const at = (p: { x: number; y: number }) => [sx - CAMP_OX + p.x, sy - CAMP_OY + p.y] as const;
    this.glow(...at(CAMP_LANTERN), LANTERN_R, 0xffb45a, LANTERN_I, 0xffa04a, 1.4);
    this.glow(...at(CAMP_JARS), JAR_R, 0x9af0c0, JAR_I, 0x8af0d0, 0.8);
    this.glow(...at(CAMP_CABINET), JAR_R, 0xb89aff, JAR_I, 0xa8d0ff, 0.9);

    this.name = add.bitmapText(sx, sy - CAMP_OY - 2, 'pixel', NATURALIST.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(NATURALIST.tint).setDepth(10002).setAlpha(0);

    // A few fireflies drift round the camp after dark, drawn to its light.
    add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(sx - 56, sy - 64, 112, 72) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2400, max: 3800 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -6, max: 2 },
      scale: 0.45,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 3)) * Math.sin(t * Math.PI) * 0.9 * this.night },
      tint: [0xd8ff5a, 0xb8f04a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: FIREFLY_GAP,
    }).setDepth(sy + 40);
  }

  /** A light with a soft halo, flickered in update. */
  private glow(x: number, y: number, radius: number, color: number, base: number, haloTint: number, haloScale: number): void {
    const halo = this.scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(haloTint).setScale(haloScale).setDepth(NATURALIST_CAMP.y + 1).setAlpha(0.3);
    const light = this.scene.lights.addLight(x, y, radius, color, base);
    this.glows.push({ light, halo, base, seed: Math.random() * 100 });
  }

  /** Can the hero stand here? Not in the camp. */
  walkable(x: number, y: number): boolean {
    const { x: cx, y: cy } = NATURALIST_CAMP;
    return !(Math.abs(x - cx) < CAMP_HW && y > cy - CAMP_D && y < cy + 2);
  }

  /** Each frame: the lights flicker, and Hazel calls or closes her counter as the hero comes and goes. */
  update(time: number, dt: number, daylight: number, hx: number, hy: number): void {
    this.night = 1 - daylight;
    const k = 1 + (LIGHT_DAY - 1) * daylight;
    for (const g of this.glows) {
      const n = Math.sin(time * 0.009 + g.seed) * 0.6 + Math.sin(time * 0.023 + g.seed * 3) * 0.4;
      g.light.intensity = g.base * (0.9 + n * 0.1) * k;
      g.halo.setAlpha((0.26 + n * 0.04) * k);
    }

    const close = Math.hypot(hx - TALK.x, (hy - TALK.y) * 1.3);
    this.nameAlpha = Phaser.Math.Clamp(this.nameAlpha + (close < TALK_R + 40 ? dt : -dt) * NAME_FADE, 0, 1);
    this.name.setAlpha(this.nameAlpha);
    if (close < TALK_R && !this.near) {
      this.near = true;
      keeperCall.want = 'critters';
      this.opened = true;
    } else if (this.near && close > TALK_R + REARM) this.near = false;
    // Walking away from her table closes her counter.
    if (this.opened && keeperCall.open === 'critters' && close > TALK_R + REARM + 6) {
      keeperCall.leave = true;
      this.opened = false;
    }
  }

  /** Talk to Hazel, if the hero stands at her table (the E key). */
  talk(x: number, y: number): boolean {
    if (Math.hypot(x - TALK.x, (y - TALK.y) * 1.3) >= TALK_R + REARM) return false;
    keeperCall.want = 'critters';
    this.opened = true;
    return true;
  }
}
