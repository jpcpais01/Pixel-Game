import Phaser from 'phaser';
import { bayer } from '../art/bitmap';
import { menuZoom } from '../game/display';
import { controls } from '../game/controls';
import { fishById, fishHud, type FishDef } from '../game/fish';
import { BUTTON_PLAIN, PANEL, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fitLine } from './SelectScene';
import { fpsBottom } from './FpsScene';

/** The reel's gauge: its frame, the water inside it, and the line's fill beside it. */
const GAUGE_W = 33;
const GAUGE_H = 112;
const TRACK_X = 5;
const TRACK_W = 16;
const TRACK_Y = 6;
const TRACK_H = 100;
const FILL_X = 24;
const FILL_W = 4;
/** The landed card. */
const CARD_W = 196;
const CARD_H = 48;
const GOLD = 0xf4cf6a;
const TEXT = 0xfff4d8;
const DIM = 0x9a90c8;
const RARITY_TINT = { common: 0xd8d0ff, rare: GOLD, legendary: 0xffffff } as const;
const RARITY_NAME = { common: 'Common', rare: 'Rare', legendary: 'Legendary' } as const;
/** How long the "hold to reel" line shows once the reel starts. */
const HOW_MS = 2600;

interface Bubble {
  x: number;
  y: number;
  v: number;
}

/**
 * Fishing's overlay, over the world while the hero fishes in the Home (see
 * world/Fishing.ts): a line under the hero saying what to do, a "!" when a
 * fish bites, the reel's gauge (a column of water with the green catch zone,
 * the fish's shadow darting in it, the line's fill beside it and the reel's
 * crank turning as it's held), the card of the fish just landed, and a button
 * to put the rod away. Any press, or Space, E or J, strikes and reels.
 */
