// Turns the procedural art into Phaser textures. Each lit texture gets its
// normal map attached as a data source so Light2D can use it; emissive layers
// become separate textures with matching frame names, drawn additively.

import type Phaser from 'phaser';
import type { PixelCanvas, RenderedFrame } from './pixel';
import { ORB_FRAMES, ORB_SIZE, BURST_FRAMES, BURST_SIZE, orbFrame, burstFrame, ARCANE_SPELL, VOID_SPELL, PYRO_SPELL, PYRO_METEOR_H, PYRO_METEOR_W, meteorIcon, pyroMeteor, scorchCanvas, glowCanvas, shadowCanvas, cloudShadowCanvas, sunShaftCanvas, skyIcon, beamIcon, swordIcon, whirlIcon, JADE_SWORD_ICON, maceIcon, sanctuaryIcon, hammerIcon, sunfallIcon, saberIcon, forceIcon, fistIcon, barrageIcon, palmIcon, quakeIcon, flaskIcon, bogIcon, canisterIcon, chemBarrageIcon, fumeCanvas, CHEM_BREW_COLORS, HEX_BREW_COLORS, PLAGUE_BREW, bowIcon, rainIcon, RANGER_QUIVER, STORM_QUIVER, type IconColors } from './effects';
import { ALCHEMIST_LOOKS, BIG_FLASK_SIZE, FLASK_FRAMES, FLASK_SIZE, flaskFrame } from './alchemist';
import { ARCHER_LOOKS, ARROW_DIRS, ARROW_SIZE, arrowFrame, stuckArrowFrame } from './archer';
import { BLOOD_SPELL, SOUL_SPELL, TOMB_SPELL, WYRM_ICON, WYRM_SPELL, ankhBoltIcon, bloodLanceIcon, tombRaiseIcon, novaIcon, raiseIcon, soulBoltIcon } from './necromancer';
import { buildSkeletonSheet } from './skeleton';
import { AEON_ICON, ANOMALY_ICON, BOLT_FRAMES, BOLT_SIZE, BRASS_ICON, CLOCKWORK_ICON, CHRONO_LOOKS, MARK_FRAMES, MARK_SIZE, MOON_ICON, RIFT_ICON, boltFrame, handIcon, markFrame, rewindIcon, shardsIcon, stasisIcon } from './chrono';
import { HARLEQUIN_LOOK, HOWL_DRUM_ICON, MINSTREL_LOOK, NOTE_FRAMES, WILD_LOOK, NOTE_SIZE, drumIcon, luteIcon, noteFrame, rhythmIcon, songIcon } from './bard';
import { crossIcon, cutMark, dashIcon, katanaIcon } from './samurai';
import { PUPPET_LOOKS, buildPuppetSheet, marionetteIcon, pirouetteIcon, puppetStrikeIcon, threadIcon } from './puppeteer';
import { daggersIcon, ROGUE_ICONS, ROGUE_LOOKS, shadowstepIcon, smokeCanvas } from './rogue';
import { gourdIcon, registerMoreSkinIcons, SKIN_BREWS, SKIN_QUIVERS } from './moreSkinIcons';
import { ASTRAL_SPELL, FEL_EMBERS, HELL_METEOR, HELL_SPELL, dawnGroundIcon, eclipseFallIcon, oathHammerIcon, pikeSaberIcon, seraphMaceIcon } from './heroSkins';
import { hex } from './pixel';
import { bakedCanvas, pixelCanvas } from './canvas';
import { packAtlas, registerAtlas, whiteOf, type PixelAtlas } from './atlas';
import { EGG_H, EGG_W, PET_ART, PET_FRAMES, PET_H, PET_W, eggCracks, petFrames, wishEgg } from './pets';
import { RIFT_PLATFORM_H, RIFT_PLATFORM_W, SHARD_H, SHARD_W, TEAR_FRAMES, TEAR_H, TEAR_W, blessingIcon, riftPlatformArt, riftShard, riftTear, riftVoidCanvas, type BlessingIcon } from './rift';
import { RIFT_H, RIFT_W } from '../world/riftLayout';
import { ABYSS_SPELL, ABYSS_TONES, TIDE_SPELL, waveIcon } from './tide';
import { AUTUMN_SPELL, AUTUMN_TONES, FROST_SPELL, FROST_TONES, GROVE_SPELL, WILD_SPELL, clawsIcon, groveIcon, pounceIcon, thornSeedIcon } from './druid';
import { RAVEN_INK, RAVEN_TONES, SUN_INK, SUN_TONES, diveIcon, spearIcon, spearThrowIcon } from './valkyrie';
import { DROP_H, DROP_W, ITEM_ICON_SIZE, potionDrop, potionIcon } from './items';
import { GEAR_DROP, GEAR_ICON, chestIcon, gearArt } from './gear';
import { GEAR } from '../game/gear';
import { ARROW, BEAM_H, BEAM_W, LRAY_H, LRAY_W, LRING_H, LRING_W, RUNE_H, RUNE_W, TWINKLE, lootArrow, lootBeam, lootRay, lootRing, lootRunes, lootTwinkle } from './loot';
import { registerInventoryArt } from './invTiles';
import { ANVIL_H, ANVIL_W, CRUCIBLE_H, CRUCIBLE_W, GODRAY_H, GODRAY_W, KEEPER_FRAMES, KEEPER_H, KEEPER_W, PILLAR_H as RS_PILLAR_H, PILLAR_W as RS_PILLAR_W, RUNESTONE_H, RUNESTONE_W, STATION_FRAMES, TEMPLE_ART_H, TEMPLE_ART_W, dustCrucible, godRay, runeAnvil, runesmith, runestone, sanctumArt, sanctumExterior, sanctumPillar, unmaker } from './sanctum';
import { ROOM_H, ROOM_W } from '../world/sanctumLayout';
import { chapelArt, chapelExterior } from './chapel';
import { CH_EXT_H, CH_EXT_W, CH_H, CH_W } from '../world/chapelLayout';
import { AFONSO_TONES, decreeIcon, KING_TONES } from './king';
import { JADE_LOOK } from './warrior';
import { WIND_DEEP } from './palette';
import { buildBarklingSheet, buildBeetleSheet, buildFrogSheet, buildGlowmothSheet, buildPuffcapSheet, ringCanvas, thornFrame, THORN_H, THORN_W, venomGlob, type MonsterSheet } from './monsters';
import { buildWardenSheet } from './warden';
import { buildBansheeSheet, buildShadeSheet, buildWispSheet } from './ghosts';
import { HAND_FRAMES, HAND_H, HAND_W, buildQueenSheet, graspHand } from './queen';
import { BRAZIER_FRAMES, BRAZIER_H, BRAZIER_W, CANDLE_FRAMES, CANDLE_H, CANDLE_W, LANE_H, LANE_W, ORB_PX, PILLAR_H as SD_PILLAR_H, PILLAR_W as SD_PILLAR_W, STATUE_H, STATUE_W, TOMB_H, TOMB_W, laneCanvas, mistPuff, spiritArt, spiritBrazier, spiritCandles, spiritOrb, spiritPillar, spiritStatue, spiritTomb } from './spirit';
import { SPIRIT_H, SPIRIT_W } from '../world/spiritLayout';
import { BOULDER_H, BOULDER_W, CRYSTAL_H, CRYSTAL_W, ELEMENTS, FIREBOWL_FRAMES, FIREBOWL_H, FIREBOWL_W, OBELISK_H as T_OBELISK_H, OBELISK_W as T_OBELISK_W, TPILLAR_H, TPILLAR_W, boulder, elementCrystal, fireBowl, obelisk as templeObelisk, templeArt, templePillar } from './temple';
import { ROCK_PX, TORB_PX, buildBlobSheet, buildGaleSheet, buildGolemSheet, buildSalamanderSheet, buildUndineSheet, thrownRock, waterOrb } from './elementals';
import { BLAZE_FRAMES, BLAZE_H, BLAZE_W, EMBER_H, EMBER_W, blazeFrame, buildElementinhoSheet, emberDrop } from './elementinho';
import { TEMPLE_H, TEMPLE_W } from '../world/templeLayout';
import { CAPS_FRAMES, CAPS_H, CAPS_W, CRYS_FRAMES, FOOT_H, FOOT_W, SHAFT_H, SHAFT_W, SHROOM_FRAMES, SKYPOOL_FRAMES, SKYPOOL_H, SKYPOOL_W, SPIRE_FRAMES, STALAG_FRAMES, propFooting, skylightPool, skylightShaft, CRYS_H, CRYS_W, LANTERN_FRAMES, LANTERN_H, LANTERN_W, SHROOM_H, SHROOM_W, SPIRE_H, SPIRE_W, STALAG_H, STALAG_W, amethystCluster, amethystSpire, capCluster, deepArt, giantShroom, lanternPost, stalagmite } from './deep';
import { PUFF_FRAMES, PUFF_H, PUFF_W, SPIKE_H, SPIKE_W, buildGeodebackSheet, buildGlimbatSheet, buildMyconidSheet, buildShardlingSheet, buildSporelingSheet, crystalSpike, puffball } from './deepMonsters';
import { buildSporemotherSheet } from './sporemother';
import { BREATH_SHARD, breathShard, buildWyrmSheet } from './wyrm';
import { DEEP_H, DEEP_W } from '../world/deepLayout';
import { FLOAT_ROCK_H, FLOAT_ROCK_W, HOLE_SIZE, METEOR_H, METEOR_W, OBELISK_H, OBELISK_W, PLATFORM_H, PLATFORM_W, RAY_H as COSMIC_RAY_H, RAY_W as COSMIC_RAY_W, cosmicRay, floatingRock, lightPool, meteor, obelisk, platformArt, shockRing, singularity, spaceCanvas, streak } from './cosmos';
import { COSMOS_H, COSMOS_W } from '../world/cosmosLayout';
import { COLUMN_H, COLUMN_W, ISLAND_H, ISLAND_W, ISLETS, column, fallStrip, foam, islandArt, islet, skyCanvas, wisp } from './island';
import { ISLE_H, ISLE_W } from '../world/islandLayout';
import { birdSheet } from './skyArena';
import { BOLT_DIRS, MECH_BOLT_SIZE, boltFrame as mechBolt, cannonIcon, reticle, salvoIcon } from './mech';
import { HAUNT_KINDS, HAUNT_SIZE, hauntFrame, hurlIcon, rattleIcon } from './poltergeist';
import { MARK_SIZE as POSSESS_MARK, WISP_FRAMES, WISP_SIZE, lanternIcon, nightHole, possessIcon, possessMark, wispFrame } from './wraith';
import { TURRET_BUILD, TURRET_HEADINGS, TURRET_SIZE, orbIcon, teslaIcon, turretFrame, turretIcon, wrenchIcon } from './inventor';
import { DRONE_FRAMES, DRONE_SIZE, SYNTH_LOOKS, droneFrame, droneIcon, gridIcon } from './synth';
import { brazierFrame, crystalCluster, rock, dummyFrame } from './env';
import { FLAME_FRAMES, FLAME_H, FLAME_W, GRAVE_H, GRAVE_KINDS, GRAVE_W, WISP_PX, echoBuffIcon, graveStone, soulFlame, soulWisp } from './echoes';
import { PROP_FRAMES, PROP_H, PROP_W, RAY_H, RAY_W, TREE_FRAMES, TREE_H, TREE_W, leafBit, rayCanvas } from './trees';
import { BLOOM_H, BLOOM_KINDS, BLOOM_W, FOUNTAIN_FRAMES, FOUNTAIN_H, FOUNTAIN_W, RIPPLE_FRAMES, RIPPLE_H, RIPPLE_W, rippleFrames, PILLAR_H, PILLAR_W, RUIN_H_H, RUIN_H_W, RUIN_V_H, RUIN_V_W, SEED_H, SEED_W, THORNBLOOM_H, THORNBLOOM_W, bloom, bloomSeed, buffIcon, fountain, pillar, ruinH, ruinV, thornbloom } from './garden';

