import { Mixer, filter, gain, hit, osc, panner, pick, rand, sweep } from './mixer';

const SPARKLE = [2093, 2349, 2637, 3136, 3520, 4186]; // C major pentatonic, high

/** One-shot game sounds. `pan` is -1 (left) .. 1 (right) on screen. */
export class Sfx {
  private m: Mixer;
  private foot = 0;

  constructor(m: Mixer) {
    this.m = m;
  }

  private out(pan: number, level: number, wet: number): GainNode {
    const ctx = this.m.ctx;
    const g = gain(ctx, level, panner(ctx, pan * 0.7, this.m.sfx));
    if (wet > 0) g.connect(gain(ctx, wet, this.m.reverb));
    return g;
  }

  /** The staff swirl: a soft rising shimmer while energy gathers. */
  charge(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.5, 0.4);
    const dur = 0.5;
    const env = gain(ctx, 0, out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.09, t + dur * 0.85);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    for (const [f, lvl] of [
      [520, 1],
      [780, 0.6],
      [1040, 0.35],
    ]) {
      const o = osc(ctx, 'sine', f, gain(ctx, lvl, env));
      sweep(o.frequency, t, f, f * 1.6, dur);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    // Airy swirl: noise through a bandpass that circles as it rises.
    const air = gain(ctx, 0, out);
    air.gain.setValueAtTime(0, t);
    air.gain.linearRampToValueAtTime(0.35, t + dur * 0.8);
    air.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const bp = filter(ctx, 'bandpass', 600, 4, air);
    sweep(bp.frequency, t, 500, 2200, dur);
    const lfo = osc(ctx, 'sine', 9, gain(ctx, 250, bp.frequency));
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.1);
  }

  /** The energy ball leaving the staff. */
  cast(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.8, 0.45);

    // Whoosh.
    const w = gain(ctx, 0, out);
    hit(w.gain, t, 0.5, 0.015, 0.35);
    const bp = filter(ctx, 'bandpass', 2000, 1.4, w);
    sweep(bp.frequency, t, 2600, 450, 0.35);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, 0.4);

    // Magic tone: a falling fifth that settles, not a laser.
    const z = gain(ctx, 0, filter(ctx, 'lowpass', 3500, 0.5, out));
    hit(z.gain, t, 0.18, 0.005, 0.28);
    for (const [f, type] of [
      [990, 'sine'],
      [1485, 'triangle'],
    ] as const) {
      const o = osc(ctx, type, f, z);
      sweep(o.frequency, t, f, f * 0.45, 0.22);
      o.start(t);
      o.stop(t + 0.35);
    }

    // Soft low push.
    const p = gain(ctx, 0, out);
    hit(p.gain, t, 0.35, 0.004, 0.14);
    const lo = osc(ctx, 'sine', 140, p);
    sweep(lo.frequency, t, 140, 60, 0.14);
    lo.start(t);
    lo.stop(t + 0.2);

    this.sparkle(out, t + 0.02, 3, 0.05);
  }

  /** The ball bursting; `struck` adds a woody knock when it hit a target. */
  impact(t: number, pan: number, struck: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, struck ? 0.9 : 0.55, 0.5);

    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.5, 0.003, 0.3);
    const lp = filter(ctx, 'lowpass', 2400, 0.7, b);
    sweep(lp.frequency, t, 2400, 500, 0.3);
    const src = this.m.noiseSource();
    src.connect(lp);
    this.m.startNoise(src, t, 0.35);

    const th = gain(ctx, 0, out);
    hit(th.gain, t, 0.5, 0.003, 0.2);
    const o = osc(ctx, 'sine', 170, th);
    sweep(o.frequency, t, 170, 48, 0.2);
    o.start(t);
    o.stop(t + 0.3);

    if (struck) {
      const k = gain(ctx, 0, out);
      hit(k.gain, t, 0.35, 0.002, 0.08);
      const wood = filter(ctx, 'bandpass', 620, 5, k);
      const n = this.m.noiseSource();
      n.connect(wood);
      this.m.startNoise(n, t, 0.1);
      const kt = gain(ctx, 0, out);
      hit(kt.gain, t, 0.12, 0.002, 0.07);
      const ko = osc(ctx, 'triangle', 240, kt);
      ko.start(t);
      ko.stop(t + 0.12);
    }

    this.sparkle(out, t + 0.03, struck ? 5 : 3, 0.035);
  }

  /** A soft footfall on packed earth and grass; alternates feet. */
  step(t: number): void {
    const ctx = this.m.ctx;
    this.foot ^= 1;
    const out = this.out(this.foot ? -0.08 : 0.08, rand(0.75, 1), 0.08);

    const s = gain(ctx, 0, out);
    hit(s.gain, t, 0.3, 0.004, 0.07);
    const hp = filter(ctx, 'highpass', 180, 0.7, s);
    const lp = filter(ctx, 'lowpass', rand(1200, 1700) * (this.foot ? 1 : 0.9), 0.8, hp);
    const src = this.m.noiseSource(true);
    src.connect(lp);
    this.m.startNoise(src, t, 0.1);

    // A whisper of grass crunch on top.
    const c = gain(ctx, 0, out);
    hit(c.gain, t + 0.006, 0.05, 0.002, 0.04);
    const crunch = filter(ctx, 'highpass', 3500, 0.7, c);
    const n = this.m.noiseSource();
    n.connect(crunch);
    this.m.startNoise(n, t, 0.06);

    const th = gain(ctx, 0, out);
    hit(th.gain, t, 0.14, 0.003, 0.05);
    const o = osc(ctx, 'sine', rand(85, 100), th);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** Start the beam's gathering hum; steer it with `set` and end it with `stop`. */
  beamHum(t: number): BeamHum {
    return new BeamHum(this.m, this.out(0, 0.7, 0.35), t);
  }

  /** The beam tearing loose: a deep boom, a long roaring rush and a bright ringing tone. */
  beamFire(t: number, pan: number, power: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.6 + power * 0.4, 0.5);
    const dur = 0.32 + power * 0.52;

    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.55, 0.004, 0.35 + power * 0.3);
    const lo = osc(ctx, 'sine', 95, b);
    sweep(lo.frequency, t, 95, 38, 0.35 + power * 0.3);
    lo.start(t);
    lo.stop(t + 0.8);

    const r = gain(ctx, 0, out);
    r.gain.setValueAtTime(0, t);
    r.gain.linearRampToValueAtTime(0.35 + power * 0.2, t + 0.02);
    r.gain.setValueAtTime(0.3 + power * 0.15, t + dur * 0.7);
    r.gain.linearRampToValueAtTime(0, t + dur);
    const lp = filter(ctx, 'lowpass', 5000, 0.9, r);
    sweep(lp.frequency, t, 6000, 900, dur);
    const src = this.m.noiseSource();
    src.connect(lp);
    this.m.startNoise(src, t, dur);

    const tone = gain(ctx, 0, filter(ctx, 'lowpass', 3200, 0.6, out));
    tone.gain.setValueAtTime(0, t);
    tone.gain.linearRampToValueAtTime(0.07, t + 0.02);
    tone.gain.linearRampToValueAtTime(0, t + dur);
    for (const [f, type, lvl] of [
      [660, 'sawtooth', 0.5],
      [663, 'sawtooth', 0.5],
      [1320, 'sine', 0.8],
    ] as const) {
      const o = osc(ctx, type, f, gain(ctx, lvl, tone));
      sweep(o.frequency, t, f * 1.05, f * 0.94, dur);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    this.sparkle(out, t + 0.02, 3 + Math.round(power * 3), 0.05);
  }

  /** A held charge slipping away: a sagging tone and a spit of crackle. */
  beamFizzle(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.6, 0.35);
    const z = gain(ctx, 0, out);
    hit(z.gain, t, 0.12, 0.005, 0.45);
    const o = osc(ctx, 'triangle', 700, z);
    sweep(o.frequency, t, 700, 140, 0.45);
    o.start(t);
    o.stop(t + 0.55);

    const c = gain(ctx, 0, out);
    hit(c.gain, t, 0.3, 0.003, 0.25);
    const bp = filter(ctx, 'bandpass', 3000, 1.2, c);
    sweep(bp.frequency, t, 3500, 800, 0.25);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, 0.3);
  }

  /** A blade cutting the air. The finisher (`step` 3) is lower, heavier and longer. */
  swing(t: number, pan: number, step: number): void {
    const ctx = this.m.ctx;
    const heavy = step >= 3;
    const out = this.out(pan, heavy ? 0.85 : 0.7, 0.2);
    const dur = heavy ? 0.26 : 0.17;
    const w = gain(ctx, 0, out);
    hit(w.gain, t, heavy ? 0.6 : 0.5, 0.02, dur);
    const bp = filter(ctx, 'bandpass', 1800, heavy ? 1.6 : 2.4, w);
    const top = [2600, 3200, 1900][Math.min(2, step - 1)] * rand(0.95, 1.05);
    sweep(bp.frequency, t, top * 0.6, top, dur * 0.35);
    sweep(bp.frequency, t + dur * 0.35, top, top * 0.4, dur * 0.65);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.05);
    // A faint ring of steel.
    const r = gain(ctx, 0, out);
    hit(r.gain, t + 0.01, 0.025, 0.003, 0.18);
    const o = osc(ctx, 'sine', rand(2900, 3300), r);
    o.start(t);
    o.stop(t + 0.25);
    if (heavy) {
      const g = gain(ctx, 0, out);
      hit(g.gain, t, 0.25, 0.01, 0.2);
      const lo = osc(ctx, 'sine', 160, g);
      sweep(lo.frequency, t, 160, 70, 0.2);
      lo.start(t);
      lo.stop(t + 0.25);
    }
  }

  /** The blade biting into a target: a thump, a crack of splinters and a bright ring of steel. */
  clash(t: number, pan: number, heavy: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, heavy ? 1 : 0.8, 0.35);
    const th = gain(ctx, 0, out);
    hit(th.gain, t, heavy ? 0.7 : 0.5, 0.002, heavy ? 0.22 : 0.14);
    const o = osc(ctx, 'sine', heavy ? 140 : 190, th);
    sweep(o.frequency, t, heavy ? 140 : 190, 50, 0.18);
    o.start(t);
    o.stop(t + 0.3);

    const k = gain(ctx, 0, out);
    hit(k.gain, t, 0.45, 0.001, 0.09);
    const wood = filter(ctx, 'bandpass', rand(700, 900), 3, k);
    const n = this.m.noiseSource();
    n.connect(wood);
    this.m.startNoise(n, t, 0.12);

    const ring = gain(ctx, 0, filter(ctx, 'highpass', 1200, 0.7, out));
    hit(ring.gain, t, 0.07, 0.001, heavy ? 0.4 : 0.25);
    for (const f of [1870, 2790, 4130]) {
      const r = osc(ctx, 'triangle', f * rand(0.98, 1.02), gain(ctx, 0.5, ring));
      r.start(t);
      r.stop(t + 0.45);
    }
  }

  /** The whirlwind kindling: a breath of fire rising in pitch. */
  rise(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.7, 0.4);
    const dur = 0.3;
    const f = gain(ctx, 0, out);
    f.gain.setValueAtTime(0, t);
    f.gain.linearRampToValueAtTime(0.4, t + dur);
    f.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    const bp = filter(ctx, 'bandpass', 500, 1.5, f);
    sweep(bp.frequency, t, 400, 2200, dur);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.1);
    const tone = gain(ctx, 0, out);
    tone.gain.setValueAtTime(0, t);
    tone.gain.linearRampToValueAtTime(0.06, t + dur);
    tone.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    for (const fr of [220, 330]) {
      const o = osc(ctx, 'sawtooth', fr, filter(ctx, 'lowpass', 1400, 0.7, tone));
      sweep(o.frequency, t, fr, fr * 2, dur);
      o.start(t);
      o.stop(t + dur + 0.15);
    }
  }

  /** One turn of the whirlwind: a roaring whoosh of fire. */
  whirl(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.65, 0.3);
    const w = gain(ctx, 0, out);
    hit(w.gain, t, 0.45, 0.06, 0.26);
    const bp = filter(ctx, 'bandpass', 900, 1.1, w);
    sweep(bp.frequency, t, 600, 1600, 0.12);
    sweep(bp.frequency, t + 0.12, 1600, 500, 0.2);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, 0.34);
    const c = gain(ctx, 0, out);
    hit(c.gain, t, 0.12, 0.01, 0.25);
    const crackle = filter(ctx, 'highpass', 4000, 0.7, c);
    const n = this.m.noiseSource(true);
    n.connect(crackle);
    this.m.startNoise(n, t, 0.3);
  }

  /** The whirlwind's closing blast: a deep boom and a roll of fire. */
  slam(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 1, 0.55);
    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.8, 0.004, 0.55);
    const lo = osc(ctx, 'sine', 110, b);
    sweep(lo.frequency, t, 110, 32, 0.5);
    lo.start(t);
    lo.stop(t + 0.7);
    const r = gain(ctx, 0, out);
    hit(r.gain, t, 0.5, 0.005, 0.6);
    const lp = filter(ctx, 'lowpass', 3000, 0.8, r);
    sweep(lp.frequency, t, 4000, 300, 0.6);
    const src = this.m.noiseSource();
    src.connect(lp);
    this.m.startNoise(src, t, 0.65);
    this.sparkle(out, t + 0.04, 4, 0.04);
  }

  /** A bell of holy light: inharmonic partials, the high ones dying first. */
  private bell(dest: AudioNode, t: number, f: number, level: number, decay: number): void {
    const ctx = this.m.ctx;
    for (const [r, a] of [
      [1, 1],
      [2, 0.45],
      [2.76, 0.3],
      [5.4, 0.12],
    ]) {
      const g = gain(ctx, 0, dest);
      hit(g.gain, t, level * a, 0.003, decay / (0.5 + r * 0.5));
      const o = osc(ctx, 'sine', f * r * rand(0.997, 1.003), g);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }

  /** The paladin's mace kindling: a breath of air and a rising chord of bells. */
  hallow(t: number): void {
    const out = this.out(0, 0.6, 0.55);
    const ctx = this.m.ctx;
    const dur = 0.45;
    const air = gain(ctx, 0, out);
    air.gain.setValueAtTime(0, t);
    air.gain.linearRampToValueAtTime(0.22, t + dur);
    air.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    const bp = filter(ctx, 'bandpass', 900, 2, air);
    sweep(bp.frequency, t, 700, 3200, dur);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.15);
    [523, 659, 784, 1047].forEach((f, i) => this.bell(out, t + i * 0.09, f, 0.05, 0.9));
  }

  /** The mace coming down: a heavy thump, and a bright bell when it lands on something. */
  smite(t: number, pan: number, struck: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.9, 0.4);
    const th = gain(ctx, 0, out);
    hit(th.gain, t, 0.6, 0.003, 0.2);
    const o = osc(ctx, 'sine', 150, th);
    sweep(o.frequency, t, 150, 45, 0.18);
    o.start(t);
    o.stop(t + 0.3);
    const k = gain(ctx, 0, out);
    hit(k.gain, t, 0.3, 0.002, 0.1);
    const lp = filter(ctx, 'lowpass', 1400, 0.8, k);
    const n = this.m.noiseSource(true);
    n.connect(lp);
    this.m.startNoise(n, t, 0.14);
    this.bell(out, t + 0.005, struck ? rand(880, 900) : rand(660, 680), struck ? 0.07 : 0.035, struck ? 1.1 : 0.6);
    if (struck) this.sparkle(out, t + 0.03, 3, 0.04);
  }

  /** Consecration: the ground struck, a deep boom under a swelling major chord. */
  consecrate(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 1, 0.65);
    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.75, 0.004, 0.6);
    const lo = osc(ctx, 'sine', 98, b);
    sweep(lo.frequency, t, 98, 36, 0.55);
    lo.start(t);
    lo.stop(t + 0.8);
    // A choir-like pad: soft saws through a closing lowpass, swelling then fading.
    const pad = gain(ctx, 0, out);
    pad.gain.setValueAtTime(0, t);
    pad.gain.linearRampToValueAtTime(0.07, t + 0.12);
    pad.gain.setTargetAtTime(0, t + 0.5, 0.45);
    const lp = filter(ctx, 'lowpass', 2600, 0.6, pad);
    sweep(lp.frequency, t, 2600, 700, 2);
    for (const f of [262, 330, 392, 523]) {
      for (const d of [-6, 6]) {
        const v = osc(ctx, 'sawtooth', f, gain(ctx, 0.5, lp));
        v.detune.value = d;
        v.start(t);
        v.stop(t + 2.6);
      }
    }
    this.bell(out, t, 523, 0.08, 1.8);
    this.bell(out, t + 0.07, 784, 0.05, 1.6);
    this.sparkle(out, t + 0.05, 5, 0.05);
  }

  /** A pulse of healing: two soft rising notes. */
  /** Quaffing a potion: two glugs, then a chime (warm for health, a quick rising run for speed). */
  drink(t: number, swift: boolean): void {
    const out = this.out(0, 0.55, 0.35);
    for (const at of [0, 0.13]) {
      this.chirp(out, t + at, 'sine', 180 * rand(0.95, 1.05), 420, 0.28, 0.08);
      this.burstNoise(out, t + at, 'bandpass', 700, 1500, 4, 0.12, 0.07, true);
    }
    const c = t + 0.26;
    if (swift) [880, 1175, 1568, 2093].forEach((f, i) => this.bell(out, c + i * 0.045, f, 0.035, 0.45));
    else [659, 784, 1047].forEach((f, i) => this.bell(out, c + i * 0.08, f, 0.045, 0.8));
    this.sparkle(out, c + 0.1, 3, 0.05);
  }

  /** Picking up gear: a rising chord of bells, with a sparkle and a longer run for the rarest. */
  gear(t: number, rare: boolean): void {
    const out = this.out(0, 0.5, 0.45);
    const notes = rare ? [523, 659, 784, 1047, 1319] : [587, 740, 880];
    notes.forEach((f, i) => this.bell(out, t + i * 0.06, f, 0.045, 0.9));
    this.sparkle(out, t + 0.12, rare ? 6 : 3, 0.05);
  }

  /** Picking an item up: a bright double blip. */
  pickup(t: number, pan: number): void {
    const out = this.out(pan, 0.45, 0.3);
    this.chirp(out, t, 'triangle', 988, 1319, 0.2, 0.06);
    this.chirp(out, t + 0.07, 'triangle', 1319, 1760, 0.18, 0.09);
  }

  heal(t: number, pan: number): void {
    const out = this.out(pan, 0.45, 0.5);
    const i = Math.floor(Math.random() * 3);
    this.bell(out, t, [784, 880, 988][i], 0.035, 0.5);
    this.bell(out, t + 0.07, [1175, 1319, 1480][i], 0.03, 0.6);
  }

  // ------------------------------------------------------------ Monsters

  /** Noise through a filter with a quick envelope: the building block of most creature sounds. */
  private burstNoise(out: AudioNode, t: number, type: BiquadFilterType, from: number, to: number, q: number, level: number, dur: number, pink = false): void {
    const ctx = this.m.ctx;
    const g = gain(ctx, 0, out);
    hit(g.gain, t, level, 0.004, dur);
    const f = filter(ctx, type, from, q, g);
    sweep(f.frequency, t, from, to, dur);
    const src = this.m.noiseSource(pink);
    src.connect(f);
    this.m.startNoise(src, t, dur + 0.05);
  }

  /** A pitched blip that slides from `from` to `to` Hz. */
  private chirp(out: AudioNode, t: number, type: OscillatorType, from: number, to: number, level: number, dur: number): void {
    const ctx = this.m.ctx;
    const g = gain(ctx, 0, out);
    hit(g.gain, t, level, 0.004, dur);
    const o = osc(ctx, type, from, g);
    sweep(o.frequency, t, from, to, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A monster spots the player: a short, rising two-note call. */
  notice(t: number, pan: number): void {
    const out = this.out(pan, 0.35, 0.2);
    this.chirp(out, t, 'triangle', 420, 640, 0.25, 0.08);
    this.chirp(out, t + 0.07, 'triangle', 560, 900, 0.2, 0.1);
  }

  /** The frog's throat swelling: a low, wet, rising croak. */
  gulp(t: number, pan: number): void {
    const out = this.out(pan, 0.6, 0.25);
    const ctx = this.m.ctx;
    const g = gain(ctx, 0, filter(ctx, 'lowpass', 900, 3, out));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.25);
    g.gain.linearRampToValueAtTime(0, t + 0.55);
    const o = osc(ctx, 'sawtooth', 90, g);
    sweep(o.frequency, t, 90, 150, 0.5);
    const lfo = osc(ctx, 'sine', 22, gain(ctx, 25, o.frequency));
    lfo.start(t);
    lfo.stop(t + 0.6);
    o.start(t);
    o.stop(t + 0.6);
  }

  /** The venom leaving the frog's mouth: a wet pop and a little glitter. */
  spit(t: number, pan: number): void {
    const out = this.out(pan, 0.7, 0.35);
    this.chirp(out, t, 'sine', 900, 260, 0.35, 0.09);
    this.burstNoise(out, t, 'bandpass', 2400, 700, 2, 0.35, 0.12);
    this.sparkle(out, t + 0.04, 2, 0.04);
  }

  /** A soft hop on the grass. */
  hop(t: number, pan: number): void {
    const out = this.out(pan, 0.3, 0.05);
    this.chirp(out, t, 'sine', 240, 120, 0.25, 0.06);
  }

  /** Venom bursting: a fizzy splat. */
  splash(t: number, pan: number): void {
    const out = this.out(pan, 0.6, 0.3);
    this.burstNoise(out, t, 'bandpass', 1800, 500, 1.5, 0.45, 0.2);
    this.burstNoise(out, t + 0.02, 'highpass', 5000, 7000, 0.7, 0.1, 0.25);
    this.sparkle(out, t + 0.03, 3, 0.03);
  }

  /** The beetle bracing to charge: dry clicks of chitin, quickening. */
  chitter(t: number, pan: number): void {
    const out = this.out(pan, 0.7, 0.2);
    for (let i = 0; i < 7; i++) {
      const at = t + i * (0.11 - i * 0.008);
      this.burstNoise(out, at, 'bandpass', rand(2600, 3400), 2000, 6, 0.4, 0.025);
    }
    this.chirp(out, t, 'sawtooth', 60, 110, 0.12, 0.7);
  }

  /** Wings blurring into a charge: a rough buzzing drone. */
  buzz(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.6, 0.25);
    const g = gain(ctx, 0, filter(ctx, 'lowpass', 1600, 1, out));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.04);
    g.gain.setTargetAtTime(0, t + 0.45, 0.08);
    for (const f of [118, 121]) {
      const o = osc(ctx, 'sawtooth', f, g);
      sweep(o.frequency, t, f * 1.2, f, 0.3);
      o.start(t);
      o.stop(t + 0.9);
    }
  }

  /** The beetle landing: a heavy thump, and a crack if it hit a wall. */
  thud(t: number, pan: number, hard: boolean): void {
    const out = this.out(pan, hard ? 1 : 0.7, 0.3);
    this.chirp(out, t, 'sine', 120, 40, 0.6, 0.22);
    this.burstNoise(out, t, 'lowpass', 1200, 300, 0.7, 0.35, 0.15, true);
    if (hard) this.burstNoise(out, t, 'bandpass', 800, 600, 3, 0.4, 0.1);
  }

  /** The puffcap swelling: an airy, rising hiss. */
  swell(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.5, 0.3);
    const g = gain(ctx, 0, out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.65);
    g.gain.linearRampToValueAtTime(0, t + 0.72);
    const bp = filter(ctx, 'bandpass', 500, 3, g);
    sweep(bp.frequency, t, 500, 2600, 0.7);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, 0.75);
  }

  /** The spores bursting out: a soft, round whoomp. */
  puff(t: number, pan: number): void {
    const out = this.out(pan, 0.8, 0.5);
    this.chirp(out, t, 'sine', 180, 60, 0.45, 0.2);
    this.burstNoise(out, t, 'lowpass', 2200, 400, 0.8, 0.5, 0.35, true);
    this.sparkle(out, t + 0.05, 3, 0.05);
  }

  /** A monster falling: a descending chirp and a puff; heavier monsters sound lower. */
  monsterDie(t: number, pan: number, mass: number): void {
    const out = this.out(pan, 0.7, 0.4);
    const k = 1 / Math.sqrt(mass);
    this.chirp(out, t, 'triangle', 700 * k, 160 * k, 0.3, 0.3);
    this.burstNoise(out, t + 0.05, 'lowpass', 1800, 300, 0.7, 0.3, 0.3, true);
    this.bell(out, t + 0.08, 1320, 0.03, 0.5);
  }

  /** The Warden calls the stars down: a rising chord of bells over a shimmer. */
  starcall(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.8, 0.7);
    [392, 523, 659, 784].forEach((f, i) => this.bell(out, t + i * 0.11, f, 0.05, 1.4));
    const g = gain(ctx, 0, out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.6);
    g.gain.linearRampToValueAtTime(0, t + 0.95);
    const bp = filter(ctx, 'bandpass', 1200, 5, g);
    sweep(bp.frequency, t, 900, 4200, 0.9);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, 1);
    this.sparkle(out, t + 0.3, 6, 0.07);
  }

  /** A falling star striking the platform: a bright crack and a deep thud. */
  starImpact(t: number, pan: number): void {
    const out = this.out(pan, 0.75, 0.45);
    this.chirp(out, t, 'sine', 220, 38, 0.6, 0.35);
    this.burstNoise(out, t, 'lowpass', 5000, 400, 0.8, 0.45, 0.3, true);
    this.sparkle(out, t + 0.02, 3, 0.04);
  }

  /** The singularity forming: a low drone that climbs and tightens for `dur` seconds. */
  gravityWell(t: number, dur: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.9, 0.6);
    const g = gain(ctx, 0, filter(ctx, 'lowpass', 900, 1, out));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    for (const f of [41, 41.6, 82]) {
      const o = osc(ctx, 'sawtooth', f, g);
      sweep(o.frequency, t, f, f * 2.2, dur);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    const air = gain(ctx, 0, out);
    air.gain.setValueAtTime(0, t);
    air.gain.linearRampToValueAtTime(0.3, t + dur);
    air.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const bp = filter(ctx, 'bandpass', 300, 6, air);
    sweep(bp.frequency, t, 300, 1800, dur);
    const lfo = osc(ctx, 'sine', 6, gain(ctx, 120, bp.frequency));
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.1);
  }

  /** The supernova: a huge boom, a roar of light and a ringing chord. */
  nova(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 1, 0.8);
    const b = gain(ctx, 0, out);
    hit(b.gain, t, 1, 0.004, 1.1);
    const lo = osc(ctx, 'sine', 90, b);
    sweep(lo.frequency, t, 90, 24, 1);
    lo.start(t);
    lo.stop(t + 1.2);
    this.burstNoise(out, t, 'lowpass', 6000, 250, 0.7, 0.7, 1, true);
    [523, 659, 784, 1047].forEach((f) => this.bell(out, t + 0.05, f, 0.045, 2));
    this.sparkle(out, t + 0.08, 8, 0.05);
  }

  /** The player is struck: a dull thump and a short grunt-like buzz. */
  hurt(t: number): void {
    const out = this.out(0, 0.9, 0.2);
    this.chirp(out, t, 'sine', 160, 55, 0.6, 0.18);
    this.burstNoise(out, t, 'bandpass', 900, 400, 1.5, 0.35, 0.12);
    this.chirp(filter(this.m.ctx, 'lowpass', 900, 1, out), t, 'sawtooth', 220, 150, 0.08, 0.12);
  }

  /** The player falls: a long, sinking chord. */
  fall(t: number): void {
    const out = this.out(0, 0.8, 0.7);
    for (const [f, d] of [
      [392, 0],
      [311, 0.12],
      [262, 0.24],
    ]) this.chirp(out, t + d, 'triangle', f, f * 0.7, 0.18, 1.1);
    this.burstNoise(out, t, 'lowpass', 1400, 200, 0.7, 0.3, 0.6, true);
  }

  /** The player rises again: a bright, rising arpeggio. */
  revive(t: number): void {
    const out = this.out(0, 0.6, 0.6);
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.bell(out, t + i * 0.07, f, 0.05, 1.1));
    this.sparkle(out, t + 0.3, 4, 0.05);
  }

  /** A saber's hum rising and falling as the blade sweeps past: two detuned buzzes under a whoosh. */
  saberSwing(t: number, pan: number, step: number): void {
    const ctx = this.m.ctx;
    const twirl = step >= 3;
    const dur = twirl ? 0.34 : 0.2;
    const out = this.out(pan, twirl ? 0.8 : 0.7, 0.3);
    const hum = gain(ctx, 0, out);
    hit(hum.gain, t, 0.22, 0.03, dur);
    const lp = filter(ctx, 'lowpass', 900, 2.5, hum);
    sweep(lp.frequency, t, 500, twirl ? 1800 : 1400, dur * 0.4);
    sweep(lp.frequency, t + dur * 0.4, twirl ? 1800 : 1400, 400, dur * 0.6);
    const f0 = [92, 104, 86][Math.min(2, step - 1)] * rand(0.97, 1.03);
    for (const [f, d] of [
      [f0, -8],
      [f0 * 1.5, 7],
    ]) {
      const o = osc(ctx, 'sawtooth', f, lp);
      o.detune.value = d;
      // The Doppler bend of the blade passing close.
      sweep(o.frequency, t, f, f * 1.45, dur * 0.4);
      sweep(o.frequency, t + dur * 0.4, f * 1.45, f * 0.8, dur * 0.6);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const w = gain(ctx, 0, out);
    hit(w.gain, t, 0.3, 0.03, dur);
    const bp = filter(ctx, 'bandpass', 1200, 1.4, w);
    sweep(bp.frequency, t, 700, 2200, dur * 0.4);
    sweep(bp.frequency, t + dur * 0.4, 2200, 600, dur * 0.6);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.05);
  }

  /** The blade burning into a target: a crackling sizzle and a buzzing bite. */
  saberHit(t: number, pan: number, heavy: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, heavy ? 0.9 : 0.75, 0.3);
    const z = gain(ctx, 0, out);
    hit(z.gain, t, 0.45, 0.002, heavy ? 0.28 : 0.18);
    const hp = filter(ctx, 'highpass', 2500, 0.8, z);
    const n = this.m.noiseSource();
    n.connect(hp);
    this.m.startNoise(n, t, 0.3);
    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.2, 0.002, 0.16);
    const o = osc(ctx, 'sawtooth', 220, filter(ctx, 'lowpass', 1600, 1, b));
    sweep(o.frequency, t, 220, 70, 0.15);
    o.start(t);
    o.stop(t + 0.2);
    const th = gain(ctx, 0, out);
    hit(th.gain, t, heavy ? 0.4 : 0.25, 0.002, 0.12);
    const lo = osc(ctx, 'sine', 150, th);
    sweep(lo.frequency, t, 150, 55, 0.12);
    lo.start(t);
    lo.stop(t + 0.18);
  }

  /** The saber lighting: a snap, then a hum swelling up to pitch. */
  ignite(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.55, 0.3);
    const snap = gain(ctx, 0, out);
    hit(snap.gain, t, 0.35, 0.001, 0.08);
    const hp = filter(ctx, 'highpass', 1800, 0.7, snap);
    const n = this.m.noiseSource();
    n.connect(hp);
    this.m.startNoise(n, t, 0.1);
    const hum = gain(ctx, 0, out);
    hum.gain.setValueAtTime(0, t);
    hum.gain.linearRampToValueAtTime(0.16, t + 0.12);
    hum.gain.setTargetAtTime(0, t + 0.35, 0.18);
    const lp = filter(ctx, 'lowpass', 700, 2, hum);
    sweep(lp.frequency, t, 2400, 600, 0.4);
    for (const [f, d] of [
      [90, -6],
      [135, 6],
    ]) {
      const o = osc(ctx, 'sawtooth', f * 0.5, lp);
      o.detune.value = d;
      sweep(o.frequency, t, f * 0.5, f, 0.2);
      o.start(t);
      o.stop(t + 1.2);
    }
  }

  /** The Force gathering in the palm: air drawn in, rising. */
  forceGather(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.6, 0.5);
    const dur = 0.3;
    const air = gain(ctx, 0, out);
    air.gain.setValueAtTime(0, t);
    air.gain.linearRampToValueAtTime(0.35, t + dur);
    air.gain.linearRampToValueAtTime(0, t + dur + 0.06);
    const lp = filter(ctx, 'lowpass', 300, 1.5, air);
    sweep(lp.frequency, t, 250, 1800, dur);
    const src = this.m.noiseSource(true);
    src.connect(lp);
    this.m.startNoise(src, t, dur + 0.1);
    const lo = gain(ctx, 0, out);
    lo.gain.setValueAtTime(0, t);
    lo.gain.linearRampToValueAtTime(0.18, t + dur);
    lo.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    const o = osc(ctx, 'sine', 55, lo);
    sweep(o.frequency, t, 55, 90, dur);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  /** The push: a deep, rolling whump of air; on the dark side, a crackle of lightning with it. */
  forcePush(t: number, pan: number, dark: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 1, 0.6);
    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.8, 0.01, 0.5);
    const lo = osc(ctx, 'sine', 95, b);
    sweep(lo.frequency, t, 95, 30, 0.45);
    lo.start(t);
    lo.stop(t + 0.6);
    const r = gain(ctx, 0, out);
    hit(r.gain, t, 0.55, 0.02, 0.5);
    const lp = filter(ctx, 'lowpass', 2400, 0.9, r);
    sweep(lp.frequency, t, 2600, 250, 0.5);
    const src = this.m.noiseSource(true);
    src.connect(lp);
    this.m.startNoise(src, t, 0.55);
    if (dark) {
      const z = gain(ctx, 0, out);
      hit(z.gain, t + 0.01, 0.3, 0.004, 0.35);
      const hp = filter(ctx, 'highpass', 3000, 0.7, z);
      const trem = osc(ctx, 'square', 37, gain(ctx, 0.25, z.gain));
      trem.start(t);
      trem.stop(t + 0.4);
      const n = this.m.noiseSource();
      n.connect(hp);
      this.m.startNoise(n, t, 0.4);
    } else {
      this.sparkle(out, t + 0.05, 3, 0.05);
    }
  }

  /** A punch cutting the air: a short, tight whoosh, heavier and lower down the combo. */
  punch(t: number, pan: number, step: number): void {
    const ctx = this.m.ctx;
    const heavy = step >= 5;
    const dur = heavy ? 0.24 : 0.09 + step * 0.012;
    const out = this.out(pan, heavy ? 0.85 : 0.6, 0.15);
    const w = gain(ctx, 0, out);
    hit(w.gain, t, heavy ? 0.55 : 0.45, 0.008, dur);
    const bp = filter(ctx, 'bandpass', 1500, heavy ? 1.2 : 1.8, w);
    const top = (heavy ? 1300 : [3000, 2600, 2200, 2400][Math.min(3, step - 1)]) * rand(0.94, 1.06);
    sweep(bp.frequency, t, top * 0.5, top, dur * 0.3);
    sweep(bp.frequency, t + dur * 0.3, top, top * 0.45, dur * 0.7);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.03);
    if (heavy) {
      // The finisher's wind-up snaps into a deep push of air.
      this.chirp(out, t, 'sine', 180, 55, 0.4, 0.22);
    }
  }

  /** A fist landing: a meaty thump under the slap of leather. */
  punchHit(t: number, pan: number, heavy: boolean): void {
    const out = this.out(pan, heavy ? 1 : 0.75, heavy ? 0.35 : 0.2);
    this.chirp(out, t, 'sine', heavy ? 150 : 190, heavy ? 42 : 60, heavy ? 0.75 : 0.55, heavy ? 0.2 : 0.11);
    this.burstNoise(out, t, 'lowpass', 2600, 500, 0.8, heavy ? 0.6 : 0.45, heavy ? 0.12 : 0.06, true);
    this.burstNoise(out, t, 'bandpass', rand(1300, 1700), 900, 2.2, heavy ? 0.45 : 0.35, 0.035);
    if (heavy) this.burstNoise(out, t + 0.01, 'bandpass', 420, 180, 1.5, 0.4, 0.18, true);
  }

  /** One fist of the barrage: the lightest tick of air, so dozens a second never pile up. */
  flurry(t: number, pan: number): void {
    const out = this.out(pan, 0.4, 0.1);
    this.burstNoise(out, t, 'bandpass', rand(2600, 3400), rand(1200, 1600), 2, 0.35, 0.045);
  }

  /** The barrage kindling: breath drawn in hard and a rising roar of fire. */
  kiai(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.75, 0.45);
    const dur = 0.4;
    const air = gain(ctx, 0, out);
    air.gain.setValueAtTime(0, t);
    air.gain.linearRampToValueAtTime(0.45, t + dur * 0.8);
    air.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    const bp = filter(ctx, 'bandpass', 400, 1.2, air);
    sweep(bp.frequency, t, 300, 2400, dur);
    const src = this.m.noiseSource(true);
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.15);
    const lo = gain(ctx, 0, out);
    lo.gain.setValueAtTime(0, t);
    lo.gain.linearRampToValueAtTime(0.25, t + dur * 0.9);
    lo.gain.linearRampToValueAtTime(0, t + dur + 0.12);
    const o = osc(ctx, 'sawtooth', 70, filter(ctx, 'lowpass', 500, 1, lo));
    sweep(o.frequency, t, 70, 140, dur);
    o.start(t);
    o.stop(t + dur + 0.15);
  }

  /** A flask lobbed: a soft swish of the coat and the glass clinking as it leaves the hand. */
  toss(t: number, pan: number, big: boolean): void {
    const out = this.out(pan, big ? 0.75 : 0.55, 0.2);
    this.burstNoise(out, t, 'bandpass', big ? 1400 : 2000, big ? 500 : 800, 1.4, big ? 0.4 : 0.3, big ? 0.22 : 0.13);
    this.bell(out, t + 0.01, big ? 1760 : 2350, 0.03, 0.18);
    // The poison sloshing inside.
    this.chirp(filter(this.m.ctx, 'lowpass', 900, 2, out), t + 0.03, 'sine', big ? 300 : 420, big ? 520 : 700, 0.12, 0.08);
  }

  /** A flask bursting: glass breaking, a wet splat and the fizz of the poison eating into the ground. */
  shatter(t: number, pan: number, big: boolean): void {
    const out = this.out(pan, big ? 1 : 0.7, big ? 0.45 : 0.3);
    // Glass: bright, dense ticks and a couple of ringing shards.
    for (let i = 0; i < (big ? 7 : 5); i++) this.burstNoise(out, t + i * rand(0.008, 0.018), 'bandpass', rand(4200, 7200), rand(3000, 5000), 5, 0.3, 0.03);
    this.bell(out, t, rand(2900, 3300), big ? 0.05 : 0.035, 0.35);
    this.bell(out, t + 0.03, rand(3900, 4400), 0.025, 0.25);
    // The splash.
    this.burstNoise(out, t, 'lowpass', big ? 1600 : 2200, 350, 0.9, big ? 0.6 : 0.4, big ? 0.28 : 0.16, true);
    if (big) this.chirp(out, t, 'sine', 140, 45, 0.55, 0.25);
    // The fizz.
    this.burstNoise(out, t + 0.05, 'highpass', 5200, 6800, 0.7, big ? 0.16 : 0.1, big ? 0.9 : 0.45);
  }

  /** The great flask brought to the boil: quick bubbles rising in pitch and a cork straining. */
  brew(t: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.6, 0.35);
    const lp = filter(ctx, 'lowpass', 1600, 1.5, out);
    for (let i = 0; i < 9; i++) {
      const at = t + i * 0.055 * rand(0.8, 1.2);
      const f = 260 + i * 45 + rand(-30, 30);
      this.chirp(lp, at, 'sine', f, f * 1.9, 0.22, 0.05);
    }
    this.burstNoise(out, t, 'bandpass', 500, 1400, 1.2, 0.18, 0.5, true);
  }

  /** The bog spreading: a deep glug and a long seething hiss. */
  bog(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.8, 0.55);
    this.chirp(filter(ctx, 'lowpass', 600, 3, out), t, 'sawtooth', 80, 55, 0.35, 0.45);
    const g = gain(ctx, 0, out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.15);
    g.gain.setTargetAtTime(0, t + 0.5, 0.5);
    const bp = filter(ctx, 'bandpass', 3000, 0.8, g);
    sweep(bp.frequency, t, 1800, 4200, 1.2);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, 2.2);
  }

  /** Poison biting: a tiny acid sizzle and one wet bubble. */
  sizzle(t: number, pan: number): void {
    const out = this.out(pan, 0.35, 0.15);
    this.burstNoise(out, t, 'highpass', 4800, 6400, 0.8, 0.22, 0.12);
    const f = rand(380, 520);
    this.chirp(filter(this.m.ctx, 'lowpass', 1200, 1, out), t + 0.02, 'sine', f, f * 1.8, 0.12, 0.05);
  }

  /** A soul bolt loosed: a hollow, falling moan and a breath of air; the blood lance is a wet, sharp hiss. */
  soulCast(t: number, pan: number, blood: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.7, 0.5);
    if (blood) {
      this.burstNoise(out, t, 'bandpass', 2400, 900, 2.2, 0.35, 0.16);
      this.chirp(filter(ctx, 'lowpass', 1400, 1, out), t, 'sawtooth', 320, 140, 0.12, 0.14);
      return;
    }
    const g = gain(ctx, 0, filter(ctx, 'lowpass', 1800, 1.5, out));
    hit(g.gain, t, 0.16, 0.03, 0.4);
    for (const f of [440, 466]) {
      const o = osc(ctx, 'triangle', f, g);
      sweep(o.frequency, t, f, f * 0.6, 0.4);
      o.start(t);
      o.stop(t + 0.45);
    }
    this.burstNoise(out, t, 'bandpass', 900, 2600, 1.2, 0.18, 0.3);
  }

  /** A soul bolt striking: a cold chime and a puff; blood strikes wetter and lower. */
  soulHit(t: number, pan: number, blood: boolean): void {
    const out = this.out(pan, 0.7, 0.35);
    if (blood) {
      this.chirp(out, t, 'sine', 180, 60, 0.45, 0.1);
      this.burstNoise(out, t, 'lowpass', 1400, 300, 1, 0.35, 0.12, true);
      return;
    }
    this.bell(out, t, rand(1500, 1700), 0.04, 0.3);
    this.burstNoise(out, t, 'bandpass', 1800, 700, 1.4, 0.3, 0.14);
  }

  /** The staff driven into the ground and the dead answering: a deep thud, a rising chord of wails, earth cracking. */
  raiseDead(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.9, 0.6);
    this.chirp(out, t, 'sine', 110, 40, 0.7, 0.4);
    this.burstNoise(out, t, 'lowpass', 900, 200, 0.8, 0.45, 0.35, true);
    const g = gain(ctx, 0, filter(ctx, 'lowpass', 2200, 1, out));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.25);
    g.gain.linearRampToValueAtTime(0, t + 1.1);
    for (const f of [220, 262, 330]) {
      const o = osc(ctx, 'triangle', f * 0.8, g);
      sweep(o.frequency, t, f * 0.8, f, 0.9);
      o.start(t);
      o.stop(t + 1.15);
    }
    for (let i = 0; i < 4; i++) this.burstNoise(out, t + 0.1 + i * rand(0.05, 0.1), 'bandpass', rand(1800, 2600), 900, 3, 0.2, 0.04);
  }

  /** A risen blade biting: a dry bony clack and a scrape. */
  boneHit(t: number, pan: number): void {
    const out = this.out(pan, 0.5, 0.15);
    this.burstNoise(out, t, 'bandpass', rand(2600, 3200), 1800, 4, 0.35, 0.03);
    this.chirp(out, t, 'triangle', 600, 300, 0.12, 0.04);
    this.burstNoise(out, t + 0.02, 'highpass', 4000, 5200, 0.8, 0.12, 0.08);
  }

  /** The risen falling apart: a patter of bones on the ground. */
  boneCrumble(t: number, pan: number): void {
    const out = this.out(pan, 0.45, 0.2);
    for (let i = 0; i < 6; i++) this.burstNoise(out, t + i * rand(0.03, 0.07), 'bandpass', rand(1400, 2600), rand(900, 1400), 4, 0.25, 0.03);
  }

  /** The crimson nova: a heartbeat, then a wet roar spreading out. */
  bloodNova(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.95, 0.55);
    this.chirp(out, t, 'sine', 90, 45, 0.7, 0.18);
    this.chirp(out, t + 0.14, 'sine', 80, 40, 0.55, 0.2);
    const g = gain(ctx, 0, out);
    g.gain.setValueAtTime(0, t + 0.12);
    g.gain.linearRampToValueAtTime(0.4, t + 0.18);
    g.gain.setTargetAtTime(0, t + 0.3, 0.2);
    const lp = filter(ctx, 'lowpass', 2400, 1, g);
    sweep(lp.frequency, t + 0.12, 2400, 500, 0.6);
    const src = this.m.noiseSource();
    src.connect(lp);
    this.m.startNoise(src, t + 0.12, 0.9);
  }

  /** The bow drawn: the wood creaking as the string comes back, longer for the volley. */
  bowDraw(t: number, big: boolean): void {
    const ctx = this.m.ctx;
    const dur = big ? 0.5 : 0.14;
    const out = this.out(0, big ? 0.5 : 0.28, 0.15);
    const g = gain(ctx, 0, out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(big ? 0.3 : 0.22, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
    const bp = filter(ctx, 'bandpass', 700, 6, g);
    sweep(bp.frequency, t, 520, big ? 1100 : 900, dur);
    // A creak is a fast train of clicks: a low square wave through the resonance.
    const o = osc(ctx, 'square', big ? 38 : 55, bp);
    sweep(o.frequency, t, big ? 30 : 45, big ? 70 : 80, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** An arrow loosed: the string's twang, the thrum of the limbs and a whip of air; the storm bow snaps with a spark. */
  bowShot(t: number, pan: number, storm: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.75, 0.2);
    const tw = gain(ctx, 0, out);
    hit(tw.gain, t, 0.4, 0.002, 0.16);
    const f = rand(150, 175);
    const o = osc(ctx, 'triangle', f * 2.2, filter(ctx, 'lowpass', 2600, 2, tw));
    sweep(o.frequency, t, f * 2.2, f, 0.05);
    o.start(t);
    o.stop(t + 0.2);
    this.chirp(out, t, 'sine', 120, 70, 0.3, 0.08);
    this.burstNoise(out, t + 0.01, 'bandpass', 3200, 1400, 1.6, 0.35, 0.12);
    if (storm) this.zap(out, t, 0.18, 0.12);
  }

  /** An arrow striking home: a hard wooden thock into the body; the storm arrow bursts in a crackle. */
  arrowHit(t: number, pan: number, storm: boolean): void {
    const out = this.out(pan, 0.8, 0.2);
    this.chirp(out, t, 'sine', 220, 70, 0.55, 0.08);
    this.burstNoise(out, t, 'bandpass', rand(1500, 1900), 700, 3, 0.45, 0.04);
    this.burstNoise(out, t, 'lowpass', 1800, 300, 0.8, 0.3, 0.06, true);
    if (storm) this.zap(out, t + 0.005, 0.26, 0.18);
  }

  /** An arrow thudding into the ground. */
  arrowStick(t: number, pan: number, level: number): void {
    const out = this.out(pan, level, 0.1);
    this.chirp(out, t, 'sine', 180, 90, 0.35, 0.05);
    this.burstNoise(out, t, 'bandpass', rand(900, 1300), 500, 2.5, 0.25, 0.03);
  }

  /** The volley loosed skyward: a deep twang and the arrow whistling up out of sight. */
  volley(t: number, pan: number, storm: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.85, 0.45);
    const tw = gain(ctx, 0, out);
    hit(tw.gain, t, 0.45, 0.002, 0.3);
    const o = osc(ctx, 'triangle', 240, filter(ctx, 'lowpass', 2200, 2, tw));
    sweep(o.frequency, t, 260, 110, 0.08);
    o.start(t);
    o.stop(t + 0.35);
    const w = gain(ctx, 0, out);
    w.gain.setValueAtTime(0, t);
    w.gain.linearRampToValueAtTime(0.12, t + 0.05);
    w.gain.linearRampToValueAtTime(0, t + 0.5);
    const wo = osc(ctx, 'sine', 1400, w);
    sweep(wo.frequency, t, 1300, 3200, 0.5);
    wo.start(t);
    wo.stop(t + 0.55);
    if (storm) this.zap(out, t, 0.3, 0.3);
  }

  /** The rain coming down: a swarm of falling whistles; in the storm, a crack of thunder and its rumble. */
  arrowRain(t: number, pan: number, storm: boolean): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 0.7, 0.5);
    for (let i = 0; i < 5; i++) {
      const at = t + i * 0.06 * rand(0.7, 1.3);
      const g = gain(ctx, 0, out);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.05, at + 0.05);
      g.gain.linearRampToValueAtTime(0, at + 0.35);
      const f = rand(2600, 3400);
      const o = osc(ctx, 'sine', f, g);
      sweep(o.frequency, at, f, f * 0.45, 0.35);
      o.start(at);
      o.stop(at + 0.4);
    }
    if (storm) {
      this.zap(out, t, 0.5, 0.25);
      const r = gain(ctx, 0, out);
      r.gain.setValueAtTime(0, t);
      r.gain.linearRampToValueAtTime(0.7, t + 0.03);
      r.gain.setTargetAtTime(0, t + 0.1, 0.45);
      const lp = filter(ctx, 'lowpass', 900, 0.8, r);
      sweep(lp.frequency, t, 1400, 160, 1.2);
      const src = this.m.noiseSource(true);
      src.connect(lp);
      this.m.startNoise(src, t, 2);
    }
  }

  /** A dagger flicked out: a thin, quick hiss of steel, lower and longer on the finisher. */
  knife(t: number, pan: number, step: number, finisher: boolean): void {
    const dur = finisher ? 0.16 : 0.07;
    const out = this.out(pan, finisher ? 0.7 : 0.5, 0.15);
    const top = finisher ? 3200 : [5200, 4600, 4900, 4400][Math.min(3, step - 1)] * rand(0.95, 1.05);
    this.burstNoise(out, t, 'bandpass', top * 0.6, top, 3, 0.4, dur);
    // A ring of the blade's edge.
    this.chirp(out, t, 'triangle', top * 0.5, top * 0.62, 0.04, dur * 1.4);
    if (finisher) this.burstNoise(out, t + 0.05, 'bandpass', 2200, 900, 1.6, 0.35, 0.12);
  }

  /** A dagger going in: a sharp, dry bite and a small thock. */
  knifeHit(t: number, pan: number, heavy: boolean): void {
    const out = this.out(pan, heavy ? 0.85 : 0.65, 0.15);
    this.burstNoise(out, t, 'highpass', rand(3200, 4200), 2400, 0.9, heavy ? 0.5 : 0.4, 0.035);
    this.chirp(out, t, 'sine', heavy ? 260 : 320, heavy ? 80 : 110, heavy ? 0.45 : 0.32, heavy ? 0.1 : 0.06);
    if (heavy) this.burstNoise(out, t + 0.008, 'bandpass', 1400, 600, 1.8, 0.35, 0.09);
  }

  /** Vanishing into smoke: a soft, falling poof of air (with a shimmer for the dancer). */
  vanish(t: number, pan: number, dance: boolean): void {
    const out = this.out(pan, 0.7, 0.4);
    this.burstNoise(out, t, 'lowpass', 2600, 300, 0.7, 0.55, 0.3, true);
    this.burstNoise(out, t + 0.02, 'bandpass', 5200, 1800, 1.2, 0.2, 0.22);
    if (dance) for (let i = 0; i < 3; i++) this.chirp(out, t + 0.03 + i * 0.05, 'sine', SPARKLE[i * 2], SPARKLE[i * 2] * 1.2, 0.05, 0.14);
  }

  /** A blink through the shadows to the next foe: a quick breath of air swept upward. */
  blink(t: number, pan: number): void {
    const out = this.out(pan, 0.5, 0.25);
    this.burstNoise(out, t, 'bandpass', 900, 4200, 1.4, 0.3, 0.07);
  }

  /** Electricity: bright noise stuttered by a fast square tremolo. */
  private zap(out: AudioNode, t: number, level: number, dur: number): void {
    const ctx = this.m.ctx;
    const z = gain(ctx, 0, out);
    hit(z.gain, t, level, 0.002, dur);
    const trem = osc(ctx, 'square', rand(45, 70), gain(ctx, level * 0.8, z.gain));
    trem.start(t);
    trem.stop(t + dur + 0.05);
    const hp = filter(ctx, 'highpass', 2800, 0.7, z);
    const n = this.m.noiseSource();
    n.connect(hp);
    this.m.startNoise(n, t, dur + 0.05);
  }

  /** A Special gathering: a deep swell and a bright riser that climb together for `dur` seconds. */
  ultCharge(t: number, dur: number): void {
    const ctx = this.m.ctx;
    const out = this.out(0, 0.8, 0.7);
    const g = gain(ctx, 0, filter(ctx, 'lowpass', 2400, 0.8, out));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + dur * 0.9);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.06);
    for (const [f, type] of [
      [55, 'sawtooth'],
      [82.5, 'sawtooth'],
      [220, 'triangle'],
    ] as const) {
      const o = osc(ctx, type, f, g);
      sweep(o.frequency, t, f, f * 2, dur);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    const air = gain(ctx, 0, out);
    air.gain.setValueAtTime(0, t);
    air.gain.linearRampToValueAtTime(0.4, t + dur);
    air.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const bp = filter(ctx, 'bandpass', 400, 3, air);
    sweep(bp.frequency, t, 400, 4200, dur);
    const src = this.m.noiseSource();
    src.connect(bp);
    this.m.startNoise(src, t, dur + 0.1);
    this.sparkle(out, t + dur * 0.5, 4, dur * 0.1);
  }

  /** A Special unleashed: a heavy boom under a triumphant, ringing chord. */
  ultRelease(t: number, pan: number): void {
    const ctx = this.m.ctx;
    const out = this.out(pan, 1, 0.8);
    const b = gain(ctx, 0, out);
    hit(b.gain, t, 0.9, 0.004, 0.9);
    const lo = osc(ctx, 'sine', 110, b);
    sweep(lo.frequency, t, 110, 30, 0.8);
    lo.start(t);
    lo.stop(t + 1);
    this.burstNoise(out, t, 'lowpass', 7000, 300, 0.7, 0.55, 0.6, true);
    [392, 523, 659, 784].forEach((f) => this.bell(out, t + 0.03, f, 0.04, 1.6));
    this.sparkle(out, t + 0.06, 6, 0.045);
  }

  /** Energy soaked up from a fallen foe: a soft, rising blip. */
  energy(t: number, pan: number): void {
    const out = this.out(pan, 0.35, 0.3);
    this.chirp(out, t, 'sine', 880, 1760, 0.12, 0.12);
    this.chirp(out, t + 0.03, 'triangle', 1320, 2640, 0.05, 0.1);
  }

  /** The Special is ready: a quick, bright fanfare. */
  ultReady(t: number): void {
    const out = this.out(0, 0.55, 0.6);
    [659, 784, 988, 1319].forEach((f, i) => this.bell(out, t + i * 0.06, f, 0.05, 0.9));
    this.sparkle(out, t + 0.22, 4, 0.04);
  }

  private sparkle(dest: AudioNode, t: number, n: number, gap: number): void {
    const ctx = this.m.ctx;
    for (let i = 0; i < n; i++) {
      const at = t + i * gap * rand(0.8, 1.2);
      const g = gain(ctx, 0, dest);
      hit(g.gain, at, 0.05 * (1 - i / (n + 1)), 0.002, 0.25);
      const o = osc(ctx, 'sine', pick(SPARKLE), g);
      o.start(at);
      o.stop(at + 0.3);
    }
  }
}

