import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest — свой Service Worker, чтобы добавить обработчики push/notificationclick
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg','icon.svg','apple-touch-icon.png','pwa-192x192.png','pwa-512x512.png','pwa-maskable-512.png'],
      manifest: {
        name: 'Credit Tracker',
        short_name: 'Credit Tracker',
        description: 'Учёт долгов и платежей с напоминаниями и PWA',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      },
      devOptions: { enabled: true, type: 'module' },
      // IIFE вместо ESM — Service Worker работает и в Safari/старых браузерах
      injectManifest: { rollupFormat: 'iife' },
    }),
  ],
  server: {
    port: 5173,
    // Домены временных туннелей для внешнего теста.
    // Без этого Vite 5.4.12+ отвечает 403 (защита от DNS-rebinding).
    allowedHosts: ['.lhr.life', '.trycloudflare.com', '.loca.lt', '.ngrok-free.app'],
    proxy: {
      // в dev ходим на Express без CORS-проблем
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
