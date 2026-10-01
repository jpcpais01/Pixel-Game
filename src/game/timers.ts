// Everything timed on the hero, for the HUD's row of timer badges under the
// minimap: a lasting Special (a vortex, a storm, a siege), the normal
// ability's own lasting effects (a turret, a consecrated circle, a
// possession) and the timed buffs. The HUD draws each as a small badge whose
// rim drains as its time runs out.
//
// A timer either counts down on its own (`run`) or reads its time from the
// thing it stands for (`follow`), so it ends the moment that thing ends,
// early or not. Starting one with a key already running replaces it.

import { ghost } from '../net/ghost';
import { heroBuffs } from './buffs';

/** Which of the hero's things it is: the HUD frames each kind its own way. */
export type TimerKind = 'special' | 'ability' | 'buff';

export interface HudTimer {
  /** Stable while it runs, for the HUD's pop-in. */
  id: string;
  kind: TimerKind;
  /** Texture drawn in the badge; '' for an ability means the ability button's own icon. */
  icon: string;
  /** Rim colour. */
  tint: number;
  /** ms */
  left: number;
  total: number;
}

/** Time left and the whole span, in ms. */
export type TimeLeft = { left: number; total: number };

interface Entry {
  key: unknown;
  id: string;
  kind: TimerKind;
  icon: string;
  tint: number;
  /** A countdown's own time; a followed one reads `read` instead. */
  left: number;
  total: number;
  read: (() => TimeLeft | null) | null;
}

/** Shorter than this and a Special or ability is over before a badge would be read. */
export const LASTING_MS = 2500;

class HeroTimers {
  private entries: Entry[] = [];
  private next = 0;
  /** Reused each frame for the HUD's read. */
  private shown: HudTimer[] = [];

  /** A timer that runs `ms` from now. */
  run(key: unknown, kind: TimerKind, icon: string, tint: number, ms: number): void {
    this.put({ key, id: '', kind, icon, tint, left: ms, total: ms, read: null });
  }

  /** A timer that reads its time from `read` until that returns null or nothing is left. */
  follow(key: unknown, kind: TimerKind, icon: string, tint: number, read: () => TimeLeft | null): void {
    const now = read();
    if (!now || now.left <= 0) return;
    this.put({ key, id: '', kind, icon, tint, left: now.left, total: now.total, read });
  }

  end(key: unknown): void {
    this.entries = this.entries.filter((e) => e.key !== key);
  }

  private put(e: Entry): void {
    // Another player's hero acting in this game: not this player's timer.
    if (ghost.active) return;
    const at = this.entries.findIndex((o) => o.key === e.key);
    e.id = `t${this.next++}`;
    if (at >= 0) this.entries[at] = e;
    else this.entries.push(e);
  }

  update(dt: number): void {
    for (const e of this.entries) {
      if (!e.read) {
        e.left -= dt;
        continue;
      }
      const now = e.read();
      e.left = now ? now.left : 0;
      if (now) e.total = now.total;
    }
    if (this.entries.some((e) => e.left <= 0)) this.entries = this.entries.filter((e) => e.left > 0);
  }

  clear(): void {
    this.entries = [];
  }

  /** What the HUD shows, in its order: the Special, then the ability's effects, then the buffs. */
  list(): readonly HudTimer[] {
    const out = this.shown;
    out.length = 0;
    for (const kind of ['special', 'ability'] as const) {
      for (const e of this.entries) if (e.kind === kind) out.push(e);
    }
    for (const b of heroBuffs.active) out.push({ id: `b${b.def.id}`, kind: 'buff', icon: b.def.icon, tint: b.def.tint, left: b.left, total: b.def.duration });
    return out;
  }
}

/** The player's timers; the world resets them each run and the UI reads them. */
export const heroTimers = new HeroTimers();
