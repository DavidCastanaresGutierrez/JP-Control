import { defineConfig } from '@playwright/test'

/**
 * E2E contra el build de produccion servido por `vite preview` (bundle real,
 * Web Worker y PWA incluidos). Ejecutar con `npm run test:e2e` (hace el build
 * primero); en CI el build ya existe y el webServer solo lanza el preview.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
})
