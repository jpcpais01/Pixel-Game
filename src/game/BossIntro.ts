import Phaser from 'phaser';
import { pixelGrid, snap } from './display';
import { sound } from '../audio';
import { collection } from './collection';
import { bandBitmap, dividerBitmap, titleBitmap, titleWidth, type TitleColours } from '../art/bossTitle';
import { hex } from '../art/pixel';
import type { Monster } from './monsters';
import type { WorldScene } from '../scenes/WorldScene';

/** A boss's name and epithet on its title card, and its colours, bright to deep. */
interface BossTitle {
  name: string;
  epithet: string;
  light: number;
  mid: number;
  dark: number;
}

/** Every boss's title card, by monster key. A boss without one simply walks on. */
export const BOSS_TITLES: Record<string, BossTitle> = {
  wyrm: { name: 'Amethrax', epithet: 'The Geode Wyrm', light: 0xf2e4ff, mid: 0xb37aff, dark: 0x4e2496 },
  warden: { name: 'Astral Warden', epithet: 'Keeper of the Fallen Stars', light: 0xf4f6ff, mid: 0x8aa0ff, dark: 0x27348e },
  queen: { name: 'Hollow Queen', epithet: 'Sovereign of the Restless Dead', light: 0xeafffa, mid: 0x5ae8d0, dark: 0x16606e },
  sporemother: { name: 'Sporemother', epithet: 'Heart of the Glimmerdeep', light: 0xffe4f8, mid: 0xff6ad8, dark: 0x781c68 },
  elementinho: { name: 'Elementinho', epithet: 'The Drop That Burns', light: 0xfff2b0, mid: 0xffa22c, dark: 0x9c2c0c },
  pumpkin_king: { name: 'Pumpkin King', epithet: "Lord of Hallow's Eve", light: 0xffe6a0, mid: 0xff8a30, dark: 0x7e2a0a },
  // The Aurora Colosseum's five.
  vargr: { name: 'Vargr', epithet: 'The Winterfang', light: 0xf0f8ff, mid: 0x8ac8ff, dark: 0x2a4a8a },
  snowqueen: { name: 'Snow Queen', epithet: 'Mistress of the Frozen Mirror', light: 0xf4fcff, mid: 0x9ae8ff, dark: 0x2a5aa0 },
  winterking: { name: 'Kaldr', epithet: 'The Lich of the Long Winter', light: 0xeef4ff, mid: 0x9ab0ff, dark: 0x3a2a8a },
  colossus: { name: 'Ymir', epithet: 'The Glacier Colossus', light: 0xeafcff, mid: 0x6ad0f4, dark: 0x1a4a7a },
  aurelith: { name: 'Aurelith', epithet: 'Serpent of the Northern Lights', light: 0xeafff4, mid: 0x5affb0, dark: 0x5a2aa0 },
};

const rgb = (c: number): [number, number, number] => hex(`#${c.toString(16).padStart(6, '0')}`);
const colours = (t: BossTitle): TitleColours => ({ light: rgb(t.light), mid: rgb(t.mid), dark: rgb(t.dark) });

/** A boss meets the hero this close, or from further once it has noticed them (world px). */
const CLOSE_RANGE = 120;
const MEET_RANGE = 300;
/** The entrance's beats, in ms: the camera glides to the boss, it shows its move, its name comes up. */
const PAN_IN = 650;
const SHOW_AT = 520;
const CARD_AT = 950;
/** When the entrance starts to close, by rank (a Myth's lingers), and how long closing takes. */
const HOLD = { legend: 2500, myth: 3100 };
const CLOSE = 550;
/** A tap or key skips it, once it has been playing this long (so a tap already on its way doesn't). */
const SKIP_AFTER = 350;
/** The black bars top and bottom, in art px, by rank. */
const BARS = { legend: 14, myth: 20 };
/** Over the boss's health bar, under nothing. */
const DEPTH = 10006;

const smooth = (t: number) => {
  const k = Phaser.Math.Clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
};
const easeOut = (t: number) => 1 - Math.pow(1 - Phaser.Math.Clamp(t, 0, 1), 3);

/**
 * The first time the hero meets a boss (once per account), it makes an
 * entrance: black bars close in, the camera glides over to it, it turns to
 * the hero and shows off its signature move with a boom that shakes the
 * ground, and its title card comes up under it: its rank, its name in big
 * bevelled letters of its own colours, forged in with a flash, a gilded
 * divider and its epithet. About three seconds (a Myth's a little longer),
 * and a tap or a key skips it.
 *
 * While it plays the hero stands and can't be hurt. Alone, the world holds
 * still round it (see WorldScene's update); online it is this player's own
 * moment and the fight goes on for everyone else.
 */
