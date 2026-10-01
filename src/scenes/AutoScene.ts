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
import { Battle, COLS, HALF, ROWS, type Placed } from '../game/auto/sim';
import { AutoPlayer, aiPlan, BENCH_SIZE, cellKey, lossDamage, MAX_LEVEL, PLAN_SECONDS, REROLL_COST, sellValue, SHOP_SIZE, XP_COST, XP_NEXT, type Piece } from '../game/auto/match';
import { COST_COLORS, TRAITS, unitDef, type TraitId } from '../game/auto/units';
import { FightView, UnitView, cellPt, styleOf, type BoardFrame } from '../game/auto/view';
import { FxLayer } from '../game/auto/fx';
import { pieceNumbers, spellText } from '../game/auto/info';
import { AUTO_ARENA, BOARD_WAIT_MS, cleanBoard, type FightMsg } from '../game/auto/online';
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
// crisp) in whatever room the slim bars round the edges leave. On a wide
// screen the bench is a 2x4 dock beside the board and the shop a column on
// the right; on a tall one the bench sits under the board and the shop runs
// along the bottom. Whichever lets the board be bigger wins.

/** Room over the board's top row for the heroes standing there (world px). */
const HEAD_ROOM = 14;
/** How much of the rock hanging under the dais must show in the wide layout. */
const UNDER_SHOW = 6;
/** A top bar row. */
const TOP_H = 15;
/** The wide layout's shop column, and the narrowest trait column beside the board. */
const COL_W = 80;
const TRAIT_MIN = 36;
/** The level and gold rows over and under the shop's cards. */
const ROW_H = 19;
/** A shop card's height in the tall layout, and the bounds in the wide one. */
const CARD_H_ROW = 46;
const CARD_H_ROW_MAX = 64;
const CARD_H_MIN = 30;
const CARD_H_MAX = 46;
const GAP = 2;
/** The round and clock: two lines and a bar in the wide layout's trait column, one line between the players in the tall one. */
const BANNER_H = 24;
const BANNER_W_TALL = 56;
/** About half the FPS counter's width (page px), kept clear in the top bar's middle while it shows. */
const FPS_HALF = 55;
const PAD = 3;
const FIGHT_H = 18;
/** The tall layout's trait chips. */
const CHIP_W = 31;
const CHIP_H = 11;
const TRAIT_ROW = 11;
/** The hero card that pops up for a tapped piece (or a hovered shop card). */
const INFO_W = 142;
const INFO_H = 106;
/** A press must move this far (art px) to become a drag. */
const DRAG_SLOP = 4;
/** Seconds the result stands before the next round. */
const RESULT_SECONDS = 2.6;
/** Seconds a finished fight lingers on its winners' cheer. */
const LINGER = 1.3;
/** Gems for winning a whole match. */
const WIN_GEMS = { ai: 5, online: 15 };
const RIVAL_NAMES = ['Morgana', 'Tharn', 'Brenna', 'Old Wick', 'Hazel', 'Nyx', 'Sir Aldric', 'Vesper'];

const INK = 0xfff4d6;
const LAVENDER = 0xb8a8e8;
const SOFT = 0x8a80b8;
const GOLD = 0xf4cf6a;
const RED = 0xff6a6a;
const GREEN = 0x7aff8a;

