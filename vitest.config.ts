import { configDefaults, defineConfig } from 'vitest/config'

// Los E2E de Playwright (e2e/) tienen su propio runner: vitest no debe tocarlos
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
