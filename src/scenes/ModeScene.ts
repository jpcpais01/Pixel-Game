import Phaser from 'phaser';
import { Bitmap, bayer } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';
import { ARENAS_SIZE, SIDE_SIZE, type ModeArt, paintArenas, paintAuto, paintHome } from '../art/modes';
import { menuZoom } from '../game/display';
import { BUTTON_PLAIN, PANEL_PICKED, PixelButton, panelTexture, pixelText } from '../ui/widgets';
import { fpsBottom } from './FpsScene';
import type { HomeScene } from './HomeScene';

/** The scene key the Auto Battle tile opens once that mode is in the game (see `autoBattleReady`). */
export const AUTO_BATTLE_SCENE = 'autobattle';

const MARGIN = 6;
const GAP = 5;
/** The frame round each window: outline, two bevel rings and a dark inner line. */
const F = 4;
/** How far a tile rises as it comes in, and how long between one tile and the next. */
const ENTER_RISE = 10;
const ENTER_STAGGER = 70;
/** A press further than this (art px) is a drag, not a tap. */
const TAP_SLOP = 6;

type ModeId = 'arenas' | 'home' | 'auto';

interface Metal {
  lit: RGB;
  mid: RGB;
  dark: RGB;
}

interface TileDef {
  id: ModeId;
  name: string;
  tag: string;
  metal: Metal;
  /** The gems set in the frame's corners, and the hover line inside it. */
  accent: RGB;
  tagTint: number;
  paint: () => ModeArt;
  art: { w: number; h: number };
}

const TILES: TileDef[] = [
  {
    id: 'arenas',
    name: 'Arenas',
    tag: 'Explore Aurendel',
    metal: { lit: hex('#ffe89a'), mid: hex('#c07f30'), dark: hex('#5a3010') },
    accent: hex('#b890ff'),
    tagTint: 0xf4cf6a,
    paint: paintArenas,
    art: ARENAS_SIZE,
  },
  {
    id: 'home',
    name: 'Home',
    tag: 'Your own place',
    metal: { lit: hex('#ffd0a8'), mid: hex('#b0664a'), dark: hex('#4a2020') },
    accent: hex('#ffb050'),
    tagTint: 0xffc890,
    paint: paintHome,
    art: SIDE_SIZE,
  },
  {
    id: 'auto',
    name: 'Auto Battle',
    tag: '1v1 online',
    metal: { lit: hex('#dcd4ff'), mid: hex('#6e62b0'), dark: hex('#2a2250') },
    accent: hex('#ff4a6a'),
    tagTint: 0xff9ab0,
    paint: paintAuto,
    art: SIDE_SIZE,
  },
];

/** True once the Auto Battle mode's scene is registered with the game. */
export const autoBattleReady = (scene: Phaser.Scene): boolean => !!scene.scene.manager.keys[AUTO_BATTLE_SCENE];

/**
 * Back from a mode's own pages to this menu: over the home screen when it is
 * still running underneath, else by starting the home screen afresh.
 */
export function backToModes(from: Phaser.Scene): void {
  if (from.scene.isActive('home')) {
    from.scene.launch('modes');
    from.scene.stop();
  } else {
    from.scene.start('home');
  }
}

