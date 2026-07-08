import { defineConfig } from 'vitest/config';

// Server/API tests run in Node against the in-memory store (SIMTRADE_MEMORY=1),
// so they never touch server/db.json. Each test file gets a fresh seeded store.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      SIMTRADE_MEMORY: '1',
      JWT_SECRET: 'test-secret-key',
    },
  },
});
