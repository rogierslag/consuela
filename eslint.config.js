import js from '@eslint/js';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		files: ['src/**/*.js', 'test/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals.node,
		},
		rules: {
			indent: ['error', 'tab'],
			quotes: ['error', 'single'],
			'linebreak-style': ['error', 'unix'],
			semi: ['error', 'always'],
			'no-console': 'warn',
		},
	},
];
