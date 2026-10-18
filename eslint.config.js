import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**']),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Plain JavaScript files (such as this one) are not part of a TypeScript project.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // npm hoists shared packages to the root, which can hide an import that is missing
  // from an app's own package.json. This rule catches that (see ADR-0008).
  {
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { devDependencies: ['**/*.test.ts', '**/vitest.config.ts', '**/eslint.config.js'] },
      ],
    },
  },

  // Must come last: turns off rules that would fight with Prettier.
  prettier,
]);
