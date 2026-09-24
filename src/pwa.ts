// App shell behaviour: offline service worker, fullscreen landscape on
// phones, an install button, and a nudge to turn the phone sideways.

const standalone = () =>
  matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const touch = () => matchMedia('(pointer: coarse)').matches;

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed to register', err));
  });
}

/**
 * In a phone browser tab, the first touch goes fullscreen and locks to
 * landscape (Android). Installed, the manifest already does both.
 */
function fullscreenOnFirstTouch(): void {
  const go = () => {
    if (standalone() || !touch() || document.fullscreenElement) return;
    const el = document.documentElement;
    if (!el.requestFullscreen) return; // iPhone Safari: add to Home Screen instead.
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {});
  };
  window.addEventListener('pointerup', go, { passive: true });
}

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Chrome/Android: show our own Install button once the browser allows it. */
function installButton(): void {
  const btn = document.getElementById('install') as HTMLButtonElement;
  let deferred: InstallPrompt | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    btn.hidden = false;
  });
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    btn.hidden = true;
    await deferred.prompt();
    deferred = null;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    deferred = null;
  });
}

/** Portrait on a phone: ask to rotate. Tapping the card plays anyway. */
function rotateHint(): void {
  const card = document.getElementById('rotate')!;
  let dismissed = false;
  const portrait = matchMedia('(orientation: portrait)');
  const update = () => {
    card.hidden = dismissed || !touch() || !portrait.matches;
  };
  card.addEventListener('pointerup', () => {
    dismissed = true;
    update();
  });
  portrait.addEventListener('change', update);
  update();
}

export function setupApp(): void {
  registerServiceWorker();
  fullscreenOnFirstTouch();
  installButton();
  rotateHint();
}
