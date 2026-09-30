import Phaser from 'phaser';
import { CRITTER_H, CRITTER_OX, CRITTER_OY, CRITTER_W, JAR_H, NET_ANGLES, NET_GRIP_X, NET_GRIP_Y, NET_SIZE } from '../art/critters';
import { snap } from './display';
import { collection } from './collection';
import { critterPool, type CritterDef } from './critters';
import { critterHud } from './controls';
import { sound } from '../audio';

// The critters out in the world: a few at a time come out near the hero on
// walkable ground, live their little lives (fluttering, crawling, hopping,
// scurrying) and drift off again after a while or once left far behind. They
// startle and flee from a hero who runs right at them, so the knack is to
// come up gently. A swing of the net (the touch net button, or E) scoops up
// the one in reach, which pops into a glass jar over the hero's head.
//
// They are this player's own (each player online sees their own critters),
// have no lights (a soft additive halo for the glowing ones instead), and
// stop animating while off screen.

/** How many are out at once near the hero, and how often another may come out. */
const MAX_OUT = 4;
const SPAWN_EVERY = 2400;
/** They come out this far from the hero, and wander off once left this far behind. */
const SPAWN_NEAR = 90;
const SPAWN_FAR = 220;
const LEAVE_DIST = 420;
/** How long one stays before wandering off (a rare one leaves sooner), ms. */
const LIFE = 55000;
const RARE_LIFE = 30000;
/** Fading in as it comes out and out as it goes, ms. */
const FADE = 700;
/** How far round its spot it wanders. */
const ROAM = 40;
/** A hero moving faster than this (px/s) this close startles it (a rare one sooner). */
const STARTLE_SPEED = 45;
const STARTLE_R = 30;
const RARE_STARTLE_R = 44;
/** It flees this long. */
const FLEE_MS = 900;
/** The net reaches a critter this close to the hero (y squashed, as the ground is seen at a slant). */
const NET_REACH = 28;
/** A swing, and when in it the net comes down; and the wait before the next. */
const SWING_MS = 300;
const LAND_AT = 0.6;
const NET_COOLDOWN = 450;
/** Where the net sweeps down beside the hero, and how close to there it scoops up a critter it wasn't aimed at. */
const SCOOP_AHEAD = 16;
const SCOOP_R = 16;
/** Flyers flutter this high over the ground. */
const HOVER = 11;
/** Kept updating this far outside the camera's view. */
const VIEW_PAD = 32;

/** Moving speeds (px/s) by gait: going about, and fleeing. */
const SPEED: Record<CritterDef['gait'], [number, number]> = {
  fly: [20, 70],
  crawl: [7, 24],
  hop: [0, 0],
  walk: [28, 62],
};

/** What the critters need of the world. */
export interface CritterHost {
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: Phaser.Tweens.TweenManager;
  walkable(x: number, y: number): boolean;
  debris(tints: number[], x: number, y: number, count: number, depth: number, style?: 'burst' | 'spores' | 'trail' | 'gather'): void;
  popNumber(x: number, y: number, text: string, tint: number): void;
}

interface Critter {
  def: CritterDef;
  x: number;
  y: number;
  /** Where it lives, and where it's heading now. */
  hx: number;
  hy: number;
  tx: number;
  ty: number;
  /** Resting before it moves on, ms. */
  rest: number;
  /** Fleeing, ms left, and which way. */
  flee: number;
  fx: number;
  fy: number;
  /** A frog's hop: 0..1 through it, from (x0, y0) to its target. */
  hop: number;
  x0: number;
  y0: number;
  life: number;
  /** Brought out on purpose (the Moon Hare at its hollow): it keeps to its home whatever the hour. */
  stays: boolean;
  /** 0..1 faded in; `going` fades it out. */
  shown: number;
  going: boolean;
  facing: number;
  t: number;
  onScreen: boolean;
  body: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image | null;
}

interface Swing {
  t: number;
  dir: number;
  target: Critter | null;
  landed: boolean;
  net: Phaser.GameObjects.Sprite;
}

export class CritterField {
  private out: Critter[] = [];
  private spawnT = SPAWN_EVERY * 0.5;
  private swing: Swing | null = null;
  private cooldown = 0;
  private lastX = 0;
  private lastY = 0;
  private heroSpeed = 0;
  /** The one the net would scoop now, marked with a bobbing arrow (and an E with a keyboard). */
  private near: Critter | null = null;
  private marker: Phaser.GameObjects.Graphics;
  private key: Phaser.GameObjects.BitmapText;