/**
 * The beam gathering: a pair of detuned saws and an airy shimmer that climb in
 * pitch, brightness and tremolo speed as the charge fills, then wobble once the
 * charge turns unstable.
 */
export class BeamHum {
  private env: GainNode;
  private oscs: OscillatorNode[] = [];
  private lp: BiquadFilterNode;
  private trem: OscillatorNode;
  private wobble: GainNode;
  private air: GainNode;
  private noise: AudioBufferSourceNode;

  constructor(m: Mixer, out: AudioNode, t: number) {
    const ctx = m.ctx;
    this.env = gain(ctx, 0, out);
    this.env.gain.setValueAtTime(0, t);
    this.env.gain.linearRampToValueAtTime(0.05, t + 0.15);

    // Tremolo: the level pulses, faster as the charge builds.
    const body = gain(ctx, 0.75, this.env);
    this.trem = osc(ctx, 'sine', 5, gain(ctx, 0.25, body.gain));
    this.lp = filter(ctx, 'lowpass', 500, 2, body);
    // Pitch wobble, only once unstable.
    this.wobble = gain(ctx, 0, undefined);
    const vib = osc(ctx, 'sine', 11, this.wobble);
    for (const [f, type, lvl] of [
      [110, 'sawtooth', 0.4],
      [110.8, 'sawtooth', 0.4],
      [220, 'sine', 0.6],
    ] as const) {
      const o = osc(ctx, type, f, gain(ctx, lvl, this.lp));
      this.wobble.connect(o.detune);
      this.oscs.push(o);
    }

    this.air = gain(ctx, 0, this.env);
    const bp = filter(ctx, 'bandpass', 1800, 3, this.air);
    this.noise = m.noiseLoop();
    this.noise.connect(bp);

    for (const o of [...this.oscs, this.trem, vib]) o.start(t);
    this.noise.start(t);
    this.oscs.push(this.trem, vib);
  }

  /** `level` 0..1 is the charge, `over` 0..1 how far into the unstable hold it is. */
  set(level: number, over: number, t: number): void {
    const k = 0.05;
    const f = 110 * Math.pow(2, level * 1.2);
    this.oscs[0].frequency.setTargetAtTime(f, t, k);
    this.oscs[1].frequency.setTargetAtTime(f * 1.007, t, k);
    this.oscs[2].frequency.setTargetAtTime(f * 2, t, k);
    this.lp.frequency.setTargetAtTime(500 + level * 2600, t, k);
    this.trem.frequency.setTargetAtTime(5 + level * 9 + over * 8, t, k);
    this.wobble.gain.setTargetAtTime(over * 60, t, k);
    this.env.gain.setTargetAtTime(0.05 + level * 0.07, t, k);
    this.air.gain.setTargetAtTime(0.05 + level * 0.25, t, k);
  }

  stop(t: number): void {
    this.env.gain.cancelScheduledValues(t);
    this.env.gain.setTargetAtTime(0, t, 0.03);
    for (const o of this.oscs) o.stop(t + 0.25);
    this.noise.stop(t + 0.25);
  }
}
