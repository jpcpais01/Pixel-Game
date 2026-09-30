// The Endless Rift: waves of monsters pour out of tears round a platform in
// the void, each wave bigger and tougher than the last, a Riftborn Champion
// with every fifth. Between waves the hero heals a little and picks one of
// three blessings, which last the whole run. When the hero falls the run is
// over, and the furthest wave is kept, per class and difficulty, as a best.
//
// Online, up to four heroes hold the rift together: the host runs the waves
// on its difficulty (bigger and tougher for every hero), each player picks
// their own blessings, the fallen rise when the wave is beaten, and the run
// ends when every hero is down.
//
// Three difficulties, chosen on the world map before a run: Normal is the
// rift as it always was; on Hard every foe's blow lands 10x as hard and on
// Impossible 100x, while their health stays the same; and their drops are
// twice (Hard) or three times (Impossible) as likely.
//
// RiftWaves stands in for the arena's Spawner (the world updates it like
// one); `riftMods` is what the blessings do, read by the world; `riftHud` is
// what the Rift's overlay (scenes/RiftScene.ts) shows and the choice it hands
// back.

import type { WorldScene } from '../scenes/WorldScene';
import type { RiftArena } from '../world/Rift';
import type { BlessingIcon } from '../art/rift';
import { TEARS } from '../world/riftLayout';
import { collection } from './collection';
import { MONSTERS, Spawner, type Monster, type MonsterKind, type MonsterSnap, type SpawnerSnap, type Target } from './monsters';
import { session, type Msg } from '../net/session';
import type { Hero } from './characters';
import { sound } from '../audio';

/** Monsters by how much of a wave's budget they take: weak, normal and strong. */
const WEAK: MonsterKind[] = ['frog', 'puffcap', 'glowmoth', 'wisp', 'blob_water', 'blob_fire', 'blob_earth', 'blob_air', 'sporeling', 'glimbat'];
const NORMAL: MonsterKind[] = ['banshee', 'shade', 'gale', 'undine', 'salamander', 'shardling', 'myconid'];
const STRONG: MonsterKind[] = ['beetle', 'barkling', 'golem', 'geodeback'];
const COST = { weak: 1, normal: 2, strong: 4 };

/** The champions, in turn, every fifth wave; and what each is called. */
const CHAMPIONS: MonsterKind[] = ['barkling', 'golem', 'beetle', 'geodeback'];
const CHAMPION_NAME: Partial<Record<MonsterKind, string>> = { barkling: 'Riftborn Barkling', golem: 'Riftborn Golem', beetle: 'Riftborn Beetle', geodeback: 'Riftborn Geodeback' };
const CHAMPION_EVERY = 5;
const CHAMPION_SIZE = 1.45;
const CHAMPION_TOUGH = 7;

/** A wave's budget: what its monsters may cost in all. */
const budget = (n: number) => 4 + 3 * n;
/** Rift monsters' health, as times their own. */
const toughness = (n: number) => 1 + 0.15 * (n - 1) + 0.005 * (n - 1) ** 2;
/** How hard their blows land on the hero, as times their own. */
const fury = (n: number) => 1 + 0.06 * (n - 1);
/** How many may stand at once. */
const maxAlive = (n: number) => Math.min(14, 6 + Math.floor(n / 2));
/** ms between monsters stepping out of the tears. */
const SPAWN_EVERY = 450;
/** Kept this far from the hero when choosing a tear to step out of. */
const TEAR_KEEP_AWAY = 70;

/** The pause before each wave (the first is longer, the arena's name having just shown). */
const INTRO_FIRST = 3600;
const INTRO = 2600;
/** After a wave: a breath before the blessings, and after choosing one, a breath before the next wave. */
const CLEARED_PAUSE = 1100;
const REST = 1400;
/** A share of the hero's health given back as each wave is cleared. */
const CLEAR_HEAL = 0.25;
/** Gems a champion drops: this many, and more for every fifth wave further. */
const CHAMPION_GEMS = 3;
const CHAMPION_GEMS_STEP = 2;
/** With Fortune, each ordinary kill has this chance, per stack, of a gem. */
const FORTUNE_CHANCE = 0.02;

