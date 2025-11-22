import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        display: 'standalone',
        background_color: '#14532d',
        theme_color: '#14532d',
        description: 'On-course golf gambling games (Nassau & Skins)',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*\.(?:js|css|html)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources'
            }
          }
        ]
      }
    })
  ]
});
