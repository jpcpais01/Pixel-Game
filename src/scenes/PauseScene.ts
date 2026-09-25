import Phaser from 'phaser';
import { sound } from '../audio';
import { beamHud, comboHud, controls } from '../game/controls';
import { daynight } from '../game/daynight';
import { DPR as D, menuZoom } from '../game/display';
import { settings } from '../game/settings';
import { PixelSlider } from '../ui/slider';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';

const PANEL_W = 172;
const PANEL_H = 166;
const ROW_H = 16;
const CONTROL_X = 86;
const CONTROL_W = 76;

/**
 * The in-game pause button (top right, beside the speaker; Esc or P on a
 * keyboard) and the menu it opens: brightness, music and sound volume, time
 * of day, the FPS counter, graphics quality, and a way back to the home screen. Pausing freezes
 * the world and the touch controls; the frozen world stays on screen, dimmed.
 *
 * The camera works in menu art pixels; the HUD button is drawn in device
 * pixels inside a container scaled back down by the zoom.
 */
export class PauseScene extends Phaser.Scene {
  private z = 2;
  private open = false;
  private leaving = false;
  private pressed = false;
  private hud!: Phaser.GameObjects.Container;
  private button!: Phaser.GameObjects.Graphics;
  private hit!: Phaser.GameObjects.Zone;
  private menu!: Phaser.GameObjects.Container;
  private shade!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.BitmapText;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private controlsRow: (PixelSlider | PixelButton)[] = [];
  private dayButton!: PixelButton;
  private fpsButton!: PixelButton;
  private qualityButton!: PixelButton;
  private resume!: PixelButton;
  private home!: PixelButton;

  constructor() {
    super('pause');
  }