/**
 * Online, for each hero past the first: a wave's budget grows by this share,
 * its monsters' health by this share, and this many more may stand at once.
 * Four heroes face about three times the foes, each nearly twice as tough.
 */
const CROWD_BUDGET = 0.65;
const CROWD_TOUGH = 0.3;
const CROWD_ALIVE = 3;
/** Online, how long (ms) the blessings wait for a player before one is chosen for them. */
const BLESS_WAIT = 25000;
/** How far a player's copy of a monster may stray from the host's before it jumps there. */
const SNAP_DIST = 56;

// ---------------------------------------------------------------- Difficulty

export type RiftDifficulty = 'normal' | 'hard' | 'impossible';

export interface DifficultyDef {
  id: RiftDifficulty;
  name: string;
  /** Foes' blows, as times Normal's. Their health never changes. */
  hit: number;
  /** Every drop chance of theirs, as times Normal's (capped at certain). */
  odds: number;
  /** Its colour on the map's panel and the run's HUD. */
  tint: number;
  /** A line for the map's panel. */
  note: string;
  /** The first wave's call. */
  opens: string;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'normal', name: 'Normal', hit: 1, odds: 1, tint: 0xb8a8e8, note: 'The rift as it always was', opens: 'The rift opens' },
  { id: 'hard', name: 'Hard', hit: 10, odds: 2, tint: 0xff8a3a, note: 'Foes hit 10x, drops 2x', opens: 'Every blow bites deep' },
  { id: 'impossible', name: 'Impossible', hit: 100, odds: 3, tint: 0xff3a52, note: 'Foes hit 100x, drops 3x', opens: 'One blow is death' },
];

export const difficultyDef = (d: RiftDifficulty): DifficultyDef => DIFFICULTIES.find((x) => x.id === d) ?? DIFFICULTIES[0];

const DIFFICULTY_KEY = 'pixel-battle.riftDifficulty';
let chosen: RiftDifficulty | null = null;

/** The difficulty the next run is played on: the last one chosen on this device. */
export function riftDifficulty(): RiftDifficulty {
  if (chosen) return chosen;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(DIFFICULTY_KEY);
  } catch {
    // Storage blocked: Normal.
  }
  chosen = DIFFICULTIES.some((d) => d.id === saved) ? (saved as RiftDifficulty) : 'normal';
  return chosen;
}

export function setRiftDifficulty(d: RiftDifficulty): void {
  chosen = d;
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    // Kept for this session only.
  }
}

/** Where a class's best on a difficulty is kept: Normal under the class alone, as bests always were. */
export const riftKey = (cls: string, d: RiftDifficulty): string => (d === 'normal' ? cls : `${cls}:${d}`);

// ---------------------------------------------------------------- Blessings

/** What the run's blessings add up to; the world reads these. 1 (or 0) when nothing has been chosen. */
export interface RiftMods {
  /** Multiplies the hero's damage. */
  damage: number;
  speed: number;
  /** Multiplies the damage the hero takes. */
  guard: number;
  /** Lifesteal, as a share of damage dealt. */
  leech: number;
  /** Health a second. */
  regen: number;
  /** Multiplies Special energy from kills. */
  energy: number;
  /** Fortune's stacks. */
  gems: number;
  /** The current wave's monsters' blows, as times their own (the difficulty's included). */
  fury: number;
  /** The difficulty's drop chances, as times their own. */
  odds: number;
}

const NEUTRAL: RiftMods = { damage: 1, speed: 1, guard: 1, leech: 0, regen: 0, energy: 1, gems: 0, fury: 1, odds: 1 };

export const riftMods: RiftMods = { ...NEUTRAL };

export interface Blessing {
  id: BlessingIcon;
  name: string;
  /** What it does, in a few words for its card. */
  text: string;
  /** How many times it can be taken in a run. */
  max: number;
  apply(m: RiftMods, hero: Hero): void;
}

