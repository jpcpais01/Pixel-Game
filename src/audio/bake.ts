import { Mixer, panner, pick } from './mixer';
import { Sfx } from './sfx';

/**
 * Baking: sounds rendered ahead of time, off the audio thread.
 *
 * Every sound in the game is synthesized: a sword swing is a dozen oscillators,
 * noise sources and moving filters, all built on the spot and run live on the
 * browser's real-time audio thread. That thread has to hand the speaker a fresh
 * slice of sound every few milliseconds, and on a phone that is also drawing the
 * game at 90 FPS it often couldn't: each missed slice is a click, a crackle or a
 * dropout. More sounds at once, more misses, which is why big fights were worst,
 * but the music and the ambience (built the same way, note by note) glitched too.
 *
 * So the same synth code now renders into clips with an OfflineAudioContext,
 * which runs on its own thread, at its own pace, with no deadline to miss. The
 * live audio thread only plays those clips back: one buffer source per sound
 * instead of a whole graph, and a single source per few seconds of music.
 */

type Offline = typeof OfflineAudioContext;
const OfflineCtx: Offline | undefined =
  typeof window === 'undefined'
    ? undefined
    : window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: Offline }).webkitOfflineAudioContext;

/** Seconds rendered for a sound effect's clip, then trimmed to where it falls silent. */
const SFX_WINDOW = 8;
/** Takes of each sound, so repeats don't sound identical (the synth is random). */
const VARIANTS = 3;
/** Sample frames kept across every clip (~24 MB); the least recently heard go first. */
const BUDGET = 6_000_000;
/** Quieter than this counts as silence when trimming a clip's tail. */
const SILENT = 1e-4;
/** The sounds this device has heard, baked again at the next launch before they're needed. */
const HEARD_KEY = 'pixel-battle.sfxClips';
const HEARD_MAX = 200;

interface Clip {
  method: string;
  args: unknown[];
  takes: AudioBuffer[];
  pending: boolean;
  failed: boolean;
  used: number;
}

/** Numbers rounded so a clip serves every call that sounds the same. */
function settle(v: unknown): unknown {
  if (typeof v !== 'number' || Number.isInteger(v)) return v;
  return Math.round(v * 10) / 10;
}

/** Sound effects, baked into clips the first time each is heard. */
export class SfxBaker {
  private clips = new Map<string, Clip>();
  private queue: Clip[] = [];
  private busy = false;
  private frames = 0;
  private clock = 0;
  private heard: { method: string; args: unknown[] }[] = [];
  private saveTimer = 0;

  constructor(private live: Mixer) {}

  get enabled(): boolean {
    return !!OfflineCtx;
  }

  /**
   * Play the sound from a clip, at `t` and on side `pan`. False means it isn't
   * baked yet (it is now queued): the caller synthesizes it live this once.
   */
  play(method: string, args: unknown[], panAt: number, t: number, pan: number): boolean {
    if (!OfflineCtx) return false;
    const clip = this.clip(method, args.map((a, i) => (i === panAt ? 0 : settle(a))));
    clip.used = ++this.clock;
    // A sound never baked jumps the queue; extra takes wait their turn.
    if (clip.takes.length < VARIANTS && !clip.pending && !clip.failed) this.enqueue(clip, !clip.takes.length);
    if (!clip.takes.length) return false;
    this.start(pick(clip.takes), t, pan);
    return true;
  }

  /** Bake what this device heard last time, quietly, before the game asks for it. */
  warm(): void {
    if (!OfflineCtx) return;
    try {
      const saved = JSON.parse(localStorage.getItem(HEARD_KEY) ?? '[]') as { method: string; args: unknown[] }[];
      if (!Array.isArray(saved)) return;
      for (const s of saved) {
        if (typeof s?.method !== 'string' || !Array.isArray(s.args)) continue;
        this.heard.push({ method: s.method, args: s.args });
        this.enqueue(this.clip(s.method, s.args), false);
      }
    } catch {
      // Nothing saved, or storage is off: clips are baked as sounds are heard.
    }
  }

