import { Mixer, filter, gain, hit, osc, panner, pick, rand, sweep } from './mixer';

type Call = 'chirps' | 'whistle' | 'trill' | 'warble';

interface Bird {
  call: Call;
  pitch: number;
  pan: number;
  level: number;
  next: number;
}

interface Cricket {
  pitch: number;
  pan: number;
  level: number;
  period: number;
  pulses: number;
  next: number;
}

/**
 * The world's bed of sound. Day: wind in the leaves and a few birds that each
 * keep their own song. Night: crickets and the odd owl. The braziers crackle
 * louder the closer you stand.
 */
export class Ambience {
  private m: Mixer;
  private day: GainNode;
  private night: GainNode;
  private wind: GainNode;
  private windTone: BiquadFilterNode;
  private leaves: GainNode;
  private fire: GainNode;
  private birds: Bird[];
  private crickets: Cricket[];
  private daylight = 0;
  /** 0 out in the void, where there is no wind, bird or cricket. */
  private outdoors = 1;
  private fireLevel = 0;
  private nextGust = 0;
  private nextRustle = 0;
  private gust = 0.3;
  private nextCrackle = 0;
  private nextOwl = 0;

  constructor(m: Mixer) {
    this.m = m;
    const ctx = m.ctx;
    this.day = gain(ctx, 0, m.ambience);
    this.night = gain(ctx, 1, m.ambience);

    // Wind: slow pink noise through a wandering bandpass.
    this.wind = gain(ctx, 0.3, m.ambience);
    this.windTone = filter(ctx, 'bandpass', 500, 0.6, this.wind);
    const w = m.noiseLoop(true);
    w.connect(this.windTone);
    w.start();

    // Leaves: bright noise whose level flutters in tiny grains during gusts.
    this.leaves = gain(ctx, 0, m.ambience);
    const shelf = filter(ctx, 'highpass', 2400, 0.5, this.leaves);
    const soft = filter(ctx, 'lowpass', 7000, 0.5, shelf);
    const l = m.noiseLoop(false);
    l.connect(soft);
    l.start();

    // Fire bed: a low, breathy roar under the crackles.
    this.fire = gain(ctx, 0, m.ambience);
    const roar = filter(ctx, 'lowpass', 380, 0.8, gain(ctx, 0.5, this.fire));
    const f = m.noiseLoop(true);
    f.connect(roar);
    f.start();

    const calls: Call[] = ['chirps', 'whistle', 'trill', 'warble'];
    this.birds = calls.map((call, i) => ({
      call,
      pitch: rand(0.85, 1.15),
      pan: [-0.7, 0.55, -0.25, 0.8][i],
      level: rand(0.45, 1),
      next: rand(1, 6),
    }));
    this.crickets = [
      { pitch: 4400, pan: -0.6, level: 1, period: 0.82, pulses: 3, next: 0.3 },
      { pitch: 4650, pan: 0.5, level: 0.7, period: 1.05, pulses: 4, next: 0.7 },
      { pitch: 4200, pan: 0.1, level: 0.35, period: 0.66, pulses: 3, next: 0.5 },
      { pitch: 4900, pan: 0.85, level: 0.25, period: 1.3, pulses: 5, next: 1.1 },
    ];
    this.nextOwl = rand(12, 25);
  }

  /** 0 = night, 1 = full day. */
  setDaylight(d: number, t: number): void {
    if (Math.abs(d - this.daylight) < 0.005) return;
    this.daylight = d;
    this.day.gain.setTargetAtTime(d * this.outdoors, t, 0.3);
    this.night.gain.setTargetAtTime((1 - d) * this.outdoors, t, 0.3);
    this.wind.gain.setTargetAtTime(this.windLevel(), t, 0.3);
  }

  /** Nature's sounds on (a world) or off (deep space). */
  setOutdoors(on: boolean, t: number): void {
    const k = on ? 1 : 0;
    if (k === this.outdoors) return;
    this.outdoors = k;
    this.day.gain.setTargetAtTime(this.daylight * k, t, 0.3);
    this.night.gain.setTargetAtTime((1 - this.daylight) * k, t, 0.3);
    this.wind.gain.setTargetAtTime(this.windLevel(), t, 0.3);
  }

  /** 0..1, how close the listener stands to a fire. */
  setFire(level: number, t: number): void {
    if (Math.abs(level - this.fireLevel) < 0.01) return;
    this.fireLevel = level;
    this.fire.gain.setTargetAtTime(level, t, 0.25);
  }

  tick(now: number, until: number): void {
    const catchUp = (x: number) => (x < now - 0.5 ? now + rand(0.1, 1) : x);
    this.nextGust = catchUp(this.nextGust);
    while (this.nextGust < until) {
      const t = this.nextGust;
      this.gust = Math.pow(Math.random(), 1.5);
      this.wind.gain.setTargetAtTime(this.windLevel(), t, 1.2);
      this.windTone.frequency.setTargetAtTime(rand(320, 520) + this.gust * 500, t, 1.5);
      this.nextGust += rand(2, 5);
    }

    this.nextRustle = catchUp(this.nextRustle);
    while (this.nextRustle < until) {
      const t = this.nextRustle;
      const amount = (0.35 + 0.65 * this.daylight) * this.gust * this.outdoors;
      this.leaves.gain.setTargetAtTime(0.09 * amount * Math.pow(Math.random(), 2), t, 0.025);
      this.nextRustle += rand(0.04, 0.14);
    }

    for (const b of this.birds) {
      b.next = catchUp(b.next);
      while (b.next < until) {
        if (this.daylight > 0.05) this.sing(b, b.next);
        b.next += rand(3.5, 11);
      }
    }

    for (const c of this.crickets) {
      c.next = catchUp(c.next);
      while (c.next < until) {
        if (this.daylight < 0.95) this.chirp(c, c.next);
        // Crickets hold steady for a while, then pause.
        c.next += c.period * rand(0.97, 1.03) + (Math.random() < 0.06 ? rand(2, 6) : 0);
      }
    }

    this.nextOwl = catchUp(this.nextOwl);
    while (this.nextOwl < until) {
      if (this.daylight < 0.3) this.owl(this.nextOwl);
      this.nextOwl += rand(22, 45);
    }

    this.nextCrackle = catchUp(this.nextCrackle);
    while (this.nextCrackle < until) {
      if (this.fireLevel > 0.02) this.crackle(this.nextCrackle, Math.random() < 0.08);
      this.nextCrackle += Math.random() < 0.3 ? rand(0.01, 0.05) : rand(0.08, 0.4);
    }
  }

