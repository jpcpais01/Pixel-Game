// The Omens, as the world runs them (see game/omens.ts for what each one is).
//
// Omens keeps the time between them, picks one, turns the light (on top of
// whatever the arena and the time of day set), brings up the banner, and
// runs it: each omen is a small class below. The monsters an omen brings
// (the Treasure Imp, a Riftborn elite, ghosts in the fog) come in "waves":
// spawners of their own, numbered past the arena's, which the world updates
// with the others. Star ore and scorch marks outlast the omen that made them.
//
// Online, the host decides: it picks each omen and where, every meteor, when
// the imp runs for home, and keeps the omens' monsters as it keeps the
// arena's; the other players follow. What each player gets (dust, gems,
// gear, the merchant's piece, the shrine's blessing) is their own.

import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { omenTextures } from '../art/textures';
import { NEUTRAL_OMEN, OMENS, UNITY, omenHud, omenMods, resetOmens, type OmenDef, type OmenId, type TradeOffer } from '../game/omens';
import { sky } from '../game/LitPipeline';
import { skyState } from '../game/SkyPipeline';
import { session, type Msg, type PeerInfo } from '../net/session';
import { Spawner, type Monster, type MonsterKind, type SpawnSpot, type SpawnerSnap, type Target } from '../game/monsters';
import { Imp } from '../game/monsters/Imp';
import type { Hit, Hurtbox } from '../game/combat';
import type { Effect } from '../game/Slash';
import { snap } from '../game/display';
import { sound } from '../audio';
import { sunShadow, SUN_SHADOW_ALPHA } from '../game/Wizard';
import { GEAR, RARITY, gear, gearById, type GearDef, type Rarity } from '../game/gear';
import { collection } from '../game/collection';
import { heroBuffs } from '../game/buffs';
import { LootFlare } from '../game/Pickup';
import {
  IMP_TINTS,
  MERCHANT_OY,
  MERCHANT_H,
  METEOR_DIR,
  METEOR_TINTS,
  ORE_H,
  ORE_KINDS,
  ORE_OY,
  ORE_TINTS,
  PORTAL_H,
  PORTAL_OY,
  RIFT_TINTS,
  SHRINE_H,
  SHRINE_OY,
  SHRINE_TINTS,
  SHRINE_W,
  type PortalKind,
} from '../art/omens';

type V3 = [number, number, number];

/** The arenas omens come to: the ones with monsters (not the Clearing, the duel ring or the Rift). */
export const OMEN_ARENAS = new Set(['garden', 'cosmos', 'spirit', 'temple', 'deep']);

/** The first omen comes this long into a visit, and each after this long past the last (ms). */
const FIRST_WAIT: [number, number] = [45000, 75000];
const NEXT_WAIT: [number, number] = [100000, 170000];
/** An omen's banner and turning light come this long before its work begins. */
const HERALD = 2200;
/** How long the light takes to turn, each way. */
const GRADE_IN = 2600;
const GRADE_OUT = 3200;
/** Building its art in the background: at most this long a frame. */
const BUILD_BUDGET = 4;
/** An omen's monsters are numbered from here, a block of slots for each wave (see Spawner). */
const SLOT_BASE = 1000;
const WAVE_SLOTS = 20;
/** The host sends where an omen's monsters are this often. */
const SNAP_EVERY = 100;
/** A player who isn't the host ends an omen by itself this long after it should have, if the host never says. */
const GUEST_GRACE = 8000;
const LIGHTS_OFF = 0;

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randInt = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** One omen under way. */
interface OmenRun {
  /** False once it is over. */
  update(dt: number, time: number): boolean;
  /** It is over (or the world is closing, `quiet`): clear away what it made. */
  end(quiet: boolean): void;
  /** Its own messages from the host (a meteor, the imp's escape). */
  receive?(m: Msg): void;
  /** Each monster of its waves as it is made, on every player's game. */
  dress?(m: Monster): void;
}

export class Omens {
  /** Building the omens' art, a little each frame, until it's done. */
  private job: Generator<void, void, void> | null;
  /** Messages that came before the art was ready. */
  private pending: Msg[] = [];
  private wait = rand(...FIRST_WAIT);
  /** The omen lighting the world: the one under way, or the last one while its light fades. */
  private def: OmenDef | null = null;
  private run: OmenRun | null = null;
  private last: OmenId | null = null;
  /** ms since the omen under way began (its banner). */
  private t = 0;
  /** How far its light has turned, 0..1. */
  private k = 0;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Where the motes drift: the view, a little larger. */
  private moteZone = new Phaser.Geom.Rectangle();
  private waves = new Map<number, { sp: Spawner; spots: [MonsterKind, number, number][] }>();
  private waveN = 0;
  private snapT = 0;
  /** The message that began the omen under way, for a player who joins late. */
  private started: Msg | null = null;
  private hostEnded = false;
  private ores: StarOre[] = [];
  private scorches: { img: Phaser.GameObjects.Image; t: number }[] = [];
  private off: () => void;

  constructor(readonly world: WorldScene) {
    resetOmens();
    omenHud.active = true;
    this.job = world.textures.exists('buff_unity') ? null : omenTextures(world);
    this.off = session.on((m) => this.receive(m));
  }

  /** This game decides: alone, or the room's host. */
  get leads(): boolean {
    return !session.active || session.isHost;
  }

  /** ms since the omen under way began. */
  get age(): number {
    return this.t;
  }

  /** How strongly the omen's light is on, 0..1 (for its own lights to follow). */
  get strength(): number {
    return Phaser.Math.Easing.Sine.InOut(this.k);
  }

  /** Bodies the omens add to what heroes can strike: star ore. */
  get hurtboxes(): Hurtbox[] {
    return this.ores;
  }

  /** The heroes standing, this player's and the others'. */
  players(): Target[] {
    return this.world.standing;
  }

  send(m: Msg): void {
    session.send(m);
  }

  /** A line across the screen (not the big banner an omen opens with). */
  call(title: string, sub: string, tint: number): void {
    omenHud.calls.push({ title, sub, tint, icon: null });
  }

  update(time: number, dt: number): void {
    this.build();
    if (this.run) {
      this.t += dt;
      const going = this.run.update(dt, time);
      const overdue = !this.leads && this.def && this.t > this.def.time + HERALD + GUEST_GRACE;
      if (!going || this.hostEnded || overdue) this.finish(false);
    } else if (this.leads && !this.job && !this.world.heroDown) {
      this.wait -= dt;
      if (this.wait <= 0) this.choose();
    }
    this.light(dt);
    this.tickOres(dt);
    this.shareWaves(dt);
  }

  private build(): void {
    if (!this.job) return;
    const t0 = performance.now();
    while (performance.now() - t0 < BUILD_BUDGET) {
      if (this.job.next().done) {
        this.job = null;
        break;
      }
    }
    if (!this.job) for (const m of this.pending.splice(0)) this.receive(m);
  }

  // ---------------------------------------------------------------- Choosing and running

  /** The kinds a Rift Tear may bring: strong foes from other arenas, whose art is built. */
  eliteKinds(): MonsterKind[] {
    const here = new Set(this.world.arenaDef.monsters.map((s) => s.kind));
    const has = (k: string) => this.world.textures.exists(k);
    const out: MonsterKind[] = ['beetle', 'barkling', 'shade'];
    if (has('sd_lane')) out.push('banshee');
    if (has('et_lane')) out.push('golem', 'salamander');
    if (has('gd_lane')) out.push('geodeback', 'myconid');
    return out.filter((k) => !here.has(k));
  }

  private choose(): void {
    const ids = (Object.keys(OMENS) as OmenId[]).filter((id) => id !== this.last && (id !== 'rift' || this.eliteKinds().length > 0));
    let r = Math.random() * ids.reduce((s, id) => s + OMENS[id].weight, 0);
    const id = ids.find((i) => (r -= OMENS[i].weight) < 0) ?? ids[0];
    const m = this.plan(id);
    // Nowhere to put it just now: try again shortly.
    if (!m) {
      this.wait = 4000;
      return;
    }
    this.send(m);
    this.begin(m);
  }

