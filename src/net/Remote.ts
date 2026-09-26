// Another player's hero, as seen in this game. It is the very same hero (a
// Wizard, a Bard...) this player could pick, driven by that player's inputs
// as they arrive (where they walk, when they attack, where they aim), so every
// swing, spell and Special looks exactly as it does for them. Its blows are
// only for show here: the player who owns the hero works out what they hit in
// their own game and sends it (see NetPlay). A "ghost" view of the world is
// what makes that so: the hero's code talks to it as it would to the world,
// and it draws everything but strikes nothing, shakes no camera and leaves
// this player's buffs and energy alone.

import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { classById, type Aim, type CharacterDef, type Hero } from '../game/characters';
import { lookById, worn } from '../game/skins';
import { UltCaster } from '../game/ultimate';
import { areaOrigin, reaches, type Hit, type Hurtbox, type MeleeArea } from '../game/combat';
import type { Effect } from '../game/Slash';
import { HealthBar } from '../game/HealthBar';
import { beamHud, comboHud } from '../game/controls';
import { snap } from '../game/display';
import { freeBox } from '../world/common';
import { asGhost } from './ghost';
import type { PeerInfo } from './session';

/** A player's state, sent many times a second. Aim fields are absent when nothing is aimed at. */
export interface HeroState {
  t: 's';
  x: number;
  y: number;
  /** Walking stick, -1..1. */
  mx: number;
  my: number;
  /** Attack and special held (1) since the last state. */
  a: 0 | 1;
  s: 0 | 1;
  ax?: number;
  ay?: number;
  ad?: number;
  /** Facing the aim while walking. */
  al?: 0 | 1;
  hp: number;
  mh: number;
  br: number;
  /** Fallen. */
  dn: 0 | 1;
}

/** Their hero is too far from where they say it is: it jumps there instead of gliding. */
const SNAP_DIST = 48;

const noop = (): void => {};

/** Hurtboxes as a remote hero sees them: the same bodies, which its blows can't hurt. */
const ghosts = new WeakMap<Hurtbox, Hurtbox>();
function ghostOf(h: Hurtbox): Hurtbox {
  let g = ghosts.get(h);
  if (!g) {
    const o = Object.create(h) as Record<string, unknown>;
    o.hurt = noop;
    o.shove = noop;
    const fns = h as unknown as Record<string, unknown>;
    if (typeof fns.slow === 'function') o.slow = noop;
    if (typeof fns.bind === 'function') {
      // Say whether strings would take hold, so the hero draws them right.
      o.bind = () => h.alive && !(h as unknown as { boss?: boolean }).boss && !(h as unknown as { stats?: { rank?: string } }).stats?.rank;
    }
    g = o as unknown as Hurtbox;
    ghosts.set(h, g);
  }
  return g;
}

export class RemotePlayer implements Hurtbox {
  readonly id: number;
  readonly bodyY = 11;
  readonly radius = 6;
  readonly ch: CharacterDef;
  readonly hero: Hero;
  readonly ult: UltCaster;
  /** The world as this hero sees it (see ghostWorld). */
  private view: WorldScene;
  /** Everything its code has made in the world, to clear away when the player leaves. */
  private objects: { destroy(): void; scene?: unknown }[] = [];
  private lights: Phaser.GameObjects.Light[] = [];
  private state: HeroState | null = null;
  private prev: { x: number; y: number; at: number } | null = null;
  private vx = 0;
  private vy = 0;
  private at = 0;
  private box = new Phaser.Geom.Rectangle();
  private bar: HealthBar;
  private tag: Phaser.GameObjects.BitmapText;
  private tint = 0;
  private fade = 1;
  private pruneT = 0;
  private gone = false;

  constructor(
    private world: WorldScene,
    info: PeerInfo,
    x: number,
    y: number,
    /** What this hero's blows may touch (for show). */
    private targets: () => Hurtbox[],
    /** This player struck the hero (a duel). */
    private onStruck: (rp: RemotePlayer, hit: Hit) => void,
  ) {
    this.id = info.id;
    const cls = classById(info.hero);
    this.ch = worn(cls, lookById(cls, info.look) ?? undefined);
    this.view = this.ghostWorld();
    this.hero = asGhost(() => this.ch.spawn(this.view, x, y));
    this.ult = asGhost(() => new UltCaster(this.view, this.hero, this.ch));
    this.bar = new HealthBar(world);
    this.tag = world.add
      .bitmapText(0, 0, 'pixel', info.name.toUpperCase())
      .setLetterSpacing(-1)
      .setOrigin(0.5, 1)
      .setTint(this.ch.accent)
      .setDepth(10001);
    this.hero.alpha = 0;
  }

