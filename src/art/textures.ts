// Turns the procedural art into Phaser textures. Each lit texture gets its
// normal map attached as a data source so Light2D can use it; emissive layers
// become separate textures with matching frame names, drawn additively.

import { worldMapTextures } from './worldMap';
import type Phaser from 'phaser';
import type { PixelCanvas, RenderedFrame } from './pixel';
import { EMPRESS_BOLT_ICON, EMPRESS_STAFF_ICON, lightningIcon, MASTER_FORCE_ICON, MASTER_SABER_ICON, NOMAD_FORCE_ICON, NOMAD_SABER_ICON, SITH_BOLT_ICON, SITH_STAFF_ICON, staffIcon, WARLORD_BOLT_ICON, WARLORD_STAFF_ICON } from './sith';
import { PEACOCK_ICON, riposteIcon, TWIN_ICON, twinIcon } from './twin';
import { hunterLeapIcon, ringSaberIcon, VOIDHUNTER_ICON } from './inquisitor';
import { ORB_FRAMES, ORB_SIZE, BURST_FRAMES, BURST_SIZE, orbFrame, burstFrame, ARCANE_SPELL, VOID_SPELL, PYRO_SPELL, PYRO_METEOR_H, PYRO_METEOR_W, meteorIcon, pyroMeteor, scorchCanvas, glowCanvas, shadowCanvas, cloudShadowCanvas, sunShaftCanvas, skyIcon, beamIcon, swordIcon, whirlIcon, JADE_SWORD_ICON, maceIcon, sanctuaryIcon, hammerIcon, sunfallIcon, saberIcon, forceIcon, fistIcon, barrageIcon, palmIcon, quakeIcon, flaskIcon, bogIcon, canisterIcon, chemBarrageIcon, fumeCanvas, CHEM_BREW_COLORS, HEX_BREW_COLORS, PLAGUE_BREW, bowIcon, rainIcon, RANGER_QUIVER, STORM_QUIVER, type IconColors } from './effects';
import { ALCHEMIST_LOOKS, BIG_FLASK_SIZE, FLASK_FRAMES, FLASK_SIZE, flaskFrame } from './alchemist';
import { FOXGLOVE_BREW, foxBogIcon, foxFlaskIcon } from './foxglove';
import { CARNIVAL_BREW_COLORS, carnBogIcon, carnFlaskIcon } from './carnevale';
import { bellBarrageIcon, bellIcon, DIVER_BREW_COLORS } from './diver';
import { ARCHER_LOOKS, ARROW_DIRS, ARROW_SIZE, arrowFrame, boltFrame as crossbowBoltFrame, stuckArrowFrame, stuckBoltFrame } from './archer';
import { BIRD_H as HAWK_H, BIRD_LOOKS as HAWK_LOOKS, BIRD_W as HAWK_W, birdFrames as hawkFrames, FALCONER_LOOKS, falconArrowFrame, falconStuckFrame } from './falconer';
import { FALCONER_TONES, falconIcon, quickShotIcon, SNOWFEATHER_TONES } from './falconerIcons';
import { blossomVaultIcon, briarCrossbowIcon, briarNetIcon, crossbowIcon, fanShotIcon, netBoltIcon, petalFanIcon, vaultIcon } from './archerIcons';
import { deathStepIcon, reapIcon } from './reaper';
import { boneSpikesIcon, DROWNED_ICON, rimeBoltIcon } from './lich';
import { MOSSGRAVE_ICON, graveIcon, spadeIcon } from './barrow';
import { GRAVE_LOOK, MOSS_GRAVE_LOOK, buildGhoulSheet, buildStoneSheet } from './barrowFx';
import { sunBowIcon, sunRainIcon } from './apolloIcons';
import { BLOOD_SPELL, DIGGER_ICON, DIGGER_SPELL, SOUL_SPELL, TOMB_SPELL, VAMPIRE_ICON, VAMPIRE_SPELL, WYRM_ICON, WYRM_SPELL, ankhBoltIcon, batCanvas, bloodLanceIcon, tombRaiseIcon, novaIcon, raiseIcon, soulBoltIcon } from './necromancer';
import { chainNetIcon, ironCrossbowIcon, owlFanIcon, owlVaultIcon } from './archerIcons';
import { buildSkeletonSheet } from './skeleton';
import { AEON_ICON, ANOMALY_ICON, PRIMAVERA_ICON, SANDGLASS_ICON, VHS_ICON, BOLT_FRAMES, BOLT_SIZE, BRASS_ICON, CLOCKWORK_ICON, CHRONO_LOOKS, MARK_FRAMES, MARK_SIZE, MOON_ICON, RIFT_ICON, boltFrame, handIcon, markFrame, rewindIcon, shardsIcon, stasisIcon } from './chrono';
import { FADISTA_LOOK, HARLEQUIN_LOOK, HOWL_DRUM_ICON, MINSTREL_LOOK, SKALD_LOOK, TAIKO_DRUM_ICON, skaldLyreIcon, NOTE_FRAMES, ORPHEUS_LOOK, VAGABOND_LOOK, WILD_LOOK, NOTE_SIZE, banjoIcon, drumIcon, guitarraIcon, luteIcon, lyreIcon, noteFrame, rhythmIcon, skinSongIcon, songIcon } from './bard';
import { crossIcon, cutMark, dashIcon, katanaIcon } from './samurai';
import { cardCanvas, daggersIcon, petalCanvas, ROGUE_ICONS, venomCanvas, ROGUE_LOOKS, shadowstepIcon, smokeCanvas } from './rogue';
import { gourdIcon, registerMoreSkinIcons, SKIN_BREWS, SKIN_QUIVERS } from './moreSkinIcons';
import { inquisitorHammerIcon, lionGroundIcon, lionMaceIcon, purgeFallIcon } from './paladinSkins';
import { ASTRAL_SPELL, FEL_EMBERS, HELL_METEOR, HELL_SPELL, dawnGroundIcon, eclipseFallIcon, oathHammerIcon, pikeSaberIcon, seraphMaceIcon } from './heroSkins';
import { hex } from './pixel';
import { bakedCanvas, pixelCanvas } from './canvas';
import { packAtlas, registerAtlas, whiteOf, type PixelAtlas } from './atlas';
import { CRITTER_ART, CRITTER_FRAMES, CRITTER_H, CRITTER_W, JAR_H, JAR_W, NET_ANGLES, NET_SIZE, critterFrames, jarFrame, netFrame, netIcon } from './critters';
import { CRITTERS } from '../game/critters';
import { EGG_H, EGG_W, PET_ART, PET_FRAMES, PET_H, PET_W, eggCracks, petFrames, wishEgg } from './pets';
import { RIFT_PLATFORM_H, RIFT_PLATFORM_W, SHARD_H, SHARD_W, TEAR_FRAMES, TEAR_H, TEAR_W, blessingIcon, riftPlatformArt, riftShard, riftTear, riftVoidCanvas, type BlessingIcon } from './rift';
import { RIFT_H, RIFT_W } from '../world/riftLayout';
import { ABYSS_SPELL, ABYSS_TONES, TIDE_SPELL, waveIcon } from './tide';
import { LOTUS_SPELL, lilyWaveIcon } from './tide';
import { SIREN_SPELL, sunsetWaveIcon } from './tide';
import { PRISM_SPELL, prismBeamIcon } from './prism';
import { FIREBIRD_EMBERS, FIREBIRD_SPELL, firebirdMeteor, firebirdMeteorIcon } from './firebird';
import { TITANIA_SPELL, blossomSeedIcon, faerieRingIcon } from './druid';
import { CINDER_SPELL, CINDER_TONES, MYCELIA_SPELL, shroomRingIcon, sporeIcon } from './druid';
import { PUMPKIN_EMBERS, PUMPKIN_METEOR, PUMPKIN_SPELL, jackOrbFrame, pumpkinMeteorIcon } from './pumpkin';
import { AUTUMN_SPELL, AUTUMN_TONES, FROST_SPELL, FROST_TONES, GROVE_SPELL, WILD_SPELL, clawsIcon, groveIcon, pounceIcon, thornSeedIcon } from './druid';
import { RAVEN_INK, RAVEN_TONES, SUN_INK, SUN_TONES, diveIcon, spearIcon, spearThrowIcon, swanSpearIcon, swanThrowIcon } from './valkyrie';
import { amazonSpearIcon, amazonThrowIcon, auroraDiveIcon, auroraSpearIcon } from './valkyrie';
import { DROP_H, DROP_W, ITEM_ICON_SIZE, potionDrop, potionIcon } from './items';
import { GEAR_DROP, GEAR_ICON, chestIcon, gearArt } from './gear';
import { GEAR } from '../game/gear';
import { ARROW, BEAM_H, BEAM_W, LRAY_H, LRAY_W, LRING_H, LRING_W, RUNE_H, RUNE_W, TWINKLE, lootArrow, lootBeam, lootRay, lootRing, lootRunes, lootTwinkle } from './loot';
import { registerInventoryArt } from './invTiles';
import { ANVIL_H, ANVIL_W, CRUCIBLE_H, CRUCIBLE_W, GODRAY_H, GODRAY_W, KEEPER_FRAMES, KEEPER_H, KEEPER_W, RUNESTONE_H, RUNESTONE_W, STATION_FRAMES, dustCrucible, godRay, runeAnvil, runesmith, runestone, unmaker } from './sanctum';
import { templeExterior, templeHall } from './runeHall';
import { TP_EXT_H, TP_EXT_W, TP_TEX_H, TP_W } from '../world/sanctumLayout';
import {
  BELLOWS_H,
  BELLOWS_W,
  FIRE_FRAMES,
  HEARTH_H,
  HEARTH_W,
  PORTRAIT_FRAMES,
  PORTRAIT_H,
  PORTRAIT_W,
  SMITH_FRAMES,
  SMITH_H,
  SMITH_W,
  TROUGH_H,
  TROUGH_W,
  YARD_H,
  YARD_W,
  barrelFrame,
  bellowsFrame,
  forgeExterior,
  forgeHall,
  grindFrame,
  hearthFrame,
  materialIcons,
  smithFrame,
  smithPortrait,
  troughFrame,
} from './forge';
import { FG_EXT_H, FG_EXT_W, FG_H, FG_W } from '../world/forgeLayout';
import { matIcon } from '../game/forge';
import { AFONSO_TONES, decreeIcon, KING_TONES } from './king';
import { JADE_LOOK } from './warrior';
import { hollowSwordIcon, lanternWhirlIcon } from './headless';
import { dragonSwordIcon, dragonWhirlIcon } from './dragonslayer';
import { sunDecreeIcon, sunSwordIcon } from './sunking';
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
import { BOMB_FRAMES, BOMB_SIZE, FLAME_FRAMES as HW_FLAME_FRAMES, FLAME_H as HW_FLAME_H, FLAME_W as HW_FLAME_W, LASH_FRAMES, LASH_H, LASH_W, SPROUT_FRAMES, SPROUT_H, SPROUT_W, buildGourdlingSheet, buildHexbatSheet, buildPumpkinKingSheet, flameFrame, lashFrame, pumpkinBomb, sproutFrame } from './hallowsMonsters';
import { BREATH_SHARD, breathShard, buildWyrmSheet } from './wyrm';
import { DEEP_H, DEEP_W } from '../world/deepLayout';
import { FLOAT_ROCK_H, FLOAT_ROCK_W, HOLE_SIZE, METEOR_H, METEOR_W, OBELISK_H, OBELISK_W, PLATFORM_H, PLATFORM_W, RAY_H as COSMIC_RAY_H, RAY_W as COSMIC_RAY_W, cosmicRay, floatingRock, lightPool, meteor, obelisk, platformArt, shockRing, singularity, spaceCanvas, streak } from './cosmos';
import { COSMOS_H, COSMOS_W } from '../world/cosmosLayout';
import { COLUMN_H, COLUMN_W, ISLAND_H, ISLAND_W, ISLETS, column, fallStrip, foam, islandArt, islet, skyCanvas, wisp } from './island';
import { ISLE_H, ISLE_W } from '../world/islandLayout';
import { DRAFT_FRAMES, DRAFT_H, DRAFT_W, RING, RING_FRAMES, SEA_TILE, archArt, deckPuff, draftFrame, isletArt, ringFrame, seaTile, streak as windStreak } from './glide';
import { GOAL, ISLETS as SKY_ISLETS } from '../world/glideLayout';
import { birdSheet } from './skyArena';
import { BOLT_DIRS, BOLT_KINDS, MECH_BOLT_SIZE, boltFrame as mechBolt, cannonIcon, dreadCannonIcon, dreadSalvoIcon, reticle, salvoIcon } from './mech';
import { HAUNT_KINDS, HAUNT_SIZE, bansheeHurlIcon, hauntFrame, hurlIcon, keenIcon, rattleIcon } from './poltergeist';
import { MARK_SIZE as POSSESS_MARK, WISP_FRAMES, WISP_SIZE, ferryLanternIcon, lanternIcon, nightHole, possessIcon, possessMark, wispFrame } from './wraith';
import { TURRET_BUILD, TURRET_HEADINGS, TURRET_SIZE, coilOrbIcon, hammerWrenchIcon, orbIcon, runeTurretIcon, teslaIcon, turretFrame, turretIcon, wrenchIcon } from './inventor';
import { BENFICA_LOOK, DRAGON_LOOK, EAGLE_LOOK, FEATHER_DIRS, FEATHER_SIZE, FIREBOLT_FRAMES, FIREBOLT_SIZE, JADE_SERPENT_LOOK, LION_LOOK, NEMEAN_LOOK, PHOENIX_LOOK, PORTO_LOOK, SPORTING_LOOK, breathIcon, clawIcon, featherFrame, featherIcon, fireIcon, fireboltFrame, gustIcon, roarIcon } from './beast';
import { DRONE_FRAMES, DRONE_SIZE, SYNTH_LOOKS, droneFrame, droneIcon, gridIcon, vaporDroneIcon, vaporGridIcon } from './synth';
import { registerAquanautArt } from './aquanautKit';
import { registerBearIcons } from './bear';
import { BREW_LOOKS, KEG_SIZE, kegFrames, kegKey, fireIcon as brewFireIcon, paddleIcon } from './brewmaster';
import { pyroIcons } from './pyrotechnist';
import { SAGE_TONES, STARSEER_TONES, STONE_SIZE, barrierIcon, stoneFrames, stoneKey, throwIcon } from './sage';
import { brazierFrame, crystalCluster, rock, dummyFrame } from './env';
import {
  MERCHANT_FRAMES,
  MERCHANT_H,
  MERCHANT_W,
  METEOR_FRAMES,
  METEOR_SIZE,
  ORE_H,
  ORE_KINDS,
  ORE_STAGES,
  ORE_W,
  PORTAL_FRAMES,
  PORTAL_H,
  PORTAL_W,
  RUG_H,
  RUG_W,
  SHRINE_H,
  SHRINE_STAGES,
  SHRINE_W,
  OMEN_ICON,
  buildImpSheet,
  dustDrop,
  fogPuff,
  merchantFrame,
  meteorFrame,
  omenIcon,
  oreFrame,
  portalFrame,
  rugArt,
  runeRing,
  scorchMark,
  shrineFrame,
  type OmenIcon,
} from './omens';
import { FLAME_FRAMES, FLAME_H, FLAME_W, GRAVE_H, GRAVE_KINDS, GRAVE_W, WISP_PX, echoBuffIcon, graveStone, soulFlame, soulWisp } from './echoes';
import { ELDER_H, ELDER_W, PROP_FRAMES, PROP_H, PROP_W, RAY_H, RAY_W, TREE_FRAMES, TREE_H, TREE_SWAY_FPS, TREE_SWAY_FRAMES, TREE_VARIANTS, TREE_W, cherryTree, elderTree, leafBit, mapleTree, rayCanvas, treeFrame, willowTree } from './trees';
import { BIRD_ANIMS, BIRD_H, BIRD_LOOKS, BIRD_W, DEER_ANIMS, DEER_H, DEER_LOOKS, DEER_W, FOX_ANIMS, FOX_H, FOX_W, GUST_FRAMES, GUST_H, GUST_W, OWL_ANIMS, OWL_H, OWL_W, birdFrames, deerFrames, foxFrames, gustFrame, owlFrames } from './wildlife';
import { CAMPFIRE, CHEST_H, CHEST_W, FPROP_BENDS, FPROP_FRAMES, FPROP_H, FPROP_W, GREATCAP_H, GREATCAP_W, HUNT_H, HUNT_W, LOOKOUT_H, LOOKOUT_W, MENHIR_H, MENHIR_LOOKS, MENHIR_W, SHRINE_FRAMES, SHRINE_H as FSHRINE_H, SHRINE_W as FSHRINE_W, chestArt, greatCapArt, leanToArt, lookoutArt, menhirArt, moonBuffIcon, rackArt, shrineArt, sporeBuffIcon, sunBuffIcon } from './forest';
import { ALTAR_H, ALTAR_W, GROVE_FRAMES, GROVE_H, GROVE_W, HOLLOW_FRAMES, HOLLOW_H, HOLLOW_W, PRINT_H, PRINT_W, SPRING_FRAMES, SPRING_H, SPRING_W, STAG_ANIMS, STAG_H, STAG_W, altarArt, groveFrame, hollowArt, hoofprint, springArt, stagBuffIcon, stagFrames } from './stag';
import { STRIP_H, buildStrip } from './ground';
import { FZ_FLAKE, FZ_ICICLE_H, FZ_ICICLE_W, FZ_LANE_H, FZ_LANE_W, FZ_MIST_H, FZ_MIST_W, FZ_PATCH_FRAMES, FZ_PATCH_H, FZ_PATCH_W, FZ_RING_H, FZ_RING_W, FZ_SHARD_H, FZ_SHARD_W, FZ_SNOWBALL, FZ_SPIKE_H, FZ_SPIKE_W, frostFlake, frostIcicle, frostLaneArt, frostMist, frostPatch, frostRing, frostShard, frostSnowball, frostSpike } from './frostFx';
import type { FxRegistrar } from './frostKit';
import { aviatorTextures } from './aviator';
import { AURORA_H, AURORA_W, BRAZIER_FRAMES as FZ_BRAZIER_FRAMES, BRAZIER_H as FZ_BRAZIER_H, BRAZIER_W as FZ_BRAZIER_W, STATUE_H as FZ_STATUE_H, STATUE_W as FZ_STATUE_W, archGlowArt, auroraRibbon, frostArenaArt, frostBrazier, frostSkyArt, frostStatue } from './frost';
import { FROST_H, FROST_W, GATES } from '../world/frostLayout';
import { buildFlurrykinSheet, buildIcebeakSheet, buildRimespriteSheet, buildRimeweaverSheet, buildSnowmiteSheet, frostWeakFx } from './frostWeak';
import { buildChillstoneSheet, buildFrostboundSheet, buildGaleclawSheet, buildRimefangSheet, buildRimewitchSheet, buildSnowstalkerSheet, frostNormalFx } from './frostNormal';
import { buildFrostTrollSheet, buildFrostdrakeSheet, buildRimeknightSheet, buildTuskmawSheet, buildYetiSheet, frostStrongFx } from './frostStrong';
import { buildVargrSheet, vargrFx } from './vargr';
import { buildSnowQueenSheet, snowQueenFx } from './snowQueen';
import { buildWinterKingSheet, winterKingFx } from './winterKing';
import { buildColossusSheet, colossusFx } from './colossus';
import { buildAurelithSheet, aurelithFx } from './aurelith';
import { lightwrightFx } from './lightwright';

