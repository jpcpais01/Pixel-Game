// The Endless Rift: waves of monsters pour out of tears round a platform in
// the void, each wave bigger and tougher than the last, a Riftborn Champion
// with every fifth. Between waves the hero heals a little and picks one of
// three blessings, which last the whole run. When the hero falls the run is
// over, and the furthest wave is kept, per class, as a best.
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
import { MONSTERS, Spawner, type Monster, type MonsterKind, type Target } from './monsters';
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
  /** The current wave's monsters' blows, as times their own. */
  fury: number;
}

const NEUTRAL: RiftMods = { damage: 1, speed: 1, guard: 1, leech: 0, regen: 0, energy: 1, gems: 0, fury: 1 };

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
};

/** Out of the Rift: its blessings count for nothing, and its overlay has nothing to show. */
export function resetRift(): void {
  Object.assign(riftMods, NEUTRAL);
  riftHud.active = false;
}

function resetHud(cls: string, className: string): void {
  Object.assign(riftHud, { active: true, phase: 'intro', wave: 0, left: 0, kills: 0, gems: 0, champion: null, offer: null, pick: -1, taken: [], calls: [], best: collection.riftBest(cls), newBest: false, cls, className });
}

// ---------------------------------------------------------------- The waves

interface Entry {
  m: Monster;
  kind: MonsterKind;
  champion: boolean;
  /** Its death has been counted. */
  counted: boolean;
}

/** What the rift needs of the world it runs in. */
export interface RiftHost {
  hero(): Hero;
  /** Gems falling at (x, y). */
  dropGems(n: number, x: number, y: number): void;
}

const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Stands in for the arena's Spawner: runs the waves, one after another, until the hero falls. */
export class RiftWaves extends Spawner {
  private entries: Entry[] = [];
  private queue: { kind: MonsterKind; champion: boolean }[] = [];
  private timer = INTRO_FIRST;
  private spawnT = 0;

  constructor(
    private host: WorldScene,
    private arena: RiftArena,
    private rift: RiftHost,
    cls: string,
    className: string,
  ) {
    super(host, [], 9000);
    Object.assign(riftMods, NEUTRAL);
    resetHud(cls, className);
    this.startWave(1);
  }

  get monsters(): Monster[] {
    return this.entries.map((e) => e.m);
  }

  private startWave(n: number): void {
    riftHud.wave = n;
    riftHud.phase = 'intro';
    riftMods.fury = fury(n);
    this.timer = n === 1 ? INTRO_FIRST : INTRO;
    this.queue = this.compose(n);
    riftHud.left = this.queue.length;
    const champ = n % CHAMPION_EVERY === 0;
    riftHud.calls.push({ text: `Wave ${n}`, sub: champ ? 'A champion comes' : n === 1 ? 'The rift opens' : '', tint: champ ? 0xff7ad0 : 0xf4cf6a });
    this.arena.setWave(true);
  }

