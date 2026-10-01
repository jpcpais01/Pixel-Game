// The Aurora Colosseum's waves: the Long Winter's hosts pour in through the
// arches of the north wall and up the stairs of the crag, wave after wave,
// on the same runner, blessings, difficulties, gems and online play as the
// Endless Rift (game/rift.ts), with creatures of its own. Every fifth wave a
// boss comes through the Great Gate, the five in turn (three Legends, two
// Myths) and round again, tougher each time; from the sixth wave on, the odd
// foe is an elite: bigger, three times as tough, and worth a gem.
//
// A wave isn't a random handful: it comes as a few packs, each of one kind
// (a wolf pack, a flight of sprites, a shield wall...), so every wave has a
// shape to read and an answer to find.

import { BOSS_TITLES } from './BossIntro';
import { WAVE_COST, type WaveFoe, type WavePlan } from './rift';
import type { MonsterKind } from './monsters';
import { GATES } from '../world/frostLayout';

/** The colosseum's creatures by how much of a wave's budget they take. */
const WEAK: MonsterKind[] = ['snowmite', 'rimesprite', 'icebeak', 'rimeweaver', 'flurrykin'];
const NORMAL: MonsterKind[] = ['rimefang', 'frostbound', 'rimewitch', 'galeclaw', 'chillstone', 'snowstalker'];
const STRONG: MonsterKind[] = ['frost_troll', 'tuskmaw', 'frostdrake', 'yeti', 'rimeknight'];

/** The bosses in turn, every fifth wave: Vargr, the Snow Queen, Ymir, Kaldr, Aurelith. */
const BOSSES: MonsterKind[] = ['vargr', 'snowqueen', 'colossus', 'winterking', 'aurelith'];

/** How many of a kind come together in a pack, by tier. Wolves hunt in bigger packs. */
const PACK: Record<'weak' | 'normal' | 'strong', [number, number]> = { weak: [3, 5], normal: [2, 3], strong: [1, 2] };
const WOLF_PACK: [number, number] = [3, 4];
/** A boss's wave brings this share of the usual foes with it. */
const BOSS_WAVE_SHARE = 0.55;
/** Elites: from this wave, each normal or strong foe has this chance (growing a little a wave, to a cap) of being one. */
const ELITE_FROM = 6;
const ELITE_ODDS = 0.04;
const ELITE_STEP = 0.012;
const ELITE_MAX = 0.3;

const rand = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const between = ([a, b]: [number, number]) => a + Math.floor(Math.random() * (b - a + 1));

/**
 * The tiers a wave draws on, and their weights: the weak alone at first,
 * the normal from the third wave, the strong from the sixth; the weak thin
 * out as the waves grow.
 */
function tierWeights(n: number): Record<'weak' | 'normal' | 'strong', number> {
  return {
    weak: Math.max(1, 6 - n * 0.35),
    normal: n >= 3 ? Math.min(6, n - 1) : 0,
    strong: n >= 6 ? Math.min(5, (n - 4) * 0.6) : 0,
  };
}

export const FROST_PLAN: WavePlan = {
  id: 'frost',
  gates: GATES.map((g) => ({ x: g.ox, y: g.oy })),
  // Bosses come through the Great Gate.
  championGates: [0],
  compose(n, left) {
    if (n % 5 === 0) left = Math.round(left * BOSS_WAVE_SHARE);
    const weights = tierWeights(n);
    const elite = n >= ELITE_FROM ? Math.min(ELITE_MAX, ELITE_ODDS + (n - ELITE_FROM) * ELITE_STEP) : 0;
    const out: WaveFoe[] = [];
    let last: MonsterKind | null = null;
    while (left > 0) {
      const total = weights.weak + weights.normal + weights.strong;
      let r = Math.random() * total;
      const tier = (r -= weights.weak) < 0 ? 'weak' : (r -= weights.normal) < 0 ? 'normal' : 'strong';
      const kinds = tier === 'weak' ? WEAK : tier === 'normal' ? NORMAL : STRONG;
      const cost = WAVE_COST[tier];
      if (cost > left && tier !== 'weak') continue;
      // A pack of one kind, never the same kind twice running.
      let kind = rand(kinds);
      if (kind === last) kind = rand(kinds);
      last = kind;
      const size = between(kind === 'rimefang' ? WOLF_PACK : PACK[tier]);
      for (let i = 0; i < size && left > 0; i++) {
        if (cost > left && tier !== 'weak') break;
        out.push({ kind, champion: false, elite: tier !== 'weak' && Math.random() < elite });
        left -= cost;
      }
    }
    return out;
  },
  champion(n) {
    const kind = BOSSES[(n / 5 - 1) % BOSSES.length];
    return { kind, name: BOSS_TITLES[kind]?.name ?? 'Boss', boss: true };
  },
  championCall(n) {
    const kind = BOSSES[(n / 5 - 1) % BOSSES.length];
    const t = BOSS_TITLES[kind];
    return t ? `${t.epithet} comes` : 'A boss comes';
  },
  championTint: 0x9ae8ff,
};
