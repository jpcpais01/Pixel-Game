import Phaser from 'phaser';
import { sound } from '../../audio';
import { dirOf } from '../Wizard';
import { energy } from '../energy';
import { CHEM_TOX, HEX_TOX, PLAGUE_TOX, type ToxStyle } from '../Toxins';
import type { Aim, CharacterDef, Hero } from '../characters';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, bump, easeOut, flare, Fx, Ink, pal, ring, rune, type Pal } from './ink';
import { Inferno, Singularity } from './arcane';
import { DragonRush, MountainWrath, SaberCyclone, Skybreaker } from './martial';
import { HeavensLight, SunWrath } from './holy';
import { BloodMoon, Eclipse, FanOfKnives, SoulStorm } from './shadow';
import { ChemBomb, GreatArrow, Pestilence } from './nature';
import { Encore, ThunderOfWar } from './bard';
import { GrandFinale, PuppetMaster } from './puppeteer';
import { FATE_STRINGS, GOLD_STRINGS, ICE_STRINGS, SILK_STRINGS } from '../Strings';
import { Legion, TimeStop } from './chrono';
import { AEON_PAL, KEEPER_PAL, MOON_PAL, RIFT_PAL } from '../Chronos';
import * as icons from './icons';
import type { Cast, UltDef, UltSkin } from './types';

// The Special: each type's most powerful ability, paid for with energy (see
// energy.ts) and cast with C or the Special button. The hero plants their
// feet and gathers power for a moment, glowing, with a rune turning under
// them and the Special's name rising overhead; then it is unleashed. A skin
// casts its type's Special in its own colours and under its own name.

const toxPal = (t: ToxStyle): Pal => ({ core: t.core, hot: t.hot, mid: t.mid, deep: t.deep, light: t.light, tints: [t.core, t.hot, t.mid, t.deep] });

