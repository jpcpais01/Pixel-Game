import Phaser from 'phaser';
import type { Dir } from '../art/wizard';
import { BARD_H, BARD_ORIGIN_X, BARD_ORIGIN_Y, BARD_RELEASE, BARD_W } from '../art/bard';
import { snap } from './display';
import { dirOf, sunShadow, SUN_SHADOW_ALPHA } from './Wizard';
import { beamHud, comboHud } from './controls';
import { sound } from '../audio';
import { Vitals } from './combat';
import { heroBuffs } from './buffs';
import { DRUM_PAL, HASTE, Note, RHYTHM, Shockwave, SongBurst, TROUBADOUR_SONG, WILD_HASTE, WILD_SONG, type NoteKind, type SongLook } from './Songs';
import type { BuffDef } from './buffs';
import type { Aim, Hero } from './characters';
import type { WorldScene } from '../scenes/WorldScene';

// Walk frames where a foot lands.
const FOOTFALLS = new Set([1, 4]);

type Act = 'strum' | 'song' | 'beat' | 'beat2' | 'boom' | 'roll';
type State = 'free' | Act;

/** A drum blow: an arc of sound `spread` either side of the aim. */
interface Blow {
  damage: number;
  radius: number;
  spread: number;
  knock: number;
}

/** How a bard type plays: its look, its body, its attack and its song. */
export interface BardKit {
  key: string;
  /** The war drummer: drum blows and the battle rhythm, rather than notes and the song of haste. */
  drum: boolean;
  maxHp: number;
  speed: number;
  /** A breath after each attack before the next. */
  rest: number;
  /** The minstrel's notes. */
  note: NoteKind;
  /** The drummer's first two beats, and the boom that ends the chain. */
  beat: Blow;
  boom: Blow;
  /** How long after a beat the next one still chains, in ms. */
  comboWindow: number;
  /** Health the song gives back at once, on top of its healing over time. */
  songHeal: number;
  specialCooldown: number;
  /** How the minstrel's music looks, and the song's buff as it shows (the same buff in each look). */
  song: SongLook;
  haste: BuffDef;
}

/**
 * The minstrel: notes from the lute that leap from foe to foe, and a song
 * that quickens the feet and closes wounds.
 */
export const MINSTREL_KIT: BardKit = {
  key: 'bard',
  drum: false,
  maxHp: 85,
  speed: 64,
  rest: 120,
  note: { damage: 7, bounces: 3, falloff: 0.8, speed: 175, range: 160, seek: 4, lit: true },
  beat: { damage: 0, radius: 0, spread: 0, knock: 0 },
  boom: { damage: 0, radius: 0, spread: 0, knock: 0 },
  comboWindow: 0,
  songHeal: 10,
  specialCooldown: 14000,
  song: TROUBADOUR_SONG,
  haste: HASTE,
};

/** The minstrel in his wildsong skin: the same bard, in moss and forest light. */
export const WILD_KIT: BardKit = { ...MINSTREL_KIT, key: 'bard_wild', song: WILD_SONG, haste: WILD_HASTE };

/**
 * The war drummer: tougher and slower, beating waves of sound out of his drum
 * that throw foes back, two beats and a boom; the battle rhythm makes every
 * blow land harder.
 */
export const DRUMMER_KIT: BardKit = {
  key: 'bard_drum',
  drum: true,
  maxHp: 115,
  speed: 58,
  rest: 70,
  note: MINSTREL_KIT.note,
  beat: { damage: 9, radius: 30, spread: 0.85, knock: 170 },
  boom: { damage: 16, radius: 40, spread: 1.25, knock: 260 },
  comboWindow: 700,
  songHeal: 0,
  specialCooldown: 15000,
  song: TROUBADOUR_SONG,
  haste: HASTE,
};

const CHAIN: Act[] = ['beat', 'beat2', 'boom'];

/**
 * The bard: plays on the attack button, toward the aim (the mouse on a
 * computer); on the special he plays his song, which lifts him (and, one day,
 * his friends). The minstrel strums notes and sings the song of haste; the war
 * drummer beats shockwaves out of his drum and drums up a battle rhythm.
 */
export class Bard implements Hero {
  x: number;
  y: number;
  /** 0 = night, 1 = day. */
  daylight = 0;
  readonly vitals: Vitals;
  /** 0..1, fades the whole figure (see Hero). */
  alpha = 1;
  private dir: Dir = 'down';
  private world: WorldScene;
  private body: Phaser.GameObjects.Sprite;
  private glowLayer: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private castShadow: Phaser.GameObjects.Sprite;
  private state: State = 'free';
  private lastMove = new Phaser.Math.Vector2(0, 1);
  /** Towards the mouse on a computer (see Hero). */
  private aim: Aim | null = null;
  private line: Aim = { x: 0, y: 1 };
  private released = false;
  private cooldown = 0;
  private specialCd = 0;
  /** The drummer's place in his chain of beats, and the time left to carry it on. */
  private combo = 0;
  private comboT = 0;
  private kit: BardKit;

