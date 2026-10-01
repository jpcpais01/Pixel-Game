// The Home's farm and kitchen in the world (see game/farm.ts and
// game/cooking.ts): crops standing on the garden beds, growing through their
// stages as the real minutes pass, ripe ones twinkling; sowing from the build
// tray's Seeds tab (Home.ts hands the strokes here); picking ripe crops in
// reach with E or the touch button; and the stoves and cooking pots, whose
// counter (ui/cookView.ts) opens with E beside them and closes on walking off.

import Phaser from 'phaser';
import { CROP_FX, CROP_FY, warmFarm } from '../art/farm';
import { sound } from '../audio';
import { build } from '../game/build';
import { collection } from '../game/collection';
import { controls } from '../game/controls';
import { cookHud, cropKey, seedKey } from '../game/cooking';
import { CROPS, STARTER_SEEDS, cropById, decodeFarm, encodeFarm, homeAct, rollHarvest, stageOf, type Plot } from '../game/farm';
import { keeperCall } from '../game/keepers';
import { SUN_SHADOW_ALPHA, sunShadow } from '../game/Wizard';
import type { WorldScene } from '../scenes/WorldScene';
import { thingFoot } from '../art/homeArt';
import { CELL, PLOT_X, PLOT_Y, cellIndex, inPlot, type HomeLayout } from './homeLayout';
import { extent, floorIndex, partById } from './homeParts';

/** The Home's farm in the saved string. */
const AT = 'h';
/** How close the hero's feet must be to a ripe crop's to pick it, px; everything ripe that close is picked at once. */
const PICK_R = 22;
/** How close to a stove or pot the hero must stand to cook, px from its footprint, and how far they walk before it closes. */
const COOK_R = 14;
const COOK_LEAVE = 40;
/** How often the crops are looked at to move them on a stage, ms. */
const GROW_MS = 1000;
/** How often a ripe crop twinkles, ms (each on its own beat). */
const TWINKLE_MS = 2600;

interface Crop {
  plot: Plot;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  shadow: Phaser.GameObjects.Image;
  stage: number;
  seed: number;
}

const keyOf = (x: number, y: number): string => `${x},${y}`;

export class Farm {
  private plots: Plot[] = [];
  private crops = new Map<string, Crop>();
  private soil = floorIndex('soil');
  private growT = 0;
  private daylight = 1;
  private hero = { x: 0, y: 0 };
  private sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private dirt: Phaser.GameObjects.Particles.ParticleEmitter;
  private steam: Phaser.GameObjects.Particles.ParticleEmitter;
  private label: Phaser.GameObjects.BitmapText;
  private labelFor = '';
  private stations: { x0: number; y0: number; x1: number; y1: number; kind: 'stove' | 'fire'; steamX: number; steamY: number }[] = [];
  private steamT = 0;
  /** The kitchen this hero opened, until they walk off. */
  private cooking: { x: number; y: number } | null = null;

