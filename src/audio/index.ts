import { Ambience, type Wild } from './ambience';
import { SfxBaker, Stream } from './bake';
import { Mixer, gain } from './mixer';
import { CHORD_SECONDS, Music } from './music';
import { SHOP_CHORD_SECONDS, ShopMusic, type ShopMood } from './shopMusic';
import { LUTE_NOTES, Sfx, type BeamHum, type FrostSound, type WindBed } from './sfx';
import { note } from '../diagnostics';

const MUTE_KEY = 'pixel-game:muted';
const LOOKAHEAD = 0.4; // seconds of music/ambience scheduled ahead of the clock
const TICK_MS = 100;
/** How long one track takes to fade into another, in seconds. */
const TRACK_FADE = 2.4;
const SAME_SOUND_GAP = 0.04; // seconds before the same one-shot may play again
const BUSY_WINDOW = 0.25; // seconds
/**
 * New one-shots allowed per window. A baked effect is a single buffer source, so
 * this is about keeping a fight legible now, not about sparing the audio thread.
 */
const BUSY_LIMIT = 12;
/** And per second: most effects ring for half a second or more, and a wall of them is mush. */
const SUSTAIN_WINDOW = 1; // seconds
const SUSTAIN_LIMIT = 40;
/** Seconds of the music's fade-in when the sound first starts. */
const MUSIC_FADE_IN = 6;
/**
 * The phone's output buffer, in seconds. Bigger rides out the moments a phone
 * busy drawing the game is late to the audio thread; 70 ms is still too short
 * to hear between a tap and its sound.
 */
const PHONE_LATENCY = 0.07;
/** Baked streams: seconds rendered past each chunk's end, for its notes' tails and echoes. */
const MUSIC_TAIL = 6;
const CALLS_CHUNK = 6;
const CALLS_TAIL = 3.5;
/** Their sample rates: the music and the creatures hold nothing near the top of the range. */
const MUSIC_RATE = 32000;
const CALLS_RATE = 22050;

