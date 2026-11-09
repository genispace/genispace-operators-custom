import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 18080,
    proxy: {
      '/api': {
        target: process.env.OPERATORS_DEV_API_URL || 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/static': {
        target: process.env.OPERATORS_DEV_API_URL || 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
});
