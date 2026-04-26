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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@tiptap/pm') || id.includes('prosemirror')) {
            return 'prosemirror';
          }

          if (id.includes('@tiptap/react')) {
            return 'editor-react';
          }

          if (id.includes('@tiptap/markdown')) {
            return 'editor-markdown';
          }

          if (id.includes('@tiptap/core') || id.includes('@tiptap/starter-kit') || id.includes('@tiptap/extension-') || id.includes('@tiptap/suggestion')) {
            return 'editor';
          }

          if (id.includes('@tiptap')) {
            return 'editor-react';
          }

          if (id.includes('@xyflow')) {
            return 'workflow';
          }

          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('mdast') || id.includes('micromark') || id.includes('unified') || id.includes('hast')) {
            return 'markdown';
          }

          if (id.includes('@radix-ui')) {
            return 'radix';
          }

          if (id.includes('@tauri-apps')) {
            return 'tauri';
          }

          if (id.includes('framer-motion')) {
            return 'motion';
          }

          if (id.includes('pptxgenjs')) {
            return 'export';
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});
