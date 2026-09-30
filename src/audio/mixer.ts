/** Shared buses, reverb and noise sources. Everything is synthesized, no samples. */
export class Mixer {
  readonly ctx: BaseAudioContext;
  /** Master level; mute ramps this. */
  readonly master: GainNode;
  readonly music: GainNode;
  readonly ambience: GainNode;
  readonly sfx: GainNode;
  /** Between the sfx bus and the master: eased down while many effects overlap. */
  readonly crowd: GainNode;
  /** Reverb send: connect anything here to put it in the space. */
  readonly reverb: GainNode;
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    // Glue and a ceiling in one node. The old gentle 3:1 with an 8 ms attack let
    // the first hit of every sound through untouched, so a fight's pile of
    // overlapping hits went past full scale and clipped: harsh crackle that grew
    // with the size of the battle. A fast, steep knee keeps the sum under 0 dB.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    this.master = gain(ctx, 0.9, comp);
    this.music = gain(ctx, 0.3, this.master);
    this.ambience = gain(ctx, 0.55, this.master);
    // Sound effects pass through the crowd trim, which GameSound lowers as more
    // of them overlap, so a busy fight gets fuller rather than louder.
    this.crowd = gain(ctx, 1, this.master);
    this.sfx = gain(ctx, 0.75, this.crowd);

    const conv = ctx.createConvolver();
    // Short enough to stay cheap on phones; the tail is near silent past this anyway.
    conv.buffer = impulse(ctx, 1.8);
    this.reverb = gain(ctx, 1, conv);
    conv.connect(gain(ctx, 0.5, this.master));

    this.white = noise(ctx, 2, false);
    this.pink = noise(ctx, 6, true);
  }

  /** A one-shot noise source starting at a random point in the buffer. */
  noiseSource(pink = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = pink ? this.pink : this.white;
    return src;
  }

  /** An endless noise bed. */
  noiseLoop(pink = false): AudioBufferSourceNode {
    const src = this.noiseSource(pink);
    src.loop = true;
    src.loopStart = LOOP_START;
    src.loopEnd = src.buffer!.duration;
    return src;
  }

  /** Start a noise source at a random offset so repeated hits never sound identical. */
  startNoise(src: AudioBufferSourceNode, t: number, dur: number): void {
    const len = src.buffer!.duration;
    src.start(t, Math.random() * Math.max(0, len - dur - 0.01), dur + 0.01);
  }
}

const LOOP_START = 0.05;

export function gain(ctx: BaseAudioContext, value: number, dest?: AudioNode | AudioParam): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  if (dest instanceof AudioParam) g.connect(dest);
  else if (dest) g.connect(dest);
  return g;
}

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, dest?: AudioNode): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  // Chrome works out a moving filter's coefficients for every single sample (a
  // sin, cos and pow each) whenever its frequency is swept or wobbled by an LFO,
  // which is nearly every sound here. In a big fight that is dozens of filters
  // at once and the audio thread misses its deadline: crackles and dropouts.
  // Once per 128-sample block (under 3 ms) sounds the same and costs a fraction.
  for (const p of [f.frequency, f.Q, f.detune, f.gain]) kRate(p);
  if (dest) f.connect(dest);
  return f;
}

/** Update an AudioParam once per render block rather than per sample, where the browser allows it. */
function kRate(p: AudioParam): void {
  try {
    if ('automationRate' in p) p.automationRate = 'k-rate';
  } catch {
    // Older browsers refuse: the param just stays sample-accurate.
  }
}

export function panner(ctx: BaseAudioContext, pan: number, dest: AudioNode): StereoPannerNode {
  const p = ctx.createStereoPanner();
  // A position that isn't a number (a body mid-teleport, a camera not yet sized) plays centred.
  p.pan.value = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
  p.connect(dest);
  return p;
}

export function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, dest: AudioNode): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  return o;
}

/** Percussive envelope: quick linear attack, exponential-style decay toward silence. */
export function hit(p: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, decay / 4);
}

/** Pitch sweep that never touches zero (exponential ramps can't). */
export function sweep(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(1, from), t);
  p.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
}

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

function noise(ctx: BaseAudioContext, seconds: number, pink: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Paul Kellet's pink filter; white passes straight through.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) {
      d[i] = w;
      continue;
    }
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  // Blend the tail into the head so a loop from LOOP_START never clicks.
  const fade = Math.floor(ctx.sampleRate * LOOP_START);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
  }
  return buf;
}

/** A soft outdoor-ish room: decaying stereo noise that darkens as it fades. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const a = 0.55 - 0.5 * t; // one-pole lowpass closes over time
      y += a * (Math.random() * 2 - 1 - y);
      const pre = Math.min(1, i / (ctx.sampleRate * 0.012));
      d[i] = y * pre * Math.pow(1 - t, 3.2);
    }
  }
  return buf;
}
