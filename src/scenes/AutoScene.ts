import Phaser from 'phaser';
import { menuZoom } from '../game/display';
import { classById } from '../game/characters';
import { lastLookOf } from '../game/skins';
import { collection } from '../game/collection';
import { account } from '../game/cloud';
import { sound } from '../audio';
import { titleBitmap } from '../art/font';
import { autoBackdrop, autoBench, autoBoard, autoIcons, BENCH_SLOT, boardSize, CELL_H, CELL_W, FACE, RIM, traitIcons } from '../art/autoArt';
import { BUTTON_GOLD, BUTTON_PLAIN, PANEL, PANEL_INSET, PixelButton, panelTexture, pixelText, type PanelStyle } from '../ui/widgets';
import { hex } from '../art/pixel';
import { cropToWindow, fitLine } from './SelectScene';
import { onlineStyles } from '../ui/onlineForm';
import { session, type Msg } from '../net/session';
import { Battle, COLS, HALF, ROWS, TICK, type Placed } from '../game/auto/sim';
import { AutoPlayer, aiPlan, BENCH_SIZE, cellKey, MAX_LEVEL, PLAN_SECONDS, REROLL_COST, sellValue, SHOP_SIZE, START_HP, START_LEVEL, XP_COST, XP_NEXT, type Piece } from '../game/auto/match';
import { COST_COLORS, traitCounts, TRAITS, unitDef, type TraitId } from '../game/auto/units';
import { BOON_SECONDS, boonDef, cleanBoons, isBoonRound, offerBoons, roundTier, TIER_NAMES, type BoonTier } from '../game/auto/boons';
import { BOON_LINE, boonBack, boonBadge, boonCard, boonIcon, boonLayout, tierAccent } from '../art/boonArt';
import { FightView, UnitView, cellPt, styleOf, type BoardFrame } from '../game/auto/view';
import { FxLayer } from '../game/auto/fx';
import { pieceNumbers, spellText } from '../game/auto/info';
import { AUTO_ARENA, BOARD_WAIT_MS, cleanBoard, cleanRound, cleanSeats } from '../game/auto/online';
import { drawBouts, healthAfter, MAX_BOTS, MAX_SEATS, ordinal, placesAfter, type Bout, type RoundResult, type SeatInfo } from '../game/auto/table';
import { AUTO_BATTLE_SCENE } from './ModeScene';
import { soundCorner } from './SoundScene';
import { settings } from '../game/settings';
import { fpsBottom } from './FpsScene';

// Auto Battle: a 1v1 of teams, like an auto chess. Each round the player buys
// heroes from a shop of five, sets up to six of them out on their half of a
// floating stone dais, and the fight plays itself. Three of a kind star up
// into one stronger hero. A lost round costs health; the last player standing
// wins. Played against a practice rival here, or a friend online by room code
// (see game/auto/online.ts). The rules are in game/auto/match.ts, the fight
// in game/auto/sim.ts, the heroes' kits in game/auto/units.ts.

// The battlefield is the page: the board and bench are drawn at their own,
// bigger zoom (a whole number of screen pixels per art pixel, so they stay
// crisp) in whatever room the edges leave. The shop is always a tray along
// the bottom: level on its left, the five cards, gold and reroll on its
// right. On a wide screen the board stands in the middle of the page, as big
// as the height allows, with the bench as a 2x4 dock on its right and the
// traits beyond, and the players, the round and Fight in a column on its
// left; on a tall one the bench sits under the board and the players and
// traits go across the top. Whichever lets the board be bigger wins.

/** Room over the board's top row for the heroes standing there (world px). */
const HEAD_ROOM = 14;
/** On a wide screen the board is sized to the room over the tray, which may hide the dais' stone face and the rock
 * under it: only the tiles and this sliver of rim must show. The top may give up part of the head room, as the
 * tallest heroes' crowns on the rival's back row are all that would go. */
const RIM_SHOW = 2;
const HEAD_MIN = 8;
/** A top bar row (the tall layout's). */
const TOP_H = 15;
/** The wide layout's left column (players, round, Fight): at least this, more when the centred board leaves it. */
const LEFT_MIN = 84;
const LEFT_MAX = 120;
/** The narrowest trait column on the right. */
const TRAIT_MIN = 36;
/** The tray's level and gold blocks either side of the cards: a readout over a button. A wide tray gives up a
 * little of its height (never under the min) when that lets the board up a size. */
const BLOCK_W = 72;
const BLOCK_H = 40;
const BLOCK_H_MIN = 36;
/** Shop cards: as tall as the blocks in the wide tray; in the tall one, from this up to the max as room allows. */
const CARD_H_ROW = 46;
const CARD_H_ROW_MAX = 64;
const CARD_W_MAX = 78;
const GAP = 2;
/** The round and clock: two lines and a bar in the wide layout's trait column, one line between the players in the tall one. */
const BANNER_H = 24;
/** A player's plate. */
const PLATE_H = 14;
const BANNER_W_TALL = 66;
const PAD = 3;
const FIGHT_H = 20;
/** The tall layout's trait chips. */
const CHIP_W = 34;
const CHIP_H = 11;
const TRAIT_ROW = 11;
/** A row of the wide layout's standings, at a table of more than two. */
const STAND_ROW = 10;
/** The hero card that pops up for a tapped piece (or a hovered shop card). */
const INFO_W = 142;
const INFO_H = 106;
/** How far over and under its feet (world px) a press still picks up a hero. */
const PICK_ABOVE = 26;
const PICK_BELOW = 5;
/** A shop card for a hero already held shines: a sweep of light this often (ms), and its gilt rim breathing. */
const SHINE_MS = 1700;
const SHINE_W = 5;
/** A press must move this far (art px) to become a drag. */
const DRAG_SLOP = 4;
/** Seconds the result stands before the next round. */
const RESULT_SECONDS = 2.6;
/** Seconds a finished fight lingers on its winners' cheer. */
const LINGER = 1.3;
/** Gems for winning a whole match. */
const WIN_GEMS = { ai: 5, online: 15 };
/** The boon cards: widest, gap between, how long apart they're dealt, and when each turns over. */
const BOON_CARD_MAX = 118;
const BOON_DEAL_MS = 150;
const BOON_FLIP_MS = 460;
/** Light motes rising behind the cards, and how often a sheen crosses a card (s). */
const BOON_MOTES = 36;
const BOON_SHEEN = [3.4, 2.6, 2.2];
/** A kept boon's badge, and its step in a row. */
const BADGE = 14;
const BADGE_STEP = 15;
const RIVAL_NAMES = ['Morgana', 'Tharn', 'Brenna', 'Old Wick', 'Hazel', 'Nyx', 'Sir Aldric', 'Vesper'];

const INK = 0xfff4d6;
const LAVENDER = 0xb8a8e8;
const SOFT = 0x8a80b8;
const GOLD = 0xf4cf6a;
const RED = 0xff6a6a;
const GREEN = 0x7aff8a;

type Phase = 'lobby' | 'wait' | 'plan' | 'fight' | 'result' | 'over';

/** A boon card on show: the box it flips in (centred), its face and back, and what moves on it. */
interface BoonCardView {
  id: string;
  tier: BoonTier;
  box: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  sheen: Phaser.GameObjects.Graphics;
  flash: Phaser.GameObjects.Rectangle;
  hit: Phaser.GameObjects.Zone;
  w: number;
  h: number;
  iconY: number;
  baseY: number;
  t: number;
  hover: boolean;
}

/** A seat at the table as a match goes: health, level, the board it last fought with, where it finished (0: still
 * in), and, on the host, a bot's own player. */
interface Seat extends SeatInfo {
  /** The boons this seat holds (they go into its fights). */
  boons: string[];
  hp: number;
  level: number;
  board: Placed[];
  place: number;
  ai: AutoPlayer | null;
}

/** `n` bot names, none of them already at the table. */
function botNames(n: number, taken: string[] = []): string[] {
  const free = RIVAL_NAMES.filter((x) => !taken.includes(x));
  const out: string[] = [];
  while (out.length < n) {
    const pool = free.length ? free : RIVAL_NAMES;
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool[i]);
    if (free.length) free.splice(i, 1);
  }
  return out;
}

const BOTS_KEY = 'pixel-battle.autoBots';

/** Practice bots, as last picked on this device (one if never). */
function loadBots(): number {
  try {
    const n = Number(localStorage.getItem(BOTS_KEY));
    return n >= 1 && n <= MAX_BOTS ? Math.floor(n) : 1;
  } catch {
    return 1;
  }
}

function saveBots(n: number): void {
  try {
    localStorage.setItem(BOTS_KEY, String(n));
  } catch {
    // Remembering it is only a nicety.
  }
}
type Mode = 'ai' | 'online';
type Drop = { bench: number } | { cell: number } | { sell: true } | null;

const panelStyle = (border: number, lit: number): PanelStyle => ({
  ...PANEL,
  border: hex(`#${border.toString(16).padStart(6, '0')}`),
  borderLit: hex(`#${lit.toString(16).padStart(6, '0')}`),
});

const shade = (c: number, k: number): number => {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
};

/** Play a sound; one that fails is no reason to stop the game. */
function play(fn: () => void): void {
  try {
    fn();
  } catch {
    // No sound, then.
  }
}

/** One of the shop's five cards: the hero in a window, its cost and traits over it, its name under. Sized by the layout. */
class Card extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  private win: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.BitmapText;
  private cost: Phaser.GameObjects.BitmapText;
  private coin: Phaser.GameObjects.Image;
  private badges: Phaser.GameObjects.Image[];
  private pair: Phaser.GameObjects.Graphics;
  private shine: Phaser.GameObjects.Graphics;
  /** A copy of this hero is already on the bench or the board: the card shines. */
  private held = false;
  key_: string | null = null;
  /** The card's size (not Container's own width and height, which mean something else). */
  cw = 60;
  chh = 40;

  constructor(scene: Phaser.Scene, onTap: () => void, onHover: (on: boolean) => void) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.win = scene.add.graphics();
    this.sprite = scene.add.sprite(0, 0, '__DEFAULT');
    this.glow = scene.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.pair = scene.add.graphics();
    this.shine = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.badges = [0, 1].map((i) => scene.add.image(4 + i * 10, 4, 'ab_trait_arcane').setOrigin(0));
    this.coin = scene.add.image(0, 0, 'ab_coin').setOrigin(0);
    this.cost = pixelText(scene, 0, 0, '', GOLD);
    this.label = pixelText(scene, 3, 0, '');
    this.add([this.bg, this.win, this.sprite, this.glow, this.shine, this.pair, ...this.badges, this.coin, this.cost, this.label]);
    let down = false;
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => (down = true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (down) onTap();
      down = false;
    });
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (p: Phaser.Input.Pointer) => !p.wasTouch && onHover(true));
    this.bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      down = false;
      onHover(false);
    });
    scene.add.existing(this);
  }

  /** Set the card's size; `show` then draws it at that size. */
  resize(w: number, h: number): void {
    if (w === this.cw && h === this.chh && this.bg.input) return;
    this.cw = w;
    this.chh = h;
    // The hit area is taken from the texture when made interactive, so it is made again at the new size.
    this.bg.removeInteractive();
    this.bg.setTexture(panelTexture(this.scene, `ab_card_empty_${w}x${h}`, w, h, PANEL_INSET));
    this.bg.setInteractive({ useHandCursor: true });
  }

  /**
   * Show a hero for sale (null: an empty slot). `afford`: dim when it can't be bought. `owned`: unstarred copies
   * already held, marked with pips. `held`: any copy is on the bench or board, so the card shines.
   */
  show(key: string | null, afford: boolean, owned: number, held = false): void {
    this.key_ = key;
    this.held = !!key && held;
    if (!this.held) this.shine.clear();
    const w = this.cw;
    const h = this.chh;
    const on = !!key;
    for (const o of [this.win, this.sprite, this.glow, this.label, this.coin, this.cost, ...this.badges, this.pair]) o.setVisible(on);
    if (!key) {
      this.bg.setTexture(panelTexture(this.scene, `ab_card_empty_${w}x${h}`, w, h, PANEL_INSET));
      return;
    }
    const d = unitDef(key);
    const st = styleOf(key, lookFor(key));
    const col = COST_COLORS[d.cost];
    this.bg.setTexture(panelTexture(this.scene, `ab_card_${d.cost}_${w}x${h}`, w, h, panelStyle(shade(col, 0.55), col)));
    // The window: the hero's colour, darkening down, a light behind and a floor.
    const winH = h - 15;
    const g = this.win.clear();
    const acc = st.ch.accent;
    for (let y = 0; y < winH; y++) g.fillStyle(shade(acc, 0.12 + (y / winH) * 0.24), 1).fillRect(3, 3 + y, w - 6, 1);
    g.fillStyle(shade(acc, 0.6), 0.25).fillEllipse(w / 2, 3 + winH * 0.55, Math.min(w - 10, 34), winH * 0.9);
    g.fillStyle(0x0b0818, 0.6).fillRect(3, 3 + winH, w - 6, 1);
    // The cost in a dark chip in the top right.
    g.fillStyle(0x0b0818, 0.75).fillRect(w - 17, 3, 14, 10);
    // A short window shows the hero from the waist up: its legs go under the name.
    const legs = Math.max(0, Math.min(10, 27 - winH));
    const pv = st.ch.preview;
    const oy = pv.originY ?? 31 / 32;
    this.sprite.setTexture(pv.texture).setOrigin(0.5, oy).setPosition(Math.round(w / 2), 3 + winH + legs);
    cropToWindow(this.sprite, pv, w - 6, winH + legs, -legs, 1);
    if (this.sprite.anims.currentAnim?.key !== pv.idle) this.sprite.play(pv.idle);
    this.glow.setVisible(!!pv.glow);
    if (pv.glow) {
      this.glow.setTexture(pv.glow).setOrigin(0.5, oy).setPosition(Math.round(w / 2), 3 + winH + legs);
      cropToWindow(this.glow, pv, w - 6, winH + legs, -legs, 1);
    }
    this.label.setText(fitLine(this.label, st.ch.type.name, w - 6)).setTint(afford ? INK : SOFT).setPosition(3, h - 10);
    this.coin.setPosition(w - 16, 5);
    this.cost.setText(`${d.cost}`).setPosition(w - 9, 4);
    this.badges[0].setTexture(`ab_trait_${d.origin}`);
    this.badges[1].setTexture(`ab_trait_${d.role}`);
    this.sprite.setTint(afford ? 0xffffff : 0x6a6488);
    this.glow.setAlpha(afford ? 1 : 0.3);
    // Copies held: a pip for each under the cost, so a pair to finish shows at a glance.
    const pg = this.pair.clear();
    for (let i = 0; i < Math.min(2, owned); i++) {
      pg.fillStyle(0x0b0818, 1).fillRect(w - 9 - i * 5, 14, 5, 5);
      pg.fillStyle(0xffe08a, 1).fillRect(w - 8 - i * 5, 15, 3, 3);
    }
  }

  tick(): void {
    if (this.key_ && this.glow.visible) this.glow.setFrame(this.sprite.frame.name);
    if (this.held) this.drawShine(this.scene.time.now);
  }

  /**
   * The shine of a held hero: a slanted band of light sweeping across the card
   * now and then, a faint gold wash, and the rim breathing gold, so a pair or
   * a star-up in the making catches the eye without shouting.
   */
  private drawShine(now: number): void {
    const g = this.shine.clear();
    const w = this.cw;
    const h = this.chh;
    const breath = 0.5 + 0.5 * Math.sin((now / SHINE_MS) * Math.PI * 2);
    g.fillStyle(0xffd86a, 0.05 + 0.04 * breath).fillRect(2, 2, w - 4, h - 4);
    g.lineStyle(1, 0xffe08a, 0.25 + 0.35 * breath).strokeRect(1.5, 1.5, w - 3, h - 3);
    // The sweep runs over the first half of each beat, from beyond the left edge to beyond the right.
    const k = (now % SHINE_MS) / SHINE_MS / 0.5;
    if (k >= 1) return;
    const slant = Math.round(h / 2);
    const x0 = Math.round(-SHINE_W - slant + k * (w + SHINE_W * 2 + slant));
    for (let y = 2; y < h - 2; y++) {
      const x = x0 + Math.round((h - y) / 2);
      // The band, then its brighter middle on top, each cut to the card's inside.
      const span = (from: number, len: number, a: number) => {
        const l = Math.max(2, from);
        const r = Math.min(w - 2, from + len);
        if (r > l) g.fillStyle(0xfff4d6, a).fillRect(l, y, r - l, 1);
      };
      span(x, SHINE_W, 0.14);
      span(x + 1, 2, 0.18);
    }
  }
}

