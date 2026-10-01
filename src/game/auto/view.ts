// How Auto Battle draws its heroes: a piece on the board or bench (UnitView),
// and a whole fight played out from the sim (FightView), which steps the
// Battle on its fixed tick, moves each hero between cells, plays its moves,
// and hands every blow and spell to the effects layer.

import Phaser from 'phaser';
import { classById, type CharacterDef } from '../characters';
import { lookById, worn } from '../skins';
import { ultFor } from '../ultimate';
import type { Pal } from '../ultimate/ink';
import { pixelText } from '../../ui/widgets';
import { sound } from '../../audio';
import { Battle, COLS, ROWS, TICK, type SimEvent, type SimUnit } from './sim';
import { unitDef, type Missile, type Spell } from './units';
import { FxLayer, type Pt } from './fx';
import { kitFor } from './kits';
import { CELL, type Cast, type Move } from './paint';

/** How big each star level stands. */
const STAR_SCALE = [1, 1, 1.1, 1.2];
/** HP bar size, and how far over the feet it floats. */
const BAR_W = 16;
const BAR_Y = -31;
/** Sound effects at most this often (s), so a big fight doesn't roar. */
const SOUND_GAP = 0.05;
/** A ghost (a copy of another player's board, fought by the odd one out): pale and see-through, cold at the head
 * and fading to deep blue at the feet, breathing in and out, an afterimage drifting off it, wisps rising. */
const GHOST_TINT = { head: 0xc8e8ff, feet: 0x5a78d8 };
const GHOST_ALPHA = 0.68;
const GHOST_WISPS = 4;

/** A hero's look, its Special's palette and name, by piece key and look id. */
export interface Styled {
  ch: CharacterDef;
  pal: Pal;
  ult: string;
}

const styles = new Map<string, Styled>();

export function styleOf(key: string, look: string): Styled {
  const id = `${key}/${look}`;
  let s = styles.get(id);
  if (!s) {
    const def = unitDef(key);
    const cls = classById(def.cls);
    const type = cls.types.find((t) => t.id === def.type) ?? cls.types[0];
    const found = lookById(cls, look);
    const ch = worn(cls, found && found.type === type ? found : { type, skin: null });
    const u = ultFor(ch);
    s = { ch, pal: u.pal, ult: u.name };
    styles.set(id, s);
  }
  return s;
}

export type Dir = 'down' | 'up' | 'left' | 'right';

export const dirOf = (dx: number, dy: number, fallback: Dir): Dir => {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
};

/** One hero piece, drawn standing at its feet. */
export class UnitView extends Phaser.GameObjects.Container {
  readonly style: Styled;
  readonly sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Sprite | null = null;
  private shadow: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private bars: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Image[] = [];
  private tex: string;
  dir: Dir;
  /** A move playing (the idle and walk wait for it). */
  private busy = false;
  private moving = false;
  /** Lift off the ground (a leap), in px. */
  lift = 0;
  flashT = 0;
  private ghost = false;
  private echo: Phaser.GameObjects.Sprite | null = null;
  private wisps: Phaser.GameObjects.Graphics | null = null;
  private ghostT = 0;

  constructor(
    scene: Phaser.Scene,
    readonly key: string,
    look: string,
    readonly star: number,
    /** Bar colour: the player's own heroes green, the rival's red. */
    readonly mine: boolean,
    dir: Dir = 'up',
  ) {
    super(scene, 0, 0);
    this.style = styleOf(key, look);
    const pv = this.style.ch.preview;
    this.tex = pv.texture;
    this.dir = dir;
    this.ring = scene.add.graphics();
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(0.9, 0.8).setAlpha(0.75);
    this.sprite = scene.add.sprite(0, 0, pv.texture).setOrigin(0.5, pv.originY ?? 31 / 32);
    this.add([this.ring, this.shadow, this.sprite]);
    if (pv.glow) {
      this.glow = scene.add.sprite(0, 0, pv.glow).setOrigin(0.5, pv.originY ?? 31 / 32).setBlendMode(Phaser.BlendModes.ADD);
      this.add(this.glow);
    }
    this.bars = scene.add.graphics();
    this.add(this.bars);
    const sc = STAR_SCALE[star] ?? 1;
    this.sprite.setScale(sc);
    this.glow?.setScale(sc);
    this.drawRing();
    for (let i = 0; i < star; i++) {
      const s = scene.add.image(0, 0, star === 3 ? 'ab_star3' : star === 2 ? 'ab_star2' : 'ab_star').setOrigin(0);
      this.stars.push(s);
      this.add(s);
    }
    this.layoutStars(BAR_Y * sc - 6);
    this.idle();
    scene.add.existing(this);
  }

