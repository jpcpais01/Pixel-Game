// Hero stats: every type's base numbers in one table, all on one budget.
//
// The six stats:
//  - HP: max health.
//  - Damage: what one basic attack deals. A combo shares it out (the finisher
//    hits harder, the others softer), so its hits average the Damage.
//  - Defense: damage taken is multiplied by 100 / (100 + Defense), so 25 takes
//    off a fifth, 100 takes off half, and nothing is ever immune.
//  - Attack speed: basic attacks a second, held down on one target. It comes
//    from the type's animations and is measured, not set here.
//  - Move speed: walking, in world px a second.
//  - Regen: health restored every second.
//
// Abilities and Specials scale with Damage: each deals Damage times its own
// multiplier, which is whatever that blow deals in the type's code divided by
// the code's own basic hit (`kit`). So a hero with twice the Damage hits twice
// as hard with everything, and gear's Damage lifts it all alike.
//
// The budget: each stat is worth points (POINT_COST), and every type's points
// add up to about 100, never under 90 or over 110. Damage counts as damage a
// second on one foe, the normal ability's included (both measured on a
// training dummy), so a type whose ability does the killing has a lower Damage. Range and a caster's tools
// (summons, heals, control) cost points too (ROLE_POINTS), so ranged heroes pay
// for their safety with less health or Defense. Gear then adds to these (see
// gear.ts), and skins never change them.

export type Role = 'melee' | 'tank' | 'ranged' | 'caster';

export interface HeroStats {
  role: Role;
  hp: number;
  damage: number;
  defense: number;
  /** Attack speed: basic attacks a second (measured). */
  rate: number;
  /** Move speed, world px a second. */
  speed: number;
  /** HP a second. */
  regen: number;
  /** Its normal ability's damage a second, used as often as it comes back, in its code's own numbers (measured). */
  skill: number;
  /** The average basic hit in the type's own code: its abilities' multipliers are measured against it. */
  kit: number;
}

/** What one point of the budget buys: 5 HP, 1.33 damage a second (basic attacks and the normal ability), 1 Defense, 3 move speed, 0.05 regen. */
export const POINT_COST = { hp: 5, dps: 4 / 3, defense: 1, speed: 3, regen: 0.05 };

/** Points a type's range and tools cost before its stats. */
export const ROLE_POINTS: Record<Role, number> = { melee: 0, tank: 0, ranged: 12, caster: 16 };

export const BUDGET = { target: 100, min: 90, max: 110 };

