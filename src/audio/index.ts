import { Ambience } from './ambience';
import { Mixer } from './mixer';
import { Music } from './music';
import { Sfx, type BeamHum } from './sfx';

const MUTE_KEY = 'pixel-game:muted';
const LOOKAHEAD = 0.4; // seconds of music/ambience scheduled ahead of the clock
const TICK_MS = 100;

type Listener = () => void;

/**
 * The game's whole soundscape, generated live with Web Audio. Browsers only
 * allow audio after a user gesture, so nothing exists until the first tap or
 * key press; every call before that is a harmless no-op.
 */
class GameSound {
  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private music: Music | null = null;
  private ambience: Ambience | null = null;
  private sfx: Sfx | null = null;
  private hum: BeamHum | null = null;
  private listeners = new Set<Listener>();
  private daylight = 0;
  private fire = 0;
  private _muted = readMuted();

  get muted(): boolean {
    return this._muted;
  }

  /** True once the browser has let audio start. */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Listen for the first user gesture and pause while the app is hidden. */
  init(): void {
    const unlock = () => {
      this.unlock();
      if (this.running) for (const ev of GESTURES) window.removeEventListener(ev, unlock, true);
    };
    for (const ev of GESTURES) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => this.syncSuspend());
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  toggleMute(): void {
    this.setMuted(!this._muted);
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Private mode: the setting just won't persist.
    }
    if (this.ctx && this.mixer) {
      const t = this.ctx.currentTime;
      this.mixer.master.gain.cancelScheduledValues(t);
      this.mixer.master.gain.setTargetAtTime(muted ? 0 : 0.9, t, 0.08);
    }
    // Let the fade finish before suspending, which also saves battery.
    window.setTimeout(() => this.syncSuspend(), muted ? 400 : 0);
    this.emit();
  }

  /** 0 = night, 1 = day; crossfades the ambience. */
  setDaylight(d: number): void {
    this.daylight = d;
    if (this.ctx) this.ambience?.setDaylight(d, this.ctx.currentTime);
  }

  /** 0..1, how close the player is to a fire. */
  setFire(level: number): void {
    this.fire = level;
    if (this.ctx) this.ambience?.setFire(level, this.ctx.currentTime);
  }

  charge(): void {
    if (this.live()) this.sfx!.charge(this.ctx!.currentTime);
  }

  cast(pan = 0): void {
    if (this.live()) this.sfx!.cast(this.ctx!.currentTime, pan);
  }

  impact(pan = 0, struck = false): void {
    if (this.live()) this.sfx!.impact(this.ctx!.currentTime, pan, struck);
  }

  /** The beam's gathering hum: `level` 0..1 is the charge, `over` 0..1 the unstable hold. */
  beamCharge(level: number, over: number): void {
    if (!this.live()) return;
    const t = this.ctx!.currentTime;
    if (!this.hum) this.hum = this.sfx!.beamHum(t);
    this.hum.set(level, over, t);
  }

  /** The charge ended: fired, fizzled or cancelled. */
  beamChargeEnd(): void {
    if (this.hum && this.ctx) this.hum.stop(this.ctx.currentTime);
    this.hum = null;
  }

  beamFire(pan = 0, power = 1): void {
    this.beamChargeEnd();
    if (this.live()) this.sfx!.beamFire(this.ctx!.currentTime, pan, power);
  }

  beamFizzle(): void {
    this.beamChargeEnd();
    if (this.live()) this.sfx!.beamFizzle(this.ctx!.currentTime);
  }

  step(): void {
    if (this.live()) this.sfx!.step(this.ctx!.currentTime);
  }

  private live(): boolean {
    return this.running && !this._muted;
  }

  private unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      // iOS: play through the ring/silent switch like a game should.
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.ctx.addEventListener('statechange', () => this.emit());
      this.build(this.ctx);
    }
    if (!this._muted && !document.hidden && this.ctx.state !== 'running') void this.ctx.resume();
    this.emit();
  }

  private build(ctx: AudioContext): void {
    const m = (this.mixer = new Mixer(ctx));
    if (this._muted) m.master.gain.value = 0;
    this.music = new Music(m);
    this.ambience = new Ambience(m);
    this.sfx = new Sfx(m);
    this.ambience.setDaylight(this.daylight, 0);
    this.ambience.setFire(this.fire, 0);
    this.music.start(ctx.currentTime);
    window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.music!.tick(now, now + LOOKAHEAD);
    this.ambience!.tick(now, now + LOOKAHEAD);
  }

  private syncSuspend(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    if (document.hidden || this._muted) void ctx.suspend();
    else void ctx.resume();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const sound = new GameSound();
