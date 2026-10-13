import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: { port: 5174, proxy: { '/api': 'http://localhost:4100' } },
  build: { chunkSizeWarningLimit: 900 },
});
