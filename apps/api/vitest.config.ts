import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.{test,spec}.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/vitest_placeholder',
      JWT_SECRET: 'vitest-test-jwt-secret-minimum-32-characters-long',
      AUTH_PASSWORD_HASH: '$2b$12$vitest.placeholder.hash.for.tests.only',
      HOME_CURSOR_SECRET: 'vitest-test-home-cursor-secret-minimum-32-chars',
    },
  },
})