  /** A ring under the feet shows the star level: none, silver, gold. */
  private drawRing(): void {
    const g = this.ring.clear();
    if (this.star < 2) return;
    const col = this.star === 3 ? 0xffc94a : 0xb8c8ff;
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      g.fillStyle(col, i % 2 ? 0.5 : 0.9).fillRect(Math.round(Math.cos(t) * 8), Math.round(Math.sin(t) * 4) + 1, 1, 1);
    }
  }

  private layoutStars(y: number): void {
    const w = this.stars.length * 5 - 1;
    this.stars.forEach((s, i) => s.setPosition(Math.round(-w / 2) + i * 5, Math.round(y)));
  }

  private anim(name: string): string | null {
    const key = `${this.tex}_${name}_${this.dir}`;
    if (this.scene.anims.exists(key)) return key;
    const down = `${this.tex}_${name}_down`;
    return this.scene.anims.exists(down) ? down : null;
  }

  idle(): void {
    this.moving = false;
    if (this.busy) return;
    const k = this.anim('idle');
    if (k && this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k);
  }

  walk(): void {
    this.moving = true;
    if (this.busy) return;
    const k = this.anim('walk') ?? this.anim('move') ?? this.anim('idle');
    if (k && this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k);
  }

  /** Play a one-off move, then go back to standing or walking. */
  act(name: string, speed = 1): void {
    const k = this.anim(name) ?? this.anim(unitDef(this.key).attack[0]);
    if (!k) return;
    this.busy = true;
    this.sprite.play({ key: k, timeScale: speed });
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.busy = false;
      if (this.moving) this.walk();
      else this.idle();
    });
  }

  /** Face a way, keeping whatever move is playing (from the same frame). */
  face(d: Dir): void {
    if (d === this.dir) return;
    this.dir = d;
    const cur = this.sprite.anims.currentAnim;
    if (!cur) return;
    const move = cur.key.slice(this.tex.length + 1, cur.key.lastIndexOf('_'));
    const k = this.anim(move);
    if (!k || k === cur.key) return;
    const frame = this.sprite.anims.currentFrame?.index ?? 1;
    const next = this.scene.anims.get(k);
    const at = Math.max(0, Math.min(next.frames.length - 1, frame - 1));
    const busy = this.busy;
    this.sprite.play({ key: k, startFrame: at, timeScale: this.sprite.anims.timeScale });
    this.busy = busy;
  }

  /** The victory pose, looping back to idle. */
  cheer(): void {
    const pv = this.style.ch.preview;
    if (!this.scene.anims.exists(pv.chosen)) return;
    this.busy = true;
    this.sprite.play(pv.chosen);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.busy = false;
      this.idle();
    });
  }

  setBars(hp: number, max: number, shield: number, mana: number, maxMana: number): void {
    const g = this.bars.clear();
    const sc = STAR_SCALE[this.star] ?? 1;
    const y = Math.round(BAR_Y * sc);
    const x = -BAR_W / 2;
    const total = Math.max(max, hp + shield);
    g.fillStyle(0x0b0818, 0.9).fillRect(x - 1, y - 1, BAR_W + 2, 5);
    const hw = Math.round((hp / total) * BAR_W);
    const sw = Math.round((shield / total) * BAR_W);
    g.fillStyle(this.mine ? 0x5ad07a : 0xff5a5a, 1).fillRect(x, y, hw, 2);
    g.fillStyle(this.mine ? 0xa8f0b8 : 0xffa8a8, 1).fillRect(x, y, hw, 1);
    if (sw > 0) g.fillStyle(0xf4f0ff, 1).fillRect(x + hw, y, Math.min(sw, BAR_W - hw), 2);
    // Tick marks every so much HP, so bigger heroes read bigger.
    const step = total > 3000 ? 1000 : 250;
    for (let v = step; v < total; v += step) g.fillStyle(0x0b0818, 0.6).fillRect(x + Math.round((v / total) * BAR_W), y, 1, 2);
    const mw = Math.round((Math.min(mana, maxMana) / maxMana) * BAR_W);
    g.fillStyle(0x1a2a5a, 1).fillRect(x, y + 2, BAR_W, 1);
    g.fillStyle(mana >= maxMana ? 0xbff4ff : 0x4aa6ff, 1).fillRect(x, y + 2, mw, 1);
  }

  hideBars(): void {
    this.bars.clear();
  }

  /** Make this hero a ghost: see-through and cold, with an afterimage and wisps (see `tick`). */
  setGhost(): this {
    if (this.ghost) return this;
    this.ghost = true;
    // Each ghost breathes at its own time, so a board of them doesn't pulse as one.
    this.ghostT = Math.random() * 7;
    this.echo = this.scene.add
      .sprite(0, 0, this.sprite.texture.key, this.sprite.frame.name)
      .setOrigin(this.sprite.originX, this.sprite.originY)
      .setScale(this.sprite.scaleX)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x4a8cff);
    this.addAt(this.echo, this.getIndex(this.sprite));
    this.wisps = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.wisps);
    this.shadow.setAlpha(0.3);
    this.ghostLook();
    return this;
  }

  private ghostLook(): void {
    const { head, feet } = GHOST_TINT;
    this.sprite.setTint(head, head, feet, feet);
    this.glow?.setTint(0x9ad8ff);
  }

  tick(dt: number): void {
    if (this.glow) this.glow.setFrame(this.sprite.frame.name);
    this.sprite.y = -this.lift;
    if (this.glow) this.glow.y = -this.lift;
    this.shadow.setScale(0.9 - this.lift * 0.02, 0.8 - this.lift * 0.02);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.sprite.setTintFill(0xffffff);
      if (this.flashT <= 0) {
        this.sprite.clearTint();
        if (this.ghost) this.ghostLook();
      }
    }
    if (this.ghost) this.haunt(dt);
  }

  /** A ghost's life: it breathes, hovers a little, trails an afterimage, and wisps rise off it. */
  private haunt(dt: number): void {
    const t = (this.ghostT += dt);
    const breath = Math.sin(t * 2.4);
    const hover = Math.round(Math.sin(t * 1.7) * 1.2) - 1;
    this.sprite.y = -this.lift + hover;
    if (this.glow) this.glow.y = this.sprite.y;
    this.sprite.setAlpha(GHOST_ALPHA + breath * 0.08);
    const echo = this.echo!;
    echo.setTexture(this.sprite.texture.key, this.sprite.frame.name).setFlipX(this.sprite.flipX);
    // The afterimage lags up and to one side, swaying, and fades as it drifts.
    echo.setPosition(Math.round(Math.sin(t * 1.1) * 2), this.sprite.y - 2 - Math.round((breath + 1) * 0.8));
    echo.setAlpha(0.22 + (1 - breath) * 0.06);
    const g = this.wisps!.clear();
    for (let i = 0; i < GHOST_WISPS; i++) {
      const k = (t * 0.45 + i / GHOST_WISPS) % 1;
      const x = Math.round(Math.sin(t * 1.9 + i * 2.3) * (3 + k * 4));
      const y = Math.round(-2 - k * 30);
      const a = (1 - k) * 0.55;
      g.fillStyle(0xbfe4ff, a).fillRect(x, y, 1, 1);
      if (k < 0.5) g.fillStyle(0x6aa8ff, a * 0.6).fillRect(x, y + 1, 1, 1);
    }
  }

  /** Dim (a piece that can't be placed, a fallen hero). */
  setDim(on: boolean): void {
    if (on) this.sprite.setTint(0x6a6488);
    else if (this.ghost) this.ghostLook();
    else this.sprite.clearTint();
    this.glow?.setAlpha(on ? 0.3 : 1);
  }
}