import { CHUNK, ForestGen, EVERWOOD_SEED } from '../world/forestGen';
import { forestTile } from '../world/forestGround';
import { registerTransmuterIcons } from './transmuter';
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
    const brew = SKIN_BREWS[look.key] ?? (look.carnival ? CARNIVAL_BREW_COLORS : look.diver ? DIVER_BREW_COLORS : look.herbal ? FOXGLOVE_BREW : look.chem ? CHEM_BREW_COLORS : look.witch ? HEX_BREW_COLORS : PLAGUE_BREW);
    const fumes = scene.textures.addCanvas(`fume${sfx}`, toCanvas(18 * 3, 18, sideBySide(18, 18, [0, 1, 2].map((v) => fumeCanvas(18, v, brew)))))!;
    [0, 1, 2].forEach((v) => fumes.add(`f${v}`, 0, v * 18, 0, 18, 18));
    scene.textures.addCanvas(`icon_flask${sfx}`, toCanvas(16, 16, look.diver ? bellIcon(brew) : look.chem ? canisterIcon(brew) : look.shaman ? gourdIcon(brew) : look.herbal ? foxFlaskIcon(brew) : look.carnival ? carnFlaskIcon(brew) : flaskIcon(brew)));
    scene.textures.addCanvas(`icon_bog${sfx}`, toCanvas(16, 16, look.diver ? bellBarrageIcon(brew) : look.chem ? chemBarrageIcon(brew) : look.herbal ? foxBogIcon(brew) : look.carnival ? carnBogIcon(brew) : bogIcon(brew)));
  }

  yield;
  // The arrows each archer look looses: 'arrow' frames r0..r15
  // (sixteen headings in flight) and k0..k2 (stuck in the ground), with a
  // '_storm' suffix for the storm archer. The arbalest's are its stubby bolts.
  for (const look of ARCHER_LOOKS) {
    const sfx = look.key.slice('archer'.length);
    const arrows = [
      ...frameList(Array.from({ length: ARROW_DIRS }, (_, i) => (look.arb ? crossbowBoltFrame(i, look) : arrowFrame(i, look))), 'r'),
      ...frameList([0, 1, 2].map((k) => (look.arb ? stuckBoltFrame(k, look) : stuckArrowFrame(k, look))), 'k'),
    ];
    register(scene, `arrow${sfx}`, pack(arrows, ARROW_SIZE, ARROW_SIZE), ARROW_SIZE, ARROW_SIZE);
    // The arbalest's and windrunner's own icons carry no suffix; their skins' do.
    if (look.iron || look.owl) {
      const [attack, special] = look.iron ? ['crossbow', 'netbolt'] : ['fanshot', 'vault'];
      scene.textures.addCanvas(`icon_${attack}${sfx}`, toCanvas(16, 16, look.iron ? ironCrossbowIcon() : owlFanIcon()));
      scene.textures.addCanvas(`icon_${special}${sfx}`, toCanvas(16, 16, look.iron ? chainNetIcon() : owlVaultIcon()));
      continue;
    }
    if (look.briar) {
      scene.textures.addCanvas(`icon_crossbow${sfx}`, toCanvas(16, 16, briarCrossbowIcon()));
      scene.textures.addCanvas(`icon_netbolt${sfx}`, toCanvas(16, 16, briarNetIcon()));
      continue;
    }
    if (look.wisteria) {
      scene.textures.addCanvas(`icon_fanshot${sfx}`, toCanvas(16, 16, petalFanIcon()));
      scene.textures.addCanvas(`icon_vault${sfx}`, toCanvas(16, 16, blossomVaultIcon()));
      continue;
    }
    if (look.arb) {
      scene.textures.addCanvas('icon_crossbow', toCanvas(16, 16, crossbowIcon()));
      scene.textures.addCanvas('icon_netbolt', toCanvas(16, 16, netBoltIcon()));
      continue;
    }
    if (look.elf) {
      scene.textures.addCanvas('icon_fanshot', toCanvas(16, 16, fanShotIcon()));
      scene.textures.addCanvas('icon_vault', toCanvas(16, 16, vaultIcon()));
      continue;
    }
    if (look.apollo) {
      scene.textures.addCanvas(`icon_bow${sfx}`, toCanvas(16, 16, sunBowIcon()));
      scene.textures.addCanvas(`icon_rain${sfx}`, toCanvas(16, 16, sunRainIcon()));
      continue;
    }
    const q = SKIN_QUIVERS[look.key] ?? (look.storm ? STORM_QUIVER : RANGER_QUIVER);
    scene.textures.addCanvas(`icon_bow${sfx}`, toCanvas(16, 16, bowIcon(q)));
    scene.textures.addCanvas(`icon_rain${sfx}`, toCanvas(16, 16, rainIcon(q, look.storm)));
  }
  // The falconer's short arrows ('arrow_falconer', '_snow' for Snowfeather),
  // her icons, and the birds that fly: her falcon, the snowy owl and the
  // Special's hawks ('bird_<kind>', frames f0..f5, g0..g1, d0..d1, k0..k3).
  for (const look of FALCONER_LOOKS) {
    const sfx = look.key.slice('archer'.length);
    const arrows = [
      ...frameList(Array.from({ length: ARROW_DIRS }, (_, i) => falconArrowFrame(i, look)), 'r'),
      ...frameList([0, 1, 2].map((k) => falconStuckFrame(k, look)), 'k'),
    ];
    register(scene, `arrow${sfx}`, pack(arrows, ARROW_SIZE, ARROW_SIZE), ARROW_SIZE, ARROW_SIZE);
    const tones = look.snow ? SNOWFEATHER_TONES : FALCONER_TONES;
    const isfx = look.snow ? '_snow' : '';
    scene.textures.addCanvas(`icon_quickshot${isfx}`, toCanvas(16, 16, quickShotIcon(tones)));
    scene.textures.addCanvas(`icon_falcon${isfx}`, toCanvas(16, 16, falconIcon(tones)));
  }
  for (const { key, bird } of HAWK_LOOKS) {
    register(scene, key, pack(hawkFrames(bird).map((f) => ({ name: f.name, r: f.canvas.render() })), HAWK_W, HAWK_H), HAWK_W, HAWK_H);
  }

  yield;
  // Each rogue look's smoke and icons ('rogue', 'rogue_dancer' for the shadow
  // dancer, and the skins' '_corsair', '_kitsune' and '_nightbloom').
  for (const look of ROGUE_LOOKS) {
    const sfx = look.key.slice('rogue'.length);
    const icons = ROGUE_ICONS[look.key];
    const tones: [number, number, number][] =
      look.key === 'rogue' ? [hex('#8a8898'), hex('#57546a'), hex('#34323f')] : look.key === 'rogue_dancer' ? [hex('#8a6ad8'), hex('#4a2c90'), hex('#24124e')] : icons.daggers.smoke.map(hex);
    scene.textures.addCanvas(`${look.key}_smoke`, toCanvas(16, 16, smokeCanvas(16, tones)));
    scene.textures.addCanvas(`icon_daggers${sfx}`, toCanvas(16, 16, daggersIcon(icons.daggers)));
    scene.textures.addCanvas(`icon_shadowstep${sfx}`, toCanvas(16, 16, shadowstepIcon(icons.daggers, icons.dance)));
  }
  // Nightbloom's moonflower petals, scattered by her shadow.
  scene.textures.addCanvas('rogue_petal', toCanvas(5, 5, petalCanvas()));
  // The gentleman thief's calling cards and the cobra's venom drops, flung the same way.
  scene.textures.addCanvas('rogue_card', toCanvas(5, 5, cardCanvas()));
  scene.textures.addCanvas('rogue_venom', toCanvas(5, 5, venomCanvas()));

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
  // The BarrowKnight's ghouls and headstones (the Graveyard's), plain and Mossgrave's, and his buttons.
  registerMonster(scene, 'ghoul', buildGhoulSheet(GRAVE_LOOK));
  registerMonster(scene, 'ghoul_moss', buildGhoulSheet(MOSS_GRAVE_LOOK));
  registerMonster(scene, 'headstones', buildStoneSheet(GRAVE_LOOK));
  registerMonster(scene, 'headstones_moss', buildStoneSheet(MOSS_GRAVE_LOOK));
  scene.textures.addCanvas('icon_spade', toCanvas(16, 16, spadeIcon()));
  scene.textures.addCanvas('icon_grave', toCanvas(16, 16, graveIcon()));
  scene.textures.addCanvas('icon_spade_mossgrave', toCanvas(16, 16, spadeIcon(MOSSGRAVE_ICON)));
  scene.textures.addCanvas('icon_grave_mossgrave', toCanvas(16, 16, graveIcon(MOSSGRAVE_ICON)));
  // The Reaper's Reap and Death's step, and the Catrina's.
  scene.textures.addCanvas('icon_reap', toCanvas(16, 16, reapIcon()));
  scene.textures.addCanvas('icon_deathstep', toCanvas(16, 16, deathStepIcon()));
  scene.textures.addCanvas('icon_reap_catrina', toCanvas(16, 16, reapIcon(true)));
  scene.textures.addCanvas('icon_deathstep_catrina', toCanvas(16, 16, deathStepIcon(true)));
  // The Lich's (and the Drowned King's) rime bolt and bone spikes.
  scene.textures.addCanvas('icon_rime', toCanvas(16, 16, rimeBoltIcon()));
  scene.textures.addCanvas('icon_bonespikes', toCanvas(16, 16, boneSpikesIcon()));
  scene.textures.addCanvas('icon_rime_drowned', toCanvas(16, 16, rimeBoltIcon(DROWNED_ICON)));
  scene.textures.addCanvas('icon_bonespikes_drowned', toCanvas(16, 16, boneSpikesIcon(DROWNED_ICON)));
  scene.textures.addCanvas('icon_soul_digger', toCanvas(16, 16, soulBoltIcon(DIGGER_ICON)));
  scene.textures.addCanvas('icon_raise_digger', toCanvas(16, 16, raiseIcon(DIGGER_ICON)));
  scene.textures.addCanvas('icon_lance_vampire', toCanvas(16, 16, bloodLanceIcon(VAMPIRE_ICON)));
  scene.textures.addCanvas('icon_nova_vampire', toCanvas(16, 16, novaIcon(VAMPIRE_ICON)));
  // The vampire lord's bats, wings up and down (see BatFlight in game/Souls.ts).
  scene.textures.addCanvas('vbat0', toCanvas(7, 5, batCanvas(true)));
  scene.textures.addCanvas('vbat1', toCanvas(7, 5, batCanvas(false)));

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
  // The vagabond's, the fadista's and Orpheus's: dandelion seeds, swallows and tiles, lyres; their instruments and songs.
  for (const look of [VAGABOND_LOOK, FADISTA_LOOK, ORPHEUS_LOOK, SKALD_LOOK]) {
    register(scene, look.key.replace('bard_', 'note_'), pack(frameList(Array.from({ length: NOTE_FRAMES }, (_, i) => noteFrame(i, look)), 'n'), NOTE_SIZE, NOTE_SIZE), NOTE_SIZE, NOTE_SIZE);
  }
  scene.textures.addCanvas('icon_lute_vagabond', toCanvas(16, 16, banjoIcon()));
  scene.textures.addCanvas('icon_lute_fadista', toCanvas(16, 16, guitarraIcon()));
  scene.textures.addCanvas('icon_lute_orpheus', toCanvas(16, 16, lyreIcon()));
  scene.textures.addCanvas('icon_song_vagabond', toCanvas(16, 16, skinSongIcon('vagabond')));
  scene.textures.addCanvas('icon_song_fadista', toCanvas(16, 16, skinSongIcon('fadista')));
  scene.textures.addCanvas('icon_song_orpheus', toCanvas(16, 16, skinSongIcon('orpheus')));
  // The skald's round lyre and runic song.
  scene.textures.addCanvas('icon_lute_skald', toCanvas(16, 16, skaldLyreIcon()));
  scene.textures.addCanvas('icon_song_skald', toCanvas(16, 16, skinSongIcon('skald')));
  scene.textures.addCanvas('icon_drum', toCanvas(16, 16, drumIcon()));
  scene.textures.addCanvas('icon_rhythm', toCanvas(16, 16, rhythmIcon()));
  scene.textures.addCanvas('icon_drum_howl', toCanvas(16, 16, drumIcon(HOWL_DRUM_ICON)));
  scene.textures.addCanvas('icon_rhythm_howl', toCanvas(16, 16, rhythmIcon(HOWL_DRUM_ICON)));
  scene.textures.addCanvas('icon_drum_taiko', toCanvas(16, 16, drumIcon(TAIKO_DRUM_ICON)));
  scene.textures.addCanvas('icon_rhythm_taiko', toCanvas(16, 16, rhythmIcon(TAIKO_DRUM_ICON)));

  yield;
  yield;
  // Each chronomancer look's bolts ('<key>_bolt_e', frames b0-b3); the clock over a slowed foe
  // ('chrono_mark_e', m0-m7, tinted in game); and the icons.
  for (const look of CHRONO_LOOKS) {
    register(scene, `${look.key}_bolt`, pack(frameList(Array.from({ length: BOLT_FRAMES }, (_, i) => boltFrame(i, look)), 'b'), BOLT_SIZE, BOLT_SIZE), BOLT_SIZE, BOLT_SIZE);
  }
  register(scene, 'chrono_mark', pack(frameList(Array.from({ length: MARK_FRAMES }, (_, i) => markFrame(i)), 'm'), MARK_SIZE, MARK_SIZE), MARK_SIZE, MARK_SIZE);
  for (const [suffix, k] of [['', BRASS_ICON], ['_moon', MOON_ICON], ['_clockwork', CLOCKWORK_ICON], ['_primavera', PRIMAVERA_ICON], ['_sandglass', SANDGLASS_ICON]] as const) {
    scene.textures.addCanvas(`icon_hand${suffix}`, toCanvas(16, 16, handIcon(k)));
    scene.textures.addCanvas(`icon_stasis${suffix}`, toCanvas(16, 16, stasisIcon(k)));
  }
  for (const [suffix, k] of [['', RIFT_ICON], ['_aeon', AEON_ICON], ['_anomaly', ANOMALY_ICON], ['_vhs', VHS_ICON]] as const) {
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
  scene.textures.addCanvas('icon_katana_tengu', toCanvas(16, 16, katanaIcon('#c4a4ff', '#48425a', ['#f2eaff', '#c4a4ff', '#8456d8', '#22143e'], 'feather')));
  scene.textures.addCanvas('icon_windblade_tengu', toCanvas(16, 16, dashIcon(['#f2eaff', '#c4a4ff', '#8456d8', '#22143e'], '#c4a4ff', 'feather')));
  scene.textures.addCanvas('icon_iai_snowfall', toCanvas(16, 16, katanaIcon('#d8f2ff', '#8e9ab4', null, 'snow')));
  scene.textures.addCanvas('icon_cross_snowfall', toCanvas(16, 16, crossIcon(['#ffffff', '#d8f2ff', '#88ccf4', '#3a74b0'], 'snow')));

  yield;
  // Energy ball and impact per spell look: 'orb'/'burst' (arcane), 'orb_void'/'burst_void', 'orb_pyro'/'burst_pyro'.
  for (const [suffix, k] of [['', ARCANE_SPELL], ['_void', VOID_SPELL], ['_pyro', PYRO_SPELL], ['_astral', ASTRAL_SPELL], ['_hell', HELL_SPELL], ['_soul', SOUL_SPELL], ['_blood', BLOOD_SPELL], ['_tomb', TOMB_SPELL], ['_wyrm', WYRM_SPELL], ['_digger', DIGGER_SPELL], ['_vampire', VAMPIRE_SPELL], ['_grove', GROVE_SPELL], ['_wild', WILD_SPELL], ['_autumn', AUTUMN_SPELL], ['_frost', FROST_SPELL], ['_tide', TIDE_SPELL], ['_abyss', ABYSS_SPELL], ['_titania', TITANIA_SPELL], ['_lotus', LOTUS_SPELL], ['_prism', PRISM_SPELL], ['_firebird', FIREBIRD_SPELL], ['_siren', SIREN_SPELL], ['_mycelia', MYCELIA_SPELL], ['_cinder', CINDER_SPELL]] as const) {
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
  scene.textures.addCanvas('icon_dawn', toCanvas(12, 12, skyIcon('dawn')));
  scene.textures.addCanvas('icon_dusk', toCanvas(12, 12, skyIcon('dusk')));
  scene.textures.addCanvas('icon_cycle', toCanvas(12, 12, skyIcon('cycle')));
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
    ['_master', MASTER_SABER_ICON, MASTER_FORCE_ICON],
    ['_nomad', NOMAD_SABER_ICON, NOMAD_FORCE_ICON],
  ];
  for (const [suffix, saber, force] of icons) {
    scene.textures.addCanvas(`icon_saber${suffix}`, toCanvas(16, 16, saberIcon(saber)));
    scene.textures.addCanvas(`icon_force${suffix}`, toCanvas(16, 16, forceIcon(force)));
  }
  // The Sith's saberstaff and lightning, and the Warlord's and the Dark Empress's.
  scene.textures.addCanvas('icon_staff', toCanvas(16, 16, staffIcon(SITH_STAFF_ICON)));
  scene.textures.addCanvas('icon_lightning', toCanvas(16, 16, lightningIcon(SITH_BOLT_ICON)));
  scene.textures.addCanvas('icon_staff_warlord', toCanvas(16, 16, staffIcon(WARLORD_STAFF_ICON)));
  scene.textures.addCanvas('icon_lightning_warlord', toCanvas(16, 16, lightningIcon(WARLORD_BOLT_ICON, [150, 70, 60])));
  // The Twin Blade's flurry and Riposte, and the Peacock's.
  scene.textures.addCanvas('icon_twin', toCanvas(16, 16, twinIcon(TWIN_ICON)));
  scene.textures.addCanvas('icon_riposte', toCanvas(16, 16, riposteIcon(TWIN_ICON)));
  scene.textures.addCanvas('icon_twin_peacock', toCanvas(16, 16, twinIcon(PEACOCK_ICON)));
  scene.textures.addCanvas('icon_riposte_peacock', toCanvas(16, 16, riposteIcon(PEACOCK_ICON)));
  // The Inquisitor's ring saber and leap, and the Voidhunter's.
  scene.textures.addCanvas('icon_ringsaber', toCanvas(16, 16, ringSaberIcon()));
  scene.textures.addCanvas('icon_hunterleap', toCanvas(16, 16, hunterLeapIcon()));
  scene.textures.addCanvas('icon_ringsaber_voidhunter', toCanvas(16, 16, ringSaberIcon(VOIDHUNTER_ICON)));
  scene.textures.addCanvas('icon_hunterleap_voidhunter', toCanvas(16, 16, hunterLeapIcon(VOIDHUNTER_ICON)));
  scene.textures.addCanvas('icon_staff_empress', toCanvas(16, 16, staffIcon(EMPRESS_STAFF_ICON)));
  scene.textures.addCanvas('icon_lightning_empress', toCanvas(16, 16, lightningIcon(EMPRESS_BOLT_ICON, [120, 96, 150])));

  yield;
  // Skins: the Astral's beam, the Hellfire's meteor and scorch, and the
  // Spartan's, Seraph's, Oathbreaker's and Temple guard's buttons.
  scene.textures.addCanvas('icon_beam_astral', toCanvas(16, 16, beamIcon(ASTRAL_SPELL)));
  scene.textures.addCanvas('icon_meteor_hell', toCanvas(16, 16, meteorIcon(HELL_SPELL)));
  const hellMeteors = scene.textures.addCanvas('pyro_meteor_hell', toCanvas(PYRO_METEOR_W * 3, PYRO_METEOR_H, sideBySide(PYRO_METEOR_W, PYRO_METEOR_H, [0, 1, 2].map((f) => pyroMeteor(f, HELL_METEOR)))))!;
  for (let i = 0; i < 3; i++) hellMeteors.add(`m${i}`, 0, i * PYRO_METEOR_W, 0, PYRO_METEOR_W, PYRO_METEOR_H);
  scene.textures.addCanvas('scorch_hell', toCanvas(48, 24, scorchCanvas(48, 24, FEL_EMBERS)));
  // The Pumpkin Witch's jack-o'-bolt (a burning jack-o'-lantern), its burst, and her pumpkin meteor, button and scorch.
  register(scene, 'orb_pumpkin', pack(frameList(Array.from({ length: ORB_FRAMES }, (_, i) => jackOrbFrame(i)), 'o'), ORB_SIZE, ORB_SIZE), ORB_SIZE, ORB_SIZE);
  register(scene, 'burst_pumpkin', pack(frameList(Array.from({ length: BURST_FRAMES }, (_, i) => burstFrame(i, PUMPKIN_SPELL)), 'b'), BURST_SIZE, BURST_SIZE), BURST_SIZE, BURST_SIZE);
  scene.anims.create({ key: 'orb_pumpkin_spin', frames: scene.anims.generateFrameNames('orb_pumpkin_e', { prefix: 'o', start: 0, end: ORB_FRAMES - 1 }), frameRate: 14, repeat: -1 });
  scene.anims.create({ key: 'burst_pumpkin_pop', frames: scene.anims.generateFrameNames('burst_pumpkin_e', { prefix: 'b', start: 0, end: BURST_FRAMES - 1 }), frameRate: 22, repeat: 0 });
  scene.textures.addCanvas('icon_meteor_pumpkin', toCanvas(16, 16, pumpkinMeteorIcon()));
  const pumpkinMeteors = scene.textures.addCanvas('pyro_meteor_pumpkin', toCanvas(PYRO_METEOR_W * 3, PYRO_METEOR_H, sideBySide(PYRO_METEOR_W, PYRO_METEOR_H, [0, 1, 2].map((f) => pyroMeteor(f, PUMPKIN_METEOR)))))!;
  for (let i = 0; i < 3; i++) pumpkinMeteors.add(`m${i}`, 0, i * PYRO_METEOR_W, 0, PYRO_METEOR_W, PYRO_METEOR_H);
  scene.textures.addCanvas('scorch_pumpkin', toCanvas(48, 24, scorchCanvas(48, 24, PUMPKIN_EMBERS)));
  // The Firebird: the bird itself plunging as the meteor, and its button.
  scene.textures.addCanvas('icon_meteor_firebird', toCanvas(16, 16, firebirdMeteorIcon()));
  const firebirdMeteors = scene.textures.addCanvas('pyro_meteor_firebird', toCanvas(PYRO_METEOR_W * 3, PYRO_METEOR_H, sideBySide(PYRO_METEOR_W, PYRO_METEOR_H, [0, 1, 2].map((f) => firebirdMeteor(f)))))!;
  for (let i = 0; i < 3; i++) firebirdMeteors.add(`m${i}`, 0, i * PYRO_METEOR_W, 0, PYRO_METEOR_W, PYRO_METEOR_H);
  scene.textures.addCanvas('scorch_firebird', toCanvas(48, 24, scorchCanvas(48, 24, FIREBIRD_EMBERS)));
  scene.textures.addCanvas('icon_beam_prism', toCanvas(16, 16, prismBeamIcon()));
  scene.textures.addCanvas('icon_sword_spartan', toCanvas(16, 16, swordIcon({ blade: '#dfe8f7', bladeDark: '#8d9dbd', tip: '#f4f8ff', guard: '#cc8c3e', guardLit: '#f4d08a', guardDark: '#955a24', grip: '#6e3a20', ink: '#140904' })));
  scene.textures.addCanvas('icon_whirl_spartan', toCanvas(16, 16, whirlIcon([hex('#fff0e8'), hex('#ff9a80'), hex('#f03a3a'), hex('#8a0a1a')])));
  // The Headless Knight's (Hallow's Eve): the notched, smouldering blade and a whirl round a jack-o'-lantern.
  scene.textures.addCanvas('icon_sword_headless', toCanvas(16, 16, hollowSwordIcon()));
  scene.textures.addCanvas('icon_whirl_headless', toCanvas(16, 16, lanternWhirlIcon()));
  // The King's and Afonso Henriques's buttons.
  scene.textures.addCanvas('icon_sword_king', toCanvas(16, 16, swordIcon({ blade: '#e4ecf8', bladeDark: '#8d9dbd', tip: '#f8fbff', guard: '#f4cf6a', guardLit: '#fff4bf', guardDark: '#9a5a26', grip: '#6c2c96', ink: '#0c0414' })));
  scene.textures.addCanvas('icon_decree', toCanvas(16, 16, decreeIcon(KING_TONES)));
  scene.textures.addCanvas('icon_sword_afonso', toCanvas(16, 16, swordIcon({ blade: '#d6dce8', bladeDark: '#7a869c', tip: '#f4f8ff', guard: '#5e6878', guardLit: '#98a2b4', guardDark: '#252a34', grip: '#6a3d26', ink: '#06070a' })));
  scene.textures.addCanvas('icon_decree_afonso', toCanvas(16, 16, decreeIcon(AFONSO_TONES)));
  // The Dragonslayer's burning jagged blade and a whirl of dragonfire round a horned skull; the Sun King's sun-pommelled sword and his sun over the decree.
  scene.textures.addCanvas('icon_sword_dragon', toCanvas(16, 16, dragonSwordIcon()));
  scene.textures.addCanvas('icon_whirl_dragon', toCanvas(16, 16, dragonWhirlIcon()));
  scene.textures.addCanvas('icon_sword_sunking', toCanvas(16, 16, sunSwordIcon()));
  scene.textures.addCanvas('icon_decree_sunking', toCanvas(16, 16, sunDecreeIcon()));
  scene.textures.addCanvas('icon_mace_seraph', toCanvas(16, 16, seraphMaceIcon()));
  scene.textures.addCanvas('icon_sanctuary_seraph', toCanvas(16, 16, dawnGroundIcon()));
  scene.textures.addCanvas('icon_hammer_oath', toCanvas(16, 16, oathHammerIcon()));
  scene.textures.addCanvas('icon_sunfall_oath', toCanvas(16, 16, eclipseFallIcon()));
  // The Lionheart's and the Inquisitor's buttons.
  scene.textures.addCanvas('icon_mace_lion', toCanvas(16, 16, lionMaceIcon()));
  scene.textures.addCanvas('icon_sanctuary_lion', toCanvas(16, 16, lionGroundIcon()));
  scene.textures.addCanvas('icon_hammer_inquisitor', toCanvas(16, 16, inquisitorHammerIcon()));
  scene.textures.addCanvas('icon_sunfall_inquisitor', toCanvas(16, 16, purgeFallIcon()));
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
  // Critters: one lit sheet of every frame ('critters'), a looping animation
  // each ('critter_<id>', wings beating faster than feet walk); each in its
  // glass jar ('jars', 'jar_<id>', and 'empty' for one not caught yet); the
  // net's swing ('net', n0..n4) and its button icon.
  register(scene, 'critters', pack(critterFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), CRITTER_W, CRITTER_H), CRITTER_W, CRITTER_H);
  const jars: { name: string; r: RenderedFrame }[] = [{ name: 'empty', r: jarFrame(null, 0).render() }];
  for (const def of CRITTERS) {
    for (let f = 0; f < CRITTER_FRAMES; f++) jars.push({ name: `${def.id}_${f}`, r: jarFrame(def.id, f, def.gait === 'fly', def.glow).render() });
  }
  register(scene, 'jars', pack(jars, JAR_W, JAR_H), JAR_W, JAR_H);
  for (const id of Object.keys(CRITTER_ART)) {
    const fly = CRITTERS.find((d) => d.id === id)?.gait === 'fly';
    const frames = Array.from({ length: CRITTER_FRAMES }, (_, f) => f);
    scene.anims.create({ key: `critter_${id}`, frames: frames.map((f) => ({ key: 'critters', frame: `${id}_${f}` })), frameRate: fly ? 12 : 6, repeat: -1 });
    scene.anims.create({ key: `jar_${id}`, frames: frames.map((f) => ({ key: 'jars', frame: `${id}_${f}` })), frameRate: fly ? 8 : 4, repeat: -1 });
  }
  register(scene, 'net', pack(NET_ANGLES.map((a, i) => ({ name: `n${i}`, r: netFrame(a).render() })), NET_SIZE, NET_SIZE), NET_SIZE, NET_SIZE, false);
  scene.textures.addCanvas('icon_net', toCanvas(16, 16, netIcon().render().diffuse));
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
  scene.textures.addCanvas('icon_thorn_titania', toCanvas(16, 16, blossomSeedIcon()));
  scene.textures.addCanvas('icon_grove_titania', toCanvas(16, 16, faerieRingIcon()));
  scene.textures.addCanvas('icon_claws_frost', toCanvas(16, 16, clawsIcon(FROST_TONES)));
  scene.textures.addCanvas('icon_pounce_frost', toCanvas(16, 16, pounceIcon(FROST_TONES)));
  scene.textures.addCanvas('icon_thorn_mycelia', toCanvas(16, 16, sporeIcon()));
  scene.textures.addCanvas('icon_grove_mycelia', toCanvas(16, 16, shroomRingIcon()));
  scene.textures.addCanvas('icon_claws_cinder', toCanvas(16, 16, clawsIcon(CINDER_TONES)));
  scene.textures.addCanvas('icon_pounce_cinder', toCanvas(16, 16, pounceIcon(CINDER_TONES)));
  // The Tidecaller's wave, and the Abyssal's.
  scene.textures.addCanvas('icon_wave', toCanvas(16, 16, waveIcon()));
  scene.textures.addCanvas('icon_wave_abyss', toCanvas(16, 16, waveIcon(ABYSS_TONES)));
  scene.textures.addCanvas('icon_wave_lotus', toCanvas(16, 16, lilyWaveIcon()));
  scene.textures.addCanvas('icon_wave_siren', toCanvas(16, 16, sunsetWaveIcon()));
  scene.textures.addCanvas('icon_spear_sun', toCanvas(16, 16, spearIcon(false, SUN_INK, SUN_TONES)));
  scene.textures.addCanvas('icon_spearthrow_sun', toCanvas(16, 16, spearThrowIcon(SUN_TONES)));
  scene.textures.addCanvas('icon_spear_swan', toCanvas(16, 16, swanSpearIcon()));
  scene.textures.addCanvas('icon_spearthrow_swan', toCanvas(16, 16, swanThrowIcon()));
  scene.textures.addCanvas('icon_spear_raven', toCanvas(16, 16, spearIcon(true, RAVEN_INK, RAVEN_TONES)));
  scene.textures.addCanvas('icon_dive_raven', toCanvas(16, 16, diveIcon(RAVEN_TONES)));
  scene.textures.addCanvas('icon_spear_amazon', toCanvas(16, 16, amazonSpearIcon()));
  scene.textures.addCanvas('icon_spearthrow_amazon', toCanvas(16, 16, amazonThrowIcon()));
  scene.textures.addCanvas('icon_spear_north', toCanvas(16, 16, auroraSpearIcon()));
  scene.textures.addCanvas('icon_dive_north', toCanvas(16, 16, auroraDiveIcon()));

  // The Automaton's icons; the Synth's drones hover on a loop ('drone_spin',
  // 'drone_hive_spin').
  for (const look of SYNTH_LOOKS) {
    // (The Vaporwave's 'drone_vapor' are dolphins, swimming at a slower beat.)
    const dk = look.hive ? 'drone_hive' : look.vapor ? 'drone_vapor' : 'drone';
    register(scene, dk, pack(frameList(Array.from({ length: DRONE_FRAMES }, (_, f) => droneFrame(f, look.hive, look.vapor)), 'd'), DRONE_SIZE, DRONE_SIZE), DRONE_SIZE, DRONE_SIZE);
    scene.anims.create({ key: `${dk}_spin`, frames: Array.from({ length: DRONE_FRAMES }, (_, f) => ({ key: dk, frame: `d${f}` })), frameRate: look.hive ? 24 : look.vapor ? 8 : 16, repeat: -1 });
  }
  // What the mechs fire, in sixteen headings each ('shell_0'.. 'rocket_15'), and the lock-on reticle.
  const bolts = BOLT_KINDS.flatMap((k) => frameList(Array.from({ length: BOLT_DIRS }, (_, i) => mechBolt(k, i)), `${k}_`));
  register(scene, 'mech_bolt', pack(bolts, MECH_BOLT_SIZE, MECH_BOLT_SIZE), MECH_BOLT_SIZE, MECH_BOLT_SIZE);
  scene.textures.addCanvas('mech_reticle', toCanvas(13, 13, reticle()));
  // The Phantom's haunted things thrown ('haunt', by kind), the wisps ('soulwisp',
  // 'soulwisp_petal', 'soulwisp_firefly' and 'soulwisp_ferry', flickering on a loop), the possession marks, the Dead of
  // Night's dark, and the icons.
  register(scene, 'haunt', pack(HAUNT_KINDS.map((k) => ({ name: k, r: hauntFrame(k).render() })), HAUNT_SIZE, HAUNT_SIZE), HAUNT_SIZE, HAUNT_SIZE);
  for (const [key, petal, fly, ferry] of [['soulwisp', false, false, false], ['soulwisp_petal', true, false, false], ['soulwisp_firefly', false, true, false], ['soulwisp_ferry', false, false, true]] as const) {
    register(scene, key, pack(frameList(Array.from({ length: WISP_FRAMES }, (_, f) => wispFrame(f, petal, fly, ferry)), 'w'), WISP_SIZE, WISP_SIZE), WISP_SIZE, WISP_SIZE);
    scene.anims.create({ key: `${key}_flicker`, frames: Array.from({ length: WISP_FRAMES }, (_, f) => ({ key, frame: `w${f}` })), frameRate: petal || fly ? 8 : 12, repeat: -1 });
  }
  const possessMarks = [{ name: 'w', r: possessMark(false).render() }, { name: 'c', r: possessMark(true).render() }, { name: 'f', r: possessMark(false, true).render() }, { name: 'r', r: possessMark(false, false, true).render() }];
  register(scene, 'possess_mark', pack(possessMarks, POSSESS_MARK, POSSESS_MARK), POSSESS_MARK, POSSESS_MARK);
  scene.textures.addCanvas('night_hole', toCanvas(128, 128, nightHole()));
  scene.textures.addCanvas('icon_hurl', toCanvas(16, 16, hurlIcon()));
  scene.textures.addCanvas('icon_rattle', toCanvas(16, 16, rattleIcon()));
  scene.textures.addCanvas('icon_hurl_tea', toCanvas(16, 16, hurlIcon(true)));
  scene.textures.addCanvas('icon_rattle_tea', toCanvas(16, 16, rattleIcon(true)));
  // The Force Sage's stones ('sage_stone', the Starseer's 'sage_meteor': '<rock|slab>_<turn>') and her buttons.
  for (const meteor of [false, true]) {
    register(scene, stoneKey(meteor), pack(stoneFrames(meteor).map((f) => ({ name: f.name, r: f.canvas.render() })), STONE_SIZE, STONE_SIZE), STONE_SIZE, STONE_SIZE);
  }
  scene.textures.addCanvas('icon_forcethrow', toCanvas(16, 16, throwIcon(SAGE_TONES)));
  scene.textures.addCanvas('icon_barrier', toCanvas(16, 16, barrierIcon(SAGE_TONES)));
  scene.textures.addCanvas('icon_forcethrow_starseer', toCanvas(16, 16, throwIcon(STARSEER_TONES, true)));
  scene.textures.addCanvas('icon_barrier_starseer', toCanvas(16, 16, barrierIcon(STARSEER_TONES)));
  scene.textures.addCanvas('icon_hurl_banshee', toCanvas(16, 16, bansheeHurlIcon()));
  scene.textures.addCanvas('icon_rattle_banshee', toCanvas(16, 16, keenIcon()));
  scene.textures.addCanvas('icon_lantern', toCanvas(16, 16, lanternIcon()));
  scene.textures.addCanvas('icon_possess', toCanvas(16, 16, possessIcon()));
  scene.textures.addCanvas('icon_lantern_cala', toCanvas(16, 16, lanternIcon(true)));
  scene.textures.addCanvas('icon_possess_cala', toCanvas(16, 16, possessIcon(true)));
  scene.textures.addCanvas('icon_lantern_firefly', toCanvas(16, 16, lanternIcon(false, true)));
  scene.textures.addCanvas('icon_possess_firefly', toCanvas(16, 16, possessIcon(false, true)));
  scene.textures.addCanvas('icon_lantern_ferry', toCanvas(16, 16, ferryLanternIcon()));
  scene.textures.addCanvas('icon_possess_ferry', toCanvas(16, 16, possessIcon(false, false, true)));
  // The Inventor's turret ('turret': unfolding 'b0'..'b4', turned 'h0'..'h7'
  // and firing 'f0'..'f7'), and its icons. The Engineer and the Scientist
  // themselves are hero sheets (see heroSheets.ts).
  // Forgebeard's stone-and-brass sentries are 'turret_forge', framed the same.
  for (const [key, forge] of [['turret', false], ['turret_forge', true]] as const) {
    const turret = [
      ...Array.from({ length: TURRET_BUILD }, (_, i) => ({ name: `b${i}`, r: turretFrame(2, i / (TURRET_BUILD - 1) * 0.9, 0, forge).render() })),
      ...Array.from({ length: TURRET_HEADINGS }, (_, i) => ({ name: `h${i}`, r: turretFrame(i, 1, 0, forge).render() })),
      ...Array.from({ length: TURRET_HEADINGS }, (_, i) => ({ name: `f${i}`, r: turretFrame(i, 1, 1, forge).render() })),
    ];
    register(scene, key, pack(turret, TURRET_SIZE, TURRET_SIZE), TURRET_SIZE, TURRET_SIZE);
  }
  scene.textures.addCanvas('icon_wrench', toCanvas(16, 16, wrenchIcon()));
  scene.textures.addCanvas('icon_turret', toCanvas(16, 16, turretIcon()));
  scene.textures.addCanvas('icon_tesla', toCanvas(16, 16, teslaIcon()));
  scene.textures.addCanvas('icon_orb', toCanvas(16, 16, orbIcon()));
  scene.textures.addCanvas('icon_tesla_einstein', toCanvas(16, 16, teslaIcon(true)));
  scene.textures.addCanvas('icon_orb_einstein', toCanvas(16, 16, orbIcon(true)));
  scene.textures.addCanvas('icon_wrench_forgebeard', toCanvas(16, 16, hammerWrenchIcon()));
  scene.textures.addCanvas('icon_turret_forgebeard', toCanvas(16, 16, runeTurretIcon()));
  scene.textures.addCanvas('icon_tesla_tesla', toCanvas(16, 16, teslaIcon(false, true)));
  scene.textures.addCanvas('icon_orb_tesla', toCanvas(16, 16, coilOrbIcon()));
  // The Beastkin: the eagle's razor feathers ('feather_<look>': headings
  // 'r0'..'r15'), the dragon's firebolts ('firebolt_<look>': flickering
  // 'f0'..'f3'), and the buttons. The beasts themselves are hero sheets.
  for (const look of [EAGLE_LOOK, BENFICA_LOOK, PHOENIX_LOOK]) {
    register(scene, `feather_${look.key}`, pack(frameList(Array.from({ length: FEATHER_DIRS }, (_, i) => featherFrame(i, look)), 'r'), FEATHER_SIZE, FEATHER_SIZE), FEATHER_SIZE, FEATHER_SIZE);
    scene.textures.addCanvas(`icon_feather_${look.key}`, toCanvas(16, 16, featherIcon(look)));
    scene.textures.addCanvas(`icon_gust_${look.key}`, toCanvas(16, 16, gustIcon(look)));
  }
  for (const look of [LION_LOOK, SPORTING_LOOK, NEMEAN_LOOK]) {
    scene.textures.addCanvas(`icon_claw_${look.key}`, toCanvas(16, 16, clawIcon(look)));
    scene.textures.addCanvas(`icon_roar_${look.key}`, toCanvas(16, 16, roarIcon(look)));
  }
  for (const look of [DRAGON_LOOK, PORTO_LOOK, JADE_SERPENT_LOOK]) {
    register(scene, `firebolt_${look.key}`, pack(frameList(Array.from({ length: FIREBOLT_FRAMES }, (_, i) => fireboltFrame(i, look)), 'f'), FIREBOLT_SIZE, FIREBOLT_SIZE), FIREBOLT_SIZE, FIREBOLT_SIZE);
    scene.textures.addCanvas(`icon_fire_${look.key}`, toCanvas(16, 16, fireIcon(look)));
    scene.textures.addCanvas(`icon_breath_${look.key}`, toCanvas(16, 16, breathIcon(look)));
  }
  // The Bear's buttons ('icon_maul_<look>', 'icon_quake_<look>'); his effects are drawn live.
  registerBearIcons((key, px) => scene.textures.addCanvas(key, toCanvas(16, 16, px)));
  // The Aviator's biplane, its bombs and her buttons (she herself is a hero sheet).
  aviatorTextures(fxRegistrar(scene));
  // The Pyrotechnist's buttons: the Roman candle and the firecrackers, in each look.
  for (const [key, px] of pyroIcons()) scene.textures.addCanvas(key, toCanvas(16, 16, px));

  scene.textures.addCanvas('icon_cannon', toCanvas(16, 16, cannonIcon()));
  scene.textures.addCanvas('icon_salvo', toCanvas(16, 16, salvoIcon()));
  scene.textures.addCanvas('icon_cannon_scrap', toCanvas(16, 16, cannonIcon(true)));
  scene.textures.addCanvas('icon_salvo_scrap', toCanvas(16, 16, salvoIcon(true)));
  scene.textures.addCanvas('icon_cannon_dread', toCanvas(16, 16, dreadCannonIcon()));
  scene.textures.addCanvas('icon_salvo_dread', toCanvas(16, 16, dreadSalvoIcon()));
  scene.textures.addCanvas('icon_drone', toCanvas(16, 16, droneIcon()));
  scene.textures.addCanvas('icon_grid', toCanvas(16, 16, gridIcon()));
  scene.textures.addCanvas('icon_drone_hive', toCanvas(16, 16, droneIcon(true)));
  scene.textures.addCanvas('icon_grid_hive', toCanvas(16, 16, gridIcon(true)));
  scene.textures.addCanvas('icon_drone_vapor', toCanvas(16, 16, vaporDroneIcon()));
  scene.textures.addCanvas('icon_grid_vapor', toCanvas(16, 16, vaporGridIcon()));
  // The Lightwright's prisms ('lw_prism_<look>', turning 'p0'..'p7') and his buttons.
  lightwrightFx(fxRegistrar(scene));
  registerTransmuterIcons((key, px) => scene.textures.addCanvas(key, toCanvas(16, 16, px)));
  registerAquanautArt(scene);
  // The Brewmaster's rolling keg ('keg_<look>': headings 'h0'..'h7', each
  // turned through 8 roll frames, 'h<h>_<r>') and his buttons. He himself is a
  // hero sheet.
  for (const look of BREW_LOOKS) {
    register(scene, kegKey(look), pack(kegFrames(look).map((f) => ({ name: f.name, r: f.canvas.render() })), KEG_SIZE, KEG_SIZE), KEG_SIZE, KEG_SIZE);
    const sfx = look.jarl ? '_jarl' : '';
    scene.textures.addCanvas(`icon_paddle${sfx}`, toCanvas(16, 16, paddleIcon(look)));
    scene.textures.addCanvas(`icon_firebreath${sfx}`, toCanvas(16, 16, brewFireIcon(look)));
  }

  yield;
  // Items: hotbar icons and the bottles monsters drop.
  for (const kind of ['health', 'speed'] as const) {
    scene.textures.addCanvas(`item_${kind}`, toCanvas(ITEM_ICON_SIZE, ITEM_ICON_SIZE, potionIcon(kind)));
    scene.textures.addCanvas(`drop_${kind}`, toCanvas(DROP_W, DROP_H, potionDrop(kind)));
  }
  // Star dust on the ground (an Omen's, a chest's) and the wave arenas' blessings: wanted
  // in more than one arena, so made here rather than with any one arena's set.
  scene.textures.addCanvas('dust_drop', dustDrop().toCanvas());
  for (const kind of ['might', 'swift', 'vigor', 'fang', 'ward', 'renew', 'surge', 'fortune'] as BlessingIcon[]) scene.textures.addCanvas(`blessing_${kind}`, toCanvas(16, 16, blessingIcon(kind)));
  yield;
  // Gear: 32x32 icons for the bag, 16x16 sprites for the ground, and the bag's chest button.
  for (const g of GEAR) {
    const art = gearArt(g.id);
    scene.textures.addCanvas(g.icon, toCanvas(GEAR_ICON, GEAR_ICON, art.icon));
    scene.textures.addCanvas(g.drop, toCanvas(GEAR_DROP, GEAR_DROP, art.drop));
  }
  scene.textures.addCanvas('icon_chest', toCanvas(16, 16, chestIcon()));
  registerInventoryArt(scene);
  for (const m of materialIcons()) scene.textures.addCanvas(matIcon(m.set), m.canvas);

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
  // The spirits (which Omens call up in other arenas too). Their queen and
  // the Cosmos's Warden are bosses of one arena each, so they're built with
  // its set, behind its loading screen.
  registerMonster(scene, 'wisp', buildWispSheet());
  registerMonster(scene, 'shade', buildShadeSheet());
  registerMonster(scene, 'banshee', buildBansheeSheet());
  register(scene, 'thorns', pack(frameList([0, 1, 2].map(thornFrame), 't'), THORN_W, THORN_H), THORN_W, THORN_H, false);
  scene.textures.addCanvas('venom', toCanvas(7, 7, venomGlob()));
  const ring = ringCanvas(22, 12);
  scene.textures.addCanvas('danger_ring', toCanvas(ring.w, ring.h, ring.px));

  // The Myth sets' powers (game/setFx.ts), which may be worn in any arena:
  // Amethrax's crystal spikes and breath shards, the Warden's falling star.
  register(scene, 'set_spike', pack(frameList([crystalSpike(0), crystalSpike(1), crystalSpike(2)], 'k'), SPIKE_W, SPIKE_H), SPIKE_W, SPIKE_H);
  register(scene, 'set_shard', pack(frameList([breathShard()], 's'), BREATH_SHARD, BREATH_SHARD), BREATH_SHARD, BREATH_SHARD);
  scene.textures.addCanvas('set_meteor', toCanvas(METEOR_W, METEOR_H, meteor()));
  scene.textures.addCanvas('set_pool', toCanvas(64, 26, lightPool(64, 26)));

  register(scene, 'dummy', pack(frameList([dummyFrame(false), dummyFrame(true)], 'd'), 18, 28), 18, 28, false);

  yield;
  // Hallow's Eve: the gourdling, the hexbat and the Pumpkin King, who may
  // turn up in any arena, so they're built with the base monsters. With the
  // King's spells: bombs 'b0..' ('g0..' ghost-green), the vines his gourdlings
  // sprout from, his lash's sweep and the flames bombs leave (light only).
  registerMonster(scene, 'gourdling', buildGourdlingSheet());
  registerMonster(scene, 'hexbat', buildHexbatSheet());
  registerMonster(scene, 'pumpkin_king', buildPumpkinKingSheet());
  const both = <T,>(f: (i: number, ghost: boolean) => T, n: number) => [...Array.from({ length: n }, (_, i) => f(i, false)), ...Array.from({ length: n }, (_, i) => f(i, true))];
  const named = (canvases: PixelCanvas[], n: number) => canvases.map((c, i) => ({ name: `${i < n ? 'o' : 'g'}${i % n}`, r: c.render() }));
  register(scene, 'hw_bomb', pack(named(both(pumpkinBomb, BOMB_FRAMES), BOMB_FRAMES), BOMB_SIZE, BOMB_SIZE), BOMB_SIZE, BOMB_SIZE);
  register(scene, 'hw_sprout', pack(frameList(Array.from({ length: SPROUT_FRAMES }, (_, i) => sproutFrame(i)), 's'), SPROUT_W, SPROUT_H), SPROUT_W, SPROUT_H);
  register(scene, 'hw_lash', pack(named(both(lashFrame, LASH_FRAMES), LASH_FRAMES), LASH_W, LASH_H, 8), LASH_W, LASH_H);
  register(scene, 'hw_flame', pack(named(both(flameFrame, HW_FLAME_FRAMES), HW_FLAME_FRAMES), HW_FLAME_W, HW_FLAME_H), HW_FLAME_W, HW_FLAME_H);
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
  yield;
  // The Astral Warden, its Myth.
  registerMonster(scene, 'warden', buildWardenSheet());
  yield;
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

