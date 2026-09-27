import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { collection } from '../game/collection';
import { ALL_SKINS, DUPE_GEMS, PITY, RARITY_INFO, SKIN_RARITIES, WISH10_COST, WISH_COST, ownedSkins, wish, wornSkin, type SkinEntry, type SkinRarity, type WishResult } from '../game/gacha';
import { ALTAR_H, ALTAR_TOP, CRYSTAL_FRAMES, CRYSTAL_H, addBitmap, cardBack, cardFront, registerShopArt, shopHall } from '../art/shop';
import { BUTTON_GEM, BUTTON_GOLD, BUTTON_PLAIN, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { sound } from '../audio';
import { fpsBottom } from './FpsScene';
import { cropToWindow, fitLine } from './SelectScene';
import type { HomeScene } from './HomeScene';

// The shop: the Wish Sanctum. A crystal floats over a rune altar under a
// great arch; gems poured into it make a wish, which turns over skins on
// cards. Every step is staged: the gems pour in, the crystal charges and
// hints at what it holds (blue, then violet, then gold for a legendary),
// bursts in a flash, and the cards are dealt and flipped. A skin already
// owned dissolves into gems that fly back to the counter.

const MARGIN = 8;
const SIDE_W = 96;
/** Cards: small ones for ten wishes, a big one for a single wish. */
const CARD_W = 56;
const CARD_H = 78;
const BIG_W = 100;
const BIG_H = 136;
const CARD_GAP = 6;
/** The name plate along a card's bottom (see art/shop.ts cardFront). */
const PLATE = 22;
/** How long the crystal charges: longer when it holds a legendary. */
const CHARGE_MS = 1700;
const CHARGE_LEGEND_MS = 2400;
/** Between cards turning over, and the pause before a legendary does. */
const FLIP_EVERY = 280;
const LEGEND_PAUSE = 520;
/** The violet the crystal glows before any wish. */
const IDLE_TINT = 0xa070ff;
/** How fast the crystal turns (radians per ms): slowly at rest, whirling at the height of a wish. */
const IDLE_SPIN = 0.0007;
const CHARGED_SPIN = 0.022;
const GEM_CYAN = 0x9ff6ff;
const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;

type Phase = 'idle' | 'charge' | 'reveal' | 'done';

const TIER: Record<SkinRarity, number> = { rare: 0, epic: 1, legendary: 2 };

/** Blend two colours. */
function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(Phaser.Math.Clamp(t, 0, 1) * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/** A card a wish turns over: face down at first, a skin on its face. */
class WishCard extends Phaser.GameObjects.Container {
  readonly result: WishResult;
  readonly w: number;
  readonly h: number;
  flipped = false;
  private back: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite | null = null;
  private badge: Phaser.GameObjects.BitmapText;
  /** Light behind the card once turned: a halo, and god rays for the rarer ones. */
  private halo: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, result: WishResult, big: boolean) {
    super(scene, 0, 0);
    this.result = result;
    const w = (this.w = big ? BIG_W : CARD_W);
    const h = (this.h = big ? BIG_H : CARD_H);
    const info = RARITY_INFO[result.entry.rarity];
    const legendary = result.entry.rarity === 'legendary';
    const frontKey = addBitmap(scene, `wish_card_${result.entry.rarity}_${w}x${h}`, cardFront(w, h, info.tint, info.deep, legendary));
    const backKey = addBitmap(scene, `wish_back_${w}x${h}`, cardBack(w, h));

    // Behind the card, in the scene (not the card), so it can spin and spread past the card's edges.
    this.halo = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(info.tint).setAlpha(0).setDepth(29);
    const nRays = legendary ? 16 : result.entry.rarity === 'epic' ? 10 : 0;
    for (let i = 0; i < nRays; i++) {
      this.rays.push(scene.add.image(0, 0, 'loot_ray').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? info.core : info.tint).setAlpha(0).setDepth(29));
    }

    this.back = scene.add.image(0, 0, backKey);
    const front = scene.add.image(0, 0, frontKey);
    // The hero stands in the window, feet a little above the name plate.
    const scale = big ? 2 : 1;
    const skin = wornSkin(result.entry);
    const p = skin.preview;
    const feet = h / 2 - PLATE - 3;
    const oy = p.originY ?? 31 / 32;
    this.sprite = scene.add.sprite(0, feet, p.texture).setOrigin(0.5, oy).setScale(scale);
    this.sprite.play(p.idle);
    cropToWindow(this.sprite, p, w - 10, h - PLATE - 10, 2, scale);
    const parts: Phaser.GameObjects.GameObject[] = [front, this.sprite];
    if (p.glow) {
      this.glow = scene.add.sprite(0, feet, p.glow).setOrigin(0.5, oy).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
      cropToWindow(this.glow, p, w - 10, h - PLATE - 10, 2, scale);
      parts.push(this.glow);
    }
    const probe = pixelText(scene, 0, 0, '').setVisible(false);
    const name = pixelText(scene, 0, 0, fitLine(probe, result.entry.skin.name, w - 8), info.core);
    name.setPosition(Math.round(-name.width / 2), Math.round(h / 2 - PLATE + 3));
    probe.destroy();
    parts.push(name);
    // The rarity's stars under the name.
    const starW = 6;
    const sx = Math.round(-(info.stars * starW) / 2);
    for (let i = 0; i < info.stars; i++) parts.push(scene.add.image(sx + i * starW, h / 2 - 8, 'icon_star').setOrigin(0).setTint(info.tint));
    if (big) {
      const cls = pixelText(scene, 0, 0, `${result.entry.cls.name} * ${result.entry.type.name}`, LAVENDER);
      cls.setPosition(Math.round(-cls.width / 2), Math.round(-h / 2 + 7));
      if (cls.width <= w - 10) parts.push(cls);
      else cls.destroy();
    }
    this.face = scene.add.container(0, 0, parts).setVisible(false);
    // New or a duplicate, over the top corner.
    this.badge = pixelText(scene, 0, 0, result.fresh ? 'New!' : 'Owned', result.fresh ? GOLD : LAVENDER).setVisible(false);
    this.badge.setPosition(Math.round(w / 2 - this.badge.width - 1), Math.round(-h / 2 - 5));
    this.add([this.back, this.face, this.badge]);
    scene.add.existing(this);
    this.setDepth(30);
  }

  get rarity(): SkinRarity {
    return this.result.entry.rarity;
  }

  /** Turn the card over: it narrows to an edge, shows its face, and widens again with a flash of its colour. */
  flip(onTurned: () => void): void {
    if (this.flipped) return;
    this.flipped = true;
    const s = this.scaleY;
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      duration: 110,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.back.setVisible(false);
        this.face.setVisible(true);
        this.badge.setVisible(true);
        this.scene.tweens.add({ targets: this, scaleX: s, duration: 160, ease: 'Back.easeOut' });
        if (this.result.fresh) this.scene.tweens.add({ targets: this.badge, y: this.badge.y - 3, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        onTurned();
      },
    });
  }

  /** Each frame: the glow follows the hero's frame, the light behind breathes and turns. */
  tick(time: number): void {
    if (this.glow) this.glow.setFrame(this.sprite.frame.name);
    if (!this.flipped || !this.visible) return;
    const k = this.alpha;
    const size = Math.max(this.w, this.h) * this.scaleY;
    this.halo.setPosition(this.x, this.y).setScale((size / 32) * (1.1 + 0.08 * Math.sin(time * 0.004))).setAlpha(0.5 * k * (this.rarity === 'rare' ? 0.6 : 1));
    const n = this.rays.length;
    this.rays.forEach((r, i) => {
      const long = i % 2 ? 0.7 : 1;
      r.setPosition(this.x, this.y)
        .setRotation((i / n) * Math.PI * 2 + time * 0.0004)
        .setScale(1.6 * this.scaleY, (size / 30) * 1.25 * long * (0.9 + 0.1 * Math.sin(time * 0.005 + i)))
        .setAlpha((i % 2 ? 0.45 : 0.3) * k);
    });
  }

  destroy(fromScene?: boolean): void {
    this.halo.destroy();
    for (const r of this.rays) r.destroy();
    super.destroy(fromScene);
  }
}