const toCanvas = pixelCanvas;

/** Pack equally sized frames into one atlas per layer. */
const pack = (frames: { name: string; r: RenderedFrame }[], fw: number, fh: number, cols = 16): PixelAtlas => packAtlas(frames, fw, fh, cols);

function register(scene: Phaser.Scene, key: string, p: PixelAtlas, fw: number, fh: number, withEmissive = true, withFlash = false): void {
  registerAtlas(scene, key, withFlash && !p.white ? { ...p, white: whiteOf(p) } : p, fw, fh, withEmissive);
}

/**
 * A monster's frames as `<key>` (lit), `<key>_e` (glow), `<key>_s` (sun
 * shadow) and `<key>_w` (hit flash), with animations `<key>_<anim>_<r|l>`.
 */
function registerMonster(scene: Phaser.Scene, key: string, sh: MonsterSheet): void {
  register(scene, key, pack(sh.frames.map((f) => ({ name: f.name, r: f.canvas.render() })), sh.w, sh.h), sh.w, sh.h, true, true);
  for (const a of sh.anims) {
    for (const side of ['r', 'l']) {
      scene.anims.create({
        key: `${key}_${a.name}_${side}`,
        frames: a.frames.map((f) => ({ key, frame: `${f}_${side}` })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}

/** Lay equally sized RGBA images out in a row. */
function sideBySide(w: number, h: number, images: Uint8ClampedArray[]): Uint8ClampedArray {
  const W = w * images.length;
  const out = new Uint8ClampedArray(W * h * 4);
  images.forEach((px, k) => {
    for (let y = 0; y < h; y++) out.set(px.subarray(y * w * 4, (y + 1) * w * 4), (y * W + k * w) * 4);
  });
  return out;
}

const frameList = (canvases: PixelCanvas[], prefix: string) => canvases.map((c, i) => ({ name: `${prefix}${i}`, r: c.render() }));

/**
 * Build every texture and animation, a piece at a time: it yields between
 * pieces, so the boot can spread the work over frames and show how far
 * along it is (see BootScene). The heroes' own sheets aren't among them:
 * they're built on demand and in the background (see heroLoader.ts).
 */
export function* textureSteps(scene: Phaser.Scene): Generator<void, void, void> {
  yield;
  // The flasks each alchemist look throws (tumbling frames r0..r7),
  // plus the fumes of each bog: 'alchemist'/'flask'/'fume' for the plague
  // doctor, with a '_witch' suffix for the hex witch and '_chem' for Chemtech
  // (whose flasks are canisters).
  for (const look of ALCHEMIST_LOOKS) {
    const sfx = look.key.slice('alchemist'.length);
    for (const [key, big, size] of [[`flask${sfx}`, false, FLASK_SIZE], [`flask_big${sfx}`, true, BIG_FLASK_SIZE]] as const) {
      register(scene, key, pack(frameList(Array.from({ length: FLASK_FRAMES }, (_, i) => flaskFrame(i, big, look)), 'r'), size, size), size, size);
    }
    const brew = SKIN_BREWS[look.key] ?? (look.chem ? CHEM_BREW_COLORS : look.witch ? HEX_BREW_COLORS : PLAGUE_BREW);
    const fumes = scene.textures.addCanvas(`fume${sfx}`, toCanvas(18 * 3, 18, sideBySide(18, 18, [0, 1, 2].map((v) => fumeCanvas(18, v, brew)))))!;
    [0, 1, 2].forEach((v) => fumes.add(`f${v}`, 0, v * 18, 0, 18, 18));
    scene.textures.addCanvas(`icon_flask${sfx}`, toCanvas(16, 16, look.chem ? canisterIcon(brew) : look.shaman ? gourdIcon(brew) : flaskIcon(brew)));
    scene.textures.addCanvas(`icon_bog${sfx}`, toCanvas(16, 16, look.chem ? chemBarrageIcon(brew) : bogIcon(brew)));
  }

  yield;
  // The arrows each archer look looses: 'arrow' frames r0..r15
  // (sixteen headings in flight) and k0..k2 (stuck in the ground), with a
  // '_storm' suffix for the storm archer.
  for (const look of ARCHER_LOOKS) {
    const sfx = look.key.slice('archer'.length);
    const arrows = [
      ...frameList(Array.from({ length: ARROW_DIRS }, (_, i) => arrowFrame(i, look)), 'r'),
      ...frameList([0, 1, 2].map((k) => stuckArrowFrame(k, look)), 'k'),
    ];
    register(scene, `arrow${sfx}`, pack(arrows, ARROW_SIZE, ARROW_SIZE), ARROW_SIZE, ARROW_SIZE);
    const q = SKIN_QUIVERS[look.key] ?? (look.storm ? STORM_QUIVER : RANGER_QUIVER);
    scene.textures.addCanvas(`icon_bow${sfx}`, toCanvas(16, 16, bowIcon(q)));
    scene.textures.addCanvas(`icon_rain${sfx}`, toCanvas(16, 16, rainIcon(q, look.storm)));
  }

  yield;
  // Each rogue look's smoke and icons ('rogue', 'rogue_dancer' for the shadow
  // dancer, and the skins' '_corsair' and '_kitsune').
  for (const look of ROGUE_LOOKS) {
    const sfx = look.key.slice('rogue'.length);
    const icons = ROGUE_ICONS[look.key];
    const tones: [number, number, number][] =
      look.key === 'rogue' ? [hex('#8a8898'), hex('#57546a'), hex('#34323f')] : look.key === 'rogue_dancer' ? [hex('#8a6ad8'), hex('#4a2c90'), hex('#24124e')] : icons.daggers.smoke.map(hex);
    scene.textures.addCanvas(`${look.key}_smoke`, toCanvas(16, 16, smokeCanvas(16, tones)));
    scene.textures.addCanvas(`icon_daggers${sfx}`, toCanvas(16, 16, daggersIcon(icons.daggers)));
    scene.textures.addCanvas(`icon_shadowstep${sfx}`, toCanvas(16, 16, shadowstepIcon(icons.daggers, icons.dance)));
  }

  yield;
  // The necromancers' bolts use the spell orbs below ('orb_soul', 'orb_blood'); the dead
  // they raise are 'skeleton', registered like a monster.
  registerMonster(scene, 'skeleton', buildSkeletonSheet());
  scene.textures.addCanvas('icon_soul', toCanvas(16, 16, soulBoltIcon()));
  scene.textures.addCanvas('icon_raise', toCanvas(16, 16, raiseIcon()));
  scene.textures.addCanvas('icon_lance', toCanvas(16, 16, bloodLanceIcon()));
  scene.textures.addCanvas('icon_nova', toCanvas(16, 16, novaIcon()));
  scene.textures.addCanvas('icon_soul_tomb', toCanvas(16, 16, ankhBoltIcon()));
  scene.textures.addCanvas('icon_raise_tomb', toCanvas(16, 16, tombRaiseIcon()));
  scene.textures.addCanvas('icon_lance_wyrm', toCanvas(16, 16, bloodLanceIcon(WYRM_ICON)));
  scene.textures.addCanvas('icon_nova_wyrm', toCanvas(16, 16, novaIcon(WYRM_ICON)));

  yield;
  // The bards' glowing notes (the minstrel's ('note_e', frames n0 and n1; the wildsong's leaf notes and wisps in
  // 'note_wild_e'), and their icons, which the songs' buffs wear too.
  register(scene, 'note', pack(frameList(Array.from({ length: NOTE_FRAMES }, (_, i) => noteFrame(i, MINSTREL_LOOK)), 'n'), NOTE_SIZE, NOTE_SIZE), NOTE_SIZE, NOTE_SIZE);
  register(scene, 'note_wild', pack(frameList(Array.from({ length: NOTE_FRAMES }, (_, i) => noteFrame(i, WILD_LOOK)), 'n'), NOTE_SIZE, NOTE_SIZE), NOTE_SIZE, NOTE_SIZE);
  register(scene, 'note_harlequin', pack(frameList(Array.from({ length: NOTE_FRAMES }, (_, i) => noteFrame(i, HARLEQUIN_LOOK)), 'n'), NOTE_SIZE, NOTE_SIZE), NOTE_SIZE, NOTE_SIZE);
  scene.textures.addCanvas('icon_lute', toCanvas(16, 16, luteIcon()));
  scene.textures.addCanvas('icon_song', toCanvas(16, 16, songIcon()));
  scene.textures.addCanvas('icon_lute_wild', toCanvas(16, 16, luteIcon('wild')));
  scene.textures.addCanvas('icon_song_wild', toCanvas(16, 16, songIcon('wild')));
  scene.textures.addCanvas('icon_lute_harlequin', toCanvas(16, 16, luteIcon('harlequin')));
  scene.textures.addCanvas('icon_song_harlequin', toCanvas(16, 16, songIcon('harlequin')));
  scene.textures.addCanvas('icon_drum', toCanvas(16, 16, drumIcon()));
  scene.textures.addCanvas('icon_rhythm', toCanvas(16, 16, rhythmIcon()));
  scene.textures.addCanvas('icon_drum_howl', toCanvas(16, 16, drumIcon(HOWL_DRUM_ICON)));
  scene.textures.addCanvas('icon_rhythm_howl', toCanvas(16, 16, rhythmIcon(HOWL_DRUM_ICON)));

  yield;
  // The marionettist's puppet, like a monster ('puppet', 'puppet_porcelain'),
  // and the puppeteers' icons.
  for (const look of PUPPET_LOOKS) registerMonster(scene, look.key, buildPuppetSheet(look));
  scene.textures.addCanvas('icon_puppet', toCanvas(16, 16, puppetStrikeIcon(false)));
  scene.textures.addCanvas('icon_pirouette', toCanvas(16, 16, pirouetteIcon(false)));
  scene.textures.addCanvas('icon_puppet_porcelain', toCanvas(16, 16, puppetStrikeIcon(true)));
  scene.textures.addCanvas('icon_pirouette_porcelain', toCanvas(16, 16, pirouetteIcon(true)));
  scene.textures.addCanvas('icon_thread', toCanvas(16, 16, threadIcon('#fbf4ff', '#dcc0ff', '#a878ff')));
  scene.textures.addCanvas('icon_marionette', toCanvas(16, 16, marionetteIcon('#fbf4ff', '#dcc0ff', '#a878ff')));
  scene.textures.addCanvas('icon_thread_crimson', toCanvas(16, 16, threadIcon('#fff0f0', '#ff9aa0', '#ff3a4a')));
  scene.textures.addCanvas('icon_marionette_crimson', toCanvas(16, 16, marionetteIcon('#fff0f0', '#ff9aa0', '#ff3a4a')));
  scene.textures.addCanvas('icon_puppet_toymaker', toCanvas(16, 16, puppetStrikeIcon(false, true)));
  scene.textures.addCanvas('icon_pirouette_toymaker', toCanvas(16, 16, pirouetteIcon(false, true)));
  scene.textures.addCanvas('icon_thread_arachne', toCanvas(16, 16, threadIcon('#fbffe8', '#e0ff9a', '#a8e040')));
  scene.textures.addCanvas('icon_marionette_arachne', toCanvas(16, 16, marionetteIcon('#fbffe8', '#e0ff9a', '#a8e040')));

  yield;
  // Each chronomancer look's bolts ('<key>_bolt_e', frames b0-b3); the clock over a slowed foe
  // ('chrono_mark_e', m0-m7, tinted in game); and the icons.
  for (const look of CHRONO_LOOKS) {
    register(scene, `${look.key}_bolt`, pack(frameList(Array.from({ length: BOLT_FRAMES }, (_, i) => boltFrame(i, look)), 'b'), BOLT_SIZE, BOLT_SIZE), BOLT_SIZE, BOLT_SIZE);
  }
  register(scene, 'chrono_mark', pack(frameList(Array.from({ length: MARK_FRAMES }, (_, i) => markFrame(i)), 'm'), MARK_SIZE, MARK_SIZE), MARK_SIZE, MARK_SIZE);
  for (const [suffix, k] of [['', BRASS_ICON], ['_moon', MOON_ICON], ['_clockwork', CLOCKWORK_ICON]] as const) {
    scene.textures.addCanvas(`icon_hand${suffix}`, toCanvas(16, 16, handIcon(k)));
    scene.textures.addCanvas(`icon_stasis${suffix}`, toCanvas(16, 16, stasisIcon(k)));
  }
  for (const [suffix, k] of [['', RIFT_ICON], ['_aeon', AEON_ICON], ['_anomaly', ANOMALY_ICON]] as const) {
    scene.textures.addCanvas(`icon_shards${suffix}`, toCanvas(16, 16, shardsIcon(k)));
    scene.textures.addCanvas(`icon_rewind${suffix}`, toCanvas(16, 16, rewindIcon(k)));
  }

  yield;
  // The ronin's cuts over a marked foe are 'samurai_mark_e' (m1-m3, tinted in game).
  const marks = document.createElement('canvas');
  marks.width = 33;
  marks.height = 7;
  for (let n = 1; n <= 3; n++) marks.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(cutMark(n)), 11, 7), (n - 1) * 11, 0);
  const markTex = scene.textures.addCanvas('samurai_mark_e', bakedCanvas(marks))!;
  for (let n = 1; n <= 3; n++) markTex.add(`m${n}`, 0, (n - 1) * 11, 0, 11, 7);
  scene.textures.addCanvas('icon_katana', toCanvas(16, 16, katanaIcon('#f0f6ff', '#8e9ab4', ['#f4ffff', '#bff4ff', '#6fd4f0', '#2a86b8'])));
  scene.textures.addCanvas('icon_windblade', toCanvas(16, 16, dashIcon(['#f4ffff', '#bff4ff', '#6fd4f0', '#2a86b8'], '#f0f6ff')));
  scene.textures.addCanvas('icon_katana_oni', toCanvas(16, 16, katanaIcon('#ff9a8a', '#565060', ['#fff0ec', '#ff9a8a', '#f0283a', '#7a0a1a'])));
  scene.textures.addCanvas('icon_windblade_oni', toCanvas(16, 16, dashIcon(['#fff0ec', '#ff9a8a', '#f0283a', '#7a0a1a'], '#ff9a8a')));
  scene.textures.addCanvas('icon_iai', toCanvas(16, 16, katanaIcon('#f0f6ff', '#8e9ab4', null)));
  scene.textures.addCanvas('icon_cross', toCanvas(16, 16, crossIcon(['#fffbe8', '#ffe08a', '#f0b040', '#a0601e'])));
  scene.textures.addCanvas('icon_iai_sakura', toCanvas(16, 16, katanaIcon('#ffd6e2', '#c2b8c0', null)));
  scene.textures.addCanvas('icon_cross_sakura', toCanvas(16, 16, crossIcon(['#fff4f8', '#ffc0d4', '#ff7aa6', '#b03a6a'])));
  scene.textures.addCanvas('icon_katana_kitsune', toCanvas(16, 16, katanaIcon('#b0ffe8', '#8e9ab4', ['#f0fff8', '#b0ffe0', '#40e8b0', '#107a6a'])));
  scene.textures.addCanvas('icon_windblade_kitsune', toCanvas(16, 16, dashIcon(['#f0fff8', '#b0ffe0', '#40e8b0', '#107a6a'], '#b0ffe8')));
  scene.textures.addCanvas('icon_iai_shogun', toCanvas(16, 16, katanaIcon('#f4f2ff', '#565060', null)));
  scene.textures.addCanvas('icon_cross_shogun', toCanvas(16, 16, crossIcon(['#fffcf0', '#fff0b8', '#a89cff', '#3a2e9a'])));

  yield;
  // Energy ball and impact per spell look: 'orb'/'burst' (arcane), 'orb_void'/'burst_void', 'orb_pyro'/'burst_pyro'.
  for (const [suffix, k] of [['', ARCANE_SPELL], ['_void', VOID_SPELL], ['_pyro', PYRO_SPELL], ['_astral', ASTRAL_SPELL], ['_hell', HELL_SPELL], ['_soul', SOUL_SPELL], ['_blood', BLOOD_SPELL], ['_tomb', TOMB_SPELL], ['_wyrm', WYRM_SPELL], ['_grove', GROVE_SPELL], ['_wild', WILD_SPELL], ['_autumn', AUTUMN_SPELL], ['_frost', FROST_SPELL], ['_tide', TIDE_SPELL], ['_abyss', ABYSS_SPELL]] as const) {
    register(scene, `orb${suffix}`, pack(frameList(Array.from({ length: ORB_FRAMES }, (_, i) => orbFrame(i, k)), 'o'), ORB_SIZE, ORB_SIZE), ORB_SIZE, ORB_SIZE);
    register(scene, `burst${suffix}`, pack(frameList(Array.from({ length: BURST_FRAMES }, (_, i) => burstFrame(i, k)), 'b'), BURST_SIZE, BURST_SIZE), BURST_SIZE, BURST_SIZE);
    scene.anims.create({ key: `orb${suffix}_spin`, frames: scene.anims.generateFrameNames(`orb${suffix}_e`, { prefix: 'o', start: 0, end: ORB_FRAMES - 1 }), frameRate: 14, repeat: -1 });
    scene.anims.create({ key: `burst${suffix}_pop`, frames: scene.anims.generateFrameNames(`burst${suffix}_e`, { prefix: 'b', start: 0, end: BURST_FRAMES - 1 }), frameRate: 22, repeat: 0 });
  }
  scene.textures.addCanvas('glow', toCanvas(32, 32, glowCanvas(32)));
  scene.textures.addCanvas('shadow', toCanvas(16, 6, shadowCanvas(16, 6)));
  scene.textures.addCanvas('shadow_big', toCanvas(24, 8, shadowCanvas(24, 8)));
  const spark = new Uint8ClampedArray(4 * 4).fill(255);
  scene.textures.addCanvas('spark', toCanvas(2, 2, spark));
  yield;
  // Light for great finds lying on the ground (see game/Pickup.ts).
  scene.textures.addCanvas('loot_beam', toCanvas(BEAM_W, BEAM_H, lootBeam()));
  scene.textures.addCanvas('loot_ray', toCanvas(LRAY_W, LRAY_H, lootRay()));
  scene.textures.addCanvas('loot_ring', toCanvas(LRING_W, LRING_H, lootRing()));
  scene.textures.addCanvas('loot_runes', toCanvas(RUNE_W, RUNE_H, lootRunes()));
  scene.textures.addCanvas('loot_twinkle', toCanvas(TWINKLE, TWINKLE, lootTwinkle()));
  scene.textures.addCanvas('loot_arrow', toCanvas(ARROW, ARROW, lootArrow()));

  yield;
  // Environment. The ground itself streams in as the heroes walk (see world/GroundStreamer.ts).
  register(scene, 'tree', pack(TREE_FRAMES.map((f) => ({ name: f.name, r: f.draw().render() })), TREE_W, TREE_H, 9), TREE_W, TREE_H, false);
  register(scene, 'flora', pack(PROP_FRAMES.map((f) => ({ name: f.name, r: f.draw().render() })), PROP_W, PROP_H, 10), PROP_W, PROP_H);
  const rays = scene.textures.addCanvas('ray', toCanvas(RAY_W * 2, RAY_H, sideBySide(RAY_W, RAY_H, [rayCanvas(11), rayCanvas(29)])))!;
  rays.add('ray0', 0, 0, 0, RAY_W, RAY_H);
  rays.add('ray1', 0, RAY_W, 0, RAY_W, RAY_H);
  scene.textures.addCanvas('leafbit', toCanvas(3, 2, leafBit()));

  yield;
  // Sky.
  scene.textures.addCanvas('clouds', toCanvas(256, 256, cloudShadowCanvas(256)));
  scene.textures.addCanvas('shafts', toCanvas(256, 256, sunShaftCanvas(256, 256)));
  scene.textures.addCanvas('icon_sun', toCanvas(12, 12, skyIcon('sun')));
  scene.textures.addCanvas('icon_moon', toCanvas(12, 12, skyIcon('moon')));
  scene.textures.addCanvas('icon_beam', toCanvas(16, 16, beamIcon()));
  scene.textures.addCanvas('icon_beam_void', toCanvas(16, 16, beamIcon(VOID_SPELL)));
  yield;
  // The pyromancer's meteor: its button, three flickering frames of the falling rock, and its scorch.
  scene.textures.addCanvas('icon_meteor', toCanvas(16, 16, meteorIcon()));
  const meteors = scene.textures.addCanvas('pyro_meteor', toCanvas(PYRO_METEOR_W * 3, PYRO_METEOR_H, sideBySide(PYRO_METEOR_W, PYRO_METEOR_H, [0, 1, 2].map((f) => pyroMeteor(f)))))!;
  for (let i = 0; i < 3; i++) meteors.add(`m${i}`, 0, i * PYRO_METEOR_W, 0, PYRO_METEOR_W, PYRO_METEOR_H);
  scene.textures.addCanvas('scorch', toCanvas(48, 24, scorchCanvas(48, 24)));
  scene.textures.addCanvas('icon_sword', toCanvas(16, 16, swordIcon()));
  scene.textures.addCanvas('icon_whirl', toCanvas(16, 16, whirlIcon()));
  scene.textures.addCanvas('icon_sword_jade', toCanvas(16, 16, swordIcon(JADE_SWORD_ICON)));
  scene.textures.addCanvas('icon_whirl_jade', toCanvas(16, 16, whirlIcon([JADE_LOOK.glow.core, JADE_LOOK.glow.hot, JADE_LOOK.glow.mid, WIND_DEEP])));
  scene.textures.addCanvas('icon_mace', toCanvas(16, 16, maceIcon()));
  scene.textures.addCanvas('icon_sanctuary', toCanvas(16, 16, sanctuaryIcon()));
  scene.textures.addCanvas('icon_hammer', toCanvas(16, 16, hammerIcon()));
  scene.textures.addCanvas('icon_sunfall', toCanvas(16, 16, sunfallIcon()));
  const icons: [string, IconColors, IconColors][] = [
    ['', [hex('#f6feff'), hex('#86d2ff'), hex('#4aa6ff'), hex('#2a7cff')], [hex('#ffffff'), hex('#d8f0ff'), hex('#8cc4ff'), hex('#4a70c0')]],
    ['_sith', [hex('#fff6f2'), hex('#ff6a62'), hex('#f0283a'), hex('#c81628')], [hex('#fff0f4'), hex('#ff8a9a'), hex('#d0304a'), hex('#6a1030')]],
  ];
  for (const [suffix, saber, force] of icons) {
    scene.textures.addCanvas(`icon_saber${suffix}`, toCanvas(16, 16, saberIcon(saber)));
    scene.textures.addCanvas(`icon_force${suffix}`, toCanvas(16, 16, forceIcon(force)));
  }

  yield;
  // Skins: the Astral's beam, the Hellfire's meteor and scorch, and the
  // Spartan's, Seraph's, Oathbreaker's and Temple guard's buttons.
  scene.textures.addCanvas('icon_beam_astral', toCanvas(16, 16, beamIcon(ASTRAL_SPELL)));
  scene.textures.addCanvas('icon_meteor_hell', toCanvas(16, 16, meteorIcon(HELL_SPELL)));
  const hellMeteors = scene.textures.addCanvas('pyro_meteor_hell', toCanvas(PYRO_METEOR_W * 3, PYRO_METEOR_H, sideBySide(PYRO_METEOR_W, PYRO_METEOR_H, [0, 1, 2].map((f) => pyroMeteor(f, HELL_METEOR)))))!;
  for (let i = 0; i < 3; i++) hellMeteors.add(`m${i}`, 0, i * PYRO_METEOR_W, 0, PYRO_METEOR_W, PYRO_METEOR_H);
  scene.textures.addCanvas('scorch_hell', toCanvas(48, 24, scorchCanvas(48, 24, FEL_EMBERS)));
  scene.textures.addCanvas('icon_sword_spartan', toCanvas(16, 16, swordIcon({ blade: '#dfe8f7', bladeDark: '#8d9dbd', tip: '#f4f8ff', guard: '#cc8c3e', guardLit: '#f4d08a', guardDark: '#955a24', grip: '#6e3a20', ink: '#140904' })));
  scene.textures.addCanvas('icon_whirl_spartan', toCanvas(16, 16, whirlIcon([hex('#fff0e8'), hex('#ff9a80'), hex('#f03a3a'), hex('#8a0a1a')])));
  // The King's and Afonso Henriques's buttons.
  scene.textures.addCanvas('icon_sword_king', toCanvas(16, 16, swordIcon({ blade: '#e4ecf8', bladeDark: '#8d9dbd', tip: '#f8fbff', guard: '#f4cf6a', guardLit: '#fff4bf', guardDark: '#9a5a26', grip: '#6c2c96', ink: '#0c0414' })));
  scene.textures.addCanvas('icon_decree', toCanvas(16, 16, decreeIcon(KING_TONES)));
  scene.textures.addCanvas('icon_sword_afonso', toCanvas(16, 16, swordIcon({ blade: '#d6dce8', bladeDark: '#7a869c', tip: '#f4f8ff', guard: '#5e6878', guardLit: '#98a2b4', guardDark: '#252a34', grip: '#6a3d26', ink: '#06070a' })));
  scene.textures.addCanvas('icon_decree_afonso', toCanvas(16, 16, decreeIcon(AFONSO_TONES)));
  scene.textures.addCanvas('icon_mace_seraph', toCanvas(16, 16, seraphMaceIcon()));
  scene.textures.addCanvas('icon_sanctuary_seraph', toCanvas(16, 16, dawnGroundIcon()));
  scene.textures.addCanvas('icon_hammer_oath', toCanvas(16, 16, oathHammerIcon()));
  scene.textures.addCanvas('icon_sunfall_oath', toCanvas(16, 16, eclipseFallIcon()));
  scene.textures.addCanvas('icon_saber_guard', toCanvas(16, 16, pikeSaberIcon()));
  scene.textures.addCanvas('icon_force_guard', toCanvas(16, 16, forceIcon([hex('#fffbe8'), hex('#ffe08a'), hex('#f0b030'), hex('#8a5a18')])));

  scene.textures.addCanvas('icon_fist', toCanvas(16, 16, fistIcon()));
  scene.textures.addCanvas('icon_palm', toCanvas(16, 16, palmIcon()));
  scene.textures.addCanvas('icon_quake', toCanvas(16, 16, quakeIcon()));
  scene.textures.addCanvas('icon_barrage', toCanvas(16, 16, barrageIcon([hex('#fffbe8'), hex('#ffd66b'), hex('#ff8a36'), hex('#d8402a')])));
  registerMoreSkinIcons((key, px) => scene.textures.addCanvas(key, toCanvas(16, 16, px)));
  // The Druid's and the Valkyrie's buttons (their figures are wizard and warrior looks, see heroSheets.ts).
  // Companions: one sheet of every frame ('pets', lit), a looping animation each ('pet_<id>'),
  // and the Wishing Nest's egg with the cracks that spread across it.
  register(scene, 'pets', pack(petFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), PET_W, PET_H), PET_W, PET_H);
  for (const id of Object.keys(PET_ART)) {
    scene.anims.create({
      key: `pet_${id}`,
      frames: Array.from({ length: PET_FRAMES }, (_, f) => ({ key: 'pets', frame: `${id}_${f}` })),
      frameRate: 7,
      repeat: -1,
    });
  }
  const egg = wishEgg().render();
  scene.textures.addCanvas('nest_egg', toCanvas(EGG_W, EGG_H, egg.diffuse));
  scene.textures.addCanvas('nest_egg_e', toCanvas(EGG_W, EGG_H, egg.emissive));
  for (const k of [1, 2, 3]) scene.textures.addCanvas(`nest_crack${k}`, toCanvas(EGG_W, EGG_H, eggCracks(k)));
  scene.textures.addCanvas('icon_thorn', toCanvas(16, 16, thornSeedIcon()));
  scene.textures.addCanvas('icon_grove', toCanvas(16, 16, groveIcon()));
  scene.textures.addCanvas('icon_claws', toCanvas(16, 16, clawsIcon()));
  scene.textures.addCanvas('icon_pounce', toCanvas(16, 16, pounceIcon()));
  scene.textures.addCanvas('icon_spear', toCanvas(16, 16, spearIcon()));
  scene.textures.addCanvas('icon_spearthrow', toCanvas(16, 16, spearThrowIcon()));
  scene.textures.addCanvas('icon_spear_storm', toCanvas(16, 16, spearIcon(true)));
  scene.textures.addCanvas('icon_dive', toCanvas(16, 16, diveIcon()));
  scene.textures.addCanvas('icon_thorn_autumn', toCanvas(16, 16, thornSeedIcon(AUTUMN_TONES)));
  scene.textures.addCanvas('icon_grove_autumn', toCanvas(16, 16, groveIcon(AUTUMN_TONES)));
  scene.textures.addCanvas('icon_claws_frost', toCanvas(16, 16, clawsIcon(FROST_TONES)));
  scene.textures.addCanvas('icon_pounce_frost', toCanvas(16, 16, pounceIcon(FROST_TONES)));
  // The Tidecaller's wave, and the Abyssal's.
  scene.textures.addCanvas('icon_wave', toCanvas(16, 16, waveIcon()));
  scene.textures.addCanvas('icon_wave_abyss', toCanvas(16, 16, waveIcon(ABYSS_TONES)));
  scene.textures.addCanvas('icon_spear_sun', toCanvas(16, 16, spearIcon(false, SUN_INK, SUN_TONES)));
  scene.textures.addCanvas('icon_spearthrow_sun', toCanvas(16, 16, spearThrowIcon(SUN_TONES)));
  scene.textures.addCanvas('icon_spear_raven', toCanvas(16, 16, spearIcon(true, RAVEN_INK, RAVEN_TONES)));
  scene.textures.addCanvas('icon_dive_raven', toCanvas(16, 16, diveIcon(RAVEN_TONES)));

  // The Automaton's icons; the Synth's drones hover on a loop ('drone_spin',
  // 'drone_hive_spin').
  for (const look of SYNTH_LOOKS) {
    const dk = look.hive ? 'drone_hive' : 'drone';
    register(scene, dk, pack(frameList(Array.from({ length: DRONE_FRAMES }, (_, f) => droneFrame(f, look.hive)), 'd'), DRONE_SIZE, DRONE_SIZE), DRONE_SIZE, DRONE_SIZE);
    scene.anims.create({ key: `${dk}_spin`, frames: Array.from({ length: DRONE_FRAMES }, (_, f) => ({ key: dk, frame: `d${f}` })), frameRate: look.hive ? 24 : 16, repeat: -1 });
  }
  // What the mechs fire, in sixteen headings each ('shell_0'.. 'rocket_15'), and the lock-on reticle.
  const bolts = (['shell', 'nail', 'missile', 'rocket'] as const).flatMap((k) => frameList(Array.from({ length: BOLT_DIRS }, (_, i) => mechBolt(k, i)), `${k}_`));
  register(scene, 'mech_bolt', pack(bolts, MECH_BOLT_SIZE, MECH_BOLT_SIZE), MECH_BOLT_SIZE, MECH_BOLT_SIZE);
  scene.textures.addCanvas('mech_reticle', toCanvas(13, 13, reticle()));
  // The Phantom's haunted things thrown ('haunt', by kind), the wisps ('soulwisp' and
  // 'soulwisp_petal', flickering on a loop), the possession marks, the Dead of
  // Night's dark, and the icons.
  register(scene, 'haunt', pack(HAUNT_KINDS.map((k) => ({ name: k, r: hauntFrame(k).render() })), HAUNT_SIZE, HAUNT_SIZE), HAUNT_SIZE, HAUNT_SIZE);
  for (const [key, petal] of [['soulwisp', false], ['soulwisp_petal', true]] as const) {
    register(scene, key, pack(frameList(Array.from({ length: WISP_FRAMES }, (_, f) => wispFrame(f, petal)), 'w'), WISP_SIZE, WISP_SIZE), WISP_SIZE, WISP_SIZE);
    scene.anims.create({ key: `${key}_flicker`, frames: Array.from({ length: WISP_FRAMES }, (_, f) => ({ key, frame: `w${f}` })), frameRate: petal ? 8 : 12, repeat: -1 });
  }
  register(scene, 'possess_mark', pack([{ name: 'w', r: possessMark(false).render() }, { name: 'c', r: possessMark(true).render() }], POSSESS_MARK, POSSESS_MARK), POSSESS_MARK, POSSESS_MARK);
  scene.textures.addCanvas('night_hole', toCanvas(128, 128, nightHole()));
  scene.textures.addCanvas('icon_hurl', toCanvas(16, 16, hurlIcon()));
  scene.textures.addCanvas('icon_rattle', toCanvas(16, 16, rattleIcon()));
  scene.textures.addCanvas('icon_hurl_tea', toCanvas(16, 16, hurlIcon(true)));
  scene.textures.addCanvas('icon_rattle_tea', toCanvas(16, 16, rattleIcon(true)));
  scene.textures.addCanvas('icon_lantern', toCanvas(16, 16, lanternIcon()));
  scene.textures.addCanvas('icon_possess', toCanvas(16, 16, possessIcon()));
  scene.textures.addCanvas('icon_lantern_cala', toCanvas(16, 16, lanternIcon(true)));
  scene.textures.addCanvas('icon_possess_cala', toCanvas(16, 16, possessIcon(true)));
  // The Inventor's turret ('turret': unfolding 'b0'..'b4', turned 'h0'..'h7'
  // and firing 'f0'..'f7'), and its icons. The Engineer and the Scientist
  // themselves are hero sheets (see heroSheets.ts).
  const turret = [
    ...Array.from({ length: TURRET_BUILD }, (_, i) => ({ name: `b${i}`, r: turretFrame(2, i / (TURRET_BUILD - 1) * 0.9).render() })),
    ...Array.from({ length: TURRET_HEADINGS }, (_, i) => ({ name: `h${i}`, r: turretFrame(i).render() })),
    ...Array.from({ length: TURRET_HEADINGS }, (_, i) => ({ name: `f${i}`, r: turretFrame(i, 1, 1).render() })),
  ];
  register(scene, 'turret', pack(turret, TURRET_SIZE, TURRET_SIZE), TURRET_SIZE, TURRET_SIZE);
  scene.textures.addCanvas('icon_wrench', toCanvas(16, 16, wrenchIcon()));
  scene.textures.addCanvas('icon_turret', toCanvas(16, 16, turretIcon()));
  scene.textures.addCanvas('icon_tesla', toCanvas(16, 16, teslaIcon()));
  scene.textures.addCanvas('icon_orb', toCanvas(16, 16, orbIcon()));
  scene.textures.addCanvas('icon_tesla_einstein', toCanvas(16, 16, teslaIcon(true)));
  scene.textures.addCanvas('icon_orb_einstein', toCanvas(16, 16, orbIcon(true)));

  scene.textures.addCanvas('icon_cannon', toCanvas(16, 16, cannonIcon()));
  scene.textures.addCanvas('icon_salvo', toCanvas(16, 16, salvoIcon()));
  scene.textures.addCanvas('icon_cannon_scrap', toCanvas(16, 16, cannonIcon(true)));
  scene.textures.addCanvas('icon_salvo_scrap', toCanvas(16, 16, salvoIcon(true)));
  scene.textures.addCanvas('icon_drone', toCanvas(16, 16, droneIcon()));
  scene.textures.addCanvas('icon_grid', toCanvas(16, 16, gridIcon()));
  scene.textures.addCanvas('icon_drone_hive', toCanvas(16, 16, droneIcon(true)));
  scene.textures.addCanvas('icon_grid_hive', toCanvas(16, 16, gridIcon(true)));

  yield;
  // Items: hotbar icons and the bottles monsters drop.
  for (const kind of ['health', 'speed'] as const) {
    scene.textures.addCanvas(`item_${kind}`, toCanvas(ITEM_ICON_SIZE, ITEM_ICON_SIZE, potionIcon(kind)));
    scene.textures.addCanvas(`drop_${kind}`, toCanvas(DROP_W, DROP_H, potionDrop(kind)));
  }
  yield;
  // Gear: 32x32 icons for the bag, 16x16 sprites for the ground, and the bag's chest button.
  for (const g of GEAR) {
    const art = gearArt(g.id);
    scene.textures.addCanvas(g.icon, toCanvas(GEAR_ICON, GEAR_ICON, art.icon));
    scene.textures.addCanvas(g.drop, toCanvas(GEAR_DROP, GEAR_DROP, art.drop));
  }
  scene.textures.addCanvas('icon_chest', toCanvas(16, 16, chestIcon()));
  registerInventoryArt(scene);

  register(scene, 'brazier', pack(frameList([0, 1, 2, 3].map(brazierFrame), 'f'), 16, 26), 16, 26);
  scene.anims.create({ key: 'brazier_burn', frames: scene.anims.generateFrameNames('brazier_e', { prefix: 'f', start: 0, end: 3 }), frameRate: 9, repeat: -1 });
  register(scene, 'crystals', pack(frameList([crystalCluster(3), crystalCluster(8)], 'c'), 20, 22), 20, 22);
  register(scene, 'rock', pack(frameList([rock(1), rock(2), rock(5)], 'r'), 18, 14), 18, 14, false);
  yield;
  // Monsters.
  // The Sunken Garden: ruins, the fountain, thornblooms, blooms and their seeds, and the buffs' icons.
  register(scene, 'ruin_h', pack(frameList([0, 1, 2].map(ruinH), 'h'), RUIN_H_W, RUIN_H_H), RUIN_H_W, RUIN_H_H, false);
  register(scene, 'ruin_v', pack(frameList([0, 1, 2].map(ruinV), 'v'), RUIN_V_W, RUIN_V_H), RUIN_V_W, RUIN_V_H, false);
  register(scene, 'pillar', pack(frameList([0, 1, 2].map(pillar), 'p'), PILLAR_W, PILLAR_H), PILLAR_W, PILLAR_H, false);
  register(scene, 'fountain', pack(frameList(Array.from({ length: FOUNTAIN_FRAMES }, (_, f) => fountain(f)), 'f'), FOUNTAIN_W, FOUNTAIN_H), FOUNTAIN_W, FOUNTAIN_H);
  scene.anims.create({ key: 'fountain_flow', frames: scene.anims.generateFrameNames('fountain_e', { prefix: 'f', start: 0, end: FOUNTAIN_FRAMES - 1 }), frameRate: 10, repeat: -1 });
  const ripples = scene.textures.addCanvas('ripple', toCanvas(RIPPLE_W * RIPPLE_FRAMES, RIPPLE_H, sideBySide(RIPPLE_W, RIPPLE_H, rippleFrames())))!;
  for (let i = 0; i < RIPPLE_FRAMES; i++) ripples.add(`r${i}`, 0, i * RIPPLE_W, 0, RIPPLE_W, RIPPLE_H);
  scene.anims.create({ key: 'ripple_spread', frames: scene.anims.generateFrameNames('ripple', { prefix: 'r', start: 0, end: RIPPLE_FRAMES - 1 }), frameRate: 7, repeat: 0 });
  register(scene, 'thornbloom', pack([{ name: 'bloom', r: thornbloom(false).render() }, { name: 'stump', r: thornbloom(true).render() }], THORNBLOOM_W, THORNBLOOM_H), THORNBLOOM_W, THORNBLOOM_H, true, true);
  const blooms = BLOOM_KINDS.flatMap((k) => (['open', 'bud', 'cut'] as const).map((stage) => ({ name: `${k}_${stage}`, r: bloom(k, stage).render() })));
  register(scene, 'bloom', pack(blooms, BLOOM_W, BLOOM_H, 12), BLOOM_W, BLOOM_H, true, true);
  register(scene, 'seed', pack(BLOOM_KINDS.map((k) => ({ name: k, r: bloomSeed(k).render() })), SEED_W, SEED_H), SEED_W, SEED_H);
  for (const k of ['might', 'ward', 'renew'] as const) scene.textures.addCanvas(`buff_${k}`, toCanvas(16, 16, buffIcon(k)));
  // Echoes of the fallen: gravestones, the soul flame on their candles, the soul wisp and the blessing's badge.
  register(scene, 'echo_grave', pack(frameList(Array.from({ length: GRAVE_KINDS }, (_, k) => graveStone(k)), 'g'), GRAVE_W, GRAVE_H), GRAVE_W, GRAVE_H);
  register(scene, 'echo_flame', pack(frameList(Array.from({ length: FLAME_FRAMES }, (_, f) => soulFlame(f)), 'f'), FLAME_W, FLAME_H), FLAME_W, FLAME_H);
  scene.anims.create({ key: 'echo_flame_burn', frames: scene.anims.generateFrameNames('echo_flame_e', { prefix: 'f', start: 0, end: FLAME_FRAMES - 1 }), frameRate: 10, repeat: -1 });
  scene.textures.addCanvas('echo_wisp', toCanvas(WISP_PX, WISP_PX, soulWisp()));
  scene.textures.addCanvas('buff_echo', toCanvas(16, 16, echoBuffIcon()));

  registerMonster(scene, 'frog', buildFrogSheet());
  registerMonster(scene, 'beetle', buildBeetleSheet());
  registerMonster(scene, 'puffcap', buildPuffcapSheet());
  registerMonster(scene, 'barkling', buildBarklingSheet());
  registerMonster(scene, 'glowmoth', buildGlowmothSheet());
  registerMonster(scene, 'warden', buildWardenSheet());
  registerMonster(scene, 'wisp', buildWispSheet());
  registerMonster(scene, 'shade', buildShadeSheet());
  registerMonster(scene, 'banshee', buildBansheeSheet());
  registerMonster(scene, 'queen', buildQueenSheet());
  register(scene, 'thorns', pack(frameList([0, 1, 2].map(thornFrame), 't'), THORN_W, THORN_H), THORN_W, THORN_H, false);
  scene.textures.addCanvas('venom', toCanvas(7, 7, venomGlob()));
  const ring = ringCanvas(22, 12);
  scene.textures.addCanvas('danger_ring', toCanvas(ring.w, ring.h, ring.px));

  register(scene, 'dummy', pack(frameList([dummyFrame(false), dummyFrame(true)], 'd'), 18, 28), 18, 28, false);
}

/** The Cosmos Arena: backdrop, platform, props and spells. */
function* cosmosTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const space = yield* spaceCanvas();
  scene.textures.addCanvas('cosmos_space', toCanvas(COSMOS_W, COSMOS_H, space));
  const plat = yield* platformArt();
  scene.textures.addCanvas('cosmos_platform', toCanvas(PLATFORM_W, PLATFORM_H, plat.diffuse))!.setDataSource(toCanvas(PLATFORM_W, PLATFORM_H, plat.normal));
  scene.textures.addCanvas('cosmos_platform_e', toCanvas(PLATFORM_W, PLATFORM_H, plat.emissive));
  yield;
  register(scene, 'cosmos_obelisk', pack(frameList([0, 1, 2].map(obelisk), 'o'), OBELISK_W, OBELISK_H), OBELISK_W, OBELISK_H);
  register(scene, 'cosmos_rock', pack(frameList([0, 1, 2].map(floatingRock), 'r'), FLOAT_ROCK_W, FLOAT_ROCK_H), FLOAT_ROCK_W, FLOAT_ROCK_H);
  yield;
  const rays = scene.textures.addCanvas('cosmos_ray', toCanvas(COSMIC_RAY_W * 3, COSMIC_RAY_H, sideBySide(COSMIC_RAY_W, COSMIC_RAY_H, [cosmicRay(5), cosmicRay(17), cosmicRay(40)])))!;
  [0, 1, 2].forEach((v) => rays.add(`ray${v}`, 0, v * COSMIC_RAY_W, 0, COSMIC_RAY_W, COSMIC_RAY_H));
  scene.textures.addCanvas('cosmos_pool', toCanvas(64, 26, lightPool(64, 26)));
  scene.textures.addCanvas('cosmos_meteor', toCanvas(METEOR_W, METEOR_H, meteor()));
  scene.textures.addCanvas('cosmos_wave', toCanvas(80, 80, shockRing(80, 80, 0.22)));
  const hole = singularity();
  scene.textures.addCanvas('cosmos_hole', toCanvas(HOLE_SIZE, HOLE_SIZE, hole.core));
  scene.textures.addCanvas('cosmos_hole_ring', toCanvas(HOLE_SIZE, HOLE_SIZE, hole.ring));
  const nova = ringCanvas(92, 62);
  scene.textures.addCanvas('cosmos_nova_ring', toCanvas(nova.w, nova.h, nova.px));
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('cosmos_streak', toCanvas(40, 3, streak(40)));
}

/** The Floating Island: sky, island, columns and the sky's moving parts. */
function* islandTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const sky = yield* skyCanvas();
  scene.textures.addCanvas('isle_sky', toCanvas(ISLE_W, ISLE_H, sky));
  const land = yield* islandArt();
  scene.textures.addCanvas('isle_land', toCanvas(ISLAND_W, ISLAND_H, land.diffuse))!.setDataSource(toCanvas(ISLAND_W, ISLAND_H, land.normal));
  scene.textures.addCanvas('isle_land_e', toCanvas(ISLAND_W, ISLAND_H, land.emissive));
  yield;
  register(scene, 'isle_column', pack(frameList([column(0), column(1)], 'c'), COLUMN_W, COLUMN_H), COLUMN_W, COLUMN_H, false);
  yield;
  ISLETS.forEach((l, k) => scene.textures.addCanvas(`isle_islet${k}`, islet(l.s, l.seed, l.kind).toCanvas()));
  yield;
  [0, 1, 2].forEach((k) => scene.textures.addCanvas(`isle_wisp${k}`, wisp(300 + k * 17).toCanvas()));
  scene.textures.addCanvas('isle_foam', foam().toCanvas());
  scene.textures.addCanvas('isle_fall', fallStrip().toCanvas());
  // Last: its presence means everything above is built.
  const bird = scene.textures.addCanvas('isle_bird', birdSheet().toCanvas())!;
  bird.add('b0', 0, 0, 0, 5, 3);
  bird.add('b1', 0, 5, 0, 5, 3);
}

