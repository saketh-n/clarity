import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/eval/**/*.eval.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false
  }
})