  private windLevel(): number {
    return (0.1 + this.gust * 0.35) * (0.6 + 0.4 * this.daylight) * this.outdoors;
  }

  /** A voice routed through a pan, with some of it sent into the reverb. */
  private voice(pan: number, level: number, bus: AudioNode, wet = 0.5): GainNode {
    const ctx = this.m.ctx;
    const out = gain(ctx, level, panner(ctx, pan, bus));
    out.connect(gain(ctx, wet, this.m.reverb));
    return out;
  }

  private tone(dest: AudioNode, t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine'): void {
    const g = gain(this.m.ctx, 0, dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.012, dur * 0.25));
    g.gain.setValueAtTime(peak, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const o = osc(this.m.ctx, type, f0, g);
    sweep(o.frequency, t, f0, f1, dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sing(b: Bird, t: number): void {
    const out = this.voice(b.pan + rand(-0.1, 0.1), 0.05 * b.level, this.day);
    const p = b.pitch;
    switch (b.call) {
      case 'chirps': {
        const n = Math.floor(rand(2, 6));
        for (let i = 0; i < n; i++) {
          const f = rand(2600, 3300) * p;
          this.tone(out, t + i * rand(0.15, 0.2), f, f * rand(1.3, 1.5), rand(0.06, 0.09), 1);
        }
        break;
      }
      case 'whistle': {
        // "fee-bee": two clean held notes, the second lower.
        this.tone(out, t, 3300 * p, 3200 * p, 0.34, 0.8);
        this.tone(out, t + 0.42, 2750 * p, 2650 * p, 0.4, 0.7);
        if (Math.random() < 0.4) this.tone(out, t + 0.9, 2750 * p, 2650 * p, 0.3, 0.5);
        break;
      }
      case 'trill': {
        const n = Math.floor(rand(8, 15));
        const f = rand(4200, 4800) * p;
        for (let i = 0; i < n; i++) {
          const k = 1 - (i / n) * 0.18;
          this.tone(out, t + i * 0.045, f * k * 1.08, f * k, 0.028, 0.6 * (1 - (i / n) * 0.5));
        }
        break;
      }
      case 'warble': {
        const n = Math.floor(rand(3, 7));
        let at = t;
        for (let i = 0; i < n; i++) {
          const f = pick([2300, 2600, 2900, 3300, 3700]) * p;
          const d = rand(0.09, 0.16);
          if (Math.random() < 0.5) this.tone(out, at, f * 0.8, f * 1.2, d, 0.8);
          else this.tone(out, at, f * 1.2, f * 0.85, d, 0.8);
          at += d + rand(0.03, 0.09);
        }
        break;
      }
    }
  }

  private chirp(c: Cricket, t: number): void {
    const ctx = this.m.ctx;
    const out = this.voice(c.pan, 0.022 * c.level, this.night, 0.25);
    const g = gain(ctx, 0, out);
    for (let i = 0; i < c.pulses; i++) {
      const at = t + i * 0.024;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.004);
      g.gain.linearRampToValueAtTime(0, at + 0.016);
    }
    const o = osc(ctx, 'sine', c.pitch, g);
    const end = t + c.pulses * 0.024 + 0.02;
    o.start(t);
    o.stop(end);
  }

  private owl(t: number): void {
    const out = this.voice(rand(-0.8, 0.8), 0.07, this.night, 1.2);
    const soft = filter(this.m.ctx, 'lowpass', 900, 0.5, out);
    const hoot = (at: number, dur: number) => {
      const g = gain(this.m.ctx, 0, soft);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + dur * 0.35);
      g.gain.linearRampToValueAtTime(0, at + dur);
      const o = osc(this.m.ctx, 'sine', 330, g);
      o.frequency.setValueAtTime(330, at);
      o.frequency.linearRampToValueAtTime(375, at + dur * 0.4);
      o.frequency.linearRampToValueAtTime(350, at + dur);
      o.start(at);
      o.stop(at + dur + 0.02);
    };
    // "hoo ... hoo-hoo"
    hoot(t, 0.5);
    hoot(t + 0.95, 0.22);
    hoot(t + 1.22, 0.42);
  }

  private crackle(t: number, pop: boolean): void {
    const m = this.m;
    const dur = pop ? rand(0.02, 0.04) : rand(0.003, 0.012);
    const g = gain(m.ctx, 0, this.fire);
    hit(g.gain, t, pop ? 0.5 : rand(0.1, 0.3), 0.001, dur);
    const bp = filter(m.ctx, 'bandpass', pop ? rand(900, 1600) : rand(1800, 5000), 1.2, g);
    const src = m.noiseSource();
    src.connect(bp);
    m.startNoise(src, t, dur * 3);
  }
}
