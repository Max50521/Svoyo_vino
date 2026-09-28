import { defineConfig } from 'vitest/config'

// Offline reports over local data (not part of `npm test`).
export default defineConfig({
  test: {
    include: ['scripts/**/*.run.ts'],
    testTimeout: 300_000,
  },
})
