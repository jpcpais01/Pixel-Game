import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { LOGO_FRAMES, mythsLogo, sparkleBitmap } from '../art/logo';
import { type Backdrop, makeBackdrop } from './homeBackdrops';
import { BUTTON_GEM, BUTTON_GOLD, BUTTON_PLAIN, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { collection } from '../game/collection';
import { warmArenasInBackground } from '../world/arenas';
import { sound } from '../audio';
import { account, cloudReady, logOut, onAccount } from '../game/cloud';
import { openAccountForm } from '../ui/accountForm';
import { fpsBottom } from './FpsScene';
import { activeSeason, daysLeft } from '../game/season';
import { lastHero } from '../game/skins';

/** How often the glint sweeps the title, and how long each of its frames shows. */
const SHIMMER_EVERY = 5200;
const SHIMMER_FRAME = 45;
/**
 * ms a frame spent loading the last arena played while the player is on the
 * menus (the home screen keeps running under the hero, arena, shop and
 * inventory pages), so a run there starts at once. A worker draws it; this
 * is only turning its pixels into textures.
 */
const WARM_MS = 4;
/** How long the daily gift's banner stays up. */
const GIFT_TIME = 3600;

/**
 * The home screen: a painted backdrop (the Sky Arena, now and then the Hall
 * of Legends), the title and a Start Game button. The backdrop stays behind
 * the character select, which opens over it.
 */
export class HomeScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private elapsed = 0;
  private backdrop!: Backdrop;
  private menu!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Image;
  private titleGlow!: Phaser.GameObjects.Image;
  private sparkles: Phaser.GameObjects.Image[] = [];
  private sparkleSpots: { x: number; y: number }[] = [];
  private titleScale = 1;
  private titleFrame = 0;
  private start!: PixelButton;
  private inventory!: PixelButton;
  /** The player's own place to build (see world/Home.ts). */
  private homeBtn!: PixelButton;
  private shop!: PixelButton;
  /** The player's gems, beside the Shop button. */
  private gemIcon!: Phaser.GameObjects.Image;
  private gemText!: Phaser.GameObjects.BitmapText;
  /** While a season runs: its candy beside the Inventory button, and its name and days left beside Start. */
  private candyIcon: Phaser.GameObjects.Image | null = null;
  private candyText: Phaser.GameObjects.BitmapText | null = null;
  private seasonText: Phaser.GameObjects.BitmapText[] = [];
  /** The daily gift's banner, while it shows. */
  private gift: Phaser.GameObjects.Container | null = null;
  private accountBtn!: PixelButton;
  private who!: Phaser.GameObjects.BitmapText;
  private arrows: Phaser.GameObjects.BitmapText[] = [];
  private titleY = 0;
  private menuOpen = true;
  private arenasWarm = false;

  constructor() {
    super('home');
  }

  create(): void {
    // The scene object is reused when the game returns here from the pause menu.
    this.menuOpen = true;
    this.titleFrame = 0;
    this.buildTextures();
    this.sparkleSpots = this.registry.get('logoSparkles');
    this.cameras.main.setOrigin(0, 0);

    this.backdrop = makeBackdrop(this);

    this.menu = this.add.container(0, 0);
    this.titleGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050);
    this.title = this.add.image(0, 0, 'home_title', 0).setOrigin(0);
    this.sparkles = this.sparkleSpots.map(() => this.add.image(0, 0, 'home_sparkle').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    this.start = new PixelButton(this, 'Start Game', 84, 22, BUTTON_GOLD, 'start', () => this.openSelect());
    this.homeBtn = new PixelButton(this, 'Home', 84, 18, BUTTON_PLAIN, 'myhome', () => this.openHome());
    this.inventory = new PixelButton(this, 'Inventory', 84, 18, BUTTON_PLAIN, 'inventory', () => this.openInventory());
    this.shop = new PixelButton(this, 'Shop', 84, 18, BUTTON_GEM, 'shop', () => this.openShop()).setIcon('gem_s');
    this.gemIcon = this.add.image(0, 0, 'gem_s').setOrigin(0);
    this.gemText = pixelText(this, 0, 0, '', 0x9ff6ff);
    this.accountBtn = new PixelButton(this, 'Log in', 84, 18, BUTTON_PLAIN, 'account', () => this.tapAccount());
    this.accountBtn.setVisible(cloudReady());
    this.who = pixelText(this, 0, 0, '', 0x9a90c8);
    this.arrows = [pixelText(this, 0, 0, '>', 0xf4cf6a), pixelText(this, 0, 0, '<', 0xf4cf6a)];
    this.menu.add([this.titleGlow, this.title, ...this.sparkles, this.start, this.homeBtn, this.inventory, this.shop, this.gemIcon, this.gemText, this.accountBtn, this.who, ...this.arrows]);
    const season = activeSeason();
    this.candyIcon = this.candyText = null;
    this.seasonText = [];
    if (season) {
      const days = daysLeft(season);
      this.candyIcon = this.add.image(0, 0, 'candy_s').setOrigin(0);
      this.candyText = pixelText(this, 0, 0, '', season.currency.tint);
      this.seasonText = [pixelText(this, 0, 0, season.name.toUpperCase(), season.currency.tint), pixelText(this, 0, 0, days === 1 ? 'LAST DAY' : `${days} DAYS LEFT`, 0xb08ae0)];
      this.menu.add([this.candyIcon, this.candyText, ...this.seasonText]);
    }
    this.showAccount();
    const unAccount = onAccount(() => this.showAccount());
    // The gem count keeps up with the save, and the daily gift waits for a cloud save to finish loading.
    const unGems = collection.watch(() => {
      this.showGems();
      this.giveDaily();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unAccount();
      unGems();
      this.gift = null;
    });
    this.showGems();

    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', () => this.openSelect());
    kb?.on('keydown-SPACE', () => this.openSelect());

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    // The loading screen fades away once the home screen has drawn under it.
    this.time.delayedCall(80, () => window.bootLoader?.done());
    this.time.delayedCall(600, () => this.giveDaily());
  }

  private showGems(): void {
    this.gemText.setText(`${collection.gems}`);
    const season = activeSeason();
    if (season) this.candyText?.setText(`${collection.candy(season.id)}`);
    if (this.vw) this.layout();
  }

  /**
   * Once a day the player is given gems: a banner drops in from the top with
   * the gem glittering, a burst of shards and a chime, then rises away.
   */
  private giveDaily(): void {
    if (this.gift) return;
    const n = collection.claimDaily();
    if (!n) return;
    const w = 112;
    const h = 30;
    const bg = this.add.image(0, 0, panelTexture(this, 'home_gift', w, h, PANEL_PICKED)).setOrigin(0);
    const glow = this.add.image(18, h / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5ae8ff).setScale(1.3);
    const gem = this.add.image(18, h / 2, 'gem_l');
    const title = pixelText(this, 34, 5, 'Daily gift', 0xf4cf6a);
    const amount = pixelText(this, 34, 16, `+${n} gems`, 0x9ff6ff);
    const shards = this.add.particles(18, h / 2, 'spark', {
      speed: { min: 20, max: 60 },
      lifespan: { min: 400, max: 900 },
      scale: { start: 1, end: 0 },
      tint: [0xffffff, 0x9ff6ff, 0x5ae8ff, 0xff7ae6],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    const box = this.add.container(0, 0, [bg, glow, shards, gem, title, amount]).setDepth(50);
    this.gift = box;
    const x = Math.round((this.vw - w) / 2);
    box.setPosition(x, -h - 4);
    this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 0.95 }, scale: { from: 1.1, to: 1.6 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: gem, y: h / 2 - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.chain({
      targets: box,
      tweens: [
        {
          y: Math.round(this.vh * 0.04) + 4,
          duration: 420,
          ease: 'Back.easeOut',
          onComplete: () => {
            shards.explode(24);
            sound.gemPickup(n);
          },
        },
        { y: Math.round(this.vh * 0.04) + 4, duration: GIFT_TIME },
        { y: -h - 4, alpha: 0, duration: 380, ease: 'Sine.easeIn' },
      ],
      onComplete: () => {
        box.destroy();
        if (this.gift === box) this.gift = null;
      },
    });
  }

  /** Show or hide the title and button (hidden while the character select is open). */
  showMenu(open: boolean): void {
    this.menuOpen = open;
    this.start.setEnabled(open);
    this.homeBtn.setEnabled(open);
    this.inventory.setEnabled(open);
    this.shop.setEnabled(open);
    this.accountBtn.setEnabled(open);
    this.tweens.killTweensOf(this.menu);
    if (open) this.menu.setVisible(true);
    this.tweens.add({
      targets: this.menu,
      alpha: open ? 1 : 0,
      duration: 220,
      onComplete: () => this.menu.setVisible(open),
    });
  }

  private openSelect(): void {
    if (!this.menuOpen) return;
    this.showMenu(false);
    this.scene.launch('select');
  }

  /** Straight to the player's Home with the hero they played last: no hero or arena select on the way. */
  private openHome(): void {
    if (!this.menuOpen) return;
    this.showMenu(false);
    const character = lastHero() ?? undefined;
    this.cameras.main.fadeOut(450, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('home');
      this.scene.launch('shade');
      this.scene.launch('ui', { character });
      this.scene.launch('pause');
      this.scene.start('world', { character, arena: 'home' });
    });
  }

  private openShop(): void {
    if (!this.menuOpen) return;
    this.showMenu(false);
    this.scene.launch('shop');
  }

  private openInventory(): void {
    if (!this.menuOpen) return;
    this.showMenu(false);
    this.scene.launch('inventory');
  }

  /** Log in through the account form, or log out. */
  private tapAccount(): void {
    if (!this.menuOpen) return;
    if (account()) return logOut();
    this.menuOpen = false;
    openAccountForm(() => (this.menuOpen = true));
  }

  private showAccount(): void {
    const a = account();
    this.accountBtn.setText(a ? 'Log out' : 'Log in');
    this.who.setText(a ? `Playing as ${a.username}`.toUpperCase() : '');
    if (this.vw) this.layout();
  }

  private buildTextures(): void {
    if (this.textures.exists('home_title')) return;
    const logo = mythsLogo();
    const title = this.textures.addCanvas('home_title', logo.sheet.toCanvas())!;
    for (let i = 0; i < LOGO_FRAMES; i++) title.add(i, 0, 0, i * logo.frameH, logo.frameW, logo.frameH);
    this.registry.set('logoSparkles', logo.sparkles);
    this.textures.addCanvas('home_sparkle', sparkleBitmap().toCanvas());
    const dot = this.textures.createCanvas('home_dot', 1, 1)!;
    dot.context.fillStyle = '#fff';
    dot.context.fillRect(0, 0, 1, 1);
    dot.refresh();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    // View size in art px. Both multiply back to whole device pixels, so
    // anything placed relative to the bottom edge stays on the pixel grid.
    this.vw = width / this.z;
    this.vh = height / this.z;
    const vw = this.vw;
    const vh = this.vh;

    this.backdrop.layout(vw, vh, this.z);

    // The buttons and the account line under them, top to bottom.
    const stack = this.start.boxH + 6 + this.homeBtn.boxH + 5 + this.inventory.boxH + 5 + this.shop.boxH + 5 + this.accountBtn.boxH + (this.who.text ? 4 + this.who.height : 0);
    const bottom = vh - 6;
    // Title: 2x when it fits across with a margin and the buttons still fit under it; kept clear of the FPS counter.
    const top = Math.ceil(fpsBottom() / this.z) + 6;
    this.titleY = Math.max(top, Math.round(vh * 0.1));
    const fits = (ts: number) => vw >= this.title.width * ts + 16 && this.titleY + this.title.height * ts + 14 + stack <= bottom;
    const ts = fits(2) ? 2 : 1;
    this.titleScale = ts;
    this.title.setScale(ts);
    this.titleGlow.setScale((this.title.width * ts * 1.15) / 32, (this.title.height * ts * 1.3) / 32);
    // Still too tall at 1x (a very short window): the title rises to the top.
    if (this.titleY + this.title.displayHeight + 14 + stack > bottom) this.titleY = Math.max(4, Math.min(this.titleY, bottom - stack - 14 - this.title.displayHeight));
    this.title.setPosition(Math.round((vw - this.title.displayWidth) / 2), this.titleY);
    // Buttons from about halfway down, but never so low the account line leaves the screen.
    const by = Math.max(this.titleY + this.title.displayHeight + 10, Math.min(Math.round(vh * 0.52), bottom - stack));
    this.start.place((vw - this.start.boxW) / 2, by);
    this.homeBtn.place((vw - this.homeBtn.boxW) / 2, by + this.start.boxH + 6);
    this.inventory.place((vw - this.inventory.boxW) / 2, this.homeBtn.y + this.homeBtn.boxH + 5);
    this.shop.place((vw - this.shop.boxW) / 2, this.inventory.y + this.inventory.boxH + 5);
    this.gemIcon.setPosition(this.shop.x + this.shop.boxW + 6, this.shop.y + Math.round((this.shop.boxH - this.gemIcon.height) / 2));
    this.gemText.setPosition(this.gemIcon.x + this.gemIcon.width + 2, this.shop.y + Math.round((this.shop.boxH - this.gemText.height) / 2));
    if (this.candyIcon && this.candyText) {
      const inv = this.inventory;
      this.candyIcon.setPosition(inv.x + inv.boxW + 6, inv.y + Math.round((inv.boxH - this.candyIcon.height) / 2));
      this.candyText.setPosition(this.candyIcon.x + this.candyIcon.width + 2, inv.y + Math.round((inv.boxH - this.candyText.height) / 2));
    }
    // The season's name, right-aligned left of Start; hidden on a window too narrow for it.
    const room = this.start.x - 6;
    this.seasonText.forEach((t, i) => {
      t.setVisible(t.width <= room - 2);
      t.setPosition(Math.round(room - t.width), this.start.y + 2 + i * (t.height + 2));
    });
    this.accountBtn.place((vw - this.accountBtn.boxW) / 2, this.shop.y + this.shop.boxH + 5);
    this.who.setPosition(Math.round((vw - this.who.width) / 2), this.accountBtn.y + this.accountBtn.boxH + 4);
  }

  update(time: number, dt: number): void {
    this.elapsed += dt;
    if (!this.arenasWarm) this.arenasWarm = warmArenasInBackground(this, WARM_MS);
    const t = this.elapsed / 1000;
    this.backdrop.update(time, t);

    if (this.menu.visible) {
      const ty = this.titleY + Math.round(Math.sin(time * 0.0016) * 1.5);
      const tx = this.title.x;
      const ts = this.titleScale;
      this.title.y = ty;
      this.titleGlow.setPosition(tx + this.title.displayWidth / 2, ty + this.title.displayHeight * 0.45);
      this.titleGlow.setAlpha(0.2 + 0.07 * Math.sin(time * 0.0013));
      const p = time % SHIMMER_EVERY;
      const f = p < (LOGO_FRAMES - 1) * SHIMMER_FRAME ? 1 + Math.floor(p / SHIMMER_FRAME) : 0;
      if (f !== this.titleFrame) {
        this.titleFrame = f;
        this.title.setFrame(f);
      }
      // Each twinkle flares briefly on its own beat.
      this.sparkles.forEach((s, i) => {
        const spot = this.sparkleSpots[i];
        const k = Math.max(0, Math.sin(time * 0.0021 + i * 2.3) * 2 - 1);
        s.setPosition(tx + (spot.x + 0.5) * ts, ty + (spot.y + 0.5) * ts).setAlpha(k).setScale(0.5 + 0.5 * k);
      });
      const nudge = Math.round((Math.sin(time * 0.006) + 1) * 1.2);
      const b = this.start;
      const ay = b.y + Math.round((b.boxH - this.arrows[0].height) / 2);
      this.arrows[0].setPosition(b.x - 10 + nudge, ay);
      this.arrows[1].setPosition(b.x + b.boxW + 10 - this.arrows[1].width - nudge, ay);
    }
  }
}
