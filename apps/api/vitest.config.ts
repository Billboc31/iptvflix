import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'vitest-test-jwt-secret-minimum-32-characters-long',
      AUTH_PASSWORD_HASH: '$2b$12$vitest.placeholder.hash.for.tests.only',
    },
  },
})
