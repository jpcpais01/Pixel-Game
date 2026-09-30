// Time of day, shared by the UI toggle (picks a `phase`) and the world scene
// (ticks it, eases the blend toward it and drives lighting from the blend).
//
// A day has four phases: morning, day, sunset and night. The player picks one,
// or turns on auto, which moves to the next every couple of minutes like a day
// going by. Everything that only knows "how much day is it" reads `daylight`
// (0 night .. 1 day); the lighting reads `mix`, the weight of each phase.

export type Phase = 'morning' | 'day' | 'sunset' | 'night';
export const PHASES: Phase[] = ['morning', 'day', 'sunset', 'night'];

/** How long each phase lasts on auto. */
const AUTO_MS = 120_000;
/** How long a fade between phases takes: quick for a pick, slow and gentle on auto. */
const FADE_PICK_MS = 1400;
const FADE_AUTO_MS = 7000;
/**
 * Each phase on the day/night scale: morning is bright enough for the day's
 * critters and pollen; sunset sits halfway, so lamps are half lit, the night's
 * critters and fireflies come out and shadows are soft.
 */
const DAYLIGHT: Record<Phase, number> = { morning: 0.76, day: 1, sunset: 0.5, night: 0 };

const KEY = 'pixel-battle.daynight';
const AUTO_KEY = 'pixel-battle.daynight.auto';

function load(): { phase: Phase; auto: boolean } {
  try {
    const v = localStorage.getItem(KEY) as Phase | null;
    return { phase: v && PHASES.includes(v) ? v : 'day', auto: localStorage.getItem(AUTO_KEY) === '1' };
  } catch {
    // Storage can be unavailable (private mode, sandboxed frames).
    return { phase: 'day', auto: false };
  }
}

function save(phase: Phase, auto: boolean): void {
  try {
    localStorage.setItem(KEY, phase);
    localStorage.setItem(AUTO_KEY, auto ? '1' : '0');
  } catch {
    // Not persisted; the toggle still works for this visit.
  }
}

const start = load();
const oneHot = (p: Phase): number[] => PHASES.map((q) => (q === p ? 1 : 0));

export const daynight = {
  /** Whether the arena being played has day and night at all; set by the world. Off, the toggles hide. */
  enabled: true,
  /** The phase the day is heading for. */
  phase: start.phase,
  /** Moving through the phases on its own. */
  auto: start.auto,
  /** Time left in this phase on auto, ms. */
  left: AUTO_MS,
  /** Someone else keeps the clock (a visitor in a friend's home): auto doesn't tick here, their phases arrive instead. */
  follower: false,
  /** Weight of each phase in `PHASES` order, eased toward the chosen one; sums to 1. */
  mix: oneHot(start.phase),

  /** 0 night .. 1 day, from the blend. */
  get daylight(): number {
    let d = 0;
    PHASES.forEach((p, i) => (d += this.mix[i] * DAYLIGHT[p]));
    return d;
  },

  /** How far through this phase auto is, 0..1. */
  get progress(): number {
    return 1 - this.left / AUTO_MS;
  },

  /** Pick a phase; picking one by hand stops auto. */
  set(phase: Phase): void {
    this.phase = phase;
    this.auto = false;
    save(this.phase, this.auto);
  },

  setAuto(on: boolean): void {
    this.auto = on;
    this.left = AUTO_MS;
    save(this.phase, this.auto);
  },

  /** On to the next phase by hand (the N key and the pause menu), stopping auto. */
  next(): void {
    this.set(PHASES[(PHASES.indexOf(this.phase) + 1) % PHASES.length]);
  },

  /** A phase and auto from the room (the home's owner, or a friend's pick); not saved as this player's own. */
  adopt(phase: Phase, auto: boolean, left?: number): void {
    if (PHASES.includes(phase)) this.phase = phase;
    this.auto = auto;
    if (typeof left === 'number' && left > 0) this.left = Math.min(left, AUTO_MS);
  },

  /** Run the clock and ease the blend toward the phase. */
  tick(dt: number): void {
    if (this.auto && !this.follower) {
      this.left -= dt;
      if (this.left <= 0) {
        this.left += AUTO_MS;
        this.phase = PHASES[(PHASES.indexOf(this.phase) + 1) % PHASES.length];
        save(this.phase, this.auto);
      }
    }
    const step = dt / (this.auto ? FADE_AUTO_MS : FADE_PICK_MS);
    const want = PHASES.indexOf(this.phase);
    let sum = 0;
    for (let i = 0; i < this.mix.length; i++) {
      const t = i === want ? 1 : 0;
      this.mix[i] += Math.max(-step, Math.min(step, t - this.mix[i]));
      sum += this.mix[i];
    }
    // Leaving a half-finished fade for a third phase can leave the sum a little off.
    if (sum > 0) for (let i = 0; i < this.mix.length; i++) this.mix[i] /= sum;
  },
};