export class BossIntro {
  private boss: Monster | null = null;
  private title!: BossTitle;
  private myth = false;
  private t = 0;
  private end = 0;
  /** How far the camera had turned to the boss when the entrance began to close. */
  private from = 1;
  private shown = false;
  private carded = false;
  private heroX = 0;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private bars: Phaser.GameObjects.Image[] = [];
  private band!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private name!: Phaser.GameObjects.Image;
  private hot!: Phaser.GameObjects.Image;
  private divider!: Phaser.GameObjects.Image;
  private rank!: Phaser.GameObjects.BitmapText;
  private epithet!: Phaser.GameObjects.BitmapText;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Shockwaves along the ground from the boss's feet, and the flare at its heart. */
  private rings: { img: Phaser.GameObjects.Image; age: number; delay: number; size: number }[] = [];
  private flare: Phaser.GameObjects.Image | null = null;
  private onKey = (e: KeyboardEvent) => {
    if (!e.repeat) this.skip();
  };
  private onTap = () => this.skip();

  constructor(
    private world: WorldScene,
    /** Alone the world holds still; online it doesn't. */
    private freeze: boolean,
  ) {}

  get active(): boolean {
    return this.boss !== null;
  }

  /** Should the world hold still this frame? */
  get freezes(): boolean {
    return this.active && this.freeze;
  }

  /** Where the camera should look, and how far it has turned there from the hero (0..1); null when nothing plays. */
  get focus(): { x: number; y: number; k: number } | null {
    const b = this.boss;
    if (!b) return null;
    const k = this.t < this.end ? smooth(this.t / PAN_IN) : this.from * (1 - smooth((this.t - this.end) / CLOSE));
    // The boss stands a little above the middle, with room for its card below.
    return { x: b.x, y: b.y - b.bodyY + 18, k };
  }

  /** Look for a boss meeting the hero for the first time, and let it make its entrance. */
  check(monsters: Monster[], hero: { x: number; y: number }, ready: boolean): void {
    if (this.boss || !ready) return;
    for (const m of monsters) {
      if (!m.boss || !m.stats.rank || !m.alive || m.summoned) continue;
      const title = BOSS_TITLES[m.stats.key];
      if (!title || collection.metBoss(m.stats.key)) continue;
      const d = Math.hypot(m.x - hero.x, m.y - hero.y);
      const roused = m.state !== 'idle' && m.state !== 'wander' && m.state !== 'return';
      if (d < CLOSE_RANGE || (roused && d < MEET_RANGE)) {
        this.start(m, title, hero.x);
        return;
      }
    }
  }