/** Each type's Special, by `class:type`. */
const ULTS: Record<string, UltDef> = {
  'wizard:arcane': {
    name: 'Singularity',
    cost: 70,
    windup: 650,
    aim: 'spot',
    range: 120,
    pal: pal(0xf2ffff, 0x9ff6ff, 0x39c6f0, 0x3a5ce0, 0x6fe4ff),
    icon: icons.singularityIcon,
    cast: (c) => c.world.addEffect(new Singularity(c.world, c.tx, c.ty, c.pal)),
  },
  'wizard:pyro': {
    name: 'Inferno',
    cost: 80,
    windup: 600,
    aim: 'dir',
    pal: pal(0xfff8e0, 0xffd66b, 0xff9a2e, 0xd9432b, 0xff9a40),
    icon: icons.infernoIcon,
    cast: (c) => c.world.addEffect(new Inferno(c.world, c)),
  },
  'warrior:knight': {
    name: 'Skybreaker',
    cost: 60,
    windup: 550,
    aim: 'spot',
    range: 95,
    pal: pal(0xffffff, 0xfff4c8, 0xffd66b, 0xb8762a, 0xffe0a0),
    icon: icons.skybreakerIcon,
    cast: (c) => c.world.addEffect(new Skybreaker(c.world, c.tx, c.ty, c.pal)),
  },
  'paladin:holy': {
    name: "Heaven's Light",
    cost: 70,
    windup: 650,
    aim: 'self',
    pal: pal(0xffffff, 0xfff4c0, 0xffd66b, 0xc8903a, 0xfff0b0),
    icon: icons.heavensLightIcon,
    cast: (c) => c.world.addEffect(new HeavensLight(c.world, c)),
  },
  'paladin:crusader': {
    name: 'Wrath of the Sun',
    cost: 75,
    windup: 650,
    aim: 'self',
    pal: pal(0xfff8e0, 0xffd66b, 0xff8a3a, 0xc8401e, 0xffa050),
    icon: icons.sunWrathIcon,
    cast: (c) => c.world.addEffect(new SunWrath(c.world, c)),
  },
  'jedi:knight': {
    name: 'Saber Cyclone',
    cost: 60,
    windup: 450,
    aim: 'dir',
    pal: pal(0xffffff, 0xa8e0ff, 0x4aa6ff, 0x2a5cd0, 0x6fb8ff),
    icon: icons.saberCycloneIcon,
    cast: (c) => c.world.addEffect(new SaberCyclone(c.world, c)),
  },
  'fighter:brawler': {
    name: 'Dragon Rush',
    cost: 55,
    windup: 320,
    hold: 320,
    aim: 'dir',
    pal: pal(0xfff4d8, 0xffc060, 0xff6a3a, 0xb82a2a, 0xff8a50),
    icon: icons.dragonRushIcon,
    cast: (c) => c.world.addEffect(new DragonRush(c.world, c)),
  },
  'fighter:monk': {
    name: "Mountain's Wrath",
    cost: 65,
    windup: 600,
    aim: 'self',
    pal: pal(0xfffbe0, 0xffe08a, 0xf0a63a, 0x9a5a24, 0xffc060),
    icon: icons.mountainIcon,
    cast: (c) => c.world.addEffect(new MountainWrath(c.world, c)),
  },
  'alchemist:plague': {
    name: 'Pestilence',
    cost: 65,
    windup: 600,
    aim: 'spot',
    range: 110,
    pal: toxPal(PLAGUE_TOX),
    icon: icons.pestilenceIcon,
    cast: (c) => c.world.addEffect(new Pestilence(c.world, c.tx, c.ty, c.look === 'witch' ? HEX_TOX : PLAGUE_TOX)),
  },
  'alchemist:chem': {
    name: 'Chem Bomb',
    cost: 70,
    windup: 500,
    aim: 'spot',
    range: 120,
    pal: toxPal(CHEM_TOX),
    icon: icons.chemBombIcon,
    cast: (c) => c.world.addEffect(new ChemBomb(c.world, c, CHEM_TOX)),
  },
  'archer:ranger': {
    name: 'Great Arrow',
    cost: 60,
    windup: 650,
    aim: 'dir',
    pal: pal(0xf4ffe8, 0xc8f59a, 0x8ad65a, 0x3f8a4a, 0xb0f080),
    icon: icons.greatArrowIcon,
    cast: (c) => c.world.addEffect(new GreatArrow(c.world, c)),
  },
  'rogue:rogue': {
    name: 'Fan of Knives',
    cost: 55,
    windup: 350,
    aim: 'self',
    pal: pal(0xffffff, 0xffd0d4, 0xe8505a, 0x8a1c2c, 0xff6070),
    icon: icons.fanIcon,
    cast: (c) => c.world.addEffect(new FanOfKnives(c.world, c)),
  },
  'rogue:dancer': {
    name: 'Eclipse',
    cost: 65,
    windup: 450,
    aim: 'self',
    pal: pal(0xf8f0ff, 0xd4b8ff, 0xa878ff, 0x4a2a8a, 0xb890ff),
    icon: icons.eclipseIcon,
    cast: (c) => c.world.addEffect(new Eclipse(c.world, c)),
  },
  'necromancer:necro': {
    name: 'Soul Storm',
    cost: 70,
    windup: 600,
    aim: 'self',
    pal: pal(0xf0fff8, 0xa8ffd8, 0x5cf0b0, 0x1f8a70, 0x7affc8),
    icon: icons.soulStormIcon,
    cast: (c) => c.world.addEffect(new SoulStorm(c.world, c)),
  },
  'necromancer:blood': {
    name: 'Blood Moon',
    cost: 75,
    windup: 650,
    aim: 'spot',
    range: 110,
    pal: pal(0xfff0f0, 0xff8a8a, 0xff3a4a, 0x8a0f1f, 0xff4a5a),
    icon: icons.bloodMoonIcon,
    cast: (c) => c.world.addEffect(new BloodMoon(c.world, c.tx, c.ty, c)),
  },
  'bard:minstrel': {
    name: 'Encore',
    cost: 65,
    windup: 550,
    aim: 'self',
    pal: pal(0xf4fffc, 0xa8fff0, 0x3fd8c8, 0x1a7a8a, 0x6fe8d8),
    icon: icons.encoreIcon,
    cast: (c) => c.world.addEffect(new Encore(c.world, c)),
  },
  'bard:drummer': {
    name: 'Thunder of War',
    cost: 70,
    windup: 600,
    aim: 'self',
    pal: pal(0xfffbe8, 0xffd98a, 0xff9a3a, 0xb8401e, 0xffa850),
    icon: icons.thunderIcon,
    cast: (c) => c.world.addEffect(new ThunderOfWar(c.world, c)),
  },
  'chronomancer:keeper': {
    name: 'Time Stop',
    cost: 75,
    windup: 650,
    aim: 'self',
    pal: KEEPER_PAL,
    icon: icons.timeStopIcon,
    cast: (c) => c.world.addEffect(new TimeStop(c.world, c)),
  },
  'chronomancer:paradox': {
    name: 'Legion of Echoes',
    cost: 70,
    windup: 550,
    aim: 'self',
    pal: RIFT_PAL,
    icon: icons.legionIcon,
    cast: (c) => c.world.addEffect(new Legion(c.world, c)),
  },
  'puppeteer:marionette': {
    name: 'Grand Finale',
    cost: 70,
    windup: 550,
    aim: 'spot',
    range: 110,
    pal: GOLD_STRINGS,
    icon: icons.finaleIcon,
    cast: (c) => c.world.addEffect(new GrandFinale(c.world, c)),
  },
  'puppeteer:weaver': {
    name: 'Puppet Master',
    cost: 75,
    windup: 600,
    aim: 'self',
    pal: SILK_STRINGS,
    icon: icons.puppetMasterIcon,
    cast: (c) => c.world.addEffect(new PuppetMaster(c.world, c)),
  },
};

