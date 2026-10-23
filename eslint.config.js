import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts', 'mcp-server/src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Errors
      'no-var': 'error',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',

      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Style (light touch)
      'prefer-const': 'warn',
      'no-console': 'off', // console is used extensively for debugging
    },
  },
  {
    ignores: ['dist/', 'release/', 'node_modules/', '*.js'],
  },
];
