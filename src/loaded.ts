/**
 * Run `fn` once the page has loaded, or now if it already has: the game
 * itself only starts after the load event (see entry.ts), so a plain 'load'
 * listener added from it would never fire.
 */
export function afterLoad(fn: () => void): void {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn, { once: true });
}
