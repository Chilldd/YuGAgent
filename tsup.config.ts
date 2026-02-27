import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points for the build
  entry: ['src/index.ts'],

  // Output directory
  outDir: 'dist',

  // Output format: ESM for Node.js
  format: ['esm'],

  // Target environment
  target: 'node18',

  // Generate sourcemaps for debugging
  sourcemap: true,

  // Clean output directory before build
  clean: true,

  // Don't bundle dependencies (they will be resolved from node_modules)
  external: [
    // Keep all dependencies as external
    /^@ai-sdk\/.*/,
    /^@inkjs\/.*/,
    /^ai$/,
    /^commander$/,
    /^cosmiconfig$/,
    /^ink$/,
    /^marked$/,
    /^react$/,
    /^uuid$/,
    /^zod$/,
  ],

  // TypeScript compilation options
  treeshake: true,
  splitting: false,

  // Define global constants
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