/** Where the board sits and how its cells map to px. */
export interface BoardFrame {
  x: number;
  y: number;
  cw: number;
  ch: number;
  /** Seen from the top side's end (a guest online sees its own heroes at the bottom). */
  flip: boolean;
}

/** A cell's feet, in px, as this player sees the board. */
export function cellPt(f: BoardFrame, c: number, r: number): Pt {
  const vc = f.flip ? COLS - 1 - c : c;
  const vr = f.flip ? ROWS - 1 - r : r;
  return { x: f.x + vc * f.cw + f.cw / 2, y: f.y + vr * f.ch + Math.round(f.ch * 0.7) };
}

/** The whole fight, drawn. */
export class FightView {
  readonly views: UnitView[];
  private acc = 0;
  private soundT = 0;
  private leaping = new Set<number>();
  onEvent?: (e: SimEvent) => void;

  constructor(
    private scene: Phaser.Scene,
    readonly battle: Battle,
    private frame: BoardFrame,
    private layer: Phaser.GameObjects.Container,
    private fx: FxLayer,
    /** The side that is this player's own. */
    private mySide: 0 | 1,
    /** A side fought as ghosts (a copy of another player's board), if any. */
    ghostSide = -1,
  ) {
    fx.focus(frame.x, frame.y);
    this.views = battle.units.map((u) => {
      const v = new UnitView(scene, u.def.key, u.look, u.star, u.side === mySide, u.side === mySide ? 'up' : 'down');
      if (u.side === ghostSide) v.setGhost();
      layer.add(v);
      return v;
    });
    this.place(0);
  }

