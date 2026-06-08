import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	compilerOptions: {
		warningFilter: (warning) => !warning.code.startsWith('a11y_') && warning.code !== 'non_reactive_update'
	},

	kit: {
		adapter: adapter({
			edge: false,
			split: false
		})
	}
};

export default config;