/** The Endless Rift: the void, the platform, tears, shards, drifting rocks and the blessings' icons. */
function* riftTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const sky = yield* riftVoidCanvas();
  scene.textures.addCanvas('rift_void', toCanvas(RIFT_W, RIFT_H, sky));
  const plat = yield* riftPlatformArt();
  scene.textures.addCanvas('rift_platform', toCanvas(RIFT_PLATFORM_W, RIFT_PLATFORM_H, plat.diffuse))!.setDataSource(toCanvas(RIFT_PLATFORM_W, RIFT_PLATFORM_H, plat.normal));
  scene.textures.addCanvas('rift_platform_e', toCanvas(RIFT_PLATFORM_W, RIFT_PLATFORM_H, plat.emissive));
  yield;
  const tears = scene.textures.addCanvas('rift_tear', toCanvas(TEAR_W * TEAR_FRAMES, TEAR_H, sideBySide(TEAR_W, TEAR_H, Array.from({ length: TEAR_FRAMES }, (_, f) => riftTear(f)))))!;
  for (let f = 0; f < TEAR_FRAMES; f++) tears.add(`t${f}`, 0, f * TEAR_W, 0, TEAR_W, TEAR_H);
  if (!scene.anims.exists('rift_tear_flicker')) scene.anims.create({ key: 'rift_tear_flicker', frames: scene.anims.generateFrameNames('rift_tear', { prefix: 't', start: 0, end: TEAR_FRAMES - 1 }), frameRate: 9, repeat: -1 });
  yield;
  register(scene, 'rift_shard', pack(frameList([0, 1, 2, 3].map(riftShard), 's'), SHARD_W, SHARD_H), SHARD_W, SHARD_H);
  register(scene, 'rift_rock', pack(frameList([4, 9, 13].map(floatingRock), 'r'), FLOAT_ROCK_W, FLOAT_ROCK_H), FLOAT_ROCK_W, FLOAT_ROCK_H, false);
  yield;
  // Last: its presence means everything above is built.
  for (const kind of ['might', 'swift', 'vigor', 'fang', 'ward', 'renew', 'surge', 'fortune'] as BlessingIcon[]) scene.textures.addCanvas(`blessing_${kind}`, toCanvas(16, 16, blessingIcon(kind)));
}

