import Phaser from 'phaser';
import { thingLook, warmHome } from '../art/homeArt';
import { CRITTER_H, CRITTER_OX, CRITTER_OY, CRITTER_W } from '../art/critters';
import { sound } from '../audio';
import { TABS, build, stopBuilding } from '../game/build';
import { collection } from '../game/collection';
import { CRITTERS, critterById } from '../game/critters';
import { session, type Msg } from '../net/session';
import type { WorldScene } from '../scenes/WorldScene';
import type { Forest } from './Forest';
import { CHUNK } from './forestGen';
import { Deck } from './bridge';
import { footOn, type BuildLand } from './buildLand';
import { Farm } from './Farm';
import type { RodHost } from './Fishing';
import type { RodSpot } from './Home';
import { HomeCritters } from './HomeCritters';
import { ForestEdits, MAX_CLEARED, MAX_FLOORS, MAX_ROOFS, MAX_TENTS, MAX_THINGS, MAX_WALLS, cellKey, wardReach } from './forestEdits';
import { CELL, PLOT_X, PLOT_Y, type Thing } from './homeLayout';
import { FISH_REACH, FLOORS, MAX_CRITTERS, extent, partById, type PartDef } from './homeParts';

// Building in the Everwood, with the Home's build tray (ui/buildHud.ts) and
// everything a Home is built of, set down anywhere on a 16 px grid over the
// forest: floors, walls of every kind with their doors and windows, roofs
// joined into houses that are walked into, tents, wall hangings, every
// garden thing, furniture and light, bridges laid across the streams and
// ponds (see bridge.ts), critters let out to live round their spot, seeds
// sown on garden beds, rods for fishing in the forest's own water; and the
// eraser, which takes back what was built or clears the forest's own trees,
// rocks, bushes and the rest. The changes (see forestEdits.ts) are kept in
// the player's save, so the forest, always the same one, is as they left it.
// Online the room's host's forest is the room's: they build and everyone
// sees it, as when visiting a Home.
/** How many edits can be undone. */
const UNDO_MAX = 30;
/** How far round the hero the cursor must keep, px, so nothing goes down on them. */
const HERO_R = 6;
/** The room is sent the changes this long after the last edit, in pieces no longer than this. */
const SEND_MS = 700;
const PIECE = 12000;
/** A cleared thing's tint while the eraser is over it. */
const DOOMED = 0xff8a7a;
/** The ring a ward lantern shows while being placed: how far it keeps the creatures off. */
const WARD_RING = 0xa8e8ff;

type Img = Phaser.GameObjects.Image;

export class ForestBuild implements RodHost {
  readonly edits: ForestEdits;
  /** The forest as the critters, the farm and fishing see it (see buildLand.ts). */
  readonly land: BuildLand;
  /** The critters let out here, the crops on the garden beds, and the critters the owner has caught (for the jar shelves). */
  private critters: HomeCritters;
  private farm: Farm;
  caught: string[] = [];
  private farmSent: string | null = null;
  private shownVer = -1;
  private rodSpots: RodSpot[] | null = null;
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
    gen.bridged = (x, y) => this.edits.bridges.at(x, y) === Deck.Walk;
    forest.edits = this.edits;
    forest.caught = () => this.caught;

    if (this.owner) this.caught = CRITTERS.filter((c) => collection.critterCount(c.id) > 0).map((c) => c.id);

    const e = this.edits;
    this.land = {
      ox: 0,
      oy: 0,
      get things() {
        return e.things;
      },
      floorAt: (cx, cy) => e.floorAt(cx, cy),
      wallAt: (cx, cy) => e.wallAt(cx, cy),
      // A pond laid, or the forest's own deep water.
      isWater: (cx, cy) => {
        if (e.isPond(cx, cy)) return true;
        const s = gen.sample((cx + 0.5) * CELL, (cy + 0.5) * CELL);
        return Math.max(s.stream, s.pond) > 1.5;
      },
      thingsAt: (cx, cy) => e.thingsAt(cx, cy),
      houseAt: (cx, cy) => e.houseAt(cx, cy),
      walkable: (x, y) => gen.walkable(x, y),
      waterCells: () => [...e.floors.keys()].filter((k) => FLOORS[e.floors.get(k)! - 1]?.water).map((k) => ({ x: Math.floor(k / 65536), y: k % 65536 })),
    };
    this.critters = new HomeCritters(world);
    this.farm = new Farm(
      world,
      this.owner,
      () => {
        if (session.active && this.owner) this.sendT = SEND_MS;
      },
      this.land,
      'w',
    );

