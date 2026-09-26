import Phaser from 'phaser';
import { ANVIL_H, ANVIL_OY, CRUCIBLE_H, CRUCIBLE_OY, GODRAY_W, KEEPER_H, KEEPER_OX, KEEPER_OY, KEEPER_W } from '../art/sanctum';
import { warmChapel } from '../art/textures';
import { KEEPERS, keeperCall, type Keeper } from '../game/keepers';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { CH_CX, CH_FOOT, CH_TOP, CH_X, C_DAIS, C_WINDOW, inChapel } from './chapelLayout';

type Img = Phaser.GameObjects.Image;

/** How close the hero walks to a keeper for them to open their counter; they must step this much further off before it can open again. */
const TALK_R = 22;
const REARM = 10;
/** How long the roof takes to fade away, or come back, in ms. */
const FADE_MS = 260;

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * The walk-in chapel on the east of the Runestone Clearing, part of the map:
 * its hall is painted on the ground under a roof that hides it. When the hero
 * steps through the door the roof and front fade away, showing the hall with
 * the hero in it, Nyx and Tharn at their stations and the window's light on
 * the floor; stepping back out brings the roof back. Walking up to a keeper
 * calls their counter, as in the Rune Temple.
 *
 * This is the pattern for every lesser walk-in building (João's rule: only
 * important places like the Rune Temple open a new area). Nothing builds this
 * one right now; to place a building, construct it in WorldScene's arena
 * setup (like the Rune Temple, with `ground`), push its shadows, and route the
 * arena's walkable test through its `inChapel`/`chapelBlocks` (see
 * chapelLayout.ts); WorldScene already updates `this.chapel` and passes it E.
 */
export class Chapel {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  /** The roof and front, and what glows on them. */
  private outside: Img[] = [];
  /** What only shows with the roof off: the window's shaft, the keepers' names. */
  private within: { obj: Img | Phaser.GameObjects.BitmapText; base: number }[] = [];
  private ray: Img;
  private pool: Img;
  private lights: { light: Phaser.GameObjects.Light; base: number }[] = [];
  private windowLight: Phaser.GameObjects.Light;
  private keepers: { id: Keeper; x: number; y: number }[] = [];
  private near: Keeper | null = null;
  /** Did this chapel call up the counter that is open? */
  private opened = false;
  /** 0 with the roof on, 1 with it gone. */
  private reveal = 0;