  /** Where the omen happens and what it brings, as the message that begins it everywhere. */
  private plan(id: OmenId): Msg | null {
    const h = this.world.player;
    const m: Msg = { t: 'o+', id, x: r1(h.x), y: r1(h.y) };
    const at = (min: number, max: number, clear: number) => this.spotNear(h.x, h.y, min, max, clear);
    if (id === 'imp' || id === 'rift' || id === 'merchant' || id === 'shrine') {
      const p = id === 'imp' ? at(70, 110, 12) : id === 'rift' ? at(90, 130, 18) : at(60, 100, 28);
      if (!p) return null;
      m.x = r1(p.x);
      m.y = r1(p.y);
    }
    if (id === 'rift') m.k = pick(this.eliteKinds());
    if (id === 'merchant') m.g = merchantPiece().id;
    return m;
  }

  private begin(m: Msg): void {
    if (this.run) this.finish(true);
    const def = OMENS[m.id as OmenId];
    if (!def) return;
    this.def = def;
    this.last = def.id;
    this.started = m;
    this.hostEnded = false;
    // Joined late: the omen is already this far along.
    this.t = typeof m.e === 'number' ? m.e : 0;
    const x = m.x as number;
    const y = m.y as number;
    this.run =
      def.id === 'blood'
        ? new BloodMoon(this)
        : def.id === 'imp'
          ? new TreasureImp(this, x, y)
          : def.id === 'meteor'
            ? new MeteorShower(this)
            : def.id === 'golden'
              ? new GoldenHour(this)
              : def.id === 'fog'
                ? new WhisperingFog(this)
                : def.id === 'rift'
                  ? new RiftTear(this, x, y, m.k as MonsterKind)
                  : def.id === 'merchant'
                    ? new Merchant(this, x, y, (m.g as string) ?? '')
                    : new ShrineOfUnity(this, x, y);
    omenHud.current = def;
    if (!m.e) {
      omenHud.calls.push({ title: def.name, sub: def.line, tint: def.tint, icon: def.id });
      sound.omen(def.mood);
    }
    this.motes?.destroy();
    this.motes = def.motes ? this.makeMotes(def.motes) : null;
  }

  private finish(quiet: boolean): void {
    const run = this.run;
    if (!run) return;
    this.run = null;
    run.end(quiet);
    for (const b of [...this.waves.keys()]) this.dropWave(b, quiet);
    Object.assign(omenMods, NEUTRAL_OMEN);
    Object.assign(omenHud, { current: null, trade: null, bar: 0, label: '', buy: false });
    if (this.leads) {
      this.send({ t: 'o-' });
      this.wait = rand(...NEXT_WAIT);
    }
    this.started = null;
  }

  // ---------------------------------------------------------------- The light

  /** Turn the light toward the omen's, over what the arena set this frame, and ease it back after. */
  private light(dt: number): void {
    const on = !!this.run;
    this.k = Phaser.Math.Clamp(this.k + (on ? dt / GRADE_IN : -dt / GRADE_OUT), 0, 1);
    const def = this.def;
    if (!def) return;
    if (!on && this.k <= 0) {
      this.def = null;
      this.motes?.destroy();
      this.motes = null;
      return;
    }
    const k = this.strength;
    const g = def.grade;
    const mul = (v: V3, m: V3, add?: V3): V3 => [0, 1, 2].map((i) => v[i] * (1 + (m[i] - 1) * k) + (add ? add[i] * k : 0)) as V3;
    sky.sunColor = mul(sky.sunColor, g.sun);
    sky.sky = mul(sky.sky, g.sky, g.add);
    sky.bounce = mul(sky.bounce, g.bounce);
    if (g.sunDir) {
      const d = [0, 1, 2].map((i) => sky.sunDir[i] + (g.sunDir![i] - sky.sunDir[i]) * k);
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      sky.sunDir = [d[0] / l, d[1] / l, d[2] / l];
    }
    skyState.vignette = Phaser.Math.Clamp(skyState.vignette + g.vignette * k, 0, 0.75);
    if (this.motes) {
      const v = this.world.viewRect;
      this.moteZone.setTo(v.x - 20, v.y - 20, v.width + 40, v.height + 40);
      this.motes.emitting = on;
    }
  }

  private makeMotes(m: NonNullable<OmenDef['motes']>): Phaser.GameObjects.Particles.ParticleEmitter {
    const k = () => this.strength;
    return this.world.add
      .particles(0, 0, 'spark', {
        emitZone: { type: 'random', source: this.moteZone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 2400, max: 4200 },
        speedX: { min: -5, max: 5 },
        speedY: { min: m.rise[0], max: m.rise[1] },
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 * k() },
        tint: m.tints,
        blendMode: Phaser.BlendModes.ADD,
        frequency: m.every,
      })
      .setDepth(9999);
  }

  // ---------------------------------------------------------------- Omens' monsters

  /** Bring monsters (the host, or alone): here, and in every other player's game. */
  addWave(spots: { kind: MonsterKind; x: number; y: number }[]): void {
    const base = SLOT_BASE + (this.waveN++ % 50) * WAVE_SLOTS;
    const list: [MonsterKind, number, number][] = spots.map((s) => [s.kind, r1(s.x), r1(s.y)]);
    this.send({ t: 'ow', b: base, s: list });
    this.makeWave(base, list);
  }

  private makeWave(base: number, list: [MonsterKind, number, number][]): void {
    const spots: SpawnSpot[] = list.map(([kind, x, y]) => ({ kind, x, y, lives: 0 }));
    const sp = new Spawner(this.world, spots, 9000, { base, dress: (m) => this.run?.dress?.(m) });
    sp.follower = !this.leads;
    this.world.spawnerList.push(sp);
    this.waves.set(base, { sp, spots: list });
  }

  /** A wave goes: its monsters fade away (or simply go, when the world is closing). */
  private dropWave(base: number, quiet: boolean): void {
    const w = this.waves.get(base);
    if (!w) return;
    this.waves.delete(base);
    const list = this.world.spawnerList;
    const i = list.indexOf(w.sp);
    if (i >= 0) list.splice(i, 1);
    if (!quiet) for (const m of w.sp.monsters) if (!m.dead) this.world.debris(m.stats.debris, snap(m.x), snap(m.y) - m.bodyY, 14, m.y + 1, 'spores');
    w.sp.destroy();
  }

  /** The host tells everyone where the omens' monsters are. */
  private shareWaves(dt: number): void {
    if (!session.active || !session.isHost || !this.waves.size) return;
    this.snapT -= dt;
    if (this.snapT > 0) return;
    this.snapT = SNAP_EVERY;
    for (const [b, w] of this.waves) session.send({ t: 'mo', b, ...w.sp.snapshot() });
  }

  // ---------------------------------------------------------------- Messages

  private receive(m: Msg): void {
    if (this.job && (m.t === 'o+' || m.t === 'ow' || m.t === 'om' || m.t === 'ox' || m.t === 'oe' || m.t === 'ou')) {
      this.pending.push(m);
      return;
    }
    switch (m.t) {
      case 'peer+': {
        // Someone joined mid-omen: show them it, and its monsters.
        if (!session.isHost || !this.started || !this.run) break;
        const id = (m.p as PeerInfo).id;
        session.send({ ...this.started, e: Math.round(this.t) }, id);
        for (const [b, w] of this.waves) session.send({ t: 'ow', b, s: w.spots }, id);
        break;
      }
      case 'host':
        for (const w of this.waves.values()) w.sp.follower = !this.leads;
        break;
      case 'closed':
        for (const w of this.waves.values()) w.sp.follower = false;
        break;
      case 'o+':
        if (this.leads || (this.run && this.def?.id === m.id)) break;
        this.begin(m);
        break;
      case 'o-':
        if (!this.leads && this.run) this.hostEnded = true;
        break;
      case 'ow':
        if (this.leads || !this.run || this.waves.has(m.b as number)) break;
        this.makeWave(m.b as number, m.s as [MonsterKind, number, number][]);
        break;
      case 'mo':
        if (!this.leads) this.waves.get(m.b as number)?.sp.sync(m as unknown as SpawnerSnap);
        break;
      case 'om':
      case 'ox':
      case 'oe':
      case 'ou':
        this.run?.receive?.(m);
        break;
    }
  }

  // ---------------------------------------------------------------- Places, ore and scorch

  /** A clear spot `min` to `max` from (x, y), with `clear` px of open ground round it; null if none is found. */
  spotNear(x: number, y: number, min: number, max: number, clear: number): { x: number; y: number } | null {
    const w = this.world;
    const b = w.monsterBounds;
    const open = (px: number, py: number) => {
      if (px < b.left + clear || px > b.right - clear || py < b.top + clear || py > b.bottom - clear) return false;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 0.6], [0, -0.6], [0.7, 0.45], [-0.7, 0.45], [0.7, -0.45], [-0.7, -0.45]]) {
        if (!w.walkable(px + dx * clear, py + dy * clear)) return false;
      }
      return true;
    };
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(min, max);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.8;
      if (open(px, py)) return { x: px, y: py };
    }
    return null;
  }

  addOre(x: number, y: number): void {
    // Not on top of another.
    if (this.ores.some((o) => Math.hypot(o.x - x, o.y - y) < 18)) return;
    if (!this.world.walkable(x, y)) return;
    this.ores.push(new StarOre(this.world, x, y, randInt(0, ORE_KINDS - 1)));
  }

  /** A scorch where a meteor struck, fading over a while. */
  scorch(x: number, y: number): void {
    if (this.scorches.length >= SCORCH_MAX) this.scorches.shift()?.img.destroy();
    const img = this.world.add.image(snap(x), snap(y), 'omen_scorch').setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(1.4).setFlipX(Math.random() < 0.5);
    this.scorches.push({ img, t: SCORCH_LIFE });
  }

  private tickOres(dt: number): void {
    const day = this.world.dayLight;
    for (const o of this.ores) o.update(dt, day);
    this.ores = this.ores.filter((o) => !o.dead);
    for (const s of this.scorches) {
      s.t -= dt;
      s.img.setAlpha(Math.min(1, s.t / 4000));
      if (s.t <= 0) s.img.destroy();
    }
    this.scorches = this.scorches.filter((s) => s.t > 0);
  }

  destroy(): void {
    this.finish(true);
    for (const b of [...this.waves.keys()]) this.dropWave(b, true);
    for (const o of this.ores) o.destroy();
    this.ores = [];
    for (const s of this.scorches) s.img.destroy();
    this.scorches = [];
    this.motes?.destroy();
    this.motes = null;
    this.def = null;
    this.off();
    resetOmens();
  }
}