/**
 * Sky Glide: the sea of clouds far below, cloud tops, the islets and the
 * goal, rings, updraft swirls, wind streaks and the finish arch. It flies
 * off the Floating Island, whose own set it uses too (see warmGlide).
 */
function* glideTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const sea = yield* seaTile();
  scene.textures.addCanvas('gl_sea', toCanvas(SEA_TILE, SEA_TILE, sea));
  yield;
  [0, 1, 2].forEach((v) => scene.textures.addCanvas(`gl_puff${v}`, deckPuff(v).toCanvas()));
  yield;
  for (let i = 0; i < SKY_ISLETS.length; i++) {
    scene.textures.addCanvas(`gl_islet${i}`, isletArt(SKY_ISLETS[i]).img.toCanvas());
    yield;
  }
  scene.textures.addCanvas('gl_goal', isletArt(GOAL).img.toCanvas());
  yield;
  for (const [key, big, prefix] of [
    ['gl_ring', false, 'g'],
    ['gl_ring_big', true, 'b'],
  ] as const) {
    const size = big ? RING.big.size : RING.gold.size;
    const tex = scene.textures.addCanvas(key, toCanvas(size * RING_FRAMES, size, sideBySide(size, size, Array.from({ length: RING_FRAMES }, (_, f) => ringFrame(big, f).data))))!;
    for (let f = 0; f < RING_FRAMES; f++) tex.add(`${prefix}${f}`, 0, f * size, 0, size, size);
    if (!scene.anims.exists(`${key}_spin`)) scene.anims.create({ key: `${key}_spin`, frames: scene.anims.generateFrameNames(key, { prefix, start: 0, end: RING_FRAMES - 1 }), frameRate: 10, repeat: -1 });
  }
  const draft = scene.textures.addCanvas('gl_draft', toCanvas(DRAFT_W * DRAFT_FRAMES, DRAFT_H, sideBySide(DRAFT_W, DRAFT_H, Array.from({ length: DRAFT_FRAMES }, (_, f) => draftFrame(f).data))))!;
  for (let f = 0; f < DRAFT_FRAMES; f++) draft.add(`d${f}`, 0, f * DRAFT_W, 0, DRAFT_W, DRAFT_H);
  if (!scene.anims.exists('gl_draft_spin')) scene.anims.create({ key: 'gl_draft_spin', frames: scene.anims.generateFrameNames('gl_draft', { prefix: 'd', start: 0, end: DRAFT_FRAMES - 1 }), frameRate: 9, repeat: -1 });
  scene.textures.addCanvas('gl_streak', windStreak().toCanvas());
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('gl_arch', archArt().toCanvas());
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
  scene.textures.addCanvas('rift_done', toCanvas(1, 1, new Uint8ClampedArray(4)));
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
  yield;
  // The Hollow Queen, its Legend.
  registerMonster(scene, 'queen', buildQueenSheet());
  yield;
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

