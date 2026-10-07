// Heaven Lands' title screen (scene key 'home', so the pause menu's Home
// button and the world's way out land here): a dawn sky, clouds drifting,
// and the player's own wanderer on a little floating isle, now and then
// waving. From here: home, the Atlas, the wardrobe, or a friend's room.

import Phaser from 'phaser';
import { menuZoom } from '../../game/display';
import { PixelButton, pixelText } from '../../ui/widgets';
import { profile } from '../profile';
import { travel, together } from '../travel';
import { ensureWanderer, W_ORIGIN } from '../art/sheet';
import { CLOUD_KINDS, ISLE_H, ISLE_STAND, ISLE_W, cloudSeaTexture, cloudTextures, glowTexture, isleTexture, skyTexture, sunTexture } from '../art/titleArt';
import { titleLogo } from '../art/heavenTitle';
import { HEAVEN_BUTTON, HEAVEN_BUTTON_SOFT } from '../ui/style';

/** Clouds drifting across the sky, and their speeds (art px a second). */
const CLOUDS = 7;
const CLOUD_SPEED: [number, number] = [2, 7];
/** The isle's slow bob: its period (ms) and height (art px). */
const BOB_MS = 4200;
const BOB_PX = 2;
/** How often the wanderer does something while standing on the isle (ms). */
const EMOTE_EVERY: [number, number] = [5000, 11000];
const BUTTON_W = 92;
const BUTTON_H = 20;

interface Cloud {
  img: Phaser.GameObjects.Image;
  speed: number;
}

