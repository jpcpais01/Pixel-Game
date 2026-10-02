// The Aquanaut's textures beside his hero sheets (see heroSheets.ts): the
// harpoon in flight and stuck in the ground ('harpoon_<look>': headings
// 'r0'..'r15', stuck 'k0'..'k2'), the steam torpedo ('torpedo_<look>':
// heading and propeller frame 't<heading>_<spin>'), and his two button icons
// ('icon_harpoon', 'icon_reel', with '_barnacle' for the skin). Kept out of
// aquanaut.ts so the rig stays free of Phaser for the sheet worker.

import type Phaser from 'phaser';
import { packAtlas, registerAtlas } from './atlas';
import { pixelCanvas } from './canvas';
import {
  AQUANAUT_LOOKS,
  HARPOON_DIRS,
  HARPOON_SIZE,
  TORPEDO_DIRS,
  TORPEDO_SIZE,
  TORPEDO_SPIN,
  harpoonFrame,
  harpoonIcon,
  reelIcon,
  stuckHarpoonFrame,
  torpedoFrame,
} from './aquanaut';

export function registerAquanautArt(scene: Phaser.Scene): void {
  for (const look of AQUANAUT_LOOKS) {
    const harpoons = [
      ...Array.from({ length: HARPOON_DIRS }, (_, i) => ({ name: `r${i}`, r: harpoonFrame(i, look).render() })),
      ...[0, 1, 2].map((k) => ({ name: `k${k}`, r: stuckHarpoonFrame(k, look).render() })),
    ];
    registerAtlas(scene, `harpoon_${look.key}`, packAtlas(harpoons, HARPOON_SIZE, HARPOON_SIZE), HARPOON_SIZE, HARPOON_SIZE);
    const torpedoes = [];
    for (let i = 0; i < TORPEDO_DIRS; i++) for (let s = 0; s < TORPEDO_SPIN; s++) torpedoes.push({ name: `t${i}_${s}`, r: torpedoFrame(i, s, look).render() });
    registerAtlas(scene, `torpedo_${look.key}`, packAtlas(torpedoes, TORPEDO_SIZE, TORPEDO_SIZE), TORPEDO_SIZE, TORPEDO_SIZE);
    const sfx = look.barnacle ? '_barnacle' : '';
    scene.textures.addCanvas(`icon_harpoon${sfx}`, pixelCanvas(16, 16, harpoonIcon(look)));
    scene.textures.addCanvas(`icon_reel${sfx}`, pixelCanvas(16, 16, reelIcon(look)));
  }
}