  constructor(
    private scene: WorldScene,
    ground: (img: Img) => Img,
  ) {
    warmChapel(scene);
    const add = scene.add;

    // The hall, on the ground.
    ground(add.image(CH_X, CH_TOP, 'ch_hall').setOrigin(0).setPipeline('Lit').setDepth(4));
    ground(add.image(CH_X, CH_TOP, 'ch_hall_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(5));

    // The keepers on their daises, their stations beside them, their lamps.
    const station = (key: string, x: number, y: number, oy: number, h: number, light: number) => {
      add.image(x, y, 'shadow_big').setDepth(y - 1).setAlpha(0.7);
      add.sprite(x, y, key, 'f0').setOrigin(0.5, oy / h).setPipeline('Lit').setDepth(y).play(`${key}_loop`);
      add.sprite(x, y, `${key}_e`, 'f0').setOrigin(0.5, oy / h).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play(`${key}_e_loop`);
      this.lights.push({ light: scene.lights.addLight(x, y - 14, 80, light, 0), base: 1.4 });
    };
    const nyx = C_DAIS.disenchant.station;
    const tharn = C_DAIS.upgrade.station;
    station('rs_crucible', CH_X + nyx.x, CH_TOP + nyx.y, CRUCIBLE_OY, CRUCIBLE_H, 0xa070ff);
    station('rs_anvil', CH_X + tharn.x, CH_TOP + tharn.y, ANVIL_OY, ANVIL_H, 0xffb050);
    for (const id of ['disenchant', 'upgrade'] as Keeper[]) {
      const k = KEEPERS[id];
      const x = CH_X + C_DAIS[id].keeper.x;
      const y = CH_TOP + C_DAIS[id].keeper.y;
      const ox = KEEPER_OX / KEEPER_W;
      const oy = KEEPER_OY / KEEPER_H;
      add.image(x, y, 'shadow').setDepth(y - 1);
      // Nyx faces into the hall from the west, Tharn from the east.
      add.sprite(x, y, k.texture, 'f0').setOrigin(ox, oy).setPipeline('Lit').setDepth(y).play(`${k.texture}_loop`);
      add.sprite(x, y, `${k.texture}_e`, 'f0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play(`${k.texture}_e_loop`);
      const label = add.bitmapText(x, y - KEEPER_OY - 3, 'pixel', k.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(k.tint).setDepth(10002).setAlpha(0);
      this.within.push({ obj: label, base: 1 });
      this.keepers.push({ id, x, y });
    }

    // The window's light: a shaft down to the floor and a pool where it lands.
    const wx = CH_X + C_WINDOW.x;
    const wy = CH_TOP + C_WINDOW.y;
    this.ray = add.image(wx, wy - 4, 'rs_ray', 'g0').setOrigin(18 / GODRAY_W, 0).setScale(0.95, 0.62).setBlendMode(Phaser.BlendModes.ADD).setDepth(CH_FOOT - 1).setAlpha(0);
    this.pool = add.image(wx + 12, wy + 96, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6, 1.2).setDepth(CH_TOP + 60).setAlpha(0);
    this.windowLight = scene.lights.addLight(wx + 6, wy + 70, 130, 0xffd49a, 0);

    // The roof and front over it all, and its shadow on the grass.
    const oy = 1;
    this.outside.push(add.image(CH_CX, CH_FOOT, 'ch_out', 't0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(CH_FOOT - 0.5));
    this.outside.push(add.image(CH_CX, CH_FOOT, 'ch_out_e', 't0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(CH_FOOT - 0.4));
    this.shadows.push(sunShadow(add.image(CH_CX, CH_FOOT, 'ch_out_s', 't0').setOrigin(0.5, oy)));
    // The lamplit doorway's glow on the path.
    scene.glowLight(CH_CX, CH_FOOT - 8, 70, 0xffa050, 1.4, 0.35, 0xff9a40, 1.1);
  }

  /** After the hero moves: fade the roof as they come and go, and call a keeper up when they walk up to one. */
  update(x: number, y: number, dt: number, daylight: number): void {
    const inside = inChapel(x, y);
    const step = dt / FADE_MS;
    this.reveal = Phaser.Math.Clamp(this.reveal + (inside ? step : -step), 0, 1);
    const r = Phaser.Math.Easing.Sine.InOut(this.reveal);
    for (const o of this.outside) o.setAlpha(1 - r);
    for (const w of this.within) w.obj.setAlpha(w.base * r);
    for (const l of this.lights) l.light.intensity = l.base * r;

    // The window lets in the world's light: gold and shimmering by day, still and blue by night.
    const t = this.scene.time.now;
    const shimmer = 1 + (Math.sin(t * 0.0009) * 0.12 + Math.sin(t * 0.0023) * 0.06) * daylight;
    this.ray.setTint(lerpColor(0x9ab4ff, 0xffe2a8, daylight)).setAlpha(r * (0.3 + daylight * 0.45) * shimmer);
    this.pool.setTint(lerpColor(0x6a80e8, 0xffc870, daylight)).setAlpha(r * (0.12 + daylight * 0.25) * shimmer);
    this.windowLight.setColor(lerpColor(0x7088ff, 0xffd49a, daylight));
    this.windowLight.intensity = r * (0.6 + daylight * 1.1) * shimmer;

    if (!inside) {
      this.near = null;
      if (this.opened && keeperCall.open) keeperCall.leave = true;
      this.opened = false;
      return;
    }
    const k = this.keeperAt(x, y, TALK_R);
    if (k && k !== this.near) {
      this.near = k;
      keeperCall.want = k;
      this.opened = true;
    } else if (this.near && !this.keeperAt(x, y, TALK_R + REARM)) this.near = null;
    // Walking away from the keeper whose counter is open closes it.
    if (this.opened && keeperCall.open && this.keeperAt(x, y, TALK_R + REARM + 6) !== keeperCall.open) {
      keeperCall.leave = true;
      this.opened = false;
    }
  }

  /** Talk to the keeper the hero stands by, if any (the E key). */
  talk(x: number, y: number): boolean {
    const k = this.keeperAt(x, y, TALK_R + REARM);
    if (!k) return false;
    keeperCall.want = k;
    this.opened = true;
    return true;
  }

  private keeperAt(x: number, y: number, r: number): Keeper | null {
    for (const k of this.keepers) if (Math.hypot(x - k.x, (y - k.y) * 1.3) < r) return k.id;
    return null;
  }
}
