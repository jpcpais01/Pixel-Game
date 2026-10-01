import { Ambience, type Wild } from './ambience';
import { Mixer, gain } from './mixer';
import { Music } from './music';
import { ShopMusic, type ShopMood } from './shopMusic';
import { Sfx, type BeamHum, type FrostSound, type WindBed } from './sfx';
import { note } from '../diagnostics';

const MUTE_KEY = 'pixel-game:muted';
const LOOKAHEAD = 0.4; // seconds of music/ambience scheduled ahead of the clock
const TICK_MS = 100;
/** How long one track takes to fade into another, in seconds. */
const TRACK_FADE = 2.4;
const SAME_SOUND_GAP = 0.04; // seconds before the same one-shot may play again
const BUSY_WINDOW = 0.25; // seconds
const PHONE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** New one-shots allowed per window: fewer on phones, whose audio thread chokes sooner. */
const BUSY_LIMIT = PHONE ? 8 : 12;
/**
 * And per second. Most effects ring for half a second or more, so a fight that
 * fills every short window keeps piling voices up; this caps the steady load.
 */
const SUSTAIN_WINDOW = 1; // seconds
const SUSTAIN_LIMIT = PHONE ? 24 : 40;
/** Effects in the last second before the crowd trim starts easing them down. */
const CROWD_FREE = 4;

type Listener = () => void;
/** The music playing: the game's own, or the shop's. */
export type Track = 'main' | 'shop';

/**
 * The game's whole soundscape, generated live with Web Audio. Browsers only
 * allow audio after a user gesture, so nothing exists until the first tap or
 * key press; every call before that is a harmless no-op.
 */
class GameSound {
  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private music: Music | null = null;
  private shopMusic: ShopMusic | null = null;
  private shopMood: ShopMood = 'sanctum';
  /** Each track's own level on the music bus, crossfaded by setTrack. */
  private tracks: Record<Track, GainNode> | null = null;
  private track: Track = 'main';
  /** Until when the track faded out is still heard (and so still played). */
  private fadeUntil = 0;
  private ambience: Ambience | null = null;
  private sfx: Sfx | null = null;
  private hum: BeamHum | null = null;
  private wind: WindBed | null = null;
  private listeners = new Set<Listener>();
  private lastPlayed = new Map<string, number>();
  private recent: number[] = [];
  private crowdLevel = 1;
  private daylight = 0;
  private outdoors = true;
  private fire = 0;
  private wild: Wild | null = null;
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

  /** The shop's banner: the Sanctum's waltz, or the Nest's warmer one. */
  setShopMood(mood: ShopMood): void {
    this.shopMood = mood;
    this.shopMusic?.setMood(mood);
  }

  /** Fade from the music playing into another track. */
  setTrack(track: Track): void {
    if (track === this.track) return;
    this.track = track;
    const ctx = this.ctx;
    if (!ctx || !this.tracks) return;
    const now = ctx.currentTime;
    for (const k of ['main', 'shop'] as const) {
      const g = this.tracks[k].gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(k === track ? 1 : 0, now + TRACK_FADE);
    }
    this.fadeUntil = now + TRACK_FADE + 0.2;
  }

  setVolumes(music: number, sfx: number): void {
    this.volume = { music, sfx };
    if (this.ctx && this.mixer) safely('volumes', () => this.applyVolumes(this.mixer!, this.ctx!.currentTime));
  }

  private applyVolumes(m: Mixer, t: number): void {
    // Squared so the slider feels even to the ear.
    const set = (g: GainNode, base: number, v: number) => g.gain.setTargetAtTime(base * v * v, t, 0.05);
    set(m.music, MUSIC_LEVEL, this.volume.music);
    // The music's reverb has no base level of its own: it just follows the slider.
    set(m.musicVerb, 1, this.volume.music);
    set(m.ambience, AMBIENCE_LEVEL, this.volume.sfx);
    set(m.sfx, SFX_LEVEL, this.volume.sfx);
  }

