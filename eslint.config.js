const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const importPlugin = require('eslint-plugin-import')
const jestPlugin = require('eslint-plugin-jest')

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/extensions': ['.js', '.ts'],
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.js'],
      },
      'import/resolver': {
        typescript: {},
        node: { extensions: ['.js', '.ts'] },
      },
    },
    rules: {
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', ts: 'never' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '_',
          varsIgnorePattern: '_',
          caughtErrorsIgnorePattern: '_',
        },
      ],
    },
  },
  {
    files: ['src/**/__tests__/**/*.ts'],
    plugins: { jest: jestPlugin },
    rules: {
      ...jestPlugin.configs.recommended.rules,
    },
  },
  {
    ignores: ['dist/**'],
  },
]