// ================================================================ Shared pieces

/** Upright portals: the imp's, gold and green, and a Rift Tear's, violet. */
class Portal {
  dead = false;
  private open = 0;
  private closing = false;
  private body: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private pool: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private moteT = 0;
  private tints: number[];

  constructor(
    private world: WorldScene,
    readonly x: number,
    readonly y: number,
    kind: PortalKind,
    private size = 1,
  ) {
    const key = `omen_portal_${kind}`;
    const tint = kind === 'imp' ? 0xd8e860 : 0xc060ff;
    this.tints = kind === 'imp' ? IMP_TINTS : RIFT_TINTS;
    const oy = PORTAL_OY / PORTAL_H;
    const rx = snap(x);
    const ry = snap(y);
    this.pool = world.add.image(rx, ry, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(1.6).setAlpha(0);
    this.body = world.add.sprite(rx, ry, key, 'p0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(y).setScale(0).play(`${key}_loop`);
    this.glow = world.add.sprite(rx, ry, `${key}_e`, 'p0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).setScale(0).play(`${key}_e_loop`);
    this.halo = world.add.image(rx, ry - 18 * size, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(y + 0.2).setAlpha(0);
    this.light = world.lights.addLight(rx, ry - 18, 120 * size, tint, LIGHTS_OFF);
    sound.portal(world.pan(x));
    world.debris(this.tints, rx, ry - 18, 16, y + 1, 'spores');
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    sound.portal(this.world.pan(this.x));
  }

  update(dt: number): void {
    if (this.dead) return;
    this.open = Phaser.Math.Clamp(this.open + (this.closing ? -dt / 380 : dt / 520), 0, 1);
    const o = this.open;
    const s = this.size;
    // It tears open as a slit, then widens.
    const sx = s * Phaser.Math.Easing.Back.Out(o) * (0.85 + 0.15 * o);
    const sy = s * Math.min(1, o * 1.8);
    this.body.setScale(sx, sy);
    this.glow.setScale(sx, sy);
    const pulse = 0.85 + Math.sin(this.world.time.now * 0.008) * 0.15;
    this.halo.setScale(2.2 * s * o, 3 * s * o).setAlpha(0.35 * o * pulse);
    this.pool.setScale(2.4 * s * o, 0.8 * s * o).setAlpha(0.5 * o);
    this.light.intensity = 1.6 * o * pulse;
    // Motes drawn in toward it.
    this.moteT -= dt;
    if (this.moteT <= 0 && o > 0.5) {
      this.moteT = 90;
      const a = Math.random() * Math.PI * 2;
      this.world.debris(this.tints, snap(this.x + Math.cos(a) * 20 * s), snap(this.y - 18 * s + Math.sin(a) * 26 * s), 1, this.y + 1, 'gather');
    }
    if (this.closing && o <= 0) this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const g of [this.body, this.glow, this.halo, this.pool]) g.destroy();
    this.world.lights.removeLight(this.light);
  }
}

/** Star ore breaks after this many blows (a heavy one counts twice), and crumbles by itself after a while. */
const ORE_HITS = 4;
const ORE_LIFE = 70000;
const ORE_DUST: [number, number] = [3, 6];
/** Scorch marks: at most this many at once, each fading over this long. */
const SCORCH_MAX = 14;
const SCORCH_LIFE = 22000;

/** A lump of star ore where a meteor fell: struck, it cracks, glows brighter, and breaks into dust. */
class StarOre implements Hurtbox {
  readonly bodyY = 7;
  readonly radius = 8;
  alive = true;
  dead = false;
  private hits = 0;
  private life = ORE_LIFE;
  private flashT = 0;
  private shakeT = 0;
  private body: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private cast: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;

  constructor(
    private world: WorldScene,
    readonly x: number,
    readonly y: number,
    private v: number,
  ) {
    const oy = ORE_OY / ORE_H;
    const f = `o${v}0`;
    const rx = snap(x);
    const ry = snap(y);
    this.shadow = world.add.image(rx, ry, 'shadow').setDepth(1).setScale(1.3, 1).setAlpha(0.8);
    this.cast = sunShadow(world.add.image(rx, ry, 'omen_ore_s', f).setOrigin(0.5, oy));
    this.body = world.add.image(rx, ry, 'omen_ore', f).setOrigin(0.5, oy).setPipeline('Lit').setDepth(y);
    this.glow = world.add.image(rx, ry, 'omen_ore_e', f).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
    this.flash = world.add.image(rx, ry, 'omen_ore_w', f).setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.2).setVisible(false);
    this.halo = world.add.image(rx, ry - 7, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9a6cff).setScale(0.9).setDepth(y + 0.3).setAlpha(0.3);
  }

  hurt(hit: Hit): void {
    // Only heroes can break it (not the meteors still falling round it).
    if (!this.alive || hit.wild) return;
    this.hits += hit.heavy ? 2 : 1;
    this.flashT = 90;
    this.shakeT = 140;
    const w = this.world;
    w.debris(ORE_TINTS, snap(this.x), snap(this.y) - 8, 6, this.y + 2);
    sound.clack(w.pan(this.x), true);
    if (this.hits >= ORE_HITS) {
      this.alive = false;
      w.dropDust(randInt(...ORE_DUST), this.x, this.y - 8);
      w.debris(ORE_TINTS, snap(this.x), snap(this.y) - 8, 26, this.y + 2);
      w.debris(ORE_TINTS, snap(this.x), snap(this.y) - 6, 12, this.y + 2, 'spores');
      sound.shatter(w.pan(this.x), true);
      this.destroy();
      return;
    }
    const f = `o${this.v}${Math.min(2, Math.floor((this.hits * 3) / ORE_HITS))}`;
    for (const img of [this.body, this.glow, this.flash, this.cast]) img.setFrame(f);
  }

  update(dt: number, daylight: number): void {
    if (this.dead) return;
    this.life -= dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    const jolt = this.shakeT > 0 ? Math.round(Math.sin(this.shakeT * 0.2)) : 0;
    const rx = snap(this.x) + jolt;
    // Its last seconds, it flickers out.
    const a = this.life < 3000 ? (Math.sin(this.life * 0.02) > -0.2 ? 1 : 0.4) : 1;
    for (const img of [this.body, this.glow]) img.setX(rx).setAlpha(a);
    this.flash.setX(rx).setVisible(this.flashT > 0).setAlpha(this.flashT / 90);
    this.cast.setAlpha(SUN_SHADOW_ALPHA * daylight * a);
    this.halo.setAlpha((0.26 + Math.sin(this.world.time.now * 0.004 + this.x) * 0.06 + this.hits * 0.05) * a);
    if (this.life <= 0) {
      this.world.debris(ORE_TINTS, snap(this.x), snap(this.y) - 6, 10, this.y + 2, 'spores');
      this.destroy();
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.alive = false;
    for (const img of [this.body, this.glow, this.flash, this.shadow, this.cast, this.halo]) img.destroy();
  }
}

// ================================================================ Blood Moon

/** Monsters' blows, pace and every gear drop's rarity under the Blood Moon. */
const BLOOD_FURY = 1.35;
const BLOOD_PACE = 1.15;

/** The light turns red; monsters rage, a red glow at their feet; every drop rolls a rarity higher. */
class BloodMoon implements OmenRun {
  private halos = new Map<Monster, Phaser.GameObjects.Image>();

  constructor(private o: Omens) {
    Object.assign(omenMods, { fury: BLOOD_FURY, pace: BLOOD_PACE, bump: 1 });
  }

  update(): boolean {
    const o = this.o;
    const def = OMENS.blood;
    omenHud.bar = 1 - o.age / def.time;
    omenHud.label = 'Drops one rarity higher';
    const k = o.strength;
    const seen = new Set<Monster>();
    for (const sp of o.world.spawnerList) {
      for (const m of sp.monsters) {
        if (!m.alive) continue;
        seen.add(m);
        let h = this.halos.get(m);
        if (!h) {
          h = o.world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2a1a);
          this.halos.set(m, h);
        }
        const pulse = 0.8 + Math.sin(o.world.time.now * 0.006 + m.x) * 0.2;
        h.setPosition(snap(m.x), snap(m.y) - 2).setDepth(m.y - 0.5).setScale((m.radius / 6) * 1.1, (m.radius / 6) * 0.5).setAlpha(0.42 * k * pulse);
      }
    }
    for (const [m, h] of this.halos) {
      if (seen.has(m)) continue;
      h.destroy();
      this.halos.delete(m);
    }
    return o.age < def.time;
  }

  end(quiet: boolean): void {
    for (const h of this.halos.values()) h.destroy();
    this.halos.clear();
    if (!quiet) this.o.call('The blood moon sets', '', 0xff8a7a);
  }
}

// ================================================================ Golden Hour

class GoldenHour implements OmenRun {
  private glow: Phaser.GameObjects.Image;

  constructor(private o: Omens) {
    omenMods.energy = 2;
    this.glow = o.world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc040).setAlpha(0);
  }

  update(): boolean {
    const o = this.o;
    const def = OMENS.golden;
    omenHud.bar = 1 - o.age / def.time;
    omenHud.label = 'Double energy';
    // A warm glow round the hero's feet while it lasts.
    const h = o.world.player;
    const pulse = 0.85 + Math.sin(o.world.time.now * 0.005) * 0.15;
    this.glow.setPosition(snap(h.x), snap(h.y) - 3).setDepth(h.y - 0.6).setScale(1.4, 0.7).setAlpha(o.world.heroDown ? 0 : 0.34 * o.strength * pulse);
    return o.age < def.time;
  }

  end(quiet: boolean): void {
    this.glow.destroy();
    if (!quiet) this.o.call('The golden hour fades', '', 0xffd78a);
  }
}

// ================================================================ Meteor Shower

/** A meteor's warning, and its fall (ms); how far out of the sky it comes. */
const METEOR_FALL = 1500;
const METEOR_SHOWN = 720;
const METEOR_FROM = 190;
/** Where it strikes: an ellipse this wide and deep. */
const METEOR_RX = 20;
const METEOR_RY = 11;
/** What it deals to a hero, and to a monster. */
const METEOR_HIT = 15;
const METEOR_MOB_HIT = 45;
/** A share of meteors leave star ore. */
const ORE_CHANCE = 0.35;
/** Between meteors (ms). */
const METEOR_EVERY: [number, number] = [650, 1050];

class MeteorShower implements OmenRun {
  private next = HERALD + 400;

