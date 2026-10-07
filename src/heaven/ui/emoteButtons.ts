// The emote buttons on Heaven Lands' play HUD, where Myths has its ability
// buttons: wave, cheer, dance, sit and a heart. On a touch screen they fan
// round the bottom-right corner under the thumb; with a mouse they're a small
// row in that corner, with their keys (4 to 8) on them.

import Phaser from 'phaser';
import { DPR as D } from '../../game/display';
import { controls } from '../../game/controls';
import type { CozyHud } from '../../game/cozy';
import { EMOTES, emoteHud, type Emote } from '../Wanderer';

/** The fan's reach from the corner, in button radii of the old ability buttons. */
const FAN = 2.05;
/** ms a pressed button stays sunk. */
const PRESS_MS = 160;
const FILL = 0x2a1f33;
const RING = 0xffe2b0;
const LIT = 0xffc861;

/** Five 12 x 12 icons: a waving hand, a burst, a note, a cushion, a heart. */
const ICONS: Record<Emote, string[]> = {
  wave: ['.....w.w....', '....w.ww.w..', '...ww.ww.ww.', '...ww.ww.ww.', '.w.wwwwwwww.', '.wwwwwwwwww.', '..wwwwwwwww.', '..wwwwwwww..', '...wwwwwww..', '....wwwww...', '....wwwww...', '............'],
  cheer: ['.....y......', '.y...y...y..', '..y..y..y...', '...y.w.y....', '....www.....', 'yyywwwwwyyy.', '....www.....', '...y.w.y....', '..y..y..y...', '.y...y...y..', '.....y......', '............'],
  dance: ['......wwwww.', '......wwwww.', '......w...w.', '......w...w.', '......w...w.', '......w...w.', '...www..www.', '..wwwww.www.', '..wwwww.....', '...www......', '............', '............'],
  sit: ['............', '............', '...pppppp...', '..pppppppp..', '.pppwppwppp.', '.pppppppppp.', '.pppwppwppp.', '..pppppppp..', '...pppppp...', '..y......y..', '............', '............'],
  heart: ['............', '..rr...rr...', '.rrrr.rrrr..', 'rrwrrrrrrrr.', 'rwrrrrrrrrr.', 'rrrrrrrrrrr.', '.rrrrrrrrr..', '..rrrrrrr...', '...rrrrr....', '....rrr.....', '.....r......', '............'],
};
const PAL: Record<string, string> = { w: '#fff6e4', y: '#ffd66b', p: '#f2a8c4', r: '#ff7aa2' };

function iconArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('hl_emoteicons')) return;
  const tex = scene.textures.createCanvas('hl_emoteicons', 12 * EMOTES.length, 12)!;
  const g = tex.getContext();
  EMOTES.forEach((e, i) => {
    ICONS[e].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (!PAL[ch]) return;
        g.fillStyle = PAL[ch];
        g.fillRect(i * 12 + x, y, 1, 1);
      }),
    );
    tex.add(e, 0, i * 12, 0, 12, 12);
  });
  tex.refresh();
}

export class EmoteButtons implements CozyHud {
  private scene: Phaser.Scene;
  private g: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[];
  private keys: Phaser.GameObjects.BitmapText[];
  private pressed = new Map<Emote, number>();
  private drawn = '';
  private hidden = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    iconArt(scene);
    this.g = scene.add.graphics();
    this.icons = EMOTES.map((e) => scene.add.image(0, 0, 'hl_emoteicons', e));
    this.keys = EMOTES.map((_e, i) => scene.add.bitmapText(0, 0, 'pixel', `${i + 4}`).setOrigin(0.5, 0).setTint(0xffe9c8));
    const kb = scene.input.keyboard;
    if (kb) {
      const onKey = (ev: KeyboardEvent) => {
        const i = Number(ev.key) - 4;
        if (i >= 0 && i < EMOTES.length && !this.hidden) this.press(EMOTES[i]);
      };
      kb.on('keydown', onKey);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
    }
  }

  private get R(): number {
    const { width, height } = this.scene.scale;
    return Math.max(42 * D, Math.min(width, height) * 0.13);
  }

  /** Each button's centre and radius. */
  private spots(): { x: number; y: number; r: number }[] {
    const { width, height } = this.scene.scale;
    const R = this.R;
    if (controls.mouse) {
      const r = Math.round(R * 0.3);
      const gap = Math.round(r * 0.6);
      return EMOTES.map((_e, i) => ({ x: width - 14 * D - r - (EMOTES.length - 1 - i) * (r * 2 + gap), y: height - 16 * D - r, r }));
    }
    const cx = width - R * 0.55;
    const cy = height - R * 0.55;
    const r = Math.round(R * 0.4);
    return EMOTES.map((_e, i) => {
      const a = Math.PI + (i / (EMOTES.length - 1)) * (Math.PI / 2);
      return { x: Math.round(cx + Math.cos(a) * R * FAN), y: Math.round(cy + Math.sin(a) * R * FAN), r };
    });
  }

  private press(e: Emote): void {
    emoteHud.want = e;
    this.pressed.set(e, this.scene.time.now);
  }

  pointerDown(p: Phaser.Input.Pointer): boolean {
    if (this.hidden) return false;
    const spots = this.spots();
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      if (Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) <= s.r * 1.15) {
        this.press(EMOTES[i]);
        return true;
      }
    }
    return false;
  }

  update(_dt: number, hidden: boolean): void {
    this.hidden = hidden;
    const now = this.scene.time.now;
    const spots = this.spots();
    const sunk = EMOTES.map((e) => now - (this.pressed.get(e) ?? -1e9) < PRESS_MS);
    const state = `${hidden} ${controls.mouse} ${emoteHud.playing} ${sunk.join()} ${spots.map((s) => `${s.x},${s.y},${s.r}`).join(' ')}`;
    for (const o of [...this.icons, ...this.keys]) o.setVisible(!hidden);
    this.g.setVisible(!hidden);
    if (hidden || state === this.drawn) return;
    this.drawn = state;
    const g = this.g.clear();
    spots.forEach((s, i) => {
      const e = EMOTES[i];
      const on = emoteHud.playing === e;
      const r = sunk[i] ? s.r * 0.9 : s.r;
      g.fillStyle(FILL, on ? 0.7 : 0.45);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(2 * D, on ? LIT : RING, on ? 0.95 : 0.6);
      g.strokeCircle(s.x, s.y, r);
      const scale = Math.max(1, Math.floor((r * 1.25) / 12));
      this.icons[i].setPosition(s.x, s.y).setScale(sunk[i] ? Math.max(1, scale - 1) || scale : scale);
      const k = this.keys[i];
      k.setVisible(controls.mouse).setScale(Math.max(1, Math.floor(r / 14))).setPosition(s.x, s.y + r + 2 * D);
    });
  }
}