  private start(m: Monster, title: BossTitle, heroX: number): void {
    const w = this.world;
    this.boss = m;
    this.title = title;
    this.myth = m.stats.rank === 'myth';
    this.heroX = heroX;
    this.t = 0;
    this.end = HOLD[this.myth ? 'myth' : 'legend'];
    this.from = 1;
    this.shown = this.carded = false;
    collection.meetBoss(m.stats.key);

    const c = colours(title);
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Visible>(o: T, depth = 0): T => {
      o.setScrollFactor(0).setDepth(DEPTH + depth).setVisible(false);
      this.parts.push(o as unknown as Phaser.GameObjects.GameObject);
      return o;
    };
    this.bars = [0, 1].map(() => fixed(w.add.image(0, 0, '__WHITE').setOrigin(0).setTint(0x05040c)));
    if (!w.textures.exists('boss_band')) w.textures.addCanvas('boss_band', bandBitmap(64).toCanvas());
    this.band = fixed(w.add.image(0, 0, 'boss_band').setOrigin(0.5));
    this.glow = fixed(w.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(title.mid), 1);

    // The name as big as the screen allows: three pixels to a font pixel for a Myth, two for a Legend, one on a very narrow screen.
    const room = this.viewW() - 16;
    const name = title.name.toUpperCase();
    const s = [this.myth ? 3 : 2, 2, 1].find((k) => titleWidth(name, k) <= room) ?? 1;
    const nameKey = `boss_name_${m.stats.key}_${s}`;
    if (!w.textures.exists(nameKey)) w.textures.addCanvas(nameKey, titleBitmap(name, c, s).toCanvas());
    this.name = fixed(w.add.image(0, 0, nameKey).setOrigin(0), 2);
    this.hot = fixed(w.add.image(0, 0, nameKey).setOrigin(0).setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD), 3);
    const dw = Math.min(Math.round(room), Math.max(this.name.width + 40, 150));
    const divKey = `boss_div_${m.stats.key}_${dw}`;
    if (!w.textures.exists(divKey)) w.textures.addCanvas(divKey, dividerBitmap(dw, c, this.myth).toCanvas());
    this.divider = fixed(w.add.image(0, 0, divKey).setOrigin(0), 2);
    this.rank = fixed(w.add.bitmapText(0, 0, 'pixel', this.myth ? 'MYTH' : 'LEGEND').setOrigin(0.5, 1).setTint(this.myth ? title.light : 0xf4cf6a), 2);
    this.epithet = fixed(w.add.bitmapText(0, 0, 'pixel', title.epithet.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 0).setTint(title.light), 2);
    // Motes of the boss's colour drifting up through the card.
    this.motes = fixed(
      w.add.particles(0, 0, 'spark', {
        lifespan: { min: 900, max: 1600 },
        speedY: { min: -16, max: -5 },
        speedX: { min: -4, max: 4 },
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.9 },
        tint: [0xffffff, title.light, title.mid],
        blendMode: Phaser.BlendModes.ADD,
        frequency: this.myth ? 40 : 70,
        emitting: false,
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.name.width / 2, -14, this.name.width, 22) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      }),
      1,
    );

    // Play a key or tap the screen to skip.
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerdown', this.onTap);
  }

  private skip(): void {
    // Not while the game is paused over it, nor twice.
    if (!this.boss || !this.world.scene.isActive() || this.t < SKIP_AFTER || this.t >= this.end) return;
    this.close();
  }

  /** Begin closing now, the camera easing back from wherever it had come to. */
  private close(): void {
    this.from = smooth(this.t / PAN_IN);
    this.end = this.t;
  }

  private viewW(): number {
    return this.world.scale.width / pixelGrid.zoom;
  }

  /** `dt` is real time: the entrance runs at its own pace, whatever the world's. */
  update(dt: number): void {
    const b = this.boss;
    if (!b) return;
    // The boss gone (online, slain by another player): close at once.
    if ((!b.alive || b.dead) && this.t < this.end) this.close();
    this.t += dt;
    const t = this.t;
    const w = this.world;

    if (!this.shown && t >= SHOW_AT && t < this.end) {
      this.shown = true;
      this.showOff(b);
    }
    if (!this.carded && t >= CARD_AT && t < this.end) {
      this.carded = true;
      sound.bossTitle(this.myth);
      this.motes.emitting = true;
    }
    this.updateRings(dt);

    // Everything on screen, placed in art pixels from the screen's centre (the zoom pivots there).
    const { width, height } = w.scale;
    const z = pixelGrid.zoom;
    const vw = width / z;
    const vh = height / z;
    const cx = width / 2;
    const cy = height / 2;
    const closing = t >= this.end ? smooth((t - this.end) / (CLOSE * 0.8)) : 0;
    const open = 1 - closing;

    // The bars slide in from the edges, and back out as it closes.
    const barH = BARS[this.myth ? 'myth' : 'legend'];
    const bars = Math.min(easeOut(t / 420), open);
    const bh = Math.round(barH * bars);
    this.bars[0].setVisible(bh > 0).setPosition(cx - vw / 2 - 2, cy - vh / 2 - 2).setDisplaySize(vw + 4, bh + 2);
    this.bars[1].setVisible(bh > 0).setPosition(cx - vw / 2 - 2, cy + vh / 2 - bh).setDisplaySize(vw + 4, bh + 2);

    const c = t - CARD_AT;
    const card = this.carded ? Phaser.Math.Clamp(c / 250, 0, 1) * open : 0;
    const vis = card > 0;
    for (const o of [this.band, this.glow, this.name, this.hot, this.divider, this.rank, this.epithet]) o.setVisible(vis);
    if (closing > 0) this.motes.emitting = false;
    const cardY = Math.round(vh * 0.19) - (closing > 0 ? Math.round(closing * 3) : 0);
    const nh = this.name.height;
    const nw = this.name.width;
    const nameTop = cardY - Math.round(nh / 2);
    this.motes.setPosition(cx, cy + cardY + 6);
    if (!vis) return;

    this.band.setPosition(cx, cy + cardY + 5).setDisplaySize(vw + 4, this.myth ? 76 : 64).setAlpha(card);
    // A slow breath of the boss's colour behind its name.
    const pulse = 0.8 + Math.sin(t * 0.004) * 0.2;
    this.glow.setPosition(cx, cy + cardY).setScale(Math.max(3, nw / 18), this.myth ? 2.2 : 1.7).setAlpha(0.28 * card * pulse);

    // The rank: tracked out wide, drawing in as it fades up. A Myth's shimmers.
    const rk = easeOut(c / 380);
    this.rank.setLetterSpacing(Math.round(5 - 4 * rk)).setPosition(Math.round(cx), cy + nameTop - 2).setAlpha(rk * open);
    if (this.myth) this.rank.setTint(Phaser.Display.Color.GetColor(...lerpRgb(this.title.light, 0xffffff, 0.5 + Math.sin(t * 0.008) * 0.5)));

    // The name is forged in: wiped on from left to right, white-hot, cooling to its colours.
    const wipe = easeOut((c - 120) / 420);
    const left = Math.round(cx - nw / 2);
    this.name.setPosition(left, cy + nameTop).setCrop(0, 0, Math.round(nw * wipe), nh).setAlpha(open);
    const heat = c < 540 ? 0.95 : 0.95 * (1 - Phaser.Math.Clamp((c - 540) / 520, 0, 1));
    this.hot.setPosition(left, cy + nameTop).setCrop(0, 0, Math.round(nw * wipe), nh).setAlpha(heat * open);

    // The divider grows out from its gem.
    const dw = this.divider.width;
    const grow = easeOut((c - 60) / 520);
    const gw = Math.round(dw * grow);
    const divTop = nameTop + nh + 1;
    this.divider.setPosition(Math.round(cx - dw / 2), cy + divTop).setCrop(Math.round((dw - gw) / 2), 0, gw, this.divider.height).setAlpha(open);

    // The epithet rises into place last.
    const ep = easeOut((c - 480) / 420);
    this.epithet.setPosition(Math.round(cx), cy + divTop + this.divider.height + 1 + Math.round((1 - ep) * 3)).setAlpha(ep * open);

    if (t >= this.end + CLOSE) this.finish();
  }

  /** The boss's signature move, for show: it turns to the hero, the ground shakes, rings roll out from its feet. */
  private showOff(b: Monster): void {
    const w = this.world;
    b.entrance(this.heroX);
    sound.bossRoar(w.pan(b.x), this.myth);
    w.cameras.main.shake(this.myth ? 650 : 450, this.myth ? 0.005 : 0.003);
    const tints = [0xffffff, this.title.light, this.title.mid, this.title.dark];
    w.debris(tints, snap(b.x), snap(b.y - b.bodyY), this.myth ? 40 : 28, b.y + 40, 'spores');
    const n = this.myth ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const img = w.add.image(snap(b.x), snap(b.y), 'loot_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? this.title.mid : this.title.light).setDepth(1.3).setAlpha(0);
      this.rings.push({ img, age: 0, delay: i * 150, size: (this.myth ? 4.2 : 3) * (1 - i * 0.15) * Math.max(1, b.radius / 14) });
    }
    this.flare = w.add.image(snap(b.x), snap(b.y - b.bodyY), 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(this.title.light).setDepth(b.y + 5).setAlpha(0);
  }

  private updateRings(dt: number): void {
    for (const r of this.rings) {
      r.age += dt;
      const k = (r.age - r.delay) / 850;
      if (k < 0) continue;
      r.img.setScale(0.4 + easeOut(k) * r.size).setAlpha(0.9 * (1 - Phaser.Math.Clamp(k, 0, 1)));
    }
    this.rings = this.rings.filter((r) => {
      if (r.age - r.delay < 850) return true;
      r.img.destroy();
      return false;
    });
    if (this.flare) {
      const k = (this.t - SHOW_AT) / 700;
      if (k >= 1) {
        this.flare.destroy();
        this.flare = null;
      } else this.flare.setScale(3 + k * (this.myth ? 5 : 3.5)).setAlpha(0.85 * (1 - k));
    }
  }

  private finish(): void {
    this.boss = null;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onTap);
    for (const o of this.parts) o.destroy();
    this.parts = [];
    this.bars = [];
  }

  destroy(): void {
    this.finish();
    for (const r of this.rings) r.img.destroy();
    this.rings = [];
    this.flare?.destroy();
    this.flare = null;
  }
}

