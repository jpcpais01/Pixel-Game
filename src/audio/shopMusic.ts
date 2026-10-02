import { Mixer, filter, gain, hit, mtof, osc, pick, rand } from './mixer';
import { drift } from './music';

// The Wishing Sanctum's music: a slow, dreamy waltz in E-flat. A music box
// turns arpeggios over the chords, soft pads swell under them, a sparse
// melody sings above, and glass chimes ring out now and then into the reverb.
// In the Wishing Nest (the companions' banner) the same waltz turns warm: up
// into G, the box brighter, and birdsong in place of the chimes.

const BPM = 84;
const EIGHTH = 30 / BPM;
/** Eighths per chord: two bars of 3/4. */
const STEPS = 12;
/** One chord's length (the baked shop music is rendered two at a time). */
export const SHOP_CHORD_SECONDS = EIGHTH * STEPS;

interface Chord {
  bass: number;
  pad: number[];
}

// Ebmaj9  Cm9  Abmaj9(#11)  Bbsus(add9), each held two bars.
const PROG: Chord[] = [
  { bass: 39, pad: [58, 62, 65, 67] },
  { bass: 36, pad: [58, 62, 63, 67] },
  { bass: 44, pad: [60, 62, 63, 67] },
  { bass: 46, pad: [60, 63, 65, 70] },
];

/** The music box's path through each chord's tones, one per eighth: up, and back. */
const ARP = [0, 1, 2, 3, 4, 3, 1, 2, 3, 4, 5, 4];
/** E-flat major pentatonic, high: the melody's notes. */
const SONG = [75, 77, 79, 82, 84, 87, 89];
/** The chimes' notes, higher still. */
const CHIMES = [87, 89, 91, 94, 96, 99];
/** The Nest plays everything this many semitones up: E-flat to G. */
const NEST_UP = 4;

export type ShopMood = 'sanctum' | 'nest';

export class ShopMusic {
  private m!: Mixer;
  private out!: AudioNode;
  private box!: GainNode;
  private pad!: BiquadFilterNode;
  private boxTone!: BiquadFilterNode;
  private step = 0;
  private next = 0;
  private chimeAt = 0;
  private sing = 2;
  private mood: ShopMood = 'sanctum';
  /** Semitones up from E-flat for the chord now playing. */
  private up = 0;
  /** The live time that is time 0 of the context being written (a baked chunk's start). */
  private origin = 0;

  /** `out`: this track's own level on the music bus (see GameSound.setTrack). Without a mixer it waits to be bound to baked chunks. */
  constructor(m?: Mixer, out?: AudioNode) {
    if (m && out) this.bind(m, out, 0);
  }

  /** Build the instruments on the live mixer or a bake mixer (see Music.bind). */
  bind(m: Mixer, out: AudioNode, origin: number): void {
    this.m = m;
    this.out = out;
    this.origin = origin;
    const ctx = m.ctx;
    // Pads: dark and wide, deep in the reverb, the filter slowly breathing.
    const padOut = gain(ctx, 1, out);
    padOut.connect(gain(ctx, 1.4, m.musicVerb));
    this.pad = filter(ctx, 'lowpass', 900, 0.4, padOut);
    drift(this.pad.frequency, m, origin, 900, 300, 0.05);
    // The music box, with a soft echo a dotted eighth behind.
    this.boxTone = filter(ctx, 'lowpass', this.mood === 'nest' ? 9000 : 5200, 0.5, out);
    this.box = gain(ctx, 1, this.boxTone);
    this.box.connect(gain(ctx, 0.9, m.musicVerb));
    const delay = ctx.createDelay(2);
    delay.delayTime.value = EIGHTH * 1.5;
    const fb = gain(ctx, 0.32, delay);
    delay.connect(filter(ctx, 'lowpass', 3000, 0.5, fb));
    delay.connect(gain(ctx, 0.35, out));
    this.box.connect(delay);
  }

  /** The Sanctum or the Nest: the key moves at the next chord, the box's tone at once (gently; baked, from the next chunk). */
  setMood(mood: ShopMood): void {
    this.mood = mood;
    if (!this.m || this.m.baking) return;
    const t = this.m.ctx.currentTime;
    this.boxTone.frequency.setTargetAtTime(mood === 'nest' ? 9000 : 5200, t, 0.4);
  }

  /** Schedule everything that starts before `until`. */
  tick(now: number, until: number): void {
    // Coming back after a rest (or a stall): pick up from the top of a chord.
    if (this.next < now - 0.5) {
      this.next = now + 0.1;
      this.step = Math.ceil(this.step / STEPS) * STEPS;
      this.chimeAt = now + rand(2, 4);
    }
    while (this.next < until) {
      this.play(this.step, this.next - this.origin);
      this.next += EIGHTH;
      this.step++;
    }
    while (this.chimeAt < until) {
      if (this.mood === 'nest') this.chirp(Math.max(now, this.chimeAt) - this.origin);
      else this.chime(Math.max(now, this.chimeAt) - this.origin);
      this.chimeAt += this.mood === 'nest' ? rand(2.5, 5.5) : rand(3.5, 7);
    }
  }