  constructor(private o: Omens) {}

  update(): boolean {
    const o = this.o;
    const def = OMENS.meteor;
    omenHud.bar = 1 - o.age / def.time;
    omenHud.label = 'Watch the rings';
    if (o.leads && o.age >= this.next && o.age < def.time - METEOR_FALL) {
      this.next = o.age + rand(...METEOR_EVERY);
      const at = this.target();
      if (at) {
        const ore = Math.random() < ORE_CHANCE ? 1 : 0;
        o.send({ t: 'om', x: r1(at.x), y: r1(at.y), o: ore });
        this.fall(at.x, at.y, !!ore);
      }
    }
    return o.age < def.time;
  }

  receive(m: Msg): void {
    if (m.t === 'om') this.fall(m.x as number, m.y as number, !!m.o);
  }

  private fall(x: number, y: number, ore: boolean): void {
    this.o.world.addEffect(new Meteor(this.o, x, y, ore));
  }

  /** Near a hero: often on a monster by them, mostly somewhere round them. */
  private target(): { x: number; y: number } | null {
    const o = this.o;
    const players = o.players();
    if (!players.length) return null;
    const p = pick(players);
    if (Math.random() < 0.3) {
      const near: Monster[] = [];
      for (const sp of o.world.spawnerList) for (const m of sp.monsters) if (m.alive && Math.hypot(m.x - p.x, m.y - p.y) < 150) near.push(m);
      if (near.length) {
        const m = pick(near);
        return { x: m.x + rand(-6, 6), y: m.y + rand(-4, 4) };
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(8, 120);
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r * 0.8;
      if (o.world.walkable(x, y)) return { x, y };
    }
    return null;
  }

  end(quiet: boolean): void {
    if (!quiet) this.o.call('The sky falls quiet', '', 0xffc890);
  }
}

/**
 * One meteor: a ring of warning on the ground that tightens and burns
 * brighter, a shadow swelling in it, the rock streaking down out of the sky,
 * and the strike: a flash of light, a scorch, fire flying, the ground
 * shaking, and sometimes a lump of star ore left smouldering.
 */
class Meteor implements Effect {
  dead = false;
  private t = 0;
  private struck = false;
  private ring: Phaser.GameObjects.Image;
  private core: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private rock: Phaser.GameObjects.Sprite;
  private fire: Phaser.GameObjects.Sprite;
  private halo: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image | null = null;
  private light: Phaser.GameObjects.Light | null = null;
  private whistled = false;

  constructor(
    private o: Omens,
    private x: number,
    private y: number,
    private ore: boolean,
  ) {
    const w = o.world;
    const rx = snap(x);
    const ry = snap(y);
    this.ring = w.add.image(rx, ry, 'danger_ring').setTint(0xff7a2a).setDepth(2).setAlpha(0);
    this.core = w.add.image(rx, ry, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5a1a).setDepth(2.1).setAlpha(0);
    this.shadow = w.add.image(rx, ry, 'shadow').setDepth(1.5).setAlpha(0).setScale(0.3);
    this.rock = w.add.sprite(rx, ry, 'omen_meteor', 'm0').setPipeline('Lit').setVisible(false).play('omen_meteor_loop');
    this.fire = w.add.sprite(rx, ry, 'omen_meteor_e', 'm0').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).play('omen_meteor_e_loop');
    this.halo = w.add.image(rx, ry, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setVisible(false);
  }