export const BLESSINGS: Blessing[] = [
  { id: 'might', name: 'Might', text: '+15% damage', max: 6, apply: (m) => (m.damage *= 1.15) },
  { id: 'swift', name: 'Swiftness', text: '+10% speed', max: 4, apply: (m) => (m.speed *= 1.1) },
  {
    id: 'vigor',
    name: 'Vigor',
    text: '+20 health, healed',
    max: 6,
    apply: (_m, hero) => {
      hero.vitals.grow(20);
      hero.vitals.heal(hero.vitals.max);
    },
  },
  { id: 'fang', name: 'Bloodfang', text: '+4% lifesteal', max: 5, apply: (m) => (m.leech += 0.04) },
  { id: 'ward', name: 'Ward', text: '-12% damage taken', max: 5, apply: (m) => (m.guard *= 0.88) },
  { id: 'renew', name: 'Renewal', text: '+1 health a second', max: 5, apply: (m) => (m.regen += 1) },
  { id: 'surge', name: 'Surge', text: '+40% Special energy', max: 4, apply: (m) => (m.energy *= 1.4) },
  { id: 'fortune', name: 'Fortune', text: 'More gems', max: 3, apply: (m) => (m.gems += 1) },
];

// ---------------------------------------------------------------- The overlay's view

export type RiftPhase = 'intro' | 'fight' | 'cleared' | 'bless' | 'rest' | 'over';

/** A line flashed across the screen. */
export interface RiftCall {
  text: string;
  sub: string;
  tint: number;
}

/** What the Rift's overlay shows, and the blessing it hands back. */
export const riftHud = {
  active: false,
  phase: 'intro' as RiftPhase,
  wave: 0,
  /** Foes still to beat this wave: waiting at the tears and standing. */
  left: 0,
  kills: 0,
  /** Gems the run has dropped. */
  gems: 0,
  /** The champion standing, if any. */
  champion: null as { name: string; hp: number; max: number } | null,
  /** The blessings offered now, and the one chosen (its index; -1 until then). */
  offer: null as Blessing[] | null,
  pick: -1,
  /** Every blessing taken this run, in order. */
  taken: [] as BlessingIcon[],
  /** Lines to flash, oldest first; the overlay takes them. */
  calls: [] as RiftCall[],
  /** At the end: the best before this run, and whether this was a new one. */
  best: 0,
  newBest: false,
  /** The class this run is played with, for the best. */
  cls: '',
  className: '',
  /** The difficulty this run is played on. */
  difficulty: 'normal' as RiftDifficulty,
  /** "Again" pressed on the results, online, where the run starts over in the same room. */
  again: false,
};

/** Out of the Rift: its blessings count for nothing, and its overlay has nothing to show. */
export function resetRift(): void {
  Object.assign(riftMods, NEUTRAL);
  riftHud.active = false;
}

function resetHud(cls: string, className: string, difficulty: RiftDifficulty): void {
  Object.assign(riftHud, { active: true, phase: 'intro', wave: 0, left: 0, kills: 0, gems: 0, champion: null, offer: null, pick: -1, taken: [], calls: [], again: false, best: collection.riftBest(riftKey(cls, difficulty)), newBest: false, cls, className, difficulty });
}

// ---------------------------------------------------------------- The waves

interface Entry {
  m: Monster;
  kind: MonsterKind;
  champion: boolean;
  /** Its death has been counted. */
  counted: boolean;
  /** How it came out of its tear, for players who join later (host only). */
  made: Msg | null;
  /** Online, in a follower's game: where the host has it. */
  net: { x: number; y: number } | null;
}

/** What the rift needs of the world it runs in. */
export interface RiftHost {
  hero(): Hero;
  /** Gems falling at (x, y). */
  dropGems(n: number, x: number, y: number): void;
  /** Stand the fallen hero back up at the start (online, when the wave is beaten). */
  revive(): void;
}

