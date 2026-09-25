import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Library build: produces dist-lib/{jui-graph-ts.es.js,jui-graph-ts.cjs.js,index.d.ts,<per-module
// .d.ts tree>}. `copyDtsFiles: true` is required, not optional: `src/index.ts` re-exports symbols
// via `export { Foo } from './some/module'` (relative paths), so the generated `index.d.ts` itself
// contains matching `export { Foo } from './some/module'` lines - without copying each module's own
// emitted `.d.ts` file into `outDir` alongside it, those relative re-exports dangle (no
// `dist-lib/some/module.d.ts` exists to resolve against), silently breaking every downstream
// consumer's type-checking (e.g. `CoreBrush`/`CoreWidget`/`Builder`/`Axis` all appearing to have no
// members at all) while the JS runtime bundle remains completely unaffected. Confirmed via a
// downstream consumer (`jui-chart-vue`) running `vue-tsc -b` against a built `dist-lib` and getting
// ~150 spurious `TS2339: Property 'x' does not exist` errors before this fix.
export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      outDirs: 'dist-lib',
      insertTypesEntry: true,
      copyDtsFiles: true,
    }),
  ],
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'JuiGraphTs',
      fileName: (format) => `jui-graph-ts.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
})
