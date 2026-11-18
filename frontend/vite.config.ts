import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const enableHttps = env.VITE_HTTPS === 'true';

  return {
    plugins: enableHttps ? [react(), basicSsl()] : [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            leaflet: ['leaflet', 'react-leaflet', 'leaflet.markercluster'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      host: enableHttps ? true : undefined,
    },
  };
});
