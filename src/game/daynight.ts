// Time of day, shared by the UI toggle (writes `target`) and the world scene
// (eases `daylight` toward it and drives lighting from it).

const KEY = 'pixel-battle.daynight';

function load(): number {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'night') return 0;
  } catch {
    // Storage can be unavailable (private mode, sandboxed frames).
  }
  return 1;
}

export const daynight = {
  /** Whether the arena being played has day and night at all; set by the world. Off, the toggles hide. */
  enabled: true,
  /** 1 = day, 0 = night. */
  target: load(),
  /** Current blend, eased toward `target`. */
  daylight: load(),
  set(day: boolean): void {
    this.target = day ? 1 : 0;
    try {
      localStorage.setItem(KEY, day ? 'day' : 'night');
    } catch {
      // Not persisted; the toggle still works for this visit.
    }
  },
  toggle(): void {
    this.set(this.target < 0.5);
  },
};