  constructor(
    private world: CritterHost,
    private arena: string,
    private dayNight: boolean,
  ) {
    // A small gold chevron pointing down at the critter in reach.
    this.marker = world.add.graphics().setDepth(15000).setVisible(false);
    this.marker.fillStyle(0x2a1a08, 0.9).fillRect(-3, -1, 7, 2).fillRect(-2, 1, 5, 1).fillRect(-1, 2, 3, 1);
    this.marker.fillStyle(0xffe08a, 1).fillRect(-2, -1, 5, 1).fillRect(-1, 0, 3, 1).fillRect(0, 1, 1, 1);
    this.key = world.add.bitmapText(0, 0, 'pixel', 'E').setOrigin(0.5, 1).setDepth(15000).setTint(0xfff4d8).setVisible(false);
  }

  /** Each frame: where the hero is, whether they're down, the light (0 night .. 1 day), the camera's view, and whether a keyboard/mouse is in use. */
  update(dt: number, heroX: number, heroY: number, heroDown: boolean, daylight: number, view: Phaser.Geom.Rectangle, mouse: boolean, indoors = false): void {
    const s = dt / 1000;
    const moved = Math.hypot(heroX - this.lastX, heroY - this.lastY);
    // Smoothed, and a step over the world (a rise, a door) isn't running.
    this.heroSpeed += ((moved > 40 ? 0 : moved / Math.max(s, 0.001)) - this.heroSpeed) * Math.min(1, s * 10);
    this.lastX = heroX;
    this.lastY = heroY;

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = SPAWN_EVERY * (0.7 + Math.random() * 0.6);
      if (!indoors && this.out.filter((c) => !c.going).length < MAX_OUT) this.spawn(heroX, heroY, daylight);
    }

