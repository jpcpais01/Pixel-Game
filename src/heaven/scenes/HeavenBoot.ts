// Heaven Lands' boot: every texture built from code a slice a frame behind
// the loading screen, as Myths' BootScene does, without warming the old
// game's heroes (Heaven Lands has only the wanderer, built when first shown).

import Phaser from 'phaser';
import { textureSteps } from '../../art/textures';
import { lazyHeroSheets } from '../../art/heroLoader';
import { buildPixelFont } from '../../art/font';
import { registerGemArt } from '../../art/shop';

/** Time spent building per frame. */
const BUDGET_MS = 28;
const STEPS_KEY = 'heaven-lands.bootSteps';
const GUESS_STEPS = 80;

function lastSteps(): number {
  try {
    return Number(localStorage.getItem(STEPS_KEY)) || GUESS_STEPS;
  } catch {
    return GUESS_STEPS;
  }
}

export class HeavenBoot extends Phaser.Scene {
  private steps: Generator<void, void, void> | null = null;
  private done = 0;
  private total = GUESS_STEPS;

  constructor() {
    super('boot');
  }

  create(): void {
    buildPixelFont(this);
    // Anything that asks for an old hero's sheet gets it built then, never ahead.
    lazyHeroSheets(this);
    this.steps = textureSteps(this);
    this.done = 0;
    this.total = lastSteps();
    window.bootLoader?.progress(0.02);
  }

  update(): void {
    if (!this.steps) return;
    const until = performance.now() + BUDGET_MS;
    while (performance.now() < until) {
      if (this.steps.next().done) {
        this.steps = null;
        this.finish();
        return;
      }
      this.done++;
    }
    window.bootLoader?.progress(0.02 + 0.9 * Math.min(0.99, this.done / this.total));
  }

  private finish(): void {
    try {
      localStorage.setItem(STEPS_KEY, String(this.done));
    } catch {
      // The bar guesses next time.
    }
    registerGemArt(this);
    window.bootLoader?.progress(1);
    this.scene.start('home');
    this.scene.launch('sound');
    this.scene.launch('fps');
  }
}