/** The frame for a `w` x `h` tile, plain or lit (hovered): bevelled metal with a gem in each corner. */
function frameBitmap(w: number, h: number, def: TileDef, lit: boolean): Bitmap {
  const b = new Bitmap(w, h);
  const out = hex('#0b0818');
  const up = (c: RGB, k: number): RGB => [Math.min(255, c[0] + k), Math.min(255, c[1] + k), Math.min(255, c[2] + k)];
  const m = lit ? { lit: up(def.metal.lit, 20), mid: up(def.metal.mid, 36), dark: up(def.metal.dark, 24) } : def.metal;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e >= F) continue;
      // Cut corners: the very corner pixel is left out, and the outline follows it round.
      const cx = Math.min(x, w - 1 - x);
      const cy = Math.min(y, h - 1 - y);
      if (cx + cy === 0) continue;
      const topLeft = (y === e && x <= w - 1 - e) || (x === e && y <= h - 1 - e);
      if (e === 0 || cx + cy === 1) b.set(x, y, out);
      else if (e === 1) b.set(x, y, topLeft ? m.lit : m.dark);
      else if (e === 2) b.set(x, y, topLeft ? m.mid : m.dark);
      else b.set(x, y, lit ? def.accent : out);
    }
  }
  // A gem in each corner on a little diamond of metal.
  const gem = (gx: number, gy: number) => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > 3) continue;
        const c = d === 3 ? out : d === 2 ? (dx + dy < 0 ? m.lit : m.dark) : d === 1 ? (dx + dy < 0 ? up(def.accent, 60) : def.accent) : up(def.accent, 90);
        b.set(gx + dx, gy + dy, c);
      }
    }
  };
  gem(3, 3);
  gem(w - 4, 3);
  gem(3, h - 4);
  gem(w - 4, h - 4);
  // A small crest in the middle of the top edge.
  const mx = Math.floor(w / 2);
  for (let dx = -4; dx <= 4; dx++) {
    const hgt = 2 - Math.floor(Math.abs(dx) / 2);
    for (let dy = 0; dy <= hgt; dy++) b.set(mx + dx, 1 + dy, dy === 0 && Math.abs(dx) < 4 ? m.lit : m.mid);
    b.set(mx + dx, 0, out);
  }
  b.set(mx, 2, up(def.accent, 60));
  return b;
}

/** A dark band that rises from the window's foot, so the name reads over any picture. */
function captionBitmap(w: number, h: number): Bitmap {
  const b = new Bitmap(w, h);
  const ink = hex('#0b0818');
  for (let y = 0; y < h; y++) {
    const f = y / Math.max(1, h - 1);
    const a = Math.min(1, f * f * 1.1) * 0.86;
    for (let x = 0; x < w; x++) {
      // Stepped with a dither like the rest of the art, rather than a smooth fade.
      const q = Math.min(1, Math.floor(a * 6 + bayer(x, y)) / 6);
      if (q > 0) b.set(x, y, ink, Math.round(q * 255));
    }
  }
  return b;
}

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  life: number;
}

