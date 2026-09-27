import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { LOGO_FRAMES, mythsLogo, sparkleBitmap } from '../art/logo';
import { type Backdrop, makeBackdrop } from './homeBackdrops';
import { BUTTON_GEM, BUTTON_GOLD, BUTTON_PLAIN, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { collection } from '../game/collection';
import { sound } from '../audio';
import { account, cloudReady, logOut, onAccount } from '../game/cloud';
import { openAccountForm } from '../ui/accountForm';
import { fpsBottom } from './FpsScene';

/** How often the glint sweeps the title, and how long each of its frames shows. */
const SHIMMER_EVERY = 5200;
const SHIMMER_FRAME = 45;
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
  private shop!: PixelButton;
  /** The player's gems, beside the Shop button. */
  private gemIcon!: Phaser.GameObjects.Image;
  private gemText!: Phaser.GameObjects.BitmapText;
  /** The daily gift's banner, while it shows. */
  private gift: Phaser.GameObjects.Container | null = null;
  private accountBtn!: PixelButton;
  private who!: Phaser.GameObjects.BitmapText;
  private arrows: Phaser.GameObjects.BitmapText[] = [];
  private titleY = 0;
  private menuOpen = true;

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
    this.inventory = new PixelButton(this, 'Inventory', 84, 18, BUTTON_PLAIN, 'inventory', () => this.openInventory());
    this.shop = new PixelButton(this, 'Shop', 84, 18, BUTTON_GEM, 'shop', () => this.openShop()).setIcon('gem_s');
    this.gemIcon = this.add.image(0, 0, 'gem_s').setOrigin(0);
    this.gemText = pixelText(this, 0, 0, '', 0x9ff6ff);
    this.accountBtn = new PixelButton(this, 'Log in', 84, 18, BUTTON_PLAIN, 'account', () => this.tapAccount());
    this.accountBtn.setVisible(cloudReady());
    this.who = pixelText(this, 0, 0, '', 0x9a90c8);
    this.arrows = [pixelText(this, 0, 0, '>', 0xf4cf6a), pixelText(this, 0, 0, '<', 0xf4cf6a)];
    this.menu.add([this.titleGlow, this.title, ...this.sparkles, this.start, this.inventory, this.shop, this.gemIcon, this.gemText, this.accountBtn, this.who, ...this.arrows]);
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
    this.time.delayedCall(600, () => this.giveDaily());
  }

  private showGems(): void {
    this.gemText.setText(`${collection.gems}`);
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

    // Title: 2x when it fits with a margin; kept clear of the FPS counter.
    const ts = vw >= this.title.width * 2 + 16 ? 2 : 1;
    this.titleScale = ts;
    this.title.setScale(ts);
    this.titleGlow.setScale((this.title.width * ts * 1.15) / 32, (this.title.height * ts * 1.3) / 32);
    const top = Math.ceil(fpsBottom() / this.z) + 6;
    this.titleY = Math.max(top, Math.round(vh * 0.1));
    this.title.setPosition(Math.round((vw - this.title.displayWidth) / 2), this.titleY);
    const by = Math.max(this.titleY + this.title.displayHeight + 14, Math.round(vh * 0.52));
    this.start.place((vw - this.start.boxW) / 2, by);
    this.inventory.place((vw - this.inventory.boxW) / 2, by + this.start.boxH + 6);
    this.shop.place((vw - this.shop.boxW) / 2, this.inventory.y + this.inventory.boxH + 5);
    this.gemIcon.setPosition(this.shop.x + this.shop.boxW + 6, this.shop.y + Math.round((this.shop.boxH - this.gemIcon.height) / 2));
    this.gemText.setPosition(this.gemIcon.x + this.gemIcon.width + 2, this.shop.y + Math.round((this.shop.boxH - this.gemText.height) / 2));
    this.accountBtn.place((vw - this.accountBtn.boxW) / 2, this.shop.y + this.shop.boxH + 5);
    this.who.setPosition(Math.round((vw - this.who.width) / 2), this.accountBtn.y + this.accountBtn.boxH + 4);
  }

  update(time: number, dt: number): void {
    this.elapsed += dt;
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
