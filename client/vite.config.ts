import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: { skipWaiting: true, clientsClaim: true },
      includeAssets: ['favicon.svg','icon.svg','apple-touch-icon.png','pwa-192x192.png','pwa-512x512.png','pwa-maskable-512.png'],
      manifest: {
        name: 'Credit Tracker',
        short_name: 'Credit Tracker',
        description: 'Учёт долгов и платежей с напоминаниями и PWA',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#30204F',
        background_color: '#30204F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ]
      },
      devOptions: { enabled: true, type: 'module' },
      injectManifest: { rollupFormat: 'iife' },
    }),
  ],
  server: {
    port: 5173,
    allowedHosts: ['.lhr.life', '.trycloudflare.com', '.loca.lt', '.ngrok-free.app'],
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
});
