// Everything the player has picked up, and the six items they keep equipped.
// It's kept on the device for guests, and in the player's cloud save once
// they log in (see cloud.ts); a guest's pickups carry over into the account
// they log into. Changes save a moment later, so a burst of pickups is one
// write.

import { DUST_VALUE, MAX_LEVEL, STAT_KEYS, SLOTS, UPGRADE_REFUND, canUpgrade, dustSpent, gearById, levelled, upgradeCost, type GearDef, type StatKey } from './gear';
import { account, cloudReady, loadSave, onAccount, writeSave, type SaveData } from './cloud';

/** One slot per gear type, in the order of SLOTS: equipped[i] holds a SLOTS[i] piece. */
export const EQUIP_SLOTS = SLOTS.length;
const LOCAL_PREFIX = 'pixel-battle.save.';
const SAVE_DELAY = 1500;
/** Every player starts with this many gems, and is given DAILY_GEMS more on each new day they play. */
export const START_GEMS = 200;
export const DAILY_GEMS = 5;
/** Accounts (by username, lower case) that own every skin. */
const ADMINS = ['kel'];
/** One-off gifts of gems to an account (by username, lower case), each given once and remembered in its save by id. */
const GRANTS: { id: string; user: string; gems: number }[] = [
  { id: 'kel-100k', user: 'kel', gems: 100000 },
  { id: 'keldog-10k', user: 'keldog', gems: 10000 },
];
/** Set once this device has given a guest the welcome gems, so a fresh guest game can't be made again and again for more. */
const WELCOMED_KEY = 'pixel-battle.welcomed';

const empty = (gems = 0): SaveData => ({ items: {}, equipped: new Array(EQUIP_SLOTS).fill(null), dust: 0, upgrades: {}, gems, skins: [], daily: '', pity: 0, grants: [], rift: {}, pets: [], pet: '', petPity: 0, critters: {} });

/** The welcome gems for a new guest game: the first on this device only. */
function welcomeGems(): number {
  try {
    if (localStorage.getItem(WELCOMED_KEY)) return 0;
    localStorage.setItem(WELCOMED_KEY, '1');
  } catch {
    // No storage: nothing to farm either.
  }
  return START_GEMS;
}

/** Today on the player's own calendar, as YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The equip slot a gear id belongs in, or -1 for anything that isn't gear. */
export function slotIndex(id: string): number {
  const g = gearById(id);
  return g ? SLOTS.indexOf(g.slot) : -1;
}

/**
 * Tidy a save from storage: whole positive counts, and six slots each holding
 * an owned piece of its own type. Saves from before gear had types kept any
 * six pieces in any order; each goes to its type's slot, and when two share a
 * type the first stays on and the other is simply back in the bag.
 */
function clean(d: Partial<SaveData> | null | undefined): SaveData {
  const out = empty();
  // A save from before gems existed (or none at all) starts with the welcome gems.
  out.gems = d?.gems === undefined ? START_GEMS : Math.max(0, Math.floor(Number(d.gems) || 0));
  out.skins = [...new Set((Array.isArray(d?.skins) ? d.skins : []).filter((s): s is string => typeof s === 'string' && s.includes(':')))];
  out.daily = typeof d?.daily === 'string' ? d.daily : '';
  out.pity = Math.max(0, Math.floor(Number(d?.pity) || 0));
  out.grants = [...new Set((Array.isArray(d?.grants) ? d.grants : []).filter((g): g is string => typeof g === 'string' && !!g))];
  for (const [cls, n] of Object.entries(d?.rift ?? {})) if (Number(n) > 0) out.rift[cls] = Math.floor(Number(n));
  out.pets = [...new Set((Array.isArray(d?.pets) ? d.pets : []).filter((p): p is string => typeof p === 'string' && !!p))];
  out.pet = typeof d?.pet === 'string' ? d.pet : '';
  out.petPity = Math.max(0, Math.floor(Number(d?.petPity) || 0));
  for (const [id, n] of Object.entries(d?.critters ?? {})) if (Number(n) > 0) out.critters[id] = Math.floor(Number(n));
  for (const [id, n] of Object.entries(d?.items ?? {})) if (n > 0) out.items[id] = Math.floor(n);
  for (const id of d?.equipped ?? []) {
    const i = id ? slotIndex(id) : -1;
    if (i >= 0 && out.items[id!] && !out.equipped[i]) out.equipped[i] = id;
  }
  out.dust = Math.max(0, Math.floor(Number(d?.dust) || 0));
  // Levels only on owned pieces that can have them, each a real stat.
  for (const [id, picks] of Object.entries(d?.upgrades ?? {})) {
    const g = gearById(id);
    if (!g || !canUpgrade(g) || !out.items[id] || !Array.isArray(picks)) continue;
    const ok = picks.filter((k) => (STAT_KEYS as readonly string[]).includes(k)).slice(0, MAX_LEVEL - 1);
    if (ok.length) out.upgrades[id] = ok;
  }
  return out;
}

