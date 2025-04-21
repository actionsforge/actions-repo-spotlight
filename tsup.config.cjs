const { defineConfig } = require('tsup');

module.exports = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: true,
  treeshake: true,
  external: ['@actions/core', '@actions/github', '@octokit/rest', 'esbuild'],
  platform: 'node'
});