  update(dt: number): void {
    if (this.dead) return;
    this.t += dt;
    const w = this.o.world;
    const rx = snap(this.x);
    const ry = snap(this.y);
    if (!this.struck) {
      const u = Math.min(1, this.t / METEOR_FALL);
      // The warning tightens and burns hotter as the rock comes.
      const beat = 0.75 + Math.sin(this.t * (0.012 + u * 0.03)) * 0.25;
      this.ring.setScale(((1.35 - u * 0.35) * METEOR_RX) / 22, ((1.35 - u * 0.35) * METEOR_RY) / 12).setAlpha((0.3 + u * 0.6) * beat);
      this.core.setScale((METEOR_RX / 12) * u, (METEOR_RY / 11) * u).setAlpha(0.35 * u * beat);
      this.shadow.setScale(1.6 * u, 1.2 * u).setAlpha(0.6 * u);
      if (this.t > METEOR_FALL - METEOR_SHOWN) {
        if (!this.whistled) {
          this.whistled = true;
          sound.lootFall(w.pan(this.x));
        }
        // Falling faster and faster.
        const k = (this.t - (METEOR_FALL - METEOR_SHOWN)) / METEOR_SHOWN;
        const d = METEOR_FROM * (1 - k * k);
        const mx = snap(this.x - METEOR_DIR.x * d);
        const my = snap(this.y - 6 - METEOR_DIR.y * d);
        const s = 1.2 + k * 0.3;
        this.rock.setVisible(true).setPosition(mx, my).setDepth(this.y + 400).setScale(s);
        this.fire.setVisible(true).setPosition(mx, my).setDepth(this.y + 400.1).setScale(s);
        this.halo.setVisible(true).setPosition(mx, my).setDepth(this.y + 400.2).setScale(1.3 + k).setAlpha(0.5 + k * 0.3);
        if (Math.random() < dt / 30) w.debris(METEOR_TINTS, mx - Math.round(METEOR_DIR.x * 8), my - Math.round(METEOR_DIR.y * 8), 1, this.y + 399, 'trail');
      }
      if (this.t >= METEOR_FALL) this.strike();
      return;
    }
    // After the strike: the flash and its light die away.
    const a = Math.max(0, 1 - (this.t - METEOR_FALL) / 450);
    this.flash?.setAlpha(0.9 * a).setScale(2.4 + (1 - a) * 1.4, 1.4 + (1 - a) * 0.8);
    if (this.light) this.light.intensity = 2.6 * a;
    this.core.setAlpha(0.5 * a);
    if (a <= 0) this.destroy();
    void rx;
    void ry;
  }

  private strike(): void {
    this.struck = true;
    const o = this.o;
    const w = o.world;
    const { x, y } = this;
    const rx = snap(x);
    const ry = snap(y);
    for (const g of [this.ring, this.shadow, this.rock, this.fire, this.halo]) g.setVisible(false);
    this.flash = w.add.image(rx, ry - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd080).setDepth(y + 20);
    this.light = w.lights.addLight(rx, ry - 6, 150, 0xffa050, 2.6);
    w.hurtHeroInEllipse(x, y, METEOR_RX, METEOR_RY, { damage: METEOR_HIT, fromX: x, fromY: y - 4, knock: 170 });
    // Monsters are struck in the game that keeps them, and the blow is shared from there.
    if (o.leads) w.melee({ kind: 'circle', x, y: y - 6, radius: METEOR_RX }, { damage: METEOR_MOB_HIT, heavy: true, knock: 150, fromX: x, fromY: y, wild: true });
    w.debris(METEOR_TINTS, rx, ry - 4, 30, y + 2);
    w.debris(METEOR_TINTS, rx, ry - 2, 12, y + 2, 'spores');
    o.scorch(x, y);
    if (this.ore) o.addOre(x, y);
    const h = w.player;
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < 170) w.cameras.main.shake(170, 0.0006 + 0.0018 * (1 - d / 170));
    sound.starImpact(w.pan(x));
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const g of [this.ring, this.core, this.shadow, this.rock, this.fire, this.halo, this.flash]) g?.destroy();
    if (this.light) this.o.world.lights.removeLight(this.light);
  }
}

// ================================================================ Whispering Fog

/** Ghosts come in waves out of the mist: this many first, then a few more now and then, up to a limit. */
const FOG_FIRST = 4;
const FOG_MORE = 2;
const FOG_EVERY = 9000;
const FOG_WAVES = 3;
/** How far off they appear, round a hero. */
const FOG_RING: [number, number] = [150, 190];

class WhisperingFog implements OmenRun {
  private fog: Phaser.GameObjects.Particles.ParticleEmitter;
  private zone = new Phaser.Geom.Rectangle();
  /** A light carried by every hero standing: this player's and the others'. */
  private lamps = new Map<Target, Phaser.GameObjects.Light>();
  private next = HERALD + 1000;
  private waves = 0;

  constructor(private o: Omens) {
    omenMods.dark = true;
    const k = () => o.strength;
    this.fog = o.world.add
      .particles(0, 0, 'omen_fog', {
        frame: [0, 1, 2],
        emitZone: { type: 'random', source: this.zone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: 6000, max: 8000 },
        speedX: { min: 3, max: 9 },
        speedY: { min: -1.5, max: 1.5 },
        scale: { min: 1.3, max: 2.1 },
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.4 * k() },
        tint: 0xa8b4c8,
        frequency: 380,
      })
      .setDepth(9990);
  }

  dress(m: Monster): void {
    m.hunter = true;
  }

  update(): boolean {
    const o = this.o;
    const w = o.world;
    const def = OMENS.fog;
    omenHud.bar = 1 - o.age / def.time;
    omenHud.label = 'Stay in the light';
    const v = w.viewRect;
    this.zone.setTo(v.x - 60, v.y - 20, v.width + 60, v.height + 40);
    // The mist takes on the little light there is.
    const b = Phaser.Math.Clamp((sky.sky[0] + sky.sky[1] + sky.sky[2]) / 1.2 + 0.25, 0.3, 1);
    const c = (n: number) => Math.round(n * b);
    this.fog.particleTint = (c(0xb4) << 16) | (c(0xc0) << 8) | c(0xd4);
    this.fog.emitting = o.age < def.time - 2000;
    // The heroes' own lights.
    const players = o.players();
    for (const p of players) {
      let l = this.lamps.get(p);
      if (!l) {
        l = w.lights.addLight(p.x, p.y - 14, 130, 0xffe8c8, 0);
        this.lamps.set(p, l);
      }
      l.x = snap(p.x);
      l.y = snap(p.y) - 14;
      l.intensity = 1.9 * o.strength;
    }
    for (const [p, l] of this.lamps) {
      if (players.includes(p)) continue;
      w.lights.removeLight(l);
      this.lamps.delete(p);
    }
    // Ghosts drifting in out of the mist.
    if (o.leads && o.age >= this.next && this.waves <= FOG_WAVES && o.age < def.time - 6000) {
      this.next = o.age + FOG_EVERY;
      this.ghosts(this.waves === 0 ? FOG_FIRST : FOG_MORE);
      this.waves++;
    }
    return o.age < def.time;
  }

  private ghosts(n: number): void {
    const o = this.o;
    const players = o.players();
    if (!players.length) return;
    const kinds: MonsterKind[] = ['wisp', 'wisp', 'shade'];
    if (o.world.textures.exists('sd_lane')) kinds.push('banshee');
    const spots: { kind: MonsterKind; x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p = pick(players);
      const at = o.spotNear(p.x, p.y, FOG_RING[0], FOG_RING[1], 6);
      if (at) spots.push({ kind: pick(kinds), ...at });
    }
    if (spots.length) o.addWave(spots);
  }

  end(quiet: boolean): void {
    for (const l of this.lamps.values()) this.o.world.lights.removeLight(l);
    this.lamps.clear();
    // The mist thins away rather than vanishing.
    const fog = this.fog;
    fog.emitting = false;
    if (quiet) fog.destroy();
    else this.o.world.time.delayedCall(8200, () => fog.destroy());
    if (!quiet) this.o.call('The fog lifts', '', 0xbfe8f0);
  }
}

