// Echoes of the fallen, in the world: a gravestone where each echo lies (see
// game/echoes.ts), with a cold soul flame on its candle and a faint rune.
// Walk up to one and the fallen player's hero rises as a ghost and lives its
// last few seconds again, as it did, then comes apart into light; its soul
// flies into the hero as a blessing in the player's name. Each grave blesses
// once a visit, and its flame goes out after.

import Phaser from 'phaser';
import { sound } from '../audio';
import { sunShadow } from '../game/Wizard';
import { snap } from '../game/display';
import { heroBuffs } from '../game/buffs';
import type { Hero } from '../game/characters';
import { blessingOf, EchoRecorder, loadEchoes, SAMPLE_MS, sendEcho, deviceTag, type EchoRecord, type EchoSample } from '../game/echoes';
import { GRAVE_FOOT, GRAVE_H, GRAVE_KINDS, GRAVE_W, GRAVE_WICK, FLAME_H, FLAME_W } from '../art/echoes';
import type { WorldScene } from '../scenes/WorldScene';

/** Graves shown in an arena at once. */
const MAX_GRAVES = 4;
/** Graves keep this far apart, and this far from where heroes start (px). */
const GRAVE_GAP = 30;
const SPAWN_GAP = 44;
/** The hero's feet this close to a grave wakes its echo (px). */
const TOUCH = 13;
/** The name over a grave shows from this far (px). */
const NAME_NEAR = 52;
/** The ghost fades in, and at the end comes apart, over these (ms). */
const GHOST_IN = 420;
const GHOST_OUT = 1000;
/** The soul's flight from the ghost to the hero (ms). */
const WISP_FLIGHT = 760;
/** Soul light: pale, cold blue. */
const SOUL = 0x7fd8ff;
const SOUL_PALE = 0xd8faff;
const SOUL_DEEP = 0x3a78c8;
const MOTES = [0xffffff, 0xd8faff, 0x7fd8ff];

interface Grave {
  rec: EchoRecord;
  x: number;
  y: number;
  stone: Phaser.GameObjects.Image;
  /** Its sun shadow, handed to the world's daylight once the stone has fully risen. */
  shadow: Phaser.GameObjects.Image | null;
  rune: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Sprite;
  halo: Phaser.GameObjects.Image;
  mist: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  /** Where the flame burns, in world px. */
  fx: number;
  fy: number;
  /** 0..1, rising out of the mist as it appears. */
  shown: number;
  /** Its echo has been woken this visit. */
  spent: boolean;
  /** How brightly its flame burns: flares as the echo wakes, then gutters out. */
  fire: number;
  moteT: number;
  seed: number;
}

/** A ghost reliving an echo, then its soul flying to the hero. */
interface Replay {
  grave: Grave;
  samples: EchoSample[];
  keys: string[];
  t: number;
  /** How long the moments last (ms). */
  span: number;
  body: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite;
  trails: Phaser.GameObjects.Sprite[];
  mist: Phaser.GameObjects.Image;
  moteT: number;
  /** Where the ghost last stood, for the soul to leave from. */
  gx: number;
  gy: number;
  wisp: { core: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Image; t: number; fx: number; fy: number; side: number; trailT: number } | null;
}

export class EchoGraves {
  private graves: Grave[] = [];
  private replay: Replay | null = null;
  private recorder = new EchoRecorder();
  /** One cold light for the whole ossuary: on the nearest lit grave, or the ghost. */
  private light: Phaser.GameObjects.Light;
  private dead = false;

  constructor(
    private world: WorldScene,
    private arena: string,
    private hero: Hero,
    private heroName: string,
    spawn: { x: number; y: number },
  ) {
    this.light = world.lights.addLight(0, 0, 60, SOUL, 0);
    loadEchoes(arena)
      .then((recs) => {
        if (!this.dead) this.place(recs, spawn);
      })
      .catch(() => {
        // No echoes this time.
      });
  }

  /** The hero fell: their last moments become an echo here, for others to find. */
  heroFell(x: number, y: number): void {
    const rec = this.recorder.fell(x, y, this.heroName);
    if (rec) sendEcho(this.arena, rec);
  }

