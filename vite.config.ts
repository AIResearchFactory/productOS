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
      includeAssets: ['offline.html', 'server-stopped.html'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,jpg,png,webmanifest}'],
        globIgnores: ['**/node_modules/**/*'],
        navigateFallback: '/server-stopped.html',
        maximumFileSizeToCacheInBytes: 10000000 
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
