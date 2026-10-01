import Phaser from 'phaser';
import { textureSteps } from '../art/textures';
import { lazyHeroSheets, warmHeroSheetsLater } from '../art/heroLoader';
import { CLASSES } from '../game/characters';
import { lastHero, lastLookOf, worn } from '../game/skins';
import { buildPixelFont } from '../art/font';
import { registerGemArt } from '../art/shop';
import { registerCandyArt } from '../art/candy';

/** The loading screen in index.html, while it's up. */
declare global {
  interface Window {
    bootLoader?: { progress(p: number): void; done(): void };
  }
}

/** Time spent building per frame: short enough that the loading screen keeps moving, long enough to finish fast. */
const BUDGET_MS = 28;
/** How many steps the textures took last time, remembered so the bar is right from the start. */
const STEPS_KEY = 'pixel-battle.bootSteps';
const GUESS_STEPS = 80;

function lastSteps(): number {
  try {
    return Number(localStorage.getItem(STEPS_KEY)) || GUESS_STEPS;
  } catch {
    return GUESS_STEPS;
  }
}

/**
 * Generates every texture from code, a slice each frame so the loading
 * screen stays alive and its bar follows the real work, then opens the home
 * screen.
 */
export class BootScene extends Phaser.Scene {
  private steps: Generator<void, void, void> | null = null;
  private done = 0;
  private total = GUESS_STEPS;

  constructor() {
    super('boot');
  }

  create(): void {
    buildPixelFont(this);
    // The heroes are built by workers once the home screen has settled (see
    // startHeroWarm), the looks each class wears first (the hero select shows
    // them all), the last one played before those. Until then a look is built
    // when it's first shown.
    lazyHeroSheets(this);
    const last = lastHero();
    const classes = [...CLASSES].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0));
    warmHeroSheetsLater(this.game, [
      ...classes.map((c) => worn(c).preview.texture),
      ...classes.flatMap((c) => c.types.map((t) => worn(c, lastLookOf(c, t)).preview.texture)),
    ]);
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
      // Not remembered; the bar guesses next time.
    }
    registerGemArt(this);
    registerCandyArt(this);
    // No arena is built here: each is built on the way into it (the menus
    // warm the last one's ground; painted ones have loading screens).
    window.bootLoader?.progress(1);
    this.scene.start('home');
    this.scene.launch('sound');
    this.scene.launch('fps');
  }
}