// ================================================================ Treasure Imp

/** How long he runs before making for his portal, and how long he gets to reach it. */
const IMP_RUN = 22000;
const IMP_EXIT = 6000;
/** His sack: dust, gems, and sometimes a piece of gear. */
const SACK_DUST: [number, number] = [10, 16];
const SACK_GEMS: [number, number] = [2, 4];
const SACK_GEAR = 0.5;

class TreasureImp implements OmenRun {
  private portal: Portal | null;
  private exit: Portal | null = null;
  private exitAt = 0;
  private imp: Imp | null = null;
  private made = false;
  private caught = false;
  private gone = false;
  private after = 0;

  constructor(
    private o: Omens,
    private x: number,
    private y: number,
  ) {
    this.portal = new Portal(o.world, x, y, 'imp');
  }

  dress(m: Monster): void {
    if (!(m instanceof Imp)) return;
    this.imp = m;
    m.onCaught = (x, y) => this.catch(x, y);
    m.onSpill = (x, y) => this.o.world.dropDust(1, x, y - 10);
  }

  update(dt: number): boolean {
    const o = this.o;
    this.portal?.update(dt);
    this.exit?.update(dt);
    if (this.portal?.dead) this.portal = null;
    if (!this.made && o.age > HERALD) {
      this.made = true;
      if (o.leads) o.addWave([{ kind: 'imp', x: this.x, y: this.y + 2 }]);
      sound.cackle(o.world.pan(this.x));
    }
    // His way in closes behind him.
    if (this.portal && o.age > HERALD + 1800) this.portal.close();
    const imp = this.imp;
    const left = HERALD + IMP_RUN - o.age;
    omenHud.bar = Phaser.Math.Clamp(left / IMP_RUN, 0, 1);
    omenHud.label = this.exit ? 'He runs for his portal!' : 'Catch him!';
    if (this.caught || this.gone) {
      this.after += dt;
      return this.after < 1800;
    }
    if (o.leads && imp && !imp.dead && imp.alive && !this.exit && left <= 0) {
      const at = this.exitSpot(imp);
      o.send({ t: 'ox', x: r1(at.x), y: r1(at.y) });
      this.openExit(at.x, at.y);
    }
    if (o.leads && this.exit && (imp?.escaped || o.age > this.exitAt + IMP_EXIT)) {
      o.send({ t: 'oe' });
      this.escape();
    }
    return o.age < HERALD + IMP_RUN + IMP_EXIT + 4000;
  }

  receive(m: Msg): void {
    if (m.t === 'ox') this.openExit(m.x as number, m.y as number);
    else if (m.t === 'oe') this.escape();
  }

  /** A little way ahead of him, away from whoever is nearest. */
  private exitSpot(imp: Imp): { x: number; y: number } {
    const players = this.o.players();
    let near: Target | null = null;
    for (const p of players) if (!near || Math.hypot(p.x - imp.x, p.y - imp.y) < Math.hypot(near.x - imp.x, near.y - imp.y)) near = p;
    if (near) {
      const d = Math.hypot(imp.x - near.x, imp.y - near.y) || 1;
      const x = imp.x + ((imp.x - near.x) / d) * 34;
      const y = imp.y + ((imp.y - near.y) / d) * 26;
      if (this.o.world.walkable(x, y)) return { x, y };
    }
    return this.o.spotNear(imp.x, imp.y, 18, 44, 8) ?? { x: imp.x, y: imp.y };
  }

  private openExit(x: number, y: number): void {
    if (this.exit || this.caught) return;
    this.exit = new Portal(this.o.world, x, y, 'imp');
    this.exitAt = this.o.age;
    this.imp?.escapeTo(x, y);
    sound.cackle(this.o.world.pan(x));
  }

  private escape(): void {
    if (this.gone || this.caught) return;
    this.gone = true;
    const w = this.o.world;
    const imp = this.imp;
    if (imp && !imp.dead) {
      w.debris(IMP_TINTS, snap(imp.x), snap(imp.y) - 10, 18, imp.y + 1, 'spores');
      imp.destroy();
    }
    this.exit?.close();
    this.o.call('The imp got away', 'Better luck next time', 0xc8b070);
  }

  /** Caught: his sack bursts, dust and gems everywhere, and sometimes a piece of gear. */
  private catch(x: number, y: number): void {
    if (this.caught || this.gone) return;
    this.caught = true;
    const w = this.o.world;
    this.exit?.close();
    const dust = randInt(...SACK_DUST);
    const piles = 3;
    for (let i = 0; i < piles; i++) w.dropDust(Math.round(dust / piles), x, y - 10);
    w.dropGems(randInt(...SACK_GEMS), x, y - 10);
    if (Math.random() < SACK_GEAR) for (const def of gear.roll('imp', 1)) w.dropGear(def, x, y - 10);
    w.debris(IMP_TINTS, snap(x), snap(y) - 10, 34, y + 2);
    w.cameras.main.shake(160, 0.0014);
    this.o.call('Imp caught!', 'His sack bursts open', 0xf4d04a);
  }

  end(): void {
    this.portal?.destroy();
    this.exit?.destroy();
  }
}

// ================================================================ Rift Tear

/** A Riftborn elite: this much bigger, and this many times its health. */
const ELITE_SIZE = 1.3;
const ELITE_TOUGH = 4;
const ELITE_NAME: Partial<Record<MonsterKind, string>> = {
  beetle: 'Beetle',
  barkling: 'Barkling',
  shade: 'Shade',
  banshee: 'Banshee',
  golem: 'Golem',
  salamander: 'Salamander',
  geodeback: 'Geodeback',
  myconid: 'Myconid',
};
/** What it leaves: gems and a piece of gear a rarity up. */
const ELITE_GEMS: [number, number] = [2, 4];

class RiftTear implements OmenRun {
  private portal: Portal;
  private elite: Monster | null = null;
  private aura: Phaser.GameObjects.Image;
  private made = false;
  private slain = false;
  private after = 0;
  private name: string;

  constructor(
    private o: Omens,
    private x: number,
    private y: number,
    private kind: MonsterKind,
  ) {
    this.portal = new Portal(o.world, x, y, 'rift', 1.35);
    this.aura = o.world.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb050ff).setAlpha(0);
    this.name = `Riftborn ${ELITE_NAME[kind] ?? 'Elite'}`;
  }

  dress(m: Monster): void {
    m.hunter = true;
    m.size = ELITE_SIZE;
    m.toughness = ELITE_TOUGH;
    m.hp = m.maxHp;
    this.elite = m;
  }

  update(dt: number): boolean {
    const o = this.o;
    const w = o.world;
    this.portal.update(dt);
    if (!this.made && o.age > HERALD + 700) {
      this.made = true;
      if (o.leads) o.addWave([{ kind: this.kind, x: this.x, y: this.y + 3 }]);
      w.cameras.main.shake(260, 0.002);
      sound.slam(w.pan(this.x));
      w.debris(RIFT_TINTS, snap(this.x), snap(this.y) - 20, 30, this.y + 2);
    }
    const e = this.elite;
    omenHud.label = this.name;
    omenHud.bar = e && !e.dead ? Math.max(0, e.hp) / e.maxHp : this.slain ? 0 : 1;
    if (e && !e.dead) {
      const pulse = 0.8 + Math.sin(w.time.now * 0.007) * 0.2;
      this.aura.setPosition(snap(e.x), snap(e.y) - 2).setDepth(e.y - 0.5).setScale(e.radius / 4, e.radius / 9).setAlpha(e.alive ? 0.5 * pulse : 0);
      if (e.alive && Math.random() < dt / 120) w.debris(RIFT_TINTS, snap(e.x + rand(-e.radius, e.radius)), snap(e.y) - rand(0, e.bodyY * 2), 1, e.y + 1, 'spores');
      if (!this.slain && e.state === 'dying') this.slay(e);
    } else this.aura.setAlpha(0);
    if (this.slain) {
      this.after += dt;
      if (this.after > 700) this.portal.close();
      return this.after < 2600;
    }
    if (o.age > OMENS.rift.time) {
      // Never beaten: the rift pulls it back through.
      if (e && !e.dead) {
        w.debris(RIFT_TINTS, snap(e.x), snap(e.y) - e.bodyY, 26, e.y + 1, 'spores');
        e.destroy();
      }
      return false;
    }
    return true;
  }

  private slay(e: Monster): void {
    this.slain = true;
    const w = this.o.world;
    const y = e.y - e.bodyY;
    w.dropGems(randInt(...ELITE_GEMS), e.x, y);
    for (const def of gear.roll(this.kind, 1)) w.dropGear(def, e.x, y);
    this.o.call(`${this.name} slain!`, 'The rift gives up its spoils', 0xd070ff);
  }

  end(quiet: boolean): void {
    this.aura.destroy();
    if (quiet) this.portal.destroy();
    else {
      // The tear seals itself as the omen passes.
      this.portal.close();
      const p = this.portal;
      const tick = (_t: number, dt: number) => {
        p.update(dt);
        if (p.dead) this.o.world.events.off(Phaser.Scenes.Events.UPDATE, tick);
      };
      this.o.world.events.on(Phaser.Scenes.Events.UPDATE, tick);
      this.o.world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.o.world.events.off(Phaser.Scenes.Events.UPDATE, tick));
      if (!this.slain) this.o.call('The rift closes', '', 0xc8a0ff);
    }
  }
}