/** Every type's base stats, by `class.type` id. */
export const HERO_STATS: Record<string, HeroStats> = {
  'wizard.arcane': { role: 'caster', hp: 85, damage: 15, defense: 12, rate: 1.32, speed: 58, regen: 0.8, skill: 8.6, kit: 12 },
  'wizard.pyro': { role: 'ranged', hp: 100, damage: 6, defense: 12, rate: 4.32, speed: 62, regen: 0.6, skill: 0, kit: 7.1 },
  'warrior.knight': { role: 'tank', hp: 110, damage: 9, defense: 20, rate: 2.65, speed: 60, regen: 1, skill: 10.2, kit: 13.6 },
  'warrior.king': { role: 'tank', hp: 110, damage: 11, defense: 20, rate: 2.45, speed: 56, regen: 1, skill: 1.7, kit: 15.3 },
  'paladin.holy': { role: 'tank', hp: 120, damage: 9, defense: 22, rate: 2.33, speed: 54, regen: 1, skill: 5.3, kit: 15 },
  'paladin.crusader': { role: 'melee', hp: 105, damage: 17, defense: 20, rate: 1.82, speed: 60, regen: 0.8, skill: 4, kit: 20 },
  'jedi.knight': { role: 'melee', hp: 95, damage: 9, defense: 20, rate: 3.32, speed: 64, regen: 0.8, skill: 1.7, kit: 10.5 },
  'fighter.brawler': { role: 'melee', hp: 110, damage: 7, defense: 17, rate: 3.98, speed: 62, regen: 0.8, skill: 13.1, kit: 10.4 },
  'fighter.monk': { role: 'tank', hp: 125, damage: 8, defense: 22, rate: 2.83, speed: 53, regen: 1, skill: 4, kit: 13.1 },
  'alchemist.plague': { role: 'ranged', hp: 110, damage: 5, defense: 12, rate: 4.14, speed: 60, regen: 0.6, skill: 13.1, kit: 6 },
  'alchemist.chem': { role: 'ranged', hp: 98, damage: 5, defense: 12, rate: 4.97, speed: 66, regen: 0.6, skill: 8.9, kit: 6 },
  'archer.ranger': { role: 'ranged', hp: 95, damage: 9, defense: 12, rate: 2.99, speed: 64, regen: 0.6, skill: 5, kit: 8 },
  'rogue.rogue': { role: 'melee', hp: 80, damage: 7, defense: 20, rate: 4.65, speed: 70, regen: 0.8, skill: 0, kit: 8.8 },
  'rogue.dancer': { role: 'melee', hp: 72, damage: 8, defense: 20, rate: 3.81, speed: 74, regen: 0.8, skill: 2, kit: 6.6 },
  'necromancer.necro': { role: 'caster', hp: 80, damage: 6, defense: 12, rate: 2.49, speed: 60, regen: 0.8, skill: 17, kit: 7 },
  'necromancer.blood': { role: 'caster', hp: 100, damage: 8, defense: 11, rate: 2.65, speed: 62, regen: 0.8, skill: 2.7, kit: 6 },
  'bard.minstrel': { role: 'caster', hp: 85, damage: 9, defense: 12, rate: 2.16, speed: 64, regen: 0.8, skill: 0, kit: 7 },
  'bard.drummer': { role: 'tank', hp: 115, damage: 10, defense: 22, rate: 2.33, speed: 58, regen: 1, skill: 0.5, kit: 11 },
  'chronomancer.keeper': { role: 'caster', hp: 82, damage: 10, defense: 12, rate: 2.15, speed: 60, regen: 0.8, skill: 1.7, kit: 8 },
  'chronomancer.paradox': { role: 'ranged', hp: 92, damage: 6, defense: 12, rate: 4.49, speed: 66, regen: 0.6, skill: 1.3, kit: 7.1 },
  'puppeteer.marionette': { role: 'ranged', hp: 105, damage: 12, defense: 12, rate: 2.15, speed: 60, regen: 0.6, skill: 8, kit: 13.8 },
  'puppeteer.weaver': { role: 'caster', hp: 80, damage: 9, defense: 12, rate: 2.49, speed: 66, regen: 0.8, skill: 2.2, kit: 8 },
  'samurai.bladewind': { role: 'melee', hp: 90, damage: 8, defense: 20, rate: 3.99, speed: 66, regen: 0.8, skill: 3, kit: 11.3 },
  'samurai.ronin': { role: 'melee', hp: 100, damage: 10, defense: 20, rate: 2.99, speed: 60, regen: 0.8, skill: 3, kit: 11 },
  'druid.grove': { role: 'caster', hp: 85, damage: 6, defense: 12, rate: 2.33, speed: 58, regen: 0.8, skill: 19, kit: 7.5 },
  'druid.wild': { role: 'melee', hp: 110, damage: 12, defense: 20, rate: 1.49, speed: 64, regen: 0.8, skill: 12, kit: 11.3 },
  'valkyrie.spear': { role: 'melee', hp: 100, damage: 12, defense: 20, rate: 2.49, speed: 62, regen: 0.8, skill: 6.2, kit: 13 },
  'valkyrie.storm': { role: 'melee', hp: 95, damage: 12, defense: 20, rate: 2.49, speed: 64, regen: 0.8, skill: 5, kit: 13 },
  'automaton.mech': { role: 'tank', hp: 120, damage: 5, defense: 23, rate: 4.48, speed: 50, regen: 1, skill: 3.5, kit: 6.6 },
  'automaton.synth': { role: 'ranged', hp: 95, damage: 7, defense: 12, rate: 3.65, speed: 66, regen: 0.6, skill: 10.4, kit: 7.7 },
  'phantom.poltergeist': { role: 'ranged', hp: 95, damage: 9, defense: 12, rate: 2.98, speed: 64, regen: 0.6, skill: 2.5, kit: 11.2 },
  'phantom.wraith': { role: 'melee', hp: 100, damage: 2.5, defense: 19, rate: 13.9, speed: 58, regen: 0.8, skill: 2.7, kit: 3.6 },
};

/** An even spread on the budget, for a type not in the table yet (its Damage scale is 1: its code's own numbers). */
const UNLISTED: Omit<HeroStats, 'kit'> = { role: 'melee', hp: 100, damage: 10, defense: 15, rate: 3, speed: 60, regen: 0.8, skill: 0 };

/**
 * A type's base stats. A new type needs its own line in HERO_STATS; until it
 * has one it plays on its class's first type's stats, or an even spread, so a
 * missing line never stops the game (a dev build says so).
 */
export function heroStats(cls: string, type: string): HeroStats {
  const s = HERO_STATS[`${cls}.${type}`];
  if (s) return s;
  if (import.meta.env.DEV) console.warn(`No stats for ${cls}.${type}: add it to HERO_STATS`);
  const kin = Object.keys(HERO_STATS).find((k) => k.startsWith(`${cls}.`));
  return kin ? HERO_STATS[kin] : { ...UNLISTED, kit: UNLISTED.damage };
}

/** Damage a second on one foe: basic attacks, plus the normal ability used whenever it is ready. */
export const dps = (s: HeroStats): number => s.damage * s.rate + s.skill * damageScale(s);

/** What a type's stats add up to on the budget. */
export function budget(s: HeroStats): number {
  const c = POINT_COST;
  return ROLE_POINTS[s.role] + s.hp / c.hp + dps(s) / c.dps + s.defense / c.defense + s.speed / c.speed + s.regen / c.regen;
}

/** How much of a blow gets through `defense`. */
export const defenseFactor = (defense: number): number => 100 / (100 + Math.max(0, defense));

/** What every blow in a type's code is multiplied by, so its basic attack deals its Damage. */
export const damageScale = (s: HeroStats): number => s.damage / s.kit;

if (import.meta.env.DEV) {
  for (const [id, s] of Object.entries(HERO_STATS)) {
    const p = budget(s);
    if (p < BUDGET.min || p > BUDGET.max) console.warn(`${id} is off budget: ${p.toFixed(1)} points`);
  }
}
