import { defineConfig, mergeConfig } from 'vite';
import { vitestConfig } from '@n8n/vitest-config/node';

export default mergeConfig(
	defineConfig({
		build: {
			// Aggressive memory optimization
			chunkSizeWarningLimit: 500,
			// Use terser for better compression (slower but more memory efficient)
			minify: 'terser',
			terserOptions: {
				compress: {
					drop_console: true,
					drop_debugger: true,
				},
			},
			// Optimize rollup options for extreme memory management
			rollupOptions: {
				// Reduce concurrent operations to minimum
				maxParallelFileOps: 1,
				output: {
					// More aggressive chunk splitting
					manualChunks: (id) => {
						// Split node_modules more granularly
						if (id.includes('node_modules')) {
							// Core Vue ecosystem
							if (id.includes('vue/') || id.includes('vue-router') || id.includes('@vue/')) {
								return 'vue-core';
							}
							// Vue utilities and composition
							if (id.includes('@vueuse') || id.includes('vue-demi')) {
								return 'vue-utils';
							}
							// UI libraries
							if (
								id.includes('element-plus') ||
								id.includes('ant-design') ||
								id.includes('@headlessui')
							) {
								return 'ui-libs';
							}
							// Code editor related
							if (id.includes('monaco-editor') || id.includes('codemirror')) {
								return 'editor';
							}
							// Utility libraries
							if (id.includes('lodash') || id.includes('ramda') || id.includes('date-fns')) {
								return 'utils';
							}
							// HTTP and networking
							if (id.includes('axios') || id.includes('ky') || id.includes('ofetch')) {
								return 'http';
							}
							// Validation and schema
							if (id.includes('zod') || id.includes('yup') || id.includes('joi')) {
								return 'validation';
							}
							// Large libraries get their own chunks
							if (id.includes('three.js') || id.includes('d3')) {
								return 'graphics';
							}
							// Everything else in vendor
							return 'vendor';
						}

						// Split application code by feature/directory
						if (id.includes('/src/components/')) {
							return 'components';
						}
						if (id.includes('/src/views/') || id.includes('/src/pages/')) {
							return 'pages';
						}
						if (id.includes('/src/stores/') || id.includes('/src/store/')) {
							return 'stores';
						}
						if (id.includes('/src/utils/') || id.includes('/src/helpers/')) {
							return 'app-utils';
						}
					},
					// Smaller chunk sizes
					chunkFileNames: (chunkInfo) => {
						return `[name]-[hash:6].js`;
					},
				},
			},
			// Reduce target for better compatibility and smaller bundles
			target: 'es2018',
			// Disable source maps completely
			sourcemap: false,
			// Reduce CSS code splitting
			cssCodeSplit: false,
			// Limit asset inlining
			assetsInlineLimit: 0,
		},
		// More conservative dependency optimization
		optimizeDeps: {
			// Minimal includes to reduce initial processing
			include: ['vue'],
			// Don't force rebuild unless necessary
			force: false,
			// Reduce concurrent processing
			esbuildOptions: {
				target: 'es2018',
			},
		},
		// Reduce dev server memory usage
		server: {
			hmr: {
				overlay: false,
			},
			// Reduce file watching
			watch: {
				ignored: ['**/node_modules/**', '**/.git/**'],
			},
		},
		// Reduce worker threads
		esbuild: {
			target: 'es2018',
			// Reduce parallel processing
			logLevel: 'error',
		},
	}),
	vitestConfig,
);