export class FishScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private frame!: Phaser.GameObjects.Graphics;
  private gauge!: Phaser.GameObjects.Graphics;
  private shadow!: Phaser.GameObjects.Image;
  private hint!: Phaser.GameObjects.BitmapText;
  private alert!: Phaser.GameObjects.BitmapText;
  private stopBtn!: PixelButton;
  private card: Phaser.GameObjects.Container | null = null;
  private cardFor = '';
  private gaugeA = 0;
  private crank = 0;
  private bubbles: Bubble[] = [];
  private held = new Set<number>();
  private keys!: Record<'space' | 'e' | 'j' | 'enter', Phaser.Input.Keyboard.Key>;
  private hintText = '';

  constructor() {
    super('fish');
  }

  create(): void {
    this.card = null;
    this.cardFor = '';
    this.gaugeA = 0;
    this.held.clear();
    this.bubbles = [];
    this.cameras.main.setOrigin(0, 0);
    this.frame = this.add.graphics();
    this.gauge = this.add.graphics();
    this.shadow = this.add.image(0, 0, 'fish_shadow');
    this.hint = pixelText(this, 0, 0, '', TEXT);
    this.alert = pixelText(this, 0, 0, '!', GOLD, 3);
    this.stopBtn = new PixelButton(this, 'Put rod away', 72, 16, BUTTON_PLAIN, 'fish_stop', () => (fishHud.stop = true));

    // Any press strikes, casts again, or holds the reel; except on the button.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      // Not while the world is paused under the menu: the press is for the menu.
      if (!fishHud.active || this.overButton(p) || this.scene.isPaused('world')) return;
      this.held.add(p.id);
      fishHud.press = true;
    });
    const up = (p: Phaser.Input.Pointer) => this.held.delete(p.id);
    this.input.on(Phaser.Input.Events.POINTER_UP, up);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({ space: 'SPACE', e: 'E', j: 'J', enter: 'ENTER' }, false) as FishScene['keys'];
    for (const k of Object.values(this.keys)) k.on('down', () => fishHud.active && !this.scene.isPaused('world') && (fishHud.press = true));

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      fishHud.hold = false;
    });
  }

  private overButton(p: Phaser.Input.Pointer): boolean {
    const x = p.x / this.z - this.stopBtn.x;
    const y = p.y / this.z - this.stopBtn.y;
    return this.stopBtn.visible && x >= 0 && y >= 0 && x < this.stopBtn.boxW && y < this.stopBtn.boxH;
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = menuZoom(width, height);
    this.cameras.main.setZoom(this.z);
    this.vw = width / this.z;
    this.vh = height / this.z;
    this.stopBtn.place(Math.round((this.vw - this.stopBtn.boxW) / 2), Math.ceil(fpsBottom() / this.z) + 4);
    this.drawFrame();
  }

  /** The gauge's top-left corner: to the right of the hero, who stands mid-screen. */
  private get gx(): number {
    return Math.round(this.vw / 2 + 34);
  }

  private get gy(): number {
    return Math.round(this.vh / 2 - GAUGE_H / 2 - 10);
  }

  update(_time: number, dt: number): void {
    const on = fishHud.active;
    fishHud.hold = on && !this.scene.isPaused('world') && (this.held.size > 0 || Object.values(this.keys).some((k) => k.isDown));
    this.stopBtn.setVisible(on).setEnabled(on);
    const reel = on && fishHud.phase === 'reel';
    this.gaugeA = Phaser.Math.Clamp(this.gaugeA + (reel ? 1 : -1) * (dt / 180), 0, 1);
    this.frame.setVisible(this.gaugeA > 0).setAlpha(this.gaugeA);
    this.gauge.setVisible(this.gaugeA > 0).setAlpha(this.gaugeA);
    this.shadow.setVisible(this.gaugeA > 0).setAlpha(this.gaugeA * 0.9);
    if (this.gaugeA > 0) this.drawGauge(dt, reel);
    this.updateText();
    this.updateCard(on ? fishHud.landed : null);
  }

  // ---------------------------------------------------------------- The gauge

  /** The still parts: a wooden frame with brass corners round a column of water, and the fill's slot. */
  private drawFrame(): void {
    const g = this.frame.clear();
    const x = this.gx;
    const y = this.gy;
    const W = GAUGE_W;
    const H = GAUGE_H;
    // Outline with cut corners, then the wood: lit on its top and left, dark on its bottom and right.
    g.fillStyle(0x120a04).fillRect(x + 1, y, W - 2, H).fillRect(x, y + 1, W, H - 2);
    g.fillStyle(0x6a4424).fillRect(x + 1, y + 1, W - 2, H - 2);
    g.fillStyle(0xa87644).fillRect(x + 1, y + 1, W - 2, 1).fillRect(x + 1, y + 1, 1, H - 2);
    g.fillStyle(0x3a2412).fillRect(x + 1, y + H - 2, W - 2, 1).fillRect(x + W - 2, y + 1, 1, H - 2);
    // Grain down the wood.
    g.fillStyle(0x5a381c);
    for (let k = 0; k < 18; k++) g.fillRect(x + 2 + ((k * 7) % (W - 4)), y + 3 + ((k * 13) % (H - 8)), 1, 3);
    // Brass rivets at the corners.
    for (const [rx, ry] of [[x + 2, y + 2], [x + W - 4, y + 2], [x + 2, y + H - 4], [x + W - 4, y + H - 4]]) {
      g.fillStyle(0xe2b84e).fillRect(rx, ry, 2, 2);
      g.fillStyle(0xfff0a8).fillRect(rx, ry, 1, 1);
      g.fillStyle(0x84581a).fillRect(rx + 1, ry + 1, 1, 1);
    }
    // The water: deep at the foot, lighter toward the surface, dithered between bands.
    const tx = x + TRACK_X;
    const ty = y + TRACK_Y;
    g.fillStyle(0x07121c).fillRect(tx - 1, ty - 1, TRACK_W + 2, TRACK_H + 2);
    const top = [0x3a9aa0, 0x2a7e8c];
    const deep = [0x0c2a3c, 0x081c2c];
    for (let r = 0; r < TRACK_H; r++) {
      const f = r / (TRACK_H - 1);
      for (let c = 0; c < TRACK_W; c++) {
        const q = Math.min(1, Math.floor(f * 6 + bayer(c, r)) / 6);
        g.fillStyle(lerpCol(lerpCol(top[0], top[1], f), lerpCol(deep[0], deep[1], f), q)).fillRect(tx + c, ty + r, 1, 1);
      }
    }
    // Light slanting down from the surface.
    g.fillStyle(0xbff4ff, 0.12);
    for (let r = 0; r < 34; r++) g.fillRect(tx + 3 + Math.floor(r / 5), ty + r, 2, 1).fillRect(tx + 10 + Math.floor(r / 6), ty + r, 1, 1);
    // The surface's bright edge, and a sandy bed.
    g.fillStyle(0xc8f4ff, 0.8).fillRect(tx, ty, TRACK_W, 1);
    g.fillStyle(0x6a5a3a).fillRect(tx, ty + TRACK_H - 2, TRACK_W, 2);
    g.fillStyle(0x8a7a52).fillRect(tx + 2, ty + TRACK_H - 2, 3, 1).fillRect(tx + 10, ty + TRACK_H - 2, 4, 1);
    // The fill's slot.
    g.fillStyle(0x07121c).fillRect(x + FILL_X - 1, ty - 1, FILL_W + 2, TRACK_H + 2);
    g.fillStyle(0x1a1030).fillRect(x + FILL_X, ty, FILL_W, TRACK_H);
  }

  /** The moving parts: weed swaying, bubbles, the catch zone, the fish, the fill, and the crank. */
  private drawGauge(dt: number, reel: boolean): void {
    const g = this.gauge.clear();
    const t = this.time.now;
    const x = this.gx;
    const y = this.gy;
    const tx = x + TRACK_X;
    const ty = y + TRACK_Y;
    const h = fishHud;

    // Weed along the bed.
    for (const [wx, wh, col] of [[2, 12, 0x2a5a2a], [6, 8, 0x3a6a2c], [12, 14, 0x28502a], [14, 7, 0x3a7030]] as const) {
      for (let k = 0; k < wh; k++) {
        const sway = Math.round(Math.sin(t * 0.002 + wx + k * 0.3) * (k / wh) * 1.6);
        g.fillStyle(col).fillRect(tx + Phaser.Math.Clamp(wx + sway, 0, TRACK_W - 1), ty + TRACK_H - 3 - k, 1, 1);
      }
    }
    // Bubbles rising from the bed.
    if (Math.random() < dt / 380) this.bubbles.push({ x: 1 + Math.floor(Math.random() * (TRACK_W - 2)), y: TRACK_H - 3, v: 12 + Math.random() * 14 });
    for (const b of this.bubbles) {
      b.y -= b.v * (dt / 1000);
      const bx = Math.round(b.x + Math.sin(b.y * 0.3) * 0.8);
      g.fillStyle(0xd8f8ff, 0.55).fillRect(tx + bx, ty + Math.round(b.y), 1, 1);
    }
    this.bubbles = this.bubbles.filter((b) => b.y > 1);

    // The zone: glowing green, brighter while the fish is in it.
    const zTop = Math.round(ty + TRACK_H * (1 - h.zone - h.zoneH));
    const zH = Math.round(TRACK_H * h.zoneH);
    const inZone = h.fish >= h.zone && h.fish <= h.zone + h.zoneH;
    const pulse = 0.5 + Math.sin(t * 0.012) * 0.5;
    g.fillStyle(0x7aff9a, inZone ? 0.36 + pulse * 0.1 : 0.2).fillRect(tx, zTop, TRACK_W, zH);
    g.fillStyle(0xd8ffe0, 0.95).fillRect(tx, zTop, TRACK_W, 1).fillRect(tx, zTop + zH - 1, TRACK_W, 1);
    g.fillStyle(0xb8ffc8, 0.5).fillRect(tx, zTop + 1, 1, zH - 2).fillRect(tx + TRACK_W - 1, zTop + 1, 1, zH - 2);
    // Ticks inside its ends, like a float's marks.
    g.fillStyle(0xffffff, 0.8).fillRect(tx + 2, zTop + 1, 2, 1).fillRect(tx + TRACK_W - 4, zTop + zH - 2, 2, 1);

    // The fish's shadow, darting; it glints when caught in the zone.
    const fy = ty + TRACK_H * (1 - h.fish);
    const wob = Math.sin(t * (0.02 + (reel ? 0.01 : 0))) * 8;
    this.shadow.setTexture(h.big ? 'fish_shadow_big' : 'fish_shadow').setPosition(tx + TRACK_W / 2 + (h.big ? 0 : -1), Phaser.Math.Clamp(Math.round(fy), ty + 4, ty + TRACK_H - 5)).setAngle(h.rising ? -wob - 8 : wob + 8).setFlipX(Math.sin(t * 0.0013) < 0);
    this.shadow.setTint(inZone ? 0xb8ffd0 : 0xffffff);

    // The line's fill: red when nearly lost, gold, then green as it lands.
    const p = Phaser.Math.Clamp(h.progress, 0, 1);
    const fh = Math.round(TRACK_H * p);
    const col = p < 0.5 ? lerpCol(0xff5a4a, 0xffd060, p / 0.5) : lerpCol(0xffd060, 0x8aff7a, (p - 0.5) / 0.5);
    g.fillStyle(col).fillRect(x + FILL_X, ty + TRACK_H - fh, FILL_W, fh);
    if (fh > 1) g.fillStyle(0xffffff, 0.55).fillRect(x + FILL_X, ty + TRACK_H - fh, FILL_W, 1);
    if (p < 0.2 && Math.sin(t * 0.03) > 0) g.fillStyle(0xff5a4a, 0.35).fillRect(x + FILL_X - 1, ty - 1, FILL_W + 2, TRACK_H + 2);

    // The reel's crank at the gauge's side, turning while held.
    if (h.hold && reel) this.crank += dt * 0.014;
    const cx = x + GAUGE_W + 3;
    const cy = y + GAUGE_H - 16;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 4.3) continue;
        const lit = dx + dy < -2;
        g.fillStyle(d > 3.3 ? 0x3a2408 : lit ? 0xf6dc84 : d < 1.2 ? 0x5c3c10 : 0xc89634).fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
    const ax = Math.round(cx + Math.cos(this.crank) * 5);
    const ay = Math.round(cy + Math.sin(this.crank) * 5);
    g.fillStyle(0x84581a);
    const n = 5;
    for (let k = 1; k < n; k++) g.fillRect(Math.round(cx + ((ax - cx) * k) / n), Math.round(cy + ((ay - cy) * k) / n), 1, 1);
    g.fillStyle(0x2a170c).fillRect(ax - 1, ay - 1, 3, 3);
    g.fillStyle(0x9c6737).fillRect(ax - 1, ay - 1, 2, 2);
  }

  // ---------------------------------------------------------------- Words

  /** A line under the hero saying what to do, and the "!" of a bite over their head. */
  private updateText(): void {
    const on = fishHud.active;
    const phase = fishHud.phase;
    const touch = !controls.mouse;
    let text = '';
    if (on) {
      if (fishHud.messageT > 0) text = fishHud.message;
      else if (phase === 'wait') text = 'Wait for a bite...';
      else if (phase === 'bite') text = touch ? 'Tap!' : 'Click or Space!';
      else if (phase === 'reel' && fishHud.t < HOW_MS) text = touch ? 'Hold to reel it in' : 'Hold the mouse or Space to reel';
      else if (phase === 'ready') text = touch ? 'Tap to cast again' : 'Click or Space to cast again';
    }
    if (text !== this.hintText) {
      this.hintText = text;
      this.hint.setText(text.toUpperCase());
    }
    this.hint.setVisible(!!text).setPosition(Math.round((this.vw - this.hint.width) / 2), Math.round(this.vh / 2 + 16));
    const bite = on && phase === 'bite';
    this.alert.setVisible(bite);
    if (bite) {
      const hop = Math.abs(Math.sin(this.time.now * 0.018)) * 4;
      this.alert.setPosition(Math.round(this.vw / 2 - this.alert.width / 2), Math.round(this.vh / 2 - 66 - hop)).setTint(Math.floor(this.time.now / 90) % 2 ? GOLD : 0xffffff);
    }
  }

  // ---------------------------------------------------------------- The landed card

  private updateCard(landed: { id: string; first: boolean } | null): void {
    const key = landed ? `${landed.id}${landed.first ? '!' : ''}` : '';
    if (key === this.cardFor) return;
    this.cardFor = key;
    const old = this.card;
    if (old) this.tweens.add({ targets: old, alpha: 0, y: old.y - 6, duration: 220, onComplete: () => old.destroy() });
    this.card = null;
    const def = landed ? fishById(landed.id) : undefined;
    if (!landed || !def) return;
    this.card = this.buildCard(def, landed.first);
  }

  /** The fish on a card: its picture, its name in its rarity's colour, "New!" for the first of its kind, and a line about it. */
  private buildCard(def: FishDef, first: boolean): Phaser.GameObjects.Container {
    const legend = def.rarity === 'legendary';
    const bg = this.add.image(0, 0, panelTexture(this, legend ? 'fish_card_gold' : 'fish_card', CARD_W, CARD_H, legend ? PANEL_PICKED : PANEL)).setOrigin(0);
    const parts: Phaser.GameObjects.GameObject[] = [bg];
    if (def.glow) parts.push(this.add.image(24, CARD_H / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(def.tint).setAlpha(0.45).setScale(1.2));
    const fish = this.add.sprite(24, CARD_H / 2, 'fish', `${def.id}_0`).play(`fish_${def.id}`);
    parts.push(fish);
    if (def.glow) parts.push(this.add.sprite(24, CARD_H / 2, 'fish_e', `${def.id}_0`).setBlendMode(Phaser.BlendModes.ADD).play(`fish_${def.id}`));
    const probe = pixelText(this, 0, 0, '').setVisible(false);
    const tx = 48;
    const tw = CARD_W - tx - 6;
    parts.push(pixelText(this, tx, 7, fitLine(probe, def.name, tw), RARITY_TINT[def.rarity]));
    const rarity = pixelText(this, tx, 18, RARITY_NAME[def.rarity], legend ? GOLD : DIM);
    parts.push(rarity);
    if (first) parts.push(pixelText(this, tx + rarity.width + 6, 18, 'New!', 0x8aff9a));
    parts.push(pixelText(this, tx, 30, fitLine(probe, def.line, tw), TEXT));
    probe.destroy();
    const top = this.stopBtn.y + this.stopBtn.boxH + 6;
    const c = this.add.container(Math.round((this.vw - CARD_W) / 2), top, parts).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: { from: top - 8, to: top }, duration: 260, ease: 'Back.easeOut' });
    return c;
  }
}

function lerpCol(a: number, b: number, t: number): number {
  const k = Phaser.Math.Clamp(t, 0, 1);
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