  private pt(u: SimUnit, sub = 0): Pt {
    const p = Battle.pos(u, sub);
    const f = this.frame;
    const vc = f.flip ? COLS - 1 - p.x : p.x;
    const vr = f.flip ? ROWS - 1 - p.y : p.y;
    return { x: f.x + vc * f.cw + f.cw / 2, y: f.y + vr * f.ch + Math.round(f.ch * 0.7) };
  }

  /** The way a hero faces, as this player sees it. */
  private facing(u: SimUnit): Dir {
    const s = this.frame.flip ? -1 : 1;
    return dirOf(u.lookC * s, u.lookR * s, u.side === this.mySide ? 'up' : 'down');
  }

  update(dt: number): void {
    this.soundT -= dt;
    this.acc += dt;
    while (this.acc >= TICK && !this.battle.over) {
      this.acc -= TICK;
      for (const e of this.battle.step()) this.handle(e);
    }
    this.place(this.battle.over ? 0 : this.acc / TICK);
  }

  private place(sub: number): void {
    this.battle.units.forEach((u, i) => {
      const v = this.views[i];
      if (!v.active) return;
      const p = this.pt(u, sub);
      v.setPosition(Math.round(p.x), Math.round(p.y));
      v.setDepth(p.y);
      const stepping = u.step < u.stepDur;
      if (this.leaping.has(u.uid)) {
        const k = u.stepDur > 0 ? Math.min(1, (u.step + sub) / u.stepDur) : 1;
        v.lift = Math.sin(k * Math.PI) * 14;
        if (!stepping) {
          this.leaping.delete(u.uid);
          v.lift = 0;
        }
      }
      if (u.alive) {
        v.face(this.facing(u));
        if (stepping && !this.leaping.has(u.uid)) v.walk();
        else v.idle();
        v.setBars(u.hp, u.maxHp, u.shield, u.mana, u.maxMana);
      }
      v.tick(1 / 60);
    });
    this.layer.sort('depth');
  }

  private sfx(play: () => void): void {
    if (this.soundT > 0) return;
    this.soundT = SOUND_GAP;
    try {
      play();
    } catch {
      // A sound that fails is no reason to stop the fight.
    }
  }

  /** A hero's own look for its ability or Special, if its kit has one. */
  private move(u: SimUnit, ult: boolean): Move | undefined {
    const kit = kitFor(u.def.key);
    return ult ? kit.ult : kit.skill;
  }

  private castOf(u: SimUnit, s: Spell, from: Pt, at: Pt, hits: Pt[], path: Pt[], lead: number): Cast {
    const st = styleOf(u.def.key, u.look);
    return { from, at, hits, path, r: (s.r ?? 1) * CELL, pal: st.pal, look: u.look, lead, span: s.delay ?? 1.2, stun: s.stun ?? 0 };
  }

  private unitPt(uid: number): Pt {
    return this.pt(this.battle.units[uid]);
  }

