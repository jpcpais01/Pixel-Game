import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { TREE_BASE_Y, TREE_H } from '../art/trees';
import { pixelText } from '../ui/widgets';
import { forestLoad } from '../world/Forest';

// The Everwood's loading screen: while the first view of a new forest is
// painted (see Forest.prime), a little grove sways in the dark with fireflies
// drifting round it and a bar of leaves filling beneath. It fades away as the
// world fades in.

/** The backdrop: the world's own fade colour, so the hand-over is seamless. */
const BG = 0x07080d;
const TITLE = 0x9ee07a;
const TEXT = 0xb8c6a8;
/** The grove: which trees, and how far apart (px). */
const GROVE: [string, number][] = [
  ['willow1', -58],
  ['maple2', 0],
  ['cherry0', 58],
];
const BAR_W = 120;
/** ms the bar takes to catch up with the progress, and the screen to fade once done. */
const BAR_EASE = 250;
const FADE_MS = 500;

export class ForestLoadScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Rectangle;
  private grove!: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Graphics;
  private shown = 0;
  private leaving = false;
  private z = 1;
  private vw = 0;
  private vh = 0;

  constructor() {
    super('forestload');
  }

  create(): void {
    this.shown = 0;
    this.leaving = false;
    this.cameras.main.setOrigin(0, 0);
    this.bg = this.add.rectangle(0, 0, 1, 1, BG).setOrigin(0);

    const parts: Phaser.GameObjects.GameObject[] = [];
    // A pool of dim light under the grove.
    const glow = this.add.ellipse(0, 2, 190, 22, 0x2a4a22, 0.5);
    parts.push(glow);
    for (const [frame, dx] of GROVE) {
      if (!this.textures.get('ftree').has(frame)) continue;
      const t = this.add.sprite(dx, 0, 'ftree', frame).setOrigin(0.5, TREE_BASE_Y / TREE_H);
      if (dx !== 0) t.setScale(0.85).setTint(0xb0b8c0);
      const anim = `ftree_${frame}`;
      if (this.anims.exists(anim)) t.play({ key: anim, startFrame: Math.floor(Math.random() * 6) });
      parts.push(t);
    }
    // The middle tree in front.
    const middle = parts.find((p) => p instanceof Phaser.GameObjects.Sprite && p.x === 0);
    if (middle) Phaser.Utils.Array.BringToTop(parts, middle);
    const title = pixelText(this, 0, 10, 'The Everwood', TITLE, 2);
    title.setX(-Math.round(title.width / 2));
    const sub = pixelText(this, 0, 30, 'Growing the forest', TEXT).setAlpha(0.8);
    sub.setX(-Math.round(sub.width / 2));
    this.bar = this.add.graphics();
    parts.push(title, sub, this.bar);
    this.grove = this.add.container(0, 0, parts);

    // Fireflies drifting round the grove.
    this.add
      .particles(0, 0, 'spark', {
        x: { min: -110, max: 110 },
        y: { min: -110, max: 0 },
        lifespan: { min: 2200, max: 3800 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -8, max: 2 },
        scale: 0.5,
        alpha: { onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.sin(t * Math.PI) },
        tint: [0xd8ff8a, 0xfff2a0, 0xa8f0c0],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 180,
      })
      .setName('flies');

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    this.vw = width / this.z;
    this.vh = height / this.z;
    this.bg.setSize(this.vw, this.vh);
    const x = Math.round(this.vw / 2);
    const y = Math.round(this.vh / 2 + 20);
    this.grove.setPosition(x, y);
    (this.children.getByName('flies') as Phaser.GameObjects.Particles.ParticleEmitter | null)?.setPosition(x, y);
  }

  update(_time: number, dt: number): void {
    this.shown += (forestLoad.p - this.shown) * Math.min(1, dt / BAR_EASE);
    const g = this.bar.clear();
    const x = -BAR_W / 2;
    const y = 46;
    g.fillStyle(0x020304).fillRect(x - 1, y - 1, BAR_W + 2, 5);
    g.fillStyle(0x16241a).fillRect(x, y, BAR_W, 3);
    const fill = Math.round(BAR_W * Phaser.Math.Clamp(this.shown, 0, 1));
    g.fillStyle(0x4c8a3a).fillRect(x, y, fill, 3);
    g.fillStyle(0x9ee07a).fillRect(x, y, fill, 1);
    if (forestLoad.done && !this.leaving) {
      this.leaving = true;
      this.tweens.add({ targets: this.children.list, alpha: 0, duration: FADE_MS, onComplete: () => this.scene.stop() });
    }
  }
}