/** Skins' takes on their type's Special, by `class:skin`. */
const SKINS: Record<string, UltSkin> = {
  'wizard:void': { name: 'Event Horizon', pal: pal(0xfff0ff, 0xffa8f4, 0xd05cf0, 0x6a2fd0, 0xc47cff) },
  'warrior:jade': { name: 'Jade Heavensblade', pal: pal(0xf6fff0, 0xb6ffb0, 0x3fd98a, 0x16806a, 0x70f0b0) },
  'jedi:sith': { name: 'Crimson Cyclone', pal: pal(0xfff6f2, 0xff7a70, 0xf0283a, 0x8a1020, 0xff4a4a) },
  'alchemist:witch': { name: 'Hex Storm', pal: toxPal(HEX_TOX) },
  'archer:storm': { name: 'Thunder Arrow', pal: pal(0xf2fbff, 0xa8e4ff, 0x5ec8ff, 0x3a6ad8, 0x8ad8ff) },
  'chronomancer:moon': { name: 'Moonstill', pal: MOON_PAL },
  'chronomancer:aeon': { name: 'Aeon Legion', pal: AEON_PAL, type: 'paradox' },
  'bard:wildsong': { name: 'Chorus of the Wild', pal: pal(0xfffde6, 0xeaffa0, 0x9ee85a, 0x2e7a3e, 0xb8f070) },
  'puppeteer:porcelain': { name: 'Shattered Finale', pal: ICE_STRINGS },
  'puppeteer:crimson': { name: 'Strings of Fate', pal: FATE_STRINGS, type: 'weaver' },
};

/** The Special as worn: its def, and its name, colours and icon for this look. */
export interface WornUlt {
  def: UltDef;
  name: string;
  pal: Pal;
  icon: string;
}

const iconKey = (cls: string, look: string) => `ult_icon_${cls}_${look}`;

export function ultFor(ch: CharacterDef): WornUlt {
  const def = ULTS[`${ch.id}:${ch.type.id}`] ?? ULTS['wizard:arcane'];
  const skin = ch.skin ? SKINS[`${ch.id}:${ch.skin.id}`] : undefined;
  return { def, name: skin?.name ?? def.name, pal: skin?.pal ?? def.pal, icon: iconKey(ch.id, ch.look) };
}

/** Paint every Special's icon, in every look, once. */
export function ensureUltIcons(scene: Phaser.Scene): void {
  const add = (key: string, def: UltDef, p: Pal) => {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(16, 16);
    img.data.set(icons.paintIcon(def.icon, p));
    ctx.putImageData(img, 0, 0);
    scene.textures.addCanvas(key, c);
  };
  for (const [k, def] of Object.entries(ULTS)) {
    const [cls, type] = k.split(':');
    add(iconKey(cls, type), def, def.pal);
  }
  for (const [k, skin] of Object.entries(SKINS)) {
    const [cls, id] = k.split(':');
    // A skin belongs to its class's base type unless it names another.
    const def = skin.type ? ULTS[`${cls}:${skin.type}`] : Object.entries(ULTS).find(([u]) => u.startsWith(`${cls}:`))?.[1];
    if (def) add(iconKey(cls, id), def, skin.pal);
  }
}

