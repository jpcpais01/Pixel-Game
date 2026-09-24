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
