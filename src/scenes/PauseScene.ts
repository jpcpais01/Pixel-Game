import Phaser from 'phaser';
import { sound } from '../audio';
import { beamHud, comboHud, controls } from '../game/controls';
import { daynight } from '../game/daynight';
import { DPR as D, menuZoom } from '../game/display';
import { settings, type Settings } from '../game/settings';
import { session } from '../net/session';
import { DAY_PICKER_H, DayPicker } from '../ui/dayPicker';
import { PixelSlider } from '../ui/slider';
import { statsCard } from '../ui/statsHud';
import { menuIcon, ornatePanel } from '../ui/menuArt';
import { PixelCycler, PixelSwitch, PointerPicker, type MenuControl } from '../ui/optionWidgets';
import { hasMouse } from '../ui/pointer';
import { BUTTON_GOLD, BUTTON_PLAIN, PixelButton, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';

const PANEL_W = 212;
/** The header band with the title; a gold rule runs along its foot. */
const HEAD = 27;
const ROW_H = 16;
/** The time of day's row, under the title in arenas with day and night: its height with the room round it. */
const DAY_ROW = DAY_PICKER_H + 6;
/** The groove between the sound rows and the display rows. */
const GROUP_GAP = 6;
/** The gold rule, the buttons and the room under them. */
const FOOT = 36;
const LABEL_X = 24;
const CONTROL_W = 88;
const BUTTON_H = 20;
/** More options, the small panel over the menu. */
const MORE_W = 192;
/** More options' controls, all in one column. */
const MORE_CONTROL_W = 76;
const MORE_HEAD = 23;

/** The FPS counter's three states, in the order its arrows step through them. */
const FPS_STATES = ['Hidden', 'Shown', 'Details'];
const QUALITIES: Settings['quality'][] = ['full', 'fast', 'low'];
const ZOOMS: Settings['zoom'][] = ['far', 'normal', 'close'];
const step = <T>(list: T[], now: T, dir: number): T => list[(list.indexOf(now) + dir + list.length) % list.length];

interface Row {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.BitmapText;
  control: PixelSlider | MenuControl;
}

/**
 * The in-game pause button (top right, beside the speaker; Esc or P on a
 * keyboard) and the menu it opens: the time of day (in arenas that have
 * one), music and sound volume, brightness, graphics quality, the FPS
 * counter and the minimap, then Home, More options and Resume. More options
 * is a small panel over the menu with screen shake, the zoom and, on a
 * computer, the mouse pointer. Pausing freezes the world and the touch
 * controls; the frozen world stays on screen, dimmed.
 *
 * The camera works in menu art pixels; the HUD button is drawn in device
 * pixels inside a container scaled back down by the zoom.
 */
export class PauseScene extends Phaser.Scene {
  private z = 2;
  private open = false;
  private moreOpen = false;
  private leaving = false;
  private pressed = false;
  private hud!: Phaser.GameObjects.Container;
  private button!: Phaser.GameObjects.Graphics;
  private hit!: Phaser.GameObjects.Zone;
  private menu!: Phaser.GameObjects.Container;
  private shade!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.BitmapText;
  private rows: Row[] = [];
  private dayPicker!: DayPicker;
  private fpsCycler!: PixelCycler;
  private qualityCycler!: PixelCycler;
  private minimapSwitch!: PixelSwitch;
  private resume!: PixelButton;
  private more!: PixelButton;
  private home!: PixelButton;
  // More options.
  private morePanel!: Phaser.GameObjects.Container;
  private moreShade!: Phaser.GameObjects.Rectangle;
  private moreBack!: Phaser.GameObjects.Image;
  private moreTitle!: Phaser.GameObjects.BitmapText;
  private moreRows: Row[] = [];
  private shakeSwitch!: PixelSwitch;
  private zoomCycler!: PixelCycler;
  private picker: PointerPicker | null = null;
  private pickerRow: Row | null = null;
  private done!: PixelButton;
  private moreTween: Phaser.Tweens.Tween | null = null;
  /** The scene played in and its HUD: the world's, or a mode's own (Sky Glide). */
  private worldKey = 'world';
  private uiKey = 'ui';

  constructor() {
    super('pause');
  }

  create(data?: { world?: string; ui?: string }): void {
    this.worldKey = data?.world ?? 'world';
    this.uiKey = data?.ui ?? 'ui';
    this.open = false;
    this.moreOpen = false;
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
    this.buildMore();
    this.syncToggles();

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => {
      // Esc first closes the hero's "i" card, if it is open (ui/statsHud.ts), and More options before the menu.
      if (statsCard.open && !this.open) statsCard.close();
      else if (this.moreOpen) this.setMore(false);
      else this.setOpen(!this.open);
    });
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

  private row(icon: string, text: string, control: PixelSlider | MenuControl): Row {
    return { icon: this.add.image(0, 0, menuIcon(this, icon)).setOrigin(0), label: pixelText(this, 0, 0, text, 0xc8b8f0), control };
  }

  private buildMenu(): void {
    const v = settings.values;
    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.55).setOrigin(0);
    this.panel = this.add.image(0, 0, '__WHITE').setOrigin(0);
    this.title = pixelText(this, 0, 0, 'Paused', 0xf4cf6a, 2);

    const slider = (color: number, value: number, key: 'brightness' | 'music' | 'sfx') =>
      new PixelSlider(this, CONTROL_W, value, color, (x) => settings.set(key, x));
    this.dayPicker = new DayPicker(this);
    this.fpsCycler = new PixelCycler(this, CONTROL_W, (dir) => {
      // Hidden, then Shown, then Details (the profiler), round again either way.
      const { showFps, profiler } = settings.values;
      const now = !showFps ? 0 : profiler ? 2 : 1;
      const next = (now + dir + 3) % 3;
      settings.set('profiler', next === 2);
      settings.set('showFps', next > 0);
    });
    // Full, then Fast, then Low (drawn at art resolution).
    this.qualityCycler = new PixelCycler(this, CONTROL_W, (dir) => settings.set('quality', step(QUALITIES, settings.values.quality, dir)));
    this.minimapSwitch = new PixelSwitch(this, CONTROL_W, v.minimap, (on) => settings.set('minimap', on));
    this.rows = [
      this.row('music', 'Music', slider(0x6fe4ff, v.music, 'music')),
      this.row('sfx', 'Sound FX', slider(0x9dffb0, v.sfx, 'sfx')),
      this.row('bright', 'Brightness', slider(0xffe08a, v.brightness, 'brightness')),
      this.row('gfx', 'Graphics', this.qualityCycler),
      this.row('fps', 'FPS counter', this.fpsCycler),
      this.row('map', 'Minimap', this.minimapSwitch),
    ];

    this.resume = new PixelButton(this, 'Resume', 58, BUTTON_H, BUTTON_GOLD, 'resume', () => this.setOpen(false));
    this.more = new PixelButton(this, 'More options', 82, BUTTON_H, BUTTON_PLAIN, 'more', () => this.setMore(true));
    this.home = new PixelButton(this, 'Home', 42, BUTTON_H, BUTTON_PLAIN, 'home', () => this.goHome());

    const parts = this.rows.flatMap((r) => [r.icon, r.label, r.control]);
    this.menu = this.add.container(0, 0, [this.shade, this.panel, this.title, this.dayPicker, ...parts, this.home, this.more, this.resume]);
    this.menu.setVisible(false).setAlpha(0);
  }

  /** More options: screen shake, zoom and (with a mouse) the pointer, on a small panel over the menu. */
  private buildMore(): void {
    // Dims the menu under it, and a tap anywhere off the panel closes it.
    this.moreShade = this.add.rectangle(0, 0, 1, 1, 0x0b0818, 0.45).setOrigin(0).setInteractive();
    this.moreShade.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setMore(false));
    // The panel takes its own taps, so they don't fall through to the shade.
    this.moreBack = this.add.image(0, 0, '__WHITE').setOrigin(0).setInteractive();
    this.moreTitle = pixelText(this, 0, 0, 'More options', 0xf4cf6a);
    this.shakeSwitch = new PixelSwitch(this, MORE_CONTROL_W, settings.values.shake, (on) => settings.set('shake', on));
    // Far, then Normal, then Close: how much of the world fits on screen.
    this.zoomCycler = new PixelCycler(this, MORE_CONTROL_W, (dir) => settings.set('zoom', step(ZOOMS, settings.values.zoom, dir)));
    this.moreRows = [this.row('shake', 'Screen shake', this.shakeSwitch), this.row('zoom', 'Zoom', this.zoomCycler)];
    // The pointer only means something with a mouse.
    if (hasMouse) {
      this.picker = new PointerPicker(this, settings.values.pointer, (def) => settings.set('pointer', def.id));
      this.pickerRow = { icon: this.add.image(0, 0, menuIcon(this, 'pointer')).setOrigin(0), label: pixelText(this, 0, 0, 'Pointer', 0xc8b8f0), control: this.picker };
    }
    this.done = new PixelButton(this, 'Done', 56, 18, BUTTON_GOLD, 'more_done', () => this.setMore(false));
    const rows = [...this.moreRows, ...(this.pickerRow ? [this.pickerRow] : [])];
    this.morePanel = this.add.container(0, 0, [this.moreShade, this.moreBack, this.moreTitle, ...rows.flatMap((r) => [r.icon, r.label, r.control]), this.done]);
    this.morePanel.setVisible(false).setAlpha(0);
    this.setMoreEnabled(false);
  }

  update(_time: number, delta: number): void {
    // The time of day also turns by itself and by the N key, so keep the picker current.
    if (this.open) {
      this.syncToggles();
      this.dayPicker.update(delta);
      if (this.moreOpen) this.picker?.update(delta);
    }
  }

  private syncToggles(): void {
    const v = settings.values;
    this.fpsCycler.setText(FPS_STATES[!v.showFps ? 0 : v.profiler ? 2 : 1]);
    this.qualityCycler.setText({ full: 'Full', fast: 'Fast', low: 'Low' }[v.quality]);
    this.minimapSwitch.setOn(v.minimap);
    this.zoomCycler.setText({ far: 'Far', normal: 'Normal', close: 'Close' }[v.zoom]);
    this.shakeSwitch.setOn(v.shake);
    this.picker?.sync(v.pointer);
  }

  private setOpen(open: boolean): void {
    if (open === this.open || this.leaving) return;
    this.open = open;
    // Online the fight goes on for the others: the world keeps running and the hero just stands.
    const online = session.active;
    session.paused = open && online;
    if (open) {
      if (!online) {
        this.scene.pause(this.worldKey);
        this.scene.pause(this.uiKey);
      }
      releaseControls();
      this.syncToggles();
      // Online, the room's code heads the menu, for sharing with friends.
      this.title.setText((session.room ? `Room ${session.room.code}` : 'Paused').toUpperCase());
      this.layout();
    } else if (!online) {
      this.scene.resume(this.worldKey);
      this.scene.resume(this.uiKey);
    }
    if (!open) this.setMore(false, true);
    this.hud.setVisible(!open);
    this.dayPicker.setEnabled(open && daynight.enabled);
    for (const b of [this.fpsCycler, this.qualityCycler, this.minimapSwitch, this.resume, this.more, this.home]) b.setEnabled(open);
    this.tweens.killTweensOf(this.menu);
    if (open) this.menu.setVisible(true);
    this.tweens.add({ targets: this.menu, alpha: open ? 1 : 0, duration: 140, onComplete: () => this.menu.setVisible(open) });
  }

  /** Open or close More options; `now` skips the fade (the whole menu is closing). */
  private setMore(open: boolean, now = false): void {
    if (open === this.moreOpen) return;
    if (open && (!this.open || this.leaving)) return;
    this.moreOpen = open;
    this.setMoreEnabled(open);
    // The menu under it waits.
    for (const b of [this.fpsCycler, this.qualityCycler, this.minimapSwitch, this.resume, this.more, this.home]) b.setEnabled(!open && this.open);
    this.dayPicker.setEnabled(!open && this.open && daynight.enabled);
    this.moreTween?.stop();
    this.moreTween = null;
    if (now) {
      this.morePanel.setVisible(open).setAlpha(open ? 1 : 0).setY(0);
      return;
    }
    if (open) {
      this.syncToggles();
      this.morePanel.setVisible(true);
    }
    // It rises a few pixels into place as it fades in, whole pixels at a time.
    const from = this.morePanel.alpha;
    this.moreTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 140,
      ease: 'Cubic.Out',
      onUpdate: (t) => {
        const a = from + ((open ? 1 : 0) - from) * t.getValue()!;
        this.morePanel.setAlpha(a).setY(Math.round((1 - a) * 6));
      },
      onComplete: () => this.morePanel.setVisible(open),
    });
  }

  private setMoreEnabled(on: boolean): void {
    if (this.moreShade.input) this.moreShade.input.enabled = on;
    if (this.moreBack.input) this.moreBack.input.enabled = on;
    for (const c of [this.shakeSwitch, this.zoomCycler, this.done]) c.setEnabled(on);
    this.picker?.setEnabled(on);
  }

  private goHome(): void {
    if (this.leaving) return;
    this.leaving = true;
    const cams = [this.worldKey, 'shade', this.uiKey, 'pause'].map((k) => this.scene.get(k).cameras.main);
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
      session.paused = false;
      for (const k of [this.worldKey, 'shade', this.uiKey]) this.scene.stop(k);
      this.scene.start('home');
    });
  }

  /** The menu's height, with or without the time of day. */
  private panelH(day: boolean): number {
    return HEAD + 5 + (day ? DAY_ROW : 0) + this.rows.length * ROW_H + GROUP_GAP + FOOT;
  }

  /** More options' height. */
  private moreH(): number {
    return MORE_HEAD + 5 + this.moreRows.length * ROW_H + (this.picker ? ROW_H + this.picker.boxH + 4 : 0) + 30;
  }

  /** Put a row's icon, label and control across a panel from its left edge `px`, the control ending `right` px in. */
  private placeRow(r: Row, px: number, y: number, right: number): void {
    const c = r.control;
    c.place(px + right - c.boxW, y + Math.round((ROW_H - 2 - c.boxH) / 2));
    r.icon.setPosition(px + 11, y + Math.round((ROW_H - 2 - 9) / 2));
    r.label.setPosition(px + LABEL_X, y + Math.round((ROW_H - 2 - r.label.height) / 2));
  }

  private layout(): void {
    const { width, height } = this.scale;
    // Arenas without day and night keep their own light: no picker, a shorter panel.
    const day = daynight.enabled;
    const ph = this.panelH(day);
    this.z = menuZoom(width, height);
    // A short screen draws the menu a size smaller rather than cut its foot off.
    while (this.z > 1 && height / this.z < Math.max(ph, this.moreH()) + 4) this.z--;
    this.cameras.main.setZoom(this.z);
    const vw = width / this.z;
    const vh = height / this.z;

    this.hud.setScale(1 / this.z);
    this.drawButton();

    this.shade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    const top = Math.ceil(fpsBottom() / this.z) + 3;
    const px = Math.round((vw - PANEL_W) / 2);
    // Centred, below the FPS counter when there's room.
    const py = Math.min(Math.max(top, Math.round((vh - ph) / 2)), Math.max(0, Math.floor(vh - ph - 2)));

    let y = HEAD + 5;
    if (day) {
      this.dayPicker.place(px + Math.round((PANEL_W - this.dayPicker.boxW) / 2), py + y + 1);
      y += DAY_ROW;
    }
    this.dayPicker.setVisible(day);
    const dividers = [{ y: HEAD, gold: true }, { y: ph - FOOT + 4, gold: true }];
    this.rows.forEach((r, i) => {
      // The sound rows, a groove, then the display rows.
      if (i === 2) {
        dividers.push({ y: y + Math.floor(GROUP_GAP / 2) - 2, gold: false });
        y += GROUP_GAP;
      }
      this.placeRow(r, px, py + y, PANEL_W - 11);
      y += ROW_H;
    });
    this.panel.setTexture(ornatePanel(this, 'pause', PANEL_W, ph, HEAD, dividers)).setPosition(px, py);
    this.title.setPosition(Math.round(px + (PANEL_W - this.title.width) / 2), py + 7);

    const by = py + ph - FOOT + 9;
    const gap = 6;
    const buttons = [this.home, this.more, this.resume];
    let bx = Math.round(px + (PANEL_W - buttons.reduce((w, b) => w + b.boxW, 0) - gap * (buttons.length - 1)) / 2);
    for (const b of buttons) {
      b.place(bx, by);
      bx += b.boxW + gap;
    }

    this.layoutMore(vw, vh, py + Math.round(ph / 2));
  }

  /** More options, centred on the menu (`cy`) but kept on screen. */
  private layoutMore(vw: number, vh: number, cy: number): void {
    const mh = this.moreH();
    const mx = Math.round((vw - MORE_W) / 2);
    const my = Math.max(1, Math.min(Math.round(cy - mh / 2), Math.floor(vh - mh - 1)));
    this.moreShade.setSize(Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    this.moreShade.input?.hitArea.setTo(0, 0, Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    const dividers = [{ y: MORE_HEAD, gold: true }];
    let y = MORE_HEAD + 5;
    for (const r of this.moreRows) {
      this.placeRow(r, mx, my + y, MORE_W - 11);
      y += ROW_H;
    }
    if (this.picker && this.pickerRow) {
      dividers.push({ y: y + 1, gold: false });
      y += 4;
      const r = this.pickerRow;
      r.icon.setPosition(mx + 11, my + y + 2);
      r.label.setPosition(mx + LABEL_X, my + y + Math.round((ROW_H - 2 - r.label.height) / 2));
      y += ROW_H - 2;
      this.picker.place(mx + Math.round((MORE_W - this.picker.boxW) / 2), my + y);
    }
    const back = ornatePanel(this, 'more', MORE_W, mh, MORE_HEAD, dividers);
    this.moreBack.setTexture(back).setPosition(mx, my);
    this.moreBack.input?.hitArea.setTo(0, 0, MORE_W, mh);
    this.moreTitle.setPosition(Math.round(mx + (MORE_W - this.moreTitle.width) / 2), my + 8);
    this.done.place(mx + Math.round((MORE_W - this.done.boxW) / 2), my + mh - 26);
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
export function releaseControls(): void {
  controls.moveX = 0;
  controls.moveY = 0;
  controls.attack = false;
  controls.beam = false;
  controls.click = false;
  controls.rightClick = false;
  sound.beamChargeEnd();
}