  private handle(e: SimEvent): void {
    this.onEvent?.(e);
    try {
      this.draw(e);
    } catch (err) {
      // The fight goes on even if a look fails to start.
      console.warn('Auto Battle effect failed', err);
    }
  }

  private draw(e: SimEvent): void {
    const units = this.battle.units;
    switch (e.t) {
      case 'attack': {
        const u = units[e.u];
        const v = this.views[e.u];
        v.face(this.facing(u));
        v.act(e.anim, 1.3);
        const st = styleOf(u.def.key, u.look);
        const a = this.unitPt(e.u);
        const b = this.unitPt(e.to);
        const kit = kitFor(u.def.key);
        if (e.missile) {
          if (kit.shot) kit.shot(this.fx, a, b, e.land * TICK, st.pal);
          else this.fx.missile(a, b, e.land * TICK, u.def.missile as Missile, st.pal);
          this.sfx(() => missileSound(u.def.missile as Missile));
        } else {
          const heavy = u.def.attack.length > 1 && u.swing % u.def.attack.length === 0;
          this.scene.time.delayedCall(e.land * TICK * 1000, () => {
            if (!this.views[e.to]?.active) return;
            const at = this.unitPt(e.to);
            const from = this.unitPt(e.u);
            if (kit.melee) kit.melee(this.fx, at, from, st.pal, heavy);
            else this.fx.slash(at, from, st.pal, heavy);
          });
          this.sfx(() => swingSound(u.def.cls));
        }
        break;
      }
      case 'cast': {
        const u = units[e.u];
        const v = this.views[e.u];
        const st = styleOf(u.def.key, u.look);
        v.face(this.facing(u));
        v.act(e.spell.anim, 1.1);
        const at = this.pt({ ...u, c: e.x, r: e.y, fc: e.x, fr: e.y, step: 1, stepDur: 1 } as SimUnit);
        const move = this.move(u, e.ult);
        if (move) move.cast?.(this.fx, this.castOf(u, e.spell, this.unitPt(e.u), at, [], [], e.land * TICK));
        else {
          this.fx.gather(this.unitPt(e.u), st.pal, e.ult ? 0.75 : 0.45, e.ult);
          if (e.spell.kind === 'blast' && e.spell.delay) this.fx.telegraph(at, (e.spell.r ?? 1) * 18, st.pal, e.land * TICK);
        }
        if (e.ult) {
          this.callout(v, st.ult, st.pal.hot);
          this.sfx(() => sound.ultRelease());
        } else this.sfx(() => sound.cast());
        break;
      }
      case 'spell': {
        const u = units[e.u];
        const st = styleOf(u.def.key, u.look);
        const at = this.pt({ ...u, c: e.x, r: e.y, fc: e.x, fr: e.y, step: 1, stepDur: 1 } as SimUnit);
        const move = this.move(u, e.ult);
        // A leap or dash has already set off; its look starts where it set off from.
        const from = e.spell.kind === 'leap' || e.spell.kind === 'dash' ? this.pt({ ...u, c: u.fc, r: u.fr, step: 1, stepDur: 1 } as SimUnit) : this.unitPt(e.u);
        if (move) {
          move.hit(
            this.fx,
            this.castOf(
              u,
              e.spell,
              from,
              at,
              e.hits.map((h) => this.unitPt(h)),
              (e.path ?? []).map((h) => this.unitPt(h)),
              0,
            ),
          );
        } else this.fx.spell({
          fx: e.spell.fx,
          kind: e.spell.kind,
          from: this.unitPt(e.u),
          at,
          r: e.spell.r ?? 1,
          pal: st.pal,
          hits: e.hits.map((h) => this.unitPt(h)),
          path: (e.path ?? []).map((h) => this.unitPt(h)),
          big: e.ult,
          span: e.spell.delay ?? 1.2,
        });
        // Kits shake the view themselves, on their big moments.
        if (!move && e.spell.kind !== 'mend') this.scene.cameras.main.shake(e.ult ? 140 : 70, e.ult ? 0.004 : 0.002);
        this.sfx(() => (e.spell.kind === 'mend' ? sound.heal() : e.ult ? sound.blast() : sound.impact(0, true)));
        break;
      }
      case 'hit': {
        const v = this.views[e.u];
        if (!v?.active) break;
        v.flashT = 0.06;
        const col = e.crit ? 0xffd35c : e.spell ? 0x9ad8ff : e.by >= 0 && units[e.by].side === this.mySide ? 0xfff4d6 : 0xffa8a8;
        this.number(this.unitPt(e.u), e.crit ? `${e.amt}!` : `${e.amt}`, col, e.crit);
        break;
      }
      case 'heal':
        this.number(this.unitPt(e.u), `+${e.amt}`, 0x7aff8a, false);
        break;
      case 'miss':
        this.number(this.unitPt(e.u), 'miss', 0xb8a8e8, false);
        break;
      case 'leap':
        this.leaping.add(e.u);
        this.fx.afterimage(this.pt({ ...units[e.u], c: e.fc, r: e.fr, fc: e.fc, fr: e.fr, step: 1, stepDur: 1 } as SimUnit), styleOf(units[e.u].def.key, units[e.u].look).pal);
        break;
      case 'stun':
        this.fx.stun(() => (units[e.u].alive ? this.unitPt(e.u) : null), e.sec);
        break;
      case 'die': {
        const u = units[e.u];
        const v = this.views[e.u];
        this.fx.death(this.unitPt(e.u), styleOf(u.def.key, u.look).pal);
        v.hideBars();
        v.setDim(true);
        this.scene.tweens.add({ targets: v, alpha: 0, duration: 500, delay: 150 });
        this.sfx(() => sound.monsterDie(0, 0.6));
        break;
      }
      default:
        break;
    }
  }

