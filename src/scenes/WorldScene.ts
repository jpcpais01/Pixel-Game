import Phaser from 'phaser';
import { controls } from '../game/controls';
import { sunShadow, SUN_SHADOW_ALPHA } from '../game/Wizard';
import { EnergyBall, type BallKind } from '../game/EnergyBall';
import { Beam } from '../game/Beam';
import type { SpellStyle } from '../game/spells';
import { daynight } from '../game/daynight';
import { settings } from '../game/settings';
import { sky } from '../game/LitPipeline';
import { pixelGrid, snap } from '../game/display';
import { PixelPipeline } from '../game/PixelPipeline';
import { skyState } from '../game/SkyPipeline';
import { characterById, type Aim, type Hero } from '../game/characters';
import { damageScale, defenseFactor, heroStats, type HeroStats } from '../game/stats';
import { areaOrigin, reachesBody, type Harm, type Hit, type Hurtbox, type MeleeArea, type Strike } from '../game/combat';
import { HealthBar } from '../game/HealthBar';
import { HealPop } from '../game/Holy';
import type { Effect } from '../game/Slash';
import { separate, Spawner, type Monster, type Target } from '../game/monsters';
import { freeBox } from '../world/common';
import { GroundStreamer } from '../world/GroundStreamer';
import { Scenery } from '../world/Scenery';
import { arenaById, type ArenaDef } from '../world/arenas';
import { PLAZA_H, PLAZA_Y, plazaProps } from '../world/clearing';
import { Garden } from '../world/Garden';
import { CosmosArena } from '../world/Cosmos';
import { RiftArena } from '../world/Rift';
import { RiftWaves, resetRift, riftMods } from '../game/rift';
import { Companion } from '../game/Companion';
import { petById, petMods, wearPet } from '../game/pets';
import { FloatingIsland } from '../world/Island';
import { SpiritDungeon } from '../world/Spirit';
import { TempleDungeon } from '../world/Temple';
import { GlimmerDeep } from '../world/Deep';
import { RuneTemple } from '../world/Sanctum';
import { Chapel } from '../world/Chapel';
import { INSIDE_SPOT, OUTSIDE_SPOT, roomRect } from '../world/sanctumLayout';
import { isPainted } from '../world/arenas';

type V3 = [number, number, number];

/** Lighting for each end of the day/night blend. */
const NIGHT = {
  sunDir: [0.5, 0.45, 0.74] as V3, // moon, from the upper right
  sun: [0.1, 0.13, 0.26] as V3,
  sky: [0.2, 0.24, 0.38] as V3,
  bounce: [0.13, 0.13, 0.24] as V3,
};
const DAY = {
  sunDir: [-0.45, 0.5, 0.74] as V3, // sun, from the upper left
  sun: [0.78, 0.66, 0.5] as V3,
  sky: [0.5, 0.58, 0.72] as V3,
  bounce: [0.4, 0.36, 0.32] as V3,
};
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
import { sound } from '../audio';
import { inventory, rollDrop, STARTING_ITEMS, HOTBAR_SIZE, type ItemContext } from '../game/items';
import { heroBuffs, type BuffDef } from '../game/buffs';
import { LootFlare, Pickup } from '../game/Pickup';
import { gear, GEAR_SETS, RARITY, type GearDef, type SetId } from '../game/gear';
import { rollGems } from '../game/tiers';
import { collection, slotIndex } from '../game/collection';
import { energy, energyFor } from '../game/energy';
import { ensureUltIcons, EnergyMotes, UltCaster } from '../game/ultimate';
import type { MonsterStats } from '../game/monsters/Monster';
import { NetPlay } from '../net/NetPlay';
import { session } from '../net/session';
import { diag, note } from '../diagnostics';

interface Flicker {
  light: Phaser.GameObjects.Light;
  halo: Phaser.GameObjects.Image;
  base: number;
  radius: number;
  seed: number;
  /** How much of the light survives in daylight. */
  day: number;
  haloBase: number;
}

export type { MeleeArea } from '../game/combat';

/** How long the hero lies fallen before rising again at the plaza. */
const DOWN_TIME = 3500;
/** Invulnerable this long after being struck, and after rising. */
const HURT_GRACE = 550;
const RISE_GRACE = 2200;
/** The hero's body, for monster hits: centre height above the feet, and radius. */
const HERO_BODY_Y = 11;
const HERO_RADIUS = 6;
/** A step into a wall is turned this much at a time, up to the most, to find ground to glide along (radians). */
const SLIDE_TURN_STEP = Math.PI / 24;
const SLIDE_MAX_TURN = (80 * Math.PI) / 180;
/** Steps longer than this (a blink, a dash) aren't turned, only held to the room around the hero. */
const SLIDE_MAX_STEP = 8;

/** A straw training dummy: struck like a monster, but never falls. */
class Dummy implements Hurtbox {
  readonly bodyY = 11;
  readonly radius = 6;
  readonly alive = true;
  wobble = 0;

  constructor(
    private world: WorldScene,
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly x: number,
    readonly y: number,
  ) {}

  hurt(hit: Hit): void {
    this.wobble = hit.heavy ? 1.4 : 1;
    this.sprite.setFrame('d1');
    this.world.time.delayedCall(90, () => this.sprite.setFrame('d0'));
    this.world.popNumber(this.x, this.y - 30, `${Math.round(hit.damage * this.world.mightOf(hit))}`, hit.poison ?? (hit.heavy ? 0xffe28a : 0xffffff));
  }
}

/** Touch abilities tapped without dragging aim at the nearest enemy this close to the hero, in world px. */
const AUTO_AIM_RANGE = 150;
/** How long the hero keeps facing the aim after an ability, in ms. */
const LOOK_LINGER = 450;
/** How light it is inside the Rune Temple at night, and how much more the day outside adds. */
const INDOOR_DUSK = 0.18;
const INDOOR_DAY = 0.34;

/** How each gear set worn whole shows on the hero. */
const SET_AURA: Record<SetId, { name: string; text: number; tint: number; motes: number[]; life: { min: number; max: number }; rise: { min: number; max: number }; scale: number; every: number }> = {
  wraith: { name: 'SPECTRAL FORM', text: 0x9ffff0, tint: 0x6af4dc, motes: [0xeafffa, 0x6af4dc, 0x8ac8ff], life: { min: 700, max: 1300 }, rise: { min: -24, max: -8 }, scale: 0.5, every: 95 },
  // Quicker, brighter sparks that leap higher: the hero burns like the Elementinho.
  ember: { name: 'LIVING FLAME', text: 0xffc060, tint: 0xff8a2a, motes: [0xfff0a0, 0xffb030, 0xf06a1a], life: { min: 450, max: 850 }, rise: { min: -40, max: -16 }, scale: 0.55, every: 70 },
  // Slow, long-lived spores drifting lazily about: the hero blooms like the Sporemother.
  spore: { name: 'SPORE VEIL', text: 0xffb0ec, tint: 0xff6ad8, motes: [0xff6ad8, 0xffd0f4, 0x5ae4ff, 0xe8fffa], life: { min: 1400, max: 2400 }, rise: { min: -10, max: -3 }, scale: 0.5, every: 110 },
  // Sharp glints that flash and rise: amethyst grown from the hero like the wyrm's spines.
  // Stars wheeling slowly about the hero, white and blue with a glint of gold: the Warden's own light.
  astral: { name: 'STARBORN', text: 0xd8e0ff, tint: 0x8aa0ff, motes: [0xffffff, 0xd8e0ff, 0x8aa0ff, 0xffe08a], life: { min: 700, max: 1300 }, rise: { min: -22, max: -8 }, scale: 0.5, every: 80 },
  geode: { name: 'CRYSTAL FORM', text: 0xead8ff, tint: 0xb37aff, motes: [0xffffff, 0xead8ff, 0xb37aff, 0x9c68e8], life: { min: 600, max: 1100 }, rise: { min: -30, max: -12 }, scale: 0.5, every: 85 },
};