const HEAD = 44;

/**
 * Casts the worn Special: waits for the hero to finish what they're doing,
 * spends the energy, holds them in a gathering pose, then unleashes it.
 */
export class UltCaster {
  readonly ult: WornUlt;
  private t = -1;
  private released = false;
  private pending: { aim: Aim | null; facing: { x: number; y: number }; left: number } | null = null;
  private cast: Cast | null = null;
  private frames: string[] = [];
  private paused = false;
  private layers: Phaser.GameObjects.Sprite[] | null = null;
  private overlay: Phaser.GameObjects.Sprite;
  private rune: Ink;
  private lamp: Phaser.GameObjects.Light;
  private title: Phaser.GameObjects.BitmapText | null = null;
  private moteT = 0;
  private nagT = 0;
  /** Told each time the Special is cast (online, so the other players see it too). */
  onCast: ((aim: Aim | null, facing: { x: number; y: number }) => void) | null = null;

  constructor(
    private world: WorldScene,
    private hero: Hero,
    private ch: CharacterDef,
  ) {
    this.ult = ultFor(ch);
    this.overlay = world.add.sprite(0, 0, hero.sprite.texture.key).setBlendMode(Phaser.BlendModes.ADD).setTint(this.ult.pal.hot).setVisible(false);
    this.rune = new Ink(world, 80, 50);
    this.lamp = world.lights.addLight(0, 0, 90, this.ult.pal.light, 0);
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get cost(): number {
    return this.ult.def.cost;
  }

  /** The hero is gathering power (or about to): the world holds back their other abilities. */
  get holding(): boolean {
    return this.t >= 0 || this.pending !== null;
  }

  /** The hero is held in the pose and can't walk. */
  get rooted(): boolean {
    return this.t >= 0 && this.t < this.ult.def.windup + (this.ult.def.hold ?? 0);
  }

  /** C or the Special button: cast once the hero is free, if there's energy for it. `facing` is the way they last walked, for when nothing is aimed at. */
  request(aim: Aim | null, facing: { x: number; y: number }): void {
    if (this.t >= 0) return;
    if (!energy.ready) {
      if (this.nagT <= 0) {
        this.nagT = 900;
        this.world.popNumber(Math.round(this.hero.x), Math.round(this.hero.y) - 40, 'NEED ENERGY', 0x9aa4c8);
      }
      return;
    }
    this.pending = { aim, facing, left: 700 };
  }

  cancel(): void {
    this.pending = null;
    if (this.t >= 0) this.finish();
  }

  update(dt: number): void {
    this.nagT -= dt;
    const pend = this.pending;
    if (pend) {
      pend.left -= dt;
      const key = this.hero.sprite.anims.currentAnim?.key ?? '';
      if (/_(idle|walk)_/.test(key)) {
        this.pending = null;
        this.start(pend.aim, pend.facing);
      } else if (pend.left <= 0) this.pending = null;
    }
    if (this.t < 0) return;
    this.t += dt;
    const def = this.ult.def;
    const p = this.ult.pal;
    const h = this.hero;
    const t = this.t;
    const W = def.windup;
    const pose = W + (def.hold ?? 0);

    if (t < pose) this.pose(t / W);
    else if (this.paused) this.unpose();
    if (!this.released && t >= W) this.release();

    // Power gathering: the body lit from within, a rune under the feet, motes drawn up round them.
    const g = Math.min(1, t / W);
    const glow = t < W ? 0.25 + 0.5 * g * (0.8 + 0.2 * Math.sin(t * 0.03)) : Math.max(0, 0.75 * (1 - (t - W) / 250));
    const body = h.sprite;
    this.overlay
      .setVisible(glow > 0.01)
      .setTexture(body.texture.key, body.frame.name)
      .setOrigin(body.originX, body.originY)
      .setPosition(body.x, body.y)
      .setFlipX(body.flipX)
      .setDepth(body.depth + 0.05)
      .setAlpha(glow * h.alpha);
    const r = this.rune.begin(h.x, h.y, 2.6);
    const open = t < W ? easeOut(t / (W * 0.7)) : 1 - Math.min(1, (t - W) / 300);
    rune(r, h.x, h.y, 22 * open, t * 0.006, p, open);
    if (t < W) ring(r, h.x, h.y, 26 * (1 - g) + 4, 1, p, g);
    r.end();
    this.lamp.setPosition(h.x, h.y - 12);
    this.lamp.intensity = 2.4 * (t < W ? g : Math.max(0, 1 - (t - W) / 400));
    this.moteT -= dt;
    if (t < W && this.moteT <= 0) {
      this.moteT = 45;
      const a = Math.random() * Math.PI * 2;
      this.world.debris(p.tints, h.x + Math.cos(a) * 14, h.y - 2 + Math.sin(a) * 6, 1, h.y + 2, 'spores');
    }
    this.title?.setPosition(Math.round(h.x), Math.round(h.y) - HEAD - Math.round(4 * easeOut(g)));

    if (t >= pose + 400) this.finish();
  }

  private start(aim: Aim | null, facing: { x: number; y: number }): void {
    if (!energy.spend()) return;
    this.onCast?.(aim, facing);
    const def = this.ult.def;
    const h = this.hero;
    let dx = aim?.x ?? facing.x;
    let dy = aim?.y ?? facing.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    let tx = h.x;
    let ty = h.y;
    if (def.aim === 'spot') {
      const range = def.range ?? 100;
      const r = aim?.dist !== undefined ? Phaser.Math.Clamp(aim.dist, 24, range) : range * 0.65;
      // A mouse (or an auto-aimed foe) is measured from the chest; its spot on the ground is lower.
      const lift = aim?.dist !== undefined ? -14 + 10 : 0;
      for (let d = r; d >= 0; d -= 4) {
        tx = h.x + dx * d;
        ty = h.y + lift + dy * d;
        if (this.world.walkable(tx, ty)) break;
      }
    }
    this.cast = { world: this.world, hero: h, x: h.x, y: h.y, dx, dy, tx, ty, pal: this.ult.pal, look: this.ch.look };
    this.t = 0;
    this.released = false;

    // The pose: the look's big casting animation, turned the way it's aimed.
    const dir = dirOf(dx, dy);
    const anim = this.world.anims.get(this.ch.preview.chosen.replace(/_down$/, `_${dir}`)) ?? this.world.anims.get(this.ch.preview.chosen);
    this.frames = anim ? anim.frames.map((f) => String(f.textureFrame)) : [];
    if (!this.layers) {
      // The body's glow and sun-shadow layers use the same frames, from their own textures.
      const body = h.sprite;
      const find = (key: string) =>
        this.world.children.list
          .filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && o.texture.key === key)
          .sort((a, b) => Math.hypot(a.x - body.x, a.y - body.y) - Math.hypot(b.x - body.x, b.y - body.y))[0];
      this.layers = [find(`${body.texture.key}_e`), find(`${body.texture.key}_s`)].filter((s) => !!s);
    }
    this.world.evade(def.windup + (def.hold ?? 0) + 150);
    sound.ultCharge(def.windup / 1000);

    this.title?.destroy();
    this.title = this.world.add
      .bitmapText(Math.round(h.x), Math.round(h.y) - HEAD, 'pixel', this.ult.name.toUpperCase())
      .setLetterSpacing(-1)
      .setOrigin(0.5, 1)
      .setTint(this.ult.pal.hot)
      .setDepth(10003)
      .setAlpha(0);
    this.world.tweens.add({ targets: this.title, alpha: 1, duration: 180 });
  }

