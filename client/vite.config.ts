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
      includeAssets: ['icon.svg', 'favicon.svg'],
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
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
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