/** The look a piece of this player's wears: the one its type was last worn in. */
function lookFor(key: string): string {
  const d = unitDef(key);
  const cls = classById(d.cls);
  const type = cls.types.find((t) => t.id === d.type) ?? cls.types[0];
  const l = lastLookOf(cls, type);
  return l.skin?.id ?? l.type.id;
}

/** Wrap text to lines at most `w` px wide (the pixel font runs about 5 px a letter). */
function wrap(probe: Phaser.GameObjects.BitmapText, text: string, w: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (probe.setText(next.toUpperCase()).width > w && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export class AutoScene extends Phaser.Scene {
  private z = 2;
  private vw = 0;
  private vh = 0;
  private back = 'modes';
  private mode: Mode = 'ai';
  private phase: Phase = 'lobby';
  private me!: AutoPlayer;
  /** Everyone at the table (this player, other people, bots), and which seat is this player's. */
  private seats: Seat[] = [];
  private mySeat = 0;
  /** Who this player fights (or last fought), and whether as a ghost of their board. */
  private foe = 1;
  private foeGhost = false;
  /** The foe as the plates show it. */
  private get rival(): { name: string; hp: number; level: number } {
    const s = this.seats[this.foe];
    return s ? { name: this.foeGhost ? `Ghost of ${s.name}` : s.name, hp: s.hp, level: s.level } : { name: 'Rival', hp: START_HP, level: START_LEVEL };
  }
  /** Out of a match that goes on (online), watching. */
  private out = false;
  /** The match's end has been shown. */
  private ended = false;
  /** Bots for practice (remembered on this device), and for a room being set up. */
  private botCount = loadBots();
  private roomBots = 0;
  private roomCode: string | null = null;
  /** Online, the room's host (a guest's match ends if the host goes). */
  private hostPeer = -1;
  private round = 0;
  private timer = 0;
  private timerMax = 1;
  private ready = false;
  /** People (by room id) who said they're ready this round. */
  private readyIds = new Set<number>();
  private wonLast = false;
  private leaving = false;
  private host = false;
  private off: (() => void) | null = null;
  /** The host: people whose boards it's waiting for, how long it waits, and the round already fought. */
  private awaiting = new Set<number>();
  private waitBoard: Phaser.Time.TimerEvent | null = null;
  private foughtRound = 0;
  /** The round being played, until this player's fight ends; and the host's call to the next round. */
  private pendingRound: RoundResult | null = null;
  private nextRound: Phaser.Time.TimerEvent | null = null;

  // The world: the board, bench, heroes and effects, drawn at their own zoom `s` (world px to page px) from (wx, wy).
  private sky!: Phaser.GameObjects.Image;
  private world!: Phaser.GameObjects.Container;
  private s = 1;
  private wx = 0;
  private wy = 0;
  /** The wide layout (bench beside the board, shop on the right), else the tall one. */
  private wide = true;
  private benchCols = BENCH_SIZE;
  private lobbyHeroes: UnitView[] = [];
  private boardImg!: Phaser.GameObjects.Image;
  private benchImg!: Phaser.GameObjects.Image;
  private marks!: Phaser.GameObjects.Graphics;
  private layer!: Phaser.GameObjects.Container;
  private fxUnder!: Phaser.GameObjects.Container;
  private fxOver!: Phaser.GameObjects.Container;
  private fx!: FxLayer;
  private torches: Phaser.GameObjects.Image[] = [];
  private frame: BoardFrame = { x: 0, y: 0, cw: CELL_W, ch: CELL_H, flip: false };
  /** The match is settled (someone is out): a leaving rival no longer changes it. */
  private decided = false;
  private benchX = 0;
  private benchY = 0;
  private views = new Map<number, UnitView>();
  private fight: FightView | null = null;
  private fightDone = 0;

  // The page.
  private hud!: Phaser.GameObjects.Container;
  private plates!: Phaser.GameObjects.Graphics;
  private trayG!: Phaser.GameObjects.Graphics;
  private meText!: Phaser.GameObjects.BitmapText[];
  private rivalText!: Phaser.GameObjects.BitmapText[];
  private hearts: Phaser.GameObjects.Image[] = [];
  private traitList!: Phaser.GameObjects.Container;
  /** Everyone at a bigger table, in the wide layout's column; and how far down it may run. */
  private standings!: Phaser.GameObjects.Container;
  private standBottom = 0;
  private banner!: Phaser.GameObjects.Graphics;
  private roundText!: Phaser.GameObjects.BitmapText;
  private phaseText!: Phaser.GameObjects.BitmapText;
  private info!: Phaser.GameObjects.Container;
  private infoBg!: Phaser.GameObjects.Image;
  private infoHit!: Phaser.GameObjects.Zone;
  private readyBtn: PixelButton | null = null;
  private leaveBtn!: PixelButton;
  private cards: Card[] = [];
  private lvlBox!: Phaser.GameObjects.Container;
  private goldBox!: Phaser.GameObjects.Container;
  private blockW = BLOCK_W;
  /** The wide layout's left column width. */
  private leftW = LEFT_MIN;
  /** The shop tray along the bottom, page px. */
  private tray = new Phaser.Geom.Rectangle();
  private lvlText!: Phaser.GameObjects.BitmapText;
  private xpText!: Phaser.GameObjects.BitmapText;
  private xpBar!: Phaser.GameObjects.Graphics;
  private goldText!: Phaser.GameObjects.BitmapText;
  private xpBtn!: PixelButton;
  private rollBtn!: PixelButton;
  private freezeBtn!: PixelButton;
  /** Frost round the shop's cards while it's frozen. */
  private frost!: Phaser.GameObjects.Graphics;
  private sellZone!: Phaser.GameObjects.Container;
  private sellText!: Phaser.GameObjects.BitmapText;
  private probe!: Phaser.GameObjects.BitmapText;
  /** Where the shop's cards are (drop a piece there to sell it), the traits go, and the hero card pops up, in page px. */
  private shopRect = new Phaser.Geom.Rectangle();
  private traitRect = new Phaser.Geom.Rectangle();
  private infoAt = { x: 0, y: 0 };
  private topH = TOP_H;
  /** The tall layout's second top row, under the mute button; the round banner's spot. */
  private row2 = TOP_H;
  private bannerAt = { x: 0, y: 0, w: 0 };
  private overlay: Phaser.GameObjects.Container | null = null;
  private lobby: Phaser.GameObjects.Container | null = null;
  private selected: { key: string; star: number; look: string } | null = null;
  /** Boons offered to this player and not yet picked; the cards on show; the board looked at past them; a kept boon tapped. */
  private boonOffer: string[] | null = null;
  private boonView: Phaser.GameObjects.Container | null = null;
  private boonCards: BoonCardView[] = [];
  private boonPeek = false;
  private boonLive = false;
  private boonTimer: Phaser.GameObjects.BitmapText | null = null;
  private boonMotes: { x: number; y: number; v: number; a: number; c: number }[] = [];
  private boonMoteG: Phaser.GameObjects.Graphics | null = null;
  private boonBack: PixelButton | null = null;
  private boonShown: string | null = null;
  private hovered: string | null = null;

  // Dragging a piece.
  private press: { piece: Piece; view: UnitView; x: number; y: number; dragging: boolean } | null = null;

  constructor() {
    super(AUTO_BATTLE_SCENE);
  }

  init(data: { back?: string } = {}): void {
    // Back goes to the game mode menu unless whoever opened this says otherwise.
    this.back = data.back ?? 'modes';
  }

  create(): void {
    this.leaving = false;
    this.phase = 'lobby';
    this.views = new Map();
    this.fight = null;
    this.overlay = null;
    this.lobby = null;
    this.torches = [];
    this.lobbyHeroes = [];
    this.readyBtn = null;
    this.cards = [];
    this.hearts = [];
    this.press = null;
    this.selected = null;
    this.cameras.main.setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 260 });
    // The home screen goes on warming arenas underneath, unseen.
    this.scene.setVisible(false, 'home');

    autoIcons(this);
    traitIcons(this, Object.fromEntries(Object.entries(TRAITS).map(([k, t]) => [k, t.color])) as Record<TraitId, number>);
    for (const [key, text] of [
      ['ab_title', 'Auto Battle'],
      ['ab_victory', 'Victory'],
      ['ab_defeat', 'Defeat'],
      ['ab_draw', 'Draw'],
    ])
      if (!this.textures.exists(key)) this.textures.addCanvas(key, titleBitmap(text).toCanvas());

    this.sky = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.world = this.add.container(0, 0);
    this.boardImg = this.add.image(0, 0, autoBoard(this, COLS, ROWS)).setOrigin(0);
    this.benchImg = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
    this.marks = this.add.graphics();
    this.fxUnder = this.add.container(0, 0);
    this.layer = this.add.container(0, 0);
    this.fxOver = this.add.container(0, 0);
    this.fx = new FxLayer(this, this.fxUnder, this.fxOver);
    for (let i = 0; i < 4; i++) this.torches.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040));
    this.world.add([this.boardImg, ...this.torches, this.benchImg, this.marks, this.fxUnder, this.layer, this.fxOver]);
    this.probe = pixelText(this, 0, 0, '').setVisible(false);
    this.buildHud();

    const kb = this.input.keyboard;
    kb?.on('keydown-D', () => this.reroll());
    kb?.on('keydown-L', () => this.toggleFreeze());
    kb?.on('keydown-F', () => this.buyXp());
    kb?.on('keydown-SPACE', () => this.toggleReady());
    kb?.on('keydown-ESC', () => this.leave());
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.off?.();
      this.off = null;
      document.getElementById('online')?.remove();
    });
    this.showLobby();
  }

  // ---------------------------------------------------------------- the page

  private buildHud(): void {
    this.hud = this.add.container(0, 0);
    this.trayG = this.add.graphics();
    this.plates = this.add.graphics();
    this.meText = [pixelText(this, 0, 0, ''), pixelText(this, 0, 0, '', GOLD), pixelText(this, 0, 0, '', LAVENDER)];
    this.rivalText = [pixelText(this, 0, 0, ''), pixelText(this, 0, 0, '', GOLD), pixelText(this, 0, 0, '', LAVENDER)];
    this.hearts = [this.add.image(0, 0, 'ab_heart').setOrigin(0), this.add.image(0, 0, 'ab_heart').setOrigin(0)];
    this.traitList = this.add.container(0, 0);
    this.standings = this.add.container(0, 0);
    this.banner = this.add.graphics();
    this.roundText = pixelText(this, 0, 0, '', GOLD);
    this.phaseText = pixelText(this, 0, 0, '', LAVENDER);
    this.leaveBtn = new PixelButton(this, 'Leave', 34, 13, BUTTON_PLAIN, 'ab_leave', () => this.leave());
    this.lvlBox = this.add.container(0, 0);
    this.goldBox = this.add.container(0, 0);
    for (let i = 0; i < SHOP_SIZE; i++)
      this.cards.push(
        new Card(
          this,
          () => this.buy(i),
          (on) => {
            this.hovered = on ? this.me?.shop[i] ?? null : null;
            this.refreshInfo();
          },
        ),
      );
    // Over the shop while a piece is dragged: drop here to sell.
    this.frost = this.add.graphics();
    this.sellZone = this.add.container(0, 0).setVisible(false);
    this.sellText = pixelText(this, 0, 0, '', GOLD, 2);
    // The hero card pops up over everything else; a tap on it puts it away.
    this.infoBg = this.add.image(0, 0, panelTexture(this, 'ab_info', INFO_W, INFO_H, { ...PANEL, alpha: 1 })).setOrigin(0);
    this.info = this.add.container(0, 0);
    this.infoHit = this.add.zone(0, 0, INFO_W, INFO_H).setOrigin(0).setInteractive();
    this.infoHit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.selected = null;
      this.boonShown = null;
      this.hovered = null;
      this.refreshInfo();
    });
    this.hud.add([this.trayG, this.plates, ...this.meText, ...this.rivalText, ...this.hearts, this.traitList, this.standings, this.banner, this.roundText, this.phaseText, this.leaveBtn, this.lvlBox, this.goldBox, ...this.cards, this.frost, this.sellZone, this.infoBg, this.info, this.infoHit]);
  }

  /**
   * The tray's two blocks, `w` wide: the level (LVL 5, xp toward the next on a
   * bar, a button to buy xp) and the gold (a big readout, the reroll button).
   */
  private buildBlocks(w: number, h = BLOCK_H): void {
    this.blockW = w;
    this.lvlBox.removeAll(true);
    this.goldBox.removeAll(true);
    const bw = w - 6;
    const lvlBg = this.add.image(0, 0, panelTexture(this, `ab_lvl_${w}x${h}`, w, h, PANEL)).setOrigin(0);
    this.lvlText = pixelText(this, 4, 4, '', INK);
    this.xpBar = this.add.graphics();
    this.xpText = pixelText(this, 0, 4, '', LAVENDER);
    this.xpBtn = new PixelButton(this, `XP ${XP_COST}`, bw, 17, BUTTON_PLAIN, `ab_xp_${bw}`, () => this.buyXp());
    this.xpBtn.setIcon('ab_coin').place(3, h - 19);
    this.lvlBox.add([lvlBg, this.lvlText, this.xpBar, this.xpText, this.xpBtn]);
    const goldBg = this.add.image(0, 0, panelTexture(this, `ab_gold_${w}x${h}`, w, h, PANEL)).setOrigin(0);
    const coin = this.add.image(0, 3, 'ab_coin').setOrigin(0).setScale(2);
    this.goldText = pixelText(this, 0, 3, '', GOLD, 2);
    // Roll, and beside it the freeze that keeps this shop for the next round.
    const fw = 15;
    const rw = bw - fw - 1;
    this.rollBtn = new PixelButton(this, `Roll ${REROLL_COST}`, rw, 17, BUTTON_GOLD, `ab_roll_${rw}`, () => this.reroll());
    this.rollBtn.setIcon('ab_coin').place(3, h - 19);
    this.freezeBtn = new PixelButton(this, '', fw, 17, BUTTON_PLAIN, 'ab_freeze', () => this.toggleFreeze());
    this.freezeBtn.setIcon('ab_lock_open').setData('icon', 'ab_lock_open').place(3 + rw + 1, h - 19);
    this.goldBox.add([goldBg, coin, this.goldText, this.rollBtn, this.freezeBtn]);
    this.goldBox.setData('coin', coin);
  }

  /** The Fight (or Ready) button, `w` x `h` at (x, y). */
  private buildReady(w: number, h: number, x: number, y: number): void {
    this.readyBtn?.destroy();
    this.readyBtn = new PixelButton(this, 'Fight!', w, h, BUTTON_GOLD, `ab_ready_${w}x${h}`, () => this.toggleReady()).place(x, y);
    this.hud.add(this.readyBtn);
  }

  /** Page px to world px. */
  private toWorld(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.wx) / this.s, y: (y - this.wy) / this.s };
  }

  private layout(): void {
    const { width, height } = this.scale;
    const z = (this.z = menuZoom(width, height));
    this.cameras.main.setZoom(z);
    const vw = (this.vw = Math.floor(width / z));
    const vh = (this.vh = Math.floor(height / z));
    this.sky.setTexture(autoBackdrop(this, vw + 1, vh + 1));

    // Keep clear of the mute button in the top-right corner.
    const corner = Math.ceil(soundCorner(width, height) / z);
    this.row2 = Math.max(TOP_H, corner);

    // Both layouts, sized in world px: the board with room over it for heads, and the bench.
    const bs = boardSize(COLS, ROWS);
    const tilesH = ROWS * CELL_H + RIM * 2 + FACE;
    const dock = { w: 2 * BENCH_SLOT + 6, h: (BENCH_SIZE / 2) * BENCH_SLOT + 6 };
    // What of the wide world must show: the tiles and a sliver of rim, with at least the least head room.
    const wideH = RIM + ROWS * CELL_H + RIM_SHOW;
    const tallW = bs.w;
    const tallH = HEAD_ROOM + tilesH + 3 + BENCH_SLOT + 6;
    // The biggest whole number of screen px per world px that fits the room each leaves.
    const fit = (w: number, h: number, roomW: number, roomH: number) => Math.max(1, Math.floor(Math.min((roomW * z) / w, (roomH * z) / h)));
    // The tray: one row in the wide layout (blocks and cards side by side), two in the tall (blocks and Fight, then the cards).
    const tallTop = this.row2 + TOP_H + CHIP_H * 2 + 4;
    const trayTallMin = PAD + BLOCK_H + GAP + CARD_H_ROW + PAD;
    // Wide: the board in the middle, the left column on one side and the dock and traits on the other (the board is
    // pushed off the middle only when they can't both fit), over the slimmest tray.
    const leftNeed = PAD + LEFT_MIN + PAD;
    const dockW = (n: number) => Math.ceil(((4 + dock.w) * n) / z);
    const wideFits = (n: number) =>
      leftNeed + Math.ceil((bs.w * n) / z) + dockW(n) + PAD + TRAIT_MIN + PAD <= vw && Math.ceil(((HEAD_MIN + wideH) * n) / z) <= vh - PAD * 2 - BLOCK_H_MIN;
    let nWide = 1;
    while (wideFits(nWide + 1)) nWide++;
    const nTall = fit(tallW, tallH, vw - 2, vh - tallTop - trayTallMin);
    this.wide = nWide > nTall || (nWide === nTall && vw >= vh);
    const n = this.wide ? nWide : nTall;
    const s = (this.s = n / z);
    this.world.setScale(s);

    // World px: where the board and bench sit.
    let bx: number;
    let benchX: number;
    let benchY: number;
    if (this.wide) {
      this.benchCols = 2;
      bx = 0;
      benchX = bs.w + 4;
      // The dock's foot lines up with the front row's tiles, beside the player's half, clear of the tray.
      benchY = HEAD_ROOM + RIM + ROWS * CELL_H + 1 - dock.h;
    } else {
      this.benchCols = BENCH_SIZE;
      bx = 0;
      benchX = Math.round((bs.w - (BENCH_SIZE * BENCH_SLOT + 6)) / 2);
      benchY = HEAD_ROOM + tilesH + 3;
    }
    const by = HEAD_ROOM;
    this.benchImg.setTexture(autoBench(this, this.benchCols, BENCH_SIZE / this.benchCols)).setPosition(benchX, benchY);
    this.benchX = benchX;
    this.benchY = benchY;
    this.boardImg.setPosition(bx, by);
    this.frame = { ...this.frame, x: bx + RIM, y: by + RIM };
    const corners = [
      [bx + 4, by + 4],
      [bx + bs.w - 5, by + 4],
      [bx + 4, by + tilesH - FACE - 5],
      [bx + bs.w - 5, by + tilesH - FACE - 5],
    ];
    this.torches.forEach((t, i) => t.setPosition(corners[i][0], corners[i][1]));

    if (this.wide) {
      // The board in the middle, as tall as the room over the tray. Left: Leave, the players, the round and Fight.
      // Right: the bench, then the traits under the mute button.
      this.topH = 0;
      const ww = Math.ceil(bs.w * s);
      const rightW = dockW(n);
      const rightNeed = rightW + PAD + TRAIT_MIN + PAD;
      this.wx = Math.round(Math.max(leftNeed, Math.min(vw - rightNeed - ww, (vw - ww) / 2)));
      // The tray as tall as the board leaves (with the least head room), then the board's tiles standing on it, the
      // stone face and the rock under it going behind the tray. Room to spare goes over the heads first, up to the
      // full head room, then is shared out above and below.
      const blockH = Math.max(BLOCK_H_MIN, Math.min(BLOCK_H, vh - PAD * 2 - Math.ceil((HEAD_MIN + wideH) * s)));
      const trayY = vh - PAD * 2 - blockH;
      const spare = trayY - (HEAD_ROOM + wideH) * s;
      this.wy = Math.round(spare < 0 ? spare : spare / 2);
      this.leftW = Math.max(LEFT_MIN, Math.min(LEFT_MAX, this.wx - PAD * 2));
      const tx = this.wx + ww + rightW + PAD;
      const ty = corner + PAD;
      this.traitRect.setTo(tx, ty, vw - PAD - tx, trayY - GAP - ty);
      this.bannerAt = { x: PAD, y: PAD + 13 + GAP + 2 * (PLATE_H + GAP), w: this.leftW };
      this.buildReady(this.leftW, FIGHT_H, PAD, trayY - GAP - FIGHT_H);
      this.standBottom = trayY - GAP * 2 - FIGHT_H;
      // The tray: level, five cards, gold.
      this.tray.setTo(0, trayY, vw, vh - trayY);
      this.buildBlocks(BLOCK_W, blockH);
      this.lvlBox.setPosition(PAD, trayY + PAD);
      this.goldBox.setPosition(vw - PAD - BLOCK_W, trayY + PAD);
      const room = vw - PAD * 2 - BLOCK_W * 2 - GAP * 4;
      const cw = Math.min(CARD_W_MAX, Math.floor((room - GAP * (SHOP_SIZE - 1)) / SHOP_SIZE));
      this.placeCards(cw, blockH, trayY + PAD);
      // The hero card pops up over the left column, clear of the bench and the traits.
      this.infoAt = { x: PAD, y: PAD + 13 + GAP };
    } else {
      // Leave (and the mute button) on the first row; the players and the round on the second; a row of trait chips;
      // the world; then the tray, its cards as tall as the room left over allows.
      this.topH = this.row2 + TOP_H;
      this.bannerAt = { x: Math.round((vw - BANNER_W_TALL) / 2), y: this.row2, w: BANNER_W_TALL };
      this.traitRect.setTo(PAD, this.topH + 2, vw - PAD * 2, CHIP_H * 2 + 1);
      const spare = vh - tallTop - trayTallMin - Math.ceil(tallH * s);
      const ch = CARD_H_ROW + Math.max(0, Math.min(CARD_H_ROW_MAX - CARD_H_ROW, Math.floor(spare / 2)));
      const trayH = PAD + BLOCK_H + GAP + ch + PAD;
      const trayY = vh - trayH;
      this.tray.setTo(0, trayY, vw, trayH);
      const ww = Math.ceil(tallW * s);
      this.wx = Math.round((vw - ww) / 2);
      this.wy = Math.round(tallTop + Math.max(0, (trayY - tallTop - tallH * s) / 2));
      const fightW = 56;
      const bw = Math.floor((vw - PAD * 2 - fightW - GAP * 2) / 2);
      this.buildBlocks(bw);
      this.lvlBox.setPosition(PAD, trayY + PAD);
      this.goldBox.setPosition(PAD + bw + GAP, trayY + PAD);
      this.buildReady(vw - PAD * 2 - bw * 2 - GAP * 2, BLOCK_H, PAD + (bw + GAP) * 2, trayY + PAD);
      const cw = Math.floor((vw - PAD * 2 - GAP * (SHOP_SIZE - 1)) / SHOP_SIZE);
      this.placeCards(cw, ch, trayY + PAD + BLOCK_H + GAP);
      this.infoAt = { x: Math.round((vw - INFO_W) / 2), y: this.topH + 2 };
    }
    this.drawTray();
    this.world.setPosition(this.wx, this.wy);
    const r = this.shopRect;
    this.sellZone.removeAll(true);
    const sellBg = this.add.image(0, 0, panelTexture(this, `ab_sell_${r.width}x${r.height}`, r.width, r.height, panelStyle(0x8a4e22, 0xffe08a))).setOrigin(0);
    this.sellZone.add([sellBg, this.sellText]).setPosition(r.x, r.y);
    this.infoBg.setPosition(this.infoAt.x, this.infoAt.y);
    this.info.setPosition(this.infoAt.x, this.infoAt.y);
    this.infoHit.setPosition(this.infoAt.x, this.infoAt.y);
    this.leaveBtn.place(PAD, this.wide ? PAD : 1);
    this.syncPieces();
    this.refreshHud();
    if (this.lobby && this.phase === 'lobby') this.showLobby();
    if (this.overlay) {
      const c = this.boardCentre();
      this.overlay.setPosition(c.x, c.y);
    }
    if (this.boonView && this.boonOffer) this.showBoons(false);
  }

  /** The five cards, `cw` x `ch`, in a row centred across the page at `y`. */
  private placeCards(cw: number, ch: number, y: number): void {
    const rowW = cw * SHOP_SIZE + GAP * (SHOP_SIZE - 1);
    const x0 = Math.round((this.vw - rowW) / 2);
    this.shopRect.setTo(x0, y, rowW, ch);
    this.cards.forEach((c, i) => {
      c.resize(cw, ch);
      c.setPosition(x0 + (cw + GAP) * i, y);
    });
  }

  /** The tray under the shop: dark wood-stained stone with a gilt lip, shading the board's foot as it rises over it. */
  private drawTray(): void {
    const g = this.trayG.clear();
    const r = this.tray;
    // A soft shadow up onto what's behind.
    for (let i = 1; i <= 4; i++) g.fillStyle(0x0b0818, 0.1 * (5 - i)).fillRect(r.x, r.y - i, r.width, 1);
    const bands = [0x1e1838, 0x1a1532, 0x17122c, 0x140f27, 0x110d22];
    const bh = r.height / bands.length;
    bands.forEach((c, i) => g.fillStyle(c, 0.96).fillRect(r.x, Math.floor(r.y + i * bh), r.width, Math.ceil(bh) + 1));
    g.fillStyle(0x8a4e22, 1).fillRect(r.x, r.y, r.width, 1);
    g.fillStyle(0xd69a3a, 1).fillRect(r.x, r.y + 1, r.width, 1);
    g.fillStyle(0xffe08a, 0.35).fillRect(r.x, r.y + 2, r.width, 1);
    // Rivets along the lip.
    for (let x = 6; x < r.width - 4; x += 24) {
      g.fillStyle(0x3a2410, 1).fillRect(r.x + x, r.y + 3, 2, 1);
      g.fillStyle(0xffe08a, 0.5).fillRect(r.x + x, r.y + 3, 1, 1);
    }
  }

  /** The middle of the board, in page px: where results stand. */
  private boardCentre(): { x: number; y: number } {
    return { x: Math.round(this.wx + (this.frame.x + (COLS * CELL_W) / 2) * this.s), y: Math.round(this.wy + (this.frame.y + (ROWS * CELL_H) / 2) * this.s) };
  }

  /**
   * The top bar: Leave, then the two players (a heart, health, name, level,
   * and a health bar under), clear of the FPS counter in the middle and the
   * mute button on the right. On a tall screen the players go on a second
   * row, with the round between them. Then the round and its clock.
   */
  private drawTop(): void {
    if (!this.me) return;
    const g = this.plates.clear();
    const vw = this.vw;
    if (this.topH) {
      g.fillStyle(0x0b0818, 0.72).fillRect(0, 0, vw, this.topH);
      g.fillStyle(0x0b0818, 0.35).fillRect(0, this.topH, vw, 1);
      g.fillStyle(0xb8742c, 0.8).fillRect(0, this.topH - 1, vw, 1);
    }
    const plate = (i: number, p: { name: string; hp: number; level: number }, t: Phaser.GameObjects.BitmapText[], x: number, y: number, w: number, mine: boolean) => {
      g.fillStyle(mine ? 0x223a6a : 0x5a2234, 0.9).fillRect(x, y + 1, w, 12);
      g.fillStyle(mine ? 0x6fb8ff : 0xff6a7a, 1).fillRect(x, y + 1, 1, 12);
      g.fillStyle(0x1a1430, 1).fillRect(x + 1, y + 12, w - 1, 1);
      g.fillStyle(mine ? 0x5ad07a : 0xff5a5a, 1).fillRect(x + 1, y + 12, Math.round(((w - 1) * Math.max(0, p.hp)) / 100), 1);
      this.hearts[i].setPosition(x + 3, y + 3);
      t[1].setText(`${Math.max(0, Math.ceil(p.hp))}`).setPosition(x + 12, y + 3);
      t[2].setText(`L${p.level}`);
      t[2].setPosition(x + w - 3 - t[2].width, y + 3);
      const nameX = x + 12 + t[1].width + 5;
      t[0].setText(fitLine(t[0], p.name, x + w - 3 - t[2].width - 4 - nameX)).setPosition(nameX, y + 3);
    };
    const me = { name: this.me.name, hp: this.me.hp, level: this.me.level };
    if (this.wide) {
      // Down the left column under Leave: you, the rival, then the round.
      const y = PAD + 13 + GAP;
      plate(0, me, this.meText, PAD, y, this.leftW, true);
      plate(1, this.rival, this.rivalText, PAD, y + PLATE_H + GAP, this.leftW, false);
      this.drawStandings(PAD, this.bannerAt.y + BANNER_H + GAP, this.leftW);
    } else {
      this.standings.removeAll(true);
      const w = Math.floor((vw - PAD * 2 - BANNER_W_TALL - 8) / 2);
      plate(0, me, this.meText, PAD, this.row2, w, true);
      plate(1, this.rival, this.rivalText, vw - PAD - w, this.row2, w, false);
    }
    this.drawBanner();
  }

  /**
   * At a table of more than two: everyone, still-in first by health, then
   * those out by where they finished. This player's row is marked blue, the
   * foe's red with a sword, and a thin bar under each shows its health.
   */
  private drawStandings(x: number, y: number, w: number): void {
    const list = this.standings;
    list.removeAll(true);
    if (this.seats.length <= 2) return;
    const rows = Math.max(0, Math.floor((this.standBottom - y) / STAND_ROW));
    const order = this.seats
      .map((s, i) => ({ s, i }))
      .sort((a, b) => (b.s.hp > 0 ? 1 : 0) - (a.s.hp > 0 ? 1 : 0) || (a.s.hp > 0 ? b.s.hp - a.s.hp : a.s.place - b.s.place) || a.i - b.i)
      .slice(0, rows);
    const g = this.add.graphics();
    list.add(g);
    order.forEach(({ s, i }, k) => {
      const ry = y + k * STAND_ROW;
      const mine = i === this.mySeat;
      const foe = i === this.foe && this.phase !== 'plan';
      const inGame = s.hp > 0;
      g.fillStyle(mine ? 0x1a2a50 : 0x0b0818, inGame ? 0.78 : 0.5).fillRect(x, ry, w, STAND_ROW - 1);
      g.fillStyle(mine ? 0x6fb8ff : foe ? 0xff6a7a : inGame ? 0x5a5080 : 0x2a2440, 1).fillRect(x, ry, 1, STAND_ROW - 1);
      if (inGame) {
        g.fillStyle(0x1a1430, 1).fillRect(x + 1, ry + STAND_ROW - 2, w - 1, 1);
        g.fillStyle(mine ? 0x5ad07a : foe ? 0xff5a5a : 0x9a8ac8, 1).fillRect(x + 1, ry + STAND_ROW - 2, Math.round(((w - 1) * s.hp) / START_HP), 1);
      }
      const right = pixelText(this, 0, ry + 1, inGame ? `${Math.ceil(s.hp)}` : ordinal(s.place || this.seats.length), inGame ? GOLD : SOFT);
      right.setX(x + w - 3 - right.width);
      let nameEnd = right.x - 3;
      if (foe && inGame) {
        nameEnd -= 8;
        list.add(this.add.image(nameEnd + 1, ry + 1, 'ab_sword').setOrigin(0).setAlpha(this.foeGhost ? 0.6 : 1));
      }
      const name = pixelText(this, x + 4, ry + 1, fitLine(this.probe, s.name, nameEnd - x - 6), inGame ? (mine ? INK : LAVENDER) : SOFT);
      list.add([right, name]);
    });
  }

  /** The round, what's on (planning with the seconds left, the fight, the result), and a bar running down while planning. */
  private drawBanner(): void {
    const at = this.bannerAt;
    const b = this.banner.clear();
    const inPlay = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    const label =
      this.phase === 'plan' ? `Plan ${Math.ceil(Math.max(0, this.timer))}` : this.phase === 'fight' ? (this.out ? 'Watching' : 'Fight') : this.phase === 'result' ? 'Result' : '';
    let barY: number;
    if (this.wide) {
      b.fillStyle(0x0b0818, 0.72).fillRect(at.x, at.y, at.w, BANNER_H - 1);
      b.fillStyle(0xb8742c, 0.8).fillRect(at.x, at.y, at.w, 1);
      this.roundText.setText(inPlay ? fitLine(this.probe, `Round ${this.round}`, at.w - 6) : '').setPosition(at.x + 3, at.y + 3);
      this.phaseText.setText(fitLine(this.probe, label, at.w - 6)).setPosition(at.x + 3, at.y + 11);
      barY = at.y + BANNER_H - 4;
    } else {
      this.roundText.setText(inPlay ? `R${this.round}` : '').setPosition(at.x, at.y + 3);
      this.phaseText.setText(label.toUpperCase()).setPosition(at.x + at.w - this.phaseText.width, at.y + 3);
      barY = at.y + 11;
    }
    if (this.phase === 'plan') {
      const k = Math.max(0, Math.min(1, this.timer / this.timerMax));
      const x = this.wide ? at.x + 3 : at.x;
      const w = this.wide ? at.w - 6 : at.w;
      b.fillStyle(0x1a1430, 1).fillRect(x, barY, w, 2);
      b.fillStyle(k < 0.25 ? 0xff6a4a : 0xf4cf6a, 1).fillRect(x, barY, Math.round(w * k), 2);
    }
  }

  private refreshHud(): void {
    if (!this.me) {
      this.hud.setVisible(false);
      return;
    }
    const playing = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    this.hud.setVisible(playing || this.phase === 'over');
    this.drawTop();
    // Level and gold.
    const bw = this.blockW;
    this.lvlText.setText(`LVL ${this.me.level}`);
    const need = XP_NEXT[this.me.level];
    this.xpText.setText(need ? `${this.me.xp}/${need}` : 'MAX');
    this.xpText.setX(bw - 4 - this.xpText.width);
    const g = this.xpBar.clear();
    // The xp toward the next level, on a bar under the readout.
    g.fillStyle(0x0b0818, 1).fillRect(4, 12, bw - 8, 4);
    g.fillStyle(0x1a1430, 1).fillRect(5, 13, bw - 10, 2);
    if (need) g.fillStyle(0x4aa6ff, 1).fillRect(5, 13, Math.round(((bw - 10) * this.me.xp) / need), 2);
    else g.fillStyle(0xffc94a, 1).fillRect(5, 13, bw - 10, 2);
    // Gold, big, centred over the reroll.
    this.goldText.setText(`${this.me.gold}`);
    const coin = this.goldBox.getData('coin') as Phaser.GameObjects.Image | undefined;
    const gx = Math.round((bw - (12 + 3 + this.goldText.width)) / 2);
    coin?.setPosition(gx, 4);
    this.goldText.setPosition(gx + 15, 2);
    const shopOpen = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    this.xpBtn.setEnabled(shopOpen && this.me.gold >= XP_COST && this.me.level < MAX_LEVEL).setAlpha(this.me.gold >= XP_COST && this.me.level < MAX_LEVEL ? 1 : 0.5);
    const canRoll = this.me.freeRolls > 0 || this.me.gold >= REROLL_COST;
    this.rollBtn.setText(this.me.freeRolls > 0 ? `Free ${this.me.freeRolls}` : `Roll ${REROLL_COST}`);
    this.rollBtn.setEnabled(shopOpen && canRoll).setAlpha(canRoll ? 1 : 0.5);
    this.freezeBtn.setEnabled(shopOpen);
    const lock = this.me.frozen ? 'ab_lock' : 'ab_lock_open';
    if (this.freezeBtn.getData('icon') !== lock) this.freezeBtn.setIcon(lock).setData('icon', lock);
    this.drawFrost();
    this.cards.forEach((c, i) => {
      const k = this.me.shop[i];
      const mine = k ? this.me.all().filter((p) => p.key === k) : [];
      c.show(k, !!k && unitDef(k).cost <= this.me.gold, mine.filter((p) => p.star === 1).length, mine.length > 0);
    });
    if (this.readyBtn) {
      this.readyBtn.setVisible(this.phase === 'plan' && this.me.alive);
      const [n, m] = this.mode === 'ai' ? [0, 1] : this.readyCount();
      this.readyBtn.setText(m <= 1 && this.host ? 'Fight!' : this.ready ? `Waiting ${n}/${m}` : n ? `Ready ${n}/${m}` : 'Ready');
    }
    this.drawTraits();
    this.refreshInfo();
  }

  /**
   * The traits on the board, active ones first, lit, with how many of the next
   * level: a column beside the board on a wide screen (names when there's
   * room), a row of chips under the top bar on a tall one.
   */
  private drawTraits(): void {
    const list = this.traitList;
    list.removeAll(true);
    if (!this.me) return;
    const r = this.traitRect;
    list.setPosition(r.x, r.y);
    const head = pixelText(this, 0, 2, `Team ${this.me.board.size}/${this.me.cap}`, this.me.board.size < this.me.cap ? GOLD : LAVENDER);
    list.add(head);
    // The boons kept, as badges (tap one for what it does): a row under the count when wide, at the right when tall.
    const kept = this.me.boons;
    const badge = (id: string, x: number, y: number) => {
      const b = this.add.image(x, y, boonBadge(this, id)).setOrigin(0).setInteractive({ useHandCursor: true });
      b.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.boonShown = this.boonShown === id ? null : id;
        this.selected = null;
        this.hovered = null;
        this.refreshInfo();
      });
      list.add(b);
    };
    const traits = this.me.traits();
    const next = (t: { id: TraitId; count: number }) => {
      const def = TRAITS[t.id];
      return def.levels.find((n) => n > t.count) ?? def.levels[def.levels.length - 1];
    };
    if (!this.wide) {
      const fit = Math.min(kept.length, Math.max(0, Math.floor((r.width - head.width - 5 - CHIP_W) / BADGE_STEP)));
      kept.slice(-fit || kept.length).forEach((id, i) => fit && badge(id, r.width - (fit - i) * BADGE_STEP, 0));
      const limit = r.width - (fit ? fit * BADGE_STEP + 2 : 0);
      // Chips after the team count, wrapping to a second row.
      let x = head.width + 5;
      let y = 0;
      for (const t of traits) {
        if (x + CHIP_W > limit) {
          if (y > 0) break;
          x = 0;
          y = CHIP_H + 1;
        }
        const def = TRAITS[t.id];
        const on = t.level > 0;
        const g = this.add.graphics();
        g.fillStyle(0x0b0818, on ? 0.85 : 0.6).fillRect(x, y, CHIP_W - 1, CHIP_H);
        if (on) g.fillStyle(def.color, 1).fillRect(x, y + CHIP_H - 1, CHIP_W - 1, 1);
        const icon = this.add.image(x + 1, y + 1, `ab_trait_${t.id}${on ? '' : '_off'}`).setOrigin(0);
        const count = pixelText(this, x + 13, y + 2, `${t.count}/${next(t)}`, on ? def.color : SOFT);
        list.add([g, icon, count]);
        x += CHIP_W;
      }
      return;
    }
    const w = r.width;
    const named = w >= 70;
    const perRow = Math.max(1, Math.floor((w + 1) / BADGE_STEP));
    kept.forEach((id, i) => badge(id, (i % perRow) * BADGE_STEP, 12 + Math.floor(i / perRow) * BADGE_STEP));
    const top = 12 + Math.ceil(kept.length / perRow) * BADGE_STEP + (kept.length ? 1 : 0);
    const rows = Math.max(0, Math.floor((r.height - top) / TRAIT_ROW));
    traits.slice(0, rows).forEach((t, i) => {
      const def = TRAITS[t.id];
      const y = top + i * TRAIT_ROW;
      const on = t.level > 0;
      const g = this.add.graphics();
      g.fillStyle(0x0b0818, on ? 0.8 : 0.55).fillRect(0, y - 1, w, TRAIT_ROW - 1);
      if (on) g.fillStyle(def.color, 1).fillRect(0, y - 1, 1, TRAIT_ROW - 1);
      const icon = this.add.image(2, y, `ab_trait_${t.id}${on ? '' : '_off'}`).setOrigin(0);
      const count = pixelText(this, 0, y + 1, `${t.count}/${next(t)}`, on ? def.color : SOFT);
      count.setX(w - 3 - count.width);
      list.add([g, icon, count]);
      if (named) list.add(pixelText(this, 14, y + 1, fitLine(this.probe, def.name, w - 14 - count.width - 6), on ? INK : SOFT));
    });
  }

  /**
   * The hero card that pops up: whatever piece was tapped, else the hovered
   * shop hero. A tap on it puts it away.
   */
  private refreshInfo(): void {
    const box = this.info;
    box.removeAll(true);
    const pick = this.hovered ? { key: this.hovered, star: 1, look: lookFor(this.hovered) } : this.selected;
    const boon = !pick && this.boonShown ? boonDef(this.boonShown) : undefined;
    const on = !!this.me && (this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result') && !this.press?.dragging && (!!pick || !!boon);
    this.infoBg.setVisible(on);
    if (this.infoHit.input) this.infoHit.input.enabled = on;
    // On a tall screen the traits it covers step out of the way while it's up (on a wide one it covers the players).
    this.traitList.setVisible(!on || this.wide);
    if (!on) return;
    if (boon) {
      // A kept boon: its picture, name and tier, and what it does.
      box.add(this.add.image(6, 6, boonIcon(this, boon.id, 32)).setOrigin(0));
      box.add(pixelText(this, 44, 9, fitLine(this.probe, boon.name, INFO_W - 50), INK));
      box.add(pixelText(this, 44, 20, `${TIER_NAMES[boon.tier]} boon`, tierAccent(boon.tier)));
      let y = 44;
      for (const l of wrap(this.probe, boon.text, INFO_W - 12)) {
        box.add(pixelText(this, 6, y, l, LAVENDER));
        y += 9;
      }
      return;
    }
    if (!pick) return;
    const d = unitDef(pick.key);
    const st = styleOf(pick.key, pick.look);
    const n = pieceNumbers(pick.key, pick.star);
    const name = pixelText(this, 6, 5, fitLine(this.probe, st.ch.type.name, INFO_W - 40), INK);
    box.add(name);
    for (let i = 0; i < pick.star; i++) box.add(this.add.image(8 + name.width + i * 6, 6, pick.star === 3 ? 'ab_star3' : pick.star === 2 ? 'ab_star2' : 'ab_star').setOrigin(0));
    box.add(this.add.image(INFO_W - 20, 6, 'ab_coin').setOrigin(0));
    box.add(pixelText(this, INFO_W - 12, 5, `${d.cost}`, COST_COLORS[d.cost]));
    const g = this.add.graphics();
    g.fillStyle(st.ch.accent, 1).fillRect(6, 15, INFO_W - 12, 1);
    box.add(g);
    [d.origin, d.role].forEach((t, i) => {
      box.add(this.add.image(6 + i * 64, 19, `ab_trait_${t}`).setOrigin(0));
      box.add(pixelText(this, 18 + i * 64, 20, TRAITS[t as TraitId].name, TRAITS[t as TraitId].color));
    });
    const stats = [`HP ${n.hp}`, `DPS ${n.dps}`, `DEF ${n.defense}`];
    stats.forEach((s, i) => box.add(pixelText(this, 6 + i * 46, 31, s, LAVENDER)));
    let y = 42;
    const block = (title: string, text: string, tint: number, lines: number, side = '') => {
      let room = INFO_W - 12;
      if (side) {
        const t = pixelText(this, 0, y, side, LAVENDER);
        t.setX(INFO_W - 6 - t.width);
        box.add(t);
        room -= t.width + 5;
      }
      box.add(pixelText(this, 6, y, fitLine(this.probe, title, room), tint));
      y += 9;
      for (const l of wrap(this.probe, text, INFO_W - 12).slice(0, lines)) {
        box.add(pixelText(this, 6, y, l, SOFT));
        y += 8;
      }
      y += 2;
    };
    block(d.skill.name, spellText(d.skill, n.dps), INK, 2, `${d.skill.cd}S`);
    block(st.ult, spellText(d.ult, n.dps), st.pal.hot, 3, `${n.mana} MANA`);
  }

  // ------------------------------------------------------------ the lobby

  private showLobby(): void {
    this.closeLobby();
    const c = (this.lobby = this.add.container(0, 0));
    const cx = Math.round(this.vw / 2);
    // A few heroes standing in a line on the dais, waiting for a match.
    const keys = ['warrior.knight', 'wizard.pyro', 'beast.dragon', 'rogue.dancer', 'paladin.holy', 'archer.ranger', 'samurai.bladewind'];
    this.lobbyHeroes = keys.map((key, i) => {
      const v = new UnitView(this, key, lookFor(key), 1, true, 'down');
      const p = cellPt(this.frame, i, 5);
      v.setPosition(p.x, p.y).setDepth(p.y);
      v.hideBars();
      this.layer.add(v);
      return v;
    });
    // The title and the prize over the empty far half of the board.
    // Under the FPS counter when it shows; 1x when 2x would crowd the board.
    const top = (settings.values.showFps ? Math.ceil(fpsBottom() / this.z) : 0) + 3;
    const title = this.add.image(cx, top, 'ab_title').setOrigin(0.5, 0);
    title.setScale(title.height * 2 + 26 < this.wy - top + HEAD_ROOM * this.s ? 2 : 1);
    let y = Math.round(top + title.displayHeight + 3);
    const band = this.add.graphics();
    band.fillStyle(0x0b0818, 0.6).fillRect(0, y - 2, this.vw, 21);
    const lines: [string, number][] = [
      ['Buy heroes, set out six, watch them fight', LAVENDER],
      [`Win a match: ${WIN_GEMS.ai} gems in practice, ${WIN_GEMS.online} online`, SOFT],
    ];
    const texts = lines.map(([l, tint]) => {
      const t = pixelText(this, 0, y, fitLine(this.probe, l, this.vw - 8), tint);
      t.setX(Math.round(cx - t.width / 2));
      y += 10;
      return t;
    });
    // The buttons where the shop will be: stacked in the column, or a row along the bottom.
    const r = this.shopRect;
    const labels: [string, () => void][] = [
      ['Practice', () => this.startPractice()],
      ['Create room', () => this.openRoom()],
      ['Join room', () => this.joinRoom()],
    ];
    // The buttons in a row where the shop's cards will be, on the tray.
    const bw = Math.min(100, Math.floor((r.width - GAP * 4) / 3));
    const bx = Math.round(r.x + (r.width - bw * 3 - GAP * 4) / 2);
    const buttons = labels.map(([label, fn], i) =>
      new PixelButton(this, label, bw, 18, BUTTON_GOLD, `ab_l_${label}_${bw}`, fn).place(bx + i * (bw + GAP * 2), Math.round(r.y + (r.height - 18) / 2)),
    );
    const tray = this.add.graphics();
    tray.fillStyle(0x110d22, 0.96).fillRect(this.tray.x, this.tray.y, this.tray.width, this.tray.height);
    tray.fillStyle(0xd69a3a, 1).fillRect(this.tray.x, this.tray.y + 1, this.tray.width, 1);
    tray.fillStyle(0x8a4e22, 1).fillRect(this.tray.x, this.tray.y, this.tray.width, 1);
    const back = new PixelButton(this, 'Back', 34, 13, BUTTON_PLAIN, 'ab_back', () => this.leave()).place(PAD, 1);
    // How many bots to practise against, where the level block will be.
    const bots = this.stepper(this.lvlBox.x, this.wide ? Math.round(this.tray.y + (this.tray.height - 15) / 2) : this.lvlBox.y, this.blockW, this.botCount, 1, MAX_BOTS, (n) => {
      this.botCount = n;
      saveBots(n);
      this.showLobby();
    });
    c.add([band, tray, title, ...texts, ...buttons, back, bots]);
    this.hud.setVisible(false);
  }

  private closeLobby(): void {
    this.lobby?.destroy();
    this.lobby = null;
    for (const v of this.lobbyHeroes) v.destroy();
    this.lobbyHeroes = [];
  }

  private myName(): string {
    return account()?.username ?? 'You';
  }

  // ------------------------------------------------------------ a match

  /** A new match at this table; `mine` is this player's seat. The host plays the bots. */
  private newMatch(mode: Mode, seats: SeatInfo[], mine: number): void {
    this.mode = mode;
    this.closeLobby();
    this.clearOverlay();
    this.me = new AutoPlayer(this.myName());
    this.me.lookOf = lookFor;
    this.round = 0;
    this.wonLast = false;
    this.pendingRound = null;
    this.foughtRound = 0;
    this.decided = false;
    this.ended = false;
    this.out = false;
    this.readyIds.clear();
    this.awaiting.clear();
    this.nextRound?.remove();
    this.nextRound = null;
    this.waitBoard?.remove();
    this.waitBoard = null;
    this.seats = seats.map((s) => ({ ...s, hp: START_HP, level: START_LEVEL, board: [], boons: [], place: 0, ai: this.host && s.bot ? new AutoPlayer(s.name) : null }));
    this.closeBoons();
    this.boonOffer = null;
    this.boonShown = null;
    this.mySeat = mine;
    this.foe = this.seats.findIndex((_, i) => i !== mine);
    this.foeGhost = false;
    this.fight?.destroy();
    this.fight = null;
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
  }

  /** Practice: this player and `botCount` bots. */
  private startPractice(): void {
    this.host = true;
    const seats: SeatInfo[] = [{ name: this.myName(), bot: false, peer: -1 }, ...botNames(this.botCount).map((name) => ({ name, bot: true, peer: -1 }))];
    this.newMatch('ai', seats, 0);
    this.startPlan(1, PLAN_SECONDS[0]);
  }

  /** Seats still in. */
  private aliveSeats(): number[] {
    return this.seats.map((_, i) => i).filter((i) => this.seats[i].hp > 0);
  }

  /** People still in, other than this player (online). */
  private livePeople(): number[] {
    return this.aliveSeats().filter((i) => i !== this.mySeat && !this.seats[i].bot && this.seats[i].peer >= 0);
  }

  private seatOf(peer: number | undefined): number {
    return peer === undefined ? -1 : this.seats.findIndex((s) => !s.bot && s.peer === peer);
  }

  /** Planning: gold in, a fresh shop, the clock runs; the host's bots plan too. */
  private startPlan(round: number, seconds: number): void {
    // A fight still playing here ends now, its result applied, so the rounds keep in step.
    if (this.phase === 'fight' && this.fight) this.finishFight();
    if (this.phase === 'over' && !this.out) return;
    this.round = round;
    this.phase = 'plan';
    this.ready = false;
    this.readyIds.clear();
    // A boon round gives time to read the cards (every screen adds it, so the clocks agree).
    const boons = isBoonRound(round);
    this.timer = this.timerMax = seconds + (boons ? BOON_SECONDS : 0);
    this.fight?.destroy();
    this.fight = null;
    this.fx.clear();
    if (!this.out) this.clearOverlay();
    if (this.me.alive) this.me.startRound(round, this.wonLast);
    this.seats[this.mySeat].level = this.me.level;
    if (this.host)
      for (const s of this.seats)
        if (s.ai && s.hp > 0) {
          s.ai.startRound(round, s.ai.streak > 0);
          // Bots take a boon at random from theirs, before they shop (a purse's gold is spent this round).
          if (boons) {
            const offer = offerBoons(roundTier(round), s.ai.boons, traitCounts(s.ai.all().map((p) => p.key)).map((t) => t.id), Math.random);
            if (offer.length) s.ai.takeBoon(offer[Math.floor(Math.random() * offer.length)]);
            s.boons = [...s.ai.boons];
          }
          aiPlan(s.ai, round);
          s.level = s.ai.level;
        }
    this.boonOffer = null;
    if (boons && this.me.alive && !this.out) {
      const offer = offerBoons(roundTier(round), this.me.boons, traitCounts(this.me.all().map((p) => p.key)).map((t) => t.id), Math.random);
      if (offer.length) this.boonOffer = offer;
    }
    this.selected = null;
    this.syncPieces();
    this.refreshHud();
    sound.cardFlip(1);
    if (this.boonOffer) this.showBoons(true);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    for (const [i, t] of this.torches.entries()) {
      const f = 0.55 + Math.sin(this.time.now / 90 + i * 2.1) * 0.08 + Math.sin(this.time.now / 37 + i) * 0.05;
      t.setAlpha(f).setScale(0.9 + f * 0.3, 0.7 + f * 0.25);
    }
    for (const c of this.cards) c.tick();
    if (this.boonView) this.tickBoons(dt);
    this.fx.update(dt);
    if (this.phase === 'plan') {
      this.timer -= dt;
      this.drawBanner();
      if (this.timer <= 0 && this.host) this.endPlan();
    }
    if (this.phase === 'fight' && this.fight) {
      this.fight.update(dt);
      if (this.fight.battle.over) {
        if (!this.fightDone) {
          this.fightDone = this.time.now;
          this.fight.cheer();
        } else if (this.time.now - this.fightDone > LINGER * 1000) this.finishFight();
      }
    }
    for (const v of this.views.values()) v.tick(dt);
  }

  /** Planning is over (the host's call): boards lock, and the round is fought once every board is in. */
  private endPlan(): void {
    if (this.phase !== 'plan' || !this.host) return;
    this.cancelDrag();
    this.lockBoard();
    for (const s of this.seats) if (s.ai && s.hp > 0) s.board = s.ai.placed();
    // Online, the other people send their boards; the host fights their last ones if any are late.
    this.awaiting = new Set(this.livePeople());
    if (!this.awaiting.size) return this.hostFights();
    session.send({ t: 'al', round: this.round });
    this.waitBoard?.remove();
    this.waitBoard = this.time.delayedCall(BOARD_WAIT_MS, () => this.hostFights());
  }

  /** This player's board locks for the fight (and is what they fight with). */
  private lockBoard(): void {
    // Time ran out on the boon cards: one is taken for the player, at random.
    if (this.boonOffer && this.me.alive) this.takeBoon(this.boonOffer[Math.floor(Math.random() * this.boonOffer.length)], false);
    this.closeBoons();
    if (this.me.alive) {
      this.me.autoFill();
      const mine = this.seats[this.mySeat];
      mine.board = this.me.placed();
      mine.boons = [...this.me.boons];
      mine.level = this.me.level;
    }
    this.phase = 'fight';
    this.syncPieces();
    this.refreshHud();
  }

  /** The host has the boards: every bout of the round, worked out at once and sent to all. */
  private hostFights(): void {
    this.waitBoard?.remove();
    this.waitBoard = null;
    if (!this.host || this.phase !== 'fight' || this.foughtRound === this.round) return;
    this.foughtRound = this.round;
    const bouts = drawBouts(this.round, this.aliveSeats(), this.seats.map((s) => s.board), this.seats.map((s) => s.boons), Math.random);
    const before = this.seats.map((s) => s.hp);
    const hp = healthAfter(before, bouts);
    const result: RoundResult = { round: this.round, bouts, hp, lv: this.seats.map((s) => s.level), place: placesAfter(before, hp, this.seats.map((s) => s.place)) };
    // The bots keep their streaks (for their income) and their health.
    for (const b of bouts)
      for (const [i, side] of [[b.a, 0], ...(b.ghost ? [] : [[b.b, 1]])] as [number, 0 | 1][]) {
        const ai = this.seats[i].ai;
        if (!ai) continue;
        ai.settle(b.win === -1 ? null : b.win === side, 0);
        ai.hp = hp[i];
      }
    if (this.mode === 'online') session.send({ t: 'af', ...result });
    this.playRound(result);
    // The next round once the longest fight has played out and its result has stood.
    const longest = Math.max(0, ...bouts.map((b) => b.ticks)) * TICK;
    this.nextRound?.remove();
    this.nextRound = this.time.delayedCall((longest + LINGER + RESULT_SECONDS + 0.6) * 1000, () => {
      this.nextRound = null;
      if (this.decided) return;
      if (this.mode === 'online') session.send({ t: 'ap', round: this.round + 1, sec: PLAN_SECONDS[1] });
      this.startPlan(this.round + 1, PLAN_SECONDS[1]);
    });
  }

  /** A round arrives: play this player's own bout (or, once out, watch one). */
  private playRound(r: RoundResult): void {
    if (this.phase === 'fight' && this.fight) return;
    this.pendingRound = r;
    const my = this.mySeat;
    const bout = r.bouts.find((b) => b.a === my || (!b.ghost && b.b === my));
    const shown = bout ?? r.bouts.find((b) => !b.ghost) ?? r.bouts[0];
    if (!shown) {
      // Nothing to watch: the round's result stands at once.
      this.phase = 'fight';
      this.applyRound();
      return;
    }
    const side: 0 | 1 = bout && bout.b === my ? 1 : 0;
    if (bout) {
      this.foe = side === 0 ? bout.b : bout.a;
      this.foeGhost = bout.ghost;
    }
    this.startFight(shown.boards, shown.seed, shown.boons, side, shown.ghost ? 1 : -1);
  }

  private startFight(boards: [Placed[], Placed[]], seed: number, boons: [string[], string[]], mySide: 0 | 1, ghostSide: number): void {
    this.cancelDrag();
    this.phase = 'fight';
    this.selected = null;
    this.fightDone = 0;
    this.fight?.destroy();
    // A player fighting from the top side sees the board from that end, their own heroes at the bottom.
    this.fight = new FightView(this, new Battle(boards, seed, boons), { ...this.frame, flip: mySide === 1 }, this.layer, this.fx, mySide, ghostSide);
    // The board's pieces step aside for the fight's own heroes; the bench stays.
    this.syncPieces();
    this.refreshHud();
    sound.drumBeat(0, true);
  }

  /** The fight is over: the round's result stands. */
  private finishFight(): void {
    if (this.phase !== 'fight' || !this.fight) return;
    this.applyRound();
  }

  /** Who lost what (as the host reckoned it), this player's result, and whether they or the match are done. */
  private applyRound(): void {
    const r = this.pendingRound;
    this.phase = 'result';
    if (!r) return;
    this.pendingRound = null;
    const my = this.mySeat;
    const wasIn = this.seats[my].hp > 0;
    this.seats.forEach((s, i) => {
      s.hp = r.hp[i] ?? s.hp;
      if (i !== my) s.level = r.lv[i] ?? s.level;
      s.place = r.place[i] ?? s.place;
    });
    const bout = r.bouts.find((b) => b.a === my || (!b.ghost && b.b === my));
    let won: boolean | null = null;
    if (bout) {
      const side = bout.a === my ? 0 : 1;
      won = bout.win === -1 ? null : bout.win === side;
      this.me.settle(won, 0);
      if (wasIn) this.showResult(won, bout, side);
    }
    this.me.hp = this.seats[my].hp;
    this.wonLast = won === true;
    this.refreshHud();
    this.checkEnd(wasIn);
  }

  /** The match ends with one (or nobody) left; a player who just fell is out (in practice, that's the end). */
  private checkEnd(wasIn: boolean): void {
    if (this.decided) return;
    const left = this.aliveSeats().length;
    const fell = wasIn && this.seats[this.mySeat].hp <= 0;
    if (left <= 1 || (fell && this.mode === 'ai')) {
      this.decided = true;
      this.nextRound?.remove();
      this.nextRound = null;
      this.time.delayedCall(RESULT_SECONDS * 1000, () => this.gameOver());
    } else if (fell) {
      this.out = true;
      this.time.delayedCall(RESULT_SECONDS * 1000, () => this.showOut());
    }
  }

  private showResult(won: boolean | null, bout: Bout, side: 0 | 1): void {
    if (this.out) return;
    this.clearOverlay();
    const at = this.boardCentre();
    const c = (this.overlay = this.add.container(at.x, at.y));
    const key = won === true ? 'ab_victory' : won === false ? 'ab_defeat' : 'ab_draw';
    const img = this.add.image(0, -20, key).setScale(2);
    if (won === false) img.setTint(0xff9a9a);
    const foe = this.seats[side === 0 ? bout.b : bout.a];
    const mine = bout.dmg[side];
    let line: string;
    if (bout.ghost) line = won === true ? `Ghost beaten: +${-mine} health` : won === false ? `The ghost wins: you lose ${mine}` : 'The ghost fades: no change';
    else line = won === true ? `${foe.name} loses ${bout.dmg[1 - side]}` : won === false ? `You lose ${mine}` : `Both lose ${mine}`;
    const t = pixelText(this, 0, 0, fitLine(this.probe, line, this.vw - 8), won === false ? RED : won === true ? GREEN : LAVENDER);
    t.setPosition(-Math.round(t.width / 2), 2);
    c.add([img, t]).setDepth(20000).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: RESULT_SECONDS * 1000 - 400, duration: 300 });
    play(() => {
      if (won === true) sound.encore();
      else if (won === false) sound.hurt();
    });
  }

  private clearOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  /** Out of a match that goes on (online): the place, and watch on or leave. The host's leaving ends it for all. */
  private showOut(): void {
    if (this.decided || this.leaving) return;
    this.clearOverlay();
    const at = this.boardCentre();
    const c = (this.overlay = this.add.container(at.x, at.y));
    const bg = this.add.image(0, 0, panelTexture(this, 'ab_out_panel', 200, 72, PANEL)).setOrigin(0.5);
    const img = this.add.image(0, -18, 'ab_defeat').setScale(1.2).setTint(0xff9a9a);
    const t = pixelText(this, 0, -2, `Out in ${ordinal(this.seats[this.mySeat].place || this.aliveSeats().length + 1)} place`, LAVENDER);
    t.setX(-Math.round(t.width / 2));
    const items: Phaser.GameObjects.GameObject[] = [bg, img, t];
    if (this.host) {
      const h = pixelText(this, 0, 8, 'Leaving ends the match for all', SOFT);
      h.setX(-Math.round(h.width / 2));
      items.push(h);
    }
    const watch = new PixelButton(this, 'Watch', 90, 16, BUTTON_GOLD, 'ab_watch', () => this.clearOverlay()).place(-94, 18);
    const out = new PixelButton(this, 'Leave', 90, 16, BUTTON_PLAIN, 'ab_out', () => this.leave()).place(4, 18);
    items.push(watch, out);
    c.add(items).setDepth(20000);
  }

  /** The match is over: a banner, this player's place, the prize, and the way out. */
  private gameOver(): void {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'over';
    this.out = false;
    this.nextRound?.remove();
    this.nextRound = null;
    this.waitBoard?.remove();
    this.waitBoard = null;
    this.off?.();
    this.off = null;
    if (this.mode === 'online') session.close();
    this.fight?.destroy();
    this.fight = null;
    this.clearOverlay();
    const my = this.seats[this.mySeat];
    const alive = this.aliveSeats();
    // The last one in wins; if the last ones all fell together, they share it as a draw.
    const won: boolean | null = alive.length === 1 ? alive[0] === this.mySeat : alive.length === 0 && my.place === 1 ? null : false;
    const gems = won ? WIN_GEMS[this.mode] : 0;
    if (gems) collection.addGems(gems);
    const winner = alive.length === 1 ? this.seats[alive[0]] : null;
    const at = this.boardCentre();
    const c = (this.overlay = this.add.container(at.x, at.y));
    const bg = this.add.image(0, 0, panelTexture(this, 'ab_over', 200, 96, PANEL)).setOrigin(0.5);
    const img = this.add.image(0, -26, won ? 'ab_victory' : won === false ? 'ab_defeat' : 'ab_draw').setScale(1.5);
    const two = this.seats.length === 2;
    const other = this.seats[1 - this.mySeat];
    const line = won
      ? two
        ? `You beat ${other.name} in ${this.round} rounds`
        : `Last one standing after ${this.round} rounds`
      : won === false
        ? two
          ? `${other.name} wins in ${this.round} rounds`
          : `${ordinal(my.place || alive.length + 1)} place${winner ? `: ${winner.name} wins` : ''}`
        : 'Nobody is left standing';
    const t = pixelText(this, 0, -4, fitLine(this.probe, line, 190), LAVENDER);
    t.setX(-Math.round(t.width / 2));
    const items: Phaser.GameObjects.GameObject[] = [bg, img, t];
    if (gems) {
      const g = pixelText(this, 0, 8, `+${gems} gems`, GOLD);
      g.setX(-Math.round(g.width / 2));
      items.push(g);
    }
    const again = new PixelButton(this, this.mode === 'ai' ? 'Again' : 'Lobby', 90, 16, BUTTON_GOLD, 'ab_again', () => {
      this.clearOverlay();
      if (this.mode === 'ai') this.startPractice();
      else this.toLobby();
    }).place(-94, 24);
    const out = new PixelButton(this, 'Leave', 90, 16, BUTTON_PLAIN, 'ab_out', () => this.leave()).place(4, 24);
    items.push(again, out);
    c.add(items).setDepth(20000);
    this.syncPieces();
    this.refreshHud();
    this.readyBtn?.setVisible(false);
    play(() => {
      if (won) sound.fishLanded(2);
    });
  }

  private toLobby(): void {
    this.off?.();
    this.off = null;
    session.close();
    this.nextRound?.remove();
    this.nextRound = null;
    this.waitBoard?.remove();
    this.waitBoard = null;
    this.fight?.destroy();
    this.fight = null;
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.fx.clear();
    this.clearOverlay();
    this.closeBoons();
    this.phase = 'lobby';
    this.out = false;
    this.me = undefined as unknown as AutoPlayer;
    this.showLobby();
  }

  // ------------------------------------------------------------ boons

  /**
   * The boon cards: the page dims, motes of the tier's light rise, a title
   * drops in, and three cards are dealt face down and turn over one by one.
   * Tap one to keep it. `reveal`: deal them (else they're just shown, after a
   * resize).
   */
  private showBoons(reveal: boolean): void {
    const offer = this.boonOffer;
    this.closeBoons();
    if (!offer || !offer.length) return;
    const vw = this.vw;
    const vh = this.vh;
    const tier = boonDef(offer[0])?.tier ?? 0;
    const accent = tierAccent(tier);
    const root = (this.boonView = this.add.container(0, 0).setDepth(30000));
    const dim = this.add.rectangle(0, 0, vw, vh, 0x05040e, 0.8).setOrigin(0);
    const block = this.add.zone(0, 0, vw, vh).setOrigin(0).setInteractive();
    this.boonMoteG = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.boonMotes = [];
    for (let i = 0; i < BOON_MOTES; i++) this.boonMotes.push(this.newMote(Math.random() * vh));
    if (!this.textures.exists('ab_boon_title')) this.textures.addCanvas('ab_boon_title', titleBitmap('Choose a Boon').toCanvas());
    const title = this.add.image(Math.round(vw / 2), PAD + 2, 'ab_boon_title').setOrigin(0.5, 0);
    const sub = pixelText(this, 0, PAD + 2 + title.height + 3, `${TIER_NAMES[tier]} boons`, accent);
    sub.setX(Math.round(vw / 2 - sub.width / 2));
    this.boonTimer = pixelText(this, 0, sub.y + 9, '', SOFT);
    const heads = [title, sub, this.boonTimer];

    // The cards: as wide as three fit (up to a cap), as tall as their words need.
    const gap = vw >= 300 ? 10 : 6;
    const cw = Math.max(60, Math.min(BOON_CARD_MAX, Math.floor((vw - PAD * 2 - 8 - gap * 2) / 3)));
    const inner = cw - 18;
    const defs = offer.map((id) => boonDef(id)!);
    const names = defs.map((d) => wrap(this.probe, d.name, inner).slice(0, 2));
    const nameLines = Math.max(1, ...names.map((n) => n.length));
    const texts = defs.map((d) => wrap(this.probe, d.text, inner));
    const L0 = boonLayout(cw, 0, nameLines);
    const need = L0.textY + Math.max(...texts.map((t) => t.length)) * BOON_LINE + 22;
    const top = this.boonTimer.y + 12;
    const room = vh - top - 16 - PAD * 2 - 6;
    const ch = Math.min(Math.max(need, Math.round(cw * 1.38)), Math.max(need, room));
    const x0 = Math.round((vw - (cw * 3 + gap * 2)) / 2);

    // A column of the tier's light behind the row.
    const wash = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 6; i++) wash.fillStyle(accent, 0.025).fillEllipse(vw / 2, top + ch / 2, (cw * 3 + gap * 2) * (0.7 + i * 0.12), ch * (0.9 + i * 0.1));
    root.add([dim, block, wash, this.boonMoteG, ...heads]);

    this.boonCards = defs.map((d, i) => {
      const L = boonLayout(cw, ch, nameLines);
      const box = this.add.container(x0 + i * (cw + gap) + cw / 2, top + ch / 2);
      const back = this.add.image(0, 0, boonBack(this, d.tier, cw, ch));
      const face = this.add.container(-cw / 2, -ch / 2);
      const bg = this.add.image(0, 0, boonCard(this, d.tier, cw, ch, nameLines)).setOrigin(0);
      const glow = this.add.image(L.cx, L.cy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tierAccent(d.tier)).setDisplaySize(L.halo * 3.4, L.halo * 3.4).setAlpha(0.45);
      const icon = this.add.image(L.cx, L.cy, boonIcon(this, d.id, L.icon));
      const sheen = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const items: Phaser.GameObjects.GameObject[] = [bg, glow, icon, sheen];
      // The name on the ribbon, shadowed so it reads on any metal; the words under it; the tier at the foot.
      const nameY = L.ribbonY + 3 + Math.round(((nameLines - names[i].length) * BOON_LINE) / 2);
      names[i].forEach((ln, k) => {
        const shadow = pixelText(this, 0, nameY + k * BOON_LINE + 1, ln, 0x0b0818);
        const t = pixelText(this, 0, nameY + k * BOON_LINE, ln, INK);
        const x = Math.round(cw / 2 - t.width / 2);
        shadow.setX(x);
        t.setX(x);
        items.push(shadow, t);
      });
      texts[i].forEach((ln, k) => {
        const t = pixelText(this, 0, L.textY + k * BOON_LINE, ln, 0xe0d8ff);
        items.push(t.setX(Math.round(cw / 2 - t.width / 2)));
      });
      const tl = pixelText(this, 0, ch - L.border - 10, TIER_NAMES[d.tier], tierAccent(d.tier));
      items.push(tl.setX(Math.round(cw / 2 - tl.width / 2)));
      face.add(items);
      const flash = this.add.rectangle(0, 0, cw, ch, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD);
      const hit = this.add.zone(0, 0, cw, ch).setInteractive({ useHandCursor: true });
      box.add([back, face, flash, hit]);
      root.add(box);
      const view: BoonCardView = { id: d.id, tier: d.tier, box, face, back, icon, glow, sheen, flash, hit, w: cw, h: ch, iconY: L.cy, baseY: box.y, t: i * 1.7, hover: false };
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) view.hover = true;
      });
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => (view.hover = false));
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (this.boonLive) this.takeBoon(d.id, true);
      });
      return view;
    });

    // Look past the cards at the board (and back).
    const peek = new PixelButton(this, 'Look at board', 96, 16, BUTTON_PLAIN, 'ab_boon_peek', () => this.peekBoons(true)).place(Math.round(vw / 2 - 48), Math.min(vh - 16 - PAD, top + ch + 6));
    this.boonBack = new PixelButton(this, 'Choose a boon', 96, 16, BUTTON_GOLD, 'ab_boon_back', () => this.peekBoons(false)).place(Math.round(vw / 2 - 48), PAD + 15);
    this.boonBack.setVisible(false);
    this.boonBack.setEnabled(false);
    root.add([peek, this.boonBack]);
    root.setData('block', block);
    root.setData('peek', peek);

    if (!reveal) {
      this.boonLive = true;
      for (const c of this.boonCards) {
        c.back.setVisible(false);
        c.face.setVisible(true);
      }
      return;
    }
    // The deal: the dark and the title come in, the cards rise face down, then turn over in turn.
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.8, duration: 260 });
    title.setAlpha(0).setY(title.y - 10);
    this.tweens.add({ targets: title, alpha: 1, y: title.y + 10, duration: 320, ease: 'Back.Out' });
    for (const o of [sub, this.boonTimer, peek]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 300, delay: 200 });
    }
    this.boonLive = false;
    this.boonCards.forEach((c, i) => {
      c.face.setVisible(false);
      c.box.setAlpha(0).setY(c.baseY + 28);
      this.tweens.add({ targets: c.box, alpha: 1, y: c.baseY, duration: 300, delay: 120 + i * BOON_DEAL_MS, ease: 'Back.Out' });
      this.time.delayedCall(120 + BOON_FLIP_MS + i * BOON_DEAL_MS, () => this.flipBoon(c, i));
    });
    this.time.delayedCall(120 + BOON_FLIP_MS + 2 * BOON_DEAL_MS + 260, () => {
      if (this.boonView === root) this.boonLive = true;
    });
  }

  /** Turn a dealt card over: it narrows to an edge, shows its face, widens again with a flash. */
  private flipBoon(c: BoonCardView, i: number): void {
    if (!c.box.active) return;
    this.tweens.add({
      targets: c.box,
      scaleX: 0,
      duration: 90,
      ease: 'Sine.In',
      onComplete: () => {
        if (!c.box.active) return;
        c.back.setVisible(false);
        c.face.setVisible(true);
        c.flash.setAlpha(0.75);
        this.tweens.add({ targets: c.flash, alpha: 0, duration: 320 });
        this.tweens.add({ targets: c.box, scaleX: 1, duration: 150, ease: 'Back.Out' });
      },
    });
    play(() => sound.cardFlip(Math.min(2, c.tier + (i === 2 ? 1 : 0))));
  }

  /** A mote of light starting at height `y` (the page's foot when new). */
  private newMote(y = this.vh + 2): { x: number; y: number; v: number; a: number; c: number } {
    const tier = boonDef(this.boonOffer?.[0] ?? '')?.tier ?? 0;
    return { x: Math.random() * this.vw, y, v: 6 + Math.random() * 16, a: 0.25 + Math.random() * 0.5, c: Math.random() < 0.7 ? tierAccent(tier as BoonTier) : 0xffffff };
  }

  /** The cards' life while they're up: motes rising, pictures bobbing, glows breathing, sheens crossing. */
  private tickBoons(dt: number): void {
    const g = this.boonMoteG;
    if (g) {
      g.clear();
      for (const m of this.boonMotes) {
        m.y -= m.v * dt;
        m.x += Math.sin((m.y + m.v * 10) / 17) * dt * 3;
        if (m.y < -2) Object.assign(m, this.newMote());
        const fade = Math.min(1, m.y / (this.vh * 0.4));
        g.fillStyle(m.c, m.a * fade).fillRect(Math.round(m.x), Math.round(m.y), m.v > 18 ? 2 : 1, m.v > 18 ? 2 : 1);
      }
    }
    this.boonTimer?.setText(this.phase === 'plan' ? `${Math.max(0, Math.ceil(this.timer))}s to choose` : '');
    if (this.boonTimer) this.boonTimer.setX(Math.round(this.vw / 2 - this.boonTimer.width / 2));
    for (const c of this.boonCards) {
      if (!c.box.active) continue;
      c.t += dt;
      c.icon.setY(c.iconY + Math.round(Math.sin(c.t * 2.2) * 1.5));
      c.glow.setAlpha(0.36 + 0.14 * Math.sin(c.t * 3.1) + (c.hover ? 0.25 : 0));
      // Lift a little under the pointer.
      if (this.boonLive) c.box.y += ((c.hover ? c.baseY - 4 : c.baseY) - c.box.y) * Math.min(1, dt * 14);
      this.drawSheen(c);
    }
  }

  /** A slanted band of light crossing a card now and then: prism's shifts through the rainbow as it goes. */
  private drawSheen(c: BoonCardView): void {
    const g = c.sheen.clear();
    const period = BOON_SHEEN[c.tier];
    const k = (c.t % period) / period / 0.4;
    if (k >= 1 || !c.face.visible) return;
    const w = c.w;
    const h = c.h;
    const slant = Math.round(h / 3);
    const bw = 8;
    const x0 = Math.round(-bw - slant + k * (w + bw * 2 + slant));
    const base = c.tier === 2 ? Phaser.Display.Color.HSVToRGB(k, 0.45, 1).color : 0xfff4d6;
    const a = c.tier === 0 ? 0.08 : 0.13;
    for (let y = 6; y < h - 6; y++) {
      const x = x0 + Math.round((h - y) / 3);
      const l = Math.max(6, x);
      const r = Math.min(w - 6, x + bw);
      if (r > l) g.fillStyle(base, a).fillRect(l, y, r - l, 1);
      const l2 = Math.max(6, x + 3);
      const r2 = Math.min(w - 6, x + 5);
      if (r2 > l2) g.fillStyle(0xffffff, a).fillRect(l2, y, r2 - l2, 1);
    }
  }

  /** Put the cards aside to look at the board (they wait behind a button), or bring them back. */
  private peekBoons(on: boolean): void {
    const root = this.boonView;
    if (!root) return;
    this.boonPeek = on;
    for (const o of root.list) if (o !== this.boonBack) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(!on);
    this.boonBack?.setVisible(on);
    // Hidden things still catch taps unless told not to.
    const block = root.getData('block') as Phaser.GameObjects.Zone | undefined;
    if (block?.input) block.input.enabled = !on;
    (root.getData('peek') as PixelButton | undefined)?.setEnabled(!on);
    this.boonBack?.setEnabled(on);
    for (const c of this.boonCards) {
      c.hover = false;
      if (c.hit.input) c.hit.input.enabled = !on;
    }
  }

  /**
   * Keep a boon: it's this player's from now on, and what it gives at once is
   * given. `animate`: the chosen card flares and flies to the kept boons, the
   * others fall away.
   */
  private takeBoon(id: string, animate: boolean): void {
    if (!this.me || !this.boonOffer?.includes(id)) return;
    this.boonOffer = null;
    this.me.takeBoon(id);
    const mine = this.seats[this.mySeat];
    if (mine) {
      mine.boons = [...this.me.boons];
      mine.level = this.me.level;
    }
    const tier = boonDef(id)?.tier ?? 0;
    const root = this.boonView;
    if (animate && root) {
      play(() => sound.wishBurst(tier));
      this.boonLive = false;
      const cards = this.boonCards;
      // Detach the view so the next show or a close doesn't fight the exit; it removes itself.
      this.boonView = null;
      this.boonCards = [];
      this.boonMoteG = null;
      this.boonTimer = null;
      this.boonBack = null;
      this.boonPeek = false;
      for (const c of cards) {
        if (c.id === id) {
          c.flash.setAlpha(0.9);
          this.tweens.add({ targets: c.flash, alpha: 0, duration: 380 });
          this.tweens.add({ targets: c.box, scale: 1.12, duration: 180, ease: 'Back.Out' });
          // Then off to where the kept boons are shown.
          const to = { x: this.traitRect.x + BADGE / 2, y: this.traitRect.y + 12 + BADGE / 2 };
          this.tweens.add({ targets: c.box, x: to.x, y: to.y, scale: 0.12, alpha: 0.2, delay: 420, duration: 360, ease: 'Cubic.In' });
        } else this.tweens.add({ targets: c.box, alpha: 0, y: c.box.y + 26, duration: 240, ease: 'Sine.In' });
      }
      this.tweens.add({ targets: root, alpha: 0, delay: 620, duration: 220, onComplete: () => root.destroy() });
    } else this.closeBoons();
    this.syncPieces();
    this.refreshHud();
  }

  /** Take the cards down (the offer, if any, stays). */
  private closeBoons(): void {
    this.boonView?.destroy();
    this.boonView = null;
    this.boonCards = [];
    this.boonMoteG = null;
    this.boonTimer = null;
    this.boonBack = null;
    this.boonPeek = false;
    this.boonLive = false;
  }

  // ------------------------------------------------------------ shop

  private buy(i: number): void {
    if (!this.me?.alive || !(this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result')) return;
    const before = this.me.all().map((p) => p.star);
    const piece = this.me.buy(i, this.phase !== 'plan');
    if (!piece) {
      // Can't: too dear, or nowhere to put it. The card shakes.
      const card = this.cards[i];
      if (!this.tweens.isTweening(card)) this.tweens.add({ targets: card, x: card.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    const starred = piece.star > 1 && this.me.all().filter((p) => p.star >= piece.star).length > before.filter((s) => s >= piece.star).length;
    play(() => {
      if (starred) sound.forged();
      else sound.gemSpend();
    });
    this.syncPieces();
    if (starred) {
      const v = this.views.get(piece.id);
      if (v) {
        const st = styleOf(piece.key, piece.look);
        this.fx.sparksAt(v.x, v.y - 12, 24, [0xffffff, 0xffe08a, st.pal.hot], { speed: 30, up: 40, life: 0.8 });
        this.tweens.add({ targets: v, scale: { from: 1.4, to: 1 }, duration: 400, ease: 'Back.Out' });
      }
    }
    this.refreshHud();
  }

  private reroll(): void {
    if (!this.me?.alive || this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait') return;
    if (this.me.reroll()) {
      play(() => {
        sound.cardFlip(0);
      });
      this.refreshHud();
    }
  }

  /** Freeze the shop so the next round keeps it (free), or thaw it. */
  private toggleFreeze(): void {
    if (!this.me?.alive || this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait') return;
    this.me.frozen = !this.me.frozen;
    play(() => {
      sound.cardFlip(0);
    });
    this.refreshHud();
  }

  /**
   * While the shop is frozen: an icy rim round each card, rime gathered in
   * their corners, and a few flakes caught on the top edge.
   */
  private drawFrost(): void {
    const g = this.frost.clear();
    if (!this.me?.frozen) return;
    for (const c of this.cards) {
      const x = c.x;
      const y = c.y;
      const w = c.cw;
      const h = c.chh;
      g.lineStyle(1, 0x9ad8ff, 0.9).strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      g.fillStyle(0xe8f8ff, 0.08).fillRect(x + 1, y + 1, w - 2, h - 2);
      // Rime in the corners: a stair of pale pixels.
      g.fillStyle(0xe8f8ff, 0.85);
      for (const [cx, cy, dx, dy] of [
        [x, y, 1, 1],
        [x + w - 1, y, -1, 1],
        [x, y + h - 1, 1, -1],
        [x + w - 1, y + h - 1, -1, -1],
      ]) {
        g.fillRect(cx, cy, 1, 1);
        g.fillRect(cx + dx, cy, 1, 1);
        g.fillRect(cx, cy + dy, 1, 1);
        g.fillStyle(0x9ad8ff, 0.6).fillRect(cx + dx * 2, cy, 1, 1).fillRect(cx, cy + dy * 2, 1, 1);
        g.fillStyle(0xe8f8ff, 0.85);
      }
      // Two flakes on the top edge, placed by the card's spot so they don't jump about.
      for (const fx of [Math.round(w * 0.3), Math.round(w * 0.72)]) {
        g.fillStyle(0xe8f8ff, 0.9).fillRect(x + fx, y - 1, 1, 1);
        g.fillStyle(0x9ad8ff, 0.7).fillRect(x + fx - 1, y - 1, 1, 1).fillRect(x + fx + 1, y - 1, 1, 1).fillRect(x + fx, y - 2, 1, 1);
      }
    }
  }

  private buyXp(): void {
    if (!this.me?.alive || this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait') return;
    const lvl = this.me.level;
    if (this.me.buyXp()) {
      play(() => {
        if (this.me.level > lvl) sound.ultReady();
        else sound.gemTick();
      });
      this.refreshHud();
    }
  }

  private toggleReady(): void {
    if (this.phase !== 'plan' || !this.me.alive) return;
    // A boon is chosen before the fight: Fight while looking at the board brings the cards back.
    if (this.boonOffer) {
      if (this.boonPeek) this.peekBoons(false);
      return;
    }
    if (this.mode === 'ai') return this.endPlan();
    this.ready = !this.ready;
    session.send({ t: 'ar', round: this.round, on: this.ready });
    this.checkReady();
    this.refreshHud();
  }

  // ------------------------------------------------------------ pieces

  /** A bench slot's feet, in world px: a row under the board, or a dock of two columns beside it. */
  private benchPt(i: number): { x: number; y: number } {
    const c = i % this.benchCols;
    const r = Math.floor(i / this.benchCols);
    return { x: this.benchX + 3 + c * BENCH_SLOT + BENCH_SLOT / 2, y: this.benchY + 3 + r * BENCH_SLOT + BENCH_SLOT - 4 };
  }

  /** Make the drawn pieces match the player's bench and (outside a fight) board. */
  private syncPieces(): void {
    if (!this.me) return;
    const seen = new Set<number>();
    const place = (p: Piece, x: number, y: number, depth: number) => {
      seen.add(p.id);
      let v = this.views.get(p.id);
      if (!v) {
        v = new UnitView(this, p.key, p.look, p.star, true, 'up');
        v.hideBars();
        this.layer.add(v);
        this.views.set(p.id, v);
      }
      if (this.press?.piece === p && this.press.dragging) return;
      v.setPosition(Math.round(x), Math.round(y)).setDepth(depth);
    };
    this.me.bench.forEach((p, i) => {
      if (!p) return;
      const at = this.benchPt(i);
      place(p, at.x, at.y, 5000 + at.y);
    });
    if (!this.fight) {
      for (const { spot, piece } of this.me.boardPieces()) {
        const at = cellPt(this.frame, spot.c, spot.r);
        place(piece, at.x, at.y, at.y);
      }
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.destroy();
        this.views.delete(id);
      }
    }
    // Faded to show a piece that can't go on the board (it's full).
    this.layer.sort('depth');
    this.drawMarks(null);
  }

  /**
   * A press anywhere: the piece under it, if any, is picked up (a tap shows its
   * card, a drag moves it). Pieces aren't hit by their sprites, whose frames are
   * wider than a cell and mostly empty, so neighbours overlapped and the one
   * drawn on top won; `pieceAt` goes by where each hero stands instead.
   */
  private onDown(ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait' || !this.me?.alive) return;
    // A press on a card, a button or the hero card belongs to it.
    if (over.length) return;
    const x = ptr.x / this.z;
    const y = ptr.y / this.z;
    const piece = this.pieceAt(x, y);
    const view = piece && this.views.get(piece.id);
    if (!piece || !view) return;
    this.press = { piece, view, x, y, dragging: false };
  }

  /**
   * The piece a press at page px (x, y) means: of those whose body (a box from
   * the feet up a hero's height, a cell wide) holds the point, the one whose
   * middle is nearest.
   */
  private pieceAt(x: number, y: number): Piece | null {
    const w = this.toWorld(x, y);
    const half = CELL_W / 2;
    let best: Piece | null = null;
    let bestD = Infinity;
    const consider = (p: Piece, at: { x: number; y: number }) => {
      const dx = Math.abs(w.x - at.x);
      const dy = w.y - at.y;
      if (dx > half || dy > PICK_BELOW || dy < -PICK_ABOVE) return;
      // Nearest to the body's middle, a little up from the feet; across counts for more than up and down.
      const d = dx * dx + 0.35 * (dy + 9) * (dy + 9);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    };
    this.me.bench.forEach((p, i) => p && consider(p, this.benchPt(i)));
    if (!this.fight) for (const { spot, piece } of this.me.boardPieces()) consider(piece, cellPt(this.frame, spot.c, spot.r));
    return best;
  }

  private onMove(ptr: Phaser.Input.Pointer): void {
    const pr = this.press;
    if (!pr) return;
    const x = ptr.x / this.z;
    const y = ptr.y / this.z;
    if (!pr.dragging) {
      if (Math.hypot(x - pr.x, y - pr.y) < DRAG_SLOP) return;
      // A piece on the board is fixed while the fight is on.
      if (this.phase !== 'plan' && !this.me.bench.includes(pr.piece)) return;
      pr.dragging = true;
      pr.view.setDepth(30000);
      this.layer.sort('depth');
      this.sellZone.setVisible(true);
      this.sellText.setText(`SELL ${sellValue(pr.piece)}`);
      this.sellText.setPosition(Math.round(this.shopRect.width / 2 - this.sellText.width / 2), Math.round(this.shopRect.height / 2 - 7));
      this.refreshInfo();
    }
    // Held a little above the finger, so the hero stands where it's held and stays in sight.
    const w = this.toWorld(x, y);
    pr.view.setPosition(Math.round(w.x), Math.round(w.y + 6));
    this.drawMarks(this.dropAt(x, y));
  }

  private onUp(ptr: Phaser.Input.Pointer): void {
    const pr = this.press;
    this.press = null;
    this.sellZone.setVisible(false);
    if (!pr) return;
    if (!pr.dragging) {
      // A tap: show this hero on the card (a second tap puts it away).
      const same = this.selected?.key === pr.piece.key && this.selected.star === pr.piece.star;
      this.selected = same ? null : { key: pr.piece.key, star: pr.piece.star, look: pr.piece.look };
      this.boonShown = null;
      this.refreshInfo();
      return;
    }
    const drop = this.dropAt(ptr.x / this.z, ptr.y / this.z);
    if (drop && 'sell' in drop) {
      const g = this.me.sell(pr.piece);
      play(() => {
        sound.gemTink();
      });
      this.fx.sparksAt(pr.view.x, pr.view.y - 10, 10, [0xffe08a, 0xffc94a], { speed: 20, up: 30 });
      if (g) this.selected = null;
    } else if (drop) {
      const ok = this.me.move(pr.piece, drop);
      if (ok) {
        this.me.combine(this.phase !== 'plan');
        play(() => sound.step());
      }
    }
    this.syncPieces();
    this.refreshHud();
  }

  private cancelDrag(): void {
    if (!this.press) return;
    this.press = null;
    this.sellZone.setVisible(false);
    this.syncPieces();
  }

  /** Where a drag would drop at page px (x, y): a bench slot, a cell on the player's half, the shop (to sell), or nowhere. */
  private dropAt(x: number, y: number): Drop {
    const sr = this.shopRect;
    if (Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(sr.x - 2, sr.y - 2, sr.width + 4, sr.height + 4), x, y)) return { sell: true };
    const w = this.toWorld(x, y);
    // A little slack round the bench, as fingers are wide.
    const bc = Math.floor((w.x - this.benchX - 3) / BENCH_SLOT);
    const br = Math.floor((w.y - this.benchY - 3) / BENCH_SLOT);
    const rows = BENCH_SIZE / this.benchCols;
    const inX = w.x >= this.benchX - 4 && w.x < this.benchX + 3 + this.benchCols * BENCH_SLOT + 4;
    const inY = w.y >= this.benchY - 4 && w.y < this.benchY + 3 + rows * BENCH_SLOT + 8;
    if (inX && inY) return { bench: Math.max(0, Math.min(this.benchCols - 1, bc)) + Math.max(0, Math.min(rows - 1, br)) * this.benchCols };
    if (this.phase !== 'plan') return null;
    const f = this.frame;
    const c = Math.floor((w.x - f.x) / f.cw);
    // Feet a little under the pointer, so the hero stands where it's held.
    const r = Math.floor((w.y + 6 - f.y) / f.ch);
    if (c < 0 || c >= COLS || r < HALF || r >= ROWS) return null;
    return { cell: cellKey(c, r) };
  }

  /** Light the player's half while a piece is held, and the cell or slot it would land in (world px). */
  private drawMarks(drop: Drop): void {
    const g = this.marks.clear();
    if (!this.press?.dragging || !this.me) return;
    const f = this.frame;
    if (this.phase === 'plan') {
      for (let r = HALF; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          g.lineStyle(1, 0x6fb8ff, 0.25).strokeRect(f.x + c * f.cw + 1.5, f.y + r * f.ch + 1.5, f.cw - 3, f.ch - 3);
        }
    }
    if (!drop || 'sell' in drop) return;
    if ('cell' in drop) {
      const c = drop.cell % COLS;
      const r = Math.floor(drop.cell / COLS);
      const full = this.me.bench.includes(this.press.piece) && !this.me.board.has(drop.cell) && this.me.board.size >= this.me.cap;
      const col = full ? 0xff5a5a : 0xffe08a;
      g.fillStyle(col, 0.18).fillRect(f.x + c * f.cw + 1, f.y + r * f.ch + 1, f.cw - 2, f.ch - 2);
      g.lineStyle(1, col, 0.9).strokeRect(f.x + c * f.cw + 1.5, f.y + r * f.ch + 1.5, f.cw - 3, f.ch - 3);
    } else {
      const x = this.benchX + 3 + (drop.bench % this.benchCols) * BENCH_SLOT;
      const y = this.benchY + 3 + Math.floor(drop.bench / this.benchCols) * BENCH_SLOT;
      g.lineStyle(1, 0xffe08a, 0.9).strokeRect(x + 1.5, y + 1.5, BENCH_SLOT - 3, BENCH_SLOT - 3);
    }
  }

  // ------------------------------------------------------------ online

  private onlineMe() {
    return { name: this.myName(), hero: 'auto', look: '' };
  }

  private openRoom(): void {
    if (!session.configured) return this.notice("Online play isn't set up.");
    this.host = true;
    this.waiting(null);
    session
      .open({ t: 'create', mode: 'coop', arena: AUTO_ARENA }, this.onlineMe())
      .then((room) => {
        this.host = true;
        this.roomCode = room.code;
        this.listen();
        this.waiting(room.code);
      })
      .catch((e: Error) => this.backToLobby(e.message));
  }

  private joinRoom(): void {
    if (!session.configured) return this.notice("Online play isn't set up.");
    onlineStyles();
    if (document.getElementById('online')) return;
    const root = document.createElement('div');
    root.id = 'online';
    root.className = 'chrome';
    root.innerHTML = `
      <div class="box">
        <h2>Join a friend</h2>
        <p>Type the code from your friend's Auto Battle room.</p>
        <div class="row"><input maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"><button type="button" class="go" data-join>Join</button></div>
        <div class="msg"></div>
        <button type="button" data-close>Back</button>
      </div>`;
    document.body.append(root);
    for (const t of ['keydown', 'keyup', 'keypress']) root.addEventListener(t, (e) => e.stopPropagation());
    const input = root.querySelector('input') as HTMLInputElement;
    const msg = root.querySelector('.msg') as HTMLElement;
    const close = () => root.remove();
    root.querySelector('[data-close]')!.addEventListener('click', close);
    const go = () => {
      const code = input.value.trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) {
        msg.textContent = 'Room codes are 4 letters.';
        msg.classList.add('err');
        return;
      }
      close();
      this.host = false;
      this.waiting(null);
      session
        .open({ t: 'join', code }, this.onlineMe())
        .then((room) => {
          if (room.arena !== AUTO_ARENA) {
            session.close();
            return this.backToLobby("That code isn't an Auto Battle room.");
          }
          this.host = false;
          this.hostPeer = room.host;
          this.roomCode = room.code;
          this.listen();
          this.waiting(room.code);
        })
        .catch((e: Error) => this.backToLobby(e.message));
    };
    root.querySelector('[data-join]')!.addEventListener('click', go);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    input.focus();
  }

  /** People in the room, this player first. */
  private roomPeople(): { name: string; id: number }[] {
    return [{ name: this.myName(), id: session.you }, ...[...session.peers.values()].map((p) => ({ name: p.name || 'Rival', id: p.id }))];
  }

  /**
   * The room before the match: its code big, who has come, and for the host
   * the bots to add and Start (once there are two at the table). No code yet
   * while the room opens.
   */
  private waiting(code: string | null): void {
    this.phase = 'wait';
    this.closeLobby();
    const c = (this.lobby = this.add.container(0, 0));
    const cx = Math.round(this.vw / 2);
    const cy = Math.round(this.vh / 2);
    const W = 230;
    const H = this.host && code ? 132 : 104;
    const top = cy - Math.round(H / 2);
    c.add(this.add.image(cx, cy, panelTexture(this, `ab_wait_${H}`, W, H, PANEL)).setOrigin(0.5));
    const text = (y: number, s: string, tint: number) => {
      const t = pixelText(this, 0, y, fitLine(this.probe, s, W - 12), tint);
      t.setX(cx - Math.round(t.width / 2));
      c.add(t);
      return t;
    };
    const line = !code ? (this.host ? 'Opening a room...' : 'Joining...') : this.host ? 'Send this code to friends' : 'Waiting for the host to start';
    text(top + 7, line, LAVENDER);
    if (code) {
      const k = `ab_code_${code}`;
      if (!this.textures.exists(k)) this.textures.addCanvas(k, titleBitmap(code).toCanvas());
      c.add(this.add.image(cx, top + 36, k).setScale(2));
      const people = this.roomPeople();
      text(top + 58, `${people.length}/4 here: ${people.map((p) => p.name).join(', ')}`, INK);
    } else c.add(pixelText(this, cx - 6, top + 30, '...', GOLD, 2));
    let y = top + H - 22;
    if (this.host && code) {
      // The bots to add, and Start.
      const people = this.roomPeople().length;
      const most = Math.min(MAX_BOTS, MAX_SEATS - people);
      this.roomBots = Math.max(0, Math.min(most, this.roomBots));
      c.add(this.stepper(cx - 50, top + 72, 100, this.roomBots, 0, most, (n) => {
        this.roomBots = n;
        this.waiting(code);
      }));
      const start = new PixelButton(this, 'Start', 80, 16, BUTTON_GOLD, 'ab_start', () => this.startOnline()).place(cx - 84, y);
      const ok = people + this.roomBots >= 2;
      start.setEnabled(ok).setAlpha(ok ? 1 : 0.5);
      c.add(start);
      c.add(new PixelButton(this, 'Cancel', 80, 16, BUTTON_PLAIN, 'ab_cancel', () => this.backToLobby()).place(cx + 4, y));
    } else {
      y = top + H - 22;
      c.add(new PixelButton(this, 'Cancel', 80, 16, BUTTON_PLAIN, 'ab_cancel', () => this.backToLobby()).place(cx - 40, y));
    }
    this.hud.setVisible(false);
  }

  /** A row to pick a count: minus, "n bots", plus. */
  private stepper(x: number, y: number, w: number, n: number, min: number, max: number, set: (n: number) => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const minus = new PixelButton(this, '-', 15, 15, BUTTON_PLAIN, 'ab_minus', () => n > min && set(n - 1)).place(0, 0);
    const plus = new PixelButton(this, '+', 15, 15, BUTTON_PLAIN, 'ab_plus', () => n < max && set(n + 1)).place(w - 15, 0);
    minus.setAlpha(n > min ? 1 : 0.45);
    plus.setAlpha(n < max ? 1 : 0.45);
    const t = pixelText(this, 0, 4, `${n} ${n === 1 ? 'bot' : 'bots'}`, GOLD);
    t.setX(Math.round(w / 2 - t.width / 2));
    c.add([minus, plus, t]);
    return c;
  }

  /** The host starts the match: the people in the room, then the bots. */
  private startOnline(): void {
    if (!this.host || this.phase !== 'wait') return;
    const people = this.roomPeople();
    const seats: SeatInfo[] = [
      ...people.map((p) => ({ name: p.name, bot: false, peer: p.id })),
      ...botNames(this.roomBots, people.map((p) => p.name)).map((name) => ({ name, bot: true, peer: -1 })),
    ];
    if (seats.length < 2) return;
    this.newMatch('online', seats, 0);
    session.send({ t: 'ag', seats });
    session.send({ t: 'ap', round: 1, sec: PLAN_SECONDS[0] });
    this.startPlan(1, PLAN_SECONDS[0]);
  }

  private backToLobby(err?: string): void {
    this.off?.();
    this.off = null;
    session.close();
    this.phase = 'lobby';
    this.showLobby();
    if (err) this.notice(err);
  }

  /** A short line over the page that fades. */
  private notice(text: string): void {
    const t = pixelText(this, 0, 0, text, RED);
    t.setPosition(Math.round(this.vw / 2 - t.width / 2), Math.round(this.vh * 0.35)).setDepth(30000);
    this.tweens.add({ targets: t, alpha: 0, delay: 2600, duration: 400, onComplete: () => t.destroy() });
  }

  private listen(): void {
    this.off?.();
    this.off = session.on((m) => this.onMsg(m));
  }

  /** How many of the people still in are ready, of how many. */
  private readyCount(): [number, number] {
    const people = this.livePeople();
    const n = people.filter((i) => this.readyIds.has(this.seats[i].peer)).length + (this.ready && this.me.alive ? 1 : 0);
    return [n, people.length + (this.me.alive ? 1 : 0)];
  }

  /** The host fights early once everyone still in is ready. */
  private checkReady(): void {
    if (!this.host || this.phase !== 'plan') return;
    const [n, m] = this.readyCount();
    if (m > 0 && n >= m) this.endPlan();
  }

  /** Someone left mid-match (the host's call): their seat is out, and the match may be settled. */
  private seatLeft(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.hp <= 0) return;
    const before = this.seats.map((x) => x.hp);
    s.hp = 0;
    const hp = this.seats.map((x) => x.hp);
    placesAfter(before, hp, this.seats.map((x) => x.place)).forEach((p, i) => (this.seats[i].place = p));
    session.send({ t: 'ah', hp, place: this.seats.map((x) => x.place) });
    this.awaiting.delete(seat);
    if (this.phase === 'fight' && !this.awaiting.size) this.hostFights();
    this.checkReady();
    this.afterLeave();
  }

  /** After someone left: the standings show it, and with one left the match is over. */
  private afterLeave(): void {
    this.refreshHud();
    if (this.decided || this.ended) return;
    if (this.aliveSeats().length <= 1) {
      this.decided = true;
      this.gameOver();
    }
  }

  private onMsg(m: Msg): void {
    const inMatch = !!this.me && this.phase !== 'wait' && this.phase !== 'lobby';
    switch (m.t) {
      case 'peer+': {
        const p = m.p as { id: number };
        if (this.phase === 'wait') this.waiting(this.roomCode);
        // Too late to sit down: the match has begun.
        else if (this.host && inMatch) session.send({ t: 'ax', to: p.id });
        break;
      }
      case 'peer-': {
        const id = Number(m.id);
        if (this.phase === 'wait') {
          if (!this.host && id === this.hostPeer) this.backToLobby('The host closed the room.');
          else this.waiting(this.roomCode);
          break;
        }
        if (!inMatch || this.ended) break;
        if (this.host) this.seatLeft(this.seatOf(id));
        else if (id === this.hostPeer) {
          // The host closes the room when the match is settled, maybe while this player's last fight still plays.
          const r = this.pendingRound;
          if (this.decided || (r && r.hp.filter((h) => h > 0).length <= 1)) break;
          this.toLobby();
          this.notice('The host left the match.');
        }
        break;
      }
      case 'closed':
        if (this.ended) break;
        if (this.phase === 'wait') this.backToLobby('The connection was lost.');
        else if (inMatch) {
          this.toLobby();
          this.notice('The connection was lost.');
        }
        break;
      case 'ax':
        if (!this.host) this.backToLobby('That match has already begun.');
        break;
      case 'ag': {
        if (this.host) break;
        const seats = cleanSeats(m.seats);
        const mine = seats.findIndex((s) => !s.bot && s.peer === session.you);
        if (seats.length >= 2 && mine >= 0) this.newMatch('online', seats, mine);
        break;
      }
      case 'ap':
        if (!this.host && inMatch && !this.ended) this.startPlan(Number(m.round) || this.round + 1, Number(m.sec) || PLAN_SECONDS[1]);
        break;
      case 'al':
        if (!this.host && inMatch && this.phase === 'plan') {
          this.cancelDrag();
          this.lockBoard();
          if (this.me.alive) session.send({ t: 'ab', round: this.round, b: this.me.placed(), lv: this.me.level, bn: this.me.boons });
        }
        break;
      case 'ab': {
        if (!this.host || !inMatch) break;
        const seat = this.seatOf(m.f);
        if (seat < 0) break;
        this.seats[seat].board = cleanBoard(m.b);
        this.seats[seat].boons = cleanBoons(m.bn);
        this.seats[seat].level = Math.max(1, Math.min(MAX_LEVEL, Number(m.lv) || this.seats[seat].level));
        this.awaiting.delete(seat);
        if (Number(m.round) === this.round && this.phase === 'fight' && !this.awaiting.size) this.hostFights();
        break;
      }
      case 'ar':
        if (inMatch && Number(m.round) === this.round && typeof m.f === 'number') {
          if (m.on) this.readyIds.add(m.f);
          else this.readyIds.delete(m.f);
          this.checkReady();
          this.refreshHud();
        }
        break;
      case 'af':
        if (!this.host && inMatch && !this.ended) {
          if (this.phase === 'plan') {
            this.cancelDrag();
            this.lockBoard();
          }
          if (this.phase === 'fight' && this.fight) this.finishFight();
          this.phase = 'fight';
          this.playRound(cleanRound(m, this.seats.length));
        }
        break;
      case 'ah':
        if (!this.host && inMatch && !this.ended) {
          const n = this.seats.length;
          const hp = cleanRound({ hp: m.hp }, n).hp;
          const place = cleanRound({ place: m.place }, n).place;
          this.seats.forEach((s, i) => {
            s.hp = hp[i];
            s.place = place[i];
          });
          this.me.hp = this.seats[this.mySeat].hp;
          this.afterLeave();
        }
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------ leaving

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.off?.();
    this.off = null;
    session.close();
    document.getElementById('online')?.remove();
    this.scene.setVisible(true, 'home');
    this.scene.launch(this.back);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 200, onComplete: () => this.scene.stop() });
  }
}
