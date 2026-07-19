import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist/server',
    lib: {
      entry: 'src/worker.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    minify: true,
  },
});
