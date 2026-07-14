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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'JP Control',
        short_name: 'JP Control',
        description: 'Seguimiento economico de proyectos a partir del Detalle de Explotacion del ERP.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#101828',
        background_color: '#101828',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // vite-plugin-pwa precarga index.html y lo sirve cache-first en cada
        // navegacion por defecto (navigateFallback: 'index.html'). Con despliegues
        // frecuentes eso deja pestañas sirviendo un HTML antiguo que apunta a
        // JS/CSS con hash que Vercel ya ha borrado (404 en blanco). Se desactiva
        // para que el documento HTML siempre se pida a red; los assets con hash
        // (JS/CSS) se siguen precacheando y sirviendo desde cache sin riesgo,
        // porque cada build genera un hash nuevo.
        navigateFallback: undefined,
        globPatterns: ['**/*.{js,css,svg,png,ico}'],
      },
    }),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
