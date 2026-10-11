import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// shashankbansal6.github.io is a user site, so it is served from the root.
// Two pages: the 3D journey (/) and the photo timeline (/photos/).
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), photos: resolve(import.meta.dirname, 'photos/index.html') },
    },
  },
});
