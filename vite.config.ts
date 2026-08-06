/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Served from https://travel-eu.github.io/free-museums-france/ — the base path is
// kept identical in dev so path handling never diverges between environments.
const COUNTRY = process.env.VITE_COUNTRY ?? 'fr';
const BASE_PATHS: Record<string, string> = {
  fr: '/free-museums-france/',
  it: '/free-museums-italy/',
  be: '/free-museums-belgium/',
};
// English manifest strings per deployment; runtime i18n takes over in-app.
const MANIFESTS: Record<string, { name: string; short_name: string; description: string }> = {
  fr: {
    name: 'Free Museums & Monuments — France',
    short_name: 'Free Museums',
    description:
      'Interactive map of free museums and monuments in France: always free, first Sundays, Museum Night, Heritage Days and more.',
  },
  it: {
    name: 'Free Museums & Monuments — Italy',
    short_name: 'Free Museums',
    description:
      'Interactive map of free state museums and archaeological sites in Italy: Domenica al Museo first Sundays, national free days, always free.',
  },
  be: {
    name: 'Free Museums & Monuments — Belgium',
    short_name: 'Free Museums',
    description:
      'Interactive map of free museums in Belgium: first Sundays in Brussels and Wallonia, first Wednesdays, always-free collections.',
  },
};
const MANIFEST = MANIFESTS[COUNTRY] ?? MANIFESTS.fr;
const ICON_DIR = COUNTRY === 'fr' ? 'icons' : `icons-${COUNTRY}`;

export default defineConfig({
  base: BASE_PATHS[COUNTRY] ?? `/free-museums-${COUNTRY}/`,
  plugins: [
    {
      name: 'country-shell-head',
      transformIndexHtml(html: string) {
        return html
          .replace('%VITE_SITE_TITLE%', MANIFEST.name)
          .replace('%VITE_META_DESCRIPTION%', MANIFEST.description)
          .replaceAll('%VITE_ICON_DIR%', ICON_DIR);
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [`${ICON_DIR}/apple-touch-icon.png`, `${ICON_DIR}/icon.svg`, 'robots.txt'],
      manifest: {
        name: MANIFEST.name,
        short_name: MANIFEST.short_name,
        description: MANIFEST.description,
        lang: 'en',
        start_url: '.',
        display: 'standalone',
        theme_color: '#1266d3',
        background_color: '#f8fbfe',
        categories: ['travel', 'education'],
        icons: [
          { src: `${ICON_DIR}/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${ICON_DIR}/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${ICON_DIR}/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${BASE_PATHS[COUNTRY] ?? `/free-museums-${COUNTRY}/`}index.html`,
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
          {
            // Museum header photos — cached as the visitor browses, not
            // eagerly precached (there can be well over 100 of them).
            urlPattern: /\/images\/museums\/.*\.jpg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'museum-photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 180 * 24 * 3600 },
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