const lerpRgb = (a: number, b: number, t: number): [number, number, number] => {
  const ca = Phaser.Display.Color.IntegerToRGB(a);
  const cb = Phaser.Display.Color.IntegerToRGB(b);
  return [Math.round(ca.r + (cb.r - ca.r) * t), Math.round(ca.g + (cb.g - ca.g) * t), Math.round(ca.b + (cb.b - ca.b) * t)];
};

/** The slow motion's shape: a near-freeze on impact, then a long slow drift, then time eases back. */
const HIT_STOP = 110;
const SLOW = { legend: 650, myth: 900 };
const EASE_BACK = 450;

/**
 * The killing blow on a Legend or a Myth: the world all but stops on the
 * impact under a white flash, lines of force rush in on the body, a ring of
 * its light bursts out, and time drifts slowly on before easing back to
 * normal. The world reads `pace` each frame and runs that much of it.
 */
export class FinalBlow {
  private t = 0;
  private slow: number;
  private flash: Phaser.GameObjects.Image;
  private lines: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Image;
  private ringAge = 0;

  constructor(
    private world: WorldScene,
    x: number,
    y: number,
    myth: boolean,
    tint: number,
  ) {
    this.slow = SLOW[myth ? 'myth' : 'legend'];
    sound.finalBlow(myth);
    this.flash = world.add.image(0, 0, '__WHITE').setOrigin(0).setScrollFactor(0).setDepth(DEPTH - 2).setBlendMode(Phaser.BlendModes.ADD).setTint(lerpColor(tint, 0xffffff, 0.6));
    // Speed lines rushing in on the body, drawn once and faded out.
    this.lines = world.add.graphics().setPosition(snap(x), snap(y)).setDepth(10001).setBlendMode(Phaser.BlendModes.ADD);
    const n = myth ? 26 : 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
      const ux = Math.cos(a);
      const uy = Math.sin(a) * 0.8;
      const r0 = 38 + Math.random() * 22;
      const r1 = 200 + Math.random() * 90;
      for (let r = r0; r < r1; r += 2) {
        const k = (r - r0) / (r1 - r0);
        this.lines.fillStyle(k < 0.2 ? tint : 0xffffff, 0.25 + 0.6 * Math.min(1, k * 2.5));
        const s = k > 0.55 ? 2 : 1;
        this.lines.fillRect(Math.round(ux * r), Math.round(uy * r), s, s);
      }
    }
    this.ring = world.add.image(snap(x), snap(y), 'loot_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(10000).setAlpha(0);
  }