  /** 0 = night, 1 = day; crossfades the ambience. */
  setDaylight(d: number): void {
    this.daylight = d;
    if (this.ctx) safely('daylight', () => this.ambience?.setDaylight(d, this.ctx!.currentTime));
  }

  /** Wind, birds and crickets: on in the world's arenas, off out in space. */
  setOutdoors(on: boolean): void {
    this.outdoors = on;
    if (this.ctx) safely('outdoors', () => this.ambience?.setOutdoors(on, this.ctx!.currentTime));
  }

  /** 0..1, how close the player is to a fire. */
  setFire(level: number): void {
    this.fire = level;
    if (this.ctx) safely('fire', () => this.ambience?.setFire(level, this.ctx!.currentTime));
  }

  /** The Everwood's own sounds round the listener (water heard before it's seen, frogs, a woodpecker), or null to stop them. */
  setWild(w: Wild | null): void {
    this.wild = w;
    if (this.ctx) safely('wild', () => this.ambience?.setWild(w, this.ctx!.currentTime));
  }

  /** A gust coming through the forest, 0..1 strong, from the side `pan` says. */
  forestGust(strength: number, pan = 0): void {
    const t = this.slot('forestGust');
    if (t !== null) this.sfx!.forestGust(t, strength, pan);
  }

  /** Wings: `n` birds starting up, or an owl (`soft`) leaving its branch. */
  wings(pan = 0, n = 4, soft = false): void {
    const t = this.slot('wings');
    if (t !== null) this.sfx!.wings(t, pan, n, soft);
  }

  /** A deer snorting its alarm and bounding off. */
  deerBolt(pan = 0): void {
    const t = this.slot('deerBolt');
    if (t !== null) this.sfx!.deerBolt(t, pan);
  }

  /** An owl hooting from its branch, `level` 0..1 with how near it sits. */
  owlHoot(pan = 0, level = 1): void {
    const t = this.slot('owlHoot');
    if (t !== null) this.sfx!.owlHoot(t, pan, level);
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
    safely('beamHum', () => this.hum?.set(level, over, t));
  }

