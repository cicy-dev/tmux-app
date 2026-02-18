import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 16901,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 16901,
    },
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://server:6901',
        changeOrigin: true,
      },
      '/ttyd': {
        target: 'http://server:6901',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
