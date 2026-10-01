import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { settings } from '../game/settings';
import { collection } from '../game/collection';
import { WISH_SKINS, DUPE_GEMS, PITY, RARITY_INFO, SKIN_RARITIES, WISH10_COST, WISH_COST, ownedSkins, wish, wornSkin, type SkinEntry, type SkinRarity, type WishResult } from '../game/gacha';
import { ALTAR_H, ALTAR_TOP, CRYSTAL_FRAMES, CRYSTAL_H, SHEEN_FRAMES, addBitmap, cardFront, registerCardArt, registerShopArt, shopHall } from '../art/shop';
import { JEWEL_ROYAL, JEWEL_TEAL, SIGIL_FRAMES, gaugeFill, gaugeFrame, portalBitmap, ribbonBitmap, tagBitmap } from '../art/wishArt';
import { titleBitmap, titleWidth, type TitleColours } from '../art/bossTitle';
import { hex, type RGB } from '../art/pixel';
import { Bitmap, bayer } from '../art/bitmap';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PixelButton, panelTexture, pixelText, type PanelStyle } from '../ui/widgets';
import { JewelButton } from '../ui/jewelButton';
import { sound } from '../audio';
import { fpsBottom } from './FpsScene';
import { cropToWindow, fitLine } from './SelectScene';
import { skinFace, type SkinFace } from '../ui/skinCard';
import { petFace } from '../ui/petCard';
import { PETS, ownedPets, petWish, type PetDef } from '../game/pets';
import { EGG_H } from '../art/pets';
import { BUNDLE_OFF, buy, fullPrice, msToRefresh, offerOwned, priceOf, todaysOffers, type Bought, type Offer } from '../game/store';
import type { HomeScene } from './HomeScene';

// The shop. It opens on its storefront: the day's skins, companions and
// bundles, each bought outright with gems, and two doorways to the wishing
// pages. Those are the Wish Sanctum, where a crystal floats over a rune altar
// under a great arch and gems poured into it make a wish for skins, and the
// Wishing Nest, where the hall turns warm (an egg sits where the crystal
// floated, the light goes gold and green, fireflies drift, the music moves up
// a key with birds in the rafters) and a wish hatches companions.
//
// A wish is staged: the gems pour in, the crystal charges and hints at what
// it holds (blue, then violet, then gold, a falling star striking it for the
// best), bursts in a flash, and the cards are dealt face down, each already
// glowing in the colour of what it holds. They turn one by one; a legendary
// among many is taken to the middle, trembles and turns alone. A skin already
// owned dissolves into gems that fly back to the counter. A purchase from the
// storefront is shown the same way, its cards dealt from the middle and
// turned at once.

const MARGIN = 8;
const SIDE_W = 96;
/** Cards: small ones for ten wishes, a big one for a single wish. */
const CARD_W = 60;
const CARD_H = 92;
const BIG_W = 120;
const BIG_H = 160;
/** How big the hero is drawn on each: large enough to fill the card's window. */
const CARD_SCALE = 2;
const BIG_SCALE = 3;
const CARD_GAP = 6;
/** The storefront's cards, on a wide screen and a narrow one. */
const OFFER_W = 60;
const OFFER_H = 84;
const OFFER_NARROW_W = 50;
const OFFER_NARROW_H = 80;
const OFFER_GAP = 5;
const PORTAL_W = 150;
const PORTAL_H = 44;
/** How long the crystal charges: longer when it holds a legendary. */
const CHARGE_MS = 1700;
const CHARGE_LEGEND_MS = 2400;
/** Between cards turning over, and the pause before a legendary does. */
const FLIP_EVERY = 280;
const LEGEND_PAUSE = 520;
/** A legendary among many: how much bigger it's shown in the middle, and how long it stays there. */
const SPOT_SCALE = 2;
const SPOT_HOLD = 1500;
/** How long a falling star takes to strike the crystal. */
const STAR_MS = 460;
/** The violet the crystal glows before any wish. */
const IDLE_TINT = 0xa070ff;
/** How fast the crystal turns (radians per ms): slowly at rest, whirling at the height of a wish. */
const IDLE_SPIN = 0.0007;
const CHARGED_SPIN = 0.022;
const GEM_CYAN = 0x9ff6ff;
const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;
const SHORT = 0xff8a8a;
/** How dark the hall goes behind the storefront. */
const STORE_DIM = 0.42;

type Phase = 'idle' | 'charge' | 'reveal' | 'done';
/** Which page is open: the storefront, the skins' Wishing Sanctum, or the companions' Wishing Nest. */
type Page = 'store' | 'skins' | 'pets';

/** What one wish (or purchase) turned up, skin or companion, as its card needs it. */
interface Pull {
  rarity: SkinRarity;
  /** First time the player has it. */
  fresh: boolean;
  /** A companion, whose card back is the Nest's. */
  pet: boolean;
  /** Its face, `w` x `h`; `big` for a single wish's card. */
  face(scene: Phaser.Scene, w: number, h: number, big: boolean): SkinFace;
}

const skinPull = (r: WishResult): Pull => ({
  rarity: r.entry.rarity,
  fresh: r.fresh,
  pet: false,
  face: (scene, w, h, big) => skinFace(scene, r.entry, w, h, big ? BIG_SCALE : CARD_SCALE, big ? { text: `${r.entry.cls.name} * ${r.entry.type.name}`, tint: LAVENDER } : undefined),
});

const petPull = (pet: PetDef, fresh: boolean): Pull => ({
  rarity: pet.rarity,
  fresh,
  pet: true,
  face: (scene, w, h, big) => petFace(scene, pet, w, h, big ? PET_BIG_SCALE : PET_SCALE, big),
});

/** How big a companion is drawn on a card: they are small creatures. */
const PET_SCALE = 2;
const PET_BIG_SCALE = 4;
/** The Wishing Nest's warm glow, its fireflies' colours, and its light through the hall. */
const NEST_TINT = 0xffc860;
const NEST_LEAF = 0x9ee85a;
/** What the hall is tinted in the Nest: its violet warmed towards amber. */
const NEST_HALL = 0xffd4a0;
/** The egg sits this far into the altar's top, so it rests on it rather than floating. */
const EGG_REST = 3;

const TIER: Record<SkinRarity, number> = { rare: 0, epic: 1, legendary: 2 };
const TINTS = [RARITY_INFO.rare.tint, RARITY_INFO.epic.tint, RARITY_INFO.legendary.tint];

/** The gilt of the shop's titles, and the colours each rarity's name is struck in. */
const GILT_TITLE: TitleColours = { light: hex('#fff4bf'), mid: hex('#f4cf6a'), dark: hex('#8a4e22') };
const RARITY_TITLE: Record<SkinRarity, TitleColours> = {
  rare: { light: hex('#e8f6ff'), mid: hex('#5fb4ff'), dark: hex('#2a4aa8') },
  epic: { light: hex('#f6e8ff'), mid: hex('#c084ff'), dark: hex('#5a2aa8') },
  legendary: GILT_TITLE,
};

/** The gem counter's plate: dark glass in gilt. */
const GILT_PLATE: PanelStyle = { top: hex('#0f0b22'), bottom: hex('#231a46'), alpha: 0.95, border: hex('#b8742c'), borderLit: hex('#ffe08a'), outer: hex('#0b0818') };

