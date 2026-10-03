// App shell behaviour: offline service worker, fullscreen landscape on a
// phone's tap, an install button, and a nudge to turn the phone sideways.

import { afterLoad } from './loaded';

const touch = () => matchMedia('(pointer: coarse)').matches;

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  afterLoad(() => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker failed to register', err));
  });
}

/**
 * On a phone, a tap goes fullscreen and locks to landscape (Android). The
 * loading screen ends on "Tap anywhere to start" (index.html) so the first
 * tap is this one. The manifest can't ask for landscape itself: with a fixed
 * orientation some phones (Xiaomi HyperOS) install the app but never open
 * it. Fullscreen is also how Chrome lets the page draw round the camera
 * cutout, with viewport-fit=cover (index.html). Leaving it (the app sent to
 * the background, say) goes back in on the next tap. pointerup and click,
 * never pointerdown: a touch's pointerdown isn't a gesture that may go
 * fullscreen. A refusal changes nothing: the game plays on as it is.
 */
function fullscreenOnTap(): void {
  let pending = false;
  const go = () => {
    if (pending || !touch() || document.fullscreenElement) return;
    const el = document.documentElement;
    if (!el.requestFullscreen) return; // iPhone Safari: add to Home Screen instead.
    pending = true;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {})
      .finally(() => (pending = false));
  };
  window.addEventListener('pointerup', go, { passive: true });
  window.addEventListener('click', go, { passive: true });
  // The loading screen's tap keeps its events to itself, so it calls this.
  (window as Window & { enterFullscreen?: () => void }).enterFullscreen = go;
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
  fullscreenOnTap();
  installButton();
  rotateHint();
}