  private play(step: number, t: number): void {
    const s = step % STEPS;
    const ci = Math.floor(step / STEPS) % PROG.length;
    // The key is chosen at each chord's start, so a mood change never lands mid-chord.
    if (s === 0) this.up = this.mood === 'nest' ? NEST_UP : 0;
    const base = PROG[ci];
    const chord = { bass: base.bass + this.up, pad: base.pad.map((n) => n + this.up) };
    if (s === 0) {
      this.chord(chord, t, EIGHTH * STEPS);
      this.bass(chord.bass, t, EIGHTH * STEPS);
    }
    // The music box: an octave up from the pad, the chord's root on top.
    const tones = [...chord.pad.map((n) => n + 12), chord.pad[0] + 24];
    const accent = s % 6 === 0 ? 1 : s % 2 === 0 ? 0.72 : 0.55;
    // Now and then it skips a note, so it never quite repeats.
    if (s % 6 !== 0 && Math.random() < 0.12) return;
    this.pluck(tones[ARP[s]], t, accent);
    // A melody note on the first beat of some bars, fitted to the chord.
    if (s % 6 === 0 && Math.random() < 0.55) {
      this.sing = Math.max(0, Math.min(SONG.length - 1, this.sing + pick([-2, -1, 1, 2])));
      const pcs = new Set(chord.pad.map((n) => n % 12));
      let note = SONG[this.sing] + this.up;
      if (!pcs.has(note % 12)) note = SONG.map((n) => n + this.up).find((n) => pcs.has(n % 12) && Math.abs(n - note) <= 3) ?? note;
      this.bell(note, t + EIGHTH * 0.02, 0.06, 2.4);
    }
  }

  private chord(ch: Chord, t: number, len: number): void {
    const ctx = this.m.ctx;
    for (const n of ch.pad) {
      const env = gain(ctx, 0, this.pad);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.04, t + 2.2);
      env.gain.setValueAtTime(0.04, t + len);
      env.gain.setTargetAtTime(0, t + len, 0.9);
      const end = t + len + 4;
      for (const [type, cents, level] of [
        ['sine', -8, 1],
        ['triangle', 7, 0.6],
      ] as const) {
        const o = osc(ctx, type, mtof(n), gain(ctx, level, env));
        o.detune.value = cents;
        o.start(t);
        o.stop(end);
      }
    }
  }

  private bass(n: number, t: number, len: number): void {
    const ctx = this.m.ctx;
    const env = gain(ctx, 0, this.out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.12, t + 0.3);
    env.gain.setTargetAtTime(0.06, t + 0.3, 1.2);
    env.gain.setTargetAtTime(0, t + len - 0.3, 0.4);
    const f = mtof(n);
    const a = osc(ctx, 'sine', f, env);
    const b = osc(ctx, 'sine', f * 2, gain(ctx, 0.2, env));
    for (const o of [a, b]) {
      o.start(t);
      o.stop(t + len + 1.5);
    }
  }

  /** A music box's tine: a pure note, a bright metallic partial dying fast, and a soft ring. */
  private pluck(n: number, t: number, vel: number): void {
    const ctx = this.m.ctx;
    const f = mtof(n);
    const out = filter(ctx, 'lowpass', 5200, 0.5, this.box);
    const body = gain(ctx, 0, out);
    hit(body.gain, t, 0.07 * vel, 0.003, 1.3);
    const tine = gain(ctx, 0, out);
    hit(tine.gain, t, 0.018 * vel, 0.001, 0.09);
    const ring = gain(ctx, 0, out);
    hit(ring.gain, t, 0.012 * vel, 0.004, 0.6);
    const a = osc(ctx, 'sine', f, body);
    const b = osc(ctx, 'sine', f * 4.1, tine);
    const c = osc(ctx, 'sine', f * 2, ring);
    for (const o of [a, b, c]) {
      o.start(t);
      o.stop(t + 1.8);
    }
  }

  /** A glass bell: a few inharmonic partials, ringing long into the reverb. */
  private bell(n: number, t: number, level: number, decay: number): void {
    const ctx = this.m.ctx;
    const f = mtof(n);
    for (const [r, a] of [
      [1, 1],
      [2.76, 0.35],
      [5.4, 0.12],
    ]) {
      const g = gain(ctx, 0, this.box);
      hit(g.gain, t, level * a, 0.004, decay / r);
      const o = osc(ctx, 'sine', f * r, g);
      o.start(t);
      o.stop(t + decay + 0.2);
    }
  }

  /** Chimes shivering in the air: two or three glass notes, one after another. */
  private chime(t: number): void {
    const k = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < k; i++) this.bell(pick(CHIMES), t + i * rand(0.09, 0.16), 0.022, 3);
  }

  /** A small bird in the rafters: two to four quick whistles, each swooping up or down. */
  private chirp(t: number): void {
    const ctx = this.m.ctx;
    const k = 2 + Math.floor(Math.random() * 3);
    const f0 = rand(2600, 3600);
    const rise = Math.random() < 0.6;
    for (let i = 0; i < k; i++) {
      const at = t + i * rand(0.07, 0.11);
      const len = rand(0.05, 0.08);
      const g = gain(ctx, 0, this.box);
      hit(g.gain, at, 0.02, 0.006, len * 0.6);
      const o = osc(ctx, 'sine', f0, g);
      const f = f0 * (1 + i * 0.04);
      o.frequency.setValueAtTime(rise ? f * 0.8 : f * 1.15, at);
      o.frequency.exponentialRampToValueAtTime(rise ? f * 1.2 : f * 0.85, at + len);
      o.start(at);
      o.stop(at + len + 0.1);
    }
  }
}
