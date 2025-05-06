import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Use the test-specific TypeScript configuration
  test: {
    typecheck: {
      tsconfig: './tsconfig.test.json',
      enabled: true,
    },
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/docs/**',
      '**/dist/**',
      '**/__integration__/**',
      '**/__tests__/**/__helpers__/**',
      '**/__tests__/**/__mocks__/**',
      '**/__tests__/**/helpers.ts',
      '**/__tests__/**/test-helpers.ts',
      '**/__tests__/**/test-utils.ts',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/__tests__/**/*',
        '**/types.ts',
        '**/*.config.*',
        'scripts/',
        '.eslintrc.cjs',
        '.eslintrc.js',
        '**/*.d.ts',
        '**/docs/**/*',
        'dist/',
        // Interface files (type definitions only, no runtime code)
        'src/core/interfaces/**',
        '**/__integration__/**/*',
        '**/*.test.*',
      ],
      thresholds: {
        statements: 70,
        branches: 80,
        functions: 85,
        lines: 70,
      },
    },
  },
});
