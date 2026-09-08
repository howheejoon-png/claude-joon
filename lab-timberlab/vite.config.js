import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page prototype. Each HTML file is a template that WordPress will later own.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        projects: resolve(__dirname, 'projects.html'),
        project: resolve(__dirname, 'project.html'),
        services: resolve(__dirname, 'services.html'),
        studio: resolve(__dirname, 'studio.html'),
        contact: resolve(__dirname, 'contact.html'),
      },
    },
  },
  server: { port: 5173, strictPort: false },
});