  constructor(
    private scene: WorldScene,
    /** The player's own Home (their farm, saved), or a friend's being visited (shown, not picked). */
    private owner: boolean,
    /** The farm changed: save it and show visitors. */
    private onChange: () => void,
  ) {
    warmFarm(scene);
    if (owner) {
      collection.giveStarter(CROPS.filter((c) => c.kind === 'garden').map((c) => c.id), STARTER_SEEDS);
      this.plots = decodeFarm(collection.farm).filter((p) => p.at === AT);
    }
    const add = scene.add;
    this.sparkle = add.particles(0, 0, 'spark', {
      speed: { min: 4, max: 14 },
      angle: { min: 240, max: 300 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(20000);
    this.dirt = add.particles(0, 0, 'spark', {
      speed: { min: 15, max: 45 },
      angle: { min: 200, max: 340 },
      gravityY: 180,
      lifespan: { min: 250, max: 450 },
      scale: { start: 1, end: 0.4 },
      tint: [0x5e412a, 0x3a2616, 0x735236],
      emitting: false,
    }).setDepth(20000);
    this.steam = add.particles(0, 0, 'rogue_smoke', {
      lifespan: 1900,
      speedY: { min: -12, max: -7 },
      speedX: { min: -2, max: 4 },
      scale: { start: 0.14, end: 0.55 },
      alpha: { start: 0.3, end: 0 },
      tint: [0xf0ece8, 0xd8d4d8],
      emitting: false,
    }).setDepth(20000);
    this.label = add.bitmapText(0, 0, 'pixel', '').setLetterSpacing(-1).setOrigin(0.5, 1).setDepth(10002).setVisible(false);
  }

  // ---------------------------------------------------------------- The plots

  /** The farm a visitor is sent with the home. */
  adopt(s: string): void {
    this.plots = decodeFarm(s).filter((p) => p.at === AT);
    this.redraw();
  }

  /** The Home's plots as the room is sent them. */
  encoded(): string {
    return encodeFarm(this.plots);
  }

  private save(): void {
    if (this.owner) {
      // Keep any other farm's plots (the Everwood's, one day) as they were.
      const others = decodeFarm(collection.farm).filter((p) => p.at !== AT);
      collection.saveFarm(encodeFarm([...others, ...this.plots]));
    }
    this.onChange();
  }

  /** Is a crop growing in any of these cells? (Things can't be set down on one.) */
  covers(cx: number, cy: number, w: number, h: number): boolean {
    return this.plots.some((p) => p.x >= cx && p.x < cx + w && p.y >= cy && p.y < cy + h);
  }

  plotAt(cx: number, cy: number): Plot | undefined {
    return this.plots.find((p) => p.x === cx && p.y === cy);
  }

  /** Could `crop` be sown here: open garden bed, nothing on it, nothing growing, and a seed in hand? */
  canSow(l: HomeLayout, cx: number, cy: number, crop: string): boolean {
    if (!inPlot(cx, cy) || l.floor[cellIndex(cx, cy)] !== this.soil || this.plotAt(cx, cy)) return false;
    if (l.thingsAt(cx, cy).some((t) => !partById(t.id)?.critter)) return false;
    return collection.stock(seedKey(crop)) > 0;
  }

  sow(l: HomeLayout, cx: number, cy: number, crop: string): boolean {
    if (!this.owner || !this.canSow(l, cx, cy, crop)) return false;
    collection.useStock([[seedKey(crop), 1]]);
    this.plots.push({ at: AT, x: cx, y: cy, crop, t: Date.now() });
    this.show(this.plots[this.plots.length - 1]);
    const x = PLOT_X + (cx + 0.5) * CELL;
    const y = PLOT_Y + cy * CELL + CROP_FY - 15;
    this.dirt.explode(5, x, y);
    sound.plant(this.scene.pan(x));
    this.save();
    return true;
  }

  /** Pull up whatever's growing here (the eraser on the Seeds tab). A seed not yet sprouted goes back in the pouch. */
  uproot(cx: number, cy: number): boolean {
    const p = this.plotAt(cx, cy);
    if (!p || !this.owner) return false;
    if (stageOf(p) === 0) collection.addStock(seedKey(p.crop), 1);
    this.plots = this.plots.filter((q) => q !== p);
    this.drop(keyOf(cx, cy));
    this.dirt.explode(6, PLOT_X + (cx + 0.5) * CELL, PLOT_Y + cy * CELL + CROP_FY - 15);
    sound.puff(0);
    this.save();
    return true;
  }

  /**
   * After the layout changes: a crop whose bed was painted over, or that
   * something now stands on, is gone (its seed back if it hadn't come up);
   * and the stoves and pots are found again.
   */
  sync(l: HomeLayout): void {
    const keep = this.plots.filter((p) => inPlot(p.x, p.y) && l.floor[cellIndex(p.x, p.y)] === this.soil && !l.thingsAt(p.x, p.y).some((t) => !partById(t.id)?.critter));
    if (keep.length !== this.plots.length && this.owner) {
      for (const p of this.plots) if (!keep.includes(p) && stageOf(p) === 0) collection.addStock(seedKey(p.crop), 1);
      this.plots = keep;
      this.save();
    }
    this.stations = [];
    for (const t of l.things) {
      const part = partById(t.id);
      if (!part?.cook) continue;
      const e = extent(part, t.turn);
      const foot = thingFoot(t);
      this.stations.push({
        x0: PLOT_X + t.x * CELL,
        y0: PLOT_Y + t.y * CELL,
        x1: PLOT_X + (t.x + e.w) * CELL,
        y1: PLOT_Y + (t.y + e.h) * CELL,
        kind: part.cook,
        // Steam off the copper pot on the stove's left plate, or off the pot over the fire.
        steamX: part.cook === 'stove' ? PLOT_X + t.x * CELL + 8 : foot.x,
        steamY: part.cook === 'stove' ? foot.y - 24 : foot.y - 16,
      });
    }
    this.redraw();
  }

  private redraw(): void {
    const want = new Set(this.plots.map((p) => keyOf(p.x, p.y)));
    for (const k of [...this.crops.keys()]) if (!want.has(k)) this.drop(k);
    for (const p of this.plots) {
      const c = this.crops.get(keyOf(p.x, p.y));
      if (c && c.plot.crop === p.crop) c.plot = p;
      else {
        if (c) this.drop(keyOf(p.x, p.y));
        this.show(p);
      }
    }
  }

  /** A crop stood up on its cell: its foot a little below the cell's middle, so rows read as rows. */
  private show(p: Plot): void {
    const add = this.scene.add;
    const x = PLOT_X + (p.x + 0.5) * CELL;
    const y = PLOT_Y + p.y * CELL + 12;
    const stage = stageOf(p);
    const frame = `${p.crop}_${stage}`;
    const ox = CROP_FX / 20;
    const oy = CROP_FY / 32;
    const sprite = add.image(x, y, 'crops', frame).setOrigin(ox, oy).setPipeline('Lit').setDepth(y);
    const shadow = sunShadow(add.image(x, y, 'crops_s', frame).setOrigin(ox, oy));
    shadow.setAlpha(SUN_SHADOW_ALPHA * this.daylight);
    const glow = cropById(p.crop)?.glow ? add.image(x, y, 'crops_e', frame).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.1) : null;
    this.crops.set(keyOf(p.x, p.y), { plot: p, sprite, glow, shadow, stage, seed: Math.random() * TWINKLE_MS });
  }

  private drop(k: string): void {
    const c = this.crops.get(k);
    if (!c) return;
    c.sprite.destroy();
    c.glow?.destroy();
    c.shadow.destroy();
    this.crops.delete(k);
  }

  // ---------------------------------------------------------------- Each frame

  update(dt: number, heroX: number, heroY: number, daylight: number): void {
    this.hero.x = heroX;
    this.hero.y = heroY;
    this.daylight = daylight;
    const now = Date.now();
    this.growT -= dt;
    const look = this.growT <= 0;
    if (look) this.growT = GROW_MS;
    const t = this.scene.time.now;
    for (const c of this.crops.values()) {
      if (look) {
        const s = stageOf(c.plot, now);
        if (s !== c.stage) {
          c.stage = s;
          const f = `${c.plot.crop}_${s}`;
          c.sprite.setFrame(f);
          c.shadow.setFrame(f);
          c.glow?.setFrame(f);
          // It comes up with a little rustle of earth; ripening, a burst of its colour.
          if (s === 3) this.sparkle.explode(6, c.sprite.x, c.sprite.y - 8);
        }
      }
      c.shadow.setAlpha(c.stage >= 2 ? SUN_SHADOW_ALPHA * daylight : 0);
      // The magic crops' light breathes, brighter by night.
      if (c.glow) c.glow.setAlpha((0.55 + 0.45 * (1 - daylight)) * (c.stage === 3 ? 0.85 + Math.sin(t * 0.003 + c.seed) * 0.15 : 0.5));
      // Ripe ones twinkle now and then, in their own colour.
      if (c.stage === 3 && (t + c.seed) % TWINKLE_MS < dt) {
        this.sparkle.setParticleTint(cropById(c.plot.crop)?.tint ?? 0xffffff);
        this.sparkle.explode(1, c.sprite.x + (Math.random() - 0.5) * 8, c.sprite.y - 6 - Math.random() * 8);
      }
    }
    // The stoves' and pots' steam.
    this.steamT -= dt;
    if (this.steamT <= 0) {
      this.steamT = 420;
      for (const s of this.stations) this.steam.emitParticleAt(s.steamX + (Math.random() - 0.5) * 3, s.steamY);
    }

    // What E would do here: pick the ripe crops in reach, or cook.
    const busy = build.on;
    const ripe = !busy && this.owner && this.ripeNear().length > 0;
    const station = busy ? null : this.stationNear();
    homeAct.near = ripe ? 'harvest' : station ? 'cook' : '';
    this.showLabel();
    // Walked away from the kitchen: it closes.
    if (this.cooking && Math.hypot(heroX - this.cooking.x, heroY - this.cooking.y) > COOK_LEAVE) {
      this.cooking = null;
      if (keeperCall.open === 'kitchen') keeperCall.leave = true;
    }
  }

  private ripeNear(): Crop[] {
    const out: Crop[] = [];
    for (const c of this.crops.values()) if (c.stage === 3 && Math.hypot(c.sprite.x - this.hero.x, (c.sprite.y - this.hero.y) * 1.2) < PICK_R) out.push(c);
    return out;
  }

  private stationNear(): (typeof this.stations)[number] | null {
    const { x, y } = this.hero;
    for (const s of this.stations) {
      const dx = Math.max(s.x0 - x, 0, x - s.x1);
      const dy = Math.max(s.y0 - y, 0, y - s.y1);
      if (Math.hypot(dx, dy) < COOK_R) return s;
    }
    return null;
  }

  /** Over what E would do, with a keyboard. */
  private showLabel(): void {
    const act = homeAct.near;
    const text = !controls.mouse || !act ? '' : act === 'harvest' ? 'E: HARVEST' : 'E: COOK';
    if (text !== this.labelFor) {
      this.labelFor = text;
      this.label.setText(text).setTint(act === 'harvest' ? 0xc8ff8a : 0xffd08a);
    }
    this.label.setVisible(!!text);
    if (!text) return;
    const s = act === 'cook' ? this.stationNear() : null;
    const x = s ? (s.x0 + s.x1) / 2 : this.hero.x;
    const y = s ? s.y0 - 26 : this.hero.y - 40;
    this.label.setPosition(Math.round(x), Math.round(y + Math.sin(this.scene.time.now * 0.004) * 1.5));
  }

  /** E or the touch button: pick what's ripe in reach, or open the kitchen. True when it did either. */
  act(): boolean {
    if (build.on) return false;
    if (this.owner && this.harvest()) return true;
    const s = this.stationNear();
    if (!s) return false;
    cookHud.station = s.kind;
    keeperCall.want = 'kitchen';
    this.cooking = { x: this.hero.x, y: this.hero.y };
    return true;
  }

  /** Pick every ripe crop in reach: its produce and seeds to the pantry, flying up to the hero as they go. */
  private harvest(): boolean {
    const ripe = this.ripeNear();
    if (!ripe.length) return false;
    const got = new Map<string, number>();
    let tier = 0;
    for (const c of ripe) {
      const def = cropById(c.plot.crop)!;
      const h = rollHarvest(def);
      collection.addStock(cropKey(def.id), h.produce);
      if (h.seeds) collection.addStock(seedKey(def.id), h.seeds);
      got.set(def.id, (got.get(def.id) ?? 0) + h.produce);
      if (def.kind === 'magic') tier = 2;
      else if (def.kind === 'wild') tier = Math.max(tier, 1);
      if (h.stray) {
        collection.addStock(seedKey(h.stray), 1);
        const s = cropById(h.stray)!;
        this.scene.popNumber(Math.round(this.hero.x), Math.round(this.hero.y) - 52, `+${s.name.toUpperCase()} SEED!`, s.tint);
        tier = Math.max(tier, 1);
      }
      this.fly(`crop_${def.id}`, c.sprite.x, c.sprite.y - 6, Math.min(3, h.produce));
      this.sparkle.setParticleTint(def.tint);
      this.sparkle.explode(5, c.sprite.x, c.sprite.y - 6);
      this.dirt.explode(4, c.sprite.x, c.sprite.y);
      // A plant that bears again goes back a way; the rest are pulled up, the bed left open.
      if (def.regrow) {
        c.plot.t = Date.now() - def.grow * (1 - def.regrow);
        c.stage = -1;
      } else {
        this.plots = this.plots.filter((p) => p !== c.plot);
        this.drop(keyOf(c.plot.x, c.plot.y));
      }
    }
    this.growT = 0;
    let line = 0;
    for (const [id, n] of got) {
      const d = cropById(id)!;
      this.scene.popNumber(Math.round(this.hero.x), Math.round(this.hero.y) - 40 - line * 9, `+${n} ${(n > 1 ? d.many : d.one).toUpperCase()}`, d.tint);
      line++;
    }
    sound.harvest(tier);
    this.save();
    return true;
  }

  /** Produce hopping out of the plant and up into the hero's arms. */
  private fly(key: string, x: number, y: number, n: number): void {
    for (let k = 0; k < n; k++) {
      const img = this.scene.add.image(x, y, key).setDepth(20001);
      const dx = (Math.random() - 0.5) * 16;
      const peak = 14 + Math.random() * 8;
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 420 + k * 70,
        delay: k * 60,
        ease: 'Sine.In',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const tx = this.hero.x;
          const ty = this.hero.y - 14;
          img.setPosition(Math.round(x + dx * Math.sin(t * Math.PI) + (tx - x) * t), Math.round(y + (ty - y) * t - Math.sin(t * Math.PI) * peak));
          img.setScale(1 - t * 0.4);
        },
        onComplete: () => img.destroy(),
      });
    }
  }

  destroy(): void {
    for (const k of [...this.crops.keys()]) this.drop(k);
    homeAct.near = '';
    if (keeperCall.open === 'kitchen') keeperCall.leave = true;
  }
}