  private clip(method: string, args: unknown[]): Clip {
    const key = `${method}:${JSON.stringify(args)}`;
    let clip = this.clips.get(key);
    if (!clip) {
      clip = { method, args, takes: [], pending: false, failed: false, used: 0 };
      this.clips.set(key, clip);
    }
    return clip;
  }

  private enqueue(clip: Clip, urgent: boolean): void {
    if (clip.pending) return;
    clip.pending = true;
    if (urgent) this.queue.unshift(clip);
    else this.queue.push(clip);
    this.pump();
  }

  private pump(): void {
    if (this.busy) return;
    const clip = this.queue.shift();
    if (!clip) return;
    this.busy = true;
    this.bake(clip)
      .catch(() => {
        clip.failed = true;
      })
      .finally(() => {
        clip.pending = false;
        this.busy = false;
        // A breath between bakes, so a launch's backlog never crowds a frame.
        window.setTimeout(() => this.pump(), 0);
      });
  }

  private async bake(clip: Clip): Promise<void> {
    const rate = this.live.ctx.sampleRate;
    const ctx = new OfflineCtx!(2, Math.ceil(SFX_WINDOW * rate), rate);
    // Channel 0 is the dry sound, channel 1 its reverb send: the clip keeps them apart
    // so the live reverb (one for everything) can take the send when it plays.
    const m = new Mixer(ctx, this.live, false);
    const merger = ctx.createChannelMerger(2);
    merger.connect(ctx.destination);
    m.sfx.disconnect();
    m.sfx.connect(merger, 0, 0);
    m.reverb.disconnect();
    m.reverb.connect(merger, 0, 1);
    const sfx = new Sfx(m) as unknown as Record<string, (...a: unknown[]) => void>;
    sfx[clip.method](0, ...clip.args);
    const out = await ctx.startRendering();

    const dry = out.getChannelData(0);
    const wet = out.getChannelData(1);
    const dryEnd = lastSound(dry);
    const wetEnd = lastSound(wet);
    const n = Math.max(1, Math.min(out.length, Math.max(dryEnd, wetEnd) + Math.ceil(rate * 0.01)));
    const take = this.live.ctx.createBuffer(wetEnd >= 0 ? 2 : 1, n, rate);
    take.copyToChannel(dry.subarray(0, n), 0);
    if (wetEnd >= 0) take.copyToChannel(wet.subarray(0, n), 1);
    clip.takes.push(take);
    this.frames += n * take.numberOfChannels;
    if (clip.takes.length === 1) this.remember(clip);
    this.trim(clip);
  }

  /** Over budget: drop the clips heard longest ago. */
  private trim(keep: Clip): void {
    while (this.frames > BUDGET) {
      let old: Clip | null = null;
      for (const c of this.clips.values()) if (c !== keep && c.takes.length && (!old || c.used < old.used)) old = c;
      if (!old) return;
      for (const b of old.takes) this.frames -= b.length * b.numberOfChannels;
      old.takes = [];
    }
  }

  private remember(clip: Clip): void {
    this.heard = this.heard.filter((h) => h.method !== clip.method || JSON.stringify(h.args) !== JSON.stringify(clip.args));
    this.heard.unshift({ method: clip.method, args: clip.args });
    this.heard.length = Math.min(this.heard.length, HEARD_MAX);
    if (this.saveTimer) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = 0;
      try {
        localStorage.setItem(HEARD_KEY, JSON.stringify(this.heard));
      } catch {
        // Storage full or off: next launch just bakes as it goes.
      }
    }, 5000);
  }

  /** A clip playing: one buffer source, its side, and its send into the shared reverb. */
  private start(take: AudioBuffer, t: number, pan: number): void {
    const ctx = this.live.ctx;
    const src = ctx.createBufferSource();
    src.buffer = take;
    const side = panner(ctx, pan * 0.7, this.live.sfx);
    if (take.numberOfChannels === 1) src.connect(side);
    else {
      const split = ctx.createChannelSplitter(2);
      src.connect(split);
      split.connect(side, 0);
      split.connect(this.live.reverb, 1);
    }
    src.start(t);
  }
}

