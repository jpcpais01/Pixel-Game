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

// Auto Battle: a 1v1 of teams, like an auto chess. Each round the player buys
// heroes from a shop of five, sets up to six of them out on their half of a
// floating stone dais, and the fight plays itself. Three of a kind star up
// into one stronger hero. A lost round costs health; the last player standing
// wins. Played against a practice rival here, or a friend online by room code
// (see game/auto/online.ts). The rules are in game/auto/match.ts, the fight
// in game/auto/sim.ts, the heroes' kits in game/auto/units.ts.

/** The smallest view (art px) the page fits in; the zoom steps down until it does. */
const MIN_W = 470;
const MIN_H = 250;
/** Room over the board's top row for the heroes standing there. */
const HEAD_ROOM = 18;
const SHOP_H = 60;
const CARD_W = 84;
const GAP = 3;
const SIDE_W = 142;
const PLATE_H = 22;
/** The level and gold boxes either side of the bench. */
const BOX_W = 128;
const BOX_H = BENCH_SLOT + 6;
const TRAIT_ROW = 11;
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

/** One of the shop's five cards. */
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

  constructor(scene: Phaser.Scene, onTap: () => void, onHover: (on: boolean) => void) {
    super(scene, 0, 0);
    this.bg = scene.add.image(0, 0, panelTexture(scene, 'ab_card_empty', CARD_W, SHOP_H, PANEL_INSET)).setOrigin(0);
    this.win = scene.add.graphics();
    this.sprite = scene.add.sprite(CARD_W / 2, 37, '__DEFAULT');
    this.glow = scene.add.sprite(CARD_W / 2, 37, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
    this.label = pixelText(scene, 3, 40, '');
    this.coin = scene.add.image(CARD_W - 16, 51, 'ab_coin').setOrigin(0);
    this.cost = pixelText(scene, CARD_W - 9, 50, '', GOLD);
    this.badges = [0, 1].map((i) => scene.add.image(4 + i * 11, 50, 'ab_trait_arcane').setOrigin(0));
    this.pair = scene.add.graphics();
    this.add([this.bg, this.win, this.sprite, this.glow, this.label, this.coin, this.cost, ...this.badges, this.pair]);
    this.bg.setInteractive({ useHandCursor: true });
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

  /** Show a hero for sale (null: an empty slot). `afford`: dim when it can't be bought. `owned`: copies already held, marked. */
  show(key: string | null, afford: boolean, owned: number): void {
    this.key_ = key;
    const on = !!key;
    for (const o of [this.win, this.sprite, this.glow, this.label, this.coin, this.cost, ...this.badges, this.pair]) o.setVisible(on);
    if (!key) {
      this.bg.setTexture(panelTexture(this.scene, 'ab_card_empty', CARD_W, SHOP_H, PANEL_INSET));
      return;
    }
    const d = unitDef(key);
    const st = styleOf(key, lookFor(key));
    const col = COST_COLORS[d.cost];
    this.bg.setTexture(panelTexture(this.scene, `ab_card_${d.cost}`, CARD_W, SHOP_H, panelStyle(shade(col, 0.55), col)));
    // The window: the hero's colour, darkening down, with a floor and a light behind.
    const g = this.win.clear();
    const acc = st.ch.accent;
    for (let y = 0; y < 34; y++) g.fillStyle(shade(acc, 0.12 + (y / 34) * 0.22), 1).fillRect(3, 3 + y, CARD_W - 6, 1);
    g.fillStyle(shade(acc, 0.5), 0.35).fillEllipse(CARD_W / 2, 35, 30, 7);
    g.fillStyle(0x0b0818, 0.5).fillRect(3, 37, CARD_W - 6, 1);
    const pv = st.ch.preview;
    const oy = pv.originY ?? 31 / 32;
    this.sprite.setTexture(pv.texture).setOrigin(0.5, oy).setPosition(CARD_W / 2, 36);
    cropToWindow(this.sprite, pv, CARD_W - 6, 33, 1, 1);
    if (this.sprite.anims.currentAnim?.key !== pv.idle) this.sprite.play(pv.idle);
    this.glow.setVisible(!!pv.glow);
    if (pv.glow) {
      this.glow.setTexture(pv.glow).setOrigin(0.5, oy).setPosition(CARD_W / 2, 36);
      cropToWindow(this.glow, pv, CARD_W - 6, 33, 1, 1);
    }
    this.label.setText(fitLine(this.label, st.ch.type.name, CARD_W - 6)).setTint(afford ? INK : SOFT);
    this.cost.setText(`${d.cost}`);
    this.badges[0].setTexture(`ab_trait_${d.origin}`);
    this.badges[1].setTexture(`ab_trait_${d.role}`);
    this.sprite.setTint(afford ? 0xffffff : 0x6a6488);
    this.glow.setAlpha(afford ? 1 : 0.3);
    // Copies held: a pip for each, so a pair to finish shows at a glance.
    const pg = this.pair.clear();
    for (let i = 0; i < Math.min(2, owned); i++) {
      pg.fillStyle(0x0b0818, 1).fillRect(CARD_W - 8 - i * 5, 4, 5, 5);
      pg.fillStyle(0xffe08a, 1).fillRect(CARD_W - 7 - i * 5, 5, 3, 3);
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

  // The world.
  private sky!: Phaser.GameObjects.Image;
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
  private readyBtn!: PixelButton;
  private leaveBtn!: PixelButton;
  private cards: Card[] = [];
  private lvlBox!: Phaser.GameObjects.Container;
  private goldBox!: Phaser.GameObjects.Container;
  private lvlText!: Phaser.GameObjects.BitmapText;
  private xpText!: Phaser.GameObjects.BitmapText;
  private xpBar!: Phaser.GameObjects.Graphics;
  private goldText!: Phaser.GameObjects.BitmapText;
  private xpBtn!: PixelButton;
  private rollBtn!: PixelButton;
  private sellZone!: Phaser.GameObjects.Container;
  private sellText!: Phaser.GameObjects.BitmapText;
  private probe!: Phaser.GameObjects.BitmapText;
  private shopX = 0;
  private shopY = 0;
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
    this.boardImg = this.add.image(0, 0, autoBoard(this, COLS, ROWS)).setOrigin(0);
    this.benchImg = this.add.image(0, 0, autoBench(this, BENCH_SIZE)).setOrigin(0);
    this.marks = this.add.graphics();
    this.fxUnder = this.add.container(0, 0);
    this.layer = this.add.container(0, 0);
    this.fxOver = this.add.container(0, 0);
    this.fx = new FxLayer(this, this.fxUnder, this.fxOver);
    for (let i = 0; i < 4; i++) this.torches.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040));
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
    this.infoBg = this.add.image(0, 0, panelTexture(this, 'ab_info', SIDE_W, INFO_H, PANEL)).setOrigin(0);
    this.info = this.add.container(0, 0);
    this.readyBtn = new PixelButton(this, 'Fight!', SIDE_W, 16, BUTTON_GOLD, 'ab_ready', () => this.toggleReady());
    this.leaveBtn = new PixelButton(this, 'Leave', 38, 13, BUTTON_PLAIN, 'ab_leave', () => this.leave());

    // The shop row: level and xp, five cards, gold and a reroll.
    // Beside the bench: the level (with xp to buy) on the left, gold (and a reroll) on the right.
    this.lvlBox = this.add.container(0, 0);
    const lvlBg = this.add.image(0, 0, panelTexture(this, 'ab_lvl', BOX_W, BOX_H, PANEL)).setOrigin(0);
    this.lvlText = pixelText(this, 5, 6, '', INK, 2);
    this.xpBar = this.add.graphics();
    this.xpText = pixelText(this, 34, 5, '', LAVENDER);
    this.xpBtn = new PixelButton(this, `XP ${XP_COST}`, 44, 17, BUTTON_PLAIN, 'ab_xp', () => this.buyXp());
    this.xpBtn.setIcon('ab_coin').place(BOX_W - 48, 5);
    this.lvlBox.add([lvlBg, this.lvlText, this.xpBar, this.xpText, this.xpBtn]);
    this.goldBox = this.add.container(0, 0);
    const goldBg = this.add.image(0, 0, panelTexture(this, 'ab_gold', BOX_W, BOX_H, PANEL)).setOrigin(0);
    const coin = this.add.image(6, 8, 'ab_coin').setOrigin(0).setScale(2);
    this.goldText = pixelText(this, 22, 6, '', GOLD, 2);
    this.rollBtn = new PixelButton(this, `Roll ${REROLL_COST}`, 56, 17, BUTTON_GOLD, 'ab_roll', () => this.reroll());
    this.rollBtn.setIcon('ab_coin').place(BOX_W - 60, 5);
    this.goldBox.add([goldBg, coin, this.goldText, this.rollBtn]);
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
    this.hud.add([this.plates, ...this.meText, ...this.rivalText, ...this.hearts, this.traitList, this.banner, this.roundText, this.phaseText, this.infoBg, this.info, this.readyBtn, this.leaveBtn, this.lvlBox, this.goldBox, ...this.cards, this.sellZone]);
  }

  private layout(): void {
    const { width, height } = this.scale;
    let z = menuZoom(width, height);
    while (z > 1 && (width / z < MIN_W || height / z < MIN_H)) z--;
    this.z = z;
    this.cameras.main.setZoom(z);
    const vw = (this.vw = Math.floor(width / z));
    const vh = (this.vh = Math.floor(height / z));
    this.sky.setTexture(autoBackdrop(this, vw + 1, vh + 1));

    // The board, bench and shop stacked in the middle, the stack centred up and down.
    const bs = boardSize(COLS, ROWS);
    const tilesH = ROWS * CELL_H + RIM * 2 + FACE;
    const benchH = BENCH_SLOT + 6;
    const stack = HEAD_ROOM + tilesH + 3 + benchH + 4 + SHOP_H;
    const top = Math.max(0, Math.round((vh - stack) / 2));
    const bx = Math.round((vw - bs.w) / 2);
    const by = top + HEAD_ROOM;
    this.boardImg.setPosition(bx, by);
    this.frame = { ...this.frame, x: bx + RIM, y: by + RIM };
    const benchW = BENCH_SIZE * BENCH_SLOT + 6;
    this.benchX = Math.round((vw - benchW) / 2);
    this.benchY = by + tilesH + 3;
    this.benchImg.setPosition(this.benchX, this.benchY);
    // Braziers' glow at the dais's four corners.
    const corners = [
      [bx + 4, by + 4],
      [bx + bs.w - 5, by + 4],
      [bx + 4, by + tilesH - FACE - 5],
      [bx + bs.w - 5, by + tilesH - FACE - 5],
    ];
    this.torches.forEach((t, i) => t.setPosition(corners[i][0], corners[i][1]));

    const rowW = CARD_W * SHOP_SIZE + GAP * (SHOP_SIZE - 1);
    this.shopX = Math.round((vw - rowW) / 2);
    this.shopY = this.benchY + benchH + 4;
    this.cards.forEach((c, i) => c.setPosition(this.shopX + (CARD_W + GAP) * i, this.shopY));
    const boxGap = Math.min(10, Math.max(3, Math.floor((vw - benchW) / 2 - BOX_W - 4)));
    this.lvlBox.setPosition(this.benchX - boxGap - BOX_W, this.benchY);
    this.goldBox.setPosition(this.benchX + benchW + boxGap, this.benchY);
    this.sellZone.removeAll(true);
    const sellBg = this.add.image(0, 0, panelTexture(this, `ab_sell_${rowW}`, rowW, SHOP_H, panelStyle(0x8a4e22, 0xffe08a))).setOrigin(0);
    this.sellZone.add([sellBg, this.sellText]).setPosition(this.shopX, this.shopY);

    // Side columns.
    const sideGap = Math.max(4, Math.floor((vw - bs.w) / 2 - SIDE_W) / 2);
    const lx = Math.max(4, Math.round(sideGap));
    const rx = vw - SIDE_W - lx;
    this.leaveBtn.place(lx, 4);
    this.placePlates(lx, 20);
    this.traitList.setPosition(lx, 20 + PLATE_H * 2 + 8);
    this.placeBanner(rx, 4);
    this.infoBg.setPosition(rx, 30);
    this.info.setPosition(rx, 30);
    this.readyBtn.place(rx, 30 + INFO_H + 4);
    this.syncPieces();
    this.refreshHud();
    if (this.lobby) this.showLobby();
    if (this.overlay) this.overlay.setPosition(Math.round(vw / 2), Math.round(vh / 2));
  }

  private placePlates(x: number, y: number): void {
    this.plates.setData('at', { x, y });
    this.drawPlates();
  }

  /** The two players' plates: a heart and health, name, level. */
  private drawPlates(): void {
    const at = this.plates.getData('at') as { x: number; y: number } | undefined;
    if (!at || !this.me) return;
    const g = this.plates.clear();
    const rows = [
      { p: { name: this.me.name, hp: this.me.hp, level: this.me.level }, t: this.meText, mine: true },
      { p: this.rival, t: this.rivalText, mine: false },
    ];
    rows.forEach(({ p, t, mine }, i) => {
      const y = at.y + i * (PLATE_H + 3);
      g.fillStyle(0x0b0818, 0.85).fillRect(at.x, y, SIDE_W, PLATE_H);
      g.fillStyle(mine ? 0x3a5a9a : 0x8a3a4a, 1).fillRect(at.x, y, 2, PLATE_H);
      // A health bar along the bottom.
      g.fillStyle(0x1a1430, 1).fillRect(at.x + 4, y + PLATE_H - 5, SIDE_W - 8, 3);
      g.fillStyle(mine ? 0x5ad07a : 0xff5a5a, 1).fillRect(at.x + 4, y + PLATE_H - 5, Math.round(((SIDE_W - 8) * Math.max(0, p.hp)) / 100), 3);
      this.hearts[i].setPosition(at.x + 5, y + 4);
      t[0].setText(fitLine(t[0], p.name, SIDE_W - 60)).setPosition(at.x + 15, y + 4);
      t[1].setText(`${Math.max(0, Math.ceil(p.hp))}`).setPosition(at.x + SIDE_W - 5 - t[1].width, y + 4);
      t[2].setText(`L${p.level}`).setPosition(at.x + SIDE_W - 5 - t[1].width - 6 - t[2].width, y + 4);
    });
  }

  private placeBanner(x: number, y: number): void {
    this.banner.setData('at', { x, y });
    this.drawBanner();
  }

  /** Round, phase and the time left. */
  private drawBanner(): void {
    const at = this.banner.getData('at') as { x: number; y: number } | undefined;
    if (!at) return;
    const g = this.banner.clear();
    g.fillStyle(0x0b0818, 0.85).fillRect(at.x, at.y, SIDE_W, 22);
    g.fillStyle(0xb8742c, 1).fillRect(at.x, at.y, SIDE_W, 1);
    const inPlay = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    this.roundText.setText(inPlay ? `ROUND ${this.round}` : '').setPosition(at.x + 5, at.y + 4);
    const label = this.phase === 'plan' ? `Plan ${Math.ceil(Math.max(0, this.timer))}` : this.phase === 'fight' ? 'Fight' : this.phase === 'result' ? 'Result' : '';
    this.phaseText.setText(label.toUpperCase()).setPosition(at.x + SIDE_W - 5 - this.phaseText.width, at.y + 4);
    if (this.phase === 'plan') {
      const k = Math.max(0, Math.min(1, this.timer / this.timerMax));
      g.fillStyle(0x1a1430, 1).fillRect(at.x + 4, at.y + 16, SIDE_W - 8, 3);
      g.fillStyle(k < 0.25 ? 0xff6a4a : 0xf4cf6a, 1).fillRect(at.x + 4, at.y + 16, Math.round((SIDE_W - 8) * k), 3);
    }
  }

  private refreshHud(): void {
    if (!this.me) {
      this.hud.setVisible(false);
      return;
    }
    const playing = this.phase === 'plan' || this.phase === 'fight' || this.phase === 'result';
    this.hud.setVisible(playing || this.phase === 'over');
    this.drawPlates();
    this.drawBanner();
    // Level and gold.
    this.lvlText.setText(`L${this.me.level}`);
    const need = XP_NEXT[this.me.level];
    const g = this.xpBar.clear();
    const xw = BOX_W - 48 - 38;
    g.fillStyle(0x1a1430, 1).fillRect(34, 15, xw, 3);
    if (need) g.fillStyle(0x4aa6ff, 1).fillRect(34, 15, Math.round((xw * this.me.xp) / need), 3);
    else g.fillStyle(0xffc94a, 1).fillRect(34, 15, xw, 3);
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
    this.readyBtn.setVisible(this.phase === 'plan');
    this.readyBtn.setText(this.mode === 'ai' ? 'Fight!' : this.ready ? (this.rivalReady ? 'Starting' : 'Waiting') : this.rivalReady ? 'Ready (they are)' : 'Ready');
    this.drawTraits();
    this.refreshInfo();
  }

  /** The traits on the board: active ones first, lit, with how many of the next level. */
  private drawTraits(): void {
    const list = this.traitList;
    list.removeAll(true);
    if (!this.me) return;
    const head = pixelText(this, 0, 0, `Team ${this.me.board.size}/${this.me.cap}`, this.me.board.size < this.me.cap ? GOLD : LAVENDER);
    list.add(head);
    // As many as fit above the shop.
    const rows = Math.max(0, Math.floor((this.benchY - 3 - list.y - 12) / TRAIT_ROW));
    const traits = this.me.traits();
    traits.slice(0, rows).forEach((t, i) => {
      const def = TRAITS[t.id];
      const y = 12 + i * TRAIT_ROW;
      const on = t.level > 0;
      const g = this.add.graphics();
      g.fillStyle(0x0b0818, on ? 0.8 : 0.55).fillRect(0, y - 1, SIDE_W, TRAIT_ROW - 1);
      if (on) g.fillStyle(def.color, 1).fillRect(0, y - 1, 1, TRAIT_ROW - 1);
      const icon = this.add.image(2, y, `ab_trait_${t.id}${on ? '' : '_off'}`).setOrigin(0);
      const name = pixelText(this, 14, y + 1, def.name, on ? INK : SOFT);
      const next = def.levels.find((n) => n > t.count) ?? def.levels[def.levels.length - 1];
      const count = pixelText(this, 0, y + 1, `${t.count}/${next}`, on ? def.color : SOFT);
      count.setX(SIDE_W - 3 - count.width);
      list.add([g, icon, name, count]);
    });
  }

  /** The card on the right: whatever is picked, else the hovered shop hero, else how to play. */
  private refreshInfo(): void {
    const box = this.info;
    box.removeAll(true);
    if (!this.me || this.phase === 'lobby' || this.phase === 'wait') {
      this.infoBg.setVisible(false);
      return;
    }
    this.infoBg.setVisible(true);
    const pick = this.hovered ? { key: this.hovered, star: 1, look: lookFor(this.hovered) } : this.selected;
    if (!pick) {
      const lines = ['How to play', '', 'Tap the shop to buy heroes.', 'Drag them onto the board.', 'Three alike star up.', 'Shared traits add power.', 'Drop one on the shop to sell.'];
      let y = 6;
      for (const [i, l] of lines.entries()) {
        for (const w of i === 0 || !l ? [l] : wrap(this.probe, l, SIDE_W - 12)) {
          box.add(pixelText(this, 6, y, w, i === 0 ? GOLD : LAVENDER));
          y += 9;
        }
      }
      return;
    }
    const d = unitDef(pick.key);
    const st = styleOf(pick.key, pick.look);
    const n = pieceNumbers(pick.key, pick.star);
    const name = pixelText(this, 6, 5, fitLine(this.probe, st.ch.type.name, SIDE_W - 40), INK);
    box.add(name);
    for (let i = 0; i < pick.star; i++) box.add(this.add.image(8 + name.width + i * 6, 6, pick.star === 3 ? 'ab_star3' : pick.star === 2 ? 'ab_star2' : 'ab_star').setOrigin(0));
    box.add(this.add.image(SIDE_W - 20, 6, 'ab_coin').setOrigin(0));
    box.add(pixelText(this, SIDE_W - 12, 5, `${d.cost}`, COST_COLORS[d.cost]));
    const g = this.add.graphics();
    g.fillStyle(st.ch.accent, 1).fillRect(6, 15, SIDE_W - 12, 1);
    box.add(g);
    [d.origin, d.role].forEach((t, i) => {
      box.add(this.add.image(6 + i * 64, 19, `ab_trait_${t}`).setOrigin(0));
      box.add(pixelText(this, 18 + i * 64, 20, TRAITS[t as TraitId].name, TRAITS[t as TraitId].color));
    });
    const stats = [`HP ${n.hp}`, `DPS ${n.dps}`, `DEF ${n.defense}`];
    stats.forEach((s, i) => box.add(pixelText(this, 6 + i * 46, 31, s, LAVENDER)));
    let y = 42;
    const block = (title: string, text: string, tint: number, lines: number) => {
      box.add(pixelText(this, 6, y, fitLine(this.probe, title, SIDE_W - 12), tint));
      y += 9;
      for (const l of wrap(this.probe, text, SIDE_W - 12).slice(0, lines)) {
        box.add(pixelText(this, 6, y, l, SOFT));
        y += 8;
      }
      y += 2;
    };
    block(`${d.skill.name} every ${d.skill.cd}s`, spellText(d.skill, n.dps), INK, 2);
    block(`${st.ult} ${n.mana} mana`, spellText(d.ult, n.dps), st.pal.hot, 3);
  }

  // ------------------------------------------------------------ the lobby

  private showLobby(): void {
    this.lobby?.destroy();
    const c = (this.lobby = this.add.container(0, 0));
    const cx = Math.round(this.vw / 2);
    const title = this.add.image(cx, 6, 'ab_title').setScale(2).setOrigin(0.5, 0);
    // A few heroes standing in a line on the dais, waiting for a match.
    const bw = 116;
    const pick = (i: number) => ['warrior.knight', 'wizard.pyro', 'beast.dragon', 'rogue.dancer', 'paladin.holy', 'archer.ranger', 'samurai.bladewind'][i];
    const heroes = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const key = pick(i);
      const v = new UnitView(this, key, lookFor(key), 1, true, 'down');
      const p = cellPt(this.frame, i, 5);
      v.setPosition(p.x, p.y);
      v.hideBars();
      return v;
    });
    const by = Math.round(6 + title.displayHeight + 4);
    const say = pixelText(this, 0, by, 'Buy heroes, set out six, watch them fight', LAVENDER);
    say.setX(Math.round(cx - say.width / 2));
    const btnY = this.shopY + 8;
    const mk = (label: string, x: number, style: typeof BUTTON_GOLD, fn: () => void) => new PixelButton(this, label, bw, 18, style, `ab_l_${label}`, fn).place(x, btnY);
    const practice = mk('Practice', cx - bw * 1.5 - 6, BUTTON_GOLD, () => this.startPractice());
    const create = mk('Create room', cx - bw / 2, BUTTON_GOLD, () => this.openRoom());
    const join = mk('Join room', cx + bw / 2 + 6, BUTTON_GOLD, () => this.joinRoom());
    const back = new PixelButton(this, 'Back', 38, 13, BUTTON_PLAIN, 'ab_back', () => this.leave()).place(4, 4);
    const prize = pixelText(this, 0, btnY + 26, `Win a match: ${WIN_GEMS.ai} gems in practice, ${WIN_GEMS.online} online`, SOFT);
    prize.setX(Math.round(cx - prize.width / 2));
    c.add([title, say, ...heroes, practice, create, join, back, prize]);
    this.hud.setVisible(false);
  }

  private closeLobby(): void {
    this.lobby?.destroy();
    this.lobby = null;
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
    const c = (this.overlay = this.add.container(Math.round(this.vw / 2), Math.round(this.vh / 2)));
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
    const c = (this.overlay = this.add.container(Math.round(this.vw / 2), Math.round(this.vh / 2)));
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
    this.readyBtn.setVisible(false);
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

  private benchPt(i: number): { x: number; y: number } {
    return { x: this.benchX + 3 + i * BENCH_SLOT + BENCH_SLOT / 2, y: this.benchY + 3 + BENCH_SLOT - 4 };
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
      this.sellText.setPosition(Math.round((CARD_W * SHOP_SIZE + GAP * (SHOP_SIZE - 1)) / 2 - this.sellText.width / 2), Math.round(SHOP_H / 2 - 7));
    }
    pr.view.setPosition(Math.round(x), Math.round(y + 10));
    this.drawMarks(this.dropAt(x, y));
  }

  private onUp(ptr: Phaser.Input.Pointer): void {
    const pr = this.press;
    this.press = null;
    this.sellZone.setVisible(false);
    if (!pr) return;
    if (!pr.dragging) {
      // A tap: show this hero on the card.
      this.selected = { key: pr.piece.key, star: pr.piece.star, look: pr.piece.look };
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

  /** Where a drag would drop at (x, y): a bench slot, a cell on the player's half, the shop (to sell), or nowhere. */
  private dropAt(x: number, y: number): Drop {
    if (y >= this.shopY - 2 && x >= this.shopX && x < this.shopX + CARD_W * SHOP_SIZE + GAP * (SHOP_SIZE - 1)) return { sell: true };
    const bx = Math.floor((x - this.benchX - 3) / BENCH_SLOT);
    if (y >= this.benchY - 4 && y < this.benchY + BENCH_SLOT + 10 && bx >= 0 && bx < BENCH_SIZE) return { bench: bx };
    if (this.phase !== 'plan') return null;
    const f = this.frame;
    const c = Math.floor((x - f.x) / f.cw);
    // Feet a little under the pointer, so the hero stands where it's held.
    const r = Math.floor((y + 4 - f.y) / f.ch);
    if (c < 0 || c >= COLS || r < HALF || r >= ROWS) return null;
    return { cell: cellKey(c, r) };
  }

  /** Light the player's half while a piece is held, and the cell or slot it would land in. */
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
      const x = this.benchX + 3 + drop.bench * BENCH_SLOT;
      g.lineStyle(1, 0xffe08a, 0.9).strokeRect(x + 1.5, this.benchY + 4.5, BENCH_SLOT - 3, BENCH_SLOT - 3);
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