  get x(): number {
    return this.hero.x;
  }

  get y(): number {
    return this.hero.y;
  }

  /** Standing, and in play (a hero that hasn't been heard from yet isn't). */
  get alive(): boolean {
    return !!this.state && !this.state.dn && !this.gone;
  }

  get down(): boolean {
    return !!this.state?.dn;
  }

  get hp(): number {
    return this.state?.hp ?? 0;
  }

  /** This player's blow landed on the hero (only in a duel is it in reach). */
  hurt(hit: Hit): void {
    if (this.alive) this.onStruck(this, hit);
  }

  /** Flash red a moment: struck. */
  flash(): void {
    this.hero.sprite.setTint(0xff8070);
    this.tint = 140;
  }

  /** The latest state from its player. */
  apply(s: HeroState, now: number): void {
    const was = this.state;
    if (this.prev && now > this.prev.at) {
      const span = Math.max(30, now - this.prev.at);
      this.vx = ((s.x - this.prev.x) / span) * 1000;
      this.vy = ((s.y - this.prev.y) / span) * 1000;
    }
    this.prev = { x: s.x, y: s.y, at: now };
    this.state = s;
    this.at = now;
    if (!was) {
      // First word from them: stand where they are.
      this.hero.x = s.x;
      this.hero.y = s.y;
    } else if (s.hp < was.hp && !s.dn) this.flash();
    if (was && was.dn && !s.dn) this.fade = 1;
  }

  /** They unleashed their Special, from (x, y). */
  castUlt(x: number, y: number, aim: Aim | null, facing: { x: number; y: number }): void {
    this.hero.x = x;
    this.hero.y = y;
    asGhost(() => this.ult.request(aim, facing));
  }

  update(dt: number, now: number, daylight: number): void {
    const s = this.state;
    const h = this.hero;
    if (!s || this.gone) {
      h.alpha = 0;
      this.tag.setVisible(false);
      return;
    }
    let mx = s.mx;
    let my = s.my;
    let attack = !!s.a;
    let special = !!s.s;
    const aim: Aim | null = s.ax === undefined ? null : { x: s.ax, y: s.ay ?? 0, dist: s.ad, look: !!s.al };
    if (this.ult.holding) attack = special = false;
    if (this.ult.rooted) mx = my = 0;
    if (s.dn) {
      mx = my = 0;
      attack = special = false;
    }
    h.daylight = daylight;
    freeBox(this.world.walkable, h.x, h.y, 14, this.box);
    // The hero's code may touch the HUD's own readouts; they belong to this player.
    const beam = { ...beamHud };
    const combo = { ...comboHud };
    asGhost(() => {
      h.update(dt, mx, my, attack, special, this.box, this.ult.rooted ? null : aim);
      this.ult.update(dt);
    });
    Object.assign(beamHud, beam);
    Object.assign(comboHud, combo);

    // Glide toward where they are now (where they were, carried on a little).
    const ahead = Math.min(120, now - this.at) / 1000;
    const tx = s.x + this.vx * ahead;
    const ty = s.y + this.vy * ahead;
    const dx = tx - h.x;
    const dy = ty - h.y;
    if (dx * dx + dy * dy > SNAP_DIST * SNAP_DIST) {
      h.x = s.x;
      h.y = s.y;
    } else {
      const k = 1 - Math.exp(-dt / 90);
      h.x += dx * k;
      h.y += dy * k;
    }

    this.fade = s.dn ? Math.max(0, this.fade - dt / 700) : 1;
    h.alpha = this.fade;
    if (this.tint > 0) {
      this.tint -= dt;
      if (this.tint <= 0) h.sprite.clearTint();
    }
    this.bar.update(dt, snap(h.x), snap(h.y) - 34, s.dn ? 0 : s.hp, s.mh, s.br);
    this.tag
      .setVisible(this.fade > 0.05)
      .setAlpha(this.fade * 0.9)
      .setPosition(snap(h.x), snap(h.y) - 37);

    this.pruneT -= dt;
    if (this.pruneT <= 0) {
      this.pruneT = 3000;
      this.objects = this.objects.filter((o) => !!o.scene);
    }
  }