    // Everything a Home has, the same here.
    build.available = this.owner;
    build.home = false;
    build.tabs = TABS.map((t) => t.id);
    build.allow = null;
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

  update(dt: number, heroX: number, heroY: number, daylight: number): void {
    this.hero.x = heroX;
    this.hero.y = heroY;
    this.step();
    // After a change: the critters find their spots again, the farm its beds and stoves, the rods their water.
    if (this.edits.version !== this.shownVer) {
      this.shownVer = this.edits.version;
      this.rodSpots = null;
      this.critters.sync(this.land, build.on);
      this.farm.sync();
    }
    this.critters.update(dt, heroX, heroY, daylight, this.world.cameras.main.worldView);
    this.farm.update(dt, heroX, heroY, daylight);
    if (this.sendT > 0 && (this.sendT -= dt) <= 0) this.send();
  }

  /** E or the touch button: pick the ripe crops in reach, or open the kitchen at a stove or pot. True when it did. */
  act(): boolean {
    return this.farm.act();
  }

  /** The fishing rods built here, each with the water within FISH_REACH cells of it: ponds laid and the forest's own (see world/Fishing.ts). */
  rods(): RodSpot[] {
    if (this.rodSpots) return this.rodSpots;
    const l = this.land;
    this.rodSpots = [];
    for (const t of this.edits.things) {
      if (!partById(t.id)?.fishing) continue;
      const water: RodSpot['water'] = [];
      for (let y = t.y - FISH_REACH; y <= t.y + FISH_REACH; y++) {
        for (let x = t.x - FISH_REACH; x <= t.x + FISH_REACH; x++) {
          if (!l.isWater(x, y)) continue;
          const open = l.isWater(x - 1, y) && l.isWater(x + 1, y) && l.isWater(x, y - 1) && l.isWater(x, y + 1);
          water.push({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL, open });
        }
      }
      const foot = footOn(l, t);
      this.rodSpots.push({ key: ForestBuild.rodKey(t), x: foot.x, y: foot.y, flip: t.flip, water });
    }
    return this.rodSpots;
  }

  static rodKey(t: Thing): string {
    return `${t.id}@${t.x},${t.y}`;
  }

  holdRod(key: string, out: boolean): void {
    this.forest.holdRod(key, out);
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
    const picked = !erase && pick?.layer === 'thing' ? (partById(pick.id) ?? null) : null;
    // A bridge is laid in strokes, cell by cell, like a wall: only the other things go down one at a time.
    const thing = picked?.bridge ? null : picked;
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
    const ok = thing ? this.canPlace(thing, fx, fy, turn) : this.canPaint(cx, cy);
    const col = ok ? 0x9cff8a : 0xff6a6a;
    g.fillStyle(col, 0.16);
    g.fillRect(fx * CELL, fy * CELL, size.w * CELL, size.h * CELL);
    g.lineStyle(1, col, 0.85);
    g.strokeRect(fx * CELL + 0.5, fy * CELL + 0.5, size.w * CELL - 1, size.h * CELL - 1);
    const part = thing ? partById(thing.id) : null;
    if (part?.ward) {
      // A ward shows how far it keeps the creatures off: a soft moonlit ring.
      const r = wardReach(part, size.w, size.h);
      const mx = (fx + size.w / 2) * CELL;
      const my = (fy + size.h / 2) * CELL;
      g.fillStyle(WARD_RING, 0.07);
      g.fillCircle(mx, my, r);
      g.lineStyle(1, WARD_RING, 0.55);
      g.strokeCircle(mx, my, r);
      g.lineStyle(1, WARD_RING, 0.18);
      g.strokeCircle(mx, my, r - 3);
    }
    if (thing?.critter) {
      this.ghost.setTexture('critters', `${thing.critter}_0`).setOrigin(CRITTER_OX / CRITTER_W, CRITTER_OY / CRITTER_H).setFlipX(false);
      this.ghost.setPosition((fx + 0.5) * CELL, (fy + 1) * CELL - 5).setTint(ok ? 0xffffff : 0xff8080);
    } else if (thing) {
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
      if (erase ? this.eraseAt(x, y, px.x, px.y) : this.paintAt(x, y)) changed = true;
    }
    if (changed) this.edits.index();
  }