/** The last sample louder than silence, or -1 if there is none. */
function lastSound(d: Float32Array): number {
  for (let i = d.length - 1; i >= 0; i--) if (d[i] > SILENT || d[i] < -SILENT) return i;
  return -1;
}

/** Seconds of a stream rendered ahead of the moment it plays. */
const LEAD = 3;

/**
 * A continuous part of the soundscape (the music, the ambience's creatures)
 * rendered a few seconds at a time, ahead of when it plays, and played back as
 * one buffer per chunk. `stems` are where each stereo or mono part goes live, so
 * its level can still move at once (the fire's crackle by the fire, say).
 * `render` schedules a chunk's notes on a bake mixer: times are seconds from the
 * chunk's start, `origin` is that start on the live clock.
 */
export class Stream {
  private at = -Infinity;
  private busy = false;
  private readonly channels: number;

  constructor(
    private live: Mixer,
    private opts: { chunk: number; tail: number; rate: number; stems: { dest: AudioNode; stereo: boolean }[] },
    private render: (m: Mixer, stems: AudioNode[], origin: number, len: number) => void,
  ) {
    this.channels = opts.stems.reduce((n, s) => n + (s.stereo ? 2 : 1), 0);
  }

  get enabled(): boolean {
    return !!OfflineCtx;
  }

  /** Called on the audio clock's tick: render the next chunk once it is close. */
  tick(now: number): void {
    if (!OfflineCtx || this.busy) return;
    // Silent for a while (another track, a hidden tab): pick up from now.
    if (this.at < now - 0.1) this.at = now + 0.15;
    if (this.at - now > LEAD) return;
    const origin = this.at;
    const len = this.opts.chunk;
    this.at += len;
    this.busy = true;
    this.bake(origin, len)
      .then((buf) => this.play(buf, origin))
      .catch(() => {})
      .finally(() => (this.busy = false));
  }

  private async bake(origin: number, len: number): Promise<AudioBuffer> {
    const { rate, tail, stems } = this.opts;
    const ctx = new OfflineCtx!(this.channels, Math.ceil((len + tail) * rate), rate);
    ctx.destination.channelInterpretation = 'discrete';
    const merger = ctx.createChannelMerger(this.channels);
    merger.connect(ctx.destination);
    let ch = 0;
    const nodes = stems.map((s) => {
      const g = ctx.createGain();
      g.channelCountMode = 'explicit';
      g.channelCount = s.stereo ? 2 : 1;
      if (s.stereo) {
        const split = ctx.createChannelSplitter(2);
        g.connect(split);
        split.connect(merger, 0, ch++);
        split.connect(merger, 1, ch++);
      } else g.connect(merger, 0, ch++);
      return g;
    });
    const m = new Mixer(ctx, this.live);
    // Whatever reaches the bake mixer's master (the reverb's return included) is the first stem.
    m.master.disconnect();
    m.master.connect(nodes[0]);
    this.render(m, nodes, origin, len);
    return ctx.startRendering();
  }

  private play(buf: AudioBuffer, origin: number): void {
    const ctx = this.live.ctx;
    const late = ctx.currentTime - origin;
    // Rendered too late to matter (the tab slept): skip it, the next chunk carries on.
    if (late > this.opts.chunk * 0.5) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const split = ctx.createChannelSplitter(this.channels);
    src.connect(split);
    let ch = 0;
    for (const s of this.opts.stems) {
      if (s.stereo) {
        const join = ctx.createChannelMerger(2);
        split.connect(join, ch++, 0);
        split.connect(join, ch++, 1);
        join.connect(s.dest);
      } else split.connect(s.dest, ch++);
    }
    src.start(Math.max(origin, ctx.currentTime), Math.max(0, late));
  }
}
