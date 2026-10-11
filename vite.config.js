import { defineConfig } from 'vite';

// shashankbansal6.github.io is a user site, so it is served from the root.
export default defineConfig({
  base: '/',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