  /** Is the open forest floor at the middle of cell (cx, cy)? Not in water (the forest's, or a pond laid) unless `water` allows it. */
  private open(cx: number, cy: number, water?: PartDef['water']): boolean {
    // Not on a cliff, its lip or its foot: things there would hang in the air or stand in the rock.
    if (this.forest.gen.edgeAt((cx + 0.5) * CELL, (cy + 0.5) * CELL, 4)) return false;
    const s = this.forest.gen.sample((cx + 0.5) * CELL, (cy + 0.5) * CELL);
    const pond = this.edits.isPond(cx, cy);
    const wet = pond || Math.max(s.stream, s.pond) > -1;
    return water === 'only' ? pond || Math.max(s.stream, s.pond) > 1.5 : water === 'too' || !wet;
  }

  private canPlace(p: PartDef, fx: number, fy: number, turn: number): boolean {
    if (this.edits.things.length >= MAX_THINGS) return false;
    // A door hangs in a house's doorway, a hanging on a house wall's face.
    if (p.door || p.wall) return this.edits.fitsWall(p, fx, fy);
    if (p.critter && this.edits.critterCount() >= MAX_CRITTERS) return false;
    if (this.onHero(p, fx, fy, turn)) return false;
    const { w, h } = extent(p, turn);
    if (this.edits.occupied(p, fx, fy, w, h)) return false;
    // Not over a crop growing (a critter can wander among them).
    if (!p.critter && this.farm.covers(fx, fy, w, h)) return false;
    const gen = this.forest.gen;
    // All on one terrace.
    const level = gen.levelAt((fx + 0.5) * CELL, (fy + 0.5) * CELL);
    for (let y = fy; y < fy + h; y++) {
      for (let x = fx; x < fx + w; x++) {
        if (!this.open(x, y, p.water) || gen.levelAt((x + 0.5) * CELL, (y + 0.5) * CELL) !== level) return false;
        // Standing things keep off the forest's trunks, rocks and places (clear them first); a bridge goes over water or open ground.
        const wx = (x + 0.5) * CELL;
        const wy = (y + 0.5) * CELL;
        if (!p.flat && (p.water !== 'too' || (p.bridge && this.open(x, y))) && !gen.walkable(wx, wy)) return false;
      }
    }
    return true;
  }

  private placeThing(p: PartDef, fx: number, fy: number, turn: number): void {
    if (!this.canPlace(p, fx, fy, turn)) return;
    this.edits.things.push({ id: p.id, x: fx, y: fy, flip: build.flip && !!p.flip, turn });
    this.edits.index();
    this.touchCells(fx, fy, 1);
    // A critter is let out with its own sparkle and chirp (HomeCritters).
    if (!p.critter) sound.thud(0);
  }

  /** Can the stroke's pick go on cell (cx, cy): a wall, a floor or a bridge's cell? */
  private canPaint(cx: number, cy: number): boolean {
    const pick = build.pick;
    if (!pick) return false;
    if (pick.layer === 'floor') return this.canFloor(cx, cy);
    if (pick.layer === 'seed') return this.farm.canSow(cx, cy, pick.id);
    // A roof goes over anything; it's walked under.
    if (pick.layer === 'roof') return this.edits.roofAt(cx, cy) > 0 || this.edits.roofs.size < MAX_ROOFS;
    // A tent is its own walls: on open ground, not over walls or water, nor on the hero (its hem would hold them).
    if (pick.layer === 'tent') {
      const e = this.edits;
      if (!e.tentAt(cx, cy) && (e.tents.size >= MAX_TENTS || this.heroIn(cx, cy))) return false;
      return !e.wallAt(cx, cy) && !e.isPond(cx, cy) && this.open(cx, cy);
    }
    if (pick.layer === 'thing') {
      const p = partById(pick.id);
      return !!p?.bridge && this.canPlace(p, cx, cy, 0);
    }
    return this.canWall(cx, cy);
  }