const toRGB = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Blend two colours. */
function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(Phaser.Math.Clamp(t, 0, 1) * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/** Hide-and-show for the shop's menus: anything with a visibility and an alpha. */
type Shown = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.AlphaSingle;

/**
 * The sheen sweeping over a fine card now and then: which of its frames to
 * show at `time` (or -1 between sweeps). A legendary's comes round more often.
 */
function sheenFrame(time: number, tier: number, offset: number): number {
  if (tier < 1) return -1;
  const period = tier >= 2 ? 2300 : 3400;
  const p = ((time + offset) % period) / period;
  return p < 0.36 ? Math.min(SHEEN_FRAMES - 1, Math.floor((p / 0.36) * SHEEN_FRAMES)) : -1;
}

/** A card a wish turns over: face down at first, glowing with what it holds; a skin or companion on its face. */
class WishCard extends Phaser.GameObjects.Container {
  readonly pull: Pull;
  readonly w: number;
  readonly h: number;
  readonly tier: number;
  flipped = false;
  /** Where it was dealt to, to go back to after a turn in the middle. */
  home = { x: 0, y: 0, scale: 1 };
  private aura: Phaser.GameObjects.Image;
  private back: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite | null = null;
  private sheen: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image;
  private tag: Phaser.GameObjects.Container;
  private twinkles: Phaser.GameObjects.Image[] = [];
  /** Light behind the card once turned: a halo, and god rays for the rarer ones. */
  private halo: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image[] = [];
  private offset = Math.random() * 4000;
  private sparkT = 0;
  private spark: (x: number, y: number, tint: number) => void;

  constructor(scene: Phaser.Scene, pull: Pull, big: boolean, spark: (x: number, y: number, tint: number) => void) {
    super(scene, 0, 0);
    this.pull = pull;
    this.spark = spark;
    const w = (this.w = big ? BIG_W : CARD_W);
    const h = (this.h = big ? BIG_H : CARD_H);
    this.tier = TIER[pull.rarity];
    const info = RARITY_INFO[pull.rarity];
    registerCardArt(scene, w, h);

    // Behind the card, in the scene (not the card), so it can spin and spread past the card's edges.
    this.halo = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(info.tint).setAlpha(0).setDepth(29);
    const nRays = this.tier === 2 ? 16 : this.tier === 1 ? 10 : 0;
    for (let i = 0; i < nRays; i++) {
      this.rays.push(scene.add.image(0, 0, 'loot_ray').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? info.core : info.tint).setAlpha(0).setDepth(29));
    }

    // The aura hugs the card's back, in the colour of what it holds, before it turns.
    this.aura = scene.add.image(0, 0, `wish_aura_${w}x${h}`).setBlendMode(Phaser.BlendModes.ADD).setTint(info.tint).setAlpha(0);
    this.back = scene.add.image(0, 0, pull.pet ? `wish_backegg_${w}x${h}` : `wish_back_${w}x${h}`);
    const face = pull.face(scene, w, h, big);
    this.sprite = face.sprite;
    this.glow = face.glow;
    this.face = scene.add.container(0, 0, face.parts).setVisible(false);
    this.sheen = scene.add.image(0, 0, `wish_sheen_${w}x${h}`, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(info.core).setAlpha(0.6).setVisible(false);
    this.flash = scene.add.image(0, 0, `wish_flash_${w}x${h}`).setBlendMode(Phaser.BlendModes.ADD).setTint(info.core).setAlpha(0);
    for (let i = 0; i < this.tier * 2; i++) this.twinkles.push(scene.add.image(0, 0, 'loot_twinkle').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0xffffff : info.tint).setAlpha(0));
    // New, or a duplicate: a tag over the top corner.
    const tagW = pull.fresh ? 27 : 38;
    const tagImg = scene.add.image(0, 0, addBitmap(scene, `wish_tag_${pull.fresh ? 'new' : 'owned'}`, pull.fresh ? tagBitmap(tagW, toRGB(0xf4cf6a), toRGB(0xb8742c)) : tagBitmap(tagW, toRGB(0x3a2e6a), toRGB(0x231a46)))).setOrigin(0);
    const tagText = pixelText(scene, 5, 2, pull.fresh ? 'New' : 'Owned', pull.fresh ? 0xfffbe8 : LAVENDER);
    this.tag = scene.add.container(Math.round(w / 2 - tagW + 4), Math.round(-h / 2 - 5), [tagImg, tagText]).setVisible(false);
    this.add([this.aura, this.back, this.face, this.sheen, this.flash, ...this.twinkles, this.tag]);
    scene.add.existing(this);
    this.setDepth(30);
  }

  get rarity(): SkinRarity {
    return this.pull.rarity;
  }

  /** Turn the card over: it lifts and narrows to an edge, shows its face, and widens again in a flash of its colour. */
  flip(onTurned: () => void): void {
    if (this.flipped) return;
    this.flipped = true;
    const s = this.scaleY;
    this.scene.tweens.add({ targets: this, scaleX: 0, duration: 110, ease: 'Sine.easeIn', onComplete: () => {
      this.back.setVisible(false);
      this.face.setVisible(true);
      this.tag.setVisible(true);
      this.flash.setAlpha(1);
      this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
      this.scene.tweens.add({ targets: this, scaleX: s, duration: 170, ease: 'Back.easeOut' });
      if (this.pull.fresh) this.scene.tweens.add({ targets: this.tag, y: this.tag.y - 2, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      onTurned();
    } });
    // A little hop as it turns.
    this.scene.tweens.add({ targets: this, y: this.y - 4, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Each frame: the glow follows the hero's frame; the aura breathes and sparks fly off a fine card's back; once turned, the light behind it breathes and turns and a sheen sweeps it. */
  tick(time: number, dt: number): void {
    if (this.glow) this.glow.setFrame(this.sprite.frame.name);
    if (!this.visible) return;
    const t = this.tier;
    if (!this.flipped) {
      const pulse = Math.sin(time * (0.004 + t * 0.003) + this.offset);
      this.aura.setAlpha((0.28 + t * 0.24 + pulse * (0.08 + t * 0.06)) * this.alpha).setScale(1 + (t === 2 ? 0.02 + 0.02 * pulse : 0));
      this.sparkT -= dt;
      if (t >= 1 && this.sparkT <= 0 && this.alpha > 0.9) {
        this.sparkT = t === 2 ? 110 : 320;
        const side = Math.random() < 0.5;
        const sx = side ? (Math.random() < 0.5 ? -1 : 1) * this.w * 0.5 : (Math.random() - 0.5) * this.w;
        const sy = side ? (Math.random() - 0.5) * this.h : (Math.random() < 0.5 ? -1 : 1) * this.h * 0.5;
        this.spark(this.x + sx * this.scaleY, this.y + sy * this.scaleY, RARITY_INFO[this.rarity].tint);
      }
      return;
    }
    this.aura.setAlpha((t === 2 ? 0.35 : t === 1 ? 0.15 : 0) * (0.85 + 0.15 * Math.sin(time * 0.005)));
    const f = sheenFrame(time, t, this.offset);
    this.sheen.setVisible(f >= 0);
    if (f >= 0) this.sheen.setFrame(f);
    // Twinkles come and go round a fine card's frame.
    this.twinkles.forEach((tw, i) => {
      const cycle = (time + this.offset + i * 700) / 1100;
      const k = cycle % 1;
      if (k < 0.03 || tw.getData('c') !== Math.floor(cycle)) {
        tw.setData('c', Math.floor(cycle));
        const edge = Math.floor(Math.random() * 4);
        const along = Math.random() - 0.5;
        tw.setPosition(Math.round(edge < 2 ? along * this.w : (edge === 2 ? -0.5 : 0.5) * this.w), Math.round(edge < 2 ? (edge === 0 ? -0.5 : 0.5) * this.h : along * this.h));
      }
      tw.setAlpha(Math.sin(k * Math.PI) ** 2).setScale(0.6 + 0.5 * Math.sin(k * Math.PI));
    });
    const k = this.alpha;
    const size = Math.max(this.w, this.h) * this.scaleY;
    this.halo.setPosition(this.x, this.y).setScale((size / 32) * (1.1 + 0.08 * Math.sin(time * 0.004))).setAlpha(0.5 * k * (t === 0 ? 0.6 : 1));
    const n = this.rays.length;
    this.rays.forEach((r, i) => {
      const long = i % 2 ? 0.7 : 1;
      r.setPosition(this.x, this.y)
        .setRotation((i / n) * Math.PI * 2 + time * 0.0004)
        .setScale(1.6 * this.scaleY, (size / 30) * 1.25 * long * (0.9 + 0.1 * Math.sin(time * 0.005 + i)))
        .setAlpha((i % 2 ? 0.45 : 0.3) * k);
    });
  }

  /** Raise it (and the light behind it) over the others, or put it back among them. */
  lift(on: boolean): void {
    this.setDepth(on ? 52 : 30);
    this.halo.setDepth(on ? 51 : 29);
    for (const r of this.rays) r.setDepth(on ? 51 : 29);
  }

  destroy(fromScene?: boolean): void {
    this.halo.destroy();
    for (const r of this.rays) r.destroy();
    super.destroy(fromScene);
  }
}

/** A gauge: a groove and a fill tinted and cut to how full it is. */
class Gauge extends Phaser.GameObjects.Container {
  readonly gw: number;
  private fill: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, w: number, tint: number) {
    super(scene, 0, 0);
    this.gw = w;
    const frame = scene.add.image(0, 0, addBitmap(scene, `wish_gauge_${w}`, gaugeFrame(w))).setOrigin(0);
    this.fill = scene.add.image(1, 1, addBitmap(scene, `wish_gauge_fill_${w - 2}`, gaugeFill(w - 2))).setOrigin(0).setTint(tint);
    this.add([frame, this.fill]);
  }
  set(k: number): this {
    this.fill.setCrop(0, 0, Math.round((this.gw - 2) * Phaser.Math.Clamp(k, 0, 1)), 5);
    return this;
  }
  /** A shimmer through the fill (as the guarantee nears). */
  shimmer(a: number): void {
    this.fill.setAlpha(a);
  }
}

/**
 * The shop, opened over the home screen: the storefront first, and the two
 * wishing pages behind it, each with the rates and the player's luck on one
 * side, a showcase of the legendaries on the other, and the Wish Crystal (or
 * the egg) in the middle, wished on once or ten times.
 */
export class ShopScene extends Phaser.Scene {
  private phase: Phase = 'idle';
  private leaving = false;
  private vw = 0;
  private vh = 0;
  private floorY = 0;
  private elapsed = 0;

  // The hall.
  private hall!: Phaser.GameObjects.Image;
  private hallKey = '';
  private shaft!: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image[] = [];
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lamps: Phaser.GameObjects.Image[] = [];
  private altar!: Phaser.GameObjects.Image;
  private runes!: Phaser.GameObjects.Image;
  private sigil!: Phaser.GameObjects.Image;
  private sigilT = 0;
  private dim!: Phaser.GameObjects.Rectangle;
  private storeDim!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;

  // The crystal.
  private crystalX = 0;
  private crystalY = 0;
  private crystal!: Phaser.GameObjects.Image;
  private crystalLight!: Phaser.GameObjects.Image;
  private crystalFrame = -1;
  private crystalGlow!: Phaser.GameObjects.Image;
  private orbit: Phaser.GameObjects.Image[] = [];
  private gather!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shards!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Spin, lift and brightness of the crystal, and its glow's colour; tweened by the wish. */
  private spin = 0;
  private spinSpeed = IDLE_SPIN;
  private lift = 0;
  private charge = 0;
  private tint = IDLE_TINT;
  private crystalShown = 1;
  /** The shop's own shake: whole art pixels, so the picture stays crisp, easing off over its time. */
  private shake = { t: 0, ms: 0, px: 0 };

  // The menus every page shares.
  private title!: Phaser.GameObjects.Image;
  private counterBg!: Phaser.GameObjects.Image;
  private counterGem!: Phaser.GameObjects.Image;
  private counterText!: Phaser.GameObjects.BitmapText;
  /** The gems shown on the counter: counting down as they're spent and up as duplicates dissolve. */
  private shownGems = 0;
  private back!: PixelButton;
  private tabs!: Record<Page, [PixelButton, PixelButton]>;
  private hint!: Phaser.GameObjects.BitmapText;
  private warn!: Phaser.GameObjects.BitmapText;
  /** Everything that comes and goes with the pages, and when each should show. */
  private managed: { o: Shown; when: () => boolean }[] = [];
  private narrow = false;
  private sides = true;

  // The storefront.
  private offers: Offer[] = [];
  private store!: Phaser.GameObjects.Container;
  private storeHead!: Phaser.GameObjects.BitmapText;
  private storeClock!: Phaser.GameObjects.BitmapText;
  private offerCards: { offer: Offer; box: Phaser.GameObjects.Container; tag: Phaser.GameObjects.Container; face: SkinFace[]; sheen: Phaser.GameObjects.Image | null; tier: number; offset: number }[] = [];
  private offerSize = '';
  private portals!: Record<'skins' | 'pets', Phaser.GameObjects.Container>;
  private portalText!: Record<'skins' | 'pets', Phaser.GameObjects.BitmapText>;
  private portalW = 0;
  private clockT = 0;
  private modal: Phaser.GameObjects.Container | null = null;

  // A wishing page.
  private wish1!: JewelButton;
  private wish10!: JewelButton;
  private rates!: Phaser.GameObjects.Container;
  private pityText!: Phaser.GameObjects.BitmapText;
  private pityGauge!: Gauge;
  private ownedText!: Phaser.GameObjects.BitmapText;
  private ownedGauge!: Gauge;
  private pityMini!: Phaser.GameObjects.Container;
  private pityMiniText!: Phaser.GameObjects.BitmapText;
  private pityMiniGauge!: Gauge;
  private showcase!: Phaser.GameObjects.Container;
  private showCard: Phaser.GameObjects.GameObject[] = [];
  private showFace: SkinFace | null = null;
  private showSheen!: Phaser.GameObjects.Image;
  private showName!: Phaser.GameObjects.BitmapText;
  private showAt = 0;
  private showT = 0;
  private legendaries: SkinEntry[] = [];
  private featuredPets: PetDef[] = [];

  // The pages.
  private page: Page = 'store';
  /** 0 the Sanctum .. 1 the Nest: everything that differs between them eases along this. */
  private nestK = 0;
  /** 0 on the storefront .. 1 on a wishing page: the crystal, the altar and their light ease in along this. */
  private stageK = 0;
  private pageTweens: Phaser.Tweens.Tween[] = [];
  private egg!: Phaser.GameObjects.Image;
  private eggGlow!: Phaser.GameObjects.Image;
  private cracks: Phaser.GameObjects.Image[] = [];
  /** The Nest's warm light over the hall, and its fireflies. */
  private nestLight!: Phaser.GameObjects.Rectangle;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;

  // A wish (or a purchase) being shown.
  private cards: WishCard[] = [];
  private flipTimer: Phaser.Time.TimerEvent | null = null;
  /** A legendary in the middle, waiting to go back: a tap sends it sooner. */
  private spotEnd: (() => void) | null = null;
  private continueBtn!: JewelButton;
  private againBtn!: JewelButton;
  private summary!: Phaser.GameObjects.BitmapText;
  private lastCount: 1 | 10 = 1;
  /** Where the cards come from: the crystal for a wish, the middle of the view for a purchase. */
  private dealFrom = { x: 0, y: 0 };

  constructor() {
    super('shop');
  }

  /** Which hall the wishing page shows: the Nest only on the companions' page. */
  private get pets(): boolean {
    return this.page === 'pets';
  }

  create(): void {
    this.phase = 'idle';
    this.leaving = false;
    this.elapsed = 0;
    this.cards = [];
    this.rays = [];
    this.orbit = [];
    this.lamps = [];
    this.managed = [];
    this.offerCards = [];
    this.offerSize = '';
    this.hallKey = '';
    this.spin = 0;
    this.spinSpeed = IDLE_SPIN;
    this.lift = this.charge = 0;
    this.tint = IDLE_TINT;
    this.crystalShown = 1;
    this.shake = { t: 0, ms: 0, px: 0 };
    this.shownGems = collection.gems;
    this.page = 'store';
    this.nestK = 0;
    this.stageK = 0;
    this.pageTweens = [];
    this.cracks = [];
    this.modal = null;
    this.spotEnd = null;
    this.showFace = null;
    this.showCard = [];
    registerShopArt(this);
    // The Sanctum has its own music, fading in over the game's.
    sound.setTrack('shop');
    sound.setShopMood('sanctum');
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });

    this.buildHall();
    this.buildCrystal();
    this.storeDim = this.add.rectangle(0, 0, 1, 1, 0x05030c, STORE_DIM).setOrigin(0).setDepth(12);
    this.buildMenus();
    this.buildStore();
    this.dim = this.add.rectangle(0, 0, 1, 1, 0x05030c, 0).setOrigin(0).setDepth(6);
    this.flash = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0).setOrigin(0).setDepth(60);

    // A tap during the reveal turns every card at once (or sends a legendary back from the middle).
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.phase === 'reveal') this.flipAll();
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => {
      if (this.modal) return this.closeModal();
      if (this.phase === 'done') return this.finish();
      if (this.phase === 'idle') this.goBack();
    });
    kb?.on('keydown-ENTER', () => (this.phase === 'reveal' ? this.flipAll() : this.phase === 'done' && this.finish()));

    const unwatch = collection.watch(() => this.refreshInfo());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      sound.setTrack('main');
      unwatch();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.layout();
    this.refreshInfo();
  }

  // ---- Building ----

  private buildHall(): void {
    this.hall = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(0);
    // A pillar of light from high in the vault down onto the altar, and god rays turning slowly round the crystal.
    this.shaft = this.add.image(0, 0, 'loot_beam').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0x7a5ae8).setDepth(1);
    for (let i = 0; i < 14; i++) {
      this.rays.push(this.add.image(0, 0, 'loot_ray').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0x5ae8ff : IDLE_TINT).setDepth(2));
    }
    // Warm lamps at the arch's feet.
    for (let i = 0; i < 2; i++) this.lamps.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa84a).setDepth(3));
    // Dust and specks of light rising through the hall.
    this.motes = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 3000, max: 6000 },
      speedY: { min: -12, max: -4 },
      speedX: { min: -3, max: 3 },
      scale: { min: 0.5, max: 1 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
      tint: [0xffffff, 0xc8b8ff, 0x9ff6ff, 0xffd8a8],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
    }).setDepth(3);
    // The Nest: a warm wash of light over the hall, and fireflies drifting through it.
    this.nestLight = this.add.rectangle(0, 0, 1, 1, 0x5a4012, 1).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(0.5);
    this.fireflies = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 2600, max: 4600 },
      speed: { min: 3, max: 10 },
      scale: { min: 0.6, max: 1.1 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 3)) * 0.9 },
      tint: [0xd8ff7a, 0xf6ffb0, 0xffe08a, NEST_LEAF],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 45,
      emitting: false,
    }).setDepth(3);
    // The rune circle turning on the floor round the steps, brightening as a wish charges.
    this.sigil = this.add.image(0, 0, 'shop_sigil', 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.5);
    this.altar = this.add.image(0, 0, 'shop_altar').setOrigin(0.5, ALTAR_TOP / ALTAR_H).setDepth(4);
    this.runes = this.add.image(0, 0, 'shop_altar_runes').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ff6ff).setDepth(4.5);
  }

  private buildCrystal(): void {
    this.crystalGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(IDLE_TINT).setDepth(9);
    this.crystalFrame = -1;
    this.crystal = this.add.image(0, 0, 'shop_crystal', 0).setDepth(10);
    this.crystalLight = this.add.image(0, 0, 'shop_crystal_w', 0).setBlendMode(Phaser.BlendModes.ADD).setTint(IDLE_TINT).setDepth(10.5);
    // The Nest's egg, in the crystal's place, with the cracks that spread as it hatches.
    this.egg = this.add.image(0, 0, 'nest_egg').setOrigin(0.5, 1).setDepth(10).setAlpha(0);
    this.eggGlow = this.add.image(0, 0, 'nest_egg_e').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(10.2).setAlpha(0);
    for (const k of [1, 2, 3]) this.cracks.push(this.add.image(0, 0, `nest_crack${k}`).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(10.4).setAlpha(0));
    for (let i = 0; i < 6; i++) this.orbit.push(this.add.image(0, 0, 'loot_twinkle').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0xffffff : 0x9ff6ff));
    // Light drawn in from all round as the crystal charges.
    this.gather = this.add.particles(0, 0, 'spark', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 70), quantity: 48 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: 0,
      moveToY: 0,
      lifespan: 520,
      scale: { start: 0.5, end: 1.4 },
      alpha: { start: 0, end: 1 },
      tint: [0xffffff, 0x9ff6ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 30,
      emitting: false,
    }).setDepth(11);
    // The crystal's shards when it bursts.
    this.shards = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 220 },
      lifespan: { min: 500, max: 1300 },
      gravityY: 60,
      scale: { start: 1.6, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xffffff, 0x9ff6ff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(55);
    // Little sparks drifting up off the fine cards' backs.
    this.sparks = this.add.particles(0, 0, 'spark', {
      speedY: { min: -26, max: -10 },
      speedX: { min: -8, max: 8 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(31);
  }

  /** Put something under the shop's page rules: shown on `when` (while the menus are up). */
  private manage<T extends Shown>(o: T, when: () => boolean): T {
    this.managed.push({ o, when });
    return o;
  }

  private buildMenus(): void {
    this.title = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(40);
    this.counterBg = this.add.image(0, 0, panelTexture(this, 'shop_counter', 62, 17, GILT_PLATE)).setOrigin(0).setDepth(40);
    this.counterGem = this.add.image(0, 0, 'gem_m').setOrigin(0).setDepth(41);
    this.counterText = pixelText(this, 0, 0, '', GEM_CYAN).setDepth(41);

    const always = () => true;
    const wishing = () => this.page !== 'store';
    this.manage(this.title, always);
    this.back = this.manage(new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'shop_back', () => this.goBack()).setDepth(40), always);
    // The three pages, as tabs under the heading, each with its picture: the open one lit.
    const probe = pixelText(this, 0, 0, '').setVisible(false);
    const tab = (p: Page, label: string, icon: string): [PixelButton, PixelButton] => {
      const w = probe.setText(label.toUpperCase()).width + this.textures.getFrame(icon).width + 12;
      return [
      this.manage(new PixelButton(this, label, w, 15, BUTTON_GOLD, `shop_tab_${p}_on`, () => {}).setIcon(icon).setDepth(40), () => this.page === p),
      this.manage(new PixelButton(this, label, w, 15, BUTTON_PLAIN, `shop_tab_${p}`, () => this.setPage(p)).setIcon(icon).setDepth(40), () => this.page !== p),
      ];
    };
    this.tabs = { store: tab('store', 'Shop', 'gem_s'), skins: tab('skins', 'Skins', 'wish_icon_crystal'), pets: tab('pets', 'Companions', 'wish_icon_egg') };
    probe.destroy();

    this.wish1 = this.manage(new JewelButton(this, 'Wish x1', WISH_COST, 76, 28, JEWEL_TEAL, 'wish1', () => this.makeWish(1)).setDepth(40), wishing);
    this.wish10 = this.manage(new JewelButton(this, 'Wish x10', WISH10_COST, 86, 30, JEWEL_ROYAL, 'wish10', () => this.makeWish(10)).setDepth(40), wishing);
    // Ten at once are sure of an epic: a tag on the button's corner says so.
    const epicTag = this.add.image(0, 0, addBitmap(this, 'wish_tag_epic', tagBitmap(38, toRGB(0x8a4ae8), toRGB(0x4a24b0)))).setOrigin(0);
    const epicText = pixelText(this, 6, 2, 'Epic+', 0xf6e8ff);
    this.wish10.add(this.add.container(86 - 30, -7, [epicTag, epicText]));
    this.hint = this.manage(pixelText(this, 0, 0, '', 0x7c72b0).setDepth(40), () => this.hint.x >= MARGIN + this.back.boxW + 4 || this.hint.y < this.back.y - 9);
    this.warn = pixelText(this, 0, 0, 'Not enough gems', SHORT).setDepth(75).setAlpha(0);
    this.continueBtn = new JewelButton(this, 'Continue', null, 74, 24, JEWEL_ROYAL, 'continue', () => this.finish()).setDepth(58).setVisible(false);
    this.againBtn = new JewelButton(this, 'Again', WISH_COST, 70, 26, JEWEL_TEAL, 'again', () => this.again()).setDepth(58).setVisible(false);
    this.summary = pixelText(this, 0, 0, '', LAVENDER).setDepth(58).setVisible(false);

    // The rates, the guarantee and the collection.
    const rw = SIDE_W;
    const rh = 120;
    const rbg = this.add.image(0, 0, panelTexture(this, 'shop_rates', rw, rh, PANEL)).setOrigin(0);
    const head = pixelText(this, 0, 6, 'Odds', GOLD);
    head.setX(Math.round((rw - head.width) / 2));
    const rows: Phaser.GameObjects.GameObject[] = [rbg, head];
    [...SKIN_RARITIES].reverse().forEach((r, i) => {
      const info = RARITY_INFO[r];
      const y = 19 + i * 11;
      for (let s = 0; s < info.stars; s++) rows.push(this.add.image(7 + s * 6, y, 'icon_star').setOrigin(0).setTint(info.tint));
      const pct = pixelText(this, 0, y, `${Math.round(info.odds * 100)}%`, info.tint);
      pct.setX(rw - 7 - pct.width);
      rows.push(pct);
    });
    rows.push(this.add.image(7, 54, addBitmap(this, 'shop_rule_82', ruleBitmap(82))).setOrigin(0));
    rows.push(pixelText(this, 7, 58, 'Legendary in', LAVENDER));
    this.pityText = pixelText(this, 0, 67, '', GOLD);
    this.pityGauge = new Gauge(this, 64, GOLD);
    this.pityGauge.setPosition(7, 68);
    rows.push(this.pityText, this.pityGauge);
    rows.push(pixelText(this, 7, 79, '10 wishes: epic+', 0xfff4d6));
    this.ownedText = pixelText(this, 7, 94, '', GEM_CYAN);
    this.ownedGauge = new Gauge(this, 82, GEM_CYAN);
    this.ownedGauge.setPosition(7, 104);
    rows.push(this.add.image(7, 90, 'shop_rule_82').setOrigin(0), this.ownedText, this.ownedGauge);
    this.rates = this.manage(this.add.container(0, 0, rows).setDepth(40), () => wishing() && this.sides);

    // On a narrow screen, the guarantee alone, over the wish buttons.
    this.pityMiniText = pixelText(this, 0, 0, '', GOLD);
    this.pityMiniGauge = new Gauge(this, 64, GOLD);
    this.pityMini = this.manage(this.add.container(0, 0, [this.pityMiniText, this.pityMiniGauge]).setDepth(40), () => wishing() && !this.sides);

    // The showcase: every legendary in turn on its own card; a tap moves it on.
    this.legendaries = WISH_SKINS.filter((s) => s.rarity === 'legendary');
    this.featuredPets = PETS.filter((p) => p.rarity === 'legendary' && !p.season);
    const sw = SIDE_W;
    const sh = 120;
    const info = RARITY_INFO.legendary;
    const sbg = this.add.image(0, 0, panelTexture(this, 'shop_show', sw, sh, PANEL)).setOrigin(0);
    const title = pixelText(this, 0, 5, 'Featured', GOLD);
    title.setX(Math.round((sw - title.width) / 2));
    const halo = this.add.image(sw / 2, 56, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(info.tint).setScale(2.2).setAlpha(0.35);
    this.tweens.add({ targets: halo, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    registerCardArt(this, 64, 88);
    this.showSheen = this.add.image(sw / 2, 16 + 44, 'wish_sheen_64x88', 0).setBlendMode(Phaser.BlendModes.ADD).setTint(info.core).setAlpha(0.55).setVisible(false);
    this.showName = pixelText(this, 0, 107, '', LAVENDER);
    const hit = this.add.zone(sw / 2, 60, 64, 88).setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.phase !== 'idle' || this.modal) return;
      this.showAt++;
      this.showT = 0;
      this.showFeatured(true);
    });
    this.showcase = this.manage(this.add.container(0, 0, [sbg, title, halo, this.showSheen, this.showName, hit]).setDepth(40), () => wishing() && this.sides);
    this.showAt = Math.floor(Math.random() * 100);
  }

  /** The storefront: today's offers, and the doorways to the two wishing pages. */
  private buildStore(): void {
    this.offers = todaysOffers();
    this.storeHead = pixelText(this, 0, 0, "Today's offers", GOLD);
    this.storeClock = pixelText(this, 0, 0, '', 0x7c72b0);
    this.store = this.manage(this.add.container(0, 0, [this.storeHead, this.storeClock]).setDepth(40), () => this.page === 'store');
    this.portals = {} as never;
    this.portalText = {} as never;
    for (const p of ['skins', 'pets'] as const) {
      const c = this.add.container(0, 0).setDepth(40);
      this.portals[p] = this.manage(c, () => this.page === 'store');
    }
  }

  /** Lay the offers out at a card size, rebuilding them when the size changes. */
  private buildOffers(w: number, h: number): void {
    const key = `${w}x${h}`;
    if (key === this.offerSize) return;
    this.offerSize = key;
    for (const c of this.offerCards) c.box.destroy();
    this.offerCards = [];
    registerCardArt(this, w, h);
    for (const offer of this.offers) {
      const tier = TIER[offer.rarity];
      const faces = offerFace(this, offer, w, h);
      const sheen = tier >= 1 ? this.add.image(0, 0, `wish_sheen_${w}x${h}`, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(RARITY_INFO[offer.rarity].core).setAlpha(0.55).setVisible(false) : null;
      const parts: Phaser.GameObjects.GameObject[] = faces.flatMap((f) => f.parts);
      if (sheen) parts.push(sheen);
      // A bundle's saving, on a red tag over its corner.
      if (offer.kind === 'bundle') {
        const off = this.add.image(0, 0, addBitmap(this, 'wish_tag_off', tagBitmap(30, toRGB(0xd8384a), toRGB(0x8a1a2a)))).setOrigin(0);
        const t = pixelText(this, 6, 2, `-${Math.round(BUNDLE_OFF * 100)}%`, 0xfff4d6);
        parts.push(this.add.container(Math.round(w / 2 - 26), Math.round(-h / 2 - 5), [off, t]));
      }
      const tag = this.add.container(0, Math.round(h / 2 + 2));
      parts.push(tag);
      const box = this.add.container(0, 0, parts);
      const hit = this.add.zone(0, 0, w, h + 12).setInteractive({ useHandCursor: true });
      box.add(hit);
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.phase === 'idle' && !this.modal && this.tweens.add({ targets: box, scale: 1.06, duration: 120, ease: 'Back.easeOut' }));
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.tweens.add({ targets: box, scale: 1, duration: 120 }));
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (this.phase !== 'idle' || this.modal || this.page !== 'store' || this.leaving) return;
        sound.cardFlip(0);
        this.openOffer(offer);
      });
      this.store.add(box);
      this.offerCards.push({ offer, box, tag, face: faces, sheen, tier, offset: Math.random() * 4000 });
    }
    this.refreshTags();
  }

  /** Under each offer: its price, struck red when the gems fall short, or Owned. */
  private refreshTags(): void {
    for (const c of this.offerCards) {
      c.tag.removeAll(true);
      const owned = offerOwned(c.offer);
      c.box.setAlpha(owned ? 0.55 : 1);
      if (owned) {
        const t = pixelText(this, 0, 1, 'Owned', LAVENDER);
        t.setX(Math.round(-t.width / 2));
        c.tag.add(t);
        continue;
      }
      const price = priceOf(c.offer);
      const gem = this.add.image(0, 2, 'gem_s').setOrigin(0);
      const t = pixelText(this, gem.width + 2, 1, `${price}`, collection.gems >= price ? GEM_CYAN : SHORT);
      const w = gem.width + 2 + t.width;
      const bg = this.add.image(0, 0, panelTexture(this, `shop_price_${w + 8}`, w + 8, 11, PANEL_INSET)).setOrigin(0);
      gem.x += 4;
      t.x += 4;
      c.tag.add([bg, gem, t]);
      c.tag.iterate((o: Phaser.GameObjects.Components.Transform) => (o.x -= Math.round((w + 8) / 2)));
    }
  }

  /** Build the two doorways at a width: a little sky in gilt, the crystal or the egg in it, a title and the wait for a legendary. */
  private buildPortals(w: number): void {
    if (w === this.portalW) return;
    this.portalW = w;
    for (const p of ['skins', 'pets'] as const) {
      const c = this.portals[p];
      c.removeAll(true);
      const egg = p === 'pets';
      const bg = this.add.image(0, 0, addBitmap(this, `shop_portal_${p}_${w}`, portalBitmap(w, PORTAL_H, egg))).setOrigin(0);
      const ix = 4 + Math.round((PORTAL_H - 8) * 0.55);
      const glow = this.add.image(ix, PORTAL_H / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(egg ? NEST_TINT : IDLE_TINT).setAlpha(0.5).setScale(0.9);
      this.tweens.add({ targets: glow, alpha: 0.85, scale: 1.1, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const icon = this.add.image(ix, PORTAL_H / 2 + 1, egg ? 'wish_icon_egg' : 'wish_icon_crystal').setScale(2);
      this.tweens.add({ targets: icon, y: icon.y - 2, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const tx = ix + 16;
      const room = w - tx - 8;
      const probe = pixelText(this, 0, 0, '').setVisible(false);
      const name = fitLine(probe, egg ? 'Companion wishes' : 'Skin wishes', room) !== (egg ? 'COMPANION WISHES' : 'SKIN WISHES') ? (egg ? 'Companions' : 'Skins') : egg ? 'Companion wishes' : 'Skin wishes';
      probe.destroy();
      const title = pixelText(this, tx, 9, name, GOLD);
      const sub = pixelText(this, tx, 22, '', egg ? 0xd8ff7a : 0xc8b8ff);
      this.portalText[p] = sub;
      const hit = this.add.zone(w / 2, PORTAL_H / 2, w, PORTAL_H).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.tweens.add({ targets: glow, alpha: 1, duration: 100 }));
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setPage(p));
      c.add([bg, glow, icon, title, sub, hit]);
    }
    this.refreshInfo();
  }

  /** Put the next legendary skin (or, in the Nest, the next legendary companion) in the showcase, on its own card. */
  private showFeatured(fade: boolean): void {
    for (const o of this.showCard) o.destroy();
    this.showCard = [];
    this.showFace = null;
    const pet = this.pets ? this.featuredPets[this.showAt % this.featuredPets.length] : null;
    const skin = this.pets ? null : this.legendaries[this.showAt % this.legendaries.length];
    if (!pet && !skin) return;
    const face = pet ? petFace(this, pet, 64, 88, PET_SCALE) : skinFace(this, skin!, 64, 88, 2);
    const holder = this.add.container(SIDE_W / 2, 16 + 44, face.parts);
    this.showcase.addAt(holder, 3);
    this.showCard = [holder];
    this.showFace = face;
    const owned = pet ? collection.hasPet(pet.id) : collection.hasSkin(skin!.id);
    const probe = pixelText(this, 0, 0, '').setVisible(false);
    this.showName.setText(fitLine(probe, `${owned ? '' : '* '}${pet ? pet.perk : skin!.cls.name}`, SIDE_W - 10)).setTint(pet ? pet.tint : LAVENDER);
    probe.destroy();
    this.showName.setX(Math.round((SIDE_W - this.showName.width) / 2));
    if (fade) {
      holder.setAlpha(0).setScale(0.92);
      this.tweens.add({ targets: holder, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    }
  }

  // ---- Pages ----

  /** The crystal's resting glow: violet in the Sanctum, warm gold in the Nest. */
  private get idleTint(): number {
    return this.pets ? NEST_TINT : IDLE_TINT;
  }

  /**
   * Go to another page: a soft flash, and over half a second the crystal
   * comes (or goes, for the storefront) or gives way to the egg, the light
   * warms or cools, the fireflies come or go and the music changes key.
   */
  private setPage(p: Page): void {
    if (this.phase !== 'idle' || this.leaving || this.modal || p === this.page) return;
    const from = this.page;
    this.page = p;
    for (const tw of this.pageTweens) tw.stop();
    this.pageTweens = [
      this.tweens.add({ targets: this, nestK: p === 'pets' ? 1 : 0, duration: 600, ease: 'Sine.easeInOut' }),
      this.tweens.add({ targets: this, stageK: p === 'store' ? 0 : 1, duration: 500, ease: 'Sine.easeInOut' }),
      this.tweens.add({ targets: this.storeDim, fillAlpha: p === 'store' ? STORE_DIM : 0, duration: 400 }),
    ];
    this.flash.setFillStyle(p === 'pets' ? 0xfff0c0 : 0xd8c8ff).setAlpha(p === 'store' ? 0.15 : 0.35);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 420 });
    if (p !== 'store') {
      this.shards.setParticleTint(p === 'pets' ? NEST_LEAF : 0x9ff6ff);
      this.shards.explode(from === 'store' ? 24 : 14, this.crystalX, this.coreY);
      this.crystalShown = 1;
    }
    this.shiftTint(this.idleTint, 500);
    sound.setShopMood(p === 'pets' ? 'nest' : 'sanctum');
    sound.cardFlip(0);
    if (p === 'pets') this.fireflies.start();
    else this.fireflies.stop();
    this.showT = 0;
    if (p !== 'store') this.showFeatured(true);
    this.setTitle();
    this.refreshInfo();
    this.showUi(true, 260);
  }

  /** The heading in big gilt letters: the shop's, the Sanctum's or the Nest's. */
  private setTitle(): void {
    const text = this.page === 'store' ? 'Sanctum shop' : this.page === 'pets' ? 'Wishing Nest' : 'Wishing Sanctum';
    // Big letters where they fit beside the mute button, small ones on the narrowest screens.
    const s = titleWidth(text, 2) <= this.vw - 70 ? 2 : 1;
    this.title.setTexture(addBitmap(this, `shop_title_${text}_${s}`, titleBitmap(text, GILT_TITLE, s)));
    const top = this.top;
    this.title.setPosition(Math.round((this.vw - this.title.width) / 2), top);
    this.hint.setText((this.page === 'pets' ? 'Companions follow you on every run' : this.page === 'skins' ? 'A skin owned already gives 10 gems back' : 'Gems drop from monsters * +5 every day').toUpperCase());
    this.hint.setX(Math.round((this.vw - this.hint.width) / 2));
  }

  /** The top of the menus: under the frame counter. */
  private get top(): number {
    return Math.ceil(fpsBottom() / this.cameras.main.zoom) + 3;
  }

  /**
   * Bring the menus in (or take them away), each by its page's rules: what
   * should show fades in, what shouldn't fades out. `ms` 0 sets them at once.
   */
  private showUi(on: boolean, ms: number): void {
    for (const { o, when } of this.managed) {
      const want = on && when();
      this.tweens.killTweensOf(o);
      if (want) {
        if (!o.visible) o.setAlpha(0);
        o.setVisible(true);
        if (ms) this.tweens.add({ targets: o, alpha: 1, duration: ms });
        else o.setAlpha(1);
      } else if (o.visible) {
        if (ms) this.tweens.add({ targets: o, alpha: 0, duration: ms * 0.8, onComplete: () => o.setVisible(false) });
        else o.setVisible(false);
      }
    }
    const live = on && this.phase === 'idle';
    this.wish1.setEnabled(live && this.page !== 'store');
    this.wish10.setEnabled(live && this.page !== 'store');
    this.back.setEnabled(live);
  }

  // ---- Layout ----

  private layout(): void {
    const { width, height } = this.scale;
    const z = menuZoom(width, height);
    this.cameras.main.setZoom(z);
    const vw = (this.vw = width / z);
    const vh = (this.vh = height / z);
    const W = Math.ceil(vw);
    const H = Math.ceil(vh);
    this.narrow = vw < 340;
    this.floorY = Math.round(vh * 0.68);
    const key = `shop_hall_${W}x${H}`;
    if (key !== this.hallKey) {
      if (this.hallKey && this.textures.exists(this.hallKey)) this.textures.remove(this.hallKey);
      this.hallKey = addBitmap(this, key, shopHall(W, H, this.floorY));
      this.hall.setTexture(key);
    }
    this.dim.setSize(W + 1, H + 1);
    this.storeDim.setSize(W + 1, H + 1);
    this.flash.setSize(W + 1, H + 1);
    for (const zone of [...this.motes.emitZones]) this.motes.removeEmitZone(zone);
    this.motes.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, H * 0.2, W, H * 0.8) } as Phaser.Types.GameObjects.Particles.EmitZoneData);

    const cx = Math.round(vw / 2);
    this.altar.setPosition(cx, this.floorY);
    this.runes.setPosition(cx, this.floorY);
    this.sigil.setPosition(cx, this.floorY + 22);
    this.crystalX = cx;
    this.crystalY = this.floorY - Math.round(CRYSTAL_H / 2) - 14;
    this.shaft.setPosition(cx, this.floorY + 2).setScale(5, (this.floorY + 4) / 120);
    const archHalf = Math.min(vw * 0.62, 300) / 2;
    this.lamps.forEach((l, i) => l.setPosition(cx + (i ? archHalf - 4 : -archHalf + 4), this.floorY - 24));
    this.nestLight.setSize(W + 1, H + 1);
    for (const zone of [...this.fireflies.emitZones]) this.fireflies.removeEmitZone(zone);
    this.fireflies.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, H * 0.25, W, this.floorY - H * 0.1) } as Phaser.Types.GameObjects.Particles.EmitZoneData);

    const top = this.top;
    this.setTitle();
    // On a narrow screen the heading takes the top, and the counter sits at the foot, across from Back.
    if (this.narrow) this.counterBg.setPosition(Math.round(vw - MARGIN - 62), Math.round(vh - 25));
    else this.counterBg.setPosition(Math.round(vw - MARGIN - 62 - 30), top - 1);
    this.placeCounter();
    // The page tabs, side by side under the heading.
    const tabY = top + this.title.height + 3;
    const tabGap = 3;
    const order: Page[] = ['store', 'skins', 'pets'];
    const tabsW = order.reduce((w, p) => w + this.tabs[p][0].boxW, 0) + tabGap * 2;
    let tx = Math.round((vw - tabsW) / 2);
    for (const p of order) {
      for (const b of this.tabs[p]) b.place(tx, tabY);
      tx += this.tabs[p][0].boxW + tabGap;
    }
    const below = tabY + 15;

    // The wish buttons side by side under the altar; on a narrow screen, up above the back button.
    const by = Math.round(this.narrow ? vh - 64 : vh - 42);
    const gap = 10;
    const total = this.wish1.boxW + gap + this.wish10.boxW;
    const bx = Math.round((vw - total) / 2);
    this.wish1.place(bx, by + 1);
    this.wish10.place(bx + this.wish1.boxW + gap, by);
    this.back.place(MARGIN, vh - 26);
    this.hint.setPosition(Math.round((vw - this.hint.width) / 2), Math.round(vh - 10));
    this.warn.setPosition(Math.round((vw - this.warn.width) / 2), by - 24);

    // Side panels when there's room either side of the arch.
    this.sides = vw >= SIDE_W * 2 + MARGIN * 2 + 180;
    const panelY = Math.round(Math.max(below + 6, (this.floorY - 120) / 2 + 12));
    this.rates.setPosition(MARGIN, panelY);
    this.showcase.setPosition(Math.round(vw - MARGIN - SIDE_W), panelY);
    this.pityMiniGauge.setPosition(this.pityMiniText.width + 4, 1);
    this.placePityMini(by);

    this.layoutStore(below);
    this.showFeatured(false);
    if (this.phase === 'idle' && !this.modal) this.showUi(true, 0);
    this.placeReveal();
  }

  private placePityMini(by: number): void {
    const w = this.pityMiniText.width + 4 + this.pityMiniGauge.gw;
    this.pityMiniGauge.setX(this.pityMiniText.width + 4);
    this.pityMini.setPosition(Math.round((this.vw - w) / 2), by - 19);
  }

  /** The storefront: today's offers in a row (or rows, narrow), the doorways under them, all centred in the room left. */
  private layoutStore(below: number): void {
    const vw = this.vw;
    const narrow = vw < 7 * (OFFER_W + OFFER_GAP) + MARGIN * 2;
    const w = narrow ? OFFER_NARROW_W : OFFER_W;
    const h = narrow ? OFFER_NARROW_H : OFFER_H;
    this.buildOffers(w, h);
    const perRow = Math.max(1, Math.min(this.offerCards.length, Math.floor((vw - MARGIN * 2 + OFFER_GAP) / (w + OFFER_GAP))));
    const rows = Math.ceil(this.offerCards.length / perRow);
    const rowH = h + 16;
    const pw = Math.min(PORTAL_W, Math.floor((vw - MARGIN * 2 - 8) / 2));
    this.buildPortals(pw);
    const needH = 16 + rows * rowH + 6 + PORTAL_H;
    const room = this.vh - 30 - below;
    const y0 = Math.round(below + 4 + Math.max(0, (room - needH) / 2));
    // The heading and the clock over the cards, along the row's width.
    const rowW = perRow * w + (perRow - 1) * OFFER_GAP;
    const left = Math.round((vw - rowW) / 2);
    this.storeHead.setPosition(left, y0);
    this.storeClock.setPosition(left + rowW - this.storeClock.width, y0);
    this.offerCards.forEach((c, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, this.offerCards.length - row * perRow);
      const x0 = vw / 2 - ((inRow - 1) * (w + OFFER_GAP)) / 2;
      c.box.setPosition(Math.round(x0 + (i % perRow) * (w + OFFER_GAP)), Math.round(y0 + 16 + h / 2 + row * rowH));
    });
    const py = y0 + 16 + rows * rowH + 6;
    const px = Math.round((vw - (pw * 2 + 8)) / 2);
    this.portals.skins.setPosition(px, py);
    this.portals.pets.setPosition(px + pw + 8, py);
  }

  private placeCounter(): void {
    const bg = this.counterBg;
    this.counterText.setText(`${Math.max(0, Math.round(this.shownGems))}`);
    const w = this.counterGem.width + 3 + this.counterText.width;
    const x = Math.round(bg.x + (62 - w) / 2);
    this.counterGem.setPosition(x, bg.y + Math.round((17 - this.counterGem.height) / 2));
    this.counterText.setPosition(x + this.counterGem.width + 3, bg.y + 4);
  }

  /** The heart of the wish: the crystal's middle, or the egg's as the Nest takes its place. */
  private get coreY(): number {
    return Phaser.Math.Linear(this.crystalY, this.floorY - EGG_REST - EGG_H / 2, this.nestK);
  }

  /** Where gems fly to and from on the counter. */
  private get counterAt(): { x: number; y: number } {
    return { x: this.counterGem.x + this.counterGem.width / 2, y: this.counterGem.y + this.counterGem.height / 2 };
  }

  private refreshInfo(): void {
    if (this.phase === 'idle') this.shownGems = collection.gems;
    this.placeCounter();
    const left = PITY - (this.pets ? collection.petPity : collection.pity);
    this.pityText.setText(`${left}`);
    this.pityText.setX(SIDE_W - 7 - this.pityText.width);
    this.pityGauge.set(1 - left / PITY);
    this.pityMiniText.setText(`Legendary in ${left}`.toUpperCase());
    this.pityMiniGauge.set(1 - left / PITY);
    this.placePityMini(this.wish10.y);
    const o = this.pets ? ownedPets() : ownedSkins();
    this.ownedText.setText(`${this.pets ? 'Companions' : 'Skins'} ${o.owned}/${o.of}`.toUpperCase());
    this.ownedGauge.set(o.owned / Math.max(1, o.of));
    this.wish1.setCost(WISH_COST, collection.gems >= WISH_COST);
    this.wish10.setCost(WISH10_COST, collection.gems >= WISH10_COST);
    if (this.portalText) {
      for (const p of ['skins', 'pets'] as const) {
        const n = PITY - (p === 'pets' ? collection.petPity : collection.pity);
        this.portalText[p]?.setText((this.portalW >= 130 ? `Legendary in ${n}` : `* in ${n}`).toUpperCase());
      }
    }
    if (this.phase === 'idle') this.refreshTags();
  }

  // ---- Buying ----

  /** An offer's counter: the card big, what it is, what's in it, its price, and Buy. */
  private openOffer(offer: Offer): void {
    if (this.modal) return;
    const owned = offerOwned(offer);
    const PW = 212;
    const PH = 132;
    const vw = this.vw;
    const vh = this.vh;
    const shade = this.add.rectangle(0, 0, Math.ceil(vw) + 1, Math.ceil(vh) + 1, 0x05030c, 0.65).setOrigin(0).setInteractive();
    shade.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.closeModal());
    const px = Math.round((vw - PW) / 2);
    const py = Math.round((vh - PH) / 2);
    const panel = this.add.image(px, py, panelTexture(this, 'shop_offer', PW, PH, PANEL)).setOrigin(0).setInteractive();
    const info = RARITY_INFO[offer.rarity];
    const cw = 76;
    const ch = 112;
    registerCardArt(this, cw, ch);
    const faces = offerFace(this, offer, cw, ch, true);
    const halo = this.add.image(px + 8 + cw / 2, py + 10 + ch / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(info.tint).setScale(3).setAlpha(0.35);
    const card = this.add.container(px + 8 + cw / 2, py + 10 + ch / 2, faces.flatMap((f) => f.parts));
    const sheen = TIER[offer.rarity] >= 1 ? this.add.image(0, 0, `wish_sheen_${cw}x${ch}`, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(info.core).setAlpha(0.55) : null;
    if (sheen) card.add(sheen);
    const x0 = px + cw + 16;
    const room = PW - cw - 24;
    const probe = pixelText(this, 0, 0, '').setVisible(false);
    const parts: Phaser.GameObjects.GameObject[] = [shade, halo, panel, card];
    parts.push(pixelText(this, x0, py + 9, fitLine(probe, offer.name, room), info.core));
    const sub = offer.kind === 'skin' ? `${offer.entry.cls.name} * ${offer.entry.type.name}` : offer.kind === 'pet' ? offer.pet.perk : offer.blurb;
    parts.push(pixelText(this, x0, py + 19, fitLine(probe, sub, room), offer.kind === 'pet' ? offer.pet.tint : LAVENDER));
    const kind = offer.kind === 'skin' ? 'skin' : offer.kind === 'pet' ? 'companion' : 'bundle';
    const label = pixelText(this, x0 + info.stars * 6 + 3, py + 30, `${info.name} ${kind}`, info.tint);
    for (let s = 0; s < info.stars; s++) parts.push(this.add.image(x0 + s * 6, py + 30, 'icon_star').setOrigin(0).setTint(info.tint));
    if (label.x + label.width > x0 + room) label.setText(info.name.toUpperCase());
    parts.push(label);
    let y = py + 43;
    if (offer.kind === 'bundle') {
      // What's in it, each in its rarity's colour, struck through once owned.
      const items = [...offer.skins.map((s) => ({ name: s.skin.name, r: s.rarity, have: collection.hasSkin(s.id) })), ...offer.pets.map((p) => ({ name: p.name, r: p.rarity, have: collection.hasPet(p.id) }))];
      const show = items.slice(0, 4);
      for (const it of show) {
        const t = pixelText(this, x0, y, fitLine(probe, `* ${it.name}`, room), it.have ? 0x5a5280 : RARITY_INFO[it.r].tint);
        parts.push(t);
        if (it.have) parts.push(this.add.rectangle(x0, y + 4, t.width, 1, 0x8a80b8).setOrigin(0));
        y += 9;
      }
      if (items.length > show.length) parts.push(pixelText(this, x0, y, `+${items.length - show.length} more`, LAVENDER));
    } else {
      const lines = offer.kind === 'skin' ? ['A new look:', 'the same moves'] : ['Follows you on', 'every run'];
      for (const l of lines) {
        parts.push(pixelText(this, x0, y, l, 0x7c72b0));
        y += 9;
      }
    }
    probe.destroy();
    const price = priceOf(offer);
    const afford = collection.gems >= price;
    if (offer.kind === 'bundle' && !owned) {
      const was = pixelText(this, x0, py + PH - 40, `Was ${fullPrice(offer)}`, 0x7c72b0);
      parts.push(was, this.add.rectangle(x0 + 20, py + PH - 36, was.width - 20, 1, SHORT).setOrigin(0));
    }
    const buyBtn = new JewelButton(this, owned ? 'Owned' : 'Buy', owned ? null : price, 66, 26, JEWEL_ROYAL, 'buy', () => this.purchase(offer, buyBtn));
    if (!owned) buyBtn.setCost(price, afford);
    buyBtn.setEnabled(!owned).setAlpha(owned ? 0.6 : 1);
    buyBtn.place(x0, py + PH - 32);
    const cancel = new PixelButton(this, 'Close', 44, 18, BUTTON_PLAIN, 'shop_close', () => this.closeModal());
    cancel.place(px + PW - 52, py + PH - 28);
    parts.push(buyBtn, cancel);
    const m = this.add.container(0, 0, parts).setDepth(70);
    m.setData('sheen', sheen);
    m.setData('tier', TIER[offer.rarity]);
    this.modal = m;
    m.setAlpha(0);
    card.setScale(0.9);
    this.tweens.add({ targets: m, alpha: 1, duration: 160 });
    this.tweens.add({ targets: card, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.showUi(true, 0);
  }

  private closeModal(): void {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    this.tweens.add({ targets: m, alpha: 0, duration: 140, onComplete: () => m.destroy() });
  }

  /** Buy it: the gems pour out of the counter, and what was bought is dealt and turned like a wish. */
  private purchase(offer: Offer, btn: JewelButton): void {
    if (this.phase !== 'idle' || !this.modal) return;
    const before = collection.gems;
    const got = buy(offer);
    if (!got) return this.notEnough(btn);
    const m = this.modal;
    this.modal = null;
    m.destroy();
    sound.gemSpend();
    this.shownGems = before;
    this.tweens.addCounter({ from: before, to: collection.gems, duration: 600, ease: 'Sine.easeOut', onUpdate: (tw) => ((this.shownGems = tw.getValue() ?? 0), this.placeCounter()) });
    this.present(got);
  }

  /** What was bought, shown as a wish's cards are: dealt from the middle in a burst of light, turned at once. */
  private present(got: Bought[]): void {
    if (!got.length) return;
    this.phase = 'reveal';
    const pulls = got.map((b) => (b.kind === 'skin' ? skinPull({ entry: b.entry, fresh: true, refund: 0 }) : petPull(b.pet, true)));
    const best = Math.max(...pulls.map((p) => TIER[p.rarity]));
    this.showUi(false, 200);
    this.tweens.add({ targets: this.dim, fillAlpha: 0.55, duration: 300 });
    const at = { x: this.vw / 2, y: this.vh / 2 };
    this.pourGems(Math.min(12, 4 + got.length * 2), at);
    this.time.delayedCall(520, () => {
      this.flash.setFillStyle(0xffffff).setAlpha(0.8);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 500, ease: 'Quad.easeIn' });
      sound.wishBurst(best);
      this.shards.setParticleTint(TINTS[best]);
      this.shards.explode(30 + best * 20, at.x, at.y);
      for (let i = 0; i <= best; i++) this.ring(i % 2 ? 0xffffff : TINTS[best], 2.5 + i, i * 110, at);
      this.dealFrom = at;
      this.deal(pulls);
    });
  }

  // ---- The wish ----

  private makeWish(count: 1 | 10): void {
    if (this.phase !== 'idle' || this.leaving || this.page === 'store') return;
    const cost = count === 10 ? WISH10_COST : WISH_COST;
    const before = collection.gems;
    const results = this.pets ? petWish(count)?.map((r) => petPull(r.pet, r.fresh)) : wish(count)?.map(skinPull);
    if (!results) return this.notEnough(count === 10 ? this.wish10 : this.wish1);
    this.lastCount = count;
    this.phase = 'charge';
    const best = Math.max(...results.map((r) => TIER[r.rarity]));
    this.shownGems = before;
    this.placeCounter();

    // The menus step back and the hall darkens around the crystal.
    this.showUi(false, 250);

    // The gems pour from the counter into the crystal, the counter running down.
    this.tweens.addCounter({ from: before, to: before - cost, duration: 600, ease: 'Sine.easeOut', onUpdate: (tw) => ((this.shownGems = tw.getValue() ?? 0), this.placeCounter()) });
    this.pourGems(count === 10 ? 12 : 5, { x: this.crystalX, y: this.coreY });
    sound.gemSpend();

    const dur = best === 2 ? CHARGE_LEGEND_MS : CHARGE_MS;
    this.time.delayedCall(520, () => this.chargeCrystal(dur, best, results));
  }

  /** Gems fly from the counter in an arc and vanish into the crystal (or wherever `to` is). */
  private pourGems(n: number, to: { x: number; y: number }): void {
    const from = this.counterAt;
    for (let i = 0; i < n; i++) {
      const g = this.add.image(from.x, from.y, 'gem_s').setDepth(45);
      const mid = { x: (from.x + to.x) / 2 + Phaser.Math.Between(-30, 30), y: Math.min(from.y, to.y) - Phaser.Math.Between(10, 40) };
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(to.x, to.y));
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * 45,
        duration: 480,
        ease: 'Sine.easeIn',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const p = path.getPoint(t);
          g.setPosition(Math.round(p.x), Math.round(p.y)).setScale(1 - t * 0.5).setAngle(t * 360);
        },
        onComplete: () => {
          g.destroy();
          this.shards.setParticleTint(0x9ff6ff);
          this.shards.explode(3, to.x, to.y);
          this.charge = Math.min(1, this.charge + 0.04);
        },
      });
    }
  }

  /**
   * The crystal gathers light, rising and spinning faster, its glow turning
   * blue; violet partway if it holds an epic, gold near the end if a
   * legendary (the hall going dark for it). The best rarity it holds comes as
   * a falling star that strikes it. Then it bursts.
   */
  private chargeCrystal(dur: number, best: number, results: Pull[]): void {
    sound.wishCharge(dur / 1000, best);
    this.gather.start();
    this.tweens.add({ targets: this, lift: 12, duration: dur, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this, spinSpeed: CHARGED_SPIN, charge: 1, duration: dur, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: best === 2 ? 0.7 : 0.45, duration: dur });
    this.shiftTint(TINTS[0], 300);
    const at = [0, 0.45, 0.75];
    for (let tier = 1; tier <= best; tier++) {
      const when = dur * at[tier];
      if (tier === best) this.time.delayedCall(Math.max(0, when - STAR_MS), () => this.fallingStar(TINTS[tier], tier));
      this.time.delayedCall(when, () => this.hintRarity(TINTS[tier], tier));
    }
    this.time.delayedCall(dur, () => this.burst(best, results));
  }

  /** A star falls out of the vault in the rarity's colour and strikes the crystal, trailing light. */
  private fallingStar(color: number, tier: number): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    const from = { x: this.crystalX + side * Math.min(this.vw * 0.42, 190), y: this.top - 10 };
    const head = this.add.image(from.x, from.y, 'loot_twinkle').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(tier === 2 ? 2 : 1.5).setDepth(56);
    const core = this.add.image(from.x, from.y, 'spark').setBlendMode(Phaser.BlendModes.ADD).setScale(tier === 2 ? 2.4 : 1.8).setDepth(56.5);
    const trail = this.add.particles(0, 0, 'spark', {
      follow: head,
      lifespan: { min: 260, max: 520 },
      speed: { min: 2, max: 14 },
      scale: { start: tier === 2 ? 1.6 : 1.2, end: 0 },
      tint: [color, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 10,
    }).setDepth(55.5);
    sound.lootFall(side * 0.6);
    this.tweens.add({
      targets: [head, core],
      x: this.crystalX,
      y: this.coreY,
      duration: STAR_MS,
      ease: 'Quad.easeIn',
      onUpdate: () => head.setAngle(head.angle + 14),
      onComplete: () => {
        head.destroy();
        core.destroy();
        trail.stop();
        this.time.delayedCall(600, () => trail.destroy());
        this.shards.setParticleTint(color);
        this.shards.explode(tier === 2 ? 34 : 20, this.crystalX, this.coreY);
      },
    });
  }

  /** The crystal's glow turns to another colour. */
  private shiftTint(to: number, ms: number): void {
    const from = this.tint;
    this.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: (tw) => (this.tint = lerpColor(from, to, tw.getValue() ?? 1)) });
  }

  /** A rarity shows itself mid-charge: a pulse of its colour, a ring and a jolt. */
  private hintRarity(color: number, tier: number): void {
    this.shiftTint(color, 180);
    this.ring(color, tier === 2 ? 3 : 2, 0);
    this.jolt(tier === 2 ? 300 : 160, tier === 2 ? 2 : 1);
    this.gather.setParticleTint(color);
    this.flash.setFillStyle(color).setAlpha(tier === 2 ? 0.35 : 0.2);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
  }

  /**
   * Shake the view for `ms`, up to `px` art pixels, easing off. (Phaser's own
   * shake moves a zoomed camera by fractions of a pixel, which smears the
   * pixel art, and scales with the screen's size.)
   */
  private jolt(ms: number, px: number): void {
    if (!settings.values.shake) return;
    if (px >= this.shake.px * (this.shake.t / Math.max(1, this.shake.ms))) this.shake = { t: ms, ms, px };
  }

  /** A ring of light racing out from the crystal (or from `at`). */
  private ring(color: number, scale: number, delay: number, at?: { x: number; y: number }): void {
    const r = this.add.image(at?.x ?? this.crystalX, at?.y ?? this.coreY + 6, 'loot_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(54).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: r, scale, alpha: { from: 1, to: 0 }, delay, duration: 700, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  /** The crystal bursts (or the egg hatches): a white flash, shards and rings in the best rarity's colour, and the cards come out. */
  private burst(best: number, results: Pull[]): void {
    const color = TINTS[best];
    this.gather.stop();
    sound.wishBurst(best);
    this.flash.setFillStyle(0xffffff).setAlpha(1);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 700, ease: 'Quad.easeIn' });
    this.jolt(best === 2 ? 420 : 240, best === 2 ? 3 : 2);
    this.shards.setParticleTint(color);
    this.shards.explode(best === 2 ? 90 : 55, this.crystalX, this.coreY);
    if (this.pets) {
      // The egg's shell flies apart in cream and gold, its crown spinning away.
      this.shards.setParticleTint(0xfff4d6);
      this.shards.explode(26, this.crystalX, this.coreY);
      this.shards.setParticleTint(GOLD);
      this.shards.explode(14, this.crystalX, this.coreY);
      this.hatch();
    } else {
      this.shards.setParticleTint(0xffffff);
      this.shards.explode(30, this.crystalX, this.coreY);
    }
    for (let i = 0; i <= best + 1; i++) this.ring(i % 2 ? 0xffffff : color, 2.5 + i, i * 110);
    // The crystal (or the egg) is spent; it forms again when the player carries on.
    this.crystalShown = 0;
    this.dealFrom = { x: this.crystalX, y: this.coreY };
    this.deal(results);
  }

  /** The egg breaks in two: its crown spins up and away, its cup drops and fades. */
  private hatch(): void {
    if (!this.textures.exists('nest_half_top')) return;
    const x = this.egg.x;
    const y = this.egg.y;
    const s = this.egg.scaleX;
    const top = this.add.image(x, y, 'nest_half_top').setOrigin(0.5, 1).setScale(s).setDepth(56);
    const cup = this.add.image(x, y, 'nest_half_bottom').setOrigin(0.5, 1).setScale(s).setDepth(56);
    const side = Math.random() < 0.5 ? -1 : 1;
    this.tweens.add({ targets: top, x: x + side * 46, angle: side * 260, duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: top, y: y - 40, duration: 380, ease: 'Quad.easeOut', yoyo: true, hold: 0, onComplete: () => this.tweens.add({ targets: top, alpha: 0, y: y + 30, duration: 300, onComplete: () => top.destroy() }) });
    this.tweens.add({ targets: cup, y: y + 3, alpha: 0, delay: 250, duration: 600, ease: 'Quad.easeIn', onComplete: () => cup.destroy() });
  }

  /** Lay the cards out, face down, flying out of where the wish burst, then turn them one by one. */
  private deal(results: Pull[]): void {
    this.phase = 'reveal';
    const big = results.length === 1;
    const spark = (x: number, y: number, tint: number) => {
      this.sparks.setParticleTint(tint);
      this.sparks.explode(1, x, y);
    };
    this.cards = results.map((r) => new WishCard(this, r, big, spark));
    const spots = this.cardSpots(results.length);
    const from = this.dealFrom;
    this.cards.forEach((c, i) => {
      c.home = spots[i];
      c.setPosition(from.x, from.y).setScale(0.15 * spots[i].scale).setAlpha(0).setAngle(Phaser.Math.Between(-40, 40));
      this.tweens.add({
        targets: c,
        x: spots[i].x,
        y: spots[i].y,
        scale: spots[i].scale,
        alpha: 1,
        angle: 0,
        delay: 200 + i * 70,
        duration: 420,
        ease: 'Back.easeOut',
        onStart: () => sound.cardFlip(0),
      });
    });
    const dealt = 200 + results.length * 70 + 450;
    // A card bought rather than wished for has no secret to keep: the cards turn at once.
    this.flipTimer = this.time.delayedCall(dealt + (this.page === 'store' ? 0 : 150), () => this.flipNext(0));
  }

  /** Where each card goes: one big in the middle, or as many columns as fit (five across on a wide screen). */
  private cardSpots(n: number): { x: number; y: number; scale: number }[] {
    const vw = this.vw;
    const top = this.top + 17;
    const bottom = this.vh - 34;
    if (n === 1) return [{ x: Math.round(vw / 2), y: Math.round((top + bottom) / 2 - 4), scale: 1 }];
    const cols = Math.min(n, [5, 4, 3, 2].find((c) => c * CARD_W + (c - 1) * CARD_GAP <= vw - MARGIN * 2) ?? 2);
    const rows = Math.ceil(n / cols);
    const needH = rows * CARD_H + (rows - 1) * CARD_GAP;
    const scale = Math.min(1, (bottom - top) / needH);
    const cw = (CARD_W + CARD_GAP) * scale;
    const ch = (CARD_H + CARD_GAP) * scale;
    const y0 = (top + bottom) / 2 - ((rows - 1) * ch) / 2;
    return Array.from({ length: n }, (_v, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const x0 = vw / 2 - ((inRow - 1) * cw) / 2;
      return { x: Math.round(x0 + (i % cols) * cw), y: Math.round(y0 + row * ch), scale };
    });
  }

  /** On a resize mid-reveal, the cards move to their new places. */
  private placeReveal(): void {
    if (!this.cards.length) return;
    const spots = this.cardSpots(this.cards.length);
    this.cards.forEach((c, i) => {
      c.home = spots[i];
      if (c.depth < 50) c.setPosition(spots[i].x, spots[i].y).setScale(spots[i].scale);
    });
    this.placeDoneButtons();
  }

  /** Turn card `i`, then the next after a moment. A legendary among many is first taken to the middle and turned alone. */
  private flipNext(i: number): void {
    if (this.phase !== 'reveal') return;
    const card = this.cards[i];
    if (!card) return this.revealed();
    if (card.flipped) return this.flipNext(i + 1);
    const legend = card.rarity === 'legendary';
    const quick = this.page === 'store';
    if (legend && this.cards.length > 1) return this.spotlight(card, () => this.flipNext(i + 1));
    const turn = () => {
      this.turnCard(card);
      this.flipTimer = this.time.delayedCall(quick ? 90 : legend ? FLIP_EVERY * 2 : FLIP_EVERY, () => this.flipNext(i + 1));
    };
    if (legend && !quick) {
      // The card trembles, glowing gold, before it turns.
      this.tweens.add({ targets: card, angle: { from: -3, to: 3 }, duration: 50, yoyo: true, repeat: 5, onComplete: () => card.setAngle(0) });
      this.flipTimer = this.time.delayedCall(LEGEND_PAUSE, turn);
    } else turn();
  }

  /**
   * A legendary among many: the others dim, it comes to the middle, big,
   * trembles as light gathers into it, and turns in a burst; then (after a
   * moment, or a tap) it goes back to its place and the rest carry on.
   */
  private spotlight(card: WishCard, then: () => void): void {
    const others = this.cards.filter((c) => c !== card);
    for (const o of others) this.tweens.add({ targets: o, alpha: 0.3, duration: 250 });
    card.lift(true);
    const mid = { x: this.vw / 2, y: (this.top + 17 + this.vh - 34) / 2 + 6 };
    // Whole or half steps keep the pixels even.
    const scale = Math.max(1.5, Math.min(SPOT_SCALE, Math.floor(((this.vh - this.top - 70) / CARD_H) * 2) / 2));
    this.tweens.add({ targets: this.dim, fillAlpha: 0.8, duration: 300 });
    this.tweens.add({
      targets: card,
      x: mid.x,
      y: mid.y,
      scale,
      duration: 380,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.gather.setPosition(card.x, card.y).setParticleTint(GOLD).start();
        sound.wishCharge(0.6, 2);
        this.tweens.add({ targets: card, angle: { from: -3, to: 3 }, duration: 45, yoyo: true, repeat: 6, onComplete: () => card.setAngle(0) });
        this.flipTimer = this.time.delayedCall(620, () => {
          this.gather.stop();
          this.turnCard(card);
          let done = false;
          const back = () => {
            if (done) return;
            done = true;
            this.spotEnd = null;
            this.tweens.add({ targets: this.dim, fillAlpha: this.page === 'store' ? 0.55 : 0.7, duration: 300 });
            for (const o of others) this.tweens.add({ targets: o, alpha: 1, duration: 250 });
            this.tweens.add({ targets: card, x: card.home.x, y: card.home.y, scale: card.home.scale, duration: 340, ease: 'Sine.easeInOut', onComplete: () => card.lift(false) });
            this.flipTimer = this.time.delayedCall(360, then);
          };
          this.spotEnd = back;
          this.flipTimer = this.time.delayedCall(SPOT_HOLD, back);
        });
      },
    });
  }

  /** Turn one card, with the flourish its rarity earns. */
  private turnCard(card: WishCard): void {
    card.flip(() => {
      const r = card.rarity;
      const info = RARITY_INFO[r];
      const t = TIER[r];
      sound.cardFlip(t);
      this.shards.setParticleTint(info.tint);
      this.shards.explode(t === 2 ? 40 : t === 1 ? 22 : 10, card.x, card.y);
      if (t >= 1) this.ring(info.tint, t === 2 ? 3 : 2, 0, card);
      if (t === 2) {
        this.jolt(260, 2);
        this.flash.setFillStyle(info.tint).setAlpha(0.45);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
        this.ring(0xffffff, 4, 120, card);
      }
      // A big card (alone, or a legendary in the middle) lands with a bounce and has its rarity struck over it.
      if (this.cards.length === 1 || card.depth >= 50) {
        this.tweens.add({ targets: card, scaleY: { from: card.scaleY * 1.08, to: card.scaleY }, duration: 260, ease: 'Back.easeOut' });
        if (t >= 1) this.strike(card);
        if (this.cards.length === 1) this.ribbon(card);
      }
    });
  }

  /** The rarity's name struck in big bevelled letters over a card, slamming down and fading after a while. */
  private strike(card: WishCard): void {
    const r = card.rarity;
    const text = `${RARITY_INFO[r].name}!`;
    const s = 2;
    const img = this.add.image(card.x, 0, addBitmap(this, `shop_strike_${r}`, titleBitmap(text, RARITY_TITLE[r], s))).setDepth(57);
    const cardTop = card.y - (card.h / 2) * card.scaleY;
    // Over a single card; under one taken to the middle, clear of its tag.
    const under = this.cards.length > 1;
    const cardBottom = card.y + (card.h / 2) * card.scaleY;
    img.setY(Math.round(under ? Math.min(this.vh - img.height / 2 - 2, cardBottom + img.height / 2 + 3) : Math.max(this.top + img.height / 2, cardTop - img.height / 2 - 6 * card.scaleY)));
    img.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: img, alpha: 0, delay: this.cards.length === 1 ? 2600 : SPOT_HOLD - 200, duration: 400, onComplete: () => img.destroy() });
    // A single wish's card keeps its word until it's put away.
    if (this.cards.length === 1) card.once(Phaser.GameObjects.Events.DESTROY, () => img.active && img.destroy());
  }

  /** Under a single wish's card: a ribbon with its rarity's name and stars. */
  private ribbon(card: WishCard): void {
    const info = RARITY_INFO[card.rarity];
    const w = 104;
    const img = this.add.image(0, 0, addBitmap(this, `shop_ribbon_${card.rarity}`, ribbonBitmap(w, toRGB(info.tint), toRGB(info.deep)))).setOrigin(0);
    const label = pixelText(this, 0, 2, info.name, info.core);
    label.setX(Math.round((w - label.width) / 2));
    const c = this.add.container(Math.round(card.x - w / 2), Math.round(card.y + card.h / 2 + 3), [img, label]).setDepth(57).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: c.y + 2, duration: 300, delay: 120 });
    card.once(Phaser.GameObjects.Events.DESTROY, () => c.destroy());
    card.setData('ribbon', c);
  }

  /** A tap: a legendary in the middle goes back at once; otherwise every card still face down turns, a legendary still taking its turn in the middle. */
  private flipAll(): void {
    if (this.phase !== 'reveal' || !this.cards.length) return;
    if (this.spotEnd) return this.spotEnd();
    if (this.cards.some((c) => c.depth >= 50)) return;
    const waiting = this.cards.filter((c) => !c.flipped);
    if (!waiting.length) return;
    this.flipTimer?.remove();
    const plain = waiting.filter((c) => c.rarity !== 'legendary' || this.cards.length === 1);
    plain.forEach((c, i) => this.time.delayedCall(i * 40, () => this.turnCard(c)));
    this.flipTimer = this.time.delayedCall(plain.length * 40 + 300, () => this.flipNext(0));
  }

  /** Every card is face up: duplicates dissolve into gems, then the player can carry on (or wish again). */
  private revealed(): void {
    if (this.phase !== 'reveal') return;
    this.phase = 'done';
    const dupes = this.cards.filter((c) => !c.pull.fresh);
    dupes.forEach((c, i) => this.time.delayedCall(700 + i * 260, () => this.evaporate(c)));
    const after = 500 + dupes.length * 260 + (dupes.length ? 900 : 0);
    if (this.cards.length > 1) {
      const fresh = this.cards.length - dupes.length;
      this.summary.setText(`${fresh} new${dupes.length ? `  *  ${dupes.length * DUPE_GEMS} gems back` : ''}`.toUpperCase());
    } else this.summary.setText('');
    this.time.delayedCall(after, () => {
      if (this.phase !== 'done') return;
      const store = this.page === 'store';
      const cost = this.lastCount === 10 ? WISH10_COST : WISH_COST;
      this.againBtn.setCost(cost, collection.gems >= cost);
      this.placeDoneButtons();
      for (const b of store ? [this.continueBtn, this.summary] : [this.continueBtn, this.againBtn, this.summary]) {
        b.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: b, alpha: 1, duration: 250 });
      }
      this.continueBtn.setEnabled(true);
      this.againBtn.setEnabled(!store);
    });
  }

  private placeDoneButtons(): void {
    const store = this.page === 'store';
    const y = this.vh - 30;
    const w = this.continueBtn.boxW + (store ? 0 : 8 + this.againBtn.boxW);
    const x = Math.round((this.vw - w) / 2);
    this.continueBtn.place(x, y + 1);
    this.againBtn.place(x + this.continueBtn.boxW + 8, y);
    this.summary.setPosition(Math.round((this.vw - this.summary.width) / 2), this.top + 4);
  }

  /**
   * A skin the player had already: the card flares white, crumbles into
   * light and gems, and the gems fly up to the counter, counting up as each
   * one arrives.
   */
  private evaporate(card: WishCard): void {
    if (!card.active) return;
    const n = DUPE_GEMS;
    const pop = pixelText(this, 0, 0, `+${n}`, GEM_CYAN).setDepth(57);
    pop.setPosition(Math.round(card.x - pop.width / 2), Math.round(card.y - 6));
    this.tweens.add({ targets: pop, y: pop.y - 18, alpha: { from: 1, to: 0 }, delay: 300, duration: 900, onComplete: () => pop.destroy() });
    this.shards.setParticleTint(0xffffff);
    this.shards.explode(26, card.x, card.y);
    this.tweens.add({ targets: card, alpha: 0, scale: card.scaleY * 1.12, duration: 380, ease: 'Quad.easeIn', onComplete: () => card.setVisible(false) });
    (card.getData('ribbon') as Phaser.GameObjects.Container | undefined)?.setVisible(false);
    const to = this.counterAt;
    for (let i = 0; i < n; i++) {
      const g = this.add.image(card.x, card.y, 'gem_s').setDepth(56);
      const a = (i / n) * Math.PI * 2;
      const out = { x: card.x + Math.cos(a) * Phaser.Math.Between(14, 26), y: card.y + Math.sin(a) * Phaser.Math.Between(10, 20) };
      // Burst outward, hang a moment, then streak to the counter.
      this.tweens.chain({
        targets: g,
        tweens: [
          { x: out.x, y: out.y, duration: 260, ease: 'Quad.easeOut' },
          { x: to.x, y: to.y, scale: 0.6, delay: 80 + i * 40, duration: 420, ease: 'Quad.easeIn' },
        ],
        onComplete: () => {
          g.destroy();
          this.shownGems += 1;
          this.placeCounter();
          this.counterGem.setScale(1.3);
          this.tweens.add({ targets: this.counterGem, scale: 1, duration: 140 });
          sound.gemTick();
        },
      });
    }
  }

  /** Put the cards away and bring the page back: on a wishing page, the crystal forms again. */
  private finish(): void {
    if (this.phase !== 'done') return;
    this.phase = 'idle';
    for (const b of [this.continueBtn, this.againBtn, this.summary]) b.setVisible(false);
    this.continueBtn.setEnabled(false);
    this.againBtn.setEnabled(false);
    for (const c of this.cards) this.tweens.add({ targets: c, alpha: 0, y: c.y + 6, duration: 220, onComplete: () => c.destroy() });
    this.cards = [];
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 400 });
    this.lift = 0;
    this.spinSpeed = IDLE_SPIN;
    this.charge = 0;
    this.shiftTint(this.idleTint, 500);
    if (this.page !== 'store') {
      // The crystal (or a new egg) forms again from light.
      this.tweens.add({ targets: this, crystalShown: 1, duration: 600, ease: 'Sine.easeOut' });
      this.shards.setParticleTint(this.pets ? NEST_TINT : 0x9ff6ff);
      this.shards.explode(20, this.crystalX, this.coreY);
    } else this.crystalShown = 1;
    this.shownGems = collection.gems;
    this.refreshInfo();
    this.showUi(true, 300);
    this.showFeatured(false);
  }

  /** Wish again, as many as last time, straight from the cards. */
  private again(): void {
    if (this.phase !== 'done' || this.page === 'store') return;
    const cost = this.lastCount === 10 ? WISH10_COST : WISH_COST;
    if (collection.gems < cost) return this.notEnough(this.againBtn);
    this.finish();
    this.makeWish(this.lastCount);
  }

  /** Not enough gems: the button shakes and a word says so. */
  private notEnough(btn: Phaser.GameObjects.Container): void {
    const x = btn.x;
    this.tweens.add({ targets: btn, x: { from: x - 2, to: x + 2 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => btn.setX(x) });
    this.tweens.killTweensOf(this.warn);
    this.warn.setPosition(Math.round(btn.x + ((btn as unknown as { boxW: number }).boxW ?? 0) / 2 - this.warn.width / 2), Math.round(btn.y - 11));
    this.warn.setAlpha(1);
    this.tweens.add({ targets: this.warn, alpha: 0, delay: 1100, duration: 400 });
  }

  /** Back: from a wishing page to the storefront, from the storefront to the home screen. */
  private goBack(): void {
    if (this.leaving || this.phase !== 'idle' || this.modal) return;
    if (this.page !== 'store') return this.setPage('store');
    this.leaving = true;
    collection.flush();
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  // ---- Every frame ----

  update(time: number, dt: number): void {
    this.elapsed += dt;
    const sh = this.shake;
    const cam = this.cameras.main;
    if (sh.t > 0) {
      sh.t = Math.max(0, sh.t - dt);
      // A new offset every other frame or so reads as a shudder rather than a blur.
      const amp = Math.round(sh.px * (sh.t / sh.ms));
      cam.setScroll(Phaser.Math.Between(-amp, amp), Phaser.Math.Between(-amp, amp));
    } else if (cam.scrollX || cam.scrollY) cam.setScroll(0, 0);
    const t = this.elapsed;
    const cx = this.crystalX;
    const cy = this.crystalY - this.lift + Math.round(Math.sin(t * 0.0018) * 2);
    const stage = this.stageK;

    // The crystal turns through its rendered frames; a facet flashes as it swings into the light.
    this.spin += this.spinSpeed * dt;
    const f = Math.floor((this.spin / (Math.PI / 3)) * CRYSTAL_FRAMES) % CRYSTAL_FRAMES;
    if (f !== this.crystalFrame) {
      this.crystalFrame = f;
      this.crystal.setFrame(f);
      this.crystalLight.setFrame(f);
    }
    const turn = Math.cos(this.spin * 6);
    const shown = this.crystalShown * stage;
    const nest = this.nestK;
    const gem = shown * (1 - nest);
    this.crystal.setPosition(cx, cy).setScale(Math.max(0.01, this.crystalShown)).setAlpha(gem).setVisible(gem > 0.01);
    this.crystalLight
      .setPosition(cx, cy)
      .setScale(Math.max(0.01, this.crystalShown))
      .setTint(this.tint)
      .setAlpha((0.25 + 0.2 * (1 - Math.abs(turn)) + 0.6 * this.charge) * gem)
      .setVisible(gem > 0.01);
    this.updateEgg(t, this.crystalShown * nest, stage);
    // The glow, the stars and the rays centre on whichever holds the wish.
    const hy = Phaser.Math.Linear(cy, this.coreY - this.lift * 0.4, nest);
    this.crystalGlow
      .setPosition(cx, hy + 2)
      .setTint(this.tint)
      .setScale(2.6 + 2.4 * this.charge + 0.15 * Math.sin(t * 0.003))
      .setAlpha((0.45 + 0.4 * this.charge) * Math.max(0.35, this.crystalShown) * stage);
    this.gather.setPosition(this.phase === 'charge' ? cx : this.gather.x, this.phase === 'charge' ? hy : this.gather.y);

    // Stars circling it, passing behind and in front.
    this.orbit.forEach((o, i) => {
      const a = t * (0.0012 + this.spinSpeed * 0.3) + (i / this.orbit.length) * Math.PI * 2;
      const front = Math.sin(a) > 0;
      o.setPosition(Math.round(cx + Math.cos(a) * 24), Math.round(hy + 6 + Math.sin(a) * 7))
        .setDepth(front ? 10.8 : 9.5)
        .setAlpha((0.4 + 0.6 * Math.max(0, Math.sin(t * 0.006 + i * 1.3))) * Math.max(0.3, this.crystalShown) * (1 - nest * 0.6) * stage)
        .setTint(i % 2 ? 0xffffff : this.tint);
    });

    // The hall's light: the shaft breathing, the god rays turning, the runes and lamps pulsing.
    const breathe = Math.sin(t * 0.0014);
    this.shaft.setAlpha((0.18 + 0.05 * breathe + 0.25 * this.charge) * (0.35 + 0.65 * stage)).setTint(this.tint);
    const n = this.rays.length;
    const rayTint = lerpColor(0x5ae8ff, NEST_LEAF, nest);
    this.rays.forEach((r, i) => {
      const long = i % 2 ? 0.6 : 1;
      r.setPosition(cx, hy)
        .setRotation((i / n) * Math.PI * 2 + t * (0.00012 + this.spinSpeed * 0.05))
        .setScale(1.8, (2.4 + 2 * this.charge) * long * (0.9 + 0.1 * Math.sin(t * 0.002 + i)))
        .setAlpha((0.08 + 0.1 * this.charge) * (i % 2 ? 1 : 0.7) * stage)
        .setTint(i % 2 ? rayTint : this.tint);
    });
    this.runes.setAlpha((0.45 + 0.3 * Math.sin(t * 0.003) + 0.25 * this.charge) * stage).setTint(this.tint);
    // The rune circle turns, faster as the wish charges.
    this.sigilT += dt * (1 + 7 * this.charge);
    this.sigil.setFrame(Math.floor(this.sigilT / 110) % SIGIL_FRAMES).setTint(this.tint).setAlpha((0.22 + 0.06 * breathe + 0.55 * this.charge) * stage);
    // In the Nest the lamps burn bigger and greener-gold, and a warm light fills the hall.
    const lampTint = lerpColor(0xffa84a, 0xe8d860, nest);
    this.lamps.forEach((l, i) => l.setAlpha(0.3 + 0.12 * nest + 0.06 * Math.sin(t * 0.011 + i * 3) + 0.04 * Math.sin(t * 0.027 + i)).setTint(lampTint).setScale(1.6 + nest * 0.8));
    this.nestLight.setAlpha(nest * (0.32 + 0.04 * breathe)).setVisible(nest > 0.01);
    // The hall itself warms from violet night towards amber dusk.
    this.hall.setTint(lerpColor(0xffffff, NEST_HALL, nest));
    this.altar.setTint(lerpColor(0xffffff, NEST_HALL, nest * 0.6));

    if (this.phase === 'idle') {
      // The showcase moves on every few seconds, and its card's sheen sweeps it.
      if (this.page !== 'store' && this.sides) {
        this.showT += dt;
        if (this.showT > 3600) {
          this.showT = 0;
          this.showAt++;
          this.showFeatured(true);
        }
        const g = this.showFace?.glow;
        if (g && this.showFace) g.setFrame(this.showFace.sprite.frame.name);
        const sf = sheenFrame(time, 2, 0);
        this.showSheen.setVisible(sf >= 0);
        if (sf >= 0) this.showSheen.setFrame(sf);
      }
      // The offers' sheens, and the clock to the next day's.
      if (this.page === 'store') {
        for (const c of this.offerCards) {
          for (const fc of c.face) if (fc.glow) fc.glow.setFrame(fc.sprite.frame.name);
          if (!c.sheen) continue;
          const sf = sheenFrame(time, c.tier, c.offset);
          c.sheen.setVisible(sf >= 0);
          if (sf >= 0) c.sheen.setFrame(sf);
        }
        this.clockT -= dt;
        if (this.clockT <= 0) {
          this.clockT = 1000;
          const ms = msToRefresh();
          const hrs = Math.floor(ms / 3600000);
          const mins = Math.floor((ms % 3600000) / 60000);
          const left = `${hrs}h ${String(mins).padStart(2, '0')}m`;
          this.storeClock.setText(`New in ${left}`.toUpperCase());
          if (this.storeHead.width + this.storeClock.width + 8 > this.rowW) this.storeClock.setText(left.toUpperCase());
          this.layoutClock();
        }
      }
      const m = this.modal;
      if (m) {
        const s = m.getData('sheen') as Phaser.GameObjects.Image | null;
        if (s) {
          const sf = sheenFrame(time, m.getData('tier') as number, 0);
          s.setVisible(sf >= 0);
          if (sf >= 0) s.setFrame(sf);
        }
      }
    }
    for (const c of this.cards) if (c.active) c.tick(time, dt);
  }

  /** The clock sits at the right end of the offers' heading. */
  /** How wide the offers' widest row is. */
  private get rowW(): number {
    if (!this.offerCards.length) return 0;
    const xs = this.offerCards.map((c) => c.box.x);
    return Math.max(...xs) - Math.min(...xs) + (this.offerSize.startsWith(`${OFFER_NARROW_W}x`) ? OFFER_NARROW_W : OFFER_W);
  }

  private layoutClock(): void {
    const first = this.offerCards[0];
    if (!first) return;
    const xs = this.offerCards.map((c) => c.box.x);
    const half = (this.offerSize.startsWith(`${OFFER_NARROW_W}x`) ? OFFER_NARROW_W : OFFER_W) / 2;
    const left = Math.min(...xs) - half;
    const right = Math.max(...xs) + half;
    this.storeHead.setX(Math.round(left));
    this.storeClock.setX(Math.round(right - this.storeClock.width));
  }

  /**
   * The Nest's egg, `k` of the way shown: it sits on the altar, rocking now
   * and then with a little hop; a wish sets it rocking harder and harder, and
   * the cracks spread, glowing, until it bursts.
   */
  private updateEgg(t: number, k: number, stage: number): void {
    const show = k * stage > 0.01;
    for (const o of [this.egg, this.eggGlow, ...this.cracks]) o.setVisible(show);
    if (!show) return;
    const c = this.charge;
    const x = this.crystalX;
    // Resting, it hops a little every few seconds; charging, it trembles and jumps.
    const cycle = (t % 3400) / 3400;
    const hop = cycle > 0.88 ? Math.sin(((cycle - 0.88) / 0.12) * Math.PI) * 3 : 0;
    const bottom = Math.round(this.floorY - EGG_REST - this.lift * 0.4 - hop * (1 - c) - (c > 0.5 ? Math.abs(Math.sin(t * 0.03)) * 3 * c : 0));
    const rock = Math.sin(t * (0.004 + c * 0.03)) * (0.04 + c * 0.22) + (cycle > 0.88 ? Math.sin(t * 0.05) * 0.06 : 0);
    const scale = 0.6 + 0.4 * k;
    for (const o of [this.egg, this.eggGlow, ...this.cracks]) o.setPosition(x, bottom).setRotation(rock).setScale(scale);
    this.egg.setAlpha(k * stage);
    this.eggGlow.setAlpha(k * stage * (0.6 + 0.4 * Math.sin(t * 0.004) + c * 0.6));
    // The cracks open with the charge, glowing in the colour the wish holds.
    const at = [0.3, 0.6, 0.85];
    this.cracks.forEach((cr, i) => cr.setAlpha(c >= at[i] ? k * (0.8 + 0.2 * Math.sin(t * 0.02 + i)) : 0).setTint(this.tint));
  }
}

/** A thin gilt rule, `w` wide, fading at its ends, to part the odds panel's sections. */
function ruleBitmap(w: number): Bitmap {
  const b = new Bitmap(w, 2);
  for (let x = 0; x < w; x++) {
    const d = Math.abs(x - w / 2) / (w / 2);
    if (bayer(x, 0) > (1 - d) * 1.6) continue;
    b.set(x, 0, d < 0.5 ? hex('#d69a3a') : hex('#8a4e22'));
    b.set(x, 1, hex('#0b0818'), 160);
  }
  return b;
}

/**
 * An offer's card face: a skin's or a companion's own, or for a bundle a
 * card in its best rarity's frame with what's in it stood together in the
 * window (skins behind, a companion in front), its name on the plate.
 * Returns each figure's face so their glows can follow their frames.
 */
function offerFace(scene: Phaser.Scene, offer: Offer, w: number, h: number, big = false): SkinFace[] {
  if (offer.kind === 'skin') return [skinFace(scene, offer.entry, w, h, 2)];
  if (offer.kind === 'pet') return [petFace(scene, offer.pet, w, h, big ? 3 : PET_SCALE, false)];
  const info = RARITY_INFO[offer.rarity];
  const plate = 22;
  const front = scene.add.image(0, 0, addBitmap(scene, `wish_card_${offer.rarity}_${w}x${h}_${plate}`, cardFront(w, h, info.tint, info.deep, TIER[offer.rarity], plate)));
  const parts: Phaser.GameObjects.GameObject[] = [front];
  const faces: SkinFace[] = [];
  const feet = h / 2 - plate - 3;
  const scale = big ? 2 : 1;
  const skins = offer.skins.slice(0, 3);
  // Skins stand in a row behind, the middle one forward; a companion sits at their feet in front.
  const spread = Math.min(16 * scale, (w - 14) / 2);
  const xs = skins.length === 1 ? [0] : skins.length === 2 ? [-spread * 0.6, spread * 0.6] : [-spread, spread, 0];
  skins.forEach((s, i) => {
    const p = wornSkin(s).preview;
    const oy = p.originY ?? 31 / 32;
    const back = skins.length === 3 && i < 2;
    const sp = scene.add.sprite(Math.round(xs[i]), feet - (back ? 3 * scale : 0), p.texture).setOrigin(0.5, oy).setScale(scale).play(p.idle);
    if (back) sp.setTint(0xb8b0d8);
    cropToWindow(sp, p, Math.min(w - 8, 22 * scale), h - plate - 10, 2, scale);
    let glow: Phaser.GameObjects.Sprite | null = null;
    if (p.glow) {
      glow = scene.add.sprite(sp.x, sp.y, p.glow).setOrigin(0.5, oy).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
      cropToWindow(glow, p, Math.min(w - 8, 22 * scale), h - plate - 10, 2, scale);
    }
    faces.push({ parts: glow ? [sp, glow] : [sp], sprite: sp, glow });
  });
  // Draw the back row first.
  const order = skins.length === 3 ? [0, 1, 2] : skins.map((_s, i) => i);
  for (const i of order) parts.push(...faces[i].parts);
  for (const pet of offer.pets.slice(0, 1)) {
    const sp = scene.add.sprite(0, feet + 1, 'pets', `${pet.id}_0`).setOrigin(0.5, 1).setScale(scale).play(`pet_${pet.id}`);
    const glow = scene.add.sprite(0, feet + 1, 'pets_e', `${pet.id}_0`).setOrigin(0.5, 1).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    parts.push(sp, glow);
    faces.push({ parts: [sp, glow], sprite: sp, glow });
  }
  const probe = pixelText(scene, 0, 0, '').setVisible(false);
  const name = pixelText(scene, 0, 0, fitLine(probe, offer.name, w - 8), info.core);
  name.setPosition(Math.round(-name.width / 2), Math.round(h / 2 - plate + 3));
  probe.destroy();
  parts.push(name);
  const sx = Math.round(-(info.stars * 6) / 2);
  for (let i = 0; i < info.stars; i++) parts.push(scene.add.image(sx + i * 6, h / 2 - 8, 'icon_star').setOrigin(0).setTint(info.tint));
  // The first face carries the frame and plate with it.
  faces[0] = { ...faces[0], parts };
  for (let i = 1; i < faces.length; i++) faces[i] = { ...faces[i], parts: [] };
  return faces;
}
