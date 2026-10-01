import Phaser from 'phaser';
import { thingLook, warmHome } from '../art/homeArt';
import { sound } from '../audio';
import { TABS, build, stopBuilding } from '../game/build';
import { collection } from '../game/collection';
import { session, type Msg } from '../net/session';
import type { WorldScene } from '../scenes/WorldScene';
import type { Forest } from './Forest';
import { CHUNK } from './forestGen';
import { ForestEdits, MAX_CLEARED, MAX_THINGS, MAX_WALLS, cellKey, forestPart, forestWall } from './forestEdits';
import { CELL, PLOT_X, PLOT_Y } from './homeLayout';
import { extent, partById, type BuildTab, type PartDef } from './homeParts';

// Building in the Everwood, with the Home's build tray (ui/buildHud.ts) and
// its parts: anything outdoors from the Garden, Furniture and Lights tabs set
// down anywhere on a 16 px grid over the forest, garden walls (hedges,
// fences, low walls and their gates) drawn cell by cell, and the eraser,
// which takes back what was built or clears the forest's own trees, rocks,
// bushes and the rest. The changes (see forestEdits.ts) are kept in the
// player's save, so the forest, always the same one, is as they left it.
// Online the room's host's forest is the room's: they build and everyone
// sees it, as when visiting a Home.

/** The tray's tabs here: no floors or roofs (no houses in the forest), and no wall decor or critters. */
const TABS_HERE: BuildTab[] = ['garden', 'furniture', 'light', 'wall'];
/** How many edits can be undone. */
const UNDO_MAX = 30;
/** How far round the hero the cursor must keep, px, so nothing goes down on them. */
const HERO_R = 6;
/** The room is sent the changes this long after the last edit, in pieces no longer than this. */
const SEND_MS = 700;
const PIECE = 12000;
/** A cleared thing's tint while the eraser is over it. */
const DOOMED = 0xff8a7a;

type Img = Phaser.GameObjects.Image;

export class ForestBuild {
  readonly edits: ForestEdits;
  private readonly owner: boolean;
  private cursor: Phaser.GameObjects.Graphics;
  private ghost: Img;
  /** The forest's own thing the eraser is over, tinted to show it'll go. */
  private marked: Img | Phaser.GameObjects.Sprite | null = null;
  private undoStack: string[] = [];
  private before = '';
  private lastCell: { x: number; y: number } | null = null;
  private hero = { x: 0, y: 0 };
  private sendT = 0;
  private sendSeq = 0;
  private pieces: { k: number; parts: string[] } | null = null;
  private netOff: (() => void) | null = null;

  constructor(
    private world: WorldScene,
    private forest: Forest,
  ) {
    // The Home's art: its parts, walls and the tray's pictures.
    warmHome(world);
    // Online, the room's host's forest is the one everyone walks.
    this.owner = !session.active || session.isHost;
    this.edits = this.owner ? ForestEdits.decode(collection.wood) : new ForestEdits();
    const gen = forest.gen;
    gen.cleared = this.edits.cleared;
    gen.built = (x, y) => this.edits.blocks(x, y);
    forest.edits = this.edits;

    build.available = this.owner;
    build.home = false;
    build.tabs = TABS_HERE;
    build.allow = (item) => (item.layer === 'wall' ? forestWall(item.value) : item.layer === 'thing' && !!partById(item.id) && forestPart(partById(item.id)!));
    build.tab = 'garden';
    build.canUndo = false;
    stopBuilding();

    this.cursor = world.add.graphics().setDepth(9000).setVisible(false);
    this.ghost = world.add.image(0, 0, 'home', 'chimney').setAlpha(0.6).setDepth(9001).setVisible(false);

    if (session.active) {
      this.netOff = session.on((m) => this.receive(m));
      if (!this.owner) session.send({ t: 'wq' });
    }
  }

  update(dt: number, heroX: number, heroY: number): void {
    this.hero.x = heroX;
    this.hero.y = heroY;
    this.step();
    if (this.sendT > 0 && (this.sendT -= dt) <= 0) this.send();
  }

  // ---------------------------------------------------------------- Building

