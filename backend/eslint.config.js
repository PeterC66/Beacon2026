// beacon2/backend/eslint.config.js
// Flat-config ESLint setup for the backend (ES modules, Node runtime).
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // Ignore generated and vendored output.
  {
    ignores: ['node_modules/**', 'prisma/generated/**', 'coverage/**'],
  },

  // Base recommended rules for all source files.
  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Allow intentionally unused args when prefixed with _ (e.g. Express
      // error handlers need the 4-arg signature even when `next` is unused).
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // Test files use Vitest globals (globals: true in vitest.config.js).
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },

  // Turn off stylistic rules that conflict with Prettier (must come last).
  prettier,
];
