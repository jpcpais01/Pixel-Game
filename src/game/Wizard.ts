import Phaser from 'phaser';
import { CAST_RELEASE, type Dir } from '../art/wizard';
import { wizardMeta } from '../art/textures';
import { snap } from './display';
import { BeamCharge, CHARGE_TIME, HOLD_TIME, beamSpec } from './Beam';
import { beamHud } from './controls';
import { sound } from '../audio';
import type { Hero } from './characters';
import { ARCANE_STYLE, VOID_STYLE, type SpellStyle } from './spells';

const SPEED = 58; // world px / second
const CAST_COOLDOWN = 180; // ms after a cast ends before the next can start
const BEAM_COOLDOWN = 380; // ms after a beam (or a fizzle) before the next attack
const MIN_POWER = 0.12; // a tap still fires a thin beam

// Sprite origin: frame centre horizontally, just under the boots vertically.
const ORIGIN_X = 12;
const ORIGIN_Y = 31;

// Walk frames where a foot lands (the stride peaks in the walk cycle).
const FOOTFALLS = new Set([1, 4]);

export interface WizardHooks {
  /** Energy ball released from the crystal. */
  cast(x: number, y: number, dx: number, dy: number): void;
  /** Beam fired from the crystal with the given charge (0..1). */
  beam(x: number, y: number, dx: number, dy: number, power: number): void;
}

/** Which look to wear: the texture/animation prefix and the matching spell colours. */
export interface WizardSkin {
  key: string;
  style: SpellStyle;
}

export const ARCANE_SKIN: WizardSkin = { key: 'wizard', style: ARCANE_STYLE };
export const VOID_SKIN: WizardSkin = { key: 'wizard_void', style: VOID_STYLE };

type State = 'free' | 'cast' | 'charge' | 'beam';

export class Wizard implements Hero {
  x: number;
  y: number;
  dir: Dir = 'down';
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private staffLight: Phaser.GameObjects.Light;
  private castShadow: Phaser.GameObjects.Sprite;
  /** 0 = night, 1 = day: softens the staff light and shows the sun shadow. */
  daylight = 0;
  private state: State = 'free';
  private released = false;
  private castDir = new Phaser.Math.Vector2(0, 1);
  private lastMove = new Phaser.Math.Vector2(0, 1);
  private cooldown = 0;
  private hooks: WizardHooks;
  private charge: BeamCharge;
  /** ms of charge gathered, capped at CHARGE_TIME. */
  private charged = 0;
  /** ms held at full charge. */
  private held = 0;
  /** ms of beam left to fire. */
  private firing = 0;
  /** After a fizzle the button must be let go before charging again. */
  private beamLatch = false;
  /** Texture and animation prefix of the worn look. */
  private key: string;