  /** They left: clear away their hero and all it made. */
  destroy(): void {
    if (this.gone) return;
    this.gone = true;
    this.ult.cancel();
    for (const o of this.objects) if (o.scene) o.destroy();
    this.objects = [];
    for (const l of this.lights) this.world.lights.removeLight(l);
    this.lights = [];
    this.bar.destroy();
    this.tag.destroy();
  }

  /**
   * The world as this hero sees it: the real one, except that blows only
   * test where they would land, effects run as a remote hero's doing, and
   * what it makes is remembered for clearing away.
   */
  private ghostWorld(): WorldScene {
    const real = this.world;
    const objects = this.objects;
    const lights = this.lights;
    const bodies = () => this.targets().map(ghostOf);
    const bind = <T extends object>(t: T, k: string | symbol) => {
      const v = Reflect.get(t, k) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    };
    const add = new Proxy(real.add, {
      get(t, k) {
        const v = Reflect.get(t, k) as unknown;
        if (typeof v !== 'function') return v;
        return (...args: unknown[]) => {
          const o = (v as (...a: unknown[]) => unknown).apply(t, args) as { destroy?: () => void } | null;
          if (o && typeof o.destroy === 'function') objects.push(o as { destroy(): void });
          return o;
        };
      },
    });
    const lightsView = new Proxy(real.lights, {
      get(t, k) {
        if (k === 'addLight' || k === 'addPointLight') {
          const v = Reflect.get(t, k) as (...a: unknown[]) => Phaser.GameObjects.Light;
          return (...args: unknown[]) => {
            const l = v.apply(t, args);
            lights.push(l);
            return l;
          };
        }
        return bind(t, k);
      },
    });
    const main = new Proxy(real.cameras.main, {
      get(t, k) {
        // Their blows shake their own screen, not this one.
        if (k === 'shake' || k === 'flash') return () => t;
        return bind(t, k);
      },
    });
    const cameras = new Proxy(real.cameras, { get: (t, k) => (k === 'main' ? main : bind(t, k)) });
    const strikes = (x: number, y: number) =>
      bodies().some((h) => {
        const dx = (x - h.x) / (h.radius + 2);
        const dy = (y - (h.y - h.bodyY)) / (h.bodyY + 3);
        return h.alive && dx * dx + dy * dy <= 1;
      });
    const own: Record<string | symbol, unknown> = {
      __ghost: true,
      might: 1,
      add,
      lights: lightsView,
      cameras,
      melee(area: MeleeArea): { x: number; y: number }[] {
        const o = areaOrigin(area);
        const hits: { x: number; y: number }[] = [];
        for (const h of bodies()) {
          const bx = h.x;
          const by = h.y - h.bodyY;
          if (!h.alive || !reaches(area, bx, by, h.radius)) continue;
          const l = Math.hypot(o.x - bx, o.y - by) || 1;
          hits.push({ x: bx + ((o.x - bx) / l) * (h.radius - 1), y: by + ((o.y - by) / l) * (h.radius - 2) });
        }
        return hits;
      },
      strikeAt: strikes,
      hitTest: strikes,
      hurtboxesWhere: (test: (h: Hurtbox) => boolean) => bodies().filter(test),
      firstHurtbox: (test: (h: Hurtbox) => boolean) => bodies().find((h) => h.alive && test(h)) ?? null,
      addEffect: (e: Effect) =>
        real.addEffect({
          get dead() {
            return e.dead;
          },
          update: (dt: number) => asGhost(() => e.update(dt)),
          destroy: () => e.destroy(),
        }),
      leech: noop,
      evade: noop,
      buffGained: noop,
      pullHero: noop,
      monsterSlain: noop,
      hurtHero: noop,
      hurtHeroAt: () => false,
      hurtHeroInEllipse: () => false,
    };
    return new Proxy(real, {
      get: (t, k, receiver) => (k in own ? own[k] : Reflect.get(t, k, receiver)),
    });
  }
}
