import Phaser from 'phaser';
import { sound } from '../audio';
import { CHUNK, type ForestGen } from './forestGen';

// What the Everwood sounds like where the hero stands: a brook is heard
// before it is seen, louder as it nears and from its own side; still water
// brings frogs at night (see audio/ambience.ts, `setWild`). The listener
// looks round on rings a few times a second for the nearest water, only over
// ground the forest has already grown.

/** How often (ms) to listen round again, and how far (px) water is heard. */
const EVERY = 300;
const HEAR = 300;
/** The rings looked over: radii (px), and spokes on each. */
const RINGS = [0, 45, 95, 150, 210, 270];
const SPOKES = 14;

export class ForestSounds {
  private t = 0;
  private last = { stream: -1, streamPan: 0, pond: -1, pondPan: 0 };

  constructor(
    world: Phaser.Scene,
    private gen: ForestGen,
  ) {
    world.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sound.setWild(null));
  }

  update(dt: number, hero: { x: number; y: number }): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = EVERY;
    let stream = Infinity;
    let sx = 0;
    let pond = Infinity;
    let px = 0;
    for (const r of RINGS) {
      // Once water is found on a ring, nothing further out is nearer.
      if (r > stream && r > pond) break;
      const n = r === 0 ? 1 : SPOKES;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r * 0.01;
        const x = hero.x + Math.cos(a) * r;
        const y = hero.y + Math.sin(a) * r * 0.8;
        if (!this.gen.hasFields(Math.floor(x / CHUNK), Math.floor(y / CHUNK))) continue;
        const h = this.gen.sample(x, y);
        // The fields say how deep inside the water a spot is: a little inside counts as its edge.
        if (h.stream > 0 && r < stream) {
          stream = r;
          sx = x - hero.x;
        }
        if (h.pond > 0 && r < pond) {
          pond = r;
          px = x - hero.x;
        }
      }
    }
    const near = (d: number) => (d === Infinity ? 0 : Math.max(0, 1 - d / HEAR));
    const w = { stream: near(stream), streamPan: Phaser.Math.Clamp(sx / 160, -1, 1), pond: near(pond), pondPan: Phaser.Math.Clamp(px / 160, -1, 1) };
    const l = this.last;
    if (Math.abs(w.stream - l.stream) < 0.02 && Math.abs(w.pond - l.pond) < 0.02 && Math.abs(w.streamPan - l.streamPan) < 0.05 && Math.abs(w.pondPan - l.pondPan) < 0.05) return;
    this.last = w;
    sound.setWild(w);
  }
}
