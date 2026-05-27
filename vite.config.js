import { defineConfig } from 'vite';

export default defineConfig({
  // './' 상대 경로 — Electron이 file:// scheme로 dist/index.html 로드 시 자원 못 찾는 문제 해결.
  // dev 서버에선 영향 없음 (vite dev가 base 상대 경로도 정상 처리).
  base: './',
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
