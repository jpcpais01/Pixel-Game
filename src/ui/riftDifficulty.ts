// The Endless Rift's difficulties, drawn: each one's button colours and its
// mark (a rune, an ember skull, two blood-red skulls), shared by the world
// map's panel and the run's HUD.

import type Phaser from 'phaser';
import { Bitmap } from '../art/bitmap';
import { hex, type RGB } from '../art/pixel';
import type { RiftDifficulty } from '../game/rift';
import { BUTTON_PLAIN, type PanelStyle } from './widgets';

/** Each difficulty's button: plain violet, embers, and blood. */
export const DIFF_STYLE: Record<RiftDifficulty, [PanelStyle, PanelStyle]> = {
  normal: BUTTON_PLAIN,
  hard: [
    { top: hex('#8a3c16'), bottom: hex('#3a140c'), alpha: 1, border: hex('#c0602a'), borderLit: hex('#ffb070'), outer: hex('#120a08') },
    { top: hex('#2e0f08'), bottom: hex('#6a2a10'), alpha: 1, border: hex('#7a3a18'), borderLit: hex('#c07040'), outer: hex('#120a08') },
  ],
  impossible: [
    { top: hex('#6a0a1c'), bottom: hex('#18040a'), alpha: 1, border: hex('#a8142e'), borderLit: hex('#ff5a6e'), outer: hex('#050102') },
    { top: hex('#120308'), bottom: hex('#4a0814'), alpha: 1, border: hex('#6a0c1c'), borderLit: hex('#b02a3e'), outer: hex('#050102') },
  ],
};

/**
 * The difficulty's mark on its button: a violet rune for Normal, an ember
 * skull for Hard, and for Impossible two blood-red skulls with burning eyes.
 */
export function difficultyIcon(scene: Phaser.Scene, d: RiftDifficulty): string {
  const key = `rift_diff_icon_${d}`;
  if (scene.textures.exists(key)) return key;
  const ink = hex('#0b0818');
  if (d === 'normal') {
    // A diamond rune, lit from the top left.
    const b = new Bitmap(9, 9);
    const rim = hex('#8a78c8');
    const lit = hex('#e0d4ff');
    const core = hex('#4a3a78');
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const r = Math.abs(x - 4) + Math.abs(y - 4);
        if (r === 4) b.set(x, y, ink);
        else if (r === 3) b.set(x, y, x + y < 8 ? lit : rim);
        else if (r <= 2) b.set(x, y, r === 0 ? lit : core);
      }
    }
    scene.textures.addCanvas(key, b.toCanvas());
    return key;
  }
  // A skull, 7x7 inside a one-pixel outline: dome, eye sockets, nose, jaw, teeth.
  const SKULL = ['.#####.', '#######', '#oo#oo#', '#oo#oo#', '###n###', '.#####.', '.#.#.#.'];
  const hard = d === 'hard';
  const bone: RGB = hard ? hex('#ffc890') : hex('#ff6a78');
  const shade: RGB = hard ? hex('#c0703a') : hex('#a01a30');
  const eye: RGB = hard ? hex('#2a0c06') : hex('#ffe36a');
  const skulls = hard ? 1 : 2;
  const b = new Bitmap(skulls * 9 - (skulls - 1), 9);
  for (let k = 0; k < skulls; k++) {
    const ox = k * 8 + 1;
    const cell = (x: number, y: number) => (y >= 0 && y < 7 && x >= 0 && x < 7 ? SKULL[y][x] : '.');
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const c = cell(x, y);
        if (c === '#') b.set(ox + x, y + 1, y >= 5 || x === 6 ? shade : bone);
        else if (c === 'o' || c === 'n') b.set(ox + x, y + 1, c === 'n' ? ink : eye);
        else if ([-1, 0, 1].some((i) => [-1, 0, 1].some((j) => cell(x + i, y + j) !== '.'))) b.set(ox + x, y + 1, ink);
      }
    }
  }
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}

/**
 * Online on the Rift's panel, where there's room only for a small square
 * button: two heroes side by side, a lavender friend behind a gold one.
 */
export function partyIcon(scene: Phaser.Scene): string {
  const key = 'rift_party_icon';
  if (scene.textures.exists(key)) return key;
  // A head and shoulders; the gap under the head becomes the outline of the neck.
  const FIGURE = ['.###.', '.###.', '.....', '.###.', '#####', '#####'];
  const ink = hex('#0b0818');
  const b = new Bitmap(13, 10);
  const figure = (ox: number, oy: number, lit: RGB, mid: RGB, dark: RGB) => {
    const on = (x: number, y: number) => y >= 0 && y < FIGURE.length && x >= 0 && x < 5 && FIGURE[y][x] === '#';
    for (let y = -1; y <= FIGURE.length; y++) {
      for (let x = -1; x <= 5; x++) {
        // Lit from the top left, shaded down the right and along the bottom.
        if (on(x, y)) b.set(ox + x, oy + y, y === 0 || (y === 4 && x === 0) || (x === 1 && y < 2) ? lit : x === 4 || y === 5 || (x === 3 && y < 2) ? dark : mid);
        else if ([-1, 0, 1].some((i) => [-1, 0, 1].some((j) => on(x + i, y + j)))) b.set(ox + x, oy + y, ink);
      }
    }
  };
  figure(1, 1, hex('#e0d4ff'), hex('#9a88d8'), hex('#5a4a98'));
  figure(7, 3, hex('#fff4d6'), hex('#f4cf6a'), hex('#b08a30'));
  scene.textures.addCanvas(key, b.toCanvas());
  return key;
}
