import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Maps are written for local debugging, but the published files carry no
  // sourceMappingURL comment, and package.json leaves the maps out.
  sourcemap: 'hidden',
  clean: true,
  outDir: 'dist',
  target: 'node22',
  treeshake: true,
  unbundle: false,
  // Keep the published filenames stable: index.js/.d.ts for ESM, index.cjs/.d.cts for CJS.
  outExtensions: ({ format }) => (format === 'cjs' ? { js: '.cjs', dts: '.d.cts' } : { js: '.js', dts: '.d.ts' }),
})