function readLocal(key: string): SaveData | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + key);
    return raw ? clean(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, d: SaveData | null): void {
  try {
    if (d) localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(d));
    else localStorage.removeItem(LOCAL_PREFIX + key);
  } catch {
    // Storage full or blocked: the cloud save (if any) still has it.
  }
}

type Listener = () => void;

class Collection {
  data: SaveData;
  /** 'saving' while a cloud write is queued or running, 'error' when the last one failed. */
  status: 'idle' | 'loading' | 'saving' | 'error' = 'idle';
  private key: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    const a = account();
    this.key = a ? a.uid : 'guest';
    this.data = readLocal(this.key) ?? empty(a ? 0 : welcomeGems());
    if (a) void this.pull();
    onAccount((acc) => this.switchTo(acc?.uid ?? 'guest'));
    // Leaving or backgrounding the app saves right away.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush();
    });
  }

  /** How many of `id` the player has picked up. */
  count(id: string): number {
    return this.data.items[id] ?? 0;
  }

  /** Item ids the player owns, in the order they first got them. */
  owned(): string[] {
    return Object.keys(this.data.items);
  }

  add(id: string, n = 1): void {
    this.data.items[id] = this.count(id) + n;
    this.changed();
  }

  /** Dust to spend at the Rune Temple. */
  get dust(): number {
    return this.data.dust;
  }

  /** A piece's level, 1 to MAX_LEVEL. */
  level(id: string): number {
    return 1 + (this.data.upgrades[id]?.length ?? 0);
  }

  /** The stat each of a piece's levels went into, in order. */
  picks(id: string): readonly StatKey[] {
    return this.data.upgrades[id] ?? [];
  }

  /** A piece as the player has it: its stats with the points of its levels. */
  gear(id: string): GearDef | undefined {
    const g = gearById(id);
    return g && levelled(g, this.picks(id));
  }

  /**
   * What disenchanting one `id` gives: its rarity's dust, and when it is the
   * last one, part of the dust spent upgrading it. Null when it can't be: none
   * owned, or the only one is being worn.
   */
  disenchantValue(id: string): number | null {
    const g = gearById(id);
    const n = this.count(id);
    if (!g || !n || (n === 1 && this.isEquipped(id))) return null;
    const refund = n === 1 ? Math.floor(dustSpent(g, this.level(id)) * UPGRADE_REFUND) : 0;
    return DUST_VALUE[g.rarity] + refund;
  }

  /** Break one `id` down into dust; returns the dust gained, 0 if it couldn't be. */
  disenchant(id: string): number {
    const got = this.disenchantValue(id);
    if (got === null) return 0;
    const n = this.count(id) - 1;
    if (n > 0) this.data.items[id] = n;
    else {
      delete this.data.items[id];
      delete this.data.upgrades[id];
    }
    this.data.dust += got;
    this.changed();
    return got;
  }

  /** Dust to take `id` to its next level, or null at the top (or if it can't be upgraded). */
  nextCost(id: string): number | null {
    const g = gearById(id);
    const lv = this.level(id);
    return g && canUpgrade(g) && lv < MAX_LEVEL ? upgradeCost(g, lv) : null;
  }

  /** Spend dust to raise `id` a level, its point going into `stat`. False when it can't be done. */
  upgrade(id: string, stat: StatKey): boolean {
    const cost = this.nextCost(id);
    if (cost === null || !this.count(id) || this.data.dust < cost) return false;
    this.data.dust -= cost;
    this.data.upgrades[id] = [...this.picks(id), stat];
    this.changed();
    return true;
  }

  // ---- Gems and skins ----

  get gems(): number {
    return this.data.gems;
  }

  /** Gems found (a monster's drop, a duplicate skin's refund, the daily gift). */
  addGems(n: number): void {
    if (n <= 0) return;
    this.data.gems += Math.floor(n);
    this.changed();
  }

  /** Spend `n` gems; false (and nothing spent) when there aren't enough. */
  spendGems(n: number): boolean {
    if (this.data.gems < n) return false;
    this.data.gems -= n;
    this.changed();
    return true;
  }

  /** Does the player own skin `id` ("class:skin")? Admins own them all. */
  hasSkin(id: string): boolean {
    return this.isAdmin || this.data.skins.includes(id);
  }

  /** Logged in as one of the game's admins. */
  get isAdmin(): boolean {
    const a = account();
    return !!a && ADMINS.includes(a.username.toLowerCase());
  }

  /** How many skins the player owns. */
  get skinCount(): number {
    return this.data.skins.length;
  }

  /** Give the player skin `id`; false when they had it already. */
  unlockSkin(id: string): boolean {
    if (this.hasSkin(id)) return false;
    this.data.skins.push(id);
    this.changed();
    return true;
  }

  /** The furthest wave reached in the Endless Rift with class `cls` (0 if never), or with any class. */
  riftBest(cls?: string): number {
    if (cls) return this.data.rift[cls] ?? 0;
    return Math.max(0, ...Object.values(this.data.rift));
  }

  /** A Rift run with class `cls` reached `wave`: true when that's a new best for the class. */
  recordRift(cls: string, wave: number): boolean {
    if (wave <= (this.data.rift[cls] ?? 0)) return false;
    this.data.rift[cls] = wave;
    this.changed();
    return true;
  }

  /** Does the player own companion `id`? Admins own them all. */
  hasPet(id: string): boolean {
    return this.isAdmin || this.data.pets.includes(id);
  }

  get petCount(): number {
    return this.data.pets.length;
  }

  /** Give the player companion `id`; false when they had it already. */
  unlockPet(id: string): boolean {
    if (this.hasPet(id)) return false;
    this.data.pets.push(id);
    this.changed();
    return true;
  }

  /** The companion following the player ('' for none). */
  get pet(): string {
    return this.data.pet && this.hasPet(this.data.pet) ? this.data.pet : '';
  }

  set pet(id: string) {
    this.data.pet = id && this.hasPet(id) ? id : '';
    this.changed();
  }

  /** Companion wishes since the last legendary companion. */
  get petPity(): number {
    return this.data.petPity;
  }

  set petPity(n: number) {
    this.data.petPity = n;
    this.changed();
  }

  /** How many of critter `id` the player has caught. */
  critterCount(id: string): number {
    return this.data.critters[id] ?? 0;
  }

  /** A critter caught with the net: true when it's the first of its kind. */
  catchCritter(id: string): boolean {
    const n = this.critterCount(id);
    this.data.critters[id] = n + 1;
    this.changed();
    return n === 0;
  }

  /** Wishes since the last legendary skin. */
  get pity(): number {
    return this.data.pity;
  }

  set pity(n: number) {
    this.data.pity = n;
    this.changed();
  }

  /**
   * The daily gems, once per calendar day: returns how many were given (0 if
   * today's are already in, or while the cloud save is still loading, so they
   * aren't given twice).
   */
  claimDaily(): number {
    if (this.status === 'loading') return 0;
    const d = today();
    if (this.data.daily === d) return 0;
    this.data.daily = d;
    this.data.gems += DAILY_GEMS;
    this.changed();
    return DAILY_GEMS;
  }

  /** Give the logged-in account any gift meant for it that it hasn't had yet (only once its cloud save has loaded, so it is never given twice). */
  private giveGrants(): void {
    const a = account();
    if (!a) return;
    for (const g of GRANTS) {
      if (g.user !== a.username.toLowerCase() || this.data.grants.includes(g.id)) continue;
      this.data.grants.push(g.id);
      this.data.gems += g.gems;
    }
  }

  /** Ids of the items in the equip slots, skipping empty ones. */
  equippedIds(): string[] {
    return this.data.equipped.filter((id): id is string => !!id);
  }

  /** The worn gear, one piece per filled slot. */
  equippedGear(): GearDef[] {
    return this.equippedIds()
      .map((id) => this.gear(id))
      .filter((g): g is GearDef => !!g);
  }

  /** Gear ids the player owns. */
  ownedGear(): string[] {
    return this.owned().filter((id) => slotIndex(id) >= 0);
  }

  isEquipped(id: string): boolean {
    return this.data.equipped.includes(id);
  }

  /** Put gear `id` on, in its type's slot, swapping out whatever was there. Returns false when it can't be. */
  equip(id: string): boolean {
    const i = slotIndex(id);
    if (i < 0 || !this.count(id)) return false;
    if (this.data.equipped[i] === id) return true;
    this.data.equipped[i] = id;
    this.changed();
    return true;
  }

  unequip(slot: number): void {
    if (!this.data.equipped[slot]) return;
    this.data.equipped[slot] = null;
    this.changed();
  }

  /** Call `fn` whenever the collection changes; returns the unsubscribe. */
  watch(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private changed(): void {
    writeLocal(this.key, this.data);
    this.emit();
    if (this.key === 'guest' || !cloudReady()) return;
    this.status = 'saving';
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY);
  }

  /** Write a queued change to the cloud now. */
  flush(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    const key = this.key;
    writeSave(this.data).then(
      () => {
        if (key === this.key && !this.timer) this.status = 'idle';
        this.emit();
      },
      () => {
        if (key === this.key) this.status = 'error';
        this.emit();
      },
    );
  }

  /** Fetch the cloud save and fold it into what's on the device, plus a guest game's pickups. */
  private async pull(guest?: SaveData): Promise<void> {
    const key = this.key;
    this.status = 'loading';
    this.emit();
    try {
      const remote = await loadSave();
      if (key !== this.key) return;
      // Pickups made on this device while offline aren't lost: keep the higher count.
      const local = this.data;
      const merged = clean(remote);
      for (const [id, n] of Object.entries(local.items)) merged.items[id] = Math.max(n, merged.items[id] ?? 0);
      if (!remote) merged.equipped = local.equipped;
      merged.dust = Math.max(local.dust, merged.dust);
      for (const [id, picks] of Object.entries(local.upgrades)) if (picks.length > (merged.upgrades[id]?.length ?? 0)) merged.upgrades[id] = picks;
      // Gems like dust: the higher count wins, so gems found offline aren't lost. Skins are never taken away.
      merged.gems = Math.max(local.gems, merged.gems);
      merged.skins = [...new Set([...merged.skins, ...local.skins])];
      if (local.daily > merged.daily) merged.daily = local.daily;
      merged.pity = Math.max(local.pity, merged.pity);
      merged.grants = [...new Set([...merged.grants, ...local.grants])];
      for (const [cls, n] of Object.entries(local.rift)) merged.rift[cls] = Math.max(n, merged.rift[cls] ?? 0);
      merged.pets = [...new Set([...merged.pets, ...local.pets])];
      if (!merged.pet) merged.pet = local.pet;
      merged.petPity = Math.max(local.petPity, merged.petPity);
      for (const [id, n] of Object.entries(local.critters)) merged.critters[id] = Math.max(n, merged.critters[id] ?? 0);
      if (guest) {
        for (const [id, n] of Object.entries(guest.items)) merged.items[id] = (merged.items[id] ?? 0) + n;
        merged.dust += guest.dust;
        // A guest game's skins come along; its gems only if it has more, so a guest's welcome gems aren't counted twice.
        merged.skins = [...new Set([...merged.skins, ...guest.skins])];
        merged.pets = [...new Set([...merged.pets, ...guest.pets])];
        for (const [id, n] of Object.entries(guest.critters)) merged.critters[id] = (merged.critters[id] ?? 0) + n;
        for (const [cls, n] of Object.entries(guest.rift)) merged.rift[cls] = Math.max(n, merged.rift[cls] ?? 0);
        merged.gems = Math.max(merged.gems, guest.gems);
        if (guest.daily > merged.daily) merged.daily = guest.daily;
        for (const [id, picks] of Object.entries(guest.upgrades)) if (picks.length > (merged.upgrades[id]?.length ?? 0)) merged.upgrades[id] = picks;
        guest.equipped.forEach((id, i) => {
          if (id && !merged.equipped[i]) merged.equipped[i] = id;
        });
        writeLocal('guest', null);
      }
      this.data = clean(merged);
      this.status = 'idle';
      this.giveGrants();
      this.changed();
    } catch {
      if (key === this.key) this.status = 'error';
      this.emit();
    }
  }

  private switchTo(key: string): void {
    if (key === this.key) return;
    this.flush();
    const guest = this.key === 'guest' ? this.data : null;
    this.key = key;
    this.data = readLocal(key) ?? empty(key === 'guest' ? welcomeGems() : 0);
    if (key === 'guest') {
      this.status = 'idle';
      this.emit();
      return;
    }
    // Logging in from a guest game brings its pickups along.
    void this.pull(guest && (Object.keys(guest.items).length || guest.dust || guest.skins.length || guest.pets.length || Object.keys(guest.critters).length) ? guest : undefined);
  }
}

export const collection = new Collection();
