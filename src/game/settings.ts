// Player options from the pause menu, saved in localStorage.

const KEY = 'pixel-battle.settings';

export interface Settings {
  /** 0..1, where 0.5 is neutral: below darkens the world, above lifts it. */
  brightness: number;
  /** 0..1 volume of each bus. */
  music: number;
  sfx: number;
  showFps: boolean;
  /** With the FPS counter: a breakdown of where each frame's time goes. */
  profiler: boolean;
  /** Fast renders at a lower resolution (see display.ts) with fewer particles. */
  quality: 'full' | 'fast' | 'low';
}

// Phones and tablets start on Fast; they have dense screens and small GPUs.
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const DEFAULTS: Settings = { brightness: 0.5, music: 1, sfx: 1, showFps: true, profiler: false, quality: touch ? 'fast' : 'full' };

type Listener = (s: Settings) => void;

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    // The profiler waits on the GPU every frame, which costs frames of its
    // own, so it's never left on from an earlier visit.
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>), profiler: false };
  } catch {
    // Storage unavailable or corrupt: fall back to the defaults.
  }
  return { ...DEFAULTS };
}

const listeners = new Set<Listener>();

export const settings = {
  values: load(),
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.values[key] === value) return;
    this.values[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      // Not persisted; the change still applies for this visit.
    }
    for (const fn of listeners) fn(this.values);
  },
  /** Call `fn` now and on every change; returns the unsubscribe. */
  watch(fn: Listener): () => void {
    listeners.add(fn);
    fn(this.values);
    return () => listeners.delete(fn);
  },
};