  create(): void {
    this.open = false;
    this.leaving = false;
    this.pressed = false;
    this.cameras.main.setOrigin(0, 0);

    this.button = this.add.graphics();
    this.hit = this.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive({ useHandCursor: true });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.pressed = true;
      this.drawButton();
    });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.pressed = false;
      this.drawButton();
    });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.setOpen(true);
    });
    this.hud = this.add.container(0, 0, [this.button, this.hit]);

    this.buildMenu();

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.setOpen(!this.open));
    kb?.on('keydown-P', () => this.setOpen(!this.open));

    // Leaving the app mid-fight pauses it, so nothing happens unseen.
    const onHidden = () => {
      if (document.hidden) this.setOpen(true);
    };
    document.addEventListener('visibilitychange', onHidden);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHidden);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private buildMenu(): void {
    const v = settings.values;
    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.55).setOrigin(0);
    this.panel = this.add.image(0, 0, panelTexture(this, 'pause', PANEL_W, PANEL_H, PANEL)).setOrigin(0);
    this.title = pixelText(this, 0, 0, 'Paused', 0xf4cf6a, 2);

    const slider = (color: number, value: number, key: 'brightness' | 'music' | 'sfx') =>
      new PixelSlider(this, CONTROL_W, value, color, (x) => settings.set(key, x));
    this.dayButton = new PixelButton(this, '', CONTROL_W, 14, BUTTON_PLAIN, 'pause_toggle', () => daynight.toggle());
    this.fpsButton = new PixelButton(this, '', CONTROL_W, 14, BUTTON_PLAIN, 'pause_toggle', () => {
      // Hidden, then Shown, then Details (the profiler), then Hidden again.
      const { showFps, profiler } = settings.values;
      settings.set('profiler', showFps && !profiler);
      settings.set('showFps', !showFps || !profiler);
    });
    this.qualityButton = new PixelButton(this, '', CONTROL_W, 14, BUTTON_PLAIN, 'pause_toggle', () =>
      settings.set('quality', settings.values.quality === 'fast' ? 'full' : 'fast'),
    );
    const rows: [string, PixelSlider | PixelButton][] = [
      ['Brightness', slider(0xffe08a, v.brightness, 'brightness')],
      ['Music', slider(0x6fe4ff, v.music, 'music')],
      ['Sound FX', slider(0x9dffb0, v.sfx, 'sfx')],
      ['Time of day', this.dayButton],
      ['FPS counter', this.fpsButton],
      ['Graphics', this.qualityButton],
    ];
    this.labels = rows.map(([text]) => pixelText(this, 0, 0, text, 0xb8a8e8));
    this.controlsRow = rows.map(([, c]) => c);

    this.resume = new PixelButton(this, 'Resume', 72, 20, BUTTON_GOLD, 'resume', () => this.setOpen(false));
    this.home = new PixelButton(this, 'Home', 56, 20, BUTTON_PLAIN, 'home', () => this.goHome());

    this.menu = this.add.container(0, 0, [this.shade, this.panel, this.title, ...this.labels, ...this.controlsRow, this.resume, this.home]);
    this.menu.setVisible(false).setAlpha(0);
    this.syncToggles();
  }

  update(): void {
    // The day/night toggle also lives on the HUD and the N key, so keep the label current.
    if (this.open) this.syncToggles();
  }

  private syncToggles(): void {
    this.dayButton.setText(daynight.target > 0.5 ? 'Day' : 'Night');
    this.fpsButton.setText(!settings.values.showFps ? 'Hidden' : settings.values.profiler ? 'Details' : 'Shown');
    this.qualityButton.setText(settings.values.quality === 'fast' ? 'Fast' : 'Full');
  }

  private setOpen(open: boolean): void {
    if (open === this.open || this.leaving) return;
    this.open = open;
    if (open) {
      this.scene.pause('world');
      this.scene.pause('ui');
      releaseControls();
      this.syncToggles();
    } else {
      this.scene.resume('world');
      this.scene.resume('ui');
    }
    this.hud.setVisible(!open);
    for (const b of [this.dayButton, this.fpsButton, this.qualityButton, this.resume, this.home]) b.setEnabled(open);
    this.tweens.killTweensOf(this.menu);
    if (open) this.menu.setVisible(true);
    this.tweens.add({ targets: this.menu, alpha: open ? 1 : 0, duration: 140, onComplete: () => this.menu.setVisible(open) });
  }

  private goHome(): void {
    if (this.leaving) return;
    this.leaving = true;
    const cams = ['world', 'shade', 'ui', 'pause'].map((k) => this.scene.get(k).cameras.main);
    for (const cam of cams) cam.fadeOut(350, 7, 8, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      releaseControls();
      beamHud.charge = 0;
      beamHud.over = 0;
      beamHud.firing = false;
      comboHud.hits = 0;
      comboHud.window = 0;
      // The home screen starts from a quiet dusk, as on first launch.
      sound.setFire(0);
      sound.setDaylight(0);
      for (const k of ['world', 'shade', 'ui']) this.scene.stop(k);
      this.scene.start('home');
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    const vw = width / this.z;
    const vh = height / this.z;

    this.hud.setScale(1 / this.z);
    this.drawButton();

    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    const top = Math.ceil(fpsBottom() / this.z) + 3;
    const px = Math.round((vw - PANEL_W) / 2);
    // Centred, below the FPS counter when there's room.
    const py = Math.min(Math.max(top, Math.round((vh - PANEL_H) / 2)), Math.max(0, Math.floor(vh - PANEL_H - 2)));
    this.panel.setPosition(px, py);
    this.title.setPosition(Math.round(px + (PANEL_W - this.title.width) / 2), py + 9);

    const rowsY = py + 34;
    this.labels.forEach((l, i) => {
      const c = this.controlsRow[i];
      const y = rowsY + i * ROW_H;
      c.place(px + CONTROL_X, y + Math.round((ROW_H - 2 - c.boxH) / 2));
      l.setPosition(px + 10, y + Math.round((ROW_H - 2 - l.height) / 2));
    });

    const by = py + PANEL_H - 30;
    const gap = 8;
    const bx = Math.round(px + (PANEL_W - (this.home.boxW + gap + this.resume.boxW)) / 2);
    this.home.place(bx, by);
    this.resume.place(bx + this.home.boxW + gap, by);
  }

  /** The HUD button, in device pixels: matches the speaker button and sits just left of it. */
  private drawButton(): void {
    const s = Math.round(Math.max(34 * D, Math.min(this.scale.width, this.scale.height) * 0.075));
    const pad = 12 * D;
    const x = this.scale.width - s * 2 - pad - 10 * D;
    const y = pad;
    this.hit.setPosition(x - 6 * D, y - 6 * D).setSize(s + 12 * D, s + 12 * D);
    this.hit.input!.hitArea.setTo(0, 0, s + 12 * D, s + 12 * D);

    const g = this.button.clear();
    g.fillStyle(0x0a0c1c, this.pressed ? 0.6 : 0.42);
    g.fillRoundedRect(x, y, s, s, s * 0.22);
    g.lineStyle(2 * D, 0xb8c4ff, 0.45);
    g.strokeRoundedRect(x, y, s, s, s * 0.22);
    const u = s / 24;
    g.fillStyle(0xdfe6ff, 0.9);
    g.fillRoundedRect(x + s / 2 - 6 * u, y + s / 2 - 7 * u, 4 * u, 14 * u, u);
    g.fillRoundedRect(x + s / 2 + 2 * u, y + s / 2 - 7 * u, 4 * u, 14 * u, u);
  }
}

/** Let go of every held control, so nothing stays pressed across a pause. */
function releaseControls(): void {
  controls.moveX = 0;
  controls.moveY = 0;
  controls.attack = false;
  controls.beam = false;
  controls.click = false;
  sound.beamChargeEnd();
}