/**
 * The trees' sway (see art/trees.ts): every frame of every tree on 'tree_sway',
 * and an animation `tree_<kind><v>` for each, starting on its still frame.
 * Built a frame at a time in the background (see game/treeSway.ts), so the
 * boot only pays for the still trees.
 */
export function* treeSwayTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const frames: { name: string; r: RenderedFrame }[] = [];
  for (let v = 0; v < TREE_VARIANTS; v++) {
    for (const kind of ['oak', 'birch', 'pine'] as const) {
      for (let f = 0; f < TREE_SWAY_FRAMES; f++) {
        frames.push({ name: `${kind}${v}_${f}`, r: treeFrame(kind, v, f).render() });
        yield;
      }
    }
  }
  if (!scene.textures.exists('tree_sway')) register(scene, 'tree_sway', pack(frames, TREE_W, TREE_H, 9), TREE_W, TREE_H, false);
  yield;
  for (let v = 0; v < TREE_VARIANTS; v++) {
    for (const kind of ['oak', 'birch', 'pine'] as const) {
      const key = `tree_${kind}${v}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({ key, frames: Array.from({ length: TREE_SWAY_FRAMES }, (_, f) => ({ key: 'tree_sway', frame: `${kind}${v}_${f}` })), frameRate: TREE_SWAY_FPS, repeat: -1 });
    }
  }
}

/**
 * The Omens' art (see art/omens.ts): the Treasure Imp, portals, meteors and
 * star ore, the merchant and his rug, the shrine, fog, dust and the omens'
 * icons. Built a step at a time in the background once an arena with omens
 * is entered, long before the first one comes.
 */
export function* omenTextures(scene: Phaser.Scene): Generator<void, void, void> {
  // A looping animation on a texture and on its glow alike: '<key>_loop' and '<key>_e_loop'.
  const loop = (key: string, prefix: string, frames: number, fps: number) => {
    for (const layer of [key, `${key}_e`]) {
      scene.anims.create({ key: `${layer}_loop`, frames: scene.anims.generateFrameNames(layer, { prefix, start: 0, end: frames - 1 }), frameRate: fps, repeat: -1 });
    }
  };
  // Left half built by a world closed early, it carries on where it stopped.
  const has = (key: string) => scene.textures.exists(key);
  if (!has('imp')) registerMonster(scene, 'imp', buildImpSheet());
  yield;
  for (const kind of ['imp', 'rift'] as const) {
    if (has(`omen_portal_${kind}`)) continue;
    register(scene, `omen_portal_${kind}`, pack(frameList(Array.from({ length: PORTAL_FRAMES }, (_, f) => portalFrame(kind, f)), 'p'), PORTAL_W, PORTAL_H), PORTAL_W, PORTAL_H);
    loop(`omen_portal_${kind}`, 'p', PORTAL_FRAMES, 11);
    yield;
  }
  if (!has('omen_meteor')) {
    register(scene, 'omen_meteor', pack(frameList(Array.from({ length: METEOR_FRAMES }, (_, f) => meteorFrame(f)), 'm'), METEOR_SIZE, METEOR_SIZE), METEOR_SIZE, METEOR_SIZE);
    loop('omen_meteor', 'm', METEOR_FRAMES, 14);
  }
  if (!has('omen_ore')) {
    const ores: { name: string; r: RenderedFrame }[] = [];
    for (let v = 0; v < ORE_KINDS; v++) for (let s = 0; s < ORE_STAGES; s++) ores.push({ name: `o${v}${s}`, r: oreFrame(v, s).render() });
    register(scene, 'omen_ore', pack(ores, ORE_W, ORE_H), ORE_W, ORE_H, true, true);
    yield;
  }
  if (!has('omen_merchant')) {
    register(scene, 'omen_merchant', pack(frameList(Array.from({ length: MERCHANT_FRAMES }, (_, f) => merchantFrame(f)), 'f'), MERCHANT_W, MERCHANT_H), MERCHANT_W, MERCHANT_H);
    loop('omen_merchant', 'f', MERCHANT_FRAMES, 6);
  }
  if (!has('omen_rug')) register(scene, 'omen_rug', pack(frameList([rugArt()], 'r'), RUG_W, RUG_H), RUG_W, RUG_H, false);
  yield;
  if (!has('omen_shrine')) {
    register(scene, 'omen_shrine', pack(frameList(Array.from({ length: SHRINE_STAGES }, (_, s) => shrineFrame(s)), 's'), SHRINE_W, SHRINE_H), SHRINE_W, SHRINE_H);
    yield;
  }
  if (has('buff_unity')) return;
  for (const k of ['omen_fog', 'omen_scorch', 'omen_ring']) if (has(k)) scene.textures.remove(k);
  const fogs = [0, 1, 2].map(fogPuff);
  const fw = fogs[0].w;
  const fh = fogs[0].h;
  const fog = scene.textures.addCanvas('omen_fog', toCanvas(fw * 3, fh, sideBySide(fw, fh, fogs.map((b) => b.data))))!;
  fogs.forEach((_, i) => fog.add(i, 0, i * fw, 0, fw, fh));
  scene.textures.addCanvas('omen_scorch', scorchMark().toCanvas());
  scene.textures.addCanvas('omen_ring', runeRing().toCanvas());
  for (const id of ['blood', 'imp', 'meteor', 'golden', 'fog', 'rift', 'merchant', 'shrine'] as OmenIcon[]) {
    if (!has(`omen_icon_${id}`)) scene.textures.addCanvas(`omen_icon_${id}`, toCanvas(OMEN_ICON, OMEN_ICON, omenIcon(id)));
  }
  // Last, the Shrine of Unity's blessing as a buff's badge: its presence means everything above is built.
  scene.textures.addCanvas('buff_unity', toCanvas(OMEN_ICON, OMEN_ICON, omenIcon('unity')));
}

/**
 * The Everwood: its own trees (cherry, maple and willow, each swaying, and
 * the elder), its undergrowth, the shrine, chest, standing stones and camp,
 * and last the patch of ground its select card shows (from a fixed seed; a
 * run grows a forest of its own, painted as it is walked).
 */
function* forestTextures(scene: Phaser.Scene): Generator<void, void, void> {
  const trees: { name: string; r: RenderedFrame }[] = [];
  const draw = { cherry: cherryTree, maple: mapleTree, willow: willowTree };
  for (const kind of ['cherry', 'maple', 'willow'] as const) {
    for (let v = 0; v < TREE_VARIANTS; v++) {
      for (let f = 0; f < TREE_SWAY_FRAMES; f++) {
        trees.push({ name: f ? `${kind}${v}_${f}` : `${kind}${v}`, r: draw[kind](v, f).render() });
        yield;
      }
    }
  }
  register(scene, 'ftree', pack(trees, TREE_W, TREE_H, 9), TREE_W, TREE_H, false);
  for (const kind of ['cherry', 'maple', 'willow'] as const) {
    for (let v = 0; v < TREE_VARIANTS; v++) {
      const key = `ftree_${kind}${v}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: Array.from({ length: TREE_SWAY_FRAMES }, (_, f) => ({ key: 'ftree', frame: f ? `${kind}${v}_${f}` : `${kind}${v}` })), frameRate: TREE_SWAY_FPS, repeat: -1 });
    }
  }
  yield;
  const elder: { name: string; r: RenderedFrame }[] = [];
  for (let f = 0; f < TREE_SWAY_FRAMES; f++) {
    elder.push({ name: `e${f}`, r: elderTree(f).render() });
    yield;
  }
  register(scene, 'elder', pack(elder, ELDER_W, ELDER_H, 3), ELDER_W, ELDER_H);
  for (const layer of ['elder', 'elder_e']) {
    scene.anims.create({ key: `${layer}_sway`, frames: scene.anims.generateFrameNames(layer, { prefix: 'e', start: 0, end: TREE_SWAY_FRAMES - 1 }), frameRate: TREE_SWAY_FPS, repeat: -1 });
  }
  yield;
  register(scene, 'fprop', pack(FPROP_FRAMES.map((f) => ({ name: f.name, r: f.draw().render() })), FPROP_W, FPROP_H, 8), FPROP_W, FPROP_H);
  yield;
  const shrine = [...Array.from({ length: SHRINE_FRAMES }, (_, f) => ({ name: `s${f}`, r: shrineArt(f).render() })), { name: 'spent', r: shrineArt(0, true).render() }];
  register(scene, 'fshrine', pack(shrine, FSHRINE_W, FSHRINE_H, 5), FSHRINE_W, FSHRINE_H);
  for (const layer of ['fshrine', 'fshrine_e']) {
    scene.anims.create({ key: `${layer}_pulse`, frames: scene.anims.generateFrameNames(layer, { prefix: 's', start: 0, end: SHRINE_FRAMES - 1 }), frameRate: 4, repeat: -1 });
  }
  register(scene, 'fchest', pack([{ name: 'shut', r: chestArt(false).render() }, { name: 'open', r: chestArt(true).render() }], CHEST_W, CHEST_H, 2), CHEST_W, CHEST_H);
  register(scene, 'menhir', pack(frameList(Array.from({ length: MENHIR_LOOKS }, (_, v) => menhirArt(v)), 'm'), MENHIR_W, MENHIR_H), MENHIR_W, MENHIR_H);
  // The lookouts' parapet.
  register(scene, 'flook', pack([{ name: 'l0', r: lookoutArt().render() }], LOOKOUT_W, LOOKOUT_H, 1), LOOKOUT_W, LOOKOUT_H);
  // The wild places: the glowcap grove's great cap, the hunter's lean-to and drying rack, and the blessings they give.
  register(scene, 'fgreatcap', pack([{ name: 'g0', r: greatCapArt(false).render() }, { name: 'spent', r: greatCapArt(true).render() }], GREATCAP_W, GREATCAP_H, 2), GREATCAP_W, GREATCAP_H);
  register(scene, 'fhunt', pack([{ name: 'lean', r: leanToArt().render() }, { name: 'rack', r: rackArt().render() }], HUNT_W, HUNT_H, 2), HUNT_W, HUNT_H);
  scene.textures.addCanvas('buff_sun', toCanvas(16, 16, sunBuffIcon()));
  scene.textures.addCanvas('buff_moon', toCanvas(16, 16, moonBuffIcon()));
  scene.textures.addCanvas('buff_spore', toCanvas(16, 16, sporeBuffIcon()));
  register(scene, 'fcamp', pack(frameList(Array.from({ length: CAMPFIRE.frames }, (_, f) => CAMPFIRE.draw(f)), 'c'), CAMPFIRE.w, CAMPFIRE.h), CAMPFIRE.w, CAMPFIRE.h);
  for (const layer of ['fcamp', 'fcamp_e']) {
    scene.anims.create({ key: `${layer}_burn`, frames: scene.anims.generateFrameNames(layer, { prefix: 'c', start: 0, end: CAMPFIRE.frames - 1 }), frameRate: CAMPFIRE.fps, repeat: -1 });
  }
  yield;
  // The White Stag, its hoofprints, its blessing's badge and the secret places it leads to.
  register(scene, 'stag', pack(stagFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), STAG_W, STAG_H, 8), STAG_W, STAG_H);
  for (const a of STAG_ANIMS) {
    for (const layer of ['stag', 'stag_e']) {
      scene.anims.create({ key: `${layer}_${a.name}`, frames: scene.anims.generateFrameNames(layer, { prefix: a.name, start: 0, end: a.frames - 1 }), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
    }
  }
  scene.textures.addCanvas('stag_print', toCanvas(PRINT_W, PRINT_H, hoofprint()));
  scene.textures.addCanvas('buff_stag', toCanvas(16, 16, stagBuffIcon()));
  yield;
  register(scene, 'stag_spring', pack(frameList(Array.from({ length: SPRING_FRAMES }, (_, f) => springArt(f)), 'w'), SPRING_W, SPRING_H, 4), SPRING_W, SPRING_H);
  register(scene, 'stag_grove', pack(GROVE_FRAMES.map((n) => ({ name: n, r: groveFrame(n).render() })), GROVE_W, GROVE_H, 4), GROVE_W, GROVE_H);
  register(scene, 'stag_altar', pack([{ name: 'full', r: altarArt(false).render() }, { name: 'spent', r: altarArt(true).render() }], ALTAR_W, ALTAR_H, 2), ALTAR_W, ALTAR_H);
  register(scene, 'stag_hollow', pack(frameList(Array.from({ length: HOLLOW_FRAMES }, (_, f) => hollowArt(f)), 'h'), HOLLOW_W, HOLLOW_H, 3), HOLLOW_W, HOLLOW_H);
  for (const [key, prefix, n, fps] of [
    ['stag_spring', 'w', SPRING_FRAMES, 5],
    ['stag_hollow', 'h', HOLLOW_FRAMES, 3],
  ] as const) {
    for (const layer of [key, `${key}_e`]) scene.anims.create({ key: `${layer}_loop`, frames: scene.anims.generateFrameNames(layer, { prefix, start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  }
  for (const layer of ['stag_grove', 'stag_grove_e']) {
    const f = (names: string[]) => names.map((frame) => ({ key: layer, frame }));
    scene.anims.create({ key: `${layer}_veiled`, frames: f(['v0', 'v1']), frameRate: 2, repeat: -1 });
    scene.anims.create({ key: `${layer}_part`, frames: f(['p0', 'p1', 'p2', 'o0']), frameRate: 6, repeat: 0 });
    scene.anims.create({ key: `${layer}_open`, frames: f(['o0', 'o1']), frameRate: 2, repeat: -1 });
  }
  yield;
  // The wild things: deer, the fox, songbirds and the owl; the undergrowth bent by a gust, and the gust's own streaks.
  register(scene, 'fbend', pack(FPROP_BENDS.map((f) => ({ name: f.name, r: f.draw().render() })), FPROP_W, FPROP_H, 12), FPROP_W, FPROP_H, false);
  yield;
  register(scene, 'wdeer', pack(deerFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), DEER_W, DEER_H, 16), DEER_W, DEER_H, false);
  for (const look of DEER_LOOKS) {
    for (const a of DEER_ANIMS) scene.anims.create({ key: `wdeer_${look}_${a.name}`, frames: scene.anims.generateFrameNames('wdeer', { prefix: `${look}_${a.name}`, start: 0, end: a.frames - 1 }), frameRate: a.fps, repeat: -1 });
  }
  yield;
  register(scene, 'wfox', pack(foxFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), FOX_W, FOX_H, 12), FOX_W, FOX_H);
  for (const a of FOX_ANIMS) {
    for (const layer of ['wfox', 'wfox_e']) scene.anims.create({ key: `${layer}_${a.name}`, frames: scene.anims.generateFrameNames(layer, { prefix: a.name, start: 0, end: a.frames - 1 }), frameRate: a.fps, repeat: -1 });
  }
  register(scene, 'wbird', pack(birdFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), BIRD_W, BIRD_H, 16), BIRD_W, BIRD_H, false);
  for (const look of BIRD_LOOKS) {
    for (const a of BIRD_ANIMS) scene.anims.create({ key: `wbird_${look}_${a.name}`, frames: scene.anims.generateFrameNames('wbird', { prefix: `${look}_${a.name}`, start: 0, end: a.frames - 1 }), frameRate: a.fps, repeat: -1 });
  }
  register(scene, 'wowl', pack(owlFrames().map((f) => ({ name: f.name, r: f.canvas.render() })), OWL_W, OWL_H, 11), OWL_W, OWL_H);
  for (const a of OWL_ANIMS) {
    for (const layer of ['wowl', 'wowl_e']) scene.anims.create({ key: `${layer}_${a.name}`, frames: scene.anims.generateFrameNames(layer, { prefix: a.name, start: 0, end: a.frames - 1 }), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
  }
  const gust = new Uint8ClampedArray(GUST_W * GUST_FRAMES * GUST_H * 4);
  for (let f = 0; f < GUST_FRAMES; f++) {
    const px = gustFrame(f);
    for (let y = 0; y < GUST_H; y++) gust.set(px.subarray(y * GUST_W * 4, (y + 1) * GUST_W * 4), (y * GUST_W * GUST_FRAMES + f * GUST_W) * 4);
  }
  const gtex = scene.textures.addCanvas('wgust', toCanvas(GUST_W * GUST_FRAMES, GUST_H, gust))!;
  for (let f = 0; f < GUST_FRAMES; f++) gtex.add(`g${f}`, 0, f * GUST_W, 0, GUST_W, GUST_H);
  scene.anims.create({ key: 'wgust', frames: scene.anims.generateFrameNames('wgust', { prefix: 'g', start: 0, end: GUST_FRAMES - 1 }), frameRate: 10, repeat: 0 });
  yield;
  // Last, the select card's patch of ground: its presence means everything above is built.
  const gen = new ForestGen(EVERWOOD_SEED);
  const at = gen.spawn();
  const col = Math.floor(at.x / CHUNK);
  const row = Math.floor(at.y / STRIP_H);
  const strip = yield* buildStrip(forestTile(gen, col, row), row);
  scene.textures.addCanvas('fr_preview', toCanvas(strip.w, strip.h, strip.day.diffuse));
}

/** What a creature file registers its own spell textures through (see FxRegistrar in frostKit.ts). */
function fxRegistrar(scene: Phaser.Scene): FxRegistrar {
  return {
    frames: (key, list, w, h) => register(scene, key, pack(list.map((f) => ({ name: f.name, r: f.canvas.render() })), w, h, Math.max(1, Math.min(16, Math.floor(2048 / w)))), w, h),
    image: (key, w, h, px) => {
      scene.textures.addCanvas(key, toCanvas(w, h, px));
    },
    strip: (key, w, h, frames, prefix = 'f') => {
      const tex = scene.textures.addCanvas(key, toCanvas(w * frames.length, h, sideBySide(w, h, frames)))!;
      frames.forEach((_, i) => tex.add(`${prefix}${i}`, 0, i * w, 0, w, h));
    },
    anim: (key, texture, frames, fps, loop) => {
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map((frame) => ({ key: texture, frame })), frameRate: fps, repeat: loop ? -1 : 0 });
    },
  };
}

/**
 * The Aurora Colosseum: its sky, stands, walls and floor, the gates, the
 * frozen champions and braziers, the spells its creatures share, and its
 * whole bestiary (sixteen creatures and five bosses), each with the spells
 * of its own.
 */
function* frostTextures(scene: Phaser.Scene): Generator<void, void, void> {
  // The sky, and the colosseum itself (lit, with its normal map and glow).
  const sky = yield* frostSkyArt();
  scene.textures.addCanvas('fz_sky', toCanvas(FROST_W, FROST_H, sky));
  const arena = yield* frostArenaArt();
  scene.textures.addCanvas('fz_arena', toCanvas(FROST_W, FROST_H, arena.diffuse))!.setDataSource(toCanvas(FROST_W, FROST_H, arena.normal));
  scene.textures.addCanvas('fz_arena_e', toCanvas(FROST_W, FROST_H, arena.emissive));
  yield;
  // The light that kindles in each arch, the aurora's ribbons, the champions and the braziers.
  GATES.forEach((g, i) => {
    if (g.kind !== 'arch') return;
    const a = archGlowArt(g);
    scene.textures.addCanvas(`fz_arch${i}`, toCanvas(a.w, a.h, a.px));
  });
  // Each ribbon its own texture, as the arena tiles them.
  [0.7, 2.9].forEach((seed, i) => scene.textures.addCanvas(`fz_aurora${i}`, toCanvas(AURORA_W, AURORA_H, auroraRibbon(seed))));
  register(scene, 'fz_statue', pack(frameList([0, 1, 2, 3].map(frostStatue), 's'), FZ_STATUE_W, FZ_STATUE_H), FZ_STATUE_W, FZ_STATUE_H);
  register(scene, 'fz_brazier', pack(frameList(Array.from({ length: FZ_BRAZIER_FRAMES }, (_, f) => frostBrazier(f)), 'f'), FZ_BRAZIER_W, FZ_BRAZIER_H), FZ_BRAZIER_W, FZ_BRAZIER_H);
  if (!scene.anims.exists('fz_brazier_burn')) scene.anims.create({ key: 'fz_brazier_burn', frames: scene.anims.generateFrameNames('fz_brazier', { prefix: 'f', start: 0, end: FZ_BRAZIER_FRAMES - 1 }), frameRate: 9, repeat: -1 });
  if (!scene.anims.exists('fz_brazier_glow')) scene.anims.create({ key: 'fz_brazier_glow', frames: scene.anims.generateFrameNames('fz_brazier_e', { prefix: 'f', start: 0, end: FZ_BRAZIER_FRAMES - 1 }), frameRate: 9, repeat: -1 });
  yield;
  // The spells they share (art/frostFx.ts).
  register(scene, 'fz_spike', pack(frameList([frostSpike(0), frostSpike(1), frostSpike(2)], 'k'), FZ_SPIKE_W, FZ_SPIKE_H), FZ_SPIKE_W, FZ_SPIKE_H);
  register(scene, 'fz_icicle', pack([{ name: 'i', r: frostIcicle().render() }], FZ_ICICLE_W, FZ_ICICLE_H), FZ_ICICLE_W, FZ_ICICLE_H);
  register(scene, 'fz_snowball', pack([{ name: 's', r: frostSnowball().render() }], FZ_SNOWBALL, FZ_SNOWBALL), FZ_SNOWBALL, FZ_SNOWBALL);
  scene.textures.addCanvas('fz_shard', toCanvas(FZ_SHARD_W, FZ_SHARD_H, frostShard()));
  scene.textures.addCanvas('fz_lane', toCanvas(FZ_LANE_W, FZ_LANE_H, frostLaneArt()));
  scene.textures.addCanvas('fz_flake', toCanvas(FZ_FLAKE, FZ_FLAKE, frostFlake()));
  scene.textures.addCanvas('fz_mist', toCanvas(FZ_MIST_W, FZ_MIST_H, frostMist()));
  const reg = fxRegistrar(scene);
  reg.strip('fz_ring', FZ_RING_W, FZ_RING_H, [0, 1, 2, 3].map(frostRing), 'r');
  reg.anim('fz_ring_spin', 'fz_ring', ['r0', 'r1', 'r2', 'r3'], 10, true);
  reg.strip('fz_patch', FZ_PATCH_W, FZ_PATCH_H, Array.from({ length: FZ_PATCH_FRAMES }, (_, f) => frostPatch(f)), 'p');
  reg.anim('fz_patch_glint', 'fz_patch', Array.from({ length: FZ_PATCH_FRAMES }, (_, f) => `p${f}`), 4, true);
  yield;
  // The weak.
  registerMonster(scene, 'snowmite', buildSnowmiteSheet());
  registerMonster(scene, 'rimesprite', buildRimespriteSheet());
  yield;
  registerMonster(scene, 'icebeak', buildIcebeakSheet());
  registerMonster(scene, 'rimeweaver', buildRimeweaverSheet());
  registerMonster(scene, 'flurrykin', buildFlurrykinSheet());
  frostWeakFx(reg);
  yield;
  // The normal.
  registerMonster(scene, 'rimefang', buildRimefangSheet());
  registerMonster(scene, 'frostbound', buildFrostboundSheet());
  yield;
  registerMonster(scene, 'rimewitch', buildRimewitchSheet());
  registerMonster(scene, 'galeclaw', buildGaleclawSheet());
  yield;
  registerMonster(scene, 'chillstone', buildChillstoneSheet());
  registerMonster(scene, 'snowstalker', buildSnowstalkerSheet());
  frostNormalFx(reg);
  yield;
  // The strong.
  registerMonster(scene, 'frost_troll', buildFrostTrollSheet());
  registerMonster(scene, 'tuskmaw', buildTuskmawSheet());
  yield;
  registerMonster(scene, 'frostdrake', buildFrostdrakeSheet());
  registerMonster(scene, 'yeti', buildYetiSheet());
  yield;
  registerMonster(scene, 'rimeknight', buildRimeknightSheet());
  frostStrongFx(reg);
  yield;
  // The bosses.
  registerMonster(scene, 'vargr', buildVargrSheet());
  vargrFx(reg);
  yield;
  registerMonster(scene, 'snowqueen', buildSnowQueenSheet());
  snowQueenFx(reg);
  yield;
  registerMonster(scene, 'winterking', buildWinterKingSheet());
  winterKingFx(reg);
  yield;
  registerMonster(scene, 'colossus', buildColossusSheet());
  colossusFx(reg);
  yield;
  registerMonster(scene, 'aurelith', buildAurelithSheet());
  aurelithFx(reg);
  yield;
  // Last: its presence means everything above is built.
  scene.textures.addCanvas('fz_done', toCanvas(1, 1, new Uint8ClampedArray(4)));
}

/** The painted arenas' texture sets, each built by one job (see arenaLoader.ts). */
export type ArenaJob = 'cosmos' | 'island' | 'rift' | 'spirit' | 'temple' | 'deep' | 'glide' | 'forest' | 'frost' | 'worldmap';

/**
 * Each set's steps, which yield between pieces, and the texture it makes
 * last: once that one exists, the whole set does.
 */
export const ARENA_JOBS: Record<ArenaJob, { done: string; steps: (scene: Phaser.Scene) => Generator<void, void, void> }> = {
  cosmos: { done: 'cosmos_streak', steps: cosmosTextures },
  island: { done: 'isle_bird', steps: islandTextures },
  rift: { done: 'rift_done', steps: riftTextures },
  spirit: { done: 'sd_lane', steps: spiritTextures },
  temple: { done: 'et_lane', steps: templeTextures },
  deep: { done: 'gd_lane', steps: deepTextures },
  glide: { done: 'gl_arch', steps: glideTextures },
  forest: { done: 'fr_preview', steps: forestTextures },
  frost: { done: 'fz_done', steps: frostTextures },
  // Not an arena, but built the same way: the arena select's map of the realm.
  worldmap: { done: 'wm_bits', steps: worldMapTextures },
};

/**
 * Build the Rune Temple's textures (its hall and steps, the temple over them,
 * the runestones, the light through its windows, the stations and keepers)
 * the first time the clearing is entered.
 */
export function warmSanctum(scene: Phaser.Scene): void {
  if (scene.textures.exists('rs_hall')) return;
  const hall = templeHall();
  scene.textures.addCanvas('rs_hall', toCanvas(TP_W, TP_TEX_H, hall.diffuse))!.setDataSource(toCanvas(TP_W, TP_TEX_H, hall.normal));
  scene.textures.addCanvas('rs_hall_e', toCanvas(TP_W, TP_TEX_H, hall.emissive));
  register(scene, 'rs_temple', pack(frameList([templeExterior()], 't'), TP_EXT_W, TP_EXT_H), TP_EXT_W, TP_EXT_H);
  register(scene, 'rs_runestone', pack(frameList([runestone(0), runestone(1)], 'r'), RUNESTONE_W, RUNESTONE_H), RUNESTONE_W, RUNESTONE_H);
  const rays = scene.textures.addCanvas('rs_ray', toCanvas(GODRAY_W * 2, GODRAY_H, sideBySide(GODRAY_W, GODRAY_H, [godRay(3), godRay(8)])))!;
  rays.add('g0', 0, 0, 0, GODRAY_W, GODRAY_H);
  rays.add('g1', 0, GODRAY_W, 0, GODRAY_W, GODRAY_H);
  const loop = (key: string, n: number, fps: number) =>
    scene.anims.create({ key: `${key}_loop`, frames: scene.anims.generateFrameNames(key, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  const glowLoop = (key: string, n: number, fps: number) =>
    scene.anims.create({ key: `${key}_e_loop`, frames: scene.anims.generateFrameNames(`${key}_e`, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
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
}

/**
 * The Forge's art (its hall, the smithy that hides it, the hearth, bellows,
 * trough, Brenna at her anvil and in her portrait, the barrel and the
 * grindstone), made the first time the clearing is entered.
 */
export function warmForge(scene: Phaser.Scene): void {
  if (scene.textures.exists('fg_hall')) return;
  const hall = forgeHall();
  scene.textures.addCanvas('fg_hall', toCanvas(FG_W, FG_H, hall.diffuse))!.setDataSource(toCanvas(FG_W, FG_H, hall.normal));
  scene.textures.addCanvas('fg_hall_e', toCanvas(FG_W, FG_H, hall.emissive));
  register(scene, 'fg_out', pack(frameList([forgeExterior()], 't'), FG_EXT_W, FG_EXT_H), FG_EXT_W, FG_EXT_H);
  register(scene, 'fg_yard', pack(frameList([barrelFrame(), grindFrame()], 'y'), YARD_W, YARD_H), YARD_W, YARD_H);
  register(scene, 'fg_trough', pack(frameList([troughFrame()], 't'), TROUGH_W, TROUGH_H), TROUGH_W, TROUGH_H);
  const loop = (key: string, paint: (f: number) => PixelCanvas, n: number, w: number, h: number, fps: number) => {
    register(scene, key, pack(frameList(Array.from({ length: n }, (_, f) => paint(f)), 'f'), w, h), w, h);
    for (const k of [key, `${key}_e`]) scene.anims.create({ key: `${k}_loop`, frames: scene.anims.generateFrameNames(k, { prefix: 'f', start: 0, end: n - 1 }), frameRate: fps, repeat: -1 });
  };
  // The fire and the bellows keep time together; Brenna's hammer has its own.
  loop('fg_hearth', hearthFrame, FIRE_FRAMES, HEARTH_W, HEARTH_H, 9);
  loop('fg_bellows', bellowsFrame, FIRE_FRAMES, BELLOWS_W, BELLOWS_H, 9);
  loop('fg_smith', smithFrame, SMITH_FRAMES, SMITH_W, SMITH_H, 9);
  loop('fg_brenna', smithPortrait, PORTRAIT_FRAMES, PORTRAIT_W, PORTRAIT_H, 5);
}