  /** The charge ended: fired, fizzled or cancelled. */
  beamChargeEnd(): void {
    const hum = this.hum;
    if (hum && this.ctx) safely('beamHum', () => hum.stop(this.ctx!.currentTime));
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

  /** The Forge's anvil ringing under Brenna's hammer, `level` 0..1 with how near the hero is. */
  anvil(pan = 0, level = 1): void {
    const t = this.slot('anvil');
    if (t !== null) this.sfx!.anvil(t, pan, level);
  }

  /** A piece forged at Brenna's counter: three blows and the ring of it done. */
  forged(): void {
    const t = this.slot('forged');
    if (t !== null) this.sfx!.forged(t);
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

  lootFall(pan = 0): void {
    const t = this.slot('lootFall');
    if (t !== null) this.sfx!.lootFall(t, pan);
  }

  lootLand(grade: number, pan = 0): void {
    const t = this.slot('lootLand');
    if (t !== null) this.sfx!.lootLand(t, pan, grade);
  }

  gemLand(n: number, pan = 0): void {
    const t = this.slot('gemLand');
    if (t !== null) this.sfx!.gemLand(t, pan, n);
  }

  gemPickup(n: number): void {
    const t = this.slot('gemPickup');
    if (t !== null) this.sfx!.gemPickup(t, n);
  }

  gemTink(pan = 0): void {
    const t = this.slot('gemTink');
    if (t !== null) this.sfx!.gemTink(t, pan);
  }

  gemCollect(step: number): void {
    const t = this.slot('gemCollect');
    if (t !== null) this.sfx!.gemCollect(t, step);
  }

  candyPickup(n: number): void {
    const t = this.slot('candyPickup');
    if (t !== null) this.sfx!.candyPickup(t, n);
  }

  gemSpend(): void {
    const t = this.slot('gemSpend');
    if (t !== null) this.sfx!.gemSpend(t);
  }

  glideRing(pan = 0, step = 0, big = false): void {
    const t = this.slot('glideRing');
    if (t !== null) this.sfx!.glideRing(t, pan, step, big);
  }

  glideGust(): void {
    const t = this.slot('glideGust');
    if (t !== null) this.sfx!.glideGust(t);
  }

  glideWhoosh(pan = 0, level = 1): void {
    const t = this.slot('glideWhoosh');
    if (t !== null) this.sfx!.glideWhoosh(t, pan, level);
  }

  glideCount(go = false): void {
    const t = this.slot('glideCount');
    if (t !== null) this.sfx!.glideCount(t, go);
  }

  glideSplash(): void {
    const t = this.slot('glideSplash');
    if (t !== null) this.sfx!.glideSplash(t);
  }

  glideLand(): void {
    const t = this.slot('glideLand');
    if (t !== null) this.sfx!.glideLand(t);
  }

  /** The wind round the glider: `speed` 0..1 of top speed. */
  glideWind(speed: number, dive: boolean): void {
    if (!this.live()) return;
    const t = this.ctx!.currentTime;
    if (!this.wind) this.wind = this.sfx!.windBed(t);
    safely('glideWind', () => this.wind?.set(speed, dive, t));
  }

  glideWindEnd(): void {
    const wind = this.wind;
    if (wind && this.ctx) safely('glideWind', () => wind.stop(this.ctx!.currentTime));
    this.wind = null;
  }

  gemTick(): void {
    const t = this.slot('gemTick');
    if (t !== null) this.sfx!.gemTick(t);
  }

  /** `tier`: the best rarity inside, 0 rare .. 2 legendary; `seconds` of charging. */
  wishCharge(seconds: number, tier: number): void {
    const t = this.slot('wishCharge');
    if (t !== null) this.sfx!.wishCharge(t, seconds, tier);
  }

  wishBurst(tier: number): void {
    const t = this.slot('wishBurst');
    if (t !== null) this.sfx!.wishBurst(t, tier);
  }

  netSwish(pan = 0): void {
    const t = this.slot('netSwish');
    if (t !== null) this.sfx!.netSwish(t, pan);
  }

  critterCatch(tier: number): void {
    const t = this.slot('critterCatch');
    if (t !== null) this.sfx!.critterCatch(t, tier);
  }

  fishCast(): void {
    const t = this.slot('fishCast');
    if (t !== null) this.sfx!.fishCast(t);
  }

  fishPlop(pan = 0): void {
    const t = this.slot('fishPlop');
    if (t !== null) this.sfx!.fishPlop(t, pan);
  }

  fishNibble(pan = 0): void {
    const t = this.slot('fishNibble');
    if (t !== null) this.sfx!.fishNibble(t, pan);
  }

  fishBite(pan = 0): void {
    const t = this.slot('fishBite');
    if (t !== null) this.sfx!.fishBite(t, pan);
  }

  reelTick(): void {
    const t = this.slot('reelTick');
    if (t !== null) this.sfx!.reelTick(t);
  }

  fishLanded(tier: number): void {
    const t = this.slot('fishLanded');
    if (t !== null) this.sfx!.fishLanded(t, tier);
  }

  fishLost(): void {
    const t = this.slot('fishLost');
    if (t !== null) this.sfx!.fishLost(t);
  }

  critterRelease(pan = 0): void {
    const t = this.slot('critterRelease');
    if (t !== null) this.sfx!.critterRelease(t, pan);
  }

  stag(kind: 'appear' | 'reveal' | 'flee', pan = 0): void {
    const t = this.slot(`stag_${kind}`);
    if (t !== null) this.sfx!.stag(t, pan, kind);
  }

  cardFlip(tier: number): void {
    const t = this.slot('cardFlip');
    if (t !== null) this.sfx!.cardFlip(t, tier);
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

  echoWake(pan = 0): void {
    const t = this.slot('echoWake');
    if (t !== null) this.sfx!.echoWake(t, pan);
  }

  echoBless(): void {
    const t = this.slot('echoBless');
    if (t !== null) this.sfx!.echoBless(t);
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

  omen(mood: 'dark' | 'bright' | 'strange'): void {
    const t = this.slot('omen');
    if (t !== null) this.sfx!.omen(t, mood);
  }

  portal(pan = 0): void {
    const t = this.slot('portal');
    if (t !== null) this.sfx!.portal(t, pan);
  }

  cackle(pan = 0): void {
    const t = this.slot('cackle');
    if (t !== null) this.sfx!.cackle(t, pan);
  }

  starImpact(pan = 0): void {
    const t = this.slot('starImpact');
    if (t !== null) this.sfx!.starImpact(t, pan);
  }

  gravityWell(seconds: number): void {
    const t = this.slot('gravityWell');
    if (t !== null) this.sfx!.gravityWell(t, seconds);
  }

  bossRoar(pan = 0, myth = false): void {
    const t = this.slot('bossRoar');
    if (t !== null) this.sfx!.bossRoar(t, pan, myth);
  }

  bossTitle(myth = false): void {
    const t = this.slot('bossTitle');
    if (t !== null) this.sfx!.bossTitle(t, myth);
  }

  finalBlow(myth = false): void {
    const t = this.slot('finalBlow');
    if (t !== null) this.sfx!.finalBlow(t, myth);
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

  forceLightning(pan = 0, seconds = 0.5): void {
    const t = this.slot('forceLightning');
    if (t !== null) this.sfx!.forceLightning(t, pan, seconds);
  }

  forceGrip(pan = 0): void {
    const t = this.slot('forceGrip');
    if (t !== null) this.sfx!.forceGrip(t, pan);
  }

  forceCrush(pan = 0): void {
    const t = this.slot('forceCrush');
    if (t !== null) this.sfx!.forceCrush(t, pan);
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

  /** The Aurora Colosseum's frost: ice cracking, freezing, a howl, a chime, a crunch of snow, a gust (see Sfx.frost). */
  frost(kind: FrostSound, pan = 0, big = false): void {
    const t = this.slot(`frost:${kind}`);
    if (t !== null) this.sfx!.frost(t, kind, pan, big);
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

  wail(pan = 0): void {
    const t = this.slot('wail');
    if (t !== null) this.sfx!.wail(t, pan);
  }

  creak(pan = 0): void {
    const t = this.slot('creak');
    if (t !== null) this.sfx!.creak(t, pan);
  }

  doorOpen(pan = 0, level = 1): void {
    const t = this.slot('doorOpen');
    if (t !== null) this.sfx!.doorOpen(t, pan, level);
  }

  doorShut(pan = 0, level = 1): void {
    const t = this.slot('doorShut');
    if (t !== null) this.sfx!.doorShut(t, pan, level);
  }

  gateOpen(pan = 0, iron = false): void {
    const t = this.slot('gateOpen');
    if (t !== null) this.sfx!.gateOpen(t, pan, iron);
  }

  gateShut(pan = 0, level = 1, iron = false): void {
    const t = this.slot('gateShut');
    if (t !== null) this.sfx!.gateShut(t, pan, level, iron);
  }

  cannon(pan = 0, scrap = false): void {
    const t = this.slot('cannon');
    if (t !== null) this.sfx!.cannon(t, pan, scrap);
  }

  missile(pan = 0, scrap = false): void {
    const t = this.slot('missile');
    if (t !== null) this.sfx!.missile(t, pan, scrap);
  }

  lockOn(n: number): void {
    const t = this.slot('lockOn');
    if (t !== null) this.sfx!.lockOn(t, n);
  }

  blast(pan = 0): void {
    const t = this.slot('blast');
    if (t !== null) this.sfx!.blast(t, pan);
  }

  vent(): void {
    const t = this.slot('vent');
    if (t !== null) this.sfx!.vent(t);
  }

  droneZap(pan = 0, hive = false): void {
    const t = this.slot('droneZap');
    if (t !== null) this.sfx!.droneZap(t, pan, hive);
  }

  wrench(pan = 0, heavy = false): void {
    const t = this.slot('wrench');
    if (t !== null) this.sfx!.wrench(t, pan, heavy);
  }

  ratchet(pan = 0): void {
    const t = this.slot('ratchet');
    if (t !== null) this.sfx!.ratchet(t, pan);
  }

  turretShot(pan = 0, mega = false): void {
    const t = this.slot('turretShot');
    if (t !== null) this.sfx!.turretShot(t, pan, mega);
  }

  tesla(pan = 0, chain = false): void {
    const t = this.slot('tesla');
    if (t !== null) this.sfx!.tesla(t, pan, chain);
  }

  feather(pan = 0): void {
    const t = this.slot('feather');
    if (t !== null) this.sfx!.feather(t, pan);
  }

  screech(pan = 0): void {
    const t = this.slot('screech');
    if (t !== null) this.sfx!.screech(t, pan);
  }

  roar(pan = 0, big = false): void {
    const t = this.slot('roar');
    if (t !== null) this.sfx!.roar(t, pan, big);
  }

  rake(pan = 0, heavy = false): void {
    const t = this.slot('rake');
    if (t !== null) this.sfx!.rake(t, pan, heavy);
  }

  fireball(pan = 0): void {
    const t = this.slot('fireball');
    if (t !== null) this.sfx!.fireball(t, pan);
  }

  flame(pan = 0): void {
    const t = this.slot('flame');
    if (t !== null) this.sfx!.flame(t, pan);
  }

  servo(pan = 0): void {
    const t = this.slot('servo');
    if (t !== null) this.sfx!.servo(t, pan);
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

  decree(pan = 0): void {
    const t = this.slot('decree');
    if (t !== null) this.sfx!.decree(t, pan);
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

  katana(pan = 0, heavy = false): void {
    const t = this.slot('katana');
    if (t !== null) this.sfx!.katana(t, pan, heavy);
  }

  katanaHit(pan = 0, heavy = false): void {
    const t = this.slot('katanaHit');
    if (t !== null) this.sfx!.katanaHit(t, pan, heavy);
  }

  gust(pan = 0): void {
    const t = this.slot('gust');
    if (t !== null) this.sfx!.gust(t, pan);
  }

  windCharge(pan = 0): void {
    const t = this.slot('windCharge');
    if (t !== null) this.sfx!.windCharge(t, pan);
  }

  windDash(pan = 0): void {
    const t = this.slot('windDash');
    if (t !== null) this.sfx!.windDash(t, pan);
  }

  sheathe(pan = 0): void {
    const t = this.slot('sheathe');
    if (t !== null) this.sfx!.sheathe(t, pan);
  }

  sever(pan = 0, n = 1): void {
    const t = this.slot('sever');
    if (t !== null) this.sfx!.sever(t, pan, n);
  }

  skyQuake(pan = 0): void {
    const t = this.slot('skyQuake');
    if (t !== null) this.sfx!.skyQuake(t, pan);
  }

  quakeSlam(pan = 0): void {
    const t = this.slot('quakeSlam');
    if (t !== null) this.sfx!.quakeSlam(t, pan);
  }

  hundredCuts(pan = 0): void {
    const t = this.slot('hundredCuts');
    if (t !== null) this.sfx!.hundredCuts(t, pan);
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

  /** A Special gathering power for `seconds`. */
  ultCharge(seconds: number): void {
    const t = this.slot('ultCharge');
    if (t !== null) this.sfx!.ultCharge(t, seconds);
  }

  ultRelease(pan = 0): void {
    const t = this.slot('ultRelease');
    if (t !== null) this.sfx!.ultRelease(t, pan);
  }

  /** Energy soaking into the hero; `step` counts the motes of one kill, so each chimes a note higher. */
  energy(pan = 0, step = 0): void {
    const t = this.slot('energy');
    if (t !== null) this.sfx!.energy(t, pan, step);
  }

  ultReady(): void {
    const t = this.slot('ultReady');
    if (t !== null) this.sfx!.ultReady(t);
  }

  /**
   * When a one-shot may start, or null to drop it. Phones glitch when the audio
   * thread is handed dozens of overlapping voices at once (a swarm all
   * chittering, a volley of arrows landing), so the same sound can't restart
   * within a few milliseconds and only so many new sounds start per moment.
   */
  private slot(name: string): number | null {
    if (!this.live()) return null;
    const now = this.ctx!.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < SAME_SOUND_GAP) return null;
    while (this.recent.length && now - this.recent[0] > SUSTAIN_WINDOW) this.recent.shift();
    if (this.recent.length >= SUSTAIN_LIMIT) return null;
    let busy = 0;
    for (let i = this.recent.length - 1; i >= 0 && now - this.recent[i] <= BUSY_WINDOW; i--) busy++;
    if (busy >= BUSY_LIMIT) return null;
    this.recent.push(now);
    this.lastPlayed.set(name, now);
    this.trimCrowd(now);
    return now;
  }

  /**
   * Overlapping effects add up: twenty hits at once are twenty times one hit, and
   * the sum slams the master into its limiter. Ease the effects bus down by the
   * square root of how many are ringing, so a big fight sounds dense, not distorted.
   */
  private trimCrowd(now: number): void {
    const m = this.mixer;
    if (!m) return;
    while (this.recent.length && now - this.recent[0] > SUSTAIN_WINDOW) this.recent.shift();
    const level = 1 / Math.sqrt(1 + Math.max(0, this.recent.length - CROWD_FREE) / 6);
    if (Math.abs(level - this.crowdLevel) < 0.02) return;
    this.crowdLevel = level;
    // Duck quickly as a fight swells, come back up slowly as it calms.
    safely('crowd', () => m.crowd.gain.setTargetAtTime(level, now, level < m.crowd.gain.value ? 0.03 : 0.4));
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
    if (!this._muted && !document.hidden && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this.emit();
  }

  private build(ctx: AudioContext): void {
    const m = (this.mixer = new Mixer(ctx));
    if (this._muted) m.master.gain.value = 0;
    this.applyVolumes(m, 0);
    this.tracks = { main: gain(ctx, this.track === 'main' ? 1 : 0, m.music), shop: gain(ctx, this.track === 'shop' ? 1 : 0, m.music) };
    this.music = new Music(m, this.tracks.main);
    this.shopMusic = new ShopMusic(m, this.tracks.shop);
    this.shopMusic.setMood(this.shopMood);
    this.ambience = new Ambience(m);
    this.sfx = guarded(new Sfx(m));
    this.ambience.setDaylight(this.daylight, 0);
    this.ambience.setOutdoors(this.outdoors, 0);
    this.ambience.setFire(this.fire, 0);
    this.ambience.setWild(this.wild, 0);
    this.music.start(ctx.currentTime);
    window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Only the track playing (and, while it fades out, the one before it) is written.
    const fading = now < this.fadeUntil;
    if (this.track === 'main' || fading) safely('music', () => this.music!.tick(now, now + LOOKAHEAD));
    if (this.track === 'shop' || fading) safely('shop music', () => this.shopMusic!.tick(now, now + LOOKAHEAD));
    safely('ambience', () => this.ambience!.tick(now, now + LOOKAHEAD));
    // Let the effects bus come back up once a fight goes quiet.
    this.trimCrowd(now);
  }

  private syncSuspend(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    // Refused (an iPhone mid-call, say): it is tried again on the next tap.
    if (document.hidden || this._muted) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
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

/**
 * Run a piece of audio work so it can never stop the game. Sounds are played
 * from inside the game's update, where an uncaught error freezes everything,
 * and Web Audio throws on some inputs (a non-finite number, a state the phone
 * put the audio in). A sound that fails is just not heard; the first failure
 * of each kind is logged and put on the crash report's action list.
 */
const failed = new Set<string>();
function safely(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (failed.has(name)) return;
    failed.add(name);
    console.warn(`Sound "${name}" failed`, err);
    note(`sound ${name} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** The sound effects, every call made safe (see safely). */
function guarded(sfx: Sfx): Sfx {
  return new Proxy(sfx, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      if (typeof v !== 'function') return v;
      const name = String(key);
      return (...args: unknown[]) => {
        let out: unknown;
        safely(name, () => (out = v.apply(target, args)));
        return out;
      };
    },
  });
}

export const sound = new GameSound();
