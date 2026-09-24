import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { titleBitmap } from '../art/font';
import { hex } from '../art/pixel';
import type { Bitmap } from '../art/bitmap';
import {
  STRIP_W,
  STRIP_H,
  HORIZON,
  farMountains,
  ridge,
  midForest,
  nearForest,
  foreground,
  mist,
  clouds,
  sunRays,
  paintSky,
  leafSheet,
} from '../art/forest';
import { BUTTON_GOLD, PixelButton, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';

interface Strip {
  sprite: Phaser.GameObjects.TileSprite;
  /** Art px per second. */
  speed: number;
  /** Shift down from the bottom-anchored position, in art px. */
  drop: number;
}

const SUN_R = 11;

/**
 * The home screen: a forest at dusk scrolling past in parallax layers, the
 * title and a Start Game button. The forest keeps running behind the
 * character select, which opens over it.
 */
export class HomeScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private elapsed = 0;
  private skyKey = '';
  private sky!: Phaser.GameObjects.Image;
  private sunGlow!: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image[] = [];
  private strips: Strip[] = [];
  private starZone = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private leafZone = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private fireflyZone = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private menu!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Image;
  private start!: PixelButton;
  private arrows: Phaser.GameObjects.BitmapText[] = [];
  private titleY = 0;
  private menuOpen = true;

  constructor() {
    super('home');
  }

  create(): void {
    this.buildTextures();
    this.cameras.main.setOrigin(0, 0);
    this.cameras.main.postFX.addVignette(0.5, 0.5, 0.95, 0.3);

    this.sky = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.sunGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa060).setScale(6).setAlpha(0.35);
    this.add.particles(0, 0, 'forest_dot', {
      emitZone: { type: 'random', source: this.starZone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1800, max: 3600 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) },
      tint: [0xffffff, 0xd8dcff, 0xffe9c4],
      frequency: 260,
    });

    this.strip('forest_clouds', 1.2);
    this.strip('forest_far', 2.5);
    this.strip('forest_ridge', 5);
    this.rays = ['forest_rays0', 'forest_rays1'].map((k) => this.add.image(0, 0, k).setBlendMode(Phaser.BlendModes.ADD));
    this.strip('forest_mid', 10);
    this.strip('forest_mist0', 14).sprite.setAlpha(0.9);
    this.strip('forest_near', 20);
    this.add.particles(0, 0, 'forest_leaf', {
      frame: ['l0', 'l1', 'l2'],
      emitZone: { type: 'random', source: this.leafZone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 16000,
      speedX: { min: -30, max: -12 },
      speedY: { min: 7, max: 15 },
      // Flutter: the leaf flips as it tumbles.
      scaleY: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => (Math.sin(t * 90) > 0 ? 1 : -1) },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.min(1, t * 10, (1 - t) * 10) },
      frequency: 850,
    });
    this.strip('forest_mist1', 28, 20).sprite.setAlpha(0.55);
    this.strip('forest_fg', 36);
    this.add.particles(0, 0, 'forest_dot', {
      emitZone: { type: 'random', source: this.fireflyZone } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 3000, max: 6000 },
      speedX: { min: -16, max: -3 },
      speedY: { min: -5, max: 3 },
      alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.max(0, Math.sin(t * Math.PI * 5)) * Math.sin(t * Math.PI) },
      tint: [0xffe9a0, 0xfff6c8, 0xd8ff9a],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 170,
    });

    this.menu = this.add.container(0, 0);
    this.title = this.add.image(0, 0, 'forest_title').setOrigin(0);
    this.start = new PixelButton(this, 'Start Game', 84, 22, BUTTON_GOLD, 'start', () => this.openSelect());
    this.arrows = [pixelText(this, 0, 0, '>', 0xf4cf6a), pixelText(this, 0, 0, '<', 0xf4cf6a)];
    this.menu.add([this.title, this.start, ...this.arrows]);

    const kb = this.input.keyboard;
    kb?.on('keydown-ENTER', () => this.openSelect());
    kb?.on('keydown-SPACE', () => this.openSelect());

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  /** Show or hide the title and button (hidden while the character select is open). */
  showMenu(open: boolean): void {
    this.menuOpen = open;
    this.start.setEnabled(open);
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

  private strip(key: string, speed: number, drop = 0): Strip {
    const s = { sprite: this.add.tileSprite(0, 0, 1, STRIP_H, key).setOrigin(0), speed, drop };
    this.strips.push(s);
    return s;
  }

  private buildTextures(): void {
    if (this.textures.exists('forest_far')) return;
    const add = (key: string, b: Bitmap) => this.textures.addCanvas(key, b.toCanvas())!;
    add('forest_clouds', clouds());
    add('forest_far', farMountains());
    add('forest_ridge', ridge());
    add('forest_mid', midForest());
    add('forest_near', nearForest());
    add('forest_fg', foreground());
    add('forest_mist0', mist(81));
    add('forest_mist1', mist(91, hex('#c98aa6')));
    add('forest_rays0', sunRays(3));
    add('forest_rays1', sunRays(9));
    add('forest_title', titleBitmap('Pixel Battle'));
    const leaves = add('forest_leaf', leafSheet());
    for (let i = 0; i < 3; i++) leaves.add(`l${i}`, 0, i * 3, 0, 3, 2);
    const dot = this.textures.createCanvas('forest_dot', 1, 1)!;
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

    const sunX = Math.round(vw * 0.64);
    const sunY = Math.round(vh - HORIZON - 26);
    const w = Math.ceil(vw);
    const h = Math.ceil(vh);
    const key = `forest_sky_${w}x${h}`;
    if (key !== this.skyKey) {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, paintSky(w, h, sunX, sunY, SUN_R).toCanvas());
      this.sky.setTexture(key);
      if (this.skyKey) this.textures.remove(this.skyKey);
      this.skyKey = key;
    }
    this.sunGlow.setPosition(sunX, sunY);
    for (const r of this.rays) r.setPosition(sunX, sunY);
    for (const s of this.strips) s.sprite.setPosition(0, vh - STRIP_H + s.drop).setSize(w + 1, STRIP_H);

    this.starZone.setTo(0, 0, vw, Math.max(1, vh - HORIZON - 100));
    this.leafZone.setTo(0, -4, vw + 40, vh * 0.6);
    this.fireflyZone.setTo(0, vh - 70, vw + 20, 62);

    // Title: 2x on wide views; kept clear of the FPS counter.
    const ts = vw >= 300 ? 2 : 1;
    this.title.setScale(ts);
    const top = Math.ceil(fpsBottom() / this.z) + 6;
    this.titleY = Math.max(top, Math.round(vh * 0.17));
    this.title.setPosition(Math.round((vw - this.title.displayWidth) / 2), this.titleY);
    const by = Math.max(this.titleY + this.title.displayHeight + 14, Math.round(vh * 0.52));
    this.start.place((vw - this.start.boxW) / 2, by);
  }

  update(time: number, dt: number): void {
    this.elapsed += dt;
    const z = this.z;
    const t = this.elapsed / 1000;
    for (const s of this.strips) s.sprite.tilePositionX = Math.round(((t * s.speed) % STRIP_W) * z) / z;

    this.rays[0].setAlpha(0.6 + 0.25 * Math.sin(time * 0.0007));
    this.rays[1].setAlpha(0.6 - 0.25 * Math.sin(time * 0.0007));
    this.sunGlow.setAlpha(0.3 + 0.05 * Math.sin(time * 0.0011));

    if (this.menu.visible) {
      this.title.y = this.titleY + Math.round(Math.sin(time * 0.0016) * 1.5);
      const nudge = Math.round((Math.sin(time * 0.006) + 1) * 1.2);
      const b = this.start;
      const ay = b.y + Math.round((b.boxH - this.arrows[0].height) / 2);
      this.arrows[0].setPosition(b.x - 10 + nudge, ay);
      this.arrows[1].setPosition(b.x + b.boxW + 10 - this.arrows[1].width - nudge, ay);
    }
  }
}
