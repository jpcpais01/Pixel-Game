import { defineConfig } from 'vite';
import { pwa } from './scripts/pwa';

export default defineConfig({
  base: './',
  plugins: [pwa()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
