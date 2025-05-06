import js from '@eslint/js';
import * as tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// Base configuration for all files
const baseConfig = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: {
    prettier: await import('eslint-plugin-prettier').then((m) => m.default),
  },
  rules: {
    'prettier/prettier': 'error',
  },
};

// Configuration for TypeScript files
const tsConfig = {
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
  },
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
};

// Test-specific configuration
const testConfig = {
  files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  rules: {
    // Allow explicit any in tests
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow non-null assertions in tests
    '@typescript-eslint/no-non-null-assertion': 'off',
    // Allow type assertions in tests
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    // Allow unsafe operations in tests
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    // Allow unused variables in tests (often used in mocks)
    '@typescript-eslint/no-unused-vars': 'off',
  },
};

export default [
  // Base JavaScript configuration
  js.configs.recommended,
  // Base TypeScript configuration (non-type-checking rules)
  ...tseslint.configs.recommended,
  // Prettier configuration
  prettierConfig,
  // Our base configuration
  baseConfig,
  // TypeScript-specific configuration
  tsConfig,
  // Test-specific configuration
  testConfig,
];
