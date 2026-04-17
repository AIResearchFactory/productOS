import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['assets/icons/*.png', 'offline.html', 'server-stopped.html'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,jpg,webmanifest}'], // Added webmanifest
        globIgnores: ['**/node_modules/**/*', 'assets/icons/*.png'],
        navigateFallback: '/server-stopped.html',
        maximumFileSizeToCacheInBytes: 5000000 
      },
      manifest: false,
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
  },
});
