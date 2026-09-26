// Crash reports. Any error the game doesn't catch stops Phaser's loop (it runs
// a frame before asking for the next), so the game freezes. This catches those
// errors, and a lost WebGL context, and shows a report over the frozen game
// that can be copied and pasted to whoever is fixing it. The report is kept in
// localStorage, so it survives a reload.
//
// A tab the phone kills (out of memory, say) runs no code at all, so a
// heartbeat is kept while the game is on screen: if the next launch finds one
// that never said goodbye, the last session died, and it is reported then.

declare const __BUILD__: string;

const REPORT_KEY = 'pixel-battle.crash';
const BEAT_KEY = 'pixel-battle.heartbeat';
const BEAT_MS = 2000;
const TRAIL = 25;

/** What the game is doing: filled in by the world as a run starts. */
export const diag = {
  hero: '',
  arena: '',
  online: '',
  /** Recent inputs and abilities, oldest first. */
  trail: [] as string[],
  started: 0,
};

const t0 = performance.now();
const clock = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;

/** Remember something the player did (an ability pressed, a scene started). */
export function note(what: string): void {
  diag.trail.push(`${clock()} ${what}`);
  if (diag.trail.length > TRAIL) diag.trail.shift();
}

export const buildId = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

function context(): string[] {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  return [
    `Build: ${buildId}`,
    `Hero: ${diag.hero || '-'}`,
    `Arena: ${diag.arena || '-'}`,
    `Play: ${diag.online || 'solo'}`,
    `Run time: ${diag.started ? ((performance.now() - diag.started) / 1000).toFixed(0) + 's' : '-'}`,
    `Device: ${navigator.userAgent}`,
    `Screen: ${innerWidth}x${innerHeight} @${devicePixelRatio}`,
    ...(mem ? [`Memory: ${Math.round(mem.usedJSHeapSize / 1e6)} / ${Math.round(mem.jsHeapSizeLimit / 1e6)} MB`] : []),
    `Time: ${new Date().toISOString()}`,
  ];
}

function report(title: string, detail: string): string {
  return [`MYTHS AND LEGENDS CRASH: ${title}`, '', detail.trim(), '', ...context(), '', 'Last actions:', ...(diag.trail.length ? diag.trail : ['-'])].join('\n');
}

let shown = false;

function show(text: string, heading: string): void {
  if (shown) return;
  shown = true;
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;gap:10px;padding:max(14px,env(safe-area-inset-top)) 14px 14px;' +
    'background:rgba(7,8,13,.94);color:#cdd2ff;font:12px/1.35 ui-monospace,Menlo,monospace;touch-action:auto;user-select:text;-webkit-user-select:text';
  const h = document.createElement('b');
  h.textContent = heading;
  h.style.cssText = 'color:#ff9a8a;font-size:15px';
  const pre = document.createElement('pre');
  pre.textContent = text;
  pre.style.cssText = 'flex:1;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#11131f;padding:10px;-webkit-overflow-scrolling:touch';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
  const button = (label: string, act: (b: HTMLButtonElement) => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'padding:9px 16px;border:0;background:#342f8e;color:#f2ffff;font:inherit;font-size:14px;cursor:pointer';
    b.addEventListener('click', () => act(b));
    row.appendChild(b);
  };
  button('Copy report', (b) => {
    const done = () => (b.textContent = 'Copied');
    navigator.clipboard?.writeText(text).then(done, () => selectAll(pre, b)) ?? selectAll(pre, b);
  });
  button('Reload', () => location.reload());
  button('Close', () => {
    box.remove();
    shown = false;
  });
  // Keep the game's input handlers off the report.
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'keydown']) box.addEventListener(ev, (e) => e.stopPropagation());
  box.append(h, pre, row);
  document.body.appendChild(box);
}

/** No clipboard access: select the text so it can be copied by hand. */
function selectAll(pre: HTMLElement, b: HTMLButtonElement): void {
  const range = document.createRange();
  range.selectNodeContents(pre);
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  b.textContent = 'Selected: copy it';
}

function crash(title: string, detail: string): void {
  const text = report(title, detail);
  try {
    localStorage.setItem(REPORT_KEY, text);
  } catch {
    // Storage full or blocked: the overlay still shows it.
  }
  console.error(text);
  show(text, 'The game crashed. Copy this and send it to Claude.');
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const head = `${err.name}: ${err.message}`;
    return err.stack?.includes(head) ? err.stack : `${head}\n${err.stack ?? ''}`;
  }
  try {
    return String(err);
  } catch {
    return 'unknown error';
  }
}

/** Start catching crashes. Call before the game is made. */
export function installCrashReports(): void {
  window.addEventListener('error', (e) => {
    // A script or image that failed to load reaches here without an error; ignore it.
    if (!e.error && !e.message) return;
    crash(e.message || 'Error', e.error ? describe(e.error) : `${e.message}\n at ${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    // Sign-in and the relay server reject when offline; those aren't crashes of the game.
    const r = e.reason;
    if (r instanceof Error && /network|fetch|firebase|websocket/i.test(`${r.name} ${r.message}`)) return;
    crash('Unhandled promise rejection', describe(r));
  });

  // Open the game with #crash on the address to see the last report again.
  if (location.hash === '#crash') {
    const last = lastCrashReport();
    window.addEventListener('load', () => show(last ?? 'No crash report saved.', 'Last crash report'));
  }

  // The last session died without saying goodbye while on screen.
  try {
    const beat = localStorage.getItem(BEAT_KEY);
    if (beat) {
      localStorage.removeItem(BEAT_KEY);
      const text = `MYTHS AND LEGENDS CRASH: the last session stopped suddenly (the page was killed or froze while playing, likely out of memory)\n\nLast heartbeat:\n${beat}`;
      localStorage.setItem(REPORT_KEY, text);
      window.addEventListener('load', () => show(text, 'The game closed unexpectedly last time. Copy this and send it to Claude.'));
    }
  } catch {
    // No storage: no heartbeat.
  }
  const beat = () => {
    if (document.hidden) return;
    try {
      localStorage.setItem(BEAT_KEY, [...context(), '', 'Last actions:', ...diag.trail].join('\n'));
    } catch {
      // Ignore.
    }
  };
  const bye = () => {
    try {
      localStorage.removeItem(BEAT_KEY);
    } catch {
      // Ignore.
    }
  };
  setInterval(beat, BEAT_MS);
  // Hidden or closed on purpose: not a crash.
  document.addEventListener('visibilitychange', () => (document.hidden ? bye() : beat()));
  window.addEventListener('pagehide', bye);
}

/** Report a lost WebGL context: the screen goes black and nothing draws again. */
export function watchCanvas(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', () => crash('WebGL context lost', 'The graphics driver dropped the game (often the GPU running out of memory).'));
}

/** The last crash report saved, or null. */
export function lastCrashReport(): string | null {
  try {
    return localStorage.getItem(REPORT_KEY);
  } catch {
    return null;
  }
}
