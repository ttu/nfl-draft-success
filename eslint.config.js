import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // TypeScript prop types make prop-types redundant.
      'react/prop-types': 'off',

      // `role` is a domain prop here (RoleChip role="core"), not the ARIA
      // attribute, so only check roles on real DOM elements.
      'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],

      // Bare apostrophes in copy are fine and more readable; only `>` and `}`
      // are genuinely ambiguous in JSX text.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],

      // Deeply nested JSX is a signal to extract a component.
      'react/jsx-max-depth': ['error', { max: 4 }],

      // Consistent, low-noise JSX.
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['error', 'never'],
      'react/jsx-fragments': ['error', 'syntax'],
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/no-array-index-key': 'error',
      'react/jsx-no-target-blank': ['error', { allowReferrer: false }],

      // `verbatimModuleSyntax` requires type-only imports to be marked.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