/** One mode: a framed, living window onto its picture, its name, and a line under it. */
class ModeTile extends Phaser.GameObjects.Container {
  readonly def: TileDef;
  tileW = 0;
  tileH = 0;
  baseX = 0;
  baseY = 0;
  /** Eased 0..1 while this tile has focus (hover or keys). */
  private hot = 0;
  focused = false;
  pressed = false;
  /** Rises in on entering; set by a tween. */
  rise = ENTER_RISE;
  /** A little shake when a tile can't open yet. */
  private shake = 0;
  private frame!: Phaser.GameObjects.Image;
  private frameLit!: Phaser.GameObjects.Image;
  private art: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private cap!: Phaser.GameObjects.Image;
  private sheen: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.BitmapText;
  private nameShadow: Phaser.GameObjects.BitmapText;
  private tagText: Phaser.GameObjects.BitmapText;
  private soon: Phaser.GameObjects.Container | null = null;
  private motes: Mote[] = [];
  private puffs: Mote[] = [];
  private spots: ModeArt['spots'];
  private focusX: number;
  private focusY: number;
  private cropX = 0;
  private cropY = 0;
  private winW = 0;
  private winH = 0;
  private hit: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, def: TileDef, onFocus: () => void, onTap: () => void) {
    super(scene, 0, 0);
    this.def = def;
    const key = `mode_${def.id}`;
    if (!scene.textures.exists(key)) {
      const a = def.paint();
      scene.textures.addCanvas(key, a.base.toCanvas());
      scene.textures.addCanvas(`${key}_g`, a.glow.toCanvas());
      scene.registry.set(`${key}_meta`, { spots: a.spots, focusX: a.focusX, focusY: a.focusY });
    }
    const meta = scene.registry.get(`${key}_meta`) as Pick<ModeArt, 'spots' | 'focusX' | 'focusY'>;
    this.spots = meta.spots;
    this.focusX = meta.focusX;
    this.focusY = meta.focusY;
    this.art = scene.add.image(0, 0, key).setOrigin(0);
    this.glow = scene.add.image(0, 0, `${key}_g`).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.add([this.art, this.glow]);
    this.buildMotes();
    // A soft light over the picture while the tile has focus.
    this.sheen = scene.add.image(0, 0, 'mode_dot').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0d0).setAlpha(0);
    this.add(this.sheen);
    this.nameShadow = pixelText(scene, 0, 0, def.name, 0x0b0818, 2);
    this.nameText = pixelText(scene, 0, 0, def.name, 0xfff4d6, 2);
    this.tagText = pixelText(scene, 0, 0, def.tag, def.tagTint);
    this.hit = scene.add.zone(0, 0, 10, 10).setOrigin(0);
    scene.add.existing(this);

    let down = false;
    this.hit.setInteractive({ useHandCursor: true });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => onFocus());
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      down = true;
      this.pressed = true;
      onFocus();
    });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      down = false;
      this.pressed = false;
    });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      const tap = down && p.getDistance() / scene.cameras.main.zoom <= TAP_SLOP;
      down = false;
      this.pressed = false;
      if (tap) onTap();
    });
  }

  /** Show the "Soon" badge (a mode not in the game yet). */
  setSoon(on: boolean): void {
    if (!on) {
      this.soon?.destroy();
      this.soon = null;
      return;
    }
    if (this.soon) return;
    const w = 34;
    const h = 13;
    const bg = this.scene.add.image(0, 0, panelTexture(this.scene, 'mode_soon', w, h, PANEL_PICKED)).setOrigin(0);
    const t = pixelText(this.scene, 0, 0, 'Soon', 0xffe08a);
    t.setPosition(Math.round((w - t.width) / 2), Math.round((h - t.height) / 2));
    this.soon = this.scene.add.container(0, 0, [bg, t]);
    this.soon.setData('w', w);
    this.add(this.soon);
    if (this.tileW) this.size(this.tileW, this.tileH);
  }

  nudge(): void {
    this.shake = 1;
    if (this.soon) this.scene.tweens.add({ targets: this.soon, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }

  /** Fit the tile to `w` x `h` (art px): new frame textures, the picture cropped round its focus, the caption placed. */
  size(w: number, h: number): void {
    this.tileW = w;
    this.tileH = h;
    const scene = this.scene;
    const key = (lit: boolean) => `mode_frame_${this.def.id}_${w}x${h}${lit ? '_lit' : ''}`;
    for (const lit of [false, true]) {
      if (!scene.textures.exists(key(lit))) scene.textures.addCanvas(key(lit), frameBitmap(w, h, this.def, lit).toCanvas());
    }
    this.winW = Math.min(w - F * 2, this.def.art.w);
    this.winH = Math.min(h - F * 2, this.def.art.h);
    this.cropX = Phaser.Math.Clamp(Math.round(this.focusX - this.winW / 2), 0, this.def.art.w - this.winW);
    this.cropY = Phaser.Math.Clamp(Math.round((this.def.art.h - this.winH) * this.focusY), 0, this.def.art.h - this.winH);
    for (const img of [this.art, this.glow]) img.setCrop(this.cropX, this.cropY, this.winW, this.winH).setPosition(F - this.cropX, F - this.cropY);
    this.sheen.setPosition(F, F).setDisplaySize(this.winW, this.winH);

    const capKey = `mode_cap_${this.winW}x${Math.min(this.winH, 44)}`;
    const capH = Math.min(this.winH, 44);
    if (!scene.textures.exists(capKey)) scene.textures.addCanvas(capKey, captionBitmap(this.winW, capH).toCanvas());
    if (!this.frame) {
      this.cap = scene.add.image(0, 0, capKey).setOrigin(0);
      this.frame = scene.add.image(0, 0, key(false)).setOrigin(0);
      this.frameLit = scene.add.image(0, 0, key(true)).setOrigin(0).setAlpha(0);
      this.add([this.cap, this.nameShadow, this.nameText, this.tagText, this.frame, this.frameLit, this.hit]);
    }
    this.cap.setTexture(capKey).setPosition(F, F + this.winH - capH);
    this.frame.setTexture(key(false));
    this.frameLit.setTexture(key(true));
    this.hit.setSize(w, h);

    // The name at 2x when it fits across with room to spare, else 1x.
    const big = this.winH >= 70 && this.nameText.setScale(2).width <= this.winW - 14;
    const s = big ? 2 : 1;
    this.nameText.setScale(s);
    this.nameShadow.setScale(s);
    const tx = F + 6;
    const tagY = F + this.winH - 5 - this.tagText.height;
    const nameY = tagY - 3 - this.nameText.height;
    this.nameText.setPosition(tx, nameY);
    this.nameShadow.setPosition(tx + 1, nameY + s);
    this.tagText.setPosition(tx, tagY);
    this.tagText.setVisible(this.winH >= 44);
    if (this.soon) this.soon.setPosition(F + this.winW - (this.soon.getData('w') as number) - 4, F + 4);
    // Keep the drifting bits inside the new window.
    for (const m of this.motes) this.wrap(m);
  }

  private buildMotes(): void {
    const add = (n: number, tint: number, add = true) =>
      Array.from({ length: n }, () => {
        const img = this.scene.add.image(0, 0, 'mode_dot').setOrigin(0).setTint(tint);
        if (add) img.setBlendMode(Phaser.BlendModes.ADD);
        this.add(img);
        return { img, x: Math.random() * this.def.art.w, y: Math.random() * this.def.art.h, vx: 0, vy: 0, ph: Math.random() * Math.PI * 2, life: Math.random() };
      });
    if (this.def.id === 'arenas') {
      // Golden dust drifting on the evening air.
      this.motes = add(18, 0xffd890).map((m) => ({ ...m, vx: 2 + Math.random() * 4, vy: -1 - Math.random() * 2.5 }));
    } else if (this.def.id === 'home') {
      // Fireflies round the bush, the pond and the fence, and petals off the cherry tree.
      this.motes = [...add(8, 0xd8ff70), ...add(4, 0xffb4c8, false)];
      // Chimney smoke: soft puffs that swell and thin as they rise.
      this.puffs = Array.from({ length: 6 }, (_, i) => {
        // The glow texture is drawn additively, so the smoke is a faint moonlit haze rather than a grey puff.
        const img = this.scene.add.image(0, 0, 'glow').setTint(0x6a6488).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.add(img);
        return { img, x: 0, y: 0, vx: 0, vy: 0, ph: 0, life: i / 6 };
      });
    } else {
      // Embers flying up off the clash, and the odd star-spark over the board.
      this.motes = add(12, 0xffc050).map((m) => ({ ...m, life: Math.random() }));
    }
  }

  /** Bring a drifting mote back inside the visible window when it leaves. */
  private wrap(m: Mote): void {
    const x0 = this.cropX;
    const y0 = this.cropY;
    if (m.x < x0) m.x += this.winW;
    if (m.x >= x0 + this.winW) m.x -= this.winW;
    if (m.y < y0) m.y += this.winH;
    if (m.y >= y0 + this.winH) m.y -= this.winH;
  }

  /** Put an art-space point on screen inside the window, hidden when it falls outside. */
  private show(img: Phaser.GameObjects.Image, x: number, y: number, a: number): void {
    const lx = F + Math.round(x) - this.cropX;
    const ly = F + Math.round(y) - this.cropY;
    const inside = lx >= F && ly >= F && lx < F + this.winW && ly < F + this.winH;
    img.setVisible(inside && a > 0.02);
    if (inside) img.setPosition(lx, ly).setAlpha(a);
  }

  tick(t: number, dt: number): void {
    const k = Math.min(1, dt * 10);
    this.hot += ((this.focused ? 1 : 0) - this.hot) * k;
    this.shake = Math.max(0, this.shake - dt * 3);
    const jig = this.shake > 0 ? Math.round(Math.sin(this.shake * 40) * 2 * this.shake) : 0;
    const lift = this.focused && !this.pressed ? -1 : this.pressed ? 1 : 0;
    this.setPosition(this.baseX + jig, this.baseY + Math.round(this.rise) + lift);
    this.frameLit.setAlpha(this.hot * (0.8 + 0.2 * Math.sin(t * 4)));
    this.sheen.setAlpha(this.hot * 0.05);
    this.glow.setAlpha(this.glowLevel(t) + this.hot * 0.12);
    if (!this.winW) return;

    const id = this.def.id;
    if (id === 'arenas') {
      for (const m of this.motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt + Math.sin(t * 0.8 + m.ph) * 0.05;
        this.wrap(m);
        this.show(m.img, m.x, m.y, 0.25 + 0.55 * Math.max(0, Math.sin(t * 1.7 + m.ph)));
      }
    } else if (id === 'home') {
      const anchors = [this.spots.bush, this.spots.pond, [this.spots.tree[0] + 30, 118] as [number, number]];
      this.motes.forEach((m, i) => {
        if (i < 8) {
          const [ax, ay] = anchors[i % anchors.length];
          const x = ax + Math.sin(t * (0.35 + (i % 3) * 0.12) + m.ph) * 16;
          const y = ay - 6 + Math.cos(t * (0.5 + (i % 2) * 0.2) + m.ph * 1.3) * 6;
          // Fireflies glow for a moment and go dark again.
          const blink = Math.max(0, Math.sin(t * 1.3 + m.ph * 3));
          this.show(m.img, x, y, blink * blink);
        } else {
          // Petals: a slow fall with a sideways sway, from the crown down to the grass.
          m.life = (m.life + dt * 0.09) % 1;
          const [tx, ty] = this.spots.tree;
          const x = tx - 16 + ((m.ph * 7) % 32) + m.life * 22 + Math.sin(t * 2 + m.ph) * 3;
          const y = ty + m.life * 52;
          this.show(m.img, x, y, Math.min(1, (1 - m.life) * 3) * 0.9);
        }
      });
      const [cx, cy] = this.spots.chimney;
      for (const p of this.puffs) {
        p.life = (p.life + dt * 0.22) % 1;
        const f = p.life;
        const x = cx + f * 14 + Math.sin(f * 5 + t) * 1.5;
        const y = cy - f * 26;
        this.show(p.img, x, y, 0.32 * Math.sin(f * Math.PI));
        p.img.setScale(0.12 + f * 0.32);
      }
    } else {
      const [cx, cy] = this.spots.clash;
      for (const m of this.motes) {
        m.life += dt * (0.6 + (m.ph % 1) * 0.5);
        if (m.life >= 1) {
          m.life = 0;
          m.ph = Math.random() * Math.PI * 2;
        }
        const a = m.ph;
        const x = cx + Math.cos(a) * m.life * 14;
        const y = cy + Math.sin(a) * m.life * 8 - m.life * 12;
        this.show(m.img, x, y, (1 - m.life) * 0.95);
      }
    }
  }

  /** The glow layer's breathing: the sun and runes, the windows' flicker, the board's pulse. */
  private glowLevel(t: number): number {
    if (this.def.id === 'arenas') return 0.86 + 0.14 * Math.sin(t * 1.2);
    if (this.def.id === 'home') return 0.88 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.06 * Math.sin(t * 0.9);
    return 0.8 + 0.2 * Math.sin(t * 2.4);
  }
}

/**
 * The game mode menu, opened by Start Game over the home screen: the big
 * Arenas window (on to the hero select and the world map), the player's Home,
 * and Auto Battle, each a framed, living picture.
 */
export class ModeScene extends Phaser.Scene {
  private shade!: Phaser.GameObjects.Graphics;
  private header!: Phaser.GameObjects.BitmapText;
  private headerShadow!: Phaser.GameObjects.BitmapText;
  private flourish!: Phaser.GameObjects.Graphics;
  private back!: PixelButton;
  private tiles: ModeTile[] = [];
  private focus = 0;
  private leaving = false;
  private elapsed = 0;

  constructor() {
    super('modes');
  }

  create(): void {
    this.leaving = false;
    this.elapsed = 0;
    this.focus = 0;
    const cam = this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 240 });

    if (!this.textures.exists('mode_dot')) {
      const dot = this.textures.createCanvas('mode_dot', 1, 1)!;
      dot.context.fillStyle = '#fff';
      dot.context.fillRect(0, 0, 1, 1);
      dot.refresh();
    }
    this.shade = this.add.graphics();
    this.flourish = this.add.graphics();
    this.headerShadow = pixelText(this, 0, 0, 'Choose your path', 0x0b0818, 2).setAlpha(0.6);
    this.header = pixelText(this, 0, 0, 'Choose your path', 0xf4cf6a, 2);
    this.back = new PixelButton(this, 'Back', 48, 18, BUTTON_PLAIN, 'mode_back', () => this.goBack());
    this.tiles = TILES.map(
      (def, i) =>
        new ModeTile(
          this,
          def,
          () => this.setFocus(i),
          () => this.pick(i),
        ),
    );
    this.tiles[2].setSoon(!autoBattleReady(this));
    this.setFocus(0);
    // The tiles rise into place one after another.
    this.tiles.forEach((t, i) => {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, rise: 0, delay: 60 + i * ENTER_STAGGER, duration: 320, ease: 'Cubic.easeOut' });
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.goBack());
    kb?.on('keydown-ENTER', () => this.pick(this.focus));
    kb?.on('keydown-SPACE', () => this.pick(this.focus));
    for (const k of ['LEFT', 'UP', 'A', 'W']) kb?.on(`keydown-${k}`, () => this.setFocus((this.focus + 2) % 3));
    for (const k of ['RIGHT', 'DOWN', 'D', 'S']) kb?.on(`keydown-${k}`, () => this.setFocus((this.focus + 1) % 3));
    (['ONE', 'TWO', 'THREE'] as const).forEach((k, i) => kb?.on(`keydown-${k}`, () => this.pick(i)));

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    this.elapsed += dt;
    for (const t of this.tiles) t.tick(this.elapsed, dt);
  }

  private setFocus(i: number): void {
    this.focus = i;
    this.tiles.forEach((t, j) => (t.focused = j === i));
  }

  private pick(i: number): void {
    if (this.leaving) return;
    this.setFocus(i);
    const id = TILES[i].id;
    if (id === 'arenas') {
      this.leave(() => this.scene.launch('select'));
    } else if (id === 'home') {
      this.leaving = true;
      this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 300 });
      (this.scene.get('home') as HomeScene).playHome();
    } else if (autoBattleReady(this)) {
      this.leave(() => this.scene.launch(AUTO_BATTLE_SCENE));
    } else {
      this.tiles[i].nudge();
    }
  }

  /** Fade this page away, run `next`, and stop. */
  private leave(next: () => void): void {
    this.leaving = true;
    next();
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }

  private goBack(): void {
    if (this.leaving) return;
    this.leave(() => (this.scene.get('home') as HomeScene).showMenu(true));
  }

  private layout(): void {
    const { width, height } = this.scale;
    const z = menuZoom(width, height);
    this.cameras.main.setZoom(z);
    const vw = width / z;
    const vh = height / z;

    // The home screen behind dims, most at the bottom.
    const g = this.shade.clear();
    g.fillStyle(0x0b0818, 0.5).fillRect(0, 0, Math.ceil(vw) + 1, Math.ceil(vh) + 1);
    for (let i = 0; i < 6; i++) g.fillStyle(0x0b0818, 0.07).fillRect(0, vh - 44 + i * 7, Math.ceil(vw) + 1, 44 - i * 7);

    // The header row: Back on the left, the title centred (1x when 2x would crowd Back).
    const headerY = Math.ceil(fpsBottom() / z) + 3;
    this.back.place(MARGIN, headerY);
    const room = vw - (MARGIN + this.back.boxW + 10) * 2;
    const s = this.header.setScale(2).width <= room ? 2 : 1;
    this.header.setScale(s);
    this.headerShadow.setScale(s);
    const hx = Math.round((vw - this.header.width) / 2);
    const hy = headerY + Math.round((this.back.boxH - this.header.height) / 2);
    this.header.setPosition(hx, hy);
    this.headerShadow.setPosition(hx + 1, hy + s);
    this.header.setVisible(this.header.width <= vw - (MARGIN + this.back.boxW + 6) * 2);
    this.headerShadow.setVisible(this.header.visible);
    this.drawFlourish(hx, hy + Math.round(this.header.height / 2), this.header.width, vw);

    const top = headerY + this.back.boxH + 6;
    const availW = Math.floor(vw - MARGIN * 2);
    const availH = Math.floor(vh - top - MARGIN);
    const [arenas, home, auto] = this.tiles;
    const maxA = { w: ARENAS_SIZE.w + F * 2, h: ARENAS_SIZE.h + F * 2 };
    const maxS = { w: SIDE_SIZE.w + F * 2, h: SIDE_SIZE.h + F * 2 };
    if (availW > availH * 1.15) {
      // Wide: Arenas on the left, Home over Auto Battle beside it.
      const h = Math.min(availH, maxA.h, maxS.h * 2 + GAP);
      let aw = Math.min(Math.round((availW - GAP) * 0.6), maxA.w);
      const sw = Math.min(availW - GAP - aw, maxS.w);
      aw = Math.min(availW - GAP - sw, maxA.w);
      const x0 = MARGIN + Math.floor((availW - aw - GAP - sw) / 2);
      const y0 = top + Math.floor((availH - h) / 2);
      const sh = Math.floor((h - GAP) / 2);
      this.place(arenas, x0, y0, aw, h);
      this.place(home, x0 + aw + GAP, y0, sw, sh);
      this.place(auto, x0 + aw + GAP, y0 + sh + GAP, sw, h - sh - GAP);
    } else {
      // Tall: one above the other, Arenas the biggest.
      const w = Math.min(availW, maxA.w);
      const ah = Math.min(Math.round((availH - GAP * 2) * 0.44), maxA.h);
      const sh = Math.min(Math.floor((availH - GAP * 2 - ah) / 2), maxS.h);
      const sw = Math.min(w, maxS.w);
      const total = ah + sh * 2 + GAP * 2;
      const x0 = MARGIN + Math.floor((availW - w) / 2);
      const y0 = top + Math.floor((availH - total) / 2);
      this.place(arenas, x0, y0, w, ah);
      this.place(home, x0 + Math.floor((w - sw) / 2), y0 + ah + GAP, sw, sh);
      this.place(auto, x0 + Math.floor((w - sw) / 2), y0 + ah + GAP + sh + GAP, sw, sh);
    }
  }

  private place(t: ModeTile, x: number, y: number, w: number, h: number): void {
    t.baseX = Math.round(x);
    t.baseY = Math.round(y);
    if (t.tileW !== w || t.tileH !== h) t.size(w, h);
  }

  /** Gold hairlines running out from the title, fading in dithered steps, with a diamond at each end. */
  private drawFlourish(x: number, mid: number, w: number, vw: number): void {
    const g = this.flourish.clear();
    if (!this.header.visible) return;
    const len = Math.min(40, Math.floor((vw - w) / 2 - MARGIN - this.back.boxW - 16));
    if (len < 8) return;
    for (const dir of [-1, 1] as const) {
      const start = dir < 0 ? x - 5 : x + w + 4;
      for (let i = 0; i < len; i++) {
        const a = 1 - i / len;
        if (a < bayer(i, 1) * 0.8) continue;
        g.fillStyle(0xb8742c, 0.4 + a * 0.6).fillRect(start + dir * i, mid, 1, 1);
      }
      const dx = start + dir * len;
      g.fillStyle(0xb8742c).fillRect(dx - 1, mid - 1, 3, 3);
      g.fillStyle(0xffe08a).fillRect(dx, mid, 1, 1);
    }
  }
}
