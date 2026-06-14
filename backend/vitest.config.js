// beacon2/backend/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      // text-summary prints to the CI log; html/lcov are uploaded as artefacts.
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        'src/__tests__/**',
        'src/server.js',
        'src/seed/**',
        '**/*.config.js',
      ],
    },
    // Set JWT secrets so jwt.js module loads without throwing
    env: {
      JWT_ACCESS_SECRET:  'test-access-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      JWT_REFRESH_SECRET: 'test-refresh-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_DAYS: '30',
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
