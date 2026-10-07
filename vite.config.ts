import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pwa } from './scripts/pwa';

// Shown on crash reports, so an old cached build is easy to spot.
function buildId(): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = 'unknown';
    }
  }
  return `${sha.slice(0, 7)} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}Z`;
}

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [pwa()],
  define: { __BUILD__: JSON.stringify(buildId()) },
  build: {
    chunkSizeWarningLimit: 2000,
    // Two apps from one build: Myths and Legends at the root and Heaven Lands
    // under heaven/, sharing the built assets.
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        heaven: resolve(root, 'heaven/index.html'),
      },
    },
  },
});
