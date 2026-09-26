import Phaser from 'phaser';
import {
  ANVIL_H,
  ANVIL_OY,
  CRUCIBLE_H,
  CRUCIBLE_OY,
  GODRAY_W,
  KEEPER_H,
  KEEPER_OX,
  KEEPER_OY,
  KEEPER_W,
  PILLAR_H,
  PILLAR_OY,
  RUNESTONE_H,
  RUNESTONE_OY,
  TEMPLE_ART_H,
  TEMPLE_ART_OY,
} from '../art/sanctum';
import { warmSanctum } from '../art/textures';
import { KEEPERS, keeperCall, type Keeper } from '../game/keepers';
import { settings } from '../game/settings';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { DAIS, PILLARS, ROOM_BRAZIERS, ROOM_H, ROOM_W, ROOM_X, ROOM_Y, RUNESTONES, TEMPLE_X, TEMPLE_Y, WINDOW, atRoomExit, atTempleDoor } from './sanctumLayout';

type Img = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** How close the hero walks to a keeper for them to open their counter; they must step this much further off before it can open again. */
const TALK_R = 24;
const REARM = 10;

/** Where the light comes in: the rose window and the two lancets, in room pixels, and how big each shaft is. */
const SHAFTS = [
  { x: WINDOW.x, y: WINDOW.y - 6, sx: 1.7, sy: 0.92, frame: 'g0' },
  { x: 150, y: 58, sx: 0.8, sy: 0.74, frame: 'g1' },
  { x: 298, y: 58, sx: 0.8, sy: 0.74, frame: 'g0' },
];
/** Day and night inside: the light through the glass, gold by day, moon blue by night. */
const SUN = { ray: 0xffe2a8, light: 0xffd49a, pool: 0xffc870 };
const MOON = { ray: 0x9ab4ff, light: 0x7088ff, pool: 0x6a80e8 };

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * The Rune Temple at the top of the Runestone Clearing and the room inside
 * it: the old stone chapel with its lamplit doorway and two runestones, and
 * inside, the painted room (drawn by the ground camera), its pillars, braziers
 * and lights, the two keepers at their stations,  Light comes in through the windows as the world outside
 * has it: shafts of gold by day, calm moonbeams by night. It says when the
 * hero passes through the door either way, and calls a keeper's counter up
 * when the hero walks up to them.
 */
export class RuneTemple {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  private doorMotes: Emitter;
  private roomMotes: Emitter;
  private sunMotes: Emitter;
  private moonMotes: Emitter;
  private rays: Img[] = [];
  private pools: Img[] = [];
  private roseGlow: Img;
  private windowLights: Phaser.GameObjects.Light[] = [];
  /** Lantern and runestone halos outside, brighter as night falls. */
  private nightHalos: { img: Img; base: number }[] = [];
  private keepers: { id: Keeper; x: number; y: number; label: Phaser.GameObjects.BitmapText }[] = [];
  /** The keeper the hero is standing by, whose counter has been called up. */
  private near: Keeper | null = null;
  private offQuality: () => void;

