import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true,   // Listen on all network interfaces (0.0.0.0)
    port: 5173,   // Default Vite port
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Show update prompt instead of auto-updating
      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-1024.png'
      ],
      manifest: {
        name: 'Gimmies',
        short_name: 'Gimmies',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#09243F',
        theme_color: '#09243F',
        description: 'On-course golf gambling games (Nassau & Skins)',
        icons: [
          // Separate purpose entries for best Android adaptive icon support
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        // Check for updates every hour
        skipWaiting: false, // Let user control when to update
        clientsClaim: true, // Take control of pages immediately after activation
        // Build assets are already revisioned and precached by Workbox.
        // Runtime-caching HTML/JS with stale-while-revalidate can pin users
        // to an older app shell after deploys, which is how old chunk bugs
        // keep resurfacing even after the source fix is live.
        runtimeCaching: []
      }
    })
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - loaded on every page
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // AWS Amplify - large bundle, only needed for auth/sync
          'vendor-aws': ['aws-amplify', '@aws-amplify/ui-react'],
          // Zustand state management
          'vendor-state': ['zustand', 'idb-keyval'],
        }
      }
    }
  }
});
