import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { CHARACTERS, type CharacterDef } from '../game/characters';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

const CARD_W = 164;
const CARD_H = 92;
const GAP = 8;

/** One hero on the select screen: an animated portrait, stats and abilities. */
class Card extends Phaser.GameObjects.Container {
  readonly def: CharacterDef;
  private bg: Phaser.GameObjects.Image;
  private keys: [string, string];
  private sprite: Phaser.GameObjects.Sprite;
  private glow?: Phaser.GameObjects.Sprite;
  private pedestal: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, def: CharacterDef, onTap: () => void) {
    super(scene, 0, 0);
    this.def = def;
    this.keys = [panelTexture(scene, 'card', CARD_W, CARD_H, PANEL), panelTexture(scene, 'card_picked', CARD_W, CARD_H, PANEL_PICKED)];
    this.bg = scene.add.image(0, 0, this.keys[0]).setOrigin(0);
    this.bg.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onTap);

    // Portrait: the character at 2x on a lit pedestal.
    const inset = scene.add.image(5, 5, panelTexture(scene, 'portrait', 54, 82, PANEL_INSET)).setOrigin(0);
    const fx = 32;
    const fy = 78;
    this.pedestal = scene.add.image(fx, fy - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.accent).setScale(1.4, 0.45);
    const shadow = scene.add.image(fx, fy, 'shadow').setScale(2);
    const oy = def.preview.originY ?? 31 / 32;
    this.sprite = scene.add.sprite(fx, fy, def.preview.texture).setOrigin(0.5, oy).setScale(2).play(def.preview.idle);
    if (def.preview.glow) this.glow = scene.add.sprite(fx, fy, def.preview.glow).setOrigin(0.5, oy).setScale(2).setBlendMode(Phaser.BlendModes.ADD);

    const x = 64;
    const name = pixelText(scene, x, 7, def.name, 0xfff4d6, 2);
    const role = pixelText(scene, x, 27, def.role, 0xb8a8e8);
    const pips = scene.add.graphics();
    const stats: [string, number][] = [
      ['Power', def.stats.power],
      ['Speed', def.stats.speed],
      ['Range', def.stats.range],
    ];
    const labels = stats.map(([label, value], i) => {
      const y = 39 + i * 9;
      for (let p = 0; p < 5; p++) {
        pips.fillStyle(0x0b0818).fillRect(x + 36 + p * 7, y + 1, 7, 7);
        pips.fillStyle(p < value ? def.accent : 0x2a2150).fillRect(x + 37 + p * 7, y + 2, 5, 5);
        if (p < value) pips.fillStyle(0xffffff, 0.45).fillRect(x + 37 + p * 7, y + 2, 5, 1);
      }
      return pixelText(scene, x, y, label, 0x8a7cc0);
    });
    const abilities = [def.attack, def.special].map((a, i) => pixelText(scene, x, 68 + i * 10, `* ${a}`).setCharacterTint(0, 1, false, def.accent));

    this.add([this.bg, inset, this.pedestal, shadow, this.sprite, ...(this.glow ? [this.glow] : []), name, role, pips, ...labels, ...abilities]);
    scene.add.existing(this);
    this.setPicked(false);
  }

  setPicked(on: boolean): void {
    this.bg.setTexture(this.keys[on ? 1 : 0]);
    this.pedestal.setAlpha(on ? 0.7 : 0.25);
    if (on) {
      this.sprite.clearTint().play(this.def.preview.chosen).chain(this.def.preview.idle);
    } else {
      this.sprite.setTint(0x8a84a8).play(this.def.preview.idle, true);
    }
    this.glow?.setAlpha(on ? 1 : 0.5);
  }

  sync(): void {
    this.glow?.setFrame(this.sprite.frame.name);
  }
}

/** Character select, opened over the home screen's forest. */
export class SelectScene extends Phaser.Scene {
  private cards: Card[] = [];
  private picked = 0;
  private shade!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.BitmapText;
  private back!: PixelButton;
  private play!: PixelButton;
  private leaving = false;

  constructor() {
    super('select');
  }

  create(): void {
    this.leaving = false;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 260 });

    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0);
    this.header = pixelText(this, 0, 0, '* Choose your hero *', 0xf4cf6a);
    this.cards = CHARACTERS.map((def, i) => new Card(this, def, () => (i === this.picked ? this.startGame() : this.pick(i))));
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'back', () => this.goBack());
    this.play = new PixelButton(this, 'Play', 64, 20, BUTTON_GOLD, 'play', () => this.startGame());
    this.picked = 0;
    this.cards[0].setPicked(true);

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
    for (const c of this.cards) c.sync();
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
    (this.scene.get('home') as HomeScene).showMenu(true);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  private startGame(): void {
    if (this.leaving) return;
    this.leaving = true;
    const character = this.cards[this.picked].def.id;
    const fade = [this.scene.get('home').cameras.main, this.cameras.main];
    for (const cam of fade) cam.fadeOut(450, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('home');
      this.scene.launch('ui', { character });
      this.scene.start('world', { character });
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    const z = menuZoom(width, height);
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;
    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);

    const top = Math.ceil(fpsBottom() / z) + 4;
    this.header.setPosition(Math.round((vw - this.header.width) / 2), top);

    const buttonsY = Math.round(vh - 26);
    this.play.place((vw - this.play.w) / 2, buttonsY);
    this.back.place(8, buttonsY + 1);

    // Cards in rows, centred in the space between the header and the buttons.
    const n = this.cards.length;
    const perRow = Math.max(1, Math.min(n, Math.floor((vw - 16 + GAP) / (CARD_W + GAP))));
    const rows = Math.ceil(n / perRow);
    const blockH = rows * CARD_H + (rows - 1) * GAP;
    const areaTop = top + this.header.height + 6;
    const y0 = Math.max(areaTop, Math.round(areaTop + (buttonsY - 6 - areaTop - blockH) / 2));
    this.cards.forEach((c, i) => {
      const r = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - r * perRow);
      const rowW = inRow * CARD_W + (inRow - 1) * GAP;
      c.setPosition(Math.round((vw - rowW) / 2) + (i % perRow) * (CARD_W + GAP), y0 + r * (CARD_H + GAP));
    });
  }
}
