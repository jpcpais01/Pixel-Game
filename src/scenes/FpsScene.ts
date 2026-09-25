import Phaser from 'phaser';
import { CELL_H } from '../art/font';
import { DPR, pixelGrid } from '../game/display';
import { settings } from '../game/settings';
import { pixelText } from '../ui/widgets';

/** Device pixels per font pixel for the counter. */
const fpsScale = () => Math.max(1, Math.round(DPR * 1.5));
const fpsTop = () => Math.round(6 * DPR);

/** Bottom edge of the counter in device pixels, so menus can keep clear of it. */
export const fpsBottom = () => fpsTop() + CELL_H * fpsScale();

/** WebGL1's GPU timer, where the browser offers it (desktop mostly). */
interface TimerExt {
  TIME_ELAPSED_EXT: number;
  QUERY_RESULT_EXT: number;
  QUERY_RESULT_AVAILABLE_EXT: number;
  GPU_DISJOINT_EXT: number;
  createQueryEXT(): WebGLQuery;
  deleteQueryEXT(q: WebGLQuery): void;
  beginQueryEXT(target: number, q: WebGLQuery): void;
  endQueryEXT(target: number): void;
  getQueryObjectEXT(q: WebGLQuery, pname: number): number | boolean;
}

/**
 * A small frame-rate counter at the top centre of the screen, over every
 * scene. Beside the frame rate it shows how long each frame's update and
 * render take on the CPU, averaged: when that is far below the frame's
 * length (16.7 ms at 60 FPS), the screen's refresh rate is what caps the
 * frame rate, not the game.
 *
 * With the profiler on it adds a breakdown: update and render time on the
 * CPU, GPU time (measured, or else the wait for the GPU to finish), the
 * fastest and slowest frame intervals (a fastest of 16-17 MS means the
 * screen refreshes at 60 Hz), draw calls, lights, live particles, and the
 * canvas size and scale.
 */
