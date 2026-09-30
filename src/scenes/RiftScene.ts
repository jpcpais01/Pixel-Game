import Phaser from 'phaser';
import { sound } from '../audio';
import { beamHud, comboHud } from '../game/controls';
import { menuZoom } from '../game/display';
import { difficultyDef, riftHud, type Blessing, type RiftCall } from '../game/rift';
import { DIFF_STYLE, difficultyIcon } from '../ui/riftDifficulty';
import { BLESSING_TINT, type BlessingIcon } from '../art/rift';
import { session } from '../net/session';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import { releaseControls } from './PauseScene';

const GOLD = 0xf4cf6a;
const LAVENDER = 0xb8a8e8;
const MAGENTA = 0xff7ad0;
const CARD_W = 76;
const CARD_H = 98;
const CARD_GAP = 8;
const RESULT_W = 176;
const RESULT_H = 116;
const CHAMP_W = 120;
/** How long a flashed call stays up, and how long the results wait after the fall. */
const CALL_TIME = 1700;
const RESULTS_DELAY = 1600;

interface Card {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  def: Blessing;
}

/**
 * The Endless Rift's overlay, over the world while a run lasts: the wave and
 * the foes left at the top, the blessings taken under it, a bar for a
 * champion, lines flashed across the screen as waves begin and end, three
 * cards to choose a blessing between waves, and the run's end with a way to
 * try again or go home. It reads riftHud (game/rift.ts) and hands the choice back.
 */
