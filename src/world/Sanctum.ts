import Phaser from 'phaser';
import { ANVIL_H, ANVIL_OY, CRUCIBLE_H, CRUCIBLE_OY, GODRAY_W, KEEPER_H, KEEPER_OX, KEEPER_OY, KEEPER_W, RUNESTONE_H, RUNESTONE_OY } from '../art/sanctum';
import { TEMPLE_GLOWS } from '../art/runeHall';
import { warmSanctum } from '../art/textures';
import { KEEPERS, keeperCall, type Keeper } from '../game/keepers';
import { settings } from '../game/settings';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import {
  RUNESTONES,
  T_BRAZIERS,
  T_DAIS,
  T_FLOOR,
  T_FRONT,
  T_SIDE,
  T_WINDOW,
  TP_CX,
  TP_EXT_H,
  TP_EXT_W,
  TP_FOOT,
  TP_TOP,
  TP_W,
  TP_X,
  inTemple,
} from './sanctumLayout';

type Img = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** How close the hero walks to a keeper for their counter to open; they must step this much further off before it can open again. */
const TALK_R = 24;
const REARM = 10;
/** How long the roof takes to fade away, or come back, in ms. */
const FADE_MS = 260;
/** The braziers' light in the hall, and the keepers' stations' own glow. */
const BRAZIER_LIGHT = { radius: 110, intensity: 1.7, color: 0xff9444 };
const STATION_LIGHT = { radius: 84, intensity: 1.5 };
/** Day and night through the rose window: gold shafts by day, moon blue by night. */
const SUN = { ray: 0xffe2a8, light: 0xffd49a, pool: 0xffc870 };
const MOON = { ray: 0x9ab4ff, light: 0x7088ff, pool: 0x6a80e8 };
/** The glowing things on the temple's front, from its art to the world: the lanterns, the rose window, the crystal in the spire. */
const toWorld = (p: { x: number; y: number }) => ({ x: TP_CX - TP_EXT_W / 2 + p.x, y: TP_FOOT - TP_EXT_H + p.y });
const LANTERNS = TEMPLE_GLOWS.lanterns.map(toWorld);
const ROSE = toWorld(TEMPLE_GLOWS.rose);
const CRYSTAL = toWorld(TEMPLE_GLOWS.crystal);

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * The Rune Temple at the head of the Runestone Clearing, part of the map
 * like the Forge: its hall and steps are painted on the ground under a roof
 * that hides it, the rose of rune glass on its front and the crystal in its
 * spire glowing, lanterns by the door, a runestone either side of the steps.
 * When the hero steps through the door the roof and front fade away, showing
 * the hall with the hero in it: the braziers burning before the north wall,
 * light falling through the rose window as the world outside has it (gold
 * shafts by day, still moonbeams by night), and Nyx and Tharn at their
 * stations. Walking up to either calls up their counter.
 */
export class RuneTemple {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  /** The roof and front, and what glows on them. */
  private outside: Img[] = [];
  /** Halos on the outside, brighter as night falls and gone with the roof: lanterns, rose window, the spire's crystal. */
  private outHalos: { img: Img; base: number; night: number }[] = [];
  /** The runestones' halos, which stay whatever the roof does. */
  private stoneHalos: Img[] = [];
  /** The keepers' names, only with the roof off. */
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private fires: { light: Phaser.GameObjects.Light; halo: Img; seed: number }[] = [];
  private stationLights: Phaser.GameObjects.Light[] = [];
  private ray: Img;
  private pool: Img;
  private windowLight: Phaser.GameObjects.Light;
  private roseGlow: Img;
  private doorMotes: Emitter;
  private hallMotes: Emitter;
  private sunMotes: Emitter;
  private moonMotes: Emitter;
  private keepers: { id: Keeper; x: number; y: number }[] = [];
  /** The keeper the hero is standing by, whose counter has been called up. */
  private near: Keeper | null = null;
  /** Did this temple call up the counter that is open? */
  private opened = false;
  /** 0 with the roof on, 1 with it gone. */
  private reveal = 0;
  private offQuality: () => void;