  /** Hold the hero in the casting pose: its frames play through the windup, then hold at their height. */
  private pose(k: number): void {
    const body = this.hero.sprite;
    if (body.anims.isPlaying) {
      body.anims.pause();
      this.paused = true;
    }
    const n = this.frames.length;
    if (!n) return;
    const name = this.frames[Math.min(n - 1, Math.floor(Math.min(1, k) * Math.max(1, n * 0.75)))];
    if (!body.texture.has(name)) return;
    body.setFrame(name);
    for (const s of this.layers ?? []) if (s.texture.has(name)) s.setFrame(name);
  }

  private unpose(): void {
    const body = this.hero.sprite;
    if (this.paused && body.anims.currentAnim) body.anims.resume();
    this.paused = false;
  }

  private release(): void {
    this.released = true;
    const c = this.cast!;
    const w = this.world;
    const p = this.ult.pal;
    const h = this.hero;
    c.x = h.x;
    c.y = h.y;
    if (this.ult.def.aim === 'self') {
      c.tx = h.x;
      c.ty = h.y;
    }
    sound.ultRelease(w.pan(h.x));
    w.cameras.main.shake(140, 0.0018);
    w.debris(p.tints, h.x, h.y - 14, 16, h.y + 20, 'burst');
    flare(w, h.x, h.y - 14, 150, p.light, 3, 500);
    bloom(w, h.x, h.y - 14, p.hot, 2.4, 320, h.y + 20);
    w.addEffect(new Shock(w, h.x, h.y, p));
    this.ult.def.cast(c);
    if (this.title) {
      const title = this.title;
      this.title = null;
      w.tweens.add({ targets: title, y: title.y - 10, alpha: 0, delay: 350, duration: 650, ease: 'Sine.In', onComplete: () => title.destroy() });
    }
  }