    const here = new Set(critterPool(this.arena, daylight, this.dayNight).map((p) => p.def));
    for (const c of this.out) this.live(c, dt, heroX, heroY, daylight, view, here);
    this.out = this.out.filter((c) => {
      if (c.going && c.shown <= 0) {
        this.remove(c);
        return false;
      }
      return true;
    });

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.swing) this.updateSwing(dt, heroX, heroY);

    // The one in the net's reach.
    this.near = heroDown ? null : this.nearest(heroX, heroY, NET_REACH);
    critterHud.near = !!this.near;
    const n = this.near;
    if (n && !this.swing) {
      const bob = Math.round(Math.sin(performance.now() * 0.008) * 1.5);
      const top = snap(n.y) - this.height(n) - 14 + bob;
      this.marker.setVisible(!mouse).setPosition(snap(n.x), top);
      this.key.setVisible(mouse).setPosition(snap(n.x), top + 2);
    } else {
      this.marker.setVisible(false);
      this.key.setVisible(false);
    }
  }

  /**
   * Bring `def` out at (x, y) now, to live round there for `life` ms,
   * whatever the hour or the pool (the White Stag's Moon Hare at its hollow).
   */
  release(def: CritterDef, x: number, y: number, life: number): void {
    const c = this.make(def, x, y);
    c.stays = true;
    c.life = life;
    c.rest = 1200;
    this.out.push(c);
    this.world.debris([0xffffff, def.tint], snap(x), snap(y) - 6, 12, y + 20, 'spores');
  }

  /** Swing the net: at the critter in reach if there is one, else the way the hero faces. */
  swingNet(heroX: number, heroY: number, facingX: number): void {
    if (this.swing || this.cooldown > 0) return;
    const target = this.nearest(heroX, heroY, NET_REACH + 6);
    const dir = target ? (target.x >= heroX ? 1 : -1) : facingX >= 0 ? 1 : -1;
    const net = this.world.add.sprite(heroX, heroY, 'net', 'n0').setOrigin(NET_GRIP_X / NET_SIZE, NET_GRIP_Y / NET_SIZE).setPipeline('Lit').setFlipX(dir < 0);
    this.swing = { t: 0, dir, target, landed: false, net };
    this.cooldown = SWING_MS + NET_COOLDOWN;
    sound.netSwish(dir * 0.3);
  }

  private updateSwing(dt: number, heroX: number, heroY: number): void {
    const sw = this.swing!;
    sw.t += dt;
    const k = Math.min(1, sw.t / SWING_MS);
    // Raised behind the head, then down fast; it rests a moment on the ground.
    const eased = Phaser.Math.Easing.Cubic.In(Math.min(1, k / LAND_AT));
    const frame = Math.min(NET_ANGLES.length - 1, Math.floor(eased * (NET_ANGLES.length - 1) + 0.001));
    const hx = snap(heroX + sw.dir * 4);
    const hy = snap(heroY - 10);
    // In front of the hero while it comes down on that side; behind while held up high.
    sw.net.setFrame(`n${frame}`).setPosition(hx, hy).setDepth(heroY + (frame >= 2 ? 2 : -2)).setAlpha(k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1);
    if (!sw.landed && k >= LAND_AT) {
      sw.landed = true;
      const sx = heroX + sw.dir * SCOOP_AHEAD;
      const sy = heroY - 2;
      let got = sw.target && !sw.target.going && this.reach(sw.target, heroX, heroY) < NET_REACH + 8 ? sw.target : null;
      if (!got) {
        let best = SCOOP_R;
        for (const c of this.out) {
          if (c.going) continue;
          const d = Math.hypot(c.x - sx, (c.y - sy) * 1.3);
          if (d < best) {
            best = d;
            got = c;
          }
        }
      }
      this.world.debris([0xffffff, 0xe8e0c8], snap(sx), snap(sy), 5, sy + 4, 'burst');
      if (got) this.caught(got, heroX, heroY);
      else {
        // A miss startles everything close by.
        for (const c of this.out) if (Math.hypot(c.x - sx, c.y - sy) < 50) this.startle(c, sx, sy);
      }
    }
    if (k >= 1) {
      sw.net.destroy();
      this.swing = null;
    }
  }

  /** Into the net and into a jar: the jar pops up over the hero's head, glinting, and is tucked away. */
  private caught(c: Critter, heroX: number, heroY: number): void {
    const def = c.def;
    const first = collection.catchCritter(def.id);
    const x = snap(c.x);
    const y = snap(c.y) - this.height(c) - 6;
    this.world.debris([0xffffff, def.tint], x, y, 14, c.y + 20, 'burst');
    this.world.debris([0xffffff, def.tint], x, y, 8, c.y + 20, 'spores');
    this.remove(c);
    this.out = this.out.filter((o) => o !== c);
    if (this.near === c) this.near = null;

    const add = this.world.add;
    const jx = snap(heroX);
    const jy = snap(heroY) - 40;
    const glow = add.image(jx, jy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0).setScale(1.4).setDepth(15001);
    const jar = add.sprite(x, y, 'jars', `${def.id}_0`).setOrigin(0.5, 1).setScale(0.3).setDepth(15002).play(`jar_${def.id}`);
    const light = add.sprite(x, y, 'jars_e', `${def.id}_0`).setOrigin(0.5, 1).setScale(0.3).setDepth(15003).setBlendMode(Phaser.BlendModes.ADD);
    const sync = () => light.setFrame(jar.frame.name).setPosition(jar.x, jar.y).setScale(jar.scaleX, jar.scaleY).setAlpha(jar.alpha);
    jar.on(Phaser.Animations.Events.ANIMATION_UPDATE, sync);
    const tweens = this.world.tweens;
    tweens.add({
      targets: jar,
      x: jx,
      y: jy + JAR_H / 2,
      scale: 1,
      duration: 380,
      ease: 'Back.easeOut',
      onUpdate: sync,
      onComplete: () => {
        this.world.debris([0xffffff, def.tint, 0xfff4c0], jx, jy, first ? 22 : 10, heroY + 40, 'burst');
        tweens.add({ targets: glow, alpha: { from: 0.7, to: 0 }, scale: { from: 1.2, to: 2.4 }, duration: 700, onComplete: () => glow.destroy() });
        // A little wobble, as if it's settling in, then away into the bag.
        tweens.add({
          targets: jar,
          angle: { from: -8, to: 0 },
          duration: 500,
          ease: 'Elastic.easeOut',
          onUpdate: () => light.setAngle(jar.angle),
          onComplete: () =>
            tweens.add({
              targets: jar,
              y: snap(heroY) - 12,
              scale: 0.2,
              alpha: 0,
              delay: first ? 700 : 300,
              duration: 260,
              ease: 'Quad.easeIn',
              onUpdate: sync,
              onComplete: () => {
                jar.destroy();
                light.destroy();
              },
            }),
        });
      },
    });
    this.world.popNumber(jx, jy - JAR_H / 2 - 4, first ? `NEW! ${def.name}` : def.name, def.tint);
    sound.critterCatch(def.rarity === 'common' ? (first ? 1 : 0) : 2);
  }

  /** The critter nearest the hero within `r`, not already leaving. */
  private nearest(x: number, y: number, r: number): Critter | null {
    let best: Critter | null = null;
    let bestD = r;
    for (const c of this.out) {
      if (c.going || c.shown < 0.5) continue;
      const d = this.reach(c, x, y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private reach(c: Critter, x: number, y: number): number {
    return Math.hypot(c.x - x, (c.y - y) * 1.3);
  }

  /** One comes out somewhere near the hero, on open ground, out of the way of the hero's feet. */
  private spawn(heroX: number, heroY: number, daylight: number): void {
    const pool = critterPool(this.arena, daylight, this.dayNight);
    if (!pool.length) return;
    let roll = Math.random() * pool.reduce((s, p) => s + p.weight, 0);
    let def = pool[0].def;
    for (const p of pool) {
      roll -= p.weight;
      if (roll <= 0) {
        def = p.def;
        break;
      }
    }
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = SPAWN_NEAR + Math.random() * (SPAWN_FAR - SPAWN_NEAR);
      const x = heroX + Math.cos(a) * d;
      const y = heroY + Math.sin(a) * d * 0.8;
      if (!this.world.walkable(x, y)) continue;
      this.out.push(this.make(def, x, y));
      return;
    }
  }

  private make(def: CritterDef, x: number, y: number): Critter {
    const add = this.world.add;
    const ox = CRITTER_OX / CRITTER_W;
    const oy = CRITTER_OY / CRITTER_H;
    const f0 = `${def.id}_0`;
    const shadow = add.image(x, y, 'shadow').setDepth(1).setScale(def.gait === 'fly' ? 0.35 : 0.5, 0.5).setAlpha(0);
    const halo = def.glow ? add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0).setScale(0.8) : null;
    const body = add.sprite(x, y, 'critters', f0).setOrigin(ox, oy).setPipeline('Lit').setAlpha(0);
    // Each starts its loop at a different moment, so a group doesn't beat in time.
    body.play({ key: `critter_${def.id}`, startFrame: Math.floor(Math.random() * 4) });
    const glow = add.sprite(x, y, 'critters_e', f0).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    return {
      def,
      x,
      y,
      hx: x,
      hy: y,
      tx: x,
      ty: y,
      rest: 500 + Math.random() * 1500,
      flee: 0,
      fx: 0,
      fy: 0,
      hop: 0,
      x0: x,
      y0: y,
      life: def.rarity === 'common' ? LIFE : RARE_LIFE,
      stays: false,
      shown: 0,
      going: false,
      facing: Math.random() < 0.5 ? -1 : 1,
      t: Math.random() * 10000,
      onScreen: true,
      body,
      glow,
      shadow,
      halo,
    };
  }

  private remove(c: Critter): void {
    for (const o of [c.body, c.glow, c.shadow, c.halo]) o?.destroy();
  }

  /** Run away from (x, y) for a moment. */
  private startle(c: Critter, x: number, y: number): void {
    if (c.going || c.flee > 0) return;
    const dx = c.x - x;
    const dy = c.y - y;
    const l = Math.hypot(dx, dy) || 1;
    c.flee = FLEE_MS * (0.8 + Math.random() * 0.4);
    c.fx = dx / l;
    c.fy = dy / l;
    // A frog leaps away at once.
    if (c.def.gait === 'hop' && c.hop === 0) this.startHop(c, c.x + c.fx * 26, c.y + c.fy * 20);
  }

  private startHop(c: Critter, tx: number, ty: number): void {
    if (!this.world.walkable(tx, ty)) return;
    c.hop = 0.001;
    c.x0 = c.x;
    c.y0 = c.y;
    c.tx = tx;
    c.ty = ty;
    if (Math.abs(tx - c.x) > 1) c.facing = Math.sign(tx - c.x);
  }

  /** How high off the ground it is now. */
  private height(c: Critter): number {
    if (c.def.gait === 'fly') return HOVER + Math.sin(c.t * 0.004) * 2.5 + Math.sin(c.t * 0.011) * 1;
    if (c.def.gait === 'hop' && c.hop > 0) return Math.sin(c.hop * Math.PI) * 7;
    return 0;
  }

  private live(c: Critter, dt: number, heroX: number, heroY: number, daylight: number, view: Phaser.Geom.Rectangle, here: Set<CritterDef>): void {
    const s = dt / 1000;
    c.t += dt;
    c.life -= dt;
    const far = Math.hypot(c.x - heroX, c.y - heroY) > LEAVE_DIST;
    // Left far behind, its time up, or the light no longer its own: off it goes.
    if (!c.going && (far || c.life <= 0 || (!c.stays && !here.has(c.def)))) c.going = true;
    c.shown = Phaser.Math.Clamp(c.shown + (c.going ? -dt : dt) / FADE, 0, 1);

    const rare = c.def.rarity !== 'common';
    if (!c.going && this.heroSpeed > STARTLE_SPEED && this.reach(c, heroX, heroY) < (rare ? RARE_STARTLE_R : STARTLE_R)) this.startle(c, heroX, heroY);

    const [walk, run] = SPEED[c.def.gait];
    if (c.def.gait === 'hop') {
      if (c.hop > 0) {
        c.hop = Math.min(1, c.hop + dt / (c.flee > 0 ? 320 : 420));
        c.x = c.x0 + (c.tx - c.x0) * c.hop;
        c.y = c.y0 + (c.ty - c.y0) * c.hop;
        if (c.hop >= 1) {
          c.hop = 0;
          c.rest = 1500 + Math.random() * 2500;
        }
      } else if ((c.rest -= dt) <= 0) {
        const a = Math.random() * Math.PI * 2;
        const back = Math.hypot(c.x - c.hx, c.y - c.hy) > ROAM;
        const tx = back ? c.hx : c.x + Math.cos(a) * 16;
        const ty = back ? c.hy : c.y + Math.sin(a) * 12;
        this.startHop(c, tx, ty);
        if (c.hop === 0) c.rest = 400;
      }
    } else if (c.flee > 0) {
      this.step(c, c.fx * run * s, c.fy * run * s);
    } else if (c.rest > 0) {
      c.rest -= dt;
      // Flyers never quite settle: they hang in the air, drifting.
      if (c.def.gait === 'fly') this.step(c, Math.sin(c.t * 0.003) * 6 * s, Math.cos(c.t * 0.0023) * 4 * s);
    } else {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        // Arrived: rest a while, then pick somewhere else round its spot.
        c.rest = c.def.gait === 'fly' ? 300 + Math.random() * 900 : 900 + Math.random() * 2600;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * ROAM;
        c.tx = c.hx + Math.cos(a) * r;
        c.ty = c.hy + Math.sin(a) * r * 0.7;
      } else {
        // Flyers weave as they go.
        const weave = c.def.gait === 'fly' ? Math.sin(c.t * 0.008) * 0.6 : 0;
        const ux = dx / d - (dy / d) * weave;
        const uy = dy / d + (dx / d) * weave;
        const step = Math.min(d, walk * s);
        if (!this.step(c, ux * step, uy * step)) {
          c.tx = c.x;
          c.ty = c.y;
        }
      }
    }
    if (c.flee > 0) {
      c.flee -= dt;
      if (c.flee <= 0) {
        // It settles where it fled to.
        c.hx = c.tx = c.x;
        c.hy = c.ty = c.y;
        c.rest = 600;
      }
    }

    // Off screen: hidden and still, apart from its walking about.
    const on = c.x > view.x - VIEW_PAD && c.x < view.right + VIEW_PAD && c.y > view.y - VIEW_PAD && c.y < view.bottom + VIEW_PAD + HOVER;
    if (on !== c.onScreen) {
      c.onScreen = on;
      for (const o of [c.body, c.glow, c.shadow, c.halo]) o?.setVisible(on);
      if (on) c.body.anims.resume();
      else c.body.anims.pause();
    }
    if (!on) return;
    const rx = snap(c.x);
    const ry = snap(c.y);
    const hy = snap(ry - this.height(c));
    const flip = c.facing < 0;
    const a = c.shown;
    c.body.setPosition(rx, hy).setDepth(ry).setFlipX(flip).setAlpha(a);
    c.glow.setPosition(rx, hy).setDepth(ry + 0.1).setFrame(c.body.frame.name).setFlipX(flip).setAlpha(a);
    const lift = Math.min(1, this.height(c) / 16);
    c.shadow.setPosition(rx, ry).setAlpha(a * (0.55 - lift * 0.3));
    // Glowing ones light a soft halo round themselves, stronger in the dark.
    c.halo?.setPosition(rx, hy - 6).setDepth(ry + 0.2).setAlpha(a * (0.12 + 0.3 * (1 - daylight)) * (0.85 + 0.15 * Math.sin(c.t * 0.006)));
  }

  /** Move by (dx, dy) if the ground there is open; false when blocked. */
  private step(c: Critter, dx: number, dy: number): boolean {
    const nx = c.x + dx;
    const ny = c.y + dy;
    if (Math.abs(dx) > 0.05) c.facing = Math.sign(dx);
    if (!this.world.walkable(nx, ny)) {
      c.flee = 0;
      return false;
    }
    c.x = nx;
    c.y = ny;
    return true;
  }

  destroy(): void {
    for (const c of this.out) this.remove(c);
    this.out = [];
    this.swing?.net.destroy();
    this.swing = null;
    this.marker.destroy();
    this.key.destroy();
    critterHud.near = false;
  }
}
