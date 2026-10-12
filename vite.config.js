import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
        // the 3D scene is imported right after the first paint; start fetching (not running) it with the page
        if (ctx.path === '/index.html') {
          const scene = Object.values(ctx.bundle).find((c) => c.type === 'chunk' && c.isDynamicEntry && /src\/main\.js$/.test(c.facadeModuleId || ''));
          if (scene) {
            const seen = new Set();
            const walk = (name) => { if (seen.has(name)) return; seen.add(name); (ctx.bundle[name]?.imports || []).forEach(walk); };
            walk(scene.fileName);
            seen.forEach((f) => !html.includes(f) && tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `/${f}` }, injectTo: 'head' }));
          }
        }
        return tags;
      },
    },
  };
}

// theme-init.js must stay a blocking classic script (it picks the theme before the first paint), so Vite leaves it alone
// and it would be served from /theme-init.js, which is revalidated on every visit: one round trip before anything paints.
// Publish a content-hashed copy under /assets/ instead, cached for a year like the rest of the build.
function hashThemeInit() {
  let file = '';
  return {
    name: 'hash-theme-init',
    apply: 'build',
    buildStart() {
      const source = readFileSync(resolve(import.meta.dirname, 'public/theme-init.js'));
      file = `assets/theme-init-${createHash('sha256').update(source).digest('hex').slice(0, 8)}.js`;
      this.emitFile({ type: 'asset', fileName: file, source });
    },
    transformIndexHtml: (html) => html.replace('<script src="/theme-init.js"></script>', `<script src="/${file}"></script>`),
  };
}

export default defineConfig({
  base: '/',
  plugins: [hashThemeInit(), preloadFonts()],
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
