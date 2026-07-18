import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/lib/testSetup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