/** The host's rift, sent with its monsters ten times a second (see net/NetPlay.ts). */
interface RiftSnap extends SpawnerSnap {
  /** The run (each "Again" starts a new one), the wave, the phase, the foes still waiting at the tears, and the difficulty. */
  r: number;
  w: number;
  p: RiftPhase;
  q: number;
  d: RiftDifficulty;
}

const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** How many heroes are in the rift: the more there are, the bigger and tougher each wave. */
const heroes = (): number => (session.active ? session.peers.size + 1 : 1);

/** Between waves: the monsters are gone and the blessings are being chosen. */
const between = (p: RiftPhase): boolean => p === 'cleared' || p === 'bless' || p === 'rest';

/**
 * Stands in for the arena's Spawner: runs the waves, one after another,
 * until the hero falls. Online the room's host runs them for everyone: it
 * chooses each wave and brings its monsters out, and the others follow it
 * (sync), keeping only their own blessings, gems and kills. A hero who
 * falls there lies until the wave is beaten and rises for the next; the
 * run ends when every hero is down.
 */
export class RiftWaves extends Spawner {
  private entries: Entry[] = [];
  private queue: { kind: MonsterKind; champion: boolean }[] = [];
  private timer = INTRO_FIRST;
  private spawnT = 0;
  private diff: DifficultyDef;
  /** Each "Again" is a new run; its monsters carry its number, so an old run's never mix with a new one's. */
  private run = 0;
  private nextSlot = 0;
  /** A follower's view of the host's foes still waiting at the tears. */
  private hostQueue = 0;
  /** The host: the other players who have chosen their blessing this wave, and how long it has waited for the rest. */
  private ready = new Set<number>();
  private waitT = 0;
  /** How long the blessings have been on offer, online, where no one may keep the others waiting for ever. */
  private offerT = 0;
  /** Max health Vigor has added this run, taken back if the run starts again. */
  private grown = 0;
  private off: () => void;

  constructor(
    private host: WorldScene,
    private arena: RiftArena,
    private rift: RiftHost,
    private cls: string,
    private className: string,
  ) {
    super(host, [], 9000);
    this.diff = difficultyDef(riftDifficulty());
    Object.assign(riftMods, NEUTRAL, { odds: this.diff.odds });
    resetHud(cls, className, this.diff.id);
    this.off = session.on((m) => this.receive(m));
    // Joining a friend's rift: their first word says which wave it is on, and on what difficulty.
    if (session.active && !session.isHost) this.follower = true;
    else this.startWave(1);
  }

  get monsters(): Monster[] {
    return this.entries.map((e) => e.m);
  }

  private startWave(n: number): void {
    riftHud.wave = n;
    riftHud.phase = 'intro';
    riftMods.fury = fury(n) * this.diff.hit;
    this.timer = n === 1 ? INTRO_FIRST : INTRO;
    this.queue = this.follower ? [] : this.compose(n);
    this.ready.clear();
    this.waitT = 0;
    riftHud.left = this.follower ? this.hostQueue : this.queue.length;
    const champ = n % CHAMPION_EVERY === 0;
    riftHud.calls.push({ text: `Wave ${n}`, sub: champ ? 'A champion comes' : n === 1 ? this.diff.opens : '', tint: champ ? 0xff7ad0 : n === 1 && this.diff.id !== 'normal' ? this.diff.tint : 0xf4cf6a });
    this.arena.setWave(true);
  }