/** The sound effects that are one-shots: methods of Sfx taking the start time first. */
type OneShot = { [K in keyof Sfx]: Sfx[K] extends (t: number, ...a: never[]) => void ? K : never }[keyof Sfx];
type ShotArgs<K extends OneShot> = Sfx[K] extends (t: number, ...a: infer A) => unknown ? A : never;
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
  private baker: SfxBaker | null = null;
  private streams: { main: Stream; shop: Stream; calls: Stream } | null = null;
  /** The lute's place in the minstrel's tune. */
  private lute = 0;
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
    this.fx('forestGust', 'forestGust', [strength, pan], 1);
  }

  /** Wings: `n` birds starting up, or an owl (`soft`) leaving its branch. */
  wings(pan = 0, n = 4, soft = false): void {
    this.fx('wings', 'wings', [pan, n, soft], 0);
  }

  /** A deer snorting its alarm and bounding off. */
  deerBolt(pan = 0): void {
    this.fx('deerBolt', 'deerBolt', [pan], 0);
  }

  /** An owl hooting from its branch, `level` 0..1 with how near it sits. */
  owlHoot(pan = 0, level = 1): void {
    this.fx('owlHoot', 'owlHoot', [pan, level], 0);
  }

  charge(): void {
    this.fx('charge', 'charge', []);
  }

  cast(pan = 0): void {
    this.fx('cast', 'cast', [pan], 0);
  }

  impact(pan = 0, struck = false): void {
    this.fx('impact', 'impact', [pan, struck], 0);
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
    this.fx('beamFire', 'beamFire', [pan, power], 0);
  }

  beamFizzle(): void {
    this.beamChargeEnd();
    this.fx('beamFizzle', 'beamFizzle', []);
  }

  swing(step: number, pan = 0): void {
    this.fx('swing', 'swing', [pan, step], 0);
  }

  clash(pan = 0, heavy = false): void {
    this.fx('clash', 'clash', [pan, heavy], 0);
  }

  /** The Forge's anvil ringing under Brenna's hammer, `level` 0..1 with how near the hero is. */
  anvil(pan = 0, level = 1): void {
    this.fx('anvil', 'anvil', [pan, level], 0);
  }

  /** A piece forged at Brenna's counter: three blows and the ring of it done. */
  forged(): void {
    this.fx('forged', 'forged', []);
  }

  rise(): void {
    this.fx('rise', 'rise', []);
  }

  whirl(pan = 0): void {
    this.fx('whirl', 'whirl', [pan], 0);
  }

  slam(pan = 0): void {
    this.fx('slam', 'slam', [pan], 0);
  }

  hallow(): void {
    this.fx('hallow', 'hallow', []);
  }

  smite(pan = 0, struck = false): void {
    this.fx('smite', 'smite', [pan, struck], 0);
  }

  consecrate(pan = 0): void {
    this.fx('consecrate', 'consecrate', [pan], 0);
  }

  drink(swift = false): void {
    this.fx('drink', 'drink', [swift]);
  }

  gear(rare = false): void {
    this.fx('gear', 'gear', [rare]);
  }

  lootFall(pan = 0): void {
    this.fx('lootFall', 'lootFall', [pan], 0);
  }

  lootLand(grade: number, pan = 0): void {
    this.fx('lootLand', 'lootLand', [pan, grade], 0);
  }

  gemLand(n: number, pan = 0): void {
    this.fx('gemLand', 'gemLand', [pan, n], 0);
  }

  gemPickup(n: number): void {
    this.fx('gemPickup', 'gemPickup', [n]);
  }

  gemTink(pan = 0): void {
    this.fx('gemTink', 'gemTink', [pan], 0);
  }

  gemCollect(step: number): void {
    this.fx('gemCollect', 'gemCollect', [step]);
  }

  candyPickup(n: number): void {
    this.fx('candyPickup', 'candyPickup', [n]);
  }

  gemSpend(): void {
    this.fx('gemSpend', 'gemSpend', []);
  }

  glideRing(pan = 0, step = 0, big = false): void {
    this.fx('glideRing', 'glideRing', [pan, step, big], 0);
  }

  glideGust(): void {
    this.fx('glideGust', 'glideGust', []);
  }

  glideWhoosh(pan = 0, level = 1): void {
    this.fx('glideWhoosh', 'glideWhoosh', [pan, level], 0);
  }

  glideCount(go = false): void {
    this.fx('glideCount', 'glideCount', [go]);
  }

  glideSplash(): void {
    this.fx('glideSplash', 'glideSplash', []);
  }

  glideLand(): void {
    this.fx('glideLand', 'glideLand', []);
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
    this.fx('gemTick', 'gemTick', []);
  }

  /** `tier`: the best rarity inside, 0 rare .. 2 legendary; `seconds` of charging. */
  wishCharge(seconds: number, tier: number): void {
    this.fx('wishCharge', 'wishCharge', [seconds, tier]);
  }

  wishBurst(tier: number): void {
    this.fx('wishBurst', 'wishBurst', [tier]);
  }

  netSwish(pan = 0): void {
    this.fx('netSwish', 'netSwish', [pan], 0);
  }

  critterCatch(tier: number): void {
    this.fx('critterCatch', 'critterCatch', [tier]);
  }

  fishCast(): void {
    this.fx('fishCast', 'fishCast', []);
  }

  fishPlop(pan = 0): void {
    this.fx('fishPlop', 'fishPlop', [pan], 0);
  }

  fishNibble(pan = 0): void {
    this.fx('fishNibble', 'fishNibble', [pan], 0);
  }

  fishBite(pan = 0): void {
    this.fx('fishBite', 'fishBite', [pan], 0);
  }

  reelTick(): void {
    this.fx('reelTick', 'reelTick', []);
  }

  fishLanded(tier: number): void {
    this.fx('fishLanded', 'fishLanded', [tier]);
  }

  fishLost(): void {
    this.fx('fishLost', 'fishLost', []);
  }

  plant(pan = 0): void {
    this.fx('plant', 'plant', [pan], 0);
  }

  harvest(tier: number): void {
    this.fx('harvest', 'harvest', [tier]);
  }

  cooked(tier: number): void {
    this.fx('cooked', 'cooked', [tier]);
  }

  critterRelease(pan = 0): void {
    this.fx('critterRelease', 'critterRelease', [pan], 0);
  }

  stag(kind: 'appear' | 'reveal' | 'flee', pan = 0): void {
    this.fx(`stag_${kind}`, 'stag', [pan, kind], 0);
  }

  cardFlip(tier: number): void {
    this.fx('cardFlip', 'cardFlip', [tier]);
  }

  pickup(pan = 0): void {
    this.fx('pickup', 'pickup', [pan], 0);
  }

  heal(pan = 0): void {
    this.fx('heal', 'heal', [pan], 0);
  }

  notice(pan = 0): void {
    this.fx('notice', 'notice', [pan], 0);
  }

  gulp(pan = 0): void {
    this.fx('gulp', 'gulp', [pan], 0);
  }

  spit(pan = 0): void {
    this.fx('spit', 'spit', [pan], 0);
  }

  hop(pan = 0): void {
    this.fx('hop', 'hop', [pan], 0);
  }

  splash(pan = 0): void {
    this.fx('splash', 'splash', [pan], 0);
  }

  chitter(pan = 0): void {
    this.fx('chitter', 'chitter', [pan], 0);
  }

  buzz(pan = 0): void {
    this.fx('buzz', 'buzz', [pan], 0);
  }

  thud(pan = 0, hard = false): void {
    this.fx('thud', 'thud', [pan, hard], 0);
  }

  swell(pan = 0): void {
    this.fx('swell', 'swell', [pan], 0);
  }

  puff(pan = 0): void {
    this.fx('puff', 'puff', [pan], 0);
  }

  monsterDie(pan = 0, mass = 1): void {
    this.fx('monsterDie', 'monsterDie', [pan, mass], 0);
  }

  hurt(): void {
    this.fx('hurt', 'hurt', []);
  }

  fall(): void {
    this.fx('fall', 'fall', []);
  }

  echoWake(pan = 0): void {
    this.fx('echoWake', 'echoWake', [pan], 0);
  }

  echoBless(): void {
    this.fx('echoBless', 'echoBless', []);
  }

  revive(): void {
    this.fx('revive', 'revive', []);
  }

  saberSwing(step: number, pan = 0): void {
    this.fx('saberSwing', 'saberSwing', [pan, step], 0);
  }

  saberHit(pan = 0, heavy = false): void {
    this.fx('saberHit', 'saberHit', [pan, heavy], 0);
  }

  ignite(): void {
    this.fx('ignite', 'ignite', []);
  }

  starcall(pan = 0): void {
    this.fx('starcall', 'starcall', [pan], 0);
  }

  omen(mood: 'dark' | 'bright' | 'strange'): void {
    this.fx('omen', 'omen', [mood]);
  }

  portal(pan = 0): void {
    this.fx('portal', 'portal', [pan], 0);
  }

  cackle(pan = 0): void {
    this.fx('cackle', 'cackle', [pan], 0);
  }

  starImpact(pan = 0): void {
    this.fx('starImpact', 'starImpact', [pan], 0);
  }

  gravityWell(seconds: number): void {
    this.fx('gravityWell', 'gravityWell', [seconds]);
  }

  bossRoar(pan = 0, myth = false): void {
    this.fx('bossRoar', 'bossRoar', [pan, myth], 0);
  }

  bossTitle(myth = false): void {
    this.fx('bossTitle', 'bossTitle', [myth]);
  }

  finalBlow(myth = false): void {
    this.fx('finalBlow', 'finalBlow', [myth]);
  }

  nova(): void {
    this.fx('nova', 'nova', []);
  }

  forceGather(): void {
    this.fx('forceGather', 'forceGather', []);
  }

  forcePush(pan = 0, dark = false): void {
    this.fx('forcePush', 'forcePush', [pan, dark], 0);
  }

  forceLightning(pan = 0, seconds = 0.5): void {
    this.fx('forceLightning', 'forceLightning', [pan, seconds], 0);
  }

  forceGrip(pan = 0): void {
    this.fx('forceGrip', 'forceGrip', [pan], 0);
  }

  forceCrush(pan = 0): void {
    this.fx('forceCrush', 'forceCrush', [pan], 0);
  }

  /** The Force Sage's stones: torn up, shattering on a foe, or a slab bursting (see Sfx.forceStone). */
  forceStone(pan = 0, kind: 'rip' | 'hit' | 'big' = 'hit'): void {
    const t = this.slot(`forceStone:${kind}`);
    if (t !== null) this.sfx!.forceStone(t, pan, kind);
  }

  /** The Force Sage's barrier: springing up, taking a blow, or bursting (see Sfx.forceBarrier). */
  forceBarrier(pan = 0, kind: 'up' | 'hit' | 'break' = 'up'): void {
    const t = this.slot(`forceBarrier:${kind}`);
    if (t !== null) this.sfx!.forceBarrier(t, pan, kind);
  }

  punch(step: number, pan = 0): void {
    this.fx('punch', 'punch', [pan, step], 0);
  }

  punchHit(pan = 0, heavy = false): void {
    this.fx('punchHit', 'punchHit', [pan, heavy], 0);
  }

  flurry(pan = 0): void {
    this.fx('flurry', 'flurry', [pan], 0);
  }

  kiai(): void {
    this.fx('kiai', 'kiai', []);
  }

  toss(pan = 0, big = false): void {
    this.fx('toss', 'toss', [pan, big], 0);
  }

  /** The Aurora Colosseum's frost: ice cracking, freezing, a howl, a chime, a crunch of snow, a gust (see Sfx.frost). */
  frost(kind: FrostSound, pan = 0, big = false): void {
    this.fx(`frost:${kind}`, 'frost', [kind, pan, big], 1);
  }

  shatter(pan = 0, big = false): void {
    this.fx('shatter', 'shatter', [pan, big], 0);
  }

  brew(): void {
    this.fx('brew', 'brew', []);
  }

  bog(pan = 0): void {
    this.fx('bog', 'bog', [pan], 0);
  }

  sizzle(pan = 0): void {
    this.fx('sizzle', 'sizzle', [pan], 0);
  }

  bowDraw(big = false): void {
    this.fx('bowDraw', 'bowDraw', [big]);
  }

  wail(pan = 0): void {
    this.fx('wail', 'wail', [pan], 0);
  }

  creak(pan = 0): void {
    this.fx('creak', 'creak', [pan], 0);
  }

  doorOpen(pan = 0, level = 1): void {
    this.fx('doorOpen', 'doorOpen', [pan, level], 0);
  }

  doorShut(pan = 0, level = 1): void {
    this.fx('doorShut', 'doorShut', [pan, level], 0);
  }

  gateOpen(pan = 0, iron = false): void {
    this.fx('gateOpen', 'gateOpen', [pan, iron], 0);
  }

  gateShut(pan = 0, level = 1, iron = false): void {
    this.fx('gateShut', 'gateShut', [pan, level, iron], 0);
  }

  cannon(pan = 0, scrap = false): void {
    this.fx('cannon', 'cannon', [pan, scrap], 0);
  }

  missile(pan = 0, scrap = false): void {
    this.fx('missile', 'missile', [pan, scrap], 0);
  }

  lockOn(n: number): void {
    this.fx('lockOn', 'lockOn', [n]);
  }

  blast(pan = 0): void {
    this.fx('blast', 'blast', [pan], 0);
  }

  vent(): void {
    this.fx('vent', 'vent', []);
  }

  droneZap(pan = 0, hive = false): void {
    this.fx('droneZap', 'droneZap', [pan, hive], 0);
  }

  wrench(pan = 0, heavy = false): void {
    this.fx('wrench', 'wrench', [pan, heavy], 0);
  }

  ratchet(pan = 0): void {
    this.fx('ratchet', 'ratchet', [pan], 0);
  }

  turretShot(pan = 0, mega = false): void {
    this.fx('turretShot', 'turretShot', [pan, mega], 0);
  }

  tesla(pan = 0, chain = false): void {
    this.fx('tesla', 'tesla', [pan, chain], 0);
  }

  feather(pan = 0): void {
    this.fx('feather', 'feather', [pan], 0);
  }

  screech(pan = 0): void {
    this.fx('screech', 'screech', [pan], 0);
  }

  /** The falconer's bird calling as it leaves her fist: a falcon's "kek-kek-kek", or an owl's bark. */
  falconCall(pan = 0, owl = false): void {
    const t = this.slot('falconCall');
    if (t !== null) this.sfx!.falconCall(t, pan, owl);
  }

  /** The falconer's whistle, two fingers at her lips: a long rising note and a sharp fall. */
  whistle(pan = 0): void {
    const t = this.slot('whistle');
    if (t !== null) this.sfx!.whistle(t, pan);
  }

  roar(pan = 0, big = false): void {
    this.fx('roar', 'roar', [pan, big], 0);
  }

  rake(pan = 0, heavy = false): void {
    this.fx('rake', 'rake', [pan, heavy], 0);
  }

  fireball(pan = 0): void {
    this.fx('fireball', 'fireball', [pan], 0);
  }

  flame(pan = 0): void {
    this.fx('flame', 'flame', [pan], 0);
  }

  servo(pan = 0): void {
    this.fx('servo', 'servo', [pan], 0);
  }

  crossbow(pan = 0): void {
    this.fx('crossbow', 'crossbow', [pan], 0);
  }

  bowShot(pan = 0, storm = false): void {
    this.fx('bowShot', 'bowShot', [pan, storm], 0);
  }

  arrowHit(pan = 0, storm = false): void {
    this.fx('arrowHit', 'arrowHit', [pan, storm], 0);
  }

  arrowStick(pan = 0, level = 0.4): void {
    this.fx('arrowStick', 'arrowStick', [pan, level], 0);
  }

  volley(pan = 0, storm = false): void {
    this.fx('volley', 'volley', [pan, storm], 0);
  }

  arrowRain(pan = 0, storm = false): void {
    this.fx('arrowRain', 'arrowRain', [pan, storm], 0);
  }

  knife(pan = 0, step = 1, finisher = false): void {
    this.fx('knife', 'knife', [pan, step, finisher], 0);
  }

  knifeHit(pan = 0, heavy = false): void {
    this.fx('knifeHit', 'knifeHit', [pan, heavy], 0);
  }

  vanish(pan = 0, dance = false): void {
    this.fx('vanish', 'vanish', [pan, dance], 0);
  }

  blink(pan = 0): void {
    this.fx('blink', 'blink', [pan], 0);
  }

  soulCast(pan = 0, blood = false): void {
    this.fx('soulCast', 'soulCast', [pan, blood], 0);
  }

  soulHit(pan = 0, blood = false): void {
    this.fx('soulHit', 'soulHit', [pan, blood], 0);
  }

  raiseDead(pan = 0): void {
    this.fx('raiseDead', 'raiseDead', [pan], 0);
  }

  boneHit(pan = 0): void {
    this.fx('boneHit', 'boneHit', [pan], 0);
  }

  boneCrumble(pan = 0): void {
    this.fx('boneCrumble', 'boneCrumble', [pan], 0);
  }

  bloodNova(pan = 0): void {
    this.fx('bloodNova', 'bloodNova', [pan], 0);
  }

  spadeSwing(pan = 0, heavy = false): void {
    const t = this.slot('spadeSwing');
    if (t !== null) this.sfx!.spadeSwing(t, pan, heavy);
  }

  spadeSlam(pan = 0): void {
    const t = this.slot('spadeSlam');
    if (t !== null) this.sfx!.spadeSlam(t, pan);
  }

  graveOpen(pan = 0): void {
    const t = this.slot('graveOpen');
    if (t !== null) this.sfx!.graveOpen(t, pan);
  }

  tombRise(pan = 0): void {
    const t = this.slot('tombRise');
    if (t !== null) this.sfx!.tombRise(t, pan);
  }
  /** The Reaper's scythe swung; `heavy` for the spinning reap. */
  reap(pan = 0, heavy = false): void {
    const t = this.slot('reap');
    if (t !== null) this.sfx!.reap(t, pan, heavy);
  }

  reapHit(pan = 0, heavy = false): void {
    const t = this.slot('reapHit');
    if (t !== null) this.sfx!.reapHit(t, pan, heavy);
  }

  deathStep(pan = 0): void {
    const t = this.slot('deathStep');
    if (t !== null) this.sfx!.deathStep(t, pan);
  }

  /** The Harvest's great scythe coming round (`n` its turn), and the last reap (`n` 0 for its tolling start). */
  reapHarvest(pan = 0, n = 0): void {
    const t = this.slot(`reapHarvest${n}`);
    if (t !== null) this.sfx!.reapHarvest(t, pan, n);
  }

  lutePluck(pan = 0): void {
    this.fx('lutePluck', 'lutePluck', [pan, this.lute++ % LUTE_NOTES], 0);
  }

  noteHit(pan = 0, leap = 0): void {
    this.fx('noteHit', 'noteHit', [pan, leap], 0);
  }

  song(pan = 0): void {
    this.fx('song', 'song', [pan], 0);
  }

  encore(pan = 0): void {
    this.fx('encore', 'encore', [pan], 0);
  }

  drumBeat(pan = 0, heavy = false): void {
    this.fx('drumBeat', 'drumBeat', [pan, heavy], 0);
  }

  drumRoll(pan = 0): void {
    this.fx('drumRoll', 'drumRoll', [pan], 0);
  }

  chronoCast(pan = 0, rift = false): void {
    this.fx('chronoCast', 'chronoCast', [pan, rift], 0);
  }

  chronoHit(pan = 0, rift = false): void {
    this.fx('chronoHit', 'chronoHit', [pan, rift], 0);
  }

  stasis(pan = 0): void {
    this.fx('stasis', 'stasis', [pan], 0);
  }

  decree(pan = 0): void {
    this.fx('decree', 'decree', [pan], 0);
  }

  hourStrike(pan = 0): void {
    this.fx('hourStrike', 'hourStrike', [pan], 0);
  }

  rewind(pan = 0): void {
    this.fx('rewind', 'rewind', [pan], 0);
  }

  timeStop(pan = 0): void {
    this.fx('timeStop', 'timeStop', [pan], 0);
  }

  echoes(pan = 0): void {
    this.fx('echoes', 'echoes', [pan], 0);
  }

  clack(pan = 0, heavy = false): void {
    this.fx('clack', 'clack', [pan, heavy], 0);
  }

  katana(pan = 0, heavy = false): void {
    this.fx('katana', 'katana', [pan, heavy], 0);
  }

  katanaHit(pan = 0, heavy = false): void {
    this.fx('katanaHit', 'katanaHit', [pan, heavy], 0);
  }

  gust(pan = 0): void {
    this.fx('gust', 'gust', [pan], 0);
  }

  windCharge(pan = 0): void {
    this.fx('windCharge', 'windCharge', [pan], 0);
  }

  windDash(pan = 0): void {
    this.fx('windDash', 'windDash', [pan], 0);
  }

  sheathe(pan = 0): void {
    this.fx('sheathe', 'sheathe', [pan], 0);
  }

  sever(pan = 0, n = 1): void {
    this.fx('sever', 'sever', [pan, n], 0);
  }

  skyQuake(pan = 0): void {
    this.fx('skyQuake', 'skyQuake', [pan], 0);
  }

  quakeSlam(pan = 0): void {
    this.fx('quakeSlam', 'quakeSlam', [pan], 0);
  }

  hundredCuts(pan = 0): void {
    this.fx('hundredCuts', 'hundredCuts', [pan], 0);
  }

  harpoon(pan = 0): void {
    this.fx('harpoon', 'harpoon', [pan], 0);
  }

  chainReel(pan = 0): void {
    this.fx('chainReel', 'chainReel', [pan], 0);
  }

  torpedo(pan = 0): void {
    this.fx('torpedo', 'torpedo', [pan], 0);
  }

  seaBurst(pan = 0): void {
    this.fx('seaBurst', 'seaBurst', [pan], 0);
  }

  paddle(pan = 0, heavy = false): void {
    this.fx('paddle', 'paddle', [pan, heavy], 0);
  }

  kegRoll(pan = 0): void {
    this.fx('kegRoll', 'kegRoll', [pan], 0);
  }

  foamBurst(pan = 0): void {
    this.fx('foamBurst', 'foamBurst', [pan], 0);
  }

  /** The Twin Blade's Riposte: a blow turned on his crossed sabers. */
  saberParry(pan = 0): void {
    const t = this.slot('saberParry');
    if (t !== null) this.sfx!.saberParry(t, pan);
  }

  /** Thousand Cuts' last crossing flash. */
  saberCross(pan = 0): void {
    const t = this.slot('saberCross');
    if (t !== null) this.sfx!.saberCross(t, pan);
  }

  ringSaber(pan = 0): void {
    const t = this.slot('ringSaber');
    if (t !== null) this.sfx!.ringSaber(t, pan);
  }

  step(): void {
    this.fx('step', 'step', []);
  }

  /**
   * Play a one-shot: from its baked clip once there is one, otherwise (the very
   * first time it's heard on this device) synthesized live while it bakes.
   * `panAt` is which of `args` is the side, so one clip serves every side.
   */
  private fx<K extends OneShot>(slot: string, method: K, args: ShotArgs<K>, panAt = -1): void {
    const t = this.slot(slot);
    if (t === null) return;
    const list = args as unknown[];
    const pan = panAt >= 0 ? Number(list[panAt]) || 0 : 0;
    let baked = false;
    safely(`clip ${method}`, () => (baked = this.baker!.play(method, list, panAt, t, pan)));
    if (!baked) (this.sfx![method] as (t: number, ...a: unknown[]) => void)(t, ...list);
  }

  candle(pan = 0): void {
    this.fx('candle', 'candle', [pan], 0);
  }

  starPop(pan = 0): void {
    this.fx('starPop', 'starPop', [pan], 0);
  }

  firecracker(pan = 0): void {
    this.fx('firecracker', 'firecracker', [pan], 0);
  }

  rocketWhistle(pan = 0): void {
    this.fx('rocketWhistle', 'rocketWhistle', [pan], 0);
  }

  fireworkBurst(pan = 0): void {
    this.fx('fireworkBurst', 'fireworkBurst', [pan], 0);
  }

  private live(): boolean {
    return this.running && !this._muted;
  }

  /** A Special gathering power for `seconds`. */
  ultCharge(seconds: number): void {
    this.fx('ultCharge', 'ultCharge', [seconds]);
  }

  ultRelease(pan = 0): void {
    this.fx('ultRelease', 'ultRelease', [pan], 0);
  }

  /** Energy soaking into the hero; `step` counts the motes of one kill, so each chimes a note higher. */
  energy(pan = 0, step = 0): void {
    this.fx('energy', 'energy', [pan, step], 0);
  }

  ultReady(): void {
    this.fx('ultReady', 'ultReady', []);
  }

  focusRay(pan = 0, struck = false): void {
    this.fx('focusRay', 'focusRay', [pan, struck], 0);
  }

  prism(pan = 0, hum = false, shatter = false): void {
    this.fx('prism', 'prism', [pan, hum, shatter], 0);
  }

  burningMirror(pan = 0, lit = false): void {
    this.fx('burningMirror', 'burningMirror', [pan, lit], 0);
  }

  quicksilver(pan = 0): void {
    this.fx('quicksilver', 'quicksilver', [pan], 0);
  }

  quickSplash(pan = 0, small = false): void {
    this.fx('quickSplash', 'quickSplash', [pan, small], 0);
  }

  chalk(pan = 0): void {
    this.fx('chalk', 'chalk', [pan], 0);
  }

  transmute(pan = 0, struck = false): void {
    this.fx('transmute', 'transmute', [pan, struck], 0);
  }

  gild(pan = 0, gild = false): void {
    this.fx('gild', 'gild', [pan, gild], 0);
  }

  opusShatter(pan = 0): void {
    this.fx('opusShatter', 'opusShatter', [pan], 0);
  }

  bearGrowl(pan = 0, big = false): void {
    this.fx('bearGrowl', 'bearGrowl', [pan, big], 0);
  }

  flareShot(pan = 0, star = false): void {
    this.fx('flareShot', 'flareShot', [pan, star], 0);
  }

  jetHop(pan = 0): void {
    this.fx('jetHop', 'jetHop', [pan], 0);
  }

  biplane(pan = 0): void {
    this.fx('biplane', 'biplane', [pan], 0);
  }

  bombWhistle(pan = 0): void {
    this.fx('bombWhistle', 'bombWhistle', [pan], 0);
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
      this.ctx = new AC({ latencyHint: touch ? PHONE_LATENCY : 'interactive' });
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
    // The game's music fades in from silence the first time the sound starts.
    const intro = gain(ctx, 0, this.tracks.main);
    intro.gain.setValueAtTime(0, ctx.currentTime);
    intro.gain.linearRampToValueAtTime(1, ctx.currentTime + MUSIC_FADE_IN);
    this.ambience = new Ambience(m);
    this.sfx = guarded(new Sfx(m));
    this.baker = new SfxBaker(m);
    if (this.baker.enabled) {
      // Everything continuous is baked a few seconds ahead (see bake.ts).
      const music = (this.music = new Music());
      const shop = (this.shopMusic = new ShopMusic());
      const amb = this.ambience;
      this.streams = {
        main: new Stream(m, { chunk: CHORD_SECONDS, tail: MUSIC_TAIL, rate: MUSIC_RATE, stems: [{ dest: intro, stereo: true }] }, (bm, _s, origin, len) => {
          music.bind(bm, bm.music, origin);
          // Live, the music's reverb skipped the music bus's own level; baked, it rides inside the music.
          bm.musicVerb.gain.value = 1 / MUSIC_LEVEL;
          music.tick(origin, origin + len);
        }),
        shop: new Stream(m, { chunk: SHOP_CHORD_SECONDS * 2, tail: MUSIC_TAIL, rate: MUSIC_RATE, stems: [{ dest: this.tracks.shop, stereo: true }] }, (bm, _s, origin, len) => {
          shop.bind(bm, bm.music, origin);
          bm.musicVerb.gain.value = 1 / MUSIC_LEVEL;
          shop.tick(origin, origin + len);
        }),
        calls: new Stream(m, { chunk: CALLS_CHUNK, tail: CALLS_TAIL, rate: CALLS_RATE, stems: amb.stems }, (bm, stems, origin, len) => {
          amb.bindCalls(bm, stems, origin);
          // Likewise the creatures' reverb, which now passes the ambience bus's level.
          bm.reverb.gain.value = 1 / AMBIENCE_LEVEL;
          amb.tickCalls(origin, origin + len, true);
        }),
      };
      this.baker.warm();
    } else {
      this.music = new Music(m, intro);
      this.shopMusic = new ShopMusic(m, this.tracks.shop);
    }
    this.shopMusic.setMood(this.shopMood);
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
    const s = this.streams;
    if (s) {
      if (this.track === 'main' || fading) safely('music', () => s.main.tick(now));
      if (this.track === 'shop' || fading) safely('shop music', () => s.shop.tick(now));
      safely('calls', () => s.calls.tick(now));
    } else {
      if (this.track === 'main' || fading) safely('music', () => this.music!.tick(now, now + LOOKAHEAD));
      if (this.track === 'shop' || fading) safely('shop music', () => this.shopMusic!.tick(now, now + LOOKAHEAD));
      safely('calls', () => this.ambience!.tickCalls(now, now + LOOKAHEAD, false));
    }
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