  private finish(): void {
    this.unpose();
    this.t = -1;
    this.overlay.setVisible(false);
    this.rune.begin(0, 0, 0).end();
    this.lamp.intensity = 0;
    this.title?.destroy();
    this.title = null;
  }

  private destroy(): void {
    this.overlay.destroy();
    this.rune.destroy();
    this.title?.destroy();
  }
}

/** The ring of force that bursts off the hero as a Special is unleashed. */
class Shock extends Fx {
  private pix: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private p: Pal,
  ) {
    super(world, 320);
    this.pix = this.ink(90, 56);
  }

  protected step(): void {
    const k = this.t / 320;
    const g = this.pix.begin(this.x, this.y, 2.7);
    ring(g, this.x, this.y, 4 + 36 * easeOut(k), 2.5 * (1 - k) + 0.8, this.p, 1 - k);
    g.end();
  }
}

/**
 * Energy leaving a slain foe: motes of light burst from the body, then home
 * in on the hero and are soaked up, filling the Special's ring.
 */
export class EnergyMotes extends Fx {
  private motes: { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; gone: boolean }[] = [];
  private share: number;
  private left: number;

  constructor(
    world: WorldScene,
    x: number,
    y: number,
    private hero: Hero,
    amount: number,
    private p: Pal,
  ) {
    super(world, 2200);
    const n = Math.max(3, Math.min(10, Math.round(amount / 3)));
    this.share = amount / n;
    this.left = n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const s = 50 + Math.random() * 40;
      const img = this.own(world.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? p.hot : p.core).setScale(0.22).setDepth(9500));
      this.motes.push({ img, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, gone: false });
    }
  }

  protected step(dt: number): void {
    const s = dt / 1000;
    const hx = this.hero.x;
    const hy = this.hero.y - 14;
    const pull = Math.min(1, this.t / 350);
    for (const m of this.motes) {
      if (m.gone) continue;
      const dx = hx - m.x;
      const dy = hy - m.y;
      const d = Math.hypot(dx, dy) || 1;
      // Drift apart at first, then fall in faster and faster.
      const acc = 900 * pull;
      m.vx += (dx / d) * acc * s;
      m.vy += (dy / d) * acc * s;
      const drag = Math.exp(-dt / (pull < 1 ? 180 : 400));
      m.vx *= drag;
      m.vy *= drag;
      m.x += m.vx * s;
      m.y += m.vy * s;
      m.img.setPosition(Math.round(m.x), Math.round(m.y)).setScale(0.18 + 0.06 * bump((this.t % 300) / 300));
      if (Math.floor(this.t / 40) !== Math.floor((this.t - dt) / 40)) this.world.debris([this.p.hot, this.p.mid], m.x, m.y, 1, 9500, 'trail');
      if (d < 7 || this.t > 1800) this.soak(m);
    }
    if (this.left <= 0) this.destroy();
  }

  private soak(m: { img: Phaser.GameObjects.Image; gone: boolean }): void {
    m.gone = true;
    m.img.setVisible(false);
    this.left--;
    const h = this.hero;
    this.world.debris([this.p.core, this.p.hot], h.x, h.y - 14, 2, h.y + 20, 'gather');
    sound.energy(this.world.pan(h.x));
    if (energy.gain(this.share)) {
      this.world.popNumber(Math.round(h.x), Math.round(h.y) - 42, 'SPECIAL READY', this.p.hot);
      this.world.debris(this.p.tints, h.x, h.y - 14, 18, h.y + 20, 'burst');
      sound.ultReady();
    }
  }
}