/** The Spirit Dungeon: floor plan, props and spells. */
function* spiritTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const art = yield* spiritArt();
  scene.textures.addCanvas('sd_floor', toCanvas(SPIRIT_W, SPIRIT_H, art.diffuse))!.setDataSource(toCanvas(SPIRIT_W, SPIRIT_H, art.normal));
  scene.textures.addCanvas('sd_floor_e', toCanvas(SPIRIT_W, SPIRIT_H, art.emissive));
  yield;
  register(scene, 'sd_brazier', pack(frameList(Array.from({ length: BRAZIER_FRAMES }, (_, f) => spiritBrazier(f)), 'f'), BRAZIER_W, BRAZIER_H), BRAZIER_W, BRAZIER_H);
  scene.anims.create({ key: 'sd_brazier_burn', frames: scene.anims.generateFrameNames('sd_brazier_e', { prefix: 'f', start: 0, end: BRAZIER_FRAMES - 1 }), frameRate: 8, repeat: -1 });
  register(scene, 'sd_candles', pack(frameList(Array.from({ length: CANDLE_FRAMES }, (_, f) => spiritCandles(f)), 'f'), CANDLE_W, CANDLE_H), CANDLE_W, CANDLE_H);
  scene.anims.create({ key: 'sd_candles_burn', frames: scene.anims.generateFrameNames('sd_candles_e', { prefix: 'f', start: 0, end: CANDLE_FRAMES - 1 }), frameRate: 6, repeat: -1 });
  yield;
  register(scene, 'sd_pillar', pack(frameList([spiritPillar(false), spiritPillar(true)], 'p'), SD_PILLAR_W, SD_PILLAR_H), SD_PILLAR_W, SD_PILLAR_H);
  register(scene, 'sd_tomb', pack(frameList([spiritTomb()], 't'), TOMB_W, TOMB_H), TOMB_W, TOMB_H);
  register(scene, 'sd_statue', pack(frameList([spiritStatue()], 's'), STATUE_W, STATUE_H), STATUE_W, STATUE_H);
  yield;
  register(scene, 'sd_hand', pack(frameList(Array.from({ length: HAND_FRAMES }, (_, f) => graspHand(f)), 'h'), HAND_W, HAND_H), HAND_W, HAND_H);
  scene.anims.create({ key: 'sd_hand_grasp', frames: scene.anims.generateFrameNames('sd_hand_e', { prefix: 'h', start: 0, end: HAND_FRAMES - 1 }), frameRate: 10, repeat: 0 });
  [0, 1, 2].forEach((k) => scene.textures.addCanvas(`sd_mist${k}`, toCanvas(72, 30, mistPuff(72, 30, 300 + k * 23))));
  scene.textures.addCanvas('sd_orb', toCanvas(ORB_PX, ORB_PX, spiritOrb()));
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('sd_lane', toCanvas(LANE_W, LANE_H, laneCanvas()));
}

