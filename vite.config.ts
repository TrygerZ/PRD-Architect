import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Tanpa manualChunks: mermaid, jspdf, dan docx sudah di-import dinamis, jadi
    // Rollup memecahnya sendiri. Kalau dipin ke chunk manual, helper preload Vite
    // nyangkut di chunk itu dan bundle entry meng-import-nya secara statis.
    // react-markdown statis, jadi memang tinggal di chunk entry.
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