  private step(): void {
    const on = build.on && this.owner;
    if (!on) {
      this.cursor.setVisible(false);
      this.ghost.setVisible(false);
      this.mark(null);
      build.pressed = build.released = false;
      this.lastCell = null;
      return;
    }
    if (build.undo) {
      build.undo = false;
      this.undo();
    }
    const p = build.pointer;
    const w = this.world.cameras.main.getWorldPoint(p.x, p.y);
    const cx = Math.floor(w.x / CELL);
    const cy = Math.floor(w.y / CELL);
    const pick = build.pick;
    const erase = p.erase || !pick;
    const thing = !erase && pick?.layer === 'thing' ? (partById(pick.id) ?? null) : null;
    const turn = thing?.turns ? build.turn : 0;
    const size = thing ? extent(thing, turn) : { w: 1, h: 1 };
    // A thing's footprint hangs from the cell under the pointer by its middle, so the pointer is at its foot.
    const fx = cx - Math.floor((size.w - 1) / 2);
    const fy = cy - (size.h - 1);

    if (build.pressed) {
      build.pressed = false;
      this.before = this.edits.encode();
      this.lastCell = null;
    }
    if (p.down && !thing) this.stroke(cx, cy, erase);
    if (build.released) {
      build.released = false;
      if (thing) this.placeThing(thing, fx, fy, turn);
      else this.stroke(cx, cy, erase);
      this.lastCell = null;
      this.endStroke();
    }

    // The cursor: the footprint, green where it can go and red where it can't, and a ghost of the thing; or what the eraser would take.
    const show = p.over || p.down;
    this.cursor.setVisible(show);
    this.ghost.setVisible(show && !!thing);
    if (!show) {
      this.mark(null);
      return;
    }
    const g = this.cursor.clear();
    if (erase) {
      const target = this.eraseTarget(cx, cy, w.x, w.y);
      const clear = typeof target === 'object' && target && 'of' in target ? target : null;
      this.mark(clear ? clear.obj : null);
      if (clear) return;
      const col = target ? 0xff9a6a : 0xff6a6a;
      let bx = cx;
      let by = cy;
      let bw = 1;
      let bh = 1;
      if (typeof target === 'object' && target && 'id' in target) {
        const e = extent(partById(target.id)!, target.turn);
        [bx, by, bw, bh] = [target.x, target.y, e.w, e.h];
      }
      g.fillStyle(col, target ? 0.18 : 0.08);
      g.fillRect(bx * CELL, by * CELL, bw * CELL, bh * CELL);
      g.lineStyle(1, col, target ? 0.85 : 0.4);
      g.strokeRect(bx * CELL + 0.5, by * CELL + 0.5, bw * CELL - 1, bh * CELL - 1);
      return;
    }
    this.mark(null);
    const ok = thing ? this.canPlace(thing, fx, fy, turn) : this.canWall(cx, cy);
    const col = ok ? 0x9cff8a : 0xff6a6a;
    g.fillStyle(col, 0.16);
    g.fillRect(fx * CELL, fy * CELL, size.w * CELL, size.h * CELL);
    g.lineStyle(1, col, 0.85);
    g.strokeRect(fx * CELL + 0.5, fy * CELL + 0.5, size.w * CELL - 1, size.h * CELL - 1);
    if (thing) {
      const look = thingLook({ id: thing.id, x: fx, y: fy, flip: build.flip && !!thing.flip, turn });
      this.ghost
        .setTexture(look.key, look.frame)
        .setOrigin(look.ox, look.oy)
        .setFlipX(look.flipX)
        .setPosition(look.x - PLOT_X, look.y - PLOT_Y)
        .setTint(ok ? 0xffffff : 0xff8080);
    }
  }

  /** Tint the forest's own thing the eraser is over (and let the last one go). */
  private mark(obj: Img | Phaser.GameObjects.Sprite | null): void {
    if (obj === this.marked) return;
    if (this.marked?.active) this.marked.clearTint();
    this.marked = obj;
    obj?.setTint(DOOMED);
  }

  /** Draw (or erase) along every cell from the last one the pointer was on to this one. */
  private stroke(cx: number, cy: number, erase: boolean): void {
    const from = this.lastCell ?? { x: cx, y: cy };
    if (this.lastCell && from.x === cx && from.y === cy) return;
    this.lastCell = { x: cx, y: cy };
    const n = Math.max(Math.abs(cx - from.x), Math.abs(cy - from.y));
    let changed = false;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(from.x + ((cx - from.x) * s) / Math.max(1, n));
      const y = Math.round(from.y + ((cy - from.y) * s) / Math.max(1, n));
      // Along a stroke the eraser reaches each cell's middle; where the pointer is, exactly there.
      const px = s === n ? this.world.cameras.main.getWorldPoint(build.pointer.x, build.pointer.y) : { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
      if (erase ? this.eraseAt(x, y, px.x, px.y) : this.wallAt(x, y)) changed = true;
    }
    if (changed) this.edits.index();
  }