export class TitleScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private sky!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private sea!: Phaser.GameObjects.TileSprite;
  private sea2!: Phaser.GameObjects.TileSprite;
  private clouds: Cloud[] = [];
  private isle!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Sprite;
  private heroKey = '';
  private nameText!: Phaser.GameObjects.BitmapText;
  private logo!: Phaser.GameObjects.Image;
  private buttons: PixelButton[] = [];
  private isleX = 0;
  private isleY = 0;
  private nextEmote = 0;
  private busy = false;

  constructor() {
    super('home');
  }

  create(): void {
    this.busy = false;
    this.cameras.main.fadeIn(400, 12, 14, 26);
    // The first time, before anything else: make your wanderer.
    if (!profile.made) {
      this.scene.start('creator', { first: true });
      window.bootLoader?.done();
      return;
    }
    cloudTextures(this);
    this.sun = this.add.image(0, 0, sunTexture(this));
    this.sky = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(-10);
    this.sun.setDepth(-9);
    this.clouds = [];
    for (let i = 0; i < CLOUDS; i++) {
      const img = this.add.image(0, 0, 'hl_clouds', `c${i % CLOUD_KINDS}`).setOrigin(0.5, 1).setDepth(-8);
      this.clouds.push({ img, speed: Phaser.Math.FloatBetween(...CLOUD_SPEED) * (i % 2 ? 1 : 0.7) });
    }
    this.sea2 = this.add.tileSprite(0, 0, 8, 34, cloudSeaTexture(this)).setOrigin(0, 1).setDepth(-7).setAlpha(0.75).setTint(0xf0dcf0);
    this.sea = this.add.tileSprite(0, 0, 8, 34, cloudSeaTexture(this)).setOrigin(0, 1).setDepth(-2);
    this.glow = this.add.image(0, 0, glowTexture(this)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(3).setDepth(-6);
    this.isle = this.add.image(0, 0, isleTexture(this)).setOrigin(0.5, 0).setDepth(-5);
    this.heroKey = ensureWanderer(this, profile.look);
    this.hero = this.add.sprite(0, 0, this.heroKey, 'idle_down_0').setOrigin(W_ORIGIN.x, W_ORIGIN.y).setDepth(-4);
    this.hero.play(`${this.heroKey}_idle_down`);
    this.hero.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.hero.play(`${this.heroKey}_idle_down`));
    this.nameText = pixelText(this, 0, 0, profile.name, 0x5a3a52).setOrigin(0.5, 0).setDepth(-3);
    this.logo = this.add.image(0, 0, titleLogo(this)).setOrigin(0.5, 0).setDepth(5);
    this.nextEmote = this.time.now + 2500;

    const go = (fn: () => void) => () => {
      if (this.busy) return;
      fn();
    };
    this.buttons = [
      new PixelButton(this, 'Go home', BUTTON_W, BUTTON_H, HEAVEN_BUTTON, 'hl_btn_home', go(() => this.leave(() => travel(this, 'home')))),
      new PixelButton(this, 'Explore', BUTTON_W, BUTTON_H, HEAVEN_BUTTON_SOFT, 'hl_btn_soft', go(() => this.leave(() => this.scene.start('atlas'), true))),
      new PixelButton(this, 'Wardrobe', BUTTON_W, BUTTON_H, HEAVEN_BUTTON_SOFT, 'hl_btn_soft', go(() => this.leave(() => this.scene.start('creator', {}), true))),
      new PixelButton(this, 'Join a friend', BUTTON_W, BUTTON_H, HEAVEN_BUTTON_SOFT, 'hl_btn_soft', go(() => this.openTogether())),
    ];
    this.buttons.forEach((b) => b.setDepth(6));

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', go(() => this.leave(() => travel(this, 'home'))));
    kb?.on('keydown-M', go(() => this.leave(() => this.scene.start('atlas'), true)));
    this.time.delayedCall(80, () => window.bootLoader?.done());
  }

  private leave(fn: () => void, fade = false): void {
    if (this.busy) return;
    this.busy = true;
    if (!fade) return fn();
    this.cameras.main.fadeOut(260, 12, 14, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, fn);
  }

  private openTogether(): void {
    this.busy = true;
    this.input.enabled = false;
    together(this, 'home', () => {
      this.busy = false;
      this.input.enabled = true;
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.vw = Math.ceil(width / this.z);
    this.vh = Math.ceil(height / this.z);
    const cam = this.cameras.main;
    cam.setZoom(this.z).setOrigin(0, 0).setScroll(0, 0);
    const { vw, vh } = this;
    this.sky.setTexture(skyTexture(this, vw, vh));
    this.sun.setPosition(Math.round(vw * 0.5), Math.round(vh * 0.7));
    this.sea.setSize(vw, 34).setPosition(0, vh);
    this.sea2.setSize(vw, 34).setPosition(0, vh - 10);
    this.clouds.forEach((c, i) => c.img.setPosition(Math.round(((i + 0.5) / CLOUDS) * vw + (i % 2 ? 9 : -14)), Math.round(vh * (0.16 + ((i * 37) % 50) / 100))));

    // Wide: the isle left of centre and the buttons in a column on the right. Narrow: the buttons under it.
    const wide = vw >= vh * 1.25;
    const logoH = this.logo.height;
    this.logo.setPosition(Math.round(wide ? vw * 0.4 : vw / 2), Math.max(6, Math.round(vh * 0.05)));
    const isleTop = this.logo.y + logoH + Math.round(vh * 0.04);
    this.isleX = Math.round(wide ? vw * 0.4 : vw / 2);
    this.isleY = Math.min(isleTop, vh - ISLE_H - (wide ? 4 : BUTTON_H * 2 + 26));
    if (wide) {
      const bx = Math.round(Math.min(vw - BUTTON_W - 14, vw * 0.4 + ISLE_W / 2 + 26));
      const total = this.buttons.length * (BUTTON_H + 6) - 6;
      const by = Math.round(Math.max(this.logo.y + logoH + 4, (vh - total) / 2 + 10));
      this.buttons.forEach((b, i) => b.place(bx, by + i * (BUTTON_H + 6)));
    } else {
      const total = 2 * BUTTON_W + 6;
      const bx = Math.round((vw - total) / 2);
      const by = vh - (BUTTON_H * 2 + 6) - 10;
      this.buttons.forEach((b, i) => b.place(bx + (i % 2) * (BUTTON_W + 6), by + Math.floor(i / 2) * (BUTTON_H + 6)));
    }
    this.place(0);
  }

  /** The isle, the wanderer on it and the glow behind, at the bob's height. */
  private place(bob: number): void {
    const y = this.isleY + bob;
    this.isle.setPosition(this.isleX, y);
    this.glow.setPosition(this.isleX, y + 40);
    const hx = this.isleX - ISLE_W / 2 + ISLE_STAND.x;
    const hy = y + ISLE_STAND.y;
    this.hero.setPosition(hx, hy);
    this.nameText.setPosition(hx, hy + 4);
  }

  update(time: number, delta: number): void {
    if (!this.sky) return;
    const dt = delta / 1000;
    for (const c of this.clouds) {
      c.img.x += c.speed * dt;
      if (c.img.x - c.img.width / 2 > this.vw) c.img.x = -c.img.width / 2;
    }
    this.sea.tilePositionX += 4 * dt;
    this.sea2.tilePositionX -= 2.5 * dt;
    this.place(Math.round(Math.sin((time / BOB_MS) * Math.PI * 2) * BOB_PX));
    if (time > this.nextEmote && this.hero.anims.currentAnim?.key === `${this.heroKey}_idle_down`) {
      const e = Phaser.Utils.Array.GetRandom(['wave', 'heart', 'cheer', 'wave']);
      this.hero.play(`${this.heroKey}_${e}_down`);
      this.nextEmote = time + Phaser.Math.Between(...EMOTE_EVERY);
    }
  }
}
