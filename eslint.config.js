// eslint.config.js
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // Base configuration for all files
  {
    ignores: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/__tests__/**'],
  },
  // Apply TypeScript recommended configuration
  ...tseslint.configs.recommended,
  // Add Prettier plugin
  {
    plugins: {
      prettier,
    },
    rules: {
      // Prettier rules
      'prettier/prettier': 'error',

      // Basic code quality rules
      semi: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'error',

      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        // Enforce PascalCase for classes, interfaces, etc.
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        // Enforce camelCase for variables, functions, etc.
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
      ],
    },
  },
  // Apply Prettier's rules last to override other formatting rules
  eslintConfigPrettier,
];
