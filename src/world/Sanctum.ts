import Phaser from 'phaser';
import {
  ANVIL_H,
  ANVIL_OY,
  CRUCIBLE_H,
  CRUCIBLE_OY,
  KEEPER_H,
  KEEPER_OX,
  KEEPER_OY,
  KEEPER_W,
  PILLAR_H,
  PILLAR_OY,
  TEMPLE_ART_H,
  TEMPLE_ART_OY,
} from '../art/sanctum';
import { warmSanctum } from '../art/textures';
import { KEEPERS, keeperCall, type Keeper } from '../game/keepers';
import { settings } from '../game/settings';
import { sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { CIRCLE, DAIS, PILLARS, ROOM_BRAZIERS, ROOM_H, ROOM_W, ROOM_X, ROOM_Y, TEMPLE_X, TEMPLE_Y, WINDOW, atRoomExit, atTempleDoor } from './sanctumLayout';

type Img = Phaser.GameObjects.Image;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** How close the hero walks to a keeper for them to open their counter; they must step this much further off before it can open again. */
const TALK_R = 24;
const REARM = 10;

/**
 * The Rune Temple on the Runestone Clearing and the room inside it: the
 * temple with its floating crystal and its doorway of violet light, and inside,
 * the painted room (drawn by the ground camera), its pillars, braziers and
 * lights, the two keepers at their stations, and a crystal turning over the
 * rune circle. It says when the hero passes through the door either way, and
 * calls a keeper's counter up when the hero walks up to them.
 */
export class RuneTemple {
  /** Sun shadows, for the world to fade with the light. */
  readonly shadows: Img[] = [];
  private doorMotes: Emitter;
  private roomMotes: Emitter;
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

    // Outside: the temple, its glow, and its shadow on the grass.
    const oy = TEMPLE_ART_OY / TEMPLE_ART_H;
    const depth = TEMPLE_Y - 14;
    add.image(TEMPLE_X, TEMPLE_Y, 'rs_temple', 't0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(depth);
    add.image(TEMPLE_X, TEMPLE_Y, 'rs_temple_e', 't0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1);
    this.shadows.push(sunShadow(add.image(TEMPLE_X, TEMPLE_Y, 'rs_temple_s', 't0').setOrigin(0.5, oy)));
    // The crystal above the spire, and the doorway's light.
    this.crystal(TEMPLE_X, TEMPLE_Y - TEMPLE_ART_OY + 1, depth + 0.2, 90);
    scene.glowLight(TEMPLE_X, TEMPLE_Y - 30, 120, 0xa070ff, 1.7, 0.55, 0x9a60ff, 2);
    this.doorMotes = add.particles(0, 0, 'spark', {
      x: { min: TEMPLE_X - 9, max: TEMPLE_X + 9 },
      y: { min: TEMPLE_Y - 40, max: TEMPLE_Y - 16 },
      lifespan: { min: 1200, max: 2200 },
      speedY: { min: -14, max: -5 },
      speedX: { min: -3, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
      tint: [0xd8b8ff, 0xa070ff, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 150,
    }).setDepth(depth + 1);

    // Inside: the room itself.
    ground(add.image(ROOM_X, ROOM_Y, 'rs_room').setOrigin(0).setPipeline('Lit').setDepth(0));
    ground(add.image(ROOM_X, ROOM_Y, 'rs_room_e').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2));
    // The rose window's light falling across the floor.
    add.image(ROOM_X + WINDOW.x, ROOM_Y + WINDOW.y + 70, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7a8cff).setScale(5, 3.6).setAlpha(0.14).setDepth(3);
    scene.glowLight(ROOM_X + WINDOW.x, ROOM_Y + WINDOW.y + 40, 230, 0xa8b8ff, 1.3, 1, 0x9aa8ff, 2.6);

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

    // A crystal turning over the rune circle, and dust drifting in the lamplight.
    this.crystal(ROOM_X + CIRCLE.x, ROOM_Y + CIRCLE.y - 8, ROOM_Y + CIRCLE.y, 130);
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

    // Half the motes on Fast graphics.
    this.offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.doorMotes.frequency = 150 * k;
      this.roomMotes.frequency = 200 * k;
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.offQuality();
      keeperCall.want = null;
    });
  }

  /** A crystal hovering at (x, y), bobbing, with a light under it. */
  private crystal(x: number, y: number, depth: number, radius: number): void {
    const add = this.scene.add;
    const lit = add.sprite(x, y, 'rs_crystal', 'f0').setOrigin(0.5, 1).setPipeline('Lit').setDepth(depth).play('rs_crystal_loop');
    const glow = add.sprite(x, y, 'rs_crystal_e', 'f0').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1).play('rs_crystal_e_loop');
    this.scene.tweens.add({ targets: [lit, glow], y: y - 3, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.scene.glowLight(x, y - 10, radius, 0xb088ff, 1.5, 0.6, 0xa070ff, 1.4);
  }

  /**
   * After the hero moves: 'enter' or 'exit' when they walk through the door,
   * and a keeper's counter called up when they walk up to one.
   */
  update(x: number, y: number, inside: boolean, view: Phaser.Geom.Rectangle): 'enter' | 'exit' | null {
    this.doorMotes.emitting = !inside && view.right > TEMPLE_X - 40 && view.left < TEMPLE_X + 40;
    this.roomMotes.emitting = inside;
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
    return null;
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
