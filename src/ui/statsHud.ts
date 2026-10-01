// The hero's stats in a fight: a small panel in the top-left corner, under the
// buff badges, with the six stats as they stand right now (gear, blessings,
// the companion and timed buffs in; see WorldScene.heroSheet). A stat a buff
// is lifting shows green with a small up arrow, one pushed down red with a
// down arrow. Tapping the panel folds it to a single chip (remembered on this
// device), and tapping the chip opens it again.
//
// Beside it, an "i" button opens a card on the hero: their three moves with
// their icons, names (the worn skin's) and a line or two on what each does
// (game/abilityInfo.ts), and the stats again with their names. Solo the fight
// holds still while it is open; online it carries on. A tap anywhere or Esc
// closes it.
//
// Both are drawn in art pixels and scaled up, like the bag (ui/gearHud.ts).

import Phaser from 'phaser';
import { bayer } from '../art/bitmap';
import { controls } from '../game/controls';
import { menuZoom } from '../game/display';
import type { CharacterDef } from '../game/characters';
import type { HeroSheet } from '../game/stats';
import { ABILITY_INFO } from '../game/abilityInfo';
import { ultFor } from '../game/ultimate';
import { session } from '../net/session';
import { PANEL, panelTexture, pixelText, type PanelStyle } from './widgets';
import { statIconsTexture } from './statIcons';

const KEY = 'pixel-battle.statsHud';

/** The panel: a little see-through, so it sits over the fight rather than on it. */
const HUD_PANEL: PanelStyle = { ...PANEL, alpha: 0.72 };
const PAD = 4;
/** A stat's cell: its icon, its value and room for the buff arrow. */
const CELL_W = 40;
const COL_GAP = 3;
const ROW_H = 10;
const PANEL_W = PAD * 2 + CELL_W * 2 + COL_GAP;
const PANEL_H = PAD * 2 + ROW_H * 3 - 1;
/** The folded chip and the "i" button: small square panels. */
const CHIP = 15;
const BTN_GAP = 2;

/** The card. */
const CARD_W = 236;
const CARD_PAD = 7;
const CLOSE = 13;
const ICON_BOX = 18;
const TEXT_X = CARD_PAD + ICON_BOX + 6;
const STAT_COL_W = Math.floor((CARD_W - CARD_PAD * 2 - 8 * 2) / 3);
/** The pixel font is fixed-width: 6 art pixels a letter with its outline shared. */
const CHAR_W = 6;
const LINE_H = 9;

const INK = 0xfff4d6;
const LAVENDER = 0xb8a8e8;
const SOFT = 0x9a8cd0;
const GOLD = 0xf4cf6a;
const GOLD_DARK = 0xb8742c;
const OUTLINE = 0x0b0818;
const UP = 0x8dff8a;
const DOWN = 0xff8a7a;

/** The six stats: which icon, a short name, and how the value reads. Columns of three, top to bottom. */
const STATS: { key: keyof HeroSheet; icon: number; name: string; show: (v: number) => string }[] = [
  { key: 'hp', icon: 0, name: 'HP', show: (v) => `${Math.round(v)}` },
  { key: 'damage', icon: 1, name: 'DMG', show: (v) => (v < 10 && Math.abs(v - Math.round(v)) > 0.05 ? v.toFixed(1) : `${Math.round(v)}`) },
  { key: 'defense', icon: 3, name: 'DEF', show: (v) => `${Math.round(v)}` },
  { key: 'rate', icon: 4, name: 'ATK/S', show: (v) => v.toFixed(1) },
  { key: 'speed', icon: 2, name: 'MOVE', show: (v) => `${Math.round(v)}` },
  { key: 'regen', icon: 5, name: 'REGEN', show: (v) => v.toFixed(1) },
];

/** -1, 0 or 1: whether a timed buff has this stat below, at or above where it would be. */
const trend = (now: number, base: number): number => (now > base * 1.001 + 1e-6 ? 1 : now < base * 0.999 - 1e-6 ? -1 : 0);

/** Break `text` into lines of at most `max` letters, at spaces. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.toUpperCase().split(/\s+/)) {
    if (!word) continue;
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function loadFolded(): boolean {
  try {
    return localStorage.getItem(KEY) === 'folded';
  } catch {
    return false;
  }
}

/** Whether the card is open, and how to close it: the pause menu's Esc closes the card first. */
export const statsCard = { open: false, close: () => {} };