export class FpsScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.BitmapText;
  private since = 0;
  private frames = 0;
  private stepStart = 0;
  private renderStart = 0;
  private update_ = 0;
  private render_ = 0;
  private worst = 0;
  private best = Infinity;
  private draws = 0;
  private gpu = 0;
  private gpuFrames = 0;
  /** The GPU test: each layer's cost, measured by turning it off. */
  private bench: { steps: [string, (() => () => void) | null][]; i: number; at: number; restore: (() => void) | null } | null = null;
  private benchDone = false;
  private benchWait = 0;
  private benchTime = 0;
  private benchFrames = 0;
  private benchGpu = 0;
  private results: string[] = [];

  constructor() {
    super('fps');
  }

  create(): void {
    this.cameras.main.setOrigin(0, 0).setZoom(fpsScale());
    this.text = pixelText(this, 0, 0, '-- FPS', 0xdfe6ff).setAlpha(0.85).setCenterAlign();
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);

    const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl as WebGLRenderingContext | undefined;
    const unhook = gl ? this.countDraws(gl) : () => {};
    const timer = gl ? (gl.getExtension('EXT_disjoint_timer_query') as TimerExt | null) : null;
    const pending: WebGLQuery[] = [];
    const pixel = new Uint8Array(4);
    let query: WebGLQuery | null = null;

    const events = this.game.events;
    const start = () => {
      this.stepStart = performance.now();
    };
    const preRender = () => {
      this.renderStart = performance.now();
      this.update_ += this.renderStart - this.stepStart;
      if (timer && !query && settings.values.profiler && pending.length < 4) {
        query = timer.createQueryEXT();
        timer.beginQueryEXT(timer.TIME_ELAPSED_EXT, query);
      }
    };
    const end = () => {
      this.render_ += performance.now() - this.renderStart;
      this.frames++;
      const interval = this.game.loop.rawDelta;
      this.benchTime += interval;
      this.benchFrames++;
      if (interval < 1000) this.worst = Math.max(this.worst, interval);
      this.best = Math.min(this.best, interval);
      if (gl && !timer && settings.values.profiler) {
        // No GPU timer (most phones): read back one pixel, which has to wait
        // until the GPU has drawn the whole frame, and time that wait. It
        // stalls the pipeline a little, so only here.
        const t = performance.now();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        this.gpu += performance.now() - t;
        this.benchGpu += performance.now() - t;
        this.gpuFrames++;
      }
      if (timer && gl) {
        if (query) {
          timer.endQueryEXT(timer.TIME_ELAPSED_EXT);
          pending.push(query);
          query = null;
        }
        const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT) as boolean;
        while (pending.length && timer.getQueryObjectEXT(pending[0], timer.QUERY_RESULT_AVAILABLE_EXT)) {
          const q = pending.shift()!;
          if (!disjoint) {
            const ms = (timer.getQueryObjectEXT(q, timer.QUERY_RESULT_EXT) as number) / 1e6;
            this.gpu += ms;
            this.benchGpu += ms;
            this.gpuFrames++;
          }
          timer.deleteQueryEXT(q);
        }
      }
    };
    events.on(Phaser.Core.Events.PRE_STEP, start);
    events.on(Phaser.Core.Events.PRE_RENDER, preRender);
    events.on(Phaser.Core.Events.POST_RENDER, end);
    const off = settings.watch((s) => {
      this.text.setVisible(s.showFps);
      if (!s.profiler) {
        this.stopBench();
        this.results = [];
        this.benchDone = false;
      }
      this.since = 1e9;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      unhook();
      this.stopBench();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this);
      events.off(Phaser.Core.Events.PRE_STEP, start);
      events.off(Phaser.Core.Events.PRE_RENDER, preRender);
      events.off(Phaser.Core.Events.POST_RENDER, end);
    });
  }

  /** Count the renderer's draw calls; returns the unhook. */
  private countDraws(gl: WebGLRenderingContext): () => void {
    const arrays = gl.drawArrays;
    const elements = gl.drawElements;
    gl.drawArrays = (...args: Parameters<typeof arrays>) => {
      this.draws++;
      arrays.apply(gl, args);
    };
    gl.drawElements = (...args: Parameters<typeof elements>) => {
      this.draws++;
      elements.apply(gl, args);
    };
    return () => {
      gl.drawArrays = arrays;
      gl.drawElements = elements;
    };
  }

  update(_time: number, dt: number): void {
    this.runBench(dt);
    this.since += dt;
    if (this.since < 500) return;
    this.since = 0;
    const n = Math.max(1, this.frames);
    const fps = Math.round(this.game.loop.actualFps);
    const upd = this.update_ / n;
    const rnd = this.render_ / n;
    let text = `${fps} FPS  ${(upd + rnd).toFixed(1)} MS`;
    if (settings.values.profiler) {
      const gpu = this.gpuFrames ? `${(this.gpu / this.gpuFrames).toFixed(1)}` : '--';
      const world = this.scene.get('world');
      let lights = '--';
      let particles = 0;
      if (world && this.scene.isActive('world')) {
        lights = `${world.lights.visibleLights}/${world.lights.lights.length}`;
        for (const obj of world.children.list) {
          if (obj instanceof Phaser.GameObjects.Particles.ParticleEmitter) particles += obj.getAliveParticleCount();
        }
      }
      const { width, height } = this.scale;
      text +=
        `\nUPD ${upd.toFixed(1)}  RND ${rnd.toFixed(1)}  GPU ${gpu}` +
        `\nFRAMES ${Math.round(this.best)}-${Math.round(this.worst)} MS  DRAWS ${Math.round(this.draws / n)}` +
        `\nLIGHTS ${lights}  PARTS ${particles}` +
        `\n${width}X${height} X${DPR.toFixed(2)} Z${pixelGrid.zoom} ${settings.values.quality.toUpperCase()}`;
      if (this.bench) text += `\nTESTING ${this.bench.i + 1}/${this.bench.steps.length} - STAND STILL`;
      if (this.results.length) text += '\nFRAME/GPU MS WITH A LAYER OFF';
      for (let i = 0; i < this.results.length; i += 2) text += `\n${this.results.slice(i, i + 2).join('   ')}`;
    }
    this.update_ = 0;
    this.render_ = 0;
    this.frames = 0;
    this.worst = 0;
    this.best = Infinity;
    this.draws = 0;
    this.gpu = 0;
    this.gpuFrames = 0;
    this.text.setText(text).setTint(fps >= 55 ? 0x9dffb0 : fps >= 30 ? 0xffe28a : 0xff8a8a);
    this.place();
  }

  /**
   * Once the profiler is on and the world has run for a moment, measure the
   * frame with everything, then with each layer turned off in turn: average
   * frame time and GPU wait per step. A layer whose removal saves the most is
   * what the phone struggles with.
   */
  private runBench(dt: number): void {
    const world = this.scene.get('world') as (Phaser.Scene & { benchLayers?(): [string, () => () => void][] }) | null;
    const running = !!world?.benchLayers && this.scene.isActive('world') && settings.values.profiler;
    if (!running) {
      this.stopBench();
      this.benchWait = 0;
      return;
    }
    if (this.benchDone) return;
    if (!this.bench) {
      this.benchWait += dt;
      if (this.benchWait < 2000) return;
      this.bench = { steps: [['ALL', null], ...world.benchLayers!()], i: -1, at: 0, restore: null };
      this.results = [];
      this.nextStep();
      return;
    }
    const b = this.bench;
    const now = performance.now();
    // Let the change settle, then measure.
    if (b.at > now) {
      this.benchTime = 0;
      this.benchFrames = 0;
      this.benchGpu = 0;
      return;
    }
    if (now - b.at < 1500) return;
    const n = Math.max(1, this.benchFrames);
    const name = b.i === 0 ? 'ALL' : `-${b.steps[b.i][0]}`;
    this.results.push(`${name} ${(this.benchTime / n).toFixed(1)}/${(this.benchGpu / n).toFixed(1)}`);
    this.nextStep();
  }

  private nextStep(): void {
    const b = this.bench!;
    b.restore?.();
    b.restore = null;
    b.i++;
    if (b.i >= b.steps.length) {
      this.bench = null;
      this.benchDone = true;
      this.since = 1e9;
      return;
    }
    b.restore = b.steps[b.i][1]?.() ?? null;
    b.at = performance.now() + 400;
  }

  private stopBench(): void {
    this.bench?.restore?.();
    this.bench = null;
  }

  private place(): void {
    const s = fpsScale();
    this.cameras.main.setZoom(s);
    this.text.setPosition(Math.round((this.scale.width / s - this.text.width) / 2), Math.round(fpsTop() / s));
  }
}