  /** How much of each moment the world lives through right now (1 once it's over). */
  get pace(): number {
    const t = this.t;
    if (t < HIT_STOP) return 0.03;
    if (t < HIT_STOP + this.slow) return 0.22;
    return 0.22 + 0.78 * smooth((t - HIT_STOP - this.slow) / EASE_BACK);
  }

  get done(): boolean {
    return this.t >= HIT_STOP + this.slow + EASE_BACK;
  }

  /** `dt` is real time. */
  update(dt: number): void {
    this.t += dt;
    const w = this.world;
    const z = pixelGrid.zoom;
    const vw = w.scale.width / z;
    const vh = w.scale.height / z;
    const f = 1 - Phaser.Math.Clamp(this.t / 280, 0, 1);
    this.flash.setVisible(f > 0).setPosition(w.scale.width / 2 - vw / 2 - 2, w.scale.height / 2 - vh / 2 - 2).setDisplaySize(vw + 4, vh + 4).setAlpha(0.8 * f * f);
    const lk = Phaser.Math.Clamp(this.t / (HIT_STOP + this.slow), 0, 1);
    // They close in on the body as they fade.
    this.lines.setScale(1.2 - 0.2 * easeOut(lk)).setAlpha(1 - lk);
    // The ring rolls out at the world's own slowed pace.
    this.ringAge += dt * this.pace;
    const rk = Phaser.Math.Clamp(this.ringAge / 260, 0, 1);
    this.ring.setScale(0.5 + easeOut(rk) * 3.2).setAlpha(0.95 * (1 - rk));
  }

  destroy(): void {
    for (const o of [this.flash, this.lines, this.ring]) o.destroy();
  }
}

function lerpColor(a: number, b: number, t: number): number {
  return Phaser.Display.Color.GetColor(...lerpRgb(a, b, t));
}

/** A boss's own colour for its final blow's light (white for one without a title card). */
export function bossTint(kind: string): number {
  return BOSS_TITLES[kind]?.mid ?? 0xffe6a0;
}
