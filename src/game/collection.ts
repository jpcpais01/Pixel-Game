// Everything the player has picked up, and the six items they keep equipped.
// It's kept on the device for guests, and in the player's cloud save once
// they log in (see cloud.ts); a guest's pickups carry over into the account
// they log into. Changes save a moment later, so a burst of pickups is one
// write.

import { account, cloudReady, loadSave, onAccount, writeSave, type SaveData } from './cloud';

export const EQUIP_SLOTS = 6;
const LOCAL_PREFIX = 'pixel-battle.save.';
const SAVE_DELAY = 1500;

const empty = (): SaveData => ({ items: {}, equipped: new Array(EQUIP_SLOTS).fill(null) });

/** Tidy a save from storage: whole positive counts, six slots, nothing equipped that isn't owned or twice. */
function clean(d: Partial<SaveData> | null | undefined): SaveData {
  const out = empty();
  for (const [id, n] of Object.entries(d?.items ?? {})) if (n > 0) out.items[id] = Math.floor(n);
  const seen = new Set<string>();
  (d?.equipped ?? []).slice(0, EQUIP_SLOTS).forEach((id, i) => {
    if (id && out.items[id] && !seen.has(id)) {
      out.equipped[i] = id;
      seen.add(id);
    }
  });
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
    this.data = readLocal(this.key) ?? empty();
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

  isEquipped(id: string): boolean {
    return this.data.equipped.includes(id);
  }

  /** Put `id` in slot `slot`, or the first empty one. Returns false when it can't be. */
  equip(id: string, slot?: number): boolean {
    if (!this.count(id)) return false;
    const eq = this.data.equipped;
    const i = slot ?? eq.indexOf(null);
    if (i < 0 || i >= EQUIP_SLOTS) return false;
    const was = eq.indexOf(id);
    if (was >= 0) eq[was] = null;
    eq[i] = id;
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
      if (guest) {
        for (const [id, n] of Object.entries(guest.items)) merged.items[id] = (merged.items[id] ?? 0) + n;
        guest.equipped.forEach((id, i) => {
          if (id && !merged.equipped[i] && !merged.equipped.includes(id)) merged.equipped[i] = id;
        });
        writeLocal('guest', null);
      }
      this.data = clean(merged);
      this.status = 'idle';
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
    this.data = readLocal(key) ?? empty();
    if (key === 'guest') {
      this.status = 'idle';
      this.emit();
      return;
    }
    // Logging in from a guest game brings its pickups along.
    void this.pull(guest && Object.keys(guest.items).length ? guest : undefined);
  }
}

export const collection = new Collection();
