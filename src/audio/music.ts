import { Mixer, filter, gain, hit, mtof, osc, pick } from './mixer';

const BPM = 70;
const EIGHTH = 30 / BPM;
const STEPS = 16; // eighths per chord (two bars)
/** One chord's length: the baked music is rendered a chord at a time. */
export const CHORD_SECONDS = EIGHTH * STEPS;

interface Chord {
  bass: number;
  pad: number[];
}

// Rootless, softly voice-led jazz chords in C: Fmaj9  Em11  Dm9  Cmaj9 | Fmaj9  Em7  Dm9  G9sus.
const PROG: Chord[] = [
  { bass: 41, pad: [57, 60, 64, 67] },
  { bass: 40, pad: [55, 59, 62, 69] },
  { bass: 38, pad: [53, 57, 60, 64] },
  { bass: 36, pad: [52, 55, 59, 62] },
  { bass: 41, pad: [57, 60, 64, 67] },
  { bass: 40, pad: [55, 59, 62, 67] },
  { bass: 38, pad: [53, 57, 60, 65] },
  { bass: 43, pad: [53, 57, 60, 62] },
];

// C major pentatonic, E4..A5: nothing in it can sound wrong over the progression.
const SCALE = [64, 67, 69, 72, 74, 76, 79, 81];

/** How busy the melody is, per four-chord section. Zeros let the pads breathe alone. */
const DENSITY = [0.55, 1, 0, 0.8, 1, 0.6];

/**
 * Generative lo-fi music: warm detuned pads, a soft bass and a kalimba-like
 * melody that invents a four-chord motif and answers it with a variation.
 */
export class Music {
  private m!: Mixer;
  private pad!: BiquadFilterNode;
  private wobble!: GainNode;
  private lead!: GainNode;
  private out!: AudioNode;
  private step = 0;
  private next = 0;
  /** The live time that is time 0 of the context being written (a baked chunk's start). */
  private origin = 0;
  private phrases: (number | null)[][] = [];
  private melIdx = 3;

  /**
   * `out`: this track's own level on the music bus, so it can fade out while
   * another fades in. Without a mixer it waits to be bound to baked chunks.
   */
  constructor(m?: Mixer, out?: AudioNode) {
    if (m) this.bind(m, out ?? m.music, 0);
  }

  /**
   * Build the instruments on a mixer: the live one, or a bake mixer rendering the
   * chunk that starts at live time `origin` (see Stream). The tune carries on
   * from wherever it was, whichever context it is written into.
   */
  bind(m: Mixer, out: AudioNode, origin: number): void {
    this.m = m;
    this.out = out;
    this.origin = origin;
    const ctx = m.ctx;

    const padOut = gain(ctx, 1, out);
    padOut.connect(m.musicVerb);
    this.pad = filter(ctx, 'lowpass', 1100, 0.4, padOut);
    // The filter drifts open and closed over half a minute.
    drift(this.pad.frequency, m, origin, 1100, 380, 0.035);
    // Gentle tape wobble shared by every pad oscillator.
    this.wobble = gain(ctx, 5);
    osc(ctx, 'sine', 0.45, this.wobble).start();

    this.lead = gain(ctx, 1, out);
    const rv = gain(ctx, 0.7, m.musicVerb);
    this.lead.connect(rv);
    // Dotted-quarter echo, darker on every repeat.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = EIGHTH * 3;
    const fb = gain(ctx, 0.34, delay);
    const tone = filter(ctx, 'lowpass', 2200, 0.5, fb);
    delay.connect(tone);
    delay.connect(gain(ctx, 0.3, out));
    this.lead.connect(delay);
  }

  start(t: number): void {
    this.step = 0;
    this.next = t + 0.1;
  }

  /** Schedule everything that starts before `until`. */
  tick(now: number, until: number): void {
    if (this.next < now - 0.5) this.next = now + 0.05; // woke from a stall
    while (this.next < until) {
      this.play(this.step, this.next - this.origin);
      // A touch of swing.
      this.next += EIGHTH * (this.step % 2 === 0 ? 1.08 : 0.92);
      this.step++;
    }
  }

  private play(step: number, t: number): void {
    const s = step % STEPS;
    const ci = Math.floor(step / STEPS) % PROG.length;
    const chord = PROG[ci];
    const chordLen = EIGHTH * STEPS;

    if (s === 0) {
      this.chord(chord, t, chordLen);
      if (ci === 0) this.compose(Math.floor(step / (STEPS * PROG.length)));
    }
    if (s === 8) this.bass(chord.bass + 12, t, chordLen / 2, 0.35); // soft pulse mid-chord

    const note = this.phrases[ci]?.[s];
    if (note != null) {
      const vel = (s % 4 === 0 ? 0.9 : 0.65) * (0.85 + Math.random() * 0.15);
      this.pluck(note, t + (Math.random() - 0.5) * 0.02, vel);
    }
  }