  /** Is the open forest floor at the middle of cell (cx, cy)? Not under a thicket's roof, nor in water unless `water` allows it. */
  private open(cx: number, cy: number, water?: PartDef['water']): boolean {
    // Not on a cliff, its lip or its foot: things there would hang in the air or stand in the rock.
    if (this.forest.gen.edgeAt((cx + 0.5) * CELL, (cy + 0.5) * CELL, 4)) return false;
    const s = this.forest.gen.sample((cx + 0.5) * CELL, (cy + 0.5) * CELL);
    if (s.roof > -9) return false;
    const wet = Math.max(s.stream, s.pond) > -1;
    return water === 'only' ? Math.max(s.stream, s.pond) > 1.5 : water === 'too' || !wet;
  }

  private canPlace(p: PartDef, fx: number, fy: number, turn: number): boolean {
    if (this.edits.things.length >= MAX_THINGS || this.onHero(p, fx, fy, turn)) return false;
    const { w, h } = extent(p, turn);
    if (this.edits.occupied(p, fx, fy, w, h)) return false;
    const gen = this.forest.gen;
    // All on one terrace.
    const level = gen.levelAt((fx + 0.5) * CELL, (fy + 0.5) * CELL);
    for (let y = fy; y < fy + h; y++) {
      for (let x = fx; x < fx + w; x++) {
        if (!this.open(x, y, p.water) || gen.levelAt((x + 0.5) * CELL, (y + 0.5) * CELL) !== level) return false;
        // Standing things keep off the forest's trunks, rocks and places (clear them first).
        if (!p.flat && p.water !== 'too' && !gen.walkable((x + 0.5) * CELL, (y + 0.5) * CELL)) return false;
      }
    }
    return true;
  }

  private placeThing(p: PartDef, fx: number, fy: number, turn: number): void {
    if (!this.canPlace(p, fx, fy, turn)) return;
    this.edits.things.push({ id: p.id, x: fx, y: fy, flip: build.flip && !!p.flip, turn });
    this.edits.index();
    this.touchCells(fx, fy, 1);
    sound.thud(0);
  }

  private canWall(cx: number, cy: number): boolean {
    const pick = build.pick;
    if (!pick || pick.layer !== 'wall' || this.edits.walls.size >= MAX_WALLS) return false;
    if (this.edits.thingsAt(cx, cy).length || this.heroIn(cx, cy)) return false;
    return this.open(cx, cy) && (this.edits.wallAt(cx, cy) !== 0 || this.forest.gen.walkable((cx + 0.5) * CELL, (cy + 0.5) * CELL));
  }

  private wallAt(cx: number, cy: number): boolean {
    const v = build.pick!.value;
    if (this.edits.wallAt(cx, cy) === v || !this.canWall(cx, cy)) return false;
    this.edits.walls.set(cellKey(cx, cy), v);
    // A wall joins up with its neighbours, which may stand in the next chunk.
    this.touchCells(cx, cy, 1);
    return true;
  }

  /** What the eraser takes at cell (cx, cy), pointer at (x, y): something built there, else the forest's own tree or undergrowth under the pointer. */
  private eraseTarget(cx: number, cy: number, x: number, y: number) {
    const built = this.edits.thingsAt(cx, cy)[0];
    if (built) return built;
    if (this.edits.wallAt(cx, cy)) return 'wall' as const;
    return this.edits.cleared.size < MAX_CLEARED ? this.forest.clearableAt(x, y) : null;
  }

  private eraseAt(cx: number, cy: number, x: number, y: number): boolean {
    const what = this.eraseTarget(cx, cy, x, y);
    if (!what) return false;
    if (what === 'wall') {
      this.edits.walls.delete(cellKey(cx, cy));
      this.touchCells(cx, cy, 1);
    } else if ('of' in what) {
      this.edits.cleared.add(what.of);
      if (this.marked === what.obj) this.marked = null;
      this.forest.clearedAt(what.x, what.y, what.tree);
      // A puff of leaves (or grit) where it stood.
      this.world.debris(what.tree ? [0x5f9a4b, 0x8fbf5a, 0x6b4a2a] : [0x8a7a5a, 0x6f8f4a], what.x, what.y - (what.tree ? 30 : 6), what.tree ? 14 : 6, what.y + 20, what.tree ? 'spores' : 'burst');
      sound.puff(0);
    } else {
      this.edits.things = this.edits.things.filter((t) => t !== what);
      this.touchCells(what.x, what.y, 3);
      sound.puff(0);
    }
    return true;
  }