  private canWall(cx: number, cy: number): boolean {
    const pick = build.pick;
    if (!pick || pick.layer !== 'wall' || this.edits.walls.size >= MAX_WALLS) return false;
    // Hangings, doors and critters don't hold a wall up; anything else in the cell does.
    if (this.edits.thingsAt(cx, cy).some((t) => !partById(t.id)?.wall && !partById(t.id)?.door && !partById(t.id)?.critter)) return false;
    if (this.heroIn(cx, cy) || this.edits.isPond(cx, cy) || this.edits.tentAt(cx, cy)) return false;
    return this.open(cx, cy) && (this.edits.wallAt(cx, cy) !== 0 || this.forest.gen.walkable((cx + 0.5) * CELL, (cy + 0.5) * CELL));
  }

  /** A floor goes on open ground; a pond only where nothing stands that would end up in it, and not round the hero. */
  private canFloor(cx: number, cy: number): boolean {
    const v = build.pick!.value;
    const e = this.edits;
    if (!e.floorAt(cx, cy) && e.floors.size >= MAX_FLOORS) return false;
    const s = this.forest.gen.sample((cx + 0.5) * CELL, (cy + 0.5) * CELL);
    if (Math.max(s.stream, s.pond) > -1 || this.forest.gen.edgeAt((cx + 0.5) * CELL, (cy + 0.5) * CELL, 4)) return false;
    if (!FLOORS[v - 1]?.water) return true;
    return !e.wallAt(cx, cy) && !this.heroIn(cx, cy) && !e.thingsAt(cx, cy).some((t) => !partById(t.id)?.water);
  }

  /** Lay the stroke's pick on cell (cx, cy). */
  private paintAt(cx: number, cy: number): boolean {
    const pick = build.pick!;
    const e = this.edits;
    if (!this.canPaint(cx, cy)) return false;
    if (pick.layer === 'floor') {
      if (e.floorAt(cx, cy) === pick.value) return false;
      e.floors.set(cellKey(cx, cy), pick.value);
      // Off the water, lily pads go with it.
      if (!FLOORS[pick.value - 1]?.water) e.things = e.things.filter((t) => !(partById(t.id)?.water === 'only' && t.x === cx && t.y === cy));
      return true;
    }
    // Sowing changes the farm, not what's built: nothing to redraw or undo.
    if (pick.layer === 'seed') {
      this.farm.sow(cx, cy, pick.id);
      return false;
    }
    if (pick.layer === 'roof' || pick.layer === 'tent') {
      const [mine, other] = pick.layer === 'roof' ? [e.roofs, e.tents] : [e.tents, e.roofs];
      if (mine.get(cellKey(cx, cy)) === pick.value) return false;
      mine.set(cellKey(cx, cy), pick.value);
      other.delete(cellKey(cx, cy));
      return true;
    }
    if (pick.layer === 'thing') {
      e.things.push({ id: pick.id, x: cx, y: cy, flip: false, turn: 0 });
      sound.thud(0);
      return true;
    }
    if (e.wallAt(cx, cy) === pick.value) return false;
    e.walls.set(cellKey(cx, cy), pick.value);
    this.checkDecor();
    // A wall joins up with its neighbours, which may stand in the next chunk.
    this.touchCells(cx, cy, 1);
    return true;
  }