  /**
   * A wave's monsters: its budget spent on a few kinds from each tier it has
   * reached (normal from wave 3, strong from wave 6), cheaper kinds thinning
   * out as the waves go on; with a champion last, every fifth wave. Online
   * the budget grows with every hero past the first.
   */
  private compose(n: number): { kind: MonsterKind; champion: boolean }[] {
    const kinds = {
      weak: [pickOne(WEAK), pickOne(WEAK), pickOne(WEAK)],
      normal: n >= 3 ? [pickOne(NORMAL), pickOne(NORMAL)] : [],
      strong: n >= 6 ? [pickOne(STRONG), pickOne(STRONG)] : [],
    };
    const weights = { weak: Math.max(1, 6 - n * 0.4), normal: n >= 3 ? Math.min(6, n - 1) : 0, strong: n >= 6 ? Math.min(5, (n - 4) * 0.6) : 0 };
    const champ = n % CHAMPION_EVERY === 0;
    let left = Math.round(budget(n) * (champ ? 0.7 : 1) * (1 + CROWD_BUDGET * (heroes() - 1)));
    const out: { kind: MonsterKind; champion: boolean }[] = [];
    while (left > 0) {
      const total = weights.weak + weights.normal + weights.strong;
      let r = Math.random() * total;
      const tier = (r -= weights.weak) < 0 ? 'weak' : (r -= weights.normal) < 0 ? 'normal' : 'strong';
      if (COST[tier] > left && tier !== 'weak') continue;
      out.push({ kind: pickOne(kinds[tier]), champion: false });
      left -= COST[tier];
    }
    if (champ) out.push({ kind: CHAMPIONS[(n / CHAMPION_EVERY - 1) % CHAMPIONS.length], champion: true });
    return out;
  }

  /** Step a monster out of a tear, not too near any hero, here and in every other player's game. */
  private spawn(next: { kind: MonsterKind; champion: boolean }, targets: Target[]): void {
    const far = TEARS.map((t, i) => ({ t, i })).filter(({ t }) => targets.every((h) => Math.hypot(t.x - h.x, t.y - h.y) > TEAR_KEEP_AWAY));
    const { t, i } = pickOne(far.length ? far : TEARS.map((t, i) => ({ t, i })));
    const tough = toughness(riftHud.wave) * (next.champion ? CHAMPION_TOUGH : 1) * (1 + CROWD_TOUGH * (heroes() - 1));
    const made: Msg = { t: 'rm', r: this.run, i: this.nextSlot++, k: next.kind, c: next.champion ? 1 : 0, x: Math.round(t.x + (Math.random() - 0.5) * 6), y: Math.round(t.y + 3), tf: Math.round(tough * 1000) / 1000, e: i };
    session.send(made);
    this.bring(made);
  }

  /** A monster out of tear `e`: brought out here, or as the host says. */
  private bring(s: Msg): void {
    const kind = s.k as MonsterKind;
    const champion = !!s.c;
    const m = MONSTERS[kind](this.host, s.x as number, s.y as number);
    m.slot = s.i as number;
    m.gen = this.run;
    m.hunter = true;
    m.toughness = s.tf as number;
    if (champion) m.size = CHAMPION_SIZE;
    m.hp = m.maxHp;
    this.entries.push({ m, kind, champion, counted: false, made: s, net: null });
    this.arena.flare(s.e as number);
    if (champion) {
      riftHud.calls.push({ text: CHAMPION_NAME[kind] ?? 'Riftborn Champion', sub: 'Champion', tint: 0xff7ad0 });
      this.host.cameras.main.shake(260, 0.002);
      sound.slam(this.host.pan(s.x as number));
    }
  }

