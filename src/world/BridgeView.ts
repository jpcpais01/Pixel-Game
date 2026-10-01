import Phaser from 'phaser';
import { paintBridge } from '../art/bridgeArt';
import { pixelCanvas } from '../art/canvas';
import type { Bridges, Span } from './bridge';

// The bridges built (see bridge.ts) stood up in a world, the Everwood's or a
// Home's: each bridge's deck one picture lying just over the ground, and its
// rails in pieces a cell long that sort by their feet, so a hero on the deck
// walks in front of the far rail and behind the near one.

/** The deck lies over the ground and the flat things on it (rugs, lily pads), under every shadow and body. */
const DECK_DEPTH = 1.6;

let made = 0;

export class BridgeView {
  private shown = new Map<string, { objs: Phaser.GameObjects.Image[]; keys: string[] }>();

  /** `ox`, `oy`: where the grid's corner is in the world. */
  constructor(
    private scene: Phaser.Scene,
    private ox = 0,
    private oy = 0,
  ) {}

  /** Show these bridges: new or changed ones painted and stood up, ones gone taken down. */
  sync(b: Bridges): void {
    const want = new Set(b.spans.map((s) => s.key));
    for (const [k, v] of this.shown) {
      if (want.has(k)) continue;
      this.drop(v);
      this.shown.delete(k);
    }
    for (const s of b.spans) if (!this.shown.has(s.key)) this.shown.set(s.key, this.stand(b, s));
  }

  private stand(b: Bridges, s: Span): { objs: Phaser.GameObjects.Image[]; keys: string[] } {
    const art = paintBridge(b, s);
    const textures = this.scene.textures;
    const id = made++;
    const keys: string[] = [];
    const objs: Phaser.GameObjects.Image[] = [];
    const texture = (diffuse: Uint8ClampedArray, normal: Uint8ClampedArray): string => {
      const key = `bridge${id}_${keys.length}`;
      textures.addCanvas(key, pixelCanvas(art.w, art.h, diffuse))!.setDataSource(pixelCanvas(art.w, art.h, normal));
      keys.push(key);
      return key;
    };
    const x = this.ox + art.x;
    const y = this.oy + art.y;
    objs.push(this.scene.add.image(x, y, texture(art.deck.diffuse, art.deck.normal)).setOrigin(0).setPipeline('Lit').setDepth(DECK_DEPTH));
    for (const r of art.rails) {
      const key = texture(r.layer.diffuse, r.layer.normal);
      const t = textures.get(key);
      r.pieces.forEach((p, i) => {
        t.add(`p${i}`, 0, p.x, p.y, p.w, p.h);
        objs.push(this.scene.add.image(x + p.x, y + p.y, key, `p${i}`).setOrigin(0).setPipeline('Lit').setDepth(this.oy + p.depth));
      });
    }
    return { objs, keys };
  }

  private drop(v: { objs: Phaser.GameObjects.Image[]; keys: string[] }): void {
    for (const o of v.objs) o.destroy();
    for (const k of v.keys) this.scene.textures.remove(k);
  }

  destroy(): void {
    for (const v of this.shown.values()) this.drop(v);
    this.shown.clear();
  }
}
