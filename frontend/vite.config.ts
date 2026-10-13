import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: { port: 5174, proxy: { '/api': 'http://localhost:4100' } },
  build: {
    // Navigateurs plus anciens (iPhone sous iOS 12, Android avec Chrome 70) : syntaxe récente transpilée.
    target: ['es2019', 'chrome70', 'safari12', 'firefox68', 'edge79'],
    chunkSizeWarningLimit: 900,
  },
});
