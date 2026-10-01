// The time of day, picked in the pause menu: a pill of four cells (morning,
// day, sunset, night, each with its sky icon) with a lit pill sliding under
// the one in play in that time's colour, and a round Auto button beside it
// whose gold ring fills as the phase runs out. Tap a cell to hold that time
// (which stops Auto), or Auto to let the day turn by itself. Drawn in art
// pixels for the menu's own camera, every edge stepped like the panel's.

import Phaser from 'phaser';
import { daynight, PHASES } from '../game/daynight';

/** The picker's size in the menu's art pixels. */
export const DAY_PICKER_W = 152;
export const DAY_PICKER_H = 20;
/** Room between the pill and the Auto button. */
const GAP = 6;
const PILL_W = DAY_PICKER_W - DAY_PICKER_H - GAP;
const CELL = PILL_W / 4;
/** Morning, day, sunset and night: peach, sky blue, rose and indigo. */
const PHASE_TINT = [0xe8a878, 0x8ec9f5, 0xd87898, 0x6b74c9];
const ICONS = ['icon_dawn', 'icon_sun', 'icon_dusk', 'icon_moon'];
/** How quickly (ms) the lit pill slides to a newly picked time. */
const SLIDE_MS = 90;

type Rgba = [number, number, number, number];

/** Is pixel (x, y) inside a w x h capsule (a pill, or a circle when w = h)? */
const inPill = (w: number, h: number, x: number, y: number): boolean => {
  const r = h / 2;
  const cx = Math.min(Math.max(x + 0.5, r), w - r);
  return Math.hypot(x + 0.5 - cx, y + 0.5 - r) <= r;
};

