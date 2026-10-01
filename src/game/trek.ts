// The explorer's map of the Everwood: how much of it the player has walked,
// the campfires they have rested at (each one a place to travel back to),
// and the secret places the White Stag has shown them. The forest is always
// the same one (EVERWOOD_SEED), so this is all that needs keeping: the map
// itself is painted again from the forest (see art/mapArt.ts). Saved in the
// player's save as one short string, `t1|squares|fires|secrets`.

import { FOG_CELL } from '../art/mapArt';
import { CHUNK, FOREST_MID } from '../world/forestGen';
import { collection } from './collection';

/** How far round the hero (px) the map fills in as they walk. */
export const SIGHT = 200;
/** Saved at most this often (ms) while the map grows; it is saved on leaving too. */
const SAVE_MS = 20000;
/** Most chunks the map remembers, so it always fits in the save. */
const MAX_CHUNKS = 12000;
/** Fog squares to a chunk's side (4: a chunk's squares fit one 16-bit mask). */
const F = CHUNK / FOG_CELL;
const MID = FOREST_MID / CHUNK;

export type SecretKind = 'spring' | 'grove' | 'hollow';

export interface Fire {
  id: number;
  x: number;
  y: number;
}

const chunkKey = (cx: number, cy: number): number => cx * 4096 + cy;

class Trek {
  /** Each walked chunk's fog squares, a bit each. */
  private masks = new Map<number, number>();
  /** Campfires rested at, by id. */
  fires = new Map<number, Fire>();
  secrets: { kind: SecretKind; x: number; y: number }[] = [];
  /** Each wood walked in (by its region cell), and the middle of where in it the hero has walked: its name goes there. */
  regions = new Map<string, { ci: number; cj: number; x: number; y: number; n: number }>();
  /** Chunks whose squares changed since the map last looked (it repaints them and their neighbours). */
  readonly fresh = new Set<number>();
  /** Raised whenever anything on the map changes. */
  version = 0;
  private loaded = '';
  private dirty = false;
  private saveT = 0;

  /** Read the saved map (again, if the save changed under it: a login). */
  load(): void {
    const s = collection.trek;
    if (s === this.loaded && this.version) return;
    this.loaded = s;
    this.masks.clear();
    this.fires.clear();
    this.secrets = [];
    this.regions.clear();
    this.version++;
    if (!s.startsWith('t1|')) return;
    const [, squares = '', fires = '', secrets = '', regions = ''] = s.split('|');
    for (const item of squares ? squares.split(',') : []) {
      const [dx, dy, m] = item.split('.').map((n) => parseInt(n, 36));
      if (Number.isFinite(dx) && Number.isFinite(dy) && m > 0 && this.masks.size < MAX_CHUNKS) this.masks.set(chunkKey(MID + dx, MID + dy), m & 0xffff);
    }
    for (const item of fires ? fires.split(',') : []) {
      const [id, dx, dy] = item.split('.').map((n) => parseInt(n, 36));
      if ([id, dx, dy].every(Number.isFinite)) this.fires.set(id, { id, x: FOREST_MID + dx, y: FOREST_MID + dy });
    }
    for (const item of secrets ? secrets.split(',') : []) {
      const [kind, xs, ys] = item.split('.');
      const x = parseInt(xs, 36);
      const y = parseInt(ys, 36);
      if ((kind === 'spring' || kind === 'grove' || kind === 'hollow') && Number.isFinite(x) && Number.isFinite(y)) this.secrets.push({ kind, x: FOREST_MID + x, y: FOREST_MID + y });
    }
    for (const item of regions ? regions.split(',') : []) {
      const [ci, cj, x, y, n] = item.split('.').map((v) => parseInt(v, 36));
      if ([ci, cj, x, y, n].every(Number.isFinite)) this.regions.set(`${ci},${cj}`, { ci, cj, x: FOREST_MID + x, y: FOREST_MID + y, n });
    }
  }

  private encode(): string {
    const squares = [...this.masks].map(([k, m]) => `${(Math.floor(k / 4096) - MID).toString(36)}.${((k % 4096) - MID).toString(36)}.${m.toString(36)}`).join(',');
    const fires = [...this.fires.values()].map((f) => `${f.id.toString(36)}.${Math.round(f.x - FOREST_MID).toString(36)}.${Math.round(f.y - FOREST_MID).toString(36)}`).join(',');
    const secrets = this.secrets.map((s) => `${s.kind}.${Math.round(s.x - FOREST_MID).toString(36)}.${Math.round(s.y - FOREST_MID).toString(36)}`).join(',');
    const b36 = (v: number) => Math.round(v).toString(36);
    const regions = [...this.regions.values()].map((r) => `${b36(r.ci)}.${b36(r.cj)}.${b36(r.x - FOREST_MID)}.${b36(r.y - FOREST_MID)}.${b36(r.n)}`).join(',');
    return `t1|${squares}|${fires}|${secrets}|${regions}`;
  }