type Phase = 'lobby' | 'wait' | 'plan' | 'fight' | 'result' | 'over';
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
    this.badges = [0, 1].map((i) => scene.add.image(4 + i * 10, 4, 'ab_trait_arcane').setOrigin(0));
    this.coin = scene.add.image(0, 0, 'ab_coin').setOrigin(0);
    this.cost = pixelText(scene, 0, 0, '', GOLD);
    this.label = pixelText(scene, 3, 0, '');
    this.add([this.bg, this.win, this.sprite, this.glow, this.pair, ...this.badges, this.coin, this.cost, this.label]);
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

  /** Show a hero for sale (null: an empty slot). `afford`: dim when it can't be bought. `owned`: copies already held, marked. */
  show(key: string | null, afford: boolean, owned: number): void {
    this.key_ = key;
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
  private ai: AutoPlayer | null = null;
  private rival = { name: 'Rival', hp: 100, level: 2 };
  private round = 0;
  private timer = 0;
  private timerMax = 1;
  private ready = false;
  private rivalReady = false;
  private wonLast = false;
  private leaving = false;
  private host = false;
  private off: (() => void) | null = null;
  /** Online: the guest's last board (the host fights it if a new one is late), and the round's waits. */
  private guestBoard: Placed[] = [];
  private waitBoard: Phaser.Time.TimerEvent | null = null;
  private pendingResult: FightMsg | null = null;

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
  /** Online, the guest sees fights from the other end (its own heroes are the sim's top side). */
  private flipFight = false;
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
  private meText!: Phaser.GameObjects.BitmapText[];
  private rivalText!: Phaser.GameObjects.BitmapText[];
  private hearts: Phaser.GameObjects.Image[] = [];
  private traitList!: Phaser.GameObjects.Container;
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
  private lvlW = 0;
  private lvlText!: Phaser.GameObjects.BitmapText;
  private xpText!: Phaser.GameObjects.BitmapText;
  private xpBar!: Phaser.GameObjects.Graphics;
  private goldText!: Phaser.GameObjects.BitmapText;
  private xpBtn!: PixelButton;
  private rollBtn!: PixelButton;
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
  /** The mute button's corner, page px. */
  private corner = 0;
  private overlay: Phaser.GameObjects.Container | null = null;
  private lobby: Phaser.GameObjects.Container | null = null;
  private selected: { key: string; star: number; look: string } | null = null;
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
    kb?.on('keydown-F', () => this.buyXp());
    kb?.on('keydown-SPACE', () => this.toggleReady());
    kb?.on('keydown-ESC', () => this.leave());
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
    this.plates = this.add.graphics();
    this.meText = [pixelText(this, 0, 0, ''), pixelText(this, 0, 0, '', GOLD), pixelText(this, 0, 0, '', LAVENDER)];
    this.rivalText = [pixelText(this, 0, 0, ''), pixelText(this, 0, 0, '', GOLD), pixelText(this, 0, 0, '', LAVENDER)];
    this.hearts = [this.add.image(0, 0, 'ab_heart').setOrigin(0), this.add.image(0, 0, 'ab_heart').setOrigin(0)];
    this.traitList = this.add.container(0, 0);
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
    this.sellZone = this.add.container(0, 0).setVisible(false);
    this.sellText = pixelText(this, 0, 0, '', GOLD, 2);
    // The hero card pops up over everything else; a tap on it puts it away.
    this.infoBg = this.add.image(0, 0, panelTexture(this, 'ab_info', INFO_W, INFO_H, { ...PANEL, alpha: 1 })).setOrigin(0);
    this.info = this.add.container(0, 0);
    this.infoHit = this.add.zone(0, 0, INFO_W, INFO_H).setOrigin(0).setInteractive();
    this.infoHit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.selected = null;
      this.hovered = null;
      this.refreshInfo();
    });
    this.hud.add([this.plates, ...this.meText, ...this.rivalText, ...this.hearts, this.traitList, this.banner, this.roundText, this.phaseText, this.leaveBtn, this.lvlBox, this.goldBox, ...this.cards, this.sellZone, this.infoBg, this.info, this.infoHit]);
  }

  /** The level row (level, xp toward the next, buy xp) and the gold row (gold, reroll), `lw` and `gw` wide. */
  private buildRows(lw: number, gw: number): void {
    this.lvlW = lw;
    this.lvlBox.removeAll(true);
    this.goldBox.removeAll(true);
    const lvlBg = this.add.image(0, 0, panelTexture(this, `ab_lvl_${lw}`, lw, ROW_H, PANEL)).setOrigin(0);
    this.lvlText = pixelText(this, 4, 6, '', INK);
    this.xpBar = this.add.graphics();
    this.xpText = pixelText(this, 16, 3, '', LAVENDER);
    this.xpBtn = new PixelButton(this, `XP ${XP_COST}`, 36, 15, BUTTON_PLAIN, 'ab_xp', () => this.buyXp());
    this.xpBtn.setIcon('ab_coin').place(lw - 38, 2);
    this.lvlBox.add([lvlBg, this.lvlText, this.xpBar, this.xpText, this.xpBtn]);
    const goldBg = this.add.image(0, 0, panelTexture(this, `ab_gold_${gw}`, gw, ROW_H, PANEL)).setOrigin(0);
    const coin = this.add.image(5, 6, 'ab_coin').setOrigin(0);
    this.goldText = pixelText(this, 14, 6, '', GOLD);
    this.rollBtn = new PixelButton(this, `Roll ${REROLL_COST}`, 46, 15, BUTTON_GOLD, 'ab_roll', () => this.reroll());
    this.rollBtn.setIcon('ab_coin').place(gw - 48, 2);
    this.goldBox.add([goldBg, coin, this.goldText, this.rollBtn]);
  }

  /** The Fight (or Ready) button, `w` wide at (x, y). */
  private buildReady(w: number, x: number, y: number): void {
    this.readyBtn?.destroy();
    this.readyBtn = new PixelButton(this, 'Fight!', w, FIGHT_H, BUTTON_GOLD, `ab_ready_${w}`, () => this.toggleReady()).place(x, y);
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
    const corner = (this.corner = Math.ceil(soundCorner(width, height) / z));
    this.row2 = Math.max(TOP_H, corner);

    // Both layouts, sized in world px: the board with room over it for heads, and the bench.
    const bs = boardSize(COLS, ROWS);
    const tilesH = ROWS * CELL_H + RIM * 2 + FACE;
    const dock = { w: 2 * BENCH_SLOT + 6, h: (BENCH_SIZE / 2) * BENCH_SLOT + 6 };
    const wideW = dock.w + 4 + bs.w;
    const wideH = HEAD_ROOM + tilesH + UNDER_SHOW;
    const tallW = bs.w;
    const tallH = HEAD_ROOM + tilesH + 3 + BENCH_SLOT + 6;
    // The biggest whole number of screen px per world px that fits the room each leaves.
    const fit = (w: number, h: number, roomW: number, roomH: number) => Math.max(1, Math.floor(Math.min((roomW * z) / w, (roomH * z) / h)));
    const tallTop = this.row2 + TOP_H + CHIP_H * 2 + 4;
    const shopTall = ROW_H + GAP + CARD_H_ROW + PAD;
    const nWide = fit(wideW, wideH, vw - PAD * 4 - COL_W - TRAIT_MIN, vh - TOP_H - 1);
    const nTall = fit(tallW, tallH, vw - 2, vh - tallTop - shopTall);
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
      bx = dock.w + 4;
      benchX = 0;
      // The dock's foot lines up with the board's front edge, beside the player's half.
      benchY = HEAD_ROOM + tilesH - FACE - dock.h;
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
      // A one-row top bar; the shop's column on the left, next to the bench dock (bought heroes land close by);
      // the world in the middle; the round and the traits on the right, under the mute button.
      this.topH = TOP_H;
      const ww = Math.ceil(wideW * s);
      const left = PAD + COL_W + PAD;
      const right = vw - PAD - TRAIT_MIN - PAD;
      this.wx = Math.max(left, Math.round((left + right - ww) / 2));
      this.wy = Math.round(TOP_H + Math.max(0, (vh - TOP_H - wideH * s) / 2));
      const tx = this.wx + ww + PAD;
      const ty = Math.max(TOP_H, corner) + PAD;
      this.bannerAt = { x: tx, y: ty, w: vw - PAD - tx };
      this.traitRect.setTo(tx, ty + BANNER_H + GAP, vw - PAD - tx, vh - PAD - ty - BANNER_H - GAP);
      // The column: level, five cards, gold, Fight.
      let y = TOP_H + PAD;
      this.buildRows(COL_W, COL_W);
      this.lvlBox.setPosition(PAD, y);
      y += ROW_H + GAP;
      const cardsRoom = vh - PAD - FIGHT_H - GAP - ROW_H - GAP - y;
      const ch = Math.max(CARD_H_MIN, Math.min(CARD_H_MAX, Math.floor((cardsRoom - GAP * (SHOP_SIZE - 1)) / SHOP_SIZE)));
      this.shopRect.setTo(PAD, y, COL_W, ch * SHOP_SIZE + GAP * (SHOP_SIZE - 1));
      this.cards.forEach((c, i) => {
        c.resize(COL_W, ch);
        c.setPosition(PAD, y + (ch + GAP) * i);
      });
      y += this.shopRect.height + GAP;
      this.goldBox.setPosition(PAD, y);
      y += ROW_H + GAP;
      this.buildReady(COL_W, PAD, Math.min(y, vh - PAD - FIGHT_H));
      this.infoAt = { x: vw - PAD - INFO_W, y: ty };
    } else {
      // Leave (and the mute button) on the first row; the players and the round on the second; a row of trait chips;
      // the world; then the shop along the bottom, its cards as tall as the room left over allows.
      this.topH = this.row2 + TOP_H;
      this.bannerAt = { x: Math.round((vw - BANNER_W_TALL) / 2), y: this.row2, w: BANNER_W_TALL };
      this.traitRect.setTo(PAD, this.topH + 2, vw - PAD * 2, CHIP_H * 2 + 1);
      const spare = vh - tallTop - shopTall - Math.ceil(tallH * s);
      const ch = CARD_H_ROW + Math.max(0, Math.min(CARD_H_ROW_MAX - CARD_H_ROW, Math.floor(spare / 2)));
      const shopH = ROW_H + GAP + ch + PAD;
      const ww = Math.ceil(tallW * s);
      this.wx = Math.round((vw - ww) / 2);
      const room = vh - shopH - tallTop;
      this.wy = Math.round(tallTop + Math.max(0, (room - tallH * s) / 2));
      const fightW = 52;
      const rowW = Math.floor((vw - PAD * 2 - fightW - GAP * 2) / 2);
      let y = vh - shopH;
      this.buildRows(rowW, rowW);
      this.lvlBox.setPosition(PAD, y);
      this.goldBox.setPosition(PAD + rowW + GAP, y);
      this.buildReady(vw - PAD * 2 - rowW * 2 - GAP * 2, PAD + (rowW + GAP) * 2, y);
      y += ROW_H + GAP;
      const cw = Math.floor((vw - PAD * 2 - GAP * (SHOP_SIZE - 1)) / SHOP_SIZE);
      const x0 = Math.round((vw - (cw * SHOP_SIZE + GAP * (SHOP_SIZE - 1))) / 2);
      this.shopRect.setTo(x0, y, cw * SHOP_SIZE + GAP * (SHOP_SIZE - 1), ch);
      this.cards.forEach((c, i) => {
        c.resize(cw, ch);
        c.setPosition(x0 + (cw + GAP) * i, y);
      });
      this.infoAt = { x: Math.round((vw - INFO_W) / 2), y: this.topH + 2 };
    }
    this.world.setPosition(this.wx, this.wy);
    const r = this.shopRect;
    this.sellZone.removeAll(true);
    const sellBg = this.add.image(0, 0, panelTexture(this, `ab_sell_${r.width}x${r.height}`, r.width, r.height, panelStyle(0x8a4e22, 0xffe08a))).setOrigin(0);
    this.sellZone.add([sellBg, this.sellText]).setPosition(r.x, r.y);
    this.infoBg.setPosition(this.infoAt.x, this.infoAt.y);
    this.info.setPosition(this.infoAt.x, this.infoAt.y);
    this.infoHit.setPosition(this.infoAt.x, this.infoAt.y);
    this.leaveBtn.place(PAD, 1);
    this.syncPieces();
    this.refreshHud();
    if (this.lobby && this.phase === 'lobby') this.showLobby();
    if (this.overlay) {
      const c = this.boardCentre();
      this.overlay.setPosition(c.x, c.y);
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
    g.fillStyle(0x0b0818, 0.72).fillRect(0, 0, vw, this.topH);
    g.fillStyle(0x0b0818, 0.35).fillRect(0, this.topH, vw, 1);
    g.fillStyle(0xb8742c, 0.8).fillRect(0, this.topH - 1, vw, 1);
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
      const mid = settings.values.showFps ? FPS_HALF : 0;
      const lx = PAD + this.leaveBtn.boxW + 4;
      const rEnd = vw - this.corner - 2;
      const w = Math.max(60, Math.min(110, Math.floor(vw / 2 - mid - 4 - lx), Math.floor(rEnd - (vw / 2 + mid) - 4)));
      plate(0, me, this.meText, lx, 0, w, true);
      plate(1, this.rival, this.rivalText, rEnd - w, 0, w, false);
    } else {
      const w = Math.floor((vw - PAD * 2 - BANNER_W_TALL - 8) / 2);
      plate(0, me, this.meText, PAD, this.row2, w, true);
      plate(1, this.rival, this.rivalText, vw - PAD - w, this.row2, w, false);
    }
    this.drawBanner();
  }

  /** The round, what's on (planning with the seconds left, the fight, the result), and a bar running down while planning. */
  private drawBanner(): void {
    const at = this.bannerAt;
    const b = this.banner.clear();
    const inPlay = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    const label = this.phase === 'plan' ? `Plan ${Math.ceil(Math.max(0, this.timer))}` : this.phase === 'fight' ? 'Fight' : this.phase === 'result' ? 'Result' : '';
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
    this.lvlText.setText(`L${this.me.level}`);
    const need = XP_NEXT[this.me.level];
    const g = this.xpBar.clear();
    // The bar runs from after the level to the XP button.
    const xw = this.lvlW - 38 - 16 - 3;
    g.fillStyle(0x1a1430, 1).fillRect(16, 12, xw, 3);
    if (need) g.fillStyle(0x4aa6ff, 1).fillRect(16, 12, Math.round((xw * this.me.xp) / need), 3);
    else g.fillStyle(0xffc94a, 1).fillRect(16, 12, xw, 3);
    this.xpText.setText(need ? `${this.me.xp}/${need}` : 'MAX');
    this.goldText.setText(`${this.me.gold}`);
    const shopOpen = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    this.xpBtn.setEnabled(shopOpen && this.me.gold >= XP_COST && this.me.level < MAX_LEVEL).setAlpha(this.me.gold >= XP_COST && this.me.level < MAX_LEVEL ? 1 : 0.5);
    this.rollBtn.setEnabled(shopOpen && this.me.gold >= REROLL_COST).setAlpha(this.me.gold >= REROLL_COST ? 1 : 0.5);
    this.cards.forEach((c, i) => {
      const k = this.me.shop[i];
      const owned = k ? this.me.all().filter((p) => p.key === k && p.star === 1).length : 0;
      c.show(k, !!k && unitDef(k).cost <= this.me.gold, owned);
    });
    if (this.readyBtn) {
      this.readyBtn.setVisible(this.phase === 'plan');
      this.readyBtn.setText(this.mode === 'ai' ? 'Fight!' : this.ready ? (this.rivalReady ? 'Starting' : 'Waiting') : this.rivalReady ? 'Ready 1/2' : 'Ready');
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
    const traits = this.me.traits();
    const next = (t: { id: TraitId; count: number }) => {
      const def = TRAITS[t.id];
      return def.levels.find((n) => n > t.count) ?? def.levels[def.levels.length - 1];
    };
    if (!this.wide) {
      // Chips after the team count, wrapping to a second row.
      let x = head.width + 5;
      let y = 0;
      for (const t of traits) {
        if (x + CHIP_W > r.width) {
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
    const rows = Math.max(0, Math.floor((r.height - 12) / TRAIT_ROW));
    traits.slice(0, rows).forEach((t, i) => {
      const def = TRAITS[t.id];
      const y = 12 + i * TRAIT_ROW;
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
   * shop hero, else (in the first round's planning) how to play. A tap on it
   * puts it away.
   */
  private refreshInfo(): void {
    const box = this.info;
    box.removeAll(true);
    const pick = this.hovered ? { key: this.hovered, star: 1, look: lookFor(this.hovered) } : this.selected;
    const help = !pick && this.round === 1 && this.phase === 'plan';
    const on = !!this.me && (this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result') && !this.press?.dragging && (!!pick || help);
    this.infoBg.setVisible(on);
    if (this.infoHit.input) this.infoHit.input.enabled = on;
    // The traits it covers step out of the way while it's up.
    this.traitList.setVisible(!on);
    if (!on) return;
    if (!pick) {
      const lines = ['How to play', '', 'Tap the shop to buy heroes.', 'Drag them onto the board.', 'Three alike star up.', 'Shared traits add power.', 'Drop one on the shop to sell.'];
      let y = 6;
      for (const [i, l] of lines.entries()) {
        for (const w of i === 0 || !l ? [l] : wrap(this.probe, l, INFO_W - 12)) {
          box.add(pixelText(this, 6, y, w, i === 0 ? GOLD : LAVENDER));
          y += 9;
        }
      }
      return;
    }
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
    const buttons = labels.map(([label, fn], i) => {
      if (this.wide) {
        const top = Math.round(r.y + r.height / 2 - (18 * 3 + 6 * 2) / 2);
        return new PixelButton(this, label, r.width, 18, BUTTON_GOLD, `ab_l_${label}_${r.width}`, fn).place(r.x, top + i * 24);
      }
      const bw = Math.floor((this.vw - PAD * 2 - GAP * 2) / 3);
      return new PixelButton(this, label, bw, 18, BUTTON_GOLD, `ab_l_${label}_${bw}`, fn).place(PAD + i * (bw + GAP), r.y + r.height - 18);
    });
    const back = new PixelButton(this, 'Back', 34, 13, BUTTON_PLAIN, 'ab_back', () => this.leave()).place(PAD, 1);
    c.add([band, title, ...texts, ...buttons, back]);
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

  private newMatch(mode: Mode): void {
    this.mode = mode;
    this.closeLobby();
    this.clearOverlay();
    this.me = new AutoPlayer(this.myName());
    this.me.lookOf = lookFor;
    this.round = 0;
    this.wonLast = false;
    this.guestBoard = [];
    this.pendingResult = null;
    this.flipFight = mode === 'online' && !this.host;
    this.decided = false;
    this.fight?.destroy();
    this.fight = null;
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
  }

  private startPractice(): void {
    this.host = true;
    this.newMatch('ai');
    const name = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];
    this.ai = new AutoPlayer(name);
    this.rival = { name, hp: this.ai.hp, level: this.ai.level };
    this.startPlan(1, PLAN_SECONDS[0]);
  }

  /** Planning: gold in, a fresh shop, the clock runs. */
  private startPlan(round: number, seconds: number): void {
    this.round = round;
    this.phase = 'plan';
    this.ready = false;
    this.rivalReady = false;
    this.timer = this.timerMax = seconds;
    this.fight?.destroy();
    this.fight = null;
    this.fx.clear();
    this.clearOverlay();
    this.me.startRound(round, this.wonLast);
    if (this.ai) {
      this.ai.startRound(round, this.ai.streak > 0);
      aiPlan(this.ai, round);
      this.rival.level = this.ai.level;
    }
    this.selected = null;
    this.syncPieces();
    this.refreshHud();
    sound.cardFlip(1);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(0.1, delta / 1000);
    for (const [i, t] of this.torches.entries()) {
      const f = 0.55 + Math.sin(this.time.now / 90 + i * 2.1) * 0.08 + Math.sin(this.time.now / 37 + i) * 0.05;
      t.setAlpha(f).setScale(0.9 + f * 0.3, 0.7 + f * 0.25);
    }
    for (const c of this.cards) c.tick();
    this.fx.update(dt);
    if (this.phase === 'plan') {
      this.timer -= dt;
      this.drawBanner();
      if (this.timer <= 0 && (this.mode === 'ai' || this.host)) this.endPlan();
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

  /** Planning is over: the board locks and the fight is worked out. */
  private endPlan(): void {
    if (this.phase !== 'plan') return;
    this.cancelDrag();
    this.me.autoFill();
    if (this.mode === 'ai') {
      const seed = (Math.random() * 2 ** 31) | 0;
      this.startFight([this.me.placed(), this.ai!.placed()], seed, 0);
      return;
    }
    // Online, the host asks for the guest's board, and fights its last one if it's late.
    if (!this.host) return;
    this.phase = 'fight';
    session.send({ t: 'al', round: this.round });
    this.refreshHud();
    this.waitBoard?.remove();
    this.waitBoard = this.time.delayedCall(BOARD_WAIT_MS, () => this.hostFight());
  }

  /** The host has both boards: the fight's outcome, worked out at once, goes to both. */
  private hostFight(): void {
    this.waitBoard?.remove();
    this.waitBoard = null;
    if (this.fight || !this.host) return;
    const a = this.me.placed();
    const b = this.guestBoard;
    const seed = (Math.random() * 2 ** 31) | 0;
    const judge = new Battle([a, b], seed);
    judge.runToEnd();
    const dmg: [number, number] = [0, 0];
    const stars = judge.survivors().map((u) => u.star);
    if (judge.winner === 0) dmg[1] = lossDamage(this.round, stars);
    else if (judge.winner === 1) dmg[0] = lossDamage(this.round, stars);
    else dmg[0] = dmg[1] = lossDamage(this.round, []);
    const msg: FightMsg = {
      round: this.round,
      seed,
      a,
      b,
      win: judge.winner,
      dmg,
      hp: [Math.max(0, this.me.hp - dmg[0]), Math.max(0, this.rival.hp - dmg[1])],
      lv: [this.me.level, this.rival.level],
    };
    session.send({ t: 'af', ...msg });
    this.pendingResult = msg;
    this.startFight([a, b], seed, 0);
  }

  private startFight(boards: [Placed[], Placed[]], seed: number, mySide: 0 | 1): void {
    this.cancelDrag();
    this.phase = 'fight';
    this.selected = null;
    this.fightDone = 0;
    this.fight?.destroy();
    this.fight = new FightView(this, new Battle(boards, seed), { ...this.frame, flip: this.flipFight }, this.layer, this.fx, mySide);
    // The board's pieces step aside for the fight's own heroes; the bench stays.
    this.syncPieces();
    this.refreshHud();
    sound.drumBeat(0, true);
  }

  /** The fight is over: who lost what, then the next round (or the end). */
  private finishFight(): void {
    if (this.phase !== 'fight' || !this.fight) return;
    const b = this.fight.battle;
    this.phase = 'result';
    let myDmg = 0;
    let rivalDmg = 0;
    let won: boolean | null;
    if (this.mode === 'ai') {
      const stars = b.survivors().map((u) => u.star);
      won = b.winner === 0 ? true : b.winner === 1 ? false : null;
      if (won === true) rivalDmg = lossDamage(this.round, stars);
      else if (won === false) myDmg = lossDamage(this.round, stars);
      else myDmg = rivalDmg = lossDamage(this.round, []);
      this.ai!.settle(won === null ? null : !won, rivalDmg);
      this.rival.hp = this.ai!.hp;
      this.me.settle(won, myDmg);
    } else {
      // Online, the host's reckoning stands for both.
      const r = this.pendingResult;
      const mine = this.host ? 0 : 1;
      if (!r) return;
      won = r.win === -1 ? null : r.win === mine;
      myDmg = r.dmg[mine];
      rivalDmg = r.dmg[1 - mine];
      this.me.settle(won, myDmg);
      this.me.hp = Math.max(0, r.hp[mine]);
      this.rival.hp = Math.max(0, r.hp[1 - mine]);
      this.rival.level = r.lv[1 - mine];
      this.pendingResult = null;
    }
    this.wonLast = won === true;
    this.showResult(won, myDmg, rivalDmg);
    this.refreshHud();
    const over = !this.me.alive || this.rival.hp <= 0;
    this.decided = over;
    this.time.delayedCall(RESULT_SECONDS * 1000, () => {
      if (this.phase !== 'result') return;
      if (over) return this.gameOver(this.me.alive && this.rival.hp <= 0 ? true : !this.me.alive && this.rival.hp > 0 ? false : null);
      if (this.mode === 'ai') this.startPlan(this.round + 1, PLAN_SECONDS[1]);
      else if (this.host) {
        session.send({ t: 'ap', round: this.round + 1, sec: PLAN_SECONDS[1] });
        this.startPlan(this.round + 1, PLAN_SECONDS[1]);
      }
    });
  }

  private showResult(won: boolean | null, myDmg: number, rivalDmg: number): void {
    this.clearOverlay();
    const at = this.boardCentre();
    const c = (this.overlay = this.add.container(at.x, at.y));
    const key = won === true ? 'ab_victory' : won === false ? 'ab_defeat' : 'ab_draw';
    const img = this.add.image(0, -20, key).setScale(2);
    if (won === false) img.setTint(0xff9a9a);
    const line = won === true ? `${this.rival.name} loses ${rivalDmg}` : won === false ? `You lose ${myDmg}` : `Both lose ${myDmg}`;
    const t = pixelText(this, 0, 0, line, won === false ? RED : won === true ? GREEN : LAVENDER);
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

  /** The match is over: a banner, the prize, and the way out. */
  private gameOver(won: boolean | null): void {
    this.phase = 'over';
    this.off?.();
    this.off = null;
    if (this.mode === 'online') session.close();
    this.clearOverlay();
    const gems = won ? WIN_GEMS[this.mode] : 0;
    if (gems) collection.addGems(gems);
    const at = this.boardCentre();
    const c = (this.overlay = this.add.container(at.x, at.y));
    const bg = this.add.image(0, 0, panelTexture(this, 'ab_over', 200, 96, PANEL)).setOrigin(0.5);
    const img = this.add.image(0, -26, won ? 'ab_victory' : won === false ? 'ab_defeat' : 'ab_draw').setScale(1.5);
    const line = won ? `You beat ${this.rival.name} in ${this.round} rounds` : won === false ? `${this.rival.name} wins in ${this.round} rounds` : 'Nobody is left standing';
    const t = pixelText(this, 0, -4, line, LAVENDER);
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
    this.fight?.destroy();
    this.fight = null;
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.fx.clear();
    this.clearOverlay();
    this.phase = 'lobby';
    this.me = undefined as unknown as AutoPlayer;
    this.showLobby();
  }

  // ------------------------------------------------------------ shop

  private buy(i: number): void {
    if (!this.me || !(this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result')) return;
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
    if (!this.me || this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait') return;
    if (this.me.reroll()) {
      play(() => {
        sound.cardFlip(0);
      });
      this.refreshHud();
    }
  }

  private buyXp(): void {
    if (!this.me || this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait') return;
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
    if (this.phase !== 'plan') return;
    if (this.mode === 'ai') return this.endPlan();
    this.ready = !this.ready;
    session.send({ t: 'ar', round: this.round, on: this.ready });
    if (this.host && this.ready && this.rivalReady) this.endPlan();
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
        this.hookPiece(p, v);
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

  private hookPiece(p: Piece, v: UnitView): void {
    v.sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
    v.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.phase === 'lobby' || this.phase === 'over' || this.phase === 'wait') return;
      this.press = { piece: p, view: v, x: ptr.x / this.z, y: ptr.y / this.z, dragging: false };
    });
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
    this.waiting('Opening a room...', null);
    session
      .open({ t: 'create', mode: 'duel', arena: AUTO_ARENA }, this.onlineMe())
      .then((room) => {
        this.host = true;
        this.listen();
        this.waiting('Send this code to a friend', room.code);
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
      this.waiting('Joining...', null);
      session
        .open({ t: 'join', code }, this.onlineMe())
        .then((room) => {
          if (room.arena !== AUTO_ARENA) {
            session.close();
            return this.backToLobby("That code isn't an Auto Battle room.");
          }
          this.host = false;
          this.listen();
          this.waiting('Waiting for the host...', room.code);
        })
        .catch((e: Error) => this.backToLobby(e.message));
    };
    root.querySelector('[data-join]')!.addEventListener('click', go);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    input.focus();
  }

  /** The waiting screen: a line, the room's code big, and Cancel. */
  private waiting(line: string, code: string | null): void {
    this.phase = 'wait';
    this.closeLobby();
    const c = (this.lobby = this.add.container(0, 0));
    const cx = Math.round(this.vw / 2);
    const bg = this.add.image(cx, Math.round(this.vh / 2), panelTexture(this, 'ab_wait', 220, 100, PANEL)).setOrigin(0.5);
    const t = pixelText(this, 0, Math.round(this.vh / 2) - 38, line, LAVENDER);
    t.setX(cx - Math.round(t.width / 2));
    c.add([bg, t]);
    if (code) {
      const k = `ab_code_${code}`;
      if (!this.textures.exists(k)) this.textures.addCanvas(k, titleBitmap(code).toCanvas());
      c.add(this.add.image(cx, Math.round(this.vh / 2) - 6, k).setScale(2));
    } else {
      c.add(pixelText(this, cx - 6, Math.round(this.vh / 2) - 10, '...', GOLD, 2));
    }
    c.add(new PixelButton(this, 'Cancel', 80, 16, BUTTON_PLAIN, 'ab_cancel', () => this.backToLobby()).place(cx - 40, Math.round(this.vh / 2) + 24));
    this.hud.setVisible(false);
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

  private onMsg(m: Msg): void {
    switch (m.t) {
      case 'peer+': {
        const p = m.p as { name: string };
        this.rival.name = p.name || 'Rival';
        if (this.host && this.phase === 'wait') {
          this.newMatch('online');
          this.rival = { name: p.name || 'Rival', hp: 100, level: 2 };
          session.send({ t: 'ag' });
          session.send({ t: 'ap', round: 1, sec: PLAN_SECONDS[0] });
          this.startPlan(1, PLAN_SECONDS[0]);
        }
        break;
      }
      case 'peer-':
      case 'closed':
        if (this.decided) break;
        if (this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result') {
          // The rival left: the match goes to whoever stayed (or ends, if it was us who lost the line).
          const lost = m.t === 'closed';
          this.cancelDrag();
          this.fight?.destroy();
          this.fight = null;
          if (lost) {
            this.toLobby();
            this.notice('The connection was lost.');
          } else {
            this.rival.hp = 0;
            this.gameOver(true);
          }
        } else if (this.phase === 'wait' && m.t === 'closed') this.backToLobby('The connection was lost.');
        break;
      case 'ag':
        if (!this.host) {
          this.newMatch('online');
          const peer = [...session.peers.values()][0];
          this.rival = { name: peer?.name || 'Rival', hp: 100, level: 2 };
        }
        break;
      case 'ap':
        if (!this.host && this.me) {
          // A fight still playing here ends now, its result applied, so the rounds keep in step.
          if (this.phase === 'fight' && this.fight) this.finishFight();
          this.startPlan(Number(m.round) || this.round + 1, Number(m.sec) || PLAN_SECONDS[1]);
        }
        break;
      case 'al':
        if (!this.host && this.me && this.phase === 'plan') {
          this.cancelDrag();
          this.me.autoFill();
          this.phase = 'fight';
          this.syncPieces();
          this.refreshHud();
          session.send({ t: 'ab', round: this.round, b: this.me.placed(), lv: this.me.level });
        }
        break;
      case 'ab':
        if (this.host && this.me) {
          this.guestBoard = cleanBoard(m.b);
          this.rival.level = Math.max(1, Math.min(MAX_LEVEL, Number(m.lv) || this.rival.level));
          if (Number(m.round) === this.round && this.phase === 'fight' && !this.fight) this.hostFight();
        }
        break;
      case 'ar':
        if (Number(m.round) === this.round) {
          this.rivalReady = !!m.on;
          if (this.host && this.ready && this.rivalReady) this.endPlan();
          this.refreshHud();
        }
        break;
      case 'af':
        if (!this.host && this.me) {
          const r: FightMsg = {
            round: Number(m.round),
            seed: Number(m.seed) | 0,
            a: cleanBoard(m.a),
            b: cleanBoard(m.b),
            win: Number(m.win),
            dmg: (m.dmg as [number, number]) ?? [0, 0],
            hp: (m.hp as [number, number]) ?? [this.rival.hp, this.me.hp],
            lv: (m.lv as [number, number]) ?? [this.rival.level, this.me.level],
          };
          this.pendingResult = r;
          this.startFight([r.a, r.b], r.seed, 1);
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
