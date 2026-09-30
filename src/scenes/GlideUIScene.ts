import Phaser from 'phaser';
import { sound } from '../audio';
import { controls } from '../game/controls';
import { DPR as D, menuZoom } from '../game/display';
import { fmtTime, glideHud, glideInput } from '../game/glide';
import { CHECKPOINTS, START_Z, progressOf } from '../world/glideLayout';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { GlideScene } from './GlideScene';

const PANEL_W = 168;
const PANEL_H = 128;
/** The altimeter's height, and the height it reads at the top. */
const ALT_H = 72;
const ALT_TOP = START_Z + 30;
/** The progress bar's width along the top. */
const BAR_W = 128;

/**
 * Sky Glide's HUD: the run's time and best at the top with a bar of how far
 * down the course (and where the ghost is), an altimeter on the left, the
 * countdown, the rings caught, and at the end the results (or the race's
 * standings online) with Retry and Home. Online, before the race, the room's
 * lobby, where the host starts it.
 *
 * Touch controls: a floating stick on the left half (sideways to steer,
 * pull back to flare, push to speed up) and a Dive button on the right.
 * On a computer: A/D (or arrows) to steer, W to flare, S to speed up, Space
 * to dive.
 *
 * The camera works in menu art pixels; the touch controls are drawn in
 * device pixels in a container scaled back down by the zoom.
 */
export class GlideUIScene extends Phaser.Scene {
  private z = 2;
  private touch!: Phaser.GameObjects.Container;
  private stick!: Phaser.GameObjects.Graphics;
  private diveBtn!: Phaser.GameObjects.Graphics;
  private diveLabel!: Phaser.GameObjects.BitmapText;
  private stickPointer: number | null = null;
  private divePointer: number | null = null;
  private base = new Phaser.Math.Vector2();
  private knob = new Phaser.Math.Vector2();
  private timer!: Phaser.GameObjects.BitmapText;
  private bestText!: Phaser.GameObjects.BitmapText;
  private ringText!: Phaser.GameObjects.BitmapText;
  private bar!: Phaser.GameObjects.Graphics;
  private alt!: Phaser.GameObjects.Graphics;
  private altLabel!: Phaser.GameObjects.BitmapText;
  private count!: Phaser.GameObjects.BitmapText;
  private toastText!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private panel!: Phaser.GameObjects.Container;
  private panelBg!: Phaser.GameObjects.Image;
  private panelTitle!: Phaser.GameObjects.BitmapText;
  private panelLines: Phaser.GameObjects.BitmapText[] = [];
  private again!: PixelButton;
  private home!: PixelButton;
  private shownPhase = '';
  /** What the panel last showed, so it's only laid out again when that changes. */
  private panelKey = '';
  private shownCount = -1;
  private leaving = false;
  private drawn = new Map<Phaser.GameObjects.Graphics, string>();

  constructor() {
    super('glideui');
  }

  private get R(): number {
    return Math.max(42 * D, Math.min(this.scale.width, this.scale.height) * 0.13);
  }

  private get restPos(): Phaser.Math.Vector2 {
    const R = this.R;
    return new Phaser.Math.Vector2(R * 2.4, this.scale.height - R * 1.45);
  }

  private get divePos(): Phaser.Math.Vector2 {
    const R = this.R;
    return new Phaser.Math.Vector2(this.scale.width - R * 2.1, this.scale.height - R * 1.45);
  }

