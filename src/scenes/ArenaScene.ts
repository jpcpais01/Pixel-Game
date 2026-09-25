import Phaser from 'phaser';
import { STRIP_H } from '../art/ground';
import { menuZoom } from '../game/display';
import { ARENAS, isPainted, lastArena, rememberArena, type ArenaDef, type PreviewSprite } from '../world/arenas';
import { GroundStreamer } from '../world/GroundStreamer';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';

const CARD_W = 168;
const CARD_H = 128;
const GAP = 8;
/** The window onto the arena at the top of each card. */
const WIN_X = 5;
const WIN_Y = 5;
const WIN_W = CARD_W - 10;
const WIN_H = 84;
/** ms per frame spent building an arena's ground for its window. */
const WARM_BUDGET = 6;

/** Animations to play on a preview sprite's glow layer. */
const GLOW_ANIMS: Record<string, string> = { brazier_e: 'brazier_burn', fountain_e: 'fountain_flow' };

/** One arena on the select screen: a window onto its ground and what stands there, its name and a line about it. */
class ArenaCard extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private keys: [string, string];
  private view: Phaser.GameObjects.Container;
  private loading: Phaser.GameObjects.BitmapText;
  private built = false;
  private title: Phaser.GameObjects.BitmapText;

  constructor(
    scene: Phaser.Scene,
    readonly arena: ArenaDef,
    onTap: () => void,
  ) {
    super(scene, 0, 0);
    this.keys = [panelTexture(scene, 'arena_card', CARD_W, CARD_H, PANEL), panelTexture(scene, 'arena_card_picked', CARD_W, CARD_H, PANEL_PICKED)];
    this.bg = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    let pressed = false;
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => (pressed = true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (pressed = false));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (pressed) onTap();
      pressed = false;
    });
    const inset = scene.add.image(WIN_X - 1, WIN_Y - 1, panelTexture(scene, 'arena_window', WIN_W + 2, WIN_H + 2, PANEL_INSET)).setOrigin(0);
    this.view = scene.add.container(WIN_X, WIN_Y);
    this.loading = pixelText(scene, 0, 0, '...', 0x8a7cc0);
    this.loading.setPosition(Math.round(WIN_X + (WIN_W - this.loading.width) / 2), Math.round(WIN_Y + (WIN_H - this.loading.height) / 2));
    this.title = pixelText(scene, 8, WIN_Y + WIN_H + 6, arena.name, 0xfff4d6, 2);
    // Long names drop to the small font so they fit the card.
    if (this.title.width > CARD_W - 14) this.title.setScale(1).setY(WIN_Y + WIN_H + 9);
    const blurb = pixelText(scene, 8, CARD_H - 16, arena.blurb, 0xb8a8e8);
    this.add([this.bg, inset, this.view, this.loading, this.title, blurb]);
    scene.add.existing(this);
    this.setPicked(false);
  }

  /** Build the arena's ground for the window a little at a time; show it once it's all there. */
  warm(): void {
    if (this.built) return;
    const { preview, ground } = this.arena;
    const top = Math.floor(preview.y - WIN_H / 2);
    if (isPainted(ground) ? !ground.warm(this.scene, WARM_BUDGET) : !GroundStreamer.warm(this.scene, ground, top, top + WIN_H, WARM_BUDGET)) return;
    this.built = true;
    this.loading.setVisible(false);
    this.buildView();
  }

  get ready(): boolean {
    return this.built;
  }

  /** The window: the arena's day ground, cropped to it, with its props standing on it. */
  private buildView(): void {
    const scene = this.scene;
    const { preview, ground } = this.arena;
    const x0 = Math.round(preview.x - WIN_W / 2);
    const y0 = Math.round(preview.y - WIN_H / 2);
    const objs: Phaser.GameObjects.GameObject[] = [];
    // Crop an image placed at window coordinates (x, y), top-left, to the window.
    const clip = (img: Phaser.GameObjects.Image, x: number, y: number) => {
      const fw = img.frame.width;
      const fh = img.frame.height;
      const cx = Math.max(0, -x);
      const cy = Math.max(0, -y);
      const cw = Math.min(fw, WIN_W - x) - cx;
      const ch = Math.min(fh, WIN_H - y) - cy;
      if (cw <= 0 || ch <= 0) {
        img.destroy();
        return false;
      }
      img.setOrigin(0).setPosition(x, y).setCrop(cx, cy, cw, ch);
      objs.push(img);
      return true;
    };
    if (isPainted(ground)) {
      for (const l of ground.layers) {
        const img = scene.add.image(0, 0, l.key);
        if (l.glow) img.setBlendMode(Phaser.BlendModes.ADD);
        clip(img, l.x - x0, l.y - y0);
      }
    } else {
      for (let i = Math.floor(y0 / STRIP_H); i <= Math.floor((y0 + WIN_H) / STRIP_H); i++) {
        const key = `${GroundStreamer.key(ground, i)}_day`;
        if (scene.textures.exists(key)) clip(scene.add.image(0, 0, key), -x0, i * STRIP_H - y0);
      }
    }
    const sprites: PreviewSprite[] = preview.sprites().sort((a, b) => a.y - b.y);
    for (const s of sprites) {
      const body = scene.add.sprite(0, 0, s.texture, s.frame);
      const w = body.frame.width;
      const h = body.frame.height;
      const x = Math.round(s.x - w / 2 - x0);
      const y = Math.round(s.y - (s.originY ?? 1) * h - y0);
      if (!clip(body, x, y) || !s.glow) continue;
      const glow = scene.add.sprite(0, 0, s.glow, s.frame).setBlendMode(Phaser.BlendModes.ADD);
      if (clip(glow, x, y) && GLOW_ANIMS[s.glow]) glow.play(GLOW_ANIMS[s.glow]);
    }
    this.view.add(objs);
    this.view.setAlpha(0);
    scene.tweens.add({ targets: this.view, alpha: 1, duration: 240 });
  }

  setPicked(on: boolean): void {
    this.bg.setTexture(this.keys[on ? 1 : 0]);
    this.title.setTint(on ? this.arena.accent : 0xfff4d6);
    this.view.list.forEach((o) => (o as Phaser.GameObjects.Image).setTint(on ? 0xffffff : 0x9a94b8));
  }
}

