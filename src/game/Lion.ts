import { BEAST_MOUTH_Y, BEAST_TIMING } from '../art/beast';
import { snap } from './display';
import { sound } from '../audio';
import { HitSpark, Shockwave } from './Slash';
import { clamp01, easeOut, Fx, pal, type Ink, type Pal } from './ultimate/ink';
import { Beast, ClawMarks, type BeastKit } from './Beast';
import type { WorldScene } from '../scenes/WorldScene';
import { HERO_STATS } from './stats';

// The Lion (the Beastkin's second type): broad, golden and hard to put down.
//  - Attack (held): Claws, in a chain of three: a raking swipe from each paw,
//    then a pounce that brings both down and throws foes back.
//  - Ability: Roar. The ground shakes with it: foes round him are struck,
//    thrown back and cowed (they move and fight at half pace for a while).
//  - Special: King's Roar (see ultimate/beast.ts). Three roars, each wider
//    than the last, and a great spirit lion roaring over him.

const CHAIN = ['claw', 'claw2', 'maul'] as const;
type Blow = (typeof CHAIN)[number];
const BLOW_MS: Record<Blow, number> = { claw: BEAST_TIMING.claw.ms, claw2: BEAST_TIMING.claw.ms, maul: BEAST_TIMING.maul.ms };
const BLOW_LAND: Record<Blow, number> = { claw: BEAST_TIMING.claw.land, claw2: BEAST_TIMING.claw.land, maul: BEAST_TIMING.maul.land };
const CLAW_DAMAGE = 9;
const MAUL_DAMAGE = 16;
const CLAW_REACH = 21;
const MAUL_R = 16;
/** The pounce carries him forward this far before it lands. */
const POUNCE = 12;
const COMBO_WINDOW = 520;

const ROAR_MS = BEAST_TIMING.roar.ms;
const ROAR_LAND = BEAST_TIMING.roar.land;
const ROAR_COOLDOWN = 8000;
const ROAR_R = 46;
const ROAR_DAMAGE = 10;
const ROAR_KNOCK = 200;
/** Cowed: foes move and fight at this pace for this long. */
const COW = 0.5;
const COW_MS = 2000;

const lionStats = HERO_STATS['beast.lion'];

export const LION_KIT: BeastKit = {
  key: 'lion',
  kind: 'lion',
  maxHp: lionStats.hp,
  speed: lionStats.speed,
  pal: pal(0xfffbe8, 0xffe08a, 0xf0a830, 0xa8581a, 0xffc860),
  fx: { core: 0xfffbe8, hot: 0xffe08a, mid: 0xf0a830, deep: 0xa8581a, light: 0xffc860 },
  club: false,
};

/** Sporting: the lion in green and white hoops, a brighter golden coat, his roar green. */
export const SPORTING_KIT: BeastKit = {
  ...LION_KIT,
  key: 'lion_sporting',
  pal: pal(0xf4fff4, 0xb8ffc8, 0x2ed070, 0x0a7038, 0x60f090),
  fx: { core: 0xf4fff4, hot: 0xb8ffc8, mid: 0x2ed070, deep: 0x0a7038, light: 0x60f090 },
  club: true,
};

export class Lion extends Beast {
  private step = 0;
  private lastBlowAt = -99999;
  private roarCd = 0;

  constructor(world: WorldScene, x: number, y: number, kit: BeastKit = LION_KIT) {
    super(world, x, y, kit);
  }

  protected tick(dt: number): void {
    this.roarCd = Math.max(0, this.roarCd - dt);
  }

  protected attack(): void {
    const chain = this.step > 0 && this.step < 3 && this.clock - this.lastBlowAt <= COMBO_WINDOW + BLOW_MS.claw;
    this.step = chain ? this.step + 1 : 1;
    this.lastBlowAt = this.clock;
    const b = CHAIN[this.step - 1];
    this.begin(b, b, BLOW_MS[b], BLOW_LAND[b]);
    sound.swing(this.step, this.world.pan(this.x));
  }

  protected ability(): void {
    if (this.roarCd > 0) return;
    this.roarCd = ROAR_COOLDOWN;
    this.step = 0;
    this.begin('roar', 'roar', ROAR_MS, ROAR_LAND);
  }

  protected paceIn(move: string): number {
    return move === 'roar' ? 0 : move === 'maul' ? 0 : 0.45;
  }

  protected during(move: string, dt: number): void {
    // The pounce: a bound forward up to the moment the paws come down.
    if (move === 'maul' && this.moveT <= BLOW_LAND.maul) {
      const u = this.aimVec();
      this.shove(u.x, u.y, (POUNCE * dt) / BLOW_LAND.maul);
    }
  }

  protected readiness(): number {
    return 1 - this.roarCd / ROAR_COOLDOWN;
  }

  protected combo(): { hits: number; max: number; window: number } {
    const since = this.clock - this.lastBlowAt;
    return { hits: this.step, max: 3, window: this.step === 0 ? 0 : this.step < 3 ? Math.max(0, 1 - since / (COMBO_WINDOW + BLOW_MS.claw)) : Math.max(0, 1 - since / 700) };
  }

