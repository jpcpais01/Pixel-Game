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
  heal(t: number, pan: number): void {
    const out = this.out(pan, 0.45, 0.5);
    const i = Math.floor(Math.random() * 3);
    this.bell(out, t, [784, 880, 988][i], 0.035, 0.5);
    this.bell(out, t + 0.07, [1175, 1319, 1480][i], 0.03, 0.6);
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
