import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    // Dummy values so tests never depend on a developer's local server/.env
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-do-not-use-in-production',
      JWT_EXPIRES_IN: '1h',
      CLIENT_URL: 'http://localhost:5173',
    },
    // Test files share one in-memory MongoDB (each with its own database); run them one at a time
    fileParallelism: false,
    hookTimeout: 120000,
  },
})