  /** Has the fog square (fx, fy) (in FOG_CELL squares of the world) been walked? */
  known(fx: number, fy: number): boolean {
    const m = this.masks.get(chunkKey(Math.floor(fx / F), Math.floor(fy / F)));
    return !!m && !!(m & (1 << ((((fy % F) + F) % F) * F + (((fx % F) + F) % F))));
  }

  /** Any of chunk (cx, cy) walked? */
  seen(cx: number, cy: number): boolean {
    return !!this.masks.get(chunkKey(cx, cy));
  }

  /** The walked chunks' bounds, in chunks (null for none). */
  bounds(): { c0: number; r0: number; c1: number; r1: number } | null {
    let b: { c0: number; r0: number; c1: number; r1: number } | null = null;
    for (const k of this.masks.keys()) {
      const cx = Math.floor(k / 4096);
      const cy = k % 4096;
      if (!b) b = { c0: cx, r0: cy, c1: cx, r1: cy };
      else {
        b.c0 = Math.min(b.c0, cx);
        b.r0 = Math.min(b.r0, cy);
        b.c1 = Math.max(b.c1, cx);
        b.r1 = Math.max(b.r1, cy);
      }
    }
    return b;
  }

  /** The hero is at (x, y): the squares in sight fill in. */
  walk(x: number, y: number, dt: number): void {
    const f0x = Math.floor((x - SIGHT) / FOG_CELL);
    const f1x = Math.floor((x + SIGHT) / FOG_CELL);
    const f0y = Math.floor((y - SIGHT) / FOG_CELL);
    const f1y = Math.floor((y + SIGHT) / FOG_CELL);
    for (let fy = f0y; fy <= f1y; fy++) {
      for (let fx = f0x; fx <= f1x; fx++) {
        // Nearest point of the square to the hero, inside sight.
        const nx = Math.max(fx * FOG_CELL, Math.min(x, (fx + 1) * FOG_CELL));
        const ny = Math.max(fy * FOG_CELL, Math.min(y, (fy + 1) * FOG_CELL));
        if (Math.hypot(nx - x, (ny - y) * 1.15) > SIGHT || this.known(fx, fy)) continue;
        const cx = Math.floor(fx / F);
        const cy = Math.floor(fy / F);
        const k = chunkKey(cx, cy);
        if (!this.masks.has(k) && this.masks.size >= MAX_CHUNKS) continue;
        this.masks.set(k, (this.masks.get(k) ?? 0) | (1 << ((fy - cy * F) * F + (fx - cx * F))));
        this.fresh.add(k);
        this.changed();
      }
    }
    this.saveT += dt;
    if (this.dirty && this.saveT >= SAVE_MS) this.save();
  }

  /** The hero is in wood (ci, cj) at (x, y): its name drifts toward the middle of where they've walked in it. */
  region(ci: number, cj: number, x: number, y: number): void {
    const k = `${ci},${cj}`;
    const r = this.regions.get(k);
    if (!r) {
      this.regions.set(k, { ci, cj, x, y, n: 1 });
      this.changed();
      return;
    }
    // Later steps count less and less, so a name settles rather than wandering after the hero.
    r.n = Math.min(r.n + 1, 600);
    r.x += (x - r.x) / r.n;
    r.y += (y - r.y) / r.n;
    this.dirty = true;
  }

  /** A campfire rested at: a place to travel back to. */
  kindle(id: number, x: number, y: number): void {
    if (this.fires.has(id)) return;
    this.fires.set(id, { id, x, y });
    this.changed();
    this.save();
  }

  /** A secret place the White Stag opened, pinned where it was. */
  secret(kind: SecretKind, x: number, y: number): void {
    if (this.secrets.some((s) => s.kind === kind && Math.hypot(s.x - x, s.y - y) < 64)) return;
    this.secrets.push({ kind, x, y });
    this.changed();
    this.save();
  }

  private changed(): void {
    this.dirty = true;
    this.version++;
  }

  /** Keep it in the save now, if it changed. */
  save(): void {
    this.saveT = 0;
    if (!this.dirty) return;
    this.dirty = false;
    this.loaded = this.encode();
    collection.saveTrek(this.loaded);
  }
}

export const trek = new Trek();