/** The Elementinho Temple: floor plan, props, creatures and spells. */
function* templeTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const art = yield* templeArt();
  scene.textures.addCanvas('et_floor', toCanvas(TEMPLE_W, TEMPLE_H, art.diffuse))!.setDataSource(toCanvas(TEMPLE_W, TEMPLE_H, art.normal));
  scene.textures.addCanvas('et_floor_e', toCanvas(TEMPLE_W, TEMPLE_H, art.emissive));
  yield;
  // Props: frames in ELEMENTS order (water, earth, air, fire).
  register(scene, 'et_pillar', pack(frameList(ELEMENTS.map(templePillar), 'p'), TPILLAR_W, TPILLAR_H), TPILLAR_W, TPILLAR_H);
  register(scene, 'et_bowl', pack(frameList(Array.from({ length: FIREBOWL_FRAMES }, (_, f) => fireBowl(f)), 'f'), FIREBOWL_W, FIREBOWL_H), FIREBOWL_W, FIREBOWL_H);
  scene.anims.create({ key: 'et_bowl_burn', frames: scene.anims.generateFrameNames('et_bowl_e', { prefix: 'f', start: 0, end: FIREBOWL_FRAMES - 1 }), frameRate: 9, repeat: -1 });
  yield;
  register(scene, 'et_boulder', pack(frameList([boulder(0), boulder(1)], 'b'), BOULDER_W, BOULDER_H), BOULDER_W, BOULDER_H);
  register(scene, 'et_crystal', pack(frameList(ELEMENTS.map(elementCrystal), 'c'), CRYSTAL_W, CRYSTAL_H), CRYSTAL_W, CRYSTAL_H);
  register(scene, 'et_obelisk', pack(frameList(ELEMENTS.map(templeObelisk), 'o'), T_OBELISK_W, T_OBELISK_H), T_OBELISK_W, T_OBELISK_H);
  yield;
  // The temple's creatures, and its Legend.
  for (const el of ELEMENTS) registerMonster(scene, `blob_${el}`, buildBlobSheet(el));
  yield;
  registerMonster(scene, 'golem', buildGolemSheet());
  registerMonster(scene, 'undine', buildUndineSheet());
  yield;
  registerMonster(scene, 'gale', buildGaleSheet());
  registerMonster(scene, 'salamander', buildSalamanderSheet());
  yield;
  registerMonster(scene, 'elementinho', buildElementinhoSheet());
  yield;
  // Spells.
  scene.textures.addCanvas('et_orb', toCanvas(TORB_PX, TORB_PX, waterOrb()));
  register(scene, 'et_rock', pack(frameList([thrownRock()], 'r'), ROCK_PX, ROCK_PX), ROCK_PX, ROCK_PX, false);
  scene.textures.addCanvas('et_ember', toCanvas(EMBER_W, EMBER_H, emberDrop()));
  const blaze = scene.textures.addCanvas('et_blaze', toCanvas(BLAZE_W * BLAZE_FRAMES, BLAZE_H, sideBySide(BLAZE_W, BLAZE_H, Array.from({ length: BLAZE_FRAMES }, (_, f) => blazeFrame(f)))))!;
  for (let f = 0; f < BLAZE_FRAMES; f++) blaze.add(`b${f}`, 0, f * BLAZE_W, 0, BLAZE_W, BLAZE_H);
  scene.anims.create({ key: 'et_blaze_burn', frames: scene.anims.generateFrameNames('et_blaze', { prefix: 'b', start: 0, end: BLAZE_FRAMES - 1 }), frameRate: 10, repeat: -1 });
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('et_lane', toCanvas(LANE_W, LANE_H, laneCanvas()));
}

