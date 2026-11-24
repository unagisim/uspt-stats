import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Sur GitHub Pages, l'application est servie sous /<nom-du-dépôt>/ (fourni par le workflow).
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    svelte(),
    VitePWA({
      // Mise à jour proposée à l'utilisateur (jamais de rechargement automatique en plein match).
      registerType: 'prompt',
      manifest: {
        name: 'USPT Stats',
        short_name: 'USPT Stats',
        description: 'Saisie en direct et statistiques de matchs de tennis',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        // Couleurs du logo de l'US Pontet Tennis.
        theme_color: '#071A44',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est mis en cache, y compris le module PDF chargé à la demande.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