  update(dt: number, targets: Target[], daylight: number): void {
    // "Again" pressed on the results, online: the whole room starts over.
    if (riftHud.again) {
      riftHud.again = false;
      if (riftHud.phase === 'over') {
        session.send({ t: 'ra', r: this.run + 1 });
        this.restart(this.run + 1);
      }
    }
    for (const e of this.entries) {
      e.m.update(e.m.warp(dt), nearest(e.m, targets), daylight);
      if (!e.counted && (e.m.state === 'dying' || e.m.dead)) this.slain(e);
    }
    this.entries = this.entries.filter((e) => !e.m.dead);
    const standing = this.entries.filter((e) => !e.counted);
    const champ = standing.find((e) => e.champion);
    riftHud.champion = champ ? { name: CHAMPION_NAME[champ.kind] ?? 'Champion', hp: Math.max(0, champ.m.hp), max: champ.m.maxHp } : null;
    riftHud.left = (this.follower ? this.hostQueue : this.queue.length) + standing.length;

    // Every hero is down (alone, the hero has fallen): the run is over.
    if (!this.follower && !targets.length && riftHud.phase !== 'over') this.end();

    switch (riftHud.phase) {
      case 'intro':
        if (this.follower) break;
        this.timer -= dt;
        if (this.timer <= 0) riftHud.phase = 'fight';
        break;
      case 'fight':
        if (this.follower) break;
        this.spawnT -= dt;
        if (this.queue.length && this.spawnT <= 0 && standing.length < maxAlive(riftHud.wave) + CROWD_ALIVE * (heroes() - 1)) {
          this.spawnT = SPAWN_EVERY;
          this.spawn(this.queue.shift()!, targets);
        }
        if (!this.queue.length && !standing.length) this.cleared();
        break;
      case 'cleared':
        this.timer -= dt;
        if (this.timer <= 0) this.offer();
        break;
      case 'bless':
        this.offerT += dt;
        // Online no one may hold the others up for long: past the wait, one is chosen for them.
        if (riftHud.pick < 0 && riftHud.offer && session.active && this.offerT > BLESS_WAIT) riftHud.pick = Math.floor(Math.random() * riftHud.offer.length);
        if (riftHud.pick >= 0 && riftHud.offer) this.bless(riftHud.offer[riftHud.pick]);
        break;
      case 'rest':
        if (this.follower) break;
        // The host waits for everyone's blessing (but not for ever).
        if (!this.everyoneReady() && this.waitT < BLESS_WAIT) {
          this.waitT += dt;
          break;
        }
        this.timer -= dt;
        if (this.timer <= 0) this.startWave(riftHud.wave + 1);
        break;
      case 'over':
        break;
    }
  }

  private everyoneReady(): boolean {
    if (!session.active) return true;
    for (const id of session.peers.keys()) if (!this.ready.has(id)) return false;
    return true;
  }

  private slain(e: Entry): void {
    e.counted = true;
    riftHud.kills++;
    const { x, y } = e.m;
    if (e.champion) {
      const n = CHAMPION_GEMS + CHAMPION_GEMS_STEP * Math.floor(riftHud.wave / CHAMPION_EVERY - 1) + riftMods.gems * 2;
      riftHud.gems += n;
      this.rift.dropGems(n, x, y - e.m.stats.bodyY * CHAMPION_SIZE);
      riftHud.calls.push({ text: 'Champion slain', sub: `+${n} gems`, tint: 0x9ff6ff });
    } else if (riftMods.gems > 0 && Math.random() < FORTUNE_CHANCE * riftMods.gems * riftMods.odds) {
      riftHud.gems += 1;
      this.rift.dropGems(1, x, y - e.m.stats.bodyY);
    }
  }

  /** The wave is beaten: the tears narrow, the fallen rise, the hero catches their breath, and blessings are offered. */
  private cleared(): void {
    riftHud.phase = 'cleared';
    this.timer = CLEARED_PAUSE;
    this.arena.setWave(false);
    const hero = this.rift.hero();
    if (hero.vitals.alive) {
      const got = hero.vitals.heal(Math.round(hero.vitals.max * CLEAR_HEAL));
      if (got > 0) this.host.popNumber(Math.round(hero.x), Math.round(hero.y) - 38, `+${got}`, 0x9dff9a);
    } else this.rift.revive();
    riftHud.calls.push({ text: `Wave ${riftHud.wave} cleared`, sub: '', tint: 0x9dffb0 });
    sound.ultReady();
  }

  /** Three blessings not yet taken as often as they may be. */
  private offer(): void {
    const open = BLESSINGS.filter((b) => riftHud.taken.filter((t) => t === b.id).length < b.max);
    const offer: Blessing[] = [];
    while (offer.length < 3 && open.length) offer.push(open.splice(Math.floor(Math.random() * open.length), 1)[0]);
    riftHud.offer = offer;
    riftHud.pick = -1;
    riftHud.phase = 'bless';
    this.offerT = 0;
  }