  constructor(
    private scene: WorldScene,
    ground: (img: Img) => Img,
  ) {
    warmSanctum(scene);
    const add = scene.add;

    // Outside: the chapel and its shadow on the grass.
    const oy = TEMPLE_ART_OY / TEMPLE_ART_H;
    const depth = TEMPLE_Y - 14;
    add.image(TEMPLE_X, TEMPLE_Y, 'rs_temple', 't0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(depth);
    add.image(TEMPLE_X, TEMPLE_Y, 'rs_temple_e', 't0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1);
    this.shadows.push(sunShadow(add.image(TEMPLE_X, TEMPLE_Y, 'rs_temple_s', 't0').setOrigin(0.5, oy)));
    // The lamplit hall through the open doors, and the lanterns either side.
    scene.glowLight(TEMPLE_X, TEMPLE_Y - 24, 90, 0xffa050, 1.6, 0.35, 0xff9a40, 1.3);
    const halo = (x: number, y: number, tint: number, scale: number, base: number) =>
      this.nightHalos.push({ img: add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale).setDepth(y + 40), base });
    for (const sx of [-1, 1]) halo(TEMPLE_X + sx * 22, TEMPLE_Y - 48, 0xffa850, 0.7, 0.75);
    // Two runestones flanking the steps, their runes faintly violet.
    RUNESTONES.forEach((r, k) => {
      const ro = RUNESTONE_OY / RUNESTONE_H;
      add.image(r.x, r.y, 'shadow').setDepth(1).setAlpha(0.6);
      add.image(r.x, r.y, 'rs_runestone', `r${k}`).setOrigin(0.5, ro).setPipeline('Lit').setDepth(r.y);
      add.image(r.x, r.y, 'rs_runestone_e', `r${k}`).setOrigin(0.5, ro).setBlendMode(Phaser.BlendModes.ADD).setDepth(r.y + 0.1);
      this.shadows.push(sunShadow(add.image(r.x, r.y, 'rs_runestone_s', `r${k}`).setOrigin(0.5, ro)));
      halo(r.x, r.y - 20, 0x9a70ff, 0.9, 0.4);
    });
    this.doorMotes = add.particles(0, 0, 'spark', {
      x: { min: TEMPLE_X - 8, max: TEMPLE_X + 8 },
      y: { min: TEMPLE_Y - 40, max: TEMPLE_Y - 18 },
      lifespan: { min: 1400, max: 2400 },
      speedY: { min: -10, max: -3 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
      tint: [0xffe0a0, 0xffa050, 0xfff4d8],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 260,
    }).setDepth(depth + 1);

    // Inside: the room itself.
    ground(add.image(ROOM_X, ROOM_Y, 'rs_room').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(ROOM_X, ROOM_Y, 'rs_room_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));
    // Light through the windows: a shaft from each, pooling where it lands,
    // and the glass itself shining with what is outside.
    this.roseGlow = add.image(ROOM_X + WINDOW.x, ROOM_Y + WINDOW.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setDepth(4);
    for (const w of SHAFTS) {
      const ray = add.image(ROOM_X + w.x, ROOM_Y + w.y, 'rs_ray', w.frame).setOrigin(18 / GODRAY_W, 0).setScale(w.sx, w.sy).setBlendMode(Phaser.BlendModes.ADD).setDepth(9990);
      this.rays.push(ray);
      const fx = ROOM_X + w.x + (GODRAY_W * 0.37) * w.sx;
      const fy = ROOM_Y + w.y + 150 * w.sy;
      this.pools.push(add.image(fx, fy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6 * w.sx, 1.1 * w.sx).setDepth(3));
      this.windowLights.push(scene.lights.addLight(fx - 6 * w.sx, fy - 30 * w.sy, 150 * w.sx, SUN.light, 1));
    }

    for (const p of PILLARS) {
      const x = ROOM_X + p.x;
      const y = ROOM_Y + p.y;
      add.image(x, y, 'rs_pillar', 'p0').setOrigin(0.5, PILLAR_OY / PILLAR_H).setPipeline('Lit').setDepth(y);
      add.image(x, y, 'rs_pillar_e', 'p0').setOrigin(0.5, PILLAR_OY / PILLAR_H).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
      this.shadows.push(sunShadow(add.image(x, y, 'rs_pillar_s', 'p0').setOrigin(0.5, PILLAR_OY / PILLAR_H)));
    }
    for (const b of ROOM_BRAZIERS) scene.brazier(ROOM_X + b.x, ROOM_Y + b.y);

    // Each keeper on their dais, their station beside them.
    const station = (key: string, x: number, y: number, oy: number, h: number, light: number) => {
      add.image(x, y, 'shadow_big').setDepth(1).setAlpha(0.7);
      add.sprite(x, y, key, 'f0').setOrigin(0.5, oy / h).setPipeline('Lit').setDepth(y).play(`${key}_loop`);
      add.sprite(x, y, `${key}_e`, 'f0').setOrigin(0.5, oy / h).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play(`${key}_e_loop`);
      scene.glowLight(x, y - 14, 110, light, 1.6, 1, light, 1.5);
    };
    const nyx = DAIS.disenchant;
    const tharn = DAIS.upgrade;
    station('rs_crucible', ROOM_X + nyx.station.x, ROOM_Y + nyx.station.y, CRUCIBLE_OY, CRUCIBLE_H, 0xa070ff);
    station('rs_anvil', ROOM_X + tharn.station.x, ROOM_Y + tharn.station.y, ANVIL_OY, ANVIL_H, 0xffb050);
    for (const id of ['disenchant', 'upgrade'] as Keeper[]) {
      const k = KEEPERS[id];
      const x = ROOM_X + DAIS[id].keeper.x;
      const y = ROOM_Y + DAIS[id].keeper.y;
      const ox = KEEPER_OX / KEEPER_W;
      const oyk = KEEPER_OY / KEEPER_H;
      add.image(x, y, 'shadow').setDepth(1);
      add.sprite(x, y, k.texture, 'f0').setOrigin(ox, oyk).setPipeline('Lit').setDepth(y).play(`${k.texture}_loop`);
      add.sprite(x, y, `${k.texture}_e`, 'f0').setOrigin(ox, oyk).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play(`${k.texture}_e_loop`);
      this.shadows.push(sunShadow(add.image(x, y, `${k.texture}_s`, 'f0').setOrigin(ox, oyk)));
      const label = add.bitmapText(x, y - KEEPER_OY - 3, 'pixel', k.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(k.tint).setDepth(10002);
      this.keepers.push({ id, x, y, label });
    }

    // Dust drifting in the lamplight.
    this.roomMotes = add.particles(0, 0, 'spark', {
      x: { min: ROOM_X + 40, max: ROOM_X + ROOM_W - 40 },
      y: { min: ROOM_Y + 60, max: ROOM_Y + ROOM_H - 40 },
      lifespan: { min: 3000, max: 5000 },
      speedY: { min: -5, max: 2 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.7 },
      tint: [0xd8c0ff, 0xffe0a0, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 200,
    }).setDepth(9999);
    this.roomMotes.emitting = false;
    // Dust turning in the sunbeams by day; by night a few slow blue specks rising.
    const beamZone = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const w = SHAFTS[Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 2)];
        const u = Math.random();
        p.x = ROOM_X + w.x + (Math.random() - 0.5) * (12 + u * 20) * w.sx + u * GODRAY_W * 0.37 * w.sx;
        p.y = ROOM_Y + w.y + 10 + u * 140 * w.sy;
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
      frequency: 90,
      emitting: false,
    }).setDepth(9991);
    this.moonMotes = add.particles(0, 0, 'spark', {
      emitZone: zone,
      lifespan: { min: 4000, max: 6500 },
      speedY: { min: -4, max: -1 },
      speedX: { min: -1.5, max: 1.5 },
      scale: 0.4,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.6 },
      tint: [0xb8c8ff, 0x8aa0ff, 0xe8f0ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 260,
      emitting: false,
    }).setDepth(9991);

    // Half the motes on Fast graphics.
    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.doorMotes.frequency = 260 * k;
      this.roomMotes.frequency = 200 * k;
      this.sunMotes.frequency = 90 * k;
      this.moonMotes.frequency = 260 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offQuality();
      keeperCall.want = null;
    });
  }

  /**
   * After the hero moves: 'enter' or 'exit' when they walk through the door,
   * and a keeper's counter called up when they walk up to one.
   */
  update(x: number, y: number, inside: boolean, view: Phaser.Geom.Rectangle, daylight: number): 'enter' | 'exit' | null {
    this.doorMotes.emitting = !inside && view.right > TEMPLE_X - 40 && view.left < TEMPLE_X + 40;
    this.roomMotes.emitting = inside;
    this.light(inside, daylight);
    if (!inside) {
      this.near = null;
      return atTempleDoor(x, y) ? 'enter' : null;
    }
    if (atRoomExit(x, y)) return 'exit';
    const k = this.keeperAt(x, y, TALK_R);
    if (k && k !== this.near) {
      this.near = k;
      keeperCall.want = k;
    } else if (this.near && !this.keeperAt(x, y, TALK_R + REARM)) this.near = null;
    // Walking away from the keeper whose counter is open closes it.
    if (keeperCall.open && this.keeperAt(x, y, TALK_R + REARM + 6) !== keeperCall.open) keeperCall.leave = true;
    return null;
  }

  /** The windows let in the world's light: gold shafts that shimmer by day, still blue moonbeams by night. */
  private light(inside: boolean, d: number): void {
    const night = 1 - d;
    for (const h of this.nightHalos) h.img.setAlpha(h.base * (0.15 + night * 0.85));
    this.sunMotes.emitting = inside && d > 0.45;
    this.moonMotes.emitting = inside && d <= 0.45;
    if (!inside) return;
    const t = this.scene.time.now;
    const ray = lerpColor(MOON.ray, SUN.ray, d);
    const pool = lerpColor(MOON.pool, SUN.pool, d);
    const lamp = lerpColor(MOON.light, SUN.light, d);
    this.rays.forEach((r, k) => {
      // By day the shafts breathe as clouds pass; by night they hold still.
      const shimmer = 1 + (Math.sin(t * 0.0009 + k * 2.1) * 0.12 + Math.sin(t * 0.0023 + k) * 0.06) * d;
      r.setTint(ray).setAlpha((0.34 + d * 0.5) * shimmer);
      this.pools[k].setTint(pool).setAlpha((0.14 + d * 0.3) * shimmer);
      const l = this.windowLights[k];
      l.setColor(lamp);
      l.intensity = (0.7 + d * 1.3) * shimmer * (k === 0 ? 1 : 0.7);
    });
    this.roseGlow.setTint(lerpColor(0x6a80ff, 0xffe8b8, d)).setAlpha(0.28 + d * 0.22);
  }

  /** Talk to the keeper the hero stands by, if any (the E key). */
  talk(x: number, y: number): void {
    const k = this.keeperAt(x, y, TALK_R + REARM);
    if (k) keeperCall.want = k;
  }

  private keeperAt(x: number, y: number, r: number): Keeper | null {
    for (const k of this.keepers) if (Math.hypot(x - k.x, (y - k.y) * 1.3) < r) return k.id;
    return null;
  }
}
