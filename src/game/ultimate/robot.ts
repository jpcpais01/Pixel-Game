import { sound } from '../../audio';
import { SYNTH_CHEST_Y } from '../../art/synth';
import type { Hurtbox } from '../combat';
import type { WorldScene } from '../../scenes/WorldScene';
import { bloom, clamp01, flare, Fx, type Ink } from './ink';
import type { Cast } from './types';

// The Automaton's Specials.
//  - Siege Mode (the Siege Mech): the mech itself does it (Mech.siege),
//    planting its stabilisers and firing both guns for a while.
//  - Swarm Protocol (the Synth): its chest opens and a storm of micro-drones
//    pours out, each hunting a foe near the Synth, zapping it and moving on;
//    when it's over they stream back in. The Hive Queen's are bees.

/** How long the mech stays planted in siege. */
export const SIEGE_MS = 4500;

const SWARM = 26;
const SWARM_MS = 5200;
const SWARM_RANGE = 170;
const SWARM_DAMAGE = 3;
const SWARM_EVERY = 700;
const SWARM_SPEED = 190;
const SWARM_W = 420;
const SWARM_H = 300;

interface Micro {
  x: number;
  y: number;
  vx: number;
  vy: number;
  goal: Hurtbox | null;
  zapT: number;
  /** Out of the chest yet (they pour out one after another). */
  born: number;
  seed: number;
  home: boolean;
}

export class SwarmProtocol extends Fx {
  private g: Ink;
  private micros: Micro[] = [];
  private hive: boolean;
  private buzzT = 0;

  constructor(
    world: WorldScene,
    private c: Cast,
  ) {
    super(world, SWARM_MS);
    this.hive = c.look === 'hive';
    this.g = this.ink(SWARM_W, SWARM_H);
    const h = c.hero;
    for (let i = 0; i < SWARM; i++) {
      const a = Math.random() * Math.PI * 2;
      this.micros.push({ x: h.x, y: h.y - SYNTH_CHEST_Y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40, goal: null, zapT: Math.random() * SWARM_EVERY, born: i * 22, seed: Math.random() * 100, home: false });
    }
    bloom(world, h.x, h.y - SYNTH_CHEST_Y, c.pal.hot, 2.6, 500, h.y + 40);
    flare(world, h.x, h.y - SYNTH_CHEST_Y, 160, c.pal.light, 3, 600);
    sound.servo(world.pan(h.x));
    if (this.hive) sound.buzz(world.pan(h.x));
  }

  protected step(dt: number): void {
    const w = this.world;
    const h = this.c.hero;
    const hx = h.x;
    const hy = h.y - SYNTH_CHEST_Y;
    const s = dt / 1000;
    const ending = this.t > SWARM_MS - 700;
    const foes = w.hurtboxesWhere((b) => b.alive && Math.hypot(b.x - h.x, b.y - h.y) <= SWARM_RANGE);
    const p = this.c.pal;
    const g = this.g.begin(hx, hy, h.y + 60);
    this.buzzT -= dt;
    for (const m of this.micros) {
      if (this.t < m.born || m.home) continue;
      let tx: number;
      let ty: number;
      if (ending) {
        // Streaming home into the chest.
        tx = hx;
        ty = hy;
        if (Math.hypot(tx - m.x, ty - m.y) < 5) {
          m.home = true;
          continue;
        }
      } else {
        if (!m.goal || !m.goal.alive || !foes.includes(m.goal)) m.goal = foes.length ? foes[Math.floor(Math.random() * foes.length)] : null;
        if (m.goal) {
          // Circling the foe it hunts, darting in.
          const a = this.t * 0.008 + m.seed;
          tx = m.goal.x + Math.cos(a) * 7;
          ty = m.goal.y - m.goal.bodyY + Math.sin(a) * 5;
        } else {
          const a = this.t * 0.004 + m.seed;
          tx = hx + Math.cos(a) * (30 + (m.seed % 20));
          ty = hy + Math.sin(a) * (18 + (m.seed % 10));
        }
      }
      // Steer, with a jitter so the swarm seethes.
      const dx = tx - m.x;
      const dy = ty - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-dt / 90);
      m.vx += ((dx / d) * SWARM_SPEED - m.vx) * k + (Math.random() - 0.5) * 30;
      m.vy += ((dy / d) * SWARM_SPEED - m.vy) * k + (Math.random() - 0.5) * 30;
      m.x += m.vx * s;
      m.y += m.vy * s;
      m.zapT -= dt;
      if (!ending && m.goal && m.zapT <= 0 && Math.hypot(m.goal.x - m.x, m.goal.y - m.goal.bodyY - m.y) < 10) {
        m.zapT = SWARM_EVERY;
        m.goal.hurt({ damage: SWARM_DAMAGE, heavy: false, knock: 15, fromX: m.x, fromY: m.y });
        m.goal.slow?.(0.8, 300, p.mid);
        w.debris(p.tints, m.x, m.y, 2, m.goal.y + 10, 'spores');
        if (this.buzzT <= 0) {
          this.buzzT = 160;
          sound.droneZap(w.pan(m.x), this.hive);
        }
        for (let i = 0; i < 4; i++) g.put(m.x + (Math.random() - 0.5) * 6, m.y + (Math.random() - 0.5) * 6, p.core, 0.9);
      }
      this.draw(g, m);
    }
    g.end();
  }

  /** One micro-drone: a white body with a glowing eye and rotor flicker, or a bee with beating wings. */
  private draw(g: Ink, m: Micro): void {
    const p = this.c.pal;
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    const beat = Math.floor((this.t + m.seed * 10) / 45) % 2;
    if (this.hive) {
      // A striped bee, three wide and two tall, wings flickering over it.
      for (const [dx, c] of [[-1, 0xf4c63e], [0, 0x221f32], [1, 0xf4c63e]] as const) {
        g.put(x + dx, y, c);
        g.put(x + dx, y + 1, dx === 0 ? 0x221f32 : 0xc8901e);
      }
      g.put(x - 1 + (m.vx > 0 ? 2 : 0), y, p.hot);
      g.put(x, y - 1 - beat, 0xfff4d0, 0.85);
      g.put(x + 1, y - 1 - beat, 0xfff4d0, 0.6);
      return;
    }
    // A little white drone, its eye lit the way it flies and a rotor flickering over it.
    g.put(x, y, 0xf2f6ff);
    g.put(x + 1, y, 0xd2dae8);
    g.put(x, y + 1, 0xa8b2c4);
    g.put(x + 1, y + 1, 0x8690a4);
    g.put(x + (m.vx > 0 ? 1 : 0), y, p.hot);
    g.put(x - 1 + beat * 3, y - 1, 0xc8d0dc, 0.7);
    // A faint trail.
    g.put(x - Math.sign(m.vx), y - Math.sign(m.vy), p.deep, 0.4 * clamp01(Math.hypot(m.vx, m.vy) / SWARM_SPEED));
  }
}
