import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// shashankbansal6.github.io is a user site, so it is served from the root.
// Pages: the 3D journey (/), the photo timeline (/photos/), the three Learn worlds (/learn/, /learn/sensors/, /learn/chip/) and /privacy/.
// Preload the fonts the first screen needs, so text is painted in its final typeface from the first frame.
const FIRST_SCREEN = [/newsreader-latin-opsz-normal/, /inter-latin-wght-normal/];
function preloadFonts() {
  return {
    name: 'preload-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return [];
        const want = ctx.path === '/index.html' ? [...FIRST_SCREEN, /noto-serif-devanagari-devanagari-400/] : FIRST_SCREEN;
        const tags = Object.keys(ctx.bundle).filter((f) => want.some((r) => r.test(f)))
          .map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${f}` }, injectTo: 'head-prepend' }));
        // the 3D scene is imported after the first paint; fetch (not run) it quietly meanwhile
        if (ctx.path === '/index.html') {
          const scene = Object.values(ctx.bundle).find((c) => c.type === 'chunk' && c.isDynamicEntry && /src\/main\.js$/.test(c.facadeModuleId || ''));
          if (scene) {
            const seen = new Set();
            const walk = (name) => { if (seen.has(name)) return; seen.add(name); (ctx.bundle[name]?.imports || []).forEach(walk); };
            walk(scene.fileName);
            seen.forEach((f) => !html.includes(f) && tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', fetchpriority: 'low', href: `/${f}` }, injectTo: 'head' }));
          }
        }
        return tags;
      },
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [preloadFonts()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    cssCodeSplit: false, // one stylesheet per visit instead of five requests on the first paint
    rollupOptions: {
      output: { manualChunks: (id) => (id.endsWith('.css') ? undefined : /node_modules\/(three|gsap|lenis)\//.exec(id)?.[1]) },
      input: { main: resolve(import.meta.dirname, 'index.html'), photos: resolve(import.meta.dirname, 'photos/index.html'), learn: resolve(import.meta.dirname, 'learn/index.html'),
        sensors: resolve(import.meta.dirname, 'learn/sensors/index.html'), chip: resolve(import.meta.dirname, 'learn/chip/index.html'), privacy: resolve(import.meta.dirname, 'privacy/index.html') },
    },
  },
});