  /** Choose which echoes lie here: other players' before the player's own, newest first, apart and on open ground. */
  private place(recs: EchoRecord[], spawn: { x: number; y: number }): void {
    const mine = deviceTag();
    const order = [...recs.filter((r) => r.by !== mine), ...recs.filter((r) => r.by === mine)];
    const w = this.world;
    for (const rec of order) {
      if (this.graves.length >= MAX_GRAVES) break;
      const { x, y } = rec;
      if (!w.walkable(x, y) || !w.walkable(x - 6, y) || !w.walkable(x + 6, y)) continue;
      if (Math.hypot(x - spawn.x, y - spawn.y) < SPAWN_GAP) continue;
      if (this.graves.some((g) => Math.hypot(g.x - x, g.y - y) < GRAVE_GAP)) continue;
      this.graves.push(this.raise(rec));
    }
  }

  private raise(rec: EchoRecord): Grave {
    const w = this.world;
    const x = Math.round(rec.x);
    const y = Math.round(rec.y);
    const kind = Math.abs(Math.floor(rec.t / 7)) % GRAVE_KINDS;
    const frame = `g${kind}`;
    const oy = GRAVE_FOOT / GRAVE_H;
    const stone = w.add.image(x, y, 'echo_grave', frame).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y).setAlpha(0);
    const shadow = sunShadow(w.add.image(x, y, 'echo_grave_s', frame).setOrigin(0.5, oy));
    const rune = w.add.image(x, y, 'echo_grave_e', frame).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setAlpha(0);
    const wick = GRAVE_WICK[kind];
    const fx = x - GRAVE_W / 2 + wick.x;
    const fy = y - GRAVE_FOOT + wick.y + 1;
    const flame = w.add
      .sprite(fx, fy, 'echo_flame_e', 'f0')
      .setOrigin(FLAME_W / 2 / FLAME_W, (FLAME_H - 1) / FLAME_H)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(y + 2)
      .setAlpha(0)
      .play({ key: 'echo_flame_burn', startFrame: Math.floor(Math.random() * 6) });
    const halo = w.add.image(fx, fy - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(SOUL).setScale(0.55).setDepth(y + 2.1).setAlpha(0);
    // A low, cold mist pooled about the mound.
    const mist = w.add.image(x, y + 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(SOUL_DEEP).setScale(1.5, 0.38).setDepth(y - 1).setAlpha(0);
    const name = w.add.bitmapText(x, y - GRAVE_FOOT - 3, 'pixel', rec.name.toUpperCase()).setLetterSpacing(-1).setOrigin(0.5, 1).setTint(SOUL_PALE).setDepth(10002).setAlpha(0);
    return { rec, x, y, stone, shadow, rune, flame, halo, mist, name, fx, fy, shown: 0, spent: false, fire: 1, moteT: Math.random() * 600, seed: Math.random() * 100 };
  }

  update(dt: number, time: number, down: boolean, hurt: boolean, daylight: number): void {
    const h = this.hero;
    if (!down) this.recorder.sample(dt, h.sprite, hurt);
    const night = 1 - daylight;
    let near: Grave | null = null;
    let nearD = Infinity;
    for (const g of this.graves) {
      g.shown = Math.min(1, g.shown + dt / 1400);
      if (g.shown >= 1 && g.shadow) {
        this.world.addShadow(g.shadow);
        g.shadow = null;
      }
      const e = Phaser.Math.Easing.Sine.Out(g.shown);
      const d = Math.hypot(h.x - g.x, h.y - g.y);
      // The flame breathes and gutters; brighter in the dark.
      const flick = 0.82 + Math.sin(time * 0.009 + g.seed) * 0.1 + Math.sin(time * 0.023 + g.seed * 3) * 0.08;
      g.stone.setAlpha(e);
      g.rune.setAlpha(e * (g.spent ? 0.25 : 0.55 + Math.sin(time * 0.0025 + g.seed) * 0.2));
      g.flame.setAlpha(e * g.fire).setScale(0.85 + g.fire * 0.15 + (g.fire > 1 ? (g.fire - 1) * 0.5 : 0));
      g.halo.setAlpha(e * Math.min(1, g.fire) * flick * (0.35 + night * 0.25));
      g.mist.setAlpha(e * (0.1 + night * 0.1 + Math.sin(time * 0.0012 + g.seed) * 0.04) * (g.spent ? 0.5 : 1));
      g.name.setAlpha(e * Phaser.Math.Clamp((NAME_NEAR - d) / 18, 0, 1) * (g.spent ? 0.45 : 0.9));
      // Now and then a mote of soul-light drifts up off the flame.
      if (!g.spent && g.shown >= 1) {
        g.moteT -= dt;
        if (g.moteT <= 0) {
          g.moteT = 500 + Math.random() * 700;
          this.world.debris(MOTES, g.fx + (Math.random() - 0.5) * 3, g.fy - 5, 1, g.y + 2, 'spores');
        }
      }
      if (!g.spent && g.fire > 0 && d < nearD) {
        nearD = d;
        near = g;
      }
      // Walked onto it: its echo wakes.
      if (!down && !g.spent && !this.replay && g.shown >= 1 && d < TOUCH) this.wake(g);
    }
    // Guttering out once its echo has passed.
    for (const g of this.graves) {
      if (!g.spent) continue;
      const r = this.replay;
      if (r?.grave === g && r.t < r.span) g.fire = Math.max(0.35, g.fire - dt / 900);
      else if (g.fire > 0) {
        g.fire = Math.max(0, g.fire - dt / 400);
        if (g.fire === 0) this.world.debris([0x5a6070, 0x8a90a0], g.fx, g.fy - 3, 5, g.y + 2, 'spores');
      }
    }
    this.updateReplay(dt, time);
    // The light: on the ghost while it walks, else the nearest burning grave.
    const r = this.replay;
    const L = this.light;
    // Once the ghost is gone the soul carries the light itself (see flyWisp).
    if (r?.wisp && r.t >= r.span + GHOST_OUT) return;
    if (r && r.t < r.span + GHOST_OUT) {
      const k = Math.min(1, r.t / GHOST_IN) * (r.t > r.span ? 1 - (r.t - r.span) / GHOST_OUT : 1);
      L.setPosition(r.gx, r.gy - 12);
      L.radius = 80;
      L.intensity = k * (0.7 + night * 0.9);
    } else if (near && nearD < 260) {
      const flick = 0.85 + Math.sin(time * 0.011 + near.seed) * 0.1 + Math.sin(time * 0.029 + near.seed) * 0.05;
      L.setPosition(near.fx, near.fy - 6);
      L.radius = 56;
      L.intensity = Phaser.Math.Easing.Sine.Out(near.shown) * Math.min(1, near.fire) * flick * (0.35 + night * 0.95);
    } else L.intensity = 0;
  }

  /** The hero touched a grave: the flame flares and the fallen hero rises, pale, where they stood seconds before the end. */
  private wake(g: Grave): void {
    g.spent = true;
    g.fire = 1.8;
    const w = this.world;
    const rec = g.rec;
    // Only the moments whose sheet and frame this build still has; a ghost from an older game may have fewer.
    const keys = rec.keys.map((k) => (w.textures.exists(k) ? k : ''));
    const samples = rec.samples.filter((s) => keys[s.key] && w.textures.get(keys[s.key]).has(s.frame));
    w.debris(MOTES, g.fx, g.fy - 4, 18, g.y + 2, 'burst');
    w.debris([SOUL_PALE, SOUL, SOUL_DEEP], g.x, g.y - 2, 14, g.y + 1, 'spores');
    sound.echoWake(w.pan(g.x));
    const first = samples[0];
    const make = (blend: number) => {
      const s = w.add.sprite(g.x, g.y, first ? keys[first.key] : 'glow', first?.frame).setOrigin(rec.ox, rec.oy).setAlpha(0).setBlendMode(blend);
      return s;
    };
    // The shade gives the figure its form; the glow over it makes it light; the trails linger behind it.
    const body = make(Phaser.BlendModes.NORMAL).setTint(0x4a6aa8);
    const glow = make(Phaser.BlendModes.ADD);
    // The legs thin away into nothing: bright at the head, dark (so unseen when added) at the feet.
    glow.setTint(SOUL_PALE, SOUL_PALE, 0x0c2238, 0x0c2238);
    const trails = [0, 1].map(() => make(Phaser.BlendModes.ADD).setTint(SOUL, SOUL, 0x08182a, 0x08182a));
    const mist = w.add.image(g.x, g.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(SOUL_DEEP).setScale(0.9, 0.26).setAlpha(0);
    if (!first) {
      // Nothing of them this game can draw: their soul rises straight from the grave.
      for (const s of [body, glow, ...trails]) s.setVisible(false);
    }
    this.replay = {
      grave: g,
      samples,
      keys,
      t: 0,
      span: first ? (samples.length - 1) * SAMPLE_MS : 300,
      body,
      glow,
      trails,
      mist,
      moteT: 0,
      gx: g.x,
      gy: g.y,
      wisp: null,
    };
  }

  /** Where the ghost stands `t` ms in (smoothly between samples), and the sample it shows. */
  private at(r: Replay, t: number): { x: number; y: number; s: EchoSample } {
    const n = r.samples.length;
    const f = Phaser.Math.Clamp(t / SAMPLE_MS, 0, n - 1);
    const i = Math.floor(f);
    const a = r.samples[i];
    const b = r.samples[Math.min(n - 1, i + 1)];
    const k = f - i;
    return { x: r.grave.x + a.x + (b.x - a.x) * k, y: r.grave.y + a.y + (b.y - a.y) * k, s: a };
  }

  private show(r: Replay, sprite: Phaser.GameObjects.Sprite, s: EchoSample): void {
    const key = r.keys[s.key];
    if (sprite.texture.key !== key || sprite.frame.name !== s.frame) sprite.setTexture(key, s.frame);
    sprite.setFlipX(s.flip);
  }

  private updateReplay(dt: number, time: number): void {
    const r = this.replay;
    if (!r) return;
    const w = this.world;
    r.t += dt;
    const has = r.samples.length > 0;
    if (has && r.t <= r.span + GHOST_OUT) {
      const live = Math.min(r.t, r.span);
      const p = this.at(r, live);
      // Floating a breath above the ground, bobbing.
      const bob = Math.sin(time * 0.005) * 1 - 1.5;
      const x = snap(p.x);
      const y = snap(p.y + bob);
      r.gx = p.x;
      r.gy = p.y;
      const fadeIn = Phaser.Math.Easing.Sine.Out(Math.min(1, r.t / GHOST_IN));
      // Coming apart: stretched up and thinned, drifting skyward as it fades.
      const out = r.t > r.span ? Phaser.Math.Easing.Sine.In((r.t - r.span) / GHOST_OUT) : 0;
      // A ghost's light isn't steady: now and then it catches, like a bad candle.
      const flick = Math.sin(time * 0.041) > 0.93 ? 0.55 : 1;
      const k = fadeIn * (1 - out) * flick;
      this.show(r, r.body, p.s);
      this.show(r, r.glow, p.s);
      const lift = out * 8;
      r.body.setPosition(x, y - lift).setDepth(p.y + 0.4).setScale(1 - out * 0.5, 1 + out * 0.35);
      r.glow.setPosition(x, y - lift).setDepth(p.y + 0.5).setScale(1 - out * 0.5, 1 + out * 0.35);
      r.body.setAlpha(0.42 * k, 0.42 * k, 0.04 * k, 0.04 * k);
      // Struck in those last moments: the blow shows again as a flush of red.
      if (p.s.hurt && out === 0) r.glow.setTint(0xffc0cc, 0xffc0cc, 0x2a0c18, 0x2a0c18);
      else r.glow.setTint(SOUL_PALE, SOUL_PALE, 0x0c2238, 0x0c2238);
      r.glow.setAlpha((0.62 + Math.sin(time * 0.007) * 0.08) * k);
      // Afterimages a few moments behind.
      r.trails.forEach((tr, j) => {
        const q = this.at(r, live - (j + 1) * SAMPLE_MS * 1.5);
        this.show(r, tr, q.s);
        tr.setPosition(snap(q.x), snap(q.y + bob) - lift).setDepth(q.y + 0.3).setScale(1 - out * 0.5, 1 + out * 0.35);
        tr.setAlpha((j ? 0.1 : 0.2) * k);
      });
      r.mist.setPosition(x, snap(p.y) + 1).setDepth(p.y - 0.5).setAlpha(0.32 * k);
      r.moteT -= dt;
      if (r.moteT <= 0 && out < 0.6) {
        r.moteT = 110;
        w.debris(MOTES, x + (Math.random() - 0.5) * 10, y - 4 - Math.random() * 18, 1, p.y + 1, 'spores');
      }
    }
    // The end of their moments: the ghost comes apart in a shiver of light.
    if (r.t - dt <= r.span && r.t > r.span) {
      w.debris(MOTES, r.gx, r.gy - 12, has ? 26 : 16, r.gy + 1, 'spores');
      w.debris([SOUL_PALE, SOUL], r.gx, r.gy - 10, 14, r.gy + 1, 'burst');
    }
    // Then the soul lifts out and flies to the hero.
    if (!r.wisp && r.t > r.span + GHOST_OUT * 0.55) {
      const core = w.add.image(r.gx, r.gy - 14, 'echo_wisp').setBlendMode(Phaser.BlendModes.ADD).setDepth(9501);
      const halo = w.add.image(r.gx, r.gy - 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(SOUL).setScale(0.6).setAlpha(0.7).setDepth(9500);
      r.wisp = { core, halo, t: 0, fx: r.gx, fy: r.gy - 14, side: Math.random() < 0.5 ? -1 : 1, trailT: 0 };
    }
    if (r.wisp && this.flyWisp(r, dt, time)) {
      this.bless(r.grave.rec);
      for (const o of [r.body, r.glow, ...r.trails, r.mist, r.wisp.core, r.wisp.halo]) o.destroy();
      this.replay = null;
    }
  }

  /** The soul rises, hangs a moment, then curves into the hero's chest. True once it arrives. */
  private flyWisp(r: Replay, dt: number, time: number): boolean {
    const wp = r.wisp!;
    wp.t += dt;
    const h = this.hero;
    const tx = h.x;
    const ty = h.y - 14;
    let x: number;
    let y: number;
    const RISE = 380;
    if (wp.t < RISE) {
      const k = Phaser.Math.Easing.Sine.Out(wp.t / RISE);
      x = wp.fx + Math.sin(time * 0.01) * 1.5;
      y = wp.fy - k * 12;
    } else {
      const k = Math.min(1, (wp.t - RISE) / WISP_FLIGHT);
      const e = k * k * (1.7 - 0.7 * k);
      const sx = wp.fx;
      const sy = wp.fy - 12;
      const dx = tx - sx;
      const dy = ty - sy;
      const d = Math.hypot(dx, dy) || 1;
      const bow = Math.min(30, d * 0.4) * wp.side * Math.sin(k * Math.PI);
      x = sx + dx * e - (dy / d) * bow;
      y = sy + dy * e + (dx / d) * bow;
      if (k >= 1) return true;
    }
    const pulse = 1 + Math.sin(time * 0.02) * 0.12;
    wp.core.setPosition(snap(x), snap(y)).setScale(pulse);
    wp.halo.setPosition(snap(x), snap(y)).setScale(0.6 * pulse).setAlpha(0.6 + Math.sin(time * 0.013) * 0.1);
    this.light.setPosition(x, y);
    this.light.radius = 50;
    this.light.intensity = 0.9;
    wp.trailT -= dt;
    if (wp.trailT <= 0) {
      wp.trailT = 28;
      this.world.debris(MOTES, x, y, 1, 9499, 'trail');
    }
    return false;
  }

  /** The soul reaches the hero: the blessing, in the fallen player's name. */
  private bless(rec: EchoRecord): void {
    const w = this.world;
    const h = this.hero;
    const def = blessingOf(rec);
    heroBuffs.add(def);
    const hx = snap(h.x);
    const hy = snap(h.y);
    w.popNumber(hx, hy - 40, def.name.toUpperCase(), def.tint);
    w.debris([0xffffff, SOUL_PALE, def.tint], hx, hy - 14, 24, h.y + 20, 'burst');
    w.debris([0xffffff, SOUL, def.tint], hx, hy - 8, 16, h.y + 20, 'spores');
    // A ring of cold light rolling out from the hero's feet.
    const ring = w.add.image(hx, hy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(SOUL).setScale(0.3, 0.1).setAlpha(0.8).setDepth(h.y - 1);
    w.tweens.add({ targets: ring, scaleX: 2.6, scaleY: 0.8, alpha: 0, duration: 650, ease: 'Sine.Out', onComplete: () => ring.destroy() });
    sound.echoBless();
  }

  destroy(): void {
    this.dead = true;
    this.world.lights.removeLight(this.light);
  }
}
