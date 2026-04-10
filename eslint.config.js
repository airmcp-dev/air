// eslint.config.js — air monorepo ESLint flat config
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  // ── 전역 무시 ──
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/templates/**',
      '**/*.js',
      '**/*.mjs',
    ],
  },

  // ── TypeScript 파일 ──
  {
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ── 에러 방지 ──
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off',   // air는 MCP SDK 호환 때문에 any 필요
      '@typescript-eslint/no-empty-function': 'off',

      // ── 코드 스타일 ──
      'no-console': 'off',                           // CLI라 console 허용
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-throw-literal': 'error',

      // ── import ──
      'no-duplicate-imports': 'error',
    },
  },

  // ── Prettier와 충돌 방지 (마지막에 적용) ──
  prettier,
];