  private bless(b: Blessing): void {
    const hero = this.rift.hero();
    const before = hero.vitals.max;
    b.apply(riftMods, hero);
    this.grown += hero.vitals.max - before;
    riftHud.taken.push(b.id);
    riftHud.offer = null;
    riftHud.pick = -1;
    riftHud.phase = 'rest';
    this.timer = REST;
    sound.gear();
    this.readyUp();
  }

  /** A follower tells the host its blessing is chosen. */
  private readyUp(): void {
    if (this.follower) session.send({ t: 'rb', r: this.run, w: riftHud.wave });
  }

  /** The host has moved on while this player is still on the last wave: they rise, and a blessing is chosen for them. */
  private catchUp(): void {
    if (riftHud.wave > 0 && (riftHud.phase === 'intro' || riftHud.phase === 'fight')) this.cleared();
    if (riftHud.phase === 'cleared') this.offer();
    if (riftHud.phase === 'bless' && riftHud.offer) this.bless(riftHud.pick >= 0 ? riftHud.offer[riftHud.pick] : pickOne(riftHud.offer));
  }

  /** The hero has fallen: alone the run ends; with friends they lie till the wave is beaten. */
  fell(): void {
    if (session.active && session.peers.size > 0) riftHud.calls.push({ text: 'Fallen', sub: 'You rise when the wave is beaten', tint: 0xffb0a0 });
    else this.end();
  }

  /** The run is over (alone, the hero has fallen; online, every hero): its wave is kept if it's a best. */
  end(reached?: number): void {
    if (riftHud.phase === 'over') return;
    // The wave in hand counts only once it's cleared.
    reached ??= between(riftHud.phase) ? riftHud.wave : riftHud.wave - 1;
    const key = riftKey(riftHud.cls, riftHud.difficulty);
    riftHud.best = collection.riftBest(key);
    riftHud.newBest = reached > 0 && collection.recordRift(key, reached);
    riftHud.wave = reached;
    riftHud.phase = 'over';
    riftHud.offer = null;
    this.arena.setWave(false);
  }

  /** A new run in the same room, from the results' "Again": the rift starts over with everyone standing. */
  private restart(run: number): void {
    for (const e of this.entries) e.m.destroy();
    this.entries = [];
    this.queue = [];
    this.run = run;
    this.nextSlot = 0;
    this.hostQueue = 0;
    const hero = this.rift.hero();
    if (this.grown) hero.vitals.grow(-this.grown);
    this.grown = 0;
    this.rift.revive();
    hero.vitals.reset();
    Object.assign(riftMods, NEUTRAL, { odds: this.diff.odds });
    resetHud(this.cls, this.className, this.diff.id);
    if (!this.follower) this.startWave(1);
  }

  /** Play on the host's difficulty. */
  private adopt(d: RiftDifficulty): void {
    if (d === this.diff.id) return;
    this.diff = difficultyDef(d);
    riftMods.odds = this.diff.odds;
    riftMods.fury = fury(Math.max(1, riftHud.wave)) * this.diff.hit;
    riftHud.difficulty = d;
    riftHud.best = collection.riftBest(riftKey(this.cls, d));
  }

  // ---------------------------------------------------------------- Online

  private receive(m: Msg): void {
    switch (m.t) {
      case 'rm':
        // The host brought a monster out.
        if (!this.follower || m.r !== this.run || this.entries.some((e) => e.m.slot === m.i)) break;
        this.nextSlot = Math.max(this.nextSlot, (m.i as number) + 1);
        this.bring(m);
        break;
      case 'rb':
        if (!this.follower && m.r === this.run && m.w === riftHud.wave && m.f !== undefined) this.ready.add(m.f);
        break;
      case 'ra':
        // Someone pressed "Again".
        if ((m.r as number) > this.run) this.restart(m.r as number);
        break;
      case 'peer+': {
        // Someone joined mid-run: show them the monsters standing.
        if (this.follower) break;
        const id = (m.p as { id: number }).id;
        for (const e of this.entries) if (!e.counted && e.made) session.send({ ...e.made, x: Math.round(e.m.x), y: Math.round(e.m.y) }, id);
        break;
      }
      case 'host':
        this.waitT = 0;
        if (session.isHost && this.follower) {
          // This player now runs the rift. What the last host still had waiting at the tears comes out here instead.
          this.follower = false;
          if ((riftHud.phase === 'intro' || riftHud.phase === 'fight') && this.hostQueue > 0) this.queue = this.compose(riftHud.wave).slice(-this.hostQueue);
          this.timer = Math.min(this.timer, INTRO);
        } else if (riftHud.phase === 'rest') this.readyUp(); // A new host never heard who had chosen a blessing: say it again.
        break;
    }
  }

