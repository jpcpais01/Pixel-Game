// Builds hero sheets off the main thread (see heroLoader.ts): given a look's
// key, it draws, lights and packs every frame and hands back the pixels.

import { buildHeroSheet, type HeroSheet } from './heroSheets';

interface WorkerScope {
  onmessage: ((e: MessageEvent<string>) => void) | null;
  postMessage(message: HeroSheet, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const sheet = buildHeroSheet(e.data);
  const a = sheet.atlas;
  const layers = [a.diffuse, a.normal, a.emissive, a.silhouette, ...(a.white ? [a.white] : [])];
  scope.postMessage(sheet, layers.map((l) => l.buffer));
};