  /** Stand again the chunks round cells (cx, cy) .. (cx + r, cy + r), reached `r` cells either way. */
  private touchCells(cx: number, cy: number, r: number): void {
    const per = CHUNK / CELL;
    for (let j = Math.floor((cy - r) / per); j <= Math.floor((cy + r) / per); j++) {
      for (let i = Math.floor((cx - r) / per); i <= Math.floor((cx + r) / per); i++) this.forest.touch(i, j);
    }
  }

  private heroIn(cx: number, cy: number): boolean {
    const x = cx * CELL;
    const y = cy * CELL;
    return this.hero.x > x - HERO_R && this.hero.x < x + CELL + HERO_R && this.hero.y > y - HERO_R && this.hero.y < y + CELL + HERO_R;
  }

  private onHero(p: PartDef, fx: number, fy: number, turn: number): boolean {
    if (p.block === 'none') return false;
    const { w, h } = extent(p, turn);
    for (let y = fy; y < fy + h; y++) for (let x = fx; x < fx + w; x++) if (this.heroIn(x, y)) return true;
    return false;
  }

  /** A stroke is over: keep it for undo, save it and show the room. */
  private endStroke(): void {
    const now = this.edits.encode();
    if (!this.before || now === this.before) return;
    this.undoStack.push(this.before);
    if (this.undoStack.length > UNDO_MAX) this.undoStack.shift();
    build.canUndo = true;
    this.before = '';
    this.changed(now);
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    build.canUndo = this.undoStack.length > 0;
    if (prev === undefined) return;
    this.apply(ForestEdits.decode(prev));
    this.changed(prev);
  }

  /** Make the forest's changes these: what's built is stood up again, and whatever was cleared or put back goes or returns. */
  private apply(n: ForestEdits): void {
    const e = this.edits;
    const was = new Set(e.cleared);
    e.things = n.things;
    e.walls = n.walls;
    e.cleared.clear();
    for (const k of n.cleared) e.cleared.add(k);
    e.index();
    for (const k of was) if (!e.cleared.has(k)) this.forest.clearedAt(Math.floor(k / 1048576), k % 1048576, true);
    for (const k of e.cleared) if (!was.has(k)) this.forest.clearedAt(Math.floor(k / 1048576), k % 1048576, true);
    this.forest.touchAll();
  }

  private changed(encoded: string): void {
    if (this.owner) collection.saveWood(encoded);
    if (session.active && this.owner) this.sendT = SEND_MS;
  }

  // ---------------------------------------------------------------- Online

  private receive(m: Msg): void {
    if (m.t === 'wq') {
      if (this.owner) this.send(m.f);
      return;
    }
    if (m.t !== 'wl' || this.owner) return;
    const k = m.k as number;
    const n = m.n as number;
    if (!this.pieces || this.pieces.k !== k) this.pieces = { k, parts: new Array(n).fill('') };
    this.pieces.parts[m.i as number] = String(m.d ?? '');
    if (this.pieces.parts.some((s) => !s)) return;
    const all = this.pieces.parts.join('');
    this.pieces = null;
    this.apply(ForestEdits.decode(all));
  }

  /** The changes to the room (or one player who asked), in pieces small enough for the server. */
  private send(to?: number): void {
    this.sendT = 0;
    if (!session.active || !this.owner) return;
    const s = this.edits.encode();
    const n = Math.max(1, Math.ceil(s.length / PIECE));
    const k = ++this.sendSeq;
    for (let i = 0; i < n; i++) session.send({ t: 'wl', k, i, n, d: s.slice(i * PIECE, (i + 1) * PIECE) }, to);
  }

  destroy(): void {
    this.netOff?.();
    this.netOff = null;
    build.available = false;
    build.tabs = TABS.map((t) => t.id);
    build.allow = null;
    stopBuilding();
    this.forest.gen.cleared = null;
    this.forest.gen.built = null;
  }
}