/** A canvas painted pixel by pixel: `paint` gets each pixel inside the capsule and whether it is on the capsule's edge. */
function pillCanvas(w: number, h: number, paint: (x: number, y: number, edge: boolean) => Rgba | null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inPill(w, h, x, y)) continue;
      const edge = !inPill(w, h, x - 1, y) || !inPill(w, h, x + 1, y) || !inPill(w, h, x, y - 1) || !inPill(w, h, x, y + 1);
      const col = paint(x, y, edge);
      if (!col) continue;
      img.data.set(col, (y * w + x) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const rgba = (c: number, a = 1): Rgba => [(c >> 16) & 255, (c >> 8) & 255, c & 255, Math.round(a * 255)];

/** The picker's fixed textures, made once. */
function ensureTextures(scene: Phaser.Scene): void {
  const tex = scene.textures;
  if (tex.exists('daypick_track')) return;
  const H = DAY_PICKER_H;
  // The track: sunk into the panel, an inked rim with a dark line of shadow along its inner top.
  tex.addCanvas(
    'daypick_track',
    pillCanvas(PILL_W, H, (x, y, edge) => (edge ? rgba(0x6e6a9a) : y === 1 || (y === 2 && !inPill(PILL_W, H, x, 1)) ? rgba(0x05040c, 0.9) : rgba(0x0b0818, 0.85))),
  );
  // The lit pill, white to be tinted: a bright top line, the body, a shaded bottom.
  const lw = Math.round(CELL) - 4;
  const lh = H - 6;
  tex.addCanvas(
    'daypick_lit',
    pillCanvas(lw, lh, (_x, y, edge) => {
      if (edge) return y < lh / 2 ? rgba(0xffffff) : rgba(0x9a9a9a);
      return y <= 1 ? rgba(0xffffff) : y >= lh - 2 ? rgba(0xb8b8b8) : rgba(0xdcdcdc);
    }),
  );
}

export class DayPicker extends Phaser.GameObjects.Container {
  readonly boxW = DAY_PICKER_W;
  readonly boxH = DAY_PICKER_H;
  private track: Phaser.GameObjects.Image;
  private lit: Phaser.GameObjects.Image;
  private icons: Phaser.GameObjects.Image[];
  private auto: Phaser.GameObjects.Image;
  private autoTex: Phaser.Textures.CanvasTexture;
  private autoIcon: Phaser.GameObjects.Image;
  /** Where the lit pill stands, a cell index eased toward the time in play. */
  private at = -1;
  private autoDrawn = '';

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    ensureTextures(scene);
    const H = DAY_PICKER_H;
    this.track = scene.add.image(0, 0, 'daypick_track').setOrigin(0);
    this.lit = scene.add.image(0, 3, 'daypick_lit').setOrigin(0);
    this.icons = ICONS.map((k, i) => scene.add.image(Math.round(CELL * (i + 0.5)), Math.round(H / 2), k));
    const key = `daypick_auto_${Math.random().toString(36).slice(2)}`;
    this.autoTex = scene.textures.createCanvas(key, H, H)!;
    this.auto = scene.add.image(PILL_W + GAP, 0, key).setOrigin(0);
    this.autoIcon = scene.add.image(PILL_W + GAP + H / 2, H / 2, 'icon_cycle');
    this.add([this.track, this.lit, ...this.icons, this.auto, this.autoIcon]);
    scene.add.existing(this);

    // Tap a cell to hold its time (which stops Auto).
    this.track.setInteractive({ useHandCursor: true });
    this.track.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (_p: Phaser.Input.Pointer, lx: number) => {
      if (!daynight.enabled) return;
      daynight.set(PHASES[Phaser.Math.Clamp(Math.floor(lx / CELL), 0, 3)]);
    });
    this.auto.setInteractive({ useHandCursor: true });
    this.auto.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (daynight.enabled) daynight.setAuto(!daynight.auto);
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.textures.remove(key));
    this.update(0);
  }

  setEnabled(on: boolean): this {
    for (const o of [this.track, this.auto]) if (o.input) o.input.enabled = on;
    return this;
  }

  /** Place it by its top-left corner, on whole art pixels. */
  place(x: number, y: number): this {
    return this.setPosition(Math.round(x), Math.round(y));
  }

  /** Slide the lit pill and refill the Auto ring; `dt` in ms. */
  update(dt: number): void {
    const want = PHASES.indexOf(daynight.phase);
    this.at = this.at < 0 || dt <= 0 ? want : this.at + (want - this.at) * Math.min(1, dt / SLIDE_MS);
    if (Math.abs(want - this.at) < 0.01) this.at = want;
    const at = this.at;
    // Its colour eases between the two times it stands between.
    const i0 = Math.floor(at);
    const i1 = Math.min(3, i0 + 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(PHASE_TINT[i0]),
      Phaser.Display.Color.ValueToColor(PHASE_TINT[i1]),
      100,
      Math.round((at - i0) * 100),
    );
    this.lit.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).setX(Math.round(at * CELL + 2));
    this.icons.forEach((icon, i) => icon.setAlpha(0.45 + 0.55 * Math.max(0, 1 - Math.abs(at - i))));

    const auto = daynight.auto;
    const fill = auto ? Math.round(daynight.progress * 48) / 48 : 0;
    this.autoIcon.setAlpha(auto ? 1 : 0.5);
    const state = `${auto} ${fill}`;
    if (state === this.autoDrawn) return;
    this.autoDrawn = state;
    this.drawAuto(auto, fill);
  }

  /** The Auto button: dark, or lit indigo while on, its rim filling with gold clockwise from the top as the phase runs out. */
  private drawAuto(auto: boolean, fill: number): void {
    const H = DAY_PICKER_H;
    const ctx = this.autoTex.context;
    ctx.clearRect(0, 0, H, H);
    const img = ctx.createImageData(H, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < H; x++) {
        if (!inPill(H, H, x, y)) continue;
        const edge = !inPill(H, H, x - 1, y) || !inPill(H, H, x + 1, y) || !inPill(H, H, x, y - 1) || !inPill(H, H, x, y + 1);
        // Clockwise from the top, 0..1 round.
        const turn = (Math.atan2(x + 0.5 - H / 2, -(y + 0.5 - H / 2)) / (Math.PI * 2) + 1) % 1;
        let col: Rgba;
        if (edge) col = auto && turn < fill ? rgba(0xffd66b) : rgba(auto ? 0x9aa0e8 : 0x6e6a9a);
        else if (y === 1 || (y === 2 && !inPill(H, H, x, 1))) col = rgba(auto ? 0x4a52a0 : 0x05040c, 0.9);
        else col = auto ? rgba(0x2a3160, 0.95) : rgba(0x0b0818, 0.85);
        img.data.set(col, (y * H + x) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.autoTex.refresh();
  }
}
