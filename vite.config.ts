/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Served from https://travel-eu.github.io/free-museums-paris/ — the base path is
// kept identical in dev so path handling never diverges between environments.
export default defineConfig({
  base: '/free-museums-paris/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg', 'robots.txt'],
      manifest: {
        name: 'Free Museums & Monuments — Paris & Île-de-France',
        short_name: 'Free Museums',
        description:
          'Interactive map of free museums and monuments in Paris and Île-de-France: always free, first Sundays, Museum Night, Heritage Days and more.',
        lang: 'en',
        start_url: '.',
        display: 'standalone',
        theme_color: '#1266d3',
        background_color: '#f8fbfe',
        categories: ['travel', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/free-museums-paris/index.html',
        runtimeCaching: [
          {
            // Vector tiles, glyphs, sprites and styles — capped, offline-friendly.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // MapLibre dominates the bundle; isolating it improves caching.
          maplibre: ['maplibre-gl'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
