import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // GitHub Pages serves from /WTFv2/ — must match repo name exactly
  base: '/WTFv2/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        releaseNotes: resolve(__dirname, 'release-notes.html'),
      },
    },
  },
});
