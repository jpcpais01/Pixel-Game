// A door or gate on its hinges (art/homeDoor.ts, art/homeGate.ts): it swings
// open for any hero walking up to it, this player's or a friend's online (so
// everyone sees the same), and shuts behind them once they've gone. The swing
// is a spring: it overshoots a touch opening, and knocks against its frame
// and bounces a little shutting. Used by the Home and the Everwood alike.

import type Phaser from 'phaser';
import { DOOR_OPEN, DOOR_STEP, DOOR_STEPS } from '../art/homeDoor';
import { gateFrame, gateFrameSize } from '../art/homeGate';
import { sound } from '../audio';
import { CELL } from './homeLayout';
import { WALLS } from './homeParts';

/** A hero opens it within this far of its middle, across its wall and along it, px. */
const REACH = 24;
const SIDE = 13;
/** It stays open this long after the last hero has gone, ms, then swings shut behind them. */
const HOLD = 450;
/** The spring: stiffness (per s^2) and damping (per s), and how much it bounces back off the frame. */
const STIFF = 85;
const DAMP = 9.5;
const BOUNCE = 0.28;
/** Shutting faster than this (degrees a second) knocks; its sounds carry this far, px. */
const KNOCK = 140;
const HEAR = 220;

/** What it sounds like: a house door, a wooden gate, or an iron one. */
export type SwingKind = 'door' | 'gate' | 'iron';

/** The ways it can swing: through an east-west wall north or south, through a north-south one east or west. */
export type SwingWay = 'n' | 's' | 'e' | 'w';

export class Swing {
  deg = 0;
  private vel = 0;
  private hold = 0;
  private step = -1;
  private shown: SwingWay;

  /**
   * At (x, y), the middle of its doorway or gap, `across` an east-west wall
   * or not. A door swings `way` always (into its house); a gate (`free`)
   * swings away from whoever opens it. `show` puts up the frame for a way
   * and a step.
   */
  constructor(
    public x: number,
    public y: number,
    public across: boolean,
    public way: SwingWay,
    private kind: SwingKind,
    private free: boolean,
    private show: (way: SwingWay, step: number) => void,
  ) {
    this.shown = way;
    this.show(way, 0);
    this.step = 0;
  }

  /** A door's way changed (its house did): shown at once. */
  setWay(way: SwingWay): void {
    if (way === this.way) return;
    this.way = way;
    this.step = -1;
  }

  /** `heroes` open it; `ear` is this player's hero, who hears it. */
  update(dt: number, heroes: readonly { x: number; y: number }[], ear: { x: number; y: number }): void {
    const s = Math.min(dt, 50) / 1000;
    let near: { x: number; y: number } | null = null;
    let best = 1;
    for (const h of heroes) {
      const a = this.across ? h.x - this.x : h.y - this.y;
      const b = this.across ? h.y - this.y : h.x - this.x;
      const k = (a / SIDE) ** 2 + (b / REACH) ** 2;
      if (k < best) {
        best = k;
        near = h;
      }
    }
    if (near) {
      // A gate shut (or nearly) turns to open away from the one walking up.
      if (this.free && this.deg < 2) this.way = this.across ? (near.y > this.y ? 'n' : 's') : near.x < this.x ? 'e' : 'w';
      this.hold = HOLD;
    } else this.hold = Math.max(0, this.hold - dt);
    const want = this.hold > 0 ? DOOR_OPEN : 0;
    const pan = Math.max(-1, Math.min(1, (this.x - ear.x) / 160));
    const heard = Math.hypot(this.x - ear.x, this.y - ear.y) < HEAR;
    if (want > 0 && this.deg < 1 && this.vel <= 0 && heard) {
      if (this.kind === 'door') sound.doorOpen(pan);
      else sound.gateOpen(pan, this.kind === 'iron');
    }
    this.vel += (STIFF * (want - this.deg) - DAMP * this.vel) * s;
    this.deg += this.vel * s;
    if (this.deg < 0) {
      // Against the frame: a knock (a gate's latch drops) if it came hard, and a little bounce back.
      if (this.vel < -KNOCK && heard) {
        const level = Math.min(1, -this.vel / 400);
        if (this.kind === 'door') sound.doorShut(pan, level);
        else sound.gateShut(pan, level, this.kind === 'iron');
      }
      this.deg = -this.deg * BOUNCE;
      this.vel = -this.vel * BOUNCE;
      if (this.vel < 20) this.deg = this.vel = 0;
    }
    const max = (DOOR_STEPS - 1) * DOOR_STEP;
    if (this.deg > max) {
      this.deg = max;
      this.vel = Math.min(0, this.vel);
    }
    const step = Math.round(this.deg / DOOR_STEP);
    if (step !== this.step || this.way !== this.shown) {
      this.step = step;
      this.shown = this.way;
      this.show(this.way, step);
    }
  }
}

/**
 * A gate in the gap of a garden wall of material `mat` on the cell at (x, y)
 * (its top-left corner), `across` an east-west wall or not. It swings away
 * from whoever walks up to it, drawn behind its wall swinging north, in front
 * of it swinging south, and at its hinge in a north-south wall, so heroes
 * pass it the right side.
 */
export function hangGate(scene: Phaser.Scene, mat: number, x: number, y: number, across: boolean): { sprite: Phaser.GameObjects.Sprite; swing: Swing } {
  const { ox, oy } = gateFrameSize(mat);
  const way: SwingWay = across ? 'n' : 'e';
  const sprite = scene.add.sprite(x - ox, y - oy, 'home', gateFrame(mat, way, 0)).setOrigin(0).setPipeline('Lit');
  const swing = new Swing(x + CELL / 2, y + CELL / 2, across, way, WALLS[mat].id === 'lowwall' ? 'iron' : 'gate', true, (w, step) => {
    sprite.setFrame(gateFrame(mat, w, step));
    sprite.setDepth(y + (w === 'n' ? 7.9 : w === 's' ? 11.05 : 2.5));
  });
  return { sprite, swing };
}