export class StatsHud {
  private folded = loadFolded();
  private hidden = false;
  /** The panel's spot on screen and its scale (canvas px). */
  private x = 0;
  private y = 0;
  private z = 1;
  private root: Phaser.GameObjects.Container;
  private panelBg: Phaser.GameObjects.Image;
  private icons: Phaser.GameObjects.Image[];
  private values: Phaser.GameObjects.BitmapText[];
  private arrows: Phaser.GameObjects.Graphics;
  private chipBg: Phaser.GameObjects.Image;
  private chipIcon: Phaser.GameObjects.Image;
  private infoBg: Phaser.GameObjects.Image;
  private infoMark: Phaser.GameObjects.Graphics;
  private shown = '';

  private shade: Phaser.GameObjects.Graphics;
  private card: Phaser.GameObjects.Container;
  private cardH = 0;
  private cardStats: Phaser.GameObjects.BitmapText[] = [];
  private cardShown = '';
  private cardSized = '';
  /** The fight was held still by the card (solo), so closing it lets it go. */
  private held = false;

  /**
   * `sheet` reads the hero's stats as they stand, `onOpen` lets go of the
   * controls held when the card opens.
   */
  constructor(
    private scene: Phaser.Scene,
    private hero: CharacterDef,
    private sheet: () => { now: HeroSheet; base: HeroSheet } | null,
    private onOpen: () => void,
  ) {
    const icons = statIconsTexture(scene);
    this.panelBg = scene.add.image(0, 0, panelTexture(scene, 'hud_stats', PANEL_W, PANEL_H, HUD_PANEL)).setOrigin(0);
    this.icons = STATS.map((s, i) => scene.add.image(PAD + Math.floor(i / 3) * (CELL_W + COL_GAP), PAD + (i % 3) * ROW_H, icons, s.icon).setOrigin(0));
    this.values = STATS.map(() => pixelText(scene, 0, 0, ''));
    this.arrows = scene.add.graphics();
    this.chipBg = scene.add.image(0, 0, panelTexture(scene, 'hud_chip', CHIP, CHIP, HUD_PANEL)).setOrigin(0);
    this.chipIcon = scene.add.image(3, 3, icons, 0).setOrigin(0);
    this.infoBg = scene.add.image(0, 0, panelTexture(scene, 'hud_chip', CHIP, CHIP, HUD_PANEL)).setOrigin(0);
    this.infoMark = scene.add.graphics();
    this.root = scene.add.container(0, 0, [this.panelBg, ...this.icons, ...this.values, this.arrows, this.chipBg, this.chipIcon, this.infoBg, this.infoMark]);
    this.drawInfoMark();

    this.shade = scene.add.graphics().setDepth(59).setVisible(false);
    this.card = this.buildCard().setDepth(60).setVisible(false);
    statsCard.open = false;
    statsCard.close = () => this.setOpen(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Leaving the run stops the world too, so there is nothing to let go.
      this.held = false;
      statsCard.open = false;
      statsCard.close = () => {};
    });
  }

  get open(): boolean {
    return statsCard.open;
  }

  /** The panel folded or not: how wide it stands, for whatever sits beside it. */
  private get panelW(): number {
    return this.folded ? CHIP : PANEL_W;
  }

  /** Put the panel's top-left corner at (x, y) in canvas px, at scale `z`; `hidden` while building or fishing. */
  place(x: number, y: number, z: number, hidden: boolean): void {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.z = z;
    this.hidden = hidden;
    this.root.setPosition(this.x, this.y).setScale(z).setVisible(!hidden);
  }

  /** How tall the panel stands on screen, canvas px. */
  get height(): number {
    return (this.folded ? CHIP : PANEL_H) * this.z;
  }

  /** Handles a press; returns true if the panel or the card took it. */
  pointerDown(p: Phaser.Input.Pointer): boolean {
    if (this.open) {
      // A tap anywhere closes the card.
      this.setOpen(false);
      return true;
    }
    if (this.hidden) return false;
    const z = this.z;
    const slop = 3;
    const lx = (p.x - this.x) / z;
    const ly = (p.y - this.y) / z;
    const w = this.panelW;
    const h = this.folded ? CHIP : PANEL_H;
    const ix = w + BTN_GAP;
    if (lx >= ix - 1 && lx < ix + CHIP + slop && ly >= -slop && ly < CHIP + slop) {
      this.setOpen(true);
      return true;
    }
    if (lx >= -slop && lx < w && ly >= -slop && ly < h + slop) {
      this.folded = !this.folded;
      try {
        localStorage.setItem(KEY, this.folded ? 'folded' : 'open');
      } catch {
        // Private windows may refuse storage; it just isn't remembered.
      }
      this.shown = '';
      return true;
    }
    return false;
  }

  update(): void {
    const sheet = this.sheet();
    this.drawPanel(sheet);
    if (this.open) {
      // The pause menu resumes the world when it closes; the card still holds it.
      if (this.held && !this.scene.scene.isPaused('world')) this.scene.scene.pause('world');
      this.placeCard();
      this.drawCardStats(sheet);
    }
  }

  private setOpen(open: boolean): void {
    if (open === this.open) return;
    statsCard.open = open;
    this.card.setVisible(open);
    this.shade.setVisible(open);
    if (open) {
      this.onOpen();
      this.cardSized = this.cardShown = '';
      this.placeCard();
      this.drawCardStats(this.sheet());
      // Solo, the fight waits; online it goes on for the others.
      this.held = !session.active;
      if (this.held) this.scene.scene.pause('world');
    } else if (this.held) {
      this.held = false;
      this.scene.scene.resume('world');
    }
  }

  // ------------------------------------------------------------ The panel

  private drawPanel(sheet: { now: HeroSheet; base: HeroSheet } | null): void {
    const folded = this.folded;
    let state = `${folded}`;
    const trends: number[] = [];
    if (sheet && !folded) {
      STATS.forEach((s) => {
        const t = trend(sheet.now[s.key], sheet.base[s.key]);
        trends.push(t);
        state += `|${s.show(sheet.now[s.key])}${t}`;
      });
    }
    if (state === this.shown) return;
    this.shown = state;
    this.panelBg.setVisible(!folded);
    for (const o of [...this.icons, ...this.values, this.arrows]) o.setVisible(!folded);
    this.chipBg.setVisible(folded);
    this.chipIcon.setVisible(folded);
    this.infoBg.setX(this.panelW + BTN_GAP);
    this.infoMark.setX(this.panelW + BTN_GAP);
    if (folded || !sheet) return;
    const g = this.arrows.clear();
    STATS.forEach((s, i) => {
      const cx = PAD + Math.floor(i / 3) * (CELL_W + COL_GAP);
      const y = PAD + (i % 3) * ROW_H;
      const t = trends[i];
      // Values sit right after the icon; an arrow at the cell's end says a buff is at work.
      this.values[i]
        .setText(s.show(sheet.now[s.key]))
        .setPosition(cx + 11, y)
        .setTint(t > 0 ? UP : t < 0 ? DOWN : INK);
      if (!t) return;
      const ax = cx + CELL_W - 5;
      const ay = y + 2;
      const col = t > 0 ? UP : DOWN;
      // A small arrowhead pointing up or down, outlined like the letters.
      const rows = t > 0 ? [1, 3, 5] : [5, 3, 1];
      rows.forEach((w, r) => g.fillStyle(OUTLINE).fillRect(ax + (5 - w) / 2 - 1, ay + r - 1, w + 2, 3));
      rows.forEach((w, r) => g.fillStyle(col).fillRect(ax + (5 - w) / 2, ay + r, w, 1));
    });
  }

  /** A gold "i" on the button: a dot over a stem with a foot, outlined. */
  private drawInfoMark(): void {
    const g = this.infoMark.clear();
    const x = 6;
    g.fillStyle(OUTLINE).fillRect(x - 1, 2, 4, 4).fillRect(x - 2, 5, 5, 9);
    g.fillStyle(GOLD).fillRect(x, 3, 2, 2);
    g.fillStyle(GOLD).fillRect(x - 1, 6, 3, 1).fillRect(x, 7, 2, 5).fillRect(x - 1, 12, 4, 1);
    g.fillStyle(0xfff4c0).fillRect(x, 3, 1, 1).fillRect(x, 7, 1, 4);
  }

  // ------------------------------------------------------------- The card

  private buildCard(): Phaser.GameObjects.Container {
    const scene = this.scene;
    const hero = this.hero;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const g = scene.add.graphics();
    const textW = CARD_W - CARD_PAD * 2;

    // The hero's name (big when it fits) and role, over a line of their colour fading out.
    const title = hero.type.name.toUpperCase();
    const name = pixelText(scene, CARD_PAD, 6, title, INK, 2);
    if (name.width > textW - CLOSE - 4) name.setScale(1).setY(10);
    const role = pixelText(scene, CARD_PAD, 24, hero.role, LAVENDER);
    for (let x = 0; x < textW; x++) {
      const a = 1 - x / textW;
      if (a < bayer(x, 0) * 0.9) continue;
      g.fillStyle(hero.accent, 0.35 + a * 0.65).fillRect(CARD_PAD + x, 34, 1, 1);
    }
    g.fillStyle(OUTLINE, 0.8).fillRect(CARD_PAD, 35, textW, 1);
    const closeBg = scene.add.image(CARD_W - CARD_PAD - CLOSE + 2, 4, panelTexture(scene, 'bag_close', CLOSE, CLOSE, PANEL)).setOrigin(0);
    const closeX = pixelText(scene, 0, 7, 'X', 0xfff4d6);
    closeX.setX(closeBg.x + Math.round((CLOSE - closeX.width) / 2));
    parts.push(name, role, closeBg, closeX);

    // The stats with their names, in three columns of two; values fill in as they change.
    const statsY = 41;
    const icons = statIconsTexture(scene);
    this.cardStats = STATS.map((s, i) => {
      const x = CARD_PAD + (i % 3) * (STAT_COL_W + 8);
      const y = statsY + Math.floor(i / 3) * 10;
      parts.push(scene.add.image(x - 1, y - 1, icons, s.icon).setOrigin(0));
      parts.push(pixelText(scene, x + 10, y, s.name, SOFT));
      return pixelText(scene, x + STAT_COL_W, y, '');
    });
    parts.push(...this.cardStats);
    const ruleY = statsY + 21;
    g.fillStyle(OUTLINE).fillRect(CARD_PAD, ruleY, textW, 1);
    g.fillStyle(0x43356e).fillRect(CARD_PAD, ruleY + 1, textW, 1);

    // The three moves: an icon in a recessed box, the move's name with what it is at the right, and what it does.
    const info = ABILITY_INFO[`${hero.id}.${hero.type.id}`];
    const ult = ultFor(hero);
    const moves = [
      { kind: 'Attack', name: hero.attack, text: info?.attack ?? '', gold: false },
      { kind: 'Ability', name: hero.special, text: info?.ability ?? '', gold: false },
      { kind: 'Special', name: ult.name, text: info?.special ?? '', gold: true },
    ];
    const box = (x: number, y: number, rim: number) => {
      g.fillStyle(OUTLINE).fillRect(x, y, ICON_BOX, ICON_BOX);
      g.fillStyle(0x140f2a).fillRect(x + 1, y + 1, ICON_BOX - 2, ICON_BOX - 2);
      g.fillStyle(rim).fillRect(x + 1, y + ICON_BOX - 2, ICON_BOX - 2, 1);
    };
    const maxChars = Math.floor((CARD_W - CARD_PAD - TEXT_X + 1) / CHAR_W);
    let y = ruleY + 6;
    moves.forEach((m, i) => {
      const lines = wrap(m.text, maxChars);
      const h = Math.max(ICON_BOX, LINE_H + 2 + lines.length * LINE_H);
      if (m.gold) {
        // The Special on a gold-rimmed strip, as on the hero select.
        const sx = CARD_PAD - 3;
        const sw = CARD_W - sx * 2;
        const sy = y - 3;
        const sh = h + 6;
        g.fillStyle(OUTLINE).fillRect(sx, sy, sw, sh);
        g.fillStyle(GOLD_DARK).fillRect(sx + 1, sy + 1, sw - 2, sh - 2);
        g.fillStyle(0x1c1538).fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
        g.fillStyle(0xffe08a, 0.7).fillRect(sx + 2, sy + 1, sw - 4, 1);
        g.fillStyle(0xffe08a, 0.08).fillRect(sx + 2, sy + 2, sw - 4, 6);
      }
      box(CARD_PAD, y, m.gold ? 0x8a4e22 : 0x43356e);
      const cx = CARD_PAD + ICON_BOX / 2;
      const cy = y + ICON_BOX / 2;
      if (i === 0) {
        const a = hero.buttons.attack;
        const icon = scene.add.sprite(cx, cy, a.texture, a.frame).setBlendMode(Phaser.BlendModes.ADD);
        if (a.anim) icon.play(a.anim);
        parts.push(icon);
      } else if (i === 1) parts.push(scene.add.image(cx, cy, hero.buttons.special.texture).setBlendMode(Phaser.BlendModes.ADD));
      else if (scene.textures.exists(ult.icon)) parts.push(scene.add.image(cx, cy, ult.icon));

      const right = CARD_W - CARD_PAD;
      let kindRight = right;
      if (m.gold) {
        // Its energy cost at the right, with a bolt.
        const cost = pixelText(scene, 0, y, `${ult.def.cost}`, GOLD);
        cost.setX(right - cost.width);
        const bx = cost.x - 7;
        ['..##', '.##.', '####', '.##.', '##..'].forEach((row, r) =>
          [...row].forEach((c, x) => c === '#' && g.fillStyle(0xffe08a).fillRect(bx + x, y + 1 + r, 1, 1)),
        );
        parts.push(cost);
        kindRight = bx - 5;
      }
      const kind = pixelText(scene, 0, y, m.kind, m.gold ? GOLD : SOFT);
      kind.setX(kindRight - kind.width);
      const nameMax = Math.floor((kind.x - 6 - TEXT_X + 1) / CHAR_W);
      let label = m.name.toUpperCase();
      if (label.length > nameMax) label = `${label.slice(0, Math.max(1, nameMax - 1)).trimEnd()}.`;
      parts.push(kind, pixelText(scene, TEXT_X, y, label, INK));
      lines.forEach((line, l) => parts.push(pixelText(scene, TEXT_X, y + LINE_H + 2 + l * LINE_H, line, LAVENDER)));
      y += h + (i === 1 ? 10 : 7);
    });

    // A quiet note on closing it.
    const note = pixelText(scene, 0, y, controls.mouse ? 'Click anywhere or press Esc to close' : 'Tap anywhere to close', 0x6a5ea0);
    note.setX(Math.round((CARD_W - note.width) / 2));
    parts.push(note);
    this.cardH = y + LINE_H + 5;
    const bg = scene.add.image(0, 0, panelTexture(scene, `stats_card_${this.cardH}`, CARD_W, this.cardH, PANEL)).setOrigin(0);
    return scene.add.container(0, 0, [bg, g, ...parts]);
  }

  /** Centre the card at the menus' size, a step smaller if the screen is too short for it. */
  private placeCard(): void {
    const { width, height } = this.scene.scale;
    const key = `${width} ${height}`;
    if (key === this.cardSized) return;
    this.cardSized = key;
    let z = menuZoom(width, height);
    while (z > 1 && (this.cardH * z > height - 8 || CARD_W * z > width - 8)) z--;
    this.card.setScale(z).setPosition(Math.round((width - CARD_W * z) / 2), Math.round((height - this.cardH * z) / 2));
    this.shade.clear().fillStyle(0x05040e, 0.5).fillRect(0, 0, width, height);
  }

  private drawCardStats(sheet: { now: HeroSheet; base: HeroSheet } | null): void {
    if (!sheet) return;
    const state = STATS.map((s) => `${s.show(sheet.now[s.key])}${trend(sheet.now[s.key], sheet.base[s.key])}`).join('|');
    if (state === this.cardShown) return;
    this.cardShown = state;
    STATS.forEach((s, i) => {
      const t = trend(sheet.now[s.key], sheet.base[s.key]);
      const text = this.cardStats[i].setText(s.show(sheet.now[s.key])).setTint(t > 0 ? UP : t < 0 ? DOWN : INK);
      text.setX(CARD_PAD + (i % 3) * (STAT_COL_W + 8) + STAT_COL_W - text.width);
    });
  }
}