  /** The body sprite (see Hero). */
  get sprite(): Phaser.GameObjects.Sprite {
    return this.body;
  }

  constructor(world: WorldScene, x: number, y: number, kit: BardKit = MINSTREL_KIT) {
    this.world = world;
    this.kit = kit;
    this.vitals = new Vitals(kit.maxHp);
    const k = kit.key;
    this.x = x;
    this.y = y;
    const ox = BARD_ORIGIN_X / BARD_W;
    const oy = BARD_ORIGIN_Y / BARD_H;
    this.shadow = world.add.image(x, y, 'shadow').setDepth(1);
    this.castShadow = sunShadow(world.add.sprite(x, y, `${k}_s`, 'idle_down_0').setOrigin(ox, oy));
    this.body = world.add.sprite(x, y, k, 'idle_down_0').setOrigin(ox, oy).setPipeline('Lit');
    this.glowLayer = world.add.sprite(x, y, `${k}_e`, 'idle_down_0').setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD);
    this.body.play(`${k}_idle_down`);

    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.state !== 'free' && anim.key.startsWith(`${k}_${this.state}_`)) {
        if (this.state === 'beat' || this.state === 'beat2') this.comboT = this.kit.comboWindow;
        this.state = 'free';
        this.cooldown = this.kit.rest;
        this.body.play(`${k}_idle_${this.dir}`);
      }
    });
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key.startsWith(`${k}_walk`) && FOOTFALLS.has(frame.index - 1)) sound.step();
    });
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      beamHud.firing = false;
      comboHud.hits = 0;
      comboHud.window = 0;
    });
  }

  update(dt: number, mx: number, my: number, attack: boolean, special: boolean, bounds: Phaser.Geom.Rectangle, aim: Aim | null = null): void {
    this.aim = aim;
    const len = Math.hypot(mx, my);
    const moving = len > 0.18;
    if (moving) this.lastMove.set(mx / len, my / len);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    if (this.state === 'free') {
      this.comboT = Math.max(0, this.comboT - dt);
      if (this.comboT === 0) this.combo = 0;
    }

    if (this.state === 'free' && this.cooldown === 0) {
      if (special && this.specialCd === 0) this.start(this.kit.drum ? 'roll' : 'song');
      else if (attack) this.start(this.kit.drum ? CHAIN[this.combo] : 'strum');
    }

    const slow = { free: Math.min(1, len), strum: 0.7, song: 0.35, beat: 0.5, beat2: 0.5, boom: 0.3, roll: 0.35 }[this.state];
    const speed = this.kit.speed * slow;
    const vx = moving ? (mx / len) * speed : 0;
    const vy = moving ? (my / len) * speed : 0;
    this.x = Phaser.Math.Clamp(this.x + vx * (dt / 1000), bounds.left, bounds.right);
    this.y = Phaser.Math.Clamp(this.y + vy * (dt / 1000), bounds.top, bounds.bottom);

    if (this.state === 'free') {
      // Fighting faces the aim, even walking backwards; otherwise the way of the walk.
      if (this.aim?.look) this.dir = dirOf(this.aim.x, this.aim.y);
      else if (moving) this.dir = dirOf(mx, my);
      const key = `${this.kit.key}_${moving ? 'walk' : 'idle'}_${this.dir}`;
      if (this.body.anims.currentAnim?.key !== key) this.body.play(key, true);
    } else {
      // Until the blow lands, the aim follows the mouse.
      if (!this.released) this.takeAim();
      const f = this.body.anims.currentFrame;
      if (!this.released && f && f.index - 1 >= BARD_RELEASE[this.state]) {
        this.released = true;
        this.land(this.state);
      }
    }

    this.sync();
    this.updateHud();
  }

  private start(act: Act): void {
    this.state = act;
    this.released = false;
    this.takeAim();
    this.body.play(`${this.kit.key}_${act}_${this.dir}`);
    // The songs are music from their first stroke: their sound starts with the playing.
    const pan = this.world.pan(this.x);
    if (act === 'song') sound.song(pan);
    else if (act === 'roll') sound.drumRoll(pan);
  }

  /** Which way: at the mouse on a computer, else the way he last walked. */
  private takeAim(): void {
    const a = this.aim ?? this.lastMove;
    this.line = { x: a.x, y: a.y };
    const dir = dirOf(a.x, a.y);
    if (dir !== this.dir) {
      this.dir = dir;
      const frame = this.body.anims.currentFrame;
      if (frame && this.state !== 'free') this.body.play({ key: `${this.kit.key}_${this.state}_${dir}`, startFrame: frame.index - 1 });
    }
  }

  /** The moment each action lands. */
  private land(act: Act): void {
    switch (act) {
      case 'strum':
        this.strumNote();
        break;
      case 'song':
        this.songOfHaste();
        break;
      case 'beat':
      case 'beat2':
        this.drumBlow(this.kit.beat, false);
        this.combo = Math.min(CHAIN.length - 1, this.combo + 1);
        break;
      case 'boom':
        this.drumBlow(this.kit.boom, true);
        this.combo = 0;
        this.comboT = 0;
        break;
      case 'roll':
        this.battleRhythm();
        break;
    }
  }

  /** A note leaves the strings and flies, bending towards the first foe ahead of it. */
  private strumNote(): void {
    const u = this.line;
    sound.lutePluck(this.world.pan(this.x));
    this.world.addEffect(new Note(this.world, this.x + u.x * 6, this.y + u.y * 3 + 1, u.x, u.y, this.kit.note, null, this.kit.song));
  }

  /** The song of haste: quicker feet and a heal, a ring of music rolling out from him. */
  private songOfHaste(): void {
    this.specialCd = this.kit.specialCooldown;
    heroBuffs.add(this.kit.haste);
    this.world.buffGained(this.kit.haste);
    const got = this.vitals.heal(this.kit.songHeal);
    if (got > 0) this.world.popNumber(snap(this.x), snap(this.y) - 30, `+${got}`, 0x9dff9a);
    this.world.addEffect(new SongBurst(this.world, this.x, this.y, this.kit.song.pal, this.kit.song.tex));
  }

  /** A blow on the drum: a wave of sound rolls out the way he faces and throws back everything it meets. */
  private drumBlow(b: Blow, big: boolean): void {
    const u = this.line;
    const ox = this.x;
    const oy = this.y - 8;
    const angle = Math.atan2(u.y, u.x);
    sound.drumBeat(this.world.pan(ox), big);
    this.world.addEffect(new Shockwave(this.world, ox + u.x * 4, this.y - 6 + u.y * 3, angle, b.spread, b.radius + 4, DRUM_PAL, big ? 340 : 260));
    const hits = this.world.melee({ kind: 'arc', x: ox, y: oy, radius: b.radius, angle, spread: b.spread }, { damage: b.damage, heavy: big, knock: b.knock, fromX: ox, fromY: oy });
    for (const h of hits) this.world.debris(DRUM_PAL.tints, snap(h.x), snap(h.y), big ? 6 : 4, h.y + 20);
    if (big) this.world.cameras.main.shake(90, 0.0012);
  }

  /** The battle rhythm: the roll ends in a great beat that shoves foes off him, and every blow lands harder for a while. */
  private battleRhythm(): void {
    this.specialCd = this.kit.specialCooldown;
    heroBuffs.add(RHYTHM);
    this.world.buffGained(RHYTHM);
    sound.drumBeat(this.world.pan(this.x), true);
    this.world.addEffect(new Shockwave(this.world, this.x, this.y - 4, 0, Math.PI, 40, DRUM_PAL, 420));
    this.world.melee({ kind: 'circle', x: this.x, y: this.y - 6, radius: 32 }, { damage: 6, heavy: false, knock: 200, fromX: this.x, fromY: this.y - 6 });
    this.world.cameras.main.shake(120, 0.0015);
  }

  private updateHud(): void {
    // The special button: a ring refilling over the cooldown.
    beamHud.charge = 1 - this.specialCd / this.kit.specialCooldown;
    beamHud.over = 0;
    beamHud.firing = this.state === 'song' || this.state === 'roll';
    // The drummer's chain lights pips on the attack button.
    comboHud.max = 3;
    comboHud.hits = this.kit.drum ? this.combo : 0;
    comboHud.window = this.kit.drum && this.combo > 0 ? this.comboT / this.kit.comboWindow : 0;
  }

  private sync(): void {
    const rx = snap(this.x);
    const ry = snap(this.y);
    const frame = this.body.frame.name;
    this.body.setPosition(rx, ry).setDepth(ry).setAlpha(this.alpha);
    this.glowLayer.setPosition(rx, ry).setDepth(ry + 0.1).setFrame(frame).setAlpha(this.alpha);
    this.shadow.setPosition(rx, ry - 1).setAlpha(this.alpha);
    this.castShadow.setPosition(rx, ry - 1).setFrame(frame).setAlpha(SUN_SHADOW_ALPHA * this.daylight * this.alpha);
  }
}