  /** A number rising off a hero. */
  number(p: Pt, text: string, tint: number, big: boolean): void {
    const t = pixelText(this.scene, 0, 0, text, tint).setOrigin(0.5, 1).setScale(big ? 1 : 1);
    t.setPosition(Math.round(p.x + (Math.random() - 0.5) * 8), Math.round(p.y - 30));
    t.setDepth(10000);
    this.layer.add(t);
    this.scene.tweens.add({ targets: t, y: t.y - (big ? 14 : 10), duration: 620, ease: 'Cubic.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 380, duration: 260, onComplete: () => t.destroy() });
  }

  /** A Special's name over its caster. */
  private callout(v: UnitView, name: string, tint: number): void {
    const t = pixelText(this.scene, 0, 0, name, tint).setOrigin(0.5, 1);
    t.setPosition(Math.round(v.x), Math.round(v.y - 40));
    t.setDepth(10001);
    this.layer.add(t);
    this.scene.tweens.add({ targets: t, y: t.y - 8, duration: 900, ease: 'Cubic.Out' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 800, duration: 300, onComplete: () => t.destroy() });
  }

  /** The winners' cheer at the end. */
  cheer(): void {
    this.battle.units.forEach((u, i) => {
      const v = this.views[i];
      if (u.alive && v.active) {
        v.hideBars();
        v.cheer();
      }
    });
  }

  destroy(): void {
    for (const v of this.views) v.destroy();
  }
}

function missileSound(m: Missile): void {
  switch (m) {
    case 'arrow':
      return sound.bowShot();
    case 'fire':
    case 'firebolt':
      return sound.fireball();
    case 'soul':
      return sound.soulCast();
    case 'lance':
      return sound.soulCast(0, true);
    case 'note':
      return sound.lutePluck();
    case 'hand':
    case 'shard':
      return sound.chronoCast();
    case 'flask':
    case 'chem':
    case 'junk':
      return sound.toss();
    case 'bullet':
      return sound.cannon();
    case 'drone':
      return sound.droneZap();
    case 'spark':
      return sound.tesla();
    case 'feather':
      return sound.feather();
    case 'thread':
      return sound.twang();
    default:
      return sound.cast();
  }
}

function swingSound(cls: string): void {
  switch (cls) {
    case 'jedi':
      return sound.saberSwing(1);
    case 'samurai':
      return sound.katana();
    case 'rogue':
      return sound.knife();
    case 'beast':
      return sound.rake();
    case 'bard':
      return sound.drumBeat();
    case 'inventor':
      return sound.wrench();
    case 'fighter':
      return sound.clash();
    default:
      return sound.swing(1);
  }
}