// ================================================================ Wandering Merchant

/** What his one piece is likely to be, and its price in dust. */
const MERCHANT_ODDS: [Rarity, number][] = [
  ['rare', 0.5],
  ['epic', 0.36],
  ['legendary', 0.14],
];
const MERCHANT_PRICE: Partial<Record<Rarity, number>> = { rare: 15, epic: 45, legendary: 120 };
/** Close enough to his rug to trade. */
const TRADE_RX = 34;
const TRADE_RY = 20;
/** His rug lies this far in front of him. */
const RUG_DY = 12;

/** One piece, any not of a set, of a rarity rolled from his odds. */
function merchantPiece(): GearDef {
  let r = Math.random();
  const rarity = MERCHANT_ODDS.find(([, p]) => (r -= p) < 0)?.[0] ?? 'rare';
  return pick(GEAR.filter((g) => !g.set && g.rarity === rarity));
}

class Merchant implements OmenRun {
  private shown = false;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private body: Phaser.GameObjects.Sprite | null = null;
  private cast: Phaser.GameObjects.Sprite | null = null;
  private item: Phaser.GameObjects.Image | null = null;
  private itemGlow: Phaser.GameObjects.Image | null = null;
  private light: Phaser.GameObjects.Light | null = null;
  private offer: TradeOffer | null;
  private greeted = false;
  private twinkleT = 0;

  constructor(
    private o: Omens,
    private x: number,
    private y: number,
    gearId: string,
  ) {
    const def = gearById(gearId);
    this.offer = def ? { def, price: MERCHANT_PRICE[def.rarity] ?? 30, bought: false } : null;
  }