  /** What the eraser takes at cell (cx, cy), pointer at (x, y): something built there, else the forest's own tree or undergrowth under the pointer. */
  private eraseTarget(cx: number, cy: number, x: number, y: number) {
    const e = this.edits;
    const tab = build.tab;
    // The layers' tabs take only their own: floors, roofs, tents, crops.
    if (tab === 'floor') return e.floorAt(cx, cy) ? ('floor' as const) : null;
    if (tab === 'roof') return e.roofAt(cx, cy) ? ('roof' as const) : null;
    if (tab === 'tent') return e.tentAt(cx, cy) ? ('tent' as const) : null;
    if (tab === 'seeds') return this.farm.plotAt(cx, cy) ? ('crop' as const) : null;
    // A door comes out of its doorway before the doorway goes.
    if (tab === 'wall') return e.thingsAt(cx, cy).find((t) => partById(t.id)?.door) ?? (e.wallAt(cx, cy) ? ('wall' as const) : null);
    // Critters roam off their spots, so the eraser takes the one it touches, wherever it has got to.
    if (tab === 'critters') return this.critters.at(x, y, CELL * 0.75) ?? e.thingsAt(cx, cy).find((t) => partById(t.id)?.critter) ?? null;
    // Not a bridge from under the hero's feet, out over the water.
    const here = e.thingsAt(cx, cy).filter((t) => !partById(t.id)?.critter && !(partById(t.id)?.bridge && this.heroIn(cx, cy)));
    if (tab === 'decor') return here.find((t) => partById(t.id)?.wall) ?? null;
    const built = here.find((t) => partById(t.id)?.tab === tab) ?? here.find((t) => !partById(t.id)?.wall && !partById(t.id)?.door);
    if (built) return built;
    if (e.thingsAt(cx, cy).some((t) => partById(t.id)?.bridge)) return null;
    if (e.wallAt(cx, cy)) return 'wall' as const;
    return e.cleared.size < MAX_CLEARED ? this.forest.clearableAt(x, y) : null;
  }

  private eraseAt(cx: number, cy: number, x: number, y: number): boolean {
    const what = this.eraseTarget(cx, cy, x, y);
    if (!what) return false;
    if (what === 'floor') {
      this.edits.floors.delete(cellKey(cx, cy));
    } else if (what === 'roof') {
      this.edits.roofs.delete(cellKey(cx, cy));
    } else if (what === 'tent') {
      this.edits.tents.delete(cellKey(cx, cy));
    } else if (what === 'crop') {
      this.farm.uproot(cx, cy);
      return false;
    } else if (what === 'wall') {
      this.edits.walls.delete(cellKey(cx, cy));
      this.checkDecor();
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

  /** Hangings stay only on house walls whose face shows, and doors in house doorways (as in a Home). */
  private checkDecor(): void {
    const e = this.edits;
    const gone = e.things.filter((t) => {
      const p = partById(t.id);
      return (p?.wall || p?.door) && !e.fitsWall(p, t.x, t.y, t);
    });
    if (!gone.length) return;
    e.things = e.things.filter((t) => !gone.includes(t));
    for (const t of gone) this.touchCells(t.x, t.y, 1);
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
    e.floors = n.floors;
    e.roofs = n.roofs;
    e.tents = n.tents;
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
    // The first piece carries the host's farm and the critters for their jar shelves.
    if (typeof m.fm === 'string') this.farmSent = m.fm;
    if (typeof m.c === 'string') this.caught = m.c ? m.c.split(',').filter((id) => critterById(id)) : [];
    if (this.pieces.parts.some((s) => !s)) return;
    const all = this.pieces.parts.join('');
    this.pieces = null;
    this.apply(ForestEdits.decode(all));
    if (this.farmSent !== null) this.farm.adopt(this.farmSent);
    this.farmSent = null;
  }

  /** The changes to the room (or one player who asked), in pieces small enough for the server. */
  private send(to?: number): void {
    this.sendT = 0;
    if (!session.active || !this.owner) return;
    const s = this.edits.encode();
    const n = Math.max(1, Math.ceil(s.length / PIECE));
    const k = ++this.sendSeq;
    for (let i = 0; i < n; i++) {
      const m: Msg = { t: 'wl', k, i, n, d: s.slice(i * PIECE, (i + 1) * PIECE) };
      if (i === 0) {
        m.c = this.caught.join(',');
        m.fm = this.farm.encoded();
      }
      session.send(m, to);
    }
  }

  destroy(): void {
    this.critters.destroy();
    this.farm.destroy();
    this.netOff?.();
    this.netOff = null;
    build.available = false;
    build.tabs = TABS.map((t) => t.id);
    build.allow = null;
    stopBuilding();
    this.forest.gen.cleared = null;
    this.forest.gen.built = null;
    this.forest.gen.bridged = null;
  }
}
