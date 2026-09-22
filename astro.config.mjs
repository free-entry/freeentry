import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';
import { fileURLToPath } from 'node:url';
import defaults from './config/deployment.json' with { type: 'json' };

const COUNTRY_CODE = process.env.COUNTRY ?? process.env.VITE_COUNTRY ?? 'fr';
const siteUrl = (process.env.PUBLIC_SITE_URL || defaults.siteUrl).replace(/\/$/, '');
const DEPLOYMENTS = Object.fromEntries(
  Object.entries(defaults.countries).map(([code, path]) => [code, {
    basePath: `/${path}/`,
    siteUrl: `${siteUrl}/${path}`,
  }]),
);

const deployment = DEPLOYMENTS[COUNTRY_CODE];
if (!deployment) throw new Error(`Unknown COUNTRY value: ${COUNTRY_CODE}`);
const escapedBasePath = deployment.basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Static hub pages (index, area, city, category) in every locale.
const hubPathSegment = `${escapedBasePath}(?:[\\w-]+/)?(?:museums|area|city|free)/`;
// NavigationRoute tests denylist patterns against pathname + search.
const hubPathPattern = new RegExp(`^${hubPathSegment}`);
// RegExpRoute tests runtime-caching patterns against the full URL.
const hubUrlPattern = new RegExp(`^https?://[^/]+${hubPathSegment}`);

const MANIFESTS = {
  fr: {
    name: 'Free Entry',
    short_name: 'Free Entry',
    description:
      'Interactive map of free museums and monuments in France: always free, first Sundays, Museum Night, Heritage Days and more.',
  },
  it: {
    name: 'Free Entry',
    short_name: 'Free Entry',
    description:
      'Interactive map of free state museums and archaeological sites in Italy: Domenica al Museo first Sundays, national free days, always free.',
  },
  be: {
    name: 'Free Entry',
    short_name: 'Free Entry',
    description:
      'Interactive map of free museums in Belgium: first Sundays in Brussels and Wallonia, first Wednesdays, always-free collections.',
  },
};
const manifest = MANIFESTS[COUNTRY_CODE];
const iconDir = COUNTRY_CODE === 'fr' ? 'icons' : `icons-${COUNTRY_CODE}`;

export default defineConfig({
  output: 'static',
  site: deployment.siteUrl,
  base: deployment.basePath,
  trailingSlash: 'always',
  integrations: [
    react(),
    AstroPWA({
      registerType: 'autoUpdate',
      includeAssets: [`${iconDir}/apple-touch-icon.png`, `${iconDir}/icon.svg`],
      manifest: {
        name: manifest.name,
        short_name: manifest.short_name,
        description: manifest.description,
        lang: 'en',
        start_url: '.',
        display: 'standalone',
        theme_color: '#1266d3',
        background_color: '#f8fbfe',
        categories: ['travel', 'education'],
        icons: [
          { src: `${iconDir}/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${iconDir}/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${iconDir}/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell and hashed assets only: never precache 6,760 museum documents.
        globPatterns: ['**/*.{js,css,svg,png,woff2}', 'index.html', '404.html'],
        globIgnores: [
          'museum/**',
          '*/museum/**',
          'museums/**',
          '*/museums/**',
          'area/**',
          '*/area/**',
          'city/**',
          '*/city/**',
          'free/**',
          '*/free/**',
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${deployment.basePath}index.html`,
        navigateFallbackDenylist: [hubPathPattern],
        runtimeCaching: [
          {
            urlPattern: hubUrlPattern,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-pages',
              expiration: { maxEntries: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Workbox cross-origin RegExp routes must match from the URL's start.
            urlPattern: /^https?:\/\/[^/]+\/(?:[^/]+\/)?images\/(?:museums|derived)\/.*\.(?:jpg|webp)$/,
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
  build: {
    format: 'directory',
  },
  vite: {
    define: {
      'import.meta.env.VITE_COUNTRY': JSON.stringify(COUNTRY_CODE),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            maplibre: ['maplibre-gl'],
          },
        },
      },
    },
  },
});