/** The Glimmerdeep: the cave, props, creatures, its two bosses and their spells. */
function* deepTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const art = yield* deepArt();
  scene.textures.addCanvas('gd_floor', toCanvas(DEEP_W, DEEP_H, art.diffuse))!.setDataSource(toCanvas(DEEP_W, DEEP_H, art.normal));
  yield;
  scene.textures.addCanvas('gd_floor_e', toCanvas(DEEP_W, DEEP_H, art.emissive));
  yield;
  // Props, each look with its idle loop: frames '<prefix><look>' (the first,
  // so a still image can use the old name) and '<prefix><look>_<n>', played
  // by 'gd_<kind><look>' on the body and 'gd_<kind><look>_e' on its glow.
  const loop = (key: string, prefix: string, paint: (v: number, f: number) => PixelCanvas, frames: number, w: number, h: number, fps: number) => {
    const list: { name: string; r: RenderedFrame }[] = [];
    for (const v of [0, 1]) for (let f = 0; f < frames; f++) list.push({ name: f ? `${prefix}${v}_${f}` : `${prefix}${v}`, r: paint(v, f).render() });
    register(scene, key, pack(list, w, h), w, h);
    for (const v of [0, 1]) {
      for (const layer of [key, `${key}_e`]) {
        const names = Array.from({ length: frames }, (_, f) => ({ key: layer, frame: f ? `${prefix}${v}_${f}` : `${prefix}${v}` }));
        scene.anims.create({ key: `${layer === key ? key : `${key}_e`}${v}`, frames: names, frameRate: fps, repeat: -1 });
      }
    }
  };
  loop('gd_shroom', 's', giantShroom, SHROOM_FRAMES, SHROOM_W, SHROOM_H, 5);
  yield;
  loop('gd_caps', 'c', capCluster, CAPS_FRAMES, CAPS_W, CAPS_H, 6);
  yield;
  loop('gd_stalag', 't', stalagmite, STALAG_FRAMES, STALAG_W, STALAG_H, 5);
  loop('gd_crystal', 'c', amethystCluster, CRYS_FRAMES, CRYS_W, CRYS_H, 8);
  yield;
  loop('gd_spire', 'p', amethystSpire, SPIRE_FRAMES, SPIRE_W, SPIRE_H, 9);
  yield;
  // Their footings: frames '<kind><look>'.
  const feet: { name: string; r: RenderedFrame }[] = [];
  for (const kind of ['shroom', 'caps', 'stalag', 'crystal', 'spire', 'lantern'] as const) for (const v of [0, 1]) feet.push({ name: `${kind}${v}`, r: propFooting(kind, v).render() });
  register(scene, 'gd_foot', pack(feet, FOOT_W, FOOT_H, 4), FOOT_W, FOOT_H);
  yield;
  // Skylights: the pool of daylight (four frames of leaf shadows, per look) and two shafts.
  for (const v of [0, 1]) {
    const pool = scene.textures.addCanvas(`gd_skypool${v}`, toCanvas(SKYPOOL_W * SKYPOOL_FRAMES, SKYPOOL_H, sideBySide(SKYPOOL_W, SKYPOOL_H, Array.from({ length: SKYPOOL_FRAMES }, (_, f) => skylightPool(f, 40 + v * 13)))))!;
    for (let f = 0; f < SKYPOOL_FRAMES; f++) pool.add(f, 0, f * SKYPOOL_W, 0, SKYPOOL_W, SKYPOOL_H);
    scene.textures.addCanvas(`gd_shaft${v}`, toCanvas(SHAFT_W, SHAFT_H, skylightShaft(70 + v * 31)));
  }
  yield;
  register(scene, 'gd_lantern', pack(frameList(Array.from({ length: LANTERN_FRAMES }, (_, f) => lanternPost(f)), 'f'), LANTERN_W, LANTERN_H), LANTERN_W, LANTERN_H);
  scene.anims.create({ key: 'gd_lantern_burn', frames: scene.anims.generateFrameNames('gd_lantern_e', { prefix: 'f', start: 0, end: LANTERN_FRAMES - 1 }), frameRate: 7, repeat: -1 });
  yield;
  // The cave's creatures, and its Legend and Myth.
  registerMonster(scene, 'sporeling', buildSporelingSheet());
  registerMonster(scene, 'glimbat', buildGlimbatSheet());
  yield;
  registerMonster(scene, 'myconid', buildMyconidSheet());
  registerMonster(scene, 'shardling', buildShardlingSheet());
  yield;
  registerMonster(scene, 'geodeback', buildGeodebackSheet());
  yield;
  registerMonster(scene, 'sporemother', buildSporemotherSheet());
  yield;
  registerMonster(scene, 'wyrm', buildWyrmSheet());
  yield;
  // Spells.
  register(scene, 'gd_puff', pack(frameList(Array.from({ length: PUFF_FRAMES }, (_, f) => puffball(f)), 'p'), PUFF_W, PUFF_H), PUFF_W, PUFF_H);
  register(scene, 'gd_spike', pack(frameList([crystalSpike(0), crystalSpike(1), crystalSpike(2)], 'k'), SPIKE_W, SPIKE_H), SPIKE_W, SPIKE_H);
  register(scene, 'gd_shard', pack(frameList([breathShard()], 's'), BREATH_SHARD, BREATH_SHARD), BREATH_SHARD, BREATH_SHARD);
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('gd_lane', toCanvas(LANE_W, LANE_H, laneCanvas()));
}