/**
 * The shop, opened over the home screen: a showcase of legendary skins on
 * one side, the rates and the player's collection on the other, and the
 * Wish Crystal in the middle, wished on once or ten times.
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
  private dim!: Phaser.GameObjects.Rectangle;
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
  /** Spin, lift and brightness of the crystal, and its glow's colour; tweened by the wish. */
  private spin = 0;
  private spinSpeed = IDLE_SPIN;
  private lift = 0;
  private charge = 0;
  private tint = IDLE_TINT;
  private crystalShown = 1;

  // The menus.
  private header!: Phaser.GameObjects.BitmapText;
  private counterBg!: Phaser.GameObjects.Image;
  private counterGem!: Phaser.GameObjects.Image;
  private counterText!: Phaser.GameObjects.BitmapText;
  /** The gems shown on the counter: counting down as they're spent and up as duplicates dissolve. */
  private shownGems = 0;
  private back!: PixelButton;
  private wish1!: PixelButton;
  private wish10!: PixelButton;
  private cost1!: Phaser.GameObjects.Container;
  private cost10!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.BitmapText;
  private warn!: Phaser.GameObjects.BitmapText;
  private rates!: Phaser.GameObjects.Container;
  private ratesText: Record<'pity' | 'owned', Phaser.GameObjects.BitmapText> = {} as never;
  private showcase!: Phaser.GameObjects.Container;
  private showSprite!: Phaser.GameObjects.Sprite;
  private showGlow!: Phaser.GameObjects.Sprite;
  private showName!: Phaser.GameObjects.BitmapText;
  private showClass!: Phaser.GameObjects.BitmapText;
  private showLock!: Phaser.GameObjects.Image;
  private showAt = 0;
  private showT = 0;
  private legendaries: SkinEntry[] = [];
  private sides = true;
  private ui: Phaser.GameObjects.GameObject[] = [];

  // A wish in progress.
  private cards: WishCard[] = [];
  private flipTimer: Phaser.Time.TimerEvent | null = null;
  private continueBtn!: PixelButton;

  constructor() {
    super('shop');
  }

  create(): void {
    this.phase = 'idle';
    this.leaving = false;
    this.elapsed = 0;
    this.cards = [];
    this.rays = [];
    this.orbit = [];
    this.lamps = [];
    this.hallKey = '';
    this.spin = 0;
    this.spinSpeed = IDLE_SPIN;
    this.lift = this.charge = 0;
    this.tint = IDLE_TINT;
    this.crystalShown = 1;
    this.shownGems = collection.gems;
    registerShopArt(this);
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });

    this.buildHall();
    this.buildCrystal();
    this.buildMenus();
    this.dim = this.add.rectangle(0, 0, 1, 1, 0x05030c, 0).setOrigin(0).setDepth(6);
    this.flash = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0).setOrigin(0).setDepth(60);

    // A tap during the reveal turns every card at once; after it, carries on.
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.phase === 'reveal') this.flipAll();
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => (this.phase === 'done' ? this.finish() : this.phase === 'idle' && this.goBack()));
    kb?.on('keydown-ENTER', () => (this.phase === 'reveal' ? this.flipAll() : this.phase === 'done' && this.finish()));

    const unwatch = collection.watch(() => this.refreshInfo());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    this.altar = this.add.image(0, 0, 'shop_altar').setOrigin(0.5, ALTAR_TOP / ALTAR_H).setDepth(4);
    this.runes = this.add.image(0, 0, 'shop_altar_runes').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ff6ff).setDepth(4.5);
  }

  private buildCrystal(): void {
    this.crystalGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(IDLE_TINT).setDepth(9);
    this.crystalFrame = -1;
    this.crystal = this.add.image(0, 0, 'shop_crystal', 0).setDepth(10);
    this.crystalLight = this.add.image(0, 0, 'shop_crystal_w', 0).setBlendMode(Phaser.BlendModes.ADD).setTint(IDLE_TINT).setDepth(10.5);
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
  }

  private buildMenus(): void {
    this.header = pixelText(this, 0, 0, '* Wishing Sanctum *', GOLD).setDepth(40);
    this.counterBg = this.add.image(0, 0, panelTexture(this, 'shop_counter', 62, 17, PANEL)).setOrigin(0).setDepth(40);
    this.counterGem = this.add.image(0, 0, 'gem_m').setOrigin(0).setDepth(41);
    this.counterText = pixelText(this, 0, 0, '', GEM_CYAN).setDepth(41);

    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'shop_back', () => this.goBack()).setDepth(40);
    this.wish1 = new PixelButton(this, 'Wish x1', 72, 20, BUTTON_GEM, 'shop_wish1', () => this.makeWish(1)).setDepth(40);
    this.wish10 = new PixelButton(this, 'Wish x10', 80, 22, BUTTON_GOLD, 'shop_wish10', () => this.makeWish(10)).setDepth(40);
    this.cost1 = this.costTag(WISH_COST);
    this.cost10 = this.costTag(WISH10_COST);
    this.hint = pixelText(this, 0, 0, 'Gems drop from monsters * +5 every day', 0x7c72b0).setDepth(40);
    this.warn = pixelText(this, 0, 0, 'Not enough gems', 0xff8a8a).setDepth(45).setAlpha(0);
    this.continueBtn = new PixelButton(this, 'Continue', 76, 20, BUTTON_GOLD, 'shop_continue', () => this.finish()).setDepth(58).setVisible(false);

    // The rates, the guarantees and the collection.
    const rw = SIDE_W;
    const rh = 126;
    const rbg = this.add.image(0, 0, panelTexture(this, 'shop_rates', rw, rh, PANEL)).setOrigin(0);
    const rows: Phaser.GameObjects.GameObject[] = [rbg, pixelText(this, 7, 6, 'Rates', GOLD)];
    [...SKIN_RARITIES].reverse().forEach((r, i) => {
      const info = RARITY_INFO[r];
      const y = 20 + i * 12;
      for (let s = 0; s < info.stars; s++) rows.push(this.add.image(7 + s * 6, y, 'icon_star').setOrigin(0).setTint(info.tint));
      const pct = pixelText(this, 0, y, `${Math.round(info.odds * 100)}%`, info.tint);
      pct.setX(rw - 7 - pct.width);
      rows.push(pct);
    });
    rows.push(pixelText(this, 7, 60, '10 wishes:', LAVENDER), pixelText(this, 7, 70, 'epic or better', 0xfff4d6));
    rows.push(pixelText(this, 7, 83, 'Legendary in', LAVENDER));
    this.ratesText.pity = pixelText(this, 7, 93, '', GOLD);
    this.ratesText.owned = pixelText(this, 7, 108, '', GEM_CYAN);
    rows.push(this.ratesText.pity, this.ratesText.owned);
    this.rates = this.add.container(0, 0, rows).setDepth(40);

    // The showcase: every legendary skin in turn, in a legendary card.
    this.legendaries = ALL_SKINS.filter((s) => s.rarity === 'legendary');
    const sw = SIDE_W;
    const sh = 126;
    const info = RARITY_INFO.legendary;
    const sbg = this.add.image(0, 0, panelTexture(this, 'shop_show', sw, sh, PANEL)).setOrigin(0);
    const title = pixelText(this, 0, 6, 'Featured', GOLD);
    title.setX(Math.round((sw - title.width) / 2));
    const card = this.add.image(sw / 2, 18 + 44, addBitmap(this, `wish_card_legendary_64x88`, cardFront(64, 88, info.tint, info.deep, true)));
    const halo = this.add.image(sw / 2, 52, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(info.tint).setScale(2.2).setAlpha(0.35);
    this.tweens.add({ targets: halo, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.showSprite = this.add.sprite(sw / 2, 18 + 88 - PLATE - 3, '__DEFAULT');
    this.showGlow = this.add.sprite(sw / 2, 18 + 88 - PLATE - 3, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.showName = pixelText(this, 0, 18 + 88 - PLATE + 3, '', info.core);
    this.showLock = this.add.image(0, 0, 'icon_lock').setOrigin(0);
    this.showClass = pixelText(this, 0, 110, '', LAVENDER);
    const stars: Phaser.GameObjects.Image[] = [];
    for (let s = 0; s < 5; s++) stars.push(this.add.image(sw / 2 - 15 + s * 6, 18 + 88 - 9, 'icon_star').setOrigin(0).setTint(info.tint));
    this.showcase = this.add.container(0, 0, [sbg, title, halo, card, this.showSprite, this.showGlow, this.showName, this.showLock, ...stars, this.showClass]).setDepth(40);
    this.showAt = Math.floor(Math.random() * this.legendaries.length);
    this.showSkin(false);

    this.ui = [this.header, this.back, this.wish1, this.wish10, this.cost1, this.cost10, this.hint, this.rates, this.showcase];
  }

  /** A gem and a price, under a wish button. */
  private costTag(n: number): Phaser.GameObjects.Container {
    const gem = this.add.image(0, 0, 'gem_s').setOrigin(0);
    const text = pixelText(this, gem.width + 2, -1, `${n}`, GEM_CYAN);
    return this.add.container(0, 0, [gem, text]).setDepth(40).setSize(gem.width + 2 + text.width, 9);
  }

  /** Put the next legendary in the showcase. */
  private showSkin(fade: boolean): void {
    const e = this.legendaries[this.showAt % this.legendaries.length];
    if (!e) return;
    const p = wornSkin(e).preview;
    const oy = p.originY ?? 31 / 32;
    const owned = collection.hasSkin(e.id);
    const room = 88 - PLATE - 8;
    this.showSprite.setTexture(p.texture).setOrigin(0.5, oy).play(p.idle);
    cropToWindow(this.showSprite, p, 58, room, 2, 1);
    this.showGlow.setVisible(!!p.glow);
    if (p.glow) {
      this.showGlow.setTexture(p.glow).setOrigin(0.5, oy);
      cropToWindow(this.showGlow, p, 58, room, 2, 1);
    }
    const probe = pixelText(this, 0, 0, '').setVisible(false);
    this.showName.setText(fitLine(probe, e.skin.name, 56));
    this.showClass.setText(fitLine(probe, e.cls.name, SIDE_W - 12));
    probe.destroy();
    const lockW = owned ? 0 : this.showLock.width + 2;
    this.showName.setX(Math.round((SIDE_W - this.showName.width + lockW) / 2));
    this.showLock.setVisible(!owned).setPosition(this.showName.x - lockW, this.showName.y);
    this.showClass.setX(Math.round((SIDE_W - this.showClass.width) / 2));
    if (fade) {
      for (const o of [this.showSprite, this.showGlow]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: 300 });
      }
    }
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
    this.floorY = Math.round(vh * 0.68);
    const key = `shop_hall_${W}x${H}`;
    if (key !== this.hallKey) {
      if (this.hallKey && this.textures.exists(this.hallKey)) this.textures.remove(this.hallKey);
      this.hallKey = addBitmap(this, key, shopHall(W, H, this.floorY));
      this.hall.setTexture(key);
    }
    this.dim.setSize(W + 1, H + 1);
    this.flash.setSize(W + 1, H + 1);
    for (const zone of [...this.motes.emitZones]) this.motes.removeEmitZone(zone);
    this.motes.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, H * 0.2, W, H * 0.8) } as Phaser.Types.GameObjects.Particles.EmitZoneData);

    const cx = Math.round(vw / 2);
    this.altar.setPosition(cx, this.floorY);
    this.runes.setPosition(cx, this.floorY);
    this.crystalX = cx;
    this.crystalY = this.floorY - Math.round(CRYSTAL_H / 2) - 14;
    this.shaft.setPosition(cx, this.floorY + 2).setScale(5, (this.floorY + 4) / 120);
    const archHalf = Math.min(vw * 0.62, 300) / 2;
    this.lamps.forEach((l, i) => l.setPosition(cx + (i ? archHalf - 4 : -archHalf + 4), this.floorY - 24).setScale(1.6));

    const top = Math.ceil(fpsBottom() / z) + 4;
    this.header.setPosition(Math.round((vw - this.header.width) / 2), top);
    this.counterBg.setPosition(Math.round(vw - MARGIN - 62 - 30), top - 4);
    this.placeCounter();

    // Wish buttons side by side under the altar, their prices under them.
    const by = Math.round(vh - 44);
    const gap = 10;
    const total = this.wish1.boxW + gap + this.wish10.boxW;
    const bx = Math.round((vw - total) / 2);
    this.wish1.place(bx, by + 1);
    this.wish10.place(bx + this.wish1.boxW + gap, by);
    this.cost1.setPosition(Math.round(this.wish1.x + (this.wish1.boxW - this.cost1.width) / 2), by + 24);
    this.cost10.setPosition(Math.round(this.wish10.x + (this.wish10.boxW - this.cost10.width) / 2), by + 25);
    this.back.place(MARGIN, vh - 26);
    this.hint.setPosition(Math.round((vw - this.hint.width) / 2), Math.round(vh - 11));
    if (this.hint.x < MARGIN + this.back.boxW + 4) this.hint.setVisible(false);
    this.warn.setPosition(Math.round((vw - this.warn.width) / 2), by - 13);
    this.continueBtn.place((vw - this.continueBtn.boxW) / 2, vh - 26);

    // Side panels when there's room either side of the arch.
    this.sides = vw >= SIDE_W * 2 + MARGIN * 2 + 180;
    const panelY = Math.round(Math.max(top + 14, (this.floorY - 126) / 2 + 12));
    this.rates.setPosition(MARGIN, panelY).setVisible(this.sides && this.phase === 'idle');
    this.showcase.setPosition(Math.round(vw - MARGIN - SIDE_W), panelY).setVisible(this.sides && this.phase === 'idle');
  }

  private placeCounter(): void {
    const bg = this.counterBg;
    this.counterText.setText(`${Math.max(0, Math.round(this.shownGems))}`);
    const w = this.counterGem.width + 3 + this.counterText.width;
    const x = Math.round(bg.x + (62 - w) / 2);
    this.counterGem.setPosition(x, bg.y + Math.round((17 - this.counterGem.height) / 2));
    this.counterText.setPosition(x + this.counterGem.width + 3, bg.y + 4);
  }

  /** Where gems fly to and from on the counter. */
  private get counterAt(): { x: number; y: number } {
    return { x: this.counterGem.x + this.counterGem.width / 2, y: this.counterGem.y + this.counterGem.height / 2 };
  }

  private refreshInfo(): void {
    if (this.phase === 'idle') this.shownGems = collection.gems;
    this.placeCounter();
    const left = PITY - collection.pity;
    this.ratesText.pity.setText(`${left} ${left === 1 ? 'wish' : 'wishes'}`);
    const o = ownedSkins();
    this.ratesText.owned.setText(`Skins ${o.owned}/${o.of}`);
    const can1 = collection.gems >= WISH_COST;
    const can10 = collection.gems >= WISH10_COST;
    this.cost1.setAlpha(can1 ? 1 : 0.5);
    this.cost10.setAlpha(can10 ? 1 : 0.5);
  }

  // ---- The wish ----

  private makeWish(count: 1 | 10): void {
    if (this.phase !== 'idle' || this.leaving) return;
    const cost = count === 10 ? WISH10_COST : WISH_COST;
    const before = collection.gems;
    const results = wish(count);
    if (!results) return this.notEnough(count === 10 ? this.cost10 : this.cost1);
    this.phase = 'charge';
    const best = Math.max(...results.map((r) => TIER[r.entry.rarity]));
    this.shownGems = before;
    this.placeCounter();

    // The menus step back and the hall darkens around the crystal.
    for (const o of this.ui) this.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false) });
    this.wish1.setEnabled(false);
    this.wish10.setEnabled(false);
    this.back.setEnabled(false);

    // The gems pour from the counter into the crystal, the counter running down.
    this.tweens.addCounter({ from: before, to: before - cost, duration: 600, ease: 'Sine.easeOut', onUpdate: (tw) => ((this.shownGems = tw.getValue() ?? 0), this.placeCounter()) });
    this.pourGems(count === 10 ? 12 : 5);
    sound.gemSpend();

    const dur = best === 2 ? CHARGE_LEGEND_MS : CHARGE_MS;
    this.time.delayedCall(520, () => this.chargeCrystal(dur, best, results));
  }

  /** Gems fly from the counter in an arc and vanish into the crystal. */
  private pourGems(n: number): void {
    const from = this.counterAt;
    for (let i = 0; i < n; i++) {
      const g = this.add.image(from.x, from.y, 'gem_s').setDepth(45);
      const mid = { x: (from.x + this.crystalX) / 2 + Phaser.Math.Between(-30, 30), y: Math.min(from.y, this.crystalY) - Phaser.Math.Between(10, 40) };
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x, from.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(this.crystalX, this.crystalY));
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
          this.shards.explode(3, this.crystalX, this.crystalY);
          this.charge = Math.min(1, this.charge + 0.04);
        },
      });
    }
  }

  /**
   * The crystal gathers light, rising and spinning faster, its glow turning
   * blue; violet partway if it holds an epic, gold near the end if a
   * legendary (the hall going dark for it). Then it bursts.
   */
  private chargeCrystal(dur: number, best: number, results: WishResult[]): void {
    sound.wishCharge(dur / 1000, best);
    this.gather.start();
    this.tweens.add({ targets: this, lift: 12, duration: dur, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this, spinSpeed: CHARGED_SPIN, charge: 1, duration: dur, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: best === 2 ? 0.7 : 0.45, duration: dur });
    const colors = [RARITY_INFO.rare.tint, RARITY_INFO.epic.tint, RARITY_INFO.legendary.tint];
    this.shiftTint(colors[0], 300);
    if (best >= 1) this.time.delayedCall(dur * 0.45, () => this.hintRarity(colors[1], 1));
    if (best >= 2) this.time.delayedCall(dur * 0.75, () => this.hintRarity(colors[2], 2));
    this.time.delayedCall(dur, () => this.burst(best, results));
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
    this.cameras.main.shake(tier === 2 ? 320 : 180, tier === 2 ? 0.006 : 0.003);
    this.gather.setParticleTint(color);
    this.flash.setFillStyle(color).setAlpha(tier === 2 ? 0.35 : 0.2);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
  }

  /** A ring of light racing out from the crystal. */
  private ring(color: number, scale: number, delay: number): void {
    const r = this.add.image(this.crystalX, this.crystalY + 6, 'loot_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(54).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: r, scale, alpha: { from: 1, to: 0 }, delay, duration: 700, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  /** The crystal bursts: a white flash, shards and rings in the best rarity's colour, and the cards come out. */
  private burst(best: number, results: WishResult[]): void {
    const color = [RARITY_INFO.rare.tint, RARITY_INFO.epic.tint, RARITY_INFO.legendary.tint][best];
    this.gather.stop();
    sound.wishBurst(best);
    this.flash.setFillStyle(0xffffff).setAlpha(1);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 700, ease: 'Quad.easeIn' });
    this.cameras.main.shake(best === 2 ? 500 : 280, best === 2 ? 0.01 : 0.005);
    this.shards.setParticleTint(color);
    this.shards.explode(best === 2 ? 90 : 55, this.crystalX, this.crystalY);
    this.shards.setParticleTint(0xffffff);
    this.shards.explode(30, this.crystalX, this.crystalY);
    for (let i = 0; i <= best + 1; i++) this.ring(i % 2 ? 0xffffff : color, 2.5 + i, i * 110);
    // The crystal is spent; it forms again when the player carries on.
    this.crystalShown = 0;
    this.phase = 'reveal';
    this.deal(results);
  }

  /** Lay the cards out, face down, flying out of where the crystal was, then turn them one by one. */
  private deal(results: WishResult[]): void {
    const big = results.length === 1;
    this.cards = results.map((r) => new WishCard(this, r, big));
    const vw = this.vw;
    const top = Math.ceil(fpsBottom() / this.cameras.main.zoom) + 20;
    const bottom = this.vh - 32;
    let spots: { x: number; y: number }[];
    let scale = 1;
    if (big) spots = [{ x: Math.round(vw / 2), y: Math.round((top + bottom) / 2) }];
    else {
      // As many columns as fit: five across on a wide screen.
      const cols = [5, 4, 3, 2].find((c) => c * CARD_W + (c - 1) * CARD_GAP <= vw - MARGIN * 2) ?? 2;
      const rows = Math.ceil(results.length / cols);
      const needH = rows * CARD_H + (rows - 1) * CARD_GAP;
      scale = Math.min(1, (bottom - top) / needH);
      const cw = (CARD_W + CARD_GAP) * scale;
      const ch = (CARD_H + CARD_GAP) * scale;
      const y0 = (top + bottom) / 2 - ((rows - 1) * ch) / 2;
      spots = results.map((_r, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, results.length - row * cols);
        const x0 = vw / 2 - ((inRow - 1) * cw) / 2;
        return { x: Math.round(x0 + (i % cols) * cw), y: Math.round(y0 + row * ch) };
      });
    }
    this.cards.forEach((c, i) => {
      c.setPosition(this.crystalX, this.crystalY).setScale(0.15 * scale).setAlpha(0).setAngle(Phaser.Math.Between(-40, 40));
      this.tweens.add({
        targets: c,
        x: spots[i].x,
        y: spots[i].y,
        scale,
        alpha: 1,
        angle: 0,
        delay: 200 + i * 70,
        duration: 420,
        ease: 'Back.easeOut',
        onStart: () => sound.cardFlip(0),
      });
    });
    const dealt = 200 + results.length * 70 + 450;
    this.time.delayedCall(dealt, () => this.flipNext(0));
  }

  /** Turn card `i`, then the next after a moment (a longer, darker moment before a legendary). */
  private flipNext(i: number): void {
    if (this.phase !== 'reveal') return;
    const card = this.cards[i];
    if (!card) return this.revealed();
    if (card.flipped) return this.flipNext(i + 1);
    const legend = card.rarity === 'legendary';
    const turn = () => {
      this.turnCard(card);
      this.flipTimer = this.time.delayedCall(legend ? FLIP_EVERY * 2 : FLIP_EVERY, () => this.flipNext(i + 1));
    };
    if (legend && this.cards.length > 1) {
      // The card trembles and glows gold before it turns.
      this.tweens.add({ targets: card, angle: { from: -3, to: 3 }, duration: 50, yoyo: true, repeat: 4, onComplete: () => card.setAngle(0) });
      this.flipTimer = this.time.delayedCall(LEGEND_PAUSE, turn);
    } else turn();
  }

  /** Turn one card, with the flourish its rarity earns. */
  private turnCard(card: WishCard): void {
    card.flip(() => {
      const r = card.rarity;
      const info = RARITY_INFO[r];
      sound.cardFlip(TIER[r]);
      this.shards.setParticleTint(info.tint);
      this.shards.explode(r === 'legendary' ? 40 : r === 'epic' ? 22 : 10, card.x, card.y);
      if (r !== 'rare') {
        this.ring(info.tint, r === 'legendary' ? 3 : 2, 0);
        this.cameras.main.shake(r === 'legendary' ? 260 : 120, r === 'legendary' ? 0.006 : 0.002);
      }
      if (r === 'legendary') {
        this.flash.setFillStyle(info.tint).setAlpha(0.45);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
      }
      // A big card lands with a bounce.
      if (this.cards.length === 1) this.tweens.add({ targets: card, scaleY: { from: card.scaleY * 1.08, to: card.scaleY }, duration: 260, ease: 'Back.easeOut' });
    });
  }

  /** A tap: every card still face down turns at once. */
  private flipAll(): void {
    if (this.phase !== 'reveal' || !this.cards.length || this.cards.every((c) => c.flipped)) return;
    this.flipTimer?.remove();
    this.cards.forEach((c, i) => {
      if (c.flipped) return;
      this.time.delayedCall(i * 40, () => this.turnCard(c));
    });
    this.flipTimer = this.time.delayedCall(this.cards.length * 40 + 300, () => this.revealed());
  }

  /** Every card is face up: duplicates dissolve into gems, then the player can carry on. */
  private revealed(): void {
    if (this.phase !== 'reveal') return;
    this.phase = 'done';
    const dupes = this.cards.filter((c) => !c.result.fresh);
    dupes.forEach((c, i) => this.time.delayedCall(700 + i * 260, () => this.evaporate(c)));
    const after = 700 + dupes.length * 260 + (dupes.length ? 900 : 0);
    this.time.delayedCall(after, () => {
      if (this.phase !== 'done') return;
      this.continueBtn.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.continueBtn, alpha: 1, duration: 250 });
    });
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

  /** Put the cards away and form the crystal again. */
  private finish(): void {
    if (this.phase !== 'done') return;
    this.phase = 'idle';
    this.continueBtn.setVisible(false);
    for (const c of this.cards) this.tweens.add({ targets: c, alpha: 0, y: c.y + 6, duration: 220, onComplete: () => c.destroy() });
    this.cards = [];
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 400 });
    this.lift = 0;
    this.spinSpeed = IDLE_SPIN;
    this.charge = 0;
    this.shiftTint(IDLE_TINT, 500);
    // The crystal forms again from light.
    this.tweens.add({ targets: this, crystalShown: 1, duration: 600, ease: 'Sine.easeOut' });
    this.shards.setParticleTint(0x9ff6ff);
    this.shards.explode(20, this.crystalX, this.crystalY);
    this.shownGems = collection.gems;
    this.refreshInfo();
    for (const o of this.ui) {
      const v = o as unknown as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.AlphaSingle;
      if ((o === this.rates || o === this.showcase) && !this.sides) continue;
      if (o === this.hint && this.hint.x < MARGIN + this.back.boxW + 4) continue;
      v.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 300 });
    }
    this.wish1.setEnabled(true);
    this.wish10.setEnabled(true);
    this.back.setEnabled(true);
    this.showSkin(false);
  }

  /** Not enough gems: the price shakes and a word says so. */
  private notEnough(tag: Phaser.GameObjects.Container): void {
    const x = tag.x;
    this.tweens.add({ targets: tag, x: { from: x - 2, to: x + 2 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => tag.setX(x) });
    this.tweens.killTweensOf(this.warn);
    this.warn.setAlpha(1);
    this.tweens.add({ targets: this.warn, alpha: 0, delay: 1100, duration: 400 });
  }

  private goBack(): void {
    if (this.leaving || this.phase !== 'idle') return;
    this.leaving = true;
    collection.flush();
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  // ---- Every frame ----

  update(time: number, dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed;
    const cx = this.crystalX;
    const cy = this.crystalY - this.lift + Math.round(Math.sin(t * 0.0018) * 2);

    // The crystal turns (seen as its width breathing), its light brightening with the charge.
    // The crystal turns through its rendered frames; a facet flashes as it swings into the light.
    this.spin += this.spinSpeed * dt;
    const f = Math.floor((this.spin / (Math.PI / 3)) * CRYSTAL_FRAMES) % CRYSTAL_FRAMES;
    if (f !== this.crystalFrame) {
      this.crystalFrame = f;
      this.crystal.setFrame(f);
      this.crystalLight.setFrame(f);
    }
    const turn = Math.cos(this.spin * 6);
    const shown = this.crystalShown;
    this.crystal.setPosition(cx, cy).setScale(shown).setAlpha(shown);
    this.crystalLight
      .setPosition(cx, cy)
      .setScale(shown)
      .setTint(this.tint)
      .setAlpha((0.25 + 0.2 * (1 - Math.abs(turn)) + 0.6 * this.charge) * shown);
    this.crystalGlow
      .setPosition(cx, cy + 2)
      .setTint(this.tint)
      .setScale(2.6 + 2.4 * this.charge + 0.15 * Math.sin(t * 0.003))
      .setAlpha((0.45 + 0.4 * this.charge) * Math.max(0.35, shown));
    this.gather.setPosition(cx, cy);

    // Stars circling it, passing behind and in front.
    this.orbit.forEach((o, i) => {
      const a = t * (0.0012 + this.spinSpeed * 0.3) + (i / this.orbit.length) * Math.PI * 2;
      const front = Math.sin(a) > 0;
      o.setPosition(Math.round(cx + Math.cos(a) * 24), Math.round(cy + 6 + Math.sin(a) * 7))
        .setDepth(front ? 10.8 : 9.5)
        .setAlpha((0.4 + 0.6 * Math.max(0, Math.sin(t * 0.006 + i * 1.3))) * Math.max(0.3, shown))
        .setTint(i % 2 ? 0xffffff : this.tint);
    });

    // The hall's light: the shaft breathing, the god rays turning, the runes and lamps pulsing.
    const breathe = Math.sin(t * 0.0014);
    this.shaft.setAlpha(0.18 + 0.05 * breathe + 0.25 * this.charge).setTint(this.tint);
    const n = this.rays.length;
    this.rays.forEach((r, i) => {
      const long = i % 2 ? 0.6 : 1;
      r.setPosition(cx, cy)
        .setRotation((i / n) * Math.PI * 2 + t * (0.00012 + this.spinSpeed * 0.05))
        .setScale(1.8, (2.4 + 2 * this.charge) * long * (0.9 + 0.1 * Math.sin(t * 0.002 + i)))
        .setAlpha((0.08 + 0.1 * this.charge) * (i % 2 ? 1 : 0.7))
        .setTint(i % 2 ? 0x5ae8ff : this.tint);
    });
    this.runes.setAlpha(0.45 + 0.3 * Math.sin(t * 0.003) + 0.25 * this.charge).setTint(this.tint);
    this.lamps.forEach((l, i) => l.setAlpha(0.3 + 0.06 * Math.sin(t * 0.011 + i * 3) + 0.04 * Math.sin(t * 0.027 + i)));

    // The showcase moves on every few seconds.
    if (this.phase === 'idle' && this.sides) {
      this.showT += dt;
      if (this.showT > 3200) {
        this.showT = 0;
        this.showAt++;
        this.showSkin(true);
      }
      if (this.showGlow.visible) this.showGlow.setFrame(this.showSprite.frame.name);
    }
    for (const c of this.cards) if (c.active) c.tick(time);
  }
}