/** Arena select, opened after the hero select, over the home screen's forest. */
export class ArenaScene extends Phaser.Scene {
  private cards: ArenaCard[] = [];
  private picked = 0;
  private character = '';
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private back!: PixelButton;
  private play!: PixelButton;
  private leaving = false;

  constructor() {
    super('arena');
  }

  create(data: { character: string }): void {
    this.leaving = false;
    this.character = data.character;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Choose your arena *', 0xf4cf6a);
    this.cards = ARENAS.map((a, i) => new ArenaCard(this, a, () => this.pick(i)));
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'back', () => this.goBack());
    this.play = new PixelButton(this, 'Play', 64, 20, BUTTON_GOLD, 'play', () => this.startGame());
    this.picked = Math.max(0, ARENAS.findIndex((a) => a.id === lastArena()));
    this.cards[this.picked].setPicked(true);

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.pick((this.picked + this.cards.length - 1) % this.cards.length));
    kb?.on('keydown-RIGHT', () => this.pick((this.picked + 1) % this.cards.length));
    kb?.on('keydown-ENTER', () => this.startGame());
    kb?.on('keydown-SPACE', () => this.startGame());
    kb?.on('keydown-ESC', () => this.goBack());

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(): void {
    // One window at a time, the picked arena's first.
    const next = [this.cards[this.picked], ...this.cards].find((c) => !c.ready);
    if (next) {
      next.warm();
      if (next.ready) next.setPicked(next === this.cards[this.picked]);
    }
  }

  private pick(i: number): void {
    if (this.leaving || i === this.picked) return;
    this.cards[this.picked].setPicked(false);
    this.picked = i;
    this.cards[i].setPicked(true);
  }

  private goBack(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.launch('select');
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  private startGame(): void {
    if (this.leaving) return;
    this.leaving = true;
    const character = this.character;
    const arena = this.cards[this.picked].arena.id;
    rememberArena(arena);
    const fade = [this.scene.get('home').cameras.main, this.cameras.main];
    for (const cam of fade) cam.fadeOut(450, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('home');
      this.scene.launch('shade');
      this.scene.launch('ui', { character });
      this.scene.launch('pause');
      this.scene.start('world', { character, arena });
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    // One row while they fit, two rows past three arenas; zoom out a whole step at a time
    // (keeping the pixels crisp), no further than half the usual zoom.
    const n = this.cards.length;
    const rows = n > 3 ? 2 : 1;
    const cols = Math.ceil(n / rows);
    const margin = 8;
    const fullW = cols * CARD_W + (cols - 1) * GAP;
    const blockH = rows * CARD_H + (rows - 1) * GAP;
    const zMax = menuZoom(width, height);
    const zMin = Math.max(1, Math.ceil(zMax / 2));
    let z = zMax;
    let area = this.area(height / z, z);
    while (z > zMin && (fullW + margin * 2 > width / z || blockH > area.h)) {
      z--;
      area = this.area(height / z, z);
    }
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    this.header.setPosition(Math.round((vw - this.header.width) / 2), area.headerY);
    this.play.place((vw - this.play.boxW) / 2, area.buttonsY);
    this.back.place(8, area.buttonsY + 1);

    const y0 = Math.max(area.top, Math.round(area.top + (area.h - blockH) / 2));
    const x0 = Math.round((vw - fullW) / 2);
    this.cards.forEach((c, i) => {
      const r = Math.floor(i / cols);
      const inRow = Math.min(cols, n - r * cols);
      const rowW = inRow * CARD_W + (inRow - 1) * GAP;
      c.setPosition(x0 + Math.round((fullW - rowW) / 2) + (i % cols) * (CARD_W + GAP), y0 + r * (CARD_H + GAP));
    });
  }

  /** Where the header and buttons go on a view this tall (art pixels), and the space left for cards. */
  private area(vh: number, z: number): { headerY: number; buttonsY: number; top: number; h: number } {
    const headerY = Math.ceil(fpsBottom() / z) + 4;
    const buttonsY = Math.round(vh - 26);
    const top = headerY + this.header.height + 6;
    return { headerY, buttonsY, top, h: buttonsY - 6 - top };
  }
}