export class WorldScene extends Phaser.Scene {
  private hero!: Hero;
  /** The hero's base stats (its type's; gear adds to them). */
  private stats!: HeroStats;
  /** Online play: the other players, and what is shared with them (null alone). */
  private net: NetPlay | null = null;
  /** Casts the hero's Special (see game/ultimate). */
  private ult!: UltCaster;
  /** The way the hero last walked, for a Special cast with nothing aimed. */
  private facing = { x: 0, y: 1 };
  private arena!: ArenaDef;
  /** The arena's own living parts, when it is the Sunken Garden. */
  private garden: Garden | null = null;
  /** The arena's own living parts, when it is the Cosmos Arena. */
  private cosmos: CosmosArena | null = null;
  /** The Endless Rift: its arena, and the waves standing in for its spawner. */
  private rift: RiftArena | null = null;
  /** The companion following the hero, if one is worn. */
  private companion: Companion | null = null;
  private riftWaves: RiftWaves | null = null;
  /** The arena's own living parts, when it is the Floating Island. */
  private island: FloatingIsland | null = null;
  /** The arena's own living parts, when it is the Spirit Dungeon. */
  private spirit: SpiritDungeon | null = null;
  /** The arena's own living parts, when it is the Elementinho Temple. */
  private temple: TempleDungeon | null = null;
  /** The arena's own living parts, when it is the Glimmerdeep. */
  private deep: GlimmerDeep | null = null;
  /** The Rune Temple, when this is the Runestone Clearing. */
  private sanctum: RuneTemple | null = null;
  private chapel: Chapel | null = null;
  /** The hero is inside the Rune Temple (the camera keeps to its room). */
  private inside = false;
  /** Passing through the temple's door: the screen fades out and in. */
  private doorBusy = false;
  /** Where the camera may look: the arena's ground, or the temple's room while inside it. */
  private camRect = new Phaser.Geom.Rectangle();
  /** Set once the run has begun (after the gear worn from the start is on). */
  private running = false;
  /** The aura of each gear set worn whole about the hero: a glow at their feet and motes rising off them. */
  private auras = new Map<SetId, { halo: Phaser.GameObjects.Image; motes: Phaser.GameObjects.Particles.ParticleEmitter }>();
  /** How far the camera leans off the hero, toward a boss towering over the fight. */
  private lean = { x: 0, y: 0 };
  /** The light this frame: 0 night .. 1 day (fixed in arenas without day and night). */
  private daylight = 1;
  /** Healing from buffs, gathered until it makes a whole point, and shown once a second. */
  private regenAcc = 0;
  private regenShown = 0;
  private regenT = 0;
  /** Time until the next speck rising from a buff's glow. */
  private auraT = 0;
  private worldRect = new Phaser.Geom.Rectangle();
  /** The whole world, for shots that fly beyond the room around the hero. */
  get area(): Phaser.Geom.Rectangle {
    return this.worldRect;
  }
  private balls: EnergyBall[] = [];
  private beams: Beam[] = [];
  private flickers: Flicker[] = [];
  private dummies: Dummy[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mouseWorld = new Phaser.Math.Vector2();
  /** Time left facing the last aim after an ability, so walking between blows doesn't swing the hero round. */
  private lookT = 0;
  private lastAim: Aim | null = null;
  /** The dotted line from the hero while a touch ability button is dragged. */
  private aimLine!: Phaser.GameObjects.Graphics;
  private aimShown = false;
  private struck = false;
  /** The world's outer edge; within it, `walkable` decides where feet may go. */
  private bounds = new Phaser.Geom.Rectangle();
  /** How far the hero may step this frame before bumping into something. */
  private heroBox = new Phaser.Geom.Rectangle();
  /** Which way the hero last glanced off a wall (see settleStep). */
  private slideSide = 1;
  /** Where monsters may roam: the world's edge, and `walkable` within it. */
  get monsterBounds(): Phaser.Geom.Rectangle {
    return this.bounds;
  }
  /** Can feet stand at (x, y)? The arena's walls, trees and water say no, and so do standing flowers. */
  walkable = (x: number, y: number): boolean => this.arena.walkable(x, y) && (!this.garden || this.garden.walkable(x, y));
  /** The streamed ground, or null in an arena painted in one piece. */
  private ground: GroundStreamer | null = null;
  private scenery!: Scenery;
  /** The camera's view of the world, in world pixels. */
  private view = new Phaser.Geom.Rectangle();
  private banner: Phaser.GameObjects.BitmapText | null = null;
  private spawners: Spawner[] = [];
  private effects: Effect[] = [];
  /** Items lying on the ground. */
  private pickups: Pickup[] = [];
  /** Time until the next speck of the speed trail. */
  private trailT = 0;
  /** What items may do to the world when used. */
  private itemCtx!: ItemContext;
  private debrisEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private heroBar!: HealthBar;
  private spawnX = 0;
  private spawnY = 0;
  /** Time left lying fallen, or 0 while standing. */
  private downT = 0;
  private grace = 0;
  private rising = false;
  private hurtTint = 0;
  private pushX = 0;
  private pushY = 0;
  private fallen: Phaser.GameObjects.BitmapText | null = null;
  private shafts: Phaser.GameObjects.TileSprite | null = null;
  private shadows: Phaser.GameObjects.Image[] = [];
  private pollen!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pixels!: PixelPipeline;
  /** Draws the ground at art resolution, under the main camera's sprites. */
  private groundCam!: Phaser.Cameras.Scene2D.Camera;
  /** Cloud shadows and the vignette, drawn in one pass (see SkyPipeline). */
  private skyLayer!: Phaser.GameObjects.Image;

  constructor() {
    super('world');
  }

  create(data: { character?: string; arena?: string }): void {
    // The scene object is reused when a new game starts from the home screen.
    this.balls = [];
    this.beams = [];
    this.flickers = [];
    this.dummies = [];
    this.shadows = [];
    this.spawners = [];
    this.effects = [];
    this.pickups = [];
    this.debrisEmitters = new Map();
    this.downT = this.grace = this.hurtTint = this.pushX = this.pushY = 0;
    this.fallen = null;
    this.banner = null;
    this.garden = null;
    this.cosmos = null;
    this.rift = null;
    this.riftWaves = null;
    resetRift();
    this.island = null;
    this.spirit = null;
    this.temple = null;
    this.deep = null;
    this.sanctum = null;
    this.chapel = null;
    this.inside = false;
    this.doorBusy = false;
    this.auras.clear();
    this.running = false;
    this.lean.x = this.lean.y = 0;
    this.shafts = null;
    this.regenAcc = this.regenShown = this.regenT = this.auraT = 0;
    const arena = (this.arena = arenaById(data?.arena));
    // Some arenas reach past their ground (the Rune Temple's room lies east of the clearing).
    const W = arena.world?.w ?? arena.ground.w;
    const H = arena.world?.h ?? arena.ground.h;
    this.worldRect.setTo(0, 0, W, H);
    this.camRect.setTo(0, 0, arena.ground.w, arena.ground.h);
    this.bounds.setTo(8, 10, W - 16, H - 24);
    daynight.enabled = !!arena.dayNight;
    this.daylight = arena.dayNight ? daynight.daylight : (arena.daylight ?? 1);

    // Ambient comes from the Lit pipeline's sky and sun, driven by daynight.
    this.lights.enable().setAmbientColor(0x000000);

    // The full-screen ground layers are the costly part to light, so a second
    // camera draws only them, at art resolution, before the main camera draws
    // everything else over them at full resolution (see PixelPipeline).
    const cam = this.cameras.main;
    this.groundCam = this.cameras.add(0, 0, cam.width, cam.height, false, 'ground');
    const order = this.cameras.cameras;
    order.splice(order.indexOf(this.groundCam), 1);
    order.unshift(this.groundCam);
    this.groundCam.setPostPipeline('Pixel').setRoundPixels(false);
    this.pixels = this.groundCam.getPostPipeline('Pixel') as PixelPipeline;
    const groundCam = this.groundCam;
    const hideFromGround = (obj: Phaser.GameObjects.GameObject) => groundCam.ignore(obj);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, hideFromGround);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, hideFromGround));
    const ground = (obj: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite) => {
      obj.cameraFilter &= ~groundCam.id;
      cam.ignore(obj);
      return obj;
    };

    // The ground streams in strips as the hero walks (see GroundStreamer).
    this.ground = isPainted(arena.ground) ? null : new GroundStreamer(this, arena.ground, (img) => ground(img) as Phaser.GameObjects.Image);
    sound.setOutdoors(arena.id !== 'cosmos' && arena.id !== 'spirit' && arena.id !== 'temple' && arena.id !== 'deep' && arena.id !== 'rift');
    if (arena.id === 'rift') this.rift = new RiftArena(this, (img) => ground(img) as Phaser.GameObjects.Image);
    if (arena.id === 'cosmos') this.cosmos = new CosmosArena(this, (img) => ground(img) as Phaser.GameObjects.Image, this.view);
    if (arena.id === 'spirit') this.spirit = new SpiritDungeon(this, (img) => ground(img) as Phaser.GameObjects.Image, this.view);
    if (arena.id === 'temple') this.temple = new TempleDungeon(this, (img) => ground(img) as Phaser.GameObjects.Image, this.view);
    if (arena.id === 'deep') this.deep = new GlimmerDeep(this, (img) => ground(img) as Phaser.GameObjects.Image, this.view);
    if (arena.id === 'island') {
      this.island = new FloatingIsland(this, ground, this.view);
      this.shadows.push(...this.island.shadows);
    }

    // Faint shafts of sunlight over the clearing's ground. Drifting cloud
    // shadows are drawn over everything, with the vignette (see below).
    if (arena.id === 'clearing') {
      this.shafts = ground(this.add.tileSprite(0, PLAZA_Y, W, PLAZA_H, 'shafts').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(3)) as Phaser.GameObjects.TileSprite;
    }

    // Motes drift wherever the camera looks.
    const view = this.view;
    this.pollen = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 5000,
      speedX: { min: 2, max: 9 },
      speedY: { min: -4, max: 3 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.75 },
      tint: [0xfff4c8, 0xffffff, 0xffe28a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
    }).setDepth(9999);
    this.fireflies = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: view } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2500, max: 4500 },
      speed: { min: 2, max: 7 },
      scale: 0.5,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 3)) },
      tint: [0xd8ff7a, 0xf6ffb0, 0x9dffb0],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 160,
    }).setDepth(9999);

    // Half the drifting motes on Fast graphics.
    const offQuality = settings.watch((s) => {
      const k = s.quality !== 'full' ? 2 : 1;
      this.pollen.frequency = 90 * k;
      this.fireflies.frequency = 160 * k;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offQuality);

    if (arena.id === 'clearing') {
      // Braziers, crystals, rocks and training dummies round the plaza.
      const p = plazaProps();
      for (const b of p.braziers) this.brazier(b.x, b.y);
      for (const c of p.crystals) this.crystals(c.x, c.y, c.frame);
      for (const r of p.rocks) {
        this.add.image(r.x, r.y, 'rock', r.frame).setOrigin(0.5, 12 / 14).setPipeline('Lit').setDepth(r.y);
        this.shadows.push(sunShadow(this.add.image(r.x, r.y, 'rock_s', r.frame).setOrigin(0.5, 12 / 14)));
      }
      for (const d of p.dummies) this.dummy(d.x, d.y);
      this.sanctum = new RuneTemple(this, (img) => ground(img) as Phaser.GameObjects.Image);
      this.shadows.push(...this.sanctum.shadows);
    } else if (arena.id === 'garden') {
      this.garden = new Garden(this);
    }

    this.spawnX = arena.spawn.x;
    this.spawnY = arena.spawn.y;
    const ch = characterById(data?.character);
    this.hero = ch.spawn(this, this.spawnX, this.spawnY);
    this.stats = heroStats(ch.id, ch.type.id);
    diag.hero = `${ch.id} / ${ch.type.id} / ${ch.skin?.id ?? 'no skin'}`;
    diag.arena = arena.id;
    diag.online = session.active ? `online ${session.room?.mode}, ${session.isHost ? 'host' : 'guest'}, ${session.peers.size + 1} players` : 'solo';
    diag.started = performance.now();
    diag.trail.length = 0;
    note(`start ${ch.look} in ${arena.id}`);
    ensureUltIcons(this);
    this.ult = new UltCaster(this, this.hero, ch);
    this.facing = { x: 0, y: 1 };
    // Energy starts empty each run.
    energy.reset(this.ult.cost);
    this.heroBar = new HealthBar(this);
    this.aimLine = this.add.graphics().setDepth(15000).setVisible(false);
    this.aimShown = false;
    this.lookT = 0;
    this.lastAim = null;
    // The worn companion comes along, its perk with it. Not in a duel: the
    // opponent can't see it, so its blows and perk would be an unfair edge.
    const duel = session.active && session.room?.mode === 'duel';
    const pet = duel ? undefined : petById(collection.pet);
    wearPet(pet);
    this.companion = pet ? new Companion(this, pet, this.hero.x, this.hero.y) : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.companion?.destroy();
      this.companion = null;
      wearPet(undefined);
    });
    if (this.rift) {
      // The Rift's waves stand in for a spawner, and its overlay shows them.
      this.riftWaves = new RiftWaves(this, this.rift, { hero: () => this.hero, dropGems: (n, x, y) => this.dropGems(n, x, y) }, ch.id, ch.name);
      this.spawners.push(this.riftWaves);
      this.scene.launch('rift');
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        // Left mid-run (Pause, Home): the waves cleared still count for a best.
        this.riftWaves?.end();
        resetRift();
        this.scene.stop('rift');
      });
    } else this.spawners.push(new Spawner(this, arena.monsters, arena.respawn));
    this.scenery = new Scenery(this, arena.scenery(), arena.drift);
    this.net = session.active ? new NetPlay(this) : null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.net?.destroy();
      this.net = null;
      // Left mid-charge: nothing will release it, so the hum stops with the world.
      sound.beamChargeEnd();
    });

    // Screen-fixed; it covers the ground camera's image too, as it draws first.
    this.skyLayer = this.add.image(0, 0, 'clouds').setScrollFactor(0).setDepth(20000).setPipeline('Sky');
    this.setVignette(0.32 - Phaser.Math.Easing.Sine.InOut(this.daylight) * 0.14);
    cam.fadeIn(500, 7, 8, 13);
    // Phaser keeps drawing a finished fade (fully clear) over the whole screen
    // every frame until it is reset: a full-screen layer for nothing.
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => cam.fadeEffect.reset());
    this.fitCamera();
    this.followHero();
    this.ground?.prime(this.view);
    this.showBanner(arena.name);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this));

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => daynight.enabled && daynight.toggle());
    kb.on('keydown-E', () => {
      if (this.inside) this.sanctum?.talk(this.hero.x, this.hero.y);
      else this.chapel?.talk(this.hero.x, this.hero.y);
    });
    // Keys 1 to 9 (top row or keypad) use the hotbar's slots.
    kb.on('keydown', (e: KeyboardEvent) => {
      const n = e.key.length === 1 ? e.key.charCodeAt(0) - 49 : -1;
      if (n >= 0 && n < HOTBAR_SIZE) controls.items.push(n);
    });

    // A fresh hotbar and no buffs each run.
    inventory.reset(STARTING_ITEMS);
    heroBuffs.clear();
    // The six pieces worn on the Inventory page count from the start of every
    // run, and swapping them in the bag mid-run applies at once.
    gear.reset();
    this.rewear();
    this.running = true;
    const unwatchGear = collection.watch(() => this.rewear());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unwatchGear);
    controls.items.length = 0;
    this.itemCtx = {
      hero: this.hero,
      heal: (n) => {
        const got = this.hero.vitals.heal(n);
        const h = this.hero;
        this.debris([0xffffff, 0xffb0b8, 0xff5a6a], snap(h.x), snap(h.y) - 12, 16, h.y + 20, 'spores');
        return got;
      },
      addBuff: (def) => heroBuffs.add(def),
      pop: (text, tint) => this.popNumber(snap(this.hero.x), snap(this.hero.y) - 38, text, tint),
    };
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,K,SHIFT,N') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  castEnergyBall(x: number, y: number, dx: number, dy: number, style?: SpellStyle, kind?: BallKind): void {
    const ball = new EnergyBall(this, x, y, dx, dy, style, kind);
    // Cast by another player's hero online, this is a hit test that strikes nothing (see net/Remote.ts).
    ball.hit = this.hitTest;
    this.balls.push(ball);
    sound.cast(this.pan(x));
  }

  /** A beam from (x, y) along (dx, dy); `depth` sorts it against the caster. */
  fireBeam(x: number, y: number, dx: number, dy: number, power: number, depth: number, style?: SpellStyle): void {
    const strike: Strike = { damage: Math.round(3 + 5 * power), knock: 40 + 40 * power, fromX: x, fromY: y };
    this.beams.push(new Beam(this, x, y, dx, dy, power, this.worldRect, depth, (x0, y0, x1, y1, r) => this.beamHit(x0, y0, x1, y1, r, strike), style));
    sound.beamFire(this.pan(x), power);
  }

  /** Everything the heroes can strike right now. */
  private hurtboxes(): Hurtbox[] {
    const out = this.allHurtboxes();
    if (this.net) out.push(...this.net.foes());
    return out;
  }

  /** The monsters, dummies and flowers standing (not other players). */
  allHurtboxes(): Hurtbox[] {
    const out: Hurtbox[] = [...this.dummies];
    if (this.garden) out.push(...this.garden.hurtboxes());
    for (const sp of this.spawners) for (const m of sp.monsters) if (m.alive) out.push(m);
    return out;
  }

  /** The player's own hero. */
  get player(): Hero {
    return this.hero;
  }

  /** The player's hero has fallen and not yet risen. */
  get heroDown(): boolean {
    return this.downT > 0;
  }

  get spawnerList(): Spawner[] {
    return this.spawners;
  }

  get ultCaster(): UltCaster {
    return this.ult;
  }

  /** Where the hero starts and rises after falling. */
  get spawnPoint(): { x: number; y: number } {
    return { x: this.spawnX, y: this.spawnY };
  }

  /** Start (and rise) somewhere else: online, each player on their own spot. */
  setSpawn(x: number, y: number): void {
    this.spawnX = this.hero.x = x;
    this.spawnY = this.hero.y = y;
  }

  /** A word across the screen, as the arena's name is shown. */
  announce(text: string): void {
    this.showBanner(text);
  }

  /**
   * A blow over an area. Everything whose body falls inside `area` is struck;
   * returns where each blow landed (on the side facing the blow), for sparks
   * and sound. `strike` may be a bare `heavy` flag, which deals a default hit.
   */
  melee(area: MeleeArea, strike: Strike | boolean): { x: number; y: number }[] {
    const s: Strike = typeof strike === 'boolean' ? { damage: strike ? 16 : 10, heavy: strike } : strike;
    const o = areaOrigin(area);
    const hit = this.toHit(s, o.x, o.y);
    const hits: { x: number; y: number }[] = [];
    for (const h of this.hurtboxes()) {
      const at = reachesBody(area, h);
      if (!at) continue;
      const { x: bx, y: by } = at;
      h.hurt(hit);
      const l = Math.hypot(o.x - bx, o.y - by) || 1;
      hits.push({ x: bx + ((o.x - bx) / l) * (h.radius - 1), y: by + ((o.y - by) / l) * (h.radius - 2) });
    }
    return hits;
  }

  /** A projectile at (x, y): strikes the first body there. Returns whether it hit. */
  strikeAt(x: number, y: number, strike: Strike): boolean {
    for (const h of this.hurtboxes()) {
      const dx = (x - h.x) / (h.radius + 2);
      const dy = (y - (h.y - h.bodyY)) / (h.bodyY + 3);
      if (dx * dx + dy * dy > 1) continue;
      h.hurt(this.toHit(strike, x, y));
      return true;
    }
    return false;
  }

  private toHit(s: Strike, x: number, y: number): Hit {
    return { damage: s.damage, heavy: !!s.heavy, knock: s.knock ?? (s.heavy ? 130 : 60), fromX: s.fromX ?? x, fromY: s.fromY ?? y, poison: s.poison, companion: s.companion };
  }

  /** Everything strikeable that passes `test`, for heroes that hurt by other means than a single blow (poison). */
  hurtboxesWhere(test: (h: Hurtbox) => boolean): Hurtbox[] {
    return this.hurtboxes().filter(test);
  }

  /** The first live body that passes `test`, or null. Builds no lists, for checks run many times a frame (arrows in flight). */
  firstHurtbox(test: (h: Hurtbox) => boolean): Hurtbox | null {
    for (const d of this.dummies) if (d.alive && test(d)) return d;
    if (this.garden) for (const f of this.garden.allHurtboxes) if (f.alive && test(f)) return f;
    for (const sp of this.spawners) for (const m of sp.monsters) if (m.alive && test(m)) return m;
    if (this.net) for (const f of this.net.foes()) if (test(f)) return f;
    return null;
  }

  /** A companion mends the hero by `share` of their health, if they are hurt and up; returns the health restored. */
  mendHero(share: number): number {
    const v = this.hero.vitals;
    if (this.downT > 0 || v.hp >= v.max) return 0;
    return v.heal(Math.max(1, Math.round(v.max * share)));
  }

  /** A monster's blow lands on the hero if its reach (a circle at (x, y)) touches the hero's body. */
  hurtHeroAt(x: number, y: number, radius: number, harm: Harm): boolean {
    if (this.downT > 0) return false;
    if (Math.hypot(this.hero.x - x, this.hero.y - HERO_BODY_Y - y) > radius + HERO_RADIUS) return false;
    this.hurtHero(harm);
    return true;
  }

  /** A burst over an ellipse on the ground centred at (x, y). */
  hurtHeroInEllipse(x: number, y: number, rx: number, ry: number, harm: Harm): boolean {
    if (this.downT > 0) return false;
    const dx = (this.hero.x - x) / (rx + HERO_RADIUS - 2);
    const dy = (this.hero.y - y) / (ry + 3);
    if (dx * dx + dy * dy > 1) return false;
    this.hurtHero(harm);
    return true;
  }

  /** Drag the hero toward (x, y) at `speed` px/s (a boss's gravity), never through walls. */
  pullHero(x: number, y: number, speed: number, dt: number): void {
    if (this.downT > 0) return;
    const h = this.hero;
    const dx = x - h.x;
    const dy = y - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return;
    const s = Math.min(d, (speed * dt) / 1000);
    const nx = h.x + (dx / d) * s;
    const ny = h.y + (dy / d) * s;
    if (this.walkable(nx, h.y)) h.x = nx;
    if (this.walkable(h.x, ny)) h.y = ny;
  }

  /** The hero slips out of reach for `ms`: nothing can touch them (a rogue's shadow tricks). */
  evade(ms: number): void {
    this.grace = Math.max(this.grace, ms);
  }

  /** Damage the hero, unless they are down or still in their grace window. */
  hurtHero(harm: Harm): void {
    const h = this.hero;
    if (this.downT > 0 || this.grace > 0) return;
    // A ghost may slip through the blow entirely.
    if (h.dodge?.()) return;
    // The old turtle's ward turns the blow aside.
    if (this.companion?.ward()) {
      this.grace = HURT_GRACE;
      return;
    }
    // A ward takes the edge off every blow.
    const damage = Math.max(1, Math.round(harm.damage * heroBuffs.mod('guard') * defenseFactor(this.stats.defense + gear.totals.armor) * riftMods.guard * petMods.guard * riftMods.fury));
    const lost = h.vitals.damage(damage);
    this.grace = HURT_GRACE;
    this.rising = false;
    this.popNumber(snap(h.x), snap(h.y) - 38, `-${damage}`, lost > 0 ? 0xff8a78 : 0xffd35c);
    this.net?.hurtShown(damage, lost > 0 ? 0xff8a78 : 0xffd35c);
    h.sprite.setTint(0xff8070);
    this.hurtTint = 140;
    const dx = h.x - harm.fromX;
    const dy = h.y - HERO_BODY_Y - harm.fromY;
    const l = Math.hypot(dx, dy) || 1;
    const k = harm.knock ?? 60;
    this.pushX = (dx / l) * k;
    this.pushY = (dy / l) * k;
    this.cameras.main.shake(120, 0.0006);
    sound.hurt();
    if (!h.vitals.alive) {
      // The phoenix chick, once a run, lifts the hero back up at half health instead.
      if (this.companion?.rekindle(h.x, h.y)) {
        h.vitals.heal(Math.ceil(h.vitals.max / 2));
        this.grace = RISE_GRACE;
        this.rising = true;
      } else this.fall();
    }
  }

  private fall(): void {
    const h = this.hero;
    this.downT = DOWN_TIME;
    this.pushX = this.pushY = 0;
    heroBuffs.clear();
    this.ult.cancel();
    // In the Rift, falling ends the run.
    this.riftWaves?.end();
    // Struck down mid-charge: the charge never releases, so its hum is stopped here.
    sound.beamChargeEnd();
    this.debris([0xffffff, 0xdff8ff, 0xb0c8ff], snap(h.x), snap(h.y) - 12, 20, h.y + 20, 'spores');
    this.fallen = this.add.bitmapText(Math.round(h.x), Math.round(h.y) - 40, 'pixel', 'FALLEN').setLetterSpacing(-1).setOrigin(0.5, 1).setTint(0xffb0a0).setDepth(10002).setAlpha(0);
    sound.fall();
  }

  private rise(): void {
    const h = this.hero;
    h.x = this.spawnX;
    h.y = this.spawnY;
    h.vitals.reset();
    this.grace = RISE_GRACE;
    this.rising = true;
    this.fallen?.destroy();
    this.fallen = null;
    this.debris([0xfffdf0, 0xfff0a8, 0xffd35c], snap(h.x), snap(h.y) - 12, 24, h.y + 20, 'spores');
    sound.revive();
  }

  /** The hero's life: falling, rising, hit tint, knockback and the health bar. */
  private updateHeroLife(dt: number): void {
    const h = this.hero;
    this.grace = Math.max(0, this.grace - dt);
    if (this.hurtTint > 0) {
      this.hurtTint -= dt;
      if (this.hurtTint <= 0) h.sprite.clearTint();
    }
    if (this.downT > 0) {
      this.downT -= dt;
      const t = DOWN_TIME - this.downT;
      h.alpha = Math.max(0, 1 - t / 700);
      this.fallen?.setAlpha(Phaser.Math.Clamp((t - 300) / 400, 0, 1)).setPosition(Math.round(h.x), Math.round(h.y) - 40 - Math.min(6, t / 250));
      if (this.downT <= 0) {
        // No rising in the Rift: the run is over, and the hero lies where they fell.
        if (this.riftWaves) this.downT = 1;
        else {
          this.downT = 0;
          this.rise();
        }
      }
    } else if (this.rising && this.grace > 0) {
      // Blinks while the grace after rising lasts.
      h.alpha = Math.sin(this.grace * 0.03) > -0.3 ? 1 : 0.35;
    } else {
      h.alpha = 1;
    }
    if (this.pushX || this.pushY) {
      // Knocked back, but never into a tree or through the forest's edge.
      const nx = h.x + (this.pushX * dt) / 1000;
      const ny = h.y + (this.pushY * dt) / 1000;
      if (this.walkable(nx, h.y)) h.x = nx;
      else this.pushX = 0;
      if (this.walkable(h.x, ny)) h.y = ny;
      else this.pushY = 0;
      const k = Math.exp(-dt / 80);
      this.pushX *= k;
      this.pushY *= k;
      if (Math.abs(this.pushX) + Math.abs(this.pushY) < 2) this.pushX = this.pushY = 0;
    }
    const v = h.vitals;
    this.heroBar.update(dt, snap(h.x), snap(h.y) - 34, this.downT > 0 ? 0 : v.hp, v.max, v.barrier);
  }

  /**
   * A monster fell at (x, y): its energy flies to the hero for the Special
   * (a boss's a great deal of it), and sometimes it leaves a potion or a piece
   * of gear, popping out of its body.
   */
  monsterSlain(kind: string, x: number, y: number, bodyY: number, stats?: Pick<MonsterStats, 'hp' | 'rank'>): void {
    if (stats && this.downT <= 0) this.addEffect(new EnergyMotes(this, x, y - bodyY, this.hero, energyFor(stats.hp, stats.rank) * riftMods.energy * petMods.energy, this.ult.ult.pal));
    const id = rollDrop(kind);
    if (id) this.pickups.push(new Pickup(this, x, y - bodyY, { kind: 'item', id }));
    for (const def of gear.roll(kind)) this.dropGear(def, x, y - bodyY);
    const gems = rollGems(kind, petMods.luck);
    if (gems) this.dropGems(gems, x, y - bodyY);
  }

  /**
   * Gems fall: one glints down with a chime; a few rise in a pillar of cyan
   * light; five or more fall like a star, and a hoard of ten or more strikes
   * with a prism of rays, rings racing out and the ground shaking.
   */
  dropGems(n: number, x: number, y: number): void {
    const p = new Pickup(this, x, y, { kind: 'gems', n });
    this.pickups.push(p);
    if (n >= 5) sound.lootFall(this.pan(p.x));
    p.onLand = (at) => {
      sound.gemLand(n, this.pan(at.x));
      const shards = [0xffffff, 0x9ff6ff, 0x5ae8ff, 0xff7ae6];
      this.debris(shards, snap(at.x), snap(at.y) - 6, Math.min(60, 8 + n * 3), at.y + 20, 'burst');
      if (n < 2) return;
      this.debris(shards, snap(at.x), snap(at.y) - 4, Math.min(30, 4 + n * 2), at.y + 20, 'spores');
      if (n >= 5) {
        this.cameras.main.shake(n >= 10 ? 260 : 160, n >= 10 ? 0.0022 : 0.0014);
        this.popNumber(snap(at.x), snap(at.y) - 30, n >= 10 ? 'GEM HOARD!' : 'GEMS!', 0x9ff6ff);
      }
    };
  }

  /** Gems were picked up: they're the player's for good, and burst about the hero in a shower of light, bigger the more there were. */
  private gainGems(n: number): void {
    collection.addGems(n);
    this.companion?.cheer();
    const h = this.hero;
    const hx = snap(h.x);
    const hy = snap(h.y);
    this.popNumber(hx, hy - 40, `+${n} ${n === 1 ? 'GEM' : 'GEMS'}`, 0x9ff6ff);
    const shards = [0xffffff, 0x9ff6ff, 0x5ae8ff, 0xff7ae6];
    this.debris(shards, hx, hy - 12, Math.min(70, 12 + n * 4), h.y + 20, 'burst');
    this.debris(shards, hx, hy - 10, Math.min(40, 6 + n * 2), h.y + 20, 'spores');
    if (n >= 2) this.addEffect(new LootFlare(this, hx, hy, null, n >= 5, 0x5ae8ff, 0xeaffff));
    if (n >= 10) this.cameras.main.shake(140, 0.001);
    sound.gemPickup(n);
  }

  /**
   * A piece of gear falls: rare and better ones make a show of landing (see
   * Pickup), and the world answers with sound, sparks and, for a legendary,
   * a jolt and its name.
   */
  private dropGear(def: GearDef, x: number, y: number): void {
    const p = new Pickup(this, x, y, { kind: 'gear', def });
    this.pickups.push(p);
    const g = p.grade;
    if (g < 2) return;
    if (g >= 4) sound.lootFall(this.pan(p.x));
    const tint = RARITY[def.rarity].tint;
    p.onLand = (at) => {
      sound.lootLand(g, this.pan(at.x));
      if (g < 3) return;
      const accent = def.set ? GEAR_SETS[def.set].tint : tint;
      this.debris([0xffffff, accent], snap(at.x), snap(at.y) - 6, g >= 4 ? 28 : 14, at.y + 20, 'burst');
      this.debris([0xffffff, accent], snap(at.x), snap(at.y) - 4, g >= 4 ? 14 : 8, at.y + 20, 'spores');
      if (g >= 4) {
        this.cameras.main.shake(160, 0.0014);
        this.popNumber(snap(at.x), snap(at.y) - 30, 'LEGENDARY', accent);
      }
    };
  }

  /** Put on what the collection has equipped; max health follows the gear's. */
  private rewear(): void {
    const d = gear.wear(collection.equippedGear());
    for (const k of Object.keys(SET_AURA) as SetId[]) this.setAura(k, gear.sets.includes(k));
    if (!d) return;
    const v = this.hero.vitals;
    if (v.alive) v.grow(d);
    else v.max += d;
  }

  /**
   * A whole set worn: the hero takes on its form (the Wraithbound's spectral
   * glow and soul-light, the Emberborn's living flame). Its stats come with
   * the gear's totals.
   */
  private setAura(set: SetId, on: boolean): void {
    const had = this.auras.get(set);
    if (on === !!had) return;
    if (had) {
      had.halo.destroy();
      had.motes.destroy();
      this.auras.delete(set);
      return;
    }
    const a = SET_AURA[set];
    const halo = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(a.tint).setScale(1.1, 0.55).setAlpha(0.3);
    const motes = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-7, -26, 14, 26) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: a.life,
      speedY: a.rise,
      speedX: { min: -4, max: 4 },
      scale: a.scale,
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.85 },
      tint: a.motes,
      blendMode: Phaser.BlendModes.ADD,
      frequency: a.every,
    });
    this.auras.set(set, { halo, motes });
    // Put on mid-run: say so.
    if (this.running) {
      const h = this.hero;
      this.popNumber(snap(h.x), snap(h.y) - 40, a.name, a.text);
      this.debris(a.motes, snap(h.x), snap(h.y) - 12, 26, h.y + 20, 'spores');
    }
  }

  /** The set auras' glow and motes follow the hero; the flame flickers, the spectral glow breathes. */
  private updateSetAuras(time: number): void {
    if (!this.auras.size) return;
    const h = this.hero;
    const down = this.downT > 0;
    for (const [k, w] of this.auras) {
      const pulse = k === 'ember' ? Math.sin(time * 0.013) * 0.05 + Math.sin(time * 0.031) * 0.04 : Math.sin(time * 0.004) * 0.08;
      w.halo.setPosition(snap(h.x), snap(h.y) - 3).setDepth(h.y - 0.5).setAlpha(down ? 0 : 0.26 + pulse);
      w.motes.setPosition(snap(h.x), snap(h.y)).setDepth(h.y + 1);
      w.motes.emitting = !down;
    }
  }

  /** A piece of gear was picked up: it's kept for good (a spare if they had one), and worn straight away if its slot is empty. */
  private gainGear(def: GearDef): void {
    const slot = slotIndex(def.id);
    const worn = !collection.data.equipped[slot] && collection.equip(def.id);
    gear.pick(def, worn, collection.count(def.id) > 1);
    const h = this.hero;
    const tint = RARITY[def.rarity].tint;
    this.popNumber(snap(h.x), snap(h.y) - 40, def.name.toUpperCase(), tint);
    this.debris([0xffffff, tint], snap(h.x), snap(h.y) - 12, def.rarity === 'legendary' ? 26 : 16, h.y + 20, 'burst');
    if (def.rarity === 'epic' || def.rarity === 'legendary') this.addEffect(new LootFlare(this, snap(h.x), snap(h.y), def));
    if (def.rarity === 'legendary') this.cameras.main.shake(90, 0.0008);
    sound.gear(def.rarity === 'legendary' || def.rarity === 'epic');
  }

  /** The hero's blow dealt `damage`: lifesteal from gear heals a share of it. */
  leech(damage: number): void {
    const k = gear.totals.leech + riftMods.leech;
    if (k <= 0 || this.downT > 0) return;
    this.regenAcc += damage * k;
  }

  /** Use the items asked for this frame, then tick cooldowns, buffs and what lies on the ground. */
  private updateItems(dt: number): void {
    const h = this.hero;
    for (const i of controls.items) {
      if (this.downT > 0) break;
      const used = inventory.use(i, this.itemCtx);
      if (!used) continue;
      const swift = used.id === 'speed';
      sound.drink(swift);
      if (swift) this.debris([0xffffff, 0x9cecff, 0x36c2f2], snap(h.x), snap(h.y) - 12, 18, h.y + 20, 'burst');
    }
    controls.items.length = 0;
    inventory.update(dt);
    heroBuffs.update(dt);

    const down = this.downT > 0;
    for (const p of this.pickups) {
      const loot = p.loot;
      const room = loot.kind === 'item' ? inventory.canTake(loot.id) : true;
      if (!p.update(dt, down ? null : h.x, down ? null : h.y, room, this.daylight)) continue;
      if (loot.kind === 'gems') {
        this.gainGems(loot.n);
        p.destroy();
        continue;
      }
      collection.add(loot.kind === 'item' ? loot.id : loot.def.id);
      if (loot.kind === 'item') {
        inventory.add(loot.id);
        sound.pickup(this.pan(p.x));
        this.debris([0xffffff, 0xfff0a8], snap(p.x), snap(p.y) - 6, 8, p.y + 20, 'spores');
      } else this.gainGear(loot.def);
      p.destroy();
    }
    this.pickups = this.pickups.filter((p) => !p.dead);

    // Swiftness leaves a faint trail of blue specks at the hero's heels while they move.
    const buff = heroBuffs.active.find((b) => b.def.mods.speed);
    if (buff && !down) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 55;
        this.debris([0xffffff, 0x9cecff, 0x36c2f2], snap(h.x), snap(h.y) - 4 - Math.random() * 10, 1, h.y - 1, 'trail');
      }
    }

    // The other buffs glow about the hero: specks of their colour drifting up.
    const glowing = heroBuffs.active.filter((b) => !b.def.mods.speed);
    if (glowing.length && !down) {
      this.auraT -= dt;
      if (this.auraT <= 0) {
        this.auraT = 170;
        const b = glowing[Math.floor(Math.random() * glowing.length)];
        this.debris([0xffffff, b.def.tint], snap(h.x + (Math.random() - 0.5) * 12), snap(h.y) - 2 - Math.random() * 16, 1, h.y + 1, 'spores');
      }
    }

    // Renew, gear and lifesteal: healing a little at a time, counted up above the head once a second.
    const regen = this.stats.regen + heroBuffs.regen + gear.totals.regen + riftMods.regen + petMods.regen;
    if (down || h.vitals.hp >= h.vitals.max) this.regenAcc = 0;
    else {
      this.regenAcc += (regen * dt) / 1000;
      const whole = Math.floor(this.regenAcc);
      if (whole > 0) {
        this.regenAcc -= whole;
        this.regenShown += h.vitals.heal(whole);
      }
    }
    this.regenT -= dt;
    if (this.regenT <= 0) {
      this.regenT = 1000;
      // A hero's own slow mending (a point now and then) goes unannounced; more than that is counted up.
      if (this.regenShown > 1) this.popNumber(snap(h.x), snap(h.y) - 38, `+${this.regenShown}`, 0x9dff9a);
      this.regenShown = 0;
    }
  }

  /**
   * How hard the hero's blows land: its Damage (every blow in its code is
   * scaled so its basic attack deals exactly that), more under Might, and with gear.
   */
  get might(): number {
    return damageScale(this.stats) * heroBuffs.mod('damage') * gear.power * riftMods.damage * petMods.damage;
  }

  /** How hard `hit` lands: a companion's blows keep their own numbers, whatever the hero's Damage. */
  mightOf(hit: Hit): number {
    return hit.companion ? this.might / damageScale(this.stats) : this.might;
  }

  /** A buff was just picked up: its name over the hero, and a burst of its colour. */
  buffGained(def: BuffDef): void {
    const h = this.hero;
    this.popNumber(snap(h.x), snap(h.y) - 40, def.name.toUpperCase(), def.tint);
    this.debris([0xffffff, def.tint], snap(h.x), snap(h.y) - 12, 20, h.y + 20, 'burst');
  }

  /** Give a sun shadow to the world, which fades it with the light. */
  addShadow<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(obj: T): T {
    this.shadows.push(obj);
    return obj;
  }

  /**
   * A light that breathes slowly, with a soft halo: `day` is how much of it
   * survives in daylight.
   */
  glowLight(x: number, y: number, radius: number, color: number, intensity: number, day: number, haloTint: number, haloScale: number): void {
    const halo = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(haloTint).setScale(haloScale).setDepth(y + 60).setAlpha(0.45);
    const light = this.lights.addLight(x, y, radius, color, intensity);
    this.flickers.push({ light, halo, base: intensity, radius, seed: -1, day, haloBase: 0.45 });
  }

  /**
   * The hero stepped from (x0, y0) to where they stand now. A step into a
   * wall, a tree or water glances off it: it is turned a little at a time,
   * either way, until it finds ground, keeping only the part of it along the
   * new way. So they glide along a jagged or curving edge, slowing the more
   * squarely they walk into it, instead of catching on every corner of its
   * pixels. A long jump (a blink, a dash) is held to the room around them.
   */
  private settleStep(x0: number, y0: number, room: Phaser.Geom.Rectangle): void {
    const h = this.hero;
    const dx = h.x - x0;
    const dy = h.y - y0;
    const len = Math.hypot(dx, dy);
    // Clear ground at the end and halfway (so a quick dash can't slip through a thin wall).
    const clear = (x: number, y: number) => this.walkable(x, y) && (len <= 3 || this.walkable((x0 + x) / 2, (y0 + y) / 2));
    // A clear step, or already stuck inside something: let them walk (out).
    if (len === 0 || clear(h.x, h.y) || !this.walkable(x0, y0)) return;
    if (len <= SLIDE_MAX_STEP) {
      const a = Math.atan2(dy, dx);
      for (let turn = SLIDE_TURN_STEP; turn <= SLIDE_MAX_TURN; turn += SLIDE_TURN_STEP) {
        const k = len * Math.cos(turn);
        // The way it slid last is tried first, so it doesn't flicker between the two at a corner.
        for (const side of [this.slideSide, -this.slideSide]) {
          const b = a + side * turn;
          const nx = x0 + Math.cos(b) * k;
          const ny = y0 + Math.sin(b) * k;
          if (!clear(nx, ny)) continue;
          h.x = nx;
          h.y = ny;
          this.slideSide = side;
          return;
        }
      }
    }
    // Walked square into it, or jumped: as far as the room allows, one way at a time.
    const nx = Phaser.Math.Clamp(h.x, room.left, room.right);
    const ny = Phaser.Math.Clamp(h.y, room.top, room.bottom);
    h.x = x0;
    h.y = y0;
    if (this.walkable(nx, y0)) h.x = nx;
    if (this.walkable(h.x, ny)) h.y = ny;
  }

  /**
   * Stretch the step the hero just took by `extra` of itself (speed buffs),
   * within the room around them and never into a tree.
   */
  private stretchStep(x0: number, y0: number, extra: number, room: Phaser.Geom.Rectangle): void {
    const h = this.hero;
    // A blink or a rewind is no step to stretch.
    if (Math.hypot(h.x - x0, h.y - y0) > 8) return;
    const nx = Phaser.Math.Clamp(h.x + (h.x - x0) * extra, room.left, room.right);
    const ny = Phaser.Math.Clamp(h.y + (h.y - y0) * extra, room.top, room.bottom);
    if (this.walkable(nx, h.y)) h.x = nx;
    if (this.walkable(h.x, ny)) h.y = ny;
  }

  /** A number (or word) that floats up and fades: damage dealt and taken. */
  popNumber(x: number, y: number, text: string, tint: number): void {
    this.effects.push(new HealPop(this, x + Math.round((Math.random() - 0.5) * 6), y, text, tint));
  }

  /** Let the world update an effect each frame until it is dead. */
  addEffect(e: Effect): void {
    this.effects.push(e);
  }

  /**
   * A burst of light specks, from one shared emitter per palette and style:
   * 'burst' flies apart, 'spores' drifts up slowly, 'trail' barely moves,
   * 'gather' fades in and out in place.
   */
  debris(tints: number[], x: number, y: number, count: number, depth: number, style: 'burst' | 'spores' | 'trail' | 'gather' = 'burst'): void {
    const key = `${style}:${tints.join()}`;
    let e = this.debrisEmitters.get(key);
    if (!e) {
      const base = { tint: tints, blendMode: Phaser.BlendModes.ADD, emitting: false };
      const cfg: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
        burst: { ...base, lifespan: { min: 250, max: 600 }, speed: { min: 20, max: 70 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 } },
        spores: { ...base, lifespan: { min: 700, max: 1300 }, speed: { min: 10, max: 42 }, gravityY: -18, scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 } },
        trail: { ...base, lifespan: { min: 200, max: 420 }, speed: { min: 2, max: 10 }, scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 } },
        gather: { ...base, lifespan: 260, speed: { min: 2, max: 8 }, scale: 0.5, alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) } },
      };
      e = this.add.particles(0, 0, 'spark', cfg[style]);
      this.debrisEmitters.set(key, e);
    }
    e.setDepth(depth).explode(count, x, y);
  }
  /**
   * Keep the camera locked on the hero, snapped to device pixels. The
   * hero snaps to the same grid, so they hold still on screen and stays
   * crisp, while the world scrolls in smooth sub-art-pixel steps.
   *
   * The ground camera can only scroll in whole art pixels, so it takes the
   * whole part and its image is shifted by the device pixels left over.
   */
  private followHero(): void {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const halfW = cam.width / 2;
    const halfH = cam.height / 2;
    const viewW = cam.width / z;
    const viewH = cam.height / z;
    // Scroll is measured to the unzoomed viewport's top-left; zoom pivots on its centre.
    const r = this.camRect;
    const minX = r.x + viewW / 2 - halfW;
    const maxX = r.right - viewW / 2 - halfW;
    const minY = r.y + viewH / 2 - halfH;
    const maxY = r.bottom - viewH / 2 - halfH;
    const tx = this.hero.x + this.lean.x - halfW;
    const ty = this.hero.y - 12 + this.lean.y - halfH;
    const sx = maxX < minX ? (minX + maxX) / 2 : Phaser.Math.Clamp(tx, minX, maxX);
    const sy = maxY < minY ? (minY + maxY) / 2 : Phaser.Math.Clamp(ty, minY, maxY);
    // Screen x = (worldX - scroll) * z + half * (1 - z). Choose scroll so the
    // constant part lands on a whole device pixel: scroll = (k + c) / z.
    const cx = halfW * (1 - z);
    const cy = halfH * (1 - z);
    // A shake moves the whole view, ground and props alike, by whole device
    // pixels. Phaser would only shift the main camera's image, by fractions.
    const shake = cam.shakeEffect as unknown as { isRunning: boolean; _offsetX: number; _offsetY: number };
    let dx = 0;
    let dy = 0;
    if (shake.isRunning) {
      dx = Math.round(shake._offsetX * z);
      dy = Math.round(shake._offsetY * z);
      shake._offsetX = 0;
      shake._offsetY = 0;
    }
    const kx = Math.round(sx * z - cx) - dx;
    const ky = Math.round(sy * z - cy) - dy;
    cam.scrollX = (kx + cx) / z;
    cam.scrollY = (ky + cy) / z;
    const ax = Math.floor(kx / z);
    const ay = Math.floor(ky / z);
    this.groundCam.scrollX = ax + cx / z;
    this.groundCam.scrollY = ay + cy / z;
    this.pixels.offsetX = kx - ax * z;
    this.pixels.offsetY = ky - ay * z;
    // Scroll is to the unzoomed viewport's top-left, and the zoom pivots on its centre.
    this.view.setTo(cam.scrollX + halfW - viewW / 2, cam.scrollY + halfH - viewH / 2, viewW, viewH);
  }

  /**
   * Layers the profiler's GPU test turns off one at a time: each entry hides
   * its layer and returns the function that brings it back.
   */
  benchLayers(): [string, () => () => void][] {
    const hide = (o: { visible: boolean; setVisible(v: boolean): unknown }) => () => {
      const was = o.visible;
      o.setVisible(false);
      return () => o.setVisible(was);
    };
    const unlit = () => {
      type Piped = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Pipeline;
      const lit = this.children.list.filter((o): o is Piped => (o as Partial<Piped>).pipeline?.name === 'Lit');
      for (const o of lit) o.resetPipeline();
      return () => {
        for (const o of lit) if (o.active) o.setPipeline('Lit');
      };
    };
    const ui = () => {
      this.scene.setVisible(false, 'ui');
      return () => this.scene.setVisible(true, 'ui');
    };
    return [
      ['SKY', hide(this.skyLayer)],
      ['LIGHTING', unlit],
      ['GROUND', hide(this.groundCam)],
      ['SPRITES', hide(this.cameras.main)],
      ['HUD', ui],
    ];
  }

  private fitCamera(): void {
    const { width, height } = this.scale;
    // Set with the canvas size: whole device pixels per art pixel.
    const zoom = pixelGrid.zoom;
    this.pixels.zoom = zoom;
    // We snap to device pixels ourselves; Phaser's rounding would snap the
    // camera to whole art pixels, which makes scrolling steppy.
    this.cameras.main.setZoom(zoom).setRoundPixels(false);
    this.groundCam.setSize(width, height).setZoom(zoom);
    this.fitSky();
  }

  /** Cover the screen. The zoom pivots on the camera's centre, which is where a scroll-fixed object sits. */
  private fitSky(): void {
    const { width, height } = this.scale;
    const zoom = pixelGrid.zoom;
    this.skyLayer.setPosition(width / 2, height / 2).setDisplaySize(width / zoom, height / zoom);
  }

  /** Vignette strength, as Phaser's vignette effect; drawn by SkyPipeline. */
  private setVignette(strength: number): void {
    skyState.vignette = strength;
  }

  brazier(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'shadow_big').setDepth(1).setAlpha(0.8);
    this.add.sprite(x, y, 'brazier', 'f0').setOrigin(0.5, 25 / 26).setPipeline('Lit').setDepth(y);
    this.shadows.push(sunShadow(this.add.image(x, y, 'brazier_s', 'f0').setOrigin(0.5, 25 / 26)));
    this.add.sprite(x, y, 'brazier_e', 'f0').setOrigin(0.5, 25 / 26).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1).play({ key: 'brazier_burn', startFrame: Math.floor(Math.random() * 4) });
    const halo = this.add.image(x, y - 17, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a2a).setScale(2.2).setDepth(y + 0.2).setAlpha(0.55);
    const light = this.lights.addLight(x, y - 16, 140, 0xff9444, 2.0);
    this.flickers.push({ light, halo, base: 2.0, radius: 140, seed: Math.random() * 100, day: 0.3, haloBase: 0.55 });
  }

  crystals(x: number, y: number, frame: string): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'crystals', frame).setOrigin(0.5, 20 / 22).setPipeline('Lit').setDepth(y);
    this.shadows.push(sunShadow(this.add.image(x, y, 'crystals_s', frame).setOrigin(0.5, 20 / 22)));
    this.add.image(x, y, 'crystals_e', frame).setOrigin(0.5, 20 / 22).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1);
    const halo = this.add.image(x, y - 9, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a55f0).setScale(1.6).setDepth(y + 0.2).setAlpha(0.45);
    const light = this.lights.addLight(x, y - 10, 100, 0x9a6cff, 1.6);
    this.flickers.push({ light, halo, base: 1.6, radius: 100, seed: -1, day: 0.45, haloBase: 0.45 });
  }

  private dummy(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.add.image(x, y, 'shadow').setDepth(1);
    const sprite = this.add.sprite(x, y, 'dummy', 'd0').setOrigin(0.5, 26 / 28).setPipeline('Lit').setDepth(y);
    this.shadows.push(sunShadow(this.add.image(x, y, 'dummy_s', 'd0').setOrigin(0.5, 26 / 28)));
    this.dummies.push(new Dummy(this, sprite, x, y));
  }

  /** The energy ball's hit test. */
  private hitTest = (x: number, y: number): boolean => {
    if (!this.strikeAt(x, y, { damage: 12, knock: 80 })) return false;
    this.cameras.main.shake(70, 0.00035);
    this.struck = true;
    return true;
  };

  /** Everything within `radius` of the beam's line takes a hit and throws off a burst of light. */
  private beamHit(x0: number, y0: number, x1: number, y1: number, radius: number, strike: Strike): void {
    for (const p of this.melee({ kind: 'line', x0, y0, x1, y1, radius }, strike)) {
      const burst = this.add
        .sprite(Math.round(p.x), Math.round(p.y), 'burst_e', 'b0')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(p.y + 12)
        .play('burst_pop');
      burst.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => burst.destroy());
    }
  }

  /** Through the Rune Temple's door: fade out, step in (or out), fade back in with the camera on the new side. */
  private passDoor(enter: boolean): void {
    this.doorBusy = true;
    const cam = this.cameras.main;
    sound.gear(false);
    cam.fadeOut(200, 7, 8, 13);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const spot = enter ? INSIDE_SPOT : OUTSIDE_SPOT;
      this.hero.x = spot.x;
      this.hero.y = spot.y;
      this.facing = { x: 0, y: enter ? -1 : 1 };
      this.inside = enter;
      if (enter) this.camRect.setTo(roomRect.x, roomRect.y, roomRect.w, roomRect.h);
      else this.camRect.setTo(0, 0, this.arena.ground.w, this.arena.ground.h);
      sound.setOutdoors(!enter);
      this.followHero();
      this.ground?.prime(this.view);
      if (enter) this.showBanner('Rune Temple');
      cam.fadeIn(280, 7, 8, 13);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        cam.fadeEffect.reset();
        this.doorBusy = false;
      });
    });
  }

  /** Ease toward the chosen time of day and push it into every layer. */
  private updateDaylight(time: number, dt: number): number {
    if (this.arena.dayNight) {
      const step = dt / 1400;
      daynight.daylight += Phaser.Math.Clamp(daynight.target - daynight.daylight, -step, step);
      this.daylight = daynight.daylight;
    }
    // Inside the Rune Temple the lamps hold a dusk, lifted a little by the day outside.
    const outside = Phaser.Math.Easing.Sine.InOut(this.daylight);
    const d = this.inside ? INDOOR_DUSK + outside * INDOOR_DAY : outside;

    sky.sunDir = mix3(NIGHT.sunDir, DAY.sunDir, d);
    sky.sunColor = mix3(NIGHT.sun, DAY.sun, d);
    sky.sky = mix3(NIGHT.sky, DAY.sky, d);
    sky.bounce = mix3(NIGHT.bounce, DAY.bounce, d);

    this.ground?.setLight(d, 0.9 - d * 0.6);
    skyState.clouds = this.inside ? 0 : d;
    skyState.tileX = time * 0.004;
    skyState.tileY = time * 0.0022;
    this.shafts?.setAlpha(d * (0.1 + Math.sin(time * 0.0007) * 0.03));
    for (const s of this.shadows) s.setAlpha(SUN_SHADOW_ALPHA * d);
    this.setVignette(0.32 - d * 0.14);
    // Out in the void and down in the dungeon there is neither pollen nor fireflies (they have their own motes).
    const open = !this.cosmos && !this.rift && !this.spirit && !this.temple && !this.deep && !this.inside;
    this.pollen.emitting = open && d > 0.5;
    this.fireflies.emitting = open && d < 0.5;
    sound.setDaylight(d);
    return d;
  }

  /** The arena's name, shown as the run begins, stays put on screen. */
  private updateBanner(): void {
    this.banner?.setPosition(Math.round(this.view.centerX), Math.round(this.view.y + this.view.height * 0.2));
  }

  private showBanner(name: string): void {
    this.banner?.destroy();
    const text = this.add.bitmapText(0, 0, 'pixel', name.toUpperCase()).setLetterSpacing(-1).setScale(2).setOrigin(0.5).setTint(0xfff0c8).setDepth(10003).setAlpha(0);
    this.banner = text;
    this.tweens.chain({
      targets: text,
      tweens: [
        { alpha: 1, duration: 700, ease: 'Sine.Out' },
        { alpha: 1, duration: 1800 },
        { alpha: 0, duration: 900, ease: 'Sine.In' },
      ],
      onComplete: () => {
        text.destroy();
        if (this.banner === text) this.banner = null;
      },
    });
  }

  /** Stereo position of a world x on screen, -1..1. */
  pan(x: number): number {
    const cam = this.cameras.main;
    return Phaser.Math.Clamp((x - cam.midPoint.x) / (cam.worldView.width / 2), -1, 1);
  }

  /** How loud the braziers' crackle should be where the hero stands. */
  private fireNearby(): number {
    let near = Infinity;
    for (const f of this.flickers) {
      if (f.seed >= 0) near = Math.min(near, Phaser.Math.Distance.Between(f.light.x, f.light.y, this.hero.x, this.hero.y));
    }
    // No fire in this arena: no crackle.
    if (near === Infinity) return 0;
    const k = Phaser.Math.Clamp(1 - (near - 16) / 150, 0, 1);
    return 0.12 + 0.88 * k * k;
  }

  /**
   * A boss stands four heroes tall, so while it fights the camera leans part
   * of the way toward its heart, keeping it in view, and eases back after.
   */
  private leanToBoss(dt: number, monsters: Monster[]): void {
    let gx = 0;
    let gy = 0;
    const boss = this.downT > 0 ? null : monsters.find((m) => m.boss && m.alive && m.state !== 'idle' && m.state !== 'wander');
    if (boss) {
      gx = Phaser.Math.Clamp((boss.x - this.hero.x) * 0.3, -50, 50);
      gy = Phaser.Math.Clamp((boss.y - 60 - this.hero.y) * 0.35, -60, 30);
    }
    const k = 1 - Math.exp(-dt / 450);
    this.lean.x += (gx - this.lean.x) * k;
    this.lean.y += (gy - this.lean.y) * k;
  }

  /** The ability buttons held last frame, so a press is noted once as it starts. */
  private held = { attack: false, special: false };

  /** Crash reports list what was pressed last (see diagnostics): each press as it starts, not every frame it is held. */
  private noteInputs(attack: boolean, special: boolean, ult: boolean): void {
    if (attack && !this.held.attack) note(`attack${controls.mouse ? '' : ' (touch)'}`);
    if (special && !this.held.special) note(`ability${controls.mouse ? '' : ' (touch)'}`);
    if (ult) note(`special${energy.ready ? '' : ' (not enough energy)'}`);
    this.held.attack = attack;
    this.held.special = special;
  }

  /** Unit vector from the hero's chest towards the mouse, in the world. */
  private mouseAim(): Aim | null {
    const p = this.input.mousePointer;
    // No mouse event yet (time 0): the pointer sits at the corner, not where the player is looking.
    if (!p || p.time === 0) return null;
    const w = p.positionToCamera(this.cameras.main, this.mouseWorld) as Phaser.Math.Vector2;
    const dx = w.x - this.hero.x;
    const dy = w.y - (this.hero.y - 14);
    const l = Math.hypot(dx, dy);
    return l < 1 ? null : { x: dx / l, y: dy / l, dist: l };
  }

  /**
   * Touch aim: the way the button is dragged, or else at the nearest enemy in
   * reach (null when there is none: the hero goes the way it last walked).
   */
  private touchAim(drag: { x: number; y: number } | null): Aim | null {
    if (drag) return { x: drag.x, y: drag.y };
    const cx = this.hero.x;
    const cy = this.hero.y - 14;
    let best: Hurtbox | null = null;
    let bestD = AUTO_AIM_RANGE;
    const consider = (h: Hurtbox) => {
      if (!h.alive) return;
      const d = Math.hypot(h.x - cx, h.y - h.bodyY - cy);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    };
    for (const sp of this.spawners) for (const m of sp.monsters) consider(m);
    for (const d of this.dummies) consider(d);
    if (this.net) for (const f of this.net.foes()) consider(f);
    const t = best as Hurtbox | null;
    if (!t || bestD < 1) return null;
    return { x: (t.x - cx) / bestD, y: (t.y - t.bodyY - cy) / bestD, dist: bestD };
  }

  /** Where the abilities go this frame (see Hero.update), and whether the hero should face it. */
  private heroAim(dt: number, attack: boolean, special: boolean): Aim | null {
    let aim: Aim | null;
    if (controls.mouse) aim = this.mouseAim();
    else if (controls.beam || controls.beamTap) aim = this.touchAim(controls.beamAim);
    else if (controls.attack || controls.attackTap) aim = this.touchAim(controls.attackAim);
    else aim = this.lookT > 0 ? this.lastAim : null;
    if (attack || special) {
      this.lookT = LOOK_LINGER;
      this.lastAim = aim;
    } else this.lookT = Math.max(0, this.lookT - dt);
    return aim && { ...aim, look: this.lookT > 0 };
  }

  /** A dotted line with an arrowhead from the hero the way a touch button is dragged; hidden when not aiming. */
  private drawAimLine(): void {
    const a = controls.aiming;
    const u = a && !controls.mouse && this.downT <= 0 && !a.cancel ? (a.ult ? controls.ultAim : a.special ? controls.beamAim : controls.attackAim) : null;
    if (!u) {
      if (this.aimShown) this.aimLine.clear().setVisible(false);
      this.aimShown = false;
      return;
    }
    this.aimShown = true;
    const g = this.aimLine.clear().setVisible(true);
    const col = a!.ult ? this.ult.ult.pal.hot : a!.special ? 0xffd66b : 0x9ff6ff;
    const cx = snap(this.hero.x);
    const cy = snap(this.hero.y) - 12;
    const len = 52;
    for (let d = 12; d < len; d += 6) {
      g.fillStyle(col, 0.35 + (0.4 * (d - 12)) / len);
      g.fillRect(Math.round(cx + u.x * d) - 1, Math.round(cy + u.y * d) - 1, 2, 2);
    }
    // The arrowhead: two short strokes swept back from the tip.
    const tx = cx + u.x * (len + 4);
    const ty = cy + u.y * (len + 4);
    g.fillStyle(col, 0.85);
    for (const side of [-1, 1]) {
      const bx = -u.x * 0.7 + -u.y * side * 0.7;
      const by = -u.y * 0.7 + u.x * side * 0.7;
      for (let i = 0; i <= 4; i += 2) g.fillRect(Math.round(tx + bx * i) - 1, Math.round(ty + by * i) - 1, 2, 2);
    }
  }

  update(time: number, dt: number): void {
    const k = this.keys;
    let mx = controls.moveX;
    let my = controls.moveY;
    const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const ky = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      mx = kx / l;
      my = ky / l;
    }
    if (mx || my) {
      const l = Math.hypot(mx, my);
      if (l > 0.18) this.facing = { x: mx / l, y: my / l };
    }
    // On a computer: WASD to walk, left click to attack, right click for the special, Space for the Special.
    let attack = controls.attack || controls.attackTap || controls.click || k.J.isDown;
    let special = controls.beam || controls.beamTap || controls.rightClick || k.K.isDown || k.SHIFT.isDown;
    let ultPressed = controls.ultTap || Phaser.Input.Keyboard.JustDown(k.SPACE);
    controls.ultTap = false;
    // Online the world keeps going while the menu is open; the hero just stands.
    if (session.paused) {
      mx = my = 0;
      attack = special = ultPressed = false;
    }
    this.noteInputs(attack, special, ultPressed);
    if (ultPressed && this.downT <= 0) this.ult.request(controls.mouse ? this.mouseAim() : this.touchAim(controls.ultAim), this.facing);
    // Gathering power for the Special: other abilities wait, and the feet stay planted.
    if (this.ult.holding) attack = special = false;
    if (this.ult.rooted) mx = my = 0;
    if (this.downT > 0) {
      mx = my = 0;
      attack = special = false;
    }
    this.hero.daylight = this.daylight;
    // The room around the hero, straight out each way: a blink or a dash that
    // ends in a tree is held to it (see settleStep). Walking steps within the
    // world's edge and glances off whatever it meets.
    const hb = this.heroBox;
    freeBox(this.walkable, this.hero.x, this.hero.y, 14, hb);
    const x0 = this.hero.x;
    const y0 = this.hero.y;
    const aim = this.ult.rooted ? null : this.heroAim(dt, attack, special);
    this.hero.update(dt, mx, my, attack, special, this.bounds, aim);
    this.settleStep(x0, y0, hb);
    this.net?.record(mx, my, attack, special, aim);
    this.ult.update(dt);
    energy.update(dt);
    // Taps press for one frame.
    controls.attackTap = controls.beamTap = false;
    this.drawAimLine();
    const fast = heroBuffs.mod('speed') * gear.speed * riftMods.speed * petMods.speed;
    if (fast !== 1 && this.downT <= 0) this.stretchStep(x0, y0, fast - 1, hb);
    this.updateHeroLife(dt);
    this.updateItems(dt);
    this.updateSetAuras(time);

    const target = this.downT > 0 ? null : this.hero;
    // Monsters hunt whichever player is nearest.
    const targets: Target[] = target ? [target] : [];
    if (this.net) {
      targets.push(...this.net.targets());
      this.net.follow(dt);
    }
    const monsters: Monster[] = [];
    for (const sp of this.spawners) {
      sp.update(dt, targets, this.daylight);
      monsters.push(...sp.monsters);
    }
    separate(monsters, targets, HERO_RADIUS);
    this.net?.update(dt, this.daylight);
    this.leanToBoss(dt, monsters);
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.dead);
    if (this.sanctum && !this.doorBusy) {
      const go = this.sanctum.update(this.hero.x, this.hero.y, this.inside, this.view, Phaser.Math.Easing.Sine.InOut(this.daylight));
      if (go) this.passDoor(go === 'enter');
    }
    this.chapel?.update(this.hero.x, this.hero.y, dt, Phaser.Math.Easing.Sine.InOut(this.daylight));
    this.followHero();

    for (const b of this.balls) {
      this.struck = false;
      b.update(dt, b.hit ?? this.hitTest, this.bounds);
      if (b.dead) {
        sound.impact(this.pan(b.x), this.struck);
        b.onBurst?.(b.x, b.y);
      }
    }
    sound.setFire(this.fireNearby());
    this.balls = this.balls.filter((b) => !b.dead);
    for (const b of this.beams) b.update(dt);
    this.beams = this.beams.filter((b) => !b.dead);

    const d = this.updateDaylight(time, dt);
    this.ground?.update(this.view, settings.values.quality !== 'full' ? 2.5 : 4);
    this.scenery.update(time, dt, d, this.hero, this.view);
    this.garden?.update(time, dt, target, d, this.view);
    // After the day/night light: the cosmos lights itself.
    this.cosmos?.update(time, dt);
    this.rift?.update(time, dt);
    this.companion?.update(dt, this.hero.x, this.hero.y, this.downT > 0, this.daylight);
    this.island?.update(time, dt);
    this.spirit?.update(time, dt);
    this.temple?.update(time);
    this.deep?.update(time);
    this.updateBanner();
    for (const f of this.flickers) {
      const k = 1 + (f.day - 1) * d;
      if (f.seed < 0) {
        // Crystals breathe slowly.
        const s = 0.85 + Math.sin(time * 0.002) * 0.15;
        f.light.intensity = f.base * s * k;
        f.halo.setAlpha((f.haloBase * 0.8 + s * 0.12) * k);
      } else {
        const n = Math.sin(time * 0.011 + f.seed) * 0.5 + Math.sin(time * 0.027 + f.seed * 3) * 0.3 + Math.sin(time * 0.061 + f.seed * 7) * 0.2;
        f.light.intensity = f.base * (0.85 + n * 0.15) * k;
        f.light.radius = f.radius * (0.96 + n * 0.04);
        f.halo.setAlpha((f.haloBase * 0.8 + n * 0.1) * k);
      }
    }

    for (const d of this.dummies) {
      if (d.wobble > 0) {
        d.wobble = Math.max(0, d.wobble - dt / 500);
        d.sprite.setAngle(Math.sin(d.wobble * 20) * 12 * d.wobble);
      }
    }
  }
}
