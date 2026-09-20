import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Library build: produces dist-lib/{jui-graph-ts.es.js,jui-graph-ts.cjs.js,index.d.ts}
export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      outDirs: 'dist-lib',
      insertTypesEntry: true,
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