  /**
   * A wave's monsters: its budget spent on a few kinds from each tier it has
   * reached (normal from wave 3, strong from wave 6), cheaper kinds thinning
   * out as the waves go on; with a champion last, every fifth wave.
   */
  private compose(n: number): { kind: MonsterKind; champion: boolean }[] {
    const kinds = {
      weak: [pickOne(WEAK), pickOne(WEAK), pickOne(WEAK)],
      normal: n >= 3 ? [pickOne(NORMAL), pickOne(NORMAL)] : [],
      strong: n >= 6 ? [pickOne(STRONG), pickOne(STRONG)] : [],
    };
    const weights = { weak: Math.max(1, 6 - n * 0.4), normal: n >= 3 ? Math.min(6, n - 1) : 0, strong: n >= 6 ? Math.min(5, (n - 4) * 0.6) : 0 };
    const champ = n % CHAMPION_EVERY === 0;
    let left = Math.round(budget(n) * (champ ? 0.7 : 1));
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

  /** Step a monster out of a tear, not too near the hero. */
  private spawn(next: { kind: MonsterKind; champion: boolean }, hero: Target | null): void {
    const far = TEARS.map((t, i) => ({ t, i })).filter(({ t }) => !hero || Math.hypot(t.x - hero.x, t.y - hero.y) > TEAR_KEEP_AWAY);
    const { t, i } = pickOne(far.length ? far : TEARS.map((t, i) => ({ t, i })));
    const m = MONSTERS[next.kind](this.host, t.x + (Math.random() - 0.5) * 6, t.y + 3);
    m.hunter = true;
    m.toughness = toughness(riftHud.wave) * (next.champion ? CHAMPION_TOUGH : 1);
    if (next.champion) m.size = CHAMPION_SIZE;
    m.hp = m.maxHp;
    this.entries.push({ m, kind: next.kind, champion: next.champion, counted: false });
    this.arena.flare(i);
    if (next.champion) {
      riftHud.calls.push({ text: CHAMPION_NAME[next.kind] ?? 'Riftborn Champion', sub: 'Champion', tint: 0xff7ad0 });
      this.host.cameras.main.shake(260, 0.002);
      sound.slam(this.host.pan(t.x));
    }
  }

  update(dt: number, targets: Target[], daylight: number): void {
    const hero = targets[0] ?? null;
    for (const e of this.entries) {
      e.m.update(e.m.warp(dt), nearest(e.m, targets), daylight);
      if (!e.counted && (e.m.state === 'dying' || e.m.dead)) this.slain(e);
    }
    this.entries = this.entries.filter((e) => !e.m.dead);
    const standing = this.entries.filter((e) => !e.counted);
    const champ = standing.find((e) => e.champion);
    riftHud.champion = champ ? { name: CHAMPION_NAME[champ.kind] ?? 'Champion', hp: Math.max(0, champ.m.hp), max: champ.m.maxHp } : null;
    riftHud.left = this.queue.length + standing.length;

    switch (riftHud.phase) {
      case 'intro':
        this.timer -= dt;
        if (this.timer <= 0) riftHud.phase = 'fight';
        break;
      case 'fight':
        this.spawnT -= dt;
        if (this.queue.length && this.spawnT <= 0 && standing.length < maxAlive(riftHud.wave)) {
          this.spawnT = SPAWN_EVERY;
          this.spawn(this.queue.shift()!, hero);
        }
        if (!this.queue.length && !standing.length) this.cleared();
        break;
      case 'cleared':
        this.timer -= dt;
        if (this.timer <= 0) this.offer();
        break;
      case 'bless':
        if (riftHud.pick >= 0 && riftHud.offer) this.bless(riftHud.offer[riftHud.pick]);
        break;
      case 'rest':
        this.timer -= dt;
        if (this.timer <= 0) this.startWave(riftHud.wave + 1);
        break;
      case 'over':
        break;
    }
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
    } else if (riftMods.gems > 0 && Math.random() < FORTUNE_CHANCE * riftMods.gems) {
      riftHud.gems += 1;
      this.rift.dropGems(1, x, y - e.m.stats.bodyY);
    }
  }

  /** The wave is beaten: the tears narrow, the hero catches their breath, and blessings are offered. */
  private cleared(): void {
    riftHud.phase = 'cleared';
    this.timer = CLEARED_PAUSE;
    this.arena.setWave(false);
    const hero = this.rift.hero();
    if (hero.vitals.alive) {
      const got = hero.vitals.heal(Math.round(hero.vitals.max * CLEAR_HEAL));
      if (got > 0) this.host.popNumber(Math.round(hero.x), Math.round(hero.y) - 38, `+${got}`, 0x9dff9a);
    }
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
  }

  private bless(b: Blessing): void {
    b.apply(riftMods, this.rift.hero());
    riftHud.taken.push(b.id);
    riftHud.offer = null;
    riftHud.pick = -1;
    riftHud.phase = 'rest';
    this.timer = REST;
    sound.gear();
  }

  /** The hero has fallen: the run ends, and its wave is kept if it's a best. */
  end(): void {
    if (riftHud.phase === 'over') return;
    // The wave in hand counts only once it's cleared.
    const reached = riftHud.phase === 'cleared' || riftHud.phase === 'bless' || riftHud.phase === 'rest' ? riftHud.wave : riftHud.wave - 1;
    riftHud.best = collection.riftBest(riftHud.cls);
    riftHud.newBest = reached > 0 && collection.recordRift(riftHud.cls, reached);
    riftHud.wave = reached;
    riftHud.phase = 'over';
    riftHud.offer = null;
    this.arena.setWave(false);
  }

  destroy(): void {
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