  constructor(
    private scene: WorldScene,
    ground: (img: Img) => Img,
  ) {
    warmSanctum(scene);
    const add = scene.add;

    // The hall and its steps, on the ground.
    ground(add.image(TP_X, TP_TOP, 'rs_hall').setOrigin(0).setPipeline('Lit').setDepth(4));
    ground(add.image(TP_X, TP_TOP, 'rs_hall_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(5));

    // The braziers before the north wall, their fire lighting the hall.
    for (const b of T_BRAZIERS) {
      const x = TP_X + b.x;
      const y = TP_TOP + b.y;
      add.image(x, y, 'shadow_big').setDepth(y - 1).setAlpha(0.8);
      add.sprite(x, y, 'brazier', 'f0').setOrigin(0.5, 25 / 26).setPipeline('Lit').setDepth(y);
      add.sprite(x, y, 'brazier_e', 'f0').setOrigin(0.5, 25 / 26).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play({ key: 'brazier_burn', startFrame: Math.floor(Math.random() * 4) });
      const halo = add.image(x, y - 17, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a2a).setScale(2).setDepth(y + 0.2).setAlpha(0);
      this.fires.push({ light: scene.lights.addLight(x, y - 16, BRAZIER_LIGHT.radius, BRAZIER_LIGHT.color, 0), halo, seed: Math.random() * 100 });
    }

    // Each keeper on their dais, their station beside them with its lamp.
    const station = (key: string, x: number, y: number, oy: number, h: number, light: number) => {
      add.image(x, y, 'shadow_big').setDepth(y - 1).setAlpha(0.7);
      add.sprite(x, y, key, 'f0').setOrigin(0.5, oy / h).setPipeline('Lit').setDepth(y).play(`${key}_loop`);
      add.sprite(x, y, `${key}_e`, 'f0').setOrigin(0.5, oy / h).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play(`${key}_e_loop`);
      this.stationLights.push(scene.lights.addLight(x, y - 14, STATION_LIGHT.radius, light, 0));
    };
    station('rs_crucible', TP_X + T_DAIS.disenchant.station.x, TP_TOP + T_DAIS.disenchant.station.y, CRUCIBLE_OY, CRUCIBLE_H, 0xa070ff);
    station('rs_anvil', TP_X + T_DAIS.upgrade.station.x, TP_TOP + T_DAIS.upgrade.station.y, ANVIL_OY, ANVIL_H, 0xffb050);
    for (const id of ['disenchant', 'upgrade'] as const) {
      const k = KEEPERS[id];
      const x = TP_X + T_DAIS[id].keeper.x;
      const y = TP_TOP + T_DAIS[id].keeper.y;
      const ox = KEEPER_OX / KEEPER_W;
      const oy = KEEPER_OY / KEEPER_H;
      add.image(x, y, 'shadow').setDepth(y - 1);
      add.sprite(x, y, k.texture, 'f0').setOrigin(ox, oy).setPipeline('Lit').setDepth(y).play(`${k.texture}_loop`);
      add.sprite(x, y, `${k.texture}_e`, 'f0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play(`${k.texture}_e_loop`);
      this.labels.push(add.bitmapText(x, y - KEEPER_OY - 3, 'pixel', k.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(k.tint).setDepth(10002).setAlpha(0));
      this.keepers.push({ id, x, y });
    }

    // The rose window's light: a shaft down to the floor, a pool where it lands, and the glass itself shining.
    const wx = TP_X + T_WINDOW.x;
    const wy = TP_TOP + T_WINDOW.y;
    this.roseGlow = add.image(wx, wy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setDepth(TP_TOP + T_FLOOR - 1).setAlpha(0);
    this.ray = add.image(wx - 12, wy - 6, 'rs_ray', 'g0').setOrigin(18 / GODRAY_W, 0).setScale(1.35, 0.72).setBlendMode(Phaser.BlendModes.ADD).setDepth(TP_FOOT - 1).setAlpha(0);
    const fx = wx - 12 + GODRAY_W * 0.37 * 1.35;
    const fy = wy - 6 + 150 * 0.72;
    this.pool = add.image(fx, fy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(3.2, 1.4).setDepth(6).setAlpha(0);
    this.windowLight = scene.lights.addLight(fx - 6, fy - 24, 160, SUN.light, 0);

    // The temple over it all, and its shadow on the grass.
    this.outside.push(add.image(TP_CX, TP_FOOT, 'rs_temple', 't0').setOrigin(0.5, 1).setPipeline('Lit').setDepth(TP_FOOT - 0.5));
    this.outside.push(add.image(TP_CX, TP_FOOT, 'rs_temple_e', 't0').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(TP_FOOT - 0.4));
    this.shadows.push(sunShadow(add.image(TP_CX, TP_FOOT, 'rs_temple_s', 't0').setOrigin(0.5, 1)));
    // The lamplit hall through the open doors, on the steps and the plaza.
    scene.glowLight(TP_CX, TP_FOOT - 8, 80, 0xffa050, 1.3, 0.35, 0xff9a40, 1.1);
    const halo = (x: number, y: number, tint: number, scale: number, base: number, night: number) =>
      this.outHalos.push({ img: add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale).setDepth(TP_FOOT + 1), base, night });
    for (const l of LANTERNS) halo(l.x, l.y, 0xffa850, 0.7, 0.75, 0.85);
    halo(ROSE.x, ROSE.y, 0x9a70ff, 1.3, 0.5, 0.7);
    halo(CRYSTAL.x, CRYSTAL.y, 0xa880ff, 1.1, 0.65, 0.6);

    // Two runestones flanking the steps, their runes faintly violet.
    RUNESTONES.forEach((r, k) => {
      const ro = RUNESTONE_OY / RUNESTONE_H;
      add.image(r.x, r.y, 'shadow').setDepth(1).setAlpha(0.6);
      add.image(r.x, r.y, 'rs_runestone', `r${k}`).setOrigin(0.5, ro).setPipeline('Lit').setDepth(r.y);
      add.image(r.x, r.y, 'rs_runestone_e', `r${k}`).setOrigin(0.5, ro).setBlendMode(Phaser.BlendModes.ADD).setDepth(r.y + 0.1);
      this.shadows.push(sunShadow(add.image(r.x, r.y, 'rs_runestone_s', `r${k}`).setOrigin(0.5, ro)));
      this.stoneHalos.push(add.image(r.x, r.y - 20, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9a70ff).setScale(0.9).setDepth(r.y + 40));
    });

    // A few specks of lamplit dust drifting out over the sill.
    this.doorMotes = add.particles(0, 0, 'spark', {
      x: { min: TP_CX - 8, max: TP_CX + 8 },
      y: { min: TP_FOOT - 20, max: TP_FOOT - 12 },
      lifespan: { min: 1800, max: 2800 },
      speedY: { min: -4, max: 2 },
      speedX: { min: -3, max: 3 },
      scale: 0.4,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.5 },
      tint: [0xffd890, 0xffb060],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 420,
    }).setDepth(TP_FOOT + 1);
    // Inside: dust drifting in the lamplight, under the roof so it goes with it.
    this.hallMotes = add.particles(0, 0, 'spark', {
      x: { min: TP_X + T_SIDE + 8, max: TP_X + TP_W - T_SIDE - 8 },
      y: { min: TP_TOP + T_FLOOR - 20, max: TP_TOP + T_FRONT - 6 },
      lifespan: { min: 3000, max: 5000 },
      speedY: { min: -5, max: 2 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
      tint: [0xd8c0ff, 0xffe0a0, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 260,
      emitting: false,
    }).setDepth(TP_FOOT - 1);
    // Dust turning in the sunbeam by day; by night a few slow blue specks rising in the moonlight.
    const beamZone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const u = Math.random();
        p.x = this.ray.x + (Math.random() - 0.5) * (12 + u * 20) * 1.35 + u * GODRAY_W * 0.37 * 1.35;
        p.y = this.ray.y + 10 + u * 140 * 0.72;
        return p;
      },
    };
    const zone = { type: 'random', source: beamZone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData;
    this.sunMotes = add.particles(0, 0, 'spark', {
      emitZone: zone,
      lifespan: { min: 2600, max: 4200 },
      speedY: { min: 1, max: 5 },
      speedX: { min: -2, max: 4 },
      scale: { min: 0.3, max: 0.5 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
      tint: [0xfff0c0, 0xffd890, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 110,
      emitting: false,
    }).setDepth(TP_FOOT - 1);
    this.moonMotes = add.particles(0, 0, 'spark', {
      emitZone: zone,
      lifespan: { min: 4000, max: 6500 },
      speedY: { min: -4, max: -1 },
      speedX: { min: -1.5, max: 1.5 },
      scale: 0.4,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.6 },
      tint: [0xb8c8ff, 0x8aa0ff, 0xe8f0ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 300,
      emitting: false,
    }).setDepth(TP_FOOT - 1);

    // Half the motes on Fast graphics.
    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.doorMotes.frequency = 420 * k;
      this.hallMotes.frequency = 260 * k;
      this.sunMotes.frequency = 110 * k;
      this.moonMotes.frequency = 300 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offQuality();
      keeperCall.want = null;
    });
  }

  /** How far the hero is from the braziers, for their crackle: only from inside. */
  fireDistance(x: number, y: number): number {
    if (this.reveal < 0.5) return Infinity;
    return Math.min(...this.fires.map((f) => Math.hypot(x - f.light.x, y - f.light.y)));
  }

  /** After the hero moves: fade the roof as they come and go, light the hall as the day outside has it, and call a keeper up when they walk up to one. */
  update(x: number, y: number, dt: number, view: Phaser.Geom.Rectangle, daylight: number): void {
    const inside = inTemple(x, y);
    const step = dt / FADE_MS;
    this.reveal = Phaser.Math.Clamp(this.reveal + (inside ? step : -step), 0, 1);
    const r = Phaser.Math.Easing.Sine.InOut(this.reveal);
    for (const o of this.outside) o.setAlpha(1 - r);
    for (const l of this.labels) l.setAlpha(r);
    this.light(r, daylight);
    this.doorMotes.emitting = r < 0.5 && view.right > TP_CX - 40 && view.left < TP_CX + 40 && view.bottom > TP_FOOT - 30;
    this.hallMotes.emitting = r > 0.5;

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

  /** The hall's fires and the window's light come up as the roof goes; outside, the lanterns and the glass glow brighter by night. */
  private light(r: number, d: number): void {
    const night = 1 - d;
    const t = this.scene.time.now;
    for (const h of this.outHalos) h.img.setAlpha(h.base * (1 - h.night + night * h.night) * (1 - r));
    for (const h of this.stoneHalos) h.setAlpha(0.4 * (0.15 + night * 0.85));
    for (const f of this.fires) {
      const n = Math.sin(t * 0.013 + f.seed) * 0.5 + Math.sin(t * 0.031 + f.seed * 2) * 0.3 + Math.sin(t * 0.071 + f.seed * 3) * 0.2;
      f.light.intensity = BRAZIER_LIGHT.intensity * (0.85 + n * 0.15) * (0.55 + night * 0.45) * r;
      f.halo.setAlpha((0.4 + n * 0.08) * r);
    }
    for (const l of this.stationLights) l.intensity = STATION_LIGHT.intensity * r;
    this.sunMotes.emitting = r > 0.5 && d > 0.45;
    this.moonMotes.emitting = r > 0.5 && d <= 0.45;
    // By day the shaft breathes as clouds pass; by night it holds still.
    const shimmer = 1 + (Math.sin(t * 0.0009) * 0.12 + Math.sin(t * 0.0023) * 0.06) * d;
    this.ray.setTint(lerpColor(MOON.ray, SUN.ray, d)).setAlpha(r * (0.3 + d * 0.45) * shimmer);
    this.pool.setTint(lerpColor(MOON.pool, SUN.pool, d)).setAlpha(r * (0.12 + d * 0.26) * shimmer);
    this.windowLight.setColor(lerpColor(MOON.light, SUN.light, d));
    this.windowLight.intensity = r * (0.6 + d * 1.2) * shimmer;
    this.roseGlow.setTint(lerpColor(0x6a80ff, 0xffe8b8, d)).setAlpha(r * (0.24 + d * 0.2));
  }

  /** Talk to the keeper the hero stands by, if any (the E key). */
  talk(x: number, y: number): boolean {
    if (!inTemple(x, y)) return false;
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
