import Phaser from 'phaser';
import { sound } from '../audio';
import { snap } from './display';
import type { WorldScene } from '../scenes/WorldScene';

// The Automaton's heat: every shot and every ability warms it, and it cools
// once it stops. Past HOT it runs hot and hits harder; at the top it
// overheats: the engine vents, blasting steam that scalds everything close,
// and it stalls a moment (it can't attack, and it walks slowly) while the heat
// bleeds away. Riding just under the red line is the art of it. A small gauge
// under its feet shows how hot it is.

export const HEAT_MAX = 100;
/** Past this share of the gauge it runs hot: its blows hit harder. */
export const HOT = 0.7;
export const HOT_DAMAGE = 1.25;
/** Cooling: this long after the last heat, then this much a second. */
const COOL_AFTER = 450;
const COOL_RATE = 34;
/** The vent: how long it stalls, and the steam's reach and bite. */
export const VENT_MS = 1100;
const VENT_RADIUS = 34;
const VENT_DAMAGE = 14;

const BAR_W = 18;

export class Heat {
  value = 0;
  /** Stalled, venting: ms left. */
  stall = 0;
  private quiet = 0;
  private bar: Phaser.GameObjects.Graphics;
  private clock = 0;

  constructor(
    private world: WorldScene,
    private owner: { x: number; y: number },
  ) {
    this.bar = world.add.graphics().setDepth(10001);
  }

  get overheated(): boolean {
    return this.stall > 0;
  }

  get hot(): boolean {
    return this.value >= HEAT_MAX * HOT && !this.overheated;
  }

  /** How hard its blows land right now. */
  get power(): number {
    return this.hot ? HOT_DAMAGE : 1;
  }

  /** Warm it by `n`: overheats (venting) if that tops the gauge. */
  add(n: number): void {
    if (this.overheated) return;
    this.value = Math.min(HEAT_MAX, this.value + n);
    this.quiet = 0;
    if (this.value >= HEAT_MAX) this.vent();
  }

  private vent(): void {
    this.stall = VENT_MS;
    const w = this.world;
    const { x, y } = this.owner;
    const hits = w.melee({ kind: 'circle', x, y: y - 8, radius: VENT_RADIUS }, { damage: VENT_DAMAGE, heavy: true, knock: 150, fromX: x, fromY: y });
    for (const h of hits) w.debris([0xffffff, 0xffc890, 0xff8a4a], h.x, h.y, 5, h.y + 12, 'spores');
    w.debris([0xffffff, 0xe6ecf4, 0xc8d0dc, 0xa8b0bc], snap(x), snap(y) - 14, 34, y + 20, 'burst');
    w.debris([0xffffff, 0xe6ecf4, 0xc8d0dc], snap(x), snap(y) - 10, 20, y + 20, 'spores');
    w.cameras.main.shake(160, 0.0008);
    sound.vent();
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.stall > 0) {
      this.stall = Math.max(0, this.stall - dt);
      this.value = HEAT_MAX * (this.stall / VENT_MS);
      // Steam keeps wisping off it while it stalls.
      if (Math.floor(this.clock / 90) !== Math.floor((this.clock - dt) / 90)) {
        const { x, y } = this.owner;
        this.world.debris([0xffffff, 0xe6ecf4, 0xc8d0dc], snap(x + (Math.random() - 0.5) * 16), snap(y) - 18 - Math.random() * 8, 1, y + 20, 'spores');
      }
    } else {
      this.quiet += dt;
      if (this.quiet > COOL_AFTER) this.value = Math.max(0, this.value - (COOL_RATE * dt) / 1000);
    }
    this.draw();
  }

  /** The gauge under its feet: amber rising to red, pulsing when it runs hot; hidden when cold. */
  private draw(): void {
    const g = this.bar.clear();
    const k = this.value / HEAT_MAX;
    if (k <= 0.01) return;
    const x = snap(this.owner.x) - BAR_W / 2;
    const y = snap(this.owner.y) + 3;
    g.fillStyle(0x0b0818, 0.85).fillRect(x - 1, y - 1, BAR_W + 2, 4);
    const pulse = this.hot || this.overheated ? 0.6 + 0.4 * Math.sin(this.clock * 0.02) : 1;
    const color = this.overheated ? 0xf0f4ff : k >= HOT ? 0xff4a2a : k > 0.4 ? 0xff9a2a : 0xffc860;
    g.fillStyle(color, pulse).fillRect(x, y, Math.max(1, Math.round(BAR_W * k)), 2);
    // A tick at the red line.
    g.fillStyle(0xfff4d6, 0.7).fillRect(x + Math.round(BAR_W * HOT), y - 1, 1, 4);
  }

  destroy(): void {
    this.bar.destroy();
  }
}