  protected lampLevel(): number {
    return this.move === 'roar' ? 0.8 : 0;
  }

  protected land(move: string): void {
    if (move === 'roar') this.roar();
    else this.strike(move as Blow);
  }

  /** The claws connect: a raking swipe, or the pounce's two paws slamming down. */
  private strike(b: Blow): void {
    const w = this.world;
    const u = this.aimVec();
    const cx = this.x;
    const cy = this.y - 12;
    const k = this.kit;
    if (b === 'maul') {
      const bx = cx + u.x * 12;
      const by = cy + u.y * 10;
      this.fx.push(new Shockwave(w, snap(bx), snap(this.y + u.y * 10), MAUL_R + 2, k.fx));
      const hits = w.melee({ kind: 'circle', x: bx, y: by, radius: MAUL_R }, { damage: MAUL_DAMAGE, heavy: true, knock: 170 });
      for (const h of hits) this.fx.push(new HitSpark(w, h.x, h.y, k.fx, h.y + 13, true));
      this.fx.push(new ClawMarks(w, bx - u.y * 3, by + u.x * 3, Math.atan2(u.y, u.x) + Math.PI / 2 + 0.3, 7, k.pal, snap(this.y) + 2));
      this.fx.push(new ClawMarks(w, bx + u.y * 3, by - u.x * 3, Math.atan2(u.y, u.x) + Math.PI / 2 - 0.3, 7, k.pal, snap(this.y) + 2));
      w.debris([0xa4703c, 0x7a4c26, 0xd8c8a0], bx, by + 10, 8, by + 20, 'burst');
      sound.rake(w.pan(bx), true);
      if (hits.length) w.cameras.main.shake(120, 0.0006);
      return;
    }
    // The swipe rakes across the aim: right paw one way, left paw back.
    const a = Math.atan2(u.y, u.x);
    const across = a + (b === 'claw' ? 1 : -1) * (Math.PI / 2 + 0.5);
    this.fx.push(new ClawMarks(w, cx + u.x * 13, cy + u.y * 10, across, 9, k.pal, snap(this.y) + 2));
    const hits = w.melee({ kind: 'arc', x: cx, y: cy, radius: CLAW_REACH, angle: a, spread: (100 * Math.PI) / 180 }, { damage: CLAW_DAMAGE, knock: 70 });
    for (const h of hits) {
      this.fx.push(new HitSpark(w, h.x, h.y, k.fx, h.y + 13, false));
      sound.rake(w.pan(h.x), false);
    }
    if (hits.length) w.cameras.main.shake(70, 0.0003);
  }

  /** The roar: foes round him struck, thrown back and cowed. */
  private roar(): void {
    const w = this.world;
    const hits = w.hurtboxesWhere((h) => h.alive && Math.hypot(h.x - this.x, (h.y - this.y) / 0.75) <= ROAR_R + h.radius);
    for (const h of hits) {
      h.hurt({ damage: ROAR_DAMAGE, heavy: true, knock: ROAR_KNOCK, fromX: this.x, fromY: this.y });
      h.slow?.(COW, COW_MS, this.kit.pal.mid);
    }
    this.fx.push(new RoarWaves(w, this.x, this.y, ROAR_R, this.kit.pal, 1));
    this.fx.push(new Shockwave(w, snap(this.x), snap(this.y), ROAR_R * 0.6, this.kit.fx));
    w.debris([0xa4703c, 0x7a4c26, 0xd8c8a0], this.x, this.y, 12, this.y + 10, 'burst');
    w.cameras.main.shake(260, 0.0009);
    sound.roar(w.pan(this.x), false);
  }
}

/**
 * A roar made visible: arcs of sound rolling out from the mouth in every
 * direction, broken like ripples, and the ground's dust thrown up under them.
 * `waves` rings follow one another out.
 */
export class RoarWaves extends Fx {
  private g: Ink;

  constructor(
    world: WorldScene,
    private x: number,
    private y: number,
    private r: number,
    private p: Pal,
    private waves: number,
  ) {
    super(world, 520 + waves * 90);
    this.g = this.ink(Math.ceil(r * 2 + 16), Math.ceil(r * 1.6 + 30));
  }

  protected step(): void {
    const { x, r, p } = this;
    const my = this.y - BEAST_MOUTH_Y * 0.5;
    const g = this.g.begin(x, my, this.y + 30);
    for (let n = 0; n < this.waves + 2; n++) {
      const k = clamp01((this.t - n * 90) / 460);
      if (k <= 0 || k >= 1) continue;
      const rr = 6 + (r - 6) * easeOut(k);
      const a = 1 - k;
      // Broken arcs, so they read as sound and not a solid ring.
      for (let i = 0; i < 72; i++) {
        const ang = (i / 72) * Math.PI * 2;
        if (((i + n * 5) % 12) < 3) continue;
        const px = x + Math.cos(ang) * rr;
        const py = my + Math.sin(ang) * rr * 0.72;
        g.put(px, py, n === 0 ? p.core : n === 1 ? p.hot : p.mid, a);
        if (k < 0.5) g.put(px, py + 1, p.mid, a * 0.6);
      }
    }
    g.end();
  }
}
