import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