/** The painted arenas' texture sets, each built by one job (see arenaLoader.ts). */
export type ArenaJob = 'cosmos' | 'island' | 'rift' | 'spirit' | 'temple' | 'deep';

/**
 * Each set's steps, which yield between pieces, and the texture it makes
 * last: once that one exists, the whole set does.
 */
export const ARENA_JOBS: Record<ArenaJob, { done: string; steps: (scene: Phaser.Scene) => Generator<void, void, void> }> = {
  cosmos: { done: 'cosmos_streak', steps: cosmosTextures },
  island: { done: 'isle_bird', steps: islandTextures },
  rift: { done: 'blessing_fortune', steps: riftTextures },
  spirit: { done: 'sd_lane', steps: spiritTextures },
  temple: { done: 'et_lane', steps: templeTextures },
  deep: { done: 'gd_lane', steps: deepTextures },
};

/**
 * Build the Rune Temple's textures (the temple outside, the room inside, its
 * props and keepers) the first time the clearing is entered.
 */
export function warmSanctum(scene: Phaser.Scene): void {
  if (scene.textures.exists('rs_room')) return;
  const job = sanctumArt();
  let step = job.next();
  while (!step.done) step = job.next();
  const art = step.value;
  register(scene, 'rs_temple', pack(frameList([sanctumExterior()], 't'), TEMPLE_ART_W, TEMPLE_ART_H), TEMPLE_ART_W, TEMPLE_ART_H);
  register(scene, 'rs_runestone', pack(frameList([runestone(0), runestone(1)], 'r'), RUNESTONE_W, RUNESTONE_H), RUNESTONE_W, RUNESTONE_H);
  const rays = scene.textures.addCanvas('rs_ray', toCanvas(GODRAY_W * 2, GODRAY_H, sideBySide(GODRAY_W, GODRAY_H, [godRay(3), godRay(8)])))!;
  rays.add('g0', 0, 0, 0, GODRAY_W, GODRAY_H);
  rays.add('g1', 0, GODRAY_W, 0, GODRAY_W, GODRAY_H);
  const loop = (key: string, n: number, fps: number) =>
    scene.anims.create({ key: `${key}_loop`, frames: scene.anims.generateFrameNames(key, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  const glowLoop = (key: string, n: number, fps: number) =>
    scene.anims.create({ key: `${key}_e_loop`, frames: scene.anims.generateFrameNames(`${key}_e`, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  register(scene, 'rs_pillar', pack(frameList([sanctumPillar()], 'p'), RS_PILLAR_W, RS_PILLAR_H), RS_PILLAR_W, RS_PILLAR_H);
  register(scene, 'rs_crucible', pack(frameList(Array.from({ length: STATION_FRAMES }, (_, f) => dustCrucible(f)), 'f'), CRUCIBLE_W, CRUCIBLE_H), CRUCIBLE_W, CRUCIBLE_H);
  register(scene, 'rs_anvil', pack(frameList(Array.from({ length: STATION_FRAMES }, (_, f) => runeAnvil(f)), 'f'), ANVIL_W, ANVIL_H), ANVIL_W, ANVIL_H);
  register(scene, 'rs_nyx', pack(frameList(Array.from({ length: KEEPER_FRAMES }, (_, f) => unmaker(f)), 'f'), KEEPER_W, KEEPER_H), KEEPER_W, KEEPER_H);
  register(scene, 'rs_tharn', pack(frameList(Array.from({ length: KEEPER_FRAMES }, (_, f) => runesmith(f)), 'f'), KEEPER_W, KEEPER_H), KEEPER_W, KEEPER_H);
  for (const [key, n, fps] of [
    ['rs_crucible', STATION_FRAMES, 8],
    ['rs_anvil', STATION_FRAMES, 6],
    ['rs_nyx', KEEPER_FRAMES, 5],
    ['rs_tharn', KEEPER_FRAMES, 4],
  ] as [string, number, number][]) {
    loop(key, n, fps);
    glowLoop(key, n, fps);
  }
  scene.textures.addCanvas('rs_room', toCanvas(ROOM_W, ROOM_H, art.diffuse))!.setDataSource(toCanvas(ROOM_W, ROOM_H, art.normal));
  scene.textures.addCanvas('rs_room_e', toCanvas(ROOM_W, ROOM_H, art.emissive));
}

/** The walk-in chapel's art (its hall, and the roof and front that hide it), made the first time one is built. */
export function warmChapel(scene: Phaser.Scene): void {
  if (scene.textures.exists('ch_hall')) return;
  const cjob = chapelArt();
  let cstep = cjob.next();
  while (!cstep.done) cstep = cjob.next();
  const hall = cstep.value;
  scene.textures.addCanvas('ch_hall', toCanvas(CH_W, CH_H, hall.diffuse))!.setDataSource(toCanvas(CH_W, CH_H, hall.normal));
  scene.textures.addCanvas('ch_hall_e', toCanvas(CH_W, CH_H, hall.emissive));
  register(scene, 'ch_out', pack(frameList([chapelExterior()], 't'), CH_EXT_W, CH_EXT_H), CH_EXT_W, CH_EXT_H);
}
