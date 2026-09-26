// Energy for the Special: gathered by slaying monsters (a little each) and
// bosses (a lot), spent all at once when the Special is cast. The world
// fills it and spends it; the HUD reads it to draw the Special button's ring.

import { ghost } from '../net/ghost';

/** The most energy a hero can hold. */
export const ENERGY_MAX = 100;

/** How much a slain monster gives: bosses by rank, everything else by how tough it was. */
export function energyFor(hp: number, rank?: 'legend' | 'myth'): number {
  if (rank === 'myth') return ENERGY_MAX;
  if (rank === 'legend') return 60;
  return Math.max(5, Math.min(14, Math.round(4 + hp / 15)));
}

export const energy = {
  value: 0,
  /** What the worn Special costs. */
  cost: ENERGY_MAX,
  /** 0..1, flashes the ring when energy arrives. */
  flash: 0,
  /** Time since the Special last became ready, for the HUD's burst; -1 while not ready. */
  readyAge: -1,

  get ready(): boolean {
    // Another player's hero casting its Special paid for it in its own game.
    if (ghost.active) return true;
    return this.value >= this.cost;
  },

  reset(cost: number): void {
    this.value = 0;
    this.cost = cost;
    this.flash = 0;
    this.readyAge = -1;
  },

  /** Adds energy; returns true when this made the Special ready. */
  gain(n: number): boolean {
    if (ghost.active) return false;
    const was = this.ready;
    this.value = Math.min(ENERGY_MAX, this.value + n);
    this.flash = 1;
    if (!was && this.ready) {
      this.readyAge = 0;
      return true;
    }
    return false;
  },

  spend(): boolean {
    if (ghost.active) return true;
    if (!this.ready) return false;
    this.value -= this.cost;
    this.readyAge = -1;
    return true;
  },

  update(dt: number): void {
    this.flash = Math.max(0, this.flash - dt / 400);
    if (this.readyAge >= 0) this.readyAge += dt;
  },
};