export class RiftScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private waveText!: Phaser.GameObjects.BitmapText;
  private leftText!: Phaser.GameObjects.BitmapText;
  private hudPanel!: Phaser.GameObjects.Image;
  private icons: Phaser.GameObjects.Container | null = null;
  private iconsKey = '';
  /** Hard or Impossible, on a plate under the wave (nothing on Normal). */
  private tag: Phaser.GameObjects.Container | null = null;
  private tagText: Phaser.GameObjects.BitmapText | null = null;
  private tagW = 0;
  private clock = 0;
  private champ!: Phaser.GameObjects.Container;
  private champName!: Phaser.GameObjects.BitmapText;
  private champBar!: Phaser.GameObjects.Graphics;
  private call: Phaser.GameObjects.Container | null = null;
  private callT = 0;
  private shade!: Phaser.GameObjects.Rectangle;
  private chooseTitle!: Phaser.GameObjects.BitmapText;
  private cards: Card[] = [];
  private shownOffer: Blessing[] | null = null;
  private results: Phaser.GameObjects.Container | null = null;
  private overT = 0;
  private leaving = false;

  constructor() {
    super('rift');
  }

  create(): void {
    this.cards = [];
    this.shownOffer = null;
    this.results = null;
    this.icons = null;
    this.iconsKey = '';
    this.call = null;
    this.overT = 0;
    this.leaving = false;
    this.tag = null;
    this.tagText = null;
    this.tagW = 0;
    this.clock = 0;
    this.cameras.main.setOrigin(0, 0);

    this.hudPanel = this.add.image(0, 0, panelTexture(this, 'rift_hud', 92, 18, PANEL)).setOrigin(0);
    this.waveText = pixelText(this, 0, 0, '', GOLD);
    this.leftText = pixelText(this, 0, 0, '', LAVENDER);
    this.champName = pixelText(this, 0, 0, '', MAGENTA);
    this.champBar = this.add.graphics();
    this.champ = this.add.container(0, 0, [this.champName, this.champBar]).setVisible(false);
    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.5).setOrigin(0).setVisible(false);
    this.chooseTitle = pixelText(this, 0, 0, 'Choose a blessing', GOLD).setVisible(false);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, dt: number): void {
    if (!riftHud.active) return;
    this.clock += dt;
    this.updateHud();
    this.updateCalls(dt);
    // The cards come with the offer and go once one is chosen.
    if (riftHud.offer && riftHud.offer !== this.shownOffer && riftHud.pick < 0) this.showCards(riftHud.offer);
    if (!riftHud.offer && this.cards.length && this.shownOffer) this.hideCards();
    if (riftHud.phase === 'over') {
      this.overT += dt;
      if (!this.results && this.overT > RESULTS_DELAY) this.showResults();
    }
  }

  // ---------------------------------------------------------------- The HUD

  private updateHud(): void {
    const over = riftHud.phase === 'over';
    this.waveText.setText(`WAVE ${Math.max(1, riftHud.wave)}`);
    this.leftText.setText(riftHud.phase === 'fight' || riftHud.phase === 'intro' ? `${riftHud.left} ${riftHud.left === 1 ? 'FOE' : 'FOES'}` : riftHud.phase === 'over' ? '' : 'CLEAR');
    for (const o of [this.hudPanel, this.waveText, this.leftText]) o.setVisible(!over);
    this.updateTag(over);
    this.placeHud();

    // Blessings taken, one icon each with how many times.
    const counts = new Map<BlessingIcon, number>();
    for (const b of riftHud.taken) counts.set(b, (counts.get(b) ?? 0) + 1);
    const key = [...counts].map(([k, n]) => `${k}${n}`).join();
    if (key !== this.iconsKey) {
      this.iconsKey = key;
      this.icons?.destroy();
      const parts: Phaser.GameObjects.GameObject[] = [];
      let x = 0;
      for (const [k, n] of counts) {
        parts.push(this.add.image(x, 0, `blessing_${k}`).setOrigin(0));
        if (n > 1) parts.push(pixelText(this, x + 11, 10, `${n}`, BLESSING_TINT[k]));
        x += 18;
      }
      this.icons = this.add.container(0, 0, parts);
      this.icons.setData('w', x - 2);
      this.placeHud();
    }
    this.icons?.setVisible(!over && !riftHud.offer);

    const c = riftHud.champion;
    this.champ.setVisible(!!c && !over);
    if (c) {
      this.champName.setText(c.name.toUpperCase());
      this.champName.setPosition(Math.round((CHAMP_W - this.champName.width) / 2), 0);
      const g = this.champBar.clear();
      const w = Math.round((CHAMP_W * c.hp) / c.max);
      g.fillStyle(0x07061a).fillRect(-1, 9, CHAMP_W + 2, 6);
      g.fillStyle(0x3a0a2a).fillRect(0, 10, CHAMP_W, 4);
      g.fillStyle(0xe03a9a).fillRect(0, 10, w, 4);
      g.fillStyle(0xffb0e0).fillRect(0, 10, w, 1);
      g.fillStyle(0xe0a838).fillRect(-3, 8, 2, 8).fillRect(CHAMP_W + 1, 8, 2, 8);
    }
  }

  private placeHud(): void {
    const top = Math.ceil(fpsBottom() / this.z) + 3;
    const px = Math.round((this.vw - 92) / 2);
    this.hudPanel.setPosition(px, top);
    this.waveText.setPosition(px + 7, top + 5);
    this.leftText.setPosition(px + 92 - 7 - this.leftText.width, top + 5);
    // The difficulty's plate hangs just under the wave, and the rest moves down for it.
    const below = top + (this.tag ? 17 : 0);
    this.tag?.setPosition(Math.round((this.vw - this.tagW) / 2), top + 17);
    const iw = (this.icons?.getData('w') as number | undefined) ?? 0;
    this.icons?.setPosition(Math.round((this.vw - iw) / 2), below + 21);
    this.champ.setPosition(Math.round((this.vw - CHAMP_W) / 2), below + (iw > 0 ? 40 : 22));
  }

  /**
   * Hard and Impossible wear a plate under the wave: its skull(s) and its
   * name, embers glowing on Hard, and on Impossible a slow crimson heartbeat.
   */
  private updateTag(over: boolean): void {
    const d = difficultyDef(riftHud.difficulty);
    if (d.id === 'normal') return;
    if (!this.tag) {
      const icon = difficultyIcon(this, d.id);
      const text = pixelText(this, 0, 0, d.name, d.tint);
      const iconW = this.textures.get(icon).getSourceImage().width;
      const w = iconW + 3 + text.width + 12;
      const plate = this.add.image(0, 0, panelTexture(this, `rift_tag_${d.id}`, w, 14, DIFF_STYLE[d.id][0])).setOrigin(0);
      const glow = this.add.image(w / 2, 7, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(d.tint).setScale(w / 18, 0.9).setAlpha(0.3);
      const img = this.add.image(6, 3, icon).setOrigin(0);
      text.setPosition(6 + iconW + 3, 4);
      this.tag = this.add.container(0, 0, [glow, plate, img, text]);
      this.tag.setData('glow', glow);
      this.tagText = text;
      this.tagW = w;
    }
    this.tag.setVisible(!over);
    const t = this.clock / 1000;
    const glow = this.tag.getData('glow') as Phaser.GameObjects.Image;
    if (d.id === 'impossible') {
      // Lub-dub: two quick throbs, then a pause.
      const phase = t % 1.3;
      const beat = Math.exp(-(((phase - 0.1) / 0.07) ** 2)) + 0.7 * Math.exp(-(((phase - 0.36) / 0.07) ** 2));
      glow.setAlpha(0.2 + 0.55 * beat);
      this.tagText!.setTint(beat > 0.5 ? 0xffb0b8 : d.tint);
    } else glow.setAlpha(0.22 + 0.12 * Math.sin(t * 2.4));
  }

  // ---------------------------------------------------------------- Calls

  private updateCalls(dt: number): void {
    if (this.call) {
      this.callT -= dt;
      if (this.callT <= 0) {
        const old = this.call;
        this.call = null;
        this.tweens.add({ targets: old, alpha: 0, y: old.y - 6, duration: 260, onComplete: () => old.destroy() });
      }
    }
    if (!this.call && riftHud.calls.length) this.showCall(riftHud.calls.shift()!);
  }

  /** A line across the upper screen, a smaller one under it, rising in and fading out. */
  private showCall(c: RiftCall): void {
    const t = pixelText(this, 0, 0, c.text, c.tint, 2);
    t.setX(Math.round(-t.width / 2));
    const parts: Phaser.GameObjects.GameObject[] = [t];
    if (c.sub) {
      const s = pixelText(this, 0, 18, c.sub, 0xe8e0ff);
      s.setX(Math.round(-s.width / 2));
      parts.push(s);
    }
    const box = this.add.container(Math.round(this.vw / 2), Math.round(this.vh * 0.24) + 4, parts).setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, y: box.y - 4, duration: 220 });
    this.call = box;
    this.callT = CALL_TIME;
  }

  // ---------------------------------------------------------------- Blessings

  private showCards(offer: Blessing[]): void {
    this.hideCards(true);
    // Make way: the line on screen goes as the cards come.
    this.callT = Math.min(this.callT, 0);
    this.shownOffer = offer;
    this.shade.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.shade, alpha: 1, duration: 200 });
    this.chooseTitle.setVisible(true);
    offer.forEach((def, i) => {
      const tint = BLESSING_TINT[def.id];
      const bg = this.add.image(0, 0, panelTexture(this, `rift_card_${def.id}`, CARD_W, CARD_H, PANEL)).setOrigin(0);
      const glow = this.add.image(CARD_W / 2, 30, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0.35).setScale(1.3);
      const icon = this.add.image(CARD_W / 2, 30, `blessing_${def.id}`).setScale(2);
      const name = pixelText(this, 0, 52, def.name, tint);
      name.setX(Math.round((CARD_W - name.width) / 2));
      const parts: Phaser.GameObjects.GameObject[] = [bg, glow, icon, name];
      wrap(def.text, 15).forEach((line, k) => {
        const t = pixelText(this, 0, 66 + k * 9, line, 0xe8e0ff);
        t.setX(Math.round((CARD_W - t.width) / 2));
        parts.push(t);
      });
      const had = riftHud.taken.filter((b) => b === def.id).length;
      if (had) {
        const t = pixelText(this, 0, CARD_H - 12, `Have ${had}`, 0x7c72b0);
        t.setX(Math.round((CARD_W - t.width) / 2));
        parts.push(t);
      }
      const box = this.add.container(0, 0, parts).setAlpha(0);
      bg.setInteractive({ useHandCursor: true });
      bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.choose(i));
      this.tweens.add({ targets: box, alpha: 1, duration: 240, delay: 80 + i * 90 });
      this.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
      this.cards.push({ box, bg, def });
      sound.cardFlip(0);
    });
    this.layout();
  }

  private choose(i: number): void {
    if (riftHud.pick >= 0 || !riftHud.offer) return;
    riftHud.pick = i;
    const card = this.cards[i];
    this.cameras.main.flash(160, 255, 255, 255, false);
    this.cards.forEach((c, k) => {
      c.bg.disableInteractive();
      this.tweens.add({ targets: c.box, alpha: 0, y: c.box.y + (k === i ? -10 : 6), scale: k === i ? 1.08 : 0.94, duration: k === i ? 420 : 220 });
    });
    riftHud.calls.push({ text: card.def.name, sub: card.def.text, tint: BLESSING_TINT[card.def.id] });
  }

  private hideCards(now = false): void {
    for (const c of this.cards) {
      if (now) c.box.destroy();
      else this.time.delayedCall(450, () => c.box.destroy());
    }
    this.cards = [];
    this.shownOffer = null;
    this.chooseTitle.setVisible(false);
    if (now) this.shade.setVisible(false);
    else this.tweens.add({ targets: this.shade, alpha: 0, duration: 300, onComplete: () => this.shade.setVisible(false) });
  }

  // ---------------------------------------------------------------- The end

  private showResults(): void {
    const panel = this.add.image(0, 0, panelTexture(this, 'rift_results', RESULT_W, RESULT_H, PANEL)).setOrigin(0);
    const center = (t: Phaser.GameObjects.BitmapText, y: number) => t.setPosition(Math.round((RESULT_W - t.width) / 2), y);
    const title = center(pixelText(this, 0, 0, 'The rift closes', MAGENTA, 1), 9);
    const wave = center(pixelText(this, 0, 0, `Wave ${riftHud.wave}`, GOLD, 2), 23);
    const best = riftHud.newBest ? 'New best!' : `Best ${Math.max(riftHud.best, riftHud.wave)}`;
    const bestText = center(pixelText(this, 0, 0, `${best}  ${riftHud.className}`, riftHud.newBest ? 0x9dffb0 : LAVENDER), 44);
    const stats = center(pixelText(this, 0, 0, `${riftHud.kills} slain  ${riftHud.gems} gems`, 0xe8e0ff), 57);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const d = difficultyDef(riftHud.difficulty);
    if (d.id !== 'normal') {
      // The difficulty it was played on, its mark before its name.
      const icon = difficultyIcon(this, d.id);
      const iconW = this.textures.get(icon).getSourceImage().width;
      const name = pixelText(this, 0, 0, d.name, d.tint);
      const x = Math.round((RESULT_W - iconW - 3 - name.width) / 2);
      parts.push(this.add.image(x, 69, icon).setOrigin(0), name.setPosition(x + iconW + 3, 70));
    }
    const again = new PixelButton(this, 'Again', 64, 20, BUTTON_GOLD, 'rift_again', () => this.leave(true));
    const home = new PixelButton(this, 'Home', 56, 20, BUTTON_PLAIN, 'rift_home', () => this.leave(false));
    home.place(Math.round((RESULT_W - 64 - 56 - 8) / 2), RESULT_H - 30);
    again.place(Math.round((RESULT_W - 64 - 56 - 8) / 2) + 64, RESULT_H - 30);
    this.results = this.add.container(0, 0, [panel, title, wave, bestText, stats, ...parts, home, again]).setAlpha(0);
    this.shade.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.shade, alpha: 1, duration: 400 });
    this.tweens.add({ targets: this.results, alpha: 1, duration: 400 });
    if (riftHud.newBest) sound.ultReady();
    this.layout();
  }

  /** Try again (the same hero, into a fresh rift) or go home. */
  private leave(again: boolean): void {
    if (this.leaving) return;
    this.leaving = true;
    const cams = ['world', 'shade', 'ui', 'rift'].map((k) => this.scene.get(k).cameras.main);
    for (const cam of cams) cam.fadeOut(350, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      releaseControls();
      beamHud.charge = 0;
      beamHud.over = 0;
      beamHud.firing = false;
      comboHud.hits = 0;
      comboHud.window = 0;
      session.paused = false;
      const character = riftHud.cls;
      for (const k of ['world', 'shade', 'ui', 'pause']) this.scene.stop(k);
      if (again) {
        this.scene.launch('shade');
        this.scene.launch('ui', { character });
        this.scene.launch('pause');
        this.scene.start('world', { character, arena: 'rift' });
      } else {
        sound.setFire(0);
        sound.setDaylight(0);
        this.scene.start('home');
      }
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    this.vw = width / this.z;
    this.vh = height / this.z;
    this.shade.setSize(Math.ceil(this.vw) + 1, Math.ceil(this.vh) + 1);
    this.placeHud();
    const n = this.cards.length;
    if (n) {
      const rowW = n * CARD_W + (n - 1) * CARD_GAP;
      const x0 = Math.round((this.vw - rowW) / 2);
      const y0 = Math.round((this.vh - CARD_H) / 2) + 6;
      this.cards.forEach((c, i) => c.box.setPosition(x0 + i * (CARD_W + CARD_GAP), y0));
      this.chooseTitle.setPosition(Math.round((this.vw - this.chooseTitle.width) / 2), y0 - 14);
    }
    this.results?.setPosition(Math.round((this.vw - RESULT_W) / 2), Math.round((this.vh - RESULT_H) / 2));
    this.call?.setX(Math.round(this.vw / 2));
  }
}

/** Break `text` into lines of at most `n` characters, at spaces. */
function wrap(text: string, n: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > n) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