  create(): void {
    this.leaving = false;
    this.shownPhase = '';
    this.panelKey = '';
    this.shownCount = -1;
    this.stickPointer = this.divePointer = null;
    this.drawn.clear();
    this.cameras.main.setOrigin(0, 0);

    this.stick = this.add.graphics();
    this.diveBtn = this.add.graphics();
    this.diveLabel = this.add.bitmapText(0, 0, 'pixel', 'DIVE').setLetterSpacing(-1).setOrigin(0.5).setTint(0xdff4ff);
    this.touch = this.add.container(0, 0, [this.stick, this.diveBtn, this.diveLabel]);

    this.timer = pixelText(this, 0, 0, '0:00.00', 0xfff4d6, 2);
    this.bestText = pixelText(this, 0, 0, '', 0xb8c4ff);
    this.ringText = pixelText(this, 0, 0, '', 0xffe08a);
    this.bar = this.add.graphics();
    this.alt = this.add.graphics();
    this.altLabel = pixelText(this, 0, 0, 'ALT', 0xb8c4ff);
    this.count = pixelText(this, 0, 0, '', 0xfff4d6, 6);
    this.toastText = pixelText(this, 0, 0, '', 0xfff4d6, 3);
    this.hint = pixelText(this, 0, 0, '', 0xdfe6ff);

    this.panelBg = this.add.image(0, 0, panelTexture(this, 'glide_panel', PANEL_W, PANEL_H, PANEL)).setOrigin(0);
    this.panelTitle = pixelText(this, 0, 0, '', 0xf4cf6a, 2);
    this.panelLines = Array.from({ length: 5 }, () => pixelText(this, 0, 0, '', 0xdfe6ff));
    this.again = new PixelButton(this, 'Retry', 76, 20, BUTTON_GOLD, 'glide_again', () => this.onAgain());
    this.home = new PixelButton(this, 'Home', 56, 20, BUTTON_PLAIN, 'glide_home', () => this.goHome());
    this.panel = this.add.container(0, 0, [this.panelBg, this.panelTitle, ...this.panelLines, this.again, this.home]).setVisible(false);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      controls.mouse = !p.wasTouch;
      if (!p.wasTouch || this.panel.visible) return;
      const dp = this.divePos;
      if (this.divePointer === null && Phaser.Math.Distance.Between(p.x, p.y, dp.x, dp.y) < this.R * 1.1) {
        this.divePointer = p.id;
        glideInput.dive = true;
      } else if (p.x < this.scale.width * 0.55 && this.stickPointer === null) {
        this.stickPointer = p.id;
        this.base.set(p.x, p.y);
        this.knob.set(p.x, p.y);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointer) return;
      const R = this.R;
      const v = new Phaser.Math.Vector2(p.x - this.base.x, p.y - this.base.y);
      if (v.length() > R) v.setLength(R);
      this.knob.set(this.base.x + v.x, this.base.y + v.y);
      const m = v.length() / R;
      const dead = 0.12;
      const s = m < dead ? 0 : (m - dead) / (1 - dead) / (m || 1);
      glideInput.mx = (v.x / R) * s;
      glideInput.my = (v.y / R) * s;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointer) {
        this.stickPointer = null;
        glideInput.mx = glideInput.my = 0;
      }
      if (p.id === this.divePointer) {
        this.divePointer = null;
        glideInput.dive = false;
      }
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.events.on(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.events.off(Phaser.Scenes.Events.PAUSE, this.releaseAll, this);
      this.releaseAll();
    });
  }

  private releaseAll(): void {
    this.stickPointer = this.divePointer = null;
    glideInput.mx = glideInput.my = 0;
    glideInput.dive = false;
  }

  private get world(): GlideScene {
    return this.scene.get('glide') as GlideScene;
  }

  private onAgain(): void {
    if (glideHud.phase === 'lobby') this.world.startRace();
    else this.world.retry();
  }

  private goHome(): void {
    if (this.leaving) return;
    this.leaving = true;
    const cams = ['glide', 'shade', 'glideui', 'pause'].map((k) => this.scene.get(k).cameras.main);
    for (const cam of cams) cam.fadeOut(350, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.releaseAll();
      sound.setDaylight(0);
      for (const k of ['glide', 'shade', 'pause']) this.scene.stop(k);
      this.scene.start('home');
    });
  }

  update(time: number): void {
    const h = glideHud;
    const vw = this.scale.width / this.z;
    const vh = this.scale.height / this.z;

    // The time, flashing red for a moment after a fall's penalty.
    this.timer.setText(fmtTime(h.time)).setTint(h.penalty > 0 && Math.floor(h.penalty / 120) % 2 ? 0xff7a7a : 0xfff4d6);
    this.timer.setPosition(Math.round((vw - this.timer.width) / 2), this.topY);
    this.bestText.setText(h.best ? `BEST ${fmtTime(h.best)}` : 'NO BEST YET');
    this.bestText.setPosition(Math.round((vw - this.bestText.width) / 2), this.topY + 16);
    this.ringText.setText(`RINGS ${h.rings}/${h.ringsTotal}`);
    this.ringText.setPosition(Math.round((vw - this.ringText.width) / 2), this.topY + 34);
    this.drawBar(vw);
    this.drawAlt(vh, time);

    // The countdown: each number drops in big, then GO.
    const counting = h.phase === 'count';
    this.count.setVisible(counting);
    if (counting) {
      if (h.count !== this.shownCount) {
        this.shownCount = h.count;
        this.count.setText(h.count > 0 ? String(h.count) : '');
        this.count.setScale(8).setAlpha(0.2);
        this.tweens.add({ targets: this.count, scale: 6, alpha: 1, duration: 220, ease: 'Back.easeOut' });
      }
      this.count.setPosition(Math.round((vw - this.count.width) / 2), Math.round(vh * 0.36 - this.count.height / 2));
    } else this.shownCount = -1;

    const t = h.toastT > 0 ? h.toast : '';
    this.toastText.setVisible(!!t).setText(t).setAlpha(Math.min(1, h.toastT / 250));
    this.toastText.setPosition(Math.round((vw - this.toastText.width) / 2), Math.round(vh * 0.24));

    // How to fly, until the run gets going.
    const touchUI = !controls.mouse;
    const hint = h.phase === 'count' || h.phase === 'lobby' || (h.phase === 'fly' && h.time < 4500) ? (touchUI ? 'STICK TO STEER  PULL BACK TO FLARE  HOLD DIVE' : 'A/D STEER  W FLARE  S SPEED  SPACE DIVE') : '';
    this.hint.setText(hint).setVisible(!!hint);
    this.hint.setPosition(Math.round((vw - this.hint.width) / 2), Math.round(vh - (touchUI ? 12 : 16)));

    if (h.phase !== this.shownPhase || h.phase === 'done' || h.phase === 'lobby') this.showPanel();
    this.drawTouch(touchUI && h.phase !== 'done' && h.phase !== 'lobby');
  }

  private get topY(): number {
    return Math.max(4, Math.ceil(fpsBottom() / this.z) + 2);
  }

  /** How far down the course, with the beacons marked and the ghost's place. */
  private drawBar(vw: number): void {
    const h = glideHud;
    const x = Math.round((vw - BAR_W) / 2);
    const y = this.topY + 27;
    const state = `${x} ${y} ${h.progress.toFixed(3)} ${h.ghost.toFixed(3)}`;
    const g = this.redraw(this.bar, state);
    if (!g) return;
    g.fillStyle(0x0a0c1c, 0.55);
    g.fillRect(x - 1, y - 1, BAR_W + 2, 5);
    g.fillStyle(0x6fe4ff, 0.9);
    g.fillRect(x, y, Math.round(BAR_W * h.progress), 3);
    g.fillStyle(0xffe08a, 1);
    for (const c of CHECKPOINTS.slice(1)) g.fillRect(x + Math.round(BAR_W * progressOf(c.y)), y - 2, 1, 7);
    if (h.ghost >= 0) {
      g.fillStyle(0xbfe6ff, 0.9);
      g.fillRect(x + Math.round(BAR_W * h.ghost) - 1, y - 2, 3, 7);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(x + Math.round(BAR_W * h.progress) - 1, y - 3, 3, 9);
  }

  /** The altimeter: a column that empties as the glider sinks, red and blinking when it's low over open sky. */
  private drawAlt(vh: number, time: number): void {
    const h = glideHud;
    const x = 10;
    const y = Math.round(vh / 2 - ALT_H / 2);
    const k = Math.max(0, Math.min(1, h.z / ALT_TOP));
    const blink = h.low && Math.floor(time / 180) % 2 === 0;
    this.altLabel.setPosition(x - 2, y - 10).setTint(h.low ? 0xff8a8a : 0xb8c4ff);
    const g = this.redraw(this.alt, `${y} ${Math.round(k * ALT_H)} ${blink} ${h.low} ${h.diving}`);
    if (!g) return;
    g.fillStyle(0x0a0c1c, 0.55);
    g.fillRect(x - 1, y - 1, 8, ALT_H + 2);
    const fill = Math.round(k * ALT_H);
    g.fillStyle(h.low ? (blink ? 0xff5a5a : 0xc03a4a) : h.diving ? 0xffd66b : 0x6fe4ff, 0.95);
    g.fillRect(x + 1, y + ALT_H - fill, 4, fill);
    // Ticks every quarter.
    g.fillStyle(0xdfe6ff, 0.5);
    for (let i = 1; i < 4; i++) g.fillRect(x - 1, y + Math.round((ALT_H * i) / 4), 2, 1);
  }

  /** The results at the end, or the lobby before an online race. */
  private showPanel(): void {
    const h = glideHud;
    this.shownPhase = h.phase;
    const on = h.phase === 'done' || h.phase === 'lobby';
    this.panel.setVisible(on);
    this.home.setEnabled(on);
    if (!on) {
      this.again.setEnabled(false);
      this.panelKey = '';
      return;
    }
    if (on && (this.stickPointer !== null || this.divePointer !== null)) this.releaseAll();
    const lines: [string, number][] = [];
    let title = '';
    let againText = 'Retry';
    let again = true;
    if (h.phase === 'lobby') {
      title = h.code ? `ROOM ${h.code}` : 'SKY RACE';
      h.players.forEach((p, i) => lines.push([`${i === 0 ? '> ' : '  '}${p}`, i === 0 ? 0xffe08a : 0xdfe6ff]));
      if (h.players.length < 2) lines.push(['SEND FRIENDS THE CODE', 0x9a90c8]);
      againText = 'Start race';
      again = h.host;
      if (!h.host) lines.push(['WAITING FOR THE HOST', 0x9a90c8]);
    } else if (h.online && h.results.length) {
      title = 'STANDINGS';
      h.results.slice(0, 4).forEach((r, i) => lines.push([`${i + 1}. ${r.name.slice(0, 10)}  ${r.ms === null ? 'FLYING' : fmtTime(r.ms)}`, r.me ? 0xffe08a : 0xdfe6ff]));
      againText = 'Race again';
      again = h.host;
      if (!h.host) lines.push(['THE HOST STARTS THE NEXT', 0x9a90c8]);
    } else {
      title = h.newBest ? 'NEW BEST!' : 'TOUCHDOWN!';
      lines.push([`TIME   ${fmtTime(h.time)}`, 0xfff4d6]);
      lines.push([`BEST   ${fmtTime(h.best)}`, h.newBest ? 0xffe08a : 0xb8c4ff]);
      lines.push([`RINGS  ${h.rings}/${h.ringsTotal}`, 0xffe08a]);
    }
    const key = `${title}|${lines.map((l) => l[0]).join('|')}|${againText}|${again}`;
    if (key === this.panelKey) return;
    this.panelKey = key;
    this.panelTitle.setText(title).setTint(h.newBest && h.phase === 'done' ? 0xffe08a : 0xf4cf6a);
    this.panelLines.forEach((l, i) => {
      const line = lines[i];
      l.setVisible(!!line);
      if (line) l.setText(line[0]).setTint(line[1]);
    });
    this.again.setText(againText).setVisible(again).setEnabled(again);
    this.layout();
  }

  /** The stick and the Dive button, drawn only when they change. */
  private drawTouch(show: boolean): void {
    this.touch.setVisible(show);
    if (!show) return;
    const R = this.R;
    const active = this.stickPointer !== null;
    const g = this.redraw(this.stick, `${active} ${this.base.x} ${this.base.y} ${this.knob.x} ${this.knob.y} ${R}`);
    if (!active) {
      this.base.copy(this.restPos);
      this.knob.copy(this.restPos);
    }
    if (g) {
      g.fillStyle(0x0a0c1c, active ? 0.45 : 0.28);
      g.fillCircle(this.base.x, this.base.y, R);
      g.lineStyle(2 * D, 0xb8c4ff, active ? 0.45 : 0.22);
      g.strokeCircle(this.base.x, this.base.y, R);
      g.fillStyle(0xdfe6ff, active ? 0.55 : 0.3);
      g.fillCircle(this.knob.x, this.knob.y, R * 0.42);
      g.lineStyle(2 * D, 0xffffff, active ? 0.5 : 0.2);
      g.strokeCircle(this.knob.x, this.knob.y, R * 0.42);
    }
    const dp = this.divePos;
    const held = this.divePointer !== null;
    const r = R * (held ? 0.8 : 0.86);
    const b = this.redraw(this.diveBtn, `${held} ${dp.x} ${dp.y} ${r}`);
    if (b) {
      b.fillStyle(0x0c1433, held ? 0.78 : 0.55);
      b.fillCircle(dp.x, dp.y, r);
      b.lineStyle(3 * D, 0x6fe4ff, held ? 0.95 : 0.65);
      b.strokeCircle(dp.x, dp.y, r);
      // A wing over a downward arrow.
      const u = r / 12;
      b.fillStyle(0xdff4ff, held ? 1 : 0.85);
      b.fillTriangle(dp.x - 7 * u, dp.y - 4 * u, dp.x + 7 * u, dp.y - 4 * u, dp.x, dp.y - 7 * u);
      b.fillRect(dp.x - u, dp.y - 3 * u, 2 * u, 5 * u);
      b.fillTriangle(dp.x - 4 * u, dp.y + 2 * u, dp.x + 4 * u, dp.y + 2 * u, dp.x, dp.y + 6 * u);
    }
    this.diveLabel.setPosition(dp.x, dp.y + r + 10 * D).setScale(Math.max(1, Math.round(R / 30)));
  }

  private redraw(g: Phaser.GameObjects.Graphics, state: string): Phaser.GameObjects.Graphics | null {
    if (this.drawn.get(g) === state) return null;
    this.drawn.set(g, state);
    return g.clear();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    this.touch.setScale(1 / this.z);
    this.drawn.clear();
    const vw = width / this.z;
    const vh = height / this.z;
    const px = Math.round((vw - PANEL_W) / 2);
    const py = Math.round(Math.max(this.topY + 46, (vh - PANEL_H) / 2 + 10));
    this.panelBg.setPosition(px, py);
    this.panelTitle.setPosition(Math.round(px + (PANEL_W - this.panelTitle.width) / 2), py + 9);
    this.panelLines.forEach((l, i) => l.setPosition(px + 14, py + 34 + i * 12));
    const by = py + PANEL_H - 28;
    const gap = 8;
    const againW = this.again.visible ? this.again.boxW + gap : 0;
    const bx = Math.round(px + (PANEL_W - (this.home.boxW + againW)) / 2);
    this.home.place(bx, by);
    this.again.place(bx + this.home.boxW + gap, by);
  }
}
