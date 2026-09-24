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
