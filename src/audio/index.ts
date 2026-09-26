import { Ambience } from './ambience';
import { Mixer } from './mixer';
import { Music } from './music';
import { Sfx, type BeamHum } from './sfx';

const MUTE_KEY = 'pixel-game:muted';
const LOOKAHEAD = 0.4; // seconds of music/ambience scheduled ahead of the clock
const TICK_MS = 100;
const SAME_SOUND_GAP = 0.04; // seconds before the same one-shot may play again
const BUSY_WINDOW = 0.25; // seconds
const BUSY_LIMIT = 12; // new one-shots allowed per window

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
  private lastPlayed = new Map<string, number>();
  private recent: number[] = [];
  private daylight = 0;
  private outdoors = true;
  private fire = 0;
  private _muted = readMuted();
  private volume = { music: 1, sfx: 1 };

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

  /** Player volume per bus, 0..1 (sound effects include the ambience). */
  setVolumes(music: number, sfx: number): void {
    this.volume = { music, sfx };
    if (this.ctx && this.mixer) this.applyVolumes(this.mixer, this.ctx.currentTime);
  }

  private applyVolumes(m: Mixer, t: number): void {
    // Squared so the slider feels even to the ear.
    const set = (g: GainNode, base: number, v: number) => g.gain.setTargetAtTime(base * v * v, t, 0.05);
    set(m.music, MUSIC_LEVEL, this.volume.music);
    set(m.ambience, AMBIENCE_LEVEL, this.volume.sfx);
    set(m.sfx, SFX_LEVEL, this.volume.sfx);
  }

  /** 0 = night, 1 = day; crossfades the ambience. */
  setDaylight(d: number): void {
    this.daylight = d;
    if (this.ctx) this.ambience?.setDaylight(d, this.ctx.currentTime);
  }

  /** Wind, birds and crickets: on in the world's arenas, off out in space. */
  setOutdoors(on: boolean): void {
    this.outdoors = on;
    if (this.ctx) this.ambience?.setOutdoors(on, this.ctx.currentTime);
  }

  /** 0..1, how close the player is to a fire. */
  setFire(level: number): void {
    this.fire = level;
    if (this.ctx) this.ambience?.setFire(level, this.ctx.currentTime);
  }

  charge(): void {
    const t = this.slot('charge');
    if (t !== null) this.sfx!.charge(t);
  }

  cast(pan = 0): void {
    const t = this.slot('cast');
    if (t !== null) this.sfx!.cast(t, pan);
  }

  impact(pan = 0, struck = false): void {
    const t = this.slot('impact');
    if (t !== null) this.sfx!.impact(t, pan, struck);
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
    const t = this.slot('beamFire');
    if (t !== null) this.sfx!.beamFire(t, pan, power);
  }

  beamFizzle(): void {
    this.beamChargeEnd();
    const t = this.slot('beamFizzle');
    if (t !== null) this.sfx!.beamFizzle(t);
  }

  swing(step: number, pan = 0): void {
    const t = this.slot('swing');
    if (t !== null) this.sfx!.swing(t, pan, step);
  }

  clash(pan = 0, heavy = false): void {
    const t = this.slot('clash');
    if (t !== null) this.sfx!.clash(t, pan, heavy);
  }

  rise(): void {
    const t = this.slot('rise');
    if (t !== null) this.sfx!.rise(t);
  }

  whirl(pan = 0): void {
    const t = this.slot('whirl');
    if (t !== null) this.sfx!.whirl(t, pan);
  }

  slam(pan = 0): void {
    const t = this.slot('slam');
    if (t !== null) this.sfx!.slam(t, pan);
  }

  hallow(): void {
    const t = this.slot('hallow');
    if (t !== null) this.sfx!.hallow(t);
  }

  smite(pan = 0, struck = false): void {
    const t = this.slot('smite');
    if (t !== null) this.sfx!.smite(t, pan, struck);
  }

  consecrate(pan = 0): void {
    const t = this.slot('consecrate');
    if (t !== null) this.sfx!.consecrate(t, pan);
  }

  drink(swift = false): void {
    const t = this.slot('drink');
    if (t !== null) this.sfx!.drink(t, swift);
  }

  gear(rare = false): void {
    const t = this.slot('gear');
    if (t !== null) this.sfx!.gear(t, rare);
  }

  pickup(pan = 0): void {
    const t = this.slot('pickup');
    if (t !== null) this.sfx!.pickup(t, pan);
  }

  heal(pan = 0): void {
    const t = this.slot('heal');
    if (t !== null) this.sfx!.heal(t, pan);
  }

  notice(pan = 0): void {
    const t = this.slot('notice');
    if (t !== null) this.sfx!.notice(t, pan);
  }

  gulp(pan = 0): void {
    const t = this.slot('gulp');
    if (t !== null) this.sfx!.gulp(t, pan);
  }

  spit(pan = 0): void {
    const t = this.slot('spit');
    if (t !== null) this.sfx!.spit(t, pan);
  }

  hop(pan = 0): void {
    const t = this.slot('hop');
    if (t !== null) this.sfx!.hop(t, pan);
  }

  splash(pan = 0): void {
    const t = this.slot('splash');
    if (t !== null) this.sfx!.splash(t, pan);
  }

  chitter(pan = 0): void {
    const t = this.slot('chitter');
    if (t !== null) this.sfx!.chitter(t, pan);
  }

  buzz(pan = 0): void {
    const t = this.slot('buzz');
    if (t !== null) this.sfx!.buzz(t, pan);
  }

  thud(pan = 0, hard = false): void {
    const t = this.slot('thud');
    if (t !== null) this.sfx!.thud(t, pan, hard);
  }

  swell(pan = 0): void {
    const t = this.slot('swell');
    if (t !== null) this.sfx!.swell(t, pan);
  }

  puff(pan = 0): void {
    const t = this.slot('puff');
    if (t !== null) this.sfx!.puff(t, pan);
  }

  monsterDie(pan = 0, mass = 1): void {
    const t = this.slot('monsterDie');
    if (t !== null) this.sfx!.monsterDie(t, pan, mass);
  }

  hurt(): void {
    const t = this.slot('hurt');
    if (t !== null) this.sfx!.hurt(t);
  }

  fall(): void {
    const t = this.slot('fall');
    if (t !== null) this.sfx!.fall(t);
  }

  revive(): void {
    const t = this.slot('revive');
    if (t !== null) this.sfx!.revive(t);
  }

  saberSwing(step: number, pan = 0): void {
    const t = this.slot('saberSwing');
    if (t !== null) this.sfx!.saberSwing(t, pan, step);
  }

  saberHit(pan = 0, heavy = false): void {
    const t = this.slot('saberHit');
    if (t !== null) this.sfx!.saberHit(t, pan, heavy);
  }

  ignite(): void {
    const t = this.slot('ignite');
    if (t !== null) this.sfx!.ignite(t);
  }

  starcall(pan = 0): void {
    const t = this.slot('starcall');
    if (t !== null) this.sfx!.starcall(t, pan);
  }

  starImpact(pan = 0): void {
    const t = this.slot('starImpact');
    if (t !== null) this.sfx!.starImpact(t, pan);
  }

  gravityWell(seconds: number): void {
    const t = this.slot('gravityWell');
    if (t !== null) this.sfx!.gravityWell(t, seconds);
  }

  nova(): void {
    const t = this.slot('nova');
    if (t !== null) this.sfx!.nova(t);
  }

  forceGather(): void {
    const t = this.slot('forceGather');
    if (t !== null) this.sfx!.forceGather(t);
  }

  forcePush(pan = 0, dark = false): void {
    const t = this.slot('forcePush');
    if (t !== null) this.sfx!.forcePush(t, pan, dark);
  }

  punch(step: number, pan = 0): void {
    const t = this.slot('punch');
    if (t !== null) this.sfx!.punch(t, pan, step);
  }

  punchHit(pan = 0, heavy = false): void {
    const t = this.slot('punchHit');
    if (t !== null) this.sfx!.punchHit(t, pan, heavy);
  }

  flurry(pan = 0): void {
    const t = this.slot('flurry');
    if (t !== null) this.sfx!.flurry(t, pan);
  }

  kiai(): void {
    const t = this.slot('kiai');
    if (t !== null) this.sfx!.kiai(t);
  }

  toss(pan = 0, big = false): void {
    const t = this.slot('toss');
    if (t !== null) this.sfx!.toss(t, pan, big);
  }

  shatter(pan = 0, big = false): void {
    const t = this.slot('shatter');
    if (t !== null) this.sfx!.shatter(t, pan, big);
  }

  brew(): void {
    const t = this.slot('brew');
    if (t !== null) this.sfx!.brew(t);
  }

  bog(pan = 0): void {
    const t = this.slot('bog');
    if (t !== null) this.sfx!.bog(t, pan);
  }

  sizzle(pan = 0): void {
    const t = this.slot('sizzle');
    if (t !== null) this.sfx!.sizzle(t, pan);
  }

  bowDraw(big = false): void {
    const t = this.slot('bowDraw');
    if (t !== null) this.sfx!.bowDraw(t, big);
  }

  bowShot(pan = 0, storm = false): void {
    const t = this.slot('bowShot');
    if (t !== null) this.sfx!.bowShot(t, pan, storm);
  }

  arrowHit(pan = 0, storm = false): void {
    const t = this.slot('arrowHit');
    if (t !== null) this.sfx!.arrowHit(t, pan, storm);
  }

  arrowStick(pan = 0, level = 0.4): void {
    const t = this.slot('arrowStick');
    if (t !== null) this.sfx!.arrowStick(t, pan, level);
  }

  volley(pan = 0, storm = false): void {
    const t = this.slot('volley');
    if (t !== null) this.sfx!.volley(t, pan, storm);
  }

  arrowRain(pan = 0, storm = false): void {
    const t = this.slot('arrowRain');
    if (t !== null) this.sfx!.arrowRain(t, pan, storm);
  }

  knife(pan = 0, step = 1, finisher = false): void {
    const t = this.slot('knife');
    if (t !== null) this.sfx!.knife(t, pan, step, finisher);
  }

  knifeHit(pan = 0, heavy = false): void {
    const t = this.slot('knifeHit');
    if (t !== null) this.sfx!.knifeHit(t, pan, heavy);
  }

  vanish(pan = 0, dance = false): void {
    const t = this.slot('vanish');
    if (t !== null) this.sfx!.vanish(t, pan, dance);
  }

  blink(pan = 0): void {
    const t = this.slot('blink');
    if (t !== null) this.sfx!.blink(t, pan);
  }

  soulCast(pan = 0, blood = false): void {
    const t = this.slot('soulCast');
    if (t !== null) this.sfx!.soulCast(t, pan, blood);
  }

  soulHit(pan = 0, blood = false): void {
    const t = this.slot('soulHit');
    if (t !== null) this.sfx!.soulHit(t, pan, blood);
  }

  raiseDead(pan = 0): void {
    const t = this.slot('raiseDead');
    if (t !== null) this.sfx!.raiseDead(t, pan);
  }

  boneHit(pan = 0): void {
    const t = this.slot('boneHit');
    if (t !== null) this.sfx!.boneHit(t, pan);
  }

  boneCrumble(pan = 0): void {
    const t = this.slot('boneCrumble');
    if (t !== null) this.sfx!.boneCrumble(t, pan);
  }

  bloodNova(pan = 0): void {
    const t = this.slot('bloodNova');
    if (t !== null) this.sfx!.bloodNova(t, pan);
  }

  lutePluck(pan = 0): void {
    const t = this.slot('lutePluck');
    if (t !== null) this.sfx!.lutePluck(t, pan);
  }

  noteHit(pan = 0, leap = 0): void {
    const t = this.slot('noteHit');
    if (t !== null) this.sfx!.noteHit(t, pan, leap);
  }

  song(pan = 0): void {
    const t = this.slot('song');
    if (t !== null) this.sfx!.song(t, pan);
  }

  encore(pan = 0): void {
    const t = this.slot('encore');
    if (t !== null) this.sfx!.encore(t, pan);
  }

  drumBeat(pan = 0, heavy = false): void {
    const t = this.slot('drumBeat');
    if (t !== null) this.sfx!.drumBeat(t, pan, heavy);
  }

  drumRoll(pan = 0): void {
    const t = this.slot('drumRoll');
    if (t !== null) this.sfx!.drumRoll(t, pan);
  }

  chronoCast(pan = 0, rift = false): void {
    const t = this.slot('chronoCast');
    if (t !== null) this.sfx!.chronoCast(t, pan, rift);
  }

  chronoHit(pan = 0, rift = false): void {
    const t = this.slot('chronoHit');
    if (t !== null) this.sfx!.chronoHit(t, pan, rift);
  }

  stasis(pan = 0): void {
    const t = this.slot('stasis');
    if (t !== null) this.sfx!.stasis(t, pan);
  }

  hourStrike(pan = 0): void {
    const t = this.slot('hourStrike');
    if (t !== null) this.sfx!.hourStrike(t, pan);
  }

  rewind(pan = 0): void {
    const t = this.slot('rewind');
    if (t !== null) this.sfx!.rewind(t, pan);
  }

  timeStop(pan = 0): void {
    const t = this.slot('timeStop');
    if (t !== null) this.sfx!.timeStop(t, pan);
  }

  echoes(pan = 0): void {
    const t = this.slot('echoes');
    if (t !== null) this.sfx!.echoes(t, pan);
  }

  clack(pan = 0, heavy = false): void {
    const t = this.slot('clack');
    if (t !== null) this.sfx!.clack(t, pan, heavy);
  }

  twang(pan = 0, heavy = false): void {
    const t = this.slot('twang');
    if (t !== null) this.sfx!.twang(t, pan, heavy);
  }

  whirr(pan = 0): void {
    const t = this.slot('whirr');
    if (t !== null) this.sfx!.whirr(t, pan);
  }

  strings(pan = 0): void {
    const t = this.slot('strings');
    if (t !== null) this.sfx!.strings(t, pan);
  }

  step(): void {
    const t = this.slot('step');
    if (t !== null) this.sfx!.step(t);
  }

  private live(): boolean {
    return this.running && !this._muted;
  }

  /**
   * When a one-shot may start, or null to drop it. Phones glitch when the audio
   * thread is handed dozens of overlapping voices at once (a swarm all
   * chittering, a volley of arrows landing), so the same sound can't restart
   * within a few milliseconds and only so many new sounds start per moment.
   */
  /** A Special gathering power for `seconds`. */
  ultCharge(seconds: number): void {
    const t = this.slot('ultCharge');
    if (t !== null) this.sfx!.ultCharge(t, seconds);
  }

  ultRelease(pan = 0): void {
    const t = this.slot('ultRelease');
    if (t !== null) this.sfx!.ultRelease(t, pan);
  }

  energy(pan = 0): void {
    const t = this.slot('energy');
    if (t !== null) this.sfx!.energy(t, pan);
  }

  ultReady(): void {
    const t = this.slot('ultReady');
    if (t !== null) this.sfx!.ultReady(t);
  }

  private slot(name: string): number | null {
    if (!this.live()) return null;
    const now = this.ctx!.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < SAME_SOUND_GAP) return null;
    while (this.recent.length && now - this.recent[0] > BUSY_WINDOW) this.recent.shift();
    if (this.recent.length >= BUSY_LIMIT) return null;
    this.recent.push(now);
    this.lastPlayed.set(name, now);
    return now;
  }

  private unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      // iOS: play through the ring/silent switch like a game should.
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
      // Phones get a roomier output buffer (~45 ms): the smallest one underruns,
      // which is heard as stutter, whenever the audio thread has a busy moment.
      const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      this.ctx = new AC({ latencyHint: touch ? 0.045 : 'interactive' });
      this.ctx.addEventListener('statechange', () => this.emit());
      this.build(this.ctx);
    }
    if (!this._muted && !document.hidden && this.ctx.state !== 'running') void this.ctx.resume();
    this.emit();
  }

  private build(ctx: AudioContext): void {
    const m = (this.mixer = new Mixer(ctx));
    if (this._muted) m.master.gain.value = 0;
    this.applyVolumes(m, 0);
    this.music = new Music(m);
    this.ambience = new Ambience(m);
    this.sfx = new Sfx(m);
    this.ambience.setDaylight(this.daylight, 0);
    this.ambience.setOutdoors(this.outdoors, 0);
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

/** The mixer's own bus levels, which the player's volumes scale. */
const MUSIC_LEVEL = 0.3;
const AMBIENCE_LEVEL = 0.55;
const SFX_LEVEL = 0.75;

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const sound = new GameSound();
