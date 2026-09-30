// The six stat icons (heart, sword, boot, shield, speed, mend), shared by the
// hero select's card and the in-game stats panel (ui/statsHud.ts).

import Phaser from 'phaser';
import { Bitmap } from '../art/bitmap';
import { hex } from '../art/pixel';

/** Six 9x9 stat icons in a row (heart, sword, boot, shield, speed, mend), each with a dark outline. */
export const STAT_ICON = 9;

export function statIconsTexture(scene: Phaser.Scene): string {
  const key = 'sel_stat_icons';
  if (scene.textures.exists(key)) return key;
  const ICONS: { art: string[]; main: string; lit: string }[] = [
    { art: ['.##.##.', '#++####', '#+#####', '#######', '.#####.', '..###..', '...#...'], main: '#e8465a', lit: '#ffb0b8' },
    { art: ['.....++', '....+#+', '...+#+.', '#.+#+..', '.##+...', '.##....', '#..#...'], main: '#c8c4e0', lit: '#ffffff' },
    { art: ['..###..', '..#+#..', '..#+#..', '..#+##.', '.#+++##', '.######', '.##.###'], main: '#b07a44', lit: '#f0c088' },
    { art: ['#######', '#+++++#', '#+####+', '.#+###.', '.#+###.', '..#+#..', '...#...'], main: '#5a9ae8', lit: '#b8dcff' },
    { art: ['+..+...', '.#..#..', '..#..#.', '...#..#', '..#..#.', '.#..#..', '+..+...'], main: '#f4cf6a', lit: '#fff4c0' },
    { art: ['..###..', '..#+#..', '###+###', '#+++++#', '###+###', '..#+#..', '..###..'], main: '#3cc878', lit: '#b8ffd0' },
  ];
  const b = new Bitmap(STAT_ICON * ICONS.length, STAT_ICON);
  const outline = hex('#0b0818');
  ICONS.forEach(({ art, main, lit }, i) => {
    const ox = i * STAT_ICON + 1;
    const filled = (x: number, y: number) => art[y]?.[x] !== undefined && art[y][x] !== '.';
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) b.set(ox + x, 1 + y, outline);
      }
    art.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && b.set(ox + x, 1 + y, hex(ch === '+' ? lit : main))));
  });
  const tex = scene.textures.addCanvas(key, b.toCanvas());
  ICONS.forEach((_icon, i) => tex?.add(i, 0, i * STAT_ICON, 0, STAT_ICON, STAT_ICON));
  return key;
}
