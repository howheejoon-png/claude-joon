import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Builds the theme's CSS and JS into /assets with a manifest.
 *
 * Asset URLs inside JS are resolved at runtime through window.__labAsset, which
 * the theme defines from the real theme URL. That keeps the dynamically imported
 * Three.js chunk working wherever WordPress is installed.
 */
export default defineConfig({
  build: {
    outDir: 'assets',
    assetsDir: '.',
    emptyOutDir: false,
    manifest: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.js'),
    },
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { runtime: `window.__labAsset(${JSON.stringify(filename)})` };
      }
      return { relative: true };
    },
  },
  server: { port: 5173, strictPort: false, cors: true },
});
