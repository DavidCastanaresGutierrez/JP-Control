import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  cacheDir: '.vite-cache',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'Brújula',
        short_name: 'Brújula',
        description: 'Control personal de tres pilares: economía, salud y hábitos.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El documento HTML siempre se pide a red (evita servir un index.html
        // antiguo que apunta a assets con hash ya borrados tras un despliegue);
        // los assets con hash sí se precachean y sirven desde caché.
        navigateFallback: undefined,
        globPatterns: ['**/*.{js,css,svg,png,ico}'],
      },
    }),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
