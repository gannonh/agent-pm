import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    typecheck: {
      tsconfig: './tsconfig.test.json',
      enabled: true,
    },
    globals: true,
    environment: 'node',
    include: ['src/__integration__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/helpers/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        `**/__tests__/**/*`,

        '**/*.config.*',
        'scripts/',
        '.eslintrc.cjs',
        '**/*.d.ts',
        '**/docs/**/*',
        'dist/',
        // Interface files (type definitions only, no runtime code)
        'src/core/interfaces/**',
        `**/__integration__/**/*`,
        `**/*.test.*`,
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },

    // Longer timeout for integration tests
    testTimeout: 30000,
  },
});
