// beacon2/backend/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
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