  /** He steps out of a puff of smoke, lays out his rug and his one piece. */
  private appear(): void {
    this.shown = true;
    const w = this.o.world;
    const { x, y } = this;
    const rx = snap(x);
    const ry = snap(y);
    const oy = MERCHANT_OY / MERCHANT_H;
    const rug = w.add.image(rx, ry + RUG_DY, 'omen_rug', 'r0').setPipeline('Lit').setDepth(2);
    const shadow = w.add.image(rx, ry, 'shadow_big').setDepth(1).setAlpha(0.7).setScale(0.8, 0.7);
    this.cast = sunShadow(w.add.sprite(rx, ry, 'omen_merchant_s', 'f0').setOrigin(0.5, oy));
    this.body = w.add.sprite(rx, ry, 'omen_merchant', 'f0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(y).play('omen_merchant_loop');
    const glow = w.add.sprite(rx, ry, 'omen_merchant_e', 'f0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play('omen_merchant_e_loop');
    const lantern = w.add.image(rx - 14, ry - 30, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setDepth(y + 0.2).setScale(0.9).setAlpha(0.45);
    this.light = w.lights.addLight(rx - 14, ry - 30, 110, 0xffb060, 1.5);
    this.parts.push(rug, shadow, this.cast, this.body, glow, lantern);
    const def = this.offer?.def;
    if (def) {
      const tint = RARITY[def.rarity].tint;
      this.itemGlow = w.add.image(rx, ry + RUG_DY - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(ry + RUG_DY + 0.1).setAlpha(0.45);
      this.item = w.add.image(rx, ry + RUG_DY - 6, def.drop).setDepth(ry + RUG_DY + 0.2);
      this.parts.push(this.itemGlow, this.item);
    }
    w.debris([0x9aa6b8, 0xdfe6f0, 0x7ae0b8], rx, ry - 16, 26, y + 2, 'spores');
    w.debris([0xffffff, 0x7ae0b8], rx, ry - 14, 14, y + 2);
    sound.vanish(w.pan(x));
  }

  update(dt: number): boolean {
    const o = this.o;
    const w = o.world;
    const def = OMENS.merchant;
    if (!this.shown && o.age > HERALD) this.appear();
    omenHud.bar = 1 - o.age / def.time;
    const offer = this.offer;
    omenHud.label = !offer ? 'Nothing to sell' : offer.bought ? 'Sold!' : `${offer.price} dust`;
    if (!this.shown) return true;
    const t = w.time.now;
    if (this.item && this.itemGlow) {
      const bob = Math.round(Math.sin(t * 0.004) * 1.5);
      this.item.setY(snap(this.y) + RUG_DY - 7 + bob);
      this.itemGlow.setAlpha(0.38 + Math.sin(t * 0.005) * 0.1);
      this.twinkleT -= dt;
      if (this.twinkleT <= 0 && offer) {
        this.twinkleT = 260;
        w.debris([0xffffff, RARITY[offer.def.rarity].tint], snap(this.x + rand(-5, 5)), snap(this.y) + RUG_DY - 8 - rand(0, 6), 1, this.y + RUG_DY + 1, 'gather');
      }
    }
    this.cast?.setFrame(this.body?.frame.name ?? 'f0').setAlpha(SUN_SHADOW_ALPHA * w.dayLight);
    if (this.light) this.light.intensity = 1.5 * (0.9 + Math.sin(t * 0.013) * 0.06 + Math.sin(t * 0.031) * 0.04);
    // Standing at his rug: his offer, in the overlay.
    const h = w.player;
    const dx = (h.x - this.x) / TRADE_RX;
    const dy = (h.y - (this.y + RUG_DY)) / TRADE_RY;
    const near = !w.heroDown && dx * dx + dy * dy < 1;
    omenHud.trade = near && offer ? offer : null;
    if (near && !this.greeted) {
      this.greeted = true;
      w.popNumber(snap(this.x), snap(this.y) - 46, 'RARE WARES!', 0x7ae0b8);
    }
    if (omenHud.buy) {
      omenHud.buy = false;
      if (near) this.buy();
    }
    return o.age < def.time;
  }

  private buy(): void {
    const offer = this.offer;
    const w = this.o.world;
    if (!offer || offer.bought) return;
    if (!collection.spendDust(offer.price)) {
      w.popNumber(snap(this.x), snap(this.y) - 46, 'NOT ENOUGH DUST', 0xff9a8a);
      return;
    }
    offer.bought = true;
    sound.gemSpend();
    w.grantGear(offer.def);
    const ix = snap(this.x);
    const iy = snap(this.y) + RUG_DY - 8;
    w.debris([0xffffff, RARITY[offer.def.rarity].tint], ix, iy, 18, this.y + RUG_DY + 1);
    this.item?.setVisible(false);
    this.itemGlow?.setVisible(false);
    w.popNumber(snap(this.x), snap(this.y) - 46, 'A PLEASURE!', 0x7ae0b8);
  }

  end(quiet: boolean): void {
    omenHud.trade = null;
    const w = this.o.world;
    if (this.shown && !quiet) {
      w.debris([0x9aa6b8, 0xdfe6f0, 0x7ae0b8], snap(this.x), snap(this.y) - 16, 26, this.y + 2, 'spores');
      sound.vanish(w.pan(this.x));
      this.o.call('The merchant moves on', '', 0x9ae8c8);
    }
    for (const p of this.parts) p.destroy();
    this.parts = [];
    if (this.light) w.lights.removeLight(this.light);
    this.light = null;
  }
}

// ================================================================ Shrine of Unity

/** Rising out of the ground, and sinking back (ms). */
const SHRINE_RISE = 1800;
const SHRINE_SINK = 1400;
/** Standing in its ring together fills it in this long; stepping out drains it this fast. */
const SHRINE_FILL = 4500;
const SHRINE_DRAIN = 7000;
/** Its ring on the ground. */
const RING_RX = 38;
const RING_RY = 17;

class ShrineOfUnity implements OmenRun {
  private body: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private cast: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private orb: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Light;
  private charge = 0;
  private stage = 0;
  private blessed = false;
  /** Rising (0..1), and the time it began to sink. */
  private rise = 0;
  private sinkAt = -1;
  private rumbleT = 0;
  private moteT = 0;

  constructor(
    private o: Omens,
    private x: number,
    private y: number,
  ) {
    const w = o.world;
    const rx = snap(x);
    const ry = snap(y);
    const oy = SHRINE_OY / SHRINE_H;
    this.ring = w.add.image(rx, ry + 2, 'omen_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd060).setDepth(1.7).setAlpha(0);
    this.cast = sunShadow(w.add.image(rx, ry, 'omen_shrine_s', 's0').setOrigin(0.5, oy));
    this.body = w.add.image(rx, ry, 'omen_shrine', 's0').setOrigin(0.5, oy).setPipeline('Lit').setDepth(y);
    this.glow = w.add.image(rx, ry, 'omen_shrine_e', 's0').setOrigin(0.5, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
    this.orb = w.add.image(rx, ry - SHRINE_OY + 9, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe68a).setDepth(y + 0.2).setAlpha(0);
    this.light = w.lights.addLight(rx, ry - 40, 120, 0xffe0a0, 0);
    this.place(0);
    sound.slam(w.pan(x));
  }

  /** Show `rise` of it above the ground, the rest still buried. */
  private place(rise: number): void {
    const sunk = Math.round((1 - rise) * SHRINE_OY);
    const ry = snap(this.y) + sunk;
    const shown = SHRINE_H - sunk - (SHRINE_H - SHRINE_OY);
    for (const img of [this.body, this.glow]) img.setY(ry).setCrop(0, 0, SHRINE_W, Math.max(0, shown));
    this.cast.setVisible(rise >= 1);
    this.orb.setY(ry - SHRINE_OY + 9);
  }

  private setStage(s: number): void {
    this.stage = s;
    for (const img of [this.body, this.glow, this.cast]) img.setFrame(`s${s}`);
  }

  update(dt: number): boolean {
    const o = this.o;
    const w = o.world;
    const def = OMENS.shrine;
    const rx = snap(this.x);
    const ry = snap(this.y);
    // Rising, the ground shaking and dust flying round its foot.
    if (this.sinkAt < 0 && this.rise < 1) {
      this.rise = Phaser.Math.Clamp((o.age - HERALD * 0.5) / SHRINE_RISE, 0, 1);
      this.place(Phaser.Math.Easing.Sine.Out(this.rise));
      this.rumbleT -= dt;
      if (this.rumbleT <= 0 && this.rise > 0) {
        this.rumbleT = 160;
        w.cameras.main.shake(140, 0.0007);
        w.debris([0x8a96a8, 0x5a6272, 0xc8d0dc], rx + Math.round(rand(-14, 14)), ry - 2, 3, this.y + 2, 'spores');
      }
      if (this.rise >= 1) {
        sound.slam(w.pan(this.x));
        w.debris(SHRINE_TINTS, rx, ry - 30, 20, this.y + 2, 'spores');
      }
    }
    // Sinking back into the ground.
    if (this.sinkAt >= 0) {
      const k = Phaser.Math.Clamp((o.age - this.sinkAt) / SHRINE_SINK, 0, 1);
      this.place(1 - Phaser.Math.Easing.Sine.In(k));
      this.ring.setAlpha(0.3 * (1 - k));
      this.orb.setAlpha(0.4 * (1 - k));
      this.light.intensity = 1.2 * (1 - k);
      return k < 1;
    }
    const players = o.players();
    const inside = players.filter((p) => ((p.x - this.x) / RING_RX) ** 2 + ((p.y - (this.y + 2)) / RING_RY) ** 2 < 1).length;
    const all = this.rise >= 1 && players.length > 0 && inside === players.length;
    if (!this.blessed && this.rise >= 1) {
      this.charge = Phaser.Math.Clamp(this.charge + (all ? dt / SHRINE_FILL : -dt / SHRINE_DRAIN), 0, 1);
      const s = Math.min(4, Math.floor(this.charge * 4 + 0.0001));
      if (s !== this.stage) {
        if (s > this.stage) {
          sound.hallow();
          w.debris(SHRINE_TINTS, rx, ry - 30 + (4 - s) * 6, 10, this.y + 2);
        }
        this.setStage(s);
      }
      if (this.charge >= 1) this.bless(true);
      // Motes rising in the ring while it fills.
      this.moteT -= dt;
      if (all && this.moteT <= 0) {
        this.moteT = 70;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        w.debris(SHRINE_TINTS, snap(this.x + Math.cos(a) * RING_RX * r), snap(this.y + 2 + Math.sin(a) * RING_RY * r), 1, this.y + 3, 'spores');
      }
    }
    const pulse = 0.85 + Math.sin(w.time.now * (all ? 0.012 : 0.004)) * 0.15;
    const fill = this.blessed ? 1 : this.charge;
    this.ring.setAlpha(this.rise * (0.22 + fill * 0.45) * pulse).setScale(1 + (all ? 0.04 * pulse : 0));
    this.orb.setScale(0.9 + fill * 0.9).setAlpha(this.rise * (0.25 + fill * 0.5) * pulse);
    this.light.intensity = this.rise * (0.5 + fill * 1.4);
    omenHud.bar = fill;
    omenHud.label = this.blessed ? 'Blessed' : players.length > 1 ? `Stand together ${inside}/${players.length}` : 'Stand in its ring';
    if (this.blessed && o.age > this.blessedAt + 2600) this.sinkAt = o.age;
    if (!this.blessed && o.age > def.time) this.sinkAt = o.age;
    return true;
  }

  private blessedAt = 0;

  /** Everyone is blessed: this player here, the others by the message. */
  private bless(send: boolean): void {
    if (this.blessed) return;
    this.blessed = true;
    this.blessedAt = this.o.age;
    this.charge = 1;
    this.setStage(4);
    if (send) this.o.send({ t: 'ou' });
    const w = this.o.world;
    w.addEffect(new LootFlare(w, snap(this.x), snap(this.y), null, true, 0xffd060, 0xfffbe0));
    w.debris(SHRINE_TINTS, snap(this.x), snap(this.y) - 30, 34, this.y + 2);
    w.cameras.main.shake(200, 0.0016);
    if (!w.heroDown) {
      heroBuffs.add(UNITY);
      w.buffGained(UNITY);
    }
    sound.ultReady();
    sound.lootLand(4, w.pan(this.x));
    this.o.call('Unity!', 'More damage and speed for a while', 0xffe68a);
  }

  receive(m: Msg): void {
    if (m.t === 'ou') this.bless(false);
  }

  end(quiet: boolean): void {
    if (!quiet && !this.blessed) this.o.call('The shrine sinks away', '', 0xc8c0a0);
    for (const img of [this.body, this.glow, this.cast, this.ring, this.orb]) img.destroy();
    this.o.world.lights.removeLight(this.light);
  }
}