  find(slot: number, gen: number): Monster | null {
    if (gen !== this.run) return null;
    return this.entries.find((e) => e.m.slot === slot && !e.m.dead)?.m ?? null;
  }

  snapshot(): RiftSnap {
    const l: MonsterSnap[] = [];
    for (const { m } of this.entries) if (!m.dead) l.push([m.slot, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, Math.round(m.hp * 10) / 10, m.alive || m.state === 'spawn' ? 0 : 1]);
    return { g: [], l, r: this.run, w: riftHud.wave, p: riftHud.phase, q: this.queue.length, d: this.diff.id };
  }

  /** Follow the host's rift: its run, wave and phase, and where its monsters stand. */
  sync(snap: SpawnerSnap): void {
    if (!this.follower) return;
    const s = snap as RiftSnap;
    if (s.r < this.run) return;
    if (s.r > this.run) this.restart(s.r);
    this.adopt(s.d);
    this.hostQueue = s.q;
    if (s.p === 'over') this.end(s.w);
    else if (riftHud.phase !== 'over') {
      if (s.w > riftHud.wave) {
        if (between(s.p)) {
          // Joined between waves: wait with the others for the next.
          riftHud.wave = s.w;
          riftHud.phase = 'rest';
          this.arena.setWave(false);
          this.readyUp();
        } else {
          this.catchUp();
          this.startWave(s.w);
          if (s.p === 'fight') riftHud.phase = 'fight';
        }
      } else if (s.w === riftHud.wave) {
        if (s.p === 'fight' && riftHud.phase === 'intro') riftHud.phase = 'fight';
        else if (between(s.p) && (riftHud.phase === 'intro' || riftHud.phase === 'fight')) this.cleared();
      }
    }

    const now = this.host.time.now;
    const seen = new Set<number>();
    for (const e of s.l) {
      seen.add(e[0]);
      const en = this.entries.find((x) => x.m.slot === e[0]);
      if (!en || en.m.dead) continue;
      en.net = { x: e[1], y: e[2] };
      if (e[4]) {
        en.m.netKill(false);
        continue;
      }
      // Health: the host's, unless a blow landed here a moment ago and the host hasn't counted it yet.
      if (now - en.m.lastHitAt > 450 || e[3] < en.m.hp) en.m.hp = Math.min(en.m.maxHp, e[3]);
    }
    // Fallen for the host: fall here too.
    for (const en of this.entries) if (!seen.has(en.m.slot)) en.m.netKill(false);
  }

  /** Ease each monster toward where the host has it (before they move this frame). */
  follow(dt: number): void {
    const k = 1 - Math.exp(-dt / 140);
    for (const { m, net } of this.entries) {
      if (!net || !m.alive) continue;
      const dx = net.x - m.x;
      const dy = net.y - m.y;
      if (dx * dx + dy * dy > SNAP_DIST * SNAP_DIST) {
        m.x = net.x;
        m.y = net.y;
      } else {
        m.x += dx * k;
        m.y += dy * k;
      }
    }
  }

  /** The world is closing: stop listening to the room. */
  detach(): void {
    this.off();
  }

  destroy(): void {
    this.off();
    for (const e of this.entries) e.m.destroy();
    this.entries = [];
    riftHud.active = false;
    Object.assign(riftMods, NEUTRAL);
  }
}

/** The target nearest `m`, or null when there is none. */
function nearest(m: Monster, targets: Target[]): Target | null {
  let best: Target | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = (t.x - m.x) ** 2 + (t.y - m.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
