import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    // In local dev (npm run dev), proxy /api requests to the backend
    // so you don't need NGINX running locally.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Vite outputs to dist/ — matches what the frontend Dockerfile copies
    outDir: 'dist',
  },
});