  /** Write eight chords of melody: four new, then the same four varied. */
  private compose(loop: number): void {
    const density = (i: number) => DENSITY[(loop * 2 + (i >= 4 ? 1 : 0)) % DENSITY.length];
    for (let i = 0; i < 4; i++) this.phrases[i] = this.phrase(PROG[i], density(i));
    for (let i = 4; i < 8; i++) {
      const d = density(i);
      if (d === 0) {
        this.phrases[i] = [];
        continue;
      }
      // Answer phrase: keep the rhythm, nudge some notes, re-fit strong beats to the new chord.
      this.phrases[i] = this.phrases[i - 4].map((n, s) => {
        if (n == null) return Math.random() < 0.08 * d ? pick(SCALE) : null;
        let k = SCALE.indexOf(n);
        if (Math.random() < 0.3) k = clampIdx(k + pick([-1, 1]));
        if (s % 4 === 0) k = fit(k, PROG[i]);
        return SCALE[k];
      });
    }
    if (density(0) === 0) for (let i = 0; i < 4; i++) this.phrases[i] = [];
  }

  private phrase(chord: Chord, density: number): (number | null)[] {
    const out: (number | null)[] = [];
    for (let s = 0; s < STEPS; s++) {
      const p = s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.3 : 0.1;
      // Leave the end of each chord open so phrases breathe.
      if (s >= 13 || Math.random() > p * density) {
        out.push(null);
        continue;
      }
      this.melIdx = clampIdx(this.melIdx + pick([-2, -1, -1, 0, 1, 1, 2]));
      // Drift back toward the middle of the range.
      if (this.melIdx > 6 && Math.random() < 0.5) this.melIdx--;
      if (this.melIdx < 1 && Math.random() < 0.5) this.melIdx++;
      if (s % 4 === 0) this.melIdx = fit(this.melIdx, chord);
      out.push(SCALE[this.melIdx]);
    }
    return out;
  }

  private chord(ch: Chord, t: number, len: number): void {
    const ctx = this.m.ctx;
    const attack = 1.6;
    const release = 2.6;
    for (const n of ch.pad) {
      const f = mtof(n);
      const env = gain(ctx, 0, this.pad);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.045, t + attack);
      env.gain.setValueAtTime(0.045, t + len);
      env.gain.setTargetAtTime(0, t + len, release / 4);
      const end = t + len + release + 0.2;
      for (const [type, cents, level] of [
        ['triangle', -7, 1],
        ['sawtooth', 6, 0.28],
      ] as const) {
        const g = gain(ctx, level, env);
        const o = osc(ctx, type, f, g);
        o.detune.value = cents;
        this.wobble.connect(o.detune);
        // Live, the shared wobble would otherwise hold every finished note.
        if (!this.m.baking) o.onended = () => this.wobble.disconnect(o.detune);
        o.start(t);
        o.stop(end);
      }
    }
    this.bass(ch.bass + 12, t, len, 0.6);
  }

  private bass(n: number, t: number, len: number, level: number): void {
    const ctx = this.m.ctx;
    const env = gain(ctx, 0, this.out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16 * level, t + 0.12);
    env.gain.setTargetAtTime(0.09 * level, t + 0.12, 0.8);
    env.gain.setTargetAtTime(0, t + len - 0.2, 0.3);
    const f = mtof(n);
    const o1 = osc(ctx, 'sine', f, env);
    // A quiet octave so small phone speakers still hear the line.
    const o2 = osc(ctx, 'sine', f * 2, gain(ctx, 0.25, env));
    for (const o of [o1, o2]) {
      o.start(t);
      o.stop(t + len + 1.5);
    }
  }

  /** Kalimba-ish pluck: round body plus a short inharmonic tine. */
  private pluck(n: number, t: number, vel: number): void {
    const ctx = this.m.ctx;
    const f = mtof(n);
    const out = filter(ctx, 'lowpass', 3200, 0.5, this.lead);
    const body = gain(ctx, 0, out);
    hit(body.gain, t, 0.13 * vel, 0.006, 1.6);
    const tine = gain(ctx, 0, out);
    hit(tine.gain, t, 0.03 * vel, 0.002, 0.12);
    const warm = gain(ctx, 0, out);
    hit(warm.gain, t, 0.04 * vel, 0.004, 0.5);
    const a = osc(ctx, 'sine', f, body);
    const b = osc(ctx, 'sine', f * 5.4, tine);
    const c = osc(ctx, 'triangle', f, warm);
    for (const o of [a, b, c]) {
      o.start(t);
      o.stop(t + 2.2);
    }
  }
}

function clampIdx(i: number): number {
  return Math.max(0, Math.min(SCALE.length - 1, i));
}

/** Move a scale index to the nearest note that belongs to the chord (or its bass). */
function fit(i: number, ch: Chord): number {
  const pcs = new Set([...ch.pad, ch.bass].map((n) => n % 12));
  for (const d of [0, 1, -1, 2, -2]) {
    const k = clampIdx(i + d);
    if (pcs.has(SCALE[k] % 12)) return k;
  }
  return i;
}

/**
 * A slow sine drift on a parameter: an LFO when playing live, or, in a baked
 * chunk, the same curve written out against the live clock, so the drift runs
 * on smoothly from one chunk into the next instead of restarting each time.
 */
export function drift(p: AudioParam, m: Mixer, origin: number, base: number, depth: number, hz: number): void {
  const ctx = m.ctx;
  if (!m.baking) {
    p.value = base;
    osc(ctx, 'sine', hz, gain(ctx, depth, p)).start();
    return;
  }
  const secs = (ctx as OfflineAudioContext).length / ctx.sampleRate;
  const n = Math.max(2, Math.ceil(secs * 10));
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = base + depth * Math.sin(2 * Math.PI * hz * (origin + (i / (n - 1)) * secs));
  p.setValueCurveAtTime(curve, 0, secs);
}
