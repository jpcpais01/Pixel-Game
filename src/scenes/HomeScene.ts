import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { LOGO_FRAMES, everlandsLogo, sparkleBitmap } from '../art/logo';
import { paintHall } from '../art/hall';
import { BUTTON_GOLD, PixelButton, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';

/** How often the glint sweeps the title, and how long each of its frames shows. */
const SHIMMER_EVERY = 5200;
const SHIMMER_FRAME = 45;

/**
 * The home screen: the Hall of Legends at midday, with sunlight streaming
 * through its windows and dust drifting in the beams, the title and a Start
 * Game button. The hall stays behind the character select, which opens over it.
 */
export class HomeScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private elapsed = 0;
  private hallKey = '';
  private hall!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private shafts: Phaser.GameObjects.Image[] = [];
  private windowGlows: Phaser.GameObjects.Image[] = [];
  /** Light rays (x0, y0, x1, y1) that dust is scattered along. */
  private rays: Float32Array = new Float32Array(0);
  private menu!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Image;
  private titleGlow!: Phaser.GameObjects.Image;
  private sparkles: Phaser.GameObjects.Image[] = [];
  private sparkleSpots: { x: number; y: number }[] = [];
  private titleScale = 1;
  private titleFrame = 0;
  private start!: PixelButton;
  private arrows: Phaser.GameObjects.BitmapText[] = [];
  private titleY = 0;
  private menuOpen = true;

  constructor() {
    super('home');
  }

  create(): void {
    // The scene object is reused when the game returns here from the pause menu.
    this.hallKey = '';
    this.windowGlows = [];
    this.menuOpen = true;
    this.titleFrame = 0;
    this.buildTextures();
    this.sparkleSpots = this.registry.get('logoSparkles');
    this.cameras.main.setOrigin(0, 0);
    this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.35);

    this.hall = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.sun = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.shafts = [0, 1].map(() => this.add.image(0, 0, '__DEFAULT').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD));
    // Dust motes, only ever seen where they drift through the light.
    const dust: Phaser.Types.GameObjects.Particles.RandomZoneSource = {
      getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => {
        const n = this.rays.length / 4;
        if (!n) return p;
        const i = Math.floor(Math.random() * n) * 4;
        const t = 0.08 + Math.random() * 0.85;
        p.x = this.rays[i] + (this.rays[i + 2] - this.rays[i]) * t;
        p.y = this.rays[i + 1] + (this.rays[i + 3] - this.rays[i + 1]) * t;
        return p;
      },
    };
    this.add.particles(0, 0, 'home_dot', {
      emitZone: { type: 'random', source: dust } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 3500, max: 8000 },
      speedX: { min: -2, max: 4 },
      speedY: { min: -3, max: 2.5 },
      alpha: {
        onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) =>
          Math.sin(t * Math.PI) * (0.55 + 0.45 * Math.max(0, Math.sin(t * Math.PI * 4))),
      },
      tint: [0xfff2cc, 0xffe2a8, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 35,
    });

    this.menu = this.add.container(0, 0);
    this.titleGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050);
    this.title = this.add.image(0, 0, 'home_title', 0).setOrigin(0);
    this.sparkles = this.sparkleSpots.map(() => this.add.image(0, 0, 'home_sparkle').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    this.start = new PixelButton(this, 'Start Game', 84, 22, BUTTON_GOLD, 'start', () => this.openSelect());
    this.arrows = [pixelText(this, 0, 0, '>', 0xf4cf6a), pixelText(this, 0, 0, '<', 0xf4cf6a)];
    this.menu.add([this.titleGlow, this.title, ...this.sparkles, this.start, ...this.arrows]);

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

  private buildTextures(): void {
    if (this.textures.exists('home_title')) return;
    const logo = everlandsLogo();
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

    const w = Math.ceil(vw);
    const h = Math.ceil(vh);
    const key = `hall_${w}x${h}`;
    if (key !== this.hallKey) {
      const art = paintHall(w, h);
      const layers = [art.base, art.sun, ...art.shafts];
      const images = [this.hall, this.sun, ...this.shafts];
      layers.forEach((b, i) => {
        const k = `${key}_${i}`;
        if (!this.textures.exists(k)) this.textures.addCanvas(k, b.toCanvas());
        images[i].setTexture(k);
        if (this.hallKey) this.textures.remove(`${this.hallKey}_${i}`);
      });
      this.hallKey = key;
      this.rays = art.rays;
      for (const g of this.windowGlows) g.destroy();
      this.windowGlows = art.windows.map((r) =>
        this.add
          .image(r.x + r.w / 2, r.y + r.h * 0.55, 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffd9a0)
          .setScale((r.w * 2.6) / 32, (r.h * 1.5) / 32),
      );
      // Behind the menu, over the hall.
      for (const g of this.windowGlows) this.children.moveAbove(g, this.shafts[1]);
    }

    // Title: 2x when it fits with a margin; kept clear of the FPS counter.
    const ts = vw >= this.title.width * 2 + 16 ? 2 : 1;
    this.titleScale = ts;
    this.title.setScale(ts);
    this.titleGlow.setScale((this.title.width * ts * 1.15) / 32, (this.title.height * ts * 1.3) / 32);
    const top = Math.ceil(fpsBottom() / this.z) + 6;
    this.titleY = Math.max(top, Math.round(vh * 0.17));
    this.title.setPosition(Math.round((vw - this.title.displayWidth) / 2), this.titleY);
    const by = Math.max(this.titleY + this.title.displayHeight + 14, Math.round(vh * 0.52));
    this.start.place((vw - this.start.boxW) / 2, by);
  }

  update(time: number, dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed / 1000;
    // Clouds drift over the sun now and then, and the shafts shimmer.
    const cloud = 0.86 + 0.14 * (0.5 + 0.5 * (0.6 * Math.sin(t * 0.21) + 0.4 * Math.sin(t * 0.53 + 1.7)));
    const shimmer = 0.3 * Math.sin(time * 0.0006);
    this.sun.setAlpha(cloud);
    this.shafts[0].setAlpha(cloud * (0.7 + shimmer));
    this.shafts[1].setAlpha(cloud * (0.7 - shimmer));
    for (const g of this.windowGlows) g.setAlpha(0.22 * cloud);

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
