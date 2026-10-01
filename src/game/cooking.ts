// Cooking: at a kitchen stove in the house or a cooking pot over a fire in
// the garden (Home parts with `cook`), produce from the farm (farm.ts) and
// fish from the pond (fish.ts) are cooked into dishes. Dishes are kept in the
// larder; the one picked to take along fills a hotbar slot every run, and
// eating it heals or gives a short buff. The kitchen's counter is the
// cookbook too (ui/cookView.ts): every recipe is listed with what it needs,
// and its picture shows once it's been cooked.
//
// The pantry (seeds, produce, fish to cook, dishes, and how often each dish
// has been made) is one map in the player's collection; its keys are
// `seed.<crop>`, `crop.<crop>`, `fish.<fish>`, `dish.<recipe>` and `made.<recipe>`.

import { FISH, fishById, type FishDef } from './fish';
import { cropById } from './farm';
import { HOTBAR_SIZE, MAX_STACK, inventory, type ItemDef } from './items';
import type { BuffDef } from './buffs';
import { recipeById, type Ingredient, type RecipeDef } from './recipes';
import { collection } from './collection';

export { RECIPES, recipeById, type Ingredient, type RecipeDef } from './recipes';

/** The kitchen open now: the stove indoors or the pot over a fire (its counter shows which). Set by the world. */
export const cookHud = { station: 'stove' as 'stove' | 'fire' };

/** Pantry keys. */
export const seedKey = (crop: string): string => `seed.${crop}`;
export const cropKey = (crop: string): string => `crop.${crop}`;
export const fishKey = (fish: string): string => `fish.${fish}`;
export const dishKey = (dish: string): string => `dish.${dish}`;
export const madeKey = (dish: string): string => `made.${dish}`;

/** The fish an ingredient takes, in the order they're used: the commonest and most plentiful first. */
export function fishFor(of: string): FishDef[] {
  const tier = (f: FishDef) => (f.rarity === 'legendary' ? 2 : f.rarity === 'rare' ? 1 : 0);
  const ok = of === 'any' ? FISH : of === 'rare' ? FISH.filter((f) => f.rarity !== 'common') : of === 'glow' ? FISH.filter((f) => f.glow) : FISH.filter((f) => f.id === of);
  // The legend is never spent on "any fish": only a recipe asking for it by name takes it.
  return ok.filter((f) => of === f.id || f.rarity !== 'legendary').sort((a, b) => tier(a) - tier(b) || collection.stock(fishKey(b.id)) - collection.stock(fishKey(a.id)));
}

/** How many of an ingredient the pantry holds. */
export function have(i: Ingredient): number {
  if ('crop' in i) return collection.stock(cropKey(i.crop));
  return fishFor(i.fish).reduce((n, f) => n + collection.stock(fishKey(f.id)), 0);
}

/** An ingredient's name: "3 Carrots", "Any fish", "A glowing fish". */
export function ingredientName(i: Ingredient): string {
  if ('crop' in i) {
    const c = cropById(i.crop);
    return c ? (i.n > 1 ? c.many : c.one) : i.crop;
  }
  if (i.fish === 'any') return 'Any fish';
  if (i.fish === 'rare') return 'Rare fish';
  if (i.fish === 'glow') return 'Glowing fish';
  return fishById(i.fish)?.name ?? i.fish;
}

export const canCook = (r: RecipeDef): boolean => r.needs.every((i) => have(i) >= i.n);

/** Cook one of `r`: its ingredients are used up and the dish goes in the larder. True for the first ever made. */
export function cook(r: RecipeDef): boolean | null {
  if (!canCook(r)) return null;
  const take: [string, number][] = [];
  for (const i of r.needs) {
    if ('crop' in i) {
      take.push([cropKey(i.crop), i.n]);
      continue;
    }
    let left = i.n;
    for (const f of fishFor(i.fish)) {
      const n = Math.min(left, collection.stock(fishKey(f.id)));
      if (n > 0) take.push([fishKey(f.id), n]);
      left -= n;
      if (left <= 0) break;
    }
  }
  const first = collection.stock(madeKey(r.id)) === 0;
  collection.useStock(take, [
    [dishKey(r.id), 1],
    [madeKey(r.id), 1],
  ]);
  // The first dish ever cooked is taken along at once.
  if (!collection.lunch) collection.lunch = r.id;
  syncLunch();
  return first;
}

// ---------------------------------------------------------------- Eating

const dishes = new Map<string, ItemDef>();

/** A dish as a hotbar item. Eating one takes it from the larder. */
export function dishItem(id: string): ItemDef | null {
  const r = recipeById(id);
  if (!r) return null;
  let item = dishes.get(id);
  if (item) return item;
  const buff: BuffDef | null = r.buff ? { ...r.buff, id: `meal_${r.id}`, icon: `dish_${r.id}` } : null;
  item = {
    id: `dish_${r.id}`,
    name: r.name,
    icon: `dish_${r.id}`,
    drop: `dish_${r.id}`,
    tint: r.tint,
    cooldown: 1500,
    use(ctx) {
      const v = ctx.hero.vitals;
      // Only a plain healing dish is refused at full health; one with a buff is always worth eating.
      if (r.heal && !buff && !r.energy && v.hp >= v.max) {
        ctx.pop('FULL', 0xffd35c);
        return false;
      }
      if (!collection.useStock([[dishKey(r.id), 1]])) return false;
      if (r.heal) {
        const got = ctx.heal(Math.round(v.max * r.heal));
        if (got > 0) ctx.pop(`+${got}`, 0x8cff7a);
      }
      if (r.energy) ctx.charge(r.energy);
      if (buff) {
        ctx.addBuff(buff);
        ctx.pop(buff.name.toUpperCase(), r.tint);
      }
      return true;
    },
  };
  dishes.set(id, item);
  return item;
}

/** Is this hotbar item a dish? */
export const isDish = (item: ItemDef): boolean => item.id.startsWith('dish_');

/**
 * Put the dish picked to take along in the hotbar, as many as the larder
 * holds (up to a stack), or take it out when there are none left or another
 * was picked. Called as a run starts and whenever the larder changes.
 */
export function syncLunch(): void {
  const want = collection.lunch ? dishItem(collection.lunch) : null;
  const n = want ? Math.min(MAX_STACK, collection.stock(dishKey(collection.lunch))) : 0;
  let placed = false;
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const s = inventory.slots[i];
    if (!s || !isDish(s.item)) continue;
    if (s.item === want && n > 0 && !placed) {
      if (s.count !== n) inventory.flash[i] = 300;
      s.count = n;
      placed = true;
    } else inventory.slots[i] = null;
  }
  if (!placed && want && n > 0) inventory.addItem(want, n);
}