  constructor(scene: Phaser.Scene, x: number, y: number, hooks: WizardHooks, skin: WizardSkin = ARCANE_SKIN) {
    this.x = x;
    this.y = y;
    this.hooks = hooks;
    const key = (this.key = skin.key);
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(scene.add.sprite(x, y, `${key}_s`, 'idle_down_0').setOrigin(ORIGIN_X / 24, ORIGIN_Y / 32));
    this.body = scene.add
      .sprite(x, y, key, 'idle_down_0')
      .setOrigin(ORIGIN_X / 24, ORIGIN_Y / 32)
      .setPipeline('Lit');
    this.glowLayer = scene.add
      .sprite(x, y, `${key}_e`, 'idle_down_0')
      .setOrigin(ORIGIN_X / 24, ORIGIN_Y / 32)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(skin.style.glow).setScale(0.55);
    this.staffLight = scene.lights.addLight(x, y, 56, skin.style.light, 1.1);
    this.charge = new BeamCharge(scene, skin.style);
    this.body.play(`${key}_idle_down`);
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (anim.key.startsWith(`${key}_cast`) && this.state === 'cast') {
        this.state = 'free';
        this.cooldown = CAST_COOLDOWN;
        this.body.play(`${this.key}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${key}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
  }

  private get busy(): boolean {
    return this.state !== 'free';
  }

  update(dt: number, mx: number, my: number, attack: boolean, beam: boolean, bounds: Phaser.Geom.Rectangle): void {
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!beam) this.beamLatch = false;

    if (this.state === 'free' && this.cooldown === 0) {
      if (beam && !this.beamLatch) this.startCharge();
      else if (attack) this.startCast();
    }

    // Movement: full speed walking, a slow shuffle while casting or charging,
    // rooted in place while the beam fires.
    const speed = { free: SPEED * Math.min(1, len), cast: SPEED * 0.25, charge: SPEED * 0.2, beam: 0 }[this.state];
    if (moving && speed > 0) {
      this.x = Phaser.Math.Clamp(this.x + (mx / len) * speed * (dt / 1000), bounds.left, bounds.right);
      this.y = Phaser.Math.Clamp(this.y + (my / len) * speed * (dt / 1000), bounds.top, bounds.bottom);
    }

    if (this.state === 'free') {
      if (moving) this.dir = dirOf(mx, my);
      const key = `${this.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else if (this.state === 'cast') {
      if (!this.released && this.body.anims.currentFrame && this.body.anims.currentFrame.index - 1 >= CAST_RELEASE) {
        this.released = true;
        const tip = this.tip();
        this.hooks.cast(tip.x, tip.y, this.castDir.x, this.castDir.y);
      }
    } else if (this.state === 'charge') {
      this.updateCharge(dt, moving, beam);
    } else {
      this.firing -= dt;
      if (this.firing <= 0) {
        this.state = 'free';
        this.cooldown = BEAM_COOLDOWN;
        beamHud.firing = false;
        this.body.play(`${this.key}_idle_${this.dir}`);
      }
    }

    this.sync();
    if (this.state === 'charge') {
      const t = this.crystal();
      const lvl = this.charged / CHARGE_TIME;
      this.charge.update(dt, t.x, t.y, lvl, this.held / HOLD_TIME, this.depthAhead(), this.daylight);
    }
  }

  private startCharge(): void {
    this.state = 'charge';
    this.charged = 0;
    this.held = 0;
    this.castDir.copy(this.lastMove);
    this.dir = dirOf(this.castDir.x, this.castDir.y);
    this.body.play(`${this.key}_aim_${this.dir}`).chain(`${this.key}_charge_${this.dir}`);
  }

  private updateCharge(dt: number, moving: boolean, beam: boolean): void {
    // Aim follows the stick while gathering; the body turns to face it.
    if (moving) {
      this.castDir.copy(this.lastMove);
      const d = dirOf(this.castDir.x, this.castDir.y);
      if (d !== this.dir) {
        this.dir = d;
        this.body.chain(); // drop the queued charge loop if still aiming
        this.body.play(`${this.key}_charge_${d}`);
      }
    }

    if (!beam) {
      this.fireBeam();
      return;
    }
    this.charged = Math.min(CHARGE_TIME, this.charged + dt);
    if (this.charged >= CHARGE_TIME) {
      this.held += dt;
      if (this.held >= HOLD_TIME) {
        // Held too long: the gathered light slips away.
        const t = this.crystal();
        this.charge.fizzle(t.x + 0.5, t.y + 0.5);
        sound.beamFizzle();
        this.beamLatch = true;
        this.state = 'free';
        this.cooldown = BEAM_COOLDOWN;
        this.body.play(`${this.key}_idle_${this.dir}`);
      }
    }
    beamHud.charge = this.charged / CHARGE_TIME;
    beamHud.over = this.held / HOLD_TIME;
    if (this.state === 'charge') sound.beamCharge(beamHud.charge, beamHud.over);
    if (this.state !== 'charge') beamHud.charge = beamHud.over = 0;
  }

  private fireBeam(): void {
    const power = Math.max(MIN_POWER, this.charged / CHARGE_TIME);
    this.charge.hide();
    this.state = 'beam';
    this.firing = beamSpec(power).duration;
    beamHud.charge = beamHud.over = 0;
    beamHud.firing = true;
    this.body.chain();
    this.body.play(`${this.key}_beam_${this.dir}`);
    // Tip of the firing pose (same staff as the charge pose).
    this.sync();
    const t = this.crystal();
    this.hooks.beam(t.x, t.y, this.castDir.x, this.castDir.y, power);
  }

  /** Depth for magic at the crystal: behind the wizard when facing away, in front otherwise. */
  depthAhead(): number {
    return this.dir === 'up' ? snap(this.y) - 0.5 : snap(this.y) + 0.3;
  }

  private startCast(): void {
    this.state = 'cast';
    this.released = false;
    this.castDir.copy(this.lastMove);
    this.dir = dirOf(this.castDir.x, this.castDir.y);
    this.body.play(`${this.key}_cast_${this.dir}`);
    sound.charge();
  }

  /** The crystal's pixel (top-left corner, on the sprite's pixel grid) for the current frame. */
  crystal(): { x: number; y: number } {
    const m = wizardMeta.get(this.body.frame.name as string);
    const tx = m ? Math.floor(m.tipX) : ORIGIN_X;
    const ty = m ? Math.floor(m.tipY) : ORIGIN_Y - 20;
    return { x: snap(this.x) - ORIGIN_X + tx, y: snap(this.y) - ORIGIN_Y + ty };
  }

  /** Crystal position in world space for the current frame. */
  tip(): { x: number; y: number; glow: number } {
    const m = wizardMeta.get(this.body.frame.name as string);
    if (!m) return { x: this.x, y: this.y - 20, glow: 0.6 };
    return { x: snap(this.x) - ORIGIN_X + m.tipX, y: snap(this.y) - ORIGIN_Y + m.tipY, glow: m.glow };
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    this.body.setPosition(rx, ry).setDepth(ry);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(this.body.frame.name);
    this.shadow.setPosition(rx, ry - 1);
    this.castShadow.setPosition(rx, ry - 1).setFrame(this.body.frame.name).setAlpha(SUN_SHADOW_ALPHA * this.daylight);
    const t = this.tip();
    const flicker = 0.92 + Math.random() * 0.08;
    this.staffLight.setPosition(t.x, t.y);
    this.staffLight.intensity = (0.55 + t.glow * 0.9) * flicker * (this.busy ? 1.35 : 1) * (1 - this.daylight * 0.45);
    this.staffLight.radius = this.busy ? 80 : 58;
    this.halo.setPosition(t.x, t.y).setDepth(ry + 0.2).setAlpha((0.35 + t.glow * 0.4) * (1 - this.daylight * 0.5)).setScale(this.busy ? 0.75 : 0.5);
  }
}

export function dirOf(x: number, y: number): Dir {
  if (Math.abs(x) >= Math.abs(y) * 0.9) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

export const SUN_SHADOW_ALPHA = 0.42;

/**
 * Turn a silhouette (`<texture>_s`) into a sun shadow: a flattened silhouette laid on the
 * ground from its feet, falling away from the sun (top-left).
 */
export function sunShadow<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(obj: T): T {
  obj.setScale(1, -0.46).setAngle(-32).setAlpha(0).setDepth(2);
  return obj;
}
